set -e

# Ensure OpenZeppelin uses mainnet manifest on the forked chainId 31337
cp -f .openzeppelin/mainnet.json .openzeppelin/unknown-31337.json

HARDHAT_NODE_SESSION="hardhat-node"
yarn pm2 start "yarn hardhat node" --name "$HARDHAT_NODE_SESSION"

echo "Node Initialized."

cleanup() {
    echo "Stopping Hardhat Node"
    yarn pm2 delete "$HARDHAT_NODE_SESSION"
    echo "SUCCESS"
}

trap cleanup EXIT

npx hardhat run ./migrations/upgradeMainnet.ts --network hardhat
