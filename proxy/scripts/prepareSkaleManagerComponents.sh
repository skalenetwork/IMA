#!/usr/bin/env bash

export $(cat .env | xargs)
cp ./scripts/3_migration_skale_manager_components.js ./migrations/.
./node_modules/.bin/truffle migrate --f 3 --to 3 --network ${RUNNING_NETWORK}
rm ./migrations/3_migration_skale_manager_components.js
exit