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
import { ethers, upgrades, network, run, artifacts } from "hardhat";
import { MessageProxyForMainnet, IMALinker } from "../typechain";
import { deployLibraries, getLinkedContractFactory } from "../test/tools/deploy/factory";
import { getAbi } from './tools/abi';
import { verify, verifyProxy } from './tools/verification';
import { Manifest, hashBytecode } from "@openzeppelin/upgrades-core";

const jsonData = require( "../data/skaleManagerComponents.json" );

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

export const contracts = [
    // "MessageProxyForMainnet", // it will be deployed explicitly
    // "IMALinker", // it will be deployed explicitly

    "DepositBoxEth",
    "DepositBoxERC20",
    "DepositBoxERC721"
]

async function main() {
    const [ owner,] = await ethers.getSigners();
    // if (await ethers.provider.getCode("0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24") === "0x") {
    //     await run("erc1820");
    // }

    // let production = false;

    // if (process.env.PRODUCTION === "true") {
    //     production = true;
    // } else if (process.env.PRODUCTION === "false") {
    //     production = false;
    // }

    // if (!production) {
    //     contracts.push("TimeHelpersWithDebug");
    // }

    // const version = await getVersion();
    let deployed = new Map<string, {address: string, interface: Interface, contract: string}>();
    const contractArtifacts: {address: string, interface: Interface, contract: string}[] = [];

    const messageProxyForMainnetName = "MessageProxyForMainnet";
    console.log("Deploy", messageProxyForMainnetName);
    const messageProxyForMainnetFactory = await ethers.getContractFactory(messageProxyForMainnetName);
    const messageProxyForMainnet = (await upgrades.deployProxy(messageProxyForMainnetFactory, [jsonData.contract_manager_address])) as MessageProxyForMainnet;
    await messageProxyForMainnet.deployTransaction.wait();
    deployed.set(messageProxyForMainnetName, {address: messageProxyForMainnet.address, interface: messageProxyForMainnet.interface, contract: messageProxyForMainnetName})
    contractArtifacts.push({address: messageProxyForMainnet.address, interface: messageProxyForMainnet.interface, contract: messageProxyForMainnetName})
    await verifyProxy(messageProxyForMainnetName, messageProxyForMainnet.address);

    const imaLinkerName = "IMALinker";
    console.log("Deploy", imaLinkerName);
    const imaLinkerFactory = await ethers.getContractFactory(imaLinkerName);
    const imaLinker = (await upgrades.deployProxy(imaLinkerFactory, [jsonData.contract_manager_address, deployed.get(messageProxyForMainnetName)?.address])) as IMALinker;
    await imaLinker.deployTransaction.wait();
    deployed.set(imaLinkerName, {address: imaLinker.address, interface: imaLinker.interface, contract: imaLinkerName});
    contractArtifacts.push({address: imaLinker.address, interface: imaLinker.interface, contract: imaLinkerName})
    await verifyProxy(imaLinkerName, imaLinker.address);

    for (const contract of contracts) {
        const contractFactory = await getContractFactory(contract);
        console.log("Deploy", contract);
        const proxy = await upgrades.deployProxy(
            contractFactory,
            [
                jsonData.contract_manager_address,
                deployed.get(messageProxyForMainnetName)?.address,
                deployed.get(imaLinkerName)?.address
            ]
        );
        await proxy.deployTransaction.wait();
        const contractName = contract;
        console.log("Register", contract, "as", contractName, "=>", proxy.address);
        const transaction = await imaLinker.registerDepositBox(proxy.address);
        await transaction.wait();
        console.log( "Contract", contractName, "with address", proxy.address, "is registered as DepositBox in IMALinker" );
        deployed.set(contractName, {address: proxy.address, interface: proxy.interface, contract});
        contractArtifacts.push({address: proxy.address, interface: proxy.interface, contract});
        await verifyProxy(contract, proxy.address);
    }

    // const skaleTokenName = "SkaleToken";
    // console.log("Deploy", skaleTokenName);
    // const skaleTokenFactory = await ethers.getContractFactory(skaleTokenName);
    // const skaleToken = await skaleTokenFactory.deploy(contractManager.address, []);
    // await skaleToken.deployTransaction.wait();
    // console.log("Register", skaleTokenName);
    // await (await contractManager.setContractsAddress(skaleTokenName, skaleToken.address)).wait();
    // contractArtifacts.push({address: skaleToken.address, interface: skaleToken.interface, contract: skaleTokenName});
    // await verify(skaleTokenName, skaleToken.address);

    // if (!production) {
    //     console.log("Do actions for non production deployment");
    //     const money = "5000000000000000000000000000"; // 5e9 * 1e18
    //     await skaleToken.mint(owner.address, money, "0x", "0x");
    // }

    console.log("Store ABIs");

    const outputObject: {[k: string]: any} = {};
    for (const artifact of contractArtifacts) {
        const contractKey = getContractKeyInAbiFile(artifact.contract);
        outputObject[contractKey + "_address"] = artifact.address;
        outputObject[contractKey + "_abi"] = getAbi(artifact.interface);
    }

    await fs.writeFile("data/proxyMainnet.json", JSON.stringify(outputObject, null, 4));

    // if( jsonData.contract_manager_address !== null && jsonData.contract_manager_address !== "" && jsonData.contract_manager_address !== "0x0000000000000000000000000000000000000000" ) {
    //     // register MessageProxy in ContractManager
    //     if( jsonData.contract_manager_abi !== "" && jsonData.contract_manager_abi !== undefined ) {
    //         if( configFile.networks[networkName].host !== "" && configFile.networks[networkName].host !== undefined && configFile.networks[networkName].port !== "" && configFile.networks[networkName].port !== undefined ) {
    //             const web3 = new Web3( new Web3.providers.HttpProvider( "http://" + configFile.networks[networkName].host + ":" + configFile.networks[networkName].port ) );
    //             if( await web3.eth.getCode( jsonData.contract_manager_address ) !== "0x" ) {
    //                 const contractManager = new web3.eth.Contract( jsonData.contract_manager_abi, jsonData.contract_manager_address );
    //                 const methodRegister = await contractManager.methods.setContractsAddress( "MessageProxyForMainnet", deployed.get( "MessageProxyForMainnet" ).address ).encodeABI();
    //                 const ownerAddress = await contractManager.methods.owner().call();
    //                 if( await web3.utils.toChecksumAddress( ownerAddress ) !== await web3.utils.toChecksumAddress( deployAccount ) )
    //                     console.log( "Owner of ContractManager is not the same of the deployer" );
    //                 else {
    //                     try {
    //                         await web3.eth.sendTransaction( { from: deployAccount, to: jsonData.contract_manager_address, data: methodRegister } );
    //                         console.log( "Successfully registered MessageProxy in ContractManager" );
    //                     } catch ( error ) {
    //                         console.log( "Registration of MessageProxy is failed on ContractManager. Please redo it by yourself!\nError:", error );
    //                     }
    //                 }
    //             } else
    //                 console.log( "Contract Manager address is not a contract" );

    //         } else if( configFile.networks[networkName].provider !== "" && configFile.networks[networkName].provider !== undefined ) {
    //             const web3 = new Web3( configFile.networks[networkName].provider() );
    //             if( await web3.eth.getCode( jsonData.contract_manager_address ) !== "0x" ) {
    //                 const contractManager = new web3.eth.Contract( jsonData.contract_manager_abi, jsonData.contract_manager_address );
    //                 const methodRegister = await contractManager.methods.setContractsAddress( "MessageProxyForMainnet", deployed.get( "MessageProxyForMainnet" ).address ).encodeABI();
    //                 const ownerAddress = await contractManager.methods.owner().call();
    //                 if( await web3.utils.toChecksumAddress( ownerAddress ) !== await web3.utils.toChecksumAddress( deployAccount ) )
    //                     console.log( "Owner of ContractManager is not the same of the deployer" );
    //                 else {
    //                     try {
    //                         const nonceNumber = await web3.eth.getTransactionCount( deployAccount );
    //                         const tx = {
    //                             nonce: nonceNumber,
    //                             from: deployAccount,
    //                             to: jsonData.contract_manager_address,
    //                             gas: "150000",
    //                             data: methodRegister
    //                         };
    //                         const privateKey = process.env.PRIVATE_KEY_FOR_ETHEREUM;
    //                         const signedTx = await web3.eth.signTransaction( tx, "0x" + privateKey );
    //                         await web3.eth.sendSignedTransaction( signedTx.raw || signedTx.rawTransaction );
    //                         console.log( "Successfully registered MessageProxy in ContractManager" );
    //                     } catch ( error ) {
    //                         console.log( "Registration of MessageProxy is failed on ContractManager. Please redo it by yourself!\nError:", error );
    //                     }
    //                 }
    //             } else
    //                 console.log( "Contract Manager address is not a contract" );

    //         } else
    //             console.log( "Unknown type of network" );

    //     } else
    //         console.log( "Please provide an abi of ContractManager" );

    // }

    // console.log( "Registration is completed!" );

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
