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
import { AddressLike, Interface } from 'ethers';
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
    const contractManager = (await skaleManager.getContract("ContractManager")) as unknown as ContractManager;
    return contractManager;
}

async function getLinker(): Promise<Linker> {
    const contractManager = await getContractManager();
    const Linker = await ethers.getContractFactory("Linker");
    const linkerAddress = await contractManager.getContract("Linker");
    return Linker.attach(linkerAddress) as Linker;
}

async function getMessageProxyForMainnet(): Promise<MessageProxyForMainnet> {
    const contractManager = await getContractManager();
    const MessageProxyForMainnet = await ethers.getContractFactory("MessageProxyForMainnet");
    const messageProxyForMainnetAddress = await contractManager.getContract("MessageProxyForMainnet");
    return MessageProxyForMainnet.attach(messageProxyForMainnetAddress) as MessageProxyForMainnet;
}

async function getSkaleManagerInstance() {
    if (!process.env.SKALE_MANAGER_ADDRESS) {
        console.log(chalk.red("Specify desired skale-manager instance"));
        console.log(chalk.red("Set instance alias or SkaleManager address to SKALE_MANAGER_ADDRESS environment variable"));
        process.exit(1);
    }
    const network = await skaleContracts.getNetworkByProvider(ethers.provider);
    const project = network.getProject("skale-manager");
    return await project.getInstance(process.env.SKALE_MANAGER_ADDRESS);
}

async function setVersion(messageProxy: MessageProxyForMainnet, version: string) {
    try {
        console.log(`Set version ${version}`);
        await (await messageProxy.setVersion(version)).wait();
    } catch {
        console.error("Failed to set ima version on mainnet");
    }
}

async function deployContract(name: string, args: string[], initializer: string) {
    console.log("Deploy", name);
    const factory = await getContractFactory(name);
    const proxy = await upgrades.deployProxy(factory, args, { initializer });
    await proxy.waitForDeployment();
    const address = await proxy.getAddress();
    console.log("Proxy Contract", name, "deployed to", address);
    await verifyProxy(name, address, []);
    return proxy;
}

async function registerContracts(linker: Linker, messageProxy: MessageProxyForMainnet, proxies: AddressLike[]) {
    for (const proxy of proxies) {
        await (await linker.registerMainnetContract(proxy)).wait();
        await (await messageProxy.registerExtraContractForAll(proxy)).wait();
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
    const messageProxyForMainnet = await deployContract(
        "MessageProxyForMainnet",
        [await contractManager.getAddress()],
        'initialize(address)'
    ) as unknown as MessageProxyForMainnet;
    await contractManager.connect(owner).setContractsAddress("MessageProxyForMainnet", messageProxyForMainnet);
    await messageProxyForMainnet.grantRole(await messageProxyForMainnet.EXTRA_CONTRACT_REGISTRAR_ROLE(), owner.address);
    deployed.set("MessageProxyForMainnet", {
        address: await messageProxyForMainnet.getAddress(),
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
    const [owner] = await ethers.getSigners();
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
    await contractManager.connect(owner).setContractsAddress("Linker", linker);
    await messageProxyForMainnet.grantRole(await messageProxyForMainnet.CHAIN_CONNECTOR_ROLE(), linker);
    await registerContracts(linker, messageProxyForMainnet, [linker]);

    deployed.set("Linker", {
        address: await linker.getAddress(),
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
    const [owner] = await ethers.getSigners();
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
    await contractManager.connect(owner).setContractsAddress("CommunityPool", communityPool);
    await messageProxyForMainnet.setCommunityPool(communityPool);
    await registerContracts(linker, messageProxyForMainnet, [communityPool]);

    deployed.set("CommunityPool", {
        address: await communityPool.getAddress(),
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
    const [owner] = await ethers.getSigners();
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
        await registerContracts(linker, messageProxyForMainnet, [proxy]);
        await contractManager.connect(owner).setContractsAddress(contract, proxy);
        deployed.set(contract, {
            address: await proxy.getAddress(),
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
