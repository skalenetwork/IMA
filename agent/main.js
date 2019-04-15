/*
# Notice: we need special truffle version: npm install -g truffle@4.1.13

#
#
// register: node ./main.js --register ........
// test invoke: node ./main.js --loop --time-framing=10 --time-gap=3 --period=2 --node-number=0 --nodes-count=2
node ./main.js --load-node-config=~/Work/SkaleExperimental/skaled-tests/single-node/run-skaled/config0.json --loop --time-framing=10 --time-gap=3 --period=2
*/



//
//
// init very basics
const fs   = require( "fs" );
const path = require( "path" );
const url  = require( "url" );
const os   = require( "os" );
const MTA  = require( "../npms/skale-mta" );
     MTA.verbose_set( MTA.verbose_parse( "info" ) );
const log = require( "../npms/skale-log/log.js" );
const cc  = log.cc;
const w3mod = MTA.w3mod;
let ethereumjs_tx     = MTA.ethereumjs_tx;
let ethereumjs_wallet = MTA.ethereumjs_wallet;
let ethereumjs_util   = MTA.ethereumjs_util;

// TO-DO: the next ABI JSON should contain main-net only contract info - S-chain contract addresses must be downloaded from S-chain
let joTrufflePublishResult_main_net = {};
let joTrufflePublishResult_s_chain  = {};

// deposit_box_address           --> deposit_box_abi
// token_manager_address         --> token_manager_abi
// message_proxy_mainnet_address --> message_proxy_mainnet_abi
// message_proxy_chain_address   --> message_proxy_chain_abi

let g_strPathAbiJson_main_net = normalize_path( "./abi_main_net.json" );
let g_strPathAbiJson_s_chain  = normalize_path( "./abi_s_chain.json"  );

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
    var isLog = isLog || false, strMsg = cc.info(g_strAppName) + cc.debug(" version ") + cc.info(g_strVersion);
    if( isLog )
        log.write( strMsg + "\n" );
    else
        console.log(  strMsg );
}

let g_str_url_main_net = ""; // example: "http://127.0.0.1:8545"
let g_str_url_s_chain  = ""; // example: "http://127.0.0.1:2231"

let g_chain_id_main_net = "Mainnet";    // 0;
let g_chain_id_s_chain  = "id-S-chain"; // 1;

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
let g_joAccount_main_net = { "privateKey": "", "address": fn_address_impl_ };
let g_joAccount_s_chain  = { "privateKey": "", "address": fn_address_impl_ };
//

function fn_address_impl_( w3 ) {
    if( this.address_ == undefined || this.address_ == null )
        this.address_ = "" + MTA.private_key_2_account_address( w3, this.privateKey );
    return this.address_;
}

let g_wei_amount = 0; // 1000000000000000000

let g_nTransferBlockSizeM2S = 10;
let g_nTransferBlockSizeS2M = 10;
let g_nMaxTransactionsM2S = 0;
let g_nMaxTransactionsS2M = 0;

let g_nLoopPeriodSeconds = 10;

let g_nNodeNumber = 0; // S-Chain node number(zero based)
let g_nNodesCount = 1;
let g_nTimeFrameSeconds = 0; // 0-disable, 60-recommended
let g_nNextFrameGap = 10;

let g_arrActions = []; // array of actions to run


//
//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// parse command line
function parse_command_line_argument( s ) {
    var joArg = { "name": "", "value": "" };
    try {
        if( ! s )
            return joArg;
        s = "" + s;
        while( s.length > 0 && s[0] == "-" )
            s = s.substring( 1 );
        var n = s.indexOf( "=" );
        if( n < 0 ) {
            joArg.name = s;
            return joArg;
        }
        joArg.name = s.substring( 0, n );
        joArg.value = s.substring( n + 1 );
    } catch( e ) {
    }
    return joArg;
}
function normalize_path( strPath ) {
    strPath = strPath.replace( /^~/, os.homedir() );
    strPath = path.normalize( strPath );
    strPath = path.resolve( strPath );
    return strPath;
}
function verify_arg_with_non_empty_value( joArg ) {
    if( (!joArg.value) || joArg.value.length == 0 ) {
        console.log( cc.fatal("Error:") + cc.error(" value of command line argument ") + cc.info(joArg.name) + cc.error(" must not be empty") );
        process.exit( 666 );
    }
}
function veryify_url_arg( joArg ) {
    try {
        verify_arg_with_non_empty_value( joArg );
        var s = joArg.value;
        var u = url.parse( joArg.value );
        if( ! u.hostname )
            process.exit( 666 );
        if( ! u.hostname.length )
            process.exit( 666 );
    } catch( e ) {
        process.exit( 666 );
    }
}
function veryify_int_arg( joArg ) {
    try {
        verify_arg_with_non_empty_value( joArg );
        joArg.value = parseInt( joArg.value );
    } catch( e ) {
        process.exit( 666 );
    }
}
function veryify_bool_arg( joArg ) {
    var b = false;
    try {
        var ch = joArg.value[0].toLowerCase();
        if( ch == "y" || ch == "t" )
            b = true
        else
            b = parseInt( joArg.value ) ? true : false;
    } catch( e ) {
    }
    joArg.value = b ? true : false;
    return b;
}
function veryify_arg_path_to_existing_file( strPath ) {
    try {
        stats = fs.lstatSync( strPath );
        if( stats.isDirectory() )
            return false;
        if( ! stats.isFile() )
            return false;
        return true;
    } catch( e ) { }
    return false;
}

let g_log_strFilePath = "", g_log_nMaxSizeBeforeRotation = -1, g_log_nMaxFilesCount = -1;
let idxArg, cntArgs = process.argv.length;
for( idxArg = 2; idxArg < cntArgs; ++idxArg ) {
    var joArg = parse_command_line_argument( process.argv[ idxArg ] );
    if( joArg.name == "help" ) {
        print_about();
        var soi = "    "; // options indent
        console.log( cc.sunny("GENERAL") + cc.info(" options:") );
        console.log( soi + cc.debug("--") + cc.bright("help") + cc.debug("..........................") + cc.notice("Show this ") + cc.note("help info") + cc.notice(" and exit.") );
        console.log( soi + cc.debug("--") + cc.bright("version") + cc.debug(".......................") + cc.notice("Show ") + cc.note("version info") + cc.notice(" and exit.") );
        console.log( cc.sunny("BLOCKCHAIN NETWORK") + cc.info(" options:") );
        console.log( soi + cc.debug("--") + cc.bright("url-main-net") + cc.sunny("=") + cc.attention("URL") + cc.debug("..............") + cc.note("Main-net URL") + cc.notice(" for Web3.") );
        console.log( soi + cc.debug("--") + cc.bright("url-s-chain") + cc.sunny("=") + cc.attention("URL") + cc.debug("...............") + cc.note("S-chain URL") + cc.notice(" for Web3.") );
        console.log( soi + cc.debug("--") + cc.bright("id-main-net") + cc.sunny("=") + cc.success("number") + cc.debug("............") + cc.note("Main-net") + cc.notice(" Ethereum ") + cc.note("network ID.") );
        console.log( soi + cc.debug("--") + cc.bright("id-s-chain") + cc.sunny("=") + cc.success("number") + cc.debug(".............") + cc.note("S-chain") + cc.notice(" Ethereum ") + cc.note("network ID.") );
        console.log( cc.sunny("BLOCKCHAIN INTERFACE") + cc.info(" options:") );
        console.log( soi + cc.debug("--") + cc.bright("abi-main-net") + cc.sunny("=") + cc.attention("path") + cc.debug(".............") + cc.notice("Path to JSON file containing ABI of ") + cc.note("Main-net") + cc.notice(" for Web3.") );
        console.log( soi + cc.debug("--") + cc.bright("abi-s-chain") + cc.sunny("=") + cc.attention("path") + cc.debug("..............") + cc.notice("Path to JSON file containing ABI of ") + cc.note("S-chain") + cc.notice(" for Web3.") );
        console.log( cc.sunny("USER ACCOUNT") + cc.info(" options:") );
        /**/ console.log( soi + cc.debug("--") + cc.bright("address-main-net") + cc.sunny("=") + cc.warn("value") + cc.debug("........") + cc.notice("Main-net user account address.") );
        /**/ console.log( soi + cc.debug("--") + cc.bright("address-s-chain") + cc.sunny("=") + cc.warn("value") + cc.debug(".........") + cc.notice("S-chain user account address.") );
        console.log( soi + cc.debug("--") + cc.bright("key-main-net") + cc.sunny("=") + cc.error("value") + cc.debug("............") + cc.notice("Private key for ") + cc.note("main-net user") + cc.notice(" account address.") );
        console.log( soi + cc.debug("--") + cc.bright("key-s-chain") + cc.sunny("=") + cc.error("value") + cc.debug(".............") + cc.notice("Private key for ") + cc.note("S-Chain") + cc.notice(" user account address.") );
        console.log( soi + cc.debug("--") + cc.bright("wei") + cc.sunny("=") + cc.bright("number") + cc.debug("...................") + cc.note("Amount of wei") + cc.notice(" to transfer.") );
        console.log( soi + cc.debug("--") + cc.bright("babbage") + cc.sunny("=") + cc.bright("number") + cc.debug("...............") + cc.note("Amount of babbage(wei*1000)") + cc.notice(" to transfer.") );
        console.log( soi + cc.debug("--") + cc.bright("lovelace") + cc.sunny("=") + cc.bright("number") + cc.debug("..............") + cc.note("Amount of lovelace(wei*1000*1000)") + cc.notice(" to transfer.") );
        console.log( soi + cc.debug("--") + cc.bright("shannon") + cc.sunny("=") + cc.bright("number") + cc.debug("...............") + cc.note("Amount of shannon(wei*1000*1000*1000)") + cc.notice(" to transfer.") );
        console.log( soi + cc.debug("--") + cc.bright("szabo") + cc.sunny("=") + cc.bright("number") + cc.debug(".................") + cc.note("Amount of szabo(wei*1000*1000*1000*1000)") + cc.notice(" to transfer.") );
        console.log( soi + cc.debug("--") + cc.bright("finney") + cc.sunny("=") + cc.bright("number") + cc.debug("................") + cc.note("Amount of finney(wei*1000*1000*1000*1000*1000)") + cc.notice(" to transfer.") );
        console.log( soi + cc.debug("--") + cc.bright("ether") + cc.sunny("=") + cc.bright("number") + cc.debug(".................") + cc.note("Amount of ether(wei*1000*1000*1000*1000*1000*1000)") + cc.notice(" to transfer.") );
        console.log( cc.sunny("ACTION") + cc.info(" commands:") );
        console.log( soi + cc.debug("--") + cc.bright("show-config") + cc.debug("...................") + cc.notice("Show ") + cc.note("onfiguration values") + cc.notice(" and exit.") );
        console.log( soi + cc.debug("--") + cc.bright("register") + cc.debug("......................") + cc.note("Register") + cc.notice(" S-chain on Main-net.") );
        console.log( soi + cc.debug("--") + cc.bright("m2s-payment") + cc.debug("...................") + cc.notice("Do one ") + cc.note("payment from Main-net user account to S-chain") + cc.notice(" user account.") );
        console.log( soi + cc.debug("--") + cc.bright("s2m-payment") + cc.debug("...................") + cc.notice("Do one ") + cc.note("payment from S-chain user account to Main-net") + cc.notice(" user account.") );
        console.log( soi + cc.debug("--") + cc.bright("m2s-transfer") + cc.debug("..................") + cc.notice("Do single money ") + cc.note("transfer loop from Main-net to S-chain.") );
        console.log( soi + cc.debug("--") + cc.bright("s2m-transfer") + cc.debug("..................") + cc.notice("Do single money ") + cc.note("transfer loop from S-chain to Main-net.") );
        console.log( soi + cc.debug("--") + cc.bright("transfer") + cc.debug("......................") + cc.notice("Run ") + cc.note("single M<->S transfer loop iteration.") );
        console.log( soi + cc.debug("--") + cc.bright("loop") + cc.debug("..........................") + cc.notice("Run ") + cc.note("M<->S transfer loop.") );
        console.log( soi + cc.debug("--") + cc.bright("load-node-config") + cc.sunny("=") + cc.success("path") + cc.debug(".........") + cc.notice("Use specified ") + cc.note("S-Chain node JSON configuration file") + cc.notice(" to load parameters(like ") + cc.note("node index") + cc.notice(", ") + cc.note("nodes count") + cc.notice(").") );
        console.log( cc.sunny("ADDITIONAL ACTION") + cc.info(" options:") );
        console.log( soi + cc.debug("--") + cc.bright("m2s-transfer-block-size") + cc.debug(".......") + cc.notice("Number of transactions in one block to use in money transfer loop from Main-net to S-chain.") );
        console.log( soi + cc.debug("--") + cc.bright("s2m-transfer-block-size") + cc.debug(".......") + cc.notice("Number of transactions in one block to use in money transfer loop from S-chain to Main-net.") );
        console.log( soi + cc.debug("--") + cc.bright("transfer-block-size") + cc.debug("...........") + cc.notice("Number of transactions in one block to use in both money transfer loops.") );
        console.log( soi + cc.debug("--") + cc.bright("m2s-max-transactions") + cc.debug("..........") + cc.notice("Maximal number of transactions to do in money transfer loop from Main-net to S-chain (0 is unlimited).") );
        console.log( soi + cc.debug("--") + cc.bright("s2m-max-transactions") + cc.debug("..........") + cc.notice("Maximal number of transactions to do in money transfer loop from S-chain to Main-net (0 is unlimited).") );
        console.log( soi + cc.debug("--") + cc.bright("max-transactions") + cc.debug("..............") + cc.notice("Maximal number of transactions to do in both money transfer loops (0 is unlimited).") );
        console.log( soi + cc.debug("--") + cc.bright("period") + cc.debug("........................") + cc.notice("Transfer ") + cc.note("loop period") + cc.notice("(seconds).") );
        console.log( soi + cc.debug("--") + cc.bright("node-number") + cc.sunny("=") + cc.info("value") + cc.debug(".............") + cc.notice("S-Chain ") + cc.note("node number") + cc.notice("(zero based).") );
        console.log( soi + cc.debug("--") + cc.bright("nodes-count") + cc.sunny("=") + cc.info("value") + cc.debug(".............") + cc.notice("S-Chain ") + cc.note("nodes count") + cc.notice(".") );
        console.log( soi + cc.debug("--") + cc.bright("time-framing") + cc.sunny("=") + cc.note("value") + cc.debug("............") + cc.notice("Specifies ") + cc.note("period") + cc.notice("(in seconds) ") + cc.note("for time framing") + cc.notice(". Zero means disable time framing.") );
        console.log( soi + cc.debug("--") + cc.bright("time-gap") + cc.sunny("=") + cc.note("value") + cc.debug("................") + cc.notice("Specifies ") + cc.note("gap") + cc.notice("(in seconds) ") + cc.note("before next time frame") + cc.notice(".") );
        console.log( cc.sunny("LOGGING") + cc.info(" options:") );
        console.log( soi + cc.debug("--") + cc.bright("verbose") + cc.sunny("=") + cc.bright("value") + cc.debug(".................") + cc.notice("Set ") + cc.note("level") + cc.notice(" of output details.") );
        console.log( soi + cc.debug("--") + cc.bright("verbose-list") + cc.debug("..................") + cc.notice("List available ") + cc.note("verbose levels") + cc.notice(" and exit.") );
        console.log( soi + cc.debug("--") + cc.bright("log") + cc.sunny("=") + cc.note("path") + cc.debug("......................") + cc.notice("Write program output to specified log file(multiple files can be specified).") );
        console.log( soi + cc.debug("--") + cc.bright("log-size") + cc.sunny("=") + cc.note("value") + cc.debug("................") + cc.notice("Max size(in bytes) of one log file(affects to log log rotation).") );
        console.log( soi + cc.debug("--") + cc.bright("log-files") + cc.sunny("=") + cc.note("value") + cc.debug("...............") + cc.notice("Maximum number of log files for log rotation.") );
        return 0;
    }
    if( joArg.name == "version"          ) { print_about(); return 0; }
    if( joArg.name == "verbose"          ) { MTA.verbose_set( MTA.verbose_parse( joArg.value ) ); continue; }
    if( joArg.name == "verbose-list"     ) { MTA.verbose_list(); return 0; }
    if( joArg.name == "url-main-net"     ) { veryify_url_arg( joArg ); g_str_url_main_net  = joArg.value; continue; }
    if( joArg.name == "url-s-chain"      ) { veryify_url_arg( joArg ); g_str_url_s_chain   = joArg.value; continue; }
    if( joArg.name == "id-s-chain"       ) { verify_arg_with_non_empty_value( joArg ); g_chain_id_s_chain  = joArg.value; continue; }
    if( joArg.name == "id-main-net"      ) { verify_arg_with_non_empty_value( joArg ); g_chain_id_main_net = joArg.value; continue; }
    /**/ if( joArg.name == "address-main-net" ) { verify_arg_with_non_empty_value( joArg ); g_joAccount_main_net.address_ = joArg.value; continue; }
    /**/ if( joArg.name == "address-s-chain"  ) { verify_arg_with_non_empty_value( joArg ); g_joAccount_s_chain .address_ = joArg.value; continue; }
    if( joArg.name == "abi-main-net"     ) { veryify_arg_path_to_existing_file( joArg ); g_strPathAbiJson_main_net = normalize_path( joArg.value ); continue; }
    if( joArg.name == "abi-s-chain"      ) { veryify_arg_path_to_existing_file( joArg ); g_strPathAbiJson_s_chain  = normalize_path( joArg.value ); continue; }
    if( joArg.name == "key-main-net"     ) { verify_arg_with_non_empty_value( joArg ); g_joAccount_main_net.privateKey = joArg.value; continue; }
    if( joArg.name == "key-s-chain"      ) { verify_arg_with_non_empty_value( joArg ); g_joAccount_s_chain .privateKey = joArg.value; continue; }
    if( joArg.name == "wei"              ) { verify_arg_with_non_empty_value( joArg ); g_wei_amount = joArg.value; continue; }
    if( joArg.name == "babbage"          ) { verify_arg_with_non_empty_value( joArg ); g_wei_amount = joArg.value*1000; continue; }
    if( joArg.name == "lovelace"         ) { verify_arg_with_non_empty_value( joArg ); g_wei_amount = joArg.value*1000*1000; continue; }
    if( joArg.name == "shannon"          ) { verify_arg_with_non_empty_value( joArg ); g_wei_amount = joArg.value*1000*1000*1000; continue; }
    if( joArg.name == "szabo"            ) { verify_arg_with_non_empty_value( joArg ); g_wei_amount = joArg.value*1000*1000*1000*1000; continue; }
    if( joArg.name == "finney"           ) { verify_arg_with_non_empty_value( joArg ); g_wei_amount = joArg.value*1000*1000*1000*1000*1000; continue; }
    if( joArg.name == "ether"            ) { verify_arg_with_non_empty_value( joArg ); g_wei_amount = joArg.value*1000*1000*1000*1000*1000*1000; continue; }
    if( joArg.name == "show-config"      ) { g_bShowConfigMode = true; continue; }
    if( joArg.name == "register" ) {
        g_arrActions.push( { "name": "Register S-chain on main net", "fn": async function() {
            return await register_all();
        } } );
        continue;
    }
    if( joArg.name == "m2s-payment" ) {
        g_arrActions.push( { "name": "one M->S single payment", "fn": async function() {
            return await MTA.do_payment_from_main_net(
                g_w3_main_net,
                g_joAccount_main_net,
                g_joAccount_s_chain,
                g_jo_deposit_box, // only main net
                g_chain_id_s_chain,
                g_wei_amount // how much money to send
                );
        } } );
        continue;
    }
    if( joArg.name == "s2m-payment" ) {
        g_arrActions.push( { "name": "one S->M single payment", "fn": async function() {
            return await MTA.do_payment_from_s_chain(
                g_w3_s_chain,
                g_joAccount_s_chain,
                g_joAccount_main_net,
                g_jo_token_manager, // only s-chain
                g_wei_amount // how much money to send
                );
        } } );
        continue;
    }
    if( joArg.name == "m2s-transfer" ) {
        g_arrActions.push( { "name": "single M->S transfer loop", "fn": async function() {
            return await MTA.do_transfer( // main-net --> s-chain
                /**/ g_w3_main_net,
                g_jo_message_proxy_main_net,
                g_joAccount_main_net,
                g_w3_s_chain,
                g_jo_message_proxy_s_chain,
                /**/ g_joAccount_s_chain,
                g_chain_id_main_net,
                g_chain_id_s_chain,
                g_nTransferBlockSizeM2S,
                g_nMaxTransactionsM2S
                );
        } } );
        continue;
    }
    if( joArg.name == "s2m-transfer" ) {
        g_arrActions.push( { "name": "single S->M transfer loop", "fn": async function() {
            return await MTA.do_transfer( // s-chain --> main-net
                /**/ g_w3_s_chain,
                g_jo_message_proxy_s_chain,
                g_joAccount_s_chain,
                g_w3_main_net,
                g_jo_message_proxy_main_net,
                /**/ g_joAccount_main_net,
                g_chain_id_s_chain,
                g_chain_id_main_net,
                g_nTransferBlockSizeS2M,
                g_nMaxTransactionsS2M
                );
        } } );
        continue;
    }
    if( joArg.name == "transfer" ) {
        g_arrActions.push( { "name": "Single M<->S transfer loop iteration", "fn": async function() {
            return await single_transfer_loop();
        } } );
        continue;
    }
    if( joArg.name == "loop" ) {
        g_arrActions.push( { "name": "M<->S transfer loop", "fn": async function() {
            return await run_transfer_loop();
        } } );
        continue;
    }
    if( joArg.name == "load-node-config" ) {
        verify_arg_with_non_empty_value( joArg );
        load_node_config( joArg.value );
        continue;
    }
    if( joArg.name == "m2s-transfer-block-size" ) { veryify_int_arg( joArg ); g_nTransferBlockSizeM2S = parseInt( joArg.value ); continue; }
    if( joArg.name == "s2m-transfer-block-size" ) { veryify_int_arg( joArg ); g_nTransferBlockSizeS2M = parseInt( joArg.value ); continue; }
    if( joArg.name ==     "transfer-block-size" ) { veryify_int_arg( joArg ); g_nTransferBlockSizeM2S = g_nTransferBlockSizeS2M = parseInt( joArg.value ); continue; }
    if( joArg.name == "m2s-max-transactions"    ) { veryify_int_arg( joArg ); g_nMaxTransactionsM2S = parseInt( joArg.value ); continue; }
    if( joArg.name == "s2m-max-transactions"    ) { veryify_int_arg( joArg ); g_nMaxTransactionsS2M = parseInt( joArg.value ); continue; }
    if( joArg.name ==     "max-transactions"    ) { veryify_int_arg( joArg ); g_nMaxTransactionsM2S = g_nMaxTransactionsS2M = parseInt( joArg.value ); continue; }
    if( joArg.name == "period"                  ) { veryify_int_arg( joArg ); g_nLoopPeriodSeconds = parseInt( joArg.value ); continue; }
    if( joArg.name == "node-number"             ) { veryify_int_arg( joArg ); g_nNodeNumber = parseInt( joArg.value ); continue; }
    if( joArg.name == "nodes-count"             ) { veryify_int_arg( joArg ); g_nNodesCount = parseInt( joArg.value ); continue; }
    if( joArg.name == "time-framing"            ) { veryify_int_arg( joArg ); g_nTimeFrameSeconds = parseInt( joArg.value ); continue; }
    if( joArg.name == "time-gap"                ) { veryify_int_arg( joArg ); g_nNextFrameGap = parseInt( joArg.value ); continue; }
    if( joArg.name == "log-size"  ) { veryify_int_arg( joArg ); g_log_nMaxSizeBeforeRotation = parseInt( joArg.value ); continue; }
    if( joArg.name == "log-files" ) { veryify_int_arg( joArg ); g_log_nMaxFilesCount         = parseInt( joArg.value ); continue; }
    if( joArg.name == "log" ) { verify_arg_with_non_empty_value( joArg ); g_log_strFilePath = "" + joArg.value; continue; }
    console.log( cc.fatal("Error:") + cc.error(" unkonwn command line argument ") + cc.info(joArg.name) );
    return 666;
}

if( g_log_strFilePath.length > 0 ) {
    log.write( cc.debug("Will print message to file ") + cc.info(g_log_strFilePath) + "\n" );
    log.add( g_log_strFilePath, g_log_nMaxSizeBeforeRotation, g_log_nMaxFilesCount );
}


//
//
// validate command line arguments
function ensure_have_value( name, value, isExitIfEmpty, isPrintValue, fnNameColorizer, fnValueColorizer ) {
    isExitIfEmpty = isExitIfEmpty || false;
    isPrintValue = isPrintValue || false;
    fnNameColorizer = fnNameColorizer || ( (x) => { return cc.info( x ); } );
    fnValueColorizer = fnValueColorizer || ( (x) => { return cc.notice( x ); } );
    var retVal = true;
    value = value.toString();
    if( value.length == 0 ) {
        retVal = false;
        console.log( cc.fatal("Error:") + cc.error(" missing value for ") + fnNameColorizer(name) );
        if(  isExitIfEmpty )
            process.exit( 666 );
    }
    var strDots = "...", n = 50 - name.length;
    for( ; n > 0; -- n )
        strDots += ".";
    log.write( fnNameColorizer(name) + cc.debug(strDots) + fnValueColorizer(value) + "\n" ); // just print value
    return retVal;
}

function load_json( strPath ) {
    return JSON.parse( fs.readFileSync( strPath, "utf8") );
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
        for( var i = 0; i < cnt; ++ i ) {
            var joNodeDescription = joSChainNodeConfiguration.skaleConfig.sChain.nodes[ i ];
            if( joNodeDescription.nodeID == searchID )
                return i;
        }
    } catch( e ) {
    }
     return 0; // ???
}
function load_node_config( strPath ) {
    try {
        strPath = normalize_path( strPath );
        //
        if( MTA.verbose_get() >= MTA.RV_VERBOSE.information )
            log.write( cc.debug("Loading values from S-Chain configuraton JSON file ") + cc.note(strPath) + cc.debug("...") + "\n" );
        var strJsonSChainNodeConfiguration = fs.readFileSync( strPath, "utf8" );
        var joSChainNodeConfiguration = JSON.parse( strJsonSChainNodeConfiguration );
        if( MTA.verbose_get() >= MTA.RV_VERBOSE.trace )
            log.write( cc.debug("S-Chain configuraton JSON: ") + cc.j(joSChainNodeConfiguration) + "\n" );
        //
        g_nNodeNumber = find_node_index( joSChainNodeConfiguration );
        if( MTA.verbose_get() >= MTA.RV_VERBOSE.debug )
            log.write( cc.debug("....from S-Chain configuraton JSON file....") + cc.notice("this node index") + cc.debug(" is ") + cc.info(g_nNodeNumber) + "\n" );
        g_nNodesCount = joSChainNodeConfiguration.skaleConfig.sChain.nodes.length;
        if( MTA.verbose_get() >= MTA.RV_VERBOSE.debug )
            log.write( cc.debug("....from S-Chain configuraton JSON file....") + cc.notice("nodes count") + cc.debug(" is ") + cc.info(g_nNodesCount) + "\n" );
        //
        if( MTA.verbose_get() >= MTA.RV_VERBOSE.information )
            log.write( cc.success("Done") + cc.debug(" loading values from S-Chain configuraton JSON file ") + cc.note(strPath) + cc.debug(".") + "\n" );
    } catch( e ) {
        if( MTA.verbose_get() >= MTA.RV_VERBOSE.fatal )
            log.write( cc.fatal("Exception in load_node_config():") + cc.error(e) + "\n" );
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
        if( g_nTimeFrameSeconds <= 0 || g_nNodesCount <= 1 )
            return true; // time framing is disabled
        if( d = null || d == undefined )
            d = new Date(); // now
        var nUtcUnixTimeStamp = Math.floor( d.valueOf() / 1000 ); // Unix UTC timestamp, see https://stackoverflow.com/questions/9756120/how-do-i-get-a-utc-timestamp-in-javascript
        var nSecondsRangeForAllSChains = g_nTimeFrameSeconds * g_nNodesCount;
        var nMod = Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
        var nActiveNodeFrameIndex = Math.floor( nMod / g_nTimeFrameSeconds );
        var bSkip = ( nActiveNodeFrameIndex != g_nNodeNumber ) ? true : false, bInsideGap = false;
        if( ! bSkip ) {
            var nRangeStart = nUtcUnixTimeStamp - Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
            var nFrameStart = nRangeStart + g_nNodeNumber * g_nTimeFrameSeconds;
            var nGapStart = nFrameStart + g_nTimeFrameSeconds - g_nNextFrameGap;
            if( nUtcUnixTimeStamp >= nGapStart ) {
                bSkip = true;
                bInsideGap = true;
            }
        }
        if( MTA.verbose_get() >= MTA.RV_VERBOSE.trace )
            log.write(
                "\n"
                + cc.info("Unix UTC time stamp") + cc.debug("........") + cc.notice(nUtcUnixTimeStamp) + "\n"
                + cc.info("All Chains Range") + cc.debug("...........") + cc.notice(nSecondsRangeForAllSChains) + "\n"
                + cc.info("S-Chain Range Mod") + cc.debug("..........") + cc.notice(nMod) + "\n"
                + cc.info("Active Node Frame Index") + cc.debug("....") + cc.notice(nActiveNodeFrameIndex) + "\n"
                + cc.info("Testing Frame Index") + cc.debug("........") + cc.notice(g_nNodeNumber) + "\n"
                + cc.info("Is skip") + cc.debug("....................") + cc.yn(bSkip) + "\n"
                + cc.info("Is inside gap") + cc.debug("..............") + cc.yn(bInsideGap) + "\n"
                );
        if( bSkip )
            return false;
    } catch( e ) {
        if( MTA.verbose_get() >= MTA.RV_VERBOSE.fatal )
            log.write( cc.fatal("Exception in check_time_framing():") + cc.error(e) + "\n" );
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
    if( strKey in joABI )
        return;
    log.write( cc.fatal("FATAL:") + cc.error("Loaded ") + cc.warning(strName) + cc.error(" ABI JSON file ") + cc.info(strFile) + cc.error(" does not contain needed key ") + cc.warning(strKey) + "\n" );
    process.exit(123);
}
function check_keys_exist_in_abi( strName, strFile, joABI, arrKeys ) {
    var cnt = arrKeys.length;
    for( var i = 0; i < cnt; ++ i ) {
        var strKey = arrKeys[ i ];
        check_key_exist_in_abi( strName, strFile, joABI, strKey );
    }
}

joTrufflePublishResult_main_net = load_json( g_strPathAbiJson_main_net );
joTrufflePublishResult_s_chain  = load_json( g_strPathAbiJson_s_chain );

check_keys_exist_in_abi( "main-net", g_strPathAbiJson_main_net, joTrufflePublishResult_main_net, [ "deposit_box_abi", "deposit_box_address", "message_proxy_mainnet_abi", "message_proxy_mainnet_address" ] );
check_keys_exist_in_abi( "S-Chain",  g_strPathAbiJson_s_chain,  joTrufflePublishResult_s_chain,  [ "token_manager_abi", "token_manager_address" , "message_proxy_chain_abi", "message_proxy_chain_address" ] );

// deposit_box_address           --> deposit_box_abi
// token_manager_address         --> token_manager_abi
// message_proxy_mainnet_address --> message_proxy_mainnet_abi
// message_proxy_chain_address   --> message_proxy_chain_abi

if( g_str_url_main_net.length == 0 ) {
    log.write( cc.fatal("FATAL:") + cc.error("Missing ") + cc.warning("Main-net") + cc.error(" URL in command line arguments") + "\n" );
    process.exit( 501 );
}
if( g_str_url_s_chain.length == 0 ) {
    log.write( cc.fatal("FATAL:") + cc.error("Missing ") + cc.warning("S-Chain") + cc.error(" URL in command line arguments") + "\n" );
    process.exit( 501 );
}

const g_w3http_main_net = new w3mod.providers.HttpProvider( g_str_url_main_net );
const g_w3_main_net = new w3mod( g_w3http_main_net );

const g_w3http_s_chain = new w3mod.providers.HttpProvider( g_str_url_s_chain );
const g_w3_s_chain = new w3mod( g_w3http_s_chain );

let g_jo_deposit_box            = new g_w3_main_net.eth.Contract( joTrufflePublishResult_main_net.deposit_box_abi,           joTrufflePublishResult_main_net.deposit_box_address           ); // only main net
let g_jo_token_manager          = new g_w3_s_chain .eth.Contract( joTrufflePublishResult_s_chain .token_manager_abi,         joTrufflePublishResult_s_chain .token_manager_address         ); // only s-chain
let g_jo_message_proxy_main_net = new g_w3_main_net.eth.Contract( joTrufflePublishResult_main_net.message_proxy_mainnet_abi, joTrufflePublishResult_main_net.message_proxy_mainnet_address );
let g_jo_message_proxy_s_chain  = new g_w3_s_chain .eth.Contract( joTrufflePublishResult_s_chain .message_proxy_chain_abi,   joTrufflePublishResult_s_chain .message_proxy_chain_address   );

if( MTA.verbose_get() > MTA.RV_VERBOSE.information || g_bShowConfigMode ) {
    print_about( true );
    ensure_have_value( "app path", __filename, false, true, null, (x) => { return cc.normal( x ); } );
    ensure_have_value( "verbose level", MTA.VERBOSE[MTA.verbose_get()], false, true, null, (x) => { return cc.sunny( x ); } );
    ensure_have_value( "main-net URL", g_str_url_main_net, false, true, null, (x) => { return cc.u( x ); } );
    ensure_have_value( "S-chain URL", g_str_url_s_chain, false, true, null, (x) => { return cc.u( x ); } );
    ensure_have_value( "main-net Ethereum network ID", g_chain_id_main_net, false, true, null, (x) => { return cc.note( x ); } );
    ensure_have_value( "S-Chain Ethereum network ID", g_chain_id_s_chain, false, true, null, (x) => { return cc.note( x ); } );
    ensure_have_value( "main-net ABI JSON file path", g_strPathAbiJson_main_net, false, true, null, (x) => { return cc.warning( x ); } );
    ensure_have_value( "S-Chain ABI JSON file path", g_strPathAbiJson_s_chain, false, true, null, (x) => { return cc.warning( x ); } );
    ensure_have_value( "main-net user account address", g_joAccount_main_net.address(g_w3_main_net), false, true );
    ensure_have_value( "S-chain user account address",  g_joAccount_s_chain .address(g_w3_s_chain), false, true );
    ensure_have_value( "private key for main-net user account address", g_joAccount_main_net.privateKey, false, true, null, (x) => { return cc.attention( x ); } );
    ensure_have_value( "private key for S-Chain user account address",  g_joAccount_s_chain .privateKey, false, true, null, (x) => { return cc.attention( x ); } );
    ensure_have_value( "amount of wei to transfer", g_wei_amount, false, true, null, (x) => { return cc.info( x ); } );
    ensure_have_value( "M->S transfer block size", g_nTransferBlockSizeM2S, false, true, null, (x) => { return cc.note( x ); } );
    ensure_have_value( "S->M transfer block size", g_nTransferBlockSizeS2M, false, true, null, (x) => { return cc.note( x ); } );
    ensure_have_value( "M->S transactions limit", g_nMaxTransactionsM2S, false, true, null, (x) => { return cc.note( x ); } );
    ensure_have_value( "S->M transactions limit", g_nMaxTransactionsS2M, false, true, null, (x) => { return cc.note( x ); } );
    ensure_have_value( "Transfer loop period(seconds)", g_nLoopPeriodSeconds, false, true, null, (x) => { return cc.success( x ); } );
    if( g_nTimeFrameSeconds > 0 ) {
        ensure_have_value( "Time framing(seconds)", g_nTimeFrameSeconds, false, true );
        ensure_have_value( "Next frame gap(seconds)", g_nNextFrameGap, false, true );
    } else
        ensure_have_value( "Time framing", cc.error("disabled"), false, true );
    ensure_have_value( "S-Chain node number(zero based)", g_nNodeNumber, false, true, null, (x) => { return cc.info( x ); } );
    ensure_have_value( "S-Chain nodes count", g_nNodesCount, false, true, null, (x) => { return cc.info( x ); } );
    if( g_log_strFilePath.length > 0 ) {
        ensure_have_value( "Log file path", g_log_strFilePath, false, true, null, (x) => { return cc.info( x ); } );
        ensure_have_value( "Max size of log file path", g_log_nMaxSizeBeforeRotation, false, true, null, (x) => { return ( x <= 0 ) ? cc.warn("unlimited") : cc.note( x ); } );
        ensure_have_value( "Max rotated count of log files", g_log_nMaxFilesCount, false, true, null, (x) => { return ( x <= 1 ) ? cc.warn("not set") : cc.note( x ); } );
    }
}
if( g_bShowConfigMode ) {
    // just show configuratin values and exit
    return true;
}

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// register S-Chain 1 on main net
//
async function do_the_job() {
    let idxAction, cntActions = g_arrActions.length, cntFalse = 0, cntTrue = 0;
    for( idxAction = 0; idxAction < cntActions; ++ idxAction ) {
        if( MTA.verbose_get() >= MTA.RV_VERBOSE.information )
            log.write( cc.debug(MTA.longSeparator) + "\n" );
        var joAction = g_arrActions[ idxAction ], bOK = false;
        if( MTA.verbose_get() >= MTA.RV_VERBOSE.debug )
            log.write( cc.notice("Will execute action:") + " " + cc.info(joAction.name) + cc.debug(" (") + cc.info(idxAction+1) + cc.debug(" of ") + cc.info(cntActions) + cc.debug(")") + "\n" );
        try {
            if( await joAction.fn() ) {
                ++ cntTrue;
                if( MTA.verbose_get() >= MTA.RV_VERBOSE.information )
                    log.write( cc.success("Succeeded action:") + " " + cc.info(joAction.name) + "\n" );
            } else {
                ++ cntFalse;
                if( MTA.verbose_get() >= MTA.RV_VERBOSE.error )
                    log.write( cc.warn("Failed action:") + " " + cc.info(joAction.name) + "\n" );
            }
        } catch( e ) {
            ++ cntFalse;
            if( MTA.verbose_get() >= MTA.RV_VERBOSE.fatal )
                log.write( cc.fatal("Exception occurred while executing action:") + " " + cc.info(joAction.name) + cc.error(", error description: ") + cc.warn(e) + "\n" );
        }
    } // for( idxAction = 0; idxAction < cntActions; ++ idxAction )
    if( MTA.verbose_get() >= MTA.RV_VERBOSE.information ) {
        log.write( cc.debug(MTA.longSeparator) + "\n" );
        log.write( cc.info("FINISH:") + "\n" );
        log.write( cc.info(cntActions) + cc.notice( " task(s) executed") + "\n" );
        log.write( cc.info(cntTrue)    + cc.success(" task(s) succeeded") + "\n" );
        log.write( cc.info(cntFalse)   + cc.error  (" task(s) failed") + "\n" );
        log.write( cc.debug(MTA.longSeparator) + "\n" );
    }
}
do_the_job();
return 0; // FINISH


async function register_all() {
    var b1 = await MTA.register_s_chain_on_main_net(
        g_w3_main_net,
        g_jo_message_proxy_main_net,
        g_joAccount_main_net,
        g_chain_id_s_chain
        );
    var b2 = await MTA.register_s_chain_in_deposit_box(
        g_w3_main_net,
        g_jo_deposit_box, // only main net
        g_joAccount_main_net,
        g_jo_token_manager, // only s-chain
        g_chain_id_s_chain
        );
    var b3 = await MTA.reister_main_net_depositBox_on_s_chain(
        g_w3_s_chain,
        g_jo_token_manager, // only s-chain
        g_jo_deposit_box, // only main net
        g_joAccount_s_chain
        );
    var b4 = b1 && b2 && b3;
    return b4;
}


//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Run transfer loop
//
async function single_transfer_loop() {
    if( MTA.verbose_get() >= MTA.RV_VERBOSE.debug )
        log.write( cc.debug(MTA.longSeparator) + "\n" );
    if( ! check_time_framing() ) {
        if( MTA.verbose_get() >= MTA.RV_VERBOSE.debug )
            log.write( cc.warn("Skipped due to time framing") + "\n" );
        return true;
    }
    var b1 = await MTA.do_transfer( // main-net --> s-chain
        /**/ g_w3_main_net,
        g_jo_message_proxy_main_net,
        g_joAccount_main_net,
        g_w3_s_chain,
        g_jo_message_proxy_s_chain,
        /**/ g_joAccount_s_chain,
        g_chain_id_main_net,
        g_chain_id_s_chain,
        g_nTransferBlockSizeM2S,
        g_nMaxTransactionsM2S
        );
    var b2 = await MTA.do_transfer( // s-chain --> main-net
        /**/ g_w3_s_chain,
        g_jo_message_proxy_s_chain,
        g_joAccount_s_chain,
        g_w3_main_net,
        g_jo_message_proxy_main_net,
        /**/ g_joAccount_main_net,
        g_chain_id_s_chain,
        g_chain_id_main_net,
        g_nTransferBlockSizeS2M,
        g_nMaxTransactionsS2M
        );
    var b3 = b1 && b2;
    return b3;
}
async function single_transfer_loop_with_repeat() {
    await single_transfer_loop();
    setTimeout( single_transfer_loop_with_repeat, g_nLoopPeriodSeconds*1000 );
};
async function run_transfer_loop() {
    await single_transfer_loop_with_repeat();
    //setTimeout( single_transfer_loop_with_repeat, g_nLoopPeriodSeconds*1000 );
    return true;
}