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
 * @file test_socket_types.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as path from "path";
import * as url from "url";
import * as network_layer from "./socket.mjs";
import { TestSocketServer } from "./test_socket_server.mjs";
import { Worker } from "worker_threads";
import { settings } from "./socket_settings.mjs";
import * as ws from "ws";

const __dirname = path.dirname( url.fileURLToPath( import.meta.url ) );

// import * as wrtc from "wrtc";

const joTestMessage = { "method": "echo", "message": "Please echo this message!" };

const sleep = ( milliseconds ) => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
};

async function test_local() {
    console.log( "Local test" );
    const strEndPoint = "local_endpoint";
    const acceptor = new network_layer.LocalSocketServerAcceptor( strEndPoint );
    const server = new TestSocketServer( acceptor );
    const client = new network_layer.LocalSocketClientPipe( strEndPoint );
    client.on( "message", function( eventData ) {
        const joMessage = eventData.message;
        console.log( "CLIENT <<<", JSON.stringify( joMessage ) );
        client.disconnect();
        console.log( " " );
    } );
    await sleep( 1 );
    console.log( "CLIENT >>>", JSON.stringify( joTestMessage ) );
    client.send( joTestMessage );
    await sleep( 100 );
    const joReturnValue = {
        server: server,
        client: client
    };
    return joReturnValue;
}

async function test_worker() {
    console.log( "Worker test" );
    const url = "local_worker_server";
    const worker =
        new Worker(
            path.join( __dirname, "test_socket_worker.mjs" ),
            { "type": "module" }
        );
    console.log( "Will connect to " + url );
    worker.on( "message", jo => {
        if( network_layer.out_of_worker_apis.on_message( worker, jo ) )
            return;
    } );
    const client = new network_layer.OutOfWorkerSocketClientPipe( url, worker );
    client.on( "message", function( eventData ) {
        const joMessage = eventData.message;
        console.log( "CLIENT <<<", JSON.stringify( joMessage ) );
        client.disconnect();
        worker.terminate();
        console.log( " " );
    } );
    await sleep( 100 );
    console.log( "CLIENT >>>", JSON.stringify( joTestMessage ) );
    client.send( joTestMessage );
    await sleep( 100 );
    const joReturnValue = {
        worker: worker,
        client: client
    };
    return joReturnValue;
}

async function test_web_socket() {
    console.log( "Web socket test" );
    network_layer.set_ws_mod( ws );
    const nPort = 33123;
    const url =
        ( settings.net.secure ? "wss" : "ws" ) +
        "://127.0.0.1:" + nPort;
    const key = settings.net.secure
        ? fs.readFileSync( "./self-signed/self-signed-key.pem", "utf8" ) : null;
    const cert = settings.net.secure
        ? fs.readFileSync( "./self-signed/self-signed-cert.pem", "utf8" ) : null;
    const acceptor = new network_layer.WebSocketServerAcceptor( nPort, key, cert );
    const server = new TestSocketServer( acceptor );
    const client = new network_layer.WebSocketClientPipe( url );
    client.on( "message", function( eventData ) {
        const joMessage = eventData.message;
        console.log( "CLIENT <<<", JSON.stringify( joMessage ) );
        client.disconnect();
        console.log( " " );
    } );
    await sleep( 100 );
    console.log( "CLIENT >>>", JSON.stringify( joTestMessage ) );
    client.send( joTestMessage );
    await sleep( 100 );
    const joReturnValue = {
        server: server,
        client: client
    };
    return joReturnValue;
}

async function test() {
    await test_local();
    await test_worker();
    await test_web_socket();
    process.exit( 0 );
}
test();
