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

import * as owaspUtils from "../npms/skale-owasp/owasp-utils.mjs";
import * as log from "../npms/skale-log/log.mjs";
import * as cc from "../npms/skale-cc/cc.mjs";
import * as imaCLI from "./cli.mjs";
import * as rpcCall from "./rpc-call.mjs";
import * as skale_observer from "../npms/skale-observer/observer.mjs";
import * as loop from "./loop.mjs";
import * as imaUtils from "./utils.mjs";
import * as IMA from "../npms/skale-ima/index.mjs";
import * as imaBLS from "./bls.mjs";
import * as pwa from "./pwa.mjs";

import * as state from "./state.mjs";

// allow self-signed wss and https
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

function initial_skale_network_scan_for_S2S() {
    const imaState = state.get();
    if( ! imaState.s2s_opts.isEnabled )
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
                    imaState.s2s_opts.secondsToReDiscoverSkaleNetwork,
                "chain": imaState.chainProperties.sc,
                "bParallelMode": true
            };
            const addressFrom = imaState.chainProperties.mn.joAccount.address();
            log.write( strLogPrefix +
                cc.debug( "Will start periodic S-Chains caching..." ) +
                "\n" );
            await skale_observer.periodic_caching_start(
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

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

function parse_command_line() {
    cc.auto_enable_from_command_line_args();
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
    const imaState = state.get();
    imaCLI.parse( {
        "register": function() {
            imaState.arrActions.push( {
                "name": "Full registration(all steps)",
                "fn": async function() {
                    if( ! imaState.bNoWaitSChainStarted )
                        await wait_until_s_chain_started(); // register_all
                    return await register_all( true );
                }
            } );
        },
        "register1": function() {
            imaState.arrActions.push( {
                "name": "Registration step 1, register S-Chain in deposit box",
                "fn": async function() {
                    if( ! imaState.bNoWaitSChainStarted )
                        await wait_until_s_chain_started(); // register_step1
                    return await register_step1( true );
                }
            } );
        },
        "check-registration": function() {
            imaState.arrActions.push( {
                "name": "Full registration status check(all steps)",
                "fn": async function() {
                    if( ! imaState.bNoWaitSChainStarted )
                        await wait_until_s_chain_started(); // check_registration_all
                    const b = await check_registration_all();
                    // nExitCode is: 0 - OKay - registered; non-zero -  not registered or error
                    const nExitCode = b ? 0 : 150;
                    log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
                    process.exit( nExitCode );
                }
            } );
        },
        "check-registration1": function() {
            imaState.arrActions.push( {
                "name": "Registration status check step 1, register S-Chain in deposit box",
                "fn": async function() {
                    if( ! imaState.bNoWaitSChainStarted )
                        await wait_until_s_chain_started(); // check_registration_step1
                    const b = await check_registration_step1();
                    // nExitCode is: 0 - OKay - registered; non-zero -  not registered or error
                    const nExitCode = b ? 0 : 152;
                    log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
                    process.exit( nExitCode );
                }
            } );
        },
        "mint-erc20": function() {
            imaState.arrActions.push( {
                "name": "mint ERC20",
                "fn": async function() {
                    let bMintIsOK = false;
                    if( imaState.chainProperties.tc.strCoinNameErc20.length > 0 ) {
                        try {
                            const strAddressMintTo = // same as caller/transaction signer
                                imaState.chainProperties.tc.joAccount.address();
                            bMintIsOK =
                                await IMA.mintERC20(
                                    imaState.chainProperties.tc.ethersProvider,
                                    imaState.chainProperties.tc.cid,
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
        },
        "mint-erc721": function() {
            imaState.arrActions.push( {
                "name": "mint ERC721",
                "fn": async function() {
                    let bMintIsOK = false;
                    if( imaState.chainProperties.tc.strCoinNameErc721.length > 0 ) {
                        try {
                            const strAddressMintTo = // same as caller/transaction signer
                                imaState.chainProperties.tc.joAccount.address();
                            const idTokens = imaState.have_idTokens ? imaState.idTokens : [];
                            if( imaState.have_idToken )
                                idTokens.push( imaState.idToken );
                            if( idTokens.length > 0 ) {
                                for( let i = 0; i < idTokens.length; ++ i ) {
                                    const idToken = idTokens[i];
                                    bMintIsOK =
                                        await IMA.mintERC721(
                                            imaState.chainProperties.tc.ethersProvider,
                                            imaState.chainProperties.tc.cid,
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
        },
        "mint-erc1155": function() {
            imaState.arrActions.push( {
                "name": "mint ERC1155",
                "fn": async function() {
                    let bMintIsOK = false;
                    if( imaState.chainProperties.tc.strCoinNameErc1155.length > 0 ) {
                        try {
                            const strAddressMintTo = // same as caller/transaction signer
                                imaState.chainProperties.tc.joAccount.address();
                            const idTokens = imaState.have_idTokens ? imaState.idTokens : [];
                            if( imaState.have_idToken )
                                idTokens.push( imaState.idToken );
                            if( idTokens.length > 0 ) {
                                for( let i = 0; i < idTokens.length; ++ i ) {
                                    const idToken = idTokens[i];
                                    bMintIsOK =
                                        await IMA.mintERC1155(
                                            imaState.chainProperties.tc.ethersProvider,
                                            imaState.chainProperties.tc.cid,
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
        },
        "burn-erc20": function() {
            imaState.arrActions.push( {
                "name": "burn ERC20",
                "fn": async function() {
                    let bBurnIsOK = false;
                    if( imaState.chainProperties.tc.strCoinNameErc20.length > 0 ) {
                        try {
                            const strAddressBurnFrom = // same as caller/transaction signer
                                imaState.chainProperties.tc.joAccount.address();
                            bBurnIsOK =
                                await IMA.burnERC20(
                                    imaState.chainProperties.tc.ethersProvider,
                                    imaState.chainProperties.tc.cid,
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
        },
        "burn-erc721": function() {
            imaState.arrActions.push( {
                "name": "burn ERC721",
                "fn": async function() {
                    let bBurnIsOK = false;
                    if( imaState.chainProperties.tc.strCoinNameErc721.length > 0 ) {
                        try {
                            const idTokens = imaState.have_idTokens ? imaState.idTokens : [];
                            if( imaState.have_idToken )
                                idTokens.push( imaState.idToken );
                            if( idTokens.length > 0 ) {
                                for( let i = 0; i < idTokens.length; ++ i ) {
                                    const idToken = idTokens[i];
                                    bBurnIsOK =
                                        await IMA.burnERC721(
                                            imaState.chainProperties.tc.ethersProvider,
                                            imaState.chainProperties.tc.cid,
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
        },
        "burn-erc1155": function() {
            imaState.arrActions.push( {
                "name": "burn ERC1155",
                "fn": async function() {
                    let bBurnIsOK = false;
                    if( imaState.chainProperties.tc.strCoinNameErc1155.length > 0 ) {
                        try {
                            const strAddressBurnFrom = // same as caller/transaction signer
                                imaState.chainProperties.tc.joAccount.address();
                            const idTokens = imaState.have_idTokens ? imaState.idTokens : [];
                            if( imaState.have_idToken )
                                idTokens.push( imaState.idToken );
                            if( idTokens.length > 0 ) {
                                for( let i = 0; i < idTokens.length; ++ i ) {
                                    const idToken = idTokens[i];
                                    bBurnIsOK =
                                        await IMA.burnERC1155(
                                            imaState.chainProperties.tc.ethersProvider,
                                            imaState.chainProperties.tc.cid,
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
        },
        "show-balance": function() {
            imaState.arrActions.push( {
                "name": "show balance",
                "fn": async function() {
                    let assetAddress = null;
                    const arrBalancesMN = [], arrBalancesSC = [];
                    arrBalancesMN.push( {
                        "assetName": "RealETH",
                        "balance": await IMA.balanceETH(
                            true, // isMainNet
                            imaState.chainProperties.mn.ethersProvider,
                            imaState.chainProperties.mn.cid,
                            imaState.chainProperties.mn.joAccount
                        )
                    } );
                    arrBalancesMN.push( {
                        "assetName": "CanReceiveETH",
                        "balance": await IMA.view_eth_payment_from_s_chain_on_main_net(
                            imaState.chainProperties.mn.ethersProvider,
                            imaState.chainProperties.mn.joAccount,
                            imaState.jo_deposit_box_eth
                        )
                    } );
                    try {
                        assetAddress = imaState.eth_erc20.address;
                    } catch ( err ) {
                        assetAddress = null;
                    }
                    arrBalancesSC.push( {
                        "assetName": "RealETH",
                        "assetAddress": assetAddress,
                        "balance": await IMA.balanceETH(
                            false, // isMainNet
                            imaState.chainProperties.sc.ethersProvider,
                            imaState.chainProperties.sc.cid,
                            imaState.chainProperties.sc.joAccount,
                            imaState.eth_erc20
                        )
                    } );
                    arrBalancesSC.push( {
                        "assetName": "FakeETH",
                        "balance": await IMA.balanceETH(
                            true, // isMainNet here is true, but we do call S-Chain
                            imaState.chainProperties.sc.ethersProvider,
                            imaState.chainProperties.sc.cid,
                            imaState.chainProperties.sc.joAccount
                        )
                    } );
                    if( imaState.chainProperties.tc.strCoinNameErc20.length > 0 ) {
                        try {
                            assetAddress =
                                imaState.chainProperties.mn.joErc20[
                                    imaState.chainProperties.tc.strCoinNameErc20 + "_address"];
                        } catch ( err ) {
                            assetAddress = null;
                        }
                        arrBalancesMN.push( {
                            "assetName": "ERC20",
                            "assetAddress": assetAddress,
                            "balance": await IMA.balanceERC20(
                                true, // isMainNet
                                imaState.chainProperties.mn.ethersProvider,
                                imaState.chainProperties.mn.cid,
                                imaState.chainProperties.mn.joAccount,
                                imaState.chainProperties.tc.strCoinNameErc20,
                                imaState.chainProperties.mn.joErc20
                            )
                        } );
                    }
                    if( imaState.chainProperties.sc.strCoinNameErc20.length > 0 ) {
                        try {
                            assetAddress =
                                imaState.chainProperties.sc.joErc20[
                                    imaState.chainProperties.sc.strCoinNameErc20 + "_address"];
                        } catch ( err ) {
                            assetAddress = null;
                        }
                        arrBalancesSC.push( {
                            "assetName": "ERC20",
                            "assetAddress": assetAddress,
                            "balance": await IMA.balanceERC20(
                                false, // isMainNet
                                imaState.chainProperties.sc.ethersProvider,
                                imaState.chainProperties.sc.cid,
                                imaState.chainProperties.sc.joAccount,
                                imaState.chainProperties.sc.strCoinNameErc20,
                                imaState.chainProperties.sc.joErc20
                            )
                        } );
                    }
                    const idTokens = imaState.have_idTokens ? imaState.idTokens : [];
                    if( imaState.have_idToken )
                        idTokens.push( imaState.idToken );
                    if( idTokens.length > 0 ) {
                        if( imaState.chainProperties.mn.strCoinNameErc721.length > 0 ) {
                            for( let i = 0; i < idTokens.length; ++ i ) {
                                const idToken = idTokens[i];
                                try {
                                    assetAddress =
                                        imaState.chainProperties.mn.joErc721[
                                            imaState.chainProperties.mn.strCoinNameErc721 +
                                                "_address"];
                                } catch ( err ) {
                                    assetAddress = null;
                                }
                                arrBalancesMN.push( {
                                    "assetName": "ERC721",
                                    "assetAddress": assetAddress,
                                    "idToken": idToken,
                                    "owner": await IMA.ownerOfERC721(
                                        true, // isMainNet
                                        imaState.chainProperties.mn.ethersProvider,
                                        imaState.chainProperties.mn.cid,
                                        imaState.chainProperties.mn.joAccount,
                                        imaState.chainProperties.mn.strCoinNameErc721,
                                        imaState.chainProperties.mn.joErc721,
                                        idToken
                                    )
                                } );
                            }
                        }
                        if( imaState.chainProperties.sc.strCoinNameErc721.length > 0 ) {
                            for( let i = 0; i < idTokens.length; ++ i ) {
                                const idToken = idTokens[i];
                                try {
                                    assetAddress =
                                        imaState.chainProperties.sc.joErc721[
                                            imaState.chainProperties.sc.strCoinNameErc721 +
                                                "_address"];
                                } catch ( err ) {
                                    assetAddress = null;
                                }
                                arrBalancesSC.push( {
                                    "assetName": "ERC721",
                                    "assetAddress": assetAddress,
                                    "idToken": idToken,
                                    "owner": await IMA.ownerOfERC721(
                                        false, // isMainNet
                                        imaState.chainProperties.sc.ethersProvider,
                                        imaState.chainProperties.sc.cid,
                                        imaState.chainProperties.sc.joAccount,
                                        imaState.chainProperties.sc.strCoinNameErc721,
                                        imaState.chainProperties.sc.joErc721,
                                        idToken
                                    )
                                } );
                            }
                        }
                        if( imaState.chainProperties.mn.strCoinNameErc1155.length > 0 ) {
                            for( let i = 0; i < idTokens.length; ++ i ) {
                                const idToken = idTokens[i];
                                try {
                                    assetAddress =
                                        imaState.chainProperties.mn.joErc1155[
                                            imaState.chainProperties.mn.strCoinNameErc1155 +
                                                "_address"];
                                } catch ( err ) {
                                    assetAddress = null;
                                }
                                arrBalancesMN.push( {
                                    "assetName": "ERC1155",
                                    "assetAddress": assetAddress,
                                    "idToken": idToken,
                                    "balance": await IMA.balanceERC1155(
                                        true, // isMainNet
                                        imaState.chainProperties.mn.ethersProvider,
                                        imaState.chainProperties.mn.cid,
                                        imaState.chainProperties.mn.joAccount,
                                        imaState.chainProperties.mn.strCoinNameErc1155,
                                        imaState.chainProperties.mn.joErc1155,
                                        idToken
                                    )
                                } );
                            }
                        }
                        if( imaState.chainProperties.sc.strCoinNameErc1155.length > 0 ) {
                            for( let i = 0; i < idTokens.length; ++ i ) {
                                const idToken = idTokens[i];
                                try {
                                    assetAddress =
                                        imaState.chainProperties.sc.joErc1155[
                                            imaState.chainProperties.sc.strCoinNameErc1155 +
                                                "_address"];
                                } catch ( err ) {
                                    assetAddress = null;
                                }
                                arrBalancesSC.push( {
                                    "assetName": "ERC1155",
                                    "assetAddress": assetAddress,
                                    "idToken": idToken,
                                    "balance": await IMA.balanceERC1155(
                                        false, // isMainNet
                                        imaState.chainProperties.sc.ethersProvider,
                                        imaState.chainProperties.sc.cid,
                                        imaState.chainProperties.sc.joAccount,
                                        imaState.chainProperties.sc.strCoinNameErc1155,
                                        imaState.chainProperties.sc.joErc1155,
                                        idToken
                                    )
                                } );
                            }
                        }
                    } // if( idTokens.length > 0 )
                    const format_balance_info = function( bi, strAddress ) {
                        let s = "";
                        s += cc.attention( bi.assetName );
                        if( "assetAddress" in bi &&
                            typeof bi.assetAddress == "string" &&
                            bi.assetAddress.length > 0
                        )
                            s += cc.normal( "/" ) + cc.notice( bi.assetAddress );
                        if( "idToken" in bi )
                            s += cc.normal( " token ID " ) + cc.notice( bi.idToken );
                        s += cc.normal( ( bi.assetName == "ERC721" )
                            ? " owner is " : " balance is " );
                        s += ( bi.assetName == "ERC721" )
                            ? cc.bright( bi.owner ) : cc.sunny( bi.balance );
                        if( bi.assetName == "ERC721" ) {
                            const isSame =
                                ( bi.owner.trim().toLowerCase() ==
                                    strAddress.trim().toLowerCase() );
                            s += " " + ( isSame
                                ? cc.success( "same (as account " ) +
                                    cc.attention( strAddress ) +
                                    cc.success( " specified in the command line arguments)" )
                                : cc.error( "different (than account " ) +
                                    cc.attention( strAddress ) +
                                        cc.error( " specified in the command line arguments)" ) );
                        }
                        return s;
                    };
                    if( arrBalancesMN.length > 0 || arrBalancesSC.length > 0 ) {
                        if( arrBalancesMN.length > 0 ) {
                            const strAddress = imaState.chainProperties.mn.joAccount.address();
                            log.write( cc.sunny( "Main Net" ) + " " +
                            cc.bright( arrBalancesMN.length > 1 ? "balances" : "balance" ) +
                            cc.bright( " of " ) + cc.notice( strAddress ) +
                            cc.bright( ":" ) + "\n" );
                            for( let i = 0; i < arrBalancesMN.length; ++ i ) {
                                const bi = arrBalancesMN[i];
                                log.write( "    " + format_balance_info( bi, strAddress ) + "\n" );
                            }
                        }
                        if( arrBalancesSC.length > 0 ) {
                            const strAddress = imaState.chainProperties.sc.joAccount.address();
                            log.write( cc.sunny( "S-Chain" ) + " " +
                            cc.bright( arrBalancesMN.length > 1 ? "balances" : "balance" ) +
                            cc.bright( " of " ) + cc.notice( strAddress ) +
                            cc.bright( ":" ) + "\n" );
                            for( let i = 0; i < arrBalancesSC.length; ++ i ) {
                                const bi = arrBalancesSC[i];
                                log.write( "    " + format_balance_info( bi, strAddress ) + "\n" );
                            }
                        }
                    } else
                        log.write( cc.warning( "No balances to scan." ) );
                    return true;
                }
            } );
        },
        "m2s-payment": function() {
            imaState.arrActions.push( {
                "name": "one M->S single payment",
                "fn": async function() {
                    if( imaState.chainProperties.mn.strCoinNameErc721.length > 0 ) {
                        // ERC721 payment
                        log.write(
                            cc.info( "one M->S single ERC721 payment: " ) +
                            cc.sunny( imaState.idToken ) +
                            "\n" ); // just print value
                        return await IMA.do_erc721_payment_from_main_net(
                            imaState.chainProperties.mn.ethersProvider,
                            imaState.chainProperties.sc.ethersProvider,
                            imaState.chainProperties.mn.cid,
                            imaState.chainProperties.sc.cid,
                            imaState.chainProperties.mn.joAccount,
                            imaState.chainProperties.sc.joAccount,
                            imaState.isWithMetadata721
                                ? imaState.jo_deposit_box_erc721_with_metadata
                                : imaState.jo_deposit_box_erc721, // only main net
                            imaState.jo_message_proxy_main_net, // for checking logs
                            imaState.chainProperties.sc.strChainName,
                            imaState.idToken, // which ERC721 token id to send
                            imaState.nAmountOfWei, // how much to send
                            imaState.isWithMetadata721
                                ? imaState.jo_token_manager_erc721_with_metadata
                                : imaState.jo_token_manager_erc721, // only s-chain
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
                        return await IMA.do_erc20_payment_from_main_net(
                            imaState.chainProperties.mn.ethersProvider,
                            imaState.chainProperties.sc.ethersProvider,
                            imaState.chainProperties.mn.cid,
                            imaState.chainProperties.sc.cid,
                            imaState.chainProperties.mn.joAccount,
                            imaState.chainProperties.sc.joAccount,
                            imaState.jo_deposit_box_erc20, // only main net
                            imaState.jo_message_proxy_main_net, // for checking logs
                            imaState.chainProperties.sc.strChainName,
                            imaState.nAmountOfToken, // how much ERC20 tokens to send
                            imaState.nAmountOfWei, // how much to send
                            imaState.jo_token_manager_erc20, // only s-chain
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
                        return await IMA.do_erc1155_payment_from_main_net(
                            imaState.chainProperties.mn.ethersProvider,
                            imaState.chainProperties.sc.ethersProvider,
                            imaState.chainProperties.mn.cid,
                            imaState.chainProperties.sc.cid,
                            imaState.chainProperties.mn.joAccount,
                            imaState.chainProperties.sc.joAccount,
                            imaState.jo_deposit_box_erc1155, // only main net
                            imaState.jo_message_proxy_main_net, // for checking logs
                            imaState.chainProperties.sc.strChainName,
                            imaState.idToken, // which ERC1155 token id to send
                            imaState.nAmountOfToken, // which ERC1155 token amount to send
                            imaState.nAmountOfWei, // how much to send
                            imaState.jo_token_manager_erc1155, // only s-chain
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
                        return await IMA.do_erc1155_batch_payment_from_main_net(
                            imaState.chainProperties.mn.ethersProvider,
                            imaState.chainProperties.sc.ethersProvider,
                            imaState.chainProperties.mn.cid,
                            imaState.chainProperties.sc.cid,
                            imaState.chainProperties.mn.joAccount,
                            imaState.chainProperties.sc.joAccount,
                            imaState.jo_deposit_box_erc1155, // only main net
                            imaState.jo_message_proxy_main_net, // for checking logs
                            imaState.chainProperties.sc.strChainName,
                            imaState.idTokens, // which ERC1155 token id to send
                            imaState.arrAmountsOfTokens, // which ERC1155 token amount to send
                            imaState.nAmountOfWei, // how much to send
                            imaState.jo_token_manager_erc1155, // only s-chain
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
                    return await IMA.do_eth_payment_from_main_net(
                        imaState.chainProperties.mn.ethersProvider,
                        imaState.chainProperties.mn.cid,
                        imaState.chainProperties.mn.joAccount,
                        imaState.chainProperties.sc.joAccount,
                        imaState.jo_deposit_box_eth, // only main net
                        imaState.jo_message_proxy_main_net, // for checking logs
                        imaState.chainProperties.sc.strChainName,
                        imaState.nAmountOfWei, // how much WEI money to send
                        imaState.chainProperties.mn.transactionCustomizer
                    );
                }
            } );
        },
        "s2m-payment": function() {
            imaState.arrActions.push( {
                "name": "one S->M single payment",
                "fn": async function() {
                    if( imaState.chainProperties.sc.strCoinNameErc721.length > 0 ) {
                        // ERC721 payment
                        log.write(
                            cc.info( "one S->M single ERC721 payment: " ) +
                            cc.sunny( imaState.idToken ) +
                             "\n" ); // just print value
                        return await IMA.do_erc721_payment_from_s_chain(
                            imaState.chainProperties.mn.ethersProvider,
                            imaState.chainProperties.sc.ethersProvider,
                            imaState.chainProperties.mn.cid,
                            imaState.chainProperties.sc.cid,
                            imaState.chainProperties.sc.joAccount,
                            imaState.chainProperties.mn.joAccount,
                            imaState.isWithMetadata721
                                ? imaState.jo_token_manager_erc721_with_metadata
                                : imaState.jo_token_manager_erc721, // only s-chain
                            imaState.jo_message_proxy_s_chain, // for checking logs
                            imaState.isWithMetadata721
                                ? imaState.jo_deposit_box_erc721_with_metadata
                                : imaState.jo_deposit_box_erc721, // only main net
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
                        return await IMA.do_erc20_payment_from_s_chain(
                            imaState.chainProperties.mn.ethersProvider,
                            imaState.chainProperties.sc.ethersProvider,
                            imaState.chainProperties.mn.cid,
                            imaState.chainProperties.sc.cid,
                            imaState.chainProperties.sc.joAccount,
                            imaState.chainProperties.mn.joAccount,
                            imaState.jo_token_manager_erc20, // only s-chain
                            imaState.jo_message_proxy_s_chain, // for checking logs
                            imaState.jo_deposit_box_erc20, // only main net
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
                        return await IMA.do_erc1155_payment_from_s_chain(
                            imaState.chainProperties.mn.ethersProvider,
                            imaState.chainProperties.sc.ethersProvider,
                            imaState.chainProperties.mn.cid,
                            imaState.chainProperties.sc.cid,
                            imaState.chainProperties.sc.joAccount,
                            imaState.chainProperties.mn.joAccount,
                            imaState.jo_token_manager_erc1155, // only s-chain
                            imaState.jo_message_proxy_s_chain, // for checking logs
                            imaState.jo_deposit_box_erc1155, // only main net
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
                        return await IMA.do_erc1155_batch_payment_from_s_chain(
                            imaState.chainProperties.mn.ethersProvider,
                            imaState.chainProperties.sc.ethersProvider,
                            imaState.chainProperties.mn.cid,
                            imaState.chainProperties.sc.cid,
                            imaState.chainProperties.sc.joAccount,
                            imaState.chainProperties.mn.joAccount,
                            imaState.jo_token_manager_erc1155, // only s-chain
                            imaState.jo_message_proxy_s_chain, // for checking logs
                            imaState.jo_deposit_box_erc1155, // only main net
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
                    return await IMA.do_eth_payment_from_s_chain(
                        imaState.chainProperties.sc.ethersProvider,
                        imaState.chainProperties.sc.cid,
                        imaState.chainProperties.sc.joAccount,
                        imaState.chainProperties.mn.joAccount,
                        imaState.jo_token_manager_eth, // only s-chain
                        imaState.jo_message_proxy_s_chain, // for checking logs
                        imaState.nAmountOfWei, // how much WEI money to send
                        imaState.chainProperties.sc.transactionCustomizer
                    );
                }
            } );
        },
        "s2s-payment": function() {
            imaState.arrActions.push( {
                "name": "one S->S single payment",
                "fn": async function() {
                    const isForward = IMA.isForwardS2S();
                    const ethersProvider_src = isForward
                        ? imaState.chainProperties.sc.ethersProvider
                        : imaState.chainProperties.tc.ethersProvider;
                    const cid_src = isForward
                        ? imaState.chainProperties.sc.cid
                        : imaState.chainProperties.tc.cid;
                    const joAccountSrc = isForward
                        ? imaState.chainProperties.sc.joAccount
                        : imaState.chainProperties.tc.joAccount;
                    const jo_token_manager_erc20_src = isForward
                        ? imaState.jo_token_manager_erc20
                        : imaState.jo_token_manager_erc20_target;
                    const jo_token_manager_erc721_src = isForward
                        ? ( imaState.isWithMetadata721
                            ? imaState.jo_token_manager_erc721_with_metadata
                            : imaState.jo_token_manager_erc721 )
                        : ( imaState.isWithMetadata721
                            ? imaState.jo_token_manager_erc721_with_metadata_target
                            : imaState.jo_token_manager_erc721_target )
                    ;
                    const jo_token_manager_erc1155_src = isForward
                        ? imaState.jo_token_manager_erc1155
                        : imaState.jo_token_manager_erc1155_target;
                    const strChainName_dst = isForward
                        ? imaState.chainProperties.tc.strChainName
                        : imaState.chainProperties.sc.strChainName;
                    const strCoinNameErc20_src = isForward
                        ? imaState.chainProperties.sc.strCoinNameErc20
                        : imaState.chainProperties.tc.strCoinNameErc20;
                    const strCoinNameErc721_src = isForward
                        ? imaState.chainProperties.sc.strCoinNameErc721
                        : imaState.chainProperties.tc.strCoinNameErc721;
                    const strCoinNameErc1155_src = isForward
                        ? imaState.chainProperties.sc.strCoinNameErc1155
                        : imaState.chainProperties.tc.strCoinNameErc1155;
                    const joErc20_src = isForward
                        ? imaState.chainProperties.sc.joErc20
                        : imaState.chainProperties.tc.joErc20;
                    const joErc721_src = isForward
                        ? imaState.chainProperties.sc.joErc721
                        : imaState.chainProperties.tc.joErc721;
                    const joErc1155_src = isForward
                        ? imaState.chainProperties.sc.joErc1155
                        : imaState.chainProperties.tc.joErc1155;
                    let strAddrErc20_explicit = imaState.strAddrErc20_explicit;
                    let strAddrErc20_explicit_target = imaState.strAddrErc20_explicit_target;
                    let strAddrErc721_explicit = imaState.strAddrErc721_explicit;
                    let strAddrErc721_explicit_target = imaState.strAddrErc721_explicit_target;
                    let strAddrErc1155_explicit = imaState.strAddrErc1155_explicit;
                    let strAddrErc1155_explicit_target = imaState.strAddrErc1155_explicit_target;
                    if( ( ! strAddrErc20_explicit ) &&
                        imaState.chainProperties.sc.joErc20 &&
                        imaState.chainProperties.sc.strCoinNameErc20 ) {
                        strAddrErc20_explicit =
                            imaState.chainProperties.sc.joErc20[
                                imaState.chainProperties.sc.strCoinNameErc20 + "_address"];
                    }
                    if( ( ! strAddrErc20_explicit_target ) &&
                        imaState.chainProperties.tc.joErc20 &&
                        imaState.chainProperties.tc.strCoinNameErc20 ) {
                        strAddrErc20_explicit_target =
                            imaState.chainProperties.tc.joErc20[
                                imaState.chainProperties.tc.strCoinNameErc20 + "_address"];
                    }
                    if( ( ! strAddrErc721_explicit ) &&
                        imaState.chainProperties.sc.joErc721 &&
                        imaState.chainProperties.sc.strCoinNameErc721 ) {
                        strAddrErc721_explicit =
                            imaState.chainProperties.sc.joErc721[
                                imaState.chainProperties.sc.strCoinNameErc721 + "_address"];
                    }
                    if( ( ! strAddrErc721_explicit_target ) &&
                        imaState.chainProperties.tc.joErc721 &&
                        imaState.chainProperties.tc.strCoinNameErc721 ) {
                        strAddrErc721_explicit_target =
                            imaState.chainProperties.tc.joErc721[
                                imaState.chainProperties.tc.strCoinNameErc721 + "_address"];
                    }
                    if( ( ! strAddrErc1155_explicit ) &&
                        imaState.chainProperties.sc.joErc1155 &&
                        imaState.chainProperties.sc.strCoinNameErc1155 ) {
                        strAddrErc1155_explicit =
                            imaState.chainProperties.sc.joErc1155[
                                imaState.chainProperties.sc.strCoinNameErc1155 + "_address"];
                    }
                    if( ( ! strAddrErc1155_explicit_target ) &&
                        imaState.chainProperties.tc.joErc1155 &&
                        imaState.chainProperties.tc.strCoinNameErc1155 ) {
                        strAddrErc1155_explicit_target =
                            imaState.chainProperties.tc.joErc1155[
                                imaState.chainProperties.tc.strCoinNameErc1155 + "_address"];
                    }
                    const strAddrErc20_dst = isForward
                        ? strAddrErc20_explicit_target
                        : strAddrErc20_explicit;
                    const strAddrErc721_dst = isForward
                        ? strAddrErc721_explicit_target
                        : strAddrErc721_explicit;
                    const strAddrErc1155_dst = isForward
                        ? strAddrErc1155_explicit_target
                        : strAddrErc1155_explicit;
                    const tc = isForward
                        ? imaState.chainProperties.sc.transactionCustomizer
                        : imaState.chainProperties.tc.transactionCustomizer;
                    if( strCoinNameErc721_src.length > 0 ) {
                        // ERC721 payment
                        log.write(
                            cc.info( "one S->S single ERC721 payment: " ) +
                            cc.sunny( imaState.idToken ) +
                            "\n" ); // just print value
                        return await IMA.do_erc721_payment_s2s(
                            isForward,
                            ethersProvider_src,
                            cid_src,
                            strChainName_dst,
                            joAccountSrc,
                            jo_token_manager_erc721_src,
                            imaState.idToken, // which ERC721 token id to send
                            imaState.nAmountOfWei, // how much to send
                            strCoinNameErc721_src,
                            joErc721_src,
                            strAddrErc721_dst, // only reverse payment needs it
                            tc
                        );
                    }
                    if( strCoinNameErc20_src.length > 0 ) {
                    // ERC20 payment
                        log.write(
                            cc.info( "one S->S single ERC20 payment: " ) +
                            cc.sunny( imaState.nAmountOfToken ) +
                            "\n" ); // just print value
                        return await IMA.do_erc20_payment_s2s(
                            isForward,
                            ethersProvider_src,
                            cid_src,
                            strChainName_dst,
                            joAccountSrc,
                            jo_token_manager_erc20_src,
                            imaState.nAmountOfToken, // how much ERC20 tokens to send
                            imaState.nAmountOfWei, // how much to send
                            strCoinNameErc20_src,
                            joErc20_src,
                            strAddrErc20_dst, // only reverse payment needs it
                            tc
                        );
                    }
                    if(
                        strCoinNameErc1155_src.length > 0 &&
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
                            cc.info( "one S->S single ERC1155 payment: " ) +
                            cc.sunny( imaState.idToken ) + " " +
                            cc.sunny( imaState.nAmountOfToken ) +
                            "\n" ); // just print value
                        return await IMA.do_erc1155_payment_s2s(
                            isForward,
                            ethersProvider_src,
                            cid_src,
                            strChainName_dst,
                            joAccountSrc,
                            jo_token_manager_erc1155_src,
                            imaState.idToken, // which ERC1155 token id to send
                            imaState.nAmountOfToken, // how much ERC1155 tokens to send
                            imaState.nAmountOfWei, // how much to send
                            strCoinNameErc1155_src,
                            joErc1155_src,
                            strAddrErc1155_dst, // only reverse payment needs it
                            tc
                        );
                    }
                    if(
                        strCoinNameErc1155_src.length > 0 &&
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
                            cc.info( "one S->S single ERC1155 Batch payment: " ) +
                            cc.sunny( imaState.idTokens ) + " " +
                            cc.sunny( imaState.arrAmountsOfTokens ) +
                            "\n" ); // just print value
                        return await IMA.do_erc1155_batch_payment_s2s(
                            isForward,
                            ethersProvider_src,
                            cid_src,
                            strChainName_dst,
                            joAccountSrc,
                            jo_token_manager_erc1155_src,
                            imaState.idTokens, // which ERC1155 token id to send
                            imaState.arrAmountsOfTokens, // which ERC1155 token amount to send
                            imaState.nAmountOfWei, // how much to send
                            strCoinNameErc1155_src,
                            joErc1155_src,
                            strAddrErc1155_dst,
                            tc
                        );
                    }
                    // ETH payment
                    log.write(
                        cc.info( "one S->S single ETH payment: " ) +
                        cc.sunny( imaState.nAmountOfWei ) +
                        "\n" ); // just print value
                    console.log( cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " S->S ETH payment(s) are neither supported nor allowed" )
                    );
                    process.exit( 154 );
                }
            } );
        },
        "s2m-receive": function() {
            imaState.arrActions.push( {
                "name": "receive one S->M single ETH payment",
                "fn": async function() {
                    log.write(
                        cc.info( "receive one S->M single ETH payment: " ) +
                        "\n" ); // just print value
                    return await IMA.receive_eth_payment_from_s_chain_on_main_net(
                        imaState.chainProperties.mn.ethersProvider,
                        imaState.chainProperties.mn.cid,
                        imaState.chainProperties.mn.joAccount,
                        imaState.jo_deposit_box_eth,
                        imaState.chainProperties.mn.transactionCustomizer
                    );
                }
            } );
        },
        "s2m-view": function() {
            imaState.arrActions.push( {
                "name": "view one S->M single ETH payment",
                "fn": async function() {
                    log.write(
                        cc.info( "view one S->M single ETH payment: " ) +
                        "\n" ); // just print value
                    const xWei = await IMA.view_eth_payment_from_s_chain_on_main_net(
                        imaState.chainProperties.mn.ethersProvider,
                        imaState.chainProperties.mn.joAccount,
                        imaState.jo_deposit_box_eth
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
        },
        "m2s-transfer": function() {
            imaState.arrActions.push( {
                "name": "single M->S transfer loop",
                "fn": async function() {
                    if( ! imaState.bNoWaitSChainStarted )
                        await wait_until_s_chain_started(); // main-net --> s-chain transfer
                    const joRuntimeOpts = {
                        isInsideWorker: false,
                        idxChainKnownForS2S: 0,
                        cntChainsKnownForS2S: 0
                    };
                    return await IMA.do_transfer( // main-net --> s-chain
                        "M2S",
                        joRuntimeOpts,
                        imaState.chainProperties.mn.ethersProvider,
                        imaState.jo_message_proxy_main_net,
                        imaState.chainProperties.mn.joAccount,
                        imaState.chainProperties.sc.ethersProvider,
                        imaState.jo_message_proxy_s_chain,
                        imaState.chainProperties.sc.joAccount,
                        imaState.chainProperties.mn.strChainName,
                        imaState.chainProperties.sc.strChainName,
                        imaState.chainProperties.mn.cid,
                        imaState.chainProperties.sc.cid,
                        null,
                        imaState.jo_token_manager_eth, // for logs validation on s-chain
                        imaState.nTransferBlockSizeM2S,
                        imaState.nTransferStepsM2S,
                        imaState.nMaxTransactionsM2S,
                        imaState.nBlockAwaitDepthM2S,
                        imaState.nBlockAgeM2S,
                        imaBLS.do_sign_messages_m2s,
                        null,
                        imaState.chainProperties.sc.transactionCustomizer
                    );
                }
            } );
        },
        "s2m-transfer": function() {
            imaState.arrActions.push( {
                "name": "single S->M transfer loop",
                "fn": async function() {
                    if( ! imaState.bNoWaitSChainStarted )
                        await wait_until_s_chain_started(); // s-chain --> main-net transfer
                    const joRuntimeOpts = {
                        isInsideWorker: false,
                        idxChainKnownForS2S: 0,
                        cntChainsKnownForS2S: 0
                    };
                    return await IMA.do_transfer( // s-chain --> main-net
                        "S2M",
                        joRuntimeOpts,
                        imaState.chainProperties.sc.ethersProvider,
                        imaState.jo_message_proxy_s_chain,
                        imaState.chainProperties.sc.joAccount,
                        imaState.chainProperties.mn.ethersProvider,
                        imaState.jo_message_proxy_main_net,
                        imaState.chainProperties.mn.joAccount,
                        imaState.chainProperties.sc.strChainName,
                        imaState.chainProperties.mn.strChainName,
                        imaState.chainProperties.sc.cid,
                        imaState.chainProperties.mn.cid,
                        imaState.jo_deposit_box_eth, // for logs validation on mainnet
                        null,
                        imaState.nTransferBlockSizeS2M,
                        imaState.nTransferStepsS2M,
                        imaState.nMaxTransactionsS2M,
                        imaState.nBlockAwaitDepthS2M,
                        imaState.nBlockAgeS2M,
                        imaBLS.do_sign_messages_s2m,
                        null,
                        imaState.chainProperties.mn.transactionCustomizer
                    );
                }
            } );
        },
        "s2s-transfer": function() {
            imaState.arrActions.push( {
                "name": "single S->S transfer loop",
                "fn": async function() {
                    if( ! imaState.s2s_opts.isEnabled )
                        return;
                    initial_skale_network_scan_for_S2S();
                    if( ! imaState.bNoWaitSChainStarted )
                        await wait_until_s_chain_started(); // s-chain --> main-net transfer
                    const joRuntimeOpts = {
                        isInsideWorker: false,
                        idxChainKnownForS2S: 0,
                        cntChainsKnownForS2S: 0
                    };
                    return await IMA.do_s2s_all( // s-chain --> s-chain
                        joRuntimeOpts,
                        imaState,
                        skale_observer,
                        imaState.chainProperties.sc.ethersProvider,
                        imaState.jo_message_proxy_s_chain,
                        imaState.chainProperties.sc.joAccount,
                        imaState.chainProperties.sc.strChainName,
                        imaState.chainProperties.sc.cid,
                        imaState.jo_token_manager_eth, // for logs validation on s-chain
                        imaState.nTransferBlockSizeM2S,
                        imaState.nTransferStepsS2S,
                        imaState.nMaxTransactionsM2S,
                        imaState.nBlockAwaitDepthM2S,
                        imaState.nBlockAgeM2S,
                        imaBLS.do_sign_messages_m2s,
                        imaState.chainProperties.sc.transactionCustomizer
                    );
                }
            } );
        },
        "transfer": function() {
            initial_skale_network_scan_for_S2S();
            imaState.arrActions.push( {
                "name": "Single M<->S transfer loop iteration",
                "fn": async function() {
                    initial_skale_network_scan_for_S2S();
                    if( ! imaState.bNoWaitSChainStarted )
                        await wait_until_s_chain_started();
                    const joRuntimeOpts = {
                        isInsideWorker: false,
                        idxChainKnownForS2S: 0,
                        cntChainsKnownForS2S: 0
                    };
                    const loop_opts = {
                        joRuntimeOpts: joRuntimeOpts,
                        isDelayFirstRun: false,
                        enable_step_oracle: true,
                        enable_step_m2s: true,
                        enable_step_s2m: true,
                        enable_step_s2s: true
                    };
                    return await single_transfer_loop( loop_opts );
                }
            } );
        },
        "loop": function() {
            initial_skale_network_scan_for_S2S();
            imaState.arrActions.push( {
                "name": "M<->S and S->S transfer loop, startup in parallel mode",
                "fn": async function() {
                    state.setPreventExitAfterLastAction( true );
                    if( ! imaState.bNoWaitSChainStarted )
                        await wait_until_s_chain_started(); // M<->S transfer loop
                    let isPrintSummaryRegistrationCosts = false;
                    if( !await check_registration_step1() ) {
                        if( !await register_step1( false ) )
                            return false;
                        isPrintSummaryRegistrationCosts = true;
                    }
                    if( isPrintSummaryRegistrationCosts )
                        print_summary_registration_costs();
                    const opts = {
                        imaState: imaState,
                        "details": log
                    };
                    return await loop.run_parallel_loops(
                        opts
                    );
                }
            } );
        },
        "simple-loop": function() {
            initial_skale_network_scan_for_S2S();
            imaState.arrActions.push( {
                "name": "M<->S and S->S transfer loop, simple mode",
                "fn": async function() {
                    state.setPreventExitAfterLastAction( true );
                    if( ! imaState.bNoWaitSChainStarted )
                        await wait_until_s_chain_started(); // M<->S transfer loop
                    let isPrintSummaryRegistrationCosts = false;
                    if( !await check_registration_step1() ) {
                        if( !await register_step1( false ) )
                            return false;
                        isPrintSummaryRegistrationCosts = true;
                    }
                    if( isPrintSummaryRegistrationCosts )
                        print_summary_registration_costs();
                    const joRuntimeOpts = {
                        isInsideWorker: false,
                        idxChainKnownForS2S: 0,
                        cntChainsKnownForS2S: 0
                    };
                    const loop_opts = {
                        joRuntimeOpts: joRuntimeOpts,
                        isDelayFirstRun: false,
                        enable_step_oracle: true,
                        enable_step_m2s: true,
                        enable_step_s2m: true,
                        enable_step_s2s: true
                    };
                    return await loop.run_transfer_loop( loop_opts );
                }
            } );
        },
        "browse-s-chain": function() {
            imaState.bIsNeededCommonInit = false;
            imaState.arrActions.push( {
                "name": "Brows S-Chain network",
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
                    //
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
                                    const strError = owaspUtils.extract_error_message( err );
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
                                    const strNodeURL = imaUtils.compose_schain_node_url( joNode );
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
                                                        owaspUtils.extract_error_message( err );
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
        },
        "browse-skale-network": function() {
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
                    const arr_schains = await skale_observer.load_schains( addressFrom, opts );
                    const cnt = arr_schains.length;
                    log.write( strLogPrefix +
                        cc.normal( "Got " ) + cc.info( cnt ) +
                        cc.normal( " S-Chains(s) in SKALE NETWORK information: " ) +
                        cc.j( arr_schains ) +
                        "\n" );
                    return true;
                }
            } );
        },
        "browse-connected-schains": function() {
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
                    const arr_schains_cached = await skale_observer.load_schains_connected_only(
                        imaState.chainProperties.sc.strChainName,
                        addressFrom,
                        opts
                    );

                    const cnt = arr_schains_cached.length;
                    log.write( strLogPrefix +
                        cc.normal( "Got " ) + cc.info( cnt ) +
                        cc.normal( " connected S-Chain(s): " ) + cc.j( arr_schains_cached ) +
                        "\n" );
                    return true;
                }
            } );
        },
        "discover-cid": function() {
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
                            "fnSave": function( chainID ) {
                                imaState.chainProperties.mn.cid = chainID;
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
                            "fnSave": function( chainID ) {
                                imaState.chainProperties.sc.cid = chainID;
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
                            "fnSave": function( chainID ) {
                                imaState.chainProperties.tc.cid = chainID;
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
                        const chainID = await
                        skale_observer.discover_chain_id( joDiscoverEntry.strURL );
                        if( chainID === null ) {
                            log.write( strLogPrefix +
                            cc.error( "Failed to detect " ) +
                            cc.note( joDiscoverEntry.name ) + " " +
                            cc.attention( "chain ID" ) +
                            "\n" );
                        } else {
                            const cid16 =
                                owaspUtils.ensure_starts_with_0x(
                                    owaspUtils.toBN( chainID ).toHexString()
                                );
                            const cid10 = "" + owaspUtils.toBN( chainID ).toString();
                            log.write( strLogPrefix +
                            cc.normal( "Got " ) + cc.note( joDiscoverEntry.name ) + " " +
                            cc.attention( "chain ID" ) + cc.normal( "=" ) +
                            cc.note( cid16 ) + cc.normal( "=" ) +
                            cc.note( cid10 ) + cc.normal( " from URL " ) +
                            cc.u( joDiscoverEntry.strURL ) +
                            "\n" );
                            joDiscoverEntry.fnSave( chainID );
                        }
                    }
                    return true;
                }
            } );
        }
    } );

    let haveReimbursementCommands = false;
    if( imaState.isShowReimbursementBalance ) {
        haveReimbursementCommands = true;
        imaState.arrActions.push( {
            "name": "Gas Reimbursement - Show Balance",
            "fn": async function() {
                await IMA.reimbursement_show_balance(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.jo_community_pool,
                    imaState.chainProperties.mn.joAccount.address(),
                    imaState.chainProperties.mn.strChainName,
                    imaState.chainProperties.mn.cid,
                    imaState.chainProperties.mn.transactionCustomizer,
                    imaState.strReimbursementChain,
                    true
                );
                return true;
            }
        } );
    }
    if( imaState.nReimbursementEstimate ) {
        haveReimbursementCommands = true;
        imaState.arrActions.push( {
            "name": "Gas Reimbursement - Estimate Amount",
            "fn": async function() {
                await IMA.reimbursement_estimate_amount(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.jo_community_pool,
                    imaState.chainProperties.mn.joAccount.address(),
                    imaState.chainProperties.mn.strChainName,
                    imaState.chainProperties.mn.cid,
                    imaState.chainProperties.mn.transactionCustomizer,
                    imaState.strReimbursementChain,
                    true
                );
                return true;
            }
        } );
    }
    if( imaState.nReimbursementRecharge ) {
        haveReimbursementCommands = true;
        imaState.arrActions.push( {
            "name": "Gas Reimbursement - Recharge User Wallet",
            "fn": async function() {
                await IMA.reimbursement_wallet_recharge(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.jo_community_pool,
                    imaState.chainProperties.mn.joAccount,
                    imaState.chainProperties.mn.strChainName,
                    imaState.chainProperties.mn.cid,
                    imaState.chainProperties.mn.transactionCustomizer,
                    imaState.strReimbursementChain,
                    imaState.nReimbursementRecharge
                );
                return true;
            }
        } );
    }
    if( imaState.nReimbursementWithdraw ) {
        haveReimbursementCommands = true;
        imaState.arrActions.push( {
            "name": "Gas Reimbursement - Withdraw User Wallet",
            "fn": async function() {
                await IMA.reimbursement_wallet_withdraw(
                    imaState.chainProperties.mn.ethersProvider,
                    imaState.jo_community_pool,
                    imaState.chainProperties.mn.joAccount,
                    imaState.chainProperties.mn.strChainName,
                    imaState.chainProperties.mn.cid,
                    imaState.chainProperties.mn.transactionCustomizer,
                    imaState.strReimbursementChain,
                    imaState.nReimbursementWithdraw
                );
                return true;
            }
        } );
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
    if( imaState.nReimbursementRange >= 0 ) {
        imaState.arrActions.push( {
            "name": "Gas Reimbursement - Set Minimal time interval from S2M and S2S transfers",
            "fn": async function() {
                await IMA.reimbursement_set_range(
                    imaState.chainProperties.sc.ethersProvider,
                    imaState.jo_community_locker,
                    imaState.chainProperties.sc.joAccount,
                    imaState.chainProperties.sc.strChainName,
                    imaState.chainProperties.sc.cid,
                    imaState.chainProperties.sc.transactionCustomizer,
                    imaState.strChainName_origin_chain,
                    imaState.nReimbursementRange
                );
                return true;
            }
        } );
    }

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
        imaCLI.ima_common_init();
        imaCLI.ima_contracts_init();
    }

    if( imaState.bShowConfigMode ) {
        // just show configuration values and exit
        process.exit( 0 );
    }

}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

function get_s_chain_nodes_count( joSChainNetworkInfo ) {
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

function get_s_chain_discovered_nodes_count( joSChainNetworkInfo ) {
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

let g_timer_s_chain_discovery = null;
let g_b_in_s_chain_discovery = false;

async function continue_schain_discovery_in_background_if_needed( isSilent ) {
    const imaState = state.get();
    const cntNodes = get_s_chain_nodes_count( imaState.joSChainNetworkInfo );
    const cntDiscovered = get_s_chain_discovered_nodes_count( imaState.joSChainNetworkInfo );
    if( cntDiscovered >= cntNodes ) {
        if( g_timer_s_chain_discovery != null ) {
            clearInterval( g_timer_s_chain_discovery );
            g_timer_s_chain_discovery = null;
        }
        return;
    }
    if( g_timer_s_chain_discovery != null )
        return;
    if( imaState.joSChainDiscovery.repeatIntervalMilliseconds <= 0 )
        return; // no S-Chain re-discovery (for debugging only)
    const fn_async_handler = async function() {
        if( g_b_in_s_chain_discovery )
            return;
        if( g_b_in_s_chain_discovery ) {
            isInsideAsyncHandler = false;
            if( IMA.verbose_get() >= IMA.RV_VERBOSE().information )
                log.write( cc.warning( "Notice: long S-Chain discovery is in progress" ) + "\n" );
            return;
        }
        g_b_in_s_chain_discovery = true;
        try {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE().information ) {
                log.write(
                    cc.info( "Will re-discover " ) + cc.notice( cntNodes ) +
                    cc.info( "-node S-Chain network, " ) + cc.notice( cntDiscovered ) +
                    cc.info( " node(s) already discovered..." ) +
                    "\n" );
            }
            await discover_s_chain_network( function( err, joSChainNetworkInfo ) {
                if( ! err ) {
                    const cntDiscoveredNew =
                        get_s_chain_discovered_nodes_count( joSChainNetworkInfo );
                    if( IMA.verbose_get() >= IMA.RV_VERBOSE().information ) {
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
                                                imaUtils.compose_schain_node_url( joNode );
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
                continue_schain_discovery_in_background_if_needed( isSilent );
            }, isSilent, imaState.joSChainNetworkInfo, cntNodes ).catch( ( err ) => {
                const strError = owaspUtils.extract_error_message( err );
                log.write(
                    cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " S-Chain network re-discovery failed: " ) +
                    cc.warning( strError ) + "\n"
                );
            } );
        } catch ( err ) { }
        g_b_in_s_chain_discovery = false;
    };
    g_timer_s_chain_discovery = setInterval( function() {
        if( g_b_in_s_chain_discovery )
            return;
        fn_async_handler();
    }, imaState.joSChainDiscovery.repeatIntervalMilliseconds );
}

async function discover_s_chain_network(
    fnAfter, isSilent, joPrevSChainNetworkInfo, nCountToWait
) {
    const imaState = state.get();
    isSilent = isSilent || false;
    joPrevSChainNetworkInfo = joPrevSChainNetworkInfo || null;
    if( nCountToWait == null || nCountToWait == undefined || nCountToWait < 0 )
        nCountToWait = 0;
    const strLogPrefix = cc.info( "S-Chain network discovery:" ) + " ";
    fnAfter = fnAfter || function() {};
    let joSChainNetworkInfo = null;
    const rpcCallOpts = null;
    try {
        await rpcCall.create(
            imaState.chainProperties.sc.strURL,
            rpcCallOpts,
            async function( joCall, err ) {
                if( err ) {
                    const strError = owaspUtils.extract_error_message( err );
                    if( ! isSilent ) {
                        log.write(
                            strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to (own) S-Chain " ) +
                        cc.u( imaState.chainProperties.sc.strURL ) +
                        cc.error( " failed: " ) +
                        cc.warning( strError ) + "\n"
                        );
                    }
                    fnAfter( err, null );
                    if( joCall )
                        await joCall.disconnect();
                    return;
                }
                await joCall.call( {
                    "method": "skale_nodesRpcInfo",
                    "params": {
                        "fromImaAgentIndex": imaState.nNodeNumber
                    }
                }, async function( joIn, joOut, err ) {
                    if( err ) {
                        const strError = owaspUtils.extract_error_message( err );
                        if( ! isSilent ) {
                            log.write(
                                strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " JSON RPC call to (own) S-Chain " ) +
                            cc.u( imaState.chainProperties.sc.strURL ) +
                            cc.error( " failed, error: " ) +
                            cc.warning( strError ) + "\n"
                            );
                        }
                        fnAfter( err, null );
                        await joCall.disconnect();
                        return;
                    }
                    if( ( !isSilent ) && IMA.verbose_get() >= IMA.RV_VERBOSE().trace ) {
                        log.write( strLogPrefix +
                        cc.debug( "OK, got (own) S-Chain network information: " ) +
                        cc.j( joOut.result ) +
                        "\n" );
                    } else if(
                        ( !isSilent ) &&
                        IMA.verbose_get() >= IMA.RV_VERBOSE().information ) {
                        log.write( strLogPrefix +
                        cc.success( "OK, got S-Chain " ) +
                        cc.u( imaState.chainProperties.sc.strURL ) +
                        cc.success( " network information." ) +
                        "\n" );
                    }
                    //
                    let nCountReceivedImaDescriptions = 0;
                    joSChainNetworkInfo = joOut.result;
                    if( ! joSChainNetworkInfo ) {
                        const err2 = new Error(
                            "Got wrong response, network information description was not detected"
                        );
                        if( ! isSilent ) {
                            log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " Network was not detected via call to " ) +
                        cc.u( imaState.chainProperties.sc.strURL ) + cc.error( ": " ) +
                        cc.warning( err2 ) + "\n"
                            );
                        }
                        fnAfter( err2, null );
                        await joCall.disconnect();
                        return;
                    }
                    const jarrNodes = joSChainNetworkInfo.network;
                    const cntNodes = jarrNodes.length;
                    if( nCountToWait <= 0 ) {
                        nCountToWait = 0 + cntNodes;
                        if( nCountToWait > 2 )
                            nCountToWait = Math.ceil( nCountToWait * 2 / 3 );
                    } else if( nCountToWait > cntNodes )
                        nCountToWait = cntNodes;
                    if( ! isSilent ) {
                        log.write( strLogPrefix +
                        cc.debug( "Will gather details of " ) + cc.info( nCountToWait ) +
                        cc.debug( " of " ) + cc.info( cntNodes ) + cc.debug( " node(s)..." ) +
                        "\n"
                        );
                    }
                    let cntFailed = 0;
                    for( let i = 0; i < cntNodes; ++ i ) {
                        const nCurrentNodeIdx = 0 + i;
                        const joNode = jarrNodes[nCurrentNodeIdx];
                        const strNodeURL = imaUtils.compose_schain_node_url( joNode );
                        const strNodeDescColorized =
                        cc.notice( "#" ) + cc.info( nCurrentNodeIdx ) +
                        cc.attention( "(" ) + cc.u( strNodeURL ) + cc.attention( ")" );
                        try {
                            if( joPrevSChainNetworkInfo &&
                            "network" in joPrevSChainNetworkInfo &&
                            joPrevSChainNetworkInfo.network
                            ) {
                                const joPrevNode = joPrevSChainNetworkInfo.network[nCurrentNodeIdx];
                                if( joPrevNode &&
                                "imaInfo" in joPrevNode &&
                                typeof joPrevNode.imaInfo === "object" &&
                                "t" in joPrevNode.imaInfo &&
                                typeof joPrevNode.imaInfo.t === "number"
                                ) {
                                    joNode.imaInfo =
                                    JSON.parse( JSON.stringify( joPrevNode.imaInfo ) );
                                    if( ( !isSilent ) &&
                                    IMA.verbose_get() >= IMA.RV_VERBOSE().information
                                    ) {
                                        log.write(
                                            strLogPrefix + cc.info( "OK, in case of " ) +
                                        strNodeDescColorized +
                                        cc.info( " node " ) + cc.info( joNode.nodeID ) +
                                        cc.info( " will use previous discovery result." ) +
                                        "\n"
                                        );
                                    }
                                    continue; // skip this node discovery, enrich rest of nodes
                                }
                            }
                        } catch ( err ) {
                        }
                        const rpcCallOpts = null;
                        try {
                            await rpcCall.create(
                                strNodeURL,
                                rpcCallOpts,
                                async function( joCall, err ) {
                                    if( err ) {
                                        if( ! isSilent ) {
                                            log.write(
                                                strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                        cc.error( " JSON RPC call to S-Chain node " ) +
                                        strNodeDescColorized + cc.error( " failed" ) +
                                        "\n"
                                            );
                                        }
                                        ++ cntFailed;
                                        if( joCall )
                                            await joCall.disconnect();
                                        return;
                                    }
                                    joCall.call( {
                                        "method": "skale_imaInfo",
                                        "params": {
                                            "fromImaAgentIndex": imaState.nNodeNumber
                                        }
                                    }, function( joIn, joOut, err ) {
                                        ++ nCountReceivedImaDescriptions;
                                        if( err ) {
                                            const strError =
                                                owaspUtils.extract_error_message( err );
                                            if( ! isSilent ) {
                                                log.write(
                                                    strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                            cc.error( " JSON RPC call to S-Chain node " ) +
                                            strNodeDescColorized + cc.error( " failed, error: " ) +
                                            cc.warning( strError ) + "\n"
                                                );
                                            }
                                            ++ cntFailed;
                                            return;
                                        }
                                        joNode.imaInfo = joOut.result;
                                        if( ( !isSilent ) &&
                                    IMA.verbose_get() >= IMA.RV_VERBOSE().information
                                        ) {
                                            log.write(
                                                strLogPrefix + cc.success( "OK, got " ) +
                                        strNodeDescColorized +
                                        cc.success( " node " ) + cc.info( joNode.nodeID ) +
                                        cc.success( " IMA information(" ) +
                                        cc.info( nCountReceivedImaDescriptions ) +
                                        cc.success( " of " ) +
                                        cc.info( cntNodes ) + cc.success( ")." ) + "\n"
                                            );
                                        }
                                    } );
                                } );
                        } catch ( err ) {
                            const strError = owaspUtils.extract_error_message( err );
                            if( ! isSilent ) {
                                log.write(
                                    strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                cc.error( " JSON RPC call to S-Chain node " ) +
                                strNodeDescColorized +
                                cc.error( " was not created: " ) + cc.warning( strError ) +
                                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                                "\n"
                                );
                            }
                            ++ cntFailed;
                        }
                    }
                    let nCountAvailable = cntNodes - cntFailed;
                    if( ! isSilent ) {
                        log.write(
                            cc.debug( "Waiting for S-Chain nodes, total " ) +
                            cc.warning( cntNodes ) +
                        cc.debug( ", available " ) + cc.warning( nCountAvailable ) +
                        cc.debug( ", expected at least " ) + cc.warning( nCountToWait ) +
                        "\n"
                        );
                    }
                    if( nCountAvailable < nCountToWait ) {
                        if( ! isSilent ) {
                            log.write(
                                strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " Not enough nodes available on S-Chain, total " ) +
                            cc.warning( cntNodes ) +
                            cc.error( ", available " ) + cc.warning( nCountAvailable ) +
                            cc.error( ", expected at least " ) + cc.warning( nCountToWait ) +
                            "\n"
                            );
                        }
                        const err = new Error(
                            "Not enough nodes available on S-Chain, total " + cntNodes +
                        ", available " + nCountAvailable + ", expected at least " + nCountToWait
                        );
                        fnAfter( err, null );
                        return;
                    }
                    if( ( !isSilent ) && IMA.verbose_get() >= IMA.RV_VERBOSE().information ) {
                        log.write(
                            strLogPrefix + cc.debug( "Waiting for response from at least " ) +
                        cc.info( nCountToWait ) +
                        cc.debug( " node(s)..." ) + "\n"
                        );
                    }
                    let nWaitAttempt = 0;
                    const nWaitStepMilliseconds = 1000;
                    let cntWaitAttempts = Math.floor(
                        imaState.joSChainDiscovery.repeatIntervalMilliseconds /
                        nWaitStepMilliseconds ) -
                    3;
                    if( cntWaitAttempts < 1 )
                        cntWaitAttempts = 1;
                    const iv = setInterval( function() {
                        nCountAvailable = cntNodes - cntFailed;
                        if( ! isSilent ) {
                            log.write(
                                cc.debug( "Waiting attempt " ) +
                            cc.info( nWaitAttempt ) + cc.debug( " of " ) +
                            cc.info( cntWaitAttempts ) +
                            cc.debug( " for S-Chain nodes, total " ) + cc.info( cntNodes ) +
                            cc.debug( ", available " ) + cc.info( nCountAvailable ) +
                            cc.debug( ", expected at least " ) + cc.info( nCountToWait ) +
                            "\n"
                            );
                        }
                        if( ( !isSilent ) && IMA.verbose_get() >= IMA.RV_VERBOSE().information ) {
                            log.write( strLogPrefix +
                            cc.debug( "Have S-Chain description response about " ) +
                            cc.info( nCountReceivedImaDescriptions ) + cc.debug( " node(s)." ) +
                            "\n"
                            );
                        }
                        if( nCountReceivedImaDescriptions >= nCountToWait ) {
                            clearInterval( iv );
                            fnAfter( null, joSChainNetworkInfo );
                            return;
                        }
                        ++ nWaitAttempt;
                        if( nWaitAttempt >= cntWaitAttempts ) {
                            clearInterval( iv );
                            const strErrorDescription =
                            "S-Chain network discovery wait timeout, " +
                            "network will be re-discovered";
                            if( ! isSilent ) {
                                log.write( strLogPrefix + cc.warning( "WARNING:" ) + " " +
                            cc.warning( strErrorDescription ) + "\n" );
                            }
                            if( get_s_chain_discovered_nodes_count( joSChainNetworkInfo ) > 0 )
                                fnAfter( null, joSChainNetworkInfo );
                            else
                                fnAfter( new Error( strErrorDescription ), null );
                            return;
                        }
                        if( ! isSilent ) {
                            log.write(
                                strLogPrefix + cc.debug( " Waiting attempt " ) +
                            cc.info( nWaitAttempt ) + cc.debug( " of " ) +
                            cc.info( cntWaitAttempts ) +
                            cc.debug( " for " ) +
                            cc.notice( nCountToWait - nCountReceivedImaDescriptions ) +
                            cc.debug( " node answer(s)" ) +
                            "\n"
                            );
                        }
                    }, nWaitStepMilliseconds );
                    await joCall.disconnect();
                } );
            } );
    } catch ( err ) {
        const strError = owaspUtils.extract_error_message( err );
        if( ! isSilent ) {
            log.write(
                strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " JSON RPC call to S-Chain was not created: " ) +
                cc.warning( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n"
            );
        }
        joSChainNetworkInfo = null;
        fnAfter( err, null );
    }
    return joSChainNetworkInfo;
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

let g_ws_server_monitoring = null;

function init_monitoring_server() {
    const imaState = state.get();
    if( imaState.nMonitoringPort <= 0 )
        return;
    const strLogPrefix = cc.attention( "Monitoring:" ) + " ";
    if( IMA.verbose_get() >= IMA.RV_VERBOSE().trace ) {
        log.write( strLogPrefix +
            cc.normal( "Will start monitoring WS server on port " ) +
            cc.info( imaState.nMonitoringPort ) +
            "\n" );
    }
    g_ws_server_monitoring = new ws.WebSocketServer( { port: 0 + imaState.nMonitoringPort } );
    g_ws_server_monitoring.on( "connection", function( ws_peer, req ) {
        const ip = req.socket.remoteAddress;
        if( IMA.verbose_get() >= IMA.RV_VERBOSE().trace )
            log.write( strLogPrefix + cc.normal( "New connection from " ) + cc.info( ip ) + "\n" );
        ws_peer.on( "message", function( message ) {
            const joAnswer = {
                "method": null,
                "id": null,
                "error": null
            };
            try {
                const joMessage = JSON.parse( message );
                if( IMA.verbose_get() >= IMA.RV_VERBOSE().trace ) {
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
                    joAnswer.last_transfer_errors = IMA.get_last_transfer_errors(
                        ( ( "isIncludeTextLog" in joMessage ) && joMessage.isIncludeTextLog )
                            ? true : false );
                    joAnswer.last_error_categories = IMA.get_last_error_categories();
                    break;
                default:
                    throw new Error(
                        "Unknown method name \"" + joMessage.method + "\" was specified" );
                } // switch( joMessage.method )
            } catch ( err ) {
                const strError = owaspUtils.extract_error_message( err );
                if( IMA.verbose_get() >= IMA.RV_VERBOSE().error ) {
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
                if( IMA.verbose_get() >= IMA.RV_VERBOSE().trace ) {
                    log.write( strLogPrefix + cc.sunny( ">>>" ) + " " + cc.normal( "answer to " ) +
                    cc.info( ip ) + cc.normal( ": " ) + cc.j( joAnswer ) +
                    "\n" );
                }
                ws_peer.send( JSON.stringify( joAnswer ) );
            } catch ( err ) {
                const strError = owaspUtils.extract_error_message( err );
                if( IMA.verbose_get() >= IMA.RV_VERBOSE().error ) {
                    log.write( strLogPrefix +
                        cc.error( "Failed to sent answer to " ) + cc.info( ip ) +
                        cc.error( ", error is: " ) + cc.warning( strError ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                        "\n"
                    );
                }
            }
        } );
        // ws_peer.send( "something" );
    } );
} // if( imaState.nMonitoringPort > 0 )

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

// let g_ws_server_ima = null;
let g_json_rpc_app_ima = null;

function init_json_rpc_server() {
    const imaState = state.get();
    if( imaState.nJsonRpcPort <= 0 )
        return;
    const strLogPrefix = cc.attention( "JSON RPC:" ) + " ";
    g_json_rpc_app_ima = express();
    g_json_rpc_app_ima.use( bodyParser.urlencoded( { extended: true } ) );
    g_json_rpc_app_ima.use( bodyParser.json() );
    g_json_rpc_app_ima.post( "/", async function( req, res ) {
        const isSkipMode = false;
        const message = JSON.stringify( req.body );
        const ip = req.connection.remoteAddress.split( ":" ).pop();
        const fn_send_answer = function( joAnswer ) {
            try {
                res.header( "Content-Type", "application/json" );
                res.status( 200 ).send( JSON.stringify( joAnswer ) );
                if( IMA.verbose_get() >= IMA.RV_VERBOSE().trace ) {
                    log.write( strLogPrefix +
                        cc.sunny( ">>>" ) + " " + cc.normal( "did sent answer to " ) +
                        cc.info( ip ) + cc.normal( ": " ) + cc.j( joAnswer ) +
                        "\n" );
                }
            } catch ( err ) {
                const strError = owaspUtils.extract_error_message( err );
                if( IMA.verbose_get() >= IMA.RV_VERBOSE().error ) {
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
            if( IMA.verbose_get() >= IMA.RV_VERBOSE().trace ) {
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
                fn_send_answer( joAnswer );
                break;
            case "ping":
                joAnswer.result = "pong";
                fn_send_answer( joAnswer );
                break;
            case "skale_imaVerifyAndSign":
                joAnswer = await imaBLS.handle_skale_imaVerifyAndSign( joMessage );
                break;
            case "skale_imaBSU256":
                joAnswer = await imaBLS.handle_skale_imaBSU256( joMessage );
                break;
            case "skale_imaNotifyLoopWork":
                if( await pwa.handle_loop_state_arrived(
                    imaState,
                    owaspUtils.toInteger( joMessage.params.nNodeNumber ),
                    joMessage.params.strLoopWorkType,
                    joMessage.params.nIndexS2S,
                    joMessage.params.isStart ? true : false,
                    owaspUtils.toInteger( joMessage.params.ts ),
                    joMessage.params.signature
                ) )
                    await loop.spread_arrived_pwa_state( joMessage );

                break;
            default:
                throw new Error( "Unknown method name \"" + joMessage.method + "\" was specified" );
            } // switch( joMessage.method )
        } catch ( err ) {
            const strError = owaspUtils.extract_error_message( err );
            if( IMA.verbose_get() >= IMA.RV_VERBOSE().error ) {
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
            fn_send_answer( joAnswer );
    } );
    g_json_rpc_app_ima.listen( imaState.nJsonRpcPort );
} // if( imaState.nJsonRpcPort > 0 )

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

async function do_the_job() {
    const imaState = state.get();
    const strLogPrefix = cc.info( "Job 1:" ) + " ";
    let idxAction = 0;
    const cntActions = imaState.arrActions.length;
    let cntFalse = 0;
    let cntTrue = 0;
    for( idxAction = 0; idxAction < cntActions; ++idxAction ) {
        if( IMA.verbose_get() >= IMA.RV_VERBOSE().information )
            log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );

        const joAction = imaState.arrActions[idxAction];
        if( IMA.verbose_get() >= IMA.RV_VERBOSE().debug ) {
            log.write( strLogPrefix +
                cc.notice( "Will execute action:" ) + " " + cc.info( joAction.name ) +
                cc.debug( " (" ) + cc.info( idxAction + 1 ) + cc.debug( " of " ) +
                cc.info( cntActions ) + cc.debug( ")" ) +
                "\n" );
        }

        try {
            if( await joAction.fn() ) {
                ++cntTrue;
                if( IMA.verbose_get() >= IMA.RV_VERBOSE().information ) {
                    log.write( strLogPrefix +
                        cc.success( "Succeeded action:" ) + " " + cc.info( joAction.name ) +
                        "\n" );
                }
            } else {
                ++cntFalse;
                if( IMA.verbose_get() >= IMA.RV_VERBOSE().error ) {
                    log.write( strLogPrefix +
                        cc.warning( "Failed action:" ) + " " + cc.info( joAction.name ) +
                        "\n" );
                }
            }
        } catch ( err ) {
            ++cntFalse;
            if( IMA.verbose_get() >= IMA.RV_VERBOSE().fatal ) {
                log.write( strLogPrefix +
                    cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Exception occurred while executing action: " ) +
                    cc.error( owaspUtils.extract_error_message( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                    "\n" );
            }
        }
    } // for( idxAction = 0; idxAction < cntActions; ++ idxAction )
    if( IMA.verbose_get() >= IMA.RV_VERBOSE().information ) {
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

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

const g_registrationCostInfo = {
    mn: [],
    sc: []
};

async function register_step1( isPrintSummaryRegistrationCosts ) {
    const imaState = state.get();
    imaCLI.ima_contracts_init();
    const strLogPrefix = cc.info( "Reg 1:" ) + " ";
    log.write( strLogPrefix + cc.debug( "Will check chain registration now..." ) + "\n" );
    let bSuccess = await IMA.check_is_registered_s_chain_in_deposit_boxes( // step 1
        imaState.chainProperties.mn.ethersProvider,
        imaState.jo_linker,
        imaState.chainProperties.mn.joAccount,
        imaState.chainProperties.sc.strChainName
    );
    log.write( strLogPrefix +
        cc.debug( "Chain is " ) +
        ( bSuccess ? cc.success( "already registered" ) : cc.warning( "not registered yet" ) ) +
        "\n" );
    if( bSuccess )
        return true;
    const jarrReceipts =
        await IMA.register_s_chain_in_deposit_boxes( // step 1
            imaState.chainProperties.mn.ethersProvider,
            imaState.jo_linker,
            imaState.chainProperties.mn.joAccount,
            imaState.jo_token_manager_eth, // only s-chain
            imaState.jo_token_manager_erc20, // only s-chain
            imaState.jo_token_manager_erc721, // only s-chain
            imaState.jo_token_manager_erc1155, // only s-chain
            imaState.jo_token_manager_erc721_with_metadata, // only s-chain
            imaState.jo_community_locker, // only s-chain
            imaState.jo_token_manager_linker, // only s-chain
            imaState.chainProperties.sc.strChainName,
            imaState.chainProperties.mn.cid,
            imaState.chainProperties.mn.transactionCustomizer //,
        );
    bSuccess = ( jarrReceipts != null && jarrReceipts.length > 0 ) ? true : false;
    log.write( strLogPrefix +
        cc.debug( "Chain was " ) +
        ( bSuccess ? cc.success( "registered successfully" ) : cc.error( "not registered" ) ) +
        "\n" );
    if( bSuccess ) {
        g_registrationCostInfo.mn =
            g_registrationCostInfo.mn.concat( g_registrationCostInfo.mn, jarrReceipts );
    }
    if( isPrintSummaryRegistrationCosts )
        print_summary_registration_costs();
    if( !bSuccess ) {
        const nRetCode = 163;
        log.write( strLogPrefix +
            cc.fatal( "FATAL, CRITICAL ERROR:" ) +
            cc.error( " failed to register S-Chain in deposit box, will return code " ) +
            cc.warning( nRetCode ) + "\n" );
        process.exit( nRetCode );
    }
    return true;
}
async function register_all( isPrintSummaryRegistrationCosts ) {
    if( !await register_step1( false ) )
        return false;
    if( isPrintSummaryRegistrationCosts )
        print_summary_registration_costs();
    return true;
}

async function check_registration_all() {
    const b1 = await check_registration_step1();
    return b1;
}
async function check_registration_step1() {
    const imaState = state.get();
    imaCLI.ima_contracts_init();
    const bRetVal = await IMA.check_is_registered_s_chain_in_deposit_boxes( // step 1
        imaState.chainProperties.mn.ethersProvider,
        imaState.jo_linker,
        imaState.chainProperties.mn.joAccount,
        imaState.chainProperties.sc.strChainName
    );
    return bRetVal;
}

function print_summary_registration_costs( details ) {
    IMA.print_gas_usage_report_from_array(
        "Main Net REGISTRATION",
        g_registrationCostInfo.mn,
        details
    );
    IMA.print_gas_usage_report_from_array(
        "S-Chain REGISTRATION",
        g_registrationCostInfo.sc,
        details
    );
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

async function wait_until_s_chain_started() {
    const imaState = state.get();
    log.write(
        cc.debug( "Checking " ) + cc.info( "S-Chain" ) + cc.debug( " is accessible and sane..." ) +
        "\n" );
    if( ( !imaState.chainProperties.sc.strURL ) ||
        imaState.chainProperties.sc.strURL.length === 0
    ) {
        log.write(
            cc.warning( "Skipped, " ) + cc.info( "S-Chain" ) +
            cc.warning( " URL was not provided." ) +
            "\n" );
        return;
    }
    let bSuccess = false;
    let idxWaitAttempt = 0;
    for( ; !bSuccess; ) {
        try {
            const joSChainNetworkInfo = await discover_s_chain_network(
                function( err, joSChainNetworkInfo ) {
                    if( ! err )
                        bSuccess = true;
                }, true, null, -1 ).catch( ( err ) => {
                const strError = owaspUtils.extract_error_message( err );
                log.write(
                    cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " S-Chain network discovery failed: " ) +
                    cc.warning( strError ) + "\n"
                );
            } );
            if( ! joSChainNetworkInfo )
                bSuccess = false;
        } catch ( err ) {
            bSuccess = false;
        }
        if( !bSuccess )
            ++ idxWaitAttempt;
        if( idxWaitAttempt >= imaState.nMaxWaitSChainAttempts ) {
            log.write(
                cc.warning( "Incomplete, " ) + cc.info( "S-Chain" ) +
                cc.warning( " sanity check failed after " ) + cc.info( idxWaitAttempt ) +
                cc.warning( " attempts." ) +
                "\n" );
            return;
        }
        await IMA.sleep( 1000 );
    }
    log.write(
        cc.success( "Done, " ) + cc.info( "S-Chain" ) +
        cc.success( " is accessible and sane." ) +
        "\n" );
}

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////

async function main() {
    cc.auto_enable_from_command_line_args();
    const imaState = state.get();
    const tmp_address_MN_from_env =
        owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_ETHEREUM );
    const tmp_address_SC_from_env =
        owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_SCHAIN );
    const tmp_address_TC_from_env =
        owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_SCHAIN_TARGET );
    if( tmp_address_MN_from_env &&
        typeof tmp_address_MN_from_env == "string" &&
        tmp_address_MN_from_env.length > 0 )
        imaState.chainProperties.mn.joAccount.address_ = "" + tmp_address_MN_from_env;
    if( tmp_address_SC_from_env &&
        typeof tmp_address_SC_from_env == "string" &&
        tmp_address_SC_from_env.length > 0 )
        imaState.chainProperties.sc.joAccount.address_ = "" + tmp_address_SC_from_env;
    if( tmp_address_TC_from_env &&
        typeof tmp_address_TC_from_env == "string" &&
        tmp_address_TC_from_env.length > 0 )
        imaState.chainProperties.tc.joAccount.address_ = "" + tmp_address_TC_from_env;
    parse_command_line();
    init_monitoring_server();
    init_json_rpc_server();
    if( imaState.bSignMessages ) {
        if( imaState.strPathBlsGlue.length == 0 ) {
            log.write(
                cc.fatal( "FATAL, CRITICAL ERROR:" ) +
                cc.error( " please specify --bls-glue parameter." ) +
                "\n" );
            process.exit( 164 );
        }
        if( imaState.strPathHashG1.length == 0 ) {
            log.write(
                cc.fatal( "FATAL, CRITICAL ERROR:" ) +
                cc.error( " please specify --hash-g1 parameter." ) +
                "\n" );
            process.exit( 165 );
        }
        if( ! imaState.bNoWaitSChainStarted ) {
            const isSilent = imaState.joSChainDiscovery.isSilentReDiscovery;
            wait_until_s_chain_started().then( function() {
                // uses call to discover_s_chain_network()
                discover_s_chain_network( function( err, joSChainNetworkInfo ) {
                    if( err ) {
                        // error information is printed by discover_s_chain_network()
                        process.exit( 166 );
                    }
                    if( IMA.verbose_get() >= IMA.RV_VERBOSE().information ) {
                        log.write(
                            cc.success( "S-Chain network was discovered: " ) +
                            cc.j( joSChainNetworkInfo ) +
                            "\n" );
                    }
                    imaState.joSChainNetworkInfo = joSChainNetworkInfo;
                    continue_schain_discovery_in_background_if_needed( isSilent );
                    do_the_job();
                    return 0; // FINISH
                }, isSilent, imaState.joSChainNetworkInfo, -1 ).catch( ( err ) => {
                    const strError = owaspUtils.extract_error_message( err );
                    log.write(
                        cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " S-Chain network discovery failed: " ) +
                        cc.warning( strError ) + "\n"
                    );
                } );
            } );
        }
    } else
        do_the_job();
        // FINISH!!! (skip exit here to avoid early termination while tasks ase still running)
}

main();

///////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////
