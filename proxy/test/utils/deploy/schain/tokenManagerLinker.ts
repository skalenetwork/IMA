import { ethers } from "hardhat";
import { TokenManagerLinker, MessageProxyForSchain } from "../../../../typechain";

export async function deployTokenManagerLinker(
    messageProxyForSchain: MessageProxyForSchain
) {
    const factory = await ethers.getContractFactory("TokenManagerLinker");
    const instance = await factory.deploy(messageProxyForSchain.address) as TokenManagerLinker;
    return instance;
}