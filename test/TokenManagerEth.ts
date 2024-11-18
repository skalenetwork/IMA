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
 * @file TokenManagerEth.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai, { assert } from "chai";
import {
    CommunityLocker,
    EthErc20,
    MessageProxyForSchainTester,
    MessagesTester,
    TokenManagerEth,
    TokenManagerLinker,
} from "../typechain";


chai.should();
chai.use(chaiAsPromised);

import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployTokenManagerEth } from "./utils/deploy/schain/tokenManagerEth";
import { deployMessages } from "./utils/deploy/messages";
import { deployEthErc20 } from "./utils/deploy/schain/ethErc20";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { expect } from "chai";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

const schainName = "TestSchain";
const schainHash = ethers.id(schainName);

describe("TokenManagerEth", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;

    let tokenManagerEth: TokenManagerEth;
    let tokenManagerLinker: TokenManagerLinker;
    let messageProxyForSchain: MessageProxyForSchainTester;
    let messages: MessagesTester;
    let ethERC20: EthErc20;
    let communityLocker: CommunityLocker;
    let fakeDepositBox: string;
    let fakeCommunityPool: string;
    const mainnetHash = ethers.id("Mainnet");

    before(async () => {
        [deployer, user] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const keyStorage = await deployKeyStorageMock();
        messageProxyForSchain = await deployMessageProxyForSchainTester(keyStorage, schainName);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, deployer.address);
        fakeDepositBox = user.address;
        fakeCommunityPool = user.address;
        communityLocker = await deployCommunityLocker(
            schainName,
            messageProxyForSchain,
            tokenManagerLinker,
            fakeCommunityPool
        );
        tokenManagerEth = await deployTokenManagerEth(
            schainName,
            messageProxyForSchain,
            tokenManagerLinker,
            communityLocker,
            fakeDepositBox,
            "0x0000000000000000000000000000000000000000"
        );
        ethERC20 = await deployEthErc20(
            tokenManagerEth
        );
        await tokenManagerLinker.registerTokenManager(tokenManagerEth);
        await tokenManagerEth.connect(deployer).setEthErc20Address(ethERC20);
        messages = await deployMessages();

        const data = await messages.encodeActivateUserMessage(user.address);
        await messageProxyForSchain.postMessage(communityLocker, mainnetHash, fakeCommunityPool, data);

        const extraContractRegistrarRole = await messageProxyForSchain.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
    });

    it("should set EthErc20 address", async () => {
        const newEthErc20Address = tokenManagerLinker;
        // only owner can set EthErc20 address:
        await tokenManagerEth.connect(user).setEthErc20Address(newEthErc20Address).should.be.rejected;
        await tokenManagerEth.connect(deployer).setEthErc20Address(newEthErc20Address);

        // address which has been set should be equal to deployed contract address;
        const address = await tokenManagerEth.ethErc20();
        expect(address).to.equal(newEthErc20Address);
    });

    it("should change depositBox address", async () => {
        const newDepositBox = user.address;
        expect(await tokenManagerEth.depositBox()).to.equal(fakeDepositBox);
        await tokenManagerEth.connect(user).changeDepositBoxAddress(newDepositBox)
            .should.be.eventually.rejectedWith("DEFAULT_ADMIN_ROLE is required");
        await tokenManagerEth.connect(deployer).changeDepositBoxAddress(newDepositBox);
        expect(await tokenManagerEth.depositBox()).to.equal(newDepositBox);
    });

    it("should add tokenManager", async () => {
        const tokenManagerAddress = user.address;
        const nullAddress = "0x0000000000000000000000000000000000000000";
        const schainName2 = "TestSchain2";
        const schainHash = ethers.id(schainName2);

        // only owner can add deposit box:
        await tokenManagerEth.connect(user).addTokenManager(schainName2, tokenManagerAddress).should.be.rejected;

        // deposit box address shouldn't be equal zero:
        await tokenManagerEth.connect(deployer).addTokenManager(schainName2, nullAddress)
            .should.be.rejectedWith("Incorrect Token Manager address");

        // add deposit box:
        await tokenManagerEth.connect(deployer).addTokenManager(schainName2, tokenManagerAddress);

        // deposit box can't be added twice:
        await tokenManagerEth.connect(deployer).addTokenManager(schainName2, tokenManagerAddress).
            should.be.rejectedWith("Token Manager is already set");

        const storedDepositBox = await tokenManagerEth.tokenManagers(schainHash);
        expect(storedDepositBox).to.equal(tokenManagerAddress);
    });

    it("should return true when invoke `hasTokenManager`", async () => {
        // preparation
        const tokenManagerAddress = user.address;
        const schainName2 = "TestSchain2";
        // add schain for return `true` after `hasTokenManager` invoke
        await tokenManagerEth.connect(deployer).addTokenManager(schainName2, tokenManagerAddress);
        // execution
        const res = await tokenManagerEth
            .connect(deployer)
            .hasTokenManager(schainName2);
        // expectation
        assert.isTrue(res);
    });

    it("should return false when invoke `hasTokenManager`", async () => {
        // preparation
        const schainName2 = "TestSchain2";
        // execution
        const res = await tokenManagerEth
            .connect(deployer)
            .hasTokenManager(schainName2);
        // expectation
        assert.isFalse(res);
    });

    it("should invoke `removeTokenManager` without mistakes", async () => {
        // preparation
        const tokenManagerAddress = user.address;
        const nullAddress = "0x0000000000000000000000000000000000000000";
        const schainName2 = "TestSchain2";
        const schainHash = ethers.id(schainName2);
        // add deposit box:
        await tokenManagerEth.connect(deployer).addTokenManager(schainName2, tokenManagerAddress);
        // execution
        await tokenManagerEth.connect(deployer).removeTokenManager(schainName2);
        // expectation
        const getMapping = await tokenManagerEth.tokenManagers(schainHash);
        expect(getMapping).to.equal(nullAddress);
    });

    it("should invoke `removeTokenManager` with 0 depositBoxes", async () => {
        // preparation
        const error = "Token Manager is not set";
        const schainName2 = "TestSchain2";
        // execution/expectation
        await tokenManagerEth.connect(deployer).removeTokenManager(schainName2).should.be.rejectedWith(error);
    });

    it("should send Eth to somebody on Mainnet, closed to Mainnet, called by schain", async () => {
        const amount = 60;
        const amountAfter = 54;
        const amountTo = 6;
        await messageProxyForSchain.registerExtraContract("Mainnet", tokenManagerEth);

        await ethERC20.grantRole(await ethERC20.MINTER_ROLE(), deployer.address);
        await ethERC20.mint(user.address, amount);

        // // send Eth to a client on Mainnet:
        await tokenManagerEth.connect(user).exitToMain(amountTo);
        expect(await ethERC20.balanceOf(user.address)).to.be.equal(amountAfter.toString());

        let data1 = await messages.encodeLockUserMessage(user.address);
        await messageProxyForSchain.postMessage(communityLocker, mainnetHash, fakeCommunityPool, data1);

        await tokenManagerEth.connect(user).exitToMain(amountTo)
            .should.be.eventually.rejectedWith("Recipient must be active");

        data1 = await messages.encodeActivateUserMessage(user.address);
        await messageProxyForSchain.postMessage(communityLocker, mainnetHash, fakeCommunityPool, data1);

        await tokenManagerEth.connect(user).exitToMain(amountTo)
            .should.be.eventually.rejectedWith("Exceeded message rate limit");

    });

    describe("tests for `postMessage` function", async () => {
        it("should rejected with `Sender is not a MessageProxy`", async () => {
            //  preparation
            const error = "Sender is not a MessageProxy";
            const amount = 10;
            const bytesData = await messages.encodeTransferEthMessage(user.address, amount);

            const sender = deployer.address;
            // execution/expectation
            await tokenManagerEth
                .connect(deployer)
                .postMessage(schainHash, sender, bytesData)
                .should.be.eventually.rejectedWith(error);
        });

        it("should be Error event with message `Receiver chain is incorrect` when schainName=`mainnet`", async () => {
            //  preparation
            const error = "Receiver chain is incorrect";
            // for `Receiver chain is incorrect` message schainName should be `Mainnet`
            const amount = 10;
            const bytesData = await messages.encodeTransferEthMessage(user.address, amount);
            const sender = deployer.address;
            // redeploy tokenManagerEth with `developer` address instead `messageProxyForSchain`
            // to avoid `Not a sender` error
            tokenManagerEth = await deployTokenManagerEth(
                schainName,
                messageProxyForSchain,
                tokenManagerLinker,
                communityLocker,
                fakeDepositBox,
                await ethERC20.getAddress()
            );
            // await tokenManagerEth.setContract("MessageProxy", deployer, {from: deployer});
            // execution
            await messageProxyForSchain
                .connect(deployer)
                .postMessage(tokenManagerEth, schainHash, sender, bytesData)
                .should.be.eventually.rejectedWith(error);
        });

        it("should be Error event with message `null`", async () => {
            // for `Invalid data` message bytesData should be `0x`
            const bytesData = "0x";
            const sender = deployer.address;
            // redeploy tokenManagerEth with `developer` address instead `messageProxyForSchain`
            // to avoid `Not a sender` error
            tokenManagerEth = await deployTokenManagerEth(
                schainName,
                messageProxyForSchain,
                tokenManagerLinker,
                communityLocker,
                fakeDepositBox,
                await ethERC20.getAddress()
            );
            // add schain to avoid the `Receiver chain is incorrect` error
            await tokenManagerEth
                .connect(deployer)
                .addTokenManager(schainName, deployer.address);
            // execution
            await tokenManagerEth
                .connect(deployer)
                .postMessage(schainName, sender, bytesData)
                .should.be.rejected;
        });

        it("should transfer eth", async () => {
            //  preparation
            await messageProxyForSchain.registerExtraContractForAll(tokenManagerEth);
            const fromSchainName = "fromSchainName";
            const fromSchainId = ethers.id(fromSchainName);
            const amount = "10";
            const sender = deployer.address;
            const to = user.address;
            // for transfer eth bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
            const bytesData = await messages.encodeTransferEthMessage(to, amount);

            // add schain to avoid the `Receiver chain is incorrect` error
            await tokenManagerEth
                .connect(deployer)
                .addTokenManager(fromSchainName, deployer.address);
            await ethERC20.connect(deployer).grantRole(await ethERC20.MINTER_ROLE(), tokenManagerEth);
            await ethERC20.connect(deployer).grantRole(await ethERC20.BURNER_ROLE(), tokenManagerEth);
            // execution
            await messageProxyForSchain.postMessage(
                tokenManagerEth,
                fromSchainId,
                sender,
                bytesData
            ).should.be.eventually.rejectedWith("Receiver chain is incorrect");

            await messageProxyForSchain.postMessage(
                tokenManagerEth,
                mainnetHash,
                sender,
                bytesData
            ).should.be.eventually.rejectedWith("Receiver chain is incorrect");

            await messageProxyForSchain.postMessage(
                tokenManagerEth,
                mainnetHash,
                fakeDepositBox,
                bytesData
            );
            // expectation
            expect(await ethERC20.balanceOf(to)).to.be.equal(amount);
        });
    });
});
