#!/usr/bin/env bash

./node_modules/.bin/truffle compile
typechain --target truffle './build/**/*.json'
if [ -f "./test/utils/typings.d.ts" ]; then
    mv ./test/utils/typings.d.ts ./types/truffle-contracts/.
fi

exit