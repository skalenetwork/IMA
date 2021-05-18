import { ethers } from "hardhat";
import { TokenManagerERC721, MessageProxyForSchain, TokenManagerLinker } from "../../../../typechain";

const name = "TokenManagerERC721";

export async function deployTokenManagerERC721(
    schainName: string,
    messageProxyForSchain: string,
    tokenManagerLinker: TokenManagerLinker,
    newDepositBox: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy(
        schainName,
        messageProxyForSchain,
        tokenManagerLinker.address,
        newDepositBox
    ) as TokenManagerERC721;
    return instance;
}