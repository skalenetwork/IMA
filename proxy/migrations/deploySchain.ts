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
 * @file deploySchain.js
 * @copyright SKALE Labs 2019-Present
 */
import { promises as fs } from 'fs';
import { Interface } from "ethers/lib/utils";
import { ethers, artifacts, web3 } from "hardhat";
import { deployLibraries, getLinkedContractFactory } from "./tools/factory";
import { getAbi } from './tools/abi';
import { Manifest, hashBytecode } from "@openzeppelin/upgrades-core";
import { Contract } from '@ethersproject/contracts';

export function getContractKeyInAbiFile(contract: string) {
    return contract.replace(/([a-zA-Z])(?=[A-Z])/g, '$1_').toLowerCase();
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

function getProxyMainnet(contractName: string) {
    const defaultFilePath = "../data/proxyMainnet.json";
    const jsonData = require(defaultFilePath);
    try {
        const contractAddress = jsonData[contractName];
        return contractAddress;
    } catch (e) {
        console.log(e);
        process.exit( 126 );
    }
}

export const contracts = [
    "MessageProxyForSchain",
    "TokenManagerLinker",
    "CommunityLocker",
    "TokenManagerEth",
    "TokenManagerERC20",
    "TokenManagerERC721",
    "TokenManagerERC1155",
    "EthERC20",
    "SkaleFeatures"
];

async function main() {
    const [ owner,] = await ethers.getSigners();

    if( process.env.CHAIN_NAME_SCHAIN === undefined || process.env.CHAIN_NAME_SCHAIN === "" ) {
        console.log( "Please set CHAIN_NAME_SCHAIN to .env file" );
        process.exit( 126 );
    }
    if( process.env.PRIVATE_KEY_FOR_SCHAIN === undefined || process.env.PRIVATE_KEY_FOR_SCHAIN === "" ) {
        console.log( "Please set PRIVATE_KEY_FOR_SCHAIN to .env file" );
        process.exit( 126 );
    }
    const schainName = process.env.CHAIN_NAME_SCHAIN;
    let messageProxyFactory = await ethers.getContractFactory("MessageProxyForSchain");
    if( process.env.NO_SIGNATURES === "true" ) {
        console.log( "Deploy IMA without signature verification" );
        messageProxyFactory = await ethers.getContractFactory("MessageProxyForSchainWithoutSignature");
    }
    const deployed = new Map<string, {address: string, interface: Interface, bytecode: string}>();

    if(
        getProxyMainnet("deposit_box_eth_address") === undefined ||
        getProxyMainnet("deposit_box_eth_address") === "" ||
        getProxyMainnet("deposit_box_erc20_address") === undefined ||
        getProxyMainnet("deposit_box_erc20_address") === "" ||
        getProxyMainnet("deposit_box_erc721_address") === undefined ||
        getProxyMainnet("deposit_box_erc721_address") === "" ||
        getProxyMainnet("deposit_box_erc1155_address") === undefined ||
        getProxyMainnet("deposit_box_erc1155_address") === "" ||
        getProxyMainnet("community_pool_address") === undefined ||
        getProxyMainnet("community_pool_address") === "" ||
        getProxyMainnet("linker_address") === undefined ||
        getProxyMainnet("linker_address") === ""
    ) {
        console.log( "Please provide correct abi for mainnet contracts in IMA/proxy/data/proxyMainnet.json" );
        process.exit( 126 );
    }
    const depositBoxEthAddress = getProxyMainnet("deposit_box_eth_address");
    const depositBoxERC20Address = getProxyMainnet("deposit_box_erc20_address");
    const depositBoxERC721Address = getProxyMainnet("deposit_box_erc721_address");
    const depositBoxERC1155Address = getProxyMainnet("deposit_box_erc1155_address");
    const communityPoolAddress = getProxyMainnet("community_pool_address");
    const linkerAddress = getProxyMainnet("linker_address");

    console.log("Deploy MessageProxyForSchain");
    const messageProxy = await messageProxyFactory.deploy( schainName );
    deployed.set( "MessageProxyForSchain", { address: messageProxy.address, interface: messageProxy.interface, bytecode: messageProxy.bytecode } );
    console.log("Contract MessageProxyForSchain deployed to", messageProxy.address);

    console.log("Deploy TokenManagerLinker");
    const tokenManagerLinkerFactory = await ethers.getContractFactory("TokenManagerLinker");
    const tokenManagerLinker = await tokenManagerLinkerFactory.deploy( messageProxy.address, linkerAddress );
    deployed.set( "TokenManagerLinker", { address: tokenManagerLinker.address, interface: tokenManagerLinker.interface, bytecode: tokenManagerLinker.bytecode } );
    console.log("Contract TokenManagerLinker deployed to", tokenManagerLinker.address);

    console.log("Deploy CommunityLocker");
    const communityLockerFactory = await ethers.getContractFactory("CommunityLocker");
    const communityLocker = await communityLockerFactory.deploy(schainName, messageProxy.address, tokenManagerLinker.address, communityPoolAddress);
    deployed.set( "CommunityLocker", { address: communityLocker.address, interface: communityLocker.interface, bytecode: communityLocker.bytecode } );
    console.log("Contract CommunityLocker deployed to", communityLocker.address);

    console.log("Deploy TokenManagerEth");
    const tokenManagerEthFactory = await ethers.getContractFactory("TokenManagerEth");
    const tokenManagerEth = await tokenManagerEthFactory.deploy(
        schainName,
        messageProxy.address,
        tokenManagerLinker.address,
        communityLocker.address,
        depositBoxEthAddress
    );
    deployed.set( "TokenManagerEth", { address: tokenManagerEth.address, interface: tokenManagerEth.interface, bytecode: tokenManagerEth.bytecode } );
    console.log("Contract TokenManagerEth deployed to", tokenManagerEth.address);

    console.log("Deploy TokenManagerERC20");
    const tokenManagerERC20Factory = await ethers.getContractFactory("TokenManagerERC20");
    const tokenManagerERC20 = await tokenManagerERC20Factory.deploy(
        schainName,
        messageProxy.address,
        tokenManagerLinker.address,
        communityLocker.address,
        depositBoxERC20Address
    );
    deployed.set( "TokenManagerERC20", { address: tokenManagerERC20.address, interface: tokenManagerERC20.interface, bytecode: tokenManagerERC20.bytecode } );
    console.log("Contract TokenManagerERC20 deployed to", tokenManagerERC20.address);

    console.log("Deploy TokenManagerERC721");
    const tokenManagerERC721Factory = await ethers.getContractFactory("TokenManagerERC721");
    const tokenManagerERC721 = await tokenManagerERC721Factory.deploy(
        schainName,
        messageProxy.address,
        tokenManagerLinker.address,
        communityLocker.address,
        depositBoxERC721Address
    );
    deployed.set( "TokenManagerERC721", { address: tokenManagerERC721.address, interface: tokenManagerERC721.interface, bytecode: tokenManagerERC721.bytecode } );
    console.log("Contract TokenManagerERC721 deployed to", tokenManagerERC721.address);

    console.log("Deploy TokenManagerERC1155");
    const tokenManagerERC1155Factory = await ethers.getContractFactory("TokenManagerERC1155");
    const tokenManagerERC1155 = await tokenManagerERC1155Factory.deploy(
        schainName,
        messageProxy.address,
        tokenManagerLinker.address,
        communityLocker.address,
        depositBoxERC1155Address
    );
    deployed.set( "TokenManagerERC1155", { address: tokenManagerERC1155.address, interface: tokenManagerERC1155.interface, bytecode: tokenManagerERC1155.bytecode } );
    console.log("Contract TokenManagerERC1155 deployed to", tokenManagerERC1155.address);

    console.log("Deploy EthERC20");
    const ethERC20Factory = await ethers.getContractFactory("EthERC20");
    const ethERC20 = await ethERC20Factory.deploy( tokenManagerEth.address );
    deployed.set( "EthERC20", { address: ethERC20.address, interface: ethERC20.interface, bytecode: ethERC20.bytecode } );
    console.log("Contract EthERC20 deployed to", ethERC20.address);

    console.log("Deploy SkaleFeatures");
    const skaleFeaturesFactory = await ethers.getContractFactory("SkaleFeaturesMock");
    const skaleFeatures = await skaleFeaturesFactory.deploy();
    console.log("Contract SkaleFeatures deployed to", skaleFeatures.address);

    console.log( "\nWill set dependencies!\n" );

    await tokenManagerEth.setEthErc20Address( ethERC20.address );
    console.log( "Set EthERC20 address", ethERC20.address, "in TokenManagerEth", tokenManagerEth.address, "completed!\n" );

    const chainConnectorRole = await messageProxy.CHAIN_CONNECTOR_ROLE();
    await messageProxy.grantRole( chainConnectorRole, tokenManagerLinker.address );
    console.log( "Grant CHAIN_CONNECTOR_ROLE to TokenManagerLinker", tokenManagerLinker.address, "in MessageProxyForSchain", messageProxy.address, "completed!\n" );

    const schainOwner = web3.eth.accounts.privateKeyToAccount( process.env.PRIVATE_KEY_FOR_SCHAIN );
    await skaleFeatures.setSchainOwner( schainOwner.address );
    console.log( "Set Schain owner address", schainOwner.address, "in SkaleFeatures", skaleFeatures.address, "completed!\n" );

    let skaleFeaturesSetterRole = await tokenManagerEth.SKALE_FEATURES_SETTER_ROLE();
    await tokenManagerEth.grantRole( skaleFeaturesSetterRole, owner.address );
    console.log( "Grant SKALE_FEATURES_SETTER_ROLE to deployer", owner.address, "in TokenManagerEth", tokenManagerEth.address, "completed!\n" );
    await tokenManagerEth.setSkaleFeaturesAddress( skaleFeatures.address );
    console.log( "Set SkaleFeatures address", skaleFeatures.address, "in TokenManagerEth", tokenManagerEth.address, "completed!\n" );

    skaleFeaturesSetterRole = await tokenManagerERC20.SKALE_FEATURES_SETTER_ROLE();
    await tokenManagerERC20.grantRole( skaleFeaturesSetterRole, owner.address );
    console.log( "Grant SKALE_FEATURES_SETTER_ROLE to deployer", owner.address, "in TokenManagerERC20", tokenManagerERC20.address, "completed!\n" );
    await tokenManagerERC20.setSkaleFeaturesAddress( skaleFeatures.address );
    console.log( "Set SkaleFeatures address", skaleFeatures.address, "in TokenManagerERC20", tokenManagerERC20.address, "completed!\n" );

    skaleFeaturesSetterRole = await tokenManagerERC721.SKALE_FEATURES_SETTER_ROLE();
    await tokenManagerERC721.grantRole( skaleFeaturesSetterRole, owner.address );
    console.log( "Grant SKALE_FEATURES_SETTER_ROLE to deployer", owner.address, "in TokenManagerERC721", tokenManagerERC721.address, "completed!\n" );
    await tokenManagerERC721.setSkaleFeaturesAddress( skaleFeatures.address );
    console.log( "Set SkaleFeatures address", skaleFeatures.address, "in TokenManagerERC721", tokenManagerERC721.address, "completed!\n" );

    skaleFeaturesSetterRole = await tokenManagerERC1155.SKALE_FEATURES_SETTER_ROLE();
    await tokenManagerERC1155.grantRole( skaleFeaturesSetterRole, owner.address );
    console.log( "Grant SKALE_FEATURES_SETTER_ROLE to deployer", owner.address, "in TokenManagerERC1155", tokenManagerERC1155.address, "completed!\n" );
    await tokenManagerERC1155.setSkaleFeaturesAddress( skaleFeatures.address );
    console.log( "Set SkaleFeatures address", skaleFeatures.address, "in TokenManagerERC1155", tokenManagerERC1155.address, "completed!\n" );

    let extraContract: Contract;
    const extraContracts = [
        tokenManagerEth,
        tokenManagerERC20,
        tokenManagerERC721,
        tokenManagerERC1155,
        communityLocker
    ];
    const extraContractRegistrarRole = await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE();
    await messageProxy.grantRole(extraContractRegistrarRole, owner.address);
    for (extraContract of extraContracts) {
        await messageProxy.registerExtraContractForAll(extraContract.address)
        console.log("Contract with address ", extraContract.address, "registered as extra contract");
    }

    const jsonObjectABI: {[k: string]: any} = { };
    const jsonObjectBytecode: {[k: string]: any} = { };
    for( const contractName of contracts ) {
        let propertyName: string;
        if( contractName !== "MessageProxyForSchain" )
            propertyName = contractName.replace( /([a-z0-9])(?=[A-Z])/g, "$1_" ).toLowerCase();
        else
            propertyName = "message_proxy_chain";

        jsonObjectABI[propertyName + "_address"] = deployed.get( contractName )?.address;
        jsonObjectABI[propertyName + "_abi"] = getAbi(deployed.get( contractName )?.interface);
        jsonObjectBytecode[propertyName + "_address"] = deployed.get( contractName )?.address;
        jsonObjectBytecode[propertyName + "_bytescode"] = deployed.get( contractName )?.bytecode;
    }
    const erc20OnChainFactory = await ethers.getContractFactory("ERC20OnChain");
    jsonObjectABI.ERC20OnChain_abi = getAbi(erc20OnChainFactory.interface);
    const erc721OnChainFactory = await ethers.getContractFactory("ERC721OnChain");
    jsonObjectABI.ERC721OnChain_abi = getAbi(erc721OnChainFactory.interface);
    const erc1155OnChainFactory = await ethers.getContractFactory("ERC1155OnChain");
    jsonObjectABI.ERC1155OnChain_abi = getAbi(erc1155OnChainFactory.interface);

    await fs.writeFile( `data/proxySchain_${schainName}.json`, JSON.stringify( jsonObjectABI ) );
    await fs.writeFile( `data/proxySchain_${schainName}_bytecode.json`, JSON.stringify( jsonObjectBytecode ) );
    console.log( `Done, check proxySchain_${schainName}.json file in data folder.` );
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
