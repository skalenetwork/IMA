import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnet, IMALinker, DepositBoxERC20 } from "../../../typechain";

export async function deployDepositBoxERC20(
    contractManager: ContractManager,
    messageProxy: MessageProxyForMainnet,
    imaLinker: IMALinker,

) {
    const factory = await ethers.getContractFactory("DepositBoxERC20");
    const instance = await factory.deploy() as DepositBoxERC20;
    await instance.initialize(contractManager.address, messageProxy.address, imaLinker.address);
    await imaLinker.registerDepositBox(instance.address);
    return instance;
}