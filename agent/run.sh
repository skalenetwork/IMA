#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

: "${SCHAIN_DIR?Need to set SCHAIN_DIR}"

: "${MAINNET_PROXY_PATH?Need to set MAINNET_PROXY_PATH}"
: "${SCHAIN_PROXY_PATH?Need to set SCHAIN_PROXY_PATH}"

: "${SCHAIN_NAME?Need to set SCHAIN_NAME}"

: "${SCHAIN_RPC_URL?Need to set SCHAIN_RPC_URL}"
: "${MAINNET_RPC_URL?Need to set MAINNET_RPC_URL}"

: "${NODE_NUMBER?Need to set NODE_NUMBER}"
: "${NODES_COUNT?Need to set NODES_COUNT}"

echo $(date) - Starting IMA agent...
echo Params provided to the run.sh:
echo MAINNET_PROXY_PATH: $MAINNET_PROXY_PATH
echo SCHAIN_PROXY_PATH: $SCHAIN_PROXY_PATH
echo SCHAIN_NAME: $SCHAIN_NAME
echo SCHAIN_RPC_URL: $SCHAIN_RPC_URL
echo MAINNET_RPC_URL: $MAINNET_RPC_URL
echo NODE_NUMBER: $NODE_NUMBER
echo NODES_COUNT: $NODES_COUNT

$DIR/main.js --url-main-net=$MAINNET_RPC_URL --url-s-chain=$SCHAIN_RPC_URL \
            --id-main-net=Mainnet --id-s-chain=$SCHAIN_NAME --abi-main-net=$MAINNET_PROXY_PATH \
            --node-number=$NODE_NUMBER --nodes-count=$NODES_COUNT  \
            --abi-s-chain=$SCHAIN_PROXY_PATH --period 5 \
            --loop \
            --sign-messages \
            --bls-glue=/ima/bls_binaries/bls_glue \
            --hash-g1=/ima/bls_binaries/hash_g1 \
            --bls-verify=/ima/bls_binaries/verify_bls
