import chalk from "chalk";
import { skaleContracts } from "@skalenetwork/skale-contracts-ethers-v6";
import { ethers, network } from "hardhat";
import { JsonRpcProvider } from "ethers";
import {Migrator} from "@skalenetwork/upgrade-tools/dist/src/migration/migrator"
import { getAbi, getVersion } from "@skalenetwork/upgrade-tools";
import { contracts } from "./deployMainnet";
import { ContractManager, MessageProxyForMainnet, SchainsInternal, TokenManager } from "../typechain";
import {promises as fs} from 'fs';
import { ethers as ethers2} from "ethers";
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

export function getContractKeyInAbiFile(contract: string) {
    if (contract === "MessageProxyForMainnet") {
        return "message_proxy_mainnet";
    }
    return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
}

async function main() {
    if (!process.env.MAINNET_IMA_INSTANCE) {
        console.log(chalk.red("Specify desired ima instance to migrate"));
        console.log(chalk.red("Set desired ima instance to migrate to MAINNET_IMA_INSTANCE environment variable"));
        process.exit(1);
    }
    if (!process.env.NEW_SCHAINS_OWNER) {
        console.log(chalk.red("Specify new Schains owner"));
        console.log(chalk.red("Set desired new Schains owner to NEW_SCHAINS_OWNER environment variable"));
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

    if (!process.env.SCHAIN_OWNER) {
        console.log(chalk.red("Specify SCHAINS_OWNER for existing schains"));
        process.exit(1);
    }
    if (!process.env.HOODI_ENDPOINT) {
        console.log(chalk.red("Specify skale-manager linked to IMA instance to migrate"));
        console.log(chalk.red("Set desired old skale-manager instance to SKALE_MANAGER_INSTANCE environment variable"));
        process.exit(1);
    }
    if (!process.env.HOLESKY_ENDPOINT) {
        console.log(chalk.red("Specify skale-manager linked to IMA instance to migrate"));
        console.log(chalk.red("Set desired old skale-manager instance to SKALE_MANAGER_INSTANCE environment variable"));
        process.exit(1);
    }

    /*if (!process.env.SCHAIN_OWNER_PRIV_KEY) {
        console.log(chalk.red("Specify SCHAIN_OWNER_PRIV_KEY for existing schains"));
        process.exit(1);
    }*/

    // Change to desired Node
    const provider = new JsonRpcProvider(process.env.ARCHIVE_NODE_ENDPOINT);
    const blockHash = (await provider.getBlock("latest"))?.hash;
    console.log(blockHash);
    if ((await provider.getCode(process.env.SCHAIN_OWNER)).length < 5 || (await ethers.provider.getCode(process.env.NEW_SCHAINS_OWNER)).length < 5) { // is Multisig
        console.log("Schain owners are not a multi-sig. Only multi-sig owner should be set");
        process.exit(1);
    }



    const owner = (await ethers.getSigners())[0];

    const oldNetwork = await skaleContracts.getNetworkByProvider(provider);
    const imaProject = oldNetwork.getProject("mainnet-ima");

    const imaInstance = await imaProject.getInstance(process.env.MAINNET_IMA_INSTANCE);
    imaInstance.version = "1.5.0-stable.0";
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
        3,
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

    // safe-contracts
    migrator.addValueToUpdate(
        await skaleManagerOldInstance.getContractAddress(process.env.SCHAIN_OWNER),
        await skaleManagerNewInstance.getContractAddress(process.env.NEW_SCHAINS_OWNER),
    );

    // triggers the migration of data to new contracts and transfers old balances
    console.log("Starting data migration...")
    await migrator.migrateData();


    // upgrades contracts to new implementation
    console.log("Starting contract upgrades...");
    await migrator.upgrade();

    //set new addresses in contractManager -- I gotta be the owner
    const newContractManager = ((await skaleManagerNewInstance.getContract("ContractManager")) as unknown as ContractManager).connect(owner);
    for (const contract of contracts) {
        const newAddr = migrator.getContractNewAddress(contract);
        if (!newAddr) continue;
        const tx = await newContractManager.setContractsAddress(contract, newAddr);
        await tx.wait();
    }

    //TODO: set PaymasterController addresses in skale-manager
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paymasterController: any = await skaleManagerNewInstance.getContract("PaymasterController");
    const tx = await paymasterController.connect(owner)["setImaAddress"](migrator.getContractNewAddress("MessageProxyForMainnet"));
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
    console.log("Created abi file successfuly.");

    // Register new and unregister old contracts
    const schainsInternal = await skaleManagerNewInstance.getContract("SchainsInternal") as unknown as SchainsInternal;
    const schainHashes = await schainsInternal.getSchains();
    const msgProxy = (
        await ethers.getContractAt(
            "MessageProxyForMainnet",
            await skaleManagerNewInstance.getContractAddress("MessageProxyForMainnet")
        )
    ).connect(owner);

    const oldContractManager = (await skaleManagerOldInstance.getContract("ContractManager")) as unknown as ContractManager;
    for(const contractName of contracts){
        if (contractName == "MessageProxyForMainnet") continue;
        const old = await oldContractManager.getContract(contractName);
        if (await msgProxy.isContractRegistered(ethers2.ZeroHash, old)) {
            let tx = await msgProxy.removeExtraContractForAll(old);
            await tx.wait();
            tx = await msgProxy.registerExtraContractForAll(migrator.getContractNewAddress(contractName)!);
            await tx.wait();
        }
    }
    console.log("Allowing PaymasterController to send messages to all schains");
    const tx2 = await msgProxy.registerExtraContractForAll(await skaleManagerNewInstance.getContractAddress("PaymasterController"));
    await tx2.wait();
    console.log("SUCCESS");

    const EOAowned: string[] = [];
    for (const chain of schainHashes) {
        if (await schainsInternal.isOwnerAddress(process.env.SCHAIN_OWNER, chain)) {
            if (await msgProxy.isContractRegistered(chain, process.env.SCHAIN_OWNER)) {
                console.log("Owner was registered as extra contract. Unregistring..");
                const tx1 = await msgProxy.removeExtraContract(chain, process.env.SCHAIN_OWNER);
                await tx1.wait();
            }
            const tx1 = await msgProxy.registerExtraContract(chain, process.env.NEW_SCHAINS_OWNER);
            await tx1.wait();
            console.log("Registered new owner",process.env.NEW_SCHAINS_OWNER,"for",chain);
        }
        else {
            EOAowned.push(chain);
        }
    }
    console.log("EOA owned..")


    // TODO: Set deposit Boxes addresses in all Schains
    // This is custom for each tesnet migration and only for EOA-owned Schains

    const endpoints = [
        { name:"juicy-low-small-testnet", endpoint: "http://3.140.123.81:10003/", privKey:""},
        { name:"giant-half-dual-testnet", endpoint: "http://3.140.123.81:10067/", privKey:""},
        { name:"lanky-ill-funny-testnet", endpoint: "http://3.140.123.81:10131/", privKey:""},
        { name:"aware-fake-trim-testnet", endpoint: "http://3.140.123.81:10195/", privKey:""}
    ];
    const tokenManagers = [
        {manager:"TokenManagerERC20",box:"DepositBoxERC20"},
        {manager:"TokenManagerERC721",box:"DepositBoxERC721"},
        {manager:"TokenManagerERC721WithMetadata",box:"DepositBoxERC721WithMetadata"},
        {manager:"TokenManagerERC1155",box:"DepositBoxERC1155"},
        {manager:"TokenManagerEth",box:"DepositBoxEth"}
    ];
    if (endpoints.length === EOAowned.length) {
        try {
            for (const network of endpoints) {
                if (network.privKey === "") {
                    throw new Error("Please Config the priv keys for each EOA chain owner");
                    //we do not set env Vars as this is dependant for each instance, don't push code with private keys set :)
                    //anyway this is usualy for devnets, on production environments we use multisigs and this step is usualy skipped.
                }
                const schainProvider = new JsonRpcProvider(network.endpoint);
                const signer = new ethers.Wallet(network.privKey, schainProvider);
                const schainNetwork = await skaleContracts.getNetworkByProvider(schainProvider);
                const schainIMA = schainNetwork.getProject("schain-ima");
                const schainIMAInstance = await schainIMA.getInstance("predeployed");
                // Set deposit Box Addresses
                console.log("Setting addresses for", network.name);
                for (const manager of tokenManagers){
                    const contract = (await schainIMAInstance.getContract(manager.manager)) as unknown as TokenManager;
                    const tx = await contract.connect(signer).changeDepositBoxAddress(migrator.getContractNewAddress(manager.box)!);
                    await tx.wait();
                    console.log(manager.manager,"Done!");
                }
                console.log("successfuly set addresses for", network.name);
            }
        } catch (error) {
            console.log("WARNING: some items on Schains were not successfuly set.");
        }
    }
    console.log("Verifying..");
    await migrator.verify();
    console.log("All done!!");
}


if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
