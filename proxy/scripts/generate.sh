#!/usr/bin/env bash

./node_modules/.bin/truffle compile
typechain --target truffle './build/**/*.json'

exit