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
 * @file imaReimbursementOperations.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as log from "../skale-log/log.mjs";
import * as cc from "../skale-cc/cc.mjs";

import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as imaTx from "./imaTx.mjs";
import * as imaGasUsage from "./imaGasUsageOperations.mjs";

export async function reimbursementShowBalance(
    ethersProviderMainNet,
    joCommunityPool,
    joReceiverMainNet,
    strChainNameMainNet,
    chainIdMainNet,
    transactionCustomizerMainNet,
    strReimbursementChain,
    isForcePrintOut
) {
    const details = log.createMemoryStream();
    let s = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Show Balance" ) + " ";
    try {
        const addressFrom = joReceiverMainNet;
        details.write( strLogPrefix + cc.debug( "Querying wallet " ) +
            cc.notice( strReimbursementChain ) + cc.debug( "/" ) + cc.info( addressFrom ) +
            cc.debug( " balance..." ) + "\n" );
        const xWei =
            await joCommunityPool.callStatic.getBalance(
                addressFrom, strReimbursementChain, { from: addressFrom } );
        s = strLogPrefix + cc.success( "Balance(wei): " ) + cc.attention( xWei ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );
        const xEth = owaspUtils.ethersMod.ethers.utils.formatEther( owaspUtils.toBN( xWei ) );
        s = strLogPrefix + cc.success( "Balance(eth): " ) + cc.attention( xEth ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "reimbursementShowBalance", true );
        details.close();
        return xWei;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in reimbursementShowBalance(): " ) +
                cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "reimbursementShowBalance", false );
        details.close();
        return 0;
    }
}

export async function reimbursementEstimateAmount(
    ethersProviderMainNet,
    joCommunityPool,
    joReceiverMainNet,
    strChainNameMainNet,
    chainIdMainNet,
    transactionCustomizerMainNet,
    strReimbursementChain,
    isForcePrintOut
) {
    const details = log.createMemoryStream();
    let s = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Estimate Amount To Recharge" ) + " ";
    try {
        details.write( strLogPrefix + cc.debug( "Querying wallet " ) +
            cc.notice( strReimbursementChain ) + cc.debug( " balance..." ) + "\n" );
        const addressReceiver = joReceiverMainNet;
        const xWei =
        await joCommunityPool.callStatic.getBalance(
            addressReceiver, strReimbursementChain, { from: addressReceiver } );
        s = strLogPrefix + cc.success( "Balance(wei): " ) + cc.attention( xWei ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );
        const xEth = owaspUtils.ethersMod.ethers.utils.formatEther( owaspUtils.toBN( xWei ) );
        s = strLogPrefix + cc.success( "Balance(eth): " ) + cc.attention( xEth ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        const minTransactionGas =
            owaspUtils.parseIntOrHex(
                await joCommunityPool.callStatic.minTransactionGas(
                    { from: addressReceiver } ) );
        s = strLogPrefix + cc.success( "MinTransactionGas: " ) +
            cc.attention( minTransactionGas ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        const gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        s = strLogPrefix + cc.success( "Multiplied Gas Price: " ) + cc.attention( gasPrice ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        const minAmount = minTransactionGas * gasPrice;
        s = strLogPrefix + cc.success( "Minimum recharge balance: " ) +
            cc.attention( minAmount ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        let amountToRecharge = 0;
        if( xWei >= minAmount )
            amountToRecharge = 1;
        else
            amountToRecharge = minAmount - xWei;

        s = strLogPrefix + cc.success( "Estimated amount to recharge(wei): " ) +
            cc.attention( amountToRecharge ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        const amountToRechargeEth =
            owaspUtils.ethersMod.ethers.utils.formatEther(
                owaspUtils.toBN( amountToRecharge.toString() ) );
        s = strLogPrefix + cc.success( "Estimated amount to recharge(eth): " ) +
            cc.attention( amountToRechargeEth ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "reimbursementEstimateAmount", true );
        details.close();
        return amountToRecharge;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in reimbursementEstimateAmount(): " ) +
                cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "reimbursementEstimateAmount", false );
        details.close();
        return 0;
    }
}

export async function reimbursementWalletRecharge(
    ethersProviderMainNet,
    joCommunityPool,
    joAccountMN,
    strChainNameMainNet,
    chainIdMainNet,
    transactionCustomizerMainNet,
    strReimbursementChain,
    nReimbursementRecharge
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Wallet Recharge" ) + " ";
    try {
        details.write( strLogPrefix + cc.debug( "Recharging wallet " ) +
            cc.notice( strReimbursementChain ) + cc.debug( "..." ) + "\n" );
        strActionName = "Recharge reimbursement wallet on Main Net";
        const addressReceiver = joAccountMN.address();
        const arrArguments = [
            strReimbursementChain,
            addressReceiver
        ];
        const gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGas =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "rechargeUserWallet", arrArguments,
                joAccountMN, strActionName,
                gasPrice, 3000000, nReimbursementRecharge, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        }
        const isIgnore = false;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "rechargeUserWallet", arrArguments,
                joAccountMN, strActionName, isIgnore,
                gasPrice, estimatedGas, nReimbursementRecharge, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const joReceipt =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "rechargeUserWallet", arrArguments,
                joAccountMN, strActionName,
                gasPrice, estimatedGas, nReimbursementRecharge, null );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "reimbursementWalletRecharge",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " +
                strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "reimbursementWalletRecharge", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "REIMBURSEMENT_WALLET_RECHARGE", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "reimbursementWalletRecharge", true );
    details.close();
    return true;
}

export async function reimbursementWalletWithdraw(
    ethersProviderMainNet,
    joCommunityPool,
    joAccountMN,
    strChainNameMainNet,
    chainIdMainNet,
    transactionCustomizerMainNet,
    strReimbursementChain,
    nReimbursementWithdraw
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Wallet Withdraw" ) + " ";
    try {
        details.write( strLogPrefix + cc.debug( "Withdrawing wallet " ) +
            cc.notice( strReimbursementChain ) + cc.debug( "..." ) + "\n" );
        strActionName = "Withdraw reimbursement wallet";
        const arrArguments = [
            strReimbursementChain,
            owaspUtils.ensureStartsWith0x(
                owaspUtils.toBN( nReimbursementWithdraw ).toHexString() )
        ];
        const weiHowMuch = undefined;
        const gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) +
                "\n" );
        }
        const estimatedGas =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "withdrawFunds", arrArguments,
                joAccountMN, strActionName,
                gasPrice, 3000000, weiHowMuch, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        }
        const isIgnore = false;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "withdrawFunds", arrArguments,
                joAccountMN, strActionName, isIgnore,
                gasPrice, estimatedGas, weiHowMuch, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const joReceipt =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "withdrawFunds", arrArguments,
                joAccountMN, strActionName,
                gasPrice, estimatedGas, weiHowMuch, null );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "reimbursementWalletWithdraw",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " +
                strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "reimbursementWalletWithdraw", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "REIMBURSEMENT_WALLET_WITHDRAW", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "reimbursementWalletWithdraw", true );
    details.close();
    return true;
}

export async function reimbursementSetRange(
    ethersProviderSChain,
    joCommunityLocker,
    joAccountSC,
    strChainNameSChain,
    chainIdSChain,
    transactionCustomizerSChain,
    strChainNameOriginChain,
    nReimbursementRange
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix =
        cc.info( "Gas Reimbursement - Set Minimal time interval from S2M transfers" ) + " ";
    try {
        details.write( strLogPrefix + cc.debug( "Setting minimal S2M interval to " ) +
            cc.notice( nReimbursementRange ) + cc.debug( "..." ) + "\n" );
        strActionName = "Set reimbursement range";
        const arrArguments = [
            strChainNameOriginChain,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nReimbursementRange ).toHexString() )
        ];
        const weiHowMuch = undefined;
        const gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGas =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "CommunityLocker", joCommunityLocker,
                "setTimeLimitPerMessage", arrArguments,
                joAccountSC, strActionName,
                gasPrice, 3000000, weiHowMuch, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        }
        const isIgnore = false;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProviderSChain,
                "CommunityLocker", joCommunityLocker,
                "setTimeLimitPerMessage", arrArguments,
                joAccountSC, strActionName, isIgnore,
                gasPrice, estimatedGas, weiHowMuch, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: true
        };
        const joReceipt =
            await imaTx.payedCall(
                details, ethersProviderSChain,
                "CommunityLocker", joCommunityLocker,
                "setTimeLimitPerMessage", arrArguments,
                joAccountSC, strActionName,
                gasPrice, estimatedGas, weiHowMuch, opts );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "reimbursementSetRange",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "reimbursementSetRange", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "REIMBURSEMENT_SET_RANGE", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "reimbursementSetRange", true );
    details.close();
    return true;
}
