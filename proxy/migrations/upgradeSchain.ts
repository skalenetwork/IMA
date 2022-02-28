import { MessageProxyForSchain, TokenManagerERC20, TokenManagerERC721, TokenManagerERC1155 } from "../typechain";
import { contracts, getContractKeyInAbiFile } from "./deploySchain";
import { manifestSetup } from "./generateManifest";
import { encodeTransaction } from "./tools/multiSend";
import { upgrade } from "./upgrade";
import { hexZeroPad } from "@ethersproject/bytes";
import chalk from "chalk";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { promises as fs } from "fs";
import { TypedEvent, TypedEventFilter } from "../typechain/commons";

function stringValue(value: string | undefined) {
    if (value) {
        return value;
    } else {
        return "";
    }
}

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

async function prepareContractRegisteredAndInitialize(
    safeTransactions: string[],
    abi: any,
    messageProxyForSchain: MessageProxyForSchain,
) {
    const chainToRegisteredContracts = new Map<string, string[]>();
    const contractsToRegisterForAll = [
        "CommunityLocker",
        "TokenManagerEth",
        "TokenManagerERC20",
        "TokenManagerERC721",
        "TokenManagerERc1155"
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
    prepareInitializeFromMap(safeTransactions, chainToRegisteredContracts, messageProxyForSchain, "initializeAllRegisteredContracts");
}

async function runInitialize(
    safeTransactions: string[],
    abi: any,
    events: TypedEvent<[string, string] & { tokenOnMainnet: string; tokenOnSchain: string; }>[],
    tokenManagerName: "TokenManagerERC20" | "TokenManagerERC721" | "TokenManagerERC1155",
    eventName: string
) {
    console.log(chalk.yellow("" + events.length + " events " + eventName + " found"));
    const tokensToClones = new Map<string, string[]>();
    for (const event of events) {
        const addedTokens = tokensToClones.get(event.args.tokenOnMainnet);
        if (!addedTokens) {
            tokensToClones.set(event.args.tokenOnMainnet, [event.args.tokenOnSchain]);
        }
    }
    const tokenManagerFactory = await ethers.getContractFactory(tokenManagerName);
    const tokenManagerAddress = abi[getContractKeyInAbiFile(tokenManagerName) + "_address"];
    if (tokenManagerAddress) {
        let tokenManager: TokenManagerERC20 | TokenManagerERC721 | TokenManagerERC1155;
        let functionName: string;
        if (tokenManagerName === "TokenManagerERC20") {
            tokenManager = tokenManagerFactory.attach(tokenManagerAddress) as TokenManagerERC20;
            functionName = "initializeAllClonesERC20";
        } else if (tokenManagerName === "TokenManagerERC721") {
            tokenManager = tokenManagerFactory.attach(tokenManagerAddress) as TokenManagerERC721;
            functionName = "initializeAllClonesERC721";
        } else {
            tokenManager = tokenManagerFactory.attach(tokenManagerAddress) as TokenManagerERC1155;
            functionName = "initializeAllClonesERC1155";
        }
        prepareInitializeFromMap(safeTransactions, tokensToClones, tokenManager, functionName);
    }
}

async function findEventsAndInitialize(
    safeTransactions: string[],
    abi: any,
    tokenManagerName: "TokenManagerERC20" | "TokenManagerERC721" | "TokenManagerERC1155",
    eventName: string
) {
    const tokenManagerFactory = await ethers.getContractFactory(tokenManagerName);
    const tokenManagerAddress = abi[getContractKeyInAbiFile(tokenManagerName) + "_address"];
    if (tokenManagerAddress) {
        console.log(chalk.yellow("Will find all " + eventName + " events in " + tokenManagerName + " and initialize"));
        let tokenManager: TokenManagerERC20 | TokenManagerERC721 | TokenManagerERC1155;
        if (tokenManagerName === "TokenManagerERC20") {
            tokenManager = tokenManagerFactory.attach(tokenManagerAddress) as TokenManagerERC20;
        } else if (tokenManagerName === "TokenManagerERC721") {
            tokenManager = tokenManagerFactory.attach(tokenManagerAddress) as TokenManagerERC721;
        } else {
            tokenManager = tokenManagerFactory.attach(tokenManagerAddress) as TokenManagerERC1155;
        }
        const eventFilter: TypedEventFilter<[string, string], { tokenOnMainnet: string, tokenOnSchain: string}> = {
            address: tokenManagerAddress,
            topics: [ ethers.utils.id(eventName + "(string,address)") ]
        }
        const events = await tokenManager.queryFilter(eventFilter);
        if (events.length > 0) {
            await runInitialize(safeTransactions, abi, events, tokenManagerName, eventName);
        } else {
            console.log(chalk.yellow("No events " + eventName + " found - no reason to run initialize"));
        }
    } else {
        console.log(chalk.red("" + tokenManagerName + " was not found!"));
        console.log(chalk.red("Check your abi!!!"));
        process.exit(1);
    }
}

async function main() {
    const pathToManifest: string = stringValue(process.env.MANIFEST);
    await manifestSetup( pathToManifest );
    await upgrade(
        "1.1.0",
        contracts,
        async( safeTransactions, abi ) => undefined,
        async( safeTransactions, abi ) => {
            const messageProxyForSchainName = "MessageProxyForSchain";
            const messageProxyForSchainFactory = await ethers.getContractFactory(messageProxyForSchainName);
            const messageProxyForSchainAddress = abi[getContractKeyInAbiFile(messageProxyForSchainName) + "_address"];
            const tokenManagerEthAddress = abi[getContractKeyInAbiFile("TokenManagerEth") + "_address"];
            const tokenManagerERC20Address = abi[getContractKeyInAbiFile("TokenManagerERC20") + "_address"];
            const tokenManagerERC721Address = abi[getContractKeyInAbiFile("TokenManagerERC721") + "_address"];
            const tokenManagerERC1155Address = abi[getContractKeyInAbiFile("TokenManagerERC1155") + "_address"];
            const communityLockerAddress = abi[getContractKeyInAbiFile("CommunityLocker") + "_address"];
            let messageProxyForSchain;
            if (messageProxyForSchainAddress) {
                console.log(chalk.yellow("Prepare transaction to initialize extra contracts for all"));
                messageProxyForSchain = messageProxyForSchainFactory.attach(messageProxyForSchainAddress) as MessageProxyForSchain;
                await prepareContractRegisteredAndInitialize(safeTransactions, abi, messageProxyForSchain);
            } else {
                console.log(chalk.red("Message Proxy address was not found!"));
                console.log(chalk.red("Check your abi!!!"));
                process.exit(1);
            }
            if (tokenManagerERC20Address) {
                console.log(chalk.yellow("Prepare transaction to initialize all token clones for ERC20"));
                findEventsAndInitialize(safeTransactions, abi, "TokenManagerERC20", "ERC20TokenCreated");
                findEventsAndInitialize(safeTransactions, abi, "TokenManagerERC20", "ERC20TokenAdded");
            } else {
                console.log(chalk.red("Token Manager ERC20 address was not found!"));
                console.log(chalk.red("Check your abi!!!"));
                process.exit(1);
            }
            if (tokenManagerERC721Address) {
                console.log(chalk.yellow("Prepare transaction to initialize all token clones for ERC721"));
                findEventsAndInitialize(safeTransactions, abi, "TokenManagerERC721", "ERC721TokenCreated");
                findEventsAndInitialize(safeTransactions, abi, "TokenManagerERC721", "ERC721TokenAdded");
            } else {
                console.log(chalk.red("Token Manager ERC721 address was not found!"));
                console.log(chalk.red("Check your abi!!!"));
                process.exit(1);
            }
            if (tokenManagerERC1155Address) {
                console.log(chalk.yellow("Prepare transaction to initialize all token clones for ERC1155"));
                findEventsAndInitialize(safeTransactions, abi, "TokenManagerERC1155", "ERC1155TokenCreated");
                findEventsAndInitialize(safeTransactions, abi, "TokenManagerERC1155", "ERC1155TokenAdded");
            } else {
                console.log(chalk.red("Token Manager ERC1155 address was not found!"));
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
