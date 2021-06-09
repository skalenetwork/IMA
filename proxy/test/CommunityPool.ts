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
import { expect } from "chai";

async function getBalance(address: string) {
    return parseFloat(web3.utils.fromWei(await web3.eth.getBalance(address)));
}

describe("CommunityPool", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let node: SignerWithAddress;

    let contractManager: ContractManager;
    let messageProxy: MessageProxyForMainnet;
    let linker: Linker;
    let communityPool: CommunityPool;
    const contractManagerAddress = "0x0000000000000000000000000000000000000000";
    const schainName = "Schain";
    let minTransactionGas: any;

    before(async () => {
        [deployer, user, node] = await ethers.getSigners();
    });

    beforeEach(async () => {
        contractManager = await deployContractManager(contractManagerAddress);
        messageProxy = await deployMessageProxyForMainnet(contractManager);
        linker = await deployLinker(messageProxy, contractManager);
        communityPool = await deployCommunityPool(contractManager, linker, messageProxy);
        minTransactionGas = await communityPool.minTransactionGas();
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

    describe("when chain connected and contract registered", async () => {
        let gasPrice: BigNumber;
        beforeEach(async () => {
            await messageProxy.registerExtraContract(schainName, communityPool.address);
            gasPrice = (await messageProxy.addConnectedChain(schainName)).gasPrice;

        });

        it("should not allow to withdraw from user wallet if CommunityPool is not registered", async () => {
            const amount = minTransactionGas.mul(gasPrice);
            await communityPool.connect(user).rechargeUserWallet(schainName, { value: amount.toString() });
            await messageProxy.removeExtraContract(schainName, communityPool.address);
            await communityPool.connect(user).withdrawFunds(schainName, amount.toString())
                .should.be.eventually.rejectedWith("Sender contract is not registered");
        });

        it("should revert if user recharged not enough money for most costly transaction", async () => {
            const amount = minTransactionGas.mul(gasPrice).sub(1);
            await communityPool.connect(user).rechargeUserWallet(schainName, { value: amount.toString(), gasPrice })
                .should.be.eventually.rejectedWith("Not enough money for transaction");
        });

        it("should recharge wallet if user passed enough money", async () => {
            const amount = minTransactionGas.mul(gasPrice);
            await communityPool.connect(user).rechargeUserWallet(schainName, { value: amount.toString(), gasPrice });
            const userBalance = await communityPool.connect(user).getBalance(schainName);
            userBalance.should.be.deep.equal(amount);
        });

        it("should allow to withdraw money", async () => {
            const amount = minTransactionGas.mul(gasPrice).toNumber();
            await communityPool.connect(user).rechargeUserWallet(schainName, { value: amount.toString(), gasPrice });

            await communityPool.connect(user).withdrawFunds(schainName, amount +1 )
                .should.be.eventually.rejectedWith("Balance is too low");

            const balanceBefore = await getBalance(user.address);
            const tx = await (await communityPool.connect(user).withdrawFunds(schainName, amount, { gasPrice })).wait();
            const balanceAfter = await getBalance(user.address);
            const transactionFee = tx.gasUsed.mul(gasPrice).toNumber();
            (balanceAfter + transactionFee / 1e18).should.be.almost(balanceBefore + amount / 1e18);
        });

    });

    it("should links with contract on schain", async () => {
        const fakeContractOnSchain = user.address;
        await communityPool.addSchainContract(schainName, fakeContractOnSchain);
        expect(await communityPool.hasSchainContract(schainName)).to.be.true;
    });

    it("should remove link to contract on schain", async () => {
        const fakeContractOnSchain = user.address;
        await communityPool.addSchainContract(schainName, fakeContractOnSchain);
        expect(await communityPool.hasSchainContract(schainName)).to.be.true;
        await communityPool.removeSchainContract(schainName);
        expect(await communityPool.hasSchainContract(schainName)).to.be.false;
    });

});
