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

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ERC721OnChainContract,
    ERC721OnChainInstance,
    TokenManagerERC721Contract,
    TokenManagerERC721Instance,
    TokenManagerLinkerInstance,
    TokenManagerLinkerContract,
    MessageProxyForSchainTesterInstance,
    MessageProxyForSchainTesterContract,
    SkaleFeaturesMockContract,
    MessagesTesterContract,
    MessagesTesterInstance,
    } from "../types/truffle-contracts";

import chai = require("chai");

chai.should();
chai.use((chaiAsPromised as any));

import artifactERC721OnChain = require("../build/contracts/ERC721OnChain.json");
const TokenManagerERC721: TokenManagerERC721Contract = artifacts.require("./TokenManagerERC721");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");
const TokenManagerLinker: TokenManagerLinkerContract = artifacts.require("./TokenManagerLinker");
const SkaleFeaturesMock: SkaleFeaturesMockContract = artifacts.require("./SkaleFeaturesMock");
const MessagesTester: MessagesTesterContract = artifacts.require("./MessagesTester");
const MessageProxyForSchainTester: MessageProxyForSchainTesterContract = artifacts.require("./MessageProxyForSchainTester");

contract("TokenManagerERC721", ([deployer, user, schainOwner]) => {
    const schainName = "V-chain";
    const tokenId = 1;
    const to = user;
    let token: ERC721OnChainInstance;
    let tokenClone: ERC721OnChainInstance;
    let tokenManagerERC721: TokenManagerERC721Instance;
    let tokenManagerLinker: TokenManagerLinkerInstance;
    let messages: MessagesTesterInstance;
    let messageProxyForSchain: MessageProxyForSchainTesterInstance;

    beforeEach(async () => {
        messageProxyForSchain = await MessageProxyForSchainTester.new(schainName);
        tokenManagerLinker = await TokenManagerLinker.new(messageProxyForSchain.address);
        messages = await MessagesTester.new();
        const fakeDepositBox =  messages;

        const skaleFeatures = await SkaleFeaturesMock.new();
        await skaleFeatures.setSchainOwner(schainOwner);

        tokenManagerERC721 =
            await TokenManagerERC721.new(schainName, messageProxyForSchain.address, tokenManagerLinker.address, fakeDepositBox.address);
        await tokenManagerERC721.grantRole(await tokenManagerERC721.SKALE_FEATURES_SETTER_ROLE(), deployer);
        await tokenManagerERC721.setSkaleFeaturesAddress(skaleFeatures.address);


        tokenClone = await ERC721OnChain.new("ELVIS", "ELV", {from: deployer});
        token = await ERC721OnChain.new("SKALE", "SKL", {from: deployer});

    });

    it("should successfully call exitToMainERC721", async () => {
        await tokenManagerERC721.exitToMainERC721(token.address, to, tokenId, {from: user})
            .should.be.eventually.rejectedWith("No token clone on schain");

        await tokenManagerERC721.addERC721TokenByOwner(token.address, tokenClone.address, {from: schainOwner});
        await tokenManagerERC721.exitToMainERC721(token.address, to, tokenId, {from: user})
            .should.be.eventually.rejectedWith("ERC721: approved query for nonexistent token");

        await tokenClone.mint(user, tokenId, {from: deployer});
        await tokenManagerERC721.exitToMainERC721(token.address, to, tokenId, {from: user})
            .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

        await tokenClone.approve(tokenManagerERC721.address, tokenId, {from: user});
        await tokenManagerERC721.exitToMainERC721(token.address, to, tokenId, {from: user});

        const outgoingMessagesCounterMainnet = new BigNumber(
            await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet")
        );
        outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
    });

    it("should successfully call addERC721TokenByOwner", async () => {
        await tokenManagerERC721.addERC721TokenByOwner(token.address, tokenClone.address, {from: deployer})
            .should.be.eventually.rejectedWith("Sender is not an Schain owner");

        await tokenManagerERC721.addERC721TokenByOwner(deployer, tokenClone.address, {from: schainOwner})
            .should.be.eventually.rejectedWith("Given address is not a contract");

        await tokenManagerERC721.addERC721TokenByOwner(token.address, deployer, {from: schainOwner})
            .should.be.eventually.rejectedWith("Given address is not a contract");

        await tokenManagerERC721.addERC721TokenByOwner(token.address, tokenClone.address, {from: schainOwner});
    });

    it("should successfully call transferToSchainERC721", async () => {

        const chainConnectorRole = await messageProxyForSchain.CHAIN_CONNECTOR_ROLE();
        await messageProxyForSchain.grantRole(chainConnectorRole, deployer);
        await messageProxyForSchain.addConnectedChain(schainName, {from: deployer});

        await tokenManagerERC721
            .transferToSchainERC721(schainName, token.address, to, tokenId, {from: deployer})
            .should.be.eventually.rejectedWith("Incorrect Token Manager address");

        await tokenManagerERC721.addTokenManager(schainName, deployer);
        await tokenManagerERC721.addERC721TokenByOwner(token.address, tokenClone.address, {from: schainOwner});
        await tokenClone.mint(deployer, tokenId, {from: deployer});

        await tokenManagerERC721
            .transferToSchainERC721(schainName, token.address, to, tokenId, {from: deployer})
            .should.be.eventually.rejectedWith("Not allowed ERC721 Token");

        await tokenClone.approve(tokenManagerERC721.address, tokenId, {from: deployer});

        // execution:
        await tokenManagerERC721
            .transferToSchainERC721(schainName, token.address, to, tokenId, {from: deployer});
        // expectation:
        const outgoingMessagesCounter = new BigNumber(
            await messageProxyForSchain.getOutgoingMessagesCounter(schainName)
        );
        outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
    });

    it("should transfer ERC721 token through `postMessage` function", async () => {
        //  preparation
        const fakeDepositBox =  messages;
        const chainName = "Mainnet";
        const data = await messages.encodeTransferErc721AndTokenInfoMessage(
            token.address,
            to,
            tokenId,
            {
                name: await token.name(),
                symbol: await token.symbol()
            }
        );

        await tokenManagerERC721.enableAutomaticDeploy({from: schainOwner});
        await messageProxyForSchain.postMessage(tokenManagerERC721.address, chainName, fakeDepositBox.address, data);
        const addressERC721OnSchain = await tokenManagerERC721.clonesErc721(token.address);
        const erc721OnChain = new web3.eth.Contract(artifacts.require("./ERC721OnChain").abi, addressERC721OnSchain);
        expect(await erc721OnChain.methods.ownerOf(tokenId).call()).to.be.equal(to);
    });

});
