import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");
import {
    ContractManagerContract,
    ContractManagerInstance,
    LockAndDataForMainnetContract,
    LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainInstance,
    MessageProxyForMainnetContract,
    MessageProxyForMainnetInstance,
    MessageProxyForSchainContract,
    MessageProxyForSchainInstance,
    SkaleVerifierContract,
    SkaleVerifierInstance,
    TokenManagerContract,
    TokenManagerInstance,
} from "../types/truffle-contracts";

import { gasMultiplier } from "./utils/command_line";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxyForMainnet: MessageProxyForMainnetContract = artifacts.require("./MessageProxyForMainnet");
const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const TokenManager: TokenManagerContract = artifacts.require("./TokenManager");
const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnet");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const ContractManager: ContractManagerContract = artifacts.require("./ContractManager");
const SkaleVerifier: SkaleVerifierContract = artifacts.require("./SkaleVerifier");

contract("MessageProxy", ([user, deployer, client, customer]) => {
    let messageProxyForMainnet: MessageProxyForMainnetInstance;
    let messageProxyForSchain: MessageProxyForSchainInstance;
    let tokenManager1: TokenManagerInstance;
    let tokenManager2: TokenManagerInstance;
    let lockAndDataForMainnet: LockAndDataForMainnetInstance;
    let lockAndDataForSchain: LockAndDataForSchainInstance;
    let contractManager: ContractManagerInstance;
    let skaleVerifier: SkaleVerifierInstance;

    const publicKeyArray = [
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
    ];

    const BlsSignature = [
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
    ];

    const HashA = "1122334455667788990011223344556677889900112233445566778899001122";
    const HashB = "1122334455667788990011223344556677889900112233445566778899001122";
    const Counter = 0;

    describe("MessageProxyForMainnet for mainnet", async () => {
        beforeEach(async () => {
            contractManager = await ContractManager.new({from: deployer});
            skaleVerifier = await SkaleVerifier.new({from: deployer});
            await contractManager.setContractsAddress("SkaleVerifier", skaleVerifier.address, {from: deployer});
            messageProxyForMainnet = await MessageProxyForMainnet.new("Mainnet", contractManager.address,
                {from: deployer});
            lockAndDataForMainnet = await LockAndDataForMainnet.new({from: deployer});
        });

        it("should detect registration state by `isConnectedChain` function", async () => {
            const someCainID = randomString(10);
            const isConnectedChain = await messageProxyForMainnet.isConnectedChain(someCainID);
            isConnectedChain.should.be.deep.equal(Boolean(false));
            await messageProxyForMainnet.addConnectedChain(someCainID, publicKeyArray, {from: deployer});
            const connectedChain = await messageProxyForMainnet.isConnectedChain(someCainID);
            connectedChain.should.be.deep.equal(Boolean(true));

            // main net does not have a public key and is implicitly connected:
            await messageProxyForMainnet.isConnectedChain("Mainnet").should.be.rejected;
        });

        it("should add connected chain", async () => {
            const chainID = randomString(10);
            await messageProxyForMainnet.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            const isConnectedChain = await messageProxyForMainnet.isConnectedChain(chainID);
            isConnectedChain.should.be.deep.equal(Boolean(true));

            // chain can't be connected twice:
            await messageProxyForMainnet.addConnectedChain(chainID, publicKeyArray, {from: deployer})
            .should.be.rejectedWith("Chain is already connected");

            // main net does not have a public key and is implicitly connected:
            await messageProxyForMainnet.addConnectedChain("Mainnet", publicKeyArray, {from: deployer})
            .should.be.rejectedWith("SKALE chain name is incorrect. Inside in MessageProxy");
        });

        it("should remove connected chain", async () => {
            const chainID = randomString(10);
            await messageProxyForMainnet.addConnectedChain(chainID, publicKeyArray, {from: deployer});
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

            await messageProxyForMainnet.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            await messageProxyForMainnet
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer});
            const outgoingMessagesCounter = new BigNumber(
                await messageProxyForMainnet.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

        it("should post incoming messages", async () => {
            const chainID = randomString(10);
            tokenManager1 = await TokenManager.new(chainID, messageProxyForMainnet.address,
                lockAndDataForMainnet.address, {from: deployer});
            tokenManager2 = await TokenManager.new(chainID, messageProxyForMainnet.address,
                lockAndDataForMainnet.address, {from: deployer});
            const startingCounter = 0;

            const message1 = {
                amount: 3,
                data: "0x11",
                destinationContract: tokenManager1.address,
                sender: deployer,
                to: client};

            const message2 = {
                amount: 7,
                data: "0x22",
                destinationContract: tokenManager2.address,
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

            await messageProxyForMainnet.addConnectedChain(chainID, publicKeyArray, {from: deployer});

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

            await messageProxyForMainnet.addConnectedChain(chainID, publicKeyArray, {from: deployer});

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
            tokenManager1 = await TokenManager.new(chainID, messageProxyForMainnet.address,
                lockAndDataForMainnet.address, {from: deployer});
            tokenManager2 = await TokenManager.new(chainID, messageProxyForMainnet.address,
                lockAndDataForMainnet.address, {from: deployer});
            const startingCounter = 0;
            const message1 = {
                amount: 3,
                data: "0x11",
                destinationContract: tokenManager1.address,
                sender: deployer,
                to: client};
            const message2 = {
                amount: 7,
                data: "0x22",
                destinationContract: tokenManager2.address,
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

            await messageProxyForMainnet.addConnectedChain(chainID, publicKeyArray, {from: deployer});

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
            await messageProxyForMainnet.addConnectedChain(chainID, publicKeyArray, {from: deployer});
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
            tokenManager1 = await TokenManager.new(chainID, messageProxyForMainnet.address,
                lockAndDataForMainnet.address, {from: deployer});
            tokenManager2 = await TokenManager.new(chainID, messageProxyForMainnet.address,
                lockAndDataForMainnet.address, {from: deployer});
            const startingCounter = 0;
            const message1 = {
                amount: 3,
                data: "0x11",
                destinationContract: tokenManager1.address,
                sender: deployer,
                to: client};
            const message2 = {
                amount: 7,
                data: "0x22",
                destinationContract: tokenManager2.address,
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

            await messageProxyForMainnet.addConnectedChain(chainID, publicKeyArray, {from: deployer});

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
        beforeEach(async () => {
            messageProxyForSchain = await MessageProxyForSchain.new("MyChain", contractManager.address,
                {from: deployer});
            lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
        });

        it("should detect registration state by `isConnectedChain` function", async () => {
            const someCainID = randomString(10);
            const isConnectedChain = await messageProxyForSchain.isConnectedChain(someCainID);
            isConnectedChain.should.be.deep.equal(Boolean(false));
            await messageProxyForSchain.addConnectedChain(someCainID, publicKeyArray, {from: deployer});
            const connectedChain = await messageProxyForSchain.isConnectedChain(someCainID);
            connectedChain.should.be.deep.equal(Boolean(true));

            // main net does not have a public key and is implicitly connected:
            await messageProxyForSchain.isConnectedChain("Mainnet").should.be.rejected;
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
            await messageProxyForSchain.addConnectedChain("Mainnet", publicKeyArray, {from: deployer})
            .should.be.rejectedWith("SKALE chain name is incorrect. Inside in MessageProxy");
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

        it("should post incoming messages", async () => {
            const chainID = randomString(10);
            tokenManager1 = await TokenManager.new(chainID, messageProxyForSchain.address,
                lockAndDataForSchain.address, {from: deployer});
            tokenManager2 = await TokenManager.new(chainID, messageProxyForSchain.address,
                lockAndDataForSchain.address, {from: deployer});
            const startingCounter = 0;
            const message1 = {
                amount: 3,
                data: "0x11",
                destinationContract: tokenManager1.address,
                sender: deployer,
                to: client};
            const message2 = {
                amount: 7,
                data: "0x22",
                destinationContract: tokenManager2.address,
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
            await messageProxyForSchain.postIncomingMessages(
                chainID,
                startingCounter,
                messages,
                sign,
                0,
                {from: deployer},
            ).should.be.rejected;

            await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            await messageProxyForSchain.postIncomingMessages(
                chainID,
                startingCounter,
                messages,
                sign,
                0,
                {from: deployer},
            );
            const incomingMessagesCounter = new BigNumber(
                await messageProxyForSchain.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));
        });

        it("should get outgoing messages counter", async () => {
            const chainID = randomString(10);
            const contractAddress = lockAndDataForSchain.address;
            const amount = 5;
            const addressTo = client;
            const bytesData = "0x0";

            // chain should be inited:
            await messageProxyForSchain.getOutgoingMessagesCounter(chainID).should.be.rejected;

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

        it("should get incoming messages counter", async () => {
            const chainID = randomString(10);
            tokenManager1 = await TokenManager.new(chainID, messageProxyForSchain.address,
                lockAndDataForSchain.address, {from: deployer});
            tokenManager2 = await TokenManager.new(chainID, messageProxyForSchain.address,
                lockAndDataForSchain.address, {from: deployer});
            const startingCounter = 0;
            const message1 = {
                amount: 3,
                data: "0x11",
                destinationContract: tokenManager1.address,
                sender: deployer,
                to: client};
            const message2 = {
                amount: 7,
                data: "0x22",
                destinationContract: tokenManager2.address,
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
            await messageProxyForSchain.getIncomingMessagesCounter(chainID).should.be.rejected;

            await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            const incomingMessagesCounter0 = new BigNumber(
                await messageProxyForSchain.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxyForSchain.postIncomingMessages(
                chainID,
                startingCounter,
                messages,
                sign,
                0,
                {from: deployer},
            );
            const incomingMessagesCounter = new BigNumber(
                await messageProxyForSchain.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));
        });

        it("should rejected with `Sender is not an owner` when invoke `addAuthorizedCaller`", async () => {
            // preparation
            const error = "Sender is not an owner";
            const caller = user;
            // execution/expectation
            await messageProxyForSchain
              .addAuthorizedCaller(caller, {from: caller})
              .should.be.eventually.rejectedWith(error);
        });

        it("should rejected with `Sender is not an owner` when invoke `removeAuthorizedCaller`", async () => {
            // preparation
            const error = "Sender is not an owner";
            const caller = user;
            // execution/expectation
            await messageProxyForSchain
              .removeAuthorizedCaller(caller, {from: caller})
              .should.be.eventually.rejectedWith(error);
        });

        it("should work `addAuthorizedCaller`", async () => {
            // preparation
            const caller = user;
            // execution
            await messageProxyForSchain
              .addAuthorizedCaller(caller, {from: deployer});
            // expectation
            // const res = await messageProxyForSchain.authorizedCaller(caller); // Main Net
            const res = await messageProxyForSchain.checkIsAuthorizedCaller(caller) ? true : false; // S-Chain
            // console.log("res", res);
            expect(res).to.be.true;
        });

        it("should work `removeAuthorizedCaller`", async () => {
            // preparation
            const caller = user;
            await messageProxyForSchain
              .addAuthorizedCaller(caller, {from: deployer});
            // execution
            await messageProxyForSchain
              .removeAuthorizedCaller(caller, {from: deployer});
            // expectation
            // const res = await messageProxyForSchain.authorizedCaller(caller); // Main Net
            const res = await messageProxyForSchain.checkIsAuthorizedCaller(caller) ? true : false; // S-Chain
            // console.log("res", res);
            expect(res).to.be.false;
        });
    });
});
