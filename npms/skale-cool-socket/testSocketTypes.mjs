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
 * @file testSocketTypes.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as path from "path";
import * as url from "url";
import * as networkLayer from "./socket.mjs";
import { TestSocketServer } from "./testSocketServer.mjs";
import { Worker } from "worker_threads";
import { settings } from "./socketSettings.mjs";
import * as ws from "ws";

const __dirname = path.dirname( url.fileURLToPath( import.meta.url ) );

const joTestMessage = { "method": "echo", "message": "Please echo this message!" };

const sleep = ( milliseconds ) => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
};

async function testLocal() {
    console.log( "Local test" );
    const strEndPoint = "local_endpoint";
    const acceptor = new networkLayer.LocalSocketServerAcceptor( strEndPoint );
    const server = new TestSocketServer( acceptor );
    const client = new networkLayer.LocalSocketClientPipe( strEndPoint );
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

async function testWorker() {
    console.log( "Worker test" );
    const url = "local_worker_server";
    const worker =
        new Worker(
            path.join( __dirname, "testSocketWorker.mjs" ),
            { "type": "module" }
        );
    console.log( "Will connect to " + url );
    worker.on( "message", jo => {
        if( networkLayer.outOfWorkerAPIs.onMessage( worker, jo ) )
            return;
    } );
    const client = new networkLayer.OutOfWorkerSocketClientPipe( url, worker );
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

async function testWS() {
    console.log( "Web socket test" );
    networkLayer.setWsModule( ws );
    const nPort = 33123;
    const url =
        ( settings.net.secure ? "wss" : "ws" ) +
        "://127.0.0.1:" + nPort;
    const key = settings.net.secure
        ? fs.readFileSync( "./self-signed/self-signed-key.pem", "utf8" ) : null;
    const cert = settings.net.secure
        ? fs.readFileSync( "./self-signed/self-signed-cert.pem", "utf8" ) : null;
    const acceptor = new networkLayer.WebSocketServerAcceptor( nPort, key, cert );
    const server = new TestSocketServer( acceptor );
    const client = new networkLayer.WebSocketClientPipe( url );
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
    await testLocal();
    await testWorker();
    await testWS();
    process.exit( 0 );
}
test();
