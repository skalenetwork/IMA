import { ethers, upgrades } from "hardhat";
import { CommunityLocker, MessageProxyForSchain, TokenManagerLinker } from "../../../../typechain";

const name = "CommunityLocker";

export async function deployCommunityLocker(
    schainName: string,
    messageProxyForSchain: MessageProxyForSchain,
    tokenManagerLinker: TokenManagerLinker,
    communityPool: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await upgrades.deployProxy(
        factory,
        [
            schainName,
            await messageProxyForSchain.getAddress(),
            await tokenManagerLinker.getAddress(),
            communityPool
        ]
    ) as unknown as CommunityLocker;
    return instance;
}
