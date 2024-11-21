import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { ExecutionManager, MessageProxyForSchain } from "../typechain";
import { deployExecutionManager } from "./utils/deploy/schain/executionManager";
import { AgentMock } from "./utils/agent/AgentMock";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { expect } from "chai";

interface SchainSetup {
    messageProxy: MessageProxyForSchain,
    executionManager: ExecutionManager
}

describe("ExecutionManager", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;

    const setupSchain = async (schainName: string) => {
        const messageProxy = await deployMessageProxyForSchainTester(schainName);
        const executionManager = await deployExecutionManager(messageProxy);
        return { messageProxy, executionManager }
    }

    const setupMultipleSchains = async (quantity: number) => {
        const schains = new Map<string, SchainSetup>();
        for (const index of [...Array(quantity).keys()]) {
            const schainName = `d2-schain-${index}`;
            schains.set(schainName, await setupSchain(schainName));
        }

        for (const [schainName, schainSetup] of schains) {
            await schainSetup.executionManager.grantRole(
                await schainSetup.executionManager.CONTROLLER_ROLE(),
                deployer.address
            );
            await schainSetup.messageProxy.registerExtraContractForAll(
                schainSetup.executionManager
            );
            for (const [remoteSchainName, remoteSchainSetup] of schains) {
                if (schainName !== remoteSchainName) {
                    await schainSetup.messageProxy.addConnectedChain(remoteSchainName);
                    await schainSetup.executionManager.setRemoteExecutionManager(
                        ethers.id(remoteSchainName),
                        remoteSchainSetup.executionManager
                    );
                }
            }
        }

        return schains;
    }

    before(async () => {
        [deployer, user] = await ethers.getSigners();
    });

    it("should send test message", async () => {
        const schains = await setupMultipleSchains(2);
        const agent = new AgentMock();
        for (const [schainName, schainSetup] of schains) {
            await agent.registerSchain(schainName, schainSetup.messageProxy);
        }

        const [sourceSchainName, targetSchainName] = [...schains.keys()];

        const message = "Hello";

        await schains.get(sourceSchainName)?.executionManager.connect(user).testSend(
            ethers.id(targetSchainName),
            message
        );

        await agent.deliverMessages();

        expect(await schains.get(targetSchainName)?.executionManager.testMessage()).to.be.equal(message);
    })
});
