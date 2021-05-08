import { ethers } from "hardhat";
import { LockAndDataForSchainWorkaround } from "../../../../typechain/LockAndDataForSchainWorkaround";

export async function deployLockAndDataForSchainWorkaround(
) {
    const factory = await ethers.getContractFactory("LockAndDataForSchainWorkaround");
    const instance = await factory.deploy() as LockAndDataForSchainWorkaround;
    return instance;
}