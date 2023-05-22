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
        "1.3.4",
        contracts,
        async (safeTransactions, abi) => {
            // deploying of new contracts
        },
        async( safeTransactions, abi ) => {
            const communityLockerName = "CommunityLocker";
            const communityLockerFactory = await ethers.getContractFactory(communityLockerName);
            const communityLockerAddress = abi[getContractKeyInAbiFile(communityLockerName) + "_address"];
            let communityLocker;
            if (communityLockerAddress) {
                communityLocker = communityLockerFactory.attach(communityLockerAddress) as CommunityLocker;
                console.log(chalk.yellow("Prepare transaction to initialize timestamp"));
                safeTransactions.push(encodeTransaction(
                    0,
                    communityLockerAddress,
                    0,
                    communityLocker.interface.encodeFunctionData("initializeTimestamp")
                ));
            } else {
                console.log(chalk.red("CommunityLocker was not found!"));
                console.log(chalk.red("Check your abi!!!"));
                process.exit(1);
            }
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
