import { DepositBoxERC721Contract } from "../../../types/truffle-contracts";
import { MessageProxyForMainnetInstance } from "../../../types/truffle-contracts";
import { IMALinkerInstance } from "../../../types/truffle-contracts";
import { ContractManagerInstance } from "../../../types/truffle-contracts";

const DepositBoxERC721: DepositBoxERC721Contract = artifacts.require("./DepositBoxERC721");

export async function deployDepositBoxERC721(
    contractManager: ContractManagerInstance,
    messageProxy: MessageProxyForMainnetInstance,
    imaLinker: IMALinkerInstance

) {
    const instance = await DepositBoxERC721.new();
    await instance.initialize(contractManager.address, messageProxy.address, imaLinker.address);
    await imaLinker.registerMainnetContract(instance.address);
    return instance;
}