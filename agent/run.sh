#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Required IMA variables

: "${SCHAIN_DIR?Need to set SCHAIN_DIR}"

: "${MAINNET_PROXY_PATH?Need to set MAINNET_PROXY_PATH}"
: "${SCHAIN_PROXY_PATH?Need to set SCHAIN_PROXY_PATH}"

: "${SCHAIN_NAME?Need to set SCHAIN_NAME}"

: "${SCHAIN_RPC_URL?Need to set SCHAIN_RPC_URL}"
: "${MAINNET_RPC_URL?Need to set MAINNET_RPC_URL}"

: "${NODE_NUMBER?Need to set NODE_NUMBER}"
: "${NODES_COUNT?Need to set NODES_COUNT}"

# Optional IMA variables

export GAS_PRICE_MULTIPLIER=${GAS_PRICE_MULTIPLIER:-2}
export VERBOSE=${VERBOSE:-9}

export M2S_TRANSFER_BLOCK_SIZE=${M2S_TRANSFER_BLOCK_SIZE:-10}
export S2M_TRANSFER_BLOCK_SIZE=${S2M_TRANSFER_BLOCK_SIZE:-10}
export M2S_MAX_TRANSACTIONS=${M2S_MAX_TRANSACTIONS:-0}
export S2M_MAX_TRANSACTIONS=${S2M_MAX_TRANSACTIONS:-0}
export M2S_AWAIT_BLOCKS=${M2S_AWAIT_BLOCKS:-0}
export S2M_AWAIT_BLOCKS=${S2M_AWAIT_BLOCKS:-0}
export M2S_AWAIT_TIME=${M2S_AWAIT_TIME:-0}
export S2M_AWAIT_TIME=${S2M_AWAIT_TIME:-0}

export PERIOD=${PERIOD:-10}
export TIME_FRAMING=${TIME_FRAMING:-60}
export TIME_GAP=${TIME_GAP:-10}

export CID_MAIN_NET=${CID_MAIN_NET:--4}
export CID_SCHAIN=${CID_SCHAIN:--4}

echo $(date) - Starting IMA agent...
echo Params provided to the run.sh:
echo MAINNET_PROXY_PATH: $MAINNET_PROXY_PATH
echo SCHAIN_PROXY_PATH: $SCHAIN_PROXY_PATH
echo SCHAIN_NAME: $SCHAIN_NAME
echo SCHAIN_RPC_URL: $SCHAIN_RPC_URL
echo MAINNET_RPC_URL: $MAINNET_RPC_URL
echo NODE_NUMBER: $NODE_NUMBER
echo NODES_COUNT: $NODES_COUNT

$DIR/main.js  \
    --loop \
    --gas-price-multiplier=$GAS_PRICE_MULTIPLIER \
    --verbose=$VERBOSE \
    --url-main-net=$MAINNET_RPC_URL \
    --url-s-chain=$SCHAIN_RPC_URL \
    --id-main-net=Mainnet \
    --id-s-chain=$SCHAIN_NAME \
    --cid-main-net=$CID_MAIN_NET \
    --cid-s-chain=$CID_SCHAIN \
    --abi-main-net=$MAINNET_PROXY_PATH \
    --abi-s-chain=$SCHAIN_PROXY_PATH \
    # --key-main-net= \
    # --key-s-chain= \ 
    --sign-messages \
    --bls-glue=/ima/bls_binaries/bls_glue \
    --hash-g1=/ima/bls_binaries/hash_g1 \
    --bls-verify=/ima/bls_binaries/verify_bls \
    --m2s-transfer-block-size=$M2S_TRANSFER_BLOCK_SIZE \
    --s2m-transfer-block-size=$S2M_TRANSFER_BLOCK_SIZE \
    --m2s-max-transactions=$M2S_MAX_TRANSACTIONS \
    --s2m-max-transactions=$S2M_MAX_TRANSACTIONS \
    --m2s-await-blocks=$M2S_AWAIT_BLOCKS \
    --s2m-await-blocks=$S2M_AWAIT_BLOCKS \
    --m2s-await-time=$M2S_AWAIT_TIME \
    --s2m-await-time=$S2M_AWAIT_TIME \
    --period=$PERIOD \
    --node-number=$NODE_NUMBER \
    --nodes-count=$NODES_COUNT \
    --time-framing=$TIME_FRAMING \
    --time-gap=$TIME_GAP
