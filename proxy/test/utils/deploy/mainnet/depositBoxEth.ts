import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, DepositBoxEth } from "../../../../typechain";

export async function deployDepositBoxEth(
    contractManager: ContractManager,
    messageProxy: MessageProxyForMainnet,
    linker: Linker

) {
    const factory = await ethers.getContractFactory("DepositBoxEth");
    const instance = await factory.deploy() as DepositBoxEth;
    await instance["initialize(address,address,address)"](contractManager.address, linker.address, messageProxy.address);
    await linker.registerDepositBox(instance.address);
    return instance;
}