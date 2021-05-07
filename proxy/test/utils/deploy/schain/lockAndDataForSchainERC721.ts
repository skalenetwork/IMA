import { ethers } from "hardhat";
import { LockAndDataForSchain, LockAndDataForSchainERC721 } from "../../../../typechain";

export async function deployLockAndDataForSchainERC721(
    lockAndDataForSchain: LockAndDataForSchain,
) {
    const factory = await ethers.getContractFactory("LockAndDataForSchainERC721");
    const instance = await factory.deploy(lockAndDataForSchain.address) as LockAndDataForSchainERC721;
    return instance;
}