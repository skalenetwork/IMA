import { contracts, getContractKeyInAbiFile } from "./deploySchain";
import { ethers, network, upgrades } from "hardhat";
import { promises as fs } from "fs";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { getAbi } from "./tools/abi";
import { encodeTransaction } from "./tools/multiSend";
import { createMultiSendTransaction, sendSafeTransaction } from "./tools/gnosis-safe";
import chalk from "chalk";
import { getVersion } from "./tools/version";
import { SafeMock } from "../typechain";

type DeploymentAction = (safeTransactions: string[], abi: any) => Promise<void>;

export async function upgrade(
    targetVersion: string,
    contractNamesToUpgrade: string[],
    deployNewContracts: DeploymentAction,
    initialize: DeploymentAction)
{
    if (!process.env.ABI) {
        console.log(chalk.red("Set path to file with ABI and addresses to ABI environment variables"));
        return;
    }

    const abiFilename = process.env.ABI;
    const abi = JSON.parse(await fs.readFile(abiFilename, "utf-8"));

    const [ deployer ] = await ethers.getSigners();

    const proxyAdminAddress = abi[getContractKeyInAbiFile("ProxyAdmin") + "_address"];
    const proxyAdminAbi = abi[getContractKeyInAbiFile("ProxyAdmin") + "_abi"];
    const proxyAdmin = new ethers.Contract(proxyAdminAddress, proxyAdminAbi, deployer);
    const version = await getVersion();

    const adminOwner = await proxyAdmin.owner();
    const safeTransactions: string[] = [];
    let safeMock;

    if (adminOwner !== deployer.address) {
        if (await ethers.provider.getCode(adminOwner) === "0x") {
            console.log(chalk.red(`Admin owner is ${adminOwner} not the same as deployer ${deployer.address}`));
            return;
        } else {
            console.log(chalk.red(`Admin owner is ${adminOwner} is a contract`));
            console.log(chalk.red("If it is a SafeMock please transferOwnership to the deployer"));
            console.log(chalk.red("By running script transferOwnership.ts"));
            console.log(chalk.red("Gnosis multisig and Marionette currently unavailable"));
            return;
        }
    }

    console.log(chalk.blue("Deploy SafeMock to simulate upgrade via multisig"));
    const safeMockFactory = await ethers.getContractFactory("SafeMock");
    safeMock = (await safeMockFactory.deploy()) as SafeMock;
    await safeMock.deployTransaction.wait();
    await (await proxyAdmin.transferOwnership(safeMock.address)).wait();

    // Deploy new contracts
    await deployNewContracts(safeTransactions, abi);

    // deploy new implementations
    const contractsToUpgrade: {proxyAddress: string, implementationAddress: string, name: string, abi: any}[] = [];

    for (const contract of contractNamesToUpgrade) {
        const contractFactory = await ethers.getContractFactory(contract);
        const _contract = contract;
        const proxyAddress = abi[getContractKeyInAbiFile(_contract) + "_address"];

        console.log(`Prepare upgrade of ${contract}`);
        const newImplementationAddress = await upgrades.prepareUpgrade(proxyAddress, contractFactory, { unsafeAllowLinkedLibraries: true });
        const currentImplementationAddress = await getImplementationAddress(network.provider, proxyAddress);
        if (newImplementationAddress !== currentImplementationAddress)
        {
            contractsToUpgrade.push({
                proxyAddress,
                implementationAddress: newImplementationAddress,
                name: contract,
                abi: getAbi(contractFactory.interface)
            });
        } else {
            console.log(chalk.gray(`Contract ${contract} is up to date`));
        }
    }

    // Switch proxies to new implementations
    for (const contract of contractsToUpgrade) {
        console.log(chalk.yellowBright(`Prepare transaction to upgrade ${contract.name} at ${contract.proxyAddress} to ${contract.implementationAddress}`));
        // await proxyAdmin.connect(deployer).upgrade(contract.proxyAddress, contract.implementationAddress);
        safeTransactions.push(encodeTransaction(
            0,
            proxyAdmin.address,
            0,
            proxyAdmin.interface.encodeFunctionData("upgrade", [contract.proxyAddress, contract.implementationAddress])));
        abi[getContractKeyInAbiFile(contract.name) + "_abi"] = contract.abi;
    }

    await initialize(safeTransactions, abi);

    await fs.writeFile(`data/transactions-${version}-${network.name}.json`, JSON.stringify(safeTransactions, null, 4));

    let privateKey = (network.config.accounts as string[])[0];
    if (network.config.accounts === "remote") {
        // Don't have an information about private key
        // Use random one because we most probable run tests
        privateKey = ethers.Wallet.createRandom().privateKey;
    }

    const safeTx = await createMultiSendTransaction(ethers, safeMock.address, privateKey, safeTransactions);

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

    await fs.writeFile(`data/proxySchain-${version}-${network.name}-abi.json`, JSON.stringify(abi, null, 4));

    console.log("Done");
}

async function main() {
    await upgrade(
        "1.0.0",
        contracts,
        async (safeTransactions, abi) => undefined,
        async (safeTransactions, abi) => undefined
    );
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
