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

async function do_connect( joCall, fn ) {
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

async function do_connect_if_needed( joCall, fn ) {
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
    joIn = enrich_top_level_json_fields( joIn );
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
        if( !owaspUtils.validateURL( joCall.url ) )
            throw new Error( "JSON RPC CALLER cannot do query post to invalid URL: " + joCall.url );
        request.post( {
            uri: joCall.url,
            "content-type": "application/json",
            body: JSON.stringify( joIn )
        },
        function( err, response, body ) {
            if( response && response.statusCode && response.statusCode != 200 )
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

async function rpc_call_create( strURL, fn ) {
    if( !owaspUtils.validateURL( strURL ) )
        throw new Error( "JSON RPC CALLER cannot create a call object invalid URL: " + strURL );
    fn = fn || function() {};
    if( !( strURL && strURL.length > 0 ) )
        throw new Error( "rpc_call_create() was invoked with bad parameters: " + JSON.stringify( arguments ) );
    const joCall = {
        url: "" + strURL,
        mapPendingByCallID: {},
        wsConn: null,
        reconnect: function( fnAfter ) {
            do_connect( joCall, fnAfter );
        },
        reconnect_if_needed: function( fnAfter ) {
            do_connect_if_needed( joCall, fnAfter );
        },
        call: async function( joIn, fnAfter ) {
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
    do_connect( joCall, fn );
}

function generate_random_integer_in_range( min, max ) {
    min = Math.ceil( min );
    max = Math.floor( max );
    return parseInt( Math.floor( Math.random() * ( max - min + 1 ) ) + min );
}

function generate_random_rpc_call_id() {
    return generate_random_integer_in_range( 1, Number.MAX_SAFE_INTEGER );
}

function enrich_top_level_json_fields( jo ) {
    if( ( !( "jsonrpc" in jo ) ) || ( typeof jo.jsonrpc !== "string" ) || jo.jsonrpc.length == 0 )
        jo.jsonrpc = "2.0";
    if( ( !( "id" in jo ) ) || ( typeof jo.id !== "number" ) || jo.id <= 0 )
        jo.id = generate_random_rpc_call_id();
    return jo;
}

module.exports = {
    rpcCallAddUsageRef: function() { },
    init: rpc_call_init,
    create: rpc_call_create,
    generate_random_integer_in_range: generate_random_integer_in_range,
    generate_random_rpc_call_id: generate_random_rpc_call_id,
    enrich_top_level_json_fields: enrich_top_level_json_fields
}; // module.exports
