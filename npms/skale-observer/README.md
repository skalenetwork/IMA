# SKALE NETWORK BROWSER

## General Description

**SKALE Network Browser** (**SNB**) or **SKALE Observer** is part of IMA responsible for providing description of all SKALE chains. This is done via set of calls to **SKALE Manager**.

**SNB** maintains cache of S-Chain descriptions and refreshes all descriptions periodically. These descriptions and needed for S-Chain to S-Chain IMA message transfers when IMA needs to know how to connect to other S-Chain.

First SKALE network scan is performed by **SNB** on IMA startup. Next network description refreshes are performed periodically.

**SNB** works can work in parallel thread to avoid any delay of main IMA's message transfer loop.

## Implementation details

The `SchainsInternal.numberOfSchains` contract call returns number of created S-Chains to load from **SKALE Manager**. For each of S-Chains we need to get its hash by index what is done `SchainsInternal.schainsAtSystem` contract call. Then contract call to `SchainsInternal.schains` returns basic S-Chain description by hash. Obtained basic S-Chain description does not describe nodes and they must be loaded via set of contract calls. The `SchainsInternal.getNodesInGroup` contract call returns array of node identifiers for all S-Chain nodes. The `Nodes.nodes` contract call returns node description by node id. Returned node description includes IP address, domain name and, base port of a node, maintenance state flag. Then call to `SchainsInternal.getSchainHashesForNode` contract call allows to find effective node base port and compute per-protocol ports (`http`, `https`, `ws`, `wss`).

Cache of S-Chain descriptions is result of download process described above. When new S-Chain descriptions are downloaded, they replace old ones. By default this is performed once in an hour.

S-Chain descriptions directly affect on S-Chain to S-Chain transfers because they contain JSON RPC URLs of all `skaled`s of all S-Chains.

**SNB** can be invoked from command line of IMA agent using `--browse-skale-network` or `--browse-connected-schains` command line options. The`--browse-skale-network` command line options invokes download entire SKALE network description, all S-Chains, all `skaled` nodes. The `--browse-connected-schains` command line options invokes download of which are S-Chains connected to S-Chain with name specified in `--id-s-chain` command line parameter.

Example of **SNB** invocation:

```shell
node agent/main.js --colors --browse-skale-network \
    --abi-skale-manager=.../sm.json \
    --abi-main-net=.../mn.json \
    --abi-s-chain=.../sc.json \
    --url-main-net=http://127.0.0.1:8545 \
    --url-s-chain=http://127.0.0.1:15000 \
    --id-main-net=Mainnet \
    --id-s-chain=Bob1000 \
    --cid-main-net=456 \
    --cid-s-chain=1000 \
    --key-main-net=... \
    --key-s-chain=...
```

Example of downloaded S-Chains description containing 2 S-Chains named `Bob1000` and `Bob1001`, 2 `skaled` nodes each:

```json
[
   {
      "data":{
         "name":"Bob1000",
         "owner":"0x7aa5E36AA15E93D10F4F26357C30F052DacDde5F",
         "indexInOwnerList":"0",
         "partOfNode":"0",
         "lifetime":"5",
         "startDate":"1641992759",
         "startBlock":"249",
         "deposit":"100000000000000000000",
         "index":"0",
         "generation":"0",
         "originator":"0x0000000000000000000000000000000000000000",
         "computed":{
            "ports":{
               "httpRpcPort":2264,
               "httpsRpcPort":2269,
               "wsRpcPort":2263,
               "wssRpcPort":2268,
               "infoHttpRpcPort":2270
            },
            "schain_id":"0x975a4814cff8b9fd85b48879dade195028650b0a23f339ca81bd3b1231f72974",
            "chainId":"0x975a4814cff8b9",
            "nodes":[
               {
                  "id":"0",
                  "name":"Aldo",
                  "ip":"127.0.0.1",
                  "base_port":"2161",
                  "domain":"test.domain.name.here",
                  "isMaintenance":false,
                  "schain_base_port":2161,
                  "http_endpoint_ip":"http://127.0.0.1:2164",
                  "https_endpoint_ip":"https://127.0.0.1:2169",
                  "ws_endpoint_ip":"ws://127.0.0.1:2163",
                  "wss_endpoint_ip":"wss://127.0.0.1:2168",
                  "info_http_endpoint_ip":"http://127.0.0.1:2170",
                  "http_endpoint_domain":"http://test.domain.name.here:2164",
                  "https_endpoint_domain":"https://test.domain.name.here:2169",
                  "ws_endpoint_domain":"ws://test.domain.name.here:2163",
                  "wss_endpoint_domain":"wss://test.domain.name.here:2168",
                  "info_http_endpoint_domain":"http://test.domain.name.here:2170"
               },
               {
                  "id":"1",
                  "name":"Bear",
                  "ip":"127.0.0.2",
                  "base_port":"2261",
                  "domain":"test.domain.name.here",
                  "isMaintenance":false,
                  "schain_base_port":2261,
                  "http_endpoint_ip":"http://127.0.0.2:2264",
                  "https_endpoint_ip":"https://127.0.0.2:2269",
                  "ws_endpoint_ip":"ws://127.0.0.2:2263",
                  "wss_endpoint_ip":"wss://127.0.0.2:2268",
                  "info_http_endpoint_ip":"http://127.0.0.2:2270",
                  "http_endpoint_domain":"http://test.domain.name.here:2264",
                  "https_endpoint_domain":"https://test.domain.name.here:2269",
                  "ws_endpoint_domain":"ws://test.domain.name.here:2263",
                  "wss_endpoint_domain":"wss://test.domain.name.here:2268",
                  "info_http_endpoint_domain":"http://test.domain.name.here:2270"
               }
            ]
         }
      }
   },
   {
      "data":{
         "name":"Bob1001",
         "owner":"0x7aa5E36AA15E93D10F4F26357C30F052DacDde5F",
         "indexInOwnerList":"1",
         "partOfNode":"0",
         "lifetime":"5",
         "startDate":"1641992767",
         "startBlock":"260",
         "deposit":"100000000000000000000",
         "index":"1",
         "generation":"0",
         "originator":"0x0000000000000000000000000000000000000000",
         "computed":{
            "ports":{
               "httpRpcPort":2364,
               "httpsRpcPort":2369,
               "wsRpcPort":2363,
               "wssRpcPort":2368,
               "infoHttpRpcPort":2370
            },
            "schain_id":"0xde9b5e1c7bac0a60f917397dfab6ead3f6441acf0399ec81145568874dd829e9",
            "chainId":"0xde9b5e1c7bac0a",
            "nodes":[
               {
                  "id":"3",
                  "name":"Seed",
                  "ip":"127.0.0.4",
                  "base_port":"2461",
                  "domain":"test.domain.name.here",
                  "isMaintenance":false,
                  "schain_base_port":2461,
                  "http_endpoint_ip":"http://127.0.0.4:2464",
                  "https_endpoint_ip":"https://127.0.0.4:2469",
                  "ws_endpoint_ip":"ws://127.0.0.4:2463",
                  "wss_endpoint_ip":"wss://127.0.0.4:2468",
                  "info_http_endpoint_ip":"http://127.0.0.4:2470",
                  "http_endpoint_domain":"http://test.domain.name.here:2464",
                  "https_endpoint_domain":"https://test.domain.name.here:2469",
                  "ws_endpoint_domain":"ws://test.domain.name.here:2463",
                  "wss_endpoint_domain":"wss://test.domain.name.here:2468",
                  "info_http_endpoint_domain":"http://test.domain.name.here:2470"
               },
               {
                  "id":"2",
                  "name":"John",
                  "ip":"127.0.0.3",
                  "base_port":"2361",
                  "domain":"test.domain.name.here",
                  "isMaintenance":false,
                  "schain_base_port":2361,
                  "http_endpoint_ip":"http://127.0.0.3:2364",
                  "https_endpoint_ip":"https://127.0.0.3:2369",
                  "ws_endpoint_ip":"ws://127.0.0.3:2363",
                  "wss_endpoint_ip":"wss://127.0.0.3:2368",
                  "info_http_endpoint_ip":"http://127.0.0.3:2370",
                  "http_endpoint_domain":"http://test.domain.name.here:2364",
                  "https_endpoint_domain":"https://test.domain.name.here:2369",
                  "ws_endpoint_domain":"ws://test.domain.name.here:2363",
                  "wss_endpoint_domain":"wss://test.domain.name.here:2368",
                  "info_http_endpoint_domain":"http://test.domain.name.here:2370"
               }
            ]
         }
      }
   }
]
```
