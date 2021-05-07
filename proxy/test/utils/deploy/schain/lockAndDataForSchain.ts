import { ethers } from "hardhat";
import { LockAndDataForSchain } from "../../../../typechain/LockAndDataForSchain";

export async function deployLockAndDataForSchain(
) {
    const factory = await ethers.getContractFactory("LockAndDataForSchain");
    const instance = await factory.deploy() as LockAndDataForSchain;
    return instance;
}