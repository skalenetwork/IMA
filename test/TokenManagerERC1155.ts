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
 * @file TokenManagerERC1155.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai from "chai";
import {
    ERC1155OnChain,
    TokenManagerERC1155,
    TokenManagerLinker,
    MessageProxyForSchainTester,
    MessagesTester,
    CommunityLocker
} from "../typechain";


import { skipTime } from "./utils/time";

chai.should();
chai.use(chaiAsPromised);

import { deployTokenManagerERC1155 } from "./utils/deploy/schain/tokenManagerERC1155";
import { deployERC1155OnChain } from "./utils/deploy/erc1155OnChain";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployMessages } from "./utils/deploy/messages";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { expect } from "chai";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

describe("TokenManagerERC1155", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

    const schainName = "V-chain";
    const schainId = ethers.id(schainName);
    const id = 1;
    const amount = 4;
    const ids = [1, 2, 3, 4];
    const amounts = [4, 3, 2, 1];
    const mainnetName = "Mainnet";
    const mainnetId = ethers.id("Mainnet");
    let to: string;
    let token: ERC1155OnChain;
    let fakeDepositBox: string;
    let fakeCommunityPool: string;
    let tokenClone: ERC1155OnChain;
    let tokenManagerERC1155: TokenManagerERC1155;
    let tokenManagerLinker: TokenManagerLinker;
    let messages: MessagesTester;
    let messageProxyForSchain: MessageProxyForSchainTester;
    let communityLocker: CommunityLocker;
    let token2: ERC1155OnChain;
    let tokenClone2: ERC1155OnChain;

    before(async () => {
        [deployer, user, schainOwner] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const keyStorage = await deployKeyStorageMock();
        messageProxyForSchain = await deployMessageProxyForSchainTester(keyStorage, schainName);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, deployer.address);
        messages = await deployMessages();
        fakeDepositBox = user.address;
        fakeCommunityPool = user.address;

        communityLocker = await deployCommunityLocker(schainName, messageProxyForSchain, tokenManagerLinker, fakeCommunityPool);

        tokenManagerERC1155 =
            await deployTokenManagerERC1155(
                schainName,
                messageProxyForSchain,
                tokenManagerLinker,
                communityLocker,
                fakeDepositBox
            );
        await tokenManagerLinker.registerTokenManager(tokenManagerERC1155);
        await tokenManagerERC1155.grantRole(await tokenManagerERC1155.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        await tokenManagerERC1155.grantRole(await tokenManagerERC1155.AUTOMATIC_DEPLOY_ROLE(), schainOwner.address);

        tokenClone = await deployERC1155OnChain("ELVIS Multi Token");
        token = await deployERC1155OnChain("ELVIS Multi Token");
        tokenClone2 = await deployERC1155OnChain("ELVIS2 Multi Token");
        token2 = await deployERC1155OnChain("ELVIS2 Multi Token");

        to = user.address;

        const data = await messages.encodeActivateUserMessage(user.address);
        await messageProxyForSchain.postMessage(communityLocker, mainnetId, fakeCommunityPool, data);

        const extraContractRegistrarRole = await messageProxyForSchain.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC1155);
    });

    it("should change depositBox address", async () => {
        const newDepositBox = user.address;
        expect(await tokenManagerERC1155.depositBox()).to.equal(fakeDepositBox);
        await tokenManagerERC1155.connect(user).changeDepositBoxAddress(newDepositBox)
            .should.be.eventually.rejectedWith("DEFAULT_ADMIN_ROLE is required");
        await tokenManagerERC1155.changeDepositBoxAddress(newDepositBox);
        expect(await tokenManagerERC1155.depositBox()).to.equal(newDepositBox);
    });

    it("should successfully call exitToMainERC1155", async () => {
        // should be "No token clone on schain" if chains were different
        await tokenManagerERC1155.connect(user).exitToMainERC1155(token, id, amount)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token, tokenClone);
        await tokenManagerERC1155.connect(user).exitToMainERC1155(token, id, amount)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenClone.connect(deployer).mint(user.address, id, amount, "0x");
        await tokenManagerERC1155.connect(user).exitToMainERC1155(token, id, amount)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenClone.connect(user).setApprovalForAll(tokenManagerERC1155, true);
        await tokenManagerERC1155.connect(user).exitToMainERC1155(token, id, amount);

        const outgoingMessagesCounterMainnet = await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet");
        outgoingMessagesCounterMainnet.should.be.equal(1);
    });

    it("should successfully call exitToMainERC1155Batch", async () => {
        // should be "No token clone on schain" if chains were different
        await tokenManagerERC1155.connect(user).exitToMainERC1155Batch(token, ids, amounts)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token, tokenClone);
        await tokenManagerERC1155.connect(user).exitToMainERC1155Batch(token, ids, amounts)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenClone.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
        await tokenManagerERC1155.connect(user).exitToMainERC1155Batch(token, ids, amounts)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenClone.connect(user).setApprovalForAll(tokenManagerERC1155, true);
        await tokenManagerERC1155.connect(user).exitToMainERC1155Batch(token, ids, amounts);

        const outgoingMessagesCounterMainnet = await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet");
        outgoingMessagesCounterMainnet.should.be.equal(1);
    });

    it("should successfully call addERC1155TokenByOwner", async () => {
        await tokenManagerERC1155.connect(user).addERC1155TokenByOwner(mainnetName,  token, tokenClone)
            .should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token, deployer.address)
            .should.be.eventually.rejectedWith("Given address is not a contract");

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token, tokenClone);

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token2, tokenClone)
            .should.be.eventually.rejectedWith("Clone was already added");

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token, tokenClone2)
            .should.be.eventually.rejectedWith("Could not relink clone");
    });

    describe("tests for transferToSchainERC1155", async () => {

        let erc1155OnOriginChain: ERC1155OnChain;
        let erc1155OnTargetChain: ERC1155OnChain;
        let messageProxyForSchain2: MessageProxyForSchainTester;
        let tokenManagerLinker2: TokenManagerLinker;
        let tokenManagerERC11552: TokenManagerERC1155;
        let communityLocker2: CommunityLocker;
        const newSchainName = "NewChain";
        const newSchainId = ethers.id(newSchainName);

        beforeEach(async () => {
            erc1155OnOriginChain = await deployERC1155OnChain("NewToken");
            erc1155OnTargetChain = await deployERC1155OnChain("NewToke1n");

            const keyStorage2 = await deployKeyStorageMock();
            messageProxyForSchain2 = await deployMessageProxyForSchainTester(keyStorage2, newSchainName);
            tokenManagerLinker2 = await deployTokenManagerLinker(messageProxyForSchain2, deployer.address);
            communityLocker2 = await deployCommunityLocker(newSchainName, messageProxyForSchain2, tokenManagerLinker2, fakeCommunityPool);
            tokenManagerERC11552 = await deployTokenManagerERC1155(newSchainName, messageProxyForSchain2, tokenManagerLinker2, communityLocker2, fakeDepositBox);
            await erc1155OnTargetChain.connect(deployer).grantRole(await erc1155OnTargetChain.MINTER_ROLE(), tokenManagerERC11552);
            await tokenManagerLinker2.registerTokenManager(tokenManagerERC11552);
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerERC11552);
        });

        it("should invoke `transferToSchainERC1155` without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);
        });

        it("should reject `transferToSchainERC1155` when executing earlier then allowed", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, 5, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, 1)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, 1)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, 1);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(1);


            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, 1);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await communityLocker.grantRole(await communityLocker.CONSTANT_SETTER_ROLE(), deployer.address);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, 1)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await skipTime(90);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, 1)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await skipTime(20);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, 1);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(3);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 0);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, 1);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(4);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, 1)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(4);

            await skipTime(110);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, 1);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(5);
        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            const data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);


            await messageProxyForSchain2
                .postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain);
            const targetErc1155OnChain = (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect((await targetErc1155OnChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes double", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);


            await messageProxyForSchain2
                .postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain);
            const targetErc1155OnChain = (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect((await targetErc1155OnChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            const amount2 = 77;

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const amountSum = 81;

            expect((await targetErc1155OnChain.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes double with attached token", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:

            await tokenManagerERC11552
                .connect(schainOwner)
                .addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain)
                .should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");
            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552
                .connect(schainOwner)
                .addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain)
                .should.be.eventually.rejectedWith("Chain is not connected");

            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            expect((await erc1155OnTargetChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            const amount2 = 77;

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const amountSum = 81;

            expect((await erc1155OnTargetChain.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect((await targetErc1155OnChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            expect((await erc1155OnOriginChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes with attached tokens", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552
                .connect(schainOwner)
                .addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);
            expect((await erc1155OnOriginChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

        });


        it("should invoke `transferToSchainERC1155` and transfer back without mistakes double", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);


            await messageProxyForSchain2
                .postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect((await targetErc1155OnChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);
            expect((await erc1155OnOriginChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            expect((await targetErc1155OnChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            const amount2 = 77;

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const amountSum = 81;

            expect((await targetErc1155OnChain.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);
            expect((await erc1155OnOriginChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            expect((await erc1155OnOriginChain.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes double with attached tokens", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);
            expect((await erc1155OnOriginChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            expect((await erc1155OnTargetChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            const amount2 = 77;

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const amountSum = 81;

            expect((await erc1155OnTargetChain.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);
            expect((await erc1155OnOriginChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            expect((await erc1155OnOriginChain.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

        });

        it("should not be able to transfer X->Y->Z", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            const data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain);

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            expect((await erc1155OnTargetChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            const newSchainNameZ = "NewChainZ";

            const erc1155OnTargetZChain = await deployERC1155OnChain("NewTokenZ");

            const keyStorageZ = await deployKeyStorageMock();
            const messageProxyForSchainZ = await deployMessageProxyForSchainTester(keyStorageZ, newSchainNameZ);
            const tokenManagerLinkerZ = await deployTokenManagerLinker(messageProxyForSchainZ, deployer.address);
            const communityLockerZ = await deployCommunityLocker(newSchainName, messageProxyForSchainZ, tokenManagerLinkerZ, fakeCommunityPool);
            const tokenManagerERC1155Z = await deployTokenManagerERC1155(
                newSchainNameZ, messageProxyForSchainZ, tokenManagerLinkerZ, communityLockerZ, fakeDepositBox
            );
            await erc1155OnTargetZChain.connect(deployer).grantRole(await erc1155OnTargetZChain.MINTER_ROLE(), tokenManagerERC1155Z);
            await tokenManagerLinkerZ.registerTokenManager(tokenManagerERC1155Z);

            await messageProxyForSchain2.connect(deployer).grantRole(await messageProxyForSchain2.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain2.connect(deployer).addConnectedChain(newSchainNameZ);

            await tokenManagerERC11552.addTokenManager(newSchainNameZ, tokenManagerERC1155Z);

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(newSchainNameZ, erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(newSchainNameZ, erc1155OnTargetChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect main chain token");
        });

        it("should not be able to transfer main chain token or clone to mainnet", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain);

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            expect((await erc1155OnTargetChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            data = await messages.encodeActivateUserMessage(user.address);

            await messageProxyForSchain2.postMessage(communityLocker2, mainnetId, fakeCommunityPool, data);

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .exitToMainERC1155(erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await tokenManagerERC11552
                .connect(user)
                .exitToMainERC1155(erc1155OnTargetChain, id, amount)
                .should.be.eventually.rejectedWith("Incorrect main chain token");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            expect((await erc1155OnOriginChain.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await tokenManagerERC1155
                .connect(user)
                .exitToMainERC1155(erc1155OnOriginChain, id, amount)
                .should.be.eventually.rejectedWith("Main chain token could not be transfered to Mainnet");

            await tokenManagerERC1155
                .connect(user)
                .exitToMainERC1155(erc1155OnTargetChain, id, amount)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        });

    });

    describe("tests for transferToSchainERC1155Batch", async () => {

        let erc1155OnOriginChain: ERC1155OnChain;
        let erc1155OnTargetChain: ERC1155OnChain;
        let messageProxyForSchain2: MessageProxyForSchainTester;
        let tokenManagerLinker2: TokenManagerLinker;
        let tokenManagerERC11552: TokenManagerERC1155;
        let communityLocker2: CommunityLocker;
        const newSchainName = "NewChain";
        const newSchainId = ethers.id(newSchainName);

        beforeEach(async () => {
            erc1155OnOriginChain = await deployERC1155OnChain("NewToken");
            erc1155OnTargetChain = await deployERC1155OnChain("NewToke1n");

            const keyStorage2 = await deployKeyStorageMock();
            messageProxyForSchain2 = await deployMessageProxyForSchainTester(keyStorage2, newSchainName);
            tokenManagerLinker2 = await deployTokenManagerLinker(messageProxyForSchain2, deployer.address);
            communityLocker2 = await deployCommunityLocker(newSchainName, messageProxyForSchain2, tokenManagerLinker2, fakeCommunityPool);
            tokenManagerERC11552 = await deployTokenManagerERC1155(newSchainName, messageProxyForSchain2, tokenManagerLinker2, communityLocker2, fakeDepositBox);
            await erc1155OnTargetChain.connect(deployer).grantRole(await erc1155OnTargetChain.MINTER_ROLE(), tokenManagerERC11552);
            await tokenManagerLinker2.registerTokenManager(tokenManagerERC11552);
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerERC11552);
        });

        it("should invoke `transferToSchainERC1155` without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);
        });

        it("should reject `transferToSchainERC1155` when executing earlier then allowed", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, [5, 5, 5, 5], "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, [1, 1, 1, 1])
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, [1, 1, 1, 1])
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, [1, 1, 1, 1]);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(1);


            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, [1, 1, 1, 1]);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await communityLocker.grantRole(await communityLocker.CONSTANT_SETTER_ROLE(), deployer.address);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, [1, 1, 1, 1])
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await skipTime(90);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, [1, 1, 1, 1])
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await skipTime(20);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, [1, 1, 1, 1]);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(3);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 0);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, [1, 1, 1, 1]);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(4);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, [1, 1, 1, 1])
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(4);

            await skipTime(110);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, [1, 1, 1, 1]);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(5);
        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            const data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;

            const balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            const balanceIdsNumber: number[] = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes double", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;

            let balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            let balanceIdsNumber: number[] = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            const amounts2 = [77, 78, 79, 80];

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const amountsSum = [81, 81, 81, 81];

            balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes double with attached token", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:

            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain).should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");
            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain).should.be.eventually.rejectedWith("Chain is not connected");

            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            let balanceIds = await erc1155OnTargetChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            let balanceIdsNumber: number[] = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            const amounts2 = [77, 78, 79, 80];

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const amountsSum = [81, 81, 81, 81];

            balanceIds = await erc1155OnTargetChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);


            await messageProxyForSchain2
                .postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;

            let balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            let balanceIdsNumber: number[] = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes with attached tokens", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            const balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            const balanceIdsNumber: number[] = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

        });


        it("should invoke `transferToSchainERC1155` and transfer back without mistakes double", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);


            await messageProxyForSchain2
                .postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;

            let balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            let balanceIdsNumber: number[] = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            const amounts2 = [77, 78, 79, 80];

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const amountsSum = [81, 81, 81, 81];

            balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes double with attached tokens", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            let balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            let balanceIdsNumber: number[] = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            balanceIds = await erc1155OnTargetChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            const amounts2 = [77, 78, 79, 80];

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const amountsSum = [81, 81, 81, 81];

            balanceIds = await erc1155OnTargetChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

        });

        it("should not be able to transfer X->Y->Z", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            const data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain);

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            const balanceIds = await erc1155OnTargetChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            const balanceIdsNumber: number[] = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            const newSchainNameZ = "NewChainZ";

            const erc1155OnTargetZChain = await deployERC1155OnChain("NewTokenZ");

            const keyStorageZ = await deployKeyStorageMock();
            const messageProxyForSchainZ = await deployMessageProxyForSchainTester(keyStorageZ, newSchainNameZ);
            const tokenManagerLinkerZ = await deployTokenManagerLinker(messageProxyForSchainZ, deployer.address);
            const communityLockerZ = await deployCommunityLocker(newSchainName, messageProxyForSchainZ, tokenManagerLinkerZ, fakeCommunityPool);
            const tokenManagerERC1155Z = await deployTokenManagerERC1155(newSchainNameZ, messageProxyForSchainZ, tokenManagerLinkerZ, communityLockerZ, fakeDepositBox);
            await erc1155OnTargetZChain.connect(deployer).grantRole(await erc1155OnTargetZChain.MINTER_ROLE(), tokenManagerERC1155Z);
            await tokenManagerLinkerZ.registerTokenManager(tokenManagerERC1155Z);

            await messageProxyForSchain2.connect(deployer).grantRole(await messageProxyForSchain2.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain2.connect(deployer).addConnectedChain(newSchainNameZ);

            await tokenManagerERC11552.addTokenManager(newSchainNameZ, tokenManagerERC1155Z);

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(newSchainNameZ, erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(newSchainNameZ, erc1155OnTargetChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect main chain token");
        });

        it("should not be able to transfer main chain token or clone to mainnet", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155, true);

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain, erc1155OnTargetChain);

            await messageProxyForSchain2.postMessage(tokenManagerERC11552, schainId, tokenManagerERC1155, data);

            let balanceIds = await erc1155OnTargetChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            let balanceIdsNumber: number[] = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            data = await messages.encodeActivateUserMessage(user.address);

            await messageProxyForSchain2.postMessage(communityLocker2, mainnetId, fakeCommunityPool, data);

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552, true);

            await tokenManagerERC11552
                .connect(user)
                .exitToMainERC1155Batch(erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await tokenManagerERC11552
                .connect(user)
                .exitToMainERC1155Batch(erc1155OnTargetChain, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect main chain token");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, newSchainId, tokenManagerERC11552, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await tokenManagerERC1155
                .connect(user)
                .exitToMainERC1155Batch(erc1155OnOriginChain, ids, amounts)
                .should.be.eventually.rejectedWith("Main chain token could not be transfered to Mainnet");

            await tokenManagerERC1155
                .connect(user)
                .exitToMainERC1155Batch(erc1155OnTargetChain, ids, amounts)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        });

    });

    describe("tests for `postMessage` function", async () => {

        it("should transfer ERC1155 token through `postMessage` function with token info", async () => {
            //  preparation
            const data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                token,
                to,
                id,
                amount,
                {
                    uri: await token.uri(0)
                }
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC1155.connect(schainOwner).enableAutomaticDeploy();
            await messageProxyForSchain.postMessage(tokenManagerERC1155, mainnetId, fakeDepositBox, data);
            const addressERC1155OnSchain = await tokenManagerERC1155.clonesErc1155(mainnetId, token);
            const erc1155OnChain = (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect(await erc1155OnChain.balanceOf(to, id)).to.be.equal(amount);
        });

        it("should transfer ERC1155 token on schain", async () => {
            //  preparation
            await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token, tokenClone);
            await tokenClone.connect(deployer).grantRole(await tokenClone.MINTER_ROLE(), tokenManagerERC1155);

            const data = await messages.encodeTransferErc1155Message(
                token,
                to,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, mainnetId, fakeDepositBox, data);
            const addressERC1155OnSchain = await tokenManagerERC1155.clonesErc1155(mainnetId, token);
            const erc1155OnChain = (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect(await erc1155OnChain.balanceOf(to, id)).to.be.equal(amount);
        });

        it("should transfer ERC1155 token batch through `postMessage` function with token info", async () => {
            //  preparation
            const data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                token,
                to,
                ids,
                amounts,
                {
                    uri: await token.uri(0)
                }
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC1155.connect(schainOwner).enableAutomaticDeploy();
            await messageProxyForSchain.postMessage(tokenManagerERC1155, mainnetId, fakeDepositBox, data);
            const addressERC1155OnSchain = await tokenManagerERC1155.clonesErc1155(mainnetId, token);
            const erc1155OnChain = (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;

            const balanceIds = await erc1155OnChain.balanceOfBatch([to, to, to, to], ids);
            const balanceIdsNumber: number[] = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);
        });

        it("should transfer ERC1155 token batch on schain", async () => {
            //  preparation
            await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token, tokenClone);
            await tokenClone.connect(deployer).grantRole(await tokenClone.MINTER_ROLE(), tokenManagerERC1155);

            const data = await messages.encodeTransferErc1155BatchMessage(
                token,
                to,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155, mainnetId, fakeDepositBox, data);
            const addressERC1155OnSchain = await tokenManagerERC1155.clonesErc1155(mainnetId, token);
            const erc1155OnChain = (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            const balanceIds = await erc1155OnChain.balanceOfBatch([to, to, to, to], ids);
            const balanceIdsNumber: number[] = [];
            balanceIds.forEach((element) => {
                balanceIdsNumber.push(Number(element))
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);
        });

        it("should reject if message type is unknown", async () => {
            const data = "0x0000000000000000000000000000000000000000000000000000000000000001"+
            "000000000000000000000000a51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0"+
            "00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8"+
            "0000000000000000000000000000000000000000000000000000000000000001";
            await messageProxyForSchain.postMessage(tokenManagerERC1155, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("MessageType is unknown");

        });

    });
});
