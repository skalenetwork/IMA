import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, CommunityPoolTester } from "../../../../typechain";


export async function deployCommunityPool(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnet
) {
    const factory = await ethers.getContractFactory("CommunityPoolTester");
    const instance = await factory.deploy() as CommunityPoolTester;
    await instance["initialize(address,address,address)"](contractManager.address, linker.address, messageProxy.address);
    await linker.registerMainnetContract(instance.address);
    await messageProxy.setCommunityPool(instance.address);
    return instance;
}