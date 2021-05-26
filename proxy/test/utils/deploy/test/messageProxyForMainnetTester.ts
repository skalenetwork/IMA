import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnetTester } from "../../../../typechain";

const name = "MessageProxyForMainnetTester";

export async function deployMessageProxyForMainnetTester(
    contractManager: ContractManager
) {
    const factory = await ethers.getContractFactory(name);

        const instance = await factory.deploy() as MessageProxyForMainnetTester;
        await instance.initialize(contractManager.address);
        await contractManager.setContractsAddress(name, instance.address);
        return instance;
}