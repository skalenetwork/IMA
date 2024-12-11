import { ethers, upgrades } from "hardhat";
import { TokenManagerERC721, TokenManagerLinker, CommunityLocker, MessageProxyForSchain } from "../../../../typechain";

const name = "TokenManagerERC721";

export async function deployTokenManagerERC721(
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
    ) as unknown as TokenManagerERC721;
    return instance;
}
