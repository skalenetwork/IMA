#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

BLOCKCHAIN_DIR="/tmp/blockchain/"

# run geth to initialize ancient database
# TODO: remove when geth fixes --dev mode
echo "Run geth to initialize ancient database"
geth --datadir "$BLOCKCHAIN_DIR" &
GETH_PID=$!
sleep 1
echo "Geth PID=$GETH_PID"
kill -SIGINT $GETH_PID
echo "Stop geth"
wait $GETH_PID

echo "Run geth in dev mode"
geth --datadir "$BLOCKCHAIN_DIR" --dev --http &
GETH_PID=$!
sleep 3

source venv/bin/activate
pip install -r requirements.txt
python test.py

kill $GETH_PID
