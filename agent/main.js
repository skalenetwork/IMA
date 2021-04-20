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
global.IMA = require( "../npms/skale-ima" );
global.w3mod = IMA.w3mod;
global.ethereumjs_tx = IMA.ethereumjs_tx;
global.ethereumjs_wallet = IMA.ethereumjs_wallet;
global.ethereumjs_util = IMA.ethereumjs_util;
global.compose_tx_instance = IMA.compose_tx_instance;
global.owaspUtils = IMA.owaspUtils;
global.imaUtils = require( "./utils.js" );
IMA.verbose_set( IMA.verbose_parse( "info" ) );
global.log = global.imaUtils.log;
global.cc = global.imaUtils.cc;
global.imaCLI = require( "./cli.js" );
global.imaBLS = require( "./bls.js" );
global.rpcCall = require( "./rpc-call.js" );
global.rpcCall.init();

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

global.imaState = {
    "strLogFilePath": "",
    "nLogMaxSizeBeforeRotation": -1,
    "nLogMaxFilesCount": -1,

    "bIsNeededCommonInit": true,
    "bSignMessages": false, // use BLS message signing, turned on with --sign-messages
    "joSChainNetworkInfo": null, // scanned S-Chain network description
    "strPathBlsGlue": "", // path to bls_glue app, must have if --sign-messages specified
    "strPathHashG1": "", // path to hash_g1 app, must have if --sign-messages specified
    "strPathBlsVerify": "", // path to verify_bls app, optional, if specified then we will verify gathered BLS signature

    "joTrufflePublishResult_main_net": { },
    "joTrufflePublishResult_s_chain": { },

    "joErc20_main_net": null,
    "joErc20_s_chain": null,

    "strAddrErc20_explicit": "",
    "strCoinNameErc20_main_net": "", // in-JSON coin name
    "strCoinNameErc20_s_chain": "", // in-JSON coin name

    "joErc721_main_net": null,
    "joErc721_s_chain": null,
    "strAddrErc721_explicit": "",
    "strCoinNameErc721_main_net": "", // in-JSON coin name
    "strCoinNameErc721_s_chain": "", // in-JSON coin name

    "strPathAbiJson_main_net": imaUtils.normalizePath( "../proxy/data/proxyMainnet.json" ), // "./abi_main_net.json"
    "strPathAbiJson_s_chain": imaUtils.normalizePath( "../proxy/data/proxySchain.json" ), // "./abi_s_chain.json"

    "bShowConfigMode": false, // true - just show configuration values and exit

    "bNoWaitSChainStarted": false,
    "nMaxWaitSChainAttempts": 20,
    "isPreventExitAfterLastAction": false,

    "strURL_main_net": owaspUtils.toStringURL( process.env.URL_W3_ETHEREUM ), // example: "http://127.0.0.1:8545"
    "strURL_s_chain": owaspUtils.toStringURL( process.env.URL_W3_S_CHAIN ), // example: "http://127.0.0.1:2231"

    "strChainID_main_net": ( process.env.CHAIN_NAME_ETHEREUM || "Mainnet" ).toString().trim(),
    "strChainID_s_chain": ( process.env.CHAIN_NAME_SCHAIN || "id-S-chain" ).toString().trim(),
    "cid_main_net": owaspUtils.toInteger( process.env.CID_ETHEREUM ) || -4,
    "cid_s_chain": owaspUtils.toInteger( process.env.CID_SCHAIN ) || -4,

    "strPathJsonErc20_main_net": "",
    "strPathJsonErc20_s_chain": "",

    "strPathJsonErc721_main_net": "",
    "strPathJsonErc721_s_chain": "",

    "nAmountOfWei": 0,
    "nAmountOfToken": 0,
    "idToken": 0,

    "nTransferBlockSizeM2S": 4, // 10
    "nTransferBlockSizeS2M": 4, // 10
    "nMaxTransactionsM2S": 0,
    "nMaxTransactionsS2M": 0,

    "nBlockAwaitDepthM2S": 0,
    "nBlockAwaitDepthS2M": 0,
    "nBlockAgeM2S": 0,
    "nBlockAgeS2M": 0,

    "nLoopPeriodSeconds": 10,

    "nNodeNumber": 0, // S-Chain node number(zero based)
    "nNodesCount": 1,
    "nTimeFrameSeconds": 0, // 0-disable, 60-recommended
    "nNextFrameGap": 10,

    //
    "w3_main_net": null,
    "w3_s_chain": null,

    "jo_deposit_box_eth": null, // only main net
    "jo_deposit_box_erc20": null, // only main net
    "jo_deposit_box_erc721": null, // only main net
    "jo_imalinker": null, // only main net
    "jo_token_manager": null, // only s-chain
    "jo_message_proxy_main_net": null,
    "jo_message_proxy_s_chain": null,
    "jo_lock_and_data_s_chain": null,
    "eth_erc20": null, // only s-chain
    // "eth_erc721": null, // only s-chain

    //
    // example:
    //
    // "joAccount_main_net": { "name": "g3",    "privateKey": "<YOUR_PRIVATE_KEY_HERE>", "address": IMA.owaspUtils.fn_address_impl_ },
    // "joAccount_s_chain ": { "name": "Bob",   "privateKey": "<YOUR_PRIVATE_KEY_HERE>", "address": IMA.owaspUtils.fn_address_impl_ },
    //
    //
    // example of empty values to fill from command line arguments:
    //
    // "joAccount_main_net": { "privateKey": "", "address": IMA.owaspUtils.fn_address_impl_ },
    // "joAccount_s_chain": { "privateKey": "", "address": IMA.owaspUtils.fn_address_impl_ },
    //
    "joAccount_main_net": {
        "privateKey": owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_ETHEREUM ),
        "address": IMA.owaspUtils.fn_address_impl_,
        "strTransactionManagerURL": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_URL_ETHEREUM ),
        "strSgxURL": owaspUtils.toStringURL( process.env.SGX_URL_ETHEREUM ),
        "strSgxKeyName": owaspUtils.toStringURL( process.env.SGX_KEY_ETHEREUM ),
        "strPathSslKey": ( process.env.SGX_SSL_KEY_FILE_ETHEREUM || "" ).toString().trim(),
        "strPathSslCert": ( process.env.SGX_SSL_CERT_FILE_ETHEREUM || "" ).toString().trim()
    },
    "joAccount_s_chain": {
        "privateKey": owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_SCHAIN ),
        "address": IMA.owaspUtils.fn_address_impl_,
        "strTransactionManagerURL": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_URL_S_CHAIN ),
        "strSgxURL": owaspUtils.toStringURL( process.env.SGX_URL_S_CHAIN ),
        "strSgxKeyName": owaspUtils.toStringURL( process.env.SGX_KEY_S_CHAIN ),
        "strPathSslKey": ( process.env.SGX_SSL_KEY_FILE_S_CHAIN || "" ).toString().trim(),
        "strPathSslCert": ( process.env.SGX_SSL_CERT_FILE_S_CHAIN || "" ).toString().trim()
    },

    //
    "tc_main_net": IMA.tc_main_net,
    "tc_s_chain": IMA.tc_s_chain,
    //

    "doEnableDryRun": function( isEnable ) { return IMA.dry_run_enable( isEnable ); },
    "doIgnoreDryRun": function( isIgnore ) { return IMA.dry_run_ignore( isIgnore ); },

    optsPendingTxAnalysis: {
        isEnabled: false, // disable bv default
        nTimeoutSecondsBeforeSecondAttempt: 30, // 0 - disable 2nd attempt
        isIgnore: false, // ignore PTX result
        isIgnore2: true // ignore secondary PTX result
    },

    "arrActions": [] // array of actions to run
};

const tmp_address_MN_from_env = owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_ETHEREUM );
const tmp_address_SC_from_env = owaspUtils.toEthPrivateKey( process.env.ACCOUNT_FOR_SCHAIN );
if( tmp_address_MN_from_env && typeof tmp_address_MN_from_env == "string" && tmp_address_MN_from_env.length > 0 )
    imaState.joAccount_main_net.address_ = "" + tmp_address_MN_from_env;

if( tmp_address_SC_from_env && typeof tmp_address_SC_from_env == "string" && tmp_address_SC_from_env.length > 0 )
    imaState.joAccount_s_chain.address_ = "" + tmp_address_SC_from_env;

imaBLS.init();

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
    "register2": function() {
        imaState.arrActions.push( {
            "name": "Registration step 2, register Main-net deposit box on S-Chain",
            "fn": async function() {
                if( ! imaState.bNoWaitSChainStarted )
                    await wait_until_s_chain_started(); // register_step2
                return await register_step2( true );
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
                process.exit( nExitCode ); // 150
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
                process.exit( nExitCode ); // 152
            }
        } );
    },
    "check-registration2": function() {
        imaState.arrActions.push( {
            "name": "Registration status check step 2, register Main-net deposit box on S-Chain",
            "fn": async function() {
                if( ! imaState.bNoWaitSChainStarted )
                    await wait_until_s_chain_started(); // check_registration_step2
                const b = await check_registration_step2();
                const nExitCode = b ? 0 : 153; // 0 - OKay - registered; non-zero -  not registered or error
                log.write( cc.notice( "Exiting with code " ) + cc.info( nExitCode ) + "\n" );
                process.exit( nExitCode ); // 153
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
                        imaState.jo_deposit_box_erc721, // only main net
                        imaState.jo_message_proxy_main_net, // for checking logs
                        imaState.strChainID_s_chain,
                        imaState.idToken, // which ERC721 token id to send
                        imaState.nAmountOfWei, // how much WEI money to send
                        imaState.jo_token_manager, // only s-chain
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
                        imaState.strChainID_s_chain,
                        imaState.nAmountOfToken, // how much ERC20 tokens to send
                        imaState.nAmountOfWei, // how much WEI money to send
                        imaState.jo_token_manager, // only s-chain
                        imaState.strCoinNameErc20_main_net,
                        imaState.joErc20_main_net,
                        imaState.strCoinNameErc20_s_chain,
                        imaState.joErc20_s_chain,
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
                    imaState.strChainID_s_chain,
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
                        imaState.jo_token_manager, // only s-chain
                        imaState.jo_lock_and_data_s_chain,
                        imaState.jo_message_proxy_s_chain, // for checking logs
                        imaState.jo_deposit_box_erc721, // only main net
                        imaState.idToken, // which ERC721 token id to send
                        imaState.nAmountOfWei, // how much WEI money to send
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
                        imaState.jo_token_manager, // only s-chain
                        imaState.jo_lock_and_data_s_chain,
                        imaState.jo_message_proxy_s_chain, // for checking logs
                        imaState.jo_deposit_box_erc20, // only main net
                        imaState.nAmountOfToken, // how ERC20 tokens money to send
                        imaState.nAmountOfWei, // how much WEI money to send
                        imaState.strCoinNameErc20_main_net,
                        imaState.joErc20_main_net,
                        imaState.strCoinNameErc20_s_chain,
                        imaState.joErc20_s_chain,
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
                    imaState.jo_token_manager, // only s-chain
                    imaState.jo_lock_and_data_s_chain,
                    imaState.jo_message_proxy_s_chain, // for checking logs
                    imaState.nAmountOfWei, // how much WEI money to send
                    imaState.tc_s_chain
                );
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
                    //
                    imaState.w3_main_net,
                    imaState.jo_message_proxy_main_net,
                    imaState.joAccount_main_net,
                    imaState.w3_s_chain,
                    imaState.jo_message_proxy_s_chain,
                    //
                    imaState.joAccount_s_chain,
                    imaState.strChainID_main_net,
                    imaState.strChainID_s_chain,
                    imaState.cid_main_net,
                    imaState.cid_s_chain,
                    null, // imaState.jo_deposit_box, // for logs validation on mainnet
                    imaState.jo_token_manager, // for logs validation on s-chain
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
    "s2m-transfer": function() {
        imaState.arrActions.push( {
            "name": "single S->M transfer loop",
            "fn": async function() {
                if( ! imaState.bNoWaitSChainStarted )
                    await wait_until_s_chain_started(); // s-chain --> main-net transfer
                return await IMA.do_transfer( // s-chain --> main-net
                    //
                    imaState.w3_s_chain,
                    imaState.jo_message_proxy_s_chain,
                    imaState.joAccount_s_chain,
                    imaState.w3_main_net,
                    imaState.jo_message_proxy_main_net,
                    //
                    imaState.joAccount_main_net,
                    imaState.strChainID_s_chain,
                    imaState.strChainID_main_net,
                    imaState.cid_s_chain,
                    imaState.cid_main_net,
                    imaState.jo_deposit_box_eth, // for logs validation on mainnet
                    null, // imaState.jo_token_manager - for logs validation on s-chain
                    imaState.nTransferBlockSizeS2M,
                    imaState.nMaxTransactionsS2M,
                    imaState.nBlockAwaitDepthS2M,
                    imaState.nBlockAgeS2M,
                    imaBLS.do_sign_messages_s2m, // fn_sign_messages
                    imaState.tc_main_net,
                    imaState.optsPendingTxAnalysis
                );
            }
        } );
    },
    "transfer": function() {
        imaState.arrActions.push( {
            "name": "Single M<->S transfer loop iteration",
            "fn": async function() {
                if( ! imaState.bNoWaitSChainStarted )
                    await wait_until_s_chain_started(); // single_transfer_loop
                return await single_transfer_loop();
            }
        } );
    },
    "loop": function() {
        imaState.arrActions.push( {
            "name": "M<->S transfer loop",
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
                if( !await check_registration_step2() ) {
                    if( !await register_step2( false ) )
                        return false;
                    isPrintSummaryRegistrationCosts = true;
                }
                if( isPrintSummaryRegistrationCosts )
                    print_summary_registration_costs();
                return await run_transfer_loop();
            }
        } );
    },
    "browse-s-chain": function() {
        imaState.bIsNeededCommonInit = false;
        imaState.arrActions.push( {
            "name": "Brows S-Chain network",
            "fn": async function() {
                const strLogPrefix = cc.info( "S Browse:" ) + " ";
                if( imaState.strURL_s_chain.length === 0 ) {
                    console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " missing S-Chain URL, please specify " ) + cc.info( "url-s-chain" ) );
                    process.exit( 154 );
                }
                log.write( strLogPrefix + cc.normal( "Downloading S-Chain network information " ) + cc.normal( "..." ) + "\n" ); // just print value
                //
                const rpcCallOpts = null;
                await rpcCall.create( imaState.strURL_s_chain, rpcCallOpts, async function( joCall, err ) {
                    if( err ) {
                        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed" ) );
                        process.exit( 155 );
                    }
                    await joCall.call( {
                        "method": "skale_nodesRpcInfo",
                        "params": { }
                    }, async function( joIn, joOut, err ) {
                        if( err ) {
                            console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) );
                            process.exit( 156 );
                        }
                        log.write( strLogPrefix + cc.normal( "S-Chain network information: " ) + cc.j( joOut.result ) + "\n" );
                        let nCountReceivedImaDescriptions = 0;
                        const jarrNodes = joOut.result.network;
                        for( let i = 0; i < jarrNodes.length; ++ i ) {
                            const joNode = jarrNodes[i];
                            const strNodeURL = imaUtils.compose_schain_node_url( joNode );
                            const rpcCallOpts = null;
                            await rpcCall.create( strNodeURL, rpcCallOpts, async function( joCall, err ) {
                                if( err ) {
                                    console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed" ) );
                                    process.exit( 157 );
                                }
                                await joCall.call( {
                                    "method": "skale_imaInfo",
                                    "params": { }
                                }, function( joIn, joOut, err ) {
                                    ++ nCountReceivedImaDescriptions;
                                    if( err ) {
                                        console.log( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " JSON RPC call to S-Chain failed, error: " ) + cc.warning( err ) );
                                        process.exit( 158 );
                                    }
                                    log.write( strLogPrefix + cc.normal( "Node " ) + cc.info( joNode.nodeID ) + cc.normal( " IMA information: " ) + cc.j( joOut.result ) + "\n" );
                                    //process.exit( 0 );
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
                    } );
                } );
                return true;
            }
        } );
    }
} );

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

async function discover_s_chain_network( fnAfter, isSilent ) {
    isSilent = isSilent || false;
    const strLogPrefix = cc.info( "S net discover:" ) + " ";
    fnAfter = fnAfter || function() {};
    let joSChainNetworkInfo = null;
    const rpcCallOpts = null;
    try {
        await rpcCall.create( imaState.strURL_s_chain, rpcCallOpts, async function( joCall, err ) {
            if( err ) {
                if( ! isSilent ) {
                    log.write(
                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to S-Chain " ) + cc.u( imaState.strURL_s_chain ) + cc.error( " failed: " ) +
                        cc.warning( err ) + "\n"
                    );
                }
                fnAfter( err, null );
                return;
            }
            await joCall.call( {
                "method": "skale_nodesRpcInfo",
                "params": { }
            }, async function( joIn, joOut, err ) {
                if( err ) {
                    if( ! isSilent ) {
                        log.write(
                            strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " JSON RPC call to S-Chain " ) + cc.u( imaState.strURL_s_chain ) + cc.error( " failed, error: " ) +
                            cc.warning( err ) + "\n"
                        );
                    }
                    fnAfter( err, null );
                    return;
                }
                if( ( !isSilent ) && IMA.verbose_get() >= IMA.RV_VERBOSE.trace )
                    log.write( strLogPrefix + cc.normal( "OK, got S-Chain network information: " ) + cc.j( joOut.result ) + "\n" );
                else if( ( !isSilent ) && IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                    log.write( strLogPrefix + cc.success( "OK, got S-Chain " ) + cc.u( imaState.strURL_s_chain ) + cc.success( " network information." ) + "\n" );

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
                    return;
                }
                const jarrNodes = joSChainNetworkInfo.network;
                const cntNodes = jarrNodes.length;
                let cntFailed = 0;
                for( let i = 0; i < cntNodes; ++ i ) {
                    const joNode = jarrNodes[i];
                    const strNodeURL = imaUtils.compose_schain_node_url( joNode );
                    const rpcCallOpts = null;
                    try {
                        await rpcCall.create( strNodeURL, rpcCallOpts, function( joCall, err ) {
                            if( err ) {
                                if( ! isSilent ) {
                                    log.write(
                                        strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                        cc.error( " JSON RPC call to S-Chain node " ) + cc.u( strNodeURL ) + cc.error( " failed" ) +
                                        "\n"
                                    );
                                }
                                // fnAfter( err, null );
                                ++ cntFailed;
                                return;
                            }
                            joCall.call( {
                                "method": "skale_imaInfo",
                                "params": { }
                            }, function( joIn, joOut, err ) {
                                ++ nCountReceivedImaDescriptions;
                                if( err ) {
                                    if( ! isSilent ) {
                                        log.write(
                                            strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                            cc.error( " JSON RPC call to S-Chain node " ) + cc.u( strNodeURL ) + cc.error( " failed, error: " ) +
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
                                        strLogPrefix + cc.success( "OK, got  " ) + cc.u( strNodeURL ) +
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
                                cc.error( " JSON RPC call to S-Chain node " ) + cc.u( strNodeURL ) + cc.error( " was not created: " ) +
                                cc.warning( err ) + "\n"
                            );
                        }
                        // fnAfter( err, null );
                        ++ cntFailed;
                        // return;
                    }
                }
                let nCountAvailable = cntNodes - cntFailed;
                let nCountToWait = 0 + cntNodes;
                if( nCountToWait > 2 )
                    nCountToWait = Math.ceil( nCountToWait * 2 / 3 );
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
                const cntWaitAttempts = 300;
                const iv = setInterval( function() {
                    nCountAvailable = cntNodes - cntFailed;
                    if( ! isSilent ) {
                        log.write(
                            cc.debug( "Waiting for S-Chain nodes, total " ) + cc.warning( cntNodes ) +
                            cc.debug( ", available " ) + cc.warning( nCountAvailable ) +
                            cc.debug( ", expected at least " ) + cc.warning( nCountToWait ) +
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
                    if( nWaitAttempt > cntWaitAttempts ) {
                        if( ! isSilent ) {
                            log.write(
                                strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                cc.error( " S-Chain network discovery wait timeout" ) +
                                "\n"
                            );
                        }
                        const err = new Error(
                            "S-Chain network discovery wait timeout"
                        );
                        fnAfter( err, null );
                        return;
                    }
                    if( ! isSilent ) {
                        log.write(
                            strLogPrefix + cc.debug( " Waiting for " ) +
                            cc.notice( nCountToWait - nCountReceivedImaDescriptions ) +
                            cc.debug( " node answer(s)" ) +
                            "\n"
                        );
                    }
                }, 1000 );
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
//
// register S-Chain 1 on main net
//
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
        process.exit( 159 );
    }
    if( imaState.strPathHashG1.length == 0 ) {
        log.write( cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( " please specify --hash-g1 parameter." ) + "\n" );
        process.exit( 160 );
    }
    if( ! imaState.bNoWaitSChainStarted ) {
        wait_until_s_chain_started().then( function() { // discover_s_chain_network
            discover_s_chain_network( function( err, joSChainNetworkInfo ) {
                if( err )
                    process.exit( 161 ); // error information is printed by discover_s_chain_network()
                if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
                    log.write( cc.success( "S-Chain network was discovered: " ) + cc.j( joSChainNetworkInfo ) + "\n" );
                imaState.joSChainNetworkInfo = joSChainNetworkInfo;
                do_the_job();
                return 0; // FINISH
            }, false );
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
        imaState.jo_imalinker,
        imaState.joAccount_main_net,
        imaState.strChainID_s_chain
    );
    if( !bRetVal ) {
        jarrReceipts = await IMA.register_s_chain_in_deposit_boxes( // step 1
            imaState.w3_main_net,
            // imaState.jo_deposit_box_eth, // only main net
            // imaState.jo_deposit_box_erc20, // only main net
            // imaState.jo_deposit_box_erc721, // only main net
            imaState.jo_imalinker,
            imaState.joAccount_main_net,
            imaState.jo_token_manager, // only s-chain
            imaState.strChainID_s_chain,
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
        process.exit( nRetCode ); // 163
    }
    return true;
}
async function register_step2( isPrintSummaryRegistrationCosts ) {
    const strLogPrefix = cc.info( "Reg 2:" ) + " ";
    let jarrReceipts2A = "true";
    const bRetVal2A = await IMA.check_is_registered_main_net_depositBox_on_s_chain( // step 2A
        imaState.w3_s_chain,
        imaState.jo_deposit_box_eth, // only main net
        imaState.jo_deposit_box_erc20, // only main net
        imaState.jo_deposit_box_erc721, // only main net
        imaState.jo_lock_and_data_s_chain,
        imaState.joAccount_s_chain
    );
    //console.log( "----------- bRetVal2A is", bRetVal2A );
    if( !bRetVal2A ) {
        jarrReceipts2A = await IMA.register_main_net_depositBox_on_s_chain( // step 2A
            imaState.w3_s_chain,
            // imaState.jo_token_manager - only s-chain
            imaState.jo_deposit_box_eth, // only main net
            imaState.jo_deposit_box_erc20, // only main net
            imaState.jo_deposit_box_erc721, // only main net
            imaState.jo_lock_and_data_s_chain,
            imaState.joAccount_s_chain,
            imaState.cid_s_chain,
            imaState.tc_s_chain
        );
    }
    //console.log( "----------- jarrReceipts2A is", jarrReceipts2A );
    const bSuccess2A = ( jarrReceipts2A != null && jarrReceipts2A.length > 0 ) ? true : false;
    //console.log( "----------- bSuccess2A is", bSuccess2A );
    if( bSuccess2A && ( !bRetVal2A ) )
        g_registrationCostInfo.sc = g_registrationCostInfo.sc.concat( g_registrationCostInfo.sc, jarrReceipts2A );
    let jarrReceipts2B = "true";
    const bRetVal2B = await IMA.check_is_registered_main_net_on_s_chain( // step 2B
        imaState.w3_s_chain,
        imaState.jo_message_proxy_s_chain,
        imaState.joAccount_s_chain,
        imaState.strChainID_main_net
    );
    //console.log( "----------- bRetVal2B is", bRetVal2B );
    if( !bRetVal2B ) {
        jarrReceipts2B = await IMA.register_main_net_on_s_chain( // step 2B
            imaState.w3_s_chain,
            imaState.jo_message_proxy_s_chain,
            imaState.joAccount_s_chain,
            imaState.strChainID_main_net,
            imaState.cid_s_chain,
            imaState.tc_s_chain
        );
    }
    //console.log( "----------- jarrReceipts2B is", jarrReceipts2B );
    const bSuccess2B = ( jarrReceipts2B != null && jarrReceipts2B.length > 0 ) ? true : false;
    //console.log( "----------- bSuccess2B is", bSuccess2B );
    if( bSuccess2B && ( !bRetVal2B ) )
        g_registrationCostInfo.sc = g_registrationCostInfo.sc.concat( g_registrationCostInfo.sc, jarrReceipts2B );
    const bSuccess = ( bSuccess2A && bSuccess2B ) ? true : false;
    if( isPrintSummaryRegistrationCosts )
        print_summary_registration_costs();
    if( !bSuccess ) {
        const nRetCode = 164;
        log.write( strLogPrefix + cc.fatal( "FATAL, CRITICAL ERROR:" ) + cc.error( " failed to register Main-net deposit box on S-Chain, will return code " ) + cc.warning( nRetCode ) + "\n" );
        process.exit( nRetCode ); // 164
    }
    return true;
}
async function register_all( isPrintSummaryRegistrationCosts ) {
    if( !await register_step1( false ) )
        return false;
    if( !await register_step2( false ) )
        return false;
    if( isPrintSummaryRegistrationCosts )
        print_summary_registration_costs();
    return true;
}

async function check_registration_all() {
    const b1 = await check_registration_step1();
    const b2 = await check_registration_step2();
    if( !( b1 && b2 ) )
        return false;

    return true;
}
async function check_registration_step1() {
    const bRetVal = await IMA.check_is_registered_s_chain_in_deposit_boxes( // step 1
        imaState.w3_main_net,
        imaState.jo_imalinker,
        imaState.joAccount_main_net,
        imaState.strChainID_s_chain
    );
    return bRetVal;
}
async function check_registration_step2() {
    const bRetVal2A = await IMA.check_is_registered_main_net_depositBox_on_s_chain( // step 2A
        imaState.w3_s_chain,
        imaState.jo_deposit_box_eth, // only main net
        imaState.jo_deposit_box_erc20, // only main net
        imaState.jo_deposit_box_erc721, // only main net
        imaState.jo_lock_and_data_s_chain,
        imaState.joAccount_s_chain
    );
    const bRetVal2B = await IMA.check_is_registered_main_net_on_s_chain( // step 2B
        imaState.w3_s_chain,
        imaState.jo_message_proxy_s_chain,
        imaState.joAccount_s_chain,
        imaState.strChainID_main_net
    );
    const bRetVal = ( bRetVal2A && bRetVal2B ) ? true : false;
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

async function single_transfer_loop() {
    const strLogPrefix = cc.attention( "Single Loop:" ) + " ";
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
        log.write( strLogPrefix + cc.debug( IMA.longSeparator ) + "\n" );

    if( ! global.check_time_framing() ) {
        if( IMA.verbose_get() >= IMA.RV_VERBOSE.debug )
            log.write( strLogPrefix + cc.warning( "Skipped due to time framing" ) + "\n" );

        return true;
    }
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
        log.write( strLogPrefix + cc.debug( "Will invoke M2S transfer..." ) + "\n" );

    const b1 = await IMA.do_transfer( // main-net --> s-chain
        //
        imaState.w3_main_net,
        imaState.jo_message_proxy_main_net,
        imaState.joAccount_main_net,
        imaState.w3_s_chain,
        imaState.jo_message_proxy_s_chain,
        //
        imaState.joAccount_s_chain,
        imaState.strChainID_main_net,
        imaState.strChainID_s_chain,
        imaState.cid_main_net,
        imaState.cid_s_chain,
        null, // imaState.jo_deposit_box - for logs validation on mainnet
        imaState.jo_token_manager, // for logs validation on s-chain
        imaState.nTransferBlockSizeM2S,
        imaState.nMaxTransactionsM2S,
        imaState.nBlockAwaitDepthM2S,
        imaState.nBlockAgeM2S,
        imaBLS.do_sign_messages_m2s, // fn_sign_messages
        imaState.tc_s_chain,
        imaState.optsPendingTxAnalysis
    );
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
        log.write( strLogPrefix + cc.debug( "M2S transfer done: " ) + cc.tf( b1 ) + "\n" );

    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
        log.write( strLogPrefix + cc.debug( "Will invoke S2M transfer..." ) + "\n" );

    const b2 = await IMA.do_transfer( // s-chain --> main-net
        //
        imaState.w3_s_chain,
        imaState.jo_message_proxy_s_chain,
        imaState.joAccount_s_chain,
        imaState.w3_main_net,
        imaState.jo_message_proxy_main_net,
        //
        imaState.joAccount_main_net,
        imaState.strChainID_s_chain,
        imaState.strChainID_main_net,
        imaState.cid_s_chain,
        imaState.cid_main_net,
        imaState.jo_deposit_box, // for logs validation on mainnet
        null, // imaState.jo_token_manager, // for logs validation on s-chain
        imaState.nTransferBlockSizeS2M,
        imaState.nMaxTransactionsS2M,
        imaState.nBlockAwaitDepthS2M,
        imaState.nBlockAgeS2M,
        imaBLS.do_sign_messages_s2m, // fn_sign_messages
        imaState.tc_main_net,
        imaState.optsPendingTxAnalysis
    );
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
        log.write( strLogPrefix + cc.debug( "S2M transfer done: " ) + cc.tf( b2 ) + "\n" );

    const b3 = b1 && b2;
    if( IMA.verbose_get() >= IMA.RV_VERBOSE.information )
        log.write( strLogPrefix + cc.debug( "Completed: " ) + cc.tf( b3 ) + "\n" );

    return b3;
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
            }, true );
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
