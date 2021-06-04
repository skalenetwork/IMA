import { ethers } from "hardhat";
import { MainnetExample, MessageProxyForMainnet } from "../../../../typechain";

const name = "MainnetExample";

export async function deployMainnetExample(
    messageProxyForMainnet: MessageProxyForMainnet
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy(
        messageProxyForMainnet.address
    ) as MainnetExample;
    return instance;
}