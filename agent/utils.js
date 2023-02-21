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
 * @file utils.js
 * @copyright SKALE Labs 2019-Present
 */

const fs = require( "fs" );
const path = require( "path" );
// const url = require( "url" );
const os = require( "os" );
const { v4: uuid } = require( "uuid" );

const log = require( "../npms/skale-log/log.js" );
const cc = log.cc;

////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

function replaceAll( str, find, replace ) {
    return str.replace( new RegExp( find, "g" ), replace );
}

////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

function normalizePath( strPath ) {
    strPath = strPath.replace( /^~/, os.homedir() );
    strPath = path.normalize( strPath );
    strPath = path.resolve( strPath );
    return strPath;
}

function getRandomFileName() {
    const timestamp = new Date().toISOString().replace( /[-:.]/g,"" );
    const random = ( "" + Math.random() ).substring( 2, 8 );
    const random_number = timestamp + random;
    return random_number;
}

function fileExists( strPath ) {
    try {
        if( fs.existsSync( strPath ) ) {
            const stats = fs.statSync( strPath );
            if( stats.isFile() )
                return true;
        }
    } catch ( err ) {}
    return false;
}

function fileLoad( strPath, strDefault ) {
    strDefault = strDefault || "";
    if( !fileExists( strPath ) )
        return strDefault;
    try {
        const s = fs.readFileSync( strPath );
        return s;
    } catch ( err ) {}
    return strDefault;
}

function fileSave( strPath, s ) {
    try {
        fs.writeFileSync( strPath, s );
        return true;
    } catch ( err ) {}
    return false;
}

function jsonFileLoad( strPath, joDefault, bLogOutput ) {
    if( bLogOutput == undefined || bLogOutput == null )
        bLogOutput = false;
    joDefault = joDefault || {};
    if( bLogOutput )
        log.write( cc.normal( "Will load JSON file " ) + cc.info( strPath ) + cc.normal( "..." ) + "\n" );
    if( !fileExists( strPath ) ) {
        if( bLogOutput )
            log.write( cc.error( "Cannot load JSON file " ) + cc.info( strPath ) + cc.error( ", it does not exist" ) + "\n" );
        return joDefault;
    }
    try {
        const s = fs.readFileSync( strPath );
        if( bLogOutput )
            log.write( cc.normal( "Did loaded content of JSON file " ) + cc.info( strPath ) + cc.normal( ", will parse it..." ) + "\n" );
        const jo = JSON.parse( s );
        if( bLogOutput )
            log.write( cc.success( "Done, loaded content of JSON file " ) + cc.info( strPath ) + cc.success( "." ) + "\n" );
        return jo;
    } catch ( err ) {
        log.write( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " failed to load JSON file " ) + cc.info( strPath ) + cc.error( ": " ) + cc.warning( err ) + "\n" );
    }
    return joDefault;
}

function jsonFileSave( strPath, jo, bLogOutput ) {
    if( bLogOutput == undefined || bLogOutput == null )
        bLogOutput = false;
    if( bLogOutput )
        log.write( cc.normal( "Will save JSON file " ) + cc.info( strPath ) + cc.normal( "..." ) + "\n" );
    try {
        const s = JSON.stringify( jo, null, 4 );
        fs.writeFileSync( strPath, s );
        if( bLogOutput )
            log.write( cc.success( "Done, saved content of JSON file " ) + cc.info( strPath ) + cc.success( "." ) + "\n" );
        return true;
    } catch ( err ) {
        log.write( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " failed to save JSON file " ) + cc.info( strPath ) + cc.error( ": " ) + cc.warning( err ) + "\n" );
    }
    return false;
}

////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

function encodeUTF8( s ) { // marshals a string to an Uint8Array, see https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
    let i = 0; const arrBytes = new Uint8Array( s.length * 4 );
    for( let ci = 0; ci != s.length; ci++ ) {
        let c = s.charCodeAt( ci );
        if( c < 128 ) {
            arrBytes[i++] = c;
            continue;
        }
        if( c < 2048 )
            arrBytes[i++] = c >> 6 | 192; else {
            if( c > 0xd7ff && c < 0xdc00 ) {
                if( ++ci >= s.length )
                    throw new Error( "UTF-8 encode: incomplete surrogate pair" );
                const c2 = s.charCodeAt( ci );
                if( c2 < 0xdc00 || c2 > 0xdfff )
                    throw new Error( "UTF-8 encode: second surrogate character 0x" + c2.toString( 16 ) + " at index " + ci + " out of range" );
                c = 0x10000 + ( ( c & 0x03ff ) << 10 ) + ( c2 & 0x03ff );
                arrBytes[i++] = c >> 18 | 240;
                arrBytes[i++] = c >> 12 & 63 | 128;
            } else
                arrBytes[i++] = c >> 12 | 224;
            arrBytes[i++] = c >> 6 & 63 | 128;
        }
        arrBytes[i++] = c & 63 | 128;
    }
    return arrBytes.subarray( 0, i );
}

function decodeUTF8( arrBytes ) { // un-marshals a string from an Uint8Array, see https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
    let i = 0; let s = "";
    while( i < arrBytes.length ) {
        let c = arrBytes[i++];
        if( c > 127 ) {
            if( c > 191 && c < 224 ) {
                if( i >= arrBytes.length )
                    throw new Error( "UTF-8 decode: incomplete 2-byte sequence" );
                c = ( c & 31 ) << 6 | arrBytes[i++] & 63;
            } else if( c > 223 && c < 240 ) {
                if( i + 1 >= arrBytes.length )
                    throw new Error( "UTF-8 decode: incomplete 3-byte sequence" );
                c = ( c & 15 ) << 12 | ( arrBytes[i++] & 63 ) << 6 | arrBytes[i++] & 63;
            } else if( c > 239 && c < 248 ) {
                if( i + 2 >= arrBytes.length )
                    throw new Error( "UTF-8 decode: incomplete 4-byte sequence" );
                c = ( c & 7 ) << 18 | ( arrBytes[i++] & 63 ) << 12 | ( arrBytes[i++] & 63 ) << 6 | arrBytes[i++] & 63;
            } else
                throw new Error( "UTF-8 decode: unknown multi-byte start 0x" + c.toString( 16 ) + " at index " + ( i - 1 ) );
        }
        if( c <= 0xffff )
            s += String.fromCharCode( c ); else if( c <= 0x10ffff ) {
            c -= 0x10000;
            s += String.fromCharCode( c >> 10 | 0xd800 );
            s += String.fromCharCode( c & 0x3FF | 0xdc00 );
        } else
            throw new Error( "UTF-8 decode: code point 0x" + c.toString( 16 ) + " exceeds UTF-16 reach" );
    }
    return s;
}

////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

function hexToBytes( strHex, isInversiveOrder ) { // convert a hex string to a byte array
    isInversiveOrder = !!( ( isInversiveOrder != null && isInversiveOrder != undefined && isInversiveOrder ) );
    strHex = strHex || "";
    strHex = "" + strHex;
    strHex = strHex.trim().toLowerCase();
    if( strHex.length > 1 && strHex[0] == "0" && ( strHex[1] == "x" || strHex[1] == "X" ) )
        strHex = strHex.substr( 2, strHex.length - 2 );
    if( ( strHex.length & 1 ) !== 0 )
        strHex = "0" + strHex;
    const cnt = strHex.length;
    let i, j;
    const arrBytes = new Uint8Array( cnt / 2 );
    for( i = 0, j = 0; i < cnt; ++j, i += 2 )
        arrBytes[j] = parseInt( strHex.substr( i, 2 ), 16 );
    if( isInversiveOrder )
        invertArrayItemsLR( arrBytes );
    return arrBytes;
}

function bytesToHex( arrBytes, isInversiveOrder ) { // convert a byte array to a hex string
    isInversiveOrder = !!( ( isInversiveOrder != null && isInversiveOrder != undefined && isInversiveOrder ) );
    const hex = [];
    for( let i = 0; i < arrBytes.length; i++ ) {
        const current = arrBytes[i] < 0 ? arrBytes[i] + 256 : arrBytes[i];
        const c0 = ( current >>> 4 ).toString( 16 );
        const c1 = ( current & 0xF ).toString( 16 );
        if( isInversiveOrder ) {
            hex.splice( 0, 0, c0 );
            hex.splice( 1, 0, c1 );
        } else {
            hex.push( c0 );
            hex.push( c1 );
        }
    }
    return hex.join( "" );
}

function bytesAlignLeftWithZeroes( arrBytes, cntMin ) {
    const arrOneZeroByte = new Uint8Array( 1 );
    arrOneZeroByte[0] = 0;
    while( arrBytes.length < cntMin )
        arrBytes = bytesConcat( arrOneZeroByte, arrBytes );
    return arrBytes;
}

function bytesAlignRightWithZeroes( arrBytes, cntMin ) {
    const arrOneZeroByte = new Uint8Array( 1 );
    arrOneZeroByte[0] = 0;
    while( arrBytes.length < cntMin )
        arrBytes = bytesConcat( arrBytes, arrOneZeroByte );
    return arrBytes;
}

function concatTypedArrays( a, b ) { // a, b TypedArray of same type
    const c = new ( a.constructor )( a.length + b.length );
    c.set( a, 0 );
    c.set( b, a.length );
    return c;
}

function concatByte( ui8a, byte ) {
    const b = new Uint8Array( 1 );
    b[0] = byte;
    return concatTypedArrays( ui8a, b );
}

function bytesConcat( a1, a2 ) {
    a1 = a1 || new Uint8Array();
    a2 = a2 || new Uint8Array();
    return concatTypedArrays( a1, a2 );
}

function toArrayBuffer( buf ) { // see https://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer
    const ab = new ArrayBuffer( buf.length );
    const view = new Uint8Array( ab );
    for( let i = 0; i < buf.length; ++i )
        view[i] = buf[i];
    return ab;
}

function toBuffer( ab ) {
    const buf = Buffer.alloc( ab.byteLength );
    const view = new Uint8Array( ab );
    for( let i = 0; i < buf.length; ++i )
        buf[i] = view[i];
    return buf;
}

function invertArrayItemsLR( arr ) {
    let i; const cnt = arr.length / 2;
    for( i = 0; i < cnt; ++i ) {
        const e1 = arr[i];
        const e2 = arr[arr.length - i - 1];
        arr[i] = e2;
        arr[arr.length - i - 1] = e1;
    }
    return arr;
}

////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

function discover_in_json_coin_name( jo ) {
    if( typeof jo !== "object" )
        return "";
    const arrKeys = Object.keys( jo );
    let s1 = "";
    let s2 = "";
    let i; const cnt = arrKeys.length;
    let j;
    for( i = 0; i < cnt; ++i ) {
        if( s1.length > 0 && s2.length > 0 )
            break;
        const k = arrKeys[i];
        j = k.indexOf( "_address" );
        if( j > 0 ) {
            s1 = k.substring( 0, j );
            continue;
        }
        j = k.indexOf( "_abi" );
        if( j > 0 ) {
            s2 = k.substring( 0, j );
            continue;
        }
    }
    if( s1.length === 0 || s2.length === 0 )
        return "";
    if( s1 !== s2 )
        return "";
    return s1;
}

function check_key_exist_in_abi( strName, strFile, joABI, strKey, isExitOnError ) {
    if( isExitOnError == null || isExitOnError == undefined )
        isExitOnError = true;
    try {
        if( strKey in joABI )
            return true;
    } catch ( err ) {
    }
    if( isExitOnError ) {
        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Loaded " ) + cc.warning( strName ) + cc.error( " ABI JSON file " ) + cc.info( strFile ) + cc.error( " does not contain needed key " ) + cc.warning( strKey ) + "\n" );
        process.exit( 126 );
    }
    return false;
}

function check_keys_exist_in_abi( strName, strFile, joABI, arrKeys, isExitOnError ) {
    const cnt = arrKeys.length;
    for( let i = 0; i < cnt; ++i ) {
        const strKey = arrKeys[i];
        if( ! check_key_exist_in_abi( strName, strFile, joABI, strKey, isExitOnError ) )
            return false;
    }
    return true;
}

////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

function compose_schain_node_url( joNode ) {
    // if( "ip" in joNode && typeof joNode.ip === "string" && joNode.ip.length > 0 ) {
    //     if( "wssRpcPort" in joNode && typeof joNode.wssRpcPort === "number" && joNode.wssRpcPort > 0 )
    //         return "wss://" + joNode.ip + ":" + joNode.wssRpcPort;
    //     if( "wsRpcPort" in joNode && typeof joNode.wsRpcPort === "number" && joNode.wsRpcPort > 0 )
    //         return "ws://" + joNode.ip + ":" + joNode.wsRpcPort;
    //     if( "httpsRpcPort" in joNode && typeof joNode.httpsRpcPort === "number" && joNode.httpsRpcPort > 0 )
    //         return "https://" + joNode.ip + ":" + joNode.httpsRpcPort;
    //     if( "httpRpcPort" in joNode && typeof joNode.httpRpcPort === "number" && joNode.httpRpcPort > 0 )
    //         return "http://" + joNode.ip + ":" + joNode.httpRpcPort;
    // }
    // if( "ip6" in joNode && typeof joNode.ip6 === "string" && joNode.ip6.length > 0 ) {
    //     if( "wssRpcPort6" in joNode && typeof joNode.wssRpcPort6 === "number" && joNode.wssRpcPort6 > 0 )
    //         return "wss://[" + joNode.ip6 + "]:" + joNode.wssRpcPort6;
    //     if( "wsRpcPort6" in joNode && typeof joNode.wsRpcPort6 === "number" && joNode.wsRpcPort6 > 0 )
    //         return "ws://[" + joNode.ip6 + "]:" + joNode.wsRpcPort6;
    //     if( "httpsRpcPort6" in joNode && typeof joNode.httpsRpcPort6 === "number" && joNode.httpsRpcPort6 > 0 )
    //         return "https://[" + joNode.ip6 + "]:" + joNode.httpsRpcPort6;
    //     if( "httpRpcPort6" in joNode && typeof joNode.httpRpcPort6 === "number" && joNode.httpRpcPort6 > 0 )
    //         return "http://[" + joNode.ip6 + "]:" + joNode.httpRpcPort6;
    // }
    if( "ip" in joNode && typeof joNode.ip === "string" && joNode.ip.length > 0 ) {
        if( "httpRpcPort" in joNode && typeof joNode.httpRpcPort === "number" && joNode.httpRpcPort > 0 )
            return "http://" + joNode.ip + ":" + joNode.httpRpcPort;
        if( "wsRpcPort" in joNode && typeof joNode.wsRpcPort === "number" && joNode.wsRpcPort > 0 )
            return "ws://" + joNode.ip + ":" + joNode.wsRpcPort;
        if( "httpsRpcPort" in joNode && typeof joNode.httpsRpcPort === "number" && joNode.httpsRpcPort > 0 )
            return "https://" + joNode.ip + ":" + joNode.httpsRpcPort;
        if( "wssRpcPort" in joNode && typeof joNode.wssRpcPort === "number" && joNode.wssRpcPort > 0 )
            return "wss://" + joNode.ip + ":" + joNode.wssRpcPort;
    }
    if( "ip6" in joNode && typeof joNode.ip6 === "string" && joNode.ip6.length > 0 ) {
        if( "httpRpcPort6" in joNode && typeof joNode.httpRpcPort6 === "number" && joNode.httpRpcPort6 > 0 )
            return "http://[" + joNode.ip6 + "]:" + joNode.httpRpcPort6;
        if( "wsRpcPort6" in joNode && typeof joNode.wsRpcPort6 === "number" && joNode.wsRpcPort6 > 0 )
            return "ws://[" + joNode.ip6 + "]:" + joNode.wsRpcPort6;
        if( "httpsRpcPort6" in joNode && typeof joNode.httpsRpcPort6 === "number" && joNode.httpsRpcPort6 > 0 )
            return "https://[" + joNode.ip6 + "]:" + joNode.httpsRpcPort6;
        if( "wssRpcPort6" in joNode && typeof joNode.wssRpcPort6 === "number" && joNode.wssRpcPort6 > 0 )
            return "wss://[" + joNode.ip6 + "]:" + joNode.wssRpcPort6;
    }
    return "";
}

function compose_ima_agent_node_url( joNode ) {
    let nPort = -1;
    if( "imaAgentRpcPort" in joNode && typeof joNode.imaAgentRpcPort === "number" && joNode.imaAgentRpcPort > 0 )
        nPort = joNode.imaAgentRpcPort;
    // PROPOSAL = 0
    // CATCHUP = 1
    // WS_JSON = 2
    // HTTP_JSON = 3
    // BINARY_CONSENSUS = 4
    // ZMQ_BROADCAST = 5
    // IMA_MONITORING = 6
    // WSS_JSON = 7
    // HTTPS_JSON = 8
    // INFO_HTTP_JSON = 9
    // IMA_AGENT_JSON = 10
    if( nPort < 0 && "httpRpcPort" in joNode && typeof joNode.httpRpcPort === "number" && joNode.httpRpcPort > 0 )
        nPort = joNode.httpRpcPort - 3 + 10;
    if( nPort < 0 && "wsRpcPort" in joNode && typeof joNode.wsRpcPort === "number" && joNode.wsRpcPort > 0 )
        nPort = joNode.wsRpcPort - 2 + 10;
    if( nPort < 0 && "httpsRpcPort" in joNode && typeof joNode.httpsRpcPort === "number" && joNode.httpsRpcPort > 0 )
        nPort = joNode.httpsRpcPort - 8 + 10;
    if( nPort < 0 && "wssRpcPort" in joNode && typeof joNode.wssRpcPort === "number" && joNode.wssRpcPort > 0 )
        nPort = joNode.wssRpcPort - 7 + 10;
    if( nPort > 0 )
        return "ws://" + joNode.ip + ":" + nPort;
    return "";
}

////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

module.exports = {
    uuid: uuid,
    log: log,
    cc: cc,
    //
    replaceAll: replaceAll,
    //
    normalizePath: normalizePath,
    getRandomFileName: getRandomFileName,
    fileExists: fileExists,
    fileLoad: fileLoad,
    fileSave: fileSave,
    jsonFileLoad: jsonFileLoad,
    jsonFileSave: jsonFileSave,
    //
    encodeUTF8: encodeUTF8,
    decodeUTF8: decodeUTF8,
    //
    hexToBytes: hexToBytes,
    bytesToHex: bytesToHex,
    bytesAlignLeftWithZeroes: bytesAlignLeftWithZeroes,
    bytesAlignRightWithZeroes: bytesAlignRightWithZeroes,
    concatTypedArrays: concatTypedArrays,
    concatByte: concatByte,
    bytesConcat: bytesConcat,
    toArrayBuffer: toArrayBuffer,
    toBuffer: toBuffer,
    invertArrayItemsLR: invertArrayItemsLR,
    //
    discover_in_json_coin_name: discover_in_json_coin_name,
    check_key_exist_in_abi: check_key_exist_in_abi,
    check_keys_exist_in_abi: check_keys_exist_in_abi,
    //
    compose_schain_node_url: compose_schain_node_url,
    compose_ima_agent_node_url: compose_ima_agent_node_url
}; // module.exports
