// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * SKALE IMA is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * SKALE IMA is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file index.js
 * @copyright SKALE Labs 2019-Present
 */

// init very basics
// const fs = require( "fs" );
// const path = require( "path" );
// const url = require( "url" );
// const os = require( "os" );
const w3mod = require( "web3" );
const ethereumjs_tx = require( "ethereumjs-tx" );
const ethereumjs_wallet = require( "ethereumjs-wallet" );
const ethereumjs_util = require( "ethereumjs-util" );

const log = require( "../skale-log/log.js" );
const cc = log.cc;
cc.enable( true );
log.addStdout();
// log.add( strFilePath, nMaxSizeBeforeRotation, nMaxFilesCount ); // example: log output to file

const owaspUtils = require( "../skale-owasp/owasp-util.js" );

const g_mtaStrLongSeparator = "=======================================================================================================================";

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
    7: "notice",
    8: "debug",
    9: "trace"
};
const RV_VERBOSE = ( function() {
    const m = {};
    for( const key in VERBOSE ) {
        if( !VERBOSE.hasOwnProperty( key ) )
            continue; // skip loop if the property is from prototype
        const name = VERBOSE[key];
        m[name] = key;
    }
    m.warn = m.warning; // alias
    m.info = m.information; // alias
    return m;
}() );

let g_verboseLevel = RV_VERBOSE.error;

function verbose_get() {
    return g_verboseLevel;
}
function verbose_set( x ) {
    g_verboseLevel = x;
}

function verbose_parse( s ) {
    let n = 5;
    try {
        const isNumbersOnly = /^\d+$/.test( s );
        if( isNumbersOnly )
            n = owaspUtils.toInteger( s );
        else {
            const ch0 = s[0].toLowerCase();
            for( const key in VERBOSE ) {
                if( !VERBOSE.hasOwnProperty( key ) )
                    continue; // skip loop if the property is from prototype
                const name = VERBOSE[key];
                const ch1 = name[0].toLowerCase();
                if( ch0 == ch1 ) {
                    n = key;
                    break;
                }
            }
        }
    } catch ( err ) {}
    return n;
}

function verbose_list() {
    for( const key in VERBOSE ) {
        if( !VERBOSE.hasOwnProperty( key ) )
            continue; // skip loop if the property is from prototype
        const name = VERBOSE[key];
        console.log( "    " + cc.info( key ) + cc.sunny( "=" ) + cc.bright( name ) );
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const g_nSleepBetweenTransactionsOnSChainMilliseconds = 0;
const g_bWaitForNextBlockOnSChain = false;

const sleep = ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

function parseIntSafer( s ) {
    s = s.trim();
    if( s.length > 2 && s[0] == "0" && ( s[1] == "x" || s[1] == "X" ) )
        return parseInt( s, 10 );
    return parseInt( s, 16 );
}

async function wait_for_next_block_to_appear( w3 ) {
    const nBlockNumber = await w3.eth.getBlockNumber();
    log.write( cc.debug( "Waiting for next block to appear..." ) + "\n" );
    log.write( cc.debug( "    ...have block " ) + cc.info( parseIntSafer( nBlockNumber ) ) + "\n" );
    for( ; true; ) {
        await sleep( 1000 );
        const nBlockNumber2 = await w3.eth.getBlockNumber();
        log.write( cc.debug( "    ...have block " ) + cc.info( parseIntSafer( nBlockNumber2 ) ) + "\n" );
        if( nBlockNumber2 > nBlockNumber )
            break;
    }
}

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//

async function get_contract_call_events( joContract, strEventName, nBlockNumber, strTxHash, joFilter ) {
    joFilter = joFilter || {};
    const joAllEventsInBlock = await joContract.getPastEvents( "" + strEventName, {
        filter: joFilter,
        fromBlock: nBlockNumber,
        toBlock: nBlockNumber
    } );
    const joAllTransactionEvents = []; let i;
    for( i = 0; i < joAllEventsInBlock.length; ++i ) {
        const joEvent = joAllEventsInBlock[i];
        if( "transactionHash" in joEvent && joEvent.transactionHash == strTxHash )
            joAllTransactionEvents.push( joEvent );
    }
    return joAllTransactionEvents;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function compose_tx_instance( strLogPrefix, rawTx ) {
    if( verbose_get() >= RV_VERBOSE.trace )
        log.write( cc.attention( "TRANSACTION COMPOSER" ) + cc.normal( " is using " ) + cc.bright( "Web3" ) + cc.normal( " version " ) + cc.sunny( w3mod.version ) + "\n" );
    strLogPrefix = strLogPrefix || "";
    rawTx = JSON.parse( JSON.stringify( rawTx ) ); // clone
    let joOpts = null;
    if( "chainId" in rawTx && typeof rawTx.chainId == "number" ) {
        switch ( rawTx.chainId ) {
        case 1:
            delete rawTx.chainId;
            joOpts = joOpts || { };
            joOpts.chain = "mainnet";
            break;
        case 3:
            delete rawTx.chainId;
            joOpts = joOpts || { };
            joOpts.chain = "ropsten";
            break;
        case 4:
            delete rawTx.chainId;
            joOpts = joOpts || { };
            joOpts.chain = "rinkeby";
            break;
        case 5:
            delete rawTx.chainId;
            joOpts = joOpts || { };
            joOpts.chain = "goerli";
            break;
        case 2018:
            delete rawTx.chainId;
            joOpts = joOpts || { };
            joOpts.chain = "dev";
            break;
        } // switch( rawTx.chainId )
    }
    // if( rawTx.chainId && Number(rawTx.chainId) > 1 ) {
    //     rawTx.nonce += 1048576; // see https://ethereum.stackexchange.com/questions/12810/need-help-signing-a-raw-transaction-with-ethereumjs-tx
    //     rawTx.nonce = w3mod.utils.toHex( rawTx.nonce );
    // }
    if( verbose_get() >= RV_VERBOSE.trace )
        log.write( strLogPrefix + cc.debug( "....composed " ) + cc.j( rawTx ) + cc.debug( " with opts " ) + cc.j( joOpts ) + "\n" );
    let tx = null;
    if( joOpts )
        tx = new ethereumjs_tx( rawTx, joOpts );
    else
        tx = new ethereumjs_tx( rawTx );
    return tx;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let g_bDryRunIsEnabled = true;

function dry_run_is_enabled() {
    return g_bDryRunIsEnabled ? true : false;
}

function dry_run_enable( isEnable ) {
    g_bDryRunIsEnabled = ( isEnable != null && isEnable != undefined ) ? ( isEnable ? true : false ) : true;
    return g_bDryRunIsEnabled ? true : false;
}

let g_bDryRunIsIgnored = false;

function dry_run_is_ignored() {
    return g_bDryRunIsIgnored ? true : false;
}

function dry_run_ignore( isIgnored ) {
    g_bDryRunIsIgnored = ( isIgnored != null && isIgnored != undefined ) ? ( isIgnored ? true : false ) : true;
    return g_bDryRunIsIgnored ? true : false;
}

function extract_dry_run_method_name( methodWithArguments ) {
    try {
        const s = "" + methodWithArguments._method.name;
        return s;
    } catch ( err ) {
    }
    return "N/A-method-name";
}

async function dry_run_call( w3, methodWithArguments, joAccount, strDRC, isIgnore ) {
    if( verbose_get() >= RV_VERBOSE.information )
        log.write( cc.attention( "DRY RUN" ) + cc.normal( " is using " ) + cc.bright( "Web3" ) + cc.normal( " version " ) + cc.sunny( w3.version ) + "\n" );
    isIgnore = ( isIgnore != null && isIgnore != undefined ) ? ( isIgnore ? true : false ) : false;
    const strMethodName = extract_dry_run_method_name( methodWithArguments );
    const strWillBeIgnored = isIgnore ? "IGNORED " : "";
    let strLogPrefix = cc.attention( strWillBeIgnored + "DRY RUN CALL TO THE " ) + cc.bright( strMethodName ) + cc.attention( " METHOD" );
    if( strDRC && typeof strDRC == "string" && strDRC.length )
        strLogPrefix += cc.normal( "(" ) + cc.debug( strDRC ) + cc.normal( ")" );
    strLogPrefix += cc.attention( ":" ) + " ";
    if( ! dry_run_is_enabled() ) {
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Skipped, dry run is disabled" ) + "\n" );
        return;
    }
    try {
        const addressFrom = joAccount.address( w3 );
        // console.log( methodWithArguments );
        if( verbose_get() >= RV_VERBOSE.information ) {
            log.write( strLogPrefix + cc.debug( " will call method" ) +
            // cc.debug( " with data " ) + cc.normal( cc.safeStringifyJSON( methodWithArguments ) ) +
            cc.debug( " from address " ) + cc.sunny( addressFrom ) +
            "\n" );
        }
        const joResult = await methodWithArguments.call( {
            from: addressFrom,
            gas: 8000000
        } );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "got result " ) + cc.normal( cc.safeStringifyJSON( joResult ) ) + "\n" );
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.error ) {
            let strErrorMessage = "" + strLogPrefix;
            if( isIgnore )
                strErrorMessage += cc.warning( "IGNORED DRY RUN FAIL:" );
            else
                strErrorMessage += cc.fatal( "CRITICAL DRY RUN FAIL:" );
            strErrorMessage += " " + cc.error( err ) + "\n";
            log.write( strErrorMessage );
        }
        if( ! ( isIgnore || dry_run_is_ignored() ) )
            throw new Error( "CRITICAL DRY RUN FAIL invoking the \"" + strMethodName + "\" method: " + err.toString() );
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function safe_send_signed_transaction( w3, serializedTx, strActionName, strLogPrefix ) {
    if( verbose_get() >= RV_VERBOSE.information )
        log.write( cc.attention( "SEND TRANSACTION" ) + cc.normal( " is using " ) + cc.bright( "Web3" ) + cc.normal( " version " ) + cc.sunny( w3.version ) + "\n" );
    const strTX = "0x" + serializedTx.toString( "hex" ); // strTX is string starting from "0x"
    let joReceipt = null;
    let bHaveReceipt = false;
    try {
        joReceipt = await w3.eth.sendSignedTransaction( strTX );
        bHaveReceipt = ( joReceipt != null );
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "WARNING:" ) + cc.warning( " first attempt to send signed transaction failure during " + strActionName + ": " ) + cc.sunny( err ) + "\n" );
    }
    if( !bHaveReceipt ) {
        try {
            joReceipt = await w3.eth.sendSignedTransaction( strTX );
        } catch ( err ) {
            if( verbose_get() >= RV_VERBOSE.fatal )
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " second attempt to send signed transaction failure during " + strActionName + ": " ) + cc.error( err ) + "\n" );
            throw err;
        }
    }
    return joReceipt;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// register S-Chain 1A on main net
//

async function check_is_registered_s_chain_on_main_net( // step 1A
    w3_main_net,
    jo_message_proxy_main_net,
    joAccount_main_net,
    chain_id_s_chain
) {
    const strLogPrefix = cc.note( "RegChk S on M:" ) + " ";
    if( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( strLogPrefix + cc.bright( "check_is_registered_s_chain_on_main_net(reg-step1A)" ) + "\n" );
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let strActionName = "";
    try {
        log.write( cc.info( "Main-net " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) + cc.bright( jo_message_proxy_main_net.options.address ) + "\n" );
        log.write( cc.info( "S-Chain  " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) + cc.bright( chain_id_s_chain ) + "\n" );
        strActionName = "check_is_registered_s_chain_on_main_net(reg-step1A)";
        const addressFrom = joAccount_main_net.address( w3_main_net );
        const bIsRegistered = await jo_message_proxy_main_net.methods.isConnectedChain( chain_id_s_chain ).call( {
            from: addressFrom
        } );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "check_is_registered_s_chain_on_main_net(reg-step1A) status is: " ) + cc.attention( bIsRegistered ) + "\n" );
        return bIsRegistered;
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in check_is_registered_s_chain_on_main_net(reg-step1A)() during " + strActionName + ": " ) + cc.error( err ) + "\n" );
    }
    return false;
}

async function register_s_chain_on_main_net( // step 1A
    w3_main_net,
    jo_message_proxy_main_net,
    joAccount_main_net,
    chain_id_s_chain,
    cid_main_net,
    tc_main_net
) {
    const jarrReceipts = []; // register_s_chain_on_main_net
    const strLogPrefix = cc.sunny( "Reg S on M:" ) + " ";
    if( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( strLogPrefix + cc.bright( "register_s_chain_on_main_net" ) + "\n" );
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let strActionName = "";
    try {
        log.write( cc.info( "Main-net " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) + cc.bright( jo_message_proxy_main_net.options.address ) + "\n" );
        log.write( cc.info( "Main-net " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) + cc.bright( cid_main_net ) + "\n" );
        log.write( cc.info( "S-Chain  " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) + cc.bright( chain_id_s_chain ) + "\n" );
        strActionName = "reg-step1A:w3_main_net.eth.getTransactionCount()";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await w3_main_net.eth.getTransactionCount( joAccount_main_net.address( w3_main_net ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        //
        // based on:
        // https://ethereum.stackexchange.com/questions/47426/call-contract-function-signed-on-client-side-web3-js-1-0
        // https://ethereum.stackexchange.com/questions/25839/how-to-make-transactions-using-private-key-in-web3
        const methodWithArguments = jo_message_proxy_main_net.methods.addConnectedChain(
            chain_id_s_chain, [ 0, 0, 0, 0 ] // call params
        );
        const isIgnore = false;
        const strDRC = "register_s_chain_on_main_net, step 1A, addConnectedChain";
        await dry_run_call( w3_main_net, methodWithArguments, joAccount_main_net, strDRC, isIgnore );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 10000000000 );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const tx = compose_tx_instance( strLogPrefix, {
            chainId: cid_main_net,
            nonce: tcnt,
            gasPrice: gasPrice,
            gasLimit: 3000000,
            // gas: 8000000, // gas is optional here
            to: jo_message_proxy_main_net.options.address, // contract address
            data: dataTx
        } );
        const key = Buffer.from( joAccount_main_net.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        const serializedTx = tx.serialize();
        strActionName = "reg-step1A:w3_main_net.eth.sendSignedTransaction()";
        // let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        const joReceipt = await safe_send_signed_transaction( w3_main_net, serializedTx, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "register_s_chain_on_main_net",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in register_s_chain_on_main_net() during " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return null;
    }
    return jarrReceipts;
} // async function register_s_chain(...

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// register main net 1B on S-Chain
//

async function check_is_registered_main_net_on_s_chain( // step 1B
    w3_s_chain,
    jo_message_proxy_s_chain,
    joAccount_s_chain,
    chain_id_main_net
) {
    const strLogPrefix = cc.note( "RegChk M on S:" ) + " ";
    if( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( strLogPrefix + cc.bright( "check_is_registered_main_net_on_s_chain(reg-step1B)" ) + "\n" );
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let strActionName = "";
    try {
        log.write( cc.info( "S-Chain  " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) + cc.bright( jo_message_proxy_s_chain.options.address ) + "\n" );
        log.write( cc.info( "Main-net " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) + cc.bright( chain_id_main_net ) + "\n" );
        strActionName = "check_is_registered_main_net_on_s_chain(reg-step1B)";
        const addressFrom = joAccount_s_chain.address( w3_s_chain );
        const bIsRegistered = await jo_message_proxy_s_chain.methods.isConnectedChain( chain_id_main_net ).call( {
            from: addressFrom
        } );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "check_is_registered_main_net_on_s_chain(reg-step1B) status is: " ) + cc.attention( bIsRegistered ) + "\n" );
        return bIsRegistered;
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in check_is_registered_main_net_on_s_chain(reg-step1B)() during " + strActionName + ": " ) + cc.error( err ) + "\n" );
    }
    return null;
}

async function register_main_net_on_s_chain( // step 1B
    w3_s_chain,
    jo_message_proxy_s_chain,
    joAccount_s_chain,
    chain_id_main_net,
    cid_s_chain,
    tc_s_chain
) {
    const jarrReceipts = []; // register_main_net_on_s_chain
    const strLogPrefix = cc.sunny( "Reg M on S:" ) + " ";
    if( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( strLogPrefix + cc.bright( "register_main_net_on_s_chain" ) + "\n" );
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let strActionName = "";
    try {
        log.write( cc.info( "S-Chain  " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) + cc.bright( jo_message_proxy_s_chain.options.address ) + "\n" );
        log.write( cc.info( "S-Chain  " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) + cc.bright( cid_s_chain ) + "\n" );
        log.write( cc.info( "Main-net " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) + cc.bright( chain_id_main_net ) + "\n" );
        strActionName = "reg-step1B:w3_s_chain.eth.getTransactionCount()";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await w3_s_chain.eth.getTransactionCount( joAccount_s_chain.address( w3_s_chain ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        //
        // based on:
        // https://ethereum.stackexchange.com/questions/47426/call-contract-function-signed-on-client-side-web3-js-1-0
        // https://ethereum.stackexchange.com/questions/25839/how-to-make-transactions-using-private-key-in-web3
        const methodWithArguments = jo_message_proxy_s_chain.methods.addConnectedChain(
            chain_id_main_net, [ 0, 0, 0, 0 ] // call params
        );
        const isIgnore = false;
        const strDRC = "register_main_net_on_s_chain, step 1B, addConnectedChain";
        await dry_run_call( w3_s_chain, methodWithArguments, joAccount_s_chain, strDRC, isIgnore );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 10000000000 );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const tx = compose_tx_instance( strLogPrefix, {
            chainId: cid_s_chain,
            nonce: tcnt,
            gasPrice: gasPrice,
            gasLimit: 3000000,
            // gas: 8000000, // gas is optional here
            to: jo_message_proxy_s_chain.options.address, // contract address
            data: dataTx
        } );
        const key = Buffer.from( joAccount_s_chain.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        const serializedTx = tx.serialize();
        strActionName = "reg-step1B:w3_s_chain.eth.sendSignedTransaction()";
        // let joReceipt = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        const joReceipt = await safe_send_signed_transaction( w3_s_chain, serializedTx, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "register_main_net_on_s_chain",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in register_main_net_on_s_chain() during " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return null;
    }
    return jarrReceipts;
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
    log.write( cc.info( "Main-net " ) + cc.sunny( "LockAndData" ) + cc.info( "  address is....." ) + cc.bright( jo_lock_and_data_main_net.options.address ) + "\n" );
    log.write( cc.info( "S-Chain  " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) + cc.bright( chain_id_s_chain ) + "\n" );
    const strLogPrefix = cc.note( "RegChk S in depositBox:" ) + " ";
    if( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( strLogPrefix + cc.bright( "check_is_registered_s_chain_in_deposit_box(reg-step2)" ) + "\n" );
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let strActionName = "";
    try {
        strActionName = "check_is_registered_s_chain_in_deposit_box(reg-step2)";
        const addressFrom = joAccount_main_net.address( w3_main_net );
        const bIsRegistered = await jo_lock_and_data_main_net.methods.hasSchain( chain_id_s_chain ).call( {
            from: addressFrom
        } );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "check_is_registered_s_chain_in_deposit_box(reg-step2) status is: " ) + cc.attention( bIsRegistered ) + "\n" );
        return bIsRegistered;
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in check_is_registered_s_chain_in_deposit_box(reg-step2)() during " + strActionName + ": " ) + cc.error( err ) + "\n" );
    }
    return false;
}

async function register_s_chain_in_deposit_box( // step 2
    w3_main_net,
    // jo_deposit_box, // only main net
    jo_lock_and_data_main_net,
    joAccount_main_net,
    jo_token_manager, // only s-chain
    chain_id_s_chain,
    cid_main_net,
    tc_main_net
) {
    const jarrReceipts = []; // register_s_chain_in_deposit_box
    log.write( cc.info( "Main-net " ) + cc.sunny( "LockAndData" ) + cc.info( "  address is....." ) + cc.bright( jo_lock_and_data_main_net.options.address ) + "\n" );
    log.write( cc.info( "S-Chain  " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) + cc.bright( chain_id_s_chain ) + "\n" );
    const strLogPrefix = cc.sunny( "Reg S in depositBox:" ) + " ";
    if( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( strLogPrefix + cc.bright( "reg-step2:register_s_chain_in_deposit_box" ) + "\n" );
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let strActionName = "";
    try {
        strActionName = "reg-step2:w3_main_net.eth.getTransactionCount()";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await w3_main_net.eth.getTransactionCount( joAccount_main_net.address( w3_main_net ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        //
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will register S-Chain in lock_and_data on Main-net" ) + "\n" );
        const methodWithArguments = jo_lock_and_data_main_net.methods.addSchain(
            chain_id_s_chain, jo_token_manager.options.address // call params
        );
        const isIgnore = false;
        const strDRC = "register_s_chain_in_deposit_box, step 2, addSchain";
        await dry_run_call( w3_main_net, methodWithArguments, joAccount_main_net, strDRC, isIgnore );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 10000000000 );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const tx = compose_tx_instance( strLogPrefix, {
            chainId: cid_main_net,
            nonce: tcnt,
            gasPrice: gasPrice,
            gasLimit: 3000000,
            // gas: 8000000, // gas is optional here
            to: jo_lock_and_data_main_net.options.address, // contract address
            data: dataTx
        } );
        const key = Buffer.from( joAccount_main_net.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        const serializedTx = tx.serialize();
        strActionName = "reg-step2:w3_main_net.eth.sendSignedTransaction()";
        // let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        const joReceipt = await safe_send_signed_transaction( w3_main_net, serializedTx, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "register_s_chain_in_deposit_box",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in register_s_chain_in_deposit_box() during " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return null;
    }
    return jarrReceipts;
} // async function register_deposit_box_on_s_chain(...

async function check_is_registered_main_net_depositBox_on_s_chain( // step 3
    w3_s_chain,
    jo_lock_and_data_s_chain,
    joAccount
) {
    log.write( cc.info( "S-Chain  " ) + cc.sunny( "LockAndData" ) + cc.info( "  address is....." ) + cc.bright( jo_lock_and_data_s_chain.options.address ) + "\n" );
    const strLogPrefix = cc.note( "RegChk MS depositBox on S:" ) + " ";
    if( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( strLogPrefix + cc.bright( "check_is_registered_main_net_depositBox_on_s_chain(reg-step3)" ) + "\n" );
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let strActionName = "";
    try {
        strActionName = "check_is_registered_main_net_depositBox_on_s_chain(reg-step3)";
        const addressFrom = joAccount.address( w3_s_chain );
        const bIsRegistered = await jo_lock_and_data_s_chain.methods.hasDepositBox().call( {
            from: addressFrom
        } );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "check_is_registered_main_net_depositBox_on_s_chain(reg-step3) status is: " ) + cc.attention( bIsRegistered ) + "\n" );
        return bIsRegistered;
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( "Error in check_is_registered_main_net_depositBox_on_s_chain(reg-step3)() during " + strActionName + ": " ) + cc.error( err ) + "\n" );
    }
    return false;
}

async function register_main_net_depositBox_on_s_chain( // step 3
    w3_s_chain,
    // excluded here: jo_token_manager,
    jo_deposit_box_main_net,
    jo_lock_and_data_s_chain,
    joAccount,
    cid_s_chain,
    tc_s_chain
) {
    const jarrReceipts = []; // register_main_net_depositBox_on_s_chain
    log.write( cc.info( "S-Chain  " ) + cc.sunny( "LockAndData" ) + cc.info( "  address is....." ) + cc.bright( jo_lock_and_data_s_chain.options.address ) + "\n" );
    log.write( cc.info( "S-Chain  " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) + cc.bright( cid_s_chain ) + "\n" );
    const strLogPrefix = cc.sunny( "Reg MS depositBox on S:" ) + " ";
    if( verbose_get() >= RV_VERBOSE.debug ) {
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
        log.write( strLogPrefix + cc.bright( "register_main_net_depositBox_on_s_chain" ) + "\n" );
        log.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    }
    let strActionName = "";
    try {
        strActionName = "reg-step3:w3_s_chain.eth.getTransactionCount()/register_main_net_depositBox_on_s_chain";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await w3_s_chain.eth.getTransactionCount( joAccount.address( w3_s_chain ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        const methodWithArguments = jo_lock_and_data_s_chain.methods.addDepositBox(
            jo_deposit_box_main_net.options.address // call params
        );
        const isIgnore = false;
        const strDRC = "register_main_net_depositBox_on_s_chain, step 3, addDepositBox";
        await dry_run_call( w3_s_chain, methodWithArguments, joAccount, strDRC, isIgnore );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 10000000000 );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const tx = compose_tx_instance( strLogPrefix, {
            chainId: cid_s_chain,
            nonce: tcnt,
            gasPrice: gasPrice,
            gasLimit: 3000000,
            // gas: 8000000, // gas is optional here
            to: jo_lock_and_data_s_chain.options.address, // contract address
            data: dataTx
        } );
        const key = Buffer.from( joAccount.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        const serializedTx = tx.serialize();
        strActionName = "reg-step3:w3_s_chain.eth.sendSignedTransaction()";
        // let joReceipt = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        const joReceipt = await safe_send_signed_transaction( w3_s_chain, serializedTx, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "register_main_net_depositBox_on_s_chain",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in register_main_net_depositBox_on_s_chain() during " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return null;
    }
    return jarrReceipts;
}

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
    cid_main_net,
    joAccountSrc,
    joAccountDst,
    jo_deposit_box,
    jo_message_proxy_main_net, // for checking logs
    jo_lock_and_data_main_net, // for checking logs
    chain_id_s_chain,
    wei_how_much, // how much WEI money to send
    tc_main_net
) {
    const jarrReceipts = []; // do_eth_payment_from_main_net
    let strActionName = ""; const strLogPrefix = cc.info( "M2S ETH Payment:" ) + " ";
    try {
        log.write( strLogPrefix + cc.debug( "Doing payment from mainnet with " ) + cc.notice( "chain_id_s_chain" ) + cc.debug( "=" ) + cc.notice( chain_id_s_chain ) + cc.debug( "..." ) + "\n" );
        //
        strActionName = "w3_main_net.eth.getTransactionCount()";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await w3_main_net.eth.getTransactionCount( joAccountSrc.address( w3_main_net ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        const methodWithArguments = jo_deposit_box.methods.deposit(
            // call params, last is destination account on S-chain
            chain_id_s_chain, joAccountDst.address( w3_main_net ), w3_main_net.utils.fromAscii( "" ) // TO-DO: string is "data" parameter, we need to allow user to specify it
        );
        const isIgnore = true;
        const strDRC = "do_eth_payment_from_main_net, deposit";
        await dry_run_call( w3_main_net, methodWithArguments, joAccountSrc, strDRC, isIgnore );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 10000000000 );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const tx = compose_tx_instance( strLogPrefix, {
            chainId: cid_main_net,
            nonce: tcnt,
            gasPrice: gasPrice,
            gasLimit: 3000000,
            gas: 3000000, // 2100000
            to: jo_deposit_box.options.address, // contract address
            data: dataTx,
            value: wei_how_much // how much money to send
        } );
        const key = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        const serializedTx = tx.serialize();
        strActionName = "w3_main_net.eth.sendSignedTransaction()";
        // let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        const joReceipt = await safe_send_signed_transaction( w3_main_net, serializedTx, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "do_eth_payment_from_main_net",
                "receipt": joReceipt
            } );
        }
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_main_net ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.debug( " contract ..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_message_proxy_main_net, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_main_net.options.address + " contract, no events found" );
        } // if( jo_message_proxy_main_net )
        if( jo_lock_and_data_main_net ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "MoneyReceived" ) + cc.debug( " event of the " ) + cc.info( "LockAndDataForMainnet" ) + cc.debug( "/" ) + cc.notice( jo_lock_and_data_main_net.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_lock_and_data_main_net, "MoneyReceived", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "MoneyReceived" ) + cc.success( " event of the " ) + cc.info( "LockAndDataForMainnet" ) + cc.success( "/" ) + cc.notice( jo_lock_and_data_main_net.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else
                throw new Error( "Verification failed for the \"MoneyReceived\" event of the \"LockAndDataForMainnet\"/" + jo_lock_and_data_main_net.options.address + " contract, no events found" );
        } // if( jo_lock_and_data_main_net )
        //
        // Must-absent event(s) analysis as indicator(s) of success
        //
        if( jo_lock_and_data_main_net ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "LockAndDataForMainnet" ) + cc.debug( "/" ) + cc.notice( jo_lock_and_data_main_net.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_lock_and_data_main_net, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length == 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "LockAndDataForMainnet" ) + cc.success( "/" ) + cc.notice( jo_lock_and_data_main_net.options.address ) + cc.success( " contract, no event found" ) + "\n" );
            } else {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error verification fail" ) + cc.error( " for the " ) + cc.warning( "Error" ) + cc.error( " event of the " ) + cc.warning( "LockAndDataForMainnet" ) + cc.success( "/" ) + cc.notice( jo_lock_and_data_main_net.options.address ) + cc.error( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
                throw new Error( "Verification failed for the \"Error\" event of the \"LockAndDataForMainnet\"/" + jo_lock_and_data_main_net.options.address + " contract, no events found" );
            }
        } // if( jo_lock_and_data_main_net )
        if( jo_deposit_box ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "DepositBox" ) + cc.debug( "/" ) + cc.notice( jo_deposit_box.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_deposit_box, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length == 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box.options.address ) + cc.success( " contract, no event found" ) + "\n" );
            } else {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error verification fail" ) + cc.error( " for the " ) + cc.warning( "Error" ) + cc.error( " event of the " ) + cc.warning( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box.options.address ) + cc.error( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
                throw new Error( "Verification failed for the \"Error\" event of the \"DepositBox\"/" + jo_deposit_box.options.address + " contract, no events found" );
            }
        } // if( jo_deposit_box )
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return false;
    }
    print_gas_usage_report_from_array( "ETH PAYMENT FROM MAIN NET", jarrReceipts );
    return true;
} // async function do_eth_payment_from_main_net(...

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
    cid_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_token_manager,
    jo_message_proxy_s_chain, // for checking logs
    wei_how_much, // how much WEI money to send
    tc_s_chain
) {
    const jarrReceipts = []; // do_eth_payment_from_s_chain
    let strActionName = ""; const strLogPrefix = cc.info( "S2M ETH Payment:" ) + " ";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_eth_payment_from_s_chain";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await w3_s_chain.eth.getTransactionCount( joAccountSrc.address( w3_s_chain ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "jo_token_manager.methods.exitToMain()/do_eth_payment_from_s_chain";
        const methodWithArguments = jo_token_manager.methods.exitToMain(
            // call params, last is destination account on S-chain
            joAccountDst.address( w3_s_chain ),
            "0x" + w3_s_chain.utils.toBN( wei_how_much ).toString( 16 ),
            "0x" // w3_s_chain.utils.fromAscii( "" ) // TO-DO: string is "data" parameter, we need to allow user to specify it
        );
        const isIgnore = true;
        const strDRC = "do_eth_payment_from_s_chain, exitToMain";
        await dry_run_call( w3_s_chain, methodWithArguments, joAccountSrc, strDRC, isIgnore );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 10000000000 );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const tx = compose_tx_instance( strLogPrefix, {
            chainId: cid_s_chain,
            nonce: tcnt,
            gasPrice: gasPrice,
            // "gasLimit": 3000000,
            gas: 6000000, // 2100000
            to: jo_token_manager.options.address, // contract address
            data: dataTx,
            value: 0 // how much money to send
        } );
        const key = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        const serializedTx = tx.serialize();
        strActionName = "w3_s_chain.eth.sendSignedTransaction()";
        // let joReceipt = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        const joReceipt = await safe_send_signed_transaction( w3_s_chain, serializedTx, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "do_eth_payment_from_s_chain",
                "receipt": joReceipt
            } );
        }
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_s_chain ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.debug( " contract ..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_message_proxy_s_chain, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_s_chain.options.address + " contract, no events found" );
        } // if( jo_message_proxy_s_chain )
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return false;
    }
    print_gas_usage_report_from_array( "ETH PAYMENT FROM S-CHAIN", jarrReceipts );
    return true;
} // async function do_eth_payment_from_s_chain(...

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
async function receive_eth_payment_from_s_chain_on_main_net(
    w3_main_net,
    cid_main_net,
    joAccount_main_net,
    jo_lock_and_data_main_net,
    tc_main_net
) {
    const jarrReceipts = []; // receive_eth_payment_from_s_chain_on_main_net
    let strActionName = ""; const strLogPrefix = cc.info( "M2S ETH Receive:" ) + " ";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/receive_eth_payment_from_s_chain_on_main_net";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await w3_main_net.eth.getTransactionCount( joAccount_main_net.address( w3_main_net ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        const methodWithArguments = jo_lock_and_data_main_net.methods.getMyEth(
            // call params(empty)
        );
        const isIgnore = false;
        const strDRC = "receive_eth_payment_from_s_chain_on_main_net, getMyEth";
        await dry_run_call( w3_main_net, methodWithArguments, joAccount_main_net, strDRC, isIgnore );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 10000000000 );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const tx = compose_tx_instance( strLogPrefix, {
            chainId: cid_main_net,
            nonce: tcnt,
            gas: 2100000,
            gasPrice: gasPrice,
            gasLimit: 3000000,
            to: jo_lock_and_data_main_net.options.address, // contract address
            data: dataTx,
            value: 0 // how much money to send
        } );
        const key = Buffer.from( joAccount_main_net.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
        const serializedTx = tx.serialize();
        strActionName = "w3_main_net.eth.sendSignedTransaction()";
        // let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
        const joReceipt = await safe_send_signed_transaction( w3_main_net, serializedTx, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "receive_eth_payment_from_s_chain_on_main_net",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Receive payment error in " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return false;
    }
    print_gas_usage_report_from_array( "RECEIVE ETH ON MAIN NET", jarrReceipts );
    return true;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function view_eth_payment_from_s_chain_on_main_net(
    w3_main_net,
    joAccount_main_net,
    jo_lock_and_data_main_net
) {
    let strActionName = ""; const strLogPrefix = cc.info( "S ETH View:" ) + " ";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/view_eth_payment_from_s_chain_on_main_net";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await w3_main_net.eth.getTransactionCount( joAccount_main_net.address( w3_main_net ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        const addressFrom = joAccount_main_net.address( w3_main_net );
        const xWei = await jo_lock_and_data_main_net.methods.approveTransfers( addressFrom ).call( {
            from: addressFrom
        } );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "You can receive(wei): " ) + cc.attention( xWei ) + "\n" );
        const xEth = w3_main_net.utils.fromWei( xWei, "ether" );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "You can receive(eth): " ) + cc.attention( xEth ) + "\n" );
        return xWei;
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " View payment error in " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return null;
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function do_erc721_payment_from_main_net(
    w3_main_net,
    w3_s_chain,
    cid_main_net,
    cid_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_deposit_box,
    jo_message_proxy_main_net, // for checking logs
    jo_lock_and_data_main_net, // for checking logs
    chain_id_s_chain,
    token_id, // which ERC721 token id to send
    jo_token_manager, // only s-chain
    strCoinNameErc721_main_net,
    erc721PrivateTestnetJson_main_net,
    strCoinNameErc721_s_chain,
    erc721PrivateTestnetJson_s_chain,
    isRawTokenTransfer,
    tc_main_net
) {
    const jarrReceipts = []; // do_erc721_payment_from_main_net
    let strActionName = ""; const strLogPrefix = cc.info( "M2S ERC721 Payment:" ) + " ";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/do_erc721_payment_from_main_net";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccountSrc.address( w3_main_net ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "ERC721 prepare M->S";
        const erc721ABI = erc721PrivateTestnetJson_main_net[strCoinNameErc721_main_net + "_abi"];
        const erc721Address_main_net = erc721PrivateTestnetJson_main_net[strCoinNameErc721_main_net + "_address"];
        const contractERC721 = new w3_main_net.eth.Contract( erc721ABI, erc721Address_main_net );
        // prepare the smart contract function deposit(string schainID, address to)
        const depositBoxAddress = jo_deposit_box.options.address;
        const accountForSchain = joAccountDst.address( w3_s_chain );
        const methodWithArguments_approve = contractERC721.methods.transferFrom( // same as approve in 20
            joAccountSrc.address( w3_main_net ), depositBoxAddress, "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 )
        );
        const dataTxApprove = methodWithArguments_approve.encodeABI();
        const isIgnore_approve = false;
        const strDRC_approve = "do_erc721_payment_from_main_net, transferFrom";
        await dry_run_call( w3_main_net, methodWithArguments_approve, joAccountSrc, strDRC_approve, isIgnore_approve );
        let dataTxDeposit = null;
        if( isRawTokenTransfer ) {
            const erc721Address_s_chain = erc721PrivateTestnetJson_s_chain[strCoinNameErc721_s_chain + "_address"];
            const methodWithArguments_rawDepositERC721 = jo_deposit_box.methods.rawDepositERC721(
                chain_id_s_chain, erc721Address_main_net, erc721Address_s_chain // specific for rawDepositERC721() only
                , accountForSchain, "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 )
            );
            const isIgnore_rawDepositERC721 = true;
            const strDRC_rawDepositERC721 = "do_erc721_payment_from_main_net, rawDepositERC721";
            await dry_run_call( w3_main_net, methodWithArguments_rawDepositERC721, joAccountSrc, strDRC_rawDepositERC721, isIgnore_rawDepositERC721 );
            dataTxDeposit = methodWithArguments_rawDepositERC721.encodeABI();
        } else {
            // TO-DO: this is beta version, need to re-check and improve it later
            const methodWithArguments_depositERC721 = jo_deposit_box.methods.depositERC721(
                chain_id_s_chain, erc721Address_main_net, accountForSchain, "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 )
            );
            const isIgnore_depositERC721 = true;
            const strDRC_depositERC721 = "do_erc721_payment_from_main_net, depositERC721";
            await dry_run_call( w3_main_net, methodWithArguments_depositERC721, joAccountSrc, strDRC_depositERC721, isIgnore_depositERC721 );
            dataTxDeposit = methodWithArguments_depositERC721.encodeABI();
        }
        //
        //
        // create raw transactions
        //
        strActionName = "create raw transactions M->S";
        //
        const gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 0 );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const txApprove = compose_tx_instance( strLogPrefix, {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ), // accountForMainnet
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxApprove,
            to: erc721Address_main_net,
            gasPrice: gasPrice, // 0
            gas: 8000000
        } );
        tcnt += 1;
        const txDeposit = compose_tx_instance( strLogPrefix, {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ), // accountForMainnet
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxDeposit,
            to: depositBoxAddress,
            gasPrice: gasPrice, // 0
            gas: 8000000,
            value: 2000000000000000 // w3_dst.utils.toWei( (1).toString(), "ether" )
        } );
        //
        //
        // sign transactions
        //
        strActionName = "sign transactions M->S";
        const privateKeyForMainnet = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        txApprove.sign( privateKeyForMainnet );
        txDeposit.sign( privateKeyForMainnet );
        const serializedTxApprove = txApprove.serialize();
        const serializedTxDeposit = txDeposit.serialize();
        //
        //
        // send transactions
        //
        strActionName = "w3_main_net.eth.sendSignedTransaction()/Approve";
        // let joReceiptApprove = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
        const joReceiptApprove = await safe_send_signed_transaction( w3_main_net, serializedTxApprove, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        if( joReceiptApprove && typeof joReceiptApprove == "object" && "gasUsed" in joReceiptApprove ) {
            jarrReceipts.push( {
                "description": "do_erc721_payment_from_main_net/approve",
                "receipt": joReceiptApprove
            } );
        }
        log.write( cc.normal( "Will send ERC721 signed transaction from " ) + cc.warning( joAccountSrc.address( w3_main_net ) ) + "\n" );
        strActionName = "w3_main_net.eth.sendSignedTransaction()/Deposit";
        // let joReceiptDeposit = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString( "hex" ) );
        const joReceiptDeposit = await safe_send_signed_transaction( w3_main_net, serializedTxDeposit, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt for Deposit: " ) + cc.j( joReceiptDeposit ) + "\n" );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" && "gasUsed" in joReceiptDeposit ) {
            jarrReceipts.push( {
                "description": "do_erc721_payment_from_main_net/deposit",
                "receipt": joReceiptDeposit
            } );
        }
        //
        //

        // TO-DO: Fix event getting
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
        //         log.write( strLogPrefix + cc.success( "Got events for ERC721TokenCreated: " ) + cc.j( joEvents ) + "\n" );
        // } // if( ! isRawTokenTransfer )

        const joReceipt = joReceiptDeposit;
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_main_net ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.debug( " contract ..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_message_proxy_main_net, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_main_net.options.address + " contract, no events found" );
        } // if( jo_message_proxy_main_net )
        //
        // Must-absent event(s) analysis as indicator(s) of success
        //
        if( jo_lock_and_data_main_net ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "LockAndDataForMainnet" ) + cc.debug( "/" ) + cc.notice( jo_lock_and_data_main_net.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_lock_and_data_main_net, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length == 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "LockAndDataForMainnet" ) + cc.success( "/" ) + cc.notice( jo_lock_and_data_main_net.options.address ) + cc.success( " contract, no event found" ) + "\n" );
            } else {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error verification fail" ) + cc.error( " for the " ) + cc.warning( "Error" ) + cc.error( " event of the " ) + cc.warning( "LockAndDataForMainnet" ) + cc.success( "/" ) + cc.notice( jo_lock_and_data_main_net.options.address ) + cc.error( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
                throw new Error( "Verification failed for the \"Error\" event of the \"LockAndDataForMainnet\"/" + jo_lock_and_data_main_net.options.address + " contract, no events found" );
            }
        } // if( jo_lock_and_data_main_net )
        if( jo_deposit_box ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "DepositBox" ) + cc.debug( "/" ) + cc.notice( jo_deposit_box.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_deposit_box, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length == 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box.options.address ) + cc.success( " contract, no event found" ) + "\n" );
            } else {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error verification fail" ) + cc.error( " for the " ) + cc.warning( "Error" ) + cc.error( " event of the " ) + cc.warning( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box.options.address ) + cc.error( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
                throw new Error( "Verification failed for the \"Error\" event of the \"DepositBox\"/" + jo_deposit_box.options.address + " contract, no events found" );
            }
        } // if( jo_deposit_box )
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return false;
    }
    print_gas_usage_report_from_array( "ERC-721 PAYMENT FROM MAIN NET", jarrReceipts );
    return true;
} // async function do_erc721_payment_from_main_net(...

//
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
async function do_erc20_payment_from_main_net(
    w3_main_net,
    w3_s_chain,
    cid_main_net,
    cid_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_deposit_box,
    jo_message_proxy_main_net, // for checking logs
    jo_lock_and_data_main_net, // for checking logs
    chain_id_s_chain,
    token_amount, // how much ERC20 tokens to send
    jo_token_manager, // only s-chain
    strCoinNameErc20_main_net,
    erc20PrivateTestnetJson_main_net,
    strCoinNameErc20_s_chain,
    erc20PrivateTestnetJson_s_chain,
    isRawTokenTransfer,
    tc_main_net
) {
    const jarrReceipts = []; // do_erc20_payment_from_main_net
    let strActionName = ""; const strLogPrefix = cc.info( "M2S ERC20 Payment:" ) + " ";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/do_erc20_payment_from_main_net";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await w3_main_net.eth.getTransactionCount( joAccountSrc.address( w3_main_net ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "ERC20 prepare M->S";
        const erc20ABI = erc20PrivateTestnetJson_main_net[strCoinNameErc20_main_net + "_abi"];
        // log.write( strLogPrefix + cc.normal("erc20PrivateTestnetJson_main_net = ") + cc.j(erc20PrivateTestnetJson_main_net) + "\n" )
        // log.write( strLogPrefix + cc.normal("strCoinNameErc20_main_net = ") + cc.info(strCoinNameErc20_main_net) + "\n" )
        const erc20Address_main_net = erc20PrivateTestnetJson_main_net[strCoinNameErc20_main_net + "_address"];
        // log.write( strLogPrefix + cc.normal("erc20Address_main_net = ") + cc.info(erc20Address_main_net) + "\n" )
        const contractERC20 = new w3_main_net.eth.Contract( erc20ABI, erc20Address_main_net );
        // prepare the smart contract function deposit(string schainID, address to)
        const depositBoxAddress = jo_deposit_box.options.address;
        const accountForSchain = joAccountDst.address( w3_s_chain );
        const methodWithArguments_approve = contractERC20.methods.approve(
            depositBoxAddress, "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
        );
        const isIgnore_approve = false;
        const strDRC_approve = "do_erc20_payment_from_main_net, ";
        await dry_run_call( w3_main_net, methodWithArguments_approve, joAccountSrc, strDRC_approve, isIgnore_approve );
        const dataTxApprove = methodWithArguments_approve.encodeABI();
        let dataTxDeposit = null;
        log.write( strLogPrefix + cc.normal( "isRawTokenTransfer = " ) + cc.info( isRawTokenTransfer ) + "\n" );
        if( isRawTokenTransfer ) {
            const erc20Address_s_chain = erc20PrivateTestnetJson_s_chain[strCoinNameErc20_s_chain + "_address"];
            const methodWithArguments_rawDepositERC20 = jo_deposit_box.methods.rawDepositERC20(
                chain_id_s_chain, erc20Address_main_net, erc20Address_s_chain // specific for rawDepositERC20() only
                , accountForSchain, "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
            );
            const isIgnore_rawDepositERC20 = true;
            const strDRC_rawDepositERC20 = "do_erc20_payment_from_main_net, ";
            await dry_run_call( w3_main_net, methodWithArguments_rawDepositERC20, joAccountSrc, strDRC_rawDepositERC20, isIgnore_rawDepositERC20 );
            dataTxDeposit = methodWithArguments_rawDepositERC20.encodeABI();
        } else {
            // TO-DO: this is beta version, need to re-check and improve it later
            const methodWithArguments_depositERC20 = jo_deposit_box.methods.depositERC20(
                chain_id_s_chain, erc20Address_main_net, accountForSchain, "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
            );
            const isIgnore_depositERC20 = true;
            const strDRC_depositERC20 = "do_erc20_payment_from_main_net, ";
            await dry_run_call( w3_main_net, methodWithArguments_depositERC20, joAccountSrc, strDRC_depositERC20, isIgnore_depositERC20 );
            dataTxDeposit = methodWithArguments_depositERC20.encodeABI();
        }
        //
        // create raw transactions
        //
        strActionName = "create raw transactions M->S";
        //
        const gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 0 );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const txApprove = compose_tx_instance( strLogPrefix, {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ), // accountForMainnet
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxApprove,
            to: erc20Address_main_net,
            gasPrice: gasPrice, // 0
            gas: 8000000
        } );
        tcnt += 1;
        const txDeposit = compose_tx_instance( strLogPrefix, {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ), // accountForMainnet
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxDeposit,
            to: depositBoxAddress,
            gasPrice: gasPrice, // 0
            gas: 8000000
        } );
        //
        // sign transactions
        //
        strActionName = "sign transactions M->S";
        const privateKeyForMainnet = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        txApprove.sign( privateKeyForMainnet );
        txDeposit.sign( privateKeyForMainnet );
        const serializedTxApprove = txApprove.serialize();
        const serializedTxDeposit = txDeposit.serialize();
        //
        //
        // send transactions
        //
        strActionName = "w3_main_net.eth.sendSignedTransaction()/Approve";
        // let joReceiptApprove = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
        const joReceiptApprove = await safe_send_signed_transaction( w3_main_net, serializedTxApprove, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        if( joReceiptApprove && typeof joReceiptApprove == "object" && "gasUsed" in joReceiptApprove ) {
            jarrReceipts.push( {
                "description": "do_erc20_payment_from_main_net/approve",
                "receipt": joReceiptApprove
            } );
        }
        strActionName = "w3_main_net.eth.sendSignedTransaction()/Deposit";
        // let joReceiptDeposit = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString( "hex" ) );
        const joReceiptDeposit = await safe_send_signed_transaction( w3_main_net, serializedTxDeposit, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt for Deposit: " ) + cc.j( joReceiptDeposit ) + "\n" );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" && "gasUsed" in joReceiptDeposit ) {
            jarrReceipts.push( {
                "description": "do_erc20_payment_from_main_net/deposit",
                "receipt": joReceiptDeposit
            } );
        }
        //
        //

        // TO-DO: Fix event getting
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
        //         log.write( strLogPrefix + cc.success( "Got events for ERC20TokenCreated: " ) + cc.j( joEvents ) + "\n" );
        // } // if( ! isRawTokenTransfer )

        const joReceipt = joReceiptDeposit;
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_main_net ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.debug( " contract ..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_message_proxy_main_net, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_main_net.options.address + " contract, no events found" );
        } // if( jo_message_proxy_main_net )
        //
        // Must-absent event(s) analysis as indicator(s) of success
        //
        if( jo_lock_and_data_main_net ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "LockAndDataForMainnet" ) + cc.debug( "/" ) + cc.notice( jo_lock_and_data_main_net.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_lock_and_data_main_net, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length == 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "LockAndDataForMainnet" ) + cc.success( "/" ) + cc.notice( jo_lock_and_data_main_net.options.address ) + cc.success( " contract, no event found" ) + "\n" );
            } else {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error verification fail" ) + cc.error( " for the " ) + cc.warning( "Error" ) + cc.error( " event of the " ) + cc.warning( "LockAndDataForMainnet" ) + cc.success( "/" ) + cc.notice( jo_lock_and_data_main_net.options.address ) + cc.error( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
                throw new Error( "Verification failed for the \"Error\" event of the \"LockAndDataForMainnet\"/" + jo_lock_and_data_main_net.options.address + " contract, no events found" );
            }
        } // if( jo_lock_and_data_main_net )
        if( jo_deposit_box ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "DepositBox" ) + cc.debug( "/" ) + cc.notice( jo_deposit_box.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_deposit_box, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length == 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box.options.address ) + cc.success( " contract, no event found" ) + "\n" );
            } else {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error verification fail" ) + cc.error( " for the " ) + cc.warning( "Error" ) + cc.error( " event of the " ) + cc.warning( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box.options.address ) + cc.error( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
                throw new Error( "Verification failed for the \"Error\" event of the \"DepositBox\"/" + jo_deposit_box.options.address + " contract, no events found" );
            }
        } // if( jo_deposit_box )
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return false;
    }
    print_gas_usage_report_from_array( "ERC-20 PAYMENT FROM MAIN NET", jarrReceipts );
    return true;
} // async function do_erc20_payment_from_main_net(...

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function do_erc20_payment_from_s_chain(
    w3_main_net,
    w3_s_chain,
    cid_main_net,
    cid_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_token_manager, // only s-chain
    jo_message_proxy_s_chain, // for checking logs
    jo_deposit_box, // only main net
    token_amount, // how much ERC20 tokens to send
    strCoinNameErc20_main_net,
    joErc20_main_net,
    strCoinNameErc20_s_chain,
    joErc20_s_chain,
    isRawTokenTransfer,
    tc_s_chain
) {
    const jarrReceipts = []; // do_erc20_payment_from_s_chain
    let strActionName = ""; const strLogPrefix = cc.info( "S2M ERC20 Payment:" ) + " ";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_erc20_payment_from_s_chain";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        //
        //
        strActionName = "ERC20 prepare S->M";
        const accountForMainnet = joAccountDst.address( w3_main_net );
        const accountForSchain = joAccountSrc.address( w3_s_chain );
        const erc20ABI = joErc20_s_chain[strCoinNameErc20_s_chain + "_abi"];
        const erc20Address_s_chain = joErc20_s_chain[strCoinNameErc20_s_chain + "_address"];
        const tokenManagerAddress = jo_token_manager.options.address;
        const contractERC20 = new w3_s_chain.eth.Contract( erc20ABI, erc20Address_s_chain );
        //
        // prepare the smart contract function deposit(string schainID, address to)
        //
        // const depositBoxAddress = jo_deposit_box.options.address;
        const methodWithArguments_approve = contractERC20.methods.approve(
            tokenManagerAddress, "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
        );
        const isIgnore_approve = false;
        const strDRC_approve = "do_erc20_payment_from_s_chain, approve";
        await dry_run_call( w3_s_chain, methodWithArguments_approve, joAccountSrc, strDRC_approve, isIgnore_approve );
        const dataTxApprove = methodWithArguments_approve.encodeABI();
        let dataExitToMainERC20 = null;
        if( isRawTokenTransfer ) {
            const erc20Address_main_net = joErc20_main_net[strCoinNameErc20_main_net + "_address"];
            const methodWithArguments_rawExitToMainERC20 = jo_token_manager.methods.rawExitToMainERC20(
                erc20Address_s_chain, erc20Address_main_net // specific for rawExitToMainERC20() only
                , accountForMainnet, "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
            );
            const isIgnore_rawExitToMainERC20 = true;
            const strDRC_rawExitToMainERC20 = "do_erc20_payment_from_s_chain, rawExitToMainERC20";
            await dry_run_call( w3_s_chain, methodWithArguments_rawExitToMainERC20, joAccountSrc, strDRC_rawExitToMainERC20, isIgnore_rawExitToMainERC20 );
            dataExitToMainERC20 = methodWithArguments_rawExitToMainERC20.encodeABI();
        } else {
            // TO-DO: this is beta version, need to re-check and improve it later
            const methodWithArguments_exitToMainERC20 = jo_token_manager.methods.exitToMainERC20(
                erc20Address_s_chain, accountForMainnet, "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
            );
            const isIgnore_exitToMainERC20 = true;
            const strDRC_exitToMainERC20 = "do_erc20_payment_from_s_chain, exitToMainERC20";
            await dry_run_call( w3_s_chain, methodWithArguments_exitToMainERC20, joAccountSrc, strDRC_exitToMainERC20, isIgnore_exitToMainERC20 );
            dataExitToMainERC20 = methodWithArguments_exitToMainERC20.encodeABI();
        }
        //
        // prepare for transactions
        //
        strActionName = "prepare info for transactions S->M";
        //
        const gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 100000000000 );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        strActionName = "prepare key for transactions S->M";
        const privateKeyForSchain = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        //
        // send transactions
        //
        strActionName = "w3_s_chain.eth.sendSignedTransaction()/Approve";
        let tcnt = parseInt( await w3_s_chain.eth.getTransactionCount( joAccountSrc.address( w3_s_chain ), null ) );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        const txApprove = compose_tx_instance( strLogPrefix, {
            chainId: cid_s_chain,
            from: accountForSchain,
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxApprove,
            to: erc20Address_s_chain,
            gasPrice: gasPrice,
            gas: 8000000
        } );
        txApprove.sign( privateKeyForSchain );
        const serializedTxApprove = txApprove.serialize();
        // let joReceiptApprove = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
        const joReceiptApprove = await safe_send_signed_transaction( w3_s_chain, serializedTxApprove, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        if( joReceiptApprove && typeof joReceiptApprove == "object" && "gasUsed" in joReceiptApprove ) {
            jarrReceipts.push( {
                "description": "do_erc20_payment_from_s_chain/approve",
                "receipt": joReceiptApprove
            } );
        }
        //
        if( g_nSleepBetweenTransactionsOnSChainMilliseconds ) {
            log.write( cc.normal( "Sleeping " ) + cc.info( g_nSleepBetweenTransactionsOnSChainMilliseconds ) + cc.normal( " milliseconds between transactions..." ) + "\n" );
            await sleep( g_nSleepBetweenTransactionsOnSChainMilliseconds );
        }
        if( g_bWaitForNextBlockOnSChain )
            await wait_for_next_block_to_appear( w3_s_chain );

        //
        strActionName = "w3_s_chain.eth.sendSignedTransaction()/ExitToMainERC20";
        tcnt = parseInt( await w3_s_chain.eth.getTransactionCount( joAccountSrc.address( w3_s_chain ), null ) );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        const txExitToMainERC20 = compose_tx_instance( strLogPrefix, {
            chainId: cid_s_chain,
            from: accountForSchain,
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataExitToMainERC20,
            to: tokenManagerAddress,
            gasPrice: gasPrice,
            gas: 8000000
        } );
        txExitToMainERC20.sign( privateKeyForSchain );
        const serializedTxExitToMainERC20 = txExitToMainERC20.serialize();
        // let joReceiptExitToMainERC20 = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxExitToMainERC20.toString( "hex" ) );
        const joReceiptExitToMainERC20 = await safe_send_signed_transaction( w3_s_chain, serializedTxExitToMainERC20, strActionName, strLogPrefix );
        if( joReceiptExitToMainERC20 && typeof joReceiptExitToMainERC20 == "object" && "gasUsed" in joReceiptExitToMainERC20 ) {
            jarrReceipts.push( {
                "description": "do_erc20_payment_from_s_chain/exit-to-main",
                "receipt": joReceiptExitToMainERC20
            } );
        }
        const joReceipt = joReceiptExitToMainERC20;
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt for ExitToMainERC20: " ) + cc.j( joReceiptExitToMainERC20 ) + "\n" );
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_s_chain ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.debug( " contract ..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_message_proxy_s_chain, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_s_chain.options.address + " contract, no events found" );
        } // if( jo_message_proxy_s_chain )
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return false;
    }
    print_gas_usage_report_from_array( "ERC-20 PAYMENT FROM S-CHAIN", jarrReceipts );
    return true;
} // async function do_erc20_payment_from_s_chain(...

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function do_erc721_payment_from_s_chain(
    w3_main_net,
    w3_s_chain,
    cid_main_net,
    cid_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_token_manager, // only s-chain
    jo_message_proxy_s_chain, // for checking logs
    jo_deposit_box, // only main net
    token_id, // which ERC721 token id to send
    strCoinNameErc721_main_net,
    joErc721_main_net,
    strCoinNameErc721_s_chain,
    joErc721_s_chain,
    isRawTokenTransfer,
    tc_s_chain
) {
    const jarrReceipts = []; // do_erc721_payment_from_s_chain
    let strActionName = ""; const strLogPrefix = cc.info( "S2M ERC721 Payment:" ) + " ";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_erc721_payment_from_s_chain";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        //
        //
        strActionName = "ERC721 prepare S->M";
        const accountForMainnet = joAccountDst.address( w3_main_net );
        const accountForSchain = joAccountSrc.address( w3_s_chain );
        const erc721ABI = joErc721_s_chain[strCoinNameErc721_s_chain + "_abi"];
        const erc721Address_s_chain = joErc721_s_chain[strCoinNameErc721_s_chain + "_address"];
        const tokenManagerAddress = jo_token_manager.options.address;
        const contractERC721 = new w3_s_chain.eth.Contract( erc721ABI, erc721Address_s_chain );
        // prepare the smart contract function deposit(string schainID, address to)
        // const depositBoxAddress = jo_deposit_box.options.address;
        const methodWithArguments_transferFrom = contractERC721.methods.transferFrom(
            accountForSchain, tokenManagerAddress, "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 )
        );
        const isIgnore_transferFrom = false;
        const strDRC_transferFrom = "erc721_payment_from_s_chain, transferFrom";
        await dry_run_call( w3_s_chain, methodWithArguments_transferFrom, joAccountSrc, strDRC_transferFrom,isIgnore_transferFrom );
        const dataTxTransferFrom = methodWithArguments_transferFrom.encodeABI();
        let dataTxExitToMainERC721 = null;
        if( isRawTokenTransfer ) {
            const erc721Address_main_net = joErc721_main_net[strCoinNameErc721_main_net + "_address"];
            const methodWithArguments_rawExitToMainERC721 = jo_token_manager.methods.rawExitToMainERC721(
                erc721Address_s_chain, erc721Address_main_net // specific for rawExitToMainERC721() only
                , accountForMainnet, "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 )
            );
            const isIgnore_rawExitToMainERC721 = true;
            const strDRC_rawExitToMainERC721 = "erc721_payment_from_s_chain, rawExitToMainERC721";
            await dry_run_call( w3_s_chain, methodWithArguments_rawExitToMainERC721, joAccountSrc, strDRC_rawExitToMainERC721, isIgnore_rawExitToMainERC721 );
            dataTxExitToMainERC721 = methodWithArguments_rawExitToMainERC721.encodeABI();
        } else {
            // TO-DO: this is beta version, need to re-check and improve it later
            const methodWithArguments_exitToMainERC721 = jo_token_manager.methods.exitToMainERC721(
                erc721Address_s_chain, accountForMainnet, "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 )
            );
            const isIgnore_exitToMainERC721 = true;
            const strDRC_exitToMainERC721 = "erc721_payment_from_s_chain, exitToMainERC721";
            await dry_run_call( w3_s_chain, methodWithArguments_exitToMainERC721, joAccountSrc, strDRC_exitToMainERC721, isIgnore_exitToMainERC721 );
            dataTxExitToMainERC721 = methodWithArguments_exitToMainERC721.encodeABI();
        }
        //
        // prepare transactions
        //
        strActionName = "prepare transactions S->M";
        const gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 100000000000 );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        strActionName = "sign transactions S->M";
        const privateKeyForSchain = Buffer.from( joAccountSrc.privateKey, "hex" ); // convert private key to buffer
        //
        // send transactions
        //
        strActionName = "w3_s_chain.eth.sendSignedTransaction()/TransferFrom";
        let tcnt = await w3_s_chain.eth.getTransactionCount( joAccountSrc.address( w3_s_chain ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        const txTransferFrom = compose_tx_instance( strLogPrefix, {
            chainId: cid_s_chain,
            from: accountForSchain,
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxTransferFrom,
            to: erc721Address_s_chain,
            gasPrice: gasPrice,
            gas: 8000000
        } );
        txTransferFrom.sign( privateKeyForSchain );
        const serializedTxTransferFrom = txTransferFrom.serialize();
        // let joReceiptTransferFrom = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxTransferFrom.toString( "hex" ) );
        const joReceiptTransferFrom = await safe_send_signed_transaction( w3_s_chain, serializedTxTransferFrom, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt for TransferFrom: " ) + cc.j( joReceiptTransferFrom ) + "\n" );
        if( joReceiptTransferFrom && typeof joReceiptTransferFrom == "object" && "gasUsed" in joReceiptTransferFrom ) {
            jarrReceipts.push( {
                "description": "do_erc721_payment_from_s_chain/transfer-from",
                "receipt": joReceiptTransferFrom
            } );
        }
        //
        if( g_nSleepBetweenTransactionsOnSChainMilliseconds ) {
            log.write( cc.normal( "Sleeping " ) + cc.info( g_nSleepBetweenTransactionsOnSChainMilliseconds ) + cc.normal( " milliseconds between transactions..." ) + "\n" );
            await sleep( g_nSleepBetweenTransactionsOnSChainMilliseconds );
        }
        if( g_bWaitForNextBlockOnSChain )
            await wait_for_next_block_to_appear( w3_s_chain );

        //
        strActionName = "w3_s_chain.eth.sendSignedTransaction()/ExitToMainERC721";
        tcnt = await w3_s_chain.eth.getTransactionCount( joAccountSrc.address( w3_s_chain ), null );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        const txExitToMainERC721 = compose_tx_instance( strLogPrefix, {
            chainId: cid_s_chain,
            from: accountForSchain,
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxExitToMainERC721,
            to: tokenManagerAddress,
            gasPrice: gasPrice,
            gas: 8000000
        } );
        txExitToMainERC721.sign( privateKeyForSchain );
        const serializedTxExitToMainERC721 = txExitToMainERC721.serialize();
        // let joReceiptExitToMainERC721 = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxExitToMainERC721.toString( "hex" ) );
        const joReceiptExitToMainERC721 = await safe_send_signed_transaction( w3_s_chain, serializedTxExitToMainERC721, strActionName, strLogPrefix );
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt for ExitToMainERC721: " ) + cc.j( joReceiptExitToMainERC721 ) + "\n" );
        const joReceipt = joReceiptExitToMainERC721;
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.success( "Result receipt for ExitToMainERC721: " ) + cc.j( joReceiptExitToMainERC721 ) + "\n" );
        if( joReceiptExitToMainERC721 && typeof joReceiptExitToMainERC721 == "object" && "gasUsed" in joReceiptExitToMainERC721 ) {
            jarrReceipts.push( {
                "description": "do_erc721_payment_from_s_chain/exit-to-main",
                "receipt": joReceiptExitToMainERC721
            } );
        }
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_s_chain ) {
            if( verbose_get() >= RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.debug( " contract ..." ) + "\n" );
            const joEvents = await get_contract_call_events( jo_message_proxy_s_chain, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 ) {
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_s_chain.options.address + " contract, no events found" );
        } // if( jo_message_proxy_s_chain )
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return false;
    }
    print_gas_usage_report_from_array( "ERC-721 PAYMENT FROM S-CHAIN", jarrReceipts );
    return true;
} // async function do_erc721_payment_from_s_chain(...

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Do real money movement from main-net to S-chain by sniffing events
// 1) main-net.MessageProxyForMainnet.getOutgoingMessagesCounter -> save to nOutMsgCnt
// 2) S-chain.MessageProxySchain.getIncomingMessagesCounter -> save to nIncMsgCnt
// 3) Will transfer all in range from [ nIncMsgCnt ... (nOutMsgCnt-1) ] ... assume current counter index is nIdxCurrentMsg
//
// One transaction transfer is:
// 1) Find events main-net.MessageProxyForMainnet.OutgoingMessage where msgCounter member is in range
// 2) Publish it to S-chain.MessageProxySchain.postIncomingMessages(
//            main-net chain id   // uint64 srcChainID
//            nIdxCurrentMsg // uint64 startingCounter
//            [srcContract]  // address[] memory senders
//            [dstContract]  // address[] memory dstContracts
//            [to]           // address[] memory to
//            [amount]       // uint256[] memory amount / *uint256[2] memory blsSignature* /
//            )
//
async function do_transfer(
    w3_src,
    jo_message_proxy_src,
    joAccountSrc,
    w3_dst,
    jo_message_proxy_dst,
    //
    joAccountDst,
    //
    chain_id_src,
    chain_id_dst,
    cid_src,
    cid_dst,
    //
    jo_deposit_box_main_net, // for logs validation on mainnet
    jo_token_manager_schain, // for logs validation on s-chain
    //
    nTransactionsCountInBlock,
    nMaxTransactionsCount,
    nBlockAwaitDepth,
    nBlockAge,
    fn_sign_messages,
    //
    tc_dst // same as w3_dst
) {
    const jarrReceipts = []; // do_transfer
    let bErrorInSigningMessages = false; const strLogPrefix = cc.info( "Transfer from " ) + cc.notice( chain_id_src ) + cc.info( " to " ) + cc.notice( chain_id_dst ) + cc.info( ":" ) + " ";
    if( fn_sign_messages == null || fn_sign_messages == undefined ) {
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Using internal signing stub function" ) + "\n" );
        fn_sign_messages = async function( jarrMessages, nIdxCurrentMsgBlockStart, fnAfter ) {
            // if ( verbose_get() >= RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Message signing callback was " ) + cc.error( "not provided" ) +
                cc.debug( " to IMA, message start index is " ) + cc.info( nIdxCurrentMsgBlockStart ) + cc.debug( ", have " ) +
                cc.info( jarrMessages.length ) + cc.debug( " message(s) to process:" ) + cc.j( jarrMessages ) + "\n" );
            await fnAfter( null, jarrMessages, null ); // null - no error, null - no signatures
        };
    } else
        log.write( strLogPrefix + cc.debug( "Using externally provided signing function" ) + "\n" );
    nTransactionsCountInBlock = nTransactionsCountInBlock || 5;
    nMaxTransactionsCount = nMaxTransactionsCount || 100;
    if( nTransactionsCountInBlock < 1 )
        nTransactionsCountInBlock = 1;
    if( nBlockAwaitDepth < 0 )
        nBlockAwaitDepth = 0;
    if( nBlockAge < 0 )
        nBlockAge = 0;
    let r; let strActionName = "";
    let nIdxCurrentMsg = 0;
    let nOutMsgCnt = 0;
    let nIncMsgCnt = 0;
    let idxLastToPopNotIncluding = 0;
    try {
        let nPossibleIntegerValue = 0;
        log.write( cc.info( "SRC " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) + cc.bright( jo_message_proxy_src.options.address ) + "\n" );
        log.write( cc.info( "DST " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) + cc.bright( jo_message_proxy_dst.options.address ) + "\n" );
        strActionName = "src-chain.MessageProxy.getOutgoingMessagesCounter()";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        nPossibleIntegerValue = await jo_message_proxy_src.methods.getOutgoingMessagesCounter( chain_id_dst ).call( {
            from: joAccountSrc.address( w3_src )
        } );
        if( !owaspUtils.validateInteger( nPossibleIntegerValue ) )
            throw new Error( "DST chain " + chain_id_dst + " returned outgoing message counter " + nPossibleIntegerValue + " which is not a valid integer" );
        nOutMsgCnt = owaspUtils.toInteger( nPossibleIntegerValue );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Result of " ) + cc.notice( strActionName ) + cc.debug( " call: " ) + cc.info( nOutMsgCnt ) + "\n" );
        //
        strActionName = "dst-chain.MessageProxy.getIncomingMessagesCounter()";
        if( verbose_get() >= RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        nPossibleIntegerValue = await jo_message_proxy_dst.methods.getIncomingMessagesCounter( chain_id_src ).call( {
            from: joAccountDst.address( w3_dst )
        } );
        if( !owaspUtils.validateInteger( nPossibleIntegerValue ) )
            throw new Error( "SRC chain " + chain_id_src + " returned incoming message counter " + nPossibleIntegerValue + " which is not a valid integer" );
        nIncMsgCnt = owaspUtils.toInteger( nPossibleIntegerValue );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Result of " ) + cc.notice( strActionName ) + cc.debug( " call: " ) + cc.info( nIncMsgCnt ) + "\n" );
        //
        strActionName = "src-chain.MessageProxy.getIncomingMessagesCounter()";
        nPossibleIntegerValue = await jo_message_proxy_src.methods.getIncomingMessagesCounter( chain_id_dst ).call( {
            from: joAccountSrc.address( w3_src )
        } );
        if( !owaspUtils.validateInteger( nPossibleIntegerValue ) )
            throw new Error( "DST chain " + chain_id_dst + " returned incoming message counter " + nPossibleIntegerValue + " which is not a valid integer" );
        idxLastToPopNotIncluding = owaspUtils.toInteger( nPossibleIntegerValue );
        if( verbose_get() >= RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( "Result of " ) + cc.notice( strActionName ) + cc.debug( " call: " ) + cc.info( idxLastToPopNotIncluding ) + "\n" );
        //
        // outer loop is block former/creator, then transfer
        //
        nIdxCurrentMsg = nIncMsgCnt;
        let cntProcessed = 0;
        while( nIdxCurrentMsg < nOutMsgCnt ) {
            if( verbose_get() >= RV_VERBOSE.trace )
                log.write( strLogPrefix + cc.debug( "Entering block former iteration with " ) + cc.notice( "message counter" ) + cc.debug( " set to " ) + cc.info( nIdxCurrentMsg ) + "\n" );
            const arrMessageCounters = [];
            const messages = [];
            const nIdxCurrentMsgBlockStart = 0 + nIdxCurrentMsg;
            //
            // inner loop wil create block of transactions
            //
            let cntAccumulatedForBlock = 0;
            for( let idxInBlock = 0; nIdxCurrentMsg < nOutMsgCnt && idxInBlock < nTransactionsCountInBlock; ++nIdxCurrentMsg, ++idxInBlock, ++cntAccumulatedForBlock ) {
                const idxProcessing = cntProcessed + idxInBlock;
                if( idxProcessing > nMaxTransactionsCount )
                    break;
                //
                //
                strActionName = "src-chain.MessageProxy.getPastEvents()";
                if( verbose_get() >= RV_VERBOSE.trace )
                    log.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( " for " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event now..." ) + "\n" );
                r = await jo_message_proxy_src.getPastEvents( "OutgoingMessage", {
                    filter: {
                        dstChainHash: [ w3_src.utils.soliditySha3( chain_id_dst ) ],
                        msgCounter: [ nIdxCurrentMsg ]
                    },
                    fromBlock: 0,
                    toBlock: "latest"
                } );
                let joValues = "";
                for( let i = r.length - 1; i >= 0; i-- ) {
                    if( r[i].returnValues.dstChain == chain_id_dst ) {
                        joValues = r[i].returnValues;
                        break;
                    }
                }
                if( joValues == "" ) {
                    log.write( strLogPrefix + cc.error( "Can't get events from MessageProxy" ) + "\n" );
                    process.exit( 126 );
                }
                //
                //
                //
                if( nBlockAwaitDepth > 0 ) {
                    let bSecurityCheckPassed = true;
                    const strActionName_old = "" + strActionName;
                    strActionName = "security check: evaluate block depth";
                    try {
                        const transactionHash = r[0].transactionHash;
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( strLogPrefix + cc.debug( "Event transactionHash is " ) + cc.info( transactionHash ) + "\n" );
                        const blockNumber = r[0].blockNumber;
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( strLogPrefix + cc.debug( "Event blockNumber is " ) + cc.info( blockNumber ) + "\n" );
                        const nLatestBlockNumber = await w3_src.eth.getBlockNumber();
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( strLogPrefix + cc.debug( "Latest blockNumber is " ) + cc.info( nLatestBlockNumber ) + "\n" );
                        const nDist = nLatestBlockNumber - blockNumber;
                        if( nDist < nBlockAwaitDepth )
                            bSecurityCheckPassed = false;
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( strLogPrefix + cc.debug( "Distance by blockNumber is " ) + cc.info( nDist ) + cc.debug( ", await check is " ) + ( bSecurityCheckPassed ? cc.success( "PASSED" ) : cc.error( "FAILED" ) ) + "\n" );
                    } catch ( err ) {
                        bSecurityCheckPassed = false;
                        if( verbose_get() >= RV_VERBOSE.fatal )
                            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Exception(evaluate block depth) while getting transaction hash and block number during " + strActionName + ": " ) + cc.error( err ) + "\n" );
                        return false;
                    }
                    strActionName = "" + strActionName_old;
                    if( !bSecurityCheckPassed ) {
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( strLogPrefix + cc.warning( "Block depth check was not passed, canceling search for transfer events" ) + "\n" );
                        break;
                    }
                } // if( nBlockAwaitDepth > 0 )
                if( nBlockAge > 0 ) {
                    let bSecurityCheckPassed = true;
                    const strActionName_old = "" + strActionName;
                    strActionName = "security check: evaluate block age";
                    try {
                        const transactionHash = r[0].transactionHash;
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( strLogPrefix + cc.debug( "Event transactionHash is " ) + cc.info( transactionHash ) + "\n" );
                        const blockNumber = r[0].blockNumber;
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( strLogPrefix + cc.debug( "Event blockNumber is " ) + cc.info( blockNumber ) + "\n" );
                        //
                        //
                        const joBlock = await w3_src.eth.getBlock( blockNumber );
                        if( !owaspUtils.validateInteger( joBlock.timestamp ) )
                            throw new Error( "Block \"timestamp\" is not a valid integer value: " + joBlock.timestamp );
                        const timestampBlock = owaspUtils.toInteger( joBlock.timestamp );
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( strLogPrefix + cc.debug( "Block   TS is " ) + cc.info( timestampBlock ) + "\n" );
                        const timestampCurrent = parseInt( parseInt( Date.now().valueOf() ) / 1000 );
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( strLogPrefix + cc.debug( "Current TS is " ) + cc.info( timestampCurrent ) + "\n" );
                        const tsDiff = timestampCurrent - timestampBlock;
                        if( verbose_get() >= RV_VERBOSE.trace ) {
                            log.write( strLogPrefix + cc.debug( "Diff    TS is " ) + cc.info( tsDiff ) + "\n" );
                            log.write( strLogPrefix + cc.debug( "Expected diff " ) + cc.info( nBlockAge ) + "\n" );
                        }
                        if( tsDiff < nBlockAge )
                            bSecurityCheckPassed = false;
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( strLogPrefix + cc.debug( "Block age check is " ) + ( bSecurityCheckPassed ? cc.success( "PASSED" ) : cc.error( "FAILED" ) ) + "\n" );
                    } catch ( err ) {
                        bSecurityCheckPassed = false;
                        if( verbose_get() >= RV_VERBOSE.fatal )
                            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Exception(evaluate block age) while getting block number and timestamp during " + strActionName + ": " ) + cc.error( err ) + "\n" );
                        return false;
                    }
                    strActionName = "" + strActionName_old;
                    if( !bSecurityCheckPassed ) {
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( strLogPrefix + cc.warning( "Block age check was not passed, canceling search for transfer events" ) + "\n" );
                        break;
                    }
                } // if( nBlockAge > 0 )
                //
                //
                //
                if( verbose_get() >= RV_VERBOSE.debug ) {
                    log.write(
                        strLogPrefix +
                        cc.success( "Got event details from " ) + cc.notice( "getPastEvents()" ) +
                        cc.success( " event invoked with " ) + cc.notice( "msgCounter" ) + cc.success( " set to " ) + cc.info( nIdxCurrentMsg ) +
                        cc.success( " and " ) + cc.notice( "dstChain" ) + cc.success( " set to " ) + cc.info( chain_id_dst ) +
                        cc.success( ", event description: " ) + cc.j( joValues ) + // + cc.j(evs) +
                        "\n"
                    );
                }
                //
                //
                if( verbose_get() >= RV_VERBOSE.trace )
                    log.write( strLogPrefix + cc.debug( "Will process message counter value " ) + cc.info( nIdxCurrentMsg ) + "\n" );
                arrMessageCounters.push( nIdxCurrentMsg );
                messages.push( {
                    sender: joValues.srcContract,
                    destinationContract: joValues.dstContract,
                    to: joValues.to,
                    amount: joValues.amount,
                    data: joValues.data
                } );
            } // for( let idxInBlock = 0; nIdxCurrentMsg < nOutMsgCnt && idxInBlock < nTransactionsCountInBlock; ++ nIdxCurrentMsg, ++ idxInBlock, ++cntAccumulatedForBlock )
            if( cntAccumulatedForBlock == 0 )
                break;
            //
            //
            strActionName = "sign messages";
            await fn_sign_messages( messages, nIdxCurrentMsgBlockStart, async function( err, jarrMessages, joGlueResult ) {
                if( err ) {
                    bErrorInSigningMessages = true;
                    if( verbose_get() >= RV_VERBOSE.fatal )
                        log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error signing messages: " ) + cc.error( err ) + "\n" );
                    return;
                }
                strActionName = "dst-chain.getTransactionCount()";
                const tcnt = await w3_dst.eth.getTransactionCount( joAccountDst.address( w3_dst ), null );
                if( verbose_get() >= RV_VERBOSE.debug )
                    log.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
                //
                //
                const nBlockSize = arrMessageCounters.length;
                strActionName = "dst-chain.MessageProxy.postIncomingMessages()";
                if( verbose_get() >= RV_VERBOSE.trace ) {
                    log.write(
                        strLogPrefix +
                        cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( " for " ) +
                        cc.notice( "block size" ) + cc.debug( " set to " ) + cc.info( nBlockSize ) +
                        cc.debug( ", " ) + cc.notice( "message counters =" ) + cc.debug( " are " ) + cc.info( JSON.stringify( arrMessageCounters ) ) +
                        cc.debug( "..." ) + "\n"
                    );
                }
                //
                // TO DO: convert joGlueResult.hashSrc into G1 point
                //
                let signature = joGlueResult ? joGlueResult.signature : null;
                if( !signature )
                    signature = { X: "0", Y: "0" };
                let hashPoint = joGlueResult ? joGlueResult.hashPoint : null;
                if( !hashPoint )
                    hashPoint = { X: "0", Y: "0" };
                let hint = joGlueResult ? joGlueResult.hint : null;
                if( !hint )
                    hint = "0";
                const sign = {
                    blsSignature: [ signature.X, signature.Y ], // BLS glue of signatures
                    hashA: hashPoint.X, // G1.X from joGlueResult.hashSrc
                    hashB: hashPoint.Y, // G1.Y from joGlueResult.hashSrc
                    counter: hint
                };
                const methodWithArguments_postIncomingMessages = jo_message_proxy_dst.methods.postIncomingMessages(
                    // call params
                    chain_id_src,
                    nIdxCurrentMsgBlockStart,
                    jarrMessages, // messages
                    sign, // bls signature components
                    idxLastToPopNotIncluding
                );
                const isIgnore_postIncomingMessages = false;
                const strDRC_postIncomingMessages = "postIncomingMessages in message signer";
                await dry_run_call( w3_dst, methodWithArguments_postIncomingMessages, joAccountDst, strDRC_postIncomingMessages,isIgnore_postIncomingMessages );
                const dataTx_postIncomingMessages = methodWithArguments_postIncomingMessages.encodeABI(); // the encoded ABI of the method
                //
                if( verbose_get() >= RV_VERBOSE.trace ) {
                    const joDebugArgs = [
                        chain_id_src,
                        chain_id_dst,
                        nIdxCurrentMsgBlockStart,
                        jarrMessages, // messages
                        [ signature.X, signature.Y ], // BLS glue of signatures
                        hashPoint.X, // G1.X from joGlueResult.hashSrc
                        hashPoint.Y, // G1.Y from joGlueResult.hashSrc
                        hint
                    ];
                    log.write(
                        strLogPrefix +
                        cc.debug( "....debug args for " ) +
                        cc.notice( "msgCounter" ) + cc.debug( " set to " ) + cc.info( nIdxCurrentMsgBlockStart ) + cc.debug( ": " ) +
                        cc.j( joDebugArgs ) + "\n" );
                }
                //
                const gasPrice = await tc_dst.computeGasPrice( w3_dst, 10000000000 );
                if( verbose_get() >= RV_VERBOSE.debug )
                    log.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
                //
                const tx_postIncomingMessages = compose_tx_instance( strLogPrefix, {
                    chainId: cid_dst,
                    nonce: tcnt,
                    gas: 6000000, // 8000000
                    gasPrice: gasPrice,
                    // "gasLimit": 3000000,
                    to: jo_message_proxy_dst.options.address, // contract address
                    data: dataTx_postIncomingMessages //,
                    // "value": wei_amount // 1000000000000000000 // w3_dst.utils.toWei( (1).toString(), "ether" ) // how much money to send
                } );
                const key = Buffer.from( joAccountDst.privateKey, "hex" ); // convert private key to buffer ??????????????????????????????????
                tx_postIncomingMessages.sign( key ); // arg is privateKey as buffer
                const serializedTx_postIncomingMessages = tx_postIncomingMessages.serialize();
                strActionName = "w3_dst.eth.sendSignedTransaction()";
                // let joReceipt = await w3_dst.eth.sendSignedTransaction( "0x" + serializedTx_postIncomingMessages.toString( "hex" ) );
                const joReceipt = await safe_send_signed_transaction( w3_dst, serializedTx_postIncomingMessages, strActionName, strLogPrefix );
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
                if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
                    jarrReceipts.push( {
                        "description": "do_transfer/postIncomingMessages",
                        "receipt": joReceipt
                    } );
                    print_gas_usage_report_from_array( "(intermediate result) TRANSFER " + chain_id_src + " -> " + chain_id_dst, jarrReceipts );
                }
                cntProcessed += cntAccumulatedForBlock;
                //
                //
                //
                //
                //
                //
                //
                if( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.debug( "Validating transfer from " ) + cc.info( chain_id_src ) + cc.debug( " to " ) + cc.info( chain_id_dst ) + cc.debug( "..." ) + "\n" );
                //
                // check DepositBox -> Error on Mainnet only
                //
                if( chain_id_dst == "Mainnet" ) {
                    if( verbose_get() >= RV_VERBOSE.information )
                        log.write( strLogPrefix + cc.debug( "Validating transfer to Main Net via DepositBox error absence on Main Net..." ) + "\n" );
                    if( jo_deposit_box_main_net ) {
                        if( verbose_get() >= RV_VERBOSE.information )
                            log.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "DepositBox" ) + cc.debug( "/" ) + cc.notice( jo_deposit_box_main_net.options.address ) + cc.debug( " contract..." ) + "\n" );
                        const joEvents = await get_contract_call_events( jo_deposit_box_main_net, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
                        if( joEvents.length == 0 ) {
                            if( verbose_get() >= RV_VERBOSE.information )
                                log.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box_main_net.options.address ) + cc.success( " contract, no events found" ) + "\n" );
                        } else {
                            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.warning( " Failed" ) + cc.error( " verification of the " ) + cc.warning( "Error" ) + cc.error( " event of the " ) + cc.warning( "DepositBox" ) + cc.error( "/" ) + cc.notice( jo_deposit_box_main_net.options.address ) + cc.error( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
                            throw new Error( "Verification failed for the \"Error\" event of the \"DepositBox\"/" + jo_deposit_box_main_net.options.address + " contract, error events found" );
                        }
                        if( verbose_get() >= RV_VERBOSE.information )
                            log.write( strLogPrefix + cc.success( "Done, validated transfer to Main Net via DepositBox error absence on Main Net" ) + "\n" );
                    } else
                        log.write( strLogPrefix + cc.console.warn( "Cannot validate transfer to Main Net via DepositBox error absence on Main Net, no DepositBox provided" ) + "\n" );
                } // if( chain_id_dst == "Mainnet" )
                /*
                //
                // check TokenManager -> Error on Schain only
                //
                if( chain_id_dst != "Mainnet" ) {
                    if ( verbose_get() >= RV_VERBOSE.information )
                        log.write( strLogPrefix + cc.debug("Validating transfer to S-Chain via TokenManager error absence on S-Chain...") + "\n" );
                    if( jo_token_manager_schain ) {
                        if ( verbose_get() >= RV_VERBOSE.information )
                            log.write( strLogPrefix + cc.debug("Verifying the ") + cc.info("Error") + cc.debug(" event of the ") + cc.info("TokenManager") + cc.debug("/") + cc.notice(jo_token_manager_schain.options.address) + cc.debug(" contract..." ) + "\n" );
                        let joEvents = await get_contract_call_events( jo_token_manager_schain, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
                        if( joEvents.length == 0 ) {
                            if ( verbose_get() >= RV_VERBOSE.information )
                                log.write( strLogPrefix + cc.success("Success, verified the ") + cc.info("Error") + cc.success(" event of the ") + cc.info("TokenManager") + cc.success("/") + cc.notice(jo_token_manager_schain.options.address) + cc.success(" contract, no events found" ) + "\n" );
                        } else {
                            log.write( strLogPrefix + cc.fatal("CRITICAL ERROR:") + cc.warning(" Failed") + cc.error(" verification of the ") + cc.warning("Error") + cc.error(" event of the ") + cc.warning("TokenManager") + cc.error("/") + cc.notice(jo_token_manager_schain.options.address) + cc.error(" contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
                            throw new Error( "Verification failed for the \"Error\" event of the \"TokenManager\"/" + jo_token_manager_schain.options.address + " contract, error events found" );
                        }
                        if ( verbose_get() >= RV_VERBOSE.information )
                            log.write( strLogPrefix + cc.success("Done, validated transfer to S-Chain via TokenManager error absence on S-Chain") + "\n" );
                    } else
                        log.write( strLogPrefix + cc.console.warn("Cannot validate transfer to S-Chain via TokenManager error absence on S-Chain, no TokenManager provided") + "\n" );
                } // if( chain_id_dst != "Mainnet" )
                if ( verbose_get() >= RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success("Done, validated transfer from ") + cc.info(chain_id_src) + cc.debug(" to ") + cc.info(chain_id_dst) + cc.debug(", everything is OKay") + "\n" );
                */
                //
                //
                //
            } );
            if( bErrorInSigningMessages )
                break;
        } // while( nIdxCurrentMsg < nOutMsgCnt )
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in do_transfer() during " + strActionName + ": " ) + cc.error( err ) + "\n" );
        return false;
    }
    print_gas_usage_report_from_array( "TRANSFER " + chain_id_src + " -> " + chain_id_dst, jarrReceipts );
    return true;
} // async function do_transfer( ...

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function compose_gas_usage_report_from_array( strName, jarrReceipts ) {
    if( ! ( strName && typeof strName == "string" && jarrReceipts ) )
        return "";
    let i, sumGasUsed = 0, s = "\n\n" + cc.info( "GAS USAGE REPORT FOR " ) + cc.attention( strName ) + "\n";
    for( i = 0; i < jarrReceipts.length; ++ i ) {
        sumGasUsed += parseInt( jarrReceipts[i].receipt.gasUsed, 10 );
        s += cc.notice( jarrReceipts[i].description ) + cc.debug( "....." ) + cc.info( jarrReceipts[i].receipt.gasUsed ) + "\n";
    }
    s += cc.attention( "SUM" ) + cc.debug( "....." ) + cc.info( sumGasUsed ) + "\n\n";
    return s;
}

function print_gas_usage_report_from_array( strName, jarrReceipts ) {
    const s = compose_gas_usage_report_from_array( strName, jarrReceipts );
    if( s && s.length > 0 )
        log.write( s );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// init helpers
//

function noop() {
    return null;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class TransactionCustomizer {
    constructor( gasPriceMultiplier ) {
        this.gasPriceMultiplier = gasPriceMultiplier ? ( 0.0 + gasPriceMultiplier ) : null; // null means use current gasPrice or recommendedGasPrice
    }
    async computeGasPrice( w3, recommendedGasPrice ) {
        if( this.gasPriceMultiplier != null && this.gasPriceMultiplier != undefined && this.gasPriceMultiplier >= 0 && recommendedGasPrice != null && recommendedGasPrice != undefined )
            return parseInt( recommendedGasPrice );
        if( this.gasPriceMultiplier <= 0 )
            return 0;
        let gasPrice = parseInt( await w3.eth.getGasPrice() );
        gasPrice *= this.gasPriceMultiplier;
        return gasPrice;
    }
};

const tc_main_net = new TransactionCustomizer( 1.25 );
const tc_s_chain = new TransactionCustomizer( null );

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

module.exports.longSeparator = g_mtaStrLongSeparator;
module.exports.noop = noop;
module.exports.cc = cc;
module.exports.log = log;
module.exports.sleep = sleep;
module.exports.owaspUtils = owaspUtils;
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

module.exports.dry_run_is_enabled = dry_run_is_enabled;
module.exports.dry_run_enable = dry_run_enable;
module.exports.dry_run_is_ignored = dry_run_is_ignored;
module.exports.dry_run_ignore = dry_run_ignore;
module.exports.dry_run_call = dry_run_call;
module.exports.safe_send_signed_transaction = safe_send_signed_transaction;

module.exports.register_s_chain_on_main_net = register_s_chain_on_main_net; // step 1A
module.exports.check_is_registered_main_net_on_s_chain = check_is_registered_main_net_on_s_chain; // step 1B
module.exports.register_s_chain_in_deposit_box = register_s_chain_in_deposit_box; // step 2
module.exports.register_main_net_depositBox_on_s_chain = register_main_net_depositBox_on_s_chain; // step 3

module.exports.check_is_registered_s_chain_on_main_net = check_is_registered_s_chain_on_main_net; // step 1A
module.exports.register_main_net_on_s_chain = register_main_net_on_s_chain; // step 1B
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

module.exports.compose_gas_usage_report_from_array = compose_gas_usage_report_from_array;
module.exports.print_gas_usage_report_from_array = print_gas_usage_report_from_array;

module.exports.TransactionCustomizer = TransactionCustomizer;
module.exports.tc_main_net = tc_main_net;
module.exports.tc_s_chain = tc_s_chain;

module.exports.compose_tx_instance = compose_tx_instance;

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
