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
    TokenManagerLinkerContract,
    TokenManagerLinkerInstance,
    SkaleFeaturesMockContract,
    MessageProxyForSchainTesterContract,
    MessageProxyForSchainTesterInstance,
    TokenFactoryERC20Contract
} from "../types/truffle-contracts";

import chai = require("chai");
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");
const TokenManagerErc20: TokenManagerERC20Contract = artifacts.require("./TokenManagerERC20");
const MessageProxyForSchainTester: MessageProxyForSchainTesterContract = artifacts.require("./MessageProxyForSchainTester");
const TokenManagerLinker: TokenManagerLinkerContract = artifacts.require("./TokenManagerLinker");
const MessagesTester: MessagesTesterContract = artifacts.require("./MessagesTester");
const SkaleFeaturesMock: SkaleFeaturesMockContract = artifacts.require("./SkaleFeaturesMock");
const TokenFactoryERC20: TokenFactoryERC20Contract = artifacts.require("./TokenFactoryERC20");

contract("TokenManagerERC20", ([deployer, user, schainOwner, depositBox]) => {
  const mainnetName = "Mainnet";
  const schainName = "D2-chain";
  let erc20OnChain: ERC20OnChainInstance;
  let eRC20OnChain2: ERC20OnChainInstance;
  let erc20OnMainnet: ERC20OnChainInstance;
  let eRC20OnMainnet2: ERC20OnChainInstance;
  let messageProxyForSchain: MessageProxyForSchainTesterInstance;
  let tokenManagerLinker: TokenManagerLinkerInstance;
  let tokenManagerErc20: TokenManagerERC20Instance;
  let messages: MessagesTesterInstance;

  beforeEach(async () => {
    erc20OnChain = await ERC20OnChain.new("ERC20OnChain", "ERC20", {from: deployer});
    erc20OnMainnet = await ERC20OnChain.new("SKALE", "SKL", {from: deployer});
    messages = await MessagesTester.new();
    messageProxyForSchain = await MessageProxyForSchainTester.new(schainName);
    tokenManagerLinker = await TokenManagerLinker.new(messageProxyForSchain.address);
    tokenManagerErc20 = await TokenManagerErc20.new(schainName, messageProxyForSchain.address, tokenManagerLinker.address, depositBox);
    const tokenFactoryErc20 = await TokenFactoryERC20.new("TokenManagerERC20", tokenManagerErc20.address);

    const skaleFeatures = await SkaleFeaturesMock.new();
    await skaleFeatures.setSchainOwner(schainOwner);
    await skaleFeatures.setTokenFactoryErc20Address(tokenFactoryErc20.address);

    await tokenManagerErc20.grantRole(await tokenManagerErc20.SKALE_FEATURES_SETTER_ROLE(), deployer);
    await tokenManagerErc20.setSkaleFeaturesAddress(skaleFeatures.address);

    await tokenManagerErc20.addERC20TokenByOwner(schainName, erc20OnMainnet.address, erc20OnChain.address, {from: schainOwner});
  });

  it("should reject on exit if there is no mainnet token clone on schain", async () => {
    // preparation
    const error = "No token clone on schain";
    const to = user;
    const amount = 10;
    // execution/expectation
    await tokenManagerErc20.exitToMainERC20(deployer, to, amount, {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should send ERC20 token twice", async () => {
    // preparation
    const to = user;
    const amount = 10;
    const name = "D2 token";
    const symbol = "D2";
    const totalSupply = 1e9;

    const data = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, {name, symbol, decimals: 18});
    const data2 = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, {name, symbol, decimals: 18});

    await tokenManagerErc20.enableAutomaticDeploy({from: schainOwner});
    // execution
    const res = await messageProxyForSchain.postMessage(tokenManagerErc20.address, mainnetName, depositBox, data);
    // TODO: use waffle
    const newAddress = "0x" + res.receipt.rawLogs[res.receipt.rawLogs.length - 2].topics[2].slice(-40);
    // expectation
    const newERC20Contract = new web3.eth.Contract(artifacts.require("./ERC20OnChain").abi, newAddress);
    await messageProxyForSchain.postMessage(tokenManagerErc20.address, mainnetName, depositBox, data2);
    const balance = await newERC20Contract.methods.balanceOf(to).call();
    parseInt(new BigNumber(balance).toString(), 10).should.be.equal(amount * 2);
  });

  it("should reject with `Insufficient funds` if token balance is too low", async () => {
    // preparation
    const error = "Insufficient funds";
    const amount = 10;
    // execution/expectation
    await erc20OnChain.approve(tokenManagerErc20.address, amount, {from: user});
    const res = await tokenManagerErc20
        .exitToMainERC20(erc20OnMainnet.address, user, amount, {from: user})
        .should.be.eventually.rejectedWith(error);
  });

  it("should add token by owner", async () => {
    // preparation
    const schainID = randomString(10);
    const addressERC20 = erc20OnChain.address;
    const addressERC201 = erc20OnMainnet.address;
    const automaticDeploy = await tokenManagerErc20.automaticDeploy();
    await tokenManagerErc20.addERC20TokenByOwner(schainID, addressERC201, addressERC20, {from: schainOwner});
    // automaticDeploy == true - enabled automaticDeploy = false - disabled
    if (automaticDeploy) {
      await tokenManagerErc20.disableAutomaticDeploy({from: schainOwner});
    } else {
      await tokenManagerErc20.enableAutomaticDeploy({from: schainOwner});
    }

    await tokenManagerErc20.addERC20TokenByOwner(schainID, addressERC201, addressERC20, {from: schainOwner});

    eRC20OnChain2 = await ERC20OnChain.new("NewToken", "NTN");
    eRC20OnMainnet2 = await ERC20OnChain.new("NewToken", "NTN");

    if (automaticDeploy) {
      await tokenManagerErc20.enableAutomaticDeploy({from: schainOwner});
    } else {
      await tokenManagerErc20.disableAutomaticDeploy({from: schainOwner});
    }

    await tokenManagerErc20.addERC20TokenByOwner(schainID, eRC20OnMainnet2.address, eRC20OnChain2.address, {from: schainOwner});

  });

  it("should reject with `Transfer is not approved by token holder` when invoke `exitToMainERC20`", async () => {
    const error = "Transfer is not approved by token holder";
    const amount = 20;

    // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
    const minterRole = await erc20OnChain.MINTER_ROLE();
    await erc20OnChain.mint(user, amount * 2);
    await erc20OnChain.grantRole(minterRole, tokenManagerErc20.address, {from: deployer});
    //
    await erc20OnChain.approve(tokenManagerErc20.address, amount / 2, {from: user});
    // execution/expectation
    await tokenManagerErc20.exitToMainERC20(erc20OnMainnet.address, user, amount, {from: user})
        .should.be.eventually.rejectedWith(error);
  });

  it("should invoke `exitToMainERC20` without mistakes", async () => {
      const amount = "20000000000000000";
      const amountMint =    "10000000000000000";
      const amountToCost = "9000000000000000";
      const amountReduceCost = "8000000000000000";
      const amountEth = new BigNumber("60000000000000000");

      // // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
      // await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});

      // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
      await erc20OnChain.mint(user, amountMint, {from: deployer});

      // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
      await erc20OnChain.approve(tokenManagerErc20.address, amountMint, {from: user});

      // add schain:
      // await lockAndDataForSchain.addSchain(chainID, tokenManager.address, {from: deployer});

      // execution:
      const res = await tokenManagerErc20
          .exitToMainERC20(erc20OnMainnet.address, user, amountReduceCost, {from: user});

      // // expectation:
      const outgoingMessagesCounterMainnet = new BigNumber(await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet"));
      outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
  });

  it("should invoke `transferToSchainERC20` without mistakes", async () => {
    const amount = "20000000000000000";
    const amountReduceCost = "8000000000000000";
    const schainID = randomString(10);

    // add connected chain:
    await messageProxyForSchain.grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer, {from: deployer});
    await messageProxyForSchain.addConnectedChain(schainID, {from: deployer});
    // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
    // await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});
    // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
    await erc20OnChain.mint(user, amount, {from: deployer});

    // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
    await erc20OnChain.approve(tokenManagerErc20.address, amount, {from: user});

    // execution:
    await tokenManagerErc20
        .transferToSchainERC20(schainID, erc20OnMainnet.address, user, amountReduceCost, {from: user});
    // expectation:
    const outgoingMessagesCounter = new BigNumber(
        await messageProxyForSchain.getOutgoingMessagesCounter(schainID));
    outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
  });

  describe("tests for `postMessage` function", async () => {
    it("should transfer ERC20 token", async () => {
      //  preparation
      const schainID = randomString(10);
      const remoteTokenManagerAddress = depositBox;
      await tokenManagerErc20.addTokenManager(schainID, remoteTokenManagerAddress);

      const amount = 10;
      const to = user;
      const sender = deployer;
      await erc20OnMainnet.mint(deployer, amount);
      const data = await messages.encodeTransferErc20AndTokenInfoMessage(
          erc20OnMainnet.address,
          to,
          amount,
          (await erc20OnMainnet.totalSupply()).toNumber(),
          {
              name: await erc20OnMainnet.name(),
              symbol: await erc20OnMainnet.symbol(),
              decimals: (await erc20OnMainnet.decimals()).toNumber()
          }
      );
      await tokenManagerErc20.enableAutomaticDeploy({from: schainOwner});

      // execution
      await messageProxyForSchain.postMessage(tokenManagerErc20.address, schainID, remoteTokenManagerAddress, data);
      // expectation
      const addressERC20OnSchain = await tokenManagerErc20.getErc20OnSchain(schainID, erc20OnMainnet.address);
      const targetErc20OnChain = new web3.eth.Contract(artifacts.require("./ERC20OnChain").abi, addressERC20OnSchain);
      expect(parseInt((new BigNumber(await targetErc20OnChain.methods.balanceOf(to).call())).toString(), 10))
          .to.be.equal(amount);
    });
  });
});
