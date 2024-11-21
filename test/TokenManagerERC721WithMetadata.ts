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
import chai from "chai";
import {
    ERC721OnChain,
    TokenManagerERC721WithMetadata,
    TokenManagerLinker,
    MessageProxyForSchainTester,
    MessagesTester,
    CommunityLocker
} from "../typechain";


import { skipTime } from "./utils/time";

chai.should();
chai.use(chaiAsPromised);

import { deployTokenManagerERC721WithMetadata } from "./utils/deploy/schain/tokenManagerERC721WithMetadata";
import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployMessages } from "./utils/deploy/messages";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { expect } from "chai";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

describe("TokenManagerERC721WithMetadata", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

    const schainName = "V-chain";
    const schainId = ethers.id(schainName);
    const tokenId = 1;
    const tokenURI = "Hello1";
    const mainnetName = "Mainnet";
    const mainnetId = ethers.id("Mainnet");
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

    before(async () => {
        [deployer, user, schainOwner] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const keyStorage = await deployKeyStorageMock();
        messageProxyForSchain = await deployMessageProxyForSchainTester(schainName, keyStorage);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, deployer.address);
        messages = await deployMessages();
        fakeDepositBox = user.address;
        fakeCommunityPool = user.address;

        communityLocker = await deployCommunityLocker(schainName, messageProxyForSchain, tokenManagerLinker, fakeCommunityPool);

        tokenManagerERC721WithMetadata =
            await deployTokenManagerERC721WithMetadata(
                schainName,
                messageProxyForSchain,
                tokenManagerLinker,
                communityLocker,
                fakeDepositBox
            );
        await tokenManagerERC721WithMetadata.connect(deployer).grantRole(await tokenManagerERC721WithMetadata.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        await tokenManagerERC721WithMetadata.connect(deployer).grantRole(await tokenManagerERC721WithMetadata.AUTOMATIC_DEPLOY_ROLE(), schainOwner.address);
        await tokenManagerLinker.registerTokenManager(tokenManagerERC721WithMetadata);

        tokenClone = await deployERC721OnChain("ELVIS", "ELV");
        token = await deployERC721OnChain("SKALE", "SKL");
        tokenClone2 = await deployERC721OnChain("ELVIS2", "ELV");
        token2 = await deployERC721OnChain("SKALE2", "SKL");

        to = user.address;

        const data = await messages.encodeActivateUserMessage(user.address);
        await messageProxyForSchain.postMessage(communityLocker, mainnetId, fakeCommunityPool, data);

        const extraContractRegistrarRole = await messageProxyForSchain.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);

        await communityLocker.grantRole(await communityLocker.CONSTANT_SETTER_ROLE(), deployer.address);
        await communityLocker.setTimeLimitPerMessage("Mainnet", 0);
    });

    it("should change depositBox address", async () => {
        const newDepositBox = user.address;
        expect(await tokenManagerERC721WithMetadata.depositBox()).to.equal(fakeDepositBox);
        await tokenManagerERC721WithMetadata.connect(user).changeDepositBoxAddress(newDepositBox)
            .should.be.eventually.rejectedWith("DEFAULT_ADMIN_ROLE is required");
        await tokenManagerERC721WithMetadata.connect(deployer).changeDepositBoxAddress(newDepositBox);
        expect(await tokenManagerERC721WithMetadata.depositBox()).to.equal(newDepositBox);
    });

    it("should successfully call exitToMainERC721", async () => {
        // should be "No token clone on schain" if chains were different
        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token, tokenId)
            .should.be.eventually.rejectedWith("ERC721: invalid token ID");

        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token, tokenClone);
        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token, tokenId)
            .should.be.eventually.rejectedWith("ERC721: invalid token ID");

        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenClone.connect(user).setTokenURI(tokenId, tokenURI);
        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token, tokenId)
            .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

        await tokenClone.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);
        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token, tokenId)
            .should.be.eventually.rejectedWith("Sender contract is not registered");

        await messageProxyForSchain.registerExtraContract("Mainnet", tokenManagerERC721WithMetadata);
        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token, tokenId);

        await messageProxyForSchain.removeExtraContract("Mainnet", tokenManagerERC721WithMetadata);
        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenClone.connect(user).setTokenURI(tokenId, tokenURI);
        await tokenClone.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token, tokenId)
            .should.be.eventually.rejectedWith("Sender contract is not registered");

        const outgoingMessagesCounterMainnet = await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet");
        outgoingMessagesCounterMainnet.should.be.equal(1);
    });

    it("should be rejected when call exitToMainERC721 if remove contract for all chains", async () => {
        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token, tokenClone);
        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenClone.connect(user).setTokenURI(tokenId, tokenURI);
        await tokenClone.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata);

        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token, tokenId);

        await messageProxyForSchain.removeExtraContractForAll(tokenManagerERC721WithMetadata);
        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenClone.connect(user).setTokenURI(tokenId, tokenURI);
        await tokenClone.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

        await tokenManagerERC721WithMetadata.connect(user).exitToMainERC721(token, tokenId)
            .should.be.eventually.rejectedWith("Sender contract is not registered");

        const outgoingMessagesCounterMainnet = await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet");
        outgoingMessagesCounterMainnet.should.be.equal(1);
    });

    it("should successfully call addERC721TokenByOwner", async () => {
        await tokenManagerERC721WithMetadata.connect(user).addERC721TokenByOwner(mainnetName,  token, tokenClone)
            .should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");

        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token, deployer.address)
            .should.be.eventually.rejectedWith("Given address is not a contract");

        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token, tokenClone);

        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token2, tokenClone)
            .should.be.eventually.rejectedWith("Clone was already added");

        await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token, tokenClone2)
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
        const newSchainId = ethers.id(newSchainName);

        beforeEach(async () => {
            erc721OnOriginChain = await deployERC721OnChain("NewToken", "NTN");
            erc721OnTargetChain = await deployERC721OnChain("NewToke1n", "NTN1");

            const keyStorage2 = await deployKeyStorageMock();
            messageProxyForSchain2 = await deployMessageProxyForSchainTester(newSchainName, keyStorage2);
            tokenManagerLinker2 = await deployTokenManagerLinker(messageProxyForSchain2, deployer.address);
            communityLocker2 = await deployCommunityLocker(newSchainName, messageProxyForSchain2, tokenManagerLinker2, fakeCommunityPool);
            tokenManagerERC721WithMetadata2 = await deployTokenManagerERC721WithMetadata(
                newSchainName,
                messageProxyForSchain2,
                tokenManagerLinker2,
                communityLocker2,
                fakeDepositBox
            );
            await erc721OnTargetChain.connect(deployer).grantRole(await erc721OnTargetChain.MINTER_ROLE(), tokenManagerERC721WithMetadata2);
            await tokenManagerLinker2.registerTokenManager(tokenManagerERC721WithMetadata2);
            await messageProxyForSchain2.registerExtraContractForAll(tokenManagerERC721WithMetadata2);
        });

        it("should invoke `transferToSchainERC721` without mistakes", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);
        });

        it("should reject `transferToSchainERC721` when executing earlier then allowed", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, 1);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, 1);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, 1)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, 1)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, 1);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(1);

            await erc721OnOriginChain.connect(deployer).mint(user.address, 2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, 2);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, 2);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await communityLocker.grantRole(await communityLocker.CONSTANT_SETTER_ROLE(), deployer.address);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await erc721OnOriginChain.connect(deployer).mint(user.address, 3);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, 3);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, 3)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await skipTime(90);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, 3)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(2);

            await skipTime(20);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, 3);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(3);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 0);

            await erc721OnOriginChain.connect(deployer).mint(user.address, 4);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, 4);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, 4);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(4);

            await communityLocker.setTimeLimitPerMessage(newSchainName, 100);

            await erc721OnOriginChain.connect(deployer).mint(user.address, 5);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, 5);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, 5)
                .should.be.eventually.rejectedWith("Exceeded message rate limit");

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(4);

            await skipTime(110);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, 5);

            (await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName)).should.be.equal(5);
        });

        it("should invoke `transferToSchainERC721` and receive tokens without mistakes", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            const data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC721WithMetadata2.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            const addressERC721OnSchain = await tokenManagerERC721WithMetadata2.clonesErc721(schainId, erc721OnOriginChain);
            const targetErc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

        });

        it("should invoke `transferToSchainERC721` and receive tokens without mistakes double", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC721WithMetadata2.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            const addressERC721OnSchain = await tokenManagerERC721WithMetadata2.clonesErc721(schainId, erc721OnOriginChain);
            const targetErc721OnChain = (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            const tokenId2 = 2;
            const tokenURI2 = "Hello2";

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId2, tokenURI2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId2);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            expect((await targetErc721OnChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await targetErc721OnChain.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);

        });

        it("should invoke `transferToSchainERC721` and receive tokens without mistakes double with attached token", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:

            await tokenManagerERC721WithMetadata2
                .connect(schainOwner)
                .addERC721TokenByOwner(schainName,  erc721OnOriginChain, erc721OnTargetChain)
                .should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");
            await tokenManagerERC721WithMetadata2.connect(deployer).grantRole(await tokenManagerERC721WithMetadata2.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC721WithMetadata2
                .connect(schainOwner)
                .addERC721TokenByOwner(schainName,  erc721OnOriginChain, erc721OnTargetChain)
                .should.be.eventually.rejectedWith("Chain is not connected");

            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC721WithMetadata2
                .connect(schainOwner)
                .addERC721TokenByOwner(schainName,  erc721OnOriginChain, erc721OnTargetChain);
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata);

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            expect((await erc721OnTargetChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            const tokenId2 = 2;
            const tokenURI2 = "Hello2";

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId2, tokenURI2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId2);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            expect((await erc721OnTargetChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await erc721OnTargetChain.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);

        });

        it("should invoke `transferToSchainERC721` and transfer back without mistakes", async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC721WithMetadata2.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            const addressERC721OnSchain = await tokenManagerERC721WithMetadata2.clonesErc721(schainId, erc721OnOriginChain);
            const targetErc721OnChain = (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await targetErc721OnChain.connect(user).approve(tokenManagerERC721WithMetadata2, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, newSchainId, tokenManagerERC721WithMetadata2, data);
            expect((await erc721OnOriginChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

        });

        it("should invoke `transferToSchainERC721` and transfer back without mistakes with attached tokens", async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata);

            await tokenManagerERC721WithMetadata2.connect(deployer).grantRole(await tokenManagerERC721WithMetadata2.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC721WithMetadata2.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain, erc721OnTargetChain);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, newSchainId, tokenManagerERC721WithMetadata2, data);
            expect((await erc721OnOriginChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

        });


        it("should invoke `transferToSchainERC721` and transfer back without mistakes double", async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data).should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC721WithMetadata2.enableAutomaticDeploy();

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            const addressERC721OnSchain = await tokenManagerERC721WithMetadata2.clonesErc721(schainId, erc721OnOriginChain);
            const targetErc721OnChain = (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await targetErc721OnChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await targetErc721OnChain.connect(user).approve(tokenManagerERC721WithMetadata2, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, newSchainId, tokenManagerERC721WithMetadata2, data);
            expect((await erc721OnOriginChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            expect((await targetErc721OnChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            const tokenId2 = 2;
            const tokenURI2 = "Hello2";

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId2, tokenURI2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId2);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            expect((await targetErc721OnChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await targetErc721OnChain.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await targetErc721OnChain.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);

            await targetErc721OnChain.connect(user).approve(tokenManagerERC721WithMetadata2, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, newSchainId, tokenManagerERC721WithMetadata2, data);
            expect((await erc721OnOriginChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await targetErc721OnChain.connect(user).approve(tokenManagerERC721WithMetadata2, tokenId2);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, newSchainId, tokenManagerERC721WithMetadata2, data);

            expect((await erc721OnOriginChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await erc721OnOriginChain.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);

        });

        it("should invoke `transferToSchainERC721` and transfer back without mistakes double with attached tokens", async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata);

            await tokenManagerERC721WithMetadata2.connect(deployer).grantRole(await tokenManagerERC721WithMetadata2.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC721WithMetadata2.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain, erc721OnTargetChain);


            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721("Mainnet", erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("This function is not for transferring to Mainnet");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, newSchainId, tokenManagerERC721WithMetadata2, data);
            expect((await erc721OnOriginChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            expect((await erc721OnTargetChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            const tokenId2 = 2;
            const tokenURI2 = "Hello2";

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId2);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId2, tokenURI2);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId2);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            expect((await erc721OnTargetChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await erc721OnTargetChain.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, newSchainId, tokenManagerERC721WithMetadata2, data);
            expect((await erc721OnOriginChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2, tokenId2);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId2);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId2,
                tokenURI2
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, newSchainId, tokenManagerERC721WithMetadata2, data);

            expect((await erc721OnOriginChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);
            expect((await erc721OnOriginChain.ownerOf(tokenId2)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.tokenURI(tokenId2)).toString()).to.be.equal(tokenURI2);
        });

        it("should not be able to transfer X->Y->Z", async () => {
            await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerERC721WithMetadata);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            const data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata);

            await tokenManagerERC721WithMetadata2.connect(deployer).grantRole(await tokenManagerERC721WithMetadata2.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC721WithMetadata2.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain, erc721OnTargetChain);

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            expect((await erc721OnTargetChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            const newSchainNameZ = "NewChainZ";

            const erc721OnTargetZChain = await deployERC721OnChain("NewTokenZ", "NTNZ");

            const keyStorageZ = await deployKeyStorageMock();
            const messageProxyForSchainZ = await deployMessageProxyForSchainTester(newSchainNameZ, keyStorageZ);
            const tokenManagerLinkerZ = await deployTokenManagerLinker(messageProxyForSchainZ, deployer.address);
            const communityLockerZ = await deployCommunityLocker(newSchainName, messageProxyForSchainZ, tokenManagerLinkerZ, fakeCommunityPool);
            const tokenManagerERC721WithMetadataZ = await deployTokenManagerERC721WithMetadata(
                newSchainNameZ, messageProxyForSchainZ, tokenManagerLinkerZ, communityLockerZ, fakeDepositBox
            );
            await erc721OnTargetZChain.connect(deployer).grantRole(await erc721OnTargetZChain.MINTER_ROLE(), tokenManagerERC721WithMetadataZ);
            await tokenManagerLinkerZ.registerTokenManager(tokenManagerERC721WithMetadataZ);

            await messageProxyForSchain2.connect(deployer).grantRole(await messageProxyForSchain2.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain2.connect(deployer).addConnectedChain(newSchainNameZ);

            await tokenManagerERC721WithMetadata2.addTokenManager(newSchainNameZ, tokenManagerERC721WithMetadataZ);

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainNameZ, erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(newSchainNameZ, erc721OnTargetChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect main chain token");
        });

        it("should not be able to transfer main chain token or clone to mainnet", async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata);

            // add connected chain:
            await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
            await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

            await erc721OnOriginChain.connect(deployer).mint(user.address, tokenId);
            await erc721OnOriginChain.connect(user).setTokenURI(tokenId, tokenURI);
            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata.addTokenManager(newSchainName, tokenManagerERC721WithMetadata2);

            // execution:
            await tokenManagerERC721WithMetadata
                .connect(user)
                .transferToSchainERC721(newSchainName, erc721OnOriginChain, tokenId);

            let data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI,
                {
                    name: await erc721OnOriginChain.name(),
                    symbol: await erc721OnOriginChain.symbol()
                }
            );

            // expectation:
            const outgoingMessagesCounter = await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName);
            outgoingMessagesCounter.should.be.equal(1);

            // receive:
            //  registration:
            await messageProxyForSchain2.connect(deployer).addConnectedChain(schainName);
            await tokenManagerERC721WithMetadata2.addTokenManager(schainName, tokenManagerERC721WithMetadata);

            await tokenManagerERC721WithMetadata2.connect(deployer).grantRole(await tokenManagerERC721WithMetadata2.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
            await tokenManagerERC721WithMetadata2.connect(schainOwner).addERC721TokenByOwner(schainName,  erc721OnOriginChain, erc721OnTargetChain);

            await messageProxyForSchain2.postMessage(tokenManagerERC721WithMetadata2, schainId, tokenManagerERC721WithMetadata, data);

            expect((await erc721OnTargetChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnTargetChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            data = await messages.encodeActivateUserMessage(user.address);

            await messageProxyForSchain2.postMessage(communityLocker2, mainnetId, fakeCommunityPool, data);

            await erc721OnTargetChain.connect(user).approve(tokenManagerERC721WithMetadata2, tokenId);

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .exitToMainERC721(erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .exitToMainERC721(erc721OnTargetChain, tokenId)
                .should.be.eventually.rejectedWith("Incorrect main chain token");

            await tokenManagerERC721WithMetadata2
                .connect(user)
                .transferToSchainERC721(schainName, erc721OnOriginChain, tokenId);

            data = await messages.encodeTransferErc721MessageWithMetadata(
                erc721OnOriginChain,
                user.address,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, newSchainId, tokenManagerERC721WithMetadata2, data);
            expect((await erc721OnOriginChain.ownerOf(tokenId)).toString()).to.be.equal(user.address);
            expect((await erc721OnOriginChain.tokenURI(tokenId)).toString()).to.be.equal(tokenURI);

            await erc721OnOriginChain.connect(user).approve(tokenManagerERC721WithMetadata, tokenId);

            await tokenManagerERC721WithMetadata
                .connect(user)
                .exitToMainERC721(erc721OnOriginChain, tokenId)
                .should.be.eventually.rejectedWith("Main chain token could not be transfered to Mainnet");

            await tokenManagerERC721WithMetadata
                .connect(user)
                .exitToMainERC721(erc721OnTargetChain, tokenId)
                .should.be.eventually.rejectedWith("ERC721: invalid token ID");

        });

    });

    describe("tests for `postMessage` function", async () => {
        beforeEach(async () => {
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721WithMetadata);
        });

        it("should transfer ERC721 token token with token info", async () => {
            //  preparation
            const data = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                token,
                to,
                tokenId,
                tokenURI,
                {
                    name: await token.name(),
                    symbol: await token.symbol()
                }
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("Automatic deploy is disabled");

            await tokenManagerERC721WithMetadata.connect(schainOwner).enableAutomaticDeploy();
            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, mainnetId, fakeDepositBox, data);
            const addressERC721OnSchain = await tokenManagerERC721WithMetadata.clonesErc721(mainnetId, token);
            const erc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await erc721OnChain.ownerOf(tokenId))).to.be.equal(to);
            expect((await erc721OnChain.tokenURI(tokenId))).to.be.equal(tokenURI);
        });

        it("should transfer ERC721 token on schain", async () => {
            //  preparation
            await tokenManagerERC721WithMetadata.connect(schainOwner).addERC721TokenByOwner(mainnetName,  token, tokenClone);
            await tokenClone.connect(deployer).grantRole(await tokenClone.MINTER_ROLE(), tokenManagerERC721WithMetadata);

            const data = await messages.encodeTransferErc721MessageWithMetadata(
                token,
                to,
                tokenId,
                tokenURI
            );

            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, mainnetId, fakeDepositBox, data);
            const addressERC721OnSchain = await tokenManagerERC721WithMetadata.clonesErc721(mainnetId, token);
            const erc721OnChain = (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
            expect((await erc721OnChain.ownerOf(tokenId))).to.be.equal(to);
            expect((await erc721OnChain.tokenURI(tokenId))).to.be.equal(tokenURI);
        });

        it("should reject if message type is unknown", async () => {
            const data = "0x0000000000000000000000000000000000000000000000000000000000000001"+
            "000000000000000000000000a51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0"+
            "00000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c8"+
            "0000000000000000000000000000000000000000000000000000000000000001";
            await messageProxyForSchain.postMessage(tokenManagerERC721WithMetadata, mainnetId, fakeDepositBox, data)
                .should.be.eventually.rejectedWith("MessageType is unknown");

        });
    });
});
