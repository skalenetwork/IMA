import { ethers, upgrades } from "hardhat";
import { TokenManagerSFuelHub, TokenManagerLinker, CommunityLocker, MessageProxyForSchain } from "../../../../typechain";

const name = "TokenManagerSFuelHub";

export async function deployTokenManagerSFuelHub(
    schainName: string,
    messageProxyForSchain: MessageProxyForSchain,
    tokenManagerLinker: TokenManagerLinker,
    communityLocker: CommunityLocker
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await upgrades.deployProxy(
        factory,
        [
            schainName,
            await messageProxyForSchain.getAddress(),
            await tokenManagerLinker.getAddress(),
            await communityLocker.getAddress()
        ]
    ) as unknown as TokenManagerSFuelHub;

    return instance;
}
