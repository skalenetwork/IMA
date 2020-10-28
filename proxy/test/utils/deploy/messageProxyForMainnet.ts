import { MessageProxyForMainnetContract } from "../../../types/truffle-contracts";
import { LockAndDataForMainnetInstance } from "../../../types/truffle-contracts";

const MessageProxyForMainnet: MessageProxyForMainnetContract = artifacts.require("./MessageProxyForMainnet");
const name = "MessageProxyForMainnet";

export async function deployMessageProxyForMainnet(
    schainName: string,
    contractManagerFromSkaleManager: string,
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    try {
        return MessageProxyForMainnet.at(await lockAndDataForMainnet.contract(name));
    } catch (e) {
        const instance = await MessageProxyForMainnet.new();
        await instance.initialize(schainName, contractManagerFromSkaleManager);
        await lockAndDataForMainnet.setContract(name, instance.address);
        return instance;
    }
}