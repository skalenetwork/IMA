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
 * @file TokenManagerERC721WithMetadata.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    ERC721OnChain,
    TokenManagerERC721WithMetadata,
    TokenManagerLinker,
    MessageProxyForSchainTester,
    MessagesTester,
    CommunityLocker
} from "../typechain";

import { stringKeccak256 } from "./utils/helper";
import { skipTime } from "./utils/time";

chai.should();
chai.use((chaiAsPromised as any));

import { deployTokenManagerERC721WithMetadata } from "./utils/deploy/schain/tokenManagerERC721WithMetadata";
import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployMessages } from "./utils/deploy/messages";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect, should } from "chai";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

describe("TokenManagerERC721WithMetadata", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

    const schainName = "V-chain";
    const schainId = stringKeccak256(schainName);
    const tokenId = 1;
    const tokenURI = "Hello1";
    const mainnetName = "Mainnet";
    const mainnetId = stringKeccak256("Mainnet");
    let to: string;
    let token: ERC721OnChain;
    let tokenClone: ERC721OnChain;
    let fakeDepositBox: string;
    let fakeCommunityPool: string;
    let tokenManagerERC721WithMetadata: TokenManagerERC721WithMetadata;
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

        tokenManagerERC721WithMetadata =
            await deployTokenManagerERC721WithMetadata(
                schainName,
                messageProxyForSchain.address,
                tokenManagerLinker,
                communityLocker,
                fakeDepositBox
            );
        await tokenManagerERC721WithMetadata.connect(deployer).grantRole(await tokenManagerERC721WithMetadata.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        await tokenManagerERC721WithMetadata.connect(deployer).grantRole(await tokenManagerERC721WithMetadata.AUTOMATIC_DEPLOY_ROLE(), schainOwner.address);
        await tokenManagerLinker.registerTokenManager(tokenManagerERC721WithMetadata.address);

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
        await communityLocker.setTimeLimitPerMessage("Mainnet", 0);
    });

    it("should change depositBox address", async () => {
        const newDepositBox = user.address;
        expect(await tokenManagerERC721WithMetadata.depositBox()).to.equal(messages.address);
        await tokenManagerERC721WithMetadata.connect(user).changeDepositBoxAddress(newDepositBox)
            .should.be.eventually.rejectedWith("DEFAULT_ADMIN_ROLE is required");
        await tokenManagerERC721WithMetadata.connect(deployer).changeDepositBoxAddress(newDepositBox);
        expect(await tokenManagerERC721WithMetadata.depositBox()).to.equal(newDepositBox);
    });

    it("should successfully call exitToMainERC721", async () => {
        // should be "No token clone on schain" if chains were different
        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("ERC721: invalid token ID");

        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, tokenClone.address);
        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("ERC721: invalid token ID");

        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenClone.connect(user).setTokenURI(tokenId, tokenURI);
        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

        await tokenClone.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);
        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("Sender contract is not registered");

        await messageProxyForSchain.registerExtraContract("Mainnet", tokenManagerERC721WithMetadata.address);
        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token.address, tokenId);

        await messageProxyForSchain.removeExtraContract("Mainnet", tokenManagerERC721WithMetadata.address);
        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenClone.connect(user).setTokenURI(tokenId, tokenURI);
        await tokenClone.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("Sender contract is not registered");

        const outgoingMessagesCounterMainnet = BigNumber.from(
            await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet")
        );
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    it("should be rejected when call exitToMainERC721 if remove contract for all chains", async () => {
        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, tokenClone.address);
        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenClone.connect(user).setTokenURI(tokenId, tokenURI);
        await tokenClone.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata.address);

        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token.address, tokenId);

        await messageProxyForSchain.removeExtraContractForAll(tokenManagerERC721WithMetadata.address);
        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenClone.connect(user).setTokenURI(tokenId, tokenURI);
        await tokenClone.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token.address, tokenId)
            .should.be.eventually.rejectedWith("Sender contract is not registered");

        const outgoingMessagesCounterMainnet = BigNumber.from(
            await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet")
        );
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    it("should successfully call addERC721TokenByOwner", async () => {
        await tokenManagerERC721WithMetadata.connect(user).addERC721TokenByOwner(mainnetName,  token.address, tokenClone.address)
            .should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");

        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, deployer.address)
            .should.be.eventually.rejectedWith("Given address is not a contract");

        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, tokenClone.address);

        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token2.address, tokenClone.address)
            .should.be.eventually.rejectedWith("Clone was already added");

        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, tokenClone2.address)
            .should.be.eventually.rejectedWith("Could not relink clone");
    });

    describe("tests for transferToSchainERC721", async () => {

        let erc721OnOriginChain: ERC721OnChain;
        let erc721OnTargetChain: ERC721OnChain;
        let messageProxyForSchain2: MessageProxyForSchainTester;
        let tokenManagerLinker2: TokenManagerLinker;
        let tokenManagerERC721WithMetadata2: TokenManagerERC721WithMetadata;
        let communityLocker2: CommunityLocker;
        const newSchainName = "NewChain";
        const newSchainId = stringKeccak256(newSchainName);

        beforeEach(async () => {
            erc721OnOriginChain = await deployERC721OnChain("NewToken", "NTN");
            erc721OnTargetChain = await deployERC721OnChain("NewToke1n", "NTN1");

            const keyStorage2 = await deployKeyStorageMock();
            messageProxyForSchain2 = await deployMessageProxyForSchainTester(keyStorage2.address, newSchainName);
            tokenManagerLinker2 = await deployTokenManagerLinker(messageProxyForSchain2, deployer.address);
            communityLocker2 = await deployCommunityLocker(newSchainName, messageProxyForSchain2.address, tokenManagerLinker2, fakeCommunityPool);
            tokenManagerERC721WithMetadata2 = await deployTokenManagerERC721WithMetadata(newSchainName, messageProxyForSchain2.address, tokenManagerLinker2, communityLocker2, fakeDepositBox);
            await erc721OnTargetChain.connect(deployer).grantRole(await erc721OnTargetChain.MINTER_ROLE(), tokenManagerERC721WithMetadata2.address);
            await tokenManagerLinker2.registerTokenManager(tokenManagerERC721WithMetadata2.address);
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerERC721WithMetadata2.address);
        });

        it("should invoke `transferToSchainERC721` without mistakes", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2.address);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            // expectation:
            const outgoingMessagesCounter = BigNumber.from(
                await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
            outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
        });

        it("should reject `transferToSchainERC721` when executing earlier then allowed", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, 1);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, 1);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, 1)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, 1)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2.address);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, 1);

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(1));

            await erc721OnOriginChain.connect(deployer).mint(user.address, 2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, 2);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, 2);

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(2));

            await communityLocker.grantRole(await communityLocker.CONSTANT_SETTER_ROLE(), deployer.address);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await erc721OnOriginChain.connect(deployer).mint(user.address, 3);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, 3);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, 3)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(2));

            await skipTime(90);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, 3)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(2));

            await skipTime(20);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, 3);

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(3));

            await communityLocker.setTimeLimitPerMessage(newSchainName, 0);

            await erc721OnOriginChain.connect(deployer).mint(user.address, 4);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, 4);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, 4);

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(4));

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await erc721OnOriginChain.connect(deployer).mint(user.address, 5);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, 5);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, 5)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(4));

            await skipTime(110);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, 5);

            BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.deep.equal(BigNumber.from(5));
        });

        it("should invoke `transferToSchainERC721` and receive tokens without mistakes", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2.address);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            const data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI,
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
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC721WithMetadata2.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            const addressERC721OnSchain = await tokenManagerERC721WithMetadata2.clonesErc721(schainId, erc721OnOriginChain.address);
            const targetErc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

        });

        it("should invoke `transferToSchainERC721` and receive tokens without mistakes double", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2.address);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI,
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
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC721WithMetadata2.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            const addressERC721OnSchain = await tokenManagerERC721WithMetadata2.clonesErc721(schainId, erc721OnOriginChain.address);
            const targetErc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            const tokenId2 = 2;
            const tokenURI2 = "Hello2";

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId2, tokenURI2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId2);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await targetErc721OnChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.functions.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);

        });

        it("should invoke `transferToSchainERC721` and receive tokens without mistakes double with attached token", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2.address);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI,
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

            await tokenManagerERC721WithMetadata2.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address).should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");
            await tokenManagerERC721WithMetadata2.connect(deployer).grantRole(await tokenManagerERC721WithMetadata2.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC721WithMetadata2.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address).should.be.eventually.rejectedWith("Chain is not connected");

            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC721WithMetadata2.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address);
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata.address);

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            expect((await erc721OnTargetChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            const tokenId2 = 2;
            const tokenURI2 = "Hello2";

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId2, tokenURI2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId2);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            expect((await erc721OnTargetChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await erc721OnTargetChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.functions.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);

        });

        it("should invoke `transferToSchainERC721` and transfer back without mistakes", async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2.address);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI,
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
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC721WithMetadata2.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            const addressERC721OnSchain = await tokenManagerERC721WithMetadata2.clonesErc721(schainId, erc721OnOriginChain.address);
            const targetErc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await targetErc721OnChain.connect(user).approve(tokenManagerERC721WithMetadata2.address, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, newSchainId, tokenManagerERC721WithMetadata2.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

        });

        it("should invoke `transferToSchainERC721` and transfer back without mistakes with attached tokens", async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2.address);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI,
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
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata.address);

            await tokenManagerERC721WithMetadata2.connect(deployer).grantRole(await tokenManagerERC721WithMetadata2.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC721WithMetadata2.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2.address, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, newSchainId, tokenManagerERC721WithMetadata2.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

        });


        it("should invoke `transferToSchainERC721` and transfer back without mistakes double", async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2.address);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI,
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
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC721WithMetadata2.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            const addressERC721OnSchain = await tokenManagerERC721WithMetadata2.clonesErc721(schainId, erc721OnOriginChain.address);
            const targetErc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await targetErc721OnChain.connect(user).approve(tokenManagerERC721WithMetadata2.address, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, newSchainId, tokenManagerERC721WithMetadata2.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            const tokenId2 = 2;
            const tokenURI2 = "Hello2";

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId2, tokenURI2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId2);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            expect((await targetErc721OnChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await targetErc721OnChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.functions.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);

            await targetErc721OnChain.connect(user).approve(tokenManagerERC721WithMetadata2.address, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, newSchainId, tokenManagerERC721WithMetadata2.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await targetErc721OnChain.connect(user).approve(tokenManagerERC721WithMetadata2.address, tokenId2);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, newSchainId, tokenManagerERC721WithMetadata2.address, data);

            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);

        });

        it("should invoke `transferToSchainERC721` and transfer back without mistakes double with attached tokens", async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2.address);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI,
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
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata.address);

            await tokenManagerERC721WithMetadata2.connect(deployer).grantRole(await tokenManagerERC721WithMetadata2.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC721WithMetadata2.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2.address, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, newSchainId, tokenManagerERC721WithMetadata2.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            expect((await erc721OnTargetChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            const tokenId2 = 2;
            const tokenURI2 = "Hello2";

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId2, tokenURI2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId2);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            expect((await erc721OnTargetChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await erc721OnTargetChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.functions.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2.address, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, newSchainId, tokenManagerERC721WithMetadata2.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2.address, tokenId2);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, newSchainId, tokenManagerERC721WithMetadata2.address, data);

            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);
        });

        it("should not be able to transfer X->Y->Z", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2.address);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            const data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI,
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
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata.address);

            await tokenManagerERC721WithMetadata2.connect(deployer).grantRole(await tokenManagerERC721WithMetadata2.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC721WithMetadata2.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address);

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            expect((await erc721OnTargetChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            let erc721OnTargetZChain: ERC721OnChain;
            let messageProxyForSchainZ: MessageProxyForSchainTester;
            let tokenManagerLinkerZ: TokenManagerLinker;
            let tokenManagerERC721WithMetadataZ: TokenManagerERC721WithMetadata;
            let communityLockerZ: CommunityLocker;
            const newSchainNameZ = "NewChainZ";

            erc721OnTargetZChain = await deployERC721OnChain("NewTokenZ", "NTNZ");

            const keyStorageZ = await deployKeyStorageMock();
            messageProxyForSchainZ = await deployMessageProxyForSchainTester(keyStorageZ.address, newSchainNameZ);
            tokenManagerLinkerZ = await deployTokenManagerLinker(messageProxyForSchainZ, deployer.address);
            communityLockerZ = await deployCommunityLocker(newSchainName, messageProxyForSchainZ.address, tokenManagerLinkerZ, fakeCommunityPool);
            tokenManagerERC721WithMetadataZ = await deployTokenManagerERC721WithMetadata(newSchainNameZ, messageProxyForSchainZ.address, tokenManagerLinkerZ, communityLockerZ, fakeDepositBox);
            await erc721OnTargetZChain.connect(deployer).grantRole(await erc721OnTargetZChain.MINTER_ROLE(), tokenManagerERC721WithMetadataZ.address);
            await tokenManagerLinkerZ.registerTokenManager(tokenManagerERC721WithMetadataZ.address);

            await messageProxyForSchain2.connect(deployer).grantRole(await messageProxyForSchain2.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain2.connect(deployer).addConnectedChain(newSchainNameZ);

            await tokenManagerERC721WithMetadata2.addTokenManager(newSchainNameZ, tokenManagerERC721WithMetadataZ.address);

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2.address, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainNameZ, erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainNameZ, erc721OnTargetChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect main chain token");
        });

        it("should not be able to transfer main chain token or clone to mainnet", async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata.address);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2.address);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain.address, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI,
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
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata.address);

            await tokenManagerERC721WithMetadata2.connect(deployer).grantRole(await tokenManagerERC721WithMetadata2.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC721WithMetadata2.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain.address, erc721OnTargetChain.address);

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2.address, schainId, tokenManagerERC721WithMetadata.address, data);

            expect((await erc721OnTargetChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            data = await messages.encodeActivateUserMessage(user.address);

            await messageProxyForSchain2.postMessage(communityLocker2.address, mainnetId, fakeCommunityPool, data);

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2.address, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .exitToMainERC721(erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .exitToMainERC721(erc721OnTargetChain.address, tokenId)
                .should.be.eventually.rejectedWith("Incorrect main chain token");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain.address, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain.address,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, newSchainId, tokenManagerERC721WithMetadata2.address, data);
            expect((await erc721OnOriginChain.functions.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.functions.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata.address, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .exitToMainERC721(erc721OnOriginChain.address, tokenId)
                .should.be.eventually.rejectedWith("Main chain token could not be transfered to Mainnet");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .exitToMainERC721(erc721OnTargetChain.address, tokenId)
                .should.be.eventually.rejectedWith("ERC721: invalid token ID");

        });

    });

    describe("tests for `postMessage` function", async () => {
        beforeEach(async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata.address);
        });

        it("should transfer ERC721 token token with token info", async () => {
            //  preparation
            const data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                token.address,
                to,
                tokenId,
                tokenURI,
                {
                    name: await token.name(),
                    symbol: await token.symbol()
                }
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC721WithMetadata.connect(schainOwner).enableAutomaticDeploy();
            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, mainnetId, fakeDepositBox, data);
            const addressERC721OnSchain = await tokenManagerERC721WithMetadata.clonesErc721(mainnetId, token.address);
            const erc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await erc721OnChain.functions.ownerOf(tokenId))[0]).to.be.equal(to);
            expect((await erc721OnChain.functions.tokenURI(tokenId))[0]).to.be.equal(tokenURI);
        });

        it("should transfer ERC721 token on schain", async () => {
            //  preparation
            await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token.address, tokenClone.address);
            await tokenClone.connect(deployer).grantRole(await tokenClone.MINTER_ROLE(), tokenManagerERC721WithMetadata.address);

            const data = await messages.encodeTransferErc721MessageWithMetadata(
                token.address,
                to,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, mainnetId, fakeDepositBox, data);
            const addressERC721OnSchain = await tokenManagerERC721WithMetadata.clonesErc721(mainnetId, token.address);
            const erc721OnChain = (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await erc721OnChain.functions.ownerOf(tokenId))[0]).to.be.equal(to);
            expect((await erc721OnChain.functions.tokenURI(tokenId))[0]).to.be.equal(tokenURI);
        });

        it("should reject if message type is unknown", async () => {
            const data = "0x0000000000000000000000000000000000000000000000000000000000000001"+
            "000000000000000000000000a51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0"+
            "00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8"+
            "0000000000000000000000000000000000000000000000000000000000000001";
            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata.address, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("MessageType is unknown");

        });
    });
});
