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


DEPLOYED_TAG="$(cat "$GITHUB_WORKSPACE"/DEPLOYED)"
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
yarn install
PRIVATE_KEY_FOR_ETHEREUM=$(cat "$ACCOUNTS_FILENAME" | jq -r  '.private_keys | to_entries | .[8].value')
PRIVATE_KEY_FOR_SCHAIN=$(cat "$ACCOUNTS_FILENAME" | jq -r '.private_keys | to_entries | .[0].value')
URL_W3_S_CHAIN="http://127.0.0.1:8545"

CHAIN_NAME_SCHAIN="Test" \
VERSION="$DEPLOYED_VERSION" \
PRIVATE_KEY_FOR_ETHEREUM="$PRIVATE_KEY_FOR_ETHEREUM" \
PRIVATE_KEY_FOR_SCHAIN="$PRIVATE_KEY_FOR_SCHAIN" \
npx hardhat run migrations/deploySkaleManagerComponents.ts --network localhost
# TODO: remove this line after upgrading to 2.2.0
perl -0777 -i -pe 's/await contractManagerInst\.setContractsAddress\( "MessageProxyForMainnet",[^\}]*console\.log\( "Successfully registered MessageProxy in ContractManager" \);/await contractManagerInst.setContractsAddress( "MessageProxyForMainnet", deployed.get( "MessageProxyForMainnet" )?.address);\nawait contractManagerInst.setContractsAddress( "CommunityPool", deployed.get( "CommunityPool" )?.address);\nawait contractManagerInst.setContractsAddress( "Linker", deployed.get( "Linker" )?.address);\nfor (const contractName of contractsToDeploy) {\n    const contract = deployed.get(contractName);\n    if (contract === undefined) {\n        throw new Error(`\${contractName} was not found`);\n    }\n    await contractManagerInst.setContractsAddress( contractName, contract.address);\n}\nconsole.log( "Successfully registered MessageProxy in ContractManager" );/s' migrations/deployMainnet.ts
# end of TODO
SKALE_MANAGER=$(cat data/skaleManagerComponents.json | jq -r .skale_manager_address)
VERSION="$DEPLOYED_VERSION" TARGET=$SKALE_MANAGER npx hardhat run migrations/deployMainnet.ts --network localhost


CHAIN_NAME_SCHAIN="Test" \
VERSION="$DEPLOYED_VERSION" \
URL_W3_S_CHAIN="$URL_W3_S_CHAIN" \
PRIVATE_KEY_FOR_SCHAIN="$PRIVATE_KEY_FOR_SCHAIN" \
npx hardhat run migrations/deploySchain.ts --network schain

ABI_FILENAME_SCHAIN="proxySchain_Test.json"
ABI="data/$ABI_FILENAME_SCHAIN" \
MANIFEST=".openzeppelin/unknown-1337.json" \
VERSION="$DEPLOYED_VERSION" \
npx hardhat run migrations/changeManifest.ts --network localhost

cp .openzeppelin/unknown-*.json "$GITHUB_WORKSPACE/.openzeppelin"
cp ./data/skaleManagerComponents.json "$GITHUB_WORKSPACE/data/"
cp "data/proxyMainnet.json" "$GITHUB_WORKSPACE/data"
cp "./data/ima-schain-$DEPLOYED_VERSION-manifest.json" "$GITHUB_WORKSPACE/data/"
cp "data/$ABI_FILENAME_SCHAIN" "$GITHUB_WORKSPACE/data"
cd "$GITHUB_WORKSPACE"
rm -r --interactive=never "$DEPLOYED_DIR"

MESSAGE_PROXY_FOR_MAINNET=$(cat data/proxyMainnet.json | jq -r .message_proxy_mainnet_address)
TEST_UPGRADE=true \
ABI="data/proxyMainnet.json" \
TARGET="$MESSAGE_PROXY_FOR_MAINNET" \
ALLOW_NOT_ATOMIC_UPGRADE="OK" \
VERSION=$VERSION_TAG \
npx hardhat run migrations/upgradeMainnet.ts --network localhost

VERSION="$(git describe --tags | echo "$VERSION_TAG")"
echo "$VERSION"

MESSAGE_PROXY_FOR_SCHAIN=$(cat data/$ABI_FILENAME_SCHAIN | jq -r .message_proxy_chain_address)

# TODO: uncomment upgrade schain test after fixing the issue related to skale-contracts
# ABI="data/$ABI_FILENAME_SCHAIN" \
# MANIFEST="data/ima-schain-$DEPLOYED_VERSION-manifest.json" \
# CHAIN_NAME_SCHAIN="Test" \
# ALLOW_NOT_ATOMIC_UPGRADE="OK" \
# TARGET="$MESSAGE_PROXY_FOR_SCHAIN" \
# VERSION=$VERSION_TAG \
# URL_W3_S_CHAIN="$URL_W3_S_CHAIN" \
# PRIVATE_KEY_FOR_SCHAIN="$PRIVATE_KEY_FOR_SCHAIN" \
# npx hardhat run migrations/upgradeSchain.ts --network schain

npx ganache instances stop "$GANACHE"
