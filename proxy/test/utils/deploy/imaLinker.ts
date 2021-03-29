import { IMALinkerContract } from "../../../types/truffle-contracts";
import { MessageProxyForMainnetInstance } from "../../../types/truffle-contracts";
import { ContractManagerInstance } from "../../../types/truffle-contracts";

const imaLinker: IMALinkerContract = artifacts.require("./IMALinker");

export async function deployIMALinker(
    contractManager: ContractManagerInstance,
    messageProxy: MessageProxyForMainnetInstance
) {
    const instance = await imaLinker.new();
    await instance.initialize(contractManager.address, messageProxy.address);
    return instance;
}
