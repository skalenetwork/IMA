import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC721ModuleForSchainContract,
    ERC721ModuleForSchainInstance,
    ERC721OnChainContract,
    ERC721OnChainInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC721Contract,
    LockAndDataForSchainERC721Instance,
    LockAndDataForSchainInstance,
    MessageProxyContract,
    MessageProxyInstance,
    } from "../types/truffle-contracts";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForSchainERC721: LockAndDataForSchainERC721Contract =
    artifacts.require("./LockAndDataForSchainERC721");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");
const ERC721ModuleForSchain: ERC721ModuleForSchainContract = artifacts.require("./ERC721ModuleForSchain");

contract("ERC721ModuleForSchain", ([deployer, user, invoker]) => {
  let messageProxy: MessageProxyInstance;
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let lockAndDataForSchainERC721: LockAndDataForSchainERC721Instance;
  let eRC721OnChain: ERC721OnChainInstance;
  let eRC721ModuleForSchain: ERC721ModuleForSchainInstance;

  beforeEach(async () => {
    messageProxy = await MessageProxy.new("Schain", {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchainERC721 =
        await LockAndDataForSchainERC721.new(lockAndDataForSchain.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
    eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");
    eRC721ModuleForSchain = await ERC721ModuleForSchain.new(lockAndDataForSchain.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
  });

/*   it("should invoke `receiveERC721` with `isRaw==true`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const tokenId = 1;
    const isRaw = true;
    // execution
    const res = await eRC721ModuleForSchain.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    // expectation
    (res.logs[0].event).should.be.equal("EncodedRawData");
  }); */

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
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // execution
    const res = await eRC721ModuleForSchain.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    // expectation
    (res.logs[0].event).should.be.equal("EncodedData");
  });

  it("should return `true` when invoke `sendERC721` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const tokenId = 10;
    const isRaw = false;
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // mint some ERC721 of  for `deployer` address
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer tokenId from `deployer` to `lockAndDataForSchainERC721`
    await eRC721OnChain.transferFrom(deployer,
      lockAndDataForSchainERC721.address, tokenId, {from: deployer});
    // get data from `receiveERC721`
    const getRes = await eRC721ModuleForSchain.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    const data = getRes.logs[0].args.data;
    // execution
    const res = await eRC721ModuleForSchain.sendERC721(to0, data, {from: deployer});
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
    // mint some ERC721 of  for `deployer` address
    await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
    // transfer tokenId from `deployer` to `lockAndDataForSchainERC721`
    await eRC721OnChain.transferFrom(deployer,
      lockAndDataForSchainERC721.address, tokenId, {from: deployer});
    // get data from `receiveERC721`
    const getRes = await eRC721ModuleForSchain.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    const data = getRes.logs[0].args.data;
    // execution
    const res = await eRC721ModuleForSchain.sendERC721(to0, data, {from: deployer});
    // expectation
    expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user);
  });

/*   it("should return `receiver` when invoke `getReceiver` with `to0==eRC721OnChain.address`", async () => {
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
    const getRes = await eRC721ModuleForSchain.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    const data = getRes.logs[0].args.data;
    // execution
    const res = await eRC721ModuleForSchain.getReceiver(to0, data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  }); */

  it("should return `receiver` when invoke `getReceiver` with `to0==address(0)`", async () => {
    // preparation
    const contractHere = eRC721OnChain.address;
    const to = user;
    const to0 = "0x0000000000000000000000000000000000000000"; // bytes20
    const tokenId = 10;
    const isRaw = false;
    // set `ERC721Module` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` contract before invoke `receiveERC721`
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // get data from `receiveERC721`
    const getRes = await eRC721ModuleForSchain.receiveERC721(contractHere, to, tokenId, isRaw, {from: deployer});
    const data = getRes.logs[0].args.data;
    // execution
    const res = await eRC721ModuleForSchain.getReceiver(to0, data, {from: deployer});
    // expectation
    res.should.be.equal(user);
  });

});
