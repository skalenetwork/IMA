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

# SGX variables

: "${SGX_URL?Need to set SGX_URL}"
: "${ECDSA_KEY_NAME?Need to set ECDSA_KEY_NAME}"
: "${SGX_SSL_KEY_PATH?Need to set SGX_SSL_KEY_PATH}"
: "${SGX_SSL_CERT_PATH?Need to set SGX_SSL_CERT_PATH}"
: "${NODE_ADDRESS?Need to set NODE_ADDRESS}"

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

BASE_OPTIONS="--gas-price-multiplier=$GAS_PRICE_MULTIPLIER \
    --verbose=$VERBOSE \
    --url-main-net=$MAINNET_RPC_URL \
    --url-s-chain=$SCHAIN_RPC_URL \
    --id-main-net=Mainnet \
    --id-s-chain=$SCHAIN_NAME \
    --cid-main-net=$CID_MAIN_NET \
    --cid-s-chain=$CID_SCHAIN \
    --abi-main-net=$MAINNET_PROXY_PATH \
    --abi-s-chain=$SCHAIN_PROXY_PATH \
    --sgx-url-main-net=$SGX_URL \
    --sgx-url-s-chain=$SGX_URL \
    --sgx-ecdsa-key-main-net=$ECDSA_KEY_NAME \
    --sgx-ecdsa-key-s-chain=$ECDSA_KEY_NAME \
    --sgx-ssl-key-main-net=$SGX_SSL_KEY_PATH \
    --sgx-ssl-key-s-chain=$SGX_SSL_KEY_PATH \
    --sgx-ssl-cert-main-net=$SGX_SSL_CERT_PATH \
    --sgx-ssl-cert-s-chain=$SGX_SSL_CERT_PATH \
    --address-main-net=$NODE_ADDRESS \
    --address-s-chain=$NODE_ADDRESS \
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
    --time-gap=$TIME_GAP"

echo Base options:
echo $BASE_OPTIONS

echo Going to run: node $DIR/main.js --check-registration $BASE_OPTIONS
node $DIR/main.js --check-registration $BASE_OPTIONS

if [ $? -eq 0 ]
then
    echo "IMA is already registered"
else
    echo "IMA is not registered yet"
    echo Going to run: node $DIR/main.js --register $BASE_OPTIONS
    node $DIR/main.js --register $BASE_OPTIONS || true
fi

echo "Running loop cmd..."
echo Going to run: node $DIR/main.js --loop $BASE_OPTIONS
node $DIR/main.js --loop $BASE_OPTIONS
