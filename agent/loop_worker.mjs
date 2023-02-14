
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
 * @file loop_worker.mjs
 * @copyright SKALE Labs 2019-Present
 */

import { parentPort, workerData } from "worker_threads";
import * as network_layer from "../npms/skale-cool-socket/socket.mjs";
import { SocketServer } from "../npms/skale-cool-socket/socket_server.mjs";
import * as cc from "../npms/skale-cc/cc.mjs";
import * as owaspUtils from "../npms/skale-owasp/owasp-utils.mjs";
import * as loop from "./loop.mjs";
import * as IMA from "../npms/skale-ima/index.mjs";
import * as skale_observer from "../npms/skale-observer/observer.mjs";
import * as imaCLI from "./cli.mjs";
import * as state from "./state.mjs";
import * as pwa from "./pwa.mjs";

let imaState = state.get();

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

class ObserverServer extends SocketServer {
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
            IMA.verbose_set( self.opts.imaState.verbose_ );
            IMA.expose_details_set( self.opts.imaState.expose_details_ );
            IMA.saveTransferEvents.on( "error", function( eventData ) {
                const jo = {
                    method: "save_transfer_error",
                    message: eventData.detail
                };
                const isFlush = true;
                socket.send( jo, isFlush );
            } );
            IMA.saveTransferEvents.on( "success", function( eventData ) {
                const jo = {
                    method: "save_transfer_success",
                    message: eventData.detail
                };
                const isFlush = true;
                socket.send( jo, isFlush );
            } );
            skale_observer.set_last_cached_schains( self.opts.imaState.arr_schains_cached );
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
                self.opts.imaState.chainProperties.mn.ethersProvider = owaspUtils.getEthersProviderFromURL( u );
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
                self.opts.imaState.chainProperties.sc.ethersProvider = owaspUtils.getEthersProviderFromURL( u );
            } else {
                self.log(
                    cc.error( "WARNING:" ) + cc.warning( " No " ) + cc.note( "Main-net" ) +
                    cc.warning( " URL specified in command line arguments" ) +
                    cc.debug( "(needed for particular operations only)" ) +
                    "\n" );
            }
            //
            self.opts.imaState.loop_opts.joRuntimeOpts.isInsideWorker = true;
            self.opts.imaState.doEnableDryRun = function( isEnable ) { return IMA.dry_run_enable( isEnable ); };
            self.opts.imaState.doIgnoreDryRun = function( isIgnore ) { return IMA.dry_run_ignore( isIgnore ); };
            imaState = self.opts.imaState;
            imaState.chainProperties.mn.ethersProvider = null;
            imaState.chainProperties.sc.ethersProvider = null;
            imaState.chainProperties.tc.ethersProvider = null;
            imaState.chainProperties.mn.transactionCustomizer = IMA.get_tc_main_net();
            imaState.chainProperties.sc.transactionCustomizer = IMA.get_tc_s_chain();
            imaState.chainProperties.tc.transactionCustomizer = IMA.get_tc_t_chain();
            state.set( imaState );
            imaCLI.ima_contracts_init();
            //
            self.log(
                cc.debug( "IMA loop worker" ) + " " + cc.notice( workerData.url ) + cc.debug( " will do the following work:" ) + "\n" +
                "    " + cc.info( "Oracle" ) + cc.debug( " operations....." ) + cc.yn( self.opts.imaState.loop_opts.enable_step_oracle ) + "\n" +
                "    " + cc.info( "M2S" ) + cc.debug( " transfers........." ) + cc.yn( self.opts.imaState.loop_opts.enable_step_m2s ) + "\n" +
                "    " + cc.info( "S2M" ) + cc.debug( " transfers........." ) + cc.yn( self.opts.imaState.loop_opts.enable_step_s2m ) + "\n" +
                "    " + cc.info( "S2S" ) + cc.debug( " transfers........." ) + cc.yn( self.opts.imaState.loop_opts.enable_step_s2s ) + "\n"
            );
            /* await */
            loop.run_transfer_loop( self.opts.imaState.loop_opts );
            // loop.single_transfer_loop( self.opts.imaState.loop_opts );
            //
            self.log( cc.debug( "Full init compete for in-worker IMA loop" ) + " " + cc.notice( workerData.url ) + "\n" );
            return joAnswer;
        };
        self.mapApiHandlers.schains_cached = function( joMessage, joAnswer, eventData, socket ) {
            skale_observer.set_last_cached_schains( joMessage.message.arr_schains_cached );
        };
        self.mapApiHandlers.skale_imaNotifyLoopWork = function( joMessage, joAnswer, eventData, socket ) {
            /*await*/ pwa.handle_loop_state_arrived(
                imaState,
                owaspUtils.toInteger( joMessage.params.nNodeNumber ),
                joMessage.params.strLoopWorkType,
                joMessage.params.nIndexS2S,
                joMessage.params.isStart ? true : false,
                owaspUtils.toInteger( joMessage.params.ts ),
                joMessage.params.signature
            );
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
};

const acceptor = new network_layer.InWorkerSocketServerAcceptor( workerData.url, doSendMessage );
const server = new ObserverServer( acceptor );
server.on( "dispose", function() {
    const self = server;
    self.log( cc.debug( "Disposed in-worker IMA loop" ) + " " + cc.notice( workerData.url ) + "\n" );
} );
