import { ethers } from "hardhat";
import { EthErc20, TokenManagerEth } from "../../../../typechain";

export async function deployEthErc20(
    tokenManagerEth: TokenManagerEth
) {
    const factory = await ethers.getContractFactory("EthErc20");
    const instance = await factory.deploy() as EthErc20;
    await instance.initialize(tokenManagerEth.address);
    return instance;
}
