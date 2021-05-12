import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
  ContractManagerInstance,
  LinkerInstance,
  MessageProxyForMainnetInstance,
  CommunityPoolInstance
  } from "../types/truffle-contracts";
import { randomString } from "./utils/helper";

import chai = require("chai");
import chaiAlmost = require("chai-almost");

chai.should();
chai.use((chaiAsPromised as any));
chai.use(chaiAlmost(0.000000000002));

import { deployLinker } from "./utils/deploy/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/messageProxyForMainnet";
import { deployContractManager } from "./utils/deploy/contractManager";
import { deployCommunityPool } from "./utils/deploy/communityPool";

async function getBalance(address: string) {
  return parseFloat(web3.utils.fromWei(await web3.eth.getBalance(address)));
}

contract("CommunityPool", ([deployer, user]) => {
  let contractManager: ContractManagerInstance;
  let messageProxy: MessageProxyForMainnetInstance;
  let linker: LinkerInstance;
  let communityPool: CommunityPoolInstance;
  const contractManagerAddress = "0x0000000000000000000000000000000000000000";

  beforeEach(async () => {
    contractManager = await deployContractManager(contractManagerAddress);
    messageProxy = await deployMessageProxyForMainnet(contractManager);
    linker = await deployLinker(messageProxy);
    communityPool = await deployCommunityPool(contractManager, messageProxy, linker);

  });

  it("should revert if user recharged not enough money for most costly transaction", async () => {
    const schainID = randomString(10);
    await messageProxy.addConnectedChain(schainID);
    const gasPrice = await web3.eth.getGasPrice();
    const minTransactionGas =  (await communityPool.minTransactionGas()).toNumber();
    const wei = minTransactionGas * gasPrice - 1;
    await communityPool.rechargeUserWallet(schainID, {value: wei.toString(), from: user, gasPrice: gasPrice})
        .should.be.eventually.rejectedWith("Not enough money for transaction");
  });

  it("should recharge wallet if user passed enough money", async () => {
    const schainID = randomString(10);
    await messageProxy.addConnectedChain(schainID);
    const minTransactionGas =  (await communityPool.minTransactionGas()).toNumber();
    const gasPrice = await web3.eth.getGasPrice();
    const wei = minTransactionGas * gasPrice;
    await communityPool.rechargeUserWallet(schainID, {value: wei.toString(), from: user, gasPrice: gasPrice});
    const userBalance = (await communityPool.getBalance(schainID, {from: user})).toNumber();
    userBalance.should.be.equal(wei);
  });

  it("should allow to withdraw money", async () => {
    const schainID = randomString(10);
    const gasPrice = await web3.eth.getGasPrice();
    await messageProxy.addConnectedChain(schainID);
    const minTransactionGas =  (await communityPool.minTransactionGas()).toNumber();
    const wei = minTransactionGas * gasPrice;
    await communityPool.rechargeUserWallet(schainID, {value: wei.toString(), from: user, gasPrice: gasPrice});

    await communityPool.withdrawFunds(schainID, wei + 1, {from: user})
        .should.be.eventually.rejectedWith("Balance is too low");

    const balanceBefore = await getBalance(user);
    const tx = await communityPool.withdrawFunds(schainID, wei, {from: user, gasPrice: gasPrice});
    const balanceAfter = await getBalance(user);
    const transactionFee = (tx.receipt.gasUsed * gasPrice);
    (balanceAfter + transactionFee / 1e18).should.be.almost(balanceBefore + wei / 1e18);
  });

 });
