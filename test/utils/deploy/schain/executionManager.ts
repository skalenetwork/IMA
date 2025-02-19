import { ethers, upgrades } from "hardhat";
import { ExecutionManager, ITokenManagerERC20, Send, SendRest } from "../../../../typechain";

const name = "ExecutionManager";

export async function deployExecutionManager(
    tokenManagerErc20: ITokenManagerERC20
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await upgrades.deployProxy(
        factory,
        [await ethers.resolveAddress(tokenManagerErc20)]
    ) as unknown as ExecutionManager;

    await instance.grantRole(await instance.CONTROLLER_ROLE(), (await ethers.getSigners())[0])

    const sendFactory = await ethers.getContractFactory("Send");
    const send = await upgrades.deployProxy(
        sendFactory,
        [await ethers.resolveAddress(instance)]
    ) as unknown as Send;

    await instance.setExecutor(
        await send.ID(),
        send
    );

    const sendRestFactory = await ethers.getContractFactory("SendRest");
    const sendRest = await upgrades.deployProxy(
        sendRestFactory,
        [await ethers.resolveAddress(instance)]
    ) as unknown as SendRest;

    await instance.setExecutor(
        await sendRest.ID(),
        sendRest
    );

    return instance;
}
