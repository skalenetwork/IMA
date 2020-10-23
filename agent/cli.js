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
// const path = require( "path" );
// const url = require( "url" );
// const os = require( "os" );
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
        log.write( strMsg + "\n" ); else
        console.log( strMsg );
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
    value = value.toString();
    if( value.length == 0 ) {
        retVal = false;
        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " missing value for " ) + fnNameColorizer( name ) );
        if( isExitIfEmpty )
            process.exit( 126 );
    }
    let strDots = "...";
    let n = 50 - name.length;
    for( ; n > 0; --n )
        strDots += ".";
    log.write( fnNameColorizer( name ) + cc.debug( strDots ) + fnValueColorizer( value ) + "\n" ); // just print value
    return retVal;
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

function parse( joExternalHandlers ) {
    let idxArg; const cntArgs = process.argv.length;
    for( idxArg = 2; idxArg < cntArgs; ++idxArg ) {
        const joArg = parse_command_line_argument( process.argv[idxArg] );
        if( joArg.name == "help" ) {
            print_about();
            const soi = "    "; // options indent
            console.log( cc.sunny( "GENERAL" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "help" ) + cc.debug( ".........................." ) + cc.notice( "Show this " ) + cc.note( "help info" ) + cc.notice( " and exit." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "version" ) + cc.debug( "......................." ) + cc.notice( "Show " ) + cc.note( "version info" ) + cc.notice( " and exit." ) );
            console.log( cc.sunny( "BLOCKCHAIN NETWORK" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "url-main-net" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( ".............." ) + cc.note( "Main-net URL" ) + cc.notice( " for Web3. Value is automatically loaded from the " ) + cc.warning( "URL_W3_ETHEREUM" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "url-s-chain" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "..............." ) + cc.note( "S-chain URL" ) + cc.notice( " for Web3. Value is automatically loaded from the " ) + cc.warning( "URL_W3_S_CHAIN" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "id-main-net" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............" ) + cc.note( "Main-net" ) + cc.notice( " Ethereum " ) + cc.note( "network name." ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "CHAIN_NAME_ETHEREUM" ) + cc.notice( " environment variable if not specified. Default value is " ) + cc.sunny( "\"Mainnet\"" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "id-s-chain" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............." ) + cc.note( "S-chain" ) + cc.notice( " Ethereum " ) + cc.note( "network name." ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "CHAIN_NAME_SCHAIN" ) + cc.notice( " environment variable if not specified. Default value is " ) + cc.sunny( "\"id-S-chain\"" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "cid-main-net" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "..........." ) + cc.note( "Main-net" ) + cc.notice( " Ethereum " ) + cc.note( "chain ID" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "CID_ETHEREUM" ) + cc.notice( " environment variable if not specified. Default value is " ) + cc.sunny( -4 ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "cid-s-chain" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............" ) + cc.note( "S-chain" ) + cc.notice( " Ethereum " ) + cc.note( "chain ID" ) + cc.notice( ". Value is automatically loaded from the " ) + cc.warning( "CID_SCHAIN" ) + cc.notice( " environment variable if not specified. Default value is " ) + cc.sunny( -4 ) + cc.notice( "." ) );
            console.log( cc.sunny( "BLOCKCHAIN INTERFACE" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "abi-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "............." ) + cc.notice( "Path to JSON file containing IMA ABI of " ) + cc.note( "Main-net" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "abi-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( ".............." ) + cc.notice( "Path to JSON file containing IMA ABI of " ) + cc.note( "S-chain" ) + cc.notice( " for Web3." ) );
            console.log( cc.sunny( "ERC721 INTERFACE" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc721-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( ".........." ) + cc.notice( "Path to JSON file containing ERC721 ABI of " ) + cc.note( "Main-net" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc721-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "..........." ) + cc.notice( "Path to JSON file containing ERC721 ABI of " ) + cc.note( "S-chain" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "addr-erc721-s-chain" ) + cc.sunny( "=" ) + cc.attention( "address" ) + cc.debug( "..." ) + cc.notice( "Explicit ERC721 address in " ) + cc.note( "S-chain" ) + cc.notice( " for Web3." ) );
            console.log( cc.sunny( "ERC20 INTERFACE" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc20-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "..........." ) + cc.notice( "Path to JSON file containing ERC20 ABI of " ) + cc.note( "Main-net" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc20-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "............" ) + cc.notice( "Path to JSON file containing ERC20 ABI of " ) + cc.note( "S-chain" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "addr-erc20-s-chain" ) + cc.sunny( "=" ) + cc.attention( "address" ) + cc.debug( "...." ) + cc.notice( "Explicit ERC20 address in " ) + cc.note( "S-chain" ) + cc.notice( " for Web3." ) );
            console.log( cc.sunny( "USER ACCOUNT" ) + cc.info( " options:" ) );
            //
            console.log( soi + cc.debug( "--" ) + cc.bright( "address-main-net" ) + cc.sunny( "=" ) + cc.warning( "value" ) + cc.debug( "........" ) + cc.notice( "Main-net user account address. Value is automatically loaded from the " ) + cc.warning( "ACCOUNT_FOR_ETHEREUM" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "address-s-chain" ) + cc.sunny( "=" ) + cc.warning( "value" ) + cc.debug( "........." ) + cc.notice( "S-chain user account address. Value is automatically loaded from the " ) + cc.warning( "ACCOUNT_FOR_SCHAIN" ) + cc.notice( " environment variable if not specified." ) );
            //
            console.log( soi + cc.debug( "--" ) + cc.bright( "key-main-net" ) + cc.sunny( "=" ) + cc.error( "value" ) + cc.debug( "............" ) + cc.notice( "Private key for " ) + cc.note( "main-net user" ) + cc.notice( " account address. Value is automatically loaded from the " ) + cc.warning( "PRIVATE_KEY_FOR_ETHEREUM" ) + cc.notice( " environment variable if not specified." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "key-s-chain" ) + cc.sunny( "=" ) + cc.error( "value" ) + cc.debug( "............." ) + cc.notice( "Private key for " ) + cc.note( "S-Chain" ) + cc.notice( " user account address. Value is automatically loaded from the " ) + cc.warning( "PRIVATE_KEY_FOR_SCHAIN" ) + cc.notice( " environment variable if not specified." ) );
            //
            console.log( soi + cc.debug( "--" ) + cc.bright( "wei" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "...................." ) + cc.notice( "Amount of " ) + cc.attention( "wei" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "babbage" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................" ) + cc.notice( "Amount of " ) + cc.attention( "babbage" ) + cc.info( "(wei*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "lovelace" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "..............." ) + cc.notice( "Amount of " ) + cc.attention( "lovelace" ) + cc.info( "(wei*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "shannon" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................" ) + cc.notice( "Amount of " ) + cc.attention( "shannon" ) + cc.info( "(wei*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "szabo" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( ".................." ) + cc.notice( "Amount of " ) + cc.attention( "szabo" ) + cc.info( "(wei*1000*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "finney" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................." ) + cc.notice( "Amount of " ) + cc.attention( "finney" ) + cc.info( "(wei*1000*1000*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "ether" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( ".................." ) + cc.notice( "Amount of " ) + cc.attention( "ether" ) + cc.info( "(wei*1000*1000*1000*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "amount" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................." ) + cc.notice( "Amount of " ) + cc.attention( "tokens" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "tid" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "...................." ) + cc.attention( "ERC721" ) + cc.notice( " token id to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "raw-transfer" ) + cc.debug( ".................." ) + cc.notice( "Perform " ) + cc.error( "raw" ) + cc.notice( " " ) + cc.attention( "ERC20" ) + cc.notice( "/" ) + cc.attention( "ERC721" ) + cc.notice( " token transfer to pre-deployed contract on S-Chain(do not instantiate new contract)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "no-raw-transfer" ) + cc.debug( "..............." ) + cc.notice( "Perform " ) + cc.attention( "ERC20" ) + cc.notice( "/" ) + cc.attention( "ERC721" ) + cc.notice( " token transfer to auto instantiated contract on S-Chain." ) );
            console.log( cc.sunny( "PAYMENT TRANSACTION" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gas-price-multiplier-mn" ) + cc.debug( "......." ) + cc.notice( "Sets " ) + cc.attention( "Gas Price Multiplier" ) + cc.notice( " for " ) + cc.attention( "Main Net" ) + cc.notice( " transactions, Default value is " ) + cc.info( "1.25" ) + cc.notice( ". Specify value " ) + cc.info( "0.0" ) + cc.notice( " to disable " ) + cc.attention( "Gas Price Customization" ) + cc.notice( " for " ) + cc.attention( "Main Net" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gas-price-multiplier-sc" ) + cc.debug( "......." ) + cc.notice( "Sets " ) + cc.attention( "Gas Price Multiplier" ) + cc.notice( " for " ) + cc.attention( "S-Chain" ) + cc.notice( " transactions, Default value is " ) + cc.info( "0.0" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "gas-price-multiplier" ) + cc.debug( ".........." ) + cc.notice( "Sets " ) + cc.attention( "Gas Price Multiplier" ) + cc.notice( " for both " ) + cc.attention( "Main Net" ) + cc.notice( " and " ) + cc.attention( "S-Chain" ) + cc.notice( "." ) );
            console.log( cc.sunny( "REGISTRATION" ) + cc.info( " commands:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "register" ) + cc.debug( "......................" ) + cc.note( "Register" ) + cc.notice( "(perform all steps)" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "register1" ) + cc.debug( "....................." ) + cc.note( "Perform registration step 1" ) + cc.notice( " - register S-Chain on Main-net." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "register2" ) + cc.debug( "....................." ) + cc.note( "Perform registration step 2" ) + cc.notice( " - register S-Chain in deposit box." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "register3" ) + cc.debug( "....................." ) + cc.note( "Perform registration step 3" ) + cc.notice( " - register Main-net deposit box on S-Chain." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration" ) + cc.debug( "............" ) + cc.note( "Registration status check" ) + cc.notice( "(perform all steps)" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration1" ) + cc.debug( "..........." ) + cc.note( "Perform registration status check step 1" ) + cc.notice( " - register S-Chain on Main-net." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration2" ) + cc.debug( "..........." ) + cc.note( "Perform registration status check step 2" ) + cc.notice( " - register S-Chain in deposit box." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration3" ) + cc.debug( "..........." ) + cc.note( "Perform registration status check step 3" ) + cc.notice( " - register Main-net deposit box on S-Chain." ) );
            console.log( cc.sunny( "ACTION" ) + cc.info( " commands:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "show-config" ) + cc.debug( "..................." ) + cc.notice( "Show " ) + cc.note( "configuration values" ) + cc.notice( " and exit." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-payment" ) + cc.debug( "..................." ) + cc.notice( "Do one " ) + cc.note( "payment from Main-net user account to S-chain" ) + cc.notice( " user account." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-payment" ) + cc.debug( "..................." ) + cc.notice( "Do one " ) + cc.note( "payment from S-chain user account to Main-net" ) + cc.notice( " user account." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-receive" ) + cc.debug( "..................." ) + cc.notice( "Receive one " ) + cc.note( "payment from S-chain user account to Main-net" ) + cc.notice( " user account(ETH only, receives all the ETH pending in transfer)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-view" ) + cc.debug( "......................" ) + cc.notice( "View money amount user can receive as " ) + cc.note( "payment from S-chain user account to Main-net" ) + cc.notice( " user account(ETH only, receives all the ETH pending in transfer)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-transfer" ) + cc.debug( ".................." ) + cc.notice( "Do single money " ) + cc.note( "transfer loop from Main-net to S-chain." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-transfer" ) + cc.debug( ".................." ) + cc.notice( "Do single money " ) + cc.note( "transfer loop from S-chain to Main-net." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "transfer" ) + cc.debug( "......................" ) + cc.notice( "Run " ) + cc.note( "single M<->S transfer loop iteration." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "loop" ) + cc.debug( ".........................." ) + cc.notice( "Run " ) + cc.note( "M<->S transfer loop." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "load-node-config" ) + cc.sunny( "=" ) + cc.success( "path" ) + cc.debug( "........." ) + cc.notice( "Use specified " ) + cc.note( "S-Chain node JSON configuration file" ) + cc.notice( " to load parameters(like " ) + cc.note( "node index" ) + cc.notice( ", " ) + cc.note( "nodes count" ) + cc.notice( ")." ) );
            console.log( cc.sunny( "ADDITIONAL ACTION" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "no-wait-s-chain" ) + cc.debug( "..............." ) + cc.notice( "Do not wait until " ) + cc.note( "S-Chain" ) + cc.notice( " is started." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "max-wait-attempts" ) + cc.sunny( "=" ) + cc.info( "value" ) + cc.debug( "......." ) + cc.notice( "Max number of " ) + cc.note( "S-Chain" ) + cc.notice( " call attempts to do while it became alive and sane." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "skip-dry-run" ) + cc.debug( ".................." ) + cc.notice( "Skip " ) + cc.note( "dry run" ) + cc.notice( " contract method calls." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "ignore-dry-run" ) + cc.debug( "................" ) + cc.notice( "Ignore result of " ) + cc.note( "dry run" ) + cc.notice( " contract method calls and continue execute." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "dry-run" ) + cc.debug( "......................." ) + cc.notice( "Use error results of " ) + cc.note( "dry run" ) + cc.notice( " contract method calls as actual errors and stop execute." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-transfer-block-size" ) + cc.debug( "......." ) + cc.notice( "Number of transactions in one block to use in money transfer loop from Main-net to S-chain." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-transfer-block-size" ) + cc.debug( "......." ) + cc.notice( "Number of transactions in one block to use in money transfer loop from S-chain to Main-net." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "transfer-block-size" ) + cc.debug( "..........." ) + cc.notice( "Number of transactions in one block to use in both money transfer loops." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-max-transactions" ) + cc.debug( ".........." ) + cc.notice( "Maximal number of transactions to do in money transfer loop from Main-net to S-chain (0 is unlimited)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-max-transactions" ) + cc.debug( ".........." ) + cc.notice( "Maximal number of transactions to do in money transfer loop from S-chain to Main-net (0 is unlimited)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "max-transactions" ) + cc.debug( ".............." ) + cc.notice( "Maximal number of transactions to do in both money transfer loops (0 is unlimited)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-await-blocks" ) + cc.debug( ".............." ) + cc.notice( "Maximal number of blocks to wait to appear in blockchain before transaction from Main-net to S-chain (0 is no wait)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-await-blocks" ) + cc.debug( ".............." ) + cc.notice( "Maximal number of blocks to wait to appear in blockchain before transaction from S-chain to Main-net (0 is no wait)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "await-blocks" ) + cc.debug( ".................." ) + cc.notice( "Maximal number of blocks to wait to appear in blockchain before transaction between both S-chain and Main-net (0 is no wait)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-await-time" ) + cc.debug( "................" ) + cc.notice( "Minimal age of transaction message in seconds before it will be transferred from Main-net to S-chain (0 is no wait)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-await-time" ) + cc.debug( "................" ) + cc.notice( "Minimal age of transaction message in seconds before it will be transferred from S-chain to Main-net (0 is no wait)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "await-time" ) + cc.debug( "...................." ) + cc.notice( "Minimal age of transaction message in seconds before it will be transferred between both S-chain and Main-net (0 is no wait)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "period" ) + cc.debug( "........................" ) + cc.notice( "Transfer " ) + cc.note( "loop period" ) + cc.notice( "(seconds)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "node-number" ) + cc.sunny( "=" ) + cc.info( "value" ) + cc.debug( "............." ) + cc.notice( "S-Chain " ) + cc.note( "node number" ) + cc.notice( "(zero based)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "nodes-count" ) + cc.sunny( "=" ) + cc.info( "value" ) + cc.debug( "............." ) + cc.notice( "S-Chain " ) + cc.note( "nodes count" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "time-framing" ) + cc.sunny( "=" ) + cc.note( "value" ) + cc.debug( "............" ) + cc.notice( "Specifies " ) + cc.note( "period" ) + cc.notice( "(in seconds) " ) + cc.note( "for time framing" ) + cc.notice( ". Zero means disable time framing." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "time-gap" ) + cc.sunny( "=" ) + cc.note( "value" ) + cc.debug( "................" ) + cc.notice( "Specifies " ) + cc.note( "gap" ) + cc.notice( "(in seconds) " ) + cc.note( "before next time frame" ) + cc.notice( "." ) );
            console.log( cc.sunny( "MESSAGE SIGNING" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "sign-messages" ) + cc.debug( "................." ) + cc.notice( "Sign transferred messages." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "bls-glue" ) + cc.sunny( "=" ) + cc.note( "path" ) + cc.debug( "................." ) + cc.notice( "Specifies path to " ) + cc.note( "bls_glue" ) + cc.note( " application" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "hash-g1" ) + cc.sunny( "=" ) + cc.note( "path" ) + cc.debug( ".................." ) + cc.notice( "Specifies path to " ) + cc.note( "hash_g1" ) + cc.note( " application" ) + cc.notice( "." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "bls-verify" ) + cc.sunny( "=" ) + cc.note( "path" ) + cc.debug( "..............." ) + cc.notice( "Optional parameter, specifies path to " ) + cc.note( "verify_bls" ) + cc.note( " application" ) + cc.notice( "." ) );
            console.log( cc.sunny( "TEST" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "browse-s-chain" ) + cc.debug( "................" ) + cc.notice( "Download S-Chain network information." ) );
            console.log( cc.sunny( "LOGGING" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "verbose" ) + cc.sunny( "=" ) + cc.bright( "value" ) + cc.debug( "................." ) + cc.notice( "Set " ) + cc.note( "level" ) + cc.notice( " of output details." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "verbose-list" ) + cc.debug( ".................." ) + cc.notice( "List available " ) + cc.note( "verbose levels" ) + cc.notice( " and exit." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "log" ) + cc.sunny( "=" ) + cc.note( "path" ) + cc.debug( "......................" ) + cc.notice( "Write program output to specified log file(multiple files can be specified)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "log-size" ) + cc.sunny( "=" ) + cc.note( "value" ) + cc.debug( "................" ) + cc.notice( "Max size(in bytes) of one log file(affects to log log rotation)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "log-files" ) + cc.sunny( "=" ) + cc.note( "value" ) + cc.debug( "..............." ) + cc.notice( "Maximum number of log files for log rotation." ) );
            process.exit( 0 ); // return 0;
        }
        if( joArg.name == "version" ) {
            print_about();
            return 0;
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
        if( joArg.name == "id-s-chain" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strChainID_s_chain = joArg.value;
            continue;
        }
        if( joArg.name == "id-main-net" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.strChainID_main_net = joArg.value;
            continue;
        }
        if( joArg.name == "cid-s-chain" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.cid_s_chain = owaspUtils.toInteger( joArg.value );
            continue;
        }
        if( joArg.name == "cid-main-net" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.cid_main_net = owaspUtils.toInteger( joArg.value );
            continue;
        }
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
        //
        //
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
        if( joArg.name == "wei" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nAmountOfWei = joArg.value;
            continue;
        }
        if( joArg.name == "babbage" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nAmountOfWei = joArg.value * 1000;
            continue;
        }
        if( joArg.name == "lovelace" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nAmountOfWei = joArg.value * 1000 * 1000;
            continue;
        }
        if( joArg.name == "shannon" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000;
            continue;
        }
        if( joArg.name == "szabo" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000 * 1000;
            continue;
        }
        if( joArg.name == "finney" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000 * 1000 * 1000;
            continue;
        }
        if( joArg.name == "ether" ) {
            owaspUtils.verifyArgumentWithNonEmptyValue( joArg );
            imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000 * 1000 * 1000 * 1000;
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
            continue;
        }
        if( joArg.name == "raw-transfer" ) {
            imaState.isRawTokenTransfer = imaState.isRawTokenTransfer_EXPLICIT = true;
            continue;
        }
        if( joArg.name == "no-raw-transfer" ) {
            imaState.isRawTokenTransfer = imaState.isRawTokenTransfer_EXPLICIT = false;
            continue;
        }
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
        if( joArg.name == "gas-price-multiplier" ) {
            let gasPriceMultiplier = owaspUtils.toFloat( joArg.value );
            if( gasPriceMultiplier < 0.0 )
                gasPriceMultiplier = 0.0;
            imaState.tc_main_net.gasPriceMultiplier = imaState.tc_s_chain.gasPriceMultiplier = gasPriceMultiplier;
            continue;
        }
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
        if( joArg.name == "transfer-block-size" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nTransferBlockSizeM2S = imaState.nTransferBlockSizeS2M = owaspUtils.toInteger( joArg.value );
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
        if( joArg.name == "max-transactions" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nMaxTransactionsM2S = imaState.nMaxTransactionsS2M = owaspUtils.toInteger( joArg.value );
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
        if( joArg.name == "await-blocks" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nBlockAwaitDepthM2S = imaState.nBlockAwaitDepthS2M = owaspUtils.toInteger( joArg.value );
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
        if( joArg.name == "await-time" ) {
            owaspUtils.verifyArgumentIsInteger( joArg );
            imaState.nBlockAgeM2S = imaState.nBlockAgeS2M = owaspUtils.toInteger( joArg.value );
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
        if( joArg.name == "register" ||
            joArg.name == "register1" ||
            joArg.name == "register2" ||
            joArg.name == "register3" ||
            joArg.name == "check-registration" ||
            joArg.name == "check-registration1" ||
            joArg.name == "check-registration2" ||
            joArg.name == "check-registration3" ||
            joArg.name == "m2s-payment" ||
            joArg.name == "s2m-payment" ||
            joArg.name == "s2m-receive" ||
            joArg.name == "s2m-view" ||
            joArg.name == "m2s-transfer" ||
            joArg.name == "s2m-transfer" ||
            joArg.name == "transfer" ||
            joArg.name == "loop" ||
            joArg.name == "browse-s-chain"
        ) {
            joExternalHandlers[joArg.name]();
            continue;
        }
        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " unknown command line argument " ) + cc.info( joArg.name ) );
        return 666;
    }
}

function ima_common_init() {
    let n1 = 0;
    let n2 = 0;
    imaState.joTrufflePublishResult_main_net = imaUtils.jsonFileLoad( imaState.strPathAbiJson_main_net, null, true );
    imaState.joTrufflePublishResult_s_chain = imaUtils.jsonFileLoad( imaState.strPathAbiJson_s_chain, null, true );

    imaUtils.check_keys_exist_in_abi( "main-net", imaState.strPathAbiJson_main_net, imaState.joTrufflePublishResult_main_net, [ "deposit_box_abi", "deposit_box_address", "message_proxy_mainnet_abi", "message_proxy_mainnet_address" ] );
    imaUtils.check_keys_exist_in_abi( "S-Chain", imaState.strPathAbiJson_s_chain, imaState.joTrufflePublishResult_s_chain, [ "token_manager_abi", "token_manager_address", "message_proxy_chain_abi", "message_proxy_chain_address" ] );

    // deposit_box_address           --> deposit_box_abi
    // token_manager_address         --> token_manager_abi
    // message_proxy_mainnet_address --> message_proxy_mainnet_abi
    // message_proxy_chain_address   --> message_proxy_chain_abi

    if( imaState.strURL_main_net.length == 0 ) {
        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Missing " ) + cc.warning( "Main-net" ) + cc.error( " URL in command line arguments" ) + "\n" );
        process.exit( 126 );
    }
    if( imaState.strURL_s_chain.length == 0 ) {
        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Missing " ) + cc.warning( "S-Chain" ) + cc.error( " URL in command line arguments" ) + "\n" );
        process.exit( 126 );
    }

    imaState.w3http_main_net = new w3mod.providers.HttpProvider( imaState.strURL_main_net );
    imaState.w3_main_net = new w3mod( imaState.w3http_main_net );

    imaState.w3http_s_chain = new w3mod.providers.HttpProvider( imaState.strURL_s_chain );
    imaState.w3_s_chain = new w3mod( imaState.w3http_s_chain );

    imaState.jo_deposit_box = new imaState.w3_main_net.eth.Contract( imaState.joTrufflePublishResult_main_net.deposit_box_abi, imaState.joTrufflePublishResult_main_net.deposit_box_address ); // only main net
    imaState.jo_token_manager = new imaState.w3_s_chain.eth.Contract( imaState.joTrufflePublishResult_s_chain.token_manager_abi, imaState.joTrufflePublishResult_s_chain.token_manager_address ); // only s-chain
    imaState.jo_message_proxy_main_net = new imaState.w3_main_net.eth.Contract( imaState.joTrufflePublishResult_main_net.message_proxy_mainnet_abi, imaState.joTrufflePublishResult_main_net.message_proxy_mainnet_address );
    imaState.jo_message_proxy_s_chain = new imaState.w3_s_chain.eth.Contract( imaState.joTrufflePublishResult_s_chain.message_proxy_chain_abi, imaState.joTrufflePublishResult_s_chain.message_proxy_chain_address );
    imaState.jo_lock_and_data_main_net = new imaState.w3_main_net.eth.Contract( imaState.joTrufflePublishResult_main_net.lock_and_data_for_mainnet_abi, imaState.joTrufflePublishResult_main_net.lock_and_data_for_mainnet_address );
    imaState.jo_lock_and_data_s_chain = new imaState.w3_s_chain.eth.Contract( imaState.joTrufflePublishResult_s_chain.lock_and_data_for_schain_abi, imaState.joTrufflePublishResult_s_chain.lock_and_data_for_schain_address );
    // imaState.eth_erc721 = new imaState.w3_s_chain.eth.Contract( imaState.joTrufflePublishResult_s_chain.eth_erc721_abi, imaState.joTrufflePublishResult_s_chain.eth_erc721_address ); // only s-chain
    imaState.eth_erc20 = new imaState.w3_s_chain.eth.Contract( imaState.joTrufflePublishResult_s_chain.eth_erc20_abi, imaState.joTrufflePublishResult_s_chain.eth_erc20_address ); // only s-chain

    log.write( cc.info( "Main-net " ) + cc.sunny( "DepositBox" ) + cc.info( "   address is....." ) + cc.bright( imaState.jo_deposit_box.options.address ) + "\n" );
    log.write( cc.info( "S-Chain  " ) + cc.sunny( "TokenManager" ) + cc.info( " address is....." ) + cc.bright( imaState.jo_token_manager.options.address ) + "\n" );
    log.write( cc.info( "Main-net " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) + cc.bright( imaState.jo_message_proxy_main_net.options.address ) + "\n" );
    log.write( cc.info( "S-Chain  " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) + cc.bright( imaState.jo_message_proxy_s_chain.options.address ) + "\n" );
    log.write( cc.info( "Main-net " ) + cc.sunny( "LockAndData" ) + cc.info( "  address is....." ) + cc.bright( imaState.jo_lock_and_data_main_net.options.address ) + "\n" );
    log.write( cc.info( "S-Chain  " ) + cc.sunny( "LockAndData" ) + cc.info( "  address is....." ) + cc.bright( imaState.jo_lock_and_data_s_chain.options.address ) + "\n" );
    log.write( cc.info( "S-Chain  " ) + cc.sunny( "ERC20" ) + cc.info( "        address is....." ) + cc.bright( imaState.eth_erc20.options.address ) + "\n" );

    //
    //
    //
    if( imaState.strPathJsonErc721_main_net.length > 0 /* && imaState.strPathJsonErc721_s_chain.length > 0 */ ) {
        n1 = 0;
        n2 = 0;
        if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading Main-net ERC721 ABI from " ) + cc.info( imaState.strPathJsonErc721_main_net ) + "\n" );
        imaState.joErc721_main_net = imaUtils.jsonFileLoad( imaState.strPathJsonErc721_main_net, null, true );
        n1 = Object.keys( imaState.joErc721_main_net ).length;
        if( imaState.strPathJsonErc721_s_chain.length > 0 ) {
            if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC721 ABI from " ) + cc.info( imaState.strPathJsonErc721_s_chain ) + "\n" );
            imaState.joErc721_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc721_s_chain, null, true );
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
                    log.write( cc.info( "Loaded Main-net ERC721 ABI " ) + cc.attention( imaState.strCoinNameErc721_main_net ) + "\n" );
                    if( n2 > 0 )
                        log.write( cc.info( "Loaded S-Chain  ERC721 ABI " ) + cc.attention( imaState.strCoinNameErc721_s_chain ) + "\n" );
                }
            } else {
                if( n1 == 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                if( n2 == 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc721_main_net = null;
                imaState.joErc721_s_chain = null;
                imaState.strCoinNameErc721_main_net = "";
                imaState.strCoinNameErc721_s_chain = "";
                process.exit( 126 );
            }
        } else {
            if( n1 == 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC721 JSON is invalid" ) + "\n" );
            if( n2 == 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
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
            if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC721 ABI from " ) + cc.info( imaState.strPathJsonErc721_s_chain ) + "\n" );
            imaState.joErc721_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc721_s_chain, null, true );
            n2 = Object.keys( imaState.joErc721_s_chain ).length;

            if( n2 > 0 ) {
                imaState.strCoinNameErc721_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc721_s_chain );
                n2 = imaState.strCoinNameErc721_s_chain.length;
                if( n2 > 0 )
                    log.write( cc.info( "Loaded S-Chain  ERC721 ABI " ) + cc.attention( imaState.strCoinNameErc721_s_chain ) + "\n" ); else {
                    if( n2 == 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
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
    if( n1 != 0 && n2 == 0 ) {
        if( imaState.strAddrErc721_explicit.length == 0 )
            log.write( cc.fatal( "IMPORTANT NOTICE:" ) + " " + cc.error( "Both S-Chain ERC721 JSON and explicit ERC721 address are not specified" ) + "\n" );
        else {
            log.write( cc.attention( "IMPORTANT NOTICE:" ) + " " + cc.note( "S-Chain ERC721 ABI will be auto-generated" ) + "\n" );
            imaState.strCoinNameErc721_s_chain = "" + imaState.strCoinNameErc721_main_net; // assume same
            imaState.joErc721_s_chain = JSON.parse( JSON.stringify( imaState.joErc721_main_net ) ); // clone
            imaState.joErc721_s_chain[imaState.strCoinNameErc721_s_chain + "_address"] = "" + imaState.strAddrErc721_explicit; // set explicit address
            if( imaState.isRawTokenTransfer ) {
                imaState.isRawTokenTransfer = false;
                if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC721 raw transfer is force " ) + cc.success( "OFF" ) + "\n" );
            }
            // if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            //     log.write( cc.info("Auto-generated S-Chain ERC721 JSON is ") + cc.j(imaState.joErc721_s_chain) + "\n" );
        }
    } else {
        if( n1 != 0 && n2 != 0 ) {
            if( !imaState.isRawTokenTransfer ) {
                imaState.isRawTokenTransfer = imaState.isRawTokenTransfer_EXPLICIT; // true;
                if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC721 raw transfer is force " ) + cc.error( imaState.isRawTokenTransfer_EXPLICIT ? "ON" : "OFF" ) + "\n" );
            }
        }
    }
    //
    //
    //
    if( imaState.strPathJsonErc20_main_net.length > 0 /* && imaState.strPathJsonErc20_s_chain.length > 0 */ ) {
        n1 = 0;
        n2 = 0;
        if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading Main-net ERC20 ABI from " ) + cc.info( imaState.strPathJsonErc20_main_net ) + "\n" );
        imaState.joErc20_main_net = imaUtils.jsonFileLoad( imaState.strPathJsonErc20_main_net, null, true );
        n1 = Object.keys( imaState.joErc20_main_net ).length;
        if( imaState.strPathJsonErc20_s_chain.length > 0 ) {
            if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC20 ABI from " ) + cc.info( imaState.strPathJsonErc20_s_chain ) + "\n" );
            imaState.joErc20_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc20_s_chain, null, true );
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
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.information && ( !imaState.bShowConfigMode ) ) {
                    log.write( cc.info( "Loaded Main-net ERC20 ABI " ) + cc.attention( imaState.strCoinNameErc20_main_net ) + "\n" );
                    if( n2 > 0 )
                        log.write( cc.info( "Loaded S-Chain  ERC20 ABI " ) + cc.attention( imaState.strCoinNameErc20_s_chain ) + "\n" );
                }
            } else {
                if( n1 == 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                if( n2 == 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc20_main_net = null;
                imaState.joErc20_s_chain = null;
                imaState.strCoinNameErc20_main_net = "";
                imaState.strCoinNameErc20_s_chain = "";
                process.exit( 126 );
            }
        } else {
            if( n1 == 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC20 JSON is invalid" ) + "\n" );
            if( n2 == 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
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
            if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC20 ABI from " ) + cc.info( imaState.strPathJsonErc20_s_chain ) + "\n" );
            imaState.joErc20_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc20_s_chain, null, true );
            n2 = Object.keys( imaState.joErc20_s_chain ).length;

            if( n2 > 0 ) {
                imaState.strCoinNameErc20_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc20_s_chain );
                n2 = imaState.strCoinNameErc20_s_chain.length;
                if( n2 > 0 )
                    log.write( cc.info( "Loaded S-Chain  ERC20 ABI " ) + cc.attention( imaState.strCoinNameErc20_s_chain ) + "\n" ); else {
                    if( n2 == 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
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
    if( n1 != 0 && n2 == 0 ) {
        if( imaState.strAddrErc20_explicit.length == 0 )
            log.write( cc.fatal( "IMPORTANT NOTICE:" ) + " " + cc.error( "Both S-Chain ERC20 JSON and explicit ERC20 address are not specified" ) + "\n" );
        else {
            log.write( cc.attention( "IMPORTANT NOTICE:" ) + " " + cc.note( "S-Chain ERC20 ABI will be auto-generated" ) + "\n" );
            imaState.strCoinNameErc20_s_chain = "" + imaState.strCoinNameErc20_main_net; // assume same
            imaState.joErc20_s_chain = JSON.parse( JSON.stringify( imaState.joErc20_main_net ) ); // clone
            imaState.joErc20_s_chain[imaState.strCoinNameErc20_s_chain + "_address"] = "" + imaState.strAddrErc20_explicit; // set explicit address
            if( imaState.isRawTokenTransfer ) {
                imaState.isRawTokenTransfer = false;
                if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC20 raw transfer is force " ) + cc.success( "OFF" ) + "\n" );
            }
            // if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            //     log.write( cc.info("Auto-generated S-Chain ERC20 JSON is ") + cc.j(imaState.joErc20_s_chain) + "\n" );
        }
    } else {
        if( n1 != 0 && n2 != 0 ) {
            if( !imaState.isRawTokenTransfer ) {
                imaState.isRawTokenTransfer = imaState.isRawTokenTransfer_EXPLICIT; // true;
                if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC20 raw transfer is force " ) + cc.error( imaState.isRawTokenTransfer_EXPLICIT ? "ON" : "OFF" ) + "\n" );
            }
        }
    }
    //
    //
    //

    if( IMA.verbose_get() > IMA.RV_VERBOSE.information || imaState.bShowConfigMode ) {
        print_about( true );
        log.write( cc.attention( "IMA AGENT" ) + cc.normal( " is using " ) + cc.bright( "Web3" ) + cc.normal( " version " ) + cc.sunny( IMA.w3mod.version ) + "\n" );
        ensure_have_value( "App path", __filename, false, true, null, ( x ) => {
            return cc.normal( x );
        } );
        ensure_have_value( "Verbose level", IMA.VERBOSE[IMA.verbose_get()], false, true, null, ( x ) => {
            return cc.sunny( x );
        } );
        ensure_have_value( "Main-net URL", imaState.strURL_main_net, false, true, null, ( x ) => {
            return cc.u( x );
        } );
        ensure_have_value( "S-chain URL", imaState.strURL_s_chain, false, true, null, ( x ) => {
            return cc.u( x );
        } );
        ensure_have_value( "Main-net Ethereum network name", imaState.strChainID_main_net, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S-Chain Ethereum network name", imaState.strChainID_s_chain, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "Main-net Ethereum chain ID", imaState.cid_main_net, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S-Chain Ethereum chain ID", imaState.cid_s_chain, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "Main-net ABI JSON file path", imaState.strPathAbiJson_main_net, false, true, null, ( x ) => {
            return cc.warning( x );
        } );
        ensure_have_value( "S-Chain ABI JSON file path", imaState.strPathAbiJson_s_chain, false, true, null, ( x ) => {
            return cc.warning( x );
        } );
        try {
            ensure_have_value( "Main-net user account address", imaState.joAccount_main_net.address( imaState.w3_main_net ), false, true );
        } catch ( err ) {}
        try {
            ensure_have_value( "S-chain user account address", imaState.joAccount_s_chain.address( imaState.w3_s_chain ), false, true );
        } catch ( err ) {}
        ensure_have_value( "Private key for main-net user account address", imaState.joAccount_main_net.privateKey, false, true, null, ( x ) => {
            return cc.attention( x );
        } );
        ensure_have_value( "Private key for S-Chain user account address", imaState.joAccount_s_chain.privateKey, false, true, null, ( x ) => {
            return cc.attention( x );
        } );
        ensure_have_value( "Amount of wei to transfer", imaState.nAmountOfWei, false, true, null, ( x ) => {
            return cc.info( x );
        } );
        ensure_have_value( "M->S transfer block size", imaState.nTransferBlockSizeM2S, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M transfer block size", imaState.nTransferBlockSizeS2M, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "M->S transactions limit", imaState.nMaxTransactionsM2S, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M transactions limit", imaState.nMaxTransactionsS2M, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "M->S await blocks", imaState.nBlockAwaitDepthM2S, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M await blocks", imaState.nBlockAwaitDepthS2M, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "M->S minimal block age", imaState.nBlockAgeM2S, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M minimal block age", imaState.nBlockAgeS2M, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "Transfer loop period(seconds)", imaState.nLoopPeriodSeconds, false, true, null, ( x ) => {
            return cc.success( x );
        } );
        if( imaState.nTimeFrameSeconds > 0 ) {
            ensure_have_value( "Time framing(seconds)", imaState.nTimeFrameSeconds, false, true );
            ensure_have_value( "Next frame gap(seconds)", imaState.nNextFrameGap, false, true );
        } else
            ensure_have_value( "Time framing", cc.error( "disabled" ), false, true );
        ensure_have_value( "S-Chain node number(zero based)", imaState.nNodeNumber, false, true, null, ( x ) => {
            return cc.info( x );
        } );
        ensure_have_value( "S-Chain nodes count", imaState.nNodesCount, false, true, null, ( x ) => {
            return cc.info( x );
        } );
        if( imaState.strLogFilePath.length > 0 ) {
            ensure_have_value( "Log file path", imaState.strLogFilePath, false, true, null, ( x ) => {
                return cc.info( x );
            } );
            ensure_have_value( "Max size of log file path", imaState.nLogMaxSizeBeforeRotation, false, true, null, ( x ) => {
                return ( x <= 0 ) ? cc.warning( "unlimited" ) : cc.note( x );
            } );
            ensure_have_value( "Max rotated count of log files", imaState.nLogMaxFilesCount, false, true, null, ( x ) => {
                return ( x <= 1 ) ? cc.warning( "not set" ) : cc.note( x );
            } );
        }
        if( imaState.strCoinNameErc721_main_net.length > 0 /* && imaState.strCoinNameErc721_s_chain.length > 0 */ ) {
            ensure_have_value( "Loaded Main-net ERC721 ABI ", imaState.strCoinNameErc721_main_net, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Loaded S-Chain  ERC721 ABI ", imaState.strCoinNameErc721_s_chain, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "ERC721 token id ", imaState.idToken, false, true, null, ( x ) => {
                return cc.info( x );
            } );
            if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "ERC721 raw transfer is " ) + cc.yn( imaState.isRawTokenTransfer ) + "\n" );
            log.write( cc.info( "ERC721 explicit S-Chain address is " ) + cc.attention( imaState.strAddrErc721_explicit ) + "\n" );
        }
        if( imaState.strCoinNameErc20_main_net.length > 0 /* && imaState.strCoinNameErc20_s_chain.length > 0 */ ) {
            ensure_have_value( "Loaded Main-net ERC20 ABI ", imaState.strCoinNameErc20_main_net, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Loaded S-Chain  ERC20 ABI ", imaState.strCoinNameErc20_s_chain, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Amount of tokens to transfer", imaState.nAmountOfToken, false, true, null, ( x ) => {
                return cc.info( x );
            } );
            if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "ERC20 raw transfer is " ) + cc.yn( imaState.isRawTokenTransfer ) + "\n" );
            log.write( cc.info( "ERC20 explicit S-Chain address is " ) + cc.attention( imaState.strAddrErc20_explicit ) + "\n" );
        }
        log.write( cc.info( "Main Net Gas Price Multiplier is" ) + cc.debug( "....................." ) + ( imaState.tc_main_net.gasPriceMultiplier ? cc.info( imaState.tc_main_net.gasPriceMultiplier.toString() ) : cc.error( "disabled" ) ) + "\n" );
        log.write( cc.info( "S-Chain Gas Price Multiplier is" ) + cc.debug( "......................" ) + ( imaState.tc_s_chain.gasPriceMultiplier ? cc.info( imaState.tc_s_chain.gasPriceMultiplier.toString() ) : cc.error( "disabled" ) ) + "\n" );
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
    find_node_index: find_node_index,
    load_node_config: load_node_config,
    parse: parse,
    ima_common_init: ima_common_init
}; // module.exports
