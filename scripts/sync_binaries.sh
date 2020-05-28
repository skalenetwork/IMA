#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

: "${AWS_ACCESS_KEY_ID?Need to set AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY?Need to set AWS_SECRET_ACCESS_KEY}"

if [ "$INSTALL_AWS_CLI" = true ]; then
    sudo pip3 install awscli
fi

aws s3 sync s3://skale-binaries $DIR/bls_binaries
