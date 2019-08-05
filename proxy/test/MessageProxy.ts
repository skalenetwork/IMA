import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");
import { MessageProxyContract,
    MessageProxyInstance,
    TokenManagerContract,
    TokenManagerInstance,
    LockAndDataForMainnetContract,
    LockAndDataForMainnetInstance,
} from "../types/truffle-contracts";
import { gasMultiplier } from "./utils/command_line";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");
const TokenManager: TokenManagerContract = artifacts.require("./TokenManager");
const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnet");

contract("MessageProxy", ([user, deployer, client, customer]) => {
    let messageProxy: MessageProxyInstance;
    let tokenManager1: TokenManagerInstance;
    let tokenManager2: TokenManagerInstance;
    let lockAndDataForMainnet: LockAndDataForMainnetInstance;

    const publicKeyArray = [
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
    ];

    describe("MessageProxy for mainnet", async () => {
        beforeEach(async () => {
            messageProxy = await MessageProxy.new("Mainnet", {from: deployer, gas: 8000000 * gasMultiplier});
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
            const senders = [deployer, user];
            const contracts = [tokenManager1.address,
            tokenManager2.address];
            const addressTo = [client, customer];
            const amount = [3, 7];
            const data = "0x1122";
            const lenthOfData = [1, 1];

            // chain should be inited:
            await messageProxy
                .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo, amount, data, lenthOfData, {from: deployer})
                .should.be.rejected;

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            // amount of senders should be equal to amount of contracts:
            const sender = [deployer];
            await messageProxy
                .postIncomingMessages(chainID, startingCounter, sender, contracts,
                addressTo, amount, data, lenthOfData, {from: deployer})
                .should.be.rejected;

            // amount of receivers should be equal to amount of contracts:
            const addressTo1 = [client];
            await messageProxy
                .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo1, amount, data, lenthOfData, {from: deployer})
                .should.be.rejected;

            // amount of receivers should be equal to amount of transferred eth:
            const amount1 = [3];
            await messageProxy
                .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo, amount1, data, lenthOfData, {from: deployer})
                .should.be.rejected;

            // amount of data lengths should be equal to amount of transferred eth:
            const lenthOfData1 = [1];
            await messageProxy
                .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo, amount, data, lenthOfData1, {from: deployer})
                .should.be.rejected;

            // starting counter should be equal to incoming meggages counter of this chain:
            const startingCounter1 = 1;
            await messageProxy
                .postIncomingMessages(chainID, startingCounter1, senders, contracts,
                addressTo, amount, data, lenthOfData, {from: deployer})
                .should.be.rejected;

            await messageProxy
            .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo, amount, data, lenthOfData, {from: deployer});
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
            const senders = [deployer, user];
            const contracts = [tokenManager1.address,
            tokenManager2.address];
            const addressTo = [client, customer];
            const amount = [3, 7];
            const data = "0x1122";
            const lenthOfData = [1, 1];

            // chain should be inited:
            await messageProxy.getIncomingMessagesCounter(chainID).should.be.rejected;

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            const incomingMessagesCounter0 = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxy
            .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo, amount, data, lenthOfData, {from: deployer});
            const incomingMessagesCounter = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));
        });
    });

    describe("MessageProxy for schain", async () => {
        beforeEach(async () => {
            messageProxy = await MessageProxy.new("MyChain", {from: deployer, gas: 8000000 * gasMultiplier});
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
            const senders = [deployer, user];
            const contracts = [tokenManager1.address,
            tokenManager2.address];
            const addressTo = [client, customer];
            const amount = [3, 7];
            const data = "0x1122";
            const lenthOfData = [1, 1];

            // chain should be inited:
            await messageProxy
                .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo, amount, data, lenthOfData, {from: deployer})
                .should.be.rejected;

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            // amount of senders should be equal to amount of contracts:
            const sender = [deployer];
            await messageProxy
                .postIncomingMessages(chainID, startingCounter, sender, contracts,
                addressTo, amount, data, lenthOfData, {from: deployer})
                .should.be.rejected;

            // amount of receivers should be equal to amount of contracts:
            const addressTo1 = [client];
            await messageProxy
                .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo1, amount, data, lenthOfData, {from: deployer})
                .should.be.rejected;

            // amount of receivers should be equal to amount of transferred eth:
            const amount1 = [3];
            await messageProxy
                .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo, amount1, data, lenthOfData, {from: deployer})
                .should.be.rejected;

            // amount of data lengths should be equal to amount of transferred eth:
            const lenthOfData1 = [1];
            await messageProxy
                .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo, amount, data, lenthOfData1, {from: deployer})
                .should.be.rejected;

            // starting counter should be equal to incoming meggages counter of this chain:
            const startingCounter1 = 1;
            await messageProxy
                .postIncomingMessages(chainID, startingCounter1, senders, contracts,
                addressTo, amount, data, lenthOfData, {from: deployer})
                .should.be.rejected;

            await messageProxy
                .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo, amount, data, lenthOfData, {from: deployer});
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
            const senders = [deployer, user];
            const contracts = [tokenManager1.address,
            tokenManager2.address];
            const addressTo = [client, customer];
            const amount = [3, 7];
            const data = "0x1122";
            const lenthOfData = [1, 1];

            // chain should be inited:
            await messageProxy.getIncomingMessagesCounter(chainID).should.be.rejected;

            await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

            const incomingMessagesCounter0 = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter0.should.be.deep.equal(new BigNumber(0));

            await messageProxy
                .postIncomingMessages(chainID, startingCounter, senders, contracts,
                addressTo, amount, data, lenthOfData, {from: deployer});
            const incomingMessagesCounter = new BigNumber(await messageProxy.getIncomingMessagesCounter(chainID));
            incomingMessagesCounter.should.be.deep.equal(new BigNumber(2));
        });
    });
});
