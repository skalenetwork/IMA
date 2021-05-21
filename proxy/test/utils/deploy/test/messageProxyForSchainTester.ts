import { ethers } from "hardhat";
import { MessageProxyForSchainTester } from "../../../../typechain/MessageProxyForSchainTester";

const name = "MessageProxyForSchainTester";

export async function deployMessageProxyForSchainTester(keyStorageAddress: string) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy(keyStorageAddress) as MessageProxyForSchainTester;
    return instance;
}