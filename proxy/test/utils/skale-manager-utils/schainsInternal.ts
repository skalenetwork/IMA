import { ethers } from "hardhat";
import { ContractManager, SchainsInternal } from "../../../typechain";

const nameSchainsInternal = "SchainsInternal";

export async function initializeSchain(
    contractManager: ContractManager,
    schainName: string,
    owner: string,
    lifetime: number,
    deposit: number
) {
    const schainsInternalFactory = await ethers.getContractFactory("SchainsInternal");
    const schainsInternalAddres = await contractManager.getContract("SchainsInternal");
    const schainsInternal = schainsInternalFactory.attach(schainsInternalAddres) as SchainsInternal;
    await schainsInternal.initializeSchain(schainName, owner, lifetime, deposit);
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
    return await schainsInternalInstance.isSchainActive(ethers.utils.solidityKeccak256(['string'], [schainName]));
}
