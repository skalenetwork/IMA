#!/usr/bin/env bash

set -e

yarn compile
VERSION=$(cat ../VERSION)
VERSION=$VERSION ./predeployed/scripts/build_package.sh
./predeployed/test/prepare_environment.sh
./predeployed/test/test.sh