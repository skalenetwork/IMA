import { ethers } from "hardhat";
import { MessageProxyCaller } from "../../../../typechain/MessageProxyCaller";

const name = "MessageProxyCaller";

export async function deployMessageProxyCaller() {
    const factory = await ethers.getContractFactory(name);

    const instance = await factory.deploy() as MessageProxyCaller;
    return instance;
}