import axios from "axios";
import { ethers } from "ethers";
import * as ethUtil from 'ethereumjs-util';
import chalk from "chalk";
import { HardhatEthersHelpers } from "@nomiclabs/hardhat-ethers/types";

type Ethers = typeof ethers & HardhatEthersHelpers;

enum Network {
    MAINNET = 1,
    RINKEBY = 4,
    GOERLI = 5,
    GANACHE = 1337,
    HARDHAT = 31337,
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const ADDRESSES = {
    multiSend: {
        [Network.MAINNET]: "0x8D29bE29923b68abfDD21e541b9374737B49cdAD",
        [Network.RINKEBY]: "0x8D29bE29923b68abfDD21e541b9374737B49cdAD",
        [Network.GOERLI]: "0x8D29bE29923b68abfDD21e541b9374737B49cdAD",
    },
}

const URLS = {
    safe_transaction: {
        [Network.MAINNET]: "https://safe-transaction.mainnet.gnosis.io",
        [Network.RINKEBY]: "https://safe-transaction.rinkeby.gnosis.io",
        [Network.GOERLI]: "https://safe-transaction.goerli.gnosis.io",
    },
    safe_relay: {
        [Network.MAINNET]: "https://safe-relay.mainnet.gnosis.io",
        [Network.RINKEBY]: "https://safe-relay.rinkeby.gnosis.io",
        [Network.GOERLI]: "https://safe-relay.goerli.gnosis.io",
    }
}

function getMultiSendAddress(chainId: number, isSafeMock: boolean = false) {
    if (isSafeMock) {
        return ethers.constants.AddressZero;
    } else if (chainId === Network.MAINNET) {
        return ADDRESSES.multiSend[chainId];
    } else if (chainId === Network.RINKEBY) {
        return ADDRESSES.multiSend[chainId];
    } else if (chainId === Network.GOERLI) {
        return ADDRESSES.multiSend[chainId];
    } else if ([Network.GANACHE, Network.HARDHAT].includes(chainId)) {
        return ethers.constants.AddressZero;
    } else {
        throw Error("Can't get multiSend contract at network with chainId = " + chainId);
    }
}

export function getSafeTransactionUrl(chainId: number) {
    if (chainId === Network.MAINNET) {
        return URLS.safe_transaction[chainId];
    } else if (chainId === Network.RINKEBY) {
        return URLS.safe_transaction[chainId];
    } else if (chainId === Network.GOERLI) {
        return URLS.safe_transaction[chainId];
    } else {
        throw Error("Can't get safe-transaction url at network with chainId = " + chainId);
    }
}

export function getSafeRelayUrl(chainId: number) {
    if (Object.keys(URLS.safe_relay).includes(chainId.toString())) {
        return URLS.safe_relay[chainId as keyof typeof URLS.safe_relay];
    } else {
        throw Error("Can't get safe-relay url at network with chainId = " + chainId);
    }
}

function concatTransactions(transactions: string[]) {
    return "0x" + transactions.map( (transaction) => {
        if (transaction.startsWith("0x")) {
            return transaction.slice(2);
        } else {
            return transaction;
        }
    }).join("");
}

export async function createMultiSendTransaction(ethersProvider: Ethers, safeAddress: string, privateKey: string, transactions: string[], isSafeMock: boolean = false) {
    const chainId: number = (await ethersProvider.provider.getNetwork()).chainId;
    const multiSendAddress = getMultiSendAddress(chainId, isSafeMock);
    const multiSendAbi = [{"constant":false,"inputs":[{"internalType":"bytes","name":"transactions","type":"bytes"}],"name":"multiSend","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}];
    const multiSend = new ethers.Contract(multiSendAddress, new ethers.utils.Interface(multiSendAbi), ethersProvider.provider);
    const safeAbi = [{"constant":true,"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"},{"internalType":"enum Enum.Operation","name":"operation","type":"uint8"},{"internalType":"uint256","name":"safeTxGas","type":"uint256"},{"internalType":"uint256","name":"baseGas","type":"uint256"},{"internalType":"uint256","name":"gasPrice","type":"uint256"},{"internalType":"address","name":"gasToken","type":"address"},{"internalType":"address","name":"refundReceiver","type":"address"},{"internalType":"uint256","name":"_nonce","type":"uint256"}],"name":"getTransactionHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"payable":false,"stateMutability":"view","type":"function"}];
    interface Safe extends ethers.Contract {
        getTransactionHash: (
            to: string,
            value: number,
            data: string,
            operation: number,
            safeTxGas: number,
            baseGas: number,
            gasPrice: number,
            gasToken: string,
            refundReceiver: string,
            nonce: number
        ) => Promise<string>
    }
    const safe = new ethers.Contract(safeAddress, new ethers.utils.Interface(safeAbi), ethersProvider.provider) as Safe;

    let nonce = 0;
    if (!isSafeMock) {
        try {
            const nonceResponse = await axios.get(`${getSafeTransactionUrl(chainId)}/api/v1/safes/${safeAddress}/`);
            nonce = nonceResponse.data.nonce;
        } catch (e: any) {
            if (!e.toString().startsWith("Error: Can't get safe-transaction url")) {
                throw e;
            }
        }
    }

    const tx = {
        "to": multiSend.address,
        "value": 0, // Value in wei
        "data": multiSend.interface.encodeFunctionData("multiSend", [ concatTransactions(transactions) ]),
        "operation": 1,  // 0 CALL, 1 DELEGATE_CALL
        "gasToken": ethers.constants.AddressZero, // Token address (hold by the Safe) to be used as a refund to the sender, if `null` is Ether
        "safeTxGas": 0,  // Max gas to use in the transaction
        "baseGas": 0,  // Gas costs not related to the transaction execution (signature check, refund payment...)
        "gasPrice": 0,  // Gas price used for the refund calculation
        "refundReceiver": ethers.constants.AddressZero, // Address of receiver of gas payment (or `null` if tx.origin)
        "nonce": nonce,  // Nonce of the Safe, transaction cannot be executed until Safe's nonce is not equal to this nonce
    }

    const digestHex = await safe.getTransactionHash(
        tx.to,
        tx.value,
        tx.data,
        tx.operation,
        tx.safeTxGas,
        tx.baseGas,
        tx.gasPrice,
        tx.gasToken,
        tx.refundReceiver,
        tx.nonce
    );

    const privateKeyBuffer = ethUtil.toBuffer(privateKey);
    const { r, s, v } = ethUtil.ecsign(ethUtil.toBuffer(digestHex), privateKeyBuffer);
    const signature = ethUtil.toRpcSig(v, r, s).toString();

    const txToSend = {
        ...tx,
        "contractTransactionHash": digestHex,  // Contract transaction hash calculated from all the field
        // Owner of the Safe proposing the transaction. Must match one of the signatures
        "sender": ethers.utils.getAddress(ethUtil.bufferToHex(ethUtil.privateToAddress(privateKeyBuffer))),
        "signature": signature,  // One or more ethereum ECDSA signatures of the `contractTransactionHash` as an hex string
        "origin": "Upgrade IMA"  // Give more information about the transaction, e.g. "My Custom Safe app"
    }

    return txToSend;
}

export async function sendSafeTransaction(safe: string, chainId: number, safeTx: any) {
    try {
        console.log("Estimate gas");
        const estimateRequest = (({
            to,
            value,
            data,
            operation,
            gasToken
        }) => ({ to, value, data, operation, gasToken }))(safeTx);

        try {
            const estimateResponse = await axios.post(
                `${getSafeRelayUrl(chainId)}/api/v2/safes/${safe}/transactions/estimate/`,
                estimateRequest
            );
            console.log(chalk.cyan(`Recommend to set gas limit to ${
                parseInt(estimateResponse.data.safeTxGas, 10) + parseInt(estimateResponse.data.baseGas, 10)}`));
        } catch (e: any) {
            console.log(chalk.red("Failed to estimate gas"));
            console.log(e.toString());
        }

        console.log(chalk.green("Send transaction to gnosis safe"));
        await axios.post(`${getSafeTransactionUrl(chainId)}/api/v1/safes/${safe}/transactions/`, safeTx)
    } catch (e: any) {
        if (e.response) {
            console.log(JSON.stringify(e.response.data, null, 4))
            console.log(chalk.red(`Request failed with ${e.response.status} code`));
        } else {
            console.log(chalk.red("Request failed with unknown reason"));
        }
        throw e;
    }
}