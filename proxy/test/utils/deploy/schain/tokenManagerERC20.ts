import { ethers, upgrades } from "hardhat";
import { TokenManagerERC20, TokenManagerLinker, CommunityLocker } from "../../../../typechain";

const name = "TokenManagerERC20";

export async function deployTokenManagerERC20(
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
    ) as TokenManagerERC20;
    return instance;
}
