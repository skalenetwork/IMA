import { ethers, network, upgrades, artifacts } from "hardhat";
import { contracts, contractsToDeploy, getContractKeyInAbiFile } from "./deploySchain";
// import hre from "hardhat";
import { promises as fs } from "fs";
import { 
    getVersion,
    getStorageLayout,
    ManifestData,
    ProxyDeployment,
    Deployment,
    ImplDeployment,
    StorageLayout,
    isCurrentValidationData
} from "@openzeppelin/upgrades-core";
import { ValidationsCacheNotFound, ValidationsCacheOutdated } from "@openzeppelin/hardhat-upgrades/dist/utils";
// import { any } from "hardhat/internal/core/params/argumentTypes";
// import { string } from "hardhat/internal/core/params/argumentTypes";
// import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
// import chalk from "chalk";


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

async function getImplementationDeployment(contractName: string, addresses: any): Promise<ImplDeployment> {
    const implKey: any = await getImplKey(contractName);
    const validationData = await readValidations();
    const layout: StorageLayout = getStorageLayout(validationData, implKey);
    return {
        address: addresses[getContractKeyInAbiFile(contractName) + "_implementation"],
        layout: layout
    }
}

function defaultManifest(): ManifestData {
    return {
        "manifestVersion": "3.2",
        "proxies": [],
        "impls": {}
    }
}

function getProxyDeployment(address: string): ProxyDeployment {
    return {
        address: address,
        kind: "transparent"
    }
}

function getDeployment(address: string): Deployment {
    return {
        address: address
    }
}

async function readValidations() {
    try {
        const data = require("../cache/validations.json");
        if (!isCurrentValidationData(data)) {
            throw new ValidationsCacheOutdated();
        }
        return data;
    } catch (e: any) {
        if (e.code === 'ENOENT') {
            throw new ValidationsCacheNotFound();
        } else {
            throw e;
        }
    }
}

export async function generateManifest(addresses: any) {
    const newManifest: ManifestData = defaultManifest();
    newManifest["admin"] = getDeployment(addresses["admin"]);
    for (const contract of contractsToDeploy) {
        newManifest["proxies"].push(getProxyDeployment(addresses[getContractKeyInAbiFile(contract)]));
        const implKey = await getImplKey(contract);
        newManifest["impls"][implKey] = await getImplementationDeployment(contract, addresses);
    }
    await fs.writeFile("data/manifest.json", JSON.stringify(newManifest, null, 4));
    return newManifest;
}

if (require.main === module) {
    generateManifest(predeployedAddresses)
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
