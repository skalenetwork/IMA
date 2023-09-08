import * as owaspUtils from "../npms/skale-owasp/owaspUtils.mjs";
import * as imaTx from "../npms/skale-ima/imaTx.mjs";

export const gDefaultValueForLoopState = {
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
};

function constructChainProperties() {
    return {
        "mn": {
            "joAccount": {
                "privateKey":
                    owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_ETHEREUM ),
                "address": owaspUtils.fnAddressImpl_,
                "strTransactionManagerURL":
                    owaspUtils.toStringURL(
                        process.env.TRANSACTION_MANAGER_URL_ETHEREUM ),
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
            "strURL": owaspUtils.toStringURL( process.env.URL_W3_ETHEREUM ),
            "strChainName":
                ( process.env.CHAIN_NAME_ETHEREUM || "Mainnet" ).toString().trim(),
            "chainId": owaspUtils.toInteger( process.env.CID_ETHEREUM ) || -4,
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
        },
        "sc": {
            "joAccount": {
                "privateKey":
                    owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_SCHAIN ),
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
            "strURL": owaspUtils.toStringURL( process.env.URL_W3_S_CHAIN ),
            "strChainName":
                ( process.env.CHAIN_NAME_SCHAIN || "id-S-chain" ).toString().trim(),
            "chainId": owaspUtils.toInteger( process.env.CID_SCHAIN ) || -4,
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
        },
        "tc": {
            "joAccount": {
                "privateKey":
                    owaspUtils.toEthPrivateKey( process.env.PRIVATE_KEY_FOR_SCHAIN_TARGET ),
                "address": owaspUtils.fnAddressImpl_,
                "strTransactionManagerURL":
                    owaspUtils.toStringURL(
                        process.env.TRANSACTION_MANAGER_URL_S_CHAIN_TARGET ),
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
                ( process.env.CHAIN_NAME_SCHAIN_TARGET || "id-T-chain" ).toString().trim(),
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
    };
}

let imaState = null;

export function get() {
    if( imaState )
        return imaState;
    imaState = {
        "loopState": gDefaultValueForLoopState,

        "strLogFilePath": "",
        "nLogMaxSizeBeforeRotation": -1,
        "nLogMaxFilesCount": -1,
        "isPrintGathered": true,
        "isPrintSecurityValues": false,
        "isPrintPWA": false,
        "isDynamicLogInDoTransfer": true,
        "isDynamicLogInBlsSigner": false,

        "bIsNeededCommonInit": true,
        // use BLS message signing, turned on with --sign-messages
        "bSignMessages": false,
        // scanned S-Chain network description
        "joSChainNetworkInfo": null,
        // path to bls_glue app, must have if --sign-messages specified
        "strPathBlsGlue": "",
        // path to hash_g1 app, must have if --sign-messages specified
        "strPathHashG1": "",
        // path to verify_bls app, optional,
        // if specified then we will verify gathered BLS signature
        "strPathBlsVerify": "",

        // true - just show configuration values and exit
        "bShowConfigMode": false,

        "isEnabledMultiCall": true,

        "bNoWaitSChainStarted": false,
        "nMaxWaitSChainAttempts": 0 + Number.MAX_SAFE_INTEGER, // 20

        "nAmountOfWei": 0,
        "nAmountOfToken": 0,
        "arrAmountsOfTokens": null,
        "idToken": 0,

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

        "joCommunityPool": null, // only main net
        "joDepositBoxETH": null, // only main net
        "joDepositBoxERC20": null, // only main net
        "joDepositBoxERC721": null, // only main net
        "joDepositBoxERC1155": null, // only main net
        "joDepositBoxERC721WithMetadata": null, // only main net
        "joLinker": null, // only main net

        "isWithMetadata721": false,

        "joTokenManagerETH": null, // only s-chain
        "joTokenManagerERC20": null, // only s-chain
        "joTokenManagerERC20Target": null, // only s-chain
        "joTokenManagerERC721": null, // only s-chain target
        "joTokenManagerERC721Target": null, // only s-chain target
        "joTokenManagerERC1155": null, // only s-chain
        "joTokenManagerERC1155Target": null, // only s-chain target
        "joTokenManagerERC721WithMetadata": null, // only s-chain target
        "joTokenManagerERC721WithMetadataTarget": null, // only s-chain target
        "joCommunityLocker": null, // only s-chain
        "joCommunityLockerTarget": null, // only s-chain target
        "joMessageProxyMainNet": null,
        "joMessageProxySChain": null,
        "joMessageProxySChainTarget": null, // only s-chain target
        "joTokenManagerLinker": null,
        "joTokenManagerLinkerTarget": null, // only s-chain target
        "joEthErc20": null, // only s-chain
        "joEthErc20Target": null, // only s-chain target

        "chainProperties": constructChainProperties(),

        "strPathAbiJsonSkaleManager": "",
        "joAbiSkaleManager": { },
        "bHaveSkaleManagerABI": false,

        "strChainNameOriginChain":
            ( process.env.CHAIN_NAME_SCHAIN_ORIGIN || "Mainnet" ).toString().trim(),

        "strAddrErc20Explicit": "",
        "strAddrErc20ExplicitTarget": "", // S<->S target
        "strAddrErc721Explicit": "",
        "strAddrErc721ExplicitTarget": "", // S<->S target
        "strAddrErc1155Explicit": "",
        "strAddrErc1155ExplicitTarget": "", // S<->S target

        "isPWA": true,
        "nTimeoutSecondsPWA": 60,

        "nMonitoringPort": 0, // 0 - default, means monitoring server is disabled
        "bLogMonitoringServer": false,

        "strReimbursementChain": "",
        "isShowReimbursementBalance": false,
        "nReimbursementRecharge": 0,
        "nReimbursementWithdraw": 0,
        "nReimbursementRange": -1, // < 0 - do not change anything

        "joSChainDiscovery": {
            "isSilentReDiscovery": false,
            // zero to disable (for debugging only)
            "repeatIntervalMilliseconds": 5 * 1000,
            "periodicDiscoveryInterval": 5 * 60 * 1000
        },

        // S-Chain to S-Chain transfer options
        "optsS2S": {
            // is S-Chain to S-Chain transfers enabled
            "isEnabled": true,
            "bParallelModeRefreshSNB": true,
            // seconds to re-discover SKALE network, 0 to disable
            "secondsToReDiscoverSkaleNetwork": 1 * 60 * 60,
            "secondsToWaitForSkaleNetworkDiscovered": 2 * 60
        },

        "nJsonRpcPort": 0, // 0 to disable
        "isCrossImaBlsMode": false,

        "arrActions": [] // array of actions to run
    };
    return imaState;
}

export function set( imaStateNew ) {
    imaState = imaStateNew;
    return imaState;
}

let gFlagIsPreventExitAfterLastAction = false;

export function isPreventExitAfterLastAction() {
    return gFlagIsPreventExitAfterLastAction;
}

export function setPreventExitAfterLastAction( isPrevent ) {
    gFlagIsPreventExitAfterLastAction = isPrevent;
}
