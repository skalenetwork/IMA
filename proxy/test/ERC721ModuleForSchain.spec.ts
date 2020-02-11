import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC721ModuleForMainnetContract,
    ERC721ModuleForSchainContract,
    ERC721ModuleForSchainInstance,
    ERC721OnChainContract,
    ERC721OnChainInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC721Contract,
    LockAndDataForSchainERC721Instance,
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

// tslint:disable-next-line: no-var-requires
const ABIERC721OnChain = require("../build/contracts/ERC721OnChain.json");

const MessageProxyForMainnet: MessageProxyForMainnetContract = artifacts.require("./MessageProxyForMainnet");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForSchainERC721: LockAndDataForSchainERC721Contract =
    artifacts.require("./LockAndDataForSchainERC721");
const TokenFactory: TokenFactoryContract =
    artifacts.require("./TokenFactory");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");
const ERC721ModuleForSchain: ERC721ModuleForSchainContract = artifacts.require("./ERC721ModuleForSchain");

const contractManager = "0x0000000000000000000000000000000000000000";

contract("ERC721ModuleForSchain", ([deployer, user, invoker]) => {
  // let messageProxyForMainnet: MessageProxyForMainnetInstance;
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForSchainERC721: LockAndDataForSchainERC721Instance;
  let tokenFactory: TokenFactoryInstance;
  let eRC721OnChain: ERC721OnChainInstance;
  let eRC721ModuleForSchain: ERC721ModuleForSchainInstance;

  beforeEach(async () => {
    // messageProxyForMainnet = await MessageProxyForMainnet.new(
      // "Schain", contractManager, {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
    lockAndDataForSchainERC721 =
        await LockAndDataForSchainERC721.new(lockAndDataForSchain.address,
        {from: deployer});
    tokenFactory =
        await TokenFactory.new(lockAndDataForSchain.address,
        {from: deployer});
    eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");
    eRC721ModuleForSchain = await ERC721ModuleForSchain.new(lockAndDataForSchain.address,
        {from: deployer});
  });

  it("should invoke `receiveERC721` with `isRaw==true`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 1;
    const isRaw = true;
    await lockAndDataForSchain
      .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // execution
    const res = await eRC721ModuleForSchain.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    // expectation
    (res).should.include("0x");
  });

  it("should rejected with `Not existing ERC-721 contract` with `isRaw==false`", async () => {
    // preparation
    const error = "Not existing ERC-721 contract";
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 1;
    const isRaw = false;
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // execution/expectation
    await eRC721ModuleForSchain.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should invoke `receiveERC721` with `isRaw==false`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 1;
    const isRaw = false;
    const contractPosition = 1;
    // to avoid "Message sender is invalid" error
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // add ERC721 token to avoid "Not existing ERC-721 contract" error
    await lockAndDataForSchainERC721
      .addERC721Token(contractHere, contractPosition, {from: deployer});
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer ERC721 token to `lockAndDataForMainnetERC721` to avoid "Token not transfered" error
    await eRC721OnChain.transferFrom(deployer, lockAndDataForSchainERC721.address, tokenId, {from: deployer});
    // execution
    const res = await eRC721ModuleForSchain.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    // expectation
    (res).should.include("0x");
  });

  it("should return `true` for `sendERC721` with `to0==address(0)` and `contractAddreess==address(0)`", async () => {
    // preparation
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const tokenId = 2;
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    await lockAndDataForSchain
        .setContract("TokenFactory", tokenFactory.address, {from: deployer});
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    const data = "0x05" +
    "0000000000000000000000000000000000000000000000000000000000000001" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "0000000000000000000000000000000000000000000000000000000000000002" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000d" + // token name
    "4552433732314f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000006" + // token symbol
    "455243373231"; // token symbol
    // execution
    const res = await eRC721ModuleForSchain.sendERC721(to0, data, {from: deployer});
    // expectation
    // get new token address
    const newAddress = res.logs[0].args.tokenAddress;
    const newERC721Contract = new web3.eth.Contract(ABIERC721OnChain.abi, newAddress);
    expect(await newERC721Contract.methods.ownerOf(tokenId).call()).to.be.equal(to);
  });

  it("should return `true` when invoke `sendERC721` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const tokenId = 2;
    const contractPosition = 2;
    const isRaw = false;
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    await lockAndDataForSchain
        .setContract("TokenFactory", tokenFactory.address, {from: deployer});
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer tokenId from `deployer` to `lockAndDataForSchainERC721`
    await eRC721OnChain.transferFrom(deployer,
      lockAndDataForSchainERC721.address, tokenId, {from: deployer});
    // add ERC721 token to avoid "Not existing ERC-721 contract" error
    await lockAndDataForSchainERC721
      .addERC721Token(contractHere, contractPosition, {from: deployer});
    // invoke `addMinter` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
    await eRC721OnChain.addMinter(lockAndDataForSchainERC721.address);
    // get data from `receiveERC721`
    const data = await eRC721ModuleForSchain.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    await eRC721ModuleForSchain.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    // execution
    await eRC721ModuleForSchain.sendERC721(to0, data, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user);
  });

  it("should return `true` when invoke `sendERC721` with `to0==eRC721OnChain.address`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = eRC721OnChain.address; // bytes20
    const tokenId = 10;
    const isRaw = true;
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // invoke `addMinter` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
    await eRC721OnChain.addMinter(lockAndDataForSchainERC721.address);
    // get data from `receiveERC721`
    const data = await eRC721ModuleForSchain.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    await eRC721ModuleForSchain.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    // execution
    const res = await eRC721ModuleForSchain.sendERC721(to0, data, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user);
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==eRC721OnChain.address`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = invoker; // bytes20
    const tokenId = 10;
    const isRaw = true;
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // get data from `receiveERC721`
    const data = await eRC721ModuleForSchain.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    await eRC721ModuleForSchain.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    // execution
    const res = await eRC721ModuleForSchain.getReceiver(to0, data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

  it("should return `receiver` when invoke `getReceiver` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const tokenId = 10;
    const contractPosition = 10;
    const isRaw = false;
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // add ERC721 token to avoid "Not existing ERC-721 contract" error
    await lockAndDataForSchainERC721
      .addERC721Token(contractHere, contractPosition, {from: deployer});
    // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer ERC721 token to `lockAndDataForMainnetERC721` to avoid "Token not transfered" error
    await eRC721OnChain.transferFrom(deployer, lockAndDataForSchainERC721.address, tokenId, {from: deployer});
    // get data from `receiveERC721`
    const data = await eRC721ModuleForSchain.receiveERC721.call(contractHere, to, tokenId, isRaw, {from: deployer});
    await eRC721ModuleForSchain.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    // execution
    const res = await eRC721ModuleForSchain.getReceiver(to0, data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

});
