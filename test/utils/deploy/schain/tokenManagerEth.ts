import { ethers, upgrades } from "hardhat";
import { TokenManagerEth, TokenManagerLinker, CommunityLocker, MessageProxyForSchain } from "../../../../typechain";

const name = "TokenManagerEth";

export async function deployTokenManagerEth(
    schainName: string,
    messageProxyForSchain: MessageProxyForSchain,
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
            await messageProxyForSchain.getAddress(),
            await tokenManagerLinker.getAddress(),
            await communityLocker.getAddress(),
            newDepositBox,
            ethErc20Address
        ]
    ) as unknown as TokenManagerEth;
    return instance;
}
