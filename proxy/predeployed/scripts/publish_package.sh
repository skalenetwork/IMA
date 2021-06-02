#!/usr/bin/env bash

set -e

cd "$(dirname "$0")/.."
python3 -m twine upload -u __token__ -p "$PYPI_TOKEN" dist/*
