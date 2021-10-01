import { contracts, getContractKeyInAbiFile, getManifestFile } from "./deployMainnet";
import { ethers, network, upgrades, artifacts } from "hardhat";
import hre from "hardhat";
import { promises as fs } from "fs";
import { deployLibraries, getLinkedContractFactory } from "./tools/factory";
import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import chalk from "chalk";

function stringValue(value: string | undefined) {
    if (value) {
        return value;
    } else {
        return "";
    }
}

export async function transferOwnership(contractNamesToTransfer: string[])
{
    if (!process.env.ABI) {
        console.log(chalk.red("Set path to file with ABI and addresses to ABI environment variables"));
        return;
    }

    const abiFilename = process.env.ABI;
    const newOwner = stringValue(process.env.NEW_OWNER);
    const abi = JSON.parse(await fs.readFile(abiFilename, "utf-8"));

    const proxyAdmin = await getManifestAdmin(hre);

    const [ deployer ] = await ethers.getSigners();

    console.log(chalk.white(`New owner address ${newOwner}`));
    if (await ethers.provider.getCode(newOwner) === "0x") {
        console.log(chalk.blue("New owner is not a contract!"));
    }

    console.log(chalk.blue("Transfer ownership on Proxy Admin"));
    await (await proxyAdmin.transferOwnership(newOwner)).wait();
    for (const contractName of contractNamesToTransfer) {
        const contractFactory = await ethers.getContractFactory(contractName);
        const _contract = contractName;
        const contractAddress = abi[getContractKeyInAbiFile(_contract) + "_address"];
        const contract = contractFactory.attach(contractAddress);
        console.log(chalk.blue(`Grant access to ${contractName}`));
        await (await contract.grantRole(await contract.DEFAULT_ADMIN_ROLE(), newOwner)).wait();
    }

    for (const contractName of contractNamesToTransfer) {
        const contractFactory = await ethers.getContractFactory(contractName);
        const _contract = contractName;
        const contractAddress = abi[getContractKeyInAbiFile(_contract) + "_address"];
        const contract = contractFactory.attach(contractAddress);
        console.log(chalk.blue(`Revoke role on ${contractName}`));
        await (await contract.revokeRole(await contract.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();
    }

    console.log("Done");
}

async function main() {
    await transferOwnership(contracts);
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
