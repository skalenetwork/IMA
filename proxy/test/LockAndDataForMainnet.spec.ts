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
 * @file LockAndDataForMainnet.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import { DepositBoxContract,
  DepositBoxInstance,
  LockAndDataForMainnetContract,
  LockAndDataForMainnetInstance,
  MessageProxyForMainnetContract,
  MessageProxyForMainnetInstance,
  MessageProxyForSchainContract,
  MessageProxyForSchainInstance,
  } from "../types/truffle-contracts";
import { randomString } from "./utils/helper";
import { skipTime } from "./utils/time";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxyForMainnet: MessageProxyForMainnetContract = artifacts.require("./MessageProxyForMainnet");
const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnet");
const DepositBox: DepositBoxContract = artifacts.require("./DepositBox");

const contractManager = "0x0000000000000000000000000000000000000000";

contract("LockAndDataForMainnet", ([deployer, user, invoker]) => {
  let messageProxyForMainnet: MessageProxyForMainnetInstance;
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let depositBox: DepositBoxInstance;

  beforeEach(async () => {
    messageProxyForMainnet = await MessageProxyForMainnet.new(
      "Mainnet", contractManager, {from: deployer});
    lockAndDataForMainnet = await LockAndDataForMainnet.new({from: deployer});
    depositBox = await DepositBox.new(messageProxyForMainnet.address, lockAndDataForMainnet.address,
       {from: deployer});
  });

  it("should add wei to `lockAndDataForMainnet`", async () => {
    // preparation
    const wei = "10000";
    const lockAndDataBalanceBefore = await web3.eth.getBalance(lockAndDataForMainnet.address);
    // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: wei, from: deployer});
    const lockAndDataBalanceAfter = await web3.eth.getBalance(lockAndDataForMainnet.address);
    // expectation
    expect(parseInt(lockAndDataBalanceAfter, 10) -
      parseInt(lockAndDataBalanceBefore, 10)).to.be.equal(parseInt(wei, 10));
  });

  it("should be Error event with message `Not enough ETH. in `LockAndDataForMainnet.sendEth`", async () => {
    // preparation
    const wei = "1000";
    const error = "Not enough ETH. in `LockAndDataForMainnet.sendEth`";
    // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: wei, from: deployer});
    // execution/expectation
    const {logs} = await lockAndDataForMainnet
      .sendEth(invoker, 10000,
        {from: deployer});
    // expectation
    expect(logs[0].args.message).to.be.equal(error);
  });

  it("should work `sendEth`", async () => {
    // preparation
    const addWeiToContract = "1000";
    const sendWeiFromContract = 100;
    // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: addWeiToContract, from: deployer});
    // execution
    await lockAndDataForMainnet
      .sendEth(invoker, sendWeiFromContract,
        {from: deployer});
    const contractBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
    // expectation
    expect(parseInt(contractBalance, 10))
      .to.equal(parseInt(addWeiToContract, 10) - sendWeiFromContract);
  });

  it("should work `approveTransfer`", async () => {
    // preparation
    const addWeiToContract = "1000";
    const sendWeiFromContract = 100;
    // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: addWeiToContract, from: deployer});
    // execution
    await lockAndDataForMainnet
      .approveTransfer(deployer, sendWeiFromContract, {from: deployer});
    // get value from mapping `approveTransfers`
    const bn = new BigNumber(await lockAndDataForMainnet.approveTransfers(deployer));
    // expectation
    parseInt(bn.toString(), 10).should.be.equal(sendWeiFromContract);
  });

  it("should work `getMyEth`", async () => {
    // preparation
    const addWeiToContract = "1000";
    const setWeiToApproveTransfers = 100;
    // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: addWeiToContract, from: deployer});
    // without `approveTransfer` `getMyEth` not invoke
    await lockAndDataForMainnet
      .approveTransfer(deployer, setWeiToApproveTransfers, {from: deployer});
    // execution
    await lockAndDataForMainnet
      .getMyEth({from: deployer});
    const contractBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
    // expectation
    expect(parseInt(contractBalance, 10))
      .to.equal(parseInt(addWeiToContract, 10) - setWeiToApproveTransfers);
  });

  it("should rejected with `User has insufficient ETH` when invoke `getMyEth`", async () => {
    // preparation
    const error = "User has insufficient ETH";
    // execution/expectation
    await lockAndDataForMainnet
      .getMyEth({from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should rejected with `Not enough ETH. in `LockAndDataForMainnet.getMyEth`` when invoke `getMyEth`", async () => {
    // preparation
    const error = "Not enough ETH. in `LockAndDataForMainnet.getMyEth`";
    const addWeiToContract = "1";
    const setWeiToApproveTransfers = 100;
    // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: addWeiToContract, from: deployer});
    // without `approveTransfer` `getMyEth` not invoke
    await lockAndDataForMainnet
      .approveTransfer(deployer, setWeiToApproveTransfers, {from: deployer});
    // execution/expectation
    await lockAndDataForMainnet
      .getMyEth({from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should invoke setContract without mistakes", async () => {
    await lockAndDataForMainnet
      .setContract("DepositBox", depositBox.address, {from: deployer});
    const getMapping = await lockAndDataForMainnet.permitted(web3.utils.soliditySha3("DepositBox"));
    // expectation
    expect(getMapping).to.equal(depositBox.address);
  });

  it("should rejected with `New address is equal zero` when invoke `getMyEth`", async () => {
    const error = "New address is equal zero";
    // execution/expectation
    await lockAndDataForMainnet
      .setContract("DepositBox", "0x0000000000000000000000000000000000000000", {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should rejected with `Contract is already added` when invoke `setContract`", async () => {
    // preparation
    const error = "Contract is already added";
    await lockAndDataForMainnet
    .setContract("DepositBox", depositBox.address, {from: deployer});
    // execution/expectation
    await lockAndDataForMainnet
      .setContract("DepositBox", depositBox.address, {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should rejected with `Given contract address does not contain code` when invoke `setContract`", async () => {
    const error = "Given contract address does not contain code";
    // execution/expectation
    await lockAndDataForMainnet
      .setContract("DepositBox", deployer, {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should invoke addSchain without mistakes", async () => {
    const schainName = randomString(10);
    // execution
    const chain = await lockAndDataForMainnet
      .addSchain(schainName, deployer, {from: deployer});
    const getMapping = await lockAndDataForMainnet.tokenManagerAddresses(web3.utils.soliditySha3(schainName));
    // expectation
    expect(getMapping).to.equal(deployer);
  });

  it("should rejected with `SKALE chain is already set` when invoke `addSchain`", async () => {
    // preparation
    const error = "SKALE chain is already set";
    const schainName = randomString(10);
    await lockAndDataForMainnet
      .addSchain(schainName, deployer, {from: deployer});
    // execution/expectation
    await lockAndDataForMainnet
      .addSchain(schainName, deployer, {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should rejected with `Incorrect Token Manager address` when invoke `addSchain`", async () => {
    // preparation
    const error = "Incorrect Token Manager address";
    const schainName = randomString(10);
    // execution/expectation
    await lockAndDataForMainnet
      .addSchain(schainName, "0x0000000000000000000000000000000000000000", {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should return true when invoke `hasSchain`", async () => {
    // preparation
    const schainID = randomString(10);
    // add schain for return `true` after `hasSchain` invoke
    await lockAndDataForMainnet
      .addSchain(schainID, deployer, {from: deployer});
    // execution
    const res = await lockAndDataForMainnet
      .hasSchain(schainID, {from: deployer});
    // expectation
    expect(res).to.be.true;
  });

  it("should return false when invoke `hasSchain`", async () => {
    // preparation
    const schainID = randomString(10);
    // execution
    const res = await lockAndDataForMainnet
      .hasSchain(schainID, {from: deployer});
    // expectation
    expect(res).to.be.false;
  });

  it("should invoke `removeSchain` without mistakes", async () => {
    const schainID = randomString(10);
    await lockAndDataForMainnet
      .addSchain(schainID, deployer, {from: deployer});
    // execution
    await lockAndDataForMainnet
      .removeSchain(schainID, {from: deployer});
    // expectation
    const getMapping = await lockAndDataForMainnet.tokenManagerAddresses(web3.utils.soliditySha3(schainID));
    expect(getMapping).to.equal("0x0000000000000000000000000000000000000000");
  });

  it("should rejected with `SKALE chain is not set` when invoke `removeSchain`", async () => {
    const error = "SKALE chain is not set";
    const schainID = randomString(10);
    const anotherSchainID = randomString(10);
    await lockAndDataForMainnet
      .addSchain(schainID, deployer, {from: deployer});
    // execution/expectation
    await lockAndDataForMainnet
      .removeSchain(anotherSchainID, {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should work `addAuthorizedCaller`", async () => {
    // preparation
    const caller = user;
    // execution
    await lockAndDataForMainnet
      .addAuthorizedCaller(caller, {from: deployer});
    // expectation
    const res = await lockAndDataForMainnet.authorizedCaller(caller);
    expect(res).to.be.true;
  });

  it("should work `removeAuthorizedCaller`", async () => {
    // preparation
    const caller = user;
    // execution
    await lockAndDataForMainnet
      .removeAuthorizedCaller(caller, {from: deployer});
    // expectation
    const res = await lockAndDataForMainnet.authorizedCaller(caller);
    expect(res).to.be.false;
  });

});
