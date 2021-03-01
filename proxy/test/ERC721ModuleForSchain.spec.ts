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

import * as chaiAsPromised from "chai-as-promised";
import {
    ERC721ModuleForSchainContract,
    ERC721ModuleForSchainInstance,
    ERC721OnChainContract,
    ERC721OnChainInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC721Contract,
    LockAndDataForSchainERC721Instance,
    LockAndDataForSchainInstance,
    TokenFactoryContract,
    TokenFactoryInstance,
    TokenManagerContract,
    TokenManagerInstance
    } from "../types/truffle-contracts";

import chai = require("chai");
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

// tslint:disable-next-line: no-var-requires
const ABIERC721OnChain = require("../build/contracts/ERC721OnChain.json");

const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForSchainERC721: LockAndDataForSchainERC721Contract = artifacts.require(
  "./LockAndDataForSchainERC721"
);
const TokenFactory: TokenFactoryContract = artifacts.require("./TokenFactory");
const TokenManager: TokenManagerContract = artifacts.require("./TokenManager");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");
const ERC721ModuleForSchain: ERC721ModuleForSchainContract = artifacts.require("./ERC721ModuleForSchain");

contract("ERC721ModuleForSchain", ([deployer, user, invoker]) => {
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForSchainERC721: LockAndDataForSchainERC721Instance;
  let tokenFactory: TokenFactoryInstance;
  let tokenManager: TokenManagerInstance;
  let eRC721OnChain: ERC721OnChainInstance;
  let eRC721ModuleForSchain: ERC721ModuleForSchainInstance;
  let eRC721OnMainnet: ERC721OnChainInstance;

  beforeEach(async () => {
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
    await lockAndDataForSchain.setContract("LockAndData", lockAndDataForSchain.address, {from: deployer});
    lockAndDataForSchainERC721 = await LockAndDataForSchainERC721.new(
      lockAndDataForSchain.address,
      {from: deployer}
    );
    await lockAndDataForSchain.setContract(
      "LockAndDataERC721",
      lockAndDataForSchainERC721.address,
      {from: deployer}
    );
    tokenFactory = await TokenFactory.new(
      lockAndDataForSchain.address,
      {from: deployer}
    );
    await lockAndDataForSchain.setContract("TokenFactory", tokenFactory.address, {from: deployer});
    tokenManager = await TokenManager.new(
      "NewSchain",
      lockAndDataForSchain.address,
      {from: deployer}
    );
    await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
    eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");
    eRC721OnMainnet = await ERC721OnChain.new("SKALE", "SKL");
    eRC721ModuleForSchain = await ERC721ModuleForSchain.new(
      lockAndDataForSchain.address,
      {from: deployer}
    );
    await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
  });

  it("should rejected with `ERC721 contract does not exist on SKALE chain`", async () => {
    // preparation
    const error = "ERC721 contract does not exist on SKALE chain";
    const contractHere = eRC721OnChain.address;
    const schainID = randomString(10);
    const to = user;
    const tokenId = 1;

    await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
    // execution/expectation
    await eRC721ModuleForSchain.receiveERC721(schainID, contractHere , to, tokenId, {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should invoke `receiveERC721`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const contractThere = eRC721OnMainnet.address;
    const schainID = randomString(10);
    const to = user;
    const tokenId = 1;

    await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
    // add ERC721 token to avoid "ERC721 contract does not exist on SKALE chain" error
    await lockAndDataForSchainERC721
      .addERC721ForSchain(schainID, eRC721OnMainnet.address, contractHere, {from: deployer});
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer ERC721 token to `lockAndDataForMainnetERC721` to avoid "Token not transferred" error
    await eRC721OnChain.transferFrom(deployer, lockAndDataForSchainERC721.address, tokenId, {from: deployer});
    // execution
    const res = await eRC721ModuleForSchain.receiveERC721.call(schainID, contractThere , to, tokenId, {from: deployer});
    // expectation
    (res).should.include("0x");
  });

  it("should return `true` for `sendERC721`", async () => {
    // preparation
    const to = user;
    const schainID = randomString(10);
    const tokenId = 2;

    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    const data = "0x05" +
    (eRC721OnMainnet.address).substr(2) + "000000000000000000000000" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "0000000000000000000000000000000000000000000000000000000000000002" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000d" + // token name
    "4552433732314f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000006" + // token symbol
    "455243373231"; // token symbol
    await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
    // execution
    const res = await eRC721ModuleForSchain.sendERC721(schainID, data, {from: deployer});
    // expectation
    // get new token address
    const newAddress = res.logs[0].args.contractOnSchain;
    const newERC721Contract = new web3.eth.Contract(ABIERC721OnChain.abi, newAddress);
    expect(await newERC721Contract.methods.ownerOf(tokenId).call()).to.be.equal(to);
  });

  it("should return `true` when invoke `sendERC721`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const contractThere = eRC721OnMainnet.address;
    const schainID = randomString(10);
    const to = user;
    const tokenId = 2;

    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer tokenId from `deployer` to `lockAndDataForSchainERC721`
    await eRC721OnChain.transferFrom(deployer,
      lockAndDataForSchainERC721.address, tokenId, {from: deployer});
    await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
    // add ERC721 token to avoid "ERC721 contract does not exist on SKALE chain" error
    await lockAndDataForSchainERC721
      .addERC721ForSchain(schainID, contractThere, contractHere, {from: deployer});
    // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
    const minterRole = await eRC721OnChain.MINTER_ROLE();
    await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
    // get data from `receiveERC721`
    const data = await eRC721ModuleForSchain.receiveERC721.call(schainID, contractThere , to, tokenId, {from: deployer});
    await eRC721ModuleForSchain.receiveERC721(schainID, contractThere , to, tokenId, {from: deployer});
    // execution
    await eRC721ModuleForSchain.sendERC721(schainID, data, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user);
  });

  it("should return `receiver` when invoke `getReceiver`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const contractThere = eRC721OnMainnet.address;
    const schainID = randomString(10);
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const tokenId = 10;

    await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
    // add ERC721 token to avoid "ERC721 contract does not exist on SKALE chain" error
    await lockAndDataForSchainERC721
      .addERC721ForSchain(schainID, contractThere, contractHere, {from: deployer});
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer ERC721 token to `lockAndDataForMainnetERC721` to avoid "Token not transferred" error
    await eRC721OnChain.transferFrom(deployer, lockAndDataForSchainERC721.address, tokenId, {from: deployer});
    // get data from `receiveERC721`
    const data = await eRC721ModuleForSchain.receiveERC721.call(schainID, contractThere , to, tokenId, {from: deployer});
    await eRC721ModuleForSchain.receiveERC721(schainID, contractThere , to, tokenId, {from: deployer});
    // execution
    const res = await eRC721ModuleForSchain.getReceiver(data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

});
