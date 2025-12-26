import { promises as fs } from 'fs';
import { Interface } from 'ethers';
import { ethers } from "hardhat";
import { getAbi } from '@skalenetwork/upgrade-tools';
import { Manifest } from "@openzeppelin/upgrades-core";
import { skaleContracts } from "@skalenetwork/skale-contracts-ethers-v6";


export const depositBoxes = [
    "DepositBoxEth",
    "DepositBoxERC20",
    "DepositBoxERC721",
    "DepositBoxERC1155",
    "DepositBoxERC721WithMetadata"
];

export const contracts = [
    "MessageProxyForMainnet",
    "Linker",
    "CommunityPool",
    ...depositBoxes
];

export function getContractKeyInAbiFile(contract: string) {
    return contract === "MessageProxyForMainnet"
        ? "message_proxy_mainnet"
        : contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
}

export async function getManifestFile(): Promise<string> {
    return (await Manifest.forNetwork(ethers.provider)).file;
}





async function main() {
    const deployed = new Map<string, { address: string; interface: Interface }>();
    const mainnetProject = await (await skaleContracts.getNetworkByProvider(ethers.provider)).getProject("mainnet-ima").getInstance(process.env.TARGET || "mistake");

    const mainnetProxyAddress = await mainnetProject.getContractAddress("MessageProxyForMainnet");
    const proxyInterface = (await ethers.getContractFactory("MessageProxyForMainnet")).interface;
    deployed.set("MessageProxyForMainnet", { address: mainnetProxyAddress, interface: proxyInterface });

    const linkerAddress = await mainnetProject.getContractAddress("Linker");
    const linkerInterface = (await ethers.getContractFactory("Linker")).interface;
    deployed.set("Linker", { address: linkerAddress, interface: linkerInterface });

    const communityPoolAddress = await mainnetProject.getContractAddress("CommunityPool");
    const communityPoolInterface = (await ethers.getContractFactory("CommunityPool")).interface;
    deployed.set("CommunityPool", { address: communityPoolAddress, interface: communityPoolInterface });
    type DepositBox = "DepositBoxEth" | "DepositBoxERC20" | "DepositBoxERC721" | "DepositBoxERC1155" | "DepositBoxERC721WithMetadata"
    for (const box of depositBoxes) {
        const boxAddress = await mainnetProject.getContractAddress(box as DepositBox);
        const boxInterface = (await ethers.getContractFactory(box)).interface;
        deployed.set(box, { address: boxAddress, interface: boxInterface });
    }

    console.log("Store ABIs");
    const outputObject: { [k: string]: string | [] } = {};
    for (const contract of contracts) {
        const contractKey = getContractKeyInAbiFile(contract);
        const deployedContract = deployed.get(contract);
        if (!deployedContract) {
            throw new Error(`Contract ${contract} was not found`);
        }
        outputObject[`${contractKey}_address`] = deployedContract.address;
        outputObject[`${contractKey}_abi`] = getAbi(deployedContract.interface);
    }

    await fs.writeFile("data/proxyMainnet_new.json", JSON.stringify(outputObject, null, 4));

    console.log("Done");
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
