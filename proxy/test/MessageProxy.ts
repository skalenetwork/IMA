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
    DepositBoxInstance,
    ContractManagerContract,
    ContractManagerInstance,
    KeyStorageContract,
    KeyStorageInstance,
    LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainInstance,
    MessageProxyForMainnetInstance,
    MessageProxyForSchainContract,
    MessageProxyForSchainInstance,
    SchainsContract,
    SchainsInstance,
    SchainsInternalContract,
    SchainsInternalInstance,
    TokenManagerContract,
    TokenManagerInstance,
    WalletsContract,
    WalletsInstance,
    SkaleVerifierMockInstance,
    SkaleVerifierMockContract,
    SkaleFeaturesMockContract,
    SkaleFeaturesMockInstance,
    ReceiverMockContract,
} from "../types/truffle-contracts";

import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

import { deployLockAndDataForMainnet } from "./utils/deploy/lockAndDataForMainnet";
import { deployMessageProxyForMainnet } from "./utils/deploy/messageProxyForMainnet";
import { deployDepositBox } from "./utils/deploy/depositBox";

const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const TokenManager: TokenManagerContract = artifacts.require("./TokenManager");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const ContractManager: ContractManagerContract = artifacts.require("./ContractManager");
const Schains: SchainsContract = artifacts.require("./Schains");
const KeyStorage: KeyStorageContract = artifacts.require("./KeyStorage");
const SkaleVerifierMock: SkaleVerifierMockContract = artifacts.require("./SkaleVerifierMock");
const SchainsInternal: SchainsInternalContract = artifacts.require("./SchainsInternal");
const Wallets: WalletsContract = artifacts.require("./Wallets");
const SkaleFeaturesMock: SkaleFeaturesMockContract = artifacts.require("./SkaleFeaturesMock");

contract("MessageProxy", ([deployer, user, client, customer]) => {
    let messageProxyForMainnet: MessageProxyForMainnetInstance;
    let messageProxyForSchain: MessageProxyForSchainInstance;
    let tokenManager1: TokenManagerInstance;
    let tokenManager2: TokenManagerInstance;
    let lockAndDataForMainnet: LockAndDataForMainnetInstance;
    let lockAndDataForSchain: LockAndDataForSchainInstance;
    let contractManager: ContractManagerInstance;
    let schains: SchainsInstance;
    let skaleVerifier: SkaleVerifierMockInstance;
    let schainsInternal: SchainsInternalInstance;
    let depositBox: DepositBoxInstance;
    let keyStorage: KeyStorageInstance;
    let wallets: WalletsInstance;

    const publicKeyArray = [
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
    ];

    const BLSPublicKey = {
        x: {
            a: "8276253263131369565695687329790911140957927205765534740198480597854608202714",
            b: "12500085126843048684532885473768850586094133366876833840698567603558300429943",
        },
        y: {
            a: "7025653765868604607777943964159633546920168690664518432704587317074821855333",
            b: "14411459380456065006136894392078433460802915485975038137226267466736619639091",
        }
    }

    const BlsSignature = [
        "178325537405109593276798394634841698946852714038246117383766698579865918287",
        "493565443574555904019191451171395204672818649274520396086461475162723833781",
    ];
    const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
    const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
    const Counter = 0;

    describe("MessageProxyForMainnet for mainnet", async () => {
        beforeEach(async () => {
            contractManager = await ContractManager.new({from: deployer});
            schains = await Schains.new({from: deployer});
            schainsInternal = await SchainsInternal.new({from: deployer});
            skaleVerifier = await SkaleVerifierMock.new({from: deployer});
            keyStorage = await KeyStorage.new({from: deployer});
            wallets = await Wallets.new({from: deployer});
            await contractManager.setContractsAddress("Schains", schains.address, {from: deployer});
            await contractManager.setContractsAddress("SchainsInternal", schainsInternal.address, {from: deployer});
            await contractManager.setContractsAddress("Wallets", wallets.address, {from: deployer});
            await contractManager.setContractsAddress("SkaleVerifier", skaleVerifier.address, {from: deployer});
            await contractManager.setContractsAddress("KeyStorage", keyStorage.address, {from: deployer});
            await schains.addContractManager(contractManager.address);
            await wallets.addContractManager(contractManager.address);
            lockAndDataForMainnet = await deployLockAndDataForMainnet();
            messageProxyForMainnet = await deployMessageProxyForMainnet(lockAndDataForMainnet);
            depositBox = await deployDepositBox(lockAndDataForMainnet);
            await lockAndDataForMainnet.setContract("ContractManagerForSkaleManager", contractManager.address, {from: deployer});
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
            await messageProxyForMainnet.removeConnectedChain(chainID, {from: user}).should.be.rejected;

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
            const addressTo = user;
            const bytesData = "0x0";

            await messageProxyForMainnet
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer})
            .should.be.rejectedWith("Destination chain is not initialized");

            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer});
            await messageProxyForMainnet
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer});
            const outgoingMessagesCounter = new BigNumber(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

        it("should post incoming messages", async () => {
            const chainID = randomString(10);
            // tokenManager1 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            // tokenManager2 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            const startingCounter = 0;
            await schainsInternal.initializeSchain(chainID, deployer, 1, 1);
            await keyStorage.setCommonPublicKey(web3.utils.soliditySha3(chainID), BLSPublicKey, {from: deployer});
            await wallets.rechargeSchainWallet(web3.utils.soliditySha3(chainID), {from: deployer, value: "1000000000000000000"});

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

            const messages = [message1, message2];
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
                    messages,
                    sign,
                    0,
                    {from: deployer},
                ).should.be.rejected;

            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer});

            await messageProxyForMainnet
            .postIncomingMessages(
                chainID,
                startingCounter,
                messages,
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
            const contractAddress = lockAndDataForMainnet.address;
            const amount = 5;
            const addressTo = client;
            const bytesData = "0x0";

            // chain should be inited:
            await messageProxyForMainnet.getOutgoingMessagesCounter(chainID).should.be.rejected;

            await messageProxyForMainnet.addConnectedChain(chainID, {from: deployer});

            const outgoingMessagesCounter0 = new BigNumber(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxyForMainnet
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer});

            const outgoingMessagesCounter = new BigNumber(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

        it("should get incoming messages counter", async () => {
            const chainID = randomString(10);
            tokenManager1 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            tokenManager2 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            await schainsInternal.initializeSchain(chainID, deployer, 1, 1);
            await keyStorage.setCommonPublicKey(web3.utils.soliditySha3(chainID), BLSPublicKey, {from: deployer});
            await wallets.rechargeSchainWallet(web3.utils.soliditySha3(chainID), {from: deployer, value: "1000000000000000000"});
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
            const messages = [message1, message2];
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
                messages,
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
            tokenManager1 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            tokenManager2 = await TokenManager.new(chainID, lockAndDataForMainnet.address, {from: deployer});
            await schainsInternal.initializeSchain(chainID, deployer, 1, 1);
            await keyStorage.setCommonPublicKey(web3.utils.soliditySha3(chainID), BLSPublicKey, {from: deployer});
            await wallets.rechargeSchainWallet(web3.utils.soliditySha3(chainID), {from: deployer, value: "1000000000000000000"});
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
            const messages = [message1, message2];
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
                messages,
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
            const bytesData = "0x0";

            const outgoingMessagesCounter0 = new BigNumber(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxyForMainnet.postOutgoingMessage(
                chainID,
                lockAndDataForMainnet.address,
                amount,
                addressTo,
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
        let skaleFeatures: SkaleFeaturesMockInstance;

        beforeEach(async () => {
            messageProxyForSchain = await MessageProxyForSchain.new("MyChain", {from: deployer});
            lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
            await lockAndDataForSchain.setContract("MessageProxy", messageProxyForSchain.address, {from: deployer});
            skaleFeatures = await SkaleFeaturesMock.new();
            await skaleFeatures.setBlsCommonPublicKey(BLSPublicKey);
            messageProxyForSchain.setSkaleFeaturesAddress(skaleFeatures.address);
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
            const bytesData = "0x0";

            await messageProxyForSchain
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer})
            .should.be.rejectedWith("Destination chain is not initialized");

            await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            await messageProxyForSchain
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer});
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
                amount: 3,
                data: "0x11",
                // destinationContract: tokenManager1.address,
                destinationContract: receiverMockAddress,
                sender: receiverMockAddress,
                to: receiverMockAddress};
            const message2 = {
                amount: 7,
                data: "0x22",
                // destinationContract: tokenManager2.address,
                destinationContract: receiverMockAddress,
                sender: receiverMockAddress,
                to: receiverMockAddress};
            const messages = [message1, message2];

            const blsCommonPublicKey = {
                x: {
                    a: "0x223d2b836b902069c9cd1e0a80616cd4c132870c3617341dcff10df034d57390",
                    b: "0x0b7f115d0dbfe4afe63b1d4ad3c8f41c6dea357733e49d61db0ca7a00f6f68a9"
                },
                y: {
                    a: "0x0b195236fffcd189e4f63b4bc95aa095f515576f274192e7b317e86dd6771b62",
                    b: "0x138ee463e71b40eae73b30631bccac8a4dae85cf8335e6deebc4b99f346f0f95"
                }
            }
            await skaleFeatures.setBlsCommonPublicKey(blsCommonPublicKey);
            const sign = {
                blsSignature: [
                    "0x298bfd29b293be2709d6097143d643751359d9c7ed2011c8f1225c3e28e897b3",
                    "0x15d5f1824739d2a6ac930834234cc010b5d88436d28f4f6da014223e97bf9e25"
                ],
                counter: 5,
                hashA: "0x21deafc32cc506a2a8e1aed3c1a204c0cf6acd787080fd1c84dd820d620f48b9",
                hashB: "0x287f866512be542d32e4cee320076446aef124a78bb49d1f8632e2391747f6fe",
            };

            // chain should be inited:
            await messageProxyForSchain.postIncomingMessages(
                chainID,
                startingCounter,
                messages,
                sign,
                0,
                {from: deployer},
            ).should.be.rejected;

            await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            (await messageProxyForSchain.getIncomingMessagesCounter(chainID)).toNumber().should.be.equal(0);

            await messageProxyForSchain.postIncomingMessages(
                chainID,
                startingCounter,
                messages,
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
            const bytesData = "0x0";

            // chain should be inited:
            new BigNumber(await messageProxyForSchain.getOutgoingMessagesCounter(chainID)).should.be.deep.equal(new BigNumber(0));

            await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            const outgoingMessagesCounter0 = new BigNumber(
                await messageProxyForSchain.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxyForSchain
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer});

            const outgoingMessagesCounter = new BigNumber(
                await messageProxyForSchain.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

    });
});
