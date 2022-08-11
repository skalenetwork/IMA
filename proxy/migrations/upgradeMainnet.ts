import { MessageProxyForMainnet } from "../typechain";
import { contracts, getContractKeyInAbiFile } from "./deployMainnet";
import { encodeTransaction } from "./tools/multiSend";
import { upgrade } from "./upgrade";
import { ethers } from "hardhat";

async function main() {
    await upgrade(
        "1.3.0",
        contracts,
        async (safeTransactions, abi) => undefined,
        async (safeTransactions, abi) => {
            const messageProxyForMainnet = (await ethers.getContractFactory("MessageProxyForMainnet"))
            .attach(abi[getContractKeyInAbiFile("MessageProxyForMainnet") + "_address"]) as MessageProxyForMainnet;

            safeTransactions.push(encodeTransaction(
                0,
                messageProxyForMainnet.address,
                0,
                messageProxyForMainnet.interface.encodeFunctionData(
                    "setNewHeaderMessageGasCost",
                    [ await messageProxyForMainnet.headerMessageGasCost() ]),
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
