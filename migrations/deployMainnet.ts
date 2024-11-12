// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file deployMainnet.ts
 * @copyright SKALE Labs 2019-Present
 */
import { promises as fs } from 'fs';
import { Interface } from 'ethers';
import { ethers, upgrades } from "hardhat";
import { MessageProxyForMainnet, Linker } from "../typechain";
import { getAbi, getContractFactory, verifyProxy, getVersion } from '@skalenetwork/upgrade-tools';
import { Manifest } from "@openzeppelin/upgrades-core";
import { SkaleABIFile } from "@skalenetwork/skale-contracts/lib/domain/types";

export function getContractKeyInAbiFile(contract: string) {
    return contract === "MessageProxyForMainnet"
        ? "message_proxy_mainnet"
        : contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
}

export async function getManifestFile(): Promise<string> {
    return (await Manifest.forNetwork(ethers.provider)).file;
}

async function getContractManager() {
    const defaultFilePath = "data/skaleManagerComponents.json";
    const jsonData = JSON.parse(await fs.readFile(defaultFilePath, "utf-8")) as SkaleABIFile;
    try {
        const { contract_manager_address, contract_manager_abi } = jsonData;
        return { address: contract_manager_address as unknown as string, abi: contract_manager_abi as [] };
    } catch (e) {
        console.error(e);
        process.exit(126);
    }
}

function isValidContractManager(contractManager: { address?: string, abi?: any[] }) {
    return contractManager?.address && contractManager?.abi;
}

async function setVersion(messageProxy: MessageProxyForMainnet, version: string) {
    try {
        console.log(`Set version ${version}`);
        await (await messageProxy.setVersion(version)).wait();
    } catch {
        console.error("Failed to set ima version on mainnet");
    }
}

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

async function deployContract(name: string, args: any[], initializer: string) {
    console.log("Deploy", name);
    const factory = await getContractFactory(name);
    const proxy = await upgrades.deployProxy(factory, args, { initializer });
    await proxy.waitForDeployment();
    const address = await proxy.getAddress();
    console.log("Proxy Contract", name, "deployed to", address);
    await verifyProxy(name, address, []);
    return proxy;
}

async function registerContracts(linker: Linker, messageProxy: MessageProxyForMainnet, addresses: string[]) {
    for (const address of addresses) {
        await (await linker.registerMainnetContract(address)).wait();
        await (await messageProxy.registerExtraContractForAll(address)).wait();
    }
}

async function registerInContractManager(contractManagerInst: any, deployed: Map<string, { address: string }>) {
    try {
        for (const contractName of contracts) {
            const contract = deployed.get(contractName);
            if (!contract) throw new Error(`${contractName} was not found`);
            await contractManagerInst.setContractsAddress(contractName, contract.address);
        }
        console.log("Successfully registered contracts in ContractManager");
    } catch (error) {
        console.error("Registration of contracts failed in ContractManager. Please redo it manually!\nError:", error);
    }
}

async function main() {
    const [owner] = await ethers.getSigners();
    const deployed = new Map<string, { address: string; interface: Interface }>();
    const contractManager = await getContractManager();
    const version = await getVersion();

    const messageProxyForMainnet = await deployContract(
        "MessageProxyForMainnet",
        [contractManager?.address],
        'initialize(address)'
    ) as unknown as MessageProxyForMainnet;
    deployed.set("MessageProxyForMainnet", {
        address: await messageProxyForMainnet.getAddress(),
        interface: messageProxyForMainnet.interface
    });

    const extraContractRegistrarRole = await messageProxyForMainnet.EXTRA_CONTRACT_REGISTRAR_ROLE();
    await (await messageProxyForMainnet.grantRole(extraContractRegistrarRole, owner.address)).wait();

    await setVersion(messageProxyForMainnet, version);

    const linker = await deployContract(
        "Linker",
        [contractManager?.address, deployed.get("MessageProxyForMainnet")?.address],
        'initialize(address,address)'
    ) as unknown as Linker;
    deployed.set("Linker", {
        address: await linker.getAddress(),
        interface: linker.interface
    });

    await registerContracts(linker, messageProxyForMainnet, [await linker.getAddress()]);
    const chainConnectorRole = await messageProxyForMainnet.CHAIN_CONNECTOR_ROLE();
    await (await messageProxyForMainnet.grantRole(chainConnectorRole, await linker.getAddress())).wait();

    const communityPool = await deployContract(
        "CommunityPool",
        [contractManager?.address, deployed.get("Linker")?.address, deployed.get("MessageProxyForMainnet")?.address],
        'initialize(address,address,address)'
    );
    const communityPoolAddress = await communityPool.getAddress();
    deployed.set("CommunityPool", {
        address: communityPoolAddress,
        interface: communityPool.interface
    });
    await registerContracts(linker, messageProxyForMainnet, [communityPoolAddress]);
    await (await messageProxyForMainnet.setCommunityPool(communityPoolAddress)).wait();

    for (const contract of depositBoxes) {
        const proxy = await deployContract(
            contract,
            [contractManager?.address, deployed.get("Linker")?.address, deployed.get("MessageProxyForMainnet")?.address],
            'initialize(address,address,address)'
        );
        const proxyAddress = await proxy.getAddress();
        deployed.set(contract, {
            address: proxyAddress,
            interface: proxy.interface
        });
        await registerContracts(linker, messageProxyForMainnet, [proxyAddress]);
    }

    if (isValidContractManager(contractManager) && await ethers.provider.getCode(contractManager.address) !== "0x") {
        const contractManagerInst = new ethers.Contract(contractManager.address, contractManager.abi, owner);
        if (await contractManagerInst.owner() === owner.address) {
            await registerInContractManager(contractManagerInst, deployed);
        } else {
            console.error("Owner of ContractManager is not the same as the deployer");
        }
    } else {
        console.error("Invalid ContractManager address or ABI");
    }
    console.log("Registration is completed!");

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

    await fs.writeFile("data/proxyMainnet.json", JSON.stringify(outputObject, null, 4));

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
