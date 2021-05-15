import { ethers } from "hardhat";
import { TokenManagerEth, MessageProxyForSchain, TokenManagerLinker } from "../../../../typechain";

const name = "TokenManagerEth";

export async function deployTokenManagerEth(
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
    ) as TokenManagerEth;
    return instance;
}