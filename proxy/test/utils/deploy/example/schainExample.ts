import { ethers } from "hardhat";
import { SchainExample, MessageProxyForSchain, MainnetExample } from "../../../../typechain";

const name = "SchainExample";

export async function deploySchainExample(
    schainName: string,
    messageProxyForSchain: MessageProxyForSchain,
    mainnetExample: MainnetExample
) {
    const factory = await ethers.getContractFactory(name);
    const instance = await factory.deploy(
        schainName,
        messageProxyForSchain.address,
        mainnetExample.address
    ) as SchainExample;
    return instance;
}