import { ethers } from "hardhat";
import { contractsToDeploy, getContractKeyInAbiFile } from "./deploySchain";
import { promises as fs } from "fs";
import { constants } from 'fs';
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
import { getVersion as version } from "./tools/version";
import { ValidationsCacheNotFound, ValidationsCacheOutdated } from "@openzeppelin/hardhat-upgrades/dist/utils";

type Addresses = {
    [n: string]: string;
};

export const predeployedAddresses: Addresses = {
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

async function getImplementationDeployment(contractName: string, addresses: Addresses): Promise<ImplDeployment> {
    const implKey: any = await getImplKey(contractName);
    const validationData = await readValidations();
    const layout: StorageLayout = getStorageLayout(validationData, implKey);
    return {
        address: addresses[getContractKeyInAbiFile(contractName) + "_implementation"],
        layout
    }
}

function emptyManifest(): ManifestData {
    return {
        "manifestVersion": "3.2",
        "proxies": [],
        "impls": {}
    }
}

function getProxyDeployment(address: string): ProxyDeployment {
    return {
        address,
        kind: "transparent"
    }
}

function getDeployment(address: string): Deployment {
    return {
        address
    }
}

async function readValidations() {
    try {
        const data = JSON.parse(await fs.readFile("./cache/validations.json", "utf-8"));
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

export async function generateManifest(addresses: Addresses) {
    const newManifest: ManifestData = emptyManifest();
    newManifest.admin = getDeployment(addresses.admin);
    for (const contract of contractsToDeploy) {
        newManifest.proxies.push(getProxyDeployment(addresses[getContractKeyInAbiFile(contract)]));
        const implKey = await getImplKey(contract);
        newManifest.impls[implKey] = await getImplementationDeployment(contract, addresses);
    }
    const vesrionOfIMA = await version();
    await fs.writeFile(`data/ima-schain-${vesrionOfIMA}-manifest.json`, JSON.stringify(newManifest, null, 4));
    return newManifest;
}

function findProxyContract(data: any, address: string) {
    for (let i = 0; i < data.length; i++) {
        if (data[i].address === address) {
            return i;
        }
    }
    return data.length;
}

export async function importAddresses(manifest: any, abi: any) {
    const addresses: Addresses = {};
    addresses.admin = manifest.admin.address;
    console.log("Admin address", manifest.admin.address, "imported");
    for (const contract of contractsToDeploy) {
        const proxyAddress = abi[getContractKeyInAbiFile(contract) + "_address"];
        const proxyData = manifest.proxies;
        const index = findProxyContract(proxyData, proxyAddress);
        if (index < proxyData.length) {
            addresses[getContractKeyInAbiFile(contract)] = manifest.proxies[index].address;
        }
        console.log(contract, "proxy address", manifest.proxies[index].address, "imported");
        const implKey = await getImplKey(contract);
        addresses[getContractKeyInAbiFile(contract) + "_implementation"] = manifest.impls[implKey].address;
        console.log(contract, "implementation address", manifest.impls[implKey].address, "imported");
    }
    return addresses;
}

export async function manifestSetup(pathToManifest: string) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    if (pathToManifest === "" || pathToManifest === `.openzeppelin/unknown-${chainId}.json`) {
        fs.access(`.openzeppelin/unknown-${chainId}.json`, constants.R_OK | constants.W_OK);
        console.log("Current Manifest file detected");
        return;
    }
    try {
        fs.access(`.openzeppelin/unknown-${chainId}.json`, constants.R_OK | constants.W_OK);
        console.log("Current Manifest file detected");
        try {
            await fs.unlink(`.openzeppelin/unknown-${chainId}.json`);
            console.log("Current Manifest file removed");
        } catch (e) {
            console.log("Could not remove current manifest file");
            process.exit(1);
        }
    } catch (e) {
        console.log("No current Manifest file detected");
    }
    try {
        fs.access( pathToManifest, constants.R_OK | constants.W_OK );
        console.log("New Manifest file detected");
        try {
            await fs.copyFile( pathToManifest, `.openzeppelin/unknown-${chainId}.json` );
            console.log("New Manifest file setup");
        } catch (e) {
            console.log("Could not setup new Manifest file");
            process.exit(1);
        }
    } catch (e) {
        console.log("No new Manifest file detected");
        process.exit(1);
    }
}

if (require.main === module) {
    generateManifest(predeployedAddresses)
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
