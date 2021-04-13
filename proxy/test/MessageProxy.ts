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

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");
import {
    DepositBoxEthInstance,
    ContractManagerInstance,
    IMALinkerInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainInstance,
    MessageProxyForMainnetInstance,
    MessageProxyForSchainContract,
    MessageProxyForSchainInstance,
    TokenManagerContract,
    MessagesTesterContract,
    MessagesTesterInstance,
    SkaleFeaturesMockInstance,
    SkaleFeaturesMockContract,
} from "../types/truffle-contracts";

import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

import { deployIMALinker } from "./utils/deploy/imaLinker";
import { deployMessageProxyForMainnet } from "./utils/deploy/messageProxyForMainnet";
import { deployDepositBoxEth } from "./utils/deploy/depositBoxEth";
import { deployContractManager } from "./utils/deploy/contractManager";
import { initializeSchain } from "./utils/skale-manager-utils/schainsInternal";
import { setCommonPublicKey } from "./utils/skale-manager-utils/keyStorage";
import { rechargeSchainWallet } from "./utils/skale-manager-utils/wallets";

const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const TokenManager: TokenManagerContract = artifacts.require("./TokenManager");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const MessagesTester: MessagesTesterContract = artifacts.require("./MessagesTester");
const SkaleFeaturesMock: SkaleFeaturesMockContract = artifacts.require("./SkaleFeaturesMock");

contract("MessageProxy", ([deployer, user, client, customer]) => {
    let messageProxyForSchain: MessageProxyForSchainInstance;
    let lockAndDataForSchain: LockAndDataForSchainInstance;

    let depositBox: DepositBoxEthInstance;
    let contractManager: ContractManagerInstance;
    let messageProxyForMainnet: MessageProxyForMainnetInstance;
    let imaLinker: IMALinkerInstance;
    let messages: MessagesTesterInstance;
    let contractManagerAddress = "0x0000000000000000000000000000000000000000";

    const publicKeyArray = [
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
    ];

    const BlsSignature = [
        "178325537405109593276798394634841698946852714038246117383766698579865918287",
        "493565443574555904019191451171395204672818649274520396086461475162723833781",
    ];
    const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
    const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
    const Counter = 0;

    describe("MessageProxyForMainnet for mainnet", async () => {
        beforeEach(async () => {
            contractManager = await deployContractManager(contractManagerAddress);
            contractManagerAddress = contractManager.address;
            messageProxyForMainnet = await deployMessageProxyForMainnet(contractManager);
            imaLinker = await deployIMALinker(contractManager, messageProxyForMainnet);
            depositBox = await deployDepositBoxEth(contractManager, messageProxyForMainnet, imaLinker);
            messages = await MessagesTester.new();
        });

        it("should detect registration state by `isConnectedChain` function", async () => {
            const someCainID = randomString(10);
            const isConnectedChain = await messageProxyForMainnet.isConnectedChain(someCainID);
            isConnectedChain.should.be.deep.equal(Boolean(false));
            await messageProxyForMainnet.addConnectedChain(someCainID, {from: deployer});
            const connectedChain = await messageProxyForMainnet.isConnectedChain(someCainID);
            connectedChain.should.be.deep.equal(Boolean(true));
            // // main net does not have a public key and is implicitly connected:
            // await messageProxyForMainnet.isConnectedChain("Mainnet").should.be.rejected;
        });

        it("should add connected chain", async () => {
            const chainID = randomString(10);
            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer});
            const isConnectedChain = await messageProxyForMainnet.isConnectedChain(chainID);
            isConnectedChain.should.be.deep.equal(Boolean(true));

            // chain can't be connected twice:
            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer})
            .should.be.rejectedWith("Chain is already connected");

            // // main net does not have a public key and is implicitly connected:
            // await messageProxyForMainnet.addConnectedChain("Mainnet", {from: deployer})
            // .should.be.rejectedWith("SKALE chain name is incorrect. Inside in MessageProxy");
        });

        it("should remove connected chain", async () => {
            const chainID = randomString(10);
            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer});
            const connectedChain = await messageProxyForMainnet.isConnectedChain(chainID);
            connectedChain.should.be.deep.equal(Boolean(true));

            // only owner can remove chain:
            // TODO uncomment after fix permission logic
            // await messageProxyForMainnet.removeConnectedChain(chainID, {from: user}).should.be.rejected;

            // main net can't be removed:
            await messageProxyForMainnet.removeConnectedChain("Mainnet", {from: deployer}).should.be.rejected;

            await messageProxyForMainnet.removeConnectedChain(chainID, {from: deployer});
            const notConnectedChain = await messageProxyForMainnet.isConnectedChain(chainID);
            notConnectedChain.should.be.deep.equal(Boolean(false));
        });

        it("should post outgoing message", async () => {
            const chainID = randomString(10);
            const contractAddress = messageProxyForMainnet.address;
            const amount = 4;
            const bytesData = await messages.encodeTransferEthMessage(user, amount);

            await messageProxyForMainnet
                .postOutgoingMessage(web3.utils.soliditySha3(chainID), contractAddress, bytesData, {from: deployer})
                .should.be.rejectedWith("Destination chain is not initialized");

            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer});
            await messageProxyForMainnet
                .postOutgoingMessage(web3.utils.soliditySha3(chainID), contractAddress, bytesData, {from: deployer});
            const outgoingMessagesCounter = new BigNumber(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

        it("should post incoming messages", async () => {
            const chainID = randomString(10);
            // tokenManager1 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            // tokenManager2 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            const startingCounter = 0;
            await initializeSchain(contractManager, chainID, deployer, 1, 1);
            await setCommonPublicKey(contractManager, chainID);
            await rechargeSchainWallet(contractManager, chainID, deployer, "1000000000000000000");

            const message1 = {
                amount: 3,
                data: "0x01",
                destinationContract: depositBox.address,
                sender: deployer,
                to: client};

            const message2 = {
                amount: 7,
                data: "0x01",
                destinationContract: depositBox.address,
                sender: user,
                to: customer};

            const outgoingMessages = [message1, message2];
            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            // chain should be inited:
            await messageProxyForMainnet
                .postIncomingMessages(
                    chainID,
                    startingCounter,
                    outgoingMessages,
                    sign,
                    0,
                    {from: deployer},
                ).should.be.rejected;

            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer});

            await messageProxyForMainnet
            .postIncomingMessages(
                chainID,
                startingCounter,
                outgoingMessages,
                sign,
                0,
                {from: deployer},
            );
            const incomingMessagesCounter = new BigNumber(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));
        });

        it("should get outgoing messages counter", async () => {
            const chainID = randomString(10);
            const contractAddress = depositBox.address;
            const amount = 5;
            const addressTo = client;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);

            // chain should be inited:
            await messageProxyForMainnet.getOutgoingMessagesCounter(chainID).should.be.rejected;

            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer});

            const outgoingMessagesCounter0 = new BigNumber(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxyForMainnet
            .postOutgoingMessage(web3.utils.soliditySha3(chainID), contractAddress, bytesData, {from: deployer});

            const outgoingMessagesCounter = new BigNumber(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

        it("should get incoming messages counter", async () => {
            const chainID = randomString(10);
            // tokenManager1 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            // tokenManager2 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            await initializeSchain(contractManager, chainID, deployer, 1, 1);
            await setCommonPublicKey(contractManager, chainID);
            await rechargeSchainWallet(contractManager, chainID, deployer, "1000000000000000000");
            const startingCounter = 0;
            const message1 = {
                amount: 3,
                data: "0x11",
                destinationContract: depositBox.address,
                sender: deployer,
                to: client};
            const message2 = {
                amount: 7,
                data: "0x22",
                destinationContract: depositBox.address,
                sender: user,
                to: customer};
            const outgoingMessages = [message1, message2];
            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            // chain should be inited:
            await messageProxyForMainnet.getIncomingMessagesCounter(chainID).should.be.rejected;

            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer});

            const incomingMessagesCounter0 = new BigNumber(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxyForMainnet
            .postIncomingMessages(
                chainID,
                startingCounter,
                outgoingMessages,
                sign,
                0,
                {from: deployer},
            );
            const incomingMessagesCounter = new BigNumber(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));
        });

        it("should move incoming counter", async () => {
            const chainID = randomString(10);
            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer});
            const isConnectedChain = await messageProxyForMainnet.isConnectedChain(chainID);
            isConnectedChain.should.be.deep.equal(Boolean(true));

            // chain can't be connected twice:
            const incomingMessages = new BigNumber(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID, {from: deployer}),
            );

            // main net does not have a public key and is implicitly connected:
            await messageProxyForMainnet.moveIncomingCounter(chainID, {from: deployer});

            const newIncomingMessages = new BigNumber(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID, {from: deployer}),
            );

            newIncomingMessages.should.be.deep.equal(BigNumber.sum(incomingMessages, 1));
        });

        it("should get incoming messages counter", async () => {
            const chainID = randomString(10);
            // tokenManager1 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            // tokenManager2 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            await initializeSchain(contractManager, chainID, deployer, 1, 1);
            await setCommonPublicKey(contractManager, chainID);
            await rechargeSchainWallet(contractManager, chainID, deployer, "1000000000000000000");
            const startingCounter = 0;
            const message1 = {
                amount: 3,
                data: "0x11",
                destinationContract: depositBox.address,
                sender: deployer,
                to: client};
            const message2 = {
                amount: 7,
                data: "0x22",
                destinationContract: depositBox.address,
                sender: user,
                to: customer};
            const outgoingMessages = [message1, message2];
            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            // chain should be inited:
            await messageProxyForMainnet.getIncomingMessagesCounter(chainID).should.be.rejected;

            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer});

            const incomingMessagesCounter0 = new BigNumber(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            const res = await messageProxyForMainnet
            .postIncomingMessages(
                chainID,
                startingCounter,
                outgoingMessages,
                sign,
                0,
                {from: deployer},
            );
            // console.log("Gas for postIncomingMessages Eth:", res.receipt.gasUsed);
            const incomingMessagesCounter = new BigNumber(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));

            const amount = 5;
            const addressTo = client;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);

            const outgoingMessagesCounter0 = new BigNumber(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxyForMainnet.postOutgoingMessage(
                web3.utils.soliditySha3(chainID),
                depositBox.address,
                bytesData,
                {from: deployer},
            );

            const outgoingMessagesCounter = new BigNumber(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));

            await messageProxyForMainnet.setCountersToZero(chainID, {from: deployer});

            const newIncomingMessagesCounter = new BigNumber(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            newIncomingMessagesCounter.should.be.deep.equal(new BigNumber(0));

            const newOutgoingMessagesCounter = new BigNumber
                (await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            newOutgoingMessagesCounter.should.be.deep.equal(new BigNumber(0));
        });

    });

    describe("MessageProxyForSchain for schain", async () => {

        beforeEach(async () => {
            messageProxyForSchain = await MessageProxyForSchain.new("MyChain", {from: deployer});
            lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
            await lockAndDataForSchain.setContract("MessageProxy", messageProxyForSchain.address, {from: deployer});
        });

        it("should detect registration state by `isConnectedChain` function", async () => {
            const someCainID = randomString(10);
            const isConnectedChain = await messageProxyForSchain.isConnectedChain(someCainID);
            isConnectedChain.should.be.deep.equal(Boolean(false));
            await messageProxyForSchain.addConnectedChain(someCainID, publicKeyArray, {from: deployer});
            const connectedChain = await messageProxyForSchain.isConnectedChain(someCainID);
            connectedChain.should.be.deep.equal(Boolean(true));
            // // main net does not have a public key and is implicitly connected:
            // await messageProxyForSchain.isConnectedChain("Mainnet").should.be.rejected;
        });

        it("should add connected chain", async () => {
            const chainID = randomString(10);
            await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            const isConnectedChain = await messageProxyForSchain.isConnectedChain(chainID);
            isConnectedChain.should.be.deep.equal(Boolean(true));
            // chain can't be connected twice:
            await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer})
            .should.be.rejectedWith("Chain is already connected");
            // main net does not have a public key and is implicitly connected:
            // await messageProxyForSchain.addConnectedChain("Mainnet", publicKeyArray, {from: deployer})
            // .should.be.rejectedWith("SKALE chain name is incorrect. Inside in MessageProxy");
        });

        it("should remove connected chain", async () => {
            const chainID = randomString(10);
            await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            const connectedChain = await messageProxyForSchain.isConnectedChain(chainID);
            connectedChain.should.be.deep.equal(Boolean(true));

            // only owner can remove chain:
            await messageProxyForSchain.removeConnectedChain(chainID, {from: user}).should.be.rejected;

            // main net can't be removed:
            await messageProxyForSchain.removeConnectedChain("Mainnet", {from: deployer}).should.be.rejected;

            await messageProxyForSchain.removeConnectedChain(chainID, {from: deployer});
            const notConnectedChain = await messageProxyForSchain.isConnectedChain(chainID);
            notConnectedChain.should.be.deep.equal(Boolean(false));
        });

        it("should post outgoing message", async () => {
            const chainID = randomString(10);
            const contractAddress = messageProxyForSchain.address;
            const amount = 4;
            const addressTo = user;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);


            await messageProxyForSchain
            .postOutgoingMessage(chainID, contractAddress, bytesData, {from: deployer})
                .should.be.rejectedWith("Destination chain is not initialized");

            await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            await messageProxyForSchain
                .postOutgoingMessage(chainID, contractAddress, bytesData, {from: deployer});
            const outgoingMessagesCounter = new BigNumber(
                await messageProxyForSchain.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

        it("should post incoming messages and increase incoming message counter", async () => {
            const chainID = randomString(10);

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
                from: deployer,
                value: "500000",
                to: testAddress
            });

            const bytecode = artifacts.require("./ReceiverMock").bytecode;
            const deployTx = {
                gas: 500000,
                gasPrice: 1,
                data: bytecode
            }
            const signedDeployTx = await web3.eth.accounts.signTransaction(deployTx, testPrivateKey);
            const receipt = await web3.eth.sendSignedTransaction(signedDeployTx.rawTransaction);
            const receiverMockAddress = receipt.contractAddress;
            assert(
                receiverMockAddress === "0xb2DD6f3FE1487daF2aC8196Ae8639DDC2763b871",
                "ReceiverMock address was changed. BLS signature has to be regenerated"
            );

            const startingCounter = 0;
            const message1 = {
                data: "0x11",
                destinationContract: receiverMockAddress,
                sender: receiverMockAddress
            };
            const message2 = {
                data: "0x22",
                destinationContract: receiverMockAddress,
                sender: receiverMockAddress
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
            const skaleFeatures = await SkaleFeaturesMock.new();
            await skaleFeatures.setBlsCommonPublicKey(blsCommonPublicKey);
            messageProxyForSchain.setSkaleFeaturesAddress(skaleFeatures.address);

            const sign = {
                blsSignature: [
                    "0x2dedd4eaeac95881fbcaa4146f95a438494545c607bd57d560aa1d13d2679db8",
                    "0x2e9a10a0baf75ccdbd2b5cf81491673108917ade57dea40d350d4cbebd7b0965"
                ],
                counter: 0,
                hashA: "0x24079dfb76803f93456a4d274cddcf154a874ae92c1092ef17a979d42ec6d4d4",
                hashB: "0x1a44d878121e17e3f136ddbbba438a38d2dd0fdea786b0a815157828c2154047",
            };

            // chain should be inited:
            await messageProxyForSchain.postIncomingMessages(
                chainID,
                startingCounter,
                outgoingMessages,
                sign,
                0,
                {from: deployer},
            ).should.be.rejected;

            await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            (await messageProxyForSchain.getIncomingMessagesCounter(chainID)).toNumber().should.be.equal(0);

            await messageProxyForSchain.postIncomingMessages(
                chainID,
                startingCounter,
                outgoingMessages,
                sign,
                0,
                {from: deployer},
            );

            (await messageProxyForSchain.getIncomingMessagesCounter(chainID)).toNumber().should.be.equal(2);
        });

        it("should get outgoing messages counter", async () => {
            const chainID = randomString(10);
            const contractAddress = lockAndDataForSchain.address;
            const amount = 5;
            const addressTo = client;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);


            // chain should be inited:
            new BigNumber(await messageProxyForSchain.getOutgoingMessagesCounter(chainID)).should.be.deep.equal(new BigNumber(0));

            await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            const outgoingMessagesCounter0 = new BigNumber(
                await messageProxyForSchain.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxyForSchain
            .postOutgoingMessage(chainID, contractAddress, bytesData, {from: deployer});

            const outgoingMessagesCounter = new BigNumber(
                await messageProxyForSchain.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

    });
});
