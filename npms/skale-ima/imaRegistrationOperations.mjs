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
 * @file imaRegistrationOperations.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as log from "../skale-log/log.mjs";
import * as cc from "../skale-cc/cc.mjs";

import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as imaHelperAPIs from "./imaHelperAPIs.mjs";
import * as imaTx from "./imaTx.mjs";

export async function invokeHasChain(
    details,
    ethersProvider, // Main-Net or S-Chin
    joLinker, // Main-Net or S-Chin
    joAccount, // Main-Net or S-Chin
    chainIdSChain
) {
    const strLogPrefix = cc.sunny( "Wait for added chain status:" ) + " ";
    const strActionName = "invokeHasChain(hasSchain): joLinker.hasSchain";
    try {
        details.write( strLogPrefix + cc.debug( "Will call " ) + cc.notice( strActionName ) +
            cc.debug( "..." ) + "\n" );
        const addressFrom = joAccount.address();
        const bHasSchain =
            await joLinker.callStatic.hasSchain( chainIdSChain, { from: addressFrom } );
        details.write( strLogPrefix +
            cc.success( "Got joLinker.hasSchain() status is: " ) + cc.attention( bHasSchain ) +
            "\n" );
        return bHasSchain;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( "Error in invokeHasChain() during " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
    }
    return false;
}

export async function waitForHasChain(
    details,
    ethersProvider, // Main-Net or S-Chin
    joLinker, // Main-Net or S-Chin
    joAccount, // Main-Net or S-Chin
    chainIdSChain,
    cntWaitAttempts,
    nSleepMilliseconds
) {
    if( cntWaitAttempts == null || cntWaitAttempts == undefined )
        cntWaitAttempts = 100;
    if( nSleepMilliseconds == null || nSleepMilliseconds == undefined )
        nSleepMilliseconds = 5;
    for( let idxWaitAttempts = 0; idxWaitAttempts < cntWaitAttempts; ++ idxWaitAttempts ) {
        if( await invokeHasChain(
            details, ethersProvider, joLinker, joAccount, chainIdSChain
        ) )
            return true;
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( cc.normal( "Sleeping " ) + cc.info( nSleepMilliseconds ) +
                cc.normal( " milliseconds..." ) + "\n" );
        }
        await imaHelperAPIs.sleep( nSleepMilliseconds );
    }
    return false;
}

//
// register direction for money transfer
// main-net.DepositBox call: function addSchain(string schainName, address tokenManagerAddress)
//
export async function checkIsRegisteredSChainInDepositBoxes( // step 1
    ethersProviderMainNet,
    joLinker,
    joAccountMN,
    chainIdSChain
) {
    const details = log.createMemoryStream();
    details.write( cc.info( "Main-net " ) + cc.sunny( "Linker" ) +
        cc.info( "  address is....." ) + cc.bright( joLinker.address ) + "\n" );
    details.write( cc.info( "S-Chain  " ) + cc.sunny( "ID" ) +
        cc.info( " is......................." ) + cc.bright( chainIdSChain ) + "\n" );
    const strLogPrefix = cc.note( "RegChk S in depositBox:" ) + " ";
    details.write( strLogPrefix + cc.debug( imaHelperAPIs.longSeparator ) + "\n" );
    details.write( strLogPrefix +
        cc.bright( "checkIsRegisteredSChainInDepositBoxes(reg-step1)" ) + "\n" );
    details.write( strLogPrefix + cc.debug( imaHelperAPIs.longSeparator ) + "\n" );
    let strActionName = "";
    try {
        strActionName = "checkIsRegisteredSChainInDepositBoxes(reg-step1)";
        const addressFrom = joAccountMN.address();
        const bIsRegistered =
            await joLinker.callStatic.hasSchain( chainIdSChain, { from: addressFrom } );
        details.write( strLogPrefix +
            cc.success( "checkIsRegisteredSChainInDepositBoxes(reg-step1) status is: " ) +
            cc.attention( bIsRegistered ) +
            "\n" );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "checkIsRegisteredSChainInDepositBoxes", true );
        details.close();
        return bIsRegistered;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error(
                    " Error in checkIsRegisteredSChainInDepositBoxes(reg-step1)() during " +
                strActionName + ": " ) + cc.error( strError ) + cc.error( ", stack is: " ) +
                "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "checkIsRegisteredSChainInDepositBoxes", false );
        details.close();
    }
    return false;
}

export async function registerSChainInDepositBoxes( // step 1
    ethersProviderMainNet,
    joLinker,
    joAccountMN,
    joTokenManagerETH, // only s-chain
    joTokenManagerERC20, // only s-chain
    joTokenManagerERC721, // only s-chain
    joTokenManagerERC1155, // only s-chain
    joTokenManagerERC721WithMetadata, // only s-chain
    joCommunityLocker, // only s-chain
    joTokenManagerLinker,
    chainNameSChain,
    chainNameMainNet,
    transactionCustomizerMainNet,
    cntWaitAttempts,
    nSleepMilliseconds
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    details.write( cc.info( "Main-net " ) + cc.sunny( "Linker" ) +
        cc.info( "  address is......." ) + cc.bright( joLinker.address ) + "\n" );
    details.write( cc.info( "S-Chain  " ) + cc.sunny( "ID" ) +
        cc.info( " is......................." ) + cc.bright( chainNameSChain ) + "\n" );
    const strLogPrefix = cc.sunny( "Reg S in depositBoxes:" ) + " ";
    details.write( strLogPrefix + cc.debug( imaHelperAPIs.longSeparator ) + "\n" );
    details.write( strLogPrefix +
        cc.bright( "reg-step1:registerSChainInDepositBoxes" ) + "\n" );
    details.write( strLogPrefix + cc.debug( imaHelperAPIs.longSeparator ) + "\n" );
    let strActionName = "";
    try {
        strActionName = "Register S-chain in deposit boxes, step 1, connectSchain";
        details.write( strLogPrefix +
            cc.debug( "Will register S-Chain in lock_and_data on Main-net" ) + "\n" );
        const arrArguments = [
            chainNameSChain,
            [
                joTokenManagerLinker.address, // call params
                joCommunityLocker.address, // call params
                joTokenManagerETH.address, // call params
                joTokenManagerERC20.address, // call params
                joTokenManagerERC721.address, // call params
                joTokenManagerERC1155.address, // call params
                joTokenManagerERC721WithMetadata.address // call params
            ]
        ];
        const weiHowMuch = undefined;
        const gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
                cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        }
        const estimatedGas =
            await transactionCustomizerMainNet.computeGas(
                details,
                ethersProviderMainNet,
                "Linker", joLinker, "connectSchain", arrArguments,
                joAccountMN, strActionName,
                gasPrice, 3000000, weiHowMuch,
                null
            );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                cc.debug( "=" ) + cc.notice( estimatedGas ) + "\n" );
        }
        const isIgnore = false;
        const strErrorOfDryRun =
            await imaTx.dryRunCall(
                details, ethersProviderMainNet,
                "Linker", joLinker, "connectSchain", arrArguments,
                joAccountMN, strActionName, isIgnore,
                gasPrice, estimatedGas, weiHowMuch, null );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const joReceipt =
            await imaTx.payedCall(
                details, ethersProviderMainNet,
                "Linker", joLinker, "connectSchain", arrArguments,
                joAccountMN, strActionName,
                gasPrice, estimatedGas, weiHowMuch, null );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "registerSChainInDepositBoxes",
                "receipt": joReceipt
            } );
        }
        const isSChainStatusOKay = await waitForHasChain(
            details, ethersProviderMainNet,
            joLinker, joAccountMN, chainNameSChain,
            cntWaitAttempts, nSleepMilliseconds );
        if( ! isSChainStatusOKay )
            throw new Error( "S-Chain ownership status check timeout" );
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in registerSChainInDepositBoxes() during " +
                strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) +
                "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "registerSChainInDepositBoxes", false );
        details.close();
        return null;
    }
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "registerSChainInDepositBoxes", true );
    details.close();
    return jarrReceipts;
}
