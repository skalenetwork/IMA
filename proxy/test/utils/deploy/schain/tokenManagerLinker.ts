import { ethers } from "hardhat";
import { TokenManagerLinker, MessageProxyForSchain, MessageProxyForSchainTester } from "../../../../typechain";

export async function deployTokenManagerLinker(
    messageProxyForSchain: MessageProxyForSchain | MessageProxyForSchainTester,
    newLinkerAddress: string
) {
    const factory = await ethers.getContractFactory("TokenManagerLinker");
    const instance = await factory.deploy() as TokenManagerLinker;
    await instance.initialize(messageProxyForSchain.address, newLinkerAddress);
    return instance;
}
