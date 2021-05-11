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
 * @file LockAndDataForSchain.ts
 * @copyright SKALE Labs 2019-Present
 */
import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
  EthERC20,
  LockAndDataForSchain,
  } from "../typechain";
import { gasMultiplier } from "./utils/command_line";
import { randomString, stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised));

import { deployLockAndDataForSchain } from "./utils/deploy/schain/lockAndDataForSchain";
import { deployEthERC20 } from "./utils/deploy/schain/ethERC20";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("LockAndDataForSchain", () => {
  let user: SignerWithAddress;
  let deployer: SignerWithAddress;

  let lockAndDataForSchain: LockAndDataForSchain;
  let ethERC20: EthERC20;

  before(async () => {
    [deployer, user] = await ethers.getSigners();
  });

  beforeEach(async () => {
    lockAndDataForSchain = await deployLockAndDataForSchain();
    ethERC20 = await deployEthERC20();
  });

  it("should set EthERC20 address", async () => {

    // only owner can set EthERC20 address:
    await lockAndDataForSchain.connect(user).setEthErc20Address(ethERC20.address).should.be.rejected;
    await lockAndDataForSchain.connect(deployer).setEthErc20Address(ethERC20.address);

    // address which has been set should be equal to deployed contract address;
    const address = await lockAndDataForSchain.getEthErc20Address();
    expect(address).to.equal(ethERC20.address);
  });

  it("should set contract", async () => {
    const nullAddress = await lockAndDataForSchain.getEthErc20Address();
    await lockAndDataForSchain.connect(deployer).setEthErc20Address(ethERC20.address);
    const address = await lockAndDataForSchain.getEthErc20Address();

    // only owner can set contract:
    await lockAndDataForSchain.connect(user).setContract("EthERC20", address).should.be.rejected;

    // contract address shouldn't be equal zero:
    await lockAndDataForSchain.connect(deployer).setContract("EthERC20", nullAddress)
    .should.be.rejectedWith("New address is equal zero");

    // set contract:
    await lockAndDataForSchain.connect(deployer).setContract("EthERC20", address);

    // the same contract can't be set twice:
    await lockAndDataForSchain.connect(deployer).setContract("EthERC20", address).
    should.be.rejectedWith("Contract is already added");

    // contract address should contain code:
    await lockAndDataForSchain.connect(deployer).setContract("EthERC20", deployer.address).
    should.be.rejectedWith("Given contract address does not contain code");

    const getMapping = await lockAndDataForSchain.getContract("EthERC20");
    expect(getMapping).to.equal(ethERC20.address);
  });

  it("should add schain", async () => {
    const schainID = randomString(10);
    const tokenManagerAddress = user.address;
    const nullAddress = "0x0000000000000000000000000000000000000000";

    // only owner can add schain:
    await lockAndDataForSchain.connect(user).addSchain(schainID, tokenManagerAddress).should.be.rejected;

    // Token Manager address shouldn't be equal zero:
    await lockAndDataForSchain.connect(deployer).addSchain(schainID, nullAddress).
    should.be.rejectedWith("Incorrect Token Manager address");

    // add schain:
    await lockAndDataForSchain.connect(deployer).addSchain(schainID, tokenManagerAddress);

    // schain can't be added twice:
    await lockAndDataForSchain.connect(deployer).addSchain(schainID, tokenManagerAddress).
    should.be.rejectedWith("SKALE chain is already set");

    const getMapping = await lockAndDataForSchain.tokenManagerAddresses(stringValue(await web3.utils.soliditySha3(schainID)));
    expect(getMapping).to.equal(tokenManagerAddress);
  });

  it("should add deposit box", async () => {
    const depositBoxAddress = user.address;
    const nullAddress = "0x0000000000000000000000000000000000000000";

    // only owner can add deposit box:
    await lockAndDataForSchain.connect(user).addDepositBox(depositBoxAddress).should.be.rejected;

    // deposit box address shouldn't be equal zero:
    await lockAndDataForSchain.connect(deployer).addDepositBox(nullAddress)
      .should.be.rejectedWith("Incorrect Deposit Box address");

    // add deposit box:
    await lockAndDataForSchain.connect(deployer).addDepositBox(depositBoxAddress);

    // deposit box can't be added twice:
    await lockAndDataForSchain.connect(deployer).addDepositBox(depositBoxAddress).
    should.be.rejectedWith("Deposit Box is already set");

    const getMapping = await lockAndDataForSchain.getDepositBox(0);
    expect(getMapping).to.equal(depositBoxAddress);
  });

  it("should add communityPool", async () => {
    const address = user.address;
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const amount = BigNumber.from(500);

    // only schain owner can add exits:
    await lockAndDataForSchain.connect(user).sendEth(nullAddress, amount).should.be.rejected;
    await lockAndDataForSchain.connect(deployer).sendEth(nullAddress, amount)
      .should.be.eventually.rejectedWith("Community Pool is not available");

    // const communityPool = new BigNumber(await lockAndDataForSchain.communityPool());
    // communityPool.should.be.deep.equal(amount);
  });

  it("should reduce communityPool", async () => {
    const address = user.address;
    const amount = BigNumber.from(500);
    const amountToReduce = BigNumber.from(1);
    const amountFinal = BigNumber.from(499);
    const amountZero = BigNumber.from(0);
    const nullAddress = "0x0000000000000000000000000000000000000000";

    // if community pool is empty reduceCommunityPool function don't change situation any way:
    // const communityPoolBefore = new BigNumber(await lockAndDataForSchain.communityPool());
    // communityPoolBefore.should.be.deep.equal(amountZero);
    await lockAndDataForSchain.connect(deployer).reduceCommunityPool(amountZero).should.be.eventually.rejectedWith("Community Pool is not available");
    // await lockAndDataForSchain.reduceCommunityPool(amount, {from: deployer});
    // const communityPoolAfter = new BigNumber(await lockAndDataForSchain.communityPool());
    // communityPoolAfter.should.be.deep.equal(amountZero);

    // // we can add eth to community pool and it uses
    // await lockAndDataForSchain.sendEth(nullAddress, amount, {from: deployer});
    // await lockAndDataForSchain.reduceCommunityPool(amountToReduce, {from: deployer});
    // const communityPool = new BigNumber(await lockAndDataForSchain.communityPool());
    // communityPool.should.be.deep.equal(amountFinal);

  });

  it("should send Eth", async () => {
    const address = user.address;
    const amount = 200;
    const amountZero = 0;
    const amountMoreThenCap = 1210000000000000000;

    // set EthERC20 address:
    await lockAndDataForSchain.connect(deployer).setEthErc20Address(ethERC20.address);

    // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
    await ethERC20.connect(deployer).transferOwnership(lockAndDataForSchain.address);

    // only owner can send Eth:
    await lockAndDataForSchain.connect(user).sendEth(address, amount).should.be.rejected;

    // amount more zen cap = 120 * (10 ** 6) * (10 ** 18) can't be sent:
    await lockAndDataForSchain.connect(deployer).sendEth(address, amountMoreThenCap).should.be.rejected;

    // balance of account  equal to zero:
    const balanceBefore = parseInt(BigNumber.from(await ethERC20.balanceOf(user.address)).toString(), 10);
    balanceBefore.should.be.deep.equal(amountZero);

    // send Eth:
    await lockAndDataForSchain.connect(deployer).sendEth(address, amount);

    // balance of account equal to amount which has been sent:
    const balanceAfter = parseInt(BigNumber.from(await ethERC20.balanceOf(user.address)).toString(), 10);
    balanceAfter.should.be.deep.equal(amount);
  });

  it("should receive Eth", async () => {
    const address = user.address;
    const amount = BigNumber.from(200);
    const amountZero = BigNumber.from(0);

    // set EthERC20 address:
    await lockAndDataForSchain.connect(deployer).setEthErc20Address(ethERC20.address);

    // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
    await ethERC20.connect(deployer).transferOwnership(lockAndDataForSchain.address);

    //  send Eth to account:
    await lockAndDataForSchain.connect(deployer).sendEth(address, amount);

    // balance of account equal to amount which has been sent:
    const balance = BigNumber.from(await ethERC20.balanceOf(address));
    balance.should.be.deep.equal(amount);

    // burn Eth through `receiveEth` function:
    await lockAndDataForSchain.connect(deployer).receiveEth(address, amount);

    // balance after "receiving" equal to zero:
    const balanceAfter = BigNumber.from(await ethERC20.balanceOf(address));
    balanceAfter.should.be.deep.equal(amountZero);
  });

  it("should return true when invoke `hasSchain`", async () => {
    // preparation
    const schainID = randomString(10);
    // add schain for return `true` after `hasSchain` invoke
    await lockAndDataForSchain
      .connect(deployer)
      .addSchain(schainID, deployer.address);
    // execution
    const res = await lockAndDataForSchain
      .connect(deployer)
      .hasSchain(schainID);
    // expectation
    expect(res).to.be.true;
  });

  it("should return false when invoke `hasSchain`", async () => {
    // preparation
    const schainID = randomString(10);
    // execution
    const res = await lockAndDataForSchain
      .connect(deployer)
      .hasSchain(schainID);
    // expectation
    expect(res).to.be.false;
  });

  it("should return true when invoke `hasDepositBox`", async () => {
    // preparation
    const depositBoxAddress = user.address;
    // add schain for return `true` after `hasDepositBox` invoke
    await lockAndDataForSchain.connect(deployer).addDepositBox(depositBoxAddress);
    // execution
    const res = await lockAndDataForSchain
      .connect(deployer)
      .hasDepositBox(depositBoxAddress);
    // expectation
    expect(res).to.be.true;
  });

  it("should return false when invoke `hasDepositBox`", async () => {
    // preparation
    const depositBoxAddress = user.address;
    // execution
    const res = await lockAndDataForSchain
      .connect(deployer)
      .hasDepositBox(depositBoxAddress);
    // expectation
    expect(res).to.be.false;
  });

  it("should invoke `removeSchain` without mistakes", async () => {
    const schainID = randomString(10);
    await lockAndDataForSchain
      .connect(deployer)
      .addSchain(schainID, deployer.address);
    // execution
    await lockAndDataForSchain
      .connect(deployer)
      .removeSchain(schainID);
    // expectation
    const getMapping = await lockAndDataForSchain.tokenManagerAddresses(stringValue(web3.utils.soliditySha3(schainID)));
    expect(getMapping).to.equal("0x0000000000000000000000000000000000000000");
  });

  it("should rejected with `SKALE chain is not set` when invoke `removeSchain`", async () => {
    const error = "SKALE chain is not set";
    const schainID = randomString(10);
    const anotherSchainID = randomString(10);
    await lockAndDataForSchain
      .connect(deployer)
      .addSchain(schainID, deployer.address);
    // execution/expectation
    await lockAndDataForSchain
      .connect(deployer)
      .removeSchain(anotherSchainID)
      .should.be.eventually.rejectedWith(error);
  });

  it("should work `addAuthorizedCaller`", async () => {
    // preparation
    const caller = user.address;
    // execution
    await lockAndDataForSchain
      .connect(deployer)
      .addAuthorizedCaller(caller);
    // expectation
    const res = await lockAndDataForSchain.connect(deployer).authorizedCaller(caller);
    // console.log("res", res);
    expect(res).to.be.true;
  });

  it("should work `removeAuthorizedCaller`", async () => {
    // preparation
    const caller = user.address;
    // execution
    await lockAndDataForSchain
      .connect(deployer)
      .removeAuthorizedCaller(caller);
    // expectation
    const res = await lockAndDataForSchain.connect(deployer).authorizedCaller(caller);
    // console.log("res", res);
    expect(res).to.be.false;
  });

  it("should invoke `removeDepositBox` without mistakes", async () => {
    // preparation
    const depositBoxAddress = user.address;
    const nullAddress = "0x0000000000000000000000000000000000000000";
    // add deposit box:
    await lockAndDataForSchain.connect(deployer).addDepositBox(depositBoxAddress);
    // execution
    await lockAndDataForSchain.connect(deployer).removeDepositBox(depositBoxAddress);
    // expectation
    const getMapping = await lockAndDataForSchain.tokenManagerAddresses(stringValue(web3.utils.soliditySha3("Mainnet")));
    expect(getMapping).to.equal(nullAddress);
  });

  it("should invoke `removeDepositBox` with 0 depositBoxes", async () => {
    // preparation
    const error = "Deposit Box is not set";
    // execution/expectation
    await lockAndDataForSchain.connect(deployer).removeDepositBox(user.address);
  });

});
