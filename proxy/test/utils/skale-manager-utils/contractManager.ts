import { Wallet } from "@ethersproject/wallet";
import { ethers } from "hardhat";
import { ContractManager, KeyStorageMock, Nodes, Schains, SchainsInternal, SkaleVerifierMock, Wallets } from "../../../typechain";

// const contractManager: ContractManagerContract = artifacts.require("./ContractManager");
// const keyStorage: KeyStorageContract = artifacts.require("./KeyStorage");
// const nodes: NodesContract = artifacts.require("./Nodes");
// const schains: SchainsContract = artifacts.require("./Schains");
// const schainsInternal: SchainsInternalContract = artifacts.require("./SchainsInternal");
// const skaleVerifier: SkaleVerifierMockContract = artifacts.require("./SkaleVerifierMock");
// const wallets: WalletsContract = artifacts.require("./Wallets");
const nameNodes = "Nodes";
const nameSchains = "Schains";
const nameSchainsInternal = "SchainsInternal";
const nameSkaleVerifier = "SkaleVerifierMock";
const nameWallets = "Wallets";

export async function deployContractManager(contractManagerAddress: string) {
    const contractManagerFactory = await ethers.getContractFactory("ContractManager");
    let instance: ContractManager;
    if (contractManagerAddress === "0x0000000000000000000000000000000000000000") {
        instance = await contractManagerFactory.deploy() as ContractManager;
    } else {
        instance = await contractManagerFactory.attach(contractManagerAddress) as ContractManager;
    }
    if (await instance.getContract("KeyStorage") === "0x0000000000000000000000000000000000000000") {
        const keyStorageInstance = await (await ethers.getContractFactory("KeyStorageMock")).deploy() as KeyStorageMock;
        await instance.setContractsAddress("KeyStorage", keyStorageInstance.address);
    }
    if (await instance.getContract(nameNodes) === "0x0000000000000000000000000000000000000000") {
        const nodesInstance = await (await ethers.getContractFactory(nameNodes)).deploy() as Nodes;
        await instance.setContractsAddress(nameNodes, nodesInstance.address);
    }
    if (await instance.getContract(nameSchains) === "0x0000000000000000000000000000000000000000") {
        const schainsInstance = await (await ethers.getContractFactory(nameSchains)).deploy() as Schains;
        await schainsInstance.addContractManager(instance.address);
        await instance.setContractsAddress(nameSchains, schainsInstance.address);
    }
    if (await instance.getContract(nameSchainsInternal) === "0x0000000000000000000000000000000000000000") {
        const schainsInternalInstance = await (await ethers.getContractFactory(nameSchainsInternal)).deploy() as SchainsInternal;
        await instance.setContractsAddress(nameSchainsInternal, schainsInternalInstance.address);
    }
    if (await instance.getContract(nameSkaleVerifier) === "0x0000000000000000000000000000000000000000") {
        const skaleVerifierInstance = await (await ethers.getContractFactory(nameSkaleVerifier)).deploy() as SkaleVerifierMock;
        await instance.setContractsAddress("SkaleVerifier", skaleVerifierInstance.address);
    }
    if (await instance.getContract(nameWallets) === "0x0000000000000000000000000000000000000000") {
        const walletsInstance = await (await ethers.getContractFactory(nameWallets)).deploy() as Wallets;
        await walletsInstance.addContractManager(instance.address);
        await instance.setContractsAddress(nameWallets, walletsInstance.address);
    }
    return instance;
}
