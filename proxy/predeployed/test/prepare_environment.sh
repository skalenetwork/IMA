#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."

python3 -m venv test/venv
source test/venv/bin/activate
pip install --force-reinstall dist/ima_predeployed-*.whl
BLOCKCHAIN_DIR="/tmp/blockchain/"
python test/generate_genesis.py test/base_genesis.json test/config.json > test/genesis.json
rm -r "$BLOCKCHAIN_DIR" || true
mkdir "$BLOCKCHAIN_DIR"
geth --datadir "$BLOCKCHAIN_DIR" init test/genesis.json
