import { ethers } from "hardhat";
import { TokenManagerERC20, MessageProxyForSchain, TokenManagerLinker, CommunityLocker } from "../../../../typechain";

const name = "TokenManagerERC20";

export async function deployTokenManagerERC20(
    schainName: string,
    messageProxyForSchain: string,
    tokenManagerLinker: TokenManagerLinker,
    communityLocker: CommunityLocker,
    newDepositBox: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy() as TokenManagerERC20;
    await instance.initialize(
        schainName,
        messageProxyForSchain,
        tokenManagerLinker.address,
        communityLocker.address,
        newDepositBox
    );
    return instance;
}