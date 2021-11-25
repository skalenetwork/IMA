import { MessageProxyForSchain } from "../typechain";
import { contracts, getContractKeyInAbiFile } from "./deploySchain";
import { manifestSetup } from "./generateManifest";
import { encodeTransaction } from "./tools/multiSend";
import { upgrade } from "./upgrade";
import { hexZeroPad } from "@ethersproject/bytes";
import chalk from "chalk";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import { promises as fs } from "fs";

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
                console.log(chalk.red("Addresses were not found!"));
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
