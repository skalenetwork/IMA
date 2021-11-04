import { MessageProxyForSchain } from "../typechain";
import { contracts, getContractKeyInAbiFile } from "./deploySchain";
import { manifestSetup } from "./generateManifest";
import { encodeTransaction } from "./tools/multiSend";
import { upgrade } from "./upgrade";
import { hexZeroPad } from "@ethersproject/bytes";
import chalk from "chalk";

function stringValue(value: string | undefined) {
    if (value) {
        return value;
    } else {
        return "";
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
            if (
                messageProxyForSchainAddress ||
                tokenManagerEthAddress ||
                tokenManagerERC20Address ||
                tokenManagerERC721Address ||
                tokenManagerERC1155Address ||
                communityLockerAddress
            ) {
                console.log(chalk.yellow("Prepare transaction to initialize extra contracts for all"));
                messageProxyForSchain = messageProxyForSchainFactory.attach(messageProxyForSchainAddress) as MessageProxyForSchain;
                const arrayOfAddresses = [
                    tokenManagerEthAddress,
                    tokenManagerERC20Address,
                    tokenManagerERC721Address,
                    tokenManagerERC1155Address,
                    communityLockerAddress
                ]
                safeTransactions.push(encodeTransaction(
                    0,
                    messageProxyForSchainAddress,
                    0,
                    messageProxyForSchain.interface.encodeFunctionData("initializeAllRegisteredContracts", [hexZeroPad("0x0", 32), arrayOfAddresses])
                ));
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
