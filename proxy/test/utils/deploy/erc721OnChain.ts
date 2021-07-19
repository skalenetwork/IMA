import { ethers } from "hardhat";
import { ERC721OnChain } from "../../../typechain/ERC721OnChain";

export async function deployERC721OnChain(
    tokenName: string,
    tokenSymbol: string
) {
    const factory = await ethers.getContractFactory("ERC721OnChain");
    const instance = await factory.deploy(tokenName, tokenSymbol) as ERC721OnChain;
    return instance;
}