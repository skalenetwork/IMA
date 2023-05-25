#!/bin/bash

echo " "
echo "----- installing in agent ------------------------------------------------------------------"
echo " "
cd ./agent
yarn install
cd ..

echo " "
echo "----- installing in test -------------------------------------------------------------------"
echo " "
cd ./test
yarn install
cd ..

echo " "
echo "----- installing in proxy ------------------------------------------------------------------"
echo " "
cd ./proxy
yarn install
cd ..

echo " "
echo "----- installing in test-tokens ------------------------------------------------------------"
echo " "
cd ./test-tokens
yarn install 
cd ..
