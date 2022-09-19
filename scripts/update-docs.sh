#!/usr/bin/env bash

set -e

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if ! [[ "$CURRENT_BRANCH" =~ [/^\w+-v.*/gm] ]]; then
    echo 'Aborting script: current branch is not a docs branch';
    exit 1
fi

git checkout beta proxy/
if [ -n "$(git status --porcelain)" ]; then
    git commit -m "Merge proxy/ from develop"
    echo "Updated proxy"
else
    echo "Aleady up to date"
fi

echo "Completed proxy folder update check from develop."