#!/usr/bin/env bash

SCHAIN_RPC_IP=$SCHAIN_RPC_IP SCHAIN_RPC_PORT=$SCHAIN_RPC_PORT SCHAIN_NAME=$SCHAIN_NAME truffle migrate --network $NETWORK --compile-all --reset