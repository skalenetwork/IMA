import { ethers, upgrades } from "hardhat";
import { ContractManager, MessageProxyForMainnetTester } from "../../../../typechain";

const name = "MessageProxyForMainnetTester";

export async function deployMessageProxyForMainnetTester(
    contractManager: ContractManager
) {
    const factory = await ethers.getContractFactory(name);
    try {
        await contractManager.getContract(name);
    } catch {
        const instance = await upgrades.deployProxy(
            factory,
            [await contractManager.getAddress()]
        ) as unknown as MessageProxyForMainnetTester;
        await contractManager.setContractsAddress(name, instance);
        return instance;
    }
    return factory.attach(await contractManager.getContract(name)) as MessageProxyForMainnetTester;
}
