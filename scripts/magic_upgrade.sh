#!/usr/bin/env bash

set -e


if [[ -z $DEPLOYED_VERSION ]]; then
    echo "Set DEPLOYED_VERSION"
    exit 1
elif [[ ! $DEPLOYED_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+-(beta|stable)\.[0-9]+$ ]]; then
    echo "Version format is not valid"
    exit 1
elif [[ -z $SCHAIN_ID ]]; then
    echo "Set SCHAIN_ID"
    exit 1
elif [[ -z $SCHAIN_NAME ]]; then
    echo "Set SCHAIN_NAME"
    exit 1
elif [[ -z $SAFE_ADDRESS ]]; then
    echo "Set SAFE_ADDRESS"
    exit 1
elif [[ -z $ALLOW_NOT_ATOMIC_UPGRADE ]]; then
    echo "Set ALLOW_NOT_ATOMIC_UPGRADE"
    exit 1
fi

IMA_RELEASES_URL="https://github.com/skalenetwork/IMA/releases/download/"
cd data/
rm -f "ima-$DEPLOYED_VERSION-predeployed-abi.json"
wget "$IMA_RELEASES_URL/$DEPLOYED_VERSION/ima-$DEPLOYED_VERSION-predeployed-abi.json"
cd ../scripts/
wget "$IMA_RELEASES_URL/$DEPLOYED_VERSION/ima-schain-$DEPLOYED_VERSION-manifest.json"
python3 updateManifest.py "ima-schain-$DEPLOYED_VERSION-manifest.json"
mv "ima-schain-$DEPLOYED_VERSION-manifest.json" "../.openzeppelin/unknown-$SCHAIN_ID.json"
cd ..

git clone https://github.com/skalenetwork/skale-network.git
MAINNET_STABLE_IMA_VERSION=$(ls skale-network/releases/mainnet/IMA/ | sort -r | head -n 1)
cp "skale-network/releases/mainnet/IMA/$MAINNET_STABLE_IMA_VERSION/mainnet/abi.json" "data/ima-$MAINNET_STABLE_IMA_VERSION-mainnet-abi.json"
rm -r --interactive=never skale-network/

if [[ $MAINNET_CHAIN_ID != "1" ]]; then
    if [[ $MESSAGE_PROXY_MAINNET_ADDRESS ]]; then
        sed -i '2s/.*/    "message_proxy_mainnet_address": "'"$MESSAGE_PROXY_MAINNET_ADDRESS"'",/' "data/ima-$MAINNET_STABLE_IMA_VERSION-mainnet-abi.json"
    else
        echo "Set MESSAGE_PROXY_MAINNET_ADDRESS"
        exit 1
    fi
fi

deployed=$(cat DEPLOYED)
if [[ $deployed =~ ^([0-9]+\.[0-9]+\.[0-9]+)-stable\.[0-9]+$ ]]; then
    extracted_version="${BASH_REMATCH[1]}"
    original_contents=$(cat migrations/upgradeSchain.ts)
    sed -i "s/\"$extracted_version\"/\"$DEPLOYED_VERSION\"/g" migrations/upgradeSchain.ts
    updated_contents=$(cat migrations/upgradeSchain.ts)
    if [ "$original_contents" = "$updated_contents" ]; then
        echo "Version replacement did not occur."
        exit 1
    fi
else
    echo "Version format is not valid"
    exit 1
fi

SCHAIN_NAME=$SCHAIN_NAME \
ABI="data/ima-$DEPLOYED_VERSION-predeployed-abi.json" \
IMA_ABI="data/ima-$MAINNET_STABLE_IMA_VERSION-mainnet-abi.json" \
MAINNET_CHAIN_ID=$MAINNET_CHAIN_ID \
SAFE_ADDRESS=$SAFE_ADDRESS \
ALLOW_NOT_ATOMIC_UPGRADE=$ALLOW_NOT_ATOMIC_UPGRADE \
VERSION=$VERSION \
npx hardhat run migrations/upgradeSchain.ts --network custom
