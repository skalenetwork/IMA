import { ethers } from "hardhat";
import { CommunityLocker, MessageProxyForSchain, TokenManagerLinker } from "../../../../typechain";

const name = "CommunityLocker";

export async function deployCommunityLocker(
    schainName: string,
    messageProxyForSchain: string,
    tokenManagerLinker: TokenManagerLinker,
    communityPool: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy() as CommunityLocker;
    await instance.initialize(schainName, messageProxyForSchain, tokenManagerLinker.address, communityPool)
    return instance;
}
