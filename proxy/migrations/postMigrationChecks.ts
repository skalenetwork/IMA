import chalk from "chalk";
import { JsonRpcProvider, keccak256, toUtf8Bytes, Wallet } from "ethers";
import { Instance, skaleContracts } from "@skalenetwork/skale-contracts-ethers-v6";
import { CommunityPool, Linker, MessageProxyForMainnet, SchainsInternal, TokenManager } from "../typechain";
import { contracts } from "./deployMainnet";
import { msigTestnetEndpoints } from "./migrateMainnet";
import { ethers } from "hardhat";
import { Command } from "commander";
const marionetteInterface = [{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"EtherReceived","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"receiver","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"EtherSent","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes","name":"output","type":"bytes"}],"name":"FunctionCallResult","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"version","type":"uint8"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"inputs":[],"name":"ACCESS_VIOLATION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"IMA_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PUPPETEER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"encodeFunctionCall","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address payable","name":"target","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"execute","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"ima","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"},{"internalType":"address","name":"sender","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"postMessage","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address payable","name":"target","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"sendEth","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"stateMutability":"payable","type":"receive"}]
//const marionetteMockInterface = new ethers.Interface(marionetteInterface);

const program = new Command();
program.option("--noschain", "Does not check Schain changes");
program.parse(process.argv);
function hashName(name: string): string {
  return keccak256(toUtf8Bytes(name));
}
export async function checkCounters(
    imaInstance: Instance,
    endpoints: {name: string, endpoint: string}[],
){
    const proxy = await imaInstance.getContract("MessageProxyForMainnet") as unknown as MessageProxyForMainnet;

    for (const schain of endpoints) {
        const url = schain.endpoint;
        const provider = new JsonRpcProvider(url);
        const signer = Wallet.createRandom(provider);
        const hash = hashName(schain.name);
        const proxyForSchain = await ethers.getContractAt("MessageProxyForSchain","0xd2AAa00100000000000000000000000000000000", signer);
        const schainInfo = await proxyForSchain.connectedChains("0x8d646f556e5d9d6f1edcf7a39b77f5ac253776eb34efcfd688aacbee518efc26");
        const mainnetInfo = await proxy.connectedChains(hash);
        console.log(schainInfo);
        console.log(mainnetInfo);
        if (schainInfo.outgoingMessageCounter > mainnetInfo.incomingMessageCounter) {
            console.log("Schain",schain.name,"has outgoing message not received by Mainnet");
            console.log("ABORT");
            return false;
        }
        else if (schainInfo.incomingMessageCounter < mainnetInfo.outgoingMessageCounter) {
            console.log("Mainnet has pending messages to:", schain.name);
            console.log("ABORT");
            return false;
        }
    }
    return true;
}


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
    if (!process.env.HOODI_ENDPOINT) {
        console.log(chalk.red("Specify HOODI_ENDPOINT"));
        process.exit(1);
    }
    if (!process.env.ARCHIVE_NODE_ENDPOINT) {
        console.log(chalk.red("Specify ARCHIVE_NODE_ENDPOINT"));
        process.exit(1);
    }
    const holeskyProvider = new JsonRpcProvider(process.env.ARCHIVE_NODE_ENDPOINT);
    const hoodiProvider = new JsonRpcProvider(process.env.HOODI_ENDPOINT);
    const hoodiNetwork = await skaleContracts.getNetworkByProvider(hoodiProvider);
    const holeskyNetwork = await skaleContracts.getNetworkByProvider(holeskyProvider);
    const oldSkaleManager = await holeskyNetwork.getProject("skale-manager").getInstance(process.env.SKALE_MANAGER_INSTANCE);
    const newSkaleManager = await hoodiNetwork.getProject("skale-manager").getInstance(process.env.SKALE_MANAGER_INSTANCE_MIGRATED);
    const oldIMA = await holeskyNetwork.getProject("mainnet-ima").getInstance(await oldSkaleManager.getContractAddress("MessageProxyForMainnet"));
    const newIMA = await hoodiNetwork.getProject("mainnet-ima").getInstance(await newSkaleManager.getContractAddress("MessageProxyForMainnet"));

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
    return newSchanHashes;
}
async function checkMainnetIMA(
    oldIMA: Instance,
    newIMA: Instance,
    oldProvider: JsonRpcProvider,
    newProvider: JsonRpcProvider,
    schainHashes: string[],
    newSkaleManager: Instance
){
    // Check if contracts are registered.
    oldIMA.version = "1.5.0-stable.0";
    newIMA.version = "1.5.0-stable.0";
    const newSchainsInternal = (await newSkaleManager.getContract("SchainsInternal")) as unknown as SchainsInternal;
    const newProxy = await newIMA.getContract("MessageProxyForMainnet") as unknown as MessageProxyForMainnet;
    const oldProxy = await oldIMA.getContract("MessageProxyForMainnet") as unknown as MessageProxyForMainnet;
    let ok = true;
    for (const contract of contracts){
        const oldAddress = await oldIMA.getContractAddress(contract);
        const newAddress = await newIMA.getContractAddress(contract);
        if (oldAddress == newAddress) {
            console.log(`${contract} is not Registered correctly on Contract Manager.`);
            console.log(`Old was ${oldAddress} new is ${newAddress}.`);
            // Fatal.. something went wrong during migration
            process.exit(1);
        }
        for (const hash of schainHashes) {
            if (
                await oldProxy.isContractRegistered(hash, oldAddress) &&
                !await newProxy.isContractRegistered(hash, newAddress)
            ) {
                console.log(`${contract} is not Registered correctly for Schain ${hash}, but was before.`);
                ok = false;
            }
        }
        if (await oldProvider.getBalance(oldAddress) !== await newProvider.getBalance(newAddress)) {
            console.log(`${contract} does not have the same balance on both Schains.`);
            ok = false;
        }
    }
    if (!ok) process.exit(1);
    for (const hash of schainHashes) {
        if (
            await oldProxy.isContractRegistered(hash, process.env.SCHAIN_OWNER!) &&
            !await newProxy.isContractRegistered(hash, process.env.NEW_SCHAINS_OWNER!)
        ) {
            console.log(`New Owner is not Registered correctly for Schain ${hash}, but was before.`);
            ok = false;
        }
    }
    if (!ok) process.exit(1);

    const newLinker = await newIMA.getContract("Linker") as unknown as Linker;
    const newPool = await newIMA.getContract("CommunityPool") as unknown as CommunityPool;
    const oldLinker = await oldIMA.getContract("Linker") as unknown as Linker;
    const oldPool = await oldIMA.getContract("CommunityPool") as unknown as CommunityPool;

    if (await newPool.contractManagerOfSkaleManager() === await oldPool.contractManagerOfSkaleManager()) {
        console.log(`New contractManagerOfSkaleManager was not changed correctly for CommunityPool.`);
        ok = false;
    }
    if (await newLinker.contractManagerOfSkaleManager() === await oldLinker.contractManagerOfSkaleManager()) {
        console.log(`New contractManagerOfSkaleManager was not changed correctly for Linker.`);
        ok = false;
    }
    if (!ok) process.exit(1);

    for (const hash of schainHashes){
        const name = await newSchainsInternal.getSchainName(hash);
        if (!await newLinker.hasSchain(name)){
            console.log("Something wrong in mainnetContracts on Linker");
            ok = false;
        }
    }
    if (!ok) process.exit(1);

    // check if old owner was registered

}
async function checkSchainIMA(
    newIMA: Instance,
    schainsInfo: {name: string, endpoint: string}[]
){

    let ok = await checkCounters(newIMA, schainsInfo);
    if (!ok) process.exit(1);
    for (const schain of schainsInfo) {
        const url = schain.endpoint;
        const provider = new JsonRpcProvider(url);
        const signer = Wallet.createRandom(provider);
        const marionette: any = await ethers.getContractAt(marionetteInterface, "0xD2c0DeFACe000000000000000000000000000000", signer);
        const ownerIsPuppetteer = await marionette["hasRole"](
            "0xdbe8b307f60c9ed0e3764e9100b17f1d4c5fd58ba7889d208d166f481302d4cf",
            process.env.NEW_SCHAINS_OWNER
        );
        if (!ownerIsPuppetteer) {
            console.log("New Owner does not have PUPPETTEER ROLE in Schain:", schain.name);
            process.exit(1);
        }
        const teamEOAisPuppetteer = await marionette["hasRole"](
            "0xdbe8b307f60c9ed0e3764e9100b17f1d4c5fd58ba7889d208d166f481302d4cf",
            (await ethers.getSigners())[0].address //use Schain owner
        );
        if (teamEOAisPuppetteer) {
            console.log("Team's account still has PUPPETTEER ROLE in Schain:", schain.name);
            // Not fatal. Just revoke role afterwards
        }
        const schainNetwork = await skaleContracts.getNetworkByProvider(provider);
        const schainInstance = await schainNetwork.getProject("schain-ima").getInstance("predeployed");
        const tokenManagers = [
            {manager:"TokenManagerERC20",box:"DepositBoxERC20"},
            {manager:"TokenManagerERC721",box:"DepositBoxERC721"},
            {manager:"TokenManagerERC721WithMetadata",box:"DepositBoxERC721WithMetadata"},
            {manager:"TokenManagerERC1155",box:"DepositBoxERC1155"},
            {manager:"TokenManagerEth",box:"DepositBoxEth"}
        ];
        for (const items of tokenManagers) {
            const managerContract = await schainInstance.getContract(items.manager) as unknown as TokenManager;
            if (await managerContract.depositBox() != await newIMA.getContractAddress(items.box)) {
                console.log(`${items.box} address not updated for ${schain.name}`);
                ok = false;
            }
        }
        if (!ok) process.exit(1);
    }
}

async function main() {
    const {
        oldIMA,
        newIMA,
        oldSkaleManager,
        newSkaleManager,
        hoodiProvider,
        holeskyProvider
    } = await checkEnv();

    const schainHashes = await checkSkaleManager(
        newSkaleManager,
        oldSkaleManager,
        hoodiProvider,
        holeskyProvider
    );
    console.log("Success on Skale-Manager");

    /*await checkMainnetIMA(
        oldIMA,
        newIMA,
        hoodiProvider,
        holeskyProvider,
        schainHashes,
        newSkaleManager
    );*/
    console.log("Success on IMA");

    const options = program.opts();

    await checkSchainIMA(
        newIMA,
        msigTestnetEndpoints
    );
    console.log("Success on Schains");

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
