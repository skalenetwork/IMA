import { ethers, network, upgrades, artifacts } from "hardhat";
import { contracts, contractsToDeploy, getContractKeyInAbiFile } from "./deploySchain";
// import hre from "hardhat";
// import { promises as fs } from "fs";
import { getImplementationAddress, hashBytecode, getVersion, getStorageLayout } from "@openzeppelin/upgrades-core";
// import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
// import chalk from "chalk";

const validationData: any = {
    version: "3.2",
    log: ""
}

const manifestTemplate = {
    "manifestVersion": "3.2",
    "admin": {},
    "proxies": {},
    "impls": {}
}

export const predeployedAddresses: any = {
    "admin": "0xd2aAa00000000000000000000000000000000000",
    "message_proxy_chain": "0xd2AAa00100000000000000000000000000000000",
    "message_proxy_chain_implementation": "0xD2AAa001D2000000000000000000000000000000",
    "key_storage": "0xd2aaa00200000000000000000000000000000000",
    "key_storage_implementation": "0xD2AAa002d2000000000000000000000000000000",
    "community_locker": "0xD2aaa00300000000000000000000000000000000",
    "community_locker_implementation": "0xD2aaA003d2000000000000000000000000000000",
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

export async function getImplKey(contractName: string) {
    return getVersion((await ethers.getContractFactory(contractName)).bytecode).withoutMetadata;
}

export async function getLayout(contractName: string) {
    const implKey: any = await getImplKey(contractName);
    return getStorageLayout(validationData, implKey);
}

export async function generateManifest() {
    const newManifest = manifestTemplate;
    newManifest["admin"] = {
        "address": predeployedAddresses["admin"]
    }
    // for (const contract of contractsToDeploy) {
    //     newManifest["proxies"] = 
    // }
}
