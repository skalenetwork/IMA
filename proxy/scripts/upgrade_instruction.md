# Step-by-step guide for upgrading IMA contracts on Schain side

## Installing project
Git clone and run yarn install in the root of the project.
## Preparing environment
First of all you need to create new account. You can generate it in Metamask. Next export private key and put it in `.env` as `PRIVATE_KEY` without 0x by path `IMA/proxy/`. Also put endpoint of your chain as `ENDPOINT` to the `.env`.
## Granting role
Next you need to grant `DEPLOYER_ROLE` for account that we have created in previous step for being able to deploy new contracts on chain. One of the options you can use multisigwallet-cli to encode the transaction and send it via IMA to the Skale chain. Also you can ask somebody from Skale engineering team to do it for you.
## Getting sFuel
Now you need to get some sFuel on your new account. To do this, you can use a contract that distributes sFuel - Etherbase. As in the previous step, you can use multisigwallet-cli or transfer a sufficient amount of sFuel to the wallet you created earlier.
## Running upgrade script
* `DEPLOYED_VERSION` - current version of your IMA contracts.
* `SCHAIN_ID` - chainId of SKALE chain.
* `SCHAIN_NAME` - name of SKALE chain.
* `SAFE_ADDRESS` - address of gnosis safe wallet on mainnet.
* `MAINNET_CHAIN_ID` - chainId, use 1 for Ethereum mainnet or 5 for Goerli.
* `MESSAGE_PROXY_MAINNET_ADDRESS` - address of MessageProxyForMainnet contract. Optional parameter. Required only if you have deployed custom IMA on mainnet.  

Run the upgrade script in `IMA/proxy/` with the above parameters.
```bash
./scripts/magic_upgrade.sh
```













<br>
<br>
<br>
<br>
<br>
<br>
<br>
<br>




SKALE Interchain Messaging Smart Contracts

Proxy is a library with smart contracts for the SKALE Interchain Messaging Agent. This system allows transferring ETH, ERC20 and ERC721 and is based on the Message Proxy system.

Smart contract language - Solidity 0.5.10
NodeJS version - 10.16.0
NPM version - 6.9.0

## Message Proxy system

This system allows sending and receiving messages from other chains. `MessageProxy.sol` contract needs to be deployed to Mainnet, and deployed to each SKALE chain to use it with the SKALE Interchain Messaging Agent.
You can use MessageProxy contract separately by Interchain Messaging Smart Contracts:

1)  Add interface:

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

2)  Write `postMessage` function, which will receive and process messages from other chains:

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

3)  Add the address of MessageProxy on some chain:
    Data of Smart contracts stores in `data` folder

4)  Then continue developing your dApp

## Ether clone on SKALE chain

There is a Wrapped Ether clone(EthERC20.sol) on SKALE chains - it is an ERC20 token and inherits the known ERC-20 approve issue. Please find more details here https://blog.smartdec.net/erc20-approve-issue-in-simple-words-a41aaf47bca6

## Interchain Messaging Agent system

This system sends and receives ETH, ERC20, and ERC721 tokens from other chains.
It consists of 3 additional smart contracts (not including MessageProxy contract):

1)  `DepositBox.sol` - contract only on a mainnet: DepositBox can transfer ETH and ERC20, ERC721 tokens to other chains. \- `deposit(string memory schainName, address to)` - transfer ETH. ...
2)  `TokenManager.sol`
3)  `TokenFactory.sol`

## Install

1)  Clone this repo
2)  run `npm install`
3)  run `npm s