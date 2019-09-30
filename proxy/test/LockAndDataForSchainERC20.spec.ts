import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC20OnChainContract,
    ERC20OnChainInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC20Contract,
    LockAndDataForSchainERC20Instance,
    LockAndDataForSchainInstance,
    MessageProxyContract,
    MessageProxyInstance,
    } from "../types/truffle-contracts";

import { createBytes32 } from "./utils/helper";
import { stringToHex } from "./utils/helper";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForSchainERC20: LockAndDataForSchainERC20Contract =
    artifacts.require("./LockAndDataForSchainERC20");
const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");

contract("LockAndDataForSchainERC20", ([deployer, user, invoker]) => {
  let messageProxy: MessageProxyInstance;
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForSchainERC20: LockAndDataForSchainERC20Instance;
  let eRC20OnChain: ERC20OnChainInstance;

  beforeEach(async () => {
    messageProxy = await MessageProxy.new("Schain", {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchainERC20 =
        await LockAndDataForSchainERC20.new(lockAndDataForSchain.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
    eRC20OnChain = await ERC20OnChain.new("ERC721OnChain", "ERC721", 18,
        ((1000000000).toString()), deployer, {from: deployer});

  });

  it("should invoke `sendERC20` without mistakes", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const to = user;
    const amount = 10;
    // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption
    await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address);
    // execution
    const res = await lockAndDataForSchainERC20
        .sendERC20(contractHere, to, amount, {from: deployer});
    // expectation
    expect(res.logs[0].args.result).to.be.true;
  });

  it("should rejected with `Amount not transfered`", async () => {
    // preparation
    const error = "Amount not transfered";
    const contractHere = eRC20OnChain.address;
    const amount = 10;
    // execution/expectation
    const res = await lockAndDataForSchainERC20
        .receiveERC20(contractHere, amount, {from: deployer})
        .should.be.eventually.rejectedWith(error);
  });

  it("should return `true` after invoke `receiveERC20`", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const amount = 10;
    // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption
    await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address);
    // mint some quantity of ERC20 tokens for `deployer` address
    await eRC20OnChain.mint(deployer, "1000000000", {from: deployer});
    // transfer some quantity of ERC20 tokens for `lockAndDataForMainnetERC20` address
    await eRC20OnChain.transfer(lockAndDataForSchainERC20.address, "1000000", {from: deployer});
    // execution
    const res = await lockAndDataForSchainERC20
        .receiveERC20(contractHere, amount, {from: deployer});
    // expectation
    expect(res.logs[0].args.result).to.be.true;
  });

  it("should set `ERC20Tokens` and `ERC20Mapper`", async () => {
    // preparation
    const addressERC20 = eRC20OnChain.address;
    const contractPosition = 10;
    // execution
    await lockAndDataForSchainERC20
        .addERC20Token(addressERC20, contractPosition, {from: deployer});
    // expectation
    expect(await lockAndDataForSchainERC20.erc20Tokens(contractPosition)).to.be.equal(addressERC20);
    expect(parseInt(
        new BigNumber(await lockAndDataForSchainERC20.erc20Mapper(addressERC20))
        .toString(), 10))
        .to.be.equal(contractPosition);
  });

});
