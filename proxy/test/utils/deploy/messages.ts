import { ethers } from "hardhat";
import { MessagesTester } from "../../../typechain";

export async function deployMessages() {
    const factory = await ethers.getContractFactory("MessagesTester");
    const instance = await factory.deploy() as MessagesTester;
    return instance;
}
