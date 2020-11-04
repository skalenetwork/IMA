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
 * @file LockAndDataForSchainERC721.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC721OnChainContract,
    ERC721OnChainInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC721Contract,
    LockAndDataForSchainERC721Instance,
    LockAndDataForSchainInstance,
    MessageProxyForMainnetContract,
    MessageProxyForMainnetInstance,
    MessageProxyForSchainContract,
    MessageProxyForSchainInstance,
    } from "../types/truffle-contracts";

import { createBytes32 } from "./utils/helper";
import { stringToHex } from "./utils/helper";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForSchainERC721: LockAndDataForSchainERC721Contract =
    artifacts.require("./LockAndDataForSchainERC721");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");

const contractManager = "0x0000000000000000000000000000000000000000";

contract("LockAndDataForSchainERC721", ([deployer, user, invoker]) => {
  let messageProxyForSchain: MessageProxyForSchainInstance;
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForSchainERC721: LockAndDataForSchainERC721Instance;
  let eRC721OnChain: ERC721OnChainInstance;

  beforeEach(async () => {
    messageProxyForSchain = await MessageProxyForSchain.new(
      "Schain", contractManager, {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchainERC721 =
        await LockAndDataForSchainERC721.new(lockAndDataForSchain.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
    eRC721OnChain = await ERC721OnChain.new("ELVIS", "ELV", {from: deployer});

  });

  it("should invoke `sendERC721` without mistakes", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 10;
    // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
    const minterRole = await eRC721OnChain.MINTER_ROLE();
    await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
    // execution
    const res = await lockAndDataForSchainERC721
        .sendERC721(contractHere, to, tokenId, {from: deployer});
    // expectation
    expect(res.logs[0].args.result).to.be.true;
  });

  it("should rejected with `Token not transfered` after invoke `receiveERC721`", async () => {
    // preparation
    const error = "Token not transfered";
    const contractHere = eRC721OnChain.address;
    const tokenId = 10;
    // mint some quantity of ERC721 tokens for `deployer` address
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // execution/expectation
    const res = await lockAndDataForSchainERC721
        .receiveERC721(contractHere, tokenId, {from: deployer})
        .should.be.eventually.rejectedWith(error);
  });

  it("should return `true` after invoke `receiveERC721`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const tokenId = 10;
    // mint ERC721 token for `deployer` address
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer ERC721 token to `lockAndDataForMainnetERC721` address
    await eRC721OnChain.transferFrom(deployer, lockAndDataForSchainERC721.address, tokenId, {from: deployer});
    // execution
    const res = await lockAndDataForSchainERC721
        .receiveERC721(contractHere, tokenId, {from: deployer});
    // expectation
    expect(res.logs[0].args.result).to.be.true;
  });

  it("should set `ERC721Tokens` and `ERC721Mapper`", async () => {
    // preparation
    const addressERC721 = eRC721OnChain.address;
    const contractPosition = 10;
    // execution
    await lockAndDataForSchainERC721
        .addERC721Token(addressERC721, contractPosition, {from: deployer});
    // expectation
    expect(await lockAndDataForSchainERC721.erc721Tokens(contractPosition)).to.be.equal(addressERC721);
    expect(parseInt(
        new BigNumber(await lockAndDataForSchainERC721.erc721Mapper(addressERC721))
        .toString(), 10))
        .to.be.equal(contractPosition);
  });

});
