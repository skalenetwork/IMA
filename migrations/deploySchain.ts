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
 * @file deploySchain.ts
 * @copyright SKALE Labs 2019-Present
 */
import { promises as fs } from 'fs';
import { Interface } from "ethers";
import { ethers, upgrades } from "hardhat";
import { getAbi, getVersion } from '@skalenetwork/upgrade-tools';
import { Manifest } from "@openzeppelin/upgrades-core";
import { MessageProxyForSchain, MessageProxyForSchainWithoutSignature } from '../typechain';


export function getContractKeyInAbiFile(contract: string): string {
    if (contract === "MessageProxyForSchain") {
        return "message_proxy_chain";
    }
    return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
}

export async function getManifestFile(): Promise<string> {
    return (await Manifest.forNetwork(ethers.provider)).file;
}

async function getProxyMainnet(contractName: string) {
    const defaultFilePath = "data/proxyMainnet.json";
    const jsonData: { [key: string]: string | [] } = JSON.parse(await fs.readFile(defaultFilePath, 'utf-8'));
    try {
        const contractAddress = jsonData[contractName] as string;
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
    // "TokenManagerERC721WithMetadata",
    "EthErc20",
    "KeyStorage"
];

async function main() {
    const [ owner,] = await ethers.getSigners();
    const version = await getVersion();

    if( process.env.CHAIN_NAME_SCHAIN === undefined || process.env.CHAIN_NAME_SCHAIN === "" ) {
        console.log( "Please set CHAIN_NAME_SCHAIN to .env file" );
        process.exit( 126 );
    }
    const schainName = process.env.CHAIN_NAME_SCHAIN;
    const deployed = new Map<string, {address: string, interface: Interface}>();

    if(
        await getProxyMainnet("deposit_box_eth_address") === undefined ||
        await getProxyMainnet("deposit_box_eth_address") === "" ||
        await getProxyMainnet("deposit_box_erc20_address") === undefined ||
        await getProxyMainnet("deposit_box_erc20_address") === "" ||
        await getProxyMainnet("deposit_box_erc721_address") === undefined ||
        await getProxyMainnet("deposit_box_erc721_address") === "" ||
        await getProxyMainnet("deposit_box_erc1155_address") === undefined ||
        await getProxyMainnet("deposit_box_erc1155_address") === "" ||
        await getProxyMainnet("deposit_box_erc721_with_metadata_address") === undefined ||
        await getProxyMainnet("deposit_box_erc721_with_metadata_address") === "" ||
        await getProxyMainnet("community_pool_address") === undefined ||
        await getProxyMainnet("community_pool_address") === "" ||
        await getProxyMainnet("linker_address") === undefined ||
        await getProxyMainnet("linker_address") === ""
    ) {
        console.log( "Please provide correct abi for mainnet contracts in IMA/proxy/data/proxyMainnet.json" );
        process.exit( 126 );
    }
    const depositBoxEthAddress = await getProxyMainnet("deposit_box_eth_address");
    const depositBoxERC20Address = await getProxyMainnet("deposit_box_erc20_address");
    const depositBoxERC721Address = await getProxyMainnet("deposit_box_erc721_address");
    const depositBoxERC1155Address = await getProxyMainnet("deposit_box_erc1155_address");
    const depositBoxERC721WithMetadataAddress = await getProxyMainnet("deposit_box_erc721_with_metadata_address");
    const communityPoolAddress = await getProxyMainnet("community_pool_address");
    const linkerAddress = await getProxyMainnet("linker_address");

    console.log("Deploy KeyStorage");
    const keyStorageFactory = await ethers.getContractFactory("KeyStorage");
    const keyStorage = await upgrades.deployProxy(keyStorageFactory);
    await keyStorage.waitForDeployment();
    deployed.set( "KeyStorage", { address: await keyStorage.getAddress(), interface: keyStorage.interface } );
    console.log("Contract KeyStorage deployed to", await keyStorage.getAddress());

    let messageProxy: MessageProxyForSchain | MessageProxyForSchainWithoutSignature;
    if( process.env.NO_SIGNATURES === "true" ) {
        console.log( "Deploy IMA without signature verification" );
        console.log("Deploy MessageProxyForSchainWithoutSignature");
        messageProxy = await
            (await ethers.getContractFactory("MessageProxyForSchainWithoutSignature"))
            .deploy(schainName) as MessageProxyForSchainWithoutSignature;
    } else {
        console.log("Deploy MessageProxyForSchain");
        messageProxy = await upgrades.deployProxy(
            await ethers.getContractFactory("MessageProxyForSchain"),
            [await keyStorage.getAddress(), schainName]
        ) as unknown as MessageProxyForSchain;
    }
    await messageProxy.waitForDeployment();
    const messageProxyAddress = await messageProxy.getAddress();
    deployed.set( "MessageProxyForSchain", { address: messageProxyAddress, interface: messageProxy.interface } );
    console.log("Contract MessageProxyForSchain deployed to", messageProxyAddress);

    try {
        console.log(`Set version ${version}`)
        await (await messageProxy.setVersion(version)).wait();
    } catch {
        console.log("Failed to set ima version on schain");
    }

    console.log("Deploy TokenManagerLinker");
    const tokenManagerLinkerFactory = await ethers.getContractFactory("TokenManagerLinker");
    const tokenManagerLinker = await upgrades.deployProxy(tokenManagerLinkerFactory, [messageProxyAddress, linkerAddress]);
    await tokenManagerLinker.waitForDeployment();
    deployed.set( "TokenManagerLinker", {
        address: await tokenManagerLinker.getAddress(),
        interface: tokenManagerLinker.interface
    });
    console.log("Contract TokenManagerLinker deployed to", await tokenManagerLinker.getAddress());

    console.log("Deploy CommunityLocker");
    const communityLockerFactory = await ethers.getContractFactory("CommunityLocker");
    const communityLocker = await upgrades.deployProxy(
        communityLockerFactory,
        [ schainName, messageProxyAddress, await tokenManagerLinker.getAddress(), communityPoolAddress ]
    );
    await communityLocker.waitForDeployment();
    deployed.set( "CommunityLocker", { address: await communityLocker.getAddress(), interface: communityLocker.interface });
    console.log("Contract CommunityLocker deployed to", await communityLocker.getAddress());

    console.log("Deploy TokenManagerEth");
    const tokenManagerEthFactory = await ethers.getContractFactory("TokenManagerEth");
    const tokenManagerEth = await upgrades.deployProxy(tokenManagerEthFactory, [
        schainName,
        messageProxyAddress,
        await tokenManagerLinker.getAddress(),
        await communityLocker.getAddress(),
        depositBoxEthAddress,
        "0x0000000000000000000000000000000000000000"
    ]);
    await tokenManagerEth.waitForDeployment();
    deployed.set( "TokenManagerEth", { address: await tokenManagerEth.getAddress(), interface: tokenManagerEth.interface } );
    console.log("Contract TokenManagerEth deployed to", await tokenManagerEth.getAddress());

    console.log("Deploy TokenManagerERC20");
    const tokenManagerERC20Factory = await ethers.getContractFactory("TokenManagerERC20");
    const tokenManagerERC20 = await upgrades.deployProxy(tokenManagerERC20Factory, [
        schainName,
        messageProxyAddress,
        await tokenManagerLinker.getAddress(),
        await communityLocker.getAddress(),
        depositBoxERC20Address
    ]);
    await tokenManagerERC20.waitForDeployment();
    deployed.set( "TokenManagerERC20", {
        address: await tokenManagerERC20.getAddress(),
        interface: tokenManagerERC20.interface
    });
    console.log("Contract TokenManagerERC20 deployed to", await tokenManagerERC20.getAddress());

    console.log("Deploy TokenManagerERC721");
    const tokenManagerERC721Factory = await ethers.getContractFactory("TokenManagerERC721");
    const tokenManagerERC721 = await upgrades.deployProxy(tokenManagerERC721Factory, [
        schainName,
        messageProxyAddress,
        await tokenManagerLinker.getAddress(),
        await communityLocker.getAddress(),
        depositBoxERC721Address
    ]);
    await tokenManagerERC721.waitForDeployment();
    deployed.set( "TokenManagerERC721", {
        address: await tokenManagerERC721.getAddress(),
        interface: tokenManagerERC721.interface
    });
    console.log("Contract TokenManagerERC721 deployed to", await tokenManagerERC721.getAddress());

    console.log("Deploy TokenManagerERC1155");
    const tokenManagerERC1155Factory = await ethers.getContractFactory("TokenManagerERC1155");
    const tokenManagerERC1155 = await upgrades.deployProxy(tokenManagerERC1155Factory, [
        schainName,
        messageProxyAddress,
        await tokenManagerLinker.getAddress(),
        await communityLocker.getAddress(),
        depositBoxERC1155Address
    ]);
    await tokenManagerERC1155.waitForDeployment();
    deployed.set( "TokenManagerERC1155", { address: await tokenManagerERC1155.getAddress(), interface: tokenManagerERC1155.interface } );
    console.log("Contract TokenManagerERC1155 deployed to", await tokenManagerERC1155.getAddress());

    console.log("Deploy TokenManagerERC721WithMetadata");
    const tokenManagerERC721WithMetadataFactory = await ethers.getContractFactory("TokenManagerERC721WithMetadata");
    const tokenManagerERC721WithMetadata = await upgrades.deployProxy(tokenManagerERC721WithMetadataFactory, [
        schainName,
        messageProxyAddress,
        await tokenManagerLinker.getAddress(),
        await communityLocker.getAddress(),
        depositBoxERC721WithMetadataAddress
    ]);
    await tokenManagerERC721WithMetadata.waitForDeployment();
    deployed.set("TokenManagerERC721WithMetadata", {
        address: await tokenManagerERC721WithMetadata.getAddress(),
        interface: tokenManagerERC721WithMetadata.interface
    });
        console.log("Contract TokenManagerERC721WithMetadata deployed to", await tokenManagerERC721WithMetadata.getAddress());

    console.log("Register token managers");
    await (await tokenManagerLinker.registerTokenManager(await tokenManagerEth.getAddress())).wait();
    await (await tokenManagerLinker.registerTokenManager(await tokenManagerERC20.getAddress())).wait();
    await (await tokenManagerLinker.registerTokenManager(await tokenManagerERC721.getAddress())).wait();
    await (await tokenManagerLinker.registerTokenManager(await tokenManagerERC1155.getAddress())).wait();
    await (await tokenManagerLinker.registerTokenManager(await tokenManagerERC721WithMetadata.getAddress())).wait();

    console.log("Deploy EthErc20");
    const ethERC20Factory = await ethers.getContractFactory("EthErc20");
    const ethERC20 = await upgrades.deployProxy(ethERC20Factory, [ await tokenManagerEth.getAddress() ]);
    await ethERC20.waitForDeployment();
    deployed.set( "EthErc20", { address: await ethERC20.getAddress(), interface: ethERC20.interface } );
    console.log("Contract EthErc20 deployed to", await ethERC20.getAddress());

    console.log( "\nWill set dependencies!\n" );

    await tokenManagerEth.setEthErc20Address( await ethERC20.getAddress() );
    console.log( "Set EthErc20 address", await ethERC20.getAddress(), "in TokenManagerEth", await tokenManagerEth.getAddress(), "completed!\n" );

    const chainConnectorRole = await messageProxy.CHAIN_CONNECTOR_ROLE();
    await messageProxy.grantRole( chainConnectorRole, await tokenManagerLinker.getAddress() );
    console.log( "Grant CHAIN_CONNECTOR_ROLE to TokenManagerLinker", await tokenManagerLinker.getAddress(), "in MessageProxyForSchain", messageProxyAddress, "completed!\n" );
    const constantSetterRole = await communityLocker.CONSTANT_SETTER_ROLE();
    await communityLocker.grantRole(constantSetterRole, await owner.getAddress());
    console.log("Grant CONSTANT_SETTER_ROLE to owner of schain");

    const extraContracts = [
        tokenManagerEth,
        tokenManagerERC20,
        tokenManagerERC721,
        tokenManagerERC1155,
        communityLocker,
        tokenManagerERC721WithMetadata
    ];
    const extraContractRegistrarRole = await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE();
    await messageProxy.grantRole(extraContractRegistrarRole, await owner.getAddress());
    for (const extraContract of extraContracts) {
        await messageProxy.registerExtraContractForAll(await extraContract.getAddress())
        console.log("Contract with address ", await extraContract.getAddress(), "registered as extra contract");
    }

    const jsonObjectABI: {[k: string]: string | []} = { };
    for( const contractName of contracts ) {
        const propertyName = getContractKeyInAbiFile(contractName);

        const deployedContract = deployed.get(contractName);
        if (deployedContract === undefined) {
            throw Error(`Contract ${contractName} was not found`);
        } else {
            jsonObjectABI[propertyName + "_address"] = deployedContract.address;
            jsonObjectABI[propertyName + "_abi"] = getAbi(deployedContract.interface);
        }
    }
    const deployedTokenManagerERC721WithMetadata = deployed.get( "TokenManagerERC721WithMetadata" );
    if (deployedTokenManagerERC721WithMetadata === undefined) {
        throw new Error("TokenManagerERC721WithMetadata was not found");
    } else {
        jsonObjectABI[getContractKeyInAbiFile("TokenManagerERC721WithMetadata") + "_address"] = deployedTokenManagerERC721WithMetadata.address;
        jsonObjectABI[getContractKeyInAbiFile("TokenManagerERC721WithMetadata") + "_abi"] = getAbi(deployedTokenManagerERC721WithMetadata.interface);
    }
    const erc20OnChainFactory = await ethers.getContractFactory("ERC20OnChain");
    jsonObjectABI.ERC20OnChain_abi = getAbi(erc20OnChainFactory.interface);
    const erc721OnChainFactory = await ethers.getContractFactory("ERC721OnChain");
    jsonObjectABI.ERC721OnChain_abi = getAbi(erc721OnChainFactory.interface);
    const erc1155OnChainFactory = await ethers.getContractFactory("ERC1155OnChain");
    jsonObjectABI.ERC1155OnChain_abi = getAbi(erc1155OnChainFactory.interface);

    await fs.writeFile( `data/proxySchain_${schainName}.json`, JSON.stringify( jsonObjectABI ) );
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
