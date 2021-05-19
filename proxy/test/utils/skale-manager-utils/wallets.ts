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
        await walletsInstance.addContractManager(contractManager.address);
        await contractManager.setContractsAddress(nameWallets, walletsInstance.address);
    } else {
        walletsInstance = await walletsFactory.attach(await contractManager.getContract(nameWallets)) as Wallets;
    }

    const schainActive = await isSchainActive(contractManager, schainName);
    if ( !schainActive )
        await initializeSchain(contractManager, schainName, owner, 1, 1);

    const schainHash = await ethers.utils.solidityKeccak256(['string'], [schainName]);
    await walletsInstance.rechargeSchainWallet(schainHash, {value: amountEth /*"1000000000000000000"*/});
}
