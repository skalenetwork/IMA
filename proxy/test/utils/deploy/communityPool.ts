import { CommunityPoolContract } from "../../../types/truffle-contracts";
import { MessageProxyForMainnetInstance } from "../../../types/truffle-contracts";
import { LinkerInstance } from "../../../types/truffle-contracts";
import { ContractManagerInstance } from "../../../types/truffle-contracts";

const CommunityPool: CommunityPoolContract = artifacts.require("./CommunityPool");

export async function deployCommunityPool(
    contractManager: ContractManagerInstance,
    messageProxy: MessageProxyForMainnetInstance,
    linker: LinkerInstance,

) {
    const instance = await CommunityPool.new();
    await instance.initialize(contractManager.address, linker.address, messageProxy.address);
    return instance;
}