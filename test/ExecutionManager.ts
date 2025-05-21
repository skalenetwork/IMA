import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import { ExecutionManager, MessageProxyForSchain, TokenLocker, TokenManagerERC20, TokenManagerLinker } from "../typechain";
import { deployExecutionManager } from "./utils/deploy/schain/executionManager";
import { AgentMock } from "./utils/agent/AgentMock";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { assert, expect } from "chai";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployTokenManagerERC20 } from "./utils/deploy/schain/tokenManagerERC20";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";
import { Protocol } from "../typechain/artifacts/contracts/schain/ExecutionLayer/ExecutionManager";
import { Wallet } from "ethers";
import { skipTime } from "./utils/time";

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

const asMetaObject = (metaAction: Protocol.MetaActionStructOutput) => {
    const asMetaAction: Protocol.MetaActionStruct = {
        targetChainHash: metaAction[0],
        actions: metaAction[1],
        nextMetaAction: metaAction[2],
        postActions: metaAction[3]
    }
    return asMetaAction
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
        const tokenLockerFactory = await ethers.getContractFactory("TokenLocker");

        const tokenLocker = await (await upgrades.deployProxy(tokenLockerFactory)).waitForDeployment() as unknown as TokenLocker;
        const executionManager = await deployExecutionManager(tokenManagerErc20, tokenLocker);
        await tokenLocker.grantRole(await tokenLocker.EXECUTION_MANAGER_ROLE(), executionManager);


        console.log(`Chain ${schainName}`);
        console.log(`MessageProxy: ${await ethers.resolveAddress(messageProxy)}`);
        console.log(`TokenManager: ${await ethers.resolveAddress(tokenManagerErc20)}`);
        console.log(`ExecutionManager: ${await ethers.resolveAddress(executionManager)}`);

        return {
            messageProxy,
            executionManager,
            tokenManager: tokenManagerErc20,
            tokenManagerLinker,
            tokenLocker
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

    it("should execute empty action", async () => {
        const schains = await setupMultipleSchains(2);
        const agent = new AgentMock();
        for (const [schainName, schainSetup] of schains) {
            await agent.registerSchain(schainName, schainSetup.messageProxy);
        }

        const [sourceSchainName, targetSchainName] = [...schains.keys()];
        const targetSchainHash = ethers.id(targetSchainName);

        const sourceExecutionManager = schains.get(sourceSchainName)?.executionManager;
        const targetExecutionManager = schains.get(targetSchainName)?.executionManager;

        assert(sourceExecutionManager);
        assert(targetExecutionManager);

        const metaAction = asMetaObject(await sourceExecutionManager["createMetaAction(bytes32,(bytes32,bytes)[])"](
            targetSchainHash,
            []
        ));

        const executeReceipt = await (await sourceExecutionManager.connect(user).execute(
            metaAction,
            [],
            []
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

    it("should execute send action", async () => {
        const schains = await setupMultipleSchains(2);
        const agent = new AgentMock();
        for (const [schainName, schainSetup] of schains) {
            await agent.registerSchain(schainName, schainSetup.messageProxy);
        }

        const [sourceSchainName, targetSchainName] = [...schains.keys()];
        //const sourceSchainHash = ethers.id(sourceSchainName);
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

        console.log(`Origin token: ${await ethers.resolveAddress(token)}`);
        console.log(`Clone token: ${await ethers.resolveAddress(clone)}`);

        expect(await token.balanceOf(user)).to.be.equal(0n);
        expect(await clone.balanceOf(user)).to.be.equal(value);

        const send = await ethers.getContractAt(
            "Send",
            await sourceExecutionManager.getExecutor(
                ethers.id("Send")
            )
        );
        const metaAction = asMetaObject(await sourceExecutionManager["createMetaAction(bytes32,(bytes32,bytes)[])"](
            targetSchainHash,
            [{
                executor: ethers.id("Send"),
                arguments: await send.encodeArguments(user)
            }]
        ));

        await clone.connect(user).approve(sourceExecutionManager, value);
        const executeReceipt = await (await sourceExecutionManager.connect(user).execute(
            metaAction,
            [{token: clone, value: value}],
            []
        )).wait();
        assert(executeReceipt);
        let metaActionId = "0x";
        for (const log of executeReceipt.logs) {
            const event = sourceExecutionManager.interface.parseLog(log);
            if (event && event.name == 'MetaActionCreated') {
                metaActionId = event.args.id;
            }
        }
        expect(await clone.balanceOf(user)).to.be.equal(0n);

        console.log("MetaActionId", metaActionId);

        await agent.deliverMessages();

        expect(await targetExecutionManager.getMetaActionStatus(metaActionId)).to.be.equal(MetaActionStatus.SUCCEED);
        expect(await sourceExecutionManager.getMetaActionStatus(metaActionId)).to.be.equal(MetaActionStatus.SUCCEED);

        console.log(`Clone: ${await clone.balanceOf(user)}`);
        console.log(`Origin: ${await token.balanceOf(user)}`);

        expect(await clone.balanceOf(user)).to.be.equal(0n);
        expect(await token.balanceOf(user)).to.be.equal(value);
    });

    it("should transfer from Chain A to Chain B with execution of a swap on Chain B", async() => {
        const schains = await setupMultipleSchains(2);
        const agent = new AgentMock();
        for (const [schainName, schainSetup] of schains) {
            await agent.registerSchain(schainName, schainSetup.messageProxy);
        }

        const [sourceSchainName, targetSchainName] = [...schains.keys()];
        //const sourceSchainHash = ethers.id(sourceSchainName);
        const targetSchainHash = ethers.id(targetSchainName);

        const sourceExecutionManager = schains.get(sourceSchainName)?.executionManager;
        const targetExecutionManager = schains.get(targetSchainName)?.executionManager;

        assert(sourceExecutionManager);
        assert(targetExecutionManager);

        const sourceTokenManager = schains.get(sourceSchainName)?.tokenManager;
        const targetTokenManager = schains.get(targetSchainName)?.tokenManager;

        assert(sourceTokenManager);
        assert(targetTokenManager);

        // Create tokens on chain B

        const token = await deployERC20OnChain("D2", "D2");
        const value = ethers.parseEther("1");
        await token.mint(user, value);

        const token2 = await deployERC20OnChain("D2", "D2");
        await token2.mint(user, value);

        // Setup exchange

        const exchange = await upgrades.deployProxy(await ethers.getContractFactory("SwapMock"));
        await exchange.setTokenA(token);
        await exchange.setTokenB(token2);
        await token2.connect(user).transfer(exchange, value);

        // Transfer the token to chain A

        await token.connect(user).approve(targetTokenManager, value);
        await targetTokenManager.connect(user).transferToSchainERC20(
            sourceSchainName,
            token, value
        );

        await agent.deliverMessages();

        const cloneAddress = await sourceTokenManager.clonesErc20(targetSchainHash, token);
        const clone = await ethers.getContractAt("ERC20OnChain", cloneAddress);

        // Setup executors

        const swapMockSwap = await ethers.deployContract("SwapMockSwap");
        await swapMockSwap.setExecutionManager(targetExecutionManager);
        await swapMockSwap.setExchange(exchange);
        await targetExecutionManager.setExecutor(await swapMockSwap.ID(), swapMockSwap);

        const send = await ethers.getContractAt(
            "Send",
            await sourceExecutionManager.getExecutor(
                ethers.id("Send")
            )
        );

        // Send tokens and swap then

        expect(await token.balanceOf(user)).to.be.equal(0n);
        expect(await token2.balanceOf(user)).to.be.equal(0n);
        expect(await clone.balanceOf(user)).to.be.equal(value);

        const metaAction = asMetaObject(await sourceExecutionManager["createMetaAction(bytes32,(bytes32,bytes)[])"](
            targetSchainHash,
            [
                {
                    executor: ethers.id("SwapMockSwap"),
                    arguments: "0x"
                },
                {
                    executor: ethers.id("Send"),
                    arguments: await send.encodeArguments(user)
                }
            ]
        ));

        await clone.connect(user).approve(sourceExecutionManager, value);
        await sourceExecutionManager.connect(user).execute(
            metaAction,
            [{token: clone, value: value}],
            []
        );

        await agent.deliverMessages();

        expect(await token.balanceOf(user)).to.be.equal(0n);
        expect(await token2.balanceOf(user)).to.be.equal(value);
        expect(await clone.balanceOf(user)).to.be.equal(0n);
    });

    it("should send from Chain A to Chain B with execution of a swap on Chain B with X amount going back to Chain A", async() => {
        const schains = await setupMultipleSchains(2);
        const agent = new AgentMock();
        for (const [schainName, schainSetup] of schains) {
            await agent.registerSchain(schainName, schainSetup.messageProxy);
        }

        const [sourceSchainName, targetSchainName] = [...schains.keys()];
        //const sourceSchainHash = ethers.id(sourceSchainName);
        const targetSchainHash = ethers.id(targetSchainName);

        const sourceExecutionManager = schains.get(sourceSchainName)?.executionManager;
        const targetExecutionManager = schains.get(targetSchainName)?.executionManager;

        assert(sourceExecutionManager);
        assert(targetExecutionManager);

        const sourceTokenManager = schains.get(sourceSchainName)?.tokenManager;
        const targetTokenManager = schains.get(targetSchainName)?.tokenManager;

        assert(sourceTokenManager);
        assert(targetTokenManager);

        // Create tokens on chain B

        const token = await deployERC20OnChain("D2", "D2");
        const value = ethers.parseEther("1");
        await token.mint(user, value);

        const token2 = await deployERC20OnChain("D2", "D2");
        await token2.mint(user, value);

        // Setup exchange

        const exchange = await upgrades.deployProxy(await ethers.getContractFactory("SwapMock"));
        await exchange.setTokenA(token);
        await exchange.setTokenB(token2);
        await token2.connect(user).transfer(exchange, value);

        // Transfer tokens to chain A

        await token.connect(user).approve(targetTokenManager, value);
        await targetTokenManager.connect(user).transferToSchainERC20(
            sourceSchainName,
            token, value
        );

        await targetTokenManager.connect(user).transferToSchainERC20(
            sourceSchainName,
            token2, 0
        );

        await agent.deliverMessages();

        const clone = await ethers.getContractAt(
            "ERC20OnChain",
            await sourceTokenManager.clonesErc20(targetSchainHash, token)
        );
        const clone2 = await ethers.getContractAt(
            "ERC20OnChain",
            await sourceTokenManager.clonesErc20(targetSchainHash, token2)
        );

        // Setup executors

        const swapMockSwap = await ethers.deployContract("SwapMockSwap");
        await swapMockSwap.setExecutionManager(targetExecutionManager);
        await swapMockSwap.setExchange(exchange);
        await targetExecutionManager.setExecutor(await swapMockSwap.ID(), swapMockSwap);

        const sendRest = await ethers.getContractAt(
            "SendRest",
            await sourceExecutionManager.getExecutor(
                ethers.id("SendRest")
            )
        );

        const xAmount = value / 3n;
        expect(await token.balanceOf(user)).to.be.equal(0n);
        expect(await token2.balanceOf(user)).to.be.equal(0n);
        expect(await clone.balanceOf(user)).to.be.equal(value);
        expect(await clone2.balanceOf(user)).to.be.equal(0n);

        // Send tokens, swap and send x value back
        // Since there will be tokens left from execution in Chain B, they will be automaticaly sent back to the user
        const metaAction = asMetaObject(await sourceExecutionManager["createMetaAction(bytes32,(bytes32,bytes)[])"](
            targetSchainHash,
            [
                {
                    executor: ethers.id("SwapMockSwap"),
                    arguments: "0x"
                },
                {
                    executor: ethers.id("SendRest"),
                    arguments: await sendRest.encodeArguments(user, xAmount)
                }
            ]
        ));

        await clone.connect(user).approve(sourceExecutionManager, value);

        await sourceExecutionManager.connect(user).execute(
            metaAction,
            [{token: clone, value: value}],
            []
        );

        await agent.deliverMessages();

        expect(await token.balanceOf(user)).to.be.equal(0n);
        expect(await token2.balanceOf(user)).to.be.equal(value - xAmount);
        expect(await clone.balanceOf(user)).to.be.equal(0n);
        expect(await clone2.balanceOf(user)).to.be.equal(xAmount);
    });

    it("should send from Chain A to Chain B with exection of swap on Chain B and send back X to Chain C", async() => {
        const schains = await setupMultipleSchains(3);
        const agent = new AgentMock();
        for (const [schainName, schainSetup] of schains) {
            await agent.registerSchain(schainName, schainSetup.messageProxy);
        }
        const [schainAName, schainBName, schainCName] = [...schains.keys()];
        //const schainAHash = ethers.id(schainAName);
        const schainBHash = ethers.id(schainBName);
        const schainCHash = ethers.id(schainCName);

        const executionManagerA = schains.get(schainAName)?.executionManager;
        const executionManagerB = schains.get(schainBName)?.executionManager;
        const executionManagerC = schains.get(schainCName)?.executionManager;

        assert(executionManagerA);
        assert(executionManagerB);
        assert(executionManagerC);

        const tokenManagerA = schains.get(schainAName)?.tokenManager;
        const tokenManagerB = schains.get(schainBName)?.tokenManager;
        const tokenManagerC = schains.get(schainCName)?.tokenManager;

        assert(tokenManagerA);
        assert(tokenManagerB);
        assert(tokenManagerC);


        // Create tokens on chain B

        const token1B = await deployERC20OnChain("D2", "D2");
        const value = ethers.parseEther("1");
        await token1B.mint(user, value);

        const token2B = await deployERC20OnChain("D2", "D2");
        await token2B.mint(user, value);

        // Transfer token1B to chain A
        expect(await token1B.balanceOf(user)).to.be.equal(value);
        await token1B.connect(user).approve(tokenManagerB, value);
        await tokenManagerB.connect(user).transferToSchainERC20(
            schainAName,
            token1B, value
        );
        await agent.deliverMessages();

        const token1A = await ethers.getContractAt(
            "ERC20OnChain",
            await tokenManagerA.clonesErc20(schainBHash, token1B)
        );
        expect(await token1A.balanceOf(user)).to.be.equal(value);
        expect(await token1B.balanceOf(user)).to.be.equal(0n);

        // Transfer tokens to chain C
        await tokenManagerB.connect(user).transferToSchainERC20(
            schainCName,
            token2B, 0
        );

        await agent.deliverMessages();
        expect(await token2B.balanceOf(user)).to.be.equal(value);

        const token2C = await ethers.getContractAt(
            "ERC20OnChain",
            await tokenManagerC.clonesErc20(schainBHash, token2B)
        );

        expect(await token2C.balanceOf(user)).to.be.equal(0n);
        expect(await token2B.balanceOf(user)).to.be.equal(value);

        const exchange = await upgrades.deployProxy(await ethers.getContractFactory("SwapMock"));
        await exchange.setTokenA(token1B);
        await exchange.setTokenB(token2B);
        await token2B.connect(user).transfer(exchange, value);

        expect(await token2B.balanceOf(user)).to.be.equal(0n);
        expect(await token2B.balanceOf(exchange)).to.be.equal(value);


        const swapMockSwap = await ethers.deployContract("SwapMockSwap");
        await swapMockSwap.setExecutionManager(executionManagerB);
        await swapMockSwap.setExchange(exchange);
        await executionManagerB.setExecutor(await swapMockSwap.ID(), swapMockSwap);



        const sendC = await ethers.getContractAt(
            "Send",
            await executionManagerC.getExecutor(
                ethers.id("Send")
            )
        );

        const sendRest = await ethers.getContractAt(
            "SendRest",
            await executionManagerB.getExecutor(
                ethers.id("SendRest")
            )
        )

        const xAmount = value / 3n;

        const metaAction = asMetaObject(await executionManagerA["createMetaAction(bytes32,(bytes32,bytes)[],(bytes32,bytes,bytes,bytes),(bytes32,bytes)[])"](
            schainBHash,
            [
                {
                    executor: ethers.id("SwapMockSwap"),
                    arguments: "0x"
                },
                {
                    executor: ethers.id("SendRest"),
                    arguments: await sendRest.encodeArguments(user, xAmount)
                }

            ],
            asMetaObject(await executionManagerA["createMetaAction(bytes32,(bytes32,bytes)[])"](
                schainCHash,
                [
                    {
                        executor: ethers.id("Send"),
                        arguments: await sendC.encodeArguments(user)
                    }
                ]
            )),
            []
        ));

        await token1A.connect(user).approve(executionManagerA, value);
        // Never requires to set dstToken on first message
        // It's automaticaly set before posting outgoing msg (if it's necessary).
        await executionManagerA.connect(user).execute(
            metaAction,
            [{token: token1A, value: value}],
            []
        );

        const logs = (await ethers.provider.getLogs({
            address: executionManagerA,
            fromBlock: 0,
            toBlock: "latest",
            topics: [
                executionManagerA.interface.getEvent("MetaActionCreated").topicHash
            ]
        })).map(log => executionManagerA.interface.parseLog(log));
        const metaActionId = logs[0]?.args.id;

        await agent.deliverMessages();

        //To send last confirmation message (probabily hits some limit).
        await agent.deliverMessages();


        expect(await token2C.balanceOf(user)).to.be.equal(xAmount);
        expect(await token2B.balanceOf(user)).to.be.equal(value - xAmount);
        expect(await token1A.balanceOf(user)).to.be.equal(0n);
        expect(await token1B.balanceOf(user)).to.be.equal(0n);
        expect(await token1B.balanceOf(exchange)).to.be.equal(value);
        expect((await executionManagerB.metaActions(metaActionId)).status).to.be.equal(MetaActionStatus.SUCCEED);
        expect((await executionManagerC.metaActions(metaActionId)).status).to.be.equal(MetaActionStatus.SUCCEED);
        expect((await executionManagerA.metaActions(metaActionId)).status).to.be.equal(MetaActionStatus.SUCCEED);
    });

    it("should send from Chain A to Chain B with exection of swap on Chain B and send back X to Chain C \
        but sending to chain C fails because B is not connected to C", async() => {
        const schains = await setupMultipleSchains(3);
        const agent = new AgentMock();
        for (const [schainName, schainSetup] of schains) {
            await agent.registerSchain(schainName, schainSetup.messageProxy);
        }
        const [schainAName, schainBName, schainCName] = [...schains.keys()];
        //const schainAHash = ethers.id(schainAName);
        const schainBHash = ethers.id(schainBName);
        const schainCHash = ethers.id(schainCName);


        const executionManagerA = schains.get(schainAName)?.executionManager;
        const executionManagerB = schains.get(schainBName)?.executionManager;
        const executionManagerC = schains.get(schainCName)?.executionManager;

        assert(executionManagerA);
        assert(executionManagerB);
        assert(executionManagerC);

        const tokenManagerA = schains.get(schainAName)?.tokenManager;
        const tokenManagerB = schains.get(schainBName)?.tokenManager;
        const tokenManagerC = schains.get(schainCName)?.tokenManager;

        assert(tokenManagerA);
        assert(tokenManagerB);
        assert(tokenManagerC);


        // Create tokens on chain B

        const token1B = await deployERC20OnChain("D2", "D2");
        const value = ethers.parseEther("1");
        await token1B.mint(user, value);

        const token2B = await deployERC20OnChain("D2", "D2");
        await token2B.mint(user, value);

        // Transfer token1B to chain A
        expect(await token1B.balanceOf(user)).to.be.equal(value);
        await token1B.connect(user).approve(tokenManagerB, value);
        await tokenManagerB.connect(user).transferToSchainERC20(
            schainAName,
            token1B, value
        );
        await agent.deliverMessages();

        const token1A = await ethers.getContractAt(
            "ERC20OnChain",
            await tokenManagerA.clonesErc20(schainBHash, token1B)
        );
        expect(await token1A.balanceOf(user)).to.be.equal(value);
        expect(await token1B.balanceOf(user)).to.be.equal(0n);

        // Transfer tokens to chain C
        await tokenManagerB.connect(user).transferToSchainERC20(
            schainCName,
            token2B, 0
        );

        await agent.deliverMessages();
        expect(await token2B.balanceOf(user)).to.be.equal(value);

        const token2C = await ethers.getContractAt(
            "ERC20OnChain",
            await tokenManagerC.clonesErc20(schainBHash, token2B)
        );

        expect(await token2C.balanceOf(user)).to.be.equal(0n);
        expect(await token2B.balanceOf(user)).to.be.equal(value);

        const exchange = await upgrades.deployProxy(await ethers.getContractFactory("SwapMock"));
        await exchange.setTokenA(token1B);
        await exchange.setTokenB(token2B);
        await token2B.connect(user).transfer(exchange, value);

        expect(await token2B.balanceOf(user)).to.be.equal(0n);
        expect(await token2B.balanceOf(exchange)).to.be.equal(value);


        const swapMockSwap = await ethers.deployContract("SwapMockSwap");
        await swapMockSwap.setExecutionManager(executionManagerB);
        await swapMockSwap.setExchange(exchange);
        await executionManagerB.setExecutor(await swapMockSwap.ID(), swapMockSwap);



        const sendC = await ethers.getContractAt(
            "Send",
            await executionManagerC.getExecutor(
                ethers.id("Send")
            )
        );

        const sendRest = await ethers.getContractAt(
            "SendRest",
            await executionManagerB.getExecutor(
                ethers.id("SendRest")
            )
        )

        const xAmount = value / 3n;

        await schains.get(schainBName)?.messageProxy.removeConnectedChain(schainCName);
        await schains.get(schainCName)?.messageProxy.removeConnectedChain(schainBName);

        const metaAction = asMetaObject(await executionManagerA["createMetaAction(bytes32,(bytes32,bytes)[],(bytes32,bytes,bytes,bytes),(bytes32,bytes)[])"](
            schainBHash,
            [
                {
                    executor: ethers.id("SwapMockSwap"),
                    arguments: "0x"
                },
                {
                    executor: ethers.id("SendRest"),
                    arguments: await sendRest.encodeArguments(user, xAmount)
                }

            ],
            asMetaObject(await executionManagerA["createMetaAction(bytes32,(bytes32,bytes)[])"](
                schainCHash,
                [
                    {
                        executor: ethers.id("Send"),
                        arguments: await sendC.encodeArguments(user)
                    }
                ]
            )),
            []
        ));

        await token1A.connect(user).approve(executionManagerA, value);
        await executionManagerA.connect(user).execute(
            metaAction,
            [{token: token1A, value: value}],
            []
        );
        const logs = (await ethers.provider.getLogs({
            address: executionManagerA,
            fromBlock: 0,
            toBlock: "latest",
            topics: [
                executionManagerA.interface.getEvent("MetaActionCreated").topicHash
            ]
        })).map(log => executionManagerA.interface.parseLog(log));
        const metaActionId = logs[0]?.args.id;
        console.log("Token1A:", await token1A.getAddress());
        console.log("Token1B:", await token1B.getAddress());

        await agent.deliverMessages();


        // Tokens arrive to chain B, where opperations swap and sendRest are performed successfuly.
        // However, the last operation is sending message to tokenManagerB, which posts an outgoing message to proxyB that should send them to Chain C
        // this last transaction will fail, because proxy will not have Chain C registered
        // Tokens should be locked

        expect(await token1B.balanceOf(executionManagerB)).to.be.equal(0n);
        expect(await token1A.balanceOf(executionManagerA)).to.be.equal(0n);
        expect(await token1B.balanceOf(exchange)).to.be.equal(0n);
        expect(await token1B.balanceOf(user)).to.be.equal(0n);

        // exchange has original balance
        expect(await token2B.balanceOf(exchange)).to.be.equal(value);
        // tokens should be in the locker
        expect(await token1B.balanceOf(await executionManagerB.tokenLocker())).to.be.equal(value);

        expect((await executionManagerA.metaActions(metaActionId)).status).to.be.equal(MetaActionStatus.EXECUTING);
        expect((await executionManagerB.metaActions(metaActionId)).status).to.be.equal(MetaActionStatus.EXECUTING);

        // Tokens are locked
        expect((await executionManagerB.getMetaActionsWithLockedTokens()).length).to.be.equal(1);

        // Hacker can't get them
        const hacker = Wallet.createRandom(ethers.provider);

        const locker = await ethers.getContractAt("TokenLocker", await executionManagerB.tokenLocker());
        await locker.connect(hacker).unlock(metaActionId).should.be.eventually.rejectedWith("Sender is not owner of tokens or is not Execution Manager.");

        //User Can't get them before time has passed
        await locker.connect(user).unlock(metaActionId).should.be.eventually.rejectedWith("User needs to wait for timeout to retrieve tokens.");

        //Skip time
        await skipTime(20*60);

        // Hacker still can't get them
        await locker.connect(hacker).unlock(metaActionId).should.be.eventually.rejectedWith("Sender is not owner of tokens or is not Execution Manager.");


        // User gets tokens
        await locker.connect(user).unlock(metaActionId);
        expect((await executionManagerB.getMetaActionsWithLockedTokens()).length).to.be.equal(0);
        expect(await token1B.balanceOf(user)).to.be.equal(value);
        expect(await token1B.balanceOf(await executionManagerB.tokenLocker())).to.be.equal(0n);
    });
});
