import { ethers } from "hardhat";
import { TokenManagerERC721WithMetadata, MessageProxyForSchain, TokenManagerLinker, CommunityLocker } from "../../../../typechain";

const name = "TokenManagerERC721WithMetadata";

export async function deployTokenManagerERC721WithMetadata(
    schainName: string,
    messageProxyForSchain: string,
    tokenManagerLinker: TokenManagerLinker,
    communityLocker: CommunityLocker,
    newDepositBox: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy() as TokenManagerERC721WithMetadata;
    await instance.initialize(
        schainName,
        messageProxyForSchain,
        tokenManagerLinker.address,
        communityLocker.address,
        newDepositBox
    );
    return instance;
}