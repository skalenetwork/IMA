import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC20ModuleForSchainContract,
    ERC20ModuleForSchainInstance,
    ERC20OnChainContract,
    ERC20OnChainInstance,
    EthERC20Contract,
    EthERC20Instance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC20Contract,
    LockAndDataForSchainERC20Instance,
    LockAndDataForSchainInstance,
    MessageProxyContract,
    MessageProxyInstance,
    TokenFactoryContract,
    TokenFactoryInstance,
    } from "../types/truffle-contracts";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

// tslint:disable-next-line: no-var-requires
const ABIERC20OnChain = require("../build/contracts/ERC20OnChain.json");

const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForSchainERC20: LockAndDataForSchainERC20Contract =
    artifacts.require("./LockAndDataForSchainERC20");
const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");
const TokenFactory: TokenFactoryContract = artifacts.require("./TokenFactory");
const ERC20ModuleForSchain: ERC20ModuleForSchainContract = artifacts.require("./ERC20ModuleForSchain");
const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");

const contractManager = "0x0000000000000000000000000000000000000000";

contract("ERC20ModuleForSchain", ([deployer, user, invoker]) => {
  let messageProxy: MessageProxyInstance;
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForSchainERC20: LockAndDataForSchainERC20Instance;
  let ethERC20: EthERC20Instance;
  let tokenFactory: TokenFactoryInstance;
  let eRC20ModuleForSchain: ERC20ModuleForSchainInstance;
  let eRC20OnChain: ERC20OnChainInstance;
  let eRC20OnChain2: ERC20OnChainInstance;

  beforeEach(async () => {
    messageProxy = await MessageProxy.new("Schain", contractManager, {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchainERC20 =
        await LockAndDataForSchainERC20.new(lockAndDataForSchain.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
    ethERC20 = await EthERC20.new({from: deployer, gas: 8000000 * gasMultiplier});
    tokenFactory = await TokenFactory.new(lockAndDataForSchain.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
    eRC20ModuleForSchain = await ERC20ModuleForSchain.new(lockAndDataForSchain.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
    eRC20OnChain = await ERC20OnChain.new("ERC20OnChain", "ERC20", 18,
        ((1000000000).toString()), deployer, {from: deployer});
    eRC20OnChain2 = await ERC20OnChain.new("ERC20OnChain2", "ERC202", 18,
        ((1000000000).toString()), deployer, {from: deployer});
  });

  it("should invoke `receiveERC20` with `isRaw==true`", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const to = user;
    const amount = 10;
    const isRaw = true;
    // execution
    const res = await eRC20ModuleForSchain.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    // expectation
    (res).should.include("0x");
  });

  it("should rejected with `Not existing ERC-20 contract` with `isRaw==false`", async () => {
    // preparation
    const error = "Not existing ERC-20 contract";
    const contractHere = eRC20OnChain.address;
    const to = user;
    const amount = 10;
    const isRaw = false;
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
    // execution/expectation
    await eRC20ModuleForSchain.receiveERC20(contractHere, to, amount, isRaw, {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should invoke `receiveERC20` with `isRaw==false`", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const to = user;
    const amount = 10;
    const isRaw = false;
    const contractPosition = 1;
    // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption
    await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address);
    // mint some quantity of ERC20 tokens for `deployer` address
    await eRC20OnChain.mint(deployer, "1000000000", {from: deployer});
    // transfer some quantity of ERC20 tokens for `lockAndDataForMainnetERC20` address
    await eRC20OnChain.transfer(lockAndDataForSchainERC20.address, "1000000", {from: deployer});
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
    // add ERC20 token to avoid "Not existing ERC-20 contract" error
    await lockAndDataForSchainERC20
      .addERC20Token(contractHere, contractPosition, {from: deployer});
    // execution
    const res = await eRC20ModuleForSchain.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    // expectation
    (res).should.include("0x");
  });

  it("should return `true` when invoke `sendERC20` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const contractPosition = 10;
    const isRaw = false;
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
    // mint some quantity of ERC20 tokens for `deployer` address
    await eRC20OnChain.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` qantity of ERC20 tokens for `lockAndDataForSchainERC20` to avoid `Not enough money`
    await eRC20OnChain.transfer(lockAndDataForSchainERC20.address, "1000000", {from: deployer});
    // add ERC20 token to avoid "Not existing ERC-20 contract" error in `receiveERC20` func
    await lockAndDataForSchainERC20
      .addERC20Token(contractHere, contractPosition, {from: deployer});
    // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption
    await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address);
    // get data from `receiveERC20`
    const data = await eRC20ModuleForSchain.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForSchain.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    await eRC20ModuleForSchain.sendERC20(to0, data, {from: deployer});
    // expectation
    const balance = await eRC20OnChain.balanceOf(to);
    parseInt(new BigNumber(balance).toString(), 10).should.be.equal(amount);
  });

  it("should return send ERC20 token twice", async () => {
    // preparation
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const data = "0x03" +
    "000000000000000000000000000000000000000000000000000000000000000a" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "000000000000000000000000000000000000000000000000000000000000000a" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000c" + // token name
    "45524332304f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000005" + // token symbol
    "455243323012" + // token symbol
    "000000000000000000000000000000000000000000000000000000003b9ac9f6"; // total supply

    const data2 = "0x03" +
    "000000000000000000000000000000000000000000000000000000000000000a" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "000000000000000000000000000000000000000000000000000000000000000a" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000c" + // token name
    "45524332304f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000005" + // token symbol
    "455243323012" + // token symbol
    "000000000000000000000000000000000000000000000000000000003b9ac9f7"; // total supply

    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
    //
    await lockAndDataForSchain
        .setContract("TokenFactory", tokenFactory.address, {from: deployer});
    // execution
    const res = await eRC20ModuleForSchain.sendERC20(to0, data, {from: deployer});
    const newAddress = res.logs[0].args.tokenThere;
    // expectation
    const newERC20Contract = new web3.eth.Contract(ABIERC20OnChain.abi, newAddress);
    await eRC20ModuleForSchain.sendERC20(to0, data2, {from: deployer});
    const balance = await newERC20Contract.methods.balanceOf(to).call();
    parseInt(new BigNumber(balance).toString(), 10).should.be.equal(amount * 2);
  });

  it("should return `true` for `sendERC20` with `to0==address(0)` and `contractAddreess==address(0)`", async () => {
    // preparation
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const data = "0x03" +
    "000000000000000000000000000000000000000000000000000000000000000a" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "000000000000000000000000000000000000000000000000000000000000000a" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000c" + // token name
    "45524332304f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000005" + // token symbol
    "455243323012" + // token symbol
    "000000000000000000000000000000000000000000000000000000003b9ac9f6"; // total supply
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
    //
    await lockAndDataForSchain
        .setContract("TokenFactory", tokenFactory.address, {from: deployer});
    // execution
    const res = await eRC20ModuleForSchain.sendERC20(to0, data, {from: deployer});
    const newAddress = res.logs[0].args.tokenThere;
    // expectation
    const newERC20Contract = new web3.eth.Contract(ABIERC20OnChain.abi, newAddress);
    const balance = await newERC20Contract.methods.balanceOf(to).call();
    parseInt(new BigNumber(balance).toString(), 10).should.be.equal(amount);
  });

  it("should return `true` when invoke `sendERC20` with `to0==ethERC20.address`", async () => {
    // preparation
    const contractHere = eRC20OnChain.address;
    const to = user;
    const to0 = eRC20OnChain2.address; // bytes20
    const amount = 10;
    const isRaw = true;
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
    // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption
    await eRC20OnChain2.addMinter(lockAndDataForSchainERC20.address);
    // get data from `receiveERC20`
    const data = await eRC20ModuleForSchain.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForSchain.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    const res = await eRC20ModuleForSchain.sendERC20(to0, data, {from: deployer});
    // expectation
    const balance = await eRC20OnChain2.balanceOf(to);
    parseInt(new BigNumber(balance).toString(), 10).should.be.equal(amount);
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==ethERC20.address`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const to0 = invoker; // bytes20
    const amount = 10;
    const isRaw = true;
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` qantity of ERC20 tokens for `lockAndDataForSchainERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForSchainERC20.address, "1000000", {from: deployer});
    // get data from `receiveERC20`
    const data = await eRC20ModuleForSchain.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForSchain.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    const res = await eRC20ModuleForSchain.getReceiver(to0, data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const amount = 10;
    const contractPosition = 10;
    const isRaw = false;
    // set `ERC20Module` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC20` contract before invoke `receiveERC20`
    await lockAndDataForSchain
        .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer more than `amount` qantity of ERC20 tokens for `lockAndDataForSchainERC20` to avoid `Not enough money`
    await ethERC20.transfer(lockAndDataForSchainERC20.address, "1000000", {from: deployer});
    // add ERC20 token to avoid "Not existing ERC-20 contract" error
    await lockAndDataForSchainERC20
      .addERC20Token(contractHere, contractPosition, {from: deployer});
    // get data from `receiveERC20`
    const data = await eRC20ModuleForSchain.receiveERC20.call(contractHere, to, amount, isRaw, {from: deployer});
    await eRC20ModuleForSchain.receiveERC20(contractHere, to, amount, isRaw, {from: deployer});
    // execution
    const res = await eRC20ModuleForSchain.getReceiver(to0, data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

});
