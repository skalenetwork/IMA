// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file TokenManager.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");

import { ERC20ModuleForSchainContract,
    ERC20ModuleForSchainInstance,
    ERC20OnChainContract,
    ERC20OnChainInstance,
    ERC721ModuleForSchainContract,
    ERC721ModuleForSchainInstance,
    ERC721OnChainContract,
    ERC721OnChainInstance,
    EthERC20Contract,
    EthERC20Instance,
    LockAndDataForSchainWorkaroundContract,
    LockAndDataForSchainERC20Contract,
    LockAndDataForSchainERC20Instance,
    LockAndDataForSchainERC721Contract,
    LockAndDataForSchainERC721Instance,
    LockAndDataForSchainInstance,
    MessageProxyForSchainContract,
    MessageProxyForSchainInstance,
    TokenFactoryContract,
    TokenFactoryInstance,
    TokenManagerContract,
    TokenManagerInstance} from "../types/truffle-contracts";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

const TokenManager: TokenManagerContract = artifacts.require("./TokenManager");
const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");
const LockAndDataForSchain: LockAndDataForSchainWorkaroundContract = artifacts.require("./LockAndDataForSchainWorkaround");
const LockAndDataForSchainERC20: LockAndDataForSchainERC20Contract = artifacts.require("./LockAndDataForSchainERC20");
const ERC20ModuleForSchain: ERC20ModuleForSchainContract = artifacts.require("./ERC20ModuleForSchain");
const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");
const ERC721ModuleForSchain: ERC721ModuleForSchainContract = artifacts.require("./ERC721ModuleForSchain");
const LockAndDataForSchainERC721: LockAndDataForSchainERC721Contract = artifacts
    .require("./LockAndDataForSchainERC721");
const TokenFactory: TokenFactoryContract = artifacts.require("./TokenFactory");

contract("TokenManager", ([deployer, user, client]) => {
    let tokenManager: TokenManagerInstance;
    let messageProxyForSchain: MessageProxyForSchainInstance;
    let ethERC20: EthERC20Instance;
    let lockAndDataForSchain: LockAndDataForSchainInstance;
    let lockAndDataForSchainERC20: LockAndDataForSchainERC20Instance;
    let eRC20ModuleForSchain: ERC20ModuleForSchainInstance;
    let eRC20OnChain: ERC20OnChainInstance;
    let eRC20: ERC20OnChainInstance;
    let eRC721OnChain: ERC721OnChainInstance;
    let eRC721: ERC721OnChainInstance;
    let eRC721ModuleForSchain: ERC721ModuleForSchainInstance;
    let lockAndDataForSchainERC721: LockAndDataForSchainERC721Instance;
    let tokenFactory: TokenFactoryInstance;

    const publicKeyArray = [
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
    ];

    const chainID = randomString(10);

    beforeEach(async () => {
        messageProxyForSchain = await MessageProxyForSchain.new(
            chainID, {from: deployer});
        lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
        await lockAndDataForSchain.setContract("MessageProxy", messageProxyForSchain.address);
        tokenManager = await TokenManager.new(chainID, lockAndDataForSchain.address, {from: deployer});
        ethERC20 = await EthERC20.new({from: deployer});
        lockAndDataForSchainERC20 = await LockAndDataForSchainERC20
            .new(lockAndDataForSchain.address, {from: deployer});
        eRC20ModuleForSchain = await ERC20ModuleForSchain
            .new(lockAndDataForSchain.address, {from: deployer});
        eRC20OnChain = await ERC20OnChain.new("ERC20", "ERC20", {from: deployer});
        eRC20 = await ERC20OnChain.new("SKALE", "SKL", {from: deployer});
        eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721",
            {from: deployer});
        eRC721 = await ERC721OnChain.new("eRC721", "ERC721",
            {from: deployer});
        eRC721ModuleForSchain = await ERC721ModuleForSchain.new(lockAndDataForSchain.address,
            {from: deployer});
        lockAndDataForSchainERC721 = await LockAndDataForSchainERC721.new(lockAndDataForSchain.address,
            {from: deployer});
        tokenFactory = await TokenFactory.new(lockAndDataForSchain.address,
            {from: deployer});
        await lockAndDataForSchainERC20.enableAutomaticDeploy("Mainnet", {from: deployer});
        await lockAndDataForSchainERC721.enableAutomaticDeploy("Mainnet", {from: deployer});
    });

    it("should send Eth to somebody on Mainnet, closed to Mainnet, called by schain", async () => {
        const amount = new BigNumber("20000000000000000");
        const amountTo = new BigNumber("2000000000000000");
        const amountAfter = new BigNumber("18000000000000000");
        const to = deployer;

        // set EthERC20 address:
        await lockAndDataForSchain.setEthErc20Address(ethERC20.address, {from: deployer});

        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});

        // send Eth:
        await lockAndDataForSchain.sendEth(user, amount, {from: deployer});

        await lockAndDataForSchain.addExits(user, 1, {from: deployer});

        // send Eth to a client on Mainnet:
        await tokenManager.exitToMainWithoutData(to, amountTo, {from: user});
        const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
        balanceAfter.should.be.deep.equal(amountAfter);
    });

    it("should transfer to somebody on schain Eth and some data", async () => {
        const amount = new BigNumber("20000000000000000");
        const amountTo = new BigNumber("2000000000000000");
        const amountAfter = new BigNumber("18000000000000000");
        const bytesData = "0x0";
        const to = deployer;

        // set EthERC20 address:
        await lockAndDataForSchain.setEthErc20Address(ethERC20.address, {from: deployer});

        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // add connected chain:
        await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});

        // send Eth:
        await lockAndDataForSchain.sendEth(user, amount, {from: deployer});

        // add schain:
        await lockAndDataForSchain.addSchain(chainID, user, {from: deployer});

        // send Eth and data to a client on schain:
        await tokenManager.transferToSchainWithoutData(chainID, to, amountTo, {from: user});

        const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
        balanceAfter.should.be.deep.equal(amountAfter);
    });

    it("should rejected with `Not allowed ERC20 Token` when invoke `exitToMainERC20`", async () => {
        const error = "Not allowed ERC20 Token";
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        //
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
        await lockAndDataForSchain.setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
        // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
        const minterRole = await eRC20OnChain.MINTER_ROLE();
        await eRC20OnChain.grantRole(minterRole, lockAndDataForSchainERC20.address, {from: deployer});
        //
        await lockAndDataForSchainERC20.addERC20ForSchain("Mainnet", eRC20.address, eRC20OnChain.address, {from: deployer});
        await lockAndDataForSchainERC20.setTotalSupplyOnMainnet(eRC20OnChain.address, 199);
        await lockAndDataForSchainERC20.sendERC20(eRC20OnChain.address, user, amount, {from: deployer}).should.be.eventually.rejectedWith("Total supply exceeded");
        await lockAndDataForSchainERC20.setTotalSupplyOnMainnet(eRC20OnChain.address, 200);
        await lockAndDataForSchainERC20.sendERC20(eRC20OnChain.address, user, amount, {from: deployer});
        //
        await eRC20OnChain.approve(tokenManager.address, amountTo, {from: user});
        // // execution/expectation
        await tokenManager.exitToMainERC20(eRC20.address, client, amountTo, {from: deployer})
            .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with `Does not allow to exit` when invoke `exitToMainERC20`", async () => {
        const error = "Does not allow to exit";
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
        await lockAndDataForSchain.setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
        // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
        await lockAndDataForSchainERC20.addERC20ForSchain("Mainnet", eRC20.address, eRC20OnChain.address, {from: deployer});
        const minterRole = await eRC20OnChain.MINTER_ROLE();
        await eRC20OnChain.grantRole(minterRole, lockAndDataForSchainERC20.address);
        await eRC20OnChain.mint(deployer, amount, {from: deployer});
        await eRC20OnChain.approve(tokenManager.address, amountTo, {from: deployer});
        await tokenManager.exitToMainERC20(eRC20.address, client, amountTo, {from: deployer})
            .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `exitToMainERC20` without mistakes", async () => {
        const amount = "20000000000000000";
        const amountMint =    "10000000000000000";
        const amountToCost = "9000000000000000";
        const amountReduceCoast = "8000000000000000";

        // set EthERC20 address:
        // await lockAndDataForSchain.setEthERC20Address(eRC20OnChain.address, {from: deployer});

        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});

        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});

        // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
        // await lockAndDataForSchain.setContract(
        // "MessageProxyForSchain", messageProxyForSchain.address, {from: deployer});

        // add connected chain:
        // await messageProxyForSchain.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
        // const minterRole = await eRC20OnChain.MINTER_ROLE();
        // await eRC20OnChain.grantRole(minterRole, lockAndDataForSchainERC20.address);

        await lockAndDataForSchain.setContract("ERC20Module", deployer, {from: deployer});

        // // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
        // await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});

        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC20OnChain.mint(deployer, amountMint, {from: deployer});

        // invoke `addExits` to avoid `Does not allow to exit` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.addExits(deployer, 1, {from: deployer});

        // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
       await lockAndDataForSchainERC20.addERC20ForSchain("Mainnet", eRC20.address, eRC20OnChain.address, {from: deployer});

        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await eRC20OnChain.approve(tokenManager.address, amountMint, {from: deployer});

        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});

        // add schain:
        // await lockAndDataForSchain.addSchain(chainID, tokenManager.address, {from: deployer});

        // execution:
        const res = await tokenManager
            .exitToMainERC20(eRC20.address, client, amountReduceCoast, {from: deployer});

        // // expectation:
        const outgoingMessagesCounterMainnet = new BigNumber(await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet"));
        outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
    });

    it("should revert `Not allowed. in TokenManager`", async () => {
        // preparation
        const error = "Not allowed. in TokenManager";
        // execution/expectation
        await web3.eth.sendTransaction({from: deployer, to: tokenManager.address, value: "1000000000000000000"})
            .should.be.eventually.rejectedWith(error);
    });

    // it("should return money if it has it", async () => {
    //     const tokenManagerBalance = Number.parseInt(await web3.eth.getBalance(tokenManager.address), 10);
    //     const ownerBalance = Number.parseInt(await web3.eth.getBalance(deployer), 10);
    //     tokenManager.withdraw({from: deployer, gasPrice: 0});
    //     Number.parseInt(await web3.eth.getBalance(tokenManager.address), 10).should.be.equal(0);
    //     Number.parseInt(await web3.eth.getBalance(deployer), 10).should.be.equal(ownerBalance + tokenManagerBalance);
    // });

    it("should rejected with `Not allowed ERC20 Token` when invoke `transferToSchainERC20`", async () => {
        const error = "Not allowed ERC20 Token";
        const amount =            "20000000000000000";
        const amountMint =        "10000000000000000";
        const amountToCost =      "9000000000000000";
        const amountReduceCoast = "800000000000000000";
        const schainID = randomString(10);
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
        // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
        // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
        // await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC20OnChain.mint(deployer, amountMint, {from: deployer});

        await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID, {from: deployer});

        // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
        await lockAndDataForSchainERC20.addERC20ForSchain(schainID, eRC20.address, eRC20OnChain.address, {from: deployer});
        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await eRC20OnChain.approve(tokenManager.address, amountMint, {from: deployer});

        // execution:
        await tokenManager
            .transferToSchainERC20(schainID, eRC20.address, client, amountReduceCoast, {from: deployer})
            .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `transferToSchainERC20` without mistakes", async () => {
        const amount =            "20000000000000000";
        const amountMint =        "10000000000000000";
        const amountToCost =      "9000000000000000";
        const amountReduceCoast = "8000000000000000";
        const schainID = randomString(10);
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
        // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
        // add connected chain:
        await messageProxyForSchain.addConnectedChain(schainID, publicKeyArray, {from: deployer});
        // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
        // await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC20OnChain.mint(deployer, amountMint, {from: deployer});

        await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID, {from: deployer});
        // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
        await lockAndDataForSchainERC20.addERC20ForSchain(schainID, eRC20.address, eRC20OnChain.address, {from: deployer});
        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await eRC20OnChain.approve(tokenManager.address, amountMint, {from: deployer});

        // execution:
        await tokenManager
            .transferToSchainERC20(schainID, eRC20.address, client, amountReduceCoast, {from: deployer});
        // expectation:
        const outgoingMessagesCounterMainnet = new BigNumber(
            await messageProxyForSchain.getOutgoingMessagesCounter(schainID));
        outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
    });

    it("should rejected with `Not allowed ERC721 Token` when invoke `exitToMainERC721`", async () => {
        const error = "Not allowed ERC721 Token";
        const amountToCost = "9000000000000000";
        const tokenId = 10;
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
        // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
        // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract(
            "MessageProxyForSchain", messageProxyForSchain.address, {from: deployer});
        // add connected chain:
        await lockAndDataForSchainERC721.addERC721ForSchain("Mainnet", eRC20.address,eRC20OnChain.address, {from: deployer});
        // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
        const minterRole = await eRC721OnChain.MINTER_ROLE();
        await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
        // invoke `addExits` to avoid `Does not allow to exit` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.addExits(deployer, 1, {from: deployer});
        // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
        await lockAndDataForSchainERC721.addERC721ForSchain("Mainnet", eRC721.address, eRC721OnChain.address, {from: deployer});
        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await eRC721OnChain.approve(tokenManager.address, tokenId, {from: deployer});

        // execution:
        await tokenManager
            .exitToMainERC721(eRC721.address, client, tokenId, {from: deployer})
            .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with `Does not allow to exit` when invoke `exitToMainERC721`", async () => {
        const error = "Does not allow to exit";
        const tokenId = 10;
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
        // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
        // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract(
            "MessageProxyForSchain", messageProxyForSchain.address, {from: deployer});
        // add connected chain:
        await lockAndDataForSchainERC721
            .addERC721ForSchain("Mainnet", eRC20.address,eRC20OnChain.address, {from: deployer});
        // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
        const minterRole = await eRC721OnChain.MINTER_ROLE();
        await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
        // invoke `addERC721ForSchain` to avoid `Not existing ERC-721 contract` exception on `exitToMainERC721` function:
        await lockAndDataForSchainERC721.addERC721ForSchain("Mainnet", eRC721.address, eRC721OnChain.address, {from: deployer});
        await eRC721OnChain.transferFrom(deployer, tokenManager.address, tokenId, {from: deployer});

        // execution:
        await tokenManager
            .exitToMainERC721(eRC721.address, client, tokenId, {from: deployer})
            .should.be.eventually.rejectedWith(error);

    });

    it("should invoke `exitToMainERC721` without mistakes", async () => {
        const amountToCost = "9000000000000000";
        const tokenId = 10;
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721.address;
        const to = user;
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
        // to avoid "Message sender is invalid" error
        await lockAndDataForSchain
            .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
        // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract(
            "MessageProxyForSchain", messageProxyForSchain.address, {from: deployer});
        await lockAndDataForSchainERC721.addERC721ForSchain("Mainnet", contractThere, contractHere, {from: deployer});
        // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
        const minterRole = await eRC721OnChain.MINTER_ROLE();
        await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
        // invoke `addExits` to avoid `Does not allow to exit` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.addExits(deployer, 1, {from: deployer});
        await eRC721OnChain.transferFrom(deployer, tokenManager.address, tokenId, {from: deployer});

        // execution:
        await tokenManager.exitToMainERC721(contractThere, to, tokenId, {from: deployer});
        // expectation:
        const outgoingMessagesCounterMainnet = new BigNumber(await messageProxyForSchain
            .getOutgoingMessagesCounter("Mainnet"));
        outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
    });

    it("should invoke `transferToSchainERC721` without mistakes", async () => {
        const amountToCost = "9000000000000000";
        const tokenId = 10;
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721.address;
        const to = user;
        const schainID = randomString(10);
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
        // to avoid "Message sender is invalid" error
        await lockAndDataForSchain
            .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
        // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract(
            "MessageProxyForSchain", messageProxyForSchain.address, {from: deployer});
        // add connected chain:
        await messageProxyForSchain.addConnectedChain(schainID, publicKeyArray, {from: deployer});
        await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
        await lockAndDataForSchainERC721
            .addERC721ForSchain(schainID, contractThere, contractHere, {from: deployer});
        // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
        const minterRole = await eRC721OnChain.MINTER_ROLE();
        await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});

        await eRC721OnChain.transferFrom(deployer, tokenManager.address, tokenId, {from: deployer});

        // execution:
        const res = await tokenManager
            .transferToSchainERC721(schainID, contractThere, to, tokenId, {from: deployer});
        // expectation:
        const outgoingMessagesCounter = new BigNumber(await messageProxyForSchain
            .getOutgoingMessagesCounter(schainID));
        outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
    });

    it("should rejected with `Not allowed ERC721 Token` when invoke `transferToSchainERC721`", async () => {
        const error = "Not allowed ERC721 Token";
        const amountToCost = "9000000000000000";
        const tokenId = 10;
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721.address;
        const to = user;
        const schainID = randomString(10);
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
        // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
        // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract(
            "MessageProxyForSchain", messageProxyForSchain.address, {from: deployer});
        await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
        await lockAndDataForSchainERC721
            .addERC721ForSchain(schainID, contractThere, contractHere, {from: deployer});
        // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
        const minterRole = await eRC721OnChain.MINTER_ROLE();
        await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
        // invoke `addExits` to avoid `Does not allow to exit` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.addExits(deployer, 1, {from: deployer});
        // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
        await lockAndDataForSchainERC721.addERC721ForSchain(schainID, eRC721.address, eRC721OnChain.address, {from: deployer});
        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await eRC721OnChain.approve(tokenManager.address, tokenId, {from: deployer});

        // execution:
        await tokenManager
            .transferToSchainERC721(schainID, contractThere, to, tokenId, {from: deployer})
            .should.be.eventually.rejectedWith(error);
    });

    describe("tests for `postMessage` function", async () => {

        it("should rejected with `Not a sender`", async () => {
          //  preparation
          const error = "Not a sender";
          const schainID = randomString(10);
          const amount = 10;
          const bytesData = "0x0";
          const sender = deployer;
          // execution/expectation
          await tokenManager
            .postMessage(sender, chainID, user, amount, bytesData, {from: deployer})
            .should.be.eventually.rejectedWith(error);
        });

        it("should be Error event with message `Receiver chain is incorrect` when schainID=`mainnet`", async () => {
            //  preparation
            const error = "Receiver chain is incorrect";
            // for `Receiver chain is incorrect` message schainID should be `Mainnet`
            const schainID = randomString(10);
            const amount = 10;
            const bytesData = "0x0";
            const sender = deployer;
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await TokenManager.new(schainID, lockAndDataForSchain.address, {from: deployer});
            await lockAndDataForSchain.setContract("MessageProxy", deployer, {from: deployer});
            // execution
            await tokenManager
                .postMessage(sender, chainID, user, amount, bytesData, {from: deployer})
                .should.be.eventually.rejectedWith(error);
        });

        it("should be Error event with message `Invalid data`", async () => {
            //  preparation
            const error = "Invalid data";
            const schainID = randomString(10);
            const amount = 10;
            // for `Invalid data` message bytesData should be `0x`
            const bytesData = "0x";
            const sender = deployer;
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await TokenManager.new(chainID, lockAndDataForSchain.address, {from: deployer});
            // set `tokenManager` contract to avoid the `Not allowed` error in lockAndDataForSchain.sol
            await lockAndDataForSchain
                .setContract("TokenManager", tokenManager.address, {from: deployer});
            // add schain to avoid the `Receiver chain is incorrect` error
            await lockAndDataForSchain
                .addSchain(schainID, deployer, {from: deployer});
            // execution
            await tokenManager
                .postMessage(sender, schainID, user, amount, bytesData, {from: deployer})
                .should.be.eventually.rejectedWith(error);
        });

        it("should transfer eth", async () => {
            //  preparation
            const schainID = randomString(10);
            const amount = "30000000000000000";
            // for transfer eth bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
            const bytesData = "0x01";
            const sender = deployer;
            const to = user;
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await TokenManager.new(chainID, lockAndDataForSchain.address, {from: deployer});
            // set `tokenManager` contract to avoid the `Not allowed` error in lockAndDataForSchain.sol
            await lockAndDataForSchain
                .setContract("TokenManager", tokenManager.address, {from: deployer});
            // add schain to avoid the `Receiver chain is incorrect` error
            await lockAndDataForSchain
                .addSchain(schainID, deployer, {from: deployer});
            // set EthERC20 address:
            await lockAndDataForSchain.setEthErc20Address(ethERC20.address, {from: deployer});
            // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
            await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});
            await lockAndDataForSchain.setContract("MessageProxy", deployer, {from: deployer});
            // execution
            await tokenManager
                .postMessage(sender, schainID, to, amount, bytesData, {from: deployer});
            // expectation
            expect(parseInt((new BigNumber(await ethERC20.balanceOf(to))).toString(), 10))
                .to.be.equal(parseInt(amount, 10));
        });

        it("should rejected with `Incorrect receiver` when `eth` transfer", async () => {
            //  preparation
            const error = "Incorrect receiver";
            const schainID = randomString(10);
            const amount = "30000000000000000";
            // for transfer `eth` bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
            const bytesData = "0x01";
            const sender = deployer;
            const to = "0x0000000000000000000000000000000000000000";
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await TokenManager.new(chainID, lockAndDataForSchain.address, {from: deployer});
            // set `tokenManager` contract to avoid the `Not allowed` error in lockAndDataForSchain.sol
            await lockAndDataForSchain
                .setContract("TokenManager", tokenManager.address, {from: deployer});
            // add schain to avoid the `Receiver chain is incorrect` error
            await lockAndDataForSchain
                .addSchain(schainID, deployer, {from: deployer});
            // set EthERC20 address:
            await lockAndDataForSchain.setEthErc20Address(ethERC20.address, {from: deployer});
            // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
            await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});
            await lockAndDataForSchain.setContract("MessageProxy", deployer, {from: deployer});
            // execution
            await tokenManager
                .postMessage(sender, schainID, to, amount, bytesData, {from: deployer})
                .should.be.eventually.rejectedWith(error);
        });

        it("should transfer ERC20 token", async () => {
            //  preparation
            const schainID = randomString(10);
            const amount = 10;
            const to = user;
            const to0 = "0x0000000000000000000000000000000000000000"; // ERC20 address
            const sender = deployer;
            const data = "0x03" +
            (eRC20.address).substr(2) + "000000000000000000000000" + // contractPosition
            to.substr(2) + "000000000000000000000000" + // receiver
            "000000000000000000000000000000000000000000000000000000000000000a" + // tokenId
            "000000000000000000000000000000000000000000000000000000000000000c" + // token name
            "45524332304f6e436861696e" + // token name
            "0000000000000000000000000000000000000000000000000000000000000005" + // token symbol
            "455243323012" + // token symbol
            "000000000000000000000000000000000000000000000000000000003b9ac9f6"; // total supply

            // add schain to avoid the `Unconnected chain` error
            await lockAndDataForSchain
                .addSchain(schainID, deployer, {from: deployer});
            // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
            await messageProxyForSchain
              .addConnectedChain(schainID, publicKeyArray, {from: deployer});
            // set `ERC20Module` contract before invoke `postMessage`
            await lockAndDataForSchain
              .setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
            // set `LockAndDataERC20` contract before invoke `postMessage`
            await lockAndDataForSchain
              .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
            //
            await lockAndDataForSchain
                .setContract("TokenFactory", tokenFactory.address, {from: deployer});
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await TokenManager.new(chainID, lockAndDataForSchain.address, {from: deployer});
            // set `tokenManager` contract before invoke `postMessage`
            await lockAndDataForSchain
              .setContract("TokenManager", tokenManager.address, {from: deployer});
            // set EthERC20 address:
            await lockAndDataForSchain.setEthErc20Address(ethERC20.address, {from: deployer});
            // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
            await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});
            await lockAndDataForSchain.setContract("MessageProxy", deployer, {from: deployer});

            await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID, {from: deployer});
            // execution
            await tokenManager
              .postMessage(sender, schainID, to0, amount, data, {from: deployer});
            // expectation
            expect(parseInt((new BigNumber(await ethERC20.balanceOf(to))).toString(), 10))
                .to.be.equal(amount);
        });

        it("should transfer ERC721 token", async () => {
            //  preparation
            const schainID = randomString(10);
            const amount = 10;
            const to = user;
            const to0 = "0x0000000000000000000000000000000000000000"; // ERC20 address
            const sender = deployer;
            const data = "0x05" +
            (eRC721.address).substr(2) + "000000000000000000000000" + // contractPosition
            to.substr(2) + "000000000000000000000000" + // receiver
            "0000000000000000000000000000000000000000000000000000000000000002" + // tokenId
            "000000000000000000000000000000000000000000000000000000000000000d" + // token name
            "4552433732314f6e436861696e" + // token name
            "0000000000000000000000000000000000000000000000000000000000000006" + // token symbol
            "455243373231"; // token symbol
            // add schain to avoid the `Unconnected chain` error
            await lockAndDataForSchain
                .addSchain(schainID, deployer, {from: deployer});
            // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
            await messageProxyForSchain
                .addConnectedChain(schainID, publicKeyArray, {from: deployer});
            // set `ERC721Module` contract before invoke `receiveERC721`
            await lockAndDataForSchain
                .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});
            // set `LockAndDataERC721` contract before invoke `receiveERC721`
            await lockAndDataForSchain
                .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});
            //
            await lockAndDataForSchain
            .setContract("TokenFactory", tokenFactory.address, {from: deployer});
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await TokenManager.new(chainID, lockAndDataForSchain.address, {from: deployer});
            // set `tokenManager` contract before invoke `postMessage`
            await lockAndDataForSchain
              .setContract("TokenManager", tokenManager.address, {from: deployer});
            // set EthERC20 address:
            await lockAndDataForSchain.setEthErc20Address(ethERC20.address, {from: deployer});
            // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
            await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});
            await lockAndDataForSchain.setContract("MessageProxy", deployer, {from: deployer});
            await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID, {from: deployer});
            // execution
            await tokenManager
              .postMessage(sender, schainID, to0, amount, data, {from: deployer});
            // expectation
            expect(parseInt((new BigNumber(await ethERC20.balanceOf(to))).toString(), 10))
                .to.be.equal(amount);
        });
    });

});
