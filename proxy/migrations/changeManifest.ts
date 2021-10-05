import { ethers, network, upgrades, artifacts } from "hardhat";
import { contractsToDeploy, getContractKeyInAbiFile } from "./deploySchain";
import { promises as fs } from "fs";
// import hre from "hardhat";
// import { promises as fs } from "fs";
import { getImplementationAddress, hashBytecode, getVersion } from "@openzeppelin/upgrades-core";
// import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
// import chalk from "chalk";
import { getImplKey } from "./generateManifest";

const predeployedAddresses: any = {
    "admin": "0xd2aAa00000000000000000000000000000000000",
    "message_proxy_chain": "0xd2AAa00100000000000000000000000000000000",
    "message_proxy_chain_implementation": "0xD2AAa001D2000000000000000000000000000000",
    "key_storage": "0xd2aaa00200000000000000000000000000000000",
    "key_storage_implementation": "0xD2AAa002d2000000000000000000000000000000",
    "community_locker": "0xD2aaa00300000000000000000000000000000000",
    "comminity_locker_implementation": "0xD2aaA003d2000000000000000000000000000000",
    "token_manager_eth": "0xd2AaA00400000000000000000000000000000000",
    "token_manager_eth_implementation": "0xd2AaA004d2000000000000000000000000000000",
    "token_manager_erc20": "0xD2aAA00500000000000000000000000000000000",
    "token_manager_erc20_implementation": "0xd2aAa005d2000000000000000000000000000000",
    "token_manager_erc721": "0xD2aaa00600000000000000000000000000000000",
    "token_manager_erc721_implementation": "0xd2AAa006d2000000000000000000000000000000",
    "eth_erc20": "0xD2Aaa00700000000000000000000000000000000",
    "eth_erc20_implementation": "0xD2aaA007d2000000000000000000000000000000",
    "token_manager_linker": "0xD2aAA00800000000000000000000000000000000",
    "token_manager_linker_implementation": "0xd2aAA008D2000000000000000000000000000000",
    "token_manager_erc1155": "0xD2aaA00900000000000000000000000000000000",
    "token_manager_erc1155_implementation": "0xD2AaA009d2000000000000000000000000000000"
}

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
    for (const contract in contractsToDeploy) {
        const proxyAddress = abi[getContractKeyInAbiFile(contract) + "_address"];
        const proxyData = manifest["proxies"];
        const index = findProxyContract(proxyData, proxyAddress);
        if (index < proxyData.length) {
            manifest["proxies"][index].address = predeployedAddresses[getContractKeyInAbiFile(contract)];
        }
    }
    return manifest;
}

export async function change() {

    if (!process.env.ABI) {
        console.log(chalk.red("Set path to file with ABI and addresses to ABI environment variables"));
        return;
    }

    if (!process.env.MANIFEST) {
        console.log(chalk.red("Set path to file with ABI and addresses to ABI environment variables"));
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
    // TODO

}