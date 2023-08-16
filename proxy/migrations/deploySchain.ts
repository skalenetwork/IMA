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
import { ethers, upgrades, network } from "hardhat";
import hre from "hardhat";
import { getAbi, getVersion } from '@skalenetwork/upgrade-tools';
import { Manifest } from "@openzeppelin/upgrades-core";
import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import {
    CommunityLocker,
    EthErc20,
    KeyStorage,
    MessageProxyForSchain,
    TokenManagerERC20,
    TokenManagerERC721,
    TokenManagerEth,
    TokenManagerLinker,
    TokenManagerERC721WithMetadata,
    MessageProxyForSchainWithoutSignature
} from '../typechain';
import { TokenManagerERC1155 } from '../typechain';
import { SkaleABIFile } from '@skalenetwork/upgrade-tools/dist/src/types/SkaleABIFile';

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
    const jsonData = JSON.parse(await fs.readFile(defaultFilePath)) as SkaleABIFile;
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
    const keyStorage = await upgrades.deployProxy(keyStorageFactory) as KeyStorage;
    await keyStorage.deployTransaction.wait();
    deployed.set( "KeyStorage", { address: keyStorage.address, interface: keyStorage.interface } );
    console.log("Contract KeyStorage deployed to", keyStorage.address);

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
            [keyStorage.address, schainName]
        ) as MessageProxyForSchain;
    }
    await messageProxy.deployTransaction.wait();
    deployed.set( "MessageProxyForSchain", { address: messageProxy.address, interface: messageProxy.interface } );
    console.log("Contract MessageProxyForSchain deployed to", messageProxy.address);

    try {
        console.log(`Set version ${version}`)
        await (await messageProxy.setVersion(version)).wait();
    } catch {
        console.log("Failed to set ima version on schain");
    }

    console.log("Deploy TokenManagerLinker");
    const tokenManagerLinkerFactory = await ethers.getContractFactory("TokenManagerLinker");
    const tokenManagerLinker = await upgrades.deployProxy(tokenManagerLinkerFactory, [ messageProxy.address, linkerAddress ] ) as TokenManagerLinker;
    await tokenManagerLinker.deployTransaction.wait();
    deployed.set( "TokenManagerLinker", { address: tokenManagerLinker.address, interface: tokenManagerLinker.interface } );
    console.log("Contract TokenManagerLinker deployed to", tokenManagerLinker.address);

    console.log("Deploy CommunityLocker");
    const communityLockerFactory = await ethers.getContractFactory("CommunityLocker");
    const communityLocker = await upgrades.deployProxy(
        communityLockerFactory,
        [ schainName, messageProxy.address, tokenManagerLinker.address, communityPoolAddress ]
    ) as CommunityLocker;
    await communityLocker.deployTransaction.wait();
    deployed.set( "CommunityLocker", { address: communityLocker.address, interface: communityLocker.interface });
    console.log("Contract CommunityLocker deployed to", communityLocker.address);

    console.log("Deploy TokenManagerEth");
    const tokenManagerEthFactory = await ethers.getContractFactory("TokenManagerEth");
    const tokenManagerEth = await upgrades.deployProxy(tokenManagerEthFactory, [
        schainName,
        messageProxy.address,
        tokenManagerLinker.address,
        communityLocker.address,
        depositBoxEthAddress,
        "0x0000000000000000000000000000000000000000"
    ]) as TokenManagerEth;
    await tokenManagerEth.deployTransaction.wait();
    deployed.set( "TokenManagerEth", { address: tokenManagerEth.address, interface: tokenManagerEth.interface } );
    console.log("Contract TokenManagerEth deployed to", tokenManagerEth.address);

    console.log("Deploy TokenManagerERC20");
    const tokenManagerERC20Factory = await ethers.getContractFactory("TokenManagerERC20");
    const tokenManagerERC20 = await upgrades.deployProxy(tokenManagerERC20Factory, [
        schainName,
        messageProxy.address,
        tokenManagerLinker.address,
        communityLocker.address,
        depositBoxERC20Address
    ]) as TokenManagerERC20;
    await tokenManagerERC20.deployTransaction.wait();
    deployed.set( "TokenManagerERC20", { address: tokenManagerERC20.address, interface: tokenManagerERC20.interface } );
    console.log("Contract TokenManagerERC20 deployed to", tokenManagerERC20.address);

    /*
    In the moment of this code was written
    ganache had a bug
    that prevented proper execution
    of estimateGas function
    during deployment of smart contract
    that exceed 24KB limit.

    In addition to this problem
    upgrade-hardhat library
    did not supported
    manual gas limit configuration.

    TODO: in case of any one or both issues fixed
    please remove this crazy workaround below
    */
    if (network.config.gas === "auto") {
        throw Error("Can't use auto because of problems with gas estimations");
    }
    if (!process.env.PRIVATE_KEY_FOR_SCHAIN) {
        throw Error("PRIVATE_KEY_FOR_SCHAIN is not set");
    }
    const key = process.env.PRIVATE_KEY_FOR_SCHAIN;
    const signerWithFixedGasEstimation = new ethers.Wallet(key, ethers.provider);
    signerWithFixedGasEstimation.estimateGas = async() => {
        return ethers.BigNumber.from(network.config.gas as number);
    }

    // The end of TODO:

    console.log("Deploy TokenManagerERC721");
    const tokenManagerERC721Factory = await ethers.getContractFactory("TokenManagerERC721", signerWithFixedGasEstimation);
    const tokenManagerERC721 = await upgrades.deployProxy(tokenManagerERC721Factory, [
        schainName,
        messageProxy.address,
        tokenManagerLinker.address,
        communityLocker.address,
        depositBoxERC721Address
    ]) as TokenManagerERC721;
    await tokenManagerERC721.deployTransaction.wait();
    deployed.set( "TokenManagerERC721", { address: tokenManagerERC721.address, interface: tokenManagerERC721.interface } );
    console.log("Contract TokenManagerERC721 deployed to", tokenManagerERC721.address);

    console.log("Deploy TokenManagerERC1155");
    const tokenManagerERC1155Factory = await ethers.getContractFactory("TokenManagerERC1155", signerWithFixedGasEstimation);
    const tokenManagerERC1155 = await upgrades.deployProxy(tokenManagerERC1155Factory, [
        schainName,
        messageProxy.address,
        tokenManagerLinker.address,
        communityLocker.address,
        depositBoxERC1155Address
    ]) as TokenManagerERC1155;
    await tokenManagerERC1155.deployTransaction.wait();
    deployed.set( "TokenManagerERC1155", { address: tokenManagerERC1155.address, interface: tokenManagerERC1155.interface } );
    console.log("Contract TokenManagerERC1155 deployed to", tokenManagerERC1155.address);

    console.log("Deploy TokenManagerERC721WithMetadata");
    const tokenManagerERC721WithMetadataFactory = await ethers.getContractFactory("TokenManagerERC721WithMetadata", signerWithFixedGasEstimation);
    const tokenManagerERC721WithMetadata = await upgrades.deployProxy(tokenManagerERC721WithMetadataFactory, [
        schainName,
        messageProxy.address,
        tokenManagerLinker.address,
        communityLocker.address,
        depositBoxERC721WithMetadataAddress
    ]) as TokenManagerERC721WithMetadata;
    await tokenManagerERC721WithMetadata.deployTransaction.wait();
    deployed.set( "TokenManagerERC721WithMetadata", { address: tokenManagerERC721WithMetadata.address, interface: tokenManagerERC721WithMetadata.interface } );
    console.log("Contract TokenManagerERC721WithMetadata deployed to", tokenManagerERC721WithMetadata.address);

    console.log("Register token managers");
    await (await tokenManagerLinker.registerTokenManager(tokenManagerEth.address)).wait();
    await (await tokenManagerLinker.registerTokenManager(tokenManagerERC20.address)).wait();
    await (await tokenManagerLinker.registerTokenManager(tokenManagerERC721.address)).wait();
    await (await tokenManagerLinker.registerTokenManager(tokenManagerERC1155.address)).wait();
    await (await tokenManagerLinker.registerTokenManager(tokenManagerERC721WithMetadata.address)).wait();

    console.log("Deploy EthErc20");
    const ethERC20Factory = await ethers.getContractFactory("EthErc20");
    const ethERC20 = await upgrades.deployProxy(ethERC20Factory, [ tokenManagerEth.address ]) as EthErc20;
    await ethERC20.deployTransaction.wait();
    deployed.set( "EthErc20", { address: ethERC20.address, interface: ethERC20.interface } );
    console.log("Contract EthErc20 deployed to", ethERC20.address);

    console.log( "\nWill set dependencies!\n" );

    await tokenManagerEth.setEthErc20Address( ethERC20.address );
    console.log( "Set EthErc20 address", ethERC20.address, "in TokenManagerEth", tokenManagerEth.address, "completed!\n" );

    const chainConnectorRole = await messageProxy.CHAIN_CONNECTOR_ROLE();
    await messageProxy.grantRole( chainConnectorRole, tokenManagerLinker.address );
    console.log( "Grant CHAIN_CONNECTOR_ROLE to TokenManagerLinker", tokenManagerLinker.address, "in MessageProxyForSchain", messageProxy.address, "completed!\n" );
    const constantSetterRole = await communityLocker.CONSTANT_SETTER_ROLE();
    await communityLocker.grantRole(constantSetterRole, owner.address);
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
    await messageProxy.grantRole(extraContractRegistrarRole, owner.address);
    for (const extraContract of extraContracts) {
        await messageProxy.registerExtraContractForAll(extraContract.address)
        console.log("Contract with address ", extraContract.address, "registered as extra contract");
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
    const proxyAdmin = await getManifestAdmin(hre);
    jsonObjectABI.proxy_admin_address = proxyAdmin.address;
    jsonObjectABI.proxy_admin_abi = getAbi(proxyAdmin.interface);

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
