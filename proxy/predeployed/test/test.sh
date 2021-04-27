#!/usr/bin/env bash

set -e

cd "$(dirname "$0")"

geth --datadir /tmp/blockchain/ --dev --http &
GETH_PID=$!

source venv/bin/activate
pip install -r requirements.txt
python test.py

kill $GETH_PID
