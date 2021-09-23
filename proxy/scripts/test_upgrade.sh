#!/usr/bin/env bash

DEPLOYED_TAG=$(cat $GITHUB_WORKSPACE/DEPLOYED)
DEPLOYED_VERSION=$(echo $DEPLOYED_TAG | cut -d '-' -f 1)
DEPLOYED_DIR=$GITHUB_WORKSPACE/deployed-proxy/

# TODO: remove when upgrade proxy with using new node js
# or install old version of node
if [[ $DEPLOYED_VERSION == "1.0.0" ]] && [[ $NODE_VERSION != 12.* ]]
then
    echo "Skip upgrade check because of incompatible node.js version"
    exit 0
fi

git clone --branch $DEPLOYED_TAG https://github.com/$GITHUB_REPOSITORY.git $DEPLOYED_DIR

npx ganache-cli --gasLimit 8000000 --quiet &
GANACHE_PID=$!

cd $DEPLOYED_DIR
yarn install || exit $?
cd proxy
PRODUCTION=true VERSION=$DEPLOYED_VERSION npx hardhat run migrations/deployMainnet.ts --network localhost || exit $?
rm $GITHUB_WORKSPACE/.openzeppelin/unknown-*.json
cp .openzeppelin/unknown-*.json $GITHUB_WORKSPACE/.openzeppelin || exit $?
ABI_FILENAME="proxyMainnet.json"
cp "data/$ABI_FILENAME" "$GITHUB_WORKSPACE/data" || exit $?
cd $GITHUB_WORKSPACE
rm -r --interactive=never $DEPLOYED_DIR

ABI="data/$ABI_FILENAME" npx hardhat run migrations/upgrade.ts --network localhost || exit $?

kill $GANACHE_PID
