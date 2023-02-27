// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE COOL SOCKET
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file socket.mjs
 * @copyright SKALE Labs 2019-Present
 */

import { UniversalDispatcherEvent, EventDispatcher } from "./event_dispatcher.mjs";
import { settings } from "./socket_settings.mjs";
import * as utils from "./socket_utils.mjs";

export let https_mod = null; // server side only
export let ws_mod = null; // server side only
export let wrtc_mod = null; // server side only

// if( typeof window == "undefined" ) {
//     try {
//         import * as https_mod from "https";
//         console.log( "Using pre-loaded HTTPS API in socket.mjs" );
//     } catch ( err ) {
//     }
//     try {
//         ws_mod = WebSocket;
//         console.log( "Using pre-loaded WebSocket API in socket.mjs" );
//     } catch ( err ) {
//     }
// } else {
//     try {
//         wrtc_mod = window;
//         console.log( "Using pre-loaded WebSocket API in socket.mjs" );
//     } catch ( err ) {
//     }
// }

// needed to init from outside: import * as https_loaded_mod from "https";
// const https_mod = https_loaded_mod.default;
// needed to init from outside: import * as ws_loaded_mod from "ws";
// const ws_mod = ws_loaded_mod.default;

export function set_https_mod( mod ) {
    https_mod = mod ? mod : null;
}
export function set_ws_mod( mod ) {
    ws_mod = mod ? mod : null;
}
export function set_wrtc_mod( mod ) {
    wrtc_mod = mod ? mod : null;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const g_mapLocalServers = { }; // used both for local and in-worker servers

export const socket_sent_data_marshall = function( data ) {
    const s = data
        ? ( ( typeof data == "string" )
            ? data
            : ( ( typeof data == "object" ) ? JSON.stringify( data ) : data.toString() )
        )
        : "";
    return s;
};
export const socket_received_data_reverse_marshall = function( data ) {
    try {
        const jo = data
            ? ( ( typeof data == "object" )
                ? data
                : ( ( typeof data == "string" ) ? JSON.parse( data ) : data )
            )
            : { };
        return jo;
    } catch ( err ) {
        return {
            "error": true,
            "message": "data un-marshal error",
            "data": data
        };
    }
};

export const update_socket_data_stats_for_message = function( joMessage, joStats ) {
    let strMethod = "_N/A_";
    if( "method" in joMessage &&
        joMessage.method &&
        typeof joMessage.method == "string"
    )
        strMethod = "" + joMessage.method;
    if( strMethod in joStats )
        joStats[strMethod] ++;
    else
        joStats[strMethod] = 1;
};
export const generate_socket_data_stats_JSON = function( jo ) {
    const joStats = {};
    //let cnt = 1;
    if( "arr_packed_messages" in jo &&
        jo.arr_packed_messages &&
        typeof jo.arr_packed_messages == "object"
    ) {
        //cnt = jo.arr_packed_messages.length;
        for( const joMessage of jo.arr_packed_messages )
            update_socket_data_stats_for_message( joMessage, joStats );

    } else
        update_socket_data_stats_for_message( jo, joStats );
    //joStats["_cnt_"] = cnt;
    return joStats;
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class BasicServerAcceptor extends EventDispatcher {
    constructor() {
        super();
        this.socketType = "BasicAcceptor";
        this.socketSubtype = "acceptor";
        this.isListening = false;
        this.strEndPoint = null;
        this.nextClientNumber = 1;
        this.mapClients = { };
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.nextClientNumber = 1;
        this.isListening = false;
        this.disposeNotifyClients();
        super.dispose();
    }
    disposeNotifyClients() {
        for( const [ /*key*/, entry ] of Object.entries( this.mapClients ) ) {
            if( ( "serverPipe" in entry ) && ( "clientPipe" in entry ) ) {
                const pair = entry;
                pair.serverPipe.handleServerDisposed();
                pair.clientPipe.handleServerDisposed();
                pair.serverPipe = null;
                pair.clientPipe = null;
            } else {
                const pipe = entry;
                pipe.handleServerDisposed();
            }
        }
        this.mapClients = { };
    }
    unregisterClientByKey( key ) {
        if( key in this.mapClients ) {
            const entry = this.mapClients[key];
            if( entry ) {
                if( ( "serverPipe" in entry ) && ( "clientPipe" in entry ) ) {
                    const pair = entry;
                    pair.serverPipe = null;
                    pair.clientPipe = null;
                }
                delete this.mapClients[key];
            }
        }
    }
    flush() {
        if( this.isDisposing || this.isDisposed )
            return;
        for( const [ /*key*/, entry ] of Object.entries( this.mapClients ) ) {
            if( ( "serverPipe" in entry ) && ( "clientPipe" in entry ) ) {
                const pair = entry;
                pair.serverPipe.flush();
            } else {
                const pipe = entry;
                pipe.flush();
            }
        }
    }
    newDirectConnection() {
        if( this.isDisposing || this.isDisposed )
            return null;
        if( !this.isListening )
            return null;
        const clientPipe = new DirectPipe( null, false );
        const serverPipe = new DirectPipe( clientPipe, false );
        serverPipe.acceptor = this;
        this.mapClients["" + serverPipe.clientPort] = serverPipe;
        const self = this;
        const iv = setTimeout( function() {
            clearTimeout( iv );
            serverPipe.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": serverPipe } ) );
            self.dispatchEvent( new UniversalDispatcherEvent( "connection", { "socket": serverPipe, "remoteAddress": "" + self.url } ) );
            clientPipe.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": clientPipe } ) );
        }, 0 );
        return clientPipe;
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class BasicSocketPipe extends EventDispatcher {
    constructor() {
        super();
        this.socketType = "N/A";
        this.socketSubtype = "N/A";
        this.url = "N/A";
        this.isConnected = true;
        this.arr_accumulated_messages = [];
        this.maxAccumulatedMessagesCount = 0 + settings.net.pipe.maxAccumulatedMessagesCount;
        this.relayClientSocket = null; // for relay only
        this.mapImpersonatedEntries = { }; // for external in-app usage only
    }
    dispose() {
        if( this.relayClientSocket ) {
            this.relayClientSocket.dispose();
            this.relayClientSocket = null;
        }
        this.disposeImpersonatedEntries(); // for external in-app usage only
        this.disconnect();
        this.arr_accumulated_messages = [];
        super.dispose();
    }
    disposeImpersonatedEntries() { // for external in-app usage only
        for( const [ /*key*/, entry ] of Object.entries( this.mapImpersonatedEntries ) ) {
            try {
                if( entry && "dispose" in entry && typeof entry.dispose == "function" )
                    entry.dispose();
            } catch ( err ) {
            }
        }
        this.mapImpersonatedEntries = { }; // for app usage
    }
    impl_send( data ) {
        throw new Error( "BasicSocketPipe.impl_send() must be overridden but calling it was attempted" );
    }
    is_auto_flush() {
        if( this.maxAccumulatedMessagesCount <= 1 )
            return true;
        const cnt = this.arr_accumulated_messages.length;
        if( cnt == 0 || cnt < this.maxAccumulatedMessagesCount )
            return false;
        return true;
    }
    socketDescription() {
        return "" +
            // + this.socketType
            // + " "
            // + this.socketSubtype
            // + " "
            this.url;
    }
    socketLoggingTextPrefix( strLogEventName ) {
        return "" + strLogEventName + " " + this.socketDescription() + " -";
    }
    send( data, isFlush ) {
        if( this.isDisposed || ( !this.isConnected ) )
            return;
        if( this.is_auto_flush() ) {
            if( settings.logging.net.socket.send || settings.logging.net.socket.flush )
                console.log( this.socketLoggingTextPrefix( "send+flush" ), data );
            this.impl_send( data );
            return;
        }
        isFlush = ( isFlush == undefined || isFlush == null ) ? true : ( isFlush ? true : false );
        const jo = socket_received_data_reverse_marshall( data );
        if( settings.logging.net.socket.accumulate )
            console.log( this.socketLoggingTextPrefix( "accumulate" ), data );
        this.arr_accumulated_messages.push( jo );
        if( isFlush )
            this.flush();
    }
    flush() {
        if( this.isDisposed || ( !this.isConnected ) )
            return;
        const cnt = this.arr_accumulated_messages.length;
        if( cnt == 0 )
            return;
        if( settings.logging.net.socket.flushCount )
            console.log( this.socketLoggingTextPrefix( "flush-count(" + cnt + ")" ) );
        let joSend = null;
        if( cnt == 1 ) {
            joSend = this.arr_accumulated_messages[0];
            if( settings.logging.net.socket.flushOne || settings.logging.net.socket.flush )
                console.log( this.socketLoggingTextPrefix( "flush-one" ), joSend );
        } else {
            joSend = { arr_packed_messages: this.arr_accumulated_messages };
            if( settings.logging.net.socket.flushBlock || settings.logging.net.socket.flush )
                console.log( this.socketLoggingTextPrefix( "flush-block(" + cnt + ")" ), joSend );
        }
        if( settings.logging.net.socket.flushMethodStats )
            console.log( this.socketLoggingTextPrefix( "flush-method-stats(" + cnt + ")" ), generate_socket_data_stats_JSON( joSend ) );
        this.impl_send( joSend );
        this.arr_accumulated_messages = [];
        if( this.relayClientSocket )
            this.relayClientSocket.flush();
    }
    impl_receive( data ) {
        const jo = socket_received_data_reverse_marshall( data );
        this.dispatchEvent( new UniversalDispatcherEvent( "message", { "socket": this, "message": jo } ) );
    }
    receive( data ) {
        if( settings.logging.net.socket.receiveBlock )
            console.log( this.socketLoggingTextPrefix( "receive-block" ), data );
        const jo = socket_received_data_reverse_marshall( data );
        if( "arr_packed_messages" in jo &&
            jo.arr_packed_messages &&
            typeof jo.arr_packed_messages == "object"
        ) {
            const cnt = jo.arr_packed_messages.length;
            if( settings.logging.net.socket.receiveCount )
                console.log( this.socketLoggingTextPrefix( "receive-count(" + cnt + ")" ) );
            if( settings.logging.net.socket.receiveMethodStats )
                console.log( this.socketLoggingTextPrefix( "receive-method-stats(" + cnt + ")" ), generate_socket_data_stats_JSON( jo ) );
            for( let i = 0; i < cnt; ++ i ) {
                const joMessage = jo.arr_packed_messages[i];
                if( settings.logging.net.socket.receive )
                    console.log( this.socketLoggingTextPrefix( "receive" ), joMessage );
                this.impl_receive( joMessage );
            }
            return;
        }
        if( settings.logging.net.socket.receiveCount )
            console.log( this.socketLoggingTextPrefix( "receive-count(" + 1 + ")" ) );
        if( settings.logging.net.socket.receiveMethodStats )
            console.log( this.socketLoggingTextPrefix( "receive-method-stats(" + 1 + ")" ), generate_socket_data_stats_JSON( jo ) );
        if( settings.logging.net.socket.receive )
            console.log( this.socketLoggingTextPrefix( "receive" ), jo );
        this.impl_receive( jo );
    }
    disconnect() {
        this.isConnected = false;
        // if( this.relayClientSocket ) {
        //     this.relayClientSocket.disconnect();
        //     this.relayClientSocket = null;
        // }
    }
    reconnect() {
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class NullSocketPipe extends BasicSocketPipe {
    constructor() {
        super();
        this.socketType = "NULL";
        this.socketSubtype = "pipe";
        this.url = "NullUrl";
        this.isConnected = true;
    }
    dispose() {
        this.isConnected = false;
        super.dispose();
    }
    impl_send( data ) {
    }
    impl_receive( data ) {
    }
    send( data ) {
    }
    receive( data ) {
    }
    flush() {
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const is_running_in_worker = function() {
    if( self.document === undefined )
        return true;
    return false;
};

export const g_map_awaiting_in_worker_clients = { }; // in-worker clients in connecting state
export const g_map_connected_in_worker_clients = { }; // in-worker clients in connecting state

export const out_of_worker_apis = {
    "on_message": function( worker, data ) {
        const jo = socket_received_data_reverse_marshall( data );
        if( ! ( "worker_message_type" in jo ) || typeof jo.worker_message_type != "string" || jo.worker_message_type.length == 0 )
            return false; // not a socket message
        if( ! ( "worker_endpoint" in jo ) || typeof jo.worker_endpoint != "string" || jo.worker_endpoint.length == 0 )
            return false; // TO-DO: send error answer and return true
        if( ! ( "worker_uuid" in jo ) || typeof jo.worker_uuid != "string" || jo.worker_uuid.length == 0 )
            return false; // TO-DO: send error answer and return true
        switch ( jo.worker_message_type ) {
        case "in_worker_connect": {
            if( !( jo.worker_uuid in g_map_awaiting_in_worker_clients ) )
                return false;
            const pipe = g_map_awaiting_in_worker_clients[jo.worker_uuid];
            pipe.performSuccessfulConnection();
        } return true;
        case "in_worker_disconnect": {
            if( !( jo.worker_uuid in g_map_connected_in_worker_clients ) )
                return false;
            const pipe = g_map_connected_in_worker_clients[jo.worker_uuid];
            pipe.performDisconnect();
        } return true;
        case "in_worker_message": {
            if( !( jo.worker_uuid in g_map_connected_in_worker_clients ) )
                return false;
            const pipe = g_map_connected_in_worker_clients[jo.worker_uuid];
            pipe.receive( jo.data );
        } return true;
        default:
            return false; // TO-DO: send error answer and return true
        } // switch( jo.worker_message_type )
    },
    "on_send_message": function( worker, type, endpoint, worker_uuid, data ) {
        const jo = socket_received_data_reverse_marshall( data );
        const joSend = {
            "worker_message_type": ( type && typeof type == "string" && type.length > 0 ) ? type : "in_worker_message",
            "worker_endpoint": endpoint,
            "worker_uuid": worker_uuid,
            "data": jo
        };
        //worker.postMessage( socket_received_data_reverse_marshall( joSend ) );
        worker.postMessage( socket_sent_data_marshall( joSend ) );
    }
};
export const in_worker_apis = {
    "on_message": function( data ) {
        const jo = socket_received_data_reverse_marshall( data );
        if( ! ( "worker_message_type" in jo ) || typeof jo.worker_message_type != "string" || jo.worker_message_type.length == 0 )
            return false; // not a socket message
        if( ! ( "worker_endpoint" in jo ) || typeof jo.worker_endpoint != "string" || jo.worker_endpoint.length == 0 )
            return false; // TO-DO: send error answer and return true
        if( ! ( "worker_uuid" in jo ) || typeof jo.worker_uuid != "string" || jo.worker_uuid.length == 0 )
            return false; // TO-DO: send error answer and return true
        if( ! ( jo.worker_endpoint in g_mapLocalServers ) )
            return false; // TO-DO: send error answer and return true
        const acceptor = g_mapLocalServers[jo.worker_endpoint];
        switch ( jo.worker_message_type ) {
        case "in_worker_connect":
            return acceptor.performAccept( jo );
        case "in_worker_disconnect":
            return acceptor.performDisconnect( jo );
        case "in_worker_message":
            return acceptor.receiveForClientPort( jo.worker_uuid, jo.data );
        default:
            return false; // TO-DO: send error answer and return true
        } // switch( jo.worker_message_type )
    },
    "on_send_message": function( type, endpoint, worker_uuid, data ) {
        const jo = socket_received_data_reverse_marshall( data );
        const joSend = {
            "worker_message_type": ( type && typeof type == "string" && type.length > 0 ) ? type : "in_worker_message",
            "worker_endpoint": endpoint,
            "worker_uuid": worker_uuid,
            "data": jo
        };
        //postMessage( socket_received_data_reverse_marshall( joSend ) );
        postMessage( socket_sent_data_marshall( joSend ) );
    }
};

export class InWorkerServerPipe extends BasicSocketPipe {
    constructor( acceptor, clientPort, fnSend ) {
        super();
        this.socketType = "InWorker";
        this.socketSubtype = "server";
        this.isConnected = true;
        this.acceptor = acceptor;
        this.clientPort = "" + clientPort;
        this.fnSend = fnSend || in_worker_apis.on_send_message;
        this.url = "in_worker_server_pipe://" + acceptor.strEndPoint + ":" + clientPort;
        this.acceptor.mapClients[this.clientPort] = this;
        this.fnSend( "in_worker_connect", this.acceptor.strEndPoint, this.clientPort, {} );
        const self = this;
        const iv = setTimeout( function() {
            clearTimeout( iv );
            self.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self } ) );
            self.acceptor.dispatchEvent( new UniversalDispatcherEvent( "connection", { "socket": self, "remoteAddress": "" + self.url } ) );
        }, 0 );
    }
    dispose() {
        this.performDisconnect();
        super.dispose();
    }
    handleServerDisposed() {
        this.performDisconnect();
        this.isConnected = false;
        this.dispatchEvent( new UniversalDispatcherEvent( "close", { "socket": this } ) );
        this.acceptor = null;
        this.fnSend = null;
        this.url = "";
        this.dispose();
    }
    performDisconnect() {
        if( ! this.isConnected )
            return;
        this.fnSend( "in_worker_disconnect", this.acceptor.strEndPoint, this.clientPort, {} );
        this.isConnected = false;
        if( this.acceptor )
            this.acceptor.unregisterClientByKey( this.clientPort );
        this.dispatchEvent( new UniversalDispatcherEvent( "close", { "socket": this } ) );
        this.acceptor = null;
        this.fnSend = null;
        this.url = "";
    }
    impl_send( data ) {
        if( ( !this.isConnected ) || ( !this.fnSend ) || typeof this.fnSend != "function" ) {
            const s = "Cannot send messages to disconnected in-worker server pipe";
            this.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": this, "message": "" + s } ) );
            throw new Error( s );
        }
        const jo = socket_received_data_reverse_marshall( data );
        this.fnSend( "in_worker_message", this.acceptor.strEndPoint, this.clientPort, jo );
    }
    disconnect() {
        this.performDisconnect();
        super.disconnect();
    }
};

export class InWorkerSocketServerAcceptor extends BasicServerAcceptor {
    constructor( strEndPoint, fnSend ) {
        super();
        this.socketType = "InWorker";
        this.strEndPoint = ( strEndPoint && typeof strEndPoint == "string" && strEndPoint.length > 0 ) ? strEndPoint : "default_local_endpoint";
        if( this.strEndPoint in g_mapLocalServers ) {
            const s = "Cannot start in-worker socket server on already listening \"" + this.strEndPoint + "\" endpoint";
            this.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": this, "message": "" + s } ) );
            throw new Error( s );
        }
        g_mapLocalServers[this.strEndPoint] = this;
        this.fnSend = fnSend || in_worker_apis.on_send_message;
        this.isListening = true;
        const self = this;
        const iv = setTimeout( function() {
            clearTimeout( iv );
            self.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self } ) );
        }, 0 );
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.disposeNotifyClients();
        if( this.strEndPoint && typeof this.strEndPoint == "string" && this.strEndPoint.length > 0 ) {
            if( this.strEndPoint in g_mapLocalServers )
                delete g_mapLocalServers[this.strEndPoint];
        }
        super.dispose();
    }
    performAccept( jo ) {
        if( jo.worker_uuid in this.mapClients )
            return false; // TO-DO: send error answer and return true
        // const pipe =
        new InWorkerServerPipe( this, "" + jo.worker_uuid, this.fnSend );
        return true;
    }
    performDisconnect( jo ) {
        if( ! ( jo.worker_uuid in this.mapClients ) )
            return false; // TO-DO: send error answer and return true
        const pipe = this.mapClients[jo.worker_uuid];
        pipe.performDisconnect();
        return true;
    }
    receiveForClientPort( clientPort, jo ) {
        if( ! ( clientPort in this.mapClients ) )
            return false; // TO-DO: send error answer and return true
        const pipe = this.mapClients[clientPort];
        pipe.receive( jo );
        return true;
    }
};

export class OutOfWorkerSocketClientPipe extends BasicSocketPipe {
    constructor( strEndPoint, worker, fnSend ) {
        super();
        this.socketType = "InWorker";
        this.socketSubtype = "client";
        this.isConnected = false;
        this.worker = worker;
        this.clientPort = utils.uuid_v4();
        this.strEndPoint = ( strEndPoint && typeof strEndPoint == "string" && strEndPoint.length > 0 ) ? strEndPoint : "default_in_worker_endpoint";
        this.url = "out_of_worker_client_pipe://" + this.strEndPoint + ":" + this.clientPort;
        this.fnSend = fnSend || out_of_worker_apis.on_send_message;
        this.fnSend( this.worker, "in_worker_connect", this.strEndPoint, this.clientPort, {} );
        g_map_awaiting_in_worker_clients["" + this.clientPort] = this;
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.performDisconnect();
        if( this.clientPort in g_map_awaiting_in_worker_clients )
            delete g_map_awaiting_in_worker_clients[this.clientPort];
        super.dispose();
    }
    performDisconnect() {
        if( ! this.isConnected )
            return;
        this.isConnected = false;
        delete g_map_connected_in_worker_clients["" + this.clientPort];
        this.fnSend( this.worker, "in_worker_disconnect", this.strEndPoint, this.clientPort, {} );
        this.dispatchEvent( new UniversalDispatcherEvent( "close", { "socket": this } ) );
        this.worker = null;
        this.clientPort = "";
        this.strEndPoint = "";
        this.url = "";
    }
    performSuccessfulConnection() {
        delete g_map_awaiting_in_worker_clients[this.clientPort];
        g_map_connected_in_worker_clients["" + this.clientPort] = this;
        this.isConnected = true;
        this.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": this } ) );
    }
    impl_send( data ) {
        if( ( !this.isConnected ) || ( !this.worker ) || ( !this.fnSend ) || typeof this.fnSend != "function" ) {
            const s = "Cannot send messages to disconnected in-worker client pipe";
            this.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": this, "message": "" + s } ) );
            throw new Error( s );
        }
        const jo = socket_received_data_reverse_marshall( data );
        this.fnSend( this.worker, "in_worker_message", this.strEndPoint, this.clientPort, jo );
    }
    disconnect() {
        this.performDisconnect();
        super.disconnect();
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class OutOfWorkerRelay extends EventDispatcher {
    constructor( strRelayName, acceptor, fnCreateClient, isAutoFlushIncoming, isAutoFlushOutgoing ) {
        super();
        const self = this;
        self.strRelayName = ( strRelayName != null && strRelayName != undefined && typeof strRelayName == "string" && strRelayName.length > 0 ) ? ( "" + strRelayName ) : "unnamed";
        self.isAutoFlushIncoming = ( isAutoFlushIncoming == null || isAutoFlushIncoming == undefined ) ? true : ( isAutoFlushIncoming ? true : false );
        self.isAutoFlushOutgoing = ( isAutoFlushOutgoing == null || isAutoFlushOutgoing == undefined ) ? true : ( isAutoFlushOutgoing ? true : false );
        if( ! acceptor )
            throw new Error( "OutOfWorkerRelay \"" + self.strRelayName + "\" needs acceptor for normal functionality" );
        if( typeof fnCreateClient != "function" )
            throw new Error( "OutOfWorkerRelay \"" + self.strRelayName + "\" needs callback to create connections to target server" );
        self.acceptor = acceptor;
        self.fnCreateClient = fnCreateClient;
        self.onConnection_ = function( eventData ) {
            const pipeIncoming = eventData.socket;
            let pipeOutgoing = null;
            if( ( ! ( "remoteAddress" in eventData ) ) || eventData.remoteAddress == null || eventData.remoteAddress == undefined )
                pipeIncoming.strSavedRemoteAddress = pipeIncoming.constructor.name;
            else
                pipeIncoming.strSavedRemoteAddress = "" + eventData.remoteAddress;
            if( settings.logging.net.relay.connect )
                console.log( "Relay \"" + self.strRelayName + "\" got new external-client connection \"" + pipeIncoming.strSavedRemoteAddress + "\"" );
            self.dispatchEvent( new UniversalDispatcherEvent( "connection", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress } ) );
            //
            // 1) configure incoming pipe
            //
            let _offAllPipeEventListeners = null;
            let _onExternalPipeClose = function() {
                if( settings.logging.net.relay.disconnect )
                    console.warn( "Relay \"" + self.strRelayName + "\" external-client socket closed \"" + pipeIncoming.strSavedRemoteAddress + "\"" );
                self.dispatchEvent( new UniversalDispatcherEvent( "close", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": true } ) );
                if( _offAllPipeEventListeners ) {
                    _offAllPipeEventListeners();
                    _offAllPipeEventListeners = null;
                }
            };
            let _onRelayPipeClose = function() {
                if( settings.logging.net.relay.disconnect )
                    console.warn( "Relay \"" + self.strRelayName + "\" relay-client socket closed \"" + pipeIncoming.strSavedRemoteAddress + "\"" );
                self.dispatchEvent( new UniversalDispatcherEvent( "close", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": false } ) );
                if( _offAllPipeEventListeners ) {
                    _offAllPipeEventListeners();
                    _offAllPipeEventListeners = null;
                }
            };
            let _onExternalPipeError = function( eventData ) {
                if( settings.logging.net.relay.error )
                    console.warn( "Relay client  \"" + self.strRelayName + "\" external-client socket error \"" + pipeIncoming.strSavedRemoteAddress + "\"" );
                self.dispatchEvent( new UniversalDispatcherEvent( "error", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": true } ) );
                if( _offAllPipeEventListeners ) {
                    _offAllPipeEventListeners();
                    _offAllPipeEventListeners = null;
                }
            };
            let _onRelayPipeError = function( eventData ) {
                if( settings.logging.net.relay.error )
                    console.warn( "Relay client  \"" + self.strRelayName + "\" relay-client socket error \"" + pipeIncoming.strSavedRemoteAddress + "\"" );
                self.dispatchEvent( new UniversalDispatcherEvent( "error", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": false } ) );
                if( _offAllPipeEventListeners ) {
                    _offAllPipeEventListeners();
                    _offAllPipeEventListeners = null;
                }
            };
            let _onExternalPipeMessage = function( eventData ) {
                if( settings.logging.net.relay.rawMessage )
                    console.log( "Relay \"" + self.strRelayName + "\" external-client socket \"" + eventData.strSavedRemoteAddress + "\" raw message", eventData );
                const joMessage = eventData.message;
                if( settings.logging.net.relay.message )
                    console.log( "Relay \"" + self.strRelayName + "\" external-client socket \"" + pipeIncoming.strSavedRemoteAddress + "\" message ", joMessage );
                if( ! pipeOutgoing )
                    throw new Error( "Relay \"" + self.strRelayName + "\" is not completely initialized and cannot transfer messages" );
                self.dispatchEvent( new UniversalDispatcherEvent( "message", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": true, "message": joMessage } ) );
                pipeOutgoing.send( joMessage );
                if( self.isAutoFlushIncoming )
                    pipeOutgoing.flush();
            };
            let _onRelayPipeMessage = function( eventData ) {
                if( settings.logging.net.relay.rawMessage )
                    console.log( "Relay \"" + self.strRelayName + "\" relay-client socket \"" + eventData.strSavedRemoteAddress + "\" raw message", eventData );
                const joMessage = eventData.message;
                if( settings.logging.net.relay.message )
                    console.log( "Relay \"" + self.strRelayName + "\" relay-client socket \"" + pipeIncoming.strSavedRemoteAddress + "\" message ", joMessage );
                if( ! pipeOutgoing )
                    throw new Error( "Relay \"" + self.strRelayName + "\" is not completely initialized and cannot transfer messages" );
                self.dispatchEvent( new UniversalDispatcherEvent( "message", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": false, "message": joMessage } ) );
                pipeOutgoing.send( joMessage );
                if( self.isAutoFlushOutgoing )
                    pipeOutgoing.flush();
            };
            _offAllPipeEventListeners = function() {
                if( _onExternalPipeClose ) {
                    pipeIncoming.off( "close", _onExternalPipeClose );
                    _onExternalPipeClose = null;
                }
                if( _onExternalPipeError ) {
                    pipeIncoming.off( "error", _onExternalPipeError );
                    _onExternalPipeError = null;
                }
                if( _onExternalPipeMessage ) {
                    pipeIncoming.off( "message", _onExternalPipeMessage );
                    _onExternalPipeMessage = null;
                }
                if( pipeOutgoing.relayClientSocket ) {
                    if( _onRelayPipeClose ) {
                        pipeOutgoing.off( "close", _onRelayPipeClose );
                        _onRelayPipeClose = null;
                    }
                    if( _onRelayPipeError ) {
                        pipeOutgoing.off( "error", _onRelayPipeError );
                        _onRelayPipeError = null;
                    }
                    if( _onRelayPipeMessage ) {
                        pipeOutgoing.off( "message", _onRelayPipeMessage );
                        _onRelayPipeMessage = null;
                    }
                    pipeOutgoing.disconnect();
                    pipeOutgoing.dispose();
                }
                pipeIncoming.disconnect();
                pipeIncoming.dispose();
            };
            pipeIncoming.on( "close", _onExternalPipeClose );
            pipeIncoming.on( "error", _onExternalPipeError );
            pipeIncoming.on( "message", _onExternalPipeMessage );
            //
            // 2) configure outgoing relay client pipe
            //
            pipeOutgoing = pipeIncoming.relayClientSocket = self.fnCreateClient();
            if( ! pipeOutgoing ) {
                pipeIncoming.dispose();
                throw new Error( "Relay \"" + self.strRelayName + "\" failed to initialize relay-client socket to target server" );
            }
            pipeOutgoing.on( "close", _onRelayPipeClose );
            pipeOutgoing.on( "error", _onRelayPipeError );
            pipeOutgoing.on( "message", _onRelayPipeMessage );
        };
        self.acceptor.on( "connection", self.onConnection_ );
    }
    dispose() {
        this.isDisposing = true;
        if( this.acceptor )
            this.acceptor.off( "connection", this.onConnection_ );
        this.onConnection_ = null;
        super.dispose();
    }
    flush() {
        if( this.acceptor )
            this.acceptor.flush();
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class OneToOneRelay extends EventDispatcher {
    constructor( strRelayName, pipeIncoming, pipeOutgoing, isAutoFlushIncoming, isAutoFlushOutgoing ) {
        super();
        const self = this;
        self.strRelayName = ( strRelayName != null && strRelayName != undefined && typeof strRelayName == "string" && strRelayName.length > 0 ) ? ( "" + strRelayName ) : "unnamed";
        self.isAutoFlushIncoming = ( isAutoFlushIncoming == null || isAutoFlushIncoming == undefined ) ? true : ( isAutoFlushIncoming ? true : false );
        self.isAutoFlushOutgoing = ( isAutoFlushOutgoing == null || isAutoFlushOutgoing == undefined ) ? true : ( isAutoFlushOutgoing ? true : false );
        self.pipeIncoming = pipeIncoming;
        self.pipeOutgoing = pipeOutgoing;
        if( ( !( "strSavedRemoteAddress" in pipeIncoming ) ) || pipeIncoming.strSavedRemoteAddress == null || pipeIncoming.strSavedRemoteAddress == undefined )
            pipeIncoming.strSavedRemoteAddress = "" + pipeIncoming.constructor.name;
        if( ( !( "strSavedRemoteAddress" in pipeOutgoing ) ) || pipeOutgoing.strSavedRemoteAddress == null || pipeOutgoing.strSavedRemoteAddress == undefined )
            pipeOutgoing.strSavedRemoteAddress = "" + pipeOutgoing.constructor.name;
        //
        // 1) configure incoming pipe
        //
        let _offAllPipeEventListeners = null;
        let _onIncomingPipeClose = function() {
            if( settings.logging.net.relay.disconnect )
                console.warn( "Relay \"" + self.strRelayName + "\" incoming-client socket closed \"" + pipeIncoming.strSavedRemoteAddress + "\"" );
            self.dispatchEvent( new UniversalDispatcherEvent( "close", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": true } ) );
            if( _offAllPipeEventListeners ) {
                _offAllPipeEventListeners();
                _offAllPipeEventListeners = null;
            }
        };
        let _onOutgoingPipeClose = function() {
            if( settings.logging.net.relay.disconnect )
                console.warn( "Relay \"" + self.strRelayName + "\" outgoing-client socket closed \"" + pipeIncoming.strSavedRemoteAddress + "\"" );
            self.dispatchEvent( new UniversalDispatcherEvent( "close", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": false } ) );
            if( _offAllPipeEventListeners ) {
                _offAllPipeEventListeners();
                _offAllPipeEventListeners = null;
            }
        };
        let _onIncomingPipeError = function( eventData ) {
            if( settings.logging.net.relay.error )
                console.warn( "Relay client  \"" + self.strRelayName + "\" incoming-client socket error \"" + pipeIncoming.strSavedRemoteAddress + "\"" );
            self.dispatchEvent( new UniversalDispatcherEvent( "error", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": true } ) );
            if( _offAllPipeEventListeners ) {
                _offAllPipeEventListeners();
                _offAllPipeEventListeners = null;
            }
        };
        let _onOutgoingPipeError = function( eventData ) {
            if( settings.logging.net.relay.error )
                console.warn( "Relay client  \"" + self.strRelayName + "\" outgoing-client socket error \"" + pipeIncoming.strSavedRemoteAddress + "\"" );
            self.dispatchEvent( new UniversalDispatcherEvent( "error", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": false } ) );
            if( _offAllPipeEventListeners ) {
                _offAllPipeEventListeners();
                _offAllPipeEventListeners = null;
            }
        };
        let _onIncomingPipeMessage = function( eventData ) {
            if( settings.logging.net.relay.rawMessage )
                console.log( "Relay \"" + self.strRelayName + "\" incoming-client socket \"" + eventData.strSavedRemoteAddress + "\" raw message", eventData );
            const joMessage = eventData.message;
            if( settings.logging.net.relay.message )
                console.log( "Relay \"" + self.strRelayName + "\" incoming-client socket \"" + pipeIncoming.strSavedRemoteAddress + "\" message ", joMessage );
            if( ! pipeOutgoing )
                throw new Error( "Relay \"" + self.strRelayName + "\" is not completely initialized and cannot transfer messages" );
            self.dispatchEvent( new UniversalDispatcherEvent( "message", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": true, "message": joMessage } ) );
            pipeOutgoing.send( joMessage );
            if( self.isAutoFlushIncoming )
                pipeOutgoing.flush();
        };
        let _onOutgoingPipeMessage = function( eventData ) {
            if( settings.logging.net.relay.rawMessage )
                console.log( "Relay \"" + self.strRelayName + "\" outgoing-client socket \"" + eventData.strSavedRemoteAddress + "\" raw message", eventData );
            const joMessage = eventData.message;
            if( settings.logging.net.relay.message )
                console.log( "Relay \"" + self.strRelayName + "\" outgoing-client socket \"" + pipeIncoming.strSavedRemoteAddress + "\" message ", joMessage );
            if( ! pipeOutgoing )
                throw new Error( "Relay \"" + self.strRelayName + "\" is not completely initialized and cannot transfer messages" );
            self.dispatchEvent( new UniversalDispatcherEvent( "message", { "relay": self, "socket": pipeIncoming, "remoteAddress": "" + pipeIncoming.strSavedRemoteAddress, "isExternalSocket": false, "message": joMessage } ) );
            pipeIncoming.send( joMessage );
            if( self.isAutoFlushOutgoing )
                pipeIncoming.flush();
        };
        _offAllPipeEventListeners = function() {
            if( _onIncomingPipeClose ) {
                pipeIncoming.off( "close", _onIncomingPipeClose );
                _onIncomingPipeClose = null;
            }
            if( _onIncomingPipeError ) {
                pipeIncoming.off( "error", _onIncomingPipeError );
                _onIncomingPipeError = null;
            }
            if( _onIncomingPipeMessage ) {
                pipeIncoming.off( "message", _onIncomingPipeMessage );
                _onIncomingPipeMessage = null;
            }
            if( pipeOutgoing.relayClientSocket ) {
                if( _onOutgoingPipeClose ) {
                    pipeOutgoing.off( "close", _onOutgoingPipeClose );
                    _onOutgoingPipeClose = null;
                }
                if( _onOutgoingPipeError ) {
                    pipeOutgoing.off( "error", _onOutgoingPipeError );
                    _onOutgoingPipeError = null;
                }
                if( _onOutgoingPipeMessage ) {
                    pipeOutgoing.off( "message", _onOutgoingPipeMessage );
                    _onOutgoingPipeMessage = null;
                }
                pipeOutgoing.disconnect();
                pipeOutgoing.dispose();
            }
            pipeIncoming.disconnect();
            pipeIncoming.dispose();
        };
        pipeIncoming.on( "close", _onIncomingPipeClose );
        pipeIncoming.on( "error", _onIncomingPipeError );
        pipeIncoming.on( "message", _onIncomingPipeMessage );
        //
        // 2) configure outgoing relay client pipe
        //
        pipeOutgoing.on( "close", _onOutgoingPipeClose );
        pipeOutgoing.on( "error", _onOutgoingPipeError );
        pipeOutgoing.on( "message", _onOutgoingPipeMessage );
    }
    dispose() {
        this.isDisposing = true;
        super.dispose();
    }
    flush() {
        if( this.pipeIncoming )
            this.pipeIncoming.flush();
        if( this.pipeOutgoing )
            this.pipeOutgoing.flush();
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class DirectPipe extends BasicSocketPipe {
    constructor( counterPipe, isBroadcastOpenEvents ) {
        super();
        isBroadcastOpenEvents = isBroadcastOpenEvents ? true : false;
        this.socketType = "Direct";
        this.socketSubtype = "direct.not.initialized.yet";
        this.isConnected = false;
        this.acceptor = null;
        this.counterPipe = ( counterPipe != null && counterPipe != undefined ) ? counterPipe : null; // set outside after this constructor call
        this.strEndPoint = this.counterPipe ? ( "2-" + this.counterPipe.strEndPoint ) : ( "1-" + utils.randomDirectPipeID() );
        this.clientPort = this.counterPipe ? 2 : 1;
        this.socketSubtype = "direct." + this.clientPort;
        this.url = "direct_pipe://" + this.strEndPoint + ":" + this.clientPort;
        if( this.counterPipe ) {
            this.counterPipe.counterPipe = this;
            this.isConnected = true;
            this.counterPipe.isConnected = true;
            if( isBroadcastOpenEvents ) {
                const self = this;
                const iv = setTimeout( function() {
                    clearTimeout( iv );
                    self.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self } ) );
                    // self.acceptor.dispatchEvent( new UniversalDispatcherEvent( "connection", { "socket": serverPipe, "remoteAddress": "" + self.url } ) );
                    self.counterPipe.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self.counterPipe } ) );
                }, 0 );
            }
        }
    }
    dispose() {
        this.performDisconnect();
        super.dispose();
    }
    handleServerDisposed() { // this method is for using in local client/server pipe pairs
        this.performDisconnect();
        this.isConnected = false;
        this.dispatchEvent( new UniversalDispatcherEvent( "close", { "socket": this } ) );
        this.acceptor = null;
        this.counterPipe = null;
        this.clientPort = 0;
        this.url = "";
        this.dispose();
    }
    performDisconnect() {
        if( ! this.isConnected )
            return;
        this.isConnected = false;
        if( this.acceptor )
            this.acceptor.unregisterClientByKey( this.clientPort );
        this.dispatchEvent( new UniversalDispatcherEvent( "close", { "socket": this } ) );
        this.counterPipe.performDisconnect();
        this.acceptor = null;
        this.counterPipe = null;
        this.clientPort = 0;
        this.url = "";
    }
    impl_send( data ) {
        if( ( !this.isConnected ) || ( !this.counterPipe ) || ( !this.counterPipe.isConnected ) ) {
            const s = "Cannot send messages to disconnected local server pipe";
            this.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": this, "message": "" + s } ) );
            throw new Error( s );
        }
        const s = socket_sent_data_marshall( data );
        const jo = socket_received_data_reverse_marshall( s );
        this.counterPipe.receive( jo );
    }
    disconnect() {
        this.performDisconnect();
        super.disconnect();
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class LocalSocketServerPipe extends DirectPipe {
    constructor( counterPipe, acceptor, clientPort ) {
        super( counterPipe, false );
        this.socketType = "Local";
        this.socketSubtype = "server";
        this.isConnected = true;
        this.acceptor = acceptor;
        this.clientPort = 0 + parseInt( clientPort, 10 );
        this.url = "local_server_pipe://" + acceptor.strEndPoint + ":" + clientPort;
        this.acceptor.mapClients["" + clientPort] = this;
        const self = this;
        const iv = setTimeout( function() {
            clearTimeout( iv );
            self.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self } ) );
        }, 0 );
    }
    dispose() {
        super.dispose();
    }
};

export class LocalSocketServerAcceptor extends BasicServerAcceptor {
    constructor( strEndPoint ) {
        super();
        this.socketType = "Local";
        this.nextClientPort = 1;
        this.strEndPoint = ( strEndPoint && typeof strEndPoint == "string" && strEndPoint.length > 0 ) ? strEndPoint : "default_local_endpoint";
        if( this.strEndPoint in g_mapLocalServers ) {
            const s = "Cannot start local socket server on already listening \"" + this.strEndPoint + "\" endpoint";
            this.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": this, "message": "" + s } ) );
            throw new Error( s );
        }
        g_mapLocalServers[this.strEndPoint] = this;
        this.isListening = true;
        const self = this;
        const iv = setTimeout( function() {
            clearTimeout( iv );
            self.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self } ) );
        }, 0 );
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.disposeNotifyClients();
        if( this.strEndPoint && typeof this.strEndPoint == "string" && this.strEndPoint.length > 0 ) {
            if( this.strEndPoint in g_mapLocalServers )
                delete g_mapLocalServers[this.strEndPoint];
        }
        super.dispose();
    }
};

export class LocalSocketClientPipe extends DirectPipe {
    constructor( strEndPoint ) {
        super( null, false );
        this.socketType = "Local";
        this.socketSubtype = "client";
        this.isConnected = false;
        this.clientPort = 0;
        this.acceptor = null;
        this.counterPipe = null;
        this.strEndPoint = ( strEndPoint && typeof strEndPoint == "string" && strEndPoint.length > 0 ) ? strEndPoint : "default_local_endpoint";
        if( !( this.strEndPoint in g_mapLocalServers ) ) {
            const s = "Cannot connect to local socket server \"" + this.strEndPoint + "\" endpoint, no such server";
            this.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": this, "message": "" + s } ) );
            throw new Error( s );
        }
        this.acceptor = g_mapLocalServers[this.strEndPoint];
        this.clientPort = 0 + this.acceptor.nextClientPort;
        ++ this.acceptor.nextClientPort;
        this.url = "local_client_pipe://" + this.strEndPoint + ":" + this.clientPort;
        this.isConnected = true;
        const serverPipe = new LocalSocketServerPipe( this, this.acceptor, 0 + this.clientPort );
        serverPipe.counterPipe = this;
        this.counterPipe = serverPipe;
        this.acceptor.mapClients[0 + this.clientPort] = {
            serverPipe: serverPipe,
            clientPipe: this
        };
        const self = this;
        const iv = setTimeout( function() {
            clearTimeout( iv );
            self.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self } ) );
            self.acceptor.dispatchEvent( new UniversalDispatcherEvent( "connection", { "socket": serverPipe, "remoteAddress": "" + self.url } ) );
        }, 0 );
    }
    dispose() {
        super.dispose();
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class WebSocketServerPipe extends BasicSocketPipe {
    constructor( acceptor, ws_conn, remoteAddress ) {
        super();
        this.socketType = "WS";
        this.socketSubtype = "server";
        const self = this;
        this.isConnected = true;
        this.acceptor = acceptor;
        this.clientNumber = 0 + acceptor.nextClientNumber;
        this.clientPort = 0 + this.clientNumber;
        ++ acceptor.nextClientNumber;
        this.ws_conn = ws_conn;
        this.remoteAddress = "" + remoteAddress;
        this.url = "ws_server_pipe(" + this.clientNumber + ")://" + remoteAddress;
        this._onWsClose = function() {
            self.dispatchEvent( new UniversalDispatcherEvent( "close", { "socket": self } ) );
        };
        this._onWsError = function( event ) {
            self.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": self, "message": event } ) );
        };
        this._onWsMessage = function( event ) {
            self.receive( event.data );
        };
        this._removeWsEventListeners = function() {
            if( self._onWsClose ) {
                ws_conn.removeEventListener( "close", self._onWsClose );
                self._onWsClose = null;
            }
            if( self._onWsError ) {
                ws_conn.removeEventListener( "error", self._onWsError );
                self._onWsError = null;
            }
            if( self._onWsMessage ) {
                ws_conn.removeEventListener( "message", self._onWsMessage );
                self._onWsMessage = null;
            }
        };
        ws_conn.addEventListener( "close", this._onWsClose );
        ws_conn.addEventListener( "error", this._onWsError );
        ws_conn.addEventListener( "message", this._onWsMessage );
        this.acceptor.mapClients["" + this.clientPort] = this;
        const iv = setTimeout( function() {
            clearTimeout( iv );
            self.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self } ) );
            self.acceptor.dispatchEvent( new UniversalDispatcherEvent( "connection", { "socket": self, "remoteAddress": "" + remoteAddress } ) );
        }, 0 );
    }
    dispose() {
        this.performDisconnect();
        super.dispose();
    }
    handleServerDisposed() {
        this.isConnected = false;
        this.clientNumber = 0;
        this.acceptor = null;
        this.ws_conn = null;
        this.url = "";
        this.remoteAddress = "";
        this.dispose();
    }
    performDisconnect() {
        if( ! this.isConnected )
            return;
        this.isConnected = false;
        if( this._removeWsEventListeners ) {
            this._removeWsEventListeners();
            this._removeWsEventListeners = null;
        }
        if( this.ws_conn ) {
            try {
                this.ws_conn.terminate();
            } catch ( err ) {
                console.warn( "Web socket server pipe termination error", err );
            }
            this.ws_conn = null;
        }
        if( this.acceptor )
            this.acceptor.unregisterClientByKey( this.clientPort );
        this.clientNumber = 0;
        this.acceptor = null;
        this.url = "";
        this.remoteAddress = "";
    }
    impl_send( data ) {
        if( ( !this.isConnected ) || ( !this.ws_conn ) ) {
            const s = "Cannot send messages to disconnected web socket server pipe";
            this.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": this, "message": "" + s } ) );
            throw new Error( s );
        }
        const s = socket_sent_data_marshall( data );
        this.ws_conn.send( s );
    }
    disconnect() {
        this.performDisconnect();
        super.disconnect();
    }
    impl_receive( data ) {
        const jo = socket_received_data_reverse_marshall( data );
        this.dispatchEvent( new UniversalDispatcherEvent( "message", { "socket": this, "message": jo } ) );
    }
};

export class WebSocketServerAcceptor extends BasicServerAcceptor {
    constructor( nTcpPort, key, cert ) {
        super();
        this.socketType = "WS";
        this.ws_srv = null;
        if( key != null && key != undefined && typeof key == "string" && key.length > 0 &&
            cert != null && cert != undefined && typeof cert == "string" && cert.length > 0
        ) {
            const server = https_mod.createServer( {
                key: "" + key,
                cert: "" + cert
                // , ca: ...
            } );
            server.listen( nTcpPort );
            this.ws_srv = new ws_mod.WebSocketServer( { server } );
        } else
            this.ws_srv = new ws_mod.WebSocketServer( { port: nTcpPort } );

        const self = this;
        self.ws_srv.on( "connection", function( ws_conn, req ) {
            ws_conn.strSavedRemoteAddress = "" + req.connection.remoteAddress;
            ws_conn.serverPipe = new WebSocketServerPipe( self, ws_conn, req.connection.remoteAddress );
        } );
        this.isListening = true;
        const iv = setTimeout( function() {
            clearTimeout( iv );
            self.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self } ) );
        }, 0 );
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.disposeNotifyClients();
        super.dispose();
    }
};

export class WebSocketClientPipe extends BasicSocketPipe {
    constructor( url ) {
        super();
        this.socketType = "WS";
        this.socketSubtype = "client";
        this.isConnected = false;
        this.ws_conn = null;
        this._onWsOpen = null;
        this._onWsClose = null;
        this._onWsError = null;
        this._onWsMessage = null;
        this.ws_url = "" + ( ( url != null && url != undefined && typeof url == "string" ) ? url : "" );
        this.url = "ws_client_pipe-" + this.ws_url;
        this.reconnect();
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.performDisconnect();
        this.ws_url = null;
        super.dispose();
    }
    impl_send( data ) {
        if( ( !this.isConnected ) || ( !this.ws_conn ) ) {
            const s = "Cannot send messages to disconnected web socket client pipe";
            this.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": this, "message": "" + s } ) );
            throw new Error( s );
        }
        const s = socket_sent_data_marshall( data );
        this.ws_conn.send( s );
    }
    reconnect() {
        this.performDisconnect();
        this.ws_connect( "" + this.ws_url );
    }
    disconnect() {
        this.performDisconnect();
        super.disconnect();
    }
    performDisconnect() {
        if( ! this.isConnected )
            return;
        this.ws_disconnect();
    }
    ws_connect_attempt( url, reconnectAfterMilliseconds, iv ) {
        const self = this;
        try {
            if( this.isConnected || this.ws_conn )
                this.ws_disconnect();
            this.ws_conn = ws_mod
                ? new ws_mod.WebSocket( url, { tlsOptions: { rejectUnauthorized: false } } ) // server side
                : new WebSocket( url ); // client side
            this.url = "" + url;
            this._onWsOpen = function() {
                self.isConnected = true;
                self.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self } ) );
            };
            this._onWsClose = function( event ) {
                // alert( JSON.stringify( event ) );
                self.isConnected = false;
                self.dispatchEvent( new UniversalDispatcherEvent( "close", { "socket": self, "message": event } ) );
            };
            this._onWsError = function( event ) {
                // alert( JSON.stringify( event ) );
                self.isConnected = false;
                self.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": self, "message": event } ) );
            };
            this._onWsMessage = function( event ) {
                self.receive( event.data );
            };
            this._removeWsEventListeners = function() {
                if( self._onWsOpen ) {
                    self.ws_conn.removeEventListener( "open", self._onWsOpen );
                    self._onWsOpen = null;
                }
                if( self._onWsClose ) {
                    self.ws_conn.removeEventListener( "close", self._onWsClose );
                    self._onWsClose = null;
                }
                if( self._onWsError ) {
                    self.ws_conn.removeEventListener( "error", self._onWsError );
                    self._onWsError = null;
                }
                if( self._onWsMessage ) {
                    self.ws_conn.removeEventListener( "message", self._onWsMessage );
                    self._onWsMessage = null;
                }
            };
            this.ws_conn.addEventListener( "open", this._onWsOpen );
            this.ws_conn.addEventListener( "close", this._onWsClose );
            this.ws_conn.addEventListener( "error", this._onWsError );
            this.ws_conn.addEventListener( "message", this._onWsMessage );
            if( iv )
                clearTimeout( iv );
            return true;
        } catch ( err ) {
            console.warn( "WS client connect error:", err );
        }
        if( reconnectAfterMilliseconds != null && reconnectAfterMilliseconds != undefined ) {
            reconnectAfterMilliseconds = parseInt( reconnectAfterMilliseconds, 10 );
            if( reconnectAfterMilliseconds > 0 && ( !iv ) ) {
                const iv = setTimeout( function() {
                    try {
                        if( self.ws_connect_attempt( url, reconnectAfterMilliseconds, iv ) )
                            clearTimeout( iv );
                    } catch ( err ) {
                    }
                }, reconnectAfterMilliseconds );
            }
        }
        return false;
    }
    ws_connect( url ) {
        if( url.length == 0 ) {
            const s = "Cannot connect web socket server \"" + url + "\", bad url";
            this.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": this, "message": "" + s } ) );
            throw new Error( s );
        }
        this.ws_connect_attempt( url, settings.net.ws.client.reconnectAfterMilliseconds, null );
    }
    ws_disconnect() {
        if( this._removeWsEventListeners ) {
            this._removeWsEventListeners();
            this._removeWsEventListeners = null;
        }
        if( this.ws_conn ) {
            //try { this.ws_conn.close( 1000, "Good bye!" ); } catch( err ) { } // see codes here: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
            let bPass = false, anyError = null;
            try {
                this.ws_conn.close();
                bPass = true;
            } catch ( err ) {
                anyError = err;
            }
            if( ! bPass ) {
                try {
                    this.ws_conn.terminate();
                    bPass = true;
                } catch ( err ) {
                    anyError = err;
                }
            }
            if( ! bPass )
                console.warn( "Web socket client pipe termination error", anyError );
            this.ws_conn = null;
        }
        this.isConnected = false;
        this.url = "";
    }
    impl_receive( data ) {
        const jo = socket_received_data_reverse_marshall( data );
        this.dispatchEvent( new UniversalDispatcherEvent( "message", { "socket": this, "message": jo } ) );
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class RTCConnection extends EventDispatcher {
    constructor( strSignalingServerURL, idRtcParticipant ) {
        super();
        this.strSignalingServerURL = utils.makeValidSignalingServerURL( strSignalingServerURL );
        this.idRtcParticipant = "" + ( ( idRtcParticipant != null && idRtcParticipant != undefined && typeof idRtcParticipant == "string" && idRtcParticipant.length > 0 ) ? idRtcParticipant : utils.uuid_v4() );
        this.wasIdentified = false;
        this.iceComplete = false;
        this.pc = null;
        this.dc = null;
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.closeDataChannel();
        this.closePeer();
        this.dc = null;
        this.wasIdentified = false;
        this.iceComplete = false;
        this.idRtcParticipant = null;
        super.dispose();
    }
    describe( strInstanceType, arrAdditionalProps ) {
        let strInstanceDescription = ( strInstanceType == null || strInstanceType == undefined || ( typeof strInstanceType != "string" ) || strInstanceType.length == 0 )
            ? "participant"
            : ( "" + strInstanceType );
        if( typeof this.idRtcParticipant == "string" && this.idRtcParticipant.length > 0 )
            strInstanceDescription += " " + this.idRtcParticipant;
        const arrProps = [];
        if( this.isDisposed )
            arrProps.push( "disposed" );
        if( this.wasIdentified )
            arrProps.push( "identified" );
        if( this.pc )
            arrProps.push( "pc" );
        if( this.dc )
            arrProps.push( "dc" );
        if( arrAdditionalProps != null && arrAdditionalProps != undefined && arrAdditionalProps.length > 0 ) {
            for( let i = 0; i < arrAdditionalProps.length; ++ i )
                arrProps.push( arrAdditionalProps[i] );
        }
        if( arrProps.length > 0 )
            strInstanceDescription += "(" + arrProps.join( ", " ) + ")";
        return strInstanceDescription;
    }
    closeDataChannel() {
        if( this.dc ) {
            try {
                this.dc.ondatachannel = null;
                this.dc.close();
                if( settings.logging.net.rtc.closeDataChannel )
                    console.warn( this.describe() + " did closed RTC data channel" );
            } catch ( err ) {
                if( settings.logging.net.rtc.error )
                    console.warn( this.describe() + " error closing RTC data channel:", err );
            }
            this.dc = null;
            this.dispatchEvent( new UniversalDispatcherEvent( "dataChannelClose", { "detail": { "actor": this } } ) );
        }
    }
    closePeer() {
        if( this.pc ) {
            try {
                this.pc.onicecandidate = null;
                this.pc.oniceconnectionstatechange = null;
                this.pc.close();
                if( settings.logging.net.rtc.closePeer )
                    console.warn( this.describe() + " did closed RTC peer" );
            } catch ( err ) {
                if( settings.logging.net.rtc.error )
                    console.warn( this.describe() + " error closing RTC peer:", err );
            }
            this.dispatchEvent( new UniversalDispatcherEvent( "peerClose", { "detail": { "actor": this } } ) );
            this.pc = null;
        }
    }
    onError( err ) {
        this.dispatchEvent( new UniversalDispatcherEvent( "rtcParticipantError", { "detail": { "actor": this, "error": err } } ) );
        if( settings.logging.net.rtc.error )
            console.warn( " !!! " + this.describe() + " error:", err );
        this.closeDataChannel();
        this.closePeer();
    }
    send( data ) {
        const s = socket_sent_data_marshall( data );
        if( ! this.dc ) {
            this.onError( "Attempt to send message to uninitialized RTC data channel: " + s );
            return;
        }
        try {
            this.dc.send( s );
        } catch ( err ) {
            this.onError( "Failed to send message to RTC data channel: " + err.toString() );
        }
    }
    onDataChannelOpen( event ) {
        this.dispatchEvent( new UniversalDispatcherEvent( "dataChannelOpen", { "detail": { "actor": this } } ) );
    }
    onDataChannelClose( event ) {
        this.dispatchEvent( new UniversalDispatcherEvent( "dataChannelClose", { "detail": { "actor": this } } ) );
        // this.onError( "Data channel closed" );
    }
    onDataChannelError( event ) {
        this.dispatchEvent( new UniversalDispatcherEvent( "dataChannelError", { "detail": { "actor": this } } ) );
        this.onError( "Data channel error " + event.toString() );
    }
    onDataChannelMessage( event ) {
        if( event.data.size ) {
            // fileReceiver.receive( event.data, { } );
            if( settings.logging.net.rtc.error )
                console.warn( this.describe() + " will ignore file transfer message of size", event.data.size );
        } else {
            if( event.data.charCodeAt( 0 ) == 2 )
                return;
            const data = JSON.parse( event.data );
            if( data.type === "file" ) {
                // fileReceiver.receive( event.data, { } );
                if( settings.logging.net.rtc.error )
                    console.warn( this.describe() + " will ignore file transfer message" );
            } else
                this.dispatchEvent( new UniversalDispatcherEvent( "dataChannelMessage", { "detail": { "actor": this, "data": data } } ) );
        }
    }
    onIceComplete( event ) {
    }
    onIceConnectionStateChange( event ) { // handler for self.pc.oniceconnectionstatechange, see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/oniceconnectionstatechange
        if( settings.logging.net.rtc.iceConnectionStateChange )
            console.log( "Participant \"" + this.idRtcParticipant + "\" ICE connection state changed to \"" + this.pc.iceConnectionState + "\", event is:", event );
        else if( settings.logging.net.rtc.iceConnectionStateName ) // similar to previous but prints only connection state name
            console.log( "Participant \"" + this.idRtcParticipant + "\" ICE connection state changed to \"" + this.pc.iceConnectionState + "\"" );
        if( this.pc.iceConnectionState === "failed" ||
            this.pc.iceConnectionState === "closed" ||
            this.pc.iceConnectionState === "disconnected"
        )
            this.onError( "ICE connection state(oniceconnectionstatechange) changed to " + this.pc.iceConnectionState );
    }
    onIceGatheringStateChange( event ) { // handler for self.pc.onicegatheringstatechange - this is recommended to handle in a same way as oniceconnectionstatechange, see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onicegatheringstatechange
        if( ! this.pc ) {
            console.log( "WARNING: Participant \"" + this.idRtcParticipant + "\" ICE gathering state changed event with no pc\", event is:", event );
            return;
        }
        if( settings.logging.net.rtc.iceGatheringStateChange )
            console.log( "Participant \"" + this.idRtcParticipant + "\" ICE gathering state changed to \"" + this.pc.iceGatheringState + "\", event is:", event );
        else if( settings.logging.net.rtc.iceGatheringStateName ) // similar to previous but prints only gathering state name
            console.log( "Participant \"" + this.idRtcParticipant + "\" ICE gathering state changed to \"" + this.pc.iceGatheringState + "\"" );
        if( this.pc.iceConnectionState === "failed" ||
            this.pc.iceConnectionState === "closed" ||
            this.pc.iceConnectionState === "disconnected"
        )
            this.onError( "ICE connection state(onicegatheringstatechange) changed to " + this.pc.iceConnectionState );
    }
    onIceIdentifyResult( event ) { // handler for self.pc.onidentityresult, see https://developer.mozilla.org/en-US/docs/Web/API/RTCIdentityEvent
        if( settings.logging.net.rtc.iceIceIdentifyResult ) {
            if( "assertion" in event )
                console.warn( "Participant \"" + this.idRtcParticipant + "\" ICE identify result event with new identity assertion (blob: '" + event.assertion + "') has been generated." );
            else
                console.warn( "Participant \"" + this.idRtcParticipant + "\" ICE identify result event is:", event );
        }
    }
    onIceSignalingStateChange( event ) { // handler for self.pc.onsignalingstatechange, see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onsignalingstatechange
        if( settings.logging.net.rtc.iceSignalingStateChange ) {
            console.log( "Participant \"" + this.idRtcParticipant + "\" ICE signaling state changed to \"" +
                ( ( this.pc && "signalingState" in this.pc ) ? this.pc.signalingState : "N/A" ) +
                "\", event is:", event );
        }
    }
    onIceNegotiationNeeded( event ) { // handler for self.pc.onnegotiationneeded, see https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/onnegotiationneeded
        // TO-DO: improve this
        if( settings.logging.net.rtc.iceNegotiationNeeded )
            console.log( "Participant \"" + this.idRtcParticipant + "\" ICE negotiation needed event is:", event );
    }
};

export class RTCActor extends RTCConnection {
    constructor( strSignalingServerURL, idRtcParticipant, offerOptions, signalingOptions ) {
        super( strSignalingServerURL, idRtcParticipant );
        this.isDisposed = false;
        this.idSomebodyCreator = null;
        this.bWasImpersonated = false;
        this.isCreator = false;
        this.isJoiner = false;
        //
        this.offerOptions = {
            optional: [],
            offerToReceiveAudio: false, // offer to the remote peer the opportunity to try to send audio
            offerToReceiveVideo: false, // offer to the remote peer the opportunity to try to send video
            voiceActivityDetection: false,
            iceRestart: false
        };
        if( offerOptions ) {
            this.offerOptions.offerToReceiveAudio = ( "offerToReceiveAudio" in offerOptions && offerOptions.offerToReceiveAudio ) ? true : false;
            this.offerOptions.offerToReceiveVideo = ( "offerToReceiveVideo" in offerOptions && offerOptions.offerToReceiveVideo ) ? true : false;
            this.offerOptions.voiceActivityDetection = ( "voiceActivityDetection" in offerOptions && offerOptions.voiceActivityDetection ) ? true : false;
            this.offerOptions.iceRestart = ( "iceRestart" in offerOptions && offerOptions.iceRestart ) ? true : false;
        }
        //
        this.signalingOptions = {
            idCategory: "" + settings.rtcSpace.defaultSpaceCategory,
            idSpace: "" + settings.rtcSpace.defaultSpaceName
        };
        if( signalingOptions ) {
            if( "idCategory" in signalingOptions && typeof signalingOptions.idCategory == "string" && signalingOptions.idCategory.length > 0 )
                this.signalingOptions.idCategory = "" + signalingOptions.idCategory;
            if( "idSpace" in signalingOptions && typeof signalingOptions.idSpace == "string" && signalingOptions.idSpace.length > 0 )
                this.signalingOptions.idSpace = "" + signalingOptions.idSpace;
        }
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.signalingPipeClose();
        this.idSomebodyCreator = null;
        this.strSignalingServerURL = null;
        this.bWasImpersonated = false;
        super.dispose();
    }
    describe( strInstanceType, arrAdditionalProps ) {
        strInstanceType = ( strInstanceType == null || strInstanceType == undefined || ( typeof strInstanceType != "string" ) || strInstanceType.length == 0 )
            ? ( this.isCreator ? "creator" : ( this.isJoiner ? "joiner" : "actor" ) )
            : strInstanceType;
        // arrAdditionalProps = arrAdditionalProps || [];
        return super.describe( strInstanceType, arrAdditionalProps );
    }
    onError( err ) {
        super.onError( err );
    }
    signalingPipeOpen() {
        try {
            const self = this;
            self.signalingPipeClose();
            self.dispatchEvent( new UniversalDispatcherEvent( "signalingWillStart", { "detail": { "actor": this } } ) );
            self.signalingPipe = new WebSocketClientPipe( self.strSignalingServerURL );
            self.signalingPipe.on( "open", function( eventData ) { self.signalingPipeOnOpen( eventData ); } );
            self.signalingPipe.on( "close", function( eventData ) { self.signalingPipeOnClose( eventData ); } );
            self.signalingPipe.on( "error", function( eventData ) { self.signalingPipeOnError( eventData ); } );
            self.signalingPipe.on( "message", function( eventData ) { self.signalingPipeOnRawMessage( eventData ); } );
            self.dispatchEvent( new UniversalDispatcherEvent( "signalingDidStarted", { "detail": { "actor": this } } ) );
        } catch ( err ) {
            if( settings.logging.net.signaling.error )
                console.warn( this.describe() + " error starting signaling pipe:", err );
            this.onError( err );
        }
    }
    signalingPipeClose() {
        if( this.signalingPipe ) {
            try {
                if( settings.logging.net.signaling.disconnect )
                    console.warn( this.describe() + " will close signaling pipe" );
                this.signalingPipe.offAll();
                this.signalingPipe.disconnect();
                if( settings.logging.net.signaling.disconnect )
                    console.warn( this.describe() + " did closed signaling pipe" );
            } catch ( err ) {
                if( settings.logging.net.signaling.error )
                    console.warn( this.describe() + " error closing signaling pipe:", err );
            }
            this.signalingPipe = null;
            this.dispatchEvent( new UniversalDispatcherEvent( "signalingClosed", { "detail": { "actor": this } } ) );
        }
    }
    signalingPipeOnOpen( eventData ) {
        try {
            this.dispatchEvent( new UniversalDispatcherEvent( "signalingOpened", { "detail": { "actor": this } } ) );
            if( settings.logging.net.signaling.connect )
                console.log( "+++ " + this.describe() + " did connected to " + this.strSignalingServerURL );
            const joImpersonateMessage = {
                "id": utils.randomCallID(),
                "method": "signalingImpersonate",
                "idCategory": "" + this.signalingOptions.idCategory,
                "idSpace": "" + this.signalingOptions.idSpace,
                "idRtcParticipant": "" + this.idRtcParticipant,
                "role": this.isCreator ? "creator" : "joiner"
            };
            if( settings.logging.net.signaling.message )
                console.log( " <<< " + this.describe() + " message out", joImpersonateMessage );
            this.signalingPipe.send( joImpersonateMessage );
        } catch ( err ) {
            if( settings.logging.net.signaling.error )
                console.warn( this.describe() + " error sending impersonation to signaling pipe:", err );
            this.onError( err );
        }
    }
    signalingPipeOnClose( eventData ) {
        this.dispatchEvent( new UniversalDispatcherEvent( "signalingPipeClose", { "detail": { "actor": this } } ) );
        if( settings.logging.net.signaling.disconnect )
            console.warn( " !!! " + this.describe() + " signaling pipe closed for " + this.strSignalingServerURL );
        this.signalingPipeClose();
    }
    signalingPipeOnError( eventData ) {
        // alert( JSON.stringify( eventData ) );
        this.dispatchEvent( new UniversalDispatcherEvent( "signalingPipeError", { "detail": { "actor": this, "error": eventData } } ) );
        if( settings.logging.net.signaling.error )
            console.warn( " !!! " + this.describe() + " signaling pipe error for " + this.strSignalingServerURL + ", error is:", eventData );
        this.onError( eventData );
        this.signalingPipeClose();
    }
    signalingPipeOnRawMessage( eventData ) {
        try {
            if( settings.logging.net.signaling.rawMessage )
                console.log( " >>> " + this.describe() + " raw signaling message received", eventData );
            const joMessage = eventData.message;
            if( settings.logging.net.signaling.message )
                console.log( " >>> " + this.describe() + " signaling message received", joMessage );
            this.signalingPipeOnMessage( joMessage );
        } catch ( err ) {
            if( settings.logging.net.signaling.error )
                console.warn( "Error handling raw message in " + this.describe() + ":", err );
            this.onError( err );
        }
    }
    signalingPipeOnMessage( joMessage ) {
        switch ( joMessage.method ) {
        case "signalingImpersonate": {
            if( joMessage.error == null ) {
                // OKay, impersonated
                this.bWasImpersonated = true;
                if( settings.logging.net.signaling.generic )
                    console.log( "Success, " + this.describe() + " impersonated on signaling server" );
                this.dispatchEvent( new UniversalDispatcherEvent( "signalingPassedImpersonation", { "detail": { "actor": this } } ) );
                this.onImpersonationComplete();
            } else {
                if( settings.logging.net.signaling.error )
                    console.warn( " >>> " + this.describe() + " signaling impersonation error", joMessage.error );
                this.dispatchEvent( new UniversalDispatcherEvent( "signalingFailedImpersonation", { "detail": { "actor": this, "error": joMessage.error } } ) );
                this.onError( joMessage.error );
            }
        } break;
        default:
            if( settings.logging.net.signaling.error )
                console.warn( " >>> " + this.describe() + " unhandled signaling message", joMessage );
            break;
        } // switch( joMessage.method )
    }
    onImpersonationComplete() { }
    onOtherSideIdentified( idSomebodyOtherSide, idOffer ) { } // generic implementation should never be called
};

export class RTCServerPeer extends RTCConnection {
    constructor( rtcCreator, timeToPublishMilliseconds, timeToSignalingNegotiationMilliseconds, peerConfiguration, peerAdditionalOptions, localMediaStream ) {
        super();
        this.rtcCreator = rtcCreator;
        this.idSomebodyOtherSide = null;
        this.idOffer = this.rtcCreator.idOfferNext ++;
        this.tsOfferCreated = null;
        if( settings.logging.net.signaling.offerRegister )
            console.log( "Register offer", this.idOffer, "(RTCServerPeer constructor)" );
        this.rtcCreator.map_server_offers[0 + this.idOffer] = this;
        this.isPublishing = false;
        this.isSignalingNegotiation = false;
        this.isPublishTimeout = false;
        this.isSignalingNegotiationTimeout = false;
        this.timerPublishing = null;
        this.timerSignalingNegotiation = null;
        this.timeToPublishMilliseconds = timeToPublishMilliseconds
            ? parseInt( timeToPublishMilliseconds, 10 )
            : settings.net.rtc.timeToPublishMilliseconds;
        this.timeToSignalingNegotiationMilliseconds = timeToSignalingNegotiationMilliseconds
            ? parseInt( timeToSignalingNegotiationMilliseconds, 10 )
            : settings.net.rtc.timeToSignalingNegotiationMilliseconds;
        this.peerConfiguration = ( peerConfiguration && typeof peerConfiguration == "object" ) ? peerConfiguration : settings.net.rtc.peerConfiguration;
        this.peerAdditionalOptions = ( peerAdditionalOptions && typeof peerAdditionalOptions == "object" ) ? peerAdditionalOptions : settings.net.rtc.peerAdditionalOptions;
        this.localMediaStream = ( localMediaStream != null && localMediaStream != undefined && typeof localMediaStream == "object" ) ? localMediaStream : null;
        this.isOfferPublishedOnSignalingServer = false;
        this.initPeer();
        this.publish();
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.publishCancel();
        this.signalingNegotiationCancel();
        if( this.rtcCreator ) {
            if( this.idOffer in this.rtcCreator.map_server_offers ) {
                if( settings.logging.net.signaling.offerUnregister )
                    console.log( "Unregister offer", this.idOffer, "(RTCServerPeer dispose)" );
                delete this.rtcCreator.map_server_offers[this.idOffer];
            }
            this.idOffer = 0;
        }
        this.idOffer = 0;
        if( this.idSomebodyOtherSide != null ) {
            if( this.idSomebodyOtherSide in this.rtcCreator.map_server_peers )
                delete this.rtcCreator.map_server_peers[this.idSomebodyOtherSide];

            this.idSomebodyOtherSide = null;
        }
        this.rtcCreator = null;
        this.tsOfferCreated = null;
        super.dispose();
    }
    describe( strInstanceType, arrAdditionalProps ) {
        strInstanceType = ( strInstanceType == null || strInstanceType == undefined || ( typeof strInstanceType != "string" ) || strInstanceType.length == 0 )
            ? "server-peer"
            : strInstanceType;
        // arrAdditionalProps = arrAdditionalProps || [];
        return super.describe( strInstanceType, arrAdditionalProps );
    }
    initPeer() {
        if( this.isDisposed )
            return;
        const self = this;
        if( self.pc )
            return;
        self.pc = new wrtc_mod.RTCPeerConnection( self.peerConfiguration, self.peerAdditionalOptions );
        if( self.localMediaStream ) {
            for( const track of self.localMediaStream.getTracks() )
                self.pc.addTrack( track, self.localMediaStream );
        } else {
            self.dc = self.pc.createDataChannel( settings.net.rtc.dataChannel.label, settings.net.rtc.dataChannel.opts );
            self.dc.addEventListener( "open", function( event ) { self.onDataChannelOpen( event ); } );
            self.dc.addEventListener( "close", function( event ) { self.onDataChannelClose( event ); } );
            self.dc.addEventListener( "error", function( event ) { self.onDataChannelError( event ); } );
            self.dc.addEventListener( "message", function( event ) { self.onDataChannelMessage( event ); } );
        }
    }
    publishCancel() {
        if( ! this.isPublishing )
            return;
        this.isOfferPublishedOnSignalingServer = false;
        this.isPublishing = false;
        if( this.timerPublishing ) {
            clearTimeout( this.timerPublishing );
            this.timerPublishing = null;
        }
        this.signalingNegotiationCancel(); // mutual cancel
    }
    signalingNegotiationCancel() {
        if( ! this.isSignalingNegotiation )
            return;
        this.isSignalingNegotiation = false;
        if( this.timerSignalingNegotiation ) {
            clearTimeout( this.timerSignalingNegotiation );
            this.timerSignalingNegotiation = null;
        }
        this.publishCancel(); // mutual cancel
    }
    publish() {
        if( this.isDisposed || this.isPublishing || this.isSignalingNegotiation || ( !this.rtcCreator ) || ( !this.rtcCreator.signalingPipe ) )
            return;
        const self = this;
        self.isPublishing = true;
        if( self.timeToPublishMilliseconds > 0 ) {
            self.isSignalingNegotiation = false;
            self.timerPublishing = setTimeout( function() {
                self.publishCancel();
                self.signalingNegotiationCancel();
                self.isPublishTimeout = true;
                if( settings.logging.net.signaling.publishTimeout )
                    console.warn( " !!! " + self.describe() + " offer publish timeout " + self.timeToPublishMilliseconds + " milliseconds reached" );
                self.dispatchEvent( new UniversalDispatcherEvent( "publishTimeout", { "detail": { "participant": self } } ) );
                if( self.rtcCreator )
                    self.rtcCreator.dispatchEvent( new UniversalDispatcherEvent( "publishTimeout", { "detail": { "participant": self } } ) );
            }, self.timeToPublishMilliseconds );
        } // if( self.timeToPublishMilliseconds > 0 )
        self.dispatchEvent( new UniversalDispatcherEvent( "publishStart", { "detail": { "participant": self } } ) );
        self.pc.oniceconnectionstatechange = function( event ) { self.onIceConnectionStateChange( event ); };
        self.pc.onicegatheringstatechange = function( event ) { self.onIceGatheringStateChange( event ); };
        self.pc.onidentityresult = function( event ) { self.onIceIdentifyResult( event ); };
        self.pc.onsignalingstatechange = function( event ) { self.onIceSignalingStateChange( event ); };
        self.pc.onnegotiationneeded = function( event ) { self.onIceNegotiationNeeded( event ); };
        self.pc.createOffer( self.offerOptions ).then(
            function( offerDescription ) {
                // success
                self.tsOfferCreated = new Date();
                if( settings.logging.net.signaling.offer )
                    console.log( " <<< " + self.describe() + " offer created at " + utils.format_date_time( self.tsOfferCreated ) + " with description:", offerDescription );
                self.dispatchEvent( new UniversalDispatcherEvent( "offerCreated", { "detail": { "participant": self } } ) );
                self.pc.setLocalDescription( offerDescription ).then(
                    function() {
                        // success
                        if( settings.logging.net.signaling.localDescription )
                            console.log( " <<< " + self.describe() + " local description set:", offerDescription );
                        self.dispatchEvent( new UniversalDispatcherEvent( "localDescriptionSet", { "detail": { "participant": self } } ) );
                        self.pc.onicecandidate = function( event ) {
                            self.iceComplete = true;
                            self.onIceComplete( event );
                        }; // onicecandidate
                    }, function( err ) {
                        // error of setLocalDescription
                        self.publishCancel();
                        self.signalingNegotiationCancel();
                        self.onError( "Failed to set local description: " + err.toString() );
                    } );
            }, function() {
                self.publishCancel();
                self.signalingNegotiationCancel();
                // error of createOffer
                self.onError( "Failed to create offer:" + err.toString() );
            } );
    }
    onOtherSideIdentified( idSomebodyOtherSide ) {
        this.publishCancel();
        this.signalingNegotiationCancel();
        this.idSomebodyOtherSide = "" + idSomebodyOtherSide;
        this.wasIdentified = true;
        this.dispatchEvent( new UniversalDispatcherEvent( "identified", { "detail": { "participant": this, "idSomebodyOtherSide": "" + idSomebodyOtherSide } } ) );
    }
    onError( err ) {
        if( this.rtcCreator ) {
            this.rtcCreator.onRtcPeerError( this, err );
            if( this.idOffer in this.rtcCreator.map_server_offers ) {
                if( settings.logging.net.signaling.offerUnregister )
                    console.log( "Unregister offer", this.idOffer, "due to RTCServerPeer error:".err );
                delete this.rtcCreator.map_server_offers[this.idOffer];
            }
            this.idOffer = 0;
        }
        if( this.idSomebodyOtherSide != null ) {
            if( this.idSomebodyOtherSide in this.rtcCreator.map_server_peers )
                delete this.rtcCreator.map_server_peers[this.idSomebodyOtherSide];
            this.idSomebodyOtherSide = null;
        }
        super.onError( err );
    }
    onImpersonationCompleteForCreator() { // specific for server peer
        if( settings.logging.net.signaling.creatorImpersonationComplete )
            console.log( "Creator impersonation complete" );
    }
    publishOfferOnSignalingServer() {
        const self = this;
        try {
            if( settings.logging.net.signaling.candidate )
                console.log( " <<< " + self.describe() + " got candidate", event );
            if( settings.logging.net.signaling.candidate )
                console.log( " <<< " + self.describe() + " got candidate", event );
            if( ! self.rtcCreator.signalingPipe )
                throw new Error( "no connection to signaling server" );
            const joPublishOfferMessage = {
                "id": utils.randomCallID(),
                "method": "signalingPublishOffer",
                "offer": self.pc.localDescription,
                "idSomebodyCreator": "" + self.rtcCreator.idRtcParticipant,
                "idOffer": 0 + self.idOffer
            };
            if( settings.logging.net.signaling.message )
                console.log( " <<< " + self.describe() + " signaling message out", joPublishOfferMessage );
            self.rtcCreator.signalingPipe.send( joPublishOfferMessage );
            self.publishCancel();
            self.dispatchEvent( new UniversalDispatcherEvent( "signalingNegotiationStart", { "detail": { "participant": self } } ) );
            if( self.timeToSignalingNegotiationMilliseconds > 0 ) {
                self.isSignalingNegotiation = true;
                self.timerSignalingNegotiation = setTimeout( function() {
                    self.publishCancel();
                    self.signalingNegotiationCancel();
                    self.isSignalingNegotiationTimeout = true;
                    if( settings.logging.net.signaling.signalingNegotiationTimeout )
                        console.warn( " !!! " + self.describe() + " signaling negotiation timeout " + self.timeToSignalingNegotiationMilliseconds + " milliseconds reached" );
                    self.dispatchEvent( new UniversalDispatcherEvent( "signalingNegotiationTimeout", { "detail": { "participant": self } } ) );
                    if( self.rtcCreator )
                        self.rtcCreator.dispatchEvent( new UniversalDispatcherEvent( "signalingNegotiationTimeout", { "detail": { "participant": self } } ) );
                }, self.timeToSignalingNegotiationMilliseconds );
            } // if( self.timeToSignalingNegotiationMilliseconds > 0 )
        } catch ( err ) {
            throw err;
        }
    }
    onIceComplete( event ) {
        super.onIceComplete( event );
        const self = this;
        try {
            if( event.candidate == null || settings.net.rtc.fastPublishMode.serverPeer ) {
                if( ! self.isOfferPublishedOnSignalingServer ) {
                    self.isOfferPublishedOnSignalingServer = true;
                    self.publishOfferOnSignalingServer();
                }
            }
            if( event.candidate != null ) {
                if( settings.logging.net.signaling.candidateWalk )
                    console.log( " <<< " + self.describe() + " got candidate", event );
            }
        } catch ( err ) {
            self.publishCancel();
            self.signalingNegotiationCancel();
            self.onError( "Failed to process ICE candidate: " + err.toString() );
        }
    }
};

export class RTCCreator extends RTCActor {
    constructor( strSignalingServerURL, idRtcParticipant, offerOptions, signalingOptions ) {
        super( strSignalingServerURL, idRtcParticipant, offerOptions, signalingOptions );
        const self = this;
        self.idOfferNext = 1;
        self.isCreator = true;
        self.map_server_offers = { }; // idOffer -> RTCServerPeer
        self.map_server_peers = { }; // idSomebodyOtherSide -> RTCServerPeer
        self.signalingPipeOpen();
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        for( const [ idOffer, rtcPeer ] of Object.entries( this.map_server_offers ) ) {
            if( settings.logging.net.signaling.offerUnregister )
                console.log( "Unregister offer", idOffer, "(one of all, RTCCreator dispose)" );
            rtcPeer.dispose();
        }
        for( const [ /*idSomebodyOtherSide*/, rtcPeer ] of Object.entries( this.map_server_peers ) )
            rtcPeer.dispose();
        this.map_server_offers = { };
        // self.idOfferNext = 0;
        super.dispose();
    }
    describe( strInstanceType, arrAdditionalProps ) {
        strInstanceType = ( strInstanceType == null || strInstanceType == undefined || ( typeof strInstanceType != "string" ) || strInstanceType.length == 0 )
            ? "rtc-creator"
            : strInstanceType;
        // arrAdditionalProps = arrAdditionalProps || [];
        return super.describe( strInstanceType, arrAdditionalProps );
    }
    onOtherSideIdentified( idSomebodyOtherSide, idOffer ) { // server peer got result
        if( settings.logging.net.signaling.impersonate )
            console.log( this.describe() + " did identified other side RTC joiner \"" + idSomebodyOtherSide + "\" via offer ID " + idOffer.toString() );
        if( ! ( idOffer in this.map_server_offers ) ) {
            const strError = "not a registered pending offer(onOtherSideIdentified)";
            if( settings.logging.net.signaling.error )
                console.warn( " >>> " + this.describe() + " came across with incorrect other side identification for *somebody*", idSomebodyOtherSide, "and offer ID", idOffer, ":".strError );
            this.onError( strError );
            return;
        }
        const rtcPeer = this.map_server_offers[idOffer];
        if( settings.logging.net.signaling.offerUnregister )
            console.log( "Unregister offer", idOffer, "(onOtherSideIdentified in RTCCreator)" );
        delete this.map_server_offers[idOffer];
        this.map_server_peers["" + idSomebodyOtherSide] = rtcPeer;
        rtcPeer.onOtherSideIdentified( "" + idSomebodyOtherSide );
    }
    onRtcPeerError( rtcPeer, err ) {
        if( settings.logging.net.rtc.error )
            console.warn( " !!! " + this.describe() + " rtc peer error", err );
        this.dispatchEvent( new UniversalDispatcherEvent( "rtcPeerError", { "detail": { "actor": this, "peer": rtcPeer, "error": err } } ) );
    }
    signalingPipeOnMessage( joMessage ) {
        const self = this;
        switch ( joMessage.method ) {
        case "signalingPublishOffer": {
            if( joMessage.error == null ) {
                // OKay, creator offer published
                if( settings.logging.net.signaling.offer )
                    console.log( "Success, " + this.describe() + " offer published (step 1)" );
                this.dispatchEvent( new UniversalDispatcherEvent( "signalingPassedOfferPublish", { "detail": { "actor": this } } ) );
            } else {
                if( settings.logging.net.signaling.error )
                    console.warn( " !!! " + this.describe() + " signaling offer publishing (step 1) error", joMessage.error );
                this.dispatchEvent( new UniversalDispatcherEvent( "signalingFailedOfferPublish", { "detail": { "actor": this, "error": joMessage.error } } ) );
                this.onError( joMessage.error );
            }
        } break;
        case "signalingPublishAnswer": { // server peer got result
            if( joMessage.error == null ) {
                const idSomebodyOtherSide = "" + joMessage.idSomebody_joiner;
                const idOffer = 0 + joMessage.idOffer;
                if( ! ( idOffer in this.map_server_offers ) ) {
                    const strError = "not a registered pending offer(signalingPublishAnswer)";
                    if( settings.logging.net.signaling.error )
                        console.warn( " !!! " + this.describe() + " came across with incorrect signalingPublishAnswer message for *somebody*", idSomebodyOtherSide, "and offer ID", idOffer, ":", strError );
                    this.onError( strError );
                    return;
                }
                const rtcPeer = this.map_server_offers[idOffer];
                // OKay, finally got answer from candida
                if( settings.logging.net.signaling.generic )
                    console.log( "Success, " + this.describe() + " got answer from candidate (step 3)" );
                this.dispatchEvent( new UniversalDispatcherEvent( "signalingPassedPublishAnswer", { "detail": { "actor": this, "idSomebodyOtherSide": "" + idSomebodyOtherSide, idOffer: 0 + idOffer } } ) );
                const answer = joMessage.answer;
                if( settings.logging.net.signaling.offer )
                    console.log( " >>> " + self.describe() + " got answer:", answer );
                const answerDescription = new wrtc_mod.RTCSessionDescription( answer );
                if( settings.logging.net.signaling.offer )
                    console.log( " >>> " + self.describe() + " got answer description:", answerDescription );
                // console.log( "----- will set remote desc when in state", rtcPeer.pc.signalingState );
                if( rtcPeer.pc.signalingState != "have-local-offer" ) {
                    if( settings.logging.net.signaling.offerSkipPublishedAnswer )
                        console.warn( " >>> " + self.describe() + " in \"" + rtcPeer.pc.signalingState + "\" state will skip setting remote description from answer", answerDescription );
                    return;
                }
                rtcPeer.pc.setRemoteDescription( answerDescription ).then(
                    function() {
                        // success
                        if( settings.logging.net.signaling.remoteDescription )
                            console.log( " >>> " + self.describe() + "did set remote description:", answerDescription );
                        self.dispatchEvent( new UniversalDispatcherEvent( "remoteDescriptionSet", { "detail": { "participant": self } } ) );
                        self.onOtherSideIdentified( idSomebodyOtherSide, idOffer ); // server peer got result
                    }, function( err ) {
                        // error
                        self.onError( "Failed to set remote description: " + err.toString() );
                    } );
            } else {
                if( settings.logging.net.signaling.error )
                    console.warn( " !!! " + this.describe() + " error getting candidate answer (step 1) error", joMessage.error );
                this.dispatchEvent( new UniversalDispatcherEvent( "signalingFailedPublishAnswer", { "detail": { "actor": this, "error": joMessage.error } } ) );
                this.onError( joMessage.error );
            }
        } break;
        default:
            super.signalingPipeOnMessage( joMessage );
            break;
        } // switch( joMessage.method )
    }
    send( data ) { // implementation in RTCCreator does send to all
        try {
            const s = socket_sent_data_marshall( data );
            for( const [ /*idSomebodyOtherSide*/, rtcPeer ] of Object.entries( this.map_server_peers ) ) {
                try {
                    rtcPeer.send( s );
                } catch ( err ) {
                    this.onRtcPeerError( rtcPeer, err );
                }
            }
        } catch ( err ) {
            this.onError( err );
        }
    }
    onImpersonationComplete() {
        super.onImpersonationComplete();
        for( const [ /*idOffer*/, rtcPeer ] of Object.entries( this.map_server_offers ) )
            rtcPeer.onImpersonationCompleteForCreator();
        for( const [ /*idSomebodyOtherSide*/, rtcPeer ] of Object.entries( this.map_server_peers ) )
            rtcPeer.onImpersonationCompleteForCreator();
    }
};

export class RTCJoiner extends RTCActor {
    constructor( strSignalingServerURL, idRtcParticipant, offerOptions, signalingOptions, peerConfiguration, peerAdditionalOptions ) {
        super( strSignalingServerURL, idRtcParticipant, offerOptions, signalingOptions );
        this.idSomebodyOtherSide = null;
        this.idOffer = 0;
        this.isJoiner = true;
        this.tsAnswerCreated = null;
        this.isAnswerPublishedOnSignalingServer = false;
        this.signalingPipeOpen();
        this.peerConfiguration = ( peerConfiguration && typeof peerConfiguration == "object" ) ? peerConfiguration : settings.net.rtc.peerConfiguration;
        this.peerAdditionalOptions = ( peerAdditionalOptions && typeof peerAdditionalOptions == "object" ) ? peerAdditionalOptions : settings.net.rtc.peerAdditionalOptions;
        // this.initPeer();
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.idSomebodyOtherSide = null;
        this.idOffer = 0;
        this.tsAnswerCreated = null;
        this.isAnswerPublishedOnSignalingServer = false;
        super.dispose();
    }
    describe( strInstanceType, arrAdditionalProps ) {
        strInstanceType = ( strInstanceType == null || strInstanceType == undefined || ( typeof strInstanceType != "string" ) || strInstanceType.length == 0 )
            ? "rtc-joiner"
            : strInstanceType;
        // arrAdditionalProps = arrAdditionalProps || [];
        return super.describe( strInstanceType, arrAdditionalProps );
    }
    initPeer() {
        if( this.isDisposed )
            return;
        const self = this;
        if( self.pc )
            return;
        self.pc = new wrtc_mod.RTCPeerConnection( self.peerConfiguration, self.peerAdditionalOptions );
        self.pc.addEventListener( "track", function( event ) {
            self.dispatchEvent( new UniversalDispatcherEvent( "trackAvailable", { "detail": { "participant": self, "event": event } } ) );
        } );
        self.pc.oniceconnectionstatechange = function( event ) { self.onIceConnectionStateChange( event ); };
        self.pc.onicegatheringstatechange = function( event ) { self.onIceGatheringStateChange( event ); };
        self.pc.onidentityresult = function( event ) { self.onIceIdentifyResult( event ); };
        self.pc.onsignalingstatechange = function( event ) { self.onIceSignalingStateChange( event ); };
        self.pc.onnegotiationneeded = function( event ) { self.onIceNegotiationNeeded( event ); };
        self.pc.ondatachannel = function( event ) {
            self.dispatchEvent( new UniversalDispatcherEvent( "dataChannelAvailable", { "detail": { "participant": self, "event": event } } ) );
            const dataChannel = event.channel || event;
            self.dc = dataChannel;
            self.dc.addEventListener( "open", function( event ) { self.onDataChannelOpen( event ); } );
            self.dc.addEventListener( "close", function( event ) { self.onDataChannelClose( event ); } );
            self.dc.addEventListener( "error", function( event ) { self.onDataChannelError( event ); } );
            self.dc.addEventListener( "message", function( event ) { self.onDataChannelMessage( event ); } );
        };
        self.pc.onicecandidate = function( event ) {
            self.iceComplete = true;
            self.onIceComplete( event );
            try {
                if( ! self.signalingPipe ) {
                    if( self.dc )
                        return; // already connected, ignore (Firefox fix)
                    // if( self.pc && self.pc.onicecandidate )
                    //     self.pc.onicecandidate = null;
                    throw new Error( "no connection to signaling server" );
                }
                if( ! self.isAnswerPublishedOnSignalingServer ) {
                    self.publishSignalingAnswer( event );
                    self.iAnswerPublishedOnSignalingServer = true;
                }
                if( event.candidate != null ) {
                    if( settings.logging.net.signaling.candidateWalk )
                        console.log( " <<< " + self.describe() + " got candidate", event );
                }
            } catch ( err ) {
                // self.publishCancel();
                // self.signalingNegotiationCancel();
                self.onError( "Failed to process ICE candidate: " + err.toString() );
            }
        }; // onicecandidate
    }
    publishSignalingAnswer( event ) {
        const self = this;
        try {
            if( event.candidate == null || settings.net.rtc.fastPublishMode.joiner ) {
                if( settings.logging.net.signaling.candidate )
                    console.log( " <<< " + self.describe() + " got candidate", event );
                if( ! self.signalingPipe )
                    throw new Error( "no connection to signaling server" );
                const joPublishAnswerMessage = {
                    "id": utils.randomCallID(),
                    "method": "signalingPublishAnswer",
                    "answer": self.pc.localDescription,
                    "idRtcParticipant": "" + self.idRtcParticipant,
                    "idSomebodyCreator": "" + self.idSomebodyCreator,
                    "idOffer": 0 + self.idOffer
                };
                if( settings.logging.net.signaling.message )
                    console.log( " <<< " + self.describe() + " signaling client message out", joPublishAnswerMessage );
                self.signalingPipe.send( joPublishAnswerMessage );
            }
        } catch ( err ) {
            throw err;
        }
    }
    delayedInitPeer() {
        if( this.bWasImpersonated )
            this.initPeer();
    }
    onImpersonationComplete() {
        super.onImpersonationComplete();
        const joFetchOfferMessage = {
            "id": utils.randomCallID(),
            "method": "signalingFetchOffer"
        };
        if( settings.logging.net.signaling.message )
            console.log( " <<< " + this.describe() + " signaling client message out", joFetchOfferMessage );
        this.signalingPipe.send( joFetchOfferMessage );
    }
    onIceComplete( event ) {
        super.onIceComplete( event );
    }
    onOtherSideIdentified( idSomebodyOtherSide, idOffer ) { // client peer got result
        if( settings.logging.net.signaling.impersonate )
            console.log( this.describe() + " did identified other side RTC creator \"" + idSomebodyOtherSide + "\" via offer ID " + idOffer.toString() );
        this.idSomebodyOtherSide = "" + idSomebodyOtherSide;
        this.idOffer = 0 + idOffer;
        this.wasIdentified = true;
        this.dispatchEvent( new UniversalDispatcherEvent( "identified", { "detail": { "participant": this, "idSomebodyOtherSide": "" + idSomebodyOtherSide } } ) );
    }
    signalingPipeOnMessage( joMessage ) {
        const self = this;
        switch ( joMessage.method ) {
        case "signalingFetchOffer": {
            if( joMessage.error == null ) {
                // OKay, fetched offer from creator
                this.delayedInitPeer();
                this.idSomebodyCreator = "" + joMessage.idSomebodyCreator;
                const idSomebodyOtherSide = "" + joMessage.idSomebodyCreator;
                const idOffer = 0 + joMessage.idOffer;
                if( settings.logging.net.signaling.generic )
                    console.log( "Success, " + this.describe() + " fetched offer from creator (step 2)" );
                this.dispatchEvent( new UniversalDispatcherEvent( "signalingPassedFetchOffer", { "detail": { "actor": this, "idSomebodyOtherSide": "" + idSomebodyOtherSide, idOffer: 0 + idOffer } } ) );
                const offer = joMessage.offer;
                if( settings.logging.net.signaling.offer )
                    console.log( " <<< " + self.describe() + " got offer:", offer );
                const offerDescription = new wrtc_mod.RTCSessionDescription( offer );
                if( settings.logging.net.signaling.offer )
                    console.log( " <<< " + self.describe() + " got offer description:", offerDescription );
                this.pc.setRemoteDescription( offerDescription ).then(
                    function() {
                        // success
                        if( settings.logging.net.signaling.remoteDescription )
                            console.log( " <<< " + self.describe() + "did set remote description:", offerDescription );
                        self.dispatchEvent( new UniversalDispatcherEvent( "remoteDescriptionSet", { "detail": { "participant": self } } ) );
                        self.pc.createAnswer( self.offerOptions ).then(
                            function( answerDescription ) {
                                // success
                                self.tsAnswerCreated = new Date();
                                if( settings.logging.net.signaling.answer )
                                    console.log( " <<< " + self.describe() + "did created answer at " + utils.format_date_time( self.tsAnswerCreated ) + " with description:", answerDescription );
                                self.dispatchEvent( new UniversalDispatcherEvent( "answerCreated", { "detail": { "participant": self } } ) );
                                self.pc.setLocalDescription( answerDescription ).then(
                                    function() {
                                        // success
                                        if( settings.logging.net.signaling.localDescription )
                                            console.log( " <<< " + self.describe() + " local description set:", answerDescription );
                                        self.dispatchEvent( new UniversalDispatcherEvent( "localDescriptionSet", { "detail": { "participant": self } } ) );
                                        self.onOtherSideIdentified( idSomebodyOtherSide, idOffer ); // client peer got result
                                    }, function( err ) {
                                        // error of setLocalDescription
                                        self.onError( "Failed to set local description (while fetching offer for \"" + idSomebodyOtherSide + "\"): " + err.toString() );
                                    } );
                            }, function( err ) {
                                // error of createAnswer
                                self.onError( "Failed to create answer (while fetching offer for \"" + idSomebodyOtherSide + "\"): " + err.toString() );
                            } );
                    }, function( err ) {
                        // error of setLocalDescription
                        self.onError( "Failed to set remote description: (while fetching offer for \"" + idSomebodyOtherSide + "\"): " + err.toString() );
                    } );
            } else {
                if( settings.logging.net.signaling.error )
                    console.warn( " !!! " + this.describe() + " signaling offer publishing (step 1) error", joMessage.error );
                this.dispatchEvent( new UniversalDispatcherEvent( "signalingFailedFetchOffer", { "detail": { "actor": this, "error": joMessage.error } } ) );
                this.onError( joMessage.error );
            }
        } break;
        default:
            super.signalingPipeOnMessage( joMessage );
            break;
        } // switch( joMessage.method )
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export class WebRTCServerPipe extends BasicSocketPipe {
    constructor( acceptor, rtcPeer, strSignalingServerURL ) {
        super();
        const self = this;
        self.socketType = "WebRTC";
        self.socketSubtype = "server";
        self.isConnected = true;
        self.acceptor = acceptor;
        self.clientNumber = 0 + acceptor.nextClientNumber;
        self.clientPort = 0 + self.clientNumber;
        ++ acceptor.nextClientNumber;
        self.rtcPeer = rtcPeer;
        self.strSignalingServerURL = utils.makeValidSignalingServerURL( strSignalingServerURL );
        self.url = "rtc_server_pipe(" + self.clientNumber + ")://" + strSignalingServerURL;
        // self.rtcPeer.on( "identified", function( event ) {
        //     if( settings.logging.net.signaling.generic )
        //         console.log( self.describe() + " is now identified peer", event.detail.idSomebodyOtherSide );
        // } );
        self.rtcPeer.on( "dataChannelOpen", function( jo ) {
            self.isConnected = true;
            self.acceptor.mapClients["" + self.clientPort] = self;
            self.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self } ) );
            self.acceptor.dispatchEvent( new UniversalDispatcherEvent( "connection", { "socket": self, strSignalingServerURL: "" + strSignalingServerURL } ) );
        } );
        self.rtcPeer.on( "dataChannelMessage", function( jo ) {
            self.receive( jo.detail.data );
        } );
        self.rtcPeer.on( "rtcParticipantError", function( jo ) {
            self.isConnected = false;
            self.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": self, "message": jo } ) );
        } );
        self.rtcPeer.on( "dataChannelError", function( jo ) {
            self.isConnected = false;
            self.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": self, "message": jo } ) );
        } );
        self.rtcPeer.on( "dataChannelClose", function( jo ) {
            self.isConnected = false;
            self.dispatchEvent( new UniversalDispatcherEvent( "close", { "socket": self, "message": jo } ) );
        } );
        self.rtcPeer.on( "peerClose", function( jo ) {
            self.isConnected = false;
            self.dispatchEvent( new UniversalDispatcherEvent( "close", { "socket": self, "message": jo } ) );
        } );
    }
    dispose() {
        this.performDisconnect();
        super.dispose();
    }
    handleServerDisposed() {
        this.performDisconnect();
        this.isConnected = false;
        this.clientNumber = 0;
        this.acceptor = null;
        this.rtcPeer = null;
        this.url = "";
        this.strSignalingServerURL = "";
        super.handleServerDisposed();
        this.dispose();
    }
    performDisconnect() {
        if( ! this.isConnected )
            return;
        this.isConnected = false;
        if( this.acceptor )
            this.acceptor.unregisterClientByKey( this.clientPort );
        if( this.rtcPeer ) {
            this.rtcPeer.offAll();
            this.rtcPeer = null;
        }
        this.clientNumber = 0;
        this.acceptor = null;
        this.url = "";
        this.strSignalingServerURL = "";
    }
    impl_send( data ) {
        if( ( !this.isConnected ) || ( !this.rtcPeer ) ) {
            const err = "Cannot send messages to disconnected WebRTC socket server pipe";
            this.onError( err );
            throw err;
        }
        const s = socket_sent_data_marshall( data );
        this.rtcPeer.send( s );
    }
    disconnect() {
        this.performDisconnect();
        super.disconnect();
    }
    impl_receive( data ) {
        const jo = socket_received_data_reverse_marshall( data );
        this.dispatchEvent( new UniversalDispatcherEvent( "message", { "socket": this, "message": jo } ) );
    }
};

export class WebRTCServerAcceptor extends BasicServerAcceptor {
    constructor( strSignalingServerURL, idRtcParticipant, offerOptions, signalingOptions, maxActiveOfferCount, timeToPublishMilliseconds, timeToSignalingNegotiationMilliseconds, peerConfiguration, peerAdditionalOptions ) {
        super();
        this.strSignalingServerURL = utils.makeValidSignalingServerURL( strSignalingServerURL );
        this.idRtcParticipant = "" + ( ( idRtcParticipant != null && idRtcParticipant != undefined && typeof idRtcParticipant == "string" && idRtcParticipant.length > 0 ) ? idRtcParticipant : utils.uuid_v4() );
        this.offerOptions = offerOptions ? offerOptions : null;
        this.signalingOptions = signalingOptions ? signalingOptions : null;
        this.peerConfiguration = ( peerConfiguration && typeof peerConfiguration == "object" ) ? peerConfiguration : settings.net.rtc.peerConfiguration;
        this.peerAdditionalOptions = ( peerAdditionalOptions && typeof peerAdditionalOptions == "object" ) ? peerAdditionalOptions : settings.net.rtc.peerAdditionalOptions;
        this.socketType = "WebRTC";
        this.maxActiveOfferCount = ( maxActiveOfferCount != null && maxActiveOfferCount != undefined ) ? parseInt( maxActiveOfferCount, 10 ) : settings.net.rtc.maxActiveOfferCount;
        if( this.maxActiveOfferCount < 1 )
            this.maxActiveOfferCount = 1;
        this.mapPendingOffers = { }; // idOffer -> RTCServerPeer
        this.timeToPublishMilliseconds = timeToPublishMilliseconds
            ? parseInt( timeToPublishMilliseconds, 10 )
            : settings.net.rtc.timeToPublishMilliseconds;
        this.timeToSignalingNegotiationMilliseconds = timeToSignalingNegotiationMilliseconds
            ? parseInt( timeToSignalingNegotiationMilliseconds, 10 )
            : settings.net.rtc.timeToSignalingNegotiationMilliseconds;
        this.rtcCreator = new RTCCreator( "" + this.strSignalingServerURL, "" + this.idRtcParticipant, this.offerOptions, this.signalingOptions );
        this.isListening = true;
        const self = this;
        this.rtcCreator.on( "signalingPassedImpersonation", function( eventData ) {
            self.updateAllPendingOffers();
            self.dispatchEvent( new UniversalDispatcherEvent( "signalingPassedImpersonation", { "detail": { "acceptor": self } } ) );
        } );
        this.rtcCreator.on( "signalingFailedImpersonation", function( eventData ) {
            self.dispatchEvent( new UniversalDispatcherEvent( "signalingFailedImpersonation", { "detail": { "acceptor": self } } ) );
        } );
        this.rtcCreator.on( "error", function( eventData ) {
            self.dispatchEvent( new UniversalDispatcherEvent( "error", { "detail": { "acceptor": self, "eventData": eventData, "errorType": "rtcCreatorError" } } ) );
        } );
        this.rtcCreator.on( "close", function( eventData ) {
            self.dispatchEvent( new UniversalDispatcherEvent( "close", { "detail": { "acceptor": self, "eventData": eventData } } ) );
        } );
        self.rtcCreator.on( "signalingPipeError", function( jo ) {
            self.isConnected = false;
            self.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": self, "message": jo, "errorType": "signalingPipeError" } ) );
        } );
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.removeAllPendingOffers();
        if( this.rtcCreator ) {
            this.rtcCreator.dispose();
            this.rtcCreator = null;
        }
        this.disposeNotifyClients();
        super.dispose();
    }
    // flush() {
    //     if( this.isDisposed )
    //         return;
    //     if( this.rtcCreator ) {
    //         for( const [ /*idSomebodyOtherSide*/, rtcPeer ] of Object.entries( this.rtcCreator.map_server_peers ) ) {
    //             const serverPipe = rtcPeer.serverPipe;
    //             serverPipe.flush();
    //         }
    //     }
    // }
    addPendingOffer() {
        if( this.isDisposed )
            return;
        const rtcPeer = new RTCServerPeer( this.rtcCreator, this.timeToPublishMilliseconds, this.timeToSignalingNegotiationMilliseconds, this.peerConfiguration, this.peerAdditionalOptions );
        const self = this;
        rtcPeer.on( "identified", function( event ) {
            if( rtcPeer.isDisposing || rtcPeer.isDisposed )
                return;
            if( settings.logging.net.signaling.generic )
                console.log( self.rtcCreator.describe() + " is now identified peer", event.detail.idSomebodyOtherSide );
            rtcPeer.serverPipe = new WebRTCServerPipe( self, rtcPeer, self.strSignalingServerURL );
            self.detachPendingOffer( rtcPeer.idOffer );
            self.dispatchEvent( new UniversalDispatcherEvent( "identified", { "detail": { "peer": rtcPeer } } ) );
            self.updateAllPendingOffers();
        } );
        rtcPeer.on( "localDescriptionSet", function( event ) {
            self.dispatchEvent( new UniversalDispatcherEvent( "peerLocalDescriptionSet", { "detail": { "acceptor": self, "peerEvent": event } } ) );
        } );
        const onTimeoutHandler = function() {
            self.disposePendingOffer( rtcPeer.idOffer );
            self.updateAllPendingOffers();
        };
        rtcPeer.on( "publishTimeout", onTimeoutHandler );
        rtcPeer.on( "signalingNegotiationTimeout", onTimeoutHandler );
        rtcPeer.on( "signalingNegotiationStart", function() {
            self.updateAllPendingOffers();
        } );

        const retranslateError = function( eventData ) {
            self.dispatchEvent( new UniversalDispatcherEvent( "error", { "detail": { "acceptor": self, "rtcPeer": rtcPeer, "eventData": eventData, "errorType": "rtcPeerError" } } ) );
        };
        rtcPeer.on( "error", retranslateError );
        rtcPeer.on( "rtcPeerError", retranslateError );

        this.mapPendingOffers[rtcPeer.idOffer] = rtcPeer;
    }
    detachPendingOffer( idOffer ) {
        if( idOffer in this.mapPendingOffers )
            delete this.mapPendingOffers[idOffer];
    }
    disposePendingOffer( idOffer ) {
        if( idOffer in this.mapPendingOffers ) {
            const rtcPeer = this.mapPendingOffers[idOffer];
            rtcPeer.dispose();
            delete this.mapPendingOffers[idOffer];
        }
    }
    removeAllPendingOffers() {
        for( const [ /*idOffer*/, rtcPeer ] of Object.entries( this.rtcCreator.map_server_peers ) ) {
            const serverPipe = rtcPeer.serverPipe;
            serverPipe.dispose();
        }
        this.rtcCreator.map_server_peers = { };
        for( const [ /*idOffer*/, rtcPeer ] of Object.entries( this.rtcCreator.mapPendingOffers ) )
            rtcPeer.dispose();

        this.mapPendingOffers = { };
    }
    updateAllPendingOffers() {
        if( this.isDisposed )
            return;
        for( let n = Object.keys( this.mapPendingOffers ); n < this.maxActiveOfferCount; ++ n )
            this.addPendingOffer();
    }
};

export class WebRTCClientPipe extends BasicSocketPipe {
    constructor( strSignalingServerURL, idRtcParticipant, offerOptions, signalingOptions, peerConfiguration, peerAdditionalOptions ) {
        super();
        this.strSignalingServerURL = utils.makeValidSignalingServerURL( strSignalingServerURL );
        this.idRtcParticipant = "" + ( ( idRtcParticipant != null && idRtcParticipant != undefined && typeof idRtcParticipant == "string" && idRtcParticipant.length > 0 ) ? idRtcParticipant : utils.uuid_v4() );
        this.offerOptions = offerOptions ? offerOptions : null;
        this.signalingOptions = signalingOptions ? signalingOptions : null;
        this.peerConfiguration = ( peerConfiguration && typeof peerConfiguration == "object" ) ? peerConfiguration : settings.net.rtc.peerConfiguration;
        this.peerAdditionalOptions = ( peerAdditionalOptions && typeof peerAdditionalOptions == "object" ) ? peerAdditionalOptions : settings.net.rtc.peerAdditionalOptions;
        this.socketType = "WebRTC";
        this.socketSubtype = "client";
        this.isConnected = false;
        this.rtcPeer = null;
        this.isAutoCloseSignalingPipeOnDataChannelOpen = settings.net.rtc.isAutoCloseSignalingPipeOnDataChannelOpen ? true : false;
        this.url = "rtc_client_pipe-" + this.strSignalingServerURL;
        this.reconnect();
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        this.performDisconnect();
        this.strSignalingServerURL = null;
        super.dispose();
    }
    impl_send( data ) {
        if( ( !this.isConnected ) || ( !this.rtcPeer ) ) {
            const s = "Cannot send messages to disconnected WebRTC socket client pipe";
            this.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": this, "message": "" + s, "errorType": "dataSendError" } ) );
            throw new Error( s );
        }
        const s = socket_sent_data_marshall( data );
        this.rtcPeer.send( s );
    }
    reconnect() {
        this.performDisconnect();
        this.rtc_connect( "" + this.strSignalingServerURL );
    }
    disconnect() {
        this.performDisconnect();
        super.disconnect();
    }
    performDisconnect() {
        if( ! this.isConnected )
            return;
        this.rtc_disconnect();
    }
    rtc_connect( strSignalingServerURL ) {
        if( strSignalingServerURL.length == 0 ) {
            const s = "Cannot connect signaling server \"" + strSignalingServerURL + "\", bad url";
            this.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": this, "message": "" + s, "errorType": "badSignalingServerURL" } ) );
            throw new Error( s );
        }
        const self = this;
        while( true ) {
            try {
                if( self.isConnected || self.rtcPeer )
                    self.rtc_disconnect();
                self.rtcPeer = new RTCJoiner( "" + strSignalingServerURL, "" + self.idRtcParticipant, self.offerOptions, self.signalingOptions, self.peerConfiguration, self.peerAdditionalOptions ); // client side
                self.strSignalingServerURL = utils.makeValidSignalingServerURL( strSignalingServerURL );
                self.rtcPeer.on( "identified", function( event ) {
                    if( settings.logging.net.signaling.generic )
                        console.log( self.rtcPeer.describe() + " is now identified peer", event.detail.idSomebodyOtherSide );
                } );
                self.rtcPeer.on( "dataChannelOpen", function( jo ) {
                    self.isConnected = true;
                    self.dispatchEvent( new UniversalDispatcherEvent( "open", { "socket": self } ) );
                    if( self.isAutoCloseSignalingPipeOnDataChannelOpen ) {
                        if( settings.logging.net.signaling.disconnect )
                            console.warn( self.rtcPeer.describe() + " will auto-close signaling pipe(inside socket \"dataChannelOpen\" handler)" );
                        self.rtcPeer.signalingPipeClose();
                    }
                } );
                self.rtcPeer.on( "dataChannelMessage", function( jo ) {
                    self.receive( jo.detail.data );
                } );
                self.rtcPeer.on( "rtcParticipantError", function( jo ) {
                    self.isConnected = false;
                    self.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": self, "message": jo, "errorType": "rtcParticipantError" } ) );
                } );
                self.rtcPeer.on( "dataChannelError", function( jo ) {
                    self.isConnected = false;
                    self.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": self, "message": jo, "errorType": "dataChannelError" } ) );
                } );
                self.rtcPeer.on( "dataChannelClose", function( jo ) {
                    self.isConnected = false;
                    self.dispatchEvent( new UniversalDispatcherEvent( "close", { "socket": self, "message": jo } ) );
                } );
                self.rtcPeer.on( "signalingPipeError", function( jo ) {
                    self.isConnected = false;
                    self.dispatchEvent( new UniversalDispatcherEvent( "error", { "socket": self, "message": jo, "errorType": "signalingPipeError" } ) );
                } );
                return;
            } catch ( err ) {
                console.warn( "WebRTC client connect error:", err );
                continue;
            }
        } // while( true )
    }
    rtc_disconnect() {
        if( this.rtcPeer ) {
            this.rtcPeer.offAll();
            this.rtcPeer.dispose();
            this.rtcPeer = null;
        }
        this.isConnected = false;
        this.url = "";
    }
    impl_receive( data ) {
        const jo = socket_received_data_reverse_marshall( data );
        this.dispatchEvent( new UniversalDispatcherEvent( "message", { "socket": this, "message": jo } ) );
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
