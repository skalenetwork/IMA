#!/bin/bash
ulimit -n 65535 > /dev/null
echo "ulimit is now set to" $(ulimit -n)


#cd create_pems; touch index.txt; ./create_pems.sh; cd ..

#killall -9 skaled node > /dev/null

rm -r ./mainnet.log     || true > /dev/null
rm -r ./skaled_??.log   || true > /dev/null
rm -r ./imaAgent_??.log || true > /dev/null

cd ./create_pems && ./create_pems.sh && cd ..

node ./index.js

#echo "Test done... searching zombies..."
#ps -Al | grep node
#ps -Al | grep skaled
#echo "Killing zombies, if any..."
#killall -9 skaled node

echo "Finished"

