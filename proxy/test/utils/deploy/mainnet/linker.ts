import { ethers } from "hardhat";
import { MessageProxyForMainnet, Linker, ContractManager } from "../../../../typechain";

export async function deployLinker(
    messageProxy: MessageProxyForMainnet,
    contractManager: ContractManager
) {
    const factory = await ethers.getContractFactory("Linker");
    const instance = await factory.deploy() as Linker;
    await instance["initialize(address,address)"](messageProxy.address, contractManager.address);
    return instance;
}