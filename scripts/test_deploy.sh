#!/usr/bin/env bash

set -e

trap 'npx ganache instances stop "$GANACHE"' EXIT

ACCOUNTS=accounts.json
GANACHE=$(npx ganache \
    --😈 \
    --wallet.accountKeysPath "$ACCOUNTS" \
    --chain.allowUnlimitedContractSize \
)
PRIVATE_KEY=$(jq -r "first(.private_keys[])" < "$ACCOUNTS")

export CHAIN_NAME_SCHAIN="d2-chain"
export PRIVATE_KEY_FOR_ETHEREUM=$PRIVATE_KEY
export PRIVATE_KEY_FOR_SCHAIN=$PRIVATE_KEY

yarn deploy-skale-manager-components
export SKALE_MANAGER_ADDRESS=$(cat data/skaleManagerComponents.json | jq -r .skale_manager_address)
yarn deploy-to-both-chains

npx ganache instances stop "$GANACHE"
