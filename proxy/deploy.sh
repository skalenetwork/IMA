#!/usr/bin/env bash

: "${NETWORK_FOR_MAINNET:?Provide NETWORK_FOR_MAINNET to deploy}"
: "${ETH_PRIVATE_KEY_FOR_MAINNET:?Provide ETH_PRIVATE_KEY_FOR_MAINNET to deploy}"
: "${SCHAIN_NAME:?Provide SCHAIN_NAME to deploy}"
: "${NETWORK_FOR_SCHAIN:?Provide NETWORK_FOR_SCHAIN to deploy}"
: "${ETH_PRIVATE_KEY_FOR_SCHAIN:?Provide ETH_PRIVATE_KEY_FOR_SCHAIN to deploy}"

NETWORK=${NETWORK_FOR_MAINNET} ETH_PRIVATE_KEY=${ETH_PRIVATE_KEY_FOR_MAINNET} node migrations/1_deploy_contracts_to_mainnet.js
NETWORK=${NETWORK_FOR_SCHAIN} ETH_PRIVATE_KEY=${ETH_PRIVATE_KEY_FOR_SCHAIN} node migrations/2_deploy_contracts_to_schain.js
