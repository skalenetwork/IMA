import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import { CommunityPool, MessageProxyForMainnet } from "../typechain";
import { contracts, getContractKeyInAbiFile } from "./deployMainnet";
import { encodeTransaction } from "./tools/multiSend";
import { upgrade } from "./upgrade";
import chalk from "chalk";
import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
    await upgrade(
        "1.3.4",
        contracts,
        async (safeTransactions, abi) => undefined,
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
