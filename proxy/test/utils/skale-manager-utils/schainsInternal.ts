import { ethers } from "hardhat";
import { ContractManager, SchainsInternal } from "../../../typechain";
import { stringKeccak256 } from "../helper";

const nameSchainsInternal = "SchainsInternal";

export async function initializeSchain(
    contractManager: ContractManager,
    schainName: string,
    owner: string,
    lifetime: number,
    deposit: number
) {
    const schainsInternalFactory = await ethers.getContractFactory(nameSchainsInternal);
    const schainsInternalAddres = await contractManager.getContract(nameSchainsInternal);
    const schainsInternal = schainsInternalFactory.attach(schainsInternalAddres) as SchainsInternal;
    await schainsInternal.initializeSchain(schainName, owner, lifetime, deposit);
}

export async function addNodesToSchain(
    contractManager: ContractManager,
    schainName: string,
    nodes: number[]
) {
    const schainsInternalFactory = await ethers.getContractFactory(nameSchainsInternal);
    const schainsInternalAddres = await contractManager.getContract(nameSchainsInternal);
    const schainsInternal = schainsInternalFactory.attach(schainsInternalAddres) as SchainsInternal;
    await schainsInternal.addNodesToSchainsGroups(ethers.utils.id(schainName), nodes);
}

export async function isSchainActive(
    contractManager: ContractManager,
    schainName: string
) {
    const factory = await ethers.getContractFactory(nameSchainsInternal);
    let schainsInternalInstance: SchainsInternal;
    if (await contractManager.getContract(nameSchainsInternal) === "0x0000000000000000000000000000000000000000") {
        console.log("Schains Internal deployment");
        schainsInternalInstance = await factory.deploy() as SchainsInternal;
        await contractManager.setContractsAddress(nameSchainsInternal, schainsInternalInstance.address);
    } else {
        schainsInternalInstance = await factory.attach(await contractManager.getContract(nameSchainsInternal)) as SchainsInternal;
    }
    return await schainsInternalInstance.isSchainActive(stringKeccak256(schainName));
}
