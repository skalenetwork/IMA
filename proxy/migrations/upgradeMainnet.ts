import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import { ethers } from "hardhat";
import { MessageProxyForMainnet } from "../typechain/MessageProxyForMainnet";
import { contracts, getContractKeyInAbiFile } from "./deployMainnet";
import { encodeTransaction } from "./tools/multiSend";
import { upgrade } from "./upgrade";
import chalk from "chalk";

async function main() {
    await upgrade(
        "1.3.0",
        contracts,
        async (safeTransactions, abi) => {
            const proxyAdmin = await getManifestAdmin(hre);
             const owner = await proxyAdmin.owner();
             const messageProxyForMainnetName = "MessageProxyForMainnet";
             const messageProxyForMainnetFactory = await ethers.getContractFactory(messageProxyForMainnetName);
             const messageProxyForMainnetAddress = abi[getContractKeyInAbiFile(messageProxyForMainnetName) + "_address"];
             let messageProxyForMainnet;
             if (messageProxyForMainnetAddress) {
                 messageProxyForMainnet = messageProxyForMainnetFactory.attach(messageProxyForMainnetAddress) as MessageProxyForMainnet;
                 const constantSetterRole = await messageProxyForMainnet.CONSTANT_SETTER_ROLE();
                 const isHasRole = await messageProxyForMainnet.hasRole(constantSetterRole, owner);
                 if (!isHasRole) {
                     console.log(chalk.yellow("Prepare transaction to grantRole CONSTANT_SETTER_ROLE to " + owner));
                     safeTransactions.push(encodeTransaction(
                         0,
                         messageProxyForMainnetAddress,
                         0,
                         messageProxyForMainnet.interface.encodeFunctionData("grantRole", [constantSetterRole, owner])
                     ));
                 }
                 console.log(chalk.yellow("Prepare transaction to set header message gas cost to 78888"));
                 safeTransactions.push(encodeTransaction(
                     0,
                     messageProxyForMainnetAddress,
                     0,
                     messageProxyForMainnet.interface.encodeFunctionData("setNewHeaderMessageGasCost", [78888])
                 ));
             } else {
                 console.log(chalk.red("MessageProxyForMainnet was not found!"));
                 console.log(chalk.red("Check your abi!!!"));
                 process.exit(1);
             }
        },
        async (safeTransactions, abi) => undefined,
        "proxyMainnet"
    );
}

if( require.main === module ) {
    main()
        .then( () => process.exit( 0 ) )
        .catch( error => {
            console.error( error );
            process.exit( 1 );
        } );
}
function hre(hre: any) {
    throw new Error("Function not implemented.");
}

