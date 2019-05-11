#!/usr/bin/env bash

: "${DIRECTION:?Provide DIRECTION to deploy}"
#: "${ETH_PRIVATE_KEY_FOR_MAINNET:?Provide ETH_PRIVATE_KEY_FOR_MAINNET to deploy}"
#: "${SCHAIN_NAME:?Provide SCHAIN_NAME to deploy}"
#: "${NETWORK_FOR_SCHAIN:?Provide NETWORK_FOR_SCHAIN to deploy}"
#: "${ETH_PRIVATE_KEY_FOR_SCHAIN:?Provide ETH_PRIVATE_KEY_FOR_SCHAIN to deploy}"

#NETWORK=${NETWORK_FOR_MAINNET} ETH_PRIVATE_KEY=${ETH_PRIVATE_KEY_FOR_MAINNET} node migrations/1_deploy_contracts_to_mainnet.js
#node scripts/1_deploy_contracts_to_mainnet.js
#NETWORK=${NETWORK_FOR_SCHAIN} ETH_PRIVATE_KEY=${ETH_PRIVATE_KEY_FOR_SCHAIN} node migrations/2_deploy_contracts_to_schain.js
#node scripts/2_deploy_contracts_to_schain.js

if [[ ! ${DIRECTION} =~ ^(main|schain|both)$ ]]; then
    echo "DIRECTION variable proper values: ( main | schain | both )"
    exit 1
fi
export $(cat .env | xargs) 
if [ "${DIRECTION}" = main ]; then
    ./node_modules/.bin/truffle  deploy --network mainnet
elif [ "${DIRECTION}" = schain ]; then
    ./node_modules/.bin/truffle  deploy -f 2 --network schain
elif [ "${DIRECTION}" = both ]; then
    ./node_modules/.bin/truffle  deploy --network mainnet
    ./node_modules/.bin/truffle  deploy -f 2 --network schain
fi