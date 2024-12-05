import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { ExecutionManager, MessageProxyForSchain, Protocol } from "../typechain";
import { deployExecutionManager } from "./utils/deploy/schain/executionManager";
import { AgentMock } from "./utils/agent/AgentMock";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { assert, expect } from "chai";

interface SchainSetup {
    messageProxy: MessageProxyForSchain,
    executionManager: ExecutionManager
}

enum MetaActionStatus {
    SUCCEED,
    EXECUTING,
    FAILED
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

    it.only("should execute empty action", async () => {
        const schains = await setupMultipleSchains(2);
        const agent = new AgentMock();
        for (const [schainName, schainSetup] of schains) {
            await agent.registerSchain(schainName, schainSetup.messageProxy);
        }

        const [sourceSchainName, targetSchainName] = [...schains.keys()];

        const sourceExecutionManager = schains.get(sourceSchainName)?.executionManager;
        const targetExecutionManager = schains.get(targetSchainName)?.executionManager;

        assert(sourceExecutionManager);
        assert(targetExecutionManager);

        const metaAction = {
            targetChainHash: ethers.id(targetSchainName),
            actions: "0x",
            nextMetaAction: await sourceExecutionManager.encodeMetaAction({
                targetChainHash: ethers.id(targetSchainName),
                actions: "0x",
                nextMetaAction: "0x",
                postActions: "0x"
            }),
            postActions: "0x"
        }

        const executeReceipt = await (await sourceExecutionManager.connect(user).execute(
            metaAction
        )).wait();
        assert(executeReceipt);
        let metaActionId = "0x";
        for (const log of executeReceipt.logs) {
            const event = sourceExecutionManager.interface.parseLog(log);
            if (event && event.name == 'MetaActionCreated') {
                metaActionId = event.args.id;
            }
        }

        console.log("MetaActionId", metaActionId);

        await agent.deliverMessages();

        expect(await sourceExecutionManager.getMetaActionStatus(metaActionId)).to.be.equal(MetaActionStatus.EXECUTING);
        expect(await targetExecutionManager.getMetaActionStatus(metaActionId)).to.be.equal(MetaActionStatus.SUCCEED);

        // await agent.deliverMessages();

        // expect(await sourceExecutionManager.getMetaActionStatus(metaActionId)).to.be.equal(MetaActionStatus.SUCCEED);
        // expect(await targetExecutionManager.getMetaActionStatus(metaActionId)).to.be.equal(MetaActionStatus.SUCCEED);
    });
});
