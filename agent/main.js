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
 * @file main.js
 * @copyright SKALE Labs 2019-Present
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; // allow self-signed wss and https

// const fs = require( "fs" );
// const path = require( "path" );
// const url = require( "url" );
// const os = require( "os" );
const ws = require( "ws" ); // https://www.npmjs.com/package/ws
global.IMA = require( "../npms/skale-ima" );
global.w3mod = IMA.w3mod;
global.ethereumjs_tx = IMA.ethereumjs_tx;
global.ethereumjs_wallet = IMA.ethereumjs_wallet;
global.ethereumjs_util = IMA.ethereumjs_util;
global.compose_tx_instance = IMA.compose_tx_instance;
global.owaspUtils = IMA.owaspUtils;
global.imaUtils = require( "./utils.js" );
IMA.expose_details_set( false );
IMA.verbose_set( IMA.verbose_parse( "info" ) );
global.log = global.imaUtils.log;
global.cc = global.imaUtils.cc;
global.imaCLI = require( "./cli.js" );
global.imaBLS = require( "./bls.js" );
global.rpcCall = require( "./rpc-call.js" );
global.skale_observer = require( "../npms/skale-observer/observer.js" );
global.rpcCall.init();
global.imaOracle = require( "./oracle.js" );
global.imaOracle.init();

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

global.imaState = {
    "strLogFilePath": "",
    "nLogMaxSizeBeforeRotation": -1,
    "nLogMaxFilesCount": -1,
    "isPrintGathered": true,
    "isPrintSecurityValues": false,

    "bIsNeededCommonInit": true,
    "bSignMessages": false, // use BLS message signing, turned on with --sign-messages
    "joSChainNetworkInfo": null, // scanned S-Chain network description
    "strPathBlsGlue": "", // path to bls_glue app, must have if --sign-messages specified
    "strPathHashG1": "", // path to hash_g1 app, must have if --sign-messages specified
    "strPathBlsVerify": "", // path to verify_bls app, optional, if specified then we will verify gathered BLS signature

    "joAbiPublishResult_skale_manager": { },
    "joAbiPublishResult_main_net": { },
    "joAbiPublishResult_s_chain": { },
    "joAbiPublishResult_t_chain": { },
    "bHaveSkaleManagerABI": false,
    "bHaveImaAbiMainNet": false,
    "bHaveImaAbiSchain": false,
    "bHaveImaAbiSchainTarget": false,

    "joErc20_main_net": null,
    "joErc20_s_chain": null,
    "joErc20_t_chain": null,
    "strAddrErc20_explicit": "",
    "strAddrErc20_explicit_target": "", // S<->S target
    "strCoinNameErc20_main_net": "", // in-JSON coin name
    "strCoinNameErc20_s_chain": "", // in-JSON coin name
    "strCoinNameErc20_t_chain": "", // in-JSON coin name

    "joErc721_main_net": null,
    "joErc721_s_chain": null,
    "joErc721_t_chain": null,
    "strAddrErc721_explicit": "",
    "strAddrErc721_explicit_target": "", // S<->S target
    "strCoinNameErc721_main_net": "", // in-JSON coin name
    "strCoinNameErc721_s_chain": "", // in-JSON coin name
    "strCoinNameErc721_t_chain": "", // in-JSON coin name

    "joErc1155_main_net": null,
    "joErc1155_s_chain": null,
    "joErc1155_t_chain": null,
    "strAddrErc1155_explicit": "",
    "strAddrErc1155_explicit_target": "", // S<->S target
    "strCoinNameErc1155_main_net": "", // in-JSON coin name
    "strCoinNameErc1155_s_chain": "", // in-JSON coin name
    "strCoinNameErc1155_t_chain": "", // in-JSON coin name

    "strPathAbiJson_skale_manager": "", // imaUtils.normalizePath( "../proxy/data/skaleManager.json" ),
    "strPathAbiJson_main_net": null, // imaUtils.normalizePath( "../proxy/data/proxyMainnet.json" ),
    "strPathAbiJson_s_chain": null, // imaUtils.normalizePath( "../proxy/data/proxySchain.json" ),
    "strPathAbiJson_t_chain": null, // imaUtils.normalizePath( "../proxy/data/proxySchainTarget.json" ),

    "bShowConfigMode": false, // true - just show configuration values and exit

    "bNoWaitSChainStarted": false,
    "nMaxWaitSChainAttempts": 0 + Number.MAX_SAFE_INTEGER, // 20
    "isPreventExitAfterLastAction": false,

    "strURL_main_net": owaspUtils.toStringURL( process.env.URL_W3_ETHEREUM ), // example: "http://127.0.0.1:8545"
    "strURL_s_chain": owaspUtils.toStringURL( process.env.URL_W3_S_CHAIN ), // example: "http://127.0.0.1:2231"
    "strURL_t_chain": owaspUtils.toStringURL( process.env.URL_W3_S_CHAIN_TARGET ), // example: "http://127.0.0.1:2231"

    "strChainName_main_net": ( process.env.CHAIN_NAME_ETHEREUM || "Mainnet" ).toString().trim(),
    "strChainName_s_chain": ( process.env.CHAIN_NAME_SCHAIN || "id-S-chain" ).toString().trim(),
    "strChainName_origin_chain": ( process.env.CHAIN_NAME_SCHAIN_ORIGIN || "Mainnet" ).toString().trim(),
    "strChainName_t_chain": ( process.env.CHAIN_NAME_SCHAIN_TARGET || "id-T-chain" ).toString().trim(),
    "cid_main_net": owaspUtils.toInteger( process.env.CID_ETHEREUM ) || -4,
    "cid_s_chain": owaspUtils.toInteger( process.env.CID_SCHAIN ) || -4,
    "cid_t_chain": owaspUtils.toInteger( process.env.CID_SCHAIN_TARGET ) || -4,

    "strPathJsonErc20_main_net": "",
    "strPathJsonErc20_s_chain": "",
    "strPathJsonErc20_t_chain": "",
    "strPathJsonErc721_main_net": "",
    "strPathJsonErc721_s_chain": "",
    "strPathJsonErc721_t_chain": "",
    "strPathJsonErc1155_main_net": "",
    "strPathJsonErc1155_s_chain": "",
    "strPathJsonErc1155_t_chain": "",

    "nAmountOfWei": 0,
    "nAmountOfToken": 0,
    "arrAmountsOfTokens": null,
    "idToken": 0,

    "nTransferBlockSizeM2S": 4, // 10
    "nTransferBlockSizeS2M": 4, // 10
    "nTransferBlockSizeS2S": 4, // 10
    "nMaxTransactionsM2S": 0,
    "nMaxTransactionsS2M": 0,
    "nMaxTransactionsS2S": 0,

    "nBlockAwaitDepthM2S": 0,
    "nBlockAwaitDepthS2M": 0,
    "nBlockAwaitDepthS2S": 0,
    "nBlockAgeM2S": 0,
    "nBlockAgeS2M": 0,
    "nBlockAgeS2S": 0,

    "nLoopPeriodSeconds": 10,

    "nNodeNumber": 0, // S-Chain node number(zero based)
    "nNodesCount": 1,
    "nTimeFrameSeconds": 0, // 0-disable, 60-recommended
    "nNextFrameGap": 10,

    "nAutoExitAfterSeconds": 3600, // 0-disable

    "w3_main_net": null,
    "w3_s_chain": null,
    "w3_t_chain": null,

    "jo_community_pool": null, // only main net
    "jo_deposit_box_eth": null, // only main net
    "jo_deposit_box_erc20": null, // only main net
    "jo_deposit_box_erc721": null, // only main net
    "jo_deposit_box_erc1155": null, // only main net
    "jo_deposit_box_erc721_with_metadata": null, // only main net
    "jo_linker": null, // only main net

    "isWithMetadata721": false,

    "jo_token_manager_eth": null, // only s-chain
    // "jo_token_manager_eth_target": null, // only s-chain target
    "jo_token_manager_erc20": null, // only s-chain
    "jo_token_manager_erc20_target": null, // only s-chain
    "jo_token_manager_erc721": null, // only s-chain target
    "jo_token_manager_erc721_target": null, // only s-chain target
    "jo_token_manager_erc1155": null, // only s-chain
    "jo_token_manager_erc1155_target": null, // only s-chain target
    "jo_token_manager_erc721_with_metadata": null, // only s-chain target
    "jo_token_manager_erc721_with_metadata_target": null, // only s-chain target
    "jo_community_locker": null, // only s-chain
    "jo_community_locker_target": null, // only s-chain target
    "jo_message_proxy_main_net": null,
    "jo_message_proxy_s_chain": null,
    "jo_message_proxy_s_chain_target": null, // only s-chain target
    "jo_token_manager_linker": null,
    "jo_token_manager_linker_target": null, // only s-chain target
    "eth_erc20": null, // only s-chain
    // "eth_erc721": null, // only s-chain
    // "eth_erc1155": null, // only s-chain
    "eth_erc20_target": null, // only s-chain target
    // "eth_erc721_target": null, // only s-chain target
    // "eth_erc1155_target": null, // only s-chain target

    //
    // example:
    //
    // "joAccount_main_net": { "name": "g3",    "privateKey": "<YOUR_PRIVATE_KEY_HERE>", "address": IMA.owaspUtils.fn_address_impl_ },
    // "joAccount_s_chain ": { "name": "Bob",   "privateKey": "<YOUR_PRIVATE_KEY_HERE>", "address": IMA.owaspUtils.fn_address_impl_ },
    // "joAccount_t_chain ": { "name": "Alice", "privateKey": "<YOUR_PRIVATE_KEY_HERE>", "address": IMA.owaspUtils.fn_address_impl_ },
    //
    //
    // example of empty values to fill from command line arguments:
    //
    // "joAccount_main_net": { "privateKey": "", "address": IMA.owaspUtils.fn_address_impl_ },
    // "joAccount_s_chain": { "privateKey": "", "address": IMA.owaspUtils.fn_address_impl_ },
    // "joAccount_t_chain": { "privateKey": "", "address": IMA.owaspUtils.fn_address_impl_ },
    //
    "joAccount_main_net": {
        "privateKey": owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_ETHEREUM ),
        "address": IMA.owaspUtils.fn_address_impl_,
        "strTransactionManagerURL": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_URL_ETHEREUM ),
        "tm_priority": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_PRIORITY_ETHEREUM ) || 5,
        "strSgxURL": owaspUtils.toStringURL( process.env.SGX_URL_ETHEREUM ),
        "strSgxKeyName": owaspUtils.toStringURL( process.env.SGX_KEY_ETHEREUM ),
        "strPathSslKey": ( process.env.SGX_SSL_KEY_FILE_ETHEREUM || "" ).toString().trim(),
        "strPathSslCert": ( process.env.SGX_SSL_CERT_FILE_ETHEREUM || "" ).toString().trim()
    },
    "joAccount_s_chain": {
        "privateKey": owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_SCHAIN ),
        "address": IMA.owaspUtils.fn_address_impl_,
        "strTransactionManagerURL": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_URL_S_CHAIN ),
        "tm_priority": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_PRIORITY_S_CHAIN ) || 5,
        "strSgxURL": owaspUtils.toStringURL( process.env.SGX_URL_S_CHAIN ),
        "strSgxKeyName": owaspUtils.toStringURL( process.env.SGX_KEY_S_CHAIN ),
        "strPathSslKey": ( process.env.SGX_SSL_KEY_FILE_S_CHAIN || "" ).toString().trim(),
        "strPathSslCert": ( process.env.SGX_SSL_CERT_FILE_S_CHAIN || "" ).toString().trim()
    },
    "joAccount_t_chain": {
        "privateKey": owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_SCHAIN_TARGET ),
        "address": IMA.owaspUtils.fn_address_impl_,
        "strTransactionManagerURL": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_URL_S_CHAIN_TARGET ),
        "tm_priority": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_PRIORITY_S_CHAIN_TARGET ) || 5,
        "strSgxURL": owaspUtils.toStringURL( process.env.SGX_URL_S_CHAIN_TARGET ),
        "strSgxKeyName": owaspUtils.toStringURL( process.env.SGX_KEY_S_CHAIN_TARGET ),
        "strPathSslKey": ( process.env.SGX_SSL_KEY_FILE_S_CHAIN_TARGET || "" ).toString().trim(),
        "strPathSslCert": ( process.env.SGX_SSL_CERT_FILE_S_CHAIN_TARGET || "" ).toString().trim()
    },

    //
    "tc_main_net": IMA.tc_main_net,
    "tc_s_chain": IMA.tc_s_chain,
    "tc_t_chain": IMA.tc_t_chain,
    //

    "doEnableDryRun": function( isEnable ) { return IMA.dry_run_enable( isEnable ); },
    "doIgnoreDryRun": function( isIgnore ) { return IMA.dry_run_ignore( isIgnore ); },

    "optsPendingTxAnalysis": {
        "isEnabled": false, // disable bv default
        "nTimeoutSecondsBeforeSecondAttempt": 3, // 0 - disable 2nd attempt
        "isIgnore": false, // ignore PTX result
        "isIgnore2": true // ignore secondary PTX result
    },

    "nMonitoringPort": 0, // 0 - default, means monitoring server is disabled

    "strReimbursementChain": "",
    "isShowReimbursementBalance": false,
    "nReimbursementRecharge": 0,
    "nReimbursementWithdraw": 0,
    "nReimbursementRange": -1, // < 0 - do not change anything

    "joSChainDiscovery": {
        "isSilentReDiscovery": true,
        "repeatIntervalMilliseconds": 10 * 1000 // zero to disable (for debugging only)
    },

    "s2s_opts": { // S-Chain to S-Chain transfer options
        "isEnabled": true, // is S-Chain to S-Chain transfers enabled
        "secondsToReDiscoverSkaleNetwork": 1 * 60 * 60 // seconts to re-discover SKALE network, 0 to disable
    },

    "arrActions": [] // array of actions to run
};

const tmp_address_MN_from_env = owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_ETHEREUM );
const tmp_address_SC_from_env = owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_SCHAIN );
const tmp_address_TC_from_env = owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_SCHAIN_TARGET );
if( tmp_address_MN_from_env && typeof tmp_address_MN_from_env == "string" && tmp_address_MN_from_env.length > 0 )
    imaState.joAccount_main_net.address_ = "" + tmp_address_MN_from_env;
if( tmp_address_SC_from_env && typeof tmp_address_SC_from_env == "string" && tmp_address_SC_from_env.length > 0 )
    imaState.joAccount_s_chain.address_ = "" + tmp_address_SC_from_env;
if( tmp_address_TC_from_env && typeof tmp_address_TC_from_env == "string" && tmp_address_TC_from_env.length > 0 )
    imaState.joAccount_t_chain.address_ = "" + tmp_address_TC_from_env;

imaBLS.init();

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const fnInitActionSkaleNetworkScanForS2S = function() {
    if( ! imaState.s2s_opts.isEnabled )
        return;
    imaState.arrActions.push( {
        "name": "SKALE network scan for S2S",
        "fn": async function() {
            const strLogPrefix = cc.info( "SKALE network scan for S2S:" ) + " ";
            if( imaState.strPathAbiJson_skale_manager.length === 0 ) {
                console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " missing Skale Manager ABI, please specify " ) + cc.info( "abi-skale-manager" ) );
                process.exit( 153 );
            }
            log.write( strLogPrefix + cc.debug( "Downloading SKALE network information..." ) + "\n" ); // just print value
            const opts = {
                imaState: imaState,
                "details": log,
                "bStopNeeded": false,
                "secondsToReDiscoverSkaleNetwork": imaState.s2s_opts.secondsToReDiscoverSkaleNetwork
            };
            const addressFrom = imaState.joAccount_main_net.address( imaState.w3_main_net );
            // const strError = await skale_observer.cache_schains(
            //     imaState.strChainName_s_chain, // strChainNameConnectedTo
            //     imaState.w3_main_net,
            //     imaState.w3_s_chain,
            //     addressFrom,
            //     opts
            // );
            // if( strError ) {
            //     log.write( strLogPrefix + cc.error( "Failed to get " ) + cc.info( "SKALE NETWORK" ) + cc.error( " information: " ) + cc.warning( strError ) + "\n" );
            //     return true;
            // }
            // const arr_schains = skale_observer.get_last_cached_schains();
            // log.write( strLogPrefix + cc.normal( "Got " ) + cc.info( "SKALE NETWORK" ) + cc.normal( " information: " ) + cc.j( arr_schains ) + "\n" );
            log.write( strLogPrefix + cc.debug( "Will start periodic S-Chains caching..." ) + "\n" );
            await skale_observer.periodic_caching_start(
                imaState.strChainName_s_chain, // strChainNameConnectedTo
                imaState.w3_main_net,
                imaState.w3_s_chain,
                addressFrom,
                opts
            );
            log.write( strLogPrefix + cc.success( "Done, did started periodic S-Chains caching." ) + "\n" );
            return true;
        }
    } );
};

imaCLI.init();
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
                const nExitCode = b ? 0 : 150; // 0 - OKay - registered; non-zero -  not registered or error
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
                const nExitCode = b ? 0 : 152; // 0 - OKay - registered; non-zero -  not registered or error
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
                if( imaState.strCoinNameErc20_t_chain.length > 0 ) {
                    try {
                        const strAddressMintTo = imaState.joAccount_t_chain.address( imaState.w3_t_chain ); // same as caller/transaction signer
                        bMintIsOK = await IMA.mintERC20(
                            imaState.w3_t_chain,
                            imaState.cid_t_chain,
                            imaState.strChainName_t_chain,
                            imaState.joAccount_t_chain,
                            strAddressMintTo,
                            imaState.nAmountOfToken,
                            imaState.joErc20_t_chain[imaState.strCoinNameErc20_t_chain + "_address"],
                            imaState.joErc20_t_chain[imaState.strCoinNameErc20_t_chain + "_abi"],
                            imaState.tc_t_chain
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
                if( imaState.strCoinNameErc721_t_chain.length > 0 ) {
                    try {
                        const strAddressMintTo = imaState.joAccount_t_chain.address( imaState.w3_t_chain ); // same as caller/transaction signer
                        const idTokens = imaState.have_idTokens ? imaState.idTokens : [];
                        if( imaState.have_idToken )
                            idTokens.push( imaState.idToken );
                        if( idTokens.length > 0 ) {
                            for( let i = 0; i < idTokens.length; ++ i ) {
                                const idToken = idTokens[i];
                                bMintIsOK = await IMA.mintERC721(
                                    imaState.w3_t_chain,
                                    imaState.cid_t_chain,
                                    imaState.strChainName_t_chain,
                                    imaState.joAccount_t_chain,
                                    strAddressMintTo,
                                    idToken,
                                    imaState.joErc721_t_chain[imaState.strCoinNameErc721_t_chain + "_address"],
                                    imaState.joErc721_t_chain[imaState.strCoinNameErc721_t_chain + "_abi"],
                                    imaState.tc_t_chain
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
                if( imaState.strCoinNameErc1155_t_chain.length > 0 ) {
                    try {
                        const strAddressMintTo = imaState.joAccount_t_chain.address( imaState.w3_t_chain ); // same as caller/transaction signer
                        const idTokens = imaState.have_idTokens ? imaState.idTokens : [];
                        if( imaState.have_idToken )
                            idTokens.push( imaState.idToken );
                        if( idTokens.length > 0 ) {
                            for( let i = 0; i < idTokens.length; ++ i ) {
                                const idToken = idTokens[i];
                                bMintIsOK = await IMA.mintERC1155(
                                    imaState.w3_t_chain,
                                    imaState.cid_t_chain,
                                    imaState.strChainName_t_chain,
                                    imaState.joAccount_t_chain,
                                    strAddressMintTo,
                                    idToken,
                                    imaState.nAmountOfToken,
                                    imaState.joErc1155_t_chain[imaState.strCoinNameErc1155_t_chain + "_address"],
                                    imaState.joErc1155_t_chain[imaState.strCoinNameErc1155_t_chain + "_abi"],
                                    imaState.tc_t_chain
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
                if( imaState.strCoinNameErc20_t_chain.length > 0 ) {
                    try {
                        const strAddressBurnFrom = imaState.joAccount_t_chain.address( imaState.w3_t_chain ); // same as caller/transaction signer
                        bBurnIsOK = await IMA.burnERC20(
                            imaState.w3_t_chain,
                            imaState.cid_t_chain,
                            imaState.strChainName_t_chain,
                            imaState.joAccount_t_chain,
                            strAddressBurnFrom,
                            imaState.nAmountOfToken,
                            imaState.joErc20_t_chain[imaState.strCoinNameErc20_t_chain + "_address"],
                            imaState.joErc20_t_chain[imaState.strCoinNameErc20_t_chain + "_abi"],
                            imaState.tc_t_chain
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
                if( imaState.strCoinNameErc721_t_chain.length > 0 ) {
                    try {
                        // const strAddressBurnFrom = imaState.joAccount_t_chain.address( imaState.w3_t_chain ); // same as caller/transaction signer
                        const idTokens = imaState.have_idTokens ? imaState.idTokens : [];
                        if( imaState.have_idToken )
                            idTokens.push( imaState.idToken );
                        if( idTokens.length > 0 ) {
                            for( let i = 0; i < idTokens.length; ++ i ) {
                                const idToken = idTokens[i];
                                bBurnIsOK = await IMA.burnERC721(
                                    imaState.w3_t_chain,
                                    imaState.cid_t_chain,
                                    imaState.strChainName_t_chain,
                                    imaState.joAccount_t_chain,
                                    // strAddressBurnFrom,
                                    idToken,
                                    imaState.joErc721_t_chain[imaState.strCoinNameErc721_t_chain + "_address"],
                                    imaState.joErc721_t_chain[imaState.strCoinNameErc721_t_chain + "_abi"],
                                    imaState.tc_t_chain
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
                if( imaState.strCoinNameErc1155_t_chain.length > 0 ) {
                    try {
                        const strAddressBurnFrom = imaState.joAccount_t_chain.address( imaState.w3_t_chain ); // same as caller/transaction signer
                        const idTokens = imaState.have_idTokens ? imaState.idTokens : [];
                        if( imaState.have_idToken )
                            idTokens.push( imaState.idToken );
                        if( idTokens.length > 0 ) {
                            for( let i = 0; i < idTokens.length; ++ i ) {
                                const idToken = idTokens[i];
                                bBurnIsOK = await IMA.burnERC1155(
                                    imaState.w3_t_chain,
                                    imaState.cid_t_chain,
                                    imaState.strChainName_t_chain,
                                    imaState.joAccount_t_chain,
                                    strAddressBurnFrom,
                                    idToken,
                                    imaState.nAmountOfToken,
                                    imaState.joErc1155_t_chain[imaState.strCoinNameErc1155_t_chain + "_address"],
                                    imaState.joErc1155_t_chain[imaState.strCoinNameErc1155_t_chain + "_abi"],
                                    imaState.tc_t_chain
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
                    assetName: "RealETH",
                    balance: await IMA.balanceETH(
                        true, // isMainNet
                        imaState.w3_main_net,
                        imaState.cid_main_net,
                        imaState.joAccount_main_net
                    )
                } );
                arrBalancesMN.push( {
                    assetName: "CanReceiveETH",
                    balance: await IMA.view_eth_payment_from_s_chain_on_main_net(
                        imaState.w3_main_net,
                        imaState.joAccount_main_net,
                        imaState.jo_deposit_box_eth
                    )
                } );
                try { assetAddress = imaState.eth_erc20.options.address; } catch ( err ) { assetAddress = null; }
                arrBalancesSC.push( {
                    assetName: "RealETH",
                    assetAddress: assetAddress,
                    balance: await IMA.balanceETH(
                        false, // isMainNet
                        imaState.w3_s_chain,
                        imaState.cid_s_chain,
                        imaState.joAccount_s_chain,
                        imaState.eth_erc20
                    )
                } );
                arrBalancesSC.push( {
                    assetName: "FakeETH",
                    balance: await IMA.balanceETH(
                        true, // isMainNet here is true, but we do call S-Chain
                        imaState.w3_s_chain,
                        imaState.cid_s_chain,
                        imaState.joAccount_s_chain
                    )
                } );
                if( imaState.strCoinNameErc20_main_net.length > 0 ) {
                    try { assetAddress = imaState.joErc20_main_net[imaState.strCoinNameErc20_main_net + "_address"]; } catch ( err ) { assetAddress = null; }
                    arrBalancesMN.push( {
                        assetName: "ERC20",
                        assetAddress: assetAddress,
                        balance: await IMA.balanceERC20(
                            true, // isMainNet
                            imaState.w3_main_net,
                            imaState.cid_main_net,
                            imaState.joAccount_main_net,
                            imaState.strCoinNameErc20_main_net,
                            imaState.joErc20_main_net
                        )
                    } );
                }
                if( imaState.strCoinNameErc20_s_chain.length > 0 ) {
                    try { assetAddress = imaState.joErc20_s_chain[imaState.strCoinNameErc20_s_chain + "_address"]; } catch ( err ) { assetAddress = null; }
                    arrBalancesSC.push( {
                        assetName: "ERC20",
                        assetAddress: assetAddress,
                        balance: await IMA.balanceERC20(
                            false, // isMainNet
                            imaState.w3_s_chain,
                            imaState.cid_s_chain,
                            imaState.joAccount_s_chain,
                            imaState.strCoinNameErc20_s_chain,
                            imaState.joErc20_s_chain
                        )
                    } );
                }
                const idTokens = imaState.have_idTokens ? imaState.idTokens : [];
                if( imaState.have_idToken )
                    idTokens.push( imaState.idToken );
                if( idTokens.length > 0 ) {
                    if( imaState.strCoinNameErc721_main_net.length > 0 ) {
                        for( let i = 0; i < idTokens.length; ++ i ) {
                            const idToken = idTokens[i];
                            try { assetAddress = imaState.joErc721_main_net[imaState.strCoinNameErc721_main_net + "_address"]; } catch ( err ) { assetAddress = null; }
                            arrBalancesMN.push( {
                                assetName: "ERC721",
                                assetAddress: assetAddress,
                                idToken: idToken,
                                owner: await IMA.ownerOfERC721(
                                    true, // isMainNet
                                    imaState.w3_main_net,
                                    imaState.cid_main_net,
                                    imaState.joAccount_main_net,
                                    imaState.strCoinNameErc721_main_net,
                                    imaState.joErc721_main_net,
                                    idToken
                                )
                            } );
                        }
                    }
                    if( imaState.strCoinNameErc721_s_chain.length > 0 ) {
                        for( let i = 0; i < idTokens.length; ++ i ) {
                            const idToken = idTokens[i];
                            try { assetAddress = imaState.joErc721_s_chain[imaState.strCoinNameErc721_s_chain + "_address"]; } catch ( err ) { assetAddress = null; }
                            arrBalancesSC.push( {
                                assetName: "ERC721",
                                assetAddress: assetAddress,
                                idToken: idToken,
                                owner: await IMA.ownerOfERC721(
                                    false, // isMainNet
                                    imaState.w3_s_chain,
                                    imaState.cid_s_chain,
                                    imaState.joAccount_s_chain,
                                    imaState.strCoinNameErc721_s_chain,
                                    imaState.joErc721_s_chain,
                                    idToken
                                )
                            } );
                        }
                    }
                    if( imaState.strCoinNameErc1155_main_net.length > 0 ) {
                        for( let i = 0; i < idTokens.length; ++ i ) {
                            const idToken = idTokens[i];
                            try { assetAddress = imaState.joErc1155_main_net[imaState.strCoinNameErc1155_main_net + "_address"]; } catch ( err ) { assetAddress = null; }
                            arrBalancesMN.push( {
                                assetName: "ERC1155",
                                assetAddress: assetAddress,
                                idToken: idToken,
                                balance: await IMA.balanceERC1155(
                                    true, // isMainNet
                                    imaState.w3_main_net,
                                    imaState.cid_main_net,
                                    imaState.joAccount_main_net,
                                    imaState.strCoinNameErc1155_main_net,
                                    imaState.joErc1155_main_net,
                                    idToken
                                )
                            } );
                        }
                    }
                    if( imaState.strCoinNameErc1155_s_chain.length > 0 ) {
                        for( let i = 0; i < idTokens.length; ++ i ) {
                            const idToken = idTokens[i];
                            try { assetAddress = imaState.joErc1155_s_chain[imaState.strCoinNameErc1155_s_chain + "_address"]; } catch ( err ) { assetAddress = null; }
                            arrBalancesSC.push( {
                                assetName: "ERC1155",
                                assetAddress: assetAddress,
                                idToken: idToken,
                                balance: await IMA.balanceERC1155(
                                    false, // isMainNet
                                    imaState.w3_s_chain,
                                    imaState.cid_s_chain,
                                    imaState.joAccount_s_chain,
                                    imaState.strCoinNameErc1155_s_chain,
                                    imaState.joErc1155_s_chain,
                                    idToken
                                )
                            } );
                        }
                    }
                } // if( idTokens.length > 0 )
                const format_balance_info = function( bi, strAddress ) {
                    let s = "";
                    s += cc.attention( bi.assetName );
                    if( "assetAddress" in bi && typeof bi.assetAddress == "string" && bi.assetAddress.length > 0 )
                        s += cc.normal( "/" ) + cc.notice( bi.assetAddress );
                    if( "idToken" in bi )
                        s += cc.normal( " token ID " ) + cc.notice( bi.idToken );
                    s += cc.normal( ( bi.assetName == "ERC721" ) ? " owner is " : " balance is " );
                    s += ( bi.assetName == "ERC721" ) ? cc.bright( bi.owner ) : cc.sunny( bi.balance );
                    if( bi.assetName == "ERC721" ) {
                        const isSame = ( bi.owner.trim().toLowerCase() == strAddress.trim().toLowerCase() );
                        s += " " + ( isSame
                            ? cc.success( "same (as account " ) + cc.attention( strAddress ) + cc.success( " specified in the command line arguments)" )
                            : cc.error( "different (than account " ) + cc.attention( strAddress ) + cc.error( " specified in the command line arguments)" ) );
                    }
                    return s;
                };
                if( arrBalancesMN.length > 0 || arrBalancesSC.length > 0 ) {
                    if( arrBalancesMN.length > 0 ) {
                        const strAddress = imaState.joAccount_main_net.address( imaState.w3_main_net );
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
                        const strAddress = imaState.joAccount_s_chain.address( imaState.w3_s_chain );
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
                if( imaState.strCoinNameErc721_main_net.length > 0
                // && imaState.strCoinNameErc721_s_chain.length > 0
                ) {
                    // ERC721 payment
                    log.write( cc.info( "one M->S single ERC721 payment: " ) + cc.sunny( imaState.idToken ) + "\n" ); // just print value
                    return await IMA.do_erc721_payment_from_main_net(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_main_net,
                        imaState.joAccount_s_chain,
                        imaState.isWithMetadata721 ? imaState.jo_deposit_box_erc721_with_metadata : imaState.jo_deposit_box_erc721, // only main net
                        imaState.jo_message_proxy_main_net, // for checking logs
                        imaState.strChainName_s_chain,
                        imaState.idToken, // which ERC721 token id to send
                        imaState.nAmountOfWei, // how much to send
                        imaState.isWithMetadata721 ? imaState.jo_token_manager_erc721_with_metadata : imaState.jo_token_manager_erc721, // only s-chain
                        imaState.strCoinNameErc721_main_net,
                        imaState.joErc721_main_net,
                        imaState.strCoinNameErc721_s_chain,
                        imaState.joErc721_s_chain,
                        imaState.tc_main_net
                    );
                }
                if( imaState.strCoinNameErc20_main_net.length > 0
                // && imaState.strCoinNameErc20_s_chain.length > 0
                ) {
                    // ERC20 payment
                    log.write( cc.info( "one M->S single ERC20 payment: " ) + cc.sunny( imaState.nAmountOfToken ) + "\n" ); // just print value
                    return await IMA.do_erc20_payment_from_main_net(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_main_net,
                        imaState.joAccount_s_chain,
                        imaState.jo_deposit_box_erc20, // only main net
                        imaState.jo_message_proxy_main_net, // for checking logs
                        imaState.strChainName_s_chain,
                        imaState.nAmountOfToken, // how much ERC20 tokens to send
                        imaState.nAmountOfWei, // how much to send
                        imaState.jo_token_manager_erc20, // only s-chain
                        imaState.strCoinNameErc20_main_net,
                        imaState.joErc20_main_net,
                        imaState.strCoinNameErc20_s_chain,
                        imaState.joErc20_s_chain,
                        imaState.tc_main_net
                    );
                }
                if(
                    imaState.strCoinNameErc1155_main_net.length > 0 &&
                    imaState.idToken && imaState.idToken !== null && imaState.idToken !== undefined &&
                    imaState.nAmountOfToken && imaState.nAmountOfToken !== null && imaState.nAmountOfToken !== undefined &&
                    ( ( !imaState.idTokens ) || imaState.idTokens === null || imaState.idTokens === undefined ) &&
                    ( ( !imaState.arrAmountsOfTokens ) || imaState.arrAmountsOfTokens === null || imaState.arrAmountsOfTokens === undefined )
                ) {
                    // ERC1155 payment
                    log.write( cc.info( "one M->S single ERC1155 payment: " ) + cc.sunny( imaState.idToken ) + " " + cc.sunny( imaState.nAmountOfToken ) + "\n" ); // just print value
                    return await IMA.do_erc1155_payment_from_main_net(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_main_net,
                        imaState.joAccount_s_chain,
                        imaState.jo_deposit_box_erc1155, // only main net
                        imaState.jo_message_proxy_main_net, // for checking logs
                        imaState.strChainName_s_chain,
                        imaState.idToken, // which ERC1155 token id to send
                        imaState.nAmountOfToken, // which ERC1155 token amount to send
                        imaState.nAmountOfWei, // how much to send
                        imaState.jo_token_manager_erc1155, // only s-chain
                        imaState.strCoinNameErc1155_main_net,
                        imaState.joErc1155_main_net,
                        imaState.strCoinNameErc1155_s_chain,
                        imaState.joErc1155_s_chain,
                        imaState.tc_main_net
                    );
                }
                if(
                    imaState.strCoinNameErc1155_main_net.length > 0 &&
                    imaState.idTokens && imaState.idTokens !== null && imaState.idTokens !== undefined &&
                    imaState.arrAmountsOfTokens && imaState.arrAmountsOfTokens !== null && imaState.arrAmountsOfTokens !== undefined &&
                    ( !imaState.idToken || imaState.idToken === null || imaState.idToken === undefined ) &&
                    ( !imaState.nAmountOfToken || imaState.nAmountOfToken === null || imaState.nAmountOfToken === undefined )
                ) {
                    // ERC1155 Batch payment
                    log.write( cc.info( "one M->S single ERC1155 Batch payment: " ) + cc.sunny( imaState.idTokens ) + " " + cc.sunny( imaState.arrAmountsOfTokens ) + "\n" ); // just print value
                    return await IMA.do_erc1155_batch_payment_from_main_net(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_main_net,
                        imaState.joAccount_s_chain,
                        imaState.jo_deposit_box_erc1155, // only main net
                        imaState.jo_message_proxy_main_net, // for checking logs
                        imaState.strChainName_s_chain,
                        imaState.idTokens, // which ERC1155 token id to send
                        imaState.arrAmountsOfTokens, // which ERC1155 token amount to send
                        imaState.nAmountOfWei, // how much to send
                        imaState.jo_token_manager_erc1155, // only s-chain
                        imaState.strCoinNameErc1155_main_net,
                        imaState.joErc1155_main_net,
                        imaState.strCoinNameErc1155_s_chain,
                        imaState.joErc1155_s_chain,
                        imaState.tc_main_net
                    );
                }
                // ETH payment
                log.write( cc.info( "one M->S single ETH payment: " ) + cc.sunny( imaState.nAmountOfWei ) + "\n" ); // just print value
                return await IMA.do_eth_payment_from_main_net(
                    imaState.w3_main_net,
                    imaState.cid_main_net,
                    imaState.joAccount_main_net,
                    imaState.joAccount_s_chain,
                    imaState.jo_deposit_box_eth, // only main net
                    imaState.jo_message_proxy_main_net, // for checking logs
                    imaState.strChainName_s_chain,
                    imaState.nAmountOfWei, // how much WEI money to send
                    imaState.tc_main_net
                );
            }
        } );
    },
    "s2m-payment": function() {
        imaState.arrActions.push( {
            "name": "one S->M single payment",
            "fn": async function() {
                if( imaState.strCoinNameErc721_s_chain.length > 0 ) {
                    // ERC721 payment
                    log.write( cc.info( "one S->M single ERC721 payment: " ) + cc.sunny( imaState.idToken ) + "\n" ); // just print value
                    return await IMA.do_erc721_payment_from_s_chain(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_s_chain,
                        imaState.joAccount_main_net,
                        imaState.isWithMetadata721 ? imaState.jo_token_manager_erc721_with_metadata : imaState.jo_token_manager_erc721, // only s-chain
                        imaState.jo_message_proxy_s_chain, // for checking logs
                        imaState.isWithMetadata721 ? imaState.jo_deposit_box_erc721_with_metadata : imaState.jo_deposit_box_erc721, // only main net
                        imaState.idToken, // which ERC721 token id to send
                        imaState.nAmountOfWei, // how much to send
                        imaState.strCoinNameErc721_main_net,
                        imaState.joErc721_main_net,
                        imaState.strCoinNameErc721_s_chain,
                        imaState.joErc721_s_chain,
                        imaState.tc_s_chain
                    );
                }
                if( imaState.strCoinNameErc20_s_chain.length > 0 ) {
                    // ERC20 payment
                    log.write( cc.info( "one S->M single ERC20 payment: " ) + cc.sunny( imaState.nAmountOfToken ) + "\n" ); // just print value
                    return await IMA.do_erc20_payment_from_s_chain(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_s_chain,
                        imaState.joAccount_main_net,
                        imaState.jo_token_manager_erc20, // only s-chain
                        imaState.jo_message_proxy_s_chain, // for checking logs
                        imaState.jo_deposit_box_erc20, // only main net
                        imaState.nAmountOfToken, // how ERC20 tokens money to send
                        imaState.nAmountOfWei, // how much to send
                        imaState.strCoinNameErc20_main_net,
                        imaState.joErc20_main_net,
                        imaState.strCoinNameErc20_s_chain,
                        imaState.joErc20_s_chain,
                        imaState.tc_s_chain
                    );
                }
                if(
                    imaState.strCoinNameErc1155_s_chain.length > 0 &&
                    imaState.idToken && imaState.idToken !== null && imaState.idToken !== undefined &&
                    imaState.nAmountOfToken && imaState.nAmountOfToken !== null && imaState.nAmountOfToken !== undefined &&
                    ( ( !imaState.idTokens ) || imaState.idTokens === null || imaState.idTokens === undefined ) &&
                    ( ( !imaState.arrAmountsOfTokens ) || imaState.arrAmountsOfTokens === null || imaState.arrAmountsOfTokens === undefined )
                ) {
                    // ERC1155 payment
                    log.write( cc.info( "one S->M single ERC1155 payment: " ) + cc.sunny( imaState.idToken ) + " " + cc.sunny( imaState.nAmountOfToken ) + "\n" ); // just print value
                    return await IMA.do_erc1155_payment_from_s_chain(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_s_chain,
                        imaState.joAccount_main_net,
                        imaState.jo_token_manager_erc1155, // only s-chain
                        imaState.jo_message_proxy_s_chain, // for checking logs
                        imaState.jo_deposit_box_erc1155, // only main net
                        imaState.idToken, // which ERC1155 token id to send
                        imaState.nAmountOfToken, // which ERC1155 token amount to send
                        imaState.nAmountOfWei, // how much to send
                        imaState.strCoinNameErc1155_main_net,
                        imaState.joErc1155_main_net,
                        imaState.strCoinNameErc1155_s_chain,
                        imaState.joErc1155_s_chain,
                        imaState.tc_s_chain
                    );
                }
                if(
                    imaState.strCoinNameErc1155_s_chain.length > 0 &&
                    imaState.idTokens && imaState.idTokens !== null && imaState.idTokens !== undefined &&
                    imaState.arrAmountsOfTokens && imaState.arrAmountsOfTokens !== null && imaState.arrAmountsOfTokens !== undefined &&
                    ( !imaState.idToken || imaState.idToken === null || imaState.idToken === undefined ) &&
                    ( !imaState.nAmountOfToken || imaState.nAmountOfToken === null || imaState.nAmountOfToken === undefined )
                ) {
                    // ERC1155 payment
                    log.write( cc.info( "one S->M single ERC1155 payment: " ) + cc.sunny( imaState.idTokens ) + " " + cc.sunny( imaState.arrAmountsOfTokens ) + "\n" ); // just print value
                    return await IMA.do_erc1155_batch_payment_from_s_chain(
                        imaState.w3_main_net,
                        imaState.w3_s_chain,
                        imaState.cid_main_net,
                        imaState.cid_s_chain,
                        imaState.joAccount_s_chain,
                        imaState.joAccount_main_net,
                        imaState.jo_token_manager_erc1155, // only s-chain
                        imaState.jo_message_proxy_s_chain, // for checking logs
                        imaState.jo_deposit_box_erc1155, // only main net
                        imaState.idTokens, // which ERC1155 token id to send
                        imaState.arrAmountsOfTokens, // which ERC1155 token amount to send
                        imaState.nAmountOfWei, // how much to send
                        imaState.strCoinNameErc1155_main_net,
                        imaState.joErc1155_main_net,
                        imaState.strCoinNameErc1155_s_chain,
                        imaState.joErc1155_s_chain,
                        imaState.tc_s_chain
                    );
                }
                // ETH payment
                log.write( cc.info( "one S->M single ETH payment: " ) + cc.sunny( imaState.nAmountOfWei ) + "\n" ); // just print value
                return await IMA.do_eth_payment_from_s_chain(
                    imaState.w3_s_chain,
                    imaState.cid_s_chain,
                    imaState.joAccount_s_chain,
                    imaState.joAccount_main_net,
                    imaState.jo_token_manager_eth, // only s-chain
                    imaState.jo_message_proxy_s_chain, // for checking logs
                    imaState.nAmountOfWei, // how much WEI money to send
                    imaState.tc_s_chain
                );
            }
        } );
    },
    "s2s-payment": function() {
        imaState.arrActions.push( {
            "name": "one S->S single payment",
            "fn": async function() {
                const isForward = IMA.isForwardS2S();
                const w3_src = isForward ? imaState.w3_s_chain : imaState.w3_t_chain;
                // const w3_dst = isForward ? imaState.w3_t_chain : imaState.w3_s_chain;
                const cid_src = isForward ? imaState.cid_s_chain : imaState.cid_t_chain;
                // const cid_dst = isForward ? imaState.cid_t_chain : imaState.cid_s_chain;
                const joAccountSrc = isForward ? imaState.joAccount_s_chain : imaState.joAccount_t_chain;
                // const joAccountDst = isForward ? imaState.joAccount_t_chain : imaState.joAccount_s_chain;
                // const jo_message_proxy_src = isForward ? imaState.jo_message_proxy_s_chain : imaState.jo_message_proxy_t_chain;
                // const jo_message_proxy_dst = isForward ? imaState.jo_message_proxy_t_chain : imaState.jo_message_proxy_s_chain;
                const jo_token_manager_erc20_src = isForward ? imaState.jo_token_manager_erc20 : imaState.jo_token_manager_erc20_target;
                // const jo_token_manager_erc20_dst = isForward ? imaState.jo_token_manager_erc20_target : imaState.jo_token_manager_erc20
                const jo_token_manager_erc721_src = isForward
                    ? ( imaState.isWithMetadata721 ? imaState.jo_token_manager_erc721_with_metadata : imaState.jo_token_manager_erc721 )
                    : ( imaState.isWithMetadata721 ? imaState.jo_token_manager_erc721_with_metadata_target : imaState.jo_token_manager_erc721_target )
                    ;
                // const jo_token_manager_erc721_dst = isForward
                //     ? ( imaState.isWithMetadata721 ? imaState.jo_token_manager_erc721_with_metadata_target : imaState.jo_token_manager_erc721_target )
                //     : ( imaState.isWithMetadata721 ? imaState.jo_token_manager_erc721_with_metadata : imaState.jo_token_manager_erc721 )
                //     ;
                const jo_token_manager_erc1155_src = isForward ? imaState.jo_token_manager_erc1155 : imaState.jo_token_manager_erc1155_target;
                // const jo_token_manager_erc1155_dst = isForward ? imaState.jo_token_manager_erc1155_target : imaState.jo_token_manager_erc1155
                // const strChainName_src = isForward ? imaState.strChainName_s_chain : imaState.strChainName_t_chain;
                const strChainName_dst = isForward ? imaState.strChainName_t_chain : imaState.strChainName_s_chain;
                const strCoinNameErc20_src = isForward ? imaState.strCoinNameErc20_s_chain : imaState.strCoinNameErc20_t_chain;
                // const strCoinNameErc20_dst = isForward ? imaState.strCoinNameErc20_t_chain : imaState.strCoinNameErc20_s_chain;
                const strCoinNameErc721_src = isForward ? imaState.strCoinNameErc721_s_chain : imaState.strCoinNameErc721_t_chain;
                // const strCoinNameErc721_dst = isForward ? imaState.strCoinNameErc721_t_chain : imaState.strCoinNameErc721_s_chain;
                const strCoinNameErc1155_src = isForward ? imaState.strCoinNameErc1155_s_chain : imaState.strCoinNameErc1155_t_chain;
                // const strCoinNameErc1155_dst = isForward ? imaState.strCoinNameErc1155_t_chain : imaState.strCoinNameErc1155_s_chain;
                const joErc20_src = isForward ? imaState.joErc20_s_chain : imaState.joErc20_t_chain;
                const joErc721_src = isForward ? imaState.joErc721_s_chain : imaState.joErc721_t_chain;
                const joErc1155_src = isForward ? imaState.joErc1155_s_chain : imaState.joErc1155_t_chain;
                let strAddrErc20_explicit = imaState.strAddrErc20_explicit;
                let strAddrErc20_explicit_target = imaState.strAddrErc20_explicit_target;
                let strAddrErc721_explicit = imaState.strAddrErc721_explicit;
                let strAddrErc721_explicit_target = imaState.strAddrErc721_explicit_target;
                let strAddrErc1155_explicit = imaState.strAddrErc1155_explicit;
                let strAddrErc1155_explicit_target = imaState.strAddrErc1155_explicit_target;
                if( ( ! strAddrErc20_explicit ) && imaState.joErc20_s_chain && imaState.strCoinNameErc20_s_chain )
                    strAddrErc20_explicit = imaState.joErc20_s_chain[imaState.strCoinNameErc20_s_chain + "_address"];
                if( ( ! strAddrErc20_explicit_target ) && imaState.joErc20_t_chain && imaState.strCoinNameErc20_t_chain )
                    strAddrErc20_explicit_target = imaState.joErc20_t_chain[imaState.strCoinNameErc20_t_chain + "_address"];
                if( ( ! strAddrErc721_explicit ) && imaState.joErc721_s_chain && imaState.strCoinNameErc721_s_chain )
                    strAddrErc721_explicit = imaState.joErc721_s_chain[imaState.strCoinNameErc721_s_chain + "_address"];
                if( ( ! strAddrErc721_explicit_target ) && imaState.joErc721_t_chain && imaState.strCoinNameErc721_t_chain )
                    strAddrErc721_explicit_target = imaState.joErc721_t_chain[imaState.strCoinNameErc721_t_chain + "_address"];
                if( ( ! strAddrErc1155_explicit ) && imaState.joErc1155_s_chain && imaState.strCoinNameErc1155_s_chain )
                    strAddrErc1155_explicit = imaState.joErc1155_s_chain[imaState.strCoinNameErc1155_s_chain + "_address"];
                if( ( ! strAddrErc1155_explicit_target ) && imaState.joErc1155_t_chain && imaState.strCoinNameErc1155_t_chain )
                    strAddrErc1155_explicit_target = imaState.joErc1155_t_chain[imaState.strCoinNameErc1155_t_chain + "_address"];
                // const strAddrErc20_src = isForward ? strAddrErc20_explicit : strAddrErc20_explicit_target;
                const strAddrErc20_dst = isForward ? strAddrErc20_explicit_target : strAddrErc20_explicit;
                // const strAddrErc721_src = isForward ? strAddrErc721_explicit : strAddrErc721_explicit_target;
                const strAddrErc721_dst = isForward ? strAddrErc721_explicit_target : strAddrErc721_explicit;
                // const strAddrErc1155_src = isForward ? strAddrErc1155_explicit : strAddrErc1155_explicit_target;
                const strAddrErc1155_dst = isForward ? strAddrErc1155_explicit_target : strAddrErc1155_explicit;
                const tc = isForward ? imaState.tc_s_chain : imaState.tc_t_chain;
                if( strCoinNameErc721_src.length > 0 ) {
                    // ERC721 payment
                    log.write( cc.info( "one S->S single ERC721 payment: " ) + cc.sunny( imaState.idToken ) + "\n" ); // just print value
                    return await IMA.do_erc721_payment_s2s(
                        isForward,
                        w3_src,
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
                    log.write( cc.info( "one S->S single ERC20 payment: " ) + cc.sunny( imaState.nAmountOfToken ) + "\n" ); // just print value
                    return await IMA.do_erc20_payment_s2s(
                        isForward,
                        w3_src,
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
                    imaState.idToken && imaState.idToken !== null && imaState.idToken !== undefined &&
                    imaState.nAmountOfToken && imaState.nAmountOfToken !== null && imaState.nAmountOfToken !== undefined &&
                    ( ( !imaState.idTokens ) || imaState.idTokens === null || imaState.idTokens === undefined ) &&
                    ( ( !imaState.arrAmountsOfTokens ) || imaState.arrAmountsOfTokens === null || imaState.arrAmountsOfTokens === undefined )
                ) {
                    // ERC1155 payment
                    log.write( cc.info( "one S->S single ERC1155 payment: " ) + cc.sunny( imaState.idToken ) + " " + cc.sunny( imaState.nAmountOfToken ) + "\n" ); // just print value
                    return await IMA.do_erc1155_payment_s2s(
                        isForward,
                        w3_src,
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
                    imaState.idTokens && imaState.idTokens !== null && imaState.idTokens !== undefined &&
                    imaState.arrAmountsOfTokens && imaState.arrAmountsOfTokens !== null && imaState.arrAmountsOfTokens !== undefined &&
                    ( !imaState.idToken || imaState.idToken === null || imaState.idToken === undefined ) &&
                    ( !imaState.nAmountOfToken || imaState.nAmountOfToken === null || imaState.nAmountOfToken === undefined )
                ) {
                    // ERC1155 Batch payment
                    log.write( cc.info( "one S->S single ERC1155 Batch payment: " ) + cc.sunny( imaState.idTokens ) + " " + cc.sunny( imaState.arrAmountsOfTokens ) + "\n" ); // just print value
                    return await IMA.do_erc1155_batch_payment_s2s(
                        isForward,
                        w3_src,
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
                log.write( cc.info( "one S->S single ETH payment: " ) + cc.sunny( imaState.nAmountOfWei ) + "\n" ); // just print value
                console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " S->S ETH payment(s) are neither supported nor allowed" ) );
                process.exit( 154 );
            }
        } );
    },
    "s2m-receive": function() {
        imaState.arrActions.push( {
            "name": "receive one S->M single ETH payment",
            "fn": async function() {
                log.write( cc.info( "receive one S->M single ETH payment: " ) + "\n" ); // just print value
                return await IMA.receive_eth_payment_from_s_chain_on_main_net(
                    imaState.w3_main_net,
                    imaState.cid_main_net,
                    imaState.joAccount_main_net,
                    imaState.jo_deposit_box_eth,
                    imaState.tc_main_net
                );
            }
        } );
    },
    "s2m-view": function() {
        imaState.arrActions.push( {
            "name": "view one S->M single ETH payment",
            "fn": async function() {
                log.write( cc.info( "view one S->M single ETH payment: " ) + "\n" ); // just print value
                const xWei = await IMA.view_eth_payment_from_s_chain_on_main_net(
                    imaState.w3_main_net,
                    imaState.joAccount_main_net,
                    imaState.jo_deposit_box_eth
                );
                if( xWei === null || xWei === undefined )
                    return false;

                const xEth = imaState.w3_main_net.utils.fromWei( xWei, "ether" );
                log.write( cc.success( "Main-net user can receive: " ) + cc.attention( xWei ) + cc.success( " wei = " ) + cc.attention( xEth ) + cc.success( " eth" ) + "\n" );
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
                return await IMA.do_transfer( // main-net --> s-chain
                    "M2S",
                    //
                    imaState.w3_main_net,
                    imaState.jo_message_proxy_main_net,
                    imaState.joAccount_main_net,
                    imaState.w3_s_chain,
                    imaState.jo_message_proxy_s_chain,
                    //
                    imaState.joAccount_s_chain,
                    imaState.strChainName_main_net,
                    imaState.strChainName_s_chain,
                    imaState.cid_main_net,
                    imaState.cid_s_chain,
                    null, // imaState.jo_deposit_box, // for logs validation on mainnet
                    imaState.jo_token_manager_eth, // for logs validation on s-chain
                    imaState.nTransferBlockSizeM2S,
                    imaState.nMaxTransactionsM2S,
                    imaState.nBlockAwaitDepthM2S,
                    imaState.nBlockAgeM2S,
                    imaBLS.do_sign_messages_m2s, // fn_sign_messages
                    null, // joExtraSignOpts
                    imaState.tc_s_chain,
                    imaState.optsPendingTxAnalysis
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
                return await IMA.do_transfer( // s-chain --> main-net
                    "S2M",
                    //
                    imaState.w3_s_chain,
                    imaState.jo_message_proxy_s_chain,
                    imaState.joAccount_s_chain,
                    imaState.w3_main_net,
                    imaState.jo_message_proxy_main_net,
                    //
                    imaState.joAccount_main_net,
                    imaState.strChainName_s_chain,
                    imaState.strChainName_main_net,
                    imaState.cid_s_chain,
                    imaState.cid_main_net,
                    imaState.jo_deposit_box_eth, // for logs validation on mainnet
                    null, // imaState.jo_token_manager - for logs validation on s-chain
                    imaState.nTransferBlockSizeS2M,
                    imaState.nMaxTransactionsS2M,
                    imaState.nBlockAwaitDepthS2M,
                    imaState.nBlockAgeS2M,
                    imaBLS.do_sign_messages_s2m, // fn_sign_messages
                    null, // joExtraSignOpts
                    imaState.tc_main_net,
                    imaState.optsPendingTxAnalysis
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
                fnInitActionSkaleNetworkScanForS2S();
                if( ! imaState.bNoWaitSChainStarted )
                    await wait_until_s_chain_started(); // s-chain --> main-net transfer
                return await IMA.do_s2s_all( // s-chain --> s-chain
                    imaState,
                    skale_observer,
                    imaState.w3_s_chain,
                    imaState.jo_message_proxy_s_chain,
                    //
                    imaState.joAccount_s_chain,
                    imaState.strChainName_s_chain,
                    imaState.cid_s_chain,
                    imaState.jo_token_manager_eth, // for logs validation on s-chain
                    imaState.nTransferBlockSizeM2S,
                    imaState.nMaxTransactionsM2S,
                    imaState.nBlockAwaitDepthM2S,
                    imaState.nBlockAgeM2S,
                    imaBLS.do_sign_messages_m2s, // fn_sign_messages
                    imaState.tc_s_chain,
                    imaState.optsPendingTxAnalysis
                );
            }
        } );
    },
    "transfer": function() {
        fnInitActionSkaleNetworkScanForS2S();
        imaState.arrActions.push( {
            "name": "Single M<->S transfer loop iteration",
            "fn": async function() {
                fnInitActionSkaleNetworkScanForS2S();
                if( ! imaState.bNoWaitSChainStarted )
                    await wait_until_s_chain_started(); // single_transfer_loop
                return await single_transfer_loop();
            }
        } );
    },
    "loop": function() {
        fnInitActionSkaleNetworkScanForS2S();
        imaState.arrActions.push( {
            "name": "M<->S and S->S transfer loop",
            "fn": async function() {
                IMA.isPreventExitAfterLastAction = true;
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
                return await run_transfer_loop( false );
            }
        } );
    },
    "browse-s-chain": function() {
        imaState.bIsNeededCommonInit = false;
        imaState.arrActions.push( {
            "name": "Brows S-Chain network",
            "fn": async function() {
                const strLogPrefix = cc.info( "S-Chain Browse:" ) + " ";
                if( imaState.strURL_s_chain.length === 0 ) {
                    console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " missing S-Chain URL, please specify " ) + cc.info( "url-s-chain" ) );
                    process.exit( 155 );
                }
                log.write( strLogPrefix + cc.normal( "Downloading S-Chain network information " ) + cc.normal( "..." ) + "\n" ); // just print value
                //
                const rpcCallOpts = null;
                await rpcCall.create( imaState.strURL_s_chain, rpcCallOpts, async function( joCall, err ) {
                    if( err ) {
                        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed" ) );
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
                            console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) );
                            await joCall.disconnect();
                            process.exit( 157 );
                        }
                        log.write( strLogPrefix + cc.normal( "S-Chain network information: " ) + cc.j( joOut.result ) + "\n" );
                        let nCountReceivedImaDescriptions = 0;
                        const jarrNodes = joOut.result.network;
                        for( let i = 0; i < jarrNodes.length; ++ i ) {
                            const joNode = jarrNodes[i];
                            if( ! joNode ) {
                                log.write(
                                    strLogPrefix + cc.error( "Discovery node " ) + cc.info( i ) +
                                    cc.error( " is completely unknown and will be skipped" ) + "\n" );
                                continue;
                            }
                            const strNodeURL = imaUtils.compose_schain_node_url( joNode );
                            const rpcCallOpts = null;
                            await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
                                if( err ) {
                                    console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed" ) );
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
                                        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) );
                                        process.exit( 159 );
                                    }
                                    log.write( strLogPrefix + cc.normal( "Node " ) + cc.info( joNode.nodeID ) + cc.normal( " IMA information: " ) + cc.j( joOut.result ) + "\n" );
                                    //process.exit( 0 );
                                    await joCall.disconnect();
                                } );
                            } );
                        }
                        //process.exit( 0 );
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
        // imaState.bIsNeededCommonInit = false;
        imaState.arrActions.push( {
            "name": "Browse S-Chain network",
            "fn": async function() {
                const strLogPrefix = cc.info( "SKALE NETWORK Browse:" ) + " ";
                if( imaState.strPathAbiJson_skale_manager.length === 0 ) {
                    console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " missing Skale Manager ABI, please specify " ) + cc.info( "abi-skale-manager" ) );
                    process.exit( 160 );
                }
                log.write( strLogPrefix + cc.debug( "Downloading SKALE network information..." ) + "\n" ); // just print value
                const opts = {
                    imaState: imaState,
                    "details": log,
                    "bStopNeeded": false
                };
                const addressFrom = imaState.joAccount_main_net.address( imaState.w3_main_net );
                const arr_schains = await skale_observer.load_schains( imaState.w3_main_net, addressFrom, opts );
                const cnt = arr_schains.length;
                log.write( strLogPrefix + cc.normal( "Got " ) + cc.info( cnt ) + cc.normal( " S-Chains(s) in SKALE NETWORK information: " ) + cc.j( arr_schains ) + "\n" );
                return true;
            }
        } );
    },
    "browse-connected-schains": function() {
        // imaState.bIsNeededCommonInit = false;
        imaState.arrActions.push( {
            "name": "Browse connected S-Chains",
            "fn": async function() {
                const strLogPrefix = cc.info( "Browse connected S-Chains:" ) + " ";
                if( imaState.strPathAbiJson_skale_manager.length === 0 ) {
                    console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " missing Skale Manager ABI, please specify " ) + cc.info( "abi-skale-manager" ) );
                    process.exit( 161 );
                }
                log.write( strLogPrefix + cc.debug( "Downloading SKALE network information..." ) + "\n" ); // just print value

                const opts = {
                    imaState: imaState,
                    "details": log,
                    "bStopNeeded": false
                };
                const addressFrom = imaState.joAccount_main_net.address( imaState.w3_main_net );

                const arr_schains_cached = await skale_observer.load_schains_connected_only(
                    imaState.w3_main_net,
                    imaState.w3_s_chain,
                    imaState.strChainName_s_chain, // strChainNameConnectedTo
                    addressFrom,
                    opts
                );

                const cnt = arr_schains_cached.length;
                log.write( strLogPrefix + cc.normal( "Got " ) + cc.info( cnt ) + cc.normal( " onnected S-Chain(s): " ) + cc.j( arr_schains_cached ) + "\n" );
                return true;
            }
        } );
    },
    "discover-cid": function() {
        // imaState.bIsNeededCommonInit = false;
        imaState.arrActions.push( {
            "name": "Discover chains ID(s)",
            "fn": async function() {
                const strLogPrefix = cc.info( "Discover chains ID(s):" ) + " ";
                const arr_urls_to_discover = [];
                if( imaState.strURL_main_net && typeof( imaState.strURL_main_net ) == "string" && imaState.strURL_main_net.length > 0 ) {
                    arr_urls_to_discover.push( {
                        "name": "Main Net",
                        "strURL": "" + imaState.strURL_main_net,
                        "fnSave": function( chainID ) { imaState.cid_main_net = chainID; }
                    } );
                }
                if( imaState.strURL_s_chain && typeof( imaState.strURL_s_chain ) == "string" && imaState.strURL_s_chain.length > 0 ) {
                    arr_urls_to_discover.push( {
                        "name": "S-Chain",
                        "strURL": "" + "" + imaState.strURL_s_chain,
                        "fnSave": function( chainID ) { imaState.cid_s_chain = chainID; }
                    } );
                }
                if( imaState.strURL_t_chain && typeof( imaState.strURL_t_chain ) == "string" && imaState.strURL_t_chain.length > 0 ) {
                    arr_urls_to_discover.push( {
                        "name": "S<->S Target S-Chain",
                        "strURL": "" + "" + imaState.strURL_t_chain,
                        "fnSave": function( chainID ) { imaState.cid_t_chain = chainID; }
                    } );
                }
                if( arr_urls_to_discover.length === 0 ) {
                    console.log( cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " no URLs privided to discover chain IDs, please specify " ) +
                        cc.warning( "--url-main-net" ) + cc.error( " and/or " ) +
                        cc.warning( "--url-s-chain" ) + cc.error( " and/or " ) +
                        cc.warning( "--url-t-chain" ) + cc.error( "." ) +
                        "\n" );
                    process.exit( 162 );
                }
                for( let i = 0; i < arr_urls_to_discover.length; ++ i ) {
                    const joDiscoverEntry = arr_urls_to_discover[i];
                    const chainID = await skale_observer.discover_chain_id( joDiscoverEntry.strURL );
                    if( chainID === null ) {
                        log.write( strLogPrefix +
                            cc.error( "Failed to detect " ) + cc.note( joDiscoverEntry.name ) + " " +
                            cc.attention( "chain ID" ) +
                            "\n" );
                    } else {
                        const cid16 = "0x" + w3mod.utils.toBN( chainID ).toString( 16 );
                        const cid10 = "" + w3mod.utils.toBN( chainID ).toString( 10 );
                        log.write( strLogPrefix +
                            cc.normal( "Got " ) + cc.note( joDiscoverEntry.name ) + " " +
                            cc.attention( "chain ID" ) + cc.normal( "=" ) + cc.note( cid16 ) + cc.normal( "=" ) +
                            cc.note( cid10 ) + cc.normal( " from URL " ) + cc.u( joDiscoverEntry.strURL ) +
                            "\n" );
                        joDiscoverEntry.fnSave( chainID );
                    }
                }
                return true;
            }
        } );
    }
} );

// "strReimbursementChain": "",
let haveReimbursementCommands = false;
if( imaState.isShowReimbursementBalance ) {
    haveReimbursementCommands = true;
    imaState.arrActions.push( {
        "name": "Gas Reimbursement - Show Balance",
        "fn": async function() {
            await IMA.reimbursement_show_balance(
                imaState.w3_main_net,
                imaState.jo_community_pool,
                imaState.joAccount_main_net.address( imaState.w3_main_net ),
                imaState.strChainName_main_net,
                imaState.cid_main_net,
                imaState.tc_main_net,
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
                imaState.w3_main_net,
                imaState.jo_community_pool,
                imaState.joAccount_main_net.address( imaState.w3_main_net ),
                imaState.strChainName_main_net,
                imaState.cid_main_net,
                imaState.tc_main_net,
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
                imaState.w3_main_net,
                imaState.jo_community_pool,
                imaState.joAccount_main_net,
                imaState.strChainName_main_net,
                imaState.cid_main_net,
                imaState.tc_main_net,
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
                imaState.w3_main_net,
                imaState.jo_community_pool,
                imaState.joAccount_main_net,
                imaState.strChainName_main_net,
                imaState.cid_main_net,
                imaState.tc_main_net,
                imaState.strReimbursementChain,
                imaState.nReimbursementWithdraw
            );
            return true;
        }
    } );
}
if( haveReimbursementCommands ) {
    if( imaState.strReimbursementChain == "" ) {
        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " missing value for " ) + cc.warning( "reimbursement-chain" ) + cc.error( " parameter, must be non-empty chain name" ) + "\n" );
        process.exit( 163 );
    }
}
if( imaState.nReimbursementRange >= 0 ) {
    imaState.arrActions.push( {
        "name": "Gas Reimbursement - Set Minimal time interval from S2M and S2S transfers",
        "fn": async function() {
            await IMA.reimbursement_set_range(
                imaState.w3_s_chain,
                imaState.jo_community_locker,
                imaState.joAccount_s_chain,
                imaState.strChainName_s_chain,
                imaState.cid_s_chain,
                imaState.tc_s_chain,
                imaState.strChainName_origin_chain,
                imaState.nReimbursementRange
            );
            return true;
        }
    } );
}

if( imaState.nAutoExitAfterSeconds > 0 ) {
    log.write( cc.debug( "Automatic exit after " ) + cc.info( imaState.nAutoExitAfterSeconds ) + cc.debug( " second(s) is requested." ) + "\n" );
    const iv = setInterval( function() {
        log.write( cc.debug( "Performing automatic exit after " ) + cc.info( imaState.nAutoExitAfterSeconds ) + cc.debug( " second(s)..." ) + "\n" );
        clearInterval( iv );
        process.exit( 0 );
    }, imaState.nAutoExitAfterSeconds * 1000 );
} else
    log.write( cc.debug( "Automatic exit was not requested, skipping it." ) + "\n" );

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

if( imaState.strLogFilePath.length > 0 ) {
    log.write( cc.debug( "Will print message to file " ) + cc.info( imaState.strLogFilePath ) + "\n" );
    log.add( imaState.strLogFilePath, imaState.nLogMaxSizeBeforeRotation, imaState.nLogMaxFilesCount );
}

if( imaState.bIsNeededCommonInit )
    imaCLI.ima_common_init();

if( imaState.bShowConfigMode ) {
    // just show configuration values and exit
    process.exit( 0 );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( cc.warning( "Notice: long S-Chain discovery is in progress" ) + "\n" );
            return;
        }
        g_b_in_s_chain_discovery = true;
        try {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
                log.write(
                    cc.info( "Will re-discover " ) + cc.notice( cntNodes ) + cc.info( "-node S-Chain network, " ) +
                    cc.notice( cntDiscovered ) + cc.info( " node(s) already discovered..." ) + "\n" );
            }
            await discover_s_chain_network( function( err, joSChainNetworkInfo ) {
                if( ! err ) {
                    const cntDiscoveredNew = get_s_chain_discovered_nodes_count( joSChainNetworkInfo );
                    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
                        const strDiscoveryStatus = cc.info( cntDiscoveredNew ) + cc.success( " nodes known" );
                        let strMessage =
                            cc.success( "S-Chain network was re-discovered, " ) + cc.info( cntDiscoveredNew ) +
                            cc.success( " of " ) + cc.info( cntNodes ) +
                            cc.success( " node(s) (" ) + strDiscoveryStatus + cc.success( ")" );
                        const cntStillUnknown = cntNodes - cntDiscoveredNew;
                        if( cntStillUnknown > 0 ) {
                            strMessage += cc.success( ", " ) +
                                cc.info( cntStillUnknown ) + cc.success( " of " ) + cc.info( cntNodes ) +
                                cc.success( " still unknown (" );
                            try {
                                const jarrNodes = joSChainNetworkInfo.network;
                                let cntBad = 0;
                                for( let i = 0; i < jarrNodes.length; ++i ) {
                                    const joNode = jarrNodes[i];
                                    try {
                                        if( ! ( joNode && "imaInfo" in joNode && typeof joNode.imaInfo === "object" &&
                                            "t" in joNode.imaInfo && typeof joNode.imaInfo.t === "number" ) ) {
                                            if( cntBad > 0 )
                                                strMessage += cc.success( ", " );
                                            const strNodeURL = imaUtils.compose_schain_node_url( joNode );
                                            const strNodeDescColorized =
                                                cc.notice( "#" ) + cc.info( i ) +
                                                cc.attention( "(" ) + cc.u( strNodeURL ) + cc.attention( ")" );
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
                log.write(
                    cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " S-Chain network re-discovery failed: " ) +
                    cc.warning( err ) + "\n"
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

async function discover_s_chain_network( fnAfter, isSilent, joPrevSChainNetworkInfo, nCountToWait ) {
    isSilent = isSilent || false;
    joPrevSChainNetworkInfo = joPrevSChainNetworkInfo || null;
    if( nCountToWait == null || nCountToWait == undefined || nCountToWait < 0 )
        nCountToWait = 0;
    const strLogPrefix = cc.info( "S-Chain network discovery:" ) + " ";
    fnAfter = fnAfter || function() {};
    let joSChainNetworkInfo = null;
    const rpcCallOpts = null;
    try {
        await rpcCall.create( imaState.strURL_s_chain, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                if( ! isSilent ) {
                    log.write(
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to (own) S-Chain " ) + cc.u( imaState.strURL_s_chain ) + cc.error( " failed: " ) +
                        cc.warning( err ) + "\n"
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
                    if( ! isSilent ) {
                        log.write(
                            strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " JSON RPC call to (own) S-Chain " ) + cc.u( imaState.strURL_s_chain ) + cc.error( " failed, error: " ) +
                            cc.warning( err ) + "\n"
                        );
                    }
                    fnAfter( err, null );
                    await joCall.disconnect();
                    return;
                }
                if( ( !isSilent ) && IMA.verbose_get() >= IMA.RV_VERBOSE.trace )
                    log.write( strLogPrefix + cc.debug( "OK, got (own) S-Chain network information: " ) + cc.j( joOut.result ) + "\n" );
                else if( ( !isSilent ) && IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "OK, got S-Chain " ) + cc.u( imaState.strURL_s_chain ) + cc.success( " network information." ) + "\n" );
                //
                let nCountReceivedImaDescriptions = 0;
                joSChainNetworkInfo = joOut.result;
                if( ! joSChainNetworkInfo ) {
                    const err2 = new Error( "Got wrong response, network information description was not detected" );
                    if( ! isSilent ) {
                        log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " Network was not detected via call to " ) + cc.u( imaState.strURL_s_chain ) + cc.error( ": " ) +
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
                    log.write( strLogPrefix + cc.debug( "Will gather details of " ) + cc.info( nCountToWait ) +
                        cc.debug( " of " ) + cc.info( cntNodes ) + cc.debug( " node(s)..." ) + "\n"
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
                        if( joPrevSChainNetworkInfo && "network" in joPrevSChainNetworkInfo && joPrevSChainNetworkInfo.network ) {
                            const joPrevNode = joPrevSChainNetworkInfo.network[nCurrentNodeIdx];
                            if( joPrevNode && "imaInfo" in joPrevNode && typeof joPrevNode.imaInfo === "object" &&
                                "t" in joPrevNode.imaInfo && typeof joPrevNode.imaInfo.t === "number"
                            ) {
                                joNode.imaInfo = JSON.parse( JSON.stringify( joPrevNode.imaInfo ) );
                                if( ( !isSilent ) && IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
                                    log.write(
                                        strLogPrefix + cc.info( "OK, in case of " ) + strNodeDescColorized +
                                        cc.info( " node " ) + cc.info( joNode.nodeID ) +
                                        cc.info( " will use previous discovery result." ) + "\n"
                                    );
                                }
                                continue; // skip this node discovery, enrich rest of nodes
                            }
                        }
                    } catch ( err ) {
                    }
                    const rpcCallOpts = null;
                    try {
                        await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
                            if( err ) {
                                if( ! isSilent ) {
                                    log.write(
                                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                        cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized + cc.error( " failed" ) +
                                        "\n"
                                    );
                                }
                                // fnAfter( err, null );
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
                                    if( ! isSilent ) {
                                        log.write(
                                            strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                            cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized + cc.error( " failed, error: " ) +
                                            cc.warning( err ) + "\n"
                                        );
                                    }
                                    // fnAfter( err, null );
                                    ++ cntFailed;
                                    return;
                                }
                                //if( (!isSilent) && IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                                //    log.write( strLogPrefix + cc.normal( "Node ") + cc.info(joNode.nodeID) + cc.normal(" IMA information: " ) + cc.j( joOut.result ) + "\n" );
                                joNode.imaInfo = joOut.result;
                                //joNode.joCall = joCall;
                                if( ( !isSilent ) && IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
                                    log.write(
                                        strLogPrefix + cc.success( "OK, got " ) + strNodeDescColorized +
                                        cc.success( " node " ) + cc.info( joNode.nodeID ) +
                                        cc.success( " IMA information(" ) + cc.info( nCountReceivedImaDescriptions ) + cc.success( " of " ) +
                                        cc.info( cntNodes ) + cc.success( ")." ) + "\n"
                                    );
                                }
                            } );
                        } );
                    } catch ( err ) {
                        if( ! isSilent ) {
                            log.write(
                                strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized + cc.error( " was not created: " ) +
                                cc.warning( err ) + "\n"
                            );
                        }
                        // fnAfter( err, null );
                        ++ cntFailed;
                        // return;
                    }
                }
                let nCountAvailable = cntNodes - cntFailed;
                if( ! isSilent ) {
                    log.write(
                        cc.debug( "Waiting for S-Chain nodes, total " ) + cc.warning( cntNodes ) +
                        cc.debug( ", available " ) + cc.warning( nCountAvailable ) +
                        cc.debug( ", expected at least " ) + cc.warning( nCountToWait ) +
                        "\n"
                    );
                }
                if( nCountAvailable < nCountToWait ) {
                    if( ! isSilent ) {
                        log.write(
                            strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " Not enough nodes available on S-Chain, total " ) + cc.warning( cntNodes ) +
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
                if( ( !isSilent ) && IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
                    log.write(
                        strLogPrefix + cc.debug( "Waiting for response from at least " ) + cc.info( nCountToWait ) +
                        cc.debug( " node(s)..." ) + "\n"
                    );
                }
                let nWaitAttempt = 0;
                const nWaitStepMilliseconds = 1000;
                let cntWaitAttempts = Math.floor( imaState.joSChainDiscovery.repeatIntervalMilliseconds / nWaitStepMilliseconds ) - 3;
                if( cntWaitAttempts < 1 )
                    cntWaitAttempts = 1;
                const iv = setInterval( function() {
                    nCountAvailable = cntNodes - cntFailed;
                    if( ! isSilent ) {
                        log.write(
                            cc.debug( "Waiting attempt " ) +
                            cc.info( nWaitAttempt ) + cc.debug( " of " ) + cc.info( cntWaitAttempts ) +
                            cc.debug( " for S-Chain nodes, total " ) + cc.info( cntNodes ) +
                            cc.debug( ", available " ) + cc.info( nCountAvailable ) +
                            cc.debug( ", expected at least " ) + cc.info( nCountToWait ) +
                            "\n"
                        );
                    }
                    if( ( !isSilent ) && IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
                        log.write(
                            strLogPrefix + cc.debug( "Have S-Chain description response about " ) +
                            cc.info( nCountReceivedImaDescriptions ) + cc.debug( " node(s)." ) + "\n"
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
                        const strErrorDescription = "S-Chain network discovery wait timeout, network will be re-discovered";
                        if( ! isSilent )
                            log.write( strLogPrefix + cc.error( "WARNING:" ) + " " + cc.warning( strErrorDescription ) + "\n" );
                        if( get_s_chain_discovered_nodes_count( joSChainNetworkInfo ) > 0 )
                            fnAfter( null, joSChainNetworkInfo );
                        else
                            fnAfter( new Error( strErrorDescription ), null );
                        return;
                    }
                    if( ! isSilent ) {
                        log.write(
                            strLogPrefix + cc.debug( " Waiting attempt " ) +
                            cc.info( nWaitAttempt ) + cc.debug( " of " ) + cc.info( cntWaitAttempts ) +
                            cc.debug( " for " ) + cc.notice( nCountToWait - nCountReceivedImaDescriptions ) +
                            cc.debug( " node answer(s)" ) +
                            "\n"
                        );
                    }
                }, nWaitStepMilliseconds );
                await joCall.disconnect();
            } );
        } );
    } catch ( err ) {
        if( ! isSilent ) {
            log.write(
                strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " JSON RPC call to S-Chain was not created: " ) +
                cc.warning( err ) + "\n"
            );
        }
        joSChainNetworkInfo = null;
        fnAfter( err, null );
    }
    return joSChainNetworkInfo;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let g_ws_server_monitoring = null;

if( imaState.nMonitoringPort > 0 ) {
    const strLogPrefix = cc.attention( "Monitoring:" ) + " ";
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.trace )
        log.write( strLogPrefix + cc.normal( "Will start monitoring WS server on port " ) + cc.info( imaState.nMonitoringPort ) + "\n" );
    g_ws_server_monitoring = new ws.Server( { port: 0 + imaState.nMonitoringPort } );
    g_ws_server_monitoring.on( "connection", function( ws_peer, req ) {
        const ip = req.socket.remoteAddress;
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.trace )
            log.write( strLogPrefix + cc.normal( "New connection from " ) + cc.info( ip ) + "\n" );
        ws_peer.on( "message", function( message ) {
            const joAnswer = {
                method: null,
                id: null,
                error: null
            };
            try {
                const joMessage = JSON.parse( message );
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.trace )
                    log.write( strLogPrefix + cc.sunny( "<<<" ) + " " + cc.normal( "message from " ) + cc.info( ip ) + cc.normal( ": " ) + cc.j( joMessage ) + "\n" );
                if( ! ( "method" in joMessage ) )
                    throw new Error( "\"method\" field was not specified" );
                joAnswer.method = joMessage.method;
                if( ! ( "id" in joMessage ) )
                    throw new Error( "\"id\" field was not specified" );
                joAnswer.id = joMessage.id;
                switch ( joMessage.method ) {
                case "echo":
                case "ping":
                    // call:   { "id": 1, "method": "echo" }
                    // answer: { "id": 1, "method": "echo", "error": null }
                    // call:   { "id": 1, "method": "ping" }
                    // answer: { "id": 1, "method": "ping", "error": null }
                    break;
                case "get_schain_network_info":
                    // call:   { "id": 1, "method": "get_schain_network_info" }
                    // answer: { "id": 1, "method": "get_schain_network_info", "error": null, "schain_network_info": ... }
                    joAnswer.schain_network_info = imaState.joSChainNetworkInfo;
                    break;
                case "get_runtime_params":
                    // call:   { "id": 1, "method": "get_runtime_params" }
                    // answer: { "id": 1, "method": "get_runtime_params", "error": null, "runtime_params": ... }
                    {
                        joAnswer.runtime_params = {};
                        const arr_runtime_param_names = [
                            "bNoWaitSChainStarted",
                            "nMaxWaitSChainAttempts",
                            "isPreventExitAfterLastAction",

                            "strURL_main_net",
                            "strURL_s_chain",
                            //"strURL_t_chain",

                            "strChainName_main_net",
                            "strChainName_s_chain",
                            //"strChainName_t_chain",
                            "cid_main_net",
                            "cid_s_chain",
                            //"cid_t_chain",

                            "nTransferBlockSizeM2S",
                            "nTransferBlockSizeS2M",
                            "nTransferBlockSizeS2S",
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

                            "optsPendingTxAnalysis",

                            "nMonitoringPort"
                        ];
                        for( const param_name of arr_runtime_param_names ) {
                            if( param_name in imaState )
                                joAnswer.runtime_params[param_name] = imaState[param_name];

                        }
                    } break;
                case "get_last_transfer_errors":
                    // call:   { "id": 1, "method": "get_last_transfer_errors" }
                    // answer: { "id": 1, "method": "get_last_transfer_errors", "isIncludeTextLog": true, "error": null, "last_transfer_errors": [ { ts: ..., textLog: ... }, ... ] }
                    joAnswer.last_transfer_errors = IMA.get_last_transfer_errors( ( ( "isIncludeTextLog" in joMessage ) && joMessage.isIncludeTextLog ) ? true : false );
                    joAnswer.last_error_categories = IMA.get_last_error_categories();
                    break;
                default:
                    throw new Error( "Unknown method name \"" + joMessage.method + "\" was specified" );
                } // switch( joMessage.method )
            } catch ( err ) {
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.error ) {
                    log.write( strLogPrefix +
                        cc.error( "Bad message from " ) + cc.info( ip ) + cc.error( ": " ) + cc.warning( message ) +
                        cc.error( ", error is: " ) + cc.warning( err ) + "\n"
                    );
                }
            }
            try {
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.trace )
                    log.write( strLogPrefix + cc.sunny( ">>>" ) + " " + cc.normal( "answer to " ) + cc.info( ip ) + cc.normal( ": " ) + cc.j( joAnswer ) + "\n" );
                ws_peer.send( JSON.stringify( joAnswer ) );
            } catch ( err ) {
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.error ) {
                    log.write( strLogPrefix +
                        cc.error( "Failed to sent answer to " ) + cc.info( ip ) +
                        cc.error( ", error is: " ) + cc.warning( err ) + "\n"
                    );
                }
            }
        } );
        // ws_peer.send( "something" );
    } );
} // if( imaState.nMonitoringPort > 0 )

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function do_the_job() {
    const strLogPrefix = cc.info( "Job 1:" ) + " ";
    let idxAction = 0;
    const cntActions = imaState.arrActions.length;
    let cntFalse = 0;
    let cntTrue = 0;
    for( idxAction = 0; idxAction < cntActions; ++idxAction ) {
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );

        const joAction = imaState.arrActions[idxAction];
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.notice( "Will execute action:" ) + " " + cc.info( joAction.name ) + cc.debug( " (" ) + cc.info( idxAction + 1 ) + cc.debug( " of " ) + cc.info( cntActions ) + cc.debug( ")" ) + "\n" );

        try {
            if( await joAction.fn() ) {
                ++cntTrue;
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "Succeeded action:" ) + " " + cc.info( joAction.name ) + "\n" );
            } else {
                ++cntFalse;
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.error )
                    log.write( strLogPrefix + cc.warning( "Failed action:" ) + " " + cc.info( joAction.name ) + "\n" );
            }
        } catch ( e ) {
            ++cntFalse;
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.fatal )
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR: Exception occurred while executing action:" ) + " " + cc.info( joAction.name ) + cc.error( ", error description: " ) + cc.warning( e ) + "\n" );
        }
    } // for( idxAction = 0; idxAction < cntActions; ++ idxAction )
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information ) {
        log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
        log.write( strLogPrefix + cc.info( "FINISH:" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntActions ) + cc.notice( " task(s) executed" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntTrue ) + cc.success( " task(s) succeeded" ) + "\n" );
        log.write( strLogPrefix + cc.info( cntFalse ) + cc.error( " task(s) failed" ) + "\n" );
        log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );
    }
    process.exitCode = ( cntFalse > 0 ) ? cntFalse : 0;
    if( ! IMA.isPreventExitAfterLastAction )
        process.exit( process.exitCode );
}

if( imaState.bSignMessages ) {
    if( imaState.strPathBlsGlue.length == 0 ) {
        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( " please specify --bls-glue parameter." ) + "\n" );
        process.exit( 164 );
    }
    if( imaState.strPathHashG1.length == 0 ) {
        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( " please specify --hash-g1 parameter." ) + "\n" );
        process.exit( 165 );
    }
    if( ! imaState.bNoWaitSChainStarted ) {
        const isSilent = imaState.joSChainDiscovery.isSilentReDiscovery;
        wait_until_s_chain_started().then( function() { // uses call to discover_s_chain_network()
            discover_s_chain_network( function( err, joSChainNetworkInfo ) {
                if( err )
                    process.exit( 166 ); // error information is printed by discover_s_chain_network()
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                    log.write( cc.success( "S-Chain network was discovered: " ) + cc.j( joSChainNetworkInfo ) + "\n" );
                imaState.joSChainNetworkInfo = joSChainNetworkInfo;
                continue_schain_discovery_in_background_if_needed( isSilent );
                do_the_job();
                return 0; // FINISH
            }, isSilent, imaState.joSChainNetworkInfo, -1 ).catch( ( err ) => {
                log.write(
                    cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " S-Chain network discovery failed: " ) +
                    cc.warning( err ) + "\n"
                );
            } );
        } );
    }
} else
    do_the_job();
    // process.exit( 0 ); // FINISH (skip exit here to avoid early termination while tasks ase still running)

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const g_registrationCostInfo = {
    mn: [],
    sc: []
};

async function register_step1( isPrintSummaryRegistrationCosts ) {
    const strLogPrefix = cc.info( "Reg 1:" ) + " ";
    let jarrReceipts = "true";
    const bRetVal = await IMA.check_is_registered_s_chain_in_deposit_boxes( // step 1
        imaState.w3_main_net,
        imaState.jo_linker,
        imaState.joAccount_main_net,
        imaState.strChainName_s_chain
    );
    if( !bRetVal ) {
        jarrReceipts = await IMA.register_s_chain_in_deposit_boxes( // step 1
            imaState.w3_main_net,
            // imaState.jo_deposit_box_eth, // only main net
            // imaState.jo_deposit_box_erc20, // only main net
            // imaState.isWithMetadata721 ? imaState.jo_deposit_box_erc721_with_metadata : imaState.jo_deposit_box_erc721, // only main net
            imaState.jo_linker,
            imaState.joAccount_main_net,
            imaState.jo_token_manager_eth, // only s-chain
            imaState.jo_token_manager_erc20, // only s-chain
            imaState.jo_token_manager_erc721, // only s-chain
            imaState.jo_token_manager_erc1155, // only s-chain
            imaState.jo_token_manager_erc721_with_metadata, // only s-chain
            imaState.jo_community_locker, // only s-chain
            imaState.jo_token_manager_linker, // only s-chain
            imaState.strChainName_s_chain,
            imaState.cid_main_net,
            imaState.tc_main_net //,
            // cntWaitAttempts,
            // nSleepMilliseconds
        );
    }
    const bSuccess = ( jarrReceipts != null && jarrReceipts.length > 0 ) ? true : false;
    if( bSuccess && ( !bRetVal ) )
        g_registrationCostInfo.mn = g_registrationCostInfo.mn.concat( g_registrationCostInfo.mn, jarrReceipts );
    if( isPrintSummaryRegistrationCosts )
        print_summary_registration_costs();
    if( !bSuccess ) {
        const nRetCode = 163;
        log.write( strLogPrefix + cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( " failed to register S-Chain in deposit box, will return code " ) + cc.warning( nRetCode ) + "\n" );
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
    const bRetVal = await IMA.check_is_registered_s_chain_in_deposit_boxes( // step 1
        imaState.w3_main_net,
        imaState.jo_linker,
        imaState.joAccount_main_net,
        imaState.strChainName_s_chain
    );
    return bRetVal;
}

function print_summary_registration_costs() {
    IMA.print_gas_usage_report_from_array( "Main Net REGISTRATION", g_registrationCostInfo.mn );
    IMA.print_gas_usage_report_from_array( "S-Chain REGISTRATION", g_registrationCostInfo.sc );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Run transfer loop
//

global.check_time_framing = function( d ) {
    try {
        if( imaState.nTimeFrameSeconds <= 0 || imaState.nNodesCount <= 1 )
            return true; // time framing is disabled

        if( d == null || d == undefined )
            d = new Date(); // now

        // const nUtcUnixTimeStamp = Math.floor( d.valueOf() / 1000 ); // Unix UTC timestamp, see https://stackoverflow.com/questions/9756120/how-do-i-get-a-utc-timestamp-in-javascript
        const nUtcUnixTimeStamp = Math.floor( ( d ).getTime() / 1000 ); // https://stackoverflow.com/questions/9756120/how-do-i-get-a-utc-timestamp-in-javascript

        const nSecondsRangeForAllSChains = imaState.nTimeFrameSeconds * imaState.nNodesCount;
        const nMod = Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
        const nActiveNodeFrameIndex = Math.floor( nMod / imaState.nTimeFrameSeconds );
        let bSkip = ( nActiveNodeFrameIndex != imaState.nNodeNumber ) ? true : false;
        let bInsideGap = false;
        //
        const nRangeStart = nUtcUnixTimeStamp - Math.floor( nUtcUnixTimeStamp % nSecondsRangeForAllSChains );
        const nFrameStart = nRangeStart + imaState.nNodeNumber * imaState.nTimeFrameSeconds;
        const nGapStart = nFrameStart + imaState.nTimeFrameSeconds - imaState.nNextFrameGap;
        if( !bSkip ) {
            if( nUtcUnixTimeStamp >= nGapStart ) {
                bSkip = true;
                bInsideGap = true;
            }
        }
        // if( IMA.verbose_get() >= IMA.RV_VERBOSE.trace ) {
        log.write(
            "\n" +
            cc.info( "Unix UTC time stamp" ) + cc.debug( "........" ) + cc.notice( nUtcUnixTimeStamp ) + "\n" +
            cc.info( "All Chains Range" ) + cc.debug( "..........." ) + cc.notice( nSecondsRangeForAllSChains ) + "\n" +
            cc.info( "S-Chain Range Mod" ) + cc.debug( ".........." ) + cc.notice( nMod ) + "\n" +
            cc.info( "Active Node Frame Index" ) + cc.debug( "...." ) + cc.notice( nActiveNodeFrameIndex ) + "\n" +
            cc.info( "Testing Frame Index" ) + cc.debug( "........" ) + cc.notice( imaState.nNodeNumber ) + "\n" +
            cc.info( "Is skip" ) + cc.debug( "...................." ) + cc.yn( bSkip ) + "\n" +
            cc.info( "Is inside gap" ) + cc.debug( ".............." ) + cc.yn( bInsideGap ) + "\n" +
            cc.info( "Range Start" ) + cc.debug( "................" ) + cc.notice( nRangeStart ) + "\n" +
            cc.info( "Frame Start" ) + cc.debug( "................" ) + cc.notice( nFrameStart ) + "\n" +
            cc.info( "Gap Start" ) + cc.debug( ".................." ) + cc.notice( nGapStart ) + "\n"
        );
        // }
        if( bSkip )
            return false;
    } catch ( e ) {
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.fatal )
            log.write( cc.fatal( "Exception in check_time_framing():" ) + cc.error( e ) + "\n" );
    }
    return true;
};

let g_is_single_transfer_loop = false;

async function single_transfer_loop() {
    const strLogPrefix = cc.attention( "Single Loop:" ) + " ";
    try {
        if( g_is_single_transfer_loop ) {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
                log.write( strLogPrefix + cc.warning( "Skipped due to other single transfer loop is in progress rignt now" ) + "\n" );
            return true;
        }
        g_is_single_transfer_loop = true;
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );

        if( ! global.check_time_framing() ) {
            g_is_single_transfer_loop = false;
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
                log.write( strLogPrefix + cc.warning( "Skipped due to time framing" ) + "\n" );
            IMA.save_transfer_success_all();
            return true;
        }

        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Will invoke Oracle gas price setup..." ) + "\n" );
        let b0 = true;
        if( IMA.getEnabledOracle() ) {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Will invoke Oracle gas price setup..." ) + "\n" );
            b0 = IMA.do_oracle_gas_price_setup(
                imaState.w3_main_net,
                imaState.w3_s_chain,
                imaState.tc_s_chain,
                imaState.jo_community_locker,
                imaState.joAccount_s_chain,
                imaState.cid_main_net,
                imaState.cid_s_chain,
                imaBLS.do_sign_u256, // fn_sign
                imaState.optsPendingTxAnalysis
            );
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Oracle gas price setup done: " ) + cc.tf( b0 ) + "\n" );
        }

        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Will invoke M2S transfer..." ) + "\n" );
        const b1 = await IMA.do_transfer( // main-net --> s-chain
            "M2S",
            //
            imaState.w3_main_net,
            imaState.jo_message_proxy_main_net,
            imaState.joAccount_main_net,
            imaState.w3_s_chain,
            imaState.jo_message_proxy_s_chain,
            //
            imaState.joAccount_s_chain,
            imaState.strChainName_main_net,
            imaState.strChainName_s_chain,
            imaState.cid_main_net,
            imaState.cid_s_chain,
            null, // imaState.jo_deposit_box - for logs validation on mainnet
            imaState.jo_token_manager_eth, // for logs validation on s-chain
            imaState.nTransferBlockSizeM2S,
            imaState.nMaxTransactionsM2S,
            imaState.nBlockAwaitDepthM2S,
            imaState.nBlockAgeM2S,
            imaBLS.do_sign_messages_m2s, // fn_sign_messages
            null, // joExtraSignOpts
            imaState.tc_s_chain,
            imaState.optsPendingTxAnalysis
        );
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "M2S transfer done: " ) + cc.tf( b1 ) + "\n" );

        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Will invoke S2M transfer..." ) + "\n" );
        const b2 = await IMA.do_transfer( // s-chain --> main-net
            "S2M",
            //
            imaState.w3_s_chain,
            imaState.jo_message_proxy_s_chain,
            imaState.joAccount_s_chain,
            imaState.w3_main_net,
            imaState.jo_message_proxy_main_net,
            //
            imaState.joAccount_main_net,
            imaState.strChainName_s_chain,
            imaState.strChainName_main_net,
            imaState.cid_s_chain,
            imaState.cid_main_net,
            imaState.jo_deposit_box_eth, // for logs validation on mainnet
            null, // imaState.jo_token_manager, // for logs validation on s-chain
            imaState.nTransferBlockSizeS2M,
            imaState.nMaxTransactionsS2M,
            imaState.nBlockAwaitDepthS2M,
            imaState.nBlockAgeS2M,
            imaBLS.do_sign_messages_s2m, // fn_sign_messages
            null, // joExtraSignOpts
            imaState.tc_main_net,
            imaState.optsPendingTxAnalysis
        );
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "S2M transfer done: " ) + cc.tf( b2 ) + "\n" );

        let b3 = true;
        if( imaState.s2s_opts.isEnabled ) {
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "Will invoke all S2S transfers..." ) + "\n" );
            b3 = await IMA.do_s2s_all( // s-chain --> s-chain
                imaState,
                skale_observer,
                imaState.w3_s_chain,
                imaState.jo_message_proxy_s_chain,
                //
                imaState.joAccount_s_chain,
                imaState.strChainName_s_chain,
                imaState.cid_s_chain,
                imaState.jo_token_manager_eth, // for logs validation on s-chain
                imaState.nTransferBlockSizeM2S,
                imaState.nMaxTransactionsM2S,
                imaState.nBlockAwaitDepthM2S,
                imaState.nBlockAgeM2S,
                imaBLS.do_sign_messages_s2s, // fn_sign_messages
                imaState.tc_s_chain,
                imaState.optsPendingTxAnalysis
            );
            if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                log.write( strLogPrefix + cc.debug( "All S2S transfers done: " ) + cc.tf( b3 ) + "\n" );
        }

        g_is_single_transfer_loop = false;
        const bResult = b0 && b1 && b2 && b3;
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
            log.write( strLogPrefix + cc.debug( "Completed: " ) + cc.tf( bResult ) + "\n" );
        return bResult;
    } catch ( err ) {
        log.write( strLogPrefix + cc.fatal( "Exception:" ) + + cc.error( err.toString() ) + "\n" );
    }
    g_is_single_transfer_loop = false;
    return false;
}
async function single_transfer_loop_with_repeat() {
    await single_transfer_loop();
    setTimeout( single_transfer_loop_with_repeat, imaState.nLoopPeriodSeconds * 1000 );
};
async function run_transfer_loop( isDelayFirstRun ) {
    isDelayFirstRun = owaspUtils.toBoolean( isDelayFirstRun );
    if( isDelayFirstRun )
        setTimeout( single_transfer_loop_with_repeat, imaState.nLoopPeriodSeconds * 1000 );
    else
        await single_transfer_loop_with_repeat();
    return true;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

async function wait_until_s_chain_started() {
    log.write( cc.debug( "Checking " ) + cc.info( "S-Chain" ) + cc.debug( " is accessible and sane..." ) + "\n" );
    if( ( !imaState.strURL_s_chain ) || imaState.strURL_s_chain.length === 0 ) {
        log.write( cc.warning( "Skipped, " ) + cc.info( "S-Chain" ) + cc.warning( " URL was not provided." ) + "\n" );
        return;
    }
    let bSuccess = false;
    let idxWaitAttempt = 0;
    for( ; !bSuccess; ) {
        try {
            const joSChainNetworkInfo = await discover_s_chain_network( function( err, joSChainNetworkInfo ) {
                if( ! err )
                    bSuccess = true;
            }, true, null, -1 ).catch( ( err ) => {
                log.write(
                    cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " S-Chain network discovery failed: " ) +
                    cc.warning( err ) + "\n"
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
            log.write( cc.warning( "Incomplete, " ) + cc.info( "S-Chain" ) + cc.warning( " sanity check failed after " ) + cc.info( idxWaitAttempt ) + cc.warning( " attempts." ) + "\n" );
            return;
        }
        await IMA.sleep( 1000 );
    }
    log.write( cc.success( "Done, " ) + cc.info( "S-Chain" ) + cc.success( " is accessible and sane." ) + "\n" );
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
