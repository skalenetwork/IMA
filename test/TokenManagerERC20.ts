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
chai.use(chaiAsPromised);

import { deployTokenManagerERC20 } from "./utils/deploy/schain/tokenManagerERC20";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployMessages } from "./utils/deploy/messages";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { assert, expect } from "chai";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";
import { skipTime } from "./utils/time";
import { stringKeccak256 } from "./utils/helper";

describe("TokenManagerERC20", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

    const mainnetName = "Mainnet";
    const schainName = "D2-chain";
    const schainId = stringKeccak256(schainName);
    const mainnetId = stringKeccak256("Mainnet");
    let fakeDepositBox: string;
    let fakeCommunityPool: string;
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
        fakeDepositBox = await messages.getAddress();
        fakeCommunityPool = await messages.getAddress();

        const keyStorage = await deployKeyStorageMock();
        messageProxyForSchain = await deployMessageProxyForSchainTester(await keyStorage.getAddress(), schainName);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, deployer.address);
        communityLocker = await deployCommunityLocker(schainName, await messageProxyForSchain.getAddress(), tokenManagerLinker, fakeCommunityPool);
        tokenManagerErc20 = await deployTokenManagerERC20(schainName, await messageProxyForSchain.getAddress(), tokenManagerLinker, communityLocker, fakeDepositBox);
        await erc20OnChain.connect(deployer).grantRole(await erc20OnChain.MINTER_ROLE(), await tokenManagerErc20.getAddress());
        await tokenManagerLinker.registerTokenManager(await tokenManagerErc20.getAddress());

        await tokenManagerErc20.connect(deployer).grantRole(await tokenManagerErc20.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        await tokenManagerErc20.connect(deployer).grantRole(await tokenManagerErc20.AUTOMATIC_DEPLOY_ROLE(), schainOwner.address);
        const data = await messages.encodeActivateUserMessage(user.address);
        await messageProxyForSchain.postMessage(await communityLocker.getAddress(), mainnetId, fakeCommunityPool, data);

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

        const data = await messages.encodeTransferErc20AndTokenInfoMessage(await erc20OnMainnet.getAddress(), to, amount, totalSupply, { name, symbol, decimals: 18 });
        const data2 = await messages.encodeTransferErc20AndTokenInfoMessage(await erc20OnMainnet.getAddress(), to, amount, totalSupply, { name, symbol, decimals: 18 });

        await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
        await messageProxyForSchain.registerExtraContractForAll(await tokenManagerErc20.getAddress());

        // execution
        const receipt = await (await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), mainnetId, fakeDepositBox, data)).wait();

        // TODO: use waffle

        if (!receipt?.logs) {
            assert("No events were emitted");
        } else {
            const newAddress = "0x" + receipt.logs[receipt.logs.length - 1].topics[3].slice(-40);
            const newERC20Contract = (await ethers.getContractFactory("ERC20OnChain")).attach(newAddress) as ERC20OnChain;
            let balance = await newERC20Contract.balanceOf(to);
            parseInt(balance.toString(), 10).should.be.equal(amount);
            // expectation
            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), mainnetId, fakeDepositBox, data2);
            balance = await newERC20Contract.balanceOf(to);
            parseInt(balance.toString(), 10).should.be.equal(amount * 2);
        }
    });

    it("should reject with `Insufficient funds` if token balance is too low", async () => {
        // preparation
        const error = "Insufficient funds";
        const amount = 10;
        // execution/expectation
        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  await erc20OnMainnet.getAddress(), await erc20OnChain.getAddress());

        await erc20OnChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);
        await tokenManagerErc20
            .connect(user)
            .exitToMainERC20(await erc20OnMainnet.getAddress(), amount)
            .should.be.eventually.rejectedWith(error);
    });

    it("should add token by owner", async () => {
        // preparation
        const addressERC20 = await erc20OnChain.getAddress();
        const addressERC201 = await erc20OnMainnet.getAddress();
        const automaticDeploy = await tokenManagerErc20.automaticDeploy();
        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  addressERC201, addressERC20);
        // automaticDeploy == true - enabled automaticDeploy = false - disabled
        if (automaticDeploy) {
            await tokenManagerErc20.connect(schainOwner).disableAutomaticDeploy();
        } else {
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
        }

        eRC20OnChain2 = await deployERC20OnChain("NewToken", "NTN");
        const eRC20OnChain3 = await deployERC20OnChain("NewToken2", "NTN2");
        eRC20OnMainnet2 = await deployERC20OnChain("NewToken", "NTN");
        const eRC20OnMainnet3 = await deployERC20OnChain("NewToken2", "NTN2");

        if (automaticDeploy) {
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
        } else {
            await tokenManagerErc20.connect(schainOwner).disableAutomaticDeploy();
        }

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  await eRC20OnMainnet2.getAddress(), await eRC20OnChain2.getAddress());

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  await eRC20OnMainnet2.getAddress(), deployer.address)
            .should.be.eventually.rejectedWith("Given address is not a contract");

        await eRC20OnChain2.mint(user.address, 1);
        await eRC20OnChain3.mint(user.address, 1);

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  await eRC20OnMainnet3.getAddress(), addressERC20)
            .should.be.eventually.rejectedWith("Clone was already added");

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  await eRC20OnMainnet3.getAddress(), await eRC20OnChain3.getAddress())
            .should.be.eventually.rejectedWith("Total supply of a new token is not zero");

    });

    describe("when token added by owner", async () => {
        const mainnetChainHash = stringKeccak256(mainnetName);
        let erc20OnSchainTokenAddress: string;
        let erc20OnOriginChainTokenAddress: string;

        beforeEach(async () => {
            erc20OnSchainTokenAddress = await erc20OnChain.getAddress();
            erc20OnOriginChainTokenAddress = await erc20OnMainnet.getAddress();
            await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  erc20OnOriginChainTokenAddress, erc20OnSchainTokenAddress);
        })

        it("should successfully relink if new token was not minted", async () => {
            const erc20OnSchainPostToken = await deployERC20OnChain("SchainPostToken", "SPT");

            await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  erc20OnOriginChainTokenAddress, await erc20OnSchainPostToken.getAddress());

            await tokenManagerErc20.clonesErc20(mainnetChainHash, erc20OnOriginChainTokenAddress).should.be.eventually.equal(await erc20OnSchainPostToken.getAddress());
            await tokenManagerErc20.addedClones(await erc20OnSchainPostToken.getAddress()).should.be.eventually.equal(true);
        });

        it("should successfully relink if previous token on target chain was minted and then fully burned before relinking to new", async () => {
            await erc20OnChain.mint(user.address, 1);
            await erc20OnChain.connect(user).burn(1);
            const erc20OnSchainPostToken = await deployERC20OnChain("SchainPostToken", "SPT");

            await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  erc20OnOriginChainTokenAddress, await erc20OnSchainPostToken.getAddress());

            await tokenManagerErc20.clonesErc20(mainnetChainHash, erc20OnOriginChainTokenAddress).should.be.eventually.equal(await erc20OnSchainPostToken.getAddress());
            await tokenManagerErc20.addedClones(await erc20OnSchainPostToken.getAddress()).should.be.eventually.equal(true);
        });

        it("should reject new relinking if previous token was already minted", async () => {
            await erc20OnChain.mint(user.address, 1);
            const erc20OnSchainPostToken = await deployERC20OnChain("SchainPostToken", "SPT");

            await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  erc20OnOriginChainTokenAddress, await erc20OnSchainPostToken.getAddress())
                .should.be.eventually.rejectedWith("Total supply of a previous token is not zero")
        });

    });

    it("should reject with `Transfer is not approved by token holder` when invoke `exitToMainERC20`", async () => {
        const error = "Transfer is not approved by token holder";
        const amount = 20;
        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  await erc20OnMainnet.getAddress(), await erc20OnChain.getAddress());

        // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
        const minterRole = await erc20OnChain.MINTER_ROLE();
        await erc20OnChain.mint(user.address, amount * 2);
        await erc20OnChain.connect(deployer).grantRole(minterRole, await tokenManagerErc20.getAddress());
        //
        await erc20OnChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount / 2);
        // execution/expectation
        await tokenManagerErc20.connect(user).exitToMainERC20(await erc20OnMainnet.getAddress(), amount)
            .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `exitToMainERC20` without mistakes", async () => {
        const amountMint = "10000000000000000";
        const amountReduceCost = "8000000000000000";
        await messageProxyForSchain.registerExtraContract("Mainnet", await tokenManagerErc20.getAddress());
        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  await erc20OnMainnet.getAddress(), await erc20OnChain.getAddress());

        await erc20OnChain.connect(deployer).mint(user.address, amountMint);
        await erc20OnChain.connect(user).approve(await tokenManagerErc20.getAddress(), amountMint);

        // execution:
        await tokenManagerErc20
            .connect(user)
            .exitToMainERC20(await erc20OnMainnet.getAddress(), amountReduceCost);

        // // expectation:
        const outgoingMessagesCounterMainnet = await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet");
        outgoingMessagesCounterMainnet.should.be.equal(1);
    });

    describe("tests for transferToSchainERC20", async () => {

        let erc20OnOriginChain: ERC20OnChain;
        let erc20OnTargetChain: ERC20OnChain;
        let messageProxyForSchain2: MessageProxyForSchainTester;
        let tokenManagerLinker2: TokenManagerLinker;
        let tokenManagerErc202: TokenManagerERC20;
        let communityLocker2: CommunityLocker;
        const newSchainName = "NewChain";
        const newSchainId = stringKeccak256(newSchainName);

        beforeEach(async () => {
            erc20OnOriginChain = await deployERC20OnChain("NewToken", "NTN");
            erc20OnTargetChain = await deployERC20OnChain("NewToke1n", "NTN1");

            const keyStorage2 = await deployKeyStorageMock();
            messageProxyForSchain2 = await deployMessageProxyForSchainTester(await keyStorage2.getAddress(), newSchainName);
            tokenManagerLinker2 = await deployTokenManagerLinker(messageProxyForSchain2, deployer.address);
            communityLocker2 = await deployCommunityLocker(newSchainName, await messageProxyForSchain2.getAddress(), tokenManagerLinker2, fakeCommunityPool);
            tokenManagerErc202 = await deployTokenManagerERC20(newSchainName, await messageProxyForSchain2.getAddress(), tokenManagerLinker2, communityLocker2, fakeDepositBox);
            await erc20OnTargetChain.connect(deployer).grantRole(await erc20OnTargetChain.MINTER_ROLE(), await tokenManagerErc202.getAddress());
            await tokenManagerLinker2.registerTokenManager(await tokenManagerErc202.getAddress());
        });

        it("should invoke `transferToSchainERC20` without mistakes", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, await tokenManagerErc20.getAddress());

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, await tokenManagerErc202.getAddress());

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);
        });

        it("should reject `transferToSchainERC20` when executing earlier than allowed", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, await tokenManagerErc20.getAddress());

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, await tokenManagerErc202.getAddress());

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(1);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await communityLocker.grantRole(await communityLocker.CONSTANT_SETTER_ROLE(), deployer.address);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await skipTime(90);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await skipTime(20);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(3);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 0);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(4);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(4);

            await skipTime(110);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(5);
        });

        it("should invoke `transferToSchainERC20` and receive tokens without mistakes", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, await tokenManagerErc20.getAddress());

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, await tokenManagerErc202.getAddress());

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            const data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: await erc20OnOriginChain.decimals()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, await tokenManagerErc20.getAddress());


            await messageProxyForSchain2
                .postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerErc202.enableAutomaticDeploy();
            await messageProxyForSchain2.registerExtraContractForAll(await tokenManagerErc202.getAddress());

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            const addressERC20OnSchain = await tokenManagerErc202.clonesErc20(schainId, await erc20OnOriginChain.getAddress());
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect((await targetErc20OnChain.balanceOf(user.address)).toString()).to.be.equal(amount);

        });

        it("should invoke `transferToSchainERC20` and receive tokens without mistakes back and forward twice", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, await tokenManagerErc20.getAddress());
            await messageProxyForSchain2.registerExtraContractForAll(await tokenManagerErc202.getAddress());

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, await tokenManagerErc202.getAddress());

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: await erc20OnOriginChain.decimals()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, await tokenManagerErc20.getAddress());


            await messageProxyForSchain2
                .postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerErc202.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            const addressERC20OnSchain = await tokenManagerErc202.clonesErc20(schainId, await erc20OnOriginChain.getAddress());
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect((await targetErc20OnChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            const amount2 = "50000000000000000";

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount2);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount2);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount2);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount2,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            const amountSum = "70000000000000000";

            expect((await targetErc20OnChain.balanceOf(user.address)).toString()).to.be.equal(amountSum);

        });

        it("should invoke `transferToSchainERC20` and receive tokens without mistakes double with attached token", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, await tokenManagerErc20.getAddress());
            await messageProxyForSchain2.registerExtraContractForAll(await tokenManagerErc202.getAddress());

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, await tokenManagerErc202.getAddress());

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: await erc20OnOriginChain.decimals()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:

            await tokenManagerErc202
                .connect(schainOwner)
                .addERC20TokenByOwner(schainName,  await erc20OnOriginChain.getAddress(), await erc20OnTargetChain.getAddress())
                .should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");
            await tokenManagerErc202.connect(deployer).grantRole(await tokenManagerErc202.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerErc202
                .connect(schainOwner)
                .addERC20TokenByOwner(schainName,  await erc20OnOriginChain.getAddress(), await erc20OnTargetChain.getAddress())
                .should.be.eventually.rejectedWith("Chain is not connected");

            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202
                .connect(schainOwner)
                .addERC20TokenByOwner(schainName,  await erc20OnOriginChain.getAddress(), await erc20OnTargetChain.getAddress());
            await tokenManagerErc202.addTokenManager(schainName, await tokenManagerErc20.getAddress());

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            expect((await erc20OnTargetChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            const amount2 = "50000000000000000";

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount2);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount2);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount2);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount2,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            const amountSum = "70000000000000000";

            expect((await erc20OnTargetChain.balanceOf(user.address)).toString()).to.be.equal(amountSum);

        });

        it("should invoke `transferToSchainERC20` and transfer back without mistakes", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContractForAll(await tokenManagerErc20.getAddress());
            await messageProxyForSchain2.registerExtraContractForAll(await tokenManagerErc202.getAddress());

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, await tokenManagerErc202.getAddress());

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: await erc20OnOriginChain.decimals()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, await tokenManagerErc20.getAddress());


            await messageProxyForSchain2
                .postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerErc202.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            const addressERC20OnSchain = await tokenManagerErc202.clonesErc20(schainId, await erc20OnOriginChain.getAddress());
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect((await targetErc20OnChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Transfer is not approved by token holder");

            await targetErc20OnChain.connect(user).approve(await tokenManagerErc202.getAddress(), amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount);

            data = await messages.encodeTransferErc20Message(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), newSchainId, await tokenManagerErc202.getAddress(), data);
            expect((await erc20OnOriginChain.balanceOf(user.address)).toString()).to.be.equal(amount);

        });

        it("should invoke `transferToSchainERC20` and transfer back without mistakes with attached tokens", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContractForAll(await tokenManagerErc20.getAddress());
            await messageProxyForSchain2.registerExtraContractForAll(await tokenManagerErc202.getAddress());

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, await tokenManagerErc202.getAddress());

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: await erc20OnOriginChain.decimals()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, await tokenManagerErc20.getAddress());

            await tokenManagerErc202.connect(deployer).grantRole(await tokenManagerErc202.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerErc202.connect(schainOwner).addERC20TokenByOwner(schainName,  await erc20OnOriginChain.getAddress(), await erc20OnTargetChain.getAddress());


            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Transfer is not approved by token holder");

            await erc20OnTargetChain.connect(user).approve(await tokenManagerErc202.getAddress(), amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount);

            data = await messages.encodeTransferErc20Message(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), newSchainId, await tokenManagerErc202.getAddress(), data);
            expect((await erc20OnOriginChain.balanceOf(user.address)).toString()).to.be.equal(amount);

        });


        it("should invoke `transferToSchainERC20` and transfer back without mistakes double", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContractForAll(await tokenManagerErc20.getAddress());
            await messageProxyForSchain2.registerExtraContractForAll(await tokenManagerErc202.getAddress());

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, await tokenManagerErc202.getAddress());

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: await erc20OnOriginChain.decimals()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, await tokenManagerErc20.getAddress());


            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerErc202.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            const addressERC20OnSchain = await tokenManagerErc202.clonesErc20(schainId, await erc20OnOriginChain.getAddress());
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect((await targetErc20OnChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Transfer is not approved by token holder");

            await targetErc20OnChain.connect(user).approve(await tokenManagerErc202.getAddress(), amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount);

            data = await messages.encodeTransferErc20Message(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), newSchainId, await tokenManagerErc202.getAddress(), data);
            expect((await erc20OnOriginChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            expect((await targetErc20OnChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            const amount2 = "50000000000000000";

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount2);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount2);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount2);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount2,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            const amountSum = "70000000000000000";

            expect((await targetErc20OnChain.balanceOf(user.address)).toString()).to.be.equal(amountSum);

            await targetErc20OnChain.connect(user).approve(await tokenManagerErc202.getAddress(), amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount);

            data = await messages.encodeTransferErc20Message(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), newSchainId, await tokenManagerErc202.getAddress(), data);
            expect((await erc20OnOriginChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            await targetErc20OnChain.connect(user).approve(await tokenManagerErc202.getAddress(), amount2);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount2);

            data = await messages.encodeTransferErc20Message(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount2
            );

            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), newSchainId, await tokenManagerErc202.getAddress(), data);

            expect((await erc20OnOriginChain.balanceOf(user.address)).toString()).to.be.equal(amountSum);

        });

        it("should invoke `transferToSchainERC20` and transfer back without mistakes double with attached tokens", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContractForAll(await tokenManagerErc20.getAddress());
            await messageProxyForSchain2.registerExtraContractForAll(await tokenManagerErc202.getAddress());

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc20.addTokenManager(newSchainName, await tokenManagerErc202.getAddress());

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: await erc20OnOriginChain.decimals()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, await tokenManagerErc20.getAddress());

            await tokenManagerErc202.connect(deployer).grantRole(await tokenManagerErc202.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerErc202.connect(schainOwner).addERC20TokenByOwner(schainName, await erc20OnOriginChain.getAddress(), await erc20OnTargetChain.getAddress());


            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20("Mainnet", await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Transfer is not approved by token holder");

            await erc20OnTargetChain.connect(user).approve(await tokenManagerErc202.getAddress(), amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount);

            data = await messages.encodeTransferErc20Message(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), newSchainId, await tokenManagerErc202.getAddress(), data);
            expect((await erc20OnOriginChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            expect((await erc20OnTargetChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            const amount2 = "50000000000000000";

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount2);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount2);

            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount2);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount2,
                (await erc20OnOriginChain.totalSupply()).toString()
            );

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            const amountSum = "70000000000000000";

            expect((await erc20OnTargetChain.balanceOf(user.address)).toString()).to.be.equal(amountSum);

            await erc20OnTargetChain.connect(user).approve(await tokenManagerErc202.getAddress(), amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount);

            data = await messages.encodeTransferErc20Message(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), newSchainId, await tokenManagerErc202.getAddress(), data);
            expect((await erc20OnOriginChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            await erc20OnTargetChain.connect(user).approve(await tokenManagerErc202.getAddress(), amount2);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount2);

            data = await messages.encodeTransferErc20Message(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount2
            );

            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), newSchainId, await tokenManagerErc202.getAddress(), data);

            expect((await erc20OnOriginChain.balanceOf(user.address)).toString()).to.be.equal(amountSum);

        });

        it("should not be able to transfer X->Y->Z", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContract(newSchainName, await tokenManagerErc20.getAddress());

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20.addTokenManager(newSchainName, await tokenManagerErc202.getAddress());

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            const data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: await erc20OnOriginChain.decimals()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, await tokenManagerErc20.getAddress());

            await tokenManagerErc202.connect(deployer).grantRole(await tokenManagerErc202.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerErc202.connect(schainOwner).addERC20TokenByOwner(schainName,  await erc20OnOriginChain.getAddress(), await erc20OnTargetChain.getAddress());
            await messageProxyForSchain2.registerExtraContractForAll(await tokenManagerErc202.getAddress());

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            expect((await erc20OnTargetChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            const newSchainNameZ = "NewChainZ";

            const erc20OnTargetZChain = await deployERC20OnChain("NewTokenZ", "NTNZ");

            const keyStorageZ = await deployKeyStorageMock();
            const messageProxyForSchainZ = await deployMessageProxyForSchainTester(await keyStorageZ.getAddress(), newSchainNameZ);
            const tokenManagerLinkerZ = await deployTokenManagerLinker(messageProxyForSchainZ, deployer.address);
            const communityLockerZ = await deployCommunityLocker(newSchainName, await messageProxyForSchainZ.getAddress(), tokenManagerLinkerZ, fakeCommunityPool);
            const tokenManagerErc20Z = await deployTokenManagerERC20(newSchainNameZ, await messageProxyForSchainZ.getAddress(), tokenManagerLinkerZ, communityLockerZ, fakeDepositBox);
            await erc20OnTargetZChain.connect(deployer).grantRole(await erc20OnTargetZChain.MINTER_ROLE(), await tokenManagerErc20Z.getAddress());
            await tokenManagerLinkerZ.registerTokenManager(await tokenManagerErc20Z.getAddress());

            await messageProxyForSchain2.connect(deployer).grantRole(await messageProxyForSchain2.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain2.connect(deployer).addConnectedChain(newSchainNameZ);

            await tokenManagerErc202.addTokenManager(newSchainNameZ, await tokenManagerErc20Z.getAddress());

            await erc20OnTargetChain.connect(user).approve(await tokenManagerErc202.getAddress(), amount);

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainNameZ, await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Insufficient funds");

            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(newSchainNameZ, await erc20OnTargetChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect main chain token");
        });

        it("should not be able to transfer main chain token or clone to mainnet", async () => {
            const amount = "20000000000000000";
            await messageProxyForSchain.registerExtraContractForAll(await tokenManagerErc20.getAddress());
            await messageProxyForSchain2.registerExtraContractForAll(await tokenManagerErc202.getAddress());

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc20OnOriginChain.connect(deployer).mint(user.address, amount);
            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20.addTokenManager(newSchainName, await tokenManagerErc202.getAddress());

            // execution:
            await tokenManagerErc20
                .connect(user)
                .transferToSchainERC20(newSchainName, await erc20OnOriginChain.getAddress(), amount);

            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount,
                (await erc20OnOriginChain.totalSupply()).toString(),
                {
                    name: await erc20OnOriginChain.name(),
                    symbol: await erc20OnOriginChain.symbol(),
                    decimals: await erc20OnOriginChain.decimals()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerErc202.addTokenManager(schainName, await tokenManagerErc20.getAddress());

            await tokenManagerErc202.connect(deployer).grantRole(await tokenManagerErc202.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerErc202.connect(schainOwner).addERC20TokenByOwner(schainName,  await erc20OnOriginChain.getAddress(), await erc20OnTargetChain.getAddress());

            await messageProxyForSchain2.postMessage(await tokenManagerErc202.getAddress(), schainId, await tokenManagerErc20.getAddress(), data);

            expect((await erc20OnTargetChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            data = await messages.encodeActivateUserMessage(user.address);

            await messageProxyForSchain2.postMessage(await communityLocker2.getAddress(), mainnetId, fakeCommunityPool, data);

            await erc20OnTargetChain.connect(user).approve(await tokenManagerErc202.getAddress(), amount);

            await tokenManagerErc202
                .connect(user)
                .exitToMainERC20(await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Insufficient funds");

            await tokenManagerErc202
                .connect(user)
                .exitToMainERC20(await erc20OnTargetChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Incorrect main chain token");


            await tokenManagerErc202
                .connect(user)
                .transferToSchainERC20(schainName, await erc20OnOriginChain.getAddress(), amount);

            data = await messages.encodeTransferErc20Message(
                await erc20OnOriginChain.getAddress(),
                user.address,
                amount
            );

            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), newSchainId, await tokenManagerErc202.getAddress(), data);
            expect((await erc20OnOriginChain.balanceOf(user.address)).toString()).to.be.equal(amount);

            await erc20OnOriginChain.connect(user).approve(await tokenManagerErc20.getAddress(), amount);

            await tokenManagerErc20
                .connect(user)
                .exitToMainERC20(await erc20OnOriginChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Main chain token could not be transfered to Mainnet");

            await tokenManagerErc20
                .connect(user)
                .exitToMainERC20(await erc20OnTargetChain.getAddress(), amount)
                .should.be.eventually.rejectedWith("Insufficient funds");

        });

    });

    describe("tests for `postMessage` function", async () => {
        beforeEach(async () => {
            await messageProxyForSchain.registerExtraContractForAll(await tokenManagerErc20.getAddress());
        });

        it("should transfer ERC20 token with token info", async () => {
            //  preparation
            const amount = 10;
            const to = user.address;
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = "fromSchainName";
            const fromSchainHash = stringKeccak256(fromSchainName);
            await tokenManagerErc20.addTokenManager(fromSchainName, remoteTokenManagerAddress);
            // await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  await erc20OnMainnet.getAddress(), await erc20OnChain.getAddress());

            await erc20OnMainnet.mint(deployer.address, amount);
            const data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnMainnet.getAddress(),
                to,
                amount,
                await erc20OnMainnet.totalSupply(),
                {
                    name: await erc20OnMainnet.name(),
                    symbol: await erc20OnMainnet.symbol(),
                    decimals: await erc20OnMainnet.decimals()
                }
            );
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();

            // execution
            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), fromSchainHash, remoteTokenManagerAddress, data);
            // expectation
            const addressERC20OnSchain = await tokenManagerErc20.clonesErc20(fromSchainHash, await erc20OnMainnet.getAddress());
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect(parseInt((await targetErc20OnChain.balanceOf(to)).toString(), 10))
                .to.be.equal(amount);
        });

        it("should transfer ERC20 token to schain when token add by schain owner", async () => {
            //  preparation
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = "fromSchainName";
            const fromSchainHash = stringKeccak256(fromSchainName);
            await messageProxyForSchain.connect(deployer).addConnectedChain(fromSchainName);
            await tokenManagerErc20.addTokenManager(fromSchainName, remoteTokenManagerAddress);
            await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(fromSchainName,  await erc20OnMainnet.getAddress(), await erc20OnChain.getAddress());

            const amount = 10;
            const to = user.address;
            await erc20OnMainnet.mint(deployer.address, amount);
            const data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                await erc20OnMainnet.getAddress(),
                to,
                amount,
                await erc20OnMainnet.totalSupply()
            );
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();

            // execution
            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), fromSchainHash, remoteTokenManagerAddress, data);
            // expectation
            const addressERC20OnSchain = await tokenManagerErc20.clonesErc20(fromSchainHash, await erc20OnMainnet.getAddress());
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect(parseInt((await targetErc20OnChain.balanceOf(to)).toString(), 10))
                .to.be.equal(amount);
        });

        it("should should transfer token to schain and automatically deploy", async () => {
            //  preparation
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = "fromSchainName";
            const fromSchainHash = stringKeccak256(fromSchainName);
            await tokenManagerErc20.addTokenManager(fromSchainName, remoteTokenManagerAddress);

            const amount = 10;
            const to = user.address;
            await erc20OnMainnet.mint(deployer.address, amount);
            const data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnMainnet.getAddress(),
                to,
                amount,
                await erc20OnMainnet.totalSupply(),
                {
                    name: await erc20OnMainnet.name(),
                    symbol: await erc20OnMainnet.symbol(),
                    decimals: await erc20OnMainnet.decimals()
                }
            );

            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), fromSchainHash, remoteTokenManagerAddress, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();

            // execution
            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), fromSchainHash, remoteTokenManagerAddress, data);

            // expectation
            const addressERC20OnSchain = await tokenManagerErc20.clonesErc20(fromSchainHash, await erc20OnMainnet.getAddress());
            const targetErc20OnChain = (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect(parseInt((await targetErc20OnChain.balanceOf(to)).toString(), 10))
                .to.be.equal(amount);
        });

        it("should reject if message type is unknown", async () => {
            const data = "0x0000000000000000000000000000000000000000000000000000000000000001"+
            "000000000000000000000000a51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0"+
            "00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8"+
            "0000000000000000000000000000000000000000000000000000000000000001";
            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("MessageType is unknown");

        });

        it("should reject if total supply is exceeded", async () => {
            //  preparation
            const amount = 10;
            const to = user.address;
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = "fromSchainName";
            const fromSchainHash = stringKeccak256(fromSchainName);
            await tokenManagerErc20.addTokenManager(fromSchainName, remoteTokenManagerAddress);
            await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  await erc20OnMainnet.getAddress(), await erc20OnChain.getAddress());

            await erc20OnMainnet.mint(deployer.address, amount);
            let data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnMainnet.getAddress(),
                to,
                amount,
                await erc20OnMainnet.totalSupply(),
                {
                    name: await erc20OnMainnet.name(),
                    symbol: await erc20OnMainnet.symbol(),
                    decimals: await erc20OnMainnet.decimals()
                }
            );
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), fromSchainHash, remoteTokenManagerAddress, data);

            // execution
            const UINT256_MAX = BigInt(2 ^ 256 - 1);

            data = await messages.encodeTransferErc20AndTotalSupplyMessage(
                await erc20OnMainnet.getAddress(),
                to,
                UINT256_MAX,
                0);

            await messageProxyForSchain.postMessage(await tokenManagerErc20.getAddress(), mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("Total supply exceeded");
        });

        it("should top up a receiver", async () => {
            const amount = 10;
            const receiver = ethers.Wallet.createRandom().connect(ethers.provider);
            const remoteTokenManager = ethers.Wallet.createRandom();
            const sourceSchainName = "sourceSchain";
            const sourceSchainHash = stringKeccak256(sourceSchainName)
            await tokenManagerErc20.addTokenManager(sourceSchainName, remoteTokenManager.address);
            const etherbase = await (await ethers.getContractFactory("EtherbaseMock")).deploy() as EtherbaseMock;
            await etherbase.initialize(deployer.address);
            await etherbase.grantRole(await etherbase.ETHER_MANAGER_ROLE(), await messageProxyForSchain.getAddress());
            await messageProxyForSchain.setEtherbase(await etherbase.getAddress());
            await deployer.sendTransaction({to: await etherbase.getAddress(), value: ethers.parseEther("3")});

            let receiverBalance = await ethers.provider.getBalance(receiver.address);
            (receiverBalance).should.be.equal(0);

            const data = await messages.encodeTransferErc20AndTokenInfoMessage(
                await erc20OnMainnet.getAddress(),
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
                await tokenManagerErc20.getAddress(),
                sourceSchainHash,
                remoteTokenManager.address,
                data);
            receiverBalance = await ethers.provider.getBalance(receiver.address);
            (receiverBalance).should.be.equal(0);

            await expect(messageProxyForSchain.setMinimumReceiverBalance(ethers.parseEther("2")))
                .to.emit(messageProxyForSchain, 'MinimumReceiverBalanceChanged')
                .withArgs(0, ethers.parseEther("2"));

            await messageProxyForSchain.postMessage(
                await tokenManagerErc20.getAddress(),
                sourceSchainHash,
                remoteTokenManager.address,
                data);

            receiverBalance = await ethers.provider.getBalance(receiver.address);
            (receiverBalance).should.be.equal(await messageProxyForSchain.minimumReceiverBalance());
        })
    });
});
