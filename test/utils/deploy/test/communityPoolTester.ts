import { ethers, upgrades } from "hardhat";
import { ContractManager, MessageProxyForMainnetTester, Linker, CommunityPool } from "../../../../typechain";


export async function deployCommunityPoolTester(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnetTester
) {
    const factory = await ethers.getContractFactory("CommunityPool");
    const instance = await upgrades.deployProxy(
        factory,
        [contractManager.address, linker.address, messageProxy.address],
        {"initializer": "initialize(address,address,address)"}
    ) as CommunityPool;
    await linker.registerMainnetContract(instance.address);
    await messageProxy.setCommunityPool(instance.address);
    return instance;
}