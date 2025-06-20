import {skaleContracts} from "@skalenetwork/skale-contracts-ethers-v6";
import {ethers, upgrades} from "hardhat";

import { contracts } from "./deployMainnet";
import {verifyProxy} from "@skalenetwork/upgrade-tools";
async function main() {
    //const newNetwork = await skaleContracts.getNetworkByProvider(ethers.provider);

    //const mainnetIMAProject = newNetwork.getProject("mainnet-ima");
    //const mainnetIMAInstance = await mainnetIMAProject.getInstance("0xDdbBd1d7d6A1859A1869dEE1CB3B22Ef0FdF96BC");
    const factory = await ethers.getContractFactory("MessageProxyForMainnet");
    const contract = await upgrades.upgradeProxy("0xDdbBd1d7d6A1859A1869dEE1CB3B22Ef0FdF96BC", factory);
    await contract.waitForDeployment();
    /*const msgProxy = await ethers.getContractAt("MessageProxyForMainnet", "0xDdbBd1d7d6A1859A1869dEE1CB3B22Ef0FdF96BC")
    const
    const addresses = new Map<string,string>();
    for(const contract of contracts){
        if (contract == "MessageProxyForMainnet") continue;
        const address = await mainnetIMAInstance.getContractAddress(contract);
        addresses.set(contract, address);
        const tx = await msgProxy.registerExtraContractForAll(address);
        await tx.wait();
    }*/



    console.log("Done");
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
