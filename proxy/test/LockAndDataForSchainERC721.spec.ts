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

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
  ERC721OnChain,
  LockAndDataForSchainERC721,
  LockAndDataForSchain,
  } from "../typechain";

import { gasMultiplier } from "./utils/command_line";
import { randomString, stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised));

import { deployLockAndDataForSchain } from "./utils/deploy/schain/lockAndDataForSchain";
import { deployLockAndDataForSchainERC721 } from "./utils/deploy/schain/lockAndDataForSchainERC721";
import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("LockAndDataForSchainERC721", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  let lockAndDataForSchain: LockAndDataForSchain;
  let lockAndDataForSchainERC721: LockAndDataForSchainERC721;
  let eRC721OnChain: ERC721OnChain;
  let eRC721OnChain2: ERC721OnChain;
  let eRC721OnMainnet: ERC721OnChain;
  let eRC721OnMainnet2: ERC721OnChain;

  before(async () => {
    [deployer, user] = await ethers.getSigners();
  });

  beforeEach(async () => {
    lockAndDataForSchain = await deployLockAndDataForSchain();
    lockAndDataForSchainERC721 = await deployLockAndDataForSchainERC721(lockAndDataForSchain);
    eRC721OnChain = await deployERC721OnChain("ELVIS", "ELV");
    eRC721OnMainnet = await deployERC721OnChain("SKALE", "SKL");

  });

  it("should invoke `sendERC721` without mistakes", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user.address;
    const tokenId = 10;
    // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
    const minterRole = await eRC721OnChain.MINTER_ROLE();
    await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
    // execution
    const res = await (await lockAndDataForSchainERC721
        .connect(deployer)
        .sendERC721(contractHere, to, tokenId)).wait();
    // expectation
    if (res.events) {
      expect(res.events[1].args?.result).to.be.true;
    } else {
      assert(false, "No events were emitted");
    }
  });

  it("should rejected with `Token not transferred` after invoke `receiveERC721`", async () => {
    // preparation
    const error = "Token not transferred";
    const contractHere = eRC721OnChain.address;
    const tokenId = 10;
    // mint some quantity of ERC721 tokens for `deployer` address
    await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
    // execution/expectation
    await lockAndDataForSchainERC721
        .connect(deployer)
        .receiveERC721(contractHere, tokenId)
        .should.be.eventually.rejectedWith(error);
  });

  it("should return `true` after invoke `receiveERC721`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const tokenId = 10;
    // mint ERC721 token for `deployer` address
    await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
    // transfer ERC721 token to `lockAndDataForMainnetERC721` address
    await eRC721OnChain.connect(deployer).transferFrom(deployer.address, lockAndDataForSchainERC721.address, tokenId);
    // execution
    const res = await (await lockAndDataForSchainERC721
        .connect(deployer)
        .receiveERC721(contractHere, tokenId)).wait();
    // expectation
    if (res.events) {
      expect(res.events[2].args?.result).to.be.true;
    } else {
      assert(false, "No events were emitted");
    }
  });

  it("should set `ERC721Tokens` and `ERC721Mapper`", async () => {
    // preparation
    const addressERC721 = eRC721OnChain.address;
    const schainID = randomString(10);
    await lockAndDataForSchainERC721
        .connect(deployer)
        .addERC721ForSchain(schainID, eRC721OnMainnet.address, addressERC721).should.be.eventually.rejectedWith("Automatic deploy is disabled");
    await lockAndDataForSchainERC721.connect(deployer).enableAutomaticDeploy(schainID);
    // execution
    await lockAndDataForSchainERC721
        .connect(deployer)
        .addERC721ForSchain(schainID, eRC721OnMainnet.address, addressERC721);
    // expectation
    expect(await lockAndDataForSchainERC721.getERC721OnSchain(schainID, eRC721OnMainnet.address,)).to.be.equal(addressERC721);
  });

  it("should add token by owner", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const contractHere2 = eRC721OnMainnet.address;
    const schainID = randomString(10);

    const automaticDeploy = await lockAndDataForSchainERC721.automaticDeploy(stringValue(web3.utils.soliditySha3(schainID)));
    await lockAndDataForSchainERC721.addERC721TokenByOwner(schainID, contractHere2, contractHere);
    // automaticDeploy == true - enabled automaticDeploy = false - disabled
    if (automaticDeploy) {
      await lockAndDataForSchainERC721.disableAutomaticDeploy(schainID);
    } else {
      await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID);
    }

    await lockAndDataForSchainERC721.addERC721TokenByOwner(schainID, contractHere2, contractHere);

    eRC721OnChain2 = await deployERC721OnChain("NewToken", "NTN");
    eRC721OnMainnet2 = await deployERC721OnChain("NewToken", "NTN");

    if (automaticDeploy) {
      await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID);
    } else {
      await lockAndDataForSchainERC721.disableAutomaticDeploy(schainID);
    }

    await lockAndDataForSchainERC721.addERC721TokenByOwner(schainID, eRC721OnMainnet2.address, eRC721OnChain2.address);

  });

});
