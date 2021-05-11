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
 * @file ERC20ModuleForSchain.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    ERC20ModuleForSchain,
    ERC20OnChain,
    EthERC20,
    LockAndDataForSchain,
    LockAndDataForSchainERC20,
    MessagesTester,
    TokenFactory,
    } from "../typechain";

import { randomString, stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised));

// tslint:disable-next-line: no-var-requires
const ABIERC20OnChain = require("../artifacts/contracts/schain/TokenFactory.sol/ERC20OnChain.json");

import { deployMessages } from "./utils/deploy/messages";
import { deployEthERC20 } from "./utils/deploy/schain/ethERC20";
import { deployTokenFactory } from "./utils/deploy/schain/tokenFactory";
import { deployERC20ModuleForSchain } from "./utils/deploy/schain/erc20ModuleForSchain";
import { deployLockAndDataForSchain } from "./utils/deploy/schain/lockAndDataForSchain";
import { deployLockAndDataForSchainERC20 } from "./utils/deploy/schain/lockAndDataForSchainERC20";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("ERC20ModuleForSchain", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let invoker: SignerWithAddress;

  let lockAndDataForSchain: LockAndDataForSchain;
  let lockAndDataForSchainERC20: LockAndDataForSchainERC20;
  let ethERC20: EthERC20;
  let tokenFactory: TokenFactory;
  let eRC20ModuleForSchain: ERC20ModuleForSchain;
  let eRC20OnChain: ERC20OnChain;
  let erc20OnMainnet: ERC20OnChain;
  let messages: MessagesTester;

  before(async () => {
    [deployer, user, invoker] = await ethers.getSigners();
  });

  beforeEach(async () => {

    lockAndDataForSchain = await deployLockAndDataForSchain();
    lockAndDataForSchainERC20 = await deployLockAndDataForSchainERC20(lockAndDataForSchain);
    eRC20ModuleForSchain = await deployERC20ModuleForSchain(lockAndDataForSchain);

    ethERC20 = await deployEthERC20();
    tokenFactory = await deployTokenFactory(lockAndDataForSchain);

    eRC20OnChain = await deployERC20OnChain("ERC20OnChain", "ERC20");
    erc20OnMainnet = await deployERC20OnChain("SKALE", "SKL");
    messages = await deployMessages();

    await lockAndDataForSchainERC20.connect(deployer).enableAutomaticDeploy("Mainnet");
  });

  it("should rejected with `ERC20 contract does not exist on SKALE chain.`", async () => {
    // preparation
    const error = "ERC20 contract does not exist on SKALE chain.";
    const contractHere = eRC20OnChain.address;
    const schainID = randomString(10);
    const to = user.address;
    const amount = 10;
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
    // execution/expectation
    await eRC20ModuleForSchain.connect(deployer).receiveERC20(schainID, contractHere, to, amount)
      .should.be.eventually.rejectedWith(error);
  });

  it("should invoke `receiveERC20`", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const ERC20OnMainnet = erc20OnMainnet.address;
    const schainID = randomString(10);
    const to = user.address;
    const amount = 10;
    const contractPosition = 1;
    // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
    const minterRole = await eRC20OnChain.MINTER_ROLE();
    await eRC20OnChain.grantRole(minterRole, lockAndDataForSchainERC20.address);
    // mint some quantity of ERC20 tokens for `deployer` address
    await eRC20OnChain.connect(deployer).mint(deployer.address, "1000000000");
    // transfer some quantity of ERC20 tokens for `lockAndDataForMainnetERC20` address
    await eRC20OnChain.connect(deployer).transfer(lockAndDataForSchainERC20.address, "1000000");
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("ERC20Module", eRC20ModuleForSchain.address);
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
    // add ERC20 token to avoid "ERC20 contract does not exist on SKALE chain." error
    await lockAndDataForSchainERC20.connect(deployer).enableAutomaticDeploy(schainID);
    await lockAndDataForSchainERC20
      .connect(deployer)
      .addERC20ForSchain(schainID, ERC20OnMainnet ,contractHere);
    // execution
    await eRC20ModuleForSchain.connect(deployer).receiveERC20(schainID, ERC20OnMainnet, to, amount);
    // call(schainID, ERC20OnMainnet, to, amount);
    // expectation
    // (res).should.include("0x"); // l_sergiy: FIX - not passing
  });

  // it("should send ERC20 token from mainnet to schain", async () => {
  //   // preparation
  //   const contractHere = eRC20OnChain.address;
  //   const to = user.address;
  //   const ERC20OnMainnet = erc20OnMainnet.address;
  //   const schainID = randomString(10);
  //   const amount = 10;
  //   // set `ERC20Module` contract before invoke `receiveERC20`
  //   await lockAndDataForSchain
  //       .setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
  //   // set `LockAndDataERC20` contract before invoke `receiveERC20`
  //   await lockAndDataForSchain
  //       .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
  //   await lockAndDataForSchain
  //       .setContract("TokenFactory", tokenFactory.address, {from: deployer});
  //   // mint some quantity of ERC20 tokens for `deployer` address
  //   await erc20OnMainnet.mint(deployer, "1000000000", {from: deployer});
  //   await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID, {from: deployer});
  //   // get data from `receiveERC20`
  //   await eRC20ModuleForMainnet.receiveERC20(schainID, ERC20OnMainnet, to, amount, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
  //   await lockAndDataForMainnetERC20.disableWhitelist(schainID);
  //   const data = await eRC20ModuleForMainnet.receiveERC20.call(schainID, ERC20OnMainnet, to, amount, {from: deployer});
  //   // await eRC20ModuleForMainnet.receiveERC20(schainID, ERC20OnMainnet, to, amount, {from: deployer});
  //   // execution
  //   const {logs} = await eRC20ModuleForSchain.sendERC20(schainID, data, {from: deployer});
  //   const contractOnSchain  = logs[0].args.contractOnSchain;
  //   const newERC20: ERC20OnChainInstance = await ERC20OnChain.at(contractOnSchain);
  //   // expectation
  //   const balance = await newERC20.balanceOf(to);
  //   parseInt(new BigNumber(balance).toString(), 10).should.be.equal(amount);
  // });

  it("should return send ERC20 token twice", async () => {
    // preparation
    const schainID = randomString(10);
    const to = user.address;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const name = "D2 token";
    const symbol = "D2";
    const totalSupply = 1e9;

    const data = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, {name, symbol, decimals: 18});
    const data2 = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, {name, symbol, decimals: 18});

    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("ERC20Module", eRC20ModuleForSchain.address);
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
    //
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("TokenFactory", tokenFactory.address);
    await lockAndDataForSchainERC20.connect(deployer).enableAutomaticDeploy(schainID);
    // execution
    const res = await (await eRC20ModuleForSchain.connect(deployer).sendERC20(schainID, data)).wait();
    let newAddress = null;
    if (res.events) 
      newAddress = res.events[5].args?.contractOnSchain;
    else
      assert(false, "No events were emitted");
    // expectation
    const newERC20Contract = new web3.eth.Contract(ABIERC20OnChain.abi, newAddress);
    await eRC20ModuleForSchain.connect(deployer).sendERC20(schainID, data2);
    const balance = await newERC20Contract.methods.balanceOf(to).call();
    parseInt(BigNumber.from(balance).toString(), 10).should.be.equal(amount * 2);
  });

  it("should return `true` for `sendERC20` with `to0==address(0)` and `contractAddreess==address(0)`", async () => {
    // preparation
    const schainID = randomString(10);
    const to = user.address;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const name = "D2 token";
    const symbol = "D2";
    const totalSupply = 999999990;

    const data = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, {name, symbol, decimals: 18})

    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("ERC20Module", eRC20ModuleForSchain.address);
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
    //
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("TokenFactory", tokenFactory.address);
    await lockAndDataForSchainERC20.connect(deployer).enableAutomaticDeploy(schainID);
    // execution
    const res = await (await eRC20ModuleForSchain.connect(deployer).sendERC20(schainID, data)).wait();
    let newAddress = null;
    if (res.events)
      newAddress = res.events[5].args?.contractOnSchain.toString();
    else
      assert(false, "No events were emitted");
    // expectation

    const newERC20Contract = new web3.eth.Contract(ABIERC20OnChain.abi, newAddress);
    const balance = await newERC20Contract.methods.balanceOf(to).call();
    parseInt(BigNumber.from(balance).toString(), 10).should.be.equal(amount);
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user.address;
    const schainID = randomString(10);
    const ERC20OnMainnet = erc20OnMainnet.address;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const contractPosition = 10;
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("ERC20Module", eRC20ModuleForSchain.address);
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .connect(deployer)
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.connect(deployer).mint(deployer.address, "1000000000");
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForSchainERC20` to avoid `Not enough money`
    await ethERC20.connect(deployer).transfer(lockAndDataForSchainERC20.address, "1000000");
    await lockAndDataForSchainERC20.connect(deployer).enableAutomaticDeploy(schainID);
    // add ERC20 token to avoid "ERC20 contract does not exist on SKALE chain." error
    await lockAndDataForSchainERC20
      .connect(deployer)
      .addERC20ForSchain(schainID, ERC20OnMainnet, contractHere);
    // get data from `receiveERC20`
    await eRC20ModuleForSchain.connect(deployer).receiveERC20(schainID, ERC20OnMainnet, to, amount);
    // execution
    const data = await messages.encodeTransferErc20AndTokenInfoMessage(
      ERC20OnMainnet,
      to,
      amount,
      amount,
      {
        name: await erc20OnMainnet.name(),
        decimals: "0x" + await erc20OnMainnet.decimals(),
        symbol: await erc20OnMainnet.symbol()
      });
    const res = await eRC20ModuleForSchain.connect(deployer).getReceiver(data);
    // expectation
    res.should.be.equal(user.address);
  });

});
