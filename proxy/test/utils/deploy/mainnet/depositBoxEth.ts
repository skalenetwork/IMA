import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnet, IMALinker, DepositBoxEth } from "../../../../typechain";

export async function deployDepositBoxEth(
    contractManager: ContractManager,
    messageProxy: MessageProxyForMainnet,
    imaLinker: IMALinker

) {
    const factory = await ethers.getContractFactory("DepositBoxEth");
    const instance = await factory.deploy() as DepositBoxEth;
    await instance["initialize(address,address,address)"](contractManager.address, messageProxy.address, imaLinker.address);
    await imaLinker.registerDepositBox(instance.address);
    return instance;
}