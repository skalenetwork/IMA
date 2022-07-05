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
 * @file test_signaling_server.js
 * @copyright SKALE Labs 2019-Present
 */

const fs = require( "fs" );

const https_loaded_mod = require( "https" );
const ws_loaded_mod = require( "ws" );
const wrtc_loaded_mod = require( "wrtc" );

const network_layer = require( "./socket.js" );
const { settings } = require( "./settings.js" );
const { UniversalDispatcherEvent, EventDispatcher } = require( "./event_dispatcher.js" );
const utils = require( "./utils.js" );

// const connect = connect_loaded_mod; // .default;
// const serveStatic = serveStatic_loaded_mod; // .default;
const https_mod = https_loaded_mod; // .default;
const ws_mod = ws_loaded_mod; // .default;
const wrtc_mod = wrtc_loaded_mod; // .default;

network_layer.set_https_mod( https_mod );
network_layer.set_ws_mod( ws_mod );
network_layer.set_wrtc_mod( wrtc_mod );

console.log( "Test signaling server application..." );
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class SignalingClient extends EventDispatcher {
    constructor( idRtcParticipant, strRole, signalingSpace, socket ) {
        super();
        this.isDisposed = false;
        this.idRtcParticipant = "" + ( ( idRtcParticipant && typeof idRtcParticipant == "string" && idRtcParticipant.length > 0 ) ? idRtcParticipant : "" );
        this.isCreator = ( strRole == "creator" ) ? true : false;
        this.isJoiner = ( strRole == "joiner" ) ? true : false;
        this.signalingSpace = signalingSpace;
        this.socket = socket;
        socket.signalingClient = this;
        if( this.isCreator )
            this.signalingSpace.idSomebodyCreator = "" + this.idRtcParticipant;
        this.signalingSpace.map_clients[this.idRtcParticipant] = this;
        this.idSpace = "" + this.signalingSpace.idSpace;
        this.idCategory = "" + this.signalingSpace.signalingCategory.idCategory;
        this.isFetchingOffer = false;
        this.timerFetchingOffer = null;
        this.fetchingOfferStepNumber = 0;
        if( settings.logging.net.signaling.objectLifetime )
            console.log( "New signaling client \"" + this.idRtcParticipant + "\" in signaling space \"" + this.idSpace + "\" in signaling category \"" + this.idCategory + "\" using socket " + this.socket.strSavedRemoteAddress );
        this.signalingSpace.dispatchEvent( new UniversalDispatcherEvent( "clientAdded", { detail: { signalingClient: this } } ) );
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        if( settings.logging.net.signaling.objectLifetime )
            console.log( "Disposing signaling client \"" + this.idRtcParticipant + "\" in signaling space \"" + this.idSpace + "\" in signaling category \"" + this.idCategory + "\"" );
        this.disconnect();
        if( this.idRtcParticipant ) {
            if( this.signalingSpace ) {
                this.signalingSpace.dispatchEvent( new UniversalDispatcherEvent( "clientRemoved", { detail: { signalingClient: this } } ) );
                delete this.signalingSpace.map_clients[this.idRtcParticipant];
            }
            this.idRtcParticipant = null;
        }
        if( this.isCreator ) {
            if( this.signalingSpace )
                this.signalingSpace.idSomebodyCreator = "";
        }
        this.isCreator = false;
        this.isJoiner = false;
        this.idSpace = null;
        this.idCategory = null;
        this.signalingSpace.autoDispose();
        this.signalingSpace = null;
        super.dispose();
    }
    disconnect() {
        if( this.isDisposed || ( !this.socket ) )
            return;
        this.offerDiscoveryStop();
        let bPass = false, anyError = null;
        try {
            this.socket.disconnect();
            bPass = true;
        } catch ( err ) {
            anyError = err;
        }
        if( ! bPass ) {
            if( settings.logging.net.signaling.error )
                console.warn( "Signaling client \"" + this.idRtcParticipant + "\" in signaling space \"" + this.idSpace + "\" in signaling category \"" + this.idCategory + "\" - web socket signaling pipe termination error", anyError );
        }
        //
        this.socket.signalingClient = null;
        this.socket = null;
        if( settings.logging.net.signaling.disconnect )
            console.warn( "Disconnected/force signaling client \"" + this.idRtcParticipant + "\" in signaling space \"" + this.idSpace + "\" in signaling category \"" + this.idCategory + "\"" );
    }
    onPipeClose( socket ) {
        if( this.isDisposed )
            return;
        if( settings.logging.net.signaling.disconnect )
            console.warn( "Disconnected/pipe signaling client \"" + this.idRtcParticipant + "\" in signaling space \"" + this.idSpace + "\" in signaling category \"" + this.idCategory + "\"" );
        this.offerDiscoveryStop();
        this.dispose();
    }
    onPipeError( socket ) {
        if( this.isDisposed )
            return;
        if( settings.logging.net.signaling.error )
            console.warn( "Disconnected/error signaling client \"" + this.idRtcParticipant + "\" in signaling space \"" + this.idSpace + "\" in signaling category \"" + this.idCategory + "\"" );
        this.offerDiscoveryStop();
        this.dispose();
    }
    offerDiscoveryStop() {
        if( ! this.isFetchingOffer )
            return;
        if( this.timerFetchingOffer ) {
            clearInterval( this.timerFetchingOffer );
            this.timerFetchingOffer = null;
        }
        this.isFetchingOffer = false;
        this.fetchingOfferStepNumber = 0;
    }
    offerDiscoveryStart( joMessage ) {
        if( this.isFetchingOffer )
            return;
        this.isFetchingOffer = true;
        this.offerDiscoveryStep( joMessage );
    }
    offerDiscoveryStep( joMessage ) {
        if( ! this.isFetchingOffer )
            return;
        let joAnswer = null;
        ++ this.fetchingOfferStepNumber;
        try {
            // let signalingCategory = null;
            const signalingSpace = this.signalingSpace;
            // if( signalingSpace )
            //     signalingCategory = signalingSpace.signalingCategory;
            const joOfferInfo = signalingSpace.fetchPublishedOffer();
            if( ! joOfferInfo ) {
                if( settings.logging.net.signaling.offerDiscoveryStepFail )
                    console.warn( "Signaling client socket \"" + this.socket.strSavedRemoteAddress + "\" did not found offer at step", this.fetchingOfferStepNumber, "of", settings.net.rtc.offerDiscovery.stepCount );
                if( this.fetchingOfferStepNumber >= settings.net.rtc.offerDiscovery.stepCount ) {
                    this.offerDiscoveryStop();
                    throw new Error( "no offer found" );
                }
                if( ! this.timerFetchingOffer ) {
                    const self = this;
                    this.timerFetchingOffer = setInterval( function() {
                        self.offerDiscoveryStep( joMessage );
                    }, settings.net.rtc.offerDiscovery.periodMilliseconds );
                }
                return;
            }
            if( settings.logging.net.signaling.impersonate ) {
                console.log( "Signaling client socket \"" + this.socket.strSavedRemoteAddress + "\" impersonated as \"" + this.idRtcParticipant +
                    "\" in signaling space \"" + signalingSpace.idSpace + "\" did fetched published offer:", joOfferInfo );
            }
            joAnswer = utils.prepareAnswerJSON( joMessage ); // successful answer
            joAnswer.offer = joOfferInfo.offer;
            joAnswer.idOffer = 0 + joOfferInfo.idOffer;
            joAnswer.idSomebodyCreator = joOfferInfo.idSomebodyCreator; // server holder
        } catch ( err ) {
            if( settings.logging.net.signaling.error )
                console.warn( "Server method", joMessage.method, "RPC exception:", err );
            joAnswer = utils.prepareAnswerJSON( joMessage );
            joAnswer.error = "" + err.toString();
        }
        if( typeof joAnswer.error == "string" && joAnswer.error.length > 0 ) {
            if( settings.logging.net.signaling.error )
                console.warn( "Signaling client socket \"" + this.socket.strSavedRemoteAddress + "\" error answer", joAnswer );
        } else if( settings.logging.net.signaling.message )
            console.log( "Signaling client socket \"" + this.socket.strSavedRemoteAddress + " answer", joAnswer );
        this.socket.send( joAnswer, true ); // isFlush=true always in signaling server
        this.offerDiscoveryStop();
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class SignalingSpace extends EventDispatcher {
    constructor( idSpace, signalingCategory ) {
        super();
        this.isDisposed = false;
        this.idSpace = "" + ( ( idSpace && typeof idSpace == "string" && idSpace.length > 0 ) ? idSpace : "" );
        this.idSomebodyCreator = "";
        this.arr_published_offers = [];
        this.signalingCategory = signalingCategory;
        this.map_clients = {};
        this.signalingCategory.map_spaces[this.idSpace] = this;
        this.idCategory = "" + this.signalingCategory.idCategory;
        if( settings.logging.net.signaling.objectLifetime )
            console.log( "New signaling space \"" + this.idSpace + "\" in signaling category \"" + this.idCategory + "\"" );
        this.signalingCategory.dispatchEvent( new UniversalDispatcherEvent( "spaceAdded", { detail: { signalingSpace: this } } ) );
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        if( settings.logging.net.signaling.objectLifetime )
            console.log( "Disposing signaling space \"" + this.idSpace + "\" in signaling category \"" + this.idCategory + "\"" );
        for( const [ /*idRtcParticipant*/, signalingClient ] of Object.entries( this.map_clients ) )
            signalingClient.dispose();
        if( this.idSpace ) {
            if( this.signalingCategory ) {
                this.signalingCategory.dispatchEvent( new UniversalDispatcherEvent( "spaceRemoved", { detail: { signalingSpace: this } } ) );
                delete this.signalingCategory.map_spaces[this.idSpace];
            }
            this.idSpace = null;
        }
        this.idCategory = null;
        this.signalingCategory.autoDispose();
        this.signalingCategory = null;
        this.arr_published_offers = [];
        super.dispose();
    }
    autoDispose() {
        if( this.isDisposed )
            return;
        if( this.allSomebodyIDs().length > 0 )
            return;
        if( settings.logging.net.signaling.objectLifetime )
            console.log( "Auto-dispose signaling space \"" + this.idSpace + "\" in signaling category \"" + this.idCategory + "\"" );
        this.dispose();
    }
    allSomebodyIDs() {
        if( this.isDisposed )
            return [];
        return Object.keys( this.map_clients );
    }
    clientGet( idRtcParticipant ) {
        if( this.isDisposed )
            return null;
        const signalingClient = this.map_clients[idRtcParticipant];
        return signalingClient ? signalingClient : null;
    }
    clientRemove( idRtcParticipant ) {
        if( this.isDisposed )
            return false;
        idRtcParticipant = "" + ( idRtcParticipant ? idRtcParticipant.toString() : "" );
        if( idRtcParticipant in this.map_clients ) {
            const signalingClient = this.map_clients[idRtcParticipant];
            signalingClient.dispose();
            this.autoDispose();
            return true;
        }
        return false;
    }
    fetchPublishedOffer() {
        if( this.isDisposed || this.isDisposing ) {
            if( settings.logging.net.signaling.offerDiscoveryStepFail )
                console.warn( "Attempt to fetch offer in destroyed signaling space" );
            return null;
        }
        if( this.idSomebodyCreator == undefined || this.idSomebodyCreator == null || this.idSomebodyCreator == "" ) {
            if( settings.logging.net.signaling.offerDiscoveryStepFail )
                console.warn( "Attempt to fetch offer in malformed signaling space" );
            return null;
        }
        if( this.arr_published_offers.length == 0 ) {
            if( settings.logging.net.signaling.offerDiscoveryStepFail )
                console.warn( "Attempt to fetch offer in  signaling space with no offers" );
            return null;
        }
        const joOfferInfo = this.arr_published_offers[0];
        this.arr_published_offers.splice( 0, 1 );
        joOfferInfo.idSomebodyCreator = "" + this.idSomebodyCreator;
        return joOfferInfo;
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class SignalingCategory extends EventDispatcher {
    constructor( idCategory, signalingManager ) {
        super();
        this.isDisposed = false;
        this.idCategory = "" + ( ( idCategory && typeof idCategory == "string" && idCategory.length > 0 ) ? idCategory : "" );
        this.signalingManager = signalingManager;
        this.map_spaces = {};
        this.signalingManager.map_categories[this.idCategory] = this;
        if( settings.logging.net.signaling.objectLifetime )
            console.log( "New signaling category \"" + this.idCategory + "\"" );
        this.signalingManager.dispatchEvent( new UniversalDispatcherEvent( "categoryAdded", { detail: { signalingCategory: this } } ) );
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        if( settings.logging.net.signaling.objectLifetime )
            console.log( "Disposing signaling category \"" + this.idCategory + "\"" );
        for( const [ /*idSpace*/, signalingSpace ] of Object.entries( this.map_spaces ) )
            signalingSpace.dispose();
        if( this.signalingManager ) {
            delete this.signalingManager.map_categories[this.idCategory];
            this.signalingManager.dispatchEvent( new UniversalDispatcherEvent( "categoryRemoved", { detail: { signalingCategory: this } } ) );
            this.signalingManager = null;
        }
        this.map_spaces = {};
        this.idCategory = null;
        super.dispose();
    }
    autoDispose() {
        if( this.isDisposed )
            return;
        if( this.allCSpaceIDs().length > 0 )
            return;
        if( settings.logging.net.signaling.objectLifetime )
            console.log( "Auto-dispose signaling category \"" + this.idCategory + "\"" );
        this.dispose();
    }
    allCSpaceIDs() {
        if( this.isDisposed )
            return [];
        return Object.keys( this.map_spaces );
    }
    spaceGet( idSpace, isAutoAlloc ) {
        if( this.isDisposed )
            return null;
        try {
            idSpace = "" + ( idSpace ? idSpace.toString() : settings.rtcSpace.defaultSpaceName );
            isAutoAlloc = ( isAutoAlloc == null || isAutoAlloc == undefined ) ? true : ( isAutoAlloc ? true : false );
            let signalingSpace = null;
            if( idSpace in this.map_spaces )
                signalingSpace = this.map_spaces[idSpace];
            else if( isAutoAlloc )
                this.map_spaces["" + idSpace] = signalingSpace = new SignalingSpace( "" + idSpace, this );
            return signalingSpace;
        } catch ( err ) {
            if( settings.logging.net.signaling.error )
                console.warn( "Signaling space retrieval error:", err );
            return null;
        }
    }
    spaceRemove( idSpace ) {
        if( this.isDisposed )
            return false;
        idSpace = "" + ( idSpace ? idSpace.toString() : idSpace.rtcSpace.defaultSpaceName );
        if( idSpace in this.map_spaces ) {
            const signalingSpace = this.map_spaces[idSpace];
            signalingSpace.dispose();
            this.autoDispose();
            return true;
        }
        return false;
    }
    fetchPublishedOffer() {
        if( this.isDisposed )
            return null;
        for( const [ /*idSpace*/, signalingSpace ] of Object.entries( this.map_spaces ) ) {
            const joOfferInfo = signalingSpace.fetchPublishedOffer();
            if( joOfferInfo )
                return joOfferInfo;
        }
        return null;
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class SignalingManager extends EventDispatcher {
    constructor() {
        super();
        this.isDisposed = false;
        this.map_categories = {};
        if( settings.logging.net.signaling.objectLifetime )
            console.log( "New signaling manager" );
    }
    dispose() {
        if( this.isDisposed )
            return;
        this.isDisposing = true;
        if( settings.logging.net.signaling.objectLifetime )
            console.log( "Disposing signaling manager" );
        for( const [ /*idCategory*/, signalingCategory ] of Object.entries( this.map_categories ) )
            signalingCategory.dispose();
        this.map_categories = {};
        super.dispose();
    }
    allCategoryIDs() {
        return Object.keys( this.map_categories );
    }
    categoryGet( idCategory, isAutoAlloc ) {
        try {
            idCategory = "" + ( idCategory ? idCategory.toString() : settings.rtcSpace.defaultSpaceCategory );
            isAutoAlloc = ( isAutoAlloc == null || isAutoAlloc == undefined ) ? true : ( isAutoAlloc ? true : false );
            let signalingCategory = null;
            if( idCategory in this.map_categories )
                signalingCategory = this.map_categories[idCategory];
            else if( isAutoAlloc )
                this.map_categories["" + idCategory] = signalingCategory = new SignalingCategory( "" + idCategory, this );
            return signalingCategory;
        } catch ( err ) {
            if( settings.logging.net.signaling.error )
                console.warn( "Signaling category retrieval error:", err );
            return null;
        }
    }
    categoryRemove( idCategory ) {
        idCategory = "" + ( idCategory ? idCategory.toString() : settings.rtcSpace.defaultSpaceName );
        if( idCategory in this.map_categories ) {
            const signalingCategory = this.map_categories[idCategory];
            signalingCategory.dispose();
            return true;
        }
        return false;
    }
};

const g_default_signaling_manager = new SignalingManager();

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class SignalingServer extends EventDispatcher {
    constructor( acceptor, signalingManager ) {
        super();
        if( acceptor == null || acceptor == undefined || typeof acceptor != "object" )
            throw new Error( "Cannot create test server on bad acceptor" );
        this.acceptor = acceptor;
        this.signalingManager = signalingManager || g_default_signaling_manager;
        const self = this;
        acceptor.on( "connection", function( eventData ) {
            const socket = eventData.socket;
            if( ( ! ( "remoteAddress" in eventData ) ) || eventData.remoteAddress == null || eventData.remoteAddress == undefined )
                socket.strSavedRemoteAddress = socket.constructor.name;
            else
                socket.strSavedRemoteAddress = "" + eventData.remoteAddress;
            socket.signalingClient = null; // not impersonated yet
            if( settings.logging.net.signaling.connect )
                console.log( "New signaling server connection \"" + socket.strSavedRemoteAddress + "\"" );
            socket.signalingAuthInfo = {
                isAuthorized: false,
                idCategory: null,
                idSpaceSpace: null,
                idRtcParticipant: null
            };
            let _offAllPipeEventListeners = null;
            let _onPipeClose = function() {
                if( settings.logging.net.signaling.disconnect )
                    console.warn( "Signaling client socket closed \"" + socket.strSavedRemoteAddress + "\"" );
                if( _offAllPipeEventListeners ) {
                    _offAllPipeEventListeners();
                    _offAllPipeEventListeners = null;
                }
                if( socket.signalingClient ) {
                    socket.signalingClient.onPipeClose( socket );
                    socket.signalingClient = null;
                }
            };
            let _onPipeError = function( eventData ) {
                if( settings.logging.net.signaling.error )
                    console.warn( "Socket error \"" + socket.strSavedRemoteAddress + "\"" );
                if( _offAllPipeEventListeners ) {
                    _offAllPipeEventListeners();
                    _offAllPipeEventListeners = null;
                }
                if( socket.signalingClient ) {
                    socket.signalingClient.onPipeError( socket );
                    socket.signalingClient = null;
                }
            };
            let _onPipeMessage = function( eventData ) {
                if( settings.logging.net.signaling.rawMessage )
                    console.log( "Signaling client socket \"" + eventData.strSavedRemoteAddress + "\" raw message", eventData );
                const joMessage = eventData.message;
                if( settings.logging.net.signaling.message )
                    console.log( "Signaling client socket \"" + socket.strSavedRemoteAddress + "\" message ", joMessage );
                let signalingCategory = null;
                let signalingSpace = null;
                let signalingClient = socket.signalingClient;
                if( signalingClient ) {
                    signalingSpace = signalingClient.signalingSpace;
                    if( signalingSpace )
                        signalingCategory = signalingSpace.signalingCategory;
                }
                let joAnswer = null;
                let isForceDisconnect = false;
                try {
                    switch ( joMessage.method ) {
                    case "signalingListSpaces": {
                        joAnswer = utils.prepareAnswerJSON( joMessage );
                        joAnswer.arrSpaces = self.gamingSpaceManager.allNames();
                    } break;
                    case "signalingImpersonate": {
                        const idRtcParticipant = joMessage.idRtcParticipant;
                        if( ( !idRtcParticipant ) || typeof idRtcParticipant != "string" || idRtcParticipant.length <= 0 ) {
                            isForceDisconnect = true;
                            throw new Error( "Bad impersonate call data, no valid signaling *somebody* ID provided" );
                        }
                        //
                        const strRole = joMessage.role;
                        if( ( !strRole ) || typeof strRole != "string" || strRole.length <= 0 || ( ! ( strRole == "creator" || strRole == "joiner" ) ) ) {
                            isForceDisconnect = true;
                            throw new Error( "Bad impersonate call data, no valid signaling *somebody* role provided" );
                        }
                        //
                        const idCategory = joMessage.idCategory;
                        if( ( !idCategory ) || typeof idCategory != "string" || idCategory.length <= 0 ) {
                            isForceDisconnect = true;
                            throw new Error( "Bad impersonate call data, no valid signaling space category provided" );
                        }
                        signalingCategory = self.signalingManager.categoryGet( idCategory, true );
                        if( ! signalingCategory ) {
                            isForceDisconnect = true;
                            throw new Error( "Bad impersonate call data, cannot get/alloc signaling category with \"" + idCategory + "\" name" );
                        }
                        //
                        const idSpace = joMessage.idSpace;
                        if( ( !idSpace ) || typeof idSpace != "string" || idSpace.length <= 0 ) {
                            isForceDisconnect = true;
                            throw new Error( "Bad impersonate call data, no valid signaling space name provided" );
                        }
                        signalingSpace = signalingCategory.spaceGet( idSpace, true );
                        if( ! signalingSpace ) {
                            isForceDisconnect = true;
                            throw new Error( "Bad impersonate call data, cannot get/alloc signaling space with \"" + idSpace + "\" name" );
                        }
                        //
                        if( signalingSpace.clientGet( idRtcParticipant ) != null ) {
                            isForceDisconnect = true;
                            throw new Error( "*Somebody* \"" + idRtcParticipant + "\" is already in \"" + idSpace + "\" signaling space" );
                        }
                        //
                        if( strRole == "creator" && signalingSpace.idSomebodyCreator != "" && signalingSpace.idSomebodyCreator != idRtcParticipant )
                            throw new Error( "*Somebody* \"" + idRtcParticipant + "\" is already in \"" + idSpace + "\" attempted to impersonate as creator while other creator already exist" );
                        //
                        signalingClient = new SignalingClient( "" + idRtcParticipant, "" + strRole, signalingSpace, socket );
                        if( settings.logging.net.signaling.impersonate ) {
                            isForceDisconnect = true;
                            console.log( "Signaling client socket \"" + socket.strSavedRemoteAddress + "\" was impersonated as \"" + idRtcParticipant +
                                "\" in signaling space \"" + signalingSpace.idSpace + "\"" );
                        }
                        // if( (!( "fnFlushNetwork" in signalingSpace )) || (!signalingSpace.fnFlushNetwork) )
                        //     //console.log( "Setting up network data flushing in acceptor" );
                        //     signalingSpace.fnFlushNetwork = function() {
                        //         // TO-DO: improve this
                        //         //console.log( "Flushing data to network via acceptor" );
                        //         acceptor.flush(); // network
                        //     };
                        socket.signalingClient = signalingClient;
                        socket.signalingAuthInfo.isAuthorized = true;
                        socket.signalingAuthInfo.idCategory = "" + idCategory;
                        socket.signalingAuthInfo.idSpaceSpace = "" + idSpace;
                        socket.signalingAuthInfo.idRtcParticipant = "" + idRtcParticipant;
                        joAnswer = utils.prepareAnswerJSON( joMessage ); // successful answer
                        joAnswer.signalingAuthInfo = JSON.parse( JSON.stringify( socket.signalingAuthInfo ) );
                    } break;
                    case "signalingPublishOffer": {
                        if( ! ( signalingClient && signalingSpace && signalingCategory ) )
                            throw new Error( "only connected signaling clients can publish offers" );
                        if( ! ( signalingClient.isCreator ) )
                            throw new Error( "only creator can publish offers" );
                        const joOfferInfo = {
                            // ts: some time stamp
                            offer: joMessage.offer,
                            idOffer: 0 + joMessage.idOffer
                        };
                        signalingSpace.arr_published_offers.push( joOfferInfo );
                        if( settings.logging.net.signaling.publishOffer ) {
                            console.log( "Signaling client socket \"" + socket.strSavedRemoteAddress + "\" impersonated as \"" + signalingClient.idRtcParticipant +
                                "\" in signaling space \"" + signalingSpace.idSpace + "\" did published creator offer:", joOfferInfo );
                        }
                        joAnswer = utils.prepareAnswerJSON( joMessage ); // successful answer
                    } break;
                    case "signalingFetchOffer": {
                        if( ! ( signalingClient && signalingSpace && signalingCategory ) )
                            throw new Error( "only connected signaling clients can fetch published offers" );
                        signalingClient.offerDiscoveryStart( joMessage );
                    } break;
                    case "signalingPublishAnswer": {
                        if( ! ( signalingClient && signalingSpace && signalingCategory ) )
                            throw new Error( "only connected signaling clients can publish offer answers" );
                        const connectedServerCreator = signalingSpace.clientGet( joMessage.idSomebodyCreator );
                        if( ! connectedServerCreator )
                            throw new Error( "answer published with invalid server holder reference: " + joMessage.idSomebodyCreator );
                        const joForwardMessage = JSON.parse( JSON.stringify( joMessage ) );
                        joForwardMessage.idSomebody_joiner = "" + signalingClient.idRtcParticipant;
                        connectedServerCreator.socket.send( joForwardMessage ); // re-send it to server holder, joiner *somebody* ID is added
                        // no answer so far((
                    } break;
                    default: {
                        joAnswer = utils.prepareAnswerJSON( joMessage );
                        joAnswer.error = "Unhandled message";
                        joAnswer.joMessage = joMessage; // send it back ))
                        if( settings.logging.net.signaling.error )
                            console.warn( "Signaling client socket \"" + socket.strSavedRemoteAddress + "\" unhandled message", joMessage );
                    } break;
                    } // switch( joMessage.method )
                } catch ( err ) {
                    if( settings.logging.net.signaling.error )
                        console.warn( "Server method", joMessage.method, "RPC exception:", err );
                    joAnswer = utils.prepareAnswerJSON( joMessage );
                    joAnswer.error = "" + err.toString();
                }
                if( joAnswer != null && joAnswer != undefined ) {
                    if( typeof joAnswer.error == "string" && joAnswer.error.length > 0 ) {
                        if( settings.logging.net.signaling.error )
                            console.warn( "Signaling client socket \"" + socket.strSavedRemoteAddress + "\" error answer", joAnswer );
                    } else if( settings.logging.net.signaling.message )
                        console.log( "Signaling client socket \"" + socket.strSavedRemoteAddress + " answer", joAnswer );
                    socket.send( joAnswer, true ); // isFlush=true always in signaling server
                    if( isForceDisconnect )
                        socket.disconnect();
                }
                if( signalingSpace )
                    signalingSpace.autoDispose();
                if( signalingCategory )
                    signalingCategory.autoDispose();
            };
            _offAllPipeEventListeners = function() {
                if( _onPipeClose ) {
                    socket.off( "close", _onPipeClose );
                    _onPipeClose = null;
                }
                if( _onPipeError ) {
                    socket.off( "error", _onPipeError );
                    _onPipeError = null;
                }
                if( _onPipeMessage ) {
                    socket.off( "message", _onPipeMessage );
                    _onPipeMessage = null;
                }
                let signalingSpace = null;
                const signalingClient = socket.signalingClient;
                if( signalingClient ) {
                    signalingSpace = signalingClient.signalingSpace;
                    if( settings.logging.net.signaling.disconnect )
                        console.log( "Handling connection close for signaling client \"" + signalingClient.idRtcParticipant + "\"" );
                    if( signalingSpace )
                        signalingSpace.clientRemove( signalingClient.idRtcParticipant );

                    signalingClient.dispose();
                }
                socket.signalingClient = null;
            };
            socket.on( "close", _onPipeClose );
            socket.on( "error", _onPipeError );
            socket.on( "message", _onPipeMessage );
        } );
        this.dispatchEvent( new UniversalDispatcherEvent( "initialized", { detail: { ref: this } } ) );
    }
    dispose() {
        this.isDisposing = true;
        super.dispose();
    }
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const protoName = settings.net.secure ? "WSS" : "WS";
if( settings.logging.net.signaling.generic )
    console.log( protoName + " signaling server will start" );

const key = settings.net.secure ? fs.readFileSync( "./self-signed/self-signed-key.pem", "utf8" ) : null;
const cert = settings.net.secure ? fs.readFileSync( "./self-signed/self-signed-cert.pem", "utf8" ) : null;
let acceptor = new network_layer.WebSocketServerAcceptor( settings.net.ports.signaling, key, cert );
let signalingServer = new SignalingServer( acceptor );
signalingServer.on( "initialized", function() {
    if( settings.logging.net.signaling.generic )
        console.log( protoName + " signaling server did started" );
} );
signalingServer.on( "dispose", function() {
    if( settings.logging.net.signaling.generic )
        console.log( protoName + " signaling server did stopped" );
} );

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let g_bShouldExit = false, g_bProcessExitRequested = false;
function exit_if_needed() {
    if( ! g_bShouldExit )
        return;
    if( g_bProcessExitRequested )
        return;
    // ensure components stopped here, if needed
    g_bProcessExitRequested = true;
    console.log( "App will exit" );
    process.exit( 0 );
}

process.on( "SIGINT", function() {
    console.warn( "\nApp did caught interrupt signal " );
    // stop components here, if needed
    if( signalingServer ) {
        console.log( "Will stop signaling server" );
        signalingServer.dispose();
        signalingServer = null;
        console.log( "Did stopped signaling server" );
    }
    if( acceptor ) {
        console.log( "Will stop signaling acceptor" );
        acceptor.dispose();
        acceptor = null;
        console.log( "Did stopped signaling acceptor" );
    }
    g_bShouldExit = true;
    //
    exit_if_needed();
    g_bShouldExit = true;
} );

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
