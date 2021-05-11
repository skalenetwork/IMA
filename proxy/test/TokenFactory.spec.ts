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

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    ERC20ModuleForSchain,
    ERC20OnChain,
    ERC721ModuleForSchain,
    ERC721OnChain,
    LockAndDataForSchainWorkaround,
    LockAndDataForSchainERC20,
    LockAndDataForSchainERC721,
    MessageProxyForSchain,
    TokenFactory,
  } from "../typechain";

chai.should();
chai.use((chaiAsPromised));

import { deployLockAndDataForSchainWorkaround } from "./utils/deploy/test/lockAndDataForSchainWorkaround";
import { deployLockAndDataForSchainERC20 } from "./utils/deploy/schain/lockAndDataForSchainERC20";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployLockAndDataForSchainERC721 } from "./utils/deploy/schain/lockAndDataForSchainERC721";
import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";
import { deployERC20ModuleForSchain } from "./utils/deploy/schain/erc20ModuleForSchain";
import { deployERC721ModuleForSchain } from "./utils/deploy/schain/erc721ModuleForSchain";
import { deployTokenFactory } from "./utils/deploy/schain/tokenFactory";
import { deployMessageProxyForSchain } from "./utils/deploy/schain/messageProxyForSchain";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("TokenFactory", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  let messageProxy: MessageProxyForSchain;
  let lockAndDataForSchain: LockAndDataForSchainWorkaround;
  let tokenFactory: TokenFactory;
  let eRC20ModuleForSchain: ERC20ModuleForSchain;
  let lockAndDataForSchainERC20: LockAndDataForSchainERC20;
  let eRC721ModuleForSchain: ERC721ModuleForSchain;
  let lockAndDataForSchainERC721: LockAndDataForSchainERC721;

  before(async () => {
    [deployer, user] = await ethers.getSigners();
  });

  beforeEach(async () => {
    lockAndDataForSchain = await deployLockAndDataForSchainWorkaround();
    lockAndDataForSchainERC721 = await deployLockAndDataForSchainERC721(lockAndDataForSchain);
    lockAndDataForSchainERC20 = await deployLockAndDataForSchainERC20(lockAndDataForSchain);
    eRC20ModuleForSchain = await deployERC20ModuleForSchain(lockAndDataForSchain);
    eRC721ModuleForSchain = await deployERC721ModuleForSchain(lockAndDataForSchain);
    tokenFactory = await deployTokenFactory(lockAndDataForSchain);
    messageProxy = await deployMessageProxyForSchain("Mainnet");
  });

  it("should createERC20", async () => {
    // preparation
    const to = user.address;
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
      .connect(deployer)
      .setContract("ERC20Module", eRC20ModuleForSchain.address);
    // set `LockAndDataERC20` to avoid `Roles: account is the zero address` error
    await lockAndDataForSchain
      .connect(deployer)
      .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
    // execution
    const res = await tokenFactory.connect(deployer).callStatic.createERC20("elvis", "ELV");
    // expectation
    expect(res).to.include("0x");
  });

  it("should createERC721", async () => {
    // preparation
    const to = user.address;
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
        .connect(deployer)
        .setContract("ERC721Module", eRC721ModuleForSchain.address);
    // set `LockAndDataERC721` to avoid `Roles: account is the zero address` error
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
    // execution
    const res = await tokenFactory.connect(deployer).callStatic.createERC721("elvis", "ELV");
    // expectation
    expect(res).to.include("0x");
  });

});

describe("ERC20OnChain", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  let messageProxy: MessageProxyForSchain;
  let lockAndDataForSchain: LockAndDataForSchainWorkaround;
  let eRC20OnChain: ERC20OnChain;
  let eRC20ModuleForSchain: ERC20ModuleForSchain;

  before(async () => {
    [deployer, user] = await ethers.getSigners();
  });

  beforeEach(async () => {  
    lockAndDataForSchain = await deployLockAndDataForSchainWorkaround();
    eRC20ModuleForSchain = await deployERC20ModuleForSchain(lockAndDataForSchain);
    messageProxy = await deployMessageProxyForSchain("Mainnet");

    await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address);
    eRC20OnChain = await deployERC20OnChain("ERC20OnChain", "ERC20");
  });

  it("should invoke `_mint` as internal", async () => {
    // preparation
    const account = user.address;
    const value = 500;
    // execution
    await eRC20OnChain.connect(deployer).mint(account, value);
    // expectation
    const balance = await eRC20OnChain.balanceOf(account);
    parseInt(BigNumber.from(balance).toString(), 10).should.be.equal(value);
  });

  it("should invoke `burn`", async () => {
    // preparation
    const amount = 500;
    const mintAmount = 1500;
    // mint to avoid `SafeMath: subtraction overflow` error
    await eRC20OnChain.connect(deployer).mint(deployer.address, mintAmount);
    // execution
    await eRC20OnChain.connect(deployer).burn(amount);
    // expectation
    const balance = await eRC20OnChain.balanceOf(deployer.address);
    parseInt(BigNumber.from(balance).toString(), 10).should.be.equal(mintAmount - amount);
  });

  it("should invoke `burnFrom`", async () => {
    // preparation
    const account = user.address;
    const amount = 100;
    const mintAmount = 200;
    // mint to avoid `SafeMath: subtraction overflow` error
    await eRC20OnChain.connect(deployer).mint(account, mintAmount);
    // approve to avoid `SafeMath: subtraction overflow` error
    await eRC20OnChain.connect(user).approve(deployer.address, 100);
    // execution
    await eRC20OnChain.connect(deployer).burnFrom(account, amount);
    // expectation
    const balance = await eRC20OnChain.balanceOf(account);
    parseInt(BigNumber.from(balance).toString(), 10).should.be.equal(mintAmount - amount);
  });
});

describe("ERC721OnChain", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  let messageProxy: MessageProxyForSchain;
  let lockAndDataForSchain: LockAndDataForSchainWorkaround;
  let eRC721OnChain: ERC721OnChain;

  before(async () => {
    [deployer, user] = await ethers.getSigners();
  });

  beforeEach(async () => {
    lockAndDataForSchain = await deployLockAndDataForSchainWorkaround();
    messageProxy = await deployMessageProxyForSchain("Mainnet");
    eRC721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721");
  });

  it("should invoke `mint`", async () => {
    // preparation
    const account = user.address;
    const tokenId = 500;
    // execution
    await eRC721OnChain.connect(deployer).mint(account, tokenId);
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(account);
  });

  it("should invoke `burn`", async () => {
    // preparation
    const error = "ERC721: owner query for nonexistent token";
    const tokenId = 55;
    // mint to avoid `owner query for nonexistent token` error
    await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
    // execution
    await eRC721OnChain.connect(deployer).burn(tokenId);
    // expectation
    await eRC721OnChain.ownerOf(tokenId).should.be.eventually.rejectedWith(error);
  });

  it("should reject with `ERC721Burnable: caller is not owner nor approved` when invoke `burn`", async () => {
    // preparation
    const error = "ERC721Burnable: caller is not owner nor approved";
    const tokenId = 55;
    const account = user.address;
    // mint to avoid `owner query for nonexistent token` error
    await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
    // execution/expectation
    await eRC721OnChain.connect(user).burn(tokenId).should.be.eventually.rejectedWith(error);
  });

  it("should invoke `setTokenURI`", async () => {
    // preparation
    const tokenURI = "Some string with describe token";
    const tokenId = 55;
    // mint to avoid `owner query for nonexistent token` error
    await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
    // execution
    const res = await (await eRC721OnChain.connect(deployer).setTokenURI(tokenId, tokenURI)).wait();
    // expectation
    expect(res.status).to.be.equal(1);
  });

});
