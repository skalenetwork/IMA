import { ethers } from "hardhat";
import { ContractManager } from "../../../typechain/ContractManager";
import { IMALinker } from "../../../typechain/IMALinker";
import { MessageProxyForMainnet } from "../../../typechain/MessageProxyForMainnet";

export async function deployIMALinker(
    contractManager: ContractManager,
    messageProxy: MessageProxyForMainnet
) {
    const factory = await ethers.getContractFactory("IMALinker");
    const instance = await factory.deploy() as IMALinker;
    await instance["initialize(address,address)"](contractManager.address, messageProxy.address);
    return instance;
}
