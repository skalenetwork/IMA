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
 * @file TokenFactory.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");
import {
    ERC20ModuleForSchainContract,
    ERC20ModuleForSchainInstance,
    ERC20OnChainContract,
    ERC20OnChainInstance,
    ERC721ModuleForSchainContract,
    ERC721ModuleForSchainInstance,
    ERC721OnChainContract,
    ERC721OnChainInstance,
    LockAndDataForSchainWorkaroundContract,
    LockAndDataForSchainERC20Contract,
    LockAndDataForSchainERC20Instance,
    LockAndDataForSchainERC721Contract,
    LockAndDataForSchainERC721Instance,
    LockAndDataForSchainWorkaroundInstance,
    MessageProxyForSchainContract,
    MessageProxyForSchainInstance,
    TokenFactoryContract,
    TokenFactoryInstance,
  } from "../types/truffle-contracts";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const LockAndDataForSchain: LockAndDataForSchainWorkaroundContract = artifacts.require("./LockAndDataForSchainWorkaround");
const TokenFactory: TokenFactoryContract = artifacts.require("./TokenFactory");
const LockAndDataForSchainERC20: LockAndDataForSchainERC20Contract =
    artifacts.require("./LockAndDataForSchainERC20");
const ERC20ModuleForSchain: ERC20ModuleForSchainContract = artifacts.require("./ERC20ModuleForSchain");
const LockAndDataForSchainERC721: LockAndDataForSchainERC721Contract =
    artifacts.require("./LockAndDataForSchainERC721");
const ERC721ModuleForSchain: ERC721ModuleForSchainContract = artifacts.require("./ERC721ModuleForSchain");
const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");

contract("TokenFactory", ([user, deployer]) => {
  let messageProxy: MessageProxyForSchainInstance;
  let lockAndDataForSchain: LockAndDataForSchainWorkaroundInstance;
  let tokenFactory: TokenFactoryInstance;
  let eRC20ModuleForSchain: ERC20ModuleForSchainInstance;
  let lockAndDataForSchainERC20: LockAndDataForSchainERC20Instance;
  let eRC721ModuleForSchain: ERC721ModuleForSchainInstance;
  let lockAndDataForSchainERC721: LockAndDataForSchainERC721Instance;

  beforeEach(async () => {
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
    messageProxy = await MessageProxyForSchain.new("Mainnet", lockAndDataForSchain.address, {from: deployer});
    tokenFactory = await TokenFactory.new(lockAndDataForSchain.address,
      {from: deployer});
    eRC20ModuleForSchain = await ERC20ModuleForSchain.new(lockAndDataForSchain.address,
      {from: deployer});
    eRC721ModuleForSchain = await ERC721ModuleForSchain.new(lockAndDataForSchain.address,
      {from: deployer});
    lockAndDataForSchainERC20 =
      await LockAndDataForSchainERC20.new(lockAndDataForSchain.address, {from: deployer});
    lockAndDataForSchainERC721 =
      await LockAndDataForSchainERC721.new(lockAndDataForSchain.address,
        {from: deployer});
  });

  it("should createERC20", async () => {
    // preparation
    const to = user;
    const data = "0x03" +
    "000000000000000000000000000000000000000000000000000000000000000a" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "000000000000000000000000000000000000000000000000000000000000000a" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000c" + // token name
    "45524332304f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000005" + // token symbol
    "455243323012" + // token symbol
    "000000000000000000000000000000000000000000000000000000003b9ac9f6"; // total supply
    // set `ERC20Module` to avoid `Roles: account is the zero address` error
    await lockAndDataForSchain
      .setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC20` to avoid `Roles: account is the zero address` error
    await lockAndDataForSchain
      .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
    // execution
    const res = await tokenFactory.createERC20.call("elvis", "ELV", {from: deployer});
    // expectation
    expect(res).to.include("0x");
  });

  it("should createERC721", async () => {
    // preparation
    const to = user;
    const data = "0x05" +
    "0000000000000000000000000000000000000000000000000000000000000001" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "0000000000000000000000000000000000000000000000000000000000000002" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000d" + // token name
    "4552433732314f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000006" + // token symbol
    "455243373231"; // token symbol
    // set `ERC721Module` to avoid `Roles: account is the zero address` error
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` to avoid `Roles: account is the zero address` error
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // execution
    const res = await tokenFactory.createERC721.call("elvis", "ELV", {from: deployer});
    // expectation
    expect(res).to.include("0x");
  });

});

contract("ERC20OnChain", ([deployer, user]) => {
  let messageProxy: MessageProxyForSchainInstance;
  let lockAndDataForSchain: LockAndDataForSchainWorkaroundInstance;
  let eRC20OnChain: ERC20OnChainInstance;
  let eRC20ModuleForSchain: ERC20ModuleForSchainInstance;

  beforeEach(async () => {
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
    messageProxy = await MessageProxyForSchain.new("Mainnet", lockAndDataForSchain.address, {from: deployer});
    eRC20ModuleForSchain = await ERC20ModuleForSchain.new(lockAndDataForSchain.address,
      {from: deployer});
    await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address);
    eRC20OnChain = await ERC20OnChain.new("ERC20OnChain", "ERC20", {from: deployer});
  });

  it("should invoke `_mint` as internal", async () => {
    // preparation
    const account = user;
    const value = 500;
    // execution
    await eRC20OnChain.mint(account, value, {from: deployer});
    // expectation
    const balance = await eRC20OnChain.balanceOf(account);
    parseInt(new BigNumber(balance).toString(), 10).should.be.equal(value);
  });

  it("should invoke `burn`", async () => {
    // preparation
    const amount = 500;
    const mintAmount = 1500;
    // mint to avoid `SafeMath: subtraction overflow` error
    await eRC20OnChain.mint(deployer, mintAmount, {from: deployer});
    // execution
    await eRC20OnChain.burn(amount, {from: deployer});
    // expectation
    const balance = await eRC20OnChain.balanceOf(deployer);
    parseInt(new BigNumber(balance).toString(), 10).should.be.equal(mintAmount - amount);
  });

  it("should invoke `burnFrom`", async () => {
    // preparation
    const account = user;
    const amount = 100;
    const mintAmount = 200;
    // mint to avoid `SafeMath: subtraction overflow` error
    await eRC20OnChain.mint(account, mintAmount, {from: deployer});
    // approve to avoid `SafeMath: subtraction overflow` error
    await eRC20OnChain.approve(deployer, 100, {from: account});
    // execution
    await eRC20OnChain.burnFrom(account, amount, {from: deployer});
    // expectation
    const balance = await eRC20OnChain.balanceOf(account);
    parseInt(new BigNumber(balance).toString(), 10).should.be.equal(mintAmount - amount);
  });
});

contract("ERC721OnChain", ([user, deployer]) => {
  let messageProxy: MessageProxyForSchainInstance;
  let lockAndDataForSchain: LockAndDataForSchainWorkaroundInstance;
  let eRC721OnChain: ERC721OnChainInstance;

  beforeEach(async () => {
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
    messageProxy = await MessageProxyForSchain.new("Mainnet", lockAndDataForSchain.address, {from: deployer});
    eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721", {from: deployer});
  });

  it("should invoke `mint`", async () => {
    // preparation
    const account = user;
    const tokenId = 500;
    // execution
    await eRC721OnChain.mint(account, tokenId, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(account);
  });

  it("should invoke `burn`", async () => {
    // preparation
    const error = "ERC721: owner query for nonexistent token";
    const tokenId = 55;
    // mint to avoid `owner query for nonexistent token` error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // execution
    await eRC721OnChain.burn(tokenId, {from: deployer});
    // expectation
    await eRC721OnChain.ownerOf(tokenId).should.be.eventually.rejectedWith(error);
  });

  it("should reject with `ERC721Burnable: caller is not owner nor approved` when invoke `burn`", async () => {
    // preparation
    const error = "ERC721Burnable: caller is not owner nor approved";
    const tokenId = 55;
    const account = user;
    // mint to avoid `owner query for nonexistent token` error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // execution/expectation
    await eRC721OnChain.burn(tokenId, {from: account}).should.be.eventually.rejectedWith(error);
  });

  it("should invoke `setTokenURI`", async () => {
    // preparation
    const tokenURI = "Some string with describe token";
    const tokenId = 55;
    // mint to avoid `owner query for nonexistent token` error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // execution
    const res = await eRC721OnChain.setTokenURI(tokenId, tokenURI, {from: deployer});
    // expectation
    expect(res.receipt.status).to.be.true;
  });

});
