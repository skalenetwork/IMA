#!/bin/bash

echo " "
echo "----- installing in OWASP ------------------------------------------------------------------"
echo " "
cd ../npms/skale-owasp
yarn install
cd ../../agent

echo " "
echo "----- installing in IMA CORE ---------------------------------------------------------------"
echo " "
cd ../npms/skale-ima
yarn install
cd ../../agent

echo " "
echo "----- installing in IMA OBSERVER -----------------------------------------------------------"
echo " "
cd ../npms/skale-observer
yarn install
cd ../../agent

echo " "
echo "----- installing in SKALE COOL SOCKET ------------------------------------------------------"
echo " "
cd ../npms/skale-cool-socket
yarn install
cd ../../agent
