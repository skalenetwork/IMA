import { ethers, upgrades } from "hardhat";
import { KeyStorage, MessageProxyForSchain } from "../../../../typechain";

const name = "MessageProxyForSchain";

export async function deployMessageProxyForSchain(keyStorageAddress: KeyStorage, schainName: string) {
    const factory = await ethers.getContractFactory(name);
    const instance = await upgrades.deployProxy(
        factory,
        [await keyStorageAddress.getAddress(), schainName]
    ) as unknown as MessageProxyForSchain;
    return instance;
}
