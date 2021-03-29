import { DepositBoxERC721Contract } from "../../../types/truffle-contracts";
import { MessageProxyForMainnetInstance } from "../../../types/truffle-contracts";
import { IMALinkerInstance } from "../../../types/truffle-contracts";
import { ContractManagerInstance } from "../../../types/truffle-contracts";

const DepositBoxERC721: DepositBoxERC721Contract = artifacts.require("./DepositBoxERC721");

export async function deployDepositBoxERC721(
    imaLinker: IMALinkerInstance,
    contractManager: ContractManagerInstance,
    messageProxy: MessageProxyForMainnetInstance

) {
    const instance = await DepositBoxERC721.new();
    await instance.initialize(imaLinker.address, contractManager.address, messageProxy.address);
    await imaLinker.registerDepositBox(instance.address);
    return instance;
}