import { ethers } from "hardhat";
import { ContractManager, KeyStorage } from "../../../typechain";

const nameKeyStorage = "KeyStorage";

const BLSPublicKey = {
    x: {
        a: "8276253263131369565695687329790911140957927205765534740198480597854608202714",
        b: "12500085126843048684532885473768850586094133366876833840698567603558300429943",
    },
    y: {
        a: "7025653765868604607777943964159633546920168690664518432704587317074821855333",
        b: "14411459380456065006136894392078433460802915485975038137226267466736619639091",
    }
  }

export async function setCommonPublicKey(
    contractManager: ContractManager,
    schainName: string
) {
    const factory = await ethers.getContractFactory(nameKeyStorage);
    let keyStorageInstance: KeyStorage;
    if (await contractManager.getContract(nameKeyStorage) === "0x0000000000000000000000000000000000000000") {
        console.log("Schains Internal deployment");
        keyStorageInstance = await factory.deploy() as KeyStorage;
        await contractManager.setContractsAddress(nameKeyStorage, keyStorageInstance.address);
    } else {
        keyStorageInstance = await factory.attach(await contractManager.getContract(nameKeyStorage)) as KeyStorage;
    }

    await keyStorageInstance.setCommonPublicKey(ethers.utils.solidityKeccak256(['string'], [schainName]), BLSPublicKey);
}
