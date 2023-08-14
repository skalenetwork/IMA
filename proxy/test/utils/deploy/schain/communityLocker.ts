import { ethers, upgrades } from "hardhat";
import { CommunityLocker, TokenManagerLinker } from "../../../../typechain";

const name = "CommunityLocker";

export async function deployCommunityLocker(
    schainName: string,
    messageProxyForSchain: string,
    tokenManagerLinker: TokenManagerLinker,
    communityPool: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await upgrades.deployProxy(
        factory,
        [schainName, messageProxyForSchain, tokenManagerLinker.address, communityPool]
    ) as CommunityLocker;
    return instance;
}
