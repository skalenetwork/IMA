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
    DepositBoxERC1155,
    ERC1155OnChain,
    Linker,
    MessageProxyForMainnet,
    MessagesTester,
    CommunityPool
} from "../typechain";
import { randomString, stringFromHex, stringValue } from "./utils/helper";

import chai = require("chai");
import chaiAlmost = require("chai-almost");

chai.should();
chai.use((chaiAsPromised as any));
chai.use(chaiAlmost(0.002));

import { deployDepositBoxERC1155 } from "./utils/deploy/mainnet/depositBoxERC1155";
import { deployLinker } from "./utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { initializeSchain } from "./utils/skale-manager-utils/schainsInternal";
import { rechargeSchainWallet } from "./utils/skale-manager-utils/wallets";
import { setCommonPublicKey } from "./utils/skale-manager-utils/keyStorage";
import { deployMessages } from "./utils/deploy/messages";
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
describe("DepositBoxERC1155", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let user2: SignerWithAddress;

    let depositBoxERC1155: DepositBoxERC1155;
    let contractManager: ContractManager;
    let messageProxy: MessageProxyForMainnet;
    let linker: Linker;
    let communityPool: CommunityPool;
    const contractManagerAddress = "0x0000000000000000000000000000000000000000";
    const schainName = "Schain";

    before(async () => {
        [deployer, user, user2] = await ethers.getSigners();
    });

    beforeEach(async () => {
        contractManager = await deployContractManager(contractManagerAddress);
        messageProxy = await deployMessageProxyForMainnet(contractManager);
        linker = await deployLinker(contractManager, messageProxy);
        depositBoxERC1155 = await deployDepositBoxERC1155(contractManager, linker, messageProxy);
        communityPool = await deployCommunityPool(contractManager, linker, messageProxy);
        await messageProxy.grantRole(await messageProxy.CHAIN_CONNECTOR_ROLE(), linker.address);
        await messageProxy.grantRole(await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE(), deployer.address);
        await initializeSchain(contractManager, schainName, user.address, 1, 1);
        await rechargeSchainWallet(contractManager, schainName, user2.address, "1000000000000000000");
        await messageProxy.registerExtraContractForAll(depositBoxERC1155.address);
        await messageProxy.registerExtraContract(schainName, communityPool.address);
        await messageProxy.registerExtraContract(schainName, linker.address);
    });

    describe("tests with `ERC1155`", async () => {
        let erc1155: ERC1155OnChain;

        beforeEach(async () => {
            erc1155 = await deployERC1155OnChain("New ERC1155 Token");

            // mint some ERC1155 of  for `deployer` address
            const id = 10;
            const amount = 5;
            await erc1155.connect(deployer).mint(deployer.address, id, amount, "0x");
            const id2 = 5;
            const amount2 = 10;
            await erc1155.connect(deployer).mint(deployer.address, id2, amount2, "0x");
            const ids = [1, 2, 3];
            const amounts = [3, 2, 1];
            await erc1155.connect(deployer).mintBatch(deployer.address, ids, amounts, "0x");
            const ids2 = [5, 4, 99];
            const amounts2 = [9, 77, 888];
            await erc1155.connect(deployer).mintBatch(deployer.address, ids2, amounts2, "0x");

        });

        it("should add erc1155 token by schain owner", async () => {
            const fakeERC1155Contract = deployer.address;
            await depositBoxERC1155.connect(user).addERC1155TokenByOwner(schainName, fakeERC1155Contract)
                .should.be.eventually.rejectedWith("Given address is not a contract");
            await depositBoxERC1155.connect(deployer).addERC1155TokenByOwner(schainName, erc1155.address)
                .should.be.eventually.rejectedWith("Sender is not an Schain owner");

            await depositBoxERC1155.connect(user).addERC1155TokenByOwner(schainName, erc1155.address);
            await depositBoxERC1155.connect(user).addERC1155TokenByOwner(schainName, erc1155.address).should.be.eventually.rejectedWith("ERC1155 Token was already added");
            expect(await depositBoxERC1155.getSchainToERC1155(schainName, erc1155.address)).to.be.equal(true);
            expect((await depositBoxERC1155.getSchainToAllERC1155(schainName, 0, 1))[0]).to.be.equal(erc1155.address);
            expect((await depositBoxERC1155.getSchainToAllERC1155(schainName, 0, 1)).length).to.be.equal(1);
            expect((await depositBoxERC1155.getSchainToAllERC1155Length(schainName)).toString()).to.be.equal("1");
            await depositBoxERC1155.getSchainToAllERC1155(schainName, 1, 0).should.be.eventually.rejectedWith("Range is incorrect");
            await depositBoxERC1155.getSchainToAllERC1155(schainName, 0, 11).should.be.eventually.rejectedWith("Range is incorrect");
        });

        describe("tests for `depositERC1155` function", async () => {
            it("should rejected with `DepositBox was not approved for ERC1155 token`", async () => {
                // preparation
                const error = "DepositBox was not approved for ERC1155 token";
                const contractHere = erc1155.address;
                const to = user.address;
                const id = 5;
                const amount = 7;
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                const wei = "20000000000000000";
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);

                // execution/expectation
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155(schainName, contractHere, id, amount)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should invoke `depositERC1155` without mistakes", async () => {
                // preparation
                const contractHere = erc1155.address;
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
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
                // transfer tokenId from `deployer` to `depositBoxERC1155`
                await erc1155.connect(deployer).setApprovalForAll(depositBoxERC1155.address, true);
                // execution
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155(schainName, contractHere, id, amount).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC1155.connect(user).disableWhitelist(schainName);
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155(schainName, contractHere, id, amount);
                await (await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155(schainName, contractHere, id2, amount2)).wait();
                // console.log("Gas for depositERC1155:", res.receipt.gasUsed);
                // expectation
                expect(BigNumber.from(await erc1155.balanceOf(depositBoxERC1155.address, id)).toNumber()).to.equal(amount);
                expect(BigNumber.from(await erc1155.balanceOf(depositBoxERC1155.address, id2)).toNumber()).to.equal(amount2);
            });

            it("should rejected with `DepositBox was not approved for ERC1155 token Batch`", async () => {
                // preparation
                const error = "DepositBox was not approved for ERC1155 token Batch";
                const contractHere = erc1155.address;
                const to = user.address;
                const ids = [1, 2, 3];
                const amounts = [3, 2, 1];
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                const wei = "20000000000000000";
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);

                // execution/expectation
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155Batch(schainName, contractHere, ids, amounts)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should invoke `depositERC1155Batch` without mistakes", async () => {
                // preparation
                const contractHere = erc1155.address;
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
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
                // transfer tokenId from `deployer` to `depositBoxERC1155`
                await erc1155.connect(deployer).setApprovalForAll(depositBoxERC1155.address, true);
                // execution
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155Batch(schainName, contractHere, ids, amounts).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC1155.connect(user).disableWhitelist(schainName);
                await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155Batch(schainName, contractHere, ids, amounts);
                const res = await (await depositBoxERC1155
                    .connect(deployer)
                    .depositERC1155Batch(schainName, contractHere, ids2, amounts2)).wait();
                // console.log("Gas for depositERC1155:", res.receipt.gasUsed);
                // expectation
                const balanceIds = await erc1155.balanceOfBatch([depositBoxERC1155.address, depositBoxERC1155.address, depositBoxERC1155.address], ids);
                const balanceIds2 = await erc1155.balanceOfBatch([depositBoxERC1155.address, depositBoxERC1155.address, depositBoxERC1155.address], ids2);
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

        it("should get funds after kill", async () => {
            await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
            await erc1155.connect(deployer).mint(deployer.address, 4, 100, "0x");
            await erc1155.connect(deployer).setApprovalForAll(depositBoxERC1155.address, true);
            await depositBoxERC1155.connect(user).disableWhitelist(schainName);
            await depositBoxERC1155
                .connect(deployer)
                .depositERC1155(schainName, erc1155.address, 4, 50);
            await depositBoxERC1155.connect(user).getFunds(schainName, erc1155.address, user.address, [4], [50]).should.be.eventually.rejectedWith("Schain is not killed");
            await linker.connect(deployer).kill(schainName);
            await linker.connect(user).kill(schainName);
            await depositBoxERC1155.connect(user).getFunds(schainName, erc1155.address, user.address, [4], [60]).should.be.eventually.rejectedWith("Incorrect amount");
            await depositBoxERC1155.connect(user).getFunds(schainName, erc1155.address, user.address, [4], [50]);
            expect(BigNumber.from(await erc1155.balanceOf(user.address, 4)).toString()).to.equal("50");
        });

        it("should add erc token by schain owner", async () => {
            const fakeERC1155Contract = deployer.address;
            await depositBoxERC1155.connect(user).addERC1155TokenByOwner(schainName, fakeERC1155Contract)
                .should.be.eventually.rejectedWith("Given address is not a contract");
            await depositBoxERC1155.connect(user).addERC1155TokenByOwner(schainName, erc1155.address);
            expect(await depositBoxERC1155.getSchainToERC1155(schainName, erc1155.address)).to.be.equal(true);
        });

        it("should not allow to add token by schain owner if schain killed", async () => {
            await linker.connect(deployer).kill(schainName);
            await linker.connect(user).kill(schainName);
            await depositBoxERC1155.connect(user).addERC1155TokenByOwner(schainName, erc1155.address)
                .should.be.eventually.rejectedWith("Schain is killed");
        });
    });

    describe("tests for `postMessage` function", async () => {
        let erc1155: ERC1155OnChain;
        let messages: MessagesTester;

        beforeEach(async () => {
            erc1155 = await deployERC1155OnChain("New ERC1155 Token");
            messages = await deployMessages();
        });

        it("should transfer ERC1155 token", async () => {
            //  preparation
            const contractHere = erc1155.address;
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
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, user.address, { value: wei });

            // mint some ERC1155 of  for `deployer` address
            await erc1155.connect(deployer).mint(deployer.address, id, amount, "0x");
            await erc1155.connect(deployer).setApprovalForAll(depositBoxERC1155.address, true);
            // transfer tokenId from `deployer` to `depositBoxERC1155`
            // await erc1155.connect(deployer).transferFrom(deployer.address, depositBoxERC1155.address, tokenId);
            // get data from `receiveERC1155`
            await depositBoxERC1155.connect(user2).disableWhitelist(schainName);
            await depositBoxERC1155
                .connect(deployer)
                .depositERC1155(schainName, contractHere, id, amount);
            // execution
            // to avoid `Incorrect sender` error
            const balanceBefore = await getBalance(deployer.address);
            const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign)).wait();
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);
            // console.log("Gas for postMessage ERC1155:", res.receipt.gasUsed);
            // expectation
            (BigNumber.from(await erc1155.balanceOf(user.address, id)).toNumber()).should.be.equal(amount);
        });

        it("should transfer ERC1155 token Batch", async () => {
            //  preparation
            const contractHere = erc1155.address;
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
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, user.address, { value: wei });

            // mint some ERC1155 of  for `deployer` address
            await erc1155.connect(deployer).mintBatch(deployer.address, ids, amounts, "0x");
            await erc1155.connect(deployer).setApprovalForAll(depositBoxERC1155.address, true);
            // transfer tokenId from `deployer` to `depositBoxERC1155`
            // await erc1155.connect(deployer).transferFrom(deployer.address, depositBoxERC1155.address, tokenId);
            // get data from `receiveERC1155`
            await depositBoxERC1155.connect(user2).disableWhitelist(schainName);
            await depositBoxERC1155
                .connect(deployer)
                .depositERC1155Batch(schainName, contractHere, ids, amounts);
            // execution
            // to avoid `Incorrect sender` error
            const balanceBefore = await getBalance(deployer.address);
            const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign)).wait();
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);
            // console.log("Gas for postMessage ERC1155:", res.receipt.gasUsed);
            // expectation
            const balanceIds = await erc1155.balanceOfBatch([user.address, user.address, user.address], ids);
            const balanceIdsNumber: number[] = [];
            balanceIds.forEach(element => {
                balanceIdsNumber.push(BigNumber.from(element).toNumber())
            });
            expect(balanceIdsNumber).to.deep.equal(amounts);
        });

    });

});
