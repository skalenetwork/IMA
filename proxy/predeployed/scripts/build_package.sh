#!/usr/bin/env bash

set -e
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd "$(dirname "$0")/.."
./scripts/generate_package_version.py > version.txt
python3 $SCRIPT_DIR/prepare_artifacts.py
python3 -m build
