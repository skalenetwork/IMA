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
    } from "../types/truffle-contracts";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForSchainERC721: LockAndDataForSchainERC721Contract =
    artifacts.require("./LockAndDataForSchainERC721");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");

contract("LockAndDataForSchainERC721", ([deployer, user]) => {
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForSchainERC721: LockAndDataForSchainERC721Instance;
  let eRC721OnChain: ERC721OnChainInstance;
  let eRC721OnChain2: ERC721OnChainInstance;
  let eRC721OnMainnet: ERC721OnChainInstance;
  let eRC721OnMainnet2: ERC721OnChainInstance;

  beforeEach(async () => {
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchainERC721 =
        await LockAndDataForSchainERC721.new(lockAndDataForSchain.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
    eRC721OnChain = await ERC721OnChain.new("ELVIS", "ELV", {from: deployer});
    eRC721OnMainnet = await ERC721OnChain.new("SKALE", "SKL", {from: deployer});

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

  it("should rejected with `Token not transferred` after invoke `receiveERC721`", async () => {
    // preparation
    const error = "Token not transferred";
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
    const schainID = randomString(10);
    await lockAndDataForSchainERC721
        .addERC721ForSchain(schainID, eRC721OnMainnet.address, addressERC721, {from: deployer}).should.be.eventually.rejectedWith("Automatic deploy is disabled");
    await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
    // execution
    await lockAndDataForSchainERC721
        .addERC721ForSchain(schainID, eRC721OnMainnet.address, addressERC721, {from: deployer});
    // expectation
    expect(await lockAndDataForSchainERC721.getERC721OnSchain(schainID, eRC721OnMainnet.address,)).to.be.equal(addressERC721);
  });

  it("should add token by owner", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const contractHere2 = eRC721OnMainnet.address;
    const schainID = randomString(10);

    const automaticDeploy = await lockAndDataForSchainERC721.automaticDeploy(web3.utils.soliditySha3(schainID));
    await lockAndDataForSchainERC721.addERC721TokenByOwner(schainID, contractHere2, contractHere);
    // automaticDeploy == true - enabled automaticDeploy = false - disabled
    if (automaticDeploy) {
      await lockAndDataForSchainERC721.disableAutomaticDeploy(schainID);
    } else {
      await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID);
    }

    await lockAndDataForSchainERC721.addERC721TokenByOwner(schainID, contractHere2, contractHere);

    eRC721OnChain2 = await ERC721OnChain.new("NewToken", "NTN");
    eRC721OnMainnet2 = await ERC721OnChain.new("NewToken", "NTN");

    if (automaticDeploy) {
      await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID);
    } else {
      await lockAndDataForSchainERC721.disableAutomaticDeploy(schainID);
    }

    await lockAndDataForSchainERC721.addERC721TokenByOwner(schainID, eRC721OnMainnet2.address, eRC721OnChain2.address);

  });

});
