
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

async function single_transfer_loop( loop_opts ) {
    const strLogPrefix = cc.attention( "Single Loop:" ) + " ";
    try {
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
        if( ! global.check_time_framing() ) {
            imaState.loopState.oracle.wasInProgress = false;
            imaState.loopState.m2s.wasInProgress = false;
            imaState.loopState.s2m.wasInProgress = false;
            imaState.loopState.s2s.wasInProgress = false;
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
                log.write( strLogPrefix + cc.warning( "Skipped due to time framing" ) + "\n" );
            IMA.save_transfer_success_all();
            return true;
        }
        if( ( loop_opts.enable_step_oracle && imaState.loopState.oracle.isInProgress ) ||
            ( loop_opts.enable_step_m2s && imaState.loopState.m2s.isInProgress ) ||
            ( loop_opts.enable_step_s2m && imaState.loopState.s2m.isInProgress ) ||
            ( loop_opts.enable_step_s2s && imaState.loopState.s2s.isInProgress )
        ) {
            imaState.loopState.oracle.wasInProgress = false;
            imaState.loopState.m2s.wasInProgress = false;
            imaState.loopState.s2m.wasInProgress = false;
            imaState.loopState.s2s.wasInProgress = false;
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
                log.write( strLogPrefix + cc.warning( "Skipped due to other single transfer loop is in progress rignt now" ) + "\n" );
            return true;
        }

        let b0 = true;
        if( loop_opts.enable_step_oracle && IMA.getEnabledOracle() ) {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Will invoke Oracle gas price setup..." ) + "\n" );
            try {
                if( ! await pwa.check_on_loop_start( imaState, "oracle" ) ) {
                    imaState.loopState.oracle.wasInProgress = false;
                    if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
                        log.write( strLogPrefix + cc.warning( "Skipped due to cancel mode reported from PWA" ) + "\n" );
                } else {
                    imaState.loopState.oracle.isInProgress = true;
                    await pwa.notify_on_loop_start( imaState, "oracle" );
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
                    imaState.loopState.oracle.isInProgress = false;
                    await pwa.notify_on_loop_end( imaState, "oracle" );
                }
            } catch ( err ) {
                log.write( strLogPrefix + cc.error( "Oracle operation exception: " ) + cc.error( owaspUtils.extract_error_message( err ) ) + "\n" );
                imaState.loopState.oracle.isInProgress = false;
                await pwa.notify_on_loop_end( imaState, "oracle" );
                throw err;
            }
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Oracle gas price setup done: " ) + cc.tf( b0 ) + "\n" );
        }

        let b1 = true;
        if( loop_opts.enable_step_m2s ) {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Will invoke M2S transfer..." ) + "\n" );
            try {
                if( ! await pwa.check_on_loop_start( imaState, "m2s" ) ) {
                    imaState.loopState.m2s.wasInProgress = false;
                    if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
                        log.write( strLogPrefix + cc.warning( "Skipped due to cancel mode reported from PWA" ) + "\n" );
                } else {
                    imaState.loopState.m2s.isInProgress = true;
                    await pwa.notify_on_loop_start( imaState, "m2s" );
                    b1 = await IMA.do_transfer( // main-net --> s-chain
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
                    imaState.loopState.m2s.isInProgress = false;
                    await pwa.notify_on_loop_end( imaState, "m2s" );
                }
            } catch ( err ) {
                log.write( strLogPrefix + cc.error( "M2S transfer exception: " ) + cc.error( owaspUtils.extract_error_message( err ) ) + "\n" );
                imaState.loopState.m2s.isInProgress = false;
                await pwa.notify_on_loop_end( imaState, "m2s" );
                throw err;
            }
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "M2S transfer done: " ) + cc.tf( b1 ) + "\n" );
        } else {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Skipped M2S transfer." ) + "\n" );
        }

        let b2 = true;
        if( loop_opts.enable_step_s2m ) {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Will invoke S2M transfer..." ) + "\n" );
            try {
                if( ! await pwa.check_on_loop_start( imaState, "s2m" ) ) {
                    imaState.loopState.s2m.wasInProgress = false;
                    if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
                        log.write( strLogPrefix + cc.warning( "Skipped due to cancel mode reported from PWA" ) + "\n" );
                } else {
                    imaState.loopState.s2m.isInProgress = true;
                    await pwa.notify_on_loop_start( imaState, "s2m" );
                    b2 = await IMA.do_transfer( // s-chain --> main-net
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
                    imaState.loopState.s2m.isInProgress = false;
                    await pwa.notify_on_loop_end( imaState, "s2m" );
                }
            } catch ( err ) {
                log.write( strLogPrefix + cc.error( "S2M transfer exception: " ) + cc.error( owaspUtils.extract_error_message( err ) ) + "\n" );
                imaState.loopState.s2m.isInProgress = false;
                await pwa.notify_on_loop_end( imaState, "s2m" );
                throw err;
            }
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "S2M transfer done: " ) + cc.tf( b2 ) + "\n" );
        } else {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Skipped S2M transfer." ) + "\n" );
        }

        let b3 = true;
        if( loop_opts.enable_step_s2s && imaState.s2s_opts.isEnabled ) {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Will invoke all S2S transfers..." ) + "\n" );
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Will invoke S2M transfer..." ) + "\n" );
            try {
                if( ! await pwa.check_on_loop_start( imaState, "s2s" ) ) {
                    imaState.loopState.s2s.wasInProgress = false;
                    if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
                        log.write( strLogPrefix + cc.warning( "Skipped due to cancel mode reported from PWA" ) + "\n" );
                } else {
                    imaState.loopState.s2s.isInProgress = true;
                    await pwa.notify_on_loop_start( imaState, "s2s" );
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
                    imaState.loopState.s2s.isInProgress = false;
                    await pwa.notify_on_loop_end( imaState, "s2s" );
                }
            } catch ( err ) {
                log.write( strLogPrefix + cc.error( "S2S transfer exception: " ) + cc.error( owaspUtils.extract_error_message( err ) ) + "\n" );
                imaState.loopState.s2s.isInProgress = false;
                await pwa.notify_on_loop_end( imaState, "s2s" );
                throw err;
            }
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "All S2S transfers done: " ) + cc.tf( b3 ) + "\n" );
        } else {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Skipped S2S transfer." ) + "\n" );
        }

        const bResult = b0 && b1 && b2 && b3;
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Completed: " ) + cc.tf( bResult ) + "\n" );
        return bResult;
    } catch ( err ) {
        log.write( strLogPrefix + cc.fatal( "Exception in single transfer loop: " ) + cc.error( owaspUtils.extract_error_message( err ) ) + "\n" );
    }
    imaState.loopState.oracle.isInProgress = false;
    imaState.loopState.m2s.isInProgress = false;
    imaState.loopState.s2m.isInProgress = false;
    imaState.loopState.s2s.isInProgress = false;
    return false;
}
async function single_transfer_loop_with_repeat( loop_opts ) {
    await single_transfer_loop( loop_opts );
    setTimeout( async function() {
        await single_transfer_loop_with_repeat( loop_opts );
    }, imaState.nLoopPeriodSeconds * 1000 );
};
async function run_transfer_loop( loop_opts ) {
    isDelayFirstRun = owaspUtils.toBoolean( loop_opts.isDelayFirstRun );
    if( isDelayFirstRun ) {
        setTimeout( async function() {
            await single_transfer_loop_with_repeat( loop_opts );
        }, imaState.nLoopPeriodSeconds * 1000 );
    } else
        await single_transfer_loop_with_repeat( loop_opts );
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

function notify_snb_chache_changed( arr_schains_cached ) {
    const cntWorkers = g_workers.length;
    for( let idxWorker = 0; idxWorker < cntWorkers; ++ idxWorker ) {
        const jo = {
            method: "schains_cached",
            message: {
                arr_schains_cached: arr_schains_cached
            }
        };
        g_clients[idxWorker].send( jo );
    }
}

skale_observer.events.on( "chainsCacheChanged", function( eventData ) {
    notify_snb_chache_changed( eventData.detail.arr_schains_cached );
} );

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
            case "log":
                log.write( cc.attention( "LOOP WORKER" ) + " " + cc.notice( workerData.url ) + " " + joMessage.message );
                break;
            } // switch ( joMessage.method )
        } );
        await impl_sleep( 1000 );
        const loop_opts = {
            isDelayFirstRun: false,
            enable_step_oracle: ( idxWorker == 0 ) ? true : false,
            enable_step_m2s: ( idxWorker == 0 ) ? true : false,
            enable_step_s2m: ( idxWorker == 1 ) ? true : false,
            enable_step_s2s: ( idxWorker == 0 ) ? true : false
        };
        const jo = {
            method: "init",
            message: {
                opts: {
                    imaState: {
                        loop_opts: loop_opts,
                        verbose_: IMA.verbose_get(),
                        expose_details_: IMA.expose_details_get(),
                        arr_schains_cached: skale_observer.get_last_cached_schains(),
                        //
                        //
                        //
                        "loopState": {
                            "oracle": {
                                "isInProgress": false,
                                "wasInProgress": false
                            },
                            "m2s": {
                                "isInProgress": false,
                                "wasInProgress": false
                            },
                            "s2m": {
                                "isInProgress": false,
                                "wasInProgress": false
                            },
                            "s2s": {
                                "isInProgress": false,
                                "wasInProgress": false
                            }
                        },

                        "isPrintGathered": opts.imaState.isPrintGathered,
                        "isPrintSecurityValues": opts.imaState.isPrintSecurityValues,
                        "isPrintPWA": opts.imaState.isPrintPWA,

                        "bIsNeededCommonInit": false,
                        "bSignMessages": opts.imaState.bSignMessages, // use BLS message signing, turned on with --sign-messages
                        "joSChainNetworkInfo": opts.imaState.joSChainNetworkInfo, // scanned S-Chain network description
                        "strPathBlsGlue": opts.imaState.strPathBlsGlue, // path to bls_glue app, must have if --sign-messages specified
                        "strPathHashG1": opts.imaState.strPathHashG1, // path to hash_g1 app, must have if --sign-messages specified
                        "strPathBlsVerify": opts.imaState.strPathBlsVerify, // path to verify_bls app, optional, if specified then we will verify gathered BLS signature

                        "bNoWaitSChainStarted": opts.imaState.bNoWaitSChainStarted,
                        "nMaxWaitSChainAttempts": opts.imaState.nMaxWaitSChainAttempts,

                        "nTransferBlockSizeM2S": opts.imaState.nTransferBlockSizeM2S,
                        "nTransferBlockSizeS2M": opts.imaState.nTransferBlockSizeS2M,
                        "nTransferBlockSizeS2S": opts.imaState.nTransferBlockSizeS2S,
                        "nMaxTransactionsM2S": opts.imaState.nMaxTransactionsM2S,
                        "nMaxTransactionsS2M": opts.imaState.nMaxTransactionsS2M,
                        "nMaxTransactionsS2S": opts.imaState.nMaxTransactionsS2S,

                        "nBlockAwaitDepthM2S": opts.imaState.nBlockAwaitDepthM2S,
                        "nBlockAwaitDepthS2M": opts.imaState.nBlockAwaitDepthS2M,
                        "nBlockAwaitDepthS2S": opts.imaState.nBlockAwaitDepthS2S,
                        "nBlockAgeM2S": opts.imaState.nBlockAgeM2S,
                        "nBlockAgeS2M": opts.imaState.nBlockAgeS2M,
                        "nBlockAgeS2S": opts.imaState.nBlockAgeS2S,

                        "nLoopPeriodSeconds": opts.imaState.nLoopPeriodSeconds,

                        "nNodeNumber": opts.imaState.nNodeNumber, // S-Chain node number(zero based)
                        "nNodesCount": opts.imaState.nNodesCount,
                        "nTimeFrameSeconds": opts.imaState.nTimeFrameSeconds, // 0-disable, 60-recommended
                        "nNextFrameGap": opts.imaState.nNextFrameGap,

                        "jo_community_pool": null, // only main net
                        "jo_deposit_box_eth": null, // only main net
                        "jo_deposit_box_erc20": null, // only main net
                        "jo_deposit_box_erc721": null, // only main net
                        "jo_deposit_box_erc1155": null, // only main net
                        "jo_deposit_box_erc721_with_metadata": null, // only main net
                        "jo_linker": null, // only main net

                        "isWithMetadata721": false,

                        "jo_token_manager_eth": null, // only s-chain
                        // "jo_token_manager_eth_target": null, // only s-chain target
                        "jo_token_manager_erc20": null, // only s-chain
                        "jo_token_manager_erc20_target": null, // only s-chain
                        "jo_token_manager_erc721": null, // only s-chain target
                        "jo_token_manager_erc721_target": null, // only s-chain target
                        "jo_token_manager_erc1155": null, // only s-chain
                        "jo_token_manager_erc1155_target": null, // only s-chain target
                        "jo_token_manager_erc721_with_metadata": null, // only s-chain target
                        "jo_token_manager_erc721_with_metadata_target": null, // only s-chain target
                        "jo_community_locker": null, // only s-chain
                        "jo_community_locker_target": null, // only s-chain target
                        "jo_message_proxy_main_net": null,
                        "jo_message_proxy_s_chain": null,
                        "jo_message_proxy_s_chain_target": null, // only s-chain target
                        "jo_token_manager_linker": null,
                        "jo_token_manager_linker_target": null, // only s-chain target
                        "eth_erc20": null, // only s-chain
                        // "eth_erc721": null, // only s-chain
                        // "eth_erc1155": null, // only s-chain
                        "eth_erc20_target": null, // only s-chain target
                        // "eth_erc721_target": null, // only s-chain target
                        // "eth_erc1155_target": null, // only s-chain target

                        "chainProperties": {
                            "mn": {
                                "joAccount": {
                                    "privateKey": opts.imaState.chainProperties.mn.joAccount.privateKey,
                                    "address_": opts.imaState.chainProperties.mn.joAccount.address_,
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
                                    "address_": opts.imaState.chainProperties.sc.joAccount.address_,
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
                            },
                            "tc": {
                                "joAccount": {
                                    "privateKey": opts.imaState.chainProperties.tc.joAccount.privateKey,
                                    "address_": opts.imaState.chainProperties.tc.joAccount.address_,
                                    // "address": IMA.owaspUtils.fn_address_impl_,
                                    "strTransactionManagerURL": opts.imaState.chainProperties.tc.joAccount.strTransactionManagerURL,
                                    "tm_priority": opts.imaState.chainProperties.tc.joAccount.tm_priority,
                                    "strSgxURL": opts.imaState.chainProperties.tc.joAccount.strSgxURL,
                                    "strSgxKeyName": opts.imaState.chainProperties.tc.joAccount.strSgxKeyName,
                                    "strPathSslKey": opts.imaState.chainProperties.tc.joAccount.strPathSslKey,
                                    "strPathSslCert": opts.imaState.chainProperties.tc.joAccount.strPathSslCert,
                                    "strBlsKeyName": opts.imaState.chainProperties.tc.joAccount.strBlsKeyName
                                },
                                "w3": null,
                                "strURL": opts.imaState.chainProperties.tc.strURL,
                                "strChainName": opts.imaState.chainProperties.tc.strChainName,
                                "cid": opts.imaState.chainProperties.tc.cid,
                                "joAbiIMA": opts.imaState.chainProperties.tc.joAbiIMA,
                                "bHaveAbiIMA": opts.imaState.chainProperties.tc.bHaveAbiIMA
                            }
                        },
                        "joAbiSkaleManager": opts.imaState.joAbiSkaleManager,
                        "bHaveSkaleManagerABI": opts.imaState.bHaveSkaleManagerABI,

                        "strChainName_origin_chain": opts.imaState.strChainName_origin_chain,

                        "isPWA": opts.imaState.isPWA,
                        "nTimeoutSecondsPWA": opts.imaState.nTimeoutSecondsPWA,

                        "strReimbursementChain": opts.imaState.strReimbursementChain,
                        "isShowReimbursementBalance": opts.imaState.isShowReimbursementBalance,
                        "nReimbursementRecharge": opts.imaState.nReimbursementRecharge,
                        "nReimbursementWithdraw": opts.imaState.nReimbursementWithdraw,
                        "nReimbursementRange": opts.imaState.nReimbursementRange,

                        "joSChainDiscovery": {
                            "isSilentReDiscovery": opts.imaState.joSChainDiscovery.isSilentReDiscovery,
                            "repeatIntervalMilliseconds": opts.imaState.joSChainDiscovery.repeatIntervalMilliseconds // zero to disable (for debugging only)
                        },

                        "s2s_opts": { // S-Chain to S-Chain transfer options
                            "isEnabled": true, // is S-Chain to S-Chain transfers enabled
                            "secondsToReDiscoverSkaleNetwork": 1 * 60 * 60 // seconts to re-discover SKALE network, 0 to disable
                        },

                        "nJsonRpcPort": opts.imaState.nJsonRpcPort, // 0 to disable
                        "isCrossImaBlsMode": opts.imaState.isCrossImaBlsMode

                    }
                },
                "cc": {
                    "isEnabled": cc.isEnabled()
                }
            }
        };
        g_clients[idxWorker].send( jo );
        // notify_snb_chache_changed( skale_observer.get_last_cached_schains() );
    } // for( let idxWorker = 0; idxWorker < cntWorkers; ++ idxWorker )
}

async function run_parallel_loops( opts ) {
    log.write( cc.debug( "Will start parallel IMA transfer loops..." ) + "\n" );
    await ensure_have_workers( opts );
    log.write( cc.success( "Done, did parallel IMA transfer loops." ) + "\n" );
}

async function spread_arrived_pwa_state( joMessage ) {
    if( ! ( joMessage && typeof joMessage == "object" && "method" in joMessage && joMessage.method == "skale_imaNotifyLoopWork" ) )
        return;
    const cntWorkers = g_workers.length;
    for( let idxWorker = 0; idxWorker < cntWorkers; ++ idxWorker )
        g_clients[idxWorker].send( joMessage );

}

module.exports.single_transfer_loop = single_transfer_loop;
module.exports.single_transfer_loop_with_repeat = single_transfer_loop_with_repeat;
module.exports.run_transfer_loop = run_transfer_loop;
module.exports.run_parallel_loops = run_parallel_loops;
module.exports.spread_arrived_pwa_state = spread_arrived_pwa_state;
