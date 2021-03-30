import { MessageProxyForMainnetContract } from "../../../types/truffle-contracts";
import { ContractManagerInstance } from "../../../types/truffle-contracts";

const MessageProxyForMainnet: MessageProxyForMainnetContract = artifacts.require("./MessageProxyForMainnet");
const name = "MessageProxyForMainnet";

export async function deployMessageProxyForMainnet(
    contractManager: ContractManagerInstance
) {
    if (await contractManager.getContract(name) !== "0x0000000000000000000000000000000000000000") {
        return MessageProxyForMainnet.at(await contractManager.getContract(name));
    } else {
        const instance = await MessageProxyForMainnet.new();
        await instance.initialize(contractManager.address);
        await contractManager.setContractsAddress(name, instance.address);
        return instance;
    }
}