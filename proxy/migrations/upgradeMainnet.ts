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
import { getTxsFromEtherscan } from "./tools/etherscan-api";
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

function getValueFromTXList(txs: any, index: number, field: string) {
    const deploymentTx = txs[index];
    return deploymentTx[field];
}

async function findTxContractRegisteredAndInitialize(
    safeTransactions: string[],
    messageProxyForMainnet: MessageProxyForMainnet,
) {
    const txs = await getTxsFromEtherscan((await ethers.provider.getNetwork()).chainId, messageProxyForMainnet.address);
    if (!Array.isArray(txs) || txs.length === 0) {
        console.log(chalk.yellow("No transactions from etherscan found"));
        return;
    }
    const chainToRegisteredContracts = new Map<string, string[]>();
    for (const tx of txs) {
        // const tx = txs[i];
        if (tx.contractAddress === "" && tx.txreceipt_status === "1") {
            const inputData = tx.input;
            const functionSignature = inputData.slice(10);
            const functionName = messageProxyForMainnet.interface.getFunction(functionSignature).name;
            let hash = hexZeroPad("0x0", 32);
            let address = hexZeroPad("0x0", 20);
            let add = true;
            if (functionName === "registerExtraContract") {
                const decodedData = messageProxyForMainnet.interface.decodeFunctionData("registerExtraContract", inputData);
                hash = ethers.utils.id(decodedData.schainName);
                address = decodedData.extraContract;
                console.log(chalk.yellow("Find Function " + functionName));
            } else if (functionName === "registerExtraContractForAll") {
                const decodedData = messageProxyForMainnet.interface.decodeFunctionData("registerExtraContractForAll", inputData);
                address = decodedData.extraContract;
                console.log(chalk.yellow("Find Function " + functionName));
            } else if (functionName === "removeExtraContract") {
                const decodedData = messageProxyForMainnet.interface.decodeFunctionData("removeExtraContract", inputData);
                hash = ethers.utils.id(decodedData.schainName);
                address = decodedData.extraContract;
                add = false
                console.log(chalk.yellow("Find Function " + functionName));
            } else if (functionName === "removeExtraContractForAll") {
                const decodedData = messageProxyForMainnet.interface.decodeFunctionData("removeExtraContractForAll", inputData);
                address = decodedData.extraContract;
                add = false
                console.log(chalk.yellow("Find Function " + functionName));
            } else {
                console.log(chalk.yellow("Skip function " + functionName));
            }
            if (address !== hexZeroPad("0x0", 20)) {
                let addedRegisteredContracts = chainToRegisteredContracts.get(hash);
                if (add) {
                    if (addedRegisteredContracts) {
                        addedRegisteredContracts.push(address);
                        chainToRegisteredContracts.set(hash, addedRegisteredContracts);
                    } else {
                        chainToRegisteredContracts.set(hash, [address]);
                    }
                    console.log(chalk.yellow("Add hash " + hash + " and address " + address));
                } else {
                    if (addedRegisteredContracts) {
                        addedRegisteredContracts = addedRegisteredContracts.filter((value) => {return value !== address;});
                        chainToRegisteredContracts.set(hash, addedRegisteredContracts);
                    } else {
                        chainToRegisteredContracts.delete(hash);
                    }
                    console.log(chalk.yellow("Remove hash " + hash + " and address " + address));
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
            await findTxContractRegisteredAndInitialize(safeTransactions, messageProxyForMainnet);
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
