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
 * @file agent-test.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path"; // allow self-signed wss and https

import * as IMA from "../npms/skale-ima";
import * as imaUtils from "../agent/utils.mjs";
import * as imaCLI from "../agent/cli.mjs";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

// const compose_tx_instance = IMA.compose_tx_instance;
IMA.expose_details_set( false );
IMA.verbose_set( IMA.verbose_parse( "info" ) );
const log = imaUtils.log;
// import * as imaBLS from "../agent/bls.mjs";
// import * as rpcCall from "../agent/rpc-call.mjs";

log.removeAll();
// log.addStdout();
// log.addMemory(); // console.log( log.getStreamWithFilePath( "memory" ).strAccumulatedLogText );

global.imaState = {
    "loopState": {
        "oracle": {
            "isInProgress": false,
            "wasInProgress": false
        },
        "m2s": {
            "isInProgress": false,
            "wasInProgress": false
        },
        "s2m": {
            "isInProgress": false,
            "wasInProgress": false
        },
        "s2s": {
            "isInProgress": false,
            "wasInProgress": false
        }
    },

    "strLogFilePath": "",
    "nLogMaxSizeBeforeRotation": -1,
    "nLogMaxFilesCount": -1,
    "isPrintGathered": true,
    "isPrintSecurityValues": true,
    "isPrintPWA": false,

    "bIsNeededCommonInit": true,
    "bSignMessages": false, // use BLS message signing, turned on with --sign-messages
    "joSChainNetworkInfo": null, // scanned S-Chain network description
    "strPathBlsGlue": "", // path to bls_glue app, must have if --sign-messages specified
    "strPathHashG1": "", // path to hash_g1 app, must have if --sign-messages specified
    "strPathBlsVerify": "", // path to verify_bls app, optional, if specified then we will verify gathered BLS signature

    "bShowConfigMode": false, // true - just show configuration values and exit

    "bNoWaitSChainStarted": false,
    "nMaxWaitSChainAttempts": 0 + Number.MAX_SAFE_INTEGER, // 20
    "isPreventExitAfterLastAction": false,

    "nAmountOfWei": 0,
    "nAmountOfToken": 0,
    "arrAmountsOfTokens": null,
    "idToken": 0,
    "idTokens": [],
    "have_idToken": false,
    "have_idTokens": false,

    "nTransferBlockSizeM2S": 4,
    "nTransferBlockSizeS2M": 4,
    "nTransferBlockSizeS2S": 4,
    "nTransferStepsM2S": 8,
    "nTransferStepsS2M": 8,
    "nTransferStepsS2S": 8,
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

    "nAutoExitAfterSeconds": 0, // 0-disable

    "jo_deposit_box_eth": null, // only main net
    "jo_deposit_box_erc20": null, // only main net
    "jo_deposit_box_erc721": null, // only main net
    "jo_deposit_box_erc1155": null, // only main net
    "jo_token_manager": null, // only s-chain
    "jo_message_proxy_main_net": null,
    "jo_message_proxy_s_chain": null,
    "jo_linker": null,
    "jo_lock_and_data_s_chain": null,
    // "eth_erc721": null, // only s-chain
    "eth_erc20": null, // only s-chain

    "chainProperties": {
        "mn": {
            "joAccount": {
                "privateKey": owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_ETHEREUM ),
                "address": owaspUtils.fn_address_impl_,
                "strTransactionManagerURL": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_URL_ETHEREUM ),
                "tm_priority": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_PRIORITY_ETHEREUM ) || 5,
                "strSgxURL": owaspUtils.toStringURL( process.env.SGX_URL_ETHEREUM ),
                "strSgxKeyName": owaspUtils.toStringURL( process.env.SGX_KEY_ETHEREUM ),
                "strPathSslKey": ( process.env.SGX_SSL_KEY_FILE_ETHEREUM || "" ).toString().trim(),
                "strPathSslCert": ( process.env.SGX_SSL_CERT_FILE_ETHEREUM || "" ).toString().trim(),
                "strBlsKeyName": owaspUtils.toStringURL( process.env.BLS_KEY_ETHEREUM )
            },
            "transactionCustomizer": IMA.tc_main_net,
            "w3": null,
            "strURL": owaspUtils.toStringURL( process.env.URL_W3_ETHEREUM || "http://127.0.0.1:8545" ),
            "strChainName": ( process.env.CHAIN_NAME_ETHEREUM || "Mainnet" ).toString().trim(),
            "cid": owaspUtils.toInteger( process.env.CID_ETHEREUM ) || -4,
            "strPathAbiJson": imaUtils.normalizePath( "./agent-test-data/proxyMainnet.json" ),
            "joAbiIMA": { },
            "bHaveAbiIMA": false,
            "joErc20": null,
            "joErc721": null,
            "joErc1155": null,
            "strCoinNameErc20": "", // in-JSON coin name
            "strCoinNameErc721": "", // in-JSON coin name
            "strCoinNameErc1155": "", // in-JSON coin name
            "strPathJsonErc20": "",
            "strPathJsonErc721": "",
            "strPathJsonErc1155": ""
        },
        "sc": {
            "joAccount": {
                "privateKey": owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_SCHAIN ),
                "address": owaspUtils.fn_address_impl_,
                "strTransactionManagerURL": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_URL_S_CHAIN ),
                "tm_priority": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_PRIORITY_S_CHAIN ) || 5,
                "strSgxURL": owaspUtils.toStringURL( process.env.SGX_URL_S_CHAIN ),
                "strSgxKeyName": owaspUtils.toStringURL( process.env.SGX_KEY_S_CHAIN ),
                "strPathSslKey": ( process.env.SGX_SSL_KEY_FILE_S_CHAIN || "" ).toString().trim(),
                "strPathSslCert": ( process.env.SGX_SSL_CERT_FILE_S_CHAIN || "" ).toString().trim(),
                "strBlsKeyName": owaspUtils.toStringURL( process.env.BLS_KEY_S_CHAIN )
            },
            "transactionCustomizer": IMA.tc_s_chain,
            "w3": null,
            "strURL": owaspUtils.toStringURL( process.env.URL_W3_S_CHAIN || "http://127.0.0.1:15000" ),
            "strChainName": ( process.env.CHAIN_NAME_SCHAIN || "Bob" ).toString().trim(),
            "cid": owaspUtils.toInteger( process.env.CID_SCHAIN ) || -4,
            "strPathAbiJson": imaUtils.normalizePath( "./agent-test-data/proxySchain_Bob.json" ),
            "joAbiIMA": { },
            "bHaveAbiIMA": false,
            "joErc20": null,
            "joErc721": null,
            "joErc1155": null,
            "strCoinNameErc20": "", // in-JSON coin name
            "strCoinNameErc721": "", // in-JSON coin name
            "strCoinNameErc1155": "", // in-JSON coin name
            "strPathJsonErc20": "",
            "strPathJsonErc721": "",
            "strPathJsonErc1155": ""
        },
        "tc": {
            "joAccount": {
                "privateKey": owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_SCHAIN_TARGET ),
                "address": owaspUtils.fn_address_impl_,
                "strTransactionManagerURL": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_URL_S_CHAIN_TARGET ),
                "tm_priority": owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_PRIORITY_S_CHAIN_TARGET ) || 5,
                "strSgxURL": owaspUtils.toStringURL( process.env.SGX_URL_S_CHAIN_TARGET ),
                "strSgxKeyName": owaspUtils.toStringURL( process.env.SGX_KEY_S_CHAIN_TARGET ),
                "strPathSslKey": ( process.env.SGX_SSL_KEY_FILE_S_CHAIN_TARGET || "" ).toString().trim(),
                "strPathSslCert": ( process.env.SGX_SSL_CERT_FILE_S_CHAIN_TARGET || "" ).toString().trim(),
                "strBlsKeyName": owaspUtils.toStringURL( process.env.BLS_KEY_T_CHAIN )
            },
            "transactionCustomizer": IMA.tc_t_chain,
            "w3": null,
            "strURL": owaspUtils.toStringURL( process.env.URL_W3_S_CHAIN_TARGET ),
            "strChainName": ( process.env.CHAIN_NAME_SCHAIN_TARGET || "Alice" ).toString().trim(),
            "cid": owaspUtils.toInteger( process.env.CID_SCHAIN_TARGET ) || -4,
            "strPathAbiJson": null,
            "joAbiIMA": { },
            "bHaveAbiIMA": false,
            "joErc20": null,
            "joErc721": null,
            "joErc1155": null,
            "strCoinNameErc20": "", // in-JSON coin name
            "strCoinNameErc721": "", // in-JSON coin name
            "strCoinNameErc1155": "", // in-JSON coin name
            "strPathJsonErc20": "",
            "strPathJsonErc721": "",
            "strPathJsonErc1155": ""
        }
    },

    "strPathAbiJsonSkaleManager": null, // "", // imaUtils.normalizePath( "../proxy/data/skaleManager.json" ), // "./abi_skale_manager.json"
    "joAbiSkaleManager": { },
    "bHaveSkaleManagerABI": false,

    "strChainName_origin_chain": ( process.env.CHAIN_NAME_ETHEREUM || "Mainnet" ).toString().trim(),

    "strAddrErc20_explicit": "",
    "strAddrErc20_explicit_target": "", // S<->S target
    "strAddrErc721_explicit": "",
    "strAddrErc721_explicit_target": "", // S<->S target
    "strAddrErc1155_explicit": "",
    "strAddrErc1155_explicit_target": "", // S<->S target

    "doEnableDryRun": function( isEnable ) { return IMA.dry_run_enable( isEnable ); },
    "doIgnoreDryRun": function( isIgnore ) { return IMA.dry_run_ignore( isIgnore ); },

    "isPWA": true,
    "nTimeoutSecondsPWA": 60,

    "s2s_opts": { // S-Chain to S-Chain transfer options
        "isEnabled": false, // is S-Chain to S-Chain transfers enabled
        "secondsToReDiscoverSkaleNetwork": 10 * 60 // seconts to re-discover SKALE network, 0 to disable
    },

    "nJsonRpcPort": 14999, // 0 to disable
    "isCrossImaBlsMode": true,

    "arrActions": [] // array of actions to run
};

imaCLI.ima_common_init();
imaCLI.ima_contracts_init();

describe( "OWASP", function() {

    describe( "Parsing utilities", function() {

        it( "Integer basic validation", function() {
            assert.equal( owaspUtils.is_numeric( "0" ), true );
            assert.equal( owaspUtils.is_numeric( "123" ), true );
        } );

        it( "Integer RegEx validation", function() {
            assert.equal( owaspUtils.rxIsInt( "0" ), true );
            assert.equal( owaspUtils.rxIsInt( "123" ), true );
            assert.equal( owaspUtils.rxIsInt( "-456" ), true );
            assert.equal( owaspUtils.rxIsInt( "a012" ), false );
        } );

        it( "Floating point RegEx validation", function() {
            assert.equal( owaspUtils.rxIsFloat( "0" ), true );
            assert.equal( owaspUtils.rxIsFloat( "0.0" ), true );
            assert.equal( owaspUtils.rxIsFloat( "123.456" ), true );
            assert.equal( owaspUtils.rxIsFloat( "-123.456" ), true );
            assert.equal( owaspUtils.rxIsFloat( "a012" ), false );
        } );

        it( "Radix validation", function() {
            assert.equal( owaspUtils.validateRadix( "123", "10" ), 10 );
            assert.equal( owaspUtils.validateRadix( "0x20", "16" ), 16 );
        } );

        it( "Integer conversion", function() {
            assert.equal( owaspUtils.toInteger( "12345", 10 ), 12345 );
            assert.equal( owaspUtils.toInteger( "0x20", 16 ), 0x20 );
        } );

        it( "Floating point validation", function() {
            assert.equal( owaspUtils.validateFloat( "123.456" ), true );
            assert.equal( owaspUtils.validateFloat( "hello 123.456" ), false );
        } );

        it( "Floating point conversion", function() {
            assert.equal( owaspUtils.toFloat( "123.456" ), 123.456 );
            assert.equal( owaspUtils.rxIsFloat( owaspUtils.toFloat( "hello 123.456" ) ), false );
        } );

        it( "Boolean conversion", function() {
            assert.equal( owaspUtils.toBoolean( "true" ), true );
            assert.equal( owaspUtils.toBoolean( "false" ), false );
            assert.equal( owaspUtils.toBoolean( true ), true );
            assert.equal( owaspUtils.toBoolean( false ), false );
            assert.equal( owaspUtils.toBoolean( "True" ), true );
            assert.equal( owaspUtils.toBoolean( "False" ), false );
            assert.equal( owaspUtils.toBoolean( "TRUE" ), true );
            assert.equal( owaspUtils.toBoolean( "FALSE" ), false );
            assert.equal( owaspUtils.toBoolean( "t" ), true );
            assert.equal( owaspUtils.toBoolean( "f" ), false );
            assert.equal( owaspUtils.toBoolean( "T" ), true );
            assert.equal( owaspUtils.toBoolean( "F" ), false );
            assert.equal( owaspUtils.toBoolean( "1" ), true );
            assert.equal( owaspUtils.toBoolean( "-1" ), true );
            assert.equal( owaspUtils.toBoolean( "0" ), false );
            assert.equal( owaspUtils.toBoolean( "0.123" ), true );
            assert.equal( owaspUtils.toBoolean( "" ), false );
        } );

        it( "URL validation", function() {
            assert.equal( owaspUtils.validateURL( "http://127.0.0.1" ), true );
            assert.equal( owaspUtils.validateURL( "http://127.0.0.1/" ), true );
            assert.equal( owaspUtils.validateURL( "https://127.0.0.1:3344" ), true );
            assert.equal( owaspUtils.validateURL( "https://127.0.0.1:3344/" ), true );
            assert.equal( owaspUtils.validateURL( "ws://[::1]" ), true );
            assert.equal( owaspUtils.validateURL( "ws://[::1]/" ), true );
            assert.equal( owaspUtils.validateURL( "wss://[::1]:3344" ), true );
            assert.equal( owaspUtils.validateURL( "wss://[::1]:3344/" ), true );
            assert.equal( owaspUtils.validateURL( "http://some.domain.org" ), true );
            assert.equal( owaspUtils.validateURL( "http://some.domain.org/" ), true );
            assert.equal( owaspUtils.validateURL( "https://some.domain.org:3344" ), true );
            assert.equal( owaspUtils.validateURL( "https://some.domain.org:3344/" ), true );
            assert.equal( owaspUtils.validateURL( "hello ws://[::1]" ), false );
            assert.equal( owaspUtils.validateURL( "hello ws://[::1]/" ), false );
            assert.equal( owaspUtils.validateURL( "hello wss://[::1]:3344" ), false );
            assert.equal( owaspUtils.validateURL( "hello wss://[::1]:3344/" ), false );
        } );

        it( "URL conversion", function() {
            assert.equal( owaspUtils.toURL( "http://127.0.0.1" ).constructor.name, "URL" );
            assert.equal( owaspUtils.toURL( "https://127.0.0.1:3344" ).constructor.name, "URL" );
            assert.equal( owaspUtils.toURL( "https://127.0.0.1:3344/" ).constructor.name, "URL" );
            assert.equal( owaspUtils.toURL( "ws://[::1]" ).constructor.name, "URL" );
            assert.equal( owaspUtils.toURL( "ws://[::1]/" ).constructor.name, "URL" );
            assert.equal( owaspUtils.toURL( "wss://[::1]:3344" ).constructor.name, "URL" );
            assert.equal( owaspUtils.toURL( "wss://[::1]:3344/" ).constructor.name, "URL" );
            assert.equal( owaspUtils.toURL( "http://some.domain.org" ).constructor.name, "URL" );
            assert.equal( owaspUtils.toURL( "http://some.domain.org/" ).constructor.name, "URL" );
            assert.equal( owaspUtils.toURL( "https://some.domain.org3344" ).constructor.name, "URL" );
            assert.equal( owaspUtils.toURL( "https://some.domain.org:3344/" ).constructor.name, "URL" );
            assert.equal( owaspUtils.toURL( "http://127.0.0.1" ).toString(), "http://127.0.0.1/" );
            assert.equal( owaspUtils.toURL( "http://127.0.0.1/" ).toString(), "http://127.0.0.1/" );
            assert.equal( owaspUtils.toURL( "https://127.0.0.1:3344" ).toString(), "https://127.0.0.1:3344/" );
            assert.equal( owaspUtils.toURL( "https://127.0.0.1:3344/" ).toString(), "https://127.0.0.1:3344/" );
            assert.equal( owaspUtils.toURL( "ws://[::1]" ).toString(), "ws://[::1]/" );
            assert.equal( owaspUtils.toURL( "ws://[::1]/" ).toString(), "ws://[::1]/" );
            assert.equal( owaspUtils.toURL( "wss://[::1]:3344" ).toString(), "wss://[::1]:3344/" );
            assert.equal( owaspUtils.toURL( "wss://[::1]:3344/" ).toString(), "wss://[::1]:3344/" );
            assert.equal( owaspUtils.toURL( "http://some.domain.org" ).toString(), "http://some.domain.org/" );
            assert.equal( owaspUtils.toURL( "http://some.domain.org/" ).toString(), "http://some.domain.org/" );
            assert.equal( owaspUtils.toURL( "https://some.domain.org:3344" ).toString(), "https://some.domain.org:3344/" );
            assert.equal( owaspUtils.toURL( "https://some.domain.org:3344/" ).toString(), "https://some.domain.org:3344/" );
            assert.equal( owaspUtils.toStringURL( "http://127.0.0.1" ), "http://127.0.0.1/" );
            assert.equal( owaspUtils.toStringURL( "http://127.0.0.1/" ), "http://127.0.0.1/" );
            assert.equal( owaspUtils.toStringURL( "https://127.0.0.1:3344" ), "https://127.0.0.1:3344/" );
            assert.equal( owaspUtils.toStringURL( "https://127.0.0.1:3344/" ), "https://127.0.0.1:3344/" );
            assert.equal( owaspUtils.toStringURL( "ws://[::1]" ), "ws://[::1]/" );
            assert.equal( owaspUtils.toStringURL( "ws://[::1]/" ), "ws://[::1]/" );
            assert.equal( owaspUtils.toStringURL( "wss://[::1]:3344" ), "wss://[::1]:3344/" );
            assert.equal( owaspUtils.toStringURL( "wss://[::1]:3344/" ), "wss://[::1]:3344/" );
            assert.equal( owaspUtils.toStringURL( "http://some.domain.org" ), "http://some.domain.org/" );
            assert.equal( owaspUtils.toStringURL( "http://some.domain.org/" ), "http://some.domain.org/" );
            assert.equal( owaspUtils.toStringURL( "https://some.domain.org:3344" ), "https://some.domain.org:3344/" );
            assert.equal( owaspUtils.toStringURL( "https://some.domain.org:3344/" ), "https://some.domain.org:3344/" );
        } );

        const strAddressValid0 = "0x7aa5E36AA15E93D10F4F26357C30F052DacDde5F";
        const strAddressValid1 = "7aa5E36AA15E93D10F4F26357C30F052DacDde5F";
        const strAddressInvalid0 = "0x7aa5E36AA15E93D10F4F26357C30F052DacDde5";
        const strAddressInvalid1 = "hello";
        const strAddressInvalid2 = "";

        it( "Validate Ethereum address", function() {
            assert.equal( owaspUtils.validateEthAddress( strAddressValid0 ), true );
            assert.equal( owaspUtils.validateEthAddress( strAddressValid1 ), true );
            assert.equal( owaspUtils.validateEthAddress( strAddressInvalid0 ), false );
            assert.equal( owaspUtils.validateEthAddress( strAddressInvalid1 ), false );
            assert.equal( owaspUtils.validateEthAddress( strAddressInvalid2 ), false );
        } );

        it( "Parse Ethereum address", function() {
            assert.equal( owaspUtils.toEthAddress( strAddressValid0 ), strAddressValid0 );
            assert.equal( owaspUtils.toEthAddress( strAddressValid1 ), strAddressValid0 );
            assert.equal( owaspUtils.toEthAddress( strAddressInvalid0, strAddressValid0 ), strAddressValid0 );
            assert.equal( owaspUtils.toEthAddress( strAddressInvalid0, "invalid value" ), "invalid value" );
            assert.equal( owaspUtils.toEthAddress( strAddressInvalid1, strAddressValid0 ), strAddressValid0 );
            assert.equal( owaspUtils.toEthAddress( strAddressInvalid1, "invalid value" ), "invalid value" );
            assert.equal( owaspUtils.toEthAddress( strAddressInvalid2, strAddressValid0 ), strAddressValid0 );
            assert.equal( owaspUtils.toEthAddress( strAddressInvalid2, "invalid value" ), "invalid value" );
        } );

        const strPrivateKeyValid0 = "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC";
        const strPrivateKeyValid1 = "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC";
        const strPrivateKeyInvalid0 = "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1F";
        const strPrivateKeyInvalid1 = "hello";
        const strPrivateKeyInvalid2 = "";

        it( "Validate Ethereum private key", function() {
            assert.equal( owaspUtils.validateEthPrivateKey( strPrivateKeyValid0 ), true );
            assert.equal( owaspUtils.validateEthPrivateKey( strPrivateKeyValid1 ), true );
            assert.equal( owaspUtils.validateEthPrivateKey( strPrivateKeyInvalid0 ), false );
            assert.equal( owaspUtils.validateEthPrivateKey( strPrivateKeyInvalid1 ), false );
            assert.equal( owaspUtils.validateEthPrivateKey( strPrivateKeyInvalid2 ), false );
        } );

        it( "Parse Ethereum private key", function() {
            assert.equal( owaspUtils.toEthPrivateKey( strPrivateKeyValid0 ), strPrivateKeyValid0 );
            assert.equal( owaspUtils.toEthPrivateKey( strPrivateKeyValid1 ), strPrivateKeyValid0 );
            assert.equal( owaspUtils.toEthPrivateKey( strPrivateKeyInvalid0, strPrivateKeyValid0 ), strPrivateKeyValid0 );
            assert.equal( owaspUtils.toEthPrivateKey( strPrivateKeyInvalid0, "invalid value" ), "invalid value" );
            assert.equal( owaspUtils.toEthPrivateKey( strPrivateKeyInvalid1, strPrivateKeyValid0 ), strPrivateKeyValid0 );
            assert.equal( owaspUtils.toEthPrivateKey( strPrivateKeyInvalid1, "invalid value" ), "invalid value" );
            assert.equal( owaspUtils.toEthPrivateKey( strPrivateKeyInvalid2, strPrivateKeyValid0 ), strPrivateKeyValid0 );
            assert.equal( owaspUtils.toEthPrivateKey( strPrivateKeyInvalid2, "invalid value" ), "invalid value" );
        } );

        it( "Byte sequence utilities", function() {
            assert.equal( owaspUtils.ensure_starts_with_0x( "0x123" ), "0x123" );
            assert.equal( owaspUtils.ensure_starts_with_0x( "123" ), "0x123" );
            assert.equal( owaspUtils.remove_starting_0x( "0x123" ), "123" );
            assert.equal( owaspUtils.remove_starting_0x( "123" ), "123" );
        } );

    } );

    describe( "Command line argument utilities", function() {

        it( "Basic verification", function() {
            assert.equal( typeof owaspUtils.verifyArgumentWithNonEmptyValue( { name: "path", value: "/tmp/file.name.here" } ), "object" );
            assert.equal( typeof owaspUtils.verifyArgumentIsURL( { name: "url", value: "http://127.0.0.1" } ), "object" );
            assert.equal( typeof owaspUtils.verifyArgumentIsInteger( { name: "url", value: "123" } ), "object" );
        } );

        it( "Paths verification", function() {
            assert.equal( typeof owaspUtils.verifyArgumentIsPathToExistingFile( { name: "url", value: __filename } ), "object" );
            assert.equal( typeof owaspUtils.verifyArgumentIsPathToExistingFolder( { name: "url", value: __dirname } ), "object" );
        } );

    } );

    describe( "Key/address utilities", function() {
        const joTestAccount = {
            "privateKey": owaspUtils.toEthPrivateKey( "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC" ),
            "address": owaspUtils.fn_address_impl_
        };

        it( "Extract address from private key", function() {
            const address = joTestAccount.address();
            const address2 = owaspUtils.private_key_2_account_address( joTestAccount.privateKey );
            // console.log( "private key is", joTestAccount.privateKey );
            // console.log( "computed address is", joTestAccount.address() );
            assert.equal( address.toLowerCase(), "0x7aa5E36AA15E93D10F4F26357C30F052DacDde5F".toLowerCase() );
            assert.equal( address2.toLowerCase(), "0x7aa5E36AA15E93D10F4F26357C30F052DacDde5F".toLowerCase() );
        } );

        it( "Extract public key from private key", function() {
            // const address = joTestAccount.address();
            const publicKey = owaspUtils.private_key_2_public_key( imaState.chainProperties.mn.ethersProvider, joTestAccount.privateKey );
            // console.log( "private key is", joTestAccount.privateKey );
            // console.log( "extracted public is", publicKey );
            assert.equal( publicKey.toLowerCase(), "5dd431d36ce6b88f27d351051b31a26848c4a886f0dd0bc87a7d5a9d821417c9e807e8589f680ab0f2ab29831231ad7b3d6659990ee830582fede785fc3c33c4".toLowerCase() );
        } );

        it( "Extract address from public key", function() {
            const address = joTestAccount.address();
            const publicKey = owaspUtils.private_key_2_public_key( imaState.chainProperties.mn.ethersProvider, joTestAccount.privateKey );
            const address2 = owaspUtils.public_key_2_account_address( imaState.chainProperties.mn.ethersProvider, publicKey );
            // console.log( "computed address is", joTestAccount.address() );
            // console.log( "private key is", joTestAccount.privateKey );
            // console.log( "extracted address is", publicKey );
            assert.equal( address.toLowerCase(), address2.toLowerCase() );
        } );
    } );

    describe( "Ethereum value of money utilities", function() {

        it( "Parse money unit name", function() {
            assert.equal( owaspUtils.parseMoneyUnitName( "ethe" ), "ether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "ethr" ), "ether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "eth" ), "ether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "eter" ), "ether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "ete" ), "ether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "et" ), "ether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "eh" ), "ether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "er" ), "ether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "finne" ), "finney" );
            assert.equal( owaspUtils.parseMoneyUnitName( "finn" ), "finney" );
            assert.equal( owaspUtils.parseMoneyUnitName( "fin" ), "finney" );
            assert.equal( owaspUtils.parseMoneyUnitName( "fn" ), "finney" );
            assert.equal( owaspUtils.parseMoneyUnitName( "fi" ), "finney" );
            assert.equal( owaspUtils.parseMoneyUnitName( "szab" ), "szabo" );
            assert.equal( owaspUtils.parseMoneyUnitName( "szb" ), "szabo" );
            assert.equal( owaspUtils.parseMoneyUnitName( "sza" ), "szabo" );
            assert.equal( owaspUtils.parseMoneyUnitName( "sz" ), "szabo" );
            assert.equal( owaspUtils.parseMoneyUnitName( "shanno" ), "shannon" );
            assert.equal( owaspUtils.parseMoneyUnitName( "shannn" ), "shannon" );
            assert.equal( owaspUtils.parseMoneyUnitName( "shann" ), "shannon" );
            assert.equal( owaspUtils.parseMoneyUnitName( "shan" ), "shannon" );
            assert.equal( owaspUtils.parseMoneyUnitName( "sha" ), "shannon" );
            assert.equal( owaspUtils.parseMoneyUnitName( "shn" ), "shannon" );
            assert.equal( owaspUtils.parseMoneyUnitName( "sh" ), "shannon" );
            assert.equal( owaspUtils.parseMoneyUnitName( "lovelac" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "lovela" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "lovel" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "love" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "lovl" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "lvl" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "lvla" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "lvlc" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "lvc" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "lv" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "lo" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "lc" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "ll" ), "lovelace" );
            assert.equal( owaspUtils.parseMoneyUnitName( "babbag" ), "babbage" );
            assert.equal( owaspUtils.parseMoneyUnitName( "babba" ), "babbage" );
            assert.equal( owaspUtils.parseMoneyUnitName( "babbg" ), "babbage" );
            assert.equal( owaspUtils.parseMoneyUnitName( "babb" ), "babbage" );
            assert.equal( owaspUtils.parseMoneyUnitName( "bab" ), "babbage" );
            assert.equal( owaspUtils.parseMoneyUnitName( "bag" ), "babbage" );
            assert.equal( owaspUtils.parseMoneyUnitName( "bbb" ), "babbage" );
            assert.equal( owaspUtils.parseMoneyUnitName( "bb" ), "babbage" );
            assert.equal( owaspUtils.parseMoneyUnitName( "bg" ), "babbage" );
            assert.equal( owaspUtils.parseMoneyUnitName( "ba" ), "babbage" );
            assert.equal( owaspUtils.parseMoneyUnitName( "be" ), "babbage" );
            assert.equal( owaspUtils.parseMoneyUnitName( "we" ), "wei" );
            assert.equal( owaspUtils.parseMoneyUnitName( "wi" ), "wei" );
            assert.equal( owaspUtils.parseMoneyUnitName( "noether" ), "noether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "noeth" ), "noether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "kwei" ), "kwei" );
            assert.equal( owaspUtils.parseMoneyUnitName( "femtoether" ), "femtoether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "femto" ), "femtoether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "mwei" ), "mwei" );
            assert.equal( owaspUtils.parseMoneyUnitName( "picoether" ), "picoether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "pico" ), "picoether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "gwei" ), "gwei" );
            assert.equal( owaspUtils.parseMoneyUnitName( "nanoether" ), "nanoether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "nano" ), "nanoether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "microether" ), "microether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "micro" ), "microether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "milliether" ), "milliether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "milli" ), "milliether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "kether" ), "kether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "mether" ), "mether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "gether" ), "gether" );
            assert.equal( owaspUtils.parseMoneyUnitName( "tether" ), "tether" );
        } );

        it( "Parse money value specification", function() {
            assert.equal( owaspUtils.parseMoneySpecToWei( "1ether" ), "1000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1ethe" ), "1000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1ethr" ), "1000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1eth" ), "1000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1eter" ), "1000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1ete" ), "1000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1et" ), "1000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1eh" ), "1000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1er" ), "1000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1finney" ), "1000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1finne" ), "1000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1finn" ), "1000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1fin" ), "1000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1fn" ), "1000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1fi" ), "1000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1szab" ), "1000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1szb" ), "1000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1sza" ), "1000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1sz" ), "1000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1shanno" ), "1000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1shannn" ), "1000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1shann" ), "1000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1shan" ), "1000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1sha" ), "1000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1shn" ), "1000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1sh" ), "1000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1lovelac" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1lovela" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1lovel" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1love" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1lovl" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1lvl" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1lvla" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1lvlc" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1lvc" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1lv" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1lo" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1lc" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1ll" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1babbag" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1babba" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1babbg" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1babb" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1bab" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1bag" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1bbb" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1bb" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1bg" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1ba" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1be" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1we" ), "1" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1wi" ), "1" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1noether" ), "0" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1noeth" ), "0" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1kwei" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1femtoether" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1femto" ), "1000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1mwei" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1picoether" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1pico" ), "1000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1gwei" ), "1000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1nanoether" ), "1000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1nano" ), "1000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1microether" ), "1000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1micro" ), "1000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1milliether" ), "1000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1milli" ), "1000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1kether" ), "1000000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1mether" ), "1000000000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1gether" ), "1000000000000000000000000000" );
            assert.equal( owaspUtils.parseMoneySpecToWei( "1tether" ), "1000000000000000000000000000000" );
        } );

    } );

} );

describe( "CLI", function() {

    describe( "IMA Agent command line helpers", function() {

        it( "About", function() {
            assert.equal( imaCLI.print_about( true ), true );
        } );

        it( "Parse and collect CLI argument", function() {
            let joArg = imaCLI.parse_command_line_argument( "--help" );
            assert.equal( joArg.name, "help" );
            assert.equal( joArg.value, "" );
            joArg = imaCLI.parse_command_line_argument( "--test-url=http://127.0.0.1:3456" );
            assert.equal( joArg.name, "test-url" );
            assert.equal( joArg.value, "http://127.0.0.1:3456" );
            const isExitIfEmpty = false;
            const isPrintValue = true;
            const fnNameColorizer = null;
            const fnValueColorizer = null;
            assert.equal( imaCLI.ensure_have_value( "test-url", "http://127.0.0.1:3456", isExitIfEmpty, isPrintValue, fnNameColorizer, fnValueColorizer ), true );
            const joTestAccount = {
                "privateKey": owaspUtils.toEthPrivateKey( "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC" ),
                "address": owaspUtils.fn_address_impl_
            };
            assert.equal( imaCLI.ensure_have_chain_credentials( imaState.chainProperties.sc.strChainName, joTestAccount, isExitIfEmpty, isPrintValue ), true );
        } );

    } );

    // TO-DO: imaCLI.find_node_index
    // TO-DO: imaCLI.load_node_config

    describe( "IMA Agent command line parser", function() {

        it( "Minimal command line parse", function() {
            const joExternalHandlers = {};
            const argv = [];
            assert.equal( imaCLI.parse( joExternalHandlers, argv ), 0 );
        } );

        it( "Basic command line parse", function() {
            const joExternalHandlers = {};
            const argv = [
                "--verbose=9",
                "--s2s-disable",
                "--url-main-net=" + imaState.chainProperties.mn.strURL,
                "--url-s-chain=" + imaState.chainProperties.sc.strURL,
                "--id-main-net=" + imaState.chainProperties.mn.strChainName,
                "--id-s-chain=" + imaState.chainProperties.sc.strChainName,
                "--id-origin-chain=" + imaState.strChainName_origin_chain,
                "--cid-main-net=" + imaState.chainProperties.mn.cid,
                "--cid-s-chain=" + imaState.chainProperties.sc.cid,
                "--address-main-net=" + imaState.chainProperties.mn.joAccount.address(),
                "--address-s-chain=" + imaState.chainProperties.sc.joAccount.address(),
                "--key-main-net=" + imaState.chainProperties.mn.joAccount.privateKey,
                "--key-s-chain=" + imaState.chainProperties.sc.joAccount.privateKey,
                //"--abi-skale-manager=" + imaState.strPathAbiJsonSkaleManager,
                "--abi-main-net=" + imaState.chainProperties.mn.strPathAbiJson,
                "--abi-s-chain=" + imaState.chainProperties.sc.strPathAbiJson,
                // --erc721-main-net --erc721-s-chain --addr-erc721-s-chain
                // --erc20-main-net --erc20-s-chain --addr-erc20-s-chain
                // --erc1155-main-net --erc1155-s-chain --addr-erc1155-s-chain
                "--sleep-between-tx=5000",
                "--wait-next-block=true",
                // --value...
                "--gas-price-multiplier-mn=2",
                "--gas-price-multiplier-sc=2",
                "--gas-price-multiplier=2",
                // --no-wait-s-chain --max-wait-attempts
                "--skip-dry-run", // --skip-dry-run --ignore-dry-run --dry-run
                "--m2s-transfer-block-size=4",
                "--s2m-transfer-block-size=4",
                "--s2s-transfer-block-size=4",
                "--transfer-block-size=4",
                "--m2s-max-transactions=0",
                "--s2m-max-transactions=0",
                "--s2s-max-transactions=0",
                "--max-transactions=0",
                "--m2s-await-blocks=0",
                "--s2m-await-blocks=0",
                "--s2s-await-blocks=0",
                "--await-blocks=0",
                "--m2s-await-time=0",
                "--s2m-await-time=0",
                "--s2s-await-time=0",
                "--await-time=0",
                "--period=300",
                "--node-number=0",
                "--nodes-count=1",
                "--time-framing=0",
                "--time-gap=10",
                "--no-pwa"
                // --log-size --log-files --log
                // --sign-messages --bls-glue --hash-g1 --bls-verify
            ];
            assert.equal( imaCLI.parse( joExternalHandlers, argv ), 0 );
        } );

    } );

} );

describe( "Agent Utils Module", function() {

    describe( "String helpers", function() {

        it( "Text replacement", function() {
            assert.equal( imaUtils.replaceAll( "abc123abcdef456abc", "abc", "" ), "123def456" );
        } );

        it( "Random file name", function() {
            const strPathTmpFolder = os.tmpdir();
            const strPathTmpFile = path.join( strPathTmpFolder, imaUtils.getRandomFileName() + ".txt" );
            // console.log( "Tmp file is", strPathTmpFile );
            assert.equal( strPathTmpFile ? true : false, true );
        } );

        it( "UTF8 encode/decode", function() {
            const strSrc = "Test string 123, Тестовая строка 123, 테스트 문자열 123, Cadena de prueba 123, テスト文字列123, Chaîne de test 123, Testzeichenfolge 123, 測試字符串123";
            const arrBytes = imaUtils.encodeUTF8( strSrc );
            const strDst = imaUtils.decodeUTF8( arrBytes );
            assert.equal( strSrc, strDst );
        } );

        it( "Compose S-Chain URL", function() {
            assert.equal( imaUtils.compose_schain_node_url( { ip: "127.0.0.1", httpRpcPort: 3456 } ), "http://127.0.0.1:3456" );
            assert.equal( imaUtils.compose_schain_node_url( { ip: "127.0.0.1", httpsRpcPort: 3456 } ), "https://127.0.0.1:3456" );
            assert.equal( imaUtils.compose_schain_node_url( { ip: "127.0.0.1", wsRpcPort: 3456 } ), "ws://127.0.0.1:3456" );
            assert.equal( imaUtils.compose_schain_node_url( { ip: "127.0.0.1", wssRpcPort: 3456 } ), "wss://127.0.0.1:3456" );
            assert.equal( imaUtils.compose_schain_node_url( { ip6: "::1", httpRpcPort6: 3456 } ), "http://[::1]:3456" );
            assert.equal( imaUtils.compose_schain_node_url( { ip6: "::1", httpsRpcPort6: 3456 } ), "https://[::1]:3456" );
            assert.equal( imaUtils.compose_schain_node_url( { ip6: "::1", wsRpcPort6: 3456 } ), "ws://[::1]:3456" );
            assert.equal( imaUtils.compose_schain_node_url( { ip6: "::1", wssRpcPort6: 3456 } ), "wss://[::1]:3456" );
        } );

        it( "Compose IMA Agent URL", function() {
            // HTTP_JSON = 3
            // IMA_AGENT_JSON = 10
            // so... distance is 10 - 3 = 7
            // as result, 14999 + 7 = 15006
            assert.equal( imaUtils.compose_ima_agent_node_url( { ip: "127.0.0.1", httpRpcPort: 14999 } ), "http://127.0.0.1:15006" );
        } );

    } );

    describe( "Byte array manipulation helpers", function() {

        it( "HEX encode/decode raw", function() {
            const strSrc = "5465737420737472696e6720313233";
            const arrBytes = imaUtils.hexToBytes( strSrc, false );
            const strDst = imaUtils.bytesToHex( arrBytes, false );
            assert.equal( strSrc, strDst );
        } );

        it( "HEX encode/decode 0x-prefixed", function() {
            const strSrc = "0x5465737420737472696e6720313233";
            const arrBytes = imaUtils.hexToBytes( strSrc, false );
            const strDst = imaUtils.bytesToHex( arrBytes, false );
            assert.equal( strSrc, "0x" + strDst );
        } );

        it( "HEX encode/decode with inversive order raw", function() {
            const strSrc = "5465737420737472696e6720313233";
            const arrBytes = imaUtils.hexToBytes( strSrc, true );
            const strDst = imaUtils.bytesToHex( arrBytes, true );
            assert.equal( strSrc, strDst );
        } );

        it( "HEX encode/decode with inversive order 0x-prefixed", function() {
            const strSrc = "0x5465737420737472696e6720313233";
            const arrBytes = imaUtils.hexToBytes( strSrc, true );
            const strDst = imaUtils.bytesToHex( arrBytes, true );
            assert.equal( strSrc, "0x" + strDst );
        } );

        it( "Array padding with zeroes at left", function() {
            const strSrc = "123";
            const arrBytes = imaUtils.bytesAlignLeftWithZeroes( imaUtils.hexToBytes( strSrc, false ), 4 );
            const strDst = imaUtils.bytesToHex( arrBytes, false );
            assert.equal( strDst, "00000123" );
        } );

        it( "Array padding with zeroes at right", function() {
            const strSrc = "123";
            const arrBytes = imaUtils.bytesAlignRightWithZeroes( imaUtils.hexToBytes( strSrc, false ), 4 );
            const strDst = imaUtils.bytesToHex( arrBytes, false );
            assert.equal( strDst, "01230000" );
        } );

        it( "Typed array concatenation", function() {
            const strSrcLeft = "0xbaad", strSrcRight = "0xf00d";
            const arrBytesLeft = imaUtils.hexToBytes( strSrcLeft, false );
            const arrBytesRight = imaUtils.hexToBytes( strSrcRight, false );
            const arrBytes = imaUtils.concatTypedArrays( arrBytesLeft, arrBytesRight );
            const strDst = imaUtils.bytesToHex( arrBytes, false );
            assert.equal( strDst, "baadf00d" );
        } );

        it( "Byte array concatenation", function() {
            const strSrcLeft = "0xbaad", strSrcRight = "0xf00d";
            const arrBytesLeft = imaUtils.hexToBytes( strSrcLeft, false );
            const arrBytesRight = imaUtils.hexToBytes( strSrcRight, false );
            const arrBytes = imaUtils.bytesConcat( arrBytesLeft, arrBytesRight );
            const strDst = imaUtils.bytesToHex( arrBytes, false );
            assert.equal( strDst, "baadf00d" );
        } );

        it( "Single Byte concatenation", function() {
            const strSrcLeft = "0xbaadf0", nSrcRight = 0x0d;
            const arrBytesLeft = imaUtils.hexToBytes( strSrcLeft, false );
            const arrBytes = imaUtils.concatByte( arrBytesLeft, nSrcRight );
            const strDst = imaUtils.bytesToHex( arrBytes, false );
            assert.equal( strDst, "baadf00d" );
        } );

        it( "Array/buffer conversion", function() {
            const strSrc = "baadf00d";
            const arrBytes = imaUtils.toBuffer( imaUtils.toArrayBuffer( imaUtils.hexToBytes( strSrc, true ) ) );
            const strDst = imaUtils.bytesToHex( arrBytes, true );
            assert.equal( strDst, "baadf00d" );
        } );

    } );

    describe( "Path/file/JSON helpers", function() {

        it( "Home directory and path normalization", function() {
            const strPathHomeFolder = imaUtils.normalizePath( "~" );
            const strPathSrc = "~/some/file/path/here";
            const strPathDst = strPathHomeFolder + "/some/file/path/here";
            assert.equal( imaUtils.normalizePath( strPathSrc ), strPathDst );
        } );

        it( "File existence and text loading/saving", function() {
            const strPathTmpFolder = os.tmpdir();
            const strPathTmpFile = path.join( strPathTmpFolder, imaUtils.getRandomFileName() + ".txt" );
            // console.log( "Tmp file is", strPathTmpFile );
            try { fs.unlinkSync( strPathTmpFile ); } catch ( err ) { };
            assert.equal( imaUtils.fileExists( strPathTmpFile ), false );
            const strContentSaved = "Text file content";
            assert.equal( imaUtils.fileSave( strPathTmpFile, strContentSaved ), true );
            assert.equal( imaUtils.fileExists( strPathTmpFile ), true );
            const strContentLoaded = imaUtils.fileLoad( strPathTmpFile, "file \"" + strPathTmpFile + "\"was not loaded" );
            assert.equal( strContentLoaded, strContentSaved );
            try { fs.unlinkSync( strPathTmpFile ); } catch ( err ) { };
        } );

        it( "File existence and JSON loading/saving", function() {
            const strPathTmpFolder = os.tmpdir();
            const strPathTmpFile = path.join( strPathTmpFolder, imaUtils.getRandomFileName() + ".json" );
            // console.log( "Tmp file is", strPathTmpFile );
            try { fs.unlinkSync( strPathTmpFile ); } catch ( err ) { };
            assert.equal( imaUtils.fileExists( strPathTmpFile ), false );
            const joContentSaved = { a: 123, b: 456 };
            assert.equal( imaUtils.jsonFileSave( strPathTmpFile, joContentSaved ), true );
            assert.equal( imaUtils.fileExists( strPathTmpFile ), true );
            const joContentLoaded = imaUtils.jsonFileLoad( strPathTmpFile, { error: "file \"" + strPathTmpFile + "\"was not loaded" } );
            assert.equal( JSON.stringify( joContentSaved ), JSON.stringify( joContentLoaded ) );
            try { fs.unlinkSync( strPathTmpFile ); } catch ( err ) { };
        } );

    } );

    describe( "ABI JSON Helpers", function() {

        it( "Find ABI entries", function() {
            const strName = imaState.chainProperties.sc.strChainName;
            const strFile = imaState.chainProperties.sc.strPathAbiJson;
            const joABI = imaUtils.jsonFileLoad( strFile, { error: "file \"" + strFile + "\"was not loaded" } );
            const strKey = "token_manager_linker_address";
            const arrKeys = [
                "token_manager_linker_address",
                "token_manager_linker_abi",
                "eth_erc20_address",
                "eth_erc20_abi",
                "token_manager_eth_address",
                "token_manager_eth_abi",
                "token_manager_erc20_address",
                "token_manager_erc20_abi",
                "token_manager_erc721_address",
                "token_manager_erc721_abi",
                "token_manager_erc1155_address",
                "token_manager_erc1155_abi",
                "message_proxy_chain_address",
                "message_proxy_chain_abi"
            ];
            const isExitOnError = false;
            assert.equal( imaUtils.check_key_exist_in_abi( strName, strFile, joABI, strKey, isExitOnError ), true );
            assert.equal( imaUtils.check_keys_exist_in_abi( strName, strFile, joABI, arrKeys, isExitOnError ), true );
        } );

        it( "Discover coin name", function() {
            const strFile = imaState.chainProperties.sc.strPathAbiJson;
            const joABI = imaUtils.jsonFileLoad( strFile, { error: "file \"" + strFile + "\"was not loaded" } );
            const strCoinName = imaUtils.discover_in_json_coin_name( joABI );
            // console.log( "strCoinName is", strCoinName );
            assert.equal( strCoinName.length > 0, true );
        } );

    } );

} );
