import { ContractManagerInstance } from "../../../types/truffle-contracts";
import { WalletsContract, WalletsInstance } from "../../../types/truffle-contracts";

const wallets: WalletsContract = artifacts.require("./Wallets");
const nameWallets = "Wallets";

export async function rechargeSchainWallet(
    contractManager: ContractManagerInstance,
    schainName: string,
    amountEth: string
) {
    let walletsInstance: WalletsInstance;
    if (await contractManager.getContract(nameWallets) === "0x0000000000000000000000000000000000000000") {
        console.log("Schains Internal deployment");
        walletsInstance = await wallets.new();
        await walletsInstance.addContractManager(contractManager.address);
        await contractManager.setContractsAddress(nameWallets, walletsInstance.address);
    } else {
        walletsInstance = await wallets.at(await contractManager.getContract(nameWallets));
    }

    await walletsInstance.rechargeSchainWallet(web3.utils.soliditySha3(schainName), {value: amountEth /*"1000000000000000000"*/});
}
