# SKALE Money Transfer Agent

## Overview

This article refers to **SKALE Money Transfer Agent** as **MTA**.

**MTA** consists of the following parts:

- Contracts on Main-net
- Contracts on S-Chain
- NodeJS based app

## Contracts installation

### Contracts prerequisites

First of all, we need special truffle version **5.0.12** (notice, the *-g* option of *npm* may require *sudo*):

    sudo npm uninstall -g truffle
    sudo npm install -g truffle@5.0.12
    truffle --version

Second, get source code of Solidity contracts and install dependecies:

    git clone git@github.com:skalenetwork/MTA.git
    cd ./MTA

### Node JS prerequisites

Third, install required **Node JS** everywhere they needed:

    export MTA_ROOT=.....
    #
    cd $MTA_ROOT/proxy
    rm -rf ./node_modules &> /dev/null
    npm install
    #
    cd $MTA_ROOT/npms/skale-mta
    rm -rf ./node_modules &> /dev/null
    npm install
    #
    cd $MTA_ROOT/agent
    rm -rf ./node_modules &> /dev/null
    npm install


Fourth, edit the *$MTA_ROOT/proxy/truffle-config.js* and specify needed networks (Main-net and S-Chain) and account addresses which will own contracts on these blockchains:

    cd $MTA_ROOT/proxy
    nano ./truffle-config.js

We will use networks called **local** and **schain** in this documentation:

    var privateKey_main_net = "23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc";
    var privateKey_s_chain  = "80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e";

...

    local: { # for Main-net
        gasPrice: 10000000000,
        gas: 8000000,
        network_id: "*",
        provider: () => { return new HDWalletProvider( privateKey_main_net, "http://127.0.0.1:8545" ); },
        skipDryRun: true
    },
    schain: { # for S-Chain
        provider: () => { return new privateKeyProvider(privateKeyForSchain, schainRpcUrl); },
        gasPrice: 1000000000,
        gas: 8000000,
        name: schainName,
        network_id: "*"
    },

Fourth, export required environment variables:

    export NETWORK_FOR_MAINNET="local"
    export ETH_PRIVATE_KEY_FOR_MAINNET="23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc"
    export NETWORK_FOR_SCHAIN="schain"
    export ETH_PRIVATE_KEY_FOR_SCHAIN="80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e"
    export SCHAIN_NAME="Bob"

    export MAINNET_RPC_URL="http://127.0.0.1:8545"
    export SCHAIN_RPC_URL="http://127.0.0.1:7000"
    export SCHAIN_NAME="Bob"
    export PRIVATE_KEY_FOR_MAINNET="23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc"
    export PRIVATE_KEY_FOR_SCHAIN="80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e"
    export ACCOUNT_FOR_MAINNET="0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f"
    export ACCOUNT_FOR_SCHAIN="0x66c5a87f4a49DD75e970055A265E8dd5C3F8f852"
    export MNEMONIC_FOR_MAINNET="your mnemonic for mainnet"
    export MNEMONIC_FOR_SCHAIN="your mnemonic for schain"


Fifth, try rebuild all the contracts once to ensure everything initialized OK:

    cd $MTA_ROOT/proxy
    rm -rf ./build
    truffle complile

### Contracts pre-installation on Main-net and S-Chain

Pre-clean previous version of contract ABI JSON files:

    cd $MTA_ROOT/proxy
    ./clean.sh

For main net, invoke:

    cd $MTA_ROOT/proxy
    npm run deploy-to-mainnet
    ls -1 ./data/

You should see **proxyMainnet.json** file listed.

For S-Chain, invoke:

    cd $MTA_ROOT/proxy
    npm run deploy-to-schain
    ls -1 ./data/

You should see **proxySchain.json** file listed.

## MTA installation

### Bind MTA to Main-net

**MTA** works as S-Chain extension. It should be registered on Main-net before performing any money transfers between blockchains:

    node ./main.js --verbose=9 \
        --register \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:7000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e

### Run MTA for particular S-Chain

Performed with the **--loop** command line option:

    node ./main.js --verbose=9 \
        --loop \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:7000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e

Notice: the command above can be run in forever while loop of shell script or became a part of daemon service file.

## Other MTA tasks

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
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:7000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --address-s-chain=0x66c5a87f4a49dd75e970055a265e8dd5c3f8f852

Notice: The command above does payment from Main-net and that is why we need to specify private key for source account inside Main-net blockchain using the **--key-main-net** command line argument. Target S-chain account is specified as address with the **--address-s-chain** command line argument. We don't need to specify private key for target account.

### Money transfer from S-Chain account to Main-net

Performed with the **--s2m-payment** command line option:

    node ./main.js --verbose=9 \
        --s2m-payment \
        --ether=1 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:7000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain.json \
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

    node ./main.js --verbose=9 \
        --m2s-transfer \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:7000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e

#### Single transfer iteration from S-chain to Main-net

Performed with the **--s2m-transfer** command line option:

    node ./main.js --verbose=9 \
        --s2m-transfer \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:7000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e

#### Single bidirectional transfer iteration between Main-net and S-chain

Performed with the **--transfer** command line option:

    node ./main.js --verbose=9 \
        --transfer \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:7000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain.json \
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

The **--node-number** and **--nodes-count** must me used for **MTA** instances running on S-Chain nodes which are part of multi-node S-Chain.

### ERC20 default transfer from Main-net account to S-Chain

Performed with the **--m2s-payment**, **--no-raw-transfer** and **--addr-erc20-s-chain** command line options:

    node ./main.js --verbose=9 \
        --m2s-payment \
        --amount=1 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:7000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain.json \
        --erc20-main-net=../../SkaleExperimental/skaled-tests/saved-Artem-scripts/Zhelcoin/data-mn.json \
        --addr-erc20-s-chain=?????????????????????? \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --address-s-chain=0x66c5a87f4a49dd75e970055a265e8dd5c3f8f852 \
        --no-raw-transfer

Notice: The command above does payment from Main-net and that is why we need to specify private key for source account inside Main-net blockchain using the **--key-main-net** command line argument. Target S-chain account is specified as address with the **--address-s-chain** command line argument. We don't need to specify private key for target account.

### ERC20 default transfer from S-Chain account to Main-net

Performed with the **--s2m-payment**, **--no-raw-transfer** and **--addr-erc20-s-chain** command line options:

    node ./main.js --verbose=9 \
        --s2m-payment \
        --amount=1 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:7000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain.json \
        --erc20-main-net=../../SkaleExperimental/skaled-tests/saved-Artem-scripts/Zhelcoin/data-mn.json \
        --addr-erc20-s-chain=?????????????????????? \
        --address-main-net=0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e \
        --no-raw-transfer

Notice: The command above does payment from Main-net and that is why we need to specify private key for source account inside S-chain blockchain using the **--key-s-chain** command line argument. Target Main-net account is specified as address with the **--address-main-net** command line argument. We don't need to specify private key for target account.

### ERC20 raw transfer from Main-net account to S-Chain

Performed with the **--m2s-payment** and **--raw-transfer** command line options:

    node ./main.js --verbose=9 \
        --m2s-payment \
        --amount=1 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:7000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain.json \
        --erc20-main-net=../../SkaleExperimental/skaled-tests/saved-Artem-scripts/Zhelcoin/data-mn.json \
        --erc20-s-chain=../../SkaleExperimental/skaled-tests/saved-Artem-scripts/Zhelcoin/data-sc.json \
        --key-main-net=23abdbd3c61b5330af61ebe8bef582f4e5cc08e554053a718bdce7813b9dc1fc \
        --address-s-chain=0x66c5a87f4a49dd75e970055a265e8dd5c3f8f852 \
        --raw-transfer

Notice: The command above does payment from Main-net and that is why we need to specify private key for source account inside Main-net blockchain using the **--key-main-net** command line argument. Target S-chain account is specified as address with the **--address-s-chain** command line argument. We don't need to specify private key for target account.

### ERC20 raw transfer from S-Chain account to Main-net

Performed with the **--s2m-payment** and **--raw-transfer** command line options:

    node ./main.js --verbose=9 \
        --s2m-payment \
        --amount=1 \
        --url-main-net=http://127.0.0.1:8545 \
        --url-s-chain=http://127.0.0.1:7000 \
        --id-main-net=Mainnet \
        --id-s-chain=Bob \
        --abi-main-net=../proxy/data/proxyMainnet.json \
        --abi-s-chain=../proxy/data/proxySchain.json \
        --erc20-main-net=../../SkaleExperimental/skaled-tests/saved-Artem-scripts/Zhelcoin/data-mn.json \
        --erc20-s-chain=../../SkaleExperimental/skaled-tests/saved-Artem-scripts/Zhelcoin/data-sc.json \
        --address-main-net=0x7aa5e36aa15e93d10f4f26357c30f052dacdde5f \
        --key-s-chain=80ebc2e00b8f13c5e2622b5694ab63ee80f7c5399554d2a12feeb0212eb8c69e \
        --raw-transfer

Notice: The command above does payment from Main-net and that is why we need to specify private key for source account inside S-chain blockchain using the **--key-s-chain** command line argument. Target Main-net account is specified as address with the **--address-main-net** command line argument. We don't need to specify private key for target account.
