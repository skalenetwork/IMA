#!/usr/bin/env bash

: "${DIRECTION:?Provide DIRECTION to deploy}"
#: "${PRIVATE_KEY_FOR_ETHEREUM:?ProvidePRIVATE_KEY_FOR_ETHEREUMUM to deploy}"
#: "${CHAIN_NAME_SCHAIN:?Provide CHAIN_NAME_SCHAIN to deploy}"
#: "${NETWORK_FOR_SCHAIN:?Provide NETWORK_FOR_SCHAIN to deploy}"
#: "${PRIVATE_KEY_FOR_SCHAIN:?Provide PRIVATE_KEY_FOR_SCHAIN to deploy}"

#NETWORK=${NETWORK_FOR_ETHEREUM} ETH_PRIVATE_KEY=${PRIVATE_KEY_FOR_ETHEREUM} node migrations/1_deploy_contracts_to_mainnet.js
#node scripts/1_deploy_contracts_to_mainnet.js
#NETWORK=${NETWORK_FOR_SCHAIN} ETH_PRIVATE_KEY=${PRIVATE_KEY_FOR_SCHAIN} node migrations/2_deploy_contracts_to_schain.js
#node scripts/2_deploy_contracts_to_schain.js

if [[ ! ${DIRECTION} =~ ^(main|schain|both)$ ]]; then
    echo "DIRECTION variable proper values: ( main | schain | both )"
    exit 1
fi
export $(cat .env | xargs)
if [ "${DIRECTION}" = main ]; then
    if [[ -z "${NETWORK_FOR_ETHEREUM}" ]]; then
        echo "Please set NETWORK_FOR_ETHEREUM to .env file"
        exit 1
    fi
    echo "NETWORK_FOR_ETHEREUM is" ${NETWORK_FOR_ETHEREUM}
    ./node_modules/.bin/truffle deploy --f 1 --to 1 --network ${NETWORK_FOR_ETHEREUM} || exit $?
elif [ "${DIRECTION}" = schain ]; then
    if [[ -z "${NETWORK_FOR_SCHAIN}" ]]; then
        echo "Please set NETWORK_FOR_SCHAIN to .env file"
        exit 1
    fi
    echo "NETWORK_FOR_SCHAIN is" ${NETWORK_FOR_SCHAIN}
    ./node_modules/.bin/truffle deploy --f 2 --to 2 --network ${NETWORK_FOR_SCHAIN} || exit $?
elif [ "${DIRECTION}" = both ]; then
    if [[ -z "${NETWORK_FOR_ETHEREUM}" ]]; then
        echo "Please set NETWORK_FOR_ETHEREUM to .env file"
        exit 1
    fi
    if [[ -z "${NETWORK_FOR_SCHAIN}" ]]; then
        echo "Please set NETWORK_FOR_SCHAIN to .env file"
        exit 1
    fi
    echo "NETWORK_FOR_ETHEREUM is" ${NETWORK_FOR_ETHEREUM}
    echo "NETWORK_FOR_SCHAIN is" ${NETWORK_FOR_SCHAIN}
    ./node_modules/.bin/truffle deploy --f 1 --to 1 --network ${NETWORK_FOR_ETHEREUM} || exit $?
    ./node_modules/.bin/truffle deploy --f 2 --to 2 --network ${NETWORK_FOR_SCHAIN} || exit $?
fi
