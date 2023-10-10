import chaiAsPromised from "chai-as-promised";
import {
    ContractManager,
    Linker,
    MessageProxyForMainnet,
    MessageProxyForMainnetTester,
    CommunityPool,
    MessagesTester
} from "../typechain";

import { stringKeccak256, getBalance } from "./utils/helper";

import chai = require("chai");
import chaiAlmost = require("chai-almost");

chai.should();
chai.use(chaiAsPromised);
chai.use(chaiAlmost(0.000000000002));

import { initializeSchain } from "./utils/skale-manager-utils/schainsInternal";


import { deployLinker } from "./utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployMessageProxyForMainnetTester } from "./utils/deploy/test/messageProxyForMainnetTester";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { deployCommunityPool } from "./utils/deploy/mainnet/communityPool";
import { deployCommunityPoolTester } from "./utils/deploy/test/communityPoolTester";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { deployMessages } from "./utils/deploy/messages";

describe("CommunityPool", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let node: SignerWithAddress;

    let contractManager: ContractManager;
    let messageProxy: MessageProxyForMainnet;
    let linker: Linker;
    let communityPool: CommunityPool;
    let messages: MessagesTester;
    const contractManagerAddress = "0x0000000000000000000000000000000000000000";
    const schainName = "Schain";
    const schainName2 = "Schain2";
    let minTransactionGas: BigNumber;

    before(async () => {
        [deployer, user, node] = await ethers.getSigners();
    });

    beforeEach(async () => {
        contractManager = await deployContractManager(contractManagerAddress);
        messageProxy = await deployMessageProxyForMainnet(contractManager);
        linker = await deployLinker(contractManager, messageProxy);
        communityPool = await deployCommunityPool(contractManager, linker, messageProxy);
        minTransactionGas = await communityPool.minTransactionGas();
        messages = await deployMessages();

        const CHAIN_CONNECTOR_ROLE = await messageProxy.CHAIN_CONNECTOR_ROLE();
        await messageProxy.grantRole(CHAIN_CONNECTOR_ROLE, deployer.address);
        const EXTRA_CONTRACT_REGISTRAR_ROLE = await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxy.grantRole(EXTRA_CONTRACT_REGISTRAR_ROLE, deployer.address);
    });


    it("should add link to contract on schain", async () => {
        const fakeContractOnSchain = user.address;
        const nullAddress = "0x0000000000000000000000000000000000000000";
        const schainHash = stringKeccak256(schainName);

        await communityPool.getSchainContract(schainHash)
            .should.be.eventually.rejectedWith("Destination contract must be defined");

        await communityPool.addSchainContract(schainName, fakeContractOnSchain)
            .should.be.eventually.rejectedWith("Not authorized caller");

        await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
        await communityPool.addSchainContract(schainName, nullAddress)
            .should.be.eventually.rejectedWith("Incorrect address of contract receiver on Schain");

        await communityPool.addSchainContract(schainName, fakeContractOnSchain);

        expect(await communityPool.hasSchainContract(schainName)).to.be.true;
        await communityPool.addSchainContract(schainName, fakeContractOnSchain)
            .should.be.eventually.rejectedWith("SKALE chain is already set");
    });

    it("should remove link to contract on schain", async () => {
        const fakeContractOnSchain = user.address;
        await initializeSchain(contractManager, schainName, user.address, 1, 1);
        await communityPool.connect(user).addSchainContract(schainName, fakeContractOnSchain);
        expect(await communityPool.hasSchainContract(schainName)).to.be.true;
        await communityPool.removeSchainContract(schainName)
            .should.be.eventually.rejectedWith("Not authorized caller");

        await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
        await communityPool.removeSchainContract(schainName);

        expect(await communityPool.hasSchainContract(schainName)).to.be.false;
        await communityPool.removeSchainContract(schainName)
            .should.be.eventually.rejectedWith("SKALE chain is not set");
    });

    it("should add and remove link to contract on schain as LINKER_ROLE", async () => {
        const fakeContractOnSchain = user.address;
        const LINKER_ROLE = await communityPool.LINKER_ROLE();
        await communityPool.grantRole(LINKER_ROLE, user.address);
        await communityPool.connect(user).addSchainContract(schainName, fakeContractOnSchain);
        expect(await communityPool.hasSchainContract(schainName)).to.be.true;
        await communityPool.connect(user).removeSchainContract(schainName);
        expect(await communityPool.hasSchainContract(schainName)).to.be.false;
        await communityPool.connect(user).removeSchainContract(schainName)
            .should.be.eventually.rejectedWith("SKALE chain is not set");
    });

    describe("when CommunityPool linked to mocking CommunityLocker", async () => {
        let mockContractOnSchain: string;

        beforeEach(async () => {
            mockContractOnSchain = node.address;
            await communityPool.grantRole(await communityPool.LINKER_ROLE(), deployer.address);
            await communityPool.addSchainContract(schainName, mockContractOnSchain);
        });

        it("should not allow to withdraw from user wallet if CommunityPool is not registered for all chains", async () => {
            const extraContractRegistrarRole = await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE();
            await messageProxy.grantRole(extraContractRegistrarRole, deployer.address);
            await messageProxy.registerExtraContractForAll(communityPool.address);
            const tx = await messageProxy.addConnectedChain(schainName);
            const wei = minTransactionGas.mul(tx.gasPrice as BigNumber);
            await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: wei.toString() });
            await messageProxy.removeExtraContractForAll(communityPool.address);
            await communityPool.connect(user).withdrawFunds(schainName, wei.toString())
                .should.be.eventually.rejectedWith("Sender contract is not registered");
        });

        describe("when chain connected and contract registered", async () => {
            let gasPrice: BigNumber;
            beforeEach(async () => {
                await messageProxy.registerExtraContract(schainName, communityPool.address);
                gasPrice = ((await messageProxy.addConnectedChain(schainName)).gasPrice) as BigNumber;
            });

            it("should not allow to withdraw from user wallet if CommunityPool is not registered", async () => {
                const amount = minTransactionGas.mul(gasPrice);
                await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: amount.toString() });
                await messageProxy.removeExtraContract(schainName, communityPool.address);
                await communityPool.connect(user).withdrawFunds(schainName, amount.toString())
                    .should.be.eventually.rejectedWith("Sender contract is not registered");
            });

            it("should revert if user recharged not enough money for most costly transaction", async () => {
                const amount = minTransactionGas.mul(gasPrice).sub(1);
                await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: amount.toString(), gasPrice })
                    .should.be.eventually.rejectedWith("Not enough ETH for transaction");
            });

            it("should recharge wallet if user passed enough money", async () => {
                const amount = minTransactionGas.mul(gasPrice);
                await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: amount.toString(), gasPrice });
                let userBalance = await communityPool.getBalance(user.address, schainName);
                userBalance.should.be.deep.equal(amount);
                await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: amount.toString(), gasPrice });
                userBalance = await communityPool.getBalance(user.address, schainName);
                userBalance.should.be.deep.equal(amount.mul(2));
                expect(BigNumber.from(await messageProxy.getOutgoingMessagesCounter(schainName)).toString()).to.be.equal(BigNumber.from(1).toString());
            });

        it("should recharge wallet if user passed enough money with basefee", async () => {
            const blockNumber = await ethers.provider.getBlockNumber();
            const baseFeePerGas = (await ethers.provider.getBlock(blockNumber)).baseFeePerGas;
            const baseFeeCandidate = (baseFeePerGas ? baseFeePerGas : new BigNumber(1, "hex"));
            const basefee = baseFeeCandidate.toNumber() === 0 ? BigNumber.from(1) : baseFeeCandidate;
            const amount = minTransactionGas.mul(basefee);
            //
            // comment this check until issue https://github.com/NomicFoundation/hardhat/issues/1688 would be fixed
            //
            // const amount = await communityPool.getRecommendedRechargeAmount(ethers.utils.id(schainName), user.address));
            //
            await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: amount.sub(1).toString(), gasPrice: basefee.toNumber()}).should.be.eventually.rejectedWith("Not enough ETH for transaction");
            await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: amount.toString(), gasPrice: basefee.toNumber()});
            let userBalance = await communityPool.getBalance(user.address, schainName);
            userBalance.should.be.deep.equal(amount);
            await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: amount.toString(), gasPrice: basefee.toNumber()});
            userBalance = await communityPool.getBalance(user.address, schainName);
            userBalance.should.be.deep.equal(amount.mul(2));
            expect(BigNumber.from(await messageProxy.getOutgoingMessagesCounter(schainName)).toString()).to.be.equal(BigNumber.from(1).toString());
        });

            it("should allow to withdraw money", async () => {
                const amount = minTransactionGas.mul(gasPrice).toNumber();
                await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: (amount + 1).toString(), gasPrice });
                expect(BigNumber.from(await messageProxy.getOutgoingMessagesCounter(schainName)).toString()).to.be.equal(BigNumber.from(1).toString());

                await communityPool.connect(user).withdrawFunds(schainName, amount + 2)
                    .should.be.eventually.rejectedWith("Balance is too low");

                const balanceBefore = await getBalance(user.address);
                const tx = await (await communityPool.connect(user).withdrawFunds(schainName, amount, { gasPrice })).wait();
                const balanceAfter = await getBalance(user.address);
                const transactionFee = tx.gasUsed.mul(gasPrice).toNumber();
                (balanceAfter + transactionFee / 1e18).should.be.almost(balanceBefore + amount / 1e18);

                await communityPool.connect(user).withdrawFunds(schainName, 1, { gasPrice });

                expect(BigNumber.from(await messageProxy.getOutgoingMessagesCounter(schainName)).toString()).deep.equal(BigNumber.from(2).toString());
            });
        });

        it("should recharge wallet for couple chains", async () => {
            const schainHash = stringKeccak256(schainName);
            const schainHash2 = stringKeccak256(schainName2);
            const activateUserData = await messages.encodeActivateUserMessage(user.address);

            await communityPool.addSchainContract(schainName2, mockContractOnSchain);
            for (const schain of [schainName, schainName2]) {
                await messageProxy.registerExtraContract(schain, communityPool.address);
                await messageProxy.addConnectedChain(schain);

            }
            const gasPrice = BigNumber.from(1e9);
            const wei = minTransactionGas.mul(gasPrice);
            const wei2 = minTransactionGas.mul(gasPrice).mul(2);
            const res1 = await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: wei.toString(), gasPrice });
            const res2 = await communityPool.connect(user).rechargeUserWallet(schainName2, user.address, { value: wei2.toString(), gasPrice });
            const userBalance = await communityPool.getBalance(user.address, schainName);
            userBalance.should.be.deep.equal(wei);
            const userBalance2 = await communityPool.getBalance(user.address, schainName2);
            userBalance2.should.be.deep.equal(wei2);

            await expect(res1)
                .to.emit(messageProxy, "OutgoingMessage")
                .withArgs(schainHash, 0, communityPool.address, mockContractOnSchain, activateUserData);


            await expect(res2)
                .to.emit(messageProxy, "OutgoingMessage")
                .withArgs(schainHash2, 0, communityPool.address, mockContractOnSchain, activateUserData);

            const res3 = await (await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: wei.toString(), gasPrice })).wait();
            expect(res3.events).to.be.empty;
        });

        it("should allow to withdraw money", async () => {
            await messageProxy.registerExtraContract(schainName, communityPool.address);
            const gasPrice = (await messageProxy.addConnectedChain(schainName)).gasPrice as BigNumber;
            const wei = minTransactionGas.mul(gasPrice).toNumber();
            await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: wei.toString(), gasPrice });
        });

        it("should set new minimal transaction gas", async () => {
            const newMinTransactionGas = BigNumber.from(100);
            const CONSTANT_SETTER_ROLE = await communityPool.CONSTANT_SETTER_ROLE();
            await communityPool.grantRole(CONSTANT_SETTER_ROLE, deployer.address);
            expect(BigNumber.from(await communityPool.minTransactionGas()).toString()).to.be.equal(BigNumber.from(1000000).toString());
            await communityPool.connect(user).setMinTransactionGas(newMinTransactionGas)
                .should.be.eventually.rejectedWith("CONSTANT_SETTER_ROLE is required");
            await communityPool.setMinTransactionGas(newMinTransactionGas);
            expect(BigNumber.from(await communityPool.minTransactionGas()).toString()).to.be.equal(newMinTransactionGas.toString());
        });

        it("should set new multiplier", async () => {
        const newMultipliermultiplierNumeratorr = BigNumber.from(5);
        const newMultiplierDivider = BigNumber.from(4);
        const CONSTANT_SETTER_ROLE  = await communityPool.CONSTANT_SETTER_ROLE();
        await communityPool.grantRole(CONSTANT_SETTER_ROLE, deployer.address);
        expect(BigNumber.from(await communityPool.multiplierNumerator()).toString()).to.be.equal(BigNumber.from(3).toString());
        expect(BigNumber.from(await communityPool.multiplierDivider()).toString()).to.be.equal(BigNumber.from(2).toString());
        await communityPool.connect(user).setMultiplier(newMultipliermultiplierNumeratorr, newMultiplierDivider)
            .should.be.eventually.rejectedWith("CONSTANT_SETTER_ROLE is required");
        await communityPool.setMultiplier(newMultipliermultiplierNumeratorr, 0).should.be.eventually.rejectedWith("Divider is zero");
        await communityPool.setMultiplier(newMultipliermultiplierNumeratorr, newMultiplierDivider);
        expect(BigNumber.from(await communityPool.multiplierNumerator()).toString()).to.be.equal(BigNumber.from(newMultipliermultiplierNumeratorr).toString());
        expect(BigNumber.from(await communityPool.multiplierDivider()).toString()).to.be.equal(BigNumber.from(newMultiplierDivider).toString());
    });

    it("should set rejected when call refundGasByUser not from messageProxy contract", async () => {
            const schainHash = stringKeccak256("Schain");
            await communityPool.connect(deployer).refundGasByUser(schainHash, node.address, user.address, 0)
                .should.be.eventually.rejectedWith("Sender is not a MessageProxy");
        });

        it("should set rejected when call refundGasBySchainWallet not from messageProxy contract", async () => {
            const schainHash = stringKeccak256("Schain");
            await communityPool.connect(deployer).refundGasBySchainWallet(schainHash, node.address, 0)
                .should.be.eventually.rejectedWith("Sender is not a MessageProxy");
        });
    });

    describe("tests for refundGasByUser", async () => {
        let messageProxyTester: MessageProxyForMainnetTester;
        let linkerTester: Linker;
        let communityPoolTester: CommunityPool;
        let mockContractOnSchain: string;
        const schainNameRGBU = "SchainRGBU";
        const schainHashRGBU = stringKeccak256("SchainRGBU");

        beforeEach(async () => {
            messageProxyTester = await deployMessageProxyForMainnetTester(contractManager);
            linkerTester = await deployLinker(contractManager, messageProxyTester);
            communityPoolTester = await deployCommunityPoolTester(contractManager, linkerTester, messageProxyTester);
            mockContractOnSchain = node.address;
            await communityPoolTester.grantRole(await communityPool.LINKER_ROLE(), deployer.address);
            await communityPoolTester.addSchainContract(schainNameRGBU, mockContractOnSchain);
        });

        it("should be rejected with Node address must be set", async () => {
            const tx = await messageProxyTester.addConnectedChain(schainNameRGBU);
            await messageProxyTester.registerExtraContract(schainNameRGBU, communityPoolTester.address);
            const gasPrice = tx.gasPrice as BigNumber;
            const wei = minTransactionGas.mul(gasPrice).mul(2);
            await communityPoolTester.connect(user).rechargeUserWallet(schainNameRGBU, user.address, { value: wei.toString() });
            await messageProxyTester.connect(deployer).refundGasByUser(schainHashRGBU, "0x0000000000000000000000000000000000000000", user.address, 0)
                .should.be.eventually.rejectedWith("Node address must be set");
        });

        it("should refund node", async () => {
            const balanceBefore = await getBalance(node.address);
            const tx = await messageProxyTester.addConnectedChain(schainNameRGBU);
            await messageProxyTester.registerExtraContract(schainNameRGBU, communityPoolTester.address);
            const gasPrice = tx.gasPrice as BigNumber;
            const wei = minTransactionGas.mul(gasPrice).mul(2);
            await communityPoolTester.connect(user).rechargeUserWallet(schainNameRGBU, user.address, { value: wei.toString() });
            await messageProxyTester.connect(deployer).refundGasByUser(schainHashRGBU, node.address, user.address, 1000000, { gasPrice });
            const balanceAfter = await getBalance(node.address);
            (balanceAfter).should.be.almost(balanceBefore + (1000000 * BigNumber.from(gasPrice).toNumber()) / 1e18);
        });

        it("should lock user", async () => {
            const tx = await messageProxyTester.addConnectedChain(schainNameRGBU);
            await messageProxyTester.registerExtraContract(schainNameRGBU, communityPoolTester.address);
            const gasPrice = tx.gasPrice as BigNumber;
            const wei = minTransactionGas.mul(gasPrice);
            expect(await communityPoolTester.activeUsers(user.address, schainHashRGBU)).to.be.false;
            await communityPoolTester.connect(user).rechargeUserWallet(schainNameRGBU, user.address, { value: wei.toString() });
            expect(await communityPoolTester.activeUsers(user.address, schainHashRGBU)).to.be.true;
            await messageProxyTester.connect(deployer).refundGasByUser(schainHashRGBU, node.address, user.address, 1000000, { gasPrice });
            expect(await communityPoolTester.activeUsers(user.address, schainHashRGBU)).to.be.false;
        });

        it("should lock user with extra low balance", async () => {
            const tx = await messageProxyTester.addConnectedChain(schainNameRGBU);
            await messageProxyTester.registerExtraContract(schainNameRGBU, communityPoolTester.address);
            let gasPrice = tx.gasPrice as BigNumber;
            const wei = minTransactionGas.mul(gasPrice);
            gasPrice = gasPrice?.mul(2);
            expect(await communityPoolTester.activeUsers(user.address, schainHashRGBU)).to.be.false;
            await communityPoolTester.connect(user).rechargeUserWallet(schainNameRGBU, user.address, { value: wei.toString() });
            expect(await communityPoolTester.activeUsers(user.address, schainHashRGBU)).to.be.true;
            await messageProxyTester.connect(deployer).refundGasByUser(schainHashRGBU, node.address, user.address, 1000000, { gasPrice });
            expect(await communityPoolTester.activeUsers(user.address, schainHashRGBU)).to.be.false;
        });
    });
});
