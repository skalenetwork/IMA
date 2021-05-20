import { ethers } from "hardhat";
import { CommunityLocker, MessageProxyForSchain, TokenManagerLinker } from "../../../../typechain";

const name = "CommunityLocker";

export async function deployCommunityLocker(
    schainName: string,
    messageProxyForSchain: string,
    tokenManagerLinker: TokenManagerLinker
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy(
        schainName,
        messageProxyForSchain,
        tokenManagerLinker.address
    ) as CommunityLocker;
    return instance;
}