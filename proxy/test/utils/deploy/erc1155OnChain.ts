import { ethers } from "hardhat";
import { ERC1155OnChain } from "../../../typechain/ERC1155OnChain";

export async function deployERC1155OnChain(
    uri: string
) {
    const factory = await ethers.getContractFactory("ERC1155OnChain");
    const instance = await factory.deploy(uri) as ERC1155OnChain;
    return instance;
}