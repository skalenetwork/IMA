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

contract("TokenManagerERC721", ([deployer, user]) => {
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

  it("should rejected with `ERC721 contract does not exist on SKALE chain`", async () => {
    // preparation
    const error = "ERC721 contract does not exist on SKALE chain";
    const contractHere = eRC721OnChain.address;
    const schainID = randomString(10);
    const to = user;
    const tokenId = 1;
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
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
    // to avoid "Message sender is invalid" error
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
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
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    await lockAndDataForSchain
        .setContract("TokenFactory", tokenFactory.address, {from: deployer});
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    const data = await messages.encodeTransferErc721AndTokenInfoMessage(
      eRC721OnMainnet.address,
      to,
      tokenId,
      {
        name: await eRC721OnMainnet.name(),
        symbol: await eRC721OnMainnet.symbol()
      });
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
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    await lockAndDataForSchain
        .setContract("TokenFactory", tokenFactory.address, {from: deployer});
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
    await eRC721ModuleForSchain.receiveERC721(schainID, contractThere , to, tokenId, {from: deployer});
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
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
    // add ERC721 token to avoid "ERC721 contract does not exist on SKALE chain" error
    await lockAndDataForSchainERC721
      .addERC721ForSchain(schainID, contractThere, contractHere, {from: deployer});
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer ERC721 token to `lockAndDataForMainnetERC721` to avoid "Token not transferred" error
    await eRC721OnChain.transferFrom(deployer, lockAndDataForSchainERC721.address, tokenId, {from: deployer});
    // get data from `receiveERC721`
    await eRC721ModuleForSchain.receiveERC721(schainID, contractThere , to, tokenId, {from: deployer});
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
    const res = await eRC721ModuleForSchain.getReceiver(data, {from: deployer});
    // expectation
    res.should.be.equal(user);
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

  it("should rejected with `Not allowed ERC721 Token` when invoke `exitToMainERC721`", async () => {
    const error = "Not allowed ERC721 Token";
    const amountToCost = "9000000000000000";
    const tokenId = 10;
    const tokenId2 = 11;
    // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
    await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
    // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
    await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set contract lockAndDataForSchainERC20 to avoid
    // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
    await lockAndDataForSchain.setContract(
        "MessageProxyForSchain", messageProxyForSchain.address, {from: deployer});
    // add connected chain:
    await lockAndDataForSchainERC721.addERC721ForSchain("Mainnet", eRC20.address, eRC20OnChain.address, {from: deployer});
    // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
    const minterRole = await eRC721OnChain.MINTER_ROLE();
    await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
    // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    await eRC721OnChain.mint(deployer, tokenId2, {from: deployer});
    // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
    await lockAndDataForSchainERC721.addERC721ForSchain("Mainnet", eRC721.address, eRC721OnChain.address, {from: deployer});
    // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
    await eRC721OnChain.approve(tokenManager.address, tokenId, {from: deployer});

    // execution:
    await tokenManager
        .exitToMainERC721(eRC721.address, client, tokenId2, {from: deployer})
        .should.be.eventually.rejectedWith(error);
  });

  it("should invoke `exitToMainERC721` without mistakes", async () => {
      const amountToCost = "9000000000000000";
      const tokenId = 10;
      const contractHere = eRC721OnChain.address;
      const contractThere = eRC721.address;
      const to = user;
      const amountEth = new BigNumber("60000000000000000");
      // set EthERC20 address:
      await lockAndDataForSchain.setEthErc20Address(ethERC20.address, {from: deployer});
      // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
      await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});
      // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
      await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
      // to avoid "Message sender is invalid" error
      await lockAndDataForSchain
          .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
      await lockAndDataForSchain
          .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
      // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
      await lockAndDataForSchain.setContract(
          "MessageProxyForSchain", messageProxyForSchain.address, {from: deployer});
      await lockAndDataForSchainERC721.addERC721ForSchain("Mainnet", contractThere, contractHere, {from: deployer});
      // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
      const minterRole = await eRC721OnChain.MINTER_ROLE();
      await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
      // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
      await eRC721OnChain.mint(user, tokenId, {from: deployer});
      // invoke `addExit` to avoid `Does not allow to exit` exception on `exitToMainERC20` function:
      await lockAndDataForSchain.sendEth(user, amountEth, {from: deployer});
      await eRC721OnChain.approve(tokenManager.address, tokenId, {from: user});

      // execution:
      await tokenManager.exitToMainERC721(contractThere, to, tokenId, {from: user});
      // expectation:
      const outgoingMessagesCounterMainnet = new BigNumber(await messageProxyForSchain
          .getOutgoingMessagesCounter("Mainnet"));
      outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
  });

  it("should invoke `transferToSchainERC721` without mistakes", async () => {
      const amountToCost = "9000000000000000";
      const tokenId = 10;
      const contractHere = eRC721OnChain.address;
      const contractThere = eRC721.address;
      const to = user;
      const schainID = randomString(10);
      await lockAndDataForSchain.addSchain(schainID, tokenManager.address, {from: deployer});
      // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
      await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
      // to avoid "Message sender is invalid" error
      await lockAndDataForSchain
          .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
      await lockAndDataForSchain
          .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
      // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
      await lockAndDataForSchain.setContract(
          "MessageProxyForSchain", messageProxyForSchain.address, {from: deployer});
      // add connected chain:
      await messageProxyForSchain.addConnectedChain(schainID, {from: deployer});
      await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
      await lockAndDataForSchainERC721
          .addERC721ForSchain(schainID, contractThere, contractHere, {from: deployer});
      // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
      const minterRole = await eRC721OnChain.MINTER_ROLE();
      await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
      // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
      await eRC721OnChain.mint(deployer, tokenId, {from: deployer});

      await eRC721OnChain.approve(tokenManager.address, tokenId, {from: deployer});

      // execution:
      const res = await tokenManager
          .transferToSchainERC721(schainID, contractThere, to, tokenId, {from: deployer});
      // expectation:
      const outgoingMessagesCounter = new BigNumber(await messageProxyForSchain
          .getOutgoingMessagesCounter(schainID));
      outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
  });

  it("should rejected with `Not allowed ERC721 Token` when invoke `transferToSchainERC721`", async () => {
      const error = "Not allowed ERC721 Token";
      const amountToCost = "9000000000000000";
      const tokenId = 10;
      const tokenId2 = 11;
      const contractHere = eRC721OnChain.address;
      const contractThere = eRC721.address;
      const to = user;
      const schainID = randomString(10);
      await lockAndDataForSchain.addSchain(schainID, tokenManager.address, {from: deployer});
      await messageProxyForSchain.addConnectedChain(schainID, {from: deployer})
      // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
      await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
      // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
      await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
      // set contract lockAndDataForSchainERC20 to avoid
      // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
      await lockAndDataForSchain
          .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
      // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
      await lockAndDataForSchain.setContract(
          "MessageProxyForSchain", messageProxyForSchain.address, {from: deployer});
      await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
      await lockAndDataForSchainERC721
          .addERC721ForSchain(schainID, contractThere, contractHere, {from: deployer});
      // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
      const minterRole = await eRC721OnChain.MINTER_ROLE();
      await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
      // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
      await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
      await eRC721OnChain.mint(deployer, tokenId2, {from: deployer});
      // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
      await lockAndDataForSchainERC721.addERC721ForSchain(schainID, eRC721.address, eRC721OnChain.address, {from: deployer});
      // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
      await eRC721OnChain.approve(tokenManager.address, tokenId, {from: deployer});

      // execution:
      await tokenManager
          .transferToSchainERC721(schainID, contractThere, to, tokenId2, {from: deployer})
          .should.be.eventually.rejectedWith(error);
  });

  describe("tests for `postMessage` function", async () => {
    it("should transfer ERC721 token", async () => {
      //  preparation
      const schainID = randomString(10);
      const amount = 10;
      const to = user;
      const to0 = "0x0000000000000000000000000000000000000000"; // ERC20 address
      const sender = deployer;
      const tokenId = 2;
      const data = await messages.encodeTransferErc721AndTokenInfoMessage(
          eRC721.address,
          to,
          tokenId,
          {
              name: await eRC721.name(),
              symbol: await eRC721.symbol()
          }
      );
      // add schain to avoid the `Unconnected chain` error
      await lockAndDataForSchain
          .addSchain(schainID, deployer, {from: deployer});
      // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
      await messageProxyForSchain
          .addConnectedChain(schainID, {from: deployer});
      // set `ERC721Module` contract before invoke `receiveERC721`
      await lockAndDataForSchain
          .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
      // set `LockAndDataERC721` contract before invoke `receiveERC721`
      await lockAndDataForSchain
          .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
      //
      await lockAndDataForSchain
      .setContract("TokenFactory", tokenFactory.address, {from: deployer});
      // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
      // to avoid `Not a sender` error
      tokenManager = await TokenManager.new(chainID, lockAndDataForSchain.address, {from: deployer});
      // set `tokenManager` contract before invoke `postMessage`
      await lockAndDataForSchain
        .setContract("TokenManager", tokenManager.address, {from: deployer});
      // set EthERC20 address:
      await lockAndDataForSchain.setEthErc20Address(ethERC20.address, {from: deployer});
      // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
      await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});
      await lockAndDataForSchain.setContract("MessageProxy", deployer, {from: deployer});
      await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
      // execution
      await tokenManager.postMessage(schainID, sender, data, {from: deployer});
      // expectation
      const addressERC721OnSchain = await lockAndDataForSchainERC721.getERC721OnSchain(schainID, eRC721.address);
      const erc721OnChain = new web3.eth.Contract(artifacts.require("./ERC721MintAndBurn").abi, addressERC721OnSchain);
      expect(await erc721OnChain.methods.ownerOf(tokenId).call()).to.be.equal(to);
    });
  });

});
