import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
  ContractManagerInstance,
  IMALinkerInstance,
  MessageProxyForMainnetInstance,
  UsersOnMainnetInstance
  } from "../types/truffle-contracts";
import { randomString } from "./utils/helper";

import chai = require("chai");
import chaiAlmost = require("chai-almost");

chai.should();
chai.use((chaiAsPromised as any));
chai.use(chaiAlmost(0.002));

import { deployIMALinker } from "./utils/deploy/imaLinker";
import { deployMessageProxyForMainnet } from "./utils/deploy/messageProxyForMainnet";
import { deployContractManager } from "./utils/deploy/contractManager";
import { deployUsersOnMainnet } from "./utils/deploy/usersOnMainnet";

async function getBalance(address: string) {
  return parseFloat(web3.utils.fromWei(await web3.eth.getBalance(address)));
}

contract("UsersOnMainnet", ([deployer, user]) => {
  let contractManager: ContractManagerInstance;
  let messageProxy: MessageProxyForMainnetInstance;
  let imaLinker: IMALinkerInstance;
  let usersOnMainnet: UsersOnMainnetInstance;
  let contractManagerAddress = "0x0000000000000000000000000000000000000000";

  beforeEach(async () => {
    contractManager = await deployContractManager(contractManagerAddress);
    messageProxy = await deployMessageProxyForMainnet(contractManager);
    imaLinker = await deployIMALinker(contractManager, messageProxy);
    usersOnMainnet = await deployUsersOnMainnet(contractManager, messageProxy, imaLinker);

  });

  it("should revert if user recharged not enough money for most costly transaction", async () => {
    const schainID = randomString(10);
    const MIN_TRANSACTION_GAS =  (await usersOnMainnet.MIN_TRANSACTION_GAS()).toNumber();
    let wei = MIN_TRANSACTION_GAS * 8e9 - 1;
    await usersOnMainnet.rechargeUserWallet(schainID, {value: wei.toString(), from: user})
        .should.be.eventually.rejectedWith("Not enough money for transaction");
  });
 
  it("should recharge wallet if user passed enough money", async () => {
    const schainID = randomString(10);
    await messageProxy.addConnectedChain(schainID);
    const MIN_TRANSACTION_GAS =  (await usersOnMainnet.MIN_TRANSACTION_GAS()).toNumber();
    let wei = MIN_TRANSACTION_GAS * 8e9;
    await usersOnMainnet.rechargeUserWallet(schainID, {value: wei.toString(), from: user});
    const userBalance = (await usersOnMainnet.getBalance(schainID, {from: user})).toNumber();
    userBalance.should.be.equal(wei);
  });

  it("should allow to withdraw money", async () => {
    const schainID = randomString(10);
    const gasPrice = 8e9;
    await messageProxy.addConnectedChain(schainID);
    const MIN_TRANSACTION_GAS =  (await usersOnMainnet.MIN_TRANSACTION_GAS()).toNumber();
    let wei = MIN_TRANSACTION_GAS * gasPrice;
    await usersOnMainnet.rechargeUserWallet(schainID, {value: wei.toString(), from: user});

    await usersOnMainnet.withdrawFunds(schainID, wei+1, {from: user})
        .should.be.eventually.rejectedWith("Balance is too low");

    const balanceBefore = await getBalance(user) * 1e18;
    const tx = await usersOnMainnet.withdrawFunds(schainID, wei, {from: user});
    const balanceAfter = await getBalance(user) * 1e18;
    const transactionFee = tx.receipt.gasUsed * gasPrice;
    (balanceAfter + transactionFee).should.be.equal(balanceBefore + wei);
  });
 
 });
 