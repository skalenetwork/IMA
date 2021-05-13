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
    MessageProxyForSchainInstance,
    MessageProxyForSchainContract,
    SkaleFeaturesMockContract,
    TokenManagerERC721MockInstance,
    TokenManagerERC721MockContract,
    MessagesTesterContract,
    MessagesTesterInstance,
    } from "../types/truffle-contracts";

import chai = require("chai");
import { gasMultiplier } from "./utils/command_line";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

import artifactERC721OnChain = require("../build/contracts/ERC721OnChain.json");
const TokenManagerERC721: TokenManagerERC721Contract = artifacts.require("./TokenManagerERC721");
const TokenManagerERC721Mock: TokenManagerERC721MockContract = artifacts.require("./TokenManagerERC721Mock");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");
const TokenManagerLinker: TokenManagerLinkerContract = artifacts.require("./TokenManagerLinker");
const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const SkaleFeaturesMock: SkaleFeaturesMockContract = artifacts.require("./SkaleFeaturesMock");
const MessagesTester: MessagesTesterContract = artifacts.require("./MessagesTester");

contract("TokenManagerERC721", ([deployer, user, schainOwner, depositBox]) => {
    const schainName = "V-chain";
    let tokenManagerERC721: TokenManagerERC721Instance;
    let eRC721OnChain: ERC721OnChainInstance;
    let eRC721OnMainnet: ERC721OnChainInstance;
    let tokenManagerLinker: TokenManagerLinkerInstance;
    let messageProxyForSchain: MessageProxyForSchainInstance;
    let tokenManagerERC721Mock: TokenManagerERC721MockInstance;
    let messages: MessagesTesterInstance;

    beforeEach(async () => {
        messageProxyForSchain = await MessageProxyForSchain.new(schainName);
        tokenManagerLinker = await TokenManagerLinker.new(messageProxyForSchain.address);
        messages = await MessagesTester.new();

        const skaleFeatures = await SkaleFeaturesMock.new();
        await skaleFeatures.setSchainOwner(schainOwner);

        tokenManagerERC721 =
            await TokenManagerERC721.new(schainName, messageProxyForSchain.address, tokenManagerLinker.address, depositBox);
        await tokenManagerERC721.grantRole(await tokenManagerERC721.SKALE_FEATURES_SETTER_ROLE(), deployer);
        await tokenManagerERC721.setSkaleFeaturesAddress(skaleFeatures.address);

        tokenManagerERC721Mock =
            await TokenManagerERC721Mock.new(schainName, messageProxyForSchain.address, tokenManagerLinker.address, depositBox);
        await tokenManagerERC721Mock.grantRole(await tokenManagerERC721Mock.SKALE_FEATURES_SETTER_ROLE(), deployer);
        await tokenManagerERC721Mock.setSkaleFeaturesAddress(skaleFeatures.address);

        eRC721OnChain = await ERC721OnChain.new("ELVIS", "ELV", {from: deployer});
        eRC721OnMainnet = await ERC721OnChain.new("SKALE", "SKL", {from: deployer});
    });

    it("should rejected with `ERC721 contract does not exist on SKALE chain`", async () => {
        // preparation
        const error = "ERC721 contract does not exist on SKALE chain";
        const contractHere = eRC721OnChain.address;
        const schainID = randomString(10);
        const to = user;
        const tokenId = 1;
        // execution/expectation
        await tokenManagerERC721Mock.receiveERC721(schainID, contractHere , to, tokenId, {from: deployer})
        .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `receiveERC721`", async () => {
        // preparation
        const contractThere = eRC721OnMainnet.address;
        const contractHere = eRC721OnChain.address;
        const schainID = randomString(10);
        const to = user;
        const tokenId = 1;

        // await tokenManagerERC721Mock.enableAutomaticDeploy(schainID, {from: schainOwner});
        // add ERC721 token to avoid "ERC721 contract does not exist on SKALE chain" error
        await tokenManagerERC721Mock
        .addERC721TokenByOwner(schainID, contractThere, contractHere, {from: schainOwner});
        // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
        // transfer ERC721 token to `lockAndDataForMainnetERC721` to avoid "Token not transferred" error
        await eRC721OnChain.transferFrom(deployer, tokenManagerERC721Mock.address, tokenId, {from: deployer});
        // execution
        const res = await tokenManagerERC721Mock.receiveERC721.call(schainID, contractThere , to, tokenId, {from: deployer});
        // expectation
        (res).should.include("0x");
    });

    it("should return `true` when invoke `sendERC721`", async () => {
        // preparation
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721OnMainnet.address;
        const schainID = randomString(10);
        const to = user;
        const tokenId = 2;

        // mint ERC721 to avoid "ERC721: owner query for nonexistent token" error
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
        // transfer tokenId from `deployer` to `tokenManagerERC721`
        await eRC721OnChain.transferFrom(deployer, tokenManagerERC721Mock.address, tokenId, {from: deployer});
        await tokenManagerERC721Mock.enableAutomaticDeploy({from: schainOwner});
        await tokenManagerERC721Mock.addERC721TokenByOwner(schainID, contractThere, contractHere, {from: schainOwner});
        const minterRole = await eRC721OnChain.MINTER_ROLE();
        await eRC721OnChain.grantRole(minterRole, tokenManagerERC721Mock.address);
        // get data from `receiveERC721`
        await tokenManagerERC721Mock.receiveERC721(schainID, contractThere , to, tokenId, {from: deployer});
        // execution
        const data = await messages.encodeTransferErc721AndTokenInfoMessage(
            contractThere,
            to,
            tokenId,
            {
                name: await eRC721OnMainnet.name(),
                symbol: await eRC721OnMainnet.symbol()
            }
        );
        await tokenManagerERC721Mock.sendERC721(schainID, data, {from: deployer});
        // expectation
        expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(user);
    });

    it("should rejected with `Token not transferred` after invoke `receiveERC721`", async () => {
        // preparation
        const error = "Token not transferred";
        const schainID = randomString(10);
        const to = user;
        const contractThere = eRC721OnMainnet.address;
        const contractHere = eRC721OnChain.address;
        const tokenId = 10;
        // mint some quantity of ERC721 tokens for `deployer` address
        await tokenManagerERC721Mock.addERC721TokenByOwner(schainID, contractThere, contractHere, {from: schainOwner});
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
        // execution/expectation
        await tokenManagerERC721Mock
            .receiveERC721(schainID, contractThere , to, tokenId, {from: deployer})
            .should.be.eventually.rejectedWith(error);
    });


    it("should invoke `exitToMainERC721`", async () => {
        const error = "Not allowed ERC721 Token";
        const tokenId = 10;
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721OnMainnet.address;
        const to = user;

        await eRC721OnChain.mint(user, tokenId, {from: deployer});
        await tokenManagerERC721.addERC721TokenByOwner("Mainnet", contractThere, contractHere, {from: schainOwner});

        await tokenManagerERC721
            .exitToMainERC721(contractThere, to, tokenId, {from: deployer})
            .should.be.eventually.rejectedWith(error);

        await eRC721OnChain.approve(tokenManagerERC721.address, tokenId, {from: user});

        // execution:
        await tokenManagerERC721.exitToMainERC721(contractThere, to, tokenId, {from: user});
        // expectation:
        const outgoingMessagesCounterMainnet = new BigNumber(await messageProxyForSchain
            .getOutgoingMessagesCounter("Mainnet"));
        outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
    });

    it("should invoke `transferToSchainERC721`", async () => {
        const error = "Not allowed ERC721 Token";
        const tokenId = 10;
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721OnMainnet.address;
        const to = user;
        const schainID = randomString(10);

        const chainConnectorRole = await messageProxyForSchain.CHAIN_CONNECTOR_ROLE();
        await messageProxyForSchain.grantRole(chainConnectorRole, deployer);

        await messageProxyForSchain.addConnectedChain(schainID, {from: deployer});
        await tokenManagerERC721.addERC721TokenByOwner(schainID, contractThere, contractHere, {from: schainOwner});
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});

        await tokenManagerERC721
            .transferToSchainERC721(schainID, contractThere, to, tokenId, {from: deployer})
            .should.be.eventually.rejectedWith(error);

        await eRC721OnChain.approve(tokenManagerERC721.address, tokenId, {from: deployer});

        // execution:
        await tokenManagerERC721
            .transferToSchainERC721(schainID, contractThere, to, tokenId, {from: deployer});
        // expectation:
        const outgoingMessagesCounter = new BigNumber(await messageProxyForSchain
            .getOutgoingMessagesCounter(schainID));
        outgoingMessagesCounter.should.be.deep.equal(new BigNumber(1));
    });

    it("should transfer ERC721 token through `postMessage` function", async () => {
        //  preparation
        const schainID = randomString(10);
        const to = user;
        const sender = deployer;
        const tokenId = 2;
        const data = await messages.encodeTransferErc721AndTokenInfoMessage(
            eRC721OnMainnet.address,
            to,
            tokenId,
            {
                name: await eRC721OnMainnet.name(),
                symbol: await eRC721OnMainnet.symbol()
            }
        );

        const skaleFeatures = await SkaleFeaturesMock.new();
        await skaleFeatures.setSchainOwner(schainOwner);

        const tokenManagerERC721Tester =
            await TokenManagerERC721.new(schainName, deployer, tokenManagerLinker.address, depositBox);
        await tokenManagerERC721Tester.grantRole(await tokenManagerERC721Tester.SKALE_FEATURES_SETTER_ROLE(), deployer);
        await tokenManagerERC721Tester.setSkaleFeaturesAddress(skaleFeatures.address);
        await tokenManagerERC721Tester.enableAutomaticDeploy({from: schainOwner});
        await tokenManagerERC721Tester.addTokenManager(schainID, deployer);

        // execution
        const res = await tokenManagerERC721Tester.postMessage(schainID, sender, data, {from: deployer});
        // expectation
        const addressERC721OnSchain = res.logs[res.logs.length-1].args.erc721OnSchain;
        const erc721OnChain = new web3.eth.Contract(artifacts.require("./ERC721MintAndBurn").abi, addressERC721OnSchain);
        expect(await erc721OnChain.methods.ownerOf(tokenId).call()).to.be.equal(to);
    });

});
