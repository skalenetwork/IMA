import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    EthERC20Contract,
    EthERC20Instance,
    LockAndDataForMainnetContract,
    LockAndDataForMainnetERC20Contract,
    LockAndDataForMainnetERC20Instance,
    LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainInstance,
    MessageProxyContract,
    MessageProxyInstance,
    TokenFactoryContract,
    TokenFactoryInstance,
    } from "../types/truffle-contracts";

import { createBytes32 } from "./utils/helper";
import { stringToHex } from "./utils/helper";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");
const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnet");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForMainnetERC20: LockAndDataForMainnetERC20Contract =
    artifacts.require("./LockAndDataForMainnetERC20");
const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");
const TokenFactory: TokenFactoryContract = artifacts.require("./TokenFactory");

const contractManager = "0x0000000000000000000000000000000000000000";

contract("LockAndDataForMainnetERC20", ([deployer, user, invoker]) => {
  let messageProxy: MessageProxyInstance;
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
  let ethERC20: EthERC20Instance;
  let tokenFactory: TokenFactoryInstance;

  beforeEach(async () => {
    messageProxy = await MessageProxy.new("Mainnet", contractManager, {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForMainnet = await LockAndDataForMainnet.new({from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForMainnetERC20 =
        await LockAndDataForMainnetERC20.new(lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
    await lockAndDataForSchain.setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address);
    ethERC20 = await EthERC20.new({from: deployer, gas: 8000000 * gasMultiplier});
    tokenFactory = await TokenFactory.new(lockAndDataForSchain.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
  });

  it("should rejected with `Not enough money`", async () => {
    // preparation
    const error = "Not enough money";
    // execution/expectation
    await lockAndDataForMainnetERC20
        .sendERC20(ethERC20.address, user, 10, {from: deployer})
        .should.be.eventually.rejectedWith(error);
  });

  it("should return `true` after invoke `sendERC20`", async () => {
    // preparation
    const contractHere = ethERC20.address;
    const to = user;
    const amount = 10;
    // set `LockAndDataERC20` contract before invoke `depositERC20`
    await lockAndDataForMainnet
        .setContract("LockAndDataERC20", lockAndDataForMainnetERC20.address, {from: deployer});
    // mint some quantity of ERC20 tokens for `deployer` address
    await ethERC20.mint(deployer, "1000000000", {from: deployer});
    // transfer some quantity of ERC20 tokens for `lockAndDataForMainnetERC20` address
    await ethERC20.transfer(lockAndDataForMainnetERC20.address, "1000000", {from: deployer});
    // execution
    const res = await lockAndDataForMainnetERC20
        .sendERC20.call(contractHere, to, amount, {from: deployer});
    // expectation
    expect(res).to.be.true;
  });

  it("should return `token index` after invoke `addERC20Token`", async () => {
    // preparation
    const decimals = 18;
    const name = "elvis";
    const tokenName = "ELV";
    const sopply = 1000000 * 10 ** 18;
    const data = "0x" + // create data for create ERC20 trought tokenFactory (see ERC20ModuleForSchain.encodeData)
        "01" + // bytes1(uint8(3))
        createBytes32("0") + // bytes32(contractPosition)
        createBytes32("0") + // bytes32(bytes20(to))
        createBytes32("0") + // bytes32(amount)
        createBytes32(name.length.toString()) + // bytes(name).length
        stringToHex(name, 1) + // name
        createBytes32(tokenName.length.toString()) + // bytes(symbol).length
        stringToHex(tokenName, 1) + // symbol
        decimals.toString(16) + // decimals
        createBytes32(sopply.toString(16)); // totalSupply
    // create ERC20 token
    // const erc20TokenAddress = await tokenFactory.createERC20(data, {from: deployer});
    const contractHere = await tokenFactory.createERC20.call(data, {from: deployer});
    await tokenFactory.createERC20(data, {from: deployer});
    // for execution#2
    const contractHer = ethERC20.address;
    // execution#1
    // just call transaction without any changes
    const res = await lockAndDataForMainnetERC20
        .addERC20Token.call(contractHere, {from: deployer});
    await lockAndDataForMainnetERC20
        .addERC20Token(contractHere, {from: deployer});
    // expectation#1
    parseInt(new BigNumber(res).toString(), 10)
        .should.be.equal(1);
    // execution#2
    const res1 = await lockAndDataForMainnetERC20
        .addERC20Token.call(contractHer, {from: deployer});
    // expectation#2
    parseInt(new BigNumber(res1).toString(), 10)
        .should.be.equal(2);
  });

});
