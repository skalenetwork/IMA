#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

killall -9 geth || true
echo "--- Checking there are no old geth instances are still running..."
ps -A | grep geth

BLOCKCHAIN_DIR="/tmp/blockchain/"
#BLOCKCHAIN_DIR="$(pwd)/blockchain/"

geth --datadir $BLOCKCHAIN_DIR --dev --http &
GETH_PID=$!
echo --- GETH_PID=$GETH_PID
echo "--- Sleeping to let new geth instance geth start..."
sleep 20
echo "--- Checking new geth instance geth is running..."
ps -lax | grep geth
echo "--- Done"

source venv/bin/activate
pip install -r requirements.txt
python test.py

kill $GETH_PID
