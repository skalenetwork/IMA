import { ethers, upgrades } from "hardhat";
import { TokenManagerERC721WithMetadata, TokenManagerLinker, CommunityLocker, MessageProxyForSchain } from "../../../../typechain";

const name = "TokenManagerERC721WithMetadata";

export async function deployTokenManagerERC721WithMetadata(
    schainName: string,
    messageProxyForSchain: MessageProxyForSchain,
    tokenManagerLinker: TokenManagerLinker,
    communityLocker: CommunityLocker,
    newDepositBox: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await upgrades.deployProxy(
        factory,
        [
            schainName,
            await messageProxyForSchain.getAddress(),
            await tokenManagerLinker.getAddress(),
            await communityLocker.getAddress(),
            newDepositBox
        ]
    ) as unknown as TokenManagerERC721WithMetadata;
    return instance;
}
