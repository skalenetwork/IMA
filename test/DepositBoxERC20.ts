// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file DepositBox.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import {
    ContractManager,
    DepositBoxERC20,
    Linker,
    MessageProxyForMainnet,
    MessagesTester,
    ERC20OnChain,
    CommunityPool
} from "../typechain";
import { getPublicKey, stringToHex } from "./utils/helper";

import chai from "chai";

chai.should();
chai.use(chaiAsPromised);

import { deployDepositBoxERC20 } from "./utils/deploy/mainnet/depositBoxERC20";
import { deployLinker } from "./utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { initializeSchain, addNodesToSchain } from "./utils/skale-manager-utils/schainsInternal";
import { rechargeSchainWallet } from "./utils/skale-manager-utils/wallets";
import { setCommonPublicKey } from "./utils/skale-manager-utils/keyStorage";
import { deployMessages } from "./utils/deploy/messages";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployCommunityPool } from "./utils/deploy/mainnet/communityPool";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BigNumberish, HDNodeWallet, Wallet } from "ethers";

import { expect } from "chai";
import { createNode } from "./utils/skale-manager-utils/nodes";
import { currentTime, skipTime } from "./utils/time";

const BlsSignature: [BigNumberish, BigNumberish] = [
    "178325537405109593276798394634841698946852714038246117383766698579865918287",
    "493565443574555904019191451171395204672818649274520396086461475162723833781"
];
const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
const Counter = 0;

describe("DepositBoxERC20", () => {
    let deployer: SignerWithAddress;
    let schainOwner: SignerWithAddress;
    let user: SignerWithAddress;
    let user2: SignerWithAddress;
    let richGuy: SignerWithAddress;
    let nodeAddress: HDNodeWallet;

    let depositBoxERC20: DepositBoxERC20;
    let contractManager: ContractManager;
    let messageProxy: MessageProxyForMainnet;
    let linker: Linker;
    let communityPool: CommunityPool;
    let messages: MessagesTester;
    const contractManagerAddress = "0x0000000000000000000000000000000000000000";
    const schainName = "Schain";
    const schainHash = ethers.id(schainName);

    before(async () => {
        [deployer, schainOwner, user, user2, richGuy] = await ethers.getSigners();
        nodeAddress = Wallet.createRandom().connect(ethers.provider);
        const balanceRichGuy = await ethers.provider.getBalance(richGuy.address);
        await richGuy.sendTransaction({to: nodeAddress.address, value: balanceRichGuy - ethers.parseEther("1")});
    });

    after(async () => {
        const balanceNode = await ethers.provider.getBalance(nodeAddress.address);
        await nodeAddress.sendTransaction({to: richGuy.address, value: balanceNode - ethers.parseEther("1")});
    });

    beforeEach(async () => {
        contractManager = await deployContractManager(contractManagerAddress);
        messageProxy = await deployMessageProxyForMainnet(contractManager);
        linker = await deployLinker(contractManager, messageProxy);
        depositBoxERC20 = await deployDepositBoxERC20(contractManager, linker, messageProxy);
        communityPool = await deployCommunityPool(contractManager, linker, messageProxy);
        await messageProxy.grantRole(await messageProxy.CHAIN_CONNECTOR_ROLE(), linker);
        await messageProxy.grantRole(await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE(), deployer.address);
        await initializeSchain(contractManager, schainName, schainOwner.address, 1, 1);
        const nodeCreationParams = {
            port: 1337,
            nonce: 1337,
            ip: "0x12345678",
            publicIp: "0x12345678",
            publicKey: getPublicKey(nodeAddress),
            name: "GasCalculationNode",
            domainName: "gascalculationnode.com"
        };
        await createNode(contractManager, nodeAddress.address, nodeCreationParams);
        await addNodesToSchain(contractManager, schainName, [0]);
        await rechargeSchainWallet(contractManager, schainName, user2.address, "1000000000000000000");
        await messageProxy.registerExtraContractForAll(depositBoxERC20);
        await messageProxy.registerExtraContract(schainName, communityPool);
        await messageProxy.registerExtraContract(schainName, linker);
        messages = await deployMessages();
    });

    describe("tests with `ERC20`", async () => {
        let erc20: ERC20OnChain;

        beforeEach(async () => {
            erc20 = await deployERC20OnChain("D2-token", "D2");
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
        });

        describe("tests for `depositERC20` function", async () => {

            it("should rejected with `Whitelist is enabled`", async () => {
                // preparation
                const error = "Whitelist is enabled";
                await depositBoxERC20.connect(schainOwner).enableWhitelist(schainName);
                await erc20.connect(deployer).mint(user.address, "1000000000");
                await erc20.connect(deployer).approve(depositBoxERC20, "1000000");
                // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
                // execution/expectation
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20, 100)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should rejected with `DepositBox was not approved for ERC20 token`", async () => {
                // preparation
                const error = "DepositBox was not approved for ERC20 token";
                await depositBoxERC20.connect(schainOwner).disableWhitelist(schainName);
                // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
                // execution/expectation
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20, 100)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should invoke `depositERC20` without mistakes", async () => {
                // preparation
                // mint some quantity of ERC20 tokens for `deployer` address
                const amount = 10;
                await erc20.connect(deployer).mint(deployer.address, amount);
                await erc20.connect(deployer).approve(depositBoxERC20, amount);
                // execution
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20, 1).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC20.connect(schainOwner).disableWhitelist(schainName);
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20, 1);
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20, 1);
            });

            it("should invoke `depositERC20Direct` without mistakes", async () => {
                // preparation
                // mint some quantity of ERC20 tokens for `deployer` address
                const amount = 10;
                await erc20.connect(deployer).mint(deployer.address, amount);
                await erc20.connect(deployer).approve(depositBoxERC20, amount);
                // execution
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20Direct(schainName, erc20, 1, user.address).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC20.connect(schainOwner).disableWhitelist(schainName);
                const data1 = await messages.encodeTransferErc20AndTokenInfoMessage(erc20, user.address, 1, amount, { name: "D2-token", symbol: "D2", decimals: 18 });
                const data2 = await messages.encodeTransferErc20AndTotalSupplyMessage(erc20, user.address, 1, amount);
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20Direct(schainName, erc20, 1, user.address)
                    .should.emit(messageProxy, "OutgoingMessage")
                    .withArgs(schainHash, 0, depositBoxERC20, deployer.address, data1);

                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20Direct(schainName, erc20, 1, user.address)
                    .should.emit(messageProxy, "OutgoingMessage")
                    .withArgs(schainHash, 1, depositBoxERC20, deployer.address, data2);
            });

            it("should rejected with `Amount is incorrect`", async () => {
                // preparation
                // mint some quantity of ERC20 tokens for `deployer` address
                const amount = 10;
                await erc20.connect(deployer).mint(deployer.address, amount);
                await erc20.connect(deployer).approve(depositBoxERC20, amount + 1);

                await depositBoxERC20.connect(schainOwner).disableWhitelist(schainName);
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20, amount + 1)
                    .should.be.eventually.rejectedWith("Amount is incorrect");
            });
        });

        it("should get funds after kill", async () => {
            await erc20.connect(deployer).mint(deployer.address, "1000000000");
            await erc20.connect(deployer).approve(depositBoxERC20, "1000000");
            await depositBoxERC20.connect(schainOwner).disableWhitelist(schainName);
            await depositBoxERC20
                .connect(deployer)
                .depositERC20(schainName, erc20, 1);
            await depositBoxERC20.connect(schainOwner).getFunds(schainName, erc20, schainOwner.address, 1).should.be.eventually.rejectedWith("Schain is not killed");
            await linker.connect(deployer).kill(schainName);
            await linker.connect(schainOwner).kill(schainName);
            await depositBoxERC20.connect(schainOwner).getFunds(schainName, erc20, schainOwner.address, 2).should.be.eventually.rejectedWith("Incorrect amount");
            await depositBoxERC20.connect(schainOwner).getFunds(schainName, erc20, schainOwner.address, 1);
            expect(await erc20.balanceOf(schainOwner.address)).to.equal("1");
        });

        it("should add erc token by schain owner", async () => {
            const fakeERC20Contract = deployer.address;
            await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, fakeERC20Contract)
                .should.be.eventually.rejectedWith("Given address is not a contract");
            await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, erc20);
            await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, erc20).should.be.eventually.rejectedWith("ERC20 Token was already added");
            expect(await depositBoxERC20.getSchainToERC20(schainName, erc20)).to.be.equal(true);
            expect((await depositBoxERC20.getSchainToAllERC20(schainName, 0, 1))[0]).to.be.equal(erc20);
            expect((await depositBoxERC20.getSchainToAllERC20(schainName, 0, 1)).length).to.be.equal(1);
            expect((await depositBoxERC20.getSchainToAllERC20Length(schainName)).toString()).to.be.equal("1");
            await depositBoxERC20.getSchainToAllERC20(schainName, 1, 0).should.be.eventually.rejectedWith("Range is incorrect");
            await depositBoxERC20.getSchainToAllERC20(schainName, 0, 11).should.be.eventually.rejectedWith("Range is incorrect");
        });

        it("should not allow to add token by schain owner if schain killed", async () => {
            await linker.connect(deployer).kill(schainName);
            await linker.connect(schainOwner).kill(schainName);
            await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, erc20)
                .should.be.eventually.rejectedWith("Schain is killed");
        });

        it("should invoke `depositERC20` for non standard ERC20", async () => {
            // preparation
            // mint some quantity of ERC20 tokens for `deployer` address
            const erc20TWR = await (await ethers.getContractFactory("ERC20TransferWithoutReturn")).deploy("Test", "TST");
            const erc20TWFR = await (await ethers.getContractFactory("ERC20TransferWithFalseReturn")).deploy("Test", "TST");
            const erc20IT = await (await ethers.getContractFactory("ERC20IncorrectTransfer")).deploy("Test", "TST");
            const amount = 10;
            await erc20TWR.connect(deployer).mint(deployer.address, amount);
            await erc20TWFR.connect(deployer).mint(deployer.address, amount);
            await erc20IT.connect(deployer).mint(deployer.address, amount);
            await erc20.connect(deployer).mint(deployer.address, amount);
            await erc20TWR.connect(deployer).approve(depositBoxERC20, amount);
            await erc20TWFR.connect(deployer).approve(depositBoxERC20, amount);
            await erc20IT.connect(deployer).approve(depositBoxERC20, amount);
            await erc20.connect(deployer).approve(depositBoxERC20, amount);
            // execution
            await depositBoxERC20.connect(schainOwner).disableWhitelist(schainName);
            await depositBoxERC20
                .connect(deployer)
                .depositERC20(schainName, erc20, 1);
            await depositBoxERC20
                .connect(deployer)
                .depositERC20(schainName, erc20TWR, 1);
            await depositBoxERC20
                .connect(deployer)
                .depositERC20(schainName, erc20IT, 1)
                .should.be.eventually.rejectedWith("SafeERC20: low-level call failed");
            await depositBoxERC20
                .connect(deployer)
                .depositERC20(schainName, erc20TWFR, 1)
                .should.be.eventually.rejectedWith("SafeERC20: ERC20 operation did not succeed");
        });
    });

    describe("tests for `postMessage` function", async () => {
        let erc20: ERC20OnChain;
        let erc20Clone: ERC20OnChain;

        beforeEach(async () => {
            erc20 = await deployERC20OnChain("D2-token", "D2",);
            erc20Clone = await deployERC20OnChain("Token", "T",);
        });

        it("should transfer ERC20 token", async () => {
            //  preparation
            const ercOnSchain = erc20;
            const fakeErc20OnSchain = erc20Clone;
            const amount = 10;
            const to = user.address;
            const senderFromSchain = deployer.address;
            const wei = 1e18.toString();

            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            const message = {
                data: await messages.encodeTransferErc20Message(ercOnSchain, to, amount),
                destinationContract: depositBoxERC20,
                sender: senderFromSchain
            };
            const messageWithWrongTokenAddress = {
                data: await messages.encodeTransferErc20Message(user2.address, to, amount),
                destinationContract: depositBoxERC20,
                sender: senderFromSchain
            };

            const messageWithNotMintedToken = {
                data: await messages.encodeTransferErc20Message(fakeErc20OnSchain, to, amount),
                destinationContract: depositBoxERC20,
                sender: senderFromSchain
            };

            await initializeSchain(contractManager, schainName, schainOwner.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20, amount)
                .should.be.eventually.rejectedWith("Unconnected chain");

            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);

            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, user.address, { value: wei });

            await depositBoxERC20.connect(schainOwner).disableWhitelist(schainName);
            await erc20.connect(deployer).mint(user.address, amount * 2);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20, amount)
                .should.be.eventually.rejectedWith("DepositBox was not approved for ERC20 token");
            await erc20.connect(user).approve(depositBoxERC20, amount * 2);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20, amount);

            const tx = await messageProxy
                .connect(nodeAddress)
                .postIncomingMessages(
                    schainName, 0,
                    [
                        messageWithWrongTokenAddress,
                        messageWithNotMintedToken
                    ],
                    sign
                );

            await expect(tx)
                .to.emit(messageProxy, "PostMessageError")
                .withArgs(0n, stringToHex("Given address is not a contract"));

            await expect(tx)
                .to.emit(messageProxy, "PostMessageError")
                .withArgs(1n, stringToHex("Not enough money"));


            const balanceBefore = await ethers.provider.getBalance(deployer.address);
            await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 2, [message], sign);
            const balance = await ethers.provider.getBalance(deployer.address);
            balance.should.be.least(balanceBefore);
            balance.should.be.closeTo(balanceBefore, 10);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20, amount);
            await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 3, [message], sign);
            const transferredAmount = await depositBoxERC20.transferredAmount(schainHash, erc20);
            expect(transferredAmount).to.be.equal(0n);

            (await erc20.balanceOf(user.address)).toString().should.be.equal((amount * 2).toString());

        });

        it("should transfer non standard ERC20 token", async () => {
            //  preparation
            const erc20TWR = await (await ethers.getContractFactory("ERC20TransferWithoutReturn")).deploy("Test", "TST");
            const amount = 10;
            const to = user.address;
            const senderFromSchain = deployer.address;
            const wei = 1e18.toString();

            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            const message = {
                data: await messages.encodeTransferErc20Message(erc20, to, amount),
                destinationContract: depositBoxERC20,
                sender: senderFromSchain
            };
            const messageTWR = {
                data: await messages.encodeTransferErc20Message(erc20TWR, to, amount),
                destinationContract: depositBoxERC20,
                sender: senderFromSchain
            };

            await initializeSchain(contractManager, schainName, schainOwner.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20, amount)
                .should.be.eventually.rejectedWith("Unconnected chain");

            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);

            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, user.address, { value: wei });

            await depositBoxERC20.connect(schainOwner).disableWhitelist(schainName);
            await erc20.connect(deployer).mint(user.address, amount * 2);
            await erc20TWR.connect(deployer).mint(user.address, amount * 2);

            await erc20.connect(user).approve(depositBoxERC20, amount * 2);
            await erc20TWR.connect(user).approve(depositBoxERC20, amount * 2);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20, amount);
            await depositBoxERC20.connect(user).depositERC20(schainName, erc20TWR, amount);

            const balanceBefore = await ethers.provider.getBalance(deployer.address);
            await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [message, messageTWR], sign);
            const balance = await ethers.provider.getBalance(deployer.address);
            balance.should.be.least(balanceBefore);
            balance.should.be.closeTo(balanceBefore, 10);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20, amount);
            await depositBoxERC20.connect(user).depositERC20(schainName, erc20TWR, amount);
            await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 2, [message, messageTWR], sign);
            const transferredAmount = await depositBoxERC20.transferredAmount(schainHash, erc20);
            expect(transferredAmount).to.be.equal(0);
            const transferredAmountTWR = await depositBoxERC20.transferredAmount(schainHash, erc20TWR);
            expect(transferredAmountTWR).to.be.equal(0);

            (await erc20.balanceOf(user.address)).toString().should.be.equal((amount * 2).toString());
            (await erc20TWR.balanceOf(user.address)).toString().should.be.equal((amount * 2).toString());

        });

        describe("When user deposited tokens", async () => {
            let token: ERC20OnChain;
            let token2: ERC20OnChain;
            const amount = 5;
            const bigAmount = 10;
            const timeDelay = 24 * 60 * 60;
            const arbitrageDuration = 30 * 24 * 60 * 60;
            const ethDeposit = ethers.parseEther("1");
            const randomSignature = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            beforeEach(async () => {
                token = erc20;
                token2 = erc20Clone;

                await initializeSchain(contractManager, schainName, schainOwner.address, 1, 1);
                await setCommonPublicKey(contractManager, schainName);

                await linker.connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);

                await communityPool
                    .connect(user)
                    .rechargeUserWallet(schainName, user.address, { value: ethDeposit });

                await depositBoxERC20.connect(schainOwner).disableWhitelist(schainName);

                const depositedAmount = bigAmount * 100;
                await token.mint(user.address, depositedAmount);
                await token2.mint(user.address, depositedAmount);

                await token.connect(user).approve(depositBoxERC20, depositedAmount);
                await depositBoxERC20.connect(user).depositERC20(schainName, token, depositedAmount);

                await token2.connect(user).approve(depositBoxERC20, depositedAmount);
                await depositBoxERC20.connect(user).depositERC20(schainName, token2, depositedAmount);

                await expect(
                    depositBoxERC20.connect(schainOwner).setBigTransferValue(schainName, token, bigAmount)
                ).to.emit(depositBoxERC20, "BigTransferThresholdIsChanged")
                    .withArgs(schainHash, token, 0, bigAmount);
                await depositBoxERC20.connect(schainOwner).setBigTransferValue(schainName, token2, bigAmount);
                await expect(
                    depositBoxERC20.connect(schainOwner).setBigTransferDelay(schainName, timeDelay)
                ).to.emit(depositBoxERC20, "BigTransferDelayIsChanged")
                    .withArgs(schainHash, 0, timeDelay);
                await expect(
                    depositBoxERC20.connect(schainOwner).setArbitrageDuration(schainName, arbitrageDuration)
                ).to.emit(depositBoxERC20, "ArbitrageDurationIsChanged")
                    .withArgs(schainHash, 0, arbitrageDuration);

                await depositBoxERC20.grantRole(await depositBoxERC20.ARBITER_ROLE(), deployer.address);
            });

            it("should delay a big exit transfer", async () => {
                const balanceBefore = await token.balanceOf(user.address);

                const message = {
                    data: await messages.encodeTransferErc20Message(token, user.address, bigAmount),
                    destinationContract: depositBoxERC20,
                    sender: deployer.address
                };

                await expect(
                    messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [message], randomSignature)
                ).to.emit(depositBoxERC20, "TransferDelayed")
                    .withArgs(0, user.address, token, bigAmount);

                (await token.balanceOf(user.address)).should.be.equal(balanceBefore);

                await depositBoxERC20.connect(user).retrieve()
                    .should.be.rejectedWith("There are no transfers available for retrieving");

                (await token.balanceOf(user.address)).should.be.equal(balanceBefore);

                await skipTime(timeDelay);

                await depositBoxERC20.connect(user).retrieve();

                (await token.balanceOf(user.address)).should.be.equal(balanceBefore + BigInt(bigAmount));
            });

            it("should allow to perform arbitrage", async () => {
                const smallTransferOfToken1 = {
                    data: await messages.encodeTransferErc20Message(token, user.address, amount),
                    destinationContract: depositBoxERC20,
                    sender: deployer.address
                };

                const bigTransferOfToken1 = {
                    data: await messages.encodeTransferErc20Message(token, user.address, bigAmount),
                    destinationContract: depositBoxERC20,
                    sender: deployer.address
                };

                const smallTransferOfToken2 = {
                    data: await messages.encodeTransferErc20Message(token2, user.address, amount),
                    destinationContract: depositBoxERC20,
                    sender: deployer.address
                };

                const bigTransferOfToken2 = {
                    data: await messages.encodeTransferErc20Message(token2, user.address, bigAmount),
                    destinationContract: depositBoxERC20,
                    sender: deployer.address
                };

                const token1BalanceBefore = await token.balanceOf(user.address);
                const token2BalanceBefore = await token2.balanceOf(user.address);

                await messageProxy.connect(nodeAddress).postIncomingMessages(
                    schainName,
                    0,
                    [
                        smallTransferOfToken1,
                        smallTransferOfToken2,
                        bigTransferOfToken1,
                        bigTransferOfToken1,
                        bigTransferOfToken2,
                        bigTransferOfToken1,
                        smallTransferOfToken1,
                        smallTransferOfToken2,
                        bigTransferOfToken1,
                    ],
                    randomSignature
                );

                (await depositBoxERC20.getDelayedAmount(user.address, token))
                    .should.be.equal(4 * bigAmount);
                (await depositBoxERC20.getDelayedAmount(user.address, token2))
                    .should.be.equal(bigAmount);
                (await depositBoxERC20.getNextUnlockTimestamp(user.address, token))
                    .should.be.equal((await currentTime()) + timeDelay);
                (await depositBoxERC20.getNextUnlockTimestamp(user.address, token2))
                    .should.be.equal((await currentTime()) + timeDelay);

                // 2 small transfers of token 1 and 2 small transfers of token 2 must be processed without delay
                (await token.balanceOf(user.address)).should.be.equal(token1BalanceBefore + BigInt(2 * amount));
                (await token2.balanceOf(user.address)).should.be.equal(token2BalanceBefore + BigInt(2 * amount));

                // #0 - big transfer of token 1
                // #1 - big transfer of token 1
                // #2 - big transfer of token 2
                // #3 - big transfer of token 1
                // #4 - big transfer of token 1

                const suspicionsTransfers = [0, 1, 4];

                for (const suspicionsTransfer of suspicionsTransfers) {
                    await depositBoxERC20.connect(richGuy).escalate(suspicionsTransfer)
                        .should.be.rejectedWith("Not enough permissions to request escalation");
                    await expect(depositBoxERC20.escalate(suspicionsTransfer))
                        .to.emit(depositBoxERC20, "Escalated")
                        .withArgs(suspicionsTransfer);
                    await depositBoxERC20.escalate(suspicionsTransfer)
                        .should.be.rejectedWith("The transfer has to be delayed");
                }

                await skipTime(timeDelay);

                // transfer #2 and #3 must be unlocked
                await depositBoxERC20.retrieveFor(user.address);
                (await token.balanceOf(user.address))
                    .should.be.equal(token1BalanceBefore + BigInt(2 * amount + bigAmount));
                (await token2.balanceOf(user.address))
                    .should.be.equal(token2BalanceBefore + BigInt(2 * amount + bigAmount));

                await depositBoxERC20.rejectTransfer(suspicionsTransfers[0])
                    .should.be.rejectedWith("Sender is not an Schain owner");

                await depositBoxERC20.connect(schainOwner).rejectTransfer(suspicionsTransfers[0]);
                await depositBoxERC20.connect(schainOwner).rejectTransfer(suspicionsTransfers[0])
                    .should.be.rejectedWith("Arbitrage has to be active");
                (await token.balanceOf(schainOwner.address))
                    .should.be.equal(bigAmount);

                await depositBoxERC20.connect(schainOwner).validateTransfer(suspicionsTransfers[1]);
                await depositBoxERC20.connect(schainOwner).validateTransfer(suspicionsTransfers[1])
                    .should.be.rejectedWith("Arbitrage has to be active");
                (await token.balanceOf(user.address))
                    .should.be.equal(token1BalanceBefore + BigInt(2 * amount + 2 * bigAmount));

                await skipTime(arbitrageDuration);
                await depositBoxERC20.connect(user).retrieve();
                (await token.balanceOf(user.address))
                    .should.be.equal(token1BalanceBefore + BigInt(2 * amount + 3 * bigAmount));
            });

            it("should not stuck after big amount of competed transfers", async () => {
                const bigTransfer = {
                    data: await messages.encodeTransferErc20Message(token, user.address, bigAmount),
                    destinationContract: depositBoxERC20,
                    sender: deployer.address
                };

                const token1BalanceBefore = await token.balanceOf(user.address);
                const amountOfCompetedTransfers = 15;

                // send `amountOfCompetedTransfers` + 1 big transfer
                const batch = Number(await messageProxy.MESSAGES_LENGTH());
                const fullBatches = Math.floor((amountOfCompetedTransfers + 1) / batch);
                const rest = amountOfCompetedTransfers + 1 - fullBatches * batch;
                for (let i = 0; i < fullBatches; ++i) {
                    await messageProxy.connect(nodeAddress).postIncomingMessages(
                        schainName,
                        i * batch,
                        Array(batch).fill(bigTransfer),
                        randomSignature
                    );
                }
                if (rest > 0) {
                    await messageProxy.connect(nodeAddress).postIncomingMessages(
                        schainName,
                        fullBatches * batch,
                        Array(rest).fill(bigTransfer),
                        randomSignature
                    );
                }

                (await token.balanceOf(user.address)).should.be.equal(token1BalanceBefore);

                for (const completedTransfer of [...Array(amountOfCompetedTransfers).keys()]) {
                    await depositBoxERC20.escalate(completedTransfer);
                    await depositBoxERC20.connect(schainOwner).validateTransfer(completedTransfer);
                }

                (await token.balanceOf(user.address)).should.be.equal(token1BalanceBefore + BigInt(bigAmount * amountOfCompetedTransfers));

                await skipTime(timeDelay);

                // first retrieve removes already completed transfers after an arbitrage from the queue
                await depositBoxERC20.retrieveFor(user.address);
                (await token.balanceOf(user.address)).should.be.equal(token1BalanceBefore + BigInt(bigAmount * amountOfCompetedTransfers));

                // second retrieve withdraws the rest
                await depositBoxERC20.retrieveFor(user.address);
                (await token.balanceOf(user.address)).should.be.equal(token1BalanceBefore + BigInt(bigAmount * (amountOfCompetedTransfers + 1)));

            });

            it("should not stuck if a token reverts transfer", async () => {
                const bigTransfer = {
                    data: await messages.encodeTransferErc20Message(token, user.address, bigAmount),
                    destinationContract: depositBoxERC20,
                    sender: deployer.address
                };

                const badToken = await (await ethers.getContractFactory("RevertableERC20")).deploy("Test", "TST");
                await badToken.mint(user.address, bigAmount);
                await badToken.connect(user).approve(depositBoxERC20, bigAmount);
                await depositBoxERC20.connect(user).depositERC20(schainName, badToken, bigAmount);

                const badTokenBigTransfer = {
                    data: await messages.encodeTransferErc20Message(badToken, user.address, bigAmount),
                    destinationContract: depositBoxERC20,
                    sender: deployer.address
                };

                await messageProxy.connect(nodeAddress).postIncomingMessages(
                    schainName,
                    0,
                    [ badTokenBigTransfer, bigTransfer ],
                    randomSignature
                );

                await skipTime(timeDelay);

                await badToken.disable();
                const balanceBefore = await token.balanceOf(user.address);
                await expect(
                    depositBoxERC20.retrieveFor(user.address)
                ).to.emit(depositBoxERC20, "TransferSkipped")
                    .withArgs(0);
                (await token.balanceOf(user.address)).should.be.equal(balanceBefore + BigInt(bigAmount));
            });

            it("should not allow to set too big delays", async () => {
                const tenYears = Math.round(60 * 60 * 24 * 365.25 * 10)

                await depositBoxERC20.setBigTransferDelay(schainName, tenYears)
                    .should.be.rejectedWith("Sender is not an Schain owner");

                await depositBoxERC20.connect(schainOwner).setBigTransferDelay(schainName, tenYears)
                    .should.be.rejectedWith("Delay is too big");

                await depositBoxERC20.connect(schainOwner).setArbitrageDuration(schainName, tenYears)
                    .should.be.rejectedWith("Delay is too big");
            })

            it("should disable delay for trusted receivers", async () => {
                const bigTransfer = {
                    data: await messages.encodeTransferErc20Message(token, user.address, bigAmount),
                    destinationContract: depositBoxERC20,
                    sender: deployer.address
                };

                await depositBoxERC20.trustReceiver(schainName, user.address)
                    .should.be.rejectedWith("Sender is not an Schain owner");
                await depositBoxERC20.connect(schainOwner).trustReceiver(schainName, user.address);
                await depositBoxERC20.connect(schainOwner).trustReceiver(schainName, user.address)
                    .should.be.rejectedWith("Receiver already is trusted");
                (await depositBoxERC20.getTrustedReceiver(schainName, 0))
                    .should.be.equal(user.address);

                await messageProxy.connect(nodeAddress).postIncomingMessages(
                    schainName,
                    0,
                    [ bigTransfer ],
                    randomSignature
                );

                (await token.balanceOf(user.address)).should.be.equal(bigAmount);

                await depositBoxERC20.stopTrustingReceiver(schainName, user.address)
                    .should.be.rejectedWith("Sender is not an Schain owner")
                await depositBoxERC20.connect(schainOwner).stopTrustingReceiver(schainName, user.address);
                await depositBoxERC20.connect(schainOwner).stopTrustingReceiver(schainName, user.address)
                    .should.be.rejectedWith("Receiver is not trusted");

                await messageProxy.connect(nodeAddress).postIncomingMessages(
                    schainName,
                    1,
                    [ bigTransfer ],
                    randomSignature
                );

                (await token.balanceOf(user.address)).should.be.equal(bigAmount);
                (await depositBoxERC20.getDelayedAmount(user.address, token))
                    .should.be.equal(bigAmount);
            })

            it("should reduce delay", async () => {
                const bigTransfer = {
                    data: await messages.encodeTransferErc20Message(token, user.address, bigAmount),
                    destinationContract: depositBoxERC20,
                    sender: deployer.address
                };

                await messageProxy.connect(nodeAddress).postIncomingMessages(
                    schainName,
                    0,
                    [ bigTransfer ],
                    randomSignature
                );

                (await depositBoxERC20.getNextUnlockTimestamp(user.address, token))
                    .should.be.equal(await currentTime() + timeDelay);


                const lowerDelay = Math.round(timeDelay / 2);
                await depositBoxERC20.connect(schainOwner).setBigTransferDelay(schainName, lowerDelay);

                await messageProxy.connect(nodeAddress).postIncomingMessages(
                    schainName,
                    1,
                    [ bigTransfer ],
                    randomSignature
                );

                (await depositBoxERC20.getNextUnlockTimestamp(user.address, token))
                    .should.be.equal(await currentTime() + lowerDelay);
                (await depositBoxERC20.getDelayedAmount(user.address, token))
                    .should.be.equal(2 * bigAmount);
            });

            it("should process correctly in non linear order", async () => {
                const bigTransfer = {
                    data: await messages.encodeTransferErc20Message(token, user.address, bigAmount),
                    destinationContract: depositBoxERC20,
                    sender: deployer.address
                };

                await messageProxy.connect(nodeAddress).postIncomingMessages(
                    schainName,
                    0,
                    [
                        bigTransfer, // #0
                        bigTransfer  // #1
                    ],
                    randomSignature
                );

                let lockedUntil = await currentTime() + timeDelay;

                await depositBoxERC20.escalate(0);

                (await depositBoxERC20.getNextUnlockTimestamp(user.address, token))
                    .should.be.equal(lockedUntil);

                await skipTime(timeDelay);

                await depositBoxERC20.retrieveFor(user.address);

                (await depositBoxERC20.getDelayedAmount(user.address, token))
                    .should.be.equal(bigAmount);

                await messageProxy.connect(nodeAddress).postIncomingMessages(
                    schainName,
                    2,
                    [
                        bigTransfer, // #3
                    ],
                    randomSignature
                );

                lockedUntil = await currentTime() + timeDelay;
                (await depositBoxERC20.getNextUnlockTimestamp(user.address, token))
                    .should.be.equal(lockedUntil);
                (await depositBoxERC20.getDelayedAmount(user.address, token))
                    .should.be.equal(2 * bigAmount);

                await skipTime(timeDelay);
                await depositBoxERC20.retrieveFor(user.address);

                (await depositBoxERC20.getDelayedAmount(user.address, token))
                    .should.be.equal(bigAmount);
                (await token.balanceOf(user.address))
                    .should.be.equal(2 * bigAmount);
            });
        });
    });
});
