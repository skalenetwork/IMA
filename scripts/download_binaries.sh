#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

: "${LIB_BLS_RELEASE_TAG?Need to set LIB_BLS_RELEASE_TAG}"

BASE_URL="https://github.com/skalenetwork/libBLS/releases/download"

BLS_GLUE_URL=$BASE_URL/$LIB_BLS_RELEASE_TAG/bls_glue
HASH_G1_URL=$BASE_URL/$LIB_BLS_RELEASE_TAG/hash_g1
BLS_VERIFY_URL=$BASE_URL/$LIB_BLS_RELEASE_TAG/verify_bls

echo "Downloading BLS binaries..."
curl -L "$BLS_GLUE_URL" > "$DIR/bls_binaries/bls_glue"
curl -L "$HASH_G1_URL" > "$DIR/bls_binaries/hash_g1"
curl -L "$BLS_VERIFY_URL" > "$DIR/bls_binaries/verify_bls"
