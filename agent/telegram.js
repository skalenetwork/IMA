( function () {
    "use strict";
    let this_module = this;

    this_module.telegram = require( "telegram-bot-api" );

    // https://www.npmjs.com/package/telegram-bot-api
    // https://t.me/botfather
    // https://core.telegram.org/bots
    // For a description of the Bot API, see this page: https://core.telegram.org/bots/api

    class TelegramHelper extends EventDispatcher {
        constructor( idBotToken, idChat ) {
            super();
            this.init( idBotToken, idChat );
        }
        dispose() {
            this.me = null;
            this.idBotToken = null;
            this.idChat = null;
            this.t = null;
        }
        init( idBotToken, idChat ) {
            let self = this;
            self.dispose();
            self.idBotToken = ( idBotToken && typeof idBotToken == "string" && idBotToken.length > 0 ) ? ( "" + idBotToken ) : null;
            self.idChat = ( idChat && typeof idChat == "string" && idChat.length > 0 ) ? ( "" + idChat ) : null;
            if( self.idBotToken && self.idChat ) {
                self.t = new this_module.telegram( { token: idBotToken, updates: { enabled: true } } );
                self.t.on( "message", function ( message ) {
                    //log.write( cc.rx(" >>> ") + cc.rxa("Received text message") + cc.rx(" >>> ") + cc.j( message ) + "\n" );
                    switch ( message.text.toLowerCase() ) {
                        case "hello": sendMessage( {
                            chat_id: message.chat.id,
                            text: "Hello there!"
                        } ); break;
                    }
                    self.dispatchEvent( new CustomEvent( "message", { "detail": { "message": message } } ) );
                } );
                self.t.on( "inline.query", function ( message ) {
                    //log.write( cc.rx(" >>> ") + cc.rxa("Received inline query") + cc.rx(" >>> ") + cc.j( message ) + "\n" );
                    self.dispatchEvent( new CustomEvent( "inline.query", { "detail": { "message": message } } ) );
                } );
                self.t.on( "inline.result", function ( message ) {
                    //log.write( cc.rx(" >>> ") + cc.rxa("Received chosen inline result") + cc.rx(" >>> ") + cc.j( message ) + "\n" );
                    self.dispatchEvent( new CustomEvent( "inline.result", { "detail": { "message": message } } ) );
                } );
                self.t.on( "inline.callback.query", function ( message ) {
                    //log.write( cc.rx(" >>> ") + cc.rxa("New incoming callback query") + cc.rx(" >>> ") + cc.j( message ) + "\n" );
                    self.dispatchEvent( new CustomEvent( "inline.callback.query", { "detail": { "message": message } } ) );
                } );
                self.t.on( "edited.message", function ( message ) {
                    log.write( cc.rx(" >>> ") + cc.rxa("Message that was edited") + cc.rx(" >>> ") + cc.j( message ) + "\n" );
                    self.dispatchEvent( new CustomEvent( "edited.message", { "detail": { "message": message } } ) );
                } );
                self.t.on( "update", function ( message ) {
                    // Generic update object
                    // Subscribe on it in case if you want to handle all possible
                    // event types in one callback
                    //log.write( cc.rx(" >>> ") + cc.rxa("Generic Update") + cc.rx(" >>> ") + cc.j( message ) + "\n" );
                    self.dispatchEvent( new CustomEvent( "update", { "detail": { "message": message } } ) );
                } );
                //
                //log.write( cc.normal( "Querying bot information..." ) + "\n" );
                self.t.getMe()
                    .then( function ( data ) {
                        //log.write( cc.normal( "Got bot information: " ) + cc.j(data) + "\n" );
                        self.me = data;
                        self.dispatchEvent( new CustomEvent( "me", { "detail": { "me": data } } ) );
                    } )
                    .catch( function ( err ) {
                        //log.write( cc.fatal("FATAL:") + cc.error( " Failed to get bot information: " ) + cc.j(err) + "\n" );
                        process.exit( 1 );
                    } );                
            }
        }
        sendMessage( jo, fn ) {
            let self = this;
            fn = fn || function( data, err ) { };
            if( ! self.t ) {
                let err = "Telegram connection was not initialized";
                //log.write( cc.fatal("ERROR:") + cc.error( " Failed to send message: " ) + cc.j(err) + "\n" );
                fn( null, err );
                return;
            }
            if( typeof jo == "string" )
                jo = {
                    chat_id: self.idChat,
                    text: "" + jo
                };
            else if( jo == null || jo == undefined )
                return;
            //log.write( cc.tx(" <<< ") + cc.txa("Will send message") + cc.tx(" <<< ") + cc.j( jo ) + "\n" );
            self.t.sendMessage( jo ).then( function ( data ) {
                //console.log( util.inspect( data, false, null ) );
                //log.write( cc.rx(" >>> ") + cc.rxa("Message sending result") + cc.rx(" >>> ") + cc.j( data ) + "\n" );
                fn( data, null );
            } ).catch( function ( err ) {
                //log.write( cc.fatal("ERROR:") + cc.error( " Failed to send message: " ) + cc.j(err) + "\n" );
                fn( null, err );
            } );
        }
    };
    this_module.TelegramHelper = TelegramHelper;

} ).call( this );

