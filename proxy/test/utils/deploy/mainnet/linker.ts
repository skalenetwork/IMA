import { ethers } from "hardhat";
import { MessageProxyForMainnet, Linker } from "../../../../typechain";

export async function deployLinker(
    messageProxy: MessageProxyForMainnet
) {
    const factory = await ethers.getContractFactory("Linker");
    const instance = await factory.deploy() as Linker;
    await instance["initialize(address)"](messageProxy.address,);
    return instance;
}