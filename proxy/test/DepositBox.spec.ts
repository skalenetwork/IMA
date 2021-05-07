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

import * as chaiAsPromised from "chai-as-promised";
// import chaiAlmost from "chai-almost";
import * as chai from "chai";
import {
  ContractManager,
  DepositBoxEth,
  DepositBoxERC20,
  DepositBoxERC721,
  EthERC20,
  ERC721OnChain,
  IMALinker,
  MessageProxyForMainnet,
  MessagesTester
  } from "../typechain";
import { randomString, stringValue } from "./utils/helper";


chai.should();
chai.use((chaiAsPromised as any));

import { deployDepositBoxEth } from "./utils/deploy/mainnet/depositBoxEth";
import { deployDepositBoxERC20 } from "./utils/deploy/mainnet/depositBoxERC20";
import { deployDepositBoxERC721 } from "./utils/deploy/mainnet/depositBoxERC721";
import { deployIMALinker } from "./utils/deploy/mainnet/imaLinker";
import { deployMessageProxyForMainnet } from "./utils/deploy/messageProxyForMainnet";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { deployMessages } from "./utils/deploy/messages";
import { deployEthERC20 } from "./utils/deploy/schain/ethERC20";
import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";
import { initializeSchain } from "./utils/skale-manager-utils/schainsInternal";
import { setCommonPublicKey } from "./utils/skale-manager-utils/keyStorage";
import { rechargeSchainWallet } from "./utils/skale-manager-utils/wallets";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

const BlsSignature: [BigNumber, BigNumber] = [
  BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
  BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781")
];
const HashA = BigNumber.from("3080491942974172654518861600747466851589809241462384879086673256057179400078");
const HashB = BigNumber.from("15163860114293529009901628456926790077787470245128337652112878212941459329347");
const Counter = BigNumber.from(0);

describe("DepositBox", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;

  let depositBoxEth: DepositBoxEth;
  let depositBoxERC20: DepositBoxERC20;
  let depositBoxERC721: DepositBoxERC721;
  let contractManager: ContractManager;
  let messageProxy: MessageProxyForMainnet;
  let imaLinker: IMALinker;
  let contractManagerAddress = "0x0000000000000000000000000000000000000000";

  before(async () => {
    [deployer, user, user2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    contractManager = await deployContractManager(contractManagerAddress);
    contractManagerAddress = contractManager.address;
    messageProxy = await deployMessageProxyForMainnet(contractManager);
    imaLinker = await deployIMALinker(contractManager, messageProxy);
    depositBoxEth = await deployDepositBoxEth(contractManager, messageProxy, imaLinker);
    depositBoxERC20 = await deployDepositBoxERC20(contractManager, messageProxy, imaLinker);
    depositBoxERC721 = await deployDepositBoxERC721(contractManager, messageProxy, imaLinker);
  });

  describe("tests for `deposit` function", async () => {

    it("should rejected with `Unconnected chain` when invoke `deposit`", async () => {
      // preparation
      const error = "Unconnected chain";
      const schainID = randomString(10);
      // execution/expectation
      await depositBoxEth
        .connect(deployer)
        .deposit(schainID, user.address)
        .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with `Unconnected chain` when invoke `deposit`", async () => {
      // preparation
      const error = "Unconnected chain";
      const schainID = "Mainnet";
      // execution/expectation
      await depositBoxEth
        .connect(deployer)
        .deposit(schainID, user.address)
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
        .connect(deployer)
        .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);
      // execution
      const tx = await depositBoxEth
        .connect(deployer)
        .deposit(schainID, deployer.address, {value: wei});
      // console.log("Gas for deposit:", tx.receipt.gasUsed);

      const lockAndDataBalance = await web3.eth.getBalance(depositBoxEth.address);
      // expectation
      expect(lockAndDataBalance).to.equal(wei);
    });

    it("should revert `Not allowed. in DepositBox`", async () => {
      // preparation
      const error = "Use deposit function";
      // execution/expectation
      await web3.eth.sendTransaction({from: deployer.address, to: depositBoxEth.address, value: "1000000000000000000"})
      .should.be.eventually.rejectedWith(error);
    });
  });

  describe("tests with `ERC20`", async () => {
    let ethERC20: EthERC20;

    beforeEach(async () => {
      ethERC20 = await deployEthERC20();
    });

    describe("tests for `depositERC20` function", async () => {

      it("should rejected with `Whitelist is enabled`", async () => {
        // preparation
        const error = "Whitelist is enabled";
        const schainID = randomString(10);
        // add schain to avoid the `Unconnected chain` error
        const chain = await imaLinker
          .connect(deployer)
          .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);

        await ethERC20.connect(deployer).mint(user.address, "1000000000");
        await ethERC20.connect(deployer).approve(depositBoxERC20.address, "1000000");
        // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
        // execution/expectation
        await depositBoxERC20
          .connect(deployer)
          .depositERC20(schainID, ethERC20.address, deployer.address, 100)
          .should.be.eventually.rejectedWith(error);
      });

      it("should rejected with `DepositBox was not approved for ERC20 token`", async () => {
        // preparation
        const error = "DepositBox was not approved for ERC20 token";
        const schainID = randomString(10);
        // add schain to avoid the `Unconnected chain` error
        const chain = await imaLinker
          .connect(deployer)
          .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);

        await ethERC20.connect(deployer).mint(user.address, "1000000000");
        await depositBoxERC20.disableWhitelist(schainID);
        // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
        // execution/expectation
        await depositBoxERC20
          .connect(deployer)
          .depositERC20(schainID, ethERC20.address, deployer.address, 100)
          .should.be.eventually.rejectedWith(error);
      });

      it("should invoke `depositERC20` without mistakes", async () => {
        // preparation
        const schainID = randomString(10);
        // add schain to avoid the `Unconnected chain` error
        const chain = await imaLinker
          .connect(deployer)
          .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);
        // mint some quantity of ERC20 tokens for `deployer` address
        await ethERC20.connect(deployer).mint(deployer.address, "1000000000");
        // approve some quantity of ERC20 tokens for `depositBoxEth` address
        await ethERC20.connect(deployer).approve(depositBoxERC20.address, "1000000");
        // execution
        await depositBoxERC20
          .connect(deployer)
          .depositERC20(schainID, ethERC20.address, deployer.address, 1).should.be.eventually.rejectedWith("Whitelist is enabled");
        await depositBoxERC20.disableWhitelist(schainID);
        await depositBoxERC20
          .connect(deployer)
          .depositERC20(schainID, ethERC20.address, deployer.address, 1);
        const res = await(await depositBoxERC20
          .connect(deployer)
          .depositERC20(schainID, ethERC20.address, deployer.address, 1)).wait();
        // console.log("Gas for depoositERC20:", res.receipt.gasUsed);
      });
    });
  });

  describe("tests with `ERC721`", async () => {
    let eRC721OnChain: ERC721OnChain;

    beforeEach(async () => {
      eRC721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721");

      // mint some ERC721 of  for `deployer` address
      const tokenId = 10;
      await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
      const tokenId2 = 11;
      await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId2);

    });

    describe("tests for `depositERC721` function", async () => {
      it("should rejected with `DepositBox was not approved for ERC721 token`", async () => {
        // preparation
        const error = "DepositBox was not approved for ERC721 token";
        const schainID = randomString(10);
        const contractHere = eRC721OnChain.address;
        const to = user.address;
        const tokenId = 10;
        // the wei should be MORE than (55000 * 1000000000)
        // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
        const wei = "20000000000000000";
        // add schain to avoid the `Unconnected chain` error
        await imaLinker
          .connect(deployer)
          .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);

        // execution/expectation
        await depositBoxERC721
          .connect(deployer)
          .depositERC721(schainID, contractHere, to, tokenId)
          .should.be.eventually.rejectedWith(error);
      });

      it("should invoke `depositERC721` without mistakes", async () => {
        // preparation
        const schainID = randomString(10);
        const contractHere = eRC721OnChain.address;
        const to = user.address;
        const tokenId = 10;
        const tokenId2 = 11;
        // the wei should be MORE than (55000 * 1000000000)
        // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
        // add schain to avoid the `Unconnected chain` error
        await imaLinker
          .connect(deployer)
          .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);
        // transfer tokenId from `deployer` to `depositBoxERC721`
        await eRC721OnChain.connect(deployer).approve(depositBoxERC721.address, tokenId);
        await eRC721OnChain.connect(deployer).approve(depositBoxERC721.address, tokenId2);
        // execution
        await depositBoxERC721
          .connect(deployer)
          .depositERC721(schainID, contractHere, to, tokenId).should.be.eventually.rejectedWith("Whitelist is enabled");
        await depositBoxERC721.disableWhitelist(schainID);
        await depositBoxERC721
          .connect(deployer)
          .depositERC721(schainID, contractHere, to, tokenId);
        const res = await (await depositBoxERC721
          .connect(deployer)
          .depositERC721(schainID, contractHere, to, tokenId2)).wait();
        // console.log("Gas for depoositERC721:", res.receipt.gasUsed);
        // expectation
        expect(await eRC721OnChain.ownerOf(tokenId)).to.equal(depositBoxERC721.address);
        expect(await eRC721OnChain.ownerOf(tokenId2)).to.equal(depositBoxERC721.address);
      });
    });
  });

  describe("tests for `postMessage` function", async () => {
    // let eRC20ModuleForMainnet: ERC20ModuleForMainnet;
    // let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20;
    let ethERC20: EthERC20;
    // let eRC721ModuleForMainnet: ERC721ModuleForMainnet;
    // let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721;
    let eRC721OnChain: ERC721OnChain;
    let messages: MessagesTester;

    beforeEach(async () => {
      // eRC20ModuleForMainnet = await deployERC20ModuleForMainnet(lockAndDataForMainnet);
      // lockAndDataForMainnetERC20 = await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
      ethERC20 = await deployEthERC20();
      // eRC721ModuleForMainnet = await deployERC721ModuleForMainnet(lockAndDataForMainnet);
      // lockAndDataForMainnetERC721 = await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
      eRC721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721");
      messages = await deployMessages();
    });

    it("should rejected with `Sender is not a MessageProxy`", async () => {
      //  preparation
      const error = "Sender is not a MessageProxy";
      const schainID = randomString(10);
      const amount = "10";
      const bytesData = await messages.encodeTransferEthMessage(user.address, amount);
      const sender = deployer.address;
      // execution/expectation
      await depositBoxEth
        .connect(user)
        .postMessage(stringValue(web3.utils.soliditySha3(schainID)), sender, bytesData)
        .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with message `Receiver chain is incorrect` when schain is not registered in DepositBox", async () => {
      //  preparation
      const error = "Receiver chain is incorrect";
      // for `Receiver chain is incorrect` message schainID should be `Mainnet`
      const schainID = "Bob";
      const amountEth = "10";
      const bytesData = await messages.encodeTransferEthMessage(user.address, amountEth);
      const senderFromSchain = deployer.address;

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        data: bytesData,
        destinationContract: depositBoxEth.address,
        sender: senderFromSchain
      };
      // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      await messageProxy.connect(deployer).addConnectedChain(schainID);
      await initializeSchain(contractManager, schainID, deployer.address, 1, 1);
      await setCommonPublicKey(contractManager, schainID);
      await rechargeSchainWallet(contractManager, schainID, deployer.address, "1000000000000000000");
      // execution

      const res = await(await messageProxy.connect(deployer).postIncomingMessages(schainID, 0, [message], sign, 0)).wait();
      // console.log(res.logs);
      if (res.events) {
        assert.equal(res.events[0].event, "PostMessageError");
        assert.equal(res.events[0].args?.msgCounter.toString(), "0");
        const messageError = res.events[0].args?.message.toString();
        assert.equal(Buffer.from(messageError.slice(2), 'hex').toString(), error);
      } else {
        assert(false, "No events were emitted");
      }
      // assert.equal(res.logs[0].args.message, "PostMessageError");
    });

    it("should rejected with message `Not enough money to finish this transaction` when "
        + "`sender != ILockAndDataDB(lockAndDataAddress).tokenManagerAddresses(schainHash)`", async () => {
      //  preparation
      const error = "Not enough money to finish this transaction";
      const schainID = randomString(10);
      const amountEth = "10";
      const bytesData = await messages.encodeTransferEthMessage(user.address, amountEth);
      const senderFromSchain = deployer.address;

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        data: bytesData,
        destinationContract: depositBoxEth.address,
        sender: senderFromSchain
      };
      // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      const chain = await imaLinker
        .connect(deployer)
        .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);
      await initializeSchain(contractManager, schainID, deployer.address, 1, 1);
      await setCommonPublicKey(contractManager, schainID);
      await rechargeSchainWallet(contractManager, schainID, deployer.address, "1000000000000000000");
      // execution
      const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainID, 0, [message], sign, 0)).wait();

      if (res.events) {
        assert.equal(res.events[0].event, "PostMessageError");
        assert.equal(res.events[0].args?.msgCounter.toString(), "0");
        const messageError = res.events[0].args?.message.toString();
        assert.equal(Buffer.from(messageError.slice(2), 'hex').toString(), error);
      } else {
        assert(false, "No events were emitted");
      }
    });

    it("should rejected with message `Not enough money to finish this transaction`", async () => {
      //  preparation
      const error = "Not enough money to finish this transaction";
      const schainID = randomString(10);
      const amountEth = "10";
      const bytesData = await messages.encodeTransferEthMessage(user.address, amountEth);
      const senderFromSchain = deployer.address;

      await initializeSchain(contractManager, schainID, deployer.address, 1, 1);
      await setCommonPublicKey(contractManager, schainID);
      await rechargeSchainWallet(contractManager, schainID, deployer.address, "1000000000000000000");

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        data: bytesData,
        destinationContract: depositBoxEth.address,
        sender: senderFromSchain
      };
      // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      // add schain to avoid the `Receiver chain is incorrect` error
      const chain = await imaLinker
        .connect(deployer)
        .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);
      // execution
      const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainID, 0, [message], sign, 0)).wait();

      if (res.events) {
        assert.equal(res.events[0].event, "PostMessageError");
        assert.equal(res.events[0].args?.msgCounter.toString(), "0");
        const messageError = res.events[0].args?.message.toString();
        assert.equal(Buffer.from(messageError.slice(2), 'hex').toString(), error);
      } else {
        assert(false, "No events were emitted");
      }
    });

    it("should rejected with message `null`", async () => {
      //  preparation
      const schainID = randomString(10);
      const amountEth = "10";
      // for `Invalid data` message bytesData should be `0x`
      const bytesData = "0x";
      const senderFromSchain = deployer.address;
      const wei = "100000";

      await initializeSchain(contractManager, schainID, deployer.address, 1, 1);
      await setCommonPublicKey(contractManager, schainID);
      await rechargeSchainWallet(contractManager, schainID, deployer.address, "1000000000000000000");

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        data: bytesData,
        destinationContract: depositBoxEth.address,
        sender: senderFromSchain,
      };
      // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      // add schain to avoid the `Receiver chain is incorrect` error
      const chain = await imaLinker
        .connect(deployer)
        .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);
      // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
      await depositBoxEth
        .connect(deployer)
        .deposit(schainID, user.address, {value: wei});
      // execution
      const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainID, 0, [message], sign, 0)).wait();

      if (res.events) {
        assert.equal(res.events[0].event, "PostMessageError");
        assert.equal(res.events[0].args?.msgCounter.toString(), "0");
        assert.equal(res.events[0].args?.message, "0x");
      } else {
        assert(false, "No events were emitted");
      }
    });

    it("should transfer eth", async () => {
      //  preparation
      const schainID = randomString(10);
      // for transfer eth bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
      const senderFromSchain = deployer.address;
      const wei = "30000000000000000";
      const bytesData = await messages.encodeTransferEthMessage(user.address, wei);

      await setCommonPublicKey(contractManager, schainID);

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        data: bytesData,
        destinationContract: depositBoxEth.address,
        sender: senderFromSchain,
      };
      // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
      // add schain to avoid the `Receiver chain is incorrect` error

      await initializeSchain(contractManager, schainID, deployer.address, 1, 1);
      await rechargeSchainWallet(contractManager, schainID, deployer.address, "1000000000000000000");
      const chain = await imaLinker
        .connect(deployer)
        .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);
      // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
      await depositBoxEth
        .connect(deployer)
        .deposit(schainID, user.address, {value: wei});
      // execution
      const res = await messageProxy.connect(deployer).postIncomingMessages(schainID, 0, [message], sign, 0);
      // console.log("Gas for postMessage Eth:", res.receipt.gasUsed);
      // expectation
      await depositBoxEth.approveTransfers(user.address);
    });

    it("should transfer ERC20 token", async () => {
      //  preparation
      const contractHere = ethERC20.address;
      const schainID = randomString(10);
      const amount = 10;
      const to = user.address;
      const to0 = "0x0000000000000000000000000000000000000000"; // ERC20 address
      const senderFromSchain = deployer.address;
      const wei = "30000000000000000";

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        data: await messages.encodeTransferErc20Message(contractHere, to, amount),
        destinationContract: depositBoxERC20.address,
        sender: senderFromSchain
      };

      await initializeSchain(contractManager, schainID, deployer.address, 1, 1);
      await setCommonPublicKey(contractManager, schainID);
      await rechargeSchainWallet(contractManager, schainID, deployer.address, "1000000000000000000");
      // add schain to avoid the `Unconnected chain` error
      await imaLinker
        .connect(deployer)
        .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);
      // mint some quantity of ERC20 tokens for `deployer` address
      await ethERC20.connect(deployer).mint(deployer.address, "1000000000");
      /**
       * transfer more than `amount` quantity of ERC20 tokens
       * for `depositBoxERC20` to avoid `Not enough money`
       */
      await ethERC20.connect(deployer).transfer(depositBoxERC20.address, "1000000");
      // get data from `receiveERC20`
      await depositBoxERC20.disableWhitelist(schainID);
      // execution
      // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      const res = await messageProxy.connect(deployer).postIncomingMessages(schainID, 0, [message], sign, 0);
      // console.log("Gas for postMessage ERC20:", res.receipt.gasUsed);
      // expectation
      (await ethERC20.balanceOf(user.address)).toString().should.be.equal(amount.toString());
    });

    it("should transfer ERC721 token", async () => {
      //  preparation
      const contractHere = eRC721OnChain.address;
      const schainID = randomString(10);
      const tokenId = 10;
      const to = user.address;
      const to0 = "0x0000000000000000000000000000000000000000"; // ERC721 address
      const senderFromSchain = deployer.address;
      const wei = "30000000000000000";

      const sign = {
        blsSignature: BlsSignature,
        counter: Counter,
        hashA: HashA,
        hashB: HashB,
      };

      const message = {
        data: await messages.encodeTransferErc721Message(contractHere, to, tokenId),
        destinationContract: depositBoxERC721.address,
        sender: senderFromSchain
      };

      await initializeSchain(contractManager, schainID, user2.address, 1, 1);
      await setCommonPublicKey(contractManager, schainID);
      await rechargeSchainWallet(contractManager, schainID, user2.address, "1000000000000000000");
      // add schain to avoid the `Unconnected chain` error
      await imaLinker
        .connect(deployer)
        .connectSchain(schainID, [deployer.address, deployer.address, deployer.address]);
      // mint some ERC721 of  for `deployer` address
      await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
      // transfer tokenId from `deployer` to `depositBoxERC721`
      await eRC721OnChain.connect(deployer).transferFrom(deployer.address, depositBoxERC721.address, tokenId);
      // get data from `receiveERC721`
      await depositBoxERC721.disableWhitelist(schainID);
      // execution
      // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
      // to avoid `Incorrect sender` error
      const res = await messageProxy.connect(deployer).postIncomingMessages(schainID, 0, [message], sign, 0);
      // console.log("Gas for postMessage ERC721:", res.receipt.gasUsed);
      // expectation
      (await eRC721OnChain.ownerOf(tokenId)).should.be.equal(user.address);
    });

  });

});
