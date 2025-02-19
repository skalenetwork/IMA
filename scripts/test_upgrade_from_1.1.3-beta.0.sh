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


git clone --branch "$DEPLOYED_TAG" "https://github.com/$GITHUB_REPOSITORY.git" "$DEPLOYED_DIR"

ACCOUNTS_FILENAME="$DEPLOYED_DIR/proxy/generatedAccounts.json"
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
PRIVATE_KEY_FOR_ETHEREUM=$(cat "$ACCOUNTS_FILENAME" | jq -r  '.private_keys | to_entries | .[8].value')
PRIVATE_KEY_FOR_SCHAIN=$(cat "$ACCOUNTS_FILENAME" | jq -r '.private_keys | to_entries | .[9].value')
URL_W3_S_CHAIN="http://127.0.0.1:8545"
ABI_FILENAME_SCHAIN="proxySchain_Test.json"


CHAIN_NAME_SCHAIN="Test" \
VERSION="$DEPLOYED_VERSION" \
PRIVATE_KEY_FOR_ETHEREUM="$PRIVATE_KEY_FOR_ETHEREUM" \
PRIVATE_KEY_FOR_SCHAIN="$PRIVATE_KEY_FOR_SCHAIN" \
npx hardhat run migrations/deploySkaleManagerComponents.ts --network localhost
VERSION="$DEPLOYED_VERSION" npx hardhat run migrations/deployMainnet.ts --network localhost


CHAIN_NAME_SCHAIN="Test" \
VERSION="$DEPLOYED_TAG" \
URL_W3_S_CHAIN="$URL_W3_S_CHAIN" \
PRIVATE_KEY_FOR_SCHAIN="$PRIVATE_KEY_FOR_SCHAIN" \
npx hardhat run migrations/deploySchain.ts --network schain


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
URL_W3_S_CHAIN="$URL_W3_S_CHAIN" \
PRIVATE_KEY_FOR_SCHAIN="$PRIVATE_KEY_FOR_SCHAIN" \
npx hardhat run migrations/upgradeSchainFrom-1.1.3-beta.0.ts --network schain

npx ganache instances stop "$GANACHE"
