#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Required IMA variables

: "${SCHAIN_DIR?Need to set SCHAIN_DIR}"

: "${MAINNET_PROXY_PATH?Need to set MAINNET_PROXY_PATH}"
: "${SCHAIN_PROXY_PATH?Need to set SCHAIN_PROXY_PATH}"

: "${STATE_FILE?Need to set STATE_FILE}"

: "${SCHAIN_NAME?Need to set SCHAIN_NAME}"

: "${SCHAIN_RPC_URL?Need to set SCHAIN_RPC_URL}"
: "${MAINNET_RPC_URL?Need to set MAINNET_RPC_URL}"

: "${NODE_NUMBER?Need to set NODE_NUMBER}"
: "${NODES_COUNT?Need to set NODES_COUNT}"

: "${RPC_PORT?Need to set RPC_PORT}"
: "${MONITORING_PORT?Need to set MONITORING_PORT}"

: "${TM_URL_MAIN_NET?Need to set TM_URL_MAIN_NET}"

# SGX variables

: "${SGX_URL?Need to set SGX_URL}"
: "${ECDSA_KEY_NAME?Need to set ECDSA_KEY_NAME}"
: "${BLS_KEY_NAME?Need to set BLS_KEY_NAME}"
: "${SGX_SSL_KEY_PATH?Need to set SGX_SSL_KEY_PATH}"
: "${SGX_SSL_CERT_PATH?Need to set SGX_SSL_CERT_PATH}"
: "${NODE_ADDRESS?Need to set NODE_ADDRESS}"

# Optional IMA variables

export GAS_PRICE_MULTIPLIER=${GAS_PRICE_MULTIPLIER:-2}
export GAS_MULTIPLIER=${GAS_MULTIPLIER:-2}
export VERBOSE=${VERBOSE:-9}

export M2S_TRANSFER_BLOCK_SIZE=${M2S_TRANSFER_BLOCK_SIZE:-4}
export S2M_TRANSFER_BLOCK_SIZE=${S2M_TRANSFER_BLOCK_SIZE:-4}
export S2S_TRANSFER_BLOCK_SIZE=${S2S_TRANSFER_BLOCK_SIZE:-4}
export M2S_MAX_TRANSACTIONS=${M2S_MAX_TRANSACTIONS:-0}
export S2M_MAX_TRANSACTIONS=${S2M_MAX_TRANSACTIONS:-0}
export S2S_MAX_TRANSACTIONS=${S2S_MAX_TRANSACTIONS:-0}
export M2S_AWAIT_BLOCKS=${M2S_AWAIT_BLOCKS:-0}
export S2M_AWAIT_BLOCKS=${S2M_AWAIT_BLOCKS:-0}
export S2S_AWAIT_BLOCKS=${S2S_AWAIT_BLOCKS:-0}
export M2S_AWAIT_TIME=${M2S_AWAIT_TIME:-0}
export S2M_AWAIT_TIME=${S2M_AWAIT_TIME:-0}
export S2S_AWAIT_TIME=${S2S_AWAIT_TIME:-0}

export PERIOD=${PERIOD:-10}
export TIME_FRAMING=${TIME_FRAMING:-300}
export TIME_GAP=${TIME_GAP:-15}

export CID_MAIN_NET=${CID_MAIN_NET:--4}
export CID_SCHAIN=${CID_SCHAIN:--4}

echo "$(date) - Starting IMA agent..."

BASE_OPTIONS="--gas-price-multiplier=$GAS_PRICE_MULTIPLIER \
--gas-multiplier=$GAS_MULTIPLIER \
--verbose=$VERBOSE \
--cross-ima \
--json-rpc-port=$RPC_PORT \
--s2s-enable \
--abi-skale-manager=$MANAGER_ABI_PATH \
--url-main-net=$MAINNET_RPC_URL \
--url-s-chain=$SCHAIN_RPC_URL \
--id-main-net=Mainnet \
--id-s-chain=$SCHAIN_NAME \
--cid-main-net=$CID_MAIN_NET \
--cid-s-chain=$CID_SCHAIN \
--abi-main-net=$MAINNET_PROXY_PATH \
--abi-s-chain=$SCHAIN_PROXY_PATH \
--sgx-url=$SGX_URL \
--sgx-bls-key=$BLS_KEY_NAME \
--sgx-ecdsa-key=$ECDSA_KEY_NAME \
--sgx-ssl-key=$SGX_SSL_KEY_PATH \
--sgx-ssl-cert=$SGX_SSL_CERT_PATH \
--address-main-net=$NODE_ADDRESS \
--address-s-chain=$NODE_ADDRESS \
--sign-messages \
--gathered \
--expose \
--no-expose-security-info \
--skip-dry-run \
--bls-glue=/ima/bls_binaries/bls_glue \
--hash-g1=/ima/bls_binaries/hash_g1 \
--bls-verify=/ima/bls_binaries/verify_bls \
--m2s-transfer-block-size=$M2S_TRANSFER_BLOCK_SIZE \
--s2m-transfer-block-size=$S2M_TRANSFER_BLOCK_SIZE \
--s2s-transfer-block-size=$S2S_TRANSFER_BLOCK_SIZE \
--m2s-max-transactions=$M2S_MAX_TRANSACTIONS \
--s2m-max-transactions=$S2M_MAX_TRANSACTIONS \
--s2s-max-transactions=$S2S_MAX_TRANSACTIONS \
--m2s-await-blocks=$M2S_AWAIT_BLOCKS \
--s2m-await-blocks=$S2M_AWAIT_BLOCKS \
--s2s-await-blocks=$S2S_AWAIT_BLOCKS \
--m2s-await-time=$M2S_AWAIT_TIME \
--s2m-await-time=$S2M_AWAIT_TIME \
--s2s-await-time=$S2S_AWAIT_TIME \
--period=$PERIOD \
--node-number=$NODE_NUMBER \
--nodes-count=$NODES_COUNT \
--time-framing=$TIME_FRAMING \
--tm-url-main-net=$TM_URL_MAIN_NET \
--time-gap=$TIME_GAP \
--monitoring-port=$MONITORING_PORT \
--pwa \
--no-expose-pwa \
--auto-exit=86400"

echo "Running loop cmd..."
node "$DIR/main.mjs" --loop $BASE_OPTIONS
