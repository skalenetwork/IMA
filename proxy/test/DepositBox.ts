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
// import chaiAlmost from "chai-almost";
import {
    ContractManager,
    DepositBoxEth,
    DepositBoxERC20,
    DepositBoxERC721,
    DepositBoxERC1155,
    EthERC20,
    ERC721OnChain,
    ERC1155OnChain,
    Linker,
    MessageProxyForMainnet,
    MessagesTester,
    ERC20OnChain,
    CommunityPool
} from "../typechain";
import { randomString, stringValue } from "./utils/helper";

import chai = require("chai");
import chaiAlmost = require("chai-almost");

chai.should();
chai.use((chaiAsPromised as any));
chai.use(chaiAlmost(0.002));

import { deployDepositBoxEth } from "./utils/deploy/mainnet/depositBoxEth";
import { deployDepositBoxERC20 } from "./utils/deploy/mainnet/depositBoxERC20";
import { deployDepositBoxERC721 } from "./utils/deploy/mainnet/depositBoxERC721";
import { deployDepositBoxERC1155 } from "./utils/deploy/mainnet/depositBoxERC1155";
import { deployLinker } from "./utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { initializeSchain } from "./utils/skale-manager-utils/schainsInternal";
import { setCommonPublicKey } from "./utils/skale-manager-utils/keyStorage";
import { rechargeSchainWallet } from "./utils/skale-manager-utils/wallets";
import { deployMessages } from "./utils/deploy/messages";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";
import { deployERC1155OnChain } from "./utils/deploy/erc1155OnChain";
import { deployCommunityPool } from "./utils/deploy/mainnet/communityPool";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

const BlsSignature: [BigNumber, BigNumber] = [
    BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
    BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781")
];
const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
const Counter = 0;

async function getBalance(address: string) {
    return parseFloat(web3.utils.fromWei(await web3.eth.getBalance(address)));
}
describe("DepositBox", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let user2: SignerWithAddress;

    let depositBoxEth: DepositBoxEth;
    let depositBoxERC20: DepositBoxERC20;
    let depositBoxERC721: DepositBoxERC721;
    let depositBoxERC1155: DepositBoxERC1155;
    let contractManager: ContractManager;
    let messageProxy: MessageProxyForMainnet;
    let linker: Linker;
    let communityPool: CommunityPool;
    let contractManagerAddress = "0x0000000000000000000000000000000000000000";

    before(async () => {
        [deployer, user, user2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        contractManager = await deployContractManager(contractManagerAddress);
        contractManagerAddress = contractManager.address;
        messageProxy = await deployMessageProxyForMainnet(contractManager);
        linker = await deployLinker(messageProxy, contractManager);
        depositBoxEth = await deployDepositBoxEth(contractManager, messageProxy, linker);
        depositBoxERC20 = await deployDepositBoxERC20(contractManager, messageProxy, linker);
        depositBoxERC721 = await deployDepositBoxERC721(contractManager, messageProxy, linker);
        depositBoxERC1155 = await deployDepositBoxERC1155(contractManager, messageProxy, linker);
        communityPool = await deployCommunityPool(contractManager, linker, messageProxy);
    });

    describe("tests for `deposit` function", async () => {

        it("should rejected with `Unconnected chain` when invoke `deposit`", async () => {
            // preparation
            const error = "Unconnected chain";
            const schainName = randomString(10);
            // execution/expectation
            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, user.address)
                .should.be.eventually.rejectedWith(error);
        });

        it("should rejected with `Unconnected chain` when invoke `deposit`", async () => {
            // preparation
            const error = "Unconnected chain";
            const schainName = "Mainnet";
            // execution/expectation
            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, user.address)
                .should.be.eventually.rejectedWith(error);
        });

        it("should invoke `deposit` without mistakes", async () => {
            // preparation
            const schainName = randomString(10);
            // the wei should be MORE than (55000 * 1000000000)
            // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
            // to avoid the `Not enough money` error
            const wei = "20000000000000000";
            // add schain to avoid the `Unconnected chain` error
            const chain = await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
            // execution
            const tx = await depositBoxEth
                .connect(deployer)
                .deposit(schainName, deployer.address, { value: wei });
            // console.log("Gas for deposit:", tx.receipt.gasUsed);

            const lockAndDataBalance = await web3.eth.getBalance(depositBoxEth.address);
            // expectation
            expect(lockAndDataBalance).to.equal(wei);
        });

        it("should revert `Not allowed. in DepositBox`", async () => {
            // preparation
            const error = "Use deposit function";
            // execution/expectation
            await web3.eth.sendTransaction({ from: deployer.address, to: depositBoxEth.address, value: "1000000000000000000" })
                .should.be.eventually.rejectedWith(error);
        });

        it("should get funds after kill", async () => {
            const schainName = randomString(10);
            const wei = "20000000000000000";
            const wei2 = "40000000000000000";
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address]);
            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, deployer.address, { value: wei });
            await depositBoxEth.getFunds(schainName, user.address, wei).should.be.eventually.rejectedWith("Schain is not killed");
            await linker.connect(deployer).kill(schainName);
            await linker.connect(user).kill(schainName);
            const userBalanceBefore = await web3.eth.getBalance(user.address);
            await depositBoxEth.connect(deployer).getFunds(schainName, user.address, wei2).should.be.eventually.rejectedWith("Incorrect amount");
            await depositBoxEth.connect(deployer).getFunds(schainName, user.address, wei);
            expect(BigNumber.from(await web3.eth.getBalance(user.address)).toString()).to.equal(BigNumber.from(userBalanceBefore).add(BigNumber.from(wei)).toString());
        });
    });

    describe("tests with `ERC20`", async () => {
        let erc20: ERC20OnChain;

        beforeEach(async () => {
            erc20 = await deployERC20OnChain("D2-token", "D2");
        });

        describe("tests for `depositERC20` function", async () => {

            it("should rejected with `Whitelist is enabled`", async () => {
                // preparation
                const error = "Whitelist is enabled";
                const schainName = randomString(10);
                // add schain to avoid the `Unconnected chain` error
                const chain = await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);

                await erc20.connect(deployer).mint(user.address, "1000000000");
                await erc20.connect(deployer).approve(depositBoxERC20.address, "1000000");
                // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
                // execution/expectation
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20.address, deployer.address, 100)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should rejected with `DepositBox was not approved for ERC20 token`", async () => {
                // preparation
                const error = "DepositBox was not approved for ERC20 token";
                const schainName = randomString(10);
                // add schain to avoid the `Unconnected chain` error
                const chain = await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);

                await erc20.connect(deployer).mint(user.address, "1000000000");
                await depositBoxERC20.disableWhitelist(schainName);
                // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
                // execution/expectation
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20.address, deployer.address, 100)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should invoke `depositERC20` without mistakes", async () => {
                // preparation
                const schainName = randomString(10);
                // add schain to avoid the `Unconnected chain` error
                const chain = await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
                // mint some quantity of ERC20 tokens for `deployer` address
                await erc20.connect(deployer).mint(deployer.address, "1000000000");
                // approve some quantity of ERC20 tokens for `depositBoxEth` address
                await erc20.connect(deployer).approve(depositBoxERC20.address, "1000000");
                // execution
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20.address, deployer.address, 1).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC20.disableWhitelist(schainName);
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20.address, deployer.address, 1);
                const res = await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20.address, deployer.address, 1);
                // console.log("Gas for depoositERC20:", res.receipt.gasUsed);
            });
        });

        it("should get funds after kill", async () => {
            const schainName = randomString(10);
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address]);
            await erc20.connect(deployer).mint(deployer.address, "1000000000");
            await erc20.connect(deployer).approve(depositBoxERC20.address, "1000000");
            await depositBoxERC20.disableWhitelist(schainName);
            await depositBoxERC20
                .connect(deployer)
                .depositERC20(schainName, erc20.address, deployer.address, 1);
            await depositBoxERC20.getFunds(schainName, erc20.address, user.address, 1).should.be.eventually.rejectedWith("Schain is not killed");
            await linker.connect(deployer).kill(schainName);
            await linker.connect(user).kill(schainName);
            await depositBoxERC20.getFunds(schainName, erc20.address, user.address, 2).should.be.eventually.rejectedWith("Incorrect amount");
            await depositBoxERC20.connect(deployer).getFunds(schainName, erc20.address, user.address, 1);
            expect(BigNumber.from(await erc20.balanceOf(user.address)).toString()).to.equal("1");
        });
    });

    describe("tests with `ERC721`", async () => {
        let eRC721OnChain: ERC721OnChain;

        beforeEach(async () => {
            eRC721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721");

            // mint some ERC721 of  for `deployer` address
            const tokenId = 10;
            await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
            const tokenId2 = 11;
            await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId2);

        });

        describe("tests for `depositERC721` function", async () => {
            it("should rejected with `DepositBox was not approved for ERC721 token`", async () => {
                // preparation
                const error = "DepositBox was not approved for ERC721 token";
                const schainName = randomString(10);
                const contractHere = eRC721OnChain.address;
                const to = user.address;
                const tokenId = 10;
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                const wei = "20000000000000000";
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);

                // execution/expectation
                await depositBoxERC721
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, to, tokenId)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should invoke `depositERC721` without mistakes", async () => {
                // preparation
                const schainName = randomString(10);
                const contractHere = eRC721OnChain.address;
                const to = user.address;
                const tokenId = 10;
                const tokenId2 = 11;
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
                // transfer tokenId from `deployer` to `depositBoxERC721`
                await eRC721OnChain.connect(deployer).approve(depositBoxERC721.address, tokenId);
                await eRC721OnChain.connect(deployer).approve(depositBoxERC721.address, tokenId2);
                // execution
                await depositBoxERC721
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, to, tokenId).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC721.disableWhitelist(schainName);
                await depositBoxERC721
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, to, tokenId);
                const res = await (await depositBoxERC721
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, to, tokenId2)).wait();
                // console.log("Gas for depoositERC721:", res.receipt.gasUsed);
                // expectation
                expect(await eRC721OnChain.ownerOf(tokenId)).to.equal(depositBoxERC721.address);
                expect(await eRC721OnChain.ownerOf(tokenId2)).to.equal(depositBoxERC721.address);
            });
        });

        it("should get funds after kill", async () => {
            const schainName = randomString(10);
            const tokenId = 10;
            const tokenId2 = 11;
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address]);
            await eRC721OnChain.connect(deployer).approve(depositBoxERC721.address, tokenId);
            await depositBoxERC721.disableWhitelist(schainName);
            await depositBoxERC721
                .connect(deployer)
                .depositERC721(schainName, eRC721OnChain.address, deployer.address, tokenId);
            await depositBoxERC721.getFunds(schainName, eRC721OnChain.address, user.address, tokenId).should.be.eventually.rejectedWith("Schain is not killed");
            await linker.connect(deployer).kill(schainName);
            await linker.connect(user).kill(schainName);
            await depositBoxERC721.getFunds(schainName, eRC721OnChain.address, user.address, tokenId2).should.be.eventually.rejectedWith("Incorrect tokenId");
            await depositBoxERC721.connect(deployer).getFunds(schainName, eRC721OnChain.address, user.address, tokenId);
            expect(await eRC721OnChain.ownerOf(tokenId)).to.equal(user.address);
        });
    });

    describe("tests with `ERC1155`", async () => {
        let eRC1155OnChain: ERC1155OnChain;

        beforeEach(async () => {
            eRC1155OnChain = await deployERC1155OnChain("New ERC1155 Token");

            // mint some ERC1155 of  for `deployer` address
            const id = 10;
            const amount = 5;
            await eRC1155OnChain.connect(deployer).mint(deployer.address, id, amount, "0x");
            const id2 = 5;
            const amount2 = 10;
            await eRC1155OnChain.connect(deployer).mint(deployer.address, id2, amount2, "0x");
            const ids = [1, 2, 3];
            const amounts = [3, 2, 1];
            await eRC1155OnChain.connect(deployer).mintBatch(deployer.address, ids, amounts, "0x");
            const ids2 = [5, 4, 99];
            const amounts2 = [9, 77, 888];
            await eRC1155OnChain.connect(deployer).mintBatch(deployer.address, ids2, amounts2, "0x");

        });

        describe("tests for `depositERC1155` function", async () => {
            it("should rejected with `DepositBox was not approved for ERC1155 token`", async () => {
                // preparation
                const error = "DepositBox was not approved for ERC1155 token";
                const schainName = randomString(10);
                const contractHere = eRC1155OnChain.address;
                const to = user.address;
                const id = 5;
                const amount = 7;
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                const wei = "20000000000000000";
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);

                // execution/expectation
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155(schainName, contractHere, to, id, amount)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should invoke `depositERC1155` without mistakes", async () => {
                // preparation
                const schainName = randomString(10);
                const contractHere = eRC1155OnChain.address;
                const to = user.address;
                const id = 5;
                const amount = 7;
                const id2 = 10;
                const amount2 = 3;
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
                // transfer tokenId from `deployer` to `depositBoxERC1155`
                await eRC1155OnChain.connect(deployer).setApprovalForAll(depositBoxERC1155.address, true);
                // execution
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155(schainName, contractHere, to, id, amount).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC1155.disableWhitelist(schainName);
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155(schainName, contractHere, to, id, amount);
                const res = await (await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155(schainName, contractHere, to, id2, amount2)).wait();
                // console.log("Gas for depoositERC1155:", res.receipt.gasUsed);
                // expectation
                expect(BigNumber.from(await eRC1155OnChain.balanceOf(depositBoxERC1155.address, id)).toNumber()).to.equal(amount);
                expect(BigNumber.from(await eRC1155OnChain.balanceOf(depositBoxERC1155.address, id2)).toNumber()).to.equal(amount2);
            });

            it("should rejected with `DepositBox was not approved for ERC1155 token Batch`", async () => {
                // preparation
                const error = "DepositBox was not approved for ERC1155 token Batch";
                const schainName = randomString(10);
                const contractHere = eRC1155OnChain.address;
                const to = user.address;
                const ids = [1, 2, 3];
                const amounts = [3, 2, 1];
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                const wei = "20000000000000000";
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);

                // execution/expectation
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155Batch(schainName, contractHere, to, ids, amounts)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should invoke `depositERC1155Batch` without mistakes", async () => {
                // preparation
                const schainName = randomString(10);
                const contractHere = eRC1155OnChain.address;
                const to = user.address;
                const ids = [1, 2, 3];
                const amounts = [3, 2, 1];
                const ids2 = [5, 4, 99];
                const amounts2 = [9, 77, 888];
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
                // transfer tokenId from `deployer` to `depositBoxERC1155`
                await eRC1155OnChain.connect(deployer).setApprovalForAll(depositBoxERC1155.address, true);
                // execution
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155Batch(schainName, contractHere, to, ids, amounts).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC1155.disableWhitelist(schainName);
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155Batch(schainName, contractHere, to, ids, amounts);
                const res = await (await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155Batch(schainName, contractHere, to, ids2, amounts2)).wait();
                // console.log("Gas for depoositERC1155:", res.receipt.gasUsed);
                // expectation
                const balanceIds = await eRC1155OnChain.balanceOfBatch([depositBoxERC1155.address, depositBoxERC1155.address, depositBoxERC1155.address], ids);
                const balanceIds2 = await eRC1155OnChain.balanceOfBatch([depositBoxERC1155.address, depositBoxERC1155.address, depositBoxERC1155.address], ids2);
                const balanceIdsNumber: number[] = [];
                const balanceIds2Number: number[] = [];
                balanceIds.forEach(element => {
                    balanceIdsNumber.push(BigNumber.from(element).toNumber())
                });
                balanceIds2.forEach(element => {
                    balanceIds2Number.push(BigNumber.from(element).toNumber())
                });
                expect(balanceIdsNumber).to.deep.equal(amounts);
                expect(balanceIds2Number).to.deep.equal(amounts2);
            });
        });
    });

    describe("tests for `postMessage` function", async () => {
        // let eRC20ModuleForMainnet: ERC20ModuleForMainnetInstance;
        // let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
        let erc20: ERC20OnChain;
        // let eRC721ModuleForMainnet: ERC721ModuleForMainnet;
        // let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721;
        let eRC721OnChain: ERC721OnChain;
        let eRC1155OnChain: ERC1155OnChain;
        let messages: MessagesTester;

        beforeEach(async () => {
            // eRC20ModuleForMainnet = await deployERC20ModuleForMainnet(lockAndDataForMainnet);
            // lockAndDataForMainnetERC20 = await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
            erc20 = await deployERC20OnChain("D2-token", "D2",);
            // eRC721ModuleForMainnet = await deployERC721ModuleForMainnet(lockAndDataForMainnet);
            // lockAndDataForMainnetERC721 = await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
            eRC721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721");
            eRC1155OnChain = await deployERC1155OnChain("New ERC1155 Token");
            messages = await deployMessages();
        });

        it("should rejected with `Sender is not a MessageProxy`", async () => {
            //  preparation
            const error = "Sender is not a MessageProxy";
            const schainName = randomString(10);
            const amount = "10";
            const bytesData = await messages.encodeTransferEthMessage(user.address, amount);
            const sender = deployer.address;
            // execution/expectation
            await depositBoxEth
                .connect(user)
                .postMessage(stringValue(web3.utils.soliditySha3(schainName)), sender, bytesData)
                .should.be.eventually.rejectedWith(error);
        });

        it("should rejected with message `Receiver chain is incorrect` when schain is not registered in DepositBox", async () => {
            //  preparation
            const error = "Receiver chain is incorrect";
            // for `Receiver chain is incorrect` message schainName should be `Mainnet`
            const schainName = "Bob";
            const wei = 1e18.toString();
            const amountEth = "10";
            const bytesData = await messages.encodeTransferEthMessage(user.address, amountEth);
            const senderFromSchain = deployer.address;

            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            const message = {
                data: bytesData,
                destinationContract: depositBoxEth.address,
                sender: senderFromSchain
            };
            // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
            // to avoid `Incorrect sender` error
            await messageProxy.connect(deployer).addConnectedChain(schainName);
            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, { value: wei });
            // execution

            const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign, 0)).wait();
            // console.log(res.logs);
            if (res.events) {
                assert.equal(res.events[0].event, "PostMessageError");
                assert.equal(res.events[0].args?.msgCounter.toString(), "0");
                const messageError = res.events[0].args?.message.toString();
                assert.equal(Buffer.from(messageError.slice(2), 'hex').toString(), error);
            } else {
                assert(false, "No events were emitted");
            }
            // assert.equal(res.logs[0].args.message, "PostMessageError");
        });

        it("should rejected with message `Not enough money to finish this transaction` when "
            + "`sender != ILockAndDataDB(lockAndDataAddress).tokenManagerAddresses(schainHash)`", async () => {
                //  preparation
                const error = "Not enough money to finish this transaction";
                const schainName = randomString(10);
                const wei = 1e18.toString();
                const amountEth = "10";
                const bytesData = await messages.encodeTransferEthMessage(user.address, amountEth);
                const senderFromSchain = deployer.address;

                const sign = {
                    blsSignature: BlsSignature,
                    counter: Counter,
                    hashA: HashA,
                    hashB: HashB,
                };

                const message = {
                    data: bytesData,
                    destinationContract: depositBoxEth.address,
                    sender: senderFromSchain
                };
                // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
                // to avoid `Incorrect sender` error
                const chain = await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
                await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
                await setCommonPublicKey(contractManager, schainName);
                await communityPool
                    .connect(user)
                    .rechargeUserWallet(schainName, { value: wei });
                // execution
                const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign, 0)).wait();

                if (res.events) {
                    assert.equal(res.events[0].event, "PostMessageError");
                    assert.equal(res.events[0].args?.msgCounter.toString(), "0");
                    const messageError = res.events[0].args?.message.toString();
                    assert.equal(Buffer.from(messageError.slice(2), 'hex').toString(), error);
                } else {
                    assert(false, "No events were emitted");
                }
            });

        it("should rejected with message `Not enough money to finish this transaction`", async () => {
            //  preparation
            const error = "Not enough money to finish this transaction";
            const schainName = randomString(10);
            const amountEth = "10";
            const wei = 1e18.toString();
            const bytesData = await messages.encodeTransferEthMessage(user.address, amountEth);
            const senderFromSchain = deployer.address;

            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            const chain = await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, { value: wei });

            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            const message = {
                data: bytesData,
                destinationContract: depositBoxEth.address,
                sender: senderFromSchain
            };
            // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
            // to avoid `Incorrect sender` error
            // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
            // execution
            const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign, 0)).wait();

            if (res.events) {
                assert.equal(res.events[0].event, "PostMessageError");
                assert.equal(res.events[0].args?.msgCounter.toString(), "0");
                const messageError = res.events[0].args?.message.toString();
                assert.equal(Buffer.from(messageError.slice(2), 'hex').toString(), error);
            } else {
                assert(false, "No events were emitted");
            }
        });

        it("should rejected with message `null`", async () => {
            //  preparation
            const schainName = randomString(10);
            const amountEth = "10";
            // for `Invalid data` message bytesData should be `0x`
            const bytesData = "0x";
            const senderFromSchain = deployer.address;
            const wei = 1e18.toString();

            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            const chain = await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, { value: wei });

            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            const message = {
                data: bytesData,
                destinationContract: depositBoxEth.address,
                sender: senderFromSchain,
            };
            // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
            // to avoid `Incorrect sender` error
            // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
            // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, user.address, { value: wei });
            // execution
            const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign, 0)).wait();

            if (res.events) {
                assert.equal(res.events[0].event, "PostMessageError");
                assert.equal(res.events[0].args?.msgCounter.toString(), "0");
                assert.equal(res.events[0].args?.message, "0x");
            } else {
                assert(false, "No events were emitted");
            }
        });

        it("should transfer eth", async () => {
            //  preparation
            const schainName = randomString(10);
            // for transfer eth bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
            const senderFromSchain = deployer.address;
            const minTransactionGas = (await communityPool.minTransactionGas()).toNumber();
            const wei = "30000000000000000";
            const bytesData = await messages.encodeTransferEthMessage(user.address, wei);

            await setCommonPublicKey(contractManager, schainName);

            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            const message = {
                data: bytesData,
                destinationContract: depositBoxEth.address,
                sender: senderFromSchain,
            };
            // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
            // to avoid `Incorrect sender` error
            // await lockAndDataForMainnet.setContract("MessageProxy", deployer);
            // add schain to avoid the `Receiver chain is incorrect` error

            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            const chain = await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, { value: wei });
            // add wei to contract through `receiveEth` because `receiveEth` have `payable` parameter
            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, user.address, { value: wei });
            // execution
            const balanceBefore = await getBalance(deployer.address);
            await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign, 0);
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);
            // console.log("Gas for postMessage Eth:", res.receipt.gasUsed);
            // expectation
            await depositBoxEth.approveTransfers(user.address);
        });

        it("should transfer ERC20 token", async () => {
            //  preparation
            const contractHere = erc20.address;
            const schainName = randomString(10);
            const amount = 10;
            const to = user.address;
            const to0 = "0x0000000000000000000000000000000000000000"; // ERC20 address
            const senderFromSchain = deployer.address;
            const wei = 1e18.toString();

            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            const message = {
                data: await messages.encodeTransferErc20Message(contractHere, to, amount),
                destinationContract: depositBoxERC20.address,
                sender: senderFromSchain
            };

            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, { value: wei });

            // mint some quantity of ERC20 tokens for `deployer` address
            await erc20.connect(deployer).mint(user.address, amount);
            /**
             * transfer more than `amount` quantity of ERC20 tokens
             * for `depositBoxERC20` to avoid `Not enough money`
             */
            await erc20.connect(user).approve(depositBoxERC20.address, amount);
            // get data from `receiveERC20`
            await depositBoxERC20.disableWhitelist(schainName);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20.address, user.address, amount);
            // execution
            // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
            // to avoid `Incorrect sender` error
            const balanceBefore = await getBalance(deployer.address);
            const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign, 0)).wait();
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);
            // console.log("Gas for postMessage ERC20:", res.receipt.gasUsed);
            // expectation
            (await erc20.balanceOf(user.address)).toString().should.be.equal(amount.toString());
        });

        it("should transfer ERC721 token", async () => {
            //  preparation
            const contractHere = eRC721OnChain.address;
            const schainName = randomString(10);
            const tokenId = 10;
            const to = user.address;
            const to0 = "0x0000000000000000000000000000000000000000"; // ERC721 address
            const senderFromSchain = deployer.address;
            const wei = 1e18.toString();


            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            const message = {
                data: await messages.encodeTransferErc721Message(contractHere, to, tokenId),
                destinationContract: depositBoxERC721.address,
                sender: senderFromSchain
            };

            await initializeSchain(contractManager, schainName, user2.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            // add schain to avoid the `Receiver chain is incorrect` error
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, { value: wei });

            // mint some ERC721 of  for `deployer` address
            await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
            // transfer tokenId from `deployer` to `depositBoxERC721`
            await eRC721OnChain.connect(deployer).transferFrom(deployer.address, depositBoxERC721.address, tokenId);
            // get data from `receiveERC721`
            await depositBoxERC721.disableWhitelist(schainName);
            // execution
            // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
            // to avoid `Incorrect sender` error
            const balanceBefore = await getBalance(deployer.address);
            await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign, 0);
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);
            // console.log("Gas for postMessage ERC721:", res.receipt.gasUsed);
            // expectation
            (await eRC721OnChain.ownerOf(tokenId)).should.be.equal(user.address);
        });

        it("should transfer ERC1155 token", async () => {
            //  preparation
            const contractHere = eRC1155OnChain.address;
            const schainName = randomString(10);
            const id = 5;
            const amount = 7;
            const to = user.address;
            const to0 = "0x0000000000000000000000000000000000000000"; // ERC1155 address
            const senderFromSchain = deployer.address;
            const wei = 1e18.toString();


            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            const message = {
                data: await messages.encodeTransferErc1155Message(contractHere, to, id, amount),
                destinationContract: depositBoxERC1155.address,
                sender: senderFromSchain
            };

            await initializeSchain(contractManager, schainName, user2.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            // add schain to avoid the `Receiver chain is incorrect` error
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, { value: wei });

            // mint some ERC1155 of  for `deployer` address
            await eRC1155OnChain.connect(deployer).mint(deployer.address, id, amount, "0x");
            await eRC1155OnChain.connect(deployer).setApprovalForAll(depositBoxERC1155.address, true);
            // transfer tokenId from `deployer` to `depositBoxERC1155`
            // await eRC1155OnChain.connect(deployer).transferFrom(deployer.address, depositBoxERC1155.address, tokenId);
            // get data from `receiveERC1155`
            await depositBoxERC1155.disableWhitelist(schainName);
            await depositBoxERC1155
                .connect(deployer)
                .depositERC1155(schainName, contractHere, to, id, amount);
            // execution
            // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
            // to avoid `Incorrect sender` error
            const balanceBefore = await getBalance(deployer.address);
            const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign, 0)).wait();
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);
            // console.log("Gas for postMessage ERC1155:", res.receipt.gasUsed);
            // expectation
            (BigNumber.from(await eRC1155OnChain.balanceOf(user.address, id)).toNumber()).should.be.equal(amount);
        });

        it("should transfer ERC1155 token Batch", async () => {
            //  preparation
            const contractHere = eRC1155OnChain.address;
            const schainName = randomString(10);
            const ids = [5, 6, 7];
            const amounts = [100, 100, 100];
            const to = user.address;
            const to0 = "0x0000000000000000000000000000000000000000"; // ERC1155 address
            const senderFromSchain = deployer.address;
            const wei = 1e18.toString();


            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            const message = {
                data: await messages.encodeTransferErc1155BatchMessage(contractHere, to, ids, amounts),
                destinationContract: depositBoxERC1155.address,
                sender: senderFromSchain
            };

            await initializeSchain(contractManager, schainName, user2.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            // add schain to avoid the `Receiver chain is incorrect` error
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, { value: wei });

            // mint some ERC1155 of  for `deployer` address
            await eRC1155OnChain.connect(deployer).mintBatch(deployer.address, ids, amounts, "0x");
            await eRC1155OnChain.connect(deployer).setApprovalForAll(depositBoxERC1155.address, true);
            // transfer tokenId from `deployer` to `depositBoxERC1155`
            // await eRC1155OnChain.connect(deployer).transferFrom(deployer.address, depositBoxERC1155.address, tokenId);
            // get data from `receiveERC1155`
            await depositBoxERC1155.disableWhitelist(schainName);
            await depositBoxERC1155
                .connect(deployer)
                .depositERC1155Batch(schainName, contractHere, to, ids, amounts);
            // execution
            // redeploy depositBoxEth with `developer` address instead `messageProxyForMainnet.address`
            // to avoid `Incorrect sender` error
            const balanceBefore = await getBalance(deployer.address);
            const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign, 0)).wait();
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);
            // console.log("Gas for postMessage ERC1155:", res.receipt.gasUsed);
            // expectation
            const balanceIds = await eRC1155OnChain.balanceOfBatch([user.address, user.address, user.address], ids);
            const balanceIdsNumber: number[] = [];
            balanceIds.forEach(element => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);
        });

    });

});
