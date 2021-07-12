import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnetTester, Linker, CommunityPool } from "../../../../typechain";


export async function deployCommunityPoolTester(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnetTester
) {
    const factory = await ethers.getContractFactory("CommunityPool");
    const instance = await factory.deploy() as CommunityPool;
    await instance["initialize(address,address,address)"](contractManager.address, linker.address, messageProxy.address);
    await linker.registerMainnetContract(instance.address);
    await messageProxy.setCommunityPool(instance.address);
    return instance;
}