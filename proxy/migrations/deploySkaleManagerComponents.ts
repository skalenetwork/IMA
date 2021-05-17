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
import { existsSync } from 'fs';
import { Interface } from "ethers/lib/utils";
import { ethers, upgrades, network, run, artifacts, web3 } from "hardhat";
import { MessageProxyForMainnet, Linker } from "../typechain";
import { deployLibraries, getLinkedContractFactory } from "./tools/factory";
import { getAbi } from './tools/abi';
import { verify, verifyProxy } from './tools/verification';
import { Manifest, hashBytecode } from "@openzeppelin/upgrades-core";

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


function getContractManager() {
    const defaultFilePath = "../data/skaleManagerComponents.json";
    const jsonData = require(defaultFilePath);
    try {
        const contractManagerAddress = jsonData.contract_manager_address;
        return contractManagerAddress;
    } catch (e) {
        console.log(e);
        process.exit( 126 );
    }
}

export const contracts = [
    // "MessageProxyForMainnet", // it will be deployed explicitly
    // "Linker", // it will be deployed explicitly

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
    const deployed = new Map<string, {address: string, interface: Interface}>();
    const contractArtifacts: {address: string, interface: Interface, contract: string}[] = [];

    console.log("Deploy ContractManager");
    const contractManagerFactory = await getContractFactory("ContractManager");
    const contractManager = await contractManagerFactory.deploy();
    deployed.set("ContractManager", { address: contractManager.address, interface: contractManager.interface } );
    console.log("Contract ContractManager deployed to", contractManager.address);

    console.log("Deploy Schains");
    const schainsFactory = await getContractFactory("Schains");
    const schains = await schainsFactory.deploy();
    deployed.set("Schains", { address: schains.address, interface: schains.interface } );
    console.log("Contract Schains deployed to", schains.address);

    console.log("Deploy SchainsInternal");
    const schainsInternalFactory = await getContractFactory("SchainsInternal");
    const schainsInternal = await schainsInternalFactory.deploy();
    deployed.set("SchainsInternal", { address: schainsInternal.address, interface: schainsInternal.interface } );
    console.log("Contract SchainsInternal deployed to", schainsInternal.address);

    console.log("Deploy Wallets");
    const walletsFactory = await getContractFactory("Wallets");
    const wallets = await walletsFactory.deploy();
    deployed.set("Wallets", { address: wallets.address, interface: wallets.interface } );
    console.log("Contract Wallets deployed to", wallets.address);

    console.log("Deploy SkaleVerifier");
    const skaleVerifierFactory = await getContractFactory("SkaleVerifier");
    const skaleVerifier = await skaleVerifierFactory.deploy();
    deployed.set("SkaleVerifier", { address: skaleVerifier.address, interface: skaleVerifier.interface } );
    console.log("Contract SkaleVerifier deployed to", skaleVerifier.address);

    console.log("Deploy KeyStorage");
    const keyStorageFactory = await getContractFactory("KeyStorage");
    const keyStorage = await keyStorageFactory.deploy();
    deployed.set("KeyStorage", { address: keyStorage.address, interface: keyStorage.interface } );
    console.log("Contract KeyStorage deployed to", keyStorage.address);

    console.log("Deploy Nodes");
    const nodesFactory = await getContractFactory("Nodes");
    const nodes = await nodesFactory.deploy();
    deployed.set("Nodes", { address: nodes.address, interface: nodes.interface } );
    console.log("Contract Nodes deployed to", nodes.address);

    console.log("Will set dependencies");

    await schains.addContractManager( contractManager.address );
    await wallets.addContractManager( contractManager.address );
    await contractManager.setContractsAddress( "Schains", schains.address );
    await contractManager.setContractsAddress( "SchainsInternal", schainsInternal.address );
    await contractManager.setContractsAddress( "Wallets", wallets.address );
    await contractManager.setContractsAddress( "SkaleVerifier", skaleVerifier.address );
    await contractManager.setContractsAddress( "KeyStorage", keyStorage.address );
    await contractManager.setContractsAddress( "Nodes", nodes.address );
    await schainsInternal.initializeSchain( schainName, owner.address, 1, 1 );
    await keyStorage.setCommonPublicKey( web3.utils.soliditySha3( schainName ), BLSPublicKey );
    await wallets.rechargeSchainWallet( web3.utils.soliditySha3( schainName ), { value: "1000000000000000000" } );
    
    

    const messageProxyForMainnetName = "MessageProxyForMainnet";
    console.log("Deploy", messageProxyForMainnetName);
    const messageProxyForMainnetFactory = await getContractFactory(messageProxyForMainnetName);
    const messageProxyForMainnet = (await upgrades.deployProxy(messageProxyForMainnetFactory, [contractManagerAddress], { initializer: 'initialize(address)' })) as MessageProxyForMainnet;
    await messageProxyForMainnet.deployTransaction.wait();
    console.log("Proxy Contract", messageProxyForMainnetName, "deployed to", messageProxyForMainnet.address);
    deployed.set(messageProxyForMainnetName, {address: messageProxyForMainnet.address, interface: messageProxyForMainnet.interface, contract: messageProxyForMainnetName})
    contractArtifacts.push({address: messageProxyForMainnet.address, interface: messageProxyForMainnet.interface, contract: messageProxyForMainnetName})
    await verifyProxy(messageProxyForMainnetName, messageProxyForMainnet.address);

    const linkerName = "Linker";
    console.log("Deploy", linkerName);
    const linkerFactory = await getContractFactory(linkerName);
    const linker = (await upgrades.deployProxy(linkerFactory, [deployed.get(messageProxyForMainnetName)?.address], { initializer: 'initialize(address)' })) as Linker;
    await linker.deployTransaction.wait();
    console.log("Proxy Contract", linkerName, "deployed to", linker.address);
    deployed.set(linkerName, {address: linker.address, interface: linker.interface, contract: linkerName});
    contractArtifacts.push({address: linker.address, interface: linker.interface, contract: linkerName})
    await verifyProxy(linkerName, linker.address);

    for (const contract of contracts) {
        const contractFactory = await getContractFactory(contract);
        console.log("Deploy", contract);
        const proxy = await upgrades.deployProxy(
            contractFactory,
            [
                contractManagerAddress,
                deployed.get(messageProxyForMainnetName)?.address,
                deployed.get(linkerName)?.address
            ],
            { initializer: 'initialize(address,address,address)' }
        );
        await proxy.deployTransaction.wait();
        const contractName = contract;
        console.log("Register", contract, "as", contractName, "=>", proxy.address);
        const transaction = await linker.registerDepositBox(proxy.address);
        await transaction.wait();
        console.log( "Contract", contractName, "with address", proxy.address, "is registered as DepositBox in Linker" );
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

    // if( contractManagerAddress !== null && contractManagerAddress !== "" && contractManagerAddress !== "0x0000000000000000000000000000000000000000" ) {
    //     // register MessageProxy in ContractManager
    //     if( jsonData.contract_manager_abi !== "" && jsonData.contract_manager_abi !== undefined ) {
    //         if( configFile.networks[networkName].host !== "" && configFile.networks[networkName].host !== undefined && configFile.networks[networkName].port !== "" && configFile.networks[networkName].port !== undefined ) {
    //             const web3 = new Web3( new Web3.providers.HttpProvider( "http://" + configFile.networks[networkName].host + ":" + configFile.networks[networkName].port ) );
    //             if( await web3.eth.getCode( contractManagerAddress ) !== "0x" ) {
    //                 const contractManager = new web3.eth.Contract( jsonData.contract_manager_abi, contractManagerAddress );
    //                 const methodRegister = await contractManager.methods.setContractsAddress( "MessageProxyForMainnet", deployed.get( "MessageProxyForMainnet" ).address ).encodeABI();
    //                 const ownerAddress = await contractManager.methods.owner().call();
    //                 if( await web3.utils.toChecksumAddress( ownerAddress ) !== await web3.utils.toChecksumAddress( deployAccount ) )
    //                     console.log( "Owner of ContractManager is not the same of the deployer" );
    //                 else {
    //                     try {
    //                         await web3.eth.sendTransaction( { from: deployAccount, to: contractManagerAddress, data: methodRegister } );
    //                         console.log( "Successfully registered MessageProxy in ContractManager" );
    //                     } catch ( error ) {
    //                         console.log( "Registration of MessageProxy is failed on ContractManager. Please redo it by yourself!\nError:", error );
    //                     }
    //                 }
    //             } else
    //                 console.log( "Contract Manager address is not a contract" );

    //         } else if( configFile.networks[networkName].provider !== "" && configFile.networks[networkName].provider !== undefined ) {
    //             const web3 = new Web3( configFile.networks[networkName].provider() );
    //             if( await web3.eth.getCode( contractManagerAddress ) !== "0x" ) {
    //                 const contractManager = new web3.eth.Contract( jsonData.contract_manager_abi, contractManagerAddress );
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
    //                             to: contractManagerAddress,
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
 * @file 3_migration_skale_manager_components.js
 * @copyright SKALE Labs 2019-Present
 */

const fs = require( "fs" );
const fsPromises = fs.promises;

const ContractManager = artifacts.require( "./ContractManager" );
const Schains = artifacts.require( "./Schains" );
const SchainsInternal = artifacts.require( "./SchainsInternal" );
const Wallets = artifacts.require( "./Wallets" );
const KeyStorage = artifacts.require( "./KeyStorage" );
const SkaleVerifierMock = artifacts.require( "./SkaleVerifierMock" );
const Nodes = artifacts.require( "./Nodes" );

const gasLimit = 8000000;

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

async function deploy( deployer, network ) {

    if( process.env.CHAIN_NAME_SCHAIN == undefined || process.env.CHAIN_NAME_SCHAIN == "" ) {
        console.log( network );
        console.log( networks.networks[network] );
        console.log( "Please set CHAIN_NAME_SCHAIN to .env file" );
        process.exit( 126 );
    }

    const schainName = process.env.CHAIN_NAME_SCHAIN;

    await deployer.deploy( ContractManager, { gas: gasLimit } ).then( async function( instCM ) {
        await deployer.deploy( Schains, { gas: gasLimit } ).then( async function( instSchains ) {
            await instSchains.addContractManager( ContractManager.address );
        } );
        instCM.setContractsAddress( "Schains", Schains.address );
        const schainsInternal = await deployer.deploy( SchainsInternal, { gas: gasLimit } );
        instCM.setContractsAddress( "SchainsInternal", SchainsInternal.address );
        const wallets = await deployer.deploy( Wallets, { gas: gasLimit } ).then( async function( instWallets ) {
            await instWallets.addContractManager( ContractManager.address );
            return instWallets;
        } ); ;
        instCM.setContractsAddress( "Wallets", Wallets.address );
        await deployer.deploy( SkaleVerifierMock, { gas: gasLimit } );
        instCM.setContractsAddress( "SkaleVerifier", SkaleVerifierMock.address );
        const keyStorage = await deployer.deploy( KeyStorage, { gas: gasLimit } );
        instCM.setContractsAddress( "KeyStorage", KeyStorage.address );
        await deployer.deploy( Nodes, { gas: gasLimit } );
        instCM.setContractsAddress( "Nodes", Nodes.address );

        // register test schain
        const deployerAddress = deployer.provider.addresses[0];
        await schainsInternal.initializeSchain( schainName, deployerAddress, 1, 1 );
        await keyStorage.setCommonPublicKey( web3.utils.soliditySha3( schainName ), BLSPublicKey );
        await wallets.rechargeSchainWallet( web3.utils.soliditySha3( schainName ), { value: "1000000000000000000" } );

        const jsonObject = {
            contract_manager_address: ContractManager.address,
            contract_manager_abi: ContractManager.abi,
            schains_internal_address: SchainsInternal.address,
            schains_internal_abi: SchainsInternal.abi,
            key_storage_address: KeyStorage.address,
            key_storage_abi: KeyStorage.abi,
            wallets_address: Wallets.address,
            wallets_abi: Wallets.abi
        };

        await fsPromises.writeFile( "data/skaleManagerComponents.json", JSON.stringify( jsonObject ) );
        await sleep( 10000 );
        console.log( "Done, check proxyMainnet file in data folder." );
    } );
}

function sleep( ms ) {
    return new Promise( resolve => setTimeout( resolve, ms ) );
}

module.exports = deploy;
