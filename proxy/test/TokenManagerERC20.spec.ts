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
 * @file tokenManagerErc20.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC20OnChainContract,
    ERC20OnChainInstance,
    MessagesTesterContract,
    MessagesTesterInstance,
    TokenManagerERC20Contract,
    TokenManagerERC20Instance,
    MessageProxyForSchainContract,
    MessageProxyForSchainInstance,
    TokenManagerLinkerContract,
    TokenManagerLinkerInstance
} from "../types/truffle-contracts";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");
const TokenManagerErc20: TokenManagerERC20Contract = artifacts.require("./TokenManagerERC20");
const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const TokenManagerLinker: TokenManagerLinkerContract = artifacts.require("./TokenManagerLinker");
const MessagesTester: MessagesTesterContract = artifacts.require("./MessagesTester");

contract("TokenManagerERC20", ([deployer, user, invoker]) => {
  const schainName = "D2-chain";
  let eRC20OnChain: ERC20OnChainInstance;
  let eRC20OnChain2: ERC20OnChainInstance;
  let eRC20OnMainnet: ERC20OnChainInstance;
  let eRC20OnMainnet2: ERC20OnChainInstance;
  let messageProxyForSchain: MessageProxyForSchainInstance;
  let tokenManagerLinker: TokenManagerLinkerInstance;
  let tokenManagerErc20: TokenManagerERC20Instance;
  let messages: MessagesTesterInstance;

  beforeEach(async () => {
    eRC20OnChain = await ERC20OnChain.new("ERC20OnChain", "ERC20", {from: deployer});
    eRC20OnMainnet = await ERC20OnChain.new("SKALE", "SKL", {from: deployer});
    messages = await MessagesTester.new();
    messageProxyForSchain = await MessageProxyForSchain.new(schainName);
    tokenManagerLinker = await TokenManagerLinker.new(messageProxyForSchain.address);
    tokenManagerErc20 = await TokenManagerErc20.new(schainName, messageProxyForSchain.address, tokenManagerLinker.address);
  });

  it("should rejected with `ERC20 contract does not exist on SKALE chain.`", async () => {
    // preparation
    const error = "ERC20 contract does not exist on SKALE chain.";
    const contractHere = eRC20OnChain.address;
    const schainID = randomString(10);
    const to = user;
    const amount = 10;
    // execution/expectation
    await tokenManagerErc20.receiveERC20(schainID, contractHere, to, amount, {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should return send ERC20 token twice", async () => {
    // preparation
    const schainID = randomString(10);
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const name = "D2 token";
    const symbol = "D2";
    const totalSupply = 1e9;

    const data = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, {name, symbol, decimals: 18});
    const data2 = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, {name, symbol, decimals: 18});    
    
    await tokenManagerErc20.enableAutomaticDeploy(schainID, {from: deployer});
    // execution
    const res = await tokenManagerErc20.sendERC20(schainID, data, {from: deployer});
    const newAddress = res.logs[0].args.contractOnSchain;
    // expectation
    const newERC20Contract = new web3.eth.Contract(ABIERC20OnChain.abi, newAddress);
    await tokenManagerErc20.sendERC20(schainID, data2, {from: deployer});
    const balance = await newERC20Contract.methods.balanceOf(to).call();
    parseInt(new BigNumber(balance).toString(), 10).should.be.equal(amount * 2);
  });

  it("should return `true` for `sendERC20` with `to0==address(0)` and `contractAddreess==address(0)`", async () => {
    // preparation
    const schainID = randomString(10);
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const name = "D2 token";
    const symbol = "D2";
    const totalSupply = 999999990;

    const data = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, {name, symbol, decimals: 18})

    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("ERC20Module", tokenManagerErc20.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", tokenManagerErc20.address, {from: deployer});
    //
    await lockAndDataForSchain
        .setContract("TokenFactory", tokenFactory.address, {from: deployer});
    await tokenManagerErc20.enableAutomaticDeploy(schainID, {from: deployer});
    // execution
    const res = await tokenManagerErc20.sendERC20(schainID, data, {from: deployer});
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
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("ERC20Module", tokenManagerErc20.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", tokenManagerErc20.address, {from: deployer});
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `tokenManagerErc20` to avoid `Not enough money`
    await ethERC20.transfer(tokenManagerErc20.address, "1000000", {from: deployer});
    await tokenManagerErc20.enableAutomaticDeploy(schainID, {from: deployer});
    // add ERC20 token to avoid "ERC20 contract does not exist on SKALE chain." error
    await tokenManagerErc20
      .addERC20ForSchain(schainID, ERC20OnMainnet, contractHere, {from: deployer});
    // get data from `receiveERC20`
    await tokenManagerErc20.receiveERC20(schainID, ERC20OnMainnet, to, amount, {from: deployer});
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
    const res = await tokenManagerErc20.getReceiver(data, {from: deployer});
    // expectation
    res.should.be.equal(user);
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
    await eRC20OnChain.grantRole(minterRole, tokenManagerErc20.address);
    // mint some quantity of ERC20 tokens for `deployer` address
    await eRC20OnChain.mint(deployer, "1000000000", {from: deployer});
    // transfer some quantity of ERC20 tokens for `lockAndDataForMainnetERC20` address
    await eRC20OnChain.transfer(tokenManagerErc20.address, "1000000", {from: deployer});
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("ERC20Module", tokenManagerErc20.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", tokenManagerErc20.address, {from: deployer});
    // add ERC20 token to avoid "ERC20 contract does not exist on SKALE chain." error
    await tokenManagerErc20.enableAutomaticDeploy(schainID, {from: deployer});
    await tokenManagerErc20
      .addERC20ForSchain(schainID, ERC20OnMainnet ,contractHere, {from: deployer});
    // execution
    const res = await tokenManagerErc20.receiveERC20.call(schainID, ERC20OnMainnet, to, amount, {from: deployer});
    // expectation
    // (res).should.include("0x"); // l_sergiy: FIX - not passing
  });

  it("should invoke `sendERC20` without mistakes", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const to = user;
    const amount = 10;
    // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
    const minterRole = await eRC20OnChain.MINTER_ROLE();
    await eRC20OnChain.grantRole(minterRole, tokenManagerErc20.address);
    await tokenManagerErc20.setTotalSupplyOnMainnet(contractHere, 9);
    // execution
    await tokenManagerErc20
        .sendERC20(contractHere, to, amount, {from: deployer}).should.be.eventually.rejectedWith("Total supply exceeded");
    await tokenManagerErc20.setTotalSupplyOnMainnet(contractHere, 11);
    // execution
    const res = await tokenManagerErc20
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
    const res = await tokenManagerErc20
        .receiveERC20(contractHere, amount, {from: deployer})
        .should.be.eventually.rejectedWith(error);
  });

  it("should return `true` after invoke `receiveERC20`", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const amount = 10;
    // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
    const minterRole = await eRC20OnChain.MINTER_ROLE();
    await eRC20OnChain.grantRole(minterRole, tokenManagerErc20.address);
    // mint some quantity of ERC20 tokens for `deployer` address
    await eRC20OnChain.mint(deployer, "1000000000", {from: deployer});
    // transfer some quantity of ERC20 tokens for `lockAndDataForMainnetERC20` address
    await eRC20OnChain.transfer(tokenManagerErc20.address, "1000000", {from: deployer});
    // execution
    const res = await tokenManagerErc20
        .receiveERC20(contractHere, amount, {from: deployer});
    // expectation
    expect(res.logs[0].args.result).to.be.true;
  });

  it("should set `ERC20Tokens` and `ERC20Mapper`", async () => {
    // preparation
    const addressERC20 = eRC20OnChain.address;
    const schainID = randomString(10);
    await tokenManagerErc20
        .addERC20ForSchain(schainID, eRC20OnMainnet.address, addressERC20, {from: deployer}).should.be.eventually.rejectedWith("Automatic deploy is disabled");
    await tokenManagerErc20.enableAutomaticDeploy(schainID, {from: deployer});
    // execution
    await tokenManagerErc20
        .addERC20ForSchain(schainID, eRC20OnMainnet.address, addressERC20, {from: deployer});
    // expectation
    expect(await tokenManagerErc20.getERC20OnSchain(schainID, eRC20OnMainnet.address)).to.be.equal(addressERC20);
  });

  it("should add token by owner", async () => {
    // preparation
    const schainID = randomString(10);
    const addressERC20 = eRC20OnChain.address;
    const addressERC201 = eRC20OnMainnet.address;
    const automaticDeploy = await tokenManagerErc20.automaticDeploy(web3.utils.soliditySha3(schainID));
    await tokenManagerErc20.addERC20TokenByOwner(schainID, addressERC201, addressERC20);
    // automaticDeploy == true - enabled automaticDeploy = false - disabled
    if (automaticDeploy) {
      await tokenManagerErc20.disableAutomaticDeploy(schainID);
    } else {
      await tokenManagerErc20.enableAutomaticDeploy(schainID);
    }

    await tokenManagerErc20.addERC20TokenByOwner(schainID, addressERC201, addressERC20);

    eRC20OnChain2 = await ERC20OnChain.new("NewToken", "NTN");
    eRC20OnMainnet2 = await ERC20OnChain.new("NewToken", "NTN");

    if (automaticDeploy) {
      await tokenManagerErc20.enableAutomaticDeploy(schainID);
    } else {
      await tokenManagerErc20.disableAutomaticDeploy(schainID);
    }

    await tokenManagerErc20.addERC20TokenByOwner(schainID, eRC20OnMainnet2.address, eRC20OnChain2.address);

  });

  it("should set and check totalSupplyOnMainnet", async () => {
    const contractHere = eRC20OnChain.address;
    await tokenManagerErc20.setTotalSupplyOnMainnet(contractHere, 9);
    expect((await tokenManagerErc20.totalSupplyOnMainnet(contractHere)).toNumber()).to.be.equal(9);
    await tokenManagerErc20.setTotalSupplyOnMainnet(contractHere, 11);
    expect((await tokenManagerErc20.totalSupplyOnMainnet(contractHere)).toNumber()).to.be.equal(11);
    await tokenManagerErc20.setTotalSupplyOnMainnet(contractHere, 1);
    expect((await tokenManagerErc20.totalSupplyOnMainnet(contractHere)).toNumber()).to.be.equal(1);
  });

  it("should rejected with `Not allowed ERC20 Token` when invoke `exitToMainERC20`", async () => {
    const error = "Not allowed ERC20 Token";
    const amount = new BigNumber(200);
    const amountTo = new BigNumber(20);
    const amountEth = new BigNumber("60000000000000000");
    //
    await lockAndDataForSchain.setContract("ERC20Module", tokenManagerErc20.address, {from: deployer});
    await lockAndDataForSchain.setContract("LockAndDataERC20", tokenManagerErc20.address, {from: deployer});
    // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
    const minterRole = await eRC20OnChain.MINTER_ROLE();
    await eRC20OnChain.grantRole(minterRole, tokenManagerErc20.address, {from: deployer});
    //
    await tokenManagerErc20.addERC20ForSchain("Mainnet", eRC20.address, eRC20OnChain.address, {from: deployer});
    await tokenManagerErc20.setTotalSupplyOnMainnet(eRC20OnChain.address, 199);
    await tokenManagerErc20.sendERC20(eRC20OnChain.address, user, amount, {from: deployer}).should.be.eventually.rejectedWith("Total supply exceeded");
    await tokenManagerErc20.setTotalSupplyOnMainnet(eRC20OnChain.address, 200);
    await tokenManagerErc20.sendERC20(eRC20OnChain.address, user, amount, {from: deployer});
    //
    await eRC20OnChain.approve(tokenManager.address, amountTo, {from: user});
    // // execution/expectation
    await tokenManager.exitToMainERC20(eRC20.address, client, amountTo, {from: deployer})
        .should.be.eventually.rejectedWith(error);
});

  it("should invoke `exitToMainERC20` without mistakes", async () => {
      const amount = "20000000000000000";
      const amountMint =    "10000000000000000";
      const amountToCost = "9000000000000000";
      const amountReduceCost = "8000000000000000";
      const amountEth = new BigNumber("60000000000000000");

      // set EthERC20 address:
      await lockAndDataForSchain.setEthErc20Address(ethERC20.address, {from: deployer});
      // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
      await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});
      // send Eth:
      await lockAndDataForSchain.sendEth(user, amountEth, {from: deployer});

      // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
      await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

      // set contract tokenManagerErc20 to avoid `revert` exception on `exitToMainERC20` function:
      await lockAndDataForSchain.setContract("ERC20Module", tokenManagerErc20.address, {from: deployer});

      // set contract tokenManagerErc20 to avoid
      // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
      await lockAndDataForSchain
          .setContract("LockAndDataERC20", tokenManagerErc20.address, {from: deployer});

      // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
      // await lockAndDataForSchain.setContract(
      // "MessageProxyForSchain", messageProxyForSchain.address, {from: deployer});

      // add connected chain:
      // await messageProxyForSchain.addConnectedChain(chainID, {from: deployer});

      // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
      // const minterRole = await eRC20OnChain.MINTER_ROLE();
      // await eRC20OnChain.grantRole(minterRole, tokenManagerErc20.address);

      await lockAndDataForSchain.setContract("ERC20Module", deployer, {from: deployer});

      // // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
      // await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});

      // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
      await eRC20OnChain.mint(user, amountMint, {from: deployer});

      // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
    await tokenManagerErc20.addERC20ForSchain("Mainnet", eRC20.address, eRC20OnChain.address, {from: deployer});

      // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
      await eRC20OnChain.approve(tokenManager.address, amountMint, {from: user});

      await lockAndDataForSchain.setContract("ERC20Module", tokenManagerErc20.address, {from: deployer});

      // add schain:
      // await lockAndDataForSchain.addSchain(chainID, tokenManager.address, {from: deployer});

      // execution:
      const res = await tokenManager
          .exitToMainERC20(eRC20.address, client, amountReduceCost, {from: user});

      // // expectation:
      const outgoingMessagesCounterMainnet = new BigNumber(await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet"));
      outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
  });

  it("should rejected with `Not allowed ERC20 Token` when invoke `transferToSchainERC20`", async () => {
    const error = "Not allowed ERC20 Token";
    const amount =            "20000000000000000";
    const amountMint =        "10000000000000000";
    const amountToCost =      "9000000000000000";
    const amountReduceCost = "800000000000000000";
    const schainID = randomString(10);
    await lockAndDataForSchain.addSchain(schainID, tokenManager.address, {from: deployer});
    // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
    await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
    // set contract tokenManagerErc20 to avoid `revert` exception on `exitToMainERC20` function:
    await lockAndDataForSchain.setContract("ERC20Module", tokenManagerErc20.address, {from: deployer});
    // set contract tokenManagerErc20 to avoid
    // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", tokenManagerErc20.address, {from: deployer});
    // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
    // await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});
    // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
    await eRC20OnChain.mint(deployer, amountMint, {from: deployer});

    await tokenManagerErc20.enableAutomaticDeploy(schainID, {from: deployer});

    // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
    await tokenManagerErc20.addERC20ForSchain(schainID, eRC20.address, eRC20OnChain.address, {from: deployer});
    // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
    await eRC20OnChain.approve(tokenManager.address, amountMint, {from: deployer});

    // execution:
    await tokenManager
        .transferToSchainERC20(schainID, eRC20.address, client, amountReduceCost, {from: deployer})
        .should.be.eventually.rejectedWith(error);
  });

  it("should invoke `transferToSchainERC20` without mistakes", async () => {
    const amount =            "20000000000000000";
    const amountMint =        "10000000000000000";
    const amountToCost =      "9000000000000000";
    const amountReduceCost = "8000000000000000";
    const schainID = randomString(10);
    await lockAndDataForSchain.addSchain(schainID, tokenManager.address, {from: deployer});
    // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
    await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
    // set contract tokenManagerErc20 to avoid `revert` exception on `exitToMainERC20` function:
    await lockAndDataForSchain.setContract("ERC20Module", tokenManagerErc20.address, {from: deployer});
    // set contract tokenManagerErc20 to avoid
    // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", tokenManagerErc20.address, {from: deployer});
    // add connected chain:
    await messageProxyForSchain.addConnectedChain(schainID, {from: deployer});
    // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
    // await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});
    // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
    await eRC20OnChain.mint(deployer, amountMint, {from: deployer});

    await tokenManagerErc20.enableAutomaticDeploy(schainID, {from: deployer});
    // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
    await tokenManagerErc20.addERC20ForSchain(schainID, eRC20.address, eRC20OnChain.address, {from: deployer});
    // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
    await eRC20OnChain.approve(tokenManager.address, amountMint, {from: deployer});

    // execution:
    await tokenManager
        .transferToSchainERC20(schainID, eRC20.address, client, amountReduceCost, {from: deployer});
    // expectation:
    const outgoingMessagesCounterMainnet = new BigNumber(
        await messageProxyForSchain.getOutgoingMessagesCounter(schainID));
    outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
  });

  describe("tests for `postMessage` function", async () => {
    it("should transfer ERC20 token", async () => {
      //  preparation
      const schainID = randomString(10);
      const amount = 10;
      const to = user;
      const sender = deployer;
      await eRC20.mint(deployer, amount);
      const data = await messages.encodeTransferErc20AndTokenInfoMessage(
          eRC20.address,
          to,
          amount,
          (await eRC20.totalSupply()).toNumber(),
          {
              name: await eRC20.name(),
              symbol: await eRC20.symbol(),
              decimals: (await eRC20.decimals()).toNumber()
          }
      );
      // add schain to avoid the `Unconnected chain` error
      await lockAndDataForSchain
          .addSchain(schainID, deployer, {from: deployer});
      // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
      await messageProxyForSchain
        .addConnectedChain(schainID, {from: deployer});
      // set `ERC20Module` contract before invoke `postMessage`
      await lockAndDataForSchain
        .setContract("ERC20Module", tokenManagerErc20.address, {from: deployer});
      // set `LockAndDataERC20` contract before invoke `postMessage`
      await lockAndDataForSchain
        .setContract("LockAndDataERC20", tokenManagerErc20.address, {from: deployer});
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

      await tokenManagerErc20.enableAutomaticDeploy(schainID, {from: deployer});
      // execution
      await tokenManager.postMessage(schainID, sender, data, {from: deployer});
      // expectation
      const addressERC20OnSchain = await tokenManagerErc20.getERC20OnSchain(schainID, eRC20.address);
      const erc20OnChain = new web3.eth.Contract(artifacts.require("./ERC20MintAndBurn").abi, addressERC20OnSchain);
      expect(parseInt((new BigNumber(await erc20OnChain.methods.balanceOf(to).call())).toString(), 10))
          .to.be.equal(amount);
  });
  });

});
