import chalk from "chalk";
import { ethers } from "hardhat";
import { promises as fs } from "fs";
import { Upgrader } from "@skalenetwork/upgrade-tools";
import { SkaleABIFile } from "@skalenetwork/upgrade-tools/dist/src/types/SkaleABIFile";
import { contracts } from "./deployMainnet";
import { manifestSetup } from "./generateManifest";
import { MessageProxyForMainnet } from "../typechain";

class ImaMainnetUpgrader extends Upgrader {

    async getMessageProxyForMainnet() {
        return await ethers.getContractAt("MessageProxyForMainnet", this.abi.message_proxy_mainnet_address as string) as MessageProxyForMainnet;
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
        this.transactions.push({
            to: messageProxyForMainnet.address,
            data: messageProxyForMainnet.interface.encodeFunctionData("setVersion", [newVersion])
        });
    }

    _getContractKeyInAbiFile(contract: string) {
        if (contract === "MessageProxyForMainnet") {
            return "message_proxy_mainnet";
        }
        return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
    }
}

async function getImaMainnetAbiAndAddress(): Promise<SkaleABIFile> {
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
    const upgrader = new ImaMainnetUpgrader(
        "proxyMainnet",
        "1.4.0",
        await getImaMainnetAbiAndAddress(),
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
