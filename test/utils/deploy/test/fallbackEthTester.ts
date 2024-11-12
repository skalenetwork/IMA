import { ethers } from "hardhat";
import { FallbackEthTester, DepositBoxEth, CommunityPool } from "../../../../typechain";


export async function deployFallbackEthTester(
    depositBoxEth: DepositBoxEth,
    communityPool: CommunityPool,
    schainName: string
) {
    const factory = await ethers.getContractFactory("FallbackEthTester");
    const instance = await factory.deploy(
        await depositBoxEth.getAddress(),
        await communityPool.getAddress(),
        schainName
    ) as FallbackEthTester;
    return instance;
}