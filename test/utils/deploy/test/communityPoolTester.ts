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
        [
            await contractManager.getAddress(),
            await linker.getAddress(),
            await messageProxy.getAddress()
        ],
        {"initializer": "initialize(address,address,address)"}
    ) as unknown as CommunityPool;
    await linker.registerMainnetContract(instance);
    await messageProxy.setCommunityPool(instance);
    return instance;
}
