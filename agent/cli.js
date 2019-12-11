const fs = require( "fs" );
const path = require( "path" );
const url = require( "url" );
const os = require( "os" );
let shell = require( "shelljs" );

let IMA = null;
let imaState = null;
let imaUtils = null;
let log = null;
let cc = null;
let rpcCall = null;
let w3mod = null;

function init( anIMA, an_imaState, an_imaUtils, a_log, a_cc, a_rpcCall ) {
    IMA = anIMA;
    w3mod = IMA.w3mod;
    imaState = an_imaState;
    imaUtils = an_imaUtils,
    log = a_log;
    cc = a_cc;
    rpcCall = a_rpcCall;
}

let g_strAppName = "SKALE Money Transfer Agent";
let g_strVersion = "1.0";

function print_about( isLog ) {
    var isLog = isLog || false,
        strMsg = cc.info( g_strAppName ) + cc.debug( " version " ) + cc.info( g_strVersion );
    if ( isLog )
        log.write( strMsg + "\n" );
    else
        console.log( strMsg );
}

function parse_command_line_argument( s ) {
    var joArg = {
        "name": "",
        "value": ""
    };
    try {
        if ( !s )
            return joArg;
        s = "" + s;
        while ( s.length > 0 && s[ 0 ] == "-" )
            s = s.substring( 1 );
        var n = s.indexOf( "=" );
        if ( n < 0 ) {
            joArg.name = s;
            return joArg;
        }
        joArg.name = s.substring( 0, n );
        joArg.value = s.substring( n + 1 );
    } catch ( e ) {}
    return joArg;
}

function verify_arg_with_non_empty_value( joArg ) {
    if ( ( !joArg.value ) || joArg.value.length == 0 ) {
        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " value of command line argument " ) + cc.info( joArg.name ) + cc.error( " must not be empty" ) );
        process.exit( 666 );
    }
}

function veryify_url_arg( joArg ) {
    try {
        verify_arg_with_non_empty_value( joArg );
        var s = joArg.value;
        var u = url.parse( joArg.value );
        if ( !u.hostname )
            process.exit( 666 );
        if ( !u.hostname.length )
            process.exit( 666 );
    } catch ( e ) {
        process.exit( 666 );
    }
}

function veryify_int_arg( joArg ) {
    try {
        verify_arg_with_non_empty_value( joArg );
        joArg.value = parseInt( joArg.value );
    } catch ( e ) {
        process.exit( 666 );
    }
}

function veryify_bool_arg( joArg ) {
    var b = false;
    try {
        var ch = joArg.value[ 0 ].toLowerCase();
        if ( ch == "y" || ch == "t" )
            b = true
        else
            b = parseInt( joArg.value ) ? true : false;
    } catch ( e ) {}
    joArg.value = b ? true : false;
    return b;
}

function veryify_arg_path_to_existing_file( strPath ) {
    try {
        stats = fs.lstatSync( strPath );
        if ( stats.isDirectory() )
            return false;
        if ( !stats.isFile() )
            return false;
        return true;
    } catch ( e ) {}
    return false;
}

//
//
// validate command line arguments
function ensure_have_value( name, value, isExitIfEmpty, isPrintValue, fnNameColorizer, fnValueColorizer ) {
    isExitIfEmpty = isExitIfEmpty || false;
    isPrintValue = isPrintValue || false;
    fnNameColorizer = fnNameColorizer || ( ( x ) => {
        return cc.info( x );
    } );
    fnValueColorizer = fnValueColorizer || ( ( x ) => {
        return cc.notice( x );
    } );
    var retVal = true;
    value = value.toString();
    if ( value.length == 0 ) {
        retVal = false;
        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " missing value for " ) + fnNameColorizer( name ) );
        if ( isExitIfEmpty )
            process.exit( 666 );
    }
    var strDots = "...",
        n = 50 - name.length;
    for ( ; n > 0; --n )
        strDots += ".";
    log.write( fnNameColorizer( name ) + cc.debug( strDots ) + fnValueColorizer( value ) + "\n" ); // just print value
    return retVal;
}

function find_node_index( joSChainNodeConfiguration ) {
    try {
        var searchID = joSChainNodeConfiguration.skaleConfig.nodeInfo.nodeID;
        var cnt = joSChainNodeConfiguration.skaleConfig.sChain.nodes.length;
        for ( var i = 0; i < cnt; ++i ) {
            var joNodeDescription = joSChainNodeConfiguration.skaleConfig.sChain.nodes[ i ];
            if ( joNodeDescription.nodeID == searchID )
                return i;
        }
    } catch ( e ) {}
    return 0; // ???
}

function load_node_config( strPath ) {
    let strLogPrefix = cc.info("Node config:") + " ";
    try {
        strPath = imaUtils.normalizePath( strPath );
        //
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Loading values from S-Chain configuraton JSON file " ) + cc.note( strPath ) + cc.debug( "..." ) + "\n" );
        var strJsonSChainNodeConfiguration = fs.readFileSync( strPath, "utf8" );
        var joSChainNodeConfiguration = JSON.parse( strJsonSChainNodeConfiguration );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "S-Chain configuraton JSON: " ) + cc.j( joSChainNodeConfiguration ) + "\n" );
        //
        imaState.nNodeNumber = find_node_index( joSChainNodeConfiguration );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "....from S-Chain configuraton JSON file...." ) + cc.notice( "this node index" ) + cc.debug( " is " ) + cc.info( imaState.nNodeNumber ) + "\n" );
        imaState.nNodesCount = joSChainNodeConfiguration.skaleConfig.sChain.nodes.length;
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "....from S-Chain configuraton JSON file...." ) + cc.notice( "nodes count" ) + cc.debug( " is " ) + cc.info( imaState.nNodesCount ) + "\n" );
        //
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Done" ) + cc.debug( " loading values from S-Chain configuraton JSON file " ) + cc.note( strPath ) + cc.debug( "." ) + "\n" );
    } catch ( e ) {
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR: Exception in load_node_config():" ) + cc.error( e ) + "\n" );
    }
}

function parse( joExternalHandlers ) {
    let idxArg, cntArgs = process.argv.length;
    for ( idxArg = 2; idxArg < cntArgs; ++idxArg ) {
        var joArg = parse_command_line_argument( process.argv[ idxArg ] );
        if ( joArg.name == "help" ) {
            print_about();
            var soi = "    "; // options indent
            console.log( cc.sunny( "GENERAL" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "help" ) + cc.debug( ".........................." ) + cc.notice( "Show this " ) + cc.note( "help info" ) + cc.notice( " and exit." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "version" ) + cc.debug( "......................." ) + cc.notice( "Show " ) + cc.note( "version info" ) + cc.notice( " and exit." ) );
            console.log( cc.sunny( "BLOCKCHAIN NETWORK" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "url-main-net" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( ".............." ) + cc.note( "Main-net URL" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "url-s-chain" ) + cc.sunny( "=" ) + cc.attention( "URL" ) + cc.debug( "..............." ) + cc.note( "S-chain URL" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "id-main-net" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............" ) + cc.note( "Main-net" ) + cc.notice( " Ethereum " ) + cc.note( "network name." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "id-s-chain" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............." ) + cc.note( "S-chain" ) + cc.notice( " Ethereum " ) + cc.note( "network name." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "cid-main-net" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "..........." ) + cc.note( "Main-net" ) + cc.notice( " Ethereum " ) + cc.note( "chain ID." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "cid-s-chain" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............" ) + cc.note( "S-chain" ) + cc.notice( " Ethereum " ) + cc.note( "chain ID." ) );
            console.log( cc.sunny( "BLOCKCHAIN INTERFACE" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "abi-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "............." ) + cc.notice( "Path to JSON file containing IMA ABI of " ) + cc.note( "Main-net" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "abi-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( ".............." ) + cc.notice( "Path to JSON file containing IMA ABI of " ) + cc.note( "S-chain" ) + cc.notice( " for Web3." ) );
            console.log( cc.sunny( "ERC721 INTERFACE" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc721-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( ".........." ) + cc.notice( "Path to JSON file containing ERC721 ABI of " ) + cc.note( "Main-net" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc721-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "..........." ) + cc.notice( "Path to JSON file containing ERC721 ABI of " ) + cc.note( "S-chain" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "addr-erc721-s-chain" ) + cc.sunny( "=" ) + cc.attention( "address" ) + cc.debug( "..." ) + cc.notice( "Explict ERC721 address in " ) + cc.note( "S-chain" ) + cc.notice( " for Web3." ) );
            console.log( cc.sunny( "ERC20 INTERFACE" ) + cc.info( " options:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc20-main-net" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "..........." ) + cc.notice( "Path to JSON file containing ERC20 ABI of " ) + cc.note( "Main-net" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "erc20-s-chain" ) + cc.sunny( "=" ) + cc.attention( "path" ) + cc.debug( "............" ) + cc.notice( "Path to JSON file containing ERC20 ABI of " ) + cc.note( "S-chain" ) + cc.notice( " for Web3." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "addr-erc20-s-chain" ) + cc.sunny( "=" ) + cc.attention( "address" ) + cc.debug( "...." ) + cc.notice( "Explict ERC20 address in " ) + cc.note( "S-chain" ) + cc.notice( " for Web3." ) );
            console.log( cc.sunny( "USER ACCOUNT" ) + cc.info( " options:" ) );
            /**/
            console.log( soi + cc.debug( "--" ) + cc.bright( "address-main-net" ) + cc.sunny( "=" ) + cc.warn( "value" ) + cc.debug( "........" ) + cc.notice( "Main-net user account address." ) );
            /**/
            console.log( soi + cc.debug( "--" ) + cc.bright( "address-s-chain" ) + cc.sunny( "=" ) + cc.warn( "value" ) + cc.debug( "........." ) + cc.notice( "S-chain user account address." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "key-main-net" ) + cc.sunny( "=" ) + cc.error( "value" ) + cc.debug( "............" ) + cc.notice( "Private key for " ) + cc.note( "main-net user" ) + cc.notice( " account address." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "key-s-chain" ) + cc.sunny( "=" ) + cc.error( "value" ) + cc.debug( "............." ) + cc.notice( "Private key for " ) + cc.note( "S-Chain" ) + cc.notice( " user account address." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "wei" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "...................." ) + cc.notice( "Amount of " ) + cc.attention( "wei" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "babbage" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................" ) + cc.notice( "Amount of " ) + cc.attention( "babbage" ) + cc.info( "(wei*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "lovelace" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "..............." ) + cc.notice( "Amount of " ) + cc.attention( "lovelace" ) + cc.info( "(wei*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "shannon" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................" ) + cc.notice( "Amount of " ) + cc.attention( "shannon" ) + cc.info( "(wei*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "szabo" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( ".................." ) + cc.notice( "Amount of " ) + cc.attention( "szabo" ) + cc.info( "(wei*1000*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "finney" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................." ) + cc.notice( "Amount of " ) + cc.attention( "finney" ) + cc.info( "(wei*1000*1000*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "ether" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( ".................." ) + cc.notice( "Amount of " ) + cc.attention( "ether" ) + cc.info( "(wei*1000*1000*1000*1000*1000*1000)" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "amount" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "................." ) + cc.notice( "Amount of " ) + cc.attention( "tokens" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "tid" ) + cc.sunny( "=" ) + cc.attention( "number" ) + cc.debug( "...................." ) + cc.attention( "ERC721" ) + cc.notice( "token id" ) + cc.notice( " to transfer." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "raw-transfer" ) + cc.debug( ".................." ) + cc.notice( "Perform raw ERC20/ERC721 token transfer to pre-deployed contract on S-Chain(do not instantiate new contract)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "no-raw-transfer" ) + cc.debug( "..............." ) + cc.notice( "Perform ERC20/ERC721 token transfer to auto instantiated contract on S-Chain." ) );
            console.log( cc.sunny( "REGISTRATION" ) + cc.info( " commands:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "register" ) + cc.debug( "......................" ) + cc.note( "Register" ) + cc.notice( "(peform all steps)" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "register1" ) + cc.debug( "....................." ) + cc.note( "Perorm registration step 1" ) + cc.notice( " - register S-Chain on Main-net." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "register2" ) + cc.debug( "....................." ) + cc.note( "Perorm registration step 2" ) + cc.notice( " - register S-Chain in deposit box." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "register3" ) + cc.debug( "....................." ) + cc.note( "Perorm registration step 3" ) + cc.notice( " - register Main-net deposit box on S-Chain." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration" ) + cc.debug( "............" ) + cc.note( "Registeration status check" ) + cc.notice( "(peform all steps)" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration1" ) + cc.debug( "..........." ) + cc.note( "Perorm registration status check step 1" ) + cc.notice( " - register S-Chain on Main-net." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration2" ) + cc.debug( "..........." ) + cc.note( "Perorm registration status check step 2" ) + cc.notice( " - register S-Chain in deposit box." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "check-registration3" ) + cc.debug( "..........." ) + cc.note( "Perorm registration status check step 3" ) + cc.notice( " - register Main-net deposit box on S-Chain." ) );
            console.log( cc.sunny( "ACTION" ) + cc.info( " commands:" ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "show-config" ) + cc.debug( "..................." ) + cc.notice( "Show " ) + cc.note( "onfiguration values" ) + cc.notice( " and exit." ) );
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
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-transfer-block-size" ) + cc.debug( "......." ) + cc.notice( "Number of transactions in one block to use in money transfer loop from Main-net to S-chain." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-transfer-block-size" ) + cc.debug( "......." ) + cc.notice( "Number of transactions in one block to use in money transfer loop from S-chain to Main-net." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "transfer-block-size" ) + cc.debug( "..........." ) + cc.notice( "Number of transactions in one block to use in both money transfer loops." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-max-transactions" ) + cc.debug( ".........." ) + cc.notice( "Maximal number of transactions to do in money transfer loop from Main-net to S-chain (0 is unlimited)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-max-transactions" ) + cc.debug( ".........." ) + cc.notice( "Maximal number of transactions to do in money transfer loop from S-chain to Main-net (0 is unlimited)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "max-transactions" ) + cc.debug( ".............." ) + cc.notice( "Maximal number of transactions to do in both money transfer loops (0 is unlimited)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-await-blocks" ) + cc.debug( ".............." ) + cc.notice( "Maximal number of blocks to wait to appear in blockchain before transaction from Main-net to S-chain (0 is no wait)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-await-blocks" ) + cc.debug( ".............." ) + cc.notice( "Maximal number of blocks to wait to appear in blockchain before transaction from S-chain to Main-net (0 is no wait)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "await-blocks" ) + cc.debug( ".................." ) + cc.notice( "Maximal number of blocks to wait to appear in blockchain before transaction between both S-chain and Main-net (0 is no wait)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "m2s-await-time" ) + cc.debug( "................" ) + cc.notice( "Minimal age of transaction message in seconds before it will be trasferred from Main-net to S-chain (0 is no wait)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "s2m-await-time" ) + cc.debug( "................" ) + cc.notice( "Minimal age of transaction message in seconds before it will be trasferred from S-chain to Main-net (0 is no wait)." ) );
            console.log( soi + cc.debug( "--" ) + cc.bright( "await-time" ) + cc.debug( "...................." ) + cc.notice( "Minimal age of transaction message in seconds before it will be trasferred between both S-chain and Main-net (0 is no wait)." ) );
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
            return 0;
        }
        if ( joArg.name == "version" ) {
            print_about();
            return 0;
        }
        if ( joArg.name == "verbose" ) {
            IMA.verbose_set( IMA.verbose_parse( joArg.value ) );
            continue;
        }
        if ( joArg.name == "verbose-list" ) {
            IMA.verbose_list();
            return 0;
        }
        if ( joArg.name == "url-main-net" ) {
            veryify_url_arg( joArg );
            imaState.strURL_main_net = joArg.value;
            continue;
        }
        if ( joArg.name == "url-s-chain" ) {
            veryify_url_arg( joArg );
            imaState.strURL_s_chain = joArg.value;
            continue;
        }
        if ( joArg.name == "id-s-chain" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.strChainID_s_chain = joArg.value;
            continue;
        }
        if ( joArg.name == "id-main-net" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.strChainID_main_net = joArg.value;
            continue;
        }
        if ( joArg.name == "cid-s-chain" ) {
            veryify_int_arg( joArg );
            imaState.cid_s_chain = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "cid-main-net" ) {
            veryify_int_arg( joArg );
            imaState.cid_main_net = parseInt( joArg.value );
            continue;
        }
        /**/
        if ( joArg.name == "address-main-net" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.joAccount_main_net.address_ = joArg.value;
            continue;
        }
        /**/
        if ( joArg.name == "address-s-chain" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.joAccount_s_chain.address_ = joArg.value;
            continue;
        }
        if ( joArg.name == "abi-main-net" ) {
            veryify_arg_path_to_existing_file( joArg );
            imaState.strPathAbiJson_main_net = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if ( joArg.name == "abi-s-chain" ) {
            veryify_arg_path_to_existing_file( joArg );
            imaState.strPathAbiJson_s_chain = imaUtils.normalizePath( joArg.value );
            continue;
        }
        //
        //
        if ( joArg.name == "erc721-main-net" ) {
            veryify_arg_path_to_existing_file( joArg );
            imaState.strPathJsonErc721_main_net = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if ( joArg.name == "erc721-s-chain" ) {
            veryify_arg_path_to_existing_file( joArg );
            imaState.strPathJsonErc721_s_chain = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if ( joArg.name == "addr-erc721-s-chain" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.strAddrErc721_explicit = joArg.value;
            continue;
        }
        //
        //
        if ( joArg.name == "erc20-main-net" ) {
            veryify_arg_path_to_existing_file( joArg );
            imaState.strPathJsonErc20_main_net = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if ( joArg.name == "erc20-s-chain" ) {
            veryify_arg_path_to_existing_file( joArg );
            imaState.strPathJsonErc20_s_chain = imaUtils.normalizePath( joArg.value );
            continue;
        }
        if ( joArg.name == "addr-erc20-s-chain" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.strAddrErc20_explicit = joArg.value;
            continue;
        }
        //
        //
        if ( joArg.name == "key-main-net" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.joAccount_main_net.privateKey = joArg.value;
            continue;
        }
        if ( joArg.name == "key-s-chain" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.joAccount_s_chain.privateKey = joArg.value;
            continue;
        }
        if ( joArg.name == "wei" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.nAmountOfWei = joArg.value;
            continue;
        }
        if ( joArg.name == "babbage" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.nAmountOfWei = joArg.value * 1000;
            continue;
        }
        if ( joArg.name == "lovelace" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.nAmountOfWei = joArg.value * 1000 * 1000;
            continue;
        }
        if ( joArg.name == "shannon" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000;
            continue;
        }
        if ( joArg.name == "szabo" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000 * 1000;
            continue;
        }
        if ( joArg.name == "finney" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000 * 1000 * 1000;
            continue;
        }
        if ( joArg.name == "ether" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.nAmountOfWei = joArg.value * 1000 * 1000 * 1000 * 1000 * 1000 * 1000;
            continue;
        }
        if ( joArg.name == "amount" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.nAmountOfToken = joArg.value;
            continue;
        }
        if ( joArg.name == "tid" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.idToken = joArg.value;
            continue;
        }
        if ( joArg.name == "raw-transfer" ) {
            imaState.isRawTokenTransfer = imaState.isRawTokenTransfer_EXPLICIT = true;
            continue;
        }
        if ( joArg.name == "no-raw-transfer" ) {
            imaState.isRawTokenTransfer = imaState.isRawTokenTransfer_EXPLICIT = false;
            continue;
        }
        if ( joArg.name == "show-config" ) {
            imaState.bShowConfigMode = true;
            continue;
        }
        if ( joArg.name == "load-node-config" ) {
            verify_arg_with_non_empty_value( joArg );
            load_node_config( joArg.value );
            continue;
        }
        if ( joArg.name == "m2s-transfer-block-size" ) {
            veryify_int_arg( joArg );
            imaState.nTransferBlockSizeM2S = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "s2m-transfer-block-size" ) {
            veryify_int_arg( joArg );
            imaState.nTransferBlockSizeS2M = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "transfer-block-size" ) {
            veryify_int_arg( joArg );
            imaState.nTransferBlockSizeM2S = imaState.nTransferBlockSizeS2M = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "m2s-max-transactions" ) {
            veryify_int_arg( joArg );
            imaState.nMaxTransactionsM2S = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "s2m-max-transactions" ) {
            veryify_int_arg( joArg );
            imaState.nMaxTransactionsS2M = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "max-transactions" ) {
            veryify_int_arg( joArg );
            imaState.nMaxTransactionsM2S = imaState.nMaxTransactionsS2M = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "m2s-await-blocks" ) {
            veryify_int_arg( joArg );
            imaState.nBlockAwaitDepthM2S = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "s2m-await-blocks" ) {
            veryify_int_arg( joArg );
            imaState.nBlockAwaitDepthS2M = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "await-blocks" ) {
            veryify_int_arg( joArg );
            imaState.nBlockAwaitDepthM2S = imaState.nBlockAwaitDepthS2M = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "m2s-await-time" ) {
            veryify_int_arg( joArg );
            imaState.nBlockAgeM2S = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "s2m-await-time" ) {
            veryify_int_arg( joArg );
            imaState.nBlockAgeS2M = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "await-time" ) {
            veryify_int_arg( joArg );
            imaState.nBlockAgeM2S = imaState.nBlockAgeS2M = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "period" ) {
            veryify_int_arg( joArg );
            imaState.nLoopPeriodSeconds = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "node-number" ) {
            veryify_int_arg( joArg );
            imaState.nNodeNumber = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "nodes-count" ) {
            veryify_int_arg( joArg );
            imaState.nNodesCount = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "time-framing" ) {
            veryify_int_arg( joArg );
            imaState.nTimeFrameSeconds = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "time-gap" ) {
            veryify_int_arg( joArg );
            imaState.nNextFrameGap = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "log-size" ) {
            veryify_int_arg( joArg );
            imaState.nLogMaxSizeBeforeRotation = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "log-files" ) {
            veryify_int_arg( joArg );
            imaState.nLogMaxFilesCount = parseInt( joArg.value );
            continue;
        }
        if ( joArg.name == "log" ) {
            verify_arg_with_non_empty_value( joArg );
            imaState.strLogFilePath = "" + joArg.value;
            continue;
        }
        if ( joArg.name == "sign-messages" ) {
            imaState.bSignMessages = true;
            continue;
        }
        if ( joArg.name == "bls-glue" ) {
            veryify_arg_path_to_existing_file( joArg );
            imaState.strPathBlsGlue = "" + joArg.value;
            continue;
        }
        if ( joArg.name == "hash-g1" ) {
            veryify_arg_path_to_existing_file( joArg );
            imaState.strPathHashG1 = "" + joArg.value;
            continue;
        }
        if ( joArg.name == "bls-verify" ) {
            veryify_arg_path_to_existing_file( joArg );
            imaState.strPathBlsVerify = "" + joArg.value;
            continue;
        }
        if (    joArg.name == "register"
            ||  joArg.name == "register1"
            ||  joArg.name == "register2"
            ||  joArg.name == "register3"
            ||  joArg.name == "check-registration"
            ||  joArg.name == "check-registration1"
            ||  joArg.name == "check-registration2"
            ||  joArg.name == "check-registration3"
            ||  joArg.name == "m2s-payment"
            ||  joArg.name == "s2m-payment"
            ||  joArg.name == "s2m-receive"
            ||  joArg.name == "s2m-view"
            ||  joArg.name == "m2s-transfer"
            ||  joArg.name == "s2m-transfer"
            ||  joArg.name == "transfer"
            ||  joArg.name == "loop"
            ||  joArg.name == "browse-s-chain"
            ) {
            joExternalHandlers[joArg.name]();
            continue;
        }
        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " unkonwn command line argument " ) + cc.info( joArg.name ) );
        return 666;
    }
}

function ima_common_init() {
    imaState.joTrufflePublishResult_main_net = imaUtils.jsonFileLoad( imaState.strPathAbiJson_main_net, null, true );
    imaState.joTrufflePublishResult_s_chain = imaUtils.jsonFileLoad( imaState.strPathAbiJson_s_chain, null, true );

    imaUtils.check_keys_exist_in_abi( "main-net", imaState.strPathAbiJson_main_net, imaState.joTrufflePublishResult_main_net, [ "deposit_box_abi", "deposit_box_address", "message_proxy_mainnet_abi", "message_proxy_mainnet_address" ] );
    imaUtils.check_keys_exist_in_abi( "S-Chain", imaState.strPathAbiJson_s_chain, imaState.joTrufflePublishResult_s_chain, [ "token_manager_abi", "token_manager_address", "message_proxy_chain_abi", "message_proxy_chain_address" ] );

    // deposit_box_address           --> deposit_box_abi
    // token_manager_address         --> token_manager_abi
    // message_proxy_mainnet_address --> message_proxy_mainnet_abi
    // message_proxy_chain_address   --> message_proxy_chain_abi

    if ( imaState.strURL_main_net.length == 0 ) {
        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Missing " ) + cc.warning( "Main-net" ) + cc.error( " URL in command line arguments" ) + "\n" );
        process.exit( 501 );
    }
    if ( imaState.strURL_s_chain.length == 0 ) {
        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Missing " ) + cc.warning( "S-Chain" ) + cc.error( " URL in command line arguments" ) + "\n" );
        process.exit( 501 );
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

    //
    //
    //
    if ( imaState.strPathJsonErc721_main_net.length > 0 /*&& imaState.strPathJsonErc721_s_chain.length > 0*/ ) {
        var n1 = 0,
            n2 = 0;
        if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading Main-net ERC721 ABI from " ) + cc.info( imaState.strPathJsonErc721_main_net ) + "\n" );
        imaState.joErc721_main_net = imaUtils.jsonFileLoad( imaState.strPathJsonErc721_main_net, null, true );
        n1 = Object.keys( imaState.joErc721_main_net ).length;
        if ( imaState.strPathJsonErc721_s_chain.length > 0 ) {
            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC721 ABI from " ) + cc.info( imaState.strPathJsonErc721_s_chain ) + "\n" );
            imaState.joErc721_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc721_s_chain, null, true );
            n2 = Object.keys( imaState.joErc721_s_chain ).length;
        }
        if ( n1 > 0 /*&& n2 > 0*/ ) {
            imaState.strCoinNameErc721_main_net = imaUtils.discover_in_json_coin_name( imaState.joErc721_main_net );
            if ( n2 > 0 )
                imaState.strCoinNameErc721_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc721_s_chain );
            n1 = imaState.strCoinNameErc721_main_net.length;
            if ( n2 > 0 )
                n2 = imaState.strCoinNameErc721_s_chain.length;
            if ( n1 > 0 /*&& n2 > 0*/ ) {
                if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information && ( !imaState.bShowConfigMode ) ) {
                    log.write( cc.info( "Loaded Main-net ERC721 ABI " ) + cc.attention( imaState.strCoinNameErc721_main_net ) + "\n" );
                    if ( n2 > 0 )
                        log.write( cc.info( "Loaded S-Chain  ERC721 ABI " ) + cc.attention( imaState.strCoinNameErc721_s_chain ) + "\n" );
                }
            } else {
                if ( n1 == 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                if ( n2 == 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc721_main_net = null;
                imaState.joErc721_s_chain = null;
                imaState.strCoinNameErc721_main_net = "";
                imaState.strCoinNameErc721_s_chain = "";
                process.exit( 666 );
            }
        } else {
            if ( n1 == 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC721 JSON is invalid" ) + "\n" );
            if ( n2 == 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC721 JSON is invalid" ) + "\n" );
            imaState.joErc721_main_net = null;
            imaState.joErc721_s_chain = null;
            imaState.strCoinNameErc721_main_net = "";
            imaState.strCoinNameErc721_s_chain = "";
            process.exit( 666 );
        }
    } else { // if( imaState.strPathJsonErc721_main_net.length > 0 /*&& imaState.strPathJsonErc721_s_chain.length > 0*/ )
        if ( imaState.strPathJsonErc721_s_chain.length > 0 ) {
            var n1 = 0,
                n2 = 0;

            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC721 ABI from " ) + cc.info( imaState.strPathJsonErc721_s_chain ) + "\n" );
            imaState.joErc721_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc721_s_chain, null, true );
            n2 = Object.keys( imaState.joErc721_s_chain ).length;

            if ( n2 > 0 ) {
                imaState.strCoinNameErc721_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc721_s_chain );
                n2 = imaState.strCoinNameErc721_s_chain.length;
                if ( n2 > 0 )
                    log.write( cc.info( "Loaded S-Chain  ERC721 ABI " ) + cc.attention( imaState.strCoinNameErc721_s_chain ) + "\n" );
                else {
                    if ( n2 == 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
                        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                    imaState.joErc721_main_net = null;
                    imaState.joErc721_s_chain = null;
                    imaState.strCoinNameErc721_main_net = "";
                    imaState.strCoinNameErc721_s_chain = "";
                    process.exit( 667 );
                }
            }
        }
    }
    if ( n1 != 0 && n2 == 0 ) {
        if ( imaState.strAddrErc721_explicit.length == 0 ) {
            log.write( cc.fatal( "IMPORTANT NOTICE:" ) + " " + cc.error( "Both S-Chain ERC721 JSON and explicit ERC721 address are not specified" ) + "\n" );
        } else {
            log.write( cc.attention( "IMPORTANT NOTICE:" ) + " " + cc.note( "S-Chain ERC721 ABI will be auto-generated" ) + "\n" );
            imaState.strCoinNameErc721_s_chain = "" + imaState.strCoinNameErc721_main_net; // assume same
            imaState.joErc721_s_chain = JSON.parse( JSON.stringify( imaState.joErc721_main_net ) ); // clone
            imaState.joErc721_s_chain[ imaState.strCoinNameErc721_s_chain + "_address" ] = "" + imaState.strAddrErc721_explicit; // set explicit address
            if ( imaState.isRawTokenTransfer ) {
                imaState.isRawTokenTransfer = false;
                if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC721 raw transfer is force " ) + cc.success( "OFF" ) + "\n" );
            }
            // if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            //     log.write( cc.info("Auto-generated S-Chain ERC721 JSON is ") + cc.j(imaState.joErc721_s_chain) + "\n" );
        }
    } else {
        if ( n1 != 0 && n2 != 0) {
            if ( !imaState.isRawTokenTransfer ) {
                imaState.isRawTokenTransfer = imaState.isRawTokenTransfer_EXPLICIT; // true;
                if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC721 raw transfer is force " ) + cc.error( imaState.isRawTokenTransfer_EXPLICIT ? "ON" : "OFF" ) + "\n" );
            }
        }
    }
    //
    //
    //
    if ( imaState.strPathJsonErc20_main_net.length > 0 /*&& imaState.strPathJsonErc20_s_chain.length > 0*/ ) {
        var n1 = 0,
            n2 = 0;
        if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading Main-net ERC20 ABI from " ) + cc.info( imaState.strPathJsonErc20_main_net ) + "\n" );
        imaState.joErc20_main_net = imaUtils.jsonFileLoad( imaState.strPathJsonErc20_main_net, null, true );
        n1 = Object.keys( imaState.joErc20_main_net ).length;
        if ( imaState.strPathJsonErc20_s_chain.length > 0 ) {
            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC20 ABI from " ) + cc.info( imaState.strPathJsonErc20_s_chain ) + "\n" );
            imaState.joErc20_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc20_s_chain, null, true );
            n2 = Object.keys( imaState.joErc20_s_chain ).length;
        }
        if ( n1 > 0 /*&& n2 > 0*/ ) {
            imaState.strCoinNameErc20_main_net = imaUtils.discover_in_json_coin_name( imaState.joErc20_main_net );
            if ( n2 > 0 )
                imaState.strCoinNameErc20_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc20_s_chain );
            n1 = imaState.strCoinNameErc20_main_net.length;
            if ( n2 > 0 )
                n2 = imaState.strCoinNameErc20_s_chain.length;
            if ( n1 > 0 /*&& n2 > 0*/ ) {
                if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information && ( !imaState.bShowConfigMode ) ) {
                    log.write( cc.info( "Loaded Main-net ERC20 ABI " ) + cc.attention( imaState.strCoinNameErc20_main_net ) + "\n" );
                    if ( n2 > 0 )
                        log.write( cc.info( "Loaded S-Chain  ERC20 ABI " ) + cc.attention( imaState.strCoinNameErc20_s_chain ) + "\n" );
                }
            } else {
                if ( n1 == 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                if ( n2 == 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
                    log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc20_main_net = null;
                imaState.joErc20_s_chain = null;
                imaState.strCoinNameErc20_main_net = "";
                imaState.strCoinNameErc20_s_chain = "";
                process.exit( 666 );
            }
        } else {
            if ( n1 == 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Main-net ERC20 JSON is invalid" ) + "\n" );
            if ( n2 == 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC20 JSON is invalid" ) + "\n" );
            imaState.joErc20_main_net = null;
            imaState.joErc20_s_chain = null;
            imaState.strCoinNameErc20_main_net = "";
            imaState.strCoinNameErc20_s_chain = "";
            process.exit( 666 );
        }
    } else { // if( imaState.strPathJsonErc20_main_net.length > 0 /*&& imaState.strPathJsonErc20_s_chain.length > 0*/ )
        if ( imaState.strPathJsonErc20_s_chain.length > 0 ) {
            var n1 = 0,
                n2 = 0;

            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC20 ABI from " ) + cc.info( imaState.strPathJsonErc20_s_chain ) + "\n" );
            imaState.joErc20_s_chain = imaUtils.jsonFileLoad( imaState.strPathJsonErc20_s_chain, null, true );
            n2 = Object.keys( imaState.joErc20_s_chain ).length;

            if ( n2 > 0 ) {
                imaState.strCoinNameErc20_s_chain = imaUtils.discover_in_json_coin_name( imaState.joErc20_s_chain );
                n2 = imaState.strCoinNameErc20_s_chain.length;
                if ( n2 > 0 )
                    log.write( cc.info( "Loaded S-Chain  ERC20 ABI " ) + cc.attention( imaState.strCoinNameErc20_s_chain ) + "\n" );
                else {
                    if ( n2 == 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
                        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "S-Chain ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                    imaState.joErc20_main_net = null;
                    imaState.joErc20_s_chain = null;
                    imaState.strCoinNameErc20_main_net = "";
                    imaState.strCoinNameErc20_s_chain = "";
                    process.exit( 667 );
                }
            }
        }
    }
    if ( n1 != 0 && n2 == 0 ) {
        if ( imaState.strAddrErc20_explicit.length == 0 ) {
            log.write( cc.fatal( "IMPORTANT NOTICE:" ) + " " + cc.error( "Both S-Chain ERC20 JSON and explicit ERC20 address are not specified" ) + "\n" );
        } else {
            log.write( cc.attention( "IMPORTANT NOTICE:" ) + " " + cc.note( "S-Chain ERC20 ABI will be auto-generated" ) + "\n" );
            imaState.strCoinNameErc20_s_chain = "" + imaState.strCoinNameErc20_main_net; // assume same
            imaState.joErc20_s_chain = JSON.parse( JSON.stringify( imaState.joErc20_main_net ) ); // clone
            imaState.joErc20_s_chain[ imaState.strCoinNameErc20_s_chain + "_address" ] = "" + imaState.strAddrErc20_explicit; // set explicit address
            if ( imaState.isRawTokenTransfer ) {
                imaState.isRawTokenTransfer = false;
                if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC20 raw transfer is force " ) + cc.success( "OFF" ) + "\n" );
            }
            // if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            //     log.write( cc.info("Auto-generated S-Chain ERC20 JSON is ") + cc.j(imaState.joErc20_s_chain) + "\n" );
        }
    } else {
        if ( n1 != 0 && n2 != 0) {
            if ( !imaState.isRawTokenTransfer ) {
                imaState.isRawTokenTransfer = imaState.isRawTokenTransfer_EXPLICIT; // true;
                if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC20 raw transfer is force " ) + cc.error( imaState.isRawTokenTransfer_EXPLICIT ? "ON" : "OFF" ) + "\n" );
            }
        }
    }
    //
    //
    //


    if ( IMA.verbose_get() > IMA.RV_VERBOSE.information || imaState.bShowConfigMode ) {
        print_about( true );
        ensure_have_value( "App path", __filename, false, true, null, ( x ) => {
            return cc.normal( x );
        } );
        ensure_have_value( "Verbose level", IMA.VERBOSE[ IMA.verbose_get() ], false, true, null, ( x ) => {
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
        if ( imaState.nTimeFrameSeconds > 0 ) {
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
        if ( imaState.strLogFilePath.length > 0 ) {
            ensure_have_value( "Log file path", imaState.strLogFilePath, false, true, null, ( x ) => {
                return cc.info( x );
            } );
            ensure_have_value( "Max size of log file path", imaState.nLogMaxSizeBeforeRotation, false, true, null, ( x ) => {
                return ( x <= 0 ) ? cc.warn( "unlimited" ) : cc.note( x );
            } );
            ensure_have_value( "Max rotated count of log files", imaState.nLogMaxFilesCount, false, true, null, ( x ) => {
                return ( x <= 1 ) ? cc.warn( "not set" ) : cc.note( x );
            } );
        }
        if ( imaState.strCoinNameErc721_main_net.length > 0 /*&& imaState.strCoinNameErc721_s_chain.length > 0*/ ) {
            ensure_have_value( "Loaded Main-net ERC721 ABI ", imaState.strCoinNameErc721_main_net, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Loaded S-Chain  ERC721 ABI ", imaState.strCoinNameErc721_s_chain, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "ERC721 tocken id ", imaState.idToken, false, true, null, ( x ) => {
                return cc.info( x );
            } );
            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "ERC721 raw transfer is " ) + cc.yn( imaState.isRawTokenTransfer ) + "\n" );
            log.write( cc.info( "ERC721 explicit S-Chain address is " ) + cc.attention( imaState.strAddrErc721_explicit ) + "\n" );
        }
        if ( imaState.strCoinNameErc20_main_net.length > 0 /*&& imaState.strCoinNameErc20_s_chain.length > 0*/ ) {
            ensure_have_value( "Loaded Main-net ERC20 ABI ", imaState.strCoinNameErc20_main_net, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Loaded S-Chain  ERC20 ABI ", imaState.strCoinNameErc20_s_chain, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Amount of tokens to transfer", imaState.nAmountOfToken, false, true, null, ( x ) => {
                return cc.info( x );
            } );
            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "ERC20 raw transfer is " ) + cc.yn( imaState.isRawTokenTransfer ) + "\n" );
            log.write( cc.info( "ERC20 explicit S-Chain address is " ) + cc.attention( imaState.strAddrErc20_explicit ) + "\n" );
        }
    }
    //
    //
    //
} // ima_common_init

module.exports = {
    "init": init,
    "print_about": print_about,
    "parse_command_line_argument": parse_command_line_argument,
    "verify_arg_with_non_empty_value": verify_arg_with_non_empty_value,
    "veryify_url_arg": veryify_url_arg,
    "veryify_int_arg": veryify_int_arg,
    "veryify_bool_arg": veryify_bool_arg,
    "veryify_arg_path_to_existing_file": veryify_arg_path_to_existing_file,
    "ensure_have_value": ensure_have_value,
    "find_node_index": find_node_index,
    "load_node_config": load_node_config,
    "parse": parse,
    "ima_common_init": ima_common_init
}; // module.exports
