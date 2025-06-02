import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import { ERC20OnChain, ExecutionManager, MessageProxyForSchain, SwapMock, TokenLocker, TokenManagerERC20, TokenManagerLinker } from "../typechain";
import { deployExecutionManager } from "./utils/deploy/schain/executionManager";
import { AgentMock } from "./utils/agent/AgentMock";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { assert, expect } from "chai";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployTokenManagerERC20 } from "./utils/deploy/schain/tokenManagerERC20";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";
import { Wallet } from "ethers";
import { skipTime } from "./utils/time";
import { ProtocolTypes } from "../typechain/artifacts/contracts/schain/ExecutionLayer/ExecutionManager";

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

const asMetaObject = (metaAction: ProtocolTypes.MetaActionStructOutput) => {
    const asMetaAction: ProtocolTypes.MetaActionStruct = {
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

        const metaAction = asMetaObject(await sourceExecutionManager.createSimpleMetaAction(
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
        const metaAction = asMetaObject(await sourceExecutionManager.createSimpleMetaAction(
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

        const metaAction = asMetaObject(await executionManagerA.createChainedMetaAction(
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
            asMetaObject(await executionManagerA.createSimpleMetaAction(
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

    describe("Setup 3 schains, with 2 tokens in B cloned to A and C and exchanges in all", async () => {
        let schainAHash: string;
        let schainBHash: string;
        let schainCHash: string;
        let agent: AgentMock;
        let schains: Map<string, SchainSetup>;
        let schainAName: string;
        let schainBName: string;
        let schainCName: string;

        let executionManagerA: ExecutionManager;
        let executionManagerB: ExecutionManager;
        let executionManagerC: ExecutionManager;

        let tokenLockerB: TokenLocker;
        /* eslint-disable @typescript-eslint/no-unused-vars */
        let tokenLockerA: TokenLocker;
        let tokenLockerC: TokenLocker;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        let tokenManagerA: TokenManagerERC20;
        let tokenManagerB: TokenManagerERC20;
        let tokenManagerC: TokenManagerERC20;
        let token1B: ERC20OnChain;
        let token1A: ERC20OnChain;
        let token1C: ERC20OnChain;
        let token2B: ERC20OnChain;
        let token2A: ERC20OnChain;
        let token2C: ERC20OnChain;

        let exchangeA: SwapMock;
        let exchangeB: SwapMock;
        let exchangeC: SwapMock;
        const value = ethers.parseEther("1");

        beforeEach(async () => {
            schains = await setupMultipleSchains(3);
            agent = new AgentMock();
            for (const [schainName, schainSetup] of schains) {
                await agent.registerSchain(schainName, schainSetup.messageProxy);
            }
            [schainAName, schainBName, schainCName] = [...schains.keys()];
            schainAHash = ethers.id(schainAName);
            schainBHash = ethers.id(schainBName);
            schainCHash = ethers.id(schainCName);


            executionManagerA = schains.get(schainAName)!.executionManager;
            executionManagerB = schains.get(schainBName)!.executionManager;
            executionManagerC = schains.get(schainCName)!.executionManager;

            assert(executionManagerA);
            assert(executionManagerB);
            assert(executionManagerC);

            tokenManagerA = schains.get(schainAName)!.tokenManager;
            tokenManagerB = schains.get(schainBName)!.tokenManager;
            tokenManagerC = schains.get(schainCName)!.tokenManager;

            assert(tokenManagerA);
            assert(tokenManagerB);
            assert(tokenManagerC);


            // Create tokens on chain B

            token1B = await deployERC20OnChain("D2", "D2");
            await token1B.mint(user, value);

            token2B = await deployERC20OnChain("EDU", "EDU");
            await token2B.mint(user, value);

            // Create tokens on chain A and C

            await tokenManagerB.connect(user).transferToSchainERC20(
                schainAName,
                token1B, 0
            );
            await tokenManagerB.connect(user).transferToSchainERC20(
                schainAName,
                token2B, 0
            );

            await tokenManagerB.connect(user).transferToSchainERC20(
                schainCName,
                token1B, 0
            );
            await tokenManagerB.connect(user).transferToSchainERC20(
                schainCName,
                token2B, 0
            );

            await agent.deliverMessages();


            token1C = await ethers.getContractAt(
                "ERC20OnChain",
                await tokenManagerC.clonesErc20(schainBHash, token1B)
            );

            token1A = await ethers.getContractAt(
                "ERC20OnChain",
                await tokenManagerA.clonesErc20(schainBHash, token1B)
            );
            token2C = await ethers.getContractAt(
                "ERC20OnChain",
                await tokenManagerC.clonesErc20(schainBHash, token2B)
            );

            token2A = await ethers.getContractAt(
                "ERC20OnChain",
                await tokenManagerA.clonesErc20(schainBHash, token2B)
            );

            tokenLockerA = await ethers.getContractAt(
                "TokenLocker",
                await executionManagerA.tokenLocker()
            );
            tokenLockerB = await ethers.getContractAt(
                "TokenLocker",
                await executionManagerB.tokenLocker()
            );
            tokenLockerC = await ethers.getContractAt(
                "TokenLocker",
                await executionManagerC.tokenLocker()
            );

            exchangeA = await upgrades.deployProxy(await ethers.getContractFactory("SwapMock")) as unknown as SwapMock;
            await exchangeA.setTokenA(token1A);
            await exchangeA.setTokenB(token2A);

            exchangeB = await upgrades.deployProxy(await ethers.getContractFactory("SwapMock")) as unknown as SwapMock;
            await exchangeB.setTokenA(token1B);
            await exchangeB.setTokenB(token2B);

            exchangeC = await upgrades.deployProxy(await ethers.getContractFactory("SwapMock")) as unknown as SwapMock;
            await exchangeC.setTokenA(token1C);
            await exchangeC.setTokenB(token2C);
        })
        it.only("should Start in A, swap tokens in B, and return them to user in A", async () => {

            // Transfer the token to chain A
            await token1B.connect(user).approve(tokenManagerB, value);
            await tokenManagerB.connect(user).transferToSchainERC20(
                schainAName,
                token1B, value
            );

            await agent.deliverMessages();

            // Setup executors
            const swapMockSwap = await ethers.deployContract("SwapMockSwap");
            await swapMockSwap.setExecutionManager(executionManagerB);
            await swapMockSwap.setExchange(exchangeB);
            await executionManagerB.setExecutor(await swapMockSwap.ID(), swapMockSwap);

            // send balance to exchange

            await token2B.connect(user).transfer(exchangeB, value);

            expect(await token2A.balanceOf(user)).to.be.equal(0n);
            expect(await token2B.balanceOf(user)).to.be.equal(0n);
            expect(await token1A.balanceOf(user)).to.be.equal(value);
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(value);

            const metaAction = asMetaObject(await executionManagerA.createSimpleMetaAction(
                schainBHash,
                [
                    {
                        executor: ethers.id("SwapMockSwap"),
                        arguments: await swapMockSwap.encodeArguments(token1B, 0)
                    }
                ]
            ));

            await token1A.connect(user).approve(executionManagerA, value);
            await executionManagerA.connect(user).execute(
                metaAction,
                [{token: token1A, value: value}],
                []
            );

            await agent.deliverMessages();

            expect(await token1A.balanceOf(user)).to.be.equal(0n);
            expect(await token2A.balanceOf(user)).to.be.equal(value);
            expect(await token1B.balanceOf(exchangeB)).to.be.equal(value);
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(0n);
        });

        it.only("should send from Chain A to Chain B with execution of a swap on Chain B with X amount going back to Chain A", async () => {

            // Transfer the token to chain A
            await token1B.connect(user).approve(tokenManagerB, value);
            await tokenManagerB.connect(user).transferToSchainERC20(
                schainAName,
                token1B, value
            );

            await agent.deliverMessages();

            // Setup executors
            const swapMockSwap = await ethers.deployContract("SwapMockSwap");
            await swapMockSwap.setExecutionManager(executionManagerB);
            await swapMockSwap.setExchange(exchangeB);
            await executionManagerB.setExecutor(await swapMockSwap.ID(), swapMockSwap);

            // send balance to exchange

            await token2B.connect(user).transfer(exchangeB, value);

            expect(await token2A.balanceOf(user)).to.be.equal(0n);
            expect(await token2B.balanceOf(user)).to.be.equal(0n);
            expect(await token1A.balanceOf(user)).to.be.equal(value);
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(value);
            const sendRest = await ethers.getContractAt(
                "SendRest",
                await executionManagerA.getExecutor(ethers.id("SendRest"))
            )
            const xAmount = value / 3n;


            // Send tokens, swap and send x value back
            // Since there will be tokens left from execution in Chain B, they will be automaticaly sent back to the user
            const metaAction = asMetaObject(await executionManagerA.createSimpleMetaAction(
                schainBHash,
                [
                    {
                        executor: ethers.id("SwapMockSwap"),
                        arguments: await swapMockSwap.encodeArguments(token1B, 0)
                    },
                    {
                        executor: ethers.id("SendRest"),
                        arguments: await sendRest.encodeArguments(user, xAmount)
                    }
                ]
            ));

            await token1A.connect(user).approve(executionManagerA, value);
            await executionManagerA.connect(user).execute(
                metaAction,
                [{token: token1A, value: value}],
                []
            );

            await agent.deliverMessages();

            expect(await token1A.balanceOf(user)).to.be.equal(0n);
            expect(await token2A.balanceOf(user)).to.be.equal(xAmount);
            expect(await token1B.balanceOf(exchangeB)).to.be.equal(value);
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(0n);
            expect(await token2B.balanceOf(user)).to.be.equal(value-xAmount);

        });

        it.only("should send from Chain B to Chain A with execution of a swap on Chain A with X amount going back to Chain B", async () => {

            await token2B.connect(user).approve(tokenManagerB, value);
            await tokenManagerB.connect(user).transferToSchainERC20(
                schainAName,
                token2B, value
            );

            await agent.deliverMessages();

            // Setup executors
            const swapMockSwap = await ethers.deployContract("SwapMockSwap");
            await swapMockSwap.setExecutionManager(executionManagerA);
            await swapMockSwap.setExchange(exchangeA);
            await executionManagerA.setExecutor(await swapMockSwap.ID(), swapMockSwap);

            // send balance to exchange

            await token2A.connect(user).transfer(exchangeA, value);

            expect(await token2A.balanceOf(user)).to.be.equal(0n);
            expect(await token2B.balanceOf(user)).to.be.equal(0n);
            expect(await token1B.balanceOf(user)).to.be.equal(value);
            expect(await token2A.balanceOf(exchangeA)).to.be.equal(value);
            const sendRest = await ethers.getContractAt(
                "SendRest",
                await executionManagerA.getExecutor(ethers.id("SendRest"))
            )
            const xAmount = value / 3n;


            // Send tokens, swap and send x value back
            // Since there will be tokens left from execution in Chain B, they will be automaticaly sent back to the user
            const metaAction = asMetaObject(await executionManagerB.createSimpleMetaAction(
                schainAHash,
                [
                    {
                        executor: ethers.id("SwapMockSwap"),
                        arguments: await swapMockSwap.encodeArguments(token1A, 0)
                    },
                    {
                        executor: ethers.id("SendRest"),
                        arguments: await sendRest.encodeArguments(user, xAmount)
                    }
                ]
            ));

            console.log("Token2A:", await token2A.getAddress())
            console.log("Token2B:", await token2B.getAddress())

            await token1B.connect(user).approve(executionManagerB, value);
            await executionManagerB.connect(user).execute(
                metaAction,
                [{token: token1B, value: value}],
                []
            );

            await agent.deliverMessages();
            await agent.deliverMessages(); // for some reason it requires 2x ?? weird
            expect(await token1A.balanceOf(user)).to.be.equal(0n);
            expect(await token2A.balanceOf(user)).to.be.equal(value-xAmount);
            expect(await token1A.balanceOf(exchangeA)).to.be.equal(value);
            expect(await token2A.balanceOf(exchangeA)).to.be.equal(0n);
            expect(await token2B.balanceOf(user)).to.be.equal(xAmount);

        });

        it.only("should send from Chain A to Chain B with execution of 2 swaps on Chain B using 50% of the funds in each", async () => {

            // Transfer the token to chain A
            await token1B.connect(user).approve(tokenManagerB, value);
            await tokenManagerB.connect(user).transferToSchainERC20(
                schainAName,
                token1B, value
            );

            await agent.deliverMessages();

            const token3B = await deployERC20OnChain("T3", "T3");
            await token3B.mint(user, value);

            const exchangeB1 = await upgrades.deployProxy(await ethers.getContractFactory("SwapMock")) as unknown as SwapMock;
            await exchangeB1.setTokenA(token1B);
            await exchangeB1.setTokenB(token3B);

            // Setup executors
            const swapMockSwap = await ethers.deployContract("SwapMockSwap");
            await swapMockSwap.setExecutionManager(executionManagerB);
            await swapMockSwap.setExchange(exchangeB);
            await executionManagerB.setExecutor(await swapMockSwap.ID(), swapMockSwap);

            const swapMockSwap2 = await ethers.deployContract("SwapMockSwap");
            await swapMockSwap2.setExecutionManager(executionManagerB);
            await swapMockSwap2.setExchange(exchangeB1);
            await executionManagerB.setExecutor(ethers.id("SwapMockSwap1"), swapMockSwap2);


            // send balance to exchanges

            await token2B.connect(user).transfer(exchangeB, value);
            await token3B.connect(user).transfer(exchangeB1, value);


            expect(await token2A.balanceOf(user)).to.be.equal(0n);
            expect(await token2B.balanceOf(user)).to.be.equal(0n);
            expect(await token1A.balanceOf(user)).to.be.equal(value);
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(value);
            expect(await token3B.balanceOf(exchangeB1)).to.be.equal(value);

            const send = await ethers.getContractAt(
                "Send",
                await executionManagerA.getExecutor(ethers.id("Send"))
            )

            // Send tokens, swap and send x value back
            // Since there will be tokens left from execution in Chain B, they will be automaticaly sent back to the user
            const metaAction = asMetaObject(await executionManagerA.createSimpleMetaAction(
                schainBHash,
                [
                    {
                        executor: ethers.id("SwapMockSwap"),
                        arguments: await swapMockSwap.encodeArguments(token1B, value/2n)
                    },
                    {
                        executor: ethers.id("SwapMockSwap1"),
                        arguments: await swapMockSwap.encodeArguments(token1B, value/2n)
                    },
                    {
                        executor: ethers.id("Send"),
                        arguments: await send.encodeArguments(user)
                    }
                ]
            ));

            await token1A.connect(user).approve(executionManagerA, value);
            await executionManagerA.connect(user).execute(
                metaAction,
                [{token: token1A, value: value}],
                []
            );

            await agent.deliverMessages();

            expect(await token1A.balanceOf(user)).to.be.equal(0n);
            expect(await token2A.balanceOf(user)).to.be.equal(0n);
            expect(await token1B.balanceOf(exchangeB)).to.be.equal(value/2n);
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(value/2n);
            expect(await token1B.balanceOf(exchangeB1)).to.be.equal(value/2n);
            expect(await token3B.balanceOf(exchangeB1)).to.be.equal(value/2n);

            expect(await token1B.balanceOf(user)).to.be.equal(0n);
            expect(await token2B.balanceOf(user)).to.be.equal(value/2n);
            expect(await token3B.balanceOf(user)).to.be.equal(value/2n);

        });

        it.only("should send from Chain A to Chain B with exection of swap on Chain B and send back X to Chain C", async () => {
            // Transfer the token to chain A
            await token1B.connect(user).approve(tokenManagerB, value);
            await tokenManagerB.connect(user).transferToSchainERC20(
                schainAName,
                token1B, value
            );

            await agent.deliverMessages();

            // Setup executors
            const swapMockSwap = await ethers.deployContract("SwapMockSwap");
            await swapMockSwap.setExecutionManager(executionManagerB);
            await swapMockSwap.setExchange(exchangeB);
            await executionManagerB.setExecutor(await swapMockSwap.ID(), swapMockSwap);

            // send balance to exchange

            await token2B.connect(user).transfer(exchangeB, value);

            expect(await token2A.balanceOf(user)).to.be.equal(0n);
            expect(await token2B.balanceOf(user)).to.be.equal(0n);
            expect(await token1A.balanceOf(user)).to.be.equal(value);
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(value);
            const sendRest = await ethers.getContractAt(
                "SendRest",
                await executionManagerA.getExecutor(ethers.id("SendRest"))
            );

            const send = await ethers.getContractAt(
                "Send",
                await executionManagerA.getExecutor(ethers.id("Send"))
            )
            const xAmount = value / 3n;

            const metaAction = asMetaObject(await executionManagerA.createChainedMetaAction(
                schainBHash,
                [
                    {
                        executor: ethers.id("SwapMockSwap"),
                        arguments: await swapMockSwap.encodeArguments(token1B, 0)
                    },
                    {
                        executor: ethers.id("SendRest"),
                        arguments: await sendRest.encodeArguments(user, xAmount)
                    }

                ],
                asMetaObject(await executionManagerA.createSimpleMetaAction(
                    schainCHash,
                    [
                        {
                            executor: ethers.id("Send"),
                            arguments: await send.encodeArguments(user)
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

            await agent.deliverMessages();

            expect(await token1A.balanceOf(user)).to.be.equal(0n);
            expect(await token2C.balanceOf(user)).to.be.equal(xAmount);
            expect(await token1B.balanceOf(exchangeB)).to.be.equal(value);
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(0n);
            expect(await token2B.balanceOf(user)).to.be.equal(value-xAmount);
        });

        it.only("transfer from A to B, swap in B, and fail transfer X to C. tokens stay locked", async () => {
            // Transfer the token to chain A
            await token1B.connect(user).approve(tokenManagerB, value);
            await tokenManagerB.connect(user).transferToSchainERC20(
                schainAName,
                token1B, value
            );

            await agent.deliverMessages();

            // Setup executors
            const swapMockSwap = await ethers.deployContract("SwapMockSwap");
            await swapMockSwap.setExecutionManager(executionManagerB);
            await swapMockSwap.setExchange(exchangeB);
            await executionManagerB.setExecutor(await swapMockSwap.ID(), swapMockSwap);

            // send balance to exchange

            await token2B.connect(user).transfer(exchangeB, value);

            expect(await token2A.balanceOf(user)).to.be.equal(0n);
            expect(await token2B.balanceOf(user)).to.be.equal(0n);
            expect(await token1A.balanceOf(user)).to.be.equal(value);
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(value);
            const sendRest = await ethers.getContractAt(
                "SendRest",
                await executionManagerA.getExecutor(ethers.id("SendRest"))
            );

            const send = await ethers.getContractAt(
                "Send",
                await executionManagerA.getExecutor(ethers.id("Send"))
            )
            const xAmount = value / 3n;
            await schains.get(schainBName)?.messageProxy.removeConnectedChain(schainCName);
            await schains.get(schainCName)?.messageProxy.removeConnectedChain(schainBName);
            const metaAction = asMetaObject(await executionManagerA.createChainedMetaAction(
                schainBHash,
                [
                    {
                        executor: ethers.id("SwapMockSwap"),
                        arguments: await swapMockSwap.encodeArguments(token1B, 0)
                    },
                    {
                        executor: ethers.id("SendRest"),
                        arguments: await sendRest.encodeArguments(user, xAmount)
                    }

                ],
                asMetaObject(await executionManagerA.createSimpleMetaAction(
                    schainCHash,
                    [
                        {
                            executor: ethers.id("Send"),
                            arguments: await send.encodeArguments(user)
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

            await agent.deliverMessages();

            // Tokens arrive to chain B, where opperations swap and sendRest are performed successfuly.
            // However, the last operation is sending message to tokenManagerB, which posts an outgoing message to proxyB that should send them to Chain C
            // this last transaction will fail, because proxy will not have Chain C registered
            // Tokens should be locked

            expect(await token1B.balanceOf(executionManagerB)).to.be.equal(0n);
            expect(await token1A.balanceOf(executionManagerA)).to.be.equal(0n);
            expect(await token1B.balanceOf(exchangeB)).to.be.equal(0n);
            expect(await token1B.balanceOf(user)).to.be.equal(0n);

            // exchangeB has original balance
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(value);
            // tokens should be in the locker
            expect(await token1B.balanceOf(await executionManagerB.tokenLocker())).to.be.equal(value);

            expect((await executionManagerA.metaActions(metaActionId)).status).to.be.equal(MetaActionStatus.FAILED);
            expect((await executionManagerB.metaActions(metaActionId)).status).to.be.equal(MetaActionStatus.FAILED);

            // Tokens are locked
            expect((await executionManagerB.getMetaActionsWithLockedTokens()).length).to.be.equal(1);

            // Hacker can't get them
            const hacker = Wallet.createRandom(ethers.provider);

            await tokenLockerB.connect(hacker).unlock(metaActionId).should.be.eventually.rejectedWith("Sender is not owner of tokens or is not Execution Manager.");

            //User Can't get them before time has passed
            await tokenLockerB.connect(user).unlock(metaActionId).should.be.eventually.rejectedWith("User needs to wait for timeout to retrieve tokens.");

            //Skip time 20minutes
            await skipTime(20*60);

            // Hacker still can't get them
            await tokenLockerB.connect(hacker).unlock(metaActionId).should.be.eventually.rejectedWith("Sender is not owner of tokens or is not Execution Manager.");

            // User gets tokens
            const tokens = await tokenLockerB.getLockedTokensForMetaAction(metaActionId);
            await tokenLockerB.connect(user).unlock(metaActionId);
            for (const token of tokens) {
                const contract = await ethers.getContractAt("IERC20", token.token);
                const tx = await contract.connect(user).transferFrom(tokenLockerB, user, token.value);
                await tx.wait();
            }
            expect((await executionManagerB.getMetaActionsWithLockedTokens()).length).to.be.equal(0);
            expect(await token1B.balanceOf(user)).to.be.equal(value);
            expect(await token1B.balanceOf(await executionManagerB.tokenLocker())).to.be.equal(0n);
        });

        it.only("transfer from A to B, and block reentrancy in B with tokens staying locked in B", async () => {
            // Transfer the token to chain A
            await token1B.connect(user).approve(tokenManagerB, value);
            await tokenManagerB.connect(user).transferToSchainERC20(
                schainAName,
                token1B, value
            );

            await agent.deliverMessages();

            // Setup executors
            const swapMockSwap = await ethers.deployContract("SwapMockSwap");
            await swapMockSwap.setExecutionManager(executionManagerB);
            await swapMockSwap.setExchange(exchangeB);
            await executionManagerB.setExecutor(await swapMockSwap.ID(), swapMockSwap);

            const reentrancy = await upgrades.deployProxy(await ethers.getContractFactory("ReentrancyExecutor"), [await executionManagerB.getAddress()]);
            await reentrancy.waitForDeployment();
            await executionManagerB.setExecutor(await reentrancy.ID(), reentrancy);

            // send balance to exchange

            await token2B.connect(user).transfer(exchangeB, value);

            expect(await token2A.balanceOf(user)).to.be.equal(0n);
            expect(await token2B.balanceOf(user)).to.be.equal(0n);
            expect(await token1A.balanceOf(user)).to.be.equal(value);
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(value);

            await schains.get(schainBName)?.messageProxy.removeConnectedChain(schainCName);
            await schains.get(schainCName)?.messageProxy.removeConnectedChain(schainBName);
            const metaAction = asMetaObject(await executionManagerA.createSimpleMetaAction(
                schainBHash,
                [
                    {
                        executor: ethers.id("SwapMockSwap"),
                        arguments: await swapMockSwap.encodeArguments(token1B, 0)
                    },
                    {
                        executor: ethers.id("ReentrancyExecutor"),
                        arguments: "0x00"
                    }
                ]
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

            await agent.deliverMessages();

            // Tokens arrive to chain B, where opperation swap is performed successfuly.
            // However, the last execution triggers a reentracy by trying to create a MetaAction in ExecutionManager
            // this should fail because of the reentrancy guards
            // Tokens should be locked in B as they arrived

            expect(await token1B.balanceOf(executionManagerB)).to.be.equal(0n);
            expect(await token1A.balanceOf(executionManagerA)).to.be.equal(0n);
            expect(await token1B.balanceOf(exchangeB)).to.be.equal(0n);
            expect(await token1B.balanceOf(user)).to.be.equal(0n);

            // exchangeB has original balance
            expect(await token2B.balanceOf(exchangeB)).to.be.equal(value);
            // tokens should be in the locker
            expect(await token1B.balanceOf(await executionManagerB.tokenLocker())).to.be.equal(value);

            expect((await executionManagerA.metaActions(metaActionId)).status).to.be.equal(MetaActionStatus.FAILED);
            expect((await executionManagerB.metaActions(metaActionId)).status).to.be.equal(MetaActionStatus.FAILED);

            // Tokens are locked
            expect((await executionManagerB.getMetaActionsWithLockedTokens()).length).to.be.equal(1);

            // Hacker can't get them
            const hacker = Wallet.createRandom(ethers.provider);

            await tokenLockerB.connect(hacker).unlock(metaActionId).should.be.eventually.rejectedWith("Sender is not owner of tokens or is not Execution Manager.");

            //User Can't get them before time has passed
            await tokenLockerB.connect(user).unlock(metaActionId).should.be.eventually.rejectedWith("User needs to wait for timeout to retrieve tokens.");

            //Skip time 20minutes
            await skipTime(20*60);

            // Hacker still can't get them
            await tokenLockerB.connect(hacker).unlock(metaActionId).should.be.eventually.rejectedWith("Sender is not owner of tokens or is not Execution Manager.");

            // User gets tokens
            const tokens = await tokenLockerB.getLockedTokensForMetaAction(metaActionId);
            await tokenLockerB.connect(user).unlock(metaActionId);
            for (const token of tokens) {
                const contract = await ethers.getContractAt("IERC20", token.token);
                const tx = await contract.connect(user).transferFrom(tokenLockerB, user, token.value);
                await tx.wait();
            }
            expect((await executionManagerB.getMetaActionsWithLockedTokens()).length).to.be.equal(0);
            expect(await token1B.balanceOf(user)).to.be.equal(value);
            expect(await token1B.balanceOf(await executionManagerB.tokenLocker())).to.be.equal(0n);
        });
    });
});
