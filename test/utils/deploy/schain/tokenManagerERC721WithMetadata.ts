import { ethers, upgrades } from "hardhat";
import { TokenManagerERC721WithMetadata, TokenManagerLinker, CommunityLocker } from "../../../../typechain";

const name = "TokenManagerERC721WithMetadata";

export async function deployTokenManagerERC721WithMetadata(
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
    ) as TokenManagerERC721WithMetadata;
    return instance;
}
