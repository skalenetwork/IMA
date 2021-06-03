import { ethers } from "hardhat";
import { TokenManagerEth, MessageProxyForSchain, TokenManagerLinker, CommunityLocker } from "../../../../typechain";

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
    const instance = await factory.deploy() as TokenManagerEth;
    await instance.initialize(
        schainName,
        messageProxyForSchain,
        tokenManagerLinker.address,
        communityLocker.address,
        newDepositBox,
        ethErc20Address
    );
    return instance;
}