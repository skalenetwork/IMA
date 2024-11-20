import { ethers, upgrades } from "hardhat";
import { TokenManagerLinker, MessageProxyForSchain, MessageProxyForSchainTester, MessageProxyForSchainWithoutSignature } from "../../../../typechain";

export async function deployTokenManagerLinker(
    messageProxyForSchain: MessageProxyForSchain | MessageProxyForSchainTester | MessageProxyForSchainWithoutSignature,
    newLinkerAddress: string
) {
    const factory = await ethers.getContractFactory("TokenManagerLinker");
    const instance = await upgrades.deployProxy(
        factory,
        [
            await messageProxyForSchain.getAddress(),
            newLinkerAddress
        ]
    ) as unknown as TokenManagerLinker;
    return instance;
}
