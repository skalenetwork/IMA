
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
 * @file loop_worker.js
 * @copyright SKALE Labs 2019-Present
 */

const { parentPort, workerData } = require( "worker_threads" );
const network_layer = require( "../npms/skale-cool-socket/socket.js" );
const { Server } = require( "../npms/skale-cool-socket/server.js" );
const owaspUtils = require( "../npms/skale-owasp/owasp-util.js" );
const cc = owaspUtils.cc;

const loop = require( "./loop.js" );

parentPort.on( "message", jo => {
    if( network_layer.in_worker_apis.on_message( jo ) )
        return;
} );

function doSendMessage( type, endpoint, worker_uuid, data ) {
    const jo = network_layer.socket_received_data_reverse_marshall( data );
    const joSend = {
        worker_message_type: ( type && typeof type == "string" && type.length > 0 ) ? type : "in_worker_message",
        worker_endpoint: endpoint,
        worker_uuid: worker_uuid,
        data: jo
    };
    parentPort.postMessage( network_layer.socket_sent_data_marshall( joSend ) );
}

class ObserverServer extends Server {
    constructor( acceptor ) {
        super( acceptor );
        const self = this;
        cc.enable( workerData.cc.isEnabled );
        self.opts = null;
        self.intervalPeriodicSchainsCaching = null;
        self.bIsPeriodicCachingStepInProgress = false;
        self.mapApiHandlers.init = function( joMessage, joAnswer, eventData, socket ) {
            self.log = function() {
                const args = Array.prototype.slice.call( arguments );
                const jo = {
                    method: "log",
                    error: null,
                    message: args.join( " " )
                };
                const isFlush = true;
                socket.send( jo, isFlush );
            };
            self.opts = JSON.parse( JSON.stringify( joMessage.message.opts ) );
            self.opts.details = {
                write: self.log
            };
            cc.enable( joMessage.message.cc.isEnabled );
            joAnswer.message = {
                method: "" + joMessage.method,
                error: null
            };
            // self.log( cc.debug( "Initialized in-worker IMA loop ") + cc.info( workerData.url ) + cc.debug( " options:" ) + " " + cc.j( self.opts ) + "\n" );
            //
            self.opts.imaState.chainProperties.mn.joAccount.address = owaspUtils.fn_address_impl_;
            self.opts.imaState.chainProperties.sc.joAccount.address = owaspUtils.fn_address_impl_;
            // self.opts.imaState.chainProperties.tc.joAccount.address = owaspUtils.fn_address_impl_;
            //
            if( self.opts.imaState.chainProperties.mn.strURL && typeof self.opts.imaState.chainProperties.mn.strURL == "string" && self.opts.imaState.chainProperties.mn.strURL.length > 0 ) {
                const u = self.opts.imaState.chainProperties.mn.strURL;
                self.opts.imaState.chainProperties.mn.w3 = skale_observer.getWeb3FromURL( u, self.log );
            } else {
                self.log(
                    cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "Main-net" ) +
                    cc.warning( " URL specified in command line arguments" ) +
                    cc.debug( "(needed for particular operations only)" ) +
                    "\n" );
            }
            //
            if( self.opts.imaState.chainProperties.sc.strURL && typeof self.opts.imaState.chainProperties.sc.strURL == "string" && self.opts.imaState.chainProperties.sc.strURL.length > 0 ) {
                const u = self.opts.imaState.chainProperties.sc.strURL;
                self.opts.imaState.chainProperties.sc.w3 = skale_observer.getWeb3FromURL( u, self.log );
            } else {
                self.log(
                    cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "Main-net" ) +
                    cc.warning( " URL specified in command line arguments" ) +
                    cc.debug( "(needed for particular operations only)" ) +
                    "\n" );
            }
            //
            self.opts.imaState.jo_nodes = new self.opts.imaState.chainProperties.mn.w3.eth.Contract( self.opts.imaState.joAbiSkaleManager.nodes_abi, self.opts.imaState.joAbiSkaleManager.nodes_address );
            self.opts.imaState.jo_schains = new self.opts.imaState.chainProperties.mn.w3.eth.Contract( self.opts.imaState.joAbiSkaleManager.schains_abi, self.opts.imaState.joAbiSkaleManager.schains_address );
            self.opts.imaState.jo_schains_internal = new self.opts.imaState.chainProperties.mn.w3.eth.Contract( self.opts.imaState.joAbiSkaleManager.schains_internal_abi, self.opts.imaState.joAbiSkaleManager.schains_internal_address );
            //
            self.opts.imaState.jo_message_proxy_s_chain = new self.opts.imaState.chainProperties.sc.w3.eth.Contract( self.opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_abi, self.opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_address );
            //
            self.log( cc.debug( "Full init compete for in-worker IMA loop server" ) + " " + cc.notice( workerData.url ) + "\n" );
            //
            /* await */
            global.imaState = self.opts.imaState;
            loop.run_transfer_loop( false );
            return joAnswer;
        };
        self.mapApiHandlers.periodic_caching_start = function( joMessage, joAnswer, eventData, socket ) {
            self.periodic_caching_start(
                socket,
                joMessage.message.secondsToReDiscoverSkaleNetwork,
                joMessage.message.strChainNameConnectedTo,
                joMessage.message.addressFrom
            );
            joAnswer.message = {
                method: "" + joMessage.method,
                error: null
            };
            return joAnswer;
        };
        self.mapApiHandlers.periodic_caching_stop = function( joMessage, joAnswer, eventData, socket ) {
            self.periodic_caching_stop();
            joAnswer.message = {
                method: "" + joMessage.method,
                error: null
            };
            return joAnswer;
        };
        self.log( cc.debug( "Initialized in-worker IMA loop " ) + cc.info( workerData.url ) + cc.debug( " server" ) + "\n" );
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
    async periodic_caching_do_now( socket, secondsToReDiscoverSkaleNetwork, strChainNameConnectedTo, addressFrom ) {
        const self = this;
        if( self.bIsPeriodicCachingStepInProgress )
            return;
        self.bIsPeriodicCachingStepInProgress = true;
        // const strError =
        await skale_observer.cache_schains(
            strChainNameConnectedTo,
            self.opts.imaState.chainProperties.mn.w3,
            self.opts.imaState.chainProperties.sc.w3,
            addressFrom,
            self.opts
        );
        self.bIsPeriodicCachingStepInProgress = false;
        const arr_schains = skale_observer.get_last_cached_schains();
        // self.log( cc.normal( "Got " ) + cc.info( "SKALE NETWORK" ) + cc.normal( " information in worker: " ) + cc.j( arr_schains ) + "\n" );
        const jo = {
            method: "periodic_caching_do_now",
            error: null,
            message: arr_schains
        };
        const isFlush = true;
        socket.send( jo, isFlush );
    }
    async periodic_caching_start( socket, secondsToReDiscoverSkaleNetwork, strChainNameConnectedTo, addressFrom ) {
        const self = this;
        await self.periodic_caching_stop();
        if( secondsToReDiscoverSkaleNetwork <= 0 )
            return false;
        const fn_async_handler = async function() {
            await self.periodic_caching_do_now( socket, secondsToReDiscoverSkaleNetwork, strChainNameConnectedTo, addressFrom );
        };
        self.intervalPeriodicSchainsCaching = setInterval( function() {
            if( self.bIsPeriodicCachingStepInProgress )
                return;
            fn_async_handler()
                .then( () => {
                } ).catch( () => {
                } );
        }, secondsToReDiscoverSkaleNetwork * 1000 );
        fn_async_handler(); // initial async call
        return true;
    }
    async periodic_caching_stop() {
        const self = this;
        if( ! self.intervalPeriodicSchainsCaching )
            return false;
        clearInterval( self.intervalPeriodicSchainsCaching );
        self.intervalPeriodicSchainsCaching = null;
        self.bIsPeriodicCachingStepInProgress = false;
        return true;
    }
};

const acceptor = new network_layer.InWorkerSocketServerAcceptor( workerData.url, doSendMessage );
const server = new ObserverServer( acceptor );
server.on( "dispose", function() {
    const self = server;
    self.log( cc.debug( "Disposed in-worker IMA loop server" ) + " " + cc.notice( workerData.url ) + "\n" );
} );
