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
 * @file observerWorker.mjs
 * @copyright SKALE Labs 2019-Present
 */

import {
    parentPort
} from "worker_threads";
import * as networkLayer from "../skale-cool-socket/socket.mjs";
import { SocketServer } from "../skale-cool-socket/socketServer.mjs";
import * as cc from "../skale-cc/cc.mjs";
import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as skaleObserver from "./observer.mjs";
import * as log from "../skale-log/log.mjs";
import * as threadInfo from "../../agent/threadInfo.mjs";

const gURL = "skale_observer_worker_server";

parentPort.on( "message", jo => {
    if( networkLayer.inWorkerAPIs.onMessage( jo ) )
        return;
} );

const sleep = ( milliseconds ) => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
};

function doSendMessage( type, endpoint, workerUUID, data ) {
    const jo = networkLayer.socketReceivedDataReverseMarshall( data );
    const joSend = {
        "workerMessageType":
            ( type && typeof type == "string" && type.length > 0 )
                ? type : "inWorkerMessage",
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
        self.opts = null;
        self.intervalPeriodicSchainsCaching = null;
        self.bIsPeriodicCachingStepInProgress = false;
        self.mapApiHandlers.init = function( joMessage, joAnswer, eventData, socket ) {
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
            joAnswer.message = {
                "method": "" + joMessage.method,
                "error": null
            };
            self.opts.imaState.chainProperties.mn.joAccount.address =
                owaspUtils.fnAddressImpl_;
            self.opts.imaState.chainProperties.sc.joAccount.address =
                owaspUtils.fnAddressImpl_;
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
            self.opts.imaState.joNodes =
                new owaspUtils.ethersMod.ethers.Contract(
                    self.opts.imaState.joAbiSkaleManager.nodes_address,
                    self.opts.imaState.joAbiSkaleManager.nodes_abi,
                    self.opts.imaState.chainProperties.mn.ethersProvider
                );
            self.opts.imaState.joSChains =
                new owaspUtils.ethersMod.ethers.Contract(
                    self.opts.imaState.joAbiSkaleManager.schains_address,
                    self.opts.imaState.joAbiSkaleManager.schains_abi,
                    self.opts.imaState.chainProperties.mn.ethersProvider
                );
            self.opts.imaState.joSChainsInternal =
                new owaspUtils.ethersMod.ethers.Contract(
                    self.opts.imaState.joAbiSkaleManager.schains_internal_address,
                    self.opts.imaState.joAbiSkaleManager.schains_internal_abi,
                    self.opts.imaState.chainProperties.mn.ethersProvider
                );

            self.opts.imaState.joMessageProxySChain =
                new owaspUtils.ethersMod.ethers.Contract(
                    self.opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_address,
                    self.opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_abi,
                    self.opts.imaState.chainProperties.sc.ethersProvider
                );
            if( log.verboseGet() >= log.verboseReversed().information ) {
                self.log( cc.debug( "Full init compete for in-worker SNB server in " ) +
                    threadInfo.threadDescription() + " " +
                    cc.notice( gURL ) + "\n" );
            }
            return joAnswer;
        };
        self.mapApiHandlers.periodicCachingStart =
            function( joMessage, joAnswer, eventData, socket ) {
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    self.opts.details.write( threadInfo.threadDescription() +
                        cc.debug( " will start periodic SNB refresh ..." ) + "\n" );
                }
                self.periodicCachingStart(
                    socket,
                    joMessage.message.secondsToReDiscoverSkaleNetwork,
                    joMessage.message.strChainNameConnectedTo,
                    joMessage.message.isForceMultiAttemptsUntilSuccess
                );
                joAnswer.message = {
                    "method": "" + joMessage.method,
                    "error": null
                };
                return joAnswer;
            };
        self.mapApiHandlers.periodicCachingStop =
        function( joMessage, joAnswer, eventData, socket ) {
            self.periodicCachingStop();
            joAnswer.message = {
                "method": "" + joMessage.method,
                "error": null
            };
            return joAnswer;
        };
        if( log.verboseGet() >= log.verboseReversed().information ) {
            self.log( cc.debug( "Initialized in-worker SNB server in " ) +
                threadInfo.threadDescription() + cc.debug( " is " ) +
                cc.notice( gURL ) + "\n" );
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
    async periodicCachingDoNow(
        socket,
        secondsToReDiscoverSkaleNetwork,
        strChainNameConnectedTo,
        isForceMultiAttemptsUntilSuccess
    ) {
        const self = this;
        if( self.bIsPeriodicCachingStepInProgress )
            return null;
        let strError = null;
        self.bIsPeriodicCachingStepInProgress = true;
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            self.opts.details.write( threadInfo.threadDescription() +
                cc.debug( " thread will invoke S-Chains caching in " ) +
                ( isForceMultiAttemptsUntilSuccess
                    ? cc.warning( "forced" )
                    : cc.success( "normal" ) ) +
                cc.debug( " mode..." ) + "\n" );
        }
        for( let idxAttempt = 0;
            // eslint-disable-next-line no-unmodified-loop-condition
            idxAttempt < 10 || isForceMultiAttemptsUntilSuccess;
            ++ idxAttempt
        ) {
            try {
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    self.opts.details.write( threadInfo.threadDescription() +
                        cc.debug( " thread will invoke S-Chains caching(attempt + " ) +
                        cc.info( idxAttempt ) + cc.debug( ")..." ) + "\n" );
                }
                strError =
                    await skaleObserver.cacheSChains(
                        strChainNameConnectedTo,
                        self.opts
                    );
                if( ! strError )
                    break;
            } catch ( err ) {
                strError = owaspUtils.extractErrorMessage( err );
                if( ! strError ) {
                    strError = "runtime error without description in " +
                        threadInfo.threadDescription( false );
                }
            }
            await sleep( 5 * 1000 );
        }
        self.bIsPeriodicCachingStepInProgress = false;
        if( strError ) {
            if( log.verboseGet() >= log.verboseReversed().error ) {
                self.log( cc.error( "Parallel periodic SNB caching came across with error: " ) +
                    cc.warning( strError ) + cc.error( " in " ) + threadInfo.threadDescription() +
                    "\n" );
            }
            return strError;
        }
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            self.log( cc.debug( "Parallel periodic SNB caching in " ) +
                threadInfo.threadDescription() + cc.debug( " will notify main thread now" ) +
                "\n" );
        }
        const arrSChains = skaleObserver.getLastCachedSChains();
        const jo = {
            "method": "periodicCachingDoNow",
            "error": null,
            "message": arrSChains
        };
        const isFlush = true;
        socket.send( jo, isFlush );
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            self.log( cc.debug( "Parallel periodic SNB caching in " ) +
                threadInfo.threadDescription() + cc.debug( " did notified main thread now" ) +
                "\n" );
        }
        return null;
    }
    async periodicCachingStart(
        socket,
        secondsToReDiscoverSkaleNetwork,
        strChainNameConnectedTo,
        isForceMultiAttemptsUntilSuccess
    ) {
        const self = this;
        await self.periodicCachingStop();
        if( secondsToReDiscoverSkaleNetwork <= 0 )
            return false;
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            self.opts.details.write(
                cc.debug( "SKALE Observer in " ) + threadInfo.threadDescription() +
                cc.debug( " will do pre-configured periodic SNB refresh each " ) +
                cc.info( secondsToReDiscoverSkaleNetwork ) + cc.debug( " second(s)..." ) +
                "\n" );
        }
        const fnAsyncHandler = async function() {
            try {
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    self.opts.details.write(
                        cc.debug( "SKALE Observer in " ) + threadInfo.threadDescription() +
                        cc.debug( " will do immediate periodic SNB refresh" ) +
                        cc.normal( "(one of each " ) + cc.info( secondsToReDiscoverSkaleNetwork ) +
                        cc.normal( " second(s))" ) + cc.debug( "..." ) + "\n" );
                }
                while( true ) {
                    const strError =
                        await self.periodicCachingDoNow(
                            socket,
                            secondsToReDiscoverSkaleNetwork,
                            strChainNameConnectedTo,
                            ( !!isForceMultiAttemptsUntilSuccess )
                        );
                    if( strError && isForceMultiAttemptsUntilSuccess )
                        continue;
                    isForceMultiAttemptsUntilSuccess = false;
                    break;
                }
            } catch ( err ) {
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    self.log( cc.error( "Periodic SNB caching(async) error in " ) +
                        threadInfo.threadDescription() + cc.debug( ": " ) +
                        cc.warning( strError ) + "\n" );
                }
            }
        };
        const fnPeriodicCaching = function() {
            try {
                if( self.bIsPeriodicCachingStepInProgress )
                    return;
                fnAsyncHandler()
                    .then( () => {
                    } ).catch( ( err ) => {
                        if( log.verboseGet() >= log.verboseReversed().error ) {
                            self.log( cc.error( "Periodic SNB caching(sync-delayed) in " ) +
                                threadInfo.threadDescription() + cc.error( " error: " ) +
                                cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n" );
                        }
                    } );
            } catch ( err ) {
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    self.log( cc.error( "Periodic SNB caching(sync) in " ) +
                        threadInfo.threadDescription() + cc.error( " error: " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n" );
                }
            }
        };
        await fnPeriodicCaching();
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            self.opts.details.write(
                cc.debug( "SKALE Observer in " ) + threadInfo.threadDescription() +
                cc.debug( " did invoked periodic SNB refresh" ) + "\n" );
        }
        self.intervalPeriodicSchainsCaching = setInterval(
            fnPeriodicCaching, secondsToReDiscoverSkaleNetwork * 1000 );
        fnAsyncHandler(); // initial async call
        return true;
    }
    async periodicCachingStop() {
        const self = this;
        if( ! self.intervalPeriodicSchainsCaching )
            return false;
        clearInterval( self.intervalPeriodicSchainsCaching );
        self.intervalPeriodicSchainsCaching = null;
        self.bIsPeriodicCachingStepInProgress = false;
        return true;
    }
};

const acceptor = new networkLayer.InWorkerSocketServerAcceptor( gURL, doSendMessage );
const server = new ObserverServer( acceptor );
server.on( "dispose", function() {
    const self = server;
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        self.log( cc.debug( "Disposed in-worker in " ) +
            threadInfo.threadDescription() + cc.debug( " SNB server" ) + " " +
            cc.notice( gURL ) + "\n" );
    }
} );
