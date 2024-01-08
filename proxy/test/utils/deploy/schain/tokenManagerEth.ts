import { ethers, upgrades } from "hardhat";
import { TokenManagerEth, TokenManagerLinker, CommunityLocker } from "../../../../typechain";

const name = "TokenManagerEth";

export async function deployTokenManagerEth(
    schainName: string,
    messageProxyForSchain: string,
    tokenManagerLinker: TokenManagerLinker,
    communityLocker: CommunityLocker,
    newDepositBox: string,
    ethErc20Address: string
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await upgrades.deployProxy(
        factory,
        [
            schainName,
            messageProxyForSchain,
            tokenManagerLinker.address,
            communityLocker.address,
            newDepositBox,
            ethErc20Address
        ]
    ) as TokenManagerEth;
    return instance;
}
