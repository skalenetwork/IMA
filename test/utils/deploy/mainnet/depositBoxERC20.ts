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
        [
            await contractManager.getAddress(),
            await linker.getAddress(),
            await messageProxy.getAddress()
        ],
        {"initializer": "initialize(address,address,address)"}
    ) as unknown as DepositBoxERC20;
    await linker.registerMainnetContract(await instance.getAddress());
    return instance;
}