import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, DepositBoxERC721 } from "../../../../typechain";

export async function deployDepositBoxERC721(
    contractManager: ContractManager,
    messageProxy: MessageProxyForMainnet,
    linker: Linker

) {
    const factory = await ethers.getContractFactory("DepositBoxERC721");
    const instance = await factory.deploy() as DepositBoxERC721;
    await instance["initialize(address,address,address)"](contractManager.address, linker.address, messageProxy.address);
    await linker.registerDepositBox(instance.address);
    return instance;
}