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
        [
            await contractManager.getAddress(),
            await linker.getAddress(),
            await messageProxy.getAddress()
        ],
        {"initializer": "initialize(address,address,address)"}
    ) as unknown as DepositBoxEth;
    await linker.registerMainnetContract(await instance.getAddress());
    return instance;
}