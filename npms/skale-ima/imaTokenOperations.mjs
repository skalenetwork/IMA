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
 * @file imaTokenOperations.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as log from "../skale-log/log.mjs";
import * as cc from "../skale-cc/cc.mjs";

import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as imaHelperAPIs from "./imaHelperAPIs.mjs";
import * as imaTx from "./imaTx.mjs";
import * as imaGasUsage from "./imaGasUsageOperations.mjs";
import * as imaEventLogScan from "./imaEventLogScan.mjs";

export async function getBalanceErc20(
    isMainNet,
    ethersProvider,
    chainId,
    joAccount,
    strCoinName,
    joABI
) {
    const strLogPrefix = cc.info( "getBalanceErc20() call" ) + " ";
    try {
        if( ! ( ethersProvider && joAccount && strCoinName && joABI && ( strCoinName + "_abi" ) in
                joABI &&
            ( strCoinName + "_address" ) in joABI )
        )
            return "<no-data>";
        const strAddress = joAccount.address();
        const contractERC20 = new owaspUtils.ethersMod.ethers.Contract(
            joABI[strCoinName + "_address"],
            joABI[strCoinName + "_abi"],
            ethersProvider
        );
        const balance =
            await contractERC20.callStatic.balanceOf( strAddress, { from: strAddress } );
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

export async function getOwnerOfErc721(
    isMainNet,
    ethersProvider,
    chainId,
    joAccount,
    strCoinName,
    joABI,
    idToken
) {
    const strLogPrefix = cc.info( "getOwnerOfErc721() call" ) + " ";
    try {
        if( ! ( ethersProvider && joAccount && strCoinName && joABI && ( strCoinName + "_abi" ) in
                joABI &&
            ( strCoinName + "_address" ) in joABI )
        )
            return "<no-data>";
        const strAddress = joAccount.address();
        const contractERC721 = owaspUtils.ethersMod.ethers.Contract(
            joABI[strCoinName + "_address"],
            joABI[strCoinName + "_abi"],
            ethersProvider
        );
        const owner =
            await contractERC721.callStatic.ownerOf( idToken, { from: strAddress } );
        return owner;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            const strError = owaspUtils.extractErrorMessage( err );
            log.write( strLogPrefix + cc.fatal( "ERROR:" ) + " " + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
    }
    return "<no-data-or-error>";
}

export async function getBalanceErc1155(
    isMainNet,
    ethersProvider,
    chainId,
    joAccount,
    strCoinName,
    joABI,
    idToken
) {
    const strLogPrefix = cc.info( "getBalanceErc1155() call" ) + " ";
    try {
        if( ! ( ethersProvider && joAccount && strCoinName && joABI && ( strCoinName + "_abi" ) in
                joABI &&
            ( strCoinName + "_address" ) in joABI )
        )
            return "<no-data>";
        const strAddress = joAccount.address();
        const contractERC1155 = new owaspUtils.ethersMod.ethers.Contract(
            joABI[strCoinName + "_address"],
            joABI[strCoinName + "_abi"],
            ethersProvider
        );
        const balance =
            await contractERC1155.callStatic.balanceOf(
                strAddress, idToken, { from: strAddress } );
        return balance;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            const strError = owaspUtils.extractErrorMessage( err );
            log.write( strLogPrefix + cc.fatal( "ERROR:" ) + " " + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
    }
    return "<no-data-or-error>";
}

export async function doErc721PaymentFromMainNet(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joDepositBoxERC721,
    joMessageProxyMainNet, // for checking logs
    chainNameSChain,
    tokenId, // which ERC721 token id to send
    weiHowMuch, // how much ETH
    joTokenManagerERC721, // only s-chain
    strCoinNameErc721MainNet,
    erc721PrivateTestnetJsonMainNet,
    strCoinNameErc721SChain,
    erc721PrivateTestnetJsonSChain,
    transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ERC721 Payment:" ) + " ";
    try {
        strActionName = "ERC721 payment from Main Net, approve";
        const erc721ABI = erc721PrivateTestnetJsonMainNet[strCoinNameErc721MainNet + "_abi"];
        const erc721AddressMainNet =
            erc721PrivateTestnetJsonMainNet[strCoinNameErc721MainNet + "_address"];
        const contractERC721 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc721AddressMainNet,
                erc721ABI,
                ethersProviderMainNet
            );
        const depositBoxAddress = joDepositBoxERC721.address;
        const arrArgumentsApprove = [
            depositBoxAddress,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const arrArgumentsDepositERC721 = [
            chainNameSChain,
            erc721AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );

        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc721PaymentFromMainNet/approve",
                "receipt": joReceiptApprove
            } );
        }

        strActionName = "ERC721 payment from Main Net, depositERC721";
        const weiHowMuchDepositERC721 = undefined;
        gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasDeposit =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "DepositBoxERC721", joDepositBoxERC721,
                "depositERC721", arrArgumentsDepositERC721,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchDepositERC721, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(deposit) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasDeposit ) + "\n" );
        }
        const isIgnoreDepositERC721 = true;
        const strErrorOfDryRunDepositERC721 =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet,
                "DepositBoxERC721", joDepositBoxERC721,
                "depositERC721", arrArgumentsDepositERC721,
                joAccountSrc, strActionName, isIgnoreDepositERC721,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC721, null );
        if( strErrorOfDryRunDepositERC721 )
            throw new Error( strErrorOfDryRunDepositERC721 );

        const joReceiptDeposit =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "DepositBoxERC721", joDepositBoxERC721,
                "depositERC721", arrArgumentsDepositERC721,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC721, null );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" ) {
            jarrReceipts.push( {
                "description": "doErc721PaymentFromMainNet/deposit",
                "receipt": joReceiptDeposit
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
            const joFilter = // imaEventLogScan.safeGetUseWen3ForPastEvents()
                // ? {} : 
                joMessageProxyMainNet.filters[strEventName]();
            const joMessageProxyABI = null;
            const joEvents = await imaEventLogScan.getContractCallEvents(
                details, strLogPrefix, ethersProviderMainNet,
                joMessageProxyMainNet, joMessageProxyABI,
                strEventName, joReceiptDeposit.blockNumber, joReceiptDeposit.transactionHash,
                joFilter );
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
                    joMessageProxyMainNet.address + " contract, no events found"
                );
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
        details.exposeDetailsTo( log, "doErc721PaymentFromMainNet", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "ERC-721 PAYMENT FROM MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc721PaymentFromMainNet", true );
    details.close();
    return true;
}

export async function doErc20PaymentFromMainNet(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joDepositBoxERC20,
    joMessageProxyMainNet, // for checking logs
    chainNameSChain,
    tokenAmount, // how much ERC20 tokens to send
    weiHowMuch, // how much ETH
    joTokenManagerERC20, // only s-chain
    strCoinNameErc20MainNet,
    erc20MainNet,
    strCoinNameErc20SChain,
    erc20SChain,
    transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ERC20 Payment:" ) + " ";
    try {
        strActionName = "ERC20 payment from Main Net, approve";
        const erc20ABI = erc20MainNet[strCoinNameErc20MainNet + "_abi"];
        const erc20AddressMainNet =
            erc20MainNet[strCoinNameErc20MainNet + "_address"];
        const contractERC20 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc20AddressMainNet,
                erc20ABI,
                ethersProviderMainNet
            );
        const depositBoxAddress = joDepositBoxERC20.address;
        const arrArgumentsApprove = [
            depositBoxAddress,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() )
        ];
        const arrArgumentsDepositERC20 = [
            chainNameSChain,
            erc20AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );

        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc20PaymentFromMainNet/approve",
                "receipt": joReceiptApprove
            } );
        }

        strActionName = "ERC20 payment from Main Net, depositERC20";
        const weiHowMuchDepositERC20 = undefined;
        gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasDeposit =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "DepositBoxERC20", joDepositBoxERC20,
                "depositERC20", arrArgumentsDepositERC20,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchDepositERC20, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(deposit) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasDeposit ) + "\n" );
        }
        const isIgnoreDepositERC20 = true;
        const strErrorOfDryRunDepositERC20 =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet,
                "DepositBoxERC20", joDepositBoxERC20,
                "depositERC20", arrArgumentsDepositERC20,
                joAccountSrc, strActionName, isIgnoreDepositERC20,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC20, null );
        if( strErrorOfDryRunDepositERC20 )
            throw new Error( strErrorOfDryRunDepositERC20 );

        const joReceiptDeposit =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "DepositBoxERC20", joDepositBoxERC20,
                "depositERC20", arrArgumentsDepositERC20,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC20, null );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" ) {
            jarrReceipts.push( {
                "description": "doErc20PaymentFromMainNet/deposit",
                "receipt": joReceiptDeposit
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
            const joFilter = // imaEventLogScan.safeGetUseWen3ForPastEvents()
                // ? {} : 
                joMessageProxyMainNet.filters[strEventName]();
            const joMessageProxyABI = null;
            const joEvents = await imaEventLogScan.getContractCallEvents(
                details, strLogPrefix, ethersProviderMainNet,
                joMessageProxyMainNet, joMessageProxyABI,
                strEventName, joReceiptDeposit.blockNumber, joReceiptDeposit.transactionHash,
                joFilter );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                    cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.success( "/" ) + cc.notice( joMessageProxyMainNet.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) +
                    "\n" );
            } else {
                throw new Error(
                    "Verification failed for th\"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
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
        details.exposeDetailsTo( log, "doErc20PaymentFromMainNet", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "ERC-20 PAYMENT FROM MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc20PaymentFromMainNet", true );
    details.close();
    return true;
}

export async function doErc1155PaymentFromMainNet(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joDepositBoxERC1155,
    joMessageProxyMainNet, // for checking logs
    chainNameSChain,
    tokenId, // which ERC1155 token id to send
    tokenAmount, // which ERC1155 token id to send
    weiHowMuch, // how much ETH
    joTokenManagerERC1155, // only s-chain
    strCoinNameErc1155SMainNet,
    erc1155PrivateTestnetJsonMainNet,
    strCoinNameErc1155SChain,
    erc1155PrivateTestnetJsonSChain,
    transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ERC1155 Payment:" ) + " ";
    try {
        strActionName = "ERC1155 payment from Main Net, approve";
        const erc1155ABI =
            erc1155PrivateTestnetJsonMainNet[strCoinNameErc1155SMainNet + "_abi"];
        const erc1155AddressMainNet =
            erc1155PrivateTestnetJsonMainNet[strCoinNameErc1155SMainNet + "_address"];
        const contractERC1155 = new owaspUtils.ethersMod.ethers.Contract(
            erc1155AddressMainNet, erc1155ABI, ethersProviderMainNet );
        const depositBoxAddress = joDepositBoxERC1155.address;
        const arrArgumentsApprove = [
            depositBoxAddress,
            true
        ];
        const arrArgumentsDepositERC1155 = [
            chainNameSChain,
            erc1155AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() ),
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, estimatedGasApprove, weiHowMuchApprove,
                null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentFromMainNet/approve",
                "receipt": joReceiptApprove
            } );
        }
        strActionName = "ERC1155 payment from Main Net, depositERC1155";
        const weiHowMuchDepositERC1155 = undefined;
        gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasDeposit =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155", arrArgumentsDepositERC1155,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchDepositERC1155, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(deposit) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasDeposit ) + "\n" );
        }
        const isIgnoreDepositERC1155 = true;
        const strErrorOfDryRunDepositERC1155 =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155", arrArgumentsDepositERC1155,
                joAccountSrc, strActionName, isIgnoreDepositERC1155,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC1155, null );
        if( strErrorOfDryRunDepositERC1155 )
            throw new Error( strErrorOfDryRunDepositERC1155 );
        const joReceiptDeposit =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155", arrArgumentsDepositERC1155,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC1155, null );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentFromMainNet/deposit",
                "receipt": joReceiptDeposit
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
            const joFilter = // imaEventLogScan.safeGetUseWen3ForPastEvents()
                // ? {} : 
                joMessageProxyMainNet.filters[strEventName]();
            const joMessageProxyABI = null;
            const joEvents = await imaEventLogScan.getContractCallEvents(
                details, strLogPrefix, ethersProviderMainNet,
                joMessageProxyMainNet, joMessageProxyABI,
                strEventName, joReceiptDeposit.blockNumber, joReceiptDeposit.transactionHash,
                joFilter );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                    cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.success( "/" ) + cc.notice( joMessageProxyMainNet.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) +
                    "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
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
        details.exposeDetailsTo( log, "doErc1155PaymentFromMainNet", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "ERC-1155 PAYMENT FROM MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc1155PaymentFromMainNet", true );
    details.close();
    return true;
}

export async function doErc1155BatchPaymentFromMainNet(
    ethersProviderMainNet, ethersProviderSChain,
    chainIdMainNet, chainIdSChain,
    joAccountSrc, joAccountDst,
    joDepositBoxERC1155,
    joMessageProxyMainNet, // for checking logs
    chainNameSChain,
    arrTokenIds, // which ERC1155 token id to send
    arrTokenAmounts, // which ERC1155 token id to send
    weiHowMuch, // how much ETH
    joTokenManagerERC1155, // only s-chain
    strCoinNameErc1155SMainNet,
    erc1155PrivateTestnetJsonMainNet, strCoinNameErc1155SChain,
    erc1155PrivateTestnetJsonSChain, transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ERC1155 Batch Payment:" ) + " ";
    try {
        strActionName = "ERC1155 batch-payment from Main Net, approve";
        const erc1155ABI =
            erc1155PrivateTestnetJsonMainNet[strCoinNameErc1155SMainNet + "_abi"];
        const erc1155AddressMainNet =
            erc1155PrivateTestnetJsonMainNet[strCoinNameErc1155SMainNet + "_address"];
        const contractERC1155 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc1155AddressMainNet,
                erc1155ABI,
                ethersProviderMainNet
            );
        const depositBoxAddress = joDepositBoxERC1155.address;
        const arrArgumentsApprove = [
            // joAccountSrc.address(),
            depositBoxAddress,
            true
        ];
        const arrArgumentsDepositERC1155Batch = [
            chainNameSChain, erc1155AddressMainNet, arrTokenIds, arrTokenAmounts ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet, "ERC1155", contractERC1155,
                "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155BatchPaymentFromMainNet/approve",
                "receipt": joReceiptApprove
            } );
        }
        strActionName = "ERC1155 batch-payment from Main Net, depositERC1155Batch";
        const weiHowMuchDepositERC1155Batch = undefined;
        gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasDeposit =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155Batch", arrArgumentsDepositERC1155Batch,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchDepositERC1155Batch, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(deposit) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasDeposit ) + "\n" );
        }
        const isIgnoreDepositERC1155Batch = true;
        const strErrorOfDryRunDepositERC1155Batch =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155Batch", arrArgumentsDepositERC1155Batch,
                joAccountSrc, strActionName, isIgnoreDepositERC1155Batch,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC1155Batch, null );
        if( strErrorOfDryRunDepositERC1155Batch )
            throw new Error( strErrorOfDryRunDepositERC1155Batch );
        const joReceiptDeposit =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155Batch", arrArgumentsDepositERC1155Batch,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC1155Batch, null );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155BatchPaymentFromMainNet/deposit",
                "receipt": joReceiptDeposit
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
            const joFilter = // imaEventLogScan.safeGetUseWen3ForPastEvents()
                // ? {} : 
                joMessageProxyMainNet.filters[strEventName]();
            const joMessageProxyABI = null;
            const joEvents = await imaEventLogScan.getContractCallEvents(
                details, strLogPrefix, ethersProviderMainNet,
                joMessageProxyMainNet, joMessageProxyABI,
                strEventName, joReceiptDeposit.blockNumber, joReceiptDeposit.transactionHash,
                joFilter );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                    cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.success( "/" ) + cc.notice( joMessageProxyMainNet.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) +
                    "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
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
        details.exposeDetailsTo( log, "doErc1155BatchPaymentFromMainNet", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "ERC-1155 PAYMENT FROM MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc1155BatchPaymentFromMainNet", true );
    details.close();
    return true;
}

export async function doErc20PaymentFromSChain(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joTokenManagerERC20, // only s-chain
    joMessageProxySChain, // for checking logs
    joDepositBox, // only main net
    tokenAmount, // how much ERC20 tokens to send
    weiHowMuch, // how much ETH
    strCoinNameErc20MainNet,
    joErc20MainNet,
    strCoinNameErc20SChain,
    joErc20SChain,
    transactionCustomizerSChain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "S2M ERC20 Payment:" ) + " ";
    try {
        strActionName = "ERC20 payment from S-Chain, approve";
        const erc20ABI = joErc20SChain[strCoinNameErc20SChain + "_abi"];
        const erc20AddressSChain = joErc20SChain[strCoinNameErc20SChain + "_address"];
        const tokenManagerAddress = joTokenManagerERC20.address;
        const contractERC20 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc20AddressSChain, erc20ABI, ethersProviderSChain );
        const arrArgumentsApprove = [
            tokenManagerAddress,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() ) ];
        const erc20AddressMainNet = joErc20MainNet[strCoinNameErc20MainNet + "_address"];
        const arrArgumentsExitToMainERC20 = [
            erc20AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() )
            // owaspUtils.ensureStartsWith0x( owaspUtils.toBN( weiHowMuch ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderSChain,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const opts = { isCheckTransactionToSchain: true };
        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderSChain,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, opts );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc20PaymentFromSChain/approve",
                "receipt": joReceiptApprove
            } );
        }
        if( imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() > 0 ) {
            details.write( cc.normal( "Sleeping " ) +
                cc.info( imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() ) +
                cc.normal( " milliseconds between transactions..." ) + "\n" );
            await imaHelperAPIs.sleep(
                imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() );
        }
        if( imaHelperAPIs.getWaitForNextBlockOnSChain() )
            await imaHelperAPIs.safeWaitForNextBlockToAppear( details, ethersProviderSChain );
        strActionName = "ERC20 payment from S-Chain, exitToMainERC20";
        const weiHowMuchExitToMainERC20 = undefined;
        const estimatedGasExitToMainERC20 =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "TokenManagerERC20", joTokenManagerERC20,
                "exitToMainERC20", arrArgumentsExitToMainERC20,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchExitToMainERC20, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasExitToMainERC20 ) +
                "\n" );
        }
        gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const isIgnoreExitToMainERC20 = true;
        const strErrorOfDryRunExitToMainERC20 =
            await imaTx.dryRunCall(
                details, ethersProviderSChain,
                "TokenManagerERC20", joTokenManagerERC20,
                "exitToMainERC20", arrArgumentsExitToMainERC20,
                joAccountSrc, strActionName, isIgnoreExitToMainERC20,
                gasPrice, estimatedGasExitToMainERC20, weiHowMuchExitToMainERC20, null );
        if( strErrorOfDryRunExitToMainERC20 )
            throw new Error( strErrorOfDryRunExitToMainERC20 );
        opts.isCheckTransactionToSchain = true;
        const joReceiptExitToMainERC20 =
            await imaTx.payedCall(
                details, ethersProviderSChain,
                "TokenManagerERC20", joTokenManagerERC20,
                "exitToMainERC20", arrArgumentsExitToMainERC20,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasExitToMainERC20, weiHowMuchExitToMainERC20, opts );
        if( joReceiptExitToMainERC20 && typeof joReceiptExitToMainERC20 == "object" ) {
            jarrReceipts.push( {
                "description": "doErc20PaymentFromSChain/exit-to-main",
                "receipt": joReceiptExitToMainERC20
            } );
        }
        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxySChain ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxySChain.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await imaHelperAPIs.sleep(
                imaHelperAPIs.getMillisecondsSleepBeforeFetchOutgoingMessageEvent() );
            const joFilter = // imaEventLogScan.safeGetUseWen3ForPastEvents()
                // ? {} : 
                joMessageProxySChain.filters[strEventName]();
            const joMessageProxyABI = null;
            const joEvents = await imaEventLogScan.getContractCallEvents(
                details, strLogPrefix, ethersProviderSChain,
                joMessageProxySChain, joMessageProxyABI,
                strEventName,
                joReceiptExitToMainERC20.blockNumber, joReceiptExitToMainERC20.transactionHash,
                joFilter );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix + cc.success( "Success, verified the " ) +
                    cc.info( strEventName ) + cc.success( " event of the " ) +
                    cc.info( "MessageProxy" ) + cc.success( "/" ) +
                    cc.notice( joMessageProxySChain.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
                    joMessageProxySChain.address + " contract, no events found" );
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
        details.exposeDetailsTo( log, "doErc20PaymentFromSChain", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "ERC-20 PAYMENT FROM S-CHAIN", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc20PaymentFromSChain", true );
    details.close();
    return true;
}

export async function doErc721PaymentFromSChain(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joTokenManagerERC721, // only s-chain
    joMessageProxySChain, // for checking logs
    joDepositBox, // only main net
    tokenId, // which ERC721 token id to send
    weiHowMuch, // how much ETH
    strCoinNameErc721MainNet,
    joErc721MainNet,
    strCoinNameErc721SChain,
    joErc721SChain,
    transactionCustomizerSChain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "S2M ERC721 Payment:" ) + " ";
    try {
        strActionName = "ERC721 payment from S-Chain, approve";
        const erc721ABI = joErc721SChain[strCoinNameErc721SChain + "_abi"];
        const erc721AddressSChain = joErc721SChain[strCoinNameErc721SChain + "_address"];
        const tokenManagerAddress = joTokenManagerERC721.address;
        const contractERC721 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc721AddressSChain, erc721ABI, ethersProviderSChain );
        const arrArgumentsApprove = [
            tokenManagerAddress,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const erc721AddressMainNet =
            joErc721MainNet[strCoinNameErc721MainNet + "_address"];
        const arrArgumentsExitToMainERC721 = [
            erc721AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(transfer from) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderSChain,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const opts = { isCheckTransactionToSchain: true };
        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderSChain,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasApprove, weiHowMuchApprove, opts );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc721PaymentFromSChain/transfer-from",
                "receipt": joReceiptApprove
            } );
        }
        if( imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() > 0 ) {
            details.write( cc.normal( "Sleeping " ) +
                cc.info( imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() ) +
                cc.normal( " milliseconds between transactions..." ) + "\n" );
            await imaHelperAPIs.sleep(
                imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() );
        }
        if( imaHelperAPIs.getWaitForNextBlockOnSChain() )
            await imaHelperAPIs.safeWaitForNextBlockToAppear( details, ethersProviderSChain );
        strActionName = "ERC721 payment from S-Chain, exitToMainERC721";
        const weiHowMuchExitToMainERC721 = undefined;
        gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasExitToMainERC721 =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "TokenManagerERC721", joTokenManagerERC721,
                "exitToMainERC721", arrArgumentsExitToMainERC721,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchExitToMainERC721, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(exit to main) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasExitToMainERC721 ) +
                "\n" );
        }
        const isIgnoreExitToMainERC721 = true;
        const strErrorOfDryRunExitToMainERC721 =
            await imaTx.dryRunCall(
                details, ethersProviderSChain,
                "TokenManagerERC721", joTokenManagerERC721,
                "exitToMainERC721", arrArgumentsExitToMainERC721,
                joAccountSrc, strActionName, isIgnoreExitToMainERC721, gasPrice,
                estimatedGasExitToMainERC721, weiHowMuchExitToMainERC721, null );
        if( strErrorOfDryRunExitToMainERC721 )
            throw new Error( strErrorOfDryRunExitToMainERC721 );
        opts.isCheckTransactionToSchain = true;
        const joReceiptExitToMainERC721 =
            await imaTx.payedCall(
                details, ethersProviderSChain,
                "TokenManagerERC721", joTokenManagerERC721,
                "exitToMainERC721", arrArgumentsExitToMainERC721,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasExitToMainERC721, weiHowMuchExitToMainERC721, opts );
        if( joReceiptExitToMainERC721 && typeof joReceiptExitToMainERC721 == "object" ) {
            jarrReceipts.push( {
                "description": "doErc721PaymentFromSChain/exit-to-main",
                "receipt": joReceiptExitToMainERC721
            } );
        }
        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxySChain ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) +
                cc.info( strEventName ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) +
                cc.debug( "/" ) + cc.notice( joMessageProxySChain.address ) +
                cc.debug( " contract ..." ) + "\n" );
            await imaHelperAPIs.sleep(
                imaHelperAPIs.getMillisecondsSleepBeforeFetchOutgoingMessageEvent() );
            const joFilter = // imaEventLogScan.safeGetUseWen3ForPastEvents()
                // ? {} : 
                joMessageProxySChain.filters[strEventName]();
            const joMessageProxyABI = null;
            const joEvents = await imaEventLogScan.getContractCallEvents(
                details, strLogPrefix, ethersProviderSChain,
                joMessageProxySChain, joMessageProxyABI,
                strEventName,
                joReceiptExitToMainERC721.blockNumber, joReceiptExitToMainERC721.transactionHash,
                joFilter );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix + cc.success( "Success, verified the " ) +
                    cc.info( strEventName ) + cc.success( " event of the " ) +
                    cc.info( "MessageProxy" ) + cc.success( "/" ) +
                    cc.notice( joMessageProxySChain.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
                    joMessageProxySChain.address + " contract, no events found" );
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
        details.exposeDetailsTo( log, "doErc721PaymentFromSChain", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "ERC-721 PAYMENT FROM S-CHAIN", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc721PaymentFromSChain", true );
    details.close();
    return true;
}

export async function doErc1155PaymentFromSChain(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joTokenManagerERC1155, // only s-chain
    joMessageProxySChain, // for checking logs
    joDepositBox, // only main net
    tokenId, // which ERC1155 token id to send
    tokenAmount, // which ERC1155 token id to send
    weiHowMuch, // how much ETH
    strCoinNameErc1155SMainNet,
    joErc1155MainNet,
    strCoinNameErc1155SChain,
    joErc1155Chain,
    transactionCustomizerSChain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "S2M ERC1155 Payment:" ) + " ";
    try {
        strActionName = "ERC1155 payment from S-Chain, approve";
        const erc1155ABI = joErc1155Chain[strCoinNameErc1155SChain + "_abi"];
        const erc1155AddressSChain = joErc1155Chain[strCoinNameErc1155SChain + "_address"];
        const tokenManagerAddress = joTokenManagerERC1155.address;
        const contractERC1155 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc1155AddressSChain, erc1155ABI, ethersProviderSChain );
        const arrArgumentsApprove = [
            tokenManagerAddress,
            true
        ];
        const erc1155AddressMainNet =
            joErc1155MainNet[strCoinNameErc1155SMainNet + "_address"];
        const arrArgumentsExitToMainERC1155 = [
            erc1155AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() ),
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() )
            // owaspUtils.ensureStartsWith0x( owaspUtils.toBN( weiHowMuch ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(transfer from) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const opts = { isCheckTransactionToSchain: true };
        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, estimatedGasApprove, weiHowMuchApprove,
                opts );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentFromSChain/transfer-from",
                "receipt": joReceiptApprove
            } );
        }
        if( imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() > 0 ) {
            details.write( cc.normal( "Sleeping " ) +
                cc.info( imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() ) +
                cc.normal( " milliseconds between transactions..." ) + "\n" );
            await imaHelperAPIs.sleep(
                imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() );
        }
        if( imaHelperAPIs.getWaitForNextBlockOnSChain() )
            await imaHelperAPIs.safeWaitForNextBlockToAppear( details, ethersProviderSChain );
        strActionName = "ERC1155 payment from S-Chain, exitToMainERC1155";
        const weiHowMuchExitToMainERC1155 = undefined;
        gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasExitToMainERC1155 =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155", arrArgumentsExitToMainERC1155,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchExitToMainERC1155,
                null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(exit to main) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasExitToMainERC1155 ) +
                "\n" );
        }
        const isIgnoreExitToMainERC1155 = true;
        const strErrorOfDryRunExitToMainERC1155 =
            await imaTx.dryRunCall(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155", arrArgumentsExitToMainERC1155,
                joAccountSrc, strActionName, isIgnoreExitToMainERC1155,
                gasPrice, estimatedGasExitToMainERC1155, weiHowMuchExitToMainERC1155,
                null );
        if( strErrorOfDryRunExitToMainERC1155 )
            throw new Error( strErrorOfDryRunExitToMainERC1155 );
        opts.isCheckTransactionToSchain = true;
        const joReceiptExitToMainERC1155 =
            await imaTx.payedCall(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155", arrArgumentsExitToMainERC1155,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasExitToMainERC1155, weiHowMuchExitToMainERC1155, opts );
        if( joReceiptExitToMainERC1155 && typeof joReceiptExitToMainERC1155 == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentFromSChain/exit-to-main",
                "receipt": joReceiptExitToMainERC1155
            } );
        }
        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxySChain ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxySChain.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await imaHelperAPIs.sleep(
                imaHelperAPIs.getMillisecondsSleepBeforeFetchOutgoingMessageEvent() );
            const joFilter = // imaEventLogScan.safeGetUseWen3ForPastEvents()
                // ? {} : 
                joMessageProxySChain.filters[strEventName]();
            const joMessageProxyABI = null;
            const joEvents = await imaEventLogScan.getContractCallEvents(
                details, strLogPrefix, ethersProviderSChain,
                joMessageProxySChain, joMessageProxyABI,
                strEventName,
                joReceiptExitToMainERC1155.blockNumber,
                joReceiptExitToMainERC1155.transactionHash,
                joFilter );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix + cc.success( "Success, verified the " ) +
                    cc.info( strEventName ) + cc.success( " event of the " ) +
                    cc.info( "MessageProxy" ) + cc.success( "/" ) +
                    cc.notice( joMessageProxySChain.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
                    joMessageProxySChain.address + " contract, no events found" );
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
        details.exposeDetailsTo( log, "doErc1155PaymentFromSChain", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "ERC-1155 PAYMENT FROM S-CHAIN", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc1155PaymentFromSChain", true );
    details.close();
    return true;
}

export async function doErc1155BatchPaymentFromSChain(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joTokenManagerERC1155, // only s-chain
    joMessageProxySChain, // for checking logs
    joDepositBox, // only main net
    arrTokenIds, // which ERC1155 token ids to send
    arrTokenAmounts, // which ERC1155 token amounts to send
    weiHowMuch, // how much ETH
    strCoinNameErc1155SMainNet,
    joErc1155MainNet,
    strCoinNameErc1155SChain,
    joErc1155Chain,
    transactionCustomizerSChain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "S2M ERC1155 Batch Payment:" ) + " ";
    try {
        strActionName = "ERC1155 payment from S-Chain, approve";
        const erc1155ABI = joErc1155Chain[strCoinNameErc1155SChain + "_abi"];
        const erc1155AddressSChain = joErc1155Chain[strCoinNameErc1155SChain + "_address"];
        const tokenManagerAddress = joTokenManagerERC1155.address;
        const contractERC1155 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc1155AddressSChain, erc1155ABI, ethersProviderSChain );
        const arrArgumentsApprove = [
            tokenManagerAddress,
            true
        ];
        const erc1155AddressMainNet =
            joErc1155MainNet[strCoinNameErc1155SMainNet + "_address"];
        const arrArgumentsExitToMainERC1155Batch = [
            erc1155AddressMainNet,
            arrTokenIds,
            arrTokenAmounts
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(transfer from) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const opts = { isCheckTransactionToSchain: true };
        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, estimatedGasApprove, weiHowMuchApprove,
                opts );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description":
                    "doErc1155BatchPaymentFromSChain/transfer-from",
                "receipt": joReceiptApprove
            } );
        }
        if( imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() > 0 ) {
            details.write( cc.normal( "Sleeping " ) +
                cc.info( imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() ) +
                cc.normal( " milliseconds between transactions..." ) + "\n" );
            await imaHelperAPIs.sleep(
                imaHelperAPIs.getSleepBetweenTransactionsOnSChainMilliseconds() );
        }
        if( imaHelperAPIs.getWaitForNextBlockOnSChain() )
            await imaHelperAPIs.safeWaitForNextBlockToAppear( details, ethersProviderSChain );
        strActionName = "ERC1155 batch-payment from S-Chain, exitToMainERC1155Batch";
        const weiHowMuchExitToMainERC1155Batch = undefined;
        gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasExitToMainERC1155Batch =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155Batch", arrArgumentsExitToMainERC1155Batch,
                joAccountSrc, strActionName, gasPrice, 8000000,
                weiHowMuchExitToMainERC1155Batch, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(exit to main) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) +
                cc.notice( estimatedGasExitToMainERC1155Batch ) + "\n" );
        }
        const isIgnoreExitToMainERC1155Batch = true;
        const strErrorOfDryRunExitToMainERC1155Batch =
            await imaTx.dryRunCall(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155Batch", arrArgumentsExitToMainERC1155Batch,
                joAccountSrc, strActionName, isIgnoreExitToMainERC1155Batch, gasPrice,
                estimatedGasExitToMainERC1155Batch, weiHowMuchExitToMainERC1155Batch, null );
        if( strErrorOfDryRunExitToMainERC1155Batch )
            throw new Error( strErrorOfDryRunExitToMainERC1155Batch );
        opts.isCheckTransactionToSchain = true;
        const joReceiptExitToMainERC1155Batch =
            await imaTx.payedCall(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155Batch", arrArgumentsExitToMainERC1155Batch,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasExitToMainERC1155Batch, weiHowMuchExitToMainERC1155Batch, opts );
        if( joReceiptExitToMainERC1155Batch &&
            typeof joReceiptExitToMainERC1155Batch == "object"
        ) {
            jarrReceipts.push( {
                "description": "doErc1155BatchPaymentFromSChain/exit-to-main",
                "receipt": joReceiptExitToMainERC1155Batch
            } );
        }
        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxySChain ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxySChain.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await imaHelperAPIs.sleep(
                imaHelperAPIs.getMillisecondsSleepBeforeFetchOutgoingMessageEvent() );
            const joFilter = // imaEventLogScan.safeGetUseWen3ForPastEvents()
                // ? {} : 
                joMessageProxySChain.filters[strEventName]();
            const joMessageProxyABI = null;
            const joEvents = await imaEventLogScan.getContractCallEvents(
                details, strLogPrefix, ethersProviderSChain,
                joMessageProxySChain, joMessageProxyABI,
                strEventName,
                joReceiptExitToMainERC1155Batch.blockNumber,
                joReceiptExitToMainERC1155Batch.transactionHash,
                joFilter );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix + cc.success( "Success, verified the " ) +
                    cc.info( strEventName ) + cc.success( " event of the " ) +
                    cc.info( "MessageProxy" ) + cc.success( "/" ) +
                    cc.notice( joMessageProxySChain.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
                    joMessageProxySChain.address + " contract, no events found" );
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
        details.exposeDetailsTo( log, "doErc1155BatchPaymentFromSChain", false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "ERC-1155 PAYMENT FROM S-CHAIN", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc1155BatchPaymentFromSChain", true );
    details.close();
    return true;
}

export async function doErc20PaymentS2S(
    isForward,
    ethersProviderSrc,
    chainIdSrc,
    strChainNameDst,
    joAccountSrc,
    joTokenManagerERC20Src,
    nAmountOfToken, // how much ERC20 tokens to send
    nAmountOfWei, // how much to send
    strCoinNameErc20Src,
    joSrcErc20,
    ercDstAddress20, // only reverse payment needs it
    tc
) {
    const isReverse = isForward ? false : true;
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix =
        cc.info( "S2S ERC20 Payment(" + ( isForward ? "forward" : "reverse" ) + "):" ) + " ";
    try {
        strActionName =
            "validateArgs/doErc20PaymentS2S/" + ( isForward ? "forward" : "reverse" );
        if( ! ethersProviderSrc )
            throw new Error( "No ethers provider specified for source of transfer" );
        if( ! strChainNameDst )
            throw new Error( "No destination chain name provided" );
        if( ! joAccountSrc )
            throw new Error( "No account or sign TX way provided" );
        if( ! strCoinNameErc20Src )
            throw new Error( "Need full source ERC20 information, like ABI" );
        if( ! joSrcErc20 )
            throw new Error( "No source ERC20 ABI provided" );
        if( isReverse ) {
            if( ! ercDstAddress20 )
                throw new Error( "No destination ERC20 address provided" );
        }
        if( ! tc )
            throw new Error( "No transaction customizer provided" );
        const ercSrcAbi20 = joSrcErc20[strCoinNameErc20Src + "_abi"];
        const ercSrcAddress20 = joSrcErc20[strCoinNameErc20Src + "_address"];
        details.write( strLogPrefix + cc.attention( "Token Manager ERC20" ) +
            cc.debug( " address on source chain...." ) +
            cc.note( joTokenManagerERC20Src.address ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC20" ) +
            cc.debug( " coin name........................." ) +
            cc.note( strCoinNameErc20Src ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC20" ) +
            cc.debug( " token address....................." ) +
            cc.note( ercSrcAddress20 ) + "\n" );
        if( isReverse || ercDstAddress20 ) {
            details.write( strLogPrefix + cc.attention( "Destination ERC20" ) +
                cc.debug( " token address................" ) +
                cc.note( ercDstAddress20 ) + "\n" );
        }
        details.write( strLogPrefix + cc.attention( "Destination chain name" ) +
            cc.debug( "........................." ) +
            cc.note( strChainNameDst ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Amount of tokens" ) +
            cc.debug( " to transfer..................." ) +
            cc.note( nAmountOfToken ) + "\n" );
        strActionName = "ERC20 payment S2S, approve, " + ( isForward ? "forward" : "reverse" );
        const contractERC20 =
            new owaspUtils.ethersMod.ethers.Contract(
                ercSrcAddress20, ercSrcAbi20, ethersProviderSrc );
        const arrArgumentsApprove = [
            joTokenManagerERC20Src.address,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmountOfToken ).toHexString() )
        ];
        const arrArgumentsTransfer = [
            strChainNameDst,
            isReverse ? ercDstAddress20 : ercSrcAddress20,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmountOfToken ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await tc.computeGas(
                details, ethersProviderSrc,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderSrc,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderSrc,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description":
                    "doErc20PaymentS2S/approve/" + ( isForward ? "forward" : "reverse" ),
                "receipt": joReceiptApprove
            } );
        }
        strActionName =
            "ERC20 payment S2S, transferERC20 " + ( isForward ? "forward" : "reverse" );
        const weiHowMuchTransferERC20 = undefined;
        gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasTransfer =
            await tc.computeGas(
                details, ethersProviderSrc,
                "TokenManagerERC20", joTokenManagerERC20Src,
                "transferToSchainERC20", arrArgumentsTransfer,
                joAccountSrc, strActionName, gasPrice,
                8000000, weiHowMuchTransferERC20, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(transfer) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasTransfer ) + "\n" );
        }
        const isIgnoreTransferERC20 = true;
        const strErrorOfDryRunTransferERC20 =
            await imaTx.dryRunCall(
                details, ethersProviderSrc,
                "TokenManagerERC20", joTokenManagerERC20Src,
                "transferToSchainERC20", arrArgumentsTransfer,
                joAccountSrc, strActionName, isIgnoreTransferERC20,
                gasPrice, estimatedGasTransfer, weiHowMuchTransferERC20, null );
        if( strErrorOfDryRunTransferERC20 )
            throw new Error( strErrorOfDryRunTransferERC20 );
        const joReceiptTransfer =
            await imaTx.payedCall(
                details, ethersProviderSrc,
                "TokenManagerERC20", joTokenManagerERC20Src,
                "transferToSchainERC20", arrArgumentsTransfer,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasTransfer, weiHowMuchTransferERC20, null );
        if( joReceiptTransfer && typeof joReceiptTransfer == "object" ) {
            jarrReceipts.push( {
                "description": "doErc20PaymentS2S/transfer",
                "receipt": joReceiptTransfer
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
        details.exposeDetailsTo(
            log, "doErc20PaymentS2S/" + ( isForward ? "forward" : "reverse" ), false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray( "ERC-20 PAYMENT FROM S2S/" +
        ( isForward ? "forward" : "reverse" ), jarrReceipts, details );
    if( log.exposeDetailsGet() ) {
        details.exposeDetailsTo(
            log, "doErc20PaymentS2S/" + ( isForward ? "forward" : "reverse" ), true );
    }
    details.close();
    return true;
}

export async function doErc721PaymentS2S(
    isForward,
    ethersProviderSrc,
    chainIdSrc,
    strChainNameDst,
    joAccountSrc,
    joTokenManagerERC721Src,
    tokenId, // which ERC721 token id to send
    nAmountOfWei, // how much to send
    strCoinNameErc721Src,
    joSrcErc721,
    ercDstAddress721, // only reverse payment needs it
    tc
) {
    const isReverse = isForward ? false : true;
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix =
        cc.info( "S2S ERC721 Payment(" + ( isForward ? "forward" : "reverse" ) + "):" ) + " ";
    try {
        strActionName =
            "validateArgs/doErc721PaymentS2S/" + ( isForward ? "forward" : "reverse" );
        if( ! ethersProviderSrc )
            throw new Error( "No provider for source of transfer" );
        if( ! strChainNameDst )
            throw new Error( "No destination chain name provided" );
        if( ! joAccountSrc )
            throw new Error( "No account or sign TX way provided" );
        if( ! strCoinNameErc721Src )
            throw new Error( "Need full source ERC721 information, like ABI" );
        if( ! joSrcErc721 )
            throw new Error( "No source ERC721 ABI provided" );
        if( isReverse ) {
            if( ! ercDstAddress721 )
                throw new Error( "No destination ERC721 address provided" );
        }
        if( ! tc )
            throw new Error( "No transaction customizer provided" );
        const ercSrcAbi721 = joSrcErc721[strCoinNameErc721Src + "_abi"];
        const ercSrcAddress721 = joSrcErc721[strCoinNameErc721Src + "_address"];
        details.write( strLogPrefix + cc.attention( "Token Manager ERC721" ) +
            cc.debug( " address on source chain...." ) +
            cc.note( joTokenManagerERC721Src.address ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC721" ) +
            cc.debug( " coin name........................." ) +
            cc.note( strCoinNameErc721Src ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC721" ) +
            cc.debug( " token address....................." ) +
            cc.note( ercSrcAddress721 ) + "\n" );
        if( isReverse || ercDstAddress721 ) {
            details.write( strLogPrefix + cc.attention( "Destination ERC721" ) +
                cc.debug( " token address................" ) +
                cc.note( ercDstAddress721 ) + "\n" );
        }
        details.write( strLogPrefix + cc.attention( "Destination chain name" ) +
            cc.debug( "........................." ) + cc.note( strChainNameDst ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Token ID" ) +
            cc.debug( " to transfer..........................." ) + cc.note( tokenId ) + "\n" );
        strActionName = "ERC721 payment S2S, approve, " + ( isForward ? "forward" : "reverse" );
        const contractERC721 =
            new owaspUtils.ethersMod.ethers.Contract(
                ercSrcAddress721, ercSrcAbi721, ethersProviderSrc );
        const arrArgumentsApprove = [
            joTokenManagerERC721Src.address,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const arrArgumentsTransfer = [
            strChainNameDst,
            isReverse ? ercDstAddress721 : ercSrcAddress721,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await tc.computeGas(
                details, ethersProviderSrc,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderSrc,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderSrc,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description":
                    "doErc721PaymentS2S/approve/" + ( isForward ? "forward" : "reverse" ),
                "receipt": joReceiptApprove
            } );
        }
        const isIgnoreTransferERC721 = true;
        strActionName =
            "ERC721 payment S2S, transferERC721 " + ( isForward ? "forward" : "reverse" );
        const weiHowMuchTransferERC721 = undefined;
        gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasTransfer =
            await tc.computeGas(
                details, ethersProviderSrc,
                "TokenManagerERC721", joTokenManagerERC721Src,
                "transferToSchainERC721", arrArgumentsTransfer,
                joAccountSrc, strActionName, isIgnoreTransferERC721,
                gasPrice, 8000000, weiHowMuchTransferERC721, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(transfer) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasTransfer ) + "\n" );
        }
        const strErrorOfDryRunTransferERC721 =
            await imaTx.dryRunCall(
                details, ethersProviderSrc,
                "TokenManagerERC721", joTokenManagerERC721Src,
                "transferToSchainERC721", arrArgumentsTransfer,
                joAccountSrc, strActionName, isIgnoreTransferERC721,
                gasPrice, estimatedGasTransfer, weiHowMuchTransferERC721, null );
        if( strErrorOfDryRunTransferERC721 )
            throw new Error( strErrorOfDryRunTransferERC721 );
        const joReceiptTransfer =
            await imaTx.payedCall(
                details, ethersProviderSrc,
                "TokenManagerERC721", joTokenManagerERC721Src,
                "transferToSchainERC721", arrArgumentsTransfer,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasTransfer, weiHowMuchTransferERC721, null );
        if( joReceiptTransfer && typeof joReceiptTransfer == "object" ) {
            jarrReceipts.push( {
                "description": "doErc721PaymentS2S/transfer",
                "receipt": joReceiptTransfer
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
        details.exposeDetailsTo(
            log,
            "doErc721PaymentS2S/" + ( isForward ? "forward" : "reverse" ), false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray( "ERC-721 PAYMENT FROM S2S/" +
        ( isForward ? "forward" : "reverse" ), jarrReceipts, details );
    if( log.exposeDetailsGet() ) {
        details.exposeDetailsTo(
            log,
            "doErc721PaymentS2S/" + ( isForward ? "forward" : "reverse" ),
            true );
    }
    details.close();
    return true;
}

export async function doErc1155PaymentS2S(
    isForward,
    ethersProviderSrc,
    chainIdSrc,
    strChainNameDst,
    joAccountSrc,
    joTokenManagerERC1155Src,
    tokenId, // which ERC721 token id to send
    nAmountOfToken, // how much ERC1155 tokens to send
    nAmountOfWei, // how much to send
    strCoinNameErc1155Src,
    joSrcErc1155,
    ercDstAddress1155, // only reverse payment needs it
    tc
) {
    const isReverse = isForward ? false : true;
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix =
        cc.info( "S2S ERC1155 Payment(" + ( isForward ? "forward" : "reverse" ) + "):" ) + " ";
    try {
        strActionName =
            "validateArgs/doErc1155PaymentS2S/" + ( isForward ? "forward" : "reverse" );
        if( ! ethersProviderSrc )
            throw new Error( "No provider for source of transfer" );
        if( ! strChainNameDst )
            throw new Error( "No destination chain name provided" );
        if( ! joAccountSrc )
            throw new Error( "No account or sign TX way provided" );
        if( ! strCoinNameErc1155Src )
            throw new Error( "Need full source ERC1155 information, like ABI" );
        if( ! joSrcErc1155 )
            throw new Error( "No source ERC1155 ABI provided" );
        if( isReverse ) {
            if( ! ercDstAddress1155 )
                throw new Error( "No destination ERC1155 address provided" );
        }
        if( ! tc )
            throw new Error( "No transaction customizer provided" );
        const ercSrcAbi1155 = joSrcErc1155[strCoinNameErc1155Src + "_abi"];
        const ercSrcAddress1155 = joSrcErc1155[strCoinNameErc1155Src + "_address"];
        details.write( strLogPrefix + cc.attention( "Token Manager ERC1155" ) +
            cc.debug( " address on source chain...." ) +
            cc.note( joTokenManagerERC1155Src.address ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC1155" ) +
            cc.debug( " coin name........................." ) +
            cc.note( strCoinNameErc1155Src ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC1155" ) +
            cc.debug( " token address....................." ) +
            cc.note( ercSrcAddress1155 ) + "\n" );
        if( isReverse || ercDstAddress1155 ) {
            details.write( strLogPrefix + cc.attention( "Destination ERC1155" ) +
                cc.debug( " token address................" ) +
                cc.note( ercDstAddress1155 ) + "\n" );
        }
        details.write( strLogPrefix + cc.attention( "Destination chain name" ) +
            cc.debug( "........................." ) + cc.note( strChainNameDst ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Token ID" ) +
            cc.debug( " to transfer..........................." ) + cc.note( tokenId ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Amount of tokens" ) +
            cc.debug( " to transfer..................." ) + cc.note( nAmountOfToken ) + "\n" );
        strActionName = "ERC1155 payment S2S, approve, " + ( isForward ? "forward" : "reverse" );
        const contractERC1155 =
            new owaspUtils.ethersMod.ethers.Contract(
                ercSrcAddress1155, ercSrcAbi1155, ethersProviderSrc );
        const arrArgumentsApprove = [
            joTokenManagerERC1155Src.address,
            true
        ];
        const arrArgumentsTransfer = [
            strChainNameDst,
            isReverse ? ercDstAddress1155 : ercSrcAddress1155,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() ),
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmountOfToken ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await tc.computeGas(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description":
                    "doErc1155PaymentS2S/approve/" + ( isForward ? "forward" : "reverse" ),
                "receipt": joReceiptApprove
            } );
        }
        strActionName =
            "ERC1155 payment S2S, transferERC1155 " + ( isForward ? "forward" : "reverse" );
        const weiHowMuchTransferERC1155 = undefined;
        gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasTransfer =
            await tc.computeGas(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155", arrArgumentsTransfer,
                joAccountSrc, strActionName, gasPrice,
                8000000, weiHowMuchTransferERC1155, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(transfer) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasTransfer ) + "\n" );
        }
        const isIgnoreTransferERC1155 = true;
        const strErrorOfDryRunTransferERC1155 =
            await imaTx.dryRunCall(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155", arrArgumentsTransfer,
                joAccountSrc, strActionName, isIgnoreTransferERC1155, gasPrice,
                estimatedGasTransfer, weiHowMuchTransferERC1155, null );
        if( strErrorOfDryRunTransferERC1155 )
            throw new Error( strErrorOfDryRunTransferERC1155 );
        const joReceiptTransfer =
            await imaTx.payedCall(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155", arrArgumentsTransfer,
                joAccountSrc, strActionName, gasPrice, estimatedGasTransfer,
                weiHowMuchTransferERC1155, null );
        if( joReceiptTransfer && typeof joReceiptTransfer == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentS2S/transfer",
                "receipt": joReceiptTransfer
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
        details.exposeDetailsTo(
            log, "doErc1155PaymentS2S/" + ( isForward ? "forward" : "reverse" ), false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray( "ERC-1155 PAYMENT FROM S2S/" +
        ( isForward ? "forward" : "reverse" ), jarrReceipts, details );
    if( log.exposeDetailsGet() ) {
        details.exposeDetailsTo(
            log, "doErc1155PaymentS2S/" + ( isForward ? "forward" : "reverse" ), true );
    }
    details.close();
    return true;
}

export async function doErc1155BatchPaymentS2S(
    isForward,
    ethersProviderSrc,
    chainIdSrc,
    strChainNameDst,
    joAccountSrc,
    joTokenManagerERC1155Src,
    arrTokenIds, // which ERC1155 token id to send
    arrTokenAmounts, // which ERC1155 token id to send
    nAmountOfWei, // how much to send
    strCoinNameErc1155Src,
    joSrcErc1155,
    ercDstAddress1155, // only reverse payment needs it
    tc
) {
    const isReverse = isForward ? false : true;
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix =
        cc.info( "S2S Batch ERC1155 Payment(" +
            ( isForward ? "forward" : "reverse" ) + "):" ) + " ";
    try {
        strActionName =
            "validateArgs/doErc1155BatchPaymentS2S/" +
                ( isForward ? "forward" : "reverse" );
        if( ! ethersProviderSrc )
            throw new Error( "No provider for source of transfer" );
        if( ! strChainNameDst )
            throw new Error( "No destination chain name provided" );
        if( ! joAccountSrc )
            throw new Error( "No account or sign TX way provided" );
        if( ! strCoinNameErc1155Src )
            throw new Error( "Need full source ERC1155 information, like ABI" );
        if( ! joSrcErc1155 )
            throw new Error( "No source ERC1155 ABI provided" );
        if( isReverse ) {
            if( ! ercDstAddress1155 )
                throw new Error( "No destination ERC1155 address provided" );
        }
        if( ! tc )
            throw new Error( "No transaction customizer provided" );
        const ercSrcAbi1155 = joSrcErc1155[strCoinNameErc1155Src + "_abi"];
        const ercSrcAddress1155 = joSrcErc1155[strCoinNameErc1155Src + "_address"];
        details.write( strLogPrefix + cc.attention( "Token Manager ERC1155" ) +
            cc.debug( " address on source chain...." ) +
            cc.note( joTokenManagerERC1155Src.address ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC1155" ) +
            cc.debug( " coin name........................." ) +
            cc.note( strCoinNameErc1155Src ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC1155" ) +
            cc.debug( " token address....................." ) +
            cc.note( ercSrcAddress1155 ) + "\n" );
        if( isReverse || ercDstAddress1155 ) {
            details.write( strLogPrefix + cc.attention( "Destination ERC1155" ) +
                cc.debug( " token address................" ) +
                cc.note( ercDstAddress1155 ) + "\n" );
        }
        details.write( strLogPrefix + cc.attention( "Destination chain name" ) +
            cc.debug( "........................." ) + cc.note( strChainNameDst ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Token IDs" ) +
            cc.debug( " to transfer.........................." ) + cc.j( arrTokenIds ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Amounts of tokens" ) +
            cc.debug( " to transfer.................." ) + cc.j( arrTokenAmounts ) + "\n" );
        strActionName =
            "ERC1155 batch-payment S2S, approve, " + ( isForward ? "forward" : "reverse" );
        const contractERC1155 =
            new owaspUtils.ethersMod.ethers.Contract(
                ercSrcAddress1155, ercSrcAbi1155, ethersProviderSrc );
        const arrArgumentsApprove = [
            joTokenManagerERC1155Src.address,
            true
        ];
        const arrArgumentsTransfer = [
            strChainNameDst,
            isReverse ? ercDstAddress1155 : ercSrcAddress1155,
            arrTokenIds,
            arrTokenAmounts
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasApprove =
            await tc.computeGas(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        }
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await imaTx.dryRunCall(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await imaTx.payedCall(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description":
                    "doErc1155BatchPaymentS2S/approve/" +
                        ( isForward ? "forward" : "reverse" ),
                "receipt": joReceiptApprove
            } );
        }
        strActionName =
            "ERC1155 batch-payment S2S, transferERC1155 " + ( isForward ? "forward" : "reverse" );
        const weiHowMuchTransferERC1155 = undefined;
        gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) +
                cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasTransfer =
            await tc.computeGas(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155Batch", arrArgumentsTransfer,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchTransferERC1155, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated(transfer) " ) +
                cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasTransfer ) + "\n" );
        }
        const isIgnoreTransferERC1155 = true;
        const strErrorOfDryRunTransferERC1155 =
            await imaTx.dryRunCall(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155Batch", arrArgumentsTransfer,
                joAccountSrc, strActionName, isIgnoreTransferERC1155,
                gasPrice, estimatedGasTransfer, weiHowMuchTransferERC1155, null );
        if( strErrorOfDryRunTransferERC1155 )
            throw new Error( strErrorOfDryRunTransferERC1155 );
        const joReceiptTransfer =
            await imaTx.payedCall(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155Batch", arrArgumentsTransfer,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasTransfer, weiHowMuchTransferERC1155, null );
        if( joReceiptTransfer && typeof joReceiptTransfer == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentS2S/transfer",
                "receipt": joReceiptTransfer
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
        details.exposeDetailsTo(
            log, "doErc1155BatchPaymentS2S/" + ( isForward ? "forward" : "reverse" ), false );
        details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray( "ERC-1155-batch PAYMENT FROM S2S/" +
        ( isForward ? "forward" : "reverse" ), jarrReceipts, details );
    if( log.exposeDetailsGet() ) {
        details.exposeDetailsTo(
            log, "doErc1155BatchPaymentS2S/" + ( isForward ? "forward" : "reverse" ), true );
    }
    details.close();
    return true;
}

export async function mintErc20(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    strAddressMintTo,
    nAmount,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "mintErc20() init";
    const strLogPrefix = cc.info( "mintErc20() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix +
            cc.debug( "Mint " ) + cc.info( "ERC20" ) + cc.debug( " token amount " ) +
            cc.notice( nAmount ) + "\n" );
        if( ! ( ethersProvider && joAccount && strAddressMintTo &&
            typeof strAddressMintTo == "string" && strAddressMintTo.length > 0 &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "mintErc20() instantiate token contract";
        const contract = new owaspUtils.ethersMod.ethers.Contract(
            strTokenContractAddress,
            joTokenContractABI,
            ethersProvider
        );
        const arrArgumentsMint = [
            strAddressMintTo,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmount ).toHexString() )
        ];
        const weiHowMuchMint = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasMint =
            await tc.computeGas(
                details, ethersProvider,
                "ERC20", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchMint, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGasMint ) + "\n" );
        }
        strActionName = "Mint ERC20";
        const isIgnoreMint = false;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProvider,
                "ERC20", contract, "mint", arrArgumentsMint,
                joAccount, strActionName, isIgnoreMint,
                gasPrice, estimatedGasMint, weiHowMuchMint, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await imaTx.payedCall(
                details, ethersProvider,
                "ERC20", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, estimatedGasMint, weiHowMuchMint, opts );
        imaGasUsage.printGasUsageReportFromArray( "MINT ERC20 ", [ {
            "description": "mintErc20()/mint",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "mintErc20", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in mintErc20() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in mintErc20() during " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "mintErc20()", false );
        details.close();
        return false;
    }
}

export async function mintErc721(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    strAddressMintTo,
    idToken,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "mintErc721() init";
    const strLogPrefix = cc.info( "mintErc721() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix + cc.debug( "Mint " ) + cc.info( "ERC721" ) +
            cc.debug( " token ID " ) + cc.notice( idToken ) + "\n" );
        if( ! ( ethersProvider && joAccount && strAddressMintTo &&
            typeof strAddressMintTo == "string" && strAddressMintTo.length > 0 &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "mintErc721() instantiate token contract";
        const contract =
            new owaspUtils.ethersMod.ethers.Contract(
                strTokenContractAddress,
                joTokenContractABI,
                ethersProvider
            );
        const arrArgumentsMint = [
            strAddressMintTo,
            owaspUtils.ensureStartsWith0x(
                owaspUtils.toBN( idToken ).toHexString() )
        ];
        const weiHowMuchMint = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasMint =
            await tc.computeGas(
                details, ethersProvider,
                "ERC721", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchMint, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGasMint ) + "\n" );
        }
        strActionName = "Mint ERC721";
        const isIgnoreMint = false;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProvider,
                "ERC721", contract, "mint", arrArgumentsMint,
                joAccount, strActionName, isIgnoreMint,
                gasPrice, estimatedGasMint, weiHowMuchMint, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await imaTx.payedCall(
                details, ethersProvider,
                "ERC721", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, estimatedGasMint, weiHowMuchMint, opts );
        imaGasUsage.printGasUsageReportFromArray( "MINT ERC721 ", [ {
            "description": "mintErc721()/mint",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "mintErc721", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in mintErc721() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in mintErc721() during " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "mintErc721()", false );
        details.close();
        return false;
    }
}

export async function mintErc1155(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    strAddressMintTo,
    idToken,
    nAmount,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "mintErc1155() init";
    const strLogPrefix = cc.info( "mintErc1155() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix +
            cc.debug( "Mint " ) + cc.info( "ERC1155" ) + cc.debug( " token ID " ) +
            cc.notice( idToken ) + cc.debug( " token amount " ) + cc.notice( nAmount ) +
            "\n" );
        if( ! ( ethersProvider && joAccount && strAddressMintTo &&
            typeof strAddressMintTo == "string" && strAddressMintTo.length > 0 &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "mintErc1155() instantiate token contract";
        const contract =
            new owaspUtils.ethersMod.ethers.Contract(
                strTokenContractAddress,
                joTokenContractABI,
                ethersProvider
            );
        const arrArgumentsMint = [
            strAddressMintTo,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( idToken ).toHexString() ),
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmount ).toHexString() ),
            [] // data
        ];
        const weiHowMuchMint = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasMint =
            await tc.computeGas(
                details, ethersProvider,
                "ERC1155", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchMint, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGasMint ) + "\n" );
        }
        strActionName = "Mint ERC1155";
        const isIgnoreMint = false;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProvider,
                "ERC1155", contract, "mint", arrArgumentsMint,
                joAccount, strActionName, isIgnoreMint,
                gasPrice, estimatedGasMint, weiHowMuchMint, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await imaTx.payedCall(
                details, ethersProvider,
                "ERC1155", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, estimatedGasMint, weiHowMuchMint, opts );
        imaGasUsage.printGasUsageReportFromArray( "MINT ERC1155 ", [ {
            "description": "mintErc1155()/mint",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "mintErc1155", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in mintErc1155() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in mintErc1155() during " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "mintErc1155()", false );
        details.close();
        return false;
    }
}

export async function burnErc20(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    strAddressBurnFrom,
    nAmount,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "burnErc20() init";
    const strLogPrefix = cc.info( "burnErc20() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix + cc.debug( "Burn " ) + cc.info( "ERC20" ) +
            cc.debug( " token amount " ) + cc.notice( nAmount ) + "\n" );
        if( ! ( ethersProvider && joAccount && strAddressBurnFrom &&
            typeof strAddressBurnFrom == "string" && strAddressBurnFrom.length > 0 &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "burnErc20() instantiate token contract";
        const contract =
            new owaspUtils.ethersMod.ethers.Contract(
                strTokenContractAddress,
                joTokenContractABI,
                ethersProvider
            );
        const arrArgumentsBurn = [
            strAddressBurnFrom,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmount ).toHexString() )
        ];
        const weiHowMuchBurn = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasBurn =
            await tc.computeGas(
                details, ethersProvider,
                "ERC20", contract, "burnFrom", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchBurn, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGasBurn ) + "\n" );
        }
        strActionName = "Burn ERC20";
        const isIgnoreBurn = false;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProvider,
                "ERC20", contract, "burnFrom", arrArgumentsBurn,
                joAccount, strActionName, isIgnoreBurn,
                gasPrice, estimatedGasBurn, weiHowMuchBurn, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await imaTx.payedCall(
                details, ethersProvider,
                "ERC20", contract, "burnFrom", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, estimatedGasBurn, weiHowMuchBurn, opts );
        imaGasUsage.printGasUsageReportFromArray( "BURN ERC20 ", [ {
            "description": "burnErc20()/burn",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "burnErc20", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in burnErc20() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in burnErc20() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "burnErc20()", false );
        details.close();
        return false;
    }
}

export async function burnErc721(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    idToken,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "burnErc721() init";
    const strLogPrefix = cc.info( "burnErc721() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix + cc.debug( "Burn " ) + cc.info( "ERC721" ) +
            cc.debug( " token ID " ) + cc.notice( idToken ) + "\n" );
        if( ! ( ethersProvider && joAccount &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "burnErc721() instantiate token contract";
        const contract =
            new owaspUtils.ethersMod.ethers.Contract(
                strTokenContractAddress,
                joTokenContractABI,
                ethersProvider
            );
        const arrArgumentsBurn = [
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( idToken ).toHexString() )
        ];
        const weiHowMuchBurn = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasBurn =
            await tc.computeGas(
                details, ethersProvider,
                "ERC721", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchBurn, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGasBurn ) + "\n" );
        }
        strActionName = "Burn ERC721";
        const isIgnoreBurn = false;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProvider,
                "ERC721", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName, isIgnoreBurn,
                gasPrice, estimatedGasBurn, weiHowMuchBurn, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await imaTx.payedCall(
                details, ethersProvider,
                "ERC721", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, estimatedGasBurn, weiHowMuchBurn, opts );
        imaGasUsage.printGasUsageReportFromArray( "BURN ERC721 ", [ {
            "description": "burnErc721()/burn",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "burnErc721", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in burnErc721() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) +
                    "\n" + cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in burnErc721() during " +
                strActionName + ": " ) + cc.error( strError ) + cc.error( ", stack is: " ) +
                "\n" + cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "burnErc721()", false );
        details.close();
        return false;
    }
}

export async function burnErc1155(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    strAddressBurnFrom,
    idToken,
    nAmount,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "burnErc1155() init";
    const strLogPrefix = cc.info( "burnErc1155() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix +
            cc.debug( "Burn " ) + cc.info( "ERC1155" ) + cc.debug( " token ID " ) +
            cc.notice( idToken ) + cc.debug( " token amount " ) + cc.notice( nAmount ) +
            "\n" );
        if( ! ( ethersProvider && joAccount && strAddressBurnFrom &&
            typeof strAddressBurnFrom == "string" && strAddressBurnFrom.length > 0 &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "burnErc1155() instantiate token contract";
        const contract =
            new owaspUtils.ethersMod.ethers.Contract(
                strTokenContractAddress,
                joTokenContractABI,
                ethersProvider
            );
        const arrArgumentsBurn = [
            strAddressBurnFrom,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( idToken ).toHexString() ),
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmount ).toHexString() )
        ];
        const weiHowMuchBurn = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGasBurn =
            await tc.computeGas(
                details, ethersProvider,
                "ERC1155", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchBurn, null );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGasBurn ) + "\n" );
        }
        strActionName = "Burn ERC1155";
        const isIgnoreBurn = false;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProvider,
                "ERC1155", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName, isIgnoreBurn,
                gasPrice, estimatedGasBurn, weiHowMuchBurn, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            ToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await imaTx.payedCall(
                details, ethersProvider,
                "ERC1155", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, estimatedGasBurn, weiHowMuchBurn, opts );
        imaGasUsage.printGasUsageReportFromArray( "BURN ERC1155 ", [ {
            "description": "burnErc1155()/burn",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "burnErc1155", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in burnErc1155() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in burnErc1155() during " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "burnErc1155()", false );
        details.close();
        return false;
    }
}
