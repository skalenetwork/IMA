import chalk from "chalk";
import { ethers } from "hardhat";
import { promises as fs } from "fs";
import { Upgrader } from "@skalenetwork/upgrade-tools";
import { SkaleABIFile } from "@skalenetwork/upgrade-tools/dist/src/types/SkaleABIFile";
import { contracts, getContractKeyInAbiFile } from "./deploySchain";
import { manifestSetup } from "./generateManifest";
import { CommunityLocker } from "../typechain/CommunityLocker";
import { MessageProxyForSchain } from "../typechain";

class ImaSchainUpgrader extends Upgrader {

    async getMessageProxyForSchain() {
        return await ethers.getContractAt("MessageProxyForSchain", this.abi.message_proxy_chain_address as string) as MessageProxyForSchain;
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
        this.transactions.push({
            to: messageProxyForSchain.address,
            data: messageProxyForSchain.interface.encodeFunctionData("setVersion", [newVersion])
        });
    }

    initialize = async () => {
        const communityLockerName = "CommunityLocker";
        const communityLockerFactory = await ethers.getContractFactory(communityLockerName);
        const communityLockerAddress = this.abi[getContractKeyInAbiFile(communityLockerName) + "_address"] as string;
        let communityLocker;
        if (communityLockerAddress) {
            communityLocker = communityLockerFactory.attach(communityLockerAddress) as CommunityLocker;
            console.log(chalk.yellow("Prepare transaction to initialize timestamp"));
            this.transactions.push({
                to: communityLockerAddress,
                data: communityLocker.interface.encodeFunctionData("initializeTimestamp")
            });
        } else {
            console.log(chalk.red("CommunityLocker was not found!"));
            console.log(chalk.red("Check your abi!!!"));
            process.exit(1);
        }
    }

    _getContractKeyInAbiFile(contract: string) {
        if (contract === "MessageProxyForSchain") {
            return "message_proxy_chain";
        }
        return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
    }
}

async function getImaSchainAbiAndAddress(): Promise<SkaleABIFile> {
    if (!process.env.ABI) {
        console.log(chalk.red("Set path to file with ABI and addresses to ABI environment variables"));
        process.exit(1);
    }
    const abiFilename = process.env.ABI;
    return JSON.parse(await fs.readFile(abiFilename, "utf-8"));
}

async function main() {
    const pathToManifest: string = process.env.MANIFEST || "";
    await manifestSetup(pathToManifest);
    const upgrader = new ImaSchainUpgrader(
        "proxySchain",
        "1.4.0",
        await getImaSchainAbiAndAddress(),
        contracts
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
