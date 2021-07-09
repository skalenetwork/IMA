import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, CommunityPool } from "../../../../typechain";


export async function deployCommunityPool(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnet
) {
    const factory = await ethers.getContractFactory("CommunityPool");
    const instance = await factory.deploy() as CommunityPool;
    await instance["initialize(address,address,address)"](contractManager.address, linker.address, messageProxy.address);
    await linker.registerMainnetContract(instance.address);
    await messageProxy.setCommunityPool(instance.address);
    return instance;
}