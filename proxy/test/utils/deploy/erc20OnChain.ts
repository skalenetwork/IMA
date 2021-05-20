import { ethers } from "hardhat";
import { ERC20OnChain } from "../../../typechain/ERC20OnChain";

export async function deployERC20OnChain(
    tokenName: string,
    tokenSymbol: string
) {
    const factory = await ethers.getContractFactory("ERC20OnChain");
    const instance = await factory.deploy(tokenName, tokenSymbol) as ERC20OnChain;
    return instance;
}