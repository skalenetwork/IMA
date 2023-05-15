<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# IMA Command Line Interface

**IMA** runs message transfer loop between **Ethereum(Main Net)** and **S-Chain**, also between assigned **S-Chain** and all connected to it other **S-Chains**. IMA also offers set of test tasks in its CLI.

IMA operates with 3 types of chains:

  -  **Ethereum(Main Net)**
  -  **S-Chain**, source **S-Chain**
  -  **T-Chain**, target **S-Chain**

In the most of use cases only **Ethereum(Main Net)** and source **S-Chain** are needed.

**IMA** supports the following groups of operations:

  -  Run message loop.
  -  Perform **S-Chain** registration and initialization.
  -  Configure and change gas reimbursement.
  -  Do **ETH**, **ERC20**, **ERC721**, **ERC1155**, batch **ERC1155** payments between chains.
  -  View amount of **ETH** can be received on Main Net.
  -  Mint **ERC20**, **ERC721**, **ERC1155** tokens.
  -  Show **ETH**, **ERC20**, **ERC721**, **ERC1155** balances.
  -  Browse **SKALE network**.
  -  Download source **S-Chain** information.
  -  Discover set of **S-Chains** connected to specified **S-Chains**.
  -  Discover chain ID of specified chain with `--discover-cid`.
  -  Run monitoring service and expose its JSON RPC, the `--monitoring-port=number` option turns on monitoring web socket RPC server on specified port. By default monitoring server is disabled.

Here is list of options running operations described above:

```
--show-config...................Show configuration values and exit.
--show-balance..................Show ETH and/or token balances on Main-net and/or S-Chain and exit.
--m2s-payment...................Do one payment from Main-net user account to S-chain user account.
--s2m-payment...................Do one payment from S-chain user account to Main-net user account.
--s2m-receive...................Receive one payment from S-chain user account to Main-net user account(ETH only, receives all the ETH pending in transfer).
--s2m-view......................View money amount user can receive as payment from S-chain user account to Main-net user account(ETH only, receives all the ETH pending in transfer).
--s2s-payment...................Do one payment from S-chain user account to other S-chain user account.
--s2s-forward...................Indicates S<->S transfer direction is forward. I.e. source S-chain is token minter and instantiator. This is default mode.
--s2s-reverse...................Indicates S<->S transfer direction is reverse. I.e. destination S-chain is token minter and instantiator.
--m2s-transfer..................Do single money transfer loop from Main-net to S-chain.
--s2m-transfer..................Do single money transfer loop from S-chain to Main-net.
--s2s-transfer..................Do single money transfer loop from S-chain to S-chain.
--with-metadata.................Makes ERC721 transfer using special version of Token Manager to transfer token metadata.
--transfer......................Run single M<->S and, optionally, S->S transfer loop iteration.
--loop..........................Run M<->S and, optionally, S->S transfer loop.
--browse-s-chain................Download own S-Chain network information.
--browse-skale-network..........Download entire SKALE network description.
--browse-connected-schains......Download S-Chains connected to S-Chain with name specified in id-s-chain command line parameter.
--mint-erc20....................Mint ERC20 tokens.
--mint-erc721...................Mint ERC721 tokens.
--mint-erc1155..................Mint ERC1155 tokens.
--burn-erc20....................Burn ERC20 tokens.
--burn-erc721...................Burn ERC721 tokens.
--burn-erc1155..................Burn ERC1155 tokens.
```

Please notice, token testing commands require `--tm-url-t-chain`, `cid-t-chain`, `erc20-t-chain` or `erc721-t-chain` or `erc1155-t-chain`, account information (like private key `key-t-chain`) command line arguments specified. Token amounts are specified via amount command line arguments specified. Token IDs are specified via tid or tids command line arguments.

One or more of the following URL, chain name and chain ID parameters are needed for most of **IMA** operations:

```
--url-main-net=URL..............Main-net URL. Value is automatically loaded from the URL_W3_ETHEREUM environment variable if not specified.
--url-s-chain=URL...............S-chain URL. Value is automatically loaded from the URL_W3_S_CHAIN environment variable if not specified.
--url-t-chain=URL...............S<->S Target S-chain URL. Value is automatically loaded from the URL_W3_S_CHAIN_TARGET environment variable if 
--id-main-net=number............Main-net Ethereum network name.. Value is automatically loaded from the CHAIN_NAME_ETHEREUM environment variable if not specified. Default value is "Mainnet".
--id-s-chain=number.............S-chain Ethereum network name.. Value is automatically loaded from the CHAIN_NAME_SCHAIN environment variable if not specified. Default value is "id-S-chain".
--id-t-chain=number.............S<->S Target S-chain Ethereum network name.. Value is automatically loaded from the CHAIN_NAME_SCHAIN_TARGET environment variable if not specified. Default value is "id-T-chain".
--cid-main-net=number...........Main-net Ethereum chain ID. Value is automatically loaded from the CID_ETHEREUM environment variable if not specified. Default value is -4.
--cid-s-chain=number............S-chain Ethereum chain ID. Value is automatically loaded from the CID_SCHAIN environment variable if not specified. Default value is -4.
--cid-t-chain=number............S<->S Target S-chain Ethereum chain ID. Value is automatically loaded from the CID_SCHAIN_TARGET environment variable if not specified. Default value is -4.
```

For most of operations, **IMA** needs ABIs of **Skale Manager**, **Ethereum(Main Net)**, **S-Chain(s)**:

```
--abi-skale-manager=path........Path to JSON file containing Skale Manager ABI. Optional parameter. It's needed for S-Chain to S-Chain transfers.
--abi-main-net=path.............Path to JSON file containing IMA ABI for Main-net.
--abi-s-chain=path..............Path to JSON file containing IMA ABI for S-chain.
--abi-t-chain=path..............Path to JSON file containing IMA ABI for S<->S Target S-chain.
```

Token transfer commands require token APIs on appropriate chains.

**ERC20** options:

```
--erc20-main-net=path...........Path to JSON file containing ERC20 ABI for Main-net.
--erc20-s-chain=path............Path to JSON file containing ERC20 ABI for S-chain.
--addr-erc20-s-chain=address....Explicit ERC20 address in S-chain.
--erc20-t-chain=path............Path to JSON file containing ERC20 ABI for S<->S Target S-chain.
--addr-erc20-t-chain=address....Explicit ERC20 address in S<->S Target S-chain.
```

**ERC721** options:

```
--erc721-main-net=path..........Path to JSON file containing ERC721 ABI for Main-net.
--erc721-s-chain=path...........Path to JSON file containing ERC721 ABI for S-chain.
--addr-erc721-s-chain=address...Explicit ERC721 address in S-chain.
--erc721-t-chain=path...........Path to JSON file containing ERC721 ABI for S<->S S-chain.
--addr-erc721-t-chain=address...Explicit ERC721 address in S<->S S-chain.
```

**ERC1155** options:

```
--erc1155-main-net=path.........Path to JSON file containing ERC1155 ABI for Main-net.
--erc1155-s-chain=path..........Path to JSON file containing ERC1155 ABI for S-chain.
--addr-erc1155-s-chain=address..Explicit ERC1155 address in S-chain.
--erc1155-t-chain=path..........Path to JSON file containing ERC1155 ABI for S<->S S-chain.
--addr-erc1155-t-chain=address..Explicit ERC1155 address in S<->S S-chain.
```

**IMA** can sign transactions using one of following ways:

  -  Using **Transaction Manager** JSON RPC
  -  Using **SGX wallet** JSON RPC
  -  Using explicitly specified private key
  -  Using wallet address, for read only operations only

The following parameters needed to use **Transaction Manager**:

```
--tm-url-main-net=URL...........Transaction Manager server URL for Main-net. Value is automatically loaded from the TRANSACTION_MANAGER_URL_ETHEREUM environment variable if not specified. Example: redis://@127.0.0.1:6379
--tm-url-s-chain=URL............Transaction Manager server URL for S-chain. Value is automatically loaded from the TRANSACTION_MANAGER_URL_S_CHAIN environment variable if not specified.
--tm-url-t-chain=URL............Transaction Manager server URL for S<->S Target S-chain. Value is automatically loaded from the TRANSACTION_MANAGER_URL_S_CHAIN_TARGET environment variable if not specified.
--tm-priority-main-net=URL......Transaction Manager priority for Main-net. Value is automatically loaded from the TRANSACTION_MANAGER_PRIORITY_ETHEREUM environment variable if not specified. Default is 5.
--tm-priority-s-chain=URL.......Transaction Manager priority for S-chain. Value is automatically loaded from the TRANSACTION_MANAGER_PRIORITY_S_CHAIN environment variable if not specified. Default is 5.
--tm-priority-t-chain=URL.......Transaction Manager priority for S<->S Target S-chain. Value is automatically loaded from the TRANSACTION_MANAGER_PRIORITY_S_CHAIN_TARGET environment variable if not specified. Default is 5.
```

The following parameters needed to use **SGX wallet**:

```
--sgx-url-main-net=URL..........SGX server URL for Main-net. Value is automatically loaded from the SGX_URL_ETHEREUM environment variable if not specified.
--sgx-url-s-chain=URL...........SGX server URL for S-chain. Value is automatically loaded from the SGX_URL_S_CHAIN environment variable if not specified.
--sgx-url-t-chain=URL...........SGX server URL for S<->S Target S-chain. Value is automatically loaded from the SGX_URL_S_CHAIN_TARGET environment variable if not specified.
--sgx-ecdsa-key-main-net=name...SGX/ECDSA key name for Main-net. Value is automatically loaded from the SGX_KEY_ETHEREUM environment variable if not specified.
--sgx-ecdsa-key-s-chain=name....SGX/ECDSA key name for S-chain. Value is automatically loaded from the SGX_KEY_S_CHAIN environment variable if not specified.
--sgx-ecdsa-key-t-chain=name....SGX/ECDSA key name for S<->S Target S-chain. Value is automatically loaded from the SGX_KEY_S_CHAIN_TARGET environment variable if not specified.
--sgx-ssl-key-main-net=path.....Path to SSL key file for SGX wallet of Main-net. Value is automatically loaded from the SGX_SSL_KEY_FILE_ETHEREUM environment variable if not specified.
--sgx-ssl-key-s-chain=path......Path to SSL key file for SGX wallet of S-chain. Value is automatically loaded from the SGX_SSL_KEY_FILE_S_CHAIN environment variable if not specified.
--sgx-ssl-key-t-chain=path......Path to SSL key file for SGX wallet of S<->S Target S-chain. Value is automatically loaded from the SGX_SSL_KEY_FILE_S_CHAIN_TARGET environment variable if not specified.
--sgx-ssl-cert-main-net=path....Path to SSL certificate file for SGX wallet of Main-net. Value is automatically loaded from the SGX_SSL_CERT_FILE_ETHEREUM environment variable if not specified.
--sgx-ssl-cert-s-chain=path.....Path to SSL certificate file for SGX wallet of S-chain. Value is automatically loaded from the SGX_SSL_CERT_FILE_S_CHAIN environment variable if not specified.
--sgx-ssl-cert-t-chain=path.....Path to SSL certificate file for SGX wallet of S<->S Target S-chain. Value is automatically loaded from the SGX_SSL_CERT_FILE_S_CHAIN_TARGET environment variable if not specified.
```

Using explicitly specified private key:

```
--address-main-net=value........Main-net user account address. Value is automatically loaded from the ACCOUNT_FOR_ETHEREUM environment variable if not specified.
--address-s-chain=value.........S-chain user account address. Value is automatically loaded from the ACCOUNT_FOR_SCHAIN environment variable if not specified.
--address-t-chain=value.........S<->S Target S-chain user account address. Value is automatically loaded from the ACCOUNT_FOR_SCHAIN_TARGET environment variable if not specified.
```

For read only operations, only wallet address can be specified:

```
--key-main-net=value............Private key for Main-net user account address. Value is automatically loaded from the PRIVATE_KEY_FOR_ETHEREUM environment variable if not specified.
--key-s-chain=value.............Private key for S-Chain user account address. Value is automatically loaded from the PRIVATE_KEY_FOR_SCHAIN environment variable if not specified.
--key-t-chain=value.............Private key for S<->S Target S-Chain user account address. Value is automatically loaded from the PRIVATE_KEY_FOR_SCHAIN_TARGET environment variable if not specified.
```

Please notice, **IMA** prefer to use transaction manager to sign blockchain transactions if `--tm-url-main-net`/`--tm-url-s-chain` command line values or `TRANSACTION_MANAGER_URL_ETHEREUM`/`TRANSACTION_MANAGER_URL_S_CHAIN` shell variables were specified. Next preferred option is **SGX wallet** which is used if `--sgx-url-main-net`/`--sgx-url-s-chain` command line values or `SGX_URL_ETHEREUM`/`SGX_URL_S_CHAIN` shell variables were specified. SGX signing also needs key name, key and certificate files. Finally, **IMA** attempts to use explicitly provided private key to sign blockchain transactions if `--key-main-net`/`--key-s-chain` command line values or `PRIVATE_KEY_FOR_ETHEREUM`/`PRIVATE_KEY_FOR_SCHAIN` shell variables were specified. 

**ETH** transfers operations require amount of **ETH** to be specified with one of the following options:

```
--value=numberUnitName..........Amount of unitName to transfer, where unitName is well known Ethereum unit name like ether or wei.
--wei=number....................Amount of wei to transfer.
--babbage=number................Amount of babbage(wei*1000) to transfer.
--lovelace=number...............Amount of lovelace(wei*1000*1000) to transfer.
--shannon=number................Amount of shannon(wei*1000*1000*1000) to transfer.
--szabo=number..................Amount of szabo(wei*1000*1000*1000*1000) to transfer.
--finney=number.................Amount of finney(wei*1000*1000*1000*1000*1000) to transfer.
--ether=number..................Amount of ether(wei*1000*1000*1000*1000*1000*1000) to transfer.
```

Token transfer operations require token amounts and/or token IDs:

```
--amount=number.................Amount of tokens to transfer.
--tid=number....................ERC721 or ERC1155 token id to transfer.
--amounts=array of numbers......ERC1155 token id to transfer in batch.
--tids=array of numbers.........ERC1155 token amount to transfer in batch.
--sleep-between-tx=number.......Sleep time (in milliseconds) between transactions during complex operations.
--wait-next-block...............Wait for next block between transactions during complex operations.
```

**Gas reimbursement** can be configure with the following options:

```
--reimbursement-chain=name......Specifies chain name.
--reimbursement-recharge=vu.....Recharge user wallet with specified value v, unit name u is well known Ethereum unit name like ether or wei.
--reimbursement-withdraw=vu.....Withdraw user wallet with specified value v, unit name u is well known Ethereum unit name like ether or wei.
--reimbursement-balance.........Show wallet balance.
--reimbursement-range=number....Sets minimal time interval between transfers from S-Chain to Main Net.
```

**Gas reimbursement** can be **Oracle**-based if the following options are specified:

--enable-oracle.................Enable call to Oracle to compute gas price for gas reimbursement. Default mode.
--disable-oracle................Disable call to Oracle to compute gas price for gas reimbursement.

**IMA** must be initialized and its **S-Chain** must be registered once after creation with the following options:

```
--register......................Register(perform all steps).
--check-registration............Perform registration status check(perform all steps).
```

**S-Chain** to **S-Chain** transfers must be turned on and require periodic **SKALE network re-discovery**:

```
--s2s-enable....................Enables S-Chain to S-Chain transfers. Default mode. The abi-skale-manager path must be provided.
--s2s-disable...................Disables S-Chain to S-Chain transfers.
--net-rediscover=number.........SKALE NETWORK re-discovery interval(in seconds). Default is 3600 seconds or 1 hour, specify 0 to disable SKALE NETWORK re-discovery.
```

**IMA** loop can optionally use dry run, group **IMA** messages and supports various customizations:

```
--no-wait-s-chain...............Do not wait until S-Chain is started.
--max-wait-attempts=value.......Max number of S-Chain call attempts to do while it became alive and sane.
--skip-dry-run..................Skip dry run contract method calls.
--ignore-dry-run................Ignore result of dry run contract method calls and continue execute.
--dry-run.......................Use error results of dry run contract method calls as actual errors and stop execute.
--m2s-transfer-block-size.......Number of transactions in one block to use in money transfer loop from Main-net to S-chain.
--s2m-transfer-block-size.......Number of transactions in one block to use in money transfer loop from S-chain to Main-net.
--s2s-transfer-block-size.......Number of transactions in one block to use in money transfer loop from S-chain to S-chain.
--transfer-block-size...........Number of transactions in one block to use in both money transfer loops.
--m2s-max-transactions..........Maximal number of transactions to do in money transfer loop from Main-net to S-chain(0 is unlimited).
--s2m-max-transactions..........Maximal number of transactions to do in money transfer loop from S-chain to Main-net(0 is unlimited).
--s2s-max-transactions..........Maximal number of transactions to do in money transfer loop from S-chain to S-chain(0 is unlimited).
--max-transactions..............Maximal number of transactions to do in both money transfer loops(0 is unlimited).
--m2s-await-blocks..............Maximal number of blocks to wait to appear in blockchain before transaction from Main-net to S-chain(0 is no wait).
--s2m-await-blocks..............Maximal number of blocks to wait to appear in blockchain before transaction from S-chain to Main-net(0 is no wait).
--s2s-await-blocks..............Maximal number of blocks to wait to appear in blockchain before transaction from S-chain to S-chain(0 is no wait).
--await-blocks..................Maximal number of blocks to wait to appear in blockchain before transaction between both S-chain and Main-net(0 is no wait).
--m2s-await-time................Minimal age of transaction message(in seconds) before it will be transferred from Main-net to S-chain(0 is no wait).
--s2m-await-time................Minimal age of transaction message(in seconds) before it will be transferred from S-chain to Main-net(0 is no wait).
--s2s-await-time................Minimal age of transaction message(in seconds) before it will be transferred from S-chain to S-chain(0 is no wait).
--await-time....................Minimal age of transaction message(in seconds) before it will be transferred between both S-chain and Main-net(0 is no wait).
--period........................Transfer loop period(in seconds).
--node-number=value.............S-Chain node number(0-based).
--nodes-count=value.............S-Chain nodes count.
--time-framing=value............Specifies period(in seconds) for time framing(0 to disable time framing).
--time-gap=value................Specifies gap(in seconds) before next time frame.
```

**IMA** transfer loop must **BLS**-sign messages and needs paths to **BLS** command line utilities:

```
--sign-messages.................Sign transferred messages.
--bls-glue=path.................Specifies path to bls_glue application.
--hash-g1=path..................Specifies path to hash_g1 application.
--bls-verify=path...............Optional parameter, specifies path to verify_bls application.
```

**IMA** transfer loop needs to scan **IMA smart contract** events, scanning can be customized with the following options:

```
--bs-step-size=number...........Specifies step block range size to search iterative past events step by step. 0 to disable iterative search.
--bs-max-all-range=number.......Specifies max number of steps to allow to search as [0...latest] range. 0 to disable iterative search.
--bs-progressive-enable.........Enables progressive block scan to search past events.
--bs-progressive-disable........Disables progressive block scan to search past events.
```

**IMA** pending work analysis subsystem allows to detect busy state of previous **IMA Agent** running long work outside its time frame:

```
--pwa...........................Enable pending work analysis to avoid transaction conflicts. Default mode.
--no-pwa........................Disable pending work analysis. Not recommended for slow and overloaded blockchains.
--pwa-timeout=seconds...........Node state timeout during pending work analysis. Default is 60 seconds.
```

Like any command line application, **IMA** produces various command line output and supports logging. Logging can be customized with the following options:

```
--expose........................Expose low-level log details after successful operations. By default details exposed only on errors.
--no-expose.....................Expose low-level log details only after errors. Default expose mode.
--verbose=value.................Set level of output details.
--verbose-list..................List available verbose levels and exit.
--log=path......................Write program output to specified log file(multiple files can be specified).
--log-size=value................Max size(in bytes) of one log file(affects to log log rotation).
--log-files=value...............Maximum number of log files for log rotation.
--gathered......................Print details of gathering data from command line arguments. Default mode.
--no-gathered...................Do not print details of gathering data from command line arguments.
--expose-security-info..........Expose security-related values in log output. This mode is needed for debugging purposes only.
--no-expose-security-info.......Do not expose security-related values in log output. Default mode.
--expose-pwa....................Expose IMA agent pending work analysis information
--no-expose-pwa.................Do not expose IMA agent pending work analysis information. Default mode.
```

Command line output and logging can be plain or ANSI-colorized:

```
--colors........................Use ANSI-colorized logging.
--no-colors.....................Use monochrome logging.
```