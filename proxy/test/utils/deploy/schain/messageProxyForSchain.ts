import { ethers } from "hardhat";
import { MessageProxyForSchain } from "../../../../typechain";

const name = "MessageProxyForSchain";

export async function deployMessageProxyForSchain(keyStorageAddress: string, schainName: string) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy() as MessageProxyForSchain;
    await instance.initialize(keyStorageAddress, schainName);
    return instance;
}