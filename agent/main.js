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
const ima_utils = require( "./utils.js" );
IMA.verbose_set( IMA.verbose_parse( "info" ) );
const log = ima_utils.log;
const cc = ima_utils.cc;
const w3mod = IMA.w3mod;
let rpcCall = require( "./rpc-call.js" );
rpcCall.init( cc, log );
let ethereumjs_tx = IMA.ethereumjs_tx;
let ethereumjs_wallet = IMA.ethereumjs_wallet;
let ethereumjs_util = IMA.ethereumjs_util;

let child_process = require( "child_process" );
var shell = require( "shelljs" );
const {
    Keccak
} = require( "sha3" );

function fn_address_impl_( w3 ) {
    if ( this.address_ == undefined || this.address_ == null )
        this.address_ = "" + IMA.private_key_2_account_address( w3, this.privateKey );
    return this.address_;
}

let imaState = {
    "strLogFilePath": "",
    "nLogMaxSizeBeforeRotation": -1,
    "nLogMaxFilesCount": -1,

    "bIsNeededCommonInit": true,
    "bSignMessages": false, // use BLS message signing, turned on with --sign-messages
    "joSChainNetworkInfo": null, // scanned S-Chain network description
    "strPathBlsGlue": "", // path to bls_glue app, nust have if --sign-messages specified
    "strPathHashG1": "", // path to hash_g1 app, nust have if --sign-messages specified
    "strPathBlsVerify": "", // path to verify_bls app, optional, if specified then we will verify gathered BLS signature

    // TO-DO: the next ABI JSON should contain main-net only contract info - S-chain contract addresses must be downloaded from S-chain
    "joTrufflePublishResult_main_net": {},
    "joTrufflePublishResult_s_chain": {},

    "joErc20_main_net": null,
    "joErc20_s_chain": null,

    "strAddrErc20_explicit": "",
    "strCoinNameErc20_main_net": "", // in-JSON coin name
    "strCoinNameErc20_s_chain": "", // in-JSON coin name

    "joErc721_main_net": null,
    "joErc721_s_chain": null,
    "strAddrErc721_explicit": "",
    "strCoinNameErc721_main_net": "", // in-JSON coin name
    "strCoinNameErc721_s_chain": "", // in-JSON coin name

    // deposit_box_address           --> deposit_box_abi
    // token_manager_address         --> token_manager_abi
    // message_proxy_mainnet_address --> message_proxy_mainnet_abi
    // message_proxy_chain_address   --> message_proxy_chain_abi

    "strPathAbiJson_main_net": ima_utils.normalizePath( "../proxy/data/proxyMainnet.json" ), // "./abi_main_net.json"
    "strPathAbiJson_s_chain": ima_utils.normalizePath( "../proxy/data/proxySchain.json" ), // "./abi_s_chain.json"

    "bShowConfigMode": false, // true - just show configuratin values and exit

    "strURL_main_net": "", // example: "http://127.0.0.1:8545"
    "strURL_s_chain": "", // example: "http://127.0.0.1:2231"

    "strChainID_main_net": "Mainnet",
    "strChainID_s_chain": "id-S-chain",

    "strPathJsonErc20_main_net": "",
    "strPathJsonErc20_s_chain": "",

    "strPathJsonErc721_main_net": "",
    "strPathJsonErc721_s_chain": "",

    "nAmountOfWei": 0, // 1000000000000000000
    "nAmountOfToken": 0,
    "idToken": 0,
    "isRawTokenTransfer": true,
    "isRawTokenTransfer_EXPLICIT": false,

    "nTransferBlockSizeM2S": 10,
    "nTransferBlockSizeS2M": 10,
    "nMaxTransactionsM2S": 0,
    "nMaxTransactionsS2M": 0,

    "nBlockAwaitDepthM2S": 0,
    "nBlockAwaitDepthS2M": 0,
    "nBlockAgeM2S": 0,
    "nBlockAgeS2M": 0,

    "nLoopPeriodSeconds": 10,

    "nNodeNumber": 0, // S-Chain node number(zero based)
    "nNodesCount": 1,
    "nTimeFrameSeconds": 0, // 0-disable, 60-recommended
    "nNextFrameGap": 10,

    "w3http_main_net": null,
    "w3_main_net": null,

    "w3http_s_chain": null,
    "w3_s_chain": null,

    "jo_deposit_box": null, // only main net
    "jo_token_manager": null, // only s-chain
    "jo_message_proxy_main_net": null,
    "jo_message_proxy_s_chain": null,
    "jo_lock_and_data_main_net": null,
    "jo_lock_and_data_s_chain": null,
    // "eth_erc721": null, // only s-chain
    "eth_erc20": null, // only s-chain

    //
    ////"joAccount_main_net": { "name": "Stan", "privateKey": "621761908cc4fba5f92e694e0e4a912aa9a12258a597a06783713a04610fad59", "address": fn_address_impl_ }; // "address": "0x6196d135CdDb9d73A0756C1E44b5b02B11acf594"
    // "joAccount_main_net": { "name": "g3",   "privateKey": "23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc", "address": fn_address_impl_ }, // "address": "0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f"
    // "joAccount_s_chain ": { "name": "Bob",  "privateKey": "80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e", "address": fn_address_impl_ }, // "address": "0x66c5a87f4a49DD75e970055A265E8dd5C3F8f852"
    //
    // "joAccount_main_net": { "name": "g2",    "privateKey": "39cb49d82f7e20ad26f2863f74de198f7d5be3aa9b3ec58fbd641950da30acd8", "address": fn_address_impl_ }, // "address": "0x6595b3d58c80db0cc6d50ca5e5f422e6134b07a8"
    // "joAccount_s_chain ": { "name": "Alice", "privateKey": "1800d6337966f6410905a6bf9af370ac2f55c7428854d995cfa719e061ac0dca", "address": fn_address_impl_ }, // "address": "0x651054E818a0E022Bbb681Aa3b657386f20845F5"
    //
    // "joAccount_main_net": { "name": "g1",     "privateKey": "2a95a383114492b90a6eecbc355d7b63501ffb72ed39a788e48aa3c286eb526d", "address": fn_address_impl_ }, // "address": "0x12b907ebaea975ce4d5de010cdf680ad21dc4ca1"
    // "joAccount_s_chain ": { "name": "Alex",   "privateKey": "d47f07804006486dbeba6b81e50fc93543657853a3d2f736d4fd68488ca94c17", "address": fn_address_impl_ }, // "address": "0x8e8311f4c4533f4C19363d6140e1D5FA16Aa4071"
    //
    "joAccount_main_net": { "privateKey": "", "address": fn_address_impl_ },
    "joAccount_s_chain": { "privateKey": "", "address": fn_address_impl_ },
    //

    "arrActions": [] // array of actions to run
};

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
        imaState.strPathAbiJson_main_net = ima_utils.normalizePath( joArg.value );
        continue;
    }
    if ( joArg.name == "abi-s-chain" ) {
        veryify_arg_path_to_existing_file( joArg );
        imaState.strPathAbiJson_s_chain = ima_utils.normalizePath( joArg.value );
        continue;
    }
    //
    //
    if ( joArg.name == "erc721-main-net" ) {
        veryify_arg_path_to_existing_file( joArg );
        imaState.strPathJsonErc721_main_net = ima_utils.normalizePath( joArg.value );
        continue;
    }
    if ( joArg.name == "erc721-s-chain" ) {
        veryify_arg_path_to_existing_file( joArg );
        imaState.strPathJsonErc721_s_chain = ima_utils.normalizePath( joArg.value );
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
        imaState.strPathJsonErc20_main_net = ima_utils.normalizePath( joArg.value );
        continue;
    }
    if ( joArg.name == "erc20-s-chain" ) {
        veryify_arg_path_to_existing_file( joArg );
        imaState.strPathJsonErc20_s_chain = ima_utils.normalizePath( joArg.value );
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
    if ( joArg.name == "register" ) {
        imaState.arrActions.push( {
            "name": "Full registration(all steps)",
            "fn": async function() {
                return await register_all();
            }
        } );
        continue;
    }
    if ( joArg.name == "register1" ) {
        imaState.arrActions.push( {
            "name": "Registration step 1, register S-Chain on Main-net",
            "fn": async function() {
                return await register_step1();
            }
        } );
        continue;
    }
    if ( joArg.name == "register2" ) {
        imaState.arrActions.push( {
            "name": "Registration step 2, register S-Chain in deposit box",
            "fn": async function() {
                return await register_step2();
            }
        } );
        continue;
    }
    if ( joArg.name == "register3" ) {
        imaState.arrActions.push( {
            "name": "Registration step 3, register Main-net deposit box on S-Chain",
            "fn": async function() {
                return await register_step3();
            }
        } );
        continue;
    }
    if ( joArg.name == "check-registration" ) {
        imaState.arrActions.push( {
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
        imaState.arrActions.push( {
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
        imaState.arrActions.push( {
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
        imaState.arrActions.push( {
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
        imaState.arrActions.push( {
            "name": "one M->S single payment",
            "fn": async function() {
                if ( imaState.strCoinNameErc721_main_net.length > 0 /*&& imaState.strCoinNameErc721_s_chain.length > 0*/ ) {
                    // ERC721 payment
                    log.write( cc.info( "one M->S single ERC721 payment: " ) + cc.sunny( imaState.idToken ) + "\n" ); // just print value
                    return await IMA.do_erc721_payment_from_main_net(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.joAccount_main_net,
                        imaState.joAccount_s_chain,
                        imaState.jo_deposit_box, // only main net
                        imaState.jo_message_proxy_main_net, // for checking logs
                        imaState.jo_lock_and_data_main_net, // for checking logs
                        imaState.strChainID_s_chain,
                        imaState.idToken, // which ERC721 token id to send
                        imaState.jo_token_manager, // only s-chain
                        imaState.strCoinNameErc721_main_net,
                        imaState.joErc721_main_net,
                        imaState.strCoinNameErc721_s_chain,
                        imaState.joErc721_s_chain,
                        imaState.isRawTokenTransfer
                    );
                }
                if ( imaState.strCoinNameErc20_main_net.length > 0 /*&& imaState.strCoinNameErc20_s_chain.length > 0*/ ) {
                    // ERC20 payment
                    log.write( cc.info( "one M->S single ERC20 payment: " ) + cc.sunny( imaState.nAmountOfToken ) + "\n" ); // just print value
                    return await IMA.do_erc20_payment_from_main_net(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.joAccount_main_net,
                        imaState.joAccount_s_chain,
                        imaState.jo_deposit_box, // only main net
                        imaState.jo_message_proxy_main_net, // for checking logs
                        imaState.jo_lock_and_data_main_net, // for checking logs
                        imaState.strChainID_s_chain,
                        imaState.nAmountOfToken, // how much ERC20 tokens to send
                        imaState.jo_token_manager, // only s-chain
                        imaState.strCoinNameErc20_main_net,
                        imaState.joErc20_main_net,
                        imaState.strCoinNameErc20_s_chain,
                        imaState.joErc20_s_chain,
                        imaState.isRawTokenTransfer
                    );
                }
                // ETH payment
                log.write( cc.info( "one M->S single ETH payment: " ) + cc.sunny( imaState.nAmountOfWei ) + "\n" ); // just print value
                return await IMA.do_eth_payment_from_main_net(
                    imaState.w3_main_net,
                    imaState.joAccount_main_net,
                    imaState.joAccount_s_chain,
                    imaState.jo_deposit_box, // only main net
                    imaState.jo_message_proxy_main_net, // for checking logs
                    imaState.jo_lock_and_data_main_net, // for checking logs
                    imaState.strChainID_s_chain,
                    imaState.nAmountOfWei // how much WEI money to send
                );
            }
        } );
        continue;
    }
    if ( joArg.name == "s2m-payment" ) {
        imaState.arrActions.push( {
            "name": "one S->M single payment",
            "fn": async function() {
                if ( imaState.strCoinNameErc721_s_chain.length > 0 ) {
                    // ERC721 payment
                    log.write( cc.info( "one S->M single ERC721 payment: " ) + cc.sunny( imaState.idToken ) + "\n" ); // just print value
                    return await IMA.do_erc721_payment_from_s_chain(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.joAccount_s_chain,
                        imaState.joAccount_main_net,
                        imaState.jo_token_manager, // only s-chain
                        imaState.jo_message_proxy_s_chain, // for checking logs
                        imaState.jo_deposit_box, // only main net
                        imaState.idToken, // which ERC721 token id to send
                        imaState.strCoinNameErc721_main_net,
                        imaState.joErc721_main_net,
                        imaState.strCoinNameErc721_s_chain,
                        imaState.joErc721_s_chain,
                        imaState.isRawTokenTransfer
                    );
                }
                if ( imaState.strCoinNameErc20_s_chain.length > 0 ) {
                    // ERC20 payment
                    log.write( cc.info( "one S->M single ERC20 payment: " ) + cc.sunny( imaState.nAmountOfToken ) + "\n" ); // just print value
                    return await IMA.do_erc20_payment_from_s_chain(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.joAccount_s_chain,
                        imaState.joAccount_main_net,
                        imaState.jo_token_manager, // only s-chain
                        imaState.jo_message_proxy_s_chain, // for checking logs
                        imaState.jo_deposit_box, // only main net
                        imaState.nAmountOfToken, // how ERC20 tokens money to send
                        imaState.strCoinNameErc20_main_net,
                        imaState.joErc20_main_net,
                        imaState.strCoinNameErc20_s_chain,
                        imaState.joErc20_s_chain,
                        imaState.isRawTokenTransfer
                    );
                }
                // ETH payment
                log.write( cc.info( "one S->M single ETH payment: " ) + cc.sunny( imaState.nAmountOfWei ) + "\n" ); // just print value
                return await IMA.do_eth_payment_from_s_chain(
                    imaState.w3_s_chain,
                    imaState.joAccount_s_chain,
                    imaState.joAccount_main_net,
                    imaState.jo_token_manager, // only s-chain
                    imaState.jo_message_proxy_s_chain, // for checking logs
                    imaState.nAmountOfWei // how much WEI money to send
                );
            }
        } );
        continue;
    }
    if ( joArg.name == "s2m-receive" ) {
        imaState.arrActions.push( {
            "name": "receive one S->M single ETH payment",
            "fn": async function() {
                log.write( cc.info( "receive one S->M single ETH payment: " ) + "\n" ); // just print value
                return await IMA.receive_eth_payment_from_s_chain_on_main_net(
                    imaState.w3_main_net,
                    imaState.joAccount_main_net,
                    imaState.jo_lock_and_data_main_net
                );
            }
        } );
        continue;
    }
    if ( joArg.name == "s2m-view" ) {
        imaState.arrActions.push( {
            "name": "view one S->M single ETH payment",
            "fn": async function() {
                log.write( cc.info( "view one S->M single ETH payment: " ) + "\n" ); // just print value
                let xWei = await IMA.view_eth_payment_from_s_chain_on_main_net(
                    imaState.w3_main_net,
                    imaState.joAccount_main_net,
                    imaState.jo_lock_and_data_main_net
                );
                if ( xWei === null || xWei === undefined )
                    return false;
                let xEth = imaState.w3_main_net.utils.fromWei( xWei, "ether" );
                log.write( cc.success( "Main-net user can receive: " ) + cc.attention( xWei ) + cc.success( " wei = " ) + cc.attention( xEth ) + cc.success( " eth" ) + "\n" );
                return true;
            }
        } );
        continue;
    }
    if ( joArg.name == "m2s-transfer" ) {
        imaState.arrActions.push( {
            "name": "single M->S transfer loop",
            "fn": async function() {
                return await IMA.do_transfer( // main-net --> s-chain
                    /**/
                    imaState.w3_main_net,
                    imaState.jo_message_proxy_main_net,
                    imaState.joAccount_main_net,
                    imaState.w3_s_chain,
                    imaState.jo_message_proxy_s_chain,
                    /**/
                    imaState.joAccount_s_chain,
                    imaState.strChainID_main_net,
                    imaState.strChainID_s_chain,
                    null, // imaState.jo_deposit_box, // for logs validation on mainnet
                    imaState.jo_token_manager, // for logs validation on s-chain
                    imaState.nTransferBlockSizeM2S,
                    imaState.nMaxTransactionsM2S,
                    imaState.nBlockAwaitDepthM2S,
                    imaState.nBlockAgeM2S,
                    null // fn_sign_messages
                );
            }
        } );
        continue;
    }
    if ( joArg.name == "s2m-transfer" ) {
        imaState.arrActions.push( {
            "name": "single S->M transfer loop",
            "fn": async function() {
                return await IMA.do_transfer( // s-chain --> main-net
                    /**/
                    imaState.w3_s_chain,
                    imaState.jo_message_proxy_s_chain,
                    imaState.joAccount_s_chain,
                    imaState.w3_main_net,
                    imaState.jo_message_proxy_main_net,
                    /**/
                    imaState.joAccount_main_net,
                    imaState.strChainID_s_chain,
                    imaState.strChainID_main_net,
                    imaState.jo_deposit_box, // for logs validation on mainnet
                    null, // imaState.jo_token_manager, // for logs validation on s-chain
                    imaState.nTransferBlockSizeS2M,
                    imaState.nMaxTransactionsS2M,
                    imaState.nBlockAwaitDepthS2M,
                    imaState.nBlockAgeS2M,
                    do_sign_messages // fn_sign_messages
                );
            }
        } );
        continue;
    }
    if ( joArg.name == "transfer" ) {
        imaState.arrActions.push( {
            "name": "Single M<->S transfer loop iteration",
            "fn": async function() {
                return await single_transfer_loop();
            }
        } );
        continue;
    }
    if ( joArg.name == "loop" ) {
        imaState.arrActions.push( {
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
    if ( joArg.name == "browse-s-chain" ) {
        imaState.bIsNeededCommonInit = false;
        imaState.arrActions.push( {
            "name": "Brows S-Chain network",
            "fn": async function() {
                let strLogPrefix = cc.info("S Browse:") + " ";
                if( imaState.strURL_s_chain.length == 0 ) {
                    console.log( cc.fatal( "Error:" ) + cc.error( " missing S-Chain URL, please specify " ) + cc.info( "url-s-chain" ) );
                    process.exit( 501 );
                }
                log.write( strLogPrefix + cc.normal( "Downloading S-Chain network information " )  + cc.normal( "..." ) + "\n" ); // just print value
                //
                await rpcCall.create( imaState.strURL_s_chain, async function( joCall, err ) {
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

if ( imaState.strLogFilePath.length > 0 ) {
    log.write( cc.debug( "Will print message to file " ) + cc.info( imaState.strLogFilePath ) + "\n" );
    log.add( imaState.strLogFilePath, imaState.nLogMaxSizeBeforeRotation, imaState.nLogMaxFilesCount );
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
        strPath = ima_utils.normalizePath( strPath );
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
        if ( imaState.nTimeFrameSeconds <= 0 || imaState.nNodesCount <= 1 )
            return true; // time framing is disabled
        if ( d = null || d == undefined )
            d = new Date(); // now
        var nUtcUnixTimeStamp = Math.floor( d.valueOf() / 1000 ); // Unix UTC timestamp, see https://stackoverflow.com/questions/9756120/how-do-i-get-a-utc-timestamp-in-javascript
        var nSecondsRangeForAllSChains = imaState.nTimeFrameSeconds * imaState.nNodesCount;
        var nMod = Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
        var nActiveNodeFrameIndex = Math.floor( nMod / imaState.nTimeFrameSeconds );
        var bSkip = ( nActiveNodeFrameIndex != imaState.nNodeNumber ) ? true : false,
            bInsideGap = false;
        if ( !bSkip ) {
            var nRangeStart = nUtcUnixTimeStamp - Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
            var nFrameStart = nRangeStart + imaState.nNodeNumber * imaState.nTimeFrameSeconds;
            var nGapStart = nFrameStart + imaState.nTimeFrameSeconds - imaState.nNextFrameGap;
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
                cc.info( "Testing Frame Index" ) + cc.debug( "........" ) + cc.notice( imaState.nNodeNumber ) + "\n" +
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

function common_init() {
    imaState.joTrufflePublishResult_main_net = ima_utils.jsonFileLoad( imaState.strPathAbiJson_main_net, null, true );
    imaState.joTrufflePublishResult_s_chain = ima_utils.jsonFileLoad( imaState.strPathAbiJson_s_chain, null, true );

    ima_utils.check_keys_exist_in_abi( "main-net", imaState.strPathAbiJson_main_net, imaState.joTrufflePublishResult_main_net, [ "deposit_box_abi", "deposit_box_address", "message_proxy_mainnet_abi", "message_proxy_mainnet_address" ] );
    ima_utils.check_keys_exist_in_abi( "S-Chain", imaState.strPathAbiJson_s_chain, imaState.joTrufflePublishResult_s_chain, [ "token_manager_abi", "token_manager_address", "message_proxy_chain_abi", "message_proxy_chain_address" ] );

    // deposit_box_address           --> deposit_box_abi
    // token_manager_address         --> token_manager_abi
    // message_proxy_mainnet_address --> message_proxy_mainnet_abi
    // message_proxy_chain_address   --> message_proxy_chain_abi

    if ( imaState.strURL_main_net.length == 0 ) {
        log.write( cc.fatal( "FATAL:" ) + cc.error( "Missing " ) + cc.warning( "Main-net" ) + cc.error( " URL in command line arguments" ) + "\n" );
        process.exit( 501 );
    }
    if ( imaState.strURL_s_chain.length == 0 ) {
        log.write( cc.fatal( "FATAL:" ) + cc.error( "Missing " ) + cc.warning( "S-Chain" ) + cc.error( " URL in command line arguments" ) + "\n" );
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
        imaState.joErc721_main_net = ima_utils.jsonFileLoad( imaState.strPathJsonErc721_main_net, null, true );
        n1 = Object.keys( imaState.joErc721_main_net ).length;
        if ( imaState.strPathJsonErc721_s_chain.length > 0 ) {
            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC721 ABI from " ) + cc.info( imaState.strPathJsonErc721_s_chain ) + "\n" );
            imaState.joErc721_s_chain = ima_utils.jsonFileLoad( imaState.strPathJsonErc721_s_chain, null, true );
            n2 = Object.keys( imaState.joErc721_s_chain ).length;
        }
        if ( n1 > 0 /*&& n2 > 0*/ ) {
            imaState.strCoinNameErc721_main_net = ima_utils.discover_in_json_coin_name( imaState.joErc721_main_net );
            if ( n2 > 0 )
                imaState.strCoinNameErc721_s_chain = ima_utils.discover_in_json_coin_name( imaState.joErc721_s_chain );
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
                    log.write( cc.fatal( "FATAL:" ) + cc.error( "Main-net ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                if ( n2 == 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
                    log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc721_main_net = null;
                imaState.joErc721_s_chain = null;
                imaState.strCoinNameErc721_main_net = "";
                imaState.strCoinNameErc721_s_chain = "";
                process.exit( 666 );
            }
        } else {
            if ( n1 == 0 )
                log.write( cc.fatal( "FATAL:" ) + cc.error( "Main-net ERC721 JSON is invalid" ) + "\n" );
            if ( n2 == 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
                log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC721 JSON is invalid" ) + "\n" );
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
            imaState.joErc721_s_chain = ima_utils.jsonFileLoad( imaState.strPathJsonErc721_s_chain, null, true );
            n2 = Object.keys( imaState.joErc721_s_chain ).length;

            if ( n2 > 0 ) {
                imaState.strCoinNameErc721_s_chain = ima_utils.discover_in_json_coin_name( imaState.joErc721_s_chain );
                n2 = imaState.strCoinNameErc721_s_chain.length;
                if ( n2 > 0 )
                    log.write( cc.info( "Loaded S-Chain  ERC721 ABI " ) + cc.attention( imaState.strCoinNameErc721_s_chain ) + "\n" );
                else {
                    if ( n2 == 0 && imaState.strPathJsonErc721_s_chain.length > 0 )
                        log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC721 token name is not discovered (malformed JSON)" ) + "\n" );
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
        imaState.joErc20_main_net = ima_utils.jsonFileLoad( imaState.strPathJsonErc20_main_net, null, true );
        n1 = Object.keys( imaState.joErc20_main_net ).length;
        if ( imaState.strPathJsonErc20_s_chain.length > 0 ) {
            if ( IMA.verbose_get() > IMA.RV_VERBOSE.information )
                log.write( cc.info( "Loading S-Chain ERC20 ABI from " ) + cc.info( imaState.strPathJsonErc20_s_chain ) + "\n" );
            imaState.joErc20_s_chain = ima_utils.jsonFileLoad( imaState.strPathJsonErc20_s_chain, null, true );
            n2 = Object.keys( imaState.joErc20_s_chain ).length;
        }
        if ( n1 > 0 /*&& n2 > 0*/ ) {
            imaState.strCoinNameErc20_main_net = ima_utils.discover_in_json_coin_name( imaState.joErc20_main_net );
            if ( n2 > 0 )
                imaState.strCoinNameErc20_s_chain = ima_utils.discover_in_json_coin_name( imaState.joErc20_s_chain );
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
                    log.write( cc.fatal( "FATAL:" ) + cc.error( "Main-net ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                if ( n2 == 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
                    log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
                imaState.joErc20_main_net = null;
                imaState.joErc20_s_chain = null;
                imaState.strCoinNameErc20_main_net = "";
                imaState.strCoinNameErc20_s_chain = "";
                process.exit( 666 );
            }
        } else {
            if ( n1 == 0 )
                log.write( cc.fatal( "FATAL:" ) + cc.error( "Main-net ERC20 JSON is invalid" ) + "\n" );
            if ( n2 == 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
                log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC20 JSON is invalid" ) + "\n" );
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
            imaState.joErc20_s_chain = ima_utils.jsonFileLoad( imaState.strPathJsonErc20_s_chain, null, true );
            n2 = Object.keys( imaState.joErc20_s_chain ).length;

            if ( n2 > 0 ) {
                imaState.strCoinNameErc20_s_chain = ima_utils.discover_in_json_coin_name( imaState.joErc20_s_chain );
                n2 = imaState.strCoinNameErc20_s_chain.length;
                if ( n2 > 0 )
                    log.write( cc.info( "Loaded S-Chain  ERC20 ABI " ) + cc.attention( imaState.strCoinNameErc20_s_chain ) + "\n" );
                else {
                    if ( n2 == 0 && imaState.strPathJsonErc20_s_chain.length > 0 )
                        log.write( cc.fatal( "FATAL:" ) + cc.error( "S-Chain ERC20 token name is not discovered (malformed JSON)" ) + "\n" );
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
        ensure_have_value( "Main-net Ethereum network ID", imaState.strChainID_main_net, false, true, null, ( x ) => {
            return cc.note( x );
        } );
        ensure_have_value( "S-Chain Ethereum network ID", imaState.strChainID_s_chain, false, true, null, ( x ) => {
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
} // common_init

if( imaState.bIsNeededCommonInit )
    common_init();

if ( imaState.bShowConfigMode ) {
    // just show configuratin values and exit
    return true;
}

async function discover_s_chain_network( fnAfter ) {
    let strLogPrefix = cc.info("S net discover:") + " ";
    fnAfter = fnAfter || function() {};
    let joSChainNetworkInfo = null;
    await rpcCall.create( imaState.strURL_s_chain, async function( joCall, err ) {
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
    let idxAction, cntActions = imaState.arrActions.length,
        cntFalse = 0,
        cntTrue = 0;
    for ( idxAction = 0; idxAction < cntActions; ++idxAction ) {
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
        var joAction = imaState.arrActions[ idxAction ],
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

if( imaState.bSignMessages ) {
    if( imaState.strPathBlsGlue.length == 0 ) {
        log.write( cc.fatal( "FATAL" ) + cc.error( " please specify --bls-glue parameter." ) + "\n" );
        process.exit( 666 );
    }
    if( imaState.strPathHashG1.length == 0 ) {
        log.write( cc.fatal( "FATAL" ) + cc.error( " please specify --hash-g1 parameter." ) + "\n" );
        process.exit( 666 );
    }
    discover_s_chain_network( function( err, joSChainNetworkInfo ) {
        if( err )
            process.exit( 1 ); // error information is printed by discover_s_chain_network()
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
           log.write( cc.success( "S-Chain network was discovered: " )  + cc.j( joSChainNetworkInfo ) + "\n" );
        imaState.joSChainNetworkInfo = joSChainNetworkInfo;
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
        imaState.w3_main_net,
        imaState.jo_message_proxy_main_net,
        imaState.joAccount_main_net,
        imaState.strChainID_s_chain
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
        imaState.w3_main_net,
        //imaState.jo_deposit_box, // only main net
        imaState.jo_lock_and_data_main_net,
        imaState.joAccount_main_net,
        imaState.jo_token_manager, // only s-chain
        imaState.strChainID_s_chain
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
        imaState.w3_s_chain,
        //imaState.jo_token_manager, // only s-chain
        imaState.jo_deposit_box, // only main net
        imaState.jo_lock_and_data_s_chain,
        imaState.joAccount_s_chain
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
        imaState.w3_main_net,
        imaState.jo_message_proxy_main_net,
        imaState.joAccount_main_net,
        imaState.strChainID_s_chain
    );
    return bRetVal;
}
async function check_registeration_step2() {
    var bRetVal = await IMA.check_is_registered_s_chain_in_deposit_box( // step 2
        imaState.w3_main_net,
        imaState.jo_lock_and_data_main_net,
        imaState.joAccount_main_net,
        imaState.strChainID_s_chain
    );
    return bRetVal;
}
async function check_registeration_step3() {
    var bRetVal = await IMA.check_is_registered_main_net_depositBox_on_s_chain( // step 3
        imaState.w3_s_chain,
        imaState.jo_lock_and_data_s_chain,
        imaState.joAccount_s_chain
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
        imaState.w3_main_net,
        imaState.jo_message_proxy_main_net,
        imaState.joAccount_main_net,
        imaState.w3_s_chain,
        imaState.jo_message_proxy_s_chain,
        /**/
        imaState.joAccount_s_chain,
        imaState.strChainID_main_net,
        imaState.strChainID_s_chain,
        null, // imaState.jo_deposit_box, // for logs validation on mainnet
        imaState.jo_token_manager, // for logs validation on s-chain
        imaState.nTransferBlockSizeM2S,
        imaState.nMaxTransactionsM2S,
        imaState.nBlockAwaitDepthM2S,
        imaState.nBlockAgeM2S,
        null // fn_sign_messages
    );
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "M2S transfer done: " ) + cc.tf(b1) + "\n" );
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "Will invoke S2M transfer..." ) + "\n" );
    var b2 = await IMA.do_transfer( // s-chain --> main-net
        /**/
        imaState.w3_s_chain,
        imaState.jo_message_proxy_s_chain,
        imaState.joAccount_s_chain,
        imaState.w3_main_net,
        imaState.jo_message_proxy_main_net,
        /**/
        imaState.joAccount_main_net,
        imaState.strChainID_s_chain,
        imaState.strChainID_main_net,
        imaState.jo_deposit_box, // for logs validation on mainnet
        null, // imaState.jo_token_manager, // for logs validation on s-chain
        imaState.nTransferBlockSizeS2M,
        imaState.nMaxTransactionsS2M,
        imaState.nBlockAwaitDepthS2M,
        imaState.nBlockAgeS2M,
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
    setTimeout( single_transfer_loop_with_repeat, imaState.nLoopPeriodSeconds * 1000 );
};
async function run_transfer_loop() {
    await single_transfer_loop_with_repeat();
    //setTimeout( single_transfer_loop_with_repeat, imaState.nLoopPeriodSeconds*1000 );
    return true;
}

function discover_bls_threshold( joSChainNetworkInfo ) {
    let jarrNodes = imaState.joSChainNetworkInfo.network;
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
    let jarrNodes = imaState.joSChainNetworkInfo.network;
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
    let jarrNodes = imaState.joSChainNetworkInfo.network;
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
    let jarrNodes = imaState.joSChainNetworkInfo.network;
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

function compose_one_message_byte_sequence( joMessage ) {
    let w3 = imaState.w3_s_chain ? imaState.w3_s_chain : imaState.w3_main_net;
    if( ! w3 )
        throw new Error( "w3.utils is needed for BN operations" );
    let arrBytes = new Uint8Array();

    let bytesSender = ima_utils.hexToBytes( joMessage.sender );
    bytesSender = ima_utils.invertArrayItemsLR( bytesSender );
    bytesSender = ima_utils.bytesAlighLeftWithZeroes( bytesSender, 32 )
    bytesSender = ima_utils.invertArrayItemsLR( bytesSender );
    arrBytes = ima_utils.bytesConcat( arrBytes, bytesSender );
    //
    let bytesDestinationContract = ima_utils.hexToBytes( joMessage.destinationContract );
    bytesDestinationContract = ima_utils.invertArrayItemsLR( bytesDestinationContract );
    bytesDestinationContract = ima_utils.bytesAlighLeftWithZeroes( bytesDestinationContract, 32 )
    bytesDestinationContract = ima_utils.invertArrayItemsLR( bytesDestinationContract );
    arrBytes = ima_utils.bytesConcat( arrBytes, bytesDestinationContract );
    //
    let bytesTo = ima_utils.hexToBytes( joMessage.to );
    bytesTo = ima_utils.invertArrayItemsLR( bytesTo );
    bytesTo = ima_utils.bytesAlighLeftWithZeroes( bytesTo, 32 )
    bytesTo = ima_utils.invertArrayItemsLR( bytesTo );
    arrBytes = ima_utils.bytesConcat( arrBytes, bytesTo );
    //
    let strHexAmount = "0x" + w3.utils.toBN( joMessage.amount ).toString(16);
    let bytesAmount = ima_utils.hexToBytes( strHexAmount );
    //bytesAmount = ima_utils.invertArrayItemsLR( bytesAmount );
    bytesAmount = ima_utils.bytesAlighLeftWithZeroes( bytesAmount, 32 )
    arrBytes = ima_utils.bytesConcat( arrBytes, bytesAmount );
    //
    let bytesData = ima_utils.hexToBytes( joMessage.data );
    bytesData = ima_utils.invertArrayItemsLR( bytesData );
    arrBytes = ima_utils.bytesConcat( arrBytes, bytesData );
    //
    return arrBytes;
}

function compose_summary_message_to_sign( jarrMessages, isHash ) {
    let arrBytes = "";
    let i = 0, cnt = jarrMessages.length;
    for( i = 0; i < cnt; ++ i ) {
        let joMessage = jarrMessages[ i ];
        let arrMessageBytes = compose_one_message_byte_sequence( joMessage );
        arrBytes = ima_utils.bytesConcat( arrBytes, arrMessageBytes );
    }
    let strSummaryMessage = "";
    if( isHash ) {
        const hash = new Keccak( 256 );
        hash.update( ima_utils.toBuffer( arrBytes ) );
        strSummaryMessage = hash.digest( "hex" );
    } else
        strSummaryMessage = "0x" + ima_utils.bytesToHex( arrBytes );
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
    let strActionDir = get_bls_glue_tmp_dir() + "/" + ima_utils.replaceAll( ima_utils.uuid(), "-", "" );
    shell.mkdir( "-p", strActionDir );
    return strActionDir;
}

function perform_bls_glue( jarrMessages, arrSignResults ) {
    let strLogPrefix = cc.info("BLS") + cc.debug("/") + cc.attention("Glue") + cc.debug(":") + " ";
    let joGlueResult = null;
    let jarrNodes = imaState.joSChainNetworkInfo.network;
    let nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    let nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
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
            ima_utils.jsonFileSave( strPath, jo );
            strInput += " --input " + strPath;
        }
        let strGlueCommand =
            imaState.strPathBlsGlue +
            " --t " + nThreshold +
            " --n " + nParticipants +
            strInput +
            " --output " + strActionDir + "/glue-result.json";
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "Will execute BLS glue command:\n" ) + cc.notice( strGlueCommand ) + "\n" );
        strOutput = child_process.execSync( strGlueCommand );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "BLS glue output is:\n" ) + cc.notice( strOutput ) + "\n" );
        joGlueResult = ima_utils.jsonFileLoad( strActionDir + "/glue-result.json" );
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
            ima_utils.jsonFileSave( strPath, { "message": strSummaryMessage } );
            let strHasG1Command =
                imaState.strPathHashG1 +
                " --t " + nThreshold +
                " --n " + nParticipants;
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "Will execute HashG1 command:\n" ) + cc.notice( strHasG1Command ) + "\n" );
            strOutput = child_process.execSync( strHasG1Command );
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "HashG1 output is:\n" ) + cc.notice( strOutput ) + "\n" );
            let joResultHashG1 = ima_utils.jsonFileLoad( strActionDir + "/g1.json" );
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
    let nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    let nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
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
        ima_utils.jsonFileSave( strSignResultFileName, joResultFromNode );
        ima_utils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        ima_utils.jsonFileSave( strActionDir + "/BLS_keys" + nZeroBasedNodeIndex + ".json", joPublicKey );
        let strVerifyCommand = ""
            + imaState.strPathBlsVerify
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
    let nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    let nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
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
        ima_utils.jsonFileSave( strActionDir + "/glue-result.json", joGlueResult );
        ima_utils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        ima_utils.jsonFileSave( strActionDir + "/common_public_key.json", joCommonPublicKey );
        let strVerifyCommand = ""
            + imaState.strPathBlsVerify
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
    if( ! ( imaState.bSignMessages && imaState.strPathBlsGlue.length > 0 && imaState.joSChainNetworkInfo ) ) {
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
    let jarrNodes = imaState.joSChainNetworkInfo.network;
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "Will query to sign ") + cc.info(jarrNodes.length) + cc.debug(" skaled node(s)..." ) + "\n" );
    let nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
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
                    "dstChainID": "" + ( imaState.strChainID_main_net ? imaState.strChainID_main_net : "" ),
                    "srcChainID": "" + ( imaState.strChainID_s_chain ? imaState.strChainID_s_chain : "" ),
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
                            let joPublicKey = discover_public_key_by_index( nZeroBasedNodeIndex, imaState.joSChainNetworkInfo )
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
                if( imaState.strPathBlsVerify.length > 0 ) {
                    let joCommonPublicKey = discover_common_public_key( imaState.joSChainNetworkInfo );
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
