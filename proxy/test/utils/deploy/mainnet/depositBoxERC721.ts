import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, DepositBoxERC721 } from "../../../../typechain";

export async function deployDepositBoxERC721(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnet

) {
    const factory = await ethers.getContractFactory("DepositBoxERC721");
    const instance = await factory.deploy() as DepositBoxERC721;
    await instance["initialize(address,address,address)"](contractManager.address, linker.address, messageProxy.address);
    await linker.registerMainnetContract(instance.address);
    return instance;
}