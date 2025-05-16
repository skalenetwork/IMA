import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, upgrades } from "hardhat";
import { ExecutionManager, MessageProxyForSchain, TokenManagerERC20, TokenManagerLinker } from "../typechain";
import { deployExecutionManager } from "./utils/deploy/schain/executionManager";
import { AgentMock } from "./utils/agent/AgentMock";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { assert, expect } from "chai";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployTokenManagerERC20 } from "./utils/deploy/schain/tokenManagerERC20";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";
import { Protocol } from "../typechain/artifacts/contracts/schain/ExecutionLayer/ExecutionManager";
import { ZeroAddress } from "ethers";

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

        const executionManager = await deployExecutionManager(tokenManagerErc20);

        console.log(`Chain ${schainName}`);
        console.log(`MessageProxy: ${await ethers.resolveAddress(messageProxy)}`);
        console.log(`TokenManager: ${await ethers.resolveAddress(tokenManagerErc20)}`);
        console.log(`ExecutionManager: ${await ethers.resolveAddress(executionManager)}`);

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
            [{token: clone, value: value, schain: sourceSchainHash, dstToken: token}]
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
            [{token: clone, value: value, schain: sourceSchainHash, dstToken: token}]
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

        const send = await ethers.getContractAt(
            "Send",
            await sourceExecutionManager.getExecutor(
                ethers.id("Send")
            )
        );

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
        console.log(".");
        console.log(".");
        console.log(".");
        console.log(".");
        console.log(".");

        // Send tokens, swap and send x value back
        const metaAction = asMetaObject(await sourceExecutionManager["createMetaAction(bytes32,(bytes32,bytes)[],(bytes32,bytes,bytes,bytes),(bytes32,bytes)[])"](
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
            ],
            asMetaObject(await sourceExecutionManager["createMetaAction(bytes32,(bytes32,bytes)[])"](
                sourceSchainHash,
                [
                    {
                        executor: ethers.id("Send"),
                        arguments: await send.encodeArguments(user)
                    }
                ]
            )),
            []
        ));

        await clone.connect(user).approve(sourceExecutionManager, value);
        // since transfer starts with a clone, it requires to set dstToken
        // if not, it can be set to address(0)
        await sourceExecutionManager.connect(user).execute(
            metaAction,
            [{token: clone, value: value, schain: sourceSchainHash, dstToken: token}]
        );



        await agent.deliverMessages();

        expect(await token.balanceOf(user)).to.be.equal(0n);
        expect(await token2.balanceOf(user)).to.be.equal(value - xAmount);
        expect(await clone.balanceOf(user)).to.be.equal(0n);
        expect(await clone2.balanceOf(user)).to.be.equal(xAmount);
    });

    it("should send from Chain A to Chain B to Chain C with execution of a swap on Chain C", async() => {
        const schains = await setupMultipleSchains(3);
        const agent = new AgentMock();
        for (const [schainName, schainSetup] of schains) {
            await agent.registerSchain(schainName, schainSetup.messageProxy);
        }
        const [schainAName, schainBName, schainCName] = [...schains.keys()];
        const schainAHash = ethers.id(schainAName);
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
        expect(await token2B.balanceOf(user)).to.be.equal(value);
        await token2B.connect(user).approve(tokenManagerB, value);
        await tokenManagerB.connect(user).transferToSchainERC20(
            schainCName,
            token2B, value
        );
        await tokenManagerB.connect(user).transferToSchainERC20(
            schainCName,
            token1B, 0
        );

        await agent.deliverMessages();

        const token1C = await ethers.getContractAt(
            "ERC20OnChain",
            await tokenManagerC.clonesErc20(schainBHash, token1B)
        );
        const token2C = await ethers.getContractAt(
            "ERC20OnChain",
            await tokenManagerC.clonesErc20(schainBHash, token2B)
        );

        expect(await token2C.balanceOf(user)).to.be.equal(value);
        expect(await token2B.balanceOf(user)).to.be.equal(0n);
        expect(await token1C.balanceOf(user)).to.be.equal(0n);



        const exchange = await upgrades.deployProxy(await ethers.getContractFactory("SwapMock"));
        await exchange.setTokenA(token1C);
        await exchange.setTokenB(token2C);
        await token2C.connect(user).transfer(exchange, value);

        expect(await token2C.balanceOf(user)).to.be.equal(0n);
        expect(await token2C.balanceOf(exchange)).to.be.equal(value);


        const swapMockSwap = await ethers.deployContract("SwapMockSwap");
        await swapMockSwap.setExecutionManager(executionManagerC);
        await swapMockSwap.setExchange(exchange);
        await executionManagerC.setExecutor(await swapMockSwap.ID(), swapMockSwap);



        const sendC = await ethers.getContractAt(
            "Send",
            await executionManagerC.getExecutor(
                ethers.id("Send")
            )
        );

        const metaAction = asMetaObject(await executionManagerA["createMetaAction(bytes32,(bytes32,bytes)[],(bytes32,bytes,bytes,bytes),(bytes32,bytes)[])"](
            schainBHash,
            [],
            asMetaObject(await executionManagerA["createMetaAction(bytes32,(bytes32,bytes)[])"](
                schainCHash,
                [
                    {
                        executor: ethers.id("SwapMockSwap"),
                        arguments: "0x"
                    },
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
            [{token: token1A, value: value, schain: schainAHash, dstToken: ZeroAddress}]
        );

        await agent.deliverMessages();

        expect(await token2C.balanceOf(exchange)).to.be.equal(0n);
        expect(await token1C.balanceOf(exchange)).to.be.equal(value);
        expect(await token2C.balanceOf(user)).to.be.equal(value);
        expect(await token2B.balanceOf(user)).to.be.equal(0n);
        expect(await token1A.balanceOf(user)).to.be.equal(0n);
        expect(await token1B.balanceOf(user)).to.be.equal(0n);

    });
});
