
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
 * @file observer_worker.js
 * @copyright SKALE Labs 2019-Present
 */

const {
    parentPort
    //, workerData
} = require( "worker_threads" );
const network_layer = require( "../skale-cool-socket/socket.js" );
const { Server } = require( "../skale-cool-socket/server.js" );
const owaspUtils = require( "../skale-owasp/owasp-util.js" );
const cc = owaspUtils.cc;

const skale_observer = require( "./observer.js" );

const g_url = "skale_observer_worker_server";

parentPort.on( "message", jo => {
    if( network_layer.in_worker_apis.on_message( jo ) )
        return;
} );

const sleep = ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

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
            // self.log( cc.debug( "Initialized in-worker options:" ) + " " + cc.j( self.opts ) + "\n" );
            //
            self.opts.imaState.joAccount_main_net.address = owaspUtils.fn_address_impl_;
            self.opts.imaState.joAccount_s_chain.address = owaspUtils.fn_address_impl_;
            //
            if( self.opts.imaState.strURL_main_net && typeof self.opts.imaState.strURL_main_net == "string" && self.opts.imaState.strURL_main_net.length > 0 ) {
                const u = self.opts.imaState.strURL_main_net;
                self.opts.imaState.w3_main_net = skale_observer.getWeb3FromURL( u, self.log );
            } else {
                self.log(
                    cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "Main-net" ) +
                    cc.warning( " URL specified in command line arguments" ) +
                    cc.debug( "(needed for particular operations only)" ) +
                    "\n" );
            }
            //
            if( self.opts.imaState.strURL_s_chain && typeof self.opts.imaState.strURL_s_chain == "string" && self.opts.imaState.strURL_s_chain.length > 0 ) {
                const u = self.opts.imaState.strURL_s_chain;
                self.opts.imaState.w3_s_chain = skale_observer.getWeb3FromURL( u, self.log );
            } else {
                self.log(
                    cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "Main-net" ) +
                    cc.warning( " URL specified in command line arguments" ) +
                    cc.debug( "(needed for particular operations only)" ) +
                    "\n" );
            }
            //
            self.opts.imaState.jo_nodes = new self.opts.imaState.w3_main_net.eth.Contract( self.opts.imaState.joAbiPublishResult_skale_manager.nodes_abi, self.opts.imaState.joAbiPublishResult_skale_manager.nodes_address );
            self.opts.imaState.jo_schains = new self.opts.imaState.w3_main_net.eth.Contract( self.opts.imaState.joAbiPublishResult_skale_manager.schains_abi, self.opts.imaState.joAbiPublishResult_skale_manager.schains_address );
            self.opts.imaState.jo_schains_internal = new self.opts.imaState.w3_main_net.eth.Contract( self.opts.imaState.joAbiPublishResult_skale_manager.schains_internal_abi, self.opts.imaState.joAbiPublishResult_skale_manager.schains_internal_address );
            //
            self.opts.imaState.jo_message_proxy_s_chain = new imaState.w3_s_chain.eth.Contract( self.opts.imaState.joAbiPublishResult_s_chain.message_proxy_chain_abi, self.opts.imaState.joAbiPublishResult_s_chain.message_proxy_chain_address );
            //
            cc.enable( joMessage.message.cc.isEnabled );
            joAnswer.message = {
                method: "" + joMessage.method,
                error: null
            };
            self.log( cc.debug( "Full init compete for in-worker SNB server" ) + " " + cc.notice( g_url ) + "\n" );
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
        self.log( cc.debug( "Initialized in-worker SNB server" ) + " " + cc.notice( g_url ) + "\n" );
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
            return null;
        let strError = null;
        self.bIsPeriodicCachingStepInProgress = true;
        for( let idxAttempt = 0; idxAttempt < 10; ++ idxAttempt ) {
            try {
                strError =
                    await skale_observer.cache_schains(
                        strChainNameConnectedTo,
                        self.opts.imaState.w3_main_net,
                        self.opts.imaState.w3_s_chain,
                        addressFrom,
                        self.opts
                    );
                if( ! strError )
                    break;
            } catch ( err ) {
                strError = owaspUtils.extract_error_message( err );
                if( ! strError )
                    strError = "runtime error without description";
            }
            await sleep( 5 * 1000 );
        }
        self.bIsPeriodicCachingStepInProgress = false;
        if( strError )
            return strError;
        const arr_schains = skale_observer.get_last_cached_schains();
        // self.log( cc.normal( "Got " ) + cc.info( "SKALE NETWORK" ) + cc.normal( " information in worker: " ) + cc.j( arr_schains ) + "\n" );
        const jo = {
            method: "periodic_caching_do_now",
            error: null,
            message: arr_schains
        };
        const isFlush = true;
        socket.send( jo, isFlush );
        return null;
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

const acceptor = new network_layer.InWorkerSocketServerAcceptor( g_url, doSendMessage );
const server = new ObserverServer( acceptor );
server.on( "dispose", function() {
    const self = server;
    self.log( cc.debug( "Disposed in-worker SNB server" ) + " " + cc.notice( g_url ) + "\n" );
} );
