import { ethers } from "hardhat";
import { MessageProxy } from "../../../typechain";
import { assert } from "chai";

interface Message {
    sender: string,
    destinationContract: string
    data: string
}

export class AgentMock {
    schains = new Map<string, MessageProxy>();

    async registerSchain(schainName: string, messageProxy: MessageProxy) {
        if (this.schains.has(schainName)) {
            throw Error(`Schain ${schainName} is already added`);
        }
        this.schains.set(schainName, messageProxy);
    }

    async deliverMessages() {
        for (const [sourceSchainName, source] of this.schains) {
            for (const [targetSchainName, target] of this.schains) {
                if (await source.isConnectedChain(targetSchainName)) {
                    const outgoingCounter = await source.getOutgoingMessagesCounter(targetSchainName);
                    const incomingCounter = await target.getIncomingMessagesCounter(sourceSchainName);
                    if (outgoingCounter > incomingCounter) {
                        const messages = await this.getMessages(source, targetSchainName, incomingCounter);
                        console.log("\n----- Agent: postIncomingMessages -----");
                        const response = await target.postIncomingMessages(
                            sourceSchainName,
                            incomingCounter,
                            messages,
                            {
                                blsSignature: [0, 0],
                                hashA: 0,
                                hashB: 0,
                                counter: 0
                            }
                        )
                        const receipt = await response.wait();
                        assert(receipt);
                        for (const log of receipt.logs) {
                            const event = target.interface.parseLog(log);
                            if (event && event.name == 'PostMessageError') {
                                console.log(`Error when process message #${event.args.msgCounter}`);
                                console.log(event.args.message);
                            }
                        }
                    }
                }
            }
        }
    }

    // Private

    private async getMessages(messageProxy: MessageProxy, targetSchainName: string, from: bigint, blockNumber?: bigint): Promise<Message[]> {
        if (typeof blockNumber === 'undefined') {
            return this.getMessages(messageProxy, targetSchainName, from, await messageProxy.getLastOutgoingMessageBlockId(targetSchainName));
        }
        if (blockNumber === 0n) {
            return [];
        }
        if (await messageProxy.getOutgoingMessagesCounter(targetSchainName, {blockTag: Number(blockNumber)}) < from) {
            return [];
        }
        const lastOutgoingMessageBlockId = await messageProxy.getLastOutgoingMessageBlockId(targetSchainName, {blockTag: Number(blockNumber)});
        if (lastOutgoingMessageBlockId === 0n) {
            return [];
        }
        if (lastOutgoingMessageBlockId < blockNumber) {
            return this.getMessages(messageProxy, targetSchainName, from, lastOutgoingMessageBlockId);
        }

        const block = await ethers.provider.getBlock(Number(blockNumber));
        assert(block);
        const messages: Message[] = []
        for (const transactionHash of block.transactions) {
            const transaction = await ethers.provider.getTransactionReceipt(transactionHash);
            assert(transaction);
            for (const log of transaction.logs) {
                const logDescription = messageProxy.interface.parseLog(log);
                if (logDescription && logDescription.name === "OutgoingMessage" && logDescription.args.dstChainHash === ethers.id(targetSchainName)) {
                    if (logDescription.args.msgCounter >= from) {
                        const message = {
                            sender: logDescription.args.srcContract,
                            destinationContract: logDescription.args.dstContract,
                            data: logDescription.args.data
                        };
                        messages.push(message);
                    }
                }
            }
        }
        return [
            ... await this.getMessages(
                messageProxy,
                targetSchainName,
                from,
                await messageProxy.getLastOutgoingMessageBlockId(targetSchainName, {blockTag: Number(blockNumber) - 1})
            ),
            ...messages
        ];
    }
}
