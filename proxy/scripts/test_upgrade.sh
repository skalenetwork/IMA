#!/usr/bin/env bash

DEPLOYED_TAG="$(cat "$GITHUB_WORKSPACE"/proxy/DEPLOYED)"
DEPLOYED_VERSION="$(echo "$DEPLOYED_TAG" | cut -d '-' -f 1)"
DEPLOYED_DIR=$GITHUB_WORKSPACE/deployed-proxy/


git clone --branch "$DEPLOYED_TAG" "https://github.com/$GITHUB_REPOSITORY.git" "$DEPLOYED_DIR"

npx ganache-cli --gasLimit 9000000 --quiet --allowUnlimitedContractSize &
GANACHE_PID=$!

cd "$DEPLOYED_DIR"
cd proxy
yarn install
CHAIN_NAME_SCHAIN="Test" VERSION="$DEPLOYED_VERSION" npx hardhat run migrations/deploySkaleManagerComponents.ts --network localhost || exit $?
VERSION="$DEPLOYED_VERSION" npx hardhat run migrations/deployMainnet.ts --network localhost || exit $?
rm ./migrations/deploySchain.ts
curl -o ./migrations/deploySchain.ts https://raw.githubusercontent.com/skalenetwork/IMA/deploy-script-for-1.0.0-stable.1/proxy/migrations/deploySchain.ts
CHAIN_NAME_SCHAIN="Test" VERSION="$DEPLOYED_VERSION" npx hardhat run migrations/deploySchain.ts --network localhost || exit $?
cp "$GITHUB_WORKSPACE/proxy/migrations/generateManifest.ts" ./migrations/generateManifest.ts
cp "$GITHUB_WORKSPACE/proxy/migrations/changeManifest.ts" ./migrations/changeManifest.ts
cp "$GITHUB_WORKSPACE/proxy/migrations/tools/version.ts" ./migrations/tools/version.ts
ABI_FILENAME_SCHAIN="proxySchain_Test.json"
ABI="data/$ABI_FILENAME_SCHAIN" MANIFEST=".openzeppelin/unknown-1337.json" VERSION="$DEPLOYED_VERSION" npx hardhat run migrations/changeManifest.ts --network localhost || exit $?

rm "$GITHUB_WORKSPACE"/proxy/.openzeppelin/unknown-*.json
rm "$GITHUB_WORKSPACE/proxy/data/skaleManagerComponents.json"
rm "$GITHUB_WORKSPACE/proxy/data/ima-schain-$DEPLOYED_VERSION-manifest.json"
cp .openzeppelin/unknown-*.json "$GITHUB_WORKSPACE/proxy/.openzeppelin" || exit $?
cp ./data/skaleManagerComponents.json "$GITHUB_WORKSPACE/proxy/data/" || exit $?
cp "./data/ima-schain-$DEPLOYED_VERSION-manifest.json" "$GITHUB_WORKSPACE/proxy/data/" || exit $?
ABI_FILENAME_MAINNET="proxyMainnet.json"
cp "data/$ABI_FILENAME_MAINNET" "$GITHUB_WORKSPACE/proxy/data" || exit $?
cp "data/$ABI_FILENAME_SCHAIN" "$GITHUB_WORKSPACE/proxy/data" || exit $?
cd "$GITHUB_WORKSPACE"
rm -r --interactive=never "$DEPLOYED_DIR"
cd proxy

ABI="data/$ABI_FILENAME_MAINNET" TEST_UPGRADE=true npx hardhat run migrations/upgradeMainnet.ts --network localhost || exit $?

ABI="data/$ABI_FILENAME_SCHAIN" MANIFEST="data/ima-schain-$DEPLOYED_VERSION-manifest.json" npx hardhat run migrations/upgradeSchain.ts --network localhost || exit $?

kill "$GANACHE_PID"
