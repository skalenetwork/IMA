import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");
import {
    ERC20ModuleForSchainContract,
    ERC20ModuleForSchainInstance,
    ERC721ModuleForSchainContract,
    ERC721ModuleForSchainInstance,
    EthERC20Contract,
    EthERC20Instance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC20Contract,
    LockAndDataForSchainERC20Instance,
    LockAndDataForSchainERC721Contract,
    LockAndDataForSchainERC721Instance,
    LockAndDataForSchainInstance,
    MessageProxyContract,
    MessageProxyInstance,
    TokenFactoryContract,
    TokenFactoryInstance,
  } from "../types/truffle-contracts";
import { gasMultiplier } from "./utils/command_line";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

// tslint:disable-next-line: no-var-requires
const ABIERC20OnChain = require("../build/contracts/ERC20OnChain.json");

const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");
const TokenFactory: TokenFactoryContract = artifacts.require("./TokenFactory");
const LockAndDataForSchainERC20: LockAndDataForSchainERC20Contract =
    artifacts.require("./LockAndDataForSchainERC20");
const ERC20ModuleForSchain: ERC20ModuleForSchainContract = artifacts.require("./ERC20ModuleForSchain");
const LockAndDataForSchainERC721: LockAndDataForSchainERC721Contract =
    artifacts.require("./LockAndDataForSchainERC721");
const ERC721ModuleForSchain: ERC721ModuleForSchainContract = artifacts.require("./ERC721ModuleForSchain");

contract("TokenFactory", ([user, deployer]) => {
  let messageProxy: MessageProxyInstance;
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let ethERC20: EthERC20Instance;
  let tokenFactory: TokenFactoryInstance;
  let eRC20ModuleForSchain: ERC20ModuleForSchainInstance;
  let lockAndDataForSchainERC20: LockAndDataForSchainERC20Instance;
  let eRC721ModuleForSchain: ERC721ModuleForSchainInstance;
  let lockAndDataForSchainERC721: LockAndDataForSchainERC721Instance;

  beforeEach(async () => {
    messageProxy = await MessageProxy.new("Mainnet", {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
    ethERC20 = await EthERC20.new({from: deployer, gas: 8000000 * gasMultiplier});
    tokenFactory = await TokenFactory.new(lockAndDataForSchain.address,
      {from: deployer, gas: 8000000 * gasMultiplier});
    eRC20ModuleForSchain = await ERC20ModuleForSchain.new(lockAndDataForSchain.address,
      {from: deployer, gas: 8000000 * gasMultiplier});
    eRC721ModuleForSchain = await ERC721ModuleForSchain.new(lockAndDataForSchain.address,
      {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchainERC20 =
      await LockAndDataForSchainERC20.new(lockAndDataForSchain.address, {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchainERC721 =
      await LockAndDataForSchainERC721.new(lockAndDataForSchain.address,
        {from: deployer, gas: 8000000 * gasMultiplier});
  });

  it("should createERC20", async () => {
    // preparation
    const to = user;
    const data = "0x03" +
    "000000000000000000000000000000000000000000000000000000000000000a" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "000000000000000000000000000000000000000000000000000000000000000a" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000c" + // token name
    "45524332304f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000005" + // token symbol
    "455243323012" + // token symbol
    "000000000000000000000000000000000000000000000000000000003b9ac9f6"; // total supply
    // set `ERC20Module` to avoid `Roles: account is the zero address` error
    await lockAndDataForSchain
      .setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC20` to avoid `Roles: account is the zero address` error
    await lockAndDataForSchain
      .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
    // execution
    const {logs} = await tokenFactory.createERC20(data, {from: deployer});
    // expectation
    expect(logs[0].event).to.be.equal("ERC20TokenCreated");
    expect(logs[0].args.contractAddress).to.include("0x");
  });

  it("should createERC721", async () => {
    // preparation
    const to = user;
    const data = "0x05" +
    "0000000000000000000000000000000000000000000000000000000000000001" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "0000000000000000000000000000000000000000000000000000000000000002" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000d" + // token name
    "4552433732314f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000006" + // token symbol
    "455243373231"; // token symbol
    // set `ERC721Module` to avoid `Roles: account is the zero address` error
    await lockAndDataForSchain
        .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
    // set `LockAndDataERC721` to avoid `Roles: account is the zero address` error
    await lockAndDataForSchain
        .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
    // execution
    const {logs} = await tokenFactory.createERC721(data, {from: deployer});
    // expectation
    expect(logs[0].event).to.be.equal("ERC721TokenCreated");
    expect(logs[0].args.contractAddress).to.include("0x");
  });

});
