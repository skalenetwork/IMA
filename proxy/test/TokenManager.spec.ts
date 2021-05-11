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

import { BigNumber } from "ethers";
import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import { expect } from "chai";
import { randomString } from "./utils/helper";
import { artifacts } from "hardhat";
import { TokenManager, MessageProxyForSchain, EthERC20, LockAndDataForSchainWorkaround, LockAndDataForSchainERC20, ERC20ModuleForSchain, ERC20OnChain, ERC721OnChain, ERC721ModuleForSchain, LockAndDataForSchainERC721, TokenFactory, MessagesTester } from "../typechain";
import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

chai.should();
chai.use((chaiAsPromised));

import { deployLockAndDataForSchainWorkaround } from "./utils/deploy/test/lockAndDataForSchainWorkaround";
import { deployLockAndDataForSchainERC20 } from "./utils/deploy/schain/lockAndDataForSchainERC20";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployLockAndDataForSchainERC721 } from "./utils/deploy/schain/lockAndDataForSchainERC721";
import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";
import { deployERC20ModuleForSchain } from "./utils/deploy/schain/erc20ModuleForSchain";
import { deployERC721ModuleForSchain } from "./utils/deploy/schain/erc721ModuleForSchain";
import { deployTokenFactory } from "./utils/deploy/schain/tokenFactory";
import { deployTokenManager } from "./utils/deploy/schain/tokenManager";
import { deployMessageProxyForSchain } from "./utils/deploy/schain/messageProxyForSchain";
import { deployEthERC20 } from "./utils/deploy/schain/ethERC20";
import { deployMessages } from "./utils/deploy/messages";

import ABIERC721MintAndBurn = require("../artifacts/contracts/schain/LockAndDataForSchainERC721.sol/ERC721MintAndBurn.json");
import ABIERC20MintAndBurn = require("../artifacts/contracts/schain/LockAndDataForSchainERC20.sol/ERC20MintAndBurn.json");

describe("TokenManager", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let client: SignerWithAddress;

    let tokenManager: TokenManager;
    let messageProxyForSchain: MessageProxyForSchain;
    let ethERC20: EthERC20;
    let lockAndDataForSchain: LockAndDataForSchainWorkaround;
    let lockAndDataForSchainERC20: LockAndDataForSchainERC20;
    let eRC20ModuleForSchain: ERC20ModuleForSchain;
    let eRC20OnChain: ERC20OnChain;
    let eRC20: ERC20OnChain;
    let eRC721OnChain: ERC721OnChain;
    let eRC721: ERC721OnChain;
    let eRC721ModuleForSchain: ERC721ModuleForSchain;
    let lockAndDataForSchainERC721: LockAndDataForSchainERC721;
    let tokenFactory: TokenFactory;
    let messages: MessagesTester;

    const publicKeyArray = [
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
    ];

    const chainID = randomString(10);

    before(async () => {
        [deployer, user, client] = await ethers.getSigners();
    })

    beforeEach(async () => {
        messageProxyForSchain = await deployMessageProxyForSchain(chainID);
        lockAndDataForSchain = await deployLockAndDataForSchainWorkaround();
        await lockAndDataForSchain.setContract("MessageProxy", messageProxyForSchain.address);
        tokenManager = await deployTokenManager(chainID, lockAndDataForSchain);
        ethERC20 = await deployEthERC20();
        lockAndDataForSchainERC20 = await deployLockAndDataForSchainERC20(lockAndDataForSchain);
        eRC20ModuleForSchain = await deployERC20ModuleForSchain(lockAndDataForSchain);
        eRC20OnChain = await deployERC20OnChain("ERC20", "ERC20");
        eRC20 = await deployERC20OnChain("SKALE", "SKL");
        eRC721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721");
        eRC721 = await deployERC721OnChain("eRC721", "ERC721");
        eRC721ModuleForSchain = await deployERC721ModuleForSchain(lockAndDataForSchain);
        lockAndDataForSchainERC721 = await deployLockAndDataForSchainERC721(lockAndDataForSchain);
        tokenFactory = await deployTokenFactory(lockAndDataForSchain);
        messages = await deployMessages();
        await lockAndDataForSchainERC20.enableAutomaticDeploy("Mainnet");
        await lockAndDataForSchainERC721.enableAutomaticDeploy("Mainnet");
    });

    it("should send Eth to somebody on Mainnet, closed to Mainnet, called by schain", async () => {
        const amount = BigNumber.from("600000000000000000");
        const amountTo = BigNumber.from("20000000000000000");
        const amountTo2 = BigNumber.from("60000000000000000");
        const amountAfter = BigNumber.from("540000000000000000");
        const to = deployer;

        // set EthERC20 address:
        await lockAndDataForSchain.setEthErc20Address(ethERC20.address);

        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);

        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchain.address);

        // send Eth:
        await lockAndDataForSchain.sendEth(user.address, amount);

        // send Eth to a client on Mainnet:
        await tokenManager.connect(user).exitToMain(to.address, amountTo).should.be.eventually.rejectedWith("Not enough funds to exit");
        await tokenManager.connect(user).exitToMain(to.address, amountTo2);
        const balanceAfter = await ethERC20.balanceOf(user.address);
        balanceAfter.should.be.deep.equal(amountAfter);
    });

    it("should transfer to somebody on schain Eth and some data", async () => {
        const amount = BigNumber.from("20000000000000000");
        const amountTo = BigNumber.from("2000000000000000");
        const amountAfter = BigNumber.from("18000000000000000");
        const bytesData = "0x0";
        const to = deployer;

        // set EthERC20 address:
        await lockAndDataForSchain.setEthErc20Address(ethERC20.address);

        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);

        // add connected chain:
        await messageProxyForSchain.addConnectedChain(chainID);

        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchain.address);

        // send Eth:
        await lockAndDataForSchain.sendEth(user.address, amount);

        // add schain:
        await lockAndDataForSchain.addSchain(chainID, user.address);

        // send Eth and data to a client on schain:
        await tokenManager.connect(user).transferToSchain(chainID, to.address, amountTo);

        const balanceAfter = BigNumber.from(await ethERC20.balanceOf(user.address));
        balanceAfter.should.be.deep.equal(amountAfter);
    });

    it("should rejected with `Not allowed ERC20 Token` when invoke `exitToMainERC20`", async () => {
        const error = "Not allowed ERC20 Token";
        const amount = BigNumber.from(200);
        const amountTo = BigNumber.from(20);
        const amountEth = BigNumber.from("60000000000000000");
        //
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address);
        await lockAndDataForSchain.setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
        // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
        const minterRole = await eRC20OnChain.MINTER_ROLE();
        await eRC20OnChain.grantRole(minterRole, lockAndDataForSchainERC20.address);
        //
        await lockAndDataForSchainERC20.addERC20ForSchain("Mainnet", eRC20.address, eRC20OnChain.address);
        await lockAndDataForSchainERC20.setTotalSupplyOnMainnet(eRC20OnChain.address, 199);
        await lockAndDataForSchainERC20.sendERC20(eRC20OnChain.address, user.address, amount).should.be.eventually.rejectedWith("Total supply exceeded");
        await lockAndDataForSchainERC20.setTotalSupplyOnMainnet(eRC20OnChain.address, 200);
        await lockAndDataForSchainERC20.sendERC20(eRC20OnChain.address, user.address, amount);
        //
        await eRC20OnChain.connect(user).approve(tokenManager.address, amountTo);
        // // execution/expectation
        await tokenManager.exitToMainERC20(eRC20.address, client.address, amountTo)
            .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `exitToMainERC20` without mistakes", async () => {
        const amount = "20000000000000000";
        const amountMint =    "10000000000000000";
        const amountToCost = "9000000000000000";
        const amountReduceCost = "8000000000000000";
        const amountEth = BigNumber.from("60000000000000000");

        // set EthERC20 address:
        await lockAndDataForSchain.setEthErc20Address(ethERC20.address);
        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchain.address);
        // send Eth:
        await lockAndDataForSchain.sendEth(user.address, amountEth);

        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);

        // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address);

        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);

        // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
        // await lockAndDataForSchain.setContract(
        // "MessageProxyForSchain", messageProxyForSchain.address);

        // add connected chain:
        // await messageProxyForSchain.addConnectedChain(chainID);

        // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
        // const minterRole = await eRC20OnChain.MINTER_ROLE();
        // await eRC20OnChain.grantRole(minterRole, lockAndDataForSchainERC20.address);

        await lockAndDataForSchain.setContract("ERC20Module", deployer.address);

        // // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
        // await eRC20OnChain.setTotalSupplyOnMainnet(amount);

        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC20OnChain.mint(user.address, amountMint);

        // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
       await lockAndDataForSchainERC20.addERC20ForSchain("Mainnet", eRC20.address, eRC20OnChain.address);

        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await eRC20OnChain.connect(user).approve(tokenManager.address, amountMint);

        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address);

        // add schain:
        // await lockAndDataForSchain.addSchain(chainID, tokenManager.address);

        // execution:
        const res = await tokenManager
            .connect(user)
            .exitToMainERC20(eRC20.address, client.address, amountReduceCost);

        // // expectation:
        const outgoingMessagesCounterMainnet = BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet"));
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    it("should not receive ETH", async () => {
        await web3.eth.sendTransaction({from: deployer.address, to: tokenManager.address, value: "1000000000000000000"})
            .should.be.eventually.rejected;
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
        const amountReduceCost = "800000000000000000";
        const schainID = randomString(10);
        await lockAndDataForSchain.addSchain(schainID, tokenManager.address);
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);
        // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address);
        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
        // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
        // await eRC20OnChain.setTotalSupplyOnMainnet(amount);
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC20OnChain.mint(deployer.address, amountMint);

        await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID);

        // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
        await lockAndDataForSchainERC20.addERC20ForSchain(schainID, eRC20.address, eRC20OnChain.address);
        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await eRC20OnChain.approve(tokenManager.address, amountMint);

        // execution:
        await tokenManager
            .transferToSchainERC20(schainID, eRC20.address, client.address, amountReduceCost)
            .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `transferToSchainERC20` without mistakes", async () => {
        const amount =            "20000000000000000";
        const amountMint =        "10000000000000000";
        const amountToCost =      "9000000000000000";
        const amountReduceCost = "8000000000000000";
        const schainID = randomString(10);
        await lockAndDataForSchain.addSchain(schainID, tokenManager.address);
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);
        // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address);
        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
        // add connected chain:
        await messageProxyForSchain.addConnectedChain(schainID);
        // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
        // await eRC20OnChain.setTotalSupplyOnMainnet(amount);
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC20OnChain.mint(deployer.address, amountMint);

        await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID);
        // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
        await lockAndDataForSchainERC20.addERC20ForSchain(schainID, eRC20.address, eRC20OnChain.address);
        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await eRC20OnChain.approve(tokenManager.address, amountMint);

        // execution:
        await tokenManager
            .transferToSchainERC20(schainID, eRC20.address, client.address, amountReduceCost);
        // expectation:
        const outgoingMessagesCounterMainnet = BigNumber.from(
            await messageProxyForSchain.getOutgoingMessagesCounter(schainID));
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    it("should rejected with `Not allowed ERC721 Token` when invoke `exitToMainERC721`", async () => {
        const error = "Not allowed ERC721 Token";
        const amountToCost = "9000000000000000";
        const tokenId = 10;
        const tokenId2 = 11;
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);
        // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address);
        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
        // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract(
            "MessageProxyForSchain", messageProxyForSchain.address);
        // add connected chain:
        await lockAndDataForSchainERC721.addERC721ForSchain("Mainnet", eRC20.address, eRC20OnChain.address);
        // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
        const minterRole = await eRC721OnChain.MINTER_ROLE();
        await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer.address, tokenId);
        await eRC721OnChain.mint(deployer.address, tokenId2);
        // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
        await lockAndDataForSchainERC721.addERC721ForSchain("Mainnet", eRC721.address, eRC721OnChain.address);
        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await eRC721OnChain.approve(tokenManager.address, tokenId);

        // execution:
        await tokenManager
            .exitToMainERC721(eRC721.address, client.address, tokenId2)
            .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `exitToMainERC721` without mistakes", async () => {
        const amountToCost = "9000000000000000";
        const tokenId = 10;
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721.address;
        const to = user.address;
        const amountEth = BigNumber.from("60000000000000000");
        // set EthERC20 address:
        await lockAndDataForSchain.setEthErc20Address(ethERC20.address);
        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchain.address);
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);
        // to avoid "Message sender is invalid" error
        await lockAndDataForSchain
            .setContract("ERC721Module", eRC721ModuleForSchain.address);
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
        // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract(
            "MessageProxyForSchain", messageProxyForSchain.address);
        await lockAndDataForSchainERC721.addERC721ForSchain("Mainnet", contractThere, contractHere);
        // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
        const minterRole = await eRC721OnChain.MINTER_ROLE();
        await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC721OnChain.mint(user.address, tokenId);
        // invoke `addExit` to avoid `Does not allow to exit` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.sendEth(user.address, amountEth);
        await eRC721OnChain.connect(user).approve(tokenManager.address, tokenId);

        // execution:
        await tokenManager.connect(user).exitToMainERC721(contractThere, to, tokenId);
        // expectation:
        const outgoingMessagesCounterMainnet = BigNumber.from(await messageProxyForSchain
            .getOutgoingMessagesCounter("Mainnet"));
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    it("should invoke `transferToSchainERC721` without mistakes", async () => {
        const amountToCost = "9000000000000000";
        const tokenId = 10;
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721.address;
        const to = user.address;
        const schainID = randomString(10);
        await lockAndDataForSchain.addSchain(schainID, tokenManager.address);
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);
        // to avoid "Message sender is invalid" error
        await lockAndDataForSchain
            .setContract("ERC721Module", eRC721ModuleForSchain.address);
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
        // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract(
            "MessageProxyForSchain", messageProxyForSchain.address);
        // add connected chain:
        await messageProxyForSchain.addConnectedChain(schainID);
        await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID);
        await lockAndDataForSchainERC721
            .addERC721ForSchain(schainID, contractThere, contractHere);
        // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
        const minterRole = await eRC721OnChain.MINTER_ROLE();
        await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer.address, tokenId);

        await eRC721OnChain.approve(tokenManager.address, tokenId);

        // execution:
        const res = await tokenManager
            .transferToSchainERC721(schainID, contractThere, to, tokenId);
        // expectation:
        const outgoingMessagesCounter = BigNumber.from(await messageProxyForSchain
            .getOutgoingMessagesCounter(schainID));
        outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
    });

    it("should rejected with `Not allowed ERC721 Token` when invoke `transferToSchainERC721`", async () => {
        const error = "Not allowed ERC721 Token";
        const amountToCost = "9000000000000000";
        const tokenId = 10;
        const tokenId2 = 11;
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721.address;
        const to = user.address;
        const schainID = randomString(10);
        await lockAndDataForSchain.addSchain(schainID, tokenManager.address);
        await messageProxyForSchain.addConnectedChain(schainID)
        // set contract TokenManager to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);
        // set contract ERC20ModuleForSchain to avoid `revert` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address);
        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exception on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
        // set contract MessageProxy to avoid `Not allowed` exception on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract(
            "MessageProxyForSchain", messageProxyForSchain.address);
        await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID);
        await lockAndDataForSchainERC721
            .addERC721ForSchain(schainID, contractThere, contractHere);
        // invoke `grantRole` before `sendERC721` to avoid `MinterRole: caller does not have the Minter role`  exception
        const minterRole = await eRC721OnChain.MINTER_ROLE();
        await eRC721OnChain.grantRole(minterRole, lockAndDataForSchainERC721.address);
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer.address, tokenId);
        await eRC721OnChain.mint(deployer.address, tokenId2);
        // invoke `addERC20ForSchain` to avoid `Not existing ERC-20 contract` exception on `exitToMainERC20` function:
        await lockAndDataForSchainERC721.addERC721ForSchain(schainID, eRC721.address, eRC721OnChain.address);
        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await eRC721OnChain.approve(tokenManager.address, tokenId);

        // execution:
        await tokenManager
            .transferToSchainERC721(schainID, contractThere, to, tokenId2)
            .should.be.eventually.rejectedWith(error);
    });

    describe("tests for `postMessage` function", async () => {

        it("should rejected with `Not a sender`", async () => {
          //  preparation
          const error = "Not a sender";
          const schainID = randomString(10);
          const amount = 10;
          const bytesData = await messages.encodeTransferEthMessage(user.address, amount);

          const sender = deployer.address;
          // execution/expectation
          await tokenManager
            .postMessage(chainID, sender, bytesData)
            .should.be.eventually.rejectedWith(error);
        });

        it("should be Error event with message `Receiver chain is incorrect` when schainID=`mainnet`", async () => {
            //  preparation
            const error = "Receiver chain is incorrect";
            // for `Receiver chain is incorrect` message schainID should be `Mainnet`
            const schainID = randomString(10);
            const amount = 10;
            const bytesData = await messages.encodeTransferEthMessage(user.address, amount);
            const sender = deployer.address;
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await deployTokenManager(schainID, lockAndDataForSchain);
            await lockAndDataForSchain.setContract("MessageProxy", deployer.address);
            // execution
            await tokenManager
                .postMessage(chainID, sender, bytesData)
                .should.be.eventually.rejectedWith(error);
        });

        it("should be Error event with message `Invalid data`", async () => {
            //  preparation
            const error = "Invalid data";
            const schainID = randomString(10);
            const amount = 10;
            // for `Invalid data` message bytesData should be `0x`
            const bytesData = "0x";
            const sender = deployer.address;
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await deployTokenManager(chainID, lockAndDataForSchain);
            // set `tokenManager` contract to avoid the `Not allowed` error in lockAndDataForSchain.sol
            await lockAndDataForSchain
                .setContract("TokenManager", tokenManager.address);
            // add schain to avoid the `Receiver chain is incorrect` error
            await lockAndDataForSchain
                .addSchain(schainID, deployer.address);
            // execution
            await tokenManager
                .postMessage(schainID, sender, bytesData)
                .should.be.eventually.rejectedWith(error);
        });

        it("should transfer eth", async () => {
            //  preparation
            const schainID = randomString(10);
            const amount = "30000000000000000";
            const sender = deployer.address;
            const to = user.address;
            // for transfer eth bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
            const bytesData = await messages.encodeTransferEthMessage(to, amount);
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await deployTokenManager(chainID, lockAndDataForSchain);
            // set `tokenManager` contract to avoid the `Not allowed` error in lockAndDataForSchain.sol
            await lockAndDataForSchain
                .setContract("TokenManager", tokenManager.address);
            // add schain to avoid the `Receiver chain is incorrect` error
            await lockAndDataForSchain
                .addSchain(schainID, deployer.address);
            // set EthERC20 address:
            await lockAndDataForSchain.setEthErc20Address(ethERC20.address);
            // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
            await ethERC20.transferOwnership(lockAndDataForSchain.address);
            await lockAndDataForSchain.setContract("MessageProxy", deployer.address);
            // execution
            await tokenManager
                .postMessage(schainID, sender, bytesData);
            // expectation
            expect(parseInt((BigNumber.from(await ethERC20.balanceOf(to))).toString(), 10))
                .to.be.equal(parseInt(amount, 10));
        });

        it("should add funds to communityPool when `eth` transfer", async () => {
            // TODO: Remove if this test is not actual
            //  preparation
            const error = "Incorrect receiver";
            const schainID = randomString(10);
            const amount = "30000000000000000";
            // for transfer `eth` bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
            const to = "0x0000000000000000000000000000000000000000";
            const bytesData = await messages.encodeTransferEthMessage(to, amount);;
            const sender = deployer.address;
            // const communityPoolBefore = BigNumber.from(await lockAndDataForSchain.communityPool());
            // communityPoolBefore.should.be.deep.equal(BigNumber.from(0));
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await deployTokenManager(chainID, lockAndDataForSchain);
            // set `tokenManager` contract to avoid the `Not allowed` error in lockAndDataForSchain.sol
            await lockAndDataForSchain
                .setContract("TokenManager", tokenManager.address);
            // add schain to avoid the `Receiver chain is incorrect` error
            await lockAndDataForSchain
                .addSchain(schainID, deployer.address);
            // set EthERC20 address:
            await lockAndDataForSchain.setEthErc20Address(ethERC20.address);
            // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
            await ethERC20.transferOwnership(lockAndDataForSchain.address);
            await lockAndDataForSchain.setContract("MessageProxy", deployer.address);
            // execution
            await tokenManager
                .postMessage(schainID, sender, bytesData)
                .should.be.eventually.rejectedWith(error);
            // const communityPoolAfter = BigNumber.from(await lockAndDataForSchain.communityPool());
            // communityPoolAfter.should.be.deep.equal(BigNumber.from(amount));
        });

        it("should transfer ERC20 token", async () => {
            //  preparation
            const schainID = randomString(10);
            const amount = 10;
            const to = user.address;
            const sender = deployer.address;
            await eRC20.mint(deployer.address, amount);
            const data = await messages.encodeTransferErc20AndTokenInfoMessage(
                eRC20.address,
                to,
                amount,
                (await eRC20.totalSupply()).toNumber(),
                {
                    name: await eRC20.name(),
                    symbol: await eRC20.symbol(),
                    decimals: BigNumber.from(await eRC20.decimals()).toNumber()
                }
            );
            // add schain to avoid the `Unconnected chain` error
            await lockAndDataForSchain
                .addSchain(schainID, deployer.address);
            // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
            await messageProxyForSchain
              .addConnectedChain(schainID);
            // set `ERC20Module` contract before invoke `postMessage`
            await lockAndDataForSchain
              .setContract("ERC20Module", eRC20ModuleForSchain.address);
            // set `LockAndDataERC20` contract before invoke `postMessage`
            await lockAndDataForSchain
              .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
            //
            await lockAndDataForSchain
                .setContract("TokenFactory", tokenFactory.address);
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await deployTokenManager(chainID, lockAndDataForSchain);
            // set `tokenManager` contract before invoke `postMessage`
            await lockAndDataForSchain
              .setContract("TokenManager", tokenManager.address);
            // set EthERC20 address:
            await lockAndDataForSchain.setEthErc20Address(ethERC20.address);
            // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
            await ethERC20.transferOwnership(lockAndDataForSchain.address);
            await lockAndDataForSchain.setContract("MessageProxy", deployer.address);

            await lockAndDataForSchainERC20.enableAutomaticDeploy(schainID);
            // execution
            await tokenManager.postMessage(schainID, sender, data);
            // expectation
            const addressERC20OnSchain = await lockAndDataForSchainERC20.getERC20OnSchain(schainID, eRC20.address);
            const erc20OnChain = new web3.eth.Contract(ABIERC20MintAndBurn.abi, addressERC20OnSchain);
            expect(parseInt((BigNumber.from(await erc20OnChain.methods.balanceOf(to).call())).toString(), 10))
                .to.be.equal(amount);
        });

        it("should transfer ERC721 token", async () => {
            //  preparation
            const schainID = randomString(10);
            const amount = 10;
            const to = user.address;
            const to0 = "0x0000000000000000000000000000000000000000"; // ERC20 address
            const sender = deployer.address;
            const tokenId = 2;
            const data = await messages.encodeTransferErc721AndTokenInfoMessage(
                eRC721.address,
                to,
                tokenId,
                {
                    name: await eRC721.name(),
                    symbol: await eRC721.symbol()
                }
            );
            // add schain to avoid the `Unconnected chain` error
            await lockAndDataForSchain
                .addSchain(schainID, deployer.address);
            // add connected chain to avoid the `Destination chain is not initialized` error in MessageProxy.sol
            await messageProxyForSchain
                .addConnectedChain(schainID);
            // set `ERC721Module` contract before invoke `receiveERC721`
            await lockAndDataForSchain
                .setContract("ERC721Module", eRC721ModuleForSchain.address);
            // set `LockAndDataERC721` contract before invoke `receiveERC721`
            await lockAndDataForSchain
                .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
            //
            await lockAndDataForSchain
            .setContract("TokenFactory", tokenFactory.address);
            // redeploy tokenManager with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManager = await deployTokenManager(chainID, lockAndDataForSchain);
            // set `tokenManager` contract before invoke `postMessage`
            await lockAndDataForSchain
              .setContract("TokenManager", tokenManager.address);
            // set EthERC20 address:
            await lockAndDataForSchain.setEthErc20Address(ethERC20.address);
            // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
            await ethERC20.transferOwnership(lockAndDataForSchain.address);
            await lockAndDataForSchain.setContract("MessageProxy", deployer.address);
            await lockAndDataForSchainERC721.enableAutomaticDeploy(schainID);
            // execution
            await tokenManager.postMessage(schainID, sender, data);
            // expectation
            const addressERC721OnSchain = await lockAndDataForSchainERC721.getERC721OnSchain(schainID, eRC721.address);
            const erc721OnChain = new web3.eth.Contract(ABIERC721MintAndBurn.abi, addressERC721OnSchain);
            expect(await erc721OnChain.methods.ownerOf(tokenId).call()).to.be.equal(to);
        });
    });

});
