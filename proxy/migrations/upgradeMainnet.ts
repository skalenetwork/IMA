import { MessageProxyForMainnet } from "../typechain";
import { contracts, getContractKeyInAbiFile } from "./deployMainnet";
import { encodeTransaction } from "./tools/multiSend";
import { upgrade } from "./upgrade";
import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import { ethers } from "hardhat";
import hre from "hardhat";
import chalk from "chalk";

async function main() {
    await upgrade(
        "1.3.0",
        contracts,
        async (safeTransactions, abi) => undefined,
        async (safeTransactions, abi) => {
            const proxyAdmin = await getManifestAdmin(hre);
            const owner = await proxyAdmin.owner();
            const messageProxyForMainnet = (await ethers.getContractFactory("MessageProxyForMainnet"))
            .attach(abi[getContractKeyInAbiFile("MessageProxyForMainnet") + "_address"]) as MessageProxyForMainnet;

            if (! await messageProxyForMainnet.hasRole(await messageProxyForMainnet.CONSTANT_SETTER_ROLE(), owner)) {
                console.log(chalk.yellow("Prepare transaction to grantRole CONSTANT_SETTER_ROLE to " + owner));
                safeTransactions.push(encodeTransaction(
                    0,
                    messageProxyForMainnet.address,
                    0,
                    messageProxyForMainnet.interface.encodeFunctionData(
                        "grantRole",
                        [ await messageProxyForMainnet.CONSTANT_SETTER_ROLE(), owner ]
                    )
                ));
            }

            console.log(chalk.yellow(
                "Prepare transaction to set header message gas cost to",
                (await messageProxyForMainnet.headerMessageGasCost()).toString()
            ));
            safeTransactions.push(encodeTransaction(
                0,
                messageProxyForMainnet.address,
                0,
                messageProxyForMainnet.interface.encodeFunctionData(
                    "setNewHeaderMessageGasCost",
                    [ await messageProxyForMainnet.headerMessageGasCost() ]
                )
            ));
        },
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
