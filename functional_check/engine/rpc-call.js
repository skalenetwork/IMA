let ws = require( "ws" ); // https://www.npmjs.com/package/ws
let request = require( "request" ); // https://www.npmjs.com/package/request

let cc = null;
let log = null;

function is_ws_url( strURL ) {
    try {
        var u = new URL( strURL );
        if ( u.protocol == "ws:" || u.protocol == "wss:" )
            return true;
    } catch ( err ) {}
    return false;
}

function rpc_call_init( a_cc, a_log ) {
    if ( !( a_cc && a_log ) )
        throw "rpc_call_init() bad parameters";
    cc = a_cc;
    log = a_log;
}

async function do_connect( joCall, fn ) {
    try {
        fn = fn || function() {};
        if ( is_ws_url( joCall.url ) ) {
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
                //log.write( cc.info( "WS message " ) + cc.attention( data ) + "\n" );
                let joOut = JSON.parse( data );
                if ( joOut.id in joCall.mapPendingByCallID ) {
                    let entry = joCall.mapPendingByCallID[ joOut.id ];
                    delete joCall.mapPendingByCallID[ joOut.id ];
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
    if ( is_ws_url( joCall.url ) && ( !joCall.wsConn ) ) {
        joCall.reconnect( fn );
        return;
    }
    fn( joCall, null );
}

async function do_call( joCall, joIn, fn ) {
    joIn = enrich_top_level_json_fields( joIn );
    fn = fn || function() {};
    if ( joCall.wsConn ) {
        let entry = {
            "joIn": joIn,
            "fn": fn,
            "out": null
        };
        joCall.mapPendingByCallID[ joIn.id ] = entry;
        entry.out = setTimeout( function() {
            delete joCall.mapPendingByCallID[ joIn.id ];
        }, 20 * 1000 );
        joCall.wsConn.send( JSON.stringify( joIn ) );
    } else {
        let agentOptions = {
            "ca":     ( joCall.joRpcOptions && joCall.joRpcOptions.ca   && typeof joCall.joRpcOptions.ca   == "string" ) ? joCall.joRpcOptions.ca   : null
            , "cert": ( joCall.joRpcOptions && joCall.joRpcOptions.cert && typeof joCall.joRpcOptions.cert == "string" ) ? joCall.joRpcOptions.cert : null
            , "key":  ( joCall.joRpcOptions && joCall.joRpcOptions.key  && typeof joCall.joRpcOptions.key  == "string" ) ? joCall.joRpcOptions.key  : null
        };
        //console.log( agentOptions );
        request.post( {
                "uri": joCall.url
                , "content-type": "application/json"
                , "body": JSON.stringify( joIn )
                , "agentOptions": agentOptions
            },
            function( err, response, body ) {
                if ( response && response.statusCode && response.statusCode != 200 )
                    log.write( cc.error( "WARNING:" ) + cc.warning( " REST call status code is " ) + cc.info( response.statusCode ) + "\n" );
                if ( err ) {
                    log.write( cc.u( joCall.url ) + cc.error( " REST error " ) + cc.warning( err ) + "\n" );
                    fn( joIn, null, err );
                    return;
                }
                let joOut = JSON.parse( body );
                fn( joIn, joOut, null );
                return;
            } );
    }
}

async function rpc_call_create( strURL, joRpcOptions, fn ) {
    fn = fn || function() {};
    if ( !( strURL && strURL.length > 0 ) )
        throw "rpc_call_create() bad parameters";
    let joCall = {
        "url": "" + strURL
        , "joRpcOptions": joRpcOptions ? joRpcOptions : null
        , "mapPendingByCallID": { }
        , "wsConn": null
        , "reconnect": function( fnAfter ) {
            do_connect( joCall, fnAfter );
        }, "reconnect_if_needed": function( fnAfter ) {
            do_connect_if_needed( joCall, fnAfter );
        }, "call": async function( joIn, fnAfter ) {
            let self = this;
            self.reconnect_if_needed( function( joCall, err ) {
                if ( err ) {
                    fnAfter( joIn, null, err );
                    return;
                }
                do_call( joCall, joIn, fnAfter );
            } );
        }
    };
    do_connect( joCall, fn )
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
    if ( ( !( "jsonrpc" in jo ) ) || ( typeof jo.jsonrpc != "string" ) || jo.jsonrpc.length == 0 )
        jo.jsonrpc = "2.0";
    if ( ( !( "id" in jo ) ) || ( typeof jo.id != "number" ) || jo.id <= 0 )
        jo.id = generate_random_rpc_call_id();
    return jo;
}

module.exports = {
    "init": rpc_call_init,
    "create": rpc_call_create,
    "generate_random_integer_in_range": generate_random_integer_in_range,
    "generate_random_rpc_call_id": generate_random_rpc_call_id,
    "enrich_top_level_json_fields": enrich_top_level_json_fields
}; // module.exports
