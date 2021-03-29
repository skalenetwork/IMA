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
  ContractManagerInstance,
  DepositBoxEthInstance,
  IMALinkerInstance,
  MessageProxyForMainnetInstance,
  MessagesTesterContract,
  MessagesTesterInstance
  } from "../types/truffle-contracts";
import { randomString } from "./utils/helper";

import chai = require("chai");

chai.should();
chai.use((chaiAsPromised as any));

import { deployDepositBoxEth } from "./utils/deploy/depositBoxEth";
import { deployIMALinker } from "./utils/deploy/imaLinker";
import { deployMessageProxyForMainnet } from "./utils/deploy/messageProxyForMainnet";
import { deployContractManager } from "./utils/deploy/contractManager";
import { initializeSchain } from "./utils/skale-manager-utils/schainsInternal";
import { setCommonPublicKey } from "./utils/skale-manager-utils/keyStorage";
import { rechargeSchainWallet } from "./utils/skale-manager-utils/wallets";
const MessagesTester: MessagesTesterContract = artifacts.require("./MessagesTester");

const BlsSignature = [
  "178325537405109593276798394634841698946852714038246117383766698579865918287",
  "493565443574555904019191451171395204672818649274520396086461475162723833781",
];
const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
const Counter = 0;

contract("DepositBox", ([deployer, user, user2]) => {
  let depositBox: DepositBoxEthInstance;
  let contractManager: ContractManagerInstance;
  let messageProxy: MessageProxyForMainnetInstance;
  let imaLinker: IMALinkerInstance;
  let contractManagerAddress = "0x0000000000000000000000000000000000000000";

  beforeEach(async () => {
    contractManager = await deployContractManager(contractManagerAddress);
    contractManagerAddress = contractManager.address;
    messageProxy = await deployMessageProxyForMainnet(contractManager);
    imaLinker = await deployIMALinker(contractManager, messageProxy);
    depositBox = await deployDepositBoxEth(imaLinker, contractManager, messageProxy);
  });

  describe("tests for `deposit` function", async () => {

    it("should rejected with `Unconnected chain` when invoke `deposit`", async () => {
      // preparation
      const error = "Unconnected chain";
      const schainID = randomString(10);
      // execution/expectation
      await depositBox
        .deposit(schainID, user, {from: deployer})
        .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with `SKALE chain name is incorrect` when invoke `deposit`", async () => {
      // preparation
      const error = "SKALE chain name is incorrect";
      const schainID = "Mainnet";
      // execution/expectation
      await depositBox
        .deposit(schainID, user, {from: deployer})
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
      const chain = await imaLinker
        .connectSchain(schainID, [deployer], {from: deployer});
      // execution
      const tx = await depositBox
        .deposit(schainID, deployer, {value: wei, from: deployer});
      // console.log("Gas for deposit:", tx.receipt.gasUsed);

      const lockAndDataBalance = await web3.eth.getBalance(depositBox.address);
      // expectation
      expect(lockAndDataBalance).to.equal(wei);
    });

    it("should revert `Not allowed. in DepositBox`", async () => {
      // preparation
      const error = "Use deposit function";
      // execution/expectation
      await web3.eth.sendTransaction({from: deployer, to: depositBox.address, value: "1000000000000000000"})
      .should.be.eventually.rejectedWith(error);
    });
  });

  // describe("tests with `ERC20`", async () => {
  //   let eRC20ModuleForMainnet: ERC20ModuleForMainnetInstance;
  //   let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
  //   let ethERC20: EthERC20Instance;

  //   beforeEach(async () => {
  //     eRC20ModuleForMainnet = await deployERC20ModuleForMainnet(lockAndDataForMainnet);
  //     lockAndDataForMainnetERC20 = await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
  //     ethERC20 = await EthERC20.new({from: deployer});
  //   });

  //   describe("tests for `depositERC20` function", async () => {
  //     it("should rejected with `ERC20: transfer amount exceeds balance`", async () => {
  //       // preparation
  //       const error = "ERC20: transfer amount exceeds balance";
  //       const schainID = randomString(10);
  //       // add schain to avoid the `Unconnected chain` error
  //       const chain = await lockAndDataForMainnet
  //         .addSchain(schainID, deployer, {from: deployer});
  //       // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
  //       // execution/expectation
  //       await depositBox
  //         .depositERC20(schainID, ethERC20.address, deployer, 100, {from: deployer})
  //         .should.be.eventually.rejectedWith(error);
  //     });

  //     it("should invoke `depositERC20` without mistakes", async () => {
  //       // preparation
  //       const schainID = randomString(10);
  //       // add schain to avoid the `Unconnected chain` error
  //       const chain = await lockAndDataForMainnet
  //         .addSchain(schainID, deployer, {from: deployer});
  //       // mint some quantity of ERC20 tokens for `deployer` address
  //       await ethERC20.mint(deployer, "1000000000", {from: deployer});
  //       // approve some quantity of ERC20 tokens for `depositBox` address
  //       await ethERC20.approve(depositBox.address, "1000000", {from: deployer});
  //       // execution
  //       await depositBox
  //         .depositERC20(schainID, ethERC20.address, deployer, 1, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
  //       await lockAndDataForMainnetERC20.disableWhitelist(schainID);
  //       await depositBox
  //         .depositERC20(schainID, ethERC20.address, deployer, 1, {from: deployer});
  //       const res = await depositBox
  //         .depositERC20(schainID, ethERC20.address, deployer, 1, {from: deployer});
  //       // console.log("Gas for depoositERC20:", res.receipt.gasUsed);
  //     });

  //     it("should invoke `depositERC20` with some ETH without mistakes", async () => {
  //       // preparation
  //       const schainID = randomString(10);
  //       // add schain to avoid the `Unconnected chain` error
  //       const chain = await lockAndDataForMainnet
  //         .addSchain(schainID, deployer, {from: deployer});
  //       // mint some quantity of ERC20 tokens for `deployer` address
  //       await ethERC20.mint(deployer, "1000000000", {from: deployer});
  //       // approve some quantity of ERC20 tokens for `depositBox` address
  //       await ethERC20.approve(depositBox.address, "1000000", {from: deployer});
  //       // execution
  //       await depositBox
  //         .depositERC20(schainID, ethERC20.address, deployer, 1, {value: "1000000000000", from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
  //       await lockAndDataForMainnetERC20.disableWhitelist(schainID);
  //       await depositBox
  //         .depositERC20(schainID, ethERC20.address, deployer, 1, {value: "1000000000000", from: deployer});
  //       const res = await depositBox
  //         .depositERC20(schainID, ethERC20.address, deployer, 1, {value: "1000000000000", from: deployer});
  //       // console.log("Gas for depoositERC20 with eth:", res.receipt.gasUsed);
  //     });
  //   });
  // });

  // describe("tests with `ERC721`", async () => {
  //   let eRC721ModuleForMainnet: ERC721ModuleForMainnetInstance;
  //   let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721Instance;
  //   let eRC721OnChain: ERC721OnChainInstance;

  //   beforeEach(async () => {
  //     eRC721ModuleForMainnet = await deployERC721ModuleForMainnet(lockAndDataForMainnet);
  //     lockAndDataForMainnetERC721 = await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
  //     eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");

  //     // mint some ERC721 of  for `deployer` address
  //     const tokenId = 10;
  //     await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
  //     const tokenId2 = 11;
  //     await eRC721OnChain.mint(deployer, tokenId2, {from: deployer});

  //   });

  //   describe("tests for `depositERC721` function", async () => {
  //     it("should rejected with `ERC721: transfer caller is not owner nor approved`", async () => {
  //       // preparation
  //       const error = "ERC721: transfer caller is not owner nor approved";
  //       const schainID = randomString(10);
  //       const contractHere = eRC721OnChain.address;
  //       const to = user;
  //       const tokenId = 10;
  //       // the wei should be MORE than (55000 * 1000000000)
  //       // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
  //       const wei = "20000000000000000";
  //       // add schain to avoid the `Unconnected chain` error
  //       await lockAndDataForMainnet
  //         .addSchain(schainID, deployer, {from: deployer});

  //       // execution/expectation
  //       await depositBox
  //         .depositERC721(schainID, contractHere, to, tokenId, {value: wei, from: deployer})
  //         .should.be.eventually.rejectedWith(error);
  //     });

  //     it("should invoke `depositERC721` with ETH without mistakes", async () => {
  //       // preparation
  //       const schainID = randomString(10);
  //       const contractHere = eRC721OnChain.address;
  //       const to = user;
  //       const tokenId = 10;
  //       const tokenId2 = 11;
  //       // the wei should be MORE than (55000 * 1000000000)
  //       // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
  //       const wei = "20000000000000000";
  //       // add schain to avoid the `Unconnected chain` error
  //       await lockAndDataForMainnet
  //         .addSchain(schainID, deployer, {from: deployer});
  //       // transfer tokenId from `deployer` to `depositBox`
  //       await eRC721OnChain.transferFrom(deployer,
  //         depositBox.address, tokenId, {from: deployer});
  //       await eRC721OnChain.transferFrom(deployer,
  //         depositBox.address, tokenId2, {from: deployer});
  //       // execution
  //       await depositBox
  //         .depositERC721(schainID, contractHere, to, tokenId, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
  //       await lockAndDataForMainnetERC721.disableWhitelist(schainID);
  //       await depositBox
  //         .depositERC721(schainID, contractHere, to, tokenId, {from: deployer});
  //       const res = await depositBox
  //         .depositERC721(schainID, contractHere, to, tokenId2, {from: deployer});
  //       // console.log("Gas for depoositERC721:", res.receipt.gasUsed);
  //       const lockAndDataBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
  //       // expectation
  //       expect(lockAndDataBalance).to.equal("0");
  //     });

  //     it("should invoke `depositERC721` with ETH without mistakes", async () => {
  //       // preparation
  //       const schainID = randomString(10);
  //       const contractHere = eRC721OnChain.address;
  //       const to = user;
  //       const tokenId = 10;
  //       const tokenId2 = 11;
  //       // the wei should be MORE than (55000 * 1000000000)
  //       // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
  //       const wei = "20000000000000000";
  //       // add schain to avoid the `Unconnected chain` error
  //       await lockAndDataForMainnet
  //         .addSchain(schainID, deployer, {from: deployer});
  //       // transfer tokenId from `deployer` to `depositBox`
  //       await eRC721OnChain.transferFrom(deployer,
  //         depositBox.address, tokenId, {from: deployer});
  //       await eRC721OnChain.transferFrom(deployer,
  //         depositBox.address, tokenId2, {from: deployer});
  //       // execution
  //       await depositBox
  //         .depositERC721(schainID, contractHere, to, tokenId, {value: wei, from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
  //       await lockAndDataForMainnetERC721.disableWhitelist(schainID);
  //       await depositBox
  //         .depositERC721(schainID, contractHere, to, tokenId, {value: wei, from: deployer});
  //       const res = await depositBox
  //         .depositERC721(schainID, contractHere, to, tokenId2, {value: wei, from: deployer});
  //       // console.log("Gas for depoositERC721 with eth:", res.receipt.gasUsed);
  //       const lockAndDataBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
  //       // expectation
  //       expect(lockAndDataBalance).to.equal((new BigNumber(wei)).multipliedBy(2).toString());
  //     });
  //   });
  // });

  describe("tests for `postMessage` function", async () => {
    // let eRC20ModuleForMainnet: ERC20ModuleForMainnetInstance;
    // let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
    // let ethERC20: EthERC20Instance;
    // let eRC721ModuleForMainnet: ERC721ModuleForMainnetInstance;
    // let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721Instance;
    // let eRC721OnChain: ERC721OnChainInstance;
    let messages: MessagesTesterInstance;

    beforeEach(async () => {
      // eRC20ModuleForMainnet = await deployERC20ModuleForMainnet(lockAndDataForMainnet);
      // lockAndDataForMainnetERC20 = await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
      // ethERC20 = await EthERC20.new({from: deployer});
      // eRC721ModuleForMainnet = await deployERC721ModuleForMainnet(lockAndDataForMainnet);
      // lockAndDataForMainnetERC721 = await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
      // eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");
      messages = await MessagesTester.new();
    });

    it("should rejected with `Sender is not a MessageProxy`", async () => {
      //  preparation
      const error = "Sender is not a MessageProxy";
      const schainID = randomString(10);
      const amount = "10";
      const bytesData = "0x0";
      const sender = deployer;
      // execution/expectation
      await depositBox
        .postMessage(schainID, sender, user, amount, bytesData, {from: user})
        .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with message `Receiver chain is incorrect` when schain is not registered in DepositBox", async () => {
      //  preparation
      const error = "Receiver chain is incorrect";
      // for `Receiver chain is incorrect` message schainID should be `Mainnet`
      const schainID = "Bob";
      const amountEth = "10";
      const bytesData = web3.eth.abi.encodeParameters(['uint8'], [1]);
      const senderFromSchain = deployer;

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        amount: amountEth,
        data: bytesData,
        destinationContract: depositBox.address,
        sender: senderFromSchain,
        to: user
      };
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      await messageProxy.addConnectedChain(schainID, {from: deployer});
      await initializeSchain(contractManager, schainID, deployer, 1, 1);
      await setCommonPublicKey(contractManager, schainID);
      await rechargeSchainWallet(contractManager, schainID, "1000000000000000000");
      // execution

      const res = await messageProxy.postIncomingMessages(schainID, 0, [message], sign, 0, {from: deployer});
      // console.log(res.logs);
      assert.equal(res.logs.length, 1);
      assert.equal(res.logs[0].event, "PostMessageError");
      assert.equal(res.logs[0].args.msgCounter.toString(), "0");
      const messageError = res.logs[0].args.message.toString();
      assert.equal(Buffer.from(messageError.slice(2), 'hex').toString(), error);
      // assert.equal(res.logs[0].args.message, "PostMessageError");
    });

    it("should rejected with message `Receiver chain is incorrect` when "
        + "`sender != ILockAndDataDB(lockAndDataAddress).tokenManagerAddresses(schainHash)`", async () => {
      //  preparation
      const error = "Receiver chain is incorrect";
      const schainID = randomString(10);
      const amountEth = "10";
      const bytesData = web3.eth.abi.encodeParameters(['uint8'], [1]);
      const senderFromSchain = deployer;

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        amount: amountEth,
        data: bytesData,
        destinationContract: depositBox.address,
        sender: senderFromSchain,
        to: user
      };
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      const chain = await imaLinker
        .connectSchain(schainID, [user2], {from: deployer});
      await initializeSchain(contractManager, schainID, deployer, 1, 1);
      await setCommonPublicKey(contractManager, schainID);
      await rechargeSchainWallet(contractManager, schainID, "1000000000000000000");
      // execution
      const res = await messageProxy.postIncomingMessages(schainID, 0, [message], sign, 0, {from: deployer});

      assert.equal(res.logs.length, 1);
      assert.equal(res.logs[0].event, "PostMessageError");
      assert.equal(res.logs[0].args.msgCounter.toString(), "0");
      const messageError = res.logs[0].args.message.toString();
      assert.equal(Buffer.from(messageError.slice(2), 'hex').toString(), error);
    });

    it("should rejected with message `Not enough money to finish this transaction`", async () => {
      //  preparation
      const error = "Not enough money to finish this transaction";
      const schainID = randomString(10);
      const amountEth = "10";
      const bytesData = web3.eth.abi.encodeParameters(['uint8'], [1]);
      const senderFromSchain = deployer;

      await initializeSchain(contractManager, schainID, deployer, 1, 1);
      await setCommonPublicKey(contractManager, schainID);
      await rechargeSchainWallet(contractManager, schainID, "1000000000000000000");

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        amount: amountEth,
        data: bytesData,
        destinationContract: depositBox.address,
        sender: senderFromSchain,
        to: user
      };
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      // add schain to avoid the `Receiver chain is incorrect` error
      const chain = await imaLinker
        .connectSchain(schainID, [deployer], {from: deployer});
      // execution
      const res = await messageProxy.postIncomingMessages(schainID, 0, [message], sign, 0, {from: deployer});

      assert.equal(res.logs.length, 1);
      assert.equal(res.logs[0].event, "PostMessageError");
      assert.equal(res.logs[0].args.msgCounter.toString(), "0");
      const messageError = res.logs[0].args.message.toString();
      assert.equal(Buffer.from(messageError.slice(2), 'hex').toString(), error);
    });

    it("should rejected with message `Invalid data`", async () => {
      //  preparation
      const error = "Invalid data";
      const schainID = randomString(10);
      const amountEth = "10";
      // for `Invalid data` message bytesData should be `0x`
      const bytesData = "0x";
      const senderFromSchain = deployer;
      const wei = "100000";

      await initializeSchain(contractManager, schainID, deployer, 1, 1);
      await setCommonPublicKey(contractManager, schainID);
      await rechargeSchainWallet(contractManager, schainID, "1000000000000000000");

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        amount: amountEth,
        data: bytesData,
        destinationContract: depositBox.address,
        sender: senderFromSchain,
        to: user
      };
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      // add schain to avoid the `Receiver chain is incorrect` error
      const chain = await imaLinker
        .connectSchain(schainID, [deployer], {from: deployer});
      // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
      await depositBox
        .deposit(schainID, user, {value: wei, from: deployer});
      // execution
      const res = await messageProxy.postIncomingMessages(schainID, 0, [message], sign, 0, {from: deployer});

      assert.equal(res.logs.length, 1);
      assert.equal(res.logs[0].event, "PostMessageError");
      assert.equal(res.logs[0].args.msgCounter.toString(), "0");
      const messageError = res.logs[0].args.message.toString();
      assert.equal(Buffer.from(messageError.slice(2), 'hex').toString(), error);
    });

    it("should transfer eth", async () => {
      //  preparation
      const schainID = randomString(10);
      // for transfer eth bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
      const bytesData = web3.eth.abi.encodeParameters(['uint8'], [1]);
      const senderFromSchain = deployer;
      const wei = "30000000000000000";

      await setCommonPublicKey(contractManager, schainID);

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        amount: wei,
        data: bytesData,
        destinationContract: depositBox.address,
        sender: senderFromSchain,
        to: user
      };
      // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      // add schain to avoid the `Receiver chain is incorrect` error

      await initializeSchain(contractManager, schainID, deployer, 1, 1);
      await rechargeSchainWallet(contractManager, schainID, "1000000000000000000");
      const chain = await imaLinker
        .connectSchain(schainID, [deployer], {from: deployer});
      // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
      await depositBox
        .deposit(schainID, user, {value: wei, from: deployer});
      // execution
      const res = await messageProxy.postIncomingMessages(schainID, 0, [message], sign, 0, {from: deployer});
      // console.log("Gas for postMessage Eth:", res.receipt.gasUsed);
      // expectation
      await depositBox.approveTransfers(user);
    });

    // it("should transfer ERC20 token", async () => {
    //   //  preparation
    //   const contractHere = ethERC20.address;
    //   const schainID = randomString(10);
    //   const amount = 10;
    //   const to = user;
    //   const to0 = "0x0000000000000000000000000000000000000000"; // ERC20 address
    //   const sender = deployer;
    //   const wei = "30000000000000000";

    //   await schainsInternal.initializeSchain(schainID, deployer, 1, 1);
    //   // add schain to avoid the `Unconnected chain` error
    //   await lockAndDataForMainnet
    //     .addSchain(schainID, deployer, {from: deployer});
    //   // mint some quantity of ERC20 tokens for `deployer` address
    //   await ethERC20.mint(deployer, "1000000000", {from: deployer});
    //   /**
    //    * transfer more than `amount` quantity of ERC20 tokens
    //    * for `lockAndDataForMainnetERC20` to avoid `Not enough money`
    //    */
    //   await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    //   // get data from `receiveERC20`
    //   await eRC20ModuleForMainnet.receiveERC20(schainID, contractHere, to, amount, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
    //   await lockAndDataForMainnetERC20.disableWhitelist(schainID);
    //   await eRC20ModuleForMainnet.receiveERC20(schainID, contractHere, to, amount, {from: deployer});
    //   // execution
    //   // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
    //   await lockAndDataForMainnet
    //     .receiveEth(deployer, {value: wei, from: deployer});
    //   // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
    //   // to avoid `Incorrect sender` error
    //   await lockAndDataForMainnet.setContract("MessageProxy", deployer);
    //   const data = await messages.encodeTransferErc20Message(contractHere, to, amount);
    //   const res = await depositBox
    //     .postMessage(schainID, sender, to0, wei, data, {from: deployer});
    //   // console.log("Gas for postMessage ERC20:", res.receipt.gasUsed);
    //   // expectation
    //   await lockAndDataForMainnet.approveTransfers(user);
    // });

    // it("should transfer ERC721 token", async () => {
    //   //  preparation
    //   const contractHere = eRC721OnChain.address;
    //   const schainID = randomString(10);
    //   const tokenId = 10;
    //   const to = user;
    //   const to0 = "0x0000000000000000000000000000000000000000"; // ERC721 address
    //   const sender = deployer;
    //   const wei = "30000000000000000";

    //   await schainsInternal.initializeSchain(schainID, deployer, 1, 1);
    //   // add schain to avoid the `Unconnected chain` error
    //   await lockAndDataForMainnet
    //     .addSchain(schainID, deployer, {from: deployer});
    //   // mint some ERC721 of  for `deployer` address
    //   await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    //   // transfer tokenId from `deployer` to `lockAndDataForMainnetERC721`
    //   await eRC721OnChain.transferFrom(deployer,
    //     lockAndDataForMainnetERC721.address, tokenId, {from: deployer});
    //   // get data from `receiveERC721`
    //   eRC721ModuleForMainnet.receiveERC721(schainID, contractHere, to, tokenId, {from: deployer}).should.be.eventually.rejectedWith("Whitelist is enabled");
    //   await lockAndDataForMainnetERC721.disableWhitelist(schainID);
    //   eRC721ModuleForMainnet.receiveERC721(schainID, contractHere, to, tokenId, {from: deployer});
    //   // execution
    //   // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
    //   await lockAndDataForMainnet
    //     .receiveEth(deployer, {value: wei, from: deployer});
    //   // redeploy depositBox with `developer` address instead `messageProxyForMainnet.address`
    //   // to avoid `Incorrect sender` error
    //   await lockAndDataForMainnet.setContract("MessageProxy", deployer);
    //   const data = await messages.encodeTransferErc721Message(contractHere, to, tokenId);
    //   const res = await depositBox
    //     .postMessage(schainID, sender, to0, wei, data, {from: deployer});
    //   // console.log("Gas for postMessage ERC721:", res.receipt.gasUsed);
    //   // expectation
    //   await lockAndDataForMainnet.approveTransfers(user);
    // });

  });

});
