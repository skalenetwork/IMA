#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."

python3 -m venv test/venv
source test/venv/bin/activate
pip install dist/ima-predeployed-*.tar.gz
BLOCKCHAIN_DIR="/tmp/blockchain/"
python test/generate_genesis.py test/base_genesis.json test/config.json > test/genesis.json
mkdir "$BLOCKCHAIN_DIR"
geth --datadir "$BLOCKCHAIN_DIR" init test/genesis.json
