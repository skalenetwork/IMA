import { ethers } from "hardhat";
import { TokenManagerERC20, MessageProxyForSchain, TokenManagerLinker } from "../../../../typechain";

const name = "TokenManagerERC20";

export async function deployTokenManagerERC20(
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
    ) as TokenManagerERC20;
    return instance;
}