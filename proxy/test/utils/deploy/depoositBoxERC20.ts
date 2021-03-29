import { DepositBoxERC20Contract } from "../../../types/truffle-contracts";
import { MessageProxyForMainnetInstance } from "../../../types/truffle-contracts";
import { IMALinkerInstance } from "../../../types/truffle-contracts";
import { ContractManagerInstance } from "../../../types/truffle-contracts";

const DepositBox: DepositBoxERC20Contract = artifacts.require("./DepositBoxERC20");

export async function deployDepositBox(
    imaLinker: IMALinkerInstance,
    contractManager: ContractManagerInstance,
    messageProxy: MessageProxyForMainnetInstance

) {
    const instance = await DepositBox.new();
    await instance.initialize(imaLinker.address, contractManager.address, messageProxy.address);
    await imaLinker.registerDepositBox(instance.address);
    return instance;
}