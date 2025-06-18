import chaiAsPromised from "chai-as-promised";
import chai, { expect } from "chai";
import {
    TokenManagerSFuelSource,
    TokenManagerSFuelHub,
    TokenManagerLinker,
    MessageProxyForSchainTester,
    MessagesTester,
    EthErc20,
    CommunityLocker
} from "../typechain";

chai.should();
chai.use(chaiAsPromised);

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { deployTokenManagerSFuelSource } from "./utils/deploy/schain/tokenManagerSFuelSource";
import { deployTokenManagerSFuelHub } from "./utils/deploy/schain/tokenManagerSFuelHub";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";
import { deployEthErc20 } from "./utils/deploy/schain/ethErc20";
import { deployMessages } from "./utils/deploy/messages";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

const sourceChainName = "SourceChain";
const hubName = "Hub";
const mainnetName = "Mainnet";
const mainnetHash = ethers.id(mainnetName);
const sourceChainHash = ethers.id(sourceChainName);
const hubHash = ethers.id(hubName);

describe("TokenManagerSFuelSource", () => {
    let deployer: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let user3: SignerWithAddress;

    let tokenManagerSource: TokenManagerSFuelSource;
    let tokenManagerHub: TokenManagerSFuelHub;
    let tokenManagerLinker: TokenManagerLinker;
    let messageProxy: MessageProxyForSchainTester;
    let messages: MessagesTester;
    let sFuelToken: EthErc20;
    let communityLocker: CommunityLocker;

    const transferAmount = ethers.parseEther("5");
    const largeAmount = ethers.parseEther("1000");
    const smallAmount = ethers.parseEther("0.1");

    before(async () => {
        [deployer, user1, user2, user3] = await ethers.getSigners();
    });

    beforeEach(async () => {
        // Deploy infrastructure
        const keyStorage = await deployKeyStorageMock();
        messageProxy = await deployMessageProxyForSchainTester(keyStorage, sourceChainName);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxy, deployer.address);
        communityLocker = await deployCommunityLocker(
            sourceChainName,
            messageProxy,
            tokenManagerLinker,
            deployer.address
        );

        // Deploy TokenManagerSFuelSource
        tokenManagerSource = await deployTokenManagerSFuelSource(
            sourceChainName,
            messageProxy,
            tokenManagerLinker,
            communityLocker
        );

        // Deploy TokenManagerSFuelHub for testing
        tokenManagerHub = await deployTokenManagerSFuelHub(
            hubName,
            messageProxy,
            tokenManagerLinker,
            communityLocker
        );

        // Deploy sFuel token
        sFuelToken = await deployEthErc20(tokenManagerHub as TokenManagerSFuelHub);

        // Setup permissions
        await tokenManagerLinker.registerTokenManager(tokenManagerSource);
        await tokenManagerLinker.registerTokenManager(tokenManagerHub);

        // Connect chains
        await tokenManagerSource.addTokenManager(hubName, await tokenManagerHub.getAddress());
        await tokenManagerHub.addTokenManager(sourceChainName, await tokenManagerSource.getAddress());

        // Register sFuel token on hub
        await tokenManagerHub.registerSFuelToken(sourceChainName, await sFuelToken.getAddress());

        // Setup messages
        messages = await deployMessages();

        // Grant message proxy permissions
        const extraContractRegistrarRole = await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxy.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);

        // Activate community locker for users
        const activateData = await messages.encodeActivateUserMessage(user1.address);
        await messageProxy.postMessage(communityLocker, mainnetHash, deployer.address, activateData);

        const activateData2 = await messages.encodeActivateUserMessage(user2.address);
        await messageProxy.postMessage(communityLocker, mainnetHash, deployer.address, activateData2);

        // set hub chain name
        await tokenManagerSource.connect(deployer).setHubChainName(hubName);

        // Add hub chain to message proxy
        const chainConnectorRole = await messageProxy.CHAIN_CONNECTOR_ROLE();
        await messageProxy.connect(deployer).grantRole(chainConnectorRole, deployer.address);
        await messageProxy.connect(deployer).addConnectedChain(hubName);

        // Register TokenManagerSFuelSource with message proxy
        await messageProxy.connect(deployer).registerExtraContractForAll(await tokenManagerSource.getAddress());
    });

    describe("Initialization", () => {
        it("should initialize with correct parameters", async () => {
            expect(await tokenManagerSource.schainHash()).to.equal(sourceChainHash);
            expect(await tokenManagerSource.messageProxy()).to.equal(await messageProxy.getAddress());
            expect(await tokenManagerSource.tokenManagerLinker()).to.equal(await tokenManagerLinker.getAddress());
            expect(await tokenManagerSource.communityLocker()).to.equal(await communityLocker.getAddress());
            expect(await tokenManagerSource.hubChainHash()).to.equal(hubHash);
        });

        it("should set up correct roles for deployer", async () => {
            const defaultAdminRole = await tokenManagerSource.DEFAULT_ADMIN_ROLE();
            const automaticDeployRole = await tokenManagerSource.AUTOMATIC_DEPLOY_ROLE();
            const tokenRegistrarRole = await tokenManagerSource.TOKEN_REGISTRAR_ROLE();

            expect(await tokenManagerSource.hasRole(defaultAdminRole, deployer.address)).to.equal(true);
            expect(await tokenManagerSource.hasRole(automaticDeployRole, deployer.address)).to.equal(true);
            expect(await tokenManagerSource.hasRole(tokenRegistrarRole, deployer.address)).to.equal(true);
        });

        it("should have zero balance initially", async () => {
            expect(await ethers.provider.getBalance(await tokenManagerSource.getAddress())).to.equal(0);
        });
    });

    describe("setHubChainName", () => {
        let newTokenManager: TokenManagerSFuelSource;

        beforeEach(async () => {
            newTokenManager = await deployTokenManagerSFuelSource(
                "NewChain",
                messageProxy,
                tokenManagerLinker,
                communityLocker
            );
        });

        it("should set hub chain hash correctly", async () => {
            const newHubName = "NewHub";
            const expectedHash = ethers.id(newHubName);

            await newTokenManager.setHubChainName(newHubName);
            expect(await newTokenManager.hubChainHash()).to.equal(expectedHash);
        });

        it("should revert when non-admin tries to set hub chain hash", async () => {
            await expect(
                newTokenManager.connect(user1).setHubChainName("NewHub")
            ).to.be.rejectedWith("Not authorized caller");
        });

        it("should allow admin to change hub chain hash", async () => {
            const firstHub = "FirstHub";
            const secondHub = "SecondHub";

            await newTokenManager.setHubChainName(firstHub);
            expect(await newTokenManager.hubChainHash()).to.equal(ethers.id(firstHub));

            await newTokenManager.setHubChainName(secondHub);
            expect(await newTokenManager.hubChainHash()).to.equal(ethers.id(secondHub));
        });

    });

    describe("sendSFuelToHub", () => {
        it("should send sFuel to hub successfully", async () => {
            const contractBalanceBefore = await ethers.provider.getBalance(await tokenManagerSource.getAddress());
            const userBalanceBefore = await ethers.provider.getBalance(user1.address);

            await expect(
                tokenManagerSource.connect(user1).sendSFuelToHub(user2.address, {
                    value: transferAmount
                })
            ).to.emit(tokenManagerSource, "SFuelSentToHub")
             .withArgs(user1.address, transferAmount);

            const contractBalanceAfter = await ethers.provider.getBalance(await tokenManagerSource.getAddress());
            expect(contractBalanceAfter).to.equal(contractBalanceBefore + transferAmount);

            const userBalanceAfter = await ethers.provider.getBalance(user1.address);
            expect(userBalanceAfter).to.be.lt(userBalanceBefore - transferAmount);
        });

        it("should revert with zero amount", async () => {
            await expect(
                tokenManagerSource.connect(user1).sendSFuelToHub(user2.address, {
                    value: 0
                })
            ).to.be.rejectedWith("Amount must be greater than 0");
        });

        it("should revert with invalid receiver address", async () => {
            await expect(
                tokenManagerSource.connect(user1).sendSFuelToHub(ethers.ZeroAddress, {
                    value: transferAmount
                })
            ).to.be.rejectedWith("Invalid receiver address");
        });

        it("should revert when hub chain not set", async () => {
            const newTokenManager = await deployTokenManagerSFuelSource(
                "NewChain",
                messageProxy,
                tokenManagerLinker,
                communityLocker
            );

            await expect(
                newTokenManager.connect(user1).sendSFuelToHub(user2.address, {
                    value: transferAmount
                })
            ).to.be.rejectedWith("Hub chain not set");
        });

        it("should revert when hub TokenManager not set", async () => {
            const isolatedTokenManager = await deployTokenManagerSFuelSource(
                "IsolatedChain",
                messageProxy,
                tokenManagerLinker,
                communityLocker
            );
            await isolatedTokenManager.connect(deployer).setHubChainName(hubName);


            await expect(
                isolatedTokenManager.connect(user1).sendSFuelToHub(user2.address, {
                    value: transferAmount
                })
            ).to.be.rejectedWith("Hub TokenManager not set");
        });

        it("should handle very large amounts", async () => {
            await deployer.sendTransaction({
                to: user1.address,
                value: largeAmount
            });

            await expect(
                tokenManagerSource.connect(user1).sendSFuelToHub(user2.address, {
                    value: largeAmount
                })
            ).to.emit(tokenManagerSource, "SFuelSentToHub")
             .withArgs(user1.address, largeAmount);
        });

        it("should handle very small amounts (1 wei)", async () => {
            const minAmount = 1n;

            await expect(
                tokenManagerSource.connect(user1).sendSFuelToHub(user2.address, {
                    value: minAmount
                })
            ).to.emit(tokenManagerSource, "SFuelSentToHub")
             .withArgs(user1.address, minAmount);
        });

        it("should accumulate sFuel in contract from multiple sends", async () => {
            await tokenManagerSource.connect(user1).sendSFuelToHub(user2.address, {
                value: transferAmount
            });

            await tokenManagerSource.connect(user2).sendSFuelToHub(user1.address, {
                value: transferAmount
            });

            const contractBalance = await ethers.provider.getBalance(await tokenManagerSource.getAddress());
            expect(contractBalance).to.equal(transferAmount * 2n);
        });

        it("should handle concurrent sends from different users", async () => {
            const promises = [];
            const users = [user1, user2, user3];

            for (let i = 0; i < users.length; i++) {
                promises.push(
                    tokenManagerSource.connect(users[i]).sendSFuelToHub(
                        users[(i + 1) % users.length].address,
                        { value: smallAmount }
                    )
                );
            }

            await Promise.all(promises);

            const contractBalance = await ethers.provider.getBalance(await tokenManagerSource.getAddress());
            expect(contractBalance).to.equal(smallAmount * BigInt(users.length));
        });
    });

    describe("postMessage", () => {
        let transferBackData: string;

        beforeEach(async () => {
            await tokenManagerSource.connect(user1).sendSFuelToHub(user2.address, {
                value: transferAmount
            });

            transferBackData = await messages.encodeTransferSFuelBackMessage(user1.address, transferAmount);
        });

        it("should unlock native sFuel when receiving from hub", async () => {
            const userBalanceBefore = await ethers.provider.getBalance(user1.address);
            const contractBalanceBefore = await ethers.provider.getBalance(await tokenManagerSource.getAddress());

            await expect(
                messageProxy.postMessage(
                    tokenManagerSource,
                    hubHash,
                    await tokenManagerHub.getAddress(),
                    transferBackData
                )
            ).to.emit(tokenManagerSource, "SFuelReceivedFromHub")
             .withArgs(user1.address, transferAmount);

            const userBalanceAfter = await ethers.provider.getBalance(user1.address);
            const contractBalanceAfter = await ethers.provider.getBalance(await tokenManagerSource.getAddress());

            expect(userBalanceAfter).to.equal(userBalanceBefore + transferAmount);
            expect(contractBalanceAfter).to.equal(contractBalanceBefore - transferAmount);
        });

        it("should revert when called by non-message proxy", async () => {
            await expect(
                tokenManagerSource.connect(user1).postMessage(
                    hubHash,
                    await tokenManagerHub.getAddress(),
                    transferBackData
                )
            ).to.be.rejectedWith("Sender is not a MessageProxy");
        });

        it("should revert when sender is not authorized token manager", async () => {
            await expect(
                messageProxy.postMessage(
                    tokenManagerSource,
                    hubHash,
                    user1.address,
                    transferBackData
                )
            ).to.be.rejectedWith("Receiver chain is incorrect");
        });

        it("should revert with incorrect receiver in message", async () => {
            const invalidData = await messages.encodeTransferSFuelBackMessage(ethers.ZeroAddress, transferAmount);

            await expect(
                messageProxy.postMessage(
                    tokenManagerSource,
                    hubHash,
                    await tokenManagerHub.getAddress(),
                    invalidData
                )
            ).to.be.rejectedWith("Incorrect receiver");
        });

        it("should revert when insufficient locked sFuel", async () => {
            const excessiveAmount = transferAmount * 2n;
            const excessiveData = await messages.encodeTransferSFuelBackMessage(user1.address, excessiveAmount);

            await expect(
                messageProxy.postMessage(
                    tokenManagerSource,
                    hubHash,
                    await tokenManagerHub.getAddress(),
                    excessiveData
                )
            ).to.be.rejectedWith("Insufficient locked sFuel");
        });

        it("should handle partial unlocks correctly", async () => {
            const partialAmount = transferAmount / 2n;
            const partialData = await messages.encodeTransferSFuelBackMessage(user1.address, partialAmount);

            const contractBalanceBefore = await ethers.provider.getBalance(await tokenManagerSource.getAddress());

            await messageProxy.postMessage(
                tokenManagerSource,
                hubHash,
                await tokenManagerHub.getAddress(),
                partialData
            );

            const contractBalanceAfter = await ethers.provider.getBalance(await tokenManagerSource.getAddress());
            expect(contractBalanceAfter).to.equal(contractBalanceBefore - partialAmount);
        });

        it("should handle multiple unlocks to different users", async () => {
            await tokenManagerSource.connect(user2).sendSFuelToHub(user1.address, {
                value: transferAmount
            });

            const user1BalanceBefore = await ethers.provider.getBalance(user1.address);
            const user2BalanceBefore = await ethers.provider.getBalance(user2.address);

            const data1 = await messages.encodeTransferSFuelBackMessage(user1.address, transferAmount);
            await messageProxy.postMessage(
                tokenManagerSource,
                hubHash,
                await tokenManagerHub.getAddress(),
                data1
            );

            const data2 = await messages.encodeTransferSFuelBackMessage(user2.address, transferAmount);
            await messageProxy.postMessage(
                tokenManagerSource,
                hubHash,
                await tokenManagerHub.getAddress(),
                data2
            );

            const user1BalanceAfter = await ethers.provider.getBalance(user1.address);
            const user2BalanceAfter = await ethers.provider.getBalance(user2.address);

            expect(user1BalanceAfter).to.equal(user1BalanceBefore + transferAmount);
            expect(user2BalanceAfter).to.equal(user2BalanceBefore + transferAmount);
        });

        it("should handle exact balance unlock", async () => {
            const contractBalance = await ethers.provider.getBalance(await tokenManagerSource.getAddress());
            const exactData = await messages.encodeTransferSFuelBackMessage(user1.address, contractBalance);

            await expect(
                messageProxy.postMessage(
                    tokenManagerSource,
                    hubHash,
                    await tokenManagerHub.getAddress(),
                    exactData
                )
            ).to.emit(tokenManagerSource, "SFuelReceivedFromHub")
             .withArgs(user1.address, contractBalance);

            const contractBalanceAfter = await ethers.provider.getBalance(await tokenManagerSource.getAddress());
            expect(contractBalanceAfter).to.equal(0);
        });
    });

    describe("receive function", () => {
        it("should revert when receiving direct sFuel transfers", async () => {
            await expect(
                user1.sendTransaction({
                    to: await tokenManagerSource.getAddress(),
                    value: transferAmount
                })
            ).to.be.rejectedWith("Use sendSFuelToHub() function instead of direct transfer");
        });

        it("should revert with zero value direct transfer", async () => {
            await expect(
                user1.sendTransaction({
                    to: await tokenManagerSource.getAddress(),
                    value: 0
                })
            ).to.be.rejectedWith("Use sendSFuelToHub() function instead of direct transfer");
        });

        it("should provide helpful error message for direct transfers", async () => {
            const tx = user1.sendTransaction({
                to: await tokenManagerSource.getAddress(),
                value: transferAmount
            });

            await expect(tx).to.be.rejectedWith("Use sendSFuelToHub() function instead of direct transfer");
        });
    });

    describe("Token Manager Integration", () => {
        it("should add and remove token managers correctly", async () => {
            const newChainName = "NewChain";
            const newTokenManager = user1.address;

            await tokenManagerSource.addTokenManager(newChainName, newTokenManager);
            expect(await tokenManagerSource.hasTokenManager(newChainName)).to.equal(true);

            await tokenManagerSource.removeTokenManager(newChainName);
            expect(await tokenManagerSource.hasTokenManager(newChainName)).to.equal(false);
        });

        it("should check sender correctly for hub chain", async () => {
            expect(await tokenManagerSource.hasTokenManager(hubName)).to.equal(true);
        });
    });

    describe("Edge Cases", () => {
        it("should handle gas optimization for small transfers", async () => {
            const verySmallAmount = 1n;

            const tx = await tokenManagerSource.connect(user1).sendSFuelToHub(
                user2.address,
                { value: verySmallAmount }
            );

            const receipt = await tx.wait();
        });

        it("should maintain state consistency across multiple operations", async () => {
            const amounts = [
                ethers.parseEther("1"),
                ethers.parseEther("2.5"),
                ethers.parseEther("0.1")
            ];

            let totalSent = 0n;
            for (const amount of amounts) {
                await tokenManagerSource.connect(user1).sendSFuelToHub(user2.address, {
                    value: amount
                });
                totalSent += amount;
            }

            const contractBalance = await ethers.provider.getBalance(await tokenManagerSource.getAddress());
            expect(contractBalance).to.equal(totalSent);

            const unlockData = await messages.encodeTransferSFuelBackMessage(user1.address, totalSent);
            await messageProxy.postMessage(
                tokenManagerSource,
                hubHash,
                await tokenManagerHub.getAddress(),
                unlockData
            );

            const finalBalance = await ethers.provider.getBalance(await tokenManagerSource.getAddress());
            expect(finalBalance).to.equal(0);
        });

        it("should handle hub chain change correctly", async () => {
            const newHubName = "NewHub";
            const newTokenManagerHub = await deployTokenManagerSFuelHub(
                newHubName,
                messageProxy,
                tokenManagerLinker,
                communityLocker
            );

            await tokenManagerSource.setHubChainName(newHubName);

            await tokenManagerSource.addTokenManager(newHubName, await newTokenManagerHub.getAddress());

            expect(await tokenManagerSource.hubChainHash()).to.equal(ethers.id(newHubName));
        });
    });

    describe("Access Control", () => {
        it("should maintain proper access control for admin functions", async () => {
            await expect(
                tokenManagerSource.connect(user1).setHubChainName("NewHub")
            ).to.be.rejectedWith("Not authorized caller");

            await expect(
                tokenManagerSource.connect(deployer).setHubChainName("NewHub")
            ).to.not.be.rejected;
        });

        it("should allow any user to send sFuel to hub", async () => {
            await expect(
                tokenManagerSource.connect(user1).sendSFuelToHub(user2.address, {
                    value: transferAmount
                })
            ).to.emit(tokenManagerSource, "SFuelSentToHub");

            await expect(
                tokenManagerSource.connect(user2).sendSFuelToHub(user3.address, {
                    value: transferAmount
                })
            ).to.emit(tokenManagerSource, "SFuelSentToHub");
        });
    });

    describe("Community Locker Integration", () => {
        it("should respect community locker restrictions", async () => {
            await expect(
                tokenManagerSource.connect(user1).sendSFuelToHub(user2.address, {
                    value: transferAmount
                })
            ).to.emit(tokenManagerSource, "SFuelSentToHub");
        });
    });

    describe("Message Encoding/Decoding", () => {
        it("should handle message encoding correctly in sendSFuelToHub", async () => {
            await expect(
                tokenManagerSource.connect(user1).sendSFuelToHub(user2.address, {
                    value: transferAmount
                })
            ).to.emit(tokenManagerSource, "SFuelSentToHub");
        });

        it("should handle message decoding correctly in postMessage", async () => {
            await tokenManagerSource.connect(user1).sendSFuelToHub(user2.address, {
                value: transferAmount
            });

            const unlockData = await messages.encodeTransferSFuelBackMessage(user1.address, transferAmount);
            await expect(
                messageProxy.postMessage(
                    tokenManagerSource,
                    hubHash,
                    await tokenManagerHub.getAddress(),
                    unlockData
                )
            ).to.emit(tokenManagerSource, "SFuelReceivedFromHub");
        });
    });
});
