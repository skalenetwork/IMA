import { ethers } from "hardhat";
import { EthERC20Tester, TokenManagerEth } from "../../../../typechain";

export async function deployEthERC20(
    tokenManagerEth: TokenManagerEth
) {
    const factory = await ethers.getContractFactory("EthERC20Tester");
    const instance = await factory.deploy(tokenManagerEth.address) as EthERC20Tester;
    return instance;
}
