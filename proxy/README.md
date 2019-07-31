# Proxy

SKALE Money Transfer Smart Contracts

Proxy is a library with smart contracts for SKALE Money Transfer Agent. It is a system which allow you transfer ETH, ERC20 and ERC721, based on Message Proxy system.
Smart contract language - Solidity 0.5.10

NodeJs version - 10.16.0
NPM verion - 6.9.0

## Message Proxy system

This system allow to send and receive messages from other chains.
`MessageProxy.sol` contract need to deploy to your mainnet, and for each Chain for use it with SKALE Money Transfer Agent.
You can use MessageProxy contract separatly by Money Transfer Smart Contracts:
1) Add interface:

```solidity
interface Proxy {
    function postOutgoingMessage(
        string calldata dstChainID, 
        address dstContract, 
        uint amount, 
        address to, 
        bytes calldata data
    ) 
        external;
}
```
2) Also write `postMessage` function, which will receive and process your messages from other chains:
```solidity
function postMessage(
    address sender, 
    string memory fromSchainID, 
    address payable to, 
    uint amount, 
    bytes memory data
) 
    public 
{
    ...
}
```
2) Add address of MessageProxy on some chain:
    Data of Smart contracts stores in `data` folder
3) Then continue developing your DApp

## MTA system
This system allow to send and receive ETH and ERC20/ERC721 tokens from other chains.
It combined of 3 additional smart contract not including MessageProxy contract:
1) `DepositBox.sol` - contract only on your mainnet:
    Can transfer your ETH and ERC20, ERC721 tokens to other chains.
     - `deposit(string memory schainID, address to)` - transfer ETH.
     ...
2) `TokenManager.sol`
3) `TokenFactory.sol`

## Install

1) Clone this repo
2) run `npm install`
3) run `npm start` , this command will compile contracts

## Deployment

Need to configure your networks for schain and your mainnet in `truffle-config.js`

You have several sample networks in comments.

Also you always need to create an `SCHAIN_NAME`, `MAINNET_RPC_URL`, `SCHAIN_RPC_URL` variables in your `.env` file

Need to create `.env` file with following data for your configured network:

```
MAINNET_RPC_URL="your mainnet rpc url, it also can be an infura endpoint"
SCHAIN_RPC_URL="your schain rpc url, it also can be an infura endpoint"
SCHAIN_NAME="your schain name"
PRIVATE_KEY_FOR_MAINNET="your private key for mainnet"
PRIVATE_KEY_FOR_SCHAIN="your private key for schain"
ACCOUNT_FOR_MAINNET="your account for mainnet"
ACCOUNT_FOR_SCHAIN="your account for schain"
MNEMONIC_FOR_MAINNET="your mnemonic for mainnet"
MNEMONIC_FOR_SCHAIN="your mnemonic for schain"
NETWORK_FOR_MAINNET="your created network for mainnet"
NETWORK_FOR_SCHAIN="your created network for schain"
```

 - deploy only to your mainnet:

```
npm run deploy-to-mainnet
```

 - deploy only to your schain:

```
npm run deploy-to-schain
```

 - deploy only to your mainnet and to schain:

```
npm run deploy-to-both
```
