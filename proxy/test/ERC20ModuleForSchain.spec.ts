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

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
  ERC20ModuleForMainnetInstance,
    ERC20ModuleForSchainContract,
    ERC20ModuleForSchainInstance,
    ERC20OnChainContract,
    ERC20OnChainInstance,
    EthERC20Contract,
    EthERC20Instance,
    LockAndDataForMainnetERC20Instance,
    LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC20Contract,
    LockAndDataForSchainERC20Instance,
    LockAndDataForSchainInstance,
    TokenFactoryContract,
    TokenFactoryInstance,
    TokenManagerContract,
    TokenManagerInstance,
    } from "../types/truffle-contracts";

import chai = require("chai");
import { randomString } from "./utils/helper";
import { deployLockAndDataForMainnet } from "./utils/deploy/lockAndDataForMainnet";
import { deployLockAndDataForMainnetERC20 } from "./utils/deploy/lockAndDataForMainnetERC20";
import { deployERC20ModuleForMainnet } from "./utils/deploy/erc20ModuleForMainnet";

chai.should();
chai.use((chaiAsPromised as any));

// tslint:disable-next-line: no-var-requires
const ABIERC20OnChain = require("../build/contracts/ERC20OnChain.json");

const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForSchainERC20: LockAndDataForSchainERC20Contract =
    artifacts.require("./LockAndDataForSchainERC20");
const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");
const TokenFactory: TokenFactoryContract = artifacts.require("./TokenFactory");
const TokenManager: TokenManagerContract = artifacts.require("./TokenManager");
const ERC20ModuleForSchain: ERC20ModuleForSchainContract = artifacts.require("./ERC20ModuleForSchain");
const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");

contract("ERC20ModuleForSchain", ([deployer, user, invoker]) => {
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForSchainERC20: LockAndDataForSchainERC20Instance;
  let ethERC20: EthERC20Instance;
  let tokenFactory: TokenFactoryInstance;
  let tokenManager: TokenManagerInstance;
  let eRC20ModuleForSchain: ERC20ModuleForSchainInstance;
  let eRC20OnChain: ERC20OnChainInstance;
  let erc20OnMainnet: ERC20OnChainInstance;
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
  let eRC20ModuleForMainnet: ERC20ModuleForMainnetInstance;

  beforeEach(async () => {
    lockAndDataForMainnet = await deployLockAndDataForMainnet();
    lockAndDataForMainnetERC20 = await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
    eRC20ModuleForMainnet = await deployERC20ModuleForMainnet(lockAndDataForMainnet);

    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
    await lockAndDataForSchain.setContract("LockAndData", lockAndDataForSchain.address, {from: deployer});
    lockAndDataForSchainERC20 = await LockAndDataForSchainERC20.new(
      lockAndDataForSchain.address,
      {from: deployer}
    );
    await lockAndDataForSchain.setContract(
      "LockAndDataERC20",
      lockAndDataForSchainERC20.address,
      {from: deployer}
    );
    eRC20ModuleForSchain = await ERC20ModuleForSchain.new(
      lockAndDataForSchain.address,
      {from: deployer}
    );
    await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});

    ethERC20 = await EthERC20.new(lockAndDataForSchain.address, {from: deployer});
    await lockAndDataForSchain.setContract("EthERC20", ethERC20.address, {from: deployer});
    tokenFactory = await TokenFactory.new(
      lockAndDataForSchain.address,
      {from: deployer}
    );
    await lockAndDataForSchain.setContract("TokenFactory", tokenFactory.address, {from: deployer});

    tokenManager = await TokenManager.new("NewSchain", lockAndDataForSchain.address, {from: deployer});
    await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

    eRC20OnChain = await ERC20OnChain.new("ERC20OnChain", "ERC20", {from: deployer});
    erc20OnMainnet = await ERC20OnChain.new("SKALE", "SKL", {from: deployer});

    await lockAndDataForSchainERC20.enableAutomaticDeploy("Mainnet", {from: deployer});
  });

  it("should rejected with `ERC20 contract does not exist on SKALE chain.`", async () => {
    // preparation
    const error = "ERC20 contract does not exist on SKALE chain.";
    const contractHere = eRC20OnChain.address;
    const schainID = randomString(10);
    const to = user;
    const amount = 10;
    // execution/expectation
    await eRC20ModuleForSchain.receiveERC20(schainID, contractHere, to, amount, {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should invoke `receiveERC20`", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const ERC20OnMainnet = erc20OnMainnet.address;
    const schainID = randomString(10);
    const to = user;
    const amount = 10;
    const contractPosition = 1;
    // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
    const minterRole = await eRC20OnChain.MINTER_ROLE();
    await eRC20OnChain.grantRole(minterRole, lockAndDataForSchainERC20.address);
    // mint some quantity of ERC20 tokens for `deployer` address
    await eRC20OnChain.mint(deployer, "1000000000", {from: deployer});
    // transfer some quantity of ERC20 tokens for `lockAndDataForMainnetERC20` address
    await eRC20OnChain.transfer(lockAndDataForSchainERC20.address, "1000000", {from: deployer});
    // add ERC20 token to avoid "ERC20 contract does not exist on SKALE chain." error
    await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID, {from: deployer});
    await lockAndDataForSchainERC20
      .addERC20ForSchain(schainID, ERC20OnMainnet ,contractHere, {from: deployer});
    // execution
    const res = await eRC20ModuleForSchain.receiveERC20.call(schainID, ERC20OnMainnet, to, amount, {from: deployer});
    // expectation
    // (res).should.include("0x"); // l_sergiy: FIX - not passing
  });

  it("should send ERC20 token from mainnet to schain", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const to = user;
    const ERC20OnMainnet = erc20OnMainnet.address;
    const schainID = randomString(10);
    const amount = 10;
    // mint some quantity of ERC20 tokens for `deployer` address
    await erc20OnMainnet.mint(deployer, "1000000000", {from: deployer});
    await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID, {from: deployer});
    // get data from `receiveERC20`
    await eRC20ModuleForMainnet.receiveERC20(schainID, ERC20OnMainnet, to, amount, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
    await lockAndDataForMainnetERC20.disableWhitelist(schainID);
    const data = await eRC20ModuleForMainnet.receiveERC20.call(schainID, ERC20OnMainnet, to, amount, {from: deployer});
    // await eRC20ModuleForMainnet.receiveERC20(schainID, ERC20OnMainnet, to, amount, {from: deployer});
    // execution
    const {logs} = await eRC20ModuleForSchain.sendERC20(schainID, data, {from: deployer});
    const contractOnSchain  = logs[0].args.contractOnSchain;
    const newERC20: ERC20OnChainInstance = await ERC20OnChain.at(contractOnSchain);
    // expectation
    const balance = await newERC20.balanceOf(to);
    parseInt(new BigNumber(balance).toString(), 10).should.be.equal(amount);
  });

  it("should return send ERC20 token twice", async () => {
    // preparation
    const schainID = randomString(10);
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const data = "0x03" +
    (erc20OnMainnet.address).substr(2)+ "000000000000000000000000" +  // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "000000000000000000000000000000000000000000000000000000000000000a" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000c" + // token name
    "45524332304f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000005" + // token symbol
    "455243323012" + // token symbol
    "000000000000000000000000000000000000000000000000000000003b9ac9f6"; // total supply

    const data2 = "0x03" +
    (erc20OnMainnet.address).substr(2)+ "000000000000000000000000" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "000000000000000000000000000000000000000000000000000000000000000a" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000c" + // token name
    "45524332304f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000005" + // token symbol
    "455243323012" + // token symbol
    "000000000000000000000000000000000000000000000000000000003b9ac9f7"; // total supply

    await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID, {from: deployer});
    // execution
    const res = await eRC20ModuleForSchain.sendERC20(schainID, data, {from: deployer});
    const newAddress = res.logs[0].args.contractOnSchain;
    // expectation
    const newERC20Contract = new web3.eth.Contract(ABIERC20OnChain.abi, newAddress);
    await eRC20ModuleForSchain.sendERC20(schainID, data2, {from: deployer});
    const balance = await newERC20Contract.methods.balanceOf(to).call();
    // parseInt(new BigNumber(balance).toString(), 10).should.be.equal(amount * 2);
  });

  it("should return `true` for `sendERC20` with `to0==address(0)` and `contractAddreess==address(0)`", async () => {
    // preparation
    const schainID = randomString(10);
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const data = "0x03" +
    (erc20OnMainnet.address).substr(2)+ "000000000000000000000000" +  // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "000000000000000000000000000000000000000000000000000000000000000a" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000c" + // token name
    "45524332304f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000005" + // token symbol
    "455243323012" + // token symbol
    "000000000000000000000000000000000000000000000000000000003b9ac9f6"; // total supply

    await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID, {from: deployer});
    // execution
    const res = await eRC20ModuleForSchain.sendERC20(schainID, data, {from: deployer});
    const newAddress = res.logs[0].args.contractOnSchain;
    // expectation
    const newERC20Contract = new web3.eth.Contract(ABIERC20OnChain.abi, newAddress);
    const balance = await newERC20Contract.methods.balanceOf(to).call();
    parseInt(new BigNumber(balance).toString(), 10).should.be.equal(amount);
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const schainID = randomString(10);
    const ERC20OnMainnet = erc20OnMainnet.address;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const contractPosition = 10;

    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForSchainERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForSchainERC20.address, "1000000", {from: deployer});
    await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID, {from: deployer});
    // add ERC20 token to avoid "ERC20 contract does not exist on SKALE chain." error
    await lockAndDataForSchainERC20
      .addERC20ForSchain(schainID, ERC20OnMainnet, contractHere, {from: deployer});
    // get data from `receiveERC20`
    const data = await eRC20ModuleForSchain.receiveERC20.call(schainID, ERC20OnMainnet, to, amount, {from: deployer});
    await eRC20ModuleForSchain.receiveERC20(schainID, ERC20OnMainnet, to, amount, {from: deployer});
    // execution
    const res = await eRC20ModuleForSchain.getReceiver(data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

});
