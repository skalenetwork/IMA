let ws = require( "ws" );
let request = require( "request" );

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

function rest_call_init( a_cc, a_log ) {
    if(! ( a_cc && a_log ) )
        throw "rest_call_create() bad parameters";
    cc = a_cc;
    log = a_log;
}

async function do_connect( joCall, fn ) {
    fn = fn || function() {};
    if( is_ws_url( joCall.url ) ) {
        joCall.wsConn = new ws( joCall.url );
        joCall.wsConn.on( "open", function() {
            fn( joCall, null );
        } );
        joCall.wsConn.on( "close", function () {
            joCall.wsConn = 0;
        } );
        joCall.wsConn.on( "message", function incoming( data ) {
            //log.write( cc.info( "WS message " ) + cc.attention( data ) + "\n" );
            let joOut = JSON.parse( data );
            if( joOut.id in joCall.mapPendingByCallID ) {
                let entry = joCall.mapPendingByCallID[ joOut.id ];
                delete joCall.mapPendingByCallID[ joOut.id ];
                clearTimeout( entry.out );
                entry.fn( entry.joIn, joOut, null );
            }
        } );
        return;
    }
    fn( joCall, null );
}

async function do_call( joCall, joIn, fn ) {
    fn = fn || function() {};
    if( joCall.wsConn ) {
        let entry = {
            "joIn": joIn,
            "fn": fn,
            "out": null
        };
        joCall.mapPendingByCallID[ joIn.id ] = entry;
        entry.out = setTimeout( function() {
            delete joCall.mapPendingByCallID[ joIn.id ];
        }, 20*1000 );
        joCall.wsConn.send( JSON.stringify( joIn ) );
    } else {
        request.post( {
            "uri": joCall.url,
            "content-type": "application/json",
            "body": JSON.stringify( joIn )
        },
        function ( error, response, body ) {
            if( error ) {
                fn( joIn, null, error );
                return;
            }
            let joOut = JSON.parse( body );
            fn( joIn, joOut, null );
            return;
            // console.log('error:', error); // Print the error if one occurred
            // console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
            // console.log('body:', body); // Print the HTML for the Google homepage.
        } );
    }
}

async function rest_call_create( strURL, fn ) {
    fn = fn || function() {};
    if(! ( strURL && strURL.length > 0 ) )
        throw "rest_call_create() bad parameters";
    let joCall = {
        "url": "" + strURL,
        "mapPendingByCallID": {},
        "wsConn": null,
        "reconnect": function( fnAfter ) { do_connect( joCall, fnAfter ); },
        "call": function( joIn, fnAfter ) { do_call( joCall, joIn, fnAfter ); }
    };
    do_connect( joCall, fn )
}

module.exports = {
    "init": rest_call_init,
    "create": rest_call_create
}; // module.exports
