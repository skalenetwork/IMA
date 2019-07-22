import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import { DepositBoxContract,
  DepositBoxInstance,
  LockAndDataForMainnetContract,
  LockAndDataForMainnetInstance,
  MessageProxyContract,
  MessageProxyInstance,
  } from "../types/truffle-contracts";
import { skipTime } from "./utils/time";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");
const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnet");
const DepositBox: DepositBoxContract = artifacts.require("./DepositBox");

contract("DepositBox", ([deployer, user]) => {
  let messageProxy: MessageProxyInstance;
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let depositBox: DepositBoxInstance;

  before(async () => {
    messageProxy = await MessageProxy.new("Mainnet", {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForMainnet = await LockAndDataForMainnet.new({from: deployer, gas: 8000000 * gasMultiplier});
    depositBox = await DepositBox.new(messageProxy.address, lockAndDataForMainnet.address,
       {from: deployer, gas: 8000000 * gasMultiplier});
  });

  it("should rejected with `Unconnected chain` when invoke `deposit`", async () => {
    // preparation
    const error = "Unconnected chain";
    const schainID = "someName";
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

  it("should rejected with `Not enough money` when invoke `deposit`", async () => {
    // preparation
    const schainID = "someName";
    const error = "Not enough money";
    // the wei for this error should be LESS than (55000 * 1000000000)
    // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
    const wei = "10000";
    // add schain
    await lockAndDataForMainnet
      .addSchain(schainID, deployer, {from: deployer});
    // execution/expectation
    await depositBox
      .deposit(schainID, user, {value: wei, from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should invoke `deposit` without mistakes", async () => {
    // preparation
    const schainID = "someAnotherName";
    // the wei should be MORE than (55000 * 1000000000)
    // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
    const wei = "900000000000000";
    const publicKeyArray = [
      "1122334455667788990011223344556677889900112233445566778899001122",
      "1122334455667788990011223344556677889900112233445566778899001122",
      "1122334455667788990011223344556677889900112233445566778899001122",
      "1122334455667788990011223344556677889900112233445566778899001122",
    ];
    // add schain
    const chain = await lockAndDataForMainnet
      .addSchain(schainID, deployer, {from: deployer});
    // add connected chain
    await messageProxy
      .addConnectedChain(schainID, publicKeyArray, {from: deployer});
    // set contract before invoke `deposit`
    await lockAndDataForMainnet
      .setContract("DepositBox", depositBox.address, {from: deployer});
    // execution
    console.log("before `deposit` invoke");
    await depositBox
      .deposit(schainID, deployer, {value: wei, from: deployer});
    const lockAndDataBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
    // expectation
    expect(lockAndDataBalance).to.equal(wei);
  });

  // it("should rejected with `Incorrect sender` when invoke `postMessage`", async () => {
  //   const error = "Incorrect sender";
  //   await depositBox
  //     .postMessage(deployer, "vasya", user, 10, "0x0",
  //     {from: deployer}).should.be.eventually.rejectedWith(error);
  // });

});
