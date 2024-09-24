import { ethers, upgrades } from "hardhat";
import { ContractManager, MessageProxyForMainnet, Linker, DepositBoxERC20 } from "../../../../typechain";

export async function deployDepositBoxERC20(
    contractManager: ContractManager,
    linker: Linker,
    messageProxy: MessageProxyForMainnet

) {
    const factory = await ethers.getContractFactory("DepositBoxERC20");
    const instance = await upgrades.deployProxy(
        factory,
        [contractManager.address, linker.address, messageProxy.address],
        {"initializer": "initialize(address,address,address)"}
    ) as DepositBoxERC20;
    await linker.registerMainnetContract(instance.address);
    return instance;
}