import chalk from "chalk";
import { ethers } from "hardhat";
import { promises as fs } from "fs";
import { AutoSubmitter, Upgrader } from "@skalenetwork/upgrade-tools";
import { SkaleABIFile } from "@skalenetwork/upgrade-tools/dist/src/types/SkaleABIFile";
import { contracts } from "./deploySchain";
import { manifestSetup } from "./generateManifest";
import { MessageProxyForSchain } from "../typechain";

class ImaSchainUpgrader extends Upgrader {

    constructor(
        targetVersion: string,
        abi: SkaleABIFile,
        contractNamesToUpgrade: string[],
        submitter = new AutoSubmitter()) {
            super(
                "proxySchain",
                targetVersion,
                abi,
                contractNamesToUpgrade,
                submitter);
        }

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

    // deployNewContracts = () => { };

    // initialize = async () => { };

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
        "1.5.0",
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
