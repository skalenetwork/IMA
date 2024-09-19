import { ethers, upgrades } from "hardhat";
import { TokenManagerERC721, TokenManagerLinker, CommunityLocker } from "../../../../typechain";

const name = "TokenManagerERC721";

export async function deployTokenManagerERC721(
    schainName: string,
    messageProxyForSchain: string,
    tokenManagerLinker: TokenManagerLinker,
    communityLocker: CommunityLocker,
    newDepositBox: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await upgrades.deployProxy(
        factory,
        [
            schainName,
            messageProxyForSchain,
            tokenManagerLinker.address,
            communityLocker.address,
            newDepositBox
        ]
    ) as TokenManagerERC721;
    return instance;
}
