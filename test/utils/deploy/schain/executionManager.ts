import { ethers, upgrades } from "hardhat";
import { ExecutionManager, MessageProxyForSchain } from "../../../../typechain";

const name = "ExecutionManager";

export async function deployExecutionManager(
    messageProxyForSchain: MessageProxyForSchain
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await upgrades.deployProxy(
        factory,
        [await ethers.resolveAddress(messageProxyForSchain)]
    ) as unknown as ExecutionManager;
    return instance;
}
