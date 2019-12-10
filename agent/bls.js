const fs = require( "fs" );
const path = require( "path" );
const url = require( "url" );
const os = require( "os" );
let child_process = require( "child_process" );
let shell = require( "shelljs" );
const {  Keccak } = require( "sha3" );

let IMA = null;
let imaState = null;
let imaUtils = null;
let log = null;
let cc = null;
let rpcCall = null;
let w3mod = null;

function init( anIMA, an_imaState, an_imaUtils, a_log, a_cc, a_rpcCall ) {
    IMA = anIMA;
    w3mod = IMA.w3mod;
    imaState = an_imaState;
    imaUtils = an_imaUtils,
    log = a_log;
    cc = a_cc;
    rpcCall = a_rpcCall;
}

function discover_bls_threshold( joSChainNetworkInfo ) {
    let jarrNodes = imaState.joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++ i ) {
        let joNode = jarrNodes[ i ];
        if( "imaInfo" in joNode && typeof joNode.imaInfo == "object"
            &&  "t" in joNode.imaInfo && typeof joNode.imaInfo.t == "number"
            &&  joNode.imaInfo.t > 0
            )
            return joNode.imaInfo.t;
    }
    return -1;
}

function discover_bls_participants( joSChainNetworkInfo ) {
    let jarrNodes = imaState.joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++ i ) {
        let joNode = jarrNodes[ i ];
        if( "imaInfo" in joNode && typeof joNode.imaInfo == "object"
            &&  "n" in joNode.imaInfo && typeof joNode.imaInfo.n == "number"
            &&  joNode.imaInfo.n > 0
            )
            return joNode.imaInfo.n;
    }
    return -1;
}

function discover_public_key_by_index( nNodeIndex, joSChainNetworkInfo ) {
    let jarrNodes = imaState.joSChainNetworkInfo.network;
    let joNode = jarrNodes[ nNodeIndex ];
    if( "imaInfo" in joNode && typeof joNode.imaInfo == "object"
        &&  "insecureBLSPublicKey0" in joNode.imaInfo && typeof joNode.imaInfo.insecureBLSPublicKey0 == "string" && joNode.imaInfo.insecureBLSPublicKey0.length > 0
        &&  "insecureBLSPublicKey1" in joNode.imaInfo && typeof joNode.imaInfo.insecureBLSPublicKey1 == "string" && joNode.imaInfo.insecureBLSPublicKey1.length > 0
        &&  "insecureBLSPublicKey2" in joNode.imaInfo && typeof joNode.imaInfo.insecureBLSPublicKey2 == "string" && joNode.imaInfo.insecureBLSPublicKey2.length > 0
        &&  "insecureBLSPublicKey3" in joNode.imaInfo && typeof joNode.imaInfo.insecureBLSPublicKey3 == "string" && joNode.imaInfo.insecureBLSPublicKey3.length > 0
        )
        return {
            "insecureBLSPublicKey0": joNode.imaInfo.insecureBLSPublicKey0,
            "insecureBLSPublicKey1": joNode.imaInfo.insecureBLSPublicKey1,
            "insecureBLSPublicKey2": joNode.imaInfo.insecureBLSPublicKey2,
            "insecureBLSPublicKey3": joNode.imaInfo.insecureBLSPublicKey3
            };
    return null;
}

function discover_common_public_key( joSChainNetworkInfo ) {
    let jarrNodes = imaState.joSChainNetworkInfo.network;
    for( let i = 0; i < jarrNodes.length; ++ i ) {
        let joNode = jarrNodes[ i ];
        if( "imaInfo" in joNode && typeof joNode.imaInfo == "object"
            &&  "insecureCommonBLSPublicKey0" in joNode.imaInfo && typeof joNode.imaInfo.insecureCommonBLSPublicKey0 == "string" && joNode.imaInfo.insecureCommonBLSPublicKey0.length > 0
            &&  "insecureCommonBLSPublicKey1" in joNode.imaInfo && typeof joNode.imaInfo.insecureCommonBLSPublicKey1 == "string" && joNode.imaInfo.insecureCommonBLSPublicKey1.length > 0
            &&  "insecureCommonBLSPublicKey2" in joNode.imaInfo && typeof joNode.imaInfo.insecureCommonBLSPublicKey2 == "string" && joNode.imaInfo.insecureCommonBLSPublicKey2.length > 0
            &&  "insecureCommonBLSPublicKey3" in joNode.imaInfo && typeof joNode.imaInfo.insecureCommonBLSPublicKey3 == "string" && joNode.imaInfo.insecureCommonBLSPublicKey3.length > 0
            )
            return {
                "insecureCommonBLSPublicKey0": joNode.imaInfo.insecureCommonBLSPublicKey0,
                "insecureCommonBLSPublicKey1": joNode.imaInfo.insecureCommonBLSPublicKey1,
                "insecureCommonBLSPublicKey2": joNode.imaInfo.insecureCommonBLSPublicKey2,
                "insecureCommonBLSPublicKey3": joNode.imaInfo.insecureCommonBLSPublicKey3
                };
    }
    return null;
}

function compose_one_message_byte_sequence( joMessage ) {
    let w3 = imaState.w3_s_chain ? imaState.w3_s_chain : imaState.w3_main_net;
    if( ! w3 )
        throw new Error( "w3.utils is needed for BN operations" );
    let arrBytes = new Uint8Array();

    let bytesSender = imaUtils.hexToBytes( joMessage.sender );
    bytesSender = imaUtils.invertArrayItemsLR( bytesSender );
    bytesSender = imaUtils.bytesAlighLeftWithZeroes( bytesSender, 32 )
    bytesSender = imaUtils.invertArrayItemsLR( bytesSender );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesSender );
    //
    let bytesDestinationContract = imaUtils.hexToBytes( joMessage.destinationContract );
    bytesDestinationContract = imaUtils.invertArrayItemsLR( bytesDestinationContract );
    bytesDestinationContract = imaUtils.bytesAlighLeftWithZeroes( bytesDestinationContract, 32 )
    bytesDestinationContract = imaUtils.invertArrayItemsLR( bytesDestinationContract );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesDestinationContract );
    //
    let bytesTo = imaUtils.hexToBytes( joMessage.to );
    bytesTo = imaUtils.invertArrayItemsLR( bytesTo );
    bytesTo = imaUtils.bytesAlighLeftWithZeroes( bytesTo, 32 )
    bytesTo = imaUtils.invertArrayItemsLR( bytesTo );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesTo );
    //
    let strHexAmount = "0x" + w3.utils.toBN( joMessage.amount ).toString(16);
    let bytesAmount = imaUtils.hexToBytes( strHexAmount );
    //bytesAmount = imaUtils.invertArrayItemsLR( bytesAmount );
    bytesAmount = imaUtils.bytesAlighLeftWithZeroes( bytesAmount, 32 )
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesAmount );
    //
    let bytesData = imaUtils.hexToBytes( joMessage.data );
    bytesData = imaUtils.invertArrayItemsLR( bytesData );
    arrBytes = imaUtils.bytesConcat( arrBytes, bytesData );
    //
    return arrBytes;
}

function compose_summary_message_to_sign( jarrMessages, isHash ) {
    let arrBytes = "";
    let i = 0, cnt = jarrMessages.length;
    for( i = 0; i < cnt; ++ i ) {
        let joMessage = jarrMessages[ i ];
        let arrMessageBytes = compose_one_message_byte_sequence( joMessage );
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

function split_signature_share( signatureShare ) {
    let jarr = signatureShare.split( ":" );
    return {
        "X": jarr[0],
        "Y": jarr[1]
    };
}

function get_bls_glue_tmp_dir() {
    let strTmpDir = path.resolve( __dirname ) + "/tmp";
    shell.mkdir( "-p", strTmpDir );
    return strTmpDir;
}

function alloc_bls_tmp_action_dir() {
    let strActionDir = get_bls_glue_tmp_dir() + "/" + imaUtils.replaceAll( imaUtils.uuid(), "-", "" );
    shell.mkdir( "-p", strActionDir );
    return strActionDir;
}

function perform_bls_glue( strDirection, jarrMessages, arrSignResults ) {
    let strLogPrefix = cc.bright(strDirection) + cc.debug("/") + cc.info("BLS") + cc.debug("/") + cc.attention("Glue") + cc.debug(":") + " ";
    let joGlueResult = null;
    let jarrNodes = imaState.joSChainNetworkInfo.network;
    let nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    let nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
       log.write( strLogPrefix + cc.debug( "Original long message is ") + cc.info( compose_summary_message_to_sign( jarrMessages, false ) ) + "\n" );
    let strSummaryMessage = compose_summary_message_to_sign( jarrMessages, true );
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
       log.write( strLogPrefix + cc.debug( "Message hasn to sign is ") + cc.info( strSummaryMessage ) + "\n" );
    let strPWD = shell.pwd();
    let strActionDir = alloc_bls_tmp_action_dir();
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
       log.write( strLogPrefix + cc.debug( "perform_bls_glue will work in ") + cc.info(strActionDir) + cc.debug(" director with ") + cc.info(arrSignResults.length) + cc.debug(" sign results..." ) + "\n" );
    let fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        shell.cd( strActionDir );
        let strInput = "";
        let i = 0, cnt = arrSignResults.length;
        for( i = 0; i < cnt; ++ i ) {
            let jo = arrSignResults[ i ];
            let strPath = strActionDir + "/sign-result" + jo.index + ".json";
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "Saving " ) + cc.notice( strPath ) + cc.debug(" file..." ) + "\n" );
            imaUtils.jsonFileSave( strPath, jo );
            strInput += " --input " + strPath;
        }
        let strGlueCommand =
            imaState.strPathBlsGlue +
            " --t " + nThreshold +
            " --n " + nParticipants +
            strInput +
            " --output " + strActionDir + "/glue-result.json";
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "Will execute BLS glue command:\n" ) + cc.notice( strGlueCommand ) + "\n" );
        strOutput = child_process.execSync( strGlueCommand );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "BLS glue output is:\n" ) + cc.notice( strOutput ) + "\n" );
        joGlueResult = imaUtils.jsonFileLoad( strActionDir + "/glue-result.json" );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "BLS glue result is: " ) + cc.j( joGlueResult ) + "\n" );
        if ( "X" in joGlueResult.signature && "Y" in joGlueResult.signature ) {
            //if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.success( "BLS glue success" )  + "\n" );
            joGlueResult.hashSrc = strSummaryMessage;
            //
            //
            //
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.debug( "Computing " ) + cc.info("G1") + cc.debug(" hash point...") + "\n" );
            let strPath = strActionDir + "/hash.json";
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "Saving " ) + cc.notice( strPath ) + cc.debug(" file..." ) + "\n" );
            imaUtils.jsonFileSave( strPath, { "message": strSummaryMessage } );
            let strHasG1Command =
                imaState.strPathHashG1 +
                " --t " + nThreshold +
                " --n " + nParticipants;
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "Will execute HashG1 command:\n" ) + cc.notice( strHasG1Command ) + "\n" );
            strOutput = child_process.execSync( strHasG1Command );
            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "HashG1 output is:\n" ) + cc.notice( strOutput ) + "\n" );
            let joResultHashG1 = imaUtils.jsonFileLoad( strActionDir + "/g1.json" );
            //if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                log.write( strLogPrefix + cc.normal( "HashG1 result is: " ) + cc.j( joResultHashG1 ) + "\n" );
            //
            //
            //
            if ( "g1" in joResultHashG1 && "hint" in joResultHashG1.g1 && "hashPoint" in joResultHashG1.g1
                && "X" in joResultHashG1.g1.hashPoint && "Y" in joResultHashG1.g1.hashPoint ) {
                joGlueResult.hashPoint = joResultHashG1.g1.hashPoint;
                joGlueResult.hint = joResultHashG1.g1.hint;
            } else {
                joGlueResult = null;
                throw "malformed HashG1 result";
            }
        } else {
            joGlueResult = null;
            throw "malformed BLS glue result";
        }
        //
        // typical glue result is:
        // {
        //     "signature": {
        //         "X": "2533808148583356869465588922364792219279924240245650719832918161014673583859",
        //         "Y": "2900553917645502192745899163584745093808998719667605626180761629013549672201"
        //     }
        // }
        fnShellRestore();
    } catch( err ) {
        log.write( strLogPrefix + cc.fatal("BLS glue CRITICAL ERROR:") + cc.error( " error description is: " ) + cc.warning( err ) + "\n" );
        log.write( strLogPrefix + cc.error( "BLS glue output is:\n" ) + cc.notice( strOutput ) + "\n" );
        fnShellRestore();
        joGlueResult = null;
    }
    return joGlueResult;
}

function perform_bls_verify_i( strDirection, nZeroBasedNodeIndex, joResultFromNode, jarrMessages, joPublicKey ) {
    if( ! joResultFromNode )
        return true;
    let strLogPrefix = cc.bright(strDirection) + cc.debug("/") + cc.info("BLS") + cc.debug("/") + cc.notice("#") + cc.bright(nZeroBasedNodeIndex) + cc.debug(":") + " ";
    let nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    let nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    let strPWD = shell.pwd();
    let strActionDir = alloc_bls_tmp_action_dir();
    let fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    try {
        shell.cd( strActionDir );
        let joMsg = { "message" : compose_summary_message_to_sign( jarrMessages, true ) };
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.debug( "BLS node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.debug(" verify message " ) + cc.j( joMsg ) + cc.debug(" composed from ") + cc.j(jarrMessages) + cc.debug(" using glue ") + cc.j( joResultFromNode) + cc.debug(" and public key ") + cc.j( joPublicKey) + "\n" );
        let strSignResultFileName = strActionDir + "/sign-result" + nZeroBasedNodeIndex + ".json";
        imaUtils.jsonFileSave( strSignResultFileName, joResultFromNode );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        imaUtils.jsonFileSave( strActionDir + "/BLS_keys" + nZeroBasedNodeIndex + ".json", joPublicKey );
        let strVerifyCommand = ""
            + imaState.strPathBlsVerify
            + " --t " + nThreshold
            + " --n " + nParticipants
            + " --j " + nZeroBasedNodeIndex
            + " --input " + strSignResultFileName
            ;
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "Will execute node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.normal(" BLS verify command:\n" ) + cc.notice( strVerifyCommand ) + "\n" );
        strOutput = child_process.execSync( strVerifyCommand );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "BLS node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.normal(" verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        //if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
             log.write( strLogPrefix + cc.success( "BLS node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.success(" verify success" )  + "\n" );
        fnShellRestore();
        return true;
    } catch( err ) {
        log.write( strLogPrefix + cc.fatal("CRITICAL ERROR: BLS node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.error(" verify error:") + cc.normal( " error description is: " ) + cc.warning( err ) + "\n" );
        log.write( strLogPrefix + cc.error( "CRITICAL ERROR: BLS node ") + cc.notice("#") + cc.info(nZeroBasedNodeIndex) + cc.error(" verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        fnShellRestore();
    }
    return false;
}

function perform_bls_verify( strDirection, joGlueResult, jarrMessages, joCommonPublicKey ) {
    if( ! joGlueResult )
        return true;
    let nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    let nParticipants = discover_bls_participants( imaState.joSChainNetworkInfo );
    let strPWD = shell.pwd();
    let strActionDir = alloc_bls_tmp_action_dir();
    let fnShellRestore = function() {
        shell.cd( strPWD );
        shell.rm( "-rf", strActionDir );
    };
    let strOutput = "";
    let strLogPrefix = cc.bright(strDirection) + cc.debug("/") + cc.info("BLS") + cc.debug("/") + cc.sunny("Summary") + cc.debug(":") + " ";
    try {
        shell.cd( strActionDir );
        let joMsg = { "message" : compose_summary_message_to_sign( jarrMessages, true ) };
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.debug( "BLS/summary verify message " ) + cc.j( joMsg ) + cc.debug(" composed from ") + cc.j(jarrMessages) + cc.debug(" using glue ") + cc.j( joGlueResult) + cc.debug(" and common public key ") + cc.j( joCommonPublicKey) + "\n" );
        imaUtils.jsonFileSave( strActionDir + "/glue-result.json", joGlueResult );
        imaUtils.jsonFileSave( strActionDir + "/hash.json", joMsg );
        //let joCommonPublicKey_for_O = joCommonPublicKey;
        let joCommonPublicKey_for_O = {
            insecureCommonBLSPublicKey0: joCommonPublicKey.insecureCommonBLSPublicKey1,
            insecureCommonBLSPublicKey1: joCommonPublicKey.insecureCommonBLSPublicKey0,
            insecureCommonBLSPublicKey2: joCommonPublicKey.insecureCommonBLSPublicKey3,
            insecureCommonBLSPublicKey3: joCommonPublicKey.insecureCommonBLSPublicKey2
        };
        imaUtils.jsonFileSave( strActionDir + "/common_public_key.json", joCommonPublicKey_for_O );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "BLS common public key for verification is:\n" ) + cc.j( joCommonPublicKey ) + "\n" );
        let strVerifyCommand = ""
            + imaState.strPathBlsVerify
            + " --t " + nThreshold
            + " --n " + nParticipants
            + " --input " + "./glue-result.json"
            ;
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "Will execute BLS/summary verify command:\n" ) + cc.notice( strVerifyCommand ) + "\n" );
        strOutput = child_process.execSync( strVerifyCommand );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
            log.write( strLogPrefix + cc.normal( "BLS/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
             log.write( strLogPrefix + cc.success( "BLS/summary verify success" )  + "\n" );
        fnShellRestore();
        return true;
    } catch( err ) {
        log.write( strLogPrefix + cc.fatal("BLS/summary verify CRITICAL ERROR:") + cc.normal( " error description is: " ) + cc.warning( err ) + "\n" );
        log.write( strLogPrefix + cc.error( "BLS/summary verify output is:\n" ) + cc.notice( strOutput ) + "\n" );
        fnShellRestore();
    }
    return false;
}

async function do_sign_messages_impl( strDirection, jarrMessages, nIdxCurrentMsgBlockStart, fn ) {
    let strLogPrefix = cc.bright(strDirection) + " " + cc.info("Sign msgs:") + " ";
    fn = fn || function() {};
    if( ! ( imaState.bSignMessages && imaState.strPathBlsGlue.length > 0 && imaState.joSChainNetworkInfo ) ) {
        await fn( null, jarrMessages, null )
        return;
    }
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
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "Will sign ") + cc.info(jarrMessages.length) + cc.debug(" message(s)..." ) + "\n" );
    let nCountReceived = 0; // including errors
    let nCountErrors = 0;
    let arrSignResults = [];
    let jarrNodes = imaState.joSChainNetworkInfo.network;
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "Will query to sign ") + cc.info(jarrNodes.length) + cc.debug(" skaled node(s)..." ) + "\n" );
    let nThreshold = discover_bls_threshold( imaState.joSChainNetworkInfo );
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
        log.write( strLogPrefix + cc.debug( "Discovered BLS threshold is ") + cc.info(nThreshold) + cc.debug("." ) + "\n" );
    if( nThreshold <= 0 ) {
        await fn( "signature error, S-Chain information was not discovered properly and BLS threshold is unknown", jarrMessages, null );
        return;
    }
    if ( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
        log.write( strLogPrefix + cc.debug( "Will collect " ) + cc.info(nThreshold) + cc.debug(" from ") + cc.info(jarrNodes.length) + cc.debug("nodes") + "\n" );
    for( let i = 0; i < jarrNodes.length; ++ i ) {
        let joNode = jarrNodes[ i ];
        let strNodeURL = imaUtils.compose_schain_node_url( joNode );
        await rpcCall.create( strNodeURL, async function( joCall, err ) {
            if( err ) {
                ++ nCountReceived; // including errors
                ++ nCountErrors;
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed" ) + "\n" );
                return;
            }
            let dstChainID = "", srcChainID = "";
            if( strDirection == "M2S" ) {
                dstChainID = "" + ( imaState.strChainID_s_chain ? imaState.strChainID_s_chain : "" );
                srcChainID = "" + ( imaState.strChainID_main_net ? imaState.strChainID_main_net : "" );
            } else {
                dstChainID = "" + ( imaState.strChainID_main_net ? imaState.strChainID_main_net : "" );
                srcChainID = "" + ( imaState.strChainID_s_chain ? imaState.strChainID_s_chain : "" );
            }

            await joCall.call( {
                "method": "skale_imaVerifyAndSign",
                "params": {
                    "direction": "" + strDirection,
                    "startMessageIdx": nIdxCurrentMsgBlockStart,
                    "dstChainID": dstChainID,
                    "srcChainID": srcChainID,
                    "messages": jarrMessages
                }
            }, function( joIn, joOut, err ) {
                ++ nCountReceived; // including errors
                if( err ) {
                    ++ nCountErrors;
                    log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) + "\n" );
                    return;
                }
                if( joOut.result == null || joOut.result == undefined || ( ! typeof joOut.result == "object" ) ) {
                    ++ nCountErrors;
                    if( "error" in joOut && "message" in joOut.error )
                        log.write( strLogPrefix + cc.fatal( "Wallet CRITICAL ERROR:" )
                            + cc.error( "S-Chain reported wallet error: " ) + cc.warn( joOut.error.message ) );
                    else
                        log.write( strLogPrefix + cc.fatal( "Wallet CRITICAL ERROR:" )
                            + cc.error( "JSON RPC call to S-Chain failed with " ) + cc.warning( "unknown wallet error" ) );
                    return;
                }
                log.write( strLogPrefix + cc.normal( "Node ") + cc.info(joNode.nodeID) + cc.normal(" sign result: " )  + cc.j( joOut.result ? joOut.result : null ) + "\n" );
                try {
                    if( joOut.result.signResult.signatureShare.length > 0 && joOut.result.signResult.status == 0 ) {
                        let nZeroBasedNodeIndex = joNode.imaInfo.thisNodeIndex - 1;
                        //
                        //
                        //
                        //
                        // partial BLS verification for one participant
                        //
                        let bNodeSignatureOKay = false; // initially assume signature is wrong
                        let strLogPrefixA = cc.bright(strDirection) + cc.debug("/") + cc.info("BLS") + cc.debug("/") + cc.notice("#") + cc.bright(nZeroBasedNodeIndex) + cc.debug(":") + " ";
                        try {
                            let arrTmp = joOut.result.signResult.signatureShare.split(":");
                            let joResultFromNode = {
                                "index": "" + nZeroBasedNodeIndex,
                                "signature": {
                                    "X": arrTmp[0],
                                    "Y": arrTmp[1]
                                }
                            };
                            if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                                log.write( strLogPrefixA + cc.info( "Will verify sign result for node " ) + cc.info(nZeroBasedNodeIndex) + "\n" );
                            let joPublicKey = discover_public_key_by_index( nZeroBasedNodeIndex, imaState.joSChainNetworkInfo )
                            if( perform_bls_verify_i( strDirection, nZeroBasedNodeIndex, joResultFromNode, jarrMessages, joPublicKey ) ) {
                                //if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                                    log.write( strLogPrefixA + cc.success( "Got succerssful BLS verification result for node " ) + cc.info(joNode.nodeID) + cc.success(" with index " ) + cc.info(nZeroBasedNodeIndex) + "\n" );
                                bNodeSignatureOKay = true; // node verification passed
                            } else {
                                strError = "BLS verify failed";
                                log.write( strLogPrefixA + cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError) + "\n" );
                            }
                        } catch( err ) {
                            log.write( strLogPrefixA + cc.fatal( "Node sign CRITICAL ERROR:" ) + cc.error( " partial signature fail from node ") + cc.info(joNode.nodeID) + cc.error(" with index " ) + cc.info(nZeroBasedNodeIndex) + cc.error(", error is " ) + cc.warn(err.toString()) + "\n" );
                        }
                        //
                        //
                        //
                        //
                        //
                        //
                        //
                        // sign result for bls_glue shoild look like:
                        // {
                        //     "index": "1",
                        //     "signature": {
                        //         "X": "8184471694634630119550127539973704769190648951089883109386639469590492862134",
                        //         "Y": "4773775435244318964726085856452691379381914783621253742616578726383405809710"
                        //     }
                        // }
                        //
                        if( bNodeSignatureOKay )
                            arrSignResults.push( {
                                "index": "" + nZeroBasedNodeIndex,
                                "signature": split_signature_share( joOut.result.signResult.signatureShare ),
                                "fromNode": joNode, // extra, not needed for bls_glue
                                "signResult": joOut.result.signResult
                            } );
                        else
                            ++ nCountErrors;
                    }
                } catch( err ) {
                    ++ nCountErrors;
                    log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + cc.error( " signature fail from node ") + cc.info(joNode.nodeID) + cc.error(", error is " ) + cc.warn(err.toString()) + "\n" );
                }
            } );
        } );
    }
    let iv = setInterval( async function() {
        let cntSuccess = nCountReceived - nCountErrors;
        if( cntSuccess >= nThreshold ) {
            let strLogPrefixB = cc.bright(strDirection) + cc.debug("/") + cc.info("BLS") + cc.debug("/") + cc.sunny("Summary") + cc.debug(":") + " ";
            clearInterval( iv );
            let strError = null;
            let joGlueResult = perform_bls_glue( strDirection, jarrMessages, arrSignResults );
            if( joGlueResult ) {
                if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                    log.write( strLogPrefixB + cc.success( "Got BLS glue result: " ) + cc.j( joGlueResult ) + "\n" );
                if( imaState.strPathBlsVerify.length > 0 ) {
                    let joCommonPublicKey = discover_common_public_key( imaState.joSChainNetworkInfo );
//console.log(joCommonPublicKey);
                    if( perform_bls_verify( strDirection, joGlueResult, jarrMessages, joCommonPublicKey ) ) {
                        if ( IMA.verbose_get() >= IMA.RV_VERBOSE.info )
                            log.write( strLogPrefixB + cc.success( "Got succerssful summary BLS verification result" ) + "\n" );
                    } else {
                        strError = "BLS verify failed";
                        log.write( strLogPrefixB + cc.fatal( "CRITICAL ERROR:" ) + cc.error( strError ) + "\n" );
                    }
                }
            } else {
                strError = "BLS glue failed";
                log.write( strLogPrefixB + cc.fatal( "CRITICAL ERROR:" ) + " " + cc.error( strError ) + "\n" );
            }
            await fn( strError, jarrMessages, joGlueResult );
            return;
        }
        if( nCountReceived >= jarrNodes.length ) {
            clearInterval( iv );
            await fn( "signature error in " + nCountErrors + " node(s) of " + jarrNodes.length + " node(s)", jarrMessages, null );
            return;
        }
    }, 100 );
}

async function do_sign_messages_m2s( jarrMessages, nIdxCurrentMsgBlockStart, fn ) {
    return await do_sign_messages_impl( "M2S", jarrMessages, nIdxCurrentMsgBlockStart, fn );
}

async function do_sign_messages_s2m( jarrMessages, nIdxCurrentMsgBlockStart, fn ) {
    return await do_sign_messages_impl( "S2M", jarrMessages, nIdxCurrentMsgBlockStart, fn );
}

module.exports = {
    "init": init,
    "do_sign_messages_m2s": do_sign_messages_m2s,
    "do_sign_messages_s2m": do_sign_messages_s2m
}; // module.exports
