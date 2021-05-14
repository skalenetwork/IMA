import BigNumber from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    MessageProxyForSchainInstance,
    ERC20OnChainInstance,
    ERC20OnChainContract,
    ERC721OnChainContract,
    MessageProxyForSchainContract
} from "../types/truffle-contracts";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");

contract("ERC20OnChain", ([deployer, user]) => {
    let messageProxy: MessageProxyForSchainInstance;
    let eRC20OnChain: ERC20OnChainInstance;

    beforeEach(async () => {
      messageProxy = await MessageProxyForSchain.new(
        "Mainnet", {from: deployer});
      eRC20OnChain = await ERC20OnChain.new("ERC20OnChain", "ERC20", {from: deployer});
    });

    it("should invoke `_mint` as internal", async () => {
      // preparation
      const account = user;
      const value = 500;
      // execution
      await eRC20OnChain.mint(account, value, {from: deployer});
      // expectation
      const balance = await eRC20OnChain.balanceOf(account);
      parseInt(new BigNumber(balance).toString(), 10).should.be.equal(value);
    });

    it("should invoke `burn`", async () => {
      // preparation
      const amount = 500;
      const mintAmount = 1500;
      // mint to avoid `SafeMath: subtraction overflow` error
      await eRC20OnChain.mint(deployer, mintAmount, {from: deployer});
      // execution
      await eRC20OnChain.burn(amount, {from: deployer});
      // expectation
      const balance = await eRC20OnChain.balanceOf(deployer);
      parseInt(new BigNumber(balance).toString(), 10).should.be.equal(mintAmount - amount);
    });

    it("should invoke `burnFrom`", async () => {
      // preparation
      const account = user;
      const amount = 100;
      const mintAmount = 200;
      // mint to avoid `SafeMath: subtraction overflow` error
      await eRC20OnChain.mint(account, mintAmount, {from: deployer});
      // approve to avoid `SafeMath: subtraction overflow` error
      await eRC20OnChain.approve(deployer, 100, {from: account});
      // execution
      await eRC20OnChain.burnFrom(account, amount, {from: deployer});
      // expectation
      const balance = await eRC20OnChain.balanceOf(account);
      parseInt(new BigNumber(balance).toString(), 10).should.be.equal(mintAmount - amount);
    });
  });