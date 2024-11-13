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
import chalk from "chalk";
import { promises as fs } from 'fs';
import { Interface } from 'ethers';
import { ethers, upgrades } from "hardhat";
import { MessageProxyForMainnet, Linker, ContractManager, CommunityPool } from "../typechain";
import { getAbi, getContractFactory, verifyProxy, getVersion } from '@skalenetwork/upgrade-tools';
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

async function getContractManager() {
    const skaleManager = await getSkaleManagerInstance();
    return (await skaleManager.getContract("ContractManager")) as ContractManager;
}
async function getLinker(): Promise<Linker> {
    const contractManager = await getContractManager();
    return (await contractManager.getContract("Linker")) as unknown as Linker;
}

async function getMessageProxyForMainnet(): Promise<MessageProxyForMainnet> {
    const contractManager = await getContractManager();
    return (await contractManager.getContract("MessageProxyForMainnet")) as unknown as MessageProxyForMainnet;
}

async function getSkaleManagerInstance() {
    if (!process.env.TARGET) {
        console.log(chalk.red("Specify desired skale-manager instance"));
        console.log(chalk.red("Set instance alias or SkaleManager address to TARGET environment variable"));
        process.exit(1);
    }
    const network = await skaleContracts.getNetworkByProvider(ethers.provider);
    const project = network.getProject("skale-manager");
    return await project.getInstance(process.env.TARGET);
}

async function setVersion(messageProxy: MessageProxyForMainnet, version: string) {
    try {
        console.log(`Set version ${version}`);
        await (await messageProxy.setVersion(version)).wait();
    } catch {
        console.error("Failed to set ima version on mainnet");
    }
}

async function deployContract(name: string, args: unknown[], initializer: string) { 
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

async function deployMessageProxyForMainnet(
    deployed: Map<
        string,
        {
            address: string;
            interface: Interface;
        }
    >
): Promise<MessageProxyForMainnet> {
    const [owner] = await ethers.getSigners();
    const contractManager = await getContractManager();
    const contractManagerAddress = await contractManager.getAddress();
    const messageProxyForMainnet = await deployContract(
        "MessageProxyForMainnet",
        [contractManagerAddress],
        'initialize(address)'
    ) as unknown as MessageProxyForMainnet;
    const messageProxyForMainetAddress = await messageProxyForMainnet.getAddress();
    await contractManager.setContractsAddress("MessageProxyForMainnet", messageProxyForMainetAddress);
    await messageProxyForMainnet.grantRole(await messageProxyForMainnet.EXTRA_CONTRACT_REGISTRAR_ROLE(), owner.address);
    deployed.set("MessageProxyForMainnet", {
        address: messageProxyForMainetAddress,
        interface: messageProxyForMainnet.interface
    });
    return messageProxyForMainnet;
}

async function deployLinker(
    deployed: Map<
        string,
        {
            address: string;
            interface: Interface;
        }
    >
): Promise<Linker> {
    const contractManager = await getContractManager();
    const messageProxyForMainnet = await getMessageProxyForMainnet();
    const linker = await deployContract(
        "Linker",
        [
            await contractManager.getAddress(),
            await messageProxyForMainnet.getAddress(),
        ],
        'initialize(address,address)'
    ) as unknown as Linker;
    const linkerAddress = await linker.getAddress();
    await contractManager.setContractsAddress("Linker", linkerAddress);
    await messageProxyForMainnet.grantRole(await messageProxyForMainnet.CHAIN_CONNECTOR_ROLE(), linkerAddress);
    await registerContracts(linker, messageProxyForMainnet, [linkerAddress]);

    deployed.set("Linker", {
        address: linkerAddress,
        interface: linker.interface
    });
    return linker;
}

async function deployCommunityPool(
    deployed: Map<
        string,
        {
            address: string;
            interface: Interface;
        }
    >
): Promise<CommunityPool> {
    const contractManager = await getContractManager();
    const messageProxyForMainnet = await getMessageProxyForMainnet();
    const linker = await getLinker();
    const communityPool = await deployContract(
        "CommunityPool",
        [
            await contractManager.getAddress(),
            await messageProxyForMainnet.getAddress(),
            await linker.getAddress()
        ],
        'initialize(address,address,address)'
    ) as unknown as CommunityPool;
    const communityPoolAddress = await communityPool.getAddress();
    await contractManager.setContractsAddress("CommunityPool", communityPoolAddress);
    await messageProxyForMainnet.setCommunityPool(communityPoolAddress);
    await registerContracts(linker, messageProxyForMainnet, [communityPoolAddress]);

    deployed.set("CommunityPool", {
        address: communityPoolAddress,
        interface: communityPool.interface
    });
    return communityPool;
}

async function deployDepositBoxes(
    deployed: Map<
        string,
        {
            address: string;
            interface: Interface;
        }
    >
) {
    const contractManager = await getContractManager();
    const linker = await getLinker();
    const messageProxyForMainnet = await getMessageProxyForMainnet();
    for (const contract of depositBoxes) {
        const proxy = await deployContract(
            contract,
            [
                await contractManager.getAddress(),
                await linker.getAddress(),
                await messageProxyForMainnet.getAddress()
            ],
            'initialize(address,address,address)'
        );
        const proxyAddress = await proxy.getAddress();
        await registerContracts(linker, messageProxyForMainnet, [proxyAddress]);
        await contractManager.setContractsAddress(contract, proxyAddress);
        deployed.set(contract, {
            address: proxyAddress,
            interface: proxy.interface
        });
    }
}

async function main() {
    const deployed = new Map<string, { address: string; interface: Interface }>();
    const version = await getVersion();

    const messageProxyForMainnet =  await deployMessageProxyForMainnet(deployed);
    await setVersion(messageProxyForMainnet, version);

    await deployLinker(deployed);
    await deployCommunityPool(deployed);
    await deployDepositBoxes(deployed);

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
