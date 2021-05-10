import { ethers } from "hardhat";
import { TokenManager, LockAndDataForSchain } from "../../../../typechain";

const name = "TokenManager";

export async function deployTokenManager(
    schainName: string,
    lockAndDataForSchain: LockAndDataForSchain
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy(schainName, lockAndDataForSchain.address) as TokenManager;
    return instance;
}