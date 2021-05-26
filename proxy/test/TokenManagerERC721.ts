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

import { stringValue } from "./utils/helper";

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

import { assert, expect } from "chai";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

describe("TokenManagerERC721", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

    const schainName = "V-chain";
    const tokenId = 1;
    const schainId = web3.utils.soliditySha3(schainName);
    const mainnetId = stringValue(web3.utils.soliditySha3("Mainnet"));
    let to: string;
    let token: ERC721OnChain;
    let tokenClone: ERC721OnChain;
    let tokenManagerERC721: TokenManagerERC721;
    let tokenManagerLinker: TokenManagerLinker;
    let messages: MessagesTester;
    let messageProxyForSchain: MessageProxyForSchainTester;
    let communityLocker: CommunityLocker;

    before(async () => {
        [deployer, user, schainOwner] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const keyStorage = await deployKeyStorageMock();
        messageProxyForSchain = await deployMessageProxyForSchainTester(keyStorage.address);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, deployer.address);
        messages = await deployMessages();
        const fakeDepositBox = messages;

        communityLocker = await deployCommunityLocker(schainName, messageProxyForSchain.address, tokenManagerLinker);

        tokenManagerERC721 =
            await deployTokenManagerERC721(
                schainName,
                messageProxyForSchain.address,
                tokenManagerLinker,
                communityLocker,
                fakeDepositBox.address
            );
        await tokenManagerERC721.connect(deployer).grantRole(await tokenManagerERC721.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        await tokenManagerERC721.connect(deployer).grantRole(await tokenManagerERC721.AUTOMATIC_DEPLOY_ROLE(), schainOwner.address);

        tokenClone = await deployERC721OnChain("ELVIS", "ELV");
        token = await deployERC721OnChain("SKALE", "SKL");

        to = user.address;

        const data = await messages.encodeFreezeStateMessage(user.address, true);
        await messageProxyForSchain.postMessage(communityLocker.address, mainnetId, "0x0000000000000000000000000000000000000000", data);
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
        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, to, tokenId)
            .should.be.eventually.rejectedWith("No token clone on schain");

        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(token.address, tokenClone.address);
        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, to, tokenId)
            .should.be.eventually.rejectedWith("ERC721: approved query for nonexistent token");

        await tokenClone.connect(deployer).mint(user.address, tokenId);
        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, to, tokenId)
            .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

        await tokenClone.connect(user).approve(tokenManagerERC721.address, tokenId);
        await tokenManagerERC721.connect(user).exitToMainERC721(token.address, to, tokenId);

        const outgoingMessagesCounterMainnet = BigNumber.from(
            await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet")
        );
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    it("should successfully call addERC721TokenByOwner", async () => {
        await tokenManagerERC721.connect(user).addERC721TokenByOwner(token.address, tokenClone.address)
            .should.be.eventually.rejectedWith("TOKEN_REGISTRAR_ROLE is required");

        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(token.address, deployer.address)
            .should.be.eventually.rejectedWith("Given address is not a contract");

        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(token.address, tokenClone.address);
    });

    it("should successfully call transferToSchainERC721", async () => {

        const chainConnectorRole = await messageProxyForSchain.CHAIN_CONNECTOR_ROLE();
        await messageProxyForSchain.grantRole(chainConnectorRole, deployer.address);
        await messageProxyForSchain.connect(deployer).addConnectedChain(schainName);

        await tokenManagerERC721
            .connect(deployer)
            .transferToSchainERC721(schainName, token.address, to, tokenId)
            .should.be.eventually.rejectedWith("Incorrect Token Manager address");

        await tokenManagerERC721.addTokenManager(schainName, deployer.address);
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(token.address, tokenClone.address);
        await tokenClone.connect(deployer).mint(deployer.address, tokenId);

        await tokenManagerERC721
            .connect(deployer)
            .transferToSchainERC721(schainName, token.address, to, tokenId)
            .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

        await tokenClone.connect(deployer).approve(tokenManagerERC721.address, tokenId);

        // execution:
        await tokenManagerERC721
            .connect(deployer)
            .transferToSchainERC721(schainName, token.address, to, tokenId);
        // expectation:
        const outgoingMessagesCounter = BigNumber.from(
            await messageProxyForSchain.getOutgoingMessagesCounter(schainName)
        );
        outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
    });

    it("should transfer ERC721 token through `postMessage` function", async () => {
        //  preparation
        const fakeDepositBox = messages;
        const data = await messages.encodeTransferErc721AndTokenInfoMessage(
            token.address,
            to,
            tokenId,
            {
                name: await token.name(),
                symbol: await token.symbol()
            }
        );

        await tokenManagerERC721.connect(schainOwner).enableAutomaticDeploy();
        await messageProxyForSchain.postMessage(tokenManagerERC721.address, mainnetId, fakeDepositBox.address, data);
        const addressERC721OnSchain = await tokenManagerERC721.clonesErc721(token.address);
        const erc721OnChain = await (await ethers.getContractFactory("ERC721OnChain")).attach(addressERC721OnSchain) as ERC721OnChain;
        expect((await erc721OnChain.functions.ownerOf(tokenId))[0]).to.be.equal(to);
    });

});
