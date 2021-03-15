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
 * @file DepositBoxERC721.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC721OnChainContract,
    ERC721OnChainInstance,
    DepositBoxERC721Instance,
    LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainInstance,
    } from "../types/truffle-contracts";

import chai = require("chai");

chai.should();
chai.use((chaiAsPromised as any));

import { deployLockAndDataForMainnet } from "./utils/deploy/lockAndDataForMainnet";
import { deployDepositBoxERC721 } from "./utils/deploy/DepositBoxERC721";
import { randomString } from "./utils/helper";

const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");

contract("DepositBoxERC721", ([deployer, user, invoker]) => {
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let DepositBoxERC721: DepositBoxERC721Instance;
  let eRC721OnChain: ERC721OnChainInstance;
  let erc721OnChain2: ERC721OnChainInstance;

  beforeEach(async () => {
    lockAndDataForMainnet = await deployLockAndDataForMainnet();
    DepositBoxERC721 = await deployDepositBoxERC721(lockAndDataForMainnet);
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
    await lockAndDataForSchain.setContract("LockAndDataERC721", DepositBoxERC721.address);
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
    const res = await DepositBoxERC721
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
    // transfer tokenId from `deployer` to `DepositBoxERC721`
    await eRC721OnChain.transferFrom(deployer,
        DepositBoxERC721.address, tokenId, {from: deployer});
    // execution
    const res = await DepositBoxERC721
        .sendERC721(contractHere, to, tokenId, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user);
  });

  it("should add ERC721 token when invoke `sendERC721`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const schainID = randomString(10);
    // execution#1
    await DepositBoxERC721
        .addERC721ForSchain(schainID, contractHere, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
    await DepositBoxERC721.disableWhitelist(schainID);
    await DepositBoxERC721.addERC721ForSchain(schainID, contractHere, {from: deployer});
    const res = await DepositBoxERC721.getSchainToERC721(schainID, contractHere);
    // expectation#1
    res.should.be.equal(true);
  });

  it("should add token by owner", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const schainID = randomString(10);

    const whitelist = await DepositBoxERC721.withoutWhitelist(web3.utils.soliditySha3(schainID));
    await DepositBoxERC721.addERC721TokenByOwner(schainID, contractHere);
    // whitelist == true - disabled whitelist = false - enabled
    if (whitelist) {
      await DepositBoxERC721.enableWhitelist(schainID);
    } else {
      await DepositBoxERC721.disableWhitelist(schainID);
    }

    await DepositBoxERC721.addERC721TokenByOwner(schainID, contractHere);

    erc721OnChain2 = await ERC721OnChain.new("NewToken", "NTN");

    if (whitelist) {
      await DepositBoxERC721.disableWhitelist(schainID);
    } else {
      await DepositBoxERC721.enableWhitelist(schainID);
    }
    await DepositBoxERC721.addERC721TokenByOwner(schainID, erc721OnChain2.address);
  });

});
