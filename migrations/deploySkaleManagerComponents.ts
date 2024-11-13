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

export function getContractKeyInAbiFile(contract: string) {
    return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
}

export async function getManifestFile(): Promise<string> {
    return (await Manifest.forNetwork(ethers.provider)).file;
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
    console.log("Contract ContractManager deployed to", await contractManager.getAddress());

    console.log("Deploy Schains");
    const schainsFactory = await ethers.getContractFactory("Schains");
    const schains = await schainsFactory.deploy();
    console.log("Contract Schains deployed to", await schains.getAddress());

    console.log("Deploy SchainsInternal");
    const schainsInternalFactory = await ethers.getContractFactory("SchainsInternal");
    const schainsInternal = await schainsInternalFactory.deploy();
    console.log("Contract SchainsInternal deployed to", await schainsInternal.getAddress());

    console.log("Deploy Wallets");
    const walletsFactory = await ethers.getContractFactory("Wallets");
    const wallets = await walletsFactory.deploy();
    console.log("Contract Wallets deployed to", await wallets.getAddress());

    console.log("Deploy SkaleVerifier");
    const skaleVerifierFactory = await ethers.getContractFactory("SkaleVerifierMock");
    const skaleVerifier = await skaleVerifierFactory.deploy();
    console.log("Contract SkaleVerifier deployed to", await skaleVerifier.getAddress());
    
    console.log("Deploy KeyStorage");
    const keyStorageFactory = await ethers.getContractFactory("KeyStorageMock");
    const keyStorage = await keyStorageFactory.deploy() as KeyStorageMock;
    console.log("Contract KeyStorage deployed to", await keyStorage.getAddress());

    console.log("Deploy Nodes");
    const nodesFactory = await ethers.getContractFactory("Nodes");
    const nodes = await nodesFactory.deploy();
    console.log("Contract Nodes deployed to", await nodes.getAddress());

    console.log("Will set dependencies");

    await schains.addContractManager( await contractManager.getAddress() );
    console.log("Add ContractManager address", await contractManager.getAddress(), "as ContractManager to Contract Schains", await schains.getAddress(), "\n");
    await schainsInternal.addContractManager( await contractManager.getAddress() );
    console.log("Add ContractManager address", await contractManager.getAddress(), "as ContractManager to Contract SchainsInternal", await schainsInternal.getAddress(), "\n");
    await wallets.addContractManager( await contractManager.getAddress() );
    console.log("Add ContractManager address", await contractManager.getAddress(), "as ContractManager to Contract Wallets", await wallets.getAddress(), "\n");
    await contractManager.setContractsAddress( "Schains", await schains.getAddress() );
    console.log("Set Schains", await schains.getAddress(), "to ContractManager", await contractManager.getAddress(), "\n");
    await contractManager.setContractsAddress( "SchainsInternal", await schainsInternal.getAddress() );
    console.log("Set SchainsInternal", await schainsInternal.getAddress(), "to ContractManager", await contractManager.getAddress(), "\n");
    await contractManager.setContractsAddress( "Wallets", await wallets.getAddress() );
    console.log("Set Wallets", await wallets.getAddress(), "to ContractManager", await contractManager.getAddress(), "\n");
    await contractManager.setContractsAddress( "SkaleVerifier", await skaleVerifier.getAddress() );
    console.log("Set SkaleVerifier", await skaleVerifier.getAddress(), "to ContractManager", await contractManager.getAddress(), "\n");
    await contractManager.setContractsAddress( "KeyStorage", await keyStorage.getAddress() );
    console.log("Set KeyStorage", await keyStorage.getAddress(), "to ContractManager", await contractManager.getAddress(), "\n");
    await contractManager.setContractsAddress( "Nodes", await nodes.getAddress() );
    console.log("Set Nodes", await nodes.getAddress(), "to ContractManager", await contractManager.getAddress(), "\n");
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
    console.log("Set common public key in KeyStorage contract", await keyStorage.getAddress(), "\n");
    await wallets.rechargeSchainWallet(schainHash, { value: "10000000000000000000" } ); // originally it was 1000000000000000000 = 1ETH
    console.log("Recharge schain wallet in Wallets contract", await wallets.getAddress(), "\n");

    const jsonObject = {
        contract_manager_address: await contractManager.getAddress(),
        contract_manager_abi: getAbi(contractManager.interface),
        schains_internal_address: await schainsInternal.getAddress(),
        schains_internal_abi: getAbi(schainsInternal.interface),
        key_storage_address: await keyStorage.getAddress(),
        key_storage_abi: getAbi(keyStorage.interface),
        wallets_address: await wallets.getAddress(),
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
