import { DepositBoxERC20Contract } from "../../../types/truffle-contracts";
import { MessageProxyForMainnetInstance } from "../../../types/truffle-contracts";
import { IMALinkerInstance } from "../../../types/truffle-contracts";
import { ContractManagerInstance } from "../../../types/truffle-contracts";

const DepositBoxERC20: DepositBoxERC20Contract = artifacts.require("./DepositBoxERC20");

export async function deployDepositBoxERC20(
    contractManager: ContractManagerInstance,
    messageProxy: MessageProxyForMainnetInstance,
    imaLinker: IMALinkerInstance,

) {
    const instance = await DepositBoxERC20.new();
    await instance.initialize(contractManager.address, messageProxy.address, imaLinker.address);
    await imaLinker.registerMainnetContract(instance.address);
    return instance;
}