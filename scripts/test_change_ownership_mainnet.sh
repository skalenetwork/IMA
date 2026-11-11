#!/usr/bin/env bash

# Tests migrations/changeOwnershipMainnet.ts on a local hardhat node.
# In every scenario the deployer (old owner, EOA) holds DEFAULT_ADMIN_ROLE and extra roles.
#   1. EOA -> EOA:  one ProxyAdmin per proxy, owned by the deployer
#   2. EOA -> Safe: one ProxyAdmin per proxy, already owned by the Safe (SafeMock)
#   3. EOA -> Safe: one ProxyAdmin shared by all proxies, owned by the deployer
#
# The contracts are built from the current sources, but their version() is set to the
# DEPLOYED version. skale-contracts resolves an instance by downloading the ABI of the
# version() reported on-chain, and the ABI of an unreleased version (the VERSION file)
# is not published yet.

set -e

if [ -z "$GITHUB_WORKSPACE" ]
then
    GITHUB_WORKSPACE=$(git rev-parse --show-toplevel)
fi
cd "$GITHUB_WORKSPACE"

PORT=${PORT:-8545}
NODE_LOG=$(mktemp)
STATE_FILE=$(mktemp)

node_responds() {
    curl -s -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
        "http://127.0.0.1:$PORT" > /dev/null
}

# A node started by a previous CI step may still be shutting down
for _ in $(seq 1 30)
do
    if ! node_responds
    then
        break
    fi
    sleep 1
done
if node_responds
then
    echo "Port $PORT is already in use. Stop the node running there or set PORT"
    exit 1
fi

# Run the hardhat binary directly (not via npx) so that NODE_PID is the node process itself
./node_modules/.bin/hardhat node --port "$PORT" > "$NODE_LOG" 2>&1 &
NODE_PID=$!

cleanup() {
    echo "Stopping hardhat node"
    kill "$NODE_PID" 2> /dev/null || true
    wait "$NODE_PID" 2> /dev/null || true
    rm -f "$NODE_LOG" "$STATE_FILE"
}
trap cleanup EXIT

NODE_READY=false
for _ in $(seq 1 60)
do
    if ! kill -0 "$NODE_PID" 2> /dev/null
    then
        break
    fi
    if node_responds
    then
        NODE_READY=true
        break
    fi
    sleep 1
done
if [ "$NODE_READY" != true ]
then
    cat "$NODE_LOG"
    echo "Hardhat node failed to start"
    exit 1
fi

# First default hardhat account. Local test key only.
export PRIVATE_KEY_FOR_ETHEREUM="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export PRIVATE_KEY_FOR_SCHAIN="$PRIVATE_KEY_FOR_ETHEREUM"
export URL_W3_ETHEREUM="http://127.0.0.1:$PORT"
export CHAIN_NAME_SCHAIN="Test"
export ABI="data/proxyMainnet.json"
export STATE_FILE
DEPLOYED_VERSION="$(cat DEPLOYED)"

deploy() {
    npx hardhat run migrations/deploySkaleManagerComponents.ts --network mainnet
    SKALE_MANAGER_ADDRESS=$(jq -r .skale_manager_address < data/skaleManagerComponents.json) \
    VERSION="$DEPLOYED_VERSION" \
    npx hardhat run migrations/deployMainnet.ts --network mainnet
}

change_ownership() {
    TEST_MODE=true \
    TARGET="$(jq -r .message_proxy_mainnet_address < "$ABI")" \
    NEW_OWNER="$(jq -r .newOwner < "$STATE_FILE")" \
    npx hardhat run migrations/changeOwnershipMainnet.ts --network mainnet
}

# run_scenario <new owner: eoa|safe> <ProxyAdmin layout: per-proxy|shared> <ProxyAdmin owner: old|new>
run_scenario() {
    echo "=== Scenario: EOA -> $1, $2 ProxyAdmin owned by the $3 owner ==="
    deploy
    ACTION=prepare NEW_OWNER_TYPE="$1" PROXY_ADMIN="$2" PROXY_ADMIN_OWNER="$3" \
    npx hardhat run scripts/changeOwnershipMainnetTestHelper.ts --network mainnet
    change_ownership
    ACTION=verify npx hardhat run scripts/changeOwnershipMainnetTestHelper.ts --network mainnet
    echo "=== Running again: nothing should be left to do ==="
    change_ownership
    ACTION=verify npx hardhat run scripts/changeOwnershipMainnetTestHelper.ts --network mainnet
}

run_scenario eoa per-proxy old
run_scenario safe per-proxy new
run_scenario safe shared old

echo "Change ownership test passed"
