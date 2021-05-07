import { ethers } from "hardhat";
import { LockAndDataForSchain, LockAndDataForSchainERC20 } from "../../../../typechain";

export async function deployLockAndDataForSchainERC20(
    lockAndDataForSchain: LockAndDataForSchain,
) {
    const factory = await ethers.getContractFactory("LockAndDataForSchainERC20");
    const instance = await factory.deploy(lockAndDataForSchain.address) as LockAndDataForSchainERC20;
    return instance;
}