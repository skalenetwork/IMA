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
import * as owaspUtils from "../npms/skale-owasp/owaspUtils.mjs";
import * as childProcessModule from "child_process";
import * as rpcCall from "./rpcCall.mjs";
import * as shellModule from "shelljs";
import * as imaUtils from "./utils.mjs";
import * as sha3Module from "sha3";
import * as skaleObserver from "../npms/skale-observer/observer.mjs";
import * as discoveryTools from "./discoveryTools.mjs";

import * as state from "./state.mjs";
import { randomCallID } from "../npms/skale-cool-socket/socketUtils.mjs";

const shell = shellModule.default;

const Keccak = sha3Module.Keccak;

const sleep =
    ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

const gSecondsMessageVerifySendTimeout = 2 * 60;

async function withTimeout( strDescription, promise, seconds ) {
    strDescription = strDescription || "withTimeout()";
    let resultError = null, isComplete = false;
    promise.catch( function( err ) {
        isComplete = true;
        resultError =
            new Error( strDescription + "error: " + owaspUtils.extractErrorMessage( err ) );
    } ).finally( function() {
        isComplete = true;
    } );
    for( let idxWaitStep = 0; idxWaitStep < seconds; ++ idxWaitStep ) {
        if( isComplete )
            break;
        await sleep( 1000 );
    }
    if( resultError )
        throw resultError;
    if( ! isComplete )
        throw new Error( strDescription + " reached limit of " + seconds + " second(s)" );
};

function discoverBlsThreshold( joSChainNetworkInfo ) {
    const imaState = state.get();
    joSChainNetworkInfo = joSChainNetworkInfo || imaState.joSChainNetworkInfo;
    if( ! joSChainNetworkInfo )
        return -1;
    const jarrNodes = joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++i ) {
        const joNode = jarrNodes[i];
        if( discoveryTools.isSChainNodeFullyDiscovered( joNode ) )
            return joNode.imaInfo.t;
    }
    return -1;
}

function discoverBlsParticipants( joSChainNetworkInfo ) {
    const imaState = state.get();
    joSChainNetworkInfo = joSChainNetworkInfo || imaState.joSChainNetworkInfo;
    if( ! joSChainNetworkInfo )
        return -1;
    const jarrNodes = joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++i ) {
        const joNode = jarrNodes[i];
        if( discoveryTools.isSChainNodeFullyDiscovered( joNode ) )
            return joNode.imaInfo.n;
    }
    return -1;
}

function checkBlsThresholdAndBlsParticipants(
    nThreshold, nParticipants, strOperation, details ) {
    details = details || log;
    if( nThreshold <= 0 ) {
        details.write(
            cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Operation " ) + cc.bright( strOperation ) +
            cc.error( " will fail because discovered BLS threshold " ) +
            cc.info( nThreshold ) + cc.error( " is invalid number or bad value" ) + "\n" );
        return false;
    }
    if( nParticipants <= 0 ) {
        details.write(
            cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Operation " ) + cc.bright( strOperation ) +
            cc.error( " will fail because discovered BLS number of participants " ) +
            cc.info( nParticipants ) + cc.error( " is invalid number or bad value" ) + "\n" );
        return false;
    }
    if( nThreshold > nParticipants ) {
        details.write(
            cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Operation " ) + cc.bright( strOperation ) +
            cc.error( " will fail because discovered BLS threshold " ) +
            cc.info( nThreshold ) + cc.error( " is greater than BLS number of participants " ) +
            cc.info( nParticipants ) + "\n" );
        return false;
    }
    return true;
}

function discoverPublicKeyByIndex( nNodeIndex, joSChainNetworkInfo, details, isThrowException ) {
    details = details || log;
    const imaState = state.get();
    joSChainNetworkInfo = joSChainNetworkInfo || imaState.joSChainNetworkInfo;
    const jarrNodes = joSChainNetworkInfo.network;
    const cntNodes = jarrNodes.length;
    const joNode = jarrNodes[nNodeIndex];
    if( discoveryTools.isSChainNodeFullyDiscovered( joNode ) ) {
        return {
            BLSPublicKey0: joNode.imaInfo.BLSPublicKey0,
            BLSPublicKey1: joNode.imaInfo.BLSPublicKey1,
            BLSPublicKey2: joNode.imaInfo.BLSPublicKey2,
            BLSPublicKey3: joNode.imaInfo.BLSPublicKey3
        };
    }
    details.write( cc.fatal( "CRITICAL ERROR:" ) +
        cc.error( " BLS 1/" + cntNodes + " public key discovery failed for node #" ) +
        cc.info( nNodeIndex ) + cc.error( ", node data is: " ) + cc.j( joNode ) + "\n" );
    if( isThrowException ) {
        throw new Error(
            "BLS 1/" + cntNodes + " public key discovery failed for node #" + nNodeIndex );
    }
    return null;
}

function discoverCommonPublicKey( joSChainNetworkInfo, isThrowException ) {
    const imaState = state.get();
    joSChainNetworkInfo = joSChainNetworkInfo || imaState.joSChainNetworkInfo;
    const jarrNodes = joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++i ) {
        const joNode = jarrNodes[i];
        if( discoveryTools.isSChainNodeFullyDiscovered( joNode ) ) {
            return {
                commonBLSPublicKey0: joNode.imaInfo.commonBLSPublicKey0,
                commonBLSPublicKey1: joNode.imaInfo.commonBLSPublicKey1,
                commonBLSPublicKey2: joNode.imaInfo.commonBLSPublicKey2,
                commonBLSPublicKey3: joNode.imaInfo.commonBLSPublicKey3
            };
        }
    }
    details.write( cc.fatal( "CRITICAL ERROR:" ) +
        cc.error( " BLS common public key discovery failed, chain data is: " ) +
        cc.j( joSChainNetworkInfo ) + "\n" );
    if( isThrowException )
        throw new Error( "BLS common public key discovery failed" );
    return null;
}

function hexPrepare( strHex, isInvertBefore, isInvertAfter ) {
    if( isInvertBefore == undefined )
        isInvertBefore = true;
    if( isInvertAfter == undefined )
        isInvertAfter = true;
    let arrBytes = imaUtils.hexToBytes( strHex );
    if( isInvertBefore )
        arrBytes = arrBytes.reverse();
    arrBytes = imaUtils.bytesAlignLeftWithZeroes( arrBytes, 32 );
    if( isInvertAfter )
        arrBytes = arrBytes.reverse();
    return arrBytes;
}

function stringToKeccak256( s ) {
    const strU256 = owaspUtils.ethersMod.ethers.utils.id( s );
    return hexPrepare( strU256, true, true );
}

function arrayToKeccak256( arrBytes ) {
    const k = new Keccak( 256 );
    k.update( imaUtils.toBuffer( arrBytes ) );
    const h = k.digest( "hex" );
    return imaUtils.hexToBytes( "0x" + h );
}

function keccak256Message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName ) {
    let arrBytes = stringToKeccak256( strFromChainName );
    arrBytes = imaUtils.bytesConcat(
        arrBytes,
        hexPrepare(
            owaspUtils.ensureStartsWith0x( nIdxCurrentMsgBlockStart.toString( 16 ) ),
            false,
            false
        )
    );
    arrBytes = arrayToKeccak256( arrBytes );
    const cnt = jarrMessages.length;
    for( let i = 0; i < cnt; ++i ) {
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
        arrBytes = arrayToKeccak256( arrBytes );
    }
    return owaspUtils.ensureStartsWith0x( imaUtils.bytesToHex( arrBytes, false ) );
}

export function keccak256U256( u256, isHash ) {
    let arrBytes = new Uint8Array();

    let bytesU256 = imaUtils.hexToBytes( u256 );
    bytesU256 = bytesU256.reverse();
    bytesU256 = imaUtils.bytesAlignLeftWithZeroes( bytesU256, 32 );
    bytesU256 = bytesU256.reverse();
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesU256 );

    let strMessageHash = "";
    if( isHash ) {
        const hash = new Keccak( 256 );
        hash.update( imaUtils.toBuffer( arrBytes ) );
        strMessageHash = hash.digest( "hex" );
    } else
        strMessageHash = "0x" + imaUtils.bytesToHex( arrBytes );
    return strMessageHash;
}

export function keccak256ForPendingWorkAnalysis( nNodeNumber, strLoopWorkType, isStart, ts ) {
    let arrBytes = new Uint8Array();

    let bytesU256 = imaUtils.hexToBytes( nNodeNumber );
    bytesU256 = bytesU256.reverse();
    bytesU256 = imaUtils.bytesAlignLeftWithZeroes( bytesU256, 32 );
    bytesU256 = bytesU256.reverse();
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesU256 );

    arrBytes = imaUtils.bytesConcat( arrBytes, stringToKeccak256( strLoopWorkType ) );

    bytesU256 = imaUtils.hexToBytes( isStart ? 1 : 0 );
    bytesU256 = bytesU256.reverse();
    bytesU256 = imaUtils.bytesAlignLeftWithZeroes( bytesU256, 32 );
    bytesU256 = bytesU256.reverse();
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesU256 );

    bytesU256 = imaUtils.hexToBytes( ts );
    bytesU256 = bytesU256.reverse();
    bytesU256 = imaUtils.bytesAlignLeftWithZeroes( bytesU256, 32 );
    bytesU256 = bytesU256.reverse();
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesU256 );

    const hash = new Keccak( 256 );
    hash.update( imaUtils.toBuffer( arrBytes ) );
    const strMessageHash = hash.digest( "hex" );
    return strMessageHash;
}

function splitSignatureShare( signatureShare ) {
    const jarr = signatureShare.split( ":" );
    if( jarr.length < 2 )
        throw new Error( "Failed to split signatureShare=" + signatureShare.toString() );
    return {
        X: jarr[0],
        Y: jarr[1]
    };
}

function getBlsGlueTmpDir() {
    const strTmpDir = "/tmp/ima-bls-glue";
    shell.mkdir( "-p", strTmpDir );
    return strTmpDir;
}

function allocBlsTmpActionDir() {
    const strActionDir =
        getBlsGlueTmpDir() + "/" + imaUtils.replaceAll( imaUtils.uuid(), "-", "" );
    if( ! fs.existsSync( strActionDir ) )
        fs.mkdirSync( strActionDir , { recursive: true } );
    return strActionDir;
}

function performBlsGlue(
    details, strDirection, jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName, arrSignResults
) {
    const imaState = state.get();
    const strLogPrefix =
        cc.bright( strDirection ) + cc.debug( "/" ) +
        cc.info( "BLS" ) + cc.debug( "/" ) +
        cc.attention( "Glue" ) + cc.debug( ":" ) + " ";
    let joGlueResult = null;
    const nThreshold = discoverBlsThreshold( imaState.joSChainNetworkInfo );
    const nParticipants = discoverBlsParticipants( imaState.joSChainNetworkInfo );
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        details.write( strLogPrefix + cc.debug( "Discovered BLS threshold is " ) +
            cc.info( nThreshold ) + cc.debug( "." ) + "\n" );
        details.write( strLogPrefix + cc.debug( "Discovered number of BLS participants is " ) +
            cc.info( nParticipants ) + cc.debug( "." ) + "\n" );
    }
    if( ! checkBlsThresholdAndBlsParticipants( nThreshold, nParticipants, "BLS glue", details ) )
        return null;
    const strMessageHash =
        owaspUtils.removeStarting0x(
            keccak256Message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName )
        );
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        details.write( strLogPrefix + cc.debug( "Message hash to sign is " ) +
            cc.info( strMessageHash ) + "\n" );
    }
    const strActionDir = allocBlsTmpActionDir();
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        details.write( strLogPrefix + cc.debug( "performBlsGlue will work in " ) +
            cc.info( strActionDir ) + cc.debug( " director with " ) +
            cc.info( arrSignResults.length ) + cc.debug( " sign results..." ) + "\n" );
    }
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        let strInput = "";
        const cnt = arrSignResults.length;
        for( let i = 0; i < cnt; ++i ) {
            const jo = arrSignResults[i];
            if( ( !jo ) || typeof jo != "object" )
                throw new Error( "Failed to save BLS part " + i + "because it's not JSON object" );
            const strPath = strActionDir + "/sign-result" + jo.index + ".json";
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "Saving " ) + cc.notice( strPath ) +
                    cc.debug( " file containing " ) + cc.j( jo ) + "\n" );
            }
            imaUtils.jsonFileSave( strPath, jo );
            strInput += " --input " + strPath;
        }
        const strGlueCommand =
            imaState.strPathBlsGlue +
            " --t " + nThreshold +
            " --n " + nParticipants +
            strInput +
            " --output " + strActionDir + "/glue-result.json";
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Will execute BLS glue command:\n" ) +
                cc.notice( strGlueCommand ) + "\n" );
        }
        strOutput = childProcessModule.execSync( strGlueCommand, { cwd: strActionDir } );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS glue output is:\n" ) +
                cc.notice( strOutput ) + "\n" );
        }
        joGlueResult = imaUtils.jsonFileLoad( strActionDir + "/glue-result.json" );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS glue result is: " ) +
                cc.j( joGlueResult ) + "\n" );
        }
        if( "X" in joGlueResult.signature && "Y" in joGlueResult.signature ) {
            if( log.verboseGet() >= log.verboseReversed().debug )
                details.write( strLogPrefix + cc.success( "BLS glue success" ) + "\n" );
            joGlueResult.hashSrc = strMessageHash;
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "Computing " ) + cc.info( "G1" ) +
                    cc.debug( " hash point..." ) + "\n" );
            }
            const strPath = strActionDir + "/hash.json";
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "Saving " ) + cc.notice( strPath ) +
                    cc.debug( " file..." ) + "\n" );
            }
            imaUtils.jsonFileSave( strPath, { "message": strMessageHash } );
            const strHasG1Command =
                imaState.strPathHashG1 +
                " --t " + nThreshold +
                " --n " + nParticipants;
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "Will execute HashG1 command:\n" ) +
                    cc.notice( strHasG1Command ) + "\n" );
            }
            strOutput = childProcessModule.execSync( strHasG1Command, { cwd: strActionDir } );
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "HashG1 output is:\n" ) +
                    cc.notice( strOutput ) + "\n" );
            }
            const joResultHashG1 = imaUtils.jsonFileLoad( strActionDir + "/g1.json" );
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "HashG1 result is: " ) +
                    cc.j( joResultHashG1 ) + "\n" );
            }
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
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const s1 = strLogPrefix +
                cc.fatal( "BLS glue CRITICAL ERROR:" ) + cc.error( " error description is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n";
            const s2 = strLogPrefix +
                cc.error( "BLS glue output is:\n" ) + cc.notice( strOutput ) +
                "\n";
            details.write( s1 );
            details.write( s2 );
        }
        fnShellRestore();
        joGlueResult = null;
    }
    return joGlueResult;
}

function performBlsGlueU256( details, u256, arrSignResults ) {
    const imaState = state.get();
    const strLogPrefix =
        cc.info( "BLS" ) + cc.debug( "/" ) + cc.attention( "Glue" ) +
        cc.debug( ":" ) + " ";
    let joGlueResult = null;
    const nThreshold = discoverBlsThreshold( imaState.joSChainNetworkInfo );
    const nParticipants = discoverBlsParticipants( imaState.joSChainNetworkInfo );
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        details.write( strLogPrefix + cc.debug( "Discovered BLS threshold is " ) +
            cc.info( nThreshold ) + cc.debug( "." ) + "\n" );
        details.write( strLogPrefix + cc.debug( "Discovered number of BLS participants is " ) +
            cc.info( nParticipants ) + cc.debug( "." ) + "\n" );
    }
    if( ! checkBlsThresholdAndBlsParticipants(
        nThreshold, nParticipants, "BLS glue-256", details ) )
        return null;
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        details.write( strLogPrefix + cc.debug( "Original long message is " ) +
            cc.info( keccak256U256( u256, false ) ) + "\n" );
    }
    const strMessageHash = keccak256U256( u256, true );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        details.write( strLogPrefix + cc.debug( "Message hash to sign is " ) +
            cc.info( strMessageHash ) + "\n" );
    }
    const strActionDir = allocBlsTmpActionDir();
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        details.write( strLogPrefix + cc.debug( "performBlsGlueU256 will work in " ) +
            cc.info( strActionDir ) + cc.debug( " director with " ) +
            cc.info( arrSignResults.length ) + cc.debug( " sign results..." ) + "\n" );
    }
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        let strInput = "";
        const cnt = arrSignResults.length;
        for( let i = 0; i < cnt; ++i ) {
            const jo = arrSignResults[i];
            if( ( !jo ) || typeof jo != "object" )
                throw new Error( "Failed to save BLS part " + i + "because it's not JSON object" );
            const strPath = strActionDir + "/sign-result" + jo.index + ".json";
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "Saving " ) + cc.notice( strPath ) +
                    cc.debug( " file..." ) + "\n" );
            }
            imaUtils.jsonFileSave( strPath, jo );
            strInput += " --input " + strPath;
        }
        const strGlueCommand =
            imaState.strPathBlsGlue +
            " --t " + nThreshold +
            " --n " + nParticipants +
            strInput +
            " --output " + strActionDir + "/glue-result.json";
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Will execute BLS glue command:\n" ) +
                cc.notice( strGlueCommand ) + "\n" );
        }
        strOutput = childProcessModule.execSync( strGlueCommand, { cwd: strActionDir } );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS glue output is:\n" ) +
                cc.notice( strOutput ) + "\n" );
        }
        joGlueResult = imaUtils.jsonFileLoad( strActionDir + "/glue-result.json" );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS glue result is: " ) +
                cc.j( joGlueResult ) + "\n" );
        }
        if( "X" in joGlueResult.signature && "Y" in joGlueResult.signature ) {
            if( log.verboseGet() >= log.verboseReversed().trace )
                details.write( strLogPrefix + cc.success( "BLS glue success" ) + "\n" );
            joGlueResult.hashSrc = strMessageHash;
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "Computing " ) + cc.info( "G1" ) +
                    cc.debug( " hash point..." ) + "\n" );
            }
            const strPath = strActionDir + "/hash.json";
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "Saving " ) + cc.notice( strPath ) +
                    cc.debug( " file..." ) + "\n" );
            }
            imaUtils.jsonFileSave( strPath, { "message": strMessageHash } );
            const strHasG1Command =
                imaState.strPathHashG1 +
                " --t " + nThreshold +
                " --n " + nParticipants;
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "Will execute HashG1 command:\n" ) +
                    cc.notice( strHasG1Command ) + "\n" );
            }
            strOutput = childProcessModule.execSync( strHasG1Command, { cwd: strActionDir } );
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "HashG1 output is:\n" ) +
                    cc.notice( strOutput ) + "\n" );
            }
            const joResultHashG1 = imaUtils.jsonFileLoad( strActionDir + "/g1.json" );
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "HashG1 result is: " ) +
                    cc.j( joResultHashG1 ) + "\n" );
            }
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
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const s1 = strLogPrefix +
                cc.fatal( "BLS glue CRITICAL ERROR:" ) + cc.error( " error description is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n" +
                cc.error( ", stack is: " ) + cc.stack( err.stack ) +
                "\n";
            const s2 = strLogPrefix +
                cc.error( "BLS glue output is:\n" ) + cc.notice( strOutput ) +
                "\n";
            details.write( s1 );
            details.write( s2 );
        }
        fnShellRestore();
        joGlueResult = null;
    }
    return joGlueResult;
}

function performBlsVerifyI(
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
    const nThreshold = discoverBlsThreshold( imaState.joSChainNetworkInfo );
    const nParticipants = discoverBlsParticipants( imaState.joSChainNetworkInfo );
    if( ! checkBlsThresholdAndBlsParticipants(
        nThreshold, nParticipants, "BLS verify-I", details ) )
        return false;
    const strActionDir = allocBlsTmpActionDir();
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " - first message nonce is " ) +
                cc.info( nIdxCurrentMsgBlockStart ) + "\n" );
            details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " - first source chain name is " ) +
                cc.info( strFromChainName ) + "\n" );
            details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " - messages array " ) +
                cc.j( jarrMessages ) + "\n" );
        }
        const strMessageHash =
            owaspUtils.removeStarting0x(
                keccak256Message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName ) );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " - hashed verify message is " ) +
                cc.info( strMessageHash ) + "\n" );
        }
        const joMsg = { "message": strMessageHash };
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " - composed  " ) + cc.j( joMsg ) +
                cc.debug( " composed from " ) + cc.j( jarrMessages ) + cc.debug( " using glue " ) +
                cc.j( joResultFromNode ) + cc.debug( " and public key " ) + cc.j( joPublicKey ) +
                "\n" );
        }
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
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Will execute node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " BLS verify command:\n" ) +
                cc.notice( strVerifyCommand ) + "\n" );
        }
        strOutput = childProcessModule.execSync( strVerifyCommand, { cwd: strActionDir } );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " verify output is:\n" ) +
                cc.notice( strOutput ) + "\n" );
        }
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( strLogPrefix + cc.success( "BLS node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.success( " verify success" ) + "\n" );
        }
        fnShellRestore();
        return true;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const s1 = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) +
                cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify error:" ) +
                cc.warning( " error description is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n";
            const s2 = strLogPrefix +
                cc.error( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) +
                cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
                cc.error( " verify output is:\n" ) + cc.notice( strOutput ) +
                "\n";
            details.write( s1 );
            details.write( s2 );
        }
        fnShellRestore();
    }
    return false;
}

function performBlsVerifyIU256(
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
    const nThreshold = discoverBlsThreshold( imaState.joSChainNetworkInfo );
    const nParticipants = discoverBlsParticipants( imaState.joSChainNetworkInfo );
    if( ! checkBlsThresholdAndBlsParticipants(
        nThreshold, nParticipants, "BLS verify-I-U256", details ) )
        return false;
    const strActionDir = allocBlsTmpActionDir();
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        const joMsg = { "message": keccak256U256( u256, true ) };
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( strLogPrefix + cc.debug( "BLS u256 node " ) + cc.notice( "#" ) +
            cc.info( nZeroBasedNodeIndex ) + cc.debug( " verify message " ) + cc.j( joMsg ) +
            cc.debug( " composed from " ) + cc.j( u256 ) + cc.debug( " using glue " ) +
            cc.j( joResultFromNode ) + cc.debug( " and public key " ) + cc.j( joPublicKey ) +
            "\n" );
        }
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
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Will execute node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " BLS u256 verify command:\n" ) +
                cc.notice( strVerifyCommand ) + "\n" );
        }
        strOutput = childProcessModule.execSync( strVerifyCommand, { cwd: strActionDir } );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS u256 node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " verify output is:\n" ) +
                cc.notice( strOutput ) + "\n" );
        }
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( strLogPrefix + cc.success( "BLS u256 node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.success( " verify success" ) + "\n" );
        }
        fnShellRestore();
        return true;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const s1 = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) + cc.error( " BLS u256 node " ) +
                cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
                cc.error( " verify error:" ) +
                cc.warning( " error description is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n";
            const s2 = strLogPrefix +
                cc.error( "CRITICAL ERROR:" ) + cc.error( " BLS u256 node " ) +
                cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
                cc.error( " verify output is:\n" ) + cc.notice( strOutput ) +
                "\n";
            details.write( s1 );
            details.write( s2 );
        }
        fnShellRestore();
    }
    return false;
}

function performBlsVerify(
    details,
    strDirection,
    joGlueResult,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    joCommonPublicKey
) {
    if( !joGlueResult )
        return true;
    const imaState = state.get();
    const nThreshold = discoverBlsThreshold( imaState.joSChainNetworkInfo );
    const nParticipants = discoverBlsParticipants( imaState.joSChainNetworkInfo );
    if( ! checkBlsThresholdAndBlsParticipants(
        nThreshold, nParticipants, "BLS verify", details ) )
        return false;
    const strActionDir = allocBlsTmpActionDir();
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    const strLogPrefix =
        cc.bright( strDirection ) + cc.debug( "/" ) +
        cc.info( "BLS" ) + cc.debug( "/" ) +
        cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
    try {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS/summary verify message - " +
                "first message nonce is " ) + cc.info( nIdxCurrentMsgBlockStart ) + "\n" );
            details.write( strLogPrefix + cc.debug( "BLS/summary verify message - " +
                "first source chain name is " ) + cc.info( strFromChainName ) + "\n" );
            details.write( strLogPrefix + cc.debug( "BLS/summary verify message - " +
                "messages array " ) + cc.j( jarrMessages ) + "\n" );
        }
        const strMessageHash =
            owaspUtils.removeStarting0x(
                keccak256Message( jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName )
            );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS/summary verify message - " +
                "hashed verify message is " ) + cc.info( strMessageHash ) + "\n" );
        }
        const joMsg = { "message": strMessageHash };
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( strLogPrefix + cc.debug( "BLS/summary verify message - " +
                "composed JSON " ) + cc.j( joMsg ) + cc.debug( " from messages array " ) +
                cc.j( jarrMessages ) + cc.debug( " using glue " ) + cc.j( joGlueResult ) +
            cc.debug( " and common public key " ) + cc.j( joCommonPublicKey ) + "\n" );
        }
        imaUtils.jsonFileSave( strActionDir + "/glue-result.json", joGlueResult );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        const joCommonPublicKeyToSave = {
            commonBLSPublicKey0: joCommonPublicKey.commonBLSPublicKey0,
            commonBLSPublicKey1: joCommonPublicKey.commonBLSPublicKey1,
            commonBLSPublicKey2: joCommonPublicKey.commonBLSPublicKey2,
            commonBLSPublicKey3: joCommonPublicKey.commonBLSPublicKey3
        };
        imaUtils.jsonFileSave( strActionDir + "/common_public_key.json", joCommonPublicKeyToSave );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS common public key " +
                "for verification is:\n" ) + cc.j( joCommonPublicKey ) + "\n" );
        }
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --input " + "./glue-result.json"
            ;
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Will execute BLS/summary verify command:\n" ) +
                cc.notice( strVerifyCommand ) + "\n" );
        }
        strOutput = childProcessModule.execSync( strVerifyCommand, { cwd: strActionDir } );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS/summary verify output is:\n" ) +
                cc.notice( strOutput ) + "\n" );
        }
        if( log.verboseGet() >= log.verboseReversed().debug )
            details.write( strLogPrefix + cc.success( "BLS/summary verify success" ) + "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const s1 = strLogPrefix +
                cc.fatal( "BLS/summary verify CRITICAL ERROR:" ) +
                cc.error( " error description is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n";
            const s2 = strLogPrefix +
                cc.error( "BLS/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n";
            details.write( s1 );
            details.write( s2 );
        }
        fnShellRestore();
    }
    return false;
}

function performBlsVerifyU256( details, joGlueResult, u256, joCommonPublicKey ) {
    if( !joGlueResult )
        return true;
    const imaState = state.get();
    const nThreshold = discoverBlsThreshold( imaState.joSChainNetworkInfo );
    const nParticipants = discoverBlsParticipants( imaState.joSChainNetworkInfo );
    if( ! checkBlsThresholdAndBlsParticipants(
        nThreshold, nParticipants, "BLS verify-U256", details ) )
        return false;
    const strActionDir = allocBlsTmpActionDir();
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    const strLogPrefix =
        cc.info( "BLS u256" ) + cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
    try {
        const joMsg = { "message": keccak256U256( u256, true ) };
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( strLogPrefix + cc.debug( "BLS u256/summary verify message " ) +
                cc.j( joMsg ) + cc.debug( " composed from " ) + cc.j( u256 ) +
                cc.debug( " using glue " ) + cc.j( joGlueResult ) +
                cc.debug( " and common public key " ) + cc.j( joCommonPublicKey ) + "\n" );
        }
        imaUtils.jsonFileSave( strActionDir + "/glue-result.json", joGlueResult );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        const joCommonPublicKeyToSave = {
            commonBLSPublicKey0: joCommonPublicKey.commonBLSPublicKey0,
            commonBLSPublicKey1: joCommonPublicKey.commonBLSPublicKey1,
            commonBLSPublicKey2: joCommonPublicKey.commonBLSPublicKey2,
            commonBLSPublicKey3: joCommonPublicKey.commonBLSPublicKey3
        };
        imaUtils.jsonFileSave( strActionDir + "/common_public_key.json", joCommonPublicKeyToSave );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS u256 common public key " +
                "for verification is:\n" ) + cc.j( joCommonPublicKey ) + "\n" );
        }
        const strVerifyCommand = "" +
            imaState.strPathBlsVerify +
            " --t " + nThreshold +
            " --n " + nParticipants +
            " --input " + "./glue-result.json"
            ;
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Will execute BLS u256/summary " +
                "verify command:\n" ) + cc.notice( strVerifyCommand ) + "\n" );
        }
        strOutput = childProcessModule.execSync( strVerifyCommand, { cwd: strActionDir } );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS u256/summary verify output is:\n" ) +
                cc.notice( strOutput ) + "\n" );
        }
        if( log.verboseGet() >= log.verboseReversed().debug )
            details.write( strLogPrefix + cc.success( "BLS u256/summary verify success" ) + "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const s1 = strLogPrefix +
                cc.fatal( "BLS u256/summary verify CRITICAL ERROR:" ) +
                cc.error( " error description is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n";
            const s2 = strLogPrefix +
                cc.error( "BLS u256/summary verify output is:\n" ) +
                cc.notice( strOutput ) +
                "\n";
            details.write( s1 );
            details.write( s2 );
        }
        fnShellRestore();
    }
    return false;
}

async function checkCorrectnessOfMessagesToSign(
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
        joMessageProxy = imaState.joMessageProxyMainNet;
        joAccount = imaState.chainProperties.mn.joAccount;
        joChainName = imaState.chainProperties.sc.strChainName;
    } else if( strDirection == "S2M" ) {
        joMessageProxy = imaState.joMessageProxySChain;
        joAccount = imaState.chainProperties.sc.joAccount;
        joChainName = imaState.chainProperties.mn.strChainName;
    } else if( strDirection == "S2S" ) {
        joAccount = imaState.chainProperties.sc.joAccount;
        joChainName = joExtraSignOpts.chainNameDst;
        const ethersProvider =
            ( "ethersProviderSrc" in joExtraSignOpts &&
                joExtraSignOpts.ethersProviderSrc )
                ? joExtraSignOpts.ethersProviderSrc
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
            "CRITICAL ERROR: Failed checkCorrectnessOfMessagesToSign() " +
            "with unknown direction \"" + strDirection + "\"" );
    }

    const strCallerAccountAddress = joAccount.address();
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        details.write( strLogPrefix + cc.bright( strDirection ) +
            cc.debug( " message correctness validation through call to " ) +
            cc.notice( "verifyOutgoingMessageData" ) + cc.debug( " method of " ) +
            cc.bright( "MessageProxy" ) + cc.debug( " contract with address " ) +
            cc.notice( joMessageProxy.address ) + cc.debug( ", caller account address is " ) +
            cc.info( joMessageProxy.address ) + cc.debug( ", message(s) count is " ) +
            cc.debug( ", have " ) + cc.info( jarrMessages.length ) +
            cc.debug( " message(s) to process " ) + cc.j( jarrMessages ) +
            cc.debug( ", first real message index is " ) + cc.info( nIdxCurrentMsgBlockStart ) +
            cc.debug( ", messages will be sent to chain name " ) + cc.info( joChainName ) +
            cc.debug( ", caller address is " ) + cc.info( strCallerAccountAddress ) + "\n" );
    }
    let cntBadMessages = 0, i = 0;
    const cnt = jarrMessages.length;
    if( strDirection == "S2M" || strDirection == "S2S" ) {
        for( i = 0; i < cnt; ++i ) {
            const joMessage = jarrMessages[i];
            const idxMessage = nIdxCurrentMsgBlockStart + i;
            try {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    details.write( strLogPrefix + cc.bright( strDirection ) +
                        cc.debug( " Will validate message " ) + cc.info( i ) + cc.debug( " of " ) +
                        cc.info( cnt ) + cc.debug( ", real message index is " ) +
                        cc.info( idxMessage ) + cc.debug( ", source contract is " ) +
                        cc.info( joMessage.sender ) + cc.debug( ", destination contract is " ) +
                        cc.info( joMessage.destinationContract ) +
                        cc.debug( ", message data is " ) + cc.j( joMessage.data ) + "\n" );
                }
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
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    details.write( strLogPrefix + cc.bright( strDirection ) +
                        cc.debug( " Got verification call result " ) + cc.tf( isValidMessage ) +
                        cc.debug( ", real message index is: " ) + cc.info( idxMessage ) +
                        cc.debug( ", saved msgCounter is: " ) +
                        cc.info( outgoingMessageData.msgCounter ) + "\n" );
                }
                if( !isValidMessage ) {
                    throw new Error(
                        "Bad message detected, message is: " + JSON.stringify( joMessage ) );
                }
            } catch ( err ) {
                ++cntBadMessages;
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "BAD ERROR:" ) + " " +
                        cc.bright( strDirection ) +
                        cc.error( " Correctness validation failed for message " ) +
                        cc.info( idxMessage ) +
                        cc.error( " sent to " ) + cc.info( joChainName ) +
                        cc.error( ", message is: " ) + cc.j( joMessage ) +
                        cc.error( ", error information: " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                        cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
                        "\n";
                    if( log.id != details.id )
                        log.write( strErrorMessage );
                    details.write( strErrorMessage );
                }
            }
        }
    }
    // TODO: M2S - check events
    if( cntBadMessages > 0 ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const s =
                strLogPrefix + cc.fatal( "BAD ERROR:" ) +
                cc.error( " Correctness validation failed for " ) + cc.info( cntBadMessages ) +
                cc.error( " of " ) + cc.info( cnt ) + cc.error( " message(s)" ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
    } else {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( strLogPrefix + cc.success( "Correctness validation passed for " ) +
                cc.info( cnt ) + cc.success( " message(s)" ) + "\n" );
        }
    }
}

async function prepareSignMessagesImpl( optsSignOperation ) {
    optsSignOperation.fn = optsSignOperation.fn || function() {};
    optsSignOperation.sequenceId =
        owaspUtils.removeStarting0x(
            owaspUtils.ethersMod.ethers.utils.id( log.generateTimestampString( null, false ) )
        );
    optsSignOperation.jarrNodes =
        ( optsSignOperation.imaState.bSignMessages &&
            "joSChainNetworkInfo" in optsSignOperation.imaState &&
            typeof optsSignOperation.imaState.joSChainNetworkInfo == "object" &&
            "network" in optsSignOperation.imaState.joSChainNetworkInfo &&
            typeof optsSignOperation.imaState.joSChainNetworkInfo.network == "object"
        )
            ? optsSignOperation.imaState.joSChainNetworkInfo.network
            : [];
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsSignOperation.details.write( optsSignOperation.strLogPrefix + cc.debug( " Invoking " ) +
            cc.bright( optsSignOperation.strDirection ) +
            cc.debug( " signing messages procedure, message signing is " ) +
            cc.onOff( optsSignOperation.imaState.bSignMessages ) + "\n" );
    }
    if( !( optsSignOperation.imaState.bSignMessages &&
        optsSignOperation.imaState.strPathBlsGlue.length > 0 &&
        optsSignOperation.imaState.joSChainNetworkInfo
    ) ) {
        optsSignOperation.bHaveResultReportCalled = true;
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsSignOperation.details.write( optsSignOperation.strLogPrefix +
                cc.debug( "BLS message signing is " ) + cc.error( "turned off" ) +
                cc.debug( ", first real message index is: " ) +
                cc.info( optsSignOperation.nIdxCurrentMsgBlockStart ) + cc.debug( ", have " ) +
                cc.info( optsSignOperation.jarrMessages.length ) +
                cc.debug( " message(s) to process " ) + cc.j( optsSignOperation.jarrMessages ) +
                "\n" );
        }
        optsSignOperation.details.exposeDetailsTo(
            log, optsSignOperation.strGatheredDetailsName, false );
        optsSignOperation.details.close();
        await checkCorrectnessOfMessagesToSign(
            optsSignOperation.details, optsSignOperation.strLogPrefix,
            optsSignOperation.strDirection,
            optsSignOperation.jarrMessages,
            optsSignOperation.nIdxCurrentMsgBlockStart,
            optsSignOperation.joExtraSignOpts
        );
        await optsSignOperation.fn( null, optsSignOperation.jarrMessages, null );
        return true;
    }
    await checkCorrectnessOfMessagesToSign(
        optsSignOperation.details, optsSignOperation.strLogPrefix,
        optsSignOperation.strDirection,
        optsSignOperation.jarrMessages, optsSignOperation.nIdxCurrentMsgBlockStart,
        optsSignOperation.joExtraSignOpts
    );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsSignOperation.details.write( optsSignOperation.strLogPrefix + cc.debug( "Will sign " ) +
            cc.info( optsSignOperation.jarrMessages.length ) + cc.debug( " message(s)" ) +
            cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) +
            cc.attention( optsSignOperation.sequenceId ) + cc.debug( "..." ) + "\n" );
        optsSignOperation.details.write( optsSignOperation.strLogPrefix +
            cc.debug( "Will query to sign " ) + cc.info( optsSignOperation.jarrNodes.length ) +
            cc.debug( " skaled node(s)..." ) + "\n" );
    }
    optsSignOperation.nThreshold =
        discoverBlsThreshold( optsSignOperation.imaState.joSChainNetworkInfo );
    optsSignOperation.nParticipants =
        discoverBlsParticipants( optsSignOperation.imaState.joSChainNetworkInfo );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsSignOperation.details.write( optsSignOperation.strLogPrefix +
            cc.debug( "Discovered BLS threshold is " ) + cc.info( optsSignOperation.nThreshold ) +
            cc.debug( "." ) + "\n" );
        optsSignOperation.details.write( optsSignOperation.strLogPrefix +
            cc.debug( "Discovered number of BLS participants is " ) +
            cc.info( optsSignOperation.nParticipants ) + cc.debug( "." ) + "\n" );
    }
    if( ! checkBlsThresholdAndBlsParticipants(
        optsSignOperation.nThreshold,
        optsSignOperation.nParticipants,
        "prepare sign messages " + optsSignOperation.strDirection,
        optsSignOperation.details ) ) {
        optsSignOperation.bHaveResultReportCalled = true;
        optsSignOperation.details.exposeDetailsTo(
            log, optsSignOperation.strGatheredDetailsName, false );
        optsSignOperation.details.close();
        await optsSignOperation.fn(
            "signature error(1), S-Chain information " +
            "was not discovered properly and BLS threshold/participants are unknown",
            optsSignOperation.jarrMessages,
            null
        );
        return false;
    }
    optsSignOperation.nCountOfBlsPartsToCollect = 0 + optsSignOperation.nThreshold;
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsSignOperation.details.write( optsSignOperation.strLogPrefix +
            cc.debug( "Will BLS-collect " ) +
            cc.info( optsSignOperation.nCountOfBlsPartsToCollect ) +
            cc.debug( " from " ) + cc.info( optsSignOperation.jarrNodes.length ) +
            cc.debug( " nodes" ) + cc.debug( ", " ) + cc.notice( "sequence ID" ) +
            cc.debug( " is " ) + cc.attention( optsSignOperation.sequenceId ) + "\n" );
    }
    return true;
}

async function gatherSigningStartImpl( optsSignOperation ) {
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsSignOperation.details.write( optsSignOperation.strLogPrefix +
            cc.debug( "Waiting for BLS glue result " ) + "\n" );
    }
    optsSignOperation.errGathering = null;
    optsSignOperation.promiseCompleteGathering = new Promise( ( resolve, reject ) => {
        const iv = setInterval( function() {
            const cntSuccess = optsSignOperation.arrSignResults.length;
            if( optsSignOperation.joGatheringTracker.nCountReceivedPrevious !=
                optsSignOperation.joGatheringTracker.nCountReceived ) {
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsSignOperation.details.write(
                        cc.bright( optsSignOperation.strDirection ) + cc.debug( "/" ) +
                        cc.attention( "#" ) + cc.sunny( optsSignOperation.nTransferLoopCounter ) +
                        cc.debug( " BLS signature gathering progress updated, now have " ) +
                        cc.info( optsSignOperation.joGatheringTracker.nCountReceived ) +
                        cc.debug( " BLS parts of needed " ) +
                        cc.info( optsSignOperation.nCountOfBlsPartsToCollect ) +
                        cc.debug( " arrived, have " ) + cc.info( cntSuccess ) +
                        cc.debug( " success(es) and " ) +
                        cc.info( optsSignOperation.joGatheringTracker.nCountErrors ) +
                        cc.debug( " error(s)" ) + "\n" );
                }
                optsSignOperation.joGatheringTracker.nCountReceivedPrevious =
                    0 + optsSignOperation.joGatheringTracker.nCountReceived;
            }
            ++ optsSignOperation.joGatheringTracker.nWaitIntervalStepsDone;
            if( cntSuccess >= optsSignOperation.nCountOfBlsPartsToCollect ) {
                optsSignOperation.strLogPrefixB =
                    cc.bright( optsSignOperation.strDirection ) + cc.debug( "/" ) +
                    cc.attention( "#" ) + cc.sunny( optsSignOperation.nTransferLoopCounter ) +
                    cc.debug( "/" ) + cc.info( "BLS" ) +
                    cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
                clearInterval( iv );
                let strError = null, strSuccessfulResultDescription = null;
                const joGlueResult = performBlsGlue( optsSignOperation.details,
                    optsSignOperation.strDirection, optsSignOperation.jarrMessages,
                    optsSignOperation.nIdxCurrentMsgBlockStart, optsSignOperation.strFromChainName,
                    optsSignOperation.arrSignResults );
                if( joGlueResult ) {
                    if( log.verboseGet() >= log.verboseReversed().debug ) {
                        optsSignOperation.details.write( optsSignOperation.strLogPrefixB +
                            cc.success( "Got BLS glue result: " ) + cc.j( joGlueResult ) + "\n" );
                    }
                    if( optsSignOperation.imaState.strPathBlsVerify.length > 0 ) {
                        const joCommonPublicKey = discoverCommonPublicKey(
                            optsSignOperation.imaState.joSChainNetworkInfo, false );
                        if( ! joCommonPublicKey ) {
                            strError = "No BLS common public key";
                            if( log.verboseGet() >= log.verboseReversed().error ) {
                                optsSignOperation.details.write( optsSignOperation.strLogPrefixB +
                                    cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) + "\n" );
                            }
                        } else if( performBlsVerify(
                            optsSignOperation.details, optsSignOperation.strDirection,
                            joGlueResult, optsSignOperation.jarrMessages,
                            optsSignOperation.nIdxCurrentMsgBlockStart,
                            optsSignOperation.strFromChainName,
                            joCommonPublicKey
                        ) ) {
                            strSuccessfulResultDescription =
                                "Got successful summary BLS verification result";
                            if( log.verboseGet() >= log.verboseReversed().debug ) {
                                optsSignOperation.details.write( optsSignOperation.strLogPrefixB +
                                    cc.success( strSuccessfulResultDescription ) + "\n" );
                            }
                        } else {
                            strError = "BLS verification failed";
                            if( log.verboseGet() >= log.verboseReversed().error ) {
                                optsSignOperation.details.write( optsSignOperation.strLogPrefixB +
                                    cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) + "\n" );
                            }
                        }
                    }
                } else {
                    strError = "BLS glue failed, no glue result arrived";
                    const strErrorMessage = optsSignOperation.strLogPrefixB +
                        cc.error( "Problem(1) in BLS sign result handler: " ) +
                        cc.warning( strError ) +
                        "\n";
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        optsSignOperation.details.write( strErrorMessage );
                        if( log.id != optsSignOperation.details.id )
                            log.write( strErrorMessage );
                    }
                }
                const strCallbackCallDescription =
                    cc.debug( "Will call signed-hash answer-sending callback " ) +
                    ( strError ? ( cc.debug( " with error " ) + cc.j( strError ) ) : "" ) +
                    cc.debug( ", optsSignOperation.jarrMessages is " ) +
                    cc.j( optsSignOperation.jarrMessages ) +
                    cc.debug( ", glue result is " ) + cc.j( joGlueResult ) + "\n";
                if( log.verboseGet() >= log.verboseReversed().trace )
                    optsSignOperation.details.write( strCallbackCallDescription );
                optsSignOperation.fn(
                    strError, optsSignOperation.jarrMessages, joGlueResult )
                    .catch( ( err ) => {
                        if( log.verboseGet() >= log.verboseReversed().critical ) {
                            const strErrorMessage =
                                cc.error( "Problem(2) in BLS sign result handler: " ) +
                                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                                "\n";
                            if( log.id != optsSignOperation.details.id )
                                log.write( strErrorMessage );
                            optsSignOperation.details.write( strErrorMessage );
                        }
                        optsSignOperation.errGathering =
                            "Problem(2) in BLS sign result handler: " +
                            owaspUtils.extractErrorMessage( err );
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
                optsSignOperation.fn(
                    "signature error(2), got " +
                    optsSignOperation.joGatheringTracker.nCountErrors +
                    " errors(s) for " + optsSignOperation.jarrNodes.length +
                    " node(s)", optsSignOperation.jarrMessages,
                    null
                ).catch( ( err ) => {
                    const cntSuccess = optsSignOperation.arrSignResults.length;
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        const strErrorMessage =
                            cc.error( "Problem(3) in BLS sign result handler, " +
                                "not enough successful BLS signature parts(" ) +
                            cc.info( cntSuccess ) + cc.error( " when all attempts done, " +
                                "error optsSignOperation.details: " ) +
                            cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n";
                        optsSignOperation.details.write( strErrorMessage );
                        if( log.id != optsSignOperation.details.id )
                            log.write( strErrorMessage );
                    }
                    optsSignOperation.errGathering =
                        "Problem(3) in BLS sign result handler," +
                            " not enough successful BLS signature parts(" +
                        cntSuccess +
                        " when all attempts done, error optsSignOperation.details: " +
                        owaspUtils.extractErrorMessage( err );
                    reject( new Error( optsSignOperation.errGathering ) );
                } );
                optsSignOperation.bHaveResultReportCalled = true;
                return;
            }
            if( optsSignOperation.joGatheringTracker.nWaitIntervalStepsDone >=
                    optsSignOperation.joGatheringTracker.nWaitIntervalMaxSteps
            ) {
                clearInterval( iv );
                optsSignOperation.fn(
                    "signature error(3), got " +
                        optsSignOperation.joGatheringTracker.nCountErrors +
                        " errors(s) for " + optsSignOperation.jarrNodes.length + " node(s)",
                    optsSignOperation.jarrMessages,
                    null
                ).catch( ( err ) => {
                    const cntSuccess = optsSignOperation.arrSignResults.length;
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        const strErrorMessage =
                            cc.error(
                                "Problem(4) in BLS sign result handler, " +
                                "not enough successful BLS signature parts(" ) +
                            cc.info( cntSuccess ) + cc.error( ") and timeout reached, " +
                                "error optsSignOperation.details: " ) +
                            cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                            "\n";
                        optsSignOperation.details.write( strErrorMessage );
                        if( log.id != optsSignOperation.details.id )
                            log.write( strErrorMessage );
                    }
                    optsSignOperation.errGathering =
                        "Problem(4) in BLS sign result handler, " +
                        "not enough successful BLS signature parts(" + cntSuccess +
                        ") and timeout reached, error optsSignOperation.details: " +
                        owaspUtils.extractErrorMessage( err );
                    reject( new Error( optsSignOperation.errGathering ) );
                } );
                optsSignOperation.bHaveResultReportCalled = true;
                return;
            }
        }, optsSignOperation.joGatheringTracker.nWaitIntervalStepMilliseconds );
    } );
}

async function gatherSigningFinishImpl( optsSignOperation ) {
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsSignOperation.details.write( optsSignOperation.strLogPrefix +
            cc.debug( "Will await for message BLS verification and sending..." ) + "\n" );
    }
    await withTimeout(
        "BLS verification and sending",
        optsSignOperation.promiseCompleteGathering,
        gSecondsMessageVerifySendTimeout )
        .then( strSuccessfulResultDescription => {
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                optsSignOperation.details.write(
                    cc.success( "BLS verification and sending promise awaited." ) + "\n" );
            }
        } ).catch( err => {
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                const strErrorMessage =
                    cc.error( "Failed to verify BLS and send message : " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    "\n";
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    if( log.id != optsSignOperation.details.id )
                        log.write( strErrorMessage );
                    optsSignOperation.details.write( strErrorMessage );
                }
            }
        } );
    if( optsSignOperation.errGathering ) {
        const strErrorMessage =
            cc.error( "Failed BLS sign result awaiting(1): " ) +
            cc.warning( optsSignOperation.errGathering.toString() ) +
            "\n";
        if( log.verboseGet() >= log.verboseReversed().error ) {
            if( log.id != optsSignOperation.details.id )
                log.write( strErrorMessage );
            optsSignOperation.details.write( strErrorMessage );
        }
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
                const cntSuccess = optsSignOperation.arrSignResults.length;
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strErrorMessage =
                        cc.error( "Problem(5) in BLS sign result handler, " +
                        "not enough successful BLS signature parts(" ) + cc.info( cntSuccess ) +
                        cc.error( ") and timeout reached, error optsSignOperation.details: " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n";
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        if( log.id != optsSignOperation.details.id )
                            log.write( strErrorMessage );
                        optsSignOperation.details.write( strErrorMessage );
                    }
                }
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
        if( log.verboseGet() >= log.verboseReversed().error ) {
            if( log.id != optsSignOperation.details.id )
                log.write( strErrorMessage );
            optsSignOperation.details.write( strErrorMessage );
        }
        optsSignOperation.bHaveResultReportCalled = true;
        await optsSignOperation.fn(
            "Failed to gather BLS signatures in " + optsSignOperation.jarrNodes.length +
            " node(s), tracker data is: " +
            JSON.stringify( optsSignOperation.joGatheringTracker ),
            optsSignOperation.jarrMessages, null
        ).catch( ( err ) => {
            const cntSuccess = optsSignOperation.arrSignResults.length;
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                const strErrorMessage =
                    cc.error( "Problem(6) in BLS sign result handler, " +
                    "not enough successful BLS signature parts(" ) + cc.info( cntSuccess ) +
                    cc.error( ") and timeout reached, error optsSignOperation.details: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n";
                if( log.id != optsSignOperation.details.id )
                    log.write( strErrorMessage );
                optsSignOperation.details.write( strErrorMessage );
            }
            optsSignOperation.details.exposeDetailsTo(
                log, optsSignOperation.strGatheredDetailsName, false );
            optsSignOperation.details.close();
            optsSignOperation.details = null;
        } );
    }
}

async function doSignConfigureChainAccessParams( optsSignOperation ) {
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
        optsSignOperation.targetChainID = optsSignOperation.imaState.chainProperties.sc.chainId;
        optsSignOperation.fromChainID = optsSignOperation.imaState.chainProperties.mn.chainId;
    } else if( optsSignOperation.strDirection == "S2M" ) {
        optsSignOperation.targetChainName = "" +
            ( optsSignOperation.imaState.chainProperties.mn.strChainName
                ? optsSignOperation.imaState.chainProperties.mn.strChainName
                : "" );
        optsSignOperation.fromChainName = "" +
            ( optsSignOperation.imaState.chainProperties.sc.strChainName
                ? optsSignOperation.imaState.chainProperties.sc.strChainName
                : "" );
        optsSignOperation.targetChainID = optsSignOperation.imaState.chainProperties.mn.chainId;
        optsSignOperation.fromChainID = optsSignOperation.imaState.chainProperties.sc.chainId;
    } else if( optsSignOperation.strDirection == "S2S" ) {
        optsSignOperation.targetChainName =
            "" + optsSignOperation.joExtraSignOpts.chainNameDst;
        optsSignOperation.fromChainName = "" + optsSignOperation.joExtraSignOpts.chainNameSrc;
        optsSignOperation.targetChainID = optsSignOperation.joExtraSignOpts.chainIdDst;
        optsSignOperation.fromChainID = optsSignOperation.joExtraSignOpts.chainIdSrc;
    } else {
        await joCall.disconnect();
        throw new Error(
            "CRITICAL ERROR: " +
            "Failed doSignMessagesImpl() with unknown direction \"" +
            optsSignOperation.strDirection + "\""
        );
    }
}

async function doSignProcessHandleCall(
    optsSignOperation,
    joNode, joParams,
    joIn, joOut, err, strNodeURL, i
) {
    ++optsSignOperation.joGatheringTracker.nCountReceived;
    if( err ) {
        ++optsSignOperation.joGatheringTracker.nCountErrors;
        const strErrorMessage =
            optsSignOperation.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
            cc.error( " JSON RPC call(doSignProcessHandleCall) to S-Chain node " ) +
            strNodeDescColorized + cc.error( "(node #" ) + cc.info( i ) + cc.error( " via " ) +
            cc.notice( strNodeURL ) + cc.error( ") failed, RPC call reported error: " ) +
            cc.warning( owaspUtils.extractErrorMessage( err ) ) + cc.error( ", " ) +
            cc.notice( "sequence ID" ) + cc.error( " is " ) +
            cc.attention( optsSignOperation.sequenceId ) + "\n";
        if( log.verboseGet() >= log.verboseReversed().error ) {
            if( log.id != optsSignOperation.details.id )
                log.write( strErrorMessage );
            optsSignOperation.details.write( strErrorMessage );
        }
        await joCall.disconnect();
        return;
    }
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsSignOperation.details.write( optsSignOperation.strLogPrefix +
            log.generateTimestampString( null, true ) + " " +
            cc.debug( "Got answer from " ) + cc.info( "skale_imaVerifyAndSign" ) +
            cc.error( "(node #" ) + cc.info( i ) + cc.error( " via " ) + cc.notice( strNodeURL ) +
            cc.debug( ") for transfer from chain " ) + cc.info( optsSignOperation.fromChainName ) +
            cc.debug( " to chain " ) + cc.info( optsSignOperation.targetChainName ) +
            cc.debug( " with params " ) + cc.j( joParams ) + cc.debug( ", answer is " ) +
            cc.j( joOut ) + cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) +
            cc.attention( optsSignOperation.sequenceId ) + "\n" );
    }
    if( ( !joOut ) || typeof joOut != "object" || ( !( "result" in joOut ) ) || ( !joOut.result ) ||
        typeof joOut.result != "object" ) {
        ++optsSignOperation.joGatheringTracker.nCountErrors;
        const strErrorMessage = optsSignOperation.strLogPrefix +
            cc.fatal( "Wallet CRITICAL ERROR:" ) + " " +
            cc.error( "S-Chain node " ) + strNodeDescColorized +
            cc.error( " reported wallet error: " ) +
            cc.warning(
                owaspUtils.extractErrorMessage( joOut, "unknown wallet error(1)" )
            ) +
            cc.error( ", " ) + cc.notice( "sequence ID" ) +
            cc.error( " is " ) + cc.attention( optsSignOperation.sequenceId ) +
            "\n";
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            if( log.id != optsSignOperation.details.id )
                log.write( strErrorMessage );
            optsSignOperation.details.write( strErrorMessage );
        }
        await joCall.disconnect();
        return;
    }
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsSignOperation.details.write( optsSignOperation.strLogPrefix + cc.debug( "Node " ) +
            cc.info( joNode.nodeID ) + cc.debug( " sign result: " ) +
            cc.j( joOut.result ? joOut.result : null ) + "\n" );
    }
    try {
        if( joOut.result.signResult.signatureShare.length > 0 &&
            joOut.result.signResult.status === 0
        ) {
            const nZeroBasedNodeIndex = joNode.imaInfo.thisNodeIndex - 1;
            // partial BLS verification for one participant
            let bNodeSignatureOKay = false; // initially assume signature is wrong
            optsSignOperation.strLogPrefixA =
                cc.bright( optsSignOperation.strDirection ) + cc.debug( "/" ) +
                cc.info( "BLS" ) + cc.debug( "/" ) +
                cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) +
                cc.debug( ":" ) + " ";
            try {
                const cntSuccess = optsSignOperation.arrSignResults.length;
                if( cntSuccess > optsSignOperation.nCountOfBlsPartsToCollect ) {
                    ++optsSignOperation.joGatheringTracker.nCountSkipped;
                    if( log.verboseGet() >= log.verboseReversed().notice ) {
                        optsSignOperation.details.write(
                            optsSignOperation.strLogPrefixA +
                            cc.debug( "Will ignore sign result for node " ) +
                            cc.info( nZeroBasedNodeIndex ) + cc.debug( " because " ) +
                            cc.info( optsSignOperation.nThreshold ) + cc.debug( "/" ) +
                            cc.info( optsSignOperation.nCountOfBlsPartsToCollect ) +
                            cc.debug( " threshold number of BLS signature " +
                                "parts already gathered" ) + "\n" );
                    }
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
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    optsSignOperation.details.write( optsSignOperation.strLogPrefixA +
                        cc.info( "Will verify sign result for node " ) +
                        cc.info( nZeroBasedNodeIndex ) + "\n" );
                }
                const joPublicKey =
                    discoverPublicKeyByIndex( nZeroBasedNodeIndex,
                        optsSignOperation.imaState.joSChainNetworkInfo, optsSignOperation.details,
                        true );
                if( performBlsVerifyI(
                    optsSignOperation.details, optsSignOperation.strDirection,
                    nZeroBasedNodeIndex, joResultFromNode,
                    optsSignOperation.jarrMessages,
                    optsSignOperation.nIdxCurrentMsgBlockStart,
                    optsSignOperation.strFromChainName,
                    joPublicKey
                ) ) {
                    if( log.verboseGet() >= log.verboseReversed().notice ) {
                        optsSignOperation.details.write( optsSignOperation.strLogPrefixA +
                            cc.success( "Got successful BLS verification result for node " ) +
                            cc.info( joNode.nodeID ) + cc.success( " with index " ) +
                            cc.info( nZeroBasedNodeIndex ) + "\n" );
                    }
                    bNodeSignatureOKay = true; // node verification passed
                } else {
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        optsSignOperation.details.write( optsSignOperation.strLogPrefixA +
                            cc.fatal( "CRITICAL ERROR:" ) + " " +
                            cc.error( "BLS verification failed" ) + "\n" );
                    }
                }
            } catch ( err ) {
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strErrorMessage =
                        optsSignOperation.strLogPrefixA + cc.error( "S-Chain node " ) +
                        strNodeDescColorized + cc.error( " sign " ) +
                        cc.error( " CRITICAL ERROR:" ) +
                        cc.error( " partial signature fail from with index " ) +
                        cc.info( nZeroBasedNodeIndex ) +
                        cc.error( ", error is " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                        cc.error( ", " ) + cc.notice( "sequence ID" ) +
                        cc.error( " is " ) + cc.attention( optsSignOperation.sequenceId ) +
                        cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
                        "\n";
                    if( log.id != optsSignOperation.details.id )
                        log.write( strErrorMessage );
                    optsSignOperation.details.write( strErrorMessage );
                }
            }
            if( bNodeSignatureOKay ) {
                optsSignOperation.arrSignResults.push( {
                    index: "" + nZeroBasedNodeIndex,
                    signature:
                        splitSignatureShare(
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
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strErrorMessage =
                optsSignOperation.strLogPrefix + cc.error( "S-Chain node " ) +
                strNodeDescColorized + " " + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " signature fail from node " ) + cc.info( joNode.nodeID ) +
                cc.error( ", error is " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", " ) + cc.notice( "sequence ID" ) +
                cc.error( " is " ) + cc.attention( optsSignOperation.sequenceId ) +
                cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
                "\n";
            if( log.id != optsSignOperation.details.id )
                log.write( strErrorMessage );
            optsSignOperation.details.write( strErrorMessage );
        }
    }
    await joCall.disconnect();
}

async function doSignProcessOneImpl( i, optsSignOperation ) {
    const imaState = state.get();
    const isThisNode = ( i == imaState.nNodeNumber ) ? true : false;
    const joNode = optsSignOperation.jarrNodes[i];
    const strNodeURL = optsSignOperation.imaState.isCrossImaBlsMode
        ? imaUtils.composeImaAgentNodeUrl( joNode, isThisNode )
        : imaUtils.composeSChainNodeUrl( joNode );
    const strNodeDescColorized = cc.u( strNodeURL ) + " " +
        cc.debug( "(" ) + cc.bright( i ) + cc.debug( "/" ) +
        cc.bright( optsSignOperation.jarrNodes.length ) +
        cc.debug( ", ID " ) + cc.info( joNode.nodeID ) + cc.debug( ")" ) +
        cc.debug( ", " ) + cc.notice( "sequence ID" ) + cc.debug( " is " ) +
        cc.attention( optsSignOperation.sequenceId );
    const rpcCallOpts = null;
    rpcCall.create(
        strNodeURL, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                ++optsSignOperation.joGatheringTracker.nCountReceived;
                ++optsSignOperation.joGatheringTracker.nCountErrors;
                const strErrorMessage =
                optsSignOperation.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " JSON RPC call(doSignProcessOneImpl) to S-Chain node " ) +
                strNodeDescColorized +
                cc.error( " failed, RPC call was not created, error is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", " ) + cc.notice( "sequence ID" ) +
                cc.error( " is " ) + cc.attention( optsSignOperation.sequenceId ) +
                "\n";
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    if( log.id != optsSignOperation.details.id )
                        log.write( strErrorMessage );
                    optsSignOperation.details.write( strErrorMessage );
                }
                if( joCall )
                    await joCall.disconnect();
                return;
            }
            await doSignConfigureChainAccessParams( optsSignOperation );
            const joParams = {
                "direction": "" + optsSignOperation.strDirection,
                "startMessageIdx": optsSignOperation.nIdxCurrentMsgBlockStart,
                "dstChainName": optsSignOperation.targetChainName,
                "srcChainName": optsSignOperation.fromChainName,
                "dstChainID": optsSignOperation.targetChainID,
                "srcChainID": optsSignOperation.fromChainID,
                "messages": optsSignOperation.jarrMessages,
                "qa": {
                    "skaledNumber": 0 + i,
                    "optsSignOperation.sequenceId": "" + optsSignOperation.sequenceId,
                    "ts": "" + log.generateTimestampString( null, false )
                }
            };
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                optsSignOperation.details.write( optsSignOperation.strLogPrefix +
                    log.generateTimestampString( null, true ) + " " + cc.debug( "Will invoke " ) +
                    cc.info( "skale_imaVerifyAndSign" ) + cc.debug( " to node #" ) + cc.info( i ) +
                    cc.debug( " via " ) + cc.notice( strNodeURL ) +
                    cc.debug( " for transfer from chain " ) +
                    cc.info( optsSignOperation.fromChainName ) + cc.debug( " to chain " ) +
                    cc.info( optsSignOperation.targetChainName ) + cc.debug( " with params " ) +
                    cc.j( joParams ) + cc.debug( ", " ) + cc.notice( "sequence ID" ) +
                    cc.debug( " is " ) + cc.attention( optsSignOperation.sequenceId ) + "\n" );
            }
            await joCall.call( {
                "method": "skale_imaVerifyAndSign",
                "params": joParams
            }, async function( joIn, joOut, err ) {
                await doSignProcessHandleCall(
                    optsSignOperation, joNode, joParams, joIn, joOut, err, strNodeURL, i
                );
            } ); // joCall.call ...
        } ); // rpcCall.create ...
}

async function doSignMessagesImpl(
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
        details: log,
        strGatheredDetailsName: "",
        sequenceId: "",
        jarrNodes: [],
        nThreshold: 1,
        nParticipants: 1,
        nCountOfBlsPartsToCollect: 1,
        errGathering: null,
        promiseCompleteGathering: null,
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
        nCountReceivedPrevious: 0,
        nCountReceived: 0,
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
        "doSignMessagesImpl-#" + optsSignOperation.nTransferLoopCounter +
        "-" + optsSignOperation.strFromChainName + "-msg#" +
        optsSignOperation.nIdxCurrentMsgBlockStart;
    try {
        if( ! ( await prepareSignMessagesImpl( optsSignOperation ) ) )
            return;
        for( let i = 0; i < optsSignOperation.jarrNodes.length; ++i ) {
            const cntSuccess = optsSignOperation.arrSignResults.length;
            if( cntSuccess >= optsSignOperation.nCountOfBlsPartsToCollect ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    optsSignOperation.details.write( optsSignOperation.strLogPrefix +
                        log.generateTimestampString( null, true ) + " " +
                        cc.debug( "Stop invoking " ) + cc.info( "skale_imaVerifyAndSign" ) +
                        cc.debug( " for transfer from chain " ) + cc.info( fromChainName ) +
                        cc.debug( " at #" ) + cc.info( i ) +
                        cc.debug( " because successfully gathered count is reached " ) +
                        cc.j( cntSuccess ) + "\n" );
                }
                break;
            }
            doSignProcessOneImpl( i, optsSignOperation );
        }
        await gatherSigningStartImpl( optsSignOperation );
        await gatherSigningFinishImpl( optsSignOperation );
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strErrorMessage =
                cc.error( "Failed BLS sign due to generic flow exception: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( ( !optsSignOperation.details ) || log.id != optsSignOperation.details.id )
                log.write( strErrorMessage );
            if( optsSignOperation.details )
                optsSignOperation.details.write( strErrorMessage );
        }
        if( ! optsSignOperation.bHaveResultReportCalled ) {
            optsSignOperation.bHaveResultReportCalled = true;
            await optsSignOperation.fn(
                "Failed BLS sign due to exception: " +
                owaspUtils.extractErrorMessage( err ),
                optsSignOperation.jarrMessages,
                null
            ).catch( ( err ) => {
                let strErrorMessage = null;
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    strErrorMessage =
                        cc.error( "Failed BLS sign due to " +
                            "error-reporting callback exception: " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                        "\n";
                    log.write( strErrorMessage );
                }
                if( optsSignOperation.details ) {
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        if( strErrorMessage )
                            optsSignOperation.details.write( strErrorMessage );
                    }
                    optsSignOperation.details.exposeDetailsTo(
                        log, optsSignOperation.strGatheredDetailsName, false );
                    optsSignOperation.details.close();
                }
            } );
        }
    }
    if( log.verboseGet() >= log.verboseReversed().information ) {
        const strFinalMessage = cc.info( optsSignOperation.strGatheredDetailsName ) +
            cc.success( " completed" ) + "\n";
        optsSignOperation.details.write( strFinalMessage );
    }
    if( optsSignOperation.details ) {
        optsSignOperation.details.exposeDetailsTo(
            log, optsSignOperation.strGatheredDetailsName, true );
        optsSignOperation.details.close();
    }
}

export async function doSignMessagesM2S(
    nTransferLoopCounter,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    joExtraSignOpts,
    fn
) {
    return await doSignMessagesImpl(
        nTransferLoopCounter,
        "M2S",
        jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
        joExtraSignOpts,
        fn
    );
}

export async function doSignMessagesS2M(
    nTransferLoopCounter,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    joExtraSignOpts,
    fn
) {
    return await doSignMessagesImpl(
        nTransferLoopCounter,
        "S2M",
        jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
        joExtraSignOpts,
        fn
    );
}

export async function doSignMessagesS2S(
    nTransferLoopCounter,
    jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
    joExtraSignOpts,
    fn
) {
    return await doSignMessagesImpl(
        nTransferLoopCounter,
        "S2S",
        jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
        joExtraSignOpts,
        fn
    );
}

async function prepareSignU256( optsSignU256 ) {
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsSignU256.details.write( optsSignU256.strLogPrefix + cc.debug( "Will sign " ) +
            cc.info( optsSignU256.u256 ) + cc.debug( " value..." ) + "\n" );
    }
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsSignU256.details.write( optsSignU256.strLogPrefix + cc.debug( "Will query to sign " ) +
            cc.info( optsSignU256.jarrNodes.length ) + cc.debug( " skaled node(s)..." ) + "\n" );
    }
    optsSignU256.nThreshold =
        discoverBlsThreshold( optsSignU256.imaState.joSChainNetworkInfo );
    optsSignU256.nParticipants =
        discoverBlsParticipants( optsSignU256.imaState.joSChainNetworkInfo );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsSignU256.details.write( optsSignU256.strLogPrefix +
            cc.debug( "Discovered BLS threshold is " ) + cc.info( optsSignU256.nThreshold ) +
            cc.debug( "." ) + "\n" );
        optsSignU256.details.write( optsSignU256.strLogPrefix +
            cc.debug( "Discovered number of BLS participants is " ) +
            cc.info( optsSignU256.nParticipants ) + cc.debug( "." ) + "\n" );
    }
    if( ! checkBlsThresholdAndBlsParticipants(
        optsSignU256.nThreshold,
        optsSignU256.nParticipants,
        "prepare sign-U256",
        optsSignU256.details ) ) {
        await optsSignU256.fn(
            "signature error(1, u256), S-Chain information " +
            "was not discovered properly and BLS threshold/participants are unknown",
            optsSignU256.u256,
            null
        );
        return false;
    }
    optsSignU256.nCountOfBlsPartsToCollect = 0 + optsSignU256.nThreshold;
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsSignU256.details.write( optsSignU256.strLogPrefix +
            cc.debug( "Will(optsSignU256.u256) collect " ) +
            cc.info( optsSignU256.nCountOfBlsPartsToCollect ) +
            cc.debug( " from " ) + cc.info( optsSignU256.jarrNodes.length ) +
            cc.debug( " nodes" ) + "\n" );
    }
    return true;
}

async function doSignU256OneImpl( i, optsSignU256 ) {
    const imaState = state.get();
    const isThisNode = ( i == imaState.nNodeNumber ) ? true : false;
    const joNode = optsSignU256.jarrNodes[i];
    const strNodeURL = optsSignU256.imaState.isCrossImaBlsMode
        ? imaUtils.composeImaAgentNodeUrl( joNode, isThisNode )
        : imaUtils.composeSChainNodeUrl( joNode );
    const strNodeDescColorized = cc.u( strNodeURL ) + " " + cc.debug( "(" ) + cc.bright( i ) +
        cc.debug( "/" ) + cc.bright( optsSignU256.jarrNodes.length ) +
        cc.debug( ", ID " ) + cc.info( joNode.nodeID ) + cc.debug( ")" );
    const rpcCallOpts = null;
    await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
        ++optsSignU256.joGatheringTracker.nCountReceived;
        if( err ) {
            ++optsSignU256.joGatheringTracker.nCountErrors;
            const strErrorMessage =
                optsSignU256.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " JSON RPC call(doSignU256OneImpl) to S-Chain node " ) +
                strNodeDescColorized +
                cc.error( " failed, RPC call was not created, error is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                "\n";
            if( log.verboseGet() >= log.verboseReversed().error ) {
                if( log.id != optsSignU256.details.id )
                    log.write( strErrorMessage );
                optsSignU256.details.write( strErrorMessage );
            }
            if( joCall )
                await joCall.disconnect();
            return;
        }
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            optsSignU256.details.write( optsSignU256.strLogPrefix + cc.debug( "Will invoke " ) +
                cc.info( "skale_imaBSU256" ) + cc.debug( " for to sign value " ) +
                cc.info( optsSignU256.u256.toString() ) + "\n" );
        }
        await joCall.call( {
            "method": "skale_imaBSU256",
            "params": {
                "valueToSign": optsSignU256.u256 // must be 0x string, came from outside 0x string
            }
        }, async function( joIn, joOut, err ) {
            ++optsSignU256.joGatheringTracker.nCountReceived;
            if( err ) {
                ++optsSignU256.joGatheringTracker.nCountErrors;
                const strErrorMessage =
                    optsSignU256.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call(doSignU256OneImpl) to S-Chain node " ) +
                    strNodeDescColorized + cc.error( " failed, RPC call reported error: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    "\n";
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    if( log.id != optsSignU256.details.id )
                        log.write( strErrorMessage );
                    optsSignU256.details.write( strErrorMessage );
                }
                await joCall.disconnect();
                return;
            }
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                optsSignU256.details.write( optsSignU256.strLogPrefix + cc.debug( "Did invoked " ) +
                    cc.info( "skale_imaBSU256" ) + cc.debug( " for to sign value " ) +
                    cc.info( optsSignU256.u256.toString() ) + cc.debug( ", answer is: " ) +
                    cc.j( joOut ) + "\n" );
            }
            if( ( !joOut ) || typeof joOut != "object" || ( !( "result" in joOut ) ) ||
                ( !joOut.result ) || typeof joOut.result != "object" ||
                ( !( "signature" in joOut.result ) ) || joOut.result.signature != "object"
            ) {
                ++optsSignU256.joGatheringTracker.nCountErrors;
                const strErrorMessage =
                    optsSignU256.strLogPrefix + cc.fatal( "Wallet CRITICAL ERROR:" ) + " " +
                    cc.error( "S-Chain node " ) + strNodeDescColorized +
                    cc.error( " reported wallet error: " ) + cc.warning(
                        owaspUtils.extractErrorMessage( joOut, "unknown wallet error(2)" ) ) + "\n";
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    if( log.id != optsSignU256.details.id )
                        log.write( strErrorMessage );
                    optsSignU256.details.write( strErrorMessage );
                }
                await joCall.disconnect();
                return;
            }
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                optsSignU256.details.write( optsSignU256.strLogPrefix + cc.debug( "Node " ) +
                    cc.info( joNode.nodeID ) + cc.debug( " sign result: " ) +
                    cc.j( joOut.result ? joOut.result : null ) + "\n" );
            }
            try {
                if( joOut.result.signResult.signatureShare.length > 0 &&
                    joOut.result.signResult.status === 0
                ) {
                    const nZeroBasedNodeIndex = joNode.imaInfo.thisNodeIndex - 1;
                    // partial BLS verification for one participant
                    let bNodeSignatureOKay = false; // initially assume signature is wrong
                    const strLogPrefixA = cc.info( "BLS" ) + cc.debug( "/" ) + cc.notice( "#" ) +
                        cc.bright( nZeroBasedNodeIndex ) + cc.debug( ":" ) + " ";
                    try {
                        const cntSuccess = optsSignU256.arrSignResults.length;
                        if( cntSuccess > optsSignU256.nCountOfBlsPartsToCollect ) {
                            ++optsSignU256.joGatheringTracker.nCountSkipped;
                            if( log.verboseGet() >= log.verboseReversed().notice ) {
                                optsSignU256.details.write( strLogPrefixA +
                                    cc.debug( "Will ignore sign result for node " ) +
                                    cc.info( nZeroBasedNodeIndex ) + cc.debug( " because " ) +
                                    cc.info( optsSignU256.nThreshold ) + cc.debug( "/" ) +
                                    cc.info( optsSignU256.nCountOfBlsPartsToCollect ) +
                                    cc.debug( " threshold number of BLS signature " +
                                        "parts already gathered" ) + "\n" );
                            }
                            return;
                        }
                        const arrTmp = joOut.result.signResult.signatureShare.split( ":" );
                        const joResultFromNode = {
                            index: "" + nZeroBasedNodeIndex,
                            signature: { X: arrTmp[0], Y: arrTmp[1] }
                        };
                        if( log.verboseGet() >= log.verboseReversed().trace ) {
                            optsSignU256.details.write( strLogPrefixA +
                                cc.info( "Will verify sign result for node " ) +
                                cc.info( nZeroBasedNodeIndex ) + "\n" );
                        }
                        const joPublicKey = discoverPublicKeyByIndex( nZeroBasedNodeIndex,
                            optsSignU256.imaState.joSChainNetworkInfo, optsSignU256.details,
                            true );
                        if( performBlsVerifyIU256(
                            optsSignU256.details, nZeroBasedNodeIndex, joResultFromNode,
                            optsSignU256.u256, joPublicKey ) ) {
                            if( log.verboseGet() >= log.verboseReversed().information ) {
                                optsSignU256.details.write( strLogPrefixA +
                                    cc.success( "Got successful BLS " +
                                        "verification result for node " ) +
                                    cc.info( joNode.nodeID ) + cc.success( " with index " ) +
                                    cc.info( nZeroBasedNodeIndex ) + "\n" );
                            }
                            bNodeSignatureOKay = true; // node verification passed
                        } else {
                            const strError = "BLS u256 one node verify failed";
                            if( log.verboseGet() >= log.verboseReversed().error ) {
                                optsSignU256.details.write( strLogPrefixA +
                                    cc.fatal( "CRITICAL ERROR:" ) + " " +
                                    cc.error( strError ) + "\n" );
                            }
                        }
                    } catch ( err ) {
                        if( log.verboseGet() >= log.verboseReversed().critical ) {
                            const strErrorMessage =
                                strLogPrefixA + cc.error( "S-Chain node " ) +
                                strNodeDescColorized + cc.error( " sign " ) +
                                cc.error( " CRITICAL ERROR:" ) +
                                cc.error( " partial signature fail from with index " ) +
                                cc.info( nZeroBasedNodeIndex ) + cc.error( ", error is " ) +
                                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                                cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) + "\n";
                            if( log.verboseGet() >= log.verboseReversed().error ) {
                                if( log.id != optsSignU256.details.id )
                                    log.write( strErrorMessage );
                                optsSignU256.details.write( strErrorMessage );
                            }
                        }
                    }
                    if( bNodeSignatureOKay ) {
                        optsSignU256.arrSignResults.push( {
                            index: "" + nZeroBasedNodeIndex,
                            signature:
                                splitSignatureShare( joOut.result.signResult.signatureShare ),
                            fromNode: joNode, // extra, not needed for bls_glue
                            signResult: joOut.result.signResult
                        } );
                    } else
                        ++optsSignU256.joGatheringTracker.nCountErrors;
                }
            } catch ( err ) {
                ++optsSignU256.joGatheringTracker.nCountErrors;
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strErrorMessage =
                        optsSignU256.strLogPrefix + cc.error( "S-Chain node " ) +
                        strNodeDescColorized + " " + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " signature fail from node " ) + cc.info( joNode.nodeID ) +
                        cc.error( ", error is " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                        cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) + "\n";
                    if( log.id != optsSignU256.details.id )
                        log.write( strErrorMessage );
                    optsSignU256.details.write( strErrorMessage );
                }
            }
            await joCall.disconnect();
        } ); // joCall.call ...
    } ); // rpcCall.create ...
}

async function doSignU256Gathering( optsSignU256 ) {
    optsSignU256.details.write( optsSignU256.strLogPrefix +
        cc.debug( "Waiting for BLS glue result " ) +
        "\n" );
    optsSignU256.errGathering = null;
    optsSignU256.promiseCompleteGathering = new Promise( ( resolve, reject ) => {
        const iv = setInterval( function() {
            if( optsSignU256.joGatheringTracker.nCountReceivedPrevious !=
                optsSignU256.joGatheringTracker.nCountReceived ) {
                const cntSuccess = optsSignU256.arrSignResults.length;
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsSignU256.details.write(
                        cc.info( "BLS u256" ) +
                        cc.debug( " BLS signature gathering progress updated, now have " ) +
                        cc.info( optsSignU256.joGatheringTracker.nCountReceived ) +
                        cc.debug( " BLS parts of needed " ) +
                        cc.info( optsSignU256.nCountOfBlsPartsToCollect ) +
                        cc.debug( " arrived, have " ) + cc.info( cntSuccess ) +
                        cc.debug( " success(es) and " ) +
                        cc.info( optsSignU256.joGatheringTracker.nCountErrors ) +
                        cc.debug( " error(s)" ) + "\n" );
                }
                optsSignU256.joGatheringTracker.nCountReceivedPrevious =
                    0 + optsSignU256.joGatheringTracker.nCountReceived;
            }
            ++ optsSignU256.joGatheringTracker.nWaitIntervalStepsDone;
            const cntSuccess = optsSignU256.arrSignResults.length;
            if( cntSuccess >= optsSignU256.nCountOfBlsPartsToCollect ) {
                const strLogPrefixB = cc.info( "BLS u256" ) +
                    cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
                clearInterval( iv );
                let strError = null, strSuccessfulResultDescription = null;
                const joGlueResult =
                    performBlsGlueU256(
                        optsSignU256.details, optsSignU256.u256, optsSignU256.arrSignResults );
                if( joGlueResult ) {
                    if( log.verboseGet() >= log.verboseReversed().trace ) {
                        optsSignU256.details.write( strLogPrefixB +
                            cc.success( "Got BLS glue u256 result: " ) + cc.j( joGlueResult ) +
                            "\n" );
                    }
                    if( optsSignU256.imaState.strPathBlsVerify.length > 0 ) {
                        const joCommonPublicKey = discoverCommonPublicKey(
                            optsSignU256.imaState.joSChainNetworkInfo, false );
                        if( ! joCommonPublicKey ) {
                            strError = "No BLS common public key";
                            if( log.verboseGet() >= log.verboseReversed().error ) {
                                optsSignOperation.details.write( optsSignOperation.strLogPrefixB +
                                    cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) + "\n" );
                            }
                        } else if( performBlsVerifyU256(
                            optsSignU256.details,
                            joGlueResult,
                            optsSignU256.u256,
                            joCommonPublicKey
                        )
                        ) {
                            strSuccessfulResultDescription =
                                "Got successful summary BLS u256 verification result";
                            if( log.verboseGet() >= log.verboseReversed().trace ) {
                                optsSignU256.details.write( strLogPrefixB +
                                    cc.success( strSuccessfulResultDescription ) + "\n" );
                            }
                        } else {
                            strError = "BLS verification failed";
                            if( log.verboseGet() >= log.verboseReversed().error ) {
                                if( log.id != optsSignU256.details.id ) {
                                    log.write( strLogPrefixB + cc.fatal( "CRITICAL ERROR:" ) +
                                        cc.error( strError ) + "\n" );
                                }
                                optsSignU256.details.write( strLogPrefixB +
                                    cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) + "\n" );
                            }
                        }
                    }
                } else {
                    strError = "BLS u256 glue failed, no glue result arrived";
                    const strErrorMessage = strLogPrefixB +
                        cc.error( "Problem(1) in BLS u256 sign result handler: " ) +
                        cc.warning( strError ) +
                        "\n";
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        if( log.id != optsSignU256.details.id )
                            log.write( strErrorMessage );
                        optsSignU256.details.write( strErrorMessage );
                    }
                }
                const strCallbackCallDescription =
                    cc.debug( "Will call signed-256 answer-sending callback " ) +
                    ( strError ? ( cc.debug( " with error " ) + cc.j( strError ) ) : "" ) +
                    cc.debug( ", u256 is " ) + cc.j( optsSignU256.u256 ) +
                    cc.debug( ", glue result is " ) + cc.j( joGlueResult ) + "\n";
                if( log.verboseGet() >= log.verboseReversed().trace )
                    optsSignU256.details.write( strCallbackCallDescription );
                optsSignU256.fn(
                    strError, optsSignU256.u256, joGlueResult )
                    .catch( ( err ) => {
                        if( log.verboseGet() >= log.verboseReversed().critical ) {
                            const strErrorMessage =
                                cc.error( "Problem(2) in BLS u256 sign result handler: " ) +
                                cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n";
                            if( log.verboseGet() >= log.verboseReversed().error ) {
                                if( log.id != optsSignU256.details.id )
                                    log.write( strErrorMessage );
                                optsSignU256.details.write( strErrorMessage );
                            }
                        }
                        optsSignU256.errGathering =
                            "Problem(2) in BLS u256 sign result handler: " +
                            owaspUtils.extractErrorMessage( err );
                    } );
                if( strError ) {
                    optsSignU256.errGathering = strError;
                    reject( new Error( optsSignU256.errGathering ) );
                } else
                    resolve();
                return;
            }
            if( optsSignU256.joGatheringTracker.nCountReceived >=
                    optsSignU256.jarrNodes.length ) {
                clearInterval( iv );
                optsSignU256.fn(
                    "signature error(2, u256), got " +
                    optsSignU256.joGatheringTracker.nCountErrors +
                    " errors(s) for " + optsSignU256.jarrNodes.length + " node(s)",
                    optsSignU256.u256,
                    null
                ).catch( ( err ) => {
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        const strErrorMessage =
                            cc.error( "Problem(3) in BLS u256 sign result handler, " +
                            "not enough successful BLS signature parts(" ) + cc.info( cntSuccess ) +
                            cc.error( " when all attempts done, error optsSignU256.details: " ) +
                            cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n";
                        if( log.verboseGet() >= log.verboseReversed().error ) {
                            if( log.id != optsSignU256.details.id )
                                log.write( strErrorMessage );
                            optsSignU256.details.write( strErrorMessage );
                        }
                    }
                    optsSignU256.errGathering =
                        "Problem(3) in BLS u256 sign result handler, " +
                        "not enough successful BLS signature parts(" +
                        cntSuccess + " when all attempts done, error optsSignU256.details: " +
                        owaspUtils.extractErrorMessage( err );
                    reject( new Error( optsSignU256.errGathering ) );
                } );
                return;
            }
            if( optsSignU256.joGatheringTracker.nWaitIntervalStepsDone >=
                optsSignU256.joGatheringTracker.nWaitIntervalMaxSteps
            ) {
                clearInterval( iv );
                optsSignU256.fn(
                    "signature error(3, u256), got " +
                    optsSignU256.joGatheringTracker.nCountErrors +
                    " errors(s) for " + optsSignU256.jarrNodes.length + " node(s)",
                    optsSignU256.u256,
                    null
                ).catch( ( err ) => {
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        const strErrorMessage =
                            cc.error( "Problem(4) in BLS u256 sign result handler, " +
                            "not enough successful BLS signature parts(" ) +
                            cc.info( cntSuccess ) +
                            cc.error( ") and timeout reached, error optsSignU256.details: " ) +
                            cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n";
                        if( log.id != optsSignU256.details.id )
                            log.write( strErrorMessage );
                        optsSignU256.details.write( strErrorMessage );
                    }
                    optsSignU256.errGathering =
                        "Problem(4) in BLS u256 sign result handler, " +
                        "not enough successful BLS signature parts(" +
                        cntSuccess + ") and timeout reached, error optsSignU256.details: " +
                        owaspUtils.extractErrorMessage( err );
                    reject( new Error( optsSignU256.errGathering ) );
                } );
                return;
            }
        }, optsSignU256.joGatheringTracker.nWaitIntervalStepMilliseconds );
    } );
}

export async function doSignU256( u256, details, fn ) {
    const optsSignU256 = {
        u256: u256,
        fn: fn,
        details: details,
        imaState: state.get(),
        strLogPrefix: cc.info( "Sign u256:" ) + " ",
        joGatheringTracker: {
            nCountReceivedPrevious: 0,
            nCountReceived: 0,
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
        promiseCompleteGathering: null
    };
    optsSignU256.jarrNodes = optsSignU256.imaState.joSChainNetworkInfo.network;
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsSignU256.details.write( optsSignU256.strLogPrefix +
            cc.debug( "Invoking signing u256 procedure " ) + "\n" );
    }
    optsSignU256.fn = optsSignU256.fn || function() {};
    if( !(
        optsSignU256.imaState.strPathBlsGlue.length > 0 &&
        optsSignU256.imaState.joSChainNetworkInfo
    ) ) {
        if( log.verboseGet() >= log.verboseReversed().information ) {
            optsSignU256.details.write( optsSignU256.strLogPrefix +
                cc.debug( "BLS u256 signing is " ) + cc.error( "unavailable" ) + "\n" );
        }
        await optsSignU256.fn( "BLS u256 signing is unavailable", optsSignU256.u256, null );
        return;
    }
    if( ! ( await prepareSignU256( optsSignU256 ) ) )
        return;
    for( let i = 0; i < optsSignU256.jarrNodes.length; ++i )
        await doSignU256OneImpl( i, optsSignU256 );
    await doSignU256Gathering( optsSignU256 );
    if( log.verboseGet() >= log.verboseReversed().trace )
        optsSignU256.details.write( cc.debug( "Will await BLS u256 sign result..." ) + "\n" );
    await withTimeout(
        "BLS u256 sign",
        optsSignU256.promiseCompleteGathering,
        gSecondsMessageVerifySendTimeout
    ).then( strSuccessfulResultDescription => {
        if( log.verboseGet() >= log.verboseReversed().trace )
            optsSignU256.details.write( cc.info( "BLS u256 sign promise awaited." ) + "\n" );
    } ).catch( err => {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strErrorMessage =
                cc.error( "Failed to verify BLS and send message : " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                "\n";
            if( log.verboseGet() >= log.verboseReversed().error ) {
                if( log.id != optsSignU256.details.id )
                    log.write( strErrorMessage );
                optsSignU256.details.write( strErrorMessage );
            }
        }
    } );
    if( optsSignU256.errGathering ) {
        const strErrorMessage =
            cc.error( "Failed BLS u256 sign result awaiting: " ) +
            cc.warning( optsSignU256.errGathering.toString() ) +
            "\n";
        if( log.verboseGet() >= log.verboseReversed().error ) {
            if( log.id != optsSignU256.details.id )
                log.write( strErrorMessage );
            optsSignU256.details.write( strErrorMessage );
        }
        return;
    }
    if( log.verboseGet() >= log.verboseReversed().information ) {
        optsSignU256.details.write( optsSignU256.strLogPrefix +
            cc.debug( "Completed signing u256 procedure " ) + "\n" );
    }
}

export async function doVerifyReadyHash(
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
    const arrTmp = signature.signatureShare.split( ":" );
    const joResultFromNode = {
        index: "" + nZeroBasedNodeIndex,
        signature: {
            X: arrTmp[0],
            Y: arrTmp[1]
        }
    };
    const nThreshold = discoverBlsThreshold( imaState.joSChainNetworkInfo );
    const nParticipants = discoverBlsParticipants( imaState.joSChainNetworkInfo );
    if( ! checkBlsThresholdAndBlsParticipants(
        nThreshold, nParticipants, "verify ready hash", details ) )
        return false;
    const strActionDir = allocBlsTmpActionDir();
    const fnShellRestore = function() {
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        const joPublicKey = discoverPublicKeyByIndex(
            nZeroBasedNodeIndex, imaState.joSChainNetworkInfo, details, true );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " - hashed verify message is " ) +
                cc.info( strMessageHash ) + "\n" );
        }
        const joMsg = {
            "message": strMessageHash
        };
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " - composed  " ) + cc.j( joMsg ) +
                cc.debug( " using hash " ) + cc.j( strMessageHash ) + cc.debug( " and glue " ) +
                cc.j( joResultFromNode ) + cc.debug( " and public key " ) + cc.j( joPublicKey ) +
                "\n" );
        }
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
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Will execute node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " BLS verify command:\n" ) +
                cc.notice( strVerifyCommand ) + "\n" );
        }
        strOutput = childProcessModule.execSync( strVerifyCommand, { cwd: strActionDir } );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.debug( " verify output is:\n" ) +
                cc.notice( strOutput ) + "\n" );
        }
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.success( "BLS node " ) + cc.notice( "#" ) +
                cc.info( nZeroBasedNodeIndex ) + cc.success( " verify success" ) + "\n" );
        }
        fnShellRestore();
        isSuccess = true;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const s1 = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) +
                cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify error:" ) +
                cc.warning( " error description is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            const s2 = strLogPrefix + cc.error( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) +
                cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) +
                cc.error( " verify output is:\n" ) + cc.warning( strOutput ) + "\n";
            if( log.id != details.id ) {
                log.write( s1 );
                log.write( s2 );
            }
            details.write( s1 );
            details.write( s2 );
        }
        fnShellRestore();
        isSuccess = false;
    }
    if( isExposeOutput || ( !isSuccess ) )
        details.exposeDetailsTo( log, "BLS-raw-verifier", isSuccess );
    details.close();
    return isSuccess;
}

export async function doSignReadyHash( strMessageHash, isExposeOutput ) {
    const imaState = state.get();
    const strLogPrefix = "";
    const details = log.createMemoryStream();
    let joSignResult = null;
    try {
        const nThreshold = discoverBlsThreshold( imaState.joSChainNetworkInfo );
        const nParticipants = discoverBlsParticipants( imaState.joSChainNetworkInfo );
        if( log.verboseGet() >= log.verboseReversed().debug )
            details.write( strLogPrefix + cc.debug( "Will BLS-sign ready hash." ) + "\n" );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Discovered BLS threshold is " ) +
                cc.info( nThreshold ) + cc.debug( "." ) + "\n" );
            details.write( strLogPrefix + cc.debug( "Discovered number of BLS participants is " ) +
                cc.info( nParticipants ) + cc.debug( "." ) + "\n" );
            details.write( strLogPrefix + cc.debug( "hash value to sign is " ) +
                cc.info( strMessageHash ) + "\n" );
        }
        if( ! checkBlsThresholdAndBlsParticipants(
            nThreshold, nParticipants, "sign ready hash", details ) )
            return false;
        let joAccount = imaState.chainProperties.sc.joAccount;
        if( ! joAccount.strURL ) {
            joAccount = imaState.chainProperties.mn.joAccount;
            if( ! joAccount.strSgxURL )
                throw new Error( "SGX URL is unknown, cannot sign U256" );
            if( ! joAccount.strBlsKeyName )
                throw new Error( "BLS keys name is unknown, cannot sign U256" );
        }
        let rpcCallOpts = null;
        if( "strPathSslKey" in joAccount && typeof joAccount.strPathSslKey == "string" &&
            joAccount.strPathSslKey.length > 0 && "strPathSslCert" in joAccount &&
            typeof joAccount.strPathSslCert == "string" && joAccount.strPathSslCert.length > 0
        ) {
            rpcCallOpts = {
                "cert": fs.readFileSync( joAccount.strPathSslCert, "utf8" ),
                "key": fs.readFileSync( joAccount.strPathSslKey, "utf8" )
            };
        } else {
            if( log.verboseGet() >= log.verboseReversed().debug ) {
                details.write( cc.warning( "Will sign via SGX" ) + " " +
                    cc.error( "without SSL options" ) + "\n" );
            }
        }
        const signerIndex = imaState.nNodeNumber;
        await rpcCall.create( joAccount.strSgxURL, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                const strErrorMessage =
                    strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call(doSignReadyHash) to SGX failed, " +
                        "RPC call was not created, error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    "\n";
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    if( log.id != details.id )
                        log.write( strErrorMessage );
                    details.write( strErrorMessage );
                }
                if( joCall )
                    await joCall.disconnect();
                throw new Error(
                    "JSON RPC call to SGX failed, " +
                    "RPC call(doSignReadyHash) was not created, error is: " +
                    owaspUtils.extractErrorMessage( err )
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
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "Will invoke " ) + cc.info( "SGX" ) +
                    cc.debug( " with call data " ) + cc.j( joCallSGX ) + "\n" );
            }
            await joCall.call( joCallSGX, async function( joIn, joOut, err ) {
                if( err ) {
                    const jsErrorObject = new Error(
                        "JSON RPC call(doSignReadyHash) to SGX failed, RPC call reported error: " +
                        owaspUtils.extractErrorMessage( err )
                    );
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call(doSignReadyHash) " +
                            "to SGX failed, RPC call reported error: " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                        cc.error( ", stack is:" ) + "\n" + cc.stack( jsErrorObject.stack ) +
                        "\n";
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        if( log.id != details.id )
                            log.write( strErrorMessage );
                        details.write( strErrorMessage );
                    }
                    await joCall.disconnect();
                    throw jsErrorObject;
                }
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    details.write( strLogPrefix + cc.debug( "Call to " ) + cc.info( "SGX" ) +
                        cc.debug( " done, answer is: " ) + cc.j( joOut ) + "\n" );
                }
                joSignResult = joOut;
                if( joOut.result != null && joOut.result != undefined &&
                    typeof joOut.result == "object" )
                    joSignResult = joOut.result;
                if( joOut.signResult != null && joOut.signResult != undefined &&
                    typeof joOut.signResult == "object" )
                    joSignResult = joOut.signResult;
                if( !joSignResult ) {
                    const strError = "No signature arrived";
                    joRetVal.error = strError;
                    if( log.id != details.id ) {
                        log.write( strLogPrefix + cc.error( "BLS-sign(1) finished with error: }" ) +
                            cc.warning( strError ) + "\n" );
                    }
                    details.write( strLogPrefix + cc.error( "BLS-sign(1) finished with error: }" ) +
                        cc.warning( strError ) + "\n" );
                    await joCall.disconnect();
                    throw new Error( strError );
                }
                if( "errorMessage" in joSignResult &&
                    typeof joSignResult.errorMessage == "string" &&
                    joSignResult.errorMessage.length > 0
                ) {
                    const strError =
                        "BLS-sign(2) finished with error: " + joSignResult.errorMessage;
                    joRetVal.error = strError;
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " BLS-sign(2) finished with error: " ) +
                        cc.warning( joSignResult.errorMessage ) +
                        "\n";
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        if( log.id != details.id )
                            log.write( strErrorMessage );
                        details.write( strErrorMessage );
                    }
                    await joCall.disconnect();
                    throw new Error( strError );
                }
                joSignResult.error = null;
                await joCall.disconnect();
            } ); // joCall.call ...
        } ); // rpcCall.create ...
    } catch ( err ) {
        const strError = owaspUtils.extractErrorMessage( err );
        joSignResult = { };
        joSignResult.error = strError;
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strErrorMessage =
                strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " +
                cc.error( "BLS-raw-signer error: " ) + cc.warning( strError ) +
                cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) +
                "\n";
            if( log.verboseGet() >= log.verboseReversed().error ) {
                if( log.id != details.id )
                    log.write( strErrorMessage );
                details.write( strErrorMessage );
            }
        }
    }
    const isSuccess = (
        joSignResult && typeof joSignResult == "object" && ( !joSignResult.error ) )
        ? true : false;
    if( isExposeOutput || ( !isSuccess ) )
        details.exposeDetailsTo( log, "BLS-raw-signer", isSuccess );
    details.close();
    return joSignResult;
}

async function prepareHandlingOfSkaleImaVerifyAndSign( optsHandleVerifyAndSign ) {
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
            cc.debug( "Will verify and sign " ) + cc.j( optsHandleVerifyAndSign.joCallData ) +
            "\n" );
    }
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
    const strDir = cc.bright( optsHandleVerifyAndSign.strDirection );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix + strDir +
            cc.debug( " verification algorithm will work for transfer from chain " ) +
            cc.info( optsHandleVerifyAndSign.strFromChainName ) + cc.debug( "/" ) +
            cc.notice( optsHandleVerifyAndSign.strFromChainID ) + cc.debug( " to chain" ) +
            cc.info( optsHandleVerifyAndSign.strToChainName ) + cc.debug( "/" ) +
            cc.notice( optsHandleVerifyAndSign.strToChainID ) +
            cc.debug( " and work with array of message(s) " ) +
            cc.j( optsHandleVerifyAndSign.jarrMessages ) + "\n" );
    }
    optsHandleVerifyAndSign.nThreshold =
        discoverBlsThreshold( optsHandleVerifyAndSign.imaState.joSChainNetworkInfo );
    optsHandleVerifyAndSign.nParticipants =
        discoverBlsParticipants( optsHandleVerifyAndSign.imaState.joSChainNetworkInfo );
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix + strDir +
            cc.debug( " verification algorithm discovered BLS threshold is " ) +
            cc.info( optsHandleVerifyAndSign.nThreshold ) + cc.debug( "." ) + "\n" );
        optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix + strDir +
            cc.debug( " verification algorithm discovered number of BLS participants is " ) +
            cc.info( optsHandleVerifyAndSign.nParticipants ) + cc.debug( "." ) + "\n" );
    }
    if( ! checkBlsThresholdAndBlsParticipants(
        optsHandleVerifyAndSign.nThreshold,
        optsHandleVerifyAndSign.nParticipants,
        "prepare handling of skale_imaVerifyAndSign",
        optsHandleVerifyAndSign.details ) )
        return false;
    optsHandleVerifyAndSign.strMessageHash =
        owaspUtils.removeStarting0x(
            keccak256Message(
                optsHandleVerifyAndSign.jarrMessages,
                optsHandleVerifyAndSign.nIdxCurrentMsgBlockStart,
                optsHandleVerifyAndSign.strFromChainName
            )
        );
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix + strDir +
            cc.debug( " verification algorithm message hash to sign is " ) +
            cc.info( optsHandleVerifyAndSign.strMessageHash ) + "\n" );
    }
    return true;
}

async function prepareS2sOfSkaleImaVerifyAndSign( optsHandleVerifyAndSign ) {
    const strSChainNameSrc = optsHandleVerifyAndSign.joCallData.params.srcChainName;
    const strSChainNameDst = optsHandleVerifyAndSign.joCallData.params.dstChainName;
    const strDir = cc.bright( optsHandleVerifyAndSign.strDirection );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix + strDir +
            cc.debug( " verification algorithm will use for source chain name " ) +
            cc.info( strSChainNameSrc ) + cc.debug( " and destination chain name " ) +
            cc.info( strSChainNameDst ) + "\n" );
    }
    const arrSChainsCached = skaleObserver.getLastCachedSChains();
    if( ( !arrSChainsCached ) || arrSChainsCached.length == 0 ) {
        throw new Error(
            "Could not handle " + optsHandleVerifyAndSign.strDirection +
            " skale_imaVerifyAndSign(1), no S-Chains in SKALE NETWORK " +
            "observer cached yet, try again later"
        );
    }

    let joSChainSrc = null, strUrlSrcSChain = null;
    for( let idxSChain = 0; idxSChain < arrSChainsCached.length; ++ idxSChain ) {
        const joSChain = arrSChainsCached[idxSChain];
        if( joSChain.data.name.toString() == strSChainNameSrc.toString() ) {
            joSChainSrc = joSChain;
            strUrlSrcSChain = skaleObserver.pickRandomSChainUrl( joSChain );
            break;
        }
    }
    if( joSChainSrc == null || strUrlSrcSChain == null || strUrlSrcSChain.length == 0 ) {
        throw new Error(
            "Could not handle " + optsHandleVerifyAndSign.strDirection +
            " skale_imaVerifyAndSign(2), failed to discover source " +
            "chain access parameters, try again later" );
    }
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
            cc.bright( optsHandleVerifyAndSign.strDirection ) +
            cc.debug( " verification algorithm discovered source chain URL is " ) +
            cc.u( strUrlSrcSChain ) + cc.debug( ", chain name is " ) +
            cc.info( joSChainSrc.data.computed.computedSChainId ) + cc.debug( ", chain id is " ) +
            cc.info( joSChainSrc.data.computed.chainId ) + "\n" );
    }
    optsHandleVerifyAndSign.joExtraSignOpts = {
        skaleObserver: skaleObserver,
        ethersProviderSrc: owaspUtils.getEthersProviderFromURL( strUrlSrcSChain ),
        chainNameSrc: optsHandleVerifyAndSign.strFromChainName,
        chainNameDst: optsHandleVerifyAndSign.strToChainName,
        chainIdSrc: optsHandleVerifyAndSign.strFromChainID,
        chainIdDst: optsHandleVerifyAndSign.strToChainID
    };
}

export async function handleSkaleImaVerifyAndSign( joCallData ) {
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
    const strDir = cc.bright( optsHandleVerifyAndSign.strDirection );
    try {
        if( ! ( await prepareHandlingOfSkaleImaVerifyAndSign( optsHandleVerifyAndSign ) ) )
            return null;
        optsHandleVerifyAndSign.joExtraSignOpts = null;
        if( optsHandleVerifyAndSign.strDirection == "S2S" )
            await prepareS2sOfSkaleImaVerifyAndSign( optsHandleVerifyAndSign );
        await checkCorrectnessOfMessagesToSign(
            optsHandleVerifyAndSign.details, optsHandleVerifyAndSign.strLogPrefix,
            optsHandleVerifyAndSign.strDirection, optsHandleVerifyAndSign.jarrMessages,
            optsHandleVerifyAndSign.nIdxCurrentMsgBlockStart,
            optsHandleVerifyAndSign.joExtraSignOpts );
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
                cc.debug( "Will BLS-sign verified messages." ) + "\n" );
        }
        let joAccount = optsHandleVerifyAndSign.imaState.chainProperties.sc.joAccount;
        if( ! joAccount.strURL ) {
            joAccount = optsHandleVerifyAndSign.imaState.chainProperties.mn.joAccount;
            if( ! joAccount.strSgxURL )
                throw new Error( "SGX URL is unknown, cannot sign(handle) IMA message(s)" );
            if( ! joAccount.strBlsKeyName )
                throw new Error( "BLS keys name is unknown, cannot sign IMA message(s)" );
        }
        let rpcCallOpts = null;
        if( "strPathSslKey" in joAccount && typeof joAccount.strPathSslKey == "string" &&
            joAccount.strPathSslKey.length > 0 && "strPathSslCert" in joAccount &&
            typeof joAccount.strPathSslCert == "string" && joAccount.strPathSslCert.length > 0
        ) {
            rpcCallOpts = {
                "cert": fs.readFileSync( joAccount.strPathSslCert, "utf8" ),
                "key": fs.readFileSync( joAccount.strPathSslKey, "utf8" )
            };
        } else {
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                optsHandleVerifyAndSign.details.write( cc.warning( "Will sign via SGX" ) +
                    " " + cc.error( "without SSL options" ) + "\n" );
            }
        }
        const signerIndex = optsHandleVerifyAndSign.imaState.nNodeNumber;
        await rpcCall.create( joAccount.strSgxURL, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                const strErrorMessage = optsHandleVerifyAndSign.strLogPrefix + strDir + " " +
                    cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call" +
                    "(handleSkaleImaVerifyAndSign) to SGX failed, RPC call was not created, " +
                    "error is: " ) + cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n";
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    if( log.id != optsHandleVerifyAndSign.details.id )
                        log.write( strErrorMessage );
                    optsHandleVerifyAndSign.details.write( strErrorMessage );
                }
                if( joCall )
                    await joCall.disconnect();
                throw new Error(
                    "JSON RPC call(handleSkaleImaVerifyAndSign) to SGX failed, RPC call was " +
                    "not created, error is: " + owaspUtils.extractErrorMessage( err ) );
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
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
                    strDir + cc.debug( " verification algorithm will invoke " ) + cc.info( "SGX" ) +
                    " " + cc.debug( "with call data" ) + " " + cc.j( joCallSGX ) + "\n" );
            }
            await joCall.call( joCallSGX, async function( joIn, joOut, err ) {
                if( err ) {
                    const strError =
                        "JSON RPC call(handleSkaleImaVerifyAndSign) to SGX failed, RPC call " +
                        "reported error: " + owaspUtils.extractErrorMessage( err );
                    optsHandleVerifyAndSign.joRetVal.error = strError;
                    const jsErrorObject = new Error( strError );
                    const strErrorMessage = optsHandleVerifyAndSign.strLogPrefix +
                        cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call" +
                        "(handleSkaleImaVerifyAndSign) to SGX failed, RPC call reported error: " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                        cc.error( ", stack is:" ) + "\n" + cc.stack( jsErrorObject.stack ) + "\n";
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        if( log.id != optsHandleVerifyAndSign.details.id )
                            log.write( strErrorMessage );
                        optsHandleVerifyAndSign.details.write( strErrorMessage );
                    }
                    await joCall.disconnect();
                    throw jsErrorObject;
                }
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    optsHandleVerifyAndSign.details.write( optsHandleVerifyAndSign.strLogPrefix +
                        strDir + cc.debug( " Call to " ) + cc.info( "SGX" ) +
                        cc.debug( " done, answer is: " ) + cc.j( joOut ) + "\n" );
                }
                let joSignResult = joOut;
                if( joOut.result != null && joOut.result != undefined &&
                    typeof joOut.result == "object" )
                    joSignResult = joOut.result;
                if( joOut.signResult != null && joOut.signResult != undefined &&
                    typeof joOut.signResult == "object" )
                    joSignResult = joOut.signResult;
                if( "qa" in optsHandleVerifyAndSign.joCallData )
                    optsHandleVerifyAndSign.joRetVal.qa = optsHandleVerifyAndSign.joCallData.qa;
                if( !joSignResult ) {
                    const strError = "No signature arrived";
                    joRetVal.error = strError;
                    if( log.id != details.id ) {
                        log.write( strLogPrefix + cc.error( "BLS-sign(1) finished with error: }" ) +
                            cc.warning( strError ) + "\n" );
                    }
                    details.write( strLogPrefix + cc.error( "BLS-sign(1) finished with error: }" ) +
                        cc.warning( strError ) + "\n" );
                    await joCall.disconnect();
                    throw new Error( strError );
                }
                if( "errorMessage" in joSignResult &&
                    typeof joSignResult.errorMessage == "string" &&
                    joSignResult.errorMessage.length > 0
                ) {
                    optsHandleVerifyAndSign.isSuccess = false;
                    const strError =
                        "BLS-sign(2) finished with error: " + joSignResult.errorMessage;
                    optsHandleVerifyAndSign.joRetVal.error = strError;
                    const strErrorMessage = optsHandleVerifyAndSign.strLogPrefix +
                        cc.fatal( "CRITICAL ERROR:" ) + cc.error( " BLS-sign(2) finished with " +
                        "error: " ) + cc.warning( joSignResult.errorMessage ) + "\n";
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        if( log.id != optsHandleVerifyAndSign.details.id )
                            log.write( strErrorMessage );
                        optsHandleVerifyAndSign.details.write( strErrorMessage );
                    }
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
        const strError = owaspUtils.extractErrorMessage( err );
        optsHandleVerifyAndSign.joRetVal.error = strError;
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strErrorMessage =
                optsHandleVerifyAndSign.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " +
                cc.error( "IMA messages verifier/signer error: " ) + cc.warning( strError ) +
                cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != optsHandleVerifyAndSign.details.id )
                log.write( strErrorMessage );
            optsHandleVerifyAndSign.details.write( strErrorMessage );
        }
    }
    optsHandleVerifyAndSign.details.exposeDetailsTo(
        log, "IMA messages verifier/signer", optsHandleVerifyAndSign.isSuccess );
    optsHandleVerifyAndSign.details.close();
    return optsHandleVerifyAndSign.joRetVal;
}

async function handleSkaleImaBSU256Prepare( optsBSU256 ) {
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsBSU256.details.write( optsBSU256.strLogPrefix +
            cc.debug( "Will U256-BLS-sign " ) + cc.j( optsBSU256.joCallData ) + "\n" );
    }
    optsBSU256.nThreshold =
        discoverBlsThreshold( optsBSU256.imaState.joSChainNetworkInfo );
    optsBSU256.nParticipants =
        discoverBlsParticipants( optsBSU256.imaState.joSChainNetworkInfo );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsBSU256.details.write( optsBSU256.strLogPrefix +
            cc.debug( "Discovered BLS threshold is " ) +
            cc.info( optsBSU256.nThreshold ) + cc.debug( "." ) + "\n" );
        optsBSU256.details.write( optsBSU256.strLogPrefix +
            cc.debug( "Discovered number of BLS participants is " ) +
            cc.info( optsBSU256.nParticipants ) + cc.debug( "." ) + "\n" );
    }
    if( ! checkBlsThresholdAndBlsParticipants(
        optsHandleVerifyAndSign.nThreshold,
        optsHandleVerifyAndSign.nParticipants,
        "handle BSU256Prepare",
        optsBSU256.details ) )
        return false;
    optsBSU256.u256 = optsBSU256.joCallData.params.valueToSign;
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsBSU256.details.write( optsBSU256.strLogPrefix +
            cc.debug( "U256 original value is " ) + cc.info( optsBSU256.u256 ) + "\n" );
    }
    optsBSU256.strMessageHash = keccak256U256.u256( optsBSU256.u256, true );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsBSU256.details.write( optsBSU256.strLogPrefix +
            cc.debug( "hash of U256 value to sign is " ) + cc.info( optsBSU256.strMessageHash ) +
            "\n" );
        optsBSU256.details.write( optsBSU256.strLogPrefix + cc.debug( "Will BLS-sign U256." ) +
        "\n" );
    }
    optsBSU256.joAccount = optsBSU256.imaState.chainProperties.sc.optsBSU256.joAccount;
    if( ! optsBSU256.joAccount.strURL ) {
        optsBSU256.joAccount = optsBSU256.imaState.chainProperties.mn.optsBSU256.joAccount;
        if( ! optsBSU256.joAccount.strSgxURL )
            throw new Error( "SGX URL is unknown, cannot sign U256" );
        if( ! optsBSU256.joAccount.strBlsKeyName )
            throw new Error( "BLS keys name is unknown, cannot sign U256" );
    }
    return true;
}

export async function handleSkaleImaBSU256( joCallData ) {
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
        if( ! ( await handleSkaleImaBSU256Prepare( optsBSU256 ) ) )
            return null;
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
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                optsBSU256.details.write( cc.warning( "Will sign via SGX" ) + " " +
                    cc.error( "without SSL options" ) + "\n" );
            }
        }
        const signerIndex = optsBSU256.imaState.nNodeNumber;
        await rpcCall.create( optsBSU256.joAccount.strSgxURL, rpcCallOpts,
            async function( joCall, err ) {
                if( err ) {
                    const strErrorMessage =
                        optsBSU256.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call(handleSkaleImaBSU256) to SGX failed, " +
                            "RPC call was not created, error is: " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n";
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        if( log.id != optsBSU256.details.id )
                            log.write( strErrorMessage );
                        optsBSU256.details.write( strErrorMessage );
                    }
                    if( joCall )
                        await joCall.disconnect();
                    throw new Error( "JSON RPC call(handleSkaleImaBSU256) to SGX failed, " +
                        "RPC call was not created, error is: " +
                        owaspUtils.extractErrorMessage( err ) );
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
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    optsBSU256.details.write( optsBSU256.strLogPrefix + cc.debug( "Will invoke " ) +
                        cc.info( "SGX" ) + cc.debug( " with call data " ) + cc.j( joCallSGX ) +
                        "\n" );
                }
                await joCall.call( joCallSGX, async function( joIn, joOut, err ) {
                    if( err ) {
                        const jsErrorObject = new Error(
                            "JSON RPC call(handleSkaleImaBSU256) to SGX failed, " +
                            "RPC call reported error: " +
                            owaspUtils.extractErrorMessage( err ) );
                        const strErrorMessage =
                            optsBSU256.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                cc.error( " JSON RPC call(handleSkaleImaBSU256) to SGX failed, " +
                                    "RPC call reported error: " ) +
                                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                                cc.error( ", stack is:" ) + "\n" + cc.stack( jsErrorObject.stack ) +
                                "\n";
                        if( log.verboseGet() >= log.verboseReversed().error ) {
                            if( log.id != optsBSU256.details.id )
                                log.write( strErrorMessage );
                            optsBSU256.details.write( strErrorMessage );
                        }
                        await joCall.disconnect();
                        throw jsErrorObject;
                    }
                    if( log.verboseGet() >= log.verboseReversed().trace ) {
                        optsBSU256.details.write( optsBSU256.strLogPrefix + cc.debug( "Call to " ) +
                            cc.info( "SGX" ) + cc.debug( " done, answer is: " ) + cc.j( joOut ) +
                            "\n" );
                    }
                    let joSignResult = joOut;
                    if( joOut.result != null && joOut.result != undefined &&
                        typeof joOut.result == "object" )
                        joSignResult = joOut.result;
                    if( joOut.signResult != null && joOut.signResult != undefined &&
                        typeof joOut.signResult == "object" )
                        joSignResult = joOut.signResult;
                    if( !joSignResult ) {
                        const strError = "No signature arrived";
                        joRetVal.error = strError;
                        if( log.id != details.id ) {
                            log.write( strLogPrefix + cc.error( "U256/BLS-sign(1) finished " +
                                "with error: " ) + cc.warning( strError ) + "\n" );
                        }
                        details.write( strLogPrefix + cc.error( "U256/BLS-sign(1) finished " +
                            "with error: " ) + cc.warning( strError ) + "\n" );
                        await joCall.disconnect();
                        throw new Error( strError );
                    }
                    if( "errorMessage" in joSignResult &&
                        typeof joSignResult.errorMessage == "string" &&
                        joSignResult.errorMessage.length > 0 ) {
                        optsBSU256.isSuccess = false;
                        const strError =
                            "U256/BLS-sign(2) finished with error: " + joSignResult.errorMessage;
                        optsBSU256.joRetVal.error = strError;
                        const strErrorMessage = optsBSU256.strLogPrefix +
                            cc.fatal( "CRITICAL ERROR:" ) + cc.error( " U256/BLS-sign(2) finished" +
                            " with error: " ) + cc.warning( joSignResult.errorMessage ) + "\n";
                        if( log.verboseGet() >= log.verboseReversed().error ) {
                            if( log.id != optsBSU256.details.id )
                                log.write( strErrorMessage );
                            optsBSU256.details.write( strErrorMessage );
                        }
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
        const strError = owaspUtils.extractErrorMessage( err );
        optsBSU256.joRetVal.error = strError;
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strErrorMessage = optsBSU256.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " +
                cc.error( "U256-BLS-signer error: " ) + cc.warning( strError ) +
                cc.error( ", stack is:" ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != optsBSU256.details.id )
                log.write( strErrorMessage );
            optsBSU256.details.write( strErrorMessage );
        }
    }
    optsBSU256.details.exposeDetailsTo( log, "U256-BLS-signer", optsBSU256.isSuccess );
    optsBSU256.details.close();
    return optsBSU256.joRetVal;
}
