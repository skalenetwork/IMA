#!/usr/bin/env bash

set -e

if [ -z $GITHUB_WORKSPACE ]
then
    GITHUB_WORKSPACE="$(dirname "$(dirname "$(dirname "$(realpath "$0")")")")"
fi

if [ -z $GITHUB_REPOSITORY ]
then
    GITHUB_REPOSITORY="skalenetwork/IMA"
fi

echo 'helo'
exit 0

DEPLOYED_TAG="$(cat "$GITHUB_WORKSPACE"/proxy/DEPLOYED)"
VERSION_TAG="$(cat "$GITHUB_WORKSPACE"/VERSION)"
DEPLOYED_VERSION="$(echo "$DEPLOYED_TAG" | cut -d '-' -f 1)"
DEPLOYED_DIR=$GITHUB_WORKSPACE/deployed-IMA/


git clone --branch "$DEPLOYED_TAG" "https://github.com/$GITHUB_REPOSITORY.git" "$DEPLOYED_DIR"

ACCOUNTS_FILENAME="$DEPLOYED_DIR/proxy/generatedAccounts.json"
npx ganache-cli --gasLimit 9000000 --quiet --allowUnlimitedContractSize --account_keys_path "$ACCOUNTS_FILENAME" &

cd "$DEPLOYED_DIR"
yarn install
cd proxy
PRIVATE_KEY_FOR_ETHEREUM=$(cat "$ACCOUNTS_FILENAME" | jq -r  '.private_keys | to_entries | .[8].value')
PRIVATE_KEY_FOR_SCHAIN=$(cat "$ACCOUNTS_FILENAME" | jq -r '.private_keys | to_entries | .[9].value')
CHAIN_NAME_SCHAIN="Test" VERSION="$DEPLOYED_VERSION" PRIVATE_KEY_FOR_ETHEREUM="$PRIVATE_KEY_FOR_ETHEREUM" PRIVATE_KEY_FOR_SCHAIN="$PRIVATE_KEY_FOR_SCHAIN" npx hardhat run migrations/deploySkaleManagerComponents.ts --network localhost
VERSION="$DEPLOYED_VERSION" npx hardhat run migrations/deployMainnet.ts --network localhost
CHAIN_NAME_SCHAIN="Test" VERSION="$DEPLOYED_VERSION" npx hardhat run migrations/deploySchain.ts --network localhost
cp "$GITHUB_WORKSPACE/proxy/migrations/generateManifest.ts" ./migrations/generateManifest.ts
cp "$GITHUB_WORKSPACE/proxy/migrations/changeManifest.ts" ./migrations/changeManifest.ts
cp "$GITHUB_WORKSPACE/proxy/migrations/tools/version.ts" ./migrations/tools/version.ts

ABI_FILENAME_SCHAIN="proxySchain_Test.json"
ABI="data/$ABI_FILENAME_SCHAIN" \
MANIFEST=".openzeppelin/unknown-1337.json" \
VERSION="$DEPLOYED_VERSION" \
npx hardhat run migrations/changeManifest.ts --network localhost

cp .openzeppelin/unknown-*.json "$GITHUB_WORKSPACE/proxy/.openzeppelin"
cp ./data/skaleManagerComponents.json "$GITHUB_WORKSPACE/proxy/data/"
cp "./data/ima-schain-$DEPLOYED_VERSION-manifest.json" "$GITHUB_WORKSPACE/proxy/data/"
ABI_FILENAME_MAINNET="proxyMainnet.json"
cp "data/$ABI_FILENAME_MAINNET" "$GITHUB_WORKSPACE/proxy/data"
cp "data/$ABI_FILENAME_SCHAIN" "$GITHUB_WORKSPACE/proxy/data"
cd "$GITHUB_WORKSPACE"
rm -r --interactive=never "$DEPLOYED_DIR"
cd proxy

ABI="data/$ABI_FILENAME_MAINNET" \
TEST_UPGRADE=true \
ALLOW_NOT_ATOMIC_UPGRADE="OK" \
VERSION=$VERSION_TAG \
npx hardhat run migrations/upgradeMainnet.ts --network localhost

VERSION="$(git describe --tags | echo "$VERSION_TAG")"
echo "$VERSION"
mv "data/proxyMainnet-$VERSION-localhost-abi.json" "data/proxyMainnet.json"

ABI="data/$ABI_FILENAME_SCHAIN" \
MANIFEST="data/ima-schain-$DEPLOYED_VERSION-manifest.json" \
CHAIN_NAME_SCHAIN="Test" \
ALLOW_NOT_ATOMIC_UPGRADE="OK" \
VERSION=$VERSION_TAG \
npx hardhat run migrations/upgradeSchain.ts --network localhost

npx kill-port 8545
