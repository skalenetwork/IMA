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
 * @file deploySkaleManagerComponents.js
 * @copyright SKALE Labs 2021-Present
 */
import { promises as fs } from 'fs';
import { ethers, artifacts, web3 } from "hardhat";
import { deployLibraries, getLinkedContractFactory } from "./tools/factory";
import { getAbi } from './tools/abi';
import { Manifest, hashBytecode } from "@openzeppelin/upgrades-core";
import { KeyStorageMock } from '../typechain/KeyStorageMock';
import { Wallet } from 'ethers';
import { getPublicKey } from '../test/utils/helper';

export function getContractKeyInAbiFile(contract: string) {
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

async function main() {
    const [ owner,] = await ethers.getSigners();

    if( process.env.CHAIN_NAME_SCHAIN === undefined || process.env.CHAIN_NAME_SCHAIN === "" ) {
        console.log( "Please set CHAIN_NAME_SCHAIN to .env file" );
        process.exit( 126 );
    }

    if ( process.env.PRIVATE_KEY_FOR_ETHEREUM === undefined || process.env.PRIVATE_KEY_FOR_ETHEREUM === "" ) {
        console.log( "Please set PRIVATE_KEY_FOR_ETHEREUM to .env file" );
        process.exit( 127 );
    }

    if ( process.env.PRIVATE_KEY_FOR_SCHAIN === undefined || process.env.PRIVATE_KEY_FOR_SCHAIN === "" ) {
        console.log( "Please set PRIVATE_KEY_FOR_ETHEREUM to .env file" );
        process.exit( 128 );
    }

    const schainName = process.env.CHAIN_NAME_SCHAIN;

    console.log("Deploy ContractManager");
    const contractManagerFactory = await getContractFactory("ContractManager");
    const contractManager = await contractManagerFactory.deploy();
    console.log("Contract ContractManager deployed to", contractManager.address);

    console.log("Deploy Schains");
    const schainsFactory = await getContractFactory("Schains");
    const schains = await schainsFactory.deploy();
    console.log("Contract Schains deployed to", schains.address);

    console.log("Deploy SchainsInternal");
    const schainsInternalFactory = await getContractFactory("SchainsInternal");
    const schainsInternal = await schainsInternalFactory.deploy();
    console.log("Contract SchainsInternal deployed to", schainsInternal.address);

    console.log("Deploy Wallets");
    const walletsFactory = await getContractFactory("Wallets");
    const wallets = await walletsFactory.deploy();
    console.log("Contract Wallets deployed to", wallets.address);

    console.log("Deploy SkaleVerifier");
    const skaleVerifierFactory = await getContractFactory("SkaleVerifierMock");
    const skaleVerifier = await skaleVerifierFactory.deploy();
    console.log("Contract SkaleVerifier deployed to", skaleVerifier.address);

    console.log("Deploy KeyStorage");
    const keyStorageFactory = await getContractFactory("KeyStorageMock");
    const keyStorage = await keyStorageFactory.deploy() as KeyStorageMock;
    console.log("Contract KeyStorage deployed to", keyStorage.address);

    console.log("Deploy Nodes");
    const nodesFactory = await getContractFactory("Nodes");
    const nodes = await nodesFactory.deploy();
    console.log("Contract Nodes deployed to", nodes.address);

    console.log("Will set dependencies");

    await schains.addContractManager( contractManager.address );
    console.log("Add ContractManager address", contractManager.address, "as ContractManager to Contract Schains", schains.address, "\n");
    await schainsInternal.addContractManager( contractManager.address );
    console.log("Add ContractManager address", contractManager.address, "as ContractManager to Contract SchainsInternal", schainsInternal.address, "\n");
    await wallets.addContractManager( contractManager.address );
    console.log("Add ContractManager address", contractManager.address, "as ContractManager to Contract Wallets", wallets.address, "\n");
    await contractManager.setContractsAddress( "Schains", schains.address );
    console.log("Set Schains", schains.address, "to ContractManager", contractManager.address, "\n");
    await contractManager.setContractsAddress( "SchainsInternal", schainsInternal.address );
    console.log("Set SchainsInternal", schainsInternal.address, "to ContractManager", contractManager.address, "\n");
    await contractManager.setContractsAddress( "Wallets", wallets.address );
    console.log("Set Wallets", wallets.address, "to ContractManager", contractManager.address, "\n");
    await contractManager.setContractsAddress( "SkaleVerifier", skaleVerifier.address );
    console.log("Set SkaleVerifier", skaleVerifier.address, "to ContractManager", contractManager.address, "\n");
    await contractManager.setContractsAddress( "KeyStorage", keyStorage.address );
    console.log("Set KeyStorage", keyStorage.address, "to ContractManager", contractManager.address, "\n");
    await contractManager.setContractsAddress( "Nodes", nodes.address );
    console.log("Set Nodes", nodes.address, "to ContractManager", contractManager.address, "\n");
    const nodeAddress1 = new Wallet(process.env.PRIVATE_KEY_FOR_ETHEREUM).connect(ethers.provider);
    const nodeAddress2 = new Wallet(process.env.PRIVATE_KEY_FOR_SCHAIN).connect(ethers.provider);
    await owner.sendTransaction({to: nodeAddress1.address, value: ethers.utils.parseEther("1")});
    await owner.sendTransaction({to: nodeAddress2.address, value: ethers.utils.parseEther("1")});

    const nodeCreationParams1 = {
        port: 1337,
        nonce: 1337,
        ip: "0x12345678",
        publicIp: "0x12345678",
        publicKey: getPublicKey(nodeAddress1),
        name: "TestNode1",
        domainName: "testnode1.com"
    };
    const nodeCreationParams2 = {
        port: 1337,
        nonce: 1337,
        ip: "0x12345678",
        publicIp: "0x12345678",
        publicKey: getPublicKey(nodeAddress1),
        name: "TestNode2",
        domainName: "testnode2.com"
    };
    await nodes.connect(owner).createNode(nodeAddress1.address, nodeCreationParams1);
    console.log("Create Node 0 with address", nodeAddress1.address, "\n");
    await nodes.connect(owner).createNode(nodeAddress2.address, nodeCreationParams2);
    console.log("Create Node 1 with address", nodeAddress2.address, "\n");
    await schainsInternal.initializeSchain( schainName, owner.address, 1, 1 );
    console.log("Initialize Schain", schainName, "with address", owner.address, "\n");
    await schainsInternal.connect(owner).addNodesToSchainsGroups(ethers.utils.id(schainName), [0, 1]);
    console.log("Add Nodes 0 and 1 to schain", schainName, "\n");
    const BLSPublicKey = {
        x: {
            a: "8276253263131369565695687329790911140957927205765534740198480597854608202714",
            b: "12500085126843048684532885473768850586094133366876833840698567603558300429943"
        },
        y: {
            a: "7025653765868604607777943964159633546920168690664518432704587317074821855333",
            b: "14411459380456065006136894392078433460802915485975038137226267466736619639091"
        }
    };
    await keyStorage.setBlsCommonPublicKeyForSchain( ethers.utils.solidityKeccak256(['string'], [schainName]), BLSPublicKey );
    console.log("Set common public key in KeyStorage contract", keyStorage.address, "\n");
    await wallets.rechargeSchainWallet( web3.utils.soliditySha3( schainName ), { value: "10000000000000000000" } ); // originally it was 10000000000000000000 = 1ETH
    console.log("Recharge schain wallet in Wallets contract", wallets.address, "\n");

    const jsonObject = {
        contract_manager_address: contractManager.address,
        contract_manager_abi: getAbi(contractManager.interface),
        schains_internal_address: schainsInternal.address,
        schains_internal_abi: getAbi(schainsInternal.interface),
        key_storage_address: keyStorage.address,
        key_storage_abi: getAbi(keyStorage.interface),
        wallets_address: wallets.address,
        wallets_abi: getAbi(wallets.interface)
    };

    await fs.writeFile( "data/skaleManagerComponents.json", JSON.stringify( jsonObject ) );
    console.log( "Done, check skaleManagerComponents file in data folder." );
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}