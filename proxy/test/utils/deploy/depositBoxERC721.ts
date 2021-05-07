import { ethers } from "hardhat";
import { ContractManager, MessageProxyForMainnet, IMALinker, DepositBoxERC721 } from "../../../typechain";

export async function deployDepositBoxERC721(
    contractManager: ContractManager,
    messageProxy: MessageProxyForMainnet,
    imaLinker: IMALinker

) {
    const factory = await ethers.getContractFactory("DepositBoxERC721");
    const instance = await factory.deploy() as DepositBoxERC721;
    await instance["initialize(address,address,address)"](contractManager.address, messageProxy.address, imaLinker.address);
    await imaLinker.registerDepositBox(instance.address);
    return instance;
}