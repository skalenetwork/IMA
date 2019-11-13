import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");
import {
    LockAndDataForMainnetContract,
    LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainInstance,
    MessageProxyContract,
    MessageProxyInstance,
    TokenManagerContract,
    TokenManagerInstance,
} from "../types/truffle-contracts";

import * as jsonData from "../data/skaleManagerComponents.json";
import { gasMultiplier } from "./utils/command_line";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");
const TokenManager: TokenManagerContract = artifacts.require("./TokenManager");
const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnet");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");

contract("MessageProxy", ([user, deployer, client, customer]) => {
    let messageProxy: MessageProxyInstance;
    let tokenManager1: TokenManagerInstance;
    let tokenManager2: TokenManagerInstance;
    let lockAndDataForMainnet: LockAndDataForMainnetInstance;
    let lockAndDataForSchain: LockAndDataForSchainInstance;

    const publicKeyArray = [
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
    ];

    const blsSignature = [
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
    ];

    const hashA = "1122334455667788990011223344556677889900112233445566778899001122";
    const hashB = "1122334455667788990011223344556677889900112233445566778899001122";
    const counter = 0;

    describe("MessageProxy for mainnet", async () => {
        beforeEach(async () => {
            messageProxy = await MessageProxy.new("Mainnet", jsonData.contract_manager_address,
                {from: deployer, gas: 8000000 * gasMultiplier});
            lockAndDataForMainnet = await LockAndDataForMainnet.new({from: deployer, gas: 8000000 * gasMultiplier});
        });

        it("should detect registration state by `isConnectedChain` function", async () => {
            const someCainID = randomString(10);
            const isConnectedChain = await messageProxy.isConnectedChain(someCainID);
            isConnectedChain.should.be.deep.equal(Boolean(false));
            await messageProxy.addConnectedChain(someCainID, publicKeyArray, {from: deployer});
            const connectedChain = await messageProxy.isConnectedChain(someCainID);
            connectedChain.should.be.deep.equal(Boolean(true));

            // main net does not have a public key and is implicitly connected:
            await messageProxy.isConnectedChain("Mainnet").should.be.rejected;
        });

        it("should add connected chain", async () => {
            const chainID = randomString(10);
            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            const isConnectedChain = await messageProxy.isConnectedChain(chainID);
            isConnectedChain.should.be.deep.equal(Boolean(true));

            // chain can't be connected twice:
            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer})
            .should.be.rejectedWith("Chain is aready connected");

            // main net does not have a public key and is implicitly connected:
            await messageProxy.addConnectedChain("Mainnet", publicKeyArray, {from: deployer})
            .should.be.rejectedWith("SKALE chain name is incorrect. Inside in MessageProxy");
        });

        it("should remove connected chain", async () => {
            const chainID = randomString(10);
            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            const connectedChain = await messageProxy.isConnectedChain(chainID);
            connectedChain.should.be.deep.equal(Boolean(true));

            // only owner can remove chain:
            await messageProxy.removeConnectedChain(chainID, {from: user}).should.be.rejected;

            // main net can't be removed:
            await messageProxy.removeConnectedChain("Mainnet", {from: deployer}).should.be.rejected;

            await messageProxy.removeConnectedChain(chainID, {from: deployer});
            const notConnectedChain = await messageProxy.isConnectedChain(chainID);
            notConnectedChain.should.be.deep.equal(Boolean(false));
        });

        it("should post outgoing message", async () => {
            const chainID = randomString(10);
            const contractAddress = messageProxy.address;
            const amount = 4;
            const addressTo = user;
            const bytesData = "0x0";

            await messageProxy
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer})
            .should.be.rejectedWith("Destination chain is not initialized");

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            await messageProxy
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer});
            const outgoingMessagesCounter = new BigNumber(await messageProxy.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

        it("should post incoming messages", async () => {
            const chainID = randomString(10);
            tokenManager1 = await TokenManager.new(chainID, messageProxy.address,
                lockAndDataForMainnet.address, {from: deployer, gas: 8000000 * gasMultiplier});
            tokenManager2 = await TokenManager.new(chainID, messageProxy.address,
                lockAndDataForMainnet.address, {from: deployer, gas: 8000000 * gasMultiplier});
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

            // chain should be inited:
            await messageProxy
                .postIncomingMessages(
                    chainID,
                    startingCounter,
                    messages,
                    blsSignature,
                    hashA,
                    hashB,
                    counter,
                    {from: deployer},
                ).should.be.rejected;

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            await messageProxy
            .postIncomingMessages(
                chainID,
                startingCounter,
                messages,
                blsSignature,
                hashA,
                hashB,
                counter,
                {from: deployer},
            );
            const incomingMessagesCounter = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));
        });

        it("should get outgoing messages counter", async () => {
            const chainID = randomString(10);
            const contractAddress = lockAndDataForMainnet.address;
            const amount = 5;
            const addressTo = client;
            const bytesData = "0x0";

            // chain should be inited:
            await messageProxy.getOutgoingMessagesCounter(chainID).should.be.rejected;

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            const outgoingMessagesCounter0 = new BigNumber(await messageProxy.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxy
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer});

            const outgoingMessagesCounter = new BigNumber(await messageProxy.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

        it("should get incoming messages counter", async () => {
            const chainID = randomString(10);
            tokenManager1 = await TokenManager.new(chainID, messageProxy.address,
                lockAndDataForMainnet.address, {from: deployer, gas: 8000000 * gasMultiplier});
            tokenManager2 = await TokenManager.new(chainID, messageProxy.address,
                lockAndDataForMainnet.address, {from: deployer, gas: 8000000 * gasMultiplier});
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

            // chain should be inited:
            await messageProxy.getIncomingMessagesCounter(chainID).should.be.rejected;

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            const incomingMessagesCounter0 = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxy
            .postIncomingMessages(
                chainID,
                startingCounter,
                messages,
                blsSignature,
                hashA,
                hashB,
                counter,
                {from: deployer},
            );
            const incomingMessagesCounter = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));
        });

        it("should move incoming counter", async () => {
            const chainID = randomString(10);
            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            const isConnectedChain = await messageProxy.isConnectedChain(chainID);
            isConnectedChain.should.be.deep.equal(Boolean(true));

            // chain can't be connected twice:
            const incomingMessages = new BigNumber(
                await messageProxy.getIncomingMessagesCounter(chainID, {from: deployer}),
            );

            // main net does not have a public key and is implicitly connected:
            await messageProxy.moveIncomingCounter(chainID, {from: deployer});

            const newIncomingMessages = new BigNumber(
                await messageProxy.getIncomingMessagesCounter(chainID, {from: deployer}),
            );

            newIncomingMessages.should.be.deep.equal(BigNumber.sum(incomingMessages, 1));
        });

        it("should get incoming messages counter", async () => {
            const chainID = randomString(10);
            tokenManager1 = await TokenManager.new(chainID, messageProxy.address,
                lockAndDataForMainnet.address, {from: deployer, gas: 8000000 * gasMultiplier});
            tokenManager2 = await TokenManager.new(chainID, messageProxy.address,
                lockAndDataForMainnet.address, {from: deployer, gas: 8000000 * gasMultiplier});
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

            // chain should be inited:
            await messageProxy.getIncomingMessagesCounter(chainID).should.be.rejected;

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            const incomingMessagesCounter0 = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxy
            .postIncomingMessages(
                chainID,
                startingCounter,
                messages,
                blsSignature,
                hashA,
                hashB,
                counter,
                {from: deployer},
            );
            const incomingMessagesCounter = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));

            const amount = 5;
            const addressTo = client;
            const bytesData = "0x0";

            const outgoingMessagesCounter0 = new BigNumber(await messageProxy.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxy.postOutgoingMessage(
                chainID,
                lockAndDataForMainnet.address,
                amount,
                addressTo,
                bytesData,
                {from: deployer},
            );

            const outgoingMessagesCounter = new BigNumber(await messageProxy.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));

            await messageProxy.setCountersToZero(chainID, {from: deployer});

            const newIncomingMessagesCounter = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            newIncomingMessagesCounter.should.be.deep.equal(new BigNumber(0));

            const newOutgoingMessagesCounter = new BigNumber(await messageProxy.getOutgoingMessagesCounter(chainID));
            newOutgoingMessagesCounter.should.be.deep.equal(new BigNumber(0));
        });

    });

    describe("MessageProxy for schain", async () => {
        beforeEach(async () => {
            messageProxy = await MessageProxy.new("MyChain", jsonData.contract_manager_address,
                {from: deployer, gas: 8000000 * gasMultiplier});
            lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
        });

        it("should detect registration state by `isConnectedChain` function", async () => {
            const someCainID = randomString(10);
            const isConnectedChain = await messageProxy.isConnectedChain(someCainID);
            isConnectedChain.should.be.deep.equal(Boolean(false));
            await messageProxy.addConnectedChain(someCainID, publicKeyArray, {from: deployer});
            const connectedChain = await messageProxy.isConnectedChain(someCainID);
            connectedChain.should.be.deep.equal(Boolean(true));

            // main net does not have a public key and is implicitly connected:
            await messageProxy.isConnectedChain("Mainnet").should.be.rejected;
        });

        it("should add connected chain", async () => {
            const chainID = randomString(10);
            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            const isConnectedChain = await messageProxy.isConnectedChain(chainID);
            isConnectedChain.should.be.deep.equal(Boolean(true));

            // chain can't be connected twice:
            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer})
            .should.be.rejectedWith("Chain is aready connected");

            // main net does not have a public key and is implicitly connected:
            await messageProxy.addConnectedChain("Mainnet", publicKeyArray, {from: deployer})
            .should.be.rejectedWith("SKALE chain name is incorrect. Inside in MessageProxy");
        });

        it("should remove connected chain", async () => {
            const chainID = randomString(10);
            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            const connectedChain = await messageProxy.isConnectedChain(chainID);
            connectedChain.should.be.deep.equal(Boolean(true));

            // only owner can remove chain:
            await messageProxy.removeConnectedChain(chainID, {from: user}).should.be.rejected;

            // main net can't be removed:
            await messageProxy.removeConnectedChain("Mainnet", {from: deployer}).should.be.rejected;

            await messageProxy.removeConnectedChain(chainID, {from: deployer});
            const notConnectedChain = await messageProxy.isConnectedChain(chainID);
            notConnectedChain.should.be.deep.equal(Boolean(false));
        });

        it("should post outgoing message", async () => {
            const chainID = randomString(10);
            const contractAddress = messageProxy.address;
            const amount = 4;
            const addressTo = user;
            const bytesData = "0x0";

            await messageProxy
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer})
            .should.be.rejectedWith("Destination chain is not initialized");

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});
            await messageProxy
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer});
            const outgoingMessagesCounter = new BigNumber(await messageProxy.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

        it("should post incoming messages", async () => {
            const chainID = randomString(10);
            tokenManager1 = await TokenManager.new(chainID, messageProxy.address,
                lockAndDataForSchain.address, {from: deployer, gas: 8000000 * gasMultiplier});
            tokenManager2 = await TokenManager.new(chainID, messageProxy.address,
                lockAndDataForSchain.address, {from: deployer, gas: 8000000 * gasMultiplier});
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

            // chain should be inited:
            await messageProxy.postIncomingMessages(
                chainID,
                startingCounter,
                messages,
                blsSignature,
                hashA,
                hashB,
                counter,
                {from: deployer},
            ).should.be.rejected;

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            await messageProxy.postIncomingMessages(
                chainID,
                startingCounter,
                messages,
                blsSignature,
                hashA,
                hashB,
                counter,
                {from: deployer},
            );
            const incomingMessagesCounter = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));
        });

        it("should get outgoing messages counter", async () => {
            const chainID = randomString(10);
            const contractAddress = lockAndDataForSchain.address;
            const amount = 5;
            const addressTo = client;
            const bytesData = "0x0";

            // chain should be inited:
            await messageProxy.getOutgoingMessagesCounter(chainID).should.be.rejected;

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            const outgoingMessagesCounter0 = new BigNumber(await messageProxy.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxy
            .postOutgoingMessage(chainID, contractAddress, amount, addressTo, bytesData, {from: deployer});

            const outgoingMessagesCounter = new BigNumber(await messageProxy.getOutgoingMessagesCounter(chainID));
            outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
        });

        it("should get incoming messages counter", async () => {
            const chainID = randomString(10);
            tokenManager1 = await TokenManager.new(chainID, messageProxy.address,
                lockAndDataForSchain.address, {from: deployer, gas: 8000000 * gasMultiplier});
            tokenManager2 = await TokenManager.new(chainID, messageProxy.address,
                lockAndDataForSchain.address, {from: deployer, gas: 8000000 * gasMultiplier});
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

            // chain should be inited:
            await messageProxy.getIncomingMessagesCounter(chainID).should.be.rejected;

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            const incomingMessagesCounter0 = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxy.postIncomingMessages(
                chainID,
                startingCounter,
                messages,
                blsSignature,
                hashA,
                hashB,
                counter,
                {from: deployer},
            );
            const incomingMessagesCounter = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));
        });

        it("should rejected with `Sender is not an owner` when invoke `addAuthorizedCaller`", async () => {
            // preparation
            const error = "Sender is not an owner";
            const caller = user;
            // execution/expectation
            await messageProxy
              .addAuthorizedCaller(caller, {from: caller})
              .should.be.eventually.rejectedWith(error);
        });

        it("should rejected with `Sender is not an owner` when invoke `removeAuthorizedCaller`", async () => {
            // preparation
            const error = "Sender is not an owner";
            const caller = user;
            // execution/expectation
            await messageProxy
              .removeAuthorizedCaller(caller, {from: caller})
              .should.be.eventually.rejectedWith(error);
        });

        it("should work `addAuthorizedCaller`", async () => {
            // preparation
            const caller = user;
            // execution
            await messageProxy
              .addAuthorizedCaller(caller, {from: deployer});
            // expectation
            const res = await messageProxy.authorizedCaller(caller);
            // console.log("res", res);
            expect(res).to.be.true;
        });

        it("should work `removeAuthorizedCaller`", async () => {
            // preparation
            const caller = user;
            await messageProxy
              .addAuthorizedCaller(caller, {from: deployer});
            // execution
            await messageProxy
              .removeAuthorizedCaller(caller, {from: deployer});
            // expectation
            const res = await messageProxy.authorizedCaller(caller);
            // console.log("res", res);
            expect(res).to.be.false;
        });
    });
});
