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

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC20ModuleForMainnetInstance,
    EthERC20Contract,
    EthERC20Instance,
    LockAndDataForMainnetERC20Instance,
    LockAndDataForMainnetInstance,
    MessageProxyForMainnetInstance,
    } from "../types/truffle-contracts";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

import { deployLockAndDataForMainnet } from "./utils/deploy/lockAndDataForMainnet";
import { deployLockAndDataForMainnetERC20 } from "./utils/deploy/lockAndDataForMainnetERC20";
import { deployMessageProxyForMainnet } from "./utils/deploy/messageProxyForMainnet";
import { deployERC20ModuleForMainnet } from "./utils/deploy/erc20ModuleForMainnet";

const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");

const contractManager = "0x0000000000000000000000000000000000000000";

contract("ERC20ModuleForMainnet", ([deployer, user, invoker]) => {
  let messageProxyForMainnet: MessageProxyForMainnetInstance;
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
  let ethERC20: EthERC20Instance;
  let eRC20ModuleForMainnet: ERC20ModuleForMainnetInstance;

  beforeEach(async () => {

    lockAndDataForMainnet = await deployLockAndDataForMainnet();
    messageProxyForMainnet = await deployMessageProxyForMainnet(
      "Mainnet", contractManager, lockAndDataForMainnet);
    lockAndDataForMainnetERC20 = await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
    ethERC20 = await EthERC20.new({from: deployer});
    eRC20ModuleForMainnet = await deployERC20ModuleForMainnet(lockAndDataForMainnet);
  });

  it("should invoke `receiveERC20` with `isRaw==true`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const amount = 10;
    const isRaw = true;
    await ethERC20.mint(deployer, 10, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    // expectation
    res.should.include("0x"); // l_sergiy: FIX - not passing
  });

  it("should invoke `receiveERC20` with `isRaw==false`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const amount = 6;
    const isRaw = false;
    await ethERC20.mint(deployer, 10, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    // expectation
    res.should.include("0x");

  });

  it("should return `true` when invoke `sendERC20` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const isRaw = false;
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    // get data from `receiveERC20`
    const data = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForMainnet.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.sendERC20.call(to0, data, {from: deployer});
    // expectation
    expect(res).to.be.true;
  });

  it("should return `true` when invoke `sendERC20` with `to0==ethERC20.address`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const to0 = ethERC20.address; // bytes20
    const amount = 10;
    const isRaw = true;
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    // get data from `receiveERC20`
    const data = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForMainnet.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.sendERC20.call(to0, data, {from: deployer});
    // expectation
    expect(res).to.be.true;
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==ethERC20.address`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const to0 = invoker; // bytes20
    const amount = 10;
    const isRaw = true;
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    // get data from `receiveERC20`
    const data = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForMainnet.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.getReceiver(data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const isRaw = false;
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    // get data from `receiveERC20`
    const data = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForMainnet.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.getReceiver(data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

});
