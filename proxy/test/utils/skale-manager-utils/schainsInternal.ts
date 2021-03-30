import { ContractManagerInstance } from "../../../types/truffle-contracts";
import { SchainsInternalContract, SchainsInternalInstance } from "../../../types/truffle-contracts";

const schainsInternal: SchainsInternalContract = artifacts.require("./SchainsInternal");
const nameSchainsInternal = "SchainsInternal";

export async function initializeSchain(
    contractManager: ContractManagerInstance,
    schainName: string,
    owner: string,
    lifetime: number,
    deposit: number
) {
    let schainsInternalInstance: SchainsInternalInstance;
    if (await contractManager.getContract(nameSchainsInternal) === "0x0000000000000000000000000000000000000000") {
        console.log("Schains Internal deployment");
        schainsInternalInstance = await schainsInternal.new();
        await contractManager.setContractsAddress(nameSchainsInternal, schainsInternalInstance.address);
    } else {
        schainsInternalInstance = await schainsInternal.at(await contractManager.getContract(nameSchainsInternal));
    }
    await schainsInternalInstance.initializeSchain(schainName, owner, lifetime, deposit);
}

export async function isSchainActive(
    contractManager: ContractManagerInstance,
    schainName: string
) {
    let schainsInternalInstance: SchainsInternalInstance;
    if (await contractManager.getContract(nameSchainsInternal) === "0x0000000000000000000000000000000000000000") {
        console.log("Schains Internal deployment");
        schainsInternalInstance = await schainsInternal.new();
        await contractManager.setContractsAddress(nameSchainsInternal, schainsInternalInstance.address);
    } else {
        schainsInternalInstance = await schainsInternal.at(await contractManager.getContract(nameSchainsInternal));
    }
    return await schainsInternalInstance.isSchainActive(web3.utils.soliditySha3(schainName));
}
