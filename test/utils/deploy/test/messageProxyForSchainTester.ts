import { ethers } from "hardhat";
import { KeyStorage, MessageProxyForSchainTester, MessageProxyForSchainWithoutSignature } from "../../../../typechain";

const name = "MessageProxyForSchainTester";

export async function deployMessageProxyForSchainTester(schainName: string, keyStorage?: KeyStorage) {
    if (keyStorage) {
        const factory = await ethers.getContractFactory(name);
        const instance = await factory.deploy(keyStorage, schainName) as MessageProxyForSchainTester;
        return instance;
    } else {
        const factory = await ethers.getContractFactory("MessageProxyForSchainWithoutSignature");
        const instance = await factory.deploy(schainName) as MessageProxyForSchainWithoutSignature;
        return instance;
    }
}
