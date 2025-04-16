import chalk from "chalk";
import { skaleContracts } from "@skalenetwork/skale-contracts-ethers-v6";
import { ethers } from "hardhat";
import { JsonRpcProvider } from "ethers";
import {Migrator} from "@skalenetwork/upgrade-tools/dist/src/migration/migrator"
import { getVersion } from "@skalenetwork/upgrade-tools";
import { contracts } from "./deployMainnet";
import { Client } from "@skalenetwork/upgrade-tools/dist/src/migration/clients/clientStrategyFactory";
import { ContractManager } from "../typechain";

async function main() {
    if (!process.env.MAINNET_IMA_INSTANCE) {
        console.log(chalk.red("Specify desired ima instance to migrate"));
        console.log(chalk.red("Set desired ima instance to migrate to MAINNET_IMA_INSTANCE environment variable"));
        process.exit(1);
    }
    if (!process.env.SKALE_MANAGER_INSTANCE) {
        console.log(chalk.red("Specify skale-manager linked to IMA instance to migrate"));
        console.log(chalk.red("Set desired old skale-manager instance to SKALE_MANAGER_INSTANCE environment variable"));
        process.exit(1);
    }
    if (!process.env.SKALE_MANAGER_INSTANCE_MIGRATED) {
        console.log(chalk.red("Specify skale-manager instance already migrated"));
        console.log(chalk.red("Set desired migrated skale-manager instance to SKALE_MANAGER_INSTANCE_MIGRATED environment variable"));
        process.exit(1);
    }
    // Change to desired Node
    const provider = new JsonRpcProvider(process.env.ARCHIVE_NODE_ENDPOINT);
    const blockHash = (await provider.getBlock("latest"))?.hash;
    console.log(blockHash);
    const oldNetwork = await skaleContracts.getNetworkByProvider(provider);
    const imaProject = oldNetwork.getProject("mainnet-ima");
    const imaInstance = await imaProject.getInstance(process.env.MAINNET_IMA_INSTANCE);
    const skaleManagerOldProject = oldNetwork.getProject("skale-manager");
    const skaleManagerOldInstance = await skaleManagerOldProject.getInstance(process.env.SKALE_MANAGER_INSTANCE);
    console.log(await skaleManagerOldInstance.getContractAddress("ContractManager"));

    const newNetwork = await skaleContracts.getNetworkByProvider(ethers.provider);

    const skaleManagerNewProject = newNetwork.getProject("skale-manager");
    const skaleManagerNewInstance = await skaleManagerNewProject.getInstance(process.env.SKALE_MANAGER_INSTANCE_MIGRATED);

    const migrator: Migrator = await Migrator.createFromProject(
        {
            name: "mainnet-ima",
            instance: imaInstance,
            version: await getVersion(),
            contractNamesToUpgrade: contracts
        },
        provider,
        Client.GETH
    );

    // dump storage from intance contracts
    await migrator.dumpStorage();

    // deploy mock implementations of each contract = RayStorageSetter.sol
    await migrator.init();

    // will set values that contain old smart-contract addresses to the new addresses
    migrator.setDefaultValuesToUpdate();

    // TODO: check if more values are required
    migrator.addValueToUpdate(
        await skaleManagerOldInstance.getContractAddress("ContractManager"),
        await skaleManagerNewInstance.getContractAddress("ContractManager"),
    );

    migrator.addValueToUpdate(
        await skaleManagerOldInstance.getContractAddress("SkaleToken"),
        await skaleManagerNewInstance.getContractAddress("SkaleToken"),
    );

    migrator.addValueToUpdate(
        await skaleManagerOldInstance.getContractAddress("SkaleManager"),
        await skaleManagerNewInstance.getContractAddress("SkaleManager"),
    );

    // triggers the migration of data to new contracts
    console.log("Starting data migration...")
    await migrator.migrateData();

    //TODO: transfer ETH to communityPool
    const poolBalance = await provider.getBalance(await imaInstance.getContractAddress("CommunityPool"));
    const newPoolAddress = migrator.getContractNewAddress("CommunityPool")
    if (poolBalance > 0n) {
        console.log(`Sending ${poolBalance} to ${newPoolAddress}`)
        const tx = await (await ethers.getSigners())[0].sendTransaction({
            to: newPoolAddress,
            value: poolBalance
        })
        await tx.wait();
    }

    // upgrades contracts to new implementation
    console.log("Starting contract upgrades...")
    await migrator.upgrade();
    //set new addresses in contractManager
    const newContractManager = (await skaleManagerNewInstance.getContract("ContractManager")) as unknown as ContractManager;
    for (const contract of contracts) {
        const newAddr = migrator.getContractNewAddress(contract);
        if (!newAddr) continue;
        await newContractManager.setContractsAddress(contract, newAddr);
    }

    //TODO: set PaymasterController addresses in skale-manager
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymasterController: any = await skaleManagerNewInstance.getContract("PaymasterController");
    await paymasterController["setImaAddress"](migrator.getContractNewAddress("MessageProxyForMainnet"));

    //TODO: need to handle tokens in production env ?? Testnet seems to not have anything in deposit boxes

    console.log("Done");

}


if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
