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
 * @file utils.js
 * @copyright SKALE Labs 2019-Present
 */

const { settings } = require( "./settings.js" );

const uuid_v4 = function() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace( /[xy]/g, function( c ) {
        const r = Math.random() * 16 | 0, v = c == "x" ? r : ( r & 0x3 | 0x8 );
        return v.toString( 16 );
    } );
};

const getRandomInt = function( nMax ) {
    return parseInt( Math.floor( Math.random() * Math.floor( nMax ) ), 10 );
};

const randomFixedInteger = function( length ) {
    return Math.floor( Math.pow( 10, length - 1 ) + Math.random() * ( Math.pow( 10, length ) - Math.pow( 10, length - 1 ) - 1 ) );
};

const randomStringABC = function( length, arrCharacters ) {
    length = parseInt( length, 10 );
    if( length <= 0 || arrCharacters.length == 0 )
        return "";
    let s = "";
    for( let i = 0; i < length; ++i )
        s += arrCharacters.charAt( Math.floor( Math.random() * arrCharacters.length ) );
    return s;
};

const randomString = function( length, isABC, isDigits, isSpecChr, isPunctuation ) { // by default only isABC=true
    length = parseInt( length, 10 );
    if( length <= 0 )
        return "";
    isABC = ( isABC == null || isABC == undefined ) ? true : ( isABC ? true : false );
    isDigits = ( isDigits == null || isDigits == undefined ) ? false : ( isDigits ? true : false );
    isSpecChr = ( isSpecChr == null || isSpecChr == undefined ) ? false : ( isSpecChr ? true : false );
    isPunctuation = ( isPunctuation == null || isPunctuation == undefined ) ? false : ( isPunctuation ? true : false );
    let arrCharacters = "";
    if( isABC )
        arrCharacters += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    if( isDigits )
        arrCharacters += "0123456789";
    if( isSpecChr )
        arrCharacters += "(){}[]~!?@#$%^&*_+-='\"/\\";
    if( isPunctuation )
        arrCharacters += ",.:;";
    if( arrCharacters.length == 0 )
        return "";
    return randomStringABC( length, arrCharacters );
};

const randomHexString = function( length ) { // length in characters, not bytes, each byte is 2 characters
    const arrCharacters = "0123456789abcdef";
    return randomStringABC( length, arrCharacters );
};

const replaceAll = function( str, find, replace ) {
    return str.replace( new RegExp( find, "g" ), replace );
};

const simpleEscapeString = function( s ) {
    if( s == null || s == undefined || typeof s != "string" )
        return s;
    s = replaceAll( s, "&", "&amp;" );
    s = replaceAll( s, "<", "&lt;" );
    s = replaceAll( s, ">", "&gt;" );
    s = replaceAll( s, " ", "&nbsp;" );
    return s;
};

const abstractUniqueID = function() {
    const id = replaceAll( uuid_v4(), "-", "" ).toLowerCase();
    return id;
};

const isEven = function( n ) {
    return n % 2 == 0;
};
const isOdd = function( n ) {
    return Math.abs( n % 2 ) == 1;
};

const g_nCallIdDigits = 10;
const randomCallID = function() {
    const id = randomHexString( g_nCallIdDigits );
    return id;
};

const g_nDirectPipeIdDigits = 10;
const randomDirectPipeID = function() {
    const id = randomHexString( g_nDirectPipeIdDigits );
    return id;
};

const bind_scope_to_function = function( scope, fn ) {
    return function() {
        fn.apply( scope, arguments );
    };
};

const prepareAnswerJSON = function( joMessage ) {
    const joAnswer = {
        id: "" + ( ( joMessage != null && joMessage != undefined && typeof joMessage.id == "string" ) ? joMessage.id : randomCallID() ),
        method: "" + ( ( joMessage != null && joMessage != undefined && typeof joMessage.method == "string" ) ? joMessage.method : "" ),
        error: null
    };
    return joAnswer;
};

const makeValidSignalingServerURL = function( strSignalingServerURL ) {
    const proto = settings.net.secure ? "wss" : "ws";
    return "" + ( ( strSignalingServerURL != null && strSignalingServerURL != undefined && typeof strSignalingServerURL == "string" && strSignalingServerURL.length > 0 )
        ? "" + strSignalingServerURL
        : "" + proto + "://" + settings.net.hostname + ":" + settings.net.ports.signaling
    );
};

const zero_padding_left = function( val, cntCharsNeeded ) {
    if( val == null || val == undefined )
        return val;
    let s = "" + val;
    while( s.length < cntCharsNeeded )
        s = "0" + s;
    return s;
};
const zero_padding_right = function( val, cntCharsNeeded ) {
    if( val == null || val == undefined )
        return val;
    let s = "" + val;
    while( s.length < cntCharsNeeded )
        s = s + "0";
    return s;
};

const parse_date_time = function( ts ) {
    if( ts === null || ts === undefined )
        return ts;
    if( typeof ts != "string" )
        return null;
    // example:
    //  0----|----1----|----2----|----
    //  012345678901234567890123456789
    // "2020/03/19-19:42:55.663"
    const year = parseInt( ts.substring( 0, 4 ), 10 );
    const month = parseInt( ts.substring( 5, 7 ), 10 ) + 1;
    const day = parseInt( ts.substring( 8, 10 ), 10 );
    const hour = parseInt( ts.substring( 11, 13 ), 10 );
    const minute = parseInt( ts.substring( 14, 16 ), 10 );
    const second = parseInt( ts.substring( 17, 19 ), 10 );
    let millisecond = ts.substring( 20 );
    if( millisecond.length > 3 )
        millisecond = millisecond.substring( 0, 3 );
    else {
        while( millisecond.length < 3 )
            millisecond = "0" + millisecond;
    }
    millisecond = parseInt( millisecond, 10 );
    const u = Date.UTC( year, month, day, hour, minute, second, millisecond );
    const d = new Date( u );
    d.setMilliseconds( millisecond );
    return d;
};
const format_date_time = function( dt, isDate, isTime, isMilliseconds, sepDate, sepTime, sepBetween, sepMilliseconds ) {
    if( dt === null )
        return "null-date-time";
    if( dt === undefined )
        return "undefined-date-time";
    if( ! ( dt instanceof Date ) )
        return "not-a-date-time";
    isDate = ( isDate == null || isDate == undefined ) ? true : ( isDate ? true : false );
    isTime = ( isTime == null || isTime == undefined ) ? true : ( isTime ? true : false );
    if( ( !isDate ) && ( !isTime ) )
        return "";
    let s = "";
    if( isDate ) {
        sepDate = ( sepDate == null || sepDate == undefined || ( typeof sepDate != "string" ) ) ? "/" : sepDate;
        const strDate = "" +
            zero_padding_left( dt.getFullYear(), 4 ) +
            sepDate +
            zero_padding_left( dt.getMonth() + 1, 2 ) +
            sepDate +
            zero_padding_left( dt.getDate(), 2 );
        s += strDate;
    }
    if( isTime ) {
        sepTime = ( sepTime == null || sepTime == undefined || ( typeof sepTime != "string" ) ) ? ":" : sepTime;
        if( isDate ) {
            sepBetween = ( sepBetween == null || sepBetween == undefined || ( typeof sepBetween != "string" ) ) ? "-" : sepBetween;
            s += sepBetween;
        }
        let strTime = "" +
            zero_padding_left( dt.getHours(), 2 ) +
            sepDate +
            zero_padding_left( dt.getMinutes(), 2 ) +
            sepDate +
            zero_padding_left( dt.getSeconds(), 2 );
        isMilliseconds = ( isMilliseconds == null || isMilliseconds == undefined ) ? true : ( isMilliseconds ? true : false );
        if( isMilliseconds ) {
            sepMilliseconds = ( sepMilliseconds == null || sepMilliseconds == undefined || ( typeof sepMilliseconds != "string" ) ) ? "." : sepMilliseconds;
            strTime += sepMilliseconds + zero_padding_right( dt.getMilliseconds(), 3 );
        }
        s += strTime;
    }
    return s;
};

module.exports = {
    uuid_v4: uuid_v4,
    getRandomInt: getRandomInt,
    randomFixedInteger: randomFixedInteger,
    randomStringABC: randomStringABC,
    randomString: randomString,
    randomHexString: randomHexString,
    replaceAll: replaceAll,
    simpleEscapeString: simpleEscapeString,
    abstractUniqueID: abstractUniqueID,
    isEven: isEven,
    isOdd: isOdd,
    g_nCallIdDigits: g_nCallIdDigits,
    randomCallID: randomCallID,
    g_nDirectPipeIdDigits: g_nDirectPipeIdDigits,
    randomDirectPipeID: randomDirectPipeID,
    bind_scope_to_function: bind_scope_to_function,
    prepareAnswerJSON: prepareAnswerJSON,
    makeValidSignalingServerURL: makeValidSignalingServerURL,
    zero_padding_left: zero_padding_left,
    zero_padding_right: zero_padding_right,
    parse_date_time: parse_date_time,
    format_date_time: format_date_time
};
