#!/bin/bash

DIRECTORY_OF_THIS_SCRIPT="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
DIRECTORY_WITH_TESTS=$DIRECTORY_OF_THIS_SCRIPT/test
DIRECTORY_WITH_TEST_TOKENS=$DIRECTORY_OF_THIS_SCRIPT/test-tokens

echo " "
if [ -d "$DIRECTORY_WITH_TESTS" ] 
then
    echo " "
    echo "----- installing in test -------------------------------------------------------------------"
    echo " "
    cd ./test
    yarn install
    cd ..
else
    echo "We do not have directory with tests at path $DIRECTORY_WITH_TESTS" 
fi

echo " "
echo "----- installing in proxy ------------------------------------------------------------------"
echo " "
cd ./proxy
yarn install
cd ..

if [ -d "$DIRECTORY_WITH_TEST_TOKENS" ] 
then
    echo " "
    echo "----- installing in test-tokens ------------------------------------------------------------"
    echo " "
    cd ./test-tokens
    yarn install 
    cd ..
else
    echo "We do not have directory with test tokens at path $DIRECTORY_WITH_TEST_TOKENS" 
fi
