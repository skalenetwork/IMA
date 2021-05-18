#!/usr/bin/env bash

export $(xargs < .env)
if [ -z "$RUNNING_NETWORK" ]; then
    npx hardhat run migrations/deploySkaleManagerComponents.ts --network "${NETWORK_FOR_ETHEREUM}"
else
    npx hardhat run migrations/deploySkaleManagerComponents.ts --network "${RUNNING_NETWORK}"
fi
exit