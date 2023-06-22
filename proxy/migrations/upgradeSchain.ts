import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import { CommunityLocker } from "../typechain/CommunityLocker";
import { contracts, getContractKeyInAbiFile } from "./deploySchain";
import { manifestSetup } from "./generateManifest";
import { encodeTransaction } from "./tools/multiSend";
import { upgrade } from "./upgrade";
import chalk from "chalk";
import { ethers } from "hardhat";

function stringValue(value: string | undefined) {
    if (value) {
        return value;
    } else {
        return "";
    }
}

async function main() {
    const pathToManifest: string = stringValue(process.env.MANIFEST);
    await manifestSetup( pathToManifest );
    await upgrade(
        "1.4.0",
        contracts,
        async (safeTransactions, abi) => {
            // deploying of new contracts
        },
        async( safeTransactions, abi ) => {
            // do initialization
        },
        "proxySchain"
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
