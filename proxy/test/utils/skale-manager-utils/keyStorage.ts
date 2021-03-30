import { ContractManagerInstance } from "../../../types/truffle-contracts";
import { KeyStorageContract, KeyStorageInstance } from "../../../types/truffle-contracts";

const keyStorage: KeyStorageContract = artifacts.require("./KeyStorage");
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
    contractManager: ContractManagerInstance,
    schainName: string
) {
    let keyStorageInstance: KeyStorageInstance;
    if (await contractManager.getContract(nameKeyStorage) === "0x0000000000000000000000000000000000000000") {
        console.log("Schains Internal deployment");
        keyStorageInstance = await keyStorage.new();
        await contractManager.setContractsAddress(nameKeyStorage, keyStorageInstance.address);
    } else {
        keyStorageInstance = await keyStorage.at(await contractManager.getContract(nameKeyStorage));
    }

    await keyStorageInstance.setCommonPublicKey(web3.utils.soliditySha3(schainName), BLSPublicKey);
}
