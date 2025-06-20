import chalk from "chalk";
import { JsonRpcProvider } from "ethers";
import { Instance, skaleContracts } from "@skalenetwork/skale-contracts-ethers-v6";
import { SchainsInternal } from "../typechain";

async function checkEnv(){
    if (!process.env.NEW_SCHAINS_OWNER) {
        console.log(chalk.red("Specify new Schains owner"));
        console.log(chalk.red("Set desired new Schains owner to NEW_SCHAINS_OWNER environment variable"));
        process.exit(1);
    }
    if (!process.env.SCHAIN_OWNER) {
        console.log(chalk.red("Specify new Schains owner"));
        console.log(chalk.red("Set desired new Schains owner to NEW_SCHAINS_OWNER environment variable"));
        process.exit(1);
    }
    if (!process.env.SKALE_MANAGER_INSTANCE_MIGRATED) {
        console.log(chalk.red("Specify skale-manager instance already migrated"));
        console.log(chalk.red("Set desired migrated skale-manager instance to SKALE_MANAGER_INSTANCE_MIGRATED environment variable"));
        process.exit(1);
    }
    if (!process.env.SKALE_MANAGER_INSTANCE) {
        console.log(chalk.red("Specify skale-manager linked to IMA instance to migrate"));
        console.log(chalk.red("Set desired old skale-manager instance to SKALE_MANAGER_INSTANCE environment variable"));
        process.exit(1);
    }
    if (!process.env.PRIVATE_KEY) {
        console.log(chalk.red("Specify PRIVATE_KEY"));
        console.log(chalk.red("Set desired PRIVATE_KEY to PRIVATE_KEY environment variable"));
        process.exit(1);
    }
    if (!process.env.HOODI_ENDPOINT) {
        console.log(chalk.red("Specify HOODI_ENDPOINT"));
        process.exit(1);
    }
    if (!process.env.ARCHIVE_NODE_ENDPOINT) {
        console.log(chalk.red("Specify ARCHIVE_NODE_ENDPOINT"));
        process.exit(1);
    }
    if (!process.env.PRIVATE_KEY) {
        console.log(chalk.red("Specify PRIVATE_KEY - no write operations will be made"));
        process.exit(1);
    }
    const holeskyProvider = new JsonRpcProvider(process.env.ARCHIVE_NODE_ENDPOINT);
    const hoodiProvider = new JsonRpcProvider(process.env.HOODI_ENDPOINT);
    const hoodiNetwork = await skaleContracts.getNetworkByProvider(hoodiProvider);
    const holeskyNetwork = await skaleContracts.getNetworkByProvider(holeskyProvider);
    const oldSkaleManager = await holeskyNetwork.getProject("skale-manager").getInstance(process.env.SKALE_MANAGER_INSTANCE);
    const newSkaleManager = await hoodiNetwork.getProject("skale-manager").getInstance(process.env.SKALE_MANAGER_INSTANCE_MIGRATED);
    const oldIMA = await holeskyNetwork.getProject("mainnet-ima").getInstance(await oldSkaleManager.getContractAddress("MessageProxyForMainnet"));
    const newIMA = await holeskyNetwork.getProject("mainnet-ima").getInstance(await newSkaleManager.getContractAddress("MessageProxyForMainnet"));

    return  {
        oldIMA,
        newIMA,
        oldSkaleManager,
        newSkaleManager,
        hoodiProvider,
        holeskyProvider
    }
}
async function checkSkaleManager(
    newSkaleManager: Instance,
    oldSkaleManager: Instance,
    hoodiProvider: JsonRpcProvider,
    holeskyProvider: JsonRpcProvider
){
    const oldSchainsInternal = (await oldSkaleManager.getContract("SchainsInternal")) as unknown as SchainsInternal;
    const newSchainsInternal = (await newSkaleManager.getContract("SchainsInternal")) as unknown as SchainsInternal;
    const oldSchainHashes = await oldSchainsInternal.getSchains();
    const newSchanHashes = await newSchainsInternal.getSchains();
    try {
        oldSchainHashes.forEach(s => {
            if (!newSchanHashes.includes(s)) {
                throw new Error("Damn man");
            }
        })
    } catch (error) {
        console.log("SchainHashes do not match!");
        console.log("Old:", oldSchainHashes);
        console.log("New:", newSchanHashes);
        process.exit(1);
    }
    const schainHashes = oldSchainHashes
    for (const chain of oldSchainHashes) {
        const oldSchain = await oldSchainsInternal.schains(chain);
        const newSchain = await newSchainsInternal.schains(chain);
        if (oldSchain.owner == newSchain.owner) {
            if ((await holeskyProvider.getCode(oldSchain.owner)).length > 2) {
                console.log("Schain owners not updated correctly");
                process.exit(1);
            }
        }
        else {
            if (
                (await holeskyProvider.getCode(oldSchain.owner)).length < 2 ||
                (await hoodiProvider.getCode(newSchain.owner)).length < 2
            ) {
                console.log("Schain owners should have been updated");
                process.exit(1);
            }
        }
        if (oldSchain.name != newSchain.name ||
            oldSchain.partOfNode != newSchain.partOfNode ||
            oldSchain.lifetime != newSchain.lifetime ||
            oldSchain.deposit != newSchain.deposit ||
            oldSchain.indexInOwnerList != newSchain.indexInOwnerList ||
            oldSchain.index != newSchain.index
        ) {
            console.log("Some Schain Data is incorrect. Has equal attributes that should be changed");
            console.log(oldSchain, newSchain);
            process.exit(1);
        }

        if (oldSchain.startDate == newSchain.startDate ||
            oldSchain.startBlock == newSchain.startBlock
        ) {
            console.log("Some Schain Data is incorrect. Should have been updated");
            console.log(oldSchain, newSchain);
            process.exit(1);
        }
    }
}
async function checkMainnetIMA(
    oldIMA: Instance,
    newIMA: Instance,
){

}
async function checkSchainIMA(){}

async function main() {
    const {
        oldIMA,
        newIMA,
        oldSkaleManager,
        newSkaleManager,
        hoodiProvider,
        holeskyProvider
    } = await checkEnv();

    await checkSkaleManager(
        newSkaleManager,
        oldSkaleManager,
        hoodiProvider,
        holeskyProvider
    );

    await checkMainnetIMA(
        oldIMA,
        newIMA
    );
    await checkSchainIMA();
    console.log("PERFECT!");
}


if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
