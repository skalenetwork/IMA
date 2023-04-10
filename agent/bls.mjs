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
import * as shell_mod from "shelljs";
import * as imaUtils from "./utils.mjs";
import * as sha3_mod from "sha3";
import * as skale_observer from "../npms/skale-observer/observer.mjs";

import * as state from "./state.mjs";
import { randomCallID } from "../npms/skale-cool-socket/socket_utils.mjs";

const shell = shell_mod.default;

const Keccak = sha3_mod.Keccak;

const sleep =
    ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

const g_secondsMessageVerifySendTimeout = 2 * 60;

async function with_timeout( strDescription, promise, seconds ) {
    strDescription = strDescription || "with_timeout()";
    let result_err = null, isComplete = false;
    promise.catch( function( err ) {
        isComplete = true;
        result_err =
            new Error( strDescription + "error: " + owaspUtils.extract_error_message( err ) );
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
    const imaState = state.get();
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
    const imaState = state.get();
    joSChainNetworkInfo = joSChainNetworkInfo || imaState.joSChainNetworkInfo;
    if( ! joSChainNetworkInfo )
        return -1;
    const jarrNodes = joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++i ) {
        const joNode = jarrNodes[i];
        if( joNode && "imaInfo" in joNode &&
            typeof joNode.imaInfo === "object" &&
            "n" in joNode.imaInfo &&
            typeof joNode.imaInfo.n === "number" &&
            joNode.imaInfo.n > 0
        )
            return joNode.imaInfo.n;
    }
    return -1;
}

function discover_public_key_by_index( nNodeIndex, joSChainNetworkInfo ) {
    const imaState = state.get();
    joSChainNetworkInfo = joSChainNetworkInfo || imaState.joSChainNetworkInfo;
    const jarrNodes = joSChainNetworkInfo.network;
    const joNode = jarrNodes[nNodeIndex];
    if( joNode && "imaInfo" in joNode && typeof joNode.imaInfo === "object" &&
        "BLSPublicKey0" in joNode.imaInfo &&
        typeof joNode.imaInfo.BLSPublicKey0 === "string" &&
        joNode.imaInfo.BLSPublicKey0.length > 0 &&
        "BLSPublicKey1" in joNode.imaInfo &&
        typeof joNode.imaInfo.BLSPublicKey1 === "string" &&
        joNode.imaInfo.BLSPublicKey1.length > 0 &&
        "BLSPublicKey2" in joNode.imaInfo &&
        typeof joNode.imaInfo.BLSPublicKey2 === "string" &&
        joNode.imaInfo.BLSPublicKey2.length > 0 &&
        "BLSPublicKey3" in joNode.imaInfo &&
        typeof joNode.imaInfo.BLSPublicKey3 === "string" &&
        joNode.imaInfo.BLSPublicKey3.length > 0
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
    const imaState = state.get();
    joSChainNetworkInfo = joSChainNetworkInfo || imaState.joSChainNetworkInfo;
    const jarrNodes = joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++i ) {
        const joNode = jarrNodes[i];
        if( joNode && "imaInfo" in joNode && typeof joNode.imaInfo === "object" &&
            "commonBLSPublicKey0" in joNode.imaInfo &&
            typeof joNode.imaInfo.commonBLSPublicKey0 === "string" &&
            joNode.imaInfo.commonBLSPublicKey0.length > 0 &&
            "commonBLSPublicKey1" in joNode.imaInfo &&
            typeof joNode.imaInfo.commonBLSPublicKey1 === "string" &&
            joNode.imaInfo.commonBLSPublicKey1.length > 0 &&
            "commonBLSPublicKey2" in joNode.imaInfo &&
            typeof joNode.imaInfo.commonBLSPublicKey2 === "string" &&
            joNode.imaInfo.commonBLSPublicKey2.length > 0 &&
            "commonBLSPublicKey3" in joNode.imaInfo &&
            typeof joNode.imaInfo.commonBLSPublicKey3 === "string" &&
            joNode.imaInfo.commonBLSPublicKey3.length > 0
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
    const k = new Keccak( 256 );
    k.update( imaUtils.toBuffer( arrBytes ) );
    const h = k.digest( "hex" );
    return imaUtils.hexToBytes( "0x" + h );
}

function keccak256_message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName ) {
    let arrBytes = s2ha( strFromChainName );
    arrBytes = imaUtils.bytesConcat(
        arrBytes,
        hexPrepare(
            owaspUtils.ensure_starts_with_0x( nIdxCurrentMsgBlockStart.toString( 16 ) ),
            false,
            false
        )
    );
    arrBytes = a2ha( arrBytes );
    let i = 0; const cnt = jarrMessages.length;
    for( i = 0; i < cnt; ++i ) {
        const joMessage = jarrMessages[i];

        let bytesSender = imaUtils.hexToBytes( joMessage.sender.toString() );
        bytesSender = imaUtils.bytesAlignLeftWithZeroes( bytesSender, 32 );
        arrBytes = imaUtils.bytesConcat( arrBytes, bytesSender );

        let bytesDestinationContract =
            imaUtils.hexToBytes( joMessage.destinationContract );
        bytesDestinationContract =
            imaUtils.bytesAlignLeftWithZeroes( bytesDestinationContract, 32 );
        arrBytes = imaUtils.bytesConcat( arrBytes, bytesDestinationContract );

        const bytesData = imaUtils.hexToBytes( joMessage.data );
        arrBytes = imaUtils.bytesConcat( arrBytes, bytesData );
        arrBytes = a2ha( arrBytes );
    }
    return owaspUtils.ensure_starts_with_0x( imaUtils.bytesToHex( arrBytes, false ) );
}

export function keccak256_u256( u256, isHash ) {
    let arrBytes = new Uint8Array();

    let bytes_u256 = imaUtils.hexToBytes( u256 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    bytes_u256 = imaUtils.bytesAlignLeftWithZeroes( bytes_u256, 32 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytes_u256 );

    let strMessageHash = "";
    if( isHash ) {
        const hash = new Keccak( 256 );
        hash.update( imaUtils.toBuffer( arrBytes ) );
        strMessageHash = hash.digest( "hex" );
    } else
        strMessageHash = "0x" + imaUtils.bytesToHex( arrBytes );
    return strMessageHash;
}

export function keccak256_4_pending_work_analysis( nNodeNumber, strLoopWorkType, isStart, ts ) {
    let arrBytes = new Uint8Array();

    let bytes_u256 = imaUtils.hexToBytes( nNodeNumber );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    bytes_u256 = imaUtils.bytesAlignLeftWithZeroes( bytes_u256, 32 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytes_u256 );

    arrBytes = imaUtils.bytesConcat( arrBytes, s2ha( strLoopWorkType ) );

    bytes_u256 = imaUtils.hexToBytes( isStart ? 1 : 0 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    bytes_u256 = imaUtils.bytesAlignLeftWithZeroes( bytes_u256, 32 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytes_u256 );

    bytes_u256 = imaUtils.hexToBytes( ts );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    bytes_u256 = imaUtils.bytesAlignLeftWithZeroes( bytes_u256, 32 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytes_u256 );
    //
    const hash = new Keccak( 256 );
    hash.update( imaUtils.toBuffer( arrBytes ) );
    const strMessageHash = hash.digest( "hex" );
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
    const strActionDir =
        get_bls_glue_tmp_dir() + "/" + imaUtils.replaceAll( imaUtils.uuid(), "-", "" );
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
    const imaState = state.get();
    const strLogPrefix =
        cc.bright( strDirection ) + cc.debug( "/" ) +
        cc.info( "BLS" ) + cc.debug( "/" ) +
        cc.attention( "Glue" ) + cc.debug( ":" ) + " ";
    let joGlueResult = null;
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    details.write( strLogPrefix +
        cc.debug( "Discovered BLS threshold is " ) +
        cc.info( nThreshold ) + cc.debug( "." ) +
        "\n" );
    details.write( strLogPrefix +
        cc.debug( "Discovered number of BLS participants is " ) +
        cc.info( nParticipants ) + cc.debug( "." ) +
        "\n" );
    const strMessageHash =
        owaspUtils.remove_starting_0x(
            keccak256_message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName )
        );
    details.write( strLogPrefix +
        cc.debug( "Message hash to sign is " ) + cc.info( strMessageHash ) +
        "\n" );
    const strActionDir = alloc_bls_tmp_action_dir();
    details.write( strLogPrefix +
        cc.debug( "perform_bls_glue will work in " ) + cc.info( strActionDir ) +
        cc.debug( " director with " ) + cc.info( arrSignResults.length ) +
        cc.debug( " sign results..." ) +
        "\n" );
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        let strInput = "";
        let i = 0; const cnt = arrSignResults.length;
        for( i = 0; i < cnt; ++i ) {
            const jo = arrSignResults[i];
            const strPath = strActionDir + "/sign-result" + jo.index + ".json";
            details.write( strLogPrefix +
                cc.debug( "Saving " ) + cc.notice( strPath ) +
                cc.debug( " file containing " ) + cc.j( jo ) +
                "\n" );
            imaUtils.jsonFileSave( strPath, jo );
            strInput += " --input " + strPath;
        }
        const strGlueCommand =
            imaState.strPathBlsGlue +
            " --t " + nThreshold +
            " --n " + nParticipants +
            strInput +
            " --output " + strActionDir + "/glue-result.json";
        details.write( strLogPrefix +
            cc.debug( "Will execute BLS glue command:\n" ) + cc.notice( strGlueCommand ) +
            "\n" );
        strOutput = child_process.execSync( strGlueCommand, { cwd: strActionDir } );
        details.write( strLogPrefix +
            cc.debug( "BLS glue output is:\n" ) + cc.notice( strOutput ) +
            "\n" );
        joGlueResult = imaUtils.jsonFileLoad( strActionDir + "/glue-result.json" );
        details.write( strLogPrefix +
            cc.debug( "BLS glue result is: " ) + cc.j( joGlueResult ) +
            "\n" );
        if( "X" in joGlueResult.signature && "Y" in joGlueResult.signature ) {
            details.write( strLogPrefix + cc.success( "BLS glue success" ) + "\n" );
            joGlueResult.hashSrc = strMessageHash;
            //
            details.write( strLogPrefix +
                cc.debug( "Computing " ) + cc.info( "G1" ) + cc.debug( " hash point..." ) +
                "\n" );
            const strPath = strActionDir + "/hash.json";
            details.write( strLogPrefix +
                cc.debug( "Saving " ) + cc.notice( strPath ) + cc.debug( " file..." ) +
                "\n" );
            imaUtils.jsonFileSave( strPath, { "message": strMessageHash } );
            const strHasG1Command =
                imaState.strPathHashG1 +
                " --t " + nThreshold +
                " --n " + nParticipants;
            details.write( strLogPrefix +
                cc.debug( "Will execute HashG1 command:\n" ) + cc.notice( strHasG1Command ) +
                "\n" );
            strOutput = child_process.execSync( strHasG1Command, { cwd: strActionDir } );
            details.write( strLogPrefix +
                cc.debug( "HashG1 output is:\n" ) + cc.notice( strOutput ) +
                "\n" );
            const joResultHashG1 = imaUtils.jsonFileLoad( strActionDir + "/g1.json" );
            details.write( strLogPrefix +
                cc.debug( "HashG1 result is: " ) + cc.j( joResultHashG1 ) +
                "\n" );
            //
            if( "g1" in joResultHashG1 &&
                "hint" in joResultHashG1.g1 &&
                "hashPoint" in joResultHashG1.g1 &&
                "X" in joResultHashG1.g1.hashPoint &&
                "Y" in joResultHashG1.g1.hashPoint
            ) {
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
        fnShellRestore();
    } catch ( err ) {
        const s1 = strLogPrefix +
            cc.fatal( "BLS glue CRITICAL ERROR:" ) + cc.error( " error description is: " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n";
        const s2 = strLogPrefix +
            cc.error( "BLS glue output is:\n" ) + cc.notice( strOutput ) +
            "\n";
        details.write( s1 );
        details.write( s2 );
        fnShellRestore();
        joGlueResult = null;
    }
    return joGlueResult;
}

function perform_bls_glue_u256( details, u256, arrSignResults ) {
    const imaState = state.get();
    const strLogPrefix =
        cc.info( "BLS" ) + cc.debug( "/" ) + cc.attention( "Glue" ) +
        cc.debug( ":" ) + " ";
    let joGlueResult = null;
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    details.write( strLogPrefix +
        cc.debug( "Discovered BLS threshold is " ) +
        cc.info( nThreshold ) + cc.debug( "." ) +
        "\n" );
    details.write( strLogPrefix +
        cc.debug( "Discovered number of BLS participants is " ) +
        cc.info( nParticipants ) + cc.debug( "." ) +
        "\n" );
    details.write( strLogPrefix +
        cc.debug( "Original long message is " ) + cc.info( keccak256_u256( u256, false ) ) +
        "\n" );
    const strMessageHash = keccak256_u256( u256, true );
    details.write( strLogPrefix +
        cc.debug( "Message hash to sign is " ) + cc.info( strMessageHash ) +
        "\n" );
    const strActionDir = alloc_bls_tmp_action_dir();
    details.write( strLogPrefix +
        cc.debug( "perform_bls_glue_u256 will work in " ) + cc.info( strActionDir ) +
        cc.debug( " director with " ) + cc.info( arrSignResults.length ) +
        cc.debug( " sign results..." ) +
        "\n" );
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        let strInput = "";
        let i = 0; const cnt = arrSignResults.length;
        for( i = 0; i < cnt; ++i ) {
            const jo = arrSignResults[i];
            const strPath = strActionDir + "/sign-result" + jo.index + ".json";
            details.write( strLogPrefix +
                cc.debug( "Saving " ) + cc.notice( strPath ) + cc.debug( " file..." ) +
                "\n" );
            imaUtils.jsonFileSave( strPath, jo );
            strInput += " --input " + strPath;
        }
        const strGlueCommand =
            imaState.strPathBlsGlue +
            " --t " + nThreshold +
            " --n " + nParticipants +
            strInput +
            " --output " + strActionDir + "/glue-result.json";
        details.write( strLogPrefix +
            cc.debug( "Will execute BLS glue command:\n" ) + cc.notice( strGlueCommand ) +
            "\n" );
        strOutput = child_process.execSync( strGlueCommand, { cwd: strActionDir } );
        details.write( strLogPrefix +
            cc.debug( "BLS glue output is:\n" ) + cc.notice( strOutput ) +
            "\n" );
        joGlueResult = imaUtils.jsonFileLoad( strActionDir + "/glue-result.json" );
        details.write( strLogPrefix +
            cc.debug( "BLS glue result is: " ) + cc.j( joGlueResult ) +
            "\n" );
        if( "X" in joGlueResult.signature && "Y" in joGlueResult.signature ) {
            details.write( strLogPrefix +
                cc.success( "BLS glue success" ) +
                "\n" );
            joGlueResult.hashSrc = strMessageHash;

            details.write( strLogPrefix +
                cc.debug( "Computing " ) + cc.info( "G1" ) + cc.debug( " hash point..." ) +
                "\n" );
            const strPath = strActionDir + "/hash.json";
            details.write( strLogPrefix +
                cc.debug( "Saving " ) + cc.notice( strPath ) + cc.debug( " file..." ) +
                "\n" );
            imaUtils.jsonFileSave( strPath, { "message": strMessageHash } );
            const strHasG1Command =
                imaState.strPathHashG1 +
                " --t " + nThreshold +
                " --n " + nParticipants;
            details.write( strLogPrefix +
                cc.debug( "Will execute HashG1 command:\n" ) + cc.notice( strHasG1Command ) +
                "\n" );
            strOutput = child_process.execSync( strHasG1Command, { cwd: strActionDir } );
            details.write( strLogPrefix +
                cc.debug( "HashG1 output is:\n" ) + cc.notice( strOutput ) +
                "\n" );
            const joResultHashG1 = imaUtils.jsonFileLoad( strActionDir + "/g1.json" );
            details.write( strLogPrefix +
                cc.debug( "HashG1 result is: " ) + cc.j( joResultHashG1 ) +
                "\n" );

            if( "g1" in joResultHashG1 &&
                "hint" in joResultHashG1.g1 &&
                "hashPoint" in joResultHashG1.g1 &&
                "X" in joResultHashG1.g1.hashPoint &&
                "Y" in joResultHashG1.g1.hashPoint
            ) {
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
        fnShellRestore();
    } catch ( err ) {
        const s1 = strLogPrefix +
            cc.fatal( "BLS glue CRITICAL ERROR:" ) + cc.error( " error description is: " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) + "\n" +
            cc.error( ", stack is: " ) + cc.stack( err.stack ) +
            "\n";
        const s2 = strLogPrefix +
            cc.error( "BLS glue output is:\n" ) + cc.notice( strOutput ) +
            "\n";
        details.write( s1 );
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
    const imaState = state.get();
    const strLogPrefix =
        cc.bright( strDirection ) + cc.debug( "/" ) + cc.info( "BLS" ) + cc.debug( "/" ) +
        cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) + cc.debug( ":" ) + " ";
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        details.write( strLogPrefix +
            cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " - first message nonce is " ) + cc.info( nIdxCurrentMsgBlockStart ) +
            "\n" );
        details.write( strLogPrefix +
            cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " - first source chain name is " ) + cc.info( strFromChainName ) +
            "\n" );
        details.write( strLogPrefix +
            cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " - messages array " ) + cc.j( jarrMessages ) +
            "\n" );
        const strMessageHash =
            owaspUtils.remove_starting_0x(
                keccak256_message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName )
            );
        details.write( strLogPrefix +
            cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " - hashed verify message is " ) + cc.info( strMessageHash ) +
            "\n" );
        const joMsg = {
            "message": strMessageHash
        };
        details.write( strLogPrefix +
            cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " - composed  " ) + cc.j( joMsg ) + cc.debug( " composed from " ) +
            cc.j( jarrMessages ) + cc.debug( " using glue " ) + cc.j( joResultFromNode ) +
            cc.debug( " and public key " ) + cc.j( joPublicKey ) +
            "\n" );
        const strSignResultFileName = strActionDir + "/sign-result" + nZeroBasedNodeIndex + ".json";
        imaUtils.jsonFileSave( strSignResultFileName, joResultFromNode );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        imaUtils.jsonFileSave(
            strActionDir + "/BLS_keys" + nZeroBasedNodeIndex + ".json", joPublicKey );
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --j " + nZeroBasedNodeIndex +
            " --input " + strSignResultFileName
            ;
        details.write( strLogPrefix +
            cc.debug( "Will execute node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " BLS verify command:\n" ) + cc.notice( strVerifyCommand ) +
            "\n" );
        strOutput = child_process.execSync( strVerifyCommand, { cwd: strActionDir } );
        details.write( strLogPrefix +
            cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " verify output is:\n" ) + cc.notice( strOutput ) +
            "\n" );
        details.write( strLogPrefix +
            cc.success( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.success( " verify success" ) +
            "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix +
            cc.fatal( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) +
            cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify error:" ) +
            cc.warning( " error description is: " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n";
        const s2 = strLogPrefix +
            cc.error( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) +
            cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.error( " verify output is:\n" ) + cc.notice( strOutput ) +
            "\n";
        details.write( s1 );
        details.write( s2 );
        fnShellRestore();
    }
    return false;
}

function perform_bls_verify_i_u256(
    details,
    nZeroBasedNodeIndex,
    joResultFromNode,
    u256,
    joPublicKey
) {
    if( ! joResultFromNode )
        return true;
    const imaState = state.get();
    const strLogPrefix =
        cc.info( "BLS" ) + cc.debug( "/" ) +
        cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) +
        cc.debug( ":" ) + " ";
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        const joMsg = { "message": keccak256_u256( u256, true ) };
        details.write( strLogPrefix +
            cc.debug( "BLS u256 node " ) +
            cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " verify message " ) + cc.j( joMsg ) +
            cc.debug( " composed from " ) + cc.j( u256 ) +
            cc.debug( " using glue " ) + cc.j( joResultFromNode ) +
            cc.debug( " and public key " ) + cc.j( joPublicKey ) +
            "\n" );
        const strSignResultFileName = strActionDir + "/sign-result" + nZeroBasedNodeIndex + ".json";
        imaUtils.jsonFileSave( strSignResultFileName, joResultFromNode );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        imaUtils.jsonFileSave(
            strActionDir + "/BLS_keys" + nZeroBasedNodeIndex + ".json", joPublicKey );
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --j " + nZeroBasedNodeIndex +
            " --input " + strSignResultFileName
            ;
        details.write( strLogPrefix +
            cc.debug( "Will execute node " ) +
            cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " BLS u256 verify command:\n" ) + cc.notice( strVerifyCommand ) +
            "\n" );
        strOutput = child_process.execSync( strVerifyCommand, { cwd: strActionDir } );
        details.write( strLogPrefix +
            cc.debug( "BLS u256 node " ) +
            cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " verify output is:\n" ) + cc.notice( strOutput ) +
            "\n" );
        details.write( strLogPrefix +
            cc.success( "BLS u256 node " ) +
            cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.success( " verify success" ) +
            "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix +
            cc.fatal( "CRITICAL ERROR:" ) + cc.error( " BLS u256 node " ) +
            cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.error( " verify error:" ) +
            cc.warning( " error description is: " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n";
        const s2 = strLogPrefix +
            cc.error( "CRITICAL ERROR:" ) + cc.error( " BLS u256 node " ) +
            cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.error( " verify output is:\n" ) + cc.notice( strOutput ) +
            "\n";
        details.write( s1 );
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
    const imaState = state.get();
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    const strLogPrefix =
        cc.bright( strDirection ) + cc.debug( "/" ) +
        cc.info( "BLS" ) + cc.debug( "/" ) +
        cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
    try {
        details.write( strLogPrefix +
            cc.debug( "BLS/summary verify message - first message nonce is " ) +
            cc.info( nIdxCurrentMsgBlockStart ) +
            "\n" );
        details.write( strLogPrefix +
            cc.debug( "BLS/summary verify message - first source chain name is " ) +
            cc.info( strFromChainName ) +
            "\n" );
        details.write( strLogPrefix +
            cc.debug( "BLS/summary verify message - messages array " ) + cc.j( jarrMessages ) +
            "\n" );
        const strMessageHash =
            owaspUtils.remove_starting_0x(
                keccak256_message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName )
            );
        details.write( strLogPrefix +
            cc.debug( "BLS/summary verify message - hashed verify message is " ) +
            cc.info( strMessageHash ) +
            "\n" );
        const joMsg = { "message": strMessageHash };
        details.write( strLogPrefix +
            cc.debug( "BLS/summary verify message - composed JSON " ) + cc.j( joMsg ) +
            cc.debug( " from messages array " ) + cc.j( jarrMessages ) +
            cc.debug( " using glue " ) + cc.j( joGlueResult ) +
            cc.debug( " and common public key " ) + cc.j( joCommonPublicKey ) +
            "\n" );
        imaUtils.jsonFileSave( strActionDir + "/glue-result.json", joGlueResult );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        const joCommonPublicKey_for_O = {
            commonBLSPublicKey0: joCommonPublicKey.commonBLSPublicKey0,
            commonBLSPublicKey1: joCommonPublicKey.commonBLSPublicKey1,
            commonBLSPublicKey2: joCommonPublicKey.commonBLSPublicKey2,
            commonBLSPublicKey3: joCommonPublicKey.commonBLSPublicKey3
        };
        imaUtils.jsonFileSave( strActionDir + "/common_public_key.json", joCommonPublicKey_for_O );
        details.write( strLogPrefix +
            cc.debug( "BLS common public key for verification is:\n" ) +
            cc.j( joCommonPublicKey ) +
            "\n" );
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --input " + "./glue-result.json"
            ;
        details.write( strLogPrefix +
            cc.debug( "Will execute BLS/summary verify command:\n" ) +
            cc.notice( strVerifyCommand ) +
            "\n" );
        strOutput = child_process.execSync( strVerifyCommand, { cwd: strActionDir } );
        details.write( strLogPrefix +
            cc.debug( "BLS/summary verify output is:\n" ) + cc.notice( strOutput ) +
            "\n" );
        details.write( strLogPrefix +
            cc.success( "BLS/summary verify success" ) +
            "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix +
            cc.fatal( "BLS/summary verify CRITICAL ERROR:" ) +
            cc.error( " error description is: " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n";
        const s2 = strLogPrefix +
        cc.error( "BLS/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n";
        details.write( s1 );
        details.write( s2 );
        fnShellRestore();
    }
    return false;
}

function perform_bls_verify_u256( details, joGlueResult, u256, joCommonPublicKey ) {
    if( !joGlueResult )
        return true;
    const imaState = state.get();
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    const strLogPrefix =
        cc.info( "BLS u256" ) + cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
    try {
        const joMsg = { "message": keccak256_u256( u256, true ) };
        details.write( strLogPrefix +
            cc.debug( "BLS u256/summary verify message " ) + cc.j( joMsg ) +
            cc.debug( " composed from " ) + cc.j( u256 ) +
            cc.debug( " using glue " ) + cc.j( joGlueResult ) +
            cc.debug( " and common public key " ) + cc.j( joCommonPublicKey ) +
            "\n" );
        imaUtils.jsonFileSave( strActionDir + "/glue-result.json", joGlueResult );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        const joCommonPublicKey_for_O = {
            commonBLSPublicKey0: joCommonPublicKey.commonBLSPublicKey0,
            commonBLSPublicKey1: joCommonPublicKey.commonBLSPublicKey1,
            commonBLSPublicKey2: joCommonPublicKey.commonBLSPublicKey2,
            commonBLSPublicKey3: joCommonPublicKey.commonBLSPublicKey3
        };
        imaUtils.jsonFileSave( strActionDir + "/common_public_key.json", joCommonPublicKey_for_O );
        details.write( strLogPrefix +
            cc.debug( "BLS u256 common public key for verification is:\n" ) +
            cc.j( joCommonPublicKey ) +
            "\n" );
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --input " + "./glue-result.json"
            ;
        details.write( strLogPrefix +
            cc.debug( "Will execute BLS u256/summary verify command:\n" ) +
            cc.notice( strVerifyCommand ) +
            "\n" );
        strOutput = child_process.execSync( strVerifyCommand, { cwd: strActionDir } );
        details.write( strLogPrefix +
            cc.debug( "BLS u256/summary verify output is:\n" ) + cc.notice( strOutput ) +
            "\n" );
        details.write( strLogPrefix +
            cc.success( "BLS u256/summary verify success" ) +
            "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix +
            cc.fatal( "BLS u256/summary verify CRITICAL ERROR:" ) +
            cc.error( " error description is: " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n";
        const s2 = strLogPrefix +
            cc.error( "BLS u256/summary verify output is:\n" ) +
            cc.notice( strOutput ) +
            "\n";
        details.write( s1 );
        details.write( s2 );
        fnShellRestore();
    }
    return false;
}

async function check_correctness_of_messages_to_sign(
    details,
    strLogPrefix,
    strDirection,
    jarrMessages,
    nIdxCurrentMsgBlockStart,
    joExtraSignOpts
) {
    const imaState = state.get();
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
        joAccount = imaState.chainProperties.sc.joAccount;
        joChainName = joExtraSignOpts.chain_id_dst;
        const ethersProvider =
            ( "ethersProvider_src" in joExtraSignOpts &&
                joExtraSignOpts.ethersProvider_src )
                ? joExtraSignOpts.ethersProvider_src
                : null
                ;
        if( ! ethersProvider ) {
            throw new Error(
                "CRITICAL ERROR: No provider specified in " +
                "extra signing options for checking messages of direction \"" +
                strDirection + "\"" );
        }
        joMessageProxy =
            new owaspUtils.ethersMod.ethers.Contract(
                imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_address,
                imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_abi,
                ethersProvider
            );
    } else {
        throw new Error(
            "CRITICAL ERROR: Failed check_correctness_of_messages_to_sign() " +
            "with unknown direction \"" + strDirection + "\"" );
    }

    const strCallerAccountAddress = joAccount.address();
    details.write(
        strLogPrefix + cc.bright( strDirection ) +
        cc.debug( " message correctness validation through call to " ) +
        cc.notice( "verifyOutgoingMessageData" ) +
        cc.debug( " method of " ) + cc.bright( "MessageProxy" ) +
        cc.debug( " contract with address " ) + cc.notice( joMessageProxy.address ) +
        cc.debug( ", caller account address is " ) + cc.info( joMessageProxy.address ) +
        cc.debug( ", message(s) count is " ) + cc.info( jarrMessages.length ) +
        cc.debug( ", message(s) to process are " ) + cc.j( jarrMessages ) +
        cc.debug( ", first real message index is " ) + cc.info( nIdxCurrentMsgBlockStart ) +
        cc.debug( ", messages will be sent to chain name " ) + cc.info( joChainName ) +
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
                    strLogPrefix + cc.bright( strDirection ) +
                    cc.debug( " Will validate message " ) +
                    cc.info( i ) + cc.debug( " of " ) + cc.info( cnt ) +
                    cc.debug( ", real message index is " ) + cc.info( idxMessage ) +
                    cc.debug( ", source contract is " ) + cc.info( joMessage.sender ) +
                    cc.debug( ", destination contract is " ) +
                    cc.info( joMessage.destinationContract ) +
                    cc.debug( ", message data is " ) + cc.j( joMessage.data ) +
                    "\n" );
                const outgoingMessageData = {
                    "dstChainHash": owaspUtils.ethersMod.ethers.utils.id( joChainName ),
                    "msgCounter": 0 + idxMessage,
                    "srcContract": joMessage.sender,
                    "dstContract": joMessage.destinationContract,
                    "data": joMessage.data
                };
                const isValidMessage = await joMessageProxy.callStatic.verifyOutgoingMessageData(
                    outgoingMessageData,
                    { from: strCallerAccountAddress }
                );
                details.write(
                    strLogPrefix + cc.bright( strDirection ) +
                    cc.debug( " Got verification call result " ) + cc.tf( isValidMessage ) +
                    cc.debug( ", real message index is: " ) + cc.info( idxMessage ) +
                    cc.debug( ", saved msgCounter is: " ) +
                    cc.info( outgoingMessageData.msgCounter ) +
                    "\n" );
                if( !isValidMessage ) {
                    throw new Error(
                        "Bad message detected, message is: " + JSON.stringify( joMessage ) );
                }
            } catch ( err ) {
                ++cntBadMessages;
                const s =
                    strLogPrefix + cc.fatal( "BAD ERROR:" ) + " " +
                    cc.bright( strDirection ) +
                    cc.error( " Correctness validation failed for message " ) +
                    cc.info( idxMessage ) +
                    cc.error( " sent to " ) + cc.info( joChainName ) +
                    cc.error( ", message is: " ) + cc.j( joMessage ) +
                    cc.error( ", error information: " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) +
                    cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
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
    } else {
        details.write( strLogPrefix +
            cc.success( "Correctness validation passed for " ) + cc.info( cnt ) +
            cc.success( " message(s)" ) +
            "\n" );
    }
}

async function prepare_sign_messages_impl( optsSignOperation ) {
    optsSignOperation.fn = optsSignOperation.fn || function() {};
    optsSignOperation.sequence_id =
        owaspUtils.remove_starting_0x(
            owaspUtils.ethersMod.ethers.utils.id( log.generate_timestamp_string( null, false ) )
        );
    optsSignOperation.jarrNodes = optsSignOperation.imaState.joSChainNetworkInfo.network;
    optsSignOperation.details.write( optsSignOperation.strLogPrefix +
        cc.debug( " Invoking " ) + cc.bright( optsSignOperation.strDirection ) +
        cc.debug( " signing messages procedure " ) +
        "\n" );
    if( !( optsSignOperation.imaState.bSignMessages &&
        optsSignOperation.imaState.strPathBlsGlue.length > 0 &&
        optsSignOperation.imaState.joSChainNetworkInfo
    ) ) {
        optsSignOperation.bHaveResultReportCalled = true;
        optsSignOperation.details.write( optsSignOperation.strLogPrefix +
            cc.debug( "BLS message signing is " ) +
            cc.error( "turned off" ) +
            cc.debug( ", first real message index is: " ) +
            cc.info( optsSignOperation.nIdxCurrentMsgBlockStart ) +
            cc.debug( ", have " ) +
            cc.info( optsSignOperation.jarrMessages.length ) +
            cc.debug( " message(s) to process: " ) +
            cc.j( optsSignOperation.jarrMessages ) +
            "\n" );
        optsSignOperation.details.exposeDetailsTo(
            log, optsSignOperation.strGatheredDetailsName, false );
        optsSignOperation.details.close();
        await check_correctness_of_messages_to_sign(
            optsSignOperation.details, optsSignOperation.strLogPrefix,
            optsSignOperation.strDirection,
            optsSignOperation.jarrMessages,
            optsSignOperation.nIdxCurrentMsgBlockStart,
            optsSignOperation.joExtraSignOpts
        );
        await optsSignOperation.fn( null, optsSignOperation.jarrMessages, null );
        return;
    }
    await check_correctness_of_messages_to_sign(
        optsSignOperation.details, optsSignOperation.strLogPrefix,
        optsSignOperation.strDirection,
        optsSignOperation.jarrMessages, optsSignOperation.nIdxCurrentMsgBlockStart,
        optsSignOperation.joExtraSignOpts
    );
    optsSignOperation.details.write( optsSignOperation.strLogPrefix +
        cc.debug( "Will sign " ) + cc.info( optsSignOperation.jarrMessages.length ) +
        cc.debug( " message(s)" ) +
        cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) +
        cc.attention( optsSignOperation.sequence_id ) +
        cc.debug( "..." ) + "\n" );
    optsSignOperation.details.write( optsSignOperation.strLogPrefix +
        cc.debug( "Will query to sign " ) + cc.info( optsSignOperation.jarrNodes.length ) +
        cc.debug( " skaled node(s)..." ) +
        "\n" );
    optsSignOperation.nThreshold =
        discover_bls_threshold( optsSignOperation.imaState.joSChainNetworkInfo );
    optsSignOperation.nParticipants =
        discover_bls_participants( optsSignOperation.imaState.joSChainNetworkInfo );
    optsSignOperation.details.write( optsSignOperation.strLogPrefix +
        cc.debug( "Discovered BLS threshold is " ) +
        cc.info( optsSignOperation.nThreshold ) + cc.debug( "." ) +
        "\n" );
    optsSignOperation.details.write( optsSignOperation.strLogPrefix +
        cc.debug( "Discovered number of BLS participants is " ) +
        cc.info( optsSignOperation.nParticipants ) +
        cc.debug( "." ) +
        "\n" );
    if( optsSignOperation.nThreshold <= 0 ) {
        optsSignOperation.bHaveResultReportCalled = true;
        optsSignOperation.details.exposeDetailsTo(
            log, optsSignOperation.strGatheredDetailsName, false );
        optsSignOperation.details.close();
        await optsSignOperation.fn(
            "signature error(1), S-Chain information " +
            "was not discovered properly and BLS threshold is unknown",
            optsSignOperation.jarrMessages,
            null
        );
        return;
    }
    optsSignOperation.nCountOfBlsPartsToCollect = 0 + optsSignOperation.nThreshold;
    optsSignOperation.details.write( optsSignOperation.strLogPrefix +
        cc.debug( "Will collect " ) + cc.info( optsSignOperation.nCountOfBlsPartsToCollect ) +
        cc.debug( " from " ) + cc.info( optsSignOperation.jarrNodes.length ) +
        cc.debug( " nodes" ) +
        cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) +
        cc.attention( optsSignOperation.sequence_id ) +
        "\n" );
}

async function gather_signing_start_impl( optsSignOperation ) {
    optsSignOperation.details.write( optsSignOperation.strLogPrefix +
        cc.debug( "Waiting for BLS glue result " ) + "\n" );
    optsSignOperation.errGathering = null;
    optsSignOperation.promise_gathering_complete = new Promise( ( resolve, reject ) => {
        const iv = setInterval( function() {
            ++ optsSignOperation.joGatheringTracker.nWaitIntervalStepsDone;
            optsSignOperation.cntSuccess =
                optsSignOperation.joGatheringTracker.nCountReceived -
                optsSignOperation.joGatheringTracker.nCountErrors;
            if( optsSignOperation.cntSuccess >= optsSignOperation.nCountOfBlsPartsToCollect ) {
                optsSignOperation.strLogPrefixB =
                    cc.bright( optsSignOperation.strDirection ) + cc.debug( "/" ) +
                    cc.attention( "#" ) + cc.sunny( optsSignOperation.nTransferLoopCounter ) +
                    cc.debug( "/" ) + cc.info( "BLS" ) +
                    cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
                clearInterval( iv );
                let strError = null, strSuccessfulResultDescription = null;
                const joGlueResult = perform_bls_glue(
                    optsSignOperation.details, optsSignOperation.strDirection,
                    optsSignOperation.jarrMessages,
                    optsSignOperation.nIdxCurrentMsgBlockStart,
                    optsSignOperation.strFromChainName,
                    optsSignOperation.arrSignResults
                );
                if( joGlueResult ) {
                    optsSignOperation.details.write( optsSignOperation.strLogPrefixB +
                        cc.success( "Got BLS glue result: " ) + cc.j( joGlueResult ) +
                        "\n" );
                    if( optsSignOperation.imaState.strPathBlsVerify.length > 0 ) {
                        const joCommonPublicKey =
                            discover_common_public_key(
                                optsSignOperation.imaState.joSChainNetworkInfo );
                        if( perform_bls_verify(
                            optsSignOperation.details, optsSignOperation.strDirection,
                            joGlueResult, optsSignOperation.jarrMessages,
                            optsSignOperation.nIdxCurrentMsgBlockStart,
                            optsSignOperation.strFromChainName,
                            joCommonPublicKey
                        ) ) {
                            strSuccessfulResultDescription =
                                "Got successful summary BLS verification result";
                            optsSignOperation.details.write( optsSignOperation.strLogPrefixB +
                                cc.success( strSuccessfulResultDescription ) +
                                "\n" );
                        } else {
                            strError = "BLS verification failed";
                            optsSignOperation.details.write( optsSignOperation.strLogPrefixB +
                                cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) +
                                "\n" );
                        }
                    }
                } else {
                    strError = "BLS glue failed, no glue result arrived";
                    const strErrorMessage = optsSignOperation.strLogPrefixB +
                        cc.error( "Problem(1) in BLS sign result handler: " ) +
                        cc.warning( strError ) +
                        "\n";
                    optsSignOperation.details.write( strErrorMessage );
                    log.write( strErrorMessage );
                }
                const strCallbackCallDescription =
                    cc.debug( "Will call signed-hash answer-sending callback " ) +
                    ( strError ? ( cc.debug( " with error " ) + cc.j( strError ) ) : "" ) +
                    cc.debug( ", optsSignOperation.jarrMessages is " ) +
                    cc.j( optsSignOperation.jarrMessages ) +
                    cc.debug( ", glue result is " ) + cc.j( joGlueResult ) + "\n";
                optsSignOperation.details.write( strCallbackCallDescription );
                /*await*/ optsSignOperation.fn(
                    strError, optsSignOperation.jarrMessages, joGlueResult )
                    .catch( ( err ) => {
                        const strErrorMessage =
                        cc.error( "Problem(2) in BLS sign result handler: " ) +
                        cc.warning( owaspUtils.extract_error_message( err ) ) +
                        "\n";
                        log.write( strErrorMessage );
                        optsSignOperation.details.write( strErrorMessage );
                        optsSignOperation.errGathering =
                        "Problem(2) in BLS sign result handler: " +
                        owaspUtils.extract_error_message( err );
                        return;
                    } );
                optsSignOperation.bHaveResultReportCalled = true;
                if( strError ) {
                    optsSignOperation.errGathering = strError;
                    reject( new Error( optsSignOperation.errGathering ) );
                } else
                    resolve();
                return;
            }
            if( optsSignOperation.joGatheringTracker.nCountReceived >=
                    optsSignOperation.jarrNodes.length ) {
                clearInterval( iv );
                /*await*/ optsSignOperation.fn(
                    "signature error(2), got " +
                    optsSignOperation.joGatheringTracker.nCountErrors +
                    " errors(s) for " + optsSignOperation.jarrNodes.length +
                    " node(s)", optsSignOperation.jarrMessages,
                    null
                ).catch( ( err ) => {
                    const strErrorMessage =
                        cc.error( "Problem(3) in BLS sign result handler, " +
                            "not enough successful BLS signature parts(" ) +
                        cc.info( optsSignOperation.cntSuccess ) +
                        cc.error( " when all attempts done, " +
                            "error optsSignOperation.details: " ) +
                        cc.warning( owaspUtils.extract_error_message( err ) ) +
                        "\n";
                    optsSignOperation.details.write( strErrorMessage );
                    log.write( strErrorMessage );
                    optsSignOperation.errGathering =
                        "Problem(3) in BLS sign result handler," +
                            " not enough successful BLS signature parts(" +
                        optsSignOperation.cntSuccess +
                        " when all attempts done, error optsSignOperation.details: " +
                        owaspUtils.extract_error_message( err );
                    reject( new Error( optsSignOperation.errGathering ) );
                } );
                optsSignOperation.bHaveResultReportCalled = true;
                return;
            }
            if( optsSignOperation.joGatheringTracker.nWaitIntervalStepsDone >=
                    optsSignOperation.joGatheringTracker.nWaitIntervalMaxSteps
            ) {
                clearInterval( iv );
                /*await*/ optsSignOperation.fn(
                    "signature error(3), got " +
                        optsSignOperation.joGatheringTracker.nCountErrors +
                        " errors(s) for " + optsSignOperation.jarrNodes.length + " node(s)",
                    optsSignOperation.jarrMessages,
                    null
                ).catch( ( err ) => {
                    const strErrorMessage =
                        cc.error(
                            "Problem(4) in BLS sign result handler, " +
                            "not enough successful BLS signature parts(" ) +
                        cc.info( optsSignOperation.cntSuccess ) +
                        cc.error( ") and timeout reached, " +
                            "error optsSignOperation.details: " ) +
                        cc.warning( owaspUtils.extract_error_message( err ) ) +
                        "\n";
                    optsSignOperation.details.write( strErrorMessage );
                    log.write( strErrorMessage );
                    optsSignOperation.errGathering =
                        "Problem(4) in BLS sign result handler, " +
                        "not enough successful BLS signature parts(" +
                        optsSignOperation.cntSuccess +
                        ") and timeout reached, error optsSignOperation.details: " +
                        owaspUtils.extract_error_message( err );
                    reject( new Error( optsSignOperation.errGathering ) );
                } );
                optsSignOperation.bHaveResultReportCalled = true;
                return;
            }
        }, optsSignOperation.joGatheringTracker.nWaitIntervalStepMilliseconds );
    } );
}

async function gather_signing_finish_impl( optsSignOperation ) {
    optsSignOperation.details.write( optsSignOperation.strLogPrefix +
        cc.debug( "Will await for message BLS verification and sending..." ) +
        "\n" );
    await with_timeout(
        "BLS verification and sending",
        optsSignOperation.promise_gathering_complete,
        g_secondsMessageVerifySendTimeout )
        .then( strSuccessfulResultDescription => {
            optsSignOperation.details.write(
                cc.success( "BLS verification and sending promise awaited." ) +
                "\n" );
        } ).catch( err => {
            const strErrorMessage =
            cc.error( "Failed to verify BLS and send message : " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            "\n";
            log.write( strErrorMessage );
            optsSignOperation.details.write( strErrorMessage );
        } );
    if( optsSignOperation.errGathering ) {
        const strErrorMessage =
            cc.error( "Failed BLS sign result awaiting(1): " ) +
            cc.warning( optsSignOperation.errGathering.toString() ) +
            "\n";
        log.write( strErrorMessage );
        optsSignOperation.details.write( strErrorMessage );
        if( ! optsSignOperation.bHaveResultReportCalled ) {
            optsSignOperation.bHaveResultReportCalled = true;
            await optsSignOperation.fn(
                "Failed to gather BLS signatures in " + optsSignOperation.jarrNodes.length +
                    " node(s), tracker data is: " +
                    JSON.stringify( optsSignOperation.joGatheringTracker ) +
                    ", error is: " + optsSignOperation.errGathering.toString(),
                optsSignOperation.jarrMessages,
                null
            ).catch( ( err ) => {
                const strErrorMessage =
                    cc.error( "Problem(5) in BLS sign result handler, " +
                    "not enough successful BLS signature parts(" ) +
                    cc.info( optsSignOperation.cntSuccess ) +
                    cc.error( ") and timeout reached, error optsSignOperation.details: " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) +
                    "\n";
                log.write( strErrorMessage );
                optsSignOperation.details.write( strErrorMessage );
                optsSignOperation.details.exposeDetailsTo(
                    log, optsSignOperation.strGatheredDetailsName, false );
                optsSignOperation.details.close();
                optsSignOperation.details = null;
            } );
        }
        return;
    }
    if( ! optsSignOperation.bHaveResultReportCalled ) {
        const strErrorMessage = cc.error( "Failed BLS sign result awaiting(2): " ) +
            cc.warning( "No reports were arrived" ) +
            + "\n";
        log.write( strErrorMessage );
        optsSignOperation.details.write( strErrorMessage );
        optsSignOperation.bHaveResultReportCalled = true;
        await optsSignOperation.fn(
            "Failed to gather BLS signatures in " + optsSignOperation.jarrNodes.length +
            " node(s), tracker data is: " +
            JSON.stringify( optsSignOperation.joGatheringTracker ),
            optsSignOperation.jarrMessages, null
        ).catch( ( err ) => {
            const strErrorMessage =
                cc.error( "Problem(6) in BLS sign result handler, " +
                "not enough successful BLS signature parts(" ) +
                cc.info( optsSignOperation.cntSuccess ) +
                cc.error( ") and timeout reached, error optsSignOperation.details: " ) +
                cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
            log.write( strErrorMessage );
            optsSignOperation.details.write( strErrorMessage );
            optsSignOperation.details.exposeDetailsTo(
                log, optsSignOperation.strGatheredDetailsName, false );
            optsSignOperation.details.close();
            optsSignOperation.details = null;
        } );
    }
}

async function do_sign_configure_chain_access_params( optsSignOperation ) {
    optsSignOperation.targetChainName = "";
    optsSignOperation.fromChainName = "";
    optsSignOperation.targetChainID = -4;
    optsSignOperation.fromChainID = -4;
    if( optsSignOperation.strDirection == "M2S" ) {
        optsSignOperation.targetChainName = "" +
            ( optsSignOperation.imaState.chainProperties.sc.strChainName
                ? optsSignOperation.imaState.chainProperties.sc.strChainName
                : "" );
        optsSignOperation.fromChainName = "" +
            ( optsSignOperation.imaState.chainProperties.mn.strChainName
                ? optsSignOperation.imaState.chainProperties.mn.strChainName
                : "" );
        optsSignOperation.targetChainID = optsSignOperation.imaState.chainProperties.sc.cid;
        optsSignOperation.fromChainID = optsSignOperation.imaState.chainProperties.mn.cid;
    } else if( optsSignOperation.strDirection == "S2M" ) {
        optsSignOperation.targetChainName = "" +
            ( optsSignOperation.imaState.chainProperties.mn.strChainName
                ? optsSignOperation.imaState.chainProperties.mn.strChainName
                : "" );
        optsSignOperation.fromChainName = "" +
            ( optsSignOperation.imaState.chainProperties.sc.strChainName
                ? optsSignOperation.imaState.chainProperties.sc.strChainName
                : "" );
        optsSignOperation.targetChainID = optsSignOperation.imaState.chainProperties.mn.cid;
        optsSignOperation.fromChainID = optsSignOperation.imaState.chainProperties.sc.cid;
    } else if( optsSignOperation.strDirection == "S2S" ) {
        optsSignOperation.targetChainName =
            "" + optsSignOperation.joExtraSignOpts.chain_id_dst;
        optsSignOperation.fromChainName = "" + optsSignOperation.joExtraSignOpts.chain_id_src;
        optsSignOperation.targetChainID = optsSignOperation.joExtraSignOpts.cid_dst;
        optsSignOperation.fromChainID = optsSignOperation.joExtraSignOpts.cid_src;
    } else {
        await joCall.disconnect();
        throw new Error(
            "CRITICAL ERROR: " +
            "Failed do_sign_messages_impl() with unknown direction \"" +
            optsSignOperation.strDirection + "\""
        );
    }
}

async function do_sign_process_handle_call(
    optsSignOperation,
    joNode, joParams,
    joIn, joOut, err
) {
    ++optsSignOperation.joGatheringTracker.nCountReceived; // including errors
    if( err ) {
        ++optsSignOperation.joGatheringTracker.nCountErrors;
        const strErrorMessage =
            optsSignOperation.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
            cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized +
            cc.error( " failed, RPC call reported error: " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", " ) + cc.notice( "sequence ID" ) +
            cc.error( " is " ) + cc.attention( optsSignOperation.sequence_id ) +
            "\n";
        log.write( strErrorMessage );
        optsSignOperation.details.write( strErrorMessage );
        await joCall.disconnect();
        return;
    }
    optsSignOperation.details.write( optsSignOperation.strLogPrefix +
        log.generate_timestamp_string( null, true ) + " " +
        cc.debug( "Got answer from " ) + cc.info( "skale_imaVerifyAndSign" ) +
        cc.debug( " for transfer from chain " ) +
        cc.info( optsSignOperation.fromChainName ) +
        cc.debug( " to chain " ) + cc.info( optsSignOperation.targetChainName ) +
        cc.debug( " with params " ) + cc.j( joParams ) +
        cc.debug( ", answer is " ) + cc.j( joOut ) +
        cc.debug( ", " ) + cc.notice( "sequence ID" ) +
        cc.debug( " is " ) + cc.attention( optsSignOperation.sequence_id ) +
        "\n" );
    if( joOut.result == null ||
        joOut.result == undefined ||
        ( !typeof joOut.result == "object" )
    ) {
        ++optsSignOperation.joGatheringTracker.nCountErrors;
        const strErrorMessage = optsSignOperation.strLogPrefix +
            cc.fatal( "Wallet CRITICAL ERROR:" ) + " " +
            cc.error( "S-Chain node " ) + strNodeDescColorized +
            cc.error( " reported wallet error: " ) +
            cc.warning(
                owaspUtils.extract_error_message( joOut, "unknown wallet error(1)" )
            ) +
            cc.error( ", " ) + cc.notice( "sequence ID" ) +
            cc.error( " is " ) + cc.attention( optsSignOperation.sequence_id ) +
            "\n";
        log.write( strErrorMessage );
        optsSignOperation.details.write( strErrorMessage );
        await joCall.disconnect();
        return;
    }
    optsSignOperation.details.write( optsSignOperation.strLogPrefix +
        cc.debug( "Node " ) + cc.info( joNode.nodeID ) +
        cc.debug( " sign result: " ) +
        cc.j( joOut.result ? joOut.result : null ) +
        "\n" );
    try {
        if( joOut.result.signResult.signatureShare.length > 0 &&
            joOut.result.signResult.status === 0
        ) {
            const nZeroBasedNodeIndex = joNode.imaInfo.thisNodeIndex - 1;
            //
            // partial BLS verification for one participant
            //
            let bNodeSignatureOKay = false; // initially assume signature is wrong
            optsSignOperation.strLogPrefixA =
                cc.bright( optsSignOperation.strDirection ) + cc.debug( "/" ) +
                cc.info( "BLS" ) + cc.debug( "/" ) +
                cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) +
                cc.debug( ":" ) + " ";
            try {
                optsSignOperation.cntSuccess =
                    optsSignOperation.joGatheringTracker.nCountReceived -
                    optsSignOperation.joGatheringTracker.nCountErrors;
                if( optsSignOperation.cntSuccess >
                        optsSignOperation.nCountOfBlsPartsToCollect ) {
                    ++optsSignOperation.joGatheringTracker.nCountSkipped;
                    optsSignOperation.details.write(
                        optsSignOperation.strLogPrefixA +
                        cc.debug( "Will ignore sign result for node " ) +
                        cc.info( nZeroBasedNodeIndex ) + cc.debug( " because " ) +
                        cc.info( optsSignOperation.nThreshold ) + cc.debug( "/" ) +
                        cc.info( optsSignOperation.nCountOfBlsPartsToCollect ) +
                        cc.debug(
                            " threshold number of BLS signature " +
                            "parts already gathered"
                        ) +
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
                optsSignOperation.details.write( optsSignOperation.strLogPrefixA +
                    cc.info( "Will verify sign result for node " ) +
                    cc.info( nZeroBasedNodeIndex ) +
                    "\n" );
                const joPublicKey =
                    discover_public_key_by_index(
                        nZeroBasedNodeIndex,
                        optsSignOperation.imaState.joSChainNetworkInfo
                    );
                if( perform_bls_verify_i(
                    optsSignOperation.details, optsSignOperation.strDirection,
                    nZeroBasedNodeIndex, joResultFromNode,
                    optsSignOperation.jarrMessages,
                    optsSignOperation.nIdxCurrentMsgBlockStart,
                    optsSignOperation.strFromChainName,
                    joPublicKey
                ) ) {
                    optsSignOperation.details.write(
                        optsSignOperation.strLogPrefixA +
                        cc.success(
                            "Got successful BLS verification result for node " ) +
                        cc.info( joNode.nodeID ) + cc.success( " with index " ) +
                        cc.info( nZeroBasedNodeIndex ) +
                        "\n" );
                    bNodeSignatureOKay = true; // node verification passed
                } else {
                    optsSignOperation.details.write(
                        optsSignOperation.strLogPrefixA +
                        cc.fatal( "CRITICAL ERROR:" ) +
                        " " + cc.error( "BLS verification failed" ) +
                        "\n" );
                }
            } catch ( err ) {
                const strErrorMessage =
                    optsSignOperation.strLogPrefixA + cc.error( "S-Chain node " ) +
                    strNodeDescColorized + cc.error( " sign " ) +
                    cc.error( " CRITICAL ERROR:" ) +
                    cc.error( " partial signature fail from with index " ) +
                    cc.info( nZeroBasedNodeIndex ) +
                    cc.error( ", error is " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) +
                    cc.error( ", " ) + cc.notice( "sequence ID" ) +
                    cc.error( " is " ) + cc.attention( optsSignOperation.sequence_id ) +
                    cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
                    "\n";
                log.write( strErrorMessage );
                optsSignOperation.details.write( strErrorMessage );
            }
            if( bNodeSignatureOKay ) {
                optsSignOperation.arrSignResults.push( {
                    index: "" + nZeroBasedNodeIndex,
                    signature:
                        split_signature_share(
                            joOut.result.signResult.signatureShare
                        ),
                    fromNode: joNode, // extra, not needed for bls_glue
                    signResult: joOut.result.signResult
                } );
            } else
                ++optsSignOperation.joGatheringTracker.nCountErrors;
        }
    } catch ( err ) {
        ++optsSignOperation.joGatheringTracker.nCountErrors;
        const strErrorMessage =
            optsSignOperation.strLogPrefix + cc.error( "S-Chain node " ) +
            strNodeDescColorized + " " + cc.fatal( "CRITICAL ERROR:" ) +
            cc.error( " signature fail from node " ) + cc.info( joNode.nodeID ) +
            cc.error( ", error is " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", " ) + cc.notice( "sequence ID" ) +
            cc.error( " is " ) + cc.attention( optsSignOperation.sequence_id ) +
            cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
            "\n";
        log.write( strErrorMessage );
        optsSignOperation.details.write( strErrorMessage );
    }
    await joCall.disconnect();
}

async function do_sign_process_one_impl( i, optsSignOperation ) {
    const joNode = optsSignOperation.jarrNodes[i];
    const strNodeURL = optsSignOperation.imaState.isCrossImaBlsMode
        ? imaUtils.compose_ima_agent_node_url( joNode )
        : imaUtils.compose_schain_node_url( joNode );
    const strNodeDescColorized = cc.u( strNodeURL ) + " " +
        cc.debug( "(" ) + cc.bright( i ) + cc.debug( "/" ) +
        cc.bright( optsSignOperation.jarrNodes.length ) +
        cc.debug( ", ID " ) + cc.info( joNode.nodeID ) + cc.debug( ")" ) +
        cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) +
        cc.attention( optsSignOperation.sequence_id );
    const rpcCallOpts = null;
    /*await*/ rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
        if( err ) {
            ++optsSignOperation.joGatheringTracker.nCountReceived; // including errors
            ++optsSignOperation.joGatheringTracker.nCountErrors;
            const strErrorMessage =
                optsSignOperation.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                cc.error( " failed, RPC call was not created, error is: " ) +
                cc.warning( owaspUtils.extract_error_message( err ) ) +
                cc.error( ", " ) + cc.notice( "sequence ID" ) +
                cc.error( " is " ) + cc.attention( optsSignOperation.sequence_id ) +
                "\n";
            log.write( strErrorMessage );
            optsSignOperation.details.write( strErrorMessage );
            if( joCall )
                await joCall.disconnect();
            return;
        }
        await do_sign_configure_chain_access_params( optsSignOperation );
        const joParams = {
            "direction": "" + optsSignOperation.strDirection,
            "startMessageIdx": optsSignOperation.nIdxCurrentMsgBlockStart,
            "dstChainName": optsSignOperation.targetChainName,
            "srcChainName": optsSignOperation.fromChainName,
            "dstChainID": optsSignOperation.targetChainID,
            "srcChainID": optsSignOperation.fromChainID,
            "messages": optsSignOperation.jarrMessages,
            "qa": {
                "skaled_no": 0 + i,
                "optsSignOperation.sequence_id": "" + optsSignOperation.sequence_id,
                "ts": "" + log.generate_timestamp_string( null, false )
            }
        };
        optsSignOperation.details.write(
            optsSignOperation.strLogPrefix +
            log.generate_timestamp_string( null, true ) + " " +
            cc.debug( "Will invoke " ) + cc.info( "skale_imaVerifyAndSign" ) +
            cc.debug( " for transfer from chain " ) + cc.info( optsSignOperation.fromChainName ) +
            cc.debug( " to chain " ) + cc.info( optsSignOperation.targetChainName ) +
            cc.debug( " with params " ) + cc.j( joParams ) +
            cc.debug( ", " ) + cc.notice( "sequence ID" ) +
            cc.debug( " is " ) + cc.attention( optsSignOperation.sequence_id ) +
            "\n" );
        await joCall.call( {
            "method": "skale_imaVerifyAndSign",
            "params": joParams
        }, async function( joIn, joOut, err ) {
            await do_sign_process_handle_call(
                optsSignOperation,
                joNode, joParams,
                joIn, joOut, err
            );
        } ); // joCall.call ...
    } ); // rpcCall.create ...
}

async function do_sign_messages_impl(
    nTransferLoopCounter, strDirection,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    joExtraSignOpts, fn
) {
    const optsSignOperation = {
        imaState: state.get(),
        nTransferLoopCounter: nTransferLoopCounter,
        strDirection: strDirection,
        jarrMessages: jarrMessages,
        nIdxCurrentMsgBlockStart: nIdxCurrentMsgBlockStart,
        strFromChainName: strFromChainName,
        joExtraSignOpts: joExtraSignOpts,
        fn: fn,
        bHaveResultReportCalled: false,
        strLogPrefix: "",
        strLogPrefixA: "",
        strLogPrefixB: "",
        joGatheringTracker: {},
        arrSignResults: [],
        cntSuccess: 0,
        details: log,
        strGatheredDetailsName: "",
        sequence_id: "",
        jarrNodes: [],
        nThreshold: 1,
        nParticipants: 1,
        nCountOfBlsPartsToCollect: 1,
        errGathering: null,
        promise_gathering_complete: null,
        targetChainName: "",
        fromChainName: "",
        targetChainID: -4,
        fromChainID: -4
    };
    optsSignOperation.strLogPrefix =
        cc.bright( optsSignOperation.strDirection ) + cc.debug( "/" ) +
        cc.attention( "#" ) + cc.sunny( optsSignOperation.nTransferLoopCounter ) + " " +
        cc.info( "Sign msgs via " ) +
        cc.attention( optsSignOperation.imaState.isCrossImaBlsMode ? "IMA agent" : "skaled" ) +
        cc.info( ":" ) + " ";
    optsSignOperation.joGatheringTracker = {
        nCountReceived: 0, // including errors
        nCountErrors: 0,
        nCountSkipped: 0,
        nWaitIntervalStepMilliseconds: 100,
        nWaitIntervalStepsDone: 0,
        nWaitIntervalMaxSteps: 10 * 60 * 3 // 10 is 1 second
    };
    optsSignOperation.details =
        optsSignOperation.imaState.isDynamicLogInBlsSigner
            ? log : log.createMemoryStream( true );
    optsSignOperation.strGatheredDetailsName = optsSignOperation.strDirection + "-" +
        "do_sign_messages_impl-#" + optsSignOperation.nTransferLoopCounter +
        "-" + optsSignOperation.strFromChainName + "-msg#" +
        optsSignOperation.nIdxCurrentMsgBlockStart;
    try {
        await prepare_sign_messages_impl( optsSignOperation );
        for( let i = 0; i < optsSignOperation.jarrNodes.length; ++i ) {
            optsSignOperation.cntSuccess =
                optsSignOperation.joGatheringTracker.nCountReceived -
                optsSignOperation.joGatheringTracker.nCountErrors;
            if( optsSignOperation.cntSuccess >= optsSignOperation.nCountOfBlsPartsToCollect ) {
                optsSignOperation.details.write(
                    optsSignOperation.strLogPrefix +
                    log.generate_timestamp_string( null, true ) + " " +
                    cc.debug( "Stop invoking " ) + cc.info( "skale_imaVerifyAndSign" ) +
                    cc.debug( " for transfer from chain " ) + cc.info( fromChainName ) +
                    cc.debug( " at #" ) + cc.info( i ) +
                    cc.debug( " because successfully gathered count is reached " ) +
                    cc.j( optsSignOperation.cntSuccess ) +
                    "\n" );
                break;
            }
            await do_sign_process_one_impl( i, optsSignOperation );
        } // for( let i = 0; i < optsSignOperation.jarrNodes.length; ++i )
        await gather_signing_start_impl( optsSignOperation );
        await gather_signing_finish_impl( optsSignOperation );
    } catch ( err ) {
        const strErrorMessage =
            cc.error( "Failed BLS sign due to generic flow exception: " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
        log.write( strErrorMessage );
        if( optsSignOperation.details )
            optsSignOperation.details.write( strErrorMessage );
        if( ! optsSignOperation.bHaveResultReportCalled ) {
            optsSignOperation.bHaveResultReportCalled = true;
            await optsSignOperation.fn(
                "Failed BLS sign due to exception: " +
                owaspUtils.extract_error_message( err ),
                optsSignOperation.jarrMessages,
                null
            ).catch( ( err ) => {
                const strErrorMessage =
                    cc.error( "Failed BLS sign due to " +
                        "error-reporting callback exception: " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) +
                    "\n";
                log.write( strErrorMessage );
                if( optsSignOperation.details ) {
                    optsSignOperation.details.write( strErrorMessage );
                    optsSignOperation.details.exposeDetailsTo(
                        log, optsSignOperation.strGatheredDetailsName, false );
                    optsSignOperation.details.close();
                }
            } );
        }
    }
    const strFinalMessage =
        cc.info( optsSignOperation.strGatheredDetailsName ) + cc.success( " completed" ) + "\n";
    optsSignOperation.details.write( strFinalMessage );
    if( optsSignOperation.details ) {
        optsSignOperation.details.exposeDetailsTo(
            log, optsSignOperation.strGatheredDetailsName, true );
        optsSignOperation.details.close();
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

async function prepare_sign_u256( optsSign_u256 ) {
    optsSign_u256.details.write( optsSign_u256.strLogPrefix +
        cc.debug( "Will sign " ) + cc.info( optsSign_u256.u256 ) + cc.debug( " value..." ) +
        "\n" );
    optsSign_u256.details.write( optsSign_u256.strLogPrefix +
            cc.debug( "Will query to sign " ) + cc.info( optsSign_u256.jarrNodes.length ) +
            cc.debug( " skaled node(s)..." ) +
            "\n" );
    optsSign_u256.nThreshold =
        discover_bls_threshold( optsSign_u256.imaState.joSChainNetworkInfo );
    optsSign_u256.nParticipants =
        discover_bls_participants( optsSign_u256.imaState.joSChainNetworkInfo );
    optsSign_u256.details.write( optsSign_u256.strLogPrefix +
        cc.debug( "Discovered BLS threshold is " ) +
        cc.info( optsSign_u256.nThreshold ) + cc.debug( "." ) +
        "\n" );
    optsSign_u256.details.write( optsSign_u256.strLogPrefix +
        cc.debug( "Discovered number of BLS participants is " ) +
        cc.info( optsSign_u256.nParticipants ) + cc.debug( "." ) +
        "\n" );
    if( optsSign_u256.nThreshold <= 0 ) {
        await optsSign_u256.fn(
            "signature error(1, u256), S-Chain information " +
            "was not discovered properly and BLS threshold is unknown",
            optsSign_u256.u256,
            null
        );
        return;
    }
    optsSign_u256.nCountOfBlsPartsToCollect = 0 + optsSign_u256.nThreshold;
    optsSign_u256.details.write( optsSign_u256.strLogPrefix +
        cc.debug( "Will(optsSign_u256.u256) collect " ) +
        cc.info( optsSign_u256.nCountOfBlsPartsToCollect ) +
        cc.debug( " from " ) + cc.info( optsSign_u256.jarrNodes.length ) + cc.debug( " nodes" ) +
        "\n" );
}

async function do_sign_u256_one_impl( optsSign_u256 ) {
    const joNode = optsSign_u256.jarrNodes[i];
    const strNodeURL = optsSign_u256.imaState.isCrossImaBlsMode
        ? imaUtils.compose_ima_agent_node_url( joNode )
        : imaUtils.compose_schain_node_url( joNode );
    const strNodeDescColorized = cc.u( strNodeURL ) + " " +
        cc.debug( "(" ) + cc.bright( i ) +
        cc.debug( "/" ) + cc.bright( optsSign_u256.jarrNodes.length ) +
        cc.debug( ", ID " ) + cc.info( joNode.nodeID ) + cc.debug( ")" );
    const rpcCallOpts = null;
    await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
        if( err ) {
            ++optsSign_u256.joGatheringTracker.nCountReceived; // including errors
            ++optsSign_u256.joGatheringTracker.nCountErrors;
            const strErrorMessage =
                optsSign_u256.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                cc.error( " failed, RPC call was not created, error is: " ) +
                cc.warning( owaspUtils.extract_error_message( err ) ) +
                "\n";
            log.write( strErrorMessage );
            optsSign_u256.details.write( strErrorMessage );
            if( joCall )
                await joCall.disconnect();
            return;
        }
        optsSign_u256.details.write(
            optsSign_u256.strLogPrefix + cc.debug( "Will invoke " ) + cc.info( "skale_imaBSU256" ) +
            cc.debug( " for to sign value " ) + cc.info( optsSign_u256.u256.toString() ) +
            "\n" );
        await joCall.call( {
            "method": "skale_imaBSU256",
            "params": {
                "valueToSign": optsSign_u256.u256 // must be 0x string, came from outside 0x string
            }
        }, async function( joIn, joOut, err ) {
            ++optsSign_u256.joGatheringTracker.nCountReceived; // including errors
            if( err ) {
                ++optsSign_u256.joGatheringTracker.nCountErrors;
                const strErrorMessage =
                    optsSign_u256.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                    cc.error( " failed, RPC call reported error: " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) +
                    "\n";
                log.write( strErrorMessage );
                optsSign_u256.details.write( strErrorMessage );
                await joCall.disconnect();
                return;
            }
            optsSign_u256.details.write(
                optsSign_u256.strLogPrefix + cc.debug( "Did invoked " ) +
                cc.info( "skale_imaBSU256" ) +
                cc.debug( " for to sign value " ) + cc.info( optsSign_u256.u256.toString() ) +
                cc.debug( ", answer is: " ) + cc.j( joOut ) +
                "\n" );
            if( joOut.result == null ||
                joOut.result == undefined ||
                ( !typeof joOut.result == "object" )
            ) {
                ++optsSign_u256.joGatheringTracker.nCountErrors;
                const strErrorMessage =
                    optsSign_u256.strLogPrefix + cc.fatal( "Wallet CRITICAL ERROR:" ) + " " +
                    cc.error( "S-Chain node " ) + strNodeDescColorized +
                    cc.error( " reported wallet error: " ) +
                    cc.warning(
                        owaspUtils.extract_error_message( joOut, "unknown wallet error(2)" )
                    ) +
                    "\n";
                log.write( strErrorMessage );
                optsSign_u256.details.write( strErrorMessage );
                await joCall.disconnect();
                return;
            }
            optsSign_u256.details.write( optsSign_u256.strLogPrefix +
                cc.debug( "Node " ) + cc.info( joNode.nodeID ) +
                cc.debug( " sign result: " ) + cc.j( joOut.result ? joOut.result : null ) +
                "\n" );
            try {
                if( joOut.result.signResult.signatureShare.length > 0 &&
                    joOut.result.signResult.status === 0
                ) {
                    const nZeroBasedNodeIndex = joNode.imaInfo.thisNodeIndex - 1;
                    //
                    // partial BLS verification for one participant
                    //
                    let bNodeSignatureOKay = false; // initially assume signature is wrong
                    const strLogPrefixA =
                        cc.info( "BLS" ) + cc.debug( "/" ) +
                        cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) +
                        cc.debug( ":" ) + " ";
                    try {
                        const cntSuccess =
                            optsSign_u256.joGatheringTracker.nCountReceived -
                            optsSign_u256.joGatheringTracker.nCountErrors;
                        if( cntSuccess > optsSign_u256.nCountOfBlsPartsToCollect ) {
                            ++optsSign_u256.joGatheringTracker.nCountSkipped;
                            optsSign_u256.details.write( strLogPrefixA +
                                cc.debug( "Will ignore sign result for node " ) +
                                cc.info( nZeroBasedNodeIndex ) +
                                cc.debug( " because " ) + cc.info( optsSign_u256.nThreshold ) +
                                cc.debug( "/" ) +
                                cc.info( optsSign_u256.nCountOfBlsPartsToCollect ) +
                                cc.debug( " threshold number of BLS signature " +
                                    "parts already gathered" ) +
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
                        optsSign_u256.details.write( strLogPrefixA +
                            cc.info( "Will verify sign result for node " ) +
                            cc.info( nZeroBasedNodeIndex ) +
                            "\n" );
                        const joPublicKey =
                            discover_public_key_by_index(
                                nZeroBasedNodeIndex,
                                optsSign_u256.imaState.joSChainNetworkInfo
                            );
                        if( perform_bls_verify_i_u256(
                            optsSign_u256.details,
                            nZeroBasedNodeIndex,
                            joResultFromNode,
                            optsSign_u256.u256,
                            joPublicKey
                        )
                        ) {
                            optsSign_u256.details.write( strLogPrefixA +
                                cc.success( "Got successful BLS " +
                                "verification result for node " ) +
                                cc.info( joNode.nodeID ) + cc.success( " with index " ) +
                                cc.info( nZeroBasedNodeIndex ) +
                                "\n" );
                            bNodeSignatureOKay = true; // node verification passed
                        } else {
                            const strError = "BLS u256 one node verify failed";
                            optsSign_u256.details.write( strLogPrefixA +
                                cc.fatal( "CRITICAL ERROR:" ) +
                                " " + cc.error( strError ) +
                                "\n" );
                        }
                    } catch ( err ) {
                        const strErrorMessage =
                            strLogPrefixA + cc.error( "S-Chain node " ) +
                            strNodeDescColorized + cc.error( " sign " ) +
                            cc.error( " CRITICAL ERROR:" ) +
                            cc.error( " partial signature fail from with index " ) +
                            cc.info( nZeroBasedNodeIndex ) +
                            cc.error( ", error is " ) +
                            cc.warning( owaspUtils.extract_error_message( err ) ) +
                            cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
                            "\n";
                        log.write( strErrorMessage );
                        optsSign_u256.details.write( strErrorMessage );
                    }
                    if( bNodeSignatureOKay ) {
                        optsSign_u256.arrSignResults.push( {
                            index: "" + nZeroBasedNodeIndex,
                            signature:
                                split_signature_share(
                                    joOut.result.signResult.signatureShare
                                ),
                            fromNode: joNode, // extra, not needed for bls_glue
                            signResult: joOut.result.signResult
                        } );
                    } else
                        ++optsSign_u256.joGatheringTracker.nCountErrors;
                }
            } catch ( err ) {
                ++optsSign_u256.joGatheringTracker.nCountErrors;
                const strErrorMessage =
                    optsSign_u256.strLogPrefix + cc.error( "S-Chain node " ) +
                    strNodeDescColorized + " " + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " signature fail from node " ) + cc.info( joNode.nodeID ) +
                    cc.error( ", error is " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) +
                    cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
                    "\n";
                log.write( strErrorMessage );
                optsSign_u256.details.write( strErrorMessage );
            }
            await joCall.disconnect();
        } ); // joCall.call ...
    } ); // rpcCall.create ...
}

async function do_sign_u256_gathering( optsSign_u256 ) {
    optsSign_u256.details.write( optsSign_u256.strLogPrefix +
        cc.debug( "Waiting for BLS glue result " ) +
        "\n" );
    optsSign_u256.errGathering = null;
    optsSign_u256.promise_gathering_complete = new Promise( ( resolve, reject ) => {
        const iv = setInterval( function() {
            ++ optsSign_u256.joGatheringTracker.nWaitIntervalStepsDone;
            const cntSuccess =
                optsSign_u256.joGatheringTracker.nCountReceived -
                optsSign_u256.joGatheringTracker.nCountErrors;
            if( cntSuccess >= optsSign_u256.nCountOfBlsPartsToCollect ) {
                const strLogPrefixB =
                    cc.info( "BLS u256" ) +
                    cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
                clearInterval( iv );
                let strError = null, strSuccessfulResultDescription = null;
                const joGlueResult =
                    perform_bls_glue_u256(
                        optsSign_u256.details, optsSign_u256.u256, optsSign_u256.arrSignResults );
                if( joGlueResult ) {
                    optsSign_u256.details.write( strLogPrefixB +
                        cc.success( "Got BLS glue u256 result: " ) + cc.j( joGlueResult ) +
                        "\n" );
                    if( optsSign_u256.imaState.strPathBlsVerify.length > 0 ) {
                        const joCommonPublicKey =
                            discover_common_public_key(
                                optsSign_u256.imaState.joSChainNetworkInfo );
                        if( perform_bls_verify_u256(
                            optsSign_u256.details,
                            joGlueResult,
                            optsSign_u256.u256,
                            joCommonPublicKey
                        )
                        ) {
                            strSuccessfulResultDescription =
                                "Got successful summary BLS u256 verification result";
                            optsSign_u256.details.write( strLogPrefixB +
                                cc.success( strSuccessfulResultDescription ) +
                                "\n" );
                        } else {
                            strError = "BLS verification failed";
                            log.write( strLogPrefixB +
                                cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) +
                                "\n" );
                            optsSign_u256.details.write( strLogPrefixB +
                                cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) +
                                "\n" );
                        }
                    }
                } else {
                    strError = "BLS u256 glue failed, no glue result arrived";
                    const strErrorMessage = strLogPrefixB +
                        cc.error( "Problem(1) in BLS u256 sign result handler: " ) +
                        cc.warning( strError ) +
                        "\n";
                    log.write( strErrorMessage );
                    optsSign_u256.details.write( strErrorMessage );
                }
                const strCallbackCallDescription =
                    cc.debug( "Will call signed-256 answer-sending callback " ) +
                    ( strError ? ( cc.debug( " with error " ) + cc.j( strError ) ) : "" ) +
                    cc.debug( ", u256 is " ) + cc.j( optsSign_u256.u256 ) +
                    cc.debug( ", glue result is " ) + cc.j( joGlueResult ) + "\n";
                optsSign_u256.details.write( strCallbackCallDescription );
                /*await*/ optsSign_u256.fn( strError, optsSign_u256.u256, joGlueResult )
                    .catch( ( err ) => {
                        const strErrorMessage =
                        cc.error( "Problem(2) in BLS u256 sign result handler: " ) +
                        cc.warning( owaspUtils.extract_error_message( err ) ) +
                        "\n";
                        log.write( strErrorMessage );
                        optsSign_u256.details.write( strErrorMessage );
                        optsSign_u256.errGathering =
                        "Problem(2) in BLS u256 sign result handler: " +
                        owaspUtils.extract_error_message( err );
                    } );
                if( strError ) {
                    optsSign_u256.errGathering = strError;
                    reject( new Error( optsSign_u256.errGathering ) );
                } else
                    resolve();
                return;
            }
            if( optsSign_u256.joGatheringTracker.nCountReceived >=
                    optsSign_u256.jarrNodes.length ) {
                clearInterval( iv );
                /*await*/ optsSign_u256.fn(
                    "signature error(2, u256), got " +
                    optsSign_u256.joGatheringTracker.nCountErrors +
                    " errors(s) for " + optsSign_u256.jarrNodes.length + " node(s)",
                    optsSign_u256.u256,
                    null
                ).catch( ( err ) => {
                    const strErrorMessage =
                        cc.error( "Problem(3) in BLS u256 sign result handler, " +
                        "not enough successful BLS signature parts(" ) +
                        cc.info( cntSuccess ) +
                        cc.error( " when all attempts done, error optsSign_u256.details: " ) +
                        cc.warning( owaspUtils.extract_error_message( err ) ) +
                        "\n";
                    log.write( strErrorMessage );
                    optsSign_u256.details.write( strErrorMessage );
                    optsSign_u256.errGathering =
                        "Problem(3) in BLS u256 sign result handler, " +
                        "not enough successful BLS signature parts(" +
                        cntSuccess + " when all attempts done, error optsSign_u256.details: " +
                        owaspUtils.extract_error_message( err );
                    reject( new Error( optsSign_u256.errGathering ) );
                } );
                return;
            }
            if( optsSign_u256.joGatheringTracker.nWaitIntervalStepsDone >=
                optsSign_u256.joGatheringTracker.nWaitIntervalMaxSteps
            ) {
                clearInterval( iv );
                /*await*/ optsSign_u256.fn(
                    "signature error(3, u256), got " +
                    optsSign_u256.joGatheringTracker.nCountErrors +
                    " errors(s) for " + optsSign_u256.jarrNodes.length + " node(s)",
                    optsSign_u256.u256,
                    null
                ).catch( ( err ) => {
                    const strErrorMessage =
                        cc.error( "Problem(4) in BLS u256 sign result handler, " +
                        "not enough successful BLS signature parts(" ) +
                        cc.info( cntSuccess ) +
                        cc.error( ") and timeout reached, error optsSign_u256.details: " ) +
                        cc.warning( owaspUtils.extract_error_message( err ) ) + "\n";
                    log.write( strErrorMessage );
                    optsSign_u256.details.write( strErrorMessage );
                    optsSign_u256.errGathering =
                        "Problem(4) in BLS u256 sign result handler, " +
                        "not enough successful BLS signature parts(" +
                        cntSuccess + ") and timeout reached, error optsSign_u256.details: " +
                        owaspUtils.extract_error_message( err );
                    reject( new Error( optsSign_u256.errGathering ) );
                } );
                return;
            }
        }, optsSign_u256.joGatheringTracker.nWaitIntervalStepMilliseconds );
    } );
}

export async function do_sign_u256( u256, details, fn ) {
    const optsSign_u256 = {
        u256: u256,
        fn: fn,
        details: details,
        imaState: state.get(),
        strLogPrefix: cc.info( "Sign u256:" ) + " ",
        joGatheringTracker: {
            nCountReceived: 0, // including errors
            nCountErrors: 0,
            nCountSkipped: 0,
            nWaitIntervalStepMilliseconds: 100,
            nWaitIntervalStepsDone: 0,
            nWaitIntervalMaxSteps: 10 * 60 * 3 // 10 is 1 second
        },
        arrSignResults: [],
        jarrNodes: {},
        nThreshold: 1,
        nParticipants: 1,
        nCountOfBlsPartsToCollect: 1,
        errGathering: null,
        promise_gathering_complete: null
    };
    optsSign_u256.jarrNodes = optsSign_u256.imaState.joSChainNetworkInfo.network;
    optsSign_u256.details.write( optsSign_u256.strLogPrefix +
        cc.debug( "Invoking signing u256 procedure " ) + "\n" );
    optsSign_u256.fn = optsSign_u256.fn || function() {};
    if( !( /*optsSign_u256.imaState.bSignMessages &&*/
        optsSign_u256.imaState.strPathBlsGlue.length > 0 &&
        optsSign_u256.imaState.joSChainNetworkInfo
    ) ) {
        optsSign_u256.details.write( optsSign_u256.strLogPrefix +
            cc.debug( "BLS u256 signing is " ) + cc.error( "unavailable" ) +
            "\n" );
        await optsSign_u256.fn( "BLS u256 signing is unavailable", optsSign_u256.u256, null );
        return;
    }
    await prepare_sign_u256( optsSign_u256 );
    for( let i = 0; i < optsSign_u256.jarrNodes.length; ++i )
        await do_sign_u256_one_impl( optsSign_u256 );

    await do_sign_u256_gathering( optsSign_u256 );
    optsSign_u256.details.write( cc.debug( "Will await BLS u256 sign result..." ) + "\n" );
    await with_timeout(
        "BLS u256 sign",
        optsSign_u256.promise_gathering_complete,
        g_secondsMessageVerifySendTimeout
    ).then( strSuccessfulResultDescription => {
        optsSign_u256.details.write( cc.info( "BLS u256 sign promise awaited." ) + "\n" );
    } ).catch( err => {
        const strErrorMessage =
            cc.error( "Failed to verify BLS and send message : " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            "\n";
        log.write( strErrorMessage );
        optsSign_u256.details.write( strErrorMessage );
    } );
    if( optsSign_u256.errGathering ) {
        const strErrorMessage =
            cc.error( "Failed BLS u256 sign result awaiting: " ) +
            cc.warning( optsSign_u256.errGathering.toString() ) +
            "\n";
        log.write( strErrorMessage );
        optsSign_u256.details.write( strErrorMessage );
        return;
    }
    optsSign_u256.details.write( optsSign_u256.strLogPrefix +
        cc.debug( "Completed signing u256 procedure " ) + "\n" );
}

export async function do_verify_ready_hash(
    strMessageHash,
    nZeroBasedNodeIndex,
    signature,
    isExposeOutput
) {
    const imaState = state.get();
    const strDirection = "RAW";
    const strLogPrefix =
        cc.bright( strDirection ) + cc.debug( "/" ) +
        cc.info( "BLS" ) + cc.debug( "/" ) +
        cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) +
        cc.debug( ":" ) + " ";
    const details = log.createMemoryStream();
    let isSuccess = false;
    const joPublicKey =
        discover_public_key_by_index( nZeroBasedNodeIndex, imaState.joSChainNetworkInfo );
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
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        details.write( strLogPrefix +
            cc.debug( "BLS node " ) + cc.notice( "#" ) +
            cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " - hashed verify message is " ) +
            cc.info( strMessageHash ) +
            "\n" );
        const joMsg = {
            "message": strMessageHash
        };
        details.write( strLogPrefix +
            cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " - composed  " ) + cc.j( joMsg ) + cc.debug( " using hash " ) +
            cc.j( strMessageHash ) + cc.debug( " and glue " ) + cc.j( joResultFromNode ) +
            cc.debug( " and public key " ) + cc.j( joPublicKey ) +
            "\n" );
        const strSignResultFileName = strActionDir + "/sign-result" + nZeroBasedNodeIndex + ".json";
        imaUtils.jsonFileSave( strSignResultFileName, joResultFromNode );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        imaUtils.jsonFileSave(
            strActionDir + "/BLS_keys" + nZeroBasedNodeIndex + ".json", joPublicKey );
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --j " + nZeroBasedNodeIndex +
            " --input " + strSignResultFileName
            ;
        details.write( strLogPrefix +
            cc.debug( "Will execute node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " BLS verify command:\n" ) + cc.notice( strVerifyCommand ) +
            "\n" );
        strOutput = child_process.execSync( strVerifyCommand, { cwd: strActionDir } );
        details.write( strLogPrefix +
            cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.debug( " verify output is:\n" ) + cc.notice( strOutput ) +
            "\n" );
        details.write( strLogPrefix +
            cc.success( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.success( " verify success" ) +
            "\n" );
        fnShellRestore();
        isSuccess = true;
    } catch ( err ) {
        const s1 = strLogPrefix +
            cc.fatal( "CRITICAL ERROR:" ) +
            cc.error( " BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.error( " verify error:" ) + cc.warning( " error description is: " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n";
        const s2 = strLogPrefix +
            cc.error( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) +
            cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
            cc.error( " verify output is:\n" ) + cc.warning( strOutput ) +
            "\n";
        log.write( s1 );
        details.write( s1 );
        log.write( s2 );
        details.write( s2 );
        fnShellRestore();
        isSuccess = false;
    }
    if( isExposeOutput || ( !isSuccess ) )
        details.exposeDetailsTo( log, "BLS-raw-verifier", isSuccess );
    details.close();
    return isSuccess;
}

export async function do_sign_ready_hash( strMessageHash, isExposeOutput ) {
    const imaState = state.get();
    const strLogPrefix = "";
    const details = log.createMemoryStream();
    let joSignResult = null;
    try {
        const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
        const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
        details.write( strLogPrefix +
            cc.debug( "Will BLS-sign ready hash." ) +
            "\n" );
        details.write( strLogPrefix +
            cc.debug( "Discovered BLS threshold is " ) +
            cc.info( nThreshold ) + cc.debug( "." ) +
            "\n" );
        details.write( strLogPrefix +
            cc.debug( "Discovered number of BLS participants is " ) +
            cc.info( nParticipants ) + cc.debug( "." ) +
            "\n" );
        //
        details.write( strLogPrefix +
            cc.debug( "hash value to sign is " ) + cc.info( strMessageHash ) +
            "\n" );
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
        if( "strPathSslKey" in joAccount &&
            typeof joAccount.strPathSslKey == "string" &&
            joAccount.strPathSslKey.length > 0 &&
            "strPathSslCert" in joAccount &&
            typeof joAccount.strPathSslCert == "string" &&
            joAccount.strPathSslCert.length > 0
        ) {
            rpcCallOpts = {
                "cert": fs.readFileSync( joAccount.strPathSslCert, "utf8" ),
                "key": fs.readFileSync( joAccount.strPathSslKey, "utf8" )
            };
        } else {
            details.write(
                cc.warning( "Will sign via SGX" ) + " " + cc.error( "without SSL options" ) +
                "\n" );
        }
        const signerIndex = imaState.nNodeNumber;
        await rpcCall.create( joAccount.strSgxURL, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                const strErrorMessage =
                    strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call to SGX failed, " +
                        "RPC call was not created, error is: " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) +
                    "\n";
                log.write( strErrorMessage );
                details.write( strErrorMessage );
                if( joCall )
                    await joCall.disconnect();
                throw new Error(
                    "JSON RPC call to SGX failed, RPC call was not created, error is: " +
                    owaspUtils.extract_error_message( err )
                );
            }
            const joCallSGX = {
                "jsonrpc": "2.0",
                "id": randomCallID(),
                "method": "blsSignMessageHash",
                "params": {
                    "keyShareName": joAccount.strBlsKeyName,
                    "messageHash": strMessageHash,
                    "n": nParticipants,
                    "t": nThreshold,
                    "signerIndex": signerIndex + 0 // 1-based
                }
            };
            details.write( strLogPrefix +
                cc.debug( "Will invoke " ) + cc.info( "SGX" ) +
                cc.debug( " with call data " ) + cc.j( joCallSGX ) +
                "\n" );
            await joCall.call( joCallSGX, async function( joIn, joOut, err ) {
                if( err ) {
                    const err_js = new Error(
                        "JSON RPC call to SGX failed, RPC call reported error: " +
                        owaspUtils.extract_error_message( err )
                    );
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to SGX failed, RPC call reported error: " ) +
                        cc.warning( owaspUtils.extract_error_message( err ) ) +
                        cc.error( ", stack is:" ) + "\n" + cc.stack( err_js.stack ) +
                        "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    await joCall.disconnect();
                    throw err_js;
                }
                details.write( strLogPrefix +
                    cc.debug( "Call to " ) + cc.info( "SGX" ) + cc.debug( " done, answer is: " ) +
                    cc.j( joOut ) +
                    "\n" );
                joSignResult = joOut;
                if( joOut.result != null &&
                    joOut.result != undefined &&
                    typeof joOut.result == "object"
                )
                    joSignResult = joOut.result;
                if( joOut.signResult != null &&
                    joOut.signResult != undefined &&
                    typeof joOut.signResult == "object"
                )
                    joSignResult = joOut.signResult;
                if( "errorMessage" in joSignResult &&
                    typeof joSignResult.errorMessage == "string" &&
                    joSignResult.errorMessage.length > 0
                ) {
                    const strError =
                        "BLS signing finished with error: " + joSignResult.errorMessage;
                    joRetVal.error = strError;
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " BLS signing(1) finished with error: " ) +
                        cc.warning( joSignResult.errorMessage ) +
                        "\n";
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
            cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
            "\n";
        log.write( strErrorMessage );
        details.write( strErrorMessage );
    }
    const isSuccess = (
        joSignResult && typeof joSignResult == "object" && ( !joSignResult.error ) )
        ? true
        : false;
    if( isExposeOutput || ( !isSuccess ) )
        details.exposeDetailsTo( log, "BLS-raw-signer", isSuccess );
    details.close();
    return joSignResult;
}

async function prepare_handling_of_skale_imaVerifyAndSign( optsHandleVerifyAndSign ) {
    optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
        cc.debug( "Will verify and sign " ) + cc.j( optsHandleVerifyAndSign.joCallData ) +
        "\n" );
    optsHandleVerifyAndSign.nIdxCurrentMsgBlockStart =
        optsHandleVerifyAndSign.joCallData.params.startMessageIdx;
    optsHandleVerifyAndSign.strFromChainName =
        optsHandleVerifyAndSign.joCallData.params.srcChainName;
    optsHandleVerifyAndSign.strToChainName =
        optsHandleVerifyAndSign.joCallData.params.dstChainName;
    optsHandleVerifyAndSign.strFromChainID =
        optsHandleVerifyAndSign.joCallData.params.srcChainID;
    optsHandleVerifyAndSign.strToChainID =
        optsHandleVerifyAndSign.joCallData.params.dstChainID;
    optsHandleVerifyAndSign.strDirection =
        optsHandleVerifyAndSign.joCallData.params.direction;
    optsHandleVerifyAndSign.jarrMessages =
        optsHandleVerifyAndSign.joCallData.params.messages;
    optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
        cc.bright( optsHandleVerifyAndSign.strDirection ) +
        cc.debug( " verification algorithm will work for transfer from chain " ) +
        cc.info( optsHandleVerifyAndSign.strFromChainName ) + cc.debug( "/" ) +
        cc.notice( optsHandleVerifyAndSign.strFromChainID ) +
        cc.debug( " to chain" ) +
        cc.info( optsHandleVerifyAndSign.strToChainName ) + cc.debug( "/" ) +
        cc.notice( optsHandleVerifyAndSign.strToChainID ) +
        cc.debug( " and work with array of message(s) " ) +
        cc.j( optsHandleVerifyAndSign.jarrMessages ) +
        "\n" );
    optsHandleVerifyAndSign.nThreshold =
        discover_bls_threshold( optsHandleVerifyAndSign.imaState.joSChainNetworkInfo );
    optsHandleVerifyAndSign.nParticipants =
        discover_bls_participants( optsHandleVerifyAndSign.imaState.joSChainNetworkInfo );
    optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
        cc.bright( optsHandleVerifyAndSign.strDirection ) +
        cc.debug( " verification algorithm discovered BLS threshold is " ) +
        cc.info( optsHandleVerifyAndSign.nThreshold ) + cc.debug( "." ) +
        "\n" );
    optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
        cc.bright( optsHandleVerifyAndSign.strDirection ) +
        cc.debug( " verification algorithm discovered number of BLS participants is " ) +
        cc.info( optsHandleVerifyAndSign.nParticipants ) + cc.debug( "." ) +
        "\n" );
    optsHandleVerifyAndSign.strMessageHash =
        owaspUtils.remove_starting_0x(
            keccak256_message(
                optsHandleVerifyAndSign.jarrMessages,
                optsHandleVerifyAndSign.nIdxCurrentMsgBlockStart,
                optsHandleVerifyAndSign.strFromChainName
            )
        );
    optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
        cc.bright( optsHandleVerifyAndSign.strDirection ) +
        cc.debug( " verification algorithm message hash to sign is " ) +
        cc.info( optsHandleVerifyAndSign.strMessageHash ) +
        "\n" );
}

async function prepare_S2S_of_skale_imaVerifyAndSign( optsHandleVerifyAndSign ) {
    const strSChainNameSrc = optsHandleVerifyAndSign.joCallData.params.srcChainName;
    const strSChainNameDst = optsHandleVerifyAndSign.joCallData.params.dstChainName;
    optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
        cc.bright( optsHandleVerifyAndSign.strDirection ) +
        cc.debug( " verification algorithm will use for source chain name " ) +
        cc.info( strSChainNameSrc ) +
        cc.debug( " and destination chain name " ) + cc.info( strSChainNameDst ) +
        "\n" );
    const arr_schains_cached = skale_observer.get_last_cached_schains();
    if( ( !arr_schains_cached ) || arr_schains_cached.length == 0 ) {
        throw new Error(
            "Could not handle " + optsHandleVerifyAndSign.strDirection +
            " skale_imaVerifyAndSign(1), no S-Chains in SKALE NETWORK " +
            "observer cached yet, try again later"
        );
    }

    let jo_schain_src = null, strUrlSrcSChain = null;
    for( let idxSChain = 0; idxSChain < arr_schains_cached.length; ++ idxSChain ) {
        const jo_schain = arr_schains_cached[idxSChain];
        if( jo_schain.data.name.toString() == strSChainNameSrc.toString() ) {
            jo_schain_src = jo_schain;
            strUrlSrcSChain = skale_observer.pick_random_schain_url( jo_schain );
            break;
        }
    } // for( let idxSChain = 0; idxSChain < arr_schains_cached.length; ++ idxSChain )
    if( jo_schain_src == null || strUrlSrcSChain == null || strUrlSrcSChain.length == 0 ) {
        throw new Error(
            "Could not handle " + optsHandleVerifyAndSign.strDirection +
            " skale_imaVerifyAndSign(2), failed to discover source " +
            "chain access parameters, try again later" );
    }
    optsHandleVerifyAndSign.details.write(
        optsHandleVerifyAndSign.strLogPrefix + cc.bright( optsHandleVerifyAndSign.strDirection ) +
        cc.debug( " verification algorithm discovered source chain URL is " ) +
        cc.u( strUrlSrcSChain ) +
        cc.debug( ", chain name is " ) + cc.info( jo_schain_src.data.computed.schain_id ) +
        cc.debug( ", chain id is " ) + cc.info( jo_schain_src.data.computed.chainId ) +
        "\n" );
    //
    optsHandleVerifyAndSign.joExtraSignOpts = {
        skale_observer: skale_observer,
        ethersProvider_src: owaspUtils.getEthersProviderFromURL( strUrlSrcSChain ),
        chain_id_src: optsHandleVerifyAndSign.strFromChainName,
        chain_id_dst: optsHandleVerifyAndSign.strToChainName,
        cid_src: optsHandleVerifyAndSign.strFromChainID,
        cid_dst: optsHandleVerifyAndSign.strToChainID
    };
}

export async function handle_skale_imaVerifyAndSign( joCallData ) {
    const optsHandleVerifyAndSign = {
        joCallData: joCallData,
        imaState: state.get(),
        strLogPrefix: "",
        details: log.createMemoryStream(),
        joRetVal: {},
        isSuccess: false,
        nIdxCurrentMsgBlockStart: 0,
        strFromChainName: "",
        strToChainName: "",
        strFromChainID: "",
        strToChainID: "",
        strDirection: "",
        jarrMessages: [],
        strMessageHash: "",
        joExtraSignOpts: null,
        nThreshold: 1,
        nParticipants: 1
    };
    try {
        await prepare_handling_of_skale_imaVerifyAndSign( optsHandleVerifyAndSign );
        optsHandleVerifyAndSign.joExtraSignOpts = null;
        if( optsHandleVerifyAndSign.strDirection == "S2S" )
            await prepare_S2S_of_skale_imaVerifyAndSign( optsHandleVerifyAndSign );

        await check_correctness_of_messages_to_sign(
            optsHandleVerifyAndSign.details, optsHandleVerifyAndSign.strLogPrefix,
            optsHandleVerifyAndSign.strDirection, optsHandleVerifyAndSign.jarrMessages,
            optsHandleVerifyAndSign.nIdxCurrentMsgBlockStart,
            optsHandleVerifyAndSign.joExtraSignOpts
        );
        //
        optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
            cc.debug( "Will BLS-sign verified messages." ) + "\n" );
        let joAccount = optsHandleVerifyAndSign.imaState.chainProperties.sc.joAccount;
        if( ! joAccount.strURL ) {
            joAccount = optsHandleVerifyAndSign.imaState.chainProperties.mn.joAccount;
            if( ! joAccount.strSgxURL )
                throw new Error( "SGX URL is unknown, cannot sign IMA message(s)" );
            if( ! joAccount.strBlsKeyName )
                throw new Error( "BLS keys name is unknown, cannot sign IMA message(s)" );
        }
        let rpcCallOpts = null;
        if( "strPathSslKey" in joAccount &&
            typeof joAccount.strPathSslKey == "string" &&
            joAccount.strPathSslKey.length > 0 &&
            "strPathSslCert" in joAccount &&
            typeof joAccount.strPathSslCert == "string" &&
            joAccount.strPathSslCert.length > 0
        ) {
            rpcCallOpts = {
                "cert": fs.readFileSync( joAccount.strPathSslCert, "utf8" ),
                "key": fs.readFileSync( joAccount.strPathSslKey, "utf8" )
            };
        } else {
            optsHandleVerifyAndSign.details.write(
                cc.warning( "Will sign via SGX" ) +
                " " + cc.error( "without SSL options" ) +
                "\n" );
        }
        const signerIndex = optsHandleVerifyAndSign.imaState.nNodeNumber;
        await rpcCall.create( joAccount.strSgxURL, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                const strErrorMessage =
                    optsHandleVerifyAndSign.strLogPrefix +
                    cc.bright( optsHandleVerifyAndSign.strDirection ) + " " +
                    cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call to SGX failed, " +
                        "RPC call was not created, error is: " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) +
                    "\n";
                log.write( strErrorMessage );
                optsHandleVerifyAndSign.details.write( strErrorMessage );
                if( joCall )
                    await joCall.disconnect();
                throw new Error(
                    "JSON RPC call to SGX failed, RPC call was not created, error is: " +
                    owaspUtils.extract_error_message( err )
                );
            }
            const joCallSGX = {
                "jsonrpc": "2.0",
                "id": randomCallID(),
                "method": "blsSignMessageHash",
                "params": {
                    "keyShareName": joAccount.strBlsKeyName,
                    "messageHash": optsHandleVerifyAndSign.strMessageHash,
                    "n": optsHandleVerifyAndSign.nParticipants,
                    "t": optsHandleVerifyAndSign.nThreshold,
                    "signerIndex": signerIndex + 0 // 1-based
                }
            };
            optsHandleVerifyAndSign.details.write(
                optsHandleVerifyAndSign.strLogPrefix +
                cc.bright( optsHandleVerifyAndSign.strDirection ) +
                cc.debug( " verification algorithm will invoke " ) + cc.info( "SGX" ) + " " +
                cc.debug( "with call data" ) + " " + cc.j( joCallSGX ) +
                "\n" );
            await joCall.call( joCallSGX, async function( joIn, joOut, err ) {
                if( err ) {
                    const strError =
                        "JSON RPC call to SGX failed, RPC call reported error: " +
                        owaspUtils.extract_error_message( err );
                    optsHandleVerifyAndSign.joRetVal.error = strError;
                    const err_js = new Error( strError );
                    const strErrorMessage =
                        optsHandleVerifyAndSign.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to SGX failed, RPC call reported error: " ) +
                        cc.warning( owaspUtils.extract_error_message( err ) ) +
                        cc.error( ", stack is:" ) + "\n" + cc.stack( err_js.stack ) +
                        "\n";
                    log.write( strErrorMessage );
                    optsHandleVerifyAndSign.details.write( strErrorMessage );
                    await joCall.disconnect();
                    throw err_js;
                }
                optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
                    cc.bright( optsHandleVerifyAndSign.strDirection ) +
                    cc.debug( " Call to " ) + cc.info( "SGX" ) +
                    cc.debug( " done, answer is: " ) + cc.j( joOut ) +
                    "\n" );
                let joSignResult = joOut;
                if( joOut.result != null &&
                    joOut.result != undefined &&
                    typeof joOut.result == "object"
                )
                    joSignResult = joOut.result;
                if( joOut.signResult != null &&
                    joOut.signResult != undefined &&
                    typeof joOut.signResult == "object"
                )
                    joSignResult = joOut.signResult;
                if( "qa" in optsHandleVerifyAndSign.joCallData )
                    optsHandleVerifyAndSign.joRetVal.qa = optsHandleVerifyAndSign.joCallData.qa;
                if( "errorMessage" in joSignResult &&
                    typeof joSignResult.errorMessage == "string" &&
                    joSignResult.errorMessage.length > 0
                ) {
                    optsHandleVerifyAndSign.isSuccess = false;
                    const strError =
                        "BLS signing finished with error: " + joSignResult.errorMessage;
                    optsHandleVerifyAndSign.joRetVal.error = strError;
                    const strErrorMessage =
                        optsHandleVerifyAndSign.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " BLS signing(2) finished with error: " ) +
                        cc.warning( joSignResult.errorMessage ) +
                        "\n";
                    log.write( strErrorMessage );
                    optsHandleVerifyAndSign.details.write( strErrorMessage );
                    await joCall.disconnect();
                    throw new Error( strError );
                }
                optsHandleVerifyAndSign.isSuccess = true;
                optsHandleVerifyAndSign.joRetVal.result = { signResult: joSignResult };
                if( "qa" in optsHandleVerifyAndSign.joCallData )
                    optsHandleVerifyAndSign.joRetVal.qa = optsHandleVerifyAndSign.joCallData.qa;
                await joCall.disconnect();
            } ); // joCall.call ...
        } ); // rpcCall.create ...
    } catch ( err ) {
        optsHandleVerifyAndSign.isSuccess = false;
        const strError = owaspUtils.extract_error_message( err );
        optsHandleVerifyAndSign.joRetVal.error = strError;
        const strErrorMessage =
            optsHandleVerifyAndSign.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " +
            cc.error( "IMA messages verifier/signer error: " ) + cc.warning( strError ) +
            cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
            "\n";
        log.write( strErrorMessage );
        optsHandleVerifyAndSign.details.write( strErrorMessage );
    }
    optsHandleVerifyAndSign.details.exposeDetailsTo(
        log, "IMA messages verifier/signer", optsHandleVerifyAndSign.isSuccess );
    optsHandleVerifyAndSign.details.close();
    return optsHandleVerifyAndSign.joRetVal;
}

async function handle_skale_imaBSU256_prepare( optsBSU256 ) {
    optsBSU256.details.write( optsBSU256.strLogPrefix +
        cc.debug( "Will U256-BLS-sign " ) + cc.j( optsBSU256.joCallData ) +
        "\n" );
    optsBSU256.nThreshold =
        discover_bls_threshold( optsBSU256.imaState.joSChainNetworkInfo );
    optsBSU256.nParticipants =
        discover_bls_participants( optsBSU256.imaState.joSChainNetworkInfo );
    optsBSU256.details.write( optsBSU256.strLogPrefix +
        cc.debug( "Discovered BLS threshold is " ) +
        cc.info( optsBSU256.nThreshold ) + cc.debug( "." ) +
        "\n" );
    optsBSU256.details.write( optsBSU256.strLogPrefix +
        cc.debug( "Discovered number of BLS participants is " ) +
        cc.info( optsBSU256.nParticipants ) + cc.debug( "." ) +
        "\n" );

    optsBSU256.u256 = optsBSU256.joCallData.params.valueToSign;
    optsBSU256.details.write( optsBSU256.strLogPrefix +
        cc.debug( "U256 original value is " ) + cc.info( optsBSU256.u256 ) +
        "\n" );
    optsBSU256.strMessageHash = keccak256_optsBSU256.u256( optsBSU256.u256, true );
    optsBSU256.details.write( optsBSU256.strLogPrefix +
        cc.debug( "hash of U256 value to sign is " ) + cc.info( optsBSU256.strMessageHash ) +
        "\n" );

    optsBSU256.details.write( optsBSU256.strLogPrefix + cc.debug( "Will BLS-sign U256." ) + "\n" );
    optsBSU256.joAccount = optsBSU256.imaState.chainProperties.sc.optsBSU256.joAccount;
    if( ! optsBSU256.joAccount.strURL ) {
        optsBSU256.joAccount = optsBSU256.imaState.chainProperties.mn.optsBSU256.joAccount;
        if( ! optsBSU256.joAccount.strSgxURL )
            throw new Error( "SGX URL is unknown, cannot sign U256" );
        if( ! optsBSU256.joAccount.strBlsKeyName )
            throw new Error( "BLS keys name is unknown, cannot sign U256" );
    }
}

export async function handle_skale_imaBSU256( joCallData ) {
    const optsBSU256 = {
        joCallData: joCallData,
        imaState: state.get(),
        strLogPrefix: "",
        details: log.createMemoryStream(),
        joRetVal: {},
        isSuccess: false,
        nThreshold: 1,
        nParticipants: 1,
        u256: null,
        strMessageHash: "",
        joAccount: null
    };
    try {
        await handle_skale_imaBSU256_prepare( optsBSU256 );
        let rpcCallOpts = null;
        if( "strPathSslKey" in optsBSU256.joAccount &&
            typeof optsBSU256.joAccount.strPathSslKey == "string" &&
            optsBSU256.joAccount.strPathSslKey.length > 0 &&
            "strPathSslCert" in optsBSU256.joAccount &&
            typeof optsBSU256.joAccount.strPathSslCert == "string" &&
            optsBSU256.joAccount.strPathSslCert.length > 0
        ) {
            rpcCallOpts = {
                "cert": fs.readFileSync( optsBSU256.joAccount.strPathSslCert, "utf8" ),
                "key": fs.readFileSync( optsBSU256.joAccount.strPathSslKey, "utf8" )
            };
        } else {
            optsBSU256.details.write(
                cc.warning( "Will sign via SGX" ) + " " + cc.error( "without SSL options" ) +
                "\n" );
        }
        const signerIndex = optsBSU256.imaState.nNodeNumber;
        await rpcCall.create( optsBSU256.joAccount.strSgxURL, rpcCallOpts,
            async function( joCall, err ) {
                if( err ) {
                    const strErrorMessage =
                    optsBSU256.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call to SGX failed, " +
                        "RPC call was not created, error is: " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) +
                    "\n";
                    log.write( strErrorMessage );
                    optsBSU256.details.write( strErrorMessage );
                    if( joCall )
                        await joCall.disconnect();
                    throw new Error(
                        "JSON RPC call to SGX failed, RPC call was not created, error is: " +
                    owaspUtils.extract_error_message( err )
                    );
                }
                const joCallSGX = {
                    "jsonrpc": "2.0",
                    "id": randomCallID(),
                    "method": "blsSignMessageHash",
                    "params": {
                        "keyShareName": optsBSU256.joAccount.strBlsKeyName,
                        "messageHash": optsBSU256.strMessageHash,
                        "n": optsBSU256.nParticipants,
                        "t": optsBSU256.nThreshold,
                        "signerIndex": signerIndex + 0 // 1-based
                    }
                };
                optsBSU256.details.write( optsBSU256.strLogPrefix +
                cc.debug( "Will invoke " ) + cc.info( "SGX" ) +
                cc.debug( " with call data " ) + cc.j( joCallSGX ) +
                "\n" );
                await joCall.call( joCallSGX, async function( joIn, joOut, err ) {
                    if( err ) {
                        const err_js = new Error(
                            "JSON RPC call to SGX failed, RPC call reported error: " +
                        owaspUtils.extract_error_message( err )
                        );
                        const strErrorMessage =
                        optsBSU256.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to SGX failed, RPC call reported error: " ) +
                        cc.warning( owaspUtils.extract_error_message( err ) ) +
                        cc.error( ", stack is:" ) + "\n" + cc.stack( err_js.stack ) +
                        "\n";
                        log.write( strErrorMessage );
                        optsBSU256.details.write( strErrorMessage );
                        await joCall.disconnect();
                        throw err_js;
                    }
                    optsBSU256.details.write( optsBSU256.strLogPrefix +
                    cc.debug( "Call to " ) + cc.info( "SGX" ) +
                    cc.debug( " done, answer is: " ) + cc.j( joOut ) +
                    "\n" );
                    let joSignResult = joOut;
                    if( joOut.result != null &&
                    joOut.result != undefined &&
                    typeof joOut.result == "object"
                    )
                        joSignResult = joOut.result;
                    if( joOut.signResult != null &&
                    joOut.signResult != undefined &&
                    typeof joOut.signResult == "object"
                    )
                        joSignResult = joOut.signResult;
                    if( "errorMessage" in joSignResult &&
                    typeof joSignResult.errorMessage == "string" &&
                    joSignResult.errorMessage.length > 0
                    ) {
                        optsBSU256.isSuccess = false;
                        const strError =
                        "BLS signing finished with error: " + joSignResult.errorMessage;
                        optsBSU256.joRetVal.error = strError;
                        const strErrorMessage =
                        optsBSU256.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " BLS signing(3) finished with error: " ) +
                        cc.warning( joSignResult.errorMessage ) + "\n";
                        log.write( strErrorMessage );
                        optsBSU256.details.write( strErrorMessage );
                        await joCall.disconnect();
                        throw new Error( strError );
                    }
                    optsBSU256.isSuccess = true;
                    optsBSU256.joRetVal.result = { signResult: joSignResult };
                    if( "qa" in optsBSU256.joCallData )
                        optsBSU256.joRetVal.qa = optsBSU256.joCallData.qa;
                    await joCall.disconnect();
                } ); // joCall.call ...
            } ); // rpcCall.create ...
    } catch ( err ) {
        optsBSU256.isSuccess = false;
        const strError = owaspUtils.extract_error_message( err );
        optsBSU256.joRetVal.error = strError;
        const strErrorMessage =
            optsBSU256.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " +
            cc.error( "U256-BLS-signer error: " ) + cc.warning( strError ) +
            cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
            "\n";
        log.write( strErrorMessage );
        optsBSU256.details.write( strErrorMessage );
    }
    optsBSU256.details.exposeDetailsTo( log, "U256-BLS-signer", optsBSU256.isSuccess );
    optsBSU256.details.close();
    return optsBSU256.joRetVal;
}
