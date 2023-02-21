// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
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
 * @file rpc-call.js
 * @copyright SKALE Labs 2019-Present
 */

const ws = require( "ws" ); // https://www.npmjs.com/package/ws
const urllib = require( "urllib" ); // https://www.npmjs.com/package/urllib
const net = require( "net" );

const g_nConnectionTimeoutSeconds = 60;

function rpc_call_init() {
    owaspUtils.owaspAddUsageRef();
}

function validateURL( x ) {
    return owaspUtils.validateURL( x );
}

function is_http_url( strURL ) {
    try {
        if( !validateURL( strURL ) )
            return false;
        const u = new URL( strURL );
        if( u.protocol == "http:" || u.protocol == "https:" )
            return true;
    } catch ( err ) {
    }
    return false;
}

function is_ws_url( strURL ) {
    try {
        if( !validateURL( strURL ) )
            return false;
        const u = new URL( strURL );
        if( u.protocol == "ws:" || u.protocol == "wss:" )
            return true;
    } catch ( err ) {
    }
    return false;
}

async function wait_web_socket_is_open( socket, fnDone, fnStep ) {
    fnDone = fnDone || async function( nStep ) {};
    fnDone = fnStep || async function( nStep ) { return true; };
    const nStep = 0;
    const promiseComplete = new Promise( function( resolve, reject ) {
        let isInsideAsyncHandler = false;
        const fn_async_handler = async function() {
            if( isInsideAsyncHandler )
                return;
            isInsideAsyncHandler = true;
            if( socket.readyState === 1 ) {
                // console.log( "Connection is made" )
                clearInterval( iv );
                await fnDone( nStep );
                resolve();
            } else {
                if( ! await fnStep( nStep ) ) {
                    clearInterval( iv );
                    reject( new Error( "web socket wait timout by callback on step " + nStep ) );
                }
            }
            isInsideAsyncHandler = false;
        };
        const iv = setInterval( function() {
            if( isInsideAsyncHandler )
                return;
            fn_async_handler()
                .then( () => {
                } ).catch( () => {
                } );
        }, 1000 ); // 1 second
    } );
    await Promise.all( [ promiseComplete ] );
}

async function do_connect( joCall, opts, fn ) {
    let wsConn = joCall.wsConn ? joCall.wsConn : null;
    try {
        fn = fn || async function() {};
        if( !validateURL( joCall.url ) )
            throw new Error( "JSON RPC CALLER cannot connect web socket to invalid URL: " + joCall.url );
        if( is_ws_url( joCall.url ) ) {
            let strWsError = null;
            wsConn = new ws( joCall.url );
            joCall.wsConn = wsConn;
            wsConn.on( "open", async function() {
                await fn( joCall, null );
            } );
            wsConn.on( "close", async function() {
                strWsError = "web socket was closed, please check provided URL is valid and accessible";
                joCall.wsConn = null;
            } );
            wsConn.on( "error", async function( err ) {
                strWsError = err.toString() || "internal web socket error";
                log.write( cc.u( joCall.url ) + cc.error( " web socket error: " ) + cc.warning( err.toString() ) + "\n" );
                joCall.wsConn = null;
                wsConn.close();
                do_reconnect_ws_step( joCall, opts );
            } );
            wsConn.on( "fail", async function( err ) {
                strWsError = err.toString() || "internal web socket failure";
                log.write( cc.u( joCall.url ) + cc.error( " web socket fail: " ) + cc.warning( err.toString() ) + "\n" );
                joCall.wsConn = null;
                wsConn.close();
                do_reconnect_ws_step( joCall, opts );
            } );
            wsConn.on( "message", async function incoming( data ) {
                // log.write( cc.info( "WS message " ) + cc.attention( data ) + "\n" );
                const joOut = JSON.parse( data );
                if( joOut.id in joCall.mapPendingByCallID ) {
                    const entry = joCall.mapPendingByCallID[joOut.id];
                    delete joCall.mapPendingByCallID[joOut.id];
                    if( entry.iv ) {
                        clearTimeout( entry.iv );
                        entry.iv = null;
                    }
                    clearTimeout( entry.out );
                    await entry.fn( entry.joIn, joOut, null );
                }
            } );
            await wait_web_socket_is_open( wsConn,
                async function( nStep ) { // done
                },
                async function( nStep ) { // step
                    if( strWsError && typeof strWsError == "string" && strWsError.length > 0 ) {
                        log.write( cc.u( joCall.url ) + cc.error( " web socket wait error detected: " ) + cc.warning( strWsError ) + "\n" );
                        return false;
                    }
                    if( nStep >= g_nConnectionTimeoutSeconds ) {
                        strWsError = "wait timeout, web socket is connecting too long";
                        log.write( cc.u( joCall.url ) + cc.error( " web socket wait timeout detected" ) + "\n" );
                        return false; // stop waiting
                    }
                    return true; // continue waiting
                } );
            if( strWsError && typeof strWsError == "string" && strWsError.length > 0 ) {
                const err = new Error( strWsError );
                await fn( joCall, err );
                return;
            }
        }
        await fn( joCall, null );
    } catch ( err ) {
        joCall.wsConn = null;
        await fn( joCall, err );
    }
    return joCall;
}

async function do_connect_if_needed( joCall, opts, fn ) {
    try {
        fn = fn || async function() {};
        if( !validateURL( joCall.url ) )
            throw new Error( "JSON RPC CALLER cannot connect web socket to invalid URL: " + joCall.url );
        if( is_ws_url( joCall.url ) && ( !joCall.wsConn ) ) {
            await joCall.reconnect( fn );
            return;
        }
        await fn( joCall, null );
    } catch ( err ) {
        await fn( joCall, err );
    }
    return joCall;
}

async function do_reconnect_ws_step( joCall, opts, fn ) {
    if( ! joCall.isAutoReconnect )
        return;
    if( joCall.isDisconnectMode )
        return;
    fn = fn || async function() {};
    do_connect( joCall, opts, async function( joCall, err ) {
        if( err ) {
            do_reconnect_ws_step( joCall, opts );
            return;
        }
        await fn( joCall, null );
    } );
}

async function do_disconnect( joCall, fn ) {
    fn = fn || async function() {};
    try {
        joCall.isDisconnectMode = true;
        const wsConn = joCall.wsConn ? joCall.wsConn : null;
        joCall.wsConn = null;
        if( wsConn )
            wsConn.close();
        joCall.isDisconnectMode = false;
        try {
            await fn( joCall, null );
        } catch ( err ) {
        }
    } catch ( err ) {
        await await fn( joCall, err );
    }
}

const do_sleep = ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

async function do_call( joCall, joIn, fn ) {
    // console.log( "--- --- --- initial joIn is", joIn );
    joIn = enrich_top_level_json_fields( joIn );
    // console.log( "--- --- --- enriched joIn is", joIn );
    fn = fn || async function() {};
    if( joCall.wsConn ) {
        const entry = {
            joIn: joIn,
            fn: fn,
            out: null
        };
        joCall.mapPendingByCallID[joIn.id] = entry;
        entry.iv = setTimeout( function() {
            clearTimeout( entry.iv );
            entry.iv = null;
            delete joCall.mapPendingByCallID[joIn.id];
        }, 20 * 1000 );
        joCall.wsConn.send( JSON.stringify( joIn ) );
    } else {
        // console.log( "--- --- --- call URL is", joCall.url );
        if( !validateURL( joCall.url ) ) {
            // throw new Error( "JSON RPC CALLER cannot do query post to invalid URL: " + joCall.url );
            await fn( joIn, null, "JSON RPC CALLER cannot do query post to invalid URL: " + joCall.url );
            return;
        }
        const strBody = JSON.stringify( joIn );
        // console.log( "--- --- --- agentOptions is", agentOptions );
        // console.log( "--- --- --- joIn is", strBody );
        let bCompleteFlag = false;
        let errCall = null, joOut = null;
        urllib.request( joCall.url, {
            "method": "POST",
            "timeout": g_nConnectionTimeoutSeconds * 1000, // in milliseconds
            "headers": {
                "content-type": "application/json"
                // "Accept": "*/*",
                // "Content-Length": strBody.length,
            },
            "content": strBody,
            "ca": ( joCall.joRpcOptions && joCall.joRpcOptions.ca && typeof joCall.joRpcOptions.ca == "string" ) ? joCall.joRpcOptions.ca : null,
            "cert": ( joCall.joRpcOptions && joCall.joRpcOptions.cert && typeof joCall.joRpcOptions.cert == "string" ) ? joCall.joRpcOptions.cert : null,
            "key": ( joCall.joRpcOptions && joCall.joRpcOptions.key && typeof joCall.joRpcOptions.key == "string" ) ? joCall.joRpcOptions.key : null
        }, function( err, body, response ) {
            // console.log( "--- --- --- err is", err );
            // console.log( "--- --- --- response is", response );
            // console.log( "--- --- --- body is", body );
            if( response && response.statusCode && response.statusCode !== 200 )
                log.write( cc.error( "WARNING:" ) + cc.warning( " REST call status code is " ) + cc.info( response.statusCode ) + "\n" );
            if( err ) {
                log.write( cc.u( joCall.url ) + cc.error( " REST error " ) + cc.warning( err.toString() ) + "\n" );
                bCompleteFlag = true;
                joOut = null;
                errCall = "RPC call error: " + err.toString();
                return;
            }
            try {
                joOut = JSON.parse( body );
                errCall = null;
            } catch ( err ) {
                bCompleteFlag = true;
                joOut = null;
                errCall = "Responce body parse error: " + err.toString();
                return;
            }
            bCompleteFlag = true;
        } );
        for( let idxWait = 0; ! bCompleteFlag; ++ idxWait ) {
            if( idxWait < 50 )
                await do_sleep( 5 );
            else if( idxWait < 100 )
                await do_sleep( 10 );
            else if( idxWait < 1000 )
                await do_sleep( 100 );
            else {
                const nLastWaitPeriod = 200;
                if( ( idxWait - 1000 ) * nLastWaitPeriod > g_nConnectionTimeoutSeconds )
                    bCompleteFlag = true;
                else
                    await do_sleep( nLastWaitPeriod );
            }
        } // for( let idxWait = 0; ! bCompleteFlag; ++ idxWait )
        try {
            await fn( joIn, joOut, errCall );
        } catch ( err ) {
        }
    }
}

async function rpc_call_create( strURL, opts, fn ) {
    if( !validateURL( strURL ) )
        throw new Error( "JSON RPC CALLER cannot create a call object invalid URL: " + strURL );
    fn = fn || async function() {};
    if( !( strURL && typeof strURL == "string" && strURL.length > 0 ) )
        throw new Error( "rpc_call_create() was invoked with bad parameters: " + JSON.stringify( arguments ) );
    const joCall = {
        "url": "" + strURL,
        "joRpcOptions": opts ? opts : null,
        "mapPendingByCallID": { },
        "wsConn": null,
        "isAutoReconnect": ( opts && "isAutoReconnect" in opts && opts.isAutoReconnect ) ? true : false,
        "isDisconnectMode": false,
        "reconnect": async function( fnAfter ) {
            await do_connect( joCall, fnAfter );
        },
        "reconnect_if_needed": async function( fnAfter ) {
            await do_connect_if_needed( joCall, opts, fnAfter );
        },
        "call": async function( joIn, fnAfter ) {
            const self = this;
            await self.reconnect_if_needed( async function( joCall, err ) {
                if( err ) {
                    await fnAfter( joIn, null, err );
                    return;
                }
                await do_call( joCall, joIn, fnAfter );
            } );
        },
        "disconnect": async function( fnAfter ) {
            await do_disconnect( joCall, fnAfter );
        }
    };
    await do_connect( joCall, opts, fn );
    return joCall;
}

function generate_random_integer_in_range( min, max ) {
    min = Math.ceil( min );
    max = Math.floor( max );
    return Math.floor( Math.random() * ( max - min + 1 ) ) + min;
}

function generate_random_rpc_call_id() {
    return generate_random_integer_in_range( 1, Number.MAX_SAFE_INTEGER );
}

function enrich_top_level_json_fields( jo ) {
    if( ( !( "jsonrpc" in jo ) ) || ( typeof jo.jsonrpc !== "string" ) || jo.jsonrpc.length === 0 )
        jo.jsonrpc = "2.0";
    if( ( !( "id" in jo ) ) || ( typeof jo.id !== "number" ) || jo.id <= 0 )
        jo.id = generate_random_rpc_call_id();
    return jo;
}

function is_valid_url( s ) {
    if( ! s )
        return false;
    try {
        const u = new URL( s.toString() );
        if( u )
            return true;
    } catch ( err ) {
    }
    return false;
}

function get_valid_url( s ) {
    if( ! s )
        return null;
    try {
        return new URL( s.toString() );
    } catch ( err ) {
    }
    return null;
}

function get_default_port( strProtocol ) {
    if( ! strProtocol )
        return 80;
    switch ( strProtocol.toString().toLowerCase() ) {
    case "http:":
    case "ws:":
        return 80;
    case "https:":
    case "wss:":
        return 443;
    }
    return 80;
}

function get_valid_host_and_port( s ) {
    const u = get_valid_url( s );
    if( ! u )
        return null;
    const jo = {
        strHost: u.hostname,
        nPort: u.port ? parseInt( u.port, 10 ) : get_default_port( u.protocol )
    };
    return jo;
}

const g_strTcpConnectionHeader = "TCP connection checker: ";

function check_tcp_promise( strHost, nPort, nTimeoutMilliseconds, isLog ) {
    return new Promise( ( resolve, reject ) => {
        if( isLog )
            console.log( `${g_strTcpConnectionHeader}Will establish TCP connection to ${strHost}:${nPort}...` );
        const conn = net.createConnection( { host: strHost, port: nPort }, () => {
            if( isLog )
                console.log( `${g_strTcpConnectionHeader}Done, TCP connection to ${strHost}:${nPort} established` );
            conn.end();
            resolve();
        } );
        if( isLog )
            console.log( `${g_strTcpConnectionHeader}Did created NET object for TCP connection to ${strHost}:${nPort}...` );
        if( nTimeoutMilliseconds )
            nTimeoutMilliseconds = parseInt( nTimeoutMilliseconds.toString(), 10 );
        if( nTimeoutMilliseconds > 0 ) {
            if( isLog )
                console.log( `${g_strTcpConnectionHeader}Will use TCP connection to ${strHost}:${nPort} timeout ${nTimeoutMilliseconds} milliseconds...` );
            conn.setTimeout( nTimeoutMilliseconds );
        } else {
            if( isLog )
                console.log( `${g_strTcpConnectionHeader}Will use default TCP connection to ${strHost}:${nPort} timeout...` );
        }
        conn.on( "timeout", err => {
            if( isLog )
                console.log( `${g_strTcpConnectionHeader}TCP connection to ${strHost}:${nPort} timed out` );
            conn.destroy();
            reject( err );
        } );
        conn.on( "error", err => {
            if( isLog )
                console.log( `${g_strTcpConnectionHeader}TCP connection to ${strHost}:${nPort} failed` );
            reject( err );
        } );
        if( isLog )
            console.log( `${g_strTcpConnectionHeader}TCP connection to ${strHost}:${nPort} check started...` );
    } );
}

async function check_tcp( strHost, nPort, nTimeoutMilliseconds, isLog ) {
    let isOnline = false;
    try {
        const promise_tcp = check_tcp_promise( strHost, nPort, nTimeoutMilliseconds, isLog )
            .then( () => ( isOnline = true ) )
            .catch( () => ( isOnline = false ) )
            //.finally( () => console.log( { isOnline } ) )
            ;
        if( isLog )
            console.log( `${g_strTcpConnectionHeader}Waiting for TCP connection to ${strHost}:${nPort} check done...` );
        await Promise.all( [ promise_tcp ] );
        if( isLog )
            console.log( `${g_strTcpConnectionHeader}TCP connection to ${strHost}:${nPort} check finished` );
    } catch ( err ) {
        isOnline = false;
        console.log( `${g_strTcpConnectionHeader}TCP connection to ${strHost}:${nPort} check failed with error: ` + err.toString() );
    }
    return isOnline;
}

async function check_url( u, nTimeoutMilliseconds, isLog ) {
    if( ! u )
        return false;
    const jo = get_valid_host_and_port( u );
    if( isLog )
        console.log( g_strTcpConnectionHeader + "Extracted from URL \"" + u.toString() + "\" data fields are: " + JSON.stringify( jo ) );
    if( ! ( jo && jo.strHost && "nPort" in jo ) ) {
        console.log( g_strTcpConnectionHeader + "Extracted from URL \"" + u.toString() + "\" data fields are bad, returning \"false\" as result of TCP connection check" );
        return false;
    }
    return await check_tcp( jo.strHost, jo.nPort, nTimeoutMilliseconds, isLog );
}

module.exports = {
    rpcCallAddUsageRef: function() { },
    is_http_url: is_http_url,
    is_ws_url: is_ws_url,
    init: rpc_call_init,
    create: rpc_call_create,
    generate_random_integer_in_range: generate_random_integer_in_range,
    generate_random_rpc_call_id: generate_random_rpc_call_id,
    enrich_top_level_json_fields: enrich_top_level_json_fields,
    is_valid_url: is_valid_url,
    get_valid_url: get_valid_url,
    get_valid_host_and_port: get_valid_host_and_port,
    check_tcp_promise: check_tcp_promise,
    check_tcp: check_tcp,
    check_url: check_url,
    sleep: do_sleep
}; // module.exports
