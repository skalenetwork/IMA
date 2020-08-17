#!/usr/bin/env bash

export $(cat .env | xargs)
cd data
sudo apt-get -y install jq
git clone -b enhancement/Upgrade-SkaleVerifier https://${GITHUB_TOKEN}\@github.com/skalenetwork/skale-manager.git &&
cd skale-manager &&
npm install &&
#PRIVATE_KEY=${PRIVATE_KEY_FOR_ETHEREUM} ENDPOINT=${URL_W3_ETHEREUM} ./node_modules/.bin/truffle migrate --network unique
./node_modules/.bin/truffle migrate --network test
cd data 
export CONTRACT_MANAGER_ADDRESS=$( jq .contract_manager_address test.json )
cp test.json ../../.
cd ../../
rm -rf skale-manager

exit