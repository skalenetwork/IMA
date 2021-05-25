#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."
ARTIFACTS_DIR="src/ima_predeployed/artifacts/"
mkdir -p src/ima_predeployed/artifacts/
cp -v ../node_modules/@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json $ARTIFACTS_DIR
cp -v ../node_modules/@openzeppelin/upgrades-core/artifacts/AdminUpgradeabilityProxy.json $ARTIFACTS_DIR
cp -v ../artifacts/contracts/schain/*/*.json $ARTIFACTS_DIR
cp -v ../artifacts/contracts/schain/*/*/*.json $ARTIFACTS_DIR
python3 -m build
