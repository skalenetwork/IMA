import { ethers } from "hardhat";
import { ContractManager, IMALinker, MessageProxyForMainnet } from "../../../typechain";

export async function deployIMALinker(
    contractManager: ContractManager,
    messageProxy: MessageProxyForMainnet
) {
    const factory = await ethers.getContractFactory("IMALinker");
    const instance = await factory.deploy() as IMALinker;
    await instance.initialize(contractManager.address, messageProxy.address);
    return instance;
}
