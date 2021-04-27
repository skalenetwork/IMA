#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."
cp ../node_modules/@openzeppelin/upgrades/build/contracts/ProxyAdmin.json src/ima_predeployed/artifacts
python3 -m build
