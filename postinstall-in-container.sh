#!/bin/bash

echo " "
echo "----- installing in agent ------------------------------------------------------------------"
echo " "
cd ./agent
yarn install
cd ..

echo " "
echo "----- installing in proxy ------------------------------------------------------------------"
echo " "
cd ./proxy
yarn install
cd ..

