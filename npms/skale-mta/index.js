// init very basics
const fs    = require( "fs"   );
const path  = require( "path" );
const url   = require( "url"  );
const os    = require( "os"   );
const w3mod = require( "web3" );
let ethereumjs_tx     = require( "ethereumjs-tx"     );
let ethereumjs_wallet = require( "ethereumjs-wallet" );
let ethereumjs_util   = require( "ethereumjs-util"   );

const log = require( "../skale-log/log.js" );
const cc  = log.cc;
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
const VERBOSE = { 0:"silent", 2:"fatal", 3:"error", 4:"warning", 5:"attention", 6:"information", 7:"notce", 8:"debug", 9:"trace" };
const RV_VERBOSE = function () {
    var m = {};
    for( var key in VERBOSE ) {
        if( ! VERBOSE.hasOwnProperty(key) )
            continue; // skip loop if the property is from prototype
        var name = VERBOSE[key];
        m[name] = key;
    }
    return m;
} ();
let verboseLevel = RV_VERBOSE["error"];
function verbose_get() {
    return verboseLevel;
}
function verbose_set( x ) {
    verboseLevel = x;
}
function verbose_parse( s ) {
    var n = 5;
    try {
        var isNumbersOnly = /^\d+$/.test(s);
        if( isNumbersOnly ) {
            n = parseInt( s );
        } else {
            var ch0 = s[0].toLowerCase();
            for( var key in VERBOSE ) {
                if( ! VERBOSE.hasOwnProperty(key) )
                    continue; // skip loop if the property is from prototype
                var name = VERBOSE[key];
                var ch1 = name[0].toLowerCase();
                if( ch0 == ch1 ) {
                    n = key;
                    break;
                }
            }
        }
    } catch( e ) {
    }
    return n;
}
function verbose_list() {
    for( var key in VERBOSE ) {
        if( ! VERBOSE.hasOwnProperty(key) )
            continue; // skip loop if the property is from prototype
        var name = VERBOSE[key];
        console.log( "    " + cc.info(key) + cc.sunny("=") + cc.bright(name) );
    }
}

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// utilites
//
function ensure_starts_with_0x( s ) {
    if( s == null || s == undefined || typeof s !== "string" )
        return s;
    if( s.length < 2 )
        return "0x" + s;
    if( s[0] == "0" && s[1] == "x" )
        return s;
    return "0x" + s;
}
function remove_starting_0x( s ) {
    if( s == null || s == undefined || typeof s !== "string" )
        return s;
    if( s.length < 2 )
        return s;
    if( s[0] == "0" && s[1] == "x" )
        return s.substr( 2 );
    return s;
}
function private_key_2_public_key( w3, keyPrivate ) {
    if( w3 == null || w3 == undefined || keyPrivate == null || keyPrivate == undefined )
        return "";
    // get a wallet instance from a private key
    const privateKeyBuffer = ethereumjs_util.toBuffer( ensure_starts_with_0x(keyPrivate) );
    const wallet = ethereumjs_wallet.fromPrivateKey( privateKeyBuffer );
    // get a public key
    const keyPublic = wallet.getPublicKeyString();
    return remove_starting_0x( keyPublic );
}
function public_key_2_account_address( w3, keyPublic ) {
    if( w3 == null || w3 == undefined || keyPublic == null || keyPublic == undefined )
        return "";
    const hash = w3.utils.sha3( ensure_starts_with_0x(keyPublic) );
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
async function register_s_chain_on_main_net(
    w3_main_net,
    jo_message_proxy_main_net,
    joAccount_main_net,
    chain_id_s_chain
    ) {
    if(verbose_get() >= RV_VERBOSE.debug ) {
        log.write( cc.debug(g_mtaStrLongSeparator) + "\n" );
        log.write( cc.bright("register_s_chain_on_main_net") + "\n" );
        log.write( cc.debug(g_mtaStrLongSeparator) + "\n" );
    }
    let r, strActionName = "";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()";
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("Will call ") + cc.notice(strActionName) + cc.debug("...") + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccount_main_net.address(w3_main_net), null );
        if(verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug("Got ") + cc.info(tcnt) + cc.debug(" from ") + cc.notice(strActionName) + "\n" );
        //
        //
        // based on:
        // https://ethereum.stackexchange.com/questions/47426/call-contract-function-signed-on-client-side-web3-js-1-0
        // https://ethereum.stackexchange.com/questions/25839/how-to-make-transactions-using-private-key-in-web3
        let dataTx = jo_message_proxy_main_net.methods.addConnectedChain(
            chain_id_s_chain, [0,0,0,0] // call params
            ).encodeABI(); // the encoded ABI of the method
        let rawTx = {
            "nonce": tcnt, // 0x00, ...
            "gasPrice": w3_main_net.eth.gasPrice,
            "gasLimit": 3000000,
            "to": jo_message_proxy_main_net.options.address, // cantract address
            "data": dataTx
        };
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("....composed ") + cc.j(rawTx) + "\n" );
        let tx = new ethereumjs_tx( rawTx );
        var key = Buffer.from( joAccount_main_net.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        var serializedTx = tx.serialize();
        strActionName = "w3_main_net.eth.sendSignedTransaction()";
        let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString("hex") );
        if(verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success("Result receipt: ") + cc.j(joReceipt) + "\n" );
    } catch( e ) {
        if(verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal("Error in register_s_chain_on_main_net() during " + strActionName + ": ") + cc.error(e) + "\n" );
        return false;
    }
    return true;
} // async function register_s_chain(...


//
// register direction for money transfer
// main-net.DepositBox call: function addSchain(uint64 schainID, address tokenManagerAddress)
//
async function register_s_chain_in_deposit_box(
    w3_main_net,
    jo_deposit_box, // only main net
    joAccount_main_net,
    jo_token_manager, // only s-chain
    chain_id_s_chain
    ) {
    if(verbose_get() >= RV_VERBOSE.debug ) {
        log.write( cc.debug(g_mtaStrLongSeparator) + "\n" );
        log.write( cc.bright("register_s_chain_in_deposit_box") + "\n" );
        log.write( cc.debug(g_mtaStrLongSeparator) + "\n" );
    }
    let r, strActionName = "";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()";
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("Will call ") + cc.notice(strActionName) + cc.debug("...") + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccount_main_net.address(w3_main_net), null );
        if(verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug("Got ") + cc.info(tcnt) + cc.debug(" from ") + cc.notice(strActionName) + "\n" );
        //
        //
        let dataTx = jo_deposit_box.methods.addSchain(
            chain_id_s_chain, jo_token_manager.options.address // call params
            ).encodeABI(); // the encoded ABI of the method
        let rawTx = {
            "nonce": tcnt, // 0x00, ...
            "gasPrice": w3_main_net.eth.gasPrice,
            "gasLimit": 3000000,
            "to": jo_deposit_box.options.address, // cantract address
            "data": dataTx
        };
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("....composed ") + cc.j(rawTx) + "\n" );
        let tx = new ethereumjs_tx( rawTx );
        var key = Buffer.from( joAccount_main_net.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        var serializedTx = tx.serialize();
        strActionName = "w3_main_net.eth.sendSignedTransaction()";
        let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString("hex") );
        if(verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success("Result receipt: ") + cc.j(joReceipt) + "\n" );
    } catch( e ) {
        if(verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal("Error in register_s_chain_in_deposit_box() during " + strActionName + ": ") + cc.error(e) + "\n" );
        return false;
    }
    return true;
} // async function register_deposit_box_on_s_chain(...

async function reister_main_net_depositBox_on_s_chain(
    w3_s_chain,
    jo_token_manager,
    jo_deposit_box_main_net,
    joAccount
    ) {
    if(verbose_get() >= RV_VERBOSE.debug ) {
        log.write( cc.debug(g_mtaStrLongSeparator) + "\n" );
        log.write( cc.bright("reister_main_net_depositBox_on_s_chain") + "\n" );
        log.write( cc.debug(g_mtaStrLongSeparator) + "\n" );
    }
    let r, strActionName = "";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/reister_main_net_depositBox_on_s_chain";
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("Will call ") + cc.notice(strActionName) + cc.debug("...") + "\n" );
        let tcnt = await w3_s_chain.eth.getTransactionCount( joAccount.address(w3_s_chain), null );
        if(verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug("Got ") + cc.info(tcnt) + cc.debug(" from ") + cc.notice(strActionName) + "\n" );
        //
        //
        let dataTx = jo_token_manager.methods.addDepositBox(
            jo_deposit_box_main_net.options.address // call params
            ).encodeABI(); // the encoded ABI of the method
        let rawTx = {
            "nonce": tcnt, // 0x00, ...
            "gasPrice": w3_s_chain.eth.gasPrice,
            "gasLimit": 3000000,
            "to": jo_token_manager.options.address, // cantract address
            "data": dataTx
        };
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("....composed ") + cc.j(rawTx) + "\n" );
        let tx = new ethereumjs_tx( rawTx );
        var key = Buffer.from( joAccount.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        var serializedTx = tx.serialize();
        strActionName = "w3_s_chain.eth.sendSignedTransaction()";
        let joReceipt = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTx.toString("hex") );
        if(verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success("Result receipt: ") + cc.j(joReceipt) + "\n" );
    } catch( e ) {
        if(verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal("Error in reister_main_net_depositBox_on_s_chain() during " + strActionName + ": ") + cc.error(e) + "\n" );
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
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("Will call ") + cc.notice(strActionName) + cc.debug("...") + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccountSrc.address(w3_main_net), null  );
        if(verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug("Got ") + cc.info(tcnt) + cc.debug(" from ") + cc.notice(strActionName) + "\n" );
        //
        //
        let dataTx = jo_deposit_box.methods.deposit(
            // call params, last is destination account on S-chain
            chain_id_s_chain
            , joAccountDst.address(w3_main_net)
            , w3_main_net.utils.fromAscii("") // TO-DO: string is "data" parameter, we need to allow user to specify it
            ).encodeABI(); // the encoded ABI of the method
        let rawTx = {
            "nonce": tcnt, // 0x00, ...
            "gas"  : 2100000,
            "gasPrice": 10000000000, // not w3.eth.gasPrice ... got from truffle.js network_name gasPrice
            "gasLimit": 3000000,
            "to": jo_deposit_box.options.address, // cantract address
            "data": dataTx,
            "value": wei_how_much // how much money to send
        };
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("....composed ") + cc.j(rawTx) + "\n" );
        let tx = new ethereumjs_tx( rawTx );
        var key = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        var serializedTx = tx.serialize();
        strActionName = "w3_main_net.eth.sendSignedTransaction()";
        let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString("hex") );
        if(verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success("Result receipt: ") + cc.j(joReceipt) + "\n" );
    } catch( e ) {
        if(verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal("Payment error in " + strActionName + ": ") + cc.error(e) + "\n" );
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
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("Will call ") + cc.notice(strActionName) + cc.debug("...") + "\n" );
        let tcnt = await w3_s_chain.eth.getTransactionCount( joAccountSrc.address(w3_s_chain), null  );
        if(verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug("Got ") + cc.info(tcnt) + cc.debug(" from ") + cc.notice(strActionName) + "\n" );
        //
        //
        let dataTx = jo_token_manager.methods.exitToMain(
            // call params, last is destination account on S-chain
            joAccountDst.address(w3_s_chain)
            , w3_s_chain.utils.fromAscii("") // TO-DO: string is "data" parameter, we need to allow user to specify it
            ).encodeABI(); // the encoded ABI of the method
        let rawTx = {
            "nonce": tcnt, // 0x00, ...
            "gas"  : 2100000,
            "gasPrice": 10000000000, // not w3.eth.gasPrice ... got from truffle.js network_name gasPrice
            "gasLimit": 3000000,
            "to": jo_token_manager.options.address, // cantract address
            "data": dataTx,
            "value": wei_how_much // how much money to send
        };
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("....composed ") + cc.j(rawTx) + "\n" );
        let tx = new ethereumjs_tx( rawTx );
        var key = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        var serializedTx = tx.serialize();
        strActionName = "w3_s_chain.eth.sendSignedTransaction()";
        let joReceipt = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTx.toString("hex") );
        if(verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success("Result receipt: ") + cc.j(joReceipt) + "\n" );
    } catch( e ) {
        if(verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal("Payment error in " + strActionName + ": ") + cc.error(e) + "\n" );
        return false;
    }
    return true;
} // async function do_eth_payment_from_s_chain(...

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
    erc20PrivateTestnetJson
    ) {
    let r, strActionName = "";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/do_erc20_payment_from_main_net";
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("Will call ") + cc.notice(strActionName) + cc.debug("...") + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccountSrc.address(w3_main_net), null  );
        if(verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug("Got ") + cc.info(tcnt) + cc.debug(" from ") + cc.notice(strActionName) + "\n" );
        //
        //
        strActionName = "ERC20 prepare M->S";
        const erc20ABI = erc20PrivateTestnetJson[ strCoinNameErc20_main_net + "_abi" ];
        const erc20Address = erc20PrivateTestnetJson[ strCoinNameErc20_main_net + "_address" ];
        let contractERC20 = new w3_main_net.eth.Contract(erc20ABI, erc20Address);
        //prepare the smart contract function deposit(string schainID, address to)
        let depositBoxAddress = jo_deposit_box.options.address;
        let accountForSchain = joAccountDst.address(w3_s_chain);
        let approve = contractERC20.methods.approve(depositBoxAddress, w3_main_net.utils.toBN("1000000000000000000")).encodeABI();
        let deposit = jo_deposit_box.methods.depositERC20(chain_id_s_chain, erc20Address, accountForSchain, w3_main_net.utils.toBN("1000000000000000000")).encodeABI();
        //
        //
        // create raw transactions
        //
        strActionName = "create raw transactions M->S";
        const rawTxApprove = {
          "from": joAccountSrc.address(w3_main_net), // accountForMainnet
          "nonce": "0x" + tcnt.toString(16),
          "data": approve,
          "to": erc20Address,
          "gasPrice": 0,
          "gas": 8000000
        }
        tcnt += 1;
        const rawTxDeposit = {
            "from": joAccountSrc.address(w3_main_net), // accountForMainnet
            "nonce": "0x" + tcnt.toString(16),
            "data": deposit,
            "to": depositBoxAddress,
            "gasPrice": 0,
            "gas": 8000000,
            "value": w3_main_net.utils.toHex(w3_main_net.utils.toWei( /*"1"*/token_amount, "ether" ) )
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
        let joReceiptApprove = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString("hex") );
        if(verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success("Result receipt for Approve: ") + cc.j(joReceiptApprove) + "\n" );
        strActionName = "w3_main_net.eth.sendSignedTransaction()/Approve";
        let joReceiptDeposit = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString("hex") );
        if(verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success("Result receipt for Deposit: ") + cc.j(joReceiptDeposit) + "\n" );
        //
        //
        strActionName = "getPastEvents/ERC20TokenCreated";
        let joEvents = await jo_token_manager.getPastEvents("ERC20TokenCreated", {
            "filter": {"contractThere": [erc20Address]},
            "fromBlock": 0,
            "toBlock": "latest"
        } );
        if(verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success("Got events for ERC20TokenCreated: ") + cc.j(joEvents) + "\n" );
    } catch( e ) {
        if(verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal("Payment error in " + strActionName + ": ") + cc.error(e) + "\n" );
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
    strCoinNameErc20_s_chain,
    joErc20_s_chain
    ) {
    let r, strActionName = "";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_erc20_payment_from_s_chain";
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("Will call ") + cc.notice(strActionName) + cc.debug("...") + "\n" );
        let tcnt = await w3_s_chain.eth.getTransactionCount( joAccountSrc.address(w3_s_chain), null  );
        if(verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug("Got ") + cc.info(tcnt) + cc.debug(" from ") + cc.notice(strActionName) + "\n" );
        //
        //
        strActionName = "ERC20 prepare S->M";
        let accountForMainnet = joAccountDst.address(w3_main_net);
        let accountForSchain = joAccountSrc.address(w3_s_chain);
        const erc20ABI = joErc20_s_chain[ strCoinNameErc20_s_chain + "_abi" ];
        const erc20Address = joErc20_s_chain[ strCoinNameErc20_s_chain + "_address" ];
        let tokenManagerAddress = jo_token_manager.options.address;
        let contractERC20 = new w3_s_chain.eth.Contract(erc20ABI, erc20Address);
        //prepare the smart contract function deposit(string schainID, address to)
        let depositBoxAddress = jo_deposit_box.options.address;
        let approve = contractERC20.methods.approve(tokenManagerAddress, w3_s_chain.utils.toBN("1000000000000000000")).encodeABI();
        let deposit = jo_token_manager.methods.exitToMainERC20(erc20Address, accountForMainnet, w3_s_chain.utils.toBN("1000000000000000000")).encodeABI();
        //
        //
        // create raw transactions
        //
        //
        strActionName = "create raw transactions S->M";
        const rawTxApprove = {
          "from": accountForSchain,
          "nonce": "0x" + tcnt.toString(16),
          "data": approve,
          "to": erc20Address,
          "gasPrice": 0,
          "gas": 8000000
        }
        tcnt += 1;
        const rawTxDeposit = {
            "from": accountForSchain,
            "nonce": "0x" + tcnt.toString(16),
            "data": deposit,
            "to": tokenManagerAddress,
            "gasPrice": 0,
            "gas": 8000000,
            "value": w3_s_chain.utils.toHex(w3_s_chain.utils.toWei( /*"1"*/token_amount, "ether" ) )
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
        let joReceiptApprove = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString("hex") );
        if(verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success("Result receipt for Approve: ") + cc.j(joReceiptApprove) + "\n" );
        strActionName = "w3_s_chain.eth.sendSignedTransaction()/Approve";
        let joReceiptDeposit = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString("hex") );
        if(verbose_get() >= RV_VERBOSE.information )
            log.write( cc.success("Result receipt for Deposit: ") + cc.j(joReceiptDeposit) + "\n" );
    } catch( e ) {
        if(verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal("Payment error in " + strActionName + ": ") + cc.error(e) + "\n" );
        return false;
    }
    return true;
} // async function do_erc20_payment_from_s_chain(...


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
    /**/ w3_src,
    jo_message_proxy_src,
    joAccountSrc,
    //
    w3_dst,
    jo_message_proxy_dst,
    /**/ joAccountDst,
    //
    chain_id_src,
    chain_id_dst,
    //
    nTransactionsCountInBlock,
    nMaxTransactionsCount
    ) {
    nTransactionsCountInBlock = nTransactionsCountInBlock || 5;
    nMaxTransactionsCount = nMaxTransactionsCount || 100;
    if( nTransactionsCountInBlock < 1 )
        nTransactionsCountInBlock = 1;
    let r, strActionName = "", nIdxCurrentMsg = 0, nOutMsgCnt = 0, nIncMsgCnt = 0;
    try {
        strActionName = "src-chain.MessageProxy.getOutgoingMessagesCounter()";
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("Will call ") + cc.notice(strActionName) + cc.debug("...") + "\n" );
        nOutMsgCnt = parseInt( await jo_message_proxy_src.methods.getOutgoingMessagesCounter( chain_id_dst ).call( { "from": joAccountSrc.address(w3_src) } ) );
        if(verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug("Result of ") + cc.notice(strActionName) + cc.debug(" call: ") + cc.info(nOutMsgCnt) + "\n" );
        //
        strActionName = "dst-chain.MessageProxy.getIncomingMessagesCounter()";
        if(verbose_get() >= RV_VERBOSE.trace )
            log.write( cc.debug("Will call ") + cc.notice(strActionName) + cc.debug("...") + "\n" );
        nIncMsgCnt = parseInt( await jo_message_proxy_dst.methods.getIncomingMessagesCounter( chain_id_src ).call( { "from": joAccountDst.address(w3_dst) } ) );
        if(verbose_get() >= RV_VERBOSE.debug )
            log.write( cc.debug("Result of ") + cc.notice(strActionName) + cc.debug(" call: ") + cc.info(nIncMsgCnt) + "\n" );
        //
        //
        // outer loop is block former, then transfer
        nIdxCurrentMsg = nIncMsgCnt;
        var cntProcessed = 0;
        while( nIdxCurrentMsg < nOutMsgCnt ) {
            if(verbose_get() >= RV_VERBOSE.trace )
                log.write( cc.debug("Entering block former iteration with ") + cc.notice("message counter") + cc.debug(" set to ") + cc.info(nIdxCurrentMsg) + "\n" );
            var arrMessageCounters = [];
            var arrSrc = [];
            var arrDst = [];
            var arrTo = [];
            var arrAmount = [];
            var strDataAll = "";
            var arrLengths = [];
            var nIdxCurrentMsgBlockStart = 0 + nIdxCurrentMsg;
            //
            //
            // inner loop wil create block of transactions
            var cntAccumulatedForBlock = 0;
            for( let idxInBlock = 0; nIdxCurrentMsg < nOutMsgCnt && idxInBlock < nTransactionsCountInBlock; ++ nIdxCurrentMsg, ++ idxInBlock, ++cntAccumulatedForBlock ) {
                var idxProcessing = cntProcessed + idxInBlock;
                if( idxProcessing > nMaxTransactionsCount )
                    break;
                //
                //
                strActionName = "src-chain.MessageProxy.getPastEvents()";
                if(verbose_get() >= RV_VERBOSE.trace )
                    log.write( cc.debug("Will call ") + cc.notice(strActionName) + cc.debug(" for ") + cc.info("OutgoingMessage") + cc.debug(" event now...") + "\n" );
                r = await jo_message_proxy_src.getPastEvents( "OutgoingMessage", {
                        "filter": { "msgCounter": [ nIdxCurrentMsg ] },
                        "fromBlock": 0,
                        "toBlock": "latest"
                    } );
                let joValues = r[0].returnValues;
                if(verbose_get() >= RV_VERBOSE.debug )
                    log.write(
                        cc.success("Got event details from ") + cc.notice("getPastEvents()")
                        + cc.success(" event invoked with ") + cc.notice("msgCounter") + cc.success(" set to ") + cc.info(nIdxCurrentMsg)
                        + cc.success(", event description: ") + cc.j(joValues) // + cc.j(evs)
                        + "\n"
                        );
                //
                //
                if(verbose_get() >= RV_VERBOSE.trace )
                    log.write( cc.debug("Will process message counter value ") + cc.info(nIdxCurrentMsg) + "\n" );
                arrMessageCounters.push( nIdxCurrentMsg );
                arrSrc.push( joValues.srcContract );
                arrDst.push( joValues.dstContract );
                arrTo.push( joValues.to );
                arrAmount.push( joValues.amount );
                strDataAll += w3_dst.utils.hexToAscii(joValues.data);
                arrLengths.push( joValues.length );
            } // for( let idxInBlock = 0; nIdxCurrentMsg < nOutMsgCnt && idxInBlock < nTransactionsCountInBlock; ++ nIdxCurrentMsg, ++ idxInBlock, ++cntAccumulatedForBlock )
            if( cntAccumulatedForBlock == 0 )
                break;
            //
            //
            strActionName = "dst-chain.getTransactionCount()";
            let tcnt = await w3_dst.eth.getTransactionCount( joAccountDst.address(w3_dst), null );
            if(verbose_get() >= RV_VERBOSE.debug )
                log.write( cc.debug("Got ") + cc.info(tcnt) + cc.debug(" from ") + cc.notice(strActionName) + "\n" );
            //
            //
            var nBlockSize = arrMessageCounters.length;
            strActionName = "dst-chain.MessageProxy.postIncomingMessages()";
            if(verbose_get() >= RV_VERBOSE.trace )
                log.write(
                    cc.debug("Will call ") + cc.notice(strActionName) + cc.debug(" for ")
                    + cc.notice("block size") + cc.debug(" set to ") + cc.info(nBlockSize)
                    + cc.debug(", ") + cc.notice("message counters =") + cc.debug(" are ") + cc.info(JSON.stringify(arrMessageCounters))
                    + cc.debug("...") + "\n"
                    );
            let dataTx = jo_message_proxy_dst.methods.postIncomingMessages(
                // call params
                chain_id_src,
                nIdxCurrentMsgBlockStart,
                arrSrc,   // address[] memory senders
                arrDst,   // address[] memory dstContracts
                arrTo,    // address[] memory to
                arrAmount, // uint[] memory amount / *uint[2] memory blsSignature* /
                w3_dst.utils.asciiToHex(strDataAll),
                arrLengths
                ).encodeABI(); // the encoded ABI of the method
            //
            if(verbose_get() >= RV_VERBOSE.trace ) {
                            let joDebugArgs = [
                                chain_id_src,
                                chain_id_dst,
                                nIdxCurrentMsgBlockStart,
                                arrSrc,   // address[] memory senders
                                arrDst,   // address[] memory dstContracts
                                arrTo,    // address[] memory to
                                arrAmount // uint[] memory amount / *uint[2] memory blsSignature* /
                            ];
                            log.write(
                                cc.debug("....debug args for ")
                                + cc.notice("msgCounter") + cc.debug(" set to ") + cc.info(nIdxCurrentMsgBlockStart) + cc.debug(": ")
                                + cc.j(joDebugArgs) + "\n" );
            }
            //
            let rawTx = {
                "nonce": tcnt, // 0x00, ...
                "gas"  : 2100000,
                "gasPrice": 10000000000, // not w3_dst.eth.gasPrice ... got from truffle.js network_name gasPrice
                "gasLimit": 3000000,
                "to": jo_message_proxy_dst.options.address, // cantract address
                "data": dataTx //,
                //"value": wei_amount // 1000000000000000000 // w3_dst.utils.toWei( (1).toString(), "ether" ) // how much money to send
            };
            if(verbose_get() >= RV_VERBOSE.trace )
                log.write( cc.debug("....composed ") + cc.j(rawTx) + "\n" );
            let tx = new ethereumjs_tx( rawTx );
            var key = Buffer.from( joAccountDst.privateKey, "hex" ); // convert private key to buffer ??????????????????????????????????
            tx.sign( key ); // arg is privateKey as buffer
            var serializedTx = tx.serialize();
            strActionName = "w3_dst.eth.sendSignedTransaction()";
            let joReceipt = await w3_dst.eth.sendSignedTransaction( "0x" + serializedTx.toString("hex") ) ;
            if(verbose_get() >= RV_VERBOSE.information )
                log.write( cc.success("Result receipt: ") + cc.j(joReceipt) + "\n" );
            cntProcessed += cntAccumulatedForBlock;
        } // while( nIdxCurrentMsg < nOutMsgCnt )
    } catch( e ) {
        if(verbose_get() >= RV_VERBOSE.fatal )
            log.write( cc.fatal("Error in do_transfer() during " + strActionName + ": ") + cc.error(e) + "\n" );
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
function noop() { return null; }
module.exports.longSeparator = g_mtaStrLongSeparator;
module.exports.noop  = noop;
module.exports.cc    = cc;
module.exports.log   = log;
module.exports.w3mod = w3mod;
module.exports.ethereumjs_tx     = ethereumjs_tx;
module.exports.ethereumjs_wallet = ethereumjs_wallet;
module.exports.ethereumjs_util   = ethereumjs_util;

module.exports.VERBOSE       = VERBOSE;
module.exports.RV_VERBOSE    = RV_VERBOSE;
module.exports.verbose_get   = verbose_get;
module.exports.verbose_set   = verbose_set;
module.exports.verbose_parse = verbose_parse;
module.exports.verbose_list  = verbose_list;

module.exports.ensure_starts_with_0x          = ensure_starts_with_0x;
module.exports.remove_starting_0x             = remove_starting_0x;
module.exports.private_key_2_public_key       = private_key_2_public_key;
module.exports.public_key_2_account_address   = public_key_2_account_address;
module.exports.private_key_2_account_address  = private_key_2_account_address;

module.exports.register_s_chain_on_main_net           = register_s_chain_on_main_net;
module.exports.register_s_chain_in_deposit_box        = register_s_chain_in_deposit_box;
module.exports.reister_main_net_depositBox_on_s_chain = reister_main_net_depositBox_on_s_chain;
module.exports.do_eth_payment_from_main_net   = do_eth_payment_from_main_net;
module.exports.do_eth_payment_from_s_chain    = do_eth_payment_from_s_chain;
module.exports.do_erc20_payment_from_main_net = do_erc20_payment_from_main_net;
module.exports.do_erc20_payment_from_s_chain  = do_erc20_payment_from_s_chain;
module.exports.do_transfer                    = do_transfer;
