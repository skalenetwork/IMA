import { ethers, upgrades } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, DepositBoxEth } from "../../../../typechain";

export async function deployDepositBoxEth(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnet

) {
    const factory = await ethers.getContractFactory("DepositBoxEth");
    const instance = await upgrades.deployProxy(
        factory,
        [contractManager.address, linker.address, messageProxy.address],
        {"initializer": "initialize(address,address,address)"}
    ) as DepositBoxEth;
    await linker.registerMainnetContract(instance.address);
    return instance;
}