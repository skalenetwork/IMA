#!/usr/bin/env bash

set -e

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if ! [[ "$CURRENT_BRANCH" =~ [/^\w+-v.*/gm] ]]; then
    echo 'Aborting script: current branch is not a docs branch';
    exit 1
fi

git checkout develop proxy/
git commit -m "Merge proxy/ from develop"
yarn docs

echo "Completed inline doc update."