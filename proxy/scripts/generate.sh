#!/usr/bin/env bash

pwd
cp ./test/contracts/Test* ./contracts/.
./node_modules/.bin/truffle compile
typechain --target truffle './build/**/*.json'
rm contracts/Test*

exit