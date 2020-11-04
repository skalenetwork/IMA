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
 * @file LockAndDataForMainnetERC721.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC721OnChainContract,
    ERC721OnChainInstance,
    LockAndDataForMainnetContract,
    LockAndDataForMainnetERC721Contract,
    LockAndDataForMainnetERC721Instance,
    LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainInstance,
    MessageProxyForMainnetContract,
    MessageProxyForMainnetInstance,
    MessageProxyForSchainContract,
    MessageProxyForSchainInstance,
    TokenFactoryContract,
    TokenFactoryInstance,
    } from "../types/truffle-contracts";

import { createBytes32 } from "./utils/helper";
import { stringToHex } from "./utils/helper";

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
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForMainnetERC721: LockAndDataForMainnetERC721Contract =
    artifacts.require("./LockAndDataForMainnetERC721");
const TokenFactory: TokenFactoryContract = artifacts.require("./TokenFactory");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");

const contractManager = "0x0000000000000000000000000000000000000000";

contract("LockAndDataForMainnetERC721", ([deployer, user, invoker]) => {
  let messageProxyForMainnet: MessageProxyForMainnetInstance;
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721Instance;
  let tokenFactory: TokenFactoryInstance;
  let eRC721OnChain: ERC721OnChainInstance;

  beforeEach(async () => {
    lockAndDataForMainnet = await deployLockAndDataForMainnet();
    messageProxyForMainnet = await deployMessageProxyForMainnet(
      "Mainnet", contractManager, lockAndDataForMainnet);
    lockAndDataForMainnetERC721 = await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
    await lockAndDataForSchain.setContract("LockAndDataERC721", lockAndDataForMainnetERC721.address);
    tokenFactory = await TokenFactory.new(lockAndDataForSchain.address,
        {from: deployer});
    eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");

  });

  it("should NOT to send ERC721 to `to` when invoke `sendERC721`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 1;
    // mint some ERC721 of  for `deployer` address
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // execution/expectation
    const res = await lockAndDataForMainnetERC721
        .sendERC721(contractHere, to, tokenId, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(deployer);
  });

  it("should to send ERC721 to `to` when invoke `sendERC721`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 1;
    // mint some ERC721 of  for `deployer` address
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer tokenId from `deployer` to `lockAndDataForMainnetERC721`
    await eRC721OnChain.transferFrom(deployer,
        lockAndDataForMainnetERC721.address, tokenId, {from: deployer});
    // execution
    const res = await lockAndDataForMainnetERC721
        .sendERC721(contractHere, to, tokenId, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user);
  });

  it("should add ERC721 token when invoke `sendERC721`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    // execution#1
    const res = await lockAndDataForMainnetERC721
        .addERC721Token.call(contractHere, {from: deployer});
    await lockAndDataForMainnetERC721
        .addERC721Token(contractHere, {from: deployer});
    // expectation#1
    parseInt(new BigNumber(res).toString(), 10)
        .should.be.equal(1);
    // execution#2
    const res1 = await lockAndDataForMainnetERC721
        .addERC721Token.call(contractHere, {from: deployer});
    // expectation#2
    parseInt(new BigNumber(res1).toString(), 10)
        .should.be.equal(2);
  });

});
