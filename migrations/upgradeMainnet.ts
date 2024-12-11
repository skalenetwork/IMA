import chalk from "chalk";
import { ethers } from "hardhat";
import { promises as fs } from 'fs';
import { Transaction } from "ethers";
import { getAbi, getVersion, Submitter, Upgrader } from "@skalenetwork/upgrade-tools";
import { skaleContracts, Instance } from "@skalenetwork/skale-contracts-ethers-v6";
import { MessageProxyForMainnet } from "../typechain";
import { contracts, getContractKeyInAbiFile } from "./deployMainnet";


async function getImaMainnetInstance() {
    if (!process.env.TARGET) {
        console.log(chalk.red("Specify desired mainnet-ima instance"));
        console.log(chalk.red("Set instance alias or MessageProxyForMainnet address to TARGET environment variable"));
        process.exit(1);
    }
    const network = await skaleContracts.getNetworkByProvider(ethers.provider);
    const project = network.getProject("mainnet-ima");
    return await project.getInstance(process.env.TARGET);
}

class ImaMainnetUpgrader extends Upgrader {

    constructor(
        targetVersion: string,
        instance: Instance,
        contractNamesToUpgrade: string[],
        submitter?: Submitter) {
            super(
                {
                    contractNamesToUpgrade,
                    instance,
                    name: "proxyMainnet",
                    version: targetVersion,
                },
                submitter
            );
        }

    getMessageProxyForMainnet = async () => {
        return await this.instance.getContract("MessageProxyForMainnet") as MessageProxyForMainnet;
    }

    getDeployedVersion = async () => {
        const messageProxyForMainnet = await this.getMessageProxyForMainnet();
        try {
            return await messageProxyForMainnet.version();
        } catch {
            console.log(chalk.red("Can't read deployed version"));
        }
    }

    setVersion = async (newVersion: string) => {
        const messageProxyForMainnet = await this.getMessageProxyForMainnet();
        this.transactions.push(Transaction.from({
            to: await messageProxyForMainnet.getAddress(),
            data: messageProxyForMainnet.interface.encodeFunctionData("setVersion", [newVersion])
        }));
    }

    // deployNewContracts = () => { };

    // initialize = () => { };

    _getContractKeyInAbiFile(contract: string) {
        if (contract === "MessageProxyForMainnet") {
            return "message_proxy_mainnet";
        }
        return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
    }
}

async function updateAbi() {
    if (!process.env.ABI) {
        console.log(chalk.red("Set path to file with ABI and addresses to ABI environment variables"));
        process.exit(1);
    }
    const network = await ethers.provider.getNetwork();
    const version = await getVersion();
    const abiFilename = process.env.ABI;
    const abi = JSON.parse(await fs.readFile(abiFilename, "utf-8"));
    for (const contract of contracts) {
        const contractInterface = (await ethers.getContractFactory(contract)).interface;
        abi[getContractKeyInAbiFile(contract) + "_abi"] = getAbi(contractInterface);
    }
    const newAbiFilename = `data/mainnet-ima-${version}-${network.name}.json`;
    await fs.writeFile(newAbiFilename, JSON.stringify(abi, null, 4));
    console.log(chalk.green(`ABI updated and saved to ${newAbiFilename}`));
}

async function main() {
    let contractNamesToUpgrade: string[] = []
    if (process.env.UPGRADE_ALL) {
        contractNamesToUpgrade = contracts;
    }
    const upgrader = new ImaMainnetUpgrader(
        "2.2.0",
        await getImaMainnetInstance(),
        contractNamesToUpgrade
    );
    await upgrader.upgrade();
    await updateAbi();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
