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
    CommunityLocker,
    EtherbaseMock
} from "../typechain";


chai.should();
chai.use((chaiAsPromised as any));

import { deployTokenManagerERC20 } from "./utils/deploy/schain/tokenManagerERC20";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployMessages } from "./utils/deploy/messages";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";
import { skipTime } from "./utils/time";

describe("TokenManagerERC20", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

    const mainnetName = "Mainnet";
    const schainName = "D2-chain";
    const schainId = ethers.utils.solidityKeccak256(["string"], [schainName]);
    const mainnetId = ethers.utils.solidityKeccak256(["string"], ["Mainnet"]);
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
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerErc20.address);

        // execution
        const res = await (await messageProxyForSchain.postMessage(tokenManagerErc20.address, mainnetId, fakeDepositBox, data)).wait();

        let newAddress: string;
        // TODO: use waffle
        if (!res.events) {
            assert("No events were emitted");
        } else {
            newAddress = "0x" + res.events[res.events.length - 1].topics[3].slice(-40);
            const newERC20Contract = (await ethers.getContractFactory("ERC20OnChain")).attach(newAddress) as ERC20OnChain;
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
        const amountMint = "10000000000000000";
        const amountReduceCost = "8000000000000000";
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
        const newSchainId = ethers.utils.solidityKeccak256(["string"], [newSchainName]);

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

        it("should reject `transferToSchainERC20` when executing earlier than allowed", async () => {
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

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(1));

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(2));

            await communityLocker.grantRole(await communityLocker.CONSTANT_SETTER_ROLE(), deployer.address);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(2));

            await skipTime(90);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(2));

            await skipTime(20);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(3));

            await communityLocker.setTimeLimitPerMessage(newSchainName, 0);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(4));

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(4));

            await skipTime(110);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, erc20OnOriginChain.address, amount);

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(5));
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
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerErc202.address);

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            const addressERC20OnSchain = await tokenManagerErc202.clonesErc20(schainId, erc20OnOriginChain.address);
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect((await targetErc20OnChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

        });

        it("should invoke `transferToSchainERC20` and receive tokens without mistakes back and forward twice", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerErc20.address);
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerErc202.address);

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
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
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
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerErc202.address);

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
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerErc20.address);
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerErc202.address);

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
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
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
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerErc20.address);
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerErc202.address);

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
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerErc20.address);
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerErc202.address);

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
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
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
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerErc20.address);
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerErc202.address);

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
            await tokenManagerErc202.connect(schainOwner).addERC20TokenByOwner(schainName, erc20OnOriginChain.address, erc20OnTargetChain.address);


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

        it("should not be able to transfer X->Y->Z", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerErc20.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

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

            await tokenManagerErc202.connect(deployer).grantRole(await tokenManagerErc202.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerErc202.connect(schainOwner).addERC20TokenByOwner(schainName,  erc20OnOriginChain.address, erc20OnTargetChain.address);
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerErc202.address);

            await messageProxyForSchain2.postMessage(tokenManagerErc202.address, schainId, tokenManagerErc20.address, data);

            expect((await erc20OnTargetChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            let erc20OnTargetZChain: ERC20OnChain;
            let messageProxyForSchainZ: MessageProxyForSchainTester;
            let tokenManagerLinkerZ: TokenManagerLinker;
            let tokenManagerErc20Z: TokenManagerERC20;
            let communityLockerZ: CommunityLocker;
            const newSchainNameZ = "NewChainZ";

            erc20OnTargetZChain = await deployERC20OnChain("NewTokenZ", "NTNZ");

            const keyStorageZ = await deployKeyStorageMock();
            messageProxyForSchainZ = await deployMessageProxyForSchainTester(keyStorageZ.address, newSchainNameZ);
            tokenManagerLinkerZ = await deployTokenManagerLinker(messageProxyForSchainZ, deployer.address);
            communityLockerZ = await deployCommunityLocker(newSchainName, messageProxyForSchainZ.address, tokenManagerLinkerZ, fakeCommunityPool);
            tokenManagerErc20Z = await deployTokenManagerERC20(newSchainNameZ, messageProxyForSchainZ.address, tokenManagerLinkerZ, communityLockerZ, fakeDepositBox);
            await erc20OnTargetZChain.connect(deployer).grantRole(await erc20OnTargetZChain.MINTER_ROLE(), tokenManagerErc20Z.address);
            await tokenManagerLinkerZ.registerTokenManager(tokenManagerErc20Z.address);

            await messageProxyForSchain2.connect(deployer).grantRole(await messageProxyForSchain2.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain2.connect(deployer).addConnectedChain(newSchainNameZ);

            await tokenManagerErc202.addTokenManager(newSchainNameZ, tokenManagerErc20Z.address);

            await erc20OnTargetChain.connect(user).approve(tokenManagerErc202.address, amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainNameZ, erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Insufficient funds");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainNameZ, erc20OnTargetChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect main chain token");
        });

        it("should not be able to transfer main chain token or clone to mainnet", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerErc20.address);
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerErc202.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(tokenManagerErc20.address, amount);

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

            expect((await erc20OnTargetChain.functions.balanceOf(user.address)).toString()).to.be.equal(amount);

            data = await messages.encodeActivateUserMessage(user.address);

            await messageProxyForSchain2.postMessage(communityLocker2.address, mainnetId, fakeCommunityPool, data);

            await erc20OnTargetChain.connect(user).approve(tokenManagerErc202.address, amount);

            await tokenManagerErc202
                .connect(user)
                .exitToMainERC20(erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Insufficient funds");

            await tokenManagerErc202
                .connect(user)
                .exitToMainERC20(erc20OnTargetChain.address, amount)
                .should.be.eventually.rejectedWith("Incorrect main chain token");


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
                .exitToMainERC20(erc20OnOriginChain.address, amount)
                .should.be.eventually.rejectedWith("Main chain token could not be transfered to Mainnet");

            await tokenManagerErc20
                .connect(user)
                .exitToMainERC20(erc20OnTargetChain.address, amount)
                .should.be.eventually.rejectedWith("Insufficient funds");

        });

    });

    describe("tests for `postMessage` function", async () => {
        beforeEach(async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerErc20.address);
        });

        it("should transfer ERC20 token with token info", async () => {
            //  preparation
            const amount = 10;
            const to = user.address;
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = "fromSchainName";
            const fromSchainHash = ethers.utils.solidityKeccak256(["string"], [fromSchainName]);
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
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect(parseInt((await targetErc20OnChain.functions.balanceOf(to)).toString(), 10))
                .to.be.equal(amount);
        });

        it("should transfer ERC20 token to schain when token add by schain owner", async () => {
            //  preparation
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = "fromSchainName";
            const fromSchainHash = ethers.utils.solidityKeccak256(["string"], [fromSchainName]);
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
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect(parseInt((await targetErc20OnChain.functions.balanceOf(to)).toString(), 10))
                .to.be.equal(amount);
        });

        it("should should transfer token to schain and automatically deploy", async () => {
            //  preparation
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = "fromSchainName";
            const fromSchainHash = ethers.utils.solidityKeccak256(["string"], [fromSchainName]);
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
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
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
            const fromSchainName = "fromSchainName";
            const fromSchainHash = ethers.utils.solidityKeccak256(["string"], [fromSchainName]);
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

        it("should top up a receiver", async () => {
            const amount = 10;
            const receiver = ethers.Wallet.createRandom().connect(ethers.provider);
            const remoteTokenManager = ethers.Wallet.createRandom();
            const sourceSchainName = "sourceSchain";
            const sourceSchainHash = ethers.utils.solidityKeccak256(["string"], [sourceSchainName])
            await tokenManagerErc20.addTokenManager(sourceSchainName, remoteTokenManager.address);
            const etherbase = await (await ethers.getContractFactory("EtherbaseMock")).deploy() as EtherbaseMock;
            await etherbase.initialize(deployer.address);
            await etherbase.grantRole(await etherbase.ETHER_MANAGER_ROLE(), messageProxyForSchain.address);
            await messageProxyForSchain.setEtherbase(etherbase.address);
            await deployer.sendTransaction({to: etherbase.address, value: ethers.utils.parseEther("3")});

            (await receiver.getBalance()).should.be.equal(0);

            const data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnMainnet.address,
                receiver.address,
                amount,
                2 * amount,
                {
                    name: await erc20OnMainnet.name(),
                    symbol: await erc20OnMainnet.symbol(),
                    decimals: await erc20OnMainnet.decimals()
                }
            );
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
            await messageProxyForSchain.postMessage(
                tokenManagerErc20.address,
                sourceSchainHash,
                remoteTokenManager.address,
                data);

            (await receiver.getBalance()).should.be.equal(0);

            await expect(messageProxyForSchain.setMinimumReceiverBalance(ethers.utils.parseEther("2")))
                .to.emit(messageProxyForSchain, 'MinimumReceiverBalanceChanged')
                .withArgs(0, ethers.utils.parseEther("2"));

            await messageProxyForSchain.postMessage(
                tokenManagerErc20.address,
                sourceSchainHash,
                remoteTokenManager.address,
                data);

            (await receiver.getBalance()).should.be.equal(await messageProxyForSchain.minimumReceiverBalance());
        })
    });
});
