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

  it("should add wei to `lockAndDataForMainnet`", async () => {
    // preparation
    const wei = "10000";
    const lockAndDataBalanceBefore = await web3.eth.getBalance(lockAndDataForMainnet.address);
    // add wei to contract throught receiveEth because receiveEth have `payable` parameter
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: wei, from: deployer});
    const lockAndDataBalanceAfter = await web3.eth.getBalance(lockAndDataForMainnet.address);
    // expectation
    expect(parseInt(lockAndDataBalanceAfter, 10) -
      parseInt(lockAndDataBalanceBefore, 10)).to.be.equal(parseInt(wei, 10));
  });

  it("should rejected with `Not enough ETH` when invoke sendEth", async () => {
    // preparation
    const wei = "1000";
    const error = "Not enough ETH";
    // add wei to contract throught receiveEth because receiveEth have `payable` parameter
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: wei, from: deployer});
    // execution/expectation
    await lockAndDataForMainnet
      .sendEth(invoker, 10000,
        {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should work `sendEth`", async () => {
    // preparation
    const addWeiToContract = "1000";
    const sendWeiFromContract = 100;
    // add wei to contract throught receiveEth because receiveEth have `payable` parameter
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: addWeiToContract, from: deployer});
    // execution
    await lockAndDataForMainnet
      .sendEth(invoker, sendWeiFromContract,
        {from: deployer});
    const contractBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
    // expectation
    expect(parseInt(contractBalance, 10))
      .to.equal(parseInt(addWeiToContract, 10) - sendWeiFromContract);
  });

  it("should work `approveTransfer`", async () => {
    // preparation
    const addWeiToContract = "1000";
    const sendWeiFromContract = 100;
    // add wei to contract throught receiveEth because receiveEth have `payable` parameter
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: addWeiToContract, from: deployer});
    // execute
    await lockAndDataForMainnet
      .approveTransfer(deployer, sendWeiFromContract, {from: deployer});
    // get value from mapping `approveTransfers`
    const bn = new BigNumber(await lockAndDataForMainnet.approveTransfers(deployer));
    // expectation
    parseInt(bn.toString(), 10).should.be.equal(sendWeiFromContract);
  });

  it("should work `getMyEth`", async () => {
    // preparation
    const addWeiToContract = "1000";
    const sendWeiFromContract = 100;
    // add wei to contract throught receiveEth because receiveEth have `payable` parameter
    await lockAndDataForMainnet
      .receiveEth(invoker, {value: addWeiToContract, from: deployer});
    // without `approveTransfer` `getMyEth` not invoke
    await lockAndDataForMainnet
      .approveTransfer(deployer, sendWeiFromContract, {from: deployer});
    // execute
    await lockAndDataForMainnet
      .getMyEth({from: deployer});
    const contractBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
    // expectation
    expect(parseInt(contractBalance, 10))
      .to.equal(parseInt(addWeiToContract, 10) - sendWeiFromContract);
  });

  it("should rejected with `User has insufficient ETH` when invoke `getMyEth`", async () => {
    // preparation
    const error = "User has insufficient ETH";
    // execution/expectation
    await lockAndDataForMainnet
      .getMyEth({from: deployer})
      .should.be.eventually.rejectedWith(error);
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
