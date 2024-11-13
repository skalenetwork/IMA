import { initializeSchain, isSchainActive } from "./schainsInternal";
import { ethers } from "hardhat";
import { ContractManager, Wallets } from "../../../typechain";

const nameWallets = "Wallets";

export async function rechargeSchainWallet(
    contractManager: ContractManager,
    schainName: string,
    owner: string,
    amountEth: string
) {
    const walletsFactory = await ethers.getContractFactory(nameWallets);
    let walletsInstance: Wallets;
    if (await contractManager.getContract(nameWallets) === "0x0000000000000000000000000000000000000000") {
        console.log("Schains Internal deployment");
        walletsInstance = await walletsFactory.deploy() as Wallets;
        await walletsInstance.addContractManager(await contractManager.getAddress());
        await contractManager.setContractsAddress(nameWallets, await walletsInstance.getAddress());
    } else {
        walletsInstance = await walletsFactory.attach(await contractManager.getContract(nameWallets)) as Wallets;
    }

    const schainActive = await isSchainActive(contractManager, schainName);
    if ( !schainActive )
        await initializeSchain(contractManager, schainName, owner, 1, 1);

    const schainHash = ethers.id(schainName);
    await walletsInstance.rechargeSchainWallet(schainHash, {value: amountEth /*"1000000000000000000"*/});
}
