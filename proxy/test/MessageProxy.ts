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
 * @file MessageProxy.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    DepositBoxEth,
    ContractManager,
    Linker,
    MessageProxyForMainnet,
    MessageProxyForMainnetTester,
    MessageProxyForSchain,
    MessageProxyForSchainWithoutSignature,
    MessagesTester,
    ReceiverGasLimitMainnetMock,
    ReceiverGasLimitSchainMock,
    KeyStorageMock,
    CommunityPool
} from "../typechain/";

import { randomString, stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised));

import ABIReceiverMock = require("../artifacts/contracts/test/ReceiverMock.sol/ReceiverMock.json");

import { deployLinker } from "./utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployDepositBoxEth } from "./utils/deploy/mainnet/depositBoxEth";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { initializeSchain } from "./utils/skale-manager-utils/schainsInternal";
import { setCommonPublicKey } from "./utils/skale-manager-utils/keyStorage";

import { deployMessageProxyForMainnetTester } from "./utils/deploy/test/messageProxyForMainnetTester";
import { deployMessages } from "./utils/deploy/messages";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";
import { MessageProxyForSchainTester } from "../typechain/MessageProxyForSchainTester";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployCommunityPool } from "./utils/deploy/mainnet/communityPool";

describe("MessageProxy", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let client: SignerWithAddress;
    let customer: SignerWithAddress;

    let keyStorage: KeyStorageMock;
    let messageProxyForSchain: MessageProxyForSchainTester;

    let depositBox: DepositBoxEth;
    let contractManager: ContractManager;
    let messageProxyForMainnet: MessageProxyForMainnet;
    let caller: MessageProxyForMainnetTester;
    let imaLinker: Linker;
    let messages: MessagesTester;
    let communityPool: CommunityPool;

    const contractManagerAddress = "0x0000000000000000000000000000000000000000";
    const schainName = "Schain";

    const publicKeyArray = [
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
    ];

    const BlsSignature: [BigNumber, BigNumber] = [
        BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
        BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
    ];
    const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
    const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
    const Counter = 0;

    before(async () => {
        [deployer, user, client, customer] = await ethers.getSigners();
    });

    describe("MessageProxy for mainnet", async () => {
        let gasPrice: any;
        beforeEach(async () => {
            contractManager = await deployContractManager(contractManagerAddress);
            // contractManagerAddress = contractManager.address;
            messageProxyForMainnet = await deployMessageProxyForMainnet(contractManager);
            caller = await deployMessageProxyForMainnetTester();
            imaLinker = await deployLinker(contractManager, messageProxyForMainnet);
            depositBox = await deployDepositBoxEth(contractManager, imaLinker, messageProxyForMainnet);
            messages = await deployMessages();
            communityPool = await deployCommunityPool(contractManager, imaLinker, messageProxyForMainnet);
            await messageProxyForMainnet.grantRole(await messageProxyForMainnet.EXTRA_CONTRACT_REGISTRAR_ROLE(), deployer.address);
            await messageProxyForMainnet.grantRole(await messageProxyForMainnet.CHAIN_CONNECTOR_ROLE(), deployer.address);
            gasPrice = (await messageProxyForMainnet.registerExtraContract(schainName, caller.address)).gasPrice;
        });

        it("should set constants", async () => {
            const headerMessageGasCostPrevious = (await messageProxyForMainnet.headerMessageGasCost()).toNumber();
            const messageGasCostPrevious = (await messageProxyForMainnet.messageGasCost()).toNumber();
            const gasLimitPrevious = (await messageProxyForMainnet.gasLimit()).toNumber();

            const headerMessageGasCostNew = 5;
            const messageGasCostNew = 6;
            const gasLimitNew = 7;

            expect((await messageProxyForMainnet.headerMessageGasCost()).toNumber()).to.equal(headerMessageGasCostPrevious);
            expect((await messageProxyForMainnet.messageGasCost()).toNumber()).to.equal(messageGasCostPrevious);
            expect((await messageProxyForMainnet.gasLimit()).toNumber()).to.equal(gasLimitPrevious);

            await messageProxyForMainnet.connect(user).setNewHeaderMessageGasCost(
                headerMessageGasCostNew
            ).should.be.eventually.rejectedWith("Not enough permissions to set constant");
            await messageProxyForMainnet.connect(user).setNewMessageGasCost(
                messageGasCostNew
            ).should.be.eventually.rejectedWith("Not enough permissions to set constant");
            await messageProxyForMainnet.connect(user).setNewGasLimit(
                gasLimitNew
            ).should.be.eventually.rejectedWith("Not enough permissions to set constant");

            const constantSetterRole = await messageProxyForMainnet.CONSTANT_SETTER_ROLE();
            await messageProxyForMainnet.connect(deployer).grantRole(constantSetterRole, user.address);

            await messageProxyForMainnet.connect(user).setNewHeaderMessageGasCost(headerMessageGasCostNew);
            await messageProxyForMainnet.connect(user).setNewMessageGasCost(messageGasCostNew);
            await messageProxyForMainnet.connect(user).setNewGasLimit(gasLimitNew);

            expect((await messageProxyForMainnet.headerMessageGasCost()).toNumber()).to.equal(headerMessageGasCostNew);
            expect((await messageProxyForMainnet.messageGasCost()).toNumber()).to.equal(messageGasCostNew);
            expect((await messageProxyForMainnet.gasLimit()).toNumber()).to.equal(gasLimitNew);

            await messageProxyForMainnet.connect(user).setNewHeaderMessageGasCost(headerMessageGasCostPrevious);
            await messageProxyForMainnet.connect(user).setNewMessageGasCost(messageGasCostPrevious);
            await messageProxyForMainnet.connect(user).setNewGasLimit(gasLimitPrevious);

            expect((await messageProxyForMainnet.headerMessageGasCost()).toNumber()).to.equal(headerMessageGasCostPrevious);
            expect((await messageProxyForMainnet.messageGasCost()).toNumber()).to.equal(messageGasCostPrevious);
            expect((await messageProxyForMainnet.gasLimit()).toNumber()).to.equal(gasLimitPrevious);

        });

        it("should detect registration state by `isConnectedChain` function", async () => {
            const newSchainName = randomString(10);
            const isConnectedChain = await messageProxyForMainnet.isConnectedChain(newSchainName);
            isConnectedChain.should.be.deep.equal(Boolean(false));
            await messageProxyForMainnet.connect(deployer).addConnectedChain(newSchainName);
            const connectedChain = await messageProxyForMainnet.isConnectedChain(newSchainName);
            connectedChain.should.be.deep.equal(Boolean(true));
            // // main net does not have a public key and is implicitly connected:
            // await messageProxyForMainnet.isConnectedChain("Mainnet").should.be.rejected;
        });

        it("should add connected chain", async () => {
            await messageProxyForMainnet.connect(deployer).addConnectedChain(schainName);
            const isConnectedChain = await messageProxyForMainnet.isConnectedChain(schainName);
            isConnectedChain.should.be.deep.equal(Boolean(true));

            // chain can't be connected twice:
            await messageProxyForMainnet.connect(deployer).addConnectedChain(schainName)
                .should.be.rejectedWith("Chain is already connected");

            // // main net does not have a public key and is implicitly connected:
            // await messageProxyForMainnet.connect(deployer).addConnectedChain("Mainnet")
            // .should.be.rejectedWith("SKALE chain name is incorrect. Inside in MessageProxy");
        });

        it("should remove connected chain", async () => {
            await messageProxyForMainnet.connect(deployer).addConnectedChain(schainName);
            const connectedChain = await messageProxyForMainnet.isConnectedChain(schainName);
            connectedChain.should.be.deep.equal(Boolean(true));

            // only owner can remove chain:
            // TODO uncomment after fix permission logic
            // await messageProxyForMainnet.removeConnectedChain(schainName, {from: user}).should.be.rejected;

            // main net can't be removed:
            await messageProxyForMainnet.connect(deployer).removeConnectedChain("Mainnet").should.be.rejected;

            await messageProxyForMainnet.connect(deployer).removeConnectedChain(schainName);
            const notConnectedChain = await messageProxyForMainnet.isConnectedChain(schainName);
            notConnectedChain.should.be.deep.equal(Boolean(false));
        });

        it("should post outgoing message", async () => {
            const contractAddress = messageProxyForMainnet.address;
            const amount = 4;
            const bytesData = await messages.encodeTransferEthMessage(user.address, amount);

            await caller
                .postOutgoingMessageTester(messageProxyForMainnet.address, stringValue(web3.utils.soliditySha3(schainName)), contractAddress, bytesData)
                .should.be.rejectedWith("Destination chain is not initialized");

            await messageProxyForMainnet.connect(deployer).addConnectedChain(schainName);
            await caller
                .postOutgoingMessageTester(messageProxyForMainnet.address, stringValue(web3.utils.soliditySha3(schainName)), contractAddress, bytesData);
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getOutgoingMessagesCounter(schainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should post incoming messages", async () => {
            const startingCounter = 0;
            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            await messageProxyForMainnet.registerExtraContract(schainName, communityPool.address);
            await depositBox.addSchainContract(schainName, deployer.address);
            const minTransactionGas = await communityPool.minTransactionGas();
            const amountWei = minTransactionGas.mul(gasPrice);

            const message1 = {
                destinationContract: depositBox.address,
                sender: deployer.address,
                data: await messages.encodeTransferEthMessage(client.address, 0),
            };

            const message2 = {
                destinationContract: depositBox.address,
                sender: deployer.address,
                data: await messages.encodeTransferEthMessage(customer.address, 7),
            };

            const outgoingMessages = [message1, message2];
            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            // chain should be inited:
            await messageProxyForMainnet
                .connect(deployer)
                .postIncomingMessages(
                    schainName,
                    startingCounter,
                    outgoingMessages,
                    sign
                ).should.be.eventually.rejectedWith("Chain is not initialized");

            await messageProxyForMainnet.connect(deployer).addConnectedChain(schainName);

            await messageProxyForMainnet
                .connect(deployer)
                .postIncomingMessages(
                    schainName,
                    startingCounter,
                    outgoingMessages,
                    sign
                ).should.be.eventually.rejectedWith("User should be active");

            await messageProxyForMainnet
                .connect(deployer)
                .postIncomingMessages(
                    schainName,
                    startingCounter,
                    [message1, message1, message1, message1, message1, message1, message1, message1, message1, message1, message1],
                    sign
                    ).should.be.eventually.rejectedWith("Too many messages");

            await communityPool.connect(client).rechargeUserWallet(schainName, {value: amountWei.toString()});

            await messageProxyForMainnet
                .connect(deployer)
                .postIncomingMessages(
                    schainName,
                    startingCounter,
                    outgoingMessages,
                    sign
                );
            const incomingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getIncomingMessagesCounter(schainName));
            incomingMessagesCounter.should.be.deep.equal(BigNumber.from(2));
        });

        it("should get outgoing messages counter", async () => {
            const contractAddress = depositBox.address;
            const amount = 5;
            const addressTo = client.address;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);

            // chain should be inited:
            await messageProxyForMainnet.getOutgoingMessagesCounter(schainName).should.be.rejected;

            await messageProxyForMainnet.connect(deployer).addConnectedChain(schainName);

            const outgoingMessagesCounter0 = BigNumber.from(
                await messageProxyForMainnet.getOutgoingMessagesCounter(schainName));
            outgoingMessagesCounter0.should.be.deep.equal(BigNumber.from(0));

            await caller
                .postOutgoingMessageTester(messageProxyForMainnet.address, stringValue(web3.utils.soliditySha3(schainName)), contractAddress, bytesData);

            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getOutgoingMessagesCounter(schainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should get incoming messages counter", async () => {
            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            const startingCounter = 0;
            const message1 = {
                amount: 3,
                data: "0x11",
                destinationContract: depositBox.address,
                sender: deployer.address,
                to: client.address
            };
            const message2 = {
                amount: 7,
                data: "0x22",
                destinationContract: depositBox.address,
                sender: user.address,
                to: customer.address
            };
            const outgoingMessages = [message1, message2];
            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            // chain should be inited:
            await messageProxyForMainnet.getIncomingMessagesCounter(schainName).should.be.rejected;

            await messageProxyForMainnet.connect(deployer).addConnectedChain(schainName);

            const incomingMessagesCounter0 = BigNumber.from(
                await messageProxyForMainnet.getIncomingMessagesCounter(schainName));
            incomingMessagesCounter0.should.be.deep.equal(BigNumber.from(0));

            await messageProxyForMainnet
                .connect(deployer)
                .postIncomingMessages(
                    schainName,
                    startingCounter,
                    outgoingMessages,
                    sign
                );
            const incomingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getIncomingMessagesCounter(schainName));
            incomingMessagesCounter.should.be.deep.equal(BigNumber.from(2));
        });

        it("should get incoming messages counter", async () => {
            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);

            const startingCounter = 0;
            const message1 = {
                amount: 3,
                data: "0x11",
                destinationContract: depositBox.address,
                sender: deployer.address,
                to: client.address
            };
            const message2 = {
                amount: 7,
                data: "0x22",
                destinationContract: depositBox.address,
                sender: user.address,
                to: customer.address
            };
            const outgoingMessages = [message1, message2];
            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            // chain should be inited:
            await messageProxyForMainnet.getIncomingMessagesCounter(schainName).should.be.rejected;

            await messageProxyForMainnet.connect(deployer).addConnectedChain(schainName);

            const incomingMessagesCounter0 = BigNumber.from(
                await messageProxyForMainnet.getIncomingMessagesCounter(schainName));
            incomingMessagesCounter0.should.be.deep.equal(BigNumber.from(0));

            const res = await messageProxyForMainnet
                .connect(deployer)
                .postIncomingMessages(
                    schainName,
                    startingCounter,
                    outgoingMessages,
                    sign
                );
            // console.log("Gas for postIncomingMessages Eth:", res.receipt.gasUsed);
            const incomingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getIncomingMessagesCounter(schainName));
            incomingMessagesCounter.should.be.deep.equal(BigNumber.from(2));

            const amount = 5;
            const addressTo = client.address;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);

            const outgoingMessagesCounter0 = BigNumber.from(
                await messageProxyForMainnet.getOutgoingMessagesCounter(schainName));
            outgoingMessagesCounter0.should.be.deep.equal(BigNumber.from(0));

            await caller.postOutgoingMessageTester(messageProxyForMainnet.address,
                stringValue(web3.utils.soliditySha3(schainName)),
                depositBox.address,
                bytesData,
            );

            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getOutgoingMessagesCounter(schainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should check gas limit issue", async () => {
            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            await messageProxyForMainnet.connect(deployer).addConnectedChain(schainName);

            const receiverMockFactory = await ethers.getContractFactory("ReceiverGasLimitMainnetMock");
            const receiverMock = await receiverMockFactory.deploy() as ReceiverGasLimitMainnetMock;

            const startingCounter = 0;
            const message1 = {
                amount: 0,
                data: "0x11",
                destinationContract: receiverMock.address,
                sender: deployer.address,
                to: client.address
            };

            const outgoingMessages = [message1];
            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            await messageProxyForMainnet.registerExtraContract(schainName, receiverMock.address);

            let a = await receiverMock.a();
            expect(a.toNumber()).be.equal(0);

            const res = await (await messageProxyForMainnet
                .connect(deployer)
                .postIncomingMessages(
                    schainName,
                    startingCounter,
                    outgoingMessages,
                    sign
                )).wait();

            a = await receiverMock.a();
            expect(a.toNumber()).be.equal(0);
            expect(res.gasUsed.toNumber()).to.be.greaterThan(1000000);

        });

        describe("register and remove extra contracts", async () => {
            it("should register extra contract", async () => {
                const fakeContractOnSchain = deployer.address;
                await messageProxyForMainnet.connect(user).registerExtraContract(schainName,  depositBox.address)
                    .should.be.eventually.rejectedWith("Not enough permissions to register extra contract");
                await messageProxyForMainnet.registerExtraContract(schainName, fakeContractOnSchain)
                    .should.be.eventually.rejectedWith("Given address is not a contract");

                expect(await messageProxyForMainnet.isContractRegistered(schainName, depositBox.address)).to.be.equal(false);
                await messageProxyForMainnet.registerExtraContract(schainName, depositBox.address);
                expect(await messageProxyForMainnet.isContractRegistered(schainName, depositBox.address)).to.be.equal(true);

                await messageProxyForMainnet.registerExtraContract(schainName, depositBox.address)
                    .should.be.eventually.rejectedWith("Extra contract is already registered");
            });

            it("should register extra contract for all", async () => {
                const fakeContractOnSchain = deployer.address;
                await messageProxyForMainnet.connect(user).registerExtraContractForAll(depositBox.address)
                    .should.be.eventually.rejectedWith("EXTRA_CONTRACT_REGISTRAR_ROLE is required");
                await messageProxyForMainnet.registerExtraContractForAll(fakeContractOnSchain)
                    .should.be.eventually.rejectedWith("Given address is not a contract");

                expect(await messageProxyForMainnet.isContractRegistered(schainName, depositBox.address)).to.be.equal(false);
                await messageProxyForMainnet.registerExtraContractForAll(depositBox.address);
                expect(await messageProxyForMainnet.isContractRegistered(schainName, depositBox.address)).to.be.equal(true);

                await messageProxyForMainnet.registerExtraContract(schainName, depositBox.address)
                    .should.be.eventually.rejectedWith("Extra contract is already registered for all chains");

                await messageProxyForMainnet.registerExtraContractForAll(depositBox.address)
                    .should.be.eventually.rejectedWith("Extra contract is already registered");
            });

            it("should remove extra contract", async () => {
                const fakeContractOnSchain = deployer.address;
                await messageProxyForMainnet.connect(user).removeExtraContract(schainName,  depositBox.address)
                    .should.be.eventually.rejectedWith("Not enough permissions to register extra contract");
                await messageProxyForMainnet.removeExtraContract(schainName, fakeContractOnSchain)
                    .should.be.eventually.rejectedWith("Extra contract is not registered");

                await messageProxyForMainnet.registerExtraContract(schainName, depositBox.address);
                await messageProxyForMainnet.removeExtraContract(schainName, depositBox.address);

                await messageProxyForMainnet.removeExtraContract(schainName, depositBox.address)
                    .should.be.eventually.rejectedWith("Extra contract is not registered");
                expect(await messageProxyForMainnet.isContractRegistered(schainName, depositBox.address)).to.be.equal(false);
            });

            it("should remove extra contract for all", async () => {
                const fakeContractOnSchain = deployer.address;
                await messageProxyForMainnet.connect(user).removeExtraContractForAll(depositBox.address)
                    .should.be.eventually.rejectedWith("EXTRA_CONTRACT_REGISTRAR_ROLE is required");
                await messageProxyForMainnet.removeExtraContractForAll(fakeContractOnSchain)
                    .should.be.eventually.rejectedWith("Extra contract is not registered");

                await messageProxyForMainnet.registerExtraContractForAll(depositBox.address);
                await messageProxyForMainnet.removeExtraContractForAll(depositBox.address);

                await messageProxyForMainnet.removeExtraContractForAll(depositBox.address)
                    .should.be.eventually.rejectedWith("Extra contract is not registered");
            });
        });

    });

    describe("MessageProxy for schain", async () => {

        beforeEach(async () => {
            keyStorage = await deployKeyStorageMock();
            messageProxyForSchain = await deployMessageProxyForSchainTester(keyStorage.address, "Base schain");
            messages = await deployMessages();
            caller = await deployMessageProxyForMainnetTester();
            const chainConnectorRole = await messageProxyForSchain.CHAIN_CONNECTOR_ROLE();
            await messageProxyForSchain.connect(deployer).grantRole(chainConnectorRole, deployer.address);
            const extraContractRegistrarRole = await messageProxyForSchain.EXTRA_CONTRACT_REGISTRAR_ROLE();
            await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
            await messageProxyForSchain.registerExtraContract(schainName, caller.address);
        });

        it("should set constants", async () => {
            const gasLimitPrevious = (await messageProxyForSchain.gasLimit()).toNumber();

            const gasLimitNew = 7;

            expect((await messageProxyForSchain.gasLimit()).toNumber()).to.equal(gasLimitPrevious);

            await messageProxyForSchain.connect(user).setNewGasLimit(
                gasLimitNew
            ).should.be.eventually.rejectedWith();

            const constantSetterRole = await messageProxyForSchain.CONSTANT_SETTER_ROLE();
            await messageProxyForSchain.connect(deployer).grantRole(constantSetterRole, user.address);

            await messageProxyForSchain.connect(user).setNewGasLimit(gasLimitNew);

            expect((await messageProxyForSchain.gasLimit()).toNumber()).to.equal(gasLimitNew);

            await messageProxyForSchain.connect(user).setNewGasLimit(gasLimitPrevious);

            expect((await messageProxyForSchain.gasLimit()).toNumber()).to.equal(gasLimitPrevious);

        });

        it("should detect registration state by `isConnectedChain` function", async () => {
            const isConnectedChain = await messageProxyForSchain.isConnectedChain(schainName);
            isConnectedChain.should.be.deep.equal(Boolean(false));
            await messageProxyForSchain.addConnectedChain("Base schain")
                .should.be.rejectedWith("Schain cannot connect itself");
            await messageProxyForSchain.connect(deployer).addConnectedChain(schainName);
            const connectedChain = await messageProxyForSchain.isConnectedChain(schainName);
            connectedChain.should.be.deep.equal(Boolean(true));
        });

        it("should add connected chain", async () => {
            await messageProxyForSchain.connect(deployer).addConnectedChain(schainName);
            expect(await messageProxyForSchain.isConnectedChain(schainName)).to.be.equal(true);

            // chain can't be connected twice:
            await messageProxyForSchain.connect(deployer).addConnectedChain(schainName)
                .should.be.rejectedWith("Chain is already connected");
        });

        it("should remove connected chain", async () => {
            await messageProxyForSchain.connect(deployer).addConnectedChain(schainName);
            expect(await messageProxyForSchain.isConnectedChain(schainName)).to.be.equal(true);
            // only owner can remove chain:
            await messageProxyForSchain.connect(user).removeConnectedChain(schainName).should.be.rejected;
            // main net can't be removed:
            await messageProxyForSchain.connect(deployer).removeConnectedChain("Mainnet").should.be.rejected;
            await messageProxyForSchain.connect(deployer).removeConnectedChain(schainName);
            expect(await messageProxyForSchain.isConnectedChain(schainName)).to.be.equal(false);
            await messageProxyForSchain.connect(deployer).removeConnectedChain(schainName)
                .should.be.rejectedWith("Chain is not initialized");
        });

        it("should post outgoing message", async () => {
            const contractAddress = messageProxyForSchain.address;
            const amount = 4;
            const addressTo = user.address;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);
            await caller
                .postOutgoingMessageTesterOnSchain(messageProxyForSchain.address, stringValue(web3.utils.soliditySha3(schainName)), contractAddress, bytesData)
                .should.be.rejectedWith("Destination chain is not initialized");

            await messageProxyForSchain.connect(deployer).addConnectedChain(schainName);
            await caller
                .postOutgoingMessageTesterOnSchain(messageProxyForSchain.address, stringValue(web3.utils.soliditySha3(schainName)), contractAddress, bytesData);
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(schainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should post incoming messages and increase incoming message counter", async () => {

            // We have hardcoded signature in the test
            // To be correct it requires the same message
            // Message contains destination contract address
            // We deploy a mock to emulate this contract with a new address with 0 nonce
            // The mock will have the same address
            // IMPORTANT: if this address does not have 0 nonce the mock address is changed
            // and signature becomes incorrect

            const testPrivateKey = "0x27e29ffbb26fb7e77da65afc0cea8918655bad55f4d6f8e4b6daaddcf622781a";
            const testAddress = "0xd2000c8962Ba034be9eAe372B177D405D5bd4970";

            await web3.eth.sendTransaction({
                from: deployer.address,
                value: "500000",
                to: testAddress
            });

            const bytecode = ABIReceiverMock.bytecode;
            const deployTx = {
                gas: 500000,
                gasPrice: 1,
                data: bytecode
            }
            const signedDeployTx = await web3.eth.accounts.signTransaction(deployTx, testPrivateKey);
            const receipt = await web3.eth.sendSignedTransaction(stringValue(signedDeployTx.rawTransaction));
            const receiverMockAddress = stringValue(receipt.contractAddress);
            assert(
                receiverMockAddress === "0xb2DD6f3FE1487daF2aC8196Ae8639DDC2763b871",
                "ReceiverMock address was changed. BLS signature has to be regenerated"
            );

            const startingCounter = 0;
            const message1 = {
                sender: receiverMockAddress,
                destinationContract: receiverMockAddress,
                data: "0x11"
            };
            const message2 = {
                sender: receiverMockAddress,
                destinationContract: receiverMockAddress,
                data: "0x22"
            };
            const outgoingMessages = [message1, message2];
            // hash = 0xe598d7c6fb46c03a26ab640152e3308ba88cf52ecdd7bd24082baa2f90bac9f0

            const blsCommonPublicKey = {
                x: {
                    a: "0x117899a4eef45b19c0c3e7f9be0bc70e7e576452704c5cc85ed772cb1a61571f",
                    b: "0x2e4359ec9edb496b87a8ef1b44d50b30ed734a2cc991d109be75e62fff2e91f2"
                },
                y: {
                    a: "0x13d4c965ff05891a8e50b11690a2942ce6be8849af6a798b8e4fb464c33ee4f6",
                    b: "0x256f39ba1d0ae9d402321f6a4f8c46dac3e8bae3d83b23b85262203a400d178e"
                }
            }
            await keyStorage.setBlsCommonPublicKey(blsCommonPublicKey);

            const newBLSSignature: [BigNumber, BigNumber] = [
                BigNumber.from("0x2dedd4eaeac95881fbcaa4146f95a438494545c607bd57d560aa1d13d2679db8"),
                BigNumber.from("0x2e9a10a0baf75ccdbd2b5cf81491673108917ade57dea40d350d4cbebd7b0965")
            ];

            const sign = {
                blsSignature: newBLSSignature,
                counter: 0,
                hashA: "0x24079dfb76803f93456a4d274cddcf154a874ae92c1092ef17a979d42ec6d4d4",
                hashB: "0x1a44d878121e17e3f136ddbbba438a38d2dd0fdea786b0a815157828c2154047",
            };

            const fakeSign = {
                blsSignature: newBLSSignature,
                counter: 0,
                hashA: "0x0000000000000000000000000000000000000000000000000000000000000000",
                hashB: "0x0000000000000000000000000000000000000000000000000000000000000000",
            }

            // chain should be inited:
            await messageProxyForSchain.connect(deployer).postIncomingMessages(
                schainName,
                startingCounter,
                outgoingMessages,
                sign
            ).should.be.eventually.rejectedWith("Chain is not initialized");

            await messageProxyForSchain.connect(deployer).addConnectedChain(schainName);

            (await messageProxyForSchain.getIncomingMessagesCounter(schainName)).toNumber().should.be.equal(0);

            await messageProxyForSchain.connect(deployer).postIncomingMessages(
                schainName,
                startingCounter,
                outgoingMessages,
                fakeSign
            ).should.be.eventually.rejectedWith("Signature is not verified");

            await messageProxyForSchain.connect(deployer).postIncomingMessages(
                schainName,
                startingCounter + 1,
                outgoingMessages,
                sign
            ).should.be.eventually.rejectedWith("Starting counter is not qual to incoming message counter");

            (await messageProxyForSchain.getIncomingMessagesCounter(schainName)).toNumber().should.be.equal(0);


            await messageProxyForSchain.connect(deployer).postIncomingMessages(
                schainName,
                startingCounter,
                [message1, message1, message1, message1, message1, message1, message1, message1, message1, message1, message1],
                sign
            ).should.be.eventually.rejectedWith("Too many messages");

            await messageProxyForSchain.connect(deployer).postIncomingMessages(
                schainName,
                startingCounter,
                outgoingMessages,
                sign
            );

            (await messageProxyForSchain.getIncomingMessagesCounter(schainName)).toNumber().should.be.equal(2);
        });

        it("should get outgoing messages counter", async () => {
            const amount = 5;
            const addressTo = client.address;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);

            await messageProxyForSchain.connect(deployer).addConnectedChain(schainName);

            // chain should be inited:
            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(schainName)).should.be.deep.equal(BigNumber.from(0));

            const outgoingMessagesCounter0 = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(schainName));
            outgoingMessagesCounter0.should.be.deep.equal(BigNumber.from(0));

            await caller
                .postOutgoingMessageTesterOnSchain(messageProxyForSchain.address, stringValue(web3.utils.soliditySha3(schainName)), messages.address, bytesData);

            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(schainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should check gas limit issue", async () => {
            const messageProxyForSchainWithoutSignatureFactory = await ethers.getContractFactory("MessageProxyForSchainWithoutSignature");
            const messageProxyForSchainWithoutSignature = await messageProxyForSchainWithoutSignatureFactory.deploy() as MessageProxyForSchainWithoutSignature;
            await messageProxyForSchainWithoutSignature.initialize(deployer.address, "MyChain2");
            messages = await deployMessages();
            caller = await deployMessageProxyForMainnetTester();
            const chainConnectorRole = await messageProxyForSchainWithoutSignature.CHAIN_CONNECTOR_ROLE();
            await messageProxyForSchainWithoutSignature.connect(deployer).grantRole(chainConnectorRole, deployer.address);
            const extraContractRegistrarRole = await messageProxyForSchainWithoutSignature.EXTRA_CONTRACT_REGISTRAR_ROLE();
            await messageProxyForSchainWithoutSignature.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
            await messageProxyForSchainWithoutSignature.registerExtraContract(schainName, caller.address);

            const receiverMockFactory = await ethers.getContractFactory("ReceiverGasLimitSchainMock");
            const receiverMock = await receiverMockFactory.deploy() as ReceiverGasLimitSchainMock;

            const startingCounter = 0;
            const message1 = {
                amount: 0,
                data: "0x11",
                destinationContract: receiverMock.address,
                sender: deployer.address,
                to: client.address
            };

            const outgoingMessages = [message1];
            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            await messageProxyForSchainWithoutSignature.registerExtraContract("Mainnet", receiverMock.address);

            let a = await receiverMock.a();
            expect(a.toNumber()).be.equal(0);

            const res = await (await messageProxyForSchainWithoutSignature
                .connect(deployer)
                .postIncomingMessages(
                    "Mainnet",
                    startingCounter,
                    outgoingMessages,
                    sign
                )).wait();

            a = await receiverMock.a();
            expect(a.toNumber()).be.equal(0);
            expect(res.gasUsed.toNumber()).to.be.greaterThan(1000000);

        });

        describe("register and remove extra contracts", async () => {
            it("should register extra contract", async () => {
                const fakeContractOnSchain = deployer.address;
                await messageProxyForSchain.connect(user).registerExtraContract(schainName,  messages.address)
                    .should.be.eventually.rejectedWith("EXTRA_CONTRACT_REGISTRAR_ROLE is required");
                await messageProxyForSchain.registerExtraContract(schainName, fakeContractOnSchain)
                    .should.be.eventually.rejectedWith("Given address is not a contract");

                expect(await messageProxyForSchain.isContractRegistered(schainName, messages.address)).to.be.equal(false);
                await messageProxyForSchain.registerExtraContract(schainName, messages.address);
                expect(await messageProxyForSchain.isContractRegistered(schainName, messages.address)).to.be.equal(true);

                await messageProxyForSchain.registerExtraContract(schainName, messages.address)
                    .should.be.eventually.rejectedWith("Extra contract is already registered");
            });

            it("should register extra contract for all", async () => {
                const fakeContractOnSchain = deployer.address;
                await messageProxyForSchain.connect(user).registerExtraContractForAll(messages.address)
                    .should.be.eventually.rejectedWith("EXTRA_CONTRACT_REGISTRAR_ROLE is required");
                await messageProxyForSchain.registerExtraContractForAll(fakeContractOnSchain)
                    .should.be.eventually.rejectedWith("Given address is not a contract");

                expect(await messageProxyForSchain.isContractRegistered(schainName, messages.address)).to.be.equal(false);
                await messageProxyForSchain.registerExtraContractForAll(messages.address);
                expect(await messageProxyForSchain.isContractRegistered(schainName, messages.address)).to.be.equal(true);

                await messageProxyForSchain.registerExtraContract(schainName, messages.address)
                .should.be.eventually.rejectedWith("Extra contract is already registered for all chains");

                await messageProxyForSchain.registerExtraContractForAll(messages.address)
                    .should.be.eventually.rejectedWith("Extra contract is already registered");
            });

            it("should remove extra contract", async () => {
                const fakeContractOnSchain = deployer.address;
                await messageProxyForSchain.connect(user).removeExtraContract(schainName,  messages.address)
                    .should.be.eventually.rejectedWith("EXTRA_CONTRACT_REGISTRAR_ROLE is required");
                await messageProxyForSchain.removeExtraContract(schainName, fakeContractOnSchain)
                    .should.be.eventually.rejectedWith("Extra contract is not registered");

                await messageProxyForSchain.registerExtraContract(schainName, messages.address);
                await messageProxyForSchain.removeExtraContract(schainName, messages.address);

                await messageProxyForSchain.removeExtraContract(schainName, messages.address)
                    .should.be.eventually.rejectedWith("Extra contract is not registered");
                expect(await messageProxyForSchain.isContractRegistered(schainName, messages.address)).to.be.equal(false);
            });

            it("should remove extra contract for all", async () => {
                const fakeContractOnSchain = deployer.address;
                await messageProxyForSchain.connect(user).removeExtraContractForAll(messages.address)
                    .should.be.eventually.rejectedWith("EXTRA_CONTRACT_REGISTRAR_ROLE is required");
                await messageProxyForSchain.removeExtraContractForAll(fakeContractOnSchain)
                    .should.be.eventually.rejectedWith("Extra contract is not registered");

                await messageProxyForSchain.registerExtraContractForAll(messages.address);
                await messageProxyForSchain.removeExtraContractForAll(messages.address);

                await messageProxyForSchain.removeExtraContractForAll(messages.address)
                    .should.be.eventually.rejectedWith("Extra contract is not registered");
            });
        });

    });
});
