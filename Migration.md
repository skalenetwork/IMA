# MIGRATION OF MAINNET IMA

To make IMA work at all, we require to at least migrate state of MessageProxyForMainnet. This is because messages to be accepted on both Mainnet and Schain sides, the message counters need to be correct so that message signatures are validated and messages are accepted.

There's also the possibility of migrating minimum components to make Schain to Schain transfers to work, with Mainnet instance only serving to validate data and connected Schains. I believe even migrating everything blindly should allow for S2S transfers, but transfers to and from mainnet should be blocked in case we decide to go this way, and we should also test it.

It's reccomended that before anything, we should somehow block usage of IMA in all Schains and Mainnet, untill all setup is complete.

As there are two sides of IMA, I split the doccument in those two sides, and then in Conclusion there's final overview of the process if we decide to proceed.

## 1. Migration of Mainnet Instance

Let us first analyse for each component what we can do automaticaly, and what needs to be made manualy after migration.

✅ --> means default migration should work, without post actions required.

⚠️ --> Requires special attention.

🟥 --> means re-deploy and re-setup is required/reccommended.



### Message Proxy ✅

This is the main component, and MUST be migrated if we ever want to be able to have transfers between Mainnet and Schains.

These are registered on usual deployment..
registered contracts: linker, communityPool, depositBoxes

Since during migration, all of the above are deployed before migrating data, things should be updated accordingly in MessageProxy, and no issue during normal migration should be raised.

### Linker ✅

Linker contains all the addresses that need to have a twin on Schain side.
All of these contracts should be deployed before data migration, and thus during migration the values should be updated accordingly.

### Community Pool ✅

No issues. We cand send it balance according to the balance it has on Holesky.

### DepositBoxEth ✅

No issues. We cand send it balance according to the balance it has on Holesky.

### DepositBoxERCXXX 🟥

Idealy, we should re-deploy with as much things setup as possible. Migration is not helpfull, and may even be harmfull.

The problem is that DepositBox is a Twin Contract. As a result, it has stored the correspondent address in each Schain. Redeploying, requires immediate setting this addresses the their right values so that by default, it is capable of sending messages to MessageProxy to all Schains. This setup can be done by engineering team (in principle).

Next, there's the issue of all tokens and balances that will be lost.
Using current implementation, there's no way to re-setup all things, and thus the following approach is necessary:

    - 1. Re-deploy tokens on Hoodi: Engineering can facilitate a script to 'migrate' tokens and assignment of the correct balances to all addresses if the trouble is worthed. Engineering can also create scripts to check if a token is correctly "migrated" given some minimal requirements. It's reccomended that this is done after deployment of DepositBoxes, so that during token 'migration' we can mint tokens to the new deposit box address on Hoodi (which is not known before migration). From our perspective the only requirement is that DepositBox on Hodi has the exact same balances as on Holesky. How it's achieved is more or less irrelevant for this document...
    - 2. After each token is migrated, it's required to manualy register it in the correct DepositBox.
    - 3. Finaly, if tokens are correctly migrated, Deposit boxes will have the right balances. IF we want to restore state that we can hypotheticaly work with, we require to upgrade DepositBoxes to an implementation that allows for seting up the bridged ammounts to the same values present in Holesky instance. Requires temporary upgrade of token boxes and then "downgrade".


## 2. Updates on Schain Instances

This might be the most challenging part.
IMA Schain instances store values gotten from MainnetIMA instance, including contract addresses and token addresses.

To allow for things to work with the new migrated instance  of mainnet, all Schain instances need to be updated manualy. Below I leave documented the required changes on all Schain instances.

### Proxy for Schain ⚠️

```solidity
mapping(SchainHash => EnumerableSetUpgradeable.AddressSet) private _registryContracts;
```

Values of this mapping MUST be updated for MainnetHash using `registerExtraContract` and `removeExtraContract`. Since functionality is present, this contract requires no upgrade.

### Community Locker ⚠️

```solidity
address public communityPool;
```
value of this address MUST be updated.

Also maybe gasPrice on mainnet and other less critical variables.
Bottom line is it would require an upgrade on all Schain instances just to add logic to change these variables, and then upgrate back to the previous implementation...

### Token Manager Linker ⚠️

```solidity
address public linkerAddress;
```

Requires upgrade just to create a setter for this variable, and this variable MUST be updated.

### Token Managers ⚠️

```solidity
address public depositBox;
```

All Token Managers require updating this variable. This is possible by using `changeDepositBoxAddress` function so it requires no upgrade this far.

This means TokenManagerEth works with the previous change.

For other token managers, there's extra work to be done...
For simplicity, an example will be described for ERC20 token manager, but the same process applies for the others (with changes in functionality).

```solidity
mapping(SchainHash => mapping(address => ERC20OnChain)) public clonesErc20;

mapping(SchainHash => mapping(address => uint256)) public transferredAmount;

mapping(SchainHash => EnumerableSetUpgradeable.AddressSet) private _schainToERC20;
```

These mappings will be invalid for SchainHash = MAINNET_HASH. This is because addresses will no longer be valid. The problem has two sides:

    - 1. Firstly, all previously set addresses should be removed for security reasons. It's highly unlikely a conflict will arrive but still it would be cool if we could set the mappings for older addresses to addres(0). But it's testnet, so who knows. *IF* we dont' set them to address(0), it's reccomended all off-chain components and DApps to update pre-set addresses of tokens on mainnet, otherwise unwanted behaviour will occur such as lost tokens during bridging (Schain might allow to send, but Mainnet will fail reception).
    - 2. New addresses of deployed contracts should be added after everything is normalized in DepositBoxes on mainnet.

Note that to complete these last steps, it will be required updates for all the contracts that need touching for special setting of these variables. It's unclear which ones do need it, because some might not have been used to bridge any tokens and thus can remain untouched.


## Conclusion

Migration seems possible but it's not straightforward, as longs as we go through all the trouble and manual updates and upgrades. It can easily take 1 month to carefully assist and handle migration, plus the time for development of helper scripts.

Procedure will look something like (after skale-manager is migrated):

    - 1. Lock usage of all IMA instances.
    - 2. Migrate Mainnet IMA (done by engineering) and deploy new DepositDoxes.
    - 3. Re-deployment of all tokens on Hoodi, and setup everything on DepositBoxes including updates and upgrades.
    - 4. Carefull Update all IMA Schain instance components that need to be updated. Requires first developing required implementation, having all addresses of new tokens, and manualy go to each Schain and update values.
    - 5. Finaly, update addresses in ContractsManager in skale-manager instance as IMA depends on skale-manager.
    - 6. Pray it works and unblock usage 😃.


We can also investigate the possibility of unblocking S2S transfers after step 2 is complete, if we find it's worthed. Still requires changes in Schain IMA instances to block outgoing messages to mainnet somehow.
