import { ContractManagerInstance } from "../../../types/truffle-contracts";
import { WalletsContract, WalletsInstance } from "../../../types/truffle-contracts";
import { initializeSchain, isSchainActive } from "./schainsInternal";

const wallets: WalletsContract = artifacts.require("./Wallets");
const nameWallets = "Wallets";

export async function rechargeSchainWallet(
    contractManager: ContractManagerInstance,
    schainName: string,
    owner: string,
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

    const schainActive = await isSchainActive(contractManager, schainName);
    if ( !schainActive )
        await initializeSchain(contractManager, schainName, owner, 1, 1);

    const schainId = await web3.utils.soliditySha3(schainName);
    await walletsInstance.rechargeSchainWallet(schainId, {value: amountEth /*"1000000000000000000"*/});
}
