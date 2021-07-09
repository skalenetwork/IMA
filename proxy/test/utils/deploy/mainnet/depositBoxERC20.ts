import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, DepositBoxERC20 } from "../../../../typechain";

export async function deployDepositBoxERC20(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnet

) {
    const factory = await ethers.getContractFactory("DepositBoxERC20");
    const instance = await factory.deploy() as DepositBoxERC20;
    await instance["initialize(address,address,address)"](contractManager.address, linker.address, messageProxy.address);
    await linker.registerMainnetContract(instance.address);
    return instance;
}