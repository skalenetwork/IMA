<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# SKALE Interchain Messaging Agent

## Overview

This article refers to **SKALE Interchain Messaging Agent** as **IMA**.

**IMA** consists of the following parts:

- Contracts on Mainnet
- Contracts on a SKALE Chain
- NodeJS based app

## Contracts installation

### Contracts prerequisites

First of all, we need special truffle version **5.0.12** (notice, the *-g* option of *npm* may require *sudo*):

    sudo npm uninstall -g truffle
    sudo npm install -g truffle@5.0.12
    truffle --version

Second, get source code of Solidity contracts and install dependencies:

    git clone git@github.com:skalenetwork/IMA.git
    cd ./IMA

### Node JS prerequisites

Third, install required **Node JS** everywhere they needed:

    export IMA_ROOT=.....
    #
    cd $IMA_ROOT/proxy
    rm -rf ./node_modules &> /dev/null
    yarn install
    #
    cd $IMA_ROOT/npms/skale-owasp
    rm -rf ./node_modules &> /dev/null
    yarn install
    #
    cd $IMA_ROOT/npms/skale-ima
    rm -rf ./node_modules &> /dev/null
    yarn install
    #
    cd $IMA_ROOT/agent
    rm -rf ./node_modules &> /dev/null
    yarn install

Fourth, edit the *$IMA_ROOT/proxy/truffle-config.js* and specify needed networks (Mainnet and SKALE Chain) and account addresses which will own contracts on these blockchains:

    cd $IMA_ROOT/proxy
    nano ./truffle-config.js

We will use networks called **MainNet** and **S-Chain** in this documentation:

    let privateKey_main_net = process.env.PRIVATE_KEY_FOR_ETHEREUM;
    let privateKey_skalechain  = process.env.PRIVATE_KEY_FOR_SCHAIN;

...

    mainnet: { # for Mainnet
        gasPrice: 10000000000,
        gas: 8000000,
        network_id: "*",
        provider: () => { return new HDWalletProvider( privateKey_main_net, process.env.URL_W3_ETHEREUM ); },
        skipDryRun: true
    },
    schain: { # for SKALE Chain
        provider: () => { return new privateKeyProvider(privateKeyForSchain, process.env.URL_W3_S_CHAIN ); },
        gasPrice: 1000000000,
        gas: 8000000,
        name: schainName,
        network_id: "*"
    },

Fourth, export required environment variables:

    export NETWORK_FOR_ETHEREUM="mainnet"
    export PRIVATE_KEY_FOR_ETHEREUM="<YOUR_PRIVATE_KEY_HERE>"
    export NETWORK_FOR_SCHAIN="schain"
    export PRIVATE_KEY_FOR_SCHAIN="<YOUR_PRIVATE_KEY_HERE>"
    export CHAIN_NAME_SCHAIN="Bob"
    export URL_W3_ETHEREUM="http://127.0.0.1:8545"
    export URL_W3_S_CHAIN="http://127.0.0.1:15000"
    export ACCOUNT_FOR_ETHEREUM="<ACCOUNT_ADDRESS_HERE>"
    export ACCOUNT_FOR_SCHAIN=""<ACCOUNT_ADDRESS_HERE>"

Notice: ACCOUNT_FOR_ETHEREUM address corresponds to PRIVATE_KEY_FOR_ETHEREUM private key, ACCOUNT_FOR_SCHAIN address corresponds to PRIVATE_KEY_FOR_SCHAIN private key.

Fifth, try rebuild all the contracts once to ensure everything initialized OK:

    cd $IMA_ROOT/proxy
    mkdir -p data || true
    rm -rf ./build
    rm -rf ./data/proxy*
    truffle compile
    ls -1 ./data/

### Contracts pre-installation on Mainnet and SKALE Chain

For mainnet, invoke:

    cd $IMA_ROOT/proxy
    yarn run deploy-to-mainnet
    ls -1 ./data/

You should see **proxyMainnet.json** file listed.

For SKALE chain, invoke:

    cd $IMA_ROOT/proxy
    yarn run deploy-to-schain
    ls -1 ./data/

You should see **proxySchain.json** file listed.

## IMA transaction signing

**IMA** supports two ways of signing transactions:

    - Direct private key
    - SGX Wallet

Private keys can be specified directly in **IMA** command line:

    --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM \
    --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN

If **IMA** action needs to sign only **Main Net** transaction(s) and do read-only actions on **S-Chain**:

    --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM \
    --address-s-chain=0x66c5a87f4a49dd75e970055a265e8dd5c3f8f852

If **IMA** action needs to sign only **S-Chain** transaction(s) and do read-only actions on **Main Net**:

    --address-main-net=$ACCOUNT_FOR_ETHEREUM \
    --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN \

If **IMA** should use **SGX Wallet** to sign transactions, then the parameters above should be replaced with:

    --sgx-url-main-net=...\
    --sgx-url-s-chain=...\
    --sgx-ecdsa-key-main-net=...\
    --sgx-ecdsa-key-s-chain=...\
    --sgx-ssl-key-main-net=...\
    --sgx-ssl-key-s-chain=...\
    --sgx-ssl-cert-main-net=...\
    --sgx-ssl-cert-s-chain=...\
    --address-main-net=...\
    --address-s-chain=...

If **IMA** should use **Transaction Manager** to sign transactions, then the parameters above should be replaced with:

    --tm-url-main-net=...\
    --tm-url-s-chain=... \
    --address-main-net=...\
    --address-s-chain=...

**IMA** can use different ways of signing messages for **Main Net** and **S-Chain** by mixing connectivity parameters specified above.

Where `--sgx-url-main-net` and `--sgx-url-s-chain` command line parameters provide **HTTPS** URLs for **SGX Wallets** for **Main Net** and **S-Chain**. These URLs can be equal. The `--sgx-ssl-key-main-net`, `--sgx-ssl-key-s-chain`, `--sgx-ssl-cert-main-net` and `--sgx-ssl-cert-s-chain` command line parameters provide SSL certificate and key files. The `--sgx-ecdsa-key-main-net` and `--sgx-ecdsa-key-s-chain` command line parameters provide registered name of **ECDSA key** in **SGX Wallets**, for example `NEK:000`. The `--address-main-net` and `--address-s-chain` command line parameters provide Ethereum wallet addresses corresponding to specified names of **ECDSA key** in **SGX Wallets**.

It's possible to mix **SGX Wallet** and direct private key usage. I.e. **Main Net** and **S-Chain** can use different transaction signing ways. Nevertheless this is never needed in real life.

## IMA installation

### Bind IMA to Main-net

You can check whether **IMA** is already bound with:

    node ./main.js --verbose=9 \
        --check-registration \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM \
        --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN

**IMA** works as S-Chain extension. It should be registered on Main-net before performing any money transfers between blockchains:

    node ./main.js --verbose=9 \
        --register \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM \
        --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN

### Run IMA for particular S-Chain

Performed with the **--loop** command line option:

    node ./main.js --verbose=9 \
        --loop \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM \
        --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN

Notice: the command above can be run in forever while loop of shell script or became a part of daemon service file.

## Other IMA tasks

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

    node ./main.js --verbose=9 \
        --m2s-payment \
        --ether=1 \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM \
        --address-s-chain=0x66c5a87f4a49dd75e970055a265e8dd5c3f8f852

Notice: The command above does payment from Main-net and that is why we need to specify private key for source account inside Main-net blockchain using the **--key-main-net** command line argument. Target S-chain account is specified as address with the **--address-s-chain** command line argument. We don't need to specify private key for target account.

### Money transfer from S-Chain account to Main-net

Performed with the **--s2m-payment** command line option:

    node ./main.js --verbose=9 \
        --s2m-payment \
        --ether=1 \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --address-main-net=$ACCOUNT_FOR_ETHEREUM \
        --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN

Notice: The command above does payment from Main-net and that is why we need to specify private key for source account inside S-chain blockchain using the **--key-s-chain** command line argument. Target Main-net account is specified as address with the **--address-main-net** command line argument. We don't need to specify private key for target account.

### View how much ETH you can receive from S-Chain account to Main-net

Performed with the **--s2m-view** command line option:

    node ./main.js --verbose=9 \
        --s2m-view \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM

Notice: this operation is related to ETH transfers only.

### Receive money transfer from S-Chain account to Main-net

Performed with the **--s2m-receive** command line option:

    node ./main.js --verbose=9 \
        --s2m-receive \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM

Notice: this operation is related to ETH transfers only.

### Money amount specification for transfer operations

Amount of money should be specified with one of the following command line options

        --value=moneySpec..............Amount of eth/finney/szabo/shannon/lovelace/babbage/wei/ to transfer. For instance "1ether" or "100000wei".
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

    node ./main.js --verbose=9 \
        --m2s-transfer \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=PRIVATE_KEY_FOR_ETHEREUM \
        --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN

#### Single transfer iteration from S-chain to Main-net

Performed with the **--s2m-transfer** command line option:

    node ./main.js --verbose=9 \
        --s2m-transfer \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM \
        --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN

#### Single bidirectional transfer iteration between Main-net and S-chain

Performed with the **--transfer** command line option:

    node ./main.js --verbose=9 \
        --transfer \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM \
        --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN

### Transfer loop parameters

    --skip-dry-run..................Skip dry run contract method calls.
    --ignore-dry-run................Ignore result of dry run contract method calls and continue execute.
    --dry-run.......................Use error results of dry run contract method calls as actual errors and stop execute.

    --m2s-transfer-block-size.......Number of transactions in one block to use in money transfer loop from Main-net to S-chain.
    --s2m-transfer-block-size.......Number of transactions in one block to use in money transfer loop from S-chain to Main-net.
    --transfer-block-size...........Number of transactions in one block to use in both money transfer loops.

    --m2s-max-transactions..........Maximal number of transactions to do in money transfer loop from Main-net to S-chain (0 is unlimited).
    --s2m-max-transactions..........Maximal number of transactions to do in money transfer loop from S-chain to Main-net (0 is unlimited).
    --max-transactions..............Maximal number of transactions to do in both money transfer loops (0 is unlimited).

    --m2s-await-blocks..............Maximal number of blocks to wait to appear in blockchain before transaction from Main-net to S-chain (0 is no wait).
    --s2m-await-blocks..............Maximal number of blocks to wait to appear in blockchain before transaction from S-chain to Main-net (0 is no wait).
    --await-blocks..................Maximal number of blocks to wait to appear in blockchain before transaction between both S-chain and Main-net (0 is no wait).

    --period........................Transfer loop period(seconds).
    --node-number=value.............S-Chain node number(zero based).
    --nodes-count=value.............S-Chain nodes count.
    --time-framing=value............Specifies period(in seconds) for time framing. Zero means disable time framing.
    --time-gap=value................Specifies gap(in seconds) before next time frame.
    --ptx...........................Enable pending transaction analysis to avoid transaction conflicts.
    --no-ptx........................Disable pending transaction analysis. Not recommended for slow and overloaded blockchains.

### S-Chain specific configuration for more then one node S-Chains

The **--node-number** and **--nodes-count** must me used for **IMA** instances running on S-Chain nodes which are part of multi-node S-Chain.

### ERC20 transfer from Main-net account to S-Chain

Performed with the **--m2s-payment** command line option:

    node ./main.js --verbose=9 \
        --m2s-payment \
        --amount=1 \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --erc20-main-net=../../SkaleExperimental/skaled-tests/saved-Artem-scripts/Zhelcoin/data-mn.json \
        --erc20-s-chain=../../SkaleExperimental/skaled-tests/saved-Artem-scripts/Zhelcoin/data-sc.json \
        --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM \
        --address-s-chain=0x66c5a87f4a49dd75e970055a265e8dd5c3f8f852

Notice: The command above does payment from Main-net and that is why we need to specify private key for source account inside Main-net blockchain using the **--key-main-net** command line argument. Target S-chain account is specified as address with the **--address-s-chain** command line argument. We don't need to specify private key for target account.

### ERC721 raw transfer from Main-net account to S-Chain

Same as above. But use **721** instead of **20** in command names. Also use **--tid** to specify ERC721 token id to send instead of **--amount**.

### ERC20 transfer from S-Chain account to Main-net

Performed with the **--s2m-payment** command line option:

    node ./main.js --verbose=9 \
        --s2m-payment \
        --amount=1 \
        --sleep-between-tx=5000 \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --erc20-main-net=../../SkaleExperimental/skaled-tests/saved-Artem-scripts/Zhelcoin/data-mn.json \
        --erc20-s-chain=../../SkaleExperimental/skaled-tests/saved-Artem-scripts/Zhelcoin/data-sc.json \
        --address-main-net=$ACCOUNT_FOR_ETHEREUM \
        --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN

Notice: The command above does payment from Main-net and that is why we need to specify private key for source account inside S-chain blockchain using the **--key-s-chain** command line argument. Target Main-net account is specified as address with the **--address-main-net** command line argument. We don't need to specify private key for target account.

### ERC721 transfer from S-Chain account to Main-net

Same as above. But use **721** instead of **20** in command names. Also use **--tid** to specify ERC721 token id to send instead of **--amount**.

## Other options and commands

### Browse S-Chain network

You can ask agent app to scan **S-Chain** network information and parameters, print it and exit:

    node ./main.js --verbose=9 --url-s-chain=$URL_W3_S_CHAIN -- browse-s-chain

This information is used to sign messages on all **S-Chain** nodes.

### Sign messages

Message signing performed only for message sent from **S-Chain** to **MainNet**.

Adding **--sign-messages** command line parameter turns on **BLS message signing** algorithm.
Agent app will scan **S-Chain** network and ask each of nodes to sign messages transferred from **MainNet** to **S-Chain**.
This options requires all **S-Chain** nodes to be configured with **SGX Wallet** or **Emu Wallet** access information.

The **--bls-glue** command line parameter must be used to specify path to the **bls_glue** application.
This parameter must be specified if **--sign-messages** parameter is present.

The **--bls-verify** command line parameter must be used to specify path to the **verify_bls** application.
This parameter is optional. If it was specified, then **IMA Agent** application will verify gathered BLS signatures.

The **--hash-g1** command line parameter must be used to specify path to the **hash_g1** application.

Message signing will work only on **S-Chain** where each **skaled** node configured properly and able to:

    - provide brows information for entire **S-Chain** network
    - provide **IMA** signing APIs and parameters

Here is example of correct **config.json** file for **skaled** node:

    "skaleConfig": {
        "nodeInfo": {
            "nodeName": "???????????", "nodeID": ????,
            "bindIP": "??.??.??.??, "bindIP6": "???????????", "basePort": ????, "basePort6": ????,
            "logLevel": "trace", "logLevelProposal": "trace",
            "emptyBlockIntervalMs": ?????, "ipc": false, "ipcpath": "./ipcx", "db-path": "./node",
            "httpRpcPort": ????, "httpsRpcPort": ????, "wsRpcPort": ????, "wssRpcPort": ????,
            "httpRpcPort6": ????, "httpsRpcPort6": ????, "wsRpcPort6": ????, "wssRpcPort6": ????,
            "acceptors": 1, "max-connections": 0,
            "web3-trace": true, "enable-debug-behavior-apis": false, "unsafe-transactions": false,
            "aa": "always", "web3-shutdown": false,
            "imaMainNet": "????://??.??.??.??:????",
            "imaMessageProxySChain":  "0x????????????????????????????????????????,
            "imaMessageProxyMainNet": "0x????????????????????????????????????????",
            "imaCallerAddressSChain": "0x????????????????????????????????????????",
            "imaCallerAddressMainNet": "0x????????????????????????????????????????",
            "wallets": {
                "ima": {
                    "url": ""????://??.??.??.??:????" "keyShareName": "???????????????", "t": 2, "n": 2,
                    "BLSPublicKey??????????????????????????????????????????????????????????????????????????",
                    "BLSPublicKey??????????????????????????????????????????????????????????????????????????",
                    "BLSPublicKey??????????????????????????????????????????????????????????????????????????",
                    "BLSPublicKey??????????????????????????????????????????????????????????????????????????",
                    "commonBLSPublicKey??????????????????????????????????????????????????????????????????????????",
                    "commonBLSPublicKey??????????????????????????????????????????????????????????????????????????",
                    "commonBLSPublicKey??????????????????????????????????????????????????????????????????????????",
                    "commonBLSPublicKey??????????????????????????????????????????????????????????????????????????"
                }
            }
        },
        "sChain": {
            "schainID": 1234, "schainName": "????????????????????",
            "nodes": [ {
                "schainIndex": 1, "nodeID": ????,
                "ip": "??.??.??.??", "ip6": "????????????????????", "basePort": ????, "basePort6": ????,
                "httpRpcPort": ????, "httpsRpcPort": ????, "wsRpcPort": ????, "wssRpcPort": ????,
                "httpRpcPort6": ????, "httpsRpcPort6": ????, "wsRpcPort6": ????, "wssRpcPort6": ????
            }, {
                "schainIndex": 1, "nodeID": ????,
                "ip": "??.??.??.??", "ip6": "????????????????????", "basePort": ????, "basePort6": ????,
                "httpRpcPort": ????, "httpsRpcPort": ????, "wsRpcPort": ????, "wssRpcPort": ????,
                "httpRpcPort6": ????, "httpsRpcPort6": ????, "wsRpcPort6": ????, "wssRpcPort6": ????
            } ]
        }
    }

Here is example of IMA message processing loop invocation with BLS support:

    reset; node ./main.js --verbose=9 \
        --loop \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM \
        --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN \
        --sign-messages \
        --bls-glue=/Users/l_sergiy/Work/skaled/build/libconsensus/libBLS/bls_glue \
        --hash-g1=/Users/l_sergiy/Work/skaled/build/libconsensus/libBLS/hash_g1 \
        --bls-verify=/Users/l_sergiy/Work/skaled/build/libconsensus/libBLS/verify_bls

    reset; node ./main.js --verbose=9 \
        --loop \
        --url-main-net=$URL_W3_ETHEREUM \
        --url-s-chain=$URL_W3_S_CHAIN \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --cid-main-net=-4 \
        --cid-s-chain=-4 \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain_Bob.json \
        --key-main-net=$PRIVATE_KEY_FOR_ETHEREUM \
        --key-s-chain=$PRIVATE_KEY_FOR_SCHAIN \
        --sign-messages \
        --bls-glue=/home/serge/Work/skaled/build/libconsensus/libBLS/bls_glue \
        --hash-g1=/home/serge/Work/skaled/build/libconsensus/libBLS/hash_g1 \
        --bls-verify=/home/serge/Work/skaled/build/libconsensus/libBLS/verify_bls
