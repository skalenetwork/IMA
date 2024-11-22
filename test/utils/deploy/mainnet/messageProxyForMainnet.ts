import { ethers, upgrades } from "hardhat";
import { ContractManager, MessageProxyForMainnet } from "../../../../typechain";

const name = "MessageProxyForMainnet";

export async function deployMessageProxyForMainnet(
    contractManager: ContractManager
) {
    const factory = await ethers.getContractFactory(name);
    try {
        await contractManager.getContract(name);
    } catch {
        const instance = await upgrades.deployProxy(factory, [await contractManager.getAddress()]) as unknown as MessageProxyForMainnet;
        await contractManager.setContractsAddress(name, instance);
        return instance;
    }
    return factory.attach(await contractManager.getContract(name)) as MessageProxyForMainnet;
}
