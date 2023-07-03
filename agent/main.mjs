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
 * @file main.mjs
 * @copyright SKALE Labs 2019-Present
 */

import express from "express";
import bodyParser from "body-parser";

import * as ws from "ws";

import * as owaspUtils from "../npms/skale-owasp/owaspUtils.mjs";
import * as log from "../npms/skale-log/log.mjs";
import * as cc from "../npms/skale-cc/cc.mjs";
import * as imaCLI from "./cli.mjs";
import * as loop from "./loop.mjs";
import * as imaUtils from "./utils.mjs";
import * as imaHelperAPIs from "../npms/skale-ima/imaHelperAPIs.mjs";
import * as imaTransferErrorHandling from "../npms/skale-ima/imaTransferErrorHandling.mjs";
import * as imaBLS from "./bls.mjs";
import * as pwa from "./pwa.mjs";
import * as clpTools from "./clpTools.mjs";
import * as discoveryTools from "./discoveryTools.mjs";

import * as state from "./state.mjs";

// allow self-signed wss and https
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

function parseCommandLine() {
    const imaState = state.get();
    cc.autoEnableFromCommandLineArgs();
    let strPrintedArguments = cc.normal( process.argv.join( " " ) );
    strPrintedArguments = imaUtils.replaceAll( strPrintedArguments, "--", cc.bright( "--" ) );
    strPrintedArguments = imaUtils.replaceAll( strPrintedArguments, "=", cc.sunny( "=" ) );
    strPrintedArguments = imaUtils.replaceAll( strPrintedArguments, "/", cc.info( "/" ) );
    strPrintedArguments = imaUtils.replaceAll( strPrintedArguments, ":", cc.info( ":" ) );
    imaCLI.parse( {
        "register": clpTools.commandLineTaskRegister,
        "register1": clpTools.commandLineTaskRegister1,
        "check-registration": clpTools.commandLineTaskCheckRegistration,
        "check-registration1": clpTools.commandLineTaskCheckRegistration1,
        "mint-erc20": clpTools.commandLineTaskMintErc20,
        "mint-erc721": clpTools.commandLineTaskMintErc721,
        "mint-erc1155": clpTools.commandLineTaskMintErc1155,
        "burn-erc20": clpTools.commandLineTaskBurnErc20,
        "burn-erc721": clpTools.commandLineTaskBurnErc721,
        "burn-erc1155": clpTools.commandLineTaskBurnErc1155,
        "show-balance": clpTools.commandLineTaskShowBalance,
        "m2s-payment": clpTools.commandLineTaskPaymentM2S,
        "s2m-payment": clpTools.commandLineTaskPaymentS2M,
        "s2s-payment": clpTools.commandLineTaskPaymentS2S,
        "s2m-receive": clpTools.commandLineTaskReceiveS2M,
        "s2m-view": clpTools.commandLineTaskViewS2M,
        "m2s-transfer": clpTools.commandLineTaskTransferM2S,
        "s2m-transfer": clpTools.commandLineTaskTransferS2M,
        "s2s-transfer": clpTools.commandLineTaskTransferS2S,
        "transfer": clpTools.commandLineTaskTransfer,
        "loop": clpTools.commandLineTaskLoop,
        "simple-loop": clpTools.commandLineTaskLoopSimple,
        "browse-s-chain": clpTools.commandLineTaskBrowseSChain,
        "browse-skale-network": clpTools.commandLineTaskBrowseSkaleNetwork,
        "browse-connected-schains": clpTools.commandLineTaskBrowseConnectedSChains,
        "discover-cid": clpTools.commandLineTaskDiscoverChainId
    } );
    let haveReimbursementCommands = false;
    if( imaState.isShowReimbursementBalance ) {
        haveReimbursementCommands = true;
        clpTools.commandLineTaskReimbursementShowBalance();
    }
    if( imaState.nReimbursementEstimate ) {
        haveReimbursementCommands = true;
        clpTools.commandLineTaskReimbursementEstimateAmount();
    }
    if( imaState.nReimbursementRecharge ) {
        haveReimbursementCommands = true;
        clpTools.commandLineTaskReimbursementRecharge();
    }
    if( imaState.nReimbursementWithdraw ) {
        haveReimbursementCommands = true;
        clpTools.commandLineTaskReimbursementWithdraw();
    }
    if( haveReimbursementCommands ) {
        if( imaState.strReimbursementChain == "" ) {
            if( log.verboseGet() >= log.verboseReversed().fatal ) {
                log.write( cc.fatal( "RUNTIME INIT ERROR:" ) +
                    cc.error( " missing value for " ) + cc.info( "reimbursement-chain" ) +
                    cc.error( " parameter, must be non-empty chain name" ) + "\n" );
            }
            process.exit( 163 );
        }
    }
    if( imaState.nReimbursementRange >= 0 )
        clpTools.commandLineTaskReimbursementSetRange();
    if( imaState.nAutoExitAfterSeconds > 0 ) {
        if( log.verboseGet() >= log.verboseReversed().warning ) {
            log.write( cc.warning( "Automatic exit after " ) +
                cc.info( imaState.nAutoExitAfterSeconds ) +
                cc.warning( " second(s) is requested." ) + "\n" );
        }
        const iv = setInterval( function() {
            if( log.verboseGet() >= log.verboseReversed().warning ) {
                log.write( cc.warning( "Performing automatic exit after " ) +
                    cc.info( imaState.nAutoExitAfterSeconds ) + cc.warning( " second(s)..." ) +
                    "\n" );
            }
            clearInterval( iv );
            process.exit( 0 );
        }, imaState.nAutoExitAfterSeconds * 1000 );
    } else
        log.write( cc.warning( "Automatic exit was not requested, skipping it." ) + "\n" );
    if( imaState.strLogFilePath.length > 0 ) {
        if( log.verboseGet() >= log.verboseReversed().information ) {
            log.write( cc.debug( "Will print message to file " ) +
                cc.info( imaState.strLogFilePath ) + "\n" );
        }
        log.add(
            imaState.strLogFilePath, imaState.nLogMaxSizeBeforeRotation,
            imaState.nLogMaxFilesCount );
    }
    if( imaState.isPrintSecurityValues && log.verboseGet() >= log.verboseReversed().information ) {
        log.write( cc.debug( "Agent was started with " ) + cc.info( process.argv.length ) +
            cc.debug( " command line argument(s) as: " ) + strPrintedArguments + "\n" );
    }
    if( imaState.bIsNeededCommonInit ) {
        imaCLI.commonInit();
        imaCLI.initContracts();
    }
    if( imaState.bShowConfigMode ) {
        // just show configuration values and exit
        process.exit( 0 );
    }
}

let gServerMonitoringWS = null;

function initMonitoringServer() {
    const imaState = state.get();
    if( imaState.nMonitoringPort <= 0 )
        return;
    const strLogPrefix = cc.attention( "Monitoring:" ) + " ";
    if( imaState.bLogMonitoringServer && log.verboseGet() >= log.verboseReversed().trace ) {
        log.write( strLogPrefix + cc.normal( "Will start monitoring WS server on port " ) +
            cc.info( imaState.nMonitoringPort ) + "\n" );
    }
    gServerMonitoringWS = new ws.WebSocketServer( { port: 0 + imaState.nMonitoringPort } );
    gServerMonitoringWS.on( "connection", function( wsPeer, req ) {
        let ip = req.socket.remoteAddress;
        if( "headers" in req && req.headers && typeof req.headers == "object" &&
            "x-forwarded-for" in req.headers && req.headers["x-forwarded-for"] )
            ip = req.headers["x-forwarded-for"]; // better under NGINX
        if( ( !ip ) && "_socket" in req && req._socket && "remoteAddress" in req._socket )
            ip = req._socket.remoteAddress;
        if( !ip )
            ip = "N/A";
        if( imaState.bLogMonitoringServer && log.verboseGet() >= log.verboseReversed().debug )
            log.write( strLogPrefix + cc.normal( "New connection from " ) + cc.info( ip ) + "\n" );
        wsPeer.on( "message", function( message ) {
            const joAnswer = {
                "method": null,
                "id": null,
                "error": null
            };
            try {
                const joMessage = JSON.parse( message );
                if( imaState.bLogMonitoringServer &&
                    log.verboseGet() >= log.verboseReversed().trace
                ) {
                    log.write( strLogPrefix + cc.sunny( "<<<" ) + " " +
                        cc.normal( "message from " ) + cc.info( ip ) + cc.normal( ": " ) +
                        cc.j( joMessage ) + "\n" );
                }
                if( ! ( "method" in joMessage ) )
                    throw new Error( "\"method\" field was not specified" );
                joAnswer.method = joMessage.method;
                if( ! ( "id" in joMessage ) )
                    throw new Error( "\"id\" field was not specified" );
                joAnswer.id = joMessage.id;
                switch ( joMessage.method ) {
                case "echo":
                case "ping":
                    break;
                case "get_schain_network_info":
                    joAnswer.schain_network_info = imaState.joSChainNetworkInfo;
                    break;
                case "get_runtime_params":
                    {
                        joAnswer.runtime_params = {};
                        const arrRuntimeParamNames = [
                            "bNoWaitSChainStarted",
                            "nMaxWaitSChainAttempts",

                            "nTransferBlockSizeM2S",
                            "nTransferBlockSizeS2M",
                            "nTransferBlockSizeS2S",
                            "nTransferStepsM2S",
                            "nTransferStepsS2M",
                            "nTransferStepsS2S",
                            "nMaxTransactionsM2S",
                            "nMaxTransactionsS2M",
                            "nMaxTransactionsS2S",

                            "nBlockAwaitDepthM2S",
                            "nBlockAwaitDepthS2M",
                            "nBlockAwaitDepthS2S",
                            "nBlockAgeM2S",
                            "nBlockAgeS2M",
                            "nBlockAgeS2S",

                            "nLoopPeriodSeconds",

                            "nNodeNumber",
                            "nNodesCount",
                            "nTimeFrameSeconds",
                            "nNextFrameGap",

                            "isPWA",

                            "nMonitoringPort"
                        ];
                        for( const param_name of arrRuntimeParamNames ) {
                            if( param_name in imaState )
                                joAnswer.runtime_params[param_name] = imaState[param_name];

                        }
                    } break;
                case "get_last_transfer_errors":
                    joAnswer.last_transfer_errors = imaTransferErrorHandling.getLastTransferErrors(
                        ( ( "isIncludeTextLog" in joMessage ) && joMessage.isIncludeTextLog )
                            ? true : false );
                    joAnswer.last_error_categories =
                        imaTransferErrorHandling.getLastErrorCategories();
                    break;
                default:
                    throw new Error(
                        "Unknown method name \"" + joMessage.method + "\" was specified" );
                } // switch( joMessage.method )
            } catch ( err ) {
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    log.write( strLogPrefix + cc.error( "Bad message from " ) + cc.info( ip ) +
                        cc.error( ": " ) + cc.warning( message ) + cc.error( ", error is: " ) +
                        cc.warning( strError ) + cc.error( ", stack is: " ) + "\n" +
                        cc.stack( err.stack ) + "\n" );
                }
            }
            try {
                if( imaState.bLogMonitoringServer &&
                    log.verboseGet() >= log.verboseReversed().trace
                ) {
                    log.write( strLogPrefix + cc.sunny( ">>>" ) + " " + cc.normal( "answer to " ) +
                        cc.info( ip ) + cc.normal( ": " ) + cc.j( joAnswer ) + "\n" );
                }
                wsPeer.send( JSON.stringify( joAnswer ) );
            } catch ( err ) {
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    log.write( strLogPrefix + cc.error( "Failed to sent answer to " ) +
                        cc.info( ip ) + cc.error( ", error is: " ) + cc.warning( strError ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
                }
            }
        } );
    } );
}

let gExpressJsonRpcAppIMA = null;

function initJsonRpcServer() {
    const imaState = state.get();
    if( imaState.nJsonRpcPort <= 0 )
        return;
    const strLogPrefix = cc.attention( "JSON RPC:" ) + " ";
    gExpressJsonRpcAppIMA = express();
    gExpressJsonRpcAppIMA.use( bodyParser.urlencoded( { extended: true } ) );
    gExpressJsonRpcAppIMA.use( bodyParser.json() );
    gExpressJsonRpcAppIMA.post( "/", async function( req, res ) {
        const isSkipMode = false;
        const message = JSON.stringify( req.body );
        const ip = req.connection.remoteAddress.split( ":" ).pop();
        const fnSendAnswer = function( joAnswer ) {
            try {
                res.header( "Content-Type", "application/json" );
                res.status( 200 ).send( JSON.stringify( joAnswer ) );
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    log.write( strLogPrefix + cc.sunny( ">>>" ) + " " +
                        cc.normal( "did sent answer to " ) + cc.info( ip ) + cc.normal( ": " ) +
                        cc.j( joAnswer ) + "\n" );
                }
            } catch ( err ) {
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    log.write( strLogPrefix + cc.error( "Failed to sent answer " ) +
                        cc.j( joAnswer ) + cc.error( " to " ) + cc.info( ip ) +
                        cc.error( ", error is: " ) + cc.warning( strError ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
                }
            }
        };
        let joAnswer = {
            "method": null,
            "id": null,
            "error": null
        };
        try {
            const joMessage = JSON.parse( message );
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                log.write( strLogPrefix + cc.sunny( "<<<" ) + " " +
                    cc.normal( "Peer message from " ) + cc.info( ip ) + cc.normal( ": " ) +
                    cc.j( joMessage ) + "\n" );
            }
            if( ! ( "method" in joMessage ) )
                throw new Error( "\"method\" field was not specified" );
            joAnswer.method = joMessage.method;
            if( ! ( "id" in joMessage ) )
                throw new Error( "\"id\" field was not specified" );
            if( "id" in joMessage )
                joAnswer.id = joMessage.id;
            if( "method" in joMessage )
                joAnswer.method = "" + joMessage.method;
            switch ( joMessage.method ) {
            case "echo":
                joAnswer.result = "echo";
                fnSendAnswer( joAnswer );
                break;
            case "ping":
                joAnswer.result = "pong";
                fnSendAnswer( joAnswer );
                break;
            case "skale_imaVerifyAndSign":
                joAnswer = await imaBLS.handleSkaleImaVerifyAndSign( joMessage );
                break;
            case "skale_imaBSU256":
                joAnswer = await imaBLS.handleSkaleImaBSU256( joMessage );
                break;
            case "skale_imaNotifyLoopWork":
                if( await pwa.handleLoopStateArrived(
                    imaState,
                    owaspUtils.toInteger( joMessage.params.nNodeNumber ),
                    joMessage.params.strLoopWorkType,
                    joMessage.params.nIndexS2S,
                    joMessage.params.isStart ? true : false,
                    owaspUtils.toInteger( joMessage.params.ts ),
                    joMessage.params.signature
                ) )
                    await loop.spreadArrivedStateOfPendingWorkAnalysis( joMessage );

                break;
            default:
                throw new Error( "Unknown method name \"" + joMessage.method + "\" was specified" );
            } // switch( joMessage.method )
        } catch ( err ) {
            if( log.verboseGet() >= log.verboseReversed().error ) {
                const strError = owaspUtils.extractErrorMessage( err );
                log.write( strLogPrefix + cc.error( "Bad message from " ) + cc.info( ip ) +
                    cc.error( ": " ) + cc.warning( message ) + cc.error( ", error is: " ) +
                    cc.warning( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
        }
        if( ! isSkipMode )
            fnSendAnswer( joAnswer );
    } );
    gExpressJsonRpcAppIMA.listen( imaState.nJsonRpcPort );
}

async function doTheJob() {
    const imaState = state.get();
    const strLogPrefix = cc.info( "Job 1:" ) + " ";
    let idxAction = 0;
    const cntActions = imaState.arrActions.length;
    let cntFalse = 0;
    let cntTrue = 0;
    for( idxAction = 0; idxAction < cntActions; ++idxAction ) {
        if( log.verboseGet() >= log.verboseReversed().information )
            log.write( strLogPrefix + cc.debug( imaHelperAPIs.longSeparator ) + "\n" );
        const joAction = imaState.arrActions[idxAction];
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            log.write( strLogPrefix + cc.notice( "Will execute action:" ) + " " +
                cc.info( joAction.name ) + cc.debug( " (" ) + cc.info( idxAction + 1 ) +
                cc.debug( " of " ) + cc.info( cntActions ) + cc.debug( ")" ) + "\n" );
        }
        try {
            if( await joAction.fn() ) {
                ++cntTrue;
                if( log.verboseGet() >= log.verboseReversed().information ) {
                    log.write( strLogPrefix + cc.success( "Succeeded action:" ) + " " +
                    cc.info( joAction.name ) + "\n" );
                }
            } else {
                ++cntFalse;
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    log.write( strLogPrefix + cc.warning( "Failed action:" ) + " " +
                        cc.info( joAction.name ) + "\n" );
                }
            }
        } catch ( err ) {
            ++cntFalse;
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Exception occurred while executing action: " ) +
                    cc.error( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
        }
    }
    if( log.verboseGet() >= log.verboseReversed().information ) {
        log.write( strLogPrefix + cc.debug( imaHelperAPIs.longSeparator ) + "\n" );
        log.write( strLogPrefix + cc.info( "FINISH:" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntActions ) + cc.notice( " task(s) executed" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntTrue ) + cc.success( " task(s) succeeded" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntFalse ) + cc.error( " task(s) failed" ) + "\n" );
        log.write( strLogPrefix + cc.debug( imaHelperAPIs.longSeparator ) + "\n" );
    }
    process.exitCode = ( cntFalse > 0 ) ? cntFalse : 0;
    if( ! state.isPreventExitAfterLastAction() )
        process.exit( process.exitCode );
}

async function main() {
    cc.autoEnableFromCommandLineArgs();
    const imaState = state.get();
    const strTmpAddressFromEnvMainNet =
        owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_ETHEREUM );
    const strTmpAddressFromEnvSChain =
        owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_SCHAIN );
    const strTmpAddressFromEnvSChainTarget =
        owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_SCHAIN_TARGET );
    if( strTmpAddressFromEnvMainNet &&
        typeof strTmpAddressFromEnvMainNet == "string" &&
        strTmpAddressFromEnvMainNet.length > 0 )
        imaState.chainProperties.mn.joAccount.address_ = "" + strTmpAddressFromEnvMainNet;
    if( strTmpAddressFromEnvSChain &&
        typeof strTmpAddressFromEnvSChain == "string" &&
        strTmpAddressFromEnvSChain.length > 0 )
        imaState.chainProperties.sc.joAccount.address_ = "" + strTmpAddressFromEnvSChain;
    if( strTmpAddressFromEnvSChainTarget &&
        typeof strTmpAddressFromEnvSChainTarget == "string" &&
        strTmpAddressFromEnvSChainTarget.length > 0 )
        imaState.chainProperties.tc.joAccount.address_ = "" + strTmpAddressFromEnvSChainTarget;
    parseCommandLine();
    initMonitoringServer();
    initJsonRpcServer();
    if( imaState.bSignMessages ) {
        if( imaState.strPathBlsGlue.length == 0 ) {
            if( log.verboseGet() >= log.verboseReversed().fatal ) {
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) +
                    cc.error( " please specify --bls-glue parameter." ) + "\n" );
            }
            process.exit( 164 );
        }
        if( imaState.strPathHashG1.length == 0 ) {
            if( log.verboseGet() >= log.verboseReversed().fatal ) {
                log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) +
                    cc.error( " please specify --hash-g1 parameter." ) + "\n" );
            }
            process.exit( 165 );
        }
        if( ! imaState.bNoWaitSChainStarted ) {
            const isSilent = imaState.joSChainDiscovery.isSilentReDiscovery;
            discoveryTools.waitUntilSChainStarted().then( function() {
                // uses call to discoveryTools.discoverSChainNetwork()
                discoveryTools.discoverSChainNetwork( function( err, joSChainNetworkInfo ) {
                    if( err ) {
                        // error information is printed by discoveryTools.discoverSChainNetwork()
                        process.exit( 166 );
                    }
                    if( log.verboseGet() >= log.verboseReversed().information ) {
                        log.write( cc.success( "S-Chain network was discovered: " ) +
                            cc.j( joSChainNetworkInfo ) + "\n" );
                    }
                    imaState.joSChainNetworkInfo = joSChainNetworkInfo;
                    discoveryTools.continueSChainDiscoveryInBackgroundIfNeeded( isSilent );
                    doTheJob();
                    return 0; // FINISH
                }, isSilent, imaState.joSChainNetworkInfo, -1 ).catch( ( err ) => {
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        const strError = owaspUtils.extractErrorMessage( err );
                        log.write( cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " S-Chain network discovery failed: " ) +
                            cc.warning( strError ) + "\n" );
                    }
                } );
            } );
        }
    } else
        doTheJob();
        // FINISH!!! (skip exit here to avoid early termination while tasks ase still running)
}

main();
