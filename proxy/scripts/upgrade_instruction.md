# Step-by-step guide for upgrading IMA contracts on Schain side

## Installing project
Git clone and run yarn install in the root of the project.
## Preparing environment
First of all you need to create new account. You can generate it in Metamask. Next export private key and put it in `.env` as `PRIVATE_KEY` without 0x by path `IMA/proxy/`. Also put endpoint of your chain as `ENDPOINT` to the `.env`. Also you need to add this account to your Gnosis Wallet as one of the Safe owners. Open Gnosis app, go to "Settings", click "Add new owner" and then sign transaction.
## Granting role
Next you need to grant `DEPLOYER_ROLE` for account that we have created in previous step for being able to deploy new contracts on chain. One of the options you can use multisigwallet-cli to encode the transaction and send it via IMA to the Skale chain. Also you can ask somebody from Skale engineering team to do it for you.
## Getting sFuel
Now you need to get some sFuel on your new account. To do this, you can use a contract that distributes sFuel - Etherbase. As in the previous step, you can use multisigwallet-cli or transfer a sufficient amount of sFuel to the wallet you created earlier.
## Running upgrade script
* `DEPLOYED_VERSION` - current version of your IMA contracts. Example: `DEPLOYED_VERSION="1.3.0-stable.0"`
* `SCHAIN_ID` - chainId of SKALE chain.
* `SCHAIN_NAME` - name of SKALE chain.
* `SAFE_ADDRESS` - address of gnosis safe wallet on mainnet.
* `MAINNET_CHAIN_ID` - chainId, use 1 for Ethereum mainnet or 5 for Goerli.
* `MESSAGE_PROXY_MAINNET_ADDRESS` - address of MessageProxyForMainnet contract. Optional parameter. Required only if you have deployed custom IMA on mainnet.  

Run the upgrade script in `IMA/proxy/` with the above parameters.
```bash
./scripts/magic_upgrade.sh
```
