import { ContractManagerContract, ContractManagerInstance } from "../../../types/truffle-contracts";
import { KeyStorageContract } from "../../../types/truffle-contracts";
import { NodesContract } from "../../../types/truffle-contracts";
import { SchainsContract } from "../../../types/truffle-contracts";
import { SchainsInternalContract } from "../../../types/truffle-contracts";
import { SkaleVerifierContract } from "../../../types/truffle-contracts";
import { WalletsContract } from "../../../types/truffle-contracts";

const contractManager: ContractManagerContract = artifacts.require("./ContractManager");
const keyStorage: KeyStorageContract = artifacts.require("./KeyStorage");
const nodes: NodesContract = artifacts.require("./Nodes");
const schains: SchainsContract = artifacts.require("./Schains");
const schainsInternal: SchainsInternalContract = artifacts.require("./SchainsInternal");
const skaleVerifier: SkaleVerifierContract = artifacts.require("./SkaleVerifier");
const wallets: WalletsContract = artifacts.require("./Wallets");
const nameKeyStorage = "KeyStorage";
const nameNodes = "Nodes";
const nameSchains = "Schains";
const nameSchainsInternal = "SchainsInternal";
const nameSkaleVerifier = "SkaleVerifier";
const nameWallets = "Wallets";

export async function deployContractManager(contractManagerAddress: string) {
    let instance: ContractManagerInstance;
    if (contractManagerAddress === "0x0000000000000000000000000000000000000000") {
        instance = await contractManager.new();
    } else {
        instance = contractManager.at(contractManagerAddress);
    }
    if (await instance.getContract(nameKeyStorage) === "0x0000000000000000000000000000000000000000") {
        const keyStorageInstance = await keyStorage.new();
        await instance.setContractsAddress(nameKeyStorage, keyStorageInstance.address);
    } else if (await instance.getContract(nameNodes) === "0x0000000000000000000000000000000000000000") {
        const nodesInstance = await nodes.new();
        await instance.setContractsAddress(nameNodes, nodesInstance.address);
    } else if (await instance.getContract(nameSchains) === "0x0000000000000000000000000000000000000000") {
        const schainsInstance = await schains.new();
        await instance.setContractsAddress(nameSchains, schainsInstance.address);
    } else if (await instance.getContract(nameSchainsInternal) === "0x0000000000000000000000000000000000000000") {
        const schainsInternalInstance = await schainsInternal.new();
        await instance.setContractsAddress(nameSchainsInternal, schainsInternalInstance.address);
    } else if (await instance.getContract(nameSkaleVerifier) === "0x0000000000000000000000000000000000000000") {
        const skaleVerifierInstance = await skaleVerifier.new();
        await instance.setContractsAddress(nameSkaleVerifier, skaleVerifierInstance.address);
    } else if (await instance.getContract(nameWallets) === "0x0000000000000000000000000000000000000000") {
        const walletsInstance = await wallets.new();
        await instance.setContractsAddress(nameWallets, walletsInstance.address);
    }
    return instance;
}
