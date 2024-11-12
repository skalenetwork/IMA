import { ethers, upgrades } from "hardhat";
import { MessageProxyForMainnet, Linker, ContractManager, MessageProxyForMainnetTester } from "../../../../typechain";

export async function deployLinker(
    contractManager: ContractManager,
    messageProxy: MessageProxyForMainnet | MessageProxyForMainnetTester
) {
    const factory = await ethers.getContractFactory("Linker");
    const instance = await upgrades.deployProxy(
        factory,
        [
            await contractManager.getAddress(),
            await messageProxy.getAddress()
        ],
        {"initializer": "initialize(address,address)"}
    ) as unknown as Linker;
    await instance.registerMainnetContract(await instance.getAddress());
    return instance;
}