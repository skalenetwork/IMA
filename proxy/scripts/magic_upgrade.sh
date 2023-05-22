#!/usr/bin/env bash

set -e


IMA_RELEASES_URL="https://github.com/skalenetwork/IMA/releases/download/"
cd data/
rm -f ima-$DEPLOYED_VERSION-predeployed-abi.json
wget $IMA_RELEASES_URL/$DEPLOYED_VERSION/ima-$DEPLOYED_VERSION-predeployed-abi.json
cd ../scripts/
wget $IMA_RELEASES_URL/$DEPLOYED_VERSION/ima-schain-$DEPLOYED_VERSION-manifest.json
python3 change_manifest.py ima-schain-$DEPLOYED_VERSION-manifest.json
mv ima-schain-$DEPLOYED_VERSION-manifest.json ../.openzeppelin/unknown-$SCHAIN_ID.json
cd ..

git clone https://github.com/skalenetwork/skale-network.git
LATEST_STABLE_IMA_VERSION=$(ls skale-network/releases/mainnet/IMA/ | sort -r | head -n 1)
cp skale-network/releases/mainnet/IMA/$LATEST_STABLE_IMA_VERSION/mainnet/abi.json data/ima-$LATEST_STABLE_IMA_VERSION-mainnet-abi.json
rm -r --interactive=never skale-network/

if [[ $MAINNET_CHAIN_ID != "1" ]]; then
    if [[ $MESSAGE_PROXY_MAINNET_ADDRESS ]]; then
        sed -i '2s/.*/    "message_proxy_mainnet_address": "'"$MESSAGE_PROXY_MAINNET_ADDRESS"'",/' data/ima-$LATEST_STABLE_IMA_VERSION-mainnet-abi.json
    else
        echo "Define MESSAGE_PROXY_MAINNET_ADDRESS."
        exit 1
    fi
fi


#sed version inside upgrade script

SCHAIN_NAME=$SCHAIN_NAME \
ABI="data/ima-$DEPLOYED_VERSION-predeployed-abi.json" \
IMA_ABI="data/ima-$LATEST_STABLE_IMA_VERSION-mainnet-abi.json" \
MAINNET_CHAIN_ID=$MAINNET_CHAIN_ID \
SAFE_ADDRESS=$SAFE_ADDRESS \
ALLOW_NOT_ATOMIC_UPGRADE="OK" \
npx hardhat run migrations/upgradeSchain.ts --network custom
