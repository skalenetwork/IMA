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
import * as rpcCall from "./rpcCall.mjs";
import * as skaleObserver from "../npms/skale-observer/observer.mjs";
import * as loop from "./loop.mjs";
import * as imaUtils from "./utils.mjs";
import * as IMA from "../npms/skale-ima/index.mjs";
import * as imaBLS from "./bls.mjs";
import * as pwa from "./pwa.mjs";

import * as state from "./state.mjs";

// allow self-signed wss and https
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

function initialSkaleNetworkScanForS2S() {
    const imaState = state.get();
    if( ! imaState.optsS2S.isEnabled )
        return;
    imaState.arrActions.push( {
        "name": "SKALE network scan for S2S",
        "fn": async function() {
            const strLogPrefix = cc.info( "SKALE network scan for S2S:" ) + " ";
            if( imaState.strPathAbiJsonSkaleManager.length === 0 ) {
                console.log( cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " missing Skale Manager ABI, please specify " ) +
                    cc.info( "abi-skale-manager" )
                );
                process.exit( 153 );
            }
            log.write( strLogPrefix +
                cc.debug( "Downloading SKALE network information..." ) +
                "\n" ); // just print value
            const opts = {
                imaState: imaState,
                "details": log,
                "bStopNeeded": false,
                "secondsToReDiscoverSkaleNetwork":
                    imaState.optsS2S.secondsToReDiscoverSkaleNetwork,
                "chain": imaState.chainProperties.sc,
                "bParallelMode": true
            };
            const addressFrom = imaState.chainProperties.mn.joAccount.address();
            log.write( strLogPrefix +
                cc.debug( "Will start periodic S-Chains caching..." ) +
                "\n" );
            await skaleObserver.periodicCachingStart(
                imaState.chainProperties.sc.strChainName,
                addressFrom,
                opts
            );
            log.write( strLogPrefix +
                cc.success( "Done, did started periodic S-Chains caching." ) +
                "\n" );
            return true;
        }
    } );
};

function commandLineTaskRegister() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Full registration(all steps)",
        "fn": async function() {
            if( ! imaState.bNoWaitSChainStarted )
                await waitUntilSChainStarted(); // registerAll
            return await registerAll( true );
        }
    } );
}

function commandLineTaskRegister1() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Registration step 1, register S-Chain in deposit box",
        "fn": async function() {
            if( ! imaState.bNoWaitSChainStarted )
                await waitUntilSChainStarted(); // registerStep1
            return await registerStep1( true );
        }
    } );
}

function commandLineTaskCheckRegistration() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Full registration status check(all steps)",
        "fn": async function() {
            if( ! imaState.bNoWaitSChainStarted )
                await waitUntilSChainStarted(); // checkRegistrationAll
            const b = await checkRegistrationAll();
            // nExitCode is: 0 - OKay - registered; non-zero -  not registered or error
            const nExitCode = b ? 0 : 150;
            log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
            process.exit( nExitCode );
        }
    } );
}

function commandLineTaskCheckRegistration1() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Registration status check step 1, register S-Chain in deposit box",
        "fn": async function() {
            if( ! imaState.bNoWaitSChainStarted )
                await waitUntilSChainStarted(); // checkRegistrationStep1
            const b = await checkRegistrationStep1();
            // nExitCode is: 0 - OKay - registered; non-zero -  not registered or error
            const nExitCode = b ? 0 : 152;
            log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
            process.exit( nExitCode );
        }
    } );
}

function commandLineTaskMintErc20() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "mint ERC20",
        "fn": async function() {
            let bMintIsOK = false;
            if( imaState.chainProperties.tc.strCoinNameErc20.length > 0 ) {
                try {
                    const strAddressMintTo = // same as caller/transaction signer
                        imaState.chainProperties.tc.joAccount.address();
                    bMintIsOK =
                        await IMA.mintErc20(
                            imaState.chainProperties.tc.ethersProvider,
                            imaState.chainProperties.tc.chainId,
                            imaState.chainProperties.tc.strChainName,
                            imaState.chainProperties.tc.joAccount,
                            strAddressMintTo,
                            imaState.nAmountOfToken,
                            imaState.chainProperties.tc.joErc20[imaState.chainProperties
                                .tc.strCoinNameErc20 + "_address"],
                            imaState.chainProperties.tc.joErc20[imaState.chainProperties
                                .tc.strCoinNameErc20 + "_abi"],
                            imaState.chainProperties.tc.transactionCustomizer
                        ) ? true : false;
                } catch ( err ) {
                    bMintIsOK = false;
                }
            }
            return bMintIsOK;
        }
    } );
}

function commandLineTaskMintErc721() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "mint ERC721",
        "fn": async function() {
            let bMintIsOK = false;
            if( imaState.chainProperties.tc.strCoinNameErc721.length > 0 ) {
                try {
                    const strAddressMintTo = // same as caller/transaction signer
                        imaState.chainProperties.tc.joAccount.address();
                    const idTokens = imaState.haveArrayOfTokenIdentifiers ? imaState.idTokens : [];
                    if( imaState.haveOneTokenIdentifier )
                        idTokens.push( imaState.idToken );
                    if( idTokens.length > 0 ) {
                        for( let i = 0; i < idTokens.length; ++ i ) {
                            const idToken = idTokens[i];
                            bMintIsOK =
                                await IMA.mintErc721(
                                    imaState.chainProperties.tc.ethersProvider,
                                    imaState.chainProperties.tc.chainId,
                                    imaState.chainProperties.tc.strChainName,
                                    imaState.chainProperties.tc.joAccount,
                                    strAddressMintTo,
                                    idToken,
                                    imaState.chainProperties.tc.joErc721[imaState
                                        .chainProperties.tc.strCoinNameErc721 + "_address"],
                                    imaState.chainProperties.tc.joErc721[imaState
                                        .chainProperties.tc.strCoinNameErc721 + "_abi"],
                                    imaState.chainProperties.tc.transactionCustomizer
                                ) ? true : false;
                        }
                    }
                } catch ( err ) {
                    bMintIsOK = false;
                }
            }
            return bMintIsOK;
        }
    } );
}

function commandLineTaskMintErc1155() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "mint ERC1155",
        "fn": async function() {
            let bMintIsOK = false;
            if( imaState.chainProperties.tc.strCoinNameErc1155.length > 0 ) {
                try {
                    const strAddressMintTo = // same as caller/transaction signer
                        imaState.chainProperties.tc.joAccount.address();
                    const idTokens = imaState.haveArrayOfTokenIdentifiers ? imaState.idTokens : [];
                    if( imaState.haveOneTokenIdentifier )
                        idTokens.push( imaState.idToken );
                    if( idTokens.length > 0 ) {
                        for( let i = 0; i < idTokens.length; ++ i ) {
                            const idToken = idTokens[i];
                            bMintIsOK =
                                await IMA.mintErc1155(
                                    imaState.chainProperties.tc.ethersProvider,
                                    imaState.chainProperties.tc.chainId,
                                    imaState.chainProperties.tc.strChainName,
                                    imaState.chainProperties.tc.joAccount,
                                    strAddressMintTo,
                                    idToken,
                                    imaState.nAmountOfToken,
                                    imaState.chainProperties.tc
                                        .joErc1155[imaState.chainProperties.tc
                                            .strCoinNameErc1155 + "_address"],
                                    imaState.chainProperties.tc
                                        .joErc1155[imaState.chainProperties.tc
                                            .strCoinNameErc1155 + "_abi"],
                                    imaState.chainProperties.tc.transactionCustomizer
                                ) ? true : false;
                        }
                    }
                } catch ( err ) {
                    bMintIsOK = false;
                }
            }
            return bMintIsOK;
        }
    } );
}

function commandLineTaskBurnErc20() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "burn ERC20",
        "fn": async function() {
            let bBurnIsOK = false;
            if( imaState.chainProperties.tc.strCoinNameErc20.length > 0 ) {
                try {
                    const strAddressBurnFrom = // same as caller/transaction signer
                        imaState.chainProperties.tc.joAccount.address();
                    bBurnIsOK =
                        await IMA.burnErc20(
                            imaState.chainProperties.tc.ethersProvider,
                            imaState.chainProperties.tc.chainId,
                            imaState.chainProperties.tc.strChainName,
                            imaState.chainProperties.tc.joAccount,
                            strAddressBurnFrom,
                            imaState.nAmountOfToken,
                            imaState.chainProperties.tc
                                .joErc20[imaState.chainProperties
                                    .tc.strCoinNameErc20 + "_address"],
                            imaState.chainProperties.tc
                                .joErc20[imaState.chainProperties
                                    .tc.strCoinNameErc20 + "_abi"],
                            imaState.chainProperties.tc.transactionCustomizer
                        ) ? true : false;
                } catch ( err ) {
                    bBurnIsOK = false;
                }
            }
            return bBurnIsOK;
        }
    } );
}

function commandLineTaskBurnErc721() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "burn ERC721",
        "fn": async function() {
            let bBurnIsOK = false;
            if( imaState.chainProperties.tc.strCoinNameErc721.length > 0 ) {
                try {
                    const idTokens = imaState.haveArrayOfTokenIdentifiers ? imaState.idTokens : [];
                    if( imaState.haveOneTokenIdentifier )
                        idTokens.push( imaState.idToken );
                    if( idTokens.length > 0 ) {
                        for( let i = 0; i < idTokens.length; ++ i ) {
                            const idToken = idTokens[i];
                            bBurnIsOK =
                                await IMA.burnErc721(
                                    imaState.chainProperties.tc.ethersProvider,
                                    imaState.chainProperties.tc.chainId,
                                    imaState.chainProperties.tc.strChainName,
                                    imaState.chainProperties.tc.joAccount,
                                    idToken,
                                    imaState.chainProperties.tc
                                        .joErc721[imaState.chainProperties
                                            .tc.strCoinNameErc721 + "_address"],
                                    imaState.chainProperties.tc
                                        .oErc721[imaState.chainProperties
                                            .tc.strCoinNameErc721 + "_abi"],
                                    imaState.chainProperties.tc.transactionCustomizer
                                ) ? true : false;
                        }
                    }
                } catch ( err ) {
                    bBurnIsOK = false;
                }
            }
            return bBurnIsOK;
        }
    } );
}

function commandLineTaskBurnErc1155() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "burn ERC1155",
        "fn": async function() {
            let bBurnIsOK = false;
            if( imaState.chainProperties.tc.strCoinNameErc1155.length > 0 ) {
                try {
                    const strAddressBurnFrom = // same as caller/transaction signer
                        imaState.chainProperties.tc.joAccount.address();
                    const idTokens = imaState.haveArrayOfTokenIdentifiers ? imaState.idTokens : [];
                    if( imaState.haveOneTokenIdentifier )
                        idTokens.push( imaState.idToken );
                    if( idTokens.length > 0 ) {
                        for( let i = 0; i < idTokens.length; ++ i ) {
                            const idToken = idTokens[i];
                            bBurnIsOK =
                                await IMA.burnErc1155(
                                    imaState.chainProperties.tc.ethersProvider,
                                    imaState.chainProperties.tc.chainId,
                                    imaState.chainProperties.tc.strChainName,
                                    imaState.chainProperties.tc.joAccount,
                                    strAddressBurnFrom,
                                    idToken,
                                    imaState.nAmountOfToken,
                                    imaState.chainProperties.tc
                                        .joErc1155[imaState.chainProperties
                                            .tc.strCoinNameErc1155 + "_address"],
                                    imaState.chainProperties.tc
                                        .joErc1155[imaState.chainProperties
                                            .tc.strCoinNameErc1155 + "_abi"],
                                    imaState.chainProperties.tc.transactionCustomizer
                                ) ? true : false;
                        }
                    }
                } catch ( err ) {
                    bBurnIsOK = false;
                }
            }
            return bBurnIsOK;
        }
    } );
}

function formatBalanceInfo( bi, strAddress ) {
    let s = "";
    s += cc.attention( bi.assetName );
    if( "assetAddress" in bi &&
        typeof bi.assetAddress == "string" && bi.assetAddress.length > 0 )
        s += cc.normal( "/" ) + cc.notice( bi.assetAddress );
    if( "idToken" in bi )
        s += cc.normal( " token ID " ) + cc.notice( bi.idToken );
    s += cc.normal( ( bi.assetName == "ERC721" )
        ? " owner is " : " balance is " );
    s += ( bi.assetName == "ERC721" )
        ? cc.bright( bi.owner ) : cc.sunny( bi.balance );
    if( bi.assetName == "ERC721" ) {
        const isSame =
            ( bi.owner.trim().toLowerCase() == strAddress.trim().toLowerCase() );
        s += " " + ( isSame
            ? cc.success( "same (as account " ) + cc.attention( strAddress ) +
                cc.success( " specified in the command line arguments)" )
            : cc.error( "different (than account " ) + cc.attention( strAddress ) +
                cc.error( " specified in the command line arguments)" ) );
    }
    return s;
}

async function commandLineTaskShowBalanceEth(
    arrBalancesMN, arrBalancesSC, arrBalancesTC
) {
    const imaState = state.get();
    let assetAddress = null;
    if( imaState.chainProperties.mn.ethersProvider ) {
        arrBalancesMN.push( {
            "assetName": "RealETH",
            "balance": await IMA.getBalanceEth( true, // isMainNet
                imaState.chainProperties.mn.ethersProvider,
                imaState.chainProperties.mn.chainId, imaState.chainProperties.mn.joAccount )
        } );
        arrBalancesMN.push( {
            "assetName": "CanReceiveETH",
            "balance": await IMA.viewEthPaymentFromSchainOnMainNet(
                imaState.chainProperties.mn.ethersProvider,
                imaState.chainProperties.mn.joAccount, imaState.joDepositBoxETH )
        } );
    }
    try {
        assetAddress = imaState.joEthErc20.address;
    } catch ( err ) {
        assetAddress = null;
    }
    if( imaState.chainProperties.sc.ethersProvider ) {
        arrBalancesSC.push( {
            "assetName": "S-Chain Real ETH as ERC20",
            "assetAddress": assetAddress,
            "balance": await IMA.getBalanceEth( false, // isMainNet
                imaState.chainProperties.sc.ethersProvider, imaState.chainProperties.sc.chainId,
                imaState.chainProperties.sc.joAccount, imaState.joEthErc20 )
        } );
        arrBalancesSC.push( {
            "assetName": "S-Chain ETH Fuel",
            "balance": await IMA.getBalanceEth( true, // isMainNet=true here, but we call S-Chain
                imaState.chainProperties.sc.ethersProvider,
                imaState.chainProperties.sc.chainId, imaState.chainProperties.sc.joAccount )
        } );
    }
    if( imaState.chainProperties.tc.ethersProvider ) {
        arrBalancesSC.push( {
            "assetName": "Target S-Chain Real ETH as ERC20",
            "assetAddress": assetAddress,
            "balance": await IMA.getBalanceEth( false, // isMainNet
                imaState.chainProperties.tc.ethersProvider, imaState.chainProperties.sc.chainId,
                imaState.chainProperties.tc.joAccount, imaState.joEthErc20 )
        } );
        arrBalancesTC.push( {
            "assetName": "Target S-Chain ETH Fuel",
            "balance": await IMA.getBalanceEth( true, // isMainNet=true here, but we call S-Chain
                imaState.chainProperties.tc.ethersProvider,
                imaState.chainProperties.tc.chainId, imaState.chainProperties.tc.joAccount )
        } );
    }
}

async function commandLineTaskShowBalanceErc20(
    arrBalancesMN, arrBalancesSC, arrBalancesTC
) {
    const imaState = state.get();
    let assetAddress = null;
    if( imaState.chainProperties.mn.ethersProvider &&
        imaState.chainProperties.mn.strCoinNameErc20.length > 0
    ) {
        try {
            assetAddress = imaState.chainProperties.mn.joErc20[
                imaState.chainProperties.mn.strCoinNameErc20 + "_address"];
        } catch ( err ) { assetAddress = null; }
        arrBalancesMN.push( {
            "assetName": "ERC20",
            "assetAddress": assetAddress,
            "balance": await IMA.getBalanceErc20( true, // isMainNet
                imaState.chainProperties.mn.ethersProvider, imaState.chainProperties.mn.chainId,
                imaState.chainProperties.mn.joAccount,
                imaState.chainProperties.mn.strCoinNameErc20,
                imaState.chainProperties.mn.joErc20 )
        } );
    }
    if( imaState.chainProperties.sc.ethersProvider &&
        imaState.chainProperties.sc.strCoinNameErc20.length > 0
    ) {
        try {
            assetAddress = imaState.chainProperties.sc.joErc20[
                imaState.chainProperties.sc.strCoinNameErc20 + "_address"];
        } catch ( err ) { assetAddress = null; }
        arrBalancesSC.push( {
            "assetName": "ERC20",
            "assetAddress": assetAddress,
            "balance": await IMA.getBalanceErc20( false, // isMainNet
                imaState.chainProperties.sc.ethersProvider, imaState.chainProperties.sc.chainId,
                imaState.chainProperties.sc.joAccount,
                imaState.chainProperties.sc.strCoinNameErc20,
                imaState.chainProperties.sc.joErc20 )
        } );
    }
    if( imaState.chainProperties.tc.ethersProvider &&
        imaState.chainProperties.tc.strCoinNameErc20.length > 0
    ) {
        try {
            assetAddress = imaState.chainProperties.tc.joErc20[
                imaState.chainProperties.tc.strCoinNameErc20 + "_address"];
        } catch ( err ) { assetAddress = null; }
        arrBalancesTC.push( {
            "assetName": "ERC20",
            "assetAddress": assetAddress,
            "balance": await IMA.getBalanceErc20( true, // isMainNet
                imaState.chainProperties.tc.ethersProvider, imaState.chainProperties.mn.chainId,
                imaState.chainProperties.tc.joAccount,
                imaState.chainProperties.tc.strCoinNameErc20,
                imaState.chainProperties.tc.joErc20 )
        } );
    }
}

async function commandLineTaskShowBalanceErc721(
    arrBalancesMN, arrBalancesSC, arrBalancesTC, idTokens
) {
    const imaState = state.get();
    let assetAddress = null;
    if( imaState.chainProperties.mn.ethersProvider &&
        imaState.chainProperties.mn.strCoinNameErc721.length > 0
    ) {
        for( let i = 0; i < idTokens.length; ++ i ) {
            const idToken = idTokens[i];
            try {
                assetAddress = imaState.chainProperties.mn.joErc721[
                    imaState.chainProperties.mn.strCoinNameErc721 + "_address"];
            } catch ( err ) { assetAddress = null; }
            arrBalancesMN.push( {
                "assetName": "ERC721",
                "assetAddress": assetAddress,
                "idToken": idToken,
                "owner": await IMA.getOwnerOfErc721( true, // isMainNet
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.chainProperties.mn.chainId,
                    imaState.chainProperties.mn.joAccount,
                    imaState.chainProperties.mn.strCoinNameErc721,
                    imaState.chainProperties.mn.joErc721, idToken )
            } );
        }
    }
    if( imaState.chainProperties.sc.ethersProvider &&
        imaState.chainProperties.sc.strCoinNameErc721.length > 0
    ) {
        for( let i = 0; i < idTokens.length; ++ i ) {
            const idToken = idTokens[i];
            try {
                assetAddress = imaState.chainProperties.sc.joErc721[
                    imaState.chainProperties.sc.strCoinNameErc721 + "_address"];
            } catch ( err ) { assetAddress = null; }
            arrBalancesSC.push( {
                "assetName": "ERC721",
                "assetAddress": assetAddress,
                "idToken": idToken,
                "owner": await IMA.getOwnerOfErc721( false, // isMainNet
                    imaState.chainProperties.sc.ethersProvider,
                    imaState.chainProperties.sc.chainId,
                    imaState.chainProperties.sc.joAccount,
                    imaState.chainProperties.sc.strCoinNameErc721,
                    imaState.chainProperties.sc.joErc721, idToken )
            } );
        }
    }
    if( imaState.chainProperties.tc.ethersProvider &&
        imaState.chainProperties.tc.strCoinNameErc721.length > 0
    ) {
        for( let i = 0; i < idTokens.length; ++ i ) {
            const idToken = idTokens[i];
            try {
                assetAddress = imaState.chainProperties.tc.joErc721[
                    imaState.chainProperties.tc.strCoinNameErc721 + "_address"];
            } catch ( err ) { assetAddress = null; }
            arrBalancesTC.push( {
                "assetName": "ERC721",
                "assetAddress": assetAddress,
                "idToken": idToken,
                "owner": await IMA.getOwnerOfErc721( false, // isMainNet
                    imaState.chainProperties.tc.ethersProvider,
                    imaState.chainProperties.tc.chainId,
                    imaState.chainProperties.tc.joAccount,
                    imaState.chainProperties.tc.strCoinNameErc721,
                    imaState.chainProperties.tc.joErc721, idToken )
            } );
        }
    }
}

async function commandLineTaskShowBalanceErc1155(
    arrBalancesMN, arrBalancesSC, arrBalancesTC, idTokens
) {
    const imaState = state.get();
    let assetAddress = null;
    if( imaState.chainProperties.mn.ethersProvider &&
        imaState.chainProperties.mn.strCoinNameErc1155.length > 0
    ) {
        for( let i = 0; i < idTokens.length; ++ i ) {
            const idToken = idTokens[i];
            try {
                assetAddress = imaState.chainProperties.mn.joErc1155[
                    imaState.chainProperties.mn.strCoinNameErc1155 + "_address"];
            } catch ( err ) { assetAddress = null; }
            arrBalancesMN.push( {
                "assetName": "ERC1155",
                "assetAddress": assetAddress,
                "idToken": idToken,
                "balance": await IMA.getBalanceErc1155( true, // isMainNet
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.chainProperties.mn.chainId,
                    imaState.chainProperties.mn.joAccount,
                    imaState.chainProperties.mn.strCoinNameErc1155,
                    imaState.chainProperties.mn.joErc1155, idToken )
            } );
        }
    }
    if( imaState.chainProperties.sc.ethersProvider &&
        imaState.chainProperties.sc.strCoinNameErc1155.length > 0
    ) {
        for( let i = 0; i < idTokens.length; ++ i ) {
            const idToken = idTokens[i];
            try {
                assetAddress = imaState.chainProperties.sc.joErc1155[
                    imaState.chainProperties.sc.strCoinNameErc1155 + "_address"];
            } catch ( err ) { assetAddress = null; }
            arrBalancesSC.push( {
                "assetName": "ERC1155",
                "assetAddress": assetAddress,
                "idToken": idToken,
                "balance": await IMA.getBalanceErc1155( false, // isMainNet
                    imaState.chainProperties.sc.ethersProvider,
                    imaState.chainProperties.sc.chainId,
                    imaState.chainProperties.sc.joAccount,
                    imaState.chainProperties.sc.strCoinNameErc1155,
                    imaState.chainProperties.sc.joErc1155, idToken )
            } );
        }
    }
    if( imaState.chainProperties.tc.ethersProvider &&
        imaState.chainProperties.tc.strCoinNameErc1155.length > 0
    ) {
        for( let i = 0; i < idTokens.length; ++ i ) {
            const idToken = idTokens[i];
            try {
                assetAddress = imaState.chainProperties.tc.joErc1155[
                    imaState.chainProperties.tc.strCoinNameErc1155 + "_address"];
            } catch ( err ) { assetAddress = null; }
            arrBalancesTC.push( {
                "assetName": "ERC1155",
                "assetAddress": assetAddress,
                "idToken": idToken,
                "balance": await IMA.getBalanceErc1155( false, // isMainNet
                    imaState.chainProperties.tc.ethersProvider,
                    imaState.chainProperties.tc.chainId,
                    imaState.chainProperties.tc.joAccount,
                    imaState.chainProperties.tc.strCoinNameErc1155,
                    imaState.chainProperties.tc.joErc1155, idToken )
            } );
        }
    }
}

function commandLineTaskShowBalance() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "show balance",
        "fn": async function() {
            const arrBalancesMN = [], arrBalancesSC = [], arrBalancesTC = [];
            await commandLineTaskShowBalanceEth(
                arrBalancesMN, arrBalancesSC, arrBalancesTC );
            await commandLineTaskShowBalanceErc20(
                arrBalancesMN, arrBalancesSC, arrBalancesTC );
            const idTokens = imaState.haveArrayOfTokenIdentifiers ? imaState.idTokens : [];
            if( imaState.haveOneTokenIdentifier )
                idTokens.push( imaState.idToken );
            if( idTokens.length > 0 ) {
                await commandLineTaskShowBalanceErc721(
                    arrBalancesMN, arrBalancesSC, arrBalancesTC, idTokens );
                await commandLineTaskShowBalanceErc1155(
                    arrBalancesMN, arrBalancesSC, arrBalancesTC, idTokens );
            }
            if( arrBalancesMN.length > 0 || arrBalancesSC.length > 0 || arrBalancesTC.length > 0 ) {
                if( arrBalancesMN.length > 0 ) {
                    const strAddress = imaState.chainProperties.mn.joAccount.address();
                    log.write( cc.sunny( "Main Net" ) + " " +
                        cc.bright( arrBalancesMN.length > 1 ? "balances" : "balance" ) +
                        cc.bright( " of " ) + cc.notice( strAddress ) + cc.bright( ":" ) + "\n" );
                    for( let i = 0; i < arrBalancesMN.length; ++ i ) {
                        const bi = arrBalancesMN[i];
                        log.write( "    " + formatBalanceInfo( bi, strAddress ) + "\n" );
                    }
                }
                if( arrBalancesSC.length > 0 ) {
                    const strAddress = imaState.chainProperties.sc.joAccount.address();
                    log.write( cc.sunny( "S-Chain" ) + " " +
                        cc.bright( arrBalancesMN.length > 1 ? "balances" : "balance" ) +
                        cc.bright( " of " ) + cc.notice( strAddress ) + cc.bright( ":" ) + "\n" );
                    for( let i = 0; i < arrBalancesSC.length; ++ i ) {
                        const bi = arrBalancesSC[i];
                        log.write( "    " + formatBalanceInfo( bi, strAddress ) + "\n" );
                    }
                }
                if( arrBalancesTC.length > 0 ) {
                    const strAddress = imaState.chainProperties.mn.joAccount.address();
                    log.write( cc.sunny( "Target S-Chain" ) + " " +
                        cc.bright( arrBalancesTC.length > 1 ? "balances" : "balance" ) +
                        cc.bright( " of " ) + cc.notice( strAddress ) + cc.bright( ":" ) + "\n" );
                    for( let i = 0; i < arrBalancesTC.length; ++ i ) {
                        const bi = arrBalancesTC[i];
                        log.write( "    " + formatBalanceInfo( bi, strAddress ) + "\n" );
                    }
                }
            } else
                log.write( cc.warning( "No balances to scan." ) );
            return true;
        }
    } );
}

function commandLineTaskPaymentM2S() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "one M->S single payment",
        "fn": async function() {
            if( imaState.chainProperties.mn.strCoinNameErc721.length > 0 ) {
                // ERC721 payment
                log.write(
                    cc.info( "one M->S single ERC721 payment: " ) +
                    cc.sunny( imaState.idToken ) +
                    "\n" ); // just print value
                return await IMA.doErc721PaymentFromMainNet(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.chainProperties.sc.ethersProvider,
                    imaState.chainProperties.mn.chainId,
                    imaState.chainProperties.sc.chainId,
                    imaState.chainProperties.mn.joAccount,
                    imaState.chainProperties.sc.joAccount,
                    imaState.isWithMetadata721
                        ? imaState.joDepositBoxERC721WithMetadata
                        : imaState.joDepositBoxERC721, // only main net
                    imaState.joMessageProxyMainNet, // for checking logs
                    imaState.chainProperties.sc.strChainName,
                    imaState.idToken, // which ERC721 token id to send
                    imaState.nAmountOfWei, // how much to send
                    imaState.isWithMetadata721
                        ? imaState.joTokenManagerERC721WithMetadata
                        : imaState.joTokenManagerERC721, // only s-chain
                    imaState.chainProperties.mn.strCoinNameErc721,
                    imaState.chainProperties.mn.joErc721,
                    imaState.chainProperties.sc.strCoinNameErc721,
                    imaState.chainProperties.sc.joErc721,
                    imaState.chainProperties.mn.transactionCustomizer
                );
            }
            if( imaState.chainProperties.tc.strCoinNameErc20.length > 0 ) {
            // ERC20 payment
                log.write(
                    cc.info( "one M->S single ERC20 payment: " ) +
                    cc.sunny( imaState.nAmountOfToken ) +
                    "\n" ); // just print value
                return await IMA.doErc20PaymentFromMainNet(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.chainProperties.sc.ethersProvider,
                    imaState.chainProperties.mn.chainId,
                    imaState.chainProperties.sc.chainId,
                    imaState.chainProperties.mn.joAccount,
                    imaState.chainProperties.sc.joAccount,
                    imaState.joDepositBoxERC20, // only main net
                    imaState.joMessageProxyMainNet, // for checking logs
                    imaState.chainProperties.sc.strChainName,
                    imaState.nAmountOfToken, // how much ERC20 tokens to send
                    imaState.nAmountOfWei, // how much to send
                    imaState.joTokenManagerERC20, // only s-chain
                    imaState.chainProperties.tc.strCoinNameErc20,
                    imaState.chainProperties.mn.joErc20,
                    imaState.chainProperties.sc.strCoinNameErc20,
                    imaState.chainProperties.sc.joErc20,
                    imaState.chainProperties.mn.transactionCustomizer
                );
            }
            if(
                imaState.chainProperties.mn.strCoinNameErc1155.length > 0 &&
                imaState.idToken &&
                imaState.idToken !== null &&
                imaState.idToken !== undefined &&
                imaState.nAmountOfToken &&
                imaState.nAmountOfToken !== null &&
                imaState.nAmountOfToken !== undefined &&
                ( ( !imaState.idTokens ) ||
                    imaState.idTokens === null ||
                    imaState.idTokens === undefined ) &&
                ( ( !imaState.arrAmountsOfTokens ) ||
                    imaState.arrAmountsOfTokens === null ||
                    imaState.arrAmountsOfTokens === undefined )
            ) {
            // ERC1155 payment
                log.write(
                    cc.info( "one M->S single ERC1155 payment: " ) +
                    cc.sunny( imaState.idToken ) + " " +
                    cc.sunny( imaState.nAmountOfToken ) +
                    "\n" ); // just print value
                return await IMA.doErc1155PaymentFromMainNet(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.chainProperties.sc.ethersProvider,
                    imaState.chainProperties.mn.chainId,
                    imaState.chainProperties.sc.chainId,
                    imaState.chainProperties.mn.joAccount,
                    imaState.chainProperties.sc.joAccount,
                    imaState.joDepositBoxERC1155, // only main net
                    imaState.joMessageProxyMainNet, // for checking logs
                    imaState.chainProperties.sc.strChainName,
                    imaState.idToken, // which ERC1155 token id to send
                    imaState.nAmountOfToken, // which ERC1155 token amount to send
                    imaState.nAmountOfWei, // how much to send
                    imaState.joTokenManagerERC1155, // only s-chain
                    imaState.chainProperties.mn.strCoinNameErc1155,
                    imaState.chainProperties.mn.joErc1155,
                    imaState.chainProperties.sc.strCoinNameErc1155,
                    imaState.chainProperties.sc.joErc1155,
                    imaState.chainProperties.mn.transactionCustomizer
                );
            }
            if(
                imaState.chainProperties.mn.strCoinNameErc1155.length > 0 &&
                imaState.idTokens &&
                imaState.idTokens !== null &&
                imaState.idTokens !== undefined &&
                imaState.arrAmountsOfTokens &&
                imaState.arrAmountsOfTokens !== null &&
                imaState.arrAmountsOfTokens !== undefined &&
                ( !imaState.idToken ||
                    imaState.idToken === null ||
                    imaState.idToken === undefined ) &&
                ( !imaState.nAmountOfToken ||
                    imaState.nAmountOfToken === null ||
                    imaState.nAmountOfToken === undefined )
            ) {
            // ERC1155 Batch payment
                log.write(
                    cc.info( "one M->S single ERC1155 Batch payment: " ) +
                    cc.sunny( imaState.idTokens ) + " " +
                    cc.sunny( imaState.arrAmountsOfTokens ) +
                    "\n" ); // just print value
                return await IMA.doErc1155BatchPaymentFromMainNet(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.chainProperties.sc.ethersProvider,
                    imaState.chainProperties.mn.chainId,
                    imaState.chainProperties.sc.chainId,
                    imaState.chainProperties.mn.joAccount,
                    imaState.chainProperties.sc.joAccount,
                    imaState.joDepositBoxERC1155, // only main net
                    imaState.joMessageProxyMainNet, // for checking logs
                    imaState.chainProperties.sc.strChainName,
                    imaState.idTokens, // which ERC1155 token id to send
                    imaState.arrAmountsOfTokens, // which ERC1155 token amount to send
                    imaState.nAmountOfWei, // how much to send
                    imaState.joTokenManagerERC1155, // only s-chain
                    imaState.chainProperties.mn.strCoinNameErc1155,
                    imaState.chainProperties.mn.joErc1155,
                    imaState.chainProperties.sc.strCoinNameErc1155,
                    imaState.chainProperties.sc.joErc1155,
                    imaState.chainProperties.mn.transactionCustomizer
                );
            }
            // ETH payment
            log.write(
                cc.info( "one M->S single ETH payment: " ) +
                cc.sunny( imaState.nAmountOfWei ) +
                "\n" ); // just print value
            return await IMA.doEthPaymentFromMainNet(
                imaState.chainProperties.mn.ethersProvider,
                imaState.chainProperties.mn.chainId,
                imaState.chainProperties.mn.joAccount,
                imaState.chainProperties.sc.joAccount,
                imaState.joDepositBoxETH, // only main net
                imaState.joMessageProxyMainNet, // for checking logs
                imaState.chainProperties.sc.strChainName,
                imaState.nAmountOfWei, // how much WEI money to send
                imaState.chainProperties.mn.transactionCustomizer
            );
        }
    } );
}

function commandLineTaskPaymentS2M() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "one S->M single payment",
        "fn": async function() {
            if( imaState.chainProperties.sc.strCoinNameErc721.length > 0 ) {
                // ERC721 payment
                log.write(
                    cc.info( "one S->M single ERC721 payment: " ) +
                    cc.sunny( imaState.idToken ) +
                        "\n" ); // just print value
                return await IMA.doErc721PaymentFromSChain(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.chainProperties.sc.ethersProvider,
                    imaState.chainProperties.mn.chainId,
                    imaState.chainProperties.sc.chainId,
                    imaState.chainProperties.sc.joAccount,
                    imaState.chainProperties.mn.joAccount,
                    imaState.isWithMetadata721
                        ? imaState.joTokenManagerERC721WithMetadata
                        : imaState.joTokenManagerERC721, // only s-chain
                    imaState.joMessageProxySChain, // for checking logs
                    imaState.isWithMetadata721
                        ? imaState.joDepositBoxERC721WithMetadata
                        : imaState.joDepositBoxERC721, // only main net
                    imaState.idToken, // which ERC721 token id to send
                    imaState.nAmountOfWei, // how much to send
                    imaState.chainProperties.mn.strCoinNameErc721,
                    imaState.chainProperties.mn.joErc721,
                    imaState.chainProperties.sc.strCoinNameErc721,
                    imaState.chainProperties.sc.joErc721,
                    imaState.chainProperties.sc.transactionCustomizer
                );
            }
            if( imaState.chainProperties.sc.strCoinNameErc20.length > 0 ) {
            // ERC20 payment
                log.write(
                    cc.info( "one S->M single ERC20 payment: " ) +
                    cc.sunny( imaState.nAmountOfToken ) +
                    "\n" ); // just print value
                return await IMA.doErc20PaymentFromSChain(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.chainProperties.sc.ethersProvider,
                    imaState.chainProperties.mn.chainId,
                    imaState.chainProperties.sc.chainId,
                    imaState.chainProperties.sc.joAccount,
                    imaState.chainProperties.mn.joAccount,
                    imaState.joTokenManagerERC20, // only s-chain
                    imaState.joMessageProxySChain, // for checking logs
                    imaState.joDepositBoxERC20, // only main net
                    imaState.nAmountOfToken, // how ERC20 tokens money to send
                    imaState.nAmountOfWei, // how much to send
                    imaState.chainProperties.tc.strCoinNameErc20,
                    imaState.chainProperties.mn.joErc20,
                    imaState.chainProperties.sc.strCoinNameErc20,
                    imaState.chainProperties.sc.joErc20,
                    imaState.chainProperties.sc.transactionCustomizer
                );
            }
            if(
                imaState.chainProperties.sc.strCoinNameErc1155.length > 0 &&
                imaState.idToken &&
                imaState.idToken !== null &&
                imaState.idToken !== undefined &&
                imaState.nAmountOfToken &&
                imaState.nAmountOfToken !== null &&
                imaState.nAmountOfToken !== undefined &&
                ( ( !imaState.idTokens ) ||
                    imaState.idTokens === null ||
                    imaState.idTokens === undefined ) &&
                ( ( !imaState.arrAmountsOfTokens ) ||
                    imaState.arrAmountsOfTokens === null ||
                    imaState.arrAmountsOfTokens === undefined )
            ) {
            // ERC1155 payment
                log.write(
                    cc.info( "one S->M single ERC1155 payment: " ) +
                    cc.sunny( imaState.idToken ) + " " +
                    cc.sunny( imaState.nAmountOfToken ) +
                    "\n" ); // just print value
                return await IMA.doErc1155PaymentFromSChain(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.chainProperties.sc.ethersProvider,
                    imaState.chainProperties.mn.chainId,
                    imaState.chainProperties.sc.chainId,
                    imaState.chainProperties.sc.joAccount,
                    imaState.chainProperties.mn.joAccount,
                    imaState.joTokenManagerERC1155, // only s-chain
                    imaState.joMessageProxySChain, // for checking logs
                    imaState.joDepositBoxERC1155, // only main net
                    imaState.idToken, // which ERC1155 token id to send
                    imaState.nAmountOfToken, // which ERC1155 token amount to send
                    imaState.nAmountOfWei, // how much to send
                    imaState.chainProperties.mn.strCoinNameErc1155,
                    imaState.chainProperties.mn.joErc1155,
                    imaState.chainProperties.sc.strCoinNameErc1155,
                    imaState.chainProperties.sc.joErc1155,
                    imaState.chainProperties.sc.transactionCustomizer
                );
            }
            if(
                imaState.chainProperties.sc.strCoinNameErc1155.length > 0 &&
                imaState.idTokens &&
                imaState.idTokens !== null &&
                imaState.idTokens !== undefined &&
                imaState.arrAmountsOfTokens &&
                imaState.arrAmountsOfTokens !== null &&
                imaState.arrAmountsOfTokens !== undefined &&
                ( !imaState.idToken ||
                    imaState.idToken === null ||
                    imaState.idToken === undefined ) &&
                ( !imaState.nAmountOfToken ||
                    imaState.nAmountOfToken === null ||
                    imaState.nAmountOfToken === undefined )
            ) {
                // ERC1155 payment
                log.write(
                    cc.info( "one S->M single ERC1155 payment: " ) +
                    cc.sunny( imaState.idTokens ) + " " +
                    cc.sunny( imaState.arrAmountsOfTokens ) +
                    "\n" ); // just print value
                return await IMA.doErc1155BatchPaymentFromSChain(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.chainProperties.sc.ethersProvider,
                    imaState.chainProperties.mn.chainId,
                    imaState.chainProperties.sc.chainId,
                    imaState.chainProperties.sc.joAccount,
                    imaState.chainProperties.mn.joAccount,
                    imaState.joTokenManagerERC1155, // only s-chain
                    imaState.joMessageProxySChain, // for checking logs
                    imaState.joDepositBoxERC1155, // only main net
                    imaState.idTokens, // which ERC1155 token id to send
                    imaState.arrAmountsOfTokens, // which ERC1155 token amount to send
                    imaState.nAmountOfWei, // how much to send
                    imaState.chainProperties.mn.strCoinNameErc1155,
                    imaState.chainProperties.mn.joErc1155,
                    imaState.chainProperties.sc.strCoinNameErc1155,
                    imaState.chainProperties.sc.joErc1155,
                    imaState.chainProperties.sc.transactionCustomizer
                );
            }
            // ETH payment
            log.write(
                cc.info( "one S->M single ETH payment: " ) +
                cc.sunny( imaState.nAmountOfWei ) +
                "\n" ); // just print value
            return await IMA.doEthPaymentFromSChain(
                imaState.chainProperties.sc.ethersProvider,
                imaState.chainProperties.sc.chainId,
                imaState.chainProperties.sc.joAccount,
                imaState.chainProperties.mn.joAccount,
                imaState.joTokenManagerETH, // only s-chain
                imaState.joMessageProxySChain, // for checking logs
                imaState.nAmountOfWei, // how much WEI money to send
                imaState.chainProperties.sc.transactionCustomizer
            );
        }
    } );
}

function commandLineTaskPaymentS2S() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "one S->S single payment",
        "fn": async function() {
            const isForward = IMA.isForwardS2S();
            const sc = imaState.chainProperties.sc, tc = imaState.chainProperties.tc;
            const ethersProviderSrc = isForward ? sc.ethersProvider : tc.ethersProvider;
            const chainIdSrc = isForward ? sc.chainId : tc.chainId;
            const joAccountSrc = isForward ? sc.joAccount : tc.joAccount;
            const joTokenManagerERC20Src = isForward
                ? imaState.joTokenManagerERC20 : imaState.joTokenManagerERC20Target;
            const joTokenManagerERC721Src = isForward
                ? ( imaState.isWithMetadata721
                    ? imaState.joTokenManagerERC721WithMetadata
                    : imaState.joTokenManagerERC721 )
                : ( imaState.isWithMetadata721
                    ? imaState.joTokenManagerERC721WithMetadataTarget
                    : imaState.joTokenManagerERC721Target )
            ;
            const joTokenManagerERC1155Src = isForward
                ? imaState.joTokenManagerERC1155 : imaState.joTokenManagerERC1155Target;
            const strChainNameDst = isForward ? tc.strChainName : sc.strChainName;
            const strCoinNameErc20Src = isForward ? sc.strCoinNameErc20 : tc.strCoinNameErc20;
            const strCoinNameErc721Src = isForward ? sc.strCoinNameErc721 : tc.strCoinNameErc721;
            const strCoinNameErc1155Src =
                isForward ? sc.strCoinNameErc1155 : tc.strCoinNameErc1155;
            const joSrcErc20 = isForward ? sc.joErc20 : tc.joErc20;
            const joSrcErc721 = isForward ? sc.joErc721 : tc.joErc721;
            const joSrcErc1155 = isForward ? sc.joErc1155 : tc.joErc1155;
            let strAddrErc20Explicit = imaState.strAddrErc20Explicit;
            let strAddrErc20ExplicitTarget = imaState.strAddrErc20ExplicitTarget;
            let strAddrErc721Explicit = imaState.strAddrErc721Explicit;
            let strAddrErc721ExplicitTarget = imaState.strAddrErc721ExplicitTarget;
            let strAddrErc1155Explicit = imaState.strAddrErc1155Explicit;
            let strAddrErc1155ExplicitTarget = imaState.strAddrErc1155ExplicitTarget;
            if( ( ! strAddrErc20Explicit ) && sc.joErc20 && sc.strCoinNameErc20 )
                strAddrErc20Explicit = sc.joErc20[sc.strCoinNameErc20 + "_address"];
            if( ( ! strAddrErc20ExplicitTarget ) && tc.joErc20 && tc.strCoinNameErc20 )
                strAddrErc20ExplicitTarget = tc.joErc20[tc.strCoinNameErc20 + "_address"];
            if( ( ! strAddrErc721Explicit ) && sc.joErc721 && sc.strCoinNameErc721 )
                strAddrErc721Explicit = sc.joErc721[sc.strCoinNameErc721 + "_address"];
            if( ( ! strAddrErc721ExplicitTarget ) && tc.joErc721 && tc.strCoinNameErc721 )
                strAddrErc721ExplicitTarget = tc.joErc721[tc.strCoinNameErc721 + "_address"];
            if( ( ! strAddrErc1155Explicit ) && sc.joErc1155 && sc.strCoinNameErc1155 )
                strAddrErc1155Explicit = sc.joErc1155[sc.strCoinNameErc1155 + "_address"];
            if( ( ! strAddrErc1155ExplicitTarget ) && tc.joErc1155 && tc.strCoinNameErc1155 )
                strAddrErc1155ExplicitTarget = tc.joErc1155[tc.strCoinNameErc1155 + "_address"];
            const strAddrErc20Dst = isForward
                ? strAddrErc20ExplicitTarget : strAddrErc20Explicit;
            const strAddrErc721Dst = isForward
                ? strAddrErc721ExplicitTarget : strAddrErc721Explicit;
            const strAddrErc1155Dst = isForward
                ? strAddrErc1155ExplicitTarget : strAddrErc1155Explicit;
            const tx_customizer = isForward ? sc.transactionCustomizer : tc.transactionCustomizer;
            if( strCoinNameErc721Src.length > 0 ) {
                // ERC721 payment
                log.write( cc.info( "one S->S single ERC721 payment: " ) +
                    cc.sunny( imaState.idToken ) + "\n" ); // just print value
                return await IMA.doErc721PaymentS2S(
                    isForward,
                    ethersProviderSrc,
                    chainIdSrc,
                    strChainNameDst,
                    joAccountSrc,
                    joTokenManagerERC721Src,
                    imaState.idToken, // which ERC721 token id to send
                    imaState.nAmountOfWei, // how much to send
                    strCoinNameErc721Src,
                    joSrcErc721,
                    strAddrErc721Dst, // only reverse payment needs it
                    tx_customizer
                );
            }
            if( strCoinNameErc20Src.length > 0 ) {
            // ERC20 payment
                log.write( cc.info( "one S->S single ERC20 payment: " ) +
                    cc.sunny( imaState.nAmountOfToken ) + "\n" ); // just print value
                return await IMA.doErc20PaymentS2S(
                    isForward,
                    ethersProviderSrc,
                    chainIdSrc,
                    strChainNameDst,
                    joAccountSrc,
                    joTokenManagerERC20Src,
                    imaState.nAmountOfToken, // how much ERC20 tokens to send
                    imaState.nAmountOfWei, // how much to send
                    strCoinNameErc20Src,
                    joSrcErc20,
                    strAddrErc20Dst, // only reverse payment needs it
                    tx_customizer
                );
            }
            if(
                strCoinNameErc1155Src.length > 0 &&
                imaState.idToken &&
                imaState.idToken !== null &&
                imaState.idToken !== undefined &&
                imaState.nAmountOfToken &&
                imaState.nAmountOfToken !== null &&
                imaState.nAmountOfToken !== undefined &&
                ( ( !imaState.idTokens ) ||
                    imaState.idTokens === null ||
                    imaState.idTokens === undefined ) &&
                ( ( !imaState.arrAmountsOfTokens ) ||
                    imaState.arrAmountsOfTokens === null ||
                    imaState.arrAmountsOfTokens === undefined )
            ) {
                // ERC1155 payment
                log.write( cc.info( "one S->S single ERC1155 payment: " ) +
                    cc.sunny( imaState.idToken ) + " " + cc.sunny( imaState.nAmountOfToken ) +
                    "\n" ); // just print value
                return await IMA.doErc1155PaymentS2S(
                    isForward,
                    ethersProviderSrc,
                    chainIdSrc,
                    strChainNameDst,
                    joAccountSrc,
                    joTokenManagerERC1155Src,
                    imaState.idToken, // which ERC1155 token id to send
                    imaState.nAmountOfToken, // how much ERC1155 tokens to send
                    imaState.nAmountOfWei, // how much to send
                    strCoinNameErc1155Src,
                    joSrcErc1155,
                    strAddrErc1155Dst, // only reverse payment needs it
                    tx_customizer
                );
            }
            if(
                strCoinNameErc1155Src.length > 0 &&
                imaState.idTokens &&
                imaState.idTokens !== null &&
                imaState.idTokens !== undefined &&
                imaState.arrAmountsOfTokens &&
                imaState.arrAmountsOfTokens !== null &&
                imaState.arrAmountsOfTokens !== undefined &&
                ( !imaState.idToken ||
                    imaState.idToken === null ||
                    imaState.idToken === undefined ) &&
                ( !imaState.nAmountOfToken ||
                    imaState.nAmountOfToken === null ||
                    imaState.nAmountOfToken === undefined )
            ) {
                // ERC1155 Batch payment
                log.write( cc.info( "one S->S single ERC1155 Batch payment: " ) +
                    cc.sunny( imaState.idTokens ) + " " + cc.sunny( imaState.arrAmountsOfTokens ) +
                    "\n" ); // just print value
                return await IMA.doErc1155BatchPaymentS2S(
                    isForward,
                    ethersProviderSrc,
                    chainIdSrc,
                    strChainNameDst,
                    joAccountSrc,
                    joTokenManagerERC1155Src,
                    imaState.idTokens, // which ERC1155 token id to send
                    imaState.arrAmountsOfTokens, // which ERC1155 token amount to send
                    imaState.nAmountOfWei, // how much to send
                    strCoinNameErc1155Src,
                    joSrcErc1155,
                    strAddrErc1155Dst,
                    tx_customizer
                );
            }
            // ETH payment
            log.write( cc.info( "one S->S single ETH payment: " ) +
                cc.sunny( imaState.nAmountOfWei ) + "\n" ); // just print value
            console.log( cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " S->S ETH payment(s) are neither supported nor allowed" )
            );
            process.exit( 154 );
        }
    } );
}

function commandLineTaskReceiveS2M() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "receive one S->M single ETH payment",
        "fn": async function() {
            log.write(
                cc.info( "receive one S->M single ETH payment: " ) +
                "\n" ); // just print value
            return await IMA.receiveEthPaymentFromSchainOnMainNet(
                imaState.chainProperties.mn.ethersProvider,
                imaState.chainProperties.mn.chainId,
                imaState.chainProperties.mn.joAccount,
                imaState.joDepositBoxETH,
                imaState.chainProperties.mn.transactionCustomizer
            );
        }
    } );
}

function commandLineTaskViewS2M() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "view one S->M single ETH payment",
        "fn": async function() {
            log.write(
                cc.info( "view one S->M single ETH payment: " ) +
                "\n" ); // just print value
            const xWei = await IMA.viewEthPaymentFromSchainOnMainNet(
                imaState.chainProperties.mn.ethersProvider,
                imaState.chainProperties.mn.joAccount,
                imaState.joDepositBoxETH
            );
            if( xWei === null || xWei === undefined )
                return false;
            const xEth =
                owaspUtils.ethersMod.ethers.utils.formatEther( owaspUtils.toBN( xWei ) );
            log.write(
                cc.success( "Main-net user can receive: " ) + cc.attention( xWei ) +
                cc.success( " wei = " ) + cc.attention( xEth ) + cc.success( " eth" ) +
                "\n" );
            return true;
        }
    } );
}

function commandLineTaskTransferM2S() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "single M->S transfer loop",
        "fn": async function() {
            if( ! imaState.bNoWaitSChainStarted )
                await waitUntilSChainStarted(); // main-net --> s-chain transfer
            const joRuntimeOpts = {
                isInsideWorker: false,
                idxChainKnownForS2S: 0,
                cntChainsKnownForS2S: 0
            };
            return await IMA.doTransfer( // main-net --> s-chain
                "M2S",
                joRuntimeOpts,
                imaState.chainProperties.mn.ethersProvider,
                imaState.joMessageProxyMainNet,
                imaState.chainProperties.mn.joAccount,
                imaState.chainProperties.sc.ethersProvider,
                imaState.joMessageProxySChain,
                imaState.chainProperties.sc.joAccount,
                imaState.chainProperties.mn.strChainName,
                imaState.chainProperties.sc.strChainName,
                imaState.chainProperties.mn.chainId,
                imaState.chainProperties.sc.chainId,
                null,
                imaState.joTokenManagerETH, // for logs validation on s-chain
                imaState.nTransferBlockSizeM2S,
                imaState.nTransferStepsM2S,
                imaState.nMaxTransactionsM2S,
                imaState.nBlockAwaitDepthM2S,
                imaState.nBlockAgeM2S,
                imaBLS.doSignMessagesM2S,
                null,
                imaState.chainProperties.sc.transactionCustomizer
            );
        }
    } );
}

function commandLineTaskTransferS2M() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "single S->M transfer loop",
        "fn": async function() {
            if( ! imaState.bNoWaitSChainStarted )
                await waitUntilSChainStarted(); // s-chain --> main-net transfer
            const joRuntimeOpts = {
                isInsideWorker: false,
                idxChainKnownForS2S: 0,
                cntChainsKnownForS2S: 0
            };
            return await IMA.doTransfer( // s-chain --> main-net
                "S2M",
                joRuntimeOpts,
                imaState.chainProperties.sc.ethersProvider,
                imaState.joMessageProxySChain,
                imaState.chainProperties.sc.joAccount,
                imaState.chainProperties.mn.ethersProvider,
                imaState.joMessageProxyMainNet,
                imaState.chainProperties.mn.joAccount,
                imaState.chainProperties.sc.strChainName,
                imaState.chainProperties.mn.strChainName,
                imaState.chainProperties.sc.chainId,
                imaState.chainProperties.mn.chainId,
                imaState.joDepositBoxETH, // for logs validation on mainnet
                null,
                imaState.nTransferBlockSizeS2M,
                imaState.nTransferStepsS2M,
                imaState.nMaxTransactionsS2M,
                imaState.nBlockAwaitDepthS2M,
                imaState.nBlockAgeS2M,
                imaBLS.doSignMessagesS2M,
                null,
                imaState.chainProperties.mn.transactionCustomizer
            );
        }
    } );
}

function commandLineTaskTransferS2S() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "single S->S transfer loop",
        "fn": async function() {
            if( ! imaState.optsS2S.isEnabled )
                return;
            initialSkaleNetworkScanForS2S();
            if( ! imaState.bNoWaitSChainStarted )
                await waitUntilSChainStarted(); // s-chain --> main-net transfer
            const joRuntimeOpts = {
                isInsideWorker: false,
                idxChainKnownForS2S: 0,
                cntChainsKnownForS2S: 0
            };
            return await IMA.doAllS2S( // s-chain --> s-chain
                joRuntimeOpts,
                imaState,
                skaleObserver,
                imaState.chainProperties.sc.ethersProvider,
                imaState.joMessageProxySChain,
                imaState.chainProperties.sc.joAccount,
                imaState.chainProperties.sc.strChainName,
                imaState.chainProperties.sc.chainId,
                imaState.joTokenManagerETH, // for logs validation on s-chain
                imaState.nTransferBlockSizeM2S,
                imaState.nTransferStepsS2S,
                imaState.nMaxTransactionsM2S,
                imaState.nBlockAwaitDepthM2S,
                imaState.nBlockAgeM2S,
                imaBLS.doSignMessagesM2S,
                imaState.chainProperties.sc.transactionCustomizer
            );
        }
    } );
}

function commandLineTaskTransfer() {
    const imaState = state.get();
    initialSkaleNetworkScanForS2S();
    imaState.arrActions.push( {
        "name": "Single M<->S transfer loop iteration",
        "fn": async function() {
            initialSkaleNetworkScanForS2S();
            if( ! imaState.bNoWaitSChainStarted )
                await waitUntilSChainStarted();
            const joRuntimeOpts = {
                isInsideWorker: false,
                idxChainKnownForS2S: 0,
                cntChainsKnownForS2S: 0
            };
            const optsLoop = {
                joRuntimeOpts: joRuntimeOpts,
                isDelayFirstRun: false,
                enableStepOracle: true,
                enableStepM2S: true,
                enableStepS2M: true,
                enableStepS2S: true
            };
            return await singleTransferLoop( optsLoop );
        }
    } );
}

function commandLineTaskLoop() {
    const imaState = state.get();
    initialSkaleNetworkScanForS2S();
    imaState.arrActions.push( {
        "name": "M<->S and S->S transfer loop, startup in parallel mode",
        "fn": async function() {
            state.setPreventExitAfterLastAction( true );
            if( ! imaState.bNoWaitSChainStarted )
                await waitUntilSChainStarted(); // M<->S transfer loop
            let isPrintSummaryRegistrationCosts = false;
            if( !await checkRegistrationStep1() ) {
                if( !await registerStep1( false ) )
                    return false;
                isPrintSummaryRegistrationCosts = true;
            }
            if( isPrintSummaryRegistrationCosts )
                printSummaryRegistrationCosts();
            const opts = {
                imaState: imaState,
                "details": log
            };
            return await loop.runParallelLoops(
                opts
            );
        }
    } );
}

function commandLineTaskLoopSimple() {
    const imaState = state.get();
    initialSkaleNetworkScanForS2S();
    imaState.arrActions.push( {
        "name": "M<->S and S->S transfer loop, simple mode",
        "fn": async function() {
            state.setPreventExitAfterLastAction( true );
            if( ! imaState.bNoWaitSChainStarted )
                await waitUntilSChainStarted(); // M<->S transfer loop
            let isPrintSummaryRegistrationCosts = false;
            if( !await checkRegistrationStep1() ) {
                if( !await registerStep1( false ) )
                    return false;
                isPrintSummaryRegistrationCosts = true;
            }
            if( isPrintSummaryRegistrationCosts )
                printSummaryRegistrationCosts();
            const joRuntimeOpts = {
                isInsideWorker: false,
                idxChainKnownForS2S: 0,
                cntChainsKnownForS2S: 0
            };
            const optsLoop = {
                joRuntimeOpts: joRuntimeOpts,
                isDelayFirstRun: false,
                enableStepOracle: true,
                enableStepM2S: true,
                enableStepS2M: true,
                enableStepS2S: true
            };
            return await loop.runTransferLoop( optsLoop );
        }
    } );
}

function commandLineTaskBrowseSChain() {
    const imaState = state.get();
    imaState.bIsNeededCommonInit = false;
    imaState.arrActions.push( {
        "name": "Browse S-Chain network",
        "fn": async function() {
            const strLogPrefix = cc.info( "S-Chain Browse:" ) + " ";
            if( imaState.chainProperties.sc.strURL.length === 0 ) {
                console.log( cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " missing S-Chain URL, please specify " ) +
                    cc.info( "url-s-chain" )
                );
                process.exit( 155 );
            }
            log.write( strLogPrefix +
                cc.normal( "Downloading S-Chain network information " ) +
                cc.normal( "..." ) +
                "\n" ); // just print value

            const rpcCallOpts = null;
            await rpcCall.create(
                imaState.chainProperties.sc.strURL,
                rpcCallOpts,
                async function( joCall, err ) {
                    if( err ) {
                        console.log( cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to S-Chain failed" )
                        );
                        if( joCall )
                            await joCall.disconnect();
                        process.exit( 156 );
                    }
                    await joCall.call( {
                        "method": "skale_nodesRpcInfo",
                        "params": {
                            "fromImaAgentIndex": imaState.nNodeNumber
                        }
                    }, async function( joIn, joOut, err ) {
                        if( err ) {
                            const strError = owaspUtils.extractErrorMessage( err );
                            console.log( cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " JSON RPC call to S-Chain failed, error: " ) +
                            cc.warning( strError )
                            );
                            await joCall.disconnect();
                            process.exit( 157 );
                        }
                        log.write( strLogPrefix +
                        cc.normal( "S-Chain network information: " ) +
                        cc.j( joOut.result ) +
                        "\n" );
                        let nCountReceivedImaDescriptions = 0;
                        const jarrNodes = joOut.result.network;
                        for( let i = 0; i < jarrNodes.length; ++ i ) {
                            const joNode = jarrNodes[i];
                            if( ! joNode ) {
                                log.write( strLogPrefix +
                                cc.error( "Discovery node " ) + cc.info( i ) +
                                cc.error( " is completely unknown and will be skipped" ) +
                                "\n" );
                                continue;
                            }
                            const strNodeURL = imaUtils.composeSChainNodeUrl( joNode );
                            const rpcCallOpts = null;
                            await rpcCall.create(
                                strNodeURL,
                                rpcCallOpts,
                                async function( joCall, err ) {
                                    if( err ) {
                                        console.log( cc.fatal( "CRITICAL ERROR:" ) +
                                    cc.error( " JSON RPC call to S-Chain failed" )
                                        );
                                        await joCall.disconnect();
                                        process.exit( 158 );
                                    }
                                    await joCall.call( {
                                        "method": "skale_imaInfo",
                                        "params": {
                                            "fromImaAgentIndex": imaState.nNodeNumber
                                        }
                                    }, async function( joIn, joOut, err ) {
                                        ++ nCountReceivedImaDescriptions;
                                        if( err ) {
                                            const strError =
                                                owaspUtils.extractErrorMessage( err );
                                            console.log( cc.fatal( "CRITICAL ERROR:" ) +
                                        cc.error( " JSON RPC call to S-Chain failed, " +
                                        "error: " ) + cc.warning( strError )
                                            );
                                            process.exit( 159 );
                                        }
                                        log.write( strLogPrefix +
                                    cc.normal( "Node " ) + cc.info( joNode.nodeID ) +
                                    cc.normal( " IMA information: " ) +
                                    cc.j( joOut.result ) +
                                    "\n" );
                                        await joCall.disconnect();
                                    } );
                                } );
                        }
                        const iv = setInterval( function() {
                            if( nCountReceivedImaDescriptions == jarrNodes.length ) {
                                clearInterval( iv );
                                process.exit( 0 );
                            }
                        }, 100 );
                        await joCall.disconnect();
                    } );
                } );
            return true;
        }
    } );
}

function commandLineTaskBrowseSkaleNetwork() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Browse S-Chain network",
        "fn": async function() {
            const strLogPrefix = cc.info( "SKALE NETWORK Browse:" ) + " ";
            if( imaState.strPathAbiJsonSkaleManager.length === 0 ) {
                console.log( cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " missing Skale Manager ABI, please specify " ) +
                    cc.info( "abi-skale-manager" )
                );
                process.exit( 160 );
            }
            log.write( strLogPrefix +
                cc.debug( "Downloading SKALE network information..." ) +
                "\n" ); // just print value
            const opts = {
                imaState: imaState,
                "details": log,
                "bStopNeeded": false
            };
            const addressFrom = imaState.chainProperties.mn.joAccount.address();
            const arrSChains = await skaleObserver.loadSChains( addressFrom, opts );
            const cnt = arrSChains.length;
            log.write( strLogPrefix +
                cc.normal( "Got " ) + cc.info( cnt ) +
                cc.normal( " S-Chains(s) in SKALE NETWORK information: " ) +
                cc.j( arrSChains ) +
                "\n" );
            return true;
        }
    } );
}

function commandLineTaskBrowseConnectedSChains() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Browse connected S-Chains",
        "fn": async function() {
            const strLogPrefix = cc.info( "Browse connected S-Chains:" ) + " ";
            if( imaState.strPathAbiJsonSkaleManager.length === 0 ) {
                console.log( cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " missing Skale Manager ABI, please specify " ) +
                    cc.info( "abi-skale-manager" )
                );
                process.exit( 161 );
            }
            log.write( strLogPrefix +
                cc.debug( "Downloading SKALE network information..." ) +
                "\n" ); // just print value

            const opts = {
                imaState: imaState,
                "details": log,
                "bStopNeeded": false
            };
            const addressFrom = imaState.chainProperties.mn.joAccount.address();
            const arrSChainsCached = await skaleObserver.loadSChainsConnectedOnly(
                imaState.chainProperties.sc.strChainName,
                addressFrom,
                opts
            );

            const cnt = arrSChainsCached.length;
            log.write( strLogPrefix +
                cc.normal( "Got " ) + cc.info( cnt ) +
                cc.normal( " connected S-Chain(s): " ) + cc.j( arrSChainsCached ) +
                "\n" );
            return true;
        }
    } );
}

function commandLineTaskDiscoverChainId() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Discover chains ID(s)",
        "fn": async function() {
            const strLogPrefix = cc.info( "Discover chains ID(s):" ) + " ";
            const arr_urls_to_discover = [];
            if( imaState.chainProperties.mn.strURL &&
                typeof( imaState.chainProperties.mn.strURL ) == "string" &&
                imaState.chainProperties.mn.strURL.length > 0
            ) {
                arr_urls_to_discover.push( {
                    "name": "Main Net",
                    "strURL": "" + imaState.chainProperties.mn.strURL,
                    "fnSave": function( chainId ) {
                        imaState.chainProperties.mn.chainId = chainId;
                    }
                } );
            }
            if( imaState.chainProperties.sc.strURL &&
                typeof( imaState.chainProperties.sc.strURL ) == "string" &&
                imaState.chainProperties.sc.strURL.length > 0
            ) {
                arr_urls_to_discover.push( {
                    "name": "S-Chain",
                    "strURL": "" + "" + imaState.chainProperties.sc.strURL,
                    "fnSave": function( chainId ) {
                        imaState.chainProperties.sc.chainId = chainId;
                    }
                } );
            }
            if( imaState.chainProperties.tc.strURL &&
                typeof( imaState.chainProperties.tc.strURL ) == "string" &&
                imaState.chainProperties.tc.strURL.length > 0
            ) {
                arr_urls_to_discover.push( {
                    "name": "S<->S Target S-Chain",
                    "strURL": "" + "" + imaState.chainProperties.tc.strURL,
                    "fnSave": function( chainId ) {
                        imaState.chainProperties.tc.chainId = chainId;
                    }
                } );
            }
            if( arr_urls_to_discover.length === 0 ) {
                console.log( cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " no URLs provided to discover chain IDs, please specify " ) +
                cc.warning( "--url-main-net" ) + cc.error( " and/or " ) +
                cc.warning( "--url-s-chain" ) + cc.error( " and/or " ) +
                cc.warning( "--url-t-chain" ) + cc.error( "." ) +
                "\n" );
                process.exit( 162 );
            }
            for( let i = 0; i < arr_urls_to_discover.length; ++ i ) {
                const joDiscoverEntry = arr_urls_to_discover[i];
                const chainId = await
                skaleObserver.discoverChainId( joDiscoverEntry.strURL );
                if( chainId === null ) {
                    log.write( strLogPrefix +
                    cc.error( "Failed to detect " ) +
                    cc.note( joDiscoverEntry.name ) + " " +
                    cc.attention( "chain ID" ) +
                    "\n" );
                } else {
                    const cid16 =
                        owaspUtils.ensureStartsWith0x(
                            owaspUtils.toBN( chainId ).toHexString()
                        );
                    const cid10 = "" + owaspUtils.toBN( chainId ).toString();
                    log.write( strLogPrefix +
                    cc.normal( "Got " ) + cc.note( joDiscoverEntry.name ) + " " +
                    cc.attention( "chain ID" ) + cc.normal( "=" ) +
                    cc.note( cid16 ) + cc.normal( "=" ) +
                    cc.note( cid10 ) + cc.normal( " from URL " ) +
                    cc.u( joDiscoverEntry.strURL ) +
                    "\n" );
                    joDiscoverEntry.fnSave( chainId );
                }
            }
            return true;
        }
    } );
}

function commandLineTaskReimbursementShowBalance() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Gas Reimbursement - Show Balance",
        "fn": async function() {
            await IMA.reimbursementShowBalance(
                imaState.chainProperties.mn.ethersProvider,
                imaState.joCommunityPool,
                imaState.chainProperties.mn.joAccount.address(),
                imaState.chainProperties.mn.strChainName,
                imaState.chainProperties.mn.chainId,
                imaState.chainProperties.mn.transactionCustomizer,
                imaState.strReimbursementChain,
                true
            );
            return true;
        }
    } );
}

function commandLineTaskReimbursementEstimateAmount() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Gas Reimbursement - Estimate Amount",
        "fn": async function() {
            await IMA.reimbursementEstimateAmount(
                imaState.chainProperties.mn.ethersProvider,
                imaState.joCommunityPool,
                imaState.chainProperties.mn.joAccount.address(),
                imaState.chainProperties.mn.strChainName,
                imaState.chainProperties.mn.chainId,
                imaState.chainProperties.mn.transactionCustomizer,
                imaState.strReimbursementChain,
                true
            );
            return true;
        }
    } );
}

function commandLineTaskReimbursementRecharge() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Gas Reimbursement - Recharge User Wallet",
        "fn": async function() {
            await IMA.reimbursementWalletRecharge(
                imaState.chainProperties.mn.ethersProvider,
                imaState.joCommunityPool,
                imaState.chainProperties.mn.joAccount,
                imaState.chainProperties.mn.strChainName,
                imaState.chainProperties.mn.chainId,
                imaState.chainProperties.mn.transactionCustomizer,
                imaState.strReimbursementChain,
                imaState.nReimbursementRecharge
            );
            return true;
        }
    } );
}

function commandLineTaskReimbursementWithdraw() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Gas Reimbursement - Withdraw User Wallet",
        "fn": async function() {
            await IMA.reimbursementWalletWithdraw(
                imaState.chainProperties.mn.ethersProvider,
                imaState.joCommunityPool,
                imaState.chainProperties.mn.joAccount,
                imaState.chainProperties.mn.strChainName,
                imaState.chainProperties.mn.chainId,
                imaState.chainProperties.mn.transactionCustomizer,
                imaState.strReimbursementChain,
                imaState.nReimbursementWithdraw
            );
            return true;
        }
    } );
}

function commandLineTaskReimbursementSetRange() {
    const imaState = state.get();
    imaState.arrActions.push( {
        "name": "Gas Reimbursement - Set Minimal time interval from S2M and S2S transfers",
        "fn": async function() {
            await IMA.reimbursementSetRange(
                imaState.chainProperties.sc.ethersProvider,
                imaState.joCommunityLocker,
                imaState.chainProperties.sc.joAccount,
                imaState.chainProperties.sc.strChainName,
                imaState.chainProperties.sc.chainId,
                imaState.chainProperties.sc.transactionCustomizer,
                imaState.strChainNameOriginChain,
                imaState.nReimbursementRange
            );
            return true;
        }
    } );
}

function parseCommandLine() {
    const imaState = state.get();
    cc.autoEnableFromCommandLineArgs();
    let strPrintedArguments = cc.normal( process.argv.join( " " ) );
    strPrintedArguments = imaUtils.replaceAll( strPrintedArguments, "--", cc.bright( "--" ) );
    strPrintedArguments = imaUtils.replaceAll( strPrintedArguments, "=", cc.sunny( "=" ) );
    strPrintedArguments = imaUtils.replaceAll( strPrintedArguments, "/", cc.info( "/" ) );
    strPrintedArguments = imaUtils.replaceAll( strPrintedArguments, ":", cc.info( ":" ) );
    log.write(
        cc.debug( "Agent was started with " ) + cc.info( process.argv.length ) +
        cc.debug( " command line argument(s) as: " ) +
        strPrintedArguments +
        "\n" );
    imaCLI.parse( {
        "register": commandLineTaskRegister,
        "register1": commandLineTaskRegister1,
        "check-registration": commandLineTaskCheckRegistration,
        "check-registration1": commandLineTaskCheckRegistration1,
        "mint-erc20": commandLineTaskMintErc20,
        "mint-erc721": commandLineTaskMintErc721,
        "mint-erc1155": commandLineTaskMintErc1155,
        "burn-erc20": commandLineTaskBurnErc20,
        "burn-erc721": commandLineTaskBurnErc721,
        "burn-erc1155": commandLineTaskBurnErc1155,
        "show-balance": commandLineTaskShowBalance,
        "m2s-payment": commandLineTaskPaymentM2S,
        "s2m-payment": commandLineTaskPaymentS2M,
        "s2s-payment": commandLineTaskPaymentS2S,
        "s2m-receive": commandLineTaskReceiveS2M,
        "s2m-view": commandLineTaskViewS2M,
        "m2s-transfer": commandLineTaskTransferM2S,
        "s2m-transfer": commandLineTaskTransferS2M,
        "s2s-transfer": commandLineTaskTransferS2S,
        "transfer": commandLineTaskTransfer,
        "loop": commandLineTaskLoop,
        "simple-loop": commandLineTaskLoopSimple,
        "browse-s-chain": commandLineTaskBrowseSChain,
        "browse-skale-network": commandLineTaskBrowseSkaleNetwork,
        "browse-connected-schains": commandLineTaskBrowseConnectedSChains,
        "discover-cid": commandLineTaskDiscoverChainId
    } );
    let haveReimbursementCommands = false;
    if( imaState.isShowReimbursementBalance ) {
        haveReimbursementCommands = true;
        commandLineTaskReimbursementShowBalance();
    }
    if( imaState.nReimbursementEstimate ) {
        haveReimbursementCommands = true;
        commandLineTaskReimbursementEstimateAmount();
    }
    if( imaState.nReimbursementRecharge ) {
        haveReimbursementCommands = true;
        commandLineTaskReimbursementRecharge();
    }
    if( imaState.nReimbursementWithdraw ) {
        haveReimbursementCommands = true;
        commandLineTaskReimbursementWithdraw();
    }
    if( haveReimbursementCommands ) {
        if( imaState.strReimbursementChain == "" ) {
            console.log( cc.fatal( "RUNTIME INIT ERROR:" ) +
                cc.error( " missing value for " ) + cc.info( "reimbursement-chain" ) +
                cc.error( " parameter, must be non-empty chain name" )
            );
            process.exit( 163 );
        }
    }
    if( imaState.nReimbursementRange >= 0 )
        commandLineTaskReimbursementSetRange();
    if( imaState.nAutoExitAfterSeconds > 0 ) {
        log.write(
            cc.debug( "Automatic exit after " ) + cc.info( imaState.nAutoExitAfterSeconds ) +
            cc.debug( " second(s) is requested." ) +
            "\n" );
        const iv = setInterval( function() {
            log.write(
                cc.debug( "Performing automatic exit after " ) +
                cc.info( imaState.nAutoExitAfterSeconds ) + cc.debug( " second(s)..." ) +
                "\n" );
            clearInterval( iv );
            process.exit( 0 );
        }, imaState.nAutoExitAfterSeconds * 1000 );
    } else
        log.write( cc.debug( "Automatic exit was not requested, skipping it." ) + "\n" );
    if( imaState.strLogFilePath.length > 0 ) {
        log.write(
            cc.debug( "Will print message to file " ) + cc.info( imaState.strLogFilePath ) +
            "\n" );
        log.add(
            imaState.strLogFilePath,
            imaState.nLogMaxSizeBeforeRotation,
            imaState.nLogMaxFilesCount
        );
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

function getSChainNodesCount( joSChainNetworkInfo ) {
    try {
        if( ! joSChainNetworkInfo )
            return 0;
        const jarrNodes = joSChainNetworkInfo.network;
        const cntNodes = jarrNodes.length;
        return cntNodes;
    } catch ( err ) {
        return 0;
    }
}

function getSChainDiscoveredNodesCount( joSChainNetworkInfo ) {
    try {
        if( ! joSChainNetworkInfo )
            return 0;
        if( ! ( "network" in joSChainNetworkInfo && joSChainNetworkInfo.network ) )
            return 0;
        const jarrNodes = joSChainNetworkInfo.network;
        const cntNodes = jarrNodes.length;
        if( cntNodes <= 0 )
            return 0;
        let cntDiscovered = 0;
        for( let i = 0; i < cntNodes; ++ i ) {
            try {
                const joNode = joSChainNetworkInfo.network[i];
                if( joNode && "imaInfo" in joNode && typeof joNode.imaInfo === "object" &&
                    "t" in joNode.imaInfo && typeof joNode.imaInfo.t === "number"
                )
                    ++ cntDiscovered;
            } catch ( err ) {
                return 0;
            }
        }
        return cntDiscovered;
    } catch ( err ) {
        return 0;
    }
}

let g_timerSChainDiscovery = null;
let g_bInSChainDiscovery = false;

async function continueSChainDiscoveryInBackgroundIfNeeded( isSilent ) {
    const imaState = state.get();
    const cntNodes = getSChainNodesCount( imaState.joSChainNetworkInfo );
    const cntDiscovered = getSChainDiscoveredNodesCount( imaState.joSChainNetworkInfo );
    if( cntDiscovered >= cntNodes ) {
        if( g_timerSChainDiscovery != null ) {
            clearInterval( g_timerSChainDiscovery );
            g_timerSChainDiscovery = null;
        }
        return;
    }
    if( g_timerSChainDiscovery != null )
        return;
    if( imaState.joSChainDiscovery.repeatIntervalMilliseconds <= 0 )
        return; // no S-Chain re-discovery (for debugging only)
    const fnAsyncHandler = async function() {
        if( g_bInSChainDiscovery )
            return;
        if( g_bInSChainDiscovery ) {
            isInsideAsyncHandler = false;
            if( log.verboseGet() >= log.verboseReversed().information )
                log.write( cc.warning( "Notice: long S-Chain discovery is in progress" ) + "\n" );
            return;
        }
        g_bInSChainDiscovery = true;
        try {
            if( log.verboseGet() >= log.verboseReversed().information ) {
                log.write(
                    cc.info( "Will re-discover " ) + cc.notice( cntNodes ) +
                    cc.info( "-node S-Chain network, " ) + cc.notice( cntDiscovered ) +
                    cc.info( " node(s) already discovered..." ) +
                    "\n" );
            }
            await discoverSChainNetwork( function( err, joSChainNetworkInfo ) {
                if( ! err ) {
                    const cntDiscoveredNew =
                        getSChainDiscoveredNodesCount( joSChainNetworkInfo );
                    if( log.verboseGet() >= log.verboseReversed().information ) {
                        const strDiscoveryStatus =
                            cc.info( cntDiscoveredNew ) + cc.success( " nodes known" );
                        let strMessage =
                            cc.success( "S-Chain network was re-discovered, " ) +
                            cc.info( cntDiscoveredNew ) +
                            cc.success( " of " ) + cc.info( cntNodes ) +
                            cc.success( " node(s) (" ) + strDiscoveryStatus + cc.success( ")" );
                        const cntStillUnknown = cntNodes - cntDiscoveredNew;
                        if( cntStillUnknown > 0 ) {
                            strMessage += cc.success( ", " ) +
                                cc.info( cntStillUnknown ) +
                                cc.success( " of " ) + cc.info( cntNodes ) +
                                cc.success( " still unknown (" );
                            try {
                                const jarrNodes = joSChainNetworkInfo.network;
                                let cntBad = 0;
                                for( let i = 0; i < jarrNodes.length; ++i ) {
                                    const joNode = jarrNodes[i];
                                    try {
                                        if( ! ( joNode && "imaInfo" in joNode &&
                                            typeof joNode.imaInfo === "object" &&
                                            "t" in joNode.imaInfo &&
                                            typeof joNode.imaInfo.t === "number" )
                                        ) {
                                            if( cntBad > 0 )
                                                strMessage += cc.success( ", " );
                                            const strNodeURL =
                                                imaUtils.composeSChainNodeUrl( joNode );
                                            const strNodeDescColorized =
                                                cc.notice( "#" ) + cc.info( i ) +
                                                cc.attention( "(" ) + cc.u( strNodeURL ) +
                                                cc.attention( ")" );
                                            strMessage += strNodeDescColorized;
                                            ++ cntBad;
                                        }
                                    } catch ( err ) { }
                                }
                            } catch ( err ) { }
                            strMessage += cc.success( ")" );
                        }
                        if( ! isSilent ) {
                            strMessage +=
                                cc.success( ", complete re-discovered S-Chain network info: " ) +
                                cc.j( joSChainNetworkInfo );
                        }
                        log.write( strMessage + "\n" );
                    }
                    imaState.joSChainNetworkInfo = joSChainNetworkInfo;
                }
                continueSChainDiscoveryInBackgroundIfNeeded( isSilent );
            }, isSilent, imaState.joSChainNetworkInfo, cntNodes ).catch( ( err ) => {
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    log.write(
                        cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " S-Chain network re-discovery failed: " ) +
                        cc.warning( strError ) + "\n"
                    );
                }
            } );
        } catch ( err ) { }
        g_bInSChainDiscovery = false;
    };
    g_timerSChainDiscovery = setInterval( function() {
        if( g_bInSChainDiscovery )
            return;
        fnAsyncHandler();
    }, imaState.joSChainDiscovery.repeatIntervalMilliseconds );
}

async function discoverSChainWalkNodes( optsDiscover ) {
    optsDiscover.cntFailed = 0;
    for( let i = 0; i < optsDiscover.cntNodes; ++ i ) {
        const nCurrentNodeIdx = 0 + i;
        const joNode = optsDiscover.jarrNodes[nCurrentNodeIdx];
        const strNodeURL = imaUtils.composeSChainNodeUrl( joNode );
        const strNodeDescColorized =
            cc.notice( "#" ) + cc.info( nCurrentNodeIdx ) +
            cc.attention( "(" ) + cc.u( strNodeURL ) + cc.attention( ")" );
        try {
            if( optsDiscover.joPrevSChainNetworkInfo &&
                "network" in optsDiscover.joPrevSChainNetworkInfo &&
                optsDiscover.joPrevSChainNetworkInfo.network ) {
                const joPrevNode =
                    optsDiscover.joPrevSChainNetworkInfo.network[nCurrentNodeIdx];
                if( joPrevNode && "imaInfo" in joPrevNode &&
                    typeof joPrevNode.imaInfo === "object" &&
                    "t" in joPrevNode.imaInfo &&
                    typeof joPrevNode.imaInfo.t === "number"
                ) {
                    joNode.imaInfo =
                    JSON.parse( JSON.stringify( joPrevNode.imaInfo ) );
                    if( ( !optsDiscover.isSilent ) &&
                    log.verboseGet() >= log.verboseReversed().information
                    ) {
                        log.write( optsDiscover.strLogPrefix +
                            cc.info( "OK, in case of " ) + strNodeDescColorized +
                            cc.info( " node " ) + cc.info( joNode.nodeID ) +
                            cc.info( " will use previous discovery result." ) +
                            "\n"
                        );
                    }
                    continue; // skip this node discovery, enrich rest of nodes
                }
            }
        } catch ( err ) { }
        const rpcCallOpts = null;
        try {
            await rpcCall.create( strNodeURL, rpcCallOpts,
                async function( joCall, err ) {
                    if( err ) {
                        if( ! optsDiscover.isSilent ) {
                            log.write( optsDiscover.strLogPrefix +
                                cc.fatal( "CRITICAL ERROR:" ) +
                                cc.error( " JSON RPC call to S-Chain node " ) +
                                strNodeDescColorized + cc.error( " failed" ) +
                                "\n" );
                        }
                        ++ optsDiscover.cntFailed;
                        if( joCall )
                            await joCall.disconnect();
                        return;
                    }
                    joCall.call( {
                        "method": "skale_imaInfo",
                        "params": {
                            "fromImaAgentIndex": optsDiscover.imaState.nNodeNumber
                        }
                    }, function( joIn, joOut, err ) {
                        ++ optsDiscover.nCountReceivedImaDescriptions;
                        if( err ) {
                            const strError =
                                owaspUtils.extractErrorMessage( err );
                            if( ! optsDiscover.isSilent ) {
                                log.write( optsDiscover.strLogPrefix +
                                    cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " JSON RPC call to S-Chain node " ) +
                            strNodeDescColorized + cc.error( " failed, error: " ) +
                            cc.warning( strError ) + "\n" );
                            }
                            ++ optsDiscover.cntFailed;
                            return;
                        }
                        joNode.imaInfo = joOut.result;
                        if( ( !optsDiscover.isSilent ) &&
                    log.verboseGet() >= log.verboseReversed().information ) {
                            log.write( optsDiscover.strLogPrefix +
                                cc.success( "OK, got " ) + strNodeDescColorized +
                                cc.success( " node " ) + cc.info( joNode.nodeID ) +
                                cc.success( " IMA information(" ) +
                                cc.info( optsDiscover.nCountReceivedImaDescriptions ) +
                                cc.success( " of " ) +
                                cc.info( optsDiscover.cntNodes ) + cc.success( ")." ) +
                                "\n" );
                        }
                    } );
                } );
        } catch ( err ) {
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                const strError = owaspUtils.extractErrorMessage( err );
                if( ! optsDiscover.isSilent ) {
                    log.write( optsDiscover.strLogPrefix +
                        cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to S-Chain node " ) +
                        strNodeDescColorized +
                        cc.error( " was not created: " ) + cc.warning( strError ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                        "\n" );
                }
            }
            ++ optsDiscover.cntFailed;
        }
    }
}

async function discoverSChainWait( optsDiscover ) {
    if( ( !optsDiscover.isSilent ) &&
        log.verboseGet() >= log.verboseReversed().information ) {
        log.write( optsDiscover.strLogPrefix +
            cc.debug( "Waiting for response from at least " ) +
            cc.info( optsDiscover.nCountToWait ) +
            cc.debug( " node(s)..." ) + "\n" );
    }
    let nWaitAttempt = 0;
    const nWaitStepMilliseconds = 1000;
    let cntWaitAttempts = Math.floor(
        optsDiscover.imaState.joSChainDiscovery.repeatIntervalMilliseconds /
        nWaitStepMilliseconds ) - 3;
    if( cntWaitAttempts < 1 )
        cntWaitAttempts = 1;
    const iv = setInterval( function() {
        optsDiscover.nCountAvailable =
        optsDiscover.cntNodes - optsDiscover.cntFailed;
        if( ! optsDiscover.isSilent ) {
            log.write( cc.debug( "Waiting attempt " ) + cc.info( nWaitAttempt ) +
                cc.debug( " of " ) + cc.info( cntWaitAttempts ) +
                cc.debug( " for S-Chain nodes, total " ) +
                cc.info( optsDiscover.cntNodes ) + cc.debug( ", available " ) +
                cc.info( optsDiscover.nCountAvailable ) +
                cc.debug( ", expected at least " ) +
                cc.info( optsDiscover.nCountToWait ) + "\n" );
        }
        if( ( !optsDiscover.isSilent ) &&
            log.verboseGet() >= log.verboseReversed().information ) {
            log.write( optsDiscover.strLogPrefix +
                cc.debug( "Have S-Chain description response about " ) +
                cc.info( optsDiscover.nCountReceivedImaDescriptions ) +
                cc.debug( " node(s)." ) + "\n" );
        }
        if( optsDiscover.nCountReceivedImaDescriptions >=
            optsDiscover.nCountToWait ) {
            clearInterval( iv );
            optsDiscover.fnAfter( null, optsDiscover.joSChainNetworkInfo );
            return;
        }
        ++ nWaitAttempt;
        if( nWaitAttempt >= cntWaitAttempts ) {
            clearInterval( iv );
            const strErrorDescription =
                "S-Chain network discovery wait timeout, " +
                "network will be re-discovered";
            if( ! optsDiscover.isSilent ) {
                log.write( optsDiscover.strLogPrefix +
                    cc.warning( "WARNING:" ) + " " +
                    cc.warning( strErrorDescription ) + "\n" );
            }
            if( getSChainDiscoveredNodesCount(
                optsDiscover.joSChainNetworkInfo ) > 0 )
                optsDiscover.fnAfter( null, optsDiscover.joSChainNetworkInfo );
            else
                optsDiscover.fnAfter( new Error( strErrorDescription ), null );
            return;
        }
        if( ! optsDiscover.isSilent ) {
            log.write( optsDiscover.strLogPrefix + cc.debug( " Waiting attempt " ) +
                cc.info( nWaitAttempt ) + cc.debug( " of " ) +
                cc.info( cntWaitAttempts ) + cc.debug( " for " ) +
                cc.notice( optsDiscover.nCountToWait -
                    optsDiscover.nCountReceivedImaDescriptions ) +
                cc.debug( " node answer(s)" ) + "\n" );
        }
    }, nWaitStepMilliseconds );
    await joCall.disconnect();
}

async function discoverSChainNetwork(
    fnAfter, isSilent, joPrevSChainNetworkInfo, nCountToWait
) {
    const optsDiscover = {
        fnAfter: fnAfter,
        isSilent: isSilent || false,
        joPrevSChainNetworkInfo: joPrevSChainNetworkInfo || null,
        nCountToWait: nCountToWait,
        imaState: state.get(),
        strLogPrefix: cc.info( "S-Chain network discovery:" ) + " ",
        joSChainNetworkInfo: null,
        jarrNodes: [],
        cntNodes: 0,
        cntFailed: 0,
        nCountReceivedImaDescriptions: 0,
        nCountAvailable: 0
    };
    if( optsDiscover.nCountToWait == null ||
        optsDiscover.nCountToWait == undefined ||
        optsDiscover.nCountToWait < 0 )
        optsDiscover.nCountToWait = 0;
    optsDiscover.fnAfter = optsDiscover.fnAfter || function() {};
    const rpcCallOpts = null;
    try {
        await rpcCall.create( optsDiscover.imaState.chainProperties.sc.strURL, rpcCallOpts,
            async function( joCall, err ) {
                if( err ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    if( ! optsDiscover.isSilent ) {
                        log.write( optsDiscover.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " JSON RPC call to (own) S-Chain " ) +
                            cc.u( optsDiscover.imaState.chainProperties.sc.strURL ) +
                            cc.error( " failed: " ) + cc.warning( strError ) + "\n" );
                    }
                    optsDiscover.fnAfter( err, null );
                    if( joCall )
                        await joCall.disconnect();
                    return;
                }
                await joCall.call( {
                    "method": "skale_nodesRpcInfo",
                    "params": { "fromImaAgentIndex": optsDiscover.imaState.nNodeNumber }
                }, async function( joIn, joOut, err ) {
                    if( err ) {
                        const strError = owaspUtils.extractErrorMessage( err );
                        if( ! optsDiscover.isSilent ) {
                            log.write( optsDiscover.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                cc.error( " JSON RPC call to (own) S-Chain " ) +
                                cc.u( optsDiscover.imaState.chainProperties.sc.strURL ) +
                                cc.error( " failed, error: " ) + cc.warning( strError ) + "\n" );
                        }
                        optsDiscover.fnAfter( err, null );
                        await joCall.disconnect();
                        return;
                    }
                    if( ( !optsDiscover.isSilent ) &&
                        log.verboseGet() >= log.verboseReversed().trace ) {
                        log.write( optsDiscover.strLogPrefix +
                        cc.debug( "OK, got (own) S-Chain network information: " ) +
                        cc.j( joOut.result ) + "\n" );
                    } else if(
                        ( !optsDiscover.isSilent ) &&
                        log.verboseGet() >= log.verboseReversed().information ) {
                        log.write( optsDiscover.strLogPrefix + cc.success( "OK, got S-Chain " ) +
                            cc.u( optsDiscover.imaState.chainProperties.sc.strURL ) +
                            cc.success( " network information." ) + "\n" );
                    }
                    optsDiscover.nCountReceivedImaDescriptions = 0;
                    optsDiscover.joSChainNetworkInfo = joOut.result;
                    if( ! optsDiscover.joSChainNetworkInfo ) {
                        const err2 = new Error(
                            "Got wrong response, network information description was not detected"
                        );
                        if( ! optsDiscover.isSilent ) {
                            log.write( optsDiscover.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                cc.error( " Network was not detected via call to " ) +
                                cc.u( optsDiscover.imaState.chainProperties.sc.strURL ) +
                                cc.error( ": " ) + cc.warning( err2 ) + "\n" );
                        }
                        optsDiscover.fnAfter( err2, null );
                        await joCall.disconnect();
                        return;
                    }
                    optsDiscover.jarrNodes = optsDiscover.joSChainNetworkInfo.network;
                    optsDiscover.cntNodes = optsDiscover.jarrNodes.length;
                    if( optsDiscover.nCountToWait <= 0 ) {
                        optsDiscover.nCountToWait = 0 + optsDiscover.cntNodes;
                        if( optsDiscover.nCountToWait > 2 ) {
                            optsDiscover.nCountToWait =
                                Math.ceil( optsDiscover.nCountToWait * 2 / 3 );
                        }
                    } else if( optsDiscover.nCountToWait > optsDiscover.cntNodes )
                        optsDiscover.nCountToWait = optsDiscover.cntNodes;
                    if( ! optsDiscover.isSilent ) {
                        log.write( optsDiscover.strLogPrefix +
                            cc.debug( "Will gather details of " ) +
                            cc.info( optsDiscover.nCountToWait ) + cc.debug( " of " ) +
                            cc.info( optsDiscover.cntNodes ) + cc.debug( " node(s)..." ) + "\n" );
                    }
                    await discoverSChainWalkNodes( optsDiscover );
                    optsDiscover.nCountAvailable = optsDiscover.cntNodes - optsDiscover.cntFailed;
                    if( ! optsDiscover.isSilent ) {
                        log.write( cc.debug( "Waiting for S-Chain nodes, total " ) +
                            cc.warning( optsDiscover.cntNodes ) + cc.debug( ", available " ) +
                            cc.warning( optsDiscover.nCountAvailable ) +
                            cc.debug( ", expected at least " ) +
                            cc.warning( optsDiscover.nCountToWait ) + "\n" );
                    }
                    if( optsDiscover.nCountAvailable < optsDiscover.nCountToWait ) {
                        if( ! optsDiscover.isSilent ) {
                            log.write( optsDiscover.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                cc.error( " Not enough nodes available on S-Chain, total " ) +
                                cc.warning( optsDiscover.cntNodes ) + cc.error( ", available " ) +
                                cc.warning( optsDiscover.nCountAvailable ) +
                                cc.error( ", expected at least " ) +
                                cc.warning( optsDiscover.nCountToWait ) + "\n" );
                        }
                        const err = new Error(
                            "Not enough nodes available on S-Chain, total " +
                            optsDiscover.cntNodes + ", available " + optsDiscover.nCountAvailable +
                            ", expected at least " + optsDiscover.nCountToWait );
                        optsDiscover.fnAfter( err, null );
                        return;
                    }
                    await discoverSChainWait( optsDiscover );
                } );
            } );
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( ! optsDiscover.isSilent ) {
                log.write( optsDiscover.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call to S-Chain was not created: " ) +
                    cc.warning( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
        }
        optsDiscover.joSChainNetworkInfo = null;
        optsDiscover.fnAfter( err, null );
    }
    return optsDiscover.joSChainNetworkInfo;
}

let g_wsServerMonitoring = null;

function initMonitoringServer() {
    const imaState = state.get();
    if( imaState.nMonitoringPort <= 0 )
        return;
    const strLogPrefix = cc.attention( "Monitoring:" ) + " ";
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        log.write( strLogPrefix +
            cc.normal( "Will start monitoring WS server on port " ) +
            cc.info( imaState.nMonitoringPort ) +
            "\n" );
    }
    g_wsServerMonitoring = new ws.WebSocketServer( { port: 0 + imaState.nMonitoringPort } );
    g_wsServerMonitoring.on( "connection", function( ws_peer, req ) {
        const ip = req.socket.remoteAddress;
        if( log.verboseGet() >= log.verboseReversed().trace )
            log.write( strLogPrefix + cc.normal( "New connection from " ) + cc.info( ip ) + "\n" );
        ws_peer.on( "message", function( message ) {
            const joAnswer = {
                "method": null,
                "id": null,
                "error": null
            };
            try {
                const joMessage = JSON.parse( message );
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    log.write( strLogPrefix +
                        cc.sunny( "<<<" ) + " " + cc.normal( "message from " ) + cc.info( ip ) +
                        cc.normal( ": " ) + cc.j( joMessage ) +
                        "\n" );
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
                        const arr_runtime_param_names = [
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
                        for( const param_name of arr_runtime_param_names ) {
                            if( param_name in imaState )
                                joAnswer.runtime_params[param_name] = imaState[param_name];

                        }
                    } break;
                case "get_last_transfer_errors":
                    joAnswer.last_transfer_errors = IMA.getLastTransferErrors(
                        ( ( "isIncludeTextLog" in joMessage ) && joMessage.isIncludeTextLog )
                            ? true : false );
                    joAnswer.last_error_categories = IMA.getLastErrorCategories();
                    break;
                default:
                    throw new Error(
                        "Unknown method name \"" + joMessage.method + "\" was specified" );
                } // switch( joMessage.method )
            } catch ( err ) {
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    log.write( strLogPrefix +
                        cc.error( "Bad message from " ) + cc.info( ip ) + cc.error( ": " ) +
                        cc.warning( message ) +
                        cc.error( ", error is: " ) + cc.warning( strError ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                        "\n"
                    );
                }
            }
            try {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    log.write( strLogPrefix + cc.sunny( ">>>" ) + " " + cc.normal( "answer to " ) +
                    cc.info( ip ) + cc.normal( ": " ) + cc.j( joAnswer ) +
                    "\n" );
                }
                ws_peer.send( JSON.stringify( joAnswer ) );
            } catch ( err ) {
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    log.write( strLogPrefix +
                        cc.error( "Failed to sent answer to " ) + cc.info( ip ) +
                        cc.error( ", error is: " ) + cc.warning( strError ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                        "\n"
                    );
                }
            }
        } );
    } );
}

let g_jsonRpcAppIMA = null;

function initJsonRpcServer() {
    const imaState = state.get();
    if( imaState.nJsonRpcPort <= 0 )
        return;
    const strLogPrefix = cc.attention( "JSON RPC:" ) + " ";
    g_jsonRpcAppIMA = express();
    g_jsonRpcAppIMA.use( bodyParser.urlencoded( { extended: true } ) );
    g_jsonRpcAppIMA.use( bodyParser.json() );
    g_jsonRpcAppIMA.post( "/", async function( req, res ) {
        const isSkipMode = false;
        const message = JSON.stringify( req.body );
        const ip = req.connection.remoteAddress.split( ":" ).pop();
        const fnSendAnswer = function( joAnswer ) {
            try {
                res.header( "Content-Type", "application/json" );
                res.status( 200 ).send( JSON.stringify( joAnswer ) );
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    log.write( strLogPrefix +
                        cc.sunny( ">>>" ) + " " + cc.normal( "did sent answer to " ) +
                        cc.info( ip ) + cc.normal( ": " ) + cc.j( joAnswer ) +
                        "\n" );
                }
            } catch ( err ) {
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    log.write( strLogPrefix +
                        cc.error( "Failed to sent answer " ) + cc.j( joAnswer ) +
                        cc.error( " to " ) + cc.info( ip ) +
                        cc.error( ", error is: " ) + cc.warning( strError ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                        "\n"
                    );
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
                log.write( strLogPrefix +
                    cc.sunny( "<<<" ) + " " + cc.normal( "Peer message from " ) +
                    cc.info( ip ) + cc.normal( ": " ) + cc.j( joMessage ) +
                    "\n" );
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
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                const strError = owaspUtils.extractErrorMessage( err );
                log.write( strLogPrefix +
                    cc.error( "Bad message from " ) + cc.info( ip ) + cc.error( ": " ) +
                    cc.warning( message ) +
                    cc.error( ", error is: " ) + cc.warning( strError ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                    "\n"
                );
            }
        }
        if( ! isSkipMode )
            fnSendAnswer( joAnswer );
    } );
    g_jsonRpcAppIMA.listen( imaState.nJsonRpcPort );
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
            log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );

        const joAction = imaState.arrActions[idxAction];
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            log.write( strLogPrefix +
                cc.notice( "Will execute action:" ) + " " + cc.info( joAction.name ) +
                cc.debug( " (" ) + cc.info( idxAction + 1 ) + cc.debug( " of " ) +
                cc.info( cntActions ) + cc.debug( ")" ) +
                "\n" );
        }

        try {
            if( await joAction.fn() ) {
                ++cntTrue;
                if( log.verboseGet() >= log.verboseReversed().information ) {
                    log.write( strLogPrefix +
                        cc.success( "Succeeded action:" ) + " " + cc.info( joAction.name ) +
                        "\n" );
                }
            } else {
                ++cntFalse;
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    log.write( strLogPrefix +
                        cc.warning( "Failed action:" ) + " " + cc.info( joAction.name ) +
                        "\n" );
                }
            }
        } catch ( err ) {
            ++cntFalse;
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                log.write( strLogPrefix +
                    cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Exception occurred while executing action: " ) +
                    cc.error( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                    "\n" );
            }
        }
    }
    if( log.verboseGet() >= log.verboseReversed().information ) {
        log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
        log.write( strLogPrefix + cc.info( "FINISH:" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntActions ) + cc.notice( " task(s) executed" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntTrue ) + cc.success( " task(s) succeeded" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntFalse ) + cc.error( " task(s) failed" ) + "\n" );
        log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
    }
    process.exitCode = ( cntFalse > 0 ) ? cntFalse : 0;
    if( ! state.isPreventExitAfterLastAction() )
        process.exit( process.exitCode );
}

const g_registrationCostInfo = {
    mn: [],
    sc: []
};

async function registerStep1( isPrintSummaryRegistrationCosts ) {
    const imaState = state.get();
    imaCLI.initContracts();
    const strLogPrefix = cc.info( "Reg 1:" ) + " ";
    log.write( strLogPrefix + cc.debug( "Will check chain registration now..." ) + "\n" );
    let bSuccess = await IMA.checkIsRegisteredSChainInDepositBoxes( // step 1
        imaState.chainProperties.mn.ethersProvider,
        imaState.joLinker,
        imaState.chainProperties.mn.joAccount,
        imaState.chainProperties.sc.strChainName
    );
    log.write( strLogPrefix + cc.debug( "Chain is " ) +
        ( bSuccess ? cc.success( "already registered" ) : cc.warning( "not registered yet" ) ) +
        "\n" );
    if( bSuccess )
        return true;
    const jarrReceipts =
        await IMA.registerSChainInDepositBoxes( // step 1
            imaState.chainProperties.mn.ethersProvider,
            imaState.joLinker,
            imaState.chainProperties.mn.joAccount,
            imaState.joTokenManagerETH, // only s-chain
            imaState.joTokenManagerERC20, // only s-chain
            imaState.joTokenManagerERC721, // only s-chain
            imaState.joTokenManagerERC1155, // only s-chain
            imaState.joTokenManagerERC721WithMetadata, // only s-chain
            imaState.joCommunityLocker, // only s-chain
            imaState.joTokenManagerLinker, // only s-chain
            imaState.chainProperties.sc.strChainName,
            imaState.chainProperties.mn.chainId,
            imaState.chainProperties.mn.transactionCustomizer //,
        );
    bSuccess = ( jarrReceipts != null && jarrReceipts.length > 0 ) ? true : false;
    log.write( strLogPrefix + cc.debug( "Chain was " ) +
        ( bSuccess ? cc.success( "registered successfully" ) : cc.error( "not registered" ) ) +
        "\n" );
    if( bSuccess ) {
        g_registrationCostInfo.mn =
            g_registrationCostInfo.mn.concat( g_registrationCostInfo.mn, jarrReceipts );
    }
    if( isPrintSummaryRegistrationCosts )
        printSummaryRegistrationCosts();
    if( !bSuccess ) {
        const nRetCode = 163;
        log.write( strLogPrefix + cc.fatal( "FATAL, CRITICAL ERROR:" ) +
            cc.error( " failed to register S-Chain in deposit box, will return code " ) +
            cc.warning( nRetCode ) + "\n" );
        process.exit( nRetCode );
    }
    return true;
}
async function registerAll( isPrintSummaryRegistrationCosts ) {
    if( !await registerStep1( false ) )
        return false;
    if( isPrintSummaryRegistrationCosts )
        printSummaryRegistrationCosts();
    return true;
}

async function checkRegistrationAll() {
    const b1 = await checkRegistrationStep1();
    return b1;
}
async function checkRegistrationStep1() {
    const imaState = state.get();
    imaCLI.initContracts();
    const bRetVal = await IMA.checkIsRegisteredSChainInDepositBoxes( // step 1
        imaState.chainProperties.mn.ethersProvider,
        imaState.joLinker,
        imaState.chainProperties.mn.joAccount,
        imaState.chainProperties.sc.strChainName
    );
    return bRetVal;
}

function printSummaryRegistrationCosts( details ) {
    IMA.printGasUsageReportFromArray(
        "Main Net REGISTRATION",
        g_registrationCostInfo.mn,
        details
    );
    IMA.printGasUsageReportFromArray(
        "S-Chain REGISTRATION",
        g_registrationCostInfo.sc,
        details
    );
}

async function waitUntilSChainStarted() {
    const imaState = state.get();
    log.write(
        cc.debug( "Checking " ) + cc.info( "S-Chain" ) + cc.debug( " is accessible and sane..." ) +
        "\n" );
    if( ( !imaState.chainProperties.sc.strURL ) ||
        imaState.chainProperties.sc.strURL.length === 0
    ) {
        log.write( cc.warning( "Skipped, " ) + cc.info( "S-Chain" ) +
            cc.warning( " URL was not provided." ) + "\n" );
        return;
    }
    let bSuccess = false;
    let idxWaitAttempt = 0;
    for( ; !bSuccess; ) {
        try {
            const joSChainNetworkInfo = await discoverSChainNetwork(
                function( err, joSChainNetworkInfo ) {
                    if( ! err )
                        bSuccess = true;
                }, true, null, -1 ).catch( ( err ) => {
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    log.write( cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " S-Chain network discovery failed: " ) +
                            cc.warning( strError ) + "\n" );
                }
            } );
            if( ! joSChainNetworkInfo )
                bSuccess = false;
        } catch ( err ) {
            bSuccess = false;
        }
        if( !bSuccess )
            ++ idxWaitAttempt;
        if( idxWaitAttempt >= imaState.nMaxWaitSChainAttempts ) {
            log.write( cc.warning( "Incomplete, " ) + cc.info( "S-Chain" ) +
                cc.warning( " sanity check failed after " ) + cc.info( idxWaitAttempt ) +
                cc.warning( " attempts." ) + "\n" );
            return;
        }
        await IMA.sleep( 1000 );
    }
    log.write(
        cc.success( "Done, " ) + cc.info( "S-Chain" ) +
        cc.success( " is accessible and sane." ) +
        "\n" );
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
            log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) +
                cc.error( " please specify --bls-glue parameter." ) + "\n" );
            process.exit( 164 );
        }
        if( imaState.strPathHashG1.length == 0 ) {
            log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) +
                cc.error( " please specify --hash-g1 parameter." ) + "\n" );
            process.exit( 165 );
        }
        if( ! imaState.bNoWaitSChainStarted ) {
            const isSilent = imaState.joSChainDiscovery.isSilentReDiscovery;
            waitUntilSChainStarted().then( function() {
                // uses call to discoverSChainNetwork()
                discoverSChainNetwork( function( err, joSChainNetworkInfo ) {
                    if( err ) {
                        // error information is printed by discoverSChainNetwork()
                        process.exit( 166 );
                    }
                    if( log.verboseGet() >= log.verboseReversed().information ) {
                        log.write( cc.success( "S-Chain network was discovered: " ) +
                            cc.j( joSChainNetworkInfo ) + "\n" );
                    }
                    imaState.joSChainNetworkInfo = joSChainNetworkInfo;
                    continueSChainDiscoveryInBackgroundIfNeeded( isSilent );
                    doTheJob();
                    return 0; // FINISH
                }, isSilent, imaState.joSChainNetworkInfo, -1 ).catch( ( err ) => {
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        const strError = owaspUtils.extractErrorMessage( err );
                        log.write(
                            cc.fatal( "CRITICAL ERROR:" ) +
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
