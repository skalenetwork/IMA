import chalk from "chalk";
import { ethers } from "hardhat";
import { Interface, Transaction } from "ethers";
import { Submitter, Upgrader } from "@skalenetwork/upgrade-tools";
import { skaleContracts, Instance } from "@skalenetwork/skale-contracts-ethers-v6";
import { MessageProxyForMainnet } from "../typechain";
import { contracts } from "./deployMainnet";


async function getImaMainnetInstance() {
    if (!process.env.TARGET) {
        console.log(chalk.red("Specify desired mainnet-ima instance"));
        console.log(chalk.red("Set instance alias or MessageProxyForMainnet address to TARGET environment variable"));
        process.exit(1);
    }
    const network = await skaleContracts.getNetworkByProvider(ethers.provider);
    const project = network.getProject("mainnet-ima");
    return await project.getInstance(process.env.TARGET);
}

class ImaMainnetUpgrader extends Upgrader {

    constructor(
        targetVersion: string,
        instance: Instance,
        contractNamesToUpgrade: string[],
        submitter?: Submitter) {
            super(
                {
                    contractNamesToUpgrade,
                    instance,
                    name: "proxyMainnet",
                    version: targetVersion,
                },
                submitter
            );
        }

    getMessageProxyForMainnet = async () => {
        return await this.instance.getContract("MessageProxyForMainnet") as MessageProxyForMainnet;
    }

    getDeployedVersion = async () => {
        const messageProxyForMainnet = await this.getMessageProxyForMainnet();
        try {
            return await messageProxyForMainnet.version();
        } catch {
            console.log(chalk.red("Can't read deployed version"));
        }
    }

    setVersion = async (newVersion: string) => {
        const messageProxyForMainnet = await this.getMessageProxyForMainnet();
        this.transactions.push(Transaction.from({
            to: await messageProxyForMainnet.getAddress(),
            data: messageProxyForMainnet.interface.encodeFunctionData("setVersion", [newVersion])
        }));
    }

    // deployNewContracts = () => { };
    
    initialize = async () => {
        const contractManagerAddress = await (await this.getMessageProxyForMainnet()).contractManagerOfSkaleManager();
        const contractManagerInterface = new Interface([{
            "type": "function",
            "name": "getContract",
            "constant": true,
            "stateMutability": "view",
            "payable": false,
            "inputs": [
                {
                    "type": "string",
                    "name": "name"
                }
            ],
            "outputs": [
                {
                    "type": "address",
                    "name": "contractAddress"
                }
            ]
        },
        {
            "type": "function",
            "name": "setContractsAddress",
            "constant": false,
            "payable": false,
            "inputs": [
                {
                    "type": "string",
                    "name": "contractsName"
                },
                {
                    "type": "address",
                    "name": "newContractsAddress"
                }
            ],
            "outputs": []
        }]);
        const contractManager = new ethers.Contract(
            contractManagerAddress,
            contractManagerInterface,
            ethers.provider
        )
        for (const contractName of contracts) {
            try {
                const contractAddress = await contractManager.getContract(contractName);
                console.log(`Address of ${contractName} is set to ${contractAddress}`);
            } catch {
                
                // getContract failed because the contract is not set
                const contractAddress = await this.instance.getContract(contractName);
                this.transactions.push(Transaction.from(
                    {
                        to: await contractManager.getAddress(),
                        data: contractManager.interface.encodeFunctionData(
                            "setContractsAddress",
                            [contractAddress]
                        )
                    }
                ))
                console.log(`Set ${contractName} address to ${contractAddress}`);
            }
        }
    };

    _getContractKeyInAbiFile(contract: string) {
        if (contract === "MessageProxyForMainnet") {
            return "message_proxy_mainnet";
        }
        return contract.replace(/([a-z0-9])(?=[A-Z])/g, '$1_').toLowerCase();
    }
}

async function main() {
    const upgrader = new ImaMainnetUpgrader(
        "2.1.0",
        await getImaMainnetInstance(),
        contracts
    );
    await upgrader.upgrade();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
