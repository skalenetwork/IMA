import chaiAsPromised from "chai-as-promised";
import chai, { expect } from "chai";
import {
    TokenManagerSFuelHub,
    TokenManagerLinker,
    MessageProxyForSchainTester,
    MessagesTester,
    EthErc20,
    CommunityLocker,
    TokenManagerSFuelSource
} from "../typechain";

chai.should();
chai.use(chaiAsPromised);

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { deployTokenManagerSFuelHub } from "./utils/deploy/schain/tokenManagerSFuelHub";
import { deployTokenManagerSFuelSource } from "./utils/deploy/schain/tokenManagerSFuelSource";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";
import { deployEthErc20 } from "./utils/deploy/schain/ethErc20";
import { deployMessages } from "./utils/deploy/messages";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

const hubName = "Hub";
const sourceChainName = "SourceChain";
const sourceChainName2 = "SourceChain2";
const hubHash = ethers.id(hubName);
const sourceChainHash = ethers.id(sourceChainName);
const sourceChainHash2 = ethers.id(sourceChainName2);

describe("TokenManagerSFuelHub", () => {
    let deployer: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let tokenHolder: SignerWithAddress;

    let tokenManagerHub: TokenManagerSFuelHub;
    let tokenManagerSource: TokenManagerSFuelSource;
    let tokenManagerSource2: TokenManagerSFuelSource;
    let tokenManagerLinker: TokenManagerLinker;
    let messageProxy: MessageProxyForSchainTester;
    let messages: MessagesTester;
    let sFuelToken1: EthErc20;
    let sFuelToken2: EthErc20;
    let communityLocker: CommunityLocker;

    const transferAmount = ethers.parseEther("10");
    const largeAmount = ethers.parseEther("1000");

    before(async () => {
        [deployer, user1, user2, tokenHolder] = await ethers.getSigners();
    });

    beforeEach(async () => {
        // Deploy infrastructure
        const keyStorage = await deployKeyStorageMock();
        messageProxy = await deployMessageProxyForSchainTester(keyStorage, hubName);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxy, deployer.address);
        communityLocker = await deployCommunityLocker(
            hubName,
            messageProxy,
            tokenManagerLinker,
            deployer.address
        );

        // Deploy TokenManagerSFuelHub (hub)
        tokenManagerHub = await deployTokenManagerSFuelHub(
            hubName,
            messageProxy,
            tokenManagerLinker,
            communityLocker
        );

        // Deploy TokenManagerSFuelSource (source chain)
        tokenManagerSource = await deployTokenManagerSFuelSource(
            sourceChainName,
            messageProxy,
            tokenManagerLinker,
            communityLocker
        );

        // Deploy TokenManagerSFuelSource (source chain 2)
        tokenManagerSource2 = await deployTokenManagerSFuelSource(
            sourceChainName2,
            messageProxy,
            tokenManagerLinker,
            communityLocker
        );

        // Deploy sFuel tokens
        sFuelToken1 = await deployEthErc20(tokenManagerHub as TokenManagerSFuelHub);
        sFuelToken2 = await deployEthErc20(tokenManagerHub as TokenManagerSFuelHub);

        // Register token managers with the linker
        await tokenManagerLinker.registerTokenManager(tokenManagerHub);
        await tokenManagerLinker.registerTokenManager(tokenManagerSource);

        // --- HUB <-> SOURCE CHAIN 1 CONNECTION ---
        await tokenManagerHub.addTokenManager(sourceChainName, await tokenManagerSource.getAddress());
        await tokenManagerSource.addTokenManager(hubName, await tokenManagerHub.getAddress());

        // --- HUB <-> SOURCE CHAIN 2 CONNECTION ---
        await tokenManagerHub.addTokenManager(sourceChainName2, await tokenManagerSource.getAddress());
        await tokenManagerSource2.addTokenManager(hubName, await tokenManagerHub.getAddress());

        // --- MESSAGE PROXY SETUP FOR BOTH CHAINS ---
        const chainConnectorRole = await messageProxy.CHAIN_CONNECTOR_ROLE();
        await messageProxy.grantRole(chainConnectorRole, deployer.address);
        await messageProxy.connect(deployer).addConnectedChain(sourceChainName);
        await messageProxy.connect(deployer).addConnectedChain(sourceChainName2);

        // Grant permission to register extra contracts
        const extraContractRegistrarRole = await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxy.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);

        // Register TokenManagerSFuelHub as an extra contract for both source chains
        await messageProxy.registerExtraContract(sourceChainName, await tokenManagerHub.getAddress());
        await messageProxy.registerExtraContract(sourceChainName2, await tokenManagerHub.getAddress());

        // Register sFuel tokens for both source chains
        await tokenManagerHub.registerSFuelToken(sourceChainName, await sFuelToken1.getAddress());
        await tokenManagerHub.registerSFuelToken(sourceChainName2, await sFuelToken2.getAddress());

        // Setup messages
        messages = await deployMessages();

        // Grant MINTER_ROLE to deployer for both tokens
        const MINTER_ROLE = await sFuelToken1.MINTER_ROLE();
        await sFuelToken1.grantRole(MINTER_ROLE, deployer.address);
        await sFuelToken2.grantRole(MINTER_ROLE, deployer.address);

        // Mint some tokens for testing
        await sFuelToken1.connect(deployer).mint(tokenHolder.address, largeAmount);
        await sFuelToken2.connect(deployer).mint(tokenHolder.address, largeAmount);
    });


    describe("Initialization", () => {
        it("should initialize with correct parameters", async () => {
            expect(await tokenManagerHub.schainHash()).to.equal(hubHash);
            expect(await tokenManagerHub.messageProxy()).to.equal(await messageProxy.getAddress());
            expect(await tokenManagerHub.tokenManagerLinker()).to.equal(await tokenManagerLinker.getAddress());
            expect(await tokenManagerHub.communityLocker()).to.equal(await communityLocker.getAddress());
        });

        it("should set up correct roles for deployer", async () => {
            const defaultAdminRole = await tokenManagerHub.DEFAULT_ADMIN_ROLE();
            const automaticDeployRole = await tokenManagerHub.AUTOMATIC_DEPLOY_ROLE();
            const tokenRegistrarRole = await tokenManagerHub.TOKEN_REGISTRAR_ROLE();

            expect(await tokenManagerHub.hasRole(defaultAdminRole, deployer.address)).to.equal(true);
            expect(await tokenManagerHub.hasRole(automaticDeployRole, deployer.address)).to.equal(true);
            expect(await tokenManagerHub.hasRole(tokenRegistrarRole, deployer.address)).to.equal(true);
        });
    });

    describe("registerSFuelToken", () => {
        it("should register sFuel token for a source chain", async () => {
            const newToken = await deployEthErc20(tokenManagerHub as TokenManagerSFuelHub);
            const chainName = "NewChain";

            await expect(tokenManagerHub.registerSFuelToken(chainName, await newToken.getAddress()))
                .to.emit(tokenManagerHub, "SFuelTokenRegistered")
                .withArgs(ethers.id(chainName), await newToken.getAddress());

            expect(await tokenManagerHub.getSFuelToken(chainName)).to.equal(await newToken.getAddress());
        });

        it("should revert when non-admin tries to register token", async () => {
            const newToken = await deployEthErc20(tokenManagerHub as TokenManagerSFuelHub);

            await expect(
                tokenManagerHub.connect(user1).registerSFuelToken("NewChain", await newToken.getAddress())
            ).to.be.rejectedWith("Not authorized caller");
        });

        it("should revert when trying to register token for already registered chain", async () => {
            const newToken = await deployEthErc20(tokenManagerHub as TokenManagerSFuelHub);

            await expect(
                tokenManagerHub.registerSFuelToken(sourceChainName, await newToken.getAddress())
            ).to.be.rejectedWith("Token already registered");
        });

        it("should update sFuelTokenToChainHash mapping correctly", async () => {
            const newToken = await deployEthErc20(tokenManagerHub as TokenManagerSFuelHub);
            const chainName = "NewChain";
            const expectedChainHash = ethers.id(chainName);

            await tokenManagerHub.registerSFuelToken(chainName, await newToken.getAddress());

            expect(await tokenManagerHub.sFuelTokenToChainHash(await newToken.getAddress())).to.equal(expectedChainHash);
        });
    });

    describe("sendSFuelBackToSource", () => {
        beforeEach(async () => {
            await sFuelToken1.connect(tokenHolder).transfer(user1.address, transferAmount);
        });

        it("should send sFuel back to source chain successfully", async () => {
            const balanceBefore = await sFuelToken1.balanceOf(user1.address);

            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await sFuelToken1.getAddress(),
                    user2.address,
                    transferAmount
                )
            ).to.emit(tokenManagerHub, "SFuelSentBack")
             .withArgs(sourceChainHash, user1.address, transferAmount);

            const balanceAfter = await sFuelToken1.balanceOf(user1.address);
            expect(balanceAfter).to.equal(balanceBefore - transferAmount);
        });

        it("should revert with invalid receiver address", async () => {
            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await sFuelToken1.getAddress(),
                    ethers.ZeroAddress,
                    transferAmount
                )
            ).to.be.rejectedWith("Invalid receiver address");
        });

        it("should revert with zero amount", async () => {
            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await sFuelToken1.getAddress(),
                    user2.address,
                    0
                )
            ).to.be.rejectedWith("Amount must be greater than 0");
        });

        it("should revert with unknown sFuel token", async () => {
            const unknownToken = await deployEthErc20(tokenManagerHub as TokenManagerSFuelHub);

            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await unknownToken.getAddress(),
                    user2.address,
                    transferAmount
                )
            ).to.be.rejectedWith("Unknown sFuel token");
        });

        it("should revert when source chain not connected", async () => {
            const unconnectedToken = await deployEthErc20(tokenManagerHub as TokenManagerSFuelHub);
            const unconnectedChain = "UnconnectedChain";
            await tokenManagerHub.registerSFuelToken(unconnectedChain, await unconnectedToken.getAddress());

            const MINTER_ROLE = await unconnectedToken.MINTER_ROLE();
            await unconnectedToken.grantRole(MINTER_ROLE, deployer.address);

            await unconnectedToken.mint(user1.address, transferAmount);

            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await unconnectedToken.getAddress(),
                    user2.address,
                    transferAmount
                )
            ).to.be.rejectedWith("Source chain not connected");
        });

        it("should revert with insufficient balance", async () => {
            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await sFuelToken1.getAddress(),
                    user2.address,
                    largeAmount
                )
            ).to.be.rejectedWith("Insufficient balance");
        });

        it("should burn tokens before sending message", async () => {
            const totalSupplyBefore = await sFuelToken1.totalSupply();

            await tokenManagerHub.connect(user1).sendSFuelBackToSource(
                await sFuelToken1.getAddress(),
                user2.address,
                transferAmount
            );

            const totalSupplyAfter = await sFuelToken1.totalSupply();
            expect(totalSupplyAfter).to.equal(totalSupplyBefore - transferAmount);
        });

        it("should work with different tokens from different chains", async () => {
            await sFuelToken2.connect(tokenHolder).transfer(user1.address, transferAmount);

            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await sFuelToken1.getAddress(),
                    user2.address,
                    transferAmount / 2n
                )
            ).to.emit(tokenManagerHub, "SFuelSentBack")
             .withArgs(sourceChainHash, user1.address, transferAmount / 2n);

            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await sFuelToken2.getAddress(),
                    user2.address,
                    transferAmount / 2n
                )
            ).to.emit(tokenManagerHub, "SFuelSentBack")
             .withArgs(sourceChainHash2, user1.address, transferAmount / 2n);
        });
    });

    describe("postMessage", () => {
        let transferData: string;

        beforeEach(async () => {
            transferData = await messages.encodeTransferSFuelToHubMessage(user1.address, transferAmount);
        });

        it("should receive sFuel from source chain and mint tokens", async () => {
            const balanceBefore = await sFuelToken1.balanceOf(user1.address);

            await expect(
                messageProxy.postMessage(
                    tokenManagerHub,
                    sourceChainHash,
                    await tokenManagerSource.getAddress(),
                    transferData
                )
            ).to.emit(tokenManagerHub, "SFuelReceived")
             .withArgs(sourceChainHash, user1.address, transferAmount);

            const balanceAfter = await sFuelToken1.balanceOf(user1.address);
            expect(balanceAfter).to.equal(balanceBefore + transferAmount);
        });

        it("should revert when called by non-message proxy", async () => {
            await expect(
                tokenManagerHub.connect(user1).postMessage(
                    sourceChainHash,
                    await tokenManagerSource.getAddress(),
                    transferData
                )
            ).to.be.rejectedWith("Sender is not a MessageProxy");
        });

        it("should revert with incorrect receiver in message", async () => {
            const invalidData = await messages.encodeTransferSFuelToHubMessage(ethers.ZeroAddress, transferAmount);

            await expect(
                messageProxy.postMessage(
                    tokenManagerHub,
                    sourceChainHash,
                    await tokenManagerSource.getAddress(),
                    invalidData
                )
            ).to.be.rejectedWith("Incorrect receiver");
        });

        it("should revert when sFuel token not registered for source chain", async () => {
            const unregisteredChainHash = ethers.id("UnregisteredChain");
            await tokenManagerHub.addTokenManager("UnregisteredChain", tokenManagerSource);
            await expect(
                messageProxy.postMessage(
                    tokenManagerHub,
                    unregisteredChainHash,
                    tokenManagerSource,
                    transferData
                )
            ).to.be.rejectedWith("sFuel token not registered for source chain");
        });

        it("should revert when sender is not authorized token manager", async () => {
            await expect(
                messageProxy.postMessage(
                    tokenManagerHub,
                    sourceChainHash,
                    user1.address,
                    transferData
                )
            ).to.be.rejectedWith("Receiver chain is incorrect");
        });

        it("should mint tokens to correct receiver", async () => {
            const receiver = user2.address;
            const receiverData = await messages.encodeTransferSFuelToHubMessage(receiver, transferAmount);

            const balanceBefore = await sFuelToken1.balanceOf(receiver);

            await messageProxy.postMessage(
                tokenManagerHub,
                sourceChainHash,
                await tokenManagerSource.getAddress(),
                receiverData
            );

            const balanceAfter = await sFuelToken1.balanceOf(receiver);
            expect(balanceAfter).to.equal(balanceBefore + transferAmount);
        });

        it("should handle multiple transfers from same chain", async () => {
            const balanceBefore = await sFuelToken1.balanceOf(user1.address);

            await messageProxy.postMessage(
                tokenManagerHub,
                sourceChainHash,
                await tokenManagerSource.getAddress(),
                transferData
            );

            await messageProxy.postMessage(
                tokenManagerHub,
                sourceChainHash,
                await tokenManagerSource.getAddress(),
                transferData
            );

            const balanceAfter = await sFuelToken1.balanceOf(user1.address);
            expect(balanceAfter).to.equal(balanceBefore + (transferAmount * 2n));
        });

        it("should handle transfers from different chains", async () => {
            const data1 = await messages.encodeTransferSFuelToHubMessage(user1.address, transferAmount);
            const data2 = await messages.encodeTransferSFuelToHubMessage(user1.address, transferAmount);

            const balance1Before = await sFuelToken1.balanceOf(user1.address);
            const balance2Before = await sFuelToken2.balanceOf(user1.address);

            await messageProxy.postMessage(
                tokenManagerHub,
                sourceChainHash,
                await tokenManagerSource.getAddress(),
                data1
            );

            await messageProxy.postMessage(
                tokenManagerHub,
                sourceChainHash2,
                await tokenManagerSource.getAddress(),
                data2
            );

            const balance1After = await sFuelToken1.balanceOf(user1.address);
            const balance2After = await sFuelToken2.balanceOf(user1.address);

            expect(balance1After).to.equal(balance1Before + transferAmount);
            expect(balance2After).to.equal(balance2Before + transferAmount);
        });
    });

    describe("getSFuelToken", () => {
        it("should return correct token address for registered chain", async () => {
            const tokenAddress = await tokenManagerHub.getSFuelToken(sourceChainName);
            expect(tokenAddress).to.equal(await sFuelToken1.getAddress());
        });

        it("should return zero address for unregistered chain", async () => {
            const tokenAddress = await tokenManagerHub.getSFuelToken("UnregisteredChain");
            expect(tokenAddress).to.equal(ethers.ZeroAddress);
        });

        it("should return different tokens for different chains", async () => {
            const token1Address = await tokenManagerHub.getSFuelToken(sourceChainName);
            const token2Address = await tokenManagerHub.getSFuelToken(sourceChainName2);

            expect(token1Address).to.equal(await sFuelToken1.getAddress());
            expect(token2Address).to.equal(await sFuelToken2.getAddress());
            expect(token1Address).to.not.equal(token2Address);
        });
    });

    describe("Token Manager Integration", () => {
        it("should add and remove token managers correctly", async () => {
            const newChainName = "NewChain";
            const newTokenManager = user1.address;

            await tokenManagerHub.addTokenManager(newChainName, newTokenManager);
            expect(await tokenManagerHub.hasTokenManager(newChainName)).to.equal(true);

            await tokenManagerHub.removeTokenManager(newChainName);
            expect(await tokenManagerHub.hasTokenManager(newChainName)).to.equal(false);
        });

        it("should check sender correctly for different chains", async () => {
            expect(await tokenManagerHub.hasTokenManager(sourceChainName)).to.equal(true);
        });
    });

    describe("Edge Cases", () => {
        it("should handle very large amounts", async () => {
            const veryLargeAmount = ethers.parseEther("1000000");
            await sFuelToken1.mint(user1.address, veryLargeAmount);

            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await sFuelToken1.getAddress(),
                    user2.address,
                    veryLargeAmount
                )
            ).to.emit(tokenManagerHub, "SFuelSentBack");
        });

        it("should handle minimum amounts (1 wei)", async () => {
            const minAmount = 1n;
            await sFuelToken1.mint(user1.address, minAmount);

            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await sFuelToken1.getAddress(),
                    user2.address,
                    minAmount
                )
            ).to.emit(tokenManagerHub, "SFuelSentBack");
        });

        it("should handle multiple users sending from same token", async () => {
            await sFuelToken1.connect(tokenHolder).transfer(user1.address, transferAmount);
            await sFuelToken1.connect(tokenHolder).transfer(user2.address, transferAmount);

            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await sFuelToken1.getAddress(),
                    user1.address,
                    transferAmount
                )
            ).to.emit(tokenManagerHub, "SFuelSentBack");

            await expect(
                tokenManagerHub.connect(user2).sendSFuelBackToSource(
                    await sFuelToken1.getAddress(),
                    user2.address,
                    transferAmount
                )
            ).to.emit(tokenManagerHub, "SFuelSentBack");
        });

        it("should revert when trying to register same chain twice", async () => {
            const newToken = await deployEthErc20(tokenManagerHub as TokenManagerSFuelHub);

            await expect(
                tokenManagerHub.registerSFuelToken(sourceChainName, await newToken.getAddress())
            ).to.be.rejectedWith("Token already registered");
        });
    });

    describe("Access Control", () => {
        it("should maintain proper access control for admin functions", async () => {
            const newToken = await deployEthErc20(tokenManagerHub as TokenManagerSFuelHub);

            await expect(
                tokenManagerHub.connect(user1).registerSFuelToken("NewChain", await newToken.getAddress())
            ).to.be.rejectedWith("Not authorized caller");

            await expect(
                tokenManagerHub.connect(deployer).registerSFuelToken("NewChain", await newToken.getAddress())
            ).to.emit(tokenManagerHub, "SFuelTokenRegistered");
        });

        it("should allow anyone to send tokens back", async () => {
            await sFuelToken1.connect(tokenHolder).transfer(user1.address, transferAmount);

            await expect(
                tokenManagerHub.connect(user1).sendSFuelBackToSource(
                    await sFuelToken1.getAddress(),
                    user2.address,
                    transferAmount
                )
            ).to.emit(tokenManagerHub, "SFuelSentBack");
        });
    });

    describe("State Consistency", () => {
        it("should maintain correct token balances after multiple operations", async () => {
            const initialSupply = await sFuelToken1.totalSupply();
            await sFuelToken1.connect(tokenHolder).transfer(user1.address, transferAmount);

            const halfAmount = transferAmount / 2n;
            await tokenManagerHub.connect(user1).sendSFuelBackToSource(
                await sFuelToken1.getAddress(),
                user2.address,
                halfAmount
            );

            const expectedSupply = initialSupply - halfAmount;
            expect(await sFuelToken1.totalSupply()).to.equal(expectedSupply);
            expect(await sFuelToken1.balanceOf(user1.address)).to.equal(halfAmount);
        });

        it("should maintain correct mapping relationships", async () => {
            const token1Address = await sFuelToken1.getAddress();
            const token2Address = await sFuelToken2.getAddress();

            expect(await tokenManagerHub.sFuelTokenToChainHash(token1Address)).to.equal(sourceChainHash);
            expect(await tokenManagerHub.sFuelTokenToChainHash(token2Address)).to.equal(sourceChainHash2);
            expect(await tokenManagerHub.getSFuelToken(sourceChainName)).to.equal(token1Address);
            expect(await tokenManagerHub.getSFuelToken(sourceChainName2)).to.equal(token2Address);
        });
    });
});
