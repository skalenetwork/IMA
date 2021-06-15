import { ethers } from "hardhat";
import { MessageProxyForMainnet, Linker, ContractManager } from "../../../../typechain";

export async function deployLinker(
    contractManager: ContractManager,
    messageProxy: MessageProxyForMainnet
) {
    const factory = await ethers.getContractFactory("Linker");
    const instance = await factory.deploy() as Linker;
    await instance["initialize(address,address)"](contractManager.address, messageProxy.address);
    await instance.registerMainnetContract(instance.address);
    return instance;
}