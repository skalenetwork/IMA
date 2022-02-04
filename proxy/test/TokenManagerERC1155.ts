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
import chai = require("chai");
import {
    ERC1155OnChain,
    TokenManagerERC1155,
    TokenManagerLinker,
    MessageProxyForSchainTester,
    MessagesTester,
    CommunityLocker
} from "../typechain";

import { randomString, stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

import { deployTokenManagerERC1155 } from "./utils/deploy/schain/tokenManagerERC1155";
import { deployERC1155OnChain } from "./utils/deploy/erc1155OnChain";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployMessages } from "./utils/deploy/messages";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { expect } from "chai";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

describe("TokenManagerERC1155", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

    const schainName = "V-chain";
    const schainId = stringValue(web3.utils.soliditySha3(schainName));
    const id = 1;
    const amount = 4;
    const ids = [1, 2, 3, 4];
    const amounts = [4, 3, 2, 1];
    const mainnetName = "Mainnet";
    const mainnetId = stringValue(web3.utils.soliditySha3("Mainnet"));
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
    let token3: ERC1155OnChain;
    let tokenClone3: ERC1155OnChain;

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

        tokenManagerERC1155 =
            await deployTokenManagerERC1155(
                schainName,
                messageProxyForSchain.address,
                tokenManagerLinker,
                communityLocker,
                fakeDepositBox
            );
        await tokenManagerLinker.registerTokenManager(tokenManagerERC1155.address);
        await tokenManagerERC1155.grantRole(await tokenManagerERC1155.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        await tokenManagerERC1155.grantRole(await tokenManagerERC1155.AUTOMATIC_DEPLOY_ROLE(), schainOwner.address);

        tokenClone = await deployERC1155OnChain("ELVIS Multi Token");
        token = await deployERC1155OnChain("ELVIS Multi Token");
        tokenClone2 = await deployERC1155OnChain("ELVIS2 Multi Token");
        token2 = await deployERC1155OnChain("ELVIS2 Multi Token");
        tokenClone3 = await deployERC1155OnChain("ELVIS3 Multi Token");
        token3 = await deployERC1155OnChain("ELVIS3 Multi Token");

        to = user.address;

        const data = await messages.encodeActivateUserMessage(user.address);
        await messageProxyForSchain.postMessage(communityLocker.address, mainnetId, fakeCommunityPool, data);

        const extraContractRegistrarRole = await messageProxyForSchain.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC1155.address);
    });

    it("should change depositBox address", async () => {
        const newDepositBox = user.address;
        expect(await tokenManagerERC1155.depositBox()).to.equal(messages.address);
        await tokenManagerERC1155.connect(user).changeDepositBoxAddress(newDepositBox)
            .should.be.eventually.rejectedWith("DEFAULT_ADMIN_ROLE is required");
        await tokenManagerERC1155.changeDepositBoxAddress(newDepositBox);
        expect(await tokenManagerERC1155.depositBox()).to.equal(newDepositBox);
    });

    it("should successfully call exitToMainERC1155", async () => {
        // should be "No token clone on schain" if chains were different
        await tokenManagerERC1155.connect(user).exitToMainERC1155(token.address, id, amount)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token.address, tokenClone.address);
        await tokenManagerERC1155.connect(user).exitToMainERC1155(token.address, id, amount)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenClone.connect(deployer).mint(user.address, id, amount, "0x");
        await tokenManagerERC1155.connect(user).exitToMainERC1155(token.address, id, amount)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenClone.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);
        await tokenManagerERC1155.connect(user).exitToMainERC1155(token.address, id, amount);

        const outgoingMessagesCounterMainnet = BigNumber.from(
            await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet")
        );
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    it("should successfully call exitToMainERC1155Batch", async () => {
        // should be "No token clone on schain" if chains were different
        await tokenManagerERC1155.connect(user).exitToMainERC1155Batch(token.address, ids, amounts)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token.address, tokenClone.address);
        await tokenManagerERC1155.connect(user).exitToMainERC1155Batch(token.address, ids, amounts)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenClone.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
        await tokenManagerERC1155.connect(user).exitToMainERC1155Batch(token.address, ids, amounts)
            .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

        await tokenClone.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);
        await tokenManagerERC1155.connect(user).exitToMainERC1155Batch(token.address, ids, amounts);

        const outgoingMessagesCounterMainnet = BigNumber.from(
            await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet")
        );
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    it("should successfully call addERC1155TokenByOwner", async () => {
        await tokenManagerERC1155.connect(user).addERC1155TokenByOwner(mainnetName,  token.address, tokenClone.address)
            .should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token.address, deployer.address)
            .should.be.eventually.rejectedWith("Given address is not a contract");

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token.address, tokenClone.address);

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token2.address, tokenClone.address)
            .should.be.eventually.rejectedWith("Clone was already added");

        await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token.address, tokenClone2.address)
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
        const newSchainId = stringValue(web3.utils.soliditySha3(newSchainName));

        beforeEach(async () => {
            erc1155OnOriginChain = await deployERC1155OnChain("NewToken");
            erc1155OnTargetChain = await deployERC1155OnChain("NewToke1n");

            const keyStorage2 = await deployKeyStorageMock();
            messageProxyForSchain2 = await deployMessageProxyForSchainTester(keyStorage2.address, newSchainName);
            tokenManagerLinker2 = await deployTokenManagerLinker(messageProxyForSchain2, deployer.address);
            communityLocker2 = await deployCommunityLocker(newSchainName, messageProxyForSchain2.address, tokenManagerLinker2, fakeCommunityPool);
            tokenManagerERC11552 = await deployTokenManagerERC1155(newSchainName, messageProxyForSchain2.address, tokenManagerLinker2, communityLocker2, fakeDepositBox);
            await erc1155OnTargetChain.connect(deployer).grantRole(await erc1155OnTargetChain.MINTER_ROLE(), tokenManagerERC11552.address);
            await tokenManagerLinker2.registerTokenManager(tokenManagerERC11552.address);
        });

        it("should invoke `transferToSchainERC1155` without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount);

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount);

            const data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain.address);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect((await targetErc1155OnChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes double", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain.address);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect((await targetErc1155OnChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            const amount2 = 77;

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const amountSum = 81;

            expect((await targetErc1155OnChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes double with attached token", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:

            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain.address, erc1155OnTargetChain.address).should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");
            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain.address, erc1155OnTargetChain.address).should.be.eventually.rejectedWith("Chain is not connected");

            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain.address, erc1155OnTargetChain.address);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            expect((await erc1155OnTargetChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            const amount2 = 77;

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const amountSum = 81;

            expect((await erc1155OnTargetChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain.address);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect((await targetErc1155OnChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC11552.address);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);

            expect((await erc1155OnOriginChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes with attached tokens", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain.address, erc1155OnTargetChain.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC11552.address);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);
            expect((await erc1155OnOriginChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

        });


        it("should invoke `transferToSchainERC1155` and transfer back without mistakes double", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain.address);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect((await targetErc1155OnChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC11552.address);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);
            expect((await erc1155OnOriginChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            expect((await targetErc1155OnChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            const amount2 = 77;

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const amountSum = 81;

            expect((await targetErc1155OnChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);
            expect((await erc1155OnOriginChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);

            expect((await erc1155OnOriginChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes double with attached tokens", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount);

            let data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain.address, erc1155OnTargetChain.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155("Mainnet", erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC11552.address);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);
            expect((await erc1155OnOriginChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            expect((await erc1155OnTargetChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            const amount2 = 77;

            await erc1155OnOriginChain.connect(deployer).mint(user.address, id, amount2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155(newSchainName, erc1155OnOriginChain.address, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const amountSum = 81;

            expect((await erc1155OnTargetChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);
            expect((await erc1155OnOriginChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amount.toString());

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155(schainName, erc1155OnOriginChain.address, id, amount2);

            data = await messages.encodeTransferErc1155Message(
                erc1155OnOriginChain.address,
                user.address,
                id,
                amount2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);

            expect((await erc1155OnOriginChain.functions.balanceOf(user.address, id)).toString()).to.be.equal(amountSum.toString());

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
        const newSchainId = stringValue(web3.utils.soliditySha3(newSchainName));

        beforeEach(async () => {
            erc1155OnOriginChain = await deployERC1155OnChain("NewToken");
            erc1155OnTargetChain = await deployERC1155OnChain("NewToke1n");

            const keyStorage2 = await deployKeyStorageMock();
            messageProxyForSchain2 = await deployMessageProxyForSchainTester(keyStorage2.address, newSchainName);
            tokenManagerLinker2 = await deployTokenManagerLinker(messageProxyForSchain2, deployer.address);
            communityLocker2 = await deployCommunityLocker(newSchainName, messageProxyForSchain2.address, tokenManagerLinker2, fakeCommunityPool);
            tokenManagerERC11552 = await deployTokenManagerERC1155(newSchainName, messageProxyForSchain2.address, tokenManagerLinker2, communityLocker2, fakeDepositBox);
            await erc1155OnTargetChain.connect(deployer).grantRole(await erc1155OnTargetChain.MINTER_ROLE(), tokenManagerERC11552.address);
            await tokenManagerLinker2.registerTokenManager(tokenManagerERC11552.address);
        });

        it("should invoke `transferToSchainERC1155` without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts);

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts);

            const data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain.address);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;

            const balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            const balanceIdsNumber: number[] = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes double", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain.address);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;

            let balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            let balanceIdsNumber: number[] = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            const amounts2 = [77, 78, 79, 80];

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const amountsSum = [81, 81, 81, 81];

            balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

        });

        it("should invoke `transferToSchainERC1155` and receive tokens without mistakes double with attached token", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:

            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain.address, erc1155OnTargetChain.address).should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");
            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain.address, erc1155OnTargetChain.address).should.be.eventually.rejectedWith("Chain is not connected");

            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain.address, erc1155OnTargetChain.address);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            let balanceIds = await erc1155OnTargetChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            let balanceIdsNumber: number[] = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            const amounts2 = [77, 78, 79, 80];

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const amountsSum = [81, 81, 81, 81];

            balanceIds = await erc1155OnTargetChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain.address);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;

            let balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            let balanceIdsNumber: number[] = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC11552.address);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes with attached tokens", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain.address, erc1155OnTargetChain.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC11552.address);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);

            const balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            const balanceIdsNumber: number[] = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

        });


        it("should invoke `transferToSchainERC1155` and transfer back without mistakes double", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC11552.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const addressERC1155OnSchain = await tokenManagerERC11552.clonesErc1155(schainId, erc1155OnOriginChain.address);
            const targetErc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;

            let balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            let balanceIdsNumber: number[] = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC11552.address);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            const amounts2 = [77, 78, 79, 80];

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const amountsSum = [81, 81, 81, 81];

            balanceIds = await targetErc1155OnChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

            await targetErc1155OnChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

        });

        it("should invoke `transferToSchainERC1155` and transfer back without mistakes double with attached tokens", async () => {
            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts, "0x");
            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC1155.addTokenManager(newSchainName, tokenManagerERC11552.address);

            // execution:
            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts);

            let data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts,
                {
                    uri: await erc1155OnOriginChain.uri(0)
                }
            );

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC11552.addTokenManager(schainName, tokenManagerERC1155.address);

            await tokenManagerERC11552.connect(deployer).grantRole(await tokenManagerERC11552.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC11552.connect(schainOwner).addERC1155TokenByOwner(schainName,  erc1155OnOriginChain.address, erc1155OnTargetChain.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch("Mainnet", erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Not allowed ERC1155 Token");

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts)
                .should.be.eventually.rejectedWith("Sender contract is not registered");

            await messageProxyForSchain2.registerExtraContract(schainName, tokenManagerERC11552.address);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);

            let balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            let balanceIdsNumber: number[] = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await erc1155OnOriginChain.connect(user).setApprovalForAll(tokenManagerERC1155.address, true);

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            balanceIds = await erc1155OnTargetChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            const amounts2 = [77, 78, 79, 80];

            await erc1155OnOriginChain.connect(deployer).mintBatch(user.address, ids, amounts2, "0x");

            await tokenManagerERC1155
                .connect(user)
                .transferToSchainERC1155Batch(newSchainName, erc1155OnOriginChain.address, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC11552.address, schainId, tokenManagerERC1155.address, data);

            const amountsSum = [81, 81, 81, 81];

            balanceIds = await erc1155OnTargetChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

            await erc1155OnTargetChain.connect(user).setApprovalForAll(tokenManagerERC11552.address, true);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);

            await tokenManagerERC11552
                .connect(user)
                .transferToSchainERC1155Batch(schainName, erc1155OnOriginChain.address, ids, amounts2);

            data = await messages.encodeTransferErc1155BatchMessage(
                erc1155OnOriginChain.address,
                user.address,
                ids,
                amounts2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, newSchainId, tokenManagerERC11552.address, data);

            balanceIds = await erc1155OnOriginChain.balanceOfBatch([user.address, user.address, user.address, user.address], ids);
            balanceIdsNumber = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amountsSum);

        });

    });

    describe("tests for `postMessage` function", async () => {

        it("should transfer ERC1155 token through `postMessage` function with token info", async () => {
            //  preparation
            const data = await messages.encodeTransferErc1155AndTokenInfoMessage(
                token.address,
                to,
                id,
                amount,
                {
                    uri: await token.uri(0)
                }
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC1155.connect(schainOwner).enableAutomaticDeploy();
            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, mainnetId, fakeDepositBox, data);
            const addressERC1155OnSchain = await tokenManagerERC1155.clonesErc1155(mainnetId, token.address);
            const erc1155OnChain = (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect(BigNumber.from((await erc1155OnChain.functions.balanceOf(to, id))[0]).toNumber()).to.be.equal(amount);
        });

        it("should transfer ERC1155 token on schain", async () => {
            //  preparation
            await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token.address, tokenClone.address);
            await tokenClone.connect(deployer).grantRole(await tokenClone.MINTER_ROLE(), tokenManagerERC1155.address);

            const data = await messages.encodeTransferErc1155Message(
                token.address,
                to,
                id,
                amount
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, mainnetId, fakeDepositBox, data);
            const addressERC1155OnSchain = await tokenManagerERC1155.clonesErc1155(mainnetId, token.address);
            const erc1155OnChain = (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            expect(BigNumber.from((await erc1155OnChain.functions.balanceOf(to, id))[0]).toNumber()).to.be.equal(amount);
        });

        it("should transfer ERC1155 token batch through `postMessage` function with token info", async () => {
            //  preparation
            const data = await messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                token.address,
                to,
                ids,
                amounts,
                {
                    uri: await token.uri(0)
                }
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC1155.connect(schainOwner).enableAutomaticDeploy();
            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, mainnetId, fakeDepositBox, data);
            const addressERC1155OnSchain = await tokenManagerERC1155.clonesErc1155(mainnetId, token.address);
            const erc1155OnChain = await (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;

            const balanceIds = await erc1155OnChain.balanceOfBatch([to, to, to, to], ids);
            const balanceIdsNumber: number[] = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);
        });

        it("should transfer ERC1155 token batch on schain", async () => {
            //  preparation
            await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  token.address, tokenClone.address);
            await tokenClone.connect(deployer).grantRole(await tokenClone.MINTER_ROLE(), tokenManagerERC1155.address);

            const data = await messages.encodeTransferErc1155BatchMessage(
                token.address,
                to,
                ids,
                amounts
            );

            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, mainnetId, fakeDepositBox, data);
            const addressERC1155OnSchain = await tokenManagerERC1155.clonesErc1155(mainnetId, token.address);
            const erc1155OnChain = (await ethers.getContractFactory("ERC1155OnChain")).attach(addressERC1155OnSchain) as ERC1155OnChain;
            const balanceIds = await erc1155OnChain.balanceOfBatch([to, to, to, to], ids);
            const balanceIdsNumber: number[] = [];
            balanceIds.forEach((element: any) => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);
        });

        it("should reject if message type is unknown", async () => {
            const data = "0x0000000000000000000000000000000000000000000000000000000000000001"+
            "000000000000000000000000a51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0"+
            "00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8"+
            "0000000000000000000000000000000000000000000000000000000000000001";
            await messageProxyForSchain.postMessage(tokenManagerERC1155.address, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("MessageType is unknown");

        });

    });
});
