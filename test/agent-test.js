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
 * @file agent-test.js
 * @copyright SKALE Labs 2019-Present
 */

const assert = require( "assert" );

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; // allow self-signed wss and https

global.IMA = require( "../npms/skale-ima" );
global.w3mod = IMA.w3mod;
global.ethereumjs_tx = IMA.ethereumjs_tx;
global.ethereumjs_wallet = IMA.ethereumjs_wallet;
global.ethereumjs_util = IMA.ethereumjs_util;
global.compose_tx_instance = IMA.compose_tx_instance;
global.owaspUtils = IMA.owaspUtils;
global.imaUtils = require( "../agent/utils.js" );
IMA.verbose_set( IMA.verbose_parse( "info" ) );
global.log = global.imaUtils.log;
global.cc = global.imaUtils.cc;
global.imaCLI = require( "../agent/cli.js" );
global.imaBLS = require( "../agent/bls.js" );
global.rpcCall = require( "../agent/rpc-call.js" );
global.rpcCall.init();

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

    "strPathAbiJson_main_net": imaUtils.normalizePath( "../proxy/data/proxyMainnet.json" ),
    "strPathAbiJson_s_chain": imaUtils.normalizePath( "../proxy/data/proxySchain_Bob.json" ),

    "bShowConfigMode": false, // true - just show configuration values and exit

    "bNoWaitSChainStarted": false,
    "nMaxWaitSChainAttempts": 20,
    "isPreventExitAfterLastAction": false,

    "strURL_main_net": owaspUtils.toStringURL( process.env.URL_W3_ETHEREUM || "http://127.0.0.1:8545" ), // example: "http://127.0.0.1:8545
    "strURL_s_chain": owaspUtils.toStringURL( process.env.URL_W3_S_CHAIN || "http://127.0.0.1:15000" ),

    "strChainID_main_net": ( process.env.CHAIN_NAME_ETHEREUM || "Mainnet" ).toString().trim(),
    "strChainID_s_chain": ( process.env.CHAIN_NAME_SCHAIN || "Bob" ).toString().trim(),
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
    "w3http_main_net": null,
    "w3_main_net": null,

    "w3http_s_chain": null,
    "w3_s_chain": null,

    "jo_deposit_box": null, // only main net
    "jo_token_manager": null, // only s-chain
    "jo_message_proxy_main_net": null,
    "jo_message_proxy_s_chain": null,
    "jo_lock_and_data_main_net": null,
    "jo_lock_and_data_s_chain": null,
    // "eth_erc721": null, // only s-chain
    "eth_erc20": null, // only s-chain

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
    "tc_main_net": IMA.tc_main_net, // new IMA.TransactionCustomizer( 1.25 ),
    "tc_s_chain": IMA.tc_s_chain, // new IMA.TransactionCustomizer( null ),
    //

    "doEnableDryRun": function( isEnable ) { return IMA.dry_run_enable( isEnable ); },
    "doIgnoreDryRun": function( isIgnore ) { return IMA.dry_run_ignore( isIgnore ); },

    "arrActions": [] // array of actions to run
};

imaCLI.ima_common_init();

describe( "OWASP", function () {

    it( "Extract address from private key", function () {
        const joAccount_test = {
            "privateKey": owaspUtils.toEthPrivateKey( "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC" ),
            "address": IMA.owaspUtils.fn_address_impl_
        };
        const address = joAccount_test.address( imaState.w3_main_net );
        const address2 = owaspUtils.private_key_2_account_address(imaState.w3_main_net, joAccount_test.privateKey )
        // console.log( "private key is", joAccount_test.privateKey );
        // console.log( "computed address is", joAccount_test.address( imaState.w3_main_net ) );
        assert.equal( address.toLowerCase(), "0x7aa5E36AA15E93D10F4F26357C30F052DacDde5F".toLowerCase() );
        assert.equal( address2.toLowerCase(), "0x7aa5E36AA15E93D10F4F26357C30F052DacDde5F".toLowerCase() );
    });

    it( "Extract public key from private key", function () {
        const joAccount_test = {
            "privateKey": owaspUtils.toEthPrivateKey( "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC" ),
            "address": IMA.owaspUtils.fn_address_impl_
        };
        // const address = joAccount_test.address( imaState.w3_main_net );
        const publicKey = owaspUtils.private_key_2_public_key( imaState.w3_main_net, joAccount_test.privateKey );
        // console.log( "private key is", joAccount_test.privateKey );
        // console.log( "extracted public is", publicKey );
        assert.equal( publicKey.toLowerCase(), "5dd431d36ce6b88f27d351051b31a26848c4a886f0dd0bc87a7d5a9d821417c9e807e8589f680ab0f2ab29831231ad7b3d6659990ee830582fede785fc3c33c4".toLowerCase() );
    });

    it( "Extract address from public key", function () {
        const joAccount_test = {
            "privateKey": owaspUtils.toEthPrivateKey( "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC" ),
            "address": IMA.owaspUtils.fn_address_impl_
        };
        const address = joAccount_test.address( imaState.w3_main_net );
        const publicKey = owaspUtils.private_key_2_public_key( imaState.w3_main_net, joAccount_test.privateKey );
        const address2 = owaspUtils.public_key_2_account_address( imaState.w3_main_net, publicKey );
        // console.log( "computed address is", joAccount_test.address( imaState.w3_main_net ) );
        // console.log( "private key is", joAccount_test.privateKey );
        // console.log( "extracted address is", publicKey );
        assert.equal( address.toLowerCase(), address2.toLowerCase() );
    });

});
