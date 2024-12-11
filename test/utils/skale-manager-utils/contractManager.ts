import { ethers } from "hardhat";
import { ContractManager, KeyStorageMock, Nodes, Schains, SchainsInternal, SkaleVerifierMock, Wallets } from "../../../typechain";

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
        instance = contractManagerFactory.attach(contractManagerAddress) as ContractManager;
    }
    try {
        await instance.getContract("KeyStorage");
    } catch {
        const keyStorageInstance = await (await ethers.getContractFactory("KeyStorageMock")).deploy() as KeyStorageMock;
        await instance.setContractsAddress("KeyStorage", keyStorageInstance);
    }
    try {
        await instance.getContract(nameNodes);
    } catch {
        const nodesInstance = await (await ethers.getContractFactory(nameNodes)).deploy() as Nodes;
        await instance.setContractsAddress(nameNodes, nodesInstance);
    }
    try {
        await instance.getContract(nameSchains);
    } catch {
        const schainsInstance = await (await ethers.getContractFactory(nameSchains)).deploy() as Schains;
        await schainsInstance.addContractManager(instance);
        await instance.setContractsAddress(nameSchains, schainsInstance);
    }
    try {
        await instance.getContract(nameSchainsInternal);
    } catch {
        const schainsInternalInstance = await (await ethers.getContractFactory(nameSchainsInternal)).deploy() as SchainsInternal;
        await schainsInternalInstance.addContractManager(instance);
        await instance.setContractsAddress(nameSchainsInternal, schainsInternalInstance);
    }
    try {
        await instance.getContract(nameSkaleVerifier);
    } catch {
        const skaleVerifierInstance = await (await ethers.getContractFactory(nameSkaleVerifier)).deploy() as SkaleVerifierMock;
        await instance.setContractsAddress("SkaleVerifier", skaleVerifierInstance);
    }
    try {
        await instance.getContract(nameWallets);
     } catch {
        const walletsInstance = await (await ethers.getContractFactory(nameWallets)).deploy() as Wallets;
        await walletsInstance.addContractManager(instance);
        await instance.setContractsAddress(nameWallets, walletsInstance);
    }
    return instance;
}
