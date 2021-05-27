import { ethers } from "hardhat";
import { MessageProxyForMainnetTester } from "../../../../typechain/MessageProxyForMainnetTester";

const name = "MessageProxyForMainnetTester";

export async function deployMessageProxyForMainnetTester() {
    const factory = await ethers.getContractFactory(name);

        const instance = await factory.deploy() as MessageProxyForMainnetTester;
        return instance;
}