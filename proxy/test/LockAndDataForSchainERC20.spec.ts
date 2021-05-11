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
 * @file LockAndDataForSchainERC20.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    ERC20OnChain,
    LockAndDataForSchainERC20,
    LockAndDataForSchain,
    } from "../typechain";

import { gasMultiplier } from "./utils/command_line";
import { randomString, stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised));

import { deployLockAndDataForSchain } from "./utils/deploy/schain/lockAndDataForSchain";
import { deployLockAndDataForSchainERC20 } from "./utils/deploy/schain/lockAndDataForSchainERC20";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("LockAndDataForSchainERC20", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let invoker: SignerWithAddress;

  let lockAndDataForSchain: LockAndDataForSchain;
  let lockAndDataForSchainERC20: LockAndDataForSchainERC20;
  let eRC20OnChain: ERC20OnChain;
  let eRC20OnChain2: ERC20OnChain;
  let eRC20OnMainnet: ERC20OnChain;
  let eRC20OnMainnet2: ERC20OnChain;

  before(async () => {
    [deployer, user, invoker] = await ethers.getSigners();
  });

  beforeEach(async () => {
    lockAndDataForSchain = await deployLockAndDataForSchain();
    lockAndDataForSchainERC20 = await deployLockAndDataForSchainERC20(lockAndDataForSchain);
    eRC20OnChain = await deployERC20OnChain("ERC20OnChain", "ERC20");
    eRC20OnMainnet = await deployERC20OnChain("SKALE", "SKL");
  });

  it("should invoke `sendERC20` without mistakes", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const to = user.address;
    const amount = 10;
    // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
    const minterRole = await eRC20OnChain.MINTER_ROLE();
    await eRC20OnChain.grantRole(minterRole, lockAndDataForSchainERC20.address);
    await lockAndDataForSchainERC20.setTotalSupplyOnMainnet(contractHere, 9);
    // execution
    await lockAndDataForSchainERC20
        .connect(deployer)
        .sendERC20(contractHere, to, amount).should.be.eventually.rejectedWith("Total supply exceeded");
    await lockAndDataForSchainERC20.setTotalSupplyOnMainnet(contractHere, 11);
    // execution
    const res = await (await lockAndDataForSchainERC20
        .connect(deployer)
        .sendERC20(contractHere, to, amount)).wait();
    // expectation
    if (res.events) {
      expect(res.events[1].args?.result).to.be.true;
    } else {
      assert(false, "No events were emitted");
    }
  });

  it("should rejected with `Amount not transferred`", async () => {
    // preparation
    const error = "Amount not transferred";
    const contractHere = eRC20OnChain.address;
    const amount = 10;
    // execution/expectation
    await lockAndDataForSchainERC20
        .connect(deployer)
        .receiveERC20(contractHere, amount)
        .should.be.eventually.rejectedWith(error);
  });

  it("should return `true` after invoke `receiveERC20`", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const amount = 10;
    // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
    const minterRole = await eRC20OnChain.MINTER_ROLE();
    await eRC20OnChain.grantRole(minterRole, lockAndDataForSchainERC20.address);
    // mint some quantity of ERC20 tokens for `deployer` address
    await eRC20OnChain.connect(deployer).mint(deployer.address, "1000000000");
    // transfer some quantity of ERC20 tokens for `lockAndDataForMainnetERC20` address
    await eRC20OnChain.connect(deployer).transfer(lockAndDataForSchainERC20.address, "1000000");
    // execution
    const res = await (await lockAndDataForSchainERC20
        .connect(deployer)
        .receiveERC20(contractHere, amount)).wait();
    // expectation
    if (res.events) {
      expect(res.events[1].args?.result).to.be.true;
    } else {
      assert(false, "No events were emitted");
    }
  });

  it("should set `ERC20Tokens` and `ERC20Mapper`", async () => {
    // preparation
    const addressERC20 = eRC20OnChain.address;
    const schainID = randomString(10);
    await lockAndDataForSchainERC20
        .connect(deployer)
        .addERC20ForSchain(schainID, eRC20OnMainnet.address, addressERC20).should.be.eventually.rejectedWith("Automatic deploy is disabled");
    await lockAndDataForSchainERC20.connect(deployer).enableAutomaticDeploy(schainID);
    // execution
    await lockAndDataForSchainERC20
        .connect(deployer)
        .addERC20ForSchain(schainID, eRC20OnMainnet.address, addressERC20);
    // expectation
    expect(await lockAndDataForSchainERC20.getERC20OnSchain(schainID, eRC20OnMainnet.address)).to.be.equal(addressERC20);
  });

  it("should add token by owner", async () => {
    // preparation
    const schainID = randomString(10);
    const addressERC20 = eRC20OnChain.address;
    const addressERC201 = eRC20OnMainnet.address;
    const automaticDeploy = await lockAndDataForSchainERC20.automaticDeploy(stringValue(web3.utils.soliditySha3(schainID)));
    await lockAndDataForSchainERC20.addERC20TokenByOwner(schainID, addressERC201, addressERC20);
    // automaticDeploy == true - enabled automaticDeploy = false - disabled
    if (automaticDeploy) {
      await lockAndDataForSchainERC20.disableAutomaticDeploy(schainID);
    } else {
      await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID);
    }

    await lockAndDataForSchainERC20.addERC20TokenByOwner(schainID, addressERC201, addressERC20);

    eRC20OnChain2 = await deployERC20OnChain("NewToken", "NTN");
    eRC20OnMainnet2 = await deployERC20OnChain("NewToken", "NTN");

    if (automaticDeploy) {
      await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID);
    } else {
      await lockAndDataForSchainERC20.disableAutomaticDeploy(schainID);
    }

    await lockAndDataForSchainERC20.addERC20TokenByOwner(schainID, eRC20OnMainnet2.address, eRC20OnChain2.address);

  });

  it("should set and check totalSupplyOnMainnet", async () => {
    const contractHere = eRC20OnChain.address;
    await lockAndDataForSchainERC20.setTotalSupplyOnMainnet(contractHere, 9);
    expect((await lockAndDataForSchainERC20.totalSupplyOnMainnet(contractHere)).toNumber()).to.be.equal(9);
    await lockAndDataForSchainERC20.setTotalSupplyOnMainnet(contractHere, 11);
    expect((await lockAndDataForSchainERC20.totalSupplyOnMainnet(contractHere)).toNumber()).to.be.equal(11);
    await lockAndDataForSchainERC20.setTotalSupplyOnMainnet(contractHere, 1);
    expect((await lockAndDataForSchainERC20.totalSupplyOnMainnet(contractHere)).toNumber()).to.be.equal(1);
  });

});
