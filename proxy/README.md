<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# SKALE IMA Proxy

SKALE Interchain Messaging Smart Contracts

Proxy is a library with smart contracts for the SKALE Interchain Messaging Agent. This system allows transferring ETH, ERC20 and ERC721 and is based on the Message Proxy system.

Smart contract language - Solidity 0.5.10
NodeJS version - 10.16.0
NPM version - 6.9.0

## Message Proxy system

This system allows sending and receiving messages from other chains. `MessageProxy.sol` contract needs to be deployed to Mainnet, and deployed to each SKALE chain to use it with the SKALE Interchain Messaging Agent.
You can use MessageProxy contract separately by Interchain Messaging Smart Contracts:
1) Add interface:

```solidity
interface Proxy {
    function postOutgoingMessage(
        string calldata dstChainID, 
        address dstContract, 
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
    string memory fromSchainID, 
    address payable to, 
    uint256 amount, 
    bytes memory data
) 
    public 
{
    ...
}
```

2) Add the address of MessageProxy on some chain:
    Data of Smart contracts stores in `data` folder
3) Then continue developing your dApp

## Interchain Messaging Agent system

This system sends and receives ETH, ERC20, and ERC721 tokens from other chains.
It consists of 3 additional smart contracts (not including MessageProxy contract):
1) `DepositBox.sol` - contract only on a mainnet:
    DepositBox can transfer ETH and ERC20, ERC721 tokens to other chains.
     \- `deposit(string memory schainID, address to)` - transfer ETH.
     ...
2) `TokenManager.sol`
3) `TokenFactory.sol`

## Install

1) Clone this repo
2) run `npm install`
3) run `npm start`, this command will compile contracts

## Deployment

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

-   deploy only to your mainnet:

```bash
npm run deploy-to-mainnet
```

-   deploy only to your schain:

```bash
npm run deploy-to-schain
```

-   deploy only to your mainnet and to schain:

```bash
npm run deploy-to-both
```

### Generate IMA data file for skale-node

Results will be saved to `[RESULTS_FOLDER]/ima_data.json`

```bash
cd proxy
python ima_datafile_generator.py [ARTIFACTS_FOLDER] [RESULTS_FOLDER]
```
