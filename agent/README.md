# SKALE Money Transfer Agent

## Overview

**SKALE Money Transfer Agent** is also known as **KTM**(*Kavoon Transfer Manager*).
This article refers to it as **KTM**.

**KTM** consists of the following parts:

- Contracts on Main-net
- Contracts on S-Chain
- NodeJS based app

## Contracts installation

### Contracts prerequisites

First of all, we need special truffle version **4.1.13** (notice, the *-g* option of *npm* may require *sudo*):

    npm install -g truffle@4.1.13

Second, get source code of Solidity contracts and install dependecies:

    git clone git@github.com:GalacticExchange/KTM.git
    cd KTM/proxy/
    npm install

Third edit the *./truffle.js* and specify needed networks (Main-net and S-Chain) and account addresses which will own contracts on these blockchains:

    nano ./truffle.js

We will use networks called **pseudo_main_net** and **local** in this documentation:

    local: {
        gasPrice: 10000000000,
        host: "127.0.0.1",
        port: 2231,
        gas: 8000000,
        network_id: "*",
        "from": "0x6196d135CdDb9d73A0756C1E44b5b02B11acf594"
    },
    pseudo_main_net: {
        gasPrice: 10000000000,
        host: "127.0.0.1",
        port: 8545,
        gas: 8000000,
        network_id: "*",
        "from": "0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f"
    },

Fourth, rebuild all the contracts once to ensure everything initialized OK:

    rm -rf ./build
    truffle complile


### Contracts installation on Main-net

First, execute truffle migration for Main-net:

    export NETWORK=pseudo_main_net
    export ETH_PRIVATE_KEY=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc
    truffle migrate --network $NETWORK --compile-all --reset

Second, save generated **proxy.json** file with ABI of all the migrated contracts for further usages:

    cp ./proxy.json ...some_folder.../abi_main_net.json

### Contracts installation on S-Chain

First, execute truffle migration for S-Chain:

    export NETWORK=local
    export ETH_PRIVATE_KEY=621761908cc4fba5f92e694e0e4a912aa9a12258a597a06783713a04610fad59
    truffle migrate --network $NETWORK --compile-all --reset

Second, save generated **proxy.json** file with ABI of all the migrated contracts for further usages:

    cp ./proxy.json ...some_folder.../abi_s_chain.json

## KTM installation

### KTM prerequisites

First, get source code of **KTM**:

    cd KTP/agent/

Second, install dependecies:

    npm install web3@1.0.0-beta.35
    npm install colors
    npm install ethereumjs-tx
    npm install ethereumjs-wallet
    npm install ethereumjs-util
    npm install --save-dev @babel/plugin-transform-runtime
    npm install --save @babel/runtime

### Bind KTM to Main-net

**KTM** works as S-Chain extension. It should be registered on Main-net before performing any money transfers between blockchains:

    node ./main.js \
        --register \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:2231 \
        --id-main-net=Mainnet \
        --id-s-chain=id-S-chain \
        --abi-main-net=./abi_main_net.json \
        --abi-s-chain=./abi_s_chain.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e

### Run KTM for particular S-Chain

Performed with the **--loop** command line option:

    node ./main.js \
        --loop \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:2231 \
        --id-main-net=Mainnet \
        --id-s-chain=id-S-chain \
        --abi-main-net=./abi_main_net.json \
        --abi-s-chain=./abi_s_chain.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e

Notice: the command above can be run in forever while loop of shell script or became a part of daemon service file.

## Other KTM tasks

### Getting command line help

    node ./main.js --help

### Displaying run-time variables and arguments

    node ./main.js --show-config

### Listing available output detail options

    node ./main.js --verbose-list

### Specifying logging options

Log output is always printed to standard output. Log also can be mirrored to file using **--log**=**path** command line option.

By default mirrored log file grows with no limit and no log rotation is performed. To turn log rotation on and specify maximal size of log in bytes you should use the **--log-size**=**value** and **--log-files**=**value** command line options.

### Money transfer from Main-net account to S-Chain

Performed with the **--m2s-payment** command line option:

    node ./main.js \
        --m2s-payment \
        --ether=50 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:2231 \
        --id-main-net=Mainnet \
        --id-s-chain=id-S-chain \
        --abi-main-net=./abi_main_net.json \
        --abi-s-chain=./abi_s_chain.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --address-s-chain=0x66c5a87f4a49dd75e970055a265e8dd5c3f8f852

Notice: The command above does payment from Main-net and that is why we need to specify private key for source account inside Main-net blockchain using the **--key-main-net** command line argument. Target S-chain account is specified as address with the **--address-s-chain** command line argument. We don't need to specify private key for target account.

### Money transfer from S-Chain account to Main-net

Performed with the **--s2m-payment** command line option:

    node ./main.js \
        --s2m-payment \
        --ether=10 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:2231 \
        --id-main-net=Mainnet \
        --id-s-chain=id-S-chain \
        --abi-main-net=./abi_main_net.json \
        --abi-s-chain=./abi_s_chain.json \
        --address-main-net=0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e

Notice: The command above does payment from Main-net and that is why we need to specify private key for source account inside S-chain blockchain using the **--key-s-chain** command line argument. Target Main-net account is specified as address with the **--address-main-net** command line argument. We don't need to specify private key for target account.

### Money amount specification for transfer operations

Amount of money should be specified with one of the following command line options

        --wei=number...................Amount of wei to transfer.
        --babbage=number...............Amount of babbage(wei*1000) to transfer.
        --lovelace=number..............Amount of lovelace(wei*1000*1000) to transfer.
        --shannon=number...............Amount of shannon(wei*1000*1000*1000) to transfer.
        --szabo=number.................Amount of szabo(wei*1000*1000*1000*1000) to transfer.
        --finney=number................Amount of finney(wei*1000*1000*1000*1000*1000) to transfer.
        --ether=number.................Amount of ether(wei*1000*1000*1000*1000*1000*1000) to transfer.

### Single transfer loops

Single transfer operations are similar to the **--loop** normal mode but perform single loop iteration and exit.

#### Single transfer iteration from Main-net to S-chain

Performed with the **--m2s-transfer** command line option:

    node ./main.js \
        --m2s-transfer \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:2231 \
        --id-main-net=Mainnet \
        --id-s-chain=id-S-chain \
        --abi-main-net=./abi_main_net.json \
        --abi-s-chain=./abi_s_chain.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e

#### Single transfer iteration from S-chain to Main-net

Performed with the **--s2m-transfer** command line option:

    node ./main.js \
        --s2m-transfer \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:2231 \
        --id-main-net=Mainnet \
        --id-s-chain=id-S-chain \
        --abi-main-net=./abi_main_net.json \
        --abi-s-chain=./abi_s_chain.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e

#### Single bidirectional transfer iteration between Main-net and S-chain

Performed with the **--transfer** command line option:

    node ./main.js \
        --transfer \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:2231 \
        --id-main-net=Mainnet \
        --id-s-chain=id-S-chain \
        --abi-main-net=./abi_main_net.json \
        --abi-s-chain=./abi_s_chain.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e

### Transfer loop parameters

    --m2s-transfer-block-size.......Number of transactions in one block to use in money transfer loop from Main-net to S-chain.
    --s2m-transfer-block-size.......Number of transactions in one block to use in money transfer loop from S-chain to Main-net.
    --transfer-block-size...........Number of transactions in one block to use in both money transfer loops.
    --m2s-max-transactions..........Maximal number of transactions to do in money transfer loop from Main-net to S-chain (0 is unlimited).
    --s2m-max-transactions..........Maximal number of transactions to do in money transfer loop from S-chain to Main-net (0 is unlimited).
    --max-transactions..............Maximal number of transactions to do in both money transfer loops (0 is unlimited).
    --period........................Transfer loop period(seconds).
    --node-number=value.............S-Chain node number(zero based).
    --nodes-count=value.............S-Chain nodes count.
    --time-framing=value............Specifies period(in seconds) for time framing. Zero means disable time framing.
    --time-gap=value................Specifies gap(in seconds) before next time frame.

### S-Chain specific configuration for more then one node S-Chains

The **--node-number** and **--nodes-count** must me used for **KTM** instances running on S-Chain nodes which are part of multi-node S-Chain.
