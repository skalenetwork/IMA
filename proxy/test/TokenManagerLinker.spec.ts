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

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
  TokenManagerEth,
  TokenManagerERC20,
  TokenManagerERC721,
  TokenManagerLinker,
  MessageProxyForSchain,
  } from "../typechain";
import { randomString, stringValue } from "./utils/helper";


chai.should();
chai.use((chaiAsPromised as any));

import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployTokenManagerEth } from "./utils/deploy/schain/tokenManagerEth";
import { deployTokenManagerERC20 } from "./utils/deploy/schain/tokenManagerERC20";
import { deployTokenManagerERC721 } from "./utils/deploy/schain/tokenManagerERC721";
import { deployMessageProxyForSchain } from "./utils/deploy/schain/messageProxyForSchain";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("TokenManagerLinker", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;

  let tokenManagerEth: TokenManagerEth;
  let tokenManagerERC20: TokenManagerERC20;
  let tokenManagerERC721: TokenManagerERC721;
  let messageProxy: MessageProxyForSchain;
  let linker: TokenManagerLinker;
  const schainName = "TestSchain";
  let fakeDepositBox: any;

  before(async () => {
    [deployer, user, user2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    messageProxy = await deployMessageProxyForSchain(schainName);
    linker = await deployTokenManagerLinker(messageProxy);
    fakeDepositBox = linker.address;
    tokenManagerEth = await deployTokenManagerEth(schainName, messageProxy.address, linker, fakeDepositBox);
    tokenManagerERC20 = await deployTokenManagerERC20(schainName, messageProxy.address, linker, fakeDepositBox);
    tokenManagerERC721 = await deployTokenManagerERC721(schainName, messageProxy.address, linker, fakeDepositBox);
    const chainConnectorRole = await messageProxy.CHAIN_CONNECTOR_ROLE();
    await messageProxy.connect(deployer).grantRole(chainConnectorRole, linker.address);
  });

it("should connect schain", async () => {
  const schainID = randomString(10);
  const nullAddress = "0x0000000000000000000000000000000000000000";

  // only owner can add schain:
  await linker.connect(user).connectSchain(schainID, []).should.be.rejected;

  // Token Manager address shouldn't be equal zero:
  await linker.connect(deployer).connectSchain(schainID, [nullAddress])
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

  await linker.connect(deployer).connectSchain(schainID, []);
});

it("should connect schain with 1 tokenManager", async() => {
  const schainID = randomString(10);
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const tokenManagerAddress = user.address;

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);

  await linker.connect(deployer).registerTokenManager(tokenManagerEth.address);

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(true);

  await linker.connect(deployer).connectSchain(schainID, [])
    .should.be.eventually.rejectedWith("Incorrect number of addresses");

  await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress, nullAddress])
    .should.be.eventually.rejectedWith("Incorrect number of addresses");

  expect(await linker.hasSchain(schainID)).to.equal(false);

  await linker.connect(deployer).connectSchain(schainID, [nullAddress])
    .should.be.eventually.rejectedWith("Incorrect Token Manager address");

  await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress])

  expect(await linker.hasSchain(schainID)).to.equal(true);

});

it("should connect schain with 3 tokenManager", async() => {
  const schainID = randomString(10);
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const tokenManagerAddress = user.address;

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(false);

  await linker.connect(deployer).registerTokenManager(tokenManagerEth.address);
  await linker.connect(deployer).registerTokenManager(tokenManagerERC20.address);
  await linker.connect(deployer).registerTokenManager(tokenManagerERC721.address);

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(true);
  expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(true);
  expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(true);

  await linker.connect(deployer).connectSchain(schainID, [])
    .should.be.eventually.rejectedWith("Incorrect number of addresses");

  await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress])
    .should.be.eventually.rejectedWith("Incorrect number of addresses");

  await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress, nullAddress])
    .should.be.eventually.rejectedWith("Incorrect number of addresses");

  expect(await linker.hasSchain(schainID)).to.equal(false);

  await linker.connect(deployer).connectSchain(schainID, [nullAddress, tokenManagerAddress, nullAddress])
    .should.be.eventually.rejectedWith("Incorrect Token Manager address");

  await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress, tokenManagerAddress, tokenManagerAddress])

  expect(await linker.hasSchain(schainID)).to.equal(true);
});

it("should invoke `unconnectSchain` without mistakes", async () => {
  const schainID = randomString(10);
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const tokenManagerAddress = user.address;

  await linker.connect(deployer).registerTokenManager(tokenManagerEth.address);
  await linker.connect(deployer).registerTokenManager(tokenManagerERC20.address);
  await linker.connect(deployer).registerTokenManager(tokenManagerERC721.address);

  await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress, tokenManagerAddress, tokenManagerAddress]);

  expect(await linker.hasSchain(schainID)).to.equal(true);

  await linker.connect(user).disconnectSchain(schainID).should.be.rejected;
  await linker.connect(deployer).disconnectSchain(schainID);

  expect(await linker.hasSchain(schainID)).to.equal(false);
});

it("should register and remove tokenManagers", async () => {
  const nullAddress = "0x0000000000000000000000000000000000000000";
  const tokenManagerAddress = user.address;

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(false);

  await linker.connect(deployer).registerTokenManager(tokenManagerEth.address);
  await linker.connect(deployer).registerTokenManager(tokenManagerERC20.address);
  await linker.connect(deployer).registerTokenManager(tokenManagerERC721.address);

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(true);
  expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(true);
  expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(true);

  expect(await linker.hasTokenManager(nullAddress)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(false);

  await linker.connect(user).registerTokenManager(nullAddress).should.be.rejected;
  await linker.connect(deployer).registerTokenManager(nullAddress);

  expect(await linker.hasTokenManager(nullAddress)).to.equal(true);
  expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(false);

  await linker.connect(deployer).registerTokenManager(tokenManagerAddress);

  expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(true);

  await linker.connect(user).removeTokenManager(tokenManagerAddress).should.be.rejected;
  await linker.connect(deployer).removeTokenManager(tokenManagerAddress);

  expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(false);

  await linker.connect(deployer).removeTokenManager(nullAddress);

  expect(await linker.hasTokenManager(nullAddress)).to.equal(false);

  await linker.connect(deployer).removeTokenManager(tokenManagerEth.address);
  await linker.connect(deployer).removeTokenManager(tokenManagerERC20.address);
  await linker.connect(deployer).removeTokenManager(tokenManagerERC721.address);

  expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(false);
  expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(false);
});

});
