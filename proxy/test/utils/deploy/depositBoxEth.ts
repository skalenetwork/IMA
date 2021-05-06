import { DepositBoxEthContract } from "../../../types/truffle-contracts";
import { MessageProxyForMainnetInstance } from "../../../types/truffle-contracts";
import { IMALinkerInstance } from "../../../types/truffle-contracts";
import { ContractManagerInstance } from "../../../types/truffle-contracts";

const DepositBoxEth: DepositBoxEthContract = artifacts.require("./DepositBoxEth");

export async function deployDepositBoxEth(
    contractManager: ContractManagerInstance,
    messageProxy: MessageProxyForMainnetInstance,
    imaLinker: IMALinkerInstance

) {
    const instance = await DepositBoxEth.new();
    await instance.initialize(contractManager.address, messageProxy.address, imaLinker.address);
    await imaLinker.registerMainnetContract(instance.address);
    return instance;
}