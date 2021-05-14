// // SPDX-License-Identifier: AGPL-3.0-only

// /**
//  * @license
//  * SKALE IMA
//  *
//  * This program is free software: you can redistribute it and/or modify
//  * it under the terms of the GNU Affero General Public License as published by
//  * the Free Software Foundation, either version 3 of the License, or
//  * (at your option) any later version.
//  *
//  * This program is distributed in the hope that it will be useful,
//  * but WITHOUT ANY WARRANTY; without even the implied warranty of
//  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  * GNU Affero General Public License for more details.
//  *
//  * You should have received a copy of the GNU Affero General Public License
//  * along with this program.  If not, see <https://www.gnu.org/licenses/>.
//  */

// /**
//  * @file DepositBox.spec.ts
//  * @copyright SKALE Labs 2019-Present
//  */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
  TokenManagerEthContract,
  TokenManagerEthInstance,
  TokenManagerERC20Contract,
  TokenManagerERC20Instance,
  TokenManagerERC721Contract,
  TokenManagerERC721Instance,
  TokenManagerLinkerContract,
  TokenManagerLinkerInstance,
  MessageProxyForSchainContract,
  MessageProxyForSchainInstance,
  } from "../types/truffle-contracts";
import { randomString } from "./utils/helper";

import chai = require("chai");

chai.should();
chai.use((chaiAsPromised as any));

const TokenManagerEth: TokenManagerEthContract = artifacts.require("./TokenManagerEth");
const TokenManagerERC20: TokenManagerERC20Contract = artifacts.require("./TokenManagerERC20");
const TokenManagerERC721: TokenManagerERC721Contract = artifacts.require("./TokenManagerERC721");
const TokenManagerLinker: TokenManagerLinkerContract = artifacts.require("./TokenManagerLinker");
const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");

contract("TokenManagerLinker", ([deployer, user, user2]) => {
  let tokenManagerEth: TokenManagerEthInstance;
  let tokenManagerERC20: TokenManagerERC20Instance;
  let tokenManagerERC721: TokenManagerERC721Instance;
  let messageProxy: MessageProxyForSchainInstance;
  let linker: TokenManagerLinkerInstance;
  const schainName = "TestSchain";
  let fakeDepositBox: any;

  beforeEach(async () => {
    messageProxy = await MessageProxyForSchain.new(schainName);
    linker = await TokenManagerLinker.new(messageProxy.address);
    fakeDepositBox = linker.address;
    tokenManagerEth = await TokenManagerEth.new(schainName, messageProxy.address, linker.address, fakeDepositBox);
    tokenManagerERC20 = await TokenManagerERC20.new(schainName, messageProxy.address, linker.address, fakeDepositBox);
    tokenManagerERC721 = await TokenManagerERC721.new(schainName, messageProxy.address, linker.address, fakeDepositBox);
    const chainConnectorRole = await messageProxy.CHAIN_CONNECTOR_ROLE();
    await messageProxy.grantRole(chainConnectorRole, linker.address, {from: deployer});
  });

it("should connect schain", async () => {
  const schainID = randomString(10);
  const nullAddress = "0x0000000000000000000000000000000000000000";

  // only owner can add schain:
  await linker.connectSchain(schainID, [], {from: user}).should.be.rejected;

  // Token Manager address shouldn't be equal zero:
  await linker.connectSchain(schainID, [nullAddress], {from: deployer})
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

  await linker.connectSchain(schainID, [], {from: deployer});
});

it("should connect schain with 1 tokenManager", async() => {
  const schainID = randomString(10);
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const tokenManagerAddress = user;

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);

  await linker.registerTokenManager(tokenManagerEth.address, {from: deployer});

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(true);

  await linker.connectSchain(schainID, [], {from: deployer})
    .should.be.eventually.rejectedWith("Incorrect number of addresses");

  await linker.connectSchain(schainID, [tokenManagerAddress, nullAddress], {from: deployer})
    .should.be.eventually.rejectedWith("Incorrect number of addresses");

  expect(await linker.hasSchain(schainID)).to.equal(false);

  await linker.connectSchain(schainID, [nullAddress], {from: deployer})
    .should.be.eventually.rejectedWith("Incorrect Token Manager address");

  await linker.connectSchain(schainID, [tokenManagerAddress], {from: deployer})

  expect(await linker.hasSchain(schainID)).to.equal(true);

});

it("should connect schain with 3 tokenManager", async() => {
  const schainID = randomString(10);
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const tokenManagerAddress = user;

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(false);

  await linker.registerTokenManager(tokenManagerEth.address, {from: deployer});
  await linker.registerTokenManager(tokenManagerERC20.address, {from: deployer});
  await linker.registerTokenManager(tokenManagerERC721.address, {from: deployer});

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(true);
  expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(true);
  expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(true);

  await linker.connectSchain(schainID, [], {from: deployer})
    .should.be.eventually.rejectedWith("Incorrect number of addresses");

  await linker.connectSchain(schainID, [tokenManagerAddress], {from: deployer})
    .should.be.eventually.rejectedWith("Incorrect number of addresses");

  await linker.connectSchain(schainID, [tokenManagerAddress, nullAddress], {from: deployer})
    .should.be.eventually.rejectedWith("Incorrect number of addresses");

  expect(await linker.hasSchain(schainID)).to.equal(false);

  await linker.connectSchain(schainID, [nullAddress, tokenManagerAddress, nullAddress], {from: deployer})
    .should.be.eventually.rejectedWith("Incorrect Token Manager address");

  await linker.connectSchain(schainID, [tokenManagerAddress, tokenManagerAddress, tokenManagerAddress], {from: deployer})

  expect(await linker.hasSchain(schainID)).to.equal(true);
});

it("should invoke `unconnectSchain` without mistakes", async () => {
  const schainID = randomString(10);
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const tokenManagerAddress = user;

  await linker.registerTokenManager(tokenManagerEth.address, {from: deployer});
  await linker.registerTokenManager(tokenManagerERC20.address, {from: deployer});
  await linker.registerTokenManager(tokenManagerERC721.address, {from: deployer});

  await linker.connectSchain(schainID, [tokenManagerAddress, tokenManagerAddress, tokenManagerAddress], {from: deployer});

  expect(await linker.hasSchain(schainID)).to.equal(true);

  await linker.disconnectSchain(schainID, {from: user}).should.be.rejected;
  await linker.disconnectSchain(schainID, {from: deployer});

  expect(await linker.hasSchain(schainID)).to.equal(false);
});

it("should register and remove tokenManagers", async () => {
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const tokenManagerAddress = user;

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(false);

  await linker.registerTokenManager(tokenManagerEth.address, {from: deployer});
  await linker.registerTokenManager(tokenManagerERC20.address, {from: deployer});
  await linker.registerTokenManager(tokenManagerERC721.address, {from: deployer});

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(true);
  expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(true);
  expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(true);

  expect(await linker.hasTokenManager(nullAddress)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(false);

  await linker.registerTokenManager(nullAddress, {from: user}).should.be.rejected;
  await linker.registerTokenManager(nullAddress, {from: deployer});

  expect(await linker.hasTokenManager(nullAddress)).to.equal(true);
  expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(false);

  await linker.registerTokenManager(tokenManagerAddress, {from: deployer});

  expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(true);

  await linker.removeTokenManager(tokenManagerAddress, {from: user}).should.be.rejected;
  await linker.removeTokenManager(tokenManagerAddress, {from: deployer});

  expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(false);

  await linker.removeTokenManager(nullAddress, {from: deployer});

  expect(await linker.hasTokenManager(nullAddress)).to.equal(false);

  await linker.removeTokenManager(tokenManagerEth.address, {from: deployer});
  await linker.removeTokenManager(tokenManagerERC20.address, {from: deployer});
  await linker.removeTokenManager(tokenManagerERC721.address, {from: deployer});

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(false);
});

});
