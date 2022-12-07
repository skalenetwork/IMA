
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
 * @file loop.js
 * @copyright SKALE Labs 2019-Present
 */

const network_layer = require( "../npms/skale-cool-socket/socket.js" );
const { Worker } = require( "worker_threads" );
const owaspUtils = require( "../npms/skale-owasp/owasp-util.js" );
const cc = owaspUtils.cc;

// const fs = require( "fs" );
const path = require( "path" );
// const url = require( "url" );
// const os = require( "os" );

global.ws = require( "ws" ); // https://www.npmjs.com/package/ws
global.IMA = require( "../npms/skale-ima" );
global.w3mod = IMA.w3mod;
global.ethereumjs_tx = IMA.ethereumjs_tx;
global.ethereumjs_wallet = IMA.ethereumjs_wallet;
global.ethereumjs_util = IMA.ethereumjs_util;
global.compose_tx_instance = IMA.compose_tx_instance;
global.owaspUtils = IMA.owaspUtils;
global.imaUtils = require( "./utils.js" );
IMA.expose_details_set( false );
IMA.verbose_set( IMA.verbose_parse( "info" ) );
global.log = global.imaUtils.log;
global.cc = global.imaUtils.cc;
global.imaCLI = require( "./cli.js" );
global.imaBLS = require( "./bls.js" );
global.rpcCall = require( "./rpc-call.js" );
global.skale_observer = require( "../npms/skale-observer/observer.js" );
global.rpcCall.init();
global.imaOracle = require( "./oracle.js" );
global.imaOracle.init();
global.pwa = require( "./pwa.js" );
global.express = require( "express" );
global.bodyParser = require( "body-parser" );
global.jayson = require( "jayson" );

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Run transfer loop
//

global.check_time_framing = function( d ) {
    try {
        if( imaState.nTimeFrameSeconds <= 0 || imaState.nNodesCount <= 1 )
            return true; // time framing is disabled

        if( d == null || d == undefined )
            d = new Date(); // now

        // const nUtcUnixTimeStamp = Math.floor( d.valueOf() / 1000 ); // Unix UTC timestamp, see https://stackoverflow.com/questions/9756120/how-do-i-get-a-utc-timestamp-in-javascript
        const nUtcUnixTimeStamp = Math.floor( ( d ).getTime() / 1000 ); // https://stackoverflow.com/questions/9756120/how-do-i-get-a-utc-timestamp-in-javascript

        const nSecondsRangeForAllSChains = imaState.nTimeFrameSeconds * imaState.nNodesCount;
        const nMod = Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
        const nActiveNodeFrameIndex = Math.floor( nMod / imaState.nTimeFrameSeconds );
        let bSkip = ( nActiveNodeFrameIndex != imaState.nNodeNumber ) ? true : false;
        let bInsideGap = false;
        //
        const nRangeStart = nUtcUnixTimeStamp - Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
        const nFrameStart = nRangeStart + imaState.nNodeNumber * imaState.nTimeFrameSeconds;
        const nGapStart = nFrameStart + imaState.nTimeFrameSeconds - imaState.nNextFrameGap;
        if( !bSkip ) {
            if( nUtcUnixTimeStamp >= nGapStart ) {
                bSkip = true;
                bInsideGap = true;
            }
        }
        // if( IMA.verbose_get() >= IMA.RV_VERBOSE.trace ) {
        log.write(
            "\n" +
            cc.info( "Unix UTC time stamp" ) + cc.debug( "........" ) + cc.notice( nUtcUnixTimeStamp ) + "\n" +
            cc.info( "All Chains Range" ) + cc.debug( "..........." ) + cc.notice( nSecondsRangeForAllSChains ) + "\n" +
            cc.info( "S-Chain Range Mod" ) + cc.debug( ".........." ) + cc.notice( nMod ) + "\n" +
            cc.info( "Active Node Frame Index" ) + cc.debug( "...." ) + cc.notice( nActiveNodeFrameIndex ) + "\n" +
            cc.info( "Testing Frame Index" ) + cc.debug( "........" ) + cc.notice( imaState.nNodeNumber ) + "\n" +
            cc.info( "Is skip" ) + cc.debug( "...................." ) + cc.yn( bSkip ) + "\n" +
            cc.info( "Is inside gap" ) + cc.debug( ".............." ) + cc.yn( bInsideGap ) + "\n" +
            cc.info( "Range Start" ) + cc.debug( "................" ) + cc.notice( nRangeStart ) + "\n" +
            cc.info( "Frame Start" ) + cc.debug( "................" ) + cc.notice( nFrameStart ) + "\n" +
            cc.info( "Gap Start" ) + cc.debug( ".................." ) + cc.notice( nGapStart ) + "\n"
        );
        // }
        if( bSkip )
            return false;
    } catch ( e ) {
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.fatal )
            log.write( cc.fatal( "Exception in check_time_framing():" ) + cc.error( e ) + "\n" );
    }
    return true;
};

async function single_transfer_loop() {
    const strLogPrefix = cc.attention( "Single Loop:" ) + " ";
    let wasPassedStartCheckPWA = false;
    try {
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
        if( ! global.check_time_framing() ) {
            imaState.wasImaSingleTransferLoopInProgress = false;
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
                log.write( strLogPrefix + cc.warning( "Skipped due to time framing" ) + "\n" );
            IMA.save_transfer_success_all();
            return true;
        }
        if( imaState.isImaSingleTransferLoopInProgress ) {
            imaState.wasImaSingleTransferLoopInProgress = false;
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
                log.write( strLogPrefix + cc.warning( "Skipped due to other single transfer loop is in progress rignt now" ) + "\n" );
            return true;
        }
        if( ! await pwa.check_on_loop_start() ) {
            imaState.wasImaSingleTransferLoopInProgress = false;
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
                log.write( strLogPrefix + cc.warning( "Skipped due to cancel mode reported from PWA" ) + "\n" );
            return true;
        }
        wasPassedStartCheckPWA = true;
        imaState.isImaSingleTransferLoopInProgress = true;
        await pwa.notify_on_loop_start();

        let b0 = true;
        if( IMA.getEnabledOracle() ) {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Will invoke Oracle gas price setup..." ) + "\n" );
            b0 = IMA.do_oracle_gas_price_setup(
                imaState.chainProperties.mn.w3,
                imaState.chainProperties.sc.w3,
                imaState.chainProperties.sc.transactionCustomizer,
                imaState.jo_community_locker,
                imaState.chainProperties.sc.joAccount,
                imaState.chainProperties.mn.cid,
                imaState.chainProperties.sc.cid,
                imaBLS.do_sign_u256
            );
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Oracle gas price setup done: " ) + cc.tf( b0 ) + "\n" );
        }

        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Will invoke M2S transfer..." ) + "\n" );
        const b1 = await IMA.do_transfer( // main-net --> s-chain
            "M2S",
            //
            imaState.chainProperties.mn.w3,
            imaState.jo_message_proxy_main_net,
            imaState.chainProperties.mn.joAccount,
            imaState.chainProperties.sc.w3,
            imaState.jo_message_proxy_s_chain,
            //
            imaState.chainProperties.sc.joAccount,
            imaState.chainProperties.mn.strChainName,
            imaState.chainProperties.sc.strChainName,
            imaState.chainProperties.mn.cid,
            imaState.chainProperties.sc.cid,
            null, // imaState.jo_deposit_box - for logs validation on mainnet
            imaState.jo_token_manager_eth, // for logs validation on s-chain
            imaState.nTransferBlockSizeM2S,
            imaState.nMaxTransactionsM2S,
            imaState.nBlockAwaitDepthM2S,
            imaState.nBlockAgeM2S,
            imaBLS.do_sign_messages_m2s, // fn_sign_messages
            null, // joExtraSignOpts
            imaState.chainProperties.sc.transactionCustomizer
        );
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "M2S transfer done: " ) + cc.tf( b1 ) + "\n" );

        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Will invoke S2M transfer..." ) + "\n" );
        const b2 = await IMA.do_transfer( // s-chain --> main-net
            "S2M",
            //
            imaState.chainProperties.sc.w3,
            imaState.jo_message_proxy_s_chain,
            imaState.chainProperties.sc.joAccount,
            imaState.chainProperties.mn.w3,
            imaState.jo_message_proxy_main_net,
            //
            imaState.chainProperties.mn.joAccount,
            imaState.chainProperties.sc.strChainName,
            imaState.chainProperties.mn.strChainName,
            imaState.chainProperties.sc.cid,
            imaState.chainProperties.mn.cid,
            imaState.jo_deposit_box_eth, // for logs validation on mainnet
            null, // imaState.jo_token_manager, // for logs validation on s-chain
            imaState.nTransferBlockSizeS2M,
            imaState.nMaxTransactionsS2M,
            imaState.nBlockAwaitDepthS2M,
            imaState.nBlockAgeS2M,
            imaBLS.do_sign_messages_s2m, // fn_sign_messages
            null, // joExtraSignOpts
            imaState.chainProperties.mn.transactionCustomizer
        );
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "S2M transfer done: " ) + cc.tf( b2 ) + "\n" );

        let b3 = true;
        if( imaState.s2s_opts.isEnabled ) {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Will invoke all S2S transfers..." ) + "\n" );
            b3 = await IMA.do_s2s_all( // s-chain --> s-chain
                imaState,
                skale_observer,
                imaState.chainProperties.sc.w3,
                imaState.jo_message_proxy_s_chain,
                //
                imaState.chainProperties.sc.joAccount,
                imaState.chainProperties.sc.strChainName,
                imaState.chainProperties.sc.cid,
                imaState.jo_token_manager_eth, // for logs validation on s-chain
                imaState.nTransferBlockSizeM2S,
                imaState.nMaxTransactionsM2S,
                imaState.nBlockAwaitDepthM2S,
                imaState.nBlockAgeM2S,
                imaBLS.do_sign_messages_s2s, // fn_sign_messages
                imaState.chainProperties.sc.transactionCustomizer
            );
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "All S2S transfers done: " ) + cc.tf( b3 ) + "\n" );
        }

        imaState.isImaSingleTransferLoopInProgress = false;
        const bResult = b0 && b1 && b2 && b3;
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Completed: " ) + cc.tf( bResult ) + "\n" );
        if( wasPassedStartCheckPWA ) {
            await pwa.notify_on_loop_end();
            wasPassedStartCheckPWA = false;
        }
        return bResult;
    } catch ( err ) {
        log.write( strLogPrefix + cc.fatal( "Exception in single transfer loop: " ) + cc.error( owaspUtils.extract_error_message( err ) ) + "\n" );
    }
    imaState.isImaSingleTransferLoopInProgress = false;

    return false;
}
async function single_transfer_loop_with_repeat() {
    await single_transfer_loop();
    setTimeout( single_transfer_loop_with_repeat, imaState.nLoopPeriodSeconds * 1000 );
};
async function run_transfer_loop( isDelayFirstRun ) {
    isDelayFirstRun = owaspUtils.toBoolean( isDelayFirstRun );
    if( isDelayFirstRun )
        setTimeout( single_transfer_loop_with_repeat, imaState.nLoopPeriodSeconds * 1000 );
    else
        await single_transfer_loop_with_repeat();
    return true;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Parallel thread based loop
//

const impl_sleep = ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

const g_workers = [];
const g_clients = [];

async function ensure_have_workers( opts ) {
    if( g_workers.length > 0 )
        return g_workers;
    const cntWorkers = 2;
    for( let idxWorker = 0; idxWorker < cntWorkers; ++ idxWorker ) {
        const workerData = {
            url: "ima_loop_server" + idxWorker,
            cc: {
                isEnabled: cc.isEnabled()
            }
        };
        g_workers.push( new Worker( path.join( __dirname, "loop_worker.js" ), { workerData: workerData } ) );
        // console.log( "Will connect to " + workerData.url );
        g_workers[idxWorker].on( "message", jo => {
            if( network_layer.out_of_worker_apis.on_message( g_workers[idxWorker], jo ) )
                return;
        } );
        g_clients.push( new network_layer.OutOfWorkerSocketClientPipe( workerData.url, g_workers[idxWorker] ) );
        g_clients[idxWorker].on( "message", function( eventData ) {
            const joMessage = eventData.message;
            // console.log( "CLIENT <<<", JSON.stringify( joMessage ) );
            switch ( joMessage.method ) {
            // case "periodic_caching_do_now":
            //     g_arr_schains_cached = joMessage.message;
            //     if( opts && opts.details ) {
            //         opts.details.write(
            //             cc.debug( "Connected " ) + cc.attention( "S-Chains" ) +
            //             cc.debug( " cache was updated using data arrived from SNB worker: " ) +
            //             cc.j( g_arr_schains_cached ) + "\n" );
            //     }
            //     break;
            case "log":
                log.write( cc.attention( "LOOP WORKER" ) + " " + cc.notice( workerData.url ) + " " + joMessage.message );
                break;
            } // switch ( joMessage.method )
        } );
        await impl_sleep( 1000 );
        const jo = {
            method: "init",
            message: {
                opts: {
                    imaState: {
                        "bNoWaitSChainStarted": opts.imaState.bNoWaitSChainStarted,
                        "nMaxWaitSChainAttempts": opts.imaState.nMaxWaitSChainAttempts,
                        "nNodeNumber": opts.imaState.nNodeNumber, // S-Chain node number(zero based)
                        "nNodesCount": opts.imaState.nNodesCount,
                        "nTimeFrameSeconds": opts.imaState.nTimeFrameSeconds, // 0-disable, 60-recommended
                        "nNextFrameGap": opts.imaState.nNextFrameGap,
                        "chainProperties": {
                            "mn": {
                                "joAccount": {
                                    "privateKey": opts.imaState.chainProperties.mn.joAccount.privateKey,
                                    // "address": IMA.owaspUtils.fn_address_impl_,
                                    "strTransactionManagerURL": opts.imaState.chainProperties.mn.joAccount.strTransactionManagerURL,
                                    "tm_priority": opts.imaState.chainProperties.mn.joAccount.tm_priority,
                                    "strSgxURL": opts.imaState.chainProperties.mn.joAccount.strSgxURL,
                                    "strSgxKeyName": opts.imaState.chainProperties.mn.joAccount.strSgxKeyName,
                                    "strPathSslKey": opts.imaState.chainProperties.mn.joAccount.strPathSslKey,
                                    "strPathSslCert": opts.imaState.chainProperties.mn.joAccount.strPathSslCert,
                                    "strBlsKeyName": opts.imaState.chainProperties.mn.joAccount.strBlsKeyName
                                },
                                "w3": null,
                                "strURL": opts.imaState.chainProperties.mn.strURL,
                                "strChainName": opts.imaState.chainProperties.mn.strChainName,
                                "cid": opts.imaState.chainProperties.mn.cid,
                                "joAbiIMA": opts.imaState.chainProperties.mn.joAbiIMA,
                                "bHaveAbiIMA": opts.imaState.chainProperties.mn.bHaveAbiIMA
                            },
                            "sc": {
                                "joAccount": {
                                    "privateKey": opts.imaState.chainProperties.sc.joAccount.privateKey,
                                    // "address": IMA.owaspUtils.fn_address_impl_,
                                    "strTransactionManagerURL": opts.imaState.chainProperties.sc.joAccount.strTransactionManagerURL,
                                    "tm_priority": opts.imaState.chainProperties.sc.joAccount.tm_priority,
                                    "strSgxURL": opts.imaState.chainProperties.sc.joAccount.strSgxURL,
                                    "strSgxKeyName": opts.imaState.chainProperties.sc.joAccount.strSgxKeyName,
                                    "strPathSslKey": opts.imaState.chainProperties.sc.joAccount.strPathSslKey,
                                    "strPathSslCert": opts.imaState.chainProperties.mn.joAccount.strPathSslCert,
                                    "strBlsKeyName": opts.imaState.chainProperties.mn.joAccount.strBlsKeyName
                                },
                                "w3": null,
                                "strURL": opts.imaState.chainProperties.sc.strURL,
                                "strChainName": opts.imaState.chainProperties.sc.strChainName,
                                "cid": opts.imaState.chainProperties.sc.cid,
                                "joAbiIMA": opts.imaState.chainProperties.sc.joAbiIMA,
                                "bHaveAbiIMA": opts.imaState.chainProperties.sc.bHaveAbiIMA
                            }
                            // "tc": {
                            //     "joAccount": {
                            //     }
                            // },
                        },
                        "joAbiSkaleManager": opts.imaState.joAbiSkaleManager,
                        "bHaveSkaleManagerABI": opts.imaState.bHaveSkaleManagerABI,
                        "joSChainDiscovery": {
                            "isSilentReDiscovery": opts.imaState.joSChainDiscovery.isSilentReDiscovery,
                            "repeatIntervalMilliseconds": opts.imaState.joSChainDiscovery.repeatIntervalMilliseconds // zero to disable (for debugging only)
                        }
                    }
                },
                "cc": {
                    "isEnabled": cc.isEnabled()
                }
            }
        };
        g_clients[idxWorker].send( jo );
    } // for( let idxWorker = 0; idxWorker < cntWorkers; ++ idxWorker )
}

async function run_parallel_loops( opts ) {
    log.write( cc.debug( "Will start parallel IMA transfer loops..." ) + "\n" );
    await ensure_have_workers( opts );
    log.write( cc.success( "Done, did parallel IMA transfer loops." ) + "\n" );
}

module.exports.single_transfer_loop_with_repeat = single_transfer_loop_with_repeat;
module.exports.run_transfer_loop = run_transfer_loop;
module.exports.run_parallel_loops = run_parallel_loops;
