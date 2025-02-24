#!/usr/bin/env bash

set -e

trap 'npx ganache instances stop "$GANACHE"' EXIT

if [ -z "$GITHUB_WORKSPACE" ]
then
    GITHUB_WORKSPACE=$(git rev-parse --show-toplevel)
fi

if [ -z "$GITHUB_REPOSITORY" ]
then
    GITHUB_REPOSITORY="skalenetwork/IMA"
fi


DEPLOYED_TAG="$(cat "$GITHUB_WORKSPACE"/DEPLOYED_ON_MAINNET_SCHAINS)"
VERSION_TAG="$(cat "$GITHUB_WORKSPACE"/VERSION)"
DEPLOYED_VERSION="$(echo "$DEPLOYED_TAG" | cut -d '-' -f 1)"
DEPLOYED_DIR=$GITHUB_WORKSPACE/deployed-IMA/
ACCOUNTS_FILENAME="$DEPLOYED_DIR/proxy/generatedAccounts.json"
ENDPOINT="http://127.0.0.1:8545"
ABI_FILENAME_SCHAIN="proxySchain_Test.json"


git clone --branch "$DEPLOYED_TAG" "https://github.com/$GITHUB_REPOSITORY.git" "$DEPLOYED_DIR"

GANACHE=$(npx ganache \
    --😈 \
    --miner.blockGasLimit 12000000 \
    --logging.quiet \
    --chain.allowUnlimitedContractSize \
    --wallet.accountKeysPath "$ACCOUNTS_FILENAME" \
)

cd "$DEPLOYED_DIR/proxy"
jq 'del(.resolutions)' package.json > tmp.json && mv tmp.json package.json
yarn install
PRIVATE_KEY=$(cat "$ACCOUNTS_FILENAME" | jq -r  '.private_keys | to_entries | .[0].value')

CHAIN_NAME_SCHAIN="Test" \
VERSION="$DEPLOYED_VERSION" \
ENDPOINT="$ENDPOINT" \
PRIVATE_KEY="$PRIVATE_KEY" \
npx hardhat run migrations/deploySkaleManagerComponents.ts --network custom
ENDPOINT="$ENDPOINT" \
PRIVATE_KEY="$PRIVATE_KEY" \
VERSION="$DEPLOYED_VERSION" \
npx hardhat run migrations/deployMainnet.ts --network custom


CHAIN_NAME_SCHAIN="Test" \
VERSION="$DEPLOYED_TAG" \
ENDPOINT="$ENDPOINT" \
PRIVATE_KEY="$PRIVATE_KEY" \
npx hardhat run migrations/deploySchain.ts --network custom


cp "data/$ABI_FILENAME_SCHAIN" "$GITHUB_WORKSPACE/data"
cd "$GITHUB_WORKSPACE"
rm -r --interactive=never "$DEPLOYED_DIR"

curl -L -o data/ima-schain-$DEPLOYED_TAG-manifest.json \
"https://github.com/skalenetwork/IMA/releases/download/$DEPLOYED_TAG/ima-schain-$DEPLOYED_TAG-manifest.json"

ABI="data/$ABI_FILENAME_SCHAIN" \
MANIFEST="data/ima-schain-$DEPLOYED_TAG-manifest.json" \
npx hardhat run migrations/replaceAddressesInManifest.ts --network localhost


TEST_ABI="data/$ABI_FILENAME_SCHAIN" \
MANIFEST="data/ima-schain-$DEPLOYED_TAG-manifest.json" \
CHAIN_NAME_SCHAIN="Test" \
UPGRADE_ALL="true" \
TEST_UPGRADE="true" \
ALLOW_NOT_ATOMIC_UPGRADE="OK" \
VERSION=$VERSION_TAG \
ENDPOINT="$ENDPOINT" \
PRIVATE_KEY="$PRIVATE_KEY" \
npx hardhat run migrations/upgradeSchainFrom-1.1.3-beta.0.ts --network custom

npx ganache instances stop "$GANACHE"
