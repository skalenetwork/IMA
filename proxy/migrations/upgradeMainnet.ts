import { ethers } from "hardhat";
import hre from "hardhat";
import { contracts, getContractKeyInAbiFile } from "./deployMainnet";
import { upgrade } from "./upgrade";
import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
import chalk from "chalk";
import { MessageProxyForMainnet, DepositBoxERC20, DepositBoxERC721, DepositBoxERC1155 } from "../typechain/";
import { encodeTransaction } from "./tools/multiSend";
import { TypedEvent } from "../typechain/commons";

function arrayValue(value: string[] | undefined): string[] {
    if (value) {
        return value;
    } else {
        return [];
    }
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
        const currentArrayOfTokens: string[] = arrayValue(schainToTokens.get(event.args.schainName));
        currentArrayOfTokens.push(event.args.contractOnMainnet);
        schainToTokens.set(event.args.schainName, currentArrayOfTokens);
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
            const depositBoxERC20Name = "DepositBoxERC20";
            const depositBoxERC20Factory = await ethers.getContractFactory(depositBoxERC20Name);
            const depositBoxERC20Address = abi[getContractKeyInAbiFile(depositBoxERC20Name) + "_address"];
            if (depositBoxERC20Address) {
                console.log(chalk.yellow("Will find all ERC20TokenAdded events in DepositBoxERC20 and initialize"));
                const depositBoxERC20 = depositBoxERC20Factory.attach(depositBoxERC20Address) as DepositBoxERC20;
                const eventFilter = await depositBoxERC20.filters.ERC20TokenAdded(null, null);
                // Block where tx DepositBoxERC20 deployment
                const depositBoxERC20BlockStart = 12858653;
                const events = await depositBoxERC20.queryFilter(eventFilter, depositBoxERC20BlockStart);
                if (events.length > 0) {
                    await runInitialize(safeTransactions, events, depositBoxERC20, "ERC20TokenAdded");
                } else {
                    console.log(chalk.yellow("No events ERC20TokenAdded found - no reason to run initialize"));
                }
            } else {
                console.log(chalk.red("DepositBoxERC20 was not found!"));
                console.log(chalk.red("Check your abi!!!"));
                process.exit(1);
            }
            const depositBoxERC721Name = "DepositBoxERC721";
            const depositBoxERC721Factory = await ethers.getContractFactory(depositBoxERC721Name);
            const depositBoxERC721Address = abi[getContractKeyInAbiFile(depositBoxERC721Name) + "_address"];
            if (depositBoxERC721Address) {
                console.log(chalk.yellow("Will find all ERC721TokenAdded events in DepositBoxERC721 and initialize"));
                const depositBoxERC721 = depositBoxERC721Factory.attach(depositBoxERC721Address) as DepositBoxERC721;
                const eventFilter = await depositBoxERC721.filters.ERC721TokenAdded(null, null);
                // Block where tx DepositBoxERC721 deployment
                const depositBoxERC721BlockStart = 12858665;
                const events = await depositBoxERC721.queryFilter(eventFilter, depositBoxERC721BlockStart);
                if (events.length > 0) {
                    await runInitialize(safeTransactions, events, depositBoxERC721, "ERC721TokenAdded");
                } else {
                    console.log(chalk.yellow("No events ERC721TokenAdded found - no reason to run initialize"));
                }
            } else {
                console.log(chalk.red("DepositBoxERC721 was not found!"));
                console.log(chalk.red("Check your abi!!!"));
                process.exit(1);
            }
            const depositBoxERC1155Name = "DepositBoxERC1155";
            const depositBoxERC1155Factory = await ethers.getContractFactory(depositBoxERC1155Name);
            const depositBoxERC1155Address = abi[getContractKeyInAbiFile(depositBoxERC1155Name) + "_address"];
            if (depositBoxERC1155Address) {
                console.log(chalk.yellow("Will find all ERC1155TokenAdded events in DepositBoxERC1155 and initialize"));
                const depositBoxERC1155 = depositBoxERC1155Factory.attach(depositBoxERC1155Address) as DepositBoxERC1155;
                const eventFilter = depositBoxERC1155.filters.ERC1155TokenAdded(null, null);
                // Block where tx DepositBoxERC1155 deployment
                const depositBoxERC1155BlockStart = 12858680;
                const events = await depositBoxERC1155.queryFilter(eventFilter, depositBoxERC1155BlockStart);
                if (events.length > 0) {
                    await runInitialize(safeTransactions, events, depositBoxERC1155, "ERC1155TokenAdded");
                } else {
                    console.log(chalk.yellow("No events ERC1155TokenAdded found - no reason to run initialize"));
                }
            } else {
                console.log(chalk.red("DepositBoxERC1155 was not found!"));
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
