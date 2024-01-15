#!/usr/bin/env bash

set -e

ACCOUNTS=accounts.json
GANACHE=$(npx ganache \
    --😈 \
    --wallet.accountKeysPath "$ACCOUNTS" \
    --chain.allowUnlimitedContractSize \
)
PRIVATE_KEY=$(cat "$ACCOUNTS" | jq -r "first(.private_keys[])")

export CHAIN_NAME_SCHAIN="d2-chain"
export PRIVATE_KEY_FOR_ETHEREUM=$PRIVATE_KEY
export PRIVATE_KEY_FOR_SCHAIN=$PRIVATE_KEY

yarn deploy-skale-manager-components
yarn deploy-to-both-chains

npx ganache instances stop $GANACHE
