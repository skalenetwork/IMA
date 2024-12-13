import chalk from "chalk";
import { ethers } from "hardhat";
import { promises as fs } from "fs";
import { Transaction } from "ethers";
import { getAbi, getVersion, Submitter, Upgrader } from "@skalenetwork/upgrade-tools";
import { skaleContracts, Instance } from "@skalenetwork/skale-contracts-ethers-v6";
import { contracts, getContractKeyInAbiFile } from "./deploySchain";
import { manifestSetup } from "./generateManifest";
import { MessageProxyForSchain } from "../typechain";


async function getImaSchainInstance() {
    if (!process.env.TARGET) {
        console.log(chalk.red("Specify desired schain-ima instance"));
        console.log(chalk.red("Set instance alias or MessageProxyForSchain address to TARGET environment variable"));
        process.exit(1);
    }
    const network = await skaleContracts.getNetworkByProvider(ethers.provider);
    const project = network.getProject("schain-ima");
    return await project.getInstance(process.env.TARGET);
}
class ImaSchainUpgrader extends Upgrader {

    constructor(
        targetVersion: string,
        instance: Instance,
        contractNamesToUpgrade: string[],
        submitter?: Submitter) {
            super(
                {
                    contractNamesToUpgrade,
                    instance,
                    name: "proxySchain",
                    version: targetVersion,
                },
                submitter
            );
        }

    async getMessageProxyForSchain() {
        return await this.instance.getContract("MessageProxyForSchain") as MessageProxyForSchain;

    }

    getDeployedVersion = async () => {
        const messageProxyForSchain = await this.getMessageProxyForSchain();
        try {
            return await messageProxyForSchain.version();
        } catch {
            console.log(chalk.red("Can't read deployed version"));
        }
    }

    setVersion = async (newVersion: string) => {
        const messageProxyForSchain = await this.getMessageProxyForSchain();
        this.transactions.push(Transaction.from({
            to: await messageProxyForSchain.getAddress(),
            data: messageProxyForSchain.interface.encodeFunctionData("setVersion", [newVersion])
        }));
    }

    // deployNewContracts = () => { };

    // initialize = async () => { };

    _getContractKeyInAbiFile(contract: string) {
        if (contract === "MessageProxyForSchain") {
            return "message_proxy_chain";
        }
        return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
    }
}

async function updateAbi(contracts: string[]) {
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
    const newAbiFilename = `data/schain-ima-${version}-${network.name}.json`;
    await fs.writeFile(newAbiFilename, JSON.stringify(abi, null, 4));
    console.log(chalk.green(`ABI updated and saved to ${newAbiFilename}`));
}

async function main() {
    const pathToManifest: string = process.env.MANIFEST || "";
    await manifestSetup(pathToManifest);
    let contractNamesToUpgrade: string[] = [
    ]
    if (process.env.UPGRADE_ALL) {
        contractNamesToUpgrade = contracts;
    }
    const upgrader = new ImaSchainUpgrader(
        "2.2.0",
        await getImaSchainInstance(),
        contractNamesToUpgrade
    );
    await upgrader.upgrade();
    updateAbi(contracts);
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
