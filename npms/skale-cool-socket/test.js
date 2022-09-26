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
 * @file test.js
 * @copyright SKALE Labs 2019-Present
 */

const network_layer = require( "./socket.js" );
const { TestServer } = require( "./test_server.js" );
const { Worker } = require( "worker_threads" );
const { settings } = require( "./settings.js" );
const ws = require( "ws" );
// const wrtc = require( "wrtc" );

const joTestMessage = { "method": "echo", "message": "Please echo this message!" };

const sleep = ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

async function test_local() {
    console.log( "Local test" );
    const strEndPoint = "local_endpoint";
    const acceptor = new network_layer.LocalSocketServerAcceptor( strEndPoint );
    const server = new TestServer( acceptor );
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
    const worker = new Worker( "./test_worker.js" );
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
    const url = ( settings.net.secure ? "wss" : "ws" ) + "://127.0.0.1:" + nPort;
    const key = settings.net.secure ? fs.readFileSync( "./self-signed/self-signed-key.pem", "utf8" ) : null;
    const cert = settings.net.secure ? fs.readFileSync( "./self-signed/self-signed-cert.pem", "utf8" ) : null;
    const acceptor = new network_layer.WebSocketServerAcceptor( nPort, key, cert );
    const server = new TestServer( acceptor );
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

// async function test_wrtc() {
//     //
//     // Needed in package.json: "wrtc": "^0.4.6",
//     //
//     // ## Coturn - own STUN and/or TURN server
//     //
//     // See <https://github.com/coturn/coturn> and see <https://www.allerstorfer.at/install-coturn-on-ubuntu/>
//     // Explanation for Mac OSX is <https://medium.com/@ittipon.bay/how-to-setup-coturn-for-mac-a3c4a6ba4db8>
//     //
//     // Install via **sudo apt-get install coturn** or **brew install coturn**.
//     // Run **sudo nano /etc/turnserver.conf** and specify described in <https://www.allerstorfer.at/install-coturn-on-ubuntu/>,
//     // realm **realm=origin/realm**, **no-tls** and **no-dtls**. Also set **listening-ip** to **0.0.0.0**
//     //
//     // **STUN** config entry is **{ urls: "stun:127.0.0.1:3478", username: "webrtc", credential: "qwerty" }**.
//     // **TURN** config entry is **{ urls: "turn:127.0.0.1:3478", username: "webrtc", credential: "qwerty" }**.
//     //
//     console.log( "Web RTC test" );
//     network_layer.set_ws_mod( ws );
//     network_layer.set_wrtc_mod( wrtc );
//     const url = null; // null here means url will be got from settings
//     const acceptor = new network_layer.WebRTCServerAcceptor( url );
//     const server = new TestServer( acceptor );
//     server.on( "dispose", function() { console.log( "disposed", url ); } );
//     console.log( "Will connect to " + url );
//     const client = new network_layer.WebRTCClientPipe( url );
//     client.on( "message", function( eventData ) {
//         const joMessage = eventData.message;
//         console.log( "CLIENT <<<", JSON.stringify( joMessage ) );
//         client.disconnect();
//         console.log( " " );
//     } );
//     await sleep( 1000 );
//     console.log( "CLIENT >>>", JSON.stringify( joTestMessage ) );
//     client.send( joTestMessage );
//     await sleep( 1000 );
//     const joReturnValue = {
//         server: server,
//         client: client
//     };
//     return joReturnValue;
// }

async function test() {
    await test_local();
    await test_worker();
    await test_web_socket();
    // await test_wrtc();
    process.exit( 0 );
}
test();
