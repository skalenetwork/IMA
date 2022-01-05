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
    MessageProxyForSchainWithoutSignature,
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
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { BigNumber } from "ethers";
import { currentTime, skipTime } from "./utils/time";

const schainName = "TestSchain";

describe("CommunityLocker", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;

    let tokenManagerLinker: TokenManagerLinker;
    let messageProxyForSchain: MessageProxyForSchainWithoutSignature;
    let messages: MessagesTester;
    let communityLocker: CommunityLocker;
    let fakeCommunityPool: any;
    const mainnetHash = stringValue(web3.utils.soliditySha3("Mainnet"));

    before(async () => {
        [deployer, user] = await ethers.getSigners();
    });

    beforeEach(async () => {
        messages = await deployMessages();
        fakeCommunityPool = messages.address;
        const messageProxyForSchainWithoutSignatureFactory = await ethers.getContractFactory("MessageProxyForSchainWithoutSignature");
        messageProxyForSchain = await messageProxyForSchainWithoutSignatureFactory.deploy("MyChain") as MessageProxyForSchainWithoutSignature;
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
            .should.be.eventually.rejectedWith("Active user statuses must be different");
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

    it("should set time limit per message", async () => {
        await communityLocker.setTimeLimitPerMessage(0)
            .should.be.eventually.rejectedWith("Not enough permissions to set constant");
        await communityLocker.grantRole(await communityLocker.CONSTANT_SETTER_ROLE(), deployer.address);
        await communityLocker.setTimeLimitPerMessage(0);
        expect(BigNumber.from(await communityLocker.timeLimitPerMessage()).toString()).to.be.equal(BigNumber.from(0).toString());
    });

    it("should set gasprice", async () => {
        const newBLSSignature: [BigNumber, BigNumber] = [
            BigNumber.from("0x2dedd4eaeac95881fbcaa4146f95a438494545c607bd57d560aa1d13d2679db8"),
            BigNumber.from("0x2e9a10a0baf75ccdbd2b5cf81491673108917ade57dea40d350d4cbebd7b0965")
        ];
        const sign = {
            blsSignature: newBLSSignature,
            counter: 0,
            hashA: "0x24079dfb76803f93456a4d274cddcf154a874ae92c1092ef17a979d42ec6d4d4",
            hashB: "0x1a44d878121e17e3f136ddbbba438a38d2dd0fdea786b0a815157828c2154047",
        };
        const time = await currentTime();
        await communityLocker.setGasPrice(100, time + 200, sign).should.be.eventually.rejectedWith("Timestamp should not be in the future");
        await communityLocker.setGasPrice(100, time, sign);
        expect(BigNumber.from(await communityLocker.mainnetGasPrice()).toString()).to.be.equal(BigNumber.from(100).toString());
        expect(BigNumber.from(await communityLocker.gasPriceTimestamp()).toString()).to.be.equal(BigNumber.from(time).toString());

        skipTime(60);

        await communityLocker.setGasPrice(101, time - 20, sign).should.be.eventually.rejectedWith("Gas price timestamp already updated");
        await communityLocker.setGasPrice(101, time, sign).should.be.eventually.rejectedWith("Gas price timestamp already updated");
        await communityLocker.setGasPrice(101, time + 70, sign).should.be.eventually.rejectedWith("Timestamp should not be in the future");
        await communityLocker.setGasPrice(101, time + 40, sign);
        expect(BigNumber.from(await communityLocker.mainnetGasPrice()).toString()).to.be.equal(BigNumber.from(101).toString());
        expect(BigNumber.from(await communityLocker.gasPriceTimestamp()).toString()).to.be.equal(BigNumber.from(time + 40).toString());
    });
});
