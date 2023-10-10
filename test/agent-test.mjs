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
import * as path from "path";
import * as url from "url";

import * as owaspUtils from "../npms/skale-owasp/owaspUtils.mjs";
import * as imaTx from "../npms/skale-ima/imaTx.mjs";
import * as log from "../npms/skale-log/log.mjs";
import * as imaUtils from "../agent/utils.mjs";
import * as imaCLI from "../agent/cli.mjs";

import * as state from "../agent/state.mjs";

const __dirname = path.dirname( url.fileURLToPath( import.meta.url ) );
const __filename = new URL( "", import.meta.url ).pathname;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

log.exposeDetailsSet( false );
log.verboseSet( log.verboseParse( "info" ) );

log.removeAll();
const imaState = {
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
    "isPrintSecurityValues": false,
    "isPrintPWA": false,
    "isDynamicLogInDoTransfer": true,
    "isDynamicLogInBlsSigner": false,

    "bIsNeededCommonInit": true,
    "bSignMessages": false,
    "joSChainNetworkInfo": null,
    "strPathBlsGlue": "",
    "strPathHashG1": "",
    "strPathBlsVerify": "",

    "bShowConfigMode": false,

    "isEnabledMultiCall": true,

    "bNoWaitSChainStarted": false,
    "nMaxWaitSChainAttempts": 0 + Number.MAX_SAFE_INTEGER, // 20

    "nAmountOfWei": 0,
    "nAmountOfToken": 0,
    "arrAmountsOfTokens": null,
    "idToken": 0,
    "idTokens": [],
    "haveOneTokenIdentifier": false,
    "haveArrayOfTokenIdentifiers": false,

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

    "joDepositBoxETH": null, // only main net
    "joDepositBoxERC20": null, // only main net
    "joDepositBoxERC721": null, // only main net
    "joDepositBoxERC1155": null, // only main net
    "joTokenManager": null, // only s-chain
    "joMessageProxyMainNet": null,
    "joMessageProxySChain": null,
    "joLinker": null,
    "joLockAndDataSChain": null,
    "joEthErc20": null, // only s-chain

    "chainProperties": {
        "mn": {
            "joAccount": {
                "privateKey": owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_ETHEREUM ),
                "address": owaspUtils.fnAddressImpl_,
                "strTransactionManagerURL":
                    owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_URL_ETHEREUM ),
                "nTmPriority":
                    owaspUtils.toStringURL(
                        process.env.TRANSACTION_MANAGER_PRIORITY_ETHEREUM ) || 5,
                "strSgxURL": owaspUtils.toStringURL( process.env.SGX_URL_ETHEREUM ),
                "strSgxKeyName": owaspUtils.toStringURL( process.env.SGX_KEY_ETHEREUM ),
                "strPathSslKey":
                    ( process.env.SGX_SSL_KEY_FILE_ETHEREUM || "" ).toString().trim(),
                "strPathSslCert":
                    ( process.env.SGX_SSL_CERT_FILE_ETHEREUM || "" ).toString().trim(),
                "strBlsKeyName": owaspUtils.toStringURL( process.env.BLS_KEY_ETHEREUM )
            },
            "transactionCustomizer": imaTx.getTransactionCustomizerForMainNet(),
            "ethersProvider": null,
            "strURL":
                owaspUtils.toStringURL( process.env.URL_W3_ETHEREUM || "http://127.0.0.1:8545" ),
            "strChainName": ( process.env.CHAIN_NAME_ETHEREUM || "Mainnet" ).toString().trim(),
            "chainId": owaspUtils.toInteger( process.env.CID_ETHEREUM ) || -4,
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
                "address": owaspUtils.fnAddressImpl_,
                "strTransactionManagerURL":
                    owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_URL_S_CHAIN ),
                "nTmPriority":
                    owaspUtils.toStringURL(
                        process.env.TRANSACTION_MANAGER_PRIORITY_S_CHAIN ) || 5,
                "strSgxURL": owaspUtils.toStringURL( process.env.SGX_URL_S_CHAIN ),
                "strSgxKeyName": owaspUtils.toStringURL( process.env.SGX_KEY_S_CHAIN ),
                "strPathSslKey":
                    ( process.env.SGX_SSL_KEY_FILE_S_CHAIN || "" ).toString().trim(),
                "strPathSslCert":
                    ( process.env.SGX_SSL_CERT_FILE_S_CHAIN || "" ).toString().trim(),
                "strBlsKeyName": owaspUtils.toStringURL( process.env.BLS_KEY_S_CHAIN )
            },
            "transactionCustomizer": imaTx.getTransactionCustomizerForSChain(),
            "ethersProvider": null,
            "strURL":
                owaspUtils.toStringURL( process.env.URL_W3_S_CHAIN || "http://127.0.0.1:15000" ),
            "strChainName": ( process.env.CHAIN_NAME_SCHAIN || "Bob" ).toString().trim(),
            "chainId": owaspUtils.toInteger( process.env.CID_SCHAIN ) || -4,
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
                "privateKey":
                    owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_SCHAIN_TARGET ),
                "address": owaspUtils.fnAddressImpl_,
                "strTransactionManagerURL":
                    owaspUtils.toStringURL( process.env.TRANSACTION_MANAGER_URL_S_CHAIN_TARGET ),
                "nTmPriority":
                    owaspUtils.toStringURL(
                        process.env.TRANSACTION_MANAGER_PRIORITY_S_CHAIN_TARGET ) || 5,
                "strSgxURL": owaspUtils.toStringURL( process.env.SGX_URL_S_CHAIN_TARGET ),
                "strSgxKeyName": owaspUtils.toStringURL( process.env.SGX_KEY_S_CHAIN_TARGET ),
                "strPathSslKey":
                    ( process.env.SGX_SSL_KEY_FILE_S_CHAIN_TARGET || "" ).toString().trim(),
                "strPathSslCert":
                    ( process.env.SGX_SSL_CERT_FILE_S_CHAIN_TARGET || "" ).toString().trim(),
                "strBlsKeyName": owaspUtils.toStringURL( process.env.BLS_KEY_T_CHAIN )
            },
            "transactionCustomizer": imaTx.getTransactionCustomizerForSChainTarget(),
            "ethersProvider": null,
            "strURL": owaspUtils.toStringURL( process.env.URL_W3_S_CHAIN_TARGET ),
            "strChainName":
                ( process.env.CHAIN_NAME_SCHAIN_TARGET || "Alice" ).toString().trim(),
            "chainId": owaspUtils.toInteger( process.env.CID_SCHAIN_TARGET ) || -4,
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

    "strPathAbiJsonSkaleManager": null,
    "joAbiSkaleManager": { },
    "bHaveSkaleManagerABI": false,

    "strChainNameOriginChain":
        ( process.env.CHAIN_NAME_ETHEREUM || "Mainnet" ).toString().trim(),

    "strAddrErc20Explicit": "",
    "strAddrErc20ExplicitTarget": "", // S<->S target
    "strAddrErc721Explicit": "",
    "strAddrErc721ExplicitTarget": "", // S<->S target
    "strAddrErc1155Explicit": "",
    "strAddrErc1155ExplicitTarget": "", // S<->S target

    "isPWA": true,
    "nTimeoutSecondsPWA": 60,

    "optsS2S": {
        "isEnabled": false,
        "bParallelModeRefreshSNB": true,
        "secondsToReDiscoverSkaleNetwork": 10 * 60,
        "secondsToWaitForSkaleNetworkDiscovered": 2 * 60
    },

    "nJsonRpcPort": 14999, // 0 to disable
    "isCrossImaBlsMode": true,

    "arrActions": [] // array of actions to run
};
state.set( imaState );

imaCLI.commonInit();
imaCLI.initContracts();

describe( "OWASP-1", function() {

    describe( "Parsing utilities", function() {

        it( "Integer basic validation", function() {
            assert.equal( owaspUtils.isNumeric( "0" ), true );
            assert.equal( owaspUtils.isNumeric( "123" ), true );
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

        it( "Integer automatic conversion", function() {
            assert.equal( owaspUtils.parseIntOrHex( 12345, 10 ), 12345 );
            assert.equal( owaspUtils.parseIntOrHex( "12345", 10 ), 12345 );
            assert.equal( owaspUtils.parseIntOrHex( 0x20, 16 ), 0x20 );
            assert.equal( owaspUtils.parseIntOrHex( "0x20", 16 ), 0x20 );
        } );

        it( "Integer advanced validation", function() {
            assert.equal( owaspUtils.validateInteger( "12345", 10 ), true );
            assert.equal( owaspUtils.validateInteger( "0x20", 16 ), true );
            assert.equal( owaspUtils.validateInteger( "hello 12345", 10 ), false );
            assert.equal( owaspUtils.validateInteger( "hello 0x20", 16 ), false );
        } );

        it( "Floating point advanced validation", function() {
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

    } );
} );

describe( "OWASP-2", function() {

    describe( "Parsing utilities", function() {

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
            assert.equal(
                owaspUtils.toURL( "https://some.domain.org3344" ).constructor.name, "URL" );
            assert.equal(
                owaspUtils.toURL( "https://some.domain.org:3344/" ).constructor.name, "URL" );
            assert.equal(
                owaspUtils.toURL( "http://127.0.0.1" ).toString(), "http://127.0.0.1/" );
            assert.equal(
                owaspUtils.toURL( "http://127.0.0.1/" ).toString(), "http://127.0.0.1/" );
            assert.equal(
                owaspUtils.toURL(
                    "https://127.0.0.1:3344" ).toString(), "https://127.0.0.1:3344/" );
            assert.equal(
                owaspUtils.toURL(
                    "https://127.0.0.1:3344/" ).toString(), "https://127.0.0.1:3344/" );
            assert.equal( owaspUtils.toURL( "ws://[::1]" ).toString(), "ws://[::1]/" );
            assert.equal( owaspUtils.toURL( "ws://[::1]/" ).toString(), "ws://[::1]/" );
            assert.equal(
                owaspUtils.toURL( "wss://[::1]:3344" ).toString(), "wss://[::1]:3344/" );
            assert.equal(
                owaspUtils.toURL( "wss://[::1]:3344/" ).toString(), "wss://[::1]:3344/" );
            assert.equal(
                owaspUtils.toURL(
                    "http://some.domain.org" ).toString(), "http://some.domain.org/" );
            assert.equal(
                owaspUtils.toURL(
                    "http://some.domain.org/" ).toString(), "http://some.domain.org/" );
            assert.equal(
                owaspUtils.toURL(
                    "https://some.domain.org:3344" ).toString(),
                "https://some.domain.org:3344/" );
            assert.equal(
                owaspUtils.toURL(
                    "https://some.domain.org:3344/" ).toString(),
                "https://some.domain.org:3344/" );
            assert.equal(
                owaspUtils.toStringURL( "http://127.0.0.1" ), "http://127.0.0.1/" );
            assert.equal(
                owaspUtils.toStringURL( "http://127.0.0.1/" ), "http://127.0.0.1/" );
            assert.equal(
                owaspUtils.toStringURL( "https://127.0.0.1:3344" ), "https://127.0.0.1:3344/" );
            assert.equal(
                owaspUtils.toStringURL( "https://127.0.0.1:3344/" ), "https://127.0.0.1:3344/" );
            assert.equal( owaspUtils.toStringURL( "ws://[::1]" ), "ws://[::1]/" );
            assert.equal( owaspUtils.toStringURL( "ws://[::1]/" ), "ws://[::1]/" );
            assert.equal( owaspUtils.toStringURL( "wss://[::1]:3344" ), "wss://[::1]:3344/" );
            assert.equal( owaspUtils.toStringURL( "wss://[::1]:3344/" ), "wss://[::1]:3344/" );
            assert.equal(
                owaspUtils.toStringURL(
                    "http://some.domain.org" ), "http://some.domain.org/" );
            assert.equal(
                owaspUtils.toStringURL(
                    "http://some.domain.org/" ), "http://some.domain.org/" );
            assert.equal(
                owaspUtils.toStringURL(
                    "https://some.domain.org:3344" ), "https://some.domain.org:3344/" );
            assert.equal(
                owaspUtils.toStringURL(
                    "https://some.domain.org:3344/" ), "https://some.domain.org:3344/" );
        } );

        it( "Check URL is HTTP(S)", function() {
            assert.equal( owaspUtils.isUrlHTTP( "http://127.0.0.1" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "http://localhost" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "http://[::1]" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "http://127.0.0.1:1234" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "http://localhost:1234" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "http://[::1]:1234" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "https://127.0.0.1" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "https://localhost" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "https://[::1]" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "https://127.0.0.1:1234" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "https://localhost:1234" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "https://[::1]:1234" ), true );
            assert.equal( owaspUtils.isUrlHTTP( "ws://127.0.0.1" ), false );
            assert.equal( owaspUtils.isUrlHTTP( "ws://localhost" ), false );
            assert.equal( owaspUtils.isUrlHTTP( "ws://[::1]" ), false );
            assert.equal( owaspUtils.isUrlHTTP( "ws://127.0.0.1:1234" ), false );
            assert.equal( owaspUtils.isUrlHTTP( "ws://localhost:1234" ), false );
            assert.equal( owaspUtils.isUrlHTTP( "ws://[::1]:1234" ), false );
            assert.equal( owaspUtils.isUrlHTTP( "wss://127.0.0.1" ), false );
            assert.equal( owaspUtils.isUrlHTTP( "wss://localhost" ), false );
            assert.equal( owaspUtils.isUrlHTTP( "wss://[::1]" ), false );
            assert.equal( owaspUtils.isUrlHTTP( "wss://127.0.0.1:1234" ), false );
            assert.equal( owaspUtils.isUrlHTTP( "wss://localhost:1234" ), false );
            assert.equal( owaspUtils.isUrlHTTP( "wss://[::1]:1234" ), false );
        } );

        it( "Check URL is WS(S)", function() {
            assert.equal( owaspUtils.isUrlWS( "http://127.0.0.1" ), false );
            assert.equal( owaspUtils.isUrlWS( "http://localhost" ), false );
            assert.equal( owaspUtils.isUrlWS( "http://[::1]" ), false );
            assert.equal( owaspUtils.isUrlWS( "http://127.0.0.1:1234" ), false );
            assert.equal( owaspUtils.isUrlWS( "http://localhost:1234" ), false );
            assert.equal( owaspUtils.isUrlWS( "http://[::1]:1234" ), false );
            assert.equal( owaspUtils.isUrlWS( "https://127.0.0.1" ), false );
            assert.equal( owaspUtils.isUrlWS( "https://localhost" ), false );
            assert.equal( owaspUtils.isUrlWS( "https://[::1]" ), false );
            assert.equal( owaspUtils.isUrlWS( "https://127.0.0.1:1234" ), false );
            assert.equal( owaspUtils.isUrlWS( "https://localhost:1234" ), false );
            assert.equal( owaspUtils.isUrlWS( "https://[::1]:1234" ), false );
            assert.equal( owaspUtils.isUrlWS( "ws://127.0.0.1" ), true );
            assert.equal( owaspUtils.isUrlWS( "ws://localhost" ), true );
            assert.equal( owaspUtils.isUrlWS( "ws://[::1]" ), true );
            assert.equal( owaspUtils.isUrlWS( "ws://127.0.0.1:1234" ), true );
            assert.equal( owaspUtils.isUrlWS( "ws://localhost:1234" ), true );
            assert.equal( owaspUtils.isUrlWS( "ws://[::1]:1234" ), true );
            assert.equal( owaspUtils.isUrlWS( "wss://127.0.0.1" ), true );
            assert.equal( owaspUtils.isUrlWS( "wss://localhost" ), true );
            assert.equal( owaspUtils.isUrlWS( "wss://[::1]" ), true );
            assert.equal( owaspUtils.isUrlWS( "wss://127.0.0.1:1234" ), true );
            assert.equal( owaspUtils.isUrlWS( "wss://localhost:1234" ), true );
            assert.equal( owaspUtils.isUrlWS( "wss://[::1]:1234" ), true );
        } );
    } );
} );

describe( "OWASP-3", function() {

    describe( "Parsing utilities", function() {

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
            assert.equal(
                owaspUtils.toEthAddress(
                    strAddressInvalid0, strAddressValid0 ), strAddressValid0 );
            assert.equal(
                owaspUtils.toEthAddress(
                    strAddressInvalid0, "invalid value" ), "invalid value" );
            assert.equal(
                owaspUtils.toEthAddress(
                    strAddressInvalid1, strAddressValid0 ), strAddressValid0 );
            assert.equal(
                owaspUtils.toEthAddress(
                    strAddressInvalid1, "invalid value" ), "invalid value" );
            assert.equal(
                owaspUtils.toEthAddress(
                    strAddressInvalid2, strAddressValid0 ), strAddressValid0 );
            assert.equal(
                owaspUtils.toEthAddress(
                    strAddressInvalid2, "invalid value" ), "invalid value" );
        } );

        const strPrivateKeyValid0 =
            "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC";
        const strPrivateKeyValid1 =
            "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC";
        const strPrivateKeyInvalid0 =
            "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1F";
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
            assert.equal(
                owaspUtils.toEthPrivateKey( strPrivateKeyValid0 ), strPrivateKeyValid0 );
            assert.equal(
                owaspUtils.toEthPrivateKey( strPrivateKeyValid1 ), strPrivateKeyValid0 );
            assert.equal(
                owaspUtils.toEthPrivateKey(
                    strPrivateKeyInvalid0, strPrivateKeyValid0 ), strPrivateKeyValid0 );
            assert.equal(
                owaspUtils.toEthPrivateKey(
                    strPrivateKeyInvalid0, "invalid value" ), "invalid value" );
            assert.equal(
                owaspUtils.toEthPrivateKey(
                    strPrivateKeyInvalid1, strPrivateKeyValid0 ), strPrivateKeyValid0 );
            assert.equal(
                owaspUtils.toEthPrivateKey(
                    strPrivateKeyInvalid1, "invalid value" ), "invalid value" );
            assert.equal(
                owaspUtils.toEthPrivateKey(
                    strPrivateKeyInvalid2, strPrivateKeyValid0 ), strPrivateKeyValid0 );
            assert.equal(
                owaspUtils.toEthPrivateKey(
                    strPrivateKeyInvalid2, "invalid value" ), "invalid value" );
        } );

        it( "Byte sequence utilities", function() {
            assert.equal( owaspUtils.ensureStartsWith0x( "0x123" ), "0x123" );
            assert.equal( owaspUtils.ensureStartsWith0x( "123" ), "0x123" );
            assert.equal( owaspUtils.removeStarting0x( "0x123" ), "123" );
            assert.equal( owaspUtils.removeStarting0x( "123" ), "123" );
        } );

    } );
} );

describe( "OWASP-4", function() {

    describe( "Command line argument utilities", function() {

        it( "Basic verification", function() {
            assert.equal(
                typeof owaspUtils.verifyArgumentWithNonEmptyValue(
                    { name: "path", value: "/tmp/file.name.here" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsURL(
                    { name: "url", value: "http://127.0.0.1" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsURL(
                    { name: "url", value: "http://[::1]" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsURL(
                    { name: "url", value: "http://localhost" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsURL(
                    { name: "url", value: "http://127.0.0.1:1234" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsURL(
                    { name: "url", value: "http://[::1]:1234" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsURL(
                    { name: "url", value: "http://localhost:1234" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsInteger(
                    { name: "url", value: "123" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsInteger(
                    { name: "url", value: "0x123" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsIntegerIpPortNumber(
                    { name: "port", value: "1" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsIntegerIpPortNumber(
                    { name: "port", value: "123" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsIntegerIpPortNumber(
                    { name: "port", value: "1024" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsIntegerIpPortNumber(
                    { name: "port", value: "65535" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsArrayOfIntegers(
                    { name: "some_array", value: "[1]" } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsArrayOfIntegers(
                    { name: "some_array", value: "[1,2,3]" } ), "object" );
        } );

        it( "Paths verification", function() {
            assert.equal(
                typeof owaspUtils.verifyArgumentIsPathToExistingFile(
                    { name: "url", value: __filename } ), "object" );
            assert.equal(
                typeof owaspUtils.verifyArgumentIsPathToExistingFolder(
                    { name: "url", value: __dirname } ), "object" );
        } );

    } );
} );

describe( "OWASP-5", function() {

    describe( "Other utilities", function() {

        it( "IP from her", function() {
            assert.equal( owaspUtils.ipFromHex( "0x0a0b0c0d" ), "10.11.12.13" );
        } );

        it( "Clone object by root keys", function() {
            const joIn = { "a": 1, "2": 2, "c": { "d": 3, "e": 4 } };
            const joOut = owaspUtils.cloneObjectByRootKeys( joIn );
            assert.equal( JSON.stringify( joIn ), JSON.stringify( joOut ) );
        } );

        it( "ID from chain name", function() {
            assert.equal(
                owaspUtils.computeChainIdFromSChainName( "Hello World" ),
                "0x592fa743889fc7" );
        } );

        it( "Extract error message", function() {
            const not_extracted = "error message was not extracted";
            assert.equal(
                owaspUtils.extractErrorMessage(
                    null, not_extracted ), not_extracted );
            assert.equal(
                owaspUtils.extractErrorMessage(
                    undefined, not_extracted ), not_extracted );
            assert.equal(
                owaspUtils.extractErrorMessage(
                    123, not_extracted ), not_extracted );
            assert.equal(
                owaspUtils.extractErrorMessage(
                    "123", not_extracted ), not_extracted );
            assert.equal(
                owaspUtils.extractErrorMessage(
                    "", not_extracted ), not_extracted );
            assert.equal(
                owaspUtils.extractErrorMessage(
                    {}, not_extracted ), not_extracted );
            assert.equal(
                owaspUtils.extractErrorMessage(
                    { "err": "something" }, not_extracted ), not_extracted );
            assert.equal(
                owaspUtils.extractErrorMessage(
                    new Error( "Hello World" ), not_extracted ), "Hello World" );
        } );

    } );

    describe( "Key/address utilities", function() {
        const joTestAccount = {
            "privateKey":
                owaspUtils.toEthPrivateKey(
                    "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC" ),
            "address": owaspUtils.fnAddressImpl_
        };

        it( "Extract address from private key", function() {
            const address = joTestAccount.address();
            const address2 =
                owaspUtils.privateKeyToAccountAddress( joTestAccount.privateKey );
            assert.equal(
                address.toLowerCase(),
                "0x7aa5E36AA15E93D10F4F26357C30F052DacDde5F".toLowerCase() );
            assert.equal(
                address2.toLowerCase(),
                "0x7aa5E36AA15E93D10F4F26357C30F052DacDde5F".toLowerCase() );
        } );

        it( "Extract public key from private key", function() {
            const publicKey = owaspUtils.privateKeyToPublicKey( joTestAccount.privateKey );
            assert.equal(
                publicKey.toLowerCase(),
                ( "5dd431d36ce6b88f27d351051b31a26848c4a886f0dd0bc87a7d5a9d82" +
                "1417c9e807e8589f680ab0f2ab29831231ad" +
                "7b3d6659990ee830582fede785fc3c33c4" ).toLowerCase() );
        } );

        it( "Extract address from public key", function() {
            const address = joTestAccount.address();
            const publicKey = owaspUtils.privateKeyToPublicKey( joTestAccount.privateKey );
            const address2 = owaspUtils.publicKeyToAccountAddress( publicKey );
            assert.equal( address.toLowerCase(), address2.toLowerCase() );
        } );
    } );
} );

describe( "OWASP-6", function() {

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
            assert.equal(
                owaspUtils.parseMoneySpecToWei( "1nanoether" ), "1000000000" );
            assert.equal(
                owaspUtils.parseMoneySpecToWei( "1nano" ), "1000000000" );
            assert.equal(
                owaspUtils.parseMoneySpecToWei( "1microether" ), "1000000000000" );
            assert.equal(
                owaspUtils.parseMoneySpecToWei( "1micro" ), "1000000000000" );
            assert.equal(
                owaspUtils.parseMoneySpecToWei( "1milliether" ), "1000000000000000" );
            assert.equal(
                owaspUtils.parseMoneySpecToWei( "1milli" ), "1000000000000000" );
            assert.equal(
                owaspUtils.parseMoneySpecToWei( "1kether" ), "1000000000000000000000" );
            assert.equal(
                owaspUtils.parseMoneySpecToWei( "1mether" ), "1000000000000000000000000" );
            assert.equal(
                owaspUtils.parseMoneySpecToWei( "1gether" ), "1000000000000000000000000000" );
            assert.equal(
                owaspUtils.parseMoneySpecToWei( "1tether" ), "1000000000000000000000000000000" );
        } );

    } );

} );

describe( "CLI", function() {

    describe( "IMA Agent command line helpers", function() {

        it( "About", function() {
            assert.equal( imaCLI.printAbout( true ), true );
        } );

        it( "Parse and collect CLI argument", function() {
            let joArg = imaCLI.parseCommandLineArgument( "--help" );
            assert.equal( joArg.name, "help" );
            assert.equal( joArg.value, "" );
            joArg = imaCLI.parseCommandLineArgument( "--test-url=http://127.0.0.1:3456" );
            assert.equal( joArg.name, "test-url" );
            assert.equal( joArg.value, "http://127.0.0.1:3456" );
            const isExitIfEmpty = false;
            const isPrintValue = true;
            const fnNameColorizer = null;
            const fnValueColorizer = null;
            assert.equal(
                imaCLI.ensureHaveValue(
                    "test-url",
                    "http://127.0.0.1:3456",
                    isExitIfEmpty,
                    isPrintValue,
                    fnNameColorizer,
                    fnValueColorizer
                ),
                true );
            const joTestAccount = {
                "privateKey":
                    owaspUtils.toEthPrivateKey(
                        "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC" ),
                "address": owaspUtils.fnAddressImpl_
            };
            assert.equal(
                imaCLI.ensureHaveCredentials(
                    imaState.chainProperties.sc.strChainName,
                    joTestAccount,
                    isExitIfEmpty,
                    isPrintValue ),
                true );
        } );

    } );

    // TO-DO: imaCLI.findNodeIndex

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
                "--id-origin-chain=" + imaState.strChainNameOriginChain,
                "--cid-main-net=" + imaState.chainProperties.mn.chainId,
                "--cid-s-chain=" + imaState.chainProperties.sc.chainId,
                "--address-main-net=" +
                    ( imaState.chainProperties.mn.joAccount.address() ||
                    "0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f" ),
                "--address-s-chain=" +
                    ( imaState.chainProperties.sc.joAccount.address() ||
                    "0x66c5a87f4a49DD75e970055A265E8dd5C3F8f852" ),
                "--key-main-net=" +
                    ( imaState.chainProperties.mn.joAccount.privateKey ||
                    "23ABDBD3C61B5330AF61EBE8BEF582F4E5CC08E554053A718BDCE7813B9DC1FC" ),
                "--key-s-chain=" + ( imaState.chainProperties.sc.joAccount.privateKey ||
                    "80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e" ),
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

describe( "Agent Utils Module-1", function() {

    describe( "String helpers", function() {

        it( "Text replacement", function() {
            assert.equal( imaUtils.replaceAll( "abc123abcdef456abc", "abc", "" ), "123def456" );
        } );

        it( "Random file name", function() {
            const strPathTmpFolder = os.tmpdir();
            const strPathTmpFile =
                path.join( strPathTmpFolder, imaUtils.getRandomFileName() + ".txt" );
            assert.equal( strPathTmpFile ? true : false, true );
        } );

        it( "Compose S-Chain URL", function() {
            assert.equal(
                imaUtils.composeSChainNodeUrl(
                    { ip: "127.0.0.1", httpRpcPort: 3456 } ), "http://127.0.0.1:3456" );
            assert.equal(
                imaUtils.composeSChainNodeUrl(
                    { ip: "127.0.0.1", httpsRpcPort: 3456 } ), "https://127.0.0.1:3456" );
            assert.equal(
                imaUtils.composeSChainNodeUrl(
                    { ip: "127.0.0.1", wsRpcPort: 3456 } ), "ws://127.0.0.1:3456" );
            assert.equal(
                imaUtils.composeSChainNodeUrl(
                    { ip: "127.0.0.1", wssRpcPort: 3456 } ), "wss://127.0.0.1:3456" );
            assert.equal(
                imaUtils.composeSChainNodeUrl(
                    { ip6: "::1", httpRpcPort6: 3456 } ), "http://[::1]:3456" );
            assert.equal(
                imaUtils.composeSChainNodeUrl(
                    { ip6: "::1", httpsRpcPort6: 3456 } ), "https://[::1]:3456" );
            assert.equal(
                imaUtils.composeSChainNodeUrl(
                    { ip6: "::1", wsRpcPort6: 3456 } ), "ws://[::1]:3456" );
            assert.equal(
                imaUtils.composeSChainNodeUrl(
                    { ip6: "::1", wssRpcPort6: 3456 } ), "wss://[::1]:3456" );
        } );

        it( "Compose IMA Agent URL", function() {
            // HTTP_JSON = 3
            // IMA_AGENT_JSON = 10
            // so... distance is 10 - 3 = 7
            // as result, 14999 + 7 = 15006
            assert.equal(
                imaUtils.composeImaAgentNodeUrl(
                    { ip: "127.0.0.1", httpRpcPort: 14999 }, true ), "http://127.0.0.1:15006" );
            assert.equal(
                imaUtils.composeImaAgentNodeUrl(
                    { ip: "127.0.0.1", httpRpcPort: 14999 }, false ), "http://127.0.0.1:15006" );
        } );

    } );

} );

describe( "Agent Utils Module-2", function() {

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
            const arrBytes =
                imaUtils.bytesAlignLeftWithZeroes(
                    imaUtils.hexToBytes( strSrc, false ), 4 );
            const strDst = imaUtils.bytesToHex( arrBytes, false );
            assert.equal( strDst, "00000123" );
        } );

        it( "Array padding with zeroes at right", function() {
            const strSrc = "123";
            const arrBytes =
                imaUtils.bytesAlignRightWithZeroes(
                    imaUtils.hexToBytes( strSrc, false ), 4 );
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

    } );

} );

describe( "Agent Utils Module-3", function() {

    describe( "Path/file/JSON helpers", function() {

        it( "Home directory and path normalization", function() {
            const strPathHomeFolder = imaUtils.normalizePath( "~" );
            const strPathSrc = "~/some/file/path/here";
            const strPathDst = strPathHomeFolder + "/some/file/path/here";
            assert.equal( imaUtils.normalizePath( strPathSrc ), strPathDst );
        } );

        it( "File existence and text loading/saving", function() {
            const strPathTmpFolder = os.tmpdir();
            const strPathTmpFile =
                path.join( strPathTmpFolder, imaUtils.getRandomFileName() + ".txt" );
            try { fs.unlinkSync( strPathTmpFile ); } catch ( err ) { };
            assert.equal( imaUtils.fileExists( strPathTmpFile ), false );
            const strContentSaved = "Text file content";
            assert.equal( imaUtils.fileSave( strPathTmpFile, strContentSaved ), true );
            assert.equal( imaUtils.fileExists( strPathTmpFile ), true );
            const strContentLoaded =
                imaUtils.fileLoad(
                    strPathTmpFile, "file \"" + strPathTmpFile + "\"was not loaded" );
            assert.equal( strContentLoaded, strContentSaved );
            try { fs.unlinkSync( strPathTmpFile ); } catch ( err ) { };
        } );

        it( "File existence and JSON loading/saving", function() {
            const strPathTmpFolder = os.tmpdir();
            const strPathTmpFile =
                path.join( strPathTmpFolder, imaUtils.getRandomFileName() + ".json" );
            try { fs.unlinkSync( strPathTmpFile ); } catch ( err ) { };
            assert.equal( imaUtils.fileExists( strPathTmpFile ), false );
            const joContentSaved = { a: 123, b: 456 };
            assert.equal( imaUtils.jsonFileSave( strPathTmpFile, joContentSaved ), true );
            assert.equal( imaUtils.fileExists( strPathTmpFile ), true );
            const joContentLoaded =
                imaUtils.jsonFileLoad(
                    strPathTmpFile,
                    { error: "file \"" + strPathTmpFile + "\"was not loaded" } );
            assert.equal(
                JSON.stringify( joContentSaved ), JSON.stringify( joContentLoaded ) );
            try { fs.unlinkSync( strPathTmpFile ); } catch ( err ) { };
        } );

    } );

    describe( "ABI JSON Helpers", function() {

        it( "Find ABI entries", function() {
            const strName = imaState.chainProperties.sc.strChainName;
            const strFile = imaState.chainProperties.sc.strPathAbiJson;
            const joABI =
                imaUtils.jsonFileLoad(
                    strFile,
                    { error: "file \"" + strFile + "\"was not loaded" } );
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
            assert.equal(
                imaUtils.checkKeyExistInABI(
                    strName, strFile, joABI, strKey, isExitOnError ), true );
            assert.equal(
                imaUtils.checkKeysExistInABI(
                    strName, strFile, joABI, arrKeys, isExitOnError ), true );
        } );

        it( "Discover coin name", function() {
            const strFile = imaState.chainProperties.sc.strPathAbiJson;
            const joABI =
                imaUtils.jsonFileLoad(
                    strFile,
                    { error: "file \"" + strFile + "\"was not loaded" } );
            const strCoinName =
                imaUtils.discoverCoinNameInJSON( joABI );
            assert.equal( strCoinName.length > 0, true );
        } );

    } );

} );
