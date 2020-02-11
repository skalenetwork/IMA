#!/bin/bash
cd s_chain_gen && ./init.sh && cd ..
git clone https://github.com/skalenetwork/skale-manager.git --recursive
cd skale-manager && npm i && cd ..
cd engine && ./init.sh && cd ..
cd ../proxy && npm i && cd ../functional_check
cd ../npms/skale-ima && npm i && cd ../../functional_check
cd ../agent && npm i && cd ../functional_check
