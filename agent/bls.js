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
 * @file bls.js
 * @copyright SKALE Labs 2019-Present
 */

// const fs = require( "fs" );
// const path = require( "path" );
// const url = require( "url" );
// const os = require( "os" );
const child_process = require( "child_process" );
const shell = require( "shelljs" );
const { Keccak } = require( "sha3" );
const { cc } = require( "../npms/skale-ima" );

function init() {
    owaspUtils.owaspAddUsageRef();
}

function discover_bls_threshold( joSChainNetworkInfo ) {
    const jarrNodes = imaState.joSChainNetworkInfo.network;
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
    const jarrNodes = imaState.joSChainNetworkInfo.network;
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
    const jarrNodes = imaState.joSChainNetworkInfo.network;
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
    const jarrNodes = imaState.joSChainNetworkInfo.network;
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

function compose_one_message_byte_sequence( joMessage ) {
    const w3 = imaState.w3_s_chain ? imaState.w3_s_chain : imaState.w3_main_net;
    if( !w3 )
        throw new Error( "w3.utils is needed for BN operations but no w3 provided" );
    let arrBytes = new Uint8Array();

    let bytesSender = imaUtils.hexToBytes( joMessage.sender );
    bytesSender = imaUtils.invertArrayItemsLR( bytesSender );
    bytesSender = imaUtils.bytesAlignLeftWithZeroes( bytesSender, 32 );
    bytesSender = imaUtils.invertArrayItemsLR( bytesSender );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesSender );
    //
    let bytesDestinationContract = imaUtils.hexToBytes( joMessage.destinationContract );
    bytesDestinationContract = imaUtils.invertArrayItemsLR( bytesDestinationContract );
    bytesDestinationContract = imaUtils.bytesAlignLeftWithZeroes( bytesDestinationContract, 32 );
    bytesDestinationContract = imaUtils.invertArrayItemsLR( bytesDestinationContract );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesDestinationContract );
    //
    // let bytesTo = imaUtils.hexToBytes( joMessage.to );
    // bytesTo = imaUtils.invertArrayItemsLR( bytesTo );
    // bytesTo = imaUtils.bytesAlignLeftWithZeroes( bytesTo, 32 );
    // bytesTo = imaUtils.invertArrayItemsLR( bytesTo );
    // arrBytes = imaUtils.bytesConcat( arrBytes, bytesTo );
    //
    // const strHexAmount = "0x" + w3.utils.toBN( joMessage.amount ).toString( 16 );
    // let bytesAmount = imaUtils.hexToBytes( strHexAmount );
    // /////////////////// bytesAmount = imaUtils.invertArrayItemsLR( bytesAmount );
    // bytesAmount = imaUtils.bytesAlignLeftWithZeroes( bytesAmount, 32 );
    // arrBytes = imaUtils.bytesConcat( arrBytes, bytesAmount );
    //
    const bytesData = imaUtils.hexToBytes( joMessage.data );
    // bytesData = imaUtils.invertArrayItemsLR( bytesData ); // do not invert byte order data field (see SKALE-3554 for details)
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesData );
    //
    return arrBytes;
}

function compose_summary_message_to_sign( jarrMessages, isHash ) {
    let arrBytes = new Uint8Array();
    let i = 0; const cnt = jarrMessages.length;
    for( i = 0; i < cnt; ++i ) {
        const joMessage = jarrMessages[i];
        const arrMessageBytes = compose_one_message_byte_sequence( joMessage );
        arrBytes = imaUtils.bytesConcat( arrBytes, arrMessageBytes );
    }
    let strSummaryMessage = "";
    if( isHash ) {
        const hash = new Keccak( 256 );
        hash.update( imaUtils.toBuffer( arrBytes ) );
        strSummaryMessage = hash.digest( "hex" );
    } else
        strSummaryMessage = "0x" + imaUtils.bytesToHex( arrBytes );
    return strSummaryMessage;
}

function compose_summary_message_to_sign_u256( u256, isHash ) {
    let arrBytes = new Uint8Array();
    //
    let bytes_u256 = imaUtils.hexToBytes( u256 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    bytes_u256 = imaUtils.bytesAlignLeftWithZeroes( bytes_u256, 32 );
    bytes_u256 = imaUtils.invertArrayItemsLR( bytes_u256 );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytes_u256 );
    //
    let strSummaryMessage = "";
    if( isHash ) {
        const hash = new Keccak( 256 );
        hash.update( imaUtils.toBuffer( arrBytes ) );
        strSummaryMessage = hash.digest( "hex" );
    } else
        strSummaryMessage = "0x" + imaUtils.bytesToHex( arrBytes );
    return strSummaryMessage;
}

function split_signature_share( signatureShare ) {
    const jarr = signatureShare.split( ":" );
    return {
        X: jarr[0],
        Y: jarr[1]
    };
}

function get_bls_glue_tmp_dir() {
    // NOTE: uncomment require( "path" ); at top of this file when using local tmp folder
    // const strTmpDir = path.resolve( __dirname ) + "/tmp";
    const strTmpDir = "/tmp/ima-bls-glue";
    shell.mkdir( "-p", strTmpDir );
    return strTmpDir;
}

function alloc_bls_tmp_action_dir() {
    const strActionDir = get_bls_glue_tmp_dir() + "/" + imaUtils.replaceAll( imaUtils.uuid(), "-", "" );
    shell.mkdir( "-p", strActionDir );
    return strActionDir;
}

function perform_bls_glue( details, strDirection, jarrMessages, arrSignResults ) {
    const strLogPrefix = cc.bright( strDirection ) + cc.debug( "/" ) + cc.info( "BLS" ) + cc.debug( "/" ) + cc.attention( "Glue" ) + cc.debug( ":" ) + " ";
    let joGlueResult = null;
    // const jarrNodes = imaState.joSChainNetworkInfo.network;
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    details.write( strLogPrefix + cc.debug( "Discovered BLS threshold is " ) + cc.info( nThreshold ) + cc.debug( "." ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Discovered number of BLS participants is " ) + cc.info( nParticipants ) + cc.debug( "." ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Original long message is " ) + cc.info( compose_summary_message_to_sign( jarrMessages, false ) ) + "\n" );
    const strSummaryMessage = compose_summary_message_to_sign( jarrMessages, true );
    details.write( strLogPrefix + cc.debug( "Message hash to sign is " ) + cc.info( strSummaryMessage ) + "\n" );
    const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    details.write( strLogPrefix + cc.debug( "perform_bls_glue will work in " ) + cc.info( strActionDir ) + cc.debug( " director with " ) + cc.info( arrSignResults.length ) + cc.debug( " sign results..." ) + "\n" );
    const fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        shell.cd( strActionDir );
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
        strOutput = child_process.execSync( strGlueCommand );
        details.write( strLogPrefix + cc.debug( "BLS glue output is:\n" ) + cc.notice( strOutput ) + "\n" );
        joGlueResult = imaUtils.jsonFileLoad( strActionDir + "/glue-result.json" );
        details.write( strLogPrefix + cc.debug( "BLS glue result is: " ) + cc.j( joGlueResult ) + "\n" );
        if( "X" in joGlueResult.signature && "Y" in joGlueResult.signature ) {
            details.write( strLogPrefix + cc.success( "BLS glue success" ) + "\n" );
            joGlueResult.hashSrc = strSummaryMessage;
            //
            //
            //
            details.write( strLogPrefix + cc.debug( "Computing " ) + cc.info( "G1" ) + cc.debug( " hash point..." ) + "\n" );
            const strPath = strActionDir + "/hash.json";
            details.write( strLogPrefix + cc.normal( "Saving " ) + cc.notice( strPath ) + cc.debug( " file..." ) + "\n" );
            imaUtils.jsonFileSave( strPath, { message: strSummaryMessage } );
            const strHasG1Command =
                imaState.strPathHashG1 +
                " --t " + nThreshold +
                " --n " + nParticipants;
            details.write( strLogPrefix + cc.normal( "Will execute HashG1 command:\n" ) + cc.notice( strHasG1Command ) + "\n" );
            strOutput = child_process.execSync( strHasG1Command );
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
        const s1 = strLogPrefix + cc.fatal( "BLS glue CRITICAL ERROR:" ) + cc.error( " error description is: " ) + cc.warning( err.toString() ) + "\n";
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
    details.write( strLogPrefix + cc.debug( "Original long message is " ) + cc.info( compose_summary_message_to_sign_u256( u256, false ) ) + "\n" );
    const strSummaryMessage = compose_summary_message_to_sign_u256( u256, true );
    details.write( strLogPrefix + cc.debug( "Message hash to sign is " ) + cc.info( strSummaryMessage ) + "\n" );
    const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    details.write( strLogPrefix + cc.debug( "perform_bls_glue_u256 will work in " ) + cc.info( strActionDir ) + cc.debug( " director with " ) + cc.info( arrSignResults.length ) + cc.debug( " sign results..." ) + "\n" );
    const fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        shell.cd( strActionDir );
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
        strOutput = child_process.execSync( strGlueCommand );
        details.write( strLogPrefix + cc.normal( "BLS glue output is:\n" ) + cc.notice( strOutput ) + "\n" );
        joGlueResult = imaUtils.jsonFileLoad( strActionDir + "/glue-result.json" );
        details.write( strLogPrefix + cc.normal( "BLS glue result is: " ) + cc.j( joGlueResult ) + "\n" );
        if( "X" in joGlueResult.signature && "Y" in joGlueResult.signature ) {
            details.write( strLogPrefix + cc.success( "BLS glue success" ) + "\n" );
            joGlueResult.hashSrc = strSummaryMessage;
            //
            //
            //
            details.write( strLogPrefix + cc.debug( "Computing " ) + cc.info( "G1" ) + cc.debug( " hash point..." ) + "\n" );
            const strPath = strActionDir + "/hash.json";
            details.write( strLogPrefix + cc.normal( "Saving " ) + cc.notice( strPath ) + cc.debug( " file..." ) + "\n" );
            imaUtils.jsonFileSave( strPath, { message: strSummaryMessage } );
            const strHasG1Command =
                imaState.strPathHashG1 +
                " --t " + nThreshold +
                " --n " + nParticipants;
            details.write( strLogPrefix + cc.normal( "Will execute HashG1 command:\n" ) + cc.notice( strHasG1Command ) + "\n" );
            strOutput = child_process.execSync( strHasG1Command );
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
        const s1 = strLogPrefix + cc.fatal( "BLS glue CRITICAL ERROR:" ) + cc.error( " error description is: " ) + cc.warning( err.toString() ) + "\n";
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

function perform_bls_verify_i( details, strDirection, nZeroBasedNodeIndex, joResultFromNode, jarrMessages, joPublicKey ) {
    if( !joResultFromNode )
        return true;
    const strLogPrefix = cc.bright( strDirection ) + cc.debug( "/" ) + cc.info( "BLS" ) + cc.debug( "/" ) + cc.notice( "#" ) + cc.bright( nZeroBasedNodeIndex ) + cc.debug( ":" ) + " ";
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        shell.cd( strActionDir );
        const joMsg = { message: compose_summary_message_to_sign( jarrMessages, true ) };
        details.write( strLogPrefix + cc.debug( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.debug( " verify message " ) + cc.j( joMsg ) + cc.debug( " composed from " ) + cc.j( jarrMessages ) + cc.debug( " using glue " ) + cc.j( joResultFromNode ) + cc.debug( " and public key " ) + cc.j( joPublicKey ) + "\n" );
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
        strOutput = child_process.execSync( strVerifyCommand );
        details.write( strLogPrefix + cc.normal( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.normal( " verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        details.write( strLogPrefix + cc.success( "BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.success( " verify success" ) + "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " BLS node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify error:" ) + cc.normal( " error description is: " ) + cc.warning( err.toString() ) + "\n";
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
    const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        shell.cd( strActionDir );
        const joMsg = { message: compose_summary_message_to_sign_u256( u256, true ) };
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
        strOutput = child_process.execSync( strVerifyCommand );
        details.write( strLogPrefix + cc.normal( "BLS u256 node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.normal( " verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        details.write( strLogPrefix + cc.success( "BLS u256 node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.success( " verify success" ) + "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " BLS u256 node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify error:" ) + cc.normal( " error description is: " ) + cc.warning( err.toString() ) + "\n";
        const s2 = strLogPrefix + cc.error( "CRITICAL ERROR:" ) + cc.error( " BLS u256 node " ) + cc.notice( "#" ) + cc.info( nZeroBasedNodeIndex ) + cc.error( " verify output is:\n" ) + cc.notice( strOutput ) + "\n";
        log.write( s1 );
        details.write( s1 );
        log.write( s2 );
        details.write( s2 );
        fnShellRestore();
    }
    return false;
}

function perform_bls_verify( details, strDirection, joGlueResult, jarrMessages, joCommonPublicKey ) {
    if( !joGlueResult )
        return true;
    const nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    const nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    const strLogPrefix = cc.bright( strDirection ) + cc.debug( "/" ) + cc.info( "BLS" ) + cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
    try {
        shell.cd( strActionDir );
        const joMsg = { message: compose_summary_message_to_sign( jarrMessages, true ) };
        details.write( strLogPrefix + cc.debug( "BLS/summary verify message " ) + cc.j( joMsg ) + cc.debug( " composed from " ) + cc.j( jarrMessages ) + cc.debug( " using glue " ) + cc.j( joGlueResult ) + cc.debug( " and common public key " ) + cc.j( joCommonPublicKey ) + "\n" );
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
        strOutput = child_process.execSync( strVerifyCommand );
        details.write( strLogPrefix + cc.normal( "BLS/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        details.write( strLogPrefix + cc.success( "BLS/summary verify success" ) + "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix + cc.fatal( "BLS/summary verify CRITICAL ERROR:" ) + cc.normal( " error description is: " ) + cc.warning( err.toString() ) + "\n";
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
    const strPWD = shell.pwd();
    const strActionDir = alloc_bls_tmp_action_dir();
    const fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    const strLogPrefix = cc.info( "BLS u256" ) + cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
    try {
        shell.cd( strActionDir );
        const joMsg = { message: compose_summary_message_to_sign_u256( u256, true ) };
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
        strOutput = child_process.execSync( strVerifyCommand );
        details.write( strLogPrefix + cc.normal( "BLS u256/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        details.write( strLogPrefix + cc.success( "BLS u256/summary verify success" ) + "\n" );
        fnShellRestore();
        return true;
    } catch ( err ) {
        const s1 = strLogPrefix + cc.fatal( "BLS u256/summary verify CRITICAL ERROR:" ) + cc.normal( " error description is: " ) + cc.warning( err.toString() ) + "\n";
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
    let w3 = null; let joMessageProxy = null; let joAccount = null; let joChainName = null;
    if( strDirection == "M2S" ) {
        w3 = imaState.w3_main_net;
        joMessageProxy = imaState.jo_message_proxy_main_net;
        joAccount = imaState.joAccount_main_net;
        joChainName = imaState.strChainName_s_chain;
    } else if( strDirection == "S2M" ) {
        w3 = imaState.w3_s_chain;
        joMessageProxy = imaState.jo_message_proxy_s_chain;
        joAccount = imaState.joAccount_s_chain;
        joChainName = imaState.strChainName_main_net;
    } else if( strDirection == "S2S" ) {
        w3 = joExtraSignOpts.w3_src;
        joMessageProxy = new w3.eth.Contract( imaState.joAbiPublishResult_s_chain.message_proxy_chain_abi, imaState.joAbiPublishResult_s_chain.message_proxy_chain_address );
        joAccount = imaState.joAccount_s_chain;
        joChainName = joExtraSignOpts.chain_id_dst;
    } else
        throw new Error( "CRITICAL ERROR: Failed check_correctness_of_messages_to_sign() with unknown directon \"" + strDirection + "\"" );

    const strCallerAccountAddress = joAccount.address( w3 );
    details.write( strLogPrefix + cc.sunny( strDirection ) + cc.debug( " message correctness validation through call to " ) +
        cc.notice( "verifyOutgoingMessageData" ) + cc.debug( " method of " ) + cc.bright( "MessageProxy" ) +
        cc.debug( " contract with address " ) + cc.notice( joMessageProxy.options.address ) +
        cc.debug( ", caller account address is " ) + cc.info( joMessageProxy.options.address ) +
        cc.debug( ", message(s) count is " ) + cc.info( jarrMessages.length ) +
        cc.debug( ", message(s) to process:" ) + cc.j( jarrMessages ) +
        cc.debug( ", first real message index is:" ) + cc.info( nIdxCurrentMsgBlockStart ) +
        "\n" );
    let cntBadMessages = 0, i = 0;
    const cnt = jarrMessages.length;
    if( strDirection == "S2M" || strDirection == "S2S" ) {
        for( i = 0; i < cnt; ++i ) {
            const joMessage = jarrMessages[i];
            const idxMessage = nIdxCurrentMsgBlockStart + i;
            try {
                details.write(
                    cc.debug( "Will validate message " ) + cc.info( i ) + cc.debug( " of " ) + cc.info( cnt ) +
                    cc.debug( ", real message index is: " ) + cc.info( idxMessage ) +
                    "\n" );
                // const strHexAmount = "0x" + w3.utils.toBN( joMessage.amount ).toString( 16 );
                const outgoingMessageData = {
                    dstChainHash: w3.utils.soliditySha3( joChainName ), // dstChainHash
                    msgCounter: 0 + idxMessage,
                    srcContract: joMessage.sender,
                    dstContract: joMessage.destinationContract,
                    // to: joMessage.to,
                    // amount: strHexAmount,
                    data: joMessage.data
                };
                details.write(
                    cc.debug( "Outgoing message data is " ) + cc.j( outgoingMessageData ) +
                    cc.debug( ", real message index is: " ) + cc.info( idxMessage ) +
                    cc.debug( ", saved msgCounter is: " ) + cc.info( outgoingMessageData.msgCounter ) +
                    "\n" );
                const m = joMessageProxy.methods.verifyOutgoingMessageData(
                    outgoingMessageData
                );
                const isValidMessage = await m.call( { from: strCallerAccountAddress } );
                details.write(
                    cc.debug( "Got verification call result " ) + cc.tf( isValidMessage ) +
                    cc.debug( ", real message index is: " ) + cc.info( idxMessage ) +
                    cc.debug( ", saved msgCounter is: " ) + cc.info( outgoingMessageData.msgCounter ) +
                    "\n" );
                if( !isValidMessage )
                    throw new Error( "Bad message detected, message is: " + JSON.stringify( joMessage ) );
            } catch ( err ) {
                ++cntBadMessages;
                const s =
                    strLogPrefix + cc.fatal( "BAD ERROR:" ) +
                    cc.error( " Correctness validation failed for message " ) + cc.info( idxMessage ) +
                    cc.error( " sent to " ) + cc.info( joChainName ) +
                    cc.error( ", message is: " ) + cc.j( joMessage ) +
                    cc.error( ", error information: " ) + cc.warning( err.toString() ) +
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

async function do_sign_messages_impl( strDirection, jarrMessages, nIdxCurrentMsgBlockStart, details, joExtraSignOpts, fn ) {
    let bHaveResultReportCalled = false;
    const strLogPrefix = cc.bright( strDirection ) + " " + cc.info( "Sign msgs:" ) + " ";
    log.write( strLogPrefix + cc.debug( " Invoking " ) + cc.bright( strDirection ) + cc.debug( " signing messages procedure " ) + "\n" );
    details.write( strLogPrefix + cc.debug( " Invoking " ) + cc.bright( strDirection ) + cc.debug( " signing messages procedure " ) + "\n" );
    fn = fn || function() {};
    if( !( imaState.bSignMessages && imaState.strPathBlsGlue.length > 0 && imaState.joSChainNetworkInfo ) ) {
        details.write( strLogPrefix + cc.debug( "BLS message signing is " ) + cc.error( "turned off" ) +
            cc.debug( ", first real message index is:" ) + cc.info( nIdxCurrentMsgBlockStart ) +
            cc.debug( ", have " ) + cc.info( jarrMessages.length ) +
            cc.debug( " message(s) to process:" ) + cc.j( jarrMessages ) +
            "\n" );
        await check_correctness_of_messages_to_sign( details, strLogPrefix, strDirection, jarrMessages, nIdxCurrentMsgBlockStart, joExtraSignOpts );
        await fn( null, jarrMessages, null );
        bHaveResultReportCalled = true;
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
    details.write( strLogPrefix + cc.debug( "Will sign " ) + cc.info( jarrMessages.length ) + cc.debug( " message(s)..." ) + "\n" );
    log.write( strLogPrefix + cc.debug( "Will sign " ) + cc.j( jarrMessages ) + cc.debug( " message(s)..." ) + "\n" );
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
        await fn( "signature error, S-Chain information was not discovered properly and BLS threshold is unknown", jarrMessages, null );
        bHaveResultReportCalled = true;
        return;
    }
    const nCountOfBlsPartsToCollect = 0 + nThreshold;
    // if( nThreshold <= 1 && nParticipants > 1 ) {
    //     details.write( strLogPrefix + cc.warning( "Minimal BLS parts number for dicovery was increased." ) + "\n" );
    //     nCountOfBlsPartsToCollect = 2;
    // }
    log.write( strLogPrefix + cc.debug( "Will collect " ) + cc.info( nCountOfBlsPartsToCollect ) + cc.debug( " signature(s)" ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Will collect " ) + cc.info( nCountOfBlsPartsToCollect ) + cc.debug( " from " ) + cc.info( jarrNodes.length ) + cc.debug( " nodes" ) + "\n" );
    for( let i = 0; i < jarrNodes.length; ++i ) {
        const joNode = jarrNodes[i];
        const strNodeURL = imaUtils.compose_schain_node_url( joNode );
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
                    cc.error( " failed, RPC call was not created, error: " ) + cc.warning( err ) + "\n";
                log.write( strErrorMessage );
                details.write( strErrorMessage );
                return;
            }
            let targetChainName = "";
            let fromChainName = "";
            // let targetChainURL = "";
            // let fromChainURL = "";
            if( strDirection == "M2S" ) {
                targetChainName = "" + ( imaState.strChainName_s_chain ? imaState.strChainName_s_chain : "" );
                fromChainName = "" + ( imaState.strChainName_main_net ? imaState.strChainName_main_net : "" );
                // targetChainURL = strNodeURL;
                // fromChainURL = owaspUtils.w3_2_url( imaState.w3_main_net );
            } else if( strDirection == "S2M" ) {
                targetChainName = "" + ( imaState.strChainName_main_net ? imaState.strChainName_main_net : "" );
                fromChainName = "" + ( imaState.strChainName_s_chain ? imaState.strChainName_s_chain : "" );
                // targetChainURL = owaspUtils.w3_2_url( imaState.w3_main_net );
                // fromChainURL = strNodeURL;
            } else if( strDirection == "S2S" ) {
                targetChainName = "" + joExtraSignOpts.chain_id_dst;
                fromChainName = "" + joExtraSignOpts.chain_id_src;
                // targetChainURL = owaspUtils.w3_2_url( joExtraSignOpts.w3_dst );
                // fromChainURL = owaspUtils.w3_2_url( joExtraSignOpts.w3_src );
            } else
                throw new Error( "CRITICAL ERROR: Failed do_sign_messages_impl() with unknown directon \"" + strDirection + "\"" );

            const joParams = {
                direction: "" + strDirection,
                startMessageIdx: nIdxCurrentMsgBlockStart,
                dstChainName: targetChainName,
                srcChainName: fromChainName,
                messages: jarrMessages
                // fromChainURL: fromChainURL,
                // targetChainURL: targetChainURL
            };
            details.write(
                strLogPrefix + cc.debug( "Will invoke " ) + cc.info( "skale_imaVerifyAndSign" ) +
                cc.debug( " for transfer from chain " ) + cc.info( fromChainName ) +
                cc.debug( " to chain " ) + cc.info( targetChainName ) +
                cc.debug( " with params " ) + cc.j( joParams ) + "\n" );
            await joCall.call( {
                method: "skale_imaVerifyAndSign",
                params: joParams
            }, function( joIn, joOut, err ) {
                ++joGatheringTracker.nCountReceived; // including errors
                if( err ) {
                    ++joGatheringTracker.nCountErrors;
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                        cc.error( " failed, RPC call reported error: " ) + cc.warning( err ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    return;
                }
                if( joOut.result == null || joOut.result == undefined || ( !typeof joOut.result == "object" ) ) {
                    ++joGatheringTracker.nCountErrors;
                    if( "error" in joOut && "message" in joOut.error ) {
                        const strErrorMessage =
                            strLogPrefix + cc.fatal( "Wallet CRITICAL ERROR:" ) + " " +
                            cc.error( "S-Chain node " ) + strNodeDescColorized +
                            cc.error( " reported wallet error: " ) + cc.warning( joOut.error.message ) + "\n";
                        log.write( strErrorMessage );
                        details.write( strErrorMessage );
                    } else {
                        const strErrorMessage =
                            strLogPrefix + cc.fatal( "Wallet CRITICAL ERROR:" ) + " " +
                            cc.error( "JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                            cc.error( " failed with " ) + cc.warning( "unknown wallet error" ) + "\n";
                        log.write( strErrorMessage );
                        details.write( strErrorMessage );
                    }
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
                            if( perform_bls_verify_i( details, strDirection, nZeroBasedNodeIndex, joResultFromNode, jarrMessages, joPublicKey ) ) {
                                details.write( strLogPrefixA + cc.success( "Got successful BLS verification result for node " ) + cc.info( joNode.nodeID ) + cc.success( " with index " ) + cc.info( nZeroBasedNodeIndex ) + "\n" );
                                bNodeSignatureOKay = true; // node verification passed
                            } else {
                                const strError = "BLS verify failed";
                                details.write( strLogPrefixA + cc.fatal( "CRITICAL ERROR:" ) + " " + cc.error( strError ) + "\n" );
                            }
                        } catch ( err ) {
                            const strErrorMessage =
                                strLogPrefixA + cc.error( "S-Chain node " ) + strNodeDescColorized + cc.error( " sign " ) +
                                cc.error( " CRITICAL ERROR:" ) + cc.error( " partial signature fail from with index " ) + cc.info( nZeroBasedNodeIndex ) +
                                cc.error( ", error is " ) + cc.warning( err.toString() ) + "\n";
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
                    ++nCountErrors;
                    const strErrorMessage =
                        strLogPrefix + cc.error( "S-Chain node " ) + strNodeDescColorized + " " + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " signature fail from node " ) + cc.info( joNode.nodeID ) +
                        cc.error( ", error is " ) + cc.warning( err.toString() ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                }
            } ); // joCall.call ...
        } ); // rpcCall.create ...
    }

    log.write( strLogPrefix + cc.debug( "Waiting for BLS glue result " ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Waiting for BLS glue result " ) + "\n" );
    const promise_gathering_complete = new Promise( ( resolve, reject ) => {
        const iv = setInterval( async function() {
            ++ joGatheringTracker.nWaitIntervalStepsDone;
            const cntSuccess = joGatheringTracker.nCountReceived - joGatheringTracker.nCountErrors;
            if( cntSuccess >= nCountOfBlsPartsToCollect ) {
                const strLogPrefixB = cc.bright( strDirection ) + cc.debug( "/" ) + cc.info( "BLS" ) + cc.debug( "/" ) + cc.sunny( "Summary" ) + cc.debug( ":" ) + " ";
                clearInterval( iv );
                let strError = null, strSuccessfulResultDescription = null;
                const joGlueResult = perform_bls_glue( details, strDirection, jarrMessages, arrSignResults );
                if( joGlueResult ) {
                    details.write( strLogPrefixB + cc.success( "Got BLS glue result: " ) + cc.j( joGlueResult ) + "\n" );
                    if( imaState.strPathBlsVerify.length > 0 ) {
                        const joCommonPublicKey = discover_common_public_key( imaState.joSChainNetworkInfo );
                        // console.log(joCommonPublicKey);
                        if( perform_bls_verify( details, strDirection, joGlueResult, jarrMessages, joCommonPublicKey ) ) {
                            strSuccessfulResultDescription = "Got successful summary BLS verification result";
                            details.write( strLogPrefixB + cc.success( strSuccessfulResultDescription ) + "\n" );
                            // resolve( strSuccessfulResultDescription );
                        } else {
                            strError = "BLS verify failed";
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
                await fn( strError, jarrMessages, joGlueResult ).catch( ( err ) => {
                    const strErrorMessage = cc.error( "Problem(2) in BLS sign result handler: " ) + cc.warning( err ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    reject( new Error( strErrorMessage ) );
                } );
                bHaveResultReportCalled = true;
                if( ! strError )
                    resolve( strSuccessfulResultDescription );
                else
                    reject( new Error( strError ) );
                return;
            }
            if( joGatheringTracker.nCountReceived >= jarrNodes.length ) {
                clearInterval( iv );
                await fn( "signature error in " + joGatheringTracker.nCountErrors + " node(s) of " + jarrNodes.length + " node(s)", jarrMessages, null ).catch( ( err ) => {
                    const strErrorMessage =
                        cc.error( "Problem(3) in BLS sign result handler, not enough successful BLS signature parts(" ) +
                        cc.info( cntSuccess ) + cc.error( " when all attempts done, error details: " ) + cc.warning( err ) +
                        "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    reject( new Error( strErrorMessage ) );
                } );
                bHaveResultReportCalled = true;
                return;
            }
            if( joGatheringTracker.nWaitIntervalStepsDone >= joGatheringTracker.nWaitIntervalMaxSteps ) {
                clearInterval( iv );
                await fn( "signature error in " + joGatheringTracker.nCountErrors + " node(s) of " + jarrNodes.length + " node(s)", jarrMessages, null ).catch( ( err ) => {
                    const strErrorMessage =
                        cc.error( "Problem(4) in BLS sign result handler, not enough successful BLS signature parts(" ) +
                        cc.info( cntSuccess ) + cc.error( ") and timeout reached, error details: " ) +
                        cc.warning( err ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    reject( new Error( strErrorMessage ) );
                } );
                bHaveResultReportCalled = true;
                return;
            }
        }, joGatheringTracker.nWaitIntervalStepMilliseconds );
    } );
    details.write( cc.info( "Will await BLS sign result..." ) + "\n" );
    log.write( cc.info( "Will await BLS sign result..." ) + "\n" );
    await Promise.all( [ promise_gathering_complete ] ).then( strSuccessfulResultDescription => {
        const strLogMessage = cc.success( "BLS sign result await finished with: " ) + cc.info( strSuccessfulResultDescription ) + "\n";
        details.write( strLogMessage );
        log.write( strLogMessage );
    } ).catch( async err => {
        const strErrorMessage = cc.error( "Failed BLS sign result awaiting(1): " ) + cc.warning( err.toString() ) + "\n";
        log.write( strErrorMessage );
        details.write( strErrorMessage );
        if( ! bHaveResultReportCalled ) {
            bHaveResultReportCalled = true;
            await fn( "Failed to gather BLS signatures in " + jarrNodes.length + " node(s), trakcer data is: " + JSON.stringify( joGatheringTracker ), jarrMessages, null ).catch( ( err ) => {
                const strErrorMessage =
                    cc.error( "Problem(5) in BLS sign result handler, not enough successful BLS signature parts(" ) +
                    cc.info( cntSuccess ) + cc.error( ") and timeout reached, error details: " ) +
                    cc.warning( err ) + "\n";
                log.write( strErrorMessage );
                details.write( strErrorMessage );
            } );
        }
    } );
    if( ! bHaveResultReportCalled ) {
        const strErrorMessage = cc.error( "Failed BLS sign result awaiting(2): " ) + cc.warning( err.toString() ) + "\n";
        log.write( strErrorMessage );
        details.write( strErrorMessage );
        bHaveResultReportCalled = true;
        await fn( "Failed to gather BLS signatures in " + jarrNodes.length + " node(s), trakcer data is: " + JSON.stringify( joGatheringTracker ), jarrMessages, null ).catch( ( err ) => {
            const strErrorMessage =
                cc.error( "Problem(6) in BLS sign result handler, not enough successful BLS signature parts(" ) +
                cc.info( cntSuccess ) + cc.error( ") and timeout reached, error details: " ) +
                cc.warning( err ) + "\n";
            log.write( strErrorMessage );
            details.write( strErrorMessage );
        } );
    }
}

async function do_sign_messages_m2s( jarrMessages, nIdxCurrentMsgBlockStart, details, joExtraSignOpts, fn ) {
    return await do_sign_messages_impl( "M2S", jarrMessages, nIdxCurrentMsgBlockStart, details, joExtraSignOpts, fn );
}

async function do_sign_messages_s2m( jarrMessages, nIdxCurrentMsgBlockStart, details, joExtraSignOpts, fn ) {
    return await do_sign_messages_impl( "S2M", jarrMessages, nIdxCurrentMsgBlockStart, details, joExtraSignOpts, fn );
}

async function do_sign_messages_s2s( jarrMessages, nIdxCurrentMsgBlockStart, details, joExtraSignOpts, fn ) {
    return await do_sign_messages_impl( "S2S", jarrMessages, nIdxCurrentMsgBlockStart, details, joExtraSignOpts, fn );
}

async function do_sign_u256( u256, details, fn ) {
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
        await fn( "signature error, S-Chain information was not discovered properly and BLS threshold is unknown", u256, null );
        return;
    }
    const nCountOfBlsPartsToCollect = 0 + nThreshold;
    // if( nThreshold <= 1 && nParticipants > 1 ) {
    //     details.write( strLogPrefix + cc.warning( "Minimal BLS parts number for dicovery was increased." ) + "\n" );
    //     nCountOfBlsPartsToCollect = 2;
    // }
    log.write( strLogPrefix + cc.debug( "Will collect " ) + cc.info( nCountOfBlsPartsToCollect ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Will collect " ) + cc.info( nCountOfBlsPartsToCollect ) + cc.debug( " from " ) + cc.info( jarrNodes.length ) + cc.debug( " nodes" ) + "\n" );
    for( let i = 0; i < jarrNodes.length; ++i ) {
        const joNode = jarrNodes[i];
        const strNodeURL = imaUtils.compose_schain_node_url( joNode );
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
                    cc.error( " failed, RPC call was not created, error: " ) + cc.warning( err ) + "\n";
                log.write( strErrorMessage );
                details.write( strErrorMessage );
                return;
            }
            await joCall.call( {
                method: "skale_imaBSU256",
                params: {
                    valueToSign: u256
                }
            }, function( joIn, joOut, err ) {
                ++joGatheringTracker.nCountReceived; // including errors
                if( err ) {
                    ++joGatheringTracker.nCountErrors;
                    const strErrorMessage =
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                        cc.error( " failed, RPC call reported error: " ) + cc.warning( err ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    return;
                }
                if( joOut.result == null || joOut.result == undefined || ( !typeof joOut.result == "object" ) ) {
                    ++joGatheringTracker.nCountErrors;
                    if( "error" in joOut && "message" in joOut.error ) {
                        const strErrorMessage =
                            strLogPrefix + cc.fatal( "Wallet CRITICAL ERROR:" ) + " " +
                            cc.error( "S-Chain node " ) + strNodeDescColorized +
                            cc.error( " reported wallet error: " ) + cc.warning( joOut.error.message ) + "\n";
                        log.write( strErrorMessage );
                        details.write( strErrorMessage );
                    } else {
                        const strErrorMessage =
                            strLogPrefix + cc.fatal( "Wallet CRITICAL ERROR:" ) + " " +
                            cc.error( "JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                            cc.error( " failed with " ) + cc.warning( "unknown wallet error" ) + "\n";
                        log.write( strErrorMessage );
                        details.write( strErrorMessage );
                    }
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
                                cc.error( ", error is " ) + cc.warning( err.toString() ) + "\n";
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
                    ++nCountErrors;
                    const strErrorMessage =
                        strLogPrefix + cc.error( "S-Chain node " ) + strNodeDescColorized + " " + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " signature fail from node " ) + cc.info( joNode.nodeID ) +
                        cc.error( ", error is " ) + cc.warning( err.toString() ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                }
            } ); // joCall.call ...
        } ); // rpcCall.create ...
    }

    log.write( strLogPrefix + cc.debug( "Waiting for BLS glue result " ) + "\n" );
    details.write( strLogPrefix + cc.debug( "Waiting for BLS glue result " ) + "\n" );
    const promise_gathering_complete = new Promise( ( resolve, reject ) => {
        const iv = setInterval( async function() {
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
                            // resolve( strSuccessfulResultDescription );
                        } else {
                            strError = "BLS verify failed";
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
                await fn( strError, u256, joGlueResult ).catch( ( err ) => {
                    const strErrorMessage = cc.error( "Problem(2) in BLS u256 sign result handler: " ) + cc.warning( err ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    reject( new Error( strErrorMessage ) );
                } );
                if( ! strError )
                    resolve( strSuccessfulResultDescription );
                return;
            }
            if( joGatheringTracker.nCountReceived >= jarrNodes.length ) {
                clearInterval( iv );
                await fn( "signature error in " + joGatheringTracker.nCountErrors + " node(s) of " + jarrNodes.length + " node(s)", u256, null ).catch( ( err ) => {
                    const strErrorMessage =
                        cc.error( "Problem(3) in BLS u256 sign result handler, not enough successful BLS signature parts(" ) +
                        cc.info( cntSuccess ) + cc.error( " when all attempts done, error details: " ) + cc.warning( err ) +
                        "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    reject( new Error( strErrorMessage ) );
                } );
                return;
            }
            if( joGatheringTracker.nWaitIntervalStepsDone >= joGatheringTracker.nWaitIntervalMaxSteps ) {
                clearInterval( iv );
                await fn( "signature error in " + joGatheringTracker.nCountErrors + " node(s) of " + jarrNodes.length + " node(s)", u256, null ).catch( ( err ) => {
                    const strErrorMessage =
                        cc.error( "Problem(4) in BLS u256 sign result handler, not enough successful BLS signature parts(" ) +
                        cc.info( cntSuccess ) + cc.error( ") and timeout reached, error details: " ) +
                        cc.warning( err ) + "\n";
                    log.write( strErrorMessage );
                    details.write( strErrorMessage );
                    reject( new Error( strErrorMessage ) );
                } );
                return;
            }
        }, joGatheringTracker.nWaitIntervalStepMilliseconds );
    } );
    details.write( cc.info( "Will await BLS u256 sign result..." ) + "\n" );
    log.write( cc.info( "Will await BLS u256 sign result..." ) + "\n" );
    await Promise.all( [ promise_gathering_complete ] ).then( strSuccessfulResultDescription => {
        const strLogMessage = cc.success( "BLS sign result await finished with: " ) + cc.info( strSuccessfulResultDescription ) + "\n";
        details.write( strLogMessage );
        log.write( strLogMessage );
    } ).catch( err => {
        const strErrorMessage = cc.error( "Failed BLS u256 sign result awaiting: " ) + cc.warning( err.toString() ) + "\n";
        log.write( strErrorMessage );
        details.write( strErrorMessage );
    } );
}

module.exports = {
    init: init,
    do_sign_messages_m2s: do_sign_messages_m2s,
    do_sign_messages_s2m: do_sign_messages_s2m,
    do_sign_messages_s2s: do_sign_messages_s2s,
    do_sign_u256: do_sign_u256
}; // module.exports
