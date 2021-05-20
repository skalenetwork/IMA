import { ethers } from "hardhat";
import { MessageProxyForSchainTester } from "../../../../typechain/MessageProxyForSchainTester";

const name = "MessageProxyForSchainTester";

export async function deployMessageProxyForSchainTester() {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy() as MessageProxyForSchainTester;
    return instance;
}