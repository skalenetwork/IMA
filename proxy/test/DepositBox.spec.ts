import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import { DepositBoxContract,
  DepositBoxInstance,
  ERC20ModuleForMainnetContract,
  ERC20ModuleForMainnetInstance,
  ERC721ModuleForMainnetContract,
  ERC721ModuleForMainnetInstance,
  ERC721OnChainContract,
  ERC721OnChainInstance,
  EthERC20Contract,
  EthERC20Instance,
  LockAndDataForMainnetContract,
  LockAndDataForMainnetERC20Contract,
  LockAndDataForMainnetERC20Instance,
  LockAndDataForMainnetERC721Contract,
  LockAndDataForMainnetERC721Instance,
  LockAndDataForMainnetInstance,
  MessageProxyContract,
  MessageProxyInstance,
  } from "../types/truffle-contracts";
import { randomString } from "./utils/helper";
import { createBytes32 } from "./utils/helper";
import { skipTime } from "./utils/time";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");
const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnet");
const DepositBox: DepositBoxContract = artifacts.require("./DepositBox");
const ERC20ModuleForMainnet: ERC20ModuleForMainnetContract = artifacts.require("./ERC20ModuleForMainnet");
const ERC721ModuleForMainnet: ERC721ModuleForMainnetContract = artifacts.require("./ERC721ModuleForMainnet");
const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");
const LockAndDataForMainnetERC20: LockAndDataForMainnetERC20Contract = artifacts
  .require("./LockAndDataForMainnetERC20");
const LockAndDataForMainnetERC721: LockAndDataForMainnetERC721Contract = artifacts
  .require("./LockAndDataForMainnetERC721");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");

const contractManager = "0x0000000000000000000000000000000000000000";

contract("DepositBox", ([deployer, user, invoker]) => {
  let messageProxy: MessageProxyInstance;
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let depositBox: DepositBoxInstance;

  beforeEach(async () => {
    messageProxy = await MessageProxy.new("Mainnet", contractManager, {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForMainnet = await LockAndDataForMainnet.new({from: deployer, gas: 8000000 * gasMultiplier});
    depositBox = await DepositBox.new(messageProxy.address, lockAndDataForMainnet.address,
      {from: deployer, gas: 8000000 * gasMultiplier});
  });

  // for messageProxy.addConnectedChain function
  const publicKeyArray = [
    "1122334455667788990011223344556677889900112233445566778899001122",
    "1122334455667788990011223344556677889900112233445566778899001122",
    "1122334455667788990011223344556677889900112233445566778899001122",
    "1122334455667788990011223344556677889900112233445566778899001122",
  ];

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

    it("should rejected with `Not enough money` when invoke `deposit`", async () => {
      // preparation
      const schainID = randomString(10);
      const error = "Gas was not paid";
      // the wei for this error should be LESS than (55000 * 1000000000)
      // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
      const wei = "10000";
      // add schain
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // execution/expectation
      await depositBox
        .depositWithoutData(schainID, user, {value: wei, from: deployer})
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
      // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
      await messageProxy
        .addConnectedChain(schainID, publicKeyArray, {from: deployer});
      // set contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
      await lockAndDataForMainnet
        .setContract("DepositBox", depositBox.address, {from: deployer});
      // execution
      const tx = await depositBox
        .depositWithoutData(schainID, deployer, {value: wei, from: deployer});

      console.log(tx);
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
      eRC20ModuleForMainnet = await ERC20ModuleForMainnet.new(lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      lockAndDataForMainnetERC20 = await LockAndDataForMainnetERC20.new(lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      ethERC20 = await EthERC20.new({from: deployer, gas: 8000000 * gasMultiplier});
    });

    describe("tests for `depositERC20` function", async () => {
      it("should rejected with `Not allowed ERC20 Token`", async () => {
        // preparation
        const error = "Not allowed ERC20 Token";
        const schainID = randomString(10);
        // add schain to avoid the `Unconnected chain` error
        const chain = await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});
        // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
        await messageProxy
          .addConnectedChain(schainID, publicKeyArray, {from: deployer});
        // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
        await lockAndDataForMainnet
          .setContract("DepositBox", depositBox.address, {from: deployer});
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
        // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
        await messageProxy
          .addConnectedChain(schainID, publicKeyArray, {from: deployer});
        // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
        await lockAndDataForMainnet
          .setContract("DepositBox", depositBox.address, {from: deployer});
        // set `ERC20Module` contract before invoke `depositERC20`
        await lockAndDataForMainnet
          .setContract("ERC20Module", eRC20ModuleForMainnet.address, {from: deployer});
        // set `LockAndDataERC20` contract before invoke `depositERC20`
        await lockAndDataForMainnet
          .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
        // mint some quantity of ERC20 tokens for `deployer` address
        await ethERC20.mint(deployer, "1000000000", {from: deployer});
        // approve some quantity of ERC20 tokens for `depositBox` address
        await ethERC20.approve(depositBox.address, "1000000", {from: deployer});
        // execution
        await depositBox
          .depositERC20(schainID, ethERC20.address, deployer, 1, {from: deployer});
      });

      it("should invoke `depositERC20` with some ETH without mistakes", async () => {
        // preparation
        const schainID = randomString(10);
        // add schain to avoid the `Unconnected chain` error
        const chain = await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});
        // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
        await messageProxy
          .addConnectedChain(schainID, publicKeyArray, {from: deployer});
        // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
        await lockAndDataForMainnet
          .setContract("DepositBox", depositBox.address, {from: deployer});
        // set `ERC20Module` contract before invoke `depositERC20`
        await lockAndDataForMainnet
          .setContract("ERC20Module", eRC20ModuleForMainnet.address, {from: deployer});
        // set `LockAndDataERC20` contract before invoke `depositERC20`
        await lockAndDataForMainnet
          .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
        // mint some quantity of ERC20 tokens for `deployer` address
        await ethERC20.mint(deployer, "1000000000", {from: deployer});
        // approve some quantity of ERC20 tokens for `depositBox` address
        await ethERC20.approve(depositBox.address, "1000000", {from: deployer});
        // execution
        await depositBox
          .depositERC20(schainID, ethERC20.address, deployer, 1, {value: "1000000000000", from: deployer});
      });
    });

    describe("tests for `rawDepositERC20` function", async () => {
      it("should rejected with `Not allowed ERC20 Token` when invoke `rawDepositERC20`", async () => {
        // preparation
        const error = "Not allowed ERC20 Token";
        const schainID = randomString(10);
        // add schain to avoid the `Unconnected chain` error
        const chain = await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});
        // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
        await messageProxy
          .addConnectedChain(schainID, publicKeyArray, {from: deployer});
        // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
        await lockAndDataForMainnet
          .setContract("DepositBox", depositBox.address, {from: deployer});
        // execution/expectation
        await depositBox
          .rawDepositERC20(schainID, ethERC20.address, user, deployer, 100, {from: deployer})
          .should.be.eventually.rejectedWith(error);
      });

      it("should invoke `rawDepositERC20` without mistakes", async () => {
        // preparation
        const schainID = randomString(10);
        // add schain to avoid the `Unconnected chain` error
        const chain = await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});
        // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
        await messageProxy
          .addConnectedChain(schainID, publicKeyArray, {from: deployer});
        // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
        await lockAndDataForMainnet
          .setContract("DepositBox", depositBox.address, {from: deployer});
        // set `ERC20Module` contract before invoke `rawDepositERC20`
        await lockAndDataForMainnet
          .setContract("ERC20Module", eRC20ModuleForMainnet.address, {from: deployer});
        // set `LockAndDataERC20` contract before invoke `rawDepositERC20`
        await lockAndDataForMainnet
          .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
        // mint some quantity of ERC20 tokens for `deployer` address
        await ethERC20.mint(deployer, "1000000000", {from: deployer});
        // approve some quantity of ERC20 tokens for `depositBox` address
        await ethERC20.approve(depositBox.address, "1000000", {from: deployer});
        // execution
        await depositBox
          .rawDepositERC20(schainID, ethERC20.address, user, deployer, 1, {from: deployer});
      });

      it("should invoke `rawDepositERC20` with some ETH without mistakes", async () => {
        // preparation
        const schainID = randomString(10);
        // add schain to avoid the `Unconnected chain` error
        const chain = await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});
        // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
        await messageProxy
          .addConnectedChain(schainID, publicKeyArray, {from: deployer});
        // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
        await lockAndDataForMainnet
          .setContract("DepositBox", depositBox.address, {from: deployer});
        // set `ERC20Module` contract before invoke `rawDepositERC20`
        await lockAndDataForMainnet
          .setContract("ERC20Module", eRC20ModuleForMainnet.address, {from: deployer});
        // set `LockAndDataERC20` contract before invoke `rawDepositERC20`
        await lockAndDataForMainnet
          .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
        // mint some quantity of ERC20 tokens for `deployer` address
        await ethERC20.mint(deployer, "1000000000", {from: deployer});
        // approve some quantity of ERC20 tokens for `depositBox` address
        await ethERC20.approve(depositBox.address, "1000000", {from: deployer});
        // execution
        await depositBox
          .rawDepositERC20(schainID, ethERC20.address, user, deployer, 1, {value: "1000000000000", from: deployer});
      });
    });
  });

  describe("tests with `ERC721`", async () => {
    let eRC721ModuleForMainnet: ERC721ModuleForMainnetInstance;
    let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721Instance;
    let eRC721OnChain: ERC721OnChainInstance;

    beforeEach(async () => {
      eRC721ModuleForMainnet = await ERC721ModuleForMainnet.new(lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      lockAndDataForMainnetERC721 = await LockAndDataForMainnetERC721.new(lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");

      // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
      await lockAndDataForMainnet
        .setContract("DepositBox", depositBox.address, {from: deployer});
      // set `ERC721Module` contract before invoke `depositERC721`
      await lockAndDataForMainnet
        .setContract("ERC721Module", eRC721ModuleForMainnet.address, {from: deployer});
      // set `LockAndDataERC721` contract before invoke `depositERC721`
      await lockAndDataForMainnet
        .setContract("LockAndDataERC721", lockAndDataForMainnetERC721.address, {from: deployer});
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
        // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
        await messageProxy
          .addConnectedChain(schainID, publicKeyArray, {from: deployer});

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
        // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
        await messageProxy
          .addConnectedChain(schainID, publicKeyArray, {from: deployer});
        // transfer tokenId from `deployer` to `depositBox`
        await eRC721OnChain.transferFrom(deployer,
          depositBox.address, tokenId, {from: deployer});
        // execution
        await depositBox
          .depositERC721(schainID, contractHere, to, tokenId, {value: wei, from: deployer});
        const lockAndDataBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
        // expectation
        expect(lockAndDataBalance).to.equal(wei);
      });
    });

    describe("tests for `rawDepositERC721` function", async () => {
      it("should rejected with `Not allowed ERC721 Token`", async () => {
        // preparation
        const error = "Not allowed ERC721 Token";
        const schainID = randomString(10);
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721OnChain.address; // should be address of ERC721. In our case this no matter
        const to = user;
        const tokenId = 10;
        // the wei should be MORE than (55000 * 1000000000)
        // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
        const wei = "20000000000000000";
        // add schain to avoid the `Unconnected chain` error
        await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});
        // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
        await messageProxy
          .addConnectedChain(schainID, publicKeyArray, {from: deployer});
        // execution/expectation
        await depositBox
          .rawDepositERC721(schainID, contractHere, contractThere, to, tokenId, {value: wei, from: deployer})
          .should.be.eventually.rejectedWith(error);
      });

      it("should invoke `rawDepositERC721` without mistakes", async () => {
        // preparation
        const schainID = randomString(10);
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721OnChain.address; // should be address of ERC721. In our case this no matter
        const to = user;
        const tokenId = 10;
        // the wei should be MORE than (55000 * 1000000000)
        // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
        const wei = "20000000000000000";
        // add schain to avoid the `Unconnected chain` error
        await lockAndDataForMainnet
          .addSchain(schainID, deployer, {from: deployer});
        // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
        await messageProxy
          .addConnectedChain(schainID, publicKeyArray, {from: deployer});
        // transfer tokenId from `deployer` to `depositBox`
        await eRC721OnChain.transferFrom(deployer,
          depositBox.address, tokenId, {from: deployer});
        // execution
        await depositBox
          .rawDepositERC721(schainID, contractHere, contractThere, to, tokenId, {value: wei, from: deployer});
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
      eRC20ModuleForMainnet = await ERC20ModuleForMainnet.new(lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      lockAndDataForMainnetERC20 = await LockAndDataForMainnetERC20.new(lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      ethERC20 = await EthERC20.new({from: deployer, gas: 8000000 * gasMultiplier});
      eRC721ModuleForMainnet = await ERC721ModuleForMainnet.new(lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      lockAndDataForMainnetERC721 = await LockAndDataForMainnetERC721.new(lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");
    });

    it("should rejected with `Incorrect sender`", async () => {
      //  preparation
      const error = "Incorrect sender";
      const schainID = randomString(10);
      const amount = 10;
      const bytesData = "0x0";
      const sender = deployer;
      // execution/expectation
      await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer})
        .should.be.eventually.rejectedWith(error);
    });

    it("should be Error event with message `Receiver chain is incorrect` when schainID=`mainnet`", async () => {
      //  preparation
      const error = "Receiver chain is incorrect";
      // for `Receiver chain is incorrect` message schainID should be `Mainnet`
      const schainID = "Mainnet";
      const amount = 10;
      const bytesData = "0x0";
      const sender = deployer;
      // redeploy depositBox with `developer` address instead `messageProxy.address` to avoid `Incorrect sender` error
      depositBox = await DepositBox.new(deployer, lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      // execution
      const {logs} = await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer});
      // expectation
      expect(logs[0].args.message).to.be.equal(error);
    });

    it("should be Error event with message `Receiver chain is incorrect` when "
        + "`sender != ILockAndDataDB(lockAndDataAddress).tokenManagerAddresses(schainHash)`", async () => {
      //  preparation
      const error = "Receiver chain is incorrect";
      const schainID = randomString(10);
      const amount = 10;
      const bytesData = "0x0";
      const sender = deployer;
      // redeploy depositBox with `developer` address instead `messageProxy.address` to avoid `Incorrect sender` error
      depositBox = await DepositBox.new(deployer, lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      // execution
      const {logs} = await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer});
      // expectation
      expect(logs[0].args.message).to.be.equal(error);
    });

    it("should be Error event with message `Not enough money to finish this transaction`", async () => {
      //  preparation
      const error = "Not enough money to finish this transaction";
      const schainID = randomString(10);
      const amount = 10;
      const bytesData = "0x0";
      const sender = deployer;
      // redeploy depositBox with `developer` address instead `messageProxy.address` to avoid `Incorrect sender` error
      depositBox = await DepositBox.new(deployer, lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      // add schain to avoid the `Receiver chain is incorrect` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // execution
      const {logs} = await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer});
      // expectation
      expect(logs[0].args.message).to.be.equal(error);
    });

    it("should be Error event with message `Invalid data`", async () => {
      //  preparation
      const error = "Invalid data";
      const schainID = randomString(10);
      const amount = 10;
      // for `Invalid data` message bytesData should be `0x`
      const bytesData = "0x";
      const sender = deployer;
      const wei = "100000";
      // redeploy depositBox with `developer` address instead `messageProxy.address` to avoid `Incorrect sender` error
      depositBox = await DepositBox.new(deployer, lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
      await lockAndDataForMainnet
        .setContract("DepositBox", depositBox.address, {from: deployer});
      // add schain to avoid the `Receiver chain is incorrect` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // add wei to contract throught `receiveEth` because `receiveEth` have `payable` parameter
      await lockAndDataForMainnet
        .receiveEth(deployer, {value: wei, from: deployer});
      // execution
      const {logs} = await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer});
      // expectation
      expect(logs[0].args.message).to.be.equal(error);
    });

    it("should be Error event with message `Could not send money to owner`", async () => {
      //  preparation
      const error = "Could not send money to owner";
      const schainID = randomString(10);
      const amount = "30000000000000000";
      // for transfer eth bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
      const bytesData = "0x01";
      const sender = deployer;
      // add less then `GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE` to `lockAndDataForMainnet` for invoke error
      const wei = "200000000000000";
      // redeploy depositBox with `developer` address instead `messageProxy.address` to avoid `Incorrect sender` error
      depositBox = await DepositBox.new(deployer, lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
      await lockAndDataForMainnet
        .setContract("DepositBox", depositBox.address, {from: deployer});
      // add schain to avoid the `Receiver chain is incorrect` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // add wei to contract throught `receiveEth` because `receiveEth` have `payable` parameter
      await lockAndDataForMainnet
        .receiveEth(deployer, {value: wei, from: deployer});
      // execution
      const {logs} = await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer});
      // expectation
      expect(logs[0].args.message).to.be.equal(error);
    });

    it("should transfer eth", async () => {
      //  preparation
      const schainID = randomString(10);
      const amount = "30000000000000000";
      // for transfer eth bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
      const bytesData = "0x01";
      const sender = deployer;
      const wei = "20000000000000000";
      // redeploy depositBox with `developer` address instead `messageProxy.address` to avoid `Incorrect sender` error
      depositBox = await DepositBox.new(deployer, lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
      await lockAndDataForMainnet
        .setContract("DepositBox", depositBox.address, {from: deployer});
      // add schain to avoid the `Receiver chain is incorrect` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // add wei to contract throught `receiveEth` because `receiveEth` have `payable` parameter
      await lockAndDataForMainnet
        .receiveEth(deployer, {value: wei, from: deployer});
      // execution
      await depositBox
        .postMessage(sender, schainID, user, amount, bytesData, {from: deployer});
      // get constatnts
      const gasAmountPostMessage = parseInt((new BigNumber(await depositBox.GAS_AMOUNT_POST_MESSAGE())).toString(), 10);
      const averageTxPrise = parseInt((new BigNumber(await depositBox.AVERAGE_TX_PRICE())).toString(), 10);
      // expectation
      const bn = new BigNumber(await lockAndDataForMainnet.approveTransfers(user));
      parseInt(bn.toString(), 10).should.be.
        equal(parseInt(amount.toString(), 10) - gasAmountPostMessage * averageTxPrise);
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
      const wei = "20000000000000000";
      const isRaw = false;
      // add schain to avoid the `Unconnected chain` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
      await messageProxy
        .addConnectedChain(schainID, publicKeyArray, {from: deployer});
      // set `ERC20Module` contract before invoke `postMessage`
      await lockAndDataForMainnet
        .setContract("ERC20Module", eRC20ModuleForMainnet.address, {from: deployer});
      // set `LockAndDataERC20` contract before invoke `postMessage`
      await lockAndDataForMainnet
        .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
      // mint some quantity of ERC20 tokens for `deployer` address
      await ethERC20.mint(deployer, "1000000000", {from: deployer});
      /**
       * transfer more than `amount` qantity of ERC20 tokens
       * for `lockAndDataForMainnetERC20` to avoid `Not enough money`
       */
      await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
      // approve some quantity of ERC20 tokens for `depositBox` address
      await ethERC20.approve(depositBox.address, "1000000", {from: deployer});
      // get data from `receiveERC20`
      const data = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
      await eRC20ModuleForMainnet.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
      // execution
      // add wei to contract throught `receiveEth` because `receiveEth` have `payable` parameter
      await lockAndDataForMainnet
        .receiveEth(deployer, {value: wei, from: deployer});
      // redeploy depositBox with `developer` address instead `messageProxy.address` to avoid `Incorrect sender` error
      depositBox = await DepositBox.new(deployer, lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      // set `DepositBox` contract before invoke `postMessage`
      await lockAndDataForMainnet
        .setContract("DepositBox", depositBox.address, {from: deployer});
      await depositBox
        .postMessage(sender, schainID, to0, amount0, data, {from: deployer});
      // get constatnts
      const gasAmountPostMessage = parseInt((new BigNumber(await depositBox.GAS_AMOUNT_POST_MESSAGE())).toString(), 10);
      const averageTxPrise = parseInt((new BigNumber(await depositBox.AVERAGE_TX_PRICE())).toString(), 10);
      // expectation
      const bn = new BigNumber(await lockAndDataForMainnet.approveTransfers(user));
      parseInt(bn.toString(), 10).should.be.
        equal(parseInt(amount0.toString(), 10) - gasAmountPostMessage * averageTxPrise);
    });

    it("should transfer ERC20 for RAW mode token", async () => {
      //  preparation
      const contractHere = ethERC20.address;
      const schainID = randomString(10);
      const amount = 10;
      const amount0 = "30000000000000000";
      const to = user;
      const to0 = ethERC20.address; // ERC20 address
      const sender = deployer;
      const wei = "20000000000000000";
      const isRaw = true;
      // add schain to avoid the `Unconnected chain` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
      await messageProxy
        .addConnectedChain(schainID, publicKeyArray, {from: deployer});
      // set `ERC20Module` contract before invoke `postMessage`
      await lockAndDataForMainnet
        .setContract("ERC20Module", eRC20ModuleForMainnet.address, {from: deployer});
      // set `LockAndDataERC20` contract before invoke `postMessage`
      await lockAndDataForMainnet
        .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
      // mint some quantity of ERC20 tokens for `deployer` address
      await ethERC20.mint(deployer, "1000000000", {from: deployer});
      /**
       * transfer more than `amount` qantity of ERC20 tokens
       * for `lockAndDataForMainnetERC20` to avoid `Not enough money`
       */
      await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
      // approve some quantity of ERC20 tokens for `depositBox` address
      await ethERC20.approve(depositBox.address, "1000000", {from: deployer});
      // get data from `receiveERC20`
      const data = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
      await eRC20ModuleForMainnet.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
      // execution
      // add wei to contract throught `receiveEth` because `receiveEth` have `payable` parameter
      await lockAndDataForMainnet
        .receiveEth(deployer, {value: wei, from: deployer});
      // redeploy depositBox with `developer` address instead `messageProxy.address` to avoid `Incorrect sender` error
      depositBox = await DepositBox.new(deployer, lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      // set `DepositBox` contract before invoke `postMessage`
      await lockAndDataForMainnet
        .setContract("DepositBox", depositBox.address, {from: deployer});
      await depositBox
        .postMessage(sender, schainID, to0, amount0, data, {from: deployer});
      // get constatnts
      const gasAmountPostMessage = parseInt((new BigNumber(await depositBox.GAS_AMOUNT_POST_MESSAGE())).toString(), 10);
      const averageTxPrise = parseInt((new BigNumber(await depositBox.AVERAGE_TX_PRICE())).toString(), 10);
      // expectation
      const bn = new BigNumber(await lockAndDataForMainnet.approveTransfers(user));
      parseInt(bn.toString(), 10).should.be.
        equal(parseInt(amount0.toString(), 10) - gasAmountPostMessage * averageTxPrise);
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
      const wei = "20000000000000000";
      const isRaw = false;
      // add schain to avoid the `Unconnected chain` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
      await messageProxy
        .addConnectedChain(schainID, publicKeyArray, {from: deployer});
      // set `ERC721Module` contract before invoke `receiveERC721`
      await lockAndDataForMainnet
          .setContract("ERC721Module", eRC721ModuleForMainnet.address, {from: deployer});
      // set `LockAndDataERC721` contract before invoke `receiveERC721`
      await lockAndDataForMainnet
          .setContract("LockAndDataERC721", lockAndDataForMainnetERC721.address, {from: deployer});
      // mint some ERC721 of  for `deployer` address
      await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
      // transfer tokenId from `deployer` to `lockAndDataForMainnetERC721`
      await eRC721OnChain.transferFrom(deployer,
        lockAndDataForMainnetERC721.address, tokenId, {from: deployer});
      // get data from `receiveERC721`
      const data = await eRC721ModuleForMainnet.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
      eRC721ModuleForMainnet.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
      // execution
      // add wei to contract throught `receiveEth` because `receiveEth` have `payable` parameter
      await lockAndDataForMainnet
        .receiveEth(deployer, {value: wei, from: deployer});
      // redeploy depositBox with `developer` address instead `messageProxy.address` to avoid `Incorrect sender` error
      depositBox = await DepositBox.new(deployer, lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      // set `DepositBox` contract before invoke `postMessage`
      await lockAndDataForMainnet
        .setContract("DepositBox", depositBox.address, {from: deployer});
      await depositBox
        .postMessage(sender, schainID, to0, amount0, data, {from: deployer});
      // get constatnts
      const gasAmountPostMessage = parseInt((new BigNumber(await depositBox.GAS_AMOUNT_POST_MESSAGE())).toString(), 10);
      const averageTxPrise = parseInt((new BigNumber(await depositBox.AVERAGE_TX_PRICE())).toString(), 10);
      // expectation
      const bn = new BigNumber(await lockAndDataForMainnet.approveTransfers(user));
      parseInt(bn.toString(), 10).should.be.
        equal(parseInt(amount0.toString(), 10) - gasAmountPostMessage * averageTxPrise);
    });

    it("should transfer RawERC721 token", async () => {
      //  preparation
      const contractHere = eRC721OnChain.address;
      const schainID = randomString(10);
      const tokenId = 10;
      const amount0 = "30000000000000000";
      const to = user;
      const to0 = eRC721OnChain.address; // ERC721 address
      const sender = deployer;
      const wei = "20000000000000000";
      const isRaw = true;
      // add schain to avoid the `Unconnected chain` error
      await lockAndDataForMainnet
        .addSchain(schainID, deployer, {from: deployer});
      // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
      await messageProxy
        .addConnectedChain(schainID, publicKeyArray, {from: deployer});
      // set `ERC721Module` contract before invoke `receiveERC721`
      await lockAndDataForMainnet
          .setContract("ERC721Module", eRC721ModuleForMainnet.address, {from: deployer});
      // set `LockAndDataERC721` contract before invoke `receiveERC721`
      await lockAndDataForMainnet
          .setContract("LockAndDataERC721", lockAndDataForMainnetERC721.address, {from: deployer});
      // mint some ERC721 of  for `deployer` address
      await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
      // transfer tokenId from `deployer` to `lockAndDataForMainnetERC721`
      await eRC721OnChain.transferFrom(deployer,
        lockAndDataForMainnetERC721.address, tokenId, {from: deployer});
      // get data from `receiveERC721`
      const data = await eRC721ModuleForMainnet.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
      await eRC721ModuleForMainnet.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
      // execution
      // add wei to contract throught `receiveEth` because `receiveEth` have `payable` parameter
      await lockAndDataForMainnet
        .receiveEth(deployer, {value: wei, from: deployer});
      // redeploy depositBox with `developer` address instead `messageProxy.address` to avoid `Incorrect sender` error
      depositBox = await DepositBox.new(deployer, lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
      // set `DepositBox` contract before invoke `postMessage`
      await lockAndDataForMainnet
        .setContract("DepositBox", depositBox.address, {from: deployer});
      await depositBox
        .postMessage(sender, schainID, to0, amount0, data, {from: deployer});
      // get constatnts
      const gasAmountPostMessage = parseInt((new BigNumber(await depositBox.GAS_AMOUNT_POST_MESSAGE())).toString(), 10);
      const averageTxPrise = parseInt((new BigNumber(await depositBox.AVERAGE_TX_PRICE())).toString(), 10);
      // expectation
      const bn = new BigNumber(await lockAndDataForMainnet.approveTransfers(user));
      parseInt(bn.toString(), 10).should.be.
        equal(parseInt(amount0.toString(), 10) - gasAmountPostMessage * averageTxPrise);
    });

  });

});
