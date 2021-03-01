import { MessageProxyForMainnetContract } from "../../../types/truffle-contracts";
import { LockAndDataForMainnetInstance } from "../../../types/truffle-contracts";

const MessageProxyForMainnet: MessageProxyForMainnetContract = artifacts.require("./MessageProxyForMainnetWorkaround");
const name = "MessageProxy";

export async function deployMessageProxyForMainnet(
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    if (await lockAndDataForMainnet.getContract(name) !== "0x0000000000000000000000000000000000000000") {
        return MessageProxyForMainnet.at(await lockAndDataForMainnet.getContract(name));
    } else {
        const instance = await MessageProxyForMainnet.new();
        await instance.initialize(lockAndDataForMainnet.address);
        await lockAndDataForMainnet.setContract(name, instance.address);
        return instance;
    }
}