import { ethers, upgrades } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, DepositBoxERC721 } from "../../../../typechain";

export async function deployDepositBoxERC721(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnet

) {
    const factory = await ethers.getContractFactory("DepositBoxERC721");
    const instance = await upgrades.deployProxy(
        factory,
        [contractManager.address, linker.address, messageProxy.address],
        {"initializer": "initialize(address,address,address)"}
    ) as DepositBoxERC721;
    await linker.registerMainnetContract(instance.address);
    return instance;
}