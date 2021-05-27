#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."
./scripts/generate_package_version.py > version.txt
python3 -m twine upload --repository testpypi -u __token__ -p "$PYPI_TOKEN" dist/*
