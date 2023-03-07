// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file cli.js
 * @copyright SKALE Labs 2019-Present
 */

const fs = require( "fs" );
const { cc } = require( "./utils" );
// const path = require( "path" );
// const url = require( "url" );
const os = require( "os" );
// const shell = require( "shelljs" );

function init() {
    rpcCall.rpcCallAddUsageRef();
    owaspUtils.owaspAddUsageRef();
}

const g_strAppName = "IMA AGENT";
const g_strVersion = "1.0";

function print_about( isLog ) {
    isLog = isLog || false;
    const strMsg = cc.attention( g_strAppName ) + cc.normal( " version " ) + cc.sunny( g_strVersion );
    if( isLog )
        log.write( strMsg + "\n" );
    else
        console.log( strMsg );
    return true;
}

function parse_command_line_argument( s ) {
    const joArg = {
        name: "",
        value: ""
    };
    try {
        if( !s )
            return joArg;
        s = "" + s;
        while( s.length > 0 && s[0] == "-" )
            s = s.substring( 1 );
        const n = s.indexOf( "=" );
        if( n < 0 ) {
            joArg.name = s;
            return joArg;
        }
        joArg.name = s.substring( 0, n );
        joArg.value = s.substring( n + 1 );
    } catch ( e ) {}
    return joArg;
}

//
//
// check correctness of command line arguments
function ensure_have_value( name, value, isExitIfEmpty, isPrintValue, fnNameColorizer, fnValueColorizer ) {
    isExitIfEmpty = isExitIfEmpty || false;
    isPrintValue = isPrintValue || false;
    fnNameColorizer = fnNameColorizer || ( ( x ) => {
        return cc.info( x );
    } );
    fnValueColorizer = fnValueColorizer || ( ( x ) => {
        return cc.notice( x );
    } );
    let retVal = true;
    value = value ? value.toString() : "";
    if( value.length === 0 ) {
        retVal = false;
        if( ! isPrintValue )
            console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " missing value for " ) + fnNameColorizer( name ) );
        if( isExitIfEmpty )
            process.exit( 126 );
    }
    let strDots = "...";
    let n = 50 - name.length;
    for( ; n > 0; --n )
        strDots += ".";
    if( isPrintValue )
        log.write( fnNameColorizer( name ) + cc.debug( strDots ) + fnValueColorizer( value ) + "\n" ); // just print value
    return retVal;
}

function ensure_have_chain_credentials( strFriendlyChainName, joAccount, isExitIfEmpty, isPrintValue ) {
    strFriendlyChainName = strFriendlyChainName || "<UNKNOWN>";
    if( ! ( typeof joAccount == "object" ) ) {
        log.write( cc.error( "ARGUMENTS VALIDATION WARNING:" ) +
            cc.warning( " bad account specified for " ) + cc.info( strFriendlyChainName ) +
            cc.warning( " chain" ) + "\n"
        );
        if( isExitIfEmpty )
            process.exit( 126 );
    }
    let cntAccountVariantsSpecified = 0;
    if( "strTransactionManagerURL" in joAccount && typeof joAccount.strTransactionManagerURL == "string" && joAccount.strTransactionManagerURL.length > 0 ) {
        ++ cntAccountVariantsSpecified;
        ensure_have_value( "" + strFriendlyChainName + "/TM/URL", joAccount.strTransactionManagerURL, isExitIfEmpty, isPrintValue );
    }
    if( "strSgxURL" in joAccount && typeof joAccount.strSgxURL == "string" && joAccount.strSgxURL.length > 0 ) {
        ++ cntAccountVariantsSpecified;
        ensure_have_value( "" + strFriendlyChainName + "/SGX/URL", joAccount.strSgxURL, isExitIfEmpty, isPrintValue );
        if( "strPathSslKey" in joAccount && typeof joAccount.strPathSslKey == "string" && joAccount.strPathSslKey.length > 0 )
            ensure_have_value( "" + strFriendlyChainName + "/SGX/SSL/keyPath", joAccount.strPathSslKey, isExitIfEmpty, isPrintValue );
        if( "strPathSslCert" in joAccount && typeof joAccount.strPathSslCert == "string" && joAccount.strPathSslCert.length > 0 )
            ensure_have_value( "" + strFriendlyChainName + "/SGX/SSL/certPath", joAccount.strPathSslCert, isExitIfEmpty, isPrintValue );
    }
    if( "strSgxKeyName" in joAccount && typeof joAccount.strSgxKeyName == "string" && joAccount.strSgxKeyName.length > 0 ) {
        ++ cntAccountVariantsSpecified;
        ensure_have_value( "" + strFriendlyChainName + "/SGX/keyName", joAccount.strSgxKeyName, isExitIfEmpty, isPrintValue );
    }
    if( "privateKey" in joAccount && typeof joAccount.privateKey == "string" && joAccount.privateKey.length > 0 ) {
        ++ cntAccountVariantsSpecified;
        ensure_have_value( "" + strFriendlyChainName + "/privateKey", joAccount.privateKey, isExitIfEmpty, isPrintValue );
    }
    if( "address_" in joAccount && typeof joAccount.address_ == "string" && joAccount.address_.length > 0 ) {
        ++ cntAccountVariantsSpecified;
        ensure_have_value( "" + strFriendlyChainName + "/walletAddress", joAccount.address_, isExitIfEmpty, isPrintValue );
    }
    if( cntAccountVariantsSpecified == 0 ) {
        log.write( cc.error( "ARGUMENTS VALIDATION WARNING:" ) +
            cc.warning( " bad credentials information specified for " ) + cc.info( strFriendlyChainName ) +
            cc.warning( " chain, no explicit SGX, no explicit private key, no wallet address found" ) + "\n"
        );
        if( isExitIfEmpty )
            process.exit( 126 );
    }
    return true;
}

function find_node_index( joSChainNodeConfiguration ) {
    try {
        const searchID = joSChainNodeConfiguration.skaleConfig.nodeInfo.nodeID;
        const cnt = joSChainNodeConfiguration.skaleConfig.sChain.nodes.length;
        for( let i = 0; i < cnt; ++i ) {
            const joNodeDescription = joSChainNodeConfiguration.skaleConfig.sChain.nodes[i];
            if( joNodeDescription.nodeID == searchID )
                return i;
        }
    } catch ( e ) {}
    return 0; // ???
}

function load_node_config( strPath ) {
    const strLogPrefix = cc.info( "Node config:" ) + " ";
    try {
        strPath = imaUtils.normalizePath( strPath );
        //
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Loading values from S-Chain configuration JSON file " ) + cc.note( strPath ) + cc.debug( "..." ) + "\n" );
        const strJsonSChainNodeConfiguration = fs.readFileSync( strPath, "utf8" );
        const joSChainNodeConfiguration = JSON.parse( strJsonSChainNodeConfiguration );
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "S-Chain configuration JSON: " ) + cc.j( joSChainNodeConfiguration ) + "\n" );
        //
        imaState.nNodeNumber = find_node_index( joSChainNodeConfiguration );
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "....from S-Chain configuration JSON file...." ) + cc.notice( "this node index" ) + cc.debug( " is " ) + cc.info( imaState.nNodeNumber ) + "\n" );
        imaState.nNodesCount = joSChainNodeConfiguration.skaleConfig.sChain.nodes.length;
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "....from S-Chain configuration JSON file...." ) + cc.notice( "nodes count" ) + cc.debug( " is " ) + cc.info( imaState.nNodesCount ) + "\n" );
        //
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Done" ) + cc.debug( " loading values from S-Chain configuration JSON file " ) + cc.note( strPath ) + cc.debug( "." ) + "\n" );
    } catch ( e ) {
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR: Exception in load_node_config():" ) + cc.error( e ) + "\n" );
    }
}

function parse( joExternalHandlers, argv ) {
    let idxArg; const cntArgs = argv || process.argv.length;
    for( idxArg = 2; idxArg < cntArgs; ++idxArg ) {
        const joArg = parse_command_line_argument( process.argv[idxArg] );
        if( joArg.name == "help" ) {
            print_about();
            const soi = "    "; // options indent
            //
            console.log( cc.sunny( "GENERAL" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "help" ) + cc.debug( ".........................." ) + cc.notice( "Show this " ) + cc.note( "help info" ) + cc.notice( " and exit." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "version" ) + cc.debug( "......................." ) + cc.notice( "Show " ) + cc.note( "version info" ) + cc.notice( " and exit." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "colors" ) + cc.debug( "........................" ) + cc.notice( "Use " ) + cc.rainbow( "ANSI-colorized logging" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "no-colors" ) + cc.debug( "....................." ) + cc.notice( "Use " ) + cc.normal( "monochrome logging" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "BLOCKCHAIN NETWORK" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "url-main-net" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( ".............." ) + cc.note( "Main-net" ) + cc.notice( " URL. Value is automatically loaded from the " ) + cc.warning( "URL_W3_ETHEREUM" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "url-s-chain" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "..............." ) + cc.note( "S-chain" ) + cc.notice( " URL. Value is automatically loaded from the " ) + cc.warning( "URL_W3_S_CHAIN" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "url-t-chain" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "..............." ) + cc.note( "S<->S Target S-chain" ) + cc.notice( " URL. Value is automatically loaded from the " ) + cc.warning( "URL_W3_S_CHAIN_TARGET" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "id-main-net" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............" ) + cc.note( "Main-net" ) + cc.notice( " Ethereum " ) + cc.note( "network name." ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "CHAIN_NAME_ETHEREUM" ) + cc.notice( " environment variable if not specified. " ) + cc.debug( "Default value is " ) + cc.sunny( "\"Mainnet\"" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "id-s-chain" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............." ) + cc.note( "S-chain" ) + cc.notice( " Ethereum " ) + cc.note( "network name." ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "CHAIN_NAME_SCHAIN" ) + cc.notice( " environment variable if not specified. " ) + cc.debug( "Default value is " ) + cc.sunny( "\"id-S-chain\"" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "id-t-chain" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............." ) + cc.note( "S<->S Target S-chain" ) + cc.notice( " Ethereum " ) + cc.note( "network name." ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "CHAIN_NAME_SCHAIN_TARGET" ) + cc.notice( " environment variable if not specified. " ) + cc.debug( "Default value is " ) + cc.sunny( "\"id-T-chain\"" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "cid-main-net" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "..........." ) + cc.note( "Main-net" ) + cc.notice( " Ethereum " ) + cc.attention( "chain ID" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "CID_ETHEREUM" ) + cc.notice( " environment variable if not specified. " ) + cc.debug( "Default value is " ) + cc.sunny( -4 ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "cid-s-chain" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............" ) + cc.note( "S-chain" ) + cc.notice( " Ethereum " ) + cc.attention( "chain ID" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "CID_SCHAIN" ) + cc.notice( " environment variable if not specified. " ) + cc.debug( "Default value is " ) + cc.sunny( -4 ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "cid-t-chain" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............" ) + cc.note( "S<->S Target S-chain" ) + cc.notice( " Ethereum " ) + cc.attention( "chain ID" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "CID_SCHAIN_TARGET" ) + cc.notice( " environment variable if not specified. " ) + cc.debug( "Default value is " ) + cc.sunny( -4 ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "BLOCKCHAIN INTERFACE" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "abi-skale-manager" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "........" ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "Skale Manager" ) + cc.notice( " ABI. " ) + cc.debug( "Optional parameter. It's needed for " ) + cc.note( "S-Chain" ) + cc.debug( " to " ) + cc.note( "S-Chain" ) + cc.debug( " transfers." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "abi-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "............." ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "IMA" ) + cc.notice( " ABI for " ) + cc.note( "Main-net" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "abi-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( ".............." ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "IMA" ) + cc.notice( " ABI for " ) + cc.note( "S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "abi-t-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( ".............." ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "IMA" ) + cc.notice( " ABI for " ) + cc.note( "S<->S Target S-chain" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "ERC20 INTERFACE" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc20-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "..........." ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "ERC20" ) + cc.notice( " ABI for " ) + cc.note( "Main-net" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc20-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "............" ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "ERC20" ) + cc.notice( " ABI for " ) + cc.note( "S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "addr-erc20-s-chain" ) + cc.sunny( "=" ) + cc.attention( "address" ) + cc.debug( "...." ) + cc.notice( "Explicit " ) + cc.bright( "ERC20" ) + cc.notice( " address in " ) + cc.note( "S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc20-t-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "............" ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "ERC20" ) + cc.notice( " ABI for " ) + cc.note( "S<->S Target S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "addr-erc20-t-chain" ) + cc.sunny( "=" ) + cc.attention( "address" ) + cc.debug( "...." ) + cc.notice( "Explicit " ) + cc.bright( "ERC20" ) + cc.notice( " address in " ) + cc.note( "S<->S Target S-chain" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "ERC721 INTERFACE" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc721-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( ".........." ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "ERC721" ) + cc.notice( " ABI for " ) + cc.note( "Main-net" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc721-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "..........." ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "ERC721" ) + cc.notice( " ABI for " ) + cc.note( "S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "addr-erc721-s-chain" ) + cc.sunny( "=" ) + cc.attention( "address" ) + cc.debug( "..." ) + cc.notice( "Explicit " ) + cc.bright( "ERC721" ) + cc.notice( " address in " ) + cc.note( "S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc721-t-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "..........." ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "ERC721" ) + cc.notice( " ABI for " ) + cc.note( "S<->S S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "addr-erc721-t-chain" ) + cc.sunny( "=" ) + cc.attention( "address" ) + cc.debug( "..." ) + cc.notice( "Explicit " ) + cc.bright( "ERC721" ) + cc.notice( " address in " ) + cc.note( "S<->S S-chain" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "ERC1155 INTERFACE" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc1155-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "........." ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "ERC1155" ) + cc.notice( " ABI for " ) + cc.note( "Main-net" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc1155-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( ".........." ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "ERC1155" ) + cc.notice( " ABI for " ) + cc.note( "S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "addr-erc1155-s-chain" ) + cc.sunny( "=" ) + cc.attention( "address" ) + cc.debug( ".." ) + cc.notice( "Explicit " ) + cc.bright( "ERC1155" ) + cc.notice( " address in " ) + cc.note( "S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc1155-t-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( ".........." ) + cc.notice( "Path to JSON file containing " ) + cc.bright( "ERC1155" ) + cc.notice( " ABI for " ) + cc.note( "S<->S S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "addr-erc1155-t-chain" ) + cc.sunny( "=" ) + cc.attention( "address" ) + cc.debug( ".." ) + cc.notice( "Explicit " ) + cc.bright( "ERC1155" ) + cc.notice( " address in " ) + cc.note( "S<->S S-chain" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "USER ACCOUNT" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "tm-url-main-net" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "..........." ) + cc.bright( "Transaction Manager" ) + cc.notice( " server URL for " ) + cc.note( "Main-net" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "TRANSACTION_MANAGER_URL_ETHEREUM" ) + cc.notice( " environment variable if not specified. " ) + cc.debug( "Example: " ) + cc.bright( "redis://@127.0.0.1:6379" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "tm-url-s-chain" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "............" ) + cc.bright( "Transaction Manager" ) + cc.notice( " server URL for " ) + cc.note( "S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "TRANSACTION_MANAGER_URL_S_CHAIN" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "tm-url-t-chain" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "............" ) + cc.bright( "Transaction Manager" ) + cc.notice( " server URL for " ) + cc.note( "S<->S Target S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "TRANSACTION_MANAGER_URL_S_CHAIN_TARGET" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "tm-priority-main-net" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "......" ) + cc.bright( "Transaction Manager" ) + cc.notice( " priority for " ) + cc.note( "Main-net" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "TRANSACTION_MANAGER_PRIORITY_ETHEREUM" ) + cc.notice( " environment variable if not specified. " ) + cc.debug( "Default is " ) + cc.sunny( "5" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "tm-priority-s-chain" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "......." ) + cc.bright( "Transaction Manager" ) + cc.notice( " priority for " ) + cc.note( "S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "TRANSACTION_MANAGER_PRIORITY_S_CHAIN" ) + cc.notice( " environment variable if not specified. " ) + cc.debug( "Default is " ) + cc.sunny( "5" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "tm-priority-t-chain" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "......." ) + cc.bright( "Transaction Manager" ) + cc.notice( " priority for " ) + cc.note( "S<->S Target S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "TRANSACTION_MANAGER_PRIORITY_S_CHAIN_TARGET" ) + cc.notice( " environment variable if not specified. " ) + cc.debug( "Default is " ) + cc.sunny( "5" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-url-main-net" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( ".........." ) + cc.sunny( "SGX server" ) + cc.notice( " URL for " ) + cc.note( "Main-net" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_URL_ETHEREUM" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-url-s-chain" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "..........." ) + cc.sunny( "SGX server" ) + cc.notice( " URL for " ) + cc.note( "S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_URL_S_CHAIN" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-url-t-chain" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "..........." ) + cc.sunny( "SGX server" ) + cc.notice( " URL for " ) + cc.note( "S<->S Target S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_URL_S_CHAIN_TARGET" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-ecdsa-key-main-net" ) + cc.sunny( "=" ) + cc.error( "name" ) + cc.debug( "..." ) + cc.attention( "SGX/ECDSA key name" ) + cc.notice( " for " ) + cc.note( "Main-net" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_KEY_ETHEREUM" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-ecdsa-key-s-chain" ) + cc.sunny( "=" ) + cc.error( "name" ) + cc.debug( "...." ) + cc.attention( "SGX/ECDSA key name" ) + cc.notice( " for " ) + cc.note( "S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_KEY_S_CHAIN" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-ecdsa-key-t-chain" ) + cc.sunny( "=" ) + cc.error( "name" ) + cc.debug( "...." ) + cc.attention( "SGX/ECDSA key name" ) + cc.notice( " for " ) + cc.note( "S<->S Target S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_KEY_S_CHAIN_TARGET" ) + cc.notice( " environment variable if not specified." ) );
            //
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-ssl-key-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "....." ) + cc.notice( "Path to " ) + cc.note( "SSL key file" ) + cc.notice( " for " ) + cc.bright( "SGX wallet" ) + cc.notice( " of " ) + cc.note( "Main-net" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_SSL_KEY_FILE_ETHEREUM" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-ssl-key-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "......" ) + cc.notice( "Path to " ) + cc.note( "SSL key file" ) + cc.notice( " for " ) + cc.bright( "SGX wallet" ) + cc.notice( " of " ) + cc.note( "S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_SSL_KEY_FILE_S_CHAIN" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-ssl-key-t-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "......" ) + cc.notice( "Path to " ) + cc.note( "SSL key file" ) + cc.notice( " for " ) + cc.bright( "SGX wallet" ) + cc.notice( " of " ) + cc.note( "S<->S Target S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_SSL_KEY_FILE_S_CHAIN_TARGET" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-ssl-cert-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "...." ) + cc.notice( "Path to " ) + cc.note( "SSL certificate file" ) + cc.notice( " for " ) + cc.bright( "SGX wallet" ) + cc.notice( " of " ) + cc.note( "Main-net" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_SSL_CERT_FILE_ETHEREUM" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-ssl-cert-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "....." ) + cc.notice( "Path to " ) + cc.note( "SSL certificate file" ) + cc.notice( " for " ) + cc.bright( "SGX wallet" ) + cc.notice( " of " ) + cc.note( "S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_SSL_CERT_FILE_S_CHAIN" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sgx-ssl-cert-t-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "....." ) + cc.notice( "Path to " ) + cc.note( "SSL certificate file" ) + cc.notice( " for " ) + cc.bright( "SGX wallet" ) + cc.notice( " of " ) + cc.note( "S<->S Target S-chain" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "SGX_SSL_CERT_FILE_S_CHAIN_TARGET" ) + cc.notice( " environment variable if not specified." ) );
            //
            console.log( soi + cc.debug( "--" ) + cc.bright( "address-main-net" ) + cc.sunny( "=" ) + cc.warning( "value" ) + cc.debug( "........" ) + cc.note( "Main-net" ) + " " + cc.attention( "user account address" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "ACCOUNT_FOR_ETHEREUM" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "address-s-chain" ) + cc.sunny( "=" ) + cc.warning( "value" ) + cc.debug( "........." ) + cc.note( "S-chain" ) + " " + cc.attention( "user account address" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "ACCOUNT_FOR_SCHAIN" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "address-t-chain" ) + cc.sunny( "=" ) + cc.warning( "value" ) + cc.debug( "........." ) + cc.note( "S<->S Target S-chain" ) + " " + cc.attention( "user account address" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "ACCOUNT_FOR_SCHAIN_TARGET" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "key-main-net" ) + cc.sunny( "=" ) + cc.error( "value" ) + cc.debug( "............" ) + cc.attention( "Private key" ) + cc.notice( " for " ) + cc.note( "Main-net" ) + " " + cc.attention( "user account address" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "PRIVATE_KEY_FOR_ETHEREUM" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "key-s-chain" ) + cc.sunny( "=" ) + cc.error( "value" ) + cc.debug( "............." ) + cc.attention( "Private key" ) + cc.notice( " for " ) + cc.note( "S-Chain" ) + " " + cc.attention( "user account address" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "PRIVATE_KEY_FOR_SCHAIN" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "key-t-chain" ) + cc.sunny( "=" ) + cc.error( "value" ) + cc.debug( "............." ) + cc.attention( "Private key" ) + cc.notice( " for " ) + cc.note( "S<->S Target S-Chain" ) + " " + cc.attention( "user account address" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "PRIVATE_KEY_FOR_SCHAIN_TARGET" ) + cc.notice( " environment variable if not specified." ) );
            //
            console.log( soi + cc.debug( "Please notice, IMA prefer to use transaction manager to sign blockchain transactions if " ) +
                cc.attention( "--tm-url-main-net" ) + cc.debug( "/" ) + cc.attention( "--tm-url-s-chain" ) + cc.debug( " command line values or " ) +
                cc.warning( "TRANSACTION_MANAGER_URL_ETHEREUM" ) + cc.debug( "/" ) + cc.warning( "TRANSACTION_MANAGER_URL_S_CHAIN" ) +
                cc.debug( " shell variables were specified. Next preferred option is SGX wallet which is used if " ) +
                cc.attention( "--sgx-url-main-net" ) + cc.debug( "/" ) + cc.attention( "--sgx-url-s-chain" ) + cc.debug( " command line values or " ) +
                cc.warning( "SGX_URL_ETHEREUM" ) + cc.debug( "/" ) + cc.warning( "SGX_URL_S_CHAIN" ) +
                cc.debug( " shell variables were specified. SGX signing also needs key name, key and certificate files. " ) +
                cc.debug( "Finally, IMA attempts to use explicitly provided private key to sign blockchain transactions if " ) +
                cc.attention( "--key-main-net" ) + cc.debug( "/" ) + cc.attention( "--key-s-chain" ) + cc.debug( " command line values or " ) +
                cc.warning( "PRIVATE_KEY_FOR_ETHEREUM" ) + cc.debug( "/" ) + cc.warning( "PRIVATE_KEY_FOR_SCHAIN" ) +
                cc.debug( " shell variables were specified. " )
            );
            //
            console.log( cc.sunny( "GENERAL TRANSFER" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "value" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.warning( "unitName" ) + cc.debug( ".........." ) + cc.notice( "Amount of " ) + cc.attention( "unitName" ) + cc.notice( " to transfer, where " ) + cc.attention( "unitName" ) + cc.notice( " is well known Ethereum unit name like " ) + cc.attention( "ether" ) + cc.notice( " or " ) + cc.attention( "wei" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "wei" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "...................." ) + cc.notice( "Amount of " ) + cc.attention( "wei" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "babbage" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................" ) + cc.notice( "Amount of " ) + cc.attention( "babbage" ) + cc.info( "(wei*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "lovelace" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "..............." ) + cc.notice( "Amount of " ) + cc.attention( "lovelace" ) + cc.info( "(wei*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "shannon" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................" ) + cc.notice( "Amount of " ) + cc.attention( "shannon" ) + cc.info( "(wei*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "szabo" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( ".................." ) + cc.notice( "Amount of " ) + cc.attention( "szabo" ) + cc.info( "(wei*1000*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "finney" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................." ) + cc.notice( "Amount of " ) + cc.attention( "finney" ) + cc.info( "(wei*1000*1000*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "ether" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( ".................." ) + cc.notice( "Amount of " ) + cc.attention( "ether" ) + cc.info( "(wei*1000*1000*1000*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "amount" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................." ) + cc.notice( "Amount of " ) + cc.attention( "tokens" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "tid" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "...................." ) + cc.bright( "ERC721" ) + cc.notice( " or " ) + cc.bright( "ERC1155" ) + cc.notice( " token id to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "amounts" ) + cc.sunny( "=" ) + cc.attention( "array of numbers" ) + cc.debug( "......" ) + cc.bright( "ERC1155" ) + cc.notice( " token id to transfer in batch." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "tids" ) + cc.sunny( "=" ) + cc.attention( "array of numbers" ) + cc.debug( "........." ) + cc.bright( "ERC1155" ) + cc.notice( " token amount to transfer in batch." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sleep-between-tx" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "......." ) + cc.notice( "Sleep time " ) + cc.debug( "(in milliseconds)" ) + cc.notice( " between transactions during complex operations." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "wait-next-block" ) + cc.debug( "..............." ) + cc.notice( "Wait for next block between transactions during complex operations." ) );
            //
            console.log( cc.sunny( "S-CHAIN TO S-CHAIN TRANSFER" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2s-enable" ) + cc.debug( "...................." ) + cc.success( "Enables" ) + " " + cc.note( "S-Chain" ) + cc.notice( " to " ) + cc.note( "S-Chain" ) + cc.notice( " transfers. " ) + cc.debug( "Default mode" ) + cc.notice( ". The " ) + cc.bright( "abi-skale-manager" ) + cc.notice( " path must be provided." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2s-disable" ) + cc.debug( "..................." ) + cc.error( "Disables" ) + " " + cc.note( "S-Chain" ) + cc.notice( " to " ) + cc.note( "S-Chain" ) + cc.notice( " transfers." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "net-rediscover" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "........." ) + cc.note( "SKALE NETWORK" ) + cc.notice( " re-discovery interval" ) + cc.debug( "(in seconds)" ) + cc.notice( ". " ) + cc.debug( "Default is " ) + cc.sunny( "3600" ) + cc.debug( " seconds or " ) + cc.sunny( "1" ) + cc.debug( " hour, specify " ) + cc.sunny( "0" ) + cc.debug( " to " ) + cc.error( "disable" ) + " " + cc.note( "SKALE NETWORK" ) + cc.debug( " re-discovery" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "PAYMENT TRANSACTION" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gas-price-multiplier-mn" ) + cc.debug( "......." ) + cc.notice( "Sets " ) + cc.attention( "Gas Price Multiplier" ) + cc.notice( " for " ) + cc.note( "Main Net" ) + cc.notice( " transactions, " ) + cc.debug( "Default value is " ) + cc.sunny( "1.25" ) + cc.notice( "." ) + cc.debug( " Specify value " ) + cc.sunny( "0.0" ) + cc.debug( " to " ) + cc.error( "disable" ) + " " + cc.attention( "Gas Price Customization" ) + cc.debug( " for " ) + cc.note( "Main Net" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gas-price-multiplier-sc" ) + cc.debug( "......." ) + cc.notice( "Sets " ) + cc.attention( "Gas Price Multiplier" ) + cc.notice( " for " ) + cc.note( "S-Chain" ) + cc.notice( " transactions, " ) + cc.debug( "Default value is " ) + cc.sunny( "0.0" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gas-price-multiplier-tc" ) + cc.debug( "......." ) + cc.notice( "Sets " ) + cc.attention( "Gas Price Multiplier" ) + cc.notice( " for " ) + cc.note( "S<->S Target S-Chain" ) + cc.notice( " transactions, " ) + cc.debug( "Default value is " ) + cc.sunny( "0.0" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gas-price-multiplier" ) + cc.debug( ".........." ) + cc.notice( "Sets " ) + cc.attention( "Gas Price Multiplier" ) + cc.notice( " for both " ) + cc.note( "Main Net" ) + cc.notice( " and " ) + cc.note( "S-Chain" ) + cc.debug( "(s)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gas-multiplier-mn" ) + cc.debug( "............." ) + cc.notice( "Sets " ) + cc.attention( "Gas Value Multiplier" ) + cc.notice( " for " ) + cc.note( "Main Net" ) + cc.notice( " transactions, " ) + cc.debug( "Default value is " ) + cc.sunny( "1.25" ) + cc.notice( "." ) + cc.debug( " Specify value " ) + cc.sunny( "0.0" ) + cc.debug( " to " ) + cc.error( "disable" ) + " " + cc.attention( "Gas Price Customization" ) + cc.debug( " for " ) + cc.note( "Main Net" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gas-multiplier-sc" ) + cc.debug( "............." ) + cc.notice( "Sets " ) + cc.attention( "Gas Value Multiplier" ) + cc.notice( " for " ) + cc.note( "S-Chain" ) + cc.notice( " transactions, " ) + cc.debug( "Default value is " ) + cc.sunny( "1.25" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gas-multiplier-tc" ) + cc.debug( "............." ) + cc.notice( "Sets " ) + cc.attention( "Gas Value Multiplier" ) + cc.notice( " for " ) + cc.note( "S<->S Target S-Chain" ) + cc.notice( " transactions, " ) + cc.debug( "Default value is " ) + cc.sunny( "1.25" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gas-multiplier" ) + cc.debug( "................" ) + cc.notice( "Sets " ) + cc.attention( "Gas Value Multiplier" ) + cc.notice( " for both " ) + cc.note( "Main Net" ) + cc.notice( " and " ) + cc.note( "S-Chain" ) + cc.debug( "(s)" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "REGISTRATION" ) + cc.info( " commands:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "register" ) + cc.debug( "......................" ) + cc.notice( "Register" ) + cc.debug( "(perform " ) + cc.sunny( "all steps" ) + cc.debug( ")" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "register1" ) + cc.debug( "....................." ) + cc.notice( "Perform registration " ) + cc.sunny( "step 1" ) + cc.notice( " - register " ) + cc.note( "S-Chain" ) + cc.notice( " on " ) + cc.note( "Main-net" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration" ) + cc.debug( "............" ) + cc.notice( "Perform registration status check" ) + cc.debug( "(perform " ) + cc.sunny( "all steps" ) + cc.debug( ")" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration1" ) + cc.debug( "..........." ) + cc.notice( "Perform registration status check " ) + cc.sunny( "step 1" ) + cc.notice( " - register " ) + cc.note( "S-Chain" ) + cc.notice( " on " ) + cc.note( "Main-net" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration2" ) + cc.debug( "..........." ) + cc.notice( "Perform registration status check " ) + cc.sunny( "step 2" ) + cc.notice( " - register " ) + cc.note( "S-Chain" ) + cc.notice( " in " ) + cc.attention( "deposit box" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration3" ) + cc.debug( "..........." ) + cc.notice( "Perform registration status check " ) + cc.sunny( "step 3" ) + cc.notice( " - register " ) + cc.note( "Main-net" ) + cc.notice( "'s " ) + cc.attention( "deposit box" ) + cc.notice( " on " ) + cc.note( "S-Chain" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "ACTION" ) + cc.info( " commands:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "show-config" ) + cc.debug( "..................." ) + cc.notice( "Show " ) + cc.note( "configuration values" ) + cc.notice( " and exit." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "show-balance" ) + cc.debug( ".................." ) + cc.notice( "Show " ) + cc.note( "ETH" ) + cc.notice( " and/or token balances on " ) + cc.note( "Main-net" ) + cc.notice( " and/or " ) + cc.note( "S-Chain" ) + cc.notice( " and exit." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-payment" ) + cc.debug( "..................." ) + cc.notice( "Do one payment from " ) + cc.note( "Main-net" ) + cc.notice( " user account to " ) + cc.note( "S-chain" ) + cc.notice( " user account." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-payment" ) + cc.debug( "..................." ) + cc.notice( "Do one payment from " ) + cc.note( "S-chain" ) + cc.notice( " user account to " ) + cc.note( "Main-net" ) + cc.notice( " user account." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-receive" ) + cc.debug( "..................." ) + cc.notice( "Receive one payment from " ) + cc.note( "S-chain" ) + cc.notice( " user account to " ) + cc.note( "Main-net" ) + cc.notice( " user account" ) + cc.debug( "(ETH only, receives all the ETH pending in transfer)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-view" ) + cc.debug( "......................" ) + cc.notice( "View money amount user can receive as payment from " ) + cc.note( "S-chain" ) + cc.notice( " user account to " ) + cc.note( "Main-net" ) + cc.notice( " user account" ) + cc.debug( "(ETH only, receives all the ETH pending in transfer)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2s-payment" ) + cc.debug( "..................." ) + cc.notice( "Do one payment from " ) + cc.note( "S-chain" ) + cc.notice( " user account to other " ) + cc.note( "S-chain" ) + cc.notice( " user account." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2s-forward" ) + cc.debug( "..................." ) + cc.notice( "Indicates " ) + cc.note( "S<->S" ) + cc.notice( " transfer direction is " ) + cc.attention( "forward" ) + cc.notice( ". I.e. source " ) + cc.note( "S-chain" ) + cc.notice( " is token minter and instantiator. " ) + cc.debug( "This is default mode" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2s-reverse" ) + cc.debug( "..................." ) + cc.notice( "Indicates " ) + cc.note( "S<->S" ) + cc.notice( " transfer direction is " ) + cc.attention( "reverse" ) + cc.notice( ". I.e. destination " ) + cc.note( "S-chain" ) + cc.notice( " is token minter and instantiator." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-transfer" ) + cc.debug( ".................." ) + cc.notice( "Do single " ) + cc.attention( "money transfer loop" ) + cc.notice( " from " ) + cc.note( "Main-net" ) + cc.notice( " to " ) + cc.note( "S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-transfer" ) + cc.debug( ".................." ) + cc.notice( "Do single " ) + cc.attention( "money transfer loop" ) + cc.notice( " from " ) + cc.note( "S-chain" ) + cc.notice( " to " ) + cc.note( "Main-net" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2s-transfer" ) + cc.debug( ".................." ) + cc.notice( "Do single " ) + cc.attention( "money transfer loop" ) + cc.notice( " from " ) + cc.note( "S-chain" ) + cc.notice( " to " ) + cc.note( "S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "with-metadata" ) + cc.debug( "................." ) + cc.notice( "Makes " ) + cc.bright( "ERC721" ) + cc.notice( " transfer using special version of " ) + cc.bright( "Token Manager" ) + cc.notice( " to transfer token metadata." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "transfer" ) + cc.debug( "......................" ) + cc.notice( "Run single " ) + cc.note( "M<->S" ) + cc.notice( " and, optionally, " ) + cc.note( "S->S" ) + cc.notice( " transfer loop iteration" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "loop" ) + cc.debug( ".........................." ) + cc.notice( "Run " ) + cc.note( "M<->S" ) + cc.notice( " and, optionally, " ) + cc.note( "S->S" ) + cc.notice( " transfer loop." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "load-node-config" ) + cc.sunny( "=" ) + cc.success( "path" ) + cc.debug( "........." ) + cc.notice( "Use specified " ) + cc.note( "S-Chain" ) + cc.notice( " node JSON configuration file to load parameters" ) + cc.debug( "(like " ) + cc.attention( "node index" ) + cc.debug( ", " ) + cc.attention( "nodes count" ) + cc.debug( ")" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "ADDITIONAL ACTION" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "no-wait-s-chain" ) + cc.debug( "..............." ) + cc.notice( "Do not wait until " ) + cc.note( "S-Chain" ) + cc.notice( " is started." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "max-wait-attempts" ) + cc.sunny( "=" ) + cc.info( "value" ) + cc.debug( "......." ) + cc.notice( "Max number of " ) + cc.note( "S-Chain" ) + cc.notice( " call attempts to do while it became alive and sane." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "skip-dry-run" ) + cc.debug( ".................." ) + cc.notice( "Skip " ) + cc.note( "dry run" ) + cc.notice( " contract method calls." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "ignore-dry-run" ) + cc.debug( "................" ) + cc.notice( "Ignore result of " ) + cc.note( "dry run" ) + cc.notice( " contract method calls and continue execute." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "dry-run" ) + cc.debug( "......................." ) + cc.notice( "Use error results of " ) + cc.note( "dry run" ) + cc.notice( " contract method calls as actual errors and stop execute." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-transfer-block-size" ) + cc.debug( "......." ) + cc.notice( "Number of transactions in one block to use in money transfer loop from " ) + cc.note( "Main-net" ) + cc.notice( " to " ) + cc.note( "S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-transfer-block-size" ) + cc.debug( "......." ) + cc.notice( "Number of transactions in one block to use in money transfer loop from " ) + cc.note( "S-chain" ) + cc.notice( " to " ) + cc.note( "Main-net" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2s-transfer-block-size" ) + cc.debug( "......." ) + cc.notice( "Number of transactions in one block to use in money transfer loop from " ) + cc.note( "S-chain" ) + cc.notice( " to " ) + cc.note( "S-chain" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "transfer-block-size" ) + cc.debug( "..........." ) + cc.notice( "Number of transactions in one block to use in both money transfer loops." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-max-transactions" ) + cc.debug( ".........." ) + cc.notice( "Maximal number of transactions to do in money transfer loop from " ) + cc.note( "Main-net" ) + cc.notice( " to " ) + cc.note( "S-chain" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is unlimited)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-max-transactions" ) + cc.debug( ".........." ) + cc.notice( "Maximal number of transactions to do in money transfer loop from " ) + cc.note( "S-chain" ) + cc.notice( " to " ) + cc.note( "Main-net" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is unlimited)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2s-max-transactions" ) + cc.debug( ".........." ) + cc.notice( "Maximal number of transactions to do in money transfer loop from " ) + cc.note( "S-chain" ) + cc.notice( " to " ) + cc.note( "S-chain" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is unlimited)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "max-transactions" ) + cc.debug( ".............." ) + cc.notice( "Maximal number of transactions to do in both money transfer loops" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is unlimited)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-await-blocks" ) + cc.debug( ".............." ) + cc.notice( "Maximal number of blocks to wait to appear in blockchain before transaction from " ) + cc.note( "Main-net" ) + cc.notice( " to " ) + cc.note( "S-chain" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is no wait)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-await-blocks" ) + cc.debug( ".............." ) + cc.notice( "Maximal number of blocks to wait to appear in blockchain before transaction from " ) + cc.note( "S-chain" ) + cc.notice( " to " ) + cc.note( "Main-net" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is no wait)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2s-await-blocks" ) + cc.debug( ".............." ) + cc.notice( "Maximal number of blocks to wait to appear in blockchain before transaction from " ) + cc.note( "S-chain" ) + cc.notice( " to " ) + cc.note( "S-chain" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is no wait)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "await-blocks" ) + cc.debug( ".................." ) + cc.notice( "Maximal number of blocks to wait to appear in blockchain before transaction between both " ) + cc.note( "S-chain" ) + cc.notice( " and " ) + cc.note( "Main-net" ) + cc.debug( "(" ) + cc.sunny( "0 " ) + cc.debug( "is no wait)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-await-time" ) + cc.debug( "................" ) + cc.notice( "Minimal age of transaction message" ) + cc.debug( "(in seconds)" ) + cc.notice( " before it will be transferred from " ) + cc.note( "Main-net" ) + cc.notice( " to " ) + cc.note( "S-chain" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is no wait)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-await-time" ) + cc.debug( "................" ) + cc.notice( "Minimal age of transaction message" ) + cc.debug( "(in seconds)" ) + cc.notice( " before it will be transferred from " ) + cc.note( "S-chain" ) + cc.notice( " to " ) + cc.note( "Main-net" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is no wait)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2s-await-time" ) + cc.debug( "................" ) + cc.notice( "Minimal age of transaction message" ) + cc.debug( "(in seconds)" ) + cc.notice( " before it will be transferred from " ) + cc.note( "S-chain" ) + cc.notice( " to " ) + cc.note( "S-chain" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is no wait)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "await-time" ) + cc.debug( "...................." ) + cc.notice( "Minimal age of transaction message" ) + cc.debug( "(in seconds)" ) + cc.notice( " before it will be transferred between both " ) + cc.note( "S-chain" ) + cc.notice( " and " ) + cc.note( "Main-net" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is no wait)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "period" ) + cc.debug( "........................" ) + cc.notice( "Transfer " ) + cc.note( "loop period" ) + cc.debug( "(in seconds)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "node-number" ) + cc.sunny( "=" ) + cc.info( "value" ) + cc.debug( "............." ) + cc.note( "S-Chain" ) + " " + cc.bright( "node number" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( "-based)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "nodes-count" ) + cc.sunny( "=" ) + cc.info( "value" ) + cc.debug( "............." ) + cc.note( "S-Chain" ) + " " + cc.bright( "nodes count" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "time-framing" ) + cc.sunny( "=" ) + cc.note( "value" ) + cc.debug( "............" ) + cc.notice( "Specifies " ) + cc.note( "period" ) + cc.debug( "(in seconds) " ) + cc.note( "for time framing" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " to " ) + cc.error( "disable" ) + cc.debug( " time framing)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "time-gap" ) + cc.sunny( "=" ) + cc.note( "value" ) + cc.debug( "................" ) + cc.notice( "Specifies " ) + cc.note( "gap" ) + cc.debug( "(in seconds) " ) + cc.note( "before next time frame" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "auto-exit" ) + cc.sunny( "=" ) + cc.note( "seconds" ) + cc.debug( "............." ) + cc.notice( "Automatically exit " ) + cc.bright( "IMA Agent" ) + cc.notice( " after specified number of seconds" ) + cc.debug( "(" ) + cc.sunny( "0" ) + cc.debug( " is no automatic exit, " ) + cc.sunny( "3600" ) + cc.debug( " is no default)" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "TOKEN TESTING" ) + cc.info( " commands:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "mint-erc20" ) + cc.debug( "...................." ) + cc.notice( "Mint " ) + cc.note( "ERC20" ) + cc.notice( " tokens." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "mint-erc721" ) + cc.debug( "..................." ) + cc.notice( "Mint " ) + cc.note( "ERC721" ) + cc.notice( " tokens." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "mint-erc1155" ) + cc.debug( ".................." ) + cc.notice( "Mint " ) + cc.note( "ERC1155" ) + cc.notice( " tokens." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "burn-erc20" ) + cc.debug( "...................." ) + cc.notice( "Burn " ) + cc.note( "ERC20" ) + cc.notice( " tokens." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "burn-erc721" ) + cc.debug( "..................." ) + cc.notice( "Burn " ) + cc.note( "ERC721" ) + cc.notice( " tokens." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "burn-erc1155" ) + cc.debug( ".................." ) + cc.notice( "Burn " ) + cc.note( "ERC1155" ) + cc.notice( " tokens." ) );
            console.log( soi + cc.debug( "Please notice, token testing commands require " ) +
                cc.attention( "--tm-url-t-chain" ) + cc.debug( ", " ) + cc.attention( "cid-t-chain" ) + cc.debug( ", " ) +
                cc.attention( "erc20-t-chain" ) + cc.debug( " or " ) + cc.attention( "erc721-t-chain" ) + cc.debug( " or " ) +
                cc.attention( "erc1155-t-chain" ) + cc.debug( ", account information (like private key " ) +
                cc.attention( "key-t-chain" ) + cc.debug( ") command line arguments specified. Token amounts are specified via " ) +
                cc.attention( "amount" ) + cc.debug( " command line arguments specified. Token IDs are specified via " ) +
                cc.attention( "tid" ) + cc.debug( " or " ) + cc.attention( "tids" ) + cc.debug( " command line arguments." )
            );
            //
            console.log( cc.sunny( "PENDING TRANSACTIONS ANALYSIS" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "ptx" ) + cc.debug( "..........................." ) + cc.success( "Enable" ) + " " + cc.attention( "pending transaction analysis" ) + cc.notice( " to avoid transaction conflicts." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "no-ptx" ) + cc.debug( "........................" ) + cc.error( "Disable" ) + " " + cc.attention( "pending transaction analysis" ) + cc.notice( ". " ) + cc.warning( "Not recommended" ) + cc.notice( " for slow and overloaded blockchains." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "ptx-attempt" ) + cc.sunny( "=" ) + cc.info( "value" ) + cc.debug( "............." ) + cc.note( "Timeout " ) + cc.debug( "(in seconds)" ) + cc.notice( " to perform secondary " ) + cc.attention( "pending transaction analysis" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "ptx-ignore" ) + cc.debug( "...................." ) + cc.error( "Ignore" ) + cc.notice( " result of " ) + cc.attention( "pending transaction analysis" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "no-ptx-ignore" ) + cc.debug( "................." ) + cc.success( "Do not ignore" ) + cc.notice( " result of " ) + cc.attention( "pending transaction analysis" ) + cc.notice( ". Transfer loop will be delayed until " ) + cc.attention( "pending transactions disappear" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "ptx-ignore2" ) + cc.debug( "..................." ) + cc.error( "Ignore" ) + cc.notice( " secondary result of " ) + cc.attention( "pending transaction analysis" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "no-ptx-ignore2" ) + cc.debug( "................" ) + cc.success( "Do not ignore" ) + cc.notice( " secondary result of " ) + cc.attention( "pending transaction analysis" ) + cc.notice( ". Transfer loop will be delayed until " ) + cc.attention( "pending transactions disappear" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "IMA STATE" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "state-file" ) + cc.sunny( "=" ) + cc.info( "path" ) + cc.debug( "..............." ) + cc.notice( "Specifies path to IMA state file for optimized logs searches." ) );
            //
            console.log( cc.sunny( "MESSAGE SIGNING" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sign-messages" ) + cc.debug( "................." ) + cc.notice( "Sign transferred messages." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "bls-glue" ) + cc.sunny( "=" ) + cc.note( "path" ) + cc.debug( "................." ) + cc.notice( "Specifies path to " ) + cc.note( "bls_glue" ) + cc.notice( " application." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "hash-g1" ) + cc.sunny( "=" ) + cc.note( "path" ) + cc.debug( ".................." ) + cc.notice( "Specifies path to " ) + cc.note( "hash_g1" ) + cc.notice( " application." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "bls-verify" ) + cc.sunny( "=" ) + cc.note( "path" ) + cc.debug( "..............." ) + cc.debug( "Optional parameter, specifies path to " ) + cc.note( "verify_bls" ) + cc.debug( " application." ) );
            //
            console.log( cc.sunny( "MONITORING" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "monitoring-port" ) + cc.sunny( "=" ) + cc.note( "number" ) + cc.debug( "........" ) + cc.notice( "Run " ) + cc.note( "monitoring web socket RPC server" ) + cc.notice( " on specified port. " ) + cc.debug( "Specify " ) + cc.sunny( "0" ) + cc.debug( " to " ) + cc.error( "disable" ) + cc.notice( "." ) + cc.debug( " By default monitoring server is " ) + cc.error( "disabled" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "GAS REIMBURSEMENT" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "reimbursement-chain" ) + cc.sunny( "=" ) + cc.note( "name" ) + cc.debug( "......" ) + cc.notice( "Specifies chain name." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "reimbursement-recharge" ) + cc.sunny( "=" ) + cc.note( "v" ) + cc.warning( "u" ) + cc.debug( "....." ) + cc.success( "Recharge" ) + cc.notice( " user wallet with specified value " ) + cc.attention( "v" ) + cc.notice( ", unit name " ) + cc.attention( "u" ) + cc.notice( " is well known Ethereum unit name like " ) + cc.attention( "ether" ) + cc.notice( " or " ) + cc.attention( "wei" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "reimbursement-withdraw" ) + cc.sunny( "=" ) + cc.note( "v" ) + cc.warning( "u" ) + cc.debug( "....." ) + cc.error( "Withdraw" ) + cc.notice( " user wallet with specified value " ) + cc.attention( "v" ) + cc.notice( ", unit name " ) + cc.attention( "u" ) + cc.notice( " is well known Ethereum unit name like " ) + cc.attention( "ether" ) + cc.notice( " or " ) + cc.attention( "wei" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "reimbursement-balance" ) + cc.debug( "........." ) + cc.notice( "Show wallet balance." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "reimbursement-range" ) + cc.sunny( "=" ) + cc.note( "number" ) + cc.debug( "...." ) + cc.notice( "Sets " ) + cc.note( "minimal time interval" ) + cc.notice( " between transfers from " ) + cc.note( "S-Chain" ) + cc.notice( " to " ) + cc.note( "Main Net" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "PAST EVENTS SCAN" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "bs-step-size" ) + cc.sunny( "=" ) + cc.note( "number" ) + cc.debug( "..........." ) + cc.notice( "Specifies " ) + cc.note( "step block range size" ) + cc.notice( " to search iterative past events step by step. " ) + cc.sunny( "0" ) + cc.notice( " to " ) + cc.error( "disable" ) + cc.notice( " iterative search." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "bs-max-all-range" ) + cc.sunny( "=" ) + cc.note( "number" ) + cc.debug( "......." ) + cc.notice( "Specifies " ) + cc.note( "max number of steps" ) + cc.notice( " to allow to search as [0...latest] range. " ) + cc.sunny( "0" ) + cc.notice( " to " ) + cc.error( "disable" ) + cc.notice( " iterative search." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "bs-progressive-enable" ) + cc.debug( "........." ) + cc.success( "Enables" ) + " " + cc.attention( "progressive block scan" ) + cc.notice( " to search past events." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "bs-progressive-disable" ) + cc.debug( "........" ) + cc.error( "Disables" ) + " " + cc.attention( "progressive block scan" ) + cc.notice( " to search past events." ) );
            //
            console.log( cc.sunny( "ORACLE GAS PRICE MANAGEMENT" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "ogp-mode" ) + cc.sunny( "=" ) + cc.note( "number" ) + cc.debug( "..............." ) + cc.notice( "Oracle gas price mode: " ) + cc.sunny( "0" ) + cc.notice( " - " ) + cc.error( "disable" ) + cc.debug( "(default)" ) + cc.notice( ", " ) + cc.sunny( "1" ) + cc.notice( " - " ) + cc.success( "enable" ) + cc.notice( " and invoke before message transfer loop." ) );
            //
            console.log( cc.sunny( "TEST" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "browse-s-chain" ) + cc.debug( "................" ) + cc.notice( "Download own " ) + cc.note( "S-Chain" ) + cc.notice( " network information." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "browse-skale-network" ) + cc.debug( ".........." ) + cc.notice( "Download entire " ) + cc.note( "SKALE network" ) + cc.notice( " description." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "browse-connected-schains" ) + cc.debug( "......" ) + cc.notice( "Download " ) + cc.note( "S-Chains" ) + cc.notice( " connected to " ) + cc.note( "S-Chain" ) + cc.notice( " with name specified in " ) + cc.bright( "id-s-chain" ) + cc.notice( " command line parameter." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "discover-cid" ) + cc.debug( ".................." ) + cc.notice( "Discover " ) + cc.attention( "chains ID(s)" ) + cc.notice( " from provided " ) + cc.note( "URL(s)" ) + cc.notice( "." ) + cc.debug( " This command is not executed automatically at startup" ) + cc.notice( "." ) );
            //
            console.log( cc.sunny( "LOGGING" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "expose" ) + cc.debug( "........................" ) + cc.notice( "Expose " ) + cc.note( "low-level log details" ) + cc.notice( " after " ) + cc.success( "successful operations" ) + cc.notice( ". " ) + cc.debug( "By default details exposed only " ) + cc.error( "on errors" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "no-expose" ) + cc.debug( "....................." ) + cc.notice( "Expose " ) + cc.note( "low-level log details" ) + cc.notice( " only after " ) + cc.error( "errors" ) + cc.notice( ". " ) + cc.debug( "Default expose mode" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "verbose" ) + cc.sunny( "=" ) + cc.bright( "value" ) + cc.debug( "................." ) + cc.notice( "Set " ) + cc.note( "level" ) + cc.notice( " of output details." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "verbose-list" ) + cc.debug( ".................." ) + cc.notice( "List available " ) + cc.note( "verbose levels" ) + cc.notice( " and exit." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "log" ) + cc.sunny( "=" ) + cc.note( "path" ) + cc.debug( "......................" ) + cc.notice( "Write program output to specified " ) + cc.note( "log file" ) + cc.debug( "(multiple files can be specified)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "log-size" ) + cc.sunny( "=" ) + cc.note( "value" ) + cc.debug( "................" ) + cc.notice( "Max size" ) + cc.debug( "(in bytes)" ) + cc.notice( " of one log file" ) + cc.debug( "(affects to log log rotation)" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "log-files" ) + cc.sunny( "=" ) + cc.note( "value" ) + cc.debug( "..............." ) + cc.notice( "Maximum number of log files for log rotation." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gathered" ) + cc.debug( "......................" ) + cc.notice( "Print details of gathering data from command line arguments. " ) + cc.debug( "Default mode" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "no-gathered" ) + cc.debug( "..................." ) + cc.notice( "Do not print details of gathering data from command line arguments." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "expose-security-info" ) + cc.debug( ".........." ) + cc.notice( "Expose security-related values in log output." ) + " " + cc.debug( "This mode is needed for debugging purposes only" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "no-expose-security-info" ) + cc.debug( "......." ) + cc.notice( "Do not expose security-related values in log output." ) + " " + cc.debug( "Default mode" ) + cc.notice( "." ) );
            //
            process.exit( 0 );
        }
        if( joArg.name == "version" ) {
            print_about();
            process.exit( 0 );
        }
        if( joArg.name == "colors" ) {
            cc.enable( true );
            continue;
        }
        if( joArg.name == "no-colors" ) {
            cc.enable( false );
            continue;
        }
        if( joArg.name == "expose" ) {
            IMA.expose_details_set( true );
            continue;
        }
        if( joArg.name == "no-expose" ) {
            IMA.expose_details_set( false );
            continue;
        }
        if( joArg.name == "verbose" ) {
            IMA.verbose_set( IMA.verbose_parse( joArg.value ) );
            continue;
        }
        if( joArg.name == "verbose-list" ) {
            IMA.verbose_list();
            return 0;
        }
        if( joArg.name == "url-main-net" ) {
            owaspUtils.verifyArgumentIsURL( joArg );
            imaState.strURL_main_net = joArg.value;
            continue;
        }
        if( joArg.name == "url-s-chain" ) {
            owaspUtils.verifyArgumentIsURL( joArg );
            imaState.strURL_s_chain = joArg.value;
            continue;
        }
        if( joArg.name == "url-t-chain" ) {
            owaspUtils.verifyArgumentIsURL( joArg );
            imaState.strURL_t_chain = joArg.value;
            continue;
        }
        if( joArg.name == "id-main-net" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strChainName_main_net = joArg.value;
            continue;
        }
        if( joArg.name == "id-s-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strChainName_s_chain = joArg.value;
            continue;
        }
        if( joArg.name == "id-origin-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strChainName_origin_chain = joArg.value;
            continue;
        }
        if( joArg.name == "id-t-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strChainName_t_chain = joArg.value;
            continue;
        }
        if( joArg.name == "cid-main-net" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.cid_main_net = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "cid-s-chain" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.cid_s_chain = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "cid-t-chain" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.cid_t_chain = owaspUtils.toInteger( joArg.value );
            continue;
        }
        //
        //
        if( joArg.name == "tm-url-main-net" ) {
            owaspUtils.verifyArgumentIsURL( joArg );
            const strURL = "" + joArg.value;
            // if( strURL.indexOf( "/sign-and-send" ) < 0 )
            //    strURL += "/sign-and-send";
            // strURL += "/0";
            imaState.joAccount_main_net.strTransactionManagerURL = strURL;
            continue;
        }
        if( joArg.name == "tm-url-s-chain" ) {
            owaspUtils.verifyArgumentIsURL( joArg );
            const strURL = "" + joArg.value;
            // if( strURL.indexOf( "/sign-and-send" ) < 0 )
            //    strURL += "/sign-and-send";
            // strURL += "/0";
            imaState.joAccount_s_chain.strTransactionManagerURL = strURL;
            continue;
        }
        if( joArg.name == "tm-url-t-chain" ) {
            owaspUtils.verifyArgumentIsURL( joArg );
            const strURL = "" + joArg.value;
            // if( strURL.indexOf( "/sign-and-send" ) < 0 )
            //    strURL += "/sign-and-send";
            // strURL += "/0";
            imaState.joAccount_t_chain.strTransactionManagerURL = strURL;
            continue;
        }
        if( joArg.name == "tm-priority-main-net" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.joAccount_main_net.tm_priority = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "tm-priority-s-chain" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.joAccount_s_chain.tm_priority = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "tm-priority-t-chain" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.joAccount_t_chain.tm_priority = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "sgx-url-main-net" ) {
            owaspUtils.verifyArgumentIsURL( joArg );
            imaState.joAccount_main_net.strSgxURL = joArg.value;
            continue;
        }
        if( joArg.name == "sgx-url-s-chain" ) {
            owaspUtils.verifyArgumentIsURL( joArg );
            imaState.joAccount_s_chain.strSgxURL = joArg.value;
            continue;
        }
        if( joArg.name == "sgx-url-t-chain" ) {
            owaspUtils.verifyArgumentIsURL( joArg );
            imaState.joAccount_t_chain.strSgxURL = joArg.value;
            continue;
        }
        if( joArg.name == "sgx-ecdsa-key-main-net" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.joAccount_main_net.strSgxKeyName = joArg.value;
            continue;
        }
        if( joArg.name == "sgx-ecdsa-key-s-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.joAccount_s_chain.strSgxKeyName = joArg.value;
            continue;
        }
        if( joArg.name == "sgx-ecdsa-key-t-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.joAccount_t_chain.strSgxKeyName = joArg.value;
            continue;
        }
        //
        if( joArg.name == "sgx-ssl-key-main-net" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.joAccount_main_net.strPathSslKey = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "sgx-ssl-key-s-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.joAccount_s_chain.strPathSslKey = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "sgx-ssl-key-t-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.joAccount_t_chain.strPathSslKey = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "sgx-ssl-cert-main-net" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.joAccount_main_net.strPathSslCert = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "sgx-ssl-cert-s-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.joAccount_s_chain.strPathSslCert = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "sgx-ssl-cert-t-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.joAccount_t_chain.strPathSslCert = imaUtils.normalizePath( joArg.value );
            continue;
        }
        //
        //
        if( joArg.name == "address-main-net" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.joAccount_main_net.address_ = joArg.value;
            continue;
        }
        if( joArg.name == "address-s-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.joAccount_s_chain.address_ = joArg.value;
            continue;
        }
        if( joArg.name == "address-t-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.joAccount_t_chain.address_ = joArg.value;
            continue;
        }
        if( joArg.name == "receiver" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.receiver = joArg.value;
            continue;
        }
        if( joArg.name == "key-main-net" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.joAccount_main_net.privateKey = joArg.value;
            continue;
        }
        if( joArg.name == "key-s-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.joAccount_s_chain.privateKey = joArg.value;
            continue;
        }
        if( joArg.name == "key-t-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.joAccount_t_chain.privateKey = joArg.value;
            continue;
        }
        if( joArg.name == "abi-skale-manager" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathAbiJson_skale_manager = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "abi-main-net" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathAbiJson_main_net = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "abi-s-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathAbiJson_s_chain = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "abi-t-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathAbiJson_t_chain = imaUtils.normalizePath( joArg.value );
            continue;
        }
        //
        //
        if( joArg.name == "erc20-main-net" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathJsonErc20_main_net = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "erc20-s-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathJsonErc20_s_chain = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "addr-erc20-s-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strAddrErc20_explicit = joArg.value;
            continue;
        }
        if( joArg.name == "erc20-t-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathJsonErc20_t_chain = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "addr-erc20-t-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strAddrErc20_explicit_target = joArg.value;
            continue;
        }
        //
        //
        if( joArg.name == "erc721-main-net" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathJsonErc721_main_net = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "erc721-s-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathJsonErc721_s_chain = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "addr-erc721-s-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strAddrErc721_explicit = joArg.value;
            continue;
        }
        if( joArg.name == "erc721-t-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathJsonErc721_t_chain = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "addr-erc721-t-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strAddrErc721_explicit_target = joArg.value;
            continue;
        }
        //
        //
        if( joArg.name == "erc1155-main-net" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathJsonErc1155_main_net = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "erc1155-s-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathJsonErc1155_s_chain = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "addr-erc1155-s-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strAddrErc1155_explicit = joArg.value;
            continue;
        }
        if( joArg.name == "erc1155-t-chain" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathJsonErc1155_t_chain = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if( joArg.name == "addr-erc1155-t-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strAddrErc1155_explicit_target = joArg.value;
            continue;
        }
        //
        //
        if( joArg.name == "sleep-between-tx" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            IMA.setSleepBetweenTransactionsOnSChainMilliseconds( joArg.value );
            continue;
        }
        if( joArg.name == "wait-next-block" ) {
            IMA.setWaitForNextBlockOnSChain( true );
            continue;
        }
        if( joArg.name == "value" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nAmountOfWei = owaspUtils.parseMoneySpecToWei( null, "" + joArg.value, true );
            continue;
        }
        if( joArg.name == "wei" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            // imaState.nAmountOfWei = joArg.value * 1;
            imaState.nAmountOfWei = owaspUtils.parseMoneySpecToWei( null, "" + joArg.value + "wei", true );
            continue;
        }
        if( joArg.name == "babbage" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            // imaState.nAmountOfWei = joArg.value * 1000;
            imaState.nAmountOfWei = owaspUtils.parseMoneySpecToWei( null, "" + joArg.value + "babbage", true );
            continue;
        }
        if( joArg.name == "lovelace" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            // imaState.nAmountOfWei = joArg.value * 1000 * 1000;
            imaState.nAmountOfWei = owaspUtils.parseMoneySpecToWei( null, "" + joArg.value + "lovelace", true );
            continue;
        }
        if( joArg.name == "shannon" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            // imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000;
            imaState.nAmountOfWei = owaspUtils.parseMoneySpecToWei( null, "" + joArg.value + "shannon", true );
            continue;
        }
        if( joArg.name == "szabo" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            // imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000 * 1000;
            imaState.nAmountOfWei = owaspUtils.parseMoneySpecToWei( null, "" + joArg.value + "szabo", true );
            continue;
        }
        if( joArg.name == "finney" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            // imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000 * 1000 * 1000;
            imaState.nAmountOfWei = owaspUtils.parseMoneySpecToWei( null, "" + joArg.value + "finney", true );
            continue;
        }
        if( joArg.name == "ether" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            // imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000 * 1000 * 1000 * 1000;
            imaState.nAmountOfWei = owaspUtils.parseMoneySpecToWei( null, "" + joArg.value + "ether", true );
            continue;
        }
        if( joArg.name == "amount" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nAmountOfToken = joArg.value;
            continue;
        }
        if( joArg.name == "tid" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.idToken = joArg.value;
            imaState.have_idToken = true;
            continue;
        }
        if( joArg.name == "amounts" ) {
            imaState.arrAmountsOfTokens = owaspUtils.verifyArgumentIsArrayOfIntegers( joArg );
            continue;
        }
        if( joArg.name == "tids" ) {
            imaState.idTokens = owaspUtils.verifyArgumentIsArrayOfIntegers( joArg );
            imaState.have_idTokens = true;
            continue;
        }
        //
        if( joArg.name == "gas-price-multiplier-mn" ) {
            let gasPriceMultiplier = owaspUtils.toFloat( joArg.value );
            if( gasPriceMultiplier < 0.0 )
                gasPriceMultiplier = 0.0;
            imaState.tc_main_net.gasPriceMultiplier = gasPriceMultiplier;
            continue;
        }
        if( joArg.name == "gas-price-multiplier-sc" ) {
            let gasPriceMultiplier = owaspUtils.toFloat( joArg.value );
            if( gasPriceMultiplier < 0.0 )
                gasPriceMultiplier = 0.0;
            imaState.tc_s_chain.gasPriceMultiplier = gasPriceMultiplier;
            continue;
        }
        if( joArg.name == "gas-price-multiplier-tc" ) {
            let gasPriceMultiplier = owaspUtils.toFloat( joArg.value );
            if( gasPriceMultiplier < 0.0 )
                gasPriceMultiplier = 0.0;
            imaState.tc_t_chain.gasPriceMultiplier = gasPriceMultiplier;
            continue;
        }
        if( joArg.name == "gas-price-multiplier" ) {
            let gasPriceMultiplier = owaspUtils.toFloat( joArg.value );
            if( gasPriceMultiplier < 0.0 )
                gasPriceMultiplier = 0.0;
            imaState.tc_main_net.gasPriceMultiplier =
                imaState.tc_s_chain.gasPriceMultiplier =
                imaState.tc_t_chain.gasPriceMultiplier =
                gasPriceMultiplier;
            continue;
        }
        //
        if( joArg.name == "gas-multiplier-mn" ) {
            let gasMultiplier = owaspUtils.toFloat( joArg.value );
            if( gasMultiplier < 0.0 )
                gasMultiplier = 0.0;
            imaState.tc_main_net.gasMultiplier = gasMultiplier;
            continue;
        }
        if( joArg.name == "gas-multiplier-sc" ) {
            let gasMultiplier = owaspUtils.toFloat( joArg.value );
            if( gasMultiplier < 0.0 )
                gasMultiplier = 0.0;
            imaState.tc_s_chain.gasMultiplier = gasMultiplier;
            continue;
        }
        if( joArg.name == "gas-multiplier-tc" ) {
            let gasMultiplier = owaspUtils.toFloat( joArg.value );
            if( gasMultiplier < 0.0 )
                gasMultiplier = 0.0;
            imaState.tc_t_chain.gasMultiplier = gasMultiplier;
            continue;
        }
        if( joArg.name == "gas-multiplier" ) {
            let gasMultiplier = owaspUtils.toFloat( joArg.value );
            if( gasMultiplier < 0.0 )
                gasMultiplier = 0.0;
            imaState.tc_main_net.gasMultiplier =
                imaState.tc_s_chain.gasMultiplier =
                imaState.tc_t_chain.gasMultiplier =
                gasMultiplier;
            continue;
        }
        //
        if( joArg.name == "s2s-enable" ) {
            imaState.s2s_opts.isEnabled = true;
            continue;
        }
        if( joArg.name == "s2s-disable" ) {
            imaState.s2s_opts.isEnabled = false;
            continue;
        }
        if( joArg.name == "net-rediscover" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.s2s_opts.secondsToReDiscoverSkaleNetwork = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "with-metadata" ) {
            imaState.isWithMetadata721 = true;
            continue;
        }
        //
        if( joArg.name == "show-config" ) {
            imaState.bShowConfigMode = true;
            continue;
        }
        if( joArg.name == "load-node-config" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            load_node_config( joArg.value );
            continue;
        }
        if( joArg.name == "no-wait-s-chain" ) {
            imaState.bNoWaitSChainStarted = true;
            continue;
        }
        if( joArg.name == "max-wait-attempts" ) {
            imaState.nMaxWaitSChainAttempts = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "skip-dry-run" ) {
            imaState.doEnableDryRun( false );
            continue;
        }
        if( joArg.name == "ignore-dry-run" ) {
            imaState.doIgnoreDryRun( true );
            continue;
        }
        if( joArg.name == "dry-run" ) {
            imaState.doIgnoreDryRun( false );
            continue;
        }
        if( joArg.name == "m2s-transfer-block-size" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nTransferBlockSizeM2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "s2m-transfer-block-size" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nTransferBlockSizeS2M = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "s2s-transfer-block-size" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nTransferBlockSizeS2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "transfer-block-size" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nTransferBlockSizeM2S = imaState.nTransferBlockSizeS2M = imaState.nTransferBlockSizeS2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "m2s-max-transactions" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nMaxTransactionsM2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "s2m-max-transactions" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nMaxTransactionsS2M = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "s2s-max-transactions" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nMaxTransactionsS2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "max-transactions" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nMaxTransactionsM2S = imaState.nMaxTransactionsS2M = imaState.nMaxTransactionsS2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "m2s-await-blocks" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nBlockAwaitDepthM2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "s2m-await-blocks" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nBlockAwaitDepthS2M = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "s2s-await-blocks" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nBlockAwaitDepthS2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "await-blocks" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nBlockAwaitDepthM2S = imaState.nBlockAwaitDepthS2M = imaState.nBlockAwaitDepthS2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "m2s-await-time" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nBlockAgeM2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "s2m-await-time" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nBlockAgeS2M = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "s2s-await-time" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nBlockAgeS2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "await-time" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nBlockAgeM2S = imaState.nBlockAgeS2M = imaState.nBlockAgeS2S = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "period" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nLoopPeriodSeconds = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "node-number" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nNodeNumber = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "nodes-count" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nNodesCount = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "time-framing" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nTimeFrameSeconds = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "time-gap" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nNextFrameGap = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "auto-exit" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nAutoExitAfterSeconds = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "ptx" ) {
            imaState.optsPendingTxAnalysis.isEnabled = true;
            continue;
        }
        if( joArg.name == "no-ptx" ) {
            imaState.optsPendingTxAnalysis.isEnabled = false;
            continue;
        }
        if( joArg.name == "ptx-attempt" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.optsPendingTxAnalysis.nTimeoutSecondsBeforeSecondAttempt = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "ptx-ignore" ) {
            imaState.optsPendingTxAnalysis.isIgnore = true;
            continue;
        }
        if( joArg.name == "no-ptx-ignore" ) {
            imaState.optsPendingTxAnalysis.isIgnore = false;
            continue;
        }
        if( joArg.name == "ptx-ignore2" ) {
            imaState.optsPendingTxAnalysis.isIgnore2 = true;
            continue;
        }
        if( joArg.name == "no-ptx-ignore2" ) {
            imaState.optsPendingTxAnalysis.isIgnore2 = false;
            continue;
        }
        if( joArg.name == "state-file" ) {
            imaState.optsStateFile.isEnabled = true;
            imaState.optsStateFile.path = joArg.value;
            continue;
        }
        if( joArg.name == "log-size" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nLogMaxSizeBeforeRotation = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "log-files" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nLogMaxFilesCount = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "gathered" ) {
            imaState.isPrintGathered = true;
            continue;
        }
        if( joArg.name == "no-gathered" ) {
            imaState.isPrintGathered = false;
            continue;
        }
        if( joArg.name == "expose-security-info" ) {
            imaState.isPrintSecurityValues = true;
            continue;
        }
        if( joArg.name == "no-expose-security-info" ) {
            imaState.isPrintSecurityValues = false;
            continue;
        }
        if( joArg.name == "log" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strLogFilePath = "" + joArg.value;
            continue;
        }
        if( joArg.name == "sign-messages" ) {
            imaState.bSignMessages = true;
            continue;
        }
        if( joArg.name == "bls-glue" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathBlsGlue = "" + joArg.value;
            continue;
        }
        if( joArg.name == "hash-g1" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathHashG1 = "" + joArg.value;
            continue;
        }
        if( joArg.name == "bls-verify" ) {
            owaspUtils.verifyArgumentIsPathToExistingFile( joArg );
            imaState.strPathBlsVerify = "" + joArg.value;
            continue;
        }
        if( joArg.name == "monitoring-port" ) {
            owaspUtils.verifyArgumentIsIntegerIpPortNumber( joArg, true );
            imaState.nMonitoringPort = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "reimbursement-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strReimbursementChain = joArg.value.trim();
            continue;
        }
        if( joArg.name == "reimbursement-recharge" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nReimbursementRecharge = owaspUtils.parseMoneySpecToWei( null, "" + joArg.value, true );
            continue;
        }
        if( joArg.name == "reimbursement-withdraw" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nReimbursementWithdraw = owaspUtils.parseMoneySpecToWei( null, "" + joArg.value, true );
            continue;
        }
        if( joArg.name == "reimbursement-balance" ) {
            imaState.isShowReimbursementBalance = true;
            continue;
        }
        if( joArg.name == "reimbursement-estimate" ) {
            imaState.nReimbursementEstimate = true;
            continue;
        }
        if( joArg.name == "reimbursement-range" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nReimbursementRange = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "bs-step-size" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            IMA.setBlocksCountInInIterativeStepOfEventsScan( owaspUtils.toInteger( joArg.value ) );
            continue;
        }
        if( joArg.name == "bs-max-all-range" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            IMA.setMaxIterationsInAllRangeEventsScan( owaspUtils.toInteger( joArg.value ) );
            continue;
        }
        if( joArg.name == "bs-progressive-enable" ) {
            IMA.setEnabledProgressiveEventsScan( true );
            continue;
        }
        if( joArg.name == "bs-progressive-disable" ) {
            IMA.setEnabledProgressiveEventsScan( false );
            continue;
        }
        if( joArg.name == "ogp-mode" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            IMA.setOracleGasPriceMode( owaspUtils.toInteger( joArg.value ) );
            continue;
        }
        if( joArg.name == "s2s-forward" ) {
            IMA.setForwardS2S();
            continue;
        }
        if( joArg.name == "s2s-reverse" ) {
            IMA.setReverseS2S();
            continue;
        }
        if( joArg.name == "register" ||
            joArg.name == "register1" ||
            joArg.name == "check-registration" ||
            joArg.name == "check-registration1" ||
            joArg.name == "check-registration2" ||
            joArg.name == "check-registration3" ||
            joArg.name == "mint-erc20" ||
            joArg.name == "mint-erc721" ||
            joArg.name == "mint-erc1155" ||
            joArg.name == "burn-erc20" ||
            joArg.name == "burn-erc721" ||
            joArg.name == "burn-erc1155" ||
            joArg.name == "show-balance" ||
            joArg.name == "m2s-payment" ||
            joArg.name == "s2m-payment" ||
            joArg.name == "s2m-receive" ||
            joArg.name == "s2m-view" ||
            joArg.name == "s2s-payment" |
            joArg.name == "m2s-transfer" ||
            joArg.name == "s2m-transfer" ||
            joArg.name == "s2s-transfer" ||
            joArg.name == "transfer" ||
            joArg.name == "loop" ||
            joArg.name == "browse-s-chain" ||
            joArg.name == "browse-skale-network" ||
            joArg.name == "browse-connected-schains" ||
            joArg.name == "discover-cid"
        ) {
            joExternalHandlers[joArg.name]();
            continue;
        }
        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " unknown command line argument " ) + cc.info( joArg.name ) );
        return 666;
    }
    return 0;
}

function getWeb3FromURL( strURL, log ) {
    let w3 = null;
    log = log || { write: console.log };
    try {
        const u = cc.safeURL( strURL );
        const strProtocol = u.protocol.trim().toLowerCase().replace( ":", "" ).replace( "/", "" );
        if( strProtocol == "ws" || strProtocol == "wss" ) {
            const w3ws = new w3mod.providers.WebsocketProvider( strURL, {
                // see: https://github.com/ChainSafe/web3.js/tree/1.x/packages/web3-providers-ws#usage
                clientConfig: {
                    // // if requests are large:
                    // maxReceivedFrameSize: 100000000,   // bytes - default: 1MiB
                    // maxReceivedMessageSize: 100000000, // bytes - default: 8MiB
                    // keep a connection alive
                    keepalive: true,
                    keepaliveInterval: 200000 // ms
                },
                reconnect: { // enable auto reconnection
                    auto: true,
                    delay: 5000, // ms
                    maxAttempts: 10000000, // 10 million times
                    onTimeout: false
                }
            } );
            w3 = new w3mod( w3ws );
        } else {
            const w3http = new w3mod.providers.HttpProvider( strURL );
            w3 = new w3mod( w3http );
        }
    } catch ( err ) {
        log.write( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Failed to create " ) +
            cc.attention( "Web3" ) + cc.error( " connection to " ) + cc.info( strURL ) +
            cc.error( ": " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n" );
        w3 = null;
    }
    return w3;
}

async function async_check_url_at_startup( u, name ) {
    const details = log.createMemoryStream( true );
    const nTimeoutMilliseconds = 10 * 1000;
    try {
        details.write( cc.debug( "Will check URL " ) + cc.u( u ) + cc.debug( " connectivity for " ) + cc.info( name ) + cc.debug( " at start-up..." ) + "\n" );
        const isLog = false;
        const isOnLine = await rpcCall.check_url( u, nTimeoutMilliseconds, isLog );
        if( isOnLine )
            details.write( cc.success( "Done, start-up checking URL " ) + cc.u( u ) + cc.success( " connectivity for " ) + cc.info( name ) + cc.success( ", URL is on-line." ) + "\n" );
        else
            details.write( cc.error( "Done, start-up checking URL " ) + cc.u( u ) + cc.error( " connectivity for " ) + cc.info( name ) + cc.error( ", URL is off-line." ) + "\n" );
        return isOnLine;
    } catch ( err ) {
        details.write(
            cc.fatal( "ERROR:" ) + cc.error( " Failed to check URL " ) +
            cc.u( u ) + cc.error( " connectivity for " ) + cc.info( name ) + cc.error( " at start-up, error is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) +
            "\n" );
    }
    // details.exposeDetailsTo( log, "async_check_url_at_startup( \"" + u + "\", \"" + name + "\" )", true );
    // details.close();
    return false;
}

function ima_common_init() {
    const isPrintGathered = imaState.isPrintGathered ? true : false;
    if( isPrintGathered ) {
        log.write( cc.debug( "This process " ) + cc.sunny( "PID" ) + cc.debug( " is " ) + cc.bright( process.pid ) + "\n" );
        log.write( cc.debug( "This process " ) + cc.sunny( "PPID" ) + cc.debug( " is " ) + cc.bright( process.ppid ) + "\n" );
        log.write( cc.debug( "This process " ) + cc.sunny( "EGID" ) + cc.debug( " is " ) + cc.bright( process.getegid() ) + "\n" );
        log.write( cc.debug( "This process " ) + cc.sunny( "EUID" ) + cc.debug( " is " ) + cc.bright( process.geteuid() ) + "\n" );
        log.write( cc.debug( "This process " ) + cc.sunny( "GID" ) + cc.debug( " is " ) + cc.bright( process.getgid() ) + "\n" );
        log.write( cc.debug( "This process " ) + cc.sunny( "UID" ) + cc.debug( " is " ) + cc.bright( process.getuid() ) + "\n" );
        log.write( cc.debug( "This process " ) + cc.sunny( "groups" ) + cc.debug( " are " ) + cc.j( process.getgroups() ) + "\n" );
        log.write( cc.debug( "This process " ) + cc.sunny( "CWD" ) + cc.debug( " is " ) + cc.bright( process.cwd() ) + "\n" );
        log.write( cc.debug( "This process " ) + cc.sunny( "platform" ) + cc.debug( " is " ) + cc.bright( process.platform ) + "\n" );
        log.write( cc.debug( "This process " ) + cc.sunny( "release" ) + cc.debug( " is " ) + cc.j( process.release ) + "\n" );
        log.write( cc.debug( "This process " ) + cc.sunny( "report" ) + cc.debug( " is " ) + cc.j( process.report ) + "\n" );
        log.write( cc.debug( "This process " ) + cc.sunny( "config" ) + cc.debug( " is " ) + cc.j( process.config ) + "\n" );
        log.write( cc.sunny( "Node JS" ) + " " + cc.bright( "detailed version information" ) + cc.debug( " is " ) + cc.j( process.versions ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "type" ) + cc.debug( " is " ) + cc.bright( os.type() ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "platform" ) + cc.debug( " is " ) + cc.bright( os.platform() ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "release" ) + cc.debug( " is " ) + cc.bright( os.release() ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "architecture" ) + cc.debug( " is " ) + cc.bright( os.arch() ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "endianness" ) + cc.debug( " is " ) + cc.bright( os.endianness() ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "host name" ) + cc.debug( " is " ) + cc.bright( os.hostname() ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "CPUs" ) + cc.debug( " are " ) + cc.j( os.cpus() ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "network interfaces" ) + cc.debug( " are " ) + cc.j( os.networkInterfaces() ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "home dir" ) + cc.debug( " is " ) + cc.bright( os.homedir() ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "tmp dir" ) + cc.debug( " is " ) + cc.bright( os.tmpdir() ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "uptime" ) + cc.debug( " is " ) + cc.bright( os.uptime() ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "user" ) + cc.debug( " is " ) + cc.j( os.userInfo() ) + "\n" );
        const joMemory = { total: os.totalmem(), free: os.freemem() };
        joMemory.freePercent = ( joMemory.free / joMemory.total ) * 100.0;
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "memory" ) + cc.debug( " is " ) + cc.j( joMemory ) + "\n" );
        log.write( cc.sunny( "OS" ) + " " + cc.bright( "average load" ) + cc.debug( " is " ) + cc.j( os.loadavg() ) + "\n" );
    } // if( isPrintGathered )

    let n1 = 0;
    let n2 = 0;
    if( imaState.strPathAbiJson_skale_manager && ( typeof imaState.strPathAbiJson_skale_manager == "string" ) && imaState.strPathAbiJson_skale_manager.length > 0 ) {
        imaState.joAbiPublishResult_skale_manager = imaUtils.jsonFileLoad( imaState.strPathAbiJson_skale_manager, null );
        imaState.bHaveSkaleManagerABI = true;
    } else {
        imaState.bHaveSkaleManagerABI = false;
        log.write(
            cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "Skale Manager" ) +
            cc.warning( " ABI file path is provided in command line arguments" ) +
            cc.debug( "(needed for particular operations only)" ) +
            "\n" );
    }
    //
    if( imaState.strPathAbiJson_main_net && typeof imaState.strPathAbiJson_main_net == "string" && imaState.strPathAbiJson_main_net.length > 0 ) {
        imaState.joAbiPublishResult_main_net = imaUtils.jsonFileLoad( imaState.strPathAbiJson_main_net, null );
        imaState.bHaveImaAbiMainNet = true;
    } else {
        imaState.bHaveImaAbiMainNet = false;
        log.write(
            cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "Main-net" ) +
            cc.warning( " IMA ABI file path is provided in command line arguments" ) +
            cc.debug( "(needed for particular operations only)" ) +
            "\n" );
    }
    //
    if( imaState.strPathAbiJson_s_chain && typeof imaState.strPathAbiJson_s_chain == "string" && imaState.strPathAbiJson_s_chain.length > 0 ) {
        imaState.joAbiPublishResult_s_chain = imaUtils.jsonFileLoad( imaState.strPathAbiJson_s_chain, null );
        imaState.bHaveImaAbiSchain = true;
    } else {
        imaState.bHaveImaAbiSchain = false;
        log.write(
            cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "S-Chain" ) +
            cc.warning( " IMA ABI file path is provided in command line arguments" ) +
            cc.debug( "(needed for particular operations only)" ) +
            "\n" );
    }
    //
    if( imaState.strPathAbiJson_t_chain && typeof imaState.strPathAbiJson_t_chain == "string" && imaState.strPathAbiJson_t_chain.length > 0 ) {
        imaState.joAbiPublishResult_t_chain = imaUtils.jsonFileLoad( imaState.strPathAbiJson_t_chain, null );
        imaState.bHaveImaAbiSchainTarget = true;
    } else {
        imaState.bHaveImaAbiSchainTarget = false;
        log.write(
            cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "S<->S Target S-Chain" ) +
            cc.warning( " IMA ABI file path is provided in command line arguments" ) +
            cc.debug( "(needed for particular operations only)" ) +
            "\n" );
    }
    //

    if( imaState.bHaveSkaleManagerABI ) {
        imaUtils.check_keys_exist_in_abi( "skale-manager", imaState.strPathAbiJson_skale_manager, imaState.joAbiPublishResult_skale_manager, [
            // partial list of Skale Manager's contracts specified here:
            "constants_holder_abi",
            "constants_holder_address",
            "nodes_abi",
            "nodes_address",
            "key_storage_abi",
            "key_storage_address",
            "schains_abi",
            "schains_address",
            "schains_internal_abi",
            "schains_internal_address",
            "skale_d_k_g_abi",
            "skale_d_k_g_address",
            "skale_manager_abi",
            "skale_manager_address",
            "skale_token_abi",
            "skale_token_address",
            "validator_service_abi",
            "validator_service_address",
            "wallets_abi",
            "wallets_address"
        ] );
    } else if( imaState.s2s_opts.isEnabled )
        log.write( cc.error( "WARNING:" ) + cc.warning( " Missing " ) + cc.note( "Skale Manager" ) + cc.warning( " ABI path for " ) + cc.note( "S-Chain" ) + cc.warning( " to " ) + cc.note( "S-Chain" ) + cc.warning( " transfers" ) + "\n" );
        // process.exit( 126 );

    if( imaState.bHaveImaAbiMainNet ) {
        imaUtils.check_keys_exist_in_abi( "main-net", imaState.strPathAbiJson_main_net, imaState.joAbiPublishResult_main_net, [
            "deposit_box_eth_abi",
            "deposit_box_eth_address",
            "message_proxy_mainnet_abi",
            "message_proxy_mainnet_address",
            "linker_abi",
            "linker_address",
            "deposit_box_erc20_abi",
            "deposit_box_erc20_address",
            "deposit_box_erc721_abi",
            "deposit_box_erc721_address",
            "deposit_box_erc1155_abi",
            "deposit_box_erc1155_address",
            "deposit_box_erc721_with_metadata_abi",
            "deposit_box_erc721_with_metadata_address",
            "community_pool_abi",
            "community_pool_address"
        ] );
    }
    if( imaState.bHaveImaAbiSchain ) {
        imaUtils.check_keys_exist_in_abi( "S-Chain", imaState.strPathAbiJson_s_chain, imaState.joAbiPublishResult_s_chain, [
            "token_manager_eth_abi",
            "token_manager_eth_address",
            "token_manager_erc20_abi",
            "token_manager_erc20_address",
            "token_manager_erc721_abi",
            "token_manager_erc721_address",
            "token_manager_erc1155_abi",
            "token_manager_erc1155_address",
            "token_manager_erc721_with_metadata_abi",
            "token_manager_erc721_with_metadata_address",
            "message_proxy_chain_abi",
            "message_proxy_chain_address",
            "token_manager_linker_abi",
            "token_manager_linker_address",
            "community_locker_abi",
            "community_locker_address"
        ] );
    }
    if( imaState.bHaveImaAbiSchainTarget ) {
        imaUtils.check_keys_exist_in_abi( "S<->S Target S-Chain", imaState.strPathAbiJson_t_chain, imaState.joAbiPublishResult_t_chain, [
            "token_manager_eth_abi",
            "token_manager_eth_address",
            "token_manager_erc20_abi",
            "token_manager_erc20_address",
            "token_manager_erc721_abi",
            "token_manager_erc721_address",
            "token_manager_erc1155_abi",
            "token_manager_erc1155_address",
            "token_manager_erc721_with_metadata_abi",
            "token_manager_erc721_with_metadata_address",
            "message_proxy_chain_abi",
            "message_proxy_chain_address",
            "token_manager_linker_abi",
            "token_manager_linker_address",
            "community_locker_abi",
            "community_locker_address"
        ] );
    }

    // deposit_box_eth_address                    --> deposit_box_eth_abi
    // deposit_box_erc20_address                  --> deposit_box_erc20_abi
    // deposit_box_erc721_address                 --> deposit_box_erc721_abi
    // deposit_box_erc1155_address                --> deposit_box_erc1155_abi
    // deposit_box_erc721_with_metadata_address   --> deposit_box_erc721_with_metadata_abi
    // linker_address                             --> linker_abi
    // token_manager_eth_address                  --> token_manager_eth_abi
    // token_manager_erc20_address                --> token_manager_erc20_abi
    // token_manager_erc721_address               --> token_manager_erc721_abi
    // token_manager_erc1155_address              --> token_manager_erc1155_abi
    // token_manager_erc721_with_metadata_address --> token_manager_erc721_with_metadata_abi
    // token_manager_linker_address               --> token_manager_linker_abi
    // message_proxy_mainnet_address              --> message_proxy_mainnet_abi
    // message_proxy_chain_address                --> message_proxy_chain_abi

    //
    if( imaState.strURL_main_net && typeof imaState.strURL_main_net == "string" && imaState.strURL_main_net.length > 0 ) {
        const u = imaState.strURL_main_net;
        async_check_url_at_startup( u, "Main-net" );
        imaState.w3_main_net = getWeb3FromURL( u, log );
    } else {
        log.write(
            cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "Main-net" ) +
            cc.warning( " URL specified in command line arguments" ) +
            cc.debug( "(needed for particular operations only)" ) +
            "\n" );
    }
    //
    if( imaState.strURL_s_chain && typeof imaState.strURL_s_chain == "string" && imaState.strURL_s_chain.length > 0 ) {
        const u = imaState.strURL_s_chain;
        async_check_url_at_startup( u, "S-Chain" );
        imaState.w3_s_chain = getWeb3FromURL( u, log );
    } else {
        log.write(
            cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "S-Chain" ) +
            cc.warning( " URL specified in command line arguments" ) +
            cc.debug( "(needed for particular operations only)" ) +
            "\n" );
    }
    //
    if( imaState.strURL_t_chain && typeof imaState.strURL_t_chain == "string" && imaState.strURL_t_chain.length > 0 ) {
        const u = imaState.strURL_t_chain;
        async_check_url_at_startup( u, "S<->S Target S-Chain" );
        imaState.w3_t_chain = getWeb3FromURL( u, log );
    } else {
        log.write(
            cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "S<->S Target S-Chain" ) +
            cc.warning( " URL specified in command line arguments" ) +
            cc.debug( "(needed for particular operations only)" ) +
            "\n" );
    }
    //
    if( imaState.bHaveImaAbiMainNet ) {
        imaState.jo_deposit_box_eth = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_main_net.deposit_box_eth_abi, imaState.joAbiPublishResult_main_net.deposit_box_eth_address ); // only main net
        imaState.jo_deposit_box_erc20 = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_main_net.deposit_box_erc20_abi, imaState.joAbiPublishResult_main_net.deposit_box_erc20_address ); // only main net
        imaState.jo_deposit_box_erc721 = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_main_net.deposit_box_erc721_abi, imaState.joAbiPublishResult_main_net.deposit_box_erc721_address ); // only main net
        imaState.jo_deposit_box_erc1155 = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_main_net.deposit_box_erc1155_abi, imaState.joAbiPublishResult_main_net.deposit_box_erc1155_address ); // only main net
        imaState.jo_deposit_box_erc721_with_metadata = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_main_net.deposit_box_erc721_with_metadata_abi, imaState.joAbiPublishResult_main_net.deposit_box_erc721_with_metadata_address ); // only main net
        imaState.jo_community_pool = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_main_net.community_pool_abi, imaState.joAbiPublishResult_main_net.community_pool_address ); // only main net
        imaState.jo_linker = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_main_net.linker_abi, imaState.joAbiPublishResult_main_net.linker_address ); // only main net
        imaState.jo_message_proxy_main_net = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_main_net.message_proxy_mainnet_abi, imaState.joAbiPublishResult_main_net.message_proxy_mainnet_address );
    }
    if( imaState.bHaveImaAbiSchain ) {
        imaState.jo_token_manager_eth = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_s_chain.token_manager_eth_abi, imaState.joAbiPublishResult_s_chain.token_manager_eth_address ); // only s-chain
        imaState.jo_token_manager_erc20 = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_s_chain.token_manager_erc20_abi, imaState.joAbiPublishResult_s_chain.token_manager_erc20_address ); // only s-chain
        imaState.jo_token_manager_erc721 = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_s_chain.token_manager_erc721_abi, imaState.joAbiPublishResult_s_chain.token_manager_erc721_address ); // only s-chain
        imaState.jo_token_manager_erc1155 = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_s_chain.token_manager_erc1155_abi, imaState.joAbiPublishResult_s_chain.token_manager_erc1155_address ); // only s-chain
        imaState.jo_token_manager_erc721_with_metadata = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_s_chain.token_manager_erc721_with_metadata_abi, imaState.joAbiPublishResult_s_chain.token_manager_erc721_with_metadata_address ); // only s-chain
        imaState.jo_community_locker = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_s_chain.community_locker_abi, imaState.joAbiPublishResult_s_chain.community_locker_address ); // only s-chain
        imaState.jo_message_proxy_s_chain = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_s_chain.message_proxy_chain_abi, imaState.joAbiPublishResult_s_chain.message_proxy_chain_address );
        imaState.jo_token_manager_linker = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_s_chain.token_manager_linker_abi, imaState.joAbiPublishResult_s_chain.token_manager_linker_address );
        imaState.eth_erc20 = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_s_chain.eth_erc20_abi, imaState.joAbiPublishResult_s_chain.eth_erc20_address ); // only s-chain
        // imaState.eth_erc721 = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_s_chain.eth_erc721_abi, imaState.joAbiPublishResult_s_chain.eth_erc721_address ); // only s-chain
        // imaState.eth_erc1155 = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_s_chain.eth_erc1155_abi, imaState.joAbiPublishResult_s_chain.eth_erc721_address ); // only s-chain
    }
    if( imaState.bHaveImaAbiSchainTarget ) {
        // imaState.jo_token_manager_eth_target = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_t_chain.token_manager_eth_abi, imaState.joAbiPublishResult_t_chain.token_manager_eth_address ); // only s-chain
        imaState.jo_token_manager_erc20_target = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_t_chain.token_manager_erc20_abi, imaState.joAbiPublishResult_t_chain.token_manager_erc20_address ); // only s-chain
        imaState.jo_token_manager_erc721_target = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_t_chain.token_manager_erc721_abi, imaState.joAbiPublishResult_t_chain.token_manager_erc721_address ); // only s-chain
        imaState.jo_token_manager_erc1155_target = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_t_chain.token_manager_erc1155_abi, imaState.joAbiPublishResult_t_chain.token_manager_erc1155_address ); // only s-chain
        imaState.jo_token_manager_erc721_with_metadata_target = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_t_chain.token_manager_erc721_with_metadata_abi, imaState.joAbiPublishResult_t_chain.token_manager_erc721_with_metadata_address ); // only s-chain
        imaState.jo_community_locker_target = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_t_chain.community_locker_abi, imaState.joAbiPublishResult_t_chain.community_locker_address ); // only s-chain
        imaState.jo_message_proxy_s_chain_target = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_t_chain.message_proxy_chain_abi, imaState.joAbiPublishResult_t_chain.message_proxy_chain_address );
        imaState.jo_token_manager_linker_target = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_t_chain.token_manager_linker_abi, imaState.joAbiPublishResult_t_chain.token_manager_linker_address );
        imaState.eth_erc20_target = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_t_chain.eth_erc20_abi, imaState.joAbiPublishResult_t_chain.eth_erc20_address ); // only s-chain
        // imaState.eth_erc721_target = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_t_chain.eth_erc721_abi, imaState.joAbiPublishResult_t_chain.eth_erc721_address ); // only s-chain
        // imaState.eth_erc1155_target = new imaState.w3_s_chain.eth.Contract( imaState.joAbiPublishResult_t_chain.eth_erc1155_abi, imaState.joAbiPublishResult_t_chain.eth_erc721_address ); // only s-chain
    }
    if( imaState.bHaveSkaleManagerABI ) {
        imaState.jo_constants_holder = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_skale_manager.constants_holder_abi, imaState.joAbiPublishResult_skale_manager.constants_holder_address );
        // jo_contract_manager
        // jo_decryption
        // jo_delegation_controller
        // jo_delegation_period_manager
        // jo_distributor
        // jo_ecdh
        // jo_manager_data
        // jo_monitors_functionality
        imaState.jo_nodes = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_skale_manager.nodes_abi, imaState.joAbiPublishResult_skale_manager.nodes_address );
        // jo_pricing
        // jo_punisher
        imaState.jo_key_storage = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_skale_manager.key_storage_abi, imaState.joAbiPublishResult_skale_manager.key_storage_address );
        imaState.jo_schains = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_skale_manager.schains_abi, imaState.joAbiPublishResult_skale_manager.schains_address );
        imaState.jo_schains_internal = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_skale_manager.schains_internal_abi, imaState.joAbiPublishResult_skale_manager.schains_internal_address );
        // jo_schains_functionality
        // jo_schains_functionality_internal
        imaState.jo_skale_dkg = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_skale_manager.skale_d_k_g_abi, imaState.joAbiPublishResult_skale_manager.skale_d_k_g_address );
        imaState.jo_skale_manager = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_skale_manager.skale_manager_abi, imaState.joAbiPublishResult_skale_manager.skale_manager_address );
        imaState.jo_skale_token = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_skale_manager.skale_token_abi, imaState.joAbiPublishResult_skale_manager.skale_token_address );
        // jo_skale_verifier
        // jo_slashing_table
        // jo_time_helpers
        // jo_time_helpers_with_debug
        // jo_token_state
        imaState.jo_validator_service = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_skale_manager.validator_service_abi, imaState.joAbiPublishResult_skale_manager.validator_service_address );
        imaState.jo_wallets = new imaState.w3_main_net.eth.Contract( imaState.joAbiPublishResult_skale_manager.wallets_abi, imaState.joAbiPublishResult_skale_manager.wallets_address );
    } // if( imaState.bHaveSkaleManagerABI )

    const oct = function( joContract ) { // optional contract address
        if( joContract && "options" in joContract && "address" in joContract.options )
            return cc.bright( joContract.options.address );
        return cc.error( "contract is not available" );
    };

    if( isPrintGathered ) {
        log.write( cc.bright( "IMA contracts(Main Net):" ) + "\n" );
        log.write( cc.sunny( "DepositBoxEth" ) + cc.debug( "...................address is....." ) + oct( imaState.jo_deposit_box_eth ) + "\n" );
        log.write( cc.sunny( "DepositBoxERC20" ) + cc.debug( ".................address is....." ) + oct( imaState.jo_deposit_box_erc20 ) + "\n" );
        log.write( cc.sunny( "DepositBoxERC721" ) + cc.debug( "................address is....." ) + oct( imaState.jo_deposit_box_erc721 ) + "\n" );
        log.write( cc.sunny( "DepositBoxERC1155" ) + cc.debug( "...............address is....." ) + oct( imaState.jo_deposit_box_erc1155 ) + "\n" );
        log.write( cc.sunny( "DepositBoxERC721WithMetadata" ) + cc.debug( "....address is....." ) + oct( imaState.jo_deposit_box_erc721_with_metadata ) + "\n" );
        log.write( cc.sunny( "CommunityPool" ) + cc.debug( "...................address is....." ) + oct( imaState.jo_community_pool ) + "\n" );
        log.write( cc.sunny( "MessageProxy" ) + cc.debug( "....................address is....." ) + oct( imaState.jo_message_proxy_main_net ) + "\n" );
        log.write( cc.sunny( "Linker" ) + cc.debug( "..........................address is....." ) + oct( imaState.jo_linker ) + "\n" );
        log.write( cc.bright( "IMA contracts(S-Chain):" ) + "\n" );
        log.write( cc.sunny( "TokenManagerEth" ) + cc.debug( ".................address is....." ) + oct( imaState.jo_token_manager_eth ) + "\n" );
        log.write( cc.sunny( "TokenManagerERC20" ) + cc.debug( "...............address is....." ) + oct( imaState.jo_token_manager_erc20 ) + "\n" );
        log.write( cc.sunny( "TokenManagerERC721" ) + cc.debug( "..............address is....." ) + oct( imaState.jo_token_manager_erc721 ) + "\n" );
        log.write( cc.sunny( "TokenManagerERC1155" ) + cc.debug( ".............address is....." ) + oct( imaState.jo_token_manager_erc1155 ) + "\n" );
        log.write( cc.sunny( "TokenManagerERC721WithMetadata" ) + cc.debug( "..address is....." ) + oct( imaState.jo_token_manager_erc721_with_metadata ) + "\n" );
        log.write( cc.sunny( "CommunityLocker" ) + cc.debug( ".................address is....." ) + oct( imaState.jo_community_locker ) + "\n" );
        log.write( cc.sunny( "MessageProxy" ) + cc.debug( "....................address is....." ) + oct( imaState.jo_message_proxy_s_chain ) + "\n" );
        log.write( cc.sunny( "TokenManagerLinker" ) + cc.debug( "..............address is....." ) + oct( imaState.jo_token_manager_linker ) + "\n" );
        log.write( cc.sunny( "ERC20" ) + cc.debug( " ..........................address is....." ) + oct( imaState.eth_erc20 ) + "\n" );
        // log.write( "S-Chain  " ) + cc.sunny( "ERC721" ) + cc.debug( " ......................address is....." ) + oct( imaState.eth_erc721 ) + "\n" );
        // log.write( "S-Chain  " ) + cc.sunny( "ERC1155" ) + cc.debug( " .....................address is....." ) + oct( imaState.eth_erc1155 ) + "\n" );
        log.write( cc.bright( "IMA contracts(Target S-Chain):" ) + "\n" );
        // log.write( "S-Chain  " ) + cc.sunny( "TokenManagerEth" ) + cc.debug( "..............address is....." ) + oct( imaState.jo_token_manager_eth_target ) + "\n" );
        log.write( cc.sunny( "TokenManagerERC20" ) + cc.debug( "...............address is....." ) + oct( imaState.jo_token_manager_erc20_target ) + "\n" );
        log.write( cc.sunny( "TokenManagerERC721" ) + cc.debug( "..............address is....." ) + oct( imaState.jo_token_manager_erc721_target ) + "\n" );
        log.write( cc.sunny( "TokenManagerERC1155" ) + cc.debug( ".............address is....." ) + oct( imaState.jo_token_manager_erc1155_target ) + "\n" );
        log.write( cc.sunny( "TokenManagerERC721WithMetadata" ) + cc.debug( "..address is....." ) + oct( imaState.jo_token_manager_erc721_with_metadata_target ) + "\n" );
        log.write( cc.sunny( "CommunityLocker" ) + cc.debug( ".................address is....." ) + oct( imaState.jo_community_locker_target ) + "\n" );
        log.write( cc.sunny( "MessageProxy" ) + cc.debug( "....................address is....." ) + oct( imaState.jo_message_proxy_s_chain_target ) + "\n" );
        log.write( cc.sunny( "TokenManagerLinker" ) + cc.debug( "..............address is....." ) + oct( imaState.jo_token_manager_linker_target ) + "\n" );
        log.write( cc.sunny( "ERC20" ) + cc.debug( " ..........................address is....." ) + oct( imaState.eth_erc20_target ) + "\n" );
        // log.write( "S-Chain  " ) + cc.sunny( "ERC721" ) + cc.debug( " ......................address is....." ) + oct( imaState.eth_erc721_target ) + "\n" );
        // log.write( "S-Chain  " ) + cc.sunny( "ERC1155" ) + cc.debug( " .....................address is....." ) + oct( imaState.eth_erc1155_target ) + "\n" );

        // if( imaState.bHaveSkaleManagerABI ) {
        log.write( cc.bright( "Skale Manager contracts:" ) + "\n" );
        log.write( cc.sunny( "ConstantsHolder" ) + cc.debug( ".................address is....." ) + oct( imaState.jo_constants_holder ) + "\n" );
        log.write( cc.sunny( "Nodes" ) + cc.debug( "...........................address is....." ) + oct( imaState.jo_nodes ) + "\n" );
        log.write( cc.sunny( "KeyStorage" ) + cc.debug( "......................address is....." ) + oct( imaState.jo_key_storage ) + "\n" );
        log.write( cc.sunny( "Schains" ) + cc.debug( ".........................address is....." ) + oct( imaState.jo_schains ) + "\n" );
        log.write( cc.sunny( "SchainsInternal" ) + cc.debug( ".................address is....." ) + oct( imaState.jo_schains_internal ) + "\n" );
        log.write( cc.sunny( "SkaleDKG" ) + cc.debug( "........................address is....." ) + oct( imaState.jo_skale_dkg ) + "\n" );
        log.write( cc.sunny( "SkaleManager" ) + cc.debug( "....................address is....." ) + oct( imaState.jo_skale_manager ) + "\n" );
        log.write( cc.sunny( "SkaleToken" ) + cc.debug( "......................address is....." ) + oct( imaState.jo_skale_token ) + "\n" );
        log.write( cc.sunny( "ValidatorService" ) + cc.debug( "................address is....." ) + oct( imaState.jo_validator_service ) + "\n" );
        log.write( cc.sunny( "Wallets" ) + cc.debug( ".........................address is....." ) + oct( imaState.jo_wallets ) + "\n" );
        // } else
        //     log.write( cc.error( "WARNING:" ) + " " + cc.warning( "no Skale Manager contracts to list, Skale Manager ABI was not provided" ) + "\n" );
    } // if( isPrintGathered )

    //
    //
    //
    if( imaState.strPathJsonErc20_main_net.length > 0 /* && imaState.strPathJsonErc20_s_chain.length > 0 */ ) {
        n1 = 0;
        n2 = 0;
        if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading Main-net ERC20 ABI from " ) + cc.info( imaState.strPathJsonErc20_main_net ) + "\n" );
        imaState.joErc20_main_net = imaUtils.jsonFileLoad( imaState.strPathJsonErc20_main_net, null );
        n1 = Object.keys( imaState.joErc20_main_net ).length;
        if( imaState.strPathJsonErc20_s_chain.length > 0 ) {
            if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC20 ABI from " ) + cc.info( imaState.strPathJsonErc20_s_chain ) + "\n" );
            imaState.joErc20_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc20_s_chain, null );
            n2 = Object.keys( imaState.joErc20_s_chain ).length;
        }
        if( n1 > 0 /* && n2 > 0 */ ) {
            imaState.strCoinNameErc20_main_net = imaUtils.discover_in_json_coin_name( imaState.joErc20_main_net );
            if( n2 > 0 )
                imaState.strCoinNameErc20_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc20_s_chain );
            n1 = imaState.strCoinNameErc20_main_net.length;
            if( n2 > 0 )
                n2 = imaState.strCoinNameErc20_s_chain.length;
            if( n1 > 0 /* && n2 > 0 */ ) {
                if( isPrintGathered && IMA.verbose_get() >= IMA.RV_VERBOSE.information && ( !imaState.bShowConfigMode ) ) {
                    if( isPrintGathered )
                        log.write( cc.info( "Loaded Main-net ERC20 ABI " ) + cc.attention( imaState.strCoinNameErc20_main_net ) + "\n" );
                    if( isPrintGathered && n2 > 0 )
                        log.write( cc.info( "Loaded S-Chain ERC20 ABI " ) + cc.attention( imaState.strCoinNameErc20_s_chain ) + "\n" );
                }
            } else {
                if( n1 === 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                if( n2 === 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc20_main_net = null;
                imaState.joErc20_s_chain = null;
                imaState.strCoinNameErc20_main_net = "";
                imaState.strCoinNameErc20_s_chain = "";
                process.exit( 126 );
            }
        } else {
            if( n1 === 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC20 JSON is invalid" ) + "\n" );
            if( n2 === 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC20 JSON is invalid" ) + "\n" );
            imaState.joErc20_main_net = null;
            imaState.joErc20_s_chain = null;
            imaState.strCoinNameErc20_main_net = "";
            imaState.strCoinNameErc20_s_chain = "";
            process.exit( 126 );
        }
    } else { // if( imaState.strPathJsonErc20_main_net.length > 0 /*&& imaState.strPathJsonErc20_s_chain.length > 0*/ )
        if( imaState.strPathJsonErc20_s_chain.length > 0 ) {
            n1 = 0;
            n2 = 0;
            if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC20 ABI from " ) + cc.info( imaState.strPathJsonErc20_s_chain ) + "\n" );
            imaState.joErc20_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc20_s_chain, null );
            n2 = Object.keys( imaState.joErc20_s_chain ).length;
            if( n2 > 0 ) {
                imaState.strCoinNameErc20_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc20_s_chain );
                n2 = imaState.strCoinNameErc20_s_chain.length;
                if( n2 > 0 ) {
                    if( isPrintGathered )
                        log.write( cc.info( "Loaded S-Chain ERC20 ABI " ) + cc.attention( imaState.strCoinNameErc20_s_chain ) + "\n" );
                } else {
                    if( n2 === 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
                        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                    imaState.joErc20_main_net = null;
                    imaState.joErc20_s_chain = null;
                    imaState.strCoinNameErc20_main_net = "";
                    imaState.strCoinNameErc20_s_chain = "";
                    process.exit( 126 );
                }
            }
        }
    }
    if( n1 !== 0 && n2 === 0 ) {
        if( imaState.strAddrErc20_explicit.length === 0 )
            log.write( cc.error( "IMPORTANT NOTICE:" ) + " " + cc.warning( "Both S-Chain ERC20 JSON and explicit ERC20 address are not specified" ) + "\n" );
        else {
            if( isPrintGathered )
                log.write( cc.attention( "IMPORTANT NOTICE:" ) + " " + cc.note( "S-Chain ERC20 ABI will be auto-generated" ) + "\n" );
            imaState.strCoinNameErc20_s_chain = "" + imaState.strCoinNameErc20_main_net; // assume same
            imaState.joErc20_s_chain = JSON.parse( JSON.stringify( imaState.joErc20_main_net ) ); // clone
            imaState.joErc20_s_chain[imaState.strCoinNameErc20_s_chain + "_address"] = "" + imaState.strAddrErc20_explicit; // set explicit address
            // if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
            //     log.write( cc.info("Auto-generated S-Chain ERC20 JSON is ") + cc.j(imaState.joErc20_s_chain) + "\n" );
        }
    }
    //
    if( imaState.strPathJsonErc20_t_chain.length > 0 ) {
        if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading S<->S Target S-Chain ERC20 ABI from " ) + cc.info( imaState.strPathJsonErc20_t_chain ) + "\n" );
        imaState.joErc20_t_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc20_t_chain, null );
        n2 = Object.keys( imaState.joErc20_t_chain ).length;
        if( n2 > 0 ) {
            imaState.strCoinNameErc20_t_chain = imaUtils.discover_in_json_coin_name( imaState.joErc20_t_chain );
            n2 = imaState.strCoinNameErc20_t_chain.length;
            if( n2 > 0 ) {
                if( isPrintGathered )
                    log.write( cc.info( "Loaded S<->S Target S-Chain ERC20 ABI " ) + cc.attention( imaState.strCoinNameErc20_t_chain ) + "\n" );
            } else {
                if( n2 === 0 && imaState.strPathJsonErc20_t_chain.length > 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S<->S Target S-Chain ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc20_t_chain = null;
                imaState.strCoinNameErc20_t_chain = "";
                process.exit( 126 );
            }
        }
    } // if( imaState.strPathJsonErc20_t_chain.length > 0 )
    if( isPrintGathered &&
        imaState.strAddrErc20_explicit_target.length === 0 && imaState.strCoinNameErc20_t_chain.length === 0 &&
        imaState.strCoinNameErc20_s_chain.length > 0
    )
        log.write( cc.error( "IMPORTANT NOTICE:" ) + " " + cc.warning( "Both S<->S Target S-Chain ERC20 JSON and explicit ERC20 address are not specified" ) + "\n" );
    //
    //
    //
    if( imaState.strPathJsonErc721_main_net.length > 0 /* && imaState.strPathJsonErc721_s_chain.length > 0 */ ) {
        n1 = 0;
        n2 = 0;
        if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading Main-net ERC721 ABI from " ) + cc.info( imaState.strPathJsonErc721_main_net ) + "\n" );
        imaState.joErc721_main_net = imaUtils.jsonFileLoad( imaState.strPathJsonErc721_main_net, null );
        n1 = Object.keys( imaState.joErc721_main_net ).length;
        if( imaState.strPathJsonErc721_s_chain.length > 0 ) {
            if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC721 ABI from " ) + cc.info( imaState.strPathJsonErc721_s_chain ) + "\n" );
            imaState.joErc721_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc721_s_chain, null );
            n2 = Object.keys( imaState.joErc721_s_chain ).length;
        }
        if( n1 > 0 /* && n2 > 0 */ ) {
            imaState.strCoinNameErc721_main_net = imaUtils.discover_in_json_coin_name( imaState.joErc721_main_net );
            if( n2 > 0 )
                imaState.strCoinNameErc721_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc721_s_chain );
            n1 = imaState.strCoinNameErc721_main_net.length;
            if( n2 > 0 )
                n2 = imaState.strCoinNameErc721_s_chain.length;
            if( n1 > 0 /* && n2 > 0 */ ) {
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.information && ( !imaState.bShowConfigMode ) ) {
                    if( isPrintGathered )
                        log.write( cc.info( "Loaded Main-net ERC721 ABI " ) + cc.attention( imaState.strCoinNameErc721_main_net ) + "\n" );
                    if( n2 > 0 && isPrintGathered )
                        log.write( cc.info( "Loaded S-Chain ERC721 ABI " ) + cc.attention( imaState.strCoinNameErc721_s_chain ) + "\n" );
                }
            } else {
                if( n1 === 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                if( n2 === 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc721_main_net = null;
                imaState.joErc721_s_chain = null;
                imaState.strCoinNameErc721_main_net = "";
                imaState.strCoinNameErc721_s_chain = "";
                process.exit( 126 );
            }
        } else {
            if( n1 === 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC721 JSON is invalid" ) + "\n" );
            if( n2 === 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC721 JSON is invalid" ) + "\n" );
            imaState.joErc721_main_net = null;
            imaState.joErc721_s_chain = null;
            imaState.strCoinNameErc721_main_net = "";
            imaState.strCoinNameErc721_s_chain = "";
            process.exit( 126 );
        }
    } else { // if( imaState.strPathJsonErc721_main_net.length > 0 /*&& imaState.strPathJsonErc721_s_chain.length > 0*/ )
        if( imaState.strPathJsonErc721_s_chain.length > 0 ) {
            n1 = 0;
            n2 = 0;
            if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC721 ABI from " ) + cc.info( imaState.strPathJsonErc721_s_chain ) + "\n" );
            imaState.joErc721_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc721_s_chain, null );
            n2 = Object.keys( imaState.joErc721_s_chain ).length;

            if( n2 > 0 ) {
                imaState.strCoinNameErc721_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc721_s_chain );
                n2 = imaState.strCoinNameErc721_s_chain.length;
                if( n2 > 0 ) {
                    if( isPrintGathered )
                        log.write( cc.info( "Loaded S-Chain ERC721 ABI " ) + cc.attention( imaState.strCoinNameErc721_s_chain ) + "\n" ); else {
                        if( n2 === 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
                            log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                        imaState.joErc721_main_net = null;
                        imaState.joErc721_s_chain = null;
                        imaState.strCoinNameErc721_main_net = "";
                        imaState.strCoinNameErc721_s_chain = "";
                        process.exit( 126 );
                    }
                }
            }
        }
    }
    if( n1 !== 0 && n2 === 0 ) {
        if( imaState.strAddrErc721_explicit.length === 0 ) {
            if( isPrintGathered )
                log.write( cc.error( "IMPORTANT NOTICE:" ) + " " + cc.warning( "Both S-Chain ERC721 JSON and explicit ERC721 address are not specified" ) + "\n" );
        } else {
            if( isPrintGathered )
                log.write( cc.attention( "IMPORTANT NOTICE:" ) + " " + cc.note( "S-Chain ERC721 ABI will be auto-generated" ) + "\n" );
            imaState.strCoinNameErc721_s_chain = "" + imaState.strCoinNameErc721_main_net; // assume same
            imaState.joErc721_s_chain = JSON.parse( JSON.stringify( imaState.joErc721_main_net ) ); // clone
            imaState.joErc721_s_chain[imaState.strCoinNameErc721_s_chain + "_address"] = "" + imaState.strAddrErc721_explicit; // set explicit address
            // if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            //     log.write( cc.info("Auto-generated S-Chain ERC721 JSON is ") + cc.j(imaState.joErc721_s_chain) + "\n" );
        }
    }
    //
    if( imaState.strPathJsonErc721_t_chain.length > 0 && isPrintGathered ) {
        if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading S<->S Target S-Chain ERC721 ABI from " ) + cc.info( imaState.strPathJsonErc721_t_chain ) + "\n" );
        imaState.joErc721_t_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc721_t_chain, null );
        n2 = Object.keys( imaState.joErc721_t_chain ).length;
        if( n2 > 0 ) {
            imaState.strCoinNameErc721_t_chain = imaUtils.discover_in_json_coin_name( imaState.joErc721_t_chain );
            n2 = imaState.strCoinNameErc721_t_chain.length;
            if( n2 > 0 && isPrintGathered )
                log.write( cc.info( "Loaded S<->S Target S-Chain ERC721 ABI " ) + cc.attention( imaState.strCoinNameErc721_t_chain ) + "\n" );
            else {
                if( n2 === 0 && imaState.strPathJsonErc721_t_chain.length > 0 && isPrintGathered )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S<->S Target S-Chain ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc721_t_chain = null;
                imaState.strCoinNameErc721_t_chain = "";
                process.exit( 126 );
            }
        }
    } // if( imaState.strPathJsonErc721_t_chain.length > 0 )
    if( isPrintGathered &&
        imaState.strAddrErc721_explicit_target.length === 0 && imaState.strCoinNameErc721_t_chain.length === 0 &&
        imaState.strCoinNameErc721_s_chain.length > 0
    )
        log.write( cc.error( "IMPORTANT NOTICE:" ) + " " + cc.warning( "Both S<->S Target S-Chain ERC721 JSON and explicit ERC721 address are not specified" ) + "\n" );
    //
    //
    //
    if( imaState.strPathJsonErc1155_main_net.length > 0 /* && imaState.strPathJsonErc1155_s_chain.length > 0 */ ) {
        n1 = 0;
        n2 = 0;
        if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading Main-net ERC1155 ABI from " ) + cc.info( imaState.strPathJsonErc1155_main_net ) + "\n" );
        imaState.joErc1155_main_net = imaUtils.jsonFileLoad( imaState.strPathJsonErc1155_main_net, null );
        n1 = Object.keys( imaState.joErc1155_main_net ).length;
        if( imaState.strPathJsonErc1155_s_chain.length > 0 ) {
            if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC1155 ABI from " ) + cc.info( imaState.strPathJsonErc1155_s_chain ) + "\n" );
            imaState.joErc1155_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc1155_s_chain, null );
            n2 = Object.keys( imaState.joErc1155_s_chain ).length;
        }
        if( n1 > 0 /* && n2 > 0 */ ) {
            imaState.strCoinNameErc1155_main_net = imaUtils.discover_in_json_coin_name( imaState.joErc1155_main_net );
            if( n2 > 0 )
                imaState.strCoinNameErc1155_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc1155_s_chain );
            n1 = imaState.strCoinNameErc1155_main_net.length;
            if( n2 > 0 )
                n2 = imaState.strCoinNameErc1155_s_chain.length;
            if( n1 > 0 /* && n2 > 0 */ ) {
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.information && ( !imaState.bShowConfigMode ) ) {
                    if( isPrintGathered )
                        log.write( cc.info( "Loaded Main-net ERC1155 ABI " ) + cc.attention( imaState.strCoinNameErc1155_main_net ) + "\n" );
                    if( n2 > 0 && isPrintGathered )
                        log.write( cc.info( "Loaded S-Chain ERC1155 ABI " ) + cc.attention( imaState.strCoinNameErc1155_s_chain ) + "\n" );
                }
            } else {
                if( n1 === 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC1155 token name is not discovered (malformed JSON)" ) + "\n" );
                if( n2 === 0 && imaState.strPathJsonErc1155_s_chain.length > 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC1155 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc1155_main_net = null;
                imaState.joErc1155_s_chain = null;
                imaState.strCoinNameErc1155_main_net = "";
                imaState.strCoinNameErc1155_s_chain = "";
                process.exit( 126 );
            }
        } else {
            if( n1 === 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC1155 JSON is invalid" ) + "\n" );
            if( n2 === 0 && imaState.strPathJsonErc1155_s_chain.length > 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC1155 JSON is invalid" ) + "\n" );
            imaState.joErc1155_main_net = null;
            imaState.joErc1155_s_chain = null;
            imaState.strCoinNameErc1155_main_net = "";
            imaState.strCoinNameErc1155_s_chain = "";
            process.exit( 126 );
        }
    } else { // if( imaState.strPathJsonErc1155_main_net.length > 0 /*&& imaState.strPathJsonErc1155_s_chain.length > 0*/ )
        if( imaState.strPathJsonErc1155_s_chain.length > 0 ) {
            n1 = 0;
            n2 = 0;
            if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC1155 ABI from " ) + cc.info( imaState.strPathJsonErc1155_s_chain ) + "\n" );
            imaState.joErc1155_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc1155_s_chain, null );
            n2 = Object.keys( imaState.joErc1155_s_chain ).length;

            if( n2 > 0 ) {
                imaState.strCoinNameErc1155_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc1155_s_chain );
                n2 = imaState.strCoinNameErc1155_s_chain.length;
                if( n2 > 0 ) {
                    if( isPrintGathered )
                        log.write( cc.info( "Loaded S-Chain ERC1155 ABI " ) + cc.attention( imaState.strCoinNameErc1155_s_chain ) + "\n" );
                } else {
                    if( n2 === 0 && imaState.strPathJsonErc1155_s_chain.length > 0 )
                        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC1155 token name is not discovered (malformed JSON)" ) + "\n" );
                    imaState.joErc1155_main_net = null;
                    imaState.joErc1155_s_chain = null;
                    imaState.strCoinNameErc1155_main_net = "";
                    imaState.strCoinNameErc1155_s_chain = "";
                    process.exit( 126 );
                }
            }
        }
    }
    if( n1 !== 0 && n2 === 0 ) {
        if( imaState.strAddrErc1155_explicit.length === 0 ) {
            if( isPrintGathered )
                log.write( cc.error( "IMPORTANT NOTICE:" ) + " " + cc.warning( "Both S-Chain ERC1155 JSON and explicit ERC1155 address are not specified" ) + "\n" );
        } else {
            if( isPrintGathered )
                log.write( cc.attention( "IMPORTANT NOTICE:" ) + " " + cc.note( "S-Chain ERC1155 ABI will be auto-generated" ) + "\n" );
            imaState.strCoinNameErc1155_s_chain = "" + imaState.strCoinNameErc1155_main_net; // assume same
            imaState.joErc1155_s_chain = JSON.parse( JSON.stringify( imaState.joErc1155_main_net ) ); // clone
            imaState.joErc1155_s_chain[imaState.strCoinNameErc1155_s_chain + "_address"] = "" + imaState.strAddrErc1155_explicit; // set explicit address
            // if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            //     log.write( cc.info("Auto-generated S-Chain ERC1155 JSON is ") + cc.j(imaState.joErc1155_s_chain) + "\n" );
        }
    }
    //
    if( imaState.strPathJsonErc1155_t_chain.length > 0 ) {
        if( isPrintGathered && IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading S<->S Target S-Chain ERC1155 ABI from " ) + cc.info( imaState.strPathJsonErc1155_t_chain ) + "\n" );
        imaState.joErc1155_t_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc1155_t_chain, null );
        n2 = Object.keys( imaState.joErc1155_t_chain ).length;
        if( n2 > 0 ) {
            imaState.strCoinNameErc1155_t_chain = imaUtils.discover_in_json_coin_name( imaState.joErc1155_t_chain );
            n2 = imaState.strCoinNameErc1155_t_chain.length;
            if( n2 > 0 ) {
                if( isPrintGathered )
                    log.write( cc.info( "Loaded S<->S Target S-Chain ERC1155 ABI " ) + cc.attention( imaState.strCoinNameErc1155_t_chain ) + "\n" );
            } else {
                if( n2 === 0 && imaState.strPathJsonErc1155_t_chain.length > 0 && isPrintGathered )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S<->S Target S-Chain ERC1155 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc1155_t_chain = null;
                imaState.strCoinNameErc1155_t_chain = "";
                process.exit( 126 );
            }
        }
    } // if( imaState.strPathJsonErc1155_t_chain.length > 0 )
    if( isPrintGathered &&
        imaState.strAddrErc1155_explicit_target.length === 0 && imaState.strCoinNameErc1155_t_chain.length === 0 &&
        imaState.strCoinNameErc1155_s_chain.length > 0
    )
        log.write( cc.error( "IMPORTANT NOTICE:" ) + " " + cc.warning( "Both S<->S Target S-Chain ERC1155 JSON and explicit ERC1155 address are not specified" ) + "\n" );
    //
    //
    //

    if( IMA.verbose_get() > IMA.RV_VERBOSE.information || imaState.bShowConfigMode ) {
        const isPrintGathered = imaState.isPrintGathered ? true : false;
        const isPrintSecurityValues = imaState.isPrintSecurityValues ? true : false;
        if( isPrintGathered ) {
            print_about( true );
            log.write( cc.attention( "IMA AGENT" ) + cc.normal( " is using " ) + cc.bright( "Web3" ) + cc.normal( " version " ) + cc.sunny( IMA.w3mod.version ) + "\n" );
        }
        ensure_have_value( "App path", __filename, false, isPrintGathered, null, ( x ) => {
            return cc.normal( x );
        } );
        ensure_have_value( "Verbose level", IMA.VERBOSE[IMA.verbose_get()], false, isPrintGathered, null, ( x ) => {
            return cc.sunny( x );
        } );
        ensure_have_value( "Main-net URL", imaState.strURL_main_net, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
            return cc.u( x );
        } );
        ensure_have_value( "S-chain URL", imaState.strURL_s_chain, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
            return cc.u( x );
        } );
        ensure_have_value( "S<->S Target S-chain URL", imaState.strURL_t_chain, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
            return cc.u( x );
        } );
        ensure_have_value( "Main-net Ethereum network name", imaState.strChainName_main_net, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S-Chain Ethereum network name", imaState.strChainName_s_chain, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S<->S Target S-Chain Ethereum network name", imaState.strChainName_t_chain, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "Main-net Ethereum chain ID", imaState.cid_main_net, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S-Chain Ethereum chain ID", imaState.cid_s_chain, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S<->S Target S-Chain Ethereum chain ID", imaState.cid_t_chain, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "Skale Manager ABI JSON file path", imaState.strPathAbiJson_skale_manager, false, isPrintGathered, null, ( x ) => {
            return cc.warning( x );
        } );
        ensure_have_value( "Main-net ABI JSON file path", imaState.strPathAbiJson_main_net, false, isPrintGathered, null, ( x ) => {
            return cc.warning( x );
        } );
        ensure_have_value( "S-Chain ABI JSON file path", imaState.strPathAbiJson_s_chain, false, isPrintGathered, null, ( x ) => {
            return cc.warning( x );
        } );
        ensure_have_value( "S<->S Target S-Chain ABI JSON file path", imaState.strPathAbiJson_t_chain, false, isPrintGathered, null, ( x ) => {
            return cc.warning( x );
        } );
        //
        //
        try {
            ensure_have_value( "Main-net user account address", imaState.joAccount_main_net.address( imaState.w3_main_net ), false, isPrintGathered && isPrintSecurityValues );
        } catch ( err ) {}
        try {
            ensure_have_value( "S-chain user account address", imaState.joAccount_s_chain.address( imaState.w3_s_chain ), false, isPrintGathered && isPrintSecurityValues );
        } catch ( err ) {}
        try {
            ensure_have_value( "S<->S Target S-chain user account address", imaState.joAccount_t_chain.address( imaState.w3_t_chain ), false, isPrintGathered );
        } catch ( err ) {}
        //
        // ensure_have_value( "Private key for main-net user account address", imaState.joAccount_main_net.privateKey, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
        //     return cc.attention( x );
        // } );
        // ensure_have_value( "Private key for S-Chain user account address", imaState.joAccount_s_chain.privateKey, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
        //     return cc.attention( x );
        // } );
        // ensure_have_value( "Private key for S<->S Target S-Chain user account address", imaState.joAccount_t_chain.privateKey, false, isPrintGathered && isPrintSecurityValues, null, ( x ) => {
        //     return cc.attention( x );
        // } );
        //
        try {
            ensure_have_chain_credentials( "Main Net", imaState.joAccount_main_net, false, isPrintGathered && isPrintSecurityValues );
        } catch ( err ) {}
        try {
            ensure_have_chain_credentials( "S-Chain", imaState.joAccount_s_chain, false, isPrintGathered && isPrintSecurityValues );
        } catch ( err ) {}
        try {
            ensure_have_chain_credentials( "S<->S Target S-Chain", imaState.joAccount_t_chain, false, isPrintGathered && isPrintSecurityValues );
        } catch ( err ) {}
        //
        //
        ensure_have_value( "Amount of wei to transfer", imaState.nAmountOfWei, false, isPrintGathered, null, ( x ) => {
            return cc.info( x );
        } );
        ensure_have_value( "M->S transfer block size", imaState.nTransferBlockSizeM2S, false, isPrintGathered, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M transfer block size", imaState.nTransferBlockSizeS2M, false, isPrintGathered, null, ( x ) => {
            return cc.note( x );
        } );
        if( imaState.bHaveSkaleManagerABI ) {
            ensure_have_value( "S->S transfer block size", imaState.nTransferBlockSizeS2S, false, isPrintGathered, null, ( x ) => {
                return cc.note( x );
            } );
        }
        ensure_have_value( "M->S transactions limit", imaState.nMaxTransactionsM2S, false, isPrintGathered, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M transactions limit", imaState.nMaxTransactionsS2M, false, isPrintGathered, null, ( x ) => {
            return cc.note( x );
        } );
        if( imaState.bHaveSkaleManagerABI ) {
            ensure_have_value( "S->S transactions limit", imaState.nMaxTransactionsS2S, false, isPrintGathered, null, ( x ) => {
                return cc.note( x );
            } );
        }
        ensure_have_value( "M->S await blocks", imaState.nBlockAwaitDepthM2S, false, isPrintGathered, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M await blocks", imaState.nBlockAwaitDepthS2M, false, isPrintGathered, null, ( x ) => {
            return cc.note( x );
        } );
        if( imaState.bHaveSkaleManagerABI ) {
            ensure_have_value( "S->S await blocks", imaState.nBlockAwaitDepthS2S, false, isPrintGathered, null, ( x ) => {
                return cc.note( x );
            } );
        }
        ensure_have_value( "M->S minimal block age", imaState.nBlockAgeM2S, false, isPrintGathered, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M minimal block age", imaState.nBlockAgeS2M, false, isPrintGathered, null, ( x ) => {
            return cc.note( x );
        } );
        if( imaState.bHaveSkaleManagerABI ) {
            ensure_have_value( "S->S minimal block age", imaState.nBlockAgeS2S, false, isPrintGathered, null, ( x ) => {
                return cc.note( x );
            } );
        }
        ensure_have_value( "Transfer loop period(seconds)", imaState.nLoopPeriodSeconds, false, isPrintGathered, null, ( x ) => {
            return cc.success( x );
        } );
        if( imaState.nTimeFrameSeconds > 0 ) {
            ensure_have_value( "Time framing(seconds)", imaState.nTimeFrameSeconds, false, isPrintGathered );
            ensure_have_value( "Next frame gap(seconds)", imaState.nNextFrameGap, false, isPrintGathered );
        } else
            ensure_have_value( "Time framing", cc.error( "disabled" ), false, isPrintGathered );
        ensure_have_value( "S-Chain node number(zero based)", imaState.nNodeNumber, false, isPrintGathered, null, ( x ) => {
            return cc.info( x );
        } );
        ensure_have_value( "S-Chain nodes count", imaState.nNodesCount, false, isPrintGathered, null, ( x ) => {
            return cc.info( x );
        } );

        ensure_have_value( "Automatic exit(seconds)", imaState.nAutoExitAfterSeconds, false, isPrintGathered && isPrintSecurityValues );

        if( imaState.strLogFilePath.length > 0 ) {
            ensure_have_value( "Log file path", imaState.strLogFilePath, false, isPrintGathered, null, ( x ) => {
                return cc.info( x );
            } );
            ensure_have_value( "Max size of log file path", imaState.nLogMaxSizeBeforeRotation, false, isPrintGathered, null, ( x ) => {
                return ( x <= 0 ) ? cc.warning( "unlimited" ) : cc.note( x );
            } );
            ensure_have_value( "Max rotated count of log files", imaState.nLogMaxFilesCount, false, isPrintGathered, null, ( x ) => {
                return ( x <= 1 ) ? cc.warning( "not set" ) : cc.note( x );
            } );
        }
        if( imaState.strCoinNameErc20_main_net.length > 0 /* && imaState.strCoinNameErc20_s_chain.length > 0 */ ) {
            ensure_have_value( "Loaded Main-net ERC20 ABI ", imaState.strCoinNameErc20_main_net, false, isPrintGathered, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Loaded S-Chain ERC20 ABI ", imaState.strCoinNameErc20_s_chain, false, isPrintGathered, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Amount of tokens to transfer", imaState.nAmountOfToken, false, isPrintGathered, null, ( x ) => {
                return cc.info( x );
            } );
            if( isPrintGathered )
                log.write( cc.info( "ERC20 explicit S-Chain address is " ) + cc.attention( imaState.strAddrErc20_explicit ) + "\n" );
        }
        if( imaState.strCoinNameErc20_t_chain.length > 0 ) {
            ensure_have_value( "Loaded S<->S Target S-Chain ERC20 ABI ", imaState.strCoinNameErc20_t_chain, false, isPrintGathered, null, ( x ) => {
                return cc.attention( x );
            } );
        }
        if( imaState.strCoinNameErc721_main_net.length > 0 /* && imaState.strCoinNameErc721_s_chain.length > 0 */ ) {
            ensure_have_value( "Loaded Main-net ERC721 ABI ", imaState.strCoinNameErc721_main_net, false, isPrintGathered, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Loaded S-Chain ERC721 ABI ", imaState.strCoinNameErc721_s_chain, false, isPrintGathered, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "ERC721 token id ", imaState.idToken, false, isPrintGathered, null, ( x ) => {
                return cc.info( x );
            } );
            if( isPrintGathered )
                log.write( cc.info( "ERC721 explicit S-Chain address is " ) + cc.attention( imaState.strAddrErc721_explicit ) + "\n" );
        }
        if( imaState.strCoinNameErc721_t_chain.length > 0 ) {
            ensure_have_value( "Loaded S<->S Target S-Chain ERC721 ABI ", imaState.strCoinNameErc721_t_chain, false, isPrintGathered, null, ( x ) => {
                return cc.attention( x );
            } );
        }
        if( imaState.strCoinNameErc1155_main_net.length > 0 /* && imaState.strCoinNameErc1155_s_chain.length > 0 */ ) {
            ensure_have_value( "Loaded Main-net ERC1155 ABI ", imaState.strCoinNameErc1155_main_net, false, isPrintGathered, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Loaded S-Chain ERC1155 ABI ", imaState.strCoinNameErc1155_s_chain, false, isPrintGathered, null, ( x ) => {
                return cc.attention( x );
            } );
            try {
                ensure_have_value( "ERC1155 token id ", imaState.idToken, false, isPrintGathered, null, ( x ) => {
                    return cc.info( x );
                } );
                ensure_have_value( "ERC1155 token amount ", imaState.nAmountOfToken, false, isPrintGathered, null, ( x ) => {
                    return cc.info( x );
                } );
            } catch ( e1 ) {
                try {
                    ensure_have_value( "ERC1155 batch of token ids ", imaState.idTokens, false, isPrintGathered, null, ( x ) => {
                        return cc.info( x );
                    } );
                    ensure_have_value( "ERC1155 batch of token amounts ", imaState.arrAmountsOfTokens, false, isPrintGathered, null, ( x ) => {
                        return cc.info( x );
                    } );
                } catch ( e2 ) {
                    log.write( cc.warning( "Please check your params in ERC1155 transfer \n" ) );
                    log.write( cc.warning( "Error 1" ) + cc.sunny( e1 ) + "\n" );
                    log.write( cc.warning( "Error 2" ) + cc.sunny( e2 ) + "\n" );
                    process.exit( 126 );
                }
            }
            if( isPrintGathered )
                log.write( cc.info( "ERC1155 explicit S-Chain address is " ) + cc.attention( imaState.strAddrErc1155_explicit ) + "\n" );
        }
        if( imaState.strCoinNameErc1155_t_chain.length > 0 ) {
            ensure_have_value( "Loaded S<->S Target S-Chain ERC1155 ABI ", imaState.strCoinNameErc1155_t_chain, false, isPrintGathered, null, ( x ) => {
                return cc.attention( x );
            } );
        }
        if( isPrintGathered ) {
            log.write( cc.info( "Main Net Gas Price Multiplier is" ) + cc.debug( "....................." ) + ( imaState.tc_main_net.gasPriceMultiplier ? cc.info( imaState.tc_main_net.gasPriceMultiplier.toString() ) : cc.error( "disabled" ) ) + "\n" );
            log.write( cc.info( "S-Chain Gas Price Multiplier is" ) + cc.debug( "......................" ) + ( imaState.tc_s_chain.gasPriceMultiplier ? cc.info( imaState.tc_s_chain.gasPriceMultiplier.toString() ) : cc.error( "disabled" ) ) + "\n" );
            log.write( cc.info( "Target S-Chain Gas Price Multiplier is" ) + cc.debug( "..............." ) + ( imaState.tc_t_chain.gasPriceMultiplier ? cc.info( imaState.tc_t_chain.gasPriceMultiplier.toString() ) : cc.error( "disabled" ) ) + "\n" );
            log.write( cc.info( "Main Net Gas Value Multiplier is" ) + cc.debug( "....................." ) + ( imaState.tc_main_net.gasMultiplier ? cc.info( imaState.tc_main_net.gasMultiplier.toString() ) : cc.notice( "default" ) ) + "\n" );
            log.write( cc.info( "S-Chain Gas Value Multiplier is" ) + cc.debug( "......................" ) + ( imaState.tc_s_chain.gasMultiplier ? cc.info( imaState.tc_s_chain.gasMultiplier.toString() ) : cc.notice( "default" ) ) + "\n" );
            log.write( cc.info( "Target S-Chain Gas Value Multiplier is" ) + cc.debug( "..............." ) + ( imaState.tc_t_chain.gasMultiplier ? cc.info( imaState.tc_t_chain.gasMultiplier.toString() ) : cc.notice( "default" ) ) + "\n" );
            log.write( cc.info( "Pending transaction analysis(PTX) is" ) + cc.debug( "................." ) + ( imaState.optsPendingTxAnalysis.isEnabled ? cc.success( "enabled" ) : cc.error( "disabled" ) ) + "\n" );
            log.write( cc.info( "Pending transaction analysis 2nd attempt after" ) + cc.debug( "......." ) + cc.bright( imaState.optsPendingTxAnalysis.nTimeoutSecondsBeforeSecondAttempt ) + "\n" );
            log.write( cc.info( "Ignore result of PTX is" ) + cc.debug( ".............................." ) + ( imaState.optsPendingTxAnalysis.isIgnore ? cc.success( "yes" ) : cc.error( "no" ) ) + "\n" );
            log.write( cc.info( "Ignore secondary result of PTX is" ) + cc.debug( "...................." ) + ( imaState.optsPendingTxAnalysis.isIgnore2 ? cc.success( "yes" ) : cc.error( "no" ) ) + "\n" );
            log.write( cc.info( "Oracle gas price mode is" ) + cc.debug( "............................." ) + cc.info( IMA.getOracleGasPriceMode() ) + "\n" );
            log.write( cc.info( "S-Chain to S-Chain transferring is" ) + cc.debug( "..................." ) + ( imaState.s2s_opts.isEnabled ? cc.success( "enabled" ) : cc.error( "disabled" ) ) + "\n" );
            log.write( cc.info( "SKALE network re-discovery interval is" ) + cc.debug( "..............." ) + ( imaState.s2s_opts.secondsToReDiscoverSkaleNetwork ? cc.info( imaState.s2s_opts.secondsToReDiscoverSkaleNetwork.toString() ) : cc.error( "disabled" ) ) + "\n" );
            log.write( cc.info( "S<->S transfer mode is" ) + cc.debug( "..............................." ) + IMA.get_S2S_transfer_mode_description_colorized() + "\n" );
        } // if( isPrintGathered )
    }
    //
    //
    //
} // ima_common_init

module.exports = {
    init: init,
    print_about: print_about,
    parse_command_line_argument: parse_command_line_argument,
    ensure_have_value: ensure_have_value,
    ensure_have_chain_credentials: ensure_have_chain_credentials,
    find_node_index: find_node_index,
    load_node_config: load_node_config,
    parse: parse,
    ima_common_init: ima_common_init,
    getWeb3FromURL: getWeb3FromURL
}; // module.exports
