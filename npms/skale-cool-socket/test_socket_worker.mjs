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
 * @file test_socket_worker.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as network_layer from "./socket.mjs";
import { TestSocketServer } from "./test_socket_server.mjs";
import {
    parentPort
    //, workerData
} from "worker_threads";

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

const url = "local_worker_server";
const acceptor = new network_layer.InWorkerSocketServerAcceptor( url, doSendMessage );
const server = new TestSocketServer( acceptor );
server.on( "dispose", function() { console.log( "disposed in-worker server" ); } );
