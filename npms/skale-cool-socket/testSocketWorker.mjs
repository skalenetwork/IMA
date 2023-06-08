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
 * @file testSocketWorker.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as networkLayer from "./socket.mjs";
import { TestSocketServer } from "./testSocketServer.mjs";
import {
    parentPort
    //, workerData
} from "worker_threads";

parentPort.on( "message", jo => {
    if( networkLayer.inWorkerAPIs.onMessage( jo ) )
        return;
} );

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

const url = "local_worker_server";
const acceptor = new networkLayer.InWorkerSocketServerAcceptor( url, doSendMessage );
const server = new TestSocketServer( acceptor );
server.on( "dispose", function() { console.log( "disposed in-worker server" ); } );
