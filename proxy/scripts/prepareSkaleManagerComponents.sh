#!/usr/bin/env bash

export $(cat .env | xargs)
cp ./scripts/3_migration_skale_manager_components.js ./migrations/.
if [ -z "$RUNNING_NETWORK" ]; then
    ./node_modules/.bin/truffle migrate --f 3 --to 3 --network ${NETWORK_FOR_MAINNET}
else
    ./node_modules/.bin/truffle migrate --f 3 --to 3 --network ${RUNNING_NETWORK}
fi
rm ./migrations/3_migration_skale_manager_components.js
exit