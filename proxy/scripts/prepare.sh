#!/usr/bin/env bash

export $(cat .env | xargs)
cd data
sudo apt-get -y install jq
git clone -b stable https://${GITHUB_TOKEN}\@github.com/skalenetwork/skale-manager.git &&
cd skale-manager &&
npm install &&
#PRIVATE_KEY=${MNEMONIC_FOR_MAINNET} ENDPOINT=${MAINNET_RPC_URL} ./node_modules/.bin/truffle migrate --network unique
./node_modules/.bin/truffle migrate --network test
cd data
export SKALE_VERIFIER_ADDRESS=$( jq .skale_verifier_address test.json )
echo ${SKALE_VERIFIER_ADDRESS}
cd ../../
rm -rf skale-manager

exit