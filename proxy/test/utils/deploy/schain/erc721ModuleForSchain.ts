import { ethers } from "hardhat";
import { LockAndDataForSchain, ERC721ModuleForSchain } from "../../../../typechain";

export async function deployERC721ModuleForSchain(
    lockAndDataForSchain: LockAndDataForSchain,
) {
    const factory = await ethers.getContractFactory("ERC721ModuleForSchain");
    const instance = await factory.deploy(lockAndDataForSchain.address) as ERC721ModuleForSchain;
    return instance;
}