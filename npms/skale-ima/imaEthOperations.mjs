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
 * @file imaEthOperations.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as log from "../skale-log/log.mjs";
import * as cc from "../skale-cc/cc.mjs";

import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as imaHelperAPIs from "./imaHelperAPIs.mjs";
import * as imaTx from "./imaTx.mjs";
import * as imaGasUsage from "./imaGasUsageOperations.mjs";
import * as imaEventLogScan from "./imaEventLogScan.mjs";

export async function getBalanceEth(
    isMainNet,
    ethersProvider,
    chainId,
    joAccount,
    contractERC20
) {
    const strLogPrefix = cc.info( "getBalanceEth() call" ) + " ";
    try {
        if( ! ( ethersProvider && joAccount ) )
            return "<no-data>";
        const strAddress = joAccount.address();
        if( ( !isMainNet ) && contractERC20 ) {
            const balance =
                await contractERC20.callStatic.balanceOf( strAddress, { from: strAddress } );
            return balance;
        }
        const balance = await ethersProvider.getBalance( strAddress );
        return balance;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            const strError = owaspUtils.extractErrorMessage( err );
            log.write( strLogPrefix + cc.fatal( "ERROR:" ) + " " +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n" );
        }
    }
    return "<no-data-or-error>";
}

// transfer money from main-net to S-chain
// main-net.DepositBox call: function deposit(string schainName, address to) public payable
// Where:
//   schainName...obvious
//   to.........address in S-chain
// Notice:
//   this function is available for everyone in main-net
//   money is sent from caller
//   "value" JSON arg is used to specify amount of money to sent
export async function doEthPaymentFromMainNet(
    ethersProviderMainNet,
    chainIdMainNet,
    joAccountSrc,
    joAccountDst,
    joDepositBox,
    joMessageProxyMainNet, // for checking logs
    chainIdSChain,
    weiHowMuch, // how much WEI money to send
    transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ETH Payment:" ) + " ";
    try {
        details.write( strLogPrefix + cc.debug( "Doing payment from mainnet with " ) +
            cc.notice( "chainIdSChain" ) + cc.debug( "=" ) + cc.notice( chainIdSChain ) +
            cc.debug( "..." ) + "\n" );
        strActionName = "ETH payment from Main Net, deposit";
        const arrArguments = [
            chainIdSChain
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
                "DepositBox", joDepositBox, "deposit", arrArguments,
                joAccountSrc, strActionName,
                gasPrice, 3000000, weiHowMuch, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        }
        const isIgnore = false;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet,
                "DepositBox", joDepositBox, "deposit", arrArguments,
                joAccountSrc, strActionName, isIgnore,
                gasPrice, estimatedGas, weiHowMuch, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const joReceipt =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "DepositBox", joDepositBox, "deposit", arrArguments,
                joAccountSrc, strActionName,
                gasPrice, estimatedGas, weiHowMuch, null );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "doEthPaymentFromMainNet",
                "receipt": joReceipt
            } );
        }

        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxyMainNet ) {
            details.write( strLogPrefix +
                cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxyMainNet.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await imaHelperAPIs.sleep(
                imaHelperAPIs.getMillisecondsSleepBeforeFetchOutgoingMessageEvent() );
            const joEvents = await imaEventLogScan.getContractCallEvents(
                details, strLogPrefix,
                ethersProviderMainNet, joMessageProxyMainNet, strEventName,
                joReceipt.blockNumber, joReceipt.transactionHash,
                joMessageProxyMainNet.filters[strEventName]()
            );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                    cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.success( "/" ) + cc.notice( joMessageProxyMainNet.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) +
                    "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" " +
                        "event of the \"MessageProxy\"/" +
                    joMessageProxyMainNet.address + " contract, no events found" );
            }
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
        details.exposeDetailsTo( log, "doEthPaymentFromMainNet", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray( "ETH PAYMENT FROM MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doEthPaymentFromMainNet", true );
    details.close();
    return true;
}

// transfer money from S-chain to main-net
// S-chain.TokenManager call: function exitToMain(address to) public payable
// Where:
//   to.........address in main-net
// Notice:
//   this function is available for everyone in S-chain
//   money is sent from caller
//   "value" JSON arg is used to specify amount of money to sent
export async function doEthPaymentFromSChain(
    ethersProviderSChain,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joTokenManagerETH,
    joMessageProxySChain, // for checking logs
    weiHowMuch, // how much WEI money to send
    transactionCustomizerSChain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "S2M ETH Payment:" ) + " ";
    try {
        strActionName = "ETH payment from S-Chain, exitToMain";
        const arrArguments = [
            owaspUtils.toBN( weiHowMuch )
        ];
        const gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGas =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "TokenManagerETH", joTokenManagerETH, "exitToMain", arrArguments,
                joAccountSrc, strActionName,
                gasPrice, 6000000, 0, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        }
        const isIgnore = true;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProviderSChain,
                "TokenManagerETH", joTokenManagerETH, "exitToMain", arrArguments,
                joAccountSrc, strActionName, isIgnore,
                gasPrice, estimatedGas, 0, null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: true
        };
        const joReceipt =
            await imaTx.payedCall(
                details, ethersProviderSChain,
                "TokenManagerETH", joTokenManagerETH, "exitToMain", arrArguments,
                joAccountSrc, strActionName,
                gasPrice, estimatedGas, 0, opts );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "doEthPaymentFromSChain",
                "receipt": joReceipt
            } );
        }

        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxySChain ) {
            details.write( strLogPrefix +
                cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxySChain.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await imaHelperAPIs.sleep(
                imaHelperAPIs.getMillisecondsSleepBeforeFetchOutgoingMessageEvent() );
            const joEvents = await imaEventLogScan.getContractCallEvents(
                details, strLogPrefix,
                ethersProviderSChain, joMessageProxySChain, strEventName,
                joReceipt.blockNumber, joReceipt.transactionHash,
                joMessageProxySChain.filters[strEventName]()
            );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                    cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.success( "/" ) + cc.notice( joMessageProxySChain.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) +
                    "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" " +
                        "event of the \"MessageProxy\"/" +
                    joMessageProxySChain.address + " contract, no events found" );
            }
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
        details.exposeDetailsTo( log, "doEthPaymentFromSChain", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray( "ETH PAYMENT FROM S-CHAIN", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doEthPaymentFromSChain", true );
    details.close();
    return true;
}

export async function receiveEthPaymentFromSchainOnMainNet(
    ethersProviderMainNet,
    chainIdMainNet,
    joAccountMN,
    joDepositBoxETH,
    transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ETH Receive:" ) + " ";
    try {
        strActionName = "Receive ETH payment from S-Chain on Main Met, getMyEth";
        const arrArguments = [];
        const weiHowMuch = undefined;
        const gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGas =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "DepositBoxETH", joDepositBoxETH, "getMyEth", arrArguments,
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
                "DepositBoxETH", joDepositBoxETH,
                "getMyEth", arrArguments,
                joAccountMN, strActionName, isIgnore,
                gasPrice, estimatedGas, weiHowMuch, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const joReceipt =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "DepositBoxETH", joDepositBoxETH,
                "getMyEth", arrArguments,
                joAccountMN, strActionName,
                gasPrice, estimatedGas, weiHowMuch, null );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "receiveEthPaymentFromSchainOnMainNet",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Receive payment error in " + strActionName + ": " ) +
                cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "receiveEthPaymentFromSchainOnMainNet", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray( "RECEIVE ETH ON MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "receiveEthPaymentFromSchainOnMainNet", true );
    details.close();
    return true;
}

export async function viewEthPaymentFromSchainOnMainNet(
    ethersProviderMainNet,
    joAccountMN,
    joDepositBoxETH
) {
    const details = log.createMemoryStream();
    const strActionName = "";
    const strLogPrefix = cc.info( "S ETH View:" ) + " ";
    try {
        if( ! ( ethersProviderMainNet && joAccountMN && joDepositBoxETH ) )
            return null;
        const addressFrom = joAccountMN.address();
        const xWei =
            await joDepositBoxETH.callStatic.approveTransfers(
                addressFrom,
                { from: addressFrom } );
        details.write( strLogPrefix +
            cc.success( "You can receive(wei): " ) + cc.attention( xWei ) + "\n" );
        const xEth = owaspUtils.ethersMod.ethers.utils.formatEther( owaspUtils.toBN( xWei ) );
        const s = strLogPrefix +
            cc.success( "You can receive(eth): " ) + cc.attention( xEth ) + "\n";
        if( log.id != details.id )
            log.write( s );
        details.write( s );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "viewEthPaymentFromSchainOnMainNet", true );
        details.close();
        return xWei;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " View payment error in " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "viewEthPaymentFromSchainOnMainNet", false );
        details.close();
        return null;
    }
}
