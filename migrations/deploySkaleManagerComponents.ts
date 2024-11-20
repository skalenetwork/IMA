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
import { ethers } from "hardhat";
import { getAbi } from '@skalenetwork/upgrade-tools';
import { Manifest } from "@openzeppelin/upgrades-core";
import { KeyStorageMock } from '../typechain';
import { Wallet } from 'ethers';
import { getPublicKey } from '../test/utils/helper';
import axios from 'axios';

export function getContractKeyInAbiFile(contract: string) {
    return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
}

export async function getManifestFile(): Promise<string> {
    return (await Manifest.forNetwork(ethers.provider)).file;
}

async function getLatestVersionOfSkaleManager(): Promise<string> {
    try {
        const response = await axios.get('https://raw.githubusercontent.com/skalenetwork/skale-manager/refs/heads/stable/VERSION');
        return response.data.trim();
    } catch (error) {
        console.error('Failed to fetch the latest version of SkaleManager:', error);
        throw error;
    }
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
        console.log( "Please set PRIVATE_KEY_FOR_SCHAIN to .env file" );
        process.exit( 128 );
    }

    const schainName = process.env.CHAIN_NAME_SCHAIN;
    const schainHash = ethers.id(schainName);

    console.log("Deploy ContractManager");
    const contractManagerFactory = await ethers.getContractFactory("ContractManager");
    const contractManager = await contractManagerFactory.deploy();
    const contractManagerAddress = await contractManager.getAddress();
    console.log("Contract ContractManager deployed to", contractManagerAddress);

    console.log("Deploy Schains");
    const schainsFactory = await ethers.getContractFactory("Schains");
    const schains = await schainsFactory.deploy();
    const schainsAddress = await schains.getAddress();
    console.log("Contract Schains deployed to", schainsAddress);

    console.log("Deploy SchainsInternal");
    const schainsInternalFactory = await ethers.getContractFactory("SchainsInternal");
    const schainsInternal = await schainsInternalFactory.deploy();
    const schainsInternalAddress = await schainsInternal.getAddress();
    console.log("Contract SchainsInternal deployed to", schainsInternalAddress);

    console.log("Deploy Wallets");
    const walletsFactory = await ethers.getContractFactory("Wallets");
    const wallets = await walletsFactory.deploy();
    const walletsAddress = await wallets.getAddress();
    console.log("Contract Wallets deployed to", walletsAddress);

    console.log("Deploy SkaleVerifier");
    const skaleVerifierFactory = await ethers.getContractFactory("SkaleVerifierMock");
    const skaleVerifier = await skaleVerifierFactory.deploy();
    const skaleVerifierAddress = await skaleVerifier.getAddress();
    console.log("Contract SkaleVerifier deployed to", skaleVerifierAddress);

    console.log("Deploy KeyStorage");
    const keyStorageFactory = await ethers.getContractFactory("KeyStorageMock");
    const keyStorage = await keyStorageFactory.deploy() as KeyStorageMock;
    const keyStorageAddress = await keyStorage.getAddress();
    console.log("Contract KeyStorage deployed to", keyStorageAddress);

    console.log("Deploy Nodes");
    const nodesFactory = await ethers.getContractFactory("Nodes");
    const nodes = await nodesFactory.deploy();
    const nodesAddress = await nodes.getAddress();
    console.log("Contract Nodes deployed to", nodesAddress);

    console.log("Deploy SkaleManager");
    const skaleManagerFactory = await ethers.getContractFactory("SkaleManagerMock");
    const skaleManager = await skaleManagerFactory.deploy(contractManager);
    const skaleManagerAddress = await skaleManager.getAddress();
    console.log("Contract SkaleManager deployed to", skaleManagerAddress);

    console.log("Will set dependencies");

    const versionOfSkaleManager = await getLatestVersionOfSkaleManager();

    await skaleManager.setVersion(versionOfSkaleManager);
    console.log("Set version", versionOfSkaleManager, "to SkaleManager", skaleManagerAddress, "\n");
    await contractManager.setContractsAddress("ContractManager", contractManager);
    console.log("Set ContractManager", contractManagerAddress, "to ContractManager", contractManagerAddress, "\n");
    await schains.addContractManager(contractManager);
    console.log("Add ContractManager address", contractManagerAddress, "as ContractManager to Contract Schains", schainsAddress, "\n");
    await schainsInternal.addContractManager(contractManager);
    console.log("Add ContractManager address", contractManagerAddress, "as ContractManager to Contract SchainsInternal", schainsInternalAddress, "\n");
    await wallets.addContractManager(contractManager);
    console.log("Add ContractManager address", contractManagerAddress, "as ContractManager to Contract Wallets", walletsAddress, "\n");
    await contractManager.setContractsAddress("Schains", schains);
    console.log("Set Schains", schainsAddress, "to ContractManager", contractManagerAddress, "\n");
    await contractManager.setContractsAddress("SchainsInternal", schainsInternal);
    console.log("Set SchainsInternal", schainsInternalAddress, "to ContractManager", contractManagerAddress, "\n");
    await contractManager.setContractsAddress("Wallets", wallets);
    console.log("Set Wallets", walletsAddress, "to ContractManager", contractManagerAddress, "\n");
    await contractManager.setContractsAddress("SkaleVerifier", skaleVerifier);
    console.log("Set SkaleVerifier", skaleVerifierAddress, "to ContractManager", contractManagerAddress, "\n");
    await contractManager.setContractsAddress("KeyStorage", keyStorage);
    console.log("Set KeyStorage", keyStorageAddress, "to ContractManager", contractManagerAddress, "\n");
    await contractManager.setContractsAddress("Nodes", nodes);
    console.log("Set Nodes", nodesAddress, "to ContractManager", contractManagerAddress, "\n");
    await contractManager.setContractsAddress("SkaleManager", skaleManager);
    console.log("Set SkaleManager", skaleManagerAddress, "to ContractManager", contractManagerAddress, "\n");
    const nodeAddress1 = new Wallet(process.env.PRIVATE_KEY_FOR_ETHEREUM).connect(ethers.provider);
    const nodeAddress2 = new Wallet(process.env.PRIVATE_KEY_FOR_SCHAIN).connect(ethers.provider);
    await owner.sendTransaction({to: nodeAddress1.address, value: ethers.parseEther("1")});
    await owner.sendTransaction({to: nodeAddress2.address, value: ethers.parseEther("1")});

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
    await schainsInternal.connect(owner).addNodesToSchainsGroups(ethers.id(schainName), [0, 1]);
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
    await keyStorage.setBlsCommonPublicKeyForSchain(schainHash, BLSPublicKey );
    console.log("Set common public key in KeyStorage contract", keyStorageAddress, "\n");
    await wallets.rechargeSchainWallet(schainHash, { value: "10000000000000000000" } ); // originally it was 1000000000000000000 = 1ETH
    console.log("Recharge schain wallet in Wallets contract", walletsAddress, "\n");

    const jsonObject = {
        contract_manager_address: contractManagerAddress,
        contract_manager_abi: getAbi(contractManager.interface),
        schains_internal_address: schainsInternalAddress,
        schains_internal_abi: getAbi(schainsInternal.interface),
        key_storage_address: keyStorageAddress,
        key_storage_abi: getAbi(keyStorage.interface),
        wallets_address: walletsAddress,
        wallets_abi: getAbi(wallets.interface),
        skale_manager_address: skaleManagerAddress,
        skale_manager_abi: getAbi(skaleManager.interface),
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
