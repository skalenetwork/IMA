#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

geth --datadir /tmp/blockchain/ --dev --http &
GETH_PID=$!
echo ----- GETH_PID=$GETH_PID
echo "Sleeping to let geth start..."
sleep 20
echo "Checking geth is running..."
ps -A | grep geth

source venv/bin/activate
pip install -r requirements.txt
python test.py

kill $GETH_PID
