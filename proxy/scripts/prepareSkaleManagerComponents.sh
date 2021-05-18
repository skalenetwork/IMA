#!/usr/bin/env bash

export $(xargs < .env)
if [ -z "$RUNNING_NETWORK" ]; then
    npx hardhat run migrations/deploySkaleManagerComponents --network "${NETWORK_FOR_ETHEREUM}"
else
    npx hardhat run migrations/deploySkaleManagerComponents --network "${RUNNING_NETWORK}"
fi
rm ./migrations/3_migration_skale_manager_components.js
exit