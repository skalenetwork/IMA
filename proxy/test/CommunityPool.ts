import chaiAsPromised from "chai-as-promised";
import {
    ContractManager,
    Linker,
    MessageProxyForMainnet,
    CommunityPool
} from "../typechain";
import { randomString } from "./utils/helper";

import chai = require("chai");
import chaiAlmost = require("chai-almost");

chai.should();
chai.use((chaiAsPromised as any));
chai.use(chaiAlmost(0.000000000002));

import { deployLinker } from "./utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { deployCommunityPool } from "./utils/deploy/mainnet/communityPool";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { assert, expect } from "chai";

import { stringValue } from "./utils/helper";

async function getBalance(address: string) {
    return parseFloat(web3.utils.fromWei(await web3.eth.getBalance(address)));
}

describe("CommunityPool", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;

    let contractManager: ContractManager;
    let messageProxy: MessageProxyForMainnet;
    let linker: Linker;
    let communityPool: CommunityPool;
    const contractManagerAddress = "0x0000000000000000000000000000000000000000";
    const schainName = "Schain";
    let minTransactionGas: any;

    before(async () => {
        [deployer, user] = await ethers.getSigners();
    });

    beforeEach(async () => {
        contractManager = await deployContractManager(contractManagerAddress);
        messageProxy = await deployMessageProxyForMainnet(contractManager);
        linker = await deployLinker(messageProxy, contractManager);
        communityPool = await deployCommunityPool(contractManager, linker, messageProxy);
        minTransactionGas = await communityPool.minTransactionGas();
    });

    it("should not allow to withdraw from user wallet if CommunityPool is not registered", async () => {
        await messageProxy.registerExtraContract(schainName, communityPool.address);
        const tx = await messageProxy.addConnectedChain(schainName);
        const wei = minTransactionGas.mul(tx.gasPrice);
        await communityPool.connect(user).rechargeUserWallet(schainName, { value: wei.toString() });
        await messageProxy.removeExtraContract(schainName, communityPool.address);
        await communityPool.connect(user).withdrawFunds(schainName, wei.toString())
            .should.be.eventually.rejectedWith("Sender contract is not registered");
    });

    it("should not allow to withdraw from user wallet if CommunityPool is not registered for all chains", async () => {
        const extraContractRegistrarRole = await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxy.grantRole(extraContractRegistrarRole, deployer.address);
        await messageProxy.registerExtraContractForAll(communityPool.address);
        const tx = await messageProxy.addConnectedChain(schainName);
        const wei = minTransactionGas.mul(tx.gasPrice);
        await communityPool.connect(user).rechargeUserWallet(schainName, { value: wei.toString() });
        await messageProxy.removeExtraContractForAll(communityPool.address);
        await communityPool.connect(user).withdrawFunds(schainName, wei.toString())
            .should.be.eventually.rejectedWith("Sender contract is not registered");
    });

    it("should revert if user recharged not enough money for most costly transaction", async () => {
        await messageProxy.registerExtraContract(schainName, communityPool.address);
        const tx = await messageProxy.addConnectedChain(schainName);
        const gasPrice = tx.gasPrice;
        const wei = minTransactionGas.mul(gasPrice).sub(1);
        await communityPool.connect(user).rechargeUserWallet(schainName, { value: wei.toString(), gasPrice })
            .should.be.eventually.rejectedWith("Not enough money for transaction");
    });

    it("should recharge wallet if user passed enough money", async () => {
        await messageProxy.registerExtraContract(schainName, communityPool.address);
        const tx = await messageProxy.addConnectedChain(schainName);
        const gasPrice = tx.gasPrice;
        const wei = minTransactionGas.mul(gasPrice);
        await communityPool.connect(user).rechargeUserWallet(schainName, { value: wei.toString(), gasPrice });
        const userBalance = await communityPool.connect(user).getBalance(schainName);
        userBalance.should.be.deep.equal(wei);
    });

    it("should recharge wallet for couple chains", async () => {
        await messageProxy.registerExtraContract(schainName, communityPool.address);
        await messageProxy.registerExtraContract("schainName2", communityPool.address);
        const tx = await messageProxy.addConnectedChain(schainName);
        await messageProxy.addConnectedChain("schainName2");
        const gasPrice = tx.gasPrice;
        const wei = minTransactionGas.mul(gasPrice);
        const wei2 = minTransactionGas.mul(gasPrice).mul(2);
        const res1 = await (await communityPool.connect(user).rechargeUserWallet(schainName, { value: wei.toString(), gasPrice })).wait();
        const res2 = await (await communityPool.connect(user).rechargeUserWallet("schainName2", { value: wei2.toString(), gasPrice })).wait();
        const userBalance = await communityPool.connect(user).getBalance(schainName);
        userBalance.should.be.deep.equal(wei);
        const userBalance2 = await communityPool.connect(user).getBalance("schainName2");
        userBalance2.should.be.deep.equal(wei2);

        if (!res1.events) {
            assert("No events were emitted");
        } else {
            const last = res1.events.length - 1;
            expect(res1.events[last]?.topics[0]).to.equal(stringValue(web3.utils.soliditySha3("OutgoingMessage(bytes32,uint256,address,address,bytes)")));
            expect(res1.events[last]?.topics[1]).to.equal(stringValue(web3.utils.soliditySha3(schainName)));
            expect(BigNumber.from(res1.events[last]?.topics[2]).toString()).to.equal("0");
        }

        if (!res2.events) {
            assert("No events were emitted");
        } else {
            const last = res2.events.length - 1;
            expect(res2.events[last]?.topics[0]).to.equal(stringValue(web3.utils.soliditySha3("OutgoingMessage(bytes32,uint256,address,address,bytes)")));
            expect(res2.events[last]?.topics[1]).to.equal(stringValue(web3.utils.soliditySha3("schainName2")));
            expect(BigNumber.from(res2.events[last]?.topics[2]).toString()).to.equal("0");
        }

        const res3 = await (await communityPool.connect(user).rechargeUserWallet(schainName, { value: wei.toString(), gasPrice })).wait();
        expect(res3.events).to.be.empty;
    });

    it("should allow to withdraw money", async () => {
        await messageProxy.registerExtraContract(schainName, communityPool.address);
        const gasPrice = (await messageProxy.addConnectedChain(schainName)).gasPrice;
        const wei = minTransactionGas.mul(gasPrice).toNumber();
        await communityPool.connect(user).rechargeUserWallet(schainName, { value: wei.toString(), gasPrice });

        await communityPool.connect(user).withdrawFunds(schainName, wei +1 )
            .should.be.eventually.rejectedWith("Balance is too low");

        const balanceBefore = await getBalance(user.address);
        const tx = await (await communityPool.connect(user).withdrawFunds(schainName, wei, { gasPrice })).wait();
        const balanceAfter = await getBalance(user.address);
        const transactionFee = tx.gasUsed.mul(gasPrice).toNumber();
        (balanceAfter + transactionFee / 1e18).should.be.almost(balanceBefore + wei / 1e18);
    });

});
