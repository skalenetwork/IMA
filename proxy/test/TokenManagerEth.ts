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
import chai = require("chai");
import {
    CommunityLocker,
    EthErc20,
    MessageProxyForSchainTester,
    MessagesTester,
    TokenManagerEth,
    TokenManagerLinker,
} from "../typechain";
import { gasMultiplier } from "./utils/command_line";
import { randomString, stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deployTokenManagerEth } from "./utils/deploy/schain/tokenManagerEth";
import { deployMessages } from "./utils/deploy/messages";
import { deployEthErc20 } from "./utils/deploy/schain/ethErc20";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

const schainName = "TestSchain";
const schainHash = stringValue(web3.utils.soliditySha3(schainName));

describe("TokenManagerEth", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;

    let tokenManagerEth: TokenManagerEth;
    let tokenManagerLinker: TokenManagerLinker;
    let messageProxyForSchain: MessageProxyForSchainTester;
    let messages: MessagesTester;
    let ethERC20: EthErc20;
    let communityLocker: CommunityLocker;
    let fakeDepositBox: any;
    let fakeCommunityPool: any;
    const mainnetId = stringValue(web3.utils.soliditySha3("Mainnet"));

    before(async () => {
        [deployer, user] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const keyStorage = await deployKeyStorageMock();
        messageProxyForSchain = await deployMessageProxyForSchainTester(keyStorage.address, schainName);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, deployer.address);
        fakeDepositBox = tokenManagerLinker.address;
        fakeCommunityPool = tokenManagerLinker.address;
        communityLocker = await deployCommunityLocker(schainName, messageProxyForSchain.address, tokenManagerLinker, fakeCommunityPool);
        tokenManagerEth = await deployTokenManagerEth(
            schainName,
            messageProxyForSchain.address,
            tokenManagerLinker,
            communityLocker,
            fakeDepositBox,
            "0x0000000000000000000000000000000000000000"
        );
        ethERC20 = await deployEthErc20(
            tokenManagerEth
        );
        await tokenManagerEth.connect(deployer).setEthErc20Address(ethERC20.address);
        messages = await deployMessages();

        const data = await messages.encodeFreezeStateMessage(user.address, true);
        await messageProxyForSchain.postMessage(communityLocker.address, mainnetId, fakeCommunityPool, data);

        const extraContractRegistrarRole = await messageProxyForSchain.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
    });

    it("should set EthErc20 address", async () => {
        const newEthErc20Address = tokenManagerLinker.address;
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

        const storedDepositBox = await tokenManagerEth.tokenManagers(stringValue(web3.utils.soliditySha3(schainName2)));
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
        expect(res).to.be.true;
    });

    it("should return false when invoke `hasTokenManager`", async () => {
        // preparation
        const schainName2 = "TestSchain2";
        // execution
        const res = await tokenManagerEth
            .connect(deployer)
            .hasTokenManager(schainName2);
        // expectation
        expect(res).to.be.false;
    });

    it("should invoke `removeTokenManager` without mistakes", async () => {
        // preparation
        const tokenManagerAddress = user.address;
        const nullAddress = "0x0000000000000000000000000000000000000000";
        const schainName2 = "TestSchain2";
        // add deposit box:
        await tokenManagerEth.connect(deployer).addTokenManager(schainName2, tokenManagerAddress);
        // execution
        await tokenManagerEth.connect(deployer).removeTokenManager(schainName2);
        // expectation
        const getMapping = await tokenManagerEth.tokenManagers(stringValue(web3.utils.soliditySha3(schainName2)));
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
        const amount = BigNumber.from("600000000000000000");
        const amountTo = BigNumber.from("20000000000000000");
        const amountTo2 = BigNumber.from("60000000000000000");
        const amountAfter = BigNumber.from("540000000000000000");
        const to = user.address;
        await messageProxyForSchain.registerExtraContract("Mainnet", tokenManagerEth.address);

        await ethERC20.connect(deployer).grantRole(await ethERC20.MINTER_ROLE(), deployer.address);
        await ethERC20.connect(deployer).mint(user.address, amount);

        // transfer ownership of using ethERC20 contract method to tokenManagerEth contract address:
        // await ethERC20.transferOwnership(tokenManagerEth.address, {from: deployer});

        // send Eth:
        // await tokenManagerEth.sendEth(user, amount, {from: deployer});

        // send Eth to a client on Mainnet:
        await tokenManagerEth.connect(user).exitToMain(to, amountTo2);
        const balanceAfter = BigNumber.from(await ethERC20.balanceOf(user.address));
        balanceAfter.should.be.deep.equal(amountAfter);
    });

    it("should transfer to somebody on schain Eth and some data", async () => {
        const amount = BigNumber.from("20000000000000000");
        const amountTo = BigNumber.from("2000000000000000");
        const amountAfter = BigNumber.from("18000000000000000");
        const bytesData = "0x0";
        const to = deployer.address;
        const newSchainName = randomString(10);
        await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerEth.address);

        // set contract TokenManagerEth:
        // await tokenManagerEth.setContract("TokenManagerEth", tokenManagerEth.address, {from: deployer});

        const chainConnectorRole = await messageProxyForSchain.CHAIN_CONNECTOR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(chainConnectorRole, deployer.address);

        // add connected chain:
        await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);

        await ethERC20.connect(deployer).grantRole(await ethERC20.MINTER_ROLE(), deployer.address);
        await ethERC20.connect(deployer).mint(user.address, amount);

        // add schain:
        await tokenManagerEth.connect(deployer).addTokenManager(newSchainName, user.address);

        // send Eth and data to a client on schain:
        await tokenManagerEth.connect(user).transferToSchain(newSchainName, to, amountTo);

        const balanceAfter = BigNumber.from(await ethERC20.balanceOf(user.address));
        balanceAfter.should.be.deep.equal(amountAfter);
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
            // redeploy tokenManagerEth with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManagerEth = await deployTokenManagerEth(schainName, deployer.address, tokenManagerLinker, communityLocker, fakeDepositBox, ethERC20.address);
            // await tokenManagerEth.setContract("MessageProxy", deployer, {from: deployer});
            // execution
            await tokenManagerEth
                .connect(deployer)
                .postMessage(schainHash, sender, bytesData)
                .should.be.eventually.rejectedWith(error);
        });

        it("should be Error event with message `null`", async () => {
            //  preparation
            const error = "Invalid data";
            const amount = 10;
            // for `Invalid data` message bytesData should be `0x`
            const bytesData = "0x";
            const sender = deployer.address;
            // redeploy tokenManagerEth with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManagerEth = await deployTokenManagerEth(schainName, deployer.address, tokenManagerLinker, communityLocker, fakeDepositBox, ethERC20.address);
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
            const fromSchainName = randomString(10);
            const fromSchainId = stringValue(web3.utils.soliditySha3(fromSchainName));
            const amount = "10";
            const sender = deployer.address;
            const to = user.address;
            // for transfer eth bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
            const bytesData = await messages.encodeTransferEthMessage(to, amount);
            // redeploy tokenManagerEth with `developer` address instead `messageProxyForSchain.address`
            // to avoid `Not a sender` error
            tokenManagerEth = await deployTokenManagerEth(schainName, deployer.address, tokenManagerLinker, communityLocker, fakeDepositBox, ethERC20.address);
            // add schain to avoid the `Receiver chain is incorrect` error
            await tokenManagerEth
                .connect(deployer)
                .addTokenManager(fromSchainName, deployer.address);
            await ethERC20.connect(deployer).grantRole(await ethERC20.MINTER_ROLE(), tokenManagerEth.address);
            await ethERC20.connect(deployer).grantRole(await ethERC20.BURNER_ROLE(), tokenManagerEth.address);
            // execution
            await tokenManagerEth
                .connect(deployer)
                .postMessage(fromSchainId, sender, bytesData);
            // expectation
            expect(parseInt((BigNumber.from(await ethERC20.balanceOf(to))).toString(), 10))
                .to.be.equal(parseInt(amount, 10));
        });
    });
});
