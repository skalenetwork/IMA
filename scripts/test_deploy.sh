#!/usr/bin/env bash

set -e

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
yarn deploy-to-mainnet
# TODO: Uncomment after fixing deploy script for schain, related issue https://github.com/skalenetwork/IMA/issues/1720
# yarn deploy-to-both-chains

npx ganache instances stop "$GANACHE"
