import chalk from "chalk";
import { ethers } from "hardhat";
import { Transaction } from "ethers";
import { Submitter, Upgrader } from "@skalenetwork/upgrade-tools";
import { skaleContracts, Instance } from "@skalenetwork/skale-contracts-ethers-v6";
import { MessageProxyForMainnet } from "../typechain";
import { calculateGasSpent, contracts, isLocalNetwork } from "./deployMainnet";


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

    // initialize = async () => { };
}

async function main() {
    let contractNamesToUpgrade: string[] = [];
    const startBlock = await ethers.provider.getBlockNumber();
    if (process.env.UPGRADE_ALL) {
        contractNamesToUpgrade = contracts;
    }
    const upgrader = new ImaMainnetUpgrader(
        "2.3.0",
        await getImaMainnetInstance(),
        contractNamesToUpgrade
    );
    await upgrader.upgrade();

    if (await isLocalNetwork()) {
        const [owner] = await ethers.getSigners();
        console.log("Calculating gas used by deployer", owner.address);
        const endBlock = await ethers.provider.getBlockNumber();
        const gasUsed = await calculateGasSpent(startBlock, endBlock, owner.address);
        console.log(`Gas used by deployer: ${gasUsed}`);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
