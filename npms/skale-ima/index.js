// init very basics
const fs = require( "fs" );
const path = require( "path" );
const url = require( "url" );
const os = require( "os" );
const w3mod = require( "web3" );
let ethereumjs_tx = require( "ethereumjs-tx" );
let ethereumjs_wallet = require( "ethereumjs-wallet" );
let ethereumjs_util = require( "ethereumjs-util" );

const log = require( "../skale-log/log.js" );
const cc = log.cc;
cc.enable( true );
log.addStdout();
//log.add( strFilePath, nMaxSizeBeforeRotation, nMaxFilesCount );

let g_mtaStrLongSeparator = "=======================================================================================================================";

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// logging helpers
//
const VERBOSE = {
    0: "silent",
    2: "fatal",
    3: "error",
    4: "warning",
    5: "attention",
    6: "information",
    7: "notce",
    8: "debug",
    9: "trace"
};
const RV_VERBOSE = function() {
    var m = {};
    for ( var key in VERBOSE ) {
        if ( !VERBOSE.hasOwnProperty( key ) )
            continue; // skip loop if the property is from prototype
        var name = VERBOSE[ key ];
        m[ name ] = key;
    }
    return m;
}();
let verboseLevel = RV_VERBOSE[ "error" ];

function verbose_get() {
    return verboseLevel;
}

function verbose_set( x ) {
    verboseLevel = x;
}

function verbose_parse( s ) {
    var n = 5;
    try {
        var isNumbersOnly = /^\d+$/.test( s );
        if ( isNumbersOnly ) {
            n = parseInt( s );
        } else {
            var ch0 = s[ 0 ].toLowerCase();
            for ( var key in VERBOSE ) {
                if ( !VERBOSE.hasOwnProperty( key ) )
                    continue; // skip loop if the property is from prototype
                var name = VERBOSE[ key ];
                var ch1 = name[ 0 ].toLowerCase();
                if ( ch0 == ch1 ) {
                    n = key;
                    break;
                }
            }
        }
    } catch ( e ) {}
    return n;
}

function verbose_list() {
    for ( var key in VERBOSE ) {
        if ( !VERBOSE.hasOwnProperty( key ) )
            continue; // skip loop if the property is from prototype
        var name = VERBOSE[ key ];
        console.log( "    " + cc.info( key ) + cc.sunny( "=" ) + cc.bright( name ) );
    }
}

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// utilites
//
function ensure_starts_with_0x( s ) {
    if ( s == null || s == undefined || typeof s !== "string" )
        return s;
    if ( s.length < 2 )
        return "0x" + s;
    if ( s[ 0 ] == "0" && s[ 1 ] == "x" )
        return s;
    return "0x" + s;
}

function remove_starting_0x( s ) {
    if ( s == null || s == undefined || typeof s !== "string" )
        return s;
    if ( s.length < 2 )
        return s;
    if ( s[ 0 ] == "0" && s[ 1 ] == "x" )
        return s.substr( 2 );
    return s;
}

function private_key_2_public_key( w3, keyPrivate ) {
    if ( w3 == null || w3 == undefined || keyPrivate == null || keyPrivate == undefined )
        return "";
    // get a wallet instance from a private key
    const privateKeyBuffer = ethereumjs_util.toBuffer( ensure_starts_with_0x( keyPrivate ) );
    const wallet = ethereumjs_wallet.fromPrivateKey( privateKeyBuffer );
    // get a public key
    const keyPublic = wallet.getPublicKeyString();
    return remove_starting_0x( keyPublic );
}

function public_key_2_account_address( w3, keyPublic ) {
    if ( w3 == null || w3 == undefined || keyPublic == null || keyPublic == undefined )
        return "";
    const hash = w3.utils.sha3( ensure_starts_with_0x( keyPublic ) );
    const strAddress = ensure_starts_with_0x( hash.substr( hash.length - 40 ) );
    return strAddress;
}

function private_key_2_account_address( w3, keyPrivate ) {
    const keyPublic = private_key_2_public_key( w3, keyPrivate );
    const strAddress = public_key_2_account_address( w3, keyPublic );
    return strAddress;
}

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// register S-Chain 1 on main net
//

async function check_is_registered_s_chain_on_main_net( // step 1
    w3_main_net,
    jo_message_proxy_main_net,
    joAccount_main_net,
    chain_id_s_chain
) {
    if ( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( cc.bright( "check_is_registered_s_chain_on_main_net(reg-step1)" ) + "\n" );
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let r, strActionName = "";
    try {
        strActionName = "check_is_registered_s_chain_on_main_net(reg-step1)";
        let addr = joAccount_main_net.address( w3_main_net );
        let bIsRegistered = await jo_message_proxy_main_net.methods.isConnectedChain( chain_id_s_chain ).call( {
            "from": addr
        } );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "check_is_registered_s_chain_on_main_net(reg-step1) status is: " ) + cc.attention( bIsRegistered ) + "\n" );
        return bIsRegistered;
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Error in check_is_registered_s_chain_on_main_net(reg-step1)() during " + strActionName + ": " ) + cc.error( e ) + "\n" );
    }
    return false;
}

async function register_s_chain_on_main_net( // step 1
    w3_main_net,
    jo_message_proxy_main_net,
    joAccount_main_net,
    chain_id_s_chain
) {
    if ( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( cc.bright( "register_s_chain_on_main_net" ) + "\n" );
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let r, strActionName = "";
    try {
        strActionName = "reg-step1:w3_main_net.eth.getTransactionCount()";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccount_main_net.address( w3_main_net ), null );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        //
        // based on:
        // https://ethereum.stackexchange.com/questions/47426/call-contract-function-signed-on-client-side-web3-js-1-0
        // https://ethereum.stackexchange.com/questions/25839/how-to-make-transactions-using-private-key-in-web3
        let dataTx = jo_message_proxy_main_net.methods.addConnectedChain(
            chain_id_s_chain, [ 0, 0, 0, 0 ] // call params
        ).encodeABI(); // the encoded ABI of the method
        let rawTx = {
            "nonce": tcnt, // 0x00, ...
            "gasPrice": 10000000000,
            "gasLimit": 3000000,
            "to": jo_message_proxy_main_net.options.address, // cantract address
            "data": dataTx
        };
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "....composed " ) + cc.j( rawTx ) + "\n" );
        let tx = new ethereumjs_tx( rawTx );
        var key = Buffer.from( joAccount_main_net.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        var serializedTx = tx.serialize();
        strActionName = "reg-step1:w3_main_net.eth.sendSignedTransaction()";
        let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Error in register_s_chain_on_main_net() during " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return false;
    }
    return true;
} // async function register_s_chain(...


//
// register direction for money transfer
// main-net.DepositBox call: function addSchain(uint64 schainID, address tokenManagerAddress)
//

async function check_is_registered_s_chain_in_deposit_box( // step 2
    w3_main_net,
    jo_lock_and_data_main_net,
    joAccount_main_net,
    chain_id_s_chain
) {
    if ( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( cc.bright( "check_is_registered_s_chain_in_deposit_box(reg-step2)" ) + "\n" );
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let r, strActionName = "";
    try {
        strActionName = "check_is_registered_s_chain_in_deposit_box(reg-step2)";
        let addr = joAccount_main_net.address( w3_main_net );
        let bIsRegistered = await jo_lock_and_data_main_net.methods.hasSchain( chain_id_s_chain ).call( {
            "from": addr
        } );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "check_is_registered_s_chain_in_deposit_box(reg-step2) status is: " ) + cc.attention( bIsRegistered ) + "\n" );
        return bIsRegistered;
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Error in check_is_registered_s_chain_in_deposit_box(reg-step2)() during " + strActionName + ": " ) + cc.error( e ) + "\n" );
    }
    return false;
}

async function register_s_chain_in_deposit_box( // step 2
    w3_main_net,
    //jo_deposit_box, // only main net
    jo_lock_and_data_main_net,
    joAccount_main_net,
    jo_token_manager, // only s-chain
    chain_id_s_chain
) {
    if ( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( cc.bright( "reg-step2:register_s_chain_in_deposit_box" ) + "\n" );
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let r, strActionName = "";
    try {
        strActionName = "reg-step2:w3_main_net.eth.getTransactionCount()";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccount_main_net.address( w3_main_net ), null );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        //
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will register S-Chain in lock_and_data on Main-net" ) + "\n" );
        let dataTx = jo_lock_and_data_main_net.methods.addSchain(
            chain_id_s_chain, jo_token_manager.options.address // call params
        ).encodeABI(); // the encoded ABI of the method
        let rawTx = {
            "nonce": tcnt, // 0x00, ...
            "gasPrice": 10000000000,
            "gasLimit": 3000000,
            "to": jo_lock_and_data_main_net.options.address, // cantract address
            "data": dataTx
        };
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "....composed " ) + cc.j( rawTx ) + "\n" );
        let tx = new ethereumjs_tx( rawTx );
        var key = Buffer.from( joAccount_main_net.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        var serializedTx = tx.serialize();
        strActionName = "reg-step2:w3_main_net.eth.sendSignedTransaction()";
        let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Error in register_s_chain_in_deposit_box() during " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return false;
    }
    return true;
} // async function register_deposit_box_on_s_chain(...

async function check_is_registered_main_net_depositBox_on_s_chain( // step 3
    w3_s_chain,
    jo_lock_and_data_s_chain,
    joAccount
) {
    if ( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( cc.bright( "check_is_registered_main_net_depositBox_on_s_chain(reg-step3)" ) + "\n" );
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let r, strActionName = "";
    try {
        strActionName = "check_is_registered_main_net_depositBox_on_s_chain(reg-step3)";
        let addr = joAccount.address( w3_s_chain );
        let bIsRegistered = await jo_lock_and_data_s_chain.methods.hasDepositBox().call( {
            "from": addr
        } );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "check_is_registered_main_net_depositBox_on_s_chain(reg-step3) status is: " ) + cc.attention( bIsRegistered ) + "\n" );
        return bIsRegistered;
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Error in check_is_registered_main_net_depositBox_on_s_chain(reg-step3)() during " + strActionName + ": " ) + cc.error( e ) + "\n" );
    }
    return false;
}

async function register_main_net_depositBox_on_s_chain( // step 3
    w3_s_chain,
    //jo_token_manager,
    jo_deposit_box_main_net,
    jo_lock_and_data_s_chain,
    joAccount
) {
    if ( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( cc.bright( "register_main_net_depositBox_on_s_chain" ) + "\n" );
        log.write( cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let r, strActionName = "";
    try {
        strActionName = "reg-step3:w3_s_chain.eth.getTransactionCount()/register_main_net_depositBox_on_s_chain";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_s_chain.eth.getTransactionCount( joAccount.address( w3_s_chain ), null );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        let dataTx = jo_lock_and_data_s_chain.methods.addDepositBox(
            jo_deposit_box_main_net.options.address // call params
        ).encodeABI(); // the encoded ABI of the method
        let rawTx = {
            "nonce": tcnt, // 0x00, ...
            "gasPrice": 10000000000,
            "gasLimit": 3000000,
            "to": jo_lock_and_data_s_chain.options.address, // cantract address
            "data": dataTx
        };
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "....composed " ) + cc.j( rawTx ) + "\n" );
        let tx = new ethereumjs_tx( rawTx );
        var key = Buffer.from( joAccount.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        var serializedTx = tx.serialize();
        strActionName = "reg-step3:w3_s_chain.eth.sendSignedTransaction()";
        let joReceipt = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Error in register_main_net_depositBox_on_s_chain() during " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return false;
    }
    return true;
}

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// transfer money from main-net to S-chain
// main-net.DepositBox call: function deposit(uint64 schainID, address to) public payable
// Where:
//   schainID...obvious
//   to.........address in S-chain
// Notice:
//   this function is available for everyone in main-net
//   money is sent from caller
//   "value" JSON arg is used to specify amount of money to sent
//
async function do_eth_payment_from_main_net(
    w3_main_net,
    joAccountSrc,
    joAccountDst,
    jo_deposit_box,
    chain_id_s_chain,
    wei_how_much // how much WEI money to send
) {
    let r, strActionName = "";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccountSrc.address( w3_main_net ), null );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        let dataTx = jo_deposit_box.methods.deposit(
            // call params, last is destination account on S-chain
            chain_id_s_chain, joAccountDst.address( w3_main_net ), w3_main_net.utils.fromAscii( "" ) // TO-DO: string is "data" parameter, we need to allow user to specify it
        ).encodeABI(); // the encoded ABI of the method
        let rawTx = {
            "nonce": tcnt, // 0x00, ...
            "gas": 2100000,
            "gasPrice": 10000000000, // not w3.eth.gasPrice ... got from truffle.js network_name gasPrice
            "gasLimit": 3000000,
            "to": jo_deposit_box.options.address, // cantract address
            "data": dataTx,
            "value": wei_how_much // how much money to send
        };
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "....composed " ) + cc.j( rawTx ) + "\n" );
        let tx = new ethereumjs_tx( rawTx );
        var key = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        var serializedTx = tx.serialize();
        strActionName = "w3_main_net.eth.sendSignedTransaction()";
        let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Payment error in " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return false;
    }
    return true;
} // async function do_eth_payment_from_main_net(...

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// transfer money from S-chain to main-net
// S-chain.TokenManager call: function exitToMain(address to) public payable
// Where:
//   to.........address in main-net
// Notice:
//   this function is available for everyone in S-chain
//   money is sent from caller
//   "value" JSON arg is used to specify amount of money to sent
//
async function do_eth_payment_from_s_chain(
    w3_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_token_manager,
    wei_how_much // how much WEI money to send
) {
    let r, strActionName = "";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_eth_payment_from_s_chain";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_s_chain.eth.getTransactionCount( joAccountSrc.address( w3_s_chain ), null );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        let dataTx = jo_token_manager.methods.exitToMain(
            // call params, last is destination account on S-chain
            joAccountDst.address( w3_s_chain ), wei_how_much, w3_s_chain.utils.fromAscii( "" ) // TO-DO: string is "data" parameter, we need to allow user to specify it
        ).encodeABI(); // the encoded ABI of the method
        let rawTx = {
            "nonce": tcnt, // 0x00, ...
            "gas": 2100000,
            "gasPrice": 10000000000, // not w3.eth.gasPrice ... got from truffle.js network_name gasPrice
            "gasLimit": 3000000,
            "to": jo_token_manager.options.address, // cantract address
            "data": dataTx,
            "value": 0 // how much money to send
        };
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "....composed " ) + cc.j( rawTx ) + "\n" );
        let tx = new ethereumjs_tx( rawTx );
        var key = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        var serializedTx = tx.serialize();
        strActionName = "w3_s_chain.eth.sendSignedTransaction()";
        let joReceipt = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Payment error in " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return false;
    }
    return true;
} // async function do_eth_payment_from_s_chain(...


//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
async function receive_eth_payment_from_s_chain_on_main_net(
    w3_main_net,
    joAccount_main_net,
    jo_lock_and_data_main_net
) {
    let r, strActionName = "";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/receive_eth_payment_from_s_chain_on_main_net";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccount_main_net.address( w3_main_net ), null );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        let dataTx = jo_lock_and_data_main_net.methods.getMyEth(
            // call params(empty)
        ).encodeABI(); // the encoded ABI of the method
        let rawTx = {
            "nonce": tcnt, // 0x00, ...
            "gas": 2100000,
            "gasPrice": 10000000000, // not w3.eth.gasPrice ... got from truffle.js network_name gasPrice
            "gasLimit": 3000000,
            "to": jo_lock_and_data_main_net.options.address, // cantract address
            "data": dataTx,
            "value": 0 // how much money to send
        };
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "....composed " ) + cc.j( rawTx ) + "\n" );
        let tx = new ethereumjs_tx( rawTx );
        var key = Buffer.from( joAccount_main_net.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        var serializedTx = tx.serialize();
        strActionName = "w3_main_net.eth.sendSignedTransaction()";
        let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Receive payment error in " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return false;
    }
    return true;
}

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
async function view_eth_payment_from_s_chain_on_main_net(
    w3_main_net,
    joAccount_main_net,
    jo_lock_and_data_main_net
) {
    let r, strActionName = "";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/view_eth_payment_from_s_chain_on_main_net";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccount_main_net.address( w3_main_net ), null );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        let addr = joAccount_main_net.address( w3_main_net );
        let xWei = await jo_lock_and_data_main_net.methods.approveTransfers( addr ).call( {
            "from": addr
        } );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "You can receive(wei): " ) + cc.attention( xWei ) + "\n" );
        let xEth = w3_main_net.utils.fromWei( xWei, "ether" );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "You can receive(eth): " ) + cc.attention( xEth ) + "\n" );
        return xWei;
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "View payment error in " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return null;
    }
}

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
async function do_erc721_payment_from_main_net(
    w3_main_net,
    w3_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_deposit_box,
    chain_id_s_chain,
    token_id, // which ERC721 token id to send
    jo_token_manager, // only s-chain
    strCoinNameErc721_main_net,
    erc721PrivateTestnetJson_main_net,
    strCoinNameErc721_s_chain,
    erc721PrivateTestnetJson_s_chain,
    isRawTokenTransfer
) {
    let r, strActionName = "";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/do_erc721_payment_from_main_net";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccountSrc.address( w3_main_net ), null );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "ERC721 prepare M->S";
        const erc721ABI = erc721PrivateTestnetJson_main_net[ strCoinNameErc721_main_net + "_abi" ];
        const erc721Address_main_net = erc721PrivateTestnetJson_main_net[ strCoinNameErc721_main_net + "_address" ];
        let contractERC721 = new w3_main_net.eth.Contract( erc721ABI, erc721Address_main_net );
        //prepare the smart contract function deposit(string schainID, address to)
        let depositBoxAddress = jo_deposit_box.options.address;
        let accountForSchain = joAccountDst.address( w3_s_chain );
        let approve =
            contractERC721.methods.transferFrom( // same as approve in 20
                joAccountSrc.address( w3_main_net ), depositBoxAddress, "0x" + w3_main_net.utils.toBN( token_id ).toString(16)
            ).encodeABI();
        let deposit = null;
        if ( isRawTokenTransfer ) {
            let erc721Address_s_chain = erc721PrivateTestnetJson_s_chain[ strCoinNameErc721_s_chain + "_address" ];
            deposit =
                jo_deposit_box.methods.rawDepositERC721(
                    chain_id_s_chain, erc721Address_main_net, erc721Address_s_chain // specific for rawDepositERC721() only
                    , accountForSchain, "0x" + w3_main_net.utils.toBN( token_id ).toString(16)
                ).encodeABI();
        } else {
            deposit = // beta version
            jo_deposit_box.methods.depositERC721(
                chain_id_s_chain, erc721Address_main_net, accountForSchain, "0x" + w3_main_net.utils.toBN( token_id ).toString(16)
            ).encodeABI();
        }
        //
        //
        // create raw transactions
        //
        strActionName = "create raw transactions M->S";
        const rawTxApprove = {
            "from": joAccountSrc.address( w3_main_net ), // accountForMainnet
            "nonce": "0x" + tcnt.toString( 16 ),
            "data": approve,
            "to": erc721Address_main_net,
            "gasPrice": 0,
            "gas": 8000000
        }
        tcnt += 1;
        const rawTxDeposit = {
            "from": joAccountSrc.address( w3_main_net ), // accountForMainnet
            "nonce": "0x" + tcnt.toString( 16 ),
            "data": deposit,
            "to": depositBoxAddress,
            "gasPrice": 0,
            "gas": 8000000,
            "value": 2000000000000000 // w3_dst.utils.toWei( (1).toString(), "ether" )
        }
        //
        //
        // sign transactions
        //
        strActionName = "sign transactions M->S";
        var privateKeyForMainnet = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        const txApprove = new ethereumjs_tx( rawTxApprove );
        const txDeposit = new ethereumjs_tx( rawTxDeposit );
        txApprove.sign( privateKeyForMainnet );
        txDeposit.sign( privateKeyForMainnet );
        const serializedTxApprove = txApprove.serialize();
        const serializedTxDeposit = txDeposit.serialize();
        //
        //
        // send transactions
        //
        strActionName = "w3_main_net.eth.sendSignedTransaction()/Approve";
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.normal( "Composed " ) + cc.info("rawTxApprove") + cc.normal(" is: ") + cc.j( rawTxApprove ) + "\n" );
        let joReceiptApprove = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        log.write( cc.normal("Will send ERC721 signed transaction from ") + cc.warn(joAccountSrc.address( w3_main_net )) + "\n" );
        strActionName = "w3_main_net.eth.sendSignedTransaction()/Deposit";
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.normal( "Composed " ) + cc.info("rawTxDeposit") + cc.normal(" is: ") + cc.j( rawTxDeposit ) + "\n" );
        let joReceiptDeposit = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt for Deposit: " ) + cc.j( joReceiptDeposit ) + "\n" );
        //
        //

        // TODO: Fix event getting
        // if ( !isRawTokenTransfer ) {
        //     strActionName = "getPastEvents/ERC721TokenCreated";
        //     let joEvents = await jo_token_manager.getPastEvents( "ERC721TokenCreated", {
        //         "filter": {
        //             "contractThere": [ erc721Address_main_net ]
        //         },
        //         "fromBlock": 0,
        //         "toBlock": "latest"
        //     } );
        //     if ( verbose_get() >= RV_VERBOSE.information )
        //         log.write( cc.success( "Got events for ERC721TokenCreated: " ) + cc.j( joEvents ) + "\n" );
        // } // if( ! isRawTokenTransfer )

    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Payment error in " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return false;
    }
    return true;
} // async function do_erc721_payment_from_main_net(...

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
async function do_erc20_payment_from_main_net(
    w3_main_net,
    w3_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_deposit_box,
    chain_id_s_chain,
    token_amount, // how much ERC20 tokens to send
    jo_token_manager, // only s-chain
    strCoinNameErc20_main_net,
    erc20PrivateTestnetJson_main_net,
    strCoinNameErc20_s_chain,
    erc20PrivateTestnetJson_s_chain,
    isRawTokenTransfer
) {
    let r, strActionName = "";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/do_erc20_payment_from_main_net";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccountSrc.address( w3_main_net ), null );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "ERC20 prepare M->S";
        const erc20ABI = erc20PrivateTestnetJson_main_net[ strCoinNameErc20_main_net + "_abi" ];
        //log.write( cc.normal("erc20PrivateTestnetJson_main_net = ") + cc.j(erc20PrivateTestnetJson_main_net) + "\n" )
        //log.write( cc.normal("strCoinNameErc20_main_net = ") + cc.info(strCoinNameErc20_main_net) + "\n" )
        const erc20Address_main_net = erc20PrivateTestnetJson_main_net[ strCoinNameErc20_main_net + "_address" ];
        //log.write( cc.normal("erc20Address_main_net = ") + cc.info(erc20Address_main_net) + "\n" )
        let contractERC20 = new w3_main_net.eth.Contract( erc20ABI, erc20Address_main_net );
        //prepare the smart contract function deposit(string schainID, address to)
        let depositBoxAddress = jo_deposit_box.options.address;
        let accountForSchain = joAccountDst.address( w3_s_chain );        
        let approve =
            contractERC20.methods.approve(
                depositBoxAddress, "0x" + w3_main_net.utils.toBN( token_amount ).toString(16)
            ).encodeABI();
        let deposit = null;


        log.write( cc.normal("isRawTokenTransfer = ") + cc.info(isRawTokenTransfer) + "\n" )


        if ( isRawTokenTransfer ) {
            let erc20Address_s_chain = erc20PrivateTestnetJson_s_chain[ strCoinNameErc20_s_chain + "_address" ];
            deposit =
                jo_deposit_box.methods.rawDepositERC20(
                    chain_id_s_chain, erc20Address_main_net, erc20Address_s_chain // specific for rawDepositERC20() only
                    , accountForSchain, "0x" + w3_main_net.utils.toBN( token_amount ).toString(16)
                ).encodeABI();
        } else {
            deposit = // beta version
            jo_deposit_box.methods.depositERC20(
                chain_id_s_chain, erc20Address_main_net, accountForSchain, "0x" + w3_main_net.utils.toBN( token_amount ).toString(16)
            ).encodeABI();
        }
        //
        //
        // create raw transactions
        //
        strActionName = "create raw transactions M->S";
        const rawTxApprove = {
            "from": joAccountSrc.address( w3_main_net ), // accountForMainnet
            "nonce": "0x" + tcnt.toString( 16 ),
            "data": approve,
            "to": erc20Address_main_net,
            "gasPrice": 0,
            "gas": 8000000
        }
        tcnt += 1;
        const rawTxDeposit = {
            "from": joAccountSrc.address( w3_main_net ), // accountForMainnet
            "nonce": "0x" + tcnt.toString( 16 ),
            "data": deposit,
            "to": depositBoxAddress,
            "gasPrice": 0,
            "gas": 8000000
        }
        //
        //
        // sign transactions
        //
        strActionName = "sign transactions M->S";
        var privateKeyForMainnet = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        const txApprove = new ethereumjs_tx( rawTxApprove );
        const txDeposit = new ethereumjs_tx( rawTxDeposit );
        txApprove.sign( privateKeyForMainnet );
        txDeposit.sign( privateKeyForMainnet );
        const serializedTxApprove = txApprove.serialize();
        const serializedTxDeposit = txDeposit.serialize();
        //
        //
        // send transactions
        //
        strActionName = "w3_main_net.eth.sendSignedTransaction()/Approve";
        let joReceiptApprove = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        strActionName = "w3_main_net.eth.sendSignedTransaction()/Deposit";
        let joReceiptDeposit = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt for Deposit: " ) + cc.j( joReceiptDeposit ) + "\n" );
        //
        //

        // TODO: Fix event getting
        // if ( !isRawTokenTransfer ) {
        //     strActionName = "getPastEvents/ERC20TokenCreated";
        //     let joEvents = await jo_token_manager.getPastEvents( "ERC20TokenCreated", {
        //         "filter": {
        //             "contractThere": [ erc20Address_main_net ]
        //         },
        //         "fromBlock": 0,
        //         "toBlock": "latest"
        //     } );
        //     if ( verbose_get() >= RV_VERBOSE.information )
        //         log.write( cc.success( "Got events for ERC20TokenCreated: " ) + cc.j( joEvents ) + "\n" );
        // } // if( ! isRawTokenTransfer )

    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Payment error in " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return false;
    }
    return true;
} // async function do_erc20_payment_from_main_net(...

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
async function do_erc20_payment_from_s_chain(
    w3_main_net,
    w3_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_token_manager, // only s-chain
    jo_deposit_box, // only main net
    token_amount, // how much ERC20 tokens to send
    strCoinNameErc20_main_net,
    joErc20_main_net,
    strCoinNameErc20_s_chain,
    joErc20_s_chain,
    isRawTokenTransfer
) {
    let r, strActionName = "";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_erc20_payment_from_s_chain";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_s_chain.eth.getTransactionCount( joAccountSrc.address( w3_s_chain ), null );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "ERC20 prepare S->M";
        let accountForMainnet = joAccountDst.address( w3_main_net );
        let accountForSchain = joAccountSrc.address( w3_s_chain );
        const erc20ABI = joErc20_s_chain[ strCoinNameErc20_s_chain + "_abi" ];
        const erc20Address_s_chain = joErc20_s_chain[ strCoinNameErc20_s_chain + "_address" ];
        let tokenManagerAddress = jo_token_manager.options.address;
        let contractERC20 = new w3_s_chain.eth.Contract( erc20ABI, erc20Address_s_chain );
        //prepare the smart contract function deposit(string schainID, address to)
        let depositBoxAddress = jo_deposit_box.options.address;
        let approve =
            contractERC20.methods.approve(
                tokenManagerAddress, "0x" + w3_main_net.utils.toBN( token_amount ).toString(16)
            ).encodeABI();
        let deposit = null;
        if ( isRawTokenTransfer ) {
            const erc20Address_main_net = joErc20_main_net[ strCoinNameErc20_main_net + "_address" ];
            deposit =
                jo_token_manager.methods.rawExitToMainERC20(
                    erc20Address_s_chain, erc20Address_main_net // specific for rawExitToMainERC20() only
                    , accountForMainnet, "0x" + w3_main_net.utils.toBN( token_amount ).toString(16)
                ).encodeABI();
        } else {
            var function_call_trace = "exitToMainERC20(" +
                erc20Address_s_chain + ", " +
                accountForMainnet + ", " +
                w3_s_chain.utils.toBN( token_amount ).toString(10) + ")"
            deposit = // beta version
            jo_token_manager.methods.exitToMainERC20(
                erc20Address_s_chain, accountForMainnet, "0x" + w3_main_net.utils.toBN( token_amount ).toString(16)
            ).encodeABI();
        }
        //
        //
        // create raw transactions
        //
        //
        strActionName = "create raw transactions S->M";
        const rawTxApprove = {
            "from": accountForSchain,
            "nonce": "0x" + tcnt.toString( 16 ),
            "data": approve,
            "to": erc20Address_s_chain,
            "gasPrice": 10000000000,
            "gas": 8000000
        }
        tcnt += 1;
        const rawTxDeposit = {
            "from": accountForSchain,
            "nonce": "0x" + tcnt.toString( 16 ),
            "data": deposit,
            "to": tokenManagerAddress,
            "gasPrice": 10000000000,
            "gas": 8000000
        }
        //
        //
        // sign transactions
        //
        //
        strActionName = "sign transactions S->M";
        var privateKeyForSchain = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        const txApprove = new ethereumjs_tx( rawTxApprove );
        const txDeposit = new ethereumjs_tx( rawTxDeposit );
        txApprove.sign( privateKeyForSchain );
        txDeposit.sign( privateKeyForSchain );
        const serializedTxApprove = txApprove.serialize();
        const serializedTxDeposit = txDeposit.serialize();
        //
        //
        // send transactions
        //
        strActionName = "w3_s_chain.eth.sendSignedTransaction()/Approve";
        let joReceiptApprove = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        strActionName = "w3_s_chain.eth.sendSignedTransaction()/Deposit";
        let joReceiptDeposit = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt for Deposit: " ) + cc.j( joReceiptDeposit ) + "\n" );
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Payment error in " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return false;
    }
    return true;
} // async function do_erc20_payment_from_s_chain(...

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
async function do_erc721_payment_from_s_chain(
    w3_main_net,
    w3_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_token_manager, // only s-chain
    jo_deposit_box, // only main net
    token_id, // which ERC721 token id to send
    strCoinNameErc721_main_net,
    joErc721_main_net,
    strCoinNameErc721_s_chain,
    joErc721_s_chain,
    isRawTokenTransfer
) {
    let r, strActionName = "";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_erc721_payment_from_s_chain";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_s_chain.eth.getTransactionCount( joAccountSrc.address( w3_s_chain ), null );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "ERC721 prepare S->M";
        let accountForMainnet = joAccountDst.address( w3_main_net );
        let accountForSchain = joAccountSrc.address( w3_s_chain );
        const erc721ABI = joErc721_s_chain[ strCoinNameErc721_s_chain + "_abi" ];
        const erc721Address_s_chain = joErc721_s_chain[ strCoinNameErc721_s_chain + "_address" ];
        let tokenManagerAddress = jo_token_manager.options.address;
        let contractERC721 = new w3_s_chain.eth.Contract( erc721ABI, erc721Address_s_chain );
        //prepare the smart contract function deposit(string schainID, address to)
        let depositBoxAddress = jo_deposit_box.options.address;
        let approve =
            contractERC721.methods.transferFrom(
                accountForSchain, tokenManagerAddress, "0x" + w3_main_net.utils.toBN( token_id ).toString(16)
            ).encodeABI();
        let deposit = null;
        if ( isRawTokenTransfer ) {
            const erc721Address_main_net = joErc721_main_net[ strCoinNameErc721_main_net + "_address" ];
            deposit =
                jo_token_manager.methods.rawExitToMainERC721(
                    erc721Address_s_chain, erc721Address_main_net // specific for rawExitToMainERC721() only
                    , accountForMainnet, "0x" + w3_main_net.utils.toBN( token_id ).toString(16)
                ).encodeABI();
        } else {
            var function_call_trace = "exitToMainERC721(" +
                erc721Address_s_chain + ", " +
                accountForMainnet + ", " +
                w3_s_chain.utils.toBN( token_id ).toString(10) + ")"
            deposit = // beta version
            jo_token_manager.methods.exitToMainERC721(
                erc721Address_s_chain, accountForMainnet, "0x" + w3_main_net.utils.toBN( token_id ).toString(16)
            ).encodeABI();
        }
        //
        //
        // create raw transactions
        //
        //
        strActionName = "create raw transactions S->M";
        const rawTxApprove = {
            "from": accountForSchain,
            "nonce": "0x" + tcnt.toString( 16 ),
            "data": approve,
            "to": erc721Address_s_chain,
            "gasPrice": 10000000000,
            "gas": 8000000
        }
        tcnt += 1;
        const rawTxDeposit = {
            "from": accountForSchain,
            "nonce": "0x" + tcnt.toString( 16 ),
            "data": deposit,
            "to": tokenManagerAddress,
            "gasPrice": 10000000000,
            "gas": 8000000
        }
        //
        //
        // sign transactions
        //
        //
        strActionName = "sign transactions S->M";
        var privateKeyForSchain = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        const txApprove = new ethereumjs_tx( rawTxApprove );
        const txDeposit = new ethereumjs_tx( rawTxDeposit );
        txApprove.sign( privateKeyForSchain );
        txDeposit.sign( privateKeyForSchain );
        const serializedTxApprove = txApprove.serialize();
        const serializedTxDeposit = txDeposit.serialize();
        //
        //
        // send transactions
        //
        strActionName = "w3_s_chain.eth.sendSignedTransaction()/Approve";
        let joReceiptApprove = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        strActionName = "w3_s_chain.eth.sendSignedTransaction()/Deposit";
        let joReceiptDeposit = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString( "hex" ) );
        if ( verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success( "Result receipt for Deposit: " ) + cc.j( joReceiptDeposit ) + "\n" );
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Payment error in " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return false;
    }
    return true;
} // async function do_erc721_payment_from_s_chain(...


//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Do real money movement from main-net to S-chain by sniffing events
// 1) main-net.MessageProxy.getOutgoingMessagesCounter -> save to nOutMsgCnt
// 2) S-chain.MessageProxy.getIncomingMessagesCounter -> save to nIncMsgCnt
// 3) Will transfer all in range from [ nIncMsgCnt ... (nOutMsgCnt-1) ] ... assume current counter index is nIdxCurrentMsg
//
// One transaction transfer is:
// 1) Find events main-net.MessageProxy.OutgoingMessage where msgCounter member is in range
// 2) Publish it to S-chain.MessageProxy.postIncomingMessages(
//            main-net chain id   // uint64 srcChainID
//            nIdxCurrentMsg // uint64 startingCounter
//            [srcContract]  // address[] memory senders
//            [dstContract]  // address[] memory dstContracts
//            [to]           // address[] memory to
//            [amount]       // uint[] memory amount / *uint[2] memory blsSignature* /
//            )
//
async function do_transfer(
    /**/
    w3_src,
    jo_message_proxy_src,
    joAccountSrc,
    //
    w3_dst,
    jo_message_proxy_dst,
    /**/
    joAccountDst,
    //
    chain_id_src,
    chain_id_dst,
    //
    nTransactionsCountInBlock,
    nMaxTransactionsCount,
    nBlockAwaitDepth,
    nBlockAge
) {
    nTransactionsCountInBlock = nTransactionsCountInBlock || 5;
    nMaxTransactionsCount = nMaxTransactionsCount || 100;
    if ( nTransactionsCountInBlock < 1 )
        nTransactionsCountInBlock = 1;
    if ( nBlockAwaitDepth < 0 )
        nBlockAwaitDepth = 0;
    if ( nBlockAge < 0 )
        nBlockAge = 0;
    let r, strActionName = "",
        nIdxCurrentMsg = 0,
        nOutMsgCnt = 0,
        nIncMsgCnt = 0;
    try {
        strActionName = "src-chain.MessageProxy.getOutgoingMessagesCounter()";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        nOutMsgCnt = parseInt( await jo_message_proxy_src.methods.getOutgoingMessagesCounter( chain_id_dst ).call( {
            "from": joAccountSrc.address( w3_src )
        } ) );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Result of " ) + cc.notice( strActionName ) + cc.debug( " call: " ) + cc.info( nOutMsgCnt ) + "\n" );
        //
        strActionName = "dst-chain.MessageProxy.getIncomingMessagesCounter()";
        if ( verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        nIncMsgCnt = parseInt( await jo_message_proxy_dst.methods.getIncomingMessagesCounter( chain_id_src ).call( {
            "from": joAccountDst.address( w3_dst )
        } ) );
        if ( verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug( "Result of " ) + cc.notice( strActionName ) + cc.debug( " call: " ) + cc.info( nIncMsgCnt ) + "\n" );
        //
        //
        // outer loop is block former, then transfer
        nIdxCurrentMsg = nIncMsgCnt;
        var cntProcessed = 0;
        while ( nIdxCurrentMsg < nOutMsgCnt ) {
            if ( verbose_get() >= RV_VERBOSE.trace )
                log.write( cc.debug( "Entering block former iteration with " ) + cc.notice( "message counter" ) + cc.debug( " set to " ) + cc.info( nIdxCurrentMsg ) + "\n" );
            var arrMessageCounters = [];
            const messages = [];
            var nIdxCurrentMsgBlockStart = 0 + nIdxCurrentMsg;
            //
            //
            // inner loop wil create block of transactions
            var cntAccumulatedForBlock = 0;
            for ( let idxInBlock = 0; nIdxCurrentMsg < nOutMsgCnt && idxInBlock < nTransactionsCountInBlock; ++nIdxCurrentMsg, ++idxInBlock, ++cntAccumulatedForBlock ) {
                var idxProcessing = cntProcessed + idxInBlock;
                if ( idxProcessing > nMaxTransactionsCount )
                    break;
                //
                //
                strActionName = "src-chain.MessageProxy.getPastEvents()";
                if ( verbose_get() >= RV_VERBOSE.trace )
                    log.write( cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( " for " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event now..." ) + "\n" );
                r = await jo_message_proxy_src.getPastEvents( "OutgoingMessage", {
                    "filter": {
                        "dstChainHash": [ w3_src.utils.soliditySha3(chain_id_dst) ],
                        "msgCounter": [ nIdxCurrentMsg ]
                    },
                    "fromBlock": 0,
                    "toBlock": "latest"
                } );
                let joValues = "";
                for (let i = r.length - 1; i >= 0; i--) {
                    if (r[ i ].returnValues['dstChain'] == chain_id_dst) {
                        joValues = r[ i ].returnValues;
                        break;
                    }
                }
                if (joValues == "") {
                    log.error(cc.error("Can't get events from MessageProxy") + '\n');
                    process.exit(1);
                }
                //
                //
                //
                if ( nBlockAwaitDepth > 0 ) {
                    let bSecurityCheckPassed = true;
                    let strActionName_old = "" + strActionName;
                    strActionName = "security check: evaluate block depth"
                    try {
                        let transactionHash = r[ 0 ].transactionHash;
                        if ( verbose_get() >= RV_VERBOSE.trace )
                            log.write( cc.debug( "Event transactionHash is " ) + cc.info( transactionHash ) + "\n" );
                        let blockNumber = r[ 0 ].blockNumber;
                        if ( verbose_get() >= RV_VERBOSE.trace )
                            log.write( cc.debug( "Event blockNumber is " ) + cc.info( blockNumber ) + "\n" );
                        let nLatestBlockNumber = await w3_src.eth.getBlockNumber();
                        if ( verbose_get() >= RV_VERBOSE.trace )
                            log.write( cc.debug( "Latest blockNumber is " ) + cc.info( nLatestBlockNumber ) + "\n" );
                        let nDist = nLatestBlockNumber - blockNumber;
                        if ( nDist < nBlockAwaitDepth )
                            bSecurityCheckPassed = false;
                        if ( verbose_get() >= RV_VERBOSE.trace )
                            log.write( cc.debug( "Distance by blockNumber is " ) + cc.info( nDist ) + cc.debug( ", await check is " ) + ( bSecurityCheckPassed ? cc.success( "PASSED" ) : cc.error( "FAILED" ) ) + "\n" );
                    } catch ( err ) {
                        bSecurityCheckPassed = false;
                        if ( verbose_get() >= RV_VERBOSE.fatal )
                            log.write( cc.fatal( "Exception(evaluate block depth) while getting trasaction hash and block number during " + strActionName + ": " ) + cc.error( err ) + "\n" );
                        return false;
                    }
                    strActionName = "" + strActionName_old;
                    if ( !bSecurityCheckPassed ) {
                        if ( verbose_get() >= RV_VERBOSE.trace )
                            log.write( cc.warning( "Block depth check was not passed, canceling search for transfer events" ) + "\n" );
                        break;
                    }
                } // if( nBlockAwaitDepth > 0 )
                if( nBlockAge > 0 ) {
                    let bSecurityCheckPassed = true;
                    let strActionName_old = "" + strActionName;
                    strActionName = "security check: evaluate block age"
                    try {
                        let transactionHash = r[ 0 ].transactionHash;
                        if ( verbose_get() >= RV_VERBOSE.trace )
                            log.write( cc.debug( "Event transactionHash is " ) + cc.info( transactionHash ) + "\n" );
                        let blockNumber = r[ 0 ].blockNumber;
                        if ( verbose_get() >= RV_VERBOSE.trace )
                            log.write( cc.debug( "Event blockNumber is " ) + cc.info( blockNumber ) + "\n" );
                        //
                        //
                        const joBlock = await w3_src.eth.getBlock( blockNumber );
                        const timestampBlock = parseInt( joBlock.timestamp );
                        if ( verbose_get() >= RV_VERBOSE.trace )
                            log.write( cc.debug( "Block   TS is " ) + cc.info( timestampBlock ) + "\n" );
                        const timestampCurrent = parseInt( parseInt( Date.now().valueOf() ) / 1000 );
                        if ( verbose_get() >= RV_VERBOSE.trace )
                            log.write( cc.debug( "Current TS is " ) + cc.info( timestampCurrent ) + "\n" );
                        const tsDiff = timestampCurrent - timestampBlock;
                        if ( verbose_get() >= RV_VERBOSE.trace ) {
                            log.write( cc.debug( "Diff    TS is " ) + cc.info( tsDiff ) + "\n" );
                            log.write( cc.debug( "Expected diff " ) + cc.info( nBlockAge ) + "\n" );
                        }
                        if( tsDiff < nBlockAge )
                            bSecurityCheckPassed = false;
                        if ( verbose_get() >= RV_VERBOSE.trace )
                            log.write( cc.debug( "Block age check is " ) + ( bSecurityCheckPassed ? cc.success( "PASSED" ) : cc.error( "FAILED" ) ) + "\n" );
                    } catch ( err ) {
                        bSecurityCheckPassed = false;
                        if ( verbose_get() >= RV_VERBOSE.fatal )
                            log.write( cc.fatal( "Exception(evaluate block age) while getting block number and timestamp during " + strActionName + ": " ) + cc.error( err ) + "\n" );
                        return false;
                    }
                    strActionName = "" + strActionName_old;
                    if ( !bSecurityCheckPassed ) {
                        if ( verbose_get() >= RV_VERBOSE.trace )
                            log.write( cc.warning( "Block age check was not passed, canceling search for transfer events" ) + "\n" );
                        break;
                    }
                } // if( nBlockAge > 0 )
                //
                //
                //
                if ( verbose_get() >= RV_VERBOSE.debug )
                    log.write(
                        cc.success( "Got event details from " ) + cc.notice( "getPastEvents()" ) +
                        cc.success( " event invoked with " ) + cc.notice( "msgCounter" ) + cc.success( " set to " ) + cc.info( nIdxCurrentMsg ) +
                        cc.success( " and " ) + cc.notice( "dstChain" ) + cc.success( " set to " ) + cc.info( chain_id_dst ) +
                        cc.success( ", event description: " ) + cc.j( joValues ) // + cc.j(evs)
                        +
                        "\n"
                    );
                //
                //
                if ( verbose_get() >= RV_VERBOSE.trace )
                    log.write( cc.debug( "Will process message counter value " ) + cc.info( nIdxCurrentMsg ) + "\n" );
                arrMessageCounters.push( nIdxCurrentMsg );
                messages.push({
                    amount: joValues.amount,
                    data: joValues.data,
                    destinationContract: joValues.dstContract,
                    sender: joValues.srcContract,
                    to: joValues.to
                })
            } // for( let idxInBlock = 0; nIdxCurrentMsg < nOutMsgCnt && idxInBlock < nTransactionsCountInBlock; ++ nIdxCurrentMsg, ++ idxInBlock, ++cntAccumulatedForBlock )
            if ( cntAccumulatedForBlock == 0 )
                break;
            //
            //
            strActionName = "dst-chain.getTransactionCount()";
            let tcnt = await w3_dst.eth.getTransactionCount( joAccountDst.address( w3_dst ), null );
            if ( verbose_get() >= RV_VERBOSE.debug )
                log.write( cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
            //
            //
            var nBlockSize = arrMessageCounters.length;
            strActionName = "dst-chain.MessageProxy.postIncomingMessages()";
            if ( verbose_get() >= RV_VERBOSE.trace )
                log.write(
                    cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( " for " ) +
                    cc.notice( "block size" ) + cc.debug( " set to " ) + cc.info( nBlockSize ) +
                    cc.debug( ", " ) + cc.notice( "message counters =" ) + cc.debug( " are " ) + cc.info( JSON.stringify( arrMessageCounters ) ) +
                    cc.debug( "..." ) + "\n"
                );            
            let dataTx = jo_message_proxy_dst.methods.postIncomingMessages(
                // call params
                chain_id_src,
                nIdxCurrentMsgBlockStart,
                messages
            ).encodeABI(); // the encoded ABI of the method
            //
            if ( verbose_get() >= RV_VERBOSE.trace ) {
                let joDebugArgs = [
                    chain_id_src,
                    chain_id_dst,
                    nIdxCurrentMsgBlockStart,
                    messages
                ];
                log.write(
                    cc.debug( "....debug args for " ) +
                    cc.notice( "msgCounter" ) + cc.debug( " set to " ) + cc.info( nIdxCurrentMsgBlockStart ) + cc.debug( ": " ) +
                    cc.j( joDebugArgs ) + "\n" );
            }
            //
            let rawTx = {
                "nonce": tcnt, // 0x00, ...
                "gas": 3000000,
                "gasPrice": 10000000000, // not w3_dst.eth.gasPrice ... got from truffle.js network_name gasPrice
                "gasLimit": 3000000,
                "to": jo_message_proxy_dst.options.address, // cantract address
                "data": dataTx //,
                //"value": wei_amount // 1000000000000000000 // w3_dst.utils.toWei( (1).toString(), "ether" ) // how much money to send
            };
            if ( verbose_get() >= RV_VERBOSE.trace )
                log.write( cc.debug( "....composed " ) + cc.j( rawTx ) + "\n" );
            let tx = new ethereumjs_tx( rawTx );
            var key = Buffer.from( joAccountDst.privateKey, "hex" ); // convert private key to buffer ??????????????????????????????????
            tx.sign( key ); // arg is privateKey as buffer
            var serializedTx = tx.serialize();
            strActionName = "w3_dst.eth.sendSignedTransaction()";
            let joReceipt = await w3_dst.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
            if ( verbose_get() >= RV_VERBOSE.information )
                log.write( cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
            cntProcessed += cntAccumulatedForBlock;
        } // while( nIdxCurrentMsg < nOutMsgCnt )
    } catch ( e ) {
        if ( verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal( "Error in do_transfer() during " + strActionName + ": " ) + cc.error( e ) + "\n" );
        return false;
    }
    return true;
} // async function do_transfer( ...

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// init helpers
//
function noop() {
    return null;
}
module.exports.longSeparator = g_mtaStrLongSeparator;
module.exports.noop = noop;
module.exports.cc = cc;
module.exports.log = log;
module.exports.w3mod = w3mod;
module.exports.ethereumjs_tx = ethereumjs_tx;
module.exports.ethereumjs_wallet = ethereumjs_wallet;
module.exports.ethereumjs_util = ethereumjs_util;

module.exports.VERBOSE = VERBOSE;
module.exports.RV_VERBOSE = RV_VERBOSE;
module.exports.verbose_get = verbose_get;
module.exports.verbose_set = verbose_set;
module.exports.verbose_parse = verbose_parse;
module.exports.verbose_list = verbose_list;

module.exports.ensure_starts_with_0x = ensure_starts_with_0x;
module.exports.remove_starting_0x = remove_starting_0x;
module.exports.private_key_2_public_key = private_key_2_public_key;
module.exports.public_key_2_account_address = public_key_2_account_address;
module.exports.private_key_2_account_address = private_key_2_account_address;

module.exports.register_s_chain_on_main_net = register_s_chain_on_main_net; // step 1
module.exports.register_s_chain_in_deposit_box = register_s_chain_in_deposit_box; // step 2
module.exports.register_main_net_depositBox_on_s_chain = register_main_net_depositBox_on_s_chain; // step 3

module.exports.check_is_registered_s_chain_on_main_net = check_is_registered_s_chain_on_main_net; // step 1
module.exports.check_is_registered_s_chain_in_deposit_box = check_is_registered_s_chain_in_deposit_box; // step 2
module.exports.check_is_registered_main_net_depositBox_on_s_chain = check_is_registered_main_net_depositBox_on_s_chain; // step 3

module.exports.do_eth_payment_from_main_net = do_eth_payment_from_main_net;
module.exports.do_eth_payment_from_s_chain = do_eth_payment_from_s_chain;
module.exports.receive_eth_payment_from_s_chain_on_main_net = receive_eth_payment_from_s_chain_on_main_net;
module.exports.view_eth_payment_from_s_chain_on_main_net = view_eth_payment_from_s_chain_on_main_net;
module.exports.do_erc721_payment_from_main_net = do_erc721_payment_from_main_net;
module.exports.do_erc20_payment_from_main_net = do_erc20_payment_from_main_net;
module.exports.do_erc20_payment_from_s_chain = do_erc20_payment_from_s_chain;
module.exports.do_erc721_payment_from_s_chain = do_erc721_payment_from_s_chain;
module.exports.do_transfer = do_transfer;
