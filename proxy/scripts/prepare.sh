#!/usr/bin/env bash

export $(cat .env | xargs)
cd data || { echo "Failure: data directory not found"; exit 1; }
sudo apt-get -y install jq
git clone -b enhancement/Upgrade-SkaleVerifier https://${GITHUB_TOKEN}\@github.com/skalenetwork/skale-manager.git &&
cd skale-manager &&
npm install &&
#PRIVATE_KEY=${MNEMONIC_FOR_MAINNET} ENDPOINT=${MAINNET_RPC_URL} ./node_modules/.bin/truffle migrate --network unique
./node_modules/.bin/truffle migrate --network test
cd data || { echo "Failure: data directory not found"; exit 1; }
export CONTRACT_MANAGER_ADDRESS=$( jq .contract_manager_address test.json )
cp test.json ../../.
cd ../../
rm -rf skale-manager

exit