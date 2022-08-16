import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import { CommunityPool } from "../typechain";
import { contracts, getContractKeyInAbiFile } from "./deployMainnet";
import { encodeTransaction } from "./tools/multiSend";
import { upgrade } from "./upgrade";
import chalk from "chalk";

async function main() {
    await upgrade(
        "1.3.0",
        contracts,
        async (safeTransactions, abi) => undefined,
        async (safeTransactions, abi) => {
            const proxyAdmin = await getManifestAdmin(hre);
            const owner = await proxyAdmin.owner();
            const communityPoolName = "CommunityPool";
            const communityPoolFactory = await ethers.getContractFactory(communityPoolName);
            const communityPoolAddress = abi[getContractKeyInAbiFile(communityPoolName) + "_address"];
            let communityPool;
            if (communityPoolAddress) {
                communityPool = communityPoolFactory.attach(communityPoolAddress) as CommunityPool;
                const constantSetterRole = await communityPool.CONSTANT_SETTER_ROLE();
                const isHasRole = await communityPool.hasRole(constantSetterRole, owner);
                if (!isHasRole) {
                    console.log(chalk.yellow("Prepare transaction to grantRole CONSTANT_SETTER_ROLE to " + owner));
                    safeTransactions.push(encodeTransaction(
                        0,
                        communityPoolAddress,
                        0,
                        communityPool.interface.encodeFunctionData("grantRole", [constantSetterRole, owner])
                    ));
                }
                console.log(chalk.yellow("Prepare transaction to set multiplier to 3/2"));
                safeTransactions.push(encodeTransaction(
                    0,
                    communityPoolAddress,
                    0,
                    communityPool.interface.encodeFunctionData("setMultiplier", [3, 2])
                ));
                console.log(chalk.yellow("Prepare transaction to set header message gas cost to 73800"));
            } else {
                console.log(chalk.red("CommunityPool was not found!"));
                console.log(chalk.red("Check your abi!!!"));
                process.exit(1);
            }
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
