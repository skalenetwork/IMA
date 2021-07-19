import { ethers } from "hardhat";
import { TokenManagerLinker, MessageProxyForSchain } from "../../../../typechain";

export async function deployTokenManagerLinker(
    messageProxyForSchain: MessageProxyForSchain,
    newLinkerAddress: string
) {
    const factory = await ethers.getContractFactory("TokenManagerLinker");
    const instance = await factory.deploy() as TokenManagerLinker;
    await instance.initialize(messageProxyForSchain.address, newLinkerAddress);
    return instance;
}
