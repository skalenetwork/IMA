
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
 * @file loop.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as network_layer from "../npms/skale-cool-socket/socket.mjs";
import * as url from "url";
import { Worker } from "worker_threads";
import * as path from "path";
import * as cc from "../npms/skale-cc/cc.mjs";
import * as log from "../npms/skale-log/log.mjs";
import * as IMA from "../npms/skale-ima/index.mjs";
import * as owaspUtils from "../npms/skale-owasp/owasp-utils.mjs";
// import * as imaUtils from "./utils.mjs";
import * as imaBLS from "./bls.mjs";
import * as skaleObserver from "../npms/skale-observer/observer.mjs";
// import * as imaOracle from "./oracle.mjs";
import * as pwa from "./pwa.mjs";
import * as state from "./state.mjs";

const __dirname = path.dirname( url.fileURLToPath( import.meta.url ) );

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Run transfer loop
//

export function checkTimeFraming( d, strDirection, joRuntimeOpts ) {
    try {
        const imaState = state.get();
        if( imaState.nTimeFrameSeconds <= 0 || imaState.nNodesCount <= 1 )
            return true; // time framing is disabled

        if( d == null || d == undefined )
            d = new Date(); // now

        const nFrameShift = 0;

        // Unix UTC timestamp, see:
        // https://stackoverflow.com/questions/9756120/how-do-i-get-a-utc-timestamp-in-javascript
        const nUtcUnixTimeStamp = Math.floor( ( d ).getTime() / 1000 );

        const nSecondsRangeForAllSChains = imaState.nTimeFrameSeconds * imaState.nNodesCount;
        const nMod = Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
        let nActiveNodeFrameIndex = Math.floor( nMod / imaState.nTimeFrameSeconds );
        if( nFrameShift > 0 ) {
            nActiveNodeFrameIndex += nFrameShift;
            nActiveNodeFrameIndex %= imaState.nNodesCount; // for safety only
        }
        let bSkip = ( nActiveNodeFrameIndex != imaState.nNodeNumber ) ? true : false;
        let bInsideGap = false;

        const nRangeStart =
            nUtcUnixTimeStamp -
            Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
        const nFrameStart = nRangeStart + imaState.nNodeNumber * imaState.nTimeFrameSeconds;
        const nGapStart = nFrameStart + imaState.nTimeFrameSeconds - imaState.nNextFrameGap;
        if( !bSkip ) {
            if( nUtcUnixTimeStamp >= nGapStart ) {
                bSkip = true;
                bInsideGap = true;
            }
        }
        log.write(
            "\n" +
            cc.info( "Unix UTC time stamp" ) + cc.debug( "........" ) +
            cc.attention( nUtcUnixTimeStamp ) + "\n" +
            cc.info( "All Chains Range" ) + cc.debug( "..........." ) +
            cc.notice( nSecondsRangeForAllSChains ) + "\n" +
            cc.info( "S-Chain Range Mod" ) + cc.debug( ".........." ) +
            cc.notice( nMod ) + "\n" +
            cc.info( "Active Node Frame Index" ) + cc.debug( "...." ) +
            cc.notice( nActiveNodeFrameIndex ) + "\n" +
            cc.info( "Testing Frame Index" ) + cc.debug( "........" ) +
            cc.notice( imaState.nNodeNumber ) + "\n" +
            cc.info( "Transfer Direction" ) + cc.debug( "........." ) +
            cc.sunny( strDirection || "NA" ) + "\n" +
            ( ( nFrameShift > 0 )
                ? ( cc.info( "Frame Shift" ) + cc.debug( "................" ) +
                    cc.note( nFrameShift ) + "\n" +
                    cc.info( "S2S known chain index" ) + cc.debug( "......" ) +
                    cc.note( joRuntimeOpts.idxChainKnownForS2S ) + "\n" +
                    cc.info( "S2S known chains count" ) + cc.debug( "....." ) +
                    cc.note( joRuntimeOpts.cntChainsKnownForS2S ) +
                    "\n" +
                    ( ( "joExtraSignOpts" in joRuntimeOpts &&
                        typeof joRuntimeOpts.joExtraSignOpts == "object" )
                        ? cc.info( "S-Chain source" ) + cc.debug( "............." ) +
                          cc.info( joRuntimeOpts.joExtraSignOpts.chain_id_src ) +
                          cc.debug( "/" ) +
                          cc.attention( joRuntimeOpts.joExtraSignOpts.cid_src ) +
                          "\n" +
                          cc.info( "S-Chain destination" ) + cc.debug( "........" ) +
                          cc.info( joRuntimeOpts.joExtraSignOpts.chain_id_dst ) +
                          cc.debug( "/" ) +
                          cc.attention( joRuntimeOpts.joExtraSignOpts.cid_dst ) +
                          "\n"
                        : "" )
                )
                : "" ) +
            cc.info( "Is skip" ) + cc.debug( "...................." ) +
            cc.yn( bSkip ) + "\n" +
            cc.info( "Is inside gap" ) + cc.debug( ".............." ) +
            cc.yn( bInsideGap ) + "\n" +
            cc.info( "Range Start" ) + cc.debug( "................" ) +
            cc.notice( nRangeStart ) + "\n" +
            cc.info( "Frame Start" ) + cc.debug( "................" ) +
            cc.notice( nFrameStart ) + "\n" +
            cc.info( "Gap Start" ) + cc.debug( ".................." ) +
            cc.notice( nGapStart ) + "\n"
        );
        if( bSkip )
            return false;
    } catch ( err ) {
        if( IMA.verboseGet() >= IMA.verboseReversed().fatal ) {
            log.write(
                cc.error( "Exception in time framing check: " ) +
                cc.error( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n" );
        }
    }
    return true;
};

async function singleTransferLoopPartOracle( optsLoop, strLogPrefix ) {
    const imaState = state.get();
    let b0 = true;
    if( optsLoop.enable_step_oracle && IMA.getEnabledOracle() ) {
        if( IMA.verboseGet() >= IMA.verboseReversed().information ) {
            log.write( strLogPrefix +
                cc.debug( "Will invoke Oracle gas price setup..." ) +
                "\n" );
        }
        try {
            if( ! await pwa.checkOnLoopStart( imaState, "oracle" ) ) {
                imaState.loopState.oracle.wasInProgress = false;
                if( IMA.verboseGet() >= IMA.verboseReversed().debug ) {
                    log.write( strLogPrefix +
                        cc.warning( "Skipped(oracle) due to cancel mode reported from PWA" ) +
                        "\n" );
                }
            } else {
                if( checkTimeFraming( null, "oracle", optsLoop.joRuntimeOpts ) ) {
                    imaState.loopState.oracle.isInProgress = true;
                    await pwa.notifyOnLoopStart( imaState, "oracle" );
                    b0 = IMA.doOracleGasPriceSetup(
                        imaState.chainProperties.mn.ethersProvider,
                        imaState.chainProperties.sc.ethersProvider,
                        imaState.chainProperties.sc.transactionCustomizer,
                        imaState.jo_community_locker,
                        imaState.chainProperties.sc.joAccount,
                        imaState.chainProperties.mn.cid,
                        imaState.chainProperties.sc.cid,
                        imaBLS.doSignU256
                    );
                    imaState.loopState.oracle.isInProgress = false;
                    await pwa.notifyOnLoopEnd( imaState, "oracle" );
                } else {
                    if( IMA.verboseGet() >= IMA.verboseReversed().debug ) {
                        log.write( strLogPrefix +
                            cc.warning( "Skipped(oracle) due to time framing check" ) +
                            "\n" );
                    }
                }
            }
        } catch ( err ) {
            log.write( strLogPrefix +
                cc.error( "Oracle operation exception: " ) +
                cc.error( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n" );
            imaState.loopState.oracle.isInProgress = false;
            await pwa.notifyOnLoopEnd( imaState, "oracle" );
            throw err;
        }
        if( IMA.verboseGet() >= IMA.verboseReversed().information ) {
            log.write( strLogPrefix +
                cc.debug( "Oracle gas price setup done: " ) + cc.tf( b0 ) +
                "\n" );
        }
    }
    return b0;
}

async function singleTransferLoopPartM2S( optsLoop, strLogPrefix ) {
    const imaState = state.get();
    let b1 = true;
    if( optsLoop.enable_step_m2s ) {
        if( IMA.verboseGet() >= IMA.verboseReversed().information ) {
            log.write( strLogPrefix +
                cc.debug( "Will invoke M2S transfer..." ) +
                "\n" );
        }
        try {
            if( ! await pwa.checkOnLoopStart( imaState, "m2s" ) ) {
                imaState.loopState.m2s.wasInProgress = false;
                if( IMA.verboseGet() >= IMA.verboseReversed().debug ) {
                    log.write( strLogPrefix +
                        cc.warning( "Skipped(m2s) due to cancel mode reported from PWA" ) +
                        "\n" );
                }
            } else {
                if( checkTimeFraming( null, "m2s", optsLoop.joRuntimeOpts ) ) {
                    imaState.loopState.m2s.isInProgress = true;
                    await pwa.notifyOnLoopStart( imaState, "m2s" );
                    b1 = await IMA.doTransfer( // main-net --> s-chain
                        "M2S",
                        optsLoop.joRuntimeOpts,

                        imaState.chainProperties.mn.ethersProvider,
                        imaState.jo_message_proxy_main_net,
                        imaState.chainProperties.mn.joAccount,
                        imaState.chainProperties.sc.ethersProvider,
                        imaState.jo_message_proxy_s_chain,

                        imaState.chainProperties.sc.joAccount,
                        imaState.chainProperties.mn.strChainName,
                        imaState.chainProperties.sc.strChainName,
                        imaState.chainProperties.mn.cid,
                        imaState.chainProperties.sc.cid,
                        null,
                        imaState.jo_token_manager_eth, // for logs validation on s-chain
                        imaState.nTransferBlockSizeM2S,
                        imaState.nTransferStepsM2S,
                        imaState.nMaxTransactionsM2S,
                        imaState.nBlockAwaitDepthM2S,
                        imaState.nBlockAgeM2S,
                        imaBLS.doSignMessagesM2S,
                        null,
                        imaState.chainProperties.sc.transactionCustomizer
                    );
                    imaState.loopState.m2s.isInProgress = false;
                    await pwa.notifyOnLoopEnd( imaState, "m2s" );
                } else {
                    if( IMA.verboseGet() >= IMA.verboseReversed().debug ) {
                        log.write( strLogPrefix +
                            cc.warning( "Skipped(m2s) due to time framing check" ) +
                            "\n" );
                    }
                }
            }
        } catch ( err ) {
            log.write( strLogPrefix +
                cc.error( "M2S transfer exception: " ) +
                cc.error( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n" );
            imaState.loopState.m2s.isInProgress = false;
            await pwa.notifyOnLoopEnd( imaState, "m2s" );
            throw err;
        }
        if( IMA.verboseGet() >= IMA.verboseReversed().information ) {
            log.write( strLogPrefix +
                cc.debug( "M2S transfer done: " ) + cc.tf( b1 ) +
                "\n" );
        }
    } else {
        if( IMA.verboseGet() >= IMA.verboseReversed().information ) {
            log.write( strLogPrefix +
                cc.debug( "Skipped M2S transfer." ) +
                "\n" );
        }
    }
    return b1;
}

async function singleTransferLoopPartS2M( optsLoop, strLogPrefix ) {
    const imaState = state.get();
    let b2 = true;
    if( optsLoop.enable_step_s2m ) {
        if( IMA.verboseGet() >= IMA.verboseReversed().information ) {
            log.write( strLogPrefix +
                cc.debug( "Will invoke S2M transfer..." ) +
                "\n" );
        }
        try {
            if( ! await pwa.checkOnLoopStart( imaState, "s2m" ) ) {
                imaState.loopState.s2m.wasInProgress = false;
                if( IMA.verboseGet() >= IMA.verboseReversed().debug ) {
                    log.write( strLogPrefix +
                        cc.warning( "Skipped(s2m) due to cancel mode reported from PWA" ) +
                        "\n" );
                }
            } else {
                if( checkTimeFraming( null, "s2m", optsLoop.joRuntimeOpts ) ) {
                    imaState.loopState.s2m.isInProgress = true;
                    await pwa.notifyOnLoopStart( imaState, "s2m" );
                    b2 = await IMA.doTransfer( // s-chain --> main-net
                        "S2M",
                        optsLoop.joRuntimeOpts,

                        imaState.chainProperties.sc.ethersProvider,
                        imaState.jo_message_proxy_s_chain,
                        imaState.chainProperties.sc.joAccount,
                        imaState.chainProperties.mn.ethersProvider,
                        imaState.jo_message_proxy_main_net,

                        imaState.chainProperties.mn.joAccount,
                        imaState.chainProperties.sc.strChainName,
                        imaState.chainProperties.mn.strChainName,
                        imaState.chainProperties.sc.cid,
                        imaState.chainProperties.mn.cid,
                        imaState.jo_deposit_box_eth, // for logs validation on mainnet
                        null,
                        imaState.nTransferBlockSizeS2M,
                        imaState.nTransferStepsS2M,
                        imaState.nMaxTransactionsS2M,
                        imaState.nBlockAwaitDepthS2M,
                        imaState.nBlockAgeS2M,
                        imaBLS.doSignMessagesS2M,
                        null,
                        imaState.chainProperties.mn.transactionCustomizer
                    );
                    imaState.loopState.s2m.isInProgress = false;
                    await pwa.notifyOnLoopEnd( imaState, "s2m" );
                } else {
                    if( IMA.verboseGet() >= IMA.verboseReversed().debug ) {
                        log.write( strLogPrefix +
                            cc.warning( "Skipped(s2m) due to time framing check" ) +
                            "\n" );
                    }
                }
            }
        } catch ( err ) {
            log.write( strLogPrefix +
                cc.error( "S2M transfer exception: " ) +
                cc.error( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n" );
            imaState.loopState.s2m.isInProgress = false;
            await pwa.notifyOnLoopEnd( imaState, "s2m" );
            throw err;
        }
        if( IMA.verboseGet() >= IMA.verboseReversed().information )
            log.write( strLogPrefix + cc.debug( "S2M transfer done: " ) + cc.tf( b2 ) + "\n" );
    } else {
        if( IMA.verboseGet() >= IMA.verboseReversed().information )
            log.write( strLogPrefix + cc.debug( "Skipped S2M transfer." ) + "\n" );
    }
    return b2;
}

async function singleTransferLoopPartS2S( optsLoop, strLogPrefix ) {
    const imaState = state.get();
    let b3 = true;
    if( optsLoop.enable_step_s2s && imaState.s2s_opts.isEnabled ) {
        if( IMA.verboseGet() >= IMA.verboseReversed().information )
            log.write( strLogPrefix + cc.debug( "Will invoke all S2S transfers..." ) + "\n" );
        try {
            b3 = await IMA.doAllS2S( // s-chain --> s-chain
                optsLoop.joRuntimeOpts,
                imaState,
                skaleObserver,
                imaState.chainProperties.sc.ethersProvider,
                imaState.jo_message_proxy_s_chain,
                imaState.chainProperties.sc.joAccount,
                imaState.chainProperties.sc.strChainName,
                imaState.chainProperties.sc.cid,
                imaState.jo_token_manager_eth, // for logs validation on s-chain
                imaState.nTransferBlockSizeS2S,
                imaState.nTransferStepsS2S,
                imaState.nMaxTransactionsS2S,
                imaState.nBlockAwaitDepthMSS,
                imaState.nBlockAgeS2S,
                imaBLS.doSignMessagesS2S,
                imaState.chainProperties.sc.transactionCustomizer
            );
        } catch ( err ) {
            log.write( strLogPrefix +
                cc.error( "S2S transfer exception: " ) +
                cc.error( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n" );
            throw err;
        }
        if( IMA.verboseGet() >= IMA.verboseReversed().information ) {
            log.write( strLogPrefix +
                cc.debug( "All S2S transfers done: " ) + cc.tf( b3 ) +
                "\n" );
        }
    } else {
        if( IMA.verboseGet() >= IMA.verboseReversed().information ) {
            log.write( strLogPrefix +
                cc.debug( "Skipped S2S transfer." ) +
                "\n" );
        }
    }
    return b3;
}

export async function singleTransferLoop( optsLoop ) {
    const imaState = state.get();
    const strLogPrefix = cc.attention( "Single Loop:" ) + " ";
    try {
        if( IMA.verboseGet() >= IMA.verboseReversed().debug )
            log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
        if( ( optsLoop.enable_step_oracle && imaState.loopState.oracle.isInProgress ) ||
            ( optsLoop.enable_step_m2s && imaState.loopState.m2s.isInProgress ) ||
            ( optsLoop.enable_step_s2m && imaState.loopState.s2m.isInProgress ) ||
            ( optsLoop.enable_step_s2s && imaState.loopState.s2s.isInProgress )
        ) {
            imaState.loopState.oracle.wasInProgress = false;
            imaState.loopState.m2s.wasInProgress = false;
            imaState.loopState.s2m.wasInProgress = false;
            imaState.loopState.s2s.wasInProgress = false;
            if( IMA.verboseGet() >= IMA.verboseReversed().debug ) {
                log.write( strLogPrefix +
                    cc.warning( "Skipped due to other single " +
                        "transfer loop is in progress right now" ) +
                    "\n" );
            }
            return true;
        }
        const b0 = await singleTransferLoopPartOracle( optsLoop, strLogPrefix );
        const b1 = await singleTransferLoopPartM2S( optsLoop, strLogPrefix );
        const b2 = await singleTransferLoopPartS2M( optsLoop, strLogPrefix );
        const b3 = await singleTransferLoopPartS2S( optsLoop, strLogPrefix );
        const bResult = b0 && b1 && b2 && b3;
        if( IMA.verboseGet() >= IMA.verboseReversed().information )
            log.write( strLogPrefix + cc.debug( "Completed: " ) + cc.tf( bResult ) + "\n" );
        return bResult;
    } catch ( err ) {
        log.write( strLogPrefix +
            cc.fatal( "Exception in single transfer loop: " ) +
            cc.error( owaspUtils.extractErrorMessage( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n" );
    }
    imaState.loopState.oracle.isInProgress = false;
    imaState.loopState.m2s.isInProgress = false;
    imaState.loopState.s2m.isInProgress = false;
    imaState.loopState.s2s.isInProgress = false;
    return false;
}
export async function singleTransferLoopWithRepeat( optsLoop ) {
    const imaState = state.get();
    await singleTransferLoop( optsLoop );
    setTimeout( async function() {
        await singleTransferLoopWithRepeat( optsLoop );
    }, imaState.nLoopPeriodSeconds * 1000 );
};
export async function runTransferLoop( optsLoop ) {
    const imaState = state.get();
    const isDelayFirstRun = owaspUtils.toBoolean( optsLoop.isDelayFirstRun );
    if( isDelayFirstRun ) {
        setTimeout( async function() {
            await singleTransferLoopWithRepeat( optsLoop );
        }, imaState.nLoopPeriodSeconds * 1000 );
    } else
        await singleTransferLoopWithRepeat( optsLoop );
    return true;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Parallel thread based loop
//

const sleepImpl = ( milliseconds ) => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
};

const g_workers = [];
const g_clients = [];

export function notifyCacheChangedSNB( arr_schains_cached ) {
    const cntWorkers = g_workers.length;
    for( let idxWorker = 0; idxWorker < cntWorkers; ++ idxWorker ) {
        const jo = {
            "method": "schains_cached",
            "message": {
                "arr_schains_cached": arr_schains_cached
            }
        };
        g_clients[idxWorker].send( jo );
    }
}

skaleObserver.events.on( "chainsCacheChanged", function( eventData ) {
    notifyCacheChangedSNB( eventData.detail.arr_schains_cached );
} );

function constructChainProperties( opts ) {
    return {
        "mn": {
            "joAccount": {
                "privateKey":
                    opts.imaState.chainProperties.mn.joAccount.privateKey,
                "address_":
                    opts.imaState.chainProperties.mn.joAccount.address_,
                "strTransactionManagerURL":
                    opts.imaState.chainProperties.mn
                        .joAccount.strTransactionManagerURL,
                "tm_priority":
                    opts.imaState.chainProperties.mn.joAccount.tm_priority,
                "strSgxURL":
                    opts.imaState.chainProperties.mn.joAccount.strSgxURL,
                "strSgxKeyName":
                    opts.imaState.chainProperties.mn.joAccount.strSgxKeyName,
                "strPathSslKey":
                    opts.imaState.chainProperties.mn.joAccount.strPathSslKey,
                "strPathSslCert":
                    opts.imaState.chainProperties.mn.joAccount.strPathSslCert,
                "strBlsKeyName":
                    opts.imaState.chainProperties.mn.joAccount.strBlsKeyName
            },
            "ethersProvider": null,
            "strURL": opts.imaState.chainProperties.mn.strURL,
            "strChainName": opts.imaState.chainProperties.mn.strChainName,
            "cid": opts.imaState.chainProperties.mn.cid,
            "joAbiIMA": opts.imaState.chainProperties.mn.joAbiIMA,
            "bHaveAbiIMA": opts.imaState.chainProperties.mn.bHaveAbiIMA
        },
        "sc": {
            "joAccount": {
                "privateKey":
                    opts.imaState.chainProperties.sc.joAccount.privateKey,
                "address_":
                    opts.imaState.chainProperties.sc.joAccount.address_,
                "strTransactionManagerURL":
                    opts.imaState.chainProperties.sc
                        .joAccount.strTransactionManagerURL,
                "tm_priority":
                    opts.imaState.chainProperties.sc.joAccount.tm_priority,
                "strSgxURL":
                    opts.imaState.chainProperties.sc.joAccount.strSgxURL,
                "strSgxKeyName":
                    opts.imaState.chainProperties.sc.joAccount.strSgxKeyName,
                "strPathSslKey":
                    opts.imaState.chainProperties.sc.joAccount.strPathSslKey,
                "strPathSslCert":
                    opts.imaState.chainProperties.mn.joAccount.strPathSslCert,
                "strBlsKeyName":
                    opts.imaState.chainProperties.mn.joAccount.strBlsKeyName
            },
            "ethersProvider": null,
            "strURL": opts.imaState.chainProperties.sc.strURL,
            "strChainName": opts.imaState.chainProperties.sc.strChainName,
            "cid": opts.imaState.chainProperties.sc.cid,
            "joAbiIMA": opts.imaState.chainProperties.sc.joAbiIMA,
            "bHaveAbiIMA": opts.imaState.chainProperties.sc.bHaveAbiIMA
        },
        "tc": {
            "joAccount": {
                "privateKey":
                    opts.imaState.chainProperties.tc.joAccount.privateKey,
                "address_":
                    opts.imaState.chainProperties.tc.joAccount.address_,
                "strTransactionManagerURL":
                    opts.imaState.chainProperties.tc
                        .joAccount.strTransactionManagerURL,
                "tm_priority":
                    opts.imaState.chainProperties.tc.joAccount.tm_priority,
                "strSgxURL":
                    opts.imaState.chainProperties.tc.joAccount.strSgxURL,
                "strSgxKeyName":
                    opts.imaState.chainProperties.tc.joAccount.strSgxKeyName,
                "strPathSslKey":
                    opts.imaState.chainProperties.tc.joAccount.strPathSslKey,
                "strPathSslCert":
                    opts.imaState.chainProperties.tc.joAccount.strPathSslCert,
                "strBlsKeyName":
                    opts.imaState.chainProperties.tc.joAccount.strBlsKeyName
            },
            "ethersProvider": null,
            "strURL": opts.imaState.chainProperties.tc.strURL,
            "strChainName": opts.imaState.chainProperties.tc.strChainName,
            "cid": opts.imaState.chainProperties.tc.cid,
            "joAbiIMA": opts.imaState.chainProperties.tc.joAbiIMA,
            "bHaveAbiIMA": opts.imaState.chainProperties.tc.bHaveAbiIMA
        }
    };
}

export async function ensureHaveWorkers( opts ) {
    if( g_workers.length > 0 )
        return g_workers;
    const cntWorkers = 2;
    for( let idxWorker = 0; idxWorker < cntWorkers; ++ idxWorker ) {
        const workerData = {
            url: "ima_loop_server" + idxWorker,
            cc: { isEnabled: cc.isEnabled() }
        };
        g_workers.push(
            new Worker(
                path.join( __dirname, "loop_worker.mjs" ),
                { "type": "module", "workerData": workerData }
            )
        );
        g_workers[idxWorker].on( "message", jo => {
            if( network_layer.out_of_worker_apis.on_message( g_workers[idxWorker], jo ) )
                return;
        } );
        g_clients.push(
            new network_layer.OutOfWorkerSocketClientPipe(
                workerData.url, g_workers[idxWorker] )
        );
        g_clients[idxWorker].on( "message", async function( eventData ) {
            const joMessage = eventData.message;
            switch ( joMessage.method ) {
            case "log":
                log.write(
                    cc.attention( "LOOP WORKER" ) +
                    " " + cc.notice( workerData.url ) +
                    " " + joMessage.message +
                    "\n"
                );
                break;
            case "saveTransferError":
                IMA.saveTransferError(
                    joMessage.message.category,
                    joMessage.message.textLog,
                    joMessage.message.ts
                );
                break;
            case "saveTransferSuccess":
                IMA.saveTransferSuccess( joMessage.message.category );
                break;
            } // switch ( joMessage.method )
        } );
        await sleepImpl( 3 * 1000 );
        const optsLoop = {
            joRuntimeOpts: {
                isInsideWorker: true,
                idxChainKnownForS2S: 0,
                cntChainsKnownForS2S: 0
            },
            isDelayFirstRun: false,
            enable_step_oracle: ( idxWorker == 0 ) ? true : false,
            enable_step_m2s: ( idxWorker == 0 ) ? true : false,
            enable_step_s2m: ( idxWorker == 1 ) ? true : false,
            enable_step_s2s: ( idxWorker == 0 ) ? true : false
        };
        const jo = {
            "method": "init",
            "message": {
                "opts": {
                    "imaState": {
                        "optsLoop": optsLoop,
                        "verbose_": IMA.verboseGet(),
                        "expose_details_": IMA.exposeDetailsGet(),
                        "arr_schains_cached": skaleObserver.getLastCachedSChains(),
                        "loopState": state.g_defaultValueForLoopState,
                        "isPrintGathered": opts.imaState.isPrintGathered,
                        "isPrintSecurityValues": opts.imaState.isPrintSecurityValues,
                        "isPrintPWA": opts.imaState.isPrintPWA,
                        "isDynamicLogInDoTransfer": opts.imaState.isDynamicLogInDoTransfer,
                        "isDynamicLogInBlsSigner": opts.imaState.isDynamicLogInBlsSigner,
                        "bIsNeededCommonInit": false,
                        "bSignMessages": opts.imaState.bSignMessages,
                        "joSChainNetworkInfo": opts.imaState.joSChainNetworkInfo,
                        "strPathBlsGlue": opts.imaState.strPathBlsGlue,
                        "strPathHashG1": opts.imaState.strPathHashG1,
                        "strPathBlsVerify": opts.imaState.strPathBlsVerify,
                        "isEnabledMultiCall": opts.imaState.isEnabledMultiCall,

                        "bNoWaitSChainStarted": opts.imaState.bNoWaitSChainStarted,
                        "nMaxWaitSChainAttempts": opts.imaState.nMaxWaitSChainAttempts,

                        "nTransferBlockSizeM2S": opts.imaState.nTransferBlockSizeM2S,
                        "nTransferBlockSizeS2M": opts.imaState.nTransferBlockSizeS2M,
                        "nTransferBlockSizeS2S": opts.imaState.nTransferBlockSizeS2S,
                        "nTransferStepsM2S": opts.imaState.nTransferStepsM2S,
                        "nTransferStepsS2M": opts.imaState.nTransferStepsS2M,
                        "nTransferStepsS2S": opts.imaState.nTransferStepsS2S,
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

                        "nNodeNumber": opts.imaState.nNodeNumber,
                        "nNodesCount": opts.imaState.nNodesCount,
                        "nTimeFrameSeconds": opts.imaState.nTimeFrameSeconds,
                        "nNextFrameGap": opts.imaState.nNextFrameGap,

                        "jo_community_pool": null,
                        "jo_deposit_box_eth": null,
                        "jo_deposit_box_erc20": null,
                        "jo_deposit_box_erc721": null,
                        "jo_deposit_box_erc1155": null,
                        "jo_deposit_box_erc721_with_metadata": null,
                        "jo_linker": null,

                        "isWithMetadata721": false,

                        "jo_token_manager_eth": null,
                        // "jo_token_manager_eth_target": null,
                        "jo_token_manager_erc20": null,
                        "jo_token_manager_erc20_target": null,
                        "jo_token_manager_erc721": null,
                        "jo_token_manager_erc721_target": null,
                        "jo_token_manager_erc1155": null,
                        "jo_token_manager_erc1155_target": null,
                        "jo_token_manager_erc721_with_metadata": null,
                        "jo_token_manager_erc721_with_metadata_target": null,
                        "jo_community_locker": null,
                        "jo_community_locker_target": null,
                        "jo_message_proxy_main_net": null,
                        "jo_message_proxy_s_chain": null,
                        "jo_message_proxy_s_chain_target": null,
                        "jo_token_manager_linker": null,
                        "jo_token_manager_linker_target": null,
                        "eth_erc20": null,
                        "eth_erc20_target": null,

                        "chainProperties": constructChainProperties( opts ),
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
                            "isSilentReDiscovery":
                                opts.imaState.joSChainDiscovery.isSilentReDiscovery,
                            "repeatIntervalMilliseconds":
                                opts.imaState.joSChainDiscovery.repeatIntervalMilliseconds
                        },

                        "s2s_opts": { // S-Chain to S-Chain transfer options
                            "isEnabled": true,
                            "secondsToReDiscoverSkaleNetwork": 1 * 60 * 60
                        },

                        "nJsonRpcPort": opts.imaState.nJsonRpcPort,
                        "isCrossImaBlsMode": opts.imaState.isCrossImaBlsMode
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

export async function runParallelLoops( opts ) {
    log.write( cc.debug( "Will start parallel IMA transfer loops..." ) + "\n" );
    await ensureHaveWorkers( opts );
    log.write( cc.success( "Done, did parallel IMA transfer loops." ) + "\n" );
    return true;
}

export async function spreadArrivedStateOfPendingWorkAnalysis( joMessage ) {
    if( ! ( joMessage && typeof joMessage == "object" &&
        "method" in joMessage && joMessage.method == "skale_imaNotifyLoopWork" )
    )
        return;
    const cntWorkers = g_workers.length;
    for( let idxWorker = 0; idxWorker < cntWorkers; ++ idxWorker )
        g_clients[idxWorker].send( joMessage );

}
