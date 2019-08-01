import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    LockAndDataForMainnetContract,
    LockAndDataForMainnetERC721Contract,
    LockAndDataForMainnetERC721Instance,
    LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainInstance,
    MessageProxyContract,
    MessageProxyInstance,
    TokenFactoryContract,
    TokenFactoryInstance,
    ERC721OnChainInstance,
    ERC721OnChainContract,
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
const LockAndDataForMainnetERC721: LockAndDataForMainnetERC721Contract =
    artifacts.require("./LockAndDataForMainnetERC721");
const TokenFactory: TokenFactoryContract = artifacts.require("./TokenFactory");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");

contract("LockAndDataForMainnetERC721", ([deployer, user, invoker]) => {
  let messageProxy: MessageProxyInstance;
  let lockAndDataForMainnet: LockAndDataForMainnetInstance;
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721Instance;
  let tokenFactory: TokenFactoryInstance;
  let eRC721OnChain: ERC721OnChainInstance;

  beforeEach(async () => {
    messageProxy = await MessageProxy.new("Mainnet", {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForMainnet = await LockAndDataForMainnet.new({from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForMainnetERC721 =
        await LockAndDataForMainnetERC721.new(lockAndDataForMainnet.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
    await lockAndDataForSchain.setContract("LockAndDataERC721", lockAndDataForMainnetERC721.address);
    tokenFactory = await TokenFactory.new(lockAndDataForSchain.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
    eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");

  });

  it("should rejected with `Not enough money`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 1;
    // execution/expectation
    const res = await lockAndDataForMainnetERC721
        .sendERC721(contractHere, to, tokenId, {from: deployer});
    console.log("transaction", res);
  });

/*   it("should return `true` after invoke `sendERC721`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const amount = 10;
    // set `LockAndDataERC721` contract before invoke `depositERC721`
    await lockAndDataForMainnet
        .setContract("LockAndDataERC721", lockAndDataForMainnetERC721.address, {from: deployer});
    // mint some quantity of ERC721 tokens for `deployer` address
    await eRC721OnChain.mint(deployer, "1000000000", {from: deployer});
    // transfer some quantity of ERC721 tokens for `lockAndDataForMainnetERC721` address
    await eRC721OnChain.transferFrom(lockAndDataForMainnetERC721.address, "1000000", {from: deployer});
    // execution
    const res = await lockAndDataForMainnetERC721
        .sendERC721(contractHere, to, amount, {from: deployer});
    // expectation
    expect(res.logs[0].args.result).to.be.true;
  });

  it("should return `token index` after invoke `addERC721Token`", async () => {
    // preparation
    const decimals = 18;
    const name = "elvis";
    const tokenName = "ELV";
    const sopply = 1000000 * 10 ** 18;
    const data = "0x" + // create data for create ERC721 trought tokenFactory (see ERC721ModuleForSchain.encodeData)
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
    // create ERC721 token
    // const erc721TokenAddress = await tokenFactory.createERC721(data, {from: deployer});
    const {logs} = await tokenFactory.createERC721(data, {from: deployer});
    const contractHere = logs[0].args.contractAddress;
    // for execution#2
    const contractHer = eRC721OnChain.address;
    // execution#1
    const res = await lockAndDataForMainnetERC721
        .addERC721Token(contractHere, {from: deployer});
    // expectation#1
    parseInt(new BigNumber(res.logs[0].args.index).toString(), 10)
        .should.be.equal(1);
    // execution#2
    const res1 = await lockAndDataForMainnetERC721
        .addERC721Token(contractHer, {from: deployer});
    // expectation#2
    parseInt(new BigNumber(res1.logs[0].args.index).toString(), 10)
        .should.be.equal(2);
  }); */

});
