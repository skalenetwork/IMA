import { ethers, upgrades } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, DepositBoxERC721WithMetadata } from "../../../../typechain";

export async function deployDepositBoxERC721WithMetadata(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnet

) {
    const factory = await ethers.getContractFactory("DepositBoxERC721WithMetadata");
    const instance = await upgrades.deployProxy(
        factory,
        [contractManager.address, linker.address, messageProxy.address],
        {"initializer": "initialize(address,address,address)"}
    ) as DepositBoxERC721WithMetadata;
    await linker.registerMainnetContract(instance.address);
    return instance;
}