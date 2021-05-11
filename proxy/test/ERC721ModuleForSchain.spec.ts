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
 * @file ERC721ModuleForSchain.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    ERC721ModuleForSchain,
    ERC721OnChain,
    LockAndDataForSchainERC721,
    LockAndDataForSchain,
    MessagesTester,
    TokenFactory
    } from "../typechain";

import { randomString, stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised));

// tslint:disable-next-line: no-var-requires
const ABIERC721OnChain = require("../artifacts/contracts/schain/TokenFactory.sol/ERC721OnChain.json");

import { deployMessages } from "./utils/deploy/messages";
import { deployTokenFactory } from "./utils/deploy/schain/tokenFactory";
import { deployERC721ModuleForSchain } from "./utils/deploy/schain/erc721ModuleForSchain";
import { deployLockAndDataForSchain } from "./utils/deploy/schain/lockAndDataForSchain";
import { deployLockAndDataForSchainERC721 } from "./utils/deploy/schain/lockAndDataForSchainERC721";
import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("ERC721ModuleForSchain", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let invoker: SignerWithAddress;

  let lockAndDataForSchain: LockAndDataForSchain;
  let lockAndDataForSchainERC721: LockAndDataForSchainERC721;
  let tokenFactory: TokenFactory;
  let eRC721ModuleForSchain: ERC721ModuleForSchain;
  let eRC721OnChain: ERC721OnChain;
  let eRC721OnMainnet: ERC721OnChain;
  let messages: MessagesTester;

  before(async () => {
    [deployer, user, invoker] = await ethers.getSigners();
  });

  beforeEach(async () => {
    lockAndDataForSchain = await deployLockAndDataForSchain();
    lockAndDataForSchainERC721 = await deployLockAndDataForSchainERC721(lockAndDataForSchain);
    tokenFactory = await deployTokenFactory(lockAndDataForSchain);
    eRC721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721");
    eRC721OnMainnet = await deployERC721OnChain("SKALE", "SKL");
    eRC721ModuleForSchain = await deployERC721ModuleForSchain(lockAndDataForSchain);
    messages = await deployMessages();
  });

  it("should rejected with `ERC721 contract does not exist on SKALE chain`", async () => {
    // preparation
    const error = "ERC721 contract does not exist on SKALE chain";
    const contractHere = eRC721OnChain.address;
    const schainID = randomString(10);
    const to = user.address;
    const tokenId = 1;
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
    await lockAndDataForSchainERC721.connect(deployer).enableAutomaticDeploy(schainID);
    // execution/expectation
    await eRC721ModuleForSchain.connect(deployer).receiveERC721(schainID, contractHere , to, tokenId)
      .should.be.eventually.rejectedWith(error);
  });

  it("should invoke `receiveERC721`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const contractThere = eRC721OnMainnet.address;
    const schainID = randomString(10);
    const to = user.address;
    const tokenId = 1;
    // to avoid "Message sender is invalid" error
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("ERC721Module", eRC721ModuleForSchain.address);
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
    await lockAndDataForSchainERC721.connect(deployer).enableAutomaticDeploy(schainID);
    // add ERC721 token to avoid "ERC721 contract does not exist on SKALE chain" error
    await lockAndDataForSchainERC721
      .connect(deployer)
      .addERC721ForSchain(schainID, eRC721OnMainnet.address, contractHere);
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
    // transfer ERC721 token to `lockAndDataForMainnetERC721` to avoid "Token not transferred" error
    await eRC721OnChain.connect(deployer).transferFrom(deployer.address, lockAndDataForSchainERC721.address, tokenId);
    // execution
    const res = await eRC721ModuleForSchain.connect(deployer).callStatic.receiveERC721(schainID, contractThere , to, tokenId);
    // expectation
    (res).should.include("0x");
  });

  it("should return `true` for `sendERC721`", async () => {
    // preparation
    const to = user.address;
    const schainID = randomString(10);
    const tokenId = 2;
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("ERC721Module", eRC721ModuleForSchain.address);
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("TokenFactory", tokenFactory.address);
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
    const data = await messages.encodeTransferErc721AndTokenInfoMessage(
      eRC721OnMainnet.address,
      to,
      tokenId,
      {
        name: await eRC721OnMainnet.name(),
        symbol: await eRC721OnMainnet.symbol()
      });
    await lockAndDataForSchainERC721.connect(deployer).enableAutomaticDeploy(schainID);
    // execution
    const res = await (await eRC721ModuleForSchain.connect(deployer).sendERC721(schainID, data)).wait();
    // expectation
    // get new token address
    let newAddress = null;
    if (res.events)
      newAddress = res.events[5].args?.contractOnSchain;
    else
      assert(false, "No events were emitted");
    const newERC721Contract = new web3.eth.Contract(ABIERC721OnChain.abi, newAddress);
    expect(await newERC721Contract.methods.ownerOf(tokenId).call()).to.be.equal(to);
  });

  it("should return `true` when invoke `sendERC721`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const contractThere = eRC721OnMainnet.address;
    const schainID = randomString(10);
    const to = user.address;
    const tokenId = 2;
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("ERC721Module", eRC721ModuleForSchain.address);
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("TokenFactory", tokenFactory.address);
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
    // transfer tokenId from `deployer` to `lockAndDataForSchainERC721`
    await eRC721OnChain.connect(deployer).transferFrom(deployer.address,
      lockAndDataForSchainERC721.address, tokenId);
    await lockAndDataForSchainERC721.connect(deployer).enableAutomaticDeploy(schainID);
    // add ERC721 token to avoid "ERC721 contract does not exist on SKALE chain" error
    await lockAndDataForSchainERC721
      .connect(deployer)
      .addERC721ForSchain(schainID, contractThere, contractHere);
    // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
    const minterRole = await eRC721OnChain.MINTER_ROLE();
    await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
    // get data from `receiveERC721`
    await eRC721ModuleForSchain.connect(deployer).receiveERC721(schainID, contractThere , to, tokenId);
    // execution
    const data = await messages.encodeTransferErc721AndTokenInfoMessage(
      contractThere,
      to,
      tokenId,
      {
        name: await eRC721OnMainnet.name(),
        symbol: await eRC721OnMainnet.symbol()
      }
    );
    await eRC721ModuleForSchain.connect(deployer).sendERC721(schainID, data);
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user.address);
  });

  it("should return `receiver` when invoke `getReceiver`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const contractThere = eRC721OnMainnet.address;
    const schainID = randomString(10);
    const to = user.address;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const tokenId = 10;
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("ERC721Module", eRC721ModuleForSchain.address);
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
    await lockAndDataForSchainERC721.connect(deployer).enableAutomaticDeploy(schainID);
    // add ERC721 token to avoid "ERC721 contract does not exist on SKALE chain" error
    await lockAndDataForSchainERC721
      .connect(deployer)
      .addERC721ForSchain(schainID, contractThere, contractHere);
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
    // transfer ERC721 token to `lockAndDataForMainnetERC721` to avoid "Token not transferred" error
    await eRC721OnChain.connect(deployer).transferFrom(deployer.address, lockAndDataForSchainERC721.address, tokenId);
    // get data from `receiveERC721`
    await eRC721ModuleForSchain.connect(deployer).receiveERC721(schainID, contractThere , to, tokenId);
    // execution
    const data = await messages.encodeTransferErc721AndTokenInfoMessage(
      contractThere,
      to,
      tokenId,
      {
        name: await eRC721OnMainnet.name(),
        symbol: await eRC721OnMainnet.symbol()
      }
    )
    const res = await eRC721ModuleForSchain.connect(deployer).getReceiver(data);
    // expectation
    res.should.be.equal(user.address);
  });

});
