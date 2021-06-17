import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    ERC20OnChain
} from "../typechain";

chai.should();
chai.use((chaiAsPromised as any));

import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("ERC20OnChain", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;

    let eRC20OnChain: ERC20OnChain;

    before(async () => {
        [deployer, user] = await ethers.getSigners();
    });

    beforeEach(async () => {
        eRC20OnChain = await deployERC20OnChain("ERC20OnChain", "ERC20");
    });

    it("should invoke `_mint` as internal", async () => {
        // preparation
        const account = user.address;
        const value = 500;
        // execution
        await eRC20OnChain.connect(deployer).mint(account, value);
        // expectation
        const balance = await eRC20OnChain.balanceOf(account);
        parseInt(BigNumber.from(balance).toString(), 10).should.be.equal(value);
    });

    it("should invoke `burn`", async () => {
        // preparation
        const amount = 500;
        const mintAmount = 1500;
        // mint to avoid `SafeMath: subtraction overflow` error
        await eRC20OnChain.connect(deployer).mint(deployer.address, mintAmount);
        // execution
        await eRC20OnChain.connect(deployer).burn(amount);
        // expectation
        const balance = await eRC20OnChain.balanceOf(deployer.address);
        parseInt(BigNumber.from(balance).toString(), 10).should.be.equal(mintAmount - amount);
    });

    it("should invoke `burnFrom`", async () => {
        // preparation
        const account = user.address;
        const amount = 100;
        const mintAmount = 200;
        // mint to avoid `SafeMath: subtraction overflow` error
        await eRC20OnChain.connect(deployer).mint(account, mintAmount);
        // approve to avoid `SafeMath: subtraction overflow` error
        await eRC20OnChain.connect(user).approve(deployer.address, 100);
        // execution
        await eRC20OnChain.connect(deployer).burnFrom(account, amount);
        // expectation
        const balance = await eRC20OnChain.balanceOf(account);
        parseInt(BigNumber.from(balance).toString(), 10).should.be.equal(mintAmount - amount);
    });
});
