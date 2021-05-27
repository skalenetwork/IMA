import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, DepositBoxERC1155 } from "../../../../typechain";

export async function deployDepositBoxERC1155(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnet

) {
    const factory = await ethers.getContractFactory("DepositBoxERC1155");
    const instance = await factory.deploy() as DepositBoxERC1155;
    await instance["initialize(address,address,address)"](contractManager.address, linker.address, messageProxy.address);
    await linker.registerMainnetContract(instance.address);
    return instance;
}