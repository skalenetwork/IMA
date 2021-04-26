import { UsersOnMainnetContract } from "../../../types/truffle-contracts";
import { MessageProxyForMainnetInstance } from "../../../types/truffle-contracts";
import { IMALinkerInstance } from "../../../types/truffle-contracts";
import { ContractManagerInstance } from "../../../types/truffle-contracts";

const UsersOnMainnet: UsersOnMainnetContract = artifacts.require("./UsersOnMainnet");

export async function deployUsersOnMainnet(
    contractManager: ContractManagerInstance,
    messageProxy: MessageProxyForMainnetInstance,
    imaLinker: IMALinkerInstance,

) {
    const instance = await UsersOnMainnet.new();
    await instance.initialize(contractManager.address, messageProxy.address, imaLinker.address);
    return instance;
}