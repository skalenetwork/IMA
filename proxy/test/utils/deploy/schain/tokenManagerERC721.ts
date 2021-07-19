import { ethers } from "hardhat";
import { TokenManagerERC721, MessageProxyForSchain, TokenManagerLinker, CommunityLocker } from "../../../../typechain";

const name = "TokenManagerERC721";

export async function deployTokenManagerERC721(
    schainName: string,
    messageProxyForSchain: string,
    tokenManagerLinker: TokenManagerLinker,
    communityLocker: CommunityLocker,
    newDepositBox: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy() as TokenManagerERC721;
    await instance.initialize(
        schainName,
        messageProxyForSchain,
        tokenManagerLinker.address,
        communityLocker.address,
        newDepositBox
    );
    return instance;
}