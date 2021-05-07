import { ethers } from "hardhat";
import { LockAndDataForSchain, TokenFactory } from "../../../../typechain";

export async function deployTokenFactory(
    lockAndDataForSchain: LockAndDataForSchain
) {
    const factory = await ethers.getContractFactory("TokenFactory");
    const instance = await factory.deploy(lockAndDataForSchain.address) as TokenFactory;
    return instance;
}