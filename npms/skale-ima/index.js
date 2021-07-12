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
const fs = require( "fs" );
// const path = require( "path" );
// const url = require( "url" );
// const os = require( "os" );
const w3mod = require( "web3" );
const ethereumjs_tx = require( "ethereumjs-tx" );
const ethereumjs_wallet = require( "ethereumjs-wallet" );
const ethereumjs_util = require( "ethereumjs-util" );

const Redis = require( "ioredis" );
let redis = null;

const log = require( "../skale-log/log.js" );
const cc = log.cc;
cc.enable( false );
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

let g_isExposeDetails = false;
let g_verboseLevel = RV_VERBOSE.error;

function expose_details_get() {
    return g_isExposeDetails;
}
function expose_details_set( x ) {
    g_isExposeDetails = x ? true : false;
}

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

const g_nSleepBeforeFetchOutgoingMessageEvent = 5000;
let g_nSleepBetweenTransactionsOnSChainMilliseconds = 0; // example - 5000
let g_bWaitForNextBlockOnSChain = false;

function getSleepBetweenTransactionsOnSChainMilliseconds() {
    return g_nSleepBetweenTransactionsOnSChainMilliseconds;
}
function setSleepBetweenTransactionsOnSChainMilliseconds( val ) {
    g_nSleepBetweenTransactionsOnSChainMilliseconds = val ? val : 0;
}

function getWaitForNextBlockOnSChain() {
    return g_bWaitForNextBlockOnSChain ? true : false;
}
function setWaitForNextBlockOnSChain( val ) {
    g_bWaitForNextBlockOnSChain = val ? true : false;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const sleep = ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function parseIntSafer( s ) {
    s = s.trim();
    if( s.length > 2 && s[0] == "0" && ( s[1] == "x" || s[1] == "X" ) )
        return parseInt( s, 10 );
    return parseInt( s, 16 );
}

async function wait_for_next_block_to_appear( details, w3 ) {
    const nBlockNumber = await get_web3_blockNumber( details, 10, w3 );
    details.write( cc.debug( "Waiting for next block to appear..." ) + "\n" );
    details.write( cc.debug( "    ...have block " ) + cc.info( parseIntSafer( nBlockNumber ) ) + "\n" );
    for( ; true; ) {
        await sleep( 1000 );
        const nBlockNumber2 = await get_web3_blockNumber( details, 10, w3 );
        details.write( cc.debug( "    ...have block " ) + cc.info( parseIntSafer( nBlockNumber2 ) ) + "\n" );
        if( nBlockNumber2 > nBlockNumber )
            break;
    }
}

async function get_web3_blockNumber( details, attempts, w3 ) {
    const allAttempts = parseInt( attempts ) < 1 ? 1 : parseInt( attempts );
    let nLatestBlockNumber = "";
    try {
        nLatestBlockNumber = await w3.eth.getBlockNumber();
    } catch ( e ) {}
    let attemptIndex = 2;
    while( nLatestBlockNumber === "" && attemptIndex <= allAttempts ) {
        details.write(
            cc.warning( "Repeat " ) + cc.error( "getBlockNumber" ) + cc.warning( ", attempt " ) + cc.info( attemptIndex ) +
            cc.info( ", previous result is: " ) + cc.info( nLatestBlockNumber ) + "\n" );
        await sleep( 10000 );
        try {
            nLatestBlockNumber = await w3.eth.getBlockNumber();
        } catch ( e ) {}
        attemptIndex++;
    }
    if( attemptIndex + 1 > allAttempts && nLatestBlockNumber === "" )
        throw new Error( "Could not not get blockNumber" );
    return nLatestBlockNumber;
}

async function get_web3_transactionCount( details, attempts, w3, address, param ) {
    const allAttempts = parseInt( attempts ) < 1 ? 1 : parseInt( attempts );
    let txc = "";
    try {
        txc = await w3.eth.getTransactionCount( address, param );
    } catch ( e ) {}
    let attemptIndex = 2;
    while( txc === "" && attemptIndex <= allAttempts ) {
        details.write(
            cc.warning( "Repeat " ) + cc.error( "getTransactionCount" ) +
            cc.warning( " attempt " ) + cc.error( attemptIndex ) +
            cc.warning( ", previous result is: " ) + cc.info( txc ) + "\n"
        );
        await sleep( 10000 );
        try {
            txc = await w3.eth.getBlockNumber();
        } catch ( e ) {}
        attemptIndex++;
    }
    if( attemptIndex + 1 > allAttempts && txc === "" )
        throw new Error( "Could not not get Transaction Count" );
    return txc;
}

async function get_web3_transactionReceipt( details, attempts, w3, txHash ) {
    const allAttempts = parseInt( attempts ) < 1 ? 1 : parseInt( attempts );
    let txReceipt = "";
    try {
        txReceipt = await w3.eth.getTransactionReceipt( txHash );
    } catch ( e ) {}
    let attemptIndex = 2;
    while( txReceipt === "" && attemptIndex <= allAttempts ) {
        details.write(
            cc.warning( "Repeat " ) + cc.error( "getTransactionReceipt" ) + cc.warning( ", attempt " ) + cc.error( attemptIndex ) +
            cc.warning( ", previous result is: " ) + cc.j( txReceipt ) + "\n" );
        await sleep( 10000 );
        try {
            txReceipt = await w3.eth.getTransactionReceipt( txHash );
        } catch ( e ) {}
        attemptIndex++;
    }
    if( attemptIndex + 1 > allAttempts && txReceipt === "" )
        throw new Error( "Could not not get Transaction Count" );
    return txReceipt;
}

async function get_web3_pastEvents( details, attempts, joContract, strEventName, nBlockFrom, nBlockTo, joFilter ) {
    const allAttempts = parseInt( attempts ) < 1 ? 1 : parseInt( attempts );
    let joAllEventsInBlock = "";
    try {
        joAllEventsInBlock = await joContract.getPastEvents( "" + strEventName, {
            filter: joFilter,
            fromBlock: nBlockFrom,
            toBlock: nBlockTo
        } );
    } catch ( e ) {}
    let attemptIndex = 2;
    while( joAllEventsInBlock === "" && attemptIndex <= allAttempts ) {
        details.write(
            cc.warning( "Repeat " ) + cc.error( "getPastEvents" ) + cc.warning( "/" ) + cc.error( strEventName ) +
            cc.warning( ", attempt " ) + cc.error( attemptIndex ) +
            cc.warning( ", previous result is: " ) + cc.j( joAllEventsInBlock ) + "\n" );
        await sleep( 1000 );
        try {
            joAllEventsInBlock = await joContract.getPastEvents( "" + strEventName, {
                filter: joFilter,
                fromBlock: nBlockFrom,
                toBlock: nBlockTo
            } );
        } catch ( e ) {}
        attemptIndex++;
    }
    if( attemptIndex + 1 === allAttempts && joAllEventsInBlock === "" )
        throw new Error( "Could not not get Event" + strEventName );
    return joAllEventsInBlock;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function get_contract_call_events( details, w3, joContract, strEventName, nBlockNumber, strTxHash, joFilter ) {
    joFilter = joFilter || {};
    let nBlockFrom = nBlockNumber - 10, nBlockTo = nBlockNumber + 10;
    const nLatestBlockNumber = await get_web3_blockNumber( details, 10, w3 ); // await get_web3_universal_call( 10, "BlockNumber", w3, null, null );
    if( nBlockFrom < 0 )
        nBlockFrom = 0;
    if( nBlockTo > nLatestBlockNumber )
        nBlockTo = nLatestBlockNumber;
    const joAllEventsInBlock = await get_web3_pastEvents( details, 10, joContract, strEventName, nBlockFrom, nBlockTo, joFilter );
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

function compose_tx_instance( details, strLogPrefix, rawTx ) {
    details.write( cc.attention( "TRANSACTION COMPOSER" ) + cc.normal( " is using " ) + cc.bright( "Web3" ) + cc.normal( " version " ) + cc.sunny( w3mod.version ) + "\n" );
    strLogPrefix = strLogPrefix || "";
    rawTx = JSON.parse( JSON.stringify( rawTx ) ); // clone
    const joOpts = null;
    /*
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
*/
    // if( rawTx.chainId && Number(rawTx.chainId) > 1 ) {
    //     rawTx.nonce += 1048576; // see https://ethereum.stackexchange.com/questions/12810/need-help-signing-a-raw-transaction-with-ethereumjs-tx
    //     rawTx.nonce = w3mod.utils.toHex( rawTx.nonce );
    // }
    details.write( strLogPrefix + cc.debug( "....composed " ) + cc.notice( JSON.stringify( rawTx ) ) + cc.debug( " with opts " ) + cc.j( joOpts ) + "\n" );
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

async function dry_run_call( details, w3, methodWithArguments, joAccount, strDRC, isIgnore, gasPrice, gasValue, ethValue ) {
    details.write( cc.attention( "DRY RUN" ) + cc.normal( " is using " ) + cc.bright( "Web3" ) + cc.normal( " version " ) + cc.sunny( w3.version ) + "\n" );
    isIgnore = ( isIgnore != null && isIgnore != undefined ) ? ( isIgnore ? true : false ) : false;
    const strMethodName = extract_dry_run_method_name( methodWithArguments );
    const strWillBeIgnored = isIgnore ? "IGNORED " : "";
    let strLogPrefix = cc.attention( strWillBeIgnored + "DRY RUN CALL TO THE " ) + cc.bright( strMethodName ) + cc.attention( " METHOD" );
    if( strDRC && typeof strDRC == "string" && strDRC.length )
        strLogPrefix += cc.normal( "(" ) + cc.debug( strDRC ) + cc.normal( ")" );
    strLogPrefix += cc.attention( ":" ) + " ";
    if( ! dry_run_is_enabled() ) {
        details.write( strLogPrefix + cc.success( "Skipped, dry run is disabled" ) + "\n" );
        return;
    }
    try {
        const addressFrom = joAccount.address( w3 );
        details.write( strLogPrefix + cc.debug( " will call method" ) +
            // cc.debug( " with data " ) + cc.normal( cc.safeStringifyJSON( methodWithArguments ) ) +
            cc.debug( " from address " ) + cc.sunny( addressFrom ) +
            "\n" );
        const joResult = await methodWithArguments.call( {
            from: addressFrom,
            gasPrice: gasPrice,
            gas: gasValue, // 10000000
            value: "0x" + w3.utils.toBN( ethValue ).toString( 16 )
        } );
        details.write( strLogPrefix + cc.success( "got result " ) + cc.normal( cc.safeStringifyJSON( joResult ) ) + "\n" );
    } catch ( err ) {
        let strErrorMessage = "" + strLogPrefix;
        if( isIgnore )
            strErrorMessage += cc.warning( "IGNORED DRY RUN FAIL:" );
        else
            strErrorMessage += cc.fatal( "CRITICAL DRY RUN FAIL:" );
        strErrorMessage += " " + cc.error( err ) + "\n";
        details.write( strErrorMessage );
        if( ! ( isIgnore || dry_run_is_ignored() ) )
            throw new Error( "CRITICAL DRY RUN FAIL invoking the \"" + strMethodName + "\" method: " + err.toString() );
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function get_account_connectivity_info( joAccount ) {
    const joACI = {
        isBad: true,
        strType: "bad",
        isAutoSend: false
    };
    if( "strTransactionManagerURL" in joAccount && typeof joAccount.strTransactionManagerURL == "string" && joAccount.strTransactionManagerURL.length > 0 ) {
        joACI.isBad = false;
        joACI.strType = "tm";
        joACI.isAutoSend = true;
    } else if( "strSgxURL" in joAccount && typeof joAccount.strSgxURL == "string" && joAccount.strSgxURL.length > 0 &&
        "strSgxKeyName" in joAccount && typeof joAccount.strSgxKeyName == "string" && joAccount.strSgxKeyName.length > 0
    ) {
        joACI.isBad = false;
        joACI.strType = "sgx";
    } else if( "privateKey" in joAccount && typeof joAccount.privateKey == "string" && joAccount.privateKey.length > 0 ) {
        joACI.isBad = false;
        joACI.strType = "direct";
    } else {
        // bad by default
    }
    return joACI;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const g_tm_pool = "transactions";

const tm_gen_random_hex = size => [ ...Array( size ) ].map( () => Math.floor( Math.random() * 16 ).toString( 16 ) ).join( "" );

function tm_make_id( details ) {
    const prefix = "tx-";
    const unique = tm_gen_random_hex( 16 );
    const id = prefix + unique + "js";
    details.write( cc.debug( "TM - Generated id: " ) + cc.debug( id ) + "\n" );
    return id;
}

function tm_make_record( tx = {}, score ) {
    const status = "PROPOSED";
    return JSON.stringify( {
        "score": score,
        "status": status,
        ...tx
    } );
}

function tm_make_score( priority ) {
    const ts = Math.floor( ( new Date() ).getTime() / 1000 );
    return priority * Math.pow( 10, ts.toString().length ) + ts;
}

async function tm_send( details, tx, priority = 5 ) {
    details.write( cc.debug( "TM - sending tx " ) + cc.j( tx ) + "\n" );
    const id = tm_make_id( details );
    const score = tm_make_score( priority );
    const record = tm_make_record( tx, score );
    details.write( cc.debug( "TM - Sending score: " ) + cc.info( score ) + cc.debug( ", record: " ) + cc.info( record ) + "\n" );
    await redis.multi()
        .set( id, record )
        .zadd( g_tm_pool, score, id )
        .exec();
    return id;
}

function tm_is_finished( record ) {
    if( record == null )
        return null;
    const status = "status" in record ? record.status : null;
    return [ "SUCCESS", "FAILED", "DROPPED" ].includes( status );
}

async function tm_get_record( tx_id ) {
    const r = await redis.get( tx_id );
    if( r != null )
        return JSON.parse( r );
    return null;
}

async function tm_wait( details, tx_id, w3 ) {
    details.write( cc.debug( "TM - waiting for TX ID: " ) + cc.info( tx_id ) + cc.debug( "..." ) + "\n" );
    let hash;
    while( hash === undefined ) {
        const r = await tm_get_record( tx_id );
        if( tm_is_finished( r ) )
            hash = r.tx_hash;
    }
    details.write( cc.debug( "TM - TX hash is " ) + cc.info( hash ) + "\n" );
    // return await w3.eth.getTransactionReceipt( hash );
    return await get_web3_transactionReceipt( details, 10, w3, hash );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function safe_sign_transaction_with_account( details, w3, tx, rawTx, joAccount ) {
    const joSR = {
        joACI: get_account_connectivity_info( joAccount ),
        tx: null,
        txHashSent: null
    };
    switch ( joSR.joACI.strType ) {
    case "tm": {
        /*
        details.write(
            cc.debug( "Will sign with Transaction Manager wallet, transaction is " ) + cc.j( tx ) +
            cc.debug( ", raw transaction is " ) + cc.j( rawTx ) + "\n" +
            cc.debug( " using account " ) + cc.j( joAccount ) + "\n"
        );
        let rpcCallOpts = null;
        if( "strPathSslKey" in joAccount && typeof joAccount.strPathSslKey == "string" && joAccount.strPathSslKey.length > 0 &&
            "strPathSslCert" in joAccount && typeof joAccount.strPathSslCert == "string" && joAccount.strPathSslCert.length > 0
        ) {
            rpcCallOpts = {
            };
            // details.write( cc.debug( "Will sign via Transaction Manager with SSL options " ) + cc.j( rpcCallOpts ) + "\n" );
        }
        await rpcCall.create( joAccount.strTransactionManagerURL, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                const s = cc.fatal( "CRITICAL TRANSACTION SIGNING ERROR:" ) + cc.error( " JSON RPC call to Transaction Manager wallet failed" ) + "\n";
                if( verbose_get() >= RV_VERBOSE.error )
                    log.write( s );
                details.write( s );
                return; // process.exit( 155 );
            }
            const txAdjusted = JSON.parse( JSON.stringify( rawTx ) ); // tx // rawTx
            if( "chainId" in txAdjusted )
                delete txAdjusted.chainId;
            if( "gasLimit" in txAdjusted && ( ! ( "gas" in txAdjusted ) ) ) {
                txAdjusted.gas = txAdjusted.gasLimit;
                delete txAdjusted.gasLimit;
            }
            const joIn = {
                "transaction_dict": JSON.stringify( txAdjusted )
            };
            details.write( cc.debug( "Calling Transaction Manager to sign-and-send with " ) + cc.j( txAdjusted ) + "\n" );
            await joCall.call(
                joIn,
                // async
                function( joIn, joOut, err ) {
                    if( err ) {
                        const s = cc.fatal( "CRITICAL TRANSACTION SIGNING ERROR:" ) + cc.error( " JSON RPC call to Transaction Manager failed, error: " ) + cc.warning( err ) + "\n";
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        return; // process.exit( 156 );
                    }
                    details.write( cc.debug( "Transaction Manager sign-and-send result is: " ) + cc.j( joOut ) + "\n" );
                    if( joOut && "data" in joOut && joOut.data && "transaction_hash" in joOut.data )
                        joSR.txHashSent = "" + joOut.data.transaction_hash;
                    else {
                        const s = cc.fatal( "CRITICAL TRANSACTION SIGNING ERROR:" ) + cc.error( " JSON RPC call to Transaction Manager returned bad answer: " ) + cc.j( joOut ) + "\n";
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        return; // process.exit( 156 );
                    }
                } );
        } );
        await sleep( 5000 );
        await wait_for_transaction_receipt( details, w3, joSR.txHashSent );
        */
        details.write(
            cc.debug( "Will sign with Transaction Manager wallet, transaction is " ) + cc.j( tx ) +
            cc.debug( ", raw transaction is " ) + cc.j( rawTx ) + "\n" +
            cc.debug( " using account " ) + cc.j( joAccount ) + "\n"
        );
        const txAdjusted = JSON.parse( JSON.stringify( rawTx ) ); // tx // rawTx
        if( "chainId" in txAdjusted )
            delete txAdjusted.chainId;
        if( "gasLimit" in txAdjusted && ( ! ( "gas" in txAdjusted ) ) ) {
            txAdjusted.gas = txAdjusted.gasLimit;
            delete txAdjusted.gasLimit;
        }
        if( redis == null )
            redis = new Redis( joAccount.strTransactionManagerURL );
        const priority = joAccount.tm_priority || 5;
        const tx_id = await tm_send( details, txAdjusted, priority );
        const joReceipt = await tm_wait( details, tx_id, w3 );
        if( ! joReceipt ) {
            details.write( cc.error( "No receipt form Transaction Manager" ) + "\n" );
            throw new Error( "No receipt form Transaction Manager" );
        }
        joSR.txHashSent = "" + joReceipt.transactionHash;
        joSR.joReceipt = joReceipt;
        joSR.tm_tx_id = tx_id;
    } break;
    case "sgx": {
        details.write(
            cc.debug( "Will sign with SGX wallet, transaction is " ) + cc.j( tx ) +
            cc.debug( ", raw transaction is " ) + cc.j( rawTx ) + "\n" +
            cc.debug( " using account " ) + cc.j( joAccount ) + "\n"
        );
        let rpcCallOpts = null;
        if( "strPathSslKey" in joAccount && typeof joAccount.strPathSslKey == "string" && joAccount.strPathSslKey.length > 0 &&
            "strPathSslCert" in joAccount && typeof joAccount.strPathSslCert == "string" && joAccount.strPathSslCert.length > 0
        ) {
            rpcCallOpts = {
                "cert": fs.readFileSync( joAccount.strPathSslCert, "utf8" ),
                "key": fs.readFileSync( joAccount.strPathSslKey, "utf8" )
            };
            // details.write( cc.debug( "Will sign via SGX with SSL options " ) + cc.j( rpcCallOpts ) + "\n" );
        }
        await rpcCall.create( joAccount.strSgxURL, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                const s = cc.fatal( "CRITICAL TRANSACTION SIGNING ERROR:" ) + cc.error( " JSON RPC call to SGX wallet failed" ) + "\n";
                if( verbose_get() >= RV_VERBOSE.error )
                    log.write( s );
                details.write( s );
                return; // process.exit( 155 );
            }
            const msgHash = tx.hash( false );
            const strHash = msgHash.toString( "hex" );
            // details.write( cc.debug( "Transaction message hash is " ) + cc.j( msgHash ) + "\n" );
            const joIn = {
                "method": "ecdsaSignMessageHash",
                "params": {
                    "keyName": "" + joAccount.strSgxKeyName,
                    "messageHash": strHash, // "1122334455"
                    "base": 16 // 10
                }
            };
            details.write( cc.debug( "Calling SGX to sign using ECDSA key with: " ) + cc.j( joIn ) + "\n" );
            await joCall.call( joIn, /*async*/ function( joIn, joOut, err ) {
                if( err ) {
                    const s = cc.fatal( "CRITICAL TRANSACTION SIGNING ERROR:" ) + cc.error( " JSON RPC call to SGX wallet failed, error: " ) + cc.warning( err ) + "\n";
                    if( verbose_get() >= RV_VERBOSE.error )
                        log.write( s );
                    details.write( s );
                    return; // process.exit( 156 );
                }
                details.write( cc.debug( "SGX wallet ECDSA sign result is: " ) + cc.j( joOut ) + "\n" );
                const joNeededResult = {
                    // "v": Buffer.from( parseInt( joOut.result.signature_v, 10 ).toString( "hex" ), "utf8" ),
                    // "r": Buffer.from( "" + joOut.result.signature_r, "utf8" ),
                    // "s": Buffer.from( "" + joOut.result.signature_s, "utf8" )
                    "v": parseInt( joOut.result.signature_v, 10 ),
                    "r": "" + joOut.result.signature_r,
                    "s": "" + joOut.result.signature_s
                };
                details.write( cc.debug( "Sign result to assign into transaction is: " ) + cc.j( joNeededResult ) + "\n" );
                //
                // if( "_chainId" in tx && tx._chainId != null && tx._chainId != undefined )
                //     tx.v += tx._chainId * 2 + 8;
                // if( "_chainId" in tx && tx._chainId != null && tx._chainId != undefined )
                //     joNeededResult.v += tx._chainId * 2 + 8;
                // if( "_chainId" in tx && tx._chainId != null && tx._chainId != undefined )
                //     joNeededResult.v += tx._chainId * 2 + 8 + 27;
                let chainId = -4;
                // details.write( cc.debug( "...trying tx._chainId = " ) + cc.info( tx._chainId ) + "\n" );
                if( "_chainId" in tx && tx._chainId != null && tx._chainId != undefined ) {
                    chainId = tx._chainId;
                    if( chainId == 0 )
                        chainId = -4;
                }
                // details.write( cc.debug( "...applying chainId = " ) + cc.info( chainId ) + cc.debug( "to v = " ) + cc.info( joNeededResult.v )  + "\n" );
                // joNeededResult.v += chainId * 2 + 8 + 27;
                joNeededResult.v += chainId * 2 + 8 + 27;
                // details.write( cc.debug( "...result v =" ) + cc.info( joNeededResult.v ) + "\n" );
                //
                // joNeededResult.v = to_eth_v( joNeededResult.v, tx._chainId );
                //
                // Object.assign( tx, joNeededResult );
                tx.v = joNeededResult.v;
                tx.r = joNeededResult.r;
                tx.s = joNeededResult.s;
                details.write( cc.debug( "Resulting adjusted transaction is: " ) + cc.j( tx ) + "\n" );
            } );
        } );
        await sleep( 3000 );
    } break;
    case "direct": {
        details.write(
            cc.debug( "Will sign with private key, transaction is " ) + cc.notice( JSON.stringify( tx ) ) +
            cc.debug( ", raw transaction is " ) + cc.notice( JSON.stringify( rawTx ) ) + "\n" +
            cc.debug( " using account " ) + cc.j( joAccount ) + "\n"
        );
        const key = Buffer.from( joAccount.privateKey, "hex" ); // convert private key to buffer
        tx.sign( key ); // arg is privateKey as buffer
    } break;
    default: {
        const s = cc.fatal( "CRITICAL TRANSACTION SIGNING ERROR:" ) +
            cc.error( " bad credentials information specified, no explicit SGX and no explicit private key found, account is: " ) +
            cc.j( joAccount ) + "\n";
        details.write( s );
        log.write( s );
        if( isExitIfEmpty ) {
            details.exposeDetailsTo( log, "safe_sign_transaction_with_account", false );
            details.close();
            process.exit( 126 );
        }
    } break;
    } // switch( joSR.joACI.strType )
    details.write( cc.debug( "Signed transaction is " ) + cc.notice( JSON.stringify( tx ) ) + "\n" );
    joSR.tx = tx;
    return joSR;
}

async function safe_send_signed_transaction( details, w3, serializedTx, strActionName, strLogPrefix ) {
    details.write( cc.attention( "SEND TRANSACTION" ) + cc.normal( " is using " ) + cc.bright( "Web3" ) + cc.normal( " version " ) + cc.sunny( w3.version ) + "\n" );
    details.write( strLogPrefix + cc.debug( "....signed serialized TX is " ) + cc.notice( JSON.stringify( serializedTx ) ) + "\n" );
    const strTX = "0x" + serializedTx.toString( "hex" ); // strTX is string starting from "0x"
    details.write( strLogPrefix + cc.debug( "....signed raw TX is " ) + cc.j( strTX ) + "\n" );
    let joReceipt = null;
    let bHaveReceipt = false;
    try {
        joReceipt = await w3.eth.sendSignedTransaction( strTX );
        bHaveReceipt = ( joReceipt != null );
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "WARNING:" ) + cc.warning( " first attempt to send signed transaction failure during " + strActionName + ": " ) + cc.sunny( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
    }
    if( !bHaveReceipt ) {
        try {
            joReceipt = await w3.eth.sendSignedTransaction( strTX );
        } catch ( err ) {
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " second attempt to send signed transaction failure during " + strActionName + ": " ) + cc.error( err ) + "\n";
            if( verbose_get() >= RV_VERBOSE.fatal )
                log.write( s );
            details.write( s );
            throw err;
        }
    }
    return joReceipt;
}

//
// register direction for money transfer
// main-net.DepositBox call: function addSchain(string schainName, address tokenManagerAddress)
//
async function check_is_registered_s_chain_in_deposit_boxes( // step 1
    w3_main_net,
    jo_linker,
    joAccount_main_net,
    chain_id_s_chain
) {
    const details = log.createMemoryStream();
    details.write( cc.info( "Main-net " ) + cc.sunny( "Linker" ) + cc.info( "  address is....." ) + cc.bright( jo_linker.options.address ) + "\n" );
    details.write( cc.info( "S-Chain  " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) + cc.bright( chain_id_s_chain ) + "\n" );
    const strLogPrefix = cc.note( "RegChk S in depositBox:" ) + " ";
    details.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    details.write( strLogPrefix + cc.bright( "check_is_registered_s_chain_in_deposit_boxes(reg-step1)" ) + "\n" );
    details.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    let strActionName = "";
    try {
        strActionName = "check_is_registered_s_chain_in_deposit_boxes(reg-step1)";
        const addressFrom = joAccount_main_net.address( w3_main_net );
        const bIsRegistered = await jo_linker.methods.hasSchain( chain_id_s_chain ).call( {
            from: addressFrom
        } );
        details.write( strLogPrefix + cc.success( "check_is_registered_s_chain_in_deposit_boxes(reg-step1) status is: " ) + cc.attention( bIsRegistered ) + "\n" );
        if( expose_details_get() )
            details.exposeDetailsTo( log, "check_is_registered_s_chain_in_deposit_boxes", true );
        details.close();
        return bIsRegistered;
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in check_is_registered_s_chain_in_deposit_boxes(reg-step1)() during " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "check_is_registered_s_chain_in_deposit_boxes", false );
        details.close();
    }
    return false;
}

async function invoke_has_chain(
    details,
    w3, // Main-Net or S-Chin
    jo_linker, // Main-Net or S-Chin
    joAccount, // Main-Net or S-Chin
    chain_id_s_chain
) {
    const strLogPrefix = cc.sunny( "Wait for added chain status:" ) + " ";
    let strActionName = "";
    try {
        strActionName = "invoke_has_chain(hasSchain): jo_linker.hasSchain";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const addressFrom = joAccount.address( w3 );
        const bHasSchain = await jo_linker.methods.hasSchain(
            chain_id_s_chain
        ).call( {
            from: addressFrom
        } );
        details.write( strLogPrefix + cc.success( "Got jo_linker.hasSchain() status is: " ) + cc.attention( bHasSchain ) + "\n" );
        return bHasSchain;
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( "Error in register_s_chain_in_deposit_boxes(reg-step1)() during " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
    }
    return false;
}

async function wait_for_has_chain(
    details,
    w3, // Main-Net or S-Chin
    jo_linker, // Main-Net or S-Chin
    joAccount, // Main-Net or S-Chin
    chain_id_s_chain,
    cntWaitAttempts,
    nSleepMilliseconds
) {
    if( cntWaitAttempts == null || cntWaitAttempts == undefined )
        cntWaitAttempts = 100;
    if( nSleepMilliseconds == null || nSleepMilliseconds == undefined )
        nSleepMilliseconds = 5;
    for( let idxWaitAttempts = 0; idxWaitAttempts < cntWaitAttempts; ++ idxWaitAttempts ) {
        if( await invoke_has_chain( details, w3, jo_linker, joAccount, chain_id_s_chain ) )
            return true;
        details.write( cc.normal( "Sleeping " ) + cc.info( nSleepMilliseconds ) + cc.normal( " milliseconds..." ) + "\n" );
        await sleep( nSleepMilliseconds );
    }
    return false;
}

async function register_s_chain_in_deposit_boxes( // step 1
    w3_main_net,
    // jo_deposit_box_eth, // only main net
    // jo_deposit_box_erc20, // only main net
    // jo_deposit_box_erc721, // only main net
    jo_linker,
    joAccount_main_net,
    jo_token_manager_eth, // only s-chain
    jo_token_manager_erc20, // only s-chain
    jo_token_manager_erc721, // only s-chain
    jo_token_manager_erc1155, // only s-chain
    jo_community_locker, // only s-chain
    jo_token_manager_linker,
    chain_id_s_chain,
    cid_main_net,
    tc_main_net,
    cntWaitAttempts,
    nSleepMilliseconds
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // register_s_chain_in_deposit_boxes
    details.write( cc.info( "Main-net " ) + cc.sunny( "Linker" ) + cc.info( "  address is......." ) + cc.bright( jo_linker.options.address ) + "\n" );
    details.write( cc.info( "S-Chain  " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) + cc.bright( chain_id_s_chain ) + "\n" );
    const strLogPrefix = cc.sunny( "Reg S in depositBoxes:" ) + " ";
    details.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    details.write( strLogPrefix + cc.bright( "reg-step1:register_s_chain_in_deposit_boxes" ) + "\n" );
    details.write( strLogPrefix + cc.debug( g_mtaStrLongSeparator ) + "\n" );
    let strActionName = "";
    try {
        strActionName = "reg-step1:w3_main_net.eth.getTransactionCount()";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await get_web3_transactionCount( details, 10, w3_main_net, joAccount_main_net.address( w3_main_net ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        details.write( strLogPrefix + cc.debug( "Will register S-Chain in lock_and_data on Main-net" ) + "\n" );
        const methodWithArguments = jo_linker.methods.connectSchain(
            chain_id_s_chain,
            [
                jo_token_manager_linker.options.address, // call params
                jo_community_locker.options.address, // call params
                jo_token_manager_eth.options.address, // call params
                jo_token_manager_erc20.options.address, // call params
                jo_token_manager_erc721.options.address, // call params
                jo_token_manager_erc1155.options.address // call params
            ]
        );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        const estimatedGas = await tc_main_net.computeGas( methodWithArguments, w3_main_net, 3000000, gasPrice, joAccount_main_net.address( w3_main_net ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        //
        const isIgnore = false;
        const strDRC = "register_s_chain_in_deposit_boxes, step 1, connectSchain";
        await dry_run_call( details, w3_main_net, methodWithArguments, joAccount_main_net, strDRC, isIgnore, gasPrice, estimatedGas, "0" );
        //
        const rawTx = {
            chainId: cid_main_net,
            nonce: tcnt,
            gasPrice: gasPrice,
            // gasLimit: estimatedGas,
            gas: estimatedGas, // gas is optional here
            to: jo_linker.options.address, // contract address
            data: dataTx
        };
        const tx = compose_tx_instance( details, strLogPrefix, rawTx );
        const joSR = await safe_sign_transaction_with_account( details, w3_main_net, tx, rawTx, joAccount_main_net );
        let joReceipt = null;
        if( joSR.joACI.isAutoSend )
            joReceipt = await get_web3_transactionReceipt( details, 10, w3_main_net, joSR.txHashSent );
        else {
            const serializedTx = tx.serialize();
            strActionName = "reg-step1:w3_main_net.eth.sendSignedTransaction()";
            // let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
            joReceipt = await safe_send_signed_transaction( details, w3_main_net, serializedTx, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );

        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "register_s_chain_in_deposit_boxes",
                "receipt": joReceipt
            } );
        }
        // } else
        // details.write( strLogPrefix + cc.debug( "Will wait until S-Chain owner will register S-Chain in ima-linker on Main-net" ) + "\n" );
        const isSChainStatusOKay = await wait_for_has_chain(
            details,
            w3_main_net,
            jo_linker,
            joAccount_main_net,
            chain_id_s_chain,
            cntWaitAttempts,
            nSleepMilliseconds
        );
        if( ! isSChainStatusOKay )
            throw new Error( "S-Chain ownership status check timeout" );
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in register_s_chain_in_deposit_boxes() during " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "register_s_chain_in_deposit_boxes", false );
        details.close();
        return null;
    }
    if( expose_details_get() )
        details.exposeDetailsTo( log, "register_s_chain_in_deposit_boxes", true );
    details.close();
    return jarrReceipts;
} // async function register_deposit_box_on_s_chain(...

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function reimbursement_show_balance(
    w3_main_net,
    jo_community_pool,
    joAccount_main_net,
    strChainName_main_net,
    cid_main_net,
    tc_main_net,
    strReimbursementChain,
    isForcePrintOut
) {
    const details = log.createMemoryStream();
    let s = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Show Balance" ) + " ";
    try {
        details.write( strLogPrefix + cc.debug( "Querying wallet " ) + cc.notice( strReimbursementChain ) + cc.debug( " balance..." ) + "\n" );
        const addressFrom = joAccount_main_net.address( w3_main_net );
        const xWei = await jo_community_pool.methods.getBalance( strReimbursementChain ).call( {
            from: addressFrom
        } );
        //
        s = strLogPrefix + cc.success( "Balance(wei): " ) + cc.attention( xWei ) + "\n";
        if( isForcePrintOut || verbose_get() >= RV_VERBOSE.information )
            log.write( s );
        details.write( s );
        //
        const xEth = w3_main_net.utils.fromWei( xWei, "ether" );
        s = strLogPrefix + cc.success( "Balance(eth): " ) + cc.attention( xEth ) + "\n";
        if( isForcePrintOut || verbose_get() >= RV_VERBOSE.information )
            log.write( s );
        details.write( s );
        //
        if( expose_details_get() )
            details.exposeDetailsTo( log, "reimbursement_show_balance", true );
        details.close();
        return xWei;
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in reimbursement_show_balance(): " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "reimbursement_show_balance", false );
        details.close();
        return 0;
    }
}

async function reimbursement_wallet_recharge(
    w3_main_net,
    jo_community_pool,
    joAccount_main_net,
    strChainName_main_net,
    cid_main_net,
    tc_main_net,
    strReimbursementChain,
    nReimbursementRecharge
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // reimbursement_wallet_recharge
    let strActionName = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Wallet Recharge" ) + " ";
    try {
        details.write( strLogPrefix + cc.debug( "Recharging wallet " ) + cc.notice( strReimbursementChain ) + cc.debug( "..." ) + "\n" );
        //
        strActionName = "w3_main_net.eth.getTransactionCount()";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await get_web3_transactionCount( details, 10, w3_main_net, joAccount_main_net.address( w3_main_net ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        const methodWithArguments = jo_community_pool.methods.rechargeUserWallet(
            // call params, last is destination account on S-chain
            strReimbursementChain
        );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        const estimatedGas = await tc_main_net.computeGas( methodWithArguments, w3_main_net, 3000000, gasPrice, joAccount_main_net.address( w3_main_net ), nReimbursementRecharge );
        details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        //
        const isIgnore = false;
        const strDRC = "reimbursement_wallet_recharge";
        await dry_run_call( details, w3_main_net, methodWithArguments, joAccount_main_net, strDRC, isIgnore, gasPrice, estimatedGas, nReimbursementRecharge );
        //
        const rawTx = {
            chainId: cid_main_net,
            nonce: tcnt,
            gasPrice: gasPrice,
            // gasLimit: estimatedGas,
            gas: estimatedGas,
            to: jo_community_pool.options.address, // contract address
            data: dataTx,
            value: "0x" + w3_main_net.utils.toBN( nReimbursementRecharge ).toString( 16 ) // wei_how_much // how much money to send
        };
        const tx = compose_tx_instance( details, strLogPrefix, rawTx );
        const joSR = await safe_sign_transaction_with_account( details, w3_main_net, tx, rawTx, joAccount_main_net );
        let joReceipt = null;
        if( joSR.joACI.isAutoSend )
            joReceipt = await get_web3_transactionReceipt( details, 10, w3_main_net, joSR.txHashSent );
        else {
            const serializedTx = tx.serialize();
            strActionName = "w3_main_net.eth.sendSignedTransaction()";
            // let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
            joReceipt = await safe_send_signed_transaction( details, w3_main_net, serializedTx, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "reimbursement_wallet_recharge",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "reimbursement_wallet_recharge", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "REIMBURSEMENT_WALLET_RECHARGE", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "reimbursement_wallet_recharge", true );
    details.close();
    return true;
}

async function reimbursement_wallet_withdraw(
    w3_main_net,
    jo_community_pool,
    joAccount_main_net,
    strChainName_main_net,
    cid_main_net,
    tc_main_net,
    strReimbursementChain,
    nReimbursementWithdraw
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // reimbursement_wallet_withdraw
    let strActionName = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Wallet Withdraw" ) + " ";
    const wei_how_much = 0;
    try {
        details.write( strLogPrefix + cc.debug( "Recharging wallet " ) + cc.notice( strReimbursementChain ) + cc.debug( "..." ) + "\n" );
        //
        strActionName = "w3_main_net.eth.getTransactionCount()";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await get_web3_transactionCount( details, 10, w3_main_net, joAccount_main_net.address( w3_main_net ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        const methodWithArguments = jo_community_pool.methods.withdrawFunds(
            // call params, last is destination account on S-chain
            strReimbursementChain,
            "0x" + w3_main_net.utils.toBN( nReimbursementWithdraw ).toString( 16 )
        );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        const estimatedGas = await tc_main_net.computeGas( methodWithArguments, w3_main_net, 3000000, gasPrice, joAccount_main_net.address( w3_main_net ), wei_how_much );
        details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        //
        const isIgnore = false;
        const strDRC = "reimbursement_wallet_withdraw";
        await dry_run_call( details, w3_main_net, methodWithArguments, joAccount_main_net, strDRC, isIgnore, gasPrice, estimatedGas, wei_how_much );
        //
        const rawTx = {
            chainId: cid_main_net,
            nonce: tcnt,
            gasPrice: gasPrice,
            // gasLimit: estimatedGas,
            gas: estimatedGas,
            to: jo_community_pool.options.address, // contract address
            data: dataTx,
            value: "0x" + w3_main_net.utils.toBN( wei_how_much ).toString( 16 ) // wei_how_much // how much money to send
        };
        const tx = compose_tx_instance( details, strLogPrefix, rawTx );
        const joSR = await safe_sign_transaction_with_account( details, w3_main_net, tx, rawTx, joAccount_main_net );
        let joReceipt = null;
        if( joSR.joACI.isAutoSend )
            joReceipt = await get_web3_transactionReceipt( details, 10, w3_main_net, joSR.txHashSent );
        else {
            const serializedTx = tx.serialize();
            strActionName = "w3_main_net.eth.sendSignedTransaction()";
            // let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
            joReceipt = await safe_send_signed_transaction( details, w3_main_net, serializedTx, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "reimbursement_wallet_withdraw",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "reimbursement_wallet_withdraw", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "REIMBURSEMENT_WALLET_WITHDRAW", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "reimbursement_wallet_withdraw", true );
    details.close();
    return true;
}

async function reimbursement_set_range(
    w3_s_chain,
    jo_community_locker,
    joAccount_s_chain,
    strChainName_s_chain,
    cid_s_chain,
    tc_s_chain,
    nReimbursementRange
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // reimbursement_set_range
    let strActionName = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Set Minimal time interval from S2M transfers" ) + " ";
    const wei_how_much = 0;
    try {
        details.write( strLogPrefix + cc.debug( "Setting minimal S2M interval to " ) + cc.notice( nReimbursementRange ) + cc.debug( "..." ) + "\n" );
        //
        strActionName = "w3_s_chain.eth.getTransactionCount()";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await get_web3_transactionCount( details, 10, w3_s_chain, joAccount_s_chain.address( w3_s_chain ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        const methodWithArguments = jo_community_locker.methods.setTimeLimitPerMessage(
            // call params, last is destination account on S-chain
            "0x" + w3_s_chain.utils.toBN( nReimbursementRange ).toString( 16 )
        );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        const estimatedGas = await tc_s_chain.computeGas( methodWithArguments, w3_s_chain, 3000000, gasPrice, joAccount_s_chain.address( w3_s_chain ), wei_how_much );
        details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        //
        const isIgnore = false;
        const strDRC = "reimbursement_set_range";
        await dry_run_call( details, w3_s_chain, methodWithArguments, joAccount_s_chain, strDRC, isIgnore, gasPrice, estimatedGas, wei_how_much );
        //
        const rawTx = {
            chainId: cid_s_chain,
            nonce: tcnt,
            gasPrice: gasPrice,
            // gasLimit: estimatedGas,
            gas: estimatedGas,
            to: jo_community_locker.options.address, // contract address
            data: dataTx,
            value: 0 // how much money to send
        };
        const tx = compose_tx_instance( details, strLogPrefix, rawTx );
        const joSR = await safe_sign_transaction_with_account( details, w3_s_chain, tx, rawTx, joAccount_s_chain );
        let joReceipt = null;
        if( joSR.joACI.isAutoSend )
            joReceipt = await get_web3_transactionReceipt( details, 10, w3_s_chain, joSR.txHashSent );
        else {
            const serializedTx = tx.serialize();
            strActionName = "w3_s_chain.eth.sendSignedTransaction()";
            // let joReceipt = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
            joReceipt = await safe_send_signed_transaction( details, w3_s_chain, serializedTx, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "reimbursement_set_range",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "reimbursement_set_range", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "REIMBURSEMENT_SET_RANGE", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "reimbursement_set_range", true );
    details.close();
    return true;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// transfer money from main-net to S-chain
// main-net.DepositBox call: function deposit(string schainName, address to) public payable
// Where:
//   schainName...obvious
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
    chain_id_s_chain,
    wei_how_much, // how much WEI money to send
    tc_main_net
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // do_eth_payment_from_main_net
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ETH Payment:" ) + " ";
    try {
        details.write( strLogPrefix + cc.debug( "Doing payment from mainnet with " ) + cc.notice( "chain_id_s_chain" ) + cc.debug( "=" ) + cc.notice( chain_id_s_chain ) + cc.debug( "..." ) + "\n" );
        //
        strActionName = "w3_main_net.eth.getTransactionCount()";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await get_web3_transactionCount( details, 10, w3_main_net, joAccountSrc.address( w3_main_net ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        const methodWithArguments = jo_deposit_box.methods.deposit(
            // call params, last is destination account on S-chain
            chain_id_s_chain, joAccountDst.address( w3_main_net )
        );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        const estimatedGas = await tc_main_net.computeGas( methodWithArguments, w3_main_net, 3000000, gasPrice, joAccountSrc.address( w3_main_net ), wei_how_much );
        details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        //
        const isIgnore = false;
        const strDRC = "do_eth_payment_from_main_net, deposit";
        await dry_run_call( details, w3_main_net, methodWithArguments, joAccountSrc, strDRC, isIgnore, gasPrice, estimatedGas, wei_how_much );
        //
        const rawTx = {
            chainId: cid_main_net,
            nonce: tcnt,
            gasPrice: gasPrice,
            // gasLimit: estimatedGas,
            gas: estimatedGas,
            to: jo_deposit_box.options.address, // contract address
            data: dataTx,
            value: "0x" + w3_main_net.utils.toBN( wei_how_much ).toString( 16 ) // wei_how_much // how much money to send
        };
        const tx = compose_tx_instance( details, strLogPrefix, rawTx );
        const joSR = await safe_sign_transaction_with_account( details, w3_main_net, tx, rawTx, joAccountSrc );
        let joReceipt = null;
        if( joSR.joACI.isAutoSend )
            joReceipt = await get_web3_transactionReceipt( details, 10, w3_main_net, joSR.txHashSent );
        else {
            const serializedTx = tx.serialize();
            strActionName = "w3_main_net.eth.sendSignedTransaction()";
            // let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
            joReceipt = await safe_send_signed_transaction( details, w3_main_net, serializedTx, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
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
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.debug( " contract ..." ) + "\n" );
            await sleep( g_nSleepBeforeFetchOutgoingMessageEvent );
            const joEvents = await get_contract_call_events( details, w3_main_net, jo_message_proxy_main_net, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_main_net.options.address + " contract, no events found" );
        } // if( jo_message_proxy_main_net )
        if( jo_deposit_box ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "DepositBox" ) + cc.debug( "/" ) + cc.notice( jo_deposit_box.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( details, w3_main_net, jo_deposit_box, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length == 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box.options.address ) + cc.success( " contract, no event found" ) + "\n" );
            else
                throw new Error( "Verification failed for the \"Error\" event of the \"DepositBox\"/" + jo_deposit_box.options.address + " contract, no events found" );
        } // if( jo_deposit_box )
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "do_eth_payment_from_main_net", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "ETH PAYMENT FROM MAIN NET", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "do_eth_payment_from_main_net", true );
    details.close();
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
    jo_token_manager_eth,
    jo_message_proxy_s_chain, // for checking logs
    wei_how_much, // how much WEI money to send
    tc_s_chain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // do_eth_payment_from_s_chain
    let strActionName = ""; const strLogPrefix = cc.info( "S2M ETH Payment:" ) + " ";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_eth_payment_from_s_chain";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        //
        let gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" ); //
        //
        const tcnt = await get_web3_transactionCount( details, 10, w3_s_chain, joAccountSrc.address( w3_s_chain ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "jo_token_manager_eth.methods.exitToMain()/do_eth_payment_from_s_chain";
        const methodWithArguments = jo_token_manager_eth.methods.exitToMain(
            // call params, last is destination account on S-chain
            joAccountDst.address( w3_s_chain ),
            "0x" + w3_s_chain.utils.toBN( wei_how_much ).toString( 16 )
        );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" ); //
        //
        const estimatedGas = await tc_s_chain.computeGas( methodWithArguments, w3_s_chain, 6000000, gasPrice, joAccountSrc.address( w3_s_chain ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        //
        const isIgnore = true;
        const strDRC = "do_eth_payment_from_s_chain, exitToMain";
        await dry_run_call( details, w3_s_chain, methodWithArguments, joAccountSrc, strDRC, isIgnore, gasPrice, estimatedGas, "0" );
        //
        const rawTx = {
            chainId: cid_s_chain,
            nonce: tcnt,
            gasPrice: gasPrice,
            // "gasLimit": 3000000,
            gas: estimatedGas,
            to: jo_token_manager_eth.options.address, // contract address
            data: dataTx,
            value: 0 // how much money to send
        };
        const tx = compose_tx_instance( details, strLogPrefix, rawTx );
        const joSR = await safe_sign_transaction_with_account( details, w3_s_chain, tx, rawTx, joAccountSrc );
        let joReceipt = null;
        if( joSR.joACI.isAutoSend )
            joReceipt = await get_web3_transactionReceipt( details, 10, w3_s_chain, joSR.txHashSent );
        else {
            const serializedTx = tx.serialize();
            strActionName = "w3_s_chain.eth.sendSignedTransaction()";
            // let joReceipt = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
            joReceipt = await safe_send_signed_transaction( details, w3_s_chain, serializedTx, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
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
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.debug( " contract ..." ) + "\n" );
            await sleep( g_nSleepBeforeFetchOutgoingMessageEvent );
            const joEvents = await get_contract_call_events( details, w3_s_chain, jo_message_proxy_s_chain, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_s_chain.options.address + " contract, no events found" );
        } // if( jo_message_proxy_s_chain )
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "do_eth_payment_from_s_chain", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "ETH PAYMENT FROM S-CHAIN", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "do_eth_payment_from_s_chain", true );
    details.close();
    return true;
} // async function do_eth_payment_from_s_chain(...

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
async function receive_eth_payment_from_s_chain_on_main_net(
    w3_main_net,
    cid_main_net,
    joAccount_main_net,
    jo_deposit_box_eth,
    tc_main_net
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // receive_eth_payment_from_s_chain_on_main_net
    let strActionName = ""; const strLogPrefix = cc.info( "M2S ETH Receive:" ) + " ";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/receive_eth_payment_from_s_chain_on_main_net";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await get_web3_transactionCount( details, 10, w3_main_net, joAccount_main_net.address( w3_main_net ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        const methodWithArguments = jo_deposit_box_eth.methods.getMyEth(
            // call params(empty)
        );
        const dataTx = methodWithArguments.encodeABI(); // the encoded ABI of the method
        //
        const gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        const estimatedGas = await tc_main_net.computeGas( methodWithArguments, w3_main_net, 3000000, gasPrice, joAccount_main_net.address( w3_main_net ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        //
        const isIgnore = false;
        const strDRC = "receive_eth_payment_from_s_chain_on_main_net, getMyEth";
        await dry_run_call( details, w3_main_net, methodWithArguments, joAccount_main_net, strDRC, isIgnore, gasPrice, estimatedGas, "0" );
        //
        const rawTx = {
            chainId: cid_main_net,
            nonce: tcnt,
            gas: estimatedGas, // 2100000
            gasPrice: gasPrice,
            // gasLimit: estimatedGas, // 3000000
            to: jo_deposit_box_eth.options.address, // contract address
            data: dataTx,
            value: 0 // how much money to send
        };
        const tx = compose_tx_instance( details, strLogPrefix, rawTx );
        const joSR = await safe_sign_transaction_with_account( details, w3_main_net, tx, rawTx, joAccount_main_net );
        let joReceipt = null;
        if( joSR.joACI.isAutoSend )
            joReceipt = await get_web3_transactionReceipt( details, 10, w3_main_net, joSR.txHashSent );
        else {
            const serializedTx = tx.serialize();
            strActionName = "w3_main_net.eth.sendSignedTransaction()";
            // let joReceipt = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTx.toString( "hex" ) );
            joReceipt = await safe_send_signed_transaction( details, w3_main_net, serializedTx, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );
        if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
            jarrReceipts.push( {
                "description": "receive_eth_payment_from_s_chain_on_main_net",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Receive payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "receive_eth_payment_from_s_chain_on_main_net", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "RECEIVE ETH ON MAIN NET", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "receive_eth_payment_from_s_chain_on_main_net", true );
    details.close();
    return true;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function view_eth_payment_from_s_chain_on_main_net(
    w3_main_net,
    joAccount_main_net,
    jo_deposit_box_eth
) {
    const details = log.createMemoryStream();
    let strActionName = ""; const strLogPrefix = cc.info( "S ETH View:" ) + " ";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/view_eth_payment_from_s_chain_on_main_net";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const tcnt = await get_web3_transactionCount( details, 10, w3_main_net, joAccount_main_net.address( w3_main_net ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        const addressFrom = joAccount_main_net.address( w3_main_net );
        const xWei = await jo_deposit_box_eth.methods.approveTransfers( addressFrom ).call( {
            from: addressFrom
        } );
        details.write( strLogPrefix + cc.success( "You can receive(wei): " ) + cc.attention( xWei ) + "\n" );
        const xEth = w3_main_net.utils.fromWei( xWei, "ether" );
        const s = strLogPrefix + cc.success( "You can receive(eth): " ) + cc.attention( xEth ) + "\n";
        if( verbose_get() >= RV_VERBOSE.information )
            log.write( s );
        details.write( s );
        if( expose_details_get() )
            details.exposeDetailsTo( log, "view_eth_payment_from_s_chain_on_main_net", true );
        details.close();
        return xWei;
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " View payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "view_eth_payment_from_s_chain_on_main_net", false );
        details.close();
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
    jo_deposit_box_erc721,
    jo_message_proxy_main_net, // for checking logs
    chain_id_s_chain,
    token_id, // which ERC721 token id to send
    wei_how_much, // how much ETH
    jo_token_manager_erc721, // only s-chain
    strCoinNameErc721_main_net,
    erc721PrivateTestnetJson_main_net,
    strCoinNameErc721_s_chain,
    erc721PrivateTestnetJson_s_chain,
    tc_main_net
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // do_erc721_payment_from_main_net
    let strActionName = ""; const strLogPrefix = cc.info( "M2S ERC721 Payment:" ) + " ";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/do_erc721_payment_from_main_net";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await get_web3_transactionCount( details, 10, w3_main_net, joAccountSrc.address( w3_main_net ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "ERC721 prepare M->S";
        const erc721ABI = erc721PrivateTestnetJson_main_net[strCoinNameErc721_main_net + "_abi"];
        const erc721Address_main_net = erc721PrivateTestnetJson_main_net[strCoinNameErc721_main_net + "_address"];
        const contractERC721 = new w3_main_net.eth.Contract( erc721ABI, erc721Address_main_net );
        // prepare the smart contract function deposit(string schainName, address to)
        const depositBoxAddress = jo_deposit_box_erc721.options.address;
        const accountForSchain = joAccountDst.address( w3_s_chain );
        const methodWithArguments_approve = contractERC721.methods.approve( // same as approve in 20
            // joAccountSrc.address( w3_main_net ),
            depositBoxAddress,
            "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 )
        );
        const dataTxApprove = methodWithArguments_approve.encodeABI();
        let dataTxDeposit = null;
        const methodWithArguments_rawDepositERC721 = jo_deposit_box_erc721.methods.depositERC721(
            chain_id_s_chain,
            erc721Address_main_net,
            accountForSchain,
            "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 )
        );
        dataTxDeposit = methodWithArguments_rawDepositERC721.encodeABI();
        //
        //
        strActionName = "compute gas price for ERC721 transactions M->S";
        let gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        //
        strActionName = "create ERC721/approve transaction M->S";
        const estimatedGas_approve = await tc_main_net.computeGas( methodWithArguments_approve, w3_main_net, 8000000, gasPrice, joAccountSrc.address( w3_main_net ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_approve ) + "\n" );
        //
        const isIgnore_approve = false;
        const strDRC_approve = "do_erc721_payment_from_main_net, approve";
        await dry_run_call( details, w3_main_net, methodWithArguments_approve, joAccountSrc, strDRC_approve, isIgnore_approve, gasPrice, estimatedGas_approve, "0" );
        //
        const rawTxApprove = {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ),
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxApprove,
            to: erc721Address_main_net,
            gasPrice: gasPrice,
            gas: estimatedGas_approve
        };
        const txApprove = compose_tx_instance( details, strLogPrefix, rawTxApprove );
        strActionName = "sign ERC721/approve transaction M->S";
        const joApproveSR = await safe_sign_transaction_with_account( details, w3_main_net, txApprove, rawTxApprove, joAccountSrc );
        let joReceiptApprove = null;
        if( joApproveSR.joACI.isAutoSend )
            joReceiptApprove = await get_web3_transactionReceipt( details, 10, w3_main_net, joApproveSR.txHashSent );
        else {
            const serializedTxApprove = txApprove.serialize();
            details.write( cc.normal( "Will send ERC721/approve signed transaction from " ) + cc.warning( joAccountSrc.address( w3_main_net ) ) + "\n" );
            strActionName = "w3_main_net.eth.sendSignedTransaction()/Approve";
            // let joReceiptApprove = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
            joReceiptApprove = await safe_send_signed_transaction( details, w3_main_net, serializedTxApprove, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        if( joReceiptApprove && typeof joReceiptApprove == "object" && "gasUsed" in joReceiptApprove ) {
            jarrReceipts.push( {
                "description": "do_erc721_payment_from_main_net/approve",
                "receipt": joReceiptApprove
            } );
        }
        //
        //
        strActionName = "create ERC721/deposit transaction M->S";
        tcnt += 1;
        //
        gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const estimatedGas_deposit = await tc_main_net.computeGas( methodWithArguments_rawDepositERC721, w3_main_net, 8000000, gasPrice, joAccountSrc.address( w3_main_net ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(deposit) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_deposit ) + "\n" );
        //
        const isIgnore_rawDepositERC721 = true;
        const strDRC_rawDepositERC721 = "do_erc721_payment_from_main_net, rawDepositERC721";
        await dry_run_call( details, w3_main_net, methodWithArguments_rawDepositERC721, joAccountSrc, strDRC_rawDepositERC721, isIgnore_rawDepositERC721, gasPrice, estimatedGas_deposit, "0" );
        //
        const rawTxDeposit = {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ),
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxDeposit,
            to: depositBoxAddress,
            gasPrice: gasPrice,
            gas: estimatedGas_deposit
            // value: "0x" + w3_main_net.utils.toBN( wei_how_much ).toString( 16 )
            //, value: 2000000000000000 // w3_dst.utils.toWei( (1).toString(), "ether" )
        };
        const txDeposit = compose_tx_instance( details, strLogPrefix, rawTxDeposit );
        strActionName = "sign ERC721/deposit transaction M->S";
        const joDepositSR = await safe_sign_transaction_with_account( details, w3_main_net, txDeposit, rawTxDeposit, joAccountSrc );
        let joReceiptDeposit = null;
        if( joDepositSR.joACI.isAutoSend )
            joReceiptDeposit = await get_web3_transactionReceipt( details, 10, w3_main_net, joDepositSR.txHashSent );
        else {
            const serializedTxDeposit = txDeposit.serialize();
            // send transactions
            details.write( cc.normal( "Will send ERC721/deposit signed transaction from " ) + cc.warning( joAccountSrc.address( w3_main_net ) ) + "\n" );
            strActionName = "w3_main_net.eth.sendSignedTransaction()/Deposit";
            // let joReceiptDeposit = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString( "hex" ) );
            joReceiptDeposit = await safe_send_signed_transaction( details, w3_main_net, serializedTxDeposit, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Deposit: " ) + cc.j( joReceiptDeposit ) + "\n" );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" && "gasUsed" in joReceiptDeposit ) {
            jarrReceipts.push( {
                "description": "do_erc721_payment_from_main_net/deposit",
                "receipt": joReceiptDeposit
            } );
        }
        //
        //
        const joReceipt = joReceiptDeposit;
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_main_net ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.debug( " contract ..." ) + "\n" );
            await sleep( g_nSleepBeforeFetchOutgoingMessageEvent );
            const joEvents = await get_contract_call_events( details, w3_main_net, jo_message_proxy_main_net, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_main_net.options.address + " contract, no events found" );
        } // if( jo_message_proxy_main_net )
        if( jo_deposit_box_erc721 ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "DepositBox" ) + cc.debug( "/" ) + cc.notice( jo_deposit_box_erc721.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( details, w3_main_net, jo_deposit_box_erc721, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length == 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box_erc721.options.address ) + cc.success( " contract, no event found" ) + "\n" );
            else
                throw new Error( "Verification failed for the \"Error\" event of the \"DepositBox\"/" + jo_deposit_box_erc721.options.address + " contract, no events found" );
        } // if( jo_deposit_box )
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "do_erc721_payment_from_main_net", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "ERC-721 PAYMENT FROM MAIN NET", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "do_erc721_payment_from_main_net", true );
    details.close();
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
    jo_deposit_box_erc20,
    jo_message_proxy_main_net, // for checking logs
    chain_id_s_chain,
    token_amount, // how much ERC20 tokens to send
    wei_how_much, // how much ETH
    jo_token_manager_erc20, // only s-chain
    strCoinNameErc20_main_net,
    erc20PrivateTestnetJson_main_net,
    strCoinNameErc20_s_chain,
    erc20PrivateTestnetJson_s_chain,
    tc_main_net
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // do_erc20_payment_from_main_net
    let strActionName = ""; const strLogPrefix = cc.info( "M2S ERC20 Payment:" ) + " ";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/do_erc20_payment_from_main_net";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await get_web3_transactionCount( details, 10, w3_main_net, joAccountSrc.address( w3_main_net ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "ERC20 prepare M->S";
        const erc20ABI = erc20PrivateTestnetJson_main_net[strCoinNameErc20_main_net + "_abi"];
        // details.write( strLogPrefix + cc.normal("erc20PrivateTestnetJson_main_net = ") + cc.j(erc20PrivateTestnetJson_main_net) + "\n" )
        // details.write( strLogPrefix + cc.normal("strCoinNameErc20_main_net = ") + cc.info(strCoinNameErc20_main_net) + "\n" )
        const erc20Address_main_net = erc20PrivateTestnetJson_main_net[strCoinNameErc20_main_net + "_address"];
        // details.write( strLogPrefix + cc.normal("erc20Address_main_net = ") + cc.info(erc20Address_main_net) + "\n" )
        const contractERC20 = new w3_main_net.eth.Contract( erc20ABI, erc20Address_main_net );
        // prepare the smart contract function deposit(string schainName, address to)
        const depositBoxAddress = jo_deposit_box_erc20.options.address;
        const accountForSchain = joAccountDst.address( w3_s_chain );
        const methodWithArguments_approve = contractERC20.methods.approve(
            depositBoxAddress, "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
        );
        const dataTxApprove = methodWithArguments_approve.encodeABI();
        let dataTxDeposit = null;
        const methodWithArguments_rawDepositERC20 = jo_deposit_box_erc20.methods.depositERC20(
            chain_id_s_chain,
            erc20Address_main_net,
            accountForSchain,
            "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
        );
        dataTxDeposit = methodWithArguments_rawDepositERC20.encodeABI();
        //
        //
        strActionName = "compute gas price for ERC20 transactions M->S";
        let gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        //
        strActionName = "create ERC20/approve transaction M->S";
        const estimatedGas_approve = await tc_main_net.computeGas( methodWithArguments_approve, w3_main_net, 8000000, gasPrice, joAccountSrc.address( w3_main_net ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_approve ) + "\n" );
        //
        const isIgnore_approve = false;
        const strDRC_approve = "do_erc20_payment_from_main_net, approve";
        await dry_run_call( details, w3_main_net, methodWithArguments_approve, joAccountSrc, strDRC_approve, isIgnore_approve, gasPrice, estimatedGas_approve, "0" );
        //
        const rawTxApprove = {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ), // accountForMainnet
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxApprove,
            to: erc20Address_main_net,
            gasPrice: gasPrice, // 0
            gas: estimatedGas_approve
        };
        const txApprove = compose_tx_instance( details, strLogPrefix, rawTxApprove );
        strActionName = "sign ERC20/approve transaction M->S";
        const joApproveSR = await safe_sign_transaction_with_account( details, w3_main_net, txApprove, rawTxApprove, joAccountSrc );
        let joReceiptApprove = null;
        if( joApproveSR.joACI.isAutoSend )
            joReceiptApprove = await get_web3_transactionReceipt( details, 10, w3_main_net, joApproveSR.txHashSent );
        else {
            const serializedTxApprove = txApprove.serialize();
            strActionName = "w3_main_net.eth.sendSignedTransaction()/Approve";
            details.write( cc.normal( "Will send ERC20/approve signed transaction from " ) + cc.warning( joAccountSrc.address( w3_main_net ) ) + "\n" );
            // let joReceiptApprove = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
            joReceiptApprove = await safe_send_signed_transaction( details, w3_main_net, serializedTxApprove, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        if( joReceiptApprove && typeof joReceiptApprove == "object" && "gasUsed" in joReceiptApprove ) {
            jarrReceipts.push( {
                "description": "do_erc20_payment_from_main_net/approve",
                "receipt": joReceiptApprove
            } );
        }
        //
        //
        strActionName = "create ERC20/deposit transaction M->S";
        //
        gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const estimatedGas_deposit = await tc_main_net.computeGas( methodWithArguments_rawDepositERC20, w3_main_net, 8000000, gasPrice, joAccountSrc.address( w3_main_net ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(deposit) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_deposit ) + "\n" );
        //
        const isIgnore_rawDepositERC20 = true;
        const strDRC_rawDepositERC20 = "do_erc20_payment_from_main_net, rawDepositERC20";
        await dry_run_call( details, w3_main_net, methodWithArguments_rawDepositERC20, joAccountSrc, strDRC_rawDepositERC20, isIgnore_rawDepositERC20, gasPrice, estimatedGas_deposit, "0" );
        //
        tcnt += 1;
        const rawTxDeposit = {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ), // accountForMainnet
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxDeposit,
            to: depositBoxAddress,
            gasPrice: gasPrice, // 0
            gas: estimatedGas_deposit
            // value: "0x" + w3_main_net.utils.toBN( wei_how_much ).toString( 16 )
        };
        const txDeposit = compose_tx_instance( details, strLogPrefix, rawTxDeposit );
        strActionName = "sign ERC20/deposit transaction M->S";
        const joDepositSR = await safe_sign_transaction_with_account( details, w3_main_net, txDeposit, rawTxDeposit, joAccountSrc );
        let joReceiptDeposit = null;
        if( joDepositSR.joACI.isAutoSend )
            joReceiptDeposit = await get_web3_transactionReceipt( details, 10, w3_main_net, joDepositSR.txHashSent );
        else {
            const serializedTxDeposit = txDeposit.serialize();
            // send transactions
            strActionName = "w3_main_net.eth.sendSignedTransaction()/Deposit";
            details.write( cc.normal( "Will send ERC20/deposit signed transaction from " ) + cc.warning( joAccountSrc.address( w3_main_net ) ) + "\n" );
            // let joReceiptDeposit = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString( "hex" ) );
            joReceiptDeposit = await safe_send_signed_transaction( details, w3_main_net, serializedTxDeposit, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Deposit: " ) + cc.j( joReceiptDeposit ) + "\n" );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" && "gasUsed" in joReceiptDeposit ) {
            jarrReceipts.push( {
                "description": "do_erc20_payment_from_main_net/deposit",
                "receipt": joReceiptDeposit
            } );
        }
        //
        //
        const joReceipt = joReceiptDeposit;
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_main_net ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.debug( " contract ..." ) + "\n" );
            await sleep( g_nSleepBeforeFetchOutgoingMessageEvent );
            const joEvents = await get_contract_call_events( details, w3_main_net, jo_message_proxy_main_net, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            else
                throw new Error( "Verification failed for th\"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_main_net.options.address + " contract, no events found" );
        } // if( jo_message_proxy_main_net )
        if( jo_deposit_box_erc20 ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "DepositBox" ) + cc.debug( "/" ) + cc.notice( jo_deposit_box_erc20.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( details, w3_main_net, jo_deposit_box_erc20, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length == 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box_erc20.options.address ) + cc.success( " contract, no event found" ) + "\n" );
            else
                throw new Error( "Verification failed for the \"Error\" event of the \"DepositBox\"/" + jo_deposit_box_erc20.options.address + " contract, no events found" );
        } // if( jo_deposit_box )
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "do_erc20_payment_from_main_net", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "ERC-20 PAYMENT FROM MAIN NET", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "do_erc20_payment_from_main_net", true );
    details.close();
    return true;
} // async function do_erc20_payment_from_main_net(...

async function do_erc1155_payment_from_main_net(
    w3_main_net,
    w3_s_chain,
    cid_main_net,
    cid_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_deposit_box_erc1155,
    jo_message_proxy_main_net, // for checking logs
    chain_id_s_chain,
    token_id, // which ERC1155 token id to send
    token_amount, // which ERC1155 token id to send
    wei_how_much, // how much ETH
    jo_token_manager_erc1155, // only s-chain
    strCoinNameErc1155_main_net,
    erc1155PrivateTestnetJson_main_net,
    strCoinNameErc1155_s_chain,
    erc1155PrivateTestnetJson_s_chain,
    tc_main_net
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // do_erc1155_payment_from_main_net
    let strActionName = ""; const strLogPrefix = cc.info( "M2S ERC1155 Payment:" ) + " ";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/do_erc1155_payment_from_main_net";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await get_web3_transactionCount( details, 10, w3_main_net, joAccountSrc.address( w3_main_net ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "ERC1155 prepare M->S";
        const erc1155ABI = erc1155PrivateTestnetJson_main_net[strCoinNameErc1155_main_net + "_abi"];
        const erc1155Address_main_net = erc1155PrivateTestnetJson_main_net[strCoinNameErc1155_main_net + "_address"];
        const contractERC1155 = new w3_main_net.eth.Contract( erc1155ABI, erc1155Address_main_net );
        // prepare the smart contract function deposit(string schainName, address to)
        const depositBoxAddress = jo_deposit_box_erc1155.options.address;
        const accountForSchain = joAccountDst.address( w3_s_chain );
        const methodWithArguments_approve = contractERC1155.methods.setApprovalForAll( // same as approve in 20
            // joAccountSrc.address( w3_main_net ),
            depositBoxAddress,
            true
        );
        const dataTxApprove = methodWithArguments_approve.encodeABI();
        let dataTxDeposit = null;
        const methodWithArguments_rawDepositERC1155 = jo_deposit_box_erc1155.methods.depositERC1155(
            chain_id_s_chain,
            erc1155Address_main_net,
            accountForSchain,
            "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 ),
            "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
        );
        dataTxDeposit = methodWithArguments_rawDepositERC1155.encodeABI();
        //
        //
        strActionName = "compute gas price for ERC1155 transactions M->S";
        let gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        //
        strActionName = "create ERC1155/approve transaction M->S";
        const estimatedGas_approve = await tc_main_net.computeGas( methodWithArguments_approve, w3_main_net, 8000000, gasPrice, joAccountSrc.address( w3_main_net ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_approve ) + "\n" );
        //
        const isIgnore_approve = false;
        const strDRC_approve = "do_erc1155_payment_from_main_net, approve";
        await dry_run_call( details, w3_main_net, methodWithArguments_approve, joAccountSrc, strDRC_approve, isIgnore_approve, gasPrice, estimatedGas_approve, "0" );
        //
        const rawTxApprove = {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ),
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxApprove,
            to: erc1155Address_main_net,
            gasPrice: gasPrice,
            gas: estimatedGas_approve
        };
        const txApprove = compose_tx_instance( details, strLogPrefix, rawTxApprove );
        strActionName = "sign ERC1155/approve transaction M->S";
        const joApproveSR = await safe_sign_transaction_with_account( details, w3_main_net, txApprove, rawTxApprove, joAccountSrc );
        let joReceiptApprove = null;
        if( joApproveSR.joACI.isAutoSend )
            joReceiptApprove = await get_web3_transactionReceipt( details, 10, w3_main_net, joApproveSR.txHashSent );
        else {
            const serializedTxApprove = txApprove.serialize();
            details.write( cc.normal( "Will send ERC1155/approve signed transaction from " ) + cc.warning( joAccountSrc.address( w3_main_net ) ) + "\n" );
            strActionName = "w3_main_net.eth.sendSignedTransaction()/Approve";
            // let joReceiptApprove = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
            joReceiptApprove = await safe_send_signed_transaction( details, w3_main_net, serializedTxApprove, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        if( joReceiptApprove && typeof joReceiptApprove == "object" && "gasUsed" in joReceiptApprove ) {
            jarrReceipts.push( {
                "description": "do_erc1155_payment_from_main_net/approve",
                "receipt": joReceiptApprove
            } );
        }
        //
        //
        strActionName = "create ERC1155/deposit transaction M->S";
        tcnt += 1;
        //
        gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const estimatedGas_deposit = await tc_main_net.computeGas( methodWithArguments_rawDepositERC1155, w3_main_net, 8000000, gasPrice, joAccountSrc.address( w3_main_net ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(deposit) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_deposit ) + "\n" );
        //
        const isIgnore_rawDepositERC1155 = true;
        const strDRC_rawDepositERC1155 = "do_erc1155_payment_from_main_net, rawDepositERC1155";
        await dry_run_call( details, w3_main_net, methodWithArguments_rawDepositERC1155, joAccountSrc, strDRC_rawDepositERC1155, isIgnore_rawDepositERC1155, gasPrice, estimatedGas_deposit, "0" );
        //
        const rawTxDeposit = {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ),
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxDeposit,
            to: depositBoxAddress,
            gasPrice: gasPrice,
            gas: estimatedGas_deposit
            // value: "0x" + w3_main_net.utils.toBN( wei_how_much ).toString( 16 )
            //, value: 2000000000000000 // w3_dst.utils.toWei( (1).toString(), "ether" )
        };
        const txDeposit = compose_tx_instance( details, strLogPrefix, rawTxDeposit );
        strActionName = "sign ERC1155/deposit transaction M->S";
        const joDepositSR = await safe_sign_transaction_with_account( details, w3_main_net, txDeposit, rawTxDeposit, joAccountSrc );
        let joReceiptDeposit = null;
        if( joDepositSR.joACI.isAutoSend )
            joReceiptDeposit = await get_web3_transactionReceipt( details, 10, w3_main_net, joDepositSR.txHashSent );
        else {
            const serializedTxDeposit = txDeposit.serialize();
            // send transactions
            details.write( cc.normal( "Will send ERC1155/deposit signed transaction from " ) + cc.warning( joAccountSrc.address( w3_main_net ) ) + "\n" );
            strActionName = "w3_main_net.eth.sendSignedTransaction()/Deposit";
            // let joReceiptDeposit = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString( "hex" ) );
            joReceiptDeposit = await safe_send_signed_transaction( details, w3_main_net, serializedTxDeposit, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Deposit: " ) + cc.j( joReceiptDeposit ) + "\n" );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" && "gasUsed" in joReceiptDeposit ) {
            jarrReceipts.push( {
                "description": "do_erc1155_payment_from_main_net/deposit",
                "receipt": joReceiptDeposit
            } );
        }
        //
        //
        const joReceipt = joReceiptDeposit;
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_main_net ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.debug( " contract ..." ) + "\n" );
            await sleep( g_nSleepBeforeFetchOutgoingMessageEvent );
            const joEvents = await get_contract_call_events( details, w3_main_net, jo_message_proxy_main_net, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_main_net.options.address + " contract, no events found" );
        } // if( jo_message_proxy_main_net )
        if( jo_deposit_box_erc1155 ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "DepositBox" ) + cc.debug( "/" ) + cc.notice( jo_deposit_box_erc1155.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( details, w3_main_net, jo_deposit_box_erc1155, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length == 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box_erc1155.options.address ) + cc.success( " contract, no event found" ) + "\n" );
            else
                throw new Error( "Verification failed for the \"Error\" event of the \"DepositBox\"/" + jo_deposit_box_erc1155.options.address + " contract, no events found" );
        } // if( jo_deposit_box )
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "do_erc1155_payment_from_main_net", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "ERC-1155 PAYMENT FROM MAIN NET", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "do_erc1155_payment_from_main_net", true );
    details.close();
    return true;
} // async function do_erc1155_payment_from_main_net(...

async function do_erc1155_batch_payment_from_main_net(
    w3_main_net,
    w3_s_chain,
    cid_main_net,
    cid_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_deposit_box_erc1155,
    jo_message_proxy_main_net, // for checking logs
    chain_id_s_chain,
    token_ids, // which ERC1155 token id to send
    token_amounts, // which ERC1155 token id to send
    wei_how_much, // how much ETH
    jo_token_manager_erc1155, // only s-chain
    strCoinNameErc1155_main_net,
    erc1155PrivateTestnetJson_main_net,
    strCoinNameErc1155_s_chain,
    erc1155PrivateTestnetJson_s_chain,
    tc_main_net
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // do_erc1155_batch_payment_from_main_net
    let strActionName = ""; const strLogPrefix = cc.info( "M2S ERC1155 Batch Payment:" ) + " ";
    try {
        strActionName = "w3_main_net.eth.getTransactionCount()/do_erc1155_batch_payment_from_main_net";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        let tcnt = await get_web3_transactionCount( details, 10, w3_main_net, joAccountSrc.address( w3_main_net ), null );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        //
        strActionName = "ERC1155 Batch prepare M->S";
        const erc1155ABI = erc1155PrivateTestnetJson_main_net[strCoinNameErc1155_main_net + "_abi"];
        const erc1155Address_main_net = erc1155PrivateTestnetJson_main_net[strCoinNameErc1155_main_net + "_address"];
        const contractERC1155 = new w3_main_net.eth.Contract( erc1155ABI, erc1155Address_main_net );
        // prepare the smart contract function deposit(string schainName, address to)
        const depositBoxAddress = jo_deposit_box_erc1155.options.address;
        const accountForSchain = joAccountDst.address( w3_s_chain );
        const methodWithArguments_approve = contractERC1155.methods.setApprovalForAll( // same as approve in 20
            // joAccountSrc.address( w3_main_net ),
            depositBoxAddress,
            true
        );
        const dataTxApprove = methodWithArguments_approve.encodeABI();
        let dataTxDeposit = null;
        const methodWithArguments_rawDepositERC1155Batch = jo_deposit_box_erc1155.methods.depositERC1155Batch(
            chain_id_s_chain,
            erc1155Address_main_net,
            accountForSchain,
            token_ids, //"0x" + w3_main_net.utils.toBN( token_id ).toString( 16 ),
            token_amounts //"0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
        );
        dataTxDeposit = methodWithArguments_rawDepositERC1155Batch.encodeABI();
        //
        //
        strActionName = "compute gas price for ERC1155 Batch transactions M->S";
        let gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        //
        strActionName = "create ERC1155 Batch/approve transaction M->S";
        const estimatedGas_approve = await tc_main_net.computeGas( methodWithArguments_approve, w3_main_net, 8000000, gasPrice, joAccountSrc.address( w3_main_net ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_approve ) + "\n" );
        //
        const isIgnore_approve = false;
        const strDRC_approve = "do_erc1155_batch_payment_from_main_net, approve";
        await dry_run_call( details, w3_main_net, methodWithArguments_approve, joAccountSrc, strDRC_approve, isIgnore_approve, gasPrice, estimatedGas_approve, "0" );
        //
        const rawTxApprove = {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ),
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxApprove,
            to: erc1155Address_main_net,
            gasPrice: gasPrice,
            gas: estimatedGas_approve
        };
        const txApprove = compose_tx_instance( details, strLogPrefix, rawTxApprove );
        strActionName = "sign ERC1155 Batch/approve transaction M->S";
        const joApproveSR = await safe_sign_transaction_with_account( details, w3_main_net, txApprove, rawTxApprove, joAccountSrc );
        let joReceiptApprove = null;
        if( joApproveSR.joACI.isAutoSend )
            joReceiptApprove = await get_web3_transactionReceipt( details, 10, w3_main_net, joApproveSR.txHashSent );
        else {
            const serializedTxApprove = txApprove.serialize();
            details.write( cc.normal( "Will send ERC1155 Batch/approve signed transaction from " ) + cc.warning( joAccountSrc.address( w3_main_net ) ) + "\n" );
            strActionName = "w3_main_net.eth.sendSignedTransaction()/Approve";
            // let joReceiptApprove = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
            joReceiptApprove = await safe_send_signed_transaction( details, w3_main_net, serializedTxApprove, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        if( joReceiptApprove && typeof joReceiptApprove == "object" && "gasUsed" in joReceiptApprove ) {
            jarrReceipts.push( {
                "description": "do_erc1155_batch_payment_from_main_net/approve",
                "receipt": joReceiptApprove
            } );
        }
        //
        //
        strActionName = "create ERC1155 Batch/deposit transaction M->S";
        tcnt += 1;
        //
        gasPrice = await tc_main_net.computeGasPrice( w3_main_net, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const estimatedGas_deposit = await tc_main_net.computeGas( methodWithArguments_rawDepositERC1155Batch, w3_main_net, 8000000, gasPrice, joAccountSrc.address( w3_main_net ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(deposit) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_deposit ) + "\n" );
        //
        const isIgnore_rawDepositERC1155Batch = true;
        const strDRC_rawDepositERC1155Batch = "do_erc1155_batch_payment_from_main_net, rawDepositERC1155Batch";
        await dry_run_call( details, w3_main_net, methodWithArguments_rawDepositERC1155Batch, joAccountSrc, strDRC_rawDepositERC1155Batch, isIgnore_rawDepositERC1155Batch, gasPrice, estimatedGas_deposit, "0" );
        //
        const rawTxDeposit = {
            chainId: cid_main_net,
            from: joAccountSrc.address( w3_main_net ),
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxDeposit,
            to: depositBoxAddress,
            gasPrice: gasPrice,
            gas: estimatedGas_deposit
            // value: "0x" + w3_main_net.utils.toBN( wei_how_much ).toString( 16 )
            //, value: 2000000000000000 // w3_dst.utils.toWei( (1).toString(), "ether" )
        };
        const txDeposit = compose_tx_instance( details, strLogPrefix, rawTxDeposit );
        strActionName = "sign ERC1155 Batch/deposit transaction M->S";
        const joDepositSR = await safe_sign_transaction_with_account( details, w3_main_net, txDeposit, rawTxDeposit, joAccountSrc );
        let joReceiptDeposit = null;
        if( joDepositSR.joACI.isAutoSend )
            joReceiptDeposit = await get_web3_transactionReceipt( details, 10, w3_main_net, joDepositSR.txHashSent );
        else {
            const serializedTxDeposit = txDeposit.serialize();
            // send transactions
            details.write( cc.normal( "Will send ERC1155 Batch/deposit signed transaction from " ) + cc.warning( joAccountSrc.address( w3_main_net ) ) + "\n" );
            strActionName = "w3_main_net.eth.sendSignedTransaction()/Deposit";
            // let joReceiptDeposit = await w3_main_net.eth.sendSignedTransaction( "0x" + serializedTxDeposit.toString( "hex" ) );
            joReceiptDeposit = await safe_send_signed_transaction( details, w3_main_net, serializedTxDeposit, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Deposit: " ) + cc.j( joReceiptDeposit ) + "\n" );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" && "gasUsed" in joReceiptDeposit ) {
            jarrReceipts.push( {
                "description": "do_erc1155_batch_payment_from_main_net/deposit",
                "receipt": joReceiptDeposit
            } );
        }
        //
        //
        const joReceipt = joReceiptDeposit;
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_main_net ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.debug( " contract ..." ) + "\n" );
            await sleep( g_nSleepBeforeFetchOutgoingMessageEvent );
            const joEvents = await get_contract_call_events( details, w3_main_net, jo_message_proxy_main_net, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_main_net.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_main_net.options.address + " contract, no events found" );
        } // if( jo_message_proxy_main_net )
        if( jo_deposit_box_erc1155 ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "Error" ) + cc.debug( " event of the " ) + cc.info( "DepositBox" ) + cc.debug( "/" ) + cc.notice( jo_deposit_box_erc1155.options.address ) + cc.debug( " contract..." ) + "\n" );
            const joEvents = await get_contract_call_events( details, w3_main_net, jo_deposit_box_erc1155, "Error", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length == 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "Error" ) + cc.success( " event of the " ) + cc.info( "DepositBox" ) + cc.success( "/" ) + cc.notice( jo_deposit_box_erc1155.options.address ) + cc.success( " contract, no event found" ) + "\n" );
            else
                throw new Error( "Verification failed for the \"Error\" event of the \"DepositBox\"/" + jo_deposit_box_erc1155.options.address + " contract, no events found" );
        } // if( jo_deposit_box )
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "do_erc1155_batch_payment_from_main_net", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "ERC-1155 PAYMENT FROM MAIN NET", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "do_erc1155_batch_payment_from_main_net", true );
    details.close();
    return true;
} // async function do_erc1155_batch_payment_from_main_net(...

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function do_erc20_payment_from_s_chain(
    w3_main_net,
    w3_s_chain,
    cid_main_net,
    cid_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_token_manager_erc20, // only s-chain
    jo_message_proxy_s_chain, // for checking logs
    jo_deposit_box, // only main net
    token_amount, // how much ERC20 tokens to send
    wei_how_much, // how much ETH
    strCoinNameErc20_main_net,
    joErc20_main_net,
    strCoinNameErc20_s_chain,
    joErc20_s_chain,
    tc_s_chain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // do_erc20_payment_from_s_chain
    let strActionName = ""; const strLogPrefix = cc.info( "S2M ERC20 Payment:" ) + " ";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_erc20_payment_from_s_chain";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        //
        //
        strActionName = "ERC20 prepare S->M";
        const accountForMainnet = joAccountDst.address( w3_main_net );
        const accountForSchain = joAccountSrc.address( w3_s_chain );
        const erc20ABI = joErc20_s_chain[strCoinNameErc20_s_chain + "_abi"];
        const erc20Address_s_chain = joErc20_s_chain[strCoinNameErc20_s_chain + "_address"];
        const tokenManagerAddress = jo_token_manager_erc20.options.address;
        const contractERC20 = new w3_s_chain.eth.Contract( erc20ABI, erc20Address_s_chain );
        //
        // prepare the smart contract function deposit(string schainName, address to)
        //
        // const depositBoxAddress = jo_deposit_box.options.address;
        const methodWithArguments_approve = contractERC20.methods.approve(
            tokenManagerAddress, "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
        );
        const dataTxApprove = methodWithArguments_approve.encodeABI();
        const erc20Address_main_net = joErc20_main_net[strCoinNameErc20_main_net + "_address"];
        const methodWithArguments_rawExitToMainERC20 = jo_token_manager_erc20.methods.exitToMainERC20(
            erc20Address_main_net,
            accountForMainnet,
            "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
            // "0x" + w3_main_net.utils.toBN( wei_how_much ).toString( 16 )
        );
        const dataExitToMainERC20 = methodWithArguments_rawExitToMainERC20.encodeABI();
        //
        // prepare for transactions
        //
        strActionName = "compute gas price for ERC20 transactions S->M";
        let gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        //
        strActionName = "create ERC20/approve transaction S->M";
        const estimatedGas_approve = await tc_s_chain.computeGas( methodWithArguments_approve, w3_s_chain, 8000000, gasPrice, joAccountSrc.address( w3_s_chain ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_approve ) + "\n" );
        //
        const isIgnore_approve = false;
        const strDRC_approve = "do_erc20_payment_from_s_chain, approve";
        await dry_run_call( details, w3_s_chain, methodWithArguments_approve, joAccountSrc, strDRC_approve, isIgnore_approve, gasPrice, estimatedGas_approve, "0" );
        //
        let tcnt = parseInt( await get_web3_transactionCount( details, 10, w3_s_chain, joAccountSrc.address( w3_s_chain ), null ) );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        const rawTxApprove = {
            chainId: cid_s_chain,
            from: accountForSchain,
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxApprove,
            to: erc20Address_s_chain,
            gasPrice: gasPrice,
            gas: estimatedGas_approve
        };
        const txApprove = compose_tx_instance( details, strLogPrefix, rawTxApprove );
        strActionName = "sign ERC20/approve transaction S->M";
        const joApproveSR = await safe_sign_transaction_with_account( details, w3_s_chain, txApprove, rawTxApprove, joAccountSrc );
        let joReceiptApprove = null;
        if( joApproveSR.joACI.isAutoSend && joDepositSR.joACI.isAutoSend )
            joReceiptApprove = await get_web3_transactionReceipt( details, 10, w3_s_chain, joApproveSR.txHashSent );
        else {
            const serializedTxApprove = txApprove.serialize();
            // let joReceiptApprove = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
            joReceiptApprove = await safe_send_signed_transaction( details, w3_s_chain, serializedTxApprove, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        if( joReceiptApprove && typeof joReceiptApprove == "object" && "gasUsed" in joReceiptApprove ) {
            jarrReceipts.push( {
                "description": "do_erc20_payment_from_s_chain/approve",
                "receipt": joReceiptApprove
            } );
        }
        //
        if( g_nSleepBetweenTransactionsOnSChainMilliseconds ) {
            details.write( cc.normal( "Sleeping " ) + cc.info( g_nSleepBetweenTransactionsOnSChainMilliseconds ) + cc.normal( " milliseconds between transactions..." ) + "\n" );
            await sleep( g_nSleepBetweenTransactionsOnSChainMilliseconds );
        }
        if( g_bWaitForNextBlockOnSChain )
            await wait_for_next_block_to_appear( details, w3_s_chain );
        //
        //
        //
        //
        strActionName = "create ERC20/exitToMain transaction S->M";
        const estimatedGas_rawExitToMainERC20 = await tc_s_chain.computeGas( methodWithArguments_rawExitToMainERC20, w3_s_chain, 8000000, gasPrice, joAccountSrc.address( w3_s_chain ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_rawExitToMainERC20 ) + "\n" );
        tcnt = parseInt( await get_web3_transactionCount( details, 10, w3_s_chain, joAccountSrc.address( w3_s_chain ), null ) );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const isIgnore_rawExitToMainERC20 = true;
        const strDRC_rawExitToMainERC20 = "do_erc20_payment_from_s_chain, rawExitToMainERC20";
        await dry_run_call( details, w3_s_chain, methodWithArguments_rawExitToMainERC20, joAccountSrc, strDRC_rawExitToMainERC20, isIgnore_rawExitToMainERC20, gasPrice, estimatedGas_rawExitToMainERC20, "0" );
        //
        const rawTxExitToMainERC20 = {
            chainId: cid_s_chain,
            from: accountForSchain,
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataExitToMainERC20,
            to: tokenManagerAddress,
            gasPrice: gasPrice,
            gas: estimatedGas_rawExitToMainERC20
        };
        const txExitToMainERC20 = compose_tx_instance( details, strLogPrefix, rawTxExitToMainERC20 );
        strActionName = "sign ERC20/exitToMain transaction S->M";
        const joExitToMainERC20SR = await safe_sign_transaction_with_account( details, w3_s_chain, txExitToMainERC20, rawTxExitToMainERC20, joAccountSrc );
        let joReceiptExitToMainERC20 = null;
        if( joExitToMainERC20SR.joACI.isAutoSend )
            joReceiptExitToMainERC20 = await get_web3_transactionReceipt( details, 10, w3_s_chain, joExitToMainERC20SR.txHashSent );
        else {
            const serializedTxExitToMainERC20 = txExitToMainERC20.serialize();
            // let joReceiptExitToMainERC20 = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxExitToMainERC20.toString( "hex" ) );
            joReceiptExitToMainERC20 = await safe_send_signed_transaction( details, w3_s_chain, serializedTxExitToMainERC20, strActionName, strLogPrefix );
        }
        if( joReceiptExitToMainERC20 && typeof joReceiptExitToMainERC20 == "object" && "gasUsed" in joReceiptExitToMainERC20 ) {
            jarrReceipts.push( {
                "description": "do_erc20_payment_from_s_chain/exit-to-main",
                "receipt": joReceiptExitToMainERC20
            } );
        }
        const joReceipt = joReceiptExitToMainERC20;
        details.write( strLogPrefix + cc.success( "Result receipt for ExitToMainERC20: " ) + cc.j( joReceiptExitToMainERC20 ) + "\n" );
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_s_chain ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.debug( " contract ..." ) + "\n" );
            await sleep( g_nSleepBeforeFetchOutgoingMessageEvent );
            const joEvents = await get_contract_call_events( details, w3_s_chain, jo_message_proxy_s_chain, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_s_chain.options.address + " contract, no events found" );
        } // if( jo_message_proxy_s_chain )
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "do_erc20_payment_from_s_chain", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "ERC-20 PAYMENT FROM S-CHAIN", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "do_erc20_payment_from_s_chain", true );
    details.close();
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
    jo_token_manager_erc721, // only s-chain
    jo_message_proxy_s_chain, // for checking logs
    jo_deposit_box, // only main net
    token_id, // which ERC721 token id to send
    wei_how_much, // how much ETH
    strCoinNameErc721_main_net,
    joErc721_main_net,
    strCoinNameErc721_s_chain,
    joErc721_s_chain,
    tc_s_chain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // do_erc721_payment_from_s_chain
    let strActionName = ""; const strLogPrefix = cc.info( "S2M ERC721 Payment:" ) + " ";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_erc721_payment_from_s_chain";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        //
        //
        strActionName = "ERC721 prepare S->M";
        const accountForMainnet = joAccountDst.address( w3_main_net );
        const accountForSchain = joAccountSrc.address( w3_s_chain );
        const erc721ABI = joErc721_s_chain[strCoinNameErc721_s_chain + "_abi"];
        const erc721Address_s_chain = joErc721_s_chain[strCoinNameErc721_s_chain + "_address"];
        const tokenManagerAddress = jo_token_manager_erc721.options.address;
        const contractERC721 = new w3_s_chain.eth.Contract( erc721ABI, erc721Address_s_chain );
        // prepare the smart contract function deposit(string schainName, address to)
        // const depositBoxAddress = jo_deposit_box.options.address;
        const methodWithArguments_approve = contractERC721.methods.approve(
            // accountForSchain,
            tokenManagerAddress,
            "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 )
        );
        const dataTxApprove = methodWithArguments_approve.encodeABI();
        let dataTxExitToMainERC721 = null;
        const erc721Address_main_net = joErc721_main_net[strCoinNameErc721_main_net + "_address"];
        const methodWithArguments_rawExitToMainERC721 = jo_token_manager_erc721.methods.exitToMainERC721(
            erc721Address_main_net,
            accountForMainnet,
            "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 )
            // "0x" + w3_main_net.utils.toBN( wei_how_much ).toString( 16 )
        );
        dataTxExitToMainERC721 = methodWithArguments_rawExitToMainERC721.encodeABI();
        //
        //
        strActionName = "compute gas price for ERC721 transactions S->M";
        let gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        //
        strActionName = "create ERC721/approve transaction S->M";
        let tcnt = parseInt( await get_web3_transactionCount( details, 10, w3_s_chain, joAccountSrc.address( w3_s_chain ), null ) );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        const estimatedGas_approve = await tc_s_chain.computeGas( methodWithArguments_approve, w3_s_chain, 8000000, gasPrice, joAccountSrc.address( w3_s_chain ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(transfer from) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_approve ) + "\n" );
        //
        const isIgnore_approve = false;
        const strDRC_approve = "erc721_payment_from_s_chain, approve";
        await dry_run_call( details, w3_s_chain, methodWithArguments_approve, joAccountSrc, strDRC_approve,isIgnore_approve, gasPrice, estimatedGas_approve, "0" );
        //
        const rawTxApprove = {
            chainId: cid_s_chain,
            from: accountForSchain,
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxApprove,
            to: erc721Address_s_chain,
            gasPrice: gasPrice,
            gas: estimatedGas_approve
        };
        const txApprove = compose_tx_instance( details, strLogPrefix, rawTxApprove );
        strActionName = "sign ERC721/approve transaction S->M";
        const joApproveSR = await safe_sign_transaction_with_account( details, w3_s_chain, txApprove, rawTxApprove, joAccountSrc );
        let joReceiptApprove = null;
        if( joApproveSR.joACI.isAutoSend )
            joReceiptApprove = await get_web3_transactionReceipt( details, 10, w3_s_chain, joApproveSR.txHashSent );
        else {
            const serializedTxApprove = txApprove.serialize();
            // let joReceiptApprove = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
            joReceiptApprove = await safe_send_signed_transaction( details, w3_s_chain, serializedTxApprove, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        if( joReceiptApprove && typeof joReceiptApprove == "object" && "gasUsed" in joReceiptApprove ) {
            jarrReceipts.push( {
                "description": "do_erc721_payment_from_s_chain/transfer-from",
                "receipt": joReceiptApprove
            } );
        }
        //
        if( g_nSleepBetweenTransactionsOnSChainMilliseconds ) {
            details.write( cc.normal( "Sleeping " ) + cc.info( g_nSleepBetweenTransactionsOnSChainMilliseconds ) + cc.normal( " milliseconds between transactions..." ) + "\n" );
            await sleep( g_nSleepBetweenTransactionsOnSChainMilliseconds );
        }
        if( g_bWaitForNextBlockOnSChain )
            await wait_for_next_block_to_appear( details, w3_s_chain );
        //
        //
        //
        //
        strActionName = "create ERC721/rawExitToMain transaction S->M";
        tcnt = parseInt( await get_web3_transactionCount( details, 10, w3_s_chain, joAccountSrc.address( w3_s_chain ), null ) );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const estimatedGas_exitToMainERC721 = await tc_s_chain.computeGas( methodWithArguments_rawExitToMainERC721, w3_s_chain, 8000000, gasPrice, joAccountSrc.address( w3_s_chain ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(exit to main) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_exitToMainERC721 ) + "\n" );
        //
        const isIgnore_rawExitToMainERC721 = true;
        const strDRC_rawExitToMainERC721 = "erc721_payment_from_s_chain, rawExitToMainERC721";
        await dry_run_call( details, w3_s_chain, methodWithArguments_rawExitToMainERC721, joAccountSrc, strDRC_rawExitToMainERC721, isIgnore_rawExitToMainERC721, gasPrice, estimatedGas_exitToMainERC721, "0" );
        //
        const rawTxExitToMainERC721 = compose_tx_instance(
            details,
            strLogPrefix,
            {
                chainId: cid_s_chain,
                from: accountForSchain,
                nonce: "0x" + tcnt.toString( 16 ),
                data: dataTxExitToMainERC721,
                to: tokenManagerAddress,
                gasPrice: gasPrice,
                gas: estimatedGas_exitToMainERC721
            }
        );
        const txExitToMainERC721 = compose_tx_instance( details, strLogPrefix, rawTxExitToMainERC721 );
        strActionName = "sign ERC721/rawExitToMain transaction S->M";
        const joExitToMainErc721SR = await safe_sign_transaction_with_account( details, w3_s_chain, txExitToMainERC721, rawTxExitToMainERC721, joAccountSrc );
        let joReceiptExitToMainERC721 = null;
        if( joExitToMainErc721SR.joACI.isAutoSend )
            joReceiptExitToMainERC721 = await get_web3_transactionReceipt( details, 10, w3_s_chain, joExitToMainErc721SR.txHashSent );
        else {
            const serializedTxExitToMainERC721 = txExitToMainERC721.serialize();
            // let joReceiptExitToMainERC721 = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxExitToMainERC721.toString( "hex" ) );
            joReceiptExitToMainERC721 = await safe_send_signed_transaction( details, w3_s_chain, serializedTxExitToMainERC721, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for ExitToMainERC721: " ) + cc.j( joReceiptExitToMainERC721 ) + "\n" );
        const joReceipt = joReceiptExitToMainERC721;
        details.write( strLogPrefix + cc.success( "Result receipt for ExitToMainERC721: " ) + cc.j( joReceiptExitToMainERC721 ) + "\n" );
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
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.debug( " contract ..." ) + "\n" );
            await sleep( g_nSleepBeforeFetchOutgoingMessageEvent );
            const joEvents = await get_contract_call_events( details, w3_s_chain, jo_message_proxy_s_chain, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_s_chain.options.address + " contract, no events found" );
        } // if( jo_message_proxy_s_chain )
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "do_erc721_payment_from_s_chain", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "ERC-721 PAYMENT FROM S-CHAIN", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "do_erc721_payment_from_s_chain", true );
    details.close();
    return true;
} // async function do_erc721_payment_from_s_chain(...

async function do_erc1155_payment_from_s_chain(
    w3_main_net,
    w3_s_chain,
    cid_main_net,
    cid_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_token_manager_erc1155, // only s-chain
    jo_message_proxy_s_chain, // for checking logs
    jo_deposit_box, // only main net
    token_id, // which ERC1155 token id to send
    token_amount, // which ERC1155 token id to send
    wei_how_much, // how much ETH
    strCoinNameErc1155_main_net,
    joErc1155_main_net,
    strCoinNameErc1155_s_chain,
    joErc1155_s_chain,
    tc_s_chain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // do_erc1155_payment_from_s_chain
    let strActionName = ""; const strLogPrefix = cc.info( "S2M ERC1155 Payment:" ) + " ";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_erc1155_payment_from_s_chain";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        //
        //
        strActionName = "ERC1155 prepare S->M";
        const accountForMainnet = joAccountDst.address( w3_main_net );
        const accountForSchain = joAccountSrc.address( w3_s_chain );
        const erc1155ABI = joErc1155_s_chain[strCoinNameErc1155_s_chain + "_abi"];
        const erc1155Address_s_chain = joErc1155_s_chain[strCoinNameErc1155_s_chain + "_address"];
        const tokenManagerAddress = jo_token_manager_erc1155.options.address;
        const contractERC1155 = new w3_s_chain.eth.Contract( erc1155ABI, erc1155Address_s_chain );
        // prepare the smart contract function deposit(string schainName, address to)
        // const depositBoxAddress = jo_deposit_box.options.address;
        const methodWithArguments_approve = contractERC1155.methods.setApprovalForAll(
            // accountForSchain,
            tokenManagerAddress,
            true
        );
        const dataTxApprove = methodWithArguments_approve.encodeABI();
        let dataTxExitToMainERC1155 = null;
        const erc1155Address_main_net = joErc1155_main_net[strCoinNameErc1155_main_net + "_address"];
        const methodWithArguments_rawExitToMainERC1155 = jo_token_manager_erc1155.methods.exitToMainERC1155(
            erc1155Address_main_net,
            accountForMainnet,
            "0x" + w3_main_net.utils.toBN( token_id ).toString( 16 ),
            "0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
            // "0x" + w3_main_net.utils.toBN( wei_how_much ).toString( 16 )
        );
        dataTxExitToMainERC1155 = methodWithArguments_rawExitToMainERC1155.encodeABI();
        //
        //
        strActionName = "compute gas price for ERC1155 transactions S->M";
        let gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        //
        strActionName = "create ERC1155/approve transaction S->M";
        let tcnt = parseInt( await get_web3_transactionCount( details, 10, w3_s_chain, joAccountSrc.address( w3_s_chain ), null ) );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        const estimatedGas_approve = await tc_s_chain.computeGas( methodWithArguments_approve, w3_s_chain, 8000000, gasPrice, joAccountSrc.address( w3_s_chain ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(transfer from) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_approve ) + "\n" );
        //
        const isIgnore_approve = false;
        const strDRC_approve = "erc1155_payment_from_s_chain, approve";
        await dry_run_call( details, w3_s_chain, methodWithArguments_approve, joAccountSrc, strDRC_approve,isIgnore_approve, gasPrice, estimatedGas_approve, "0" );
        //
        const rawTxApprove = {
            chainId: cid_s_chain,
            from: accountForSchain,
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxApprove,
            to: erc1155Address_s_chain,
            gasPrice: gasPrice,
            gas: estimatedGas_approve
        };
        const txApprove = compose_tx_instance( details, strLogPrefix, rawTxApprove );
        strActionName = "sign ERC1155/approve transaction S->M";
        const joApproveSR = await safe_sign_transaction_with_account( details, w3_s_chain, txApprove, rawTxApprove, joAccountSrc );
        let joReceiptApprove = null;
        if( joApproveSR.joACI.isAutoSend )
            joReceiptApprove = await get_web3_transactionReceipt( details, 10, w3_s_chain, joApproveSR.txHashSent );
        else {
            const serializedTxApprove = txApprove.serialize();
            // let joReceiptApprove = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
            joReceiptApprove = await safe_send_signed_transaction( details, w3_s_chain, serializedTxApprove, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        if( joReceiptApprove && typeof joReceiptApprove == "object" && "gasUsed" in joReceiptApprove ) {
            jarrReceipts.push( {
                "description": "do_erc1155_payment_from_s_chain/transfer-from",
                "receipt": joReceiptApprove
            } );
        }
        //
        if( g_nSleepBetweenTransactionsOnSChainMilliseconds ) {
            details.write( cc.normal( "Sleeping " ) + cc.info( g_nSleepBetweenTransactionsOnSChainMilliseconds ) + cc.normal( " milliseconds between transactions..." ) + "\n" );
            await sleep( g_nSleepBetweenTransactionsOnSChainMilliseconds );
        }
        if( g_bWaitForNextBlockOnSChain )
            await wait_for_next_block_to_appear( details, w3_s_chain );
        //
        //
        //
        //
        strActionName = "create ERC1155/rawExitToMain transaction S->M";
        tcnt = parseInt( await get_web3_transactionCount( details, 10, w3_s_chain, joAccountSrc.address( w3_s_chain ), null ) );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const estimatedGas_exitToMainERC1155 = await tc_s_chain.computeGas( methodWithArguments_rawExitToMainERC1155, w3_s_chain, 8000000, gasPrice, joAccountSrc.address( w3_s_chain ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(exit to main) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_exitToMainERC1155 ) + "\n" );
        //
        const isIgnore_rawExitToMainERC1155 = true;
        const strDRC_rawExitToMainERC1155 = "erc1155_payment_from_s_chain, rawExitToMainERC1155";
        await dry_run_call( details, w3_s_chain, methodWithArguments_rawExitToMainERC1155, joAccountSrc, strDRC_rawExitToMainERC1155, isIgnore_rawExitToMainERC1155, gasPrice, estimatedGas_exitToMainERC1155, "0" );
        //
        const rawTxExitToMainERC1155 = compose_tx_instance(
            details,
            strLogPrefix,
            {
                chainId: cid_s_chain,
                from: accountForSchain,
                nonce: "0x" + tcnt.toString( 16 ),
                data: dataTxExitToMainERC1155,
                to: tokenManagerAddress,
                gasPrice: gasPrice,
                gas: estimatedGas_exitToMainERC1155
            }
        );
        const txExitToMainERC1155 = compose_tx_instance( details, strLogPrefix, rawTxExitToMainERC1155 );
        strActionName = "sign ERC1155/rawExitToMain transaction S->M";
        const joExitToMainErc1155SR = await safe_sign_transaction_with_account( details, w3_s_chain, txExitToMainERC1155, rawTxExitToMainERC1155, joAccountSrc );
        let joReceiptExitToMainERC1155 = null;
        if( joExitToMainErc1155SR.joACI.isAutoSend )
            joReceiptExitToMainERC1155 = await get_web3_transactionReceipt( details, 10, w3_s_chain, joExitToMainErc1155SR.txHashSent );
        else {
            const serializedTxExitToMainERC1155 = txExitToMainERC1155.serialize();
            // let joReceiptExitToMainERC1155 = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxExitToMainERC1155.toString( "hex" ) );
            joReceiptExitToMainERC1155 = await safe_send_signed_transaction( details, w3_s_chain, serializedTxExitToMainERC1155, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for ExitToMainERC1155: " ) + cc.j( joReceiptExitToMainERC1155 ) + "\n" );
        const joReceipt = joReceiptExitToMainERC1155;
        details.write( strLogPrefix + cc.success( "Result receipt for ExitToMainERC1155: " ) + cc.j( joReceiptExitToMainERC1155 ) + "\n" );
        if( joReceiptExitToMainERC1155 && typeof joReceiptExitToMainERC1155 == "object" && "gasUsed" in joReceiptExitToMainERC1155 ) {
            jarrReceipts.push( {
                "description": "do_erc1155_payment_from_s_chain/exit-to-main",
                "receipt": joReceiptExitToMainERC1155
            } );
        }
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_s_chain ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.debug( " contract ..." ) + "\n" );
            await sleep( g_nSleepBeforeFetchOutgoingMessageEvent );
            const joEvents = await get_contract_call_events( details, w3_s_chain, jo_message_proxy_s_chain, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_s_chain.options.address + " contract, no events found" );
        } // if( jo_message_proxy_s_chain )
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "do_erc1155_payment_from_s_chain", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "ERC-1155 PAYMENT FROM S-CHAIN", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "do_erc1155_payment_from_s_chain", true );
    details.close();
    return true;
} // async function do_erc1155_payment_from_s_chain(...

async function do_erc1155_batch_payment_from_s_chain(
    w3_main_net,
    w3_s_chain,
    cid_main_net,
    cid_s_chain,
    joAccountSrc,
    joAccountDst,
    jo_token_manager_erc1155, // only s-chain
    jo_message_proxy_s_chain, // for checking logs
    jo_deposit_box, // only main net
    token_ids, // which ERC1155 token ids to send
    token_amounts, // which ERC1155 token amounts to send
    wei_how_much, // how much ETH
    strCoinNameErc1155_main_net,
    joErc1155_main_net,
    strCoinNameErc1155_s_chain,
    joErc1155_s_chain,
    tc_s_chain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // do_erc1155_batch_payment_from_s_chain
    let strActionName = ""; const strLogPrefix = cc.info( "S2M ERC1155 Batch Payment:" ) + " ";
    try {
        strActionName = "w3_s_chain.eth.getTransactionCount()/do_erc1155_batch_payment_from_s_chain";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        //
        //
        strActionName = "ERC1155 Batch prepare S->M";
        const accountForMainnet = joAccountDst.address( w3_main_net );
        const accountForSchain = joAccountSrc.address( w3_s_chain );
        const erc1155ABI = joErc1155_s_chain[strCoinNameErc1155_s_chain + "_abi"];
        const erc1155Address_s_chain = joErc1155_s_chain[strCoinNameErc1155_s_chain + "_address"];
        const tokenManagerAddress = jo_token_manager_erc1155.options.address;
        const contractERC1155 = new w3_s_chain.eth.Contract( erc1155ABI, erc1155Address_s_chain );
        // prepare the smart contract function deposit(string schainName, address to)
        // const depositBoxAddress = jo_deposit_box.options.address;
        const methodWithArguments_approve = contractERC1155.methods.setApprovalForAll(
            // accountForSchain,
            tokenManagerAddress,
            true
        );
        const dataTxApprove = methodWithArguments_approve.encodeABI();
        let dataTxExitToMainERC1155Batch = null;
        const erc1155Address_main_net = joErc1155_main_net[strCoinNameErc1155_main_net + "_address"];
        const methodWithArguments_rawExitToMainERC1155Batch = jo_token_manager_erc1155.methods.exitToMainERC1155Batch(
            erc1155Address_main_net,
            accountForMainnet,
            token_ids, //"0x" + w3_main_net.utils.toBN( token_id ).toString( 16 ),
            token_amounts //"0x" + w3_main_net.utils.toBN( token_amount ).toString( 16 )
            // "0x" + w3_main_net.utils.toBN( wei_how_much ).toString( 16 )
        );
        dataTxExitToMainERC1155Batch = methodWithArguments_rawExitToMainERC1155Batch.encodeABI();
        //
        //
        strActionName = "compute gas price for ERC1155 Batch transactions S->M";
        let gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        //
        strActionName = "create ERC1155 Batch/approve transaction S->M";
        let tcnt = parseInt( await get_web3_transactionCount( details, 10, w3_s_chain, joAccountSrc.address( w3_s_chain ), null ) );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        const estimatedGas_approve = await tc_s_chain.computeGas( methodWithArguments_approve, w3_s_chain, 8000000, gasPrice, joAccountSrc.address( w3_s_chain ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(transfer from) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_approve ) + "\n" );
        //
        const isIgnore_approve = false;
        const strDRC_approve = "erc1155_payment_from_s_chain, approve";
        await dry_run_call( details, w3_s_chain, methodWithArguments_approve, joAccountSrc, strDRC_approve,isIgnore_approve, gasPrice, estimatedGas_approve, "0" );
        //
        const rawTxApprove = {
            chainId: cid_s_chain,
            from: accountForSchain,
            nonce: "0x" + tcnt.toString( 16 ),
            data: dataTxApprove,
            to: erc1155Address_s_chain,
            gasPrice: gasPrice,
            gas: estimatedGas_approve
        };
        const txApprove = compose_tx_instance( details, strLogPrefix, rawTxApprove );
        strActionName = "sign ERC1155 Batch/approve transaction S->M";
        const joApproveSR = await safe_sign_transaction_with_account( details, w3_s_chain, txApprove, rawTxApprove, joAccountSrc );
        let joReceiptApprove = null;
        if( joApproveSR.joACI.isAutoSend )
            joReceiptApprove = await get_web3_transactionReceipt( details, 10, w3_s_chain, joApproveSR.txHashSent );
        else {
            const serializedTxApprove = txApprove.serialize();
            // let joReceiptApprove = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxApprove.toString( "hex" ) );
            joReceiptApprove = await safe_send_signed_transaction( details, w3_s_chain, serializedTxApprove, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for Approve: " ) + cc.j( joReceiptApprove ) + "\n" );
        if( joReceiptApprove && typeof joReceiptApprove == "object" && "gasUsed" in joReceiptApprove ) {
            jarrReceipts.push( {
                "description": "do_erc1155_batch_payment_from_s_chain/transfer-from",
                "receipt": joReceiptApprove
            } );
        }
        //
        if( g_nSleepBetweenTransactionsOnSChainMilliseconds ) {
            details.write( cc.normal( "Sleeping " ) + cc.info( g_nSleepBetweenTransactionsOnSChainMilliseconds ) + cc.normal( " milliseconds between transactions..." ) + "\n" );
            await sleep( g_nSleepBetweenTransactionsOnSChainMilliseconds );
        }
        if( g_bWaitForNextBlockOnSChain )
            await wait_for_next_block_to_appear( details, w3_s_chain );
        //
        //
        //
        //
        strActionName = "create ERC1155 Batch/rawExitToMain transaction S->M";
        tcnt = parseInt( await get_web3_transactionCount( details, 10, w3_s_chain, joAccountSrc.address( w3_s_chain ), null ) );
        details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
        //
        gasPrice = await tc_s_chain.computeGasPrice( w3_s_chain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
        //
        const estimatedGas_exitToMainERC1155Batch = await tc_s_chain.computeGas( methodWithArguments_rawExitToMainERC1155Batch, w3_s_chain, 8000000, gasPrice, joAccountSrc.address( w3_s_chain ), "0" );
        details.write( strLogPrefix + cc.debug( "Using estimated(exit to main) " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_exitToMainERC1155Batch ) + "\n" );
        //
        const isIgnore_rawExitToMainERC1155Batch = true;
        const strDRC_rawExitToMainERC1155Batch = "erc1155_batch_payment_from_s_chain, rawExitToMainERC1155Batch";
        await dry_run_call( details, w3_s_chain, methodWithArguments_rawExitToMainERC1155Batch, joAccountSrc, strDRC_rawExitToMainERC1155Batch, isIgnore_rawExitToMainERC1155Batch, gasPrice, estimatedGas_exitToMainERC1155Batch, "0" );
        //
        const rawTxExitToMainERC1155Batch = compose_tx_instance(
            details,
            strLogPrefix,
            {
                chainId: cid_s_chain,
                from: accountForSchain,
                nonce: "0x" + tcnt.toString( 16 ),
                data: dataTxExitToMainERC1155Batch,
                to: tokenManagerAddress,
                gasPrice: gasPrice,
                gas: estimatedGas_exitToMainERC1155Batch
            }
        );
        const txExitToMainERC1155Batch = compose_tx_instance( details, strLogPrefix, rawTxExitToMainERC1155Batch );
        strActionName = "sign ERC1155 Batch/rawExitToMain transaction S->M";
        const joExitToMainErc1155BatchSR = await safe_sign_transaction_with_account( details, w3_s_chain, txExitToMainERC1155Batch, rawTxExitToMainERC1155Batch, joAccountSrc );
        let joReceiptExitToMainERC1155Batch = null;
        if( joExitToMainErc1155BatchSR.joACI.isAutoSend )
            joReceiptExitToMainERC1155Batch = await get_web3_transactionReceipt( details, 10, w3_s_chain, joExitToMainErc1155BatchSR.txHashSent );
        else {
            const serializedTxExitToMainERC1155Batch = txExitToMainERC1155Batch.serialize();
            // let joReceiptExitToMainERC1155Batch = await w3_s_chain.eth.sendSignedTransaction( "0x" + serializedTxExitToMainERC1155Batch.toString( "hex" ) );
            joReceiptExitToMainERC1155Batch = await safe_send_signed_transaction( details, w3_s_chain, serializedTxExitToMainERC1155Batch, strActionName, strLogPrefix );
        }
        details.write( strLogPrefix + cc.success( "Result receipt for ExitToMainERC1155Batch: " ) + cc.j( joReceiptExitToMainERC1155Batch ) + "\n" );
        const joReceipt = joReceiptExitToMainERC1155Batch;
        details.write( strLogPrefix + cc.success( "Result receipt for ExitToMainERC1155Batch: " ) + cc.j( joReceiptExitToMainERC1155Batch ) + "\n" );
        if( joReceiptExitToMainERC1155Batch && typeof joReceiptExitToMainERC1155Batch == "object" && "gasUsed" in joReceiptExitToMainERC1155Batch ) {
            jarrReceipts.push( {
                "description": "do_erc1155_batch_payment_from_s_chain/exit-to-main",
                "receipt": joReceiptExitToMainERC1155Batch
            } );
        }
        //
        // Must-have event(s) analysis as indicator(s) of success
        //
        if( jo_message_proxy_s_chain ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.debug( " contract ..." ) + "\n" );
            await sleep( g_nSleepBeforeFetchOutgoingMessageEvent );
            const joEvents = await get_contract_call_events( details, w3_s_chain, jo_message_proxy_s_chain, "OutgoingMessage", joReceipt.blockNumber, joReceipt.transactionHash, {} );
            if( joEvents.length > 0 )
                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "OutgoingMessage" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_s_chain.options.address ) + cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            else
                throw new Error( "Verification failed for the \"OutgoingMessage\" event of the \"MessageProxy\"/" + jo_message_proxy_s_chain.options.address + " contract, no events found" );
        } // if( jo_message_proxy_s_chain )
    } catch ( err ) {
        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " + strActionName + ": " ) + cc.error( err ) + "\n";
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( s );
        details.write( s );
        details.exposeDetailsTo( log, "do_erc1155_batch_payment_from_s_chain", false );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "ERC-1155 PAYMENT FROM S-CHAIN", jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "do_erc1155_batch_payment_from_s_chain", true );
    details.close();
    return true;
} // async function do_erc1155_batch_payment_from_s_chain(...

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function w3provider_2_url( provider ) {
    if( ! provider )
        return null;
    if( "host" in provider ) {
        const u = provider.host.toString();
        if( u && cc.safeURL( u ) )
            return u;
    }
    if( "url" in provider ) {
        const u = provider.url.toString();
        if( u && cc.safeURL( u ) )
            return u;
    }
    return null;
}

function w3_2_url( w3 ) {
    if( ! w3 )
        return null;
    if( !( "currentProvider" in w3 ) )
        return null;
    return w3provider_2_url( w3.currentProvider );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function async_pending_tx_start( details, w3, w3_opposite, chain_id, chain_id_opposite, txHash ) {
    const strLogPrefix = "";
    try {
        if( chain_id == "Mainnet" ) {
            details.write( strLogPrefix + cc.debug( "Reporting pending transaction " ) + cc.notice( txHash ) + + cc.debug( " start from " ) + cc.u( w3_2_url( w3 ) ) + cc.debug( "..." ) + "\n" );
            const strNodeURL = w3_2_url( w3_opposite );
            details.write( strLogPrefix + cc.debug( "Will report pending work cache to " ) + cc.u( strNodeURL ) + cc.debug( "..." ) + "\n" );
            const rpcCallOpts = null;
            await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
                if( err ) {
                    const s = cc.fatal( "PENDING WORK START ERROR:" ) + cc.error( " JSON RPC call to S-Chain node failed" ) + "\n";
                    if( verbose_get() >= RV_VERBOSE.error )
                        log.write( s );
                    details.write( s );
                    return; // process.exit( 155 );
                }
                const joIn = {
                    method: "skale_imaTxnInsert",
                    params: {
                        hash: "" + txHash
                    }
                };
                details.write( cc.debug( "Starting pending work with " ) + cc.j( joIn ) + "\n" );
                await joCall.call( joIn, /*async*/ function( joIn, joOut, err ) {
                    if( err ) {
                        const s = cc.fatal( "PENDING WORK START ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, error: " ) + cc.warning( err ) + "\n";
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        return; // process.exit( 156 );
                    }
                    details.write( cc.debug( "Pending work start result is: " ) + cc.j( joOut ) + "\n" );
                    if( joOut && "result" in joOut && "success" in joOut.result ) {
                        if( joOut.result.success ) {
                            details.write( strLogPrefix + cc.success( "Success, pending work start reported" ) + "\n" );
                            return;
                        } else {
                            details.write( strLogPrefix + cc.warning( "Pending work start was not reported with success" ) + "\n" );
                            return;
                        }
                    } else {
                        const s = cc.fatal( "PENDING WORK START ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, returned bad answer: " ) + cc.j( joOut ) + "\n";
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        return; // process.exit( 156 );
                    }
                } );
            } );

        }
    } catch ( err ) {
        const s =
            strLogPrefix + cc.error( "PENDING WORK START ERROR: API call error from " ) + cc.u( w3_2_url( w3 ) ) +
            cc.error( ": " ) + cc.error( err ) +
            "\n";
        if( verbose_get() >= RV_VERBOSE.error )
            log.write( s );
        details.write( s );
    }
}

async function async_pending_tx_complete( details, w3, w3_opposite, chain_id, chain_id_opposite, txHash ) {
    const strLogPrefix = "";
    try {
        if( chain_id == "Mainnet" ) {
            details.write( strLogPrefix + cc.debug( "Reporting pending transaction " ) + cc.notice( txHash ) + + cc.debug( " completion from " ) + cc.u( w3_2_url( w3 ) ) + cc.debug( "..." ) + "\n" );
            const strNodeURL = w3_2_url( w3_opposite );
            details.write( strLogPrefix + cc.debug( "Will report pending work cache to " ) + cc.u( strNodeURL ) + cc.debug( "..." ) + "\n" );
            const rpcCallOpts = null;
            await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
                if( err ) {
                    const s = cc.fatal( "PENDING WORK COMPLETE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node failed" ) + "\n";
                    if( verbose_get() >= RV_VERBOSE.error )
                        log.write( s );
                    details.write( s );
                    return; // process.exit( 155 );
                }
                const joIn = {
                    method: "skale_imaTxnErase",
                    params: {
                        hash: "" + txHash
                    }
                };
                details.write( cc.debug( "Completing pending work with " ) + cc.j( joIn ) + "\n" );
                await joCall.call( joIn, /*async*/ function( joIn, joOut, err ) {
                    if( err ) {
                        const s = cc.fatal( "PENDING WORK COMPLETE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, error: " ) + cc.warning( err ) + "'n";
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        return; // process.exit( 156 );
                    }
                    details.write( cc.debug( "Pending work complete result is: " ) + cc.j( joOut ) + "\n" );
                    if( joOut && "result" in joOut && "success" in joOut.result ) {
                        if( joOut.result.success ) {
                            details.write( strLogPrefix + cc.success( "Success, pending work complete reported" ) + "\n" );
                            return;
                        } else {
                            details.write( strLogPrefix + cc.warning( "Pending work complete was not reported with success" ) + "\n" );
                            return;
                        }
                    } else {
                        const s = cc.fatal( "PENDING WORK COMPLETE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, returned bad answer: " ) + cc.j( joOut ) + "\n";
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        return; // process.exit( 156 );
                    }
                } );
            } );

        }
    } catch ( err ) {
        const s =
            strLogPrefix + cc.error( "PENDING WORK COMPLETE ERROR: API call error from " ) + cc.u( w3_2_url( w3 ) ) +
            cc.error( ": " ) + cc.error( err ) +
            "\n";
        if( verbose_get() >= RV_VERBOSE.error )
            log.write( s );
        details.write( s );
    }
}

// function isIterable( value ) {
//     return Symbol.iterator in Object( value );
// }

async function async_pending_tx_scanner( details, w3, w3_opposite, chain_id, chain_id_opposite, cb ) {
    cb = cb || function( tx ) { };
    const strLogPrefix = "";
    try {
        details.write( strLogPrefix + cc.debug( "Scanning pending transactions from " ) + cc.u( w3_2_url( w3 ) ) + cc.debug( "..." ) + "\n" );
        if( chain_id == "Mainnet" ) {
            const strNodeURL = w3_2_url( w3_opposite );
            details.write( strLogPrefix + cc.debug( "Using pending work cache from " ) + cc.u( strNodeURL ) + cc.debug( "..." ) + "\n" );
            let havePendingWorkInfo = false;
            const rpcCallOpts = null;
            await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
                if( err ) {
                    const s = cc.fatal( "PENDING WORK CACHE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node failed" ) + "\n";
                    if( verbose_get() >= RV_VERBOSE.error )
                        log.write( s );
                    details.write( s );
                    return; // process.exit( 155 );
                }
                const joIn = {
                    method: "skale_imaTxnListAll",
                    params: {}
                };
                details.write( cc.debug( "Calling pending work cache with " ) + cc.j( joIn ) + "\n" );
                await joCall.call( joIn, /*async*/ function( joIn, joOut, err ) {
                    if( err ) {
                        havePendingWorkInfo = true;
                        const s = cc.fatal( "PENDING WORK CACHE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, error: " ) + cc.warning( err );
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        return; // process.exit( 156 );
                    }
                    details.write( cc.debug( "Pending work cache result is: " ) + cc.j( joOut ) + "\n" );
                    if( joOut && "result" in joOut && "success" in joOut.result ) {
                        if( joOut.result.success && "allTrackedTXNs" in joOut.result && joOut.result.allTrackedTXNs.length > 0 ) {
                            details.write( strLogPrefix + cc.debug( "Got " ) + cc.j( joOut.result.allTrackedTXNs.length ) + cc.debug( " pending transaction(s)" ) + "\n" );
                            let cntReviewedTNXs = 0;
                            for( const joTXE of joOut.result.allTrackedTXNs ) {
                                ++ cntReviewedTNXs;
                                const joTX = {
                                    hash: "" + joTXE.hash,
                                    to: "holder.value.MessageProxy"
                                };
                                const isContinue = cb( joTX );
                                if( ! isContinue )
                                    break;
                            }
                            details.write( strLogPrefix + cc.debug( "Reviewed " ) + cc.info( cntReviewedTNXs ) + cc.debug( " pending transaction(s)" ) + "\n" );
                            havePendingWorkInfo = true;
                            return;
                        } else {
                            details.write( strLogPrefix + cc.debug( "Reviewed " ) + cc.info( 0 ) + cc.debug( " pending transaction(s)" ) + "\n" );
                            havePendingWorkInfo = true;
                            return;
                        }
                    } else {
                        const s = cc.fatal( "PENDING WORK CACHE ERROR:" ) + cc.error( " JSON RPC call to S-Chain node, returned bad answer: " ) + cc.j( joOut );
                        if( verbose_get() >= RV_VERBOSE.error )
                            log.write( s );
                        details.write( s );
                        havePendingWorkInfo = true;
                        return; // process.exit( 156 );
                    }
                } );
            } );
            let nWaitAttempt = 0;
            while( ! havePendingWorkInfo ) {
                await sleep( 3000 );
                ++ nWaitAttempt;
                if( nWaitAttempt >= 10 ) {
                    havePendingWorkInfo = true; // workaround for es-lint
                    const s = cc.fatal( "PENDING WORK CACHE ERROR:" ) + cc.error( " Wait timeout" ) + "\n";
                    if( verbose_get() >= RV_VERBOSE.error )
                        log.write( s );
                    details.write( s );
                    break;
                }
            }
        } else { // if( chain_id == "Mainnet" )
            const mapTXs = {};
            let tx_idx = 0;
            while( true ) {
                let have_next_tx = false;
                await w3.eth.getTransactionFromBlock( "pending", tx_idx, function( err, rslt ) {
                    try {
                        if( err )
                            return;
                        if( ! rslt )
                            return;
                        if( typeof rslt != "object" )
                            return;
                        have_next_tx = true;
                        const hash = "" + rslt.hash;
                        if( hash in mapTXs )
                            return;
                        mapTXs[hash] = rslt;
                        // details.write( strLogPrefix + cc.debug( "Got pending transaction: " ) + cc.j( rslt ) + "\n" );
                        const isContinue = cb( rslt );
                        if( ! isContinue ) {
                            have_next_tx = false;
                            return;
                        }
                    } catch ( err ) {
                        if( verbose_get() >= RV_VERBOSE.error ) {
                            const s =
                                strLogPrefix + cc.error( "PENDING TRANSACTIONS ENUMERATION HANDLER ERROR: from " ) + cc.u( w3_2_url( w3 ) ) +
                                cc.error( ": " ) + cc.error( err ) +
                                "\n";
                            if( verbose_get() >= RV_VERBOSE.error )
                                log.write( s );
                            details.write( s );
                        }
                    }
                } );
                if( ! have_next_tx )
                    break;
                ++ tx_idx;
            }
            details.write( strLogPrefix + cc.debug( "Got " ) + cc.j( Object.keys( mapTXs ).length ) + cc.debug( " pending transaction(s)" ) + "\n" );
        } // else from if( chain_id == "Mainnet" )
    } catch ( err ) {
        const s =
            strLogPrefix + cc.error( "PENDING TRANSACTIONS SCAN ERROR: API call error from " ) + cc.u( w3_2_url( w3 ) ) +
            cc.error( ": " ) + cc.error( err ) +
            "\n";
        if( verbose_get() >= RV_VERBOSE.error )
            log.write( s );
        details.write( s );
    }
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const g_nMaxLastTransferErrors = 10;
const g_arrLastTransferErrors = [];

function save_transfer_error( textLog ) {
    const ts = Math.round( ( new Date() ).getTime() / 1000 );
    g_arrLastTransferErrors.push( {
        ts: ts,
        textLog: "" + textLog.toString()
    } );
    while( g_arrLastTransferErrors.length > g_nMaxLastTransferErrors )
        g_arrLastTransferErrors.shift();
}

function get_last_transfer_errors( textLog ) {
    return JSON.parse( JSON.stringify( g_arrLastTransferErrors ) );
}

async function init_ima_state_file( details, w3, strDirection, optsStateFile ) {
    if( strDirection != "M2S" )
        return;
    if( ! ( optsStateFile && optsStateFile.isEnabled && "path" in optsStateFile && typeof optsStateFile.path == "string" && optsStateFile.path.length > 0 ) )
        return;
    let isFileExist = false;
    try {
        if( fs.existsSync( optsStateFile.path ) )
            isFileExist = true;
    } catch ( err ) { }
    if( isFileExist )
        return;
    let nBlockFrom = 0;
    try {
        nBlockFrom = await w3.eth.getBlockNumber();
    } catch ( err ) { }
    try {
        const joStateForLogsSearch = {};
        details.write( strLogPrefix + cc.normal( "(FIRST TIME) Saving next forecasted block number for logs search value " ) + cc.info( blockNumberNextForecast ) + "\n" );
        const strKeyName = ( strDirection == "M2S" ) ? "lastSearchedStartBlockM2S" : "lastSearchedStartBlockS2M";
        joStateForLogsSearch[strKeyName] = nBlockFrom;
        const s = JSON.stringify( joStateForLogsSearch, null, 4 );
        fs.writeFileSync( optsStateFile.path, s );
    } catch ( err ) {
    }
}

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
    strDirection,
    //
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
    tc_dst, // same as w3_dst
    //
    optsPendingTxAnalysis,
    optsStateFile
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // do_transfer
    let bErrorInSigningMessages = false;
    await init_ima_state_file( details, w3_src, strDirection, optsStateFile );
    const strLogPrefix = cc.info( "Transfer from " ) + cc.notice( chain_id_src ) + cc.info( " to " ) + cc.notice( chain_id_dst ) + cc.info( ":" ) + " ";
    if( fn_sign_messages == null || fn_sign_messages == undefined ) {
        details.write( strLogPrefix + cc.debug( "Using internal signing stub function" ) + "\n" );
        fn_sign_messages = async function( jarrMessages, nIdxCurrentMsgBlockStart, details, fnAfter ) {
            details.write( strLogPrefix + cc.debug( "Message signing callback was " ) + cc.error( "not provided" ) +
                cc.debug( " to IMA, message start index is " ) + cc.info( nIdxCurrentMsgBlockStart ) + cc.debug( ", have " ) +
                cc.info( jarrMessages.length ) + cc.debug( " message(s) to process:" ) + cc.j( jarrMessages ) + "\n" );
            await fnAfter( null, jarrMessages, null ); // null - no error, null - no signatures
        };
    } else
        details.write( strLogPrefix + cc.debug( "Using externally provided signing function" ) + "\n" );
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
        details.write( cc.info( "SRC " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) + cc.bright( jo_message_proxy_src.options.address ) + "\n" );
        details.write( cc.info( "DST " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) + cc.bright( jo_message_proxy_dst.options.address ) + "\n" );
        strActionName = "src-chain.MessageProxy.getOutgoingMessagesCounter()";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        nPossibleIntegerValue = await jo_message_proxy_src.methods.getOutgoingMessagesCounter( chain_id_dst ).call( {
            from: joAccountSrc.address( w3_src )
        } );
        if( !owaspUtils.validateInteger( nPossibleIntegerValue ) )
            throw new Error( "DST chain " + chain_id_dst + " returned outgoing message counter " + nPossibleIntegerValue + " which is not a valid integer" );
        nOutMsgCnt = owaspUtils.toInteger( nPossibleIntegerValue );
        details.write( strLogPrefix + cc.debug( "Result of " ) + cc.notice( strActionName ) + cc.debug( " call: " ) + cc.info( nOutMsgCnt ) + "\n" );
        //
        strActionName = "dst-chain.MessageProxy.getIncomingMessagesCounter()";
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        nPossibleIntegerValue = await jo_message_proxy_dst.methods.getIncomingMessagesCounter( chain_id_src ).call( {
            from: joAccountDst.address( w3_dst )
        } );
        if( !owaspUtils.validateInteger( nPossibleIntegerValue ) )
            throw new Error( "SRC chain " + chain_id_src + " returned incoming message counter " + nPossibleIntegerValue + " which is not a valid integer" );
        nIncMsgCnt = owaspUtils.toInteger( nPossibleIntegerValue );
        details.write( strLogPrefix + cc.debug( "Result of " ) + cc.notice( strActionName ) + cc.debug( " call: " ) + cc.info( nIncMsgCnt ) + "\n" );
        //
        strActionName = "src-chain.MessageProxy.getIncomingMessagesCounter()";
        nPossibleIntegerValue = await jo_message_proxy_src.methods.getIncomingMessagesCounter( chain_id_dst ).call( {
            from: joAccountSrc.address( w3_src )
        } );
        if( !owaspUtils.validateInteger( nPossibleIntegerValue ) )
            throw new Error( "DST chain " + chain_id_dst + " returned incoming message counter " + nPossibleIntegerValue + " which is not a valid integer" );
        idxLastToPopNotIncluding = owaspUtils.toInteger( nPossibleIntegerValue );
        details.write( strLogPrefix + cc.debug( "Result of " ) + cc.notice( strActionName ) + cc.debug( " call: " ) + cc.info( idxLastToPopNotIncluding ) + "\n" );
        //
        // outer loop is block former/creator, then transfer
        //
        nIdxCurrentMsg = nIncMsgCnt;
        let cntProcessed = 0;
        while( nIdxCurrentMsg < nOutMsgCnt ) {
            details.write(
                strLogPrefix + cc.debug( "Entering block former iteration with " ) + cc.notice( "message counter" ) +
                cc.debug( " set to " ) + cc.info( nIdxCurrentMsg ) +
                "\n" );
            if( "check_time_framing" in global && ( ! global.check_time_framing() ) ) {
                if( verbose_get() >= RV_VERBOSE.information ) {
                    log.write(
                        strLogPrefix + cc.error( "WARNING:" ) + " " +
                        cc.warning( "Time framing overflow (after entering block former iteration loop)" ) +
                        "\n" );
                }
                details.close();
                return;
            }
            const arrMessageCounters = [];
            const messages = [];
            const nIdxCurrentMsgBlockStart = 0 + nIdxCurrentMsg;
            //
            // inner loop wil create block of transactions
            //
            let cntAccumulatedForBlock = 0, blockNumberNextForecast = 0;
            let nBlockFrom = 0;
            const nBlockTo = "latest";
            let joStateForLogsSearch = {};
            const nLatestBlockNumber = await get_web3_blockNumber( details, 10, w3_src ); // await get_web3_universal_call( 10, "BlockNumber", w3, null, null );
            if( optsStateFile && optsStateFile.isEnabled && "path" in optsStateFile && typeof optsStateFile.path == "string" && optsStateFile.path.length > 0 ) {
                try {
                    const s = fs.readFileSync( optsStateFile.path );
                    joStateForLogsSearch = JSON.parse( s );
                    const strKeyName = ( strDirection == "M2S" ) ? "lastSearchedStartBlockM2S" : "lastSearchedStartBlockS2M";
                    if( strKeyName in joStateForLogsSearch && typeof joStateForLogsSearch[strKeyName] == "string" )
                        nBlockFrom = "0x" + w3_src.utils.toBN( joStateForLogsSearch[strKeyName] ).toString( 16 );
                } catch ( err ) {
                    nBlockFrom = 0;
                }
            }
            // blockNumberNextForecast = nBlockFrom;

            for( let idxInBlock = 0; nIdxCurrentMsg < nOutMsgCnt && idxInBlock < nTransactionsCountInBlock; ++nIdxCurrentMsg, ++idxInBlock, ++cntAccumulatedForBlock ) {
                const idxProcessing = cntProcessed + idxInBlock;
                if( idxProcessing > nMaxTransactionsCount )
                    break;
                //
                //
                strActionName = "src-chain.MessageProxy.getPastEvents()";
                details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) +
                cc.debug( " for " ) + cc.info( "OutgoingMessage" ) + cc.debug( " event, starting block number is " ) +
                cc.info( nBlockFrom ) + cc.debug( ", current latest block number is ~ " ) + cc.info( nLatestBlockNumber ) +
                cc.debug( "..." ) + "\n" );
                r = await get_web3_pastEvents(
                    details,
                    10,
                    jo_message_proxy_src,
                    "OutgoingMessage",
                    nBlockFrom,
                    nBlockTo,
                    {
                        dstChainHash: [ w3_src.utils.soliditySha3( chain_id_dst ) ],
                        msgCounter: [ nIdxCurrentMsg ]
                    }
                );
                //details.write( strLogPrefix + cc.normal( "Logs search result(s): " ) + cc.j( r ) + "\n" );
                let joValues = "";
                for( let i = r.length - 1; i >= 0; i-- ) {
                    if( r[i].returnValues.dstChainHash == w3_src.utils.soliditySha3( chain_id_dst ) ) {
                        joValues = r[i].returnValues;
                        if( blockNumberNextForecast === 0 )
                            blockNumberNextForecast = w3mod.utils.toHex( r[i].blockNumber );
                        else {
                            const oldBN = w3_src.utils.toBN( blockNumberNextForecast );
                            const newBN = w3_src.utils.toBN( r[i].blockNumber );
                            if( newBN.lt( oldBN ) ) {
                                blockNumberNextForecast = "0x" + newBN.toString( 16 );
                                details.write( strLogPrefix + cc.normal( "Narrowing next forecasted block number for logs search is " ) + cc.info( blockNumberNextForecast ) + "\n" );
                            }
                        }
                        break;
                    }
                }
                details.write( strLogPrefix + cc.normal( "Next forecasted block number for logs search is " ) + cc.info( blockNumberNextForecast ) + "\n" );
                if( joValues == "" ) {
                    log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " + cc.error( "Can't get events from MessageProxy" ) + "\n" );
                    details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " + cc.error( "Can't get events from MessageProxy" ) + "\n" );
                    details.exposeDetailsTo( log, "do_transfer", false );
                    save_transfer_error( details.toString() );
                    details.close();
                    return; // process.exit( 126 );
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
                        details.write( strLogPrefix + cc.debug( "Event transactionHash is " ) + cc.info( transactionHash ) + "\n" );
                        const blockNumber = r[0].blockNumber;
                        details.write( strLogPrefix + cc.debug( "Event blockNumber is " ) + cc.info( blockNumber ) + "\n" );
                        const nLatestBlockNumber = await get_web3_blockNumber( details, 10, w3_src );
                        details.write( strLogPrefix + cc.debug( "Latest blockNumber is " ) + cc.info( nLatestBlockNumber ) + "\n" );
                        const nDist = nLatestBlockNumber - blockNumber;
                        if( nDist < nBlockAwaitDepth )
                            bSecurityCheckPassed = false;
                        details.write( strLogPrefix + cc.debug( "Distance by blockNumber is " ) + cc.info( nDist ) + cc.debug( ", await check is " ) + ( bSecurityCheckPassed ? cc.success( "PASSED" ) : cc.error( "FAILED" ) ) + "\n" );
                    } catch ( err ) {
                        bSecurityCheckPassed = false;
                        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Exception(evaluate block depth) while getting transaction hash and block number during " + strActionName + ": " ) + cc.error( err ) + "\n";
                        if( verbose_get() >= RV_VERBOSE.fatal )
                            log.write( s );
                        details.write( s );
                        details.exposeDetailsTo( log, "do_transfer", false );
                        save_transfer_error( details.toString() );
                        details.close();
                        return false;
                    }
                    strActionName = "" + strActionName_old;
                    if( !bSecurityCheckPassed ) {
                        const s = strLogPrefix + cc.warning( "Block depth check was not passed, canceling search for transfer events" ) + "\n";
                        if( verbose_get() >= RV_VERBOSE.trace )
                            log.write( s );
                        details.write( s );
                        break;
                    }
                } // if( nBlockAwaitDepth > 0 )
                if( nBlockAge > 0 ) {
                    let bSecurityCheckPassed = true;
                    const strActionName_old = "" + strActionName;
                    strActionName = "security check: evaluate block age";
                    try {
                        const transactionHash = r[0].transactionHash;
                        details.write( strLogPrefix + cc.debug( "Event transactionHash is " ) + cc.info( transactionHash ) + "\n" );
                        const blockNumber = r[0].blockNumber;
                        details.write( strLogPrefix + cc.debug( "Event blockNumber is " ) + cc.info( blockNumber ) + "\n" );
                        //
                        //
                        const joBlock = await w3_src.eth.getBlock( blockNumber );
                        if( !owaspUtils.validateInteger( joBlock.timestamp ) )
                            throw new Error( "Block \"timestamp\" is not a valid integer value: " + joBlock.timestamp );
                        const timestampBlock = owaspUtils.toInteger( joBlock.timestamp );
                        details.write( strLogPrefix + cc.debug( "Block   TS is " ) + cc.info( timestampBlock ) + "\n" );
                        const timestampCurrent = parseInt( parseInt( Date.now().valueOf() ) / 1000 );
                        details.write( strLogPrefix + cc.debug( "Current TS is " ) + cc.info( timestampCurrent ) + "\n" );
                        const tsDiff = timestampCurrent - timestampBlock;
                        details.write( strLogPrefix + cc.debug( "Diff    TS is " ) + cc.info( tsDiff ) + "\n" );
                        details.write( strLogPrefix + cc.debug( "Expected diff " ) + cc.info( nBlockAge ) + "\n" );
                        if( tsDiff < nBlockAge )
                            bSecurityCheckPassed = false;
                        details.write( strLogPrefix + cc.debug( "Block age check is " ) + ( bSecurityCheckPassed ? cc.success( "PASSED" ) : cc.error( "FAILED" ) ) + "\n" );
                    } catch ( err ) {
                        bSecurityCheckPassed = false;
                        const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Exception(evaluate block age) while getting block number and timestamp during " + strActionName + ": " ) + cc.error( err ) + "\n";
                        if( verbose_get() >= RV_VERBOSE.fatal )
                            log.write( s );
                        details.write( s );
                        details.exposeDetailsTo( log, "do_transfer", false );
                        save_transfer_error( details.toString() );
                        details.close();
                        return false;
                    }
                    strActionName = "" + strActionName_old;
                    if( !bSecurityCheckPassed ) {
                        details.write( strLogPrefix + cc.warning( "Block age check was not passed, canceling search for transfer events" ) + "\n" );
                        break;
                    }
                } // if( nBlockAge > 0 )
                //
                //
                //
                details.write(
                    strLogPrefix +
                    cc.success( "Got event details from " ) + cc.notice( "getPastEvents()" ) +
                    cc.success( " event invoked with " ) + cc.notice( "msgCounter" ) + cc.success( " set to " ) + cc.info( nIdxCurrentMsg ) +
                    cc.success( " and " ) + cc.notice( "dstChain" ) + cc.success( " set to " ) + cc.info( chain_id_dst ) +
                    cc.success( ", event description: " ) + cc.j( joValues ) + // + cc.j(evs) +
                    "\n"
                );
                //
                //
                details.write( strLogPrefix + cc.debug( "Will process message counter value " ) + cc.info( nIdxCurrentMsg ) + "\n" );
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
            if( "check_time_framing" in global && ( ! global.check_time_framing() ) ) {
                if( verbose_get() >= RV_VERBOSE.information ) {
                    log.write(
                        strLogPrefix + cc.error( "WARNING:" ) + " " +
                        cc.warning( "Time framing overflow (after forming block of messages)" ) +
                        "\n" );
                }
                details.close();
                return;
            }
            //
            //
            // Analyze pending transactions potentially awaited by previous IMA agent running in previous time frame
            if( optsPendingTxAnalysis && "isEnabled" in optsPendingTxAnalysis && optsPendingTxAnalysis.isEnabled ) {
                let joFoundPendingTX = null;
                let wasIgnoredPTX = false;
                try {
                    const strShortMessageProxyAddressToCompareWith = owaspUtils.remove_starting_0x( jo_message_proxy_dst.options.address ).toLowerCase();
                    await async_pending_tx_scanner( details, w3_dst, w3_src, chain_id_dst, chain_id_src, function( joTX ) {
                        if( "to" in joTX ) {
                            if( joTX.to == "holder.value.MessageProxy" ) {
                                joFoundPendingTX = joTX;
                                return false; // stop pending tx scanner
                            }
                            const strShortToAddress = owaspUtils.remove_starting_0x( joTX.to ).toLowerCase();
                            if( strShortToAddress == strShortMessageProxyAddressToCompareWith ) {
                                joFoundPendingTX = joTX;
                                return false; // stop pending tx scanner
                            }
                        }
                        return true; // continue pending tx scanner
                    } );
                    if( joFoundPendingTX ) {
                        details.write(
                            strLogPrefix + cc.warning( "PENDING TRANSACTION ANALYSIS(1) from " ) + cc.u( w3_2_url( w3_dst ) ) +
                            cc.warning( " found un-finished transaction(s) in pending queue to be processed by destination message proxy: " ) +
                            cc.j( joFoundPendingTX ) +
                            "\n" );
                        if( optsPendingTxAnalysis && "isEnabled" in optsPendingTxAnalysis && optsPendingTxAnalysis.isEnabled &&
                            "nTimeoutSecondsBeforeSecondAttempt" in optsPendingTxAnalysis && optsPendingTxAnalysis.nTimeoutSecondsBeforeSecondAttempt > 0
                        ) {
                            details.write( cc.debug( "Sleeping " ) + cc.info( optsPendingTxAnalysis.nTimeoutSecondsBeforeSecondAttempt ) + cc.debug( " seconds before secondary pending transactions analysis..." ) + "\n" );
                            await sleep( optsPendingTxAnalysis.nTimeoutSecondsBeforeSecondAttempt * 1000 );
                            //
                            joFoundPendingTX = null;
                            await async_pending_tx_scanner( w3_dst, w3_src, chain_id_dst, chain_id_src, function( joTX ) {
                                if( "to" in joTX ) {
                                    if( joTX.to == "holder.value.MessageProxy" ) {
                                        joFoundPendingTX = joTX;
                                        return false; // stop pending tx scanner
                                    }
                                    const strShortToAddress = owaspUtils.remove_starting_0x( joTX.to ).toLowerCase();
                                    if( strShortToAddress == strShortMessageProxyAddressToCompareWith ) {
                                        joFoundPendingTX = joTX;
                                        return false; // stop pending tx scanner
                                    }
                                }
                                return true; // continue pending tx scanner
                            } );
                            if( joFoundPendingTX ) {
                                details.write(
                                    strLogPrefix + cc.warning( "PENDING TRANSACTION ANALYSIS(2) from " ) + cc.u( w3_2_url( w3_dst ) ) +
                                    cc.warning( " found un-finished transaction(s) in pending queue to be processed by destination message proxy: " ) +
                                    cc.j( joFoundPendingTX ) +
                                    "\n" );
                                if( "isIgnore2" in optsPendingTxAnalysis && ( !optsPendingTxAnalysis.isIgnore2 ) )
                                    return; // return after 2nd pending transactions analysis
                                details.write(
                                    strLogPrefix + cc.warning( "PENDING TRANSACTION ANALYSIS(2) from " ) + cc.u( w3_2_url( w3_dst ) ) +
                                    cc.warning( " result is " ) + cc.error( "ignored" ) +
                                    "\n" );
                                wasIgnoredPTX = true;
                            }
                        } else {
                            if( "isIgnore" in optsPendingTxAnalysis && ( !optsPendingTxAnalysis.isIgnore ) )
                                return; // return after first 1st transactions analysis
                            details.write(
                                strLogPrefix + cc.warning( "PENDING TRANSACTION ANALYSIS(1) from " ) + cc.u( w3_2_url( w3_dst ) ) +
                                cc.warning( " result is " ) + cc.error( "ignored" ) +
                                "\n" );
                            wasIgnoredPTX = true;
                        }

                    }
                } catch ( err ) {
                    const s =
                        strLogPrefix + cc.error( "PENDING TRANSACTION ANALYSIS ERROR: API call error from " ) +
                        cc.u( w3_2_url( w3_dst ) ) + cc.error( ": " ) + cc.error( err ) + "\n";
                    if( verbose_get() >= RV_VERBOSE.error )
                        log.write( s );
                    details.write( s );
                }
                if( !wasIgnoredPTX ) {
                    details.write(
                        strLogPrefix + cc.success( "PENDING TRANSACTION ANALYSIS did not found transactions to wait for complete" ) +
                        "\n" );
                }
                if( "check_time_framing" in global && ( ! global.check_time_framing() ) ) {
                    if( verbose_get() >= RV_VERBOSE.information ) {
                        log.write(
                            strLogPrefix + cc.error( "WARNING:" ) + " " +
                            cc.warning( "Time framing overflow (after pending transactions analysis)" ) +
                            "\n" );
                    }
                    details.close();
                    return;
                }
            }
            //
            //
            strActionName = "sign messages";
            await fn_sign_messages( messages, nIdxCurrentMsgBlockStart, details, async function( err, jarrMessages, joGlueResult ) {
                const details = log.createMemoryStream();
                if( err ) {
                    bErrorInSigningMessages = true;
                    const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error signing messages: " ) + cc.error( err ) + "\n";
                    if( verbose_get() >= RV_VERBOSE.fatal )
                        log.write( s );
                    details.write( s );
                    details.exposeDetailsTo( log, "do_transfer", false );
                    save_transfer_error( details.toString() );
                    details.close();
                    return;
                }
                if( "check_time_framing" in global && ( ! global.check_time_framing() ) ) {
                    if( verbose_get() >= RV_VERBOSE.information ) {
                        log.write(
                            strLogPrefix + cc.error( "WARNING:" ) + " " +
                            cc.warning( "Time framing overflow (after signing messages)" ) +
                            "\n" );
                    }
                    details.close();
                    return;
                }
                strActionName = "dst-chain.getTransactionCount()";
                const tcnt = await get_web3_transactionCount( details, 10, w3_dst, joAccountDst.address( w3_dst ), null );
                details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( tcnt ) + cc.debug( " from " ) + cc.notice( strActionName ) + "\n" );
                //
                //
                const nBlockSize = arrMessageCounters.length;
                strActionName = "dst-chain.MessageProxy.postIncomingMessages()";
                details.write(
                    strLogPrefix +
                    cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( " for " ) +
                    cc.notice( "block size" ) + cc.debug( " set to " ) + cc.info( nBlockSize ) +
                    cc.debug( ", " ) + cc.notice( "message counters =" ) + cc.debug( " are " ) + cc.info( JSON.stringify( arrMessageCounters ) ) +
                    cc.debug( "..." ) + "\n"
                );
                //
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
                    sign //, // bls signature components
                    // idxLastToPopNotIncluding
                );
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
                    details.write(
                        strLogPrefix +
                        cc.debug( "....debug args for " ) +
                        cc.notice( "msgCounter" ) + cc.debug( " set to " ) + cc.info( nIdxCurrentMsgBlockStart ) + cc.debug( ": " ) +
                        cc.j( joDebugArgs ) + "\n" );
                }
                //
                const gasPrice = await tc_dst.computeGasPrice( w3_dst, 200000000000 );
                details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.notice( gasPrice ) + "\n" );
                const estimatedGas_postIncomingMessages = await tc_dst.computeGas( methodWithArguments_postIncomingMessages, w3_dst, 10000000, gasPrice, joAccountDst.address( w3_dst ), "0" );
                details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGas_postIncomingMessages ) + "\n" );
                //
                const isIgnore_postIncomingMessages = false;
                const strDRC_postIncomingMessages = "postIncomingMessages in message signer";
                await dry_run_call( details, w3_dst, methodWithArguments_postIncomingMessages, joAccountDst, strDRC_postIncomingMessages,isIgnore_postIncomingMessages, gasPrice, estimatedGas_postIncomingMessages, "0" );
                //
                const raw_tx_postIncomingMessages = {
                    chainId: cid_dst,
                    nonce: tcnt,
                    gas: estimatedGas_postIncomingMessages,
                    gasPrice: gasPrice,
                    // "gasLimit": 3000000,
                    to: jo_message_proxy_dst.options.address, // contract address
                    data: dataTx_postIncomingMessages //,
                    // "value": wei_amount // 1000000000000000000 // w3_dst.utils.toWei( (1).toString(), "ether" ) // how much money to send
                };
                const tx_postIncomingMessages = compose_tx_instance( details, strLogPrefix, raw_tx_postIncomingMessages );
                const joPostIncomingMessagesSR = await safe_sign_transaction_with_account( details, w3_dst, tx_postIncomingMessages, raw_tx_postIncomingMessages, joAccountDst );
                let joReceipt = null;
                if( joPostIncomingMessagesSR.joACI.isAutoSend ) {
                    if( optsPendingTxAnalysis && "isEnabled" in optsPendingTxAnalysis && optsPendingTxAnalysis.isEnabled )
                        await async_pending_tx_start( details, w3_dst, w3_src, chain_id_dst, chain_id_src, "" + joPostIncomingMessagesSR.txHashSent );
                    joReceipt = await get_web3_transactionReceipt( details, 10, w3_dst, joPostIncomingMessagesSR.txHashSent );
                } else {
                    const serializedTx_postIncomingMessages = tx_postIncomingMessages.serialize();
                    strActionName = "w3_dst.eth.sendSignedTransaction()";
                    // let joReceipt = await w3_dst.eth.sendSignedTransaction( "0x" + serializedTx_postIncomingMessages.toString( "hex" ) );
                    joReceipt = await safe_send_signed_transaction( details, w3_dst, serializedTx_postIncomingMessages, strActionName, strLogPrefix );
                }
                details.write( strLogPrefix + cc.success( "Result receipt: " ) + cc.j( joReceipt ) + "\n" );

                if( joReceipt && typeof joReceipt == "object" && "gasUsed" in joReceipt ) {
                    jarrReceipts.push( {
                        "description": "do_transfer/postIncomingMessages",
                        "receipt": joReceipt
                    } );
                    print_gas_usage_report_from_array( "(intermediate result) TRANSFER " + chain_id_src + " -> " + chain_id_dst, jarrReceipts );
                    if( optsPendingTxAnalysis && "isEnabled" in optsPendingTxAnalysis && optsPendingTxAnalysis.isEnabled )
                        await async_pending_tx_complete( details, w3_dst, w3_src, chain_id_dst, chain_id_src, "" + joReceipt.transactionHash );
                }
                cntProcessed += cntAccumulatedForBlock;
                //
                //
                //
                //
                //
                //
                //
                details.write( strLogPrefix + cc.debug( "Validating transfer from " ) + cc.info( chain_id_src ) + cc.debug( " to " ) + cc.info( chain_id_dst ) + cc.debug( "..." ) + "\n" );
                //
                // check DepositBox -> Error on Mainnet only
                //
                if( chain_id_dst == "Mainnet" ) {
                    details.write( strLogPrefix + cc.debug( "Validating transfer to Main Net via MessageProxy error absence on Main Net..." ) + "\n" );
                    if( jo_deposit_box_main_net ) {
                        if( joReceipt && "blockNumber" in joReceipt && "transactionHash" in joReceipt ) {
                            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( "PostMessageError" ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) + cc.notice( jo_message_proxy_dst.options.address ) + cc.debug( " contract..." ) + "\n" );
                            const joEvents = await get_contract_call_events( details, w3_dst, jo_message_proxy_dst, "PostMessageError", joReceipt.blockNumber, joReceipt.transactionHash, {} );
                            if( joEvents.length == 0 )
                                details.write( strLogPrefix + cc.success( "Success, verified the " ) + cc.info( "PostMessageError" ) + cc.success( " event of the " ) + cc.info( "MessageProxy" ) + cc.success( "/" ) + cc.notice( jo_message_proxy_dst.options.address ) + cc.success( " contract, no events found" ) + "\n" );
                            else {
                                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.warning( " Failed" ) + cc.error( " verification of the " ) + cc.warning( "PostMessageError" ) + cc.error( " event of the " ) + cc.warning( "MessageProxy" ) + cc.error( "/" ) + cc.notice( jo_message_proxy_dst.options.address ) + cc.error( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
                                details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.warning( " Failed" ) + cc.error( " verification of the " ) + cc.warning( "PostMessageError" ) + cc.error( " event of the " ) + cc.warning( "MessageProxy" ) + cc.error( "/" ) + cc.notice( jo_message_proxy_dst.options.address ) + cc.error( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
                                throw new Error( "Verification failed for the \"PostMessageError\" event of the \"MessageProxy\"/" + jo_message_proxy_dst.options.address + " contract, error events found" );
                            }
                            details.write( strLogPrefix + cc.success( "Done, validated transfer to Main Net via MessageProxy error absence on Main Net" ) + "\n" );
                        } else
                            details.write( strLogPrefix + cc.error( "WARNING:" ) + " " + cc.warn( "Cannot validate transfer to Main Net via MessageProxy error absence on Main Net, no valid transaction receipt provided" ) + "\n" );
                    } else
                        details.write( strLogPrefix + cc.error( "WARNING:" ) + " " + cc.warn( "Cannot validate transfer to Main Net via MessageProxy error absence on Main Net, no MessageProxy provided" ) + "\n" );
                } // if( chain_id_dst == "Mainnet" )

                if( optsStateFile && optsStateFile.isEnabled && "path" in optsStateFile && typeof optsStateFile.path == "string" && optsStateFile.path.length > 0 ) {
                    if( blockNumberNextForecast !== nBlockFrom ) {
                        try {
                            details.write( strLogPrefix + cc.normal( "Saving next forecasted block number for logs search value " ) + cc.info( blockNumberNextForecast ) + "\n" );
                            const strKeyName = ( strDirection == "M2S" ) ? "lastSearchedStartBlockM2S" : "lastSearchedStartBlockS2M";
                            joStateForLogsSearch[strKeyName] = blockNumberNextForecast;
                            const s = JSON.stringify( joStateForLogsSearch, null, 4 );
                            fs.writeFileSync( optsStateFile.path, s );
                        } catch ( err ) {
                        }
                    }
                }

                //
                //
                //
                if( expose_details_get() )
                    details.exposeDetailsTo( log, "do_transfer", true );
                details.close();
            } );
            if( bErrorInSigningMessages )
                break;
        } // while( nIdxCurrentMsg < nOutMsgCnt )
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in do_transfer() during " + strActionName + ": " ) + cc.error( err ) + "\n" );
        details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in do_transfer() during " + strActionName + ": " ) + cc.error( err ) + "\n" );
        details.exposeDetailsTo( log, "do_transfer", false );
        save_transfer_error( details.toString() );
        details.close();
        return false;
    }
    print_gas_usage_report_from_array( "TRANSFER " + chain_id_src + " -> " + chain_id_dst, jarrReceipts );
    if( expose_details_get() )
        details.exposeDetailsTo( log, "do_transfer", true );
    details.close();
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
    constructor( gasPriceMultiplier, gasMultiplier ) {
        this.gasPriceMultiplier = gasPriceMultiplier ? ( 0.0 + gasPriceMultiplier ) : null; // null means use current gasPrice or recommendedGasPrice
        this.gasMultiplier = gasMultiplier ? ( 0.0 + gasMultiplier ) : 1.25;
    }
    async computeGasPrice( w3, maxGasPrice ) {
        const gasPrice = parseInt( await w3.eth.getGasPrice() );
        if( gasPrice == 0 || gasPrice == null || gasPrice == undefined || gasPrice <= 1000000000 )
            return parseInt( "1000000000" );
        else if(
            this.gasPriceMultiplier != null &&
            this.gasPriceMultiplier != undefined &&
            this.gasPriceMultiplier >= 0 &&
            maxGasPrice != null &&
            maxGasPrice != undefined
        ) {
            if( gasPrice * this.gasPriceMultiplier > maxGasPrice )
                return parseInt( maxGasPrice );
            else
                return gasPrice * this.gasPriceMultiplier;
        } else
            return gasPrice;
    }
    async computeGas( methodWithArguments, w3, recommendedGas, gasPrice, addressFrom, ethValue ) {
        let estimatedGas = 0;
        try {
            await methodWithArguments.estimateGas( {
                from: addressFrom,
                gasPrice: gasPrice,
                value: "0x" + w3.utils.toBN( ethValue ).toString( 16 )
            }, function( err, estimatedGasValue ) {
                if( err ) {
                    estimatedGas = 0;
                    return;
                }
                estimatedGas = estimatedGasValue;
            } );
        } catch ( err ) {
            estimatedGas = 0;
        }
        estimatedGas *= this.gasMultiplier;
        estimatedGas = parseInt( "" + estimatedGas ); // avoid using floating point
        if( estimatedGas == 0 )
            estimatedGas = recommendedGas;
        return estimatedGas;
    }
};

const tc_main_net = new TransactionCustomizer( 1.25, 1.25 );
const tc_s_chain = new TransactionCustomizer( null, 1.25 );

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function balanceETH(
    isMainNet,
    w3,
    cid,
    joAccount,
    contractERC20
) {
    strLogPrefix = cc.info( "balanceETH() call" ) + " ";
    try {
        const strAddress = joAccount.address( w3 );
        if( ( !isMainNet ) && contractERC20 ) {
            const balance = await contractERC20.methods.balanceOf( strAddress ).call( { from: strAddress } );
            return balance;
        }
        const balance = await w3.eth.getBalance( strAddress );
        return balance;
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "ERROR:" ) + " " + cc.error( err ) + "\n" );
    }
    return "<no-data-or-error>";
}

async function balanceERC20(
    isMainNet,
    w3,
    cid,
    joAccount,
    strCoinName,
    joABI
) {
    strLogPrefix = cc.info( "balanceETH() call" ) + " ";
    try {
        const strAddress = joAccount.address( w3 );
        const contractERC20 = new w3.eth.Contract( joABI[strCoinName + "_abi"], joABI[strCoinName + "_address"] );
        const balance = await contractERC20.methods.balanceOf( strAddress ).call( { from: strAddress } );
        return balance;
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "ERROR:" ) + " " + cc.error( err ) + "\n" );
    }
    return "<no-data-or-error>";
}

async function ownerOfERC721(
    isMainNet,
    w3,
    cid,
    joAccount,
    strCoinName,
    joABI,
    idToken
) {
    strLogPrefix = cc.info( "ownerOfERC721() call" ) + " ";
    try {
        const strAddress = joAccount.address( w3 );
        const contractERC721 = new w3.eth.Contract( joABI[strCoinName + "_abi"], joABI[strCoinName + "_address"] );
        const owner = await contractERC721.methods.ownerOf( idToken ).call( { from: strAddress } );
        return owner;
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "ERROR:" ) + " " + cc.error( err ) + "\n" );
    }
    return "<no-data-or-error>";
}

async function balanceERC1155(
    isMainNet,
    w3,
    cid,
    joAccount,
    strCoinName,
    joABI,
    idToken
) {
    strLogPrefix = cc.info( "balanceERC1155() call" ) + " ";
    try {
        const strAddress = joAccount.address( w3 );
        const contractERC1155 = new w3.eth.Contract( joABI[strCoinName + "_abi"], joABI[strCoinName + "_address"] );
        const balance = await contractERC1155.methods.balanceOf( strAddress, idToken ).call( { from: strAddress } );
        return balance;
    } catch ( err ) {
        if( verbose_get() >= RV_VERBOSE.fatal )
            log.write( strLogPrefix + cc.fatal( "ERROR:" ) + " " + cc.error( err ) + "\n" );
    }
    return "<no-data-or-error>";
}

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
module.exports.expose_details_get = expose_details_get;
module.exports.expose_details_set = expose_details_set;
module.exports.verbose_get = verbose_get;
module.exports.verbose_set = verbose_set;
module.exports.verbose_parse = verbose_parse;
module.exports.verbose_list = verbose_list;

module.exports.dry_run_is_enabled = dry_run_is_enabled;
module.exports.dry_run_enable = dry_run_enable;
module.exports.dry_run_is_ignored = dry_run_is_ignored;
module.exports.dry_run_ignore = dry_run_ignore;
module.exports.dry_run_call = dry_run_call;
module.exports.get_account_connectivity_info = get_account_connectivity_info;
module.exports.safe_sign_transaction_with_account = safe_sign_transaction_with_account;
module.exports.safe_send_signed_transaction = safe_send_signed_transaction;

module.exports.invoke_has_chain = invoke_has_chain;
module.exports.wait_for_has_chain = wait_for_has_chain;
module.exports.register_s_chain_in_deposit_boxes = register_s_chain_in_deposit_boxes; // step 1
// module.exports.register_main_net_depositBox_on_s_chain = register_main_net_depositBox_on_s_chain; // step 2A
// module.exports.register_main_net_on_s_chain = register_main_net_on_s_chain; // step 2B

module.exports.check_is_registered_s_chain_in_deposit_boxes = check_is_registered_s_chain_in_deposit_boxes; // step 1
// module.exports.check_is_registered_main_net_depositBox_on_s_chain = check_is_registered_main_net_depositBox_on_s_chain; // step 2A
// module.exports.check_is_registered_main_net_on_s_chain = check_is_registered_main_net_on_s_chain; // step 2B

module.exports.reimbursement_show_balance = reimbursement_show_balance;
module.exports.reimbursement_wallet_recharge = reimbursement_wallet_recharge;
module.exports.reimbursement_wallet_withdraw = reimbursement_wallet_withdraw;
module.exports.reimbursement_set_range = reimbursement_set_range;

module.exports.do_eth_payment_from_main_net = do_eth_payment_from_main_net;
module.exports.do_eth_payment_from_s_chain = do_eth_payment_from_s_chain;
module.exports.receive_eth_payment_from_s_chain_on_main_net = receive_eth_payment_from_s_chain_on_main_net;
module.exports.view_eth_payment_from_s_chain_on_main_net = view_eth_payment_from_s_chain_on_main_net;
module.exports.do_erc20_payment_from_main_net = do_erc20_payment_from_main_net;
module.exports.do_erc20_payment_from_s_chain = do_erc20_payment_from_s_chain;
module.exports.do_erc721_payment_from_main_net = do_erc721_payment_from_main_net;
module.exports.do_erc721_payment_from_s_chain = do_erc721_payment_from_s_chain;
module.exports.do_erc1155_payment_from_main_net = do_erc1155_payment_from_main_net;
module.exports.do_erc1155_payment_from_s_chain = do_erc1155_payment_from_s_chain;
module.exports.do_erc1155_batch_payment_from_main_net = do_erc1155_batch_payment_from_main_net;
module.exports.do_erc1155_batch_payment_from_s_chain = do_erc1155_batch_payment_from_s_chain;
module.exports.do_transfer = do_transfer;
module.exports.save_transfer_error = save_transfer_error;
module.exports.get_last_transfer_errors = get_last_transfer_errors;

module.exports.compose_gas_usage_report_from_array = compose_gas_usage_report_from_array;
module.exports.print_gas_usage_report_from_array = print_gas_usage_report_from_array;

module.exports.TransactionCustomizer = TransactionCustomizer;
module.exports.tc_main_net = tc_main_net;
module.exports.tc_s_chain = tc_s_chain;

module.exports.compose_tx_instance = compose_tx_instance;

module.exports.getSleepBetweenTransactionsOnSChainMilliseconds = getSleepBetweenTransactionsOnSChainMilliseconds;
module.exports.setSleepBetweenTransactionsOnSChainMilliseconds = setSleepBetweenTransactionsOnSChainMilliseconds;
module.exports.getWaitForNextBlockOnSChain = getWaitForNextBlockOnSChain;
module.exports.setWaitForNextBlockOnSChain = setWaitForNextBlockOnSChain;
module.exports.get_web3_blockNumber = get_web3_blockNumber;
module.exports.get_web3_pastEvents = get_web3_pastEvents;

module.exports.balanceETH = balanceETH;
module.exports.balanceERC20 = balanceERC20;
module.exports.ownerOfERC721 = ownerOfERC721;
module.exports.balanceERC1155 = balanceERC1155;

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
