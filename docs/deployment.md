<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# IMA Deployment and Initialization

## Deployment Overview

Deploy process includes:

1) Prepare prerequisites
2) Deploy contracts to the `Main Net`
3) Deploy contracts to the `S-Chain`
4) Initialize IMA Agent application
5) Run IMA Agent application in message processing loop mode

## Prerequisites

1) `Main Net` Ethereum network with known HTTP(S) URL of **Web3** interface.
2) `S-Chain` network with known HTTP(S) URL of **Web3** interface.
3) Preliminary deployed **Skale Manager** software with known address of **ContractManager** smart contract saved into the `proxy/data/skaleManagerComponents.json` file like shown in the following example:

```json
    {
        "contract_manager_address": "0xe89d660C1a4642C12A2846e8AF4d3F76c6BDbeF2"
    }
```

4) `libBLS` command utilities
5) Truffle version **5.0.12** is recommended to install (notice, the _-g_ option of _npm_ may require _sudo_):

```bash
    sudo npm uninstall -g truffle
    sudo npm install -g truffle@5.0.12
    truffle --version
```

6) Node modules should be initialized in the following folders:

```bash
    export IMA_ROOT=.....
    cd $IMA_ROOT/proxy; npm install
    cd $IMA_ROOT/npms/skale-owasp; npm install
    cd $IMA_ROOT/npms/skale-ima; npm install
    cd $IMA_ROOT/agent; npm install
```

## Smart Contracts Installation

### Configure Truffle

Edit the `$IMA_ROOT/proxy/truffle-config.js` and specify needed networks (`Mainnet` and `S-Chain`) and account addresses which will own contracts on these blockchains:

```bash
    cd $IMA_ROOT/proxy
    nano ./truffle-config.js
```

Here is example of networks called `Main Net` and `S-Chain`:

```bash
    var privateKey_main_net = "[YOUR_ETH_PRIVATE_KEY]";
    var privateKey_skalechain  = "[YOUR_SKALE_CHAIN_PRIVATE_KEY]";
...
    mainnet: { # for Mainnet
        gasPrice: 10000000000,
        gas: 8000000,
        network_id: "*",
        provider: () => { return new HDWalletProvider( privateKey_main_net, "http://127.0.0.1:8545" ); },
        skipDryRun: true
    },
    schain: { # for SKALE Chain
        provider: () => { return new privateKeyProvider(privateKeyForSchain, schainRpcUrl); },
        gasPrice: 1000000000,
        gas: 8000000,
        name: schainName,
        network_id: "*"
    },
```

Initialize required environment variables. Example of `.env` file can be found in the `$IMA_ROOT/agent` folder.

Build all the contracts once to ensure everything initialized OK:

```bash
    cd $IMA_ROOT/proxy
    mkdir -p data || true
    rm -rf ./build
    rm -rf ./data/proxy*
    truffle compile
    ls -1 ./data/
```

### Smart contract Deployment for Main Net

```bash
    cd $IMA_ROOT/proxy
    npm run deploy-to-mainnet
    ls -1 ./data/
```

You should see **proxyMainnet.json** file listed.

#### Smart contract Deployment for S-Chain

```bash
    cd $IMA_ROOT/proxy
    npm run deploy-to-schain
    ls -1 ./data/
```

You should see **proxySchain.json** file listed.

## IMA installation

### Bind IMA to Main Net

You can check whether **IMA** is already bound with:

```bash
    node ./main.js --verbose=9 \
        --check-registration \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=[YOUR_PRIVATE_KEY] \
        --key-s-chain=[YOUR_PRIVATE_KEY]
```

**IMA** works as `S-Chain` extension. It should be registered on `Main Net` before performing any money transfers between blockchains:

```bash
    node ./main.js --verbose=9 \
        --register \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY] \
        --key-s-chain=[YOUR_PRIVATE_KEY]
```

#### Run IMA for Particular S-Chain

Performed with the **--loop** command line option:

```bash
    node ./main.js --verbose=9 \
        --loop \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY] \
        --key-s-chain=[YOUR_PRIVATE_KEY]
```

Notice: the command above can be run in forever while loop of shell script or became a part of daemon service file.

### IMA Tasks

#### Get Command Line Help

```bash
    node ./main.js --help
```

#### Display Run-time Variables and Arguments

```bash
    node ./main.js --show-config
```

#### List Available Output Detail Options

```bash
    node ./main.js --verbose-list
```

#### Specify Logging Options

Log output is always printed to standard output. Log also can be mirrored to file using **--log**=**path** command line option.

By default mirrored log file grows with no limit and no log rotation is performed. To turn log rotation on and specify maximal size of log in bytes you should use the **--log-size**=**value** and **--log-files**=**value** command line options.

#### Money transfer from Main Net Account to S-Chain

Performed with the **--m2s-payment** command line option:

```bash
    node ./main.js --verbose=9 \
        --m2s-payment \
        --ether=1 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY] \
        --address-s-chain=0x66c5a87f4a49dd75e970055a265e8dd5c3f8f852
```

Notice: The command above does payment from `Main Net` and that is why we need to specify private key for source account inside `Main Net` blockchain using the **--key-main-net** command line argument. Target `S-Chain` account is specified as address with the **--address-s-chain** command line argument. We don't need to specify private key for target account.

#### Money Transfer From S-Chain Account to Main Net

Performed with the **--s2m-payment** command line option:

```bash
    node ./main.js --verbose=9 \
        --s2m-payment \
        --ether=1 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --address-main-net=[ADDRESS] \
        --key-s-chain=[YOUR_PRIVATE_KEY]
```

Notice: The command above does payment from `Main Net` and that is why we need to specify private key for source account inside `S-Chain` blockchain using the **--key-s-chain** command line argument. Target `Main Net` account is specified as address with the **--address-main-net** command line argument. We don't need to specify private key for target account.

#### View How Much ETH You Can Receive From S-Chain Account to Main Net

Performed with the **--s2m-view** command line option:

```bash
    node ./main.js --verbose=9 \
        --s2m-view \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY]
```

Notice: this operation is related to ETH transfers only.

#### Receive Money Transfer From S-Chain Account to Main Net

Performed with the **--s2m-receive** command line option:

```bash
    node ./main.js --verbose=9 \
        --s2m-receive \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY]
```

Notice: this operation is related to ETH transfers only.

#### Money Amount Specification for Transfer Operations

Amount of money should be specified with one of the following command line options

```bash
        --wei=number...................Amount of wei to transfer.
        --babbage=number...............Amount of babbage(wei*1000) to transfer.
        --lovelace=number..............Amount of lovelace(wei*1000*1000) to transfer.
        --shannon=number...............Amount of shannon(wei*1000*1000*1000) to transfer.
        --szabo=number.................Amount of szabo(wei*1000*1000*1000*1000) to transfer.
        --finney=number................Amount of finney(wei*1000*1000*1000*1000*1000) to transfer.
        --ether=number.................Amount of ether(wei*1000*1000*1000*1000*1000*1000) to transfer.
```

#### Single Transfer Loop Execution

Single transfer operations are similar to the **--loop** normal mode but perform single loop iteration and exit.

##### Single Transfer Iteration from Main Net to S-Chain

Performed with the **--m2s-transfer** command line option:

```bash
    node ./main.js --verbose=9 \
        --m2s-transfer \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY] \
        --key-s-chain=[YOUR_PRIVATE_KEY]
```

##### Single Transfer Iteration from S-Chain to Main Net

Performed with the **--s2m-transfer** command line option:

```bash
    node ./main.js --verbose=9 \
        --s2m-transfer \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY] \
        --key-s-chain=[YOUR_PRIVATE_KEY]
```

##### Single Bi-directional Transfer Iteration Between Main Net and S-Chain

Performed with the **--transfer** command line option:

```bash
    node ./main.js --verbose=9 \
        --transfer \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY] \
        --key-s-chain=[YOUR_PRIVATE_KEY]
```

#### Transfer Loop Customization

```html
    --m2s-transfer-block-size.......Number of transactions in one block to use in money transfer loop from Main Net to S-Chain.
    --s2m-transfer-block-size.......Number of transactions in one block to use in money transfer loop from S-Chain to Main Net.
    --transfer-block-size...........Number of transactions in one block to use in both money transfer loops.

    --m2s-max-transactions..........Maximal number of transactions to do in money transfer loop from Main Net to S-Chain (0 is unlimited).
    --s2m-max-transactions..........Maximal number of transactions to do in money transfer loop from S-Chain to Main Net (0 is unlimited).
    --max-transactions..............Maximal number of transactions to do in both money transfer loops (0 is unlimited).

    --m2s-await-blocks..............Maximal number of blocks to wait to appear in blockchain before transaction from Main Net to S-Chain (0 is no wait).
    --s2m-await-blocks..............Maximal number of blocks to wait to appear in blockchain before transaction from S-Chain to Main Net (0 is no wait).
    --await-blocks..................Maximal number of blocks to wait to appear in blockchain before transaction between both S-Chain and Main Net (0 is no wait).

    --period........................Transfer loop period(seconds).
    --node-number=value.............S-Chain node number(zero based).
    --nodes-count=value.............S-Chain nodes count.
    --time-framing=value............Specifies period(in seconds) for time framing. Zero means disable time framing.
    --time-gap=value................Specifies gap(in seconds) before next time frame.
```

#### S-Chain specific Configuration for Multi-node S-Chains

The **--node-number** and **--nodes-count** must me used for **IMA** instances running on S-Chain nodes which are part of multi-node S-Chain.

#### ERC20 Default Transfer from Main Net Account to S-Chain

Performed with the **--m2s-payment** and **--no-raw-transfer** command line options:

```bash
    node ./main.js --verbose=9 \
        --m2s-payment \
        --amount=1 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --erc20-main-net=data-mn.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY] \
        --address-s-chain=0x66c5a87f4a49dd75e970055a265e8dd5c3f8f852 \
        --no-raw-transfer
```

Notice: The command above does payment from `Main Net` and that is why we need to specify private key for source account inside `Main Net` blockchain using the **--key-main-net** command line argument. Target `S-Chain` account is specified as address with the **--address-s-chain** command line argument. We don't need to specify private key for target account.

#### ERC721 Default Transfer from Main Net Account to S-Chain

Same as above. But use **721** instead of **20** in command names. Also use **--tid** to specify ERC721 token id to send instead of **--amount**.

#### ERC20 Default Transfer from S-Chain Account to Main Net

Performed with the **--s2m-payment**, **--no-raw-transfer** and **--addr-erc20-s-chain** command line options:

```bash
    node ./main.js --verbose=9 \
        --s2m-payment \
        --amount=1 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --erc20-main-net=data-mn.json \
        --addr-erc20-s-chain=[ADDRESS] \
        --address-main-net=[ADDRESS] \
        --key-s-chain=[YOUR_PRIVATE_KEY] \
        --no-raw-transfer
```

Notice: The command above does payment from `Main Net` and that is why we need to specify private key for source account inside `S-Chain` blockchain using the **--key-s-chain** command line argument. Target `Main Net` account is specified as address with the **--address-main-net** command line argument. We don't need to specify private key for target account.

#### ERC721 Default Transfer from S-Chain Account to Main Net

Same as above. But use **721** instead of **20** in command names. Also use **--tid** to specify ERC721 token id to send instead of **--amount**.

#### ERC20 raw transfer from Main Net account to S-Chain

Performed with the **--m2s-payment** and **--raw-transfer** command line options:

```bash
    node ./main.js --verbose=9 \
        --m2s-payment \
        --amount=1 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --erc20-main-net=data-mn.json \
        --erc20-s-chain=data-sc.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY] \
        --address-s-chain=0x66c5a87f4a49dd75e970055a265e8dd5c3f8f852 \
        --raw-transfer
```

Notice: The command above does payment from `Main Net` and that is why we need to specify private key for source account inside `Main Net` blockchain using the **--key-main-net** command line argument. Target `S-Chain` account is specified as address with the **--address-s-chain** command line argument. We don't need to specify private key for target account.

#### ERC721 Raw Transfer from Main Net Account to S-Chain

Same as above. But use **721** instead of **20** in command names. Also use **--tid** to specify ERC721 token id to send instead of **--amount**.

#### ERC20 Raw Transfer from S-Chain Account to Main Net

Performed with the **--s2m-payment** and **--raw-transfer** command line options:

```bash
    node ./main.js --verbose=9 \
        --s2m-payment \
        --amount=1 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --erc20-main-net=data-mn.json \
        --erc20-s-chain=data-sc.json \
        --address-main-net=[ADDRESS] \
        --key-s-chain=[YOUR_PRIVATE_KEY] \
        --raw-transfer
```

Notice: The command above does payment from `Main Net` and that is why we need to specify private key for source account inside `S-Chain` blockchain using the **--key-s-chain** command line argument. Target `Main Net` account is specified as address with the **--address-main-net** command line argument. We don't need to specify private key for target account.

#### ERC721 Raw Transfer From S-Chain Account to Main Net

Same as above. But use **721** instead of **20** in command names. Also use **--tid** to specify ERC721 token id to send instead of **--amount**.

### Other options and commands

#### Browse S-Chain network

You can ask agent app to scan `S-Chain` network information and parameters, print it and exit:

    node ./main.js --verbose=9 --url-s-chain=http://127.0.0.1:15000 -- browse-s-chain

This information is used to sign messages on all `S-Chain` nodes.

#### Sign messages

Message signing performed only for message sent from `S-Chain` to `Main Net`.

Adding **--sign-messages** command line parameter turns on **BLS message signing** algorithm.
Agent app will scan `S-Chain` network and ask each of nodes to sign messages transferred from `Main Net` to `S-Chain`.
This options requires all `S-Chain` nodes to be configured with **SGX Wallet** or **Emu Wallet** access information.

The **--bls-glue** command line parameter must be used to specify path to the **bls_glue** application.
This parameter must be specified if **--sign-messages** parameter is present.

The **--bls-verify** command line parameter must be used to specify path to the **verify_bls** application.
This parameter is optional. If it was specified, then **IMA Agent** application will verify gathered BLS signatures.

The **--hash-g1** command line parameter must be used to specify path to the **hash_g1** application.

Message signing will work only on `S-Chain` where each **skaled** node configured properly and able to:

-   provide browse information for entire `S-Chain` network
-   provide **IMA** signing APIs and parameters

Here is example of correct **config.json** file for **skaled** node:

```text
    "skaleConfig": {
        "nodeInfo": {
            "nodeName": "...", "nodeID": 1234,
            "bindIP": "...", "bindIP6": "...", "basePort": ..., "basePort6": ...,
            "logLevel": "trace", "logLevelProposal": "trace",
            "emptyBlockIntervalMs": ..., "ipc": false, "ipcpath": "./ipcx", "db-path": "./node",
            "httpRpcPort": ..., "httpsRpcPort": ..., "wsRpcPort": ..., "wssRpcPort": ...,
            "httpRpcPort6": ..., "httpsRpcPort6": ..., "wsRpcPort6": ..., "wssRpcPort6": ...,
            "acceptors": 1, "max-connections": 0,
            "web3-trace": true, "enable-debug-behavior-apis": false, "unsafe-transactions": false,
            "aa": "always", "web3-shutdown": false,
            "imaMainNet": "..",
            "imaMessageProxySChain":  "0x...",
            "imaMessageProxyMainNet": "0x...",
            "imaCallerAddressSChain": "0x...",
            "imaCallerAddressMainNet": "0x...",
            "wallets": {
                "ima": {
                    "url": "...", "keyShareName": "...", "t": 2, "n": 2,
                    "BLSPublicKey",
                    "BLSPublicKey",
                    "BLSPublicKey",
                    "BLSPublicKey",
                    "commonBLSPublicKey",
                    "commonBLSPublicKey",
                    "commonBLSPublicKey",
                    "commonBLSPublicKey"
                }
            }
        },
        "sChain": {
            "schainID": 1234, "schainName": "...",
            "nodes": [ {
                "schainIndex": 1, "nodeID": 3344,
                "ip": "...", "ip6": "...", "basePort": ..., "basePort6": ...,
                "httpRpcPort": ..., "httpsRpcPort": ..., "wsRpcPort": ..., "wssRpcPort": ...,
                "httpRpcPort6": ..., "httpsRpcPort6": ..., "wsRpcPort6": ..., "wssRpcPort6": ...
            }, {
                "schainIndex": 1, "nodeID": 4455,
                "ip": "...", "ip6": "...", "basePort": ..., "basePort6": ...,
                "httpRpcPort": ..., "httpsRpcPort": ..., "wsRpcPort": ..., "wssRpcPort": ...,
                "httpRpcPort6": ..., "httpsRpcPort6": ..., "wsRpcPort6": ..., "wssRpcPort6": ...
            } ]
        }
    }
```

Here is example of IMA message processing loop invocation with BLS support:

```bash
    reset; node ./main.js --verbose=9 \
        --loop \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY] \
        --key-s-chain=[YOUR_PRIVATE_KEY] \
        --sign-messages \
        --bls-glue=libBLS/bls_glue \
        --hash-g1=libBLS/hash_g1 \
        --bls-verify=libBLS/verify_bls

    reset; node ./main.js --verbose=9 \
        --loop \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:15000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=[YOUR_ETH_PRIVATE_KEY] \
        --key-s-chain=[YOUR_PRIVATE_KEY] \
        --sign-messages \
        --bls-glue=libBLS/bls_glue \
        --hash-g1=libBLS/hash_g1 \
        --bls-verify=libBLS/verify_bls
```