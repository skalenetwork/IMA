import { ethers, upgrades } from "hardhat";
import { ExecutionManager, MessageProxyForSchain, Send } from "../../../../typechain";

const name = "ExecutionManager";

export async function deployExecutionManager(
    messageProxyForSchain: MessageProxyForSchain
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await upgrades.deployProxy(
        factory,
        [await ethers.resolveAddress(messageProxyForSchain)]
    ) as unknown as ExecutionManager;

    await instance.grantRole(await instance.CONTROLLER_ROLE(), (await ethers.getSigners())[0])

    const sendFactory = await ethers.getContractFactory("Send");
    const send = await upgrades.deployProxy(
        sendFactory
    ) as unknown as Send;

    await instance.setExecutor(
        await send.ID(),
        send
    );

    return instance;
}
