#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."

BLOCKCHAIN_DIR="/tmp/blockchain/"
python test/generate_genesis.py test/base_genesis.json test/config.json > test/genesis.json
rm -r "$BLOCKCHAIN_DIR" || true
mkdir "$BLOCKCHAIN_DIR"
geth --datadir "$BLOCKCHAIN_DIR" init test/genesis.json
