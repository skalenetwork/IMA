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
 * @file DepositBox.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
  ContractManagerContract,
  ContractManagerInstance,
  DepositBoxInstance,
  ERC20ModuleForMainnetInstance,
  ERC721ModuleForMainnetInstance,
  ERC721OnChainContract,
  ERC721OnChainInstance,
  EthERC20Contract,
  EthERC20Instance,
  LockAndDataForMainnetERC20Instance,
  LockAndDataForMainnetERC721Instance,
  LockAndDataForMainnetInstance,
  SchainsInternalContract,
  SchainsInternalInstance,
  } from "../types/truffle-contracts";
import { randomString } from "./utils/helper";

import chai = require("chai");

chai.should();
chai.use((chaiAsPromised as any));

import { deployLockAndDataForMainnet } from "./utils/deploy/lockAndDataForMainnet";
import { deployLockAndDataForMainnetERC20 } from "./utils/deploy/lockAndDataForMainnetERC20";
import { deployLockAndDataForMainnetERC721 } from "./utils/deploy/lockAndDataForMainnetERC721";
import { deployDepositBox } from "./utils/deploy/depositBox";
import { deployERC20ModuleForMainnet } from "./utils/deploy/erc20ModuleForMainnet";
import { deployERC721ModuleForMainnet } from "./utils/deploy/erc721ModuleForMainnet";

const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");
const ContractManager: ContractManagerContract = artifacts.require("./ContractManager");
const SchainsInternal: SchainsInternalContract = artifacts.require("./SchainsInternal");

contract("DepositBox", ([deployer, user]) => {
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let depositBox: DepositBoxInstance;
  let contractManager: ContractManagerInstance;
  let schainsInternal: SchainsInternalInstance;

  beforeEach(async () => {
    contractManager = await ContractManager.new({from: deployer});
    schainsInternal = await SchainsInternal.new({from: deployer});
    await contractManager.setContractsAddress("SchainsInternal", schainsInternal.address, {from: deployer});
    lockAndDataForMainnet = await deployLockAndDataForMainnet();
    depositBox = await deployDepositBox(lockAndDataForMainnet);
    await lockAndDataForMainnet.setContract("ContractManagerForSkaleManager", contractManager.address, {from: deployer});
  });

  describe("tests for `deposit` function", async () => {

    it("should rejected with `Unconnected chain` when invoke `deposit`", async () => {
      // preparation
      const error = "Unconnected chain";
      const schainID = randomString(10);
      // execution/expectation
      await depositBox
        .depositWithoutData(schainID, user, {from: deployer})
        .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with `SKALE chain name is incorrect` when invoke `deposit`", async () => {
      // preparation
      const error = "SKALE chain name is incorrect";
      const schainID = "Mainnet";
      // execution/expectation
      await depositBox
        .depositWithoutData(schainID, user, {from: deployer})
        .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `deposit` without mistakes", async () => {
      // preparation
      const schainID = randomString(10);
      // the wei should be MORE than (55000 * 1000000000)
      // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
      // to avoid the `Not enough money` error
      const wei = "20000000000000000";
      // add schain to avoid the `Unconnected chain` error
      const chain = await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // execution
      const tx = await depositBox
        .depositWithoutData(schainID, deployer, {value: wei, from: deployer});
      // console.log("Gas for deposit:", tx.receipt.gasUsed);

      const lockAndDataBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
      // expectation
      expect(lockAndDataBalance).to.equal(wei);
    });

    it("should revert `Not allowed. in DepositBox`", async () => {
      // preparation
      const error = "Not allowed. in DepositBox";
      // execution/expectation
      await web3.eth.sendTransaction({from: deployer, to: depositBox.address, value: "1000000000000000000"})
      .should.be.eventually.rejectedWith(error);
    });
  });

  describe("tests with `ERC20`", async () => {
    let eRC20ModuleForMainnet: ERC20ModuleForMainnetInstance;
    let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
    let ethERC20: EthERC20Instance;

    beforeEach(async () => {
      eRC20ModuleForMainnet = await deployERC20ModuleForMainnet(lockAndDataForMainnet);
      lockAndDataForMainnetERC20 = await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
      ethERC20 = await EthERC20.new({from: deployer});
    });

    describe("tests for `depositERC20` function", async () => {
      it("should rejected with `ERC20: transfer amount exceeds balance`", async () => {
        // preparation
        const error = "ERC20: transfer amount exceeds balance";
        const schainID = randomString(10);
        // add schain to avoid the `Unconnected chain` error
        const chain = await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});
        // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
        // execution/expectation
        await depositBox
          .depositERC20(schainID, ethERC20.address, deployer, 100, {from: deployer})
          .should.be.eventually.rejectedWith(error);
      });

      it("should invoke `depositERC20` without mistakes", async () => {
        // preparation
        const schainID = randomString(10);
        // add schain to avoid the `Unconnected chain` error
        const chain = await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});
        // mint some quantity of ERC20 tokens for `deployer` address
        await ethERC20.mint(deployer, "1000000000", {from: deployer});
        // approve some quantity of ERC20 tokens for `depositBox` address
        await ethERC20.approve(depositBox.address, "1000000", {from: deployer});
        // execution
        await depositBox
          .depositERC20(schainID, ethERC20.address, deployer, 1, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
        await lockAndDataForMainnetERC20.disableWhitelist(schainID);
        const res = await depositBox
          .depositERC20(schainID, ethERC20.address, deployer, 1, {from: deployer});
        // console.log("Gas for depoositERC20:", res.receipt.gasUsed);
      });

      it("should invoke `depositERC20` with some ETH without mistakes", async () => {
        // preparation
        const schainID = randomString(10);
        // add schain to avoid the `Unconnected chain` error
        const chain = await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});
        // mint some quantity of ERC20 tokens for `deployer` address
        await ethERC20.mint(deployer, "1000000000", {from: deployer});
        // approve some quantity of ERC20 tokens for `depositBox` address
        await ethERC20.approve(depositBox.address, "1000000", {from: deployer});
        // execution
        await depositBox
          .depositERC20(schainID, ethERC20.address, deployer, 1, {value: "1000000000000", from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
        await lockAndDataForMainnetERC20.disableWhitelist(schainID);
        const res = await depositBox
          .depositERC20(schainID, ethERC20.address, deployer, 1, {value: "1000000000000", from: deployer});
        // console.log("Gas for depoositERC20 with eth:", res.receipt.gasUsed);
      });
    });
  });

  describe("tests with `ERC721`", async () => {
    let eRC721ModuleForMainnet: ERC721ModuleForMainnetInstance;
    let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721Instance;
    let eRC721OnChain: ERC721OnChainInstance;

    beforeEach(async () => {
      eRC721ModuleForMainnet = await deployERC721ModuleForMainnet(lockAndDataForMainnet);
      lockAndDataForMainnetERC721 = await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
      eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");

      // mint some ERC721 of  for `deployer` address
      const tokenId = 10;
      await eRC721OnChain.mint(deployer, tokenId, {from: deployer});

    });

    describe("tests for `depositERC721` function", async () => {
      it("should rejected with `Not allowed ERC721 Token`", async () => {
        // preparation
        const error = "Not allowed ERC721 Token";
        const schainID = randomString(10);
        const contractHere = eRC721OnChain.address;
        const to = user;
        const tokenId = 10;
        // the wei should be MORE than (55000 * 1000000000)
        // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
        const wei = "20000000000000000";
        // add schain to avoid the `Unconnected chain` error
        await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});

        // execution/expectation
        await depositBox
          .depositERC721(schainID, contractHere, to, tokenId, {value: wei, from: deployer})
          .should.be.eventually.rejectedWith(error);
      });

      it("should invoke `depositERC721` without mistakes", async () => {
        // preparation
        const schainID = randomString(10);
        const contractHere = eRC721OnChain.address;
        const to = user;
        const tokenId = 10;
        // the wei should be MORE than (55000 * 1000000000)
        // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
        const wei = "20000000000000000";
        // add schain to avoid the `Unconnected chain` error
        await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});
        // transfer tokenId from `deployer` to `depositBox`
        await eRC721OnChain.transferFrom(deployer,
          depositBox.address, tokenId, {from: deployer});
        // execution
        await depositBox
          .depositERC721(schainID, contractHere, to, tokenId, {value: wei, from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
        await lockAndDataForMainnetERC721.disableWhitelist(schainID);
        const res = await depositBox
          .depositERC721(schainID, contractHere, to, tokenId, {value: wei, from: deployer});
        // console.log("Gas for depoositERC721:", res.receipt.gasUsed);
        const lockAndDataBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
        // expectation
        expect(lockAndDataBalance).to.equal(wei);
      });
    });
  });

  describe("tests for `postMessage` function", async () => {
    let eRC20ModuleForMainnet: ERC20ModuleForMainnetInstance;
    let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
    let ethERC20: EthERC20Instance;
    let eRC721ModuleForMainnet: ERC721ModuleForMainnetInstance;
    let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721Instance;
    let eRC721OnChain: ERC721OnChainInstance;

    beforeEach(async () => {
      eRC20ModuleForMainnet = await deployERC20ModuleForMainnet(lockAndDataForMainnet);
      lockAndDataForMainnetERC20 = await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
      ethERC20 = await EthERC20.new({from: deployer});
      eRC721ModuleForMainnet = await deployERC721ModuleForMainnet(lockAndDataForMainnet);
      lockAndDataForMainnetERC721 = await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
      eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");
    });

    it("should rejected with `Message sender is invalid`", async () => {
      //  preparation
      const error = "Message sender is invalid";
      const schainID = randomString(10);
      const amount = 10;
      const bytesData = "0x0";
      const sender = deployer;
      // execution/expectation
      await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: user})
        .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with message `Receiver chain is incorrect` when schainID=`mainnet`", async () => {
      //  preparation
      const error = "Receiver chain is incorrect";
      // for `Receiver chain is incorrect` message schainID should be `Mainnet`
      const schainID = "Mainnet";
      const amount = 10;
      const bytesData = "0x0";
      const sender = deployer;
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      // execution
      await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer})
        .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with message `Receiver chain is incorrect` when "
        + "`sender != ILockAndDataDB(lockAndDataAddress).tokenManagerAddresses(schainHash)`", async () => {
      //  preparation
      const error = "Receiver chain is incorrect";
      const schainID = randomString(10);
      const amount = 10;
      const bytesData = "0x0";
      const sender = deployer;
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      // execution
      await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer})
        .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with message `Not enough money to finish this transaction`", async () => {
      //  preparation
      const error = "Not enough money to finish this transaction";
      const schainID = randomString(10);
      const amount = 10;
      const bytesData = "0x0";
      const sender = deployer;
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      // add schain to avoid the `Receiver chain is incorrect` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // execution
      await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer})
        .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with message `Invalid data`", async () => {
      //  preparation
      const error = "Invalid data";
      const schainID = randomString(10);
      const amount = 10;
      // for `Invalid data` message bytesData should be `0x`
      const bytesData = "0x";
      const sender = deployer;
      const wei = "100000";
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      // add schain to avoid the `Receiver chain is incorrect` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
      await lockAndDataForMainnet
        .receiveEth(deployer, {value: wei, from: deployer});
      // execution
      await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer})
        .should.be.eventually.rejectedWith(error);
    });

    it("should transfer eth", async () => {
      //  preparation
      const schainID = randomString(10);
      const amount = "30000000000000000";
      // for transfer eth bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
      const bytesData = "0x01";
      const sender = deployer;
      const wei = "30000000000000000";
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      // add schain to avoid the `Receiver chain is incorrect` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
      await lockAndDataForMainnet
        .receiveEth(deployer, {value: wei, from: deployer});
      // execution
      await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer});
      // expectation
      const bn = new BigNumber(await lockAndDataForMainnet.approveTransfers(user));
      parseInt(bn.toString(), 10).should.be.
        equal(parseInt(amount.toString(), 10));
    });

    it("should transfer ERC20 token", async () => {
      //  preparation
      const contractHere = ethERC20.address;
      const schainID = randomString(10);
      const amount = 10;
      const amount0 = "30000000000000000";
      const to = user;
      const to0 = "0x0000000000000000000000000000000000000000"; // ERC20 address
      const sender = deployer;
      const wei = "30000000000000000";
      // add schain to avoid the `Unconnected chain` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // mint some quantity of ERC20 tokens for `deployer` address
      await ethERC20.mint(deployer, "1000000000", {from: deployer});
      /**
       * transfer more than `amount` quantity of ERC20 tokens
       * for `lockAndDataForMainnetERC20` to avoid `Not enough money`
       */
      await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
      // get data from `receiveERC20`
      await eRC20ModuleForMainnet.receiveERC20(schainID, contractHere, to, amount, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
      await lockAndDataForMainnetERC20.disableWhitelist(schainID);
      const data = await eRC20ModuleForMainnet.receiveERC20.call(schainID, contractHere, to, amount, {from: deployer});
      await eRC20ModuleForMainnet.receiveERC20(schainID, contractHere, to, amount, {from: deployer});
      // execution
      // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
      await lockAndDataForMainnet
        .receiveEth(deployer, {value: wei, from: deployer});
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      await depositBox
        .postMessage(sender, schainID, to0, amount0, data, {from: deployer});
      // expectation
      const bn = new BigNumber(await lockAndDataForMainnet.approveTransfers(user));
      parseInt(bn.toString(), 10).should.be.
        equal(parseInt(amount0.toString(), 10));
    });

    it("should transfer ERC721 token", async () => {
      //  preparation
      const contractHere = eRC721OnChain.address;
      const schainID = randomString(10);
      const tokenId = 10;
      const amount0 = "30000000000000000";
      const to = user;
      const to0 = "0x0000000000000000000000000000000000000000"; // ERC721 address
      const sender = deployer;
      const wei = "30000000000000000";
      // add schain to avoid the `Unconnected chain` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // mint some ERC721 of  for `deployer` address
      await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
      // transfer tokenId from `deployer` to `lockAndDataForMainnetERC721`
      await eRC721OnChain.transferFrom(deployer,
        lockAndDataForMainnetERC721.address, tokenId, {from: deployer});
      // get data from `receiveERC721`
      eRC721ModuleForMainnet.receiveERC721(schainID, contractHere, to, tokenId, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
      await lockAndDataForMainnetERC721.disableWhitelist(schainID);
      const data = await eRC721ModuleForMainnet.receiveERC721.call(schainID, contractHere, to, tokenId, {from: deployer});
      eRC721ModuleForMainnet.receiveERC721(schainID, contractHere, to, tokenId, {from: deployer});
      // execution
      // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
      await lockAndDataForMainnet
        .receiveEth(deployer, {value: wei, from: deployer});
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      await depositBox
        .postMessage(sender, schainID, to0, amount0, data, {from: deployer});
      // expectation
      const bn = new BigNumber(await lockAndDataForMainnet.approveTransfers(user));
      parseInt(bn.toString(), 10).should.be.
        equal(parseInt(amount0.toString(), 10));
    });

  });

});
