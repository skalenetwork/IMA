import { ethers, upgrades } from "hardhat";
import { MessageProxyForSchain } from "../../../../typechain";

const name = "MessageProxyForSchain";

export async function deployMessageProxyForSchain(keyStorageAddress: string, schainName: string) {
    const factory = await ethers.getContractFactory(name);
    const instance = await upgrades.deployProxy(
        factory,
        [keyStorageAddress, schainName]
    ) as MessageProxyForSchain;
    return instance;
}