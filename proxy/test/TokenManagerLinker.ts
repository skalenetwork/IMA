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
 * @file DepositBox.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    CommunityLocker,
    TokenManagerEth,
    TokenManagerERC20,
    TokenManagerERC721,
    TokenManagerLinker,
    MessageProxyForSchainTester,
    MessagesTester
} from "../typechain";
import { randomString, stringValue } from "./utils/helper";


chai.should();
chai.use((chaiAsPromised as any));

import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployTokenManagerEth } from "./utils/deploy/schain/tokenManagerEth";
import { deployTokenManagerERC20 } from "./utils/deploy/schain/tokenManagerERC20";
import { deployTokenManagerERC721 } from "./utils/deploy/schain/tokenManagerERC721";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";
import { deployMessages } from "./utils/deploy/messages";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("TokenManagerLinker", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let user2: SignerWithAddress;

    let tokenManagerEth: TokenManagerEth;
    let tokenManagerERC20: TokenManagerERC20;
    let tokenManagerERC721: TokenManagerERC721;
    let messageProxy: MessageProxyForSchainTester;
    let linker: TokenManagerLinker;
    let communityLocker: CommunityLocker;
    let messages: MessagesTester;
    const schainName = "TestSchain";
    const newSchainName = randomString(10);
    let fakeDepositBox: any;
    let fakeCommunityPool: any;

    before(async () => {
        [deployer, user, user2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        messageProxy = await deployMessageProxyForSchainTester(schainName);
        linker = await deployTokenManagerLinker(messageProxy, deployer.address);
        fakeDepositBox = linker.address;
        fakeCommunityPool = linker.address;
        communityLocker = await deployCommunityLocker(schainName, messageProxy.address, linker, fakeCommunityPool);
        tokenManagerEth = await deployTokenManagerEth(schainName, messageProxy.address, linker, communityLocker, fakeDepositBox);
        tokenManagerERC20 = await deployTokenManagerERC20(schainName, messageProxy.address, linker, communityLocker, fakeDepositBox);
        tokenManagerERC721 = await deployTokenManagerERC721(schainName, messageProxy.address, linker, communityLocker, fakeDepositBox);
        messages = await deployMessages();
        const chainConnectorRole = await messageProxy.CHAIN_CONNECTOR_ROLE();
        await messageProxy.connect(deployer).grantRole(chainConnectorRole, linker.address);
        const extraContractRegistrarRole = await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxy.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
        await messageProxy.registerExtraContractForAll(linker.address);
    });

    it("should allow interchain connection", async () => {
        await linker.connect(deployer).connectSchain(schainName, []).should.be.eventually.rejectedWith("Interchain connection not allowed");
        const data = await messages.encodeInterchainConnectionMessage(true);
        const data2 = await messages.encodeFreezeStateMessage(user.address, true);
        const data3 = await messages.encodeInterchainConnectionMessage(false);
        await messageProxy.connect(deployer).postMessage(linker.address, stringValue(web3.utils.soliditySha3("NotMainnet")), deployer.address, data).should.be.eventually.rejectedWith("Source chain name should be Mainnet");
        await messageProxy.connect(deployer).postMessage(linker.address, stringValue(web3.utils.soliditySha3("Mainnet")), fakeDepositBox, data).should.be.eventually.rejectedWith("Sender from Mainnet is incorrect");
        await messageProxy.connect(deployer).postMessage(linker.address, stringValue(web3.utils.soliditySha3("Mainnet")), deployer.address, data2).should.be.eventually.rejectedWith("The message should contain a interchain connection state");
        await messageProxy.connect(deployer).postMessage(linker.address, stringValue(web3.utils.soliditySha3("Mainnet")), deployer.address, data3).should.be.eventually.rejectedWith("Interchain connection state should be different");
        expect(await linker.interchainConnections()).to.equal(false);
        const res = await (await messageProxy.connect(deployer).postMessage(linker.address, stringValue(web3.utils.soliditySha3("Mainnet")), deployer.address, data)).wait();
        expect(await linker.interchainConnections()).to.equal(true);
        if (!res.events) {
            assert("No events were emitted");
        } else {
            expect(res.events[0]?.topics[0]).to.equal(stringValue(web3.utils.soliditySha3("InterchainConnectionAllowed(bool)")));
            expect(BigNumber.from(res.events[0]?.data).toString()).to.equal("1");
        }

    });

    describe("When interchain connection is turned on", () => {
        let schainName: string;
        beforeEach(async () => {
            const data = await messages.encodeInterchainConnectionMessage(true);
            await messageProxy.connect(deployer).postMessage(linker.address, stringValue(web3.utils.soliditySha3("Mainnet")), deployer.address, data)
            schainName = randomString(10);
        });

        it("should connect schain", async () => {
            const nullAddress = "0x0000000000000000000000000000000000000000";

            // only owner can add schain:
            await linker.connect(user).connectSchain(schainName, []).should.be.rejected;

            // Token Manager address shouldn't be equal zero:
            await linker.connect(deployer).connectSchain(schainName, [nullAddress])
                .should.be.eventually.rejectedWith("Incorrect number of addresses");

            await linker.connect(deployer).connectSchain(schainName, []);
        });

        it("should connect schain with 1 tokenManager", async () => {
            const nullAddress = "0x0000000000000000000000000000000000000000";
            const tokenManagerAddress = user.address;

            expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);

            await linker.connect(deployer).registerTokenManager(tokenManagerEth.address);

            expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(true);

            await linker.connect(deployer).connectSchain(schainName, [])
                .should.be.eventually.rejectedWith("Incorrect number of addresses");

            await linker.connect(deployer).connectSchain(schainName, [tokenManagerAddress, nullAddress])
                .should.be.eventually.rejectedWith("Incorrect number of addresses");

            expect(await linker.hasSchain(schainName)).to.equal(false);

            await linker.connect(deployer).connectSchain(schainName, [nullAddress])
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await linker.connect(deployer).connectSchain(schainName, [tokenManagerAddress])

            expect(await linker.hasSchain(schainName)).to.equal(true);

        });

        it("should connect schain with 3 tokenManager", async () => {
            const nullAddress = "0x0000000000000000000000000000000000000000";
            const tokenManagerAddress = user.address;

            expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);
            expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(false);
            expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(false);

            await linker.connect(deployer).registerTokenManager(tokenManagerEth.address);
            await linker.connect(deployer).registerTokenManager(tokenManagerERC20.address);
            await linker.connect(deployer).registerTokenManager(tokenManagerERC721.address);

            expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(true);
            expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(true);
            expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(true);

            await linker.connect(deployer).connectSchain(schainName, [])
                .should.be.eventually.rejectedWith("Incorrect number of addresses");

            await linker.connect(deployer).connectSchain(schainName, [tokenManagerAddress])
                .should.be.eventually.rejectedWith("Incorrect number of addresses");

            await linker.connect(deployer).connectSchain(schainName, [tokenManagerAddress, nullAddress])
                .should.be.eventually.rejectedWith("Incorrect number of addresses");

            expect(await linker.hasSchain(schainName)).to.equal(false);

            await linker.connect(deployer).connectSchain(schainName, [nullAddress, tokenManagerAddress, nullAddress])
                .should.be.eventually.rejectedWith("Incorrect Token Manager address");

            await linker.connect(deployer).connectSchain(schainName, [tokenManagerAddress, tokenManagerAddress, tokenManagerAddress])

            expect(await linker.hasSchain(schainName)).to.equal(true);
        });

        it("should invoke `unconnectSchain` without mistakes", async () => {
            const nullAddress = "0x0000000000000000000000000000000000000000";
            const tokenManagerAddress = user.address;

            await linker.connect(deployer).registerTokenManager(tokenManagerEth.address);
            await linker.connect(deployer).registerTokenManager(tokenManagerERC20.address);
            await linker.connect(deployer).registerTokenManager(tokenManagerERC721.address);

            await linker.connect(deployer).connectSchain(schainName, [tokenManagerAddress, tokenManagerAddress, tokenManagerAddress]);

            expect(await linker.hasSchain(schainName)).to.equal(true);

            await linker.connect(user).disconnectSchain(schainName).should.be.rejected;
            await linker.connect(deployer).disconnectSchain(schainName);

            expect(await linker.hasSchain(schainName)).to.equal(false);
        });
    });

    it("should register and remove tokenManagers", async () => {
        const nullAddress = "0x0000000000000000000000000000000000000000";
        const tokenManagerAddress = user.address;

        expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);
        expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(false);
        expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(false);

        await linker.connect(deployer).registerTokenManager(tokenManagerEth.address);
        await linker.connect(deployer).registerTokenManager(tokenManagerERC20.address);
        await linker.connect(deployer).registerTokenManager(tokenManagerERC721.address);

        expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(true);
        expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(true);
        expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(true);

        expect(await linker.hasTokenManager(nullAddress)).to.equal(false);
        expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(false);

        await linker.connect(user).registerTokenManager(nullAddress).should.be.rejected;
        await linker.connect(deployer).registerTokenManager(nullAddress);

        expect(await linker.hasTokenManager(nullAddress)).to.equal(true);
        expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(false);

        await linker.connect(deployer).registerTokenManager(tokenManagerAddress);

        expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(true);

        await linker.connect(user).removeTokenManager(tokenManagerAddress).should.be.rejected;
        await linker.connect(deployer).removeTokenManager(tokenManagerAddress);

        expect(await linker.hasTokenManager(tokenManagerAddress)).to.equal(false);

        await linker.connect(deployer).removeTokenManager(nullAddress);

        expect(await linker.hasTokenManager(nullAddress)).to.equal(false);

        await linker.connect(deployer).removeTokenManager(tokenManagerEth.address);
        await linker.connect(deployer).removeTokenManager(tokenManagerERC20.address);
        await linker.connect(deployer).removeTokenManager(tokenManagerERC721.address);

        expect(await linker.hasTokenManager(tokenManagerEth.address)).to.equal(false);
        expect(await linker.hasTokenManager(tokenManagerERC20.address)).to.equal(false);
        expect(await linker.hasTokenManager(tokenManagerERC721.address)).to.equal(false);
    });

});
