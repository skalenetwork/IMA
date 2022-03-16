import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, DepositBoxERC721WithMetadata } from "../../../../typechain";

export async function deployDepositBoxERC721WithMetadata(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnet

) {
    const factory = await ethers.getContractFactory("DepositBoxERC721WithMetadata");
    const instance = await factory.deploy() as DepositBoxERC721WithMetadata;
    await instance["initialize(address,address,address)"](contractManager.address, linker.address, messageProxy.address);
    await linker.registerMainnetContract(instance.address);
    return instance;
}