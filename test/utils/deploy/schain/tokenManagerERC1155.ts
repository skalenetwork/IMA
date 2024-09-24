import { ethers, upgrades } from "hardhat";
import { TokenManagerERC1155, TokenManagerLinker, CommunityLocker } from "../../../../typechain";

const name = "TokenManagerERC1155";

export async function deployTokenManagerERC1155(
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
    ) as TokenManagerERC1155;
    return instance;
}
