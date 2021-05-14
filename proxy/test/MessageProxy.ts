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
    IMALinker,
    LockAndDataForSchain,
    MessageProxyForMainnet,
    MessageProxyForSchain,
    MessagesTester,
    SkaleFeaturesMock,
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
import { rechargeSchainWallet } from "./utils/skale-manager-utils/wallets";

import { deployMessageProxyForSchain } from "./utils/deploy/schain/messageProxyForSchain";
import { deployTokenManager } from "./utils/deploy/schain/tokenManager";
import { deployLockAndDataForSchain } from "./utils/deploy/schain/lockAndDataForSchain";
import { deployMessages } from "./utils/deploy/messages";
import { deploySkaleFeaturesMock } from "./utils/deploy/test/skaleFeaturesMock";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("MessageProxy", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let client: SignerWithAddress;
    let customer: SignerWithAddress;

    let messageProxyForSchain: MessageProxyForSchain;
    let lockAndDataForSchain: LockAndDataForSchain;

    let depositBox: DepositBoxEth;
    let contractManager: ContractManager;
    let messageProxyForMainnet: MessageProxyForMainnet;
    let imaLinker: IMALinker;
    let messages: MessagesTester;
    let contractManagerAddress = "0x0000000000000000000000000000000000000000";

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

    describe("MessageProxyForMainnet for mainnet", async () => {

        beforeEach(async () => {
            contractManager = await deployContractManager(contractManagerAddress);
            contractManagerAddress = contractManager.address;
            messageProxyForMainnet = await deployMessageProxyForMainnet(contractManager);
            imaLinker = await deployLinker(messageProxyForMainnet);
            depositBox = await deployDepositBoxEth(contractManager, messageProxyForMainnet, imaLinker);
            messages = await deployMessages();
        });

        it("should detect registration state by `isConnectedChain` function", async () => {
            const someCainID = randomString(10);
            const isConnectedChain = await messageProxyForMainnet.isConnectedChain(someCainID);
            isConnectedChain.should.be.deep.equal(Boolean(false));
            await messageProxyForMainnet.connect(deployer).addConnectedChain(someCainID);
            const connectedChain = await messageProxyForMainnet.isConnectedChain(someCainID);
            connectedChain.should.be.deep.equal(Boolean(true));
            // // main net does not have a public key and is implicitly connected:
            // await messageProxyForMainnet.isConnectedChain("Mainnet").should.be.rejected;
        });

        it("should add connected chain", async () => {
            const chainID = randomString(10);
            await messageProxyForMainnet.connect(deployer).addConnectedChain(chainID);
            const isConnectedChain = await messageProxyForMainnet.isConnectedChain(chainID);
            isConnectedChain.should.be.deep.equal(Boolean(true));

            // chain can't be connected twice:
            await messageProxyForMainnet.connect(deployer).addConnectedChain(chainID)
            .should.be.rejectedWith("Chain is already connected");

            // // main net does not have a public key and is implicitly connected:
            // await messageProxyForMainnet.connect(deployer).addConnectedChain("Mainnet")
            // .should.be.rejectedWith("SKALE chain name is incorrect. Inside in MessageProxy");
        });

        it("should remove connected chain", async () => {
            const chainID = randomString(10);
            await messageProxyForMainnet.connect(deployer).addConnectedChain(chainID);
            const connectedChain = await messageProxyForMainnet.isConnectedChain(chainID);
            connectedChain.should.be.deep.equal(Boolean(true));

            // only owner can remove chain:
            // TODO uncomment after fix permission logic
            // await messageProxyForMainnet.removeConnectedChain(chainID, {from: user}).should.be.rejected;

            // main net can't be removed:
            await messageProxyForMainnet.connect(deployer).removeConnectedChain("Mainnet").should.be.rejected;

            await messageProxyForMainnet.connect(deployer).removeConnectedChain(chainID);
            const notConnectedChain = await messageProxyForMainnet.isConnectedChain(chainID);
            notConnectedChain.should.be.deep.equal(Boolean(false));
        });

        it("should post outgoing message", async () => {
            const chainID = randomString(10);
            const contractAddress = messageProxyForMainnet.address;
            const amount = 4;
            const bytesData = await messages.encodeTransferEthMessage(user.address, amount);

            await messageProxyForMainnet
                .connect(deployer)
                .postOutgoingMessage(stringValue(web3.utils.soliditySha3(chainID)), contractAddress, bytesData)
                .should.be.rejectedWith("Destination chain is not initialized");

            await messageProxyForMainnet.connect(deployer).addConnectedChain(chainID);
            await messageProxyForMainnet
                .connect(deployer)
                .postOutgoingMessage(stringValue(web3.utils.soliditySha3(chainID)), contractAddress, bytesData);
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should post incoming messages", async () => {
            const chainID = randomString(10);
            const startingCounter = 0;
            await initializeSchain(contractManager, chainID, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, chainID);
            await rechargeSchainWallet(contractManager, chainID, deployer.address, "1000000000000000000");

            const message1 = {
                amount: 3,
                data: "0x01",
                destinationContract: depositBox.address,
                sender: deployer.address,
                to: client.address};

            const message2 = {
                amount: 7,
                data: "0x01",
                destinationContract: depositBox.address,
                sender: user.address,
                to: customer.address};

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
                    chainID,
                    startingCounter,
                    outgoingMessages,
                    sign,
                    0,
                ).should.be.rejected;

            await messageProxyForMainnet.connect(deployer).addConnectedChain(chainID);

            await messageProxyForMainnet
                .connect(deployer)
                .postIncomingMessages(
                    chainID,
                    startingCounter,
                    outgoingMessages,
                    sign,
                    0,
                );
            const incomingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(BigNumber.from(2));
        });

        it("should get outgoing messages counter", async () => {
            const chainID = randomString(10);
            const contractAddress = depositBox.address;
            const amount = 5;
            const addressTo = client.address;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);

            // chain should be inited:
            await messageProxyForMainnet.getOutgoingMessagesCounter(chainID).should.be.rejected;

            await messageProxyForMainnet.connect(deployer).addConnectedChain(chainID);

            const outgoingMessagesCounter0 = BigNumber.from(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(BigNumber.from(0));

            await messageProxyForMainnet
                .connect(deployer)
                .postOutgoingMessage(stringValue(web3.utils.soliditySha3(chainID)), contractAddress, bytesData);

            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should get incoming messages counter", async () => {
            const chainID = randomString(10);
            await initializeSchain(contractManager, chainID, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, chainID);
            await rechargeSchainWallet(contractManager, chainID, deployer.address, "1000000000000000000");
            const startingCounter = 0;
            const message1 = {
                amount: 3,
                data: "0x11",
                destinationContract: depositBox.address,
                sender: deployer.address,
                to: client.address};
            const message2 = {
                amount: 7,
                data: "0x22",
                destinationContract: depositBox.address,
                sender: user.address,
                to: customer.address};
            const outgoingMessages = [message1, message2];
            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            // chain should be inited:
            await messageProxyForMainnet.getIncomingMessagesCounter(chainID).should.be.rejected;

            await messageProxyForMainnet.connect(deployer).addConnectedChain(chainID);

            const incomingMessagesCounter0 = BigNumber.from(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter0.should.be.deep.equal(BigNumber.from(0));

            await messageProxyForMainnet
                .connect(deployer)
                .postIncomingMessages(
                    chainID,
                    startingCounter,
                    outgoingMessages,
                    sign,
                    0,
                );
            const incomingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(BigNumber.from(2));
        });

        it("should move incoming counter", async () => {
            const chainID = randomString(10);
            await messageProxyForMainnet.connect(deployer).addConnectedChain(chainID);
            const isConnectedChain = await messageProxyForMainnet.isConnectedChain(chainID);
            isConnectedChain.should.be.deep.equal(Boolean(true));
            await messageProxyForMainnet.grantRole(await messageProxyForMainnet.DEBUGGER_ROLE(), deployer);

            // chain can't be connected twice:
            const incomingMessages = BigNumber.from(
                await messageProxyForMainnet.connect(deployer).getIncomingMessagesCounter(chainID),
            );

            // main net does not have a public key and is implicitly connected:
            await messageProxyForMainnet.connect(deployer).incrementIncomingCounter(chainID);

            const newIncomingMessages = BigNumber.from(
                await messageProxyForMainnet.connect(deployer).getIncomingMessagesCounter(chainID),
            );

            newIncomingMessages.should.be.deep.equal(BigNumber.from(incomingMessages).add(BigNumber.from(1)));
        });

        it("should get incoming messages counter", async () => {
            const chainID = randomString(10);
            await initializeSchain(contractManager, chainID, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, chainID);
            await rechargeSchainWallet(contractManager, chainID, deployer.address, "1000000000000000000");
            const startingCounter = 0;
            const message1 = {
                amount: 3,
                data: "0x11",
                destinationContract: depositBox.address,
                sender: deployer.address,
                to: client.address};
            const message2 = {
                amount: 7,
                data: "0x22",
                destinationContract: depositBox.address,
                sender: user.address,
                to: customer.address};
            const outgoingMessages = [message1, message2];
            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            // chain should be inited:
            await messageProxyForMainnet.getIncomingMessagesCounter(chainID).should.be.rejected;

            await messageProxyForMainnet.connect(deployer).addConnectedChain(chainID);

            const incomingMessagesCounter0 = BigNumber.from(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter0.should.be.deep.equal(BigNumber.from(0));

            const res = await messageProxyForMainnet
            .connect(deployer)
            .postIncomingMessages(
                chainID,
                startingCounter,
                outgoingMessages,
                sign,
                0,
            );
            // console.log("Gas for postIncomingMessages Eth:", res.receipt.gasUsed);
            const incomingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(BigNumber.from(2));

            const amount = 5;
            const addressTo = client.address;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);

            const outgoingMessagesCounter0 = BigNumber.from(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(BigNumber.from(0));

            await messageProxyForMainnet.connect(deployer).postOutgoingMessage(
                stringValue(web3.utils.soliditySha3(chainID)),
                depositBox.address,
                bytesData,
            );

            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            await messageProxyForMainnet.connect(deployer).setCountersToZero(chainID);

            const newIncomingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getIncomingMessagesCounter(chainID));
            newIncomingMessagesCounter.should.be.deep.equal(BigNumber.from(0));

            const newOutgoingMessagesCounter = BigNumber.from(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID)
            );
            newOutgoingMessagesCounter.should.be.deep.equal(BigNumber.from(0));
        });

    });

    describe("MessageProxyForSchain for schain", async () => {

        beforeEach(async () => {
            messageProxyForSchain = await deployMessageProxyForSchain("MyChain");
            const chainConnectorRole = await messageProxyForSchain.CHAIN_CONNECTOR_ROLE();
            await messageProxyForSchain.connect(deployer).grantRole(chainConnectorRole, deployer);
        });

        it("should detect registration state by `isConnectedChain` function", async () => {
            const someCainID = randomString(10);
            const isConnectedChain = await messageProxyForSchain.isConnectedChain(someCainID);
            isConnectedChain.should.be.deep.equal(Boolean(false));
            await messageProxyForSchain.connect(deployer).addConnectedChain(someCainID);
            const connectedChain = await messageProxyForSchain.isConnectedChain(someCainID);
            connectedChain.should.be.deep.equal(Boolean(true));
            // // main net does not have a public key and is implicitly connected:
            // await messageProxyForSchain.isConnectedChain("Mainnet").should.be.rejected;
        });

        it("should add connected chain", async () => {
            const chainID = randomString(10);
            await messageProxyForSchain.connect(deployer).addConnectedChain(chainID);
            const isConnectedChain = await messageProxyForSchain.isConnectedChain(chainID);
            isConnectedChain.should.be.deep.equal(Boolean(true));
            // chain can't be connected twice:
            await messageProxyForSchain.connect(deployer).addConnectedChain(chainID)
            .should.be.rejectedWith("Chain is already connected");
            // main net does not have a public key and is implicitly connected:
            // await messageProxyForSchain.connect(deployer).addConnectedChain("Mainnet")
            // .should.be.rejectedWith("SKALE chain name is incorrect. Inside in MessageProxy");
        });

        it("should remove connected chain", async () => {
            const chainID = randomString(10);
            await messageProxyForSchain.connect(deployer).addConnectedChain(chainID);
            const connectedChain = await messageProxyForSchain.isConnectedChain(chainID);
            connectedChain.should.be.deep.equal(Boolean(true));

            // only owner can remove chain:
            await messageProxyForSchain.connect(user).removeConnectedChain(chainID).should.be.rejected;

            // main net can't be removed:
            await messageProxyForSchain.connect(deployer).removeConnectedChain("Mainnet").should.be.rejected;

            await messageProxyForSchain.connect(deployer).removeConnectedChain(chainID);
            const notConnectedChain = await messageProxyForSchain.isConnectedChain(chainID);
            notConnectedChain.should.be.deep.equal(Boolean(false));
        });

        it("should post outgoing message", async () => {
            const chainID = randomString(10);
            const contractAddress = messageProxyForSchain.address;
            const amount = 4;
            const addressTo = user.address;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);


            await messageProxyForSchain
                .connect(deployer)
                .postOutgoingMessage(chainID, contractAddress, bytesData)
                .should.be.rejectedWith("Destination chain is not initialized");

            await messageProxyForSchain.connect(deployer).addConnectedChain(chainID);
            await messageProxyForSchain
                .connect(deployer)
                .postOutgoingMessage(chainID, contractAddress, bytesData);
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
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
            const skaleFeatures = await deploySkaleFeaturesMock();
            await skaleFeatures.setBlsCommonPublicKey(blsCommonPublicKey);
            const skaleFeaturesSetterRole = await messageProxyForSchain.SKALE_FEATURES_SETTER_ROLE();
            await messageProxyForSchain.grantRole(skaleFeaturesSetterRole, deployer, {from: deployer});
            await messageProxyForSchain.setSkaleFeaturesAddress(skaleFeatures.address);

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

            // chain should be inited:
            await messageProxyForSchain.connect(deployer).postIncomingMessages(
                chainID,
                startingCounter,
                outgoingMessages,
                sign,
                0,
            ).should.be.rejected;

            await messageProxyForSchain.connect(deployer).addConnectedChain(chainID);

            (await messageProxyForSchain.getIncomingMessagesCounter(chainID)).toNumber().should.be.equal(0);

            await messageProxyForSchain.connect(deployer).postIncomingMessages(
                chainID,
                startingCounter,
                outgoingMessages,
                sign,
                0,
            );

            (await messageProxyForSchain.getIncomingMessagesCounter(chainID)).toNumber().should.be.equal(2);
        });

        it("should get outgoing messages counter", async () => {
            const chainID = randomString(10);
            const amount = 5;
            const addressTo = client.address;
            const bytesData = await messages.encodeTransferEthMessage(addressTo, amount);


            // chain should be inited:
            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(chainID)).should.be.deep.equal(BigNumber.from(0));

            await messageProxyForSchain.connect(deployer).addConnectedChain(chainID);

            const outgoingMessagesCounter0 = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(BigNumber.from(0));

            await messageProxyForSchain
                .connect(deployer)
                .postOutgoingMessage(chainID, contractAddress, bytesData);

            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

    });
});
