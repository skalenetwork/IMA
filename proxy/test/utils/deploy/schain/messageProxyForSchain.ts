import { ethers } from "hardhat";
import { MessageProxyForSchain } from "../../../../typechain/MessageProxyForSchain";

const name = "MessageProxyForSchain";

export async function deployMessageProxyForSchain(
    schainName: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy(schainName) as MessageProxyForSchain;
    return instance;
}