import { ethers, upgrades } from "hardhat";
import { ContractManager, MessageProxyForMainnet } from "../../../../typechain";

const name = "MessageProxyForMainnet";

export async function deployMessageProxyForMainnet(
    contractManager: ContractManager
) {
    const factory = await ethers.getContractFactory(name);
    if (await contractManager.getContract(name) !== "0x0000000000000000000000000000000000000000") {
        return factory.attach(await contractManager.getContract(name)) as MessageProxyForMainnet;
    } else {
        const instance = await upgrades.deployProxy(factory, [contractManager.address]) as MessageProxyForMainnet;
        await contractManager.setContractsAddress(name, instance.address);
        return instance;
    }
}