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
 * @file loopWorker.mjs
 * @copyright SKALE Labs 2019-Present
 */

import { parentPort, workerData } from "worker_threads";
import * as networkLayer from "../npms/skale-cool-socket/socket.mjs";
import { SocketServer } from "../npms/skale-cool-socket/socketServer.mjs";
import * as cc from "../npms/skale-cc/cc.mjs";
import * as owaspUtils from "../npms/skale-owasp/owaspUtils.mjs";
import * as loop from "./loop.mjs";
import * as imaTx from "../npms/skale-ima/imaTx.mjs";
import * as imaTransferErrorHandling from "../npms/skale-ima/imaTransferErrorHandling.mjs";
import * as skaleObserver from "../npms/skale-observer/observer.mjs";
import * as imaCLI from "./cli.mjs";
import * as state from "./state.mjs";
import * as pwa from "./pwa.mjs";
import * as log from "../npms/skale-log/log.mjs";
import * as threadInfo from "./threadInfo.mjs";

let imaState = state.get();

parentPort.on( "message", jo => {
    if( networkLayer.inWorkerAPIs.onMessage( jo ) )
        return;
} );

function doSendMessage( type, endpoint, workerUUID, data ) {
    const jo = networkLayer.socketReceivedDataReverseMarshall( data );
    const joSend = {
        "workerMessageType":
            ( type && typeof type == "string" && type.length > 0 )
                ? type
                : "inWorkerMessage",
        "workerEndPoint": endpoint,
        "workerUUID": workerUUID,
        "data": jo
    };
    parentPort.postMessage( networkLayer.socketSentDataMarshall( joSend ) );
}

class ObserverServer extends SocketServer {
    constructor( acceptor ) {
        super( acceptor );
        const self = this;
        self.initComplete = false;
        cc.enable( workerData.cc.isEnabled );
        self.opts = null;
        self.intervalPeriodicSchainsCaching = null;
        self.bIsPeriodicCachingStepInProgress = false;
        self.mapApiHandlers.init = function( joMessage, joAnswer, eventData, socket ) {
            joAnswer.message = {
                "method": "" + joMessage.method,
                "error": null
            };
            if( self.initComplete )
                return joAnswer;
            self.log = function() {
                const args = Array.prototype.slice.call( arguments );
                const jo = {
                    "method": "log",
                    "error": null,
                    "message": args.join( " " )
                };
                const isFlush = true;
                socket.send( jo, isFlush );
            };
            self.opts = JSON.parse( JSON.stringify( joMessage.message.opts ) );
            self.opts.details = {
                write: self.log
            };
            cc.enable( joMessage.message.cc.isEnabled );
            log.verboseSet( self.opts.imaState.verbose_ );
            log.exposeDetailsSet( self.opts.imaState.expose_details_ );
            imaTransferErrorHandling.saveTransferEvents.on( "error", function( eventData ) {
                const jo = {
                    "method": "saveTransferError",
                    "message": eventData.detail
                };
                const isFlush = true;
                socket.send( jo, isFlush );
            } );
            imaTransferErrorHandling.saveTransferEvents.on( "success", function( eventData ) {
                const jo = {
                    "method": "saveTransferSuccess",
                    "message": eventData.detail
                };
                const isFlush = true;
                socket.send( jo, isFlush );
            } );
            if( threadInfo.joCustomThreadProperties.isSChainsCacheNeeded ) {
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    log.write(
                        cc.debug( "Loop worker " ) + cc.notice( workerData.url ) +
                        cc.debug( " will save cached S-Chains..." ) + "\n" );
                }
            }
            if( ! self.opts.imaState.optsLoop.enableStepS2S )
                threadInfo.joCustomThreadProperties.isSChainsCacheNeeded = false;
            if( threadInfo.joCustomThreadProperties.isSChainsCacheNeeded ) {
                log.write( cc.debug( "Loop worker " ) + cc.notice( workerData.url ) +
                    cc.debug( " will save cached S-Chains..." ) + "\n" );
            }
            skaleObserver.setLastCachedSChains( self.opts.imaState.arrSChainsCached );
            self.opts.imaState.chainProperties.mn.joAccount.address = owaspUtils.fnAddressImpl_;
            self.opts.imaState.chainProperties.sc.joAccount.address = owaspUtils.fnAddressImpl_;
            if( self.opts.imaState.chainProperties.mn.strURL &&
                typeof self.opts.imaState.chainProperties.mn.strURL == "string" &&
                self.opts.imaState.chainProperties.mn.strURL.length > 0
            ) {
                const u = self.opts.imaState.chainProperties.mn.strURL;
                self.opts.imaState.chainProperties.mn.ethersProvider =
                    owaspUtils.getEthersProviderFromURL( u );
            } else {
                if( log.verboseGet() >= log.verboseReversed().warning ) {
                    self.log( cc.warning( "WARNING:" ) + cc.warning( " No " ) +
                        cc.note( "Main-net" ) +
                        cc.warning( " URL specified in command line arguments" ) +
                        cc.debug( "(needed for particular operations only) in " ) +
                        threadInfo.threadDescription() + "\n" );
                }
            }

            if( self.opts.imaState.chainProperties.sc.strURL &&
                typeof self.opts.imaState.chainProperties.sc.strURL == "string" &&
                self.opts.imaState.chainProperties.sc.strURL.length > 0
            ) {
                const u = self.opts.imaState.chainProperties.sc.strURL;
                self.opts.imaState.chainProperties.sc.ethersProvider =
                    owaspUtils.getEthersProviderFromURL( u );
            } else {
                if( log.verboseGet() >= log.verboseReversed().warning ) {
                    self.log( cc.warning( "WARNING:" ) + cc.warning( " No " ) +
                        cc.note( "Main-net" ) +
                        cc.warning( " URL specified in command line arguments" ) +
                        cc.debug( "(needed for particular operations only) in " ) +
                        threadInfo.threadDescription() + "\n" );
                }
            }

            self.opts.imaState.optsLoop.joRuntimeOpts.isInsideWorker = true;
            imaState = self.opts.imaState;
            imaState.chainProperties.mn.ethersProvider = null;
            imaState.chainProperties.sc.ethersProvider = null;
            imaState.chainProperties.tc.ethersProvider = null;
            imaState.chainProperties.mn.transactionCustomizer =
                imaTx.getTransactionCustomizerForMainNet();
            imaState.chainProperties.sc.transactionCustomizer =
                imaTx.getTransactionCustomizerForSChain();
            imaState.chainProperties.tc.transactionCustomizer =
                imaTx.getTransactionCustomizerForSChainTarget();
            state.set( imaState );
            imaCLI.initContracts();
            self.initComplete = true;
            if( log.verboseGet() >= log.verboseReversed().information ) {
                self.log( cc.debug( "IMA loop worker" ) + " " + cc.notice( workerData.url ) +
                    cc.debug( " will do the following work:" ) + "\n" + "    " +
                    cc.info( "Oracle" ) + cc.debug( " operations....." ) +
                    cc.yn( self.opts.imaState.optsLoop.enableStepOracle ) + "\n" +
                    "    " + cc.info( "M2S" ) + cc.debug( " transfers........." ) +
                    cc.yn( self.opts.imaState.optsLoop.enableStepM2S ) + "\n" +
                    "    " + cc.info( "S2M" ) + cc.debug( " transfers........." ) +
                    cc.yn( self.opts.imaState.optsLoop.enableStepS2M ) + "\n" +
                    "    " + cc.info( "S2S" ) + cc.debug( " transfers........." ) +
                    cc.yn( self.opts.imaState.optsLoop.enableStepS2S ) + "\n" );
            }
            /* await */
            loop.runTransferLoop( self.opts.imaState.optsLoop );
            if( log.verboseGet() >= log.verboseReversed().information ) {
                self.log( cc.debug( "Full init compete for in-worker IMA loop" ) +
                    " " + cc.notice( workerData.url ) + cc.debug( " in " ) +
                    threadInfo.threadDescription() + "\n" );
            }
            return joAnswer;
        };
        self.mapApiHandlers.spreadUpdatedSChainNetwork =
            function( joMessage, joAnswer, eventData, socket ) {
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    self.log( cc.debug( "New own S-Chains network information is arrived to " ) +
                        cc.notice( workerData.url ) + cc.debug( " loop worker in " ) +
                        threadInfo.threadDescription() + cc.debug( ": " ) +
                        cc.j( joMessage.joSChainNetworkInfo ) +
                        cc.debug( ", this own S-Chain update is " ) +
                        ( joMessage.isFinal
                            ? cc.success( "final" ) : cc.warning( "partial" ) ) +
                        "\n" );
                }
                imaState.joSChainNetworkInfo = joMessage.joSChainNetworkInfo;
            };
        self.mapApiHandlers.schainsCached = function( joMessage, joAnswer, eventData, socket ) {
            if( threadInfo.joCustomThreadProperties.isSChainsCacheNeeded ) {
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    self.log( cc.debug( "S-Chains cache did arrived to " ) +
                        cc.notice( workerData.url ) + cc.debug( " loop worker in " ) +
                        threadInfo.threadDescription() + cc.debug( ": " ) +
                        cc.j( joMessage.message.arrSChainsCached ) + "\n" );
                }
            }
            if( ( !joMessage.message.arrSChainsCached ) ||
                joMessage.message.arrSChainsCached.length == 0
            ) {
                if( threadInfo.joCustomThreadProperties.isSChainsCacheNeeded ) {
                    self.log( cc.debug( "Empty S-Chains cache arrived to " ) +
                        cc.notice( workerData.url ) + cc.debug( " will not be renewed in " ) +
                        threadInfo.threadDescription() + "\n" );
                }
                return;
            }
            skaleObserver.setLastCachedSChains( joMessage.message.arrSChainsCached );
        };
        // eslint-disable-next-line dot-notation
        self.mapApiHandlers["skale_imaNotifyLoopWork"] =
            function( joMessage, joAnswer, eventData, socket ) {
                pwa.handleLoopStateArrived( // NOTICE: no await here, executed async
                    imaState,
                    owaspUtils.toInteger( joMessage.params.nNodeNumber ),
                    joMessage.params.strLoopWorkType,
                    joMessage.params.nIndexS2S,
                    ( !!( joMessage.params.isStart ) ),
                    owaspUtils.toInteger( joMessage.params.ts ),
                    joMessage.params.signature
                );
            };
        if( log.verboseGet() >= log.verboseReversed().information ) {
            self.log( cc.debug( "Initialized in-worker IMA loop " ) +
                cc.info( workerData.url ) + cc.debug( " server in " ) +
                threadInfo.threadDescription() + "\n" );
        }
    }
    dispose() {
        const self = this;
        self.isDisposing = true;
        if( self.intervalPeriodicSchainsCaching ) {
            clearInterval( self.intervalPeriodicSchainsCaching );
            self.intervalPeriodicSchainsCaching = null;
        }
        super.dispose();
    }
};

const acceptor = new networkLayer.InWorkerSocketServerAcceptor( workerData.url, doSendMessage );
const server = new ObserverServer( acceptor );
server.on( "dispose", function() {
    const self = server;
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        self.log( cc.debug( "Disposed in-worker in " ) +
        threadInfo.threadDescription() + cc.debug( " IMA loop" ) +
        " " + cc.notice( workerData.url ) + "\n" );
    }
} );
