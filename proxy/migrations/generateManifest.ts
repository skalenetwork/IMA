import { ethers } from "hardhat";
import { contracts, getContractKeyInAbiFile } from "./deploySchain";
import { networkNames } from "@openzeppelin/upgrades-core";
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
import { getVersion as version } from "@skalenetwork/upgrade-tools";
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
    return getVersion((await ethers.getContractFactory(contractName)).bytecode);
}

async function getImplementationDeployment(contractName: string, addresses: Addresses): Promise<ImplDeployment> {
    const implKey = await getImplKey(contractName);
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
    } catch (e) {
        if ( e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new ValidationsCacheNotFound();
        } else {
            throw e;
        }
    }
}

export async function generateManifest(addresses: Addresses) {
    const newManifest: ManifestData = emptyManifest();
    newManifest.admin = getDeployment(addresses.admin);
    for (const contract of contracts) {
        newManifest.proxies.push(getProxyDeployment(addresses[getContractKeyInAbiFile(contract)]));
        const implKey = (await getImplKey(contract)).withoutMetadata;
        newManifest.impls[implKey] = await getImplementationDeployment(contract, addresses);
    }
    const versionOfIMA = await version();
    await fs.writeFile(`data/ima-schain-${versionOfIMA}-manifest.json`, JSON.stringify(newManifest, null, 4));
    return newManifest;
}

export async function importAddresses(manifest: ManifestData, abi: {[ key in string ]: string | []}) {
    if (!manifest.admin) {
        throw Error("Proxy admin is missing in manifest file");
    }
    const addresses: Addresses = {};
    addresses.admin = manifest.admin.address;
    console.log("Admin address", manifest.admin.address, "imported");
    for (const contract of contracts) {
        const proxyAddress = abi[getContractKeyInAbiFile(contract) + "_address"];
        if (Array.isArray(proxyAddress)) {
            throw Error("ABI file format is wrong");
        }

        const proxyDeployment = manifest.proxies.find(proxy => proxy.address === proxyAddress);
        if (proxyDeployment) {
            addresses[getContractKeyInAbiFile(contract)] = proxyDeployment.address;
            console.log(contract, "proxy address", proxyDeployment.address, "imported");
        }

        const implementationDeployment = manifest.impls[(await getImplKey(contract)).withoutMetadata];
        if (implementationDeployment) {
            addresses[getContractKeyInAbiFile(contract) + "_implementation"] = implementationDeployment.address;
            console.log(contract, "implementation address", implementationDeployment.address, "imported");
        }
    }
    return addresses;
}

export async function manifestSetup(pathToManifest: string) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const manifestName = networkNames[chainId] ?? `unknown-${chainId}`;
    const correctManifestPath = `.openzeppelin/${manifestName}.json`;
    if (pathToManifest === "" || pathToManifest === correctManifestPath) {
        await fs.access(correctManifestPath);
        console.log("Current Manifest file detected - will use this one");
        return;
    }
    try {
        await fs.access(correctManifestPath);
        console.log("Current Manifest file detected - will remove it");
        try {
            await fs.unlink(correctManifestPath);
            console.log("Current Manifest file removed");
        } catch (e) {
            console.log("Could not remove current manifest file");
            process.exit(1);
        }
    } catch (e) {
        console.log("No current Manifest file detected");
    }
    try {
        await fs.access( pathToManifest );
        console.log("New Manifest file detected");
        try {
            await fs.copyFile( pathToManifest, correctManifestPath );
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
