import { ethers } from "hardhat";
import { SkaleFeaturesMock } from "../../../../typechain/SkaleFeaturesMock";

export async function deploySkaleFeaturesMock(
) {
    const factory = await ethers.getContractFactory("SkaleFeaturesMock");
    const instance = await factory.deploy() as SkaleFeaturesMock;
    return instance;
}