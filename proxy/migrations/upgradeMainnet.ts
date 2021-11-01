import { ethers } from "hardhat";
import hre from "hardhat";
import { contracts, getContractKeyInAbiFile } from "./deployMainnet";
import { upgrade } from "./upgrade";
import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import { getImplementationAddress, hashBytecode, Manifest } from "@openzeppelin/upgrades-core";
import chalk from "chalk";
import { MessageProxyForMainnet, DepositBoxERC20, DepositBoxERC721, DepositBoxERC1155, DepositBox } from "../typechain/";
import { encodeTransaction } from "./tools/multiSend";
import { TypedEvent, TypedEventFilter } from "../typechain/commons";

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
        } else {
            schainToTokens.set(event.args.schainName, [event.args.contractOnMainnet]);
        }

    }
    schainToTokens.forEach((tokens: string[], schainName: string) => {
        console.log(chalk.yellow("" + tokens.length + " tokens found for schain " + schainName));
        console.log(tokens);
        console.log(chalk.yellow("Will prepare " + (tokens.length - 1) / 10 + 1 + " transaction" + ((tokens.length - 1) / 10 > 0 ? "s" : "") + " initialize"));
        for (let i = 0; i * 10 < tokens.length; i++) {
            let tokensRange: string[];
            if ((i + 1) * 10 < tokens.length) {
                tokensRange = tokens.slice(i * 10, (i + 1) * 10);
            } else {
                tokensRange = tokens.slice(i * 10, tokens.length);
            }
            safeTransactions.push(encodeTransaction(
                0,
                depositBox.address,
                0,
                depositBox.interface.encodeFunctionData("initializeAllTokensForSchain", [schainName, tokensRange])
            ));
            console.log(chalk.yellow("" + i + 1 + " transaction initialize prepared"));
        }
    });
}

async function getBlockNumber(tries: number = 3): Promise<number> {
    let block = 0;
    let successful = false;
    while (!successful && tries > 0) {
        try {
            block = await ethers.provider.getBlockNumber();
            successful = true;
            console.log(chalk.yellow("Successfully getBlockNumber " + block));
        } catch(e) {
            console.log(chalk.red("Error getBlockNumber"));
            console.log(e);
        }
        tries--;
    }
    return block;
}

async function getCode(address: string, blockNumber: number, tries: number = 3): Promise<string> {
    let code = "0x";
    let successful = false;
    while (!successful && tries > 0) {
        try {
            code = await ethers.provider.getCode(address, blockNumber);
            successful = true;
            console.log(chalk.yellow("Successfully getCode for address " + address + " in block " + blockNumber));
            console.log(chalk.yellow("Contract: " + (code === "0x" ? "No" : "Yes")));
        } catch(e) {
            console.log(chalk.red("Error getCode"));
            console.log(e);
        }
        tries--;
    }
    return code;
}

async function getContractDeploymentBlock(address: string): Promise<number> {
    let left = 0;
    let right = await getBlockNumber();

    while (left < right) {
        const mid = left + (right - left - (right - left) % 2) / 2;
        const codeSize = await getCode(address, mid);
        if (codeSize === "0x") {
            left = mid + 1;
        } else {
            right = mid
        }
    }
    console.log(chalk.yellow("Successfully found block creation number for contract " + address + " in block " + left));
    return left;
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
        const blockStart = await getContractDeploymentBlock(depositBoxAddress);
        const events = await depositBox.queryFilter(eventFilter, blockStart);
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
            if (messageProxyForMainnetAddress) {
                console.log(chalk.yellow("Prepare transaction to set message gas cost to 9000"));
                const messageProxyForMainnet = messageProxyForMainnetFactory.attach(messageProxyForMainnetAddress) as MessageProxyForMainnet;
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
