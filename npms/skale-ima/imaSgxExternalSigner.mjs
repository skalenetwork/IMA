import * as fs from "fs";
import * as cc from "../skale-cc/cc.mjs";
import * as log from "../skale-log/log.mjs";
import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as rpcCall from "../../agent/rpcCall.mjs";

const gIsDebugLogging = false; // development option only, must be always false
const isColors = owaspUtils.toBoolean( process.argv[2] );
cc.enable( true );
log.addStdout();

// allow self-signed wss and https
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

function finalizeOutput( jo ) {
    if( ! jo )
        return;
    cc.enable( false );
    process.stdout.write( cc.j( jo ) );
}

function postConvertBN( jo, name ) {
    if( ! jo )
        return;
    if( ! ( name in jo ) )
        return;
    if( typeof jo[name] != "object" )
        return;
    jo[name] = owaspUtils.toHexStringSafe( jo[name] );
}

async function run() {
    try {
        if( gIsDebugLogging ) {
            log.write( cc.debug( "Process startup arguments array is " ) +
                cc.j( process.argv ) + "\n" );
        }
        if( gIsDebugLogging )
            log.write( cc.debug( "Colorized mode is " ) + cc.yn( isColors ) + "\n" );

        const strSgxWalletURL = process.argv[3];
        if( gIsDebugLogging )
            log.write( cc.debug( "SGX Wallet URL is " ) + cc.u( strSgxWalletURL ) + "\n" );
        const strSgxKeyName = process.argv[4];
        if( gIsDebugLogging )
            log.write( cc.debug( "SGX key name is " ) + cc.notice( strSgxWalletURL ) + "\n" );
        const strURL = process.argv[5];
        if( gIsDebugLogging )
            log.write( cc.debug( "Chain URL is " ) + cc.u( strURL ) + "\n" );
        const chainId = process.argv[6];
        if( gIsDebugLogging )
            log.write( cc.debug( "Chain ID is " ) + cc.j( chainId ) + "\n" );
        const tcData = process.argv[7];
        if( gIsDebugLogging )
            log.write( cc.debug( "TX data is " ) + cc.j( tcData ) + "\n" );
        const txTo = process.argv[8];
        if( gIsDebugLogging )
            log.write( cc.debug( "TX destination is " ) + cc.j( txTo ) + "\n" );
        const txValue = process.argv[9];
        if( gIsDebugLogging )
            log.write( cc.debug( "TX value is " ) + cc.j( txValue ) + "\n" );
        const gasPrice = process.argv[10];
        if( gIsDebugLogging )
            log.write( cc.debug( "TX gas price is " ) + cc.j( gasPrice ) + "\n" );
        const gasLimit = process.argv[11];
        if( gIsDebugLogging )
            log.write( cc.debug( "TX gas limit is " ) + cc.j( gasLimit ) + "\n" );
        const txNonce = process.argv[12];
        if( gIsDebugLogging )
            log.write( cc.debug( "TX nonce is " ) + cc.j( txNonce ) + "\n" );
        const strPathCert = process.argv[13];
        if( gIsDebugLogging ) {
            log.write( cc.debug( "Path to SGX certificate file is " ) +
                cc.attention( strPathCert ) + "\n" );
        }
        const strPathKey = process.argv[14];
        if( gIsDebugLogging ) {
            log.write( cc.debug( "Path to SGX key file is " ) +
                cc.attention( strPathKey ) + "\n" );
        }

        const ethersProvider = owaspUtils.getEthersProviderFromURL( strURL );

        const tx = {
            data: tcData,
            to: txTo,
            value: owaspUtils.toBN( txValue ),
            chainId: owaspUtils.parseIntOrHex( chainId ),
            gasPrice: owaspUtils.toBN( gasPrice ),
            gasLimit: owaspUtils.toBN( gasLimit ),
            nonce: owaspUtils.toBN( txNonce )
        };
        if( gIsDebugLogging )
            log.write( cc.sunny( "----- Source TX ----> " ) + cc.j( tx ) + "\n" );
        let rawTX = owaspUtils.ethersMod.ethers.utils.serializeTransaction( tx );
        if( gIsDebugLogging ) {
            log.write( cc.sunny( "----- RAW unsigned TX ----> " ) +
                cc.info( rawTX ) + "\n" );
        }
        const txHash = owaspUtils.ethersMod.ethers.utils.keccak256( rawTX );
        if( gIsDebugLogging ) {
            log.write( cc.sunny( "----- TX hash ----> " ) +
                cc.attention( txHash ) + "\n" );
        }

        const rpcCallOpts = {
            "cert": fs.readFileSync( strPathCert, "utf8" ),
            "key": fs.readFileSync( strPathKey, "utf8" )
        };

        await rpcCall.create(
            strSgxWalletURL, rpcCallOpts,
            async function( joCall, err ) {
                if( err ) {
                    if( gIsDebugLogging ) {
                        log.write( cc.error( "Failed to create RPC call: " ) +
                    cc.j( err ) + "\n" );
                    }
                    finalizeOutput( { "error": owaspUtils.extractErrorMessage( err ) } );
                    process.exit( 1 );
                }
                const joIn = {
                    "method": "ecdsaSignMessageHash",
                    "params": {
                        "keyName": "" + strSgxKeyName,
                        "messageHash": txHash,
                        "base": 16
                    }
                };
                await joCall.call( joIn, async function( joIn, joOut, err ) {
                    if( err ) {
                        if( gIsDebugLogging )
                            log.write( cc.error( "RPC call error: " ) + cc.j( err ) + "\n" );
                        finalizeOutput( { "error": owaspUtils.extractErrorMessage( err ) } );
                        process.exit( 1 );
                    }
                    try {
                        if( gIsDebugLogging ) {
                            log.write( cc.debug( "SGX wallet ECDSA sign result is: " ) +
                            cc.j( joOut ) + "\n" );
                        }
                        const v = parseInt( joOut.result.signature_v );
                        const eth_v = v + owaspUtils.parseIntOrHex( chainId ) * 2 + 35;
                        const joExpanded = {
                            "recoveryParam": v,
                            "v": eth_v,
                            "r": joOut.result.signature_r,
                            "s": joOut.result.signature_s
                        };
                        if( gIsDebugLogging ) {
                            log.write( cc.sunny( "----- Expanded signature ----> " ) +
                            cc.j( joExpanded ) + "\n" );
                        }
                        rawTX = owaspUtils.ethersMod.ethers.utils
                            .serializeTransaction( tx, joExpanded );
                        if( gIsDebugLogging ) {
                            log.write( cc.sunny( "----- Raw transaction with signature ----> " ) +
                            cc.info( rawTX ) + "\n" );
                        }
                        const sr = await ethersProvider.sendTransaction( rawTX );
                        if( gIsDebugLogging ) {
                            log.write( cc.sunny( "----- Raw-sent transaction result ----> " ) +
                            cc.j( sr ) + "\n" );
                        }
                        const joReceipt = await ethersProvider.waitForTransaction( sr.hash );
                        if( gIsDebugLogging ) {
                            log.write( cc.sunny( "----- Transaction receipt ----> " ) +
                            cc.j( sr ) + "\n" );
                        }
                        joReceipt.chainId = tx.chainId;
                        joReceipt.rawTX = rawTX;
                        joReceipt.signature = joExpanded;
                        postConvertBN( joReceipt, "gasUsed" );
                        postConvertBN( joReceipt, "cumulativeGasUsed" );
                        postConvertBN( joReceipt, "effectiveGasPrice" );
                        if( joReceipt.error ) {
                            finalizeOutput( joReceipt );
                            process.exit( 1 );
                        }
                        finalizeOutput( joReceipt );
                        process.exit( 0 );
                    } catch ( err ) {
                        if( gIsDebugLogging )
                            log.write( cc.sunny( "----- Call error ----> " ) + cc.j( err ) + "\n" );
                        finalizeOutput( { "error": owaspUtils.extractErrorMessage( err ) } );
                        process.exit( 1 );
                    }

                } );
            } );
    } catch ( err ) {
        if( gIsDebugLogging ) {
            log.write( cc.error( "Failed to create RPC call: " ) +
        cc.j( err ) + "\n" );
        }
        finalizeOutput( { "error": owaspUtils.extractErrorMessage( err ) } );
        process.exit( 1 );
    }
}
run();
