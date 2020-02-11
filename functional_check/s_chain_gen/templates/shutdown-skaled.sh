#!/bin/bash
curl -X POST --data '{"jsonrpc":"2.0","method":"skale_shutdownInstance","params":[],"id":1}' http://%%NODE_IP4%%:%%PROXY_PORT%%
