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
    DepositBoxERC721WithMetadata,
    ERC721OnChain,
    Linker,
    MessageProxyForMainnet,
    MessagesTester,
    CommunityPool
} from "../typechain";
import { getBalance, getPublicKey, stringToHex } from "./utils/helper";

import chai = require("chai");
import chaiAlmost = require("chai-almost");

chai.should();
chai.use(chaiAsPromised);
chai.use(chaiAlmost(0.002));

import { deployDepositBoxERC721WithMetadata } from "./utils/deploy/mainnet/depositBoxERC721WithMetadata";
import { deployLinker } from "./utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { initializeSchain, addNodesToSchain } from "./utils/skale-manager-utils/schainsInternal";
import { rechargeSchainWallet } from "./utils/skale-manager-utils/wallets";
import { setCommonPublicKey } from "./utils/skale-manager-utils/keyStorage";
import { deployMessages } from "./utils/deploy/messages";
import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";
import { deployCommunityPool } from "./utils/deploy/mainnet/communityPool";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BigNumberish, HDNodeWallet, Wallet } from "ethers";

import { expect } from "chai";
import { createNode } from "./utils/skale-manager-utils/nodes";

const BlsSignature: [BigNumberish, BigNumberish] = [
    "178325537405109593276798394634841698946852714038246117383766698579865918287",
    "493565443574555904019191451171395204672818649274520396086461475162723833781"
];
const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
const Counter = 0;

describe("DepositBoxERC721WithMetadata", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let user2: SignerWithAddress;
    let richGuy: SignerWithAddress;
    let nodeAddress: HDNodeWallet;

    let depositBoxERC721WithMetadata: DepositBoxERC721WithMetadata;
    let contractManager: ContractManager;
    let messageProxy: MessageProxyForMainnet;
    let linker: Linker;
    let communityPool: CommunityPool;
    let messages: MessagesTester;
    const contractManagerAddress = "0x0000000000000000000000000000000000000000";
    const schainName = "Schain";
    const schainHash = ethers.id(schainName);

    before(async () => {
        [deployer, user, user2, richGuy] = await ethers.getSigners();
        nodeAddress = Wallet.createRandom().connect(ethers.provider);
        const balanceRichGuy = await ethers.provider.getBalance(richGuy.address);
        await richGuy.sendTransaction({to: nodeAddress.address, value: balanceRichGuy - BigInt(ethers.parseEther("1"))});
    });

    after(async () => {
        const balanceNode = await ethers.provider.getBalance(nodeAddress.address);
        await nodeAddress.sendTransaction({to: richGuy.address, value: balanceNode - BigInt(ethers.parseEther("1"))});
    });

    beforeEach(async () => {
        contractManager = await deployContractManager(contractManagerAddress);
        messageProxy = await deployMessageProxyForMainnet(contractManager);
        linker = await deployLinker(contractManager, messageProxy);
        depositBoxERC721WithMetadata = await deployDepositBoxERC721WithMetadata(contractManager, linker, messageProxy);
        communityPool = await deployCommunityPool(contractManager, linker, messageProxy);
        messages = await deployMessages();
        await messageProxy.grantRole(await messageProxy.CHAIN_CONNECTOR_ROLE(), await linker.getAddress());
        await messageProxy.grantRole(await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE(), deployer.address);
        await initializeSchain(contractManager, schainName, user.address, 1, 1);
        const nodeCreationParams = {
            port: 1337,
            nonce: 1337,
            ip: "0x12345678",
            publicIp: "0x12345678",
            publicKey: getPublicKey(nodeAddress),
            name: "GasCalculationNode",
            domainName: "gascalculationnode.com"
        };
        await createNode(contractManager, nodeAddress.address, nodeCreationParams);
        await addNodesToSchain(contractManager, schainName, [0]);
        await rechargeSchainWallet(contractManager, schainName, user2.address, "1000000000000000000");
        await messageProxy.registerExtraContractForAll(await depositBoxERC721WithMetadata.getAddress());
        await messageProxy.registerExtraContract(schainName, await communityPool.getAddress());
        await messageProxy.registerExtraContract(schainName, await linker.getAddress());
    });

    describe("tests with `ERC721`", async () => {
        let erc721: ERC721OnChain;
        let erc721OnChain: ERC721OnChain;

        beforeEach(async () => {
            erc721 = await deployERC721OnChain("ERC721OnChain", "ERC721");
            erc721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721");

            // mint some ERC721 of  for `deployer` address
            const tokenId = 10;
            const tokenURI = "Hello10";
            await erc721OnChain.connect(deployer).mint(deployer.address, tokenId);
            await erc721OnChain.connect(deployer).setTokenURI(tokenId, tokenURI);
            const tokenId2 = 11;
            const tokenURI2 = "Hello11";
            await erc721OnChain.connect(deployer).mint(deployer.address, tokenId2);
            await erc721OnChain.connect(deployer).setTokenURI(tokenId2, tokenURI2);

        });

        describe("tests for `depositERC721` function", async () => {

            it("should rejected with `Unconnected chain`", async () => {
                //  preparation
                const amount = 10;

                await depositBoxERC721WithMetadata.connect(user).depositERC721(schainName, await erc721.getAddress(), amount)
                    .should.be.eventually.rejectedWith("Unconnected chain");
            });

            it("should rejected with `DepositBox was not approved for ERC721 token`", async () => {
                // preparation
                const error = "DepositBox was not approved for ERC721 token";
                const contractHere = await erc721OnChain.getAddress();
                const tokenId = 10;
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);

                // execution/expectation
                await depositBoxERC721WithMetadata
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, tokenId)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should invoke `depositERC721` without mistakes", async () => {
                // preparation
                const contractHere = await erc721OnChain.getAddress();
                const tokenId = 10;
                const tokenId2 = 11;
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
                // transfer tokenId from `deployer` to `depositBoxERC721WithMetadata`
                await erc721OnChain.connect(deployer).approve(await depositBoxERC721WithMetadata.getAddress(), tokenId);
                await erc721OnChain.connect(deployer).approve(await depositBoxERC721WithMetadata.getAddress(), tokenId2);
                // execution
                await depositBoxERC721WithMetadata
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, tokenId).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC721WithMetadata.connect(user).disableWhitelist(schainName);
                await depositBoxERC721WithMetadata
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, tokenId);
                await (await depositBoxERC721WithMetadata
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, tokenId2)).wait();
                // console.log("Gas for depositERC721:", res.receipt.gasUsed);
                // expectation
                expect(await erc721OnChain.ownerOf(tokenId)).to.equal(await depositBoxERC721WithMetadata.getAddress());
                expect(await erc721OnChain.ownerOf(tokenId2)).to.equal(await depositBoxERC721WithMetadata.getAddress());
            });

            it("should invoke `depositERC721Direct` without mistakes", async () => {
                // preparation
                const contractHere = await erc721OnChain.getAddress();
                const to = user.address;
                const tokenId = 10;
                const tokenId2 = 11;
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
                // transfer tokenId from `deployer` to `depositBoxERC721`
                await erc721OnChain.connect(deployer).approve(await depositBoxERC721WithMetadata.getAddress(), tokenId);
                await erc721OnChain.connect(deployer).approve(await depositBoxERC721WithMetadata.getAddress(), tokenId2);
                // execution
                await depositBoxERC721WithMetadata
                    .connect(deployer)
                    .depositERC721Direct(schainName, contractHere, tokenId, to).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC721WithMetadata.connect(user).disableWhitelist(schainName);
                const data1 = await messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(contractHere, to, tokenId, "Hello10", { name: "ERC721OnChain", symbol: "ERC721" });
                const data2 = await messages.encodeTransferErc721MessageWithMetadata(contractHere, to, tokenId2, "Hello11");
                await depositBoxERC721WithMetadata
                    .connect(deployer)
                    .depositERC721Direct(schainName, contractHere, tokenId, to)
                    .should.emit(messageProxy, "OutgoingMessage")
                    .withArgs(schainHash, 0, await depositBoxERC721WithMetadata.getAddress(), deployer.address, data1);
                await depositBoxERC721WithMetadata
                    .connect(deployer)
                    .depositERC721Direct(schainName, contractHere, tokenId2, to)
                    .should.emit(messageProxy, "OutgoingMessage")
                    .withArgs(schainHash, 1, await depositBoxERC721WithMetadata.getAddress(), deployer.address, data2);
                // console.log("Gas for depositERC721:", res.receipt.gasUsed);
                // expectation
                expect(await erc721OnChain.ownerOf(tokenId)).to.equal(await depositBoxERC721WithMetadata.getAddress());
                expect(await erc721OnChain.ownerOf(tokenId2)).to.equal(await depositBoxERC721WithMetadata.getAddress());
            });

        });

        it("should get funds after kill", async () => {
            const tokenId = 10;
            const tokenId2 = 11;
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
            await erc721OnChain.connect(deployer).approve(await depositBoxERC721WithMetadata.getAddress(), tokenId);
            await depositBoxERC721WithMetadata.connect(user).disableWhitelist(schainName);
            await depositBoxERC721WithMetadata
                .connect(deployer)
                .depositERC721(schainName, await erc721OnChain.getAddress(), tokenId);
            await depositBoxERC721WithMetadata.connect(user).getFunds(schainName, await erc721OnChain.getAddress(), user.address, tokenId).should.be.eventually.rejectedWith("Schain is not killed");
            await linker.connect(deployer).kill(schainName);
            await linker.connect(user).kill(schainName);
            await depositBoxERC721WithMetadata.connect(user).getFunds(schainName, await erc721OnChain.getAddress(), user.address, tokenId2).should.be.eventually.rejectedWith("Incorrect tokenId");
            await depositBoxERC721WithMetadata.connect(user).getFunds(schainName, await erc721OnChain.getAddress(), user.address, tokenId);
            expect(await erc721OnChain.ownerOf(tokenId)).to.equal(user.address);
        });

        it("should add erc721 token by schain owner", async () => {
            const fakeERC721Contract = deployer.address;
            await depositBoxERC721WithMetadata.connect(user).addERC721TokenByOwner(schainName, fakeERC721Contract)
                .should.be.eventually.rejectedWith("Given address is not a contract");
            await depositBoxERC721WithMetadata.connect(deployer).addERC721TokenByOwner(schainName, await erc721.getAddress())
                .should.be.eventually.rejectedWith("Sender is not an Schain owner");

            await depositBoxERC721WithMetadata.connect(user).addERC721TokenByOwner(schainName, await erc721.getAddress());
            await depositBoxERC721WithMetadata.connect(user).addERC721TokenByOwner(schainName, await erc721.getAddress()).should.be.eventually.rejectedWith("ERC721 Token was already added");
            expect(await depositBoxERC721WithMetadata.getSchainToERC721(schainName, await erc721.getAddress())).to.be.equal(true);
            expect((await depositBoxERC721WithMetadata.getSchainToAllERC721(schainName, 0, 1))[0]).to.be.equal(await erc721.getAddress());
            expect((await depositBoxERC721WithMetadata.getSchainToAllERC721(schainName, 0, 1)).length).to.be.equal(1);
            expect((await depositBoxERC721WithMetadata.getSchainToAllERC721Length(schainName)).toString()).to.be.equal("1");
            await depositBoxERC721WithMetadata.getSchainToAllERC721(schainName, 1, 0).should.be.eventually.rejectedWith("Range is incorrect");
            await depositBoxERC721WithMetadata.getSchainToAllERC721(schainName, 0, 11).should.be.eventually.rejectedWith("Range is incorrect");
        });
    });

    describe("tests for `postMessage` function", async () => {
        let erc721: ERC721OnChain;
        let weiAmount: string;
        let sign: {
            blsSignature: [BigNumberish, BigNumberish],
            counter: number,
            hashA: string,
            hashB: string,
        };

        beforeEach(async () => {
            weiAmount = 1e18.toString();
            erc721 = await deployERC721OnChain("ERC721", "ERC721");

            sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            await setCommonPublicKey(contractManager, schainName);
            await depositBoxERC721WithMetadata.connect(user).disableWhitelist(schainName);

            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, user.address, { value: weiAmount });
        });

        it("should transfer ERC721 token", async () => {
            //  preparation
            const tokenId = 10;
            const tokenURI = "Hello10";
            const to = user.address;
            const senderFromSchain = deployer.address;

            const message = {
                data: await messages.encodeTransferErc721MessageWithMetadata(await erc721.getAddress(), to, tokenId, tokenURI),
                destinationContract: await depositBoxERC721WithMetadata.getAddress(),
                sender: senderFromSchain
            };

            await erc721.connect(deployer).mint(deployer.address, tokenId);
            await erc721.connect(deployer).setTokenURI(tokenId, tokenURI);
            await erc721.connect(deployer).transferFrom(deployer.address, await depositBoxERC721WithMetadata.getAddress(), tokenId);

            const balanceBefore = await getBalance(deployer.address);
            await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [message], sign);
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);

            (await erc721.ownerOf(tokenId)).should.be.equal(user.address);
            (await erc721.tokenURI(tokenId)).should.be.equal(tokenURI);
        });

        it("should revert `Given address is not a contract`", async () => {
            //  preparation
            const tokenId = 10;
            const tokenURI = "Hello10";
            const to = user.address;
            const senderFromSchain = deployer.address;

            const messageWithWrongTokenAddress = {
                data: await messages.encodeTransferErc721MessageWithMetadata(user2.address, to, tokenId, tokenURI),
                destinationContract: await depositBoxERC721WithMetadata.getAddress(),
                sender: senderFromSchain
            };

            await erc721.connect(deployer).mint(deployer.address, tokenId);
            await erc721.connect(deployer).setTokenURI(tokenId, tokenURI);
            await erc721.connect(deployer).transferFrom(deployer.address, await depositBoxERC721WithMetadata.getAddress(), tokenId);

            const tx = await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [messageWithWrongTokenAddress], sign);
            await expect(tx)
                .to.emit(messageProxy, "PostMessageError")
                .withArgs(BigInt(0), stringToHex("Given address is not a contract"));
        });

        it("should revert `Incorrect tokenId`", async () => {
            const tokenId = 10;
            const tokenURI = "Hello10";
            const to = user.address;
            const senderFromSchain = deployer.address;

            const messageWithWrongTokenAddress = {
                data: await messages.encodeTransferErc721MessageWithMetadata(await erc721.getAddress(), to, tokenId, tokenURI),
                destinationContract: await depositBoxERC721WithMetadata.getAddress(),
                sender: senderFromSchain
            };

            await erc721.connect(deployer).mint(deployer.address, tokenId);
            await erc721.connect(deployer).setTokenURI(tokenId, tokenURI);

            const tx = await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [messageWithWrongTokenAddress], sign);
            await expect(tx)
                .to.emit(messageProxy, "PostMessageError")
                .withArgs(BigInt(0), stringToHex("Incorrect tokenId"));
        });

        it("should transfer ERC721 token", async () => {
            //  preparation
            const tokenId = 10;
            const tokenURI = "Hello10";
            const to = user.address;
            const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
            const senderFromSchain = deployer.address;

            const message = {
                data: await messages.encodeTransferErc721MessageWithMetadata(await erc721.getAddress(), to, tokenId, tokenURI),
                destinationContract: await depositBoxERC721WithMetadata.getAddress(),
                sender: senderFromSchain
            };

            await erc721.mint(deployer.address, tokenId);
            await erc721.connect(deployer).setTokenURI(tokenId, tokenURI);
            await erc721.approve(await depositBoxERC721WithMetadata.getAddress(), tokenId);

            await depositBoxERC721WithMetadata
                .depositERC721(schainName, await erc721.getAddress(), tokenId);

            const balanceBefore = await getBalance(deployer.address);
            await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [message], sign);
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);
            expect(await depositBoxERC721WithMetadata.transferredAmount(await erc721.getAddress(), tokenId)).to.be.equal(zeroHash);

            (await erc721.ownerOf(tokenId)).should.be.equal(user.address);
            (await erc721.tokenURI(tokenId)).should.be.equal(tokenURI);
        });

    });
});
