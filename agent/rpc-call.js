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
const request = require( "request" ); // https://www.npmjs.com/package/request
const net = require( "net" );

function is_http_url( strURL ) {
    try {
        if( !owaspUtils.validateURL( strURL ) )
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
        if( !owaspUtils.validateURL( strURL ) )
            return false;
        const u = new URL( strURL );
        if( u.protocol == "ws:" || u.protocol == "wss:" )
            return true;
    } catch ( err ) {
    }
    return false;
}

function rpc_call_init() {
    owaspUtils.owaspAddUsageRef();
}

async function do_connect( joCall, opts, fn ) {
    try {
        fn = fn || function() {};
        if( !owaspUtils.validateURL( joCall.url ) )
            throw new Error( "JSON RPC CALLER cannot connect web socket to invalid URL: " + joCall.url );
        if( is_ws_url( joCall.url ) ) {
            joCall.wsConn = new ws( joCall.url );
            joCall.wsConn.on( "open", function() {
                fn( joCall, null );
            } );
            joCall.wsConn.on( "close", function() {
                joCall.wsConn = 0;
            } );
            joCall.wsConn.on( "error", function( err ) {
                log.write( cc.u( joCall.url ) + cc.error( " WS error " ) + cc.warning( err ) + "\n" );
            } );
            joCall.wsConn.on( "fail", function( err ) {
                log.write( cc.u( joCall.url ) + cc.error( " WS fail " ) + cc.warning( err ) + "\n" );
            } );
            joCall.wsConn.on( "message", function incoming( data ) {
                // log.write( cc.info( "WS message " ) + cc.attention( data ) + "\n" );
                const joOut = JSON.parse( data );
                if( joOut.id in joCall.mapPendingByCallID ) {
                    const entry = joCall.mapPendingByCallID[joOut.id];
                    delete joCall.mapPendingByCallID[joOut.id];
                    clearTimeout( entry.out );
                    entry.fn( entry.joIn, joOut, null );
                }
            } );
            return;
        }
        fn( joCall, null );
    } catch ( err ) {
        joCall.wsConn = null;
        fn( joCall, err );
    }
}

async function do_connect_if_needed( joCall, opts, fn ) {
    try {
        fn = fn || function() {};
        if( !owaspUtils.validateURL( joCall.url ) )
            throw new Error( "JSON RPC CALLER cannot connect web socket to invalid URL: " + joCall.url );
        if( is_ws_url( joCall.url ) && ( !joCall.wsConn ) ) {
            joCall.reconnect( fn );
            return;
        }
        fn( joCall, null );
    } catch ( err ) {
        fn( joCall, err );
    }
}

async function do_call( joCall, joIn, fn ) {
    // console.log( "--- --- --- initial joIn is", joIn );
    joIn = enrich_top_level_json_fields( joIn );
    // console.log( "--- --- --- enriched joIn is", joIn );
    fn = fn || function() {};
    if( joCall.wsConn ) {
        const entry = {
            joIn: joIn,
            fn: fn,
            out: null
        };
        joCall.mapPendingByCallID[joIn.id] = entry;
        entry.out = setTimeout( function() {
            delete joCall.mapPendingByCallID[joIn.id];
        }, 20 * 1000 );
        joCall.wsConn.send( JSON.stringify( joIn ) );
    } else {
        // console.log( "--- --- --- call URL is", joCall.url );
        if( !owaspUtils.validateURL( joCall.url ) )
            throw new Error( "JSON RPC CALLER cannot do query post to invalid URL: " + joCall.url );
        const agentOptions = {
            "ca": ( joCall.joRpcOptions && joCall.joRpcOptions.ca && typeof joCall.joRpcOptions.ca == "string" ) ? joCall.joRpcOptions.ca : null,
            "cert": ( joCall.joRpcOptions && joCall.joRpcOptions.cert && typeof joCall.joRpcOptions.cert == "string" ) ? joCall.joRpcOptions.cert : null,
            "key": ( joCall.joRpcOptions && joCall.joRpcOptions.key && typeof joCall.joRpcOptions.key == "string" ) ? joCall.joRpcOptions.key : null
        };
        const strBody = JSON.stringify( joIn );
        // console.log( "--- --- --- agentOptions is", agentOptions );
        // console.log( "--- --- --- joIn is", strBody );
        request.post( {
            "uri": joCall.url,
            "content-type": "application/json",
            // "Accept": "*/*",
            // "Content-Length": strBody.length,
            "headers": {
                "content-type": "application/json"
                // "Accept": "*/*",
                // "Content-Length": strBody.length,
            },
            "body": strBody,
            "agentOptions": agentOptions
        },
        function( err, response, body ) {
            // console.log( "--- --- --- err is", err );
            // console.log( "--- --- --- response is", response );
            // console.log( "--- --- --- body is", body );
            if( response && response.statusCode && response.statusCode !== 200 )
                log.write( cc.error( "WARNING:" ) + cc.warning( " REST call status code is " ) + cc.info( response.statusCode ) + "\n" );
            if( err ) {
                log.write( cc.u( joCall.url ) + cc.error( " REST error " ) + cc.warning( err ) + "\n" );
                fn( joIn, null, err );
                return;
            }
            const joOut = JSON.parse( body );
            fn( joIn, joOut, null );
        } );
    }
}

async function rpc_call_create( strURL, opts, fn ) {
    if( !owaspUtils.validateURL( strURL ) )
        throw new Error( "JSON RPC CALLER cannot create a call object invalid URL: " + strURL );
    fn = fn || function() {};
    if( !( strURL && strURL.length > 0 ) )
        throw new Error( "rpc_call_create() was invoked with bad parameters: " + JSON.stringify( arguments ) );
    const joCall = {
        "url": "" + strURL,
        "joRpcOptions": opts ? opts : null,
        "mapPendingByCallID": { },
        "wsConn": null,
        "reconnect": function( fnAfter ) {
            do_connect( joCall, fnAfter );
        },
        "reconnect_if_needed": function( fnAfter ) {
            do_connect_if_needed( joCall, opts, fnAfter );
        },
        "call": async function( joIn, fnAfter ) {
            const self = this;
            self.reconnect_if_needed( function( joCall, err ) {
                if( err ) {
                    fnAfter( joIn, null, err );
                    return;
                }
                do_call( joCall, joIn, fnAfter );
            } );
        }
    };
    do_connect( joCall, opts, fn );
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

function get_valid_host_and_port( s ) {
    const u = get_valid_url( s );
    if( ! u )
        return null;
    const jo = {
        strHost: u.hostname,
        nPort: parseInt( u.port, 10 )
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
            console.error( `${g_strTcpConnectionHeader}Will use TCP connection to ${strHost}:${nPort} timeout ${nTimeoutMilliseconds} milliseconds...` );
            conn.setTimeout( nTimeoutMilliseconds );
        } else
            console.error( `${g_strTcpConnectionHeader}Will use default TCP connection to ${strHost}:${nPort} timeout...` );
        conn.on( "timeout", err => {
            if( isLog )
                console.error( `${g_strTcpConnectionHeader}TCP connection to ${strHost}:${nPort} timed out` );
            conn.destroy();
            reject( err );
        } );
        conn.on( "error", err => {
            if( isLog )
                console.error( `${g_strTcpConnectionHeader}TCP connection to ${strHost}:${nPort} failed` );
            reject( err );
        } );
        if( isLog )
            console.log( `${g_strTcpConnectionHeader}TCP connection to ${strHost}:${nPort} check started...` );
    } );
}

async function check_tcp( strHost, nPort, nTimeoutMilliseconds, isLog ) {
    let isOnline = false;
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
    return isOnline;
}

async function check_url( u, nTimeoutMilliseconds, isLog ) {
    const jo = get_valid_host_and_port( u );
    if( isLog )
        console.log( "${g_strTcpConnectionHeader}Extracted from URL \"" + u.toString() + "\" data fields are: " + JSON.stringify( jo ) );
    if( ! ( jo && jo.strHost && "nPort" in jo ) ) {
        console.log( "${g_strTcpConnectionHeader}Extracted from URL \"" + u.toString() + "\" data fields are bad, returning \"false\" as result of TCP connection check" );
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
    check_url: check_url
}; // module.exports
