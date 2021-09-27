#!/usr/bin/env bash

DEPLOYED_TAG="$(cat "$GITHUB_WORKSPACE"/proxy/DEPLOYED)"
DEPLOYED_VERSION="$(echo "$DEPLOYED_TAG" | cut -d '-' -f 1)"
DEPLOYED_DIR=$GITHUB_WORKSPACE/deployed-proxy/


git clone --branch "$DEPLOYED_TAG" "https://github.com/$GITHUB_REPOSITORY.git" "$DEPLOYED_DIR"

npx ganache-cli --gasLimit 8000000 --quiet &
GANACHE_PID=$!

cd "$DEPLOYED_DIR"
CHAIN_NAME_SCHAIN="Test" VERSION="$DEPLOYED_VERSION" npx hardhat run migrations/deploySkaleManagerComponents.ts --network localhost || exit $?
VERSION="$DEPLOYED_VERSION" npx hardhat run migrations/deployMainnet.ts --network localhost || exit $?
rm "$GITHUB_WORKSPACE/proxy/.openzeppelin/unknown-*.json"
rm "$GITHUB_WORKSPACE/proxy/data/skaleManagerComponents.json"
cp .openzeppelin/unknown-*.json "$GITHUB_WORKSPACE/proxy/.openzeppelin" || exit $?
cp ./data/skaleManagerComponents.json "$GITHUB_WORKSPACE/proxy/data/" || exit $?
ABI_FILENAME="proxyMainnet.json"
cp "data/$ABI_FILENAME" "$GITHUB_WORKSPACE/proxy/data" || exit $?
cd "$GITHUB_WORKSPACE"
rm -r --interactive=never "$DEPLOYED_DIR"
cd proxy

ABI="data/$ABI_FILENAME" npx hardhat run migrations/upgradeMainnet.ts --network localhost || exit $?

kill "$GANACHE_PID"
