#!/usr/bin/env bash

set -e

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if ! [[ "$CURRENT_BRANCH" =~ [/^\w+-v.*/gm] ]]; then
    echo 'Aborting script: current branch is not a docs branch';
    exit 1
fi

git checkout beta proxy/
cd proxy/
yarn add solidity-docgen@0.5.16 lodash.startcase@^4.4.0
cd ..
if [ -n "$(git status --porcelain)" ]; then
    git commit -m "Merge proxy/ from beta"
    echo "Updated proxy"
else
    echo "Aleady up to date"
fi

echo "Completed proxy folder update check from beta."