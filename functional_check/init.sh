#!/bin/bash
cd s_chain_gen && ./init.sh && cd ..
git clone https://github.com/skalenetwork/skale-manager.git --recursive
cd engine && ./init.sh && cd ..
