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

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC20ModuleForSchainContract,
    ERC20ModuleForSchainInstance,
    ERC20OnChainContract,
    ERC20OnChainInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC20Contract,
    LockAndDataForSchainERC20Instance,
    LockAndDataForSchainInstance,
    } from "../types/truffle-contracts";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForSchainERC20: LockAndDataForSchainERC20Contract =
    artifacts.require("./LockAndDataForSchainERC20");
const ERC20ModuleForSchain: ERC20ModuleForSchainContract = artifacts.require("./ERC20ModuleForSchain");
const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");

contract("LockAndDataForSchainERC20", ([deployer, user, invoker]) => {
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForSchainERC20: LockAndDataForSchainERC20Instance;
  let eRC20OnChain: ERC20OnChainInstance;
  let eRC20OnChain2: ERC20OnChainInstance;
  let eRC20OnMainnet: ERC20OnChainInstance;
  let erc20Module: ERC20ModuleForSchainInstance;
  let eRC20OnMainnet2: ERC20OnChainInstance;

  beforeEach(async () => {
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
    await lockAndDataForSchain.setContract("LockAndData", lockAndDataForSchain.address, {from: deployer});
    lockAndDataForSchainERC20 = await LockAndDataForSchainERC20.new(
      lockAndDataForSchain.address,
      {from: deployer, gas: 8000000 * gasMultiplier}
    );
    await lockAndDataForSchain.setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
    erc20Module = await ERC20ModuleForSchain.new(lockAndDataForSchain.address, {from: deployer});
    await lockAndDataForSchain.setContract("ERC20Module", erc20Module.address, {from: deployer});
    eRC20OnChain = await ERC20OnChain.new("ERC20OnChain", "ERC20", {from: deployer});
    eRC20OnMainnet = await ERC20OnChain.new("SKALE", "SKL", {from: deployer});
  });

  it("should invoke `sendERC20` without mistakes", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const to = user;
    const amount = 10;
    // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
    const minterRole = await eRC20OnChain.MINTER_ROLE();
    await eRC20OnChain.grantRole(minterRole, lockAndDataForSchainERC20.address);
    await lockAndDataForSchainERC20.setTotalSupplyOnMainnet(contractHere, 9);
    // execution
    await lockAndDataForSchainERC20
        .sendERC20(contractHere, to, amount, {from: deployer}).should.be.eventually.rejectedWith("Total supply exceeded");
    await lockAndDataForSchainERC20.setTotalSupplyOnMainnet(contractHere, 11);
    // execution
    const res = await lockAndDataForSchainERC20
        .sendERC20(contractHere, to, amount, {from: deployer});
    // expectation
    expect(res.logs[0].args.result).to.be.true;
  });

  it("should rejected with `Amount not transferred`", async () => {
    // preparation
    const error = "Amount not transferred";
    const contractHere = eRC20OnChain.address;
    const amount = 10;
    // execution/expectation
    const res = await lockAndDataForSchainERC20
        .receiveERC20(contractHere, amount, {from: deployer})
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
    await eRC20OnChain.mint(deployer, "1000000000", {from: deployer});
    // transfer some quantity of ERC20 tokens for `lockAndDataForMainnetERC20` address
    await eRC20OnChain.transfer(lockAndDataForSchainERC20.address, "1000000", {from: deployer});
    // execution
    const res = await lockAndDataForSchainERC20
        .receiveERC20(contractHere, amount, {from: deployer});
    // expectation
    expect(res.logs[0].args.result).to.be.true;
  });

  it("should set `ERC20Tokens` and `ERC20Mapper`", async () => {
    // preparation
    const addressERC20 = eRC20OnChain.address;
    const schainID = randomString(10);
    await lockAndDataForSchainERC20
        .addERC20ForSchain(schainID, eRC20OnMainnet.address, addressERC20, {from: deployer}).should.be.eventually.rejectedWith("Automatic deploy is disabled");
    await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID, {from: deployer});
    // execution
    await lockAndDataForSchainERC20
        .addERC20ForSchain(schainID, eRC20OnMainnet.address, addressERC20, {from: deployer});
    // expectation
    expect(await lockAndDataForSchainERC20.getERC20OnSchain(schainID, eRC20OnMainnet.address)).to.be.equal(addressERC20);
  });

  it("should add token by owner", async () => {
    // preparation
    const schainID = randomString(10);
    const addressERC20 = eRC20OnChain.address;
    const addressERC201 = eRC20OnMainnet.address;
    const automaticDeploy = await lockAndDataForSchainERC20.automaticDeploy(web3.utils.soliditySha3(schainID));
    await lockAndDataForSchainERC20.addERC20TokenByOwner(schainID, addressERC201, addressERC20);
    // automaticDeploy == true - enabled automaticDeploy = false - disabled
    if (automaticDeploy) {
      await lockAndDataForSchainERC20.disableAutomaticDeploy(schainID);
    } else {
      await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID);
    }

    await lockAndDataForSchainERC20.addERC20TokenByOwner(schainID, addressERC201, addressERC20);

    eRC20OnChain2 = await ERC20OnChain.new("NewToken", "NTN");
    eRC20OnMainnet2 = await ERC20OnChain.new("NewToken", "NTN");

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
