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

  // it("should rejected with `Incorrect sender` when invoke postMessage", async () => {
  //   const error = "Incorrect sender";
  //   await depositBox
  //     .postMessage(deployer, "vasya", user, 10, "0x0",
  //     {from: deployer}).should.be.eventually.rejectedWith(error);
  // });

  // it("should ...", async () => {
  //   const blabla = await depositBox
  //     .postMessage(messageProxy.address, "vasya", deployer, 10, "0x0",
  //     {from: deployer});
  //   console.log("blabla", blabla);
  // });

  // it("should ...", async () => {
  //   const userBalance = await web3.eth.getBalance(user);
  //   const deployerBalance = await web3.eth.getBalance(deployer);
  //   const lockAndDataBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
  //   //
  //   console.log("proxyAddress", await depositBox.proxyAddress());
  //   console.log("messageProxy", messageProxy.address);
  //   console.log("lockAndDataForMainnet", lockAndDataForMainnet.address);
  //   console.log("LockAndDataForMainnet", LockAndDataForMainnet.address);
  //   console.log("deployerBalance", await web3.utils.fromWei(deployerBalance));
  //   console.log("userBalance", await web3.utils.fromWei(userBalance));
  //   console.log("lockAndDataBalance", await web3.utils.fromWei(lockAndDataBalance));
  //   // send wei to contract from deployer
  //   const sendBabki = await web3.eth
  //   .sendTransaction({
  //     from: deployer,
  //     to: lockAndDataForMainnet.address,
  //     value: 1000,
  //     gas: 8000000 * gasMultiplier});
  //   const contractBalanceAfter = await web3.eth.getBalance(lockAndDataForMainnet.address);
  //   console.log("contractBalanceAfter", await web3.utils.fromWei(contractBalanceAfter));

  // });

});
