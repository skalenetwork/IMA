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
 * @file bls.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as fs from "fs";
import * as cc from "../npms/skale-cc/cc.mjs";
import * as log from "../npms/skale-log/log.mjs";
import * as owaspUtils from "../npms/skale-owasp/owasp-utils.mjs";
import * as child_process from "child_process";
import * as rpcCall from "./rpc-call.mjs";
import * as shell from "shelljs";
import * as imaUtils from "./utils.mjs";
import * as hashing from "js-sha3";
const keccak256 = hashing.default.keccak256;

const sleep = ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

const g_secondsMessageVerifySendTimeout = 2 * 60;

async function with_timeout( strDescription, promise, seconds ) {
    strDescription = strDescription || "with_timeout()";
    let result_err = null, isComplete = false;
    promise.catch( function( err ) {
        isComplete = true;
        result_err = new Error( strDescription + "error: " + owaspUtils.extract_error_message( err ) );
    } ).finally( function() {
        isComplete = true;
    } );
    for( let idxWaitStep = 0; idxWaitStep < seconds; ++ idxWaitStep ) {
        if( isComplete )
            break;
        await sleep( 1000 );
    }
    if( result_err )
        throw result_err;
    if( ! isComplete )
        throw new Error( strDescription + " reached limit of " + seconds + " second(s)" );
};

function discover_bls_threshold( joSChainNetworkInfo ) {
    joSChainNetworkInfo = joSChainNetworkInfo || imaState.joSChainNetworkInfo;
    if( ! joSChainNetworkInfo )
        return -1;
    const jarrNodes = joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++i ) {
        const joNode = jarrNodes[i];
        if( joNode && "imaInfo" in joNode && typeof joNode.imaInfo === "object" &&
            "t" in joNode.imaInfo && typeof joNode.imaInfo.t === "number" &&
            joNode.imaInfo.t > 0
        )
            return joNode.imaInfo.t;
    }
    return -1;
}

function discover_bls_participants( joSChainNetworkInfo ) {
    joSChainNetworkInfo = joSChainNetworkInfo || imaState.joSChainNetworkInfo;
    if( ! joSChainNetworkInfo )
        return -1;
    const jarrNodes = joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++i ) {
        const joNode = jarrNodes[i];
        if( joNode && "imaInfo" in joNode && typeof joNode.imaInfo === "object" &&
            "n" in joNode.imaInfo && typeof joNode.imaInfo.n === "number" &&
            joNode.imaInfo.n > 0
        )
            return joNode.imaInfo.n;
    }
    return -1;
}

function discover_public_key_by_index( nNodeIndex, joSChainNetworkInfo ) {
    joSChainNetworkInfo = joSChainNetworkInfo || imaState.joSChainNetworkInfo;
    const jarrNodes = joSChainNetworkInfo.network;
    const joNode = jarrNodes[nNodeIndex];
    if( joNode && "imaInfo" in joNode && typeof joNode.imaInfo === "object" &&
        "BLSPublicKey0" in joNode.imaInfo && typeof joNode.imaInfo.BLSPublicKey0 === "string" && joNode.imaInfo.BLSPublicKey0.length > 0 &&
        "BLSPublicKey1" in joNode.imaInfo && typeof joNode.imaInfo.BLSPublicKey1 === "string" && joNode.imaInfo.BLSPublicKey1.length > 0 &&
        "BLSPublicKey2" in joNode.imaInfo && typeof joNode.imaInfo.BLSPublicKey2 === "string" && joNode.imaInfo.BLSPublicKey2.length > 0 &&
        "BLSPublicKey3" in joNode.imaInfo && typeof joNode.imaInfo.BLSPublicKey3 === "string" && joNode.imaInfo.BLSPublicKey3.length > 0
    ) {
        return {
            BLSPublicKey0: joNode.imaInfo.BLSPublicKey0,
            BLSPublicKey1: joNode.imaInfo.BLSPublicKey1,
            BLSPublicKey2: joNode.imaInfo.BLSPublicKey2,
            BLSPublicKey3: joNode.imaInfo.BLSPublicKey3
        };
    }
    return null;
}

function discover_common_public_key( joSChainNetworkInfo ) {
    joSChainNetworkInfo = joSChainNetworkInfo || imaState.joSChainNetworkInfo;
    const jarrNodes = joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++i ) {
        const joNode = jarrNodes[i];
        if( joNode && "imaInfo" in joNode && typeof joNode.imaInfo === "object" &&
            "commonBLSPublicKey0" in joNode.imaInfo && typeof joNode.imaInfo.commonBLSPublicKey0 === "string" && joNode.imaInfo.commonBLSPublicKey0.length > 0 &&
            "commonBLSPublicKey1" in joNode.imaInfo && typeof joNode.imaInfo.commonBLSPublicKey1 === "string" && joNode.imaInfo.commonBLSPublicKey1.length > 0 &&
            "commonBLSPublicKey2" in joNode.imaInfo && typeof joNode.imaInfo.commonBLSPublicKey2 === "string" && joNode.imaInfo.commonBLSPublicKey2.length > 0 &&
            "commonBLSPublicKey3" in joNode.imaInfo && typeof joNode.imaInfo.commonBLSPublicKey3 === "string" && joNode.imaInfo.commonBLSPublicKey3.length > 0
        ) {
            return {
                commonBLSPublicKey0: joNode.imaInfo.commonBLSPublicKey0,
                commonBLSPublicKey1: joNode.imaInfo.commonBLSPublicKey1,
                commonBLSPublicKey2: joNode.imaInfo.commonBLSPublicKey2,
                commonBLSPublicKey3: joNode.imaInfo.commonBLSPublicKey3
            };
        }
    }
    return null;
}

function hexPrepare( strHex, isInvertBefore, isInvertAfter ) {
    if( isInvertBefore == undefined )
        isInvertBefore = true;
    if( isInvertAfter == undefined )
        isInvertAfter = true;
    let arrBytes = imaUtils.hexToBytes( strHex );
    if( isInvertBefore )
        arrBytes = imaUtils.invertArrayItemsLR( arrBytes );
    arrBytes = imaUtils.bytesAlignLeftWithZeroes( arrBytes, 32 );
    if( isInvertAfter )
        arrBytes = imaUtils.invertArrayItemsLR( arrBytes );
    return arrBytes;
}

function s2ha( s ) {
    const str_u256 = owaspUtils.ethersMod.ethers.utils.id( s );
    return hexPrepare( str_u256, true, true );
}

function a2ha( arrBytes ) {
    return owaspUtils.ensure_starts_with_0x( keccak256( arrBytes ) );
}

function keccak256_message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName ) {
    let arrBytes = s2ha( strFromChainName );
    arrBytes = imaUtils.bytesConcat( arrBytes, hexPrepare( "0x" + nIdxCurrentMsgBlockStart.toString( 16 ), false, false ) );
    arrBytes = a2ha( arrBytes );
    let i = 0; const cnt = jarrMessages.length;
    for( i = 0; i < cnt; ++i ) {
        const joMessage = jarrMessages[i];
        //
        let bytesSender = imaUtils.hexToBytes( joMessage.sender );
        // bytesSender = imaUtils.invertArrayItemsLR( bytesSender );
        bytesSender = imaUtils.bytesAlignLeftWithZeroes( bytesSender, 32 );
        // bytesSender = imaUtils.invertArrayItemsLR( bytesSender );
        arrBytes = imaUtils.bytesConcat( arrBytes, bytesSender );
        //
        let bytesDestinationContract = imaUtils.hexToBytes( joMessage.destinationContract );
        // bytesDestinationContract = imaUtils.invertArrayItemsLR( bytesDestinationContract );
        bytesDestinationContract = imaUtils.bytesAlignLeftWithZeroes( bytesDestinationContract, 32 );
        // bytesDestinationContract = imaUtils.invertArrayItemsLR( bytesDestinationContract );
        arrBytes = imaUtils.bytesConcat( arrBytes, bytesDestinationContract );
        //
        const bytesData = imaUtils.hexToBytes( joMessage.data );
        // bytesData = imaUtils.bytesAlignLeftWithZeroes( bytesData, 32 );
        // bytesData = imaUtils.invertArrayItemsLR( bytesData ); // do not invert byte order data field (see SKALE-3554 for details)
        arrBytes = imaUtils.bytesConcat( arrBytes, bytesData );
        // console.log( "3 ---------------", "0x" + imaUtils.bytesToHex( arrBytes, false ) );
        //
        // arrBytes = imaUtils.invertArrayItemsLR( arrBytes );
        arrBytes = a2ha( arrBytes );
        // console.log( "4 ---------------", "0x" + imaUtils.bytesToHex( arrBytes, false ) );
    }
    return "0x" + imaUtils.bytesToHex( arrBytes, false );
}

// const strHashExpected = "0x3094d655630537e78650506931ca36191bc2d4a85ab3216632f5bf107265c8ea".toLowerCase(), strHashComputed =
// keccak256_message(
//     [ {
//         "sender": "0x0000000000000000000000000000000000000001",
//         "destinationContract": "0x0000000000000000000000000000000000000002",
//         "data": "0x030405" // 0x010203"
//     } ],
//     6,
//     "d2"
// ).toLowerCase();
// console.log( "----------------- computed.....", strHashComputed );
// console.log( "----------------- expected.....", strHashExpected );
// console.log( "----------------- equal........", ( strHashComputed == strHashExpected ) ? "yes" : "no" );
// process.exit( 0 );

// const strHashComputed = keccak256_message( [
//     {
//         sender: "0xAe79233541427BC70Bd3Bfe452ca4B1c69d5a82e",
//         destinationContract: "0xd2AaA00400000000000000000000000000000000",
//         data: "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000007aa5e36aa15e93d10f4f26357c30f052dacdde5f00000000000000000000000000000000000000000000006c6b935b8bbd400000"
//     }
// ], 1, "Mainnet" ).toLowerCase();
// console.log( "----------------- computed.....", strHashComputed );
// process.exit( 0 );

export function keccak256_u256( u256, isHash ) {
    let arrBytes = new Uint8Array();
    //
    let bytes_u256 = imaUtils.hexToBytes( u256 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    bytes_u256 = imaUtils.bytesAlignLeftWithZeroes( bytes_u256, 32 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytes_u256 );
    //
    let strMessageHash = "";
    if( isHash )
        strMessageHash = owaspUtils.ensure_starts_with_0x( keccak256( arrBytes ) );
    else
        strMessageHash = "0x" + imaUtils.bytesToHex( arrBytes );
    return strMessageHash;
}

export function keccak256_pwa( nNodeNumber, strLoopWorkType, isStart, ts ) {
    let arrBytes = new Uint8Array();
    //
    let bytes_u256 = imaUtils.hexToBytes( nNodeNumber );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    bytes_u256 = imaUtils.bytesAlignLeftWithZeroes( bytes_u256, 32 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytes_u256 );
    //
    arrBytes = imaUtils.bytesConcat( arrBytes, s2ha( strLoopWorkType ) );
    //
    bytes_u256 = imaUtils.hexToBytes( isStart ? 1 : 0 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    bytes_u256 = imaUtils.bytesAlignLeftWithZeroes( bytes_u256, 32 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytes_u256 );
    //
    bytes_u256 = imaUtils.hexToBytes( ts );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    bytes_u256 = imaUtils.bytesAlignLeftWithZeroes( bytes_u256, 32 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytes_u256 );
    //
    strMessageHash = owaspUtils.ensure_starts_with_0x( keccak256( arrBytes ) );
    return strMessageHash;
}

function split_signature_share( signatureShare ) {
    const jarr = signatureShare.split( ":" );
    return {
        X: jarr[0],
        Y: jarr[1]
    };
}

function get_bls_glue_tmp_dir() {
    const strTmpDir = "/tmp/ima-bls-glue";
    shell.mkdir( "-p", strTmpDir );
    return strTmpDir;
}

function alloc_bls_tmp_action_dir() {
    const strActionDir = get_bls_glue_tmp_dir() + "/" + imaUtils.replaceAll( imaUtils.uuid(), "-", "" );
    // shell.mkdir( "-p", strActionDir );
    if( ! fs.existsSync( strActionDir ) )
        fs.mkdirSync( strActionDir , { recursive: true } );
    return strActionDir;
}

function perform_bls_glue(
    details,
    strDirection,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    arrSignResults
) {
    const strLogPrefix = cc.bright( strDirection ) + cc.debug( "/" ) + cc.info( "BLS" ) + cc.debug( "/" ) + cc.attention( "Glue" ) + cc.debug( ":" ) + " ";
    let joGlueResult = null;
    // const jarrNodes = imaState.joSChainNetworkInfo.network;
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    details.write( strLogPrefix + cc.debug( "Discovered BLS threshold is " ) + cc.info( nThreshold ) + cc.debug( "." ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Discovered number of BLS participants is " ) + cc.info( nParticipants ) + cc.debug( "." ) + "\n" );
    const strMessageHash = owaspUtils.remove_starting_0x( keccak256_message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName ) );
    details.write( strLogPrefix + cc.debug( "Message hash to sign is " ) + cc.info( strMessageHash ) + "\n" );
    // const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    details.write( strLogPrefix + cc.debug( "perform_bls_glue will work in " ) + cc.info( strActionDir ) + cc.debug( " director with " ) + cc.info( arrSignResults.length ) + cc.debug( " sign results..." ) + "\n" );
    const fnShellRestore = function() {
        // shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        // shell.cd( strActionDir );
        let strInput = "";
        let i = 0; const cnt = arrSignResults.length;
        for( i = 0; i < cnt; ++i ) {
            const jo = arrSignResults[i];
            const strPath = strActionDir + "/sign-result" + jo.index + ".json";
            details.write( strLogPrefix + cc.normal( "Saving " ) + cc.notice( strPath ) + cc.debug( " file containing " ) + cc.j( jo ) + "\n" );
            imaUtils.jsonFileSave( strPath, jo );
            strInput += " --input " + strPath;
        }
        const strGlueCommand =
            imaState.strPathBlsGlue +
            " --t " + nThreshold +
            " --n " + nParticipants +
            strInput +
            " --output " + strActionDir + "/glue-result.json";
        details.write( strLogPrefix + cc.debug( "Will execute BLS glue command:\n" ) + cc.notice( strGlueCommand ) + "\n" );
        strOutput = child_process.execSync( strGlueCommand, { cwd: strActionDir } );
        details.write( strLogPrefix + cc.debug( "BLS glue output is:\n" ) + cc.notice( strOutput ) + "\n" );
        joGlueResult = imaUtils.jsonFileLoad( strActionDir + "/glue-result.json" );
        details.write( strLogPrefix + cc.debug( "BLS glue result is: " ) + cc.j( joGlueResult ) + "\n" );
        if( "X" in joGlueResult.signature && "Y" in joGlueResult.signature ) {
            details.write( strLogPrefix + cc.success( "BLS glue success" ) + "\n" );
            joGlueResult.hashSrc = strMessageHash;
            //
            //
            //
            details.write( strLogPrefix + cc.debug( "Computing " ) + cc.info( "G1" ) + cc.debug( " hash point..." ) + "\n" );
            const strPath = strActionDir + "/hash.json";
            details.write( strLogPrefix + cc.normal( "Saving " ) + cc.notice( strPath ) + cc.debug( " file..." ) + "\n" );
            imaUtils.jsonFileSave( strPath, { message: strMessageHash } );
            const strHasG1Command =
                imaState.strPathHashG1 +
                " --t " + nThreshold +
                " --n " + nParticipants;
            details.write( strLogPrefix + cc.normal( "Will execute HashG1 command:\n" ) + cc.notice( strHasG1Command ) + "\n" );
            strOutput = child_process.execSync( strHasG1Command, { cwd: strActionDir } );
            details.write( strLogPrefix + cc.normal( "HashG1 output is:\n" ) + cc.notice( strOutput ) + "\n" );
            const joResultHashG1 = imaUtils.jsonFileLoad( strActionDir + "/g1.json" );
            details.write( strLogPrefix + cc.normal( "HashG1 result is: " ) + cc.j( joResultHashG1 ) + "\n" );
            //
            //
            //
            if( "g1" in joResultHashG1 && "hint" in joResultHashG1.g1 && "hashPoint" in joResultHashG1.g1 &&
                "X" in joResultHashG1.g1.hashPoint && "Y" in joResultHashG1.g1.hashPoint ) {
                joGlueResult.hashPoint = joResultHashG1.g1.hashPoint;
                joGlueResult.hint = joResultHashG1.g1.hint;
            } else {
                joGlueResult = null;
                throw new Error( "malformed HashG1 result: " + JSON.stringify( joResultHashG1 ) );
            }
        } else {
            const joSavedGlueResult = joGlueResult;
            joGlueResult = null;
            throw new Error( "malformed BLS glue result: " + JSON.stringify( joSavedGlueResult ) );
        }
        //
        // typical glue result is:
        // {
        //     "signature": {
        //         "X": "2533808148583356869465588922364792219279924240245650719832918161014673583859",
        //         "Y": "2900553917645502192745899163584745093808998719667605626180761629013549672201"
        //     }
        // }
        //
        fnShellRestore();
    } catch ( err ) {
        const s1 = strLogPrefix + cc.fatal( "BLS glue CRITICAL ERROR:" ) + cc.error( " error description is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
        const s2 = strLogPrefix + cc.error( "BLS glue output is:\n" ) + cc.notice( strOutput ) + "\n";
        log.write( s1 );
        details.write( s1 );
        log.write( s2 );
        details.write( s2 );
        fnShellRestore();
        joGlueResult = null;
    }
    return joGlueResult;
}

function perform_bls_glue_u256( details, u256, arrSignResults ) {
    const strLogPrefix = cc.info( "BLS" ) + cc.debug( "/" ) + cc.attention( "Glue" ) + cc.debug( ":" ) + " ";
    let joGlueResult = null;
    // const jarrNodes = imaState.joSChainNetworkInfo.network;
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    details.write( strLogPrefix + cc.debug( "Discovered BLS threshold is " ) + cc.info( nThreshold ) + cc.debug( "." ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Discovered number of BLS participants is " ) + cc.info( nParticipants ) + cc.debug( "." ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Original long message is " ) + cc.info( keccak256_u256( u256, false ) ) + "\n" );
    const strMessageHash = keccak256_u256( u256, true );
    details.write( strLogPrefix + cc.debug( "Message hash to sign is " ) + cc.info( strMessageHash ) + "\n" );
    // const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    details.write( strLogPrefix + cc.debug( "perform_bls_glue_u256 will work in " ) + cc.info( strActionDir ) + cc.debug( " director with " ) + cc.info( arrSignResults.length ) + cc.debug( " sign results..." ) + "\n" );
    const fnShellRestore = function() {
        // shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        // shell.cd( strActionDir );
        let strInput = "";
        let i = 0; const cnt = arrSignResults.length;
        for( i = 0; i < cnt; ++i ) {
            const jo = arrSignResults[i];
            const strPath = strActionDir + "/sign-result" + jo.index + ".json";
            details.write( strLogPrefix + cc.normal( "Saving " ) + cc.notice( strPath ) + cc.debug( " file..." ) + "\n" );
            imaUtils.jsonFileSave( strPath, jo );
            strInput += " --input " + strPath;
        }
        const strGlueCommand =
            imaState.strPathBlsGlue +
            " --t " + nThreshold +
            " --n " + nParticipants +
            strInput +
            " --output " + strActionDir + "/glue-result.json";
        details.write( strLogPrefix + cc.normal( "Will execute BLS glue command:\n" ) + cc.notice( strGlueCommand ) + "\n" );
        strOutput = child_process.execSync( strGlueCommand, { cwd: strActionDir } );
        details.write( strLogPrefix + cc.normal( "BLS glue output is:\n" ) + cc.notice( strOutput ) + "\n" );
        joGlueResult = imaUtils.jsonFileLoad( strActionDir + "/glue-result.json" );
        details.write( strLogPrefix + cc.normal( "BLS glue result is: " ) + cc.j( joGlueResult ) + "\n" );
        if( "X" in joGlueResult.signature && "Y" in joGlueResult.signature ) {
            details.write( strLogPrefix + cc.success( "BLS glue success" ) + "\n" );
            joGlueResult.hashSrc = strMessageHash;
            //
            //
            //
            details.write( strLogPrefix + cc.debug( "Computing " ) + cc.info( "G1" ) + cc.debug( " hash point..." ) + "\n" );
            const strPath = strActionDir + "/hash.json";
            details.write( strLogPrefix + cc.normal( "Saving " ) + cc.notice( strPath ) + cc.debug( " file..." ) + "\n" );
            imaUtils.jsonFileSave( strPath, { message: strMessageHash } );
            const strHasG1Command =
                imaState.strPathHashG1 +
                " --t " + nThreshold +
                " --n " + nParticipants;
            details.write( strLogPrefix + cc.normal( "Will execute HashG1 command:\n" ) + cc.notice( strHasG1Command ) + "\n" );
            strOutput = child_process.execSync( strHasG1Command, { cwd: strActionDir } );
            details.write( strLogPrefix + cc.normal( "HashG1 output is:\n" ) + cc.notice( strOutput ) + "\n" );
            const joResultHashG1 = imaUtils.jsonFileLoad( strActionDir + "/g1.json" );
            details.write( strLogPrefix + cc.normal( "HashG1 result is: " ) + cc.j( joResultHashG1 ) + "\n" );
            //
            //
            //
            if( "g1" in joResultHashG1 && "hint" in joResultHashG1.g1 && "hashPoint" in joResultHashG1.g1 &&
                "X" in joResultHashG1.g1.hashPoint && "Y" in joResultHashG1.g1.hashPoint ) {
                joGlueResult.hashPoint = joResultHashG1.g1.hashPoint;
                joGlueResult.hint = joResultHashG1.g1.hint;
            } else {
                joGlueResult = null;
                throw new Error( "malformed HashG1 result: " + JSON.stringify( joResultHashG1 ) );
            }
        } else {
            const joSavedGlueResult = joGlueResult;
            joGlueResult = null;
            throw new Error( "malformed BLS glue result: " + JSON.stringify( joSavedGlueResult ) );
        }
        //
        // typical glue result is:
        // {
        //     "signature": {
        //         "X": "2533808148583356869465588922364792219279924240245650719832918161014673583859",
        //         "Y": "2900553917645502192745899163584745093808998719667605626180761629013549672201"
        //     }
        // }
        //
        fnShellRestore();
    } catch ( err ) {
        const s1 = strLogPrefix + cc.fatal( "BLS glue CRITICAL ERROR:" ) + cc.error( " error description is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
        const s2 = strLogPrefix + cc.error( "BLS glue output is:\n" ) + cc.notice( strOutput ) + "\n";
        log.write( s1 );
        details.write( s1 );
        log.write( s2 );
        details.write( s2 );
        fnShellRestore();
        joGlueResult = null;
    }
    return joGlueResult;
}

function perform_bls_verify_i(
    details,
    strDirection,
    nZeroBasedNodeIndex,
    joResultFromNode,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    joPublicKey
) {
    if( !joResultFromNode )
        return true;
    const strLogPrefix = cc.bright( strDirection ) + cc.debug( "/" ) + cc.info( "BLS" ) + cc.debug( "/" ) + cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) + cc.debug( ":" ) + " ";
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    // const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        // shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        // shell.cd( strActionDir );
        details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.debug( " - first message nonce is " ) + cc.info( nIdxCurrentMsgBlockStart ) + "\n" );
        details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.debug( " - first source chain name is " ) + cc.info( strFromChainName ) + "\n" );
        details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.debug( " - messages array " ) + cc.j( jarrMessages ) + "\n" );
        const strMessageHash = owaspUtils.remove_starting_0x( keccak256_message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName ) );
        details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.debug( " - hashed verify message is " ) + cc.info( strMessageHash ) + "\n" );
        const joMsg = {
            message: strMessageHash
        };
        details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.debug( " - composed  " ) + cc.j( joMsg ) + cc.debug( " composed from " ) + cc.j( jarrMessages ) + cc.debug( " using glue " ) + cc.j( joResultFromNode ) + cc.debug( " and public key " ) + cc.j( joPublicKey ) + "\n" );
        const strSignResultFileName = strActionDir + "/sign-result" + nZeroBasedNodeIndex + ".json";
        // console.log( "--- joResultFromNode ---", JSON.stringify( joResultFromNode ) );
        // console.log( "--- joMsg ---", JSON.stringify( joMsg ) );
        // console.log( "--- joPublicKey ---", JSON.stringify( joPublicKey ) );
        imaUtils.jsonFileSave( strSignResultFileName, joResultFromNode );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        imaUtils.jsonFileSave( strActionDir + "/BLS_keys" + nZeroBasedNodeIndex + ".json", joPublicKey );
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --j " + nZeroBasedNodeIndex +
            " --input " + strSignResultFileName
            ;
        details.write( strLogPrefix + cc.normal( "Will execute node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.normal( " BLS verify command:\n" ) + cc.notice( strVerifyCommand ) + "\n" );
        strOutput = child_process.execSync( strVerifyCommand, { cwd: strActionDir } );
        details.write( strLogPrefix + cc.normal( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.normal( " verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        details.write( strLogPrefix + cc.success( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.success( " verify success" ) + "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify error:" ) + cc.warning( " error description is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
        const s2 = strLogPrefix + cc.error( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify output is:\n" ) + cc.notice( strOutput ) + "\n";
        log.write( s1 );
        details.write( s1 );
        log.write( s2 );
        details.write( s2 );
        fnShellRestore();
    }
    return false;
}

function perform_bls_verify_i_u256( details, nZeroBasedNodeIndex, joResultFromNode, u256, joPublicKey ) {
    if( !joResultFromNode )
        return true;
    const strLogPrefix = cc.info( "BLS" ) + cc.debug( "/" ) + cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) + cc.debug( ":" ) + " ";
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    // const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        // shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        // shell.cd( strActionDir );
        //
        const joMsg = { message: keccak256_u256( u256, true ) };
        details.write( strLogPrefix + cc.debug( "BLS u256 node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.debug( " verify message " ) + cc.j( joMsg ) + cc.debug( " composed from " ) + cc.j( u256 ) + cc.debug( " using glue " ) + cc.j( joResultFromNode ) + cc.debug( " and public key " ) + cc.j( joPublicKey ) + "\n" );
        const strSignResultFileName = strActionDir + "/sign-result" + nZeroBasedNodeIndex + ".json";
        // console.log( "--- joResultFromNode ---", JSON.stringify( joResultFromNode ) );
        // console.log( "--- joMsg ---", JSON.stringify( joMsg ) );
        // console.log( "--- joPublicKey ---", JSON.stringify( joPublicKey ) );
        imaUtils.jsonFileSave( strSignResultFileName, joResultFromNode );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        imaUtils.jsonFileSave( strActionDir + "/BLS_keys" + nZeroBasedNodeIndex + ".json", joPublicKey );
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --j " + nZeroBasedNodeIndex +
            " --input " + strSignResultFileName
            ;
        details.write( strLogPrefix + cc.normal( "Will execute node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.normal( " BLS u256 verify command:\n" ) + cc.notice( strVerifyCommand ) + "\n" );
        strOutput = child_process.execSync( strVerifyCommand, { cwd: strActionDir } );
        details.write( strLogPrefix + cc.normal( "BLS u256 node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.normal( " verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        details.write( strLogPrefix + cc.success( "BLS u256 node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.success( " verify success" ) + "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " BLS u256 node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify error:" ) + cc.warning( " error description is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
        const s2 = strLogPrefix + cc.error( "CRITICAL ERROR:" ) + cc.error( " BLS u256 node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify output is:\n" ) + cc.notice( strOutput ) + "\n";
        log.write( s1 );
        details.write( s1 );
        log.write( s2 );
        details.write( s2 );
        fnShellRestore();
    }
    return false;
}

function perform_bls_verify(
    details,
    strDirection,
    joGlueResult,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    joCommonPublicKey
) {
    if( !joGlueResult )
        return true;
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    // const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        // shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    const strLogPrefix = cc.bright( strDirection ) + cc.debug( "/" ) + cc.info( "BLS" ) + cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
    try {
        // shell.cd( strActionDir );
        log.write( strLogPrefix + cc.debug( "BLS/summary verify message - first message nonce is " ) + cc.info( nIdxCurrentMsgBlockStart ) + "\n" );
        log.write( strLogPrefix + cc.debug( "BLS/summary verify message - first source chain name is " ) + cc.info( strFromChainName ) + "\n" );
        log.write( strLogPrefix + cc.debug( "BLS/summary verify message - messages array " ) + cc.j( jarrMessages ) + "\n" );
        const strMessageHash = owaspUtils.remove_starting_0x( keccak256_message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName ) );
        details.write( strLogPrefix + cc.debug( "BLS/summary verify message - hashed verify message is " ) + cc.info( strMessageHash ) + "\n" );
        const joMsg = { message: strMessageHash };
        details.write( strLogPrefix + cc.debug( "BLS/summary verify message - composed JSON " ) + cc.j( joMsg ) + cc.debug( " from messages array " ) + cc.j( jarrMessages ) + cc.debug( " using glue " ) + cc.j( joGlueResult ) + cc.debug( " and common public key " ) + cc.j( joCommonPublicKey ) + "\n" );
        imaUtils.jsonFileSave( strActionDir + "/glue-result.json", joGlueResult );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        // let joCommonPublicKey_for_O = joCommonPublicKey;
        // const joCommonPublicKey_for_O = {
        //     commonBLSPublicKey0: joCommonPublicKey.commonBLSPublicKey1,
        //     commonBLSPublicKey1: joCommonPublicKey.commonBLSPublicKey0,
        //     commonBLSPublicKey2: joCommonPublicKey.commonBLSPublicKey3,
        //     commonBLSPublicKey3: joCommonPublicKey.commonBLSPublicKey2
        // };
        const joCommonPublicKey_for_O = {
            commonBLSPublicKey0: joCommonPublicKey.commonBLSPublicKey0,
            commonBLSPublicKey1: joCommonPublicKey.commonBLSPublicKey1,
            commonBLSPublicKey2: joCommonPublicKey.commonBLSPublicKey2,
            commonBLSPublicKey3: joCommonPublicKey.commonBLSPublicKey3
        };
        imaUtils.jsonFileSave( strActionDir + "/common_public_key.json", joCommonPublicKey_for_O );
        details.write( strLogPrefix + cc.normal( "BLS common public key for verification is:\n" ) + cc.j( joCommonPublicKey ) + "\n" );
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --input " + "./glue-result.json"
            ;
        details.write( strLogPrefix + cc.normal( "Will execute BLS/summary verify command:\n" ) + cc.notice( strVerifyCommand ) + "\n" );
        strOutput = child_process.execSync( strVerifyCommand, { cwd: strActionDir } );
        details.write( strLogPrefix + cc.normal( "BLS/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        details.write( strLogPrefix + cc.success( "BLS/summary verify success" ) + "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix + cc.fatal( "BLS/summary verify CRITICAL ERROR:" ) + cc.error( " error description is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
        const s2 = strLogPrefix + cc.error( "BLS/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n";
        log.write( s1 );
        details.write( s1 );
        log.write( s2 );
        details.write( s2 );
        fnShellRestore();
    }
    return false;
}

function perform_bls_verify_u256( details, joGlueResult, u256, joCommonPublicKey ) {
    if( !joGlueResult )
        return true;
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    // const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        // shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    const strLogPrefix = cc.info( "BLS u256" ) + cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
    try {
        // shell.cd( strActionDir );
        const joMsg = { message: keccak256_u256( u256, true ) };
        details.write( strLogPrefix + cc.debug( "BLS u256/summary verify message " ) + cc.j( joMsg ) + cc.debug( " composed from " ) + cc.j( u256 ) + cc.debug( " using glue " ) + cc.j( joGlueResult ) + cc.debug( " and common public key " ) + cc.j( joCommonPublicKey ) + "\n" );
        imaUtils.jsonFileSave( strActionDir + "/glue-result.json", joGlueResult );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        // let joCommonPublicKey_for_O = joCommonPublicKey;
        // const joCommonPublicKey_for_O = {
        //     commonBLSPublicKey0: joCommonPublicKey.commonBLSPublicKey1,
        //     commonBLSPublicKey1: joCommonPublicKey.commonBLSPublicKey0,
        //     commonBLSPublicKey2: joCommonPublicKey.commonBLSPublicKey3,
        //     commonBLSPublicKey3: joCommonPublicKey.commonBLSPublicKey2
        // };
        const joCommonPublicKey_for_O = {
            commonBLSPublicKey0: joCommonPublicKey.commonBLSPublicKey0,
            commonBLSPublicKey1: joCommonPublicKey.commonBLSPublicKey1,
            commonBLSPublicKey2: joCommonPublicKey.commonBLSPublicKey2,
            commonBLSPublicKey3: joCommonPublicKey.commonBLSPublicKey3
        };
        imaUtils.jsonFileSave( strActionDir + "/common_public_key.json", joCommonPublicKey_for_O );
        details.write( strLogPrefix + cc.normal( "BLS u256 common public key for verification is:\n" ) + cc.j( joCommonPublicKey ) + "\n" );
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --input " + "./glue-result.json"
            ;
        details.write( strLogPrefix + cc.normal( "Will execute BLS u256/summary verify command:\n" ) + cc.notice( strVerifyCommand ) + "\n" );
        strOutput = child_process.execSync( strVerifyCommand, { cwd: strActionDir } );
        details.write( strLogPrefix + cc.normal( "BLS u256/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        details.write( strLogPrefix + cc.success( "BLS u256/summary verify success" ) + "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix + cc.fatal( "BLS u256/summary verify CRITICAL ERROR:" ) + cc.error( " error description is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
        const s2 = strLogPrefix + cc.error( "BLS u256/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n";
        log.write( s1 );
        details.write( s1 );
        log.write( s2 );
        details.write( s2 );
        fnShellRestore();
    }
    return false;
}

async function check_correctness_of_messages_to_sign( details, strLogPrefix, strDirection, jarrMessages, nIdxCurrentMsgBlockStart, joExtraSignOpts ) {
    let joMessageProxy = null, joAccount = null, joChainName = null;
    if( strDirection == "M2S" ) {
        joMessageProxy = imaState.jo_message_proxy_main_net;
        joAccount = imaState.chainProperties.mn.joAccount;
        joChainName = imaState.chainProperties.sc.strChainName;
    } else if( strDirection == "S2M" ) {
        joMessageProxy = imaState.jo_message_proxy_s_chain;
        joAccount = imaState.chainProperties.sc.joAccount;
        joChainName = imaState.chainProperties.mn.strChainName;
    } else if( strDirection == "S2S" ) {
        //joMessageProxy = new w3.eth.Contract( imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_abi, imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_address );
        //joAccount = imaState.chainProperties.sc.joAccount;
        //joChainName = joExtraSignOpts.chain_id_dst;
        if( ! ( "ethersProvider" in joExtraSignOpts && joExtraSignOpts.ethersProvider ) )
            throw new Error( "CRITICAL ERROR: No provider specified in extra signing options for checking messages of directon \"" + strDirection + "\"" );
        joMessageProxy =
            new owaspUtils.ethersMod.ethers.Contract(
                imaState.joAbiPublishResult_s_chain.message_proxy_chain_address,
                imaState.joAbiPublishResult_s_chain.message_proxy_chain_abi,
                joExtraSignOpts.ethersProvider
            );
        joAccount = imaState.joAccount_s_chain;
        joChainName = joExtraSignOpts.chain_id_dst;
    } else
        throw new Error( "CRITICAL ERROR: Failed check_correctness_of_messages_to_sign() with unknown directon \"" + strDirection + "\"" );

    const strCallerAccountAddress = joAccount.address( owaspUtils.ethersMod );
    details.write(
        strLogPrefix + cc.sunny( strDirection ) + cc.debug( " message correctness validation through call to " ) +
        cc.notice( "verifyOutgoingMessageData" ) + cc.debug( " method of " ) + cc.bright( "MessageProxy" ) +
        cc.debug( " contract with address " ) + cc.notice( joMessageProxy.options.address ) +
        cc.debug( ", caller account address is " ) + cc.info( joMessageProxy.options.address ) +
        cc.debug( ", message(s) count is " ) + cc.info( jarrMessages.length ) +
        cc.debug( ", message(s) to process are " ) + cc.j( jarrMessages ) +
        cc.debug( ", first real message index is " ) + cc.info( nIdxCurrentMsgBlockStart ) +
        cc.debug( ", messsages will be sent to chain name " ) + cc.info( joChainName ) +
        cc.debug( ", caller address is " ) + cc.info( strCallerAccountAddress ) +
        "\n" );
    let cntBadMessages = 0, i = 0;
    const cnt = jarrMessages.length;
    if( strDirection == "S2M" || strDirection == "S2S" ) {
        for( i = 0; i < cnt; ++i ) {
            const joMessage = jarrMessages[i];
            const idxMessage = nIdxCurrentMsgBlockStart + i;
            try {
                details.write(
                    strLogPrefix + cc.sunny( strDirection ) +
                    cc.debug( " Will validate message " ) + cc.info( i ) + cc.debug( " of " ) + cc.info( cnt ) +
                    cc.debug( ", real message index is " ) + cc.info( idxMessage ) +
                    cc.debug( ", source contract is " ) + cc.info( joMessage.sender ) +
                    cc.debug( ", destination contract is " ) + cc.info( joMessage.destinationContract ) +
                    cc.debug( ", message data is " ) + cc.j( joMessage.data ) +
                    "\n" );
                const outgoingMessageData = {
                    dstChainHash: owaspUtils.ethersMod.ethers.utils.id( joChainName ), // dstChainHash
                    msgCounter: 0 + idxMessage,
                    srcContract: joMessage.sender,
                    dstContract: joMessage.destinationContract,
                    // to: joMessage.to,
                    // amount: strHexAmount,
                    data: joMessage.data
                };
                // details.write(
                //     cc.debug( "Outgoing message data is " ) + cc.j( outgoingMessageData ) +
                //     cc.debug( ", real message index is: " ) + cc.info( idxMessage ) +
                //     cc.debug( ", saved msgCounter is: " ) + cc.info( outgoingMessageData.msgCounter ) +
                //     "\n" );
                const isValidMessage = await joMessageProxy.callStatic.verifyOutgoingMessageData(
                    outgoingMessageData,
                    { from: strCallerAccountAddress }
                );
                details.write(
                    strLogPrefix + cc.sunny( strDirection ) +
                    cc.debug( " Got verification call result " ) + cc.tf( isValidMessage ) +
                    cc.debug( ", real message index is: " ) + cc.info( idxMessage ) +
                    cc.debug( ", saved msgCounter is: " ) + cc.info( outgoingMessageData.msgCounter ) +
                    "\n" );
                if( !isValidMessage )
                    throw new Error( "Bad message detected, message is: " + JSON.stringify( joMessage ) );
            } catch ( err ) {
                ++cntBadMessages;
                const s =
                    strLogPrefix + cc.fatal( "BAD ERROR:" ) + " " +
                    cc.sunny( strDirection ) + cc.error( " Correctness validation failed for message " ) + cc.info( idxMessage ) +
                    cc.error( " sent to " ) + cc.info( joChainName ) +
                    cc.error( ", message is: " ) + cc.j( joMessage ) +
                    cc.error( ", error information: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) +
                    "\n";
                log.write( s );
                details.write( s );
            }
        } // for( i = 0; i < cnt; ++i )
    } // if( strDirection == "S2M" || strDirection == "S2S" )
    // TODO: M2S - check events
    if( cntBadMessages > 0 ) {
        const s =
            strLogPrefix + cc.fatal( "BAD ERROR:" ) +
            cc.error( " Correctness validation failed for " ) + cc.info( cntBadMessages ) +
            cc.error( " of " ) + cc.info( cnt ) + cc.error( " message(s)" ) + "\n";
        log.write( s );
        details.write( s );
    } else
        details.write( strLogPrefix + cc.success( "Correctness validation passed for " ) + cc.info( cnt ) + cc.success( " message(s)" ) + "\n" );
}

async function do_sign_messages_impl(
    nTransferLoopCounter,
    strDirection,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    joExtraSignOpts,
    fn
) {
    let bHaveResultReportCalled = false;
    const strLogPrefix =
        cc.bright( strDirection ) + " " + cc.info( "Sign msgs via " ) +
        cc.attention( imaState.isCrossImaBlsMode ? "IMA agent" : "skaled" ) +
        cc.info( ":" ) + " ";
    const joGatheringTracker = {
        nCountReceived: 0, // including errors
        nCountErrors: 0,
        nCountSkipped: 0,
        nWaitIntervalStepMilliseconds: 100,
        nWaitIntervalStepsDone: 0,
        nWaitIntervalMaxSteps: 10 * 60 * 3 // 10 is 1 second
    };
    const arrSignResults = [];
    let cntSuccess = 0;
    let details = log.createMemoryStream( true );
    const strGatheredDetailsName = strDirection + "-" + "do_sign_messages_impl-#" + nTransferLoopCounter +
        "-" + strFromChainName + "-msg#" + nIdxCurrentMsgBlockStart;
    try {
        log.write( strLogPrefix + cc.debug( " Invoking " ) + cc.bright( strDirection ) + cc.debug( " signing messages procedure " ) + "\n" );
        details.write( strLogPrefix + cc.debug( " Invoking " ) + cc.bright( strDirection ) + cc.debug( " signing messages procedure " ) + "\n" );
        fn = fn || function() {};
        if( !( imaState.bSignMessages && imaState.strPathBlsGlue.length > 0 && imaState.joSChainNetworkInfo ) ) {
            bHaveResultReportCalled = true;
            details.write( strLogPrefix + cc.debug( "BLS message signing is " ) + cc.error( "turned off" ) +
                cc.debug( ", first real message index is: " ) + cc.info( nIdxCurrentMsgBlockStart ) +
                cc.debug( ", have " ) + cc.info( jarrMessages.length ) +
                cc.debug( " message(s) to process: " ) + cc.j( jarrMessages ) +
                "\n" );
            details.exposeDetailsTo( log, strGatheredDetailsName, false );
            details.close();
            await check_correctness_of_messages_to_sign( details, strLogPrefix, strDirection, jarrMessages, nIdxCurrentMsgBlockStart, joExtraSignOpts );
            await fn( null, jarrMessages, null );
            return;
        }
        await check_correctness_of_messages_to_sign( details, strLogPrefix, strDirection, jarrMessages, nIdxCurrentMsgBlockStart, joExtraSignOpts );
        //
        // each message in array looks like:
        // {
        //     "amount": joValues.amount,
        //     "data": joValues.data,
        //     "destinationContract": joValues.dstContract,
        //     "sender": joValues.srcContract,
        //     "to": joValues.to
        // }
        //
        // sign result looks like:
        // {
        //     "id": 1, "jsonrpc": "2.0", "result": {
        //         "signResult": {
        //             "errorMessage": "",
        //             "signatureShare": "13888409666804046853490114813821624491836407617931905586112520275264817002720:9871589266312476278322587556340871982939135237123140475925975407511373249165:0",
        //             "status": 0
        //         }
        //     }
        // }
        //
        const sequence_id = owaspUtils.remove_starting_0x( owaspUtils.ethersMod.ethers.utils.id( log.generate_timestamp_string( null, false ) ) );
        details.write( strLogPrefix +
            cc.debug( "Will sign " ) + cc.info( jarrMessages.length ) + cc.debug( " message(s)" ) +
            cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) + cc.attention( sequence_id ) +
            cc.debug( "..." ) + "\n" );
        log.write( strLogPrefix +
            cc.debug( "Will sign " ) + cc.j( jarrMessages ) + cc.debug( " message(s)" ) +
            cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) + cc.attention( sequence_id ) +
            cc.debug( "..." ) + "\n" );
        const jarrNodes = imaState.joSChainNetworkInfo.network;
        details.write( strLogPrefix + cc.debug( "Will query to sign " ) + cc.info( jarrNodes.length ) + cc.debug( " skaled node(s)..." ) + "\n" );
        const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
        const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
        details.write( strLogPrefix + cc.debug( "Discovered BLS threshold is " ) + cc.info( nThreshold ) + cc.debug( "." ) + "\n" );
        details.write( strLogPrefix + cc.debug( "Discovered number of BLS participants is " ) + cc.info( nParticipants ) + cc.debug( "." ) + "\n" );
        if( nThreshold <= 0 ) {
            bHaveResultReportCalled = true;
            details.exposeDetailsTo( log, strGatheredDetailsName, false );
            details.close();
            await fn( "signature error(1), S-Chain information was not discovered properly and BLS threshold is unknown", jarrMessages, null );
            return;
        }
        const nCountOfBlsPartsToCollect = 0 + nThreshold;
        // if( nThreshold <= 1 && nParticipants > 1 ) {
        //     details.write( strLogPrefix + cc.warning( "Minimal BLS parts number for dicovery was increased." ) + "\n" );
        //     nCountOfBlsPartsToCollect = 2;
        // }
        log.write( strLogPrefix +
            cc.debug( "Will collect " ) + cc.info( nCountOfBlsPartsToCollect ) + cc.debug( " signature(s)" ) +
            cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) + cc.attention( sequence_id ) +
            "\n" );
        details.write( strLogPrefix +
            cc.debug( "Will collect " ) + cc.info( nCountOfBlsPartsToCollect ) + cc.debug( " from " ) +
            cc.info( jarrNodes.length ) + cc.debug( " nodes" ) +
            cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) + cc.attention( sequence_id ) +
            "\n" );
        for( let i = 0; i < jarrNodes.length; ++i ) {
            cntSuccess = joGatheringTracker.nCountReceived - joGatheringTracker.nCountErrors;
            if( cntSuccess >= nCountOfBlsPartsToCollect ) {
                details.write(
                    strLogPrefix + log.generate_timestamp_string( null, true ) + " " +
                    cc.debug( "Stop invoking " ) + cc.info( "skale_imaVerifyAndSign" ) +
                    cc.debug( " for transfer from chain " ) + cc.info( fromChainName ) +
                    cc.debug( " at #" ) + cc.info( i ) +
                    cc.debug( " because successfully gathered count is reached " ) + cc.j( cntSuccess ) +
                    "\n" );
                break;
            }
            const joNode = jarrNodes[i];
            const strNodeURL = imaState.isCrossImaBlsMode
                ? imaUtils.compose_ima_agent_node_url( joNode )
                : imaUtils.compose_schain_node_url( joNode );
            const strNodeDescColorized = cc.u( strNodeURL ) + " " +
                cc.normal( "(" ) + cc.bright( i ) + cc.normal( "/" ) + cc.bright( jarrNodes.length ) + cc.normal( ", ID " ) + cc.info( joNode.nodeID ) + cc.normal( ")" ) +
                cc.normal( ", " ) + cc.notice( "sequence ID" ) + cc.normal( " is " ) + cc.attention( sequence_id );
            const rpcCallOpts = null;
            /*await*/ rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
                if( err ) {
                    ++joGatheringTracker.nCountReceived; // including errors
                    ++joGatheringTracker.nCountErrors;
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                        cc.error( " failed, RPC call was not created, error is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) +
                        cc.error( ", " ) + cc.notice( "sequence ID" ) + cc.error( " is " ) + cc.attention( sequence_id ) +
                        "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    if( joCall )
                        await joCall.disconnect();
                    return;
                }
                let targetChainName = "";
                let fromChainName = "";
                let targetChainID = -4;
                let fromChainID = -4;
                // let targetChainURL = "";
                // let fromChainURL = "";
                if( strDirection == "M2S" ) {
                    targetChainName = "" + ( imaState.chainProperties.sc.strChainName ? imaState.chainProperties.sc.strChainName : "" );
                    fromChainName = "" + ( imaState.chainProperties.mn.strChainName ? imaState.chainProperties.mn.strChainName : "" );
                    targetChainID = imaState.chainProperties.sc.cid;
                    fromChainID = imaState.chainProperties.mn.cid;
                } else if( strDirection == "S2M" ) {
                    targetChainName = "" + ( imaState.chainProperties.mn.strChainName ? imaState.chainProperties.mn.strChainName : "" );
                    fromChainName = "" + ( imaState.chainProperties.sc.strChainName ? imaState.chainProperties.sc.strChainName : "" );
                    targetChainID = imaState.chainProperties.mn.cid;
                    fromChainID = imaState.chainProperties.sc.cid;
                } else if( strDirection == "S2S" ) {
                    targetChainName = "" + joExtraSignOpts.chain_id_dst;
                    fromChainName = "" + joExtraSignOpts.chain_id_src;
                    targetChainID = joExtraSignOpts.cid_dst;
                    fromChainID = joExtraSignOpts.cid_src;
                } else {
                    await joCall.disconnect();
                    throw new Error( "CRITICAL ERROR: Failed do_sign_messages_impl() with unknown directon \"" + strDirection + "\"" );
                }

                const joParams = {
                    direction: "" + strDirection,
                    startMessageIdx: nIdxCurrentMsgBlockStart,
                    dstChainName: targetChainName,
                    srcChainName: fromChainName,
                    dstChainID: targetChainID,
                    srcChainID: fromChainID,
                    messages: jarrMessages,
                    // fromChainURL: fromChainURL,
                    // targetChainURL: targetChainURL,
                    qa: {
                        skaled_no: 0 + i,
                        sequence_id: "" + sequence_id,
                        ts: "" + log.generate_timestamp_string( null, false )
                    }
                };
                details.write(
                    strLogPrefix + log.generate_timestamp_string( null, true ) + " " +
                    cc.debug( "Will invoke " ) + cc.info( "skale_imaVerifyAndSign" ) +
                    cc.debug( " for transfer from chain " ) + cc.info( fromChainName ) +
                    cc.debug( " to chain " ) + cc.info( targetChainName ) +
                    cc.debug( " with params " ) + cc.j( joParams ) +
                    cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) + cc.attention( sequence_id ) +
                    "\n" );
                await joCall.call( {
                    method: "skale_imaVerifyAndSign",
                    params: joParams
                }, async function( joIn, joOut, err ) {
                    ++joGatheringTracker.nCountReceived; // including errors
                    if( err ) {
                        ++joGatheringTracker.nCountErrors;
                        const strErrorMessage =
                            strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                            cc.error( " failed, RPC call reported error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) +
                            cc.error( ", " ) + cc.notice( "sequence ID" ) + cc.error( " is " ) + cc.attention( sequence_id ) +
                            "\n";
                        log.write( strErrorMessage );
                        details.write( strErrorMessage );
                        await joCall.disconnect();
                        return;
                    }
                    details.write(
                        strLogPrefix + log.generate_timestamp_string( null, true ) + " " +
                        cc.debug( "Got answer from " ) + cc.info( "skale_imaVerifyAndSign" ) +
                        cc.debug( " for transfer from chain " ) + cc.info( fromChainName ) +
                        cc.debug( " to chain " ) + cc.info( targetChainName ) +
                        cc.debug( " with params " ) + cc.j( joParams ) +
                        cc.debug( ", answer is " ) + cc.j( joOut ) +
                        cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) + cc.attention( sequence_id ) +
                        "\n" );
                    if( joOut.result == null || joOut.result == undefined || ( !typeof joOut.result == "object" ) ) {
                        ++joGatheringTracker.nCountErrors;
                        const strErrorMessage =
                            strLogPrefix + cc.fatal( "Wallet CRITICAL ERROR:" ) + " " +
                            cc.error( "S-Chain node " ) + strNodeDescColorized +
                            cc.error( " reported wallet error: " ) +
                            cc.warning( owaspUtils.extract_error_message( joOut, "unknown wallet error(1)" ) ) +
                            cc.error( ", " ) + cc.notice( "sequence ID" ) + cc.error( " is " ) + cc.attention( sequence_id ) +
                            "\n";
                        log.write( strErrorMessage );
                        details.write( strErrorMessage );
                        await joCall.disconnect();
                        return;
                    }
                    details.write( strLogPrefix + cc.normal( "Node " ) + cc.info( joNode.nodeID ) + cc.normal( " sign result: " ) + cc.j( joOut.result ? joOut.result : null ) + "\n" );
                    try {
                        if( joOut.result.signResult.signatureShare.length > 0 && joOut.result.signResult.status === 0 ) {
                            const nZeroBasedNodeIndex = joNode.imaInfo.thisNodeIndex - 1;
                            //
                            // partial BLS verification for one participant
                            //
                            let bNodeSignatureOKay = false; // initially assume signature is wrong
                            const strLogPrefixA = cc.bright( strDirection ) + cc.debug( "/" ) + cc.info( "BLS" ) + cc.debug( "/" ) + cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) + cc.debug( ":" ) + " ";
                            try {
                                const cntSuccess = joGatheringTracker.nCountReceived - joGatheringTracker.nCountErrors;
                                if( cntSuccess > nCountOfBlsPartsToCollect ) {
                                    ++joGatheringTracker.nCountSkipped;
                                    details.write( strLogPrefixA +
                                        cc.debug( "Will ignore sign result for node " ) + cc.info( nZeroBasedNodeIndex ) +
                                        cc.debug( " because " ) + cc.info( nThreshold ) + cc.debug( "/" ) + cc.info( nCountOfBlsPartsToCollect ) +
                                        cc.debug( " threshold number of BLS signature parts already gathered" ) +
                                        "\n" );
                                    await joCall.disconnect();
                                    return;
                                }
                                const arrTmp = joOut.result.signResult.signatureShare.split( ":" );
                                const joResultFromNode = {
                                    index: "" + nZeroBasedNodeIndex,
                                    signature: {
                                        X: arrTmp[0],
                                        Y: arrTmp[1]
                                    }
                                };
                                details.write( strLogPrefixA + cc.info( "Will verify sign result for node " ) + cc.info( nZeroBasedNodeIndex ) + "\n" );
                                const joPublicKey = discover_public_key_by_index( nZeroBasedNodeIndex, imaState.joSChainNetworkInfo );
                                if( perform_bls_verify_i(
                                    details,
                                    strDirection,
                                    nZeroBasedNodeIndex,
                                    joResultFromNode,
                                    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
                                    joPublicKey
                                ) ) {
                                    details.write( strLogPrefixA + cc.success( "Got successful BLS verification result for node " ) + cc.info( joNode.nodeID ) + cc.success( " with index " ) + cc.info( nZeroBasedNodeIndex ) + "\n" );
                                    bNodeSignatureOKay = true; // node verification passed
                                } else
                                    details.write( strLogPrefixA + cc.fatal( "CRITICAL ERROR:" ) + " " + cc.error( "BLS verification failed" ) + "\n" );
                            } catch ( err ) {
                                const strErrorMessage =
                                    strLogPrefixA + cc.error( "S-Chain node " ) + strNodeDescColorized + cc.error( " sign " ) +
                                    cc.error( " CRITICAL ERROR:" ) + cc.error( " partial signature fail from with index " ) + cc.info( nZeroBasedNodeIndex ) +
                                    cc.error( ", error is " ) + cc.warning( owaspUtils.extract_error_message( err ) ) +
                                    cc.error( ", " ) + cc.notice( "sequence ID" ) + cc.error( " is " ) + cc.attention( sequence_id ) +
                                    "\n";
                                log.write( strErrorMessage );
                                details.write( strErrorMessage );
                            }
                            //
                            // sign result for bls_glue should look like:
                            // {
                            //     "index": "1",
                            //     "signature": {
                            //         "X": "8184471694634630119550127539973704769190648951089883109386639469590492862134",
                            //         "Y": "4773775435244318964726085856452691379381914783621253742616578726383405809710"
                            //     }
                            // }
                            //
                            if( bNodeSignatureOKay ) {
                                arrSignResults.push( {
                                    index: "" + nZeroBasedNodeIndex,
                                    signature: split_signature_share( joOut.result.signResult.signatureShare ),
                                    fromNode: joNode, // extra, not needed for bls_glue
                                    signResult: joOut.result.signResult
                                } );
                            } else
                                ++joGatheringTracker.nCountErrors;
                        }
                    } catch ( err ) {
                        ++joGatheringTracker.nCountErrors;
                        const strErrorMessage =
                            strLogPrefix + cc.error( "S-Chain node " ) + strNodeDescColorized + " " + cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " signature fail from node " ) + cc.info( joNode.nodeID ) +
                            cc.error( ", error is " ) + cc.warning( owaspUtils.extract_error_message( err ) ) +
                            cc.error( ", " ) + cc.notice( "sequence ID" ) + cc.error( " is " ) + cc.attention( sequence_id ) +
                            "\n";
                        log.write( strErrorMessage );
                        details.write( strErrorMessage );
                    }
                    await joCall.disconnect();
                } ); // joCall.call ...
            } ); // rpcCall.create ...
        } // for( let i = 0; i < jarrNodes.length; ++i )

        log.write( strLogPrefix + cc.debug( "Waiting for BLS glue result " ) + "\n" );
        details.write( strLogPrefix + cc.debug( "Waiting for BLS glue result " ) + "\n" );
        let errGathering = null;
        const promise_gathering_complete = new Promise( ( resolve, reject ) => {
            const iv = setInterval( function() {
                ++ joGatheringTracker.nWaitIntervalStepsDone;
                cntSuccess = joGatheringTracker.nCountReceived - joGatheringTracker.nCountErrors;
                if( cntSuccess >= nCountOfBlsPartsToCollect ) {
                    const strLogPrefixB = cc.bright( strDirection ) + cc.debug( "/" ) + cc.info( "BLS" ) + cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
                    clearInterval( iv );
                    let strError = null, strSuccessfulResultDescription = null;
                    const joGlueResult = perform_bls_glue(
                        details,
                        strDirection,
                        jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
                        arrSignResults
                    );
                    if( joGlueResult ) {
                        details.write( strLogPrefixB + cc.success( "Got BLS glue result: " ) + cc.j( joGlueResult ) + "\n" );
                        if( imaState.strPathBlsVerify.length > 0 ) {
                            const joCommonPublicKey = discover_common_public_key( imaState.joSChainNetworkInfo );
                            // console.log(joCommonPublicKey);
                            if( perform_bls_verify(
                                details,
                                strDirection,
                                joGlueResult,
                                jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
                                joCommonPublicKey
                            ) ) {
                                strSuccessfulResultDescription = "Got successful summary BLS verification result";
                                details.write( strLogPrefixB + cc.success( strSuccessfulResultDescription ) + "\n" );
                            } else {
                                strError = "BLS verification failed";
                                log.write( strLogPrefixB + cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) + "\n" );
                                details.write( strLogPrefixB + cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) + "\n" );
                            }
                        }
                    } else {
                        strError = "BLS glue failed, no glue result arrived";
                        const strErrorMessage =
                            strLogPrefixB + cc.error( "Problem(1) in BLS sign result handler: " ) + cc.warning( strError ) + "\n";
                        log.write( strErrorMessage );
                        details.write( strErrorMessage );
                    }
                    log.write( cc.debug( "Will call sending function (fn)" ) + "\n" );
                    details.write( cc.debug( "Will call sending function (fn) for " ) + "\n" );
                    /*await*/ fn( strError, jarrMessages, joGlueResult ).catch( ( err ) => {
                        const strErrorMessage = cc.error( "Problem(2) in BLS sign result handler: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                        log.write( strErrorMessage );
                        details.write( strErrorMessage );
                        errGathering = "Problem(2) in BLS sign result handler: " + owaspUtils.extract_error_message( err );
                        return;
                    } );
                    bHaveResultReportCalled = true;
                    if( strError ) {
                        errGathering = strError;
                        reject( new Error( errGathering ) );
                    } else
                        resolve();
                    return;
                }
                if( joGatheringTracker.nCountReceived >= jarrNodes.length ) {
                    clearInterval( iv );
                    /*await*/ fn( "signature error(2), got " + joGatheringTracker.nCountErrors + " errors(s) for " + jarrNodes.length + " node(s)", jarrMessages, null ).catch( ( err ) => {
                        const strErrorMessage =
                            cc.error( "Problem(3) in BLS sign result handler, not enough successful BLS signature parts(" ) +
                            cc.info( cntSuccess ) + cc.error( " when all attempts done, error details: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) +
                            "\n";
                        log.write( strErrorMessage );
                        details.write( strErrorMessage );
                        errGathering =
                            "Problem(3) in BLS sign result handler, not enough successful BLS signature parts(" +
                            cntSuccess + " when all attempts done, error details: " + owaspUtils.extract_error_message( err );
                        reject( new Error( errGathering ) );
                    } );
                    bHaveResultReportCalled = true;
                    return;
                }
                if( joGatheringTracker.nWaitIntervalStepsDone >= joGatheringTracker.nWaitIntervalMaxSteps ) {
                    clearInterval( iv );
                    /*await*/ fn( "signature error(3), got " + joGatheringTracker.nCountErrors + " errors(s) for " + jarrNodes.length + " node(s)", jarrMessages, null ).catch( ( err ) => {
                        const strErrorMessage =
                            cc.error( "Problem(4) in BLS sign result handler, not enough successful BLS signature parts(" ) +
                            cc.info( cntSuccess ) + cc.error( ") and timeout reached, error details: " ) +
                            cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                        log.write( strErrorMessage );
                        details.write( strErrorMessage );
                        errGathering =
                            "Problem(4) in BLS sign result handler, not enough successful BLS signature parts(" +
                            cntSuccess + ") and timeout reached, error details: " + owaspUtils.extract_error_message( err );
                        reject( new Error( errGathering ) );
                    } );
                    bHaveResultReportCalled = true;
                    return;
                }
            }, joGatheringTracker.nWaitIntervalStepMilliseconds );
        } );
        log.write( cc.debug( "Will await for message BLS verification and sending..." ) + "\n" );
        details.write( cc.debug( "Will await for message BLS verification and sending..." ) + "\n" );
        await with_timeout( "BLS verification and sending", promise_gathering_complete, g_secondsMessageVerifySendTimeout ).then( strSuccessfulResultDescription => {
            details.write( cc.success( "BLS verification and sending promise awaited." ) + "\n" );
            log.write( cc.success( "BLS verification and sending promise awaited." ) + "\n" );
        } ).catch( err => {
            const strErrorMessage = cc.error( "Failed to verify BLS and send message : " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
            log.write( strErrorMessage );
            details.write( strErrorMessage );
        } );
        if( errGathering ) {
            const strErrorMessage = cc.error( "Failed BLS sign result awaiting(1): " ) + cc.warning( errGathering.toString() ) + "\n";
            log.write( strErrorMessage );
            details.write( strErrorMessage );
            if( ! bHaveResultReportCalled ) {
                bHaveResultReportCalled = true;
                await fn(
                    "Failed to gather BLS signatures in " + jarrNodes.length + " node(s), trakcer data is: " +
                        JSON.stringify( joGatheringTracker ) + ", error is: " + errGathering.toString(),
                    jarrMessages,
                    null
                ).catch( ( err ) => {
                    const strErrorMessage =
                        cc.error( "Problem(5) in BLS sign result handler, not enough successful BLS signature parts(" ) +
                        cc.info( cntSuccess ) + cc.error( ") and timeout reached, error details: " ) +
                        cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    details.exposeDetailsTo( log, strGatheredDetailsName, false );
                    details.close();
                    details = null;
                } );
            }
            return;
        }
        if( ! bHaveResultReportCalled ) {
            const strErrorMessage = cc.error( "Failed BLS sign result awaiting(2): " ) +
                cc.warning( "No reports were arrived" ) + // cc.warning( owaspUtils.extract_error_message( err ) )
                + "\n";
            log.write( strErrorMessage );
            details.write( strErrorMessage );
            bHaveResultReportCalled = true;
            await fn( "Failed to gather BLS signatures in " + jarrNodes.length + " node(s), trakcer data is: " + JSON.stringify( joGatheringTracker ), jarrMessages, null ).catch( ( err ) => {
                const strErrorMessage =
                    cc.error( "Problem(6) in BLS sign result handler, not enough successful BLS signature parts(" ) +
                    cc.info( cntSuccess ) + cc.error( ") and timeout reached, error details: " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                log.write( strErrorMessage );
                details.write( strErrorMessage );
                details.exposeDetailsTo( log, strGatheredDetailsName, false );
                details.close();
                details = null;
            } );
        }
    } catch ( err ) {
        const strErrorMessage =
            cc.error( "Failed BLS sign due to generic flow exception: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
        log.write( strErrorMessage );
        if( details )
            details.write( strErrorMessage );
        if( ! bHaveResultReportCalled ) {
            bHaveResultReportCalled = true;
            await fn( "Failed BLS sign due to exception: " + owaspUtils.extract_error_message( err ), jarrMessages, null ).catch( ( err ) => {
                const strErrorMessage = cc.error( "Failed BLS sign due to error-erporting callback exception: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                log.write( strErrorMessage );
                if( details ) {
                    details.write( strErrorMessage );
                    details.exposeDetailsTo( log, strGatheredDetailsName, false );
                    details.close();
                }
            } );
        }
    }
    log.write( strGatheredDetailsName + " completed" );
    details.write( strGatheredDetailsName + " completed" );
    if( details ) {
        details.exposeDetailsTo( log, strGatheredDetailsName, true );
        details.close();
    }
}

export async function do_sign_messages_m2s(
    nTransferLoopCounter,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    joExtraSignOpts,
    fn
) {
    return await do_sign_messages_impl(
        nTransferLoopCounter,
        "M2S",
        jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
        joExtraSignOpts,
        fn
    );
}

export async function do_sign_messages_s2m(
    nTransferLoopCounter,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    joExtraSignOpts,
    fn
) {
    return await do_sign_messages_impl(
        nTransferLoopCounter,
        "S2M",
        jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
        joExtraSignOpts,
        fn
    );
}

export async function do_sign_messages_s2s(
    nTransferLoopCounter,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    joExtraSignOpts,
    fn
) {
    return await do_sign_messages_impl(
        nTransferLoopCounter,
        "S2S",
        jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
        joExtraSignOpts,
        fn
    );
}

export async function do_sign_u256( u256, details, fn ) {
    const strLogPrefix = cc.info( "Sign u256:" ) + " ";
    log.write( strLogPrefix + cc.debug( "Invoking signing u256 procedure " ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Invoking signing u256 procedure " ) + "\n" );
    fn = fn || function() {};
    if( !( /*imaState.bSignMessages &&*/ imaState.strPathBlsGlue.length > 0 && imaState.joSChainNetworkInfo ) ) {
        details.write( strLogPrefix + cc.debug( "BLS u256 signing is " ) + cc.error( "unavailable" ) + "\n" );
        await fn( "BLS u256 signing is unavailable", u256, null );
        return;
    }
    //
    // sign result looks like:
    // {
    //     "id": 1, "jsonrpc": "2.0", "result": {
    //         "signResult": {
    //             "errorMessage": "",
    //             "signatureShare": "13888409666804046853490114813821624491836407617931905586112520275264817002720:9871589266312476278322587556340871982939135237123140475925975407511373249165:0",
    //             "status": 0
    //         }
    //     }
    // }
    //
    details.write( strLogPrefix + cc.debug( "Will sign " ) + cc.info( u256 ) + cc.debug( " value..." ) + "\n" );
    log.write( strLogPrefix + cc.debug( "Will sign " ) + cc.info( u256 ) + cc.debug( " value..." ) + "\n" );
    const joGatheringTracker = {
        nCountReceived: 0, // including errors
        nCountErrors: 0,
        nCountSkipped: 0,
        nWaitIntervalStepMilliseconds: 100,
        nWaitIntervalStepsDone: 0,
        nWaitIntervalMaxSteps: 10 * 60 * 3 // 10 is 1 second
    };
    const arrSignResults = [];
    const jarrNodes = imaState.joSChainNetworkInfo.network;
    details.write( strLogPrefix + cc.debug( "Will query to sign " ) + cc.info( jarrNodes.length ) + cc.debug( " skaled node(s)..." ) + "\n" );
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    details.write( strLogPrefix + cc.debug( "Discovered BLS threshold is " ) + cc.info( nThreshold ) + cc.debug( "." ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Discovered number of BLS participants is " ) + cc.info( nParticipants ) + cc.debug( "." ) + "\n" );
    if( nThreshold <= 0 ) {
        await fn( "signature error(1, u256), S-Chain information was not discovered properly and BLS threshold is unknown", u256, null );
        return;
    }
    const nCountOfBlsPartsToCollect = 0 + nThreshold;
    // if( nThreshold <= 1 && nParticipants > 1 ) {
    //     details.write( strLogPrefix + cc.warning( "Minimal BLS parts number for dicovery was increased." ) + "\n" );
    //     nCountOfBlsPartsToCollect = 2;
    // }
    log.write( strLogPrefix + cc.debug( "Will(u256) collect " ) + cc.info( nCountOfBlsPartsToCollect ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Will(u256) collect " ) + cc.info( nCountOfBlsPartsToCollect ) + cc.debug( " from " ) + cc.info( jarrNodes.length ) + cc.debug( " nodes" ) + "\n" );
    for( let i = 0; i < jarrNodes.length; ++i ) {
        const joNode = jarrNodes[i];
        const strNodeURL = imaState.isCrossImaBlsMode
            ? imaUtils.compose_ima_agent_node_url( joNode )
            : imaUtils.compose_schain_node_url( joNode );
        const strNodeDescColorized = cc.u( strNodeURL ) + " " +
            cc.normal( "(" ) + cc.bright( i ) + cc.normal( "/" ) + cc.bright( jarrNodes.length ) + cc.normal( ", ID " ) + cc.info( joNode.nodeID ) + cc.normal( ")" );
        const rpcCallOpts = null;
        await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                ++joGatheringTracker.nCountReceived; // including errors
                ++joGatheringTracker.nCountErrors;
                const strErrorMessage =
                    strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                    cc.error( " failed, RPC call was not created, error is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                log.write( strErrorMessage );
                details.write( strErrorMessage );
                if( joCall )
                    await joCall.disconnect();
                return;
            }
            details.write(
                strLogPrefix + cc.debug( "Will invoke " ) + cc.info( "skale_imaBSU256" ) +
                cc.debug( " for to sign value " ) + cc.info( u256.toString() ) +
                "\n" );
            await joCall.call( {
                method: "skale_imaBSU256",
                params: {
                    valueToSign: u256 // must be 0x string, came from outside 0x string
                }
            }, async function( joIn, joOut, err ) {
                ++joGatheringTracker.nCountReceived; // including errors
                if( err ) {
                    ++joGatheringTracker.nCountErrors;
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                        cc.error( " failed, RPC call reported error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    await joCall.disconnect();
                    return;
                }
                details.write(
                    strLogPrefix + cc.debug( "Did invoked " ) + cc.info( "skale_imaBSU256" ) +
                    cc.debug( " for to sign value " ) + cc.info( u256.toString() ) +
                    cc.debug( ", answer is: " ) + cc.j( joOut ) +
                    "\n" );
                if( joOut.result == null || joOut.result == undefined || ( !typeof joOut.result == "object" ) ) {
                    ++joGatheringTracker.nCountErrors;
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "Wallet CRITICAL ERROR:" ) + " " +
                        cc.error( "S-Chain node " ) + strNodeDescColorized +
                        cc.error( " reported wallet error: " ) +
                        cc.warning( owaspUtils.extract_error_message( joOut, "unknown wallet error(2)" ) ) +
                        "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    await joCall.disconnect();
                    return;
                }
                details.write( strLogPrefix + cc.normal( "Node " ) + cc.info( joNode.nodeID ) + cc.normal( " sign result: " ) + cc.j( joOut.result ? joOut.result : null ) + "\n" );
                try {
                    if( joOut.result.signResult.signatureShare.length > 0 && joOut.result.signResult.status === 0 ) {
                        const nZeroBasedNodeIndex = joNode.imaInfo.thisNodeIndex - 1;
                        //
                        // partial BLS verification for one participant
                        //
                        let bNodeSignatureOKay = false; // initially assume signature is wrong
                        const strLogPrefixA = cc.info( "BLS" ) + cc.debug( "/" ) + cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) + cc.debug( ":" ) + " ";
                        try {
                            const cntSuccess = joGatheringTracker.nCountReceived - joGatheringTracker.nCountErrors;
                            if( cntSuccess > nCountOfBlsPartsToCollect ) {
                                ++joGatheringTracker.nCountSkipped;
                                details.write( strLogPrefixA +
                                    cc.debug( "Will ignore sign result for node " ) + cc.info( nZeroBasedNodeIndex ) +
                                    cc.debug( " because " ) + cc.info( nThreshold ) + cc.debug( "/" ) + cc.info( nCountOfBlsPartsToCollect ) +
                                    cc.debug( " threshold number of BLS signature parts already gathered" ) +
                                    "\n" );
                                return;
                            }
                            const arrTmp = joOut.result.signResult.signatureShare.split( ":" );
                            const joResultFromNode = {
                                index: "" + nZeroBasedNodeIndex,
                                signature: {
                                    X: arrTmp[0],
                                    Y: arrTmp[1]
                                }
                            };
                            details.write( strLogPrefixA + cc.info( "Will verify sign result for node " ) + cc.info( nZeroBasedNodeIndex ) + "\n" );
                            const joPublicKey = discover_public_key_by_index( nZeroBasedNodeIndex, imaState.joSChainNetworkInfo );
                            if( perform_bls_verify_i_u256( details, nZeroBasedNodeIndex, joResultFromNode, u256, joPublicKey ) ) {
                                details.write( strLogPrefixA + cc.success( "Got successful BLS verification result for node " ) + cc.info( joNode.nodeID ) + cc.success( " with index " ) + cc.info( nZeroBasedNodeIndex ) + "\n" );
                                bNodeSignatureOKay = true; // node verification passed
                            } else {
                                const strError = "BLS u256 one node verify failed";
                                details.write( strLogPrefixA + cc.fatal( "CRITICAL ERROR:" ) + " " + cc.error( strError ) + "\n" );
                            }
                        } catch ( err ) {
                            const strErrorMessage =
                                strLogPrefixA + cc.error( "S-Chain node " ) + strNodeDescColorized + cc.error( " sign " ) +
                                cc.error( " CRITICAL ERROR:" ) + cc.error( " partial signature fail from with index " ) + cc.info( nZeroBasedNodeIndex ) +
                                cc.error( ", error is " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                            log.write( strErrorMessage );
                            details.write( strErrorMessage );
                        }
                        //
                        // sign result for bls_glue should look like:
                        // {
                        //     "index": "1",
                        //     "signature": {
                        //         "X": "8184471694634630119550127539973704769190648951089883109386639469590492862134",
                        //         "Y": "4773775435244318964726085856452691379381914783621253742616578726383405809710"
                        //     }
                        // }
                        //
                        if( bNodeSignatureOKay ) {
                            arrSignResults.push( {
                                index: "" + nZeroBasedNodeIndex,
                                signature: split_signature_share( joOut.result.signResult.signatureShare ),
                                fromNode: joNode, // extra, not needed for bls_glue
                                signResult: joOut.result.signResult
                            } );
                        } else
                            ++joGatheringTracker.nCountErrors;
                    }
                } catch ( err ) {
                    ++joGatheringTracker.nCountErrors;
                    const strErrorMessage =
                        strLogPrefix + cc.error( "S-Chain node " ) + strNodeDescColorized + " " + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " signature fail from node " ) + cc.info( joNode.nodeID ) +
                        cc.error( ", error is " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                }
                await joCall.disconnect();
            } ); // joCall.call ...
        } ); // rpcCall.create ...
    }

    log.write( strLogPrefix + cc.debug( "Waiting for BLS glue result " ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Waiting for BLS glue result " ) + "\n" );
    errGathering = null;
    const promise_gathering_complete = new Promise( ( resolve, reject ) => {
        const iv = setInterval( function() {
            ++ joGatheringTracker.nWaitIntervalStepsDone;
            const cntSuccess = joGatheringTracker.nCountReceived - joGatheringTracker.nCountErrors;
            if( cntSuccess >= nCountOfBlsPartsToCollect ) {
                const strLogPrefixB = cc.info( "BLS u256" ) + cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
                clearInterval( iv );
                let strError = null, strSuccessfulResultDescription = null;
                const joGlueResult = perform_bls_glue_u256( details, u256, arrSignResults );
                if( joGlueResult ) {
                    details.write( strLogPrefixB + cc.success( "Got BLS glue u256 result: " ) + cc.j( joGlueResult ) + "\n" );
                    if( imaState.strPathBlsVerify.length > 0 ) {
                        const joCommonPublicKey = discover_common_public_key( imaState.joSChainNetworkInfo );
                        // console.log(joCommonPublicKey);
                        if( perform_bls_verify_u256( details, joGlueResult, u256, joCommonPublicKey ) ) {
                            strSuccessfulResultDescription = "Got successful summary BLS u256 verification result";
                            details.write( strLogPrefixB + cc.success( strSuccessfulResultDescription ) + "\n" );
                        } else {
                            strError = "BLS verification failed";
                            log.write( strLogPrefixB + cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) + "\n" );
                            details.write( strLogPrefixB + cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) + "\n" );
                        }
                    }
                } else {
                    strError = "BLS u256 glue failed, no glue result arrived";
                    const strErrorMessage =
                        strLogPrefixB + cc.error( "Problem(1) in BLS u256 sign result handler: " ) + cc.warning( strError ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                }
                log.write( cc.debug( "Will call sending function (fn)" ) + "\n" );
                details.write( cc.debug( "Will call sending function (fn) for " ) + "\n" );
                /*await*/ fn( strError, u256, joGlueResult ).catch( ( err ) => {
                    const strErrorMessage = cc.error( "Problem(2) in BLS u256 sign result handler: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    errGathering = "Problem(2) in BLS u256 sign result handler: " + owaspUtils.extract_error_message( err );
                } );
                if( strError ) {
                    errGathering = strError;
                    reject( new Error( errGathering ) );
                } else
                    resolve();
                return;
            }
            if( joGatheringTracker.nCountReceived >= jarrNodes.length ) {
                clearInterval( iv );
                /*await*/ fn( "signature error(2, u256), got " + joGatheringTracker.nCountErrors + " errors(s) for " + jarrNodes.length + " node(s)", u256, null ).catch( ( err ) => {
                    const strErrorMessage =
                        cc.error( "Problem(3) in BLS u256 sign result handler, not enough successful BLS signature parts(" ) +
                        cc.info( cntSuccess ) + cc.error( " when all attempts done, error details: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) +
                        "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    errGathering =
                        "Problem(3) in BLS u256 sign result handler, not enough successful BLS signature parts(" +
                        cntSuccess + " when all attempts done, error details: " + owaspUtils.extract_error_message( err );
                    reject( new Error( errGathering ) );
                } );
                return;
            }
            if( joGatheringTracker.nWaitIntervalStepsDone >= joGatheringTracker.nWaitIntervalMaxSteps ) {
                clearInterval( iv );
                /*await*/ fn( "signature error(3, u256), got " + joGatheringTracker.nCountErrors + " errors(s) for " + jarrNodes.length + " node(s)", u256, null ).catch( ( err ) => {
                    const strErrorMessage =
                        cc.error( "Problem(4) in BLS u256 sign result handler, not enough successful BLS signature parts(" ) +
                        cc.info( cntSuccess ) + cc.error( ") and timeout reached, error details: " ) +
                        cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    errGathering =
                        "Problem(4) in BLS u256 sign result handler, not enough successful BLS signature parts(" +
                        cntSuccess + ") and timeout reached, error details: " + owaspUtils.extract_error_message( err );
                    reject( new Error( errGathering ) );
                } );
                return;
            }
        }, joGatheringTracker.nWaitIntervalStepMilliseconds );
    } );
    details.write( cc.debug( "Will await BLS u256 sign result..." ) + "\n" );
    log.write( cc.debug( "Will await BLS u256 sign result..." ) + "\n" );
    await with_timeout( "BLS u256 sign", promise_gathering_complete, g_secondsMessageVerifySendTimeout ).then( strSuccessfulResultDescription => {
        details.write( cc.info( "BLS u256 sign promise awaited." ) + "\n" );
        log.write( cc.info( "BLS u256 sign promise awaited." ) + "\n" );
    } ).catch( err => {
        const strErrorMessage = cc.error( "Failed to verify BLS and send message : " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
        log.write( strErrorMessage );
        details.write( strErrorMessage );
    } );
    if( errGathering ) {
        const strErrorMessage = cc.error( "Failed BLS u256 sign result awaiting: " ) + cc.warning( errGathering.toString() ) + "\n";
        log.write( strErrorMessage );
        details.write( strErrorMessage );
        return;
    }
    log.write( strLogPrefix + cc.debug( "Completed signing u256 procedure " ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Completed signing u256 procedure " ) + "\n" );
}

export async function do_verify_ready_hash( strMessageHash, nZeroBasedNodeIndex, signature ) {
    const strDirection = "RAW";
    const strLogPrefix = cc.bright( strDirection ) + cc.debug( "/" ) + cc.info( "BLS" ) + cc.debug( "/" ) + cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) + cc.debug( ":" ) + " ";
    const details = log.createMemoryStream( true );
    let isSuccess = false;
    const joPublicKey = discover_public_key_by_index( nZeroBasedNodeIndex, imaState.joSChainNetworkInfo );
    const arrTmp = signature.signatureShare.split( ":" );
    const joResultFromNode = {
        index: "" + nZeroBasedNodeIndex,
        signature: {
            X: arrTmp[0],
            Y: arrTmp[1]
        }
    };
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    // const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        // shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        // shell.cd( strActionDir );
        details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.debug( " - hashed verify message is " ) + cc.info( strMessageHash ) + "\n" );
        const joMsg = {
            message: strMessageHash
        };
        details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.debug( " - composed  " ) + cc.j( joMsg ) + cc.debug( " using hash " ) + cc.j( strMessageHash ) + cc.debug( " and glue " ) + cc.j( joResultFromNode ) + cc.debug( " and public key " ) + cc.j( joPublicKey ) + "\n" );
        const strSignResultFileName = strActionDir + "/sign-result" + nZeroBasedNodeIndex + ".json";
        // console.log( "--- joResultFromNode ---", JSON.stringify( joResultFromNode ) );
        // console.log( "--- joMsg ---", JSON.stringify( joMsg ) );
        // console.log( "--- joPublicKey ---", JSON.stringify( joPublicKey ) );
        imaUtils.jsonFileSave( strSignResultFileName, joResultFromNode );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        imaUtils.jsonFileSave( strActionDir + "/BLS_keys" + nZeroBasedNodeIndex + ".json", joPublicKey );
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --j " + nZeroBasedNodeIndex +
            " --input " + strSignResultFileName
            ;
        details.write( strLogPrefix + cc.normal( "Will execute node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.normal( " BLS verify command:\n" ) + cc.notice( strVerifyCommand ) + "\n" );
        strOutput = child_process.execSync( strVerifyCommand, { cwd: strActionDir } );
        details.write( strLogPrefix + cc.normal( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.normal( " verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        details.write( strLogPrefix + cc.success( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.success( " verify success" ) + "\n" );
        fnShellRestore();
        isSuccess = true;
    } catch ( err ) {
        const s1 = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify error:" ) + cc.warning( " error description is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
        const s2 = strLogPrefix + cc.error( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify output is:\n" ) + cc.warning( strOutput ) + "\n";
        log.write( s1 );
        details.write( s1 );
        log.write( s2 );
        details.write( s2 );
        fnShellRestore();
        isSuccess = false;
    }
    details.exposeDetailsTo( log, "BLS-raw-verifier", isSuccess );
    details.close();
    return isSuccess;
}

export async function do_sign_ready_hash( strMessageHash ) {
    const strLogPrefix = "";
    const details = log.createMemoryStream( true );
    let joSignResult = null;
    try {
        const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
        const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
        details.write( strLogPrefix + cc.debug( "Discovered BLS threshold is " ) + cc.info( nThreshold ) + cc.debug( "." ) + "\n" );
        details.write( strLogPrefix + cc.debug( "Discovered number of BLS participants is " ) + cc.info( nParticipants ) + cc.debug( "." ) + "\n" );
        //
        details.write( strLogPrefix + cc.debug( "hash value to sign is " ) + cc.info( strMessageHash ) + "\n" );
        //
        let joAccount = imaState.chainProperties.sc.joAccount;
        if( ! joAccount.strURL ) {
            joAccount = imaState.chainProperties.mn.joAccount;
            if( ! joAccount.strSgxURL )
                throw new Error( "SGX URL is unknown, cannot sign U256" );
            if( ! joAccount.strBlsKeyName )
                throw new Error( "BLS keys name is unknown, cannot sign U256" );
        }
        let rpcCallOpts = null;
        if( "strPathSslKey" in joAccount && typeof joAccount.strPathSslKey == "string" && joAccount.strPathSslKey.length > 0 &&
            "strPathSslCert" in joAccount && typeof joAccount.strPathSslCert == "string" && joAccount.strPathSslCert.length > 0
        ) {
            rpcCallOpts = {
                "cert": fs.readFileSync( joAccount.strPathSslCert, "utf8" ),
                "key": fs.readFileSync( joAccount.strPathSslKey, "utf8" )
            };
            // details.write( cc.debug( "Will sign via SGX with SSL options " ) + cc.j( rpcCallOpts ) + "\n" );
        }
        const signerIndex = imaState.chainProperties.sc.joAccount.nNodeNumber;
        await rpcCall.create( joAccount.strSgxURL, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                const strErrorMessage =
                    strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call to SGX failed, RPC call was not created, error is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                log.write( strErrorMessage );
                details.write( strErrorMessage );
                if( joCall )
                    await joCall.disconnect();
                throw new Error( "JSON RPC call to SGX failed, RPC call was not created, error is: " + owaspUtils.extract_error_message( err ) );
            }
            const joCallSGX = {
                method: "blsSignMessageHash",
                // type: "BLSSignReq",
                params: {
                    keyShareName: joAccount.strBlsKeyName,
                    messageHash: strMessageHash,
                    n: nParticipants,
                    t: nThreshold,
                    signerIndex: signerIndex + 0 // 1-based
                }
            };
            details.write( strLogPrefix + cc.debug( "Will invoke " ) + cc.info( "SGX" ) + cc.debug( " with call data " ) + cc.j( joCallSGX ) + "\n" );
            await joCall.call( joCallSGX, async function( joIn, joOut, err ) {
                if( err ) {
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to SGX failed, RPC call reported error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    await joCall.disconnect();
                    throw new Error( "JSON RPC call to SGX failed, RPC call reported error: " + owaspUtils.extract_error_message( err ) );
                }
                details.write( strLogPrefix + cc.debug( "Call to " ) + cc.info( "SGX" ) + cc.debug( " done, answer is: " ) + cc.j( joOut ) + "\n" );
                joSignResult = joOut;
                if( joOut.result != null && joOut.result != undefined && typeof joOut.result == "object" )
                    joSignResult = joOut.result;
                if( joOut.signResult != null && joOut.signResult != undefined && typeof joOut.signResult == "object" )
                    joSignResult = joOut.signResult;
                if( "errorMessage" in joSignResult &&
                    typeof joSignResult.errorMessage == "string" &&
                    joSignResult.errorMessage.length > 0
                ) {
                    const strError = "BLS signing finished with error: " + joSignResult.errorMessage;
                    joRetVal.error = strError;
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " BLS signing(1) finished with error: " ) + cc.warning( joSignResult.errorMessage ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    await joCall.disconnect();
                    throw new Error( strError );
                }
                joSignResult.error = null;
                await joCall.disconnect();
            } ); // joCall.call ...
        } ); // rpcCall.create ...
    } catch ( err ) {
        const strError = owaspUtils.extract_error_message( err );
        joSignResult = { };
        joSignResult.error = strError;
        const strErrorMessage =
            strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " +
            cc.error( "BLS-raw-signer error: " ) + cc.warning( strError ) +
            "\n";
        log.write( strErrorMessage );
        details.write( strErrorMessage );
    }
    const isSuccess = ( joSignResult && typeof joSignResult == "object" && ( !joSignResult.error ) ) ? true : false;
    details.exposeDetailsTo( log, "BLS-raw-signer", isSuccess );
    details.close();
    return joSignResult;
}

// export async function handle_skale_call_via_redirect( joCallData ) {
//     const sequence_id = owaspUtils.remove_starting_0x( get_w3().utils.soliditySha3( log.generate_timestamp_string( null, false ) ) );
//     const strLogPrefix = "";
//     const strNodeURL = imaState.chainProperties.sc.strURL;
//     const rpcCallOpts = null;
//     let joRetVal = { };
//     const details = log.createMemoryStream( true );
//     let isSuccess = false;
//     try {
//         await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
//             if( err ) {
//                 const strErrorMessage =
//                     strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
//                     cc.error( " JSON RPC call to S-Chain failed, RPC call was not created, error is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
//                 log.write( strErrorMessage );
//                 details.write( strErrorMessage );
//                 if( joCall )
//                     await joCall.disconnect();
//                 throw new Error( "JSON RPC call to S-Chain failed, RPC call was not created, error is: " + owaspUtils.extract_error_message( err ) );
//             }
//             details.write( strLogPrefix + cc.debug( "Will invoke " ) + cc.info( "S-Chain" ) + cc.debug( " with call data " ) + cc.j( joCallData ) + "\n" );
//             await joCall.call( joCallData, async function( joIn, joOut, err ) {
//                 if( err ) {
//                     const strErrorMessage =
//                         strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
//                         cc.error( " JSON RPC call to S-Chain failed, RPC call reported error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
//                     log.write( strErrorMessage );
//                     details.write( strErrorMessage );
//                     await joCall.disconnect();
//                     throw new Error( "JSON RPC call to S-Chain failed, RPC call reported error: " + owaspUtils.extract_error_message( err ) );
//                 }
//                 details.write( strLogPrefix + cc.debug( "Call to " ) + cc.info( "S-Chain" ) + cc.debug( " done, answer is: " ) + cc.j( joOut ) + "\n" );
//                 if( joOut.result == null || joOut.result == undefined || ( !typeof joOut.result == "object" ) ) {
//                     const strErrorMessage =
//                         strLogPrefix + cc.fatal( "Wallet CRITICAL ERROR:" ) + " " +
//                         cc.error( "S-Chain reported wallet error: " ) +
//                         cc.warning( owaspUtils.extract_error_message( joOut, "unknown wallet error(3)" ) ) +
//                         cc.error( ", " ) + cc.notice( "sequence ID" ) + cc.error( " is " ) + cc.attention( sequence_id ) +
//                         "\n";
//                     log.write( strErrorMessage );
//                     details.write( strErrorMessage );
//                     details.write( strErrorMessage );
//                     await joCall.disconnect();
//                     throw new Error( "JSON RPC call to S-Chain failed with \"unknown wallet error(3)\", sequence ID is " + sequence_id );
//                 }
//                 isSuccess = true;
//                 joRetVal = joOut; // joOut.result
//                 await joCall.disconnect();
//             } ); // joCall.call ...
//         } ); // rpcCall.create ...
//     } catch ( err ) {
//         isSuccess = false;
//         const strError = owaspUtils.extract_error_message( err );
//         joRetVal.error = strError;
//         const strErrorMessage =
//             strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " +
//             cc.error( "JSON RPC call finished with error: " ) + cc.warning( strError ) +
//             "\n";
//         log.write( strErrorMessage );
//         details.write( strErrorMessage );
//     }
//     details.exposeDetailsTo( log, "handle_skale_call_via_redirect()", isSuccess );
//     details.close();
//     return joRetVal;
// }

export async function handle_skale_imaVerifyAndSign( joCallData ) {
    const strLogPrefix = "";
    const details = log.createMemoryStream( true );
    const joRetVal = { };
    let isSuccess = false;
    try {
        //
        details.write( strLogPrefix + cc.debug( "Will verify and sign " ) + cc.j( joCallData ) + "\n" );
        const nIdxCurrentMsgBlockStart = joCallData.params.startMessageIdx;
        const strFromChainName = joCallData.params.srcChainName;
        const strToChainName = joCallData.params.dstChainName;
        const strFromChainID = joCallData.params.srcChainID;
        const strToChainID = joCallData.params.dstChainID;
        const strDirection = joCallData.params.direction;
        const jarrMessages = joCallData.params.messages;
        details.write(
            strLogPrefix + cc.sunny( strDirection ) +
            cc.debug( " verification algorithm will work for transfer from chain " ) +
            cc.info( strFromChainName ) + cc.debug( "/" ) + cc.notice( strFromChainID ) +
            cc.debug( " to chain" ) +
            cc.info( strToChainName ) + cc.debug( "/" ) + cc.notice( strToChainID ) +
            cc.debug( " and work with array of message(s) " ) + cc.j( jarrMessages ) +
            "\n" );
        const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
        const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
        details.write( strLogPrefix + cc.sunny( strDirection ) + cc.debug( " verification algorithm discovered BLS threshold is " ) + cc.info( nThreshold ) + cc.debug( "." ) + "\n" );
        details.write( strLogPrefix + cc.sunny( strDirection ) + cc.debug( " verification algorithm discovered number of BLS participants is " ) + cc.info( nParticipants ) + cc.debug( "." ) + "\n" );
        const strMessageHash = owaspUtils.remove_starting_0x( keccak256_message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName ) );
        details.write( strLogPrefix + cc.sunny( strDirection ) + cc.debug( " verification algorithm message hash to sign is " ) + cc.info( strMessageHash ) + "\n" );
        //
        let joExtraSignOpts = null;
        if( strDirection == "S2S" ) {
            // joCallData.params.dstChainName
            // joCallData.params.srcChainName
            const strSChainNameSrc = joCallData.params.srcChainName;
            const strSChainNameDst = joCallData.params.dstChainName;
            details.write(
                strLogPrefix + cc.sunny( strDirection ) +
                cc.debug( " verification algorithm will use for source chain name " ) + cc.info( strSChainNameSrc ) +
                cc.debug( " and destination chain name " ) + cc.info( strSChainNameDst ) +
                "\n" );
            const arr_schains_cached = skale_observer.get_last_cached_schains();
            if( ( !arr_schains_cached ) || arr_schains_cached.length == 0 )
                throw new Error( "Could not handle " + strDirection + " skale_imaVerifyAndSign(1), no S-Chains in SKALE NETWORK observer cached yet, try again later" );
            //
            let jo_schain_src = null, strUrlSrcSChain = null;
            for( let idxSChain = 0; idxSChain < arr_schains_cached.length; ++ idxSChain ) {
                const jo_schain = arr_schains_cached[idxSChain];
                if( jo_schain.data.name.toString() == strSChainNameSrc.toString() ) {
                    jo_schain_src = jo_schain;
                    strUrlSrcSChain = skale_observer.pick_random_schain_w3_url( jo_schain );
                    break;
                }
            } // for( let idxSChain = 0; idxSChain < arr_schains_cached.length; ++ idxSChain )
            if( jo_schain_src == null || strUrlSrcSChain == null || strUrlSrcSChain.length == 0 )
                throw new Error( "Could not handle " + strDirection + " skale_imaVerifyAndSign(2), failed to discover source chain access parameters, try again later" );
            details.write(
                strLogPrefix + cc.sunny( strDirection ) +
                cc.debug( " verification algorithm discovered source chain URL is " ) + cc.u( strUrlSrcSChain ) +
                cc.debug( ", chain name is " ) + cc.info( jo_schain_src.data.computed.schain_id ) +
                cc.debug( ", chain id is " ) + cc.info( jo_schain_src.data.computed.chainId ) +
                "\n" );
            //
            joExtraSignOpts = {
                skale_observer: skale_observer,
                w3_src: skale_observer.getWeb3FromURL( strUrlSrcSChain, details ),
                chain_id_src: strFromChainName,
                chain_id_dst: strToChainName,
                cid_src: strFromChainID,
                cid_dst: strToChainID
            };
        }
        await check_correctness_of_messages_to_sign( details, strLogPrefix, strDirection, jarrMessages, nIdxCurrentMsgBlockStart, joExtraSignOpts );
        //
        let joAccount = imaState.chainProperties.sc.joAccount;
        if( ! joAccount.strURL ) {
            joAccount = imaState.chainProperties.mn.joAccount;
            if( ! joAccount.strSgxURL )
                throw new Error( "SGX URL is unknown, cannot sign IMA message(s)" );
            if( ! joAccount.strBlsKeyName )
                throw new Error( "BLS keys name is unknown, cannot sign IMA message(s)" );
        }
        let rpcCallOpts = null;
        if( "strPathSslKey" in joAccount && typeof joAccount.strPathSslKey == "string" && joAccount.strPathSslKey.length > 0 &&
            "strPathSslCert" in joAccount && typeof joAccount.strPathSslCert == "string" && joAccount.strPathSslCert.length > 0
        ) {
            rpcCallOpts = {
                "cert": fs.readFileSync( joAccount.strPathSslCert, "utf8" ),
                "key": fs.readFileSync( joAccount.strPathSslKey, "utf8" )
            };
            // details.write( cc.debug( "Will sign via SGX with SSL options " ) + cc.j( rpcCallOpts ) + "\n" );
        }
        const signerIndex = imaState.chainProperties.sc.joAccount.nNodeNumber;
        await rpcCall.create( joAccount.strSgxURL, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                const strErrorMessage =
                    strLogPrefix + cc.sunny( strDirection ) + " " + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call to SGX failed, RPC call was not created, error is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                log.write( strErrorMessage );
                details.write( strErrorMessage );
                if( joCall )
                    await joCall.disconnect();
                throw new Error( "JSON RPC call to SGX failed, RPC call was not created, error is: " + owaspUtils.extract_error_message( err ) );
            }
            const joCallSGX = {
                method: "blsSignMessageHash",
                // type: "BLSSignReq",
                params: {
                    keyShareName: joAccount.strBlsKeyName,
                    messageHash: strMessageHash,
                    n: nParticipants,
                    t: nThreshold,
                    signerIndex: signerIndex + 0 // 1-based
                }
            };
            details.write( strLogPrefix + cc.sunny( strDirection ) + cc.debug( " verification algorithm will invoke " ) + cc.info( "SGX" ) + cc.debug( " with call data " ) + cc.j( joCallSGX ) + "\n" );
            await joCall.call( joCallSGX, async function( joIn, joOut, err ) {
                if( err ) {
                    const strError = "JSON RPC call to SGX failed, RPC call reported error: " + owaspUtils.extract_error_message( err );
                    joRetVal.error = strError;
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to SGX failed, RPC call reported error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    await joCall.disconnect();
                    throw new Error( strError );
                }
                details.write( strLogPrefix + cc.sunny( strDirection ) + cc.debug( " Call to " ) + cc.info( "SGX" ) + cc.debug( " done, answer is: " ) + cc.j( joOut ) + "\n" );
                let joSignResult = joOut;
                if( joOut.result != null && joOut.result != undefined && typeof joOut.result == "object" )
                    joSignResult = joOut.result;
                if( joOut.signResult != null && joOut.signResult != undefined && typeof joOut.signResult == "object" )
                    joSignResult = joOut.signResult;
                if( "qa" in joCallData )
                    joRetVal.qa = joCallData.qa;
                if( "errorMessage" in joSignResult &&
                    typeof joSignResult.errorMessage == "string" &&
                    joSignResult.errorMessage.length > 0
                ) {
                    isSuccess = false;
                    const strError = "BLS signing finished with error: " + joSignResult.errorMessage;
                    joRetVal.error = strError;
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " BLS signing(2) finished with error: " ) + cc.warning( joSignResult.errorMessage ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    await joCall.disconnect();
                    throw new Error( strError );
                }
                isSuccess = true;
                joRetVal.result = { signResult: joSignResult };
                if( "qa" in joCallData )
                    joRetVal.qa = joCallData.qa;
                await joCall.disconnect();
            } ); // joCall.call ...
        } ); // rpcCall.create ...
    } catch ( err ) {
        isSuccess = false;
        const strError = owaspUtils.extract_error_message( err );
        joRetVal.error = strError;
        const strErrorMessage =
            strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " +
            cc.error( "IMA messages verifier/signer error: " ) + cc.warning( strError ) +
            "\n";
        log.write( strErrorMessage );
        details.write( strErrorMessage );
    }
    details.exposeDetailsTo( log, "IMA messages verifier/signer", isSuccess );
    details.close();
    return joRetVal;
}

export async function handle_skale_imaBSU256( joCallData ) {
    const strLogPrefix = "";
    const details = log.createMemoryStream( true );
    const joRetVal = { };
    let isSuccess = false;
    try {
        //
        details.write( strLogPrefix + cc.debug( "Will U256-BLS-sign " ) + cc.j( joCallData ) + "\n" );
        const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
        const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
        details.write( strLogPrefix + cc.debug( "Discovered BLS threshold is " ) + cc.info( nThreshold ) + cc.debug( "." ) + "\n" );
        details.write( strLogPrefix + cc.debug( "Discovered number of BLS participants is " ) + cc.info( nParticipants ) + cc.debug( "." ) + "\n" );
        //
        const u256 = joCallData.params.valueToSign;
        details.write( strLogPrefix + cc.debug( "U256 original value is " ) + cc.info( u256 ) + "\n" );
        const strMessageHash = keccak256_u256( u256, true );
        details.write( strLogPrefix + cc.debug( "hash of U256 value to sign is " ) + cc.info( strMessageHash ) + "\n" );
        //
        let joAccount = imaState.chainProperties.sc.joAccount;
        if( ! joAccount.strURL ) {
            joAccount = imaState.chainProperties.mn.joAccount;
            if( ! joAccount.strSgxURL )
                throw new Error( "SGX URL is unknown, cannot sign U256" );
            if( ! joAccount.strBlsKeyName )
                throw new Error( "BLS keys name is unknown, cannot sign U256" );
        }
        let rpcCallOpts = null;
        if( "strPathSslKey" in joAccount && typeof joAccount.strPathSslKey == "string" && joAccount.strPathSslKey.length > 0 &&
            "strPathSslCert" in joAccount && typeof joAccount.strPathSslCert == "string" && joAccount.strPathSslCert.length > 0
        ) {
            rpcCallOpts = {
                "cert": fs.readFileSync( joAccount.strPathSslCert, "utf8" ),
                "key": fs.readFileSync( joAccount.strPathSslKey, "utf8" )
            };
            // details.write( cc.debug( "Will sign via SGX with SSL options " ) + cc.j( rpcCallOpts ) + "\n" );
        }
        const signerIndex = imaState.chainProperties.sc.joAccount.nNodeNumber;
        await rpcCall.create( joAccount.strSgxURL, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                const strErrorMessage =
                    strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call to SGX failed, RPC call was not created, error is: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                log.write( strErrorMessage );
                details.write( strErrorMessage );
                if( joCall )
                    await joCall.disconnect();
                throw new Error( "JSON RPC call to SGX failed, RPC call was not created, error is: " + owaspUtils.extract_error_message( err ) );
            }
            const joCallSGX = {
                method: "blsSignMessageHash",
                // type: "BLSSignReq",
                params: {
                    keyShareName: joAccount.strBlsKeyName,
                    messageHash: strMessageHash,
                    n: nParticipants,
                    t: nThreshold,
                    signerIndex: signerIndex + 0 // 1-based
                }
            };
            details.write( strLogPrefix + cc.debug( "Will invoke " ) + cc.info( "SGX" ) + cc.debug( " with call data " ) + cc.j( joCallSGX ) + "\n" );
            await joCall.call( joCallSGX, async function( joIn, joOut, err ) {
                if( err ) {
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to SGX failed, RPC call reported error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    await joCall.disconnect();
                    throw new Error( "JSON RPC call to SGX failed, RPC call reported error: " + owaspUtils.extract_error_message( err ) );
                }
                details.write( strLogPrefix + cc.debug( "Call to " ) + cc.info( "SGX" ) + cc.debug( " done, answer is: " ) + cc.j( joOut ) + "\n" );
                let joSignResult = joOut;
                if( joOut.result != null && joOut.result != undefined && typeof joOut.result == "object" )
                    joSignResult = joOut.result;
                if( joOut.signResult != null && joOut.signResult != undefined && typeof joOut.signResult == "object" )
                    joSignResult = joOut.signResult;
                if( "errorMessage" in joSignResult &&
                    typeof joSignResult.errorMessage == "string" &&
                    joSignResult.errorMessage.length > 0
                ) {
                    isSuccess = false;
                    const strError = "BLS signing finished with error: " + joSignResult.errorMessage;
                    joRetVal.error = strError;
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " BLS signing(3) finished with error: " ) + cc.warning( joSignResult.errorMessage ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    await joCall.disconnect();
                    throw new Error( strError );
                }
                isSuccess = true;
                joRetVal.result = { signResult: joSignResult };
                if( "qa" in joCallData )
                    joRetVal.qa = joCallData.qa;
                await joCall.disconnect();
            } ); // joCall.call ...
        } ); // rpcCall.create ...
    } catch ( err ) {
        isSuccess = false;
        const strError = owaspUtils.extract_error_message( err );
        joRetVal.error = strError;
        const strErrorMessage =
            strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " +
            cc.error( "U256-BLS-signer error: " ) + cc.warning( strError ) +
            "\n";
        log.write( strErrorMessage );
        details.write( strErrorMessage );
    }
    details.exposeDetailsTo( log, "U256-BLS-signer", isSuccess );
    details.close();
    return joRetVal;
}
