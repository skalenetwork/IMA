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
 * @file ERC721ModuleForMainnet.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC721ModuleForMainnetContract,
    ERC721ModuleForMainnetInstance,
    ERC721OnChainContract,
    ERC721OnChainInstance,
    LockAndDataForMainnetContract,
    LockAndDataForMainnetERC721Contract,
    LockAndDataForMainnetERC721Instance,
    LockAndDataForMainnetInstance,
    MessageProxyForMainnetContract,
    MessageProxyForMainnetInstance,
    MessageProxyForSchainContract,
    MessageProxyForSchainInstance,
    } from "../types/truffle-contracts";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

import { deployLockAndDataForMainnet } from "./utils/deploy/lockAndDataForMainnet";
import { deployLockAndDataForMainnetERC20 } from "./utils/deploy/lockAndDataForMainnetERC20";
import { deployLockAndDataForMainnetERC721 } from "./utils/deploy/lockAndDataForMainnetERC721";
import { deployMessageProxyForMainnet } from "./utils/deploy/messageProxyForMainnet";
import { deployDepositBox } from "./utils/deploy/depositBox";
import { deployERC20ModuleForMainnet } from "./utils/deploy/erc20ModuleForMainnet";
import { deployERC721ModuleForMainnet } from "./utils/deploy/erc721ModuleForMainnet";

const MessageProxyForMainnet: MessageProxyForMainnetContract = artifacts.require("./MessageProxyForMainnet");
const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnet");
const LockAndDataForMainnetERC721: LockAndDataForMainnetERC721Contract =
    artifacts.require("./LockAndDataForMainnetERC721");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");
const ERC721ModuleForMainnet: ERC721ModuleForMainnetContract = artifacts.require("./ERC721ModuleForMainnet");

const contractManager = "0x0000000000000000000000000000000000000000";

contract("ERC721ModuleForMainnet", ([deployer, user, invoker]) => {
  let messageProxyForMainnet: MessageProxyForMainnetInstance;
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721Instance;
  let eRC721OnChain: ERC721OnChainInstance;
  let eRC721ModuleForMainnet: ERC721ModuleForMainnetInstance;

  beforeEach(async () => {
    lockAndDataForMainnet = await deployLockAndDataForMainnet();
    messageProxyForMainnet = await deployMessageProxyForMainnet(
      "Mainnet", contractManager, lockAndDataForMainnet);
    lockAndDataForMainnetERC721 = await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
    eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");
    eRC721ModuleForMainnet = await deployERC721ModuleForMainnet(lockAndDataForMainnet);
  });

  it("should invoke `receiveERC721` with `isRaw==true`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 1;
    const isRaw = true;
    // execution
    const res = await eRC721ModuleForMainnet.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    // expectation
    (res).should.include("0x");
  });

  it("should invoke `receiveERC721` with `isRaw==false`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 1;
    const isRaw = false;
    // execution
    const res = await eRC721ModuleForMainnet.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    // expectation
    (res).should.include("0x");
  });

  it("should return `true` when invoke `sendERC721` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const tokenId = 10;
    const isRaw = false;
    // mint some ERC721 of  for `deployer` address
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer tokenId from `deployer` to `lockAndDataForMainnetERC721`
    await eRC721OnChain.transferFrom(deployer,
      lockAndDataForMainnetERC721.address, tokenId, {from: deployer});
    // get data from `receiveERC721`
    const data = await eRC721ModuleForMainnet.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    await eRC721ModuleForMainnet.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    // execution
    await eRC721ModuleForMainnet.sendERC721(to0, data, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user);
  });

  it("should return `true` when invoke `sendERC721` with `to0==eRC721OnChain.address`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = eRC721OnChain.address; // bytes20
    const tokenId = 10;
    const isRaw = true;
    // mint some ERC721 of  for `deployer` address
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer tokenId from `deployer` to `lockAndDataForMainnetERC721`
    await eRC721OnChain.transferFrom(deployer,
      lockAndDataForMainnetERC721.address, tokenId, {from: deployer});
    // get data from `receiveERC721`
    const data = await eRC721ModuleForMainnet.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    await eRC721ModuleForMainnet.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    // execution
    await eRC721ModuleForMainnet.sendERC721(to0, data, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user);
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==eRC721OnChain.address`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = invoker; // bytes20
    const tokenId = 10;
    const isRaw = true;
    // get data from `receiveERC721`
    const data = await eRC721ModuleForMainnet.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    await eRC721ModuleForMainnet.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    // execution
    const res = await eRC721ModuleForMainnet.getReceiver(to0, data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const tokenId = 10;
    const isRaw = false;
    // get data from `receiveERC721`
    const data = await eRC721ModuleForMainnet.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    await eRC721ModuleForMainnet.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    // execution
    const res = await eRC721ModuleForMainnet.getReceiver(to0, data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

});
