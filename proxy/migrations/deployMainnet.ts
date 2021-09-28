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
 * @file 1_migration_to_mainnet.js
 * @copyright SKALE Labs 2019-Present
 */
import { promises as fs } from 'fs';
import { Interface } from "ethers/lib/utils";
import { ethers, upgrades, artifacts, web3 } from "hardhat";
import { MessageProxyForMainnet, Linker } from "../typechain";
import { deployLibraries, getLinkedContractFactory } from "./tools/factory";
import { getAbi } from './tools/abi';
import { verify, verifyProxy } from './tools/verification';
import { Manifest, hashBytecode } from "@openzeppelin/upgrades-core";

export function getContractKeyInAbiFile(contract: string) {
    if (contract === "MessageProxyForMainnet") {
        return "message_proxy_mainnet";
    }
    return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
}

export async function getManifestFile(): Promise<string> {
    return (await Manifest.forNetwork(ethers.provider)).file;;
}

export async function getContractFactory(contract: string) {
    const { linkReferences } = await artifacts.readArtifact(contract);
    if (!Object.keys(linkReferences).length)
        return await ethers.getContractFactory(contract);

    const libraryNames = [];
    for (const key of Object.keys(linkReferences)) {
        const libraryName = Object.keys(linkReferences[key])[0];
        libraryNames.push(libraryName);
    }

    const libraries = await deployLibraries(libraryNames);
    const libraryArtifacts: {[key: string]: any} = {};
    for (const libraryName of Object.keys(libraries)) {
        const { bytecode } = await artifacts.readArtifact(libraryName);
        libraryArtifacts[libraryName] = {"address": libraries[libraryName], "bytecodeHash": hashBytecode(bytecode)};
    }
    let manifest: any;
    try {
        manifest = JSON.parse(await fs.readFile(await getManifestFile(), "utf-8"));
        Object.assign(libraryArtifacts, manifest.libraries);
    } finally {
        Object.assign(manifest, {libraries: libraryArtifacts});
        await fs.writeFile(await getManifestFile(), JSON.stringify(manifest, null, 4));
    }
    return await getLinkedContractFactory(contract, libraries);
}


function getContractManager() {
    const defaultFilePath = "../data/skaleManagerComponents.json";
    const jsonData = require(defaultFilePath);
    try {
        const contractManagerAddress = jsonData.contract_manager_address;
        const contractManagerABI = jsonData.contract_manager_abi;
        return { address: contractManagerAddress, abi: contractManagerABI };
    } catch (e) {
        console.log(e);
        process.exit( 126 );
    }
}

export const contractsToDeploy = [
    "DepositBoxEth",
    "DepositBoxERC20",
    "DepositBoxERC721",
    "DepositBoxERC1155"
]

export const contracts = [
    "MessageProxyForMainnet",
    "Linker",
    "CommunityPool",
    "DepositBoxEth",
    "DepositBoxERC20",
    "DepositBoxERC721",
    "DepositBoxERC1155"
]

async function main() {
    const [ owner,] = await ethers.getSigners();
    const deployed = new Map<string, {address: string, interface: Interface}>();

    const contractManager = getContractManager();

    const messageProxyForMainnetName = "MessageProxyForMainnet";
    console.log("Deploy", messageProxyForMainnetName);
    const messageProxyForMainnetFactory = await getContractFactory(messageProxyForMainnetName);
    const messageProxyForMainnet = (
        await upgrades.deployProxy(messageProxyForMainnetFactory, [contractManager?.address], { initializer: 'initialize(address)' })
    ) as MessageProxyForMainnet;
    await messageProxyForMainnet.deployTransaction.wait();
    console.log("Proxy Contract", messageProxyForMainnetName, "deployed to", messageProxyForMainnet.address);
    deployed.set(
        messageProxyForMainnetName,
        {
            address: messageProxyForMainnet.address,
            interface: messageProxyForMainnet.interface
        }
    );
    await verifyProxy(messageProxyForMainnetName, messageProxyForMainnet.address, []);
    const extraContractRegistrarRole = await messageProxyForMainnet.EXTRA_CONTRACT_REGISTRAR_ROLE();
    await (await messageProxyForMainnet.grantRole(extraContractRegistrarRole, owner.address)).wait();

    const linkerName = "Linker";
    console.log("Deploy", linkerName);
    const linkerFactory = await getContractFactory(linkerName);
    const linker = (
        await upgrades.deployProxy(linkerFactory, [contractManager?.address, deployed.get(messageProxyForMainnetName)?.address], { initializer: 'initialize(address,address)' })
    ) as Linker;
    await linker.deployTransaction.wait();
    await (await linker.registerMainnetContract(linker.address)).wait();
    await (await messageProxyForMainnet.registerExtraContractForAll(linker.address)).wait();
    const chainConnectorRole = await messageProxyForMainnet.CHAIN_CONNECTOR_ROLE();
    await (await messageProxyForMainnet.grantRole(chainConnectorRole, linker.address)).wait();
    console.log("Proxy Contract", linkerName, "deployed to", linker.address);
    deployed.set(
        linkerName,
        {
            address: linker.address,
            interface: linker.interface
        }
    );
    await verifyProxy(linkerName, linker.address, []);

    const communityPoolName = "CommunityPool";
    const communityPoolFactory = await getContractFactory(communityPoolName);
    const communityPool =
        await upgrades.deployProxy(
            communityPoolFactory,
            [
                contractManager?.address,
                deployed.get(linkerName)?.address,
                deployed.get(messageProxyForMainnetName)?.address
            ],
            {
                initializer: 'initialize(address,address,address)'
            }
        );
    await communityPool.deployTransaction.wait();
    await (await linker.registerMainnetContract(communityPool.address)).wait();
    await (await messageProxyForMainnet.registerExtraContractForAll(communityPool.address)).wait();
    await (await messageProxyForMainnet.setCommunityPool(communityPool.address)).wait();
    console.log("Proxy Contract", communityPoolName, "deployed to", communityPool.address);
    deployed.set(
        communityPoolName,
        {
            address: communityPool.address,
            interface: communityPool.interface
        }
    );
    await verifyProxy(communityPoolName, communityPool.address, []);

    for (const contract of contractsToDeploy) {
        const contractFactory = await getContractFactory(contract);
        console.log("Deploy", contract);
        const proxy = await upgrades.deployProxy(
            contractFactory,
            [
                contractManager?.address,
                deployed.get(linkerName)?.address,
                deployed.get(messageProxyForMainnetName)?.address
            ],
            {
                initializer: 'initialize(address,address,address)'
            }
        );
        await proxy.deployTransaction.wait();
        const contractName = contract;
        // // TODO: remove if - after adding tests to agent
        // if (contractName !== "DepositBoxERC1155") {
        console.log("Register", contract, "as", contractName, "=>", proxy.address);
        await (await linker.registerMainnetContract(proxy.address)).wait();
        await (await messageProxyForMainnet.registerExtraContractForAll(proxy.address)).wait();
        console.log( "Contract", contractName, "with address", proxy.address, "is registered as DepositBox in Linker" );
        deployed.set(
            contractName,
            {
                address: proxy.address,
                interface: proxy.interface
            }
        );
        await verifyProxy(contract, proxy.address, []);
    }

    console.log("Store ABIs");

    const outputObject: {[k: string]: any} = {};
    for (const contract of contracts) {
        const contractKey = getContractKeyInAbiFile(contract);
        outputObject[contractKey + "_address"] = deployed.get(contract)?.address;
        outputObject[contractKey + "_abi"] = getAbi(deployed.get(contract)?.interface);
    }

    await fs.writeFile("data/proxyMainnet.json", JSON.stringify(outputObject, null, 4));

    if( contractManager?.address !== null && contractManager?.address !== "" && contractManager?.address !== "0x0000000000000000000000000000000000000000" ) {
        // register MessageProxy in ContractManager
        if( contractManager?.abi !== "" && contractManager?.abi !== undefined ) {
            if( await web3.eth.getCode( contractManager?.address) !== "0x") {
                const contractManagerInst = new ethers.Contract(contractManager?.address, contractManager?.abi, owner);
                if (await contractManagerInst.owner() !== owner.address) {
                    console.log( "Owner of ContractManager is not the same of the deployer" );
                } else {
                    try {
                        await contractManagerInst.setContractsAddress( "MessageProxyForMainnet", deployed.get( "MessageProxyForMainnet" )?.address);
                        await contractManagerInst.setContractsAddress( "CommunityPool", deployed.get( "CommunityPool" )?.address);
                        console.log( "Successfully registered MessageProxy in ContractManager" );
                    } catch ( error ) {
                        console.log( "Registration of MessageProxy is failed on ContractManager. Please redo it by yourself!\nError:", error );
                    }
                }
            } else
                console.log( "Contract Manager address is not a contract" );

        } else
            console.log( "Please provide an abi of ContractManager" );

    } else
        console.log( "Please provide an address of ContractManager" );

    console.log( "Registration is completed!" );

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
