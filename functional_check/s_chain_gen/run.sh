#!/bin/bash
echo inside run.sh the SKALED=$SKALED
/bin/bash /home/serge/Work/IMA/functional_check/s_chain_gen/node_00/run-skaled.sh SKALED=$SKALED &>/dev/null &
/bin/bash /home/serge/Work/IMA/functional_check/s_chain_gen/node_01/run-skaled.sh SKALED=$SKALED &>/dev/null &
