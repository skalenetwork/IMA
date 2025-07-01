import { ethers, upgrades } from "hardhat";
import { EthErc20, TokenManagerEth, TokenManagerSFuelHub } from "../../../../typechain";

export async function deployEthErc20(
    tokenManagerEth: TokenManagerEth | TokenManagerSFuelHub
) {
    const factory = await ethers.getContractFactory("EthErc20");
    const instance = await upgrades.deployProxy(factory, [await tokenManagerEth.getAddress()]) as unknown as EthErc20;
    return instance;
}
