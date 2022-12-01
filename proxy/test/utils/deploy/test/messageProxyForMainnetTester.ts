import { ethers, upgrades } from "hardhat";
import { ContractManager, MessageProxyForMainnetTester } from "../../../../typechain";

const name = "MessageProxyForMainnetTester";

export async function deployMessageProxyForMainnetTester(
    contractManager: ContractManager
) {
    const factory = await ethers.getContractFactory(name);
    if (await contractManager.getContract(name) !== "0x0000000000000000000000000000000000000000") {
        return factory.attach(await contractManager.getContract(name)) as MessageProxyForMainnetTester;
    } else {
        const instance = await upgrades.deployProxy(
            factory,
            [contractManager.address]
        ) as MessageProxyForMainnetTester;
        await contractManager.setContractsAddress(name, instance.address);
        return instance;
    }
}