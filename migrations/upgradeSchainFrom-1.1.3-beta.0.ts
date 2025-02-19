import chalk from "chalk";
import { ethers } from "hardhat";
import { promises as fs } from "fs";
import { Transaction } from "ethers";
import { Submitter, Upgrader } from "@skalenetwork/upgrade-tools";
import { skaleContracts, Instance } from "@skalenetwork/skale-contracts-ethers-v6";
import { contracts, getContractKeyInAbiFile } from "./deploySchain";
import { manifestSetup } from "./generateManifest";
import { MessageProxyForSchain, CommunityLocker } from "../typechain";
import { ContractAddressMap } from "@skalenetwork/skale-contracts/lib/domain/types";


async function getImaSchainInstance() {
    if (!process.env.TARGET) {
        console.log(chalk.red("Specify desired schain-ima instance"));
        console.log(chalk.red("Set instance alias or MessageProxyForSchain address to TARGET environment variable"));
        process.exit(1);
    }
    const network = await skaleContracts.getNetworkByProvider(ethers.provider);
    const project = network.getProject("schain-ima");
    const contractAddresses: ContractAddressMap = {};
    if (process.env.TEST_UPGRADE) {
        if (!process.env.TEST_ABI) {
            console.log(chalk.red("Set path to file with ABI and addresses to ABI environment variables"));
            process.exit(1);
        }
        const abi = JSON.parse(await fs.readFile(process.env.TEST_ABI, "utf-8"));
        for (const contract of contracts) {
            contractAddresses[contract] = abi[getContractKeyInAbiFile(contract) + "_address"];
        }
        return await project.getInstance(contractAddresses);
    }
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

    initialize = async () => {
        const imaInstance = await getImaSchainInstance();
        const communityLocker = await imaInstance.getContract("CommunityLocker") as unknown as CommunityLocker;
        const communityLockerFactory = await ethers.getContractFactory("CommunityLocker");
        console.log(chalk.yellow("Prepare transaction to initialize timestamp"));
        this.transactions.push(Transaction.from(
            {
                to: await communityLocker.getAddress(),
                data: communityLockerFactory.interface.encodeFunctionData("initializeTimestamp")
            }
        ))

    };

    // _getContractKeyInAbiFile(contract: string) {
    //     if (contract === "MessageProxyForSchain") {
    //         return "message_proxy_chain";
    //     }
    //     return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
    // }
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
        "1.1.3-beta.0",
        await getImaSchainInstance(),
        contractNamesToUpgrade
    );
    await upgrader.upgrade();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
