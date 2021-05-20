import { ethers } from "hardhat";
import { MessageProxyForSchain } from "../../../../typechain";

const name = "MessageProxyForSchain";

export async function deployMessageProxyForSchain() {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy() as MessageProxyForSchain;
    await instance.initialize();
    return instance;
}