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
        [
            await contractManager.getAddress(),
            await linker.getAddress(),
            await messageProxy.getAddress()
        ],
        {"initializer": "initialize(address,address,address)"}
    ) as unknown as DepositBoxERC721WithMetadata;
    await linker.registerMainnetContract(await instance.getAddress());
    return instance;
}