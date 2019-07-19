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

contract("LockAndDataForMainnet", ([deployer, user, invoker]) => {
  let messageProxy: MessageProxyInstance;
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let depositBox: DepositBoxInstance;

  beforeEach(async () => {
    messageProxy = await MessageProxy.new("Mainnet", {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForMainnet = await LockAndDataForMainnet.new({from: deployer, gas: 8000000 * gasMultiplier});
    depositBox = await DepositBox.new(messageProxy.address, lockAndDataForMainnet.address,
       {from: deployer, gas: 8000000 * gasMultiplier});
  });

  it("should add wei to lockAndDataForMainnet", async () => {
    const wei = "10000";
    const lockAndDataBalanceBefore = await web3.eth.getBalance(lockAndDataForMainnet.address);
    console.log("lockAndDataForMainnetBefore", lockAndDataBalanceBefore);
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: wei, from: deployer});
    const lockAndDataBalanceAfter = await web3.eth.getBalance(lockAndDataForMainnet.address);
    console.log("lockAndDataForMainnetAfter", lockAndDataBalanceAfter);
    expect(parseInt(lockAndDataBalanceAfter, 10) -
      parseInt(lockAndDataBalanceBefore, 10)).to.be.equal(parseInt(wei, 10));
  });

  it("should rejected with `Not enough ETH` when invoke sendEth", async () => {
    const wei = "1000";
    const error = "Not enough ETH";
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: wei, from: deployer});
    await lockAndDataForMainnet
      .sendEth(invoker, 10000,
        {from: deployer})
      .should.be.eventually.rejectedWith(error);
    const lockAndDataBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
    console.log("lockAndDataForMainnet", lockAndDataBalance);
  });

  it("should return `true` when invoke sendEth", async () => {
    const addWeiToContract = "1000";
    const sendWeiFromContract = 100;
    const lockAndDataBalanceBefore = await web3.eth.getBalance(lockAndDataForMainnet.address);
    console.log("lockAndDataForMainnetBefore", lockAndDataBalanceBefore);
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: addWeiToContract, from: deployer});
    const res = await lockAndDataForMainnet
      .sendEth(invoker, sendWeiFromContract,
        {from: deployer});
    const contractBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
    expect(parseInt(contractBalance, 10))
      .to.equal(parseInt(addWeiToContract, 10) - sendWeiFromContract);
  });

  // it("should invoke sendEth", async () => {
  //   const bn = await lockAndDataForMainnet
  //     .ololo(100, {value: "100", from: deployer});
  //   console.log("bn", bn);
  //   console.log("OK");
  //   const lockAndDataBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);

  //   console.log("lockAndDataForMainnet", lockAndDataBalance);

  // });

  // it("should invoke setContract", async () => {
  //   const bn = await lockAndDataForMainnet
  //     .setContract(deployer, {from: deployer});
  //   console.log("bn", bn);
  // });

});
