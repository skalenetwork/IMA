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
 * @file CommunityLocker.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    CommunityLocker,
    MessageProxyForSchainTester,
    MessagesTester,
    TokenManagerLinker,
} from "../typechain";
import { stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

import { deployMessages } from "./utils/deploy/messages";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { assert, expect } from "chai";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { BigNumber } from "ethers";

const schainName = "TestSchain";

describe("CommunityLocker", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;

    let tokenManagerLinker: TokenManagerLinker;
    let messageProxyForSchain: MessageProxyForSchainTester;
    let messages: MessagesTester;
    let communityLocker: CommunityLocker;
    let fakeCommunityPool: any;
    const mainnetHash = stringValue(web3.utils.soliditySha3("Mainnet"));

    before(async () => {
        [deployer, user] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const keyStorage = await deployKeyStorageMock();
        messages = await deployMessages();
        fakeCommunityPool = messages.address;
        messageProxyForSchain = await deployMessageProxyForSchainTester(keyStorage.address, schainName);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, deployer.address);
        communityLocker = await deployCommunityLocker(schainName, messageProxyForSchain.address, tokenManagerLinker, fakeCommunityPool);
    })

    it("should activate user", async () => {
        const schainHash = stringValue(web3.utils.soliditySha3("Schain"));
        const data = await messages.encodeActivateUserMessage(deployer.address);
        const fakeData = await messages.encodeTransferEthMessage(user.address, 1);
        await communityLocker.postMessage(mainnetHash, fakeCommunityPool, data)
            .should.be.eventually.rejectedWith("Sender is not a message proxy");

        await messageProxyForSchain.postMessage(communityLocker.address, mainnetHash, deployer.address, data)
            .should.be.eventually.rejectedWith("Sender must be CommunityPool");

        await messageProxyForSchain.postMessage(communityLocker.address, schainHash, fakeCommunityPool, data)
            .should.be.eventually.rejectedWith("Source chain name must be Mainnet");

        await messageProxyForSchain.postMessage(communityLocker.address, mainnetHash, fakeCommunityPool, fakeData)
            .should.be.eventually.rejectedWith("The message should contain a status of user");

        expect(await communityLocker.activeUsers(deployer.address)).to.be.equal(false);

        await messageProxyForSchain.postMessage(communityLocker.address, mainnetHash, fakeCommunityPool, data);
        await messageProxyForSchain.postMessage(communityLocker.address, mainnetHash, fakeCommunityPool, data)
            .should.be.eventually.rejectedWith("User statuses must be different");
        expect(await communityLocker.activeUsers(deployer.address)).to.be.equal(true);
    });

    it("should activate and then lock user", async () => {
        const activateData = await messages.encodeActivateUserMessage(user.address);
        const lockData = await messages.encodeLockUserMessage(user.address);
        await messageProxyForSchain.postMessage(communityLocker.address, mainnetHash, fakeCommunityPool, activateData);
        expect(await communityLocker.activeUsers(user.address)).to.be.equal(true);
        await messageProxyForSchain.postMessage(communityLocker.address, mainnetHash, fakeCommunityPool, lockData);
        expect(await communityLocker.activeUsers(user.address)).to.be.equal(false);
    });

    it("should time limit per message", async () => {
        await communityLocker.connect(user).setTimeLimitPerMessage(0)
            .should.be.eventually.rejectedWith("Not enough permissions to set constant");
        await communityLocker.grantRole(await communityLocker.CONSTANT_SETTER_ROLE(), user.address);
        await communityLocker.connect(user).setTimeLimitPerMessage(0);
        expect(await communityLocker.timeLimitPerMessage()).to.be.deep.equal(BigNumber.from(0));
    });
});
