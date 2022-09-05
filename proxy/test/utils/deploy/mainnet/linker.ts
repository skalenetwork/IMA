import { ethers, upgrades } from "hardhat";
import { MessageProxyForMainnet, Linker, ContractManager, MessageProxyForMainnetTester } from "../../../../typechain";

export async function deployLinker(
    contractManager: ContractManager,
    messageProxy: MessageProxyForMainnet | MessageProxyForMainnetTester
) {
    const factory = await ethers.getContractFactory("Linker");
    const instance = await upgrades.deployProxy(
        factory,
        [contractManager.address, messageProxy.address],
        {"initializer": "initialize(address,address)"}
    ) as Linker;
    await instance.registerMainnetContract(instance.address);
    return instance;
}