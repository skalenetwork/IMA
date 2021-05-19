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

    before(async () => {
        [deployer, user] = await ethers.getSigners();
    });

    beforeEach(async () => {
        contractManager = await deployContractManager(contractManagerAddress);
        messageProxy = await deployMessageProxyForMainnet(contractManager);
        linker = await deployLinker(messageProxy);
        communityPool = await deployCommunityPool(contractManager, linker, messageProxy);
    });

    it("should revert if user recharged not enough money for most costly transaction", async () => {
        const schainID = randomString(10);
        const tx = await messageProxy.addConnectedChain(schainID);
        const gasPrice = tx.gasPrice;
        const minTransactionGas = await communityPool.minTransactionGas();
        const wei = minTransactionGas.mul(gasPrice).sub(1);
        await communityPool.connect(user).rechargeUserWallet(schainID, { value: wei.toString(), gasPrice })
            .should.be.eventually.rejectedWith("Not enough money for transaction");
    });

    it("should recharge wallet if user passed enough money", async () => {
        const schainID = randomString(10);
        const tx = await messageProxy.addConnectedChain(schainID);
        const minTransactionGas = await communityPool.minTransactionGas();
        const gasPrice = tx.gasPrice;
        const wei = minTransactionGas.mul(gasPrice);
        await communityPool.connect(user).rechargeUserWallet(schainID, { value: wei.toString(), gasPrice });
        const userBalance = await communityPool.connect(user).getBalance(schainID);
        userBalance.should.be.deep.equal(wei);
    });

    it("should allow to withdraw money", async () => {
        const schainID = randomString(10);
        const gasPrice = (await messageProxy.addConnectedChain(schainID)).gasPrice;
        const minTransactionGas = await communityPool.minTransactionGas();
        const wei = minTransactionGas.mul(gasPrice).toNumber();
        await communityPool.connect(user).rechargeUserWallet(schainID, { value: wei.toString(), gasPrice });

        await communityPool.connect(user).withdrawFunds(schainID, wei +1 )
            .should.be.eventually.rejectedWith("Balance is too low");

        const balanceBefore = await getBalance(user.address);
        const tx = await (await communityPool.connect(user).withdrawFunds(schainID, wei, { gasPrice })).wait();
        const balanceAfter = await getBalance(user.address);
        const transactionFee = tx.gasUsed.mul(gasPrice).toNumber();
        (balanceAfter + transactionFee / 1e18).should.be.almost(balanceBefore + wei / 1e18);
    });

});
