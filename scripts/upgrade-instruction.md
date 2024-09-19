# Step-by-step guide for upgrading IMA contracts on Schain side

## Install project

Git clone and run yarn install in the root of the project.

```bash
git clone https://github.com/skalenetwork/IMA.git && cd IMA/ && yarn install
```

## Prepare environment

 Create `.env` file by path `IMA/proxy/`. Now you need to create new account. You can generate it in Metamask. Next export private key and put it in `.env` as `PRIVATE_KEY` without 0x. Also put endpoint of your chain as `ENDPOINT` to the `.env`. Also you need to add this account to your Gnosis Wallet as one of the Safe owners. Open Gnosis app, go to "Settings", click "Add new owner" and then sign transaction. Example of `.env` file:

```bash
ENDPOINT="http://127.0.0.1:8545"
PRIVATE_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

## Grant role

Next you need to grant `DEPLOYER_ROLE` for account that we have created in previous step for being able to deploy new contracts on chain. One of the easiest ways to do this would be to use the Blockscout interface. First you need to find the `ConfigController` contract, its address is `0xD200200000000000000000000000000000000d2`, click `Write Proxy` connect the wallet on which there is sFUEL, find the `addToWhitelist` function and enter the address of the new account that you generated in the metamask, then click Write and confirm the transaction in the metamask.

## Get sFUEL

Now you need to get some sFUEL on your new account. To do this, you need to use a contract that distributes sFUEL - `Etherbase`. Also you can get sFUEL from faucet available on your chain - look on [sFUEL Station](https://sfuel.skale.network). As in the previous step, you can use Blockscout or transfer a sufficient amount of sFUEL to the wallet you created earlier. In order to do this in Blockscout, you need to go to `0xd2bA3e0000000000000000000000000000000000` and find the `partiallyRetrieve` function, there will be two fields. In the "receiver" field, you need to enter the sFUEL recipient, that is, the wallet address that you generated earlier. In the "amount" field, enter the amount of sFUEL in Wei. It is important to note that only the owner of the chain can perform this transaction.

## Switch to desired version

Before running the upgrade script, you need to switch to the desired version. The example below allows you to switch to the latest stable version.

```bash
git checkout stable && yarn install
```

## Run upgrade script

*  `DEPLOYED_VERSION` - current version of your IMA contracts. Example: `DEPLOYED_VERSION="1.1.3-beta.0"`
*  `SCHAIN_ID` - chainId of SKALE chain.
*  `SCHAIN_NAME` - name of SKALE chain.
*  `SAFE_ADDRESS` - address of gnosis safe wallet on mainnet.
*  `MAINNET_CHAIN_ID` - chainId, use 1 for Ethereum mainnet or 5 for Goerli.
*  `MESSAGE_PROXY_MAINNET_ADDRESS` - address of MessageProxyForMainnet contract. Optional parameter. Required only if you have deployed IMA on Goerli Testnet.
*  `ALLOW_NOT_ATOMIC_UPGRADE` - means that the transaction on the chain will not be executed atomically. That is, for example, if you send two transactions, there is a non-zero probability that they will be written to different blocks. Enter "OK" if you agree.
*  `VERSION` - version to upgrade to. Optional parametr. Leave this parameter empty if you are not sure which version you are updating to, the script will automatically take the correct version.

Run the upgrade script in `IMA/proxy/` with the above parameters.

```bash
./scripts/magic_upgrade.sh
```
