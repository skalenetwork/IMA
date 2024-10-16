<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# SKALE Interchain Messaging Contracts

[![Discord](https://img.shields.io/discord/534485763354787851.svg)](https://discord.gg/vvUtWJB)

## A critical note about production readiness

The IMA is still in active development and therefore should be regarded as _alpha software_. The development is still subject to further security hardening, testing, and breaking changes.

**The proxy contracts have been reviewed and audited by a third-parties for security.**
Please see [SECURITY.md](.github/SECURITY.md) for audit reports and reporting policies.

## Software Architecture

IMA consists of the following three parts:

1) `Mainnet` smart contracts.
2) `SKALE Chain` smart contracts.
3) A containerized [IMA Agent](https://github.com/skalenetwork/ima-agent) application.

Smart contracts are interfaces for any software working with `Mainnet` and `SKALE Chain` like other smart contracts deployed there or software connecting these Ethereum networks.
The Agent is a Node JS application connecting the smart contracts on Mainnet with SKALE Chains.

## SKALE IMA Proxy

SKALE Interchain Messaging Smart Contracts

Proxy is a library with smart contracts for the SKALE Interchain Messaging Agent. This system allows transferring ETH, ERC20 and ERC721 and is based on the Message Proxy system.

- Smart contract language: Solidity 0.8.16
- NodeJS version: v18
- NPM version: 6.9.0

### Message Proxy system

This system allows sending and receiving messages from other chains. `MessageProxy.sol` contract needs to be deployed to Mainnet, and deployed to each SKALE chain to use it with the SKALE Interchain Messaging Agent.
You can use MessageProxy contract separately by Interchain Messaging Smart Contracts:

1) Add interface:

    ```solidity
    interface Proxy {
        function postOutgoingMessage(
            string calldata targetSchainName,
            address targetContract,
            uint256 amount,
            address to,
            bytes calldata data
        )
            external;
    }
    ```

2) Write `postMessage` function, which will receive and process messages from other chains:

    ```solidity
    function postMessage(
        address sender,
        string memory fromSchainName,
        address payable to,
        uint256 amount,
        bytes memory data
    )
        public
    {
        ...
    }
    ```

3) Add the address of MessageProxy on some chain:
    Data of Smart contracts stores in `data` folder

4) Then continue developing your dApp

### Ether clone on SKALE chain

There is a Wrapped Ether clone(EthERC20.sol) on SKALE chains - it is an ERC20 token and inherits the known ERC-20 approve issue. Please find more details here <https://blog.smartdec.net/erc20-approve-issue-in-simple-words-a41aaf47bca6>

### Interchain Messaging Agent system

This system sends and receives ETH, ERC20, and ERC721 tokens from other chains.
It consists of 3 additional smart contracts (not including MessageProxy contract):

1) `DepositBox.sol` - contract only on a mainnet: DepositBox can transfer ETH and ERC20, ERC721 tokens to other chains. \- `deposit(string memory schainName, address to)` - transfer ETH. ...
2) `TokenManager.sol`
3) `TokenFactory.sol`

### Install

1) Clone this repo
2) run `npm install`
3) run `npm start`, this command will compile contracts

### Deployment

Configure your networks for SKALE chain and mainnet in `truffle-config.js`

There are several example networks in comments.

The `.env` file should include the following variables:

```bash
URL_W3_ETHEREUM="your mainnet RPC url, it also can be an infura endpoint"
URL_W3_S_CHAIN="your SKALE chain RPC url, it also can be an infura endpoint"
CHAIN_NAME_SCHAIN="your SKALE chain name"
PRIVATE_KEY_FOR_ETHEREUM="your private key for mainnet"
PRIVATE_KEY_FOR_SCHAIN="your private key for SKALE chain"
ACCOUNT_FOR_ETHEREUM="your account for mainnet"
ACCOUNT_FOR_SCHAIN="your account for SKALE chain"
NETWORK_FOR_ETHEREUM="your created network for mainnet"
NETWORK_FOR_SCHAIN="your created network for SKALE chain"
```

- deploy only to your mainnet:

```bash
npm run deploy-to-mainnet
```

- deploy only to your schain:

```bash
npm run deploy-to-schain
```

- deploy only to your mainnet and to schain:

```bash
npm run deploy-to-both
```

#### Generate IMA data file for skale-node

Results will be saved to `[RESULTS_FOLDER]/ima_data.json`

- `ARTIFACTS_FOLDER` - path to `build/contracts` folder
- `RESULTS_FOLDER` - path to the folder where `ima_data.json` will be saved

```bash
cd proxy
npm run compile
python ima_datafile_generator.py [ARTIFACTS_FOLDER] [RESULTS_FOLDER]
```

## For more information

- [SKALE Network Website](https://skale.network)
- [SKALE Network Twitter](https://twitter.com/SkaleNetwork)
- [SKALE Network Blog](https://skale.network/blog)

Learn more about the SKALE community over on [Discord](https://discord.gg/vvUtWJB).

## Security and Liability

All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

## License

[![License](https://img.shields.io/github/license/skalenetwork/IMA)](LICENSE)
All contributions are made under the [GNU Affero General Public License v3](https://www.gnu.org/licenses/agpl-3.0.en.html). See [LICENSE](LICENSE).
Copyright (C) 2019-Present SKALE Labs.
