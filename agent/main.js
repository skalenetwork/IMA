/*
# Notice: we need special truffle version: npm install -g truffle@4.1.13

#
#
// register: node ./main.js --register ........
// test invoke: node ./main.js --loop --time-framing=10 --time-gap=3 --period=2 --node-number=0 --nodes-count=2
node ./main.js --load-node-config=~/Work/SkaleExperimental/skaled-tests/single-node/run-skaled/config0.json --loop --time-framing=10 --time-gap=3 --period=2
*/

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0; // allow self-signed wss and https

//
//
// init very basics
const fs = require( "fs" );
const path = require( "path" );
const url = require( "url" );
const os = require( "os" );
const IMA = require( "../npms/skale-ima" );
IMA.verbose_set( IMA.verbose_parse( "info" ) );
const log = require( "../npms/skale-log/log.js" );
const cc = log.cc;
const w3mod = IMA.w3mod;
let rpcCall = require( "./rpc-call.js" );
rpcCall.init( cc, log );
let ethereumjs_tx = IMA.ethereumjs_tx;
let ethereumjs_wallet = IMA.ethereumjs_wallet;
let ethereumjs_util = IMA.ethereumjs_util;

const uuid = require( "uuid/v4" );
let child_process = require( "child_process" );
var shell = require( "shelljs" );
const {
    Keccak
} = require( "sha3" );

let g_bIsNeededCommonInit = true;
let g_bSignMessages = false; // use BLS message signing, turned on with --sign-messages
let g_joSChainNetworkInfo = null; // scanned S-Chain network description
let g_strPathBlsGlue = ""; // path to bls_glue app, nust have if --sign-messages specified
let g_strPathHashG1 = ""; // path to hash_g1 app, nust have if --sign-messages specified
let g_strPathBlsVerify = ""; // path to verify_bls app, optional, if specified then we will verify gathered BLS signature

// TO-DO: the next ABI JSON should contain main-net only contract info - S-chain contract addresses must be downloaded from S-chain
let joTrufflePublishResult_main_net = {};
let joTrufflePublishResult_s_chain = {};

let joErc20_main_net = null;
let joErc20_s_chain = null;
let g_str_addr_erc20_explicit = "";
let strCoinNameErc20_main_net = ""; // in-JSON coin name
let strCoinNameErc20_s_chain = ""; // in-JSON coin name

let joErc721_main_net = null;
let joErc721_s_chain = null;
let g_str_addr_erc721_explicit = "";
let strCoinNameErc721_main_net = ""; // in-JSON coin name
let strCoinNameErc721_s_chain = ""; // in-JSON coin name

// deposit_box_address           --> deposit_box_abi
// token_manager_address         --> token_manager_abi
// message_proxy_mainnet_address --> message_proxy_mainnet_abi
// message_proxy_chain_address   --> message_proxy_chain_abi

let g_strPathAbiJson_main_net = normalize_path( "../proxy/data/proxyMainnet.json" ); // "./abi_main_net.json"
let g_strPathAbiJson_s_chain = normalize_path( "../proxy/data/proxySchain.json" ); // "./abi_s_chain.json"

//
//
// init other basics

//
//
let g_bShowConfigMode = false; // true - just show configuratin values and exit
//
//

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

let g_str_url_main_net = ""; // example: "http://127.0.0.1:8545"
let g_str_url_s_chain = ""; // example: "http://127.0.0.1:2231"

let g_chain_id_main_net = "Mainnet"; // 0;
let g_chain_id_s_chain = "id-S-chain"; // 1;

let g_str_path_json_erc20_main_net = "";
let g_str_path_json_erc20_s_chain = "";

let g_str_path_json_erc721_main_net = "";
let g_str_path_json_erc721_s_chain = "";

//
////let g_joAccount_main_net = { "name": "Stan", "privateKey": "621761908cc4fba5f92e694e0e4a912aa9a12258a597a06783713a04610fad59", "address": fn_address_impl_ }; // "address": "0x6196d135CdDb9d73A0756C1E44b5b02B11acf594"
// let g_joAccount_main_net = { "name": "g3",   "privateKey": "23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc", "address": fn_address_impl_ }; // "address": "0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f"
// let g_joAccount_s_chain  = { "name": "Bob",  "privateKey": "80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e", "address": fn_address_impl_ }; // "address": "0x66c5a87f4a49DD75e970055A265E8dd5C3F8f852"
//
// let g_joAccount_main_net = { "name": "g2",    "privateKey": "39cb49d82f7e20ad26f2863f74de198f7d5be3aa9b3ec58fbd641950da30acd8", "address": fn_address_impl_ }; // "address": "0x6595b3d58c80db0cc6d50ca5e5f422e6134b07a8"
// let g_joAccount_s_chain  = { "name": "Alice", "privateKey": "1800d6337966f6410905a6bf9af370ac2f55c7428854d995cfa719e061ac0dca", "address": fn_address_impl_ }; // "address": "0x651054E818a0E022Bbb681Aa3b657386f20845F5"
//
// let g_joAccount_main_net = { "name": "g1",     "privateKey": "2a95a383114492b90a6eecbc355d7b63501ffb72ed39a788e48aa3c286eb526d", "address": fn_address_impl_ }; // "address": "0x12b907ebaea975ce4d5de010cdf680ad21dc4ca1"
// let g_joAccount_s_chain  = { "name": "Alex",   "privateKey": "d47f07804006486dbeba6b81e50fc93543657853a3d2f736d4fd68488ca94c17", "address": fn_address_impl_ }; // "address": "0x8e8311f4c4533f4C19363d6140e1D5FA16Aa4071"
//
let g_joAccount_main_net = {
    "privateKey": "",
    "address": fn_address_impl_
};
let g_joAccount_s_chain = {
    "privateKey": "",
    "address": fn_address_impl_
};
//

function fn_address_impl_( w3 ) {
    if ( this.address_ == undefined || this.address_ == null )
        this.address_ = "" + IMA.private_key_2_account_address( w3, this.privateKey );
    return this.address_;
}

let g_wei_amount = 0; // 1000000000000000000
let g_token_amount = 0;
let g_token_id = 0;
let g_isRawTokenTransfer = true;
let g_isRawTokenTransfer_EXPLICIT = false;

let g_nTransferBlockSizeM2S = 10;
let g_nTransferBlockSizeS2M = 10;
let g_nMaxTransactionsM2S = 0;
let g_nMaxTransactionsS2M = 0;

let g_nBlockAwaitDepthM2S = 0;
let g_nBlockAwaitDepthS2M = 0;
let g_nBlockAgeM2S = 0;
let g_nBlockAgeS2M = 0;

let g_nLoopPeriodSeconds = 10;

let g_nNodeNumber = 0; // S-Chain node number(zero based)
let g_nNodesCount = 1;
let g_nTimeFrameSeconds = 0; // 0-disable, 60-recommended
let g_nNextFrameGap = 10;

let g_arrActions = []; // array of actions to run

function replaceAll( str, find, replace ) {
    return str.replace( new RegExp( find, "g" ), replace );
}

function fileExists( strPath ) {
    try {
        if( fs.existsSync( strPath ) ) {
            var stats = fs.statSync( strPath );
            if( stats.isFile() )
                return true;
        }
    } catch( err ) {
    }
    return false;
}

function fileLoad( strPath, strDefault ) {
    strDefault = strDefault || "";
    if ( !fileExists( strPath ) )
        return strDefault;
    try {
        let s = fs.readFileSync( strPath );
        return s;
    } catch ( err ) {}
    return strDefault;
}

function fileSave( strPath, s ) {
    try {
        fs.writeFileSync( strPath, s );
        return true;
    } catch ( err ) {}
    return false;
}

function jsonFileLoad( strPath, joDefault ) {
    joDefault = joDefault || {};
    if ( !fileExists( strPath ) )
        return joDefault;
    try {
        let s = fs.readFileSync( strPath );
        let jo = JSON.parse( s );
        return jo;
    } catch ( err ) {}
    return joDefault;
}

function jsonFileSave( strPath, jo ) {
    try {
        let s = JSON.stringify( jo, null, 4 );
        fs.writeFileSync( strPath, s );
        return true;
    } catch ( err ) {}
    return false;
}


//
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// parse command line
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

function normalize_path( strPath ) {
    strPath = strPath.replace( /^~/, os.homedir() );
    strPath = path.normalize( strPath );
    strPath = path.resolve( strPath );
    return strPath;
}

function verify_arg_with_non_empty_value( joArg ) {
    if ( ( !joArg.value ) || joArg.value.length == 0 ) {
        console.log( cc.fatal( "Error:" ) + cc.error( " value of command line argument " ) + cc.info( joArg.name ) + cc.error( " must not be empty" ) );
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

let g_log_strFilePath = "",
    g_log_nMaxSizeBeforeRotation = -1,
    g_log_nMaxFilesCount = -1;
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
        console.log( soi + cc.debug( "--" ) + cc.bright( "id-main-net" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............" ) + cc.note( "Main-net" ) + cc.notice( " Ethereum " ) + cc.note( "network ID." ) );
        console.log( soi + cc.debug( "--" ) + cc.bright( "id-s-chain" ) + cc.sunny( "=" ) + cc.success( "number" ) + cc.debug( "............." ) + cc.note( "S-chain" ) + cc.notice( " Ethereum " ) + cc.note( "network ID." ) );
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
        g_str_url_main_net = joArg.value;
        continue;
    }
    if ( joArg.name == "url-s-chain" ) {
        veryify_url_arg( joArg );
        g_str_url_s_chain = joArg.value;
        continue;
    }
    if ( joArg.name == "id-s-chain" ) {
        verify_arg_with_non_empty_value( joArg );
        g_chain_id_s_chain = joArg.value;
        continue;
    }
    if ( joArg.name == "id-main-net" ) {
        verify_arg_with_non_empty_value( joArg );
        g_chain_id_main_net = joArg.value;
        continue;
    }
    /**/
    if ( joArg.name == "address-main-net" ) {
        verify_arg_with_non_empty_value( joArg );
        g_joAccount_main_net.address_ = joArg.value;
        continue;
    }
    /**/
    if ( joArg.name == "address-s-chain" ) {
        verify_arg_with_non_empty_value( joArg );
        g_joAccount_s_chain.address_ = joArg.value;
        continue;
    }
    if ( joArg.name == "abi-main-net" ) {
        veryify_arg_path_to_existing_file( joArg );
        g_strPathAbiJson_main_net = normalize_path( joArg.value );
        continue;
    }
    if ( joArg.name == "abi-s-chain" ) {
        veryify_arg_path_to_existing_file( joArg );
        g_strPathAbiJson_s_chain = normalize_path( joArg.value );
        continue;
    }
    //
    //
    if ( joArg.name == "erc721-main-net" ) {
        veryify_arg_path_to_existing_file( joArg );
        g_str_path_json_erc721_main_net = normalize_path( joArg.value );
        continue;
    }
    if ( joArg.name == "erc721-s-chain" ) {
        veryify_arg_path_to_existing_file( joArg );
        g_str_path_json_erc721_s_chain = normalize_path( joArg.value );
        continue;
    }
    if ( joArg.name == "addr-erc721-s-chain" ) {
        verify_arg_with_non_empty_value( joArg );
        g_str_addr_erc721_explicit = joArg.value;
        continue;
    }
    //
    //
    if ( joArg.name == "erc20-main-net" ) {
        veryify_arg_path_to_existing_file( joArg );
        g_str_path_json_erc20_main_net = normalize_path( joArg.value );
        continue;
    }
    if ( joArg.name == "erc20-s-chain" ) {
        veryify_arg_path_to_existing_file( joArg );
        g_str_path_json_erc20_s_chain = normalize_path( joArg.value );
        continue;
    }
    if ( joArg.name == "addr-erc20-s-chain" ) {
        verify_arg_with_non_empty_value( joArg );
        g_str_addr_erc20_explicit = joArg.value;
        continue;
    }
    //
    //
    if ( joArg.name == "key-main-net" ) {
        verify_arg_with_non_empty_value( joArg );
        g_joAccount_main_net.privateKey = joArg.value;
        continue;
    }
    if ( joArg.name == "key-s-chain" ) {
        verify_arg_with_non_empty_value( joArg );
        g_joAccount_s_chain.privateKey = joArg.value;
        continue;
    }
    if ( joArg.name == "wei" ) {
        verify_arg_with_non_empty_value( joArg );
        g_wei_amount = joArg.value;
        continue;
    }
    if ( joArg.name == "babbage" ) {
        verify_arg_with_non_empty_value( joArg );
        g_wei_amount = joArg.value * 1000;
        continue;
    }
    if ( joArg.name == "lovelace" ) {
        verify_arg_with_non_empty_value( joArg );
        g_wei_amount = joArg.value * 1000 * 1000;
        continue;
    }
    if ( joArg.name == "shannon" ) {
        verify_arg_with_non_empty_value( joArg );
        g_wei_amount = joArg.value * 1000 * 1000 * 1000;
        continue;
    }
    if ( joArg.name == "szabo" ) {
        verify_arg_with_non_empty_value( joArg );
        g_wei_amount = joArg.value * 1000 * 1000 * 1000 * 1000;
        continue;
    }
    if ( joArg.name == "finney" ) {
        verify_arg_with_non_empty_value( joArg );
        g_wei_amount = joArg.value * 1000 * 1000 * 1000 * 1000 * 1000;
        continue;
    }
    if ( joArg.name == "ether" ) {
        verify_arg_with_non_empty_value( joArg );
        g_wei_amount = joArg.value * 1000 * 1000 * 1000 * 1000 * 1000 * 1000;
        continue;
    }
    if ( joArg.name == "amount" ) {
        verify_arg_with_non_empty_value( joArg );
        g_token_amount = joArg.value;
        continue;
    }
    if ( joArg.name == "tid" ) {
        verify_arg_with_non_empty_value( joArg );
        g_token_id = joArg.value;
        continue;
    }
    if ( joArg.name == "raw-transfer" ) {
        g_isRawTokenTransfer = g_isRawTokenTransfer_EXPLICIT = true;
        continue;
    }
    if ( joArg.name == "no-raw-transfer" ) {
        g_isRawTokenTransfer = g_isRawTokenTransfer_EXPLICIT = false;
        continue;
    }
    if ( joArg.name == "show-config" ) {
        g_bShowConfigMode = true;
        continue;
    }
    if ( joArg.name == "register" ) {
        g_arrActions.push( {
            "name": "Full registration(all steps)",
            "fn": async function() {
                return await register_all();
            }
        } );
        continue;
    }
    if ( joArg.name == "register1" ) {
        g_arrActions.push( {
            "name": "Registration step 1, register S-Chain on Main-net",
            "fn": async function() {
                return await register_step1();
            }
        } );
        continue;
    }
    if ( joArg.name == "register2" ) {
        g_arrActions.push( {
            "name": "Registration step 2, register S-Chain in deposit box",
            "fn": async function() {
                return await register_step2();
            }
        } );
        continue;
    }
    if ( joArg.name == "register3" ) {
        g_arrActions.push( {
            "name": "Registration step 3, register Main-net deposit box on S-Chain",
            "fn": async function() {
                return await register_step3();
            }
        } );
        continue;
    }
    if ( joArg.name == "check-registration" ) {
        g_arrActions.push( {
            "name": "Full registration status check(all steps)",
            "fn": async function() {
                const b = await check_registeration_all();
                const nExitCode = b ? 0 : 1; // 0 - OKay - registered; non-zero -  not registered or error
                log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
                process.exit( nExitCode );
            }
        } );
        continue;
    }
    if ( joArg.name == "check-registration1" ) {
        g_arrActions.push( {
            "name": "Registration status check for step 1, register S-Chain on Main-net",
            "fn": async function() {
                const b = await check_registeration_step1();
                const nExitCode = b ? 0 : 1; // 0 - OKay - registered; non-zero -  not registered or error
                log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
                process.exit( nExitCode );
            }
        } );
        continue;
    }
    if ( joArg.name == "check-registration2" ) {
        g_arrActions.push( {
            "name": "Registration status check step 2, register S-Chain in deposit box",
            "fn": async function() {
                const b = await check_registeration_step2();
                const nExitCode = b ? 0 : 1; // 0 - OKay - registered; non-zero -  not registered or error
                log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
                process.exit( nExitCode );
            }
        } );
        continue;
    }
    if ( joArg.name == "check-registration3" ) {
        g_arrActions.push( {
            "name": "Registration status check step 3, register Main-net deposit box on S-Chain",
            "fn": async function() {
                const b = await check_registeration_step3();
                const nExitCode = b ? 0 : 1; // 0 - OKay - registered; non-zero -  not registered or error
                log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
                process.exit( nExitCode );
            }
        } );
        continue;
    }
    if ( joArg.name == "m2s-payment" ) {
        g_arrActions.push( {
            "name": "one M->S single payment",
            "fn": async function() {
                if ( strCoinNameErc721_main_net.length > 0 /*&& strCoinNameErc721_s_chain.length > 0*/ ) {
                    // ERC721 payment
                    log.write( cc.info( "one M->S single ERC721 payment: " ) + cc.sunny( g_token_id ) + "\n" ); // just print value
                    return await IMA.do_erc721_payment_from_main_net(
                        g_w3_main_net,
                        g_w3_s_chain,
                        g_joAccount_main_net,
                        g_joAccount_s_chain,
                        g_jo_deposit_box, // only main net
                        g_chain_id_s_chain,
                        g_token_id, // which ERC721 token id to send
                        g_jo_token_manager, // only s-chain
                        strCoinNameErc721_main_net,
                        joErc721_main_net,
                        strCoinNameErc721_s_chain,
                        joErc721_s_chain,
                        g_isRawTokenTransfer
                    );
                }
                if ( strCoinNameErc20_main_net.length > 0 /*&& strCoinNameErc20_s_chain.length > 0*/ ) {
                    // ERC20 payment
                    log.write( cc.info( "one M->S single ERC20 payment: " ) + cc.sunny( g_token_amount ) + "\n" ); // just print value
                    return await IMA.do_erc20_payment_from_main_net(
                        g_w3_main_net,
                        g_w3_s_chain,
                        g_joAccount_main_net,
                        g_joAccount_s_chain,
                        g_jo_deposit_box, // only main net
                        g_jo_message_proxy_main_net, // for checking logs
                        g_jo_lock_and_data_main_net, // for checking logs
                        g_chain_id_s_chain,
                        g_token_amount, // how much ERC20 tokens to send
                        g_jo_token_manager, // only s-chain
                        strCoinNameErc20_main_net,
                        joErc20_main_net,
                        strCoinNameErc20_s_chain,
                        joErc20_s_chain,
                        g_isRawTokenTransfer
                    );
                }
                // ETH payment
                log.write( cc.info( "one M->S single ETH payment: " ) + cc.sunny( g_wei_amount ) + "\n" ); // just print value
                return await IMA.do_eth_payment_from_main_net(
                    g_w3_main_net,
                    g_joAccount_main_net,
                    g_joAccount_s_chain,
                    g_jo_deposit_box, // only main net
                    g_jo_message_proxy_main_net, // for checking logs
                    g_jo_lock_and_data_main_net, // for checking logs
                    g_chain_id_s_chain,
                    g_wei_amount // how much WEI money to send
                );
            }
        } );
        continue;
    }
    if ( joArg.name == "s2m-payment" ) {
        g_arrActions.push( {
            "name": "one S->M single payment",
            "fn": async function() {
                if ( strCoinNameErc721_s_chain.length > 0 ) {
                    // ERC721 payment
                    log.write( cc.info( "one S->M single ERC721 payment: " ) + cc.sunny( g_token_id ) + "\n" ); // just print value
                    return await IMA.do_erc721_payment_from_s_chain(
                        g_w3_main_net,
                        g_w3_s_chain,
                        g_joAccount_s_chain,
                        g_joAccount_main_net,
                        g_jo_token_manager, // only s-chain
                        g_jo_deposit_box, // only main net
                        g_token_id, // which ERC721 token id to send
                        strCoinNameErc721_main_net,
                        joErc721_main_net,
                        strCoinNameErc721_s_chain,
                        joErc721_s_chain,
                        g_isRawTokenTransfer
                    );
                }
                if ( strCoinNameErc20_s_chain.length > 0 ) {
                    // ERC20 payment
                    log.write( cc.info( "one S->M single ERC20 payment: " ) + cc.sunny( g_token_amount ) + "\n" ); // just print value
                    return await IMA.do_erc20_payment_from_s_chain(
                        g_w3_main_net,
                        g_w3_s_chain,
                        g_joAccount_s_chain,
                        g_joAccount_main_net,
                        g_jo_token_manager, // only s-chain
                        g_jo_deposit_box, // only main net
                        g_token_amount, // how ERC20 tokens money to send
                        strCoinNameErc20_main_net,
                        joErc20_main_net,
                        strCoinNameErc20_s_chain,
                        joErc20_s_chain,
                        g_isRawTokenTransfer
                    );
                }
                // ETH payment
                log.write( cc.info( "one S->M single ETH payment: " ) + cc.sunny( g_wei_amount ) + "\n" ); // just print value
                return await IMA.do_eth_payment_from_s_chain(
                    g_w3_s_chain,
                    g_joAccount_s_chain,
                    g_joAccount_main_net,
                    g_jo_token_manager, // only s-chain
                    g_wei_amount // how much WEI money to send
                );
            }
        } );
        continue;
    }
    if ( joArg.name == "s2m-receive" ) {
        g_arrActions.push( {
            "name": "receive one S->M single ETH payment",
            "fn": async function() {
                log.write( cc.info( "receive one S->M single ETH payment: " ) + "\n" ); // just print value
                return await IMA.receive_eth_payment_from_s_chain_on_main_net(
                    g_w3_main_net,
                    g_joAccount_main_net,
                    g_jo_lock_and_data_main_net
                );
            }
        } );
        continue;
    }
    if ( joArg.name == "s2m-view" ) {
        g_arrActions.push( {
            "name": "view one S->M single ETH payment",
            "fn": async function() {
                log.write( cc.info( "view one S->M single ETH payment: " ) + "\n" ); // just print value
                let xWei = await IMA.view_eth_payment_from_s_chain_on_main_net(
                    g_w3_main_net,
                    g_joAccount_main_net,
                    g_jo_lock_and_data_main_net
                );
                if ( xWei === null || xWei === undefined )
                    return false;
                let xEth = g_w3_main_net.utils.fromWei( xWei, "ether" );
                log.write( cc.success( "Main-net user can receive: " ) + cc.attention( xWei ) + cc.success( " wei = " ) + cc.attention( xEth ) + cc.success( " eth" ) + "\n" );
                return true;
            }
        } );
        continue;
    }
    if ( joArg.name == "m2s-transfer" ) {
        g_arrActions.push( {
            "name": "single M->S transfer loop",
            "fn": async function() {
                return await IMA.do_transfer( // main-net --> s-chain
                    /**/
                    g_w3_main_net,
                    g_jo_message_proxy_main_net,
                    g_joAccount_main_net,
                    g_w3_s_chain,
                    g_jo_message_proxy_s_chain,
                    /**/
                    g_joAccount_s_chain,
                    g_chain_id_main_net,
                    g_chain_id_s_chain,
                    g_nTransferBlockSizeM2S,
                    g_nMaxTransactionsM2S,
                    g_nBlockAwaitDepthM2S,
                    g_nBlockAgeM2S,
                    null // fn_sign_messages
                );
            }
        } );
        continue;
    }
    if ( joArg.name == "s2m-transfer" ) {
        g_arrActions.push( {
            "name": "single S->M transfer loop",
            "fn": async function() {
                return await IMA.do_transfer( // s-chain --> main-net
                    /**/
                    g_w3_s_chain,
                    g_jo_message_proxy_s_chain,
                    g_joAccount_s_chain,
                    g_w3_main_net,
                    g_jo_message_proxy_main_net,
                    /**/
                    g_joAccount_main_net,
                    g_chain_id_s_chain,
                    g_chain_id_main_net,
                    g_nTransferBlockSizeS2M,
                    g_nMaxTransactionsS2M,
                    g_nBlockAwaitDepthS2M,
                    g_nBlockAgeS2M,
                    do_sign_messages // fn_sign_messages
                );
            }
        } );
        continue;
    }
    if ( joArg.name == "transfer" ) {
        g_arrActions.push( {
            "name": "Single M<->S transfer loop iteration",
            "fn": async function() {
                return await single_transfer_loop();
            }
        } );
        continue;
    }
    if ( joArg.name == "loop" ) {
        g_arrActions.push( {
            "name": "M<->S transfer loop",
            "fn": async function() {
                if( ! await check_registeration_step1() ) {
                    if( ! await register_step1() )
                        return false;
                }
                if( ! await check_registeration_step2() ) {
                    if( ! await register_step2() )
                        return false;
                }
                if( ! await check_registeration_step3() ) {
                    if( ! await register_step3() )
                        return false;
                }
                return await run_transfer_loop();
            }
        } );
        continue;
    }
    if ( joArg.name == "load-node-config" ) {
        verify_arg_with_non_empty_value( joArg );
        load_node_config( joArg.value );
        continue;
    }
    if ( joArg.name == "m2s-transfer-block-size" ) {
        veryify_int_arg( joArg );
        g_nTransferBlockSizeM2S = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "s2m-transfer-block-size" ) {
        veryify_int_arg( joArg );
        g_nTransferBlockSizeS2M = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "transfer-block-size" ) {
        veryify_int_arg( joArg );
        g_nTransferBlockSizeM2S = g_nTransferBlockSizeS2M = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "m2s-max-transactions" ) {
        veryify_int_arg( joArg );
        g_nMaxTransactionsM2S = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "s2m-max-transactions" ) {
        veryify_int_arg( joArg );
        g_nMaxTransactionsS2M = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "max-transactions" ) {
        veryify_int_arg( joArg );
        g_nMaxTransactionsM2S = g_nMaxTransactionsS2M = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "m2s-await-blocks" ) {
        veryify_int_arg( joArg );
        g_nBlockAwaitDepthM2S = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "s2m-await-blocks" ) {
        veryify_int_arg( joArg );
        g_nBlockAwaitDepthS2M = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "await-blocks" ) {
        veryify_int_arg( joArg );
        g_nBlockAwaitDepthM2S = g_nBlockAwaitDepthS2M = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "m2s-await-time" ) {
        veryify_int_arg( joArg );
        g_nBlockAgeM2S = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "s2m-await-time" ) {
        veryify_int_arg( joArg );
        g_nBlockAgeS2M = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "await-time" ) {
        veryify_int_arg( joArg );
        g_nBlockAgeM2S = g_nBlockAgeS2M = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "period" ) {
        veryify_int_arg( joArg );
        g_nLoopPeriodSeconds = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "node-number" ) {
        veryify_int_arg( joArg );
        g_nNodeNumber = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "nodes-count" ) {
        veryify_int_arg( joArg );
        g_nNodesCount = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "time-framing" ) {
        veryify_int_arg( joArg );
        g_nTimeFrameSeconds = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "time-gap" ) {
        veryify_int_arg( joArg );
        g_nNextFrameGap = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "log-size" ) {
        veryify_int_arg( joArg );
        g_log_nMaxSizeBeforeRotation = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "log-files" ) {
        veryify_int_arg( joArg );
        g_log_nMaxFilesCount = parseInt( joArg.value );
        continue;
    }
    if ( joArg.name == "log" ) {
        verify_arg_with_non_empty_value( joArg );
        g_log_strFilePath = "" + joArg.value;
        continue;
    }
    if ( joArg.name == "sign-messages" ) {
        g_bSignMessages = true;
        continue;
    }
    if ( joArg.name == "bls-glue" ) {
        veryify_arg_path_to_existing_file( joArg );
        g_strPathBlsGlue = "" + joArg.value;
        continue;
    }
    if ( joArg.name == "hash-g1" ) {
        veryify_arg_path_to_existing_file( joArg );
        g_strPathHashG1 = "" + joArg.value;
        continue;
    }
    if ( joArg.name == "bls-verify" ) {
        veryify_arg_path_to_existing_file( joArg );
        g_strPathBlsVerify = "" + joArg.value;
        continue;
    }
    if ( joArg.name == "browse-s-chain" ) {
        g_bIsNeededCommonInit = false;
        g_arrActions.push( {
            "name": "Brows S-Chain network",
            "fn": async function() {
                let strLogPrefix = cc.info("S Browse:") + " ";
                if( g_str_url_s_chain.length == 0 ) {
                    console.log( cc.fatal( "Error:" ) + cc.error( " missing S-Chain URL, please specify " ) + cc.info( "url-s-chain" ) );
                    process.exit( 501 );
                }
                log.write( strLogPrefix + cc.normal( "Downloading S-Chain network information " )  + cc.normal( "..." ) + "\n" ); // just print value
                //
                await rpcCall.create( g_str_url_s_chain, async function( joCall, err ) {
                    if( err ) {
                        console.log( cc.fatal( "Error:" ) + cc.error( " JSON RPC call to S-Chain failed" ) );
                        process.exit( 1 );
                    }
                    await joCall.call( {
                        "method": "skale_nodesRpcInfo",
                        "params": { }
                    }, async function( joIn, joOut, err ) {
                        if( err ) {
                            console.log( cc.fatal( "Error:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) );
                            process.exit( 1 );
                        }
                        log.write( strLogPrefix + cc.normal( "S-Chain network information: " )  + cc.j( joOut.result ) + "\n" );
                        let nCountReceivedImaDescriptions = 0;
                        let jarrNodes = joOut.result.network;
                        for( let i = 0; i < jarrNodes.length; ++ i ) {
                            let joNode = jarrNodes[ i ];
                            let strNodeURL = compose_schain_node_url( joNode );
                            await rpcCall.create( strNodeURL, async function( joCall, err ) {
                                if( err ) {
                                    console.log( cc.fatal( "Error:" ) + cc.error( " JSON RPC call to S-Chain failed" ) );
                                    process.exit( 1 );
                                }
                                await joCall.call( {
                                    "method": "skale_imaInfo",
                                    "params": { }
                                }, function( joIn, joOut, err ) {
                                    ++ nCountReceivedImaDescriptions;
                                    if( err ) {
                                        console.log( cc.fatal( "Error:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) );
                                        process.exit( 1 );
                                    }
                                    log.write( strLogPrefix + cc.normal( "Node ") + cc.info(joNode.nodeID) + cc.normal(" IMA information: " )  + cc.j( joOut.result ) + "\n" );
                                    //process.exit( 0 );
                                } );
                            } );
                        }
                        //process.exit( 0 );
                        let iv = setInterval( function() {
                            if( nCountReceivedImaDescriptions == jarrNodes.length ) {
                                clearInterval( iv );
                                process.exit( 0 );
                            }
                        }, 100 );
                    } );
                } );
                return true;
            }
        } );
        continue;
    }
    console.log( cc.fatal( "Error:" ) + cc.error( " unkonwn command line argument " ) + cc.info( joArg.name ) );
    return 666;
}


function compose_schain_node_url( joNode ) {
    if( "ip6" in joNode && typeof joNode.ip6 == "string" && joNode.ip6.length > 0 ) {
        if( "wssRpcPort6" in joNode && typeof joNode.wssRpcPort6 == "number" && joNode.wssRpcPort6 > 0 )
            return "wss://[" + joNode.ip6 + "]:" + joNode.wssRpcPort6;
        if( "wsRpcPort6" in joNode && typeof joNode.wsRpcPort6 == "number" && joNode.wsRpcPort6 > 0 )
            return "ws://[" + joNode.ip6 + "]:" + joNode.wsRpcPort6;
        if( "httpsRpcPort6" in joNode && typeof joNode.httpsRpcPort6 == "number" && joNode.httpsRpcPort6 > 0 )
            return "https://[" + joNode.ip6 + "]:" + joNode.httpsRpcPort6;
        if( "httpRpcPort6" in joNode && typeof joNode.httpRpcPort6 == "number" && joNode.httpRpcPort6 > 0 )
            return "http://[" + joNode.ip6 + "]:" + joNode.httpRpcPort6;
    }
    if( "ip" in joNode && typeof joNode.ip == "string" && joNode.ip.length > 0 ) {
        if( "wssRpcPort" in joNode && typeof joNode.wssRpcPort == "number" && joNode.wssRpcPort > 0 )
            return "wss://" + joNode.ip + ":" + joNode.wssRpcPort;
        if( "wsRpcPort" in joNode && typeof joNode.wsRpcPort == "number" && joNode.wsRpcPort > 0 )
            return "ws://" + joNode.ip + ":" + joNode.wsRpcPort;
        if( "httpsRpcPort" in joNode && typeof joNode.httpsRpcPort == "number" && joNode.httpsRpcPort > 0 )
            return "https://" + joNode.ip + ":" + joNode.httpsRpcPort;
        if( "httpRpcPort" in joNode && typeof joNode.httpRpcPort == "number" && joNode.httpRpcPort > 0 )
            return "http://" + joNode.ip + ":" + joNode.httpRpcPort;
    }
    return "";
}

if ( g_log_strFilePath.length > 0 ) {
    log.write( cc.debug( "Will print message to file " ) + cc.info( g_log_strFilePath ) + "\n" );
    log.add( g_log_strFilePath, g_log_nMaxSizeBeforeRotation, g_log_nMaxFilesCount );
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
        console.log( cc.fatal( "Error:" ) + cc.error( " missing value for " ) + fnNameColorizer( name ) );
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

function load_json( strPath ) {
    try {
        log.write( cc.normal( "Will load JSON file " ) + cc.info( strPath ) + cc.normal( "..." ) + "\n" ); // just print value
        var strContent = fs.readFileSync( strPath, "utf8" );
        log.write( cc.normal( "Did loaded content JSON file " ) + cc.info( strPath ) + cc.normal( ", will parse it..." ) + "\n" ); // just print value
        var jo = JSON.parse( strContent );
        return jo;
    } catch( err ) {
        console.log( cc.fatal( "Error:" ) + cc.error( "loading  JSON file " ) + cc.info( strPath ) + cc.error(": ") + cc.warn(err) );
    }
    return null;
}

function discover_in_json_coin_name( jo ) {
    if ( typeof jo !== "object" )
        return "";
    var arrKeys = Object.keys( jo ),
        s1 = "",
        s2 = "";
    var i, cnt = arrKeys.length,
        j;
    for ( i = 0; i < cnt; ++i ) {
        if ( s1.length > 0 && s2.length > 0 )
            break;
        var k = arrKeys[ i ];
        j = k.indexOf( "_address" )
        if ( j > 0 ) {
            s1 = k.substring( 0, j );
            continue;
        }
        j = k.indexOf( "_abi" )
        if ( j > 0 ) {
            s2 = k.substring( 0, j );
            continue;
        }
    }
    if ( s1.length == 0 || s2.length == 0 )
        return "";
    if ( s1 !== s2 )
        return "";
    return s1;
}

//
//
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
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
        strPath = normalize_path( strPath );
        //
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Loading values from S-Chain configuraton JSON file " ) + cc.note( strPath ) + cc.debug( "..." ) + "\n" );
        var strJsonSChainNodeConfiguration = fs.readFileSync( strPath, "utf8" );
        var joSChainNodeConfiguration = JSON.parse( strJsonSChainNodeConfiguration );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "S-Chain configuraton JSON: " ) + cc.j( joSChainNodeConfiguration ) + "\n" );
        //
        g_nNodeNumber = find_node_index( joSChainNodeConfiguration );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "....from S-Chain configuraton JSON file...." ) + cc.notice( "this node index" ) + cc.debug( " is " ) + cc.info( g_nNodeNumber ) + "\n" );
        g_nNodesCount = joSChainNodeConfiguration.skaleConfig.sChain.nodes.length;
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "....from S-Chain configuraton JSON file...." ) + cc.notice( "nodes count" ) + cc.debug( " is " ) + cc.info( g_nNodesCount ) + "\n" );
        //
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Done" ) + cc.debug( " loading values from S-Chain configuraton JSON file " ) + cc.note( strPath ) + cc.debug( "." ) + "\n" );
    } catch ( e ) {
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "Exception in load_node_config():" ) + cc.error( e ) + "\n" );
    }
}

//
//
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
function check_time_framing( d ) {
    try {
        if ( g_nTimeFrameSeconds <= 0 || g_nNodesCount <= 1 )
            return true; // time framing is disabled
        if ( d = null || d == undefined )
            d = new Date(); // now
        var nUtcUnixTimeStamp = Math.floor( d.valueOf() / 1000 ); // Unix UTC timestamp, see https://stackoverflow.com/questions/9756120/how-do-i-get-a-utc-timestamp-in-javascript
        var nSecondsRangeForAllSChains = g_nTimeFrameSeconds * g_nNodesCount;
        var nMod = Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
        var nActiveNodeFrameIndex = Math.floor( nMod / g_nTimeFrameSeconds );
        var bSkip = ( nActiveNodeFrameIndex != g_nNodeNumber ) ? true : false,
            bInsideGap = false;
        if ( !bSkip ) {
            var nRangeStart = nUtcUnixTimeStamp - Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
            var nFrameStart = nRangeStart + g_nNodeNumber * g_nTimeFrameSeconds;
            var nGapStart = nFrameStart + g_nTimeFrameSeconds - g_nNextFrameGap;
            if ( nUtcUnixTimeStamp >= nGapStart ) {
                bSkip = true;
                bInsideGap = true;
            }
        }
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.trace )
            log.write(
                "\n" +
                cc.info( "Unix UTC time stamp" ) + cc.debug( "........" ) + cc.notice( nUtcUnixTimeStamp ) + "\n" +
                cc.info( "All Chains Range" ) + cc.debug( "..........." ) + cc.notice( nSecondsRangeForAllSChains ) + "\n" +
                cc.info( "S-Chain Range Mod" ) + cc.debug( ".........." ) + cc.notice( nMod ) + "\n" +
                cc.info( "Active Node Frame Index" ) + cc.debug( "...." ) + cc.notice( nActiveNodeFrameIndex ) + "\n" +
                cc.info( "Testing Frame Index" ) + cc.debug( "........" ) + cc.notice( g_nNodeNumber ) + "\n" +
                cc.info( "Is skip" ) + cc.debug( "...................." ) + cc.yn( bSkip ) + "\n" +
                cc.info( "Is inside gap" ) + cc.debug( ".............." ) + cc.yn( bInsideGap ) + "\n"
            );
        if ( bSkip )
            return false;
    } catch ( e ) {
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.fatal )
            log.write( cc.fatal( "Exception in check_time_framing():" ) + cc.error( e ) + "\n" );
    }
    return true;
}


//
//
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//

function check_key_exist_in_abi( strName, strFile, joABI, strKey ) {
    try {
        if ( strKey in joABI )
            return;
    } catch( err ) {
    }
    log.write( cc.fatal( "FATAL:" ) + cc.error( "Loaded " ) + cc.warning( strName ) + cc.error( " ABI JSON file " ) + cc.info( strFile ) + cc.error( " does not contain needed key " ) + cc.warning( strKey ) + "\n" );
    process.exit( 123 );
}

function check_keys_exist_in_abi( strName, strFile, joABI, arrKeys ) {
    var cnt = arrKeys.length;
    for ( var i = 0; i < cnt; ++i ) {
        var strKey = arrKeys[ i ];
        check_key_exist_in_abi( strName, strFile, joABI, strKey );
    }
}

let g_w3http_main_net = null;
let g_w3_main_net = null;

let g_w3http_s_chain = null;
let g_w3_s_chain = null;

let g_jo_deposit_box = null; // only main net
let g_jo_token_manager = null; // only s-chain
let g_jo_message_proxy_main_net = null;
let g_jo_message_proxy_s_chain = null;
let g_jo_lock_and_data_main_net = null;
let g_jo_lock_and_data_s_chain = null;
// let g_eth_erc721 = null; // only s-chain
let g_eth_erc20 = null; // only s-chain

function common_init() {
    joTrufflePublishResult_main_net = load_json( g_strPathAbiJson_main_net );
    joTrufflePublishResult_s_chain = load_json( g_strPathAbiJson_s_chain );

    check_keys_exist_in_abi( "main-net", g_strPathAbiJson_main_net, joTrufflePublishResult_main_net, [ "deposit_box_abi", "deposit_box_address", "message_proxy_mainnet_abi", "message_proxy_mainnet_address" ] );
    check_keys_exist_in_abi( "S-Chain", g_strPathAbiJson_s_chain, joTrufflePublishResult_s_chain, [ "token_manager_abi", "token_manager_address", "message_proxy_chain_abi", "message_proxy_chain_address" ] );

    // deposit_box_address           --> deposit_box_abi
    // token_manager_address         --> token_manager_abi
    // message_proxy_mainnet_address --> message_proxy_mainnet_abi
    // message_proxy_chain_address   --> message_proxy_chain_abi

    if ( g_str_url_main_net.length == 0 ) {
        log.write( cc.fatal( "FATAL:" ) + cc.error( "Missing " ) + cc.warning( "Main-net" ) + cc.error( " URL in command line arguments" ) + "\n" );
        process.exit( 501 );
    }
    if ( g_str_url_s_chain.length == 0 ) {
        log.write( cc.fatal( "FATAL:" ) + cc.error( "Missing " ) + cc.warning( "S-Chain" ) + cc.error( " URL in command line arguments" ) + "\n" );
        process.exit( 501 );
    }

    g_w3http_main_net = new w3mod.providers.HttpProvider( g_str_url_main_net );
    g_w3_main_net = new w3mod( g_w3http_main_net );

    g_w3http_s_chain = new w3mod.providers.HttpProvider( g_str_url_s_chain );
    g_w3_s_chain = new w3mod( g_w3http_s_chain );

    g_jo_deposit_box = new g_w3_main_net.eth.Contract( joTrufflePublishResult_main_net.deposit_box_abi, joTrufflePublishResult_main_net.deposit_box_address ); // only main net
    g_jo_token_manager = new g_w3_s_chain.eth.Contract( joTrufflePublishResult_s_chain.token_manager_abi, joTrufflePublishResult_s_chain.token_manager_address ); // only s-chain
    g_jo_message_proxy_main_net = new g_w3_main_net.eth.Contract( joTrufflePublishResult_main_net.message_proxy_mainnet_abi, joTrufflePublishResult_main_net.message_proxy_mainnet_address );
    g_jo_message_proxy_s_chain = new g_w3_s_chain.eth.Contract( joTrufflePublishResult_s_chain.message_proxy_chain_abi, joTrufflePublishResult_s_chain.message_proxy_chain_address );
    g_jo_lock_and_data_main_net = new g_w3_main_net.eth.Contract( joTrufflePublishResult_main_net.lock_and_data_for_mainnet_abi, joTrufflePublishResult_main_net.lock_and_data_for_mainnet_address );
    g_jo_lock_and_data_s_chain = new g_w3_s_chain.eth.Contract( joTrufflePublishResult_s_chain.lock_and_data_for_schain_abi, joTrufflePublishResult_s_chain.lock_and_data_for_schain_address );
    // g_eth_erc721 = new g_w3_s_chain.eth.Contract( joTrufflePublishResult_s_chain.eth_erc721_abi, joTrufflePublishResult_s_chain.eth_erc721_address ); // only s-chain
    g_eth_erc20 = new g_w3_s_chain.eth.Contract( joTrufflePublishResult_s_chain.eth_erc20_abi, joTrufflePublishResult_s_chain.eth_erc20_address ); // only s-chain

    //
    //
    //
    if ( g_str_path_json_erc721_main_net.length > 0 /*&& g_str_path_json_erc721_s_chain.length > 0*/ ) {
        var n1 = 0,
            n2 = 0;
        if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading Main-net ERC721 ABI from " ) + cc.info( g_str_path_json_erc721_main_net ) + "\n" );
        joErc721_main_net = load_json( g_str_path_json_erc721_main_net );
        n1 = Object.keys( joErc721_main_net ).length;
        if ( g_str_path_json_erc721_s_chain.length > 0 ) {
            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC721 ABI from " ) + cc.info( g_str_path_json_erc721_s_chain ) + "\n" );
            joErc721_s_chain = load_json( g_str_path_json_erc721_s_chain );
            n2 = Object.keys( joErc721_s_chain ).length;
        }
        if ( n1 > 0 /*&& n2 > 0*/ ) {
            strCoinNameErc721_main_net = discover_in_json_coin_name( joErc721_main_net );
            if ( n2 > 0 )
                strCoinNameErc721_s_chain = discover_in_json_coin_name( joErc721_s_chain );
            n1 = strCoinNameErc721_main_net.length;
            if ( n2 > 0 )
                n2 = strCoinNameErc721_s_chain.length;
            if ( n1 > 0 /*&& n2 > 0*/ ) {
                if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information && ( !g_bShowConfigMode ) ) {
                    log.write( cc.info( "Loaded Main-net ERC721 ABI " ) + cc.attention( strCoinNameErc721_main_net ) + "\n" );
                    if ( n2 > 0 )
                        log.write( cc.info( "Loaded S-Chain  ERC721 ABI " ) + cc.attention( strCoinNameErc721_s_chain ) + "\n" );
                }
            } else {
                if ( n1 == 0 )
                    log.write( cc.fatal( "FATAL:" ) + cc.error( "Main-net ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                if ( n2 == 0 && g_str_path_json_erc721_s_chain.length > 0 )
                    log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                joErc721_main_net = null;
                joErc721_s_chain = null;
                strCoinNameErc721_main_net = "";
                strCoinNameErc721_s_chain = "";
                process.exit( 666 );
            }
        } else {
            if ( n1 == 0 )
                log.write( cc.fatal( "FATAL:" ) + cc.error( "Main-net ERC721 JSON is invalid" ) + "\n" );
            if ( n2 == 0 && g_str_path_json_erc721_s_chain.length > 0 )
                log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC721 JSON is invalid" ) + "\n" );
            joErc721_main_net = null;
            joErc721_s_chain = null;
            strCoinNameErc721_main_net = "";
            strCoinNameErc721_s_chain = "";
            process.exit( 666 );
        }
    } else { // if( g_str_path_json_erc721_main_net.length > 0 /*&& g_str_path_json_erc721_s_chain.length > 0*/ )
        if ( g_str_path_json_erc721_s_chain.length > 0 ) {
            var n1 = 0,
                n2 = 0;

            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC721 ABI from " ) + cc.info( g_str_path_json_erc721_s_chain ) + "\n" );
            joErc721_s_chain = load_json( g_str_path_json_erc721_s_chain );
            n2 = Object.keys( joErc721_s_chain ).length;

            if ( n2 > 0 ) {
                strCoinNameErc721_s_chain = discover_in_json_coin_name( joErc721_s_chain );
                n2 = strCoinNameErc721_s_chain.length;
                if ( n2 > 0 )
                    log.write( cc.info( "Loaded S-Chain  ERC721 ABI " ) + cc.attention( strCoinNameErc721_s_chain ) + "\n" );
                else {
                    if ( n2 == 0 && g_str_path_json_erc721_s_chain.length > 0 )
                        log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                    joErc721_main_net = null;
                    joErc721_s_chain = null;
                    strCoinNameErc721_main_net = "";
                    strCoinNameErc721_s_chain = "";
                    process.exit( 667 );
                }
            }
        }
    }
    if ( n1 != 0 && n2 == 0 ) {
        if ( g_str_addr_erc721_explicit.length == 0 ) {
            log.write( cc.fatal( "IMPORTANT NOTICE:" ) + " " + cc.error( "Both S-Chain ERC721 JSON and explicit ERC721 address are not specified" ) + "\n" );
        } else {
            log.write( cc.attention( "IMPORTANT NOTICE:" ) + " " + cc.note( "S-Chain ERC721 ABI will be auto-generated" ) + "\n" );
            strCoinNameErc721_s_chain = "" + strCoinNameErc721_main_net; // assume same
            joErc721_s_chain = JSON.parse( JSON.stringify( joErc721_main_net ) ); // clone
            joErc721_s_chain[ strCoinNameErc721_s_chain + "_address" ] = "" + g_str_addr_erc721_explicit; // set explicit address
            if ( g_isRawTokenTransfer ) {
                g_isRawTokenTransfer = false;
                if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC721 raw transfer is force " ) + cc.success( "OFF" ) + "\n" );
            }
            // if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            //     log.write( cc.info("Auto-generated S-Chain ERC721 JSON is ") + cc.j(joErc721_s_chain) + "\n" );
        }
    } else {
        if ( n1 != 0 && n2 != 0) {
            if ( !g_isRawTokenTransfer ) {
                g_isRawTokenTransfer = g_isRawTokenTransfer_EXPLICIT; // true;
                if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC721 raw transfer is force " ) + cc.error( g_isRawTokenTransfer_EXPLICIT ? "ON" : "OFF" ) + "\n" );
            }
        }
    }
    //
    //
    //
    if ( g_str_path_json_erc20_main_net.length > 0 /*&& g_str_path_json_erc20_s_chain.length > 0*/ ) {
        var n1 = 0,
            n2 = 0;
        if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            log.write( cc.info( "Loading Main-net ERC20 ABI from " ) + cc.info( g_str_path_json_erc20_main_net ) + "\n" );
        joErc20_main_net = load_json( g_str_path_json_erc20_main_net );
        n1 = Object.keys( joErc20_main_net ).length;
        if ( g_str_path_json_erc20_s_chain.length > 0 ) {
            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC20 ABI from " ) + cc.info( g_str_path_json_erc20_s_chain ) + "\n" );
            joErc20_s_chain = load_json( g_str_path_json_erc20_s_chain );
            n2 = Object.keys( joErc20_s_chain ).length;
        }
        if ( n1 > 0 /*&& n2 > 0*/ ) {
            strCoinNameErc20_main_net = discover_in_json_coin_name( joErc20_main_net );
            if ( n2 > 0 )
                strCoinNameErc20_s_chain = discover_in_json_coin_name( joErc20_s_chain );
            n1 = strCoinNameErc20_main_net.length;
            if ( n2 > 0 )
                n2 = strCoinNameErc20_s_chain.length;
            if ( n1 > 0 /*&& n2 > 0*/ ) {
                if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information && ( !g_bShowConfigMode ) ) {
                    log.write( cc.info( "Loaded Main-net ERC20 ABI " ) + cc.attention( strCoinNameErc20_main_net ) + "\n" );
                    if ( n2 > 0 )
                        log.write( cc.info( "Loaded S-Chain  ERC20 ABI " ) + cc.attention( strCoinNameErc20_s_chain ) + "\n" );
                }
            } else {
                if ( n1 == 0 )
                    log.write( cc.fatal( "FATAL:" ) + cc.error( "Main-net ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                if ( n2 == 0 && g_str_path_json_erc20_s_chain.length > 0 )
                    log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                joErc20_main_net = null;
                joErc20_s_chain = null;
                strCoinNameErc20_main_net = "";
                strCoinNameErc20_s_chain = "";
                process.exit( 666 );
            }
        } else {
            if ( n1 == 0 )
                log.write( cc.fatal( "FATAL:" ) + cc.error( "Main-net ERC20 JSON is invalid" ) + "\n" );
            if ( n2 == 0 && g_str_path_json_erc20_s_chain.length > 0 )
                log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC20 JSON is invalid" ) + "\n" );
            joErc20_main_net = null;
            joErc20_s_chain = null;
            strCoinNameErc20_main_net = "";
            strCoinNameErc20_s_chain = "";
            process.exit( 666 );
        }
    } else { // if( g_str_path_json_erc20_main_net.length > 0 /*&& g_str_path_json_erc20_s_chain.length > 0*/ )
        if ( g_str_path_json_erc20_s_chain.length > 0 ) {
            var n1 = 0,
                n2 = 0;

            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC20 ABI from " ) + cc.info( g_str_path_json_erc20_s_chain ) + "\n" );
            joErc20_s_chain = load_json( g_str_path_json_erc20_s_chain );
            n2 = Object.keys( joErc20_s_chain ).length;

            if ( n2 > 0 ) {
                strCoinNameErc20_s_chain = discover_in_json_coin_name( joErc20_s_chain );
                n2 = strCoinNameErc20_s_chain.length;
                if ( n2 > 0 )
                    log.write( cc.info( "Loaded S-Chain  ERC20 ABI " ) + cc.attention( strCoinNameErc20_s_chain ) + "\n" );
                else {
                    if ( n2 == 0 && g_str_path_json_erc20_s_chain.length > 0 )
                        log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                    joErc20_main_net = null;
                    joErc20_s_chain = null;
                    strCoinNameErc20_main_net = "";
                    strCoinNameErc20_s_chain = "";
                    process.exit( 667 );
                }
            }
        }
    }
    if ( n1 != 0 && n2 == 0 ) {
        if ( g_str_addr_erc20_explicit.length == 0 ) {
            log.write( cc.fatal( "IMPORTANT NOTICE:" ) + " " + cc.error( "Both S-Chain ERC20 JSON and explicit ERC20 address are not specified" ) + "\n" );
        } else {
            log.write( cc.attention( "IMPORTANT NOTICE:" ) + " " + cc.note( "S-Chain ERC20 ABI will be auto-generated" ) + "\n" );
            strCoinNameErc20_s_chain = "" + strCoinNameErc20_main_net; // assume same
            joErc20_s_chain = JSON.parse( JSON.stringify( joErc20_main_net ) ); // clone
            joErc20_s_chain[ strCoinNameErc20_s_chain + "_address" ] = "" + g_str_addr_erc20_explicit; // set explicit address
            if ( g_isRawTokenTransfer ) {
                g_isRawTokenTransfer = false;
                if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC20 raw transfer is force " ) + cc.success( "OFF" ) + "\n" );
            }
            // if( IMA.verbose_get() > IMA.RV_VERBOSE.information )
            //     log.write( cc.info("Auto-generated S-Chain ERC20 JSON is ") + cc.j(joErc20_s_chain) + "\n" );
        }
    } else {
        if ( n1 != 0 && n2 != 0) {
            if ( !g_isRawTokenTransfer ) {
                g_isRawTokenTransfer = g_isRawTokenTransfer_EXPLICIT; // true;
                if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                    log.write( cc.warning( "ERC20 raw transfer is force " ) + cc.error( g_isRawTokenTransfer_EXPLICIT ? "ON" : "OFF" ) + "\n" );
            }
        }
    }
    //
    //
    //


    if ( IMA.verbose_get() > IMA.RV_VERBOSE.information || g_bShowConfigMode ) {
        print_about( true );
        ensure_have_value( "App path", __filename, false, true, null, ( x ) => {
            return cc.normal( x );
        } );
        ensure_have_value( "Verbose level", IMA.VERBOSE[ IMA.verbose_get() ], false, true, null, ( x ) => {
            return cc.sunny( x );
        } );
        ensure_have_value( "Main-net URL", g_str_url_main_net, false, true, null, ( x ) => {
            return cc.u( x );
        } );
        ensure_have_value( "S-chain URL", g_str_url_s_chain, false, true, null, ( x ) => {
            return cc.u( x );
        } );
        ensure_have_value( "Main-net Ethereum network ID", g_chain_id_main_net, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S-Chain Ethereum network ID", g_chain_id_s_chain, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "Main-net ABI JSON file path", g_strPathAbiJson_main_net, false, true, null, ( x ) => {
            return cc.warning( x );
        } );
        ensure_have_value( "S-Chain ABI JSON file path", g_strPathAbiJson_s_chain, false, true, null, ( x ) => {
            return cc.warning( x );
        } );
        try {
            ensure_have_value( "Main-net user account address", g_joAccount_main_net.address( g_w3_main_net ), false, true );
        } catch ( err ) {}
        try {
            ensure_have_value( "S-chain user account address", g_joAccount_s_chain.address( g_w3_s_chain ), false, true );
        } catch ( err ) {}
        ensure_have_value( "Private key for main-net user account address", g_joAccount_main_net.privateKey, false, true, null, ( x ) => {
            return cc.attention( x );
        } );
        ensure_have_value( "Private key for S-Chain user account address", g_joAccount_s_chain.privateKey, false, true, null, ( x ) => {
            return cc.attention( x );
        } );
        ensure_have_value( "Amount of wei to transfer", g_wei_amount, false, true, null, ( x ) => {
            return cc.info( x );
        } );
        ensure_have_value( "M->S transfer block size", g_nTransferBlockSizeM2S, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M transfer block size", g_nTransferBlockSizeS2M, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "M->S transactions limit", g_nMaxTransactionsM2S, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M transactions limit", g_nMaxTransactionsS2M, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "M->S await blocks", g_nBlockAwaitDepthM2S, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M await blocks", g_nBlockAwaitDepthS2M, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "M->S minimal block age", g_nBlockAgeM2S, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S->M minimal block age", g_nBlockAgeS2M, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "Transfer loop period(seconds)", g_nLoopPeriodSeconds, false, true, null, ( x ) => {
            return cc.success( x );
        } );
        if ( g_nTimeFrameSeconds > 0 ) {
            ensure_have_value( "Time framing(seconds)", g_nTimeFrameSeconds, false, true );
            ensure_have_value( "Next frame gap(seconds)", g_nNextFrameGap, false, true );
        } else
            ensure_have_value( "Time framing", cc.error( "disabled" ), false, true );
        ensure_have_value( "S-Chain node number(zero based)", g_nNodeNumber, false, true, null, ( x ) => {
            return cc.info( x );
        } );
        ensure_have_value( "S-Chain nodes count", g_nNodesCount, false, true, null, ( x ) => {
            return cc.info( x );
        } );
        if ( g_log_strFilePath.length > 0 ) {
            ensure_have_value( "Log file path", g_log_strFilePath, false, true, null, ( x ) => {
                return cc.info( x );
            } );
            ensure_have_value( "Max size of log file path", g_log_nMaxSizeBeforeRotation, false, true, null, ( x ) => {
                return ( x <= 0 ) ? cc.warn( "unlimited" ) : cc.note( x );
            } );
            ensure_have_value( "Max rotated count of log files", g_log_nMaxFilesCount, false, true, null, ( x ) => {
                return ( x <= 1 ) ? cc.warn( "not set" ) : cc.note( x );
            } );
        }
        if ( strCoinNameErc721_main_net.length > 0 /*&& strCoinNameErc721_s_chain.length > 0*/ ) {
            ensure_have_value( "Loaded Main-net ERC721 ABI ", strCoinNameErc721_main_net, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Loaded S-Chain  ERC721 ABI ", strCoinNameErc721_s_chain, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "ERC721 tocken id ", g_token_id, false, true, null, ( x ) => {
                return cc.info( x );
            } );
            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "ERC721 raw transfer is " ) + cc.yn( g_isRawTokenTransfer ) + "\n" );
            log.write( cc.info( "ERC721 explicit S-Chain address is " ) + cc.attention( g_str_addr_erc721_explicit ) + "\n" );
        }
        if ( strCoinNameErc20_main_net.length > 0 /*&& strCoinNameErc20_s_chain.length > 0*/ ) {
            ensure_have_value( "Loaded Main-net ERC20 ABI ", strCoinNameErc20_main_net, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Loaded S-Chain  ERC20 ABI ", strCoinNameErc20_s_chain, false, true, null, ( x ) => {
                return cc.attention( x );
            } );
            ensure_have_value( "Amount of tokens to transfer", g_token_amount, false, true, null, ( x ) => {
                return cc.info( x );
            } );
            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "ERC20 raw transfer is " ) + cc.yn( g_isRawTokenTransfer ) + "\n" );
            log.write( cc.info( "ERC20 explicit S-Chain address is " ) + cc.attention( g_str_addr_erc20_explicit ) + "\n" );
        }
    }
    //
    //
    //
} // common_init

if( g_bIsNeededCommonInit )
    common_init();

if ( g_bShowConfigMode ) {
    // just show configuratin values and exit
    return true;
}

async function discover_s_chain_network( fnAfter ) {
    let strLogPrefix = cc.info("S net discover:") + " ";
    fnAfter = fnAfter || function() {};
    let joSChainNetworkInfo = null;
    await rpcCall.create( g_str_url_s_chain, async function( joCall, err ) {
        if( err ) {
            log.write( strLogPrefix + cc.fatal( "Error:" ) + cc.error( " JSON RPC call to S-Chain failed: " ) + cc.warning(err) + "\n" );
            fnAfter( err, null );
            return;
        }
        await joCall.call( {
            "method": "skale_nodesRpcInfo",
            "params": { }
        }, async function( joIn, joOut, err ) {
            if( err ) {
                log.write( strLogPrefix + cc.fatal( "Error:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) + "\n" );
                fnAfter( err, null );
                return;
            }
            //if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            //    log.write( strLogPrefix + cc.normal( "S-Chain network information: " )  + cc.j( joOut.result ) + "\n" );
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
               log.write( strLogPrefix + cc.success( "OK, got S-Chain network information." ) + "\n" );
            let nCountReceivedImaDescriptions = 0;
            joSChainNetworkInfo = joOut.result;
            let jarrNodes = joSChainNetworkInfo.network;
            for( let i = 0; i < jarrNodes.length; ++ i ) {
                let joNode = jarrNodes[ i ];
                let strNodeURL = compose_schain_node_url( joNode );
                await rpcCall.create( strNodeURL, function( joCall, err ) {
                    if( err ) {
                        log.write( strLogPrefix + cc.fatal( "Error:" ) + cc.error( " JSON RPC call to S-Chain failed" ) );
                        fnAfter( err, null );
                        return;
                    }
                    joCall.call( {
                        "method": "skale_imaInfo",
                        "params": { }
                    }, function( joIn, joOut, err ) {
                        ++ nCountReceivedImaDescriptions;
                        if( err ) {
                            log.write( strLogPrefix + cc.fatal( "Error:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) + "\n" );
                            fnAfter( err, null );
                            return;
                        }
                        //if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                        //    log.write( strLogPrefix + cc.normal( "Node ") + cc.info(joNode.nodeID) + cc.normal(" IMA information: " )  + cc.j( joOut.result ) + "\n" );
                        joNode.imaInfo = joOut.result;
                        //joNode.joCall = joCall;
                        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                           log.write( strLogPrefix + cc.success( "OK, got node ") + cc.info(joNode.nodeID) + cc.success(" IMA information(") + cc.info(nCountReceivedImaDescriptions) + cc.success(" of ") + cc.info(jarrNodes.length) + cc.success(")." ) + "\n" );
                    } );
                } );
            }
            //process.exit( 0 );
            let iv = setInterval( function() {
                if( nCountReceivedImaDescriptions == jarrNodes.length  ) {
                    clearInterval( iv );
                    fnAfter( null, joSChainNetworkInfo );
                }
            }, 100 );
        } );
    } );
}

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// register S-Chain 1 on main net
//
async function do_the_job() {
    let strLogPrefix = cc.info("Job 1:") + " ";
    let idxAction, cntActions = g_arrActions.length,
        cntFalse = 0,
        cntTrue = 0;
    for ( idxAction = 0; idxAction < cntActions; ++idxAction ) {
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
        var joAction = g_arrActions[ idxAction ],
            bOK = false;
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.notice( "Will execute action:" ) + " " + cc.info( joAction.name ) + cc.debug( " (" ) + cc.info( idxAction + 1 ) + cc.debug( " of " ) + cc.info( cntActions ) + cc.debug( ")" ) + "\n" );
        try {
            if ( await joAction.fn() ) {
                ++cntTrue;
                if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Succeeded action:" ) + " " + cc.info( joAction.name ) + "\n" );
            } else {
                ++cntFalse;
                if ( IMA.verbose_get() >= IMA.RV_VERBOSE.error )
                    log.write( strLogPrefix + cc.warn( "Failed action:" ) + " " + cc.info( joAction.name ) + "\n" );
            }
        } catch ( e ) {
            ++cntFalse;
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.fatal )
                log.write( strLogPrefix + cc.fatal( "Exception occurred while executing action:" ) + " " + cc.info( joAction.name ) + cc.error( ", error description: " ) + cc.warn( e ) + "\n" );
        }
    } // for( idxAction = 0; idxAction < cntActions; ++ idxAction )
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
        log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
        log.write( strLogPrefix + cc.info( "FINISH:" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntActions ) + cc.notice( " task(s) executed" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntTrue ) + cc.success( " task(s) succeeded" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntFalse ) + cc.error( " task(s) failed" ) + "\n" );
        log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
    }
    if (cntFalse > 0) {
        process.exitCode = cntFalse;
    }
}

if( g_bSignMessages ) {
    if( g_strPathBlsGlue.length == 0 ) {
        log.write( cc.fatal( "FATAL" ) + cc.error( " please specify --bls-glue parameter." ) + "\n" );
        process.exit( 666 );
    }
    if( g_strPathHashG1.length == 0 ) {
        log.write( cc.fatal( "FATAL" ) + cc.error( " please specify --hash-g1 parameter." ) + "\n" );
        process.exit( 666 );
    }
    discover_s_chain_network( function( err, joSChainNetworkInfo ) {
        if( err )
            process.exit( 1 ); // error information is printed by discover_s_chain_network()
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
           log.write( cc.success( "S-Chain network was discovered: " )  + cc.j( joSChainNetworkInfo ) + "\n" );
        g_joSChainNetworkInfo = joSChainNetworkInfo;
        do_the_job();
        return 0; // FINISH
    } );
} else {
    do_the_job();
    return 0; // FINISH
}

async function register_step1() {
    let strLogPrefix = cc.info("Reg 1:") + " ";
    var bRetVal = await IMA.register_s_chain_on_main_net( // step 1
        g_w3_main_net,
        g_jo_message_proxy_main_net,
        g_joAccount_main_net,
        g_chain_id_s_chain
    );
    if ( !bRetVal ) {
        var nRetCode = 1501;
        log.write( strLogPrefix + cc.fatal( "FATAL" ) + cc.error( " failed to register S-Chain on Main-net, will return code " ) + cc.warn( nRetCode ) + "\n" );
        process.exit( nRetCode );
    }
    return true;
}
async function register_step2() {
    let strLogPrefix = cc.info("Reg 2:") + " ";
    var bRetVal = await IMA.register_s_chain_in_deposit_box( // step 2
        g_w3_main_net,
        //g_jo_deposit_box, // only main net
        g_jo_lock_and_data_main_net,
        g_joAccount_main_net,
        g_jo_token_manager, // only s-chain
        g_chain_id_s_chain
    );
    if ( !bRetVal ) {
        var nRetCode = 1502;
        log.write( strLogPrefix + cc.fatal( "FATAL" ) + cc.error( " failed to register S-Chain in deposit box, will return code " ) + cc.warn( nRetCode ) + "\n" );
        process.exit( nRetCode );
    }
    return true;
}
async function register_step3() {
    let strLogPrefix = cc.info("Reg 3:") + " ";
    var bRetVal = await IMA.register_main_net_depositBox_on_s_chain( // step 3
        g_w3_s_chain,
        //g_jo_token_manager, // only s-chain
        g_jo_deposit_box, // only main net
        g_jo_lock_and_data_s_chain,
        g_joAccount_s_chain
    );
    if ( !bRetVal ) {
        var nRetCode = 1503;
        log.write( strLogPrefix + cc.fatal( "FATAL" ) + cc.error( " failed to register Main-net deposit box on S-Chain, will return code " ) + cc.warn( nRetCode ) + "\n" );
        process.exit( nRetCode );
    }
    return true;
}
async function register_all() {
    if ( ! await register_step1() )
        return false;
    if ( !await register_step2() )
        return false;
    if ( !await register_step3() )
        return false;
    return true;
}

async function check_registeration_all() {
    const b1 = await check_registeration_step1();
    const b2 = await check_registeration_step2();
    const b3 = await check_registeration_step3();
    if( ! (b1 && b2 && b3) )
        return false;
    return true;
}
async function check_registeration_step1() {
    var bRetVal = await IMA.check_is_registered_s_chain_on_main_net( // step 1
        g_w3_main_net,
        g_jo_message_proxy_main_net,
        g_joAccount_main_net,
        g_chain_id_s_chain
    );
    return bRetVal;
}
async function check_registeration_step2() {
    var bRetVal = await IMA.check_is_registered_s_chain_in_deposit_box( // step 2
        g_w3_main_net,
        g_jo_lock_and_data_main_net,
        g_joAccount_main_net,
        g_chain_id_s_chain
    );
    return bRetVal;
}
async function check_registeration_step3() {
    var bRetVal = await IMA.check_is_registered_main_net_depositBox_on_s_chain( // step 3
        g_w3_s_chain,
        g_jo_lock_and_data_s_chain,
        g_joAccount_s_chain
    );
    return bRetVal;
}

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Run transfer loop
//
async function single_transfer_loop() {
    let strLogPrefix = cc.attention("Single Loop:") + " ";
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
        log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
    if ( !check_time_framing() ) {
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.warn( "Skipped due to time framing" ) + "\n" );
        return true;
    }
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "Will invoke M2S transfer..." ) + "\n" );
    var b1 = await IMA.do_transfer( // main-net --> s-chain
        /**/
        g_w3_main_net,
        g_jo_message_proxy_main_net,
        g_joAccount_main_net,
        g_w3_s_chain,
        g_jo_message_proxy_s_chain,
        /**/
        g_joAccount_s_chain,
        g_chain_id_main_net,
        g_chain_id_s_chain,
        g_nTransferBlockSizeM2S,
        g_nMaxTransactionsM2S,
        g_nBlockAwaitDepthM2S,
        g_nBlockAgeM2S,
        null // fn_sign_messages
    );
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "M2S transfer done: " ) + cc.tf(b1) + "\n" );
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "Will invoke S2M transfer..." ) + "\n" );
    var b2 = await IMA.do_transfer( // s-chain --> main-net
        /**/
        g_w3_s_chain,
        g_jo_message_proxy_s_chain,
        g_joAccount_s_chain,
        g_w3_main_net,
        g_jo_message_proxy_main_net,
        /**/
        g_joAccount_main_net,
        g_chain_id_s_chain,
        g_chain_id_main_net,
        g_nTransferBlockSizeS2M,
        g_nMaxTransactionsS2M,
        g_nBlockAwaitDepthS2M,
        g_nBlockAgeS2M,
        do_sign_messages // fn_sign_messages
    );
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "S2M transfer done: " ) + cc.tf(b2) + "\n" );
    var b3 = b1 && b2;
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "Completed: " ) + cc.tf(b3) + "\n" );
    return b3;
}
async function single_transfer_loop_with_repeat() {
    await single_transfer_loop();
    setTimeout( single_transfer_loop_with_repeat, g_nLoopPeriodSeconds * 1000 );
};
async function run_transfer_loop() {
    await single_transfer_loop_with_repeat();
    //setTimeout( single_transfer_loop_with_repeat, g_nLoopPeriodSeconds*1000 );
    return true;
}

function discover_bls_threshold( joSChainNetworkInfo ) {
    let jarrNodes = g_joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++ i ) {
        let joNode = jarrNodes[ i ];
        if( "imaInfo" in joNode && typeof joNode.imaInfo == "object"
            &&  "t" in joNode.imaInfo && typeof joNode.imaInfo.t == "number"
            &&  joNode.imaInfo.t > 0
            )
            return joNode.imaInfo.t;
    }
    return -1;
}

function discover_bls_participants( joSChainNetworkInfo ) {
    let jarrNodes = g_joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++ i ) {
        let joNode = jarrNodes[ i ];
        if( "imaInfo" in joNode && typeof joNode.imaInfo == "object"
            &&  "n" in joNode.imaInfo && typeof joNode.imaInfo.n == "number"
            &&  joNode.imaInfo.n > 0
            )
            return joNode.imaInfo.n;
    }
    return -1;
}

function discover_public_key_by_index( nNodeIndex, joSChainNetworkInfo ) {
    let jarrNodes = g_joSChainNetworkInfo.network;
    let joNode = jarrNodes[ nNodeIndex ];
    if( "imaInfo" in joNode && typeof joNode.imaInfo == "object"
        &&  "insecureBLSPublicKey0" in joNode.imaInfo && typeof joNode.imaInfo.insecureBLSPublicKey0 == "string" && joNode.imaInfo.insecureBLSPublicKey0.length > 0
        &&  "insecureBLSPublicKey1" in joNode.imaInfo && typeof joNode.imaInfo.insecureBLSPublicKey1 == "string" && joNode.imaInfo.insecureBLSPublicKey1.length > 0
        &&  "insecureBLSPublicKey2" in joNode.imaInfo && typeof joNode.imaInfo.insecureBLSPublicKey2 == "string" && joNode.imaInfo.insecureBLSPublicKey2.length > 0
        &&  "insecureBLSPublicKey3" in joNode.imaInfo && typeof joNode.imaInfo.insecureBLSPublicKey3 == "string" && joNode.imaInfo.insecureBLSPublicKey3.length > 0
        )
        return {
            "insecureBLSPublicKey0": joNode.imaInfo.insecureBLSPublicKey0,
            "insecureBLSPublicKey1": joNode.imaInfo.insecureBLSPublicKey1,
            "insecureBLSPublicKey2": joNode.imaInfo.insecureBLSPublicKey2,
            "insecureBLSPublicKey3": joNode.imaInfo.insecureBLSPublicKey3
            };
    return null;
}

function discover_common_public_key( joSChainNetworkInfo ) {
    let jarrNodes = g_joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++ i ) {
        let joNode = jarrNodes[ i ];
        if( "imaInfo" in joNode && typeof joNode.imaInfo == "object"
            &&  "insecureCommonBLSPublicKey0" in joNode.imaInfo && typeof joNode.imaInfo.insecureCommonBLSPublicKey0 == "string" && joNode.imaInfo.insecureCommonBLSPublicKey0.length > 0
            &&  "insecureCommonBLSPublicKey1" in joNode.imaInfo && typeof joNode.imaInfo.insecureCommonBLSPublicKey1 == "string" && joNode.imaInfo.insecureCommonBLSPublicKey1.length > 0
            &&  "insecureCommonBLSPublicKey2" in joNode.imaInfo && typeof joNode.imaInfo.insecureCommonBLSPublicKey2 == "string" && joNode.imaInfo.insecureCommonBLSPublicKey2.length > 0
            &&  "insecureCommonBLSPublicKey3" in joNode.imaInfo && typeof joNode.imaInfo.insecureCommonBLSPublicKey3 == "string" && joNode.imaInfo.insecureCommonBLSPublicKey3.length > 0
            )
            return {
                "insecureCommonBLSPublicKey0": joNode.imaInfo.insecureCommonBLSPublicKey0,
                "insecureCommonBLSPublicKey1": joNode.imaInfo.insecureCommonBLSPublicKey1,
                "insecureCommonBLSPublicKey2": joNode.imaInfo.insecureCommonBLSPublicKey2,
                "insecureCommonBLSPublicKey3": joNode.imaInfo.insecureCommonBLSPublicKey3
                };
    }
    return null;
}

function encodeUTF8( s ) { // marshals a string to an Uint8Array, see https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
	var i = 0, arrBytes = new Uint8Array(s.length * 4);
	for( var ci = 0; ci != s.length; ci++ ) {
		var c = s.charCodeAt( ci );
		if( c < 128 ) {
			arrBytes[i++] = c;
			continue;
		}
		if( c < 2048 )
			arrBytes[i++] = c >> 6 | 192;
		else {
			if( c > 0xd7ff && c < 0xdc00 ) {
				if( ++ci >= s.length )
					throw new Error( "UTF-8 encode: incomplete surrogate pair" );
				var c2 = s.charCodeAt( ci );
				if( c2 < 0xdc00 || c2 > 0xdfff )
					throw new Error( "UTF-8 encode: second surrogate character 0x" + c2.toString(16) + " at index " + ci + " out of range" );
				c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
				arrBytes[i++] = c >> 18 | 240;
				arrBytes[i++] = c >> 12 & 63 | 128;
			} else arrBytes[i++] = c >> 12 | 224;
			arrBytes[i++] = c >> 6 & 63 | 128;
		}
		arrBytes[i++] = c & 63 | 128;
	}
	return arrBytes.subarray( 0, i );
}
function decodeUTF8( arrBytes ) { // unmarshals a string from an Uint8Array, see https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
	var i = 0, s = "";
	while ( i < arrBytes.length ) {
		var c = arrBytes[i++];
		if( c > 127 ) {
			if( c > 191 && c < 224 ) {
				if( i >= arrBytes.length )
					throw new Error( "UTF-8 decode: incomplete 2-byte sequence" );
				c = (c & 31) << 6 | arrBytes[i++] & 63;
			} else if( c > 223 && c < 240 ) {
				if (i + 1 >= arrBytes.length)
					throw new Error( "UTF-8 decode: incomplete 3-byte sequence" );
				c = (c & 15) << 12 | (arrBytes[i++] & 63) << 6 | arrBytes[i++] & 63;
			} else if( c > 239 && c < 248 ) {
				if( i + 2 >= arrBytes.length )
					throw new Error( "UTF-8 decode: incomplete 4-byte sequence" );
				c = (c & 7) << 18 | (arrBytes[i++] & 63) << 12 | (arrBytes[i++] & 63) << 6 | arrBytes[i++] & 63;
			} else
                throw new Error( "UTF-8 decode: unknown multibyte start 0x" + c.toString(16) + " at index " + (i - 1) );
		}
		if( c <= 0xffff )
            s += String.fromCharCode( c );
		else if( c <= 0x10ffff ) {
			c -= 0x10000;
			s += String.fromCharCode( c >> 10 | 0xd800 )
			s += String.fromCharCode( c & 0x3FF | 0xdc00 )
		} else
            throw new Error( "UTF-8 decode: code point 0x" + c.toString(16) + " exceeds UTF-16 reach" );
	}
	return s;
}

function hexToBytes( strHex, isInversiveOrder ) { // convert a hex string to a byte array
    isInversiveOrder = ( isInversiveOrder != null && isInversiveOrder != undefined && isInversiveOrder ) ? true : false;
    strHex = strHex || "";
    strHex = "" + strHex;
    strHex = strHex.trim().toLowerCase();
    if( strHex.length > 1 && strHex[0] == 0 && strHex[1] == "x" )
        strHex = strHex.substr( 2, strHex.length - 2 );
    if( ( strHex.length & 1 ) != 0 )
        strHex = "0" + strHex;
    let i, j, cnt = strHex.length;
    let arrBytes = new Uint8Array( cnt/2 );
    for( i = 0, j = 0; i < cnt; ++ j, i += 2 )
        arrBytes[ isInversiveOrder ? ( cnt - j - 1 ) : j ] = parseInt( strHex.substr( i, 2 ), 16 );
    return arrBytes;
}
function bytesToHex( arrBytes, isInversiveOrder ) { // convert a byte array to a hex string
    isInversiveOrder = ( isInversiveOrder != null && isInversiveOrder != undefined && isInversiveOrder ) ? true : false;
    for( var hex = [], i = 0; i < arrBytes.length; i++)  {
        var current = arrBytes[i] < 0 ? arrBytes[i] + 256 : arrBytes[i];
        let c0 = ( current >>> 4 ).toString(16);
        let c1 = ( current & 0xF ).toString(16);
        if( isInversiveOrder ) {
            hex.splice( 0, 0, c0 );
            hex.splice( 1, 0, c1 );
        } else {
            hex.push( c0 );
            hex.push( c1 );
        }
    }
    return hex.join( "" );
}

function bytesAlighLeftWithZeroes( arrBytes, cntMin ) {
    let arrOneZeroByte = new Uint8Array( 1 );
    arrOneZeroByte[0] = 0;
    while( arrBytes.length < cntMin )
        arrBytes = bytesConcat( arrOneZeroByte, arrBytes );
    return arrBytes;
}
function bytesAlighRightWithZeroes( arrBytes, cntMin ) {
    let arrOneZeroByte = new Uint8Array( 1 );
    arrOneZeroByte[0] = 0;
    while( arrBytes.length < cntMin )
        arrBytes = bytesConcat( arrBytes, arrOneZeroByte );
    return arrBytes;
}

function concatTypedArrays( a, b ) { // a, b TypedArray of same type
    var c = new (a.constructor)(a.length + b.length);
    c.set( a, 0 );
    c.set( b, a.length );
    return c;
}
function concatByte( ui8a, byte ) {
    var b = new Uint8Array( 1 );
    b[0] = byte;
    return concatTypedArrays(ui8a, b);
}
function bytesConcat( a1, a2 ) {
    a1 = a1 || new Uint8Array();
    a2 = a2 || new Uint8Array();
    return concatTypedArrays( a1, a2 );
}

function toArrayBuffer( buf ) { // see https://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer
    let ab = new ArrayBuffer( buf.length );
    let view = new Uint8Array( ab );
    for( var i = 0; i < buf.length; ++ i )
        view[ i ] = buf[ i ];
    return ab;
}
function toBuffer( ab ) {
    let buf = Buffer.alloc( ab.byteLength );
    let view = new Uint8Array( ab );
    for( let i = 0; i < buf.length; ++ i )
        buf[ i ] = view[ i ];
    return buf;
}

function invertArrayItemsLR( arr ) {
    let i, cnt = arr.length / 2;
    for( i = 0; i < cnt; ++ i ) {
        let e1 = arr[ i ];
        let e2 = arr[ arr.length - i - 1 ];
        arr[ i ] = e2;
        arr[ arr.length - i - 1 ] = e1;
    }
    return arr;
}

function compose_one_message_byte_sequence( joMessage ) {
    let w3 = g_w3_s_chain ? g_w3_s_chain : g_w3_main_net;
    if( ! w3 )
        throw new Error( "w3.utils is needed for BN operations" );
    let arrBytes = new Uint8Array();

    let bytesSender = hexToBytes( joMessage.sender );
    bytesSender = invertArrayItemsLR( bytesSender );
    bytesSender = bytesAlighLeftWithZeroes( bytesSender, 32 )
    bytesSender = invertArrayItemsLR( bytesSender );
    arrBytes = bytesConcat( arrBytes, bytesSender );
    //
    let bytesDestinationContract = hexToBytes( joMessage.destinationContract );
    bytesDestinationContract = invertArrayItemsLR( bytesDestinationContract );
    bytesDestinationContract = bytesAlighLeftWithZeroes( bytesDestinationContract, 32 )
    bytesDestinationContract = invertArrayItemsLR( bytesDestinationContract );
    arrBytes = bytesConcat( arrBytes, bytesDestinationContract );
    //
    let bytesTo = hexToBytes( joMessage.to );
    bytesTo = invertArrayItemsLR( bytesTo );
    bytesTo = bytesAlighLeftWithZeroes( bytesTo, 32 )
    bytesTo = invertArrayItemsLR( bytesTo );
    arrBytes = bytesConcat( arrBytes, bytesTo );
    //
    let strHexAmount = "0x" + w3.utils.toBN( joMessage.amount ).toString(16);
    let bytesAmount = hexToBytes( strHexAmount );
    //bytesAmount = invertArrayItemsLR( bytesAmount );
    bytesAmount = bytesAlighLeftWithZeroes( bytesAmount, 32 )
    arrBytes = bytesConcat( arrBytes, bytesAmount );
    //
    let bytesData = hexToBytes( joMessage.data );
    bytesData = invertArrayItemsLR( bytesData );
    arrBytes = bytesConcat( arrBytes, bytesData );
    //
    return arrBytes;
}

function compose_summary_message_to_sign( jarrMessages, isHash ) {
    let arrBytes = "";
    let i = 0, cnt = jarrMessages.length;
    for( i = 0; i < cnt; ++ i ) {
        let joMessage = jarrMessages[ i ];
        let arrMessageBytes = compose_one_message_byte_sequence( joMessage );
        arrBytes = bytesConcat( arrBytes, arrMessageBytes );
    }
    let strSummaryMessage = "";
    if( isHash ) {
        const hash = new Keccak( 256 );
        hash.update( toBuffer( arrBytes ) );
        strSummaryMessage = hash.digest( "hex" );
    } else
        strSummaryMessage = "0x" + bytesToHex( arrBytes );
    return strSummaryMessage;
}

function split_signature_share( signatureShare ) {
    let jarr = signatureShare.split( ":" );
    return {
        "X": jarr[0],
        "Y": jarr[1]
    };
}

function get_bls_glue_tmp_dir() {
    let strTmpDir = path.resolve( __dirname ) + "/tmp";
    shell.mkdir( "-p", strTmpDir );
    return strTmpDir;
}

function alloc_tmp_action_dir() {
    let strActionDir = get_bls_glue_tmp_dir() + "/" + replaceAll( uuid(), "-", "" );
    shell.mkdir( "-p", strActionDir );
    return strActionDir;
}

function perform_bls_glue( jarrMessages, arrSignResults ) {
    let strLogPrefix = cc.info("BLS") + cc.debug("/") + cc.attention("Glue") + cc.debug(":") + " ";
    let joGlueResult = null;
    let jarrNodes = g_joSChainNetworkInfo.network;
    let nThreshold = discover_bls_threshold( g_joSChainNetworkInfo );
    let nParticipants = discover_bls_participants( g_joSChainNetworkInfo );
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
       log.write( strLogPrefix + cc.debug( "Original long message is ") + cc.info( compose_summary_message_to_sign( jarrMessages, false ) ) + "\n" );
    let strSummaryMessage = compose_summary_message_to_sign( jarrMessages, true );
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
       log.write( strLogPrefix + cc.debug( "Message hasn to sign is ") + cc.info( strSummaryMessage ) + "\n" );
    let strPWD = shell.pwd();
    let strActionDir = alloc_tmp_action_dir();
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
       log.write( strLogPrefix + cc.debug( "perform_bls_glue will work in ") + cc.info(strActionDir) + cc.debug(" director with ") + cc.info(arrSignResults.length) + cc.debug(" sign results..." ) + "\n" );
    let fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        shell.cd( strActionDir );
        let strInput = "";
        let i = 0, cnt = arrSignResults.length;
        for( i = 0; i < cnt; ++ i ) {
            let jo = arrSignResults[ i ];
            let strPath = strActionDir + "/sign-result" + jo.index + ".json";
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "Saving " ) + cc.notice( strPath ) + cc.debug(" file..." ) + "\n" );
            jsonFileSave( strPath, jo );
            strInput += " --input " + strPath;
        }
        let strGlueCommand =
            g_strPathBlsGlue +
            " --t " + nThreshold +
            " --n " + nParticipants +
            strInput +
            " --output " + strActionDir + "/glue-result.json";
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "Will execute BLS glue command:\n" ) + cc.notice( strGlueCommand ) + "\n" );
        strOutput = child_process.execSync( strGlueCommand );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "BLS glue output is:\n" ) + cc.notice( strOutput ) + "\n" );
        joGlueResult = jsonFileLoad( strActionDir + "/glue-result.json" );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "BLS glue result is: " ) + cc.j( joGlueResult ) + "\n" );
        if ( "X" in joGlueResult.signature && "Y" in joGlueResult.signature ) {
            //if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.success( "BLS glue success" )  + "\n" );
            joGlueResult.hashSrc = strSummaryMessage;
            //
            //
            //
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.debug( "Computing " ) + cc.info("G1") + cc.debug(" hash point...") + "\n" );
            let strPath = strActionDir + "/hash.json";
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "Saving " ) + cc.notice( strPath ) + cc.debug(" file..." ) + "\n" );
            jsonFileSave( strPath, { "message": strSummaryMessage } );
            let strHasG1Command =
                g_strPathHashG1 +
                " --t " + nThreshold +
                " --n " + nParticipants;
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "Will execute HashG1 command:\n" ) + cc.notice( strHasG1Command ) + "\n" );
            strOutput = child_process.execSync( strHasG1Command );
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "HashG1 output is:\n" ) + cc.notice( strOutput ) + "\n" );
            let joResultHashG1 = jsonFileLoad( strActionDir + "/g1.json" );
            //if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "HashG1 result is: " ) + cc.j( joResultHashG1 ) + "\n" );
            //
            //
            //
            if ( "g1" in joResultHashG1 && "hint" in joResultHashG1.g1 && "hashPoint" in joResultHashG1.g1
                && "X" in joResultHashG1.g1.hashPoint && "Y" in joResultHashG1.g1.hashPoint ) {
                joGlueResult.hashPoint = joResultHashG1.g1.hashPoint;
                joGlueResult.hint = joResultHashG1.g1.hint;
            } else {
                joGlueResult = null;
                throw "malformed HashG1 result";
            }
        } else {
            joGlueResult = null;
            throw "malformed BLS glue result";
        }
        //
        // typical glue result is:
        // {
        //     "signature": {
        //         "X": "2533808148583356869465588922364792219279924240245650719832918161014673583859",
        //         "Y": "2900553917645502192745899163584745093808998719667605626180761629013549672201"
        //     }
        // }
        fnShellRestore();
    } catch( err ) {
        log.write( strLogPrefix + cc.fatal("BLS glue error:") + cc.normal( " error description is: " ) + cc.warning( err ) + "\n" );
        log.write( strLogPrefix + cc.error( "BLS glue output is:\n" ) + cc.notice( strOutput ) + "\n" );
        fnShellRestore();
        joGlueResult = null;
    }
    return joGlueResult;
}

function perform_bls_verify_i( nZeroBasedNodeIndex, joResultFromNode, jarrMessages, joPublicKey ) {
    if( ! joResultFromNode )
        return true;
    let nThreshold = discover_bls_threshold( g_joSChainNetworkInfo );
    let nParticipants = discover_bls_participants( g_joSChainNetworkInfo );
    let strPWD = shell.pwd();
    let strActionDir = alloc_tmp_action_dir();
    let fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        let strLogPrefix = cc.info("BLS") + cc.debug("/") + cc.notice("#") + cc.bright(nZeroBasedNodeIndex) + cc.debug(":") + " ";
        shell.cd( strActionDir );
        let joMsg = { "message" : compose_summary_message_to_sign( jarrMessages, true ) };
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.debug( "BLS node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.debug(" verify message " ) + cc.j( joMsg ) + cc.debug(" composed from ") + cc.j(jarrMessages) + cc.debug(" using glue ") + cc.j( joResultFromNode) + cc.debug(" and public key ") + cc.j( joPublicKey) + "\n" );
        let strSignResultFileName = strActionDir + "/sign-result" + nZeroBasedNodeIndex + ".json";
        jsonFileSave( strSignResultFileName, joResultFromNode );
        jsonFileSave( strActionDir + "/hash.json", joMsg );
        jsonFileSave( strActionDir + "/BLS_keys" + nZeroBasedNodeIndex + ".json", joPublicKey );
        let strVerifyCommand = ""
            + g_strPathBlsVerify
            + " --t " + nThreshold
            + " --n " + nParticipants
            + " --j " + nZeroBasedNodeIndex
            + " --input " + strSignResultFileName
            ;
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "Will execute node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.normal(" BLS verify command:\n" ) + cc.notice( strVerifyCommand ) + "\n" );
        strOutput = child_process.execSync( strVerifyCommand );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "BLS node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.normal(" verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        //if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
             log.write( strLogPrefix + cc.success( "BLS node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.success(" verify success" )  + "\n" );
        fnShellRestore();
        return true;
    } catch( err ) {
        log.write( strLogPrefix + cc.fatal("BLS node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.error(" verify error:") + cc.normal( " error description is: " ) + cc.warning( err ) + "\n" );
        log.write( strLogPrefix + cc.error( "BLS node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.error(" verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        fnShellRestore();
    }
    return false;
}

function perform_bls_verify( joGlueResult, jarrMessages, joCommonPublicKey ) {
    if( ! joGlueResult )
        return true;
    let nThreshold = discover_bls_threshold( g_joSChainNetworkInfo );
    let nParticipants = discover_bls_participants( g_joSChainNetworkInfo );
    let strPWD = shell.pwd();
    let strActionDir = alloc_tmp_action_dir();
    let fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        let strLogPrefix = cc.info("BLS") + cc.debug("/") + cc.sunny("Summary") + cc.debug(":") + " ";
        shell.cd( strActionDir );
        let joMsg = { "message" : compose_summary_message_to_sign( jarrMessages, true ) };
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.debug( "BLS/summary verify message " ) + cc.j( joMsg ) + cc.debug(" composed from ") + cc.j(jarrMessages) + cc.debug(" using glue ") + cc.j( joGlueResult) + cc.debug(" and common public key ") + cc.j( joCommonPublicKey) + "\n" );
        jsonFileSave( strActionDir + "/glue-result.json", joGlueResult );
        jsonFileSave( strActionDir + "/hash.json", joMsg );
        jsonFileSave( strActionDir + "/common_public_key.json", joCommonPublicKey );
        let strVerifyCommand = ""
            + g_strPathBlsVerify
            + " --t " + nThreshold
            + " --n " + nParticipants
            + " --input " + "./glue-result.json"
            ;
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "Will execute BLS/summary verify command:\n" ) + cc.notice( strVerifyCommand ) + "\n" );
        strOutput = child_process.execSync( strVerifyCommand );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "BLS/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
             log.write( strLogPrefix + cc.success( "BLS/summary verify success" )  + "\n" );
        fnShellRestore();
        return true;
    } catch( err ) {
        log.write( strLogPrefix + cc.fatal("BLS/summary verify error:") + cc.normal( " error description is: " ) + cc.warning( err ) + "\n" );
        log.write( strLogPrefix + cc.error( "BLS/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        fnShellRestore();
    }
    return false;
}

async function do_sign_messages( jarrMessages, nIdxCurrentMsgBlockStart, fn ) {
    let strLogPrefix = cc.info("Sign msgs:") + " ";
    fn = fn || function() {};
    if( ! ( g_bSignMessages && g_strPathBlsGlue.length > 0 && g_joSChainNetworkInfo ) ) {
        await fn( null, jarrMessages, null )
        return;
    }
    //
    // each message in array looks like:
    // {
    //     "amount": joValues.amount,
    //     "data": joValues.data,
    //     "destinationContract": joValues.dstContract,
    //     "sender": joValues.srcContract,
    //     "to": joValues.to
    // }
    //
    // sign result looks like:
    // {
    //     "id": 1, "jsonrpc": "2.0", "result": {
    //         "signResult": {
    //             "errorMessage": "",
    //             "signatureShare": "13888409666804046853490114813821624491836407617931905586112520275264817002720:9871589266312476278322587556340871982939135237123140475925975407511373249165:0",
    //             "status": 0
    //         }
    //     }
    // }
    //
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "Will sign ") + cc.info(jarrMessages.length) + cc.debug(" message(s)..." ) + "\n" );
    let nCountReceived = 0; // including errors
    let nCountErrors = 0;
    let arrSignResults = [];
    let jarrNodes = g_joSChainNetworkInfo.network;
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "Will query to sign ") + cc.info(jarrNodes.length) + cc.debug(" skaled node(s)..." ) + "\n" );
    let nThreshold = discover_bls_threshold( g_joSChainNetworkInfo );
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "Discovered BLS threshold is ") + cc.info(nThreshold) + cc.debug("." ) + "\n" );
    if( nThreshold <= 0 ) {
        await fn( "signature error, S-Chain information was not discovered properly and BLS threshold is unknown", jarrMessages, null );
        return;
    }
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
        log.write( strLogPrefix + cc.debug( "Will collect " ) + cc.info(nThreshold) + cc.debug(" from ") + cc.info(jarrNodes.length) + cc.debug("nodes") + "\n" );
    for( let i = 0; i < jarrNodes.length; ++ i ) {
        let joNode = jarrNodes[ i ];
        let strNodeURL = compose_schain_node_url( joNode );
        await rpcCall.create( strNodeURL, async function( joCall, err ) {
            if( err ) {
                ++ nCountReceived; // including errors
                ++ nCountErrors;
                log.write( strLogPrefix + cc.fatal( "Error:" ) + cc.error( " JSON RPC call to S-Chain failed" ) + "\n" );
                return;
            }
            await joCall.call( {
                "method": "skale_imaVerifyAndSign",
                "params": {
                    "startMessageIdx": nIdxCurrentMsgBlockStart,
                    "dstChainID": "" + ( g_chain_id_main_net ? g_chain_id_main_net : "" ),
                    "srcChainID": "" + ( g_chain_id_s_chain ? g_chain_id_s_chain : "" ),
                    "messages": jarrMessages
                }
            }, function( joIn, joOut, err ) {
                ++ nCountReceived; // including errors
                if( err ) {
                    ++ nCountErrors;
                    log.write( strLogPrefix + cc.fatal( "Error:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) + "\n" );
                    return;
                }
                log.write( strLogPrefix + cc.normal( "Node ") + cc.info(joNode.nodeID) + cc.normal(" sign result: " )  + cc.j( joOut.result ? joOut.result : null ) + "\n" );
                try {
                    if( joOut.result.signResult.signatureShare.length > 0 && joOut.result.signResult.status == 0 ) {
                        let nZeroBasedNodeIndex = joNode.imaInfo.thisNodeIndex - 1;
                        //
                        //
                        //
                        //
                        // partial BLS verification for one participant
                        //
                        let bNodeSignatureOKay = false; // initially assume signature is wrong
                        let strLogPrefixA = cc.info("BLS") + cc.debug("/") + cc.notice("#") + cc.bright(nZeroBasedNodeIndex) + cc.debug(":") + " ";
                        try {
                            let arrTmp = joOut.result.signResult.signatureShare.split(":");
                            let joResultFromNode = {
                                "index": "" + nZeroBasedNodeIndex,
                                "signature": {
                                    "X": arrTmp[0],
                                    "Y": arrTmp[1]
                                }
                            };
                            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                                log.write( strLogPrefixA + cc.info( "Will verify sign result for node " ) + cc.info(nZeroBasedNodeIndex) + "\n" );
                            let joPublicKey = discover_public_key_by_index( nZeroBasedNodeIndex, g_joSChainNetworkInfo )
                            if( perform_bls_verify_i( nZeroBasedNodeIndex, joResultFromNode, jarrMessages, joPublicKey ) ) {
                                //if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                                    log.write( strLogPrefixA + cc.success( "Got succerssful BLS verification result for node " ) + cc.info(joNode.nodeID) + cc.success(" with index " ) + cc.info(nZeroBasedNodeIndex) + "\n" );
                                bNodeSignatureOKay = true; // node verification passed
                            } else {
                                strError = "BLS verify failed";
                                log.write( strLogPrefixA + cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError) + "\n" );
                            }
                        } catch( err ) {
                            log.write( strLogPrefixA + cc.fatal( "Node sign error:" ) + cc.error( " partial signature fail from node ") + cc.info(joNode.nodeID) + cc.error(" with index " ) + cc.info(nZeroBasedNodeIndex) + cc.error(", error is " ) + cc.warn(err.toString()) + "\n" );
                        }
                        //
                        //
                        //
                        //
                        //
                        //
                        //
                        // sign result for bls_glue shoild look like:
                        // {
                        //     "index": "1",
                        //     "signature": {
                        //         "X": "8184471694634630119550127539973704769190648951089883109386639469590492862134",
                        //         "Y": "4773775435244318964726085856452691379381914783621253742616578726383405809710"
                        //     }
                        // }
                        //
                        if( bNodeSignatureOKay )
                            arrSignResults.push( {
                                "index": "" + nZeroBasedNodeIndex,
                                "signature": split_signature_share( joOut.result.signResult.signatureShare ),
                                "fromNode": joNode, // extra, not needed for bls_glue
                                "signResult": joOut.result.signResult
                            } );
                        else
                            ++ nCountErrors;
                    }
                } catch( err ) {
                    ++ nCountErrors;
                    log.write( strLogPrefix + cc.fatal( "Error:" ) + cc.error( " signature fail from node ") + cc.info(joNode.nodeID) + cc.error(", error is " ) + cc.warn(err.toString()) + "\n" );
                }
            } );
        } );
    }
    let iv = setInterval( async function() {
        let cntSuccess = nCountReceived - nCountErrors;
        if( cntSuccess >= nThreshold ) {
            let strLogPrefixB = cc.info("BLS") + cc.debug("/") + cc.sunny("Summary") + cc.debug(":") + " ";
            clearInterval( iv );
            let strError = null;
            let joGlueResult = perform_bls_glue( jarrMessages, arrSignResults );
            if( joGlueResult ) {
                if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                    log.write( strLogPrefixB + cc.success( "Got BLS glue result: " ) + cc.j( joGlueResult ) + "\n" );
                if( g_strPathBlsVerify.length > 0 ) {
                    let joCommonPublicKey = discover_common_public_key( g_joSChainNetworkInfo );
                    if( perform_bls_verify( joGlueResult, jarrMessages, joCommonPublicKey ) ) {
                        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                            log.write( strLogPrefixB + cc.success( "Got succerssful summary BLS verification result" ) + "\n" );
                    } else {
                        strError = "BLS verify failed";
                        log.write( strLogPrefixB + cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError) + "\n" );
                    }
                }
            } else {
                strError = "BLS glue failed";
                log.write( strLogPrefixB + cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError) + "\n" );
            }
            await fn( strError, jarrMessages, joGlueResult );
            return;
        }
        if( nCountReceived >= jarrNodes.length ) {
            clearInterval( iv );
            await fn( "signature error in " + nCountErrors + " node(s) of " + jarrNodes.length + " node(s)", jarrMessages, null );
            return;
        }
    }, 100 );
}
