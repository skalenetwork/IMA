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
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC721ModuleForMainnetInstance,
    ERC721OnChainContract,
    ERC721OnChainInstance,
    LockAndDataForMainnetERC721Instance,
    LockAndDataForMainnetInstance,
    MessagesTesterContract,
    MessagesTesterInstance,
    } from "../types/truffle-contracts";

import chai = require("chai");

chai.should();
chai.use((chaiAsPromised as any));

import { deployLockAndDataForMainnet } from "./utils/deploy/imaLinker";
import { deployLockAndDataForMainnetERC721 } from "./utils/deploy/contractManager";
import { deployERC721ModuleForMainnet } from "./utils/deploy/depositBoxERC721";
import { randomString } from "./utils/helper";

const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");
const MessagesTester: MessagesTesterContract = artifacts.require("./MessagesTester");

contract("ERC721ModuleForMainnet", ([deployer, user, invoker]) => {
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721Instance;
  let eRC721OnChain: ERC721OnChainInstance;
  let eRC721ModuleForMainnet: ERC721ModuleForMainnetInstance;
  let messages: MessagesTesterInstance;

  beforeEach(async () => {
    lockAndDataForMainnet = await deployLockAndDataForMainnet();
    lockAndDataForMainnetERC721 = await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
    eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");
    eRC721ModuleForMainnet = await deployERC721ModuleForMainnet(lockAndDataForMainnet);
    messages = await MessagesTester.new();
  });

  it("should invoke `receiveERC721`", async () => {
    // preparation
    const schainID = randomString(10);
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 1;
    // execution
    await eRC721ModuleForMainnet.receiveERC721(schainID, contractHere, to, tokenId, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
    await lockAndDataForMainnetERC721.disableWhitelist(schainID);
    const res = await eRC721ModuleForMainnet.receiveERC721.call(schainID, contractHere, to, tokenId, {from: deployer});
    // expectation
    (res).should.include("0x");
  });

  it("should return `true` when invoke `sendERC721` with `to0==address(0)`", async () => {
    // preparation
    const schainID = randomString(10);
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const tokenId = 10;
    // mint some ERC721 of  for `deployer` address
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer tokenId from `deployer` to `lockAndDataForMainnetERC721`
    await eRC721OnChain.transferFrom(deployer,
      lockAndDataForMainnetERC721.address, tokenId, {from: deployer});
    // get data from `receiveERC721`
    await eRC721ModuleForMainnet.receiveERC721(schainID, contractHere, to, tokenId, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
    await lockAndDataForMainnetERC721.disableWhitelist(schainID);
    await eRC721ModuleForMainnet.receiveERC721(schainID, contractHere, to, tokenId, {from: deployer});
    // execution
    const data = await messages.encodeTransferErc721Message(contractHere, to, tokenId);
    await eRC721ModuleForMainnet.sendERC721(data, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user);
  });

  it("should return `true` when invoke `sendERC721` with `to0==eRC721OnChain.address`", async () => {
    // preparation
    const schainID = randomString(10);
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = eRC721OnChain.address; // bytes20
    const tokenId = 10;
    // mint some ERC721 of  for `deployer` address
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer tokenId from `deployer` to `lockAndDataForMainnetERC721`
    await eRC721OnChain.transferFrom(deployer,
      lockAndDataForMainnetERC721.address, tokenId, {from: deployer});
    // get data from `receiveERC721`
    await eRC721ModuleForMainnet.receiveERC721(schainID, contractHere, to, tokenId, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
    await lockAndDataForMainnetERC721.disableWhitelist(schainID);
    await eRC721ModuleForMainnet.receiveERC721(schainID, contractHere, to, tokenId, {from: deployer});
    // execution
    const data = await messages.encodeTransferErc721Message(contractHere, to, tokenId);
    await eRC721ModuleForMainnet.sendERC721(data, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user);
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==address(0)`", async () => {
    // preparation
    const schainID = randomString(10);
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 10;
    // get data from `receiveERC721`
    await eRC721ModuleForMainnet.receiveERC721(schainID, contractHere, to, tokenId, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
    await lockAndDataForMainnetERC721.disableWhitelist(schainID);
    // const data = await eRC721ModuleForMainnet.receiveERC721.call(schainID, contractHere, to, tokenId, {from: deployer});
    await eRC721ModuleForMainnet.receiveERC721(schainID, contractHere, to, tokenId, {from: deployer});
    // execution
    const data = await messages.encodeTransferErc721Message(contractHere, to, tokenId);
    const res = await eRC721ModuleForMainnet.getReceiver(data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

});
