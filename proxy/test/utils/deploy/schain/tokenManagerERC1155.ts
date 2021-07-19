import { ethers } from "hardhat";
import { TokenManagerERC1155, MessageProxyForSchain, TokenManagerLinker, CommunityLocker } from "../../../../typechain";

const name = "TokenManagerERC1155";

export async function deployTokenManagerERC1155(
    schainName: string,
    messageProxyForSchain: string,
    tokenManagerLinker: TokenManagerLinker,
    communityLocker: CommunityLocker,
    newDepositBox: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy() as TokenManagerERC1155;
    await instance.initialize(
        schainName,
        messageProxyForSchain,
        tokenManagerLinker.address,
        communityLocker.address,
        newDepositBox)
    return instance;
}