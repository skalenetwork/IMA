import { ethers } from "hardhat";
import { KeyStorage, MessageProxyForSchainTester } from "../../../../typechain";

const name = "MessageProxyForSchainTester";

export async function deployMessageProxyForSchainTester(keyStorageAddress: KeyStorage, schainName: string) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy(keyStorageAddress, schainName) as MessageProxyForSchainTester;
    return instance;
}
