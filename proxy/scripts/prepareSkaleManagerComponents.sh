#!/usr/bin/env bash

export $(cat .env | xargs)
sudo apt-get -y install jq
cp ./scripts/3_migration_skale_manager_components.js ./migrations/.
./node_modules/.bin/truffle migrate --f 3 --to 3 --network ${RUNNING_NETWORK}
export CONTRACT_MANAGER_ADDRESS=$( jq .contract_manager_address data/skaleManagerComponents.json )
rm ./migrations/3_migration_skale_manager_components.js
exit