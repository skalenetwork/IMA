#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."
mkdir -p src/ima_predeployed/artifacts/
cp -v ../node_modules/@openzeppelin/upgrades/build/contracts/ProxyAdmin.json src/ima_predeployed/artifacts/
cp -v ../node_modules/@openzeppelin/upgrades/build/contracts/AdminUpgradeabilityProxy.json src/ima_predeployed/artifacts/
python3 -m build
