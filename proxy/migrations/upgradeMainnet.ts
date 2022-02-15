import { ethers } from "hardhat";
import hre from "hardhat";
import { contracts, getContractKeyInAbiFile } from "./deployMainnet";
import { upgrade } from "./upgrade";
import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import { Manifest } from "@openzeppelin/upgrades-core";
import chalk from "chalk";
import { MessageProxyForMainnet, DepositBoxERC20, DepositBoxERC721, DepositBoxERC1155 } from "../typechain/";
import { encodeTransaction } from "./tools/multiSend";
import { TypedEvent, TypedEventFilter } from "../typechain/commons";
import { promises as fs } from "fs";
import { hexZeroPad } from "@ethersproject/bytes";
import { Contract } from "@ethersproject/contracts";

function prepareInitializeFromMap(
    safeTransactions: any,
    map: Map<string, string[]>,
    contract: Contract,
    functionName: string
) {
    map.forEach((value: string[], key: string) => {
        console.log(chalk.yellow("" + value.length + " items found for key " + key));
        console.log(value);
        safeTransactions.push(encodeTransaction(
            0,
            contract.address,
            0,
            contract.interface.encodeFunctionData(functionName, [key, value])
        ));
        console.log(chalk.yellow("Transaction initialize prepared"));
    });
}

async function runInitialize(
    safeTransactions: string[],
    events: TypedEvent<[string, string] & { schainName: string; contractOnMainnet: string; }>[],
    depositBox: DepositBoxERC20 | DepositBoxERC721 | DepositBoxERC1155,
    eventName: string
) {
    console.log(chalk.yellow("" + events.length + " events " + eventName + " found"));
    const schainToTokens = new Map<string, string[]>();
    for (const event of events) {
        const addedTokens = schainToTokens.get(event.args.schainName);
        if (addedTokens) {
            addedTokens.push(event.args.contractOnMainnet);
            schainToTokens.set(event.args.schainName, addedTokens);
        } else {
            schainToTokens.set(event.args.schainName, [event.args.contractOnMainnet]);
        }
    }
    prepareInitializeFromMap(safeTransactions, schainToTokens, depositBox, "initializeAllTokensForSchain");
}

async function findContractDeploymentBlock(address: string): Promise<number> {
    let left = 0;
    let right: number = 0;
    try {
        right = await ethers.provider.getBlockNumber();
    } catch (e) {
        console.log(chalk.red("Could not getBlockNumber"));
        console.log(e);
        process.exit(1);
    }

    while (left < right) {
        const mid = left + (right - left - (right - left) % 2) / 2;
        let codeSize: string = "";
        try {
            codeSize = await ethers.provider.getCode(address, mid);
        } catch (e) {
            console.log(chalk.red("Could not getCode"));
            console.log(e);
            process.exit(1);
        }
        if (codeSize === "") {
            console.log(chalk.red("Could not getCode - unknown reason"));
            process.exit(1);
        }
        else if (codeSize === "0x") {
            left = mid + 1;
        } else {
            right = mid
        }
        console.log(chalk.yellow("Successfully getCode for address " + address + " in block " + mid));
        console.log(chalk.yellow("Contract: " + (codeSize === "0x" ? "No" : "Yes")));
    }
    console.log(chalk.yellow("Successfully found block creation number for contract " + address + " in block " + left));
    return left;
}

async function getContractDeploymentBlock(address: string) {
    const manifest = await Manifest.forNetwork(hre.network.provider);
    const deploymentProxy = await manifest.getProxyFromAddress(address);
    let blockStart: number | undefined;
    if (deploymentProxy?.txHash) {
        const blockNumber = (await ethers.provider.getTransaction(deploymentProxy?.txHash)).blockNumber;
        if (blockNumber) {
            blockStart = blockNumber;
            console.log(chalk.yellow("Successfully extract block number for contract creation from manifest"));
            console.log(chalk.yellow("Contract " + address + " in block " + blockStart));
        }
    }
    if (!blockStart) {
        console.log(chalk.yellow("No deploy transaction in manifest for " + address));
        console.log(chalk.yellow("Will find block creation number"));
        blockStart = await findContractDeploymentBlock(address);
    }
    return blockStart;
}

async function findEventsAndInitialize(
    safeTransactions: string[],
    abi: any,
    depositBoxName: "DepositBoxERC20" | "DepositBoxERC721" | "DepositBoxERC1155",
    eventName: string
) {
    const depositBoxFactory = await ethers.getContractFactory(depositBoxName);
    const depositBoxAddress = abi[getContractKeyInAbiFile(depositBoxName) + "_address"];
    if (depositBoxAddress) {
        console.log(chalk.yellow("Will find all " + eventName + " events in " + depositBoxName + " and initialize"));
        let depositBox: DepositBoxERC20 | DepositBoxERC721 | DepositBoxERC1155;
        if (depositBoxName === "DepositBoxERC20") {
            depositBox = depositBoxFactory.attach(depositBoxAddress) as DepositBoxERC20;
        } else if (depositBoxName === "DepositBoxERC721") {
            depositBox = depositBoxFactory.attach(depositBoxAddress) as DepositBoxERC721;
        } else {
            depositBox = depositBoxFactory.attach(depositBoxAddress) as DepositBoxERC1155;
        }
        const eventFilter: TypedEventFilter<[string, string], { schainName: string, contractOnMainnet: string}> = {
            address: depositBoxAddress,
            topics: [ ethers.utils.id(eventName + "(string,address)") ]
        }
        const events = await depositBox.queryFilter(eventFilter, await getContractDeploymentBlock(depositBoxAddress));
        if (events.length > 0) {
            await runInitialize(safeTransactions, events, depositBox, eventName);
        } else {
            console.log(chalk.yellow("No events " + eventName + " found - no reason to run initialize"));
        }
    } else {
        console.log(chalk.red("" + depositBoxName + " was not found!"));
        console.log(chalk.red("Check your abi!!!"));
        process.exit(1);
    }
}

async function prepareContractRegisteredAndInitialize(
    safeTransactions: string[],
    abi: any,
    messageProxyForMainnet: MessageProxyForMainnet,
) {
    const chainToRegisteredContracts = new Map<string, string[]>();
    const contractsToRegisterForAll = [
        "Linker",
        "CommunityPool",
        "DepositBoxEth",
        "DepositBoxERC20",
        "DepositBoxERC721",
        "DepositBoxERc1155"
    ];
    const zeroHash = hexZeroPad("0x0", 32);
    for (const contract of contractsToRegisterForAll) {
        const addedRegisteredContracts = chainToRegisteredContracts.get(zeroHash);
        const address = abi[getContractKeyInAbiFile(contract) + "_address"];
        if (addedRegisteredContracts) {
            addedRegisteredContracts.push(address);
            chainToRegisteredContracts.set(zeroHash, addedRegisteredContracts);
        } else {
            chainToRegisteredContracts.set(zeroHash, [address]);
        }
    }
    const fileToAdditionalAddresses = process.env.REGISTERED_ADDRESSES;
    if (fileToAdditionalAddresses) {
        const addresses = JSON.parse(await fs.readFile(fileToAdditionalAddresses, "utf-8"));
        for (const hash of addresses) {
            for (const address of addresses[hash]) {
                const addedRegisteredContracts = chainToRegisteredContracts.get(hash);
                if (addedRegisteredContracts) {
                    addedRegisteredContracts.push(address);
                    chainToRegisteredContracts.set(hash, addedRegisteredContracts);
                } else {
                    chainToRegisteredContracts.set(hash, [address]);
                }
            }
        }
    }
    prepareInitializeFromMap(safeTransactions, chainToRegisteredContracts, messageProxyForMainnet, "initializeAllRegisteredContracts");
}

async function main() {
    await upgrade(
        "1.1.0",
        contracts,
        async (safeTransactions, abi) => undefined,
        async (safeTransactions, abi) => {
            const proxyAdmin = await getManifestAdmin(hre);
            const owner = await proxyAdmin.owner();
            const messageProxyForMainnetName = "MessageProxyForMainnet";
            const messageProxyForMainnetFactory = await ethers.getContractFactory(messageProxyForMainnetName);
            const messageProxyForMainnetAddress = abi[getContractKeyInAbiFile(messageProxyForMainnetName) + "_address"];
            let messageProxyForMainnet;
            if (messageProxyForMainnetAddress) {
                console.log(chalk.yellow("Prepare transaction to set message gas cost to 9000"));
                messageProxyForMainnet = messageProxyForMainnetFactory.attach(messageProxyForMainnetAddress) as MessageProxyForMainnet;
                const constantSetterRole = await messageProxyForMainnet.CONSTANT_SETTER_ROLE();
                const isHasRole = await messageProxyForMainnet.hasRole(constantSetterRole, owner);
                if (!isHasRole) {
                    console.log(chalk.yellow("Prepare transaction to grantRole CONSTANT_SETTER_ROLE to" + owner));
                    safeTransactions.push(encodeTransaction(
                        0,
                        messageProxyForMainnetAddress,
                        0,
                        messageProxyForMainnet.interface.encodeFunctionData("grantRole", [constantSetterRole, owner])
                    ));
                }
                safeTransactions.push(encodeTransaction(
                    0,
                    messageProxyForMainnetAddress,
                    0,
                    messageProxyForMainnet.interface.encodeFunctionData("setNewMessageGasCost", [9000])
                ));
            } else {
                console.log(chalk.red("MessageProxyForMainnet was not found!"));
                console.log(chalk.red("Check your abi!!!"));
                process.exit(1);
            }
            await findEventsAndInitialize(safeTransactions, abi, "DepositBoxERC20", "ERC20TokenAdded");
            await findEventsAndInitialize(safeTransactions, abi, "DepositBoxERC721", "ERC721TokenAdded");
            await findEventsAndInitialize(safeTransactions, abi, "DepositBoxERC1155", "ERC1155TokenAdded");
            await prepareContractRegisteredAndInitialize(safeTransactions, abi, messageProxyForMainnet);
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
