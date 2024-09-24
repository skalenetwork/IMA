#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

BLOCKCHAIN_DIR="/tmp/blockchain/"

echo "Run geth in dev mode"
geth --datadir "$BLOCKCHAIN_DIR" --http &
GETH_PID=$!
sleep 3

source venv/bin/activate
export PYTHONPATH=../src
echo $PYTHONPATH
python test.py

kill $GETH_PID
