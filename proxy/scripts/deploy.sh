#!/usr/bin/env bash

: "${DIRECTION:?Provide DIRECTION to deploy}"
#: "${INSECURE_PRIVATE_KEY_FOR_ETHEREUMM:?ProvideINSECURE_PRIVATE_KEY_FOR_ETHEREUMUM to deploy}"
#: "${CHAIN_NAME_SCHAIN:?Provide CHAIN_NAME_SCHAIN to deploy}"
#: "${NETWORK_FOR_SCHAIN:?Provide NETWORK_FOR_SCHAIN to deploy}"
#: "${INSECURE_PRIVATE_KEY_FOR_SCHAIN:?Provide INSECURE_PRIVATE_KEY_FOR_SCHAIN to deploy}"

#NETWORK=${NETWORK_FOR_ETHEREUMM} ETH_PRIVATE_KEY=${INSECURE_PRIVATE_KEY_FOR_ETHEREUMM} node migrations/1_deploy_contracts_to_mainnet.js
#node scripts/1_deploy_contracts_to_mainnet.js
#NETWORK=${NETWORK_FOR_SCHAIN} ETH_PRIVATE_KEY=${INSECURE_PRIVATE_KEY_FOR_SCHAIN} node migrations/2_deploy_contracts_to_schain.js
#node scripts/2_deploy_contracts_to_schain.js

if [[ ! ${DIRECTION} =~ ^(main|schain|both)$ ]]; then
    echo "DIRECTION variable proper values: ( main | schain | both )"
    exit 1
fi
export $(cat .env | xargs)
if [ "${DIRECTION}" = main ]; then
    if [[ -z "${NETWORK_FOR_ETHEREUMM}" ]]; then
        echo "Please set NETWORK_FOR_ETHEREUMM to .env file"
        exit 1
    fi
    echo "NETWORK_FOR_ETHEREUMM is" $NETWORK_FOR_ETHEREUMUM}
    ./node_modules/.bin/truffle deploy --f 1 --to 1 --network ${NETWORK_FOR_ETHEREUMM} || exit $?
elif [ "${DIRECTION}" = schain ]; then
    if [[ -z "${NETWORK_FOR_SCHAIN}" ]]; then
        echo "Please set NETWORK_FOR_SCHAIN to .env file"
        exit 1
    fi
    echo "NETWORK_FOR_SCHAIN is" ${NETWORK_FOR_SCHAIN}
    ./node_modules/.bin/truffle deploy --f 2 --to 2 --network ${NETWORK_FOR_SCHAIN} || exit $?
elif [ "${DIRECTION}" = both ]; then
    if [[ -z "${NETWORK_FOR_ETHEREUMM}" ]]; then
        echo "Please set NETWORK_FOR_ETHEREUMM to .env file"
        exit 1
    fi
    if [[ -z "${NETWORK_FOR_SCHAIN}" ]]; then
        echo "Please set NETWORK_FOR_SCHAIN to .env file"
        exit 1
    fi
    echo "NETWORK_FOR_ETHEREUMM is" $NETWORK_FOR_ETHEREUMUM}
    echo "NETWORK_FOR_SCHAIN is" ${NETWORK_FOR_SCHAIN}
    ./node_modules/.bin/truffle deploy --f 1 --to 1 --network ${NETWORK_FOR_ETHEREUMM} || exit $?
    ./node_modules/.bin/truffle deploy --f 2 --to 2 --network ${NETWORK_FOR_SCHAIN} || exit $?
fi
