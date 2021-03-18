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
 * @file ERC20ModuleForMainnet.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import * as chaiAsPromised from "chai-as-promised";
import {
    ERC20ModuleForMainnetInstance,
    EthERC20Contract,
    EthERC20Instance,
    LockAndDataForMainnetERC20Instance,
    LockAndDataForMainnetInstance,
    MessagesTesterContract,
    MessagesTesterInstance,
    } from "../types/truffle-contracts";

import { randomString } from "./utils/helper";
import chai = require("chai");

chai.should();
chai.use((chaiAsPromised as any));

import { deployLockAndDataForMainnet } from "./utils/deploy/lockAndDataForMainnet";
import { deployLockAndDataForMainnetERC20 } from "./utils/deploy/lockAndDataForMainnetERC20";
import { deployERC20ModuleForMainnet } from "./utils/deploy/erc20ModuleForMainnet";

const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");
const MessagesTester: MessagesTesterContract = artifacts.require("./MessagesTester");

contract("ERC20ModuleForMainnet", ([deployer, user, invoker]) => {
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
  let ethERC20: EthERC20Instance;
  let eRC20ModuleForMainnet: ERC20ModuleForMainnetInstance;
  let messages: MessagesTesterInstance;

  beforeEach(async () => {
    lockAndDataForMainnet = await deployLockAndDataForMainnet();
    lockAndDataForMainnetERC20 = await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
    ethERC20 = await EthERC20.new({from: deployer});
    eRC20ModuleForMainnet = await deployERC20ModuleForMainnet(lockAndDataForMainnet);
    messages = await MessagesTester.new();
  });

  it("should invoke `receiveERC20`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const schainID = randomString(10);
    const to = user;
    const amount = 6;
    await ethERC20.mint(deployer, 10, {from: deployer});
    // execution
    await eRC20ModuleForMainnet.receiveERC20(schainID, contractHere, to, amount, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
    await lockAndDataForMainnetERC20.disableWhitelist(schainID);
    const res = await eRC20ModuleForMainnet.receiveERC20.call(schainID, contractHere, to, amount, {from: deployer});
    // expectation
    res.should.include("0x");

  });

  it("should return `true` when invoke `sendERC20`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const schainID = randomString(10);
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    // get data from `receiveERC20`
    await eRC20ModuleForMainnet.receiveERC20(schainID, contractHere, to, amount, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
    await lockAndDataForMainnetERC20.disableWhitelist(schainID);
    await eRC20ModuleForMainnet.receiveERC20(schainID, contractHere, to, amount, {from: deployer});
    // execution
    const data = await messages.encodeTransferErc20Message(contractHere, to, amount);
    const res = await eRC20ModuleForMainnet.sendERC20.call(data, {from: deployer});
    // expectation
    expect(res).to.be.true;
  });

  // it("should return `true` when invoke `sendERC20` with `to0==ethERC20.address`", async () => {
  //   // preparation
  //   const contractHere = ethERC20.address;
  //   const to = user;
  //   const to0 = ethERC20.address; // bytes20
  //   const amount = 10;
  //   // mint some quantity of ERC20 tokens for `deployer` address
  //   await ethERC20.mint(deployer, "1000000000", {from: deployer});
  //   // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
  //   await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
  //   // get data from `receiveERC20`
  //   const data = await eRC20ModuleForMainnet.receiveERC20.call(schainID, contractHere, to, amount, {from: deployer});
  //   await eRC20ModuleForMainnet.receiveERC20(schainID, contractHere, to, amount, {from: deployer});
  //   // execution
  //   const res = await eRC20ModuleForMainnet.sendERC20.call(to0, data, {from: deployer});
  //   // expectation
  //   expect(res).to.be.true;
  // });

  // it("should return `receiver` when invoke `getReceiver` with `to0==ethERC20.address`", async () => {
  //   // preparation
  //   const contractHere = ethERC20.address;
  //   const to = user;
  //   const to0 = invoker; // bytes20
  //   const amount = 10;
  //   // mint some quantity of ERC20 tokens for `deployer` address
  //   await ethERC20.mint(deployer, "1000000000", {from: deployer});
  //   // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
  //   await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
  //   // get data from `receiveERC20`
  //   const data = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, {from: deployer});
  //   await eRC20ModuleForMainnet.receiveERC20(contractHere, to, amount, {from: deployer});
  //   // execution
  //   const res = await eRC20ModuleForMainnet.getReceiver(data, {from: deployer});
  //   // expectation
  //   res.should.be.equal(user);
  // });

  it("should return `receiver` when invoke `getReceiver`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const schainID = randomString(10);
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    // get data from `receiveERC20`
    await eRC20ModuleForMainnet.receiveERC20(schainID, contractHere, to, amount, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
    await lockAndDataForMainnetERC20.disableWhitelist(schainID);
    await eRC20ModuleForMainnet.receiveERC20(schainID, contractHere, to, amount, {from: deployer});
    // execution
    const data = await messages.encodeTransferErc20Message(contractHere, to, amount);
    const res = await eRC20ModuleForMainnet.getReceiver(data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

});
