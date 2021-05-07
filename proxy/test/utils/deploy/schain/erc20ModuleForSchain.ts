import { ethers } from "hardhat";
import { LockAndDataForSchain, ERC20ModuleForSchain } from "../../../../typechain";

export async function deployERC20ModuleForSchain(
    lockAndDataForSchain: LockAndDataForSchain,
) {
    const factory = await ethers.getContractFactory("ERC20ModuleForSchain");
    const instance = await factory.deploy(lockAndDataForSchain.address) as ERC20ModuleForSchain;
    return instance;
}