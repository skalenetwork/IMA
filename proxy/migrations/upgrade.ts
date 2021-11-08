import { ethers, network, upgrades, artifacts } from "hardhat";
import hre from "hardhat";
import { promises as fs } from "fs";
import { getImplementationAddress, hashBytecode, Manifest } from "@openzeppelin/upgrades-core";
import { deployLibraries, getLinkedContractFactory } from "./tools/factory";
import { getAbi } from "./tools/abi";
import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import { SafeMock } from "../typechain/SafeMock";
import { encodeTransaction } from "./tools/multiSend";
import { createMultiSendTransaction, sendSafeTransaction } from "./tools/gnosis-safe";
import chalk from "chalk";
import { verify } from "./tools/verification";
import { MessageProxy } from "../typechain";

function getContractKeyInAbiFile(contract: string) {
    if (contract === "MessageProxyForMainnet") {
        return "message_proxy_mainnet";
    } else if (contract === "MessageProxyForSchain") {
        return "message_proxy_chain";
    }
    return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
}

async function getManifestFile(): Promise<string> {
    return (await Manifest.forNetwork(ethers.provider)).file;;
}

export async function getContractFactoryAndUpdateManifest(contract: string) {
    const manifest = JSON.parse(await fs.readFile(await getManifestFile(), "utf-8"));
    const { linkReferences } = await artifacts.readArtifact(contract);
    if (!Object.keys(linkReferences).length)
        return await ethers.getContractFactory(contract);

    const librariesToUpgrade = [];
    const oldLibraries: {[k: string]: string} = {};
    if (manifest.libraries === undefined) {
        Object.assign(manifest, {libraries: {}});
    }
    for (const key of Object.keys(linkReferences)) {
        const libraryName = Object.keys(linkReferences[key])[0];
        const { bytecode } = await artifacts.readArtifact(libraryName);
        if (manifest.libraries[libraryName] === undefined) {
            librariesToUpgrade.push(libraryName);
            continue;
        }
        const libraryBytecodeHash = manifest.libraries[libraryName].bytecodeHash;
        if (hashBytecode(bytecode) !== libraryBytecodeHash) {
            librariesToUpgrade.push(libraryName);
        } else {
            oldLibraries[libraryName] = manifest.libraries[libraryName].address;
        }
    }
    const libraries = await deployLibraries(librariesToUpgrade);
    for (const libraryName of Object.keys(libraries)) {
        const { bytecode } = await artifacts.readArtifact(libraryName);
        manifest.libraries[libraryName] = {"address": libraries[libraryName], "bytecodeHash": hashBytecode(bytecode)};
    }
    Object.assign(libraries, oldLibraries);
    await fs.writeFile(await getManifestFile(), JSON.stringify(manifest, null, 4));
    return await getLinkedContractFactory(contract, libraries);
}

async function checkDeployedVersion(version: string, targetVersion: string, messageProxy: MessageProxy) {
    let deployedVersion = "";
    try {
        deployedVersion = await messageProxy.version();
    } catch {
        console.log("Can't read deployed version");
    };

    if (deployedVersion) {
        if (deployedVersion !== targetVersion) {
            console.log(chalk.red(`This script can't upgrade version ${deployedVersion} to ${version}`));
            process.exit(1);
        }
    } else {
        console.log(chalk.yellow("Can't check currently deployed version of skale-manager"));
    }
    console.log(`Will mark updated version as ${version}`);
}

async function getMessageProxyName(fileName: string) {
    if (fileName === "proxyMainnet") {
        return "MessageProxyForMainnet";
    } else if (fileName === "proxySchain") {
        return "MessageProxyForSchain";
    }
    console.log(chalk.red("Invalid filename"));
    process.exit(1);
}

async function getMessageProxyInstance(fileName: string, abi: any) : Promise<MessageProxy> {
    const messageProxyName = await getMessageProxyName(fileName);
    const messageProxyFactory = await ethers.getContractFactory(messageProxyName);
    const messageProxy = (messageProxyFactory.attach(abi[getContractKeyInAbiFile(messageProxyName) + "_address"])) as MessageProxy;
    return messageProxy;
}

type DeploymentAction = (safeTransactions: string[], abi: any) => Promise<void>;

export async function upgrade(
    targetVersion: string,
    contractNamesToUpgrade: string[],
    deployNewContracts: DeploymentAction,
    initialize: DeploymentAction,
    getVersion: () => Promise<string>,
    fileName: string)
{
    if (!process.env.ABI) {
        console.log(chalk.red("Set path to file with ABI and addresses to ABI environment variables"));
        return;
    }

    const abiFilename = process.env.ABI;
    const abi = JSON.parse(await fs.readFile(abiFilename, "utf-8"));

    const proxyAdmin = await getManifestAdmin(hre);
    const version = await getVersion();
    const messageProxy = await getMessageProxyInstance(fileName, abi);
    await checkDeployedVersion(version, targetVersion, messageProxy);

    const [ deployer ] = await ethers.getSigners();
    let safe = await proxyAdmin.owner();
    const safeTransactions: string[] = [];
    let safeMock;
    if (await ethers.provider.getCode(safe) === "0x") {
        console.log("Owner is not a contract");
        if (deployer.address !== safe) {
            console.log(chalk.red("Used address does not have permissions to upgrade skale-manager"));
            process.exit(1);
        }
        console.log(chalk.blue("Deploy SafeMock to simulate upgrade via multisig"));
        const safeMockFactory = await ethers.getContractFactory("SafeMock");
        safeMock = (await safeMockFactory.deploy()) as SafeMock;
        await safeMock.deployTransaction.wait();

        console.log(chalk.blue("Transfer ownership to SafeMock"));
        safe = safeMock.address;
        await (await proxyAdmin.transferOwnership(safe)).wait();
        for (const contractName of contractNamesToUpgrade) {
            const contractFactory = await getContractFactoryAndUpdateManifest(contractName);
            const _contract = contractName;
            const contractAddress = abi[getContractKeyInAbiFile(_contract) + "_address"];
            const contract = contractFactory.attach(contractAddress);
            console.log(chalk.blue(`Grant access to ${contractName}`));
            await (await contract.grantRole(await contract.DEFAULT_ADMIN_ROLE(), safe)).wait();
        }
    }

    // Deploy new contracts
    await deployNewContracts(safeTransactions, abi);

    // deploy new implementations
    const contractsToUpgrade: {proxyAddress: string, implementationAddress: string, name: string, abi: any}[] = [];
    for (const contract of contractNamesToUpgrade) {
        const contractFactory = await getContractFactoryAndUpdateManifest(contract);
        const _contract = contract;
        const proxyAddress = abi[getContractKeyInAbiFile(_contract) + "_address"];

        console.log(`Prepare upgrade of ${contract}`);
        const newImplementationAddress = await upgrades.prepareUpgrade(proxyAddress, contractFactory, { unsafeAllowRenames: true });
        const currentImplementationAddress = await getImplementationAddress(network.provider, proxyAddress);
        if (newImplementationAddress !== currentImplementationAddress)
        {
            contractsToUpgrade.push({
                proxyAddress,
                implementationAddress: newImplementationAddress,
                name: contract,
                abi: getAbi(contractFactory.interface)
            });
            await verify(contract, newImplementationAddress, []);
        } else {
            console.log(chalk.gray(`Contract ${contract} is up to date`));
        }
    }

    // Switch proxies to new implementations
    for (const contract of contractsToUpgrade) {
        console.log(chalk.yellowBright(`Prepare transaction to upgrade ${contract.name} at ${contract.proxyAddress} to ${contract.implementationAddress}`));
        safeTransactions.push(encodeTransaction(
            0,
            proxyAdmin.address,
            0,
            proxyAdmin.interface.encodeFunctionData("upgrade", [contract.proxyAddress, contract.implementationAddress])));
        abi[getContractKeyInAbiFile(contract.name) + "_abi"] = contract.abi;
    }

    await initialize(safeTransactions, abi);

    // write version
    if (safeMock) {
        console.log(chalk.blue("Grant access to set version"));
        await (await messageProxy.grantRole(await messageProxy.DEFAULT_ADMIN_ROLE(), safe)).wait();
    }
    safeTransactions.push(encodeTransaction(
        0,
        messageProxy.address,
        0,
        messageProxy.interface.encodeFunctionData("setVersion", [version]),
    ));

    await fs.writeFile(`data/transactions-${version}-${network.name}.json`, JSON.stringify(safeTransactions, null, 4));

    let privateKey = (network.config.accounts as string[])[0];
    if (network.config.accounts === "remote") {
        // Don't have an information about private key
        // Use random one because we most probable run tests
        privateKey = ethers.Wallet.createRandom().privateKey;
    }

    const safeTx = await createMultiSendTransaction(ethers, safe, privateKey, safeTransactions, safeMock !== undefined);
    if (!safeMock) {
        const chainId = (await ethers.provider.getNetwork()).chainId;
        await sendSafeTransaction(safe, chainId, safeTx);
    } else {
        console.log(chalk.blue("Send upgrade transactions to safe mock"));
        try {
            await (await deployer.sendTransaction({
                to: safeMock.address,
                value: safeTx.value,
                data: safeTx.data,
            })).wait();
        } finally {
            console.log(chalk.blue("Return ownership to wallet"));
            await (await safeMock.transferProxyAdminOwnership(proxyAdmin.address, deployer.address)).wait();
            if (await proxyAdmin.owner() === deployer.address) {
                await (await safeMock.destroy()).wait();
            } else {
                console.log(chalk.blue("Something went wrong with ownership transfer"));
                process.exit(1);
            }
        }
    }

    await fs.writeFile(`data/${fileName}-${version}-${network.name}-abi.json`, JSON.stringify(abi, null, 4));

    console.log("Done");
}
