// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * SKALE IMA is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * SKALE IMA is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file imaOracleOperations.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as log from "../skale-log/log.mjs";
import * as cc from "../skale-cc/cc.mjs";

import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as imaOracle from "../../agent/oracle.mjs";
import * as imaTx from "./imaTx.mjs";
import * as imaGasUsage from "./imaGasUsageOperations.mjs";
import * as imaTransferErrorHandling from "./imaTransferErrorHandling.mjs";

let gFlagIsEnabledOracle = false;

export function getEnabledOracle( isEnabled ) {
    return gFlagIsEnabledOracle ? true : false;
}
export function setEnabledOracle( isEnabled ) {
    gFlagIsEnabledOracle = isEnabled ? true : false;
}

async function prepareOracleGasPriceSetup( optsGasPriseSetup ) {
    optsGasPriseSetup.strActionName =
        "prepareOracleGasPriceSetup.optsGasPriseSetup.latestBlockNumber()";
    optsGasPriseSetup.latestBlockNumber =
        await optsGasPriseSetup.ethersProviderMainNet.getBlockNumber();
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsGasPriseSetup.details.write( cc.debug( "Latest block on Main Net is " ) +
            cc.info( optsGasPriseSetup.latestBlockNumber ) + "\n" );
    }
    optsGasPriseSetup.strActionName =
        "prepareOracleGasPriceSetup.optsGasPriseSetup.bnTimestampOfBlock()";
    optsGasPriseSetup.latestBlock =
        await optsGasPriseSetup.ethersProviderMainNet
            .getBlock( optsGasPriseSetup.latestBlockNumber );
    optsGasPriseSetup.bnTimestampOfBlock =
        owaspUtils.toBN( optsGasPriseSetup.latestBlock.timestamp );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsGasPriseSetup.details.write( cc.debug( "Local timestamp on Main Net is " ) +
                cc.info( optsGasPriseSetup.bnTimestampOfBlock.toString() ) + cc.debug( "=" ) +
                cc.info( owaspUtils.ensureStartsWith0x(
                    optsGasPriseSetup.bnTimestampOfBlock.toHexString() ) ) +
                cc.debug( " (original)" ) + "\n" );
    }
    optsGasPriseSetup.bnTimeZoneOffset = owaspUtils.toBN( parseInt( new Date( parseInt(
        optsGasPriseSetup.bnTimestampOfBlock.toString(), 10 ) ).getTimezoneOffset(), 10 ) );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsGasPriseSetup.details.write( cc.debug( "Local time zone offset is " ) +
            cc.info( optsGasPriseSetup.bnTimeZoneOffset.toString() ) + cc.debug( "=" ) +
            cc.info( owaspUtils.ensureStartsWith0x(
                optsGasPriseSetup.bnTimeZoneOffset.toHexString() ) ) +
            cc.debug( " (original)" ) + "\n" );
    }
    optsGasPriseSetup.bnTimestampOfBlock =
        optsGasPriseSetup.bnTimestampOfBlock.add( optsGasPriseSetup.bnTimeZoneOffset );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsGasPriseSetup.details.write( cc.debug( "UTC timestamp on Main Net is " ) +
            cc.info( optsGasPriseSetup.bnTimestampOfBlock.toString() ) + cc.debug( "=" ) +
            cc.info( owaspUtils.ensureStartsWith0x(
                optsGasPriseSetup.bnTimestampOfBlock.toHexString() ) ) +
            cc.debug( " (original)" ) + "\n" );
    }
    const bnValueToSubtractFromTimestamp = owaspUtils.toBN( 60 );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsGasPriseSetup.details.write( cc.debug( "Value to subtract from timestamp is " ) +
            cc.info( bnValueToSubtractFromTimestamp ) + cc.debug( "=" ) +
            cc.info( owaspUtils.ensureStartsWith0x(
                bnValueToSubtractFromTimestamp.toHexString() ) ) +
        cc.debug( " (to adjust it to past a bit)" ) + "\n" );
    }
    optsGasPriseSetup.bnTimestampOfBlock =
        optsGasPriseSetup.bnTimestampOfBlock.sub( bnValueToSubtractFromTimestamp );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsGasPriseSetup.details.write( cc.debug( "Timestamp on Main Net is " ) +
            cc.info( optsGasPriseSetup.bnTimestampOfBlock.toHexString() ) + cc.debug( "=" ) +
            cc.info( owaspUtils.ensureStartsWith0x(
                optsGasPriseSetup.bnTimestampOfBlock.toHexString() ) ) +
            cc.debug( " (adjusted to past a bit)" ) + "\n" );
    }
    optsGasPriseSetup.strActionName = "prepareOracleGasPriceSetup.getGasPrice()";
    optsGasPriseSetup.gasPriceOnMainNet = null;
    if( getEnabledOracle() ) {
        const oracleOpts = {
            url: owaspUtils.ethersProviderToUrl( optsGasPriseSetup.ethersProviderSChain ),
            callOpts: { },
            nMillisecondsSleepBefore: 1000,
            nMillisecondsSleepPeriod: 3000,
            cntAttempts: 40,
            isVerbose: ( log.verboseGet() >= log.verboseReversed().information ) ? true : false,
            isVerboseTraceDetails:
                ( log.verboseGet() >= log.verboseReversed().debug ) ? true : false
        };
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsGasPriseSetup.details.write( cc.debug( "Will fetch " ) +
                cc.info( "Main Net gas price" ) + cc.debug( " via call to " ) +
                cc.info( "Oracle" ) + cc.debug( " with options " ) +
                cc.j( oracleOpts ) + cc.debug( "..." ) + "\n" );
        }
        try {
            optsGasPriseSetup.gasPriceOnMainNet = owaspUtils.ensureStartsWith0x(
                ( await imaOracle.oracleGetGasPrice(
                    oracleOpts, optsGasPriseSetup.details ) ).toString( 16 ) );
        } catch ( err ) {
            optsGasPriseSetup.gasPriceOnMainNet = null;
            if( log.verboseGet() >= log.verboseReversed().error ) {
                optsGasPriseSetup.details.write( cc.error( "Failed to fetch " ) +
                    cc.info( "Main Net gas price" ) + cc.error( " via call to " ) +
                    cc.info( "Oracle" ) + cc.error( ", error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
        }
    }
    if( optsGasPriseSetup.gasPriceOnMainNet === null ) {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsGasPriseSetup.details.write( cc.debug( "Will fetch " ) +
                cc.info( "Main Net gas price" ) + cc.debug( " directly..." ) + "\n" );
        }
        optsGasPriseSetup.gasPriceOnMainNet = owaspUtils.ensureStartsWith0x(
            owaspUtils.toBN(
                await optsGasPriseSetup.ethersProviderMainNet.getGasPrice() ).toHexString() );
    }
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsGasPriseSetup.details.write( cc.success( "Done, " ) + cc.info( "Oracle" ) +
            cc.success( " did computed new " ) + cc.info( "Main Net gas price" ) +
            cc.success( "=" ) +
            cc.bright( owaspUtils.toBN( optsGasPriseSetup.gasPriceOnMainNet ).toString() ) +
            cc.success( "=" ) + cc.bright( optsGasPriseSetup.gasPriceOnMainNet ) + "\n" );
    }
    const joGasPriceOnMainNetOld =
        await optsGasPriseSetup.joCommunityLocker.callStatic.mainnetGasPrice(
            { from: optsGasPriseSetup.joAccountSC.address() } );
    const bnGasPriceOnMainNetOld = owaspUtils.toBN( joGasPriceOnMainNetOld );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        optsGasPriseSetup.details.write( cc.debug( "Previous " ) + cc.info( "Main Net gas price" ) +
            cc.debug( " saved and kept in " ) + cc.info( "CommunityLocker" ) + cc.debug( "=" ) +
            cc.bright( bnGasPriceOnMainNetOld.toString() ) + cc.debug( "=" ) +
            cc.bright( bnGasPriceOnMainNetOld.toHexString() ) + "\n" );
    }
    if( bnGasPriceOnMainNetOld.eq( owaspUtils.toBN( optsGasPriseSetup.gasPriceOnMainNet ) ) ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            optsGasPriseSetup.details.write( cc.debug( "Previous " ) +
                cc.info( "Main Net gas price" ) +
                cc.debug( " is equal to new one, will skip setting it in " ) +
                cc.info( "CommunityLocker" ) + "\n" );
        }
        if( log.exposeDetailsGet() )
            optsGasPriseSetup.details.exposeDetailsTo( log, "doOracleGasPriceSetup", true );
        optsGasPriseSetup.details.close();
        return;
    }
}

export async function doOracleGasPriceSetup(
    ethersProviderMainNet,
    ethersProviderSChain,
    transactionCustomizerSChain,
    joCommunityLocker,
    joAccountSC,
    chainIdMainNet,
    chainIdSChain,
    fnSignMsgOracle
) {
    if( ! getEnabledOracle() )
        return;
    const optsGasPriseSetup = {
        ethersProviderMainNet: ethersProviderMainNet,
        ethersProviderSChain: ethersProviderSChain,
        transactionCustomizerSChain: transactionCustomizerSChain,
        joCommunityLocker: joCommunityLocker,
        joAccountSC: joAccountSC,
        chainIdMainNet: chainIdMainNet,
        chainIdSChain: chainIdSChain,
        fnSignMsgOracle: fnSignMsgOracle,
        details: log.createMemoryStream(),
        jarrReceipts: [],
        strLogPrefix: cc.info( "Oracle gas price setup:" ) + " ",
        strActionName: "",
        latestBlockNumber: null,
        latestBlock: null,
        bnTimestampOfBlock: null,
        bnTimeZoneOffset: null,
        gasPriceOnMainNet: null
    };

    if( optsGasPriseSetup.fnSignMsgOracle == null ||
        optsGasPriseSetup.fnSignMsgOracle == undefined ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                cc.debug( "Using internal u256 signing stub function" ) + "\n" );
        }
        optsGasPriseSetup.fnSignMsgOracle = async function( u256, details, fnAfter ) {
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( optsGasPriseSetup.strLogPrefix +
                    cc.debug( "u256 signing callback was " ) + cc.error( "not provided" ) + "\n" );
            }
            await fnAfter( null, u256, null ); // null - no error, null - no signatures
        };
    } else {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                cc.debug( "Using externally provided u256 signing function" ) + "\n" );
        }
    }
    try {
        await prepareOracleGasPriceSetup( optsGasPriseSetup );
        optsGasPriseSetup.strActionName =
            "doOracleGasPriceSetup.optsGasPriseSetup.fnSignMsgOracle()";
        await optsGasPriseSetup.fnSignMsgOracle(
            optsGasPriseSetup.gasPriceOnMainNet, optsGasPriseSetup.details,
            async function( strError, u256, joGlueResult ) {
                if( strError ) {
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        if( log.id != optsGasPriseSetup.details.id ) {
                            log.write( optsGasPriseSetup.strLogPrefix +
                                cc.fatal( "CRITICAL ERROR:" ) +
                                cc.error( " Error in doOracleGasPriceSetup() during " +
                                optsGasPriseSetup.strActionName + ": " ) +
                                cc.error( strError ) + "\n" );
                        }
                    }
                    optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                        cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " Error in doOracleGasPriceSetup() during " +
                        optsGasPriseSetup.strActionName + ": " ) + cc.error( strError ) + "\n" );
                    optsGasPriseSetup.details.exposeDetailsTo(
                        log, "doOracleGasPriceSetup", false );
                    imaTransferErrorHandling.saveTransferError(
                        "oracle", optsGasPriseSetup.details.toString() );
                    optsGasPriseSetup.details.close();
                    return;
                }
                optsGasPriseSetup.strActionName = "doOracleGasPriceSetup.formatSignature";
                let signature = joGlueResult ? joGlueResult.signature : null;
                if( ! signature )
                    signature = { X: "0", Y: "0" };
                let hashPoint = joGlueResult ? joGlueResult.hashPoint : null;
                if( ! hashPoint )
                    hashPoint = { X: "0", Y: "0" };
                let hint = joGlueResult ? joGlueResult.hint : null;
                if( ! hint )
                    hint = "0";
                const sign = {
                    blsSignature: [ signature.X, signature.Y ], // BLS glue of signatures
                    hashA: hashPoint.X, // G1.X from joGlueResult.hashSrc
                    hashB: hashPoint.Y, // G1.Y from joGlueResult.hashSrc
                    counter: hint
                };
                optsGasPriseSetup.strActionName =
                    "Oracle gas price setup via CommunityLocker.setGasPrice()";
                const arrArgumentsSetGasPrice = [
                    u256,
                    owaspUtils.ensureStartsWith0x(
                        optsGasPriseSetup.bnTimestampOfBlock.toHexString() ),
                    sign // bls signature components
                ];
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    const joDebugArgs = [
                        [ signature.X, signature.Y ], // BLS glue of signatures
                        hashPoint.X, // G1.X from joGlueResult.hashSrc
                        hashPoint.Y, // G1.Y from joGlueResult.hashSrc
                        hint
                    ];
                    optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                        cc.debug( "....debug args for " ) + cc.debug( ": " ) +
                        cc.j( joDebugArgs ) + "\n" );
                }
                const weiHowMuch = undefined;
                const gasPrice =
                    await optsGasPriseSetup.transactionCustomizerSChain.computeGasPrice(
                        optsGasPriseSetup.ethersProviderSChain, 200000000000 );
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                        cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) +
                        cc.j( gasPrice ) + "\n" );
                }
                const estimatedGasSetGasPrice =
                    await optsGasPriseSetup.transactionCustomizerSChain.computeGas(
                        optsGasPriseSetup.details, optsGasPriseSetup.ethersProviderSChain,
                        "CommunityLocker", optsGasPriseSetup.joCommunityLocker,
                        "setGasPrice", arrArgumentsSetGasPrice, optsGasPriseSetup.joAccountSC,
                        optsGasPriseSetup.strActionName, gasPrice, 10000000, weiHowMuch, null );
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                        cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                        cc.debug( "=" ) + cc.notice( estimatedGasSetGasPrice ) + "\n" );
                }
                const isIgnoreSetGasPrice = false;
                const strErrorOfDryRun = await imaTx.dryRunCall( optsGasPriseSetup.details,
                    optsGasPriseSetup.ethersProviderSChain,
                    "CommunityLocker", optsGasPriseSetup.joCommunityLocker,
                    "setGasPrice", arrArgumentsSetGasPrice,
                    optsGasPriseSetup.joAccountSC, optsGasPriseSetup.strActionName,
                    isIgnoreSetGasPrice, gasPrice,
                    estimatedGasSetGasPrice, weiHowMuch, null );
                if( strErrorOfDryRun )
                    throw new Error( strErrorOfDryRun );
                const opts = {
                    isCheckTransactionToSchain:
                        ( optsGasPriseSetup.chainIdSChain !== "Mainnet" ) ? true : false
                };
                const joReceipt = await imaTx.payedCall( optsGasPriseSetup.details,
                    optsGasPriseSetup.ethersProviderSChain,
                    "CommunityLocker", optsGasPriseSetup.joCommunityLocker,
                    "setGasPrice", arrArgumentsSetGasPrice,
                    optsGasPriseSetup.joAccountSC, optsGasPriseSetup.strActionName,
                    gasPrice, estimatedGasSetGasPrice, weiHowMuch,
                    opts );
                if( joReceipt && typeof joReceipt == "object" ) {
                    optsGasPriseSetup.jarrReceipts.push( {
                        "description": "doOracleGasPriceSetup/setGasPrice",
                        "receipt": joReceipt
                    } );
                    imaGasUsage.printGasUsageReportFromArray(
                        "(intermediate result) ORACLE GAS PRICE SETUP ",
                        optsGasPriseSetup.jarrReceipts, optsGasPriseSetup.details );
                }
                imaTransferErrorHandling.saveTransferSuccess( "oracle" );
            } );
    } catch ( err ) {
        const strError = owaspUtils.extractErrorMessage( err );
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            if( log.id != optsGasPriseSetup.details.id ) {
                log.write( optsGasPriseSetup.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in doOracleGasPriceSetup() during " +
                    optsGasPriseSetup.strActionName + ": " ) + cc.error( strError ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
                optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                    cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in doOracleGasPriceSetup() during " +
                    optsGasPriseSetup.strActionName + ": " ) + cc.error( strError ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
        }
        optsGasPriseSetup.details.exposeDetailsTo( log, "doOracleGasPriceSetup", false );
        imaTransferErrorHandling.saveTransferError(
            "oracle", optsGasPriseSetup.details.toString() );
        optsGasPriseSetup.details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray( "ORACLE GAS PRICE SETUP ",
        optsGasPriseSetup.jarrReceipts, optsGasPriseSetup.details );
    if( log.exposeDetailsGet() )
        optsGasPriseSetup.details.exposeDetailsTo( log, "doOracleGasPriceSetup", true );
    optsGasPriseSetup.details.close();
    return true;
}
