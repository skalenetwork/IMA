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
 * @file tokenManagerErc20.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    ERC20OnChain,
    MessagesTester,
    TokenManagerERC20,
    TokenManagerLinker,
    MessageProxyForSchainTester,
    CommunityLocker
} from "../typechain";

import { randomString, stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

import { deployTokenManagerERC20 } from "./utils/deploy/schain/tokenManagerERC20";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployMessages } from "./utils/deploy/messages";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

describe("TokenManagerERC20", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

    const mainnetName = "Mainnet";
    const schainName = "D2-chain";
    const schainId = stringValue(web3.utils.soliditySha3(schainName));
    const mainnetId = stringValue(web3.utils.soliditySha3("Mainnet"));
    let fakeDepositBox: string;
    let fakeCommunityPool: any;
    let erc20OnChain: ERC20OnChain;
    let eRC20OnChain2: ERC20OnChain;
    let erc20OnMainnet: ERC20OnChain;
    let eRC20OnMainnet2: ERC20OnChain;
    let messageProxyForSchain: MessageProxyForSchainTester;
    let tokenManagerLinker: TokenManagerLinker;
    let tokenManagerErc20: TokenManagerERC20;
    let messages: MessagesTester;
    let communityLocker: CommunityLocker;

    before(async () => {
        [deployer, user, schainOwner] = await ethers.getSigners();
    });

    beforeEach(async () => {
        erc20OnChain = await deployERC20OnChain("ERC20OnChain", "ERC20");
        erc20OnMainnet = await deployERC20OnChain("SKALE", "SKL");
        messages = await deployMessages();
        fakeDepositBox = messages.address;
        fakeCommunityPool = messages.address;

        const keyStorage = await deployKeyStorageMock();
        messageProxyForSchain = await deployMessageProxyForSchainTester(keyStorage.address, schainName);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, deployer.address);
        communityLocker = await deployCommunityLocker(schainName, messageProxyForSchain.address, tokenManagerLinker, fakeCommunityPool);
        tokenManagerErc20 = await deployTokenManagerERC20(schainName, messageProxyForSchain.address, tokenManagerLinker, communityLocker, fakeDepositBox);
        await erc20OnChain.connect(deployer).grantRole(await erc20OnChain.MINTER_ROLE(), tokenManagerErc20.address);
        await tokenManagerLinker.registerTokenManager(tokenManagerErc20.address);

        await tokenManagerErc20.connect(deployer).grantRole(await tokenManagerErc20.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        await tokenManagerErc20.connect(deployer).grantRole(await tokenManagerErc20.AUTOMATIC_DEPLOY_ROLE(), schainOwner.address);
        const data = await messages.encodeActivateUserMessage(user.address);
        await messageProxyForSchain.postMessage(communityLocker.address, mainnetId, fakeCommunityPool, data);

        const extraContractRegistrarRole = await messageProxyForSchain.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
    });

    it("should change depositBox address", async () => {
        const newDepositBox = user.address;
        expect(await tokenManagerErc20.depositBox()).to.equal(fakeDepositBox);
        await tokenManagerErc20.connect(user).changeDepositBoxAddress(newDepositBox)
            .should.be.eventually.rejectedWith("DEFAULT_ADMIN_ROLE is required");
        await tokenManagerErc20.connect(deployer).changeDepositBoxAddress(newDepositBox);
        expect(await tokenManagerErc20.depositBox()).to.equal(newDepositBox);
    });

    it("should reject on exit if there is no mainnet token clone on schain", async () => {
        // preparation
        const error = "No token clone on schain";
        const to = user.address;
        const amount = 10;
        // execution/expectation
        await tokenManagerErc20.connect(user).exitToMainERC20(deployer.address, amount)
            .should.be.eventually.rejectedWith(error);
    });

    it("should send ERC20 token twice", async () => {
        // preparation
        const to = user.address;
        const amount = 10;
        const name = "D2 token";
        const symbol = "D2";
        const totalSupply = 1e9;

        const data = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, { name, symbol, decimals: 18 });
        const data2 = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, { name, symbol, decimals: 18 });

        await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
        // execution
        const res = await (await messageProxyForSchain.postMessage(tokenManagerErc20.address, mainnetId, fakeDepositBox, data)).wait();

        let newAddress: string;
        // TODO: use waffle
        if (!res.events) {
            assert("No events were emitted");
        } else {
            newAddress = "0x" + res.events[res.events.length - 1].topics[3].slice(-40);
            const newERC20Contract = await (await ethers.getContractFactory("ERC20OnChain")).attach(newAddress) as ERC20OnChain;
            let balance = await newERC20Contract.functions.balanceOf(to);
            parseInt(balance.toString(), 10).should.be.equal(amount);
            // expectation
            await messageProxyForSchain.postMessage(tokenManagerErc20.address, mainnetId, fakeDepositBox, data2);
            balance = await newERC20Contract.functions.balanceOf(to);
            parseInt(balance.toString(), 10).should.be.equal(amount * 2);
        }
    });

    it("should reject with `Insufficient funds` if token balance is too low", async () => {
        // preparation
        const error = "insufficient funds";
        const amount = 10;
        // execution/expectation
        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  erc20OnMainnet.address, erc20OnChain.address);

        await erc20OnChain.connect(user).approve(tokenManagerErc20.address, amount);
        await tokenManagerErc20
            .connect(user)
            .exitToMainERC20(erc20OnMainnet.address, amount)
            .should.be.eventually.rejectedWith(error);
    });

    it("should add token by owner", async () => {
        // preparation
        const addressERC20 = erc20OnChain.address;
        const addressERC201 = erc20OnMainnet.address;
        const automaticDeploy = await tokenManagerErc20.automaticDeploy();
        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  addressERC201, addressERC20);
        // automaticDeploy == true - enabled automaticDeploy = false - disabled
        if (automaticDeploy) {
            await tokenManagerErc20.connect(schainOwner).disableAutomaticDeploy();
        } else {
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
        }

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  addressERC201, addressERC20).should.be.eventually.rejectedWith("Could not relink clone");

        eRC20OnChain2 = await deployERC20OnChain("NewToken", "NTN");
        const eRC20OnChain3 = await deployERC20OnChain("NewToken2", "NTN2");
        eRC20OnMainnet2 = await deployERC20OnChain("NewToken", "NTN");
        const eRC20OnMainnet3 = await deployERC20OnChain("NewToken2", "NTN2");

        if (automaticDeploy) {
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
        } else {
            await tokenManagerErc20.connect(schainOwner).disableAutomaticDeploy();
        }

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  eRC20OnMainnet2.address, eRC20OnChain2.address);

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  eRC20OnMainnet2.address, deployer.address)
            .should.be.eventually.rejectedWith("Given address is not a contract");

        await eRC20OnChain2.mint(user.address, 1);
        await eRC20OnChain3.mint(user.address, 1);

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  eRC20OnMainnet3.address, addressERC20)
            .should.be.eventually.rejectedWith("Clone was already added");

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  eRC20OnMainnet3.address, eRC20OnChain3.address)
            .should.be.eventually.rejectedWith("TotalSupply is not zero");

    });

    it("should reject with `Transfer is not approved by token holder` when invoke `exitToMainERC20`", async () => {
        const error = "Transfer is not approved by token holder";
        const amount = 20;
        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  erc20OnMainnet.address, erc20OnChain.address);

        // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
        const minterRole = await erc20OnChain.MINTER_ROLE();
        await erc20OnChain.mint(user.address, amount * 2);
        await erc20OnChain.connect(deployer).grantRole(minterRole, tokenManagerErc20.address);
        //
        await erc20OnChain.connect(user).approve(tokenManagerErc20.address, amount / 2);
        // execution/expectation
        await tokenManagerErc20.connect(user).exitToMainERC20(erc20OnMainnet.address, amount)
            .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `exitToMainERC20` without mistakes", async () => {
        const amount = "20000000000000000";
        const amountMint = "10000000000000000";
        const amountToCost = "9000000000000000";
        const amountReduceCost = "8000000000000000";
        const amountEth = BigNumber.from("60000000000000000");
        await messageProxyForSchain.registerExtraContract("Mainnet", tokenManagerErc20.address);
        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  erc20OnMainnet.address, erc20OnChain.address);

        await erc20OnChain.connect(deployer).mint(user.address, amountMint);
        await erc20OnChain.connect(user).approve(tokenManagerErc20.address, amountMint);

        // execution:
        await tokenManagerErc20
            .connect(user)
            .exitToMainERC20(erc20OnMainnet.address, amountReduceCost);

        // // expectation:
        const outgoingMessagesCounterMainnet = BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet"));
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    describe("tests for transferToSchainERC20", async () => {

        let erc20OnOriginChain: ERC20OnChain;
        let erc20OnTargetChain: ERC20OnChain;
        let messageProxyForSchain2: MessageProxyForSchainTester;
        let tokenManagerLinker2: TokenManagerLinker;
        let tokenManagerErc202: TokenManagerERC20;
        let communityLocker2: CommunityLocker;
        const newSchainName = "NewChain";
        const newSchainId = stringValue(web3.utils.soliditySha3(newSchainName));

        beforeEach(async () => {
            erc20OnOriginChain = await deployERC20OnChain("NewToken", "NTN");
            erc20OnTargetChain = await deployERC20OnChain("NewToke1n", "NTN1");

            const keyStorage2 = await deployKeyStorageMock();
            messageProxyForSchain2 = await deployMessageProxyForSchainTester(keyStorage2.address, newSchainName);
            tokenManagerLinker2 = await deployTokenManagerLinker(messageProxyForSchain2, deployer.address);
            communityLocker2 = await deployCommunityLocker(newSchainName, messageProxyForSchain2.address, tokenManagerLinker2, fakeCommunityPool);
            tokenManagerErc202 = await deployTokenManagerERC20(newSchainName, messageProxyForSchain2.address, tokenManagerLinker2, communityLocker2, fakeDepositBox);
            await erc20OnTargetChain.connect(deployer).grantRole(await erc20OnTargetChain.MINTER_ROLE(), tokenManagerErc202.address);
            await tokenManagerLinker2.registerTokenManager(tokenManagerErc202.address);
        });

        it("should invoke `transferToSchainERC20` without mistakes", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerErc20.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, tokenManagerErc202.address);

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should invoke `transferToSchainERC20` and receive tokens without mistakes", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerErc20.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, tokenManagerErc202.address);

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            const data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnOriginChain.address,
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: BigNumber.from(await erc20OnOriginChain.decimals()).toString()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, tokenManagerErc20.address);


            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerErc202.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            const addressERC20OnSchain = await tokenManagerErc202.clonesErc20(schainId, erc20OnOriginChain.address);
            const targetErc20OnChain = await (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect((await targetErc20OnChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

        });

        it("should invoke `transferToSchainERC20` and receive tokens without mistakes double", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerErc20.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, tokenManagerErc202.address);

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnOriginChain.address,
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: BigNumber.from(await erc20OnOriginChain.decimals()).toString()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, tokenManagerErc20.address);


            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerErc202.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            const addressERC20OnSchain = await tokenManagerErc202.clonesErc20(schainId, erc20OnOriginChain.address);
            const targetErc20OnChain = await (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect((await targetErc20OnChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            const amount2 = "50000000000000000";

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount2);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount2);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount2);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                erc20OnOriginChain.address,
                user.address,
                amount2,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            const amountSum = "70000000000000000";

            expect((await targetErc20OnChain.functions.balanceOf(user.address)).toString()).to.be.equal(amountSum);

        });

        it("should invoke `transferToSchainERC20` and receive tokens without mistakes double with attached token", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerErc20.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, tokenManagerErc202.address);

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnOriginChain.address,
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: BigNumber.from(await erc20OnOriginChain.decimals()).toString()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:

            await tokenManagerErc202.connect(schainOwner).addERC20TokenByOwner(schainName,  erc20OnOriginChain.address, erc20OnTargetChain.address).should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");
            await tokenManagerErc202.connect(deployer).grantRole(await tokenManagerErc202.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerErc202.connect(schainOwner).addERC20TokenByOwner(schainName,  erc20OnOriginChain.address, erc20OnTargetChain.address).should.be.eventually.rejectedWith("Chain is not connected");

            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.connect(schainOwner).addERC20TokenByOwner(schainName,  erc20OnOriginChain.address, erc20OnTargetChain.address);
            await tokenManagerErc202.addTokenManager(schainName, tokenManagerErc20.address);

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            expect((await erc20OnTargetChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            const amount2 = "50000000000000000";

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount2);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount2);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount2);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                erc20OnOriginChain.address,
                user.address,
                amount2,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            const amountSum = "70000000000000000";

            expect((await erc20OnTargetChain.functions.balanceOf(user.address)).toString()).to.be.equal(amountSum);

        });

        it("should invoke `transferToSchainERC20` and transfer back without mistakes", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerErc20.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, tokenManagerErc202.address);

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnOriginChain.address,
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: BigNumber.from(await erc20OnOriginChain.decimals()).toString()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, tokenManagerErc20.address);


            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerErc202.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            const addressERC20OnSchain = await tokenManagerErc202.clonesErc20(schainId, erc20OnOriginChain.address);
            const targetErc20OnChain = await (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect((await targetErc20OnChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Transfer is not approved by token holder");

            await targetErc20OnChain.connect(user).approve(tokenManagerErc202.address, amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerErc202.address);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount);

            data = await messages.encodeTransferErc20Message(
                erc20OnOriginChain.address,
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerErc20.address, newSchainId, tokenManagerErc202.address, data);
            expect((await erc20OnOriginChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

        });

        it("should invoke `transferToSchainERC20` and transfer back without mistakes with attached tokens", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerErc20.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, tokenManagerErc202.address);

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnOriginChain.address,
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: BigNumber.from(await erc20OnOriginChain.decimals()).toString()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, tokenManagerErc20.address);

            await tokenManagerErc202.connect(deployer).grantRole(await tokenManagerErc202.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerErc202.connect(schainOwner).addERC20TokenByOwner(schainName,  erc20OnOriginChain.address, erc20OnTargetChain.address);


            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Transfer is not approved by token holder");

            await erc20OnTargetChain.connect(user).approve(tokenManagerErc202.address, amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerErc202.address);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount);

            data = await messages.encodeTransferErc20Message(
                erc20OnOriginChain.address,
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerErc20.address, newSchainId, tokenManagerErc202.address, data);
            expect((await erc20OnOriginChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

        });


        it("should invoke `transferToSchainERC20` and transfer back without mistakes double", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerErc20.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, tokenManagerErc202.address);

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnOriginChain.address,
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: BigNumber.from(await erc20OnOriginChain.decimals()).toString()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, tokenManagerErc20.address);


            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerErc202.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            const addressERC20OnSchain = await tokenManagerErc202.clonesErc20(schainId, erc20OnOriginChain.address);
            const targetErc20OnChain = await (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect((await targetErc20OnChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Transfer is not approved by token holder");

            await targetErc20OnChain.connect(user).approve(tokenManagerErc202.address, amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerErc202.address);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount);

            data = await messages.encodeTransferErc20Message(
                erc20OnOriginChain.address,
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerErc20.address, newSchainId, tokenManagerErc202.address, data);
            expect((await erc20OnOriginChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                erc20OnOriginChain.address,
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            expect((await targetErc20OnChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            const amount2 = "50000000000000000";

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount2);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount2);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount2);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                erc20OnOriginChain.address,
                user.address,
                amount2,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            const amountSum = "70000000000000000";

            expect((await targetErc20OnChain.functions.balanceOf(user.address)).toString()).to.be.equal(amountSum);

            await targetErc20OnChain.connect(user).approve(tokenManagerErc202.address, amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount);

            data = await messages.encodeTransferErc20Message(
                erc20OnOriginChain.address,
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerErc20.address, newSchainId, tokenManagerErc202.address, data);
            expect((await erc20OnOriginChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            await targetErc20OnChain.connect(user).approve(tokenManagerErc202.address, amount2);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount2);

            data = await messages.encodeTransferErc20Message(
                erc20OnOriginChain.address,
                user.address,
                amount2
            );

            await messageProxyForSchain.postMessage(tokenManagerErc20.address, newSchainId, tokenManagerErc202.address, data);

            expect((await erc20OnOriginChain.functions.balanceOf(user.address)).toString()).to.be.equal(amountSum);

        });

        it("should invoke `transferToSchainERC20` and transfer back without mistakes double with attached tokens", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerErc20.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, tokenManagerErc202.address);

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnOriginChain.address,
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: BigNumber.from(await erc20OnOriginChain.decimals()).toString()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, tokenManagerErc20.address);

            await tokenManagerErc202.connect(deployer).grantRole(await tokenManagerErc202.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerErc202.connect(schainOwner).addERC20TokenByOwner(schainName,  erc20OnOriginChain.address, erc20OnTargetChain.address);


            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20("Mainnet", erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Transfer is not approved by token holder");

            await erc20OnTargetChain.connect(user).approve(tokenManagerErc202.address, amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerErc202.address);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount);

            data = await messages.encodeTransferErc20Message(
                erc20OnOriginChain.address,
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerErc20.address, newSchainId, tokenManagerErc202.address, data);
            expect((await erc20OnOriginChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                erc20OnOriginChain.address,
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            expect((await erc20OnTargetChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            const amount2 = "50000000000000000";

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount2);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount2);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount2);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                erc20OnOriginChain.address,
                user.address,
                amount2,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            const amountSum = "70000000000000000";

            expect((await erc20OnTargetChain.functions.balanceOf(user.address)).toString()).to.be.equal(amountSum);

            await erc20OnTargetChain.connect(user).approve(tokenManagerErc202.address, amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount);

            data = await messages.encodeTransferErc20Message(
                erc20OnOriginChain.address,
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerErc20.address, newSchainId, tokenManagerErc202.address, data);
            expect((await erc20OnOriginChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            await erc20OnTargetChain.connect(user).approve(tokenManagerErc202.address, amount2);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, erc20OnOriginChain.address, amount2);

            data = await messages.encodeTransferErc20Message(
                erc20OnOriginChain.address,
                user.address,
                amount2
            );

            await messageProxyForSchain.postMessage(tokenManagerErc20.address, newSchainId, tokenManagerErc202.address, data);

            expect((await erc20OnOriginChain.functions.balanceOf(user.address)).toString()).to.be.equal(amountSum);

        });

    });

    describe("tests for `postMessage` function", async () => {
        it("should transfer ERC20 token with token info", async () => {
            //  preparation
            const amount = 10;
            const to = user.address;
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = randomString(10);
            const fromSchainHash = stringValue(web3.utils.soliditySha3(fromSchainName));
            await tokenManagerErc20.addTokenManager(fromSchainName, remoteTokenManagerAddress);
            // await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  erc20OnMainnet.address, erc20OnChain.address);

            await erc20OnMainnet.mint(deployer.address, amount);
            const data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnMainnet.address,
                to,
                amount,
                (await erc20OnMainnet.totalSupply()).toNumber(),
                {
                    name: await erc20OnMainnet.name(),
                    symbol: await erc20OnMainnet.symbol(),
                    decimals: BigNumber.from(await erc20OnMainnet.decimals()).toString()
                }
            );
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();

            // execution
            await messageProxyForSchain.postMessage(tokenManagerErc20.address, fromSchainHash, remoteTokenManagerAddress, data);
            // expectation
            const addressERC20OnSchain = await tokenManagerErc20.clonesErc20(fromSchainHash, erc20OnMainnet.address);
            const targetErc20OnChain = await (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect(parseInt((await targetErc20OnChain.functions.balanceOf(to)).toString(), 10))
                .to.be.equal(amount);
        });

        it("should transfer ERC20 token to schain when token add by schain owner", async () => {
            //  preparation
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = randomString(10);
            const fromSchainHash = stringValue(web3.utils.soliditySha3(fromSchainName));
            await messageProxyForSchain.connect(deployer).addConnectedChain(fromSchainName);
            await tokenManagerErc20.addTokenManager(fromSchainName, remoteTokenManagerAddress);
            await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(fromSchainName,  erc20OnMainnet.address, erc20OnChain.address);

            const amount = 10;
            const to = user.address;
            await erc20OnMainnet.mint(deployer.address, amount);
            const data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                erc20OnMainnet.address,
                to,
                amount,
                (await erc20OnMainnet.totalSupply()).toNumber()
            );
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();

            // execution
            await messageProxyForSchain.postMessage(tokenManagerErc20.address, fromSchainHash, remoteTokenManagerAddress, data);
            // expectation
            const addressERC20OnSchain = await tokenManagerErc20.clonesErc20(fromSchainHash, erc20OnMainnet.address);
            const targetErc20OnChain = await (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect(parseInt((await targetErc20OnChain.functions.balanceOf(to)).toString(), 10))
                .to.be.equal(amount);
        });

        it("should should transfer token to schain and automaticaly deploy", async () => {
            //  preparation
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = randomString(10);
            const fromSchainHash = stringValue(web3.utils.soliditySha3(fromSchainName));
            await tokenManagerErc20.addTokenManager(fromSchainName, remoteTokenManagerAddress);

            const amount = 10;
            const to = user.address;
            await erc20OnMainnet.mint(deployer.address, amount);
            const data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnMainnet.address,
                to,
                amount,
                (await erc20OnMainnet.totalSupply()).toNumber(),
                {
                    name: await erc20OnMainnet.name(),
                    symbol: await erc20OnMainnet.symbol(),
                    decimals: BigNumber.from(await erc20OnMainnet.decimals()).toString()
                }
            );

            await messageProxyForSchain.postMessage(tokenManagerErc20.address, fromSchainHash, remoteTokenManagerAddress, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();

            // execution
            await messageProxyForSchain.postMessage(tokenManagerErc20.address, fromSchainHash, remoteTokenManagerAddress, data);

            // expectation
            const addressERC20OnSchain = await tokenManagerErc20.clonesErc20(fromSchainHash, erc20OnMainnet.address);
            const targetErc20OnChain = await (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect(parseInt((await targetErc20OnChain.functions.balanceOf(to)).toString(), 10))
                .to.be.equal(amount);
        });

        it("should reject if message type is unknown", async () => {
            const data = "0x0000000000000000000000000000000000000000000000000000000000000001"+
            "000000000000000000000000a51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0"+
            "00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8"+
            "0000000000000000000000000000000000000000000000000000000000000001";
            await messageProxyForSchain.postMessage(tokenManagerErc20.address, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("MessageType is unknown");

        });

        it("should reject if total supply is exceeded", async () => {
            //  preparation
            const amount = 10;
            const to = user.address;
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = randomString(10);
            const fromSchainHash = stringValue(web3.utils.soliditySha3(fromSchainName));
            await tokenManagerErc20.addTokenManager(fromSchainName, remoteTokenManagerAddress);
            await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  erc20OnMainnet.address, erc20OnChain.address);

            await erc20OnMainnet.mint(deployer.address, amount);
            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnMainnet.address,
                to,
                amount,
                (await erc20OnMainnet.totalSupply()).toNumber(),
                {
                    name: await erc20OnMainnet.name(),
                    symbol: await erc20OnMainnet.symbol(),
                    decimals: BigNumber.from(await erc20OnMainnet.decimals()).toString()
                }
            );
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
            await messageProxyForSchain.postMessage(tokenManagerErc20.address, fromSchainHash, remoteTokenManagerAddress, data);

            // execution
            const UINT256_MAX = BigNumber.from(2).pow(256).sub(1);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                erc20OnMainnet.address,
                to,
                UINT256_MAX,
                0);

            await messageProxyForSchain.postMessage(tokenManagerErc20.address, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("Total supply exceeded");
        });
    });
});
