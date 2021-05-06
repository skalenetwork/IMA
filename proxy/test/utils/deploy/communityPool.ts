import { CommunityPoolContract } from "../../../types/truffle-contracts";
import { MessageProxyForMainnetInstance } from "../../../types/truffle-contracts";
import { IMALinkerInstance } from "../../../types/truffle-contracts";
import { ContractManagerInstance } from "../../../types/truffle-contracts";

const CommunityPool: CommunityPoolContract = artifacts.require("./CommunityPool");

export async function deployCommunityPool(
    contractManager: ContractManagerInstance,
    messageProxy: MessageProxyForMainnetInstance,
    imaLinker: IMALinkerInstance,

) {
    const instance = await CommunityPool.new();
    await instance.initialize(contractManager.address, messageProxy.address, imaLinker.address);
    return instance;
}