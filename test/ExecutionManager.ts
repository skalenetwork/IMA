import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { ExecutionManager, MessageProxyForSchain, Protocol, TokenManagerERC20, TokenManagerLinker } from "../typechain";
import { deployExecutionManager } from "./utils/deploy/schain/executionManager";
import { AgentMock } from "./utils/agent/AgentMock";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { assert, expect } from "chai";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployTokenManagerERC20 } from "./utils/deploy/schain/tokenManagerERC20";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

interface SchainSetup {
    messageProxy: MessageProxyForSchain;
    executionManager: ExecutionManager;
    tokenManager: TokenManagerERC20;
    tokenManagerLinker: TokenManagerLinker;
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

        const linkerMockAddress = ethers.getAddress("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
        const communityPoolMockAddress = ethers.getAddress("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");
        const depositBoxMockAddress = ethers.getAddress("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF");

        const tokenManagerLinker = await deployTokenManagerLinker(messageProxy, linkerMockAddress);
        const communityLocker = await deployCommunityLocker(schainName, messageProxy, tokenManagerLinker, communityPoolMockAddress);
        const tokenManagerErc20 = await deployTokenManagerERC20(schainName, messageProxy, tokenManagerLinker, communityLocker, depositBoxMockAddress);

        const executionManager = await deployExecutionManager(tokenManagerErc20);

        return {
            messageProxy,
            executionManager,
            tokenManager: tokenManagerErc20,
            tokenManagerLinker
        }
    }

    const setupMultipleSchains = async (quantity: number) => {
        const schains = new Map<string, SchainSetup>();
        for (const index of [...Array(quantity).keys()]) {
            const schainName = `d2-schain-${index}`;
            schains.set(schainName, await setupSchain(schainName));
        }

        for (const [schainName, schainSetup] of schains) {
            await schainSetup.messageProxy.registerExtraContractForAll(
                schainSetup.tokenManager
            );
            await schainSetup.messageProxy.registerExtraContractForAll(
                schainSetup.executionManager
            );
            await schainSetup.tokenManagerLinker.registerTokenManager(schainSetup.tokenManager);
            await schainSetup.tokenManager.enableAutomaticDeploy();
            await schainSetup.executionManager.grantRole(
                await schainSetup.executionManager.CONTROLLER_ROLE(),
                deployer.address
            );
            for (const [remoteSchainName, remoteSchainSetup] of schains) {
                if (schainName !== remoteSchainName) {
                    await schainSetup.messageProxy.addConnectedChain(remoteSchainName);
                    await schainSetup.tokenManager.addTokenManager(
                        remoteSchainName,
                        remoteSchainSetup.tokenManager
                    );
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

    it("should execute empty action", async () => {
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

        expect(await sourceExecutionManager.getMetaActionStatus(metaActionId)).to.be.equal(MetaActionStatus.SUCCEED);
        expect(await targetExecutionManager.getMetaActionStatus(metaActionId)).to.be.equal(MetaActionStatus.SUCCEED);
    });

    it.only("should execute send action", async () => {
        const schains = await setupMultipleSchains(2);
        const agent = new AgentMock();
        for (const [schainName, schainSetup] of schains) {
            await agent.registerSchain(schainName, schainSetup.messageProxy);
        }

        const [sourceSchainName, targetSchainName] = [...schains.keys()];
        const sourceSchainHash = ethers.id(sourceSchainName);
        const targetSchainHash = ethers.id(targetSchainName);

        const sourceExecutionManager = schains.get(sourceSchainName)?.executionManager;
        const targetExecutionManager = schains.get(targetSchainName)?.executionManager;

        assert(sourceExecutionManager);
        assert(targetExecutionManager);

        const sourceTokenManager = schains.get(sourceSchainName)?.tokenManager;
        const targetTokenManager = schains.get(targetSchainName)?.tokenManager;

        assert(sourceTokenManager);
        assert(targetTokenManager);

        const token = await deployERC20OnChain("D2", "D2");
        const value = ethers.parseEther("1");
        await token.mint(user, value);

        await token.connect(user).approve(targetTokenManager, value);
        await targetTokenManager.connect(user).transferToSchainERC20(
            sourceSchainName,
            token, value
        );

        await agent.deliverMessages();

        const cloneAddress = await sourceTokenManager.clonesErc20(targetSchainHash, token);
        const clone = await ethers.getContractAt("ERC20OnChain", cloneAddress);

        expect(await token.balanceOf(user)).to.be.equal(0n);
        expect(await clone.balanceOf(user)).to.be.equal(value);

        const send = await ethers.getContractAt(
            "Send",
            await sourceExecutionManager.getExecutor(
                ethers.id("Send")
            )
        );
        const metaAction = (await sourceExecutionManager.createMetaAction(
            targetSchainHash,
            [{
                executor: ethers.id("Send"),
                arguments: await send.encodeArguments(user)
            }]
        )).toObject();

        await clone.connect(user).approve(sourceExecutionManager, value);
        const executeReceipt = await (await sourceExecutionManager.connect(user).execute(
            metaAction,
            [{token: clone, value: value, origin: token}]
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

        expect(await targetExecutionManager.getMetaActionStatus(metaActionId)).to.be.equal(MetaActionStatus.SUCCEED);
        // expect(await sourceExecutionManager.getMetaActionStatus(metaActionId)).to.be.equal(MetaActionStatus.SUCCEED);
    });
});
