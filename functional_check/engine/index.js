let fs = require( "fs" );
let path = require( "path" );
const os = require( "os" );
let child_process = require( "child_process" );
const fkill = require( "fkill" );
const url = require( "url" );

const cc = require( "./cc.js" );
const log = require( "./log.js" );
cc.enable( true );
log.addStdout();

const rpc = require( "./rpc-call.js" );
rpc.init( cc, log );

const g_w3mod = require( "web3" );
let ethereumjs_tx = require( "ethereumjs-tx" );
let ethereumjs_wallet = require( "ethereumjs-wallet" );
let ethereumjs_util = require( "ethereumjs-util" );

process.env[ "NODE_TLS_REJECT_UNAUTHORIZED" ] = 0; // allow self-signed wss and https
const g_strRecommendedShellPATH = "$PATH:/usr/local/bin/:/bin/:/usr/bin/"; // "$PATH:/bin/:/usr/bin/:/usr/local/bin/"

let g_bVerbose = true;

let g_bExternalMN = true; // set to true to run Min Net manually outside this test
let g_bExternalSC = true; // set to true to run S-Chain manually outside this test
let g_bExternalIMA = false; // set to true to run S-Chain manually outside this test
let g_bPredeployedIMA = false;
let g_bAskExternalStartStopMN = false;
let g_bAskExternalStartStopSC = false;
let g_bAskExternalStartStopIMA = false;
let g_bAskToFinishTest = true;

// owner
let g_strPrivateKeySkaleManagerMN = "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC"; // address 0x7aa5E36AA15E93D10F4F26357C30F052DacDde5F
// let g_strPrivateKeySkaleManagerMN = "4011b9f2b53a7c372f61e5aabc699c036b7e90e3c4158d6d83ea22bb1c287b36"; // address 0xca8489dB50A548eC85eBD4A0E11a9D61cB508540

// chain names, IDs, etc
let g_strMainnetName = "Mainnet";
let g_strSChainName = "Bob";
let cid_main_net = -4;
let cid_s_chain = 0x01;

let g_chainIdMN = -4;
let g_chainIdSC = 0x01;
let g_strMainNetURL = "http://127.0.0.1:8545";

let g_strPrivateKeyImaMN = "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC"; // address 0x7aa5E36AA15E93D10F4F26357C30F052DacDde5F
let g_strPrivateKeyImaSC = "80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e"; // address 0x66c5a87f4a49DD75e970055A265E8dd5C3F8f852
let g_strNetworkNameMN = "mainnet";
let g_strNetworkNameSC = "schain";

let g_strUrlSgxWalletHTTP  = "http://45.76.36.246:1027"; // "https://127.0.0.1:1027";
let g_strUrlSgxWalletHTTPS = "https://45.76.36.246:1026"; // "https://127.0.0.1:1026";
let g_strPathForSgxSslData = __dirname + "/create_pems";
let g_joSgxRpcOptions = {
    //"ca":     fs.readFileSync( g_strPathForSgxSslData + "/rootCA.pem", "utf8" ) // joCall.strPathCertFile ? fs.readFileSync( joCall.strPathCertFile ) : null
    //,
     "cert": fs.readFileSync( g_strPathForSgxSslData + "/client.crt", "utf8" )
    , "key":  fs.readFileSync( g_strPathForSgxSslData + "/k.key",      "utf8" )
}

let g_w3_main_net = null;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function wait_ENTER_key_press_on_console() {
    child_process.spawnSync( "read _ ", { shell: true, stdio: [ 0, 1, 2 ] } );
}

let g_bInsideEndOfTest = false;
async function end_of_test( nExitCode ) {
    if( g_bInsideEndOfTest )
        throw "Already in test finish handler";
    g_bInsideEndOfTest = true;
    if( g_bVerbose ) {
        let s = ( nExitCode == 0 ) ? cc.success( "Successful end of test" ) : ( cc.error( "Failure end of test, exit code is " ) + cc.warning(nExitCode) );
        log.write( "\n\n" + s + "\n\n" );
    }
    //
    //
    if( g_bAskToFinishTest ) {
        log.write( "\n\n" + cc.normal( "Press " ) + cc.attention( "<ENTER>" ) + cc.normal( " to finish test...") + "\n" );
        wait_ENTER_key_press_on_console();
    }
    log.write( cc.normal( "Finishing test...") + "\n" );
    //
    //
    let fnProtected = async function( fnExec ) {
        try {
            await fnExec();
        } catch( err ) {
            log.write( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Exception while finishing test: " ) + cc.warn( err.message ) + "\n" );
        }
    }
    await fnProtected( async function() { await all_ima_agents_stop(); } );
    await fnProtected( async function() { await all_skaled_nodes_stop(); } );
    await fnProtected( async function() { await mainnet_stop(); } );
    log.write( cc.normal( "Exiting test...") + "\n" );
    process.exit( nExitCode );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function zeroPad( num, places ) {
    var zero = places - num.toString().length + 1;
    return Array( +( zero > 0 && zero ) ).join( "0" ) + num;
}

function normalizePath( strPath ) {
    strPath = strPath.replace( /^~/, os.homedir() );
    strPath = path.normalize( strPath );
    strPath = path.resolve( strPath );
    return strPath;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let g_strFolderMultiNodeDeployment = normalizePath( __dirname + "/../s_chain_gen" );
if( g_bVerbose )
    log.write( cc.normal( "Assuming " ) + cc.sunny( "Multi Node Deployment" ) + cc.normal( " is located at " ) + cc.info( g_strFolderMultiNodeDeployment ) + "\n" );

let g_strFolderRepoIMA = normalizePath( __dirname + "/../.." );
if( g_bVerbose )
    log.write( cc.normal( "Assuming " ) + cc.sunny( "IMA" ) + cc.normal( " repo is " ) + cc.info( g_strFolderRepoIMA ) + "\n" );
let g_strFolderImaProxy = g_strFolderRepoIMA + "/proxy";
let g_strFolderImaAgent = g_strFolderRepoIMA + "/agent";
// IMA ABIs    
let g_strPathImaAbiMN = g_strFolderImaProxy + "/data/proxyMainnet.json";
let g_strPathImaAbiSC = g_bPredeployedIMA
    ? g_strFolderImaProxy + "/data/precompiled.json.file"
    : g_strFolderImaProxy + "/data/proxySchain_" + g_strSChainName + ".json"
    ;

let g_strFolderAppCache = g_strFolderRepoIMA + "/functional_check/app_cache";

let g_arrNodeDescriptions = [
    initNodeDescription( "http://127.0.0.1:15000", 0, 1112 ) // same as cat "Aldo"
    , initNodeDescription( "http://127.0.0.2:15100", 1, 1113 ) // same as cat "Bear"
];
let g_joChainEventInfoSM = null;
let g_arrAssignedNodeIndices = [];
let g_mapEvBroadcastAndKeyShare = {}; // assigned node index (BroadcastAndKeyShare.fromNode) -> data of BroadcastAndKeyShare event
let g_nThreshold = 0 + g_arrNodeDescriptions.length;

function getWeb3FromURL( strURL ) {
    let w3 = null;
    try {
        let u = cc.safeURL( strURL );
        let strProtocol = u.protocol.trim().toLowerCase().replace( ":", "" ).replace( "/", "" );
        if( strProtocol == "ws" || strProtocol == "wss" ) {
            let w3ws = new g_w3mod.providers.WebsocketProvider( strURL );
            w3 = new g_w3mod( w3ws );
        } else {
            let w3http = new g_w3mod.providers.HttpProvider( strURL );
            w3 = new g_w3mod( w3http );
        }
    } catch ( err ) {
        log.write( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Failed to create " ) +
            cc.attention( "Web3" ) + cc.error( " connection to " ) + cc.info( strURL ) +
            cc.error( ": " ) + cc.warn( err.message ) + "\n" );
        w3 = null;
    }
    return w3;
}

function getNonEmptyString( s, defVal ) {
    if( s != null && s != undefined && typeof s == "string" && s.length > 0 )
        return s;
    return defVal;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class ProcessController {
    constructor( strCommand, arrArgs, strLogPath, nListeningPort, cwd ) {
        this.strCommand = strCommand ? "" + strCommand : "";
        this.strColorizedProcessDescription = cc.notice("\"") + cc.note(this.strCommand) + cc.notice("\"");
        this.arrArgs = arrArgs || [];
        this.strLogPath = strLogPath ? "" + strLogPath : "";
        this.nListeningPort = nListeningPort ? ( 0 + parseInt(nListeningPort) ) : null;
        this.cwd = cwd ? cwd : null;
        this.pidCached = null
        this.child = null;
        this.detachedPID = null;
    }
    async stop( sig ) {
        let self = this;
        if( self.pidCached != null ) {
            if( g_bVerbose )
                log.write( cc.debug("will kill contained pid ") + cc.info(self.pidCached) + cc.debug(" of process ") + cc.normal(self.strCommand) + "\n" );
            //if( self.child )
            //  self.child.kill( sig ? sig : "SIGKILL" ); // "SIGHUP"
            try { await fkill( self.pidCached ); } catch( err ) { }
            if( this.nListeningPort != null ) {
                if( g_bVerbose )
                    log.write( cc.debug("will kill process(es) listening on port ") + cc.info(this.nListeningPort) + "\n" );
                try { await fkill( ":" + this.nListeningPort ); } catch( err ) { }
            }
            self.child = null;
            self.pidCached = null;
        }
        if( this.detachedPID ) {
            if( g_bVerbose )
                log.write( cc.debug("will kill detached pid ") + cc.info(self.pidCached) + cc.debug(" of process ") + cc.normal(self.strCommand) + "\n" );
            try { await fkill( self.detachedPID ); } catch( err ) { }
            self.detachedPID = null;
        }
        self.strColorizedProcessDescription = cc.notice("\"") + cc.note(self.strCommand) + cc.notice("\"");
    }
    continueDetached() {
        if( ! this.child )
            return;
        if( g_bVerbose )
            log.write( cc.attention("will detach process ") + this.strColorizedProcessDescription + cc.attention("...") + "\n" );
        this.detachedPID = this.pidCached;
        this.child.unref();
        this.child = null;
    }
    run() {
        let self = this;
        self.stop();
        let cwd = this.cwd ? this.cwd : path.dirname( self.strCommand );
        if( ! cwd )
            cwd = __dirname;
        if( g_bVerbose )
            log.write( cc.attention("will start process ") + self.strColorizedProcessDescription + cc.attention(" in cwd ") + cc.normal(cwd) + cc.attention("...") + "\n" );
        let bRedirectProcessOutputStreamsToLog = false, bIsDetached = false;
        let stdio_option = "inherit";
        if( this.strLogPath == "" || this.strLogPath == "inherit" ) {
            stdio_option = "inherit";
            bRedirectProcessOutputStreamsToLog = false;
        } else if( this.strLogPath == "ignore" ) {
            stdio_option = [ "ignore", "ignore", "ignore" ];
            bRedirectProcessOutputStreamsToLog = false;
        } else if( this.strLogPath == "detached" ) {
            stdio_option = [ "ignore", "ignore", "ignore" ];
            bRedirectProcessOutputStreamsToLog = false;
            bIsDetached = true;
        } else if( this.strLogPath == "output" ) {
            stdio_option = [ process.stdin, process.stdout, process.stderr ];
            bRedirectProcessOutputStreamsToLog = false;
        } else {
            stdio_option = [ 0, 1, 2 ];
            bRedirectProcessOutputStreamsToLog = true;
        }
        self.child = child_process.spawn(
            "" + self.strCommand
            , [] // args
            , { // options
                "cwd": cwd
                , "detached": bIsDetached
                , "shell": true
                , "env": {
                    "PATH": g_strRecommendedShellPATH
                    , "NO_ULIMIT_CHECK": 1
                    , "stdio": stdio_option // stdio_option // "inherit" // [ "ignore", "ignore", "ignore" ] // [ 0, 1, 2 ]
                }
            }
            );
        self.pidCached = 0 + self.child.pid;
        self.strColorizedProcessDescription = cc.sunny(self.pidCached) + cc.bright("/") + self.strColorizedProcessDescription;
        if( g_bVerbose )
            log.write( cc.attention("Did started process ") + self.strColorizedProcessDescription + "\n" );
        //
        // The 'close' event is emitted when the stdio streams of a child process have been closed.
        // This is distinct from the 'exit' event, since multiple processes might share the same stdio streams.
        self.child.on( "close", function( code ) {
            log.write( cc.warn("Process ") + self.strColorizedProcessDescription + cc.warn(" stream closed with code ") + cc.info(code) + "\n" );
            self.child = null;
        } );
        //
        // The 'exit' event is emitted after the child process ends.
        // If the process exited, code is the final exit code of the process, otherwise null.
        //  If the process terminated due to receipt of a signal, signal is the string name of the signal, otherwise null.
        // One of the two will always be non-null.
        self.child.on( "exit", function( code, signal ) {
            log.write( cc.warn("Process ") + self.strColorizedProcessDescription + cc.warn(" exited with code ") + cc.info(code) + cc.warn(" and signal ") + cc.info(signal) + "\n" );
            self.child = null;
        } );
        //
        // The 'error' event is emitted whenever:
        // - The process could not be spawned, or
        // - The process could not be killed, or
        // - Sending a message to the child process failed.
        // The 'exit' event may or may not fire after an error has occurred.
        // When listening to both the 'exit' and 'error' events, guard against accidentally invoking handler functions multiple times.
        self.child.on( "error", function( code ) {
            log.write( cc.error("Process ") + self.strColorizedProcessDescription + cc.error(" error event occurred: ") + cc.info(code) + "\n" );
            self.child = null;
        } );
        //
        // The 'disconnect' event is emitted after calling the subprocess.disconnect() method in parent process or process.disconnect() in child process.
        // After disconnecting it is no longer possible to send or receive messages, and the subprocess.connected property is false.
        self.child.on( "disconnect", function( code ) {
            log.write( cc.warn("Process ") + self.strColorizedProcessDescription + cc.warn(" did disconnected with code ") + cc.info(code) + "\n" );
            self.child = null;
        } );
        if( bRedirectProcessOutputStreamsToLog ) {
            // STDOUT
            self.child.stdout.on( "data", function( data ) {
                //console.log( `child stdout:\n${data}` );
                if( self.strLogPath.length > 0 )
                    fs.appendFile( self.strLogPath, data, function( err ) {
                        if( err ) {
                            log.write( cc.error("Process ") + self.strColorizedProcessDescription + cc.error(" STDOUT data streaming error: ") + cc.warn(err) + "\n" );
                            throw err;
                        }
                        //console.log( "STDOUT data saved:", data );
                    } );
            } );
            // STDERR
            self.child.stderr.on( "data", function( data ) {
                //console.error( `child stderr:\n${data}` );
                if( self.strLogPath.length > 0 )
                    fs.appendFile( self.strLogPath, data, function( err ) {
                        if( err ) {
                            log.write( cc.error("Process ") + self.strColorizedProcessDescription + cc.error(" STDERR data streaming error: ") + cc.warn(err) + "\n" );
                            throw err;
                        }
                        //console.log( "STDERR data saved:", data );
                    } );
            } );
        }
    }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function initNodeDescription( strURL, idxNode, nodeID, strName ) {
    let strFolderNodeSkaled = g_strFolderMultiNodeDeployment + "/node_" + zeroPad( idxNode, 2 );
    let dkgID = randomFixedInteger( 5 ) % 65000; // randomHexString( 32 * 2 );
    let joNodeDesc = {
        url: "" + strURL
        , nameNode: getNonEmptyString( strName, null )
        , idxNode: 0 + idxNode
        , nodeID: 0 + nodeID
        //
        , dkgID: dkgID
        , nameEcdsaPubKey: generateEcdsaPubKeyName()
        , nameSgxPoly: generateSgxPolyName( nodeID, dkgID )
        , publicKey: getNonEmptyString( null, null )
        , isSecretVerified: false
        , nameBlsPrivateKey: generateBlsPrivateKey( nodeID, dkgID )
        , isBlsPrivateKeyCreated: false
        , blsPublicKey: null
        , joNodeEventInfoSM: null
        , joBroadcastEventData: null
        , bSgxPassedPre: false
        , bSgxPassedPost: false
        //
        , nodeFolder: strFolderNodeSkaled
        , nodeConfigJsonPath: strFolderNodeSkaled + "/config.json"
        , runCmd4skaled: strFolderNodeSkaled + "/run-skaled.sh"
        , logPath4skaled: normalizePath( __dirname + "/skaled_" + zeroPad( idxNode, 2 ) + ".log" ) // strFolderNodeSkaled + "/skaled.log"
        , proc4scaled: null
        //
        , agentFolder: "" + g_strFolderImaAgent
        , runCmd4imaAgent: "" // initialized later by the compose_node_runCmd4imaAgent() function
        , logPath4imaAgent: normalizePath( __dirname + "/imaAgent_" + zeroPad( idxNode, 2 ) + ".log" )
        , proc4imaAgent: null
    };
    return joNodeDesc;
}

function compose_node_runCmd4imaAgent( joNodeDesc ) {
    // runCmd4imaAgent property of joNodeDesc cannot be initialized in loop that initializes all node descriptions
    // because it needs final count of nodes
    // so, we initialize it in this function
    joNodeDesc.runCmd4imaAgent =
        "node "
        + g_strFolderImaAgent + "/main.js"
        + " --verbose=9"
        + " --loop"
        + " --url-main-net=" + g_strMainNetURL // URLs
        + " --url-s-chain=" + joNodeDesc.url
        + " --id-main-net=" + g_strMainnetName // chain names
        + " --id-s-chain=" + g_strSChainName
        + " --cid-main-net=" + cid_main_net // chain IDs
        + " --cid-s-chain=" + cid_s_chain
        + " --abi-main-net=" + g_strPathImaAbiMN // ABIs
        + " --abi-s-chain=" + g_strPathImaAbiSC
        + " --key-main-net=" + g_strPrivateKeyImaMN // keys
        + " --key-s-chain=" + g_strPrivateKeyImaSC
        //
        + " --sign-messages"
        + " --bls-glue=" + g_strFolderAppCache + "/bin/bls_glue"
        + " --hash-g1=" + g_strFolderAppCache + "/bin/hash_g1"
        + " --bls-verify=" + g_strFolderAppCache + "/bin/verify_bls"
        // transfer loop parameters
        + " --m2s-transfer-block-size=" + 10 // .......Number of transactions in one block to use in money transfer loop from Main-net to S-chain
        + " --s2m-transfer-block-size=" + 10 // .......Number of transactions in one block to use in money transfer loop from S-chain to Main-net
        + " --m2s-max-transactions=" + 0 // ...........Maximal number of transactions to do in money transfer loop from Main-net to S-chain (0 is unlimited)
        + " --s2m-max-transactions=" + 0 // ...........Maximal number of transactions to do in money transfer loop from S-chain to Main-net (0 is unlimited)
        + " --m2s-await-blocks=" + 0 // ...............Maximal number of blocks to wait to appear in blockchain before transaction from Main-net to S-chain (0 is no wait)
        + " --s2m-await-blocks=" + 0 // ...............Maximal number of blocks to wait to appear in blockchain before transaction from S-chain to Main-net (0 is no wait)
        + " --m2s-await-time=" + 0 // .................Minimal age of transaction message in seconds before it will be transferred from Main-net to S-chain (0 is no wait)
        + " --s2m-await-time=" + 0 // .................Minimal age of transaction message in seconds before it will be transferred from S-chain to Main-net (0 is no wait)
        // time framing for transfer loop
        + " --period=" + 10 // ........................Transfer loop period(seconds)
        + " --node-number=" + joNodeDesc.idxNode           // ....................S-Chain node number(zero based)
        + " --nodes-count=" + g_arrNodeDescriptions.length // ....................S-Chain nodes count
        + " --time-framing=" + 60 // ..................Specifies period(in seconds) for time framing. Zero means disable time framing
        + " --time-gap=" + 10 // ......................Specifies gap(in seconds) before next time frame
    ;
    return "" + joNodeDesc.runCmd4imaAgent;
}

function generateEcdsaPubKeyName() {
    // ECDSA key are named NEK:N, where N is 32byte hexadecimal number
    let s = "NEK:" + ( randomFixedInteger( 5 ) % 65000 ); // randomHexString( 32 * 2 );
    return s;
}

function generateBlsPrivateKey( nodeID, dkgID ) {
    // BLS keys are named BLS_KEY:SCHAIN_ID:N1:NODE_ID:N2:DKG_ID:N3,
    // Where N1 and N3 are 32byte hexadecimal numbers, N2 is a decimal number in range 0 - 65000
    let s = "BLS_KEY:SCHAIN_ID:" + g_chainIdSC + ":NODE_ID:" + nodeID + ":DKG_ID:" + dkgID;
    return s;
}

function generateSgxPolyName( nodeID, dkgID ) {
    // DKG polynomials are named  POLY:SCHAIN_ID:N1:NODE_ID:N2:DKG_ID:N3,
    // Where N1 and N3 are 32byte hexadecimal numbers, N2 is a decimal number in range 0 - 65000
    let s = "POLY:SCHAIN_ID:" + g_chainIdSC + ":NODE_ID:" + nodeID + ":DKG_ID:" + dkgID;
    return s;
}

function initContract( w3, joABI, strContractName ) {
    if( strContractName == null || strContractName == undefined || typeof strContractName != "string" || strContractName.length == 0 )
        throw new Error( "Bad contract name \"" + strContractName + "\"" );
    if( w3 == null || w3 == undefined || typeof w3 != "object" )
        throw new Error( "Bad Web3 provided to load contract \"" + strContractName + "\"" );
    if( joABI == null || joABI == undefined || typeof joABI != "object" )
        throw new Error( "Bad ABI JSON provided to load contract \"" + strContractName + "\"" );
    let strKeyABI = "" + strContractName + "_abi";
    let strKeyAddress = "" + strContractName + "_address";
    if( !strKeyABI in joABI )
        throw new Error( "Failed to load contract \"" + strContractName + "\", no ABI entry found" );
    if( !strKeyAddress in joABI )
        throw new Error( "Failed to load contract \"" + strContractName + "\", no address entry found" );
    let joEntryABI = joABI[ strKeyABI ];
    let strAddress = joABI[ strKeyAddress ];
    let joContract = new w3.eth.Contract( joEntryABI, strAddress );
    if( g_bVerbose )
        log.write( cc.normal( "Loaded " ) + cc.info( strContractName ) + cc.normal( " contract with address " ) + cc.info( joContract.options.address ) + "\n" );
    return joContract;
}

function toHex( w3, d, pad ) {
    if( pad == undefined || pad == null || parseInt( pad ) <= 0 )
        pad = 64;
    if( typeof d == "array" || typeof d == "object" ) {
        let s = "";
        for( let i = 0; i < d.length; ++i )
            s += toHex( w3, d[ i ] );
        return s;
    }
    let h = w3.utils.toHex( d );
    let s = h.toString()
    if( s.length >= 2 && s.substr( 0, 2 ).toLowerCase() == "0x" )
        s = s.substr( 2, s.length - 2 );
    while( s.length < pad )
        s = "0" + s;
    return s;
}

function toHexArr( w3, d, pad ) {
    if( typeof d == "array" || typeof d == "object" ) {
        let arr = [];
        for( let i = 0; i < d.length; ++i )
            arr.push( toHex( w3, d[ i ], pad ) );
        return arr;
    }
    return toHex( w3, d, pad );
}

function nodeItemDesc( joNodeDesc ) {
    let s = cc.sunny( joNodeDesc.nNodeIndex ) + cc.normal( "/" ) +
        cc.bright( joNodeDesc.nameNode ) + cc.normal( "/" ) +
        cc.success( joNodeDesc.nameSgxPoly ) + cc.normal( "/" ) +
        cc.attention( joNodeDesc.nameEcdsaPubKey );
    return s;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function fileExists( strPath ) {
    try {
        if( fs.existsSync( strPath ) ) {
            var stats = fs.statSync( strPath );
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
        let s = fs.readFileSync( strPath );
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
            log.write( cc.error( "Cannot load JSON file " ) + cc.info( strPath ) + cc.normal( ", it does not exist" ) + "\n" );
        return joDefault;
    }
    try {
        let s = fs.readFileSync( strPath );
        if( bLogOutput )
            log.write( cc.normal( "Did loaded content of JSON file " ) + cc.info( strPath ) + cc.normal( ", will parse it..." ) + "\n" );
        let jo = JSON.parse( s );
        if( bLogOutput )
            log.write( cc.success( "Done, loaded content of JSON file " ) + cc.info( strPath ) + cc.success( "." ) + "\n" );
        return jo;
    } catch ( err ) {
        if( bLogOutput )
            log.write( cc.fatal( "Error:" ) + cc.error( " failed to load JSON file " ) + cc.info( strPath ) + cc.error( ": " ) + cc.j( err ) + "\n" );
    }
    return joDefault;
}

function jsonFileSave( strPath, jo, bLogOutput ) {
    if( bLogOutput == undefined || bLogOutput == null )
        bLogOutput = false;
    if( bLogOutput )
        log.write( cc.normal( "Will save JSON file " ) + cc.info( strPath ) + cc.normal( "..." ) + "\n" );
    try {
        let s = JSON.stringify( jo, null, 4 );
        fs.writeFileSync( strPath, s );
        if( bLogOutput )
            log.write( cc.success( "Done, saved content of JSON file " ) + cc.info( strPath ) + cc.success( "." ) + "\n" );
        return true;
    } catch ( err ) {
        if( bLogOutput )
            log.write( cc.fatal( "Error:" ) + cc.error( " failed to save JSON file " ) + cc.info( strPath ) + cc.error( ": " ) + cc.j( err ) + "\n" );
    }
    return false;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function waitAsyncUntil( fnCondition, fnAfter, nStepTimeoutMilliseconds ) {
    fnCondition = fnCondition || function () {
        return true;
    };
    fnAfter = fnAfter || function () {};
    if( nStepTimeoutMilliseconds == null || nStepTimeoutMilliseconds == undefined || typeof nStepTimeoutMilliseconds != "number" )
        nStepTimeoutMilliseconds = 500;
    if( fnCondition() ) {
        fnAfter();
        return;
    }
    setTimeout( function () {
        waitAsyncUntil( fnCondition, fnAfter, nStepTimeoutMilliseconds );
    }, nStepTimeoutMilliseconds );
}

function randomFixedInteger( length ) {
    return Math.floor( Math.pow( 10, length - 1 ) + Math.random() * ( Math.pow( 10, length ) - Math.pow( 10, length - 1 ) - 1 ) );
}

function randomStringABC( length, arrChrs ) {
    length = parseInt( length );
    if( length <= 0 || arrChrs.length == 0 )
        return "";
    let s = "";
    for( var i = 0; i < length; ++i )
        s += arrChrs.charAt( Math.floor( Math.random() * arrChrs.length ) );
    return s;
}

function randomString( length, isABC, isDigits, isSpecChr, isPunct ) { // by default only isABC=true
    length = parseInt( length );
    if( length <= 0 )
        return "";
    isABC = ( isABC == null || isABC == undefined ) ? true : ( isABC ? true : false );
    isDigits = ( isDigits == null || isDigits == undefined ) ? false : ( isDigits ? true : false );
    isSpecChr = ( isSpecChr == null || isSpecChr == undefined ) ? false : ( isSpecChr ? true : false );
    isPunct = ( isPunct == null || isPunct == undefined ) ? false : ( isPunct ? true : false );
    let arrChrs = ""; 
    if( isABC )
        arrChrs += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    if( isDigits )
        arrChrs += "0123456789";
    if( isSpecChr )
        arrChrs += "(){}[]~!?@#$%^&*_+-='\"/\\";
    if( isPunct )
        arrChrs += ",.:;";
    if( arrChrs.length == 0 )
        return "";
    return randomStringABC( length, arrChrs );
}

function randomHexString( length ) { // length in characters, not bytes, each byte is 2 characters
    let arrChrs = "0123456789abcdef";
    return randomStringABC( length, arrChrs );
}

function replaceAll( str, find, replace ) {
    return str.replace( new RegExp( find, "g" ), replace );
}

// function fn_address_impl_( w3 ) {
//     if( this.address_ == undefined || this.address_ == null )
//         this.address_ = "" + private_key_2_account_address( w3, this.privateKey );
//     return this.address_;
// }

function ensure_starts_with_0x( s ) {
    if( s == null || s == undefined || typeof s !== "string" )
        return s;
    if( s.length < 2 )
        return "0x" + s;
    if( s[ 0 ] == "0" && s[ 1 ] == "x" )
        return s;
    return "0x" + s;
}

function remove_starting_0x( s ) {
    if( s == null || s == undefined || typeof s !== "string" )
        return s;
    if( s.length < 2 )
        return s;
    if( s[ 0 ] == "0" && s[ 1 ] == "x" )
        return s.substr( 2 );
    return s;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function private_key_2_public_key( w3, keyPrivate ) {
    if( w3 == null || w3 == undefined || keyPrivate == null || keyPrivate == undefined )
        return "";
    // get a wallet instance from a private key
    const privateKeyBuffer = ethereumjs_util.toBuffer( ensure_starts_with_0x( keyPrivate ) );
    const wallet = ethereumjs_wallet.fromPrivateKey( privateKeyBuffer );
    // get a public key
    const keyPublic = wallet.getPublicKeyString();
    return remove_starting_0x( keyPublic );
}

function public_key_2_account_address( w3, keyPublic ) {
    if( w3 == null || w3 == undefined || keyPublic == null || keyPublic == undefined )
        return "";
    const hash = w3.utils.sha3( ensure_starts_with_0x( keyPublic ) );
    const strAddress = ensure_starts_with_0x( hash.substr( hash.length - 40 ) );
    return strAddress;
}

function private_key_2_account_address( w3, keyPrivate ) {
    const keyPublic = private_key_2_public_key( w3, keyPrivate );
    const strAddress = public_key_2_account_address( w3, keyPublic );
    return strAddress;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function generateBytesForNode( port, ip, account, name ) {
    if( g_bVerbose )
        log.write( "    " + cc.normal( "Entered " ) + cc.info( "generateBytesForNode" ) + "\n" );
    let bytes = "0x01";
    let portHex = port.toString( 16 );
    while( portHex.length < 4 ) {
        portHex = "0" + portHex;
    }
    if( g_bVerbose )
        log.write( "    " + "    " + cc.notice( "portHex" ) + cc.normal( "=" ) + cc.info( portHex ) + "\n" );
    let ips = new Array( 4 );
    let index = 0;
    let num = 0;
    for( let i = 0; i < ip.length; i++ ) {
        if( ip[ i ] == "." ) {
            ips[ index ] = num.toString( 16 );
            index++;
            num = 0;
            if( ips[ index - 1 ].length == 1 ) {
                ips[ index - 1 ] = "0" + ips[ index - 1 ];
            }
        } else {
            num = num * 10 + ip.charCodeAt( i ) - 48;
        }
    }
    ips[ index ] = num.toString( 16 );
    if( ips[ index ].length == 1 ) {
        ips[ index ] = "0" + ips[ index ];
    }
    if( g_bVerbose )
        log.write( "    " + "    " + cc.notice( "account" ) + cc.normal( "=" ) + cc.info( account ) + "\n" );
    if( !account || !account.length ) {
        return;
    }
    let acc = "";
    if( account ) {
        for( let i = 0; i < 128; i++ ) {
            acc += account[ i % 40 + 2 ];
        }
    }
    if( g_bVerbose )
        log.write( "    " + "    " + cc.notice( "acc" ) + cc.normal( "=" ) + cc.info( acc ) + "\n" );
    let nonce = Math.floor( Math.random() * 65536 );
    let nonceHex = nonce.toString( 16 );
    while( nonceHex.length < 4 ) {
        nonceHex = "0" + nonceHex;
    }
    if( g_bVerbose ) {
        log.write( "    " + "    " + cc.notice( "nonceHex" ) + cc.normal( "=" ) + cc.info( nonceHex ) + "\n" );
        log.write( "    " + "    " + cc.notice( "acc.length" ) + cc.normal( "=" ) + cc.info( acc.length ) + "\n" );
    }
    let rv = bytes + portHex + nonceHex + ips[ 0 ] + ips[ 1 ] + ips[ 2 ] + ips[ 3 ] + ips[ 0 ] + ips[ 1 ] + ips[ 2 ] + ips[ 3 ] + acc + Buffer.from( name, "utf8" ).toString( "hex" );
    if( g_bVerbose ) {
        log.write( "    " + "    " + cc.notice( "rv" ) + cc.normal( "=" ) + cc.info( rv ) + "\n" );
        log.write( "    " + "    " + cc.notice( "rv.length" ) + cc.normal( "=" ) + cc.info( rv.length ) + "\n" );
    }
    return rv;
}
//0x 01 2161 935b 2c7e18d8 2c7e18d8 d1bc96aad4ab81ba84c18e115664eaab3e7f842cd1bc96aad4ab81ba84c18e11 5664eaab3e7f842cd1bc96aad4ab81ba84c18e115664eaab3e7f842cd1bc96aa 4e6f6465 39333338

function generateBytesForSchain( lifetime, typeOfSchain, name ) {
    if( g_bVerbose )
        log.write( "    " + cc.normal( "Entered " ) + cc.info( "generateBytesForSchain" ) + "\n" );
    let bytes = "0x10";
    let lifetimeHex = lifetime.toString( 16 );
    while( lifetimeHex.length < 64 ) {
        lifetimeHex = "0" + lifetimeHex;
    }
    let typeOfSchainHex = typeOfSchain.toString( 16 );
    if( typeOfSchainHex.length < 2 ) {
        typeOfSchainHex = "0" + typeOfSchainHex;
    }
    let nonce = Math.floor( Math.random() * 65536 );
    let nonceHex = nonce.toString( 16 );
    while( nonceHex.length < 4 ) {
        nonceHex = "0" + nonceHex;
    }
    let data = bytes + lifetimeHex + typeOfSchainHex + nonceHex + Buffer.from( name, "utf8" ).toString( "hex" );
    if( g_bVerbose ) {
        log.write( "    " + "    " + cc.notice( "bytes" ) + cc.normal( "=" ) + cc.info( bytes ) + "\n" );
        log.write( "    " + "    " + cc.notice( "bytes.length" ) + cc.normal( "=" ) + cc.info( bytes.length ) + "\n" );
        log.write( "    " + "    " + cc.notice( "lifetimeHex" ) + cc.normal( "=" ) + cc.info( lifetimeHex ) + "\n" );
        log.write( "    " + "    " + cc.notice( "lifetimeHex.length" ) + cc.normal( "=" ) + cc.info( lifetimeHex.length ) + "\n" );
        log.write( "    " + "    " + cc.notice( "nonceHex" ) + cc.normal( "=" ) + cc.info( nonceHex ) + "\n" );
        log.write( "    " + "    " + cc.notice( "nonceHex.length" ) + cc.normal( "=" ) + cc.info( nonceHex.length ) + "\n" );
        log.write( "    " + "    " + cc.notice( "typeOfSchainHex" ) + cc.normal( "=" ) + cc.info( typeOfSchainHex ) + "\n" );
        log.write( "    " + "    " + cc.notice( "typeOfSchainHex.length" ) + cc.normal( "=" ) + cc.info( typeOfSchainHex.length ) + "\n" );
        log.write( "    " + "    " + cc.notice( "data" ) + cc.normal( "=" ) + cc.info( data ) + "\n" );
        log.write( "    " + "    " + cc.notice( "data.length" ) + cc.normal( "=" ) + cc.info( data.length ) + "\n" );
    }
    return data;
}
``
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function generateRandomIP() {
    let ip1 = Math.floor( Math.random() * 255 );
    let ip2 = Math.floor( Math.random() * 255 );
    let ip3 = Math.floor( Math.random() * 255 );
    let ip4 = Math.floor( Math.random() * 255 );
    return "" + ip1 + "." + ip2 + "." + ip3 + "." + ip4 + "";
}

function generateRandomName() {
    let number = Math.floor( Math.random() * 100000 );
    return "Node" + number;
}

async function createNode( w3, name, ip, port, privateKey ) {
    name = ( name != null && name != undefined && typeof name == "string" && name.length > 0 ) ? name : generateRandomName();
    ip = ( ip != null && ip != undefined && typeof ip == "string" && ip.length > 0 ) ? ip : generateRandomIP();
    port = ( port != null && port != undefined ) ? parseInt( port ) : 8545;
    let addressFrom = private_key_2_account_address( w3, privateKey );
    let publicKey = private_key_2_public_key( w3, privateKey );
    // privateKey
    if( g_bVerbose )
        log.write( cc.normal( "Entered " ) + cc.info( "createNode" ) +
            cc.normal( ", " ) + cc.notice( "name" ) + cc.normal( "=" ) + cc.info( name ) +
            cc.normal( ", " ) + cc.notice( "ip" ) + cc.normal( "=" ) + cc.info( ip ) +
            cc.normal( ", " ) + cc.notice( "port" ) + cc.normal( "=" ) + cc.info( port ) +
            cc.normal( ", " ) + cc.notice( "addressFrom" ) + cc.normal( "=" ) + cc.info( addressFrom ) +
            cc.normal( ", " ) + cc.notice( "privateKey" ) + cc.normal( "=" ) + cc.info( privateKey ) +
            cc.normal( ", " ) + cc.notice( "publicKey" ) + cc.normal( "=" ) + cc.info( publicKey ) +
            "\n" );
    let k = await jo_nodes_data.methods.nodesNameCheck( w3.utils.soliditySha3( name ) ).call();
    if( g_bVerbose )
        log.write( "    " + cc.notice( "k" ) + cc.normal( "=" ) + cc.info( k ) + "\n" );
    while( k ) {
        name = generateRandomName();
        k = await jo_nodes_data.methods.nodesNameCheck( w3.utils.soliditySha3( name ) ).call();
        if( g_bVerbose )
            log.write( "    " + cc.notice( "k" ) + cc.normal( "=" ) + cc.info( k ) + "\n" );
    }
    let data = generateBytesForNode( port, ip, publicKey, name );
    if( g_bVerbose ) {
        log.write( "    " + cc.notice( "data" ) + cc.normal( "=" ) + cc.info( data ) + "\n" );
        log.write( "    " + cc.notice( "data.length" ) + cc.normal( "=" ) + cc.info( data.length ) + "\n" );
    }
    let nonce = parseInt( data.slice( 8, 12 ), 16 );
    if( g_bVerbose )
        log.write( "    " + cc.notice( "nonce" ) + cc.normal( "=" ) + cc.info( nonce ) + "\n" );
    let deposit = 100000000000000000000;
    let accountDeposit = await jo_skale_token.methods.balanceOf( addressFrom ).call( {
        "from": addressFrom
    } );
    let transfer_amount = w3.utils.toBN( 100000000000000000000 ).toString();
    if( g_bVerbose ) {
        log.write( "    " + cc.notice( "account" ) + cc.normal( " is " ) + cc.info( addressFrom ) + "\n" );
        log.write( "    " + cc.notice( "data" ) + cc.normal( "=" ) + cc.info( data ) + "\n" );
        log.write( "    " + cc.notice( "data.length" ) + cc.normal( "=" ) + cc.info( data.length ) + "\n" );
        log.write( "    " + cc.notice( "deposit" ) + cc.normal( "=" ) + cc.info( deposit ) + "\n" );
        log.write( "    " + cc.notice( "account deposit" ) + cc.normal( "=" ) + cc.info( accountDeposit ) + "\n" );
        log.write( "    " + cc.notice( "skale_token_address" ) + cc.normal( "=" ) + cc.info( jo_skale_token.options.address ) + "\n" );
        log.write( "    " + cc.normal( "Will call " ) + cc.notice( "ERC777-send()" ) + cc.normal( " with:" ) + "\n" );
        log.write( "    " + cc.notice( "address" ) + cc.normal( "=" ) + cc.info( jo_skale_manager.options.address ) + "\n" );
        log.write( "    " + cc.notice( "transfer_amount" ) + cc.normal( "=" ) + cc.info( transfer_amount ) + "\n" );
        log.write( "    " + cc.notice( "data" ) + cc.normal( "=" ) + cc.info( data ) + "\n" );
        log.write( "    " + cc.notice( "addressFrom" ) + cc.normal( "=" ) + cc.info( addressFrom ) + "\n" );
    }
    // ERC777 - function send(address recipient, uint256 amount, bytes calldata data)
    let res =
        await jo_skale_token.methods.send(
            jo_skale_manager.options.address,
            transfer_amount,
            data
        ).send( {
            "chainId": g_chainIdMN,
            "from": addressFrom,
            "gas": 8000000
        } );
    if( g_bVerbose )
        log.write( "    " + cc.notice( "res" ) + cc.normal( "=" ) + cc.j( res ) + "\n" );
    let blockNumber = res.blockNumber;
    //if ( g_bVerbose )
    //    log.write( "    " + cc.notice( "blockNumber" ) + cc.normal( "=" ) + cc.j( blockNumber ) + "\n" );
    let nodeIndex = -1;
    let joNodeEventInfoSM = null;
    arrEvents = await jo_nodes_functionality.getPastEvents( "NodeCreated", {
        "fromBlock": blockNumber,
        "toBlock": blockNumber
    } );
    for( i = 0; i < arrEvents.length; i++ ) {
        if( arrEvents[ i ].returnValues[ "nonce" ] == nonce ) {
            joNodeEventInfoSM = arrEvents[ i ];
            nodeIndex = joNodeEventInfoSM.returnValues[ "nodeIndex" ];
        }
    }
    // if ( g_bVerbose ) {
    //     arrEvents = await jo_validators_functionality.getPastEvents( "Iterations", {
    //         "fromBlock": blockNumber,
    //         "toBlock": blockNumber
    //     } );
    //     for ( i = 0; i < arrEvents.length; i++ ) {
    //         log.write( "    " + cc.notice( "eventsRetValues[" ) + cc.info( i ) + cc.notice( "]" ) + cc.normal( "=" ) + cc.info( events[ i ].returnValues ) + "\n" );
    //     }
    // }
    if( g_bVerbose )
        log.write( "    " + cc.normal( "Node " ) + cc.info( nodeIndex ) + cc.normal( " created with " ) + cc.info( res.gasUsed ) + cc.normal( " gas consumption, node info:" ) + cc.j( joNodeEventInfoSM ) + "\n" );
    return joNodeEventInfoSM;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function createSChain( w3, lifetime, typeOfSchain, name, privateKey ) {
    name = ( name != null && name != undefined && typeof name == "string" && name.length > 0 ) ? name : generateRandomName();
    lifetime = ( lifetime && typeof lifetime == "number" ) ? lifetime : 5;
    typeOfSchain = ( typeOfSchain && typeof typeOfSchain == "number" ) ? typeOfSchain : 4;
    let addressFrom = private_key_2_account_address( w3, privateKey );
    let publicKey = private_key_2_public_key( w3, privateKey );
    if( g_bVerbose )
        log.write( cc.normal( "Entered " ) + cc.info( "createSChain" ) +
            cc.normal( ", " ) + cc.notice( "name" ) + cc.normal( "=" ) + cc.info( name ) +
            cc.normal( ", " ) + cc.notice( "lifetime" ) + cc.normal( "=" ) + cc.info( lifetime ) +
            cc.normal( ", " ) + cc.notice( "typeOfSchain" ) + cc.normal( "=" ) + cc.info( typeOfSchain ) +
            cc.normal( ", " ) + cc.notice( "addressFrom" ) + cc.normal( "=" ) + cc.info( addressFrom ) +
            cc.normal( ", " ) + cc.notice( "privateKey" ) + cc.normal( "=" ) + cc.info( privateKey ) +
            cc.normal( ", " ) + cc.notice( "publicKey" ) + cc.normal( "=" ) + cc.info( publicKey ) +
            "\n" );
    let isNameAvailable = await jo_schains_data.methods.isSchainNameAvailable( name ).call();
    if( !isNameAvailable ) {
        log.write( "    " + cc.fatal( "CRITICAL ERROR:" ) + cc.error( "S-Chain name" ) + cc.warn( name ) + cc.error( " is not available" ) + "\n" );
        throw new Error( "S-CHAIN name \"" + name + "\" is not available" );
    }
    let data = generateBytesForSchain( lifetime, typeOfSchain, name );
    if( g_bVerbose ) {
        log.write( "    " + cc.notice( "data" ) + cc.normal( "=" ) + cc.info( data ) + "\n" );
        log.write( "    " + cc.notice( "data.length" ) + cc.normal( "=" ) + cc.info( data.length ) + "\n" );
    }
    // let nonce = parseInt( data.slice( 8, 12 ), 16 );
    // if ( g_bVerbose )
    //     log.write( "    " + cc.notice( "nonce" ) + cc.normal( "=" ) + cc.info( nonce ) + "\n" );
    let deposit = 100000000000000000000;
    let accountDeposit = await jo_skale_token.methods.balanceOf( addressFrom ).call( {
        "from": addressFrom
    } );
    let transfer_amount = w3.utils.toBN( 100000000000000000000 ).toString();
    if( g_bVerbose ) {
        log.write( "    " + cc.notice( "account" ) + cc.normal( " is " ) + cc.info( addressFrom ) + "\n" );
        log.write( "    " + cc.notice( "data" ) + cc.normal( "=" ) + cc.info( data ) + "\n" );
        log.write( "    " + cc.notice( "data.length" ) + cc.normal( "=" ) + cc.info( data.length ) + "\n" );
        log.write( "    " + cc.notice( "deposit" ) + cc.normal( "=" ) + cc.info( deposit ) + "\n" );
        log.write( "    " + cc.notice( "account deposit" ) + cc.normal( "=" ) + cc.info( accountDeposit ) + "\n" );
        log.write( "    " + cc.notice( "skale_token_address" ) + cc.normal( "=" ) + cc.info( jo_skale_token.options.address ) + "\n" );
        log.write( "    " + cc.normal( "Will call " ) + cc.notice( "ERC777-send()" ) + cc.normal( " with:" ) + "\n" );
        log.write( "    " + cc.notice( "address" ) + cc.normal( "=" ) + cc.info( jo_skale_manager.options.address ) + "\n" );
        log.write( "    " + cc.notice( "transfer_amount" ) + cc.normal( "=" ) + cc.info( transfer_amount ) + "\n" );
        log.write( "    " + cc.notice( "data" ) + cc.normal( "=" ) + cc.info( data ) + "\n" );
        log.write( "    " + cc.notice( "addressFrom" ) + cc.normal( "=" ) + cc.info( addressFrom ) + "\n" );
    }
    // ERC777 - function send(address recipient, uint256 amount, bytes calldata data)
    let res =
        await jo_skale_token.methods.send(
            jo_skale_manager.options.address,
            transfer_amount,
            data
        ).send( {
            "chainId": g_chainIdMN,
            "from": addressFrom,
            "gas": 8000000
        } );
    if( g_bVerbose )
        log.write( "    " + cc.notice( "res" ) + cc.normal( "=" ) + cc.j( res ) + "\n" );
    let blockNumber = res.blockNumber;
    //if ( g_bVerbose )
    //    log.write( "    " + cc.notice( "blockNumber" ) + cc.normal( "=" ) + cc.j( blockNumber ) + "\n" );
    let joChainEventInfoSM = null;
    arrEvents = await jo_schains_functionality.getPastEvents( "SchainCreated", {
        "fromBlock": blockNumber,
        "toBlock": blockNumber
    } );
    for( i = 0; i < arrEvents.length; i++ ) {
        if( arrEvents[ i ].returnValues[ "name" ] == name ) {
            joChainEventInfoSM = arrEvents[ i ];
        }
    }
    if( g_bVerbose )
        log.write( "    " + cc.success( "S-CHAIN " ) + cc.info( name ) + cc.normal( " created with " ) + cc.info( res.gasUsed ) + cc.normal( " gas consumption, chain info: " ) + cc.j( joChainEventInfoSM ) + "\n" );
    return joChainEventInfoSM;
}

async function getSChainNodeIndices( w3, strSChainName ) {
    if( g_bVerbose )
        log.write( cc.normal( "Entered " ) + cc.info( "getSChainNodeIndices" ) +
            cc.normal( ", " ) + cc.notice( "name" ) + cc.normal( "=" ) + cc.info( strSChainName ) +
            "\n" );
    let res = await jo_schains_data.methods.getNodesInGroup( w3.utils.soliditySha3( strSChainName ) ).call();
    if( g_bVerbose )
        log.write( "    " + cc.success( "S-CHAIN " ) + cc.info( strSChainName ) + cc.normal( " node indices " ) + cc.j( res ) + "\n" );
    return res;
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function setGroupPK( w3, privateKey, strSChainName, joCommonPublicKeyBLS ) {
    if( g_bVerbose )
        log.write( cc.normal( "Entered " ) + cc.info( "setGroupPK" ) +
            cc.normal( ", " ) + cc.notice( "S-CHAIN name" ) + cc.normal( "=" ) + cc.info( strSChainName ) +
            cc.normal( ", " ) + cc.notice( "privateKey" ) + cc.normal( "=" ) + cc.info( privateKey ) +
            cc.normal( ", " ) + cc.notice( "joCommonPublicKeyBLS" ) + cc.normal( "=" ) + cc.j( joCommonPublicKeyBLS ) +
            "\n" );
    let res =
        await jo_schains_data.methods.setGroupsPublicKey(
            w3.utils.soliditySha3( strSChainName ),
            joCommonPublicKeyBLS.insecureCommonBLSPublicKey0,
            joCommonPublicKeyBLS.insecureCommonBLSPublicKey1,
            joCommonPublicKeyBLS.insecureCommonBLSPublicKey2,
            joCommonPublicKeyBLS.insecureCommonBLSPublicKey3
        ).send( {
            "chainId": g_chainIdMN,
            "from": addressFrom,
            "gas": 8000000
        } );
    if( g_bVerbose )
        log.write( "    " + cc.notice( "res" ) + cc.normal( "=" ) + cc.j( res ) + "\n" );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function init_schain_node_description( w3, joNodeDesc ) {
    let nDefaultNameLength = 5;
    if( joNodeDesc.nameNode == null || joNodeDesc.nameNode == undefined || typeof joNodeDesc.nameNode != "string" || joNodeDesc.nameNode.length == 0 )
        joNodeDesc.nameNode = randomString( nDefaultNameLength );
    if( joNodeDesc.nameSgxPoly == null || joNodeDesc.nameSgxPoly == undefined || typeof joNodeDesc.nameSgxPoly != "string" || joNodeDesc.nameSgxPoly.length == 0 )
        joNodeDesc.nameSgxPoly = generateSgxPolyName( joNodeDesc.nodeID, joNodeDesc.dkgID )
    if( joNodeDesc.nameEcdsaPubKey == null || joNodeDesc.nameEcdsaPubKey == undefined || typeof joNodeDesc.nameEcdsaPubKey != "string" || joNodeDesc.nameEcdsaPubKey.length == 0 )
        joNodeDesc.nameEcdsaPubKey = generateEcdsaPubKeyName();
    if( joNodeDesc.nameBlsPrivateKey == null || joNodeDesc.nameBlsPrivateKey == undefined || typeof joNodeDesc.nameBlsPrivateKey != "string" || joNodeDesc.nameBlsPrivateKey.length == 0 )
        joNodeDesc.nameBlsPrivateKey = generateBlsPrivateKey( joNodeDesc.nodeID, joNodeDesc.dkgID );
    // joNodeDesc.publicKey = private_key_2_public_key( w3, joNodeDesc.privateKey );
    // joNodeDesc.address = private_key_2_account_address( w3, joNodeDesc.privateKey );
    joNodeDesc.arrVerificationVector = [];
    joNodeDesc.SecretShare = "";
}

function init_schain_node_descriptions( w3 ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Initializing node descriptions..." ) +
            "\n\n" );
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeDesc = g_arrNodeDescriptions[ i ];
        joNodeDesc.nNodeIndex = 0 + i;
        init_schain_node_description( w3, joNodeDesc );
        if( g_bVerbose )
            log.write( cc.normal( "Node " ) + cc.info( joNodeDesc.nNodeIndex ) + cc.normal( " is " ) + cc.j( joNodeDesc ) + "\n" );
    }
}

function get_all_public_keys_array() {
    let arr = [];
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeDesc = g_arrNodeDescriptions[ i ];
        arr.push( joNodeDesc.publicKey );
    }
    return arr;
}

function get_verification_vector_summary( w3, joNodeDesc ) {
    let vvSummary = "",
        cnt = joNodeDesc.arrVerificationVector.length;
    for( let j = 0; j < cnt; ++j ) {
        let arrPairs = joNodeDesc.arrVerificationVector[ j ];
        // log.write(
        //     cc.normal( "------------- hex pairs [" ) +
        //     cc.info( j ) + cc.normal( "/" ) + cc.info( cnt ) + cc.normal( "] of " ) +
        //     nodeItemDesc( joNodeDesc ) + cc.normal( ":  " ) + cc.j( toHexArr( w3, arrPairs ) ) +
        //     "\n" );
        vvSummary += toHex( w3, arrPairs );
    }
    // log.write(
    //     cc.normal( "------------- get_verification_vector_summary() of " ) +
    //     nodeItemDesc( joNodeDesc ) + cc.normal( ":  " ) + cc.j( vvSummary ) +
    //     "\n" );
    return vvSummary;
}

function get_verification_vector_summary_inv( w3, joNodeDesc ) {
    let vvSummary = "",
        cnt = joNodeDesc.arrVerificationVector.length;
    for( let j = 0; j < cnt; ++j ) {
        let arrPairs = joNodeDesc.arrVerificationVector[ j ];
        // log.write(
        //     cc.normal( "------------- hex pairs [" ) +
        //     cc.info( j ) + cc.normal( "/" ) + cc.info( cnt ) + cc.normal( "] of " ) +
        //     nodeItemDesc( joNodeDesc ) + cc.normal( ":  " ) + cc.j( toHexArr( w3, arrPairs ) ) +
        //     "\n" );
        vvSummary += toHex( w3, arrPairs[ 1 ] );
        vvSummary += toHex( w3, arrPairs[ 0 ] );
        vvSummary += toHex( w3, arrPairs[ 3 ] );
        vvSummary += toHex( w3, arrPairs[ 2 ] );
    }
    // log.write(
    //     cc.normal( "------------- get_verification_vector_summary_inv() of " ) +
    //     nodeItemDesc( joNodeDesc ) + cc.normal( ":  " ) + cc.j( vvSummary ) +
    //     "\n" );
    return vvSummary;
}

function sgx_do_verify_secret( w3, joNodeDescA, joNodeDescB, joCall ) {
    // joNodeDescA - who is verifier - master
    // joNodeDescB - who is verified - slave
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Performing " ) + cc.sunny( "DKG/SGX Verification" ) + cc.bright( ", master/verifier is " )
            + nodeItemDesc( joNodeDescA ) + cc.bright( ", verified slave is " ) + nodeItemDesc( joNodeDescB ) +
            cc.bright( "..." ) +
            "\n\n" );
    //let vvSummaryA = get_verification_vector_summary( w3, joNodeDescA );
    let vvSummaryB = get_verification_vector_summary( w3, joNodeDescB );
    // if( g_bVerbose )
    //     log.write( "    " + cc.normal( "Node " ) + nodeItemDesc( joNodeDescA ) +
    //         cc.normal( " summary verification vector is " ) + cc.notice( vvSummaryA ) +
    //         cc.normal( ", its length is " ) + cc.notice( vvSummaryA.length ) +
    //         "\n" );
    if( g_bVerbose )
        log.write( cc.debug("Source secret key contribution is ") + cc.notice(joNodeDescB.joBroadcastEventData.secretKeyContribution) +"\n" );
    let entire_ss = remove_starting_0x( joNodeDescB.joBroadcastEventData.secretKeyContribution );
    if( g_bVerbose )
        log.write( cc.debug("Well formed secret key contribution is ") + cc.notice(entire_ss) +"\n" );
    //let ss = joNodeDescB.SecretShare.substr( 192 * joNodeDescA.nNodeIndex, 192 );
    let ss = entire_ss.substr( 192 * joNodeDescA.nNodeIndex, 192 );
    if( g_bVerbose )
        log.write( cc.debug("Extracted part of secret key contribution is ") + cc.notice(ss) +"\n" );
    //let ss = joNodeDescB.SecretShare.substr( 192 * joNodeDescA.nNodeIndex, 192 );
    //let vvs = vvSummaryA;
    let vvs = vvSummaryB;
    let ekn = joNodeDescA.nameEcdsaPubKey;
    if( g_bVerbose ) {
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "index" ) + cc.normal( "=" ) + cc.info( joNodeDescA.nNodeIndex ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "t" ) + cc.normal( "=" ) + cc.info( g_nThreshold) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "n" ) + cc.normal( "=" ) + cc.info( g_arrNodeDescriptions.length ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "secretKeyContribution" ) + cc.normal( "=" ) + cc.info( ss ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "publicShares" ) + cc.normal( "=" ) + cc.info( vvs ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "EthKeyName" ) + cc.normal( "=" ) + cc.info( ekn ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "SecretShare" ) + cc.normal( "=" ) + cc.info( ss ) + "\n" );
        log.write( "    " + cc.normal( "Using slaves entire " ) + cc.attention( "secretKeyContribution" ) + cc.normal( "=" ) + cc.info( entire_ss ) + "\n" );
    }
    joCall.call( {
        "method": "DKGVerification", // old - "DKGVerification", new - "dkgVerification"
        "params": {
            "publicShares": vvs,
            "EthKeyName": ekn,
            "SecretShare": ss,
            "t": g_nThreshold,
            "n": g_arrNodeDescriptions.length,
            "index": joNodeDescA.nNodeIndex
        }
    }, function ( joIn, joOut, err ) {
        if( joOut != null && joOut != undefined && typeof joOut == "object" && "error" in joOut )
            err = joOut.error;
        if( err ) {
            log.write( cc.fatal( "Error:" ) + cc.error( " RPC call problem in " ) + cc.info( "sgx_do_verify_secret" ) +
                cc.error( " for master node " ) + nodeItemDesc( joNodeDescA ) +
                cc.error( " and slave node " ) + nodeItemDesc( joNodeDescB ) +
                cc.error( ", error description: " ) + cc.j( err ) + "\n" );
            end_of_test( 1100 + joNodeDescA.nNodeIndex );
        }
        if( g_bVerbose )
            log.write( cc.success( "DKG/SGX verification passed for master node " ) + nodeItemDesc( joNodeDescA ) +
                cc.success( " and slave node " ) + nodeItemDesc( joNodeDescB ) +
                "\n" );
        joNodeDescA.isSecretVerified = true;
    } );
}

function sgx_do_secret_key_contribution( w3, joNodeDesc, joCall ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Getting " ) + cc.attention( "secret key contribution" ) + cc.bright( " for node " ) + nodeItemDesc( joNodeDesc )
            + cc.bright( "..." ) +
            "\n\n" );
    joCall.call( {
        "method": "getSecretShare",
        "params": {
            "polyName": joNodeDesc.nameSgxPoly,
            "publicKeys": get_all_public_keys_array(),
            "t": g_nThreshold,
            "n": g_arrNodeDescriptions.length
        }
    }, function ( joIn, joOut, err ) {
        if( joOut != null && joOut != undefined && typeof joOut == "object" && "error" in joOut )
            err = joOut.error;
        if( err ) {
            log.write( cc.fatal( "Error:" ) + cc.error( " RPC call problem in " ) + cc.info( "sgx_do_secret_key_contribution" ) + cc.error( " for node " ) + cc.info( joNodeDesc.nNodeIndex ) + cc.error( ", error description: " ) + cc.j( err ) + "\n" );
            end_of_test( 1200 + joNodeDesc.nNodeIndex );
        }
        joNodeDesc.SecretShare = joOut.result.SecretShare;
        joNodeDesc.bSgxPassedPre = true;
        if( g_bVerbose )
            log.write( cc.normal( "Secret share " ) + nodeItemDesc( joNodeDesc ) +
                cc.normal( " was generated: " ) + cc.notice( joNodeDesc.SecretShare ) +
                "\n" );
    } );
}

function sgx_get_verification_vector( w3, joNodeDesc, joCall ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Getting " ) + cc.attention( "verification vector" ) + cc.bright( " for node " ) + nodeItemDesc( joNodeDesc )
            + cc.bright( "..." ) +
            "\n\n" );
    joCall.call( {
        "method": "getVerificationVector",
        "params": {
            "polyName": joNodeDesc.nameSgxPoly,
            "t": g_nThreshold,
            "n": g_arrNodeDescriptions.length
        }
    }, function ( joIn, joOut, err ) {
        if( joOut != null && joOut != undefined && typeof joOut == "object" && "error" in joOut )
            err = joOut.error;
        if( err ) {
            log.write( cc.fatal( "Error:" ) + cc.error( " RPC call problem in " ) + cc.info( "sgx_get_verification_vector" ) + cc.error( " for node " ) + cc.info( joNodeDesc.nNodeIndex ) + cc.error( ", error description: " ) + cc.j( err ) + "\n" );
            end_of_test( 1300 + joNodeDesc.nNodeIndex );
        }
        joNodeDesc.arrVerificationVector = joOut.result[ "Verification Vector" ];
        if( g_bVerbose )
            log.write( cc.normal( "Verification vector " ) + nodeItemDesc( joNodeDesc ) +
                cc.normal( " was generated: " ) + cc.j( joNodeDesc.arrVerificationVector ) +
                "\n" );
    } );
}

function sgx_generate_dkg_poly( w3, joNodeDesc, joCall ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Generating " ) + cc.attention( "poly" ) + cc.bright( " for node " ) + nodeItemDesc( joNodeDesc )
            + cc.bright( "..." ) +
            "\n\n" );
    joCall.call( {
        "method": "generateDKGPoly",
        "params": {
            "polyName": joNodeDesc.nameSgxPoly,
            "t": g_nThreshold
        }
    }, function ( joIn, joOut, err ) {
        if( joOut != null && joOut != undefined && typeof joOut == "object" && "error" in joOut )
            err = joOut.error;
        if( err ) {
            log.write( cc.fatal( "Error:" ) + cc.error( " RPC call problem in " ) + cc.info( "sgx_generate_dkg_poly" ) + cc.error( " for node " ) + cc.info( joNodeDesc.nNodeIndex ) + cc.error( ", error description: " ) + cc.j( err ) + "\n" );
            end_of_test( 1400 + joNodeDesc.nNodeIndex );
        }
        if( g_bVerbose )
            log.write( cc.normal( "Poly " ) + nodeItemDesc( joNodeDesc ) +
                cc.normal( " was generated" ) +
                "\n" );
        sgx_get_verification_vector( w3, joNodeDesc, joCall );
    } );
}

function sgx_generate_key( w3, joNodeDesc, joCall ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Generating " ) + cc.attention( "ECDSA key" ) + cc.bright( " for node " ) + nodeItemDesc( joNodeDesc )
            + cc.bright( "..." ) +
            "\n\n" );
    joCall.call( {
        "method": "generateECDSAKey",
        "params": {
            //"keyName": joNodeDesc.nameEcdsaPubKey
        }
    }, function ( joIn, joOut, err ) {
        if( joOut != null && joOut != undefined && typeof joOut == "object" && "error" in joOut )
            err = joOut.error;
        if( err ) {
            log.write( cc.fatal( "Error:" ) + cc.error( " RPC call problem in " ) + cc.info( "sgx_generate_key" ) + cc.error( " for node " ) + cc.info( joNodeDesc.nNodeIndex ) + cc.error( ", error description: " ) + cc.j( err ) + "\n" );
            end_of_test( 1500 + joNodeDesc.nNodeIndex );
        }
        joNodeDesc.publicKey = "" + joOut.result.PublicKey;
        joNodeDesc.nameEcdsaPubKey = "" + joOut.result.KeyName;
        if( g_bVerbose )
            log.write( cc.normal( "ECDSAKey " ) + nodeItemDesc( joNodeDesc ) +
                cc.normal( " was generated: " ) + cc.j( joOut.result ) + // cc.info( joNodeDesc.publicKey ) +
                "\n" );
    } );
}

function sgx_create_node_bls_private_key( joNodeDesc, joCall ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Creating " ) + cc.attention( "BLS private key" ) + cc.bright( " for node " ) + nodeItemDesc( joNodeDesc )
            + cc.bright( "..." ) +
            "\n\n" );
    //let ss = joNodeDesc.SecretShare;
    let ss = "";
    for( i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeWalk = g_arrNodeDescriptions[ i ];
        let xx = remove_starting_0x( joNodeWalk.joBroadcastEventData.secretKeyContribution ).substr( 192 * joNodeDesc.nNodeIndex, 192 );
        ss += xx;
    }
    if( g_bVerbose ) {
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "BLSKeyName" ) + cc.normal( "=" ) + cc.info( joNodeDesc.nameBlsPrivateKey ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "EthKeyName" ) + cc.normal( "=" ) + cc.info( joNodeDesc.nameEcdsaPubKey ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "polyName" ) + cc.normal( "=" ) + cc.info( joNodeDesc.nameSgxPoly ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "SecretShare" ) + cc.normal( "=" ) + cc.info( ss ) + "\n" );
    }
    joCall.call( {
        "method": "CreateBLSPrivateKey", // old - "CreateBLSPrivateKey", new - "createBLSPrivateKey"
        "params": {
            "BLSKeyName": joNodeDesc.nameBlsPrivateKey,
            "EthKeyName": joNodeDesc.nameEcdsaPubKey,
            "polyName": joNodeDesc.nameSgxPoly,
            "SecretShare": ss,
            "t": g_nThreshold,
            "n": g_arrNodeDescriptions.length,
        }
    }, function ( joIn, joOut, err ) {
        if( joOut != null && joOut != undefined && typeof joOut == "object" && "error" in joOut )
            err = joOut.error;
        if( err ) {
            log.write( cc.fatal( "Error:" ) + cc.error( " RPC call problem in " ) + cc.info( "sgx_create_node_bls_private_key" ) + cc.error( " for node " ) + cc.info( joNodeDesc.nNodeIndex ) + cc.error( ", error description: " ) + cc.j( err ) + "\n" );
            end_of_test( 1600 + joNodeDesc.nNodeIndex );
        }
        if( g_bVerbose )
            log.write( cc.normal( "BLS private key for node " ) + nodeItemDesc( joNodeDesc ) +
                cc.normal( " was created " ) +
                "\n" );
        joNodeDesc.isBlsPrivateKeyCreated = true;
    } );
}

function sgx_fetch_node_public_key( joNodeDesc, joCall ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Fetching " ) + cc.attention( "BLS public key" ) + cc.bright( " for node " ) + nodeItemDesc( joNodeDesc ) +
            cc.bright( " for BLS key name " ) + cc.sunny( joNodeDesc.nameBlsPrivateKey ) +
            cc.bright( "..." ) +
            "\n\n" );
    joCall.call( {
        "method": "GetBLSPublicKeyShare", // old - "GetBLSPublicKeyShare", new - "getBLSPublicKeyShare"
        "params": {
            "BLSKeyName": joNodeDesc.nameBlsPrivateKey
        }
    }, function ( joIn, joOut, err ) {
        if( joOut != null && joOut != undefined && typeof joOut == "object" && "error" in joOut )
            err = joOut.error;
        if( err ) {
            log.write( cc.fatal( "Error:" ) + cc.error( " RPC call problem in " ) + cc.info( "sgx_fetch_node_public_key" ) + cc.error( " for node " ) + cc.info( joNodeDesc.nNodeIndex ) + cc.error( ", error description: " ) + cc.j( err ) + "\n" );
            end_of_test( 1700 + joNodeDesc.nNodeIndex );
        }
        joNodeDesc.blsPublicKey = joOut.result.BLSPublicKeyShare;
        if( joNodeDesc.blsPublicKey == null || joNodeDesc.blsPublicKey == undefined ) {
            log.write( cc.fatal( "Error:" ) + cc.error( " RPC call problem in " ) + cc.info( "sgx_fetch_node_public_key" ) + cc.error( " for node " ) + cc.info( joNodeDesc.nNodeIndex ) + cc.error( ", no BLS key returned, full answer is: " ) + cc.j( joOut ) + "\n" );
            end_of_test( 1800 + joNodeDesc.nNodeIndex );
        }
        if( g_bVerbose )
            log.write( cc.normal( "BLS public key for node " ) + nodeItemDesc( joNodeDesc ) +
                cc.normal( ": " ) + cc.j( joNodeDesc.blsPublicKey ) +
                "\n" );
        joNodeDesc.bSgxPassedPost = true;
    } );
}

function sgx_dkg_process_pre( w3, joCall ) {
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeDesc = g_arrNodeDescriptions[ i ];
        joNodeDesc.nNodeIndex = 0 + i;
        sgx_generate_key( w3, joNodeDesc, joCall );
    }
    waitAsyncUntil( function () {
        for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
            let joNodeDesc = g_arrNodeDescriptions[ i ];
            if( joNodeDesc.publicKey == null || joNodeDesc.publicKey == undefined )
                return false;
        }
        return true;
    }, async function () {
        for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
            let joNodeDesc = g_arrNodeDescriptions[ i ];
            joNodeDesc.nNodeIndex = 0 + i;
            sgx_generate_dkg_poly( w3, joNodeDesc, joCall );
        }
        waitAsyncUntil( function () {
            for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
                let joNodeDesc = g_arrNodeDescriptions[ i ];
                if( joNodeDesc.arrVerificationVector.length == 0 )
                    return false;
            }
            return true;
        }, async function () {
            for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
                let joNodeDesc = g_arrNodeDescriptions[ i ];
                sgx_do_secret_key_contribution( w3, joNodeDesc, joCall );
            }
            waitAsyncUntil( function () {
                for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
                    let joNodeDesc = g_arrNodeDescriptions[ i ];
                    if( joNodeDesc.SecretShare.length == 0 )
                        return false;
                }
                return true;
            }, async function () {} );
        } );
    } );
}

function sgx_dkg_process_post( w3, joCall ) {
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeDescA = g_arrNodeDescriptions[ i ]; // who is verifier - master
        for( let j = 0; j < g_arrNodeDescriptions.length; ++j ) {
            let joNodeDescB = g_arrNodeDescriptions[ j ]; // who is verified - slave
            sgx_do_verify_secret( w3, joNodeDescA, joNodeDescB, joCall );
        }
    }
    waitAsyncUntil( function () {
        for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
            let joNodeDesc = g_arrNodeDescriptions[ i ];
            if( !joNodeDesc.isSecretVerified )
                return false;
        }
        return true;
    }, async function () {
        for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
            let joNodeDesc = g_arrNodeDescriptions[ i ];
            sgx_create_node_bls_private_key( joNodeDesc, joCall );
        }
        waitAsyncUntil( function () {
            for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
                let joNodeDesc = g_arrNodeDescriptions[ i ];
                if( !joNodeDesc.isBlsPrivateKeyCreated )
                    return false;
            }
            return true;
        }, async function () {
            for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
                let joNodeDesc = g_arrNodeDescriptions[ i ];
                sgx_fetch_node_public_key( joNodeDesc, joCall );
            }
            waitAsyncUntil( function () {
                for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
                    let joNodeDesc = g_arrNodeDescriptions[ i ];
                    if( joNodeDesc.blsPublicKey == null )
                        return false;
                }
                return true;
            }, async function () {} );
        } );
    } );
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function send_dkg_broadcast( w3, joNodeDesc, privateKey ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Sending " ) + cc.attention( "DKG broadcast" ) + cc.bright( " from node " ) + nodeItemDesc( joNodeDesc )
            + cc.bright( "..." ) +
            "\n\n" );
    let addressFrom = private_key_2_account_address( w3, privateKey );
    let groupName = g_joChainEventInfoSM.returnValues.name;
    let groupIndex = w3.utils.soliditySha3( groupName );
    let vv = "0x" + get_verification_vector_summary( w3, joNodeDesc ); // get_verification_vector_summary_inv( w3, joNodeDesc );
    let secretKeyContribution = ensure_starts_with_0x( joNodeDesc.SecretShare );
    let nodeIndexAssigned = g_arrAssignedNodeIndices[ joNodeDesc.nNodeIndex ]; // joNodeDesc.nNodeIndex
    if( g_bVerbose ) {
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "name" ) + cc.normal( "=" ) + cc.info( groupName ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "groupIndex" ) + cc.normal( "=" ) + cc.info( groupIndex ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "nodeSerialIndex" ) + cc.normal( "=" ) + cc.info( joNodeDesc.nNodeIndex ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "nodeIndexAssigned" ) + cc.normal( "=" ) + cc.info( nodeIndexAssigned ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "verificationVector" ) + cc.normal( "=" ) + cc.info( vv ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "secretKeyContribution" ) + cc.normal( "=" ) + cc.info( secretKeyContribution ) + "\n" );
    }
    let res =
        await jo_skale_dkg.methods.broadcast(
            groupIndex,
            nodeIndexAssigned,
            vv,
            secretKeyContribution
        ).send( {
            "chainId": g_chainIdMN,
            "from": addressFrom,
            "gas": 8000000
        } );
    if( g_bVerbose )
        log.write( "    " + cc.notice( "res" ) + cc.normal( "=" ) + cc.j( res ) + "\n" );
    return res;
}

async function fetch_event_BroadcastAndKeyShare( w3, nodeSerialIndex, nodeIndexAssigned ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Fetching " ) + cc.attention( "broadcast event" ) + cc.bright( " for node #" ) + cc.info( nodeSerialIndex ) +
            cc.bright( " with assigned index #" ) + cc.info( nodeIndexAssigned ) +
            cc.bright( "..." ) +
            "\n\n" );
    let res =
        await jo_skale_dkg.getPastEvents( "BroadcastAndKeyShare", {
            filter: {
                "fromNode": nodeIndexAssigned
            },
            fromBlock: 0,
            toBlock: "latest"
        } );
    // if( g_bVerbose )
    //     log.write( "    " + cc.notice( "res" ) + cc.normal( "=" ) + cc.j( res ) + "\n" );
    let cnt = res.length;
    if( cnt != 1 ) {
        log.write( "    " + cc.notice( "res" ) + cc.normal( "=" ) + cc.j( res ) + "\n" );
        log.write( cc.fatal( "Error:" ) + cc.error( " Found " ) + cc.warn( cnt ) + cc.error( " events but expecting only " ) + cc.info( 1 ) + cc.error( ", will stop end exit" ) + "\n" );
        end_of_test( 3000 );
    }
    let joBroadcastEventData = {
        "serialIndex": nodeSerialIndex,
        "groupIndex": res[ 0 ].returnValues.groupIndex,
        "fromNode": res[ 0 ].returnValues.fromNode,
        "verificationVector": res[ 0 ].returnValues.verificationVector,
        "secretKeyContribution": res[ 0 ].returnValues.secretKeyContribution
    };
    if( g_bVerbose )
        log.write( "    " + cc.notice( "Event data" ) + cc.normal( " is " ) + cc.j( joBroadcastEventData ) + "\n" );
    /*
    // typical joBroadcastEventData is:
    {
        serialIndex: 0,
        groupIndex: "0x91ad6c5a901038b4f5c60ca8f54fe83da96195cc18d5701e5256d48e8acbd4bf",
        fromNode: "1",
        verificationVector: "0x058fa6b14a14f17e36aa27b141273288cf44669f77388153dc04ac51f0a921a619fa68628052bdd230146cf9aa0f12e632aae609e817ffacbad7e01b5e4d8f800e66d99ae8628c9492fc5a0b63dd2f04506557eb67565308d3e4e024e48a6e202b6b3cac61b34ea5bd49909c44c4eebc1b3aea178922be30863b113a2d0474e51b653c1d326c7036ad9d7e73bb49bc5e4a978bb7ed7c75de2420d2fe6db392901e95bac043a562fa1564f27b292107cc9caa036279d4424f4b76616f55557cbe1e5567f7e32b068bf381e3f3a929a2264f6c3f9026633f3890db50eeaafac8b91ae57f7101e978a82c769a80a8482a2fb7567ca398b7122557717e580e674bdf",
        secretKeyContribution: "0x87521a893d18a74e43b6f5836db2ffa786f26ff805824a06681de7b2658da3be702cc6c26a2b35050b56a6d123c6284931a5b799b33190c8b1911f092001307fe45a05050c191b6677981dfe02b364b963a1996cf4294dec1a88f01e42e79812823cc427be7fa6bb434351b06ff8c0f197a9afdb038de3582e7758d277ae491eb7acb63ab16217fb70777e906ce8caa643454feae29d55588bac83145849e84528216c25dd6952469c0b24b21da56774e233548e4d677119fda9c7fca3c25667"
    }

    */
    return joBroadcastEventData;
}

async function send_dkg_allright( w3, nodeSerialIndex, nodeIndexAssigned, privateKey ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Saying " ) + cc.attention( "DKG alright" ) + cc.bright( " from node #" ) + cc.info( nodeSerialIndex )
            + cc.bright( "..." ) +
            "\n\n" );
    let joNodeDesc = g_arrNodeDescriptions[ nodeSerialIndex ];
    let addressFrom = private_key_2_account_address( w3, privateKey );
    let groupName = g_joChainEventInfoSM.returnValues.name;
    let groupIndex = w3.utils.soliditySha3( groupName );
    if( g_bVerbose ) {
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "name" ) + cc.normal( "=" ) + cc.info( groupName ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "groupIndex" ) + cc.normal( "=" ) + cc.info( groupIndex ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "nodeSerialIndex" ) + cc.normal( "=" ) + cc.info( joNodeDesc.nNodeIndex ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "nodeIndexAssigned" ) + cc.normal( "=" ) + cc.info( nodeIndexAssigned ) + "\n" );
    }
    let res =
        await jo_skale_dkg.methods.allright(
            groupIndex,
            joNodeDesc.nNodeIndex
        ).send( {
            "chainId": g_chainIdMN,
            "from": addressFrom,
            "gas": 8000000
        } );
    if( g_bVerbose )
        log.write( "    " + cc.notice( "res" ) + cc.normal( "=" ) + cc.j( res ) + "\n" );
    return res;
}

async function fetch_bls_common_public_key( w3 ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Fetching " ) + cc.attention( "BLS common public key" )
            + cc.bright( "..." ) +
            "\n\n" );
    let groupName = g_joChainEventInfoSM.returnValues.name;
    let groupIndex = w3.utils.soliditySha3( groupName );
    if( g_bVerbose ) {
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "name" ) + cc.normal( "=" ) + cc.info( groupName ) + "\n" );
        log.write( "    " + cc.normal( "Using " ) + cc.attention( "groupIndex" ) + cc.normal( "=" ) + cc.info( groupIndex ) + "\n" );
    }
    let res = await jo_schains_data.methods.getGroupsPublicKey( groupIndex ).call();
    if( g_bVerbose )
        log.write( "    " + cc.notice( "res" ) + cc.normal( "=" ) + cc.j( res ) + "\n" );
    let joCommonPublicKeyBLS = {
        "insecureCommonBLSPublicKey0": res[ 1 ],
        "insecureCommonBLSPublicKey1": res[ 0 ],
        "insecureCommonBLSPublicKey2": res[ 3 ],
        "insecureCommonBLSPublicKey3": res[ 2 ]
    };
    if( g_bVerbose )
        log.write( "    " + cc.notice( "BLS common public key" ) + cc.normal( " is " ) + cc.j( joCommonPublicKeyBLS ) + "\n" );
    return joCommonPublicKeyBLS;
}

// async function fetch_node_public_key( w3, joNodeDesc, nodeIndexAssigned ) {
//     if( g_bVerbose )
//         log.write( "\n\n" +
//             cc.bright( "Fetching public key for node " ) + nodeItemDesc( joNodeDesc ) + cc.bright( "..." ) +
//             "\n\n" );
//     let groupName = g_joChainEventInfoSM.returnValues.name;
//     let groupIndex = w3.utils.soliditySha3( groupName );
//     if( g_bVerbose ) {
//         log.write( "    " + cc.normal( "Using " ) + cc.attention( "nodeIndexAssigned" ) + cc.normal( "=" ) + cc.info( nodeIndexAssigned ) + "\n" );
//     }
//     let res = await jo_nodes_data.methods.getNodePublicKey( nodeIndexAssigned ).call();
//     if( g_bVerbose )
//         log.write( "    " + cc.notice( "res" ) + cc.normal( "=" ) + cc.j( res ) + "\n" );
//     return res;
// }

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function init_sgx_ssl_for_nodes() {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Initializing " ) + cc.sunny( "SGX SSL" ) +
            cc.bright( " for nodes..." ) +
            "\n\n" );
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeDesc = g_arrNodeDescriptions[ i ];
        let strFolderNodeSkaled = g_strFolderMultiNodeDeployment + "/node_" + zeroPad( i, 2 );
        let strConfigPath = joNodeDesc.nodeConfigJsonPath;
        let strCommand = "cp -rf ./create_pems " + strFolderNodeSkaled;
        if( g_bVerbose )
            log.write( cc.debug( "will run " ) + cc.notice("\"") + cc.info( strCommand ) + cc.notice("\"") + cc.debug( "..." ) + "\n" );
        child_process.execSync(
            strCommand, {
                "cwd": __dirname,
                "stdio": "inherit",
                "env": {
                    "PATH": g_strRecommendedShellPATH
                }
            } );
        let strSkaledNodeSgxDataFolder = strFolderNodeSkaled + "/create_pems";
        init_sgx_ssl_in_folder( strSkaledNodeSgxDataFolder );
    } // for( let i = 0; i < g_arrNodeDescriptions.length; ++i )
    
    if( g_bVerbose )
        log.write( cc.success( "Finished Multi Node deployment" ) + "\n" );
}

function perform_multi_node_deployment() {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Performing " ) + cc.sunny( "Multi Node Deployment" ) +
            cc.bright( "..." ) +
            "\n\n" );
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeDesc = g_arrNodeDescriptions[ i ];
        let strFolderNodeSkaled = g_strFolderMultiNodeDeployment + "/node_" + zeroPad( i, 2 );
        let strConfigPath = strFolderNodeSkaled + "/config.json";
        let strSkaledNodeSgxDataFolder = strFolderNodeSkaled + "/create_pems";
        if( g_bVerbose )
            log.write( cc.normal( "Loading config file for node " ) + nodeItemDesc( joNodeDesc ) +
                cc.normal( " from file " ) + cc.info( strConfigPath ) + cc.normal( "..." ) +
                "\n" );
        joNodeDesc.joConfig = jsonFileLoad( strConfigPath, null, g_bVerbose );
        //
        joNodeDesc.joConfig.skaleConfig.nodeInfo.imaMainNet = g_strMainNetURL;
        // joNodeDesc.joConfig.skaleConfig.nodeInfo.imaMessageProxySChain
        // joNodeDesc.joConfig.skaleConfig.nodeInfo.imaMessageProxyMainNet
        joNodeDesc.joConfig.skaleConfig.nodeInfo.imaCallerAddressSChain = "0x66c5a87f4a49DD75e970055A265E8dd5C3F8f852";
        joNodeDesc.joConfig.skaleConfig.nodeInfo.imaCallerAddressMainNet = "0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f";
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.url = g_strUrlSgxWalletHTTPS;
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.caFile   = strSkaledNodeSgxDataFolder + "/rootCA.pem"; // TO-DO: should be different for each skaled
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.certFile = strSkaledNodeSgxDataFolder + "/client.crt"; // TO-DO: should be different for each skaled
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.keyFile  = strSkaledNodeSgxDataFolder + "/k.pem"; // "/k.key" // TO-DO: should be different for each skaled
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.keyShareName = joNodeDesc.nameBlsPrivateKey;
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.t = g_nThreshold;
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.n = g_arrNodeDescriptions.length;
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.insecureBLSPublicKey0 = joNodeDesc.blsPublicKey[ 0 ];
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.insecureBLSPublicKey1 = joNodeDesc.blsPublicKey[ 1 ];
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.insecureBLSPublicKey2 = joNodeDesc.blsPublicKey[ 2 ];
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.insecureBLSPublicKey3 = joNodeDesc.blsPublicKey[ 3 ];
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.insecureCommonBLSPublicKey0 = g_joCommonPublicKeyBLS.insecureCommonBLSPublicKey0;
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.insecureCommonBLSPublicKey1 = g_joCommonPublicKeyBLS.insecureCommonBLSPublicKey1;
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.insecureCommonBLSPublicKey2 = g_joCommonPublicKeyBLS.insecureCommonBLSPublicKey2;
        joNodeDesc.joConfig.skaleConfig.nodeInfo.wallets.ima.insecureCommonBLSPublicKey3 = g_joCommonPublicKeyBLS.insecureCommonBLSPublicKey3;
        //
        log.write( cc.normal( "Saving config file for node " ) + nodeItemDesc( joNodeDesc ) +
            cc.normal( " to file " ) + cc.info( strConfigPath ) + cc.normal( "..." ) +
            "\n" );
        jsonFileSave( strConfigPath, joNodeDesc.joConfig, g_bVerbose );
    } // for( let i = 0; i < g_arrNodeDescriptions.length; ++i )
    if( g_bVerbose )
        log.write( cc.success( "Finished Multi Node deployment" ) + "\n" );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let g_strRunMainNetCmd = normalizePath( __dirname + "/../../skaled-tests/cli-ganache/run.sh" );
let g_strLogPathMainNet = normalizePath( __dirname + "/mainnet.log" );
if( g_bVerbose ) {
    log.write( cc.normal( "Assuming " ) + cc.success( "MAIN NET" ) + cc.normal( " run command is " ) + cc.info( g_strRunMainNetCmd ) + "\n" );
    log.write( cc.normal( "Assuming " ) + cc.success( "MAIN NET" ) + cc.normal( " log file is " ) + cc.info( g_strLogPathMainNet ) + "\n" );
}
let g_procMainNet = null;
function mainnet_start() {
    if( g_bExternalMN ) {
        if( g_bAskExternalStartStopMN ) {
            log.write(
                "\n\n" + cc.normal( "Please" ) + " " + cc.sunny( "start" ) + " " + cc.success( "MAIN NET")
                + cc.normal( ", then press " ) + cc.attention( "<ENTER>" ) + cc.normal( "  to continue test...")
                + "\n" );
            wait_ENTER_key_press_on_console();
            log.write( cc.normal( "Resuming test...") + "\n" );
        } else
            log.write(
                cc.normal( "Assuming " ) + cc.success( "MAIN NET" )
                + cc.normal( " is " ) + cc.sunny( "started" )
                + cc.normal( "... continuing test...")
                + "\n" );
        return;
    }
    if( g_procMainNet )
        return;
    if( g_bVerbose )
        log.write( cc.normal( "Starting " ) + cc.success( "MAIN NET" ) + cc.normal( "...") + "\n" );
    g_procMainNet = new ProcessController(
        g_strRunMainNetCmd,
        [],
        g_strLogPathMainNet,
        8545
        );
    g_procMainNet.run();
}
async function mainnet_stop() {
    if( g_bExternalMN ) {
        if( g_bAskExternalStartStopMN ) {
            log.write(
                "\n\n" + cc.normal( "Please" ) + " " + cc.error( "stop" ) + " " + cc.success( "MAIN NET")
                + cc.normal( ", then press " ) + cc.attention( "<ENTER>" ) + cc.normal( " to continue test...")
                + "\n" );
            wait_ENTER_key_press_on_console();
            log.write( cc.normal( "Resuming test...") + "\n" );
        } else
            log.write(
                cc.normal( "Assuming " ) + cc.success( "MAIN NET")
                + cc.normal( " is " ) + cc.error( "stopped" )
                + cc.normal( "... continuing test...")
                + "\n" );
        return;
    }
    if( ! g_procMainNet )
        return;
    if( g_bVerbose )
        log.write( cc.normal( "Stopping " ) + cc.success( "MAIN NET" ) + cc.normal( "...") + "\n" );
    await g_procMainNet.stop();
    g_procMainNet = null;
}

function all_skaled_nodes_start() {
    if( g_bExternalSC ) {
        if( g_bAskExternalStartStopSC ) {
            log.write(
                "\n\n" + cc.normal( "Please" ) + " " + cc.sunny( "start" ) + " " + cc.success( "S-CHAIN" )
                + cc.normal( ", then press " ) + cc.attention( "<ENTER>" ) + cc.normal( " to continue test...")
                + "\n" );
            wait_ENTER_key_press_on_console();
            log.write( cc.normal( "Resuming test...") + "\n" );
        } else
            log.write(
                cc.normal( "Assuming " ) + cc.success( "S-CHAIN")
                + cc.normal( " is " ) + cc.sunny( "started" )
                + cc.normal( "... continuing test...")
                + "\n" );
        return;
    }
    if( g_bVerbose )
        log.write( cc.normal( "Starting " ) + cc.success( "S-CHAIN" ) + cc.normal( "...") + "\n" );
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeDesc = g_arrNodeDescriptions[ i ];
        if( g_bVerbose )
            log.write( cc.normal( "Starting " ) + cc.success( "SKALED" ) + cc.normal( " node " ) + cc.sunny( joNodeDesc.nodeID ) + "\n" );
        if( ! joNodeDesc.proc4scaled ) {
            const u = new URL( joNodeDesc.url );
            joNodeDesc.proc4scaled = new ProcessController(
                joNodeDesc.runCmd4skaled,
                [],
                joNodeDesc.logPath4skaled /*"detached"*/,
                u.port
                );
        }
        joNodeDesc.proc4scaled.run();
        //joNodeDesc.proc4scaled.continueDetached();
    }
}
async function all_skaled_nodes_stop() {
    if( g_bExternalSC ) {
        if( g_bAskExternalStartStopSC ) {
            log.write(
                "\n\n" + cc.normal( "Please" ) + " " + cc.error( "stop" ) + " " + cc.success( "S-CHAIN" )
                + cc.normal( ", then press " ) + cc.attention( "<ENTER>" ) + cc.normal( " to continue test...")
                + "\n" );
            wait_ENTER_key_press_on_console();
            log.write( cc.normal( "Resuming test...") + "\n" );
        } else
            log.write(
                cc.normal( "Assuming " ) + cc.success( "S-CHAIN" )
                + cc.normal( " is " ) + cc.error( "stopped" )
                + cc.normal( "... continuing test...")
                + "\n" );
        return;
    }
    if( g_bVerbose )
        log.write( cc.normal( "Stopping " ) + cc.success( "S-CHAIN" ) + cc.normal( "...") + "\n" );
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeDesc = g_arrNodeDescriptions[ i ];
        if( g_bVerbose )
            log.write( cc.normal( "Stopping " ) + cc.success( "SKALED" ) + cc.normal( " node " ) + cc.sunny( joNodeDesc.nodeID ) + "\n" );
        if( joNodeDesc.proc4scaled ) {
            await joNodeDesc.proc4scaled.stop();
            joNodeDesc.proc4scaled = null;
        }
    }
    //
    //
    try {
        // await fkill( "skaled" );
        let strCommand = "killall -9 skaled";
        if( g_bVerbose )
            log.write( cc.debug( "will run " ) + cc.notice("\"") + cc.info( strCommand ) + cc.notice("\"") + cc.debug( "..." ) + "\n" );
        child_process.execSync(
            strCommand, {
                "cwd": __dirname,
                "stdio": "inherit",
                "env": {
                    "PATH": g_strRecommendedShellPATH
                }
            } );
    } catch( err ) { }
}

function all_ima_agents_start() {
    if( g_bExternalIMA ) {
        if( g_bAskExternalStartStopIMA ) {
            log.write(
                "\n\n" + cc.normal( "Please" ) + " " + cc.sunny( "start" ) + " " + cc.success( "IMA Agent" )
                + cc.normal( ", then press " ) + cc.attention( "<ENTER>" ) + cc.normal( " to continue test...")
                + "\n" );
            wait_ENTER_key_press_on_console();
            log.write( cc.normal( "Resuming test...") + "\n" );
        } else
            log.write(
                cc.normal( "Assuming " ) + cc.success( "IMA Agent")
                + cc.normal( " is " ) + cc.sunny( "started" )
                + cc.normal( "... continuing test...")
                + "\n" );
        return;
    }
    if( g_bVerbose )
        log.write( cc.normal( "Starting " ) + cc.success( "IMA" ) + cc.normal( " agents ...") + "\n" );
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeDesc = g_arrNodeDescriptions[ i ];
        if( g_bVerbose )
            log.write( cc.normal( "Starting " ) + cc.success( "IMA Agent" ) + cc.normal( " for node " ) + cc.sunny( joNodeDesc.nodeID ) + "\n" );
        if( ! joNodeDesc.proc4imaAgent ) {
            const u = new URL( joNodeDesc.url );
            joNodeDesc.proc4imaAgent = new ProcessController(
                compose_node_runCmd4imaAgent( joNodeDesc ), // composes and returns value of joNodeDesc.runCmd4imaAgent
                [],
                joNodeDesc.logPath4imaAgent /*"detached"*/,
                undefined, // port
                joNodeDesc.agentFolder
                );
            if( g_bVerbose )
                log.write( cc.normal( "Notice, " ) + cc.bright( "IMA Agent" ) + cc.normal( " for node " ) + cc.sunny( joNodeDesc.nodeID )
                + cc.normal(" folder is ") + cc.info(joNodeDesc.agentFolder)
                + cc.normal(", log output is ") + cc.info(joNodeDesc.logPath4imaAgent)
                + "\n" );
        }
        joNodeDesc.proc4imaAgent.run();
        //joNodeDesc.proc4imaAgent.continueDetached();
    }
}
async function all_ima_agents_stop() {
    if( g_bExternalIMA ) {
        if( g_bAskExternalStartStopIMA ) {
            log.write(
                "\n\n" + cc.normal( "Please" ) + " " + cc.error( "stop" ) + " " + cc.success( "IMA Agent" )
                + cc.normal( ", then press " ) + cc.attention( "<ENTER>" ) + cc.normal( " to continue test...")
                + "\n" );
            wait_ENTER_key_press_on_console();
            log.write( cc.normal( "Resuming test...") + "\n" );
        } else
            log.write(
                cc.normal( "Assuming " ) + cc.success( "IMA Agent" )
                + cc.normal( " is " ) + cc.error( "stopped" )
                + cc.normal( "... continuing test...")
                + "\n" );
        return;
    }
    if( g_bVerbose )
        log.write( cc.normal( "Stopping " ) + cc.success( "IMA" ) + cc.normal( " agents ...") + "\n" );
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeDesc = g_arrNodeDescriptions[ i ];
        if( g_bVerbose )
            log.write( cc.normal( "Stopping " ) + cc.success( "IMA Agent" ) + cc.normal( " for node " ) + cc.sunny( joNodeDesc.nodeID ) + "\n" );
        if( joNodeDesc.proc4imaAgent ) {
            await joNodeDesc.proc4imaAgent.stop();
            joNodeDesc.proc4imaAgent = null;
        }
    }
}


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let g_strFolderRepoSkaleManager = normalizePath( __dirname + "/../skale-manager" );
if( g_bVerbose )
    log.write( cc.normal( "Assuming " ) + cc.sunny( "Skale Manager" ) + cc.normal( " repo is " ) + cc.info( g_strFolderRepoSkaleManager ) + "\n" );
let g_strSkaleManagerAbiJsonPath = normalizePath( g_strFolderRepoSkaleManager + "/data/test.json" );
if( g_bVerbose )
    log.write( cc.normal( "Assuming " ) + cc.sunny( "ABI file" ) + cc.normal( " is " ) + cc.info( g_strSkaleManagerAbiJsonPath ) + "\n" );

let g_joSkaleManagerABI = null;
let jo_skale_token = null;
let jo_nodes_data = null;
let jo_nodes_functionality = null;
let jo_validators_data = null;
let jo_validators_functionality = null;
let jo_schains_data = null;
let jo_schains_functionality = null;
let jo_manager_data = null;
let jo_skale_manager = null;
let jo_constants = null;
let jo_decryption = null;
let jo_skale_dkg = null;
let jo_skale_verifier = null;
let jo_contract_manager = null;
let jo_pricing = null;

async function redeploy_skale_manager( w3, fnContinue ) {
    fnContinue = fnContinue || function() { };
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Performing " ) + cc.sunny( "Skale Manager Deployment" ) +
            cc.bright( "..." ) +
            "\n\n" );
        let strCommand = "rm -rf ./build; rm -f " + g_strSkaleManagerAbiJsonPath + "; truffle migrate --network test; ls -1 ./data";
        if( g_bVerbose )
            log.write( cc.debug( "will run " ) + cc.notice("\"") + cc.info( strCommand ) + cc.notice("\"") + cc.debug( "..." ) + "\n" );
        child_process.execSync(
            strCommand, {
            "cwd": g_strFolderRepoSkaleManager,
            "stdio": "inherit",
            "env": {
                "PATH": g_strRecommendedShellPATH
                , "ENDPOINT": g_strMainNetURL
                , "ETH_PRIVATE_KEY": g_strPrivateKeySkaleManagerMN
                , "PRIVATE_KEY": g_strPrivateKeySkaleManagerMN
                , "NETWORK": "mainnet"
            }
        } );
    if( g_bVerbose )
        log.write( cc.success( "Finished Skale Manager deployment" ) + "\n" );
    fnContinue();
}
async function reload_deployed_skale_manager( w3, fnContinue ) {
    fnContinue = fnContinue || function() { };
    if( ! fileExists( g_strSkaleManagerAbiJsonPath ) ) {
        log.write( cc.error( "Skale Manager ABI JSON file " ) + cc.attention( g_strSkaleManagerAbiJsonPath ) + cc.error( " does not exist." ) + "\n" );
        end_of_test( 3001 );
    }
    g_joSkaleManagerABI = jsonFileLoad( g_strSkaleManagerAbiJsonPath, null, g_bVerbose );
    jo_skale_token = initContract( w3, g_joSkaleManagerABI, "skale_token" );
    jo_nodes_data = initContract( w3, g_joSkaleManagerABI, "nodes_data" );
    jo_nodes_functionality = initContract( w3, g_joSkaleManagerABI, "nodes_functionality" );
    jo_validators_data = initContract( w3, g_joSkaleManagerABI, "validators_data" );
    jo_validators_functionality = initContract( w3, g_joSkaleManagerABI, "validators_functionality" );
    jo_schains_data = initContract( w3, g_joSkaleManagerABI, "schains_data" );
    jo_schains_functionality = initContract( w3, g_joSkaleManagerABI, "schains_functionality" );
    jo_manager_data = initContract( w3, g_joSkaleManagerABI, "manager_data" );
    jo_skale_manager = initContract( w3, g_joSkaleManagerABI, "skale_manager" );
    jo_constants = initContract( w3, g_joSkaleManagerABI, "constants" );
    jo_decryption = initContract( w3, g_joSkaleManagerABI, "decryption" );
    jo_skale_dkg = initContract( w3, g_joSkaleManagerABI, "skale_dkg" );
    jo_skale_verifier = initContract( w3, g_joSkaleManagerABI, "skale_verifier" );
    jo_contract_manager = initContract( w3, g_joSkaleManagerABI, "contract_manager" );
    jo_pricing = initContract( w3, g_joSkaleManagerABI, "pricing" );
    fnContinue();
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let g_joCommonPublicKeyBLS = null;
// {
//     "insecureCommonBLSPublicKey0": "14175454883274808069161681493814261634483894346393730614200347712729091773660",
//     "insecureCommonBLSPublicKey1": "8121803279407808453525231194818737640175140181756432249172777264745467034059",
//     "insecureCommonBLSPublicKey2": "16178065340009269685389392150337552967996679485595319920657702232801180488250",
//     "insecureCommonBLSPublicKey3": "1719704957996939304583832799986884557051828342008506223854783585686652272013"
// };

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function init_sgx_ssl_in_folder( strFolderPath ) {
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Initializing " ) + cc.sunny( "SGX SSL" ) +
            cc.bright( " in folder " ) +
            cc.info( strFolderPath ) +
            cc.bright( "..." ) +
            "\n\n" );
    let strCommand = "./create_pems.sh";
    if( g_bVerbose )
        log.write( cc.debug( "will run " ) + cc.notice("\"") + cc.info( strCommand ) + cc.notice("\"") + cc.debug( "..." ) + "\n" );    
    child_process.execSync(
        strCommand, {
            "cwd": strFolderPath,
            "stdio": "inherit",
            "env": {
                "PATH": g_strRecommendedShellPATH
                , "URL_SGX_WALLET_HTTPS": g_strUrlSgxWalletHTTPS
                , "URL_SGX_WALLET_HTTP": g_strUrlSgxWalletHTTP
            }
        } );
    if( g_bVerbose )
        log.write( cc.success( "Passed SGX SSL initialization" ) + "\n" );
}

function init_sgx_ssl() {
    return init_sgx_ssl_in_folder( g_strPathForSgxSslData );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function init_sgx_sm_dkg( fnContinue ) {
    fnContinue = fnContinue || function() { };

    //
    // General DKG process sequence description:
    //     init_sgx_ssl
    //     init_schain_node_descriptions
    //     sgx_dkg_process_pre
    //     ....... sgx_generate_key ................... []
    //     ....... sgx_generate_dkg_poly .............. []
    //     ....... sgx_do_secret_key_contribution ..... []
    //     ....... send_dkg_broadcast ................. []
    //     ....... fetch_event_BroadcastAndKeyShare ... [] secret key contribution generated here
    //     sgx_dkg_process_post
    //     ....... sgx_do_verify_secret ............... [] []
    //     ....... sgx_create_node_bls_private_key .... []
    //     ....... sgx_fetch_node_public_key .......... []
    //     ....... send_dkg_allright .................. []
    //
    init_sgx_ssl();
    init_schain_node_descriptions( g_w3_main_net );
    //
    //
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Creating S-Chain nodes..." ) +
            "\n\n" );
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i )
        g_arrNodeDescriptions.joNodeEventInfoSM = await createNode(
            g_w3_main_net, g_arrNodeDescriptions[ i ].nameNode, /*"127.0.0.3"*/ null, /*port*/ null, g_strPrivateKeySkaleManagerMN );
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Creating S-Chain..." ) +
            "\n\n" );
    g_joChainEventInfoSM = await createSChain( g_w3_main_net, 5, 4, /*name*/ /*null*/ g_strSChainName, g_strPrivateKeySkaleManagerMN );
    g_arrAssignedNodeIndices = await getSChainNodeIndices( g_w3_main_net, g_joChainEventInfoSM.returnValues.name );
    //
    //
    if( g_bVerbose )
        log.write(
            cc.info( "SGX HTTPS URL: " ) + cc.u( g_strUrlSgxWalletHTTPS ) + "\n"
            + cc.info( "SGX RPC options: " ) + cc.j( g_joSgxRpcOptions ) + "\n"
            );
    let joCall = rpc.create( g_strUrlSgxWalletHTTPS, g_joSgxRpcOptions, function ( joCall, err ) {
        if( err ) {
            log.write( cc.fatal( "Error:" ) + cc.error( " SGX RPC connection problem for url " ) + cc.warn( g_strUrlSgxWalletHTTPS ) + cc.error( ", error description: " ) + cc.j( err ) + "\n" );
            end_of_test( 3002 );
        }
        sgx_dkg_process_pre( g_w3_main_net, joCall );
        waitAsyncUntil( function () {
            for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
                let joNodeDesc = g_arrNodeDescriptions[ i ];
                if( !joNodeDesc.bSgxPassedPre )
                    return false;
            }
            return true;
        }, async function () {
            for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
                let joNodeDesc = g_arrNodeDescriptions[ i ];
                await send_dkg_broadcast( g_w3_main_net, joNodeDesc, g_strPrivateKeySkaleManagerMN );
            }
            for( let i = 0; i < g_arrAssignedNodeIndices.length; ++i ) {
                let nodeIndexAssigned = g_arrAssignedNodeIndices[ i ];
                let joBroadcastEventData = await fetch_event_BroadcastAndKeyShare( g_w3_main_net, i, nodeIndexAssigned );
                g_mapEvBroadcastAndKeyShare[ nodeIndexAssigned ] = joBroadcastEventData;
                let joNodeDesc = g_arrNodeDescriptions[ nodeIndexAssigned ]; // g_arrNodeDescriptions[ i ]
                joNodeDesc.joBroadcastEventData = joBroadcastEventData;
            }
            sgx_dkg_process_post( g_w3_main_net, joCall );
            waitAsyncUntil( function () {
                for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
                    let joNodeDesc = g_arrNodeDescriptions[ i ];
                    if( !joNodeDesc.bSgxPassedPost )
                        return false;
                }
                return true;
            }, async function () {
                for( let i = 0; i < g_arrAssignedNodeIndices.length; ++i ) {
                    let nodeIndexAssigned = g_arrAssignedNodeIndices[ i ];
                    await send_dkg_allright( g_w3_main_net, i, nodeIndexAssigned, g_strPrivateKeySkaleManagerMN );
                }
                g_joCommonPublicKeyBLS = await fetch_bls_common_public_key( g_w3_main_net );
                // for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
                //     let joNodeDesc = g_arrNodeDescriptions[ i ];
                //     let nodeIndexAssigned = g_arrAssignedNodeIndices[ i ];
                //     await fetch_node_public_key( g_w3_main_net, joNodeDesc, nodeIndexAssigned );
                // }
                perform_multi_node_deployment();
                init_sgx_ssl_for_nodes();
                //await all_skaled_nodes_stop();
                fnContinue();
            } );
        } );
    } );
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function exec_array_of_commands( arrCommands, strWorkingDirectory, mapEnv ) {
    if( ! mapEnv )
        mapEnv = { };
    if( ! ( "PATH" in mapEnv ) )
        mapEnv[ "PATH" ] = g_strRecommendedShellPATH;
    if( strWorkingDirectory == null || strWorkingDirectory == undefined || typeof strWorkingDirectory != "string" || strWorkingDirectory.length == 0 )
        strWorkingDirectory = __dirname;
    let i = 0, cnt = arrCommands.length;
    for( i = 0; i < cnt; ++ i ) {
        let strCommand = "" + arrCommands[ i ];
        if( g_bVerbose )
            log.write( cc.debug( "will run " ) + cc.notice("\"") + cc.info( strCommand ) + cc.notice("\"") + cc.debug( "..." ) + "\n" );
        child_process.execSync(
            strCommand, {
                "cwd": strWorkingDirectory
                , "stdio": "inherit" //, "shell": true, "stdio": [ 0, 1, 2 ] //, "stdio": "inherit"
                , "env": mapEnv
            } );
    }
}
//{ shell: true, stdio: [ 0, 1, 2 ] }

let g_joImaAbiMN = null;
let g_joImaAbiSC = null;

async function redeploy_ima( fnContinue ) {
    fnContinue = fnContinue || function() { };
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "IMA deployment..." ) +
            "\n\n" );
    jsonFileSave( g_strFolderImaProxy + "/data/skaleManagerComponents.json", {
        "contract_manager_address": "" + g_joSkaleManagerABI.contract_manager_address
    }, g_bVerbose );
    let mapEnv = {
        "NETWORK_FOR_MAINNET": "" + g_strNetworkNameMN
        , "ETH_PRIVATE_KEY_FOR_MAINNET": "" + g_strPrivateKeyImaMN
        , "NETWORK_FOR_SCHAIN": "" + g_strNetworkNameSC
        , "ETH_PRIVATE_KEY_FOR_SCHAIN": "" + g_strPrivateKeyImaSC
        , "SCHAIN_NAME": "" + g_strSChainName
        , "MAINNET_RPC_URL": "" + g_strMainNetURL
        , "SCHAIN_RPC_URL": "" + g_arrNodeDescriptions[ 0 ].url // first skaled node URL
        , "PRIVATE_KEY_FOR_MAINNET": "" + g_strPrivateKeyImaMN
        , "PRIVATE_KEY_FOR_SCHAIN": "" + g_strPrivateKeyImaSC
        , "ACCOUNT_FOR_MAINNET": "" + private_key_2_account_address( g_w3_main_net, g_strPrivateKeyImaMN )
        , "ACCOUNT_FOR_SCHAIN": "" + private_key_2_account_address( g_w3_main_net, g_strPrivateKeyImaSC )
        , "MNEMONIC_FOR_MAINNET": "" + g_strPrivateKeyImaMN
        , "MNEMONIC_FOR_SCHAIN": "" + g_strPrivateKeyImaSC
    };
    let arrCommands = [
        "node --version"
        , "npm --version"
        ,"yarn --version"
        , "which node"
        , "which npm"
        , "which yarn"
        , "truffle --version || true"
        , "mkdir -p data"
        , "rm -rf ./build"
        , "rm -rf ./data/proxy*"
        , "rm -rf ./node_modules"
        , "yarn install" // , "npm i"   // // // //, "npm rebuild scrypt --update-binary"
        , "./node_modules/.bin/truffle --version || true"
        , "./node_modules/.bin/truffle compile" //  , "truffle compile"
        , "yarn deploy-to-mainnet" //, "npm run deploy-to-mainnet"
        , "ls -1 ./data/"
    ];
    if( ! g_bPredeployedIMA ) {
        arrCommands.push( "yarn deploy-to-schain" ); //, "npm run deploy-to-schain"
        arrCommands.push( "ls -1 ./data/" );
    }
    exec_array_of_commands( arrCommands, g_strFolderImaProxy, mapEnv );
    fnContinue();
}

async function reload_ima_abi( fnContinue ) {
    fnContinue = fnContinue || function() { };
    if( ! fileExists( g_strPathImaAbiMN ) ) {
        log.write( cc.error( "IMA Main Net ABI JSON file " ) + cc.attention( g_strPathImaAbiMN ) + cc.error( " does not exist." ) + "\n" );
        end_of_test( 3003 );
    }
    g_joImaAbiMN = jsonFileLoad( g_strPathImaAbiMN, null, g_bVerbose );
    //
    if( ! fileExists( g_strPathImaAbiSC ) ) {
        log.write( cc.error( "IMA S-Chain ABI JSON file " ) + cc.attention( g_strPathImaAbiSC ) + cc.error( " does not exist." ) + "\n" );
        end_of_test( 3004 );
    }
    g_joImaAbiSC = jsonFileLoad( g_strPathImaAbiSC, null, g_bVerbose );
    fnContinue();
}

async function ima_update_skaled_configurations( fnContinue ) {
    fnContinue = fnContinue || function() { };
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Updating " ) + cc.sunny( "SKALED" ) + cc.bright( " configurations with " ) + cc.info( "IMA contracts" ) +
            cc.bright( "..." ) +
            "\n\n" );
    for( let i = 0; i < g_arrNodeDescriptions.length; ++i ) {
        let joNodeDesc = g_arrNodeDescriptions[ i ];
        let strFolderNodeSkaled = g_strFolderMultiNodeDeployment + "/node_" + zeroPad( i, 2 );
        let strConfigPath = strFolderNodeSkaled + "/config.json";
        let strSkaledNodeSgxDataFolder = strFolderNodeSkaled + "/create_pems";
        if( g_bVerbose )
            log.write( cc.normal( "Loading config file for node " ) + nodeItemDesc( joNodeDesc ) +
                cc.normal( " from file " ) + cc.info( strConfigPath ) + cc.normal( "..." ) +
                "\n" );
        joNodeDesc.joConfig = jsonFileLoad( strConfigPath, null, g_bVerbose );
        //
        // joNodeDesc.joConfig.skaleConfig.nodeInfo.imaMainNet = g_strMainNetURL;
        joNodeDesc.joConfig.skaleConfig.nodeInfo.imaMessageProxyMainNet = "" + g_joImaAbiMN.message_proxy_mainnet_address;
        joNodeDesc.joConfig.skaleConfig.nodeInfo.imaMessageProxySChain = "" + g_joImaAbiSC.message_proxy_chain_address;
        //
        log.write( cc.normal( "Saving config file for node " ) + nodeItemDesc( joNodeDesc ) +
            cc.normal( " to file " ) + cc.info( strConfigPath ) + cc.normal( "..." ) +
            "\n" );
        jsonFileSave( strConfigPath, joNodeDesc.joConfig, g_bVerbose );
    } // for( let i = 0; i < g_arrNodeDescriptions.length; ++i )
    if( g_bVerbose )
        log.write( cc.success( "Finished skaled configuration update with IMA contracts" ) + "\n" );
    fnContinue();
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function ima_register( fnContinue ) {
    fnContinue = fnContinue || function() { };
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Performing " ) + cc.sunny( "IMA registration" ) +
            cc.bright( "..." ) +
            "\n\n" );
    let strCommand =
        "node "
        + g_strFolderImaAgent + "/main.js"
        + " --verbose=9"
        + " --register"
        + " --url-main-net=" + g_strMainNetURL // URLs
        + " --url-s-chain=" + g_arrNodeDescriptions[ 0 ].url // first skaled node URL
        + " --id-main-net=" + g_strMainnetName // chain names
        + " --id-s-chain=" + g_strSChainName
        + " --cid-main-net=" + cid_main_net // chain IDs
        + " --cid-s-chain=" + cid_s_chain
        + " --abi-main-net=" + g_strPathImaAbiMN // ABIs
        + " --abi-s-chain=" + g_strPathImaAbiSC
        + " --key-main-net=" + g_strPrivateKeyImaMN // keys
        + " --key-s-chain=" + g_strPrivateKeyImaSC
        ;
    if( g_bVerbose )
        log.write( cc.debug( "will run " ) + cc.notice("\"") + cc.info( strCommand ) + cc.notice("\"") + cc.debug( "..." ) + "\n" );
    child_process.execSync(
        strCommand, {
            "cwd": g_strFolderImaAgent,
            "stdio": "inherit",
            "env": {
                "PATH": g_strRecommendedShellPATH
            }
        } );
    if( g_bVerbose )
        log.write( cc.success( "Finished IMA registration" ) + "\n" );
    fnContinue();
}

function ima_check_registration( fnContinue ) {
    fnContinue = fnContinue || function() { };
    if( g_bVerbose )
        log.write( "\n\n" +
            cc.bright( "Checking " ) + cc.sunny( "IMA registration" ) +
            cc.bright( "..." ) +
            "\n\n" );
    let strCommand =
        "node "
        + g_strFolderImaAgent + "/main.js"
        + " --verbose=9"
        + " --check-registration"
        + " --url-main-net=" + g_strMainNetURL // URLs
        + " --url-s-chain=" + g_arrNodeDescriptions[ 0 ].url // first skaled node URL
        + " --id-main-net=" + g_strMainnetName // chain names
        + " --id-s-chain=" + g_strSChainName
        + " --cid-main-net=" + cid_main_net // chain IDs
        + " --cid-s-chain=" + cid_s_chain
        + " --abi-main-net=" + g_strPathImaAbiMN // ABIs
        + " --abi-s-chain=" + g_strPathImaAbiSC
        + " --key-main-net=" + g_strPrivateKeyImaMN // keys
        + " --key-s-chain=" + g_strPrivateKeyImaSC
        ;
    if( g_bVerbose )
        log.write( cc.debug( "will run " ) + cc.notice("\"") + cc.info( strCommand ) + cc.notice("\"") + cc.debug( "..." ) + "\n" );
    child_process.execSync(
        strCommand, {
            "cwd": g_strFolderImaAgent,
            "stdio": "inherit",
            "env": {
                "PATH": g_strRecommendedShellPATH
            }
        } );
    if( g_bVerbose )
        log.write( cc.success( "Finished checking IMA registration" ) + "\n" );
    fnContinue();
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

if( g_bVerbose ) {
    log.write( cc.normal( "Assuming " ) + cc.sunny( "bls_glue" ) + cc.normal( "   is " ) + cc.info( g_strFolderAppCache + "/bin/bls_glue" ) + "\n" );
    log.write( cc.normal( "Assuming " ) + cc.sunny( "hash_g1" ) + cc.normal( "    is " ) + cc.info( g_strFolderAppCache + "/bin/hash_g1" ) + "\n" );
    log.write( cc.normal( "Assuming " ) + cc.sunny( "verify_bls" ) + cc.normal( " is " ) + cc.info( g_strFolderAppCache + "/bin/verify_bls" ) + "\n" );
}

async function run() {
    mainnet_start();
    all_skaled_nodes_start();
    // // // // //setTimeout( async function() {
    if( g_bVerbose )
        log.write( cc.normal( "Connecting to " ) + cc.success( "MAIN NET" ) + cc.normal( " via " ) + cc.u( g_strMainNetURL ) + "\n" );
    g_w3_main_net = getWeb3FromURL( g_strMainNetURL );
    //
    //    
    await redeploy_skale_manager( g_w3_main_net );
    await reload_deployed_skale_manager( g_w3_main_net );
    init_sgx_sm_dkg( async function() {
        await redeploy_ima();
        await reload_ima_abi();
        // // // // //await all_skaled_nodes_stop();
        await ima_update_skaled_configurations();
        //
        //
        ima_register();
        ima_check_registration();
        all_ima_agents_start();
        //
        //
        await end_of_test( 0 );
    } );
    // // // // //}, 5000 ); // setTimeout
}
run();

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////





/*

curl -X POST --data '{"jsonrpc":"2.0","method":"blsSignMessageHash","params":{"keyShareName":"BLS_KEY:SCHAIN_ID:1:NODE_ID:1112:DKG_ID:10390","messageHash":"c479e35e1601856edb6207f204e9758f07c726a1980559a6cad498d561c35860","n":2,"signerIndex":1,"t":2}}' -H 'content-type:application/json;' https://127.0.0.1:1026






# Get needed docker images

https://hub.docker.com/repository/docker/skalelabshub/schain
https://hub.docker.com/repository/docker/skalelabshub/skale-manager
https://hub.docker.com/repository/docker/skalelabshub/ima


docker pull skalelabshub/schain:1.37-develop.10
docker pull skalelabshub/skale-manager:0.0.1
docker pull skalelabshub/ima:1.0.0-develop.41

# Test run shell

docker run -i -t ubuntu /bin/bash
docker run -i -t skalelabshub/skale-manager:0.0.1 /bin/bash
docker run -i -t skalelabshub/ima:1.0.0-develop.41 /bin/bash
docker run -i -t --entrypoint /bin/bash skalelabshub/schain:1.37-develop.10

#share host /tmp as /xxx inside docker container
docker run -i -t -v /tmp:/xxx --entrypoint /bin/bash skalelabshub/schain:1.37-develop.10
#-d to run in background
docker run -i -d -v /tmp:/xxx --entrypoint /bin/bash skalelabshub/schain:1.37-develop.10
#-network host -- use host network
docker run -i -t -v /tmp:/xxx --network host --entrypoint /bin/bash skalelabshub/schain:1.37-develop.10
*/


/*

{
    // Use IntelliSense to learn about possible attributes.
    // Hover to view descriptions of existing attributes.
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [{
        "type": "node",
        "request": "launch",
        "name": "Launch Program",
        "skipFiles": [
            "<node_internals>/**"
        ],
        "program": "${file}",
        "args": [
            "--url-main-net=http://127.0.0.1:8545"
            , "--url-s-chain=http://127.0.0.1:15000"
            , "--id-main-net=Mainnet"
            , "--id-s-chain=Bob"
            , "--cid-main-net=-4"
            , "--cid-s-chain=0x01"
            , "--abi-main-net=../proxy/data/proxyMainnet.json"
            , "--abi-s-chain=../proxy/data/proxySchain_Bob.json"
            , "--address-main-net=0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f"
            , "--key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e"
            , "--sign-messages"
            , "--bls-glue=/home/serge/Work/skaled/build/libconsensus/libBLS/bls_glue"
            , "--hash-g1=/home/serge/Work/skaled/build/libconsensus/libBLS/hash_g1"
            , "--bls-verify=/home/serge/Work/skaled/build/libconsensus/libBLS/verify_bls"
        ]
    }]
}
*/