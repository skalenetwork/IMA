import { Instance, skaleContracts } from "@skalenetwork/skale-contracts-ethers-v6";
import { JsonRpcProvider, Wallet } from "ethers";
import {ethers} from "hardhat";
import chalk from "chalk";
import { msigTestnetEndpoints } from "./migrateMainnet";
async function submitMarionetteTx(marionette: any, targetContract: string, data: string){
    const tx = await marionette.execute(
        targetContract,
        0,
        data,
        {gasLimit: 2_000_000}
    );
    await tx.wait();
}
async function changeLinkerAndPool(signer: Wallet, imaInstance: Instance, marionette: any) {
    const proxyAdmin = await ethers.getContractAt("ProxyAdmin", "0xd2aAa00000000000000000000000000000000000", signer);
    const pool = await imaInstance.getContractAddress("CommunityPool");
    const linker = await imaInstance.getContractAddress("Linker");
    const comLocker = await ethers.getContractAt("CommunityLocker", "0xD2aaa00300000000000000000000000000000000", signer);
    const tokenLinker = await ethers.getContractAt("TokenManagerLinker", "0xD2aAA00800000000000000000000000000000000", signer);
    const currentLockerImpl = await proxyAdmin.getProxyImplementation(await comLocker.getAddress());
    const currentTokenLinkerImpl = await proxyAdmin.getProxyImplementation(await tokenLinker.getAddress());

    const mockLocker = await (await ethers.deployContract("CommunityLocker", signer)).waitForDeployment();
    const mockLinker = await (await ethers.deployContract("TokenManagerLinker", signer)).waitForDeployment();

    const changeImplLockerData = proxyAdmin.interface.encodeFunctionData(
        "upgrade",
        [comLocker, mockLocker]
    );
    const revertImplLockerData = proxyAdmin.interface.encodeFunctionData(
        "upgrade",
        [comLocker, currentLockerImpl]
    );
    await submitMarionetteTx(marionette, await proxyAdmin.getAddress(), changeImplLockerData);
    await (await comLocker.setPoolAddress(pool)).wait();
    await submitMarionetteTx(marionette, await proxyAdmin.getAddress(), revertImplLockerData);
    if (await proxyAdmin.getProxyImplementation(await comLocker.getAddress()) != currentLockerImpl) {
        console.log("Community Pool Implementation address was not updated, current:", await proxyAdmin.getProxyImplementation(await comLocker.getAddress()));
        console.log("Expected:", currentLockerImpl);
    }
    if (await comLocker.communityPool() != pool) {
        console.log("CommunityPool address on CommunityLocker not updated");
    }

    const changeImplLinkerData = proxyAdmin.interface.encodeFunctionData(
        "upgrade",
        [tokenLinker, mockLinker]
    );
    const revertImplLinkerData = proxyAdmin.interface.encodeFunctionData(
        "upgrade",
        [tokenLinker, currentTokenLinkerImpl]
    );

    await submitMarionetteTx(marionette, await proxyAdmin.getAddress(), changeImplLinkerData);
    await (await tokenLinker.setLinkerAddress(linker)).wait();
    await submitMarionetteTx(marionette, await proxyAdmin.getAddress(), revertImplLinkerData);

    if (await proxyAdmin.getProxyImplementation(await tokenLinker.getAddress()) != currentTokenLinkerImpl) {
        console.log("TokenManagerLinker Implementation address was not updated, current:", await proxyAdmin.getProxyImplementation(await tokenLinker.getAddress()));
        console.log("Expected:", currentTokenLinkerImpl);
    }
    if (await tokenLinker.linkerAddress() != linker) {
        console.log("Linker address on TokenManagerLinker not updated, it is:", await tokenLinker.linkerAddress());
    }

    try {
        await (await tokenLinker.setLinkerAddress(linker)).wait();
    } catch (error) {
        console.log("Looks like success on TokenManagerLinker");
    }
    try {
        await (await comLocker.setPoolAddress(pool)).wait();
    } catch (error) {
        console.log("Looks like success on CommunityLocker");
    }
}

// The idea is to give PUPPETTEER ROLE to an EOA account on Schains, to be able to easily set the parameters during migration
// This script should run post Migration to set things on Schain side.
// After migration, if successfull, the EOA account will renounce it's role
const marionetteInterface = [{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"EtherReceived","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"receiver","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"EtherSent","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes","name":"output","type":"bytes"}],"name":"FunctionCallResult","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"version","type":"uint8"}],"name":"Initialized","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"previousAdminRole","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"newAdminRole","type":"bytes32"}],"name":"RoleAdminChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleGranted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"role","type":"bytes32"},{"indexed":true,"internalType":"address","name":"account","type":"address"},{"indexed":true,"internalType":"address","name":"sender","type":"address"}],"name":"RoleRevoked","type":"event"},{"inputs":[],"name":"ACCESS_VIOLATION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"DEFAULT_ADMIN_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"IMA_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PUPPETEER_ROLE","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"receiver","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"encodeFunctionCall","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"pure","type":"function"},{"inputs":[{"internalType":"address payable","name":"target","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"execute","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleAdmin","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"getRoleMember","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"}],"name":"getRoleMemberCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"grantRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"hasRole","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"ima","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"},{"internalType":"address","name":"sender","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"postMessage","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"renounceRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"role","type":"bytes32"},{"internalType":"address","name":"account","type":"address"}],"name":"revokeRole","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address payable","name":"target","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"sendEth","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"interfaceId","type":"bytes4"}],"name":"supportsInterface","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"stateMutability":"payable","type":"receive"}]
const marionetteMockInterface = new ethers.Interface(marionetteInterface);
const variable = false;
async function main() {
    if(variable){
        console.log(chalk.red("Check if you only have endpoints for MSIG schains and you set Schains new owner"));
        console.log(chalk.red("Check if you updated MessageProxy with correct linker and pool addresses"));
        process.exit(1);
    }
    if (!process.env.NEW_SCHAINS_OWNER) {
        console.log(chalk.red("Specify new Schains owner"));
        console.log(chalk.red("Set desired new Schains owner to NEW_SCHAINS_OWNER environment variable"));
        process.exit(1);
    }
    if (!process.env.SKALE_MANAGER_INSTANCE_MIGRATED) {
        console.log(chalk.red("Specify skale-manager instance already migrated"));
        console.log(chalk.red("Set desired migrated skale-manager instance to SKALE_MANAGER_INSTANCE_MIGRATED environment variable"));
        process.exit(1);
    }
    if (!process.env.PRIVATE_KEY) {
        console.log(chalk.red("Specify PRIVATE_KEY"));
        console.log(chalk.red("Set desired PRIVATE_KEY to PRIVATE_KEY environment variable"));
        process.exit(1);
    }

    const tokenManagers = [
        {manager:"TokenManagerERC20",box:"DepositBoxERC20"},
        {manager:"TokenManagerERC721",box:"DepositBoxERC721"},
        {manager:"TokenManagerERC721WithMetadata",box:"DepositBoxERC721WithMetadata"},
        {manager:"TokenManagerERC1155",box:"DepositBoxERC1155"},
        {manager:"TokenManagerEth",box:"DepositBoxEth"}
    ];

    for (const endpoint of msigTestnetEndpoints) {
        console.log("starting setting for:", endpoint.name);
        const url = endpoint.endpoint;
        const provider = new JsonRpcProvider(url);
        const signer = new Wallet(process.env.PRIVATE_KEY, provider);
        const marionette: any = await ethers.getContractAt(marionetteInterface, "0xD2c0DeFACe000000000000000000000000000000", signer);
        const hasRole = await marionette["hasRole"]("0xdbe8b307f60c9ed0e3764e9100b17f1d4c5fd58ba7889d208d166f481302d4cf", signer.address);
        if (!hasRole) {
            console.log("Signer does not have PUPPETTEER ROLE");
            console.log("Run again for", endpoint.name);
            continue;
        }

        const hoodiProvider = new JsonRpcProvider(process.env.HOODI_ENDPOINT);
        const schainNetwork = await skaleContracts.getNetworkByProvider(provider);
        const hoodiNetwork = await skaleContracts.getNetworkByProvider(hoodiProvider);
        const project = hoodiNetwork.getProject("mainnet-ima");
        const skaleManager = await hoodiNetwork.getProject("skale-manager").getInstance(process.env.SKALE_MANAGER_INSTANCE_MIGRATED);
        const instance = project.createInstance(await skaleManager.getContractAddress("MessageProxyForMainnet"));
        const schainInstance = await schainNetwork.getProject("schain-ima").getInstance("predeployed");

        for (const manager of tokenManagers) {
            const address = await instance.getContractAddress(manager.box);
            console.log(address);
            const tx = await marionette.execute(
                await schainInstance.getContractAddress(manager.manager),
                0,
                (await schainInstance.getContract(manager.manager)).interface.encodeFunctionData(
                    "changeDepositBoxAddress",
                    [address]
                ),
                {gasLimit: 2_000_000}
            );
            await tx.wait();
            console.log("SUCCESS set new box address for:", manager.manager);
        }

        let tx = await marionette.execute(
            "0xD2c0DeFACe000000000000000000000000000000",
            0,
            marionetteMockInterface.encodeFunctionData(
                "grantRole",
                [
                    "0xdbe8b307f60c9ed0e3764e9100b17f1d4c5fd58ba7889d208d166f481302d4cf",
                    process.env.NEW_SCHAINS_OWNER
                ]
            )
        );
        await tx.wait();

        try {
            tx = await marionette.execute(
                "0xD2c0DeFACe000000000000000000000000000000",
                0,
                marionetteMockInterface.encodeFunctionData(
                    "revokeRole",
                    [
                        "0xdbe8b307f60c9ed0e3764e9100b17f1d4c5fd58ba7889d208d166f481302d4cf",
                        signer.address
                    ]
                )
            );
        } catch (error) {
            // This should not stop things to move forward, we can retry later
            console.log(error);
            console.log("could not revoke rold for self. CHAIN:", endpoint.name);
        }
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

