import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC20ModuleForMainnetContract,
    ERC20ModuleForMainnetInstance,
    EthERC20Contract,
    EthERC20Instance,
    LockAndDataForMainnetContract,
    LockAndDataForMainnetERC20Contract,
    LockAndDataForMainnetERC20Instance,
    LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainInstance,
    MessageProxyForMainnetContract,
    MessageProxyForMainnetInstance,
    MessageProxyForSchainContract,
    MessageProxyForSchainInstance,
      TokenFactoryContract,
    TokenFactoryInstance,
    } from "../types/truffle-contracts";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxyForMainnet: MessageProxyForMainnetContract = artifacts.require("./MessageProxyForMainnet");
const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnet");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForMainnetERC20: LockAndDataForMainnetERC20Contract =
    artifacts.require("./LockAndDataForMainnetERC20");
const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");
const TokenFactory: TokenFactoryContract = artifacts.require("./TokenFactory");
const ERC20ModuleForMainnet: ERC20ModuleForMainnetContract = artifacts.require("./ERC20ModuleForMainnet");

const contractManager = "0x0000000000000000000000000000000000000000";

contract("ERC20ModuleForMainnet", ([deployer, user, invoker]) => {
  let messageProxyForMainnet: MessageProxyForMainnetInstance;
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  // let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
  let ethERC20: EthERC20Instance;
  // let tokenFactory: TokenFactoryInstance;
  let eRC20ModuleForMainnet: ERC20ModuleForMainnetInstance;

  beforeEach(async () => {
    messageProxyForMainnet = await MessageProxyForMainnet.new(
      "Mainnet", contractManager, {from: deployer});
    lockAndDataForMainnet = await LockAndDataForMainnet.new({from: deployer});
    // lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
    lockAndDataForMainnetERC20 =
        await LockAndDataForMainnetERC20.new(lockAndDataForMainnet.address,
        {from: deployer});
    // await lockAndDataForMainnet.setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address);
    ethERC20 = await EthERC20.new({from: deployer});
    // tokenFactory = await TokenFactory.new(lockAndDataForSchain.address,
        // {from: deployer});
    eRC20ModuleForMainnet = await ERC20ModuleForMainnet.new(lockAndDataForMainnet.address,
        {from: deployer});
  });

  it("should invoke `receiveERC20` with `isRaw==true`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const amount = 10;
    const isRaw = true;
    await ethERC20.mint(deployer, 10, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    // expectation
    res.should.include("0x"); // l_sergiy: FIX - not passing
  });

  it("should invoke `receiveERC20` with `isRaw==false`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const amount = 6;
    const isRaw = false;
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForMainnet
        .setContract("ERC20Module", eRC20ModuleForMainnet.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForMainnet
        .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
    await ethERC20.mint(deployer, 10, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    // expectation
    res.should.include("0x");

  });

  it("should return `true` when invoke `sendERC20` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const isRaw = false;
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForMainnet
        .setContract("ERC20Module", eRC20ModuleForMainnet.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForMainnet
        .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    // get data from `receiveERC20`
    const data = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForMainnet.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.sendERC20.call(to0, data, {from: deployer});
    // expectation
    expect(res).to.be.true;
  });

  it("should return `true` when invoke `sendERC20` with `to0==ethERC20.address`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const to0 = ethERC20.address; // bytes20
    const amount = 10;
    const isRaw = true;
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForMainnet
        .setContract("ERC20Module", eRC20ModuleForMainnet.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForMainnet
        .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    // get data from `receiveERC20`
    const data = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForMainnet.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.sendERC20.call(to0, data, {from: deployer});
    // expectation
    expect(res).to.be.true;
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==ethERC20.address`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const to0 = invoker; // bytes20
    const amount = 10;
    const isRaw = true;
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForMainnet
        .setContract("ERC20Module", eRC20ModuleForMainnet.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForMainnet
        .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    // get data from `receiveERC20`
    const data = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForMainnet.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.getReceiver(to0, data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const isRaw = false;
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForMainnet
        .setContract("ERC20Module", eRC20ModuleForMainnet.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForMainnet
        .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` quantity of ERC20 tokens for `lockAndDataForMainnetERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    // get data from `receiveERC20`
    const data = await eRC20ModuleForMainnet.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForMainnet.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    const res = await eRC20ModuleForMainnet.getReceiver(to0, data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

});
