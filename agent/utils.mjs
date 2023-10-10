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
 * @file utils.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as owaspUtils from "../npms/skale-owasp/owaspUtils.mjs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as log from "../npms/skale-log/log.mjs";
import * as cc from "../npms/skale-cc/cc.mjs";
import * as imaHelperAPIs from "../npms/skale-ima/imaHelperAPIs.mjs";

import { v4 as uuid } from "uuid";
export { uuid };

const ethersMod = owaspUtils.ethersMod;
export { ethersMod };

export function replaceAll( str, find, replace ) {
    return str.replace( new RegExp( find, "g" ), replace );
}

export function normalizePath( strPath ) {
    strPath = strPath.replace( /^~/, os.homedir() );
    strPath = path.normalize( strPath );
    strPath = path.resolve( strPath );
    return strPath;
}

export function getRandomFileName() {
    const timestamp = new Date().toISOString().replace( /[-:.]/g,"" );
    const random = ( "" + Math.random() ).substring( 2, 8 );
    const randomNumber = timestamp + random;
    return randomNumber;
}

export function fileExists( strPath ) {
    try {
        if( fs.existsSync( strPath ) ) {
            const stats = fs.statSync( strPath );
            if( stats.isFile() )
                return true;
        }
    } catch ( err ) {}
    return false;
}

export function fileLoad( strPath, strDefault ) {
    strDefault = strDefault || "";
    if( !fileExists( strPath ) )
        return strDefault;
    try {
        const s = fs.readFileSync( strPath );
        return s;
    } catch ( err ) {}
    return strDefault;
}

export function fileSave( strPath, s ) {
    try {
        fs.writeFileSync( strPath, s );
        return true;
    } catch ( err ) {}
    return false;
}

export function jsonFileLoad( strPath, joDefault, bLogOutput ) {
    if( bLogOutput == undefined || bLogOutput == null )
        bLogOutput = false;
    joDefault = joDefault || {};
    if( bLogOutput ) {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            log.write( cc.normal( "Will load JSON file " ) +
                cc.info( strPath ) + cc.normal( "..." ) + "\n" );
        }
    }
    if( !fileExists( strPath ) ) {
        if( bLogOutput ) {
            if( log.verboseGet() >= log.verboseReversed().error ) {
                log.write( cc.error( "Cannot load JSON file " ) +
                    cc.info( strPath ) + cc.error( ", it does not exist" ) + "\n" );
            }
        }
        return joDefault;
    }
    try {
        const s = fs.readFileSync( strPath );
        if( bLogOutput ) {
            if( log.verboseGet() >= log.verboseReversed().debug ) {
                log.write( cc.normal( "Did loaded content of JSON file " ) +
                    cc.info( strPath ) + cc.normal( ", will parse it..." ) + "\n" );
            }
        }
        const jo = JSON.parse( s );
        if( bLogOutput ) {
            if( log.verboseGet() >= log.verboseReversed().debug ) {
                log.write( cc.success( "Done, loaded content of JSON file " ) +
                    cc.info( strPath ) + cc.success( "." ) + "\n" );
            }
        }
        return jo;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            const strError = owaspUtils.extractErrorMessage( err );
            log.write( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " failed to load JSON file " ) +
                cc.info( strPath ) + cc.error( ": " ) +
                cc.warning( strError ) + cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n" );
        }
    }
    return joDefault;
}

export function jsonFileSave( strPath, jo, bLogOutput ) {
    if( bLogOutput == undefined || bLogOutput == null )
        bLogOutput = false;
    if( bLogOutput ) {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            log.write( cc.normal( "Will save JSON file " ) +
                cc.info( strPath ) + cc.normal( "..." ) + "\n" );
        }
    }
    try {
        const s = JSON.stringify( jo, null, 4 );
        fs.writeFileSync( strPath, s );
        if( bLogOutput ) {
            if( log.verboseGet() >= log.verboseReversed().debug ) {
                log.write( cc.success( "Done, saved content of JSON file " ) +
                    cc.info( strPath ) + cc.success( "." ) + "\n" );
            }
        }
        return true;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            const strError = owaspUtils.extractErrorMessage( err );
            log.write( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " failed to save JSON file " ) +
                cc.info( strPath ) + cc.error( ": " ) +
                cc.warning( strError ) + cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n" );
        }
    }
    return false;
}

const gMillisecondsToSleepStepWaitForClonedTokenToAppear = 1000;

export async function waitForClonedTokenToAppear(
    sc,
    strTokenSuffix, // example "erc20"
    addressCallFrom,
    cntAttempts,
    tokensMN,
    strMainnetName
) {
    const strTokenSuffixLC = strTokenSuffix.toLowerCase();
    const strTokenSuffixUC =
        owaspUtils.replaceAll( strTokenSuffix.toUpperCase(), "_WITH_METADATA", "_with_metadata" );
    const strTokenSuffixLCshort = owaspUtils.replaceAll( strTokenSuffixLC, "_with_metadata", "" );
    const ts0 = cc.timestampHR();
    let ts1;
    if( log.verboseGet() >= log.verboseReversed().information ) {
        log.write( cc.debug( "Waiting for " ) + cc.notice( strTokenSuffixUC ) +
            cc.debug( " token to appear automatically deployed on S-Chain " ) +
            cc.attention( sc.chainName ) + cc.debug( "..." ) + "\n" );
    }
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        log.write( cc.debug( "... source chain name is " ) +
            cc.attention( strMainnetName ) + "\n" );
        log.write( cc.debug( "... destination " ) + cc.notice( "TokenManager" + strTokenSuffixUC ) +
            cc.debug( " address is " ) + cc.notice( sc.joABI["token_manager_" +
            strTokenSuffixLC + "_address"] ) + "\n" );
    }
    const contractTokenManager = new owaspUtils.ethersMod.ethers.Contract(
        sc.joABI["token_manager_" + strTokenSuffixLC + "_address"],
        sc.joABI["token_manager_" + strTokenSuffixLC + "_abi"],
        sc.ethersProvider
    );
    for( let idxAttempt = 0; idxAttempt < cntAttempts; ++ idxAttempt ) {
        if( log.verboseGet() >= log.verboseReversed().information ) {
            log.write( cc.debug( "Discovering " ) + cc.notice( strTokenSuffixUC ) +
                cc.debug( " step " ) + cc.info( idxAttempt ) + cc.debug( "..." ) + "\n" );
        }
        if( gMillisecondsToSleepStepWaitForClonedTokenToAppear > 0 )
            await imaHelperAPIs.sleep( gMillisecondsToSleepStepWaitForClonedTokenToAppear );
        const addressOnSChain =
            await contractTokenManager.callStatic[
                "clones" + cc.capitalizeFirstLetter( strTokenSuffixLCshort )](
                sc.ethersMod.ethers.utils.id( strMainnetName ),
                tokensMN.joABI[strTokenSuffixUC + "_address"],
                { from: addressCallFrom }
            );
        if( addressOnSChain != "0x0000000000000000000000000000000000000000" ) {
            ts1 = cc.timestampHR();
            if( log.verboseGet() >= log.verboseReversed().information ) {
                log.write( cc.success( "Done, duration is " ) +
                    cc.info( cc.getDurationString( ts0, ts1 ) ) + "\n" );
                log.write( cc.success( "Discovered " ) + cc.notice( strTokenSuffixUC ) +
                    cc.success( " instantiated on S-Chain " ) + cc.attention( sc.chainName ) +
                    cc.success( " at address " ) + cc.notice( addressOnSChain ) + "\n" );
            }
            return addressOnSChain;
        }
    }
    ts1 = cc.timestampHR();
    const strError =
        cc.error( "Failed to discover " ) + cc.notice( strTokenSuffixUC ) +
        cc.error( " instantiated on S-Chain " ) + cc.attention( sc.chainName );
    if( log.verboseGet() >= log.verboseReversed().error )
        log.write( strError + "\n" );
    throw new Error( strError );
}

export async function waitForClonedTokenAppearErc20(
    sc, tokenERC20SC, joAccountSC, tokensMN, strMainnetName
) {
    if( "abi" in tokenERC20SC && typeof tokenERC20SC.abi == "object" &&
        "address" in tokenERC20SC && typeof tokenERC20SC.address == "string"
    ) {
        if( log.verboseGet() >= log.verboseReversed().warning ) {
            log.write( cc.warning( "Skipping automatic " ) + cc.notice( "ERC20" ) +
                cc.warning( " instantiation discovery, already done before" ) + "\n" );
        }
        return;
    }
    const addressCallFrom = joAccountSC.address();
    const addressOnSChain =
        await waitForClonedTokenToAppear(
            sc, "erc20", addressCallFrom, 40, tokensMN, strMainnetName );
    tokenERC20SC.abi = JSON.parse( JSON.stringify( tokensMN.joABI.ERC20_abi ) );
    tokenERC20SC.address = "" + addressOnSChain;
}

export async function waitForClonedTokenAppearErc721(
    sc, tokenERC721SC, joAccountSC, tokensMN, strMainnetName
) {
    if( "abi" in tokenERC721SC && typeof tokenERC721SC.abi == "object" &&
        "address" in tokenERC721SC && typeof tokenERC721SC.address == "string"
    ) {
        if( log.verboseGet() >= log.verboseReversed().warning ) {
            log.write( cc.warning( "Skipping automatic " ) + cc.notice( "ERC721" ) +
                cc.warning( "instantiation discovery, already done before" ) + "\n" );
        }
        return;
    }
    const addressCallFrom = joAccountSC.address();
    const addressOnSChain =
        await waitForClonedTokenToAppear(
            sc, "erc721", addressCallFrom, 40, tokensMN, strMainnetName );
    tokenERC721SC.abi = JSON.parse( JSON.stringify( tokensMN.joABI.ERC721_abi ) );
    tokenERC721SC.address = "" + addressOnSChain;
}

export async function waitForClonedTokenAppearErc721WithMetadata(
    sc, tokenERC721SC, joAccountSC, tokensMN, strMainnetName
) {
    if( "abi" in tokenERC721SC && typeof tokenERC721SC.abi == "object" &&
        "address" in tokenERC721SC && typeof tokenERC721SC.address == "string"
    ) {
        if( log.verboseGet() >= log.verboseReversed().warning ) {
            log.write( cc.warning( "Skipping automatic " ) + cc.notice( "ERC721_with_metadata" ) +
                cc.warning( " instantiation discovery, already done before" ) + "\n" );
        }
        return;
    }
    const addressCallFrom = joAccountSC.address();
    const addressOnSChain =
        await waitForClonedTokenToAppear(
            sc, "erc721_with_metadata", addressCallFrom, 40, tokensMN, strMainnetName );
    tokenERC721SC.abi = JSON.parse( JSON.stringify( tokensMN.joABI.ERC721_with_metadata_abi ) );
    tokenERC721SC.address = "" + addressOnSChain;
}

export async function waitForClonedTokenAppearErc1155(
    sc, tokenERC1155SC, joAccountSC, tokensMN, strMainnetName
) {
    if( "abi" in tokenERC1155SC && typeof tokenERC1155SC.abi == "object" &&
        "address" in tokenERC1155SC && typeof tokenERC1155SC.address == "string"
    ) {
        if( log.verboseGet() >= log.verboseReversed().warning ) {
            log.write( cc.warning( "Skipping automatic " ) + cc.notice( "ERC1155" ) +
                cc.warning( " instantiation discovery, already done before" ) + "\n" );
        }
        return;
    }
    const addressCallFrom = joAccountSC.address();
    const addressOnSChain =
        await waitForClonedTokenToAppear(
            sc, "erc1155", addressCallFrom, 40, tokensMN, strMainnetName );
    tokenERC1155SC.abi = JSON.parse( JSON.stringify( tokensMN.joABI.ERC1155_abi ) );
    tokenERC1155SC.address = "" + addressOnSChain;
}

export function hexToBytes( strHex, isInversiveOrder ) { // convert a hex string to a byte array
    isInversiveOrder = !!(
        ( isInversiveOrder != null && isInversiveOrder != undefined && isInversiveOrder )
    );
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
        return arrBytes.reverse();
    return arrBytes;
}

export function bytesToHex( arrBytes, isInversiveOrder ) { // convert a byte array to a hex string
    isInversiveOrder = !!(
        ( isInversiveOrder != null && isInversiveOrder != undefined && isInversiveOrder )
    );
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

export function bytesAlignLeftWithZeroes( arrBytes, cntMin ) {
    if( arrBytes.length >= cntMin )
        return arrBytes;
    const cntNewZeros = cntMin - arrBytes.length;
    // By default Uint8Array, Uint16Array and Uint32Array classes keep zeros as it's values.
    const arrNewZeros = new Uint8Array( cntNewZeros );
    arrBytes = bytesConcat( arrNewZeros, arrBytes );
    return arrBytes;
}

export function bytesAlignRightWithZeroes( arrBytes, cntMin ) {
    if( arrBytes.length >= cntMin )
        return arrBytes;
    const cntNewZeros = cntMin - arrBytes.length;
    // By default Uint8Array, Uint16Array and Uint32Array classes keep zeros as it's values.
    const arrNewZeros = new Uint8Array( cntNewZeros );
    arrBytes = bytesConcat( arrBytes, arrNewZeros );
    return arrBytes;
}

export function concatTypedArrays( a, b ) { // a, b TypedArray of same type
    if( typeof a == "string" )
        a = hexToBytes( a );
    if( typeof b == "string" )
        b = hexToBytes( b );
    const c = new ( a.constructor )( a.length + b.length );
    c.set( a, 0 );
    c.set( b, a.length );
    return c;
}

export function concatByte( ui8a, byte ) {
    const b = new Uint8Array( 1 );
    b[0] = byte;
    return concatTypedArrays( ui8a, b );
}

export function bytesConcat( a1, a2 ) {
    a1 = a1 || new Uint8Array();
    a2 = a2 || new Uint8Array();
    return concatTypedArrays( a1, a2 );
}

export function toBuffer( ab ) {
    return Buffer.from( new Uint8Array( ab ) );
}

export function discoverCoinNameInJSON( jo ) {
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

export function checkKeyExistInABI( strName, strFile, joABI, strKey, isExitOnError ) {
    if( isExitOnError == null || isExitOnError == undefined )
        isExitOnError = true;
    try {
        if( strKey in joABI )
            return true;
    } catch ( err ) {
    }
    if( isExitOnError ) {
        if( log.verboseGet() >= log.verboseReversed().fatal ) {
            log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( "Loaded " ) +
                cc.warning( strName ) + cc.error( " ABI JSON file " ) + cc.info( strFile ) +
                cc.error( " does not contain needed key " ) + cc.warning( strKey ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
        process.exit( 126 );
    }
    return false;
}

export function checkKeysExistInABI( strName, strFile, joABI, arrKeys, isExitOnError ) {
    const cnt = arrKeys.length;
    for( let i = 0; i < cnt; ++i ) {
        const strKey = arrKeys[i];
        if( ! checkKeyExistInABI( strName, strFile, joABI, strKey, isExitOnError ) )
            return false;
    }
    return true;
}

export function composeSChainNodeUrl( joNode ) {
    if( "ip" in joNode && typeof joNode.ip === "string" && joNode.ip.length > 0 ) {
        if( "httpRpcPort" in joNode &&
            typeof joNode.httpRpcPort === "number" &&
            joNode.httpRpcPort > 0 )
            return "http://" + joNode.ip + ":" + joNode.httpRpcPort;
        if( "wsRpcPort" in joNode &&
            typeof joNode.wsRpcPort === "number" &&
            joNode.wsRpcPort > 0 )
            return "ws://" + joNode.ip + ":" + joNode.wsRpcPort;
        if( "httpsRpcPort" in joNode &&
            typeof joNode.httpsRpcPort === "number" &&
            joNode.httpsRpcPort > 0 )
            return "https://" + joNode.ip + ":" + joNode.httpsRpcPort;
        if( "wssRpcPort" in joNode &&
            typeof joNode.wssRpcPort === "number" &&
            joNode.wssRpcPort > 0 )
            return "wss://" + joNode.ip + ":" + joNode.wssRpcPort;
    }
    if( "ip6" in joNode && typeof joNode.ip6 === "string" &&
    joNode.ip6.length > 0 ) {
        if( "httpRpcPort6" in joNode &&
            typeof joNode.httpRpcPort6 === "number" &&
            joNode.httpRpcPort6 > 0 )
            return "http://[" + joNode.ip6 + "]:" + joNode.httpRpcPort6;
        if( "wsRpcPort6" in joNode &&
            typeof joNode.wsRpcPort6 === "number" &&
            joNode.wsRpcPort6 > 0 )
            return "ws://[" + joNode.ip6 + "]:" + joNode.wsRpcPort6;
        if( "httpsRpcPort6" in joNode &&
            typeof joNode.httpsRpcPort6 === "number" &&
            joNode.httpsRpcPort6 > 0 )
            return "https://[" + joNode.ip6 + "]:" + joNode.httpsRpcPort6;
        if( "wssRpcPort6" in joNode &&
            typeof joNode.wssRpcPort6 === "number" &&
            joNode.wssRpcPort6 > 0 )
            return "wss://[" + joNode.ip6 + "]:" + joNode.wssRpcPort6;
    }
    return "";
}

export function composeImaAgentNodeUrl( joNode, isThisNode ) {
    let nPort = -1;
    if( "imaAgentRpcPort" in joNode &&
        typeof joNode.imaAgentRpcPort === "number" &&
        joNode.imaAgentRpcPort > 0
    )
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
    if( nPort < 0 &&
        "httpRpcPort" in joNode &&
        typeof joNode.httpRpcPort === "number" &&
        joNode.httpRpcPort > 0
    )
        nPort = joNode.httpRpcPort - 3 + 10;
    if( nPort < 0 &&
        "wsRpcPort" in joNode &&
        typeof joNode.wsRpcPort === "number" &&
        joNode.wsRpcPort > 0
    )
        nPort = joNode.wsRpcPort - 2 + 10;
    if( nPort < 0 &&
        "httpsRpcPort" in joNode &&
        typeof joNode.httpsRpcPort === "number" &&
        joNode.httpsRpcPort > 0
    )
        nPort = joNode.httpsRpcPort - 8 + 10;
    if( nPort < 0 &&
        "wssRpcPort" in joNode &&
        typeof joNode.wssRpcPort === "number" &&
        joNode.wssRpcPort > 0
    )
        nPort = joNode.wssRpcPort - 7 + 10;
    if( nPort > 0 ) {
        const strNodeIP = isThisNode ? "127.0.0.1" : joNode.ip;
        return "http://" + strNodeIP + ":" + nPort;
    }
    return "";
}
