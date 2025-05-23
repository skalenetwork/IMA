import chalk from "chalk";
import { skaleContracts } from "@skalenetwork/skale-contracts-ethers-v6";
import { ethers } from "hardhat";
import { JsonRpcProvider } from "ethers";
import {Migrator} from "@skalenetwork/upgrade-tools/dist/src/migration/migrator"
import { getAbi, getVersion } from "@skalenetwork/upgrade-tools";
import { contracts } from "./deployMainnet";
import { ContractManager } from "../typechain";
import {promises as fs} from 'fs';

const skaleManagerContracts = [
    "ContractManager",

    "DelegationController",
    "DelegationPeriodManager",
    "Distributor",
    "Punisher",
    "SlashingTable",
    "TimeHelpers",
    "TokenState",
    "ValidatorService",
    "ConstantsHolder",
    "Nodes",
    "NodeRotation",
    "SchainsInternal",
    "Schains",
    "Decryption",
    "ECDH",
    "KeyStorage",
    "SkaleDKG",
    "SkaleVerifier",
    "SkaleManager",
    "BountyV2",
    "Wallets",
    "SyncManager",
    "PaymasterController"
];

function getContractKeyInAbiFile(contract: string) {
    return contract.replace(/([a-zA-Z])(?=[A-Z])/g, '$1_').toLowerCase();
}

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
    const balanceDepositBox = await provider.getBalance(imaInstance.getContractAddress("DepositBoxEth"));
    const communityPool = await provider.getBalance(imaInstance.getContractAddress("CommunityPool"));
    if (balanceDepositBox + communityPool > await ethers.provider.getBalance((await ethers.getSigners())[0].address)) {
        console.log("Your funds:", await provider.getBalance((await ethers.getSigners())[0].address));
        console.log("Required:", balanceDepositBox + communityPool);
        console.log("Network", (await ethers.provider.getNetwork()).chainId);
        throw new Error("Insuficient Funds for migration");
    }

    const migrator: Migrator = await Migrator.createFromProject(
        {
            name: "mainnet-ima",
            instance: imaInstance,
            version: await getVersion(),
            contractNamesToUpgrade: contracts
        },
        provider,
        undefined,
        undefined
    );

    // dump storage from intance contracts
    await migrator.dumpStorage();

    // deploy mock implementations of each contract = RayStorageSetter.sol
    await migrator.init();

    // will set values that contain old smart-contract addresses to the new addresses
    migrator.setDefaultValuesToUpdate();

    // add also all contracts from SkaleManager
    console.log("Adding Values to update");
    for (const contractName of skaleManagerContracts) {
        migrator.addValueToUpdate(
            await skaleManagerOldInstance.getContractAddress(contractName),
            await skaleManagerNewInstance.getContractAddress(contractName),
        );
    }


    // triggers the migration of data to new contracts and transfers old balances
    console.log("Starting data migration...")
    await migrator.migrateData();


    // upgrades contracts to new implementation
    console.log("Starting contract upgrades...");
    await migrator.upgrade();
    //set new addresses in contractManager -- I gotta be the owner
    const newContractManager = (await skaleManagerNewInstance.getContract("ContractManager")) as unknown as ContractManager;
    for (const contract of contracts) {
        const newAddr = migrator.getContractNewAddress(contract);
        if (!newAddr) continue;
        const tx = await newContractManager.setContractsAddress(contract, newAddr);
        await tx.wait();
    }

    //TODO: set PaymasterController addresses in skale-manager
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymasterController: any = await skaleManagerNewInstance.getContract("PaymasterController");
    const tx = await paymasterController["setImaAddress"](migrator.getContractNewAddress("MessageProxyForMainnet"));
    await tx.wait();

    //TODO:

    console.log("Done");
    const outputObject: {[k: string]: unknown} = {};
    for (const name of contracts) {
        const contractKey = getContractKeyInAbiFile(name);
        const address = migrator.getContractNewAddress(name);
        outputObject[contractKey + "_address"] = address;
        const contract = await ethers.getContractAt(name, address!);
        outputObject[contractKey + "_abi"] = getAbi(contract.interface);
    }

    await fs.writeFile(
        `data/mainnet-ima-${imaInstance.version as string}-${(await ethers.provider.getNetwork()).name}-abi.json`,
        JSON.stringify(outputObject, null, 4)
    );
}


if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
