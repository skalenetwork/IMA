import { ethers } from "hardhat";
import { KeyStorageMock } from "../../../../typechain";

export async function deployKeyStorageMock(
) {
    const factory = await ethers.getContractFactory("KeyStorageMock");
    const instance = await factory.deploy() as KeyStorageMock;
    return instance;
}