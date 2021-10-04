import { contracts, getContractKeyInAbiFile } from "./deploySchain";
import { ethers, network, upgrades } from "hardhat";
import { promises as fs } from "fs";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { getAbi } from "./tools/abi";
import chalk from "chalk";
import { getVersion } from "./tools/version";

type DeploymentAction = (safeTransactions: string[], abi: any) => Promise<void>;

export async function upgrade(
    targetVersion: string,
    contractNamesToUpgrade: string[],
    deployNewContracts: DeploymentAction,
    initialize: DeploymentAction)
{
    if (!process.env.ABI) {
        console.log(chalk.red("Set path to file with ABI and addresses to ABI environment variables"));
        return;
    }

    const abiFilename = process.env.ABI;
    const abi = JSON.parse(await fs.readFile(abiFilename, "utf-8"));

    const [ deployer ] = await ethers.getSigners();

    const proxyAdminAddress = abi[getContractKeyInAbiFile("ProxyAdmin") + "_address"];
    const proxyAdminAbi = abi[getContractKeyInAbiFile("ProxyAdmin") + "_abi"];
    const proxyAdmin = new ethers.Contract(proxyAdminAddress, proxyAdminAbi, deployer);
    const version = await getVersion();

    const adminOwner = await proxyAdmin.owner();

    if (adminOwner !== deployer.address) {
        console.log(chalk.red(`Admin owner is ${adminOwner} not the same as deployer ${deployer.address}`));
        return;
    }

    // Deploy new contracts
    await deployNewContracts(adminOwner, abi);

    // deploy new implementations
    const contractsToUpgrade: {proxyAddress: string, implementationAddress: string, name: string, abi: any}[] = [];
    for (const contract of contractNamesToUpgrade) {
        const contractFactory = await ethers.getContractFactory(contract);
        const _contract = contract;
        const proxyAddress = abi[getContractKeyInAbiFile(_contract) + "_address"];

        console.log(`Prepare upgrade of ${contract}`);
        const newImplementationAddress = await upgrades.prepareUpgrade(proxyAddress, contractFactory, { unsafeAllowLinkedLibraries: true });
        const currentImplementationAddress = await getImplementationAddress(network.provider, proxyAddress);
        if (newImplementationAddress !== currentImplementationAddress)
        {
            contractsToUpgrade.push({
                proxyAddress,
                implementationAddress: newImplementationAddress,
                name: contract,
                abi: getAbi(contractFactory.interface)
            });
        } else {
            console.log(chalk.gray(`Contract ${contract} is up to date`));
        }
    }

    // Switch proxies to new implementations
    for (const contract of contractsToUpgrade) {
        console.log(chalk.yellowBright(`Prepare transaction to upgrade ${contract.name} at ${contract.proxyAddress} to ${contract.implementationAddress}`));
        await proxyAdmin.connect(deployer).upgrade(contract.proxyAddress, contract.implementationAddress);
        abi[getContractKeyInAbiFile(contract.name) + "_abi"] = contract.abi;
    }

    await initialize(adminOwner, abi);

    await fs.writeFile(`data/proxySchain-${version}-${network.name}-abi.json`, JSON.stringify(abi, null, 4));

    console.log("Done");
}

async function main() {
    await upgrade(
        "1.0.0",
        contracts,
        async (adminOwner, abi) => undefined,
        async (adminOwner, abi) => undefined
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
