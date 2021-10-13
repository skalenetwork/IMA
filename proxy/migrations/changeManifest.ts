// import { ethers, network, upgrades, artifacts } from "hardhat";
import { contracts, contractsToDeploy, getContractKeyInAbiFile } from "./deploySchain";
import { promises as fs } from "fs";
// import hre from "hardhat";
// import { promises as fs } from "fs";
// import { getImplementationAddress, hashBytecode, getVersion } from "@openzeppelin/upgrades-core";
// import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import chalk from "chalk";
import { getImplKey, predeployedAddresses } from "./generateManifest";

function changeAdmin(manifest: any) {
    manifest["admin"].address = predeployedAddresses["admin"];
    return manifest;
}

function findProxyContract(data: any, address: string) {
    for (let i = 0; i < data.length; i++) {
        if (data[i].address === address) {
            return i;
        }
    }
    return data.length;
}

function changeProxies(manifest: any, abi: any) {
    for (const contract of contractsToDeploy) {
        const proxyAddress = abi[getContractKeyInAbiFile(contract) + "_address"];
        const proxyData = manifest["proxies"];
        const index = findProxyContract(proxyData, proxyAddress);
        if (index < proxyData.length) {
            manifest["proxies"][index].address = predeployedAddresses[getContractKeyInAbiFile(contract)];
        }
    }
    return manifest;
}

async function changeImplementations(manifest: any) {
    for (const contract of contractsToDeploy) {
        const implKey = await getImplKey(contract);
        manifest["impls"][implKey].address = predeployedAddresses[getContractKeyInAbiFile(contract) + "_implementation"];
    }
    return manifest;
}

export async function change() {

    if (!process.env.ABI) {
        console.log(chalk.red("Set path to file with ABI and addresses to ABI environment variables"));
        return;
    }

    if (!process.env.MANIFEST) {
        console.log(chalk.red("Set path to file with Manifest to MANIFEST environment variables"));
        return;
    }

    const abiFilename = process.env.ABI;
    const manifestFilename = process.env.MANIFEST;
    const currentAbi = JSON.parse(await fs.readFile(abiFilename, "utf-8"));
    let currentManifest = JSON.parse(await fs.readFile(manifestFilename, "utf-8"));
    // change admin address
    currentManifest = changeAdmin(currentManifest);

    // change proxy addresses
    currentManifest = changeProxies(currentManifest, currentAbi);

    // change implementation addresses
    currentManifest = await changeImplementations(currentManifest);

    await fs.writeFile("data/manifest.json", JSON.stringify(currentManifest, null, 4));
    return currentManifest;
}

if (require.main === module) {
    change()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
