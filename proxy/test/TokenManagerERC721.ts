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
 * @file TokenManagerERC721.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    ERC721OnChain,
    TokenManagerERC721,
    TokenManagerLinker,
    MessageProxyForSchainTester,
    MessagesTester,
    CommunityLocker
} from "../typechain";

import { randomString, stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

import { deployTokenManagerERC721 } from "./utils/deploy/schain/tokenManagerERC721";
import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployMessages } from "./utils/deploy/messages";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect, should } from "chai";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

describe("TokenManagerERC721", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

    const schainName = "V-chain";
    const schainId = stringValue(web3.utils.soliditySha3(schainName));
    const tokenId = 1;
    const mainnetName = "Mainnet";
    const mainnetId = stringValue(web3.utils.soliditySha3("Mainnet"));
    let to: string;
    let token: ERC721OnChain;
    let tokenClone: ERC721OnChain;
    let fakeDepositBox: string;
    let fakeCommunityPool: string;
    let tokenManagerERC721: TokenManagerERC721;
    let tokenManagerLinker: TokenManagerLinker;
    let messages: MessagesTester;
    let messageProxyForSchain: MessageProxyForSchainTester;
    let communityLocker: CommunityLocker;
    let token2: ERC721OnChain;
    let tokenClone2: ERC721OnChain;
    let token3: ERC721OnChain;
    let tokenClone3: ERC721OnChain;

    before(async () => {
        [deployer, user, schainOwner] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const keyStorage = await deployKeyStorageMock();
        messageProxyForSchain = await deployMessageProxyForSchainTester(keyStorage.address, schainName);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, deployer.address);
        messages = await deployMessages();
        fakeDepositBox = messages.address;
        fakeCommunityPool = messages.address;

        communityLocker = await deployCommunityLocker(schainName, messageProxyForSchain.address, tokenManagerLinker, fakeCommunityPool);

        tokenManagerERC721 =
            await deployTokenManagerERC721(
                schainName,
                messageProxyForSchain.address,
                tokenManagerLinker,
                communityLocker,
                fakeDepositBox
            );
        await tokenManagerERC721.connect(deployer).grantRole(await tokenManagerERC721.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        await tokenManagerERC721.connect(deployer).grantRole(await tokenManagerERC721.AUTOMATIC_DEPLOY_ROLE(), schainOwner.address);
        await tokenManagerLinker.registerTokenManager(tokenManagerERC721.address);

        tokenClone = await deployERC721OnChain("ELVIS", "ELV");
        token = await deployERC721OnChain("SKALE", "SKL");
        tokenClone2 = await deployERC721OnChain("ELVIS2", "ELV");
        token2 = await deployERC721OnChain("SKALE2", "SKL");
        tokenClone3 = await deployERC721OnChain("ELVIS3", "ELV");
        token3 = await deployERC721OnChain("SKALE3", "SKL");

        to = user.address;

        const data = await messages.encodeActivateUserMessage(user.address);
        await messageProxyForSchain.postMessage(communityLocker.address, mainnetId, fakeCommunityPool, data);

        const extraContractRegistrarRole = await messageProxyForSchain.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);

        await communityLocker.grantRole(await communityLocker.CONSTANT_SETTER_ROLE(), deployer.address);
        await communityLocker.setTimeLimitPerMessage(0);
    });

    it("should change depositBox address", async () => {
        const newDepositBox = user.address;
        expect(await tokenManagerERC721.depositBox()).to.equal(messages.address);
        await tokenManagerERC721.connect(user).changeDepositBoxAddress(newDepositBox)
            .should.be.eventually.rejectedWith("DEFAULT_ADMIN_ROLE is required");
        await tokenManagerERC721.connect(deployer).changeDepositBoxAddress(newDepositBox);
        expect(await tokenManagerERC721.depositBox()).to.equal(newDepositBox);
    });

    it("should successfully call exitToMainERC721", async () => {
        // should be "No token clone on schain" if chains were different
        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("ERC721: approved query for nonexistent token");

        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, tokenClone.address);
        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("ERC721: approved query for nonexistent token");

        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

        await tokenClone.connect(user).approve(tokenManagerERC721.address, tokenId);
        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("Sender contract is not registered");

        await messageProxyForSchain.registerExtraContract("Mainnet", tokenManagerERC721.address);
        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, tokenId);

        await messageProxyForSchain.removeExtraContract("Mainnet", tokenManagerERC721.address);
        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenClone.connect(user).approve(tokenManagerERC721.address, tokenId);

        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("Sender contract is not registered");

        const outgoingMessagesCounterMainnet = BigNumber.from(
            await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet")
        );
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    it("should be rejected when call exitToMainERC721 if remove contract for all chains", async () => {
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, tokenClone.address);
        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenClone.connect(user).approve(tokenManagerERC721.address, tokenId);
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721.address);

        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, tokenId);

        await messageProxyForSchain.removeExtraContractForAll(tokenManagerERC721.address);
        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenClone.connect(user).approve(tokenManagerERC721.address, tokenId);

        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("Sender contract is not registered");

        const outgoingMessagesCounterMainnet = BigNumber.from(
            await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet")
        );
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    it("should successfully call addERC721TokenByOwner", async () => {
        await tokenManagerERC721.connect(user).addERC721TokenByOwner(mainnetName,  token.address, tokenClone.address)
            .should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");

        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, deployer.address)
            .should.be.eventually.rejectedWith("Given address is not a contract");

        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, tokenClone.address);

        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token2.address, tokenClone.address)
            .should.be.eventually.rejectedWith("Clone was already added");

        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, tokenClone2.address)
            .should.be.eventually.rejectedWith("Could not relink clone");
    });

    describe("tests for transferToSchainERC721", async () => {

        let erc721OnOriginChain: ERC721OnChain;
        let erc721OnTargetChain: ERC721OnChain;
        let messageProxyForSchain2: MessageProxyForSchainTester;
        let tokenManagerLinker2: TokenManagerLinker;
        let tokenManagerERC7212: TokenManagerERC721;
        let communityLocker2: CommunityLocker;
        const newSchainName = "NewChain";
        const newSchainId = stringValue(web3.utils.soliditySha3(newSchainName));

        beforeEach(async () => {
            erc721OnOriginChain = await deployERC721OnChain("NewToken", "NTN");
            erc721OnTargetChain = await deployERC721OnChain("NewToke1n", "NTN1");

            const keyStorage2 = await deployKeyStorageMock();
            messageProxyForSchain2 = await deployMessageProxyForSchainTester(keyStorage2.address, newSchainName);
            tokenManagerLinker2 = await deployTokenManagerLinker(messageProxyForSchain2, deployer.address);
            communityLocker2 = await deployCommunityLocker(newSchainName, messageProxyForSchain2.address, tokenManagerLinker2, fakeCommunityPool);
            tokenManagerERC7212 = await deployTokenManagerERC721(newSchainName, messageProxyForSchain2.address, tokenManagerLinker2, communityLocker2, fakeDepositBox);
            await erc721OnTargetChain.connect(deployer).grantRole(await erc721OnTargetChain.MINTER_ROLE(), tokenManagerERC7212.address);
            await tokenManagerLinker2.registerTokenManager(tokenManagerERC7212.address);
        });

        it("should invoke `transferToSchainERC721` without mistakes", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721.addTokenManager(newSchainName, tokenManagerERC7212.address);

            // execution:
            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should invoke `transferToSchainERC721` and receive tokens without mistakes", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721.addTokenManager(newSchainName, tokenManagerERC7212.address);

            // execution:
            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            const data = await messages.encodeTransferErc721AndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC7212.addTokenManager(schainName, tokenManagerERC721.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC7212.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            const addressERC721OnSchain = await tokenManagerERC7212.clonesErc721(schainId, erc721OnOriginChain.address);
            const targetErc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

        });

        it("should invoke `transferToSchainERC721` and receive tokens without mistakes double", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721.addTokenManager(newSchainName, tokenManagerERC7212.address);

            // execution:
            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721AndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC7212.addTokenManager(schainName, tokenManagerERC721.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC7212.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            const addressERC721OnSchain = await tokenManagerERC7212.clonesErc721(schainId, erc721OnOriginChain.address);
            const targetErc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

            const tokenId2 = 2;

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId2);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);

        });

        it("should invoke `transferToSchainERC721` and receive tokens without mistakes double with attached token", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721.addTokenManager(newSchainName, tokenManagerERC7212.address);

            // execution:
            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721AndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:

            await tokenManagerERC7212.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address).should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");
            await tokenManagerERC7212.connect(deployer).grantRole(await tokenManagerERC7212.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC7212.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address).should.be.eventually.rejectedWith("Chain is not connected");

            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC7212.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address);
            await tokenManagerERC7212.addTokenManager(schainName, tokenManagerERC721.address);

            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            expect((await erc721OnTargetChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

            const tokenId2 = 2;

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId2);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            expect((await erc721OnTargetChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);

        });

        it("should invoke `transferToSchainERC721` and transfer back without mistakes", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721.addTokenManager(newSchainName, tokenManagerERC7212.address);

            // execution:
            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721AndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC7212.addTokenManager(schainName, tokenManagerERC721.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC7212.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            const addressERC721OnSchain = await tokenManagerERC7212.clonesErc721(schainId, erc721OnOriginChain.address);
            const targetErc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await targetErc721OnChain.connect(user).approve(tokenManagerERC7212.address, tokenId);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC7212.address);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721.address, newSchainId, tokenManagerERC7212.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

        });

        it("should invoke `transferToSchainERC721` and transfer back without mistakes with attached tokens", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721.addTokenManager(newSchainName, tokenManagerERC7212.address);

            // execution:
            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721AndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC7212.addTokenManager(schainName, tokenManagerERC721.address);

            await tokenManagerERC7212.connect(deployer).grantRole(await tokenManagerERC7212.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC7212.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC7212.address, tokenId);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC7212.address);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721.address, newSchainId, tokenManagerERC7212.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

        });


        it("should invoke `transferToSchainERC721` and transfer back without mistakes double", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721.addTokenManager(newSchainName, tokenManagerERC7212.address);

            // execution:
            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721AndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC7212.addTokenManager(schainName, tokenManagerERC721.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC7212.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            const addressERC721OnSchain = await tokenManagerERC7212.clonesErc721(schainId, erc721OnOriginChain.address);
            const targetErc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await targetErc721OnChain.connect(user).approve(tokenManagerERC7212.address, tokenId);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC7212.address);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721.address, newSchainId, tokenManagerERC7212.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

            const tokenId2 = 2;

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId2);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);

            await targetErc721OnChain.connect(user).approve(tokenManagerERC7212.address, tokenId);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721.address, newSchainId, tokenManagerERC7212.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

            await targetErc721OnChain.connect(user).approve(tokenManagerERC7212.address, tokenId2);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721.address, newSchainId, tokenManagerERC7212.address, data);

            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);

        });

        it("should invoke `transferToSchainERC721` and transfer back without mistakes double with attached tokens", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721.addTokenManager(newSchainName, tokenManagerERC7212.address);

            // execution:
            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721AndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC7212.addTokenManager(schainName, tokenManagerERC721.address);

            await tokenManagerERC7212.connect(deployer).grantRole(await tokenManagerERC7212.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC7212.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC7212.address, tokenId);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC7212.address);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721.address, newSchainId, tokenManagerERC7212.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            expect((await erc721OnTargetChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

            const tokenId2 = 2;

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721.address, tokenId2);

            await tokenManagerERC721
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC7212.address, schainId, tokenManagerERC721.address, data);

            expect((await erc721OnTargetChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC7212.address, tokenId);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721.address, newSchainId, tokenManagerERC7212.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC7212.address, tokenId2);

            await tokenManagerERC7212
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721Message(
                erc721OnOriginChain.address,
                user.address,
                tokenId2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721.address, newSchainId, tokenManagerERC7212.address, data);

            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
        });

    });

    describe("tests for `postMessage` function", async () => {

        it("should transfer ERC721 token token with token info", async () => {
            //  preparation
            const data = await messages.encodeTransferErc721AndTokenInfoMessage(
                token.address,
                to,
                tokenId,
                {
                    name: await token.name(),
                    symbol: await token.symbol()
                }
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721.address, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC721.connect(schainOwner).enableAutomaticDeploy();
            await messageProxyForSchain.postMessage(tokenManagerERC721.address, mainnetId, fakeDepositBox, data);
            const addressERC721OnSchain = await tokenManagerERC721.clonesErc721(mainnetId, token.address);
            const erc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await erc721OnChain.functions.ownerOf(tokenId))[0]).to.be.equal(to);
        });

        it("should transfer ERC721 token on schain", async () => {
            //  preparation
            await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, tokenClone.address);
            await tokenClone.connect(deployer).grantRole(await tokenClone.MINTER_ROLE(), tokenManagerERC721.address);

            const data = await messages.encodeTransferErc721Message(
                token.address,
                to,
                tokenId
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721.address, mainnetId, fakeDepositBox, data);
            const addressERC721OnSchain = await tokenManagerERC721.clonesErc721(mainnetId, token.address);
            const erc721OnChain = (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await erc721OnChain.functions.ownerOf(tokenId))[0]).to.be.equal(to);
        });

        it("should reject if message type is unknown", async () => {
            const data = "0x0000000000000000000000000000000000000000000000000000000000000001"+
            "000000000000000000000000a51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0"+
            "00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8"+
            "0000000000000000000000000000000000000000000000000000000000000001";
            await messageProxyForSchain.postMessage(tokenManagerERC721.address, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("MessageType is unknown");

        });
    });
});
