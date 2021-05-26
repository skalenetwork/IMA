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
 * @file tokenManagerErc20.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    ERC20OnChain,
    MessagesTester,
    TokenManagerERC20,
    TokenManagerLinker,
    MessageProxyForSchainTester,
    CommunityLocker
} from "../typechain";

import { randomString, stringValue } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

import { deployTokenManagerERC20 } from "./utils/deploy/schain/tokenManagerERC20";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployMessageProxyForSchainTester } from "./utils/deploy/test/messageProxyForSchainTester";
import { deployTokenManagerLinker } from "./utils/deploy/schain/tokenManagerLinker";
import { deploySkaleFeaturesMock } from "./utils/deploy/test/skaleFeaturesMock";
import { deployMessages } from "./utils/deploy/messages";
import { deployCommunityLocker } from "./utils/deploy/schain/communityLocker";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("TokenManagerERC20", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

    const mainnetName = "Mainnet";
    const schainName = "D2-chain";
    const schainId = web3.utils.soliditySha3(schainName);
    const mainnetId = stringValue(web3.utils.soliditySha3("Mainnet"));
    let fakeDepositBox: any;
    let fakeCommunityPool: any;
    let erc20OnChain: ERC20OnChain;
    let eRC20OnChain2: ERC20OnChain;
    let erc20OnMainnet: ERC20OnChain;
    let eRC20OnMainnet2: ERC20OnChain;
    let messageProxyForSchain: MessageProxyForSchainTester;
    let tokenManagerLinker: TokenManagerLinker;
    let tokenManagerErc20: TokenManagerERC20;
    let messages: MessagesTester;
    let communityLocker: CommunityLocker;

    before(async () => {
        [deployer, user, schainOwner] = await ethers.getSigners();
    });

    beforeEach(async () => {
        erc20OnChain = await deployERC20OnChain("ERC20OnChain", "ERC20");
        erc20OnMainnet = await deployERC20OnChain("SKALE", "SKL");
        messages = await deployMessages();
        fakeDepositBox = messages.address;
        fakeCommunityPool = messages.address;

        messageProxyForSchain = await deployMessageProxyForSchainTester(schainName);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, deployer.address);
        communityLocker = await deployCommunityLocker(schainName, messageProxyForSchain.address, tokenManagerLinker, fakeCommunityPool);
        tokenManagerErc20 = await deployTokenManagerERC20(schainName, messageProxyForSchain.address, tokenManagerLinker, communityLocker, fakeDepositBox);
        await erc20OnChain.connect(deployer).grantRole(await erc20OnChain.MINTER_ROLE(), tokenManagerErc20.address);

        const skaleFeatures = await deploySkaleFeaturesMock();
        await skaleFeatures.connect(deployer).setSchainOwner(schainOwner.address);

        await tokenManagerErc20.connect(deployer).grantRole(await tokenManagerErc20.SKALE_FEATURES_SETTER_ROLE(), deployer.address);
        await tokenManagerErc20.connect(deployer).setSkaleFeaturesAddress(skaleFeatures.address);

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(erc20OnMainnet.address, erc20OnChain.address);
        const data = await messages.encodeFreezeStateMessage(user.address, true);
        await messageProxyForSchain.postMessage(communityLocker.address, mainnetId, fakeCommunityPool, data);

        const extraContractRegistrarRole = await messageProxyForSchain.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
    });

    it("should change depositBox address", async () => {
        const newDepositBox = user.address;
        expect(await tokenManagerErc20.depositBox()).to.equal(fakeDepositBox);
        await tokenManagerErc20.connect(user).changeDepositBoxAddress(newDepositBox)
            .should.be.eventually.rejectedWith("Sender is not an Schain owner");
        await tokenManagerErc20.connect(schainOwner).changeDepositBoxAddress(newDepositBox);
        expect(await tokenManagerErc20.depositBox()).to.equal(newDepositBox);
    });

    it("should reject on exit if there is no mainnet token clone on schain", async () => {
        // preparation
        const error = "No token clone on schain";
        const to = user.address;
        const amount = 10;
        // execution/expectation
        await tokenManagerErc20.connect(deployer).exitToMainERC20(deployer.address, to, amount)
            .should.be.eventually.rejectedWith(error);
    });

    it("should send ERC20 token twice", async () => {
        // preparation
        const to = user.address;
        const amount = 10;
        const name = "D2 token";
        const symbol = "D2";
        const totalSupply = 1e9;

        const data = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, { name, symbol, decimals: 18 });
        const data2 = await messages.encodeTransferErc20AndTokenInfoMessage(erc20OnMainnet.address, to, amount, totalSupply, { name, symbol, decimals: 18 });

        await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
        // execution
        const res = await (await messageProxyForSchain.postMessage(tokenManagerErc20.address, mainnetId, fakeDepositBox, data)).wait();

        let newAddress: string;
        // TODO: use waffle
        if (!res.events) {
            assert("No events were emitted");
        } else {
            newAddress = "0x" + res.events[res.events.length - 1].topics[2].slice(-40);
            const newERC20Contract = await (await ethers.getContractFactory("ERC20OnChain")).attach(newAddress) as ERC20OnChain;
            // console.log(newERC20Contract);
            let balance = await newERC20Contract.functions.balanceOf(to);
            parseInt(balance.toString(), 10).should.be.equal(amount);
            // expectation
            await messageProxyForSchain.postMessage(tokenManagerErc20.address, mainnetId, fakeDepositBox, data2);
            balance = await newERC20Contract.functions.balanceOf(to);
            parseInt(balance.toString(), 10).should.be.equal(amount * 2);
        }
    });

    it("should reject with `Insufficient funds` if token balance is too low", async () => {
        // preparation
        const error = "Insufficient funds";
        const amount = 10;
        // execution/expectation
        await erc20OnChain.connect(user).approve(tokenManagerErc20.address, amount);
        const res = await tokenManagerErc20
            .connect(user)
            .exitToMainERC20(erc20OnMainnet.address, user.address, amount)
            .should.be.eventually.rejectedWith(error);
    });

    it("should add token by owner", async () => {
        // preparation
        const newSchainName = randomString(10);
        const addressERC20 = erc20OnChain.address;
        const addressERC201 = erc20OnMainnet.address;
        const automaticDeploy = await tokenManagerErc20.automaticDeploy();
        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(addressERC201, addressERC20);
        // automaticDeploy == true - enabled automaticDeploy = false - disabled
        if (automaticDeploy) {
            await tokenManagerErc20.connect(schainOwner).disableAutomaticDeploy();
        } else {
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
        }

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(addressERC201, addressERC20);

        eRC20OnChain2 = await deployERC20OnChain("NewToken", "NTN");
        eRC20OnMainnet2 = await deployERC20OnChain("NewToken", "NTN");

        if (automaticDeploy) {
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();
        } else {
            await tokenManagerErc20.connect(schainOwner).disableAutomaticDeploy();
        }

        await tokenManagerErc20.connect(schainOwner).addERC20TokenByOwner(eRC20OnMainnet2.address, eRC20OnChain2.address);

    });

    it("should reject with `Transfer is not approved by token holder` when invoke `exitToMainERC20`", async () => {
        const error = "Transfer is not approved by token holder";
        const amount = 20;

        // invoke `grantRole` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exception
        const minterRole = await erc20OnChain.MINTER_ROLE();
        await erc20OnChain.mint(user.address, amount * 2);
        await erc20OnChain.connect(deployer).grantRole(minterRole, tokenManagerErc20.address);
        //
        await erc20OnChain.connect(user).approve(tokenManagerErc20.address, amount / 2);
        // execution/expectation
        await tokenManagerErc20.connect(user).exitToMainERC20(erc20OnMainnet.address, user.address, amount)
            .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `exitToMainERC20` without mistakes", async () => {
        const amount = "20000000000000000";
        const amountMint = "10000000000000000";
        const amountToCost = "9000000000000000";
        const amountReduceCost = "8000000000000000";
        const amountEth = BigNumber.from("60000000000000000");
        await messageProxyForSchain.registerExtraContract("Mainnet", tokenManagerErc20.address);

        // // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
        // await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});

        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await erc20OnChain.connect(deployer).mint(user.address, amountMint);

        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await erc20OnChain.connect(user).approve(tokenManagerErc20.address, amountMint);

        // add schain:
        // await lockAndDataForSchain.addSchain(schainName, tokenManager.address, {from: deployer});

        // execution:
        const res = await tokenManagerErc20
            .connect(user)
            .exitToMainERC20(erc20OnMainnet.address, user.address, amountReduceCost);

        // // expectation:
        const outgoingMessagesCounterMainnet = BigNumber.from(await messageProxyForSchain.getOutgoingMessagesCounter("Mainnet"));
        outgoingMessagesCounterMainnet.should.be.deep.equal(BigNumber.from(1));
    });

    it("should invoke `transferToSchainERC20` without mistakes", async () => {
        const amount = "20000000000000000";
        const amountReduceCost = "8000000000000000";
        const newSchainName = randomString(10);
        await messageProxyForSchain.registerExtraContract(newSchainName, tokenManagerErc20.address);

        // add connected chain:
        await messageProxyForSchain.connect(deployer).grantRole(await messageProxyForSchain.CHAIN_CONNECTOR_ROLE(), deployer.address);
        await messageProxyForSchain.connect(deployer).addConnectedChain(newSchainName);
        // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exception:
        // await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});
        // invoke `mint` to avoid `SafeMath: subtraction overflow` exception on `exitToMainERC20` function:
        await erc20OnChain.connect(deployer).mint(user.address, amount);

        // invoke `approve` to avoid `Not allowed ERC20 Token` exception on `exitToMainERC20` function:
        await erc20OnChain.connect(user).approve(tokenManagerErc20.address, amount);

        // execution:
        await tokenManagerErc20
            .connect(user)
            .transferToSchainERC20(newSchainName, erc20OnMainnet.address, user.address, amountReduceCost)
            .should.be.eventually.rejectedWith("Incorrect Token Manager address");

        await tokenManagerErc20.connect(deployer).addTokenManager(newSchainName, tokenManagerErc20.address);

        await tokenManagerErc20
            .connect(user)
            .transferToSchainERC20(newSchainName, erc20OnMainnet.address, user.address, amountReduceCost);
        // expectation:
        const outgoingMessagesCounter = BigNumber.from(
            await messageProxyForSchain.getOutgoingMessagesCounter(newSchainName));
        outgoingMessagesCounter.should.be.deep.equal(BigNumber.from(1));
    });

    describe("tests for `postMessage` function", async () => {
        it("should transfer ERC20 token", async () => {
            //  preparation
            const remoteTokenManagerAddress = fakeDepositBox;
            const fromSchainName = randomString(10);
            const fromSchainHash = stringValue(web3.utils.soliditySha3(fromSchainName));
            await tokenManagerErc20.addTokenManager(fromSchainName, remoteTokenManagerAddress);

            const amount = 10;
            const to = user.address;
            await erc20OnMainnet.mint(deployer.address, amount);
            const data = await messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnMainnet.address,
                to,
                amount,
                (await erc20OnMainnet.totalSupply()).toNumber(),
                {
                    name: await erc20OnMainnet.name(),
                    symbol: await erc20OnMainnet.symbol(),
                    decimals: BigNumber.from(await erc20OnMainnet.decimals()).toString()
                }
            );
            await tokenManagerErc20.connect(schainOwner).enableAutomaticDeploy();

            // execution
            await messageProxyForSchain.postMessage(tokenManagerErc20.address, fromSchainHash, remoteTokenManagerAddress, data);
            // expectation
            const addressERC20OnSchain = await tokenManagerErc20.clonesErc20(erc20OnMainnet.address);
            const targetErc20OnChain = await (await ethers.getContractFactory("ERC20OnChain")).attach(addressERC20OnSchain) as ERC20OnChain;
            expect(parseInt((await targetErc20OnChain.functions.balanceOf(to)).toString(), 10))
                .to.be.equal(amount);
        });
    });
});
