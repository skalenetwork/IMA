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
    DepositBoxERC721,
    ERC721OnChain,
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

import { deployDepositBoxERC721 } from "./utils/deploy/mainnet/depositBoxERC721";
import { deployLinker } from "./utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { initializeSchain } from "./utils/skale-manager-utils/schainsInternal";
import { rechargeSchainWallet } from "./utils/skale-manager-utils/wallets";
import { setCommonPublicKey } from "./utils/skale-manager-utils/keyStorage";
import { deployMessages } from "./utils/deploy/messages";
import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";
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
describe("DepositBoxERC721", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let user2: SignerWithAddress;

    let depositBoxERC721: DepositBoxERC721;
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
        depositBoxERC721 = await deployDepositBoxERC721(contractManager, linker, messageProxy);
        communityPool = await deployCommunityPool(contractManager, linker, messageProxy);
        await messageProxy.grantRole(await messageProxy.CHAIN_CONNECTOR_ROLE(), linker.address);
        await messageProxy.grantRole(await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE(), deployer.address);
        await initializeSchain(contractManager, schainName, user.address, 1, 1);
        await rechargeSchainWallet(contractManager, schainName, user2.address, "1000000000000000000");
        await messageProxy.registerExtraContractForAll(depositBoxERC721.address);
        await messageProxy.registerExtraContract(schainName, communityPool.address);
        await messageProxy.registerExtraContract(schainName, linker.address);
    });

    describe("tests with `ERC721`", async () => {
        let erc721: ERC721OnChain;
        let erc721OnChain: ERC721OnChain;

        beforeEach(async () => {
            erc721 = await deployERC721OnChain("ERC721OnChain", "ERC721");
            erc721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721");

            // mint some ERC721 of  for `deployer` address
            const tokenId = 10;
            await erc721OnChain.connect(deployer).mint(deployer.address, tokenId);
            const tokenId2 = 11;
            await erc721OnChain.connect(deployer).mint(deployer.address, tokenId2);

        });

        describe("tests for `depositERC721` function", async () => {

            it("should rejected with `Unconnected chain`", async () => {
                //  preparation
                const amount = 10;

                await depositBoxERC721.connect(user).depositERC721(schainName, erc721.address, amount)
                    .should.be.eventually.rejectedWith("Unconnected chain");
            });

            it("should rejected with `DepositBox was not approved for ERC721 token`", async () => {
                // preparation
                const error = "DepositBox was not approved for ERC721 token";
                const contractHere = erc721OnChain.address;
                const to = user.address;
                const tokenId = 10;
                // the wei should be MORE than (55000 * 1000000000)
                // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
                const wei = "20000000000000000";
                // add schain to avoid the `Unconnected chain` error
                await linker
                    .connect(deployer)
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);

                // execution/expectation
                await depositBoxERC721
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, tokenId)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should invoke `depositERC721` without mistakes", async () => {
                // preparation
                const contractHere = erc721OnChain.address;
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
                await erc721OnChain.connect(deployer).approve(depositBoxERC721.address, tokenId);
                await erc721OnChain.connect(deployer).approve(depositBoxERC721.address, tokenId2);
                // execution
                await depositBoxERC721
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, tokenId).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC721.connect(user).disableWhitelist(schainName);
                await depositBoxERC721
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, tokenId);
                await (await depositBoxERC721
                    .connect(deployer)
                    .depositERC721(schainName, contractHere, tokenId2)).wait();
                // console.log("Gas for depositERC721:", res.receipt.gasUsed);
                // expectation
                expect(await erc721OnChain.ownerOf(tokenId)).to.equal(depositBoxERC721.address);
                expect(await erc721OnChain.ownerOf(tokenId2)).to.equal(depositBoxERC721.address);
            });

        });

        it("should get funds after kill", async () => {
            const tokenId = 10;
            const tokenId2 = 11;
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
            await erc721OnChain.connect(deployer).approve(depositBoxERC721.address, tokenId);
            await depositBoxERC721.connect(user).disableWhitelist(schainName);
            await depositBoxERC721
                .connect(deployer)
                .depositERC721(schainName, erc721OnChain.address, tokenId);
            await depositBoxERC721.connect(user).getFunds(schainName, erc721OnChain.address, user.address, tokenId).should.be.eventually.rejectedWith("Schain is not killed");
            await linker.connect(deployer).kill(schainName);
            await linker.connect(user).kill(schainName);
            await depositBoxERC721.connect(user).getFunds(schainName, erc721OnChain.address, user.address, tokenId2).should.be.eventually.rejectedWith("Incorrect tokenId");
            await depositBoxERC721.connect(user).getFunds(schainName, erc721OnChain.address, user.address, tokenId);
            expect(await erc721OnChain.ownerOf(tokenId)).to.equal(user.address);
        });

        it("should add erc721 token by schain owner", async () => {
            const fakeERC721Contract = deployer.address;
            await depositBoxERC721.connect(user).addERC721TokenByOwner(schainName, fakeERC721Contract)
                .should.be.eventually.rejectedWith("Given address is not a contract");
            await depositBoxERC721.connect(deployer).addERC721TokenByOwner(schainName, erc721.address)
                .should.be.eventually.rejectedWith("Sender is not an Schain owner");

            await depositBoxERC721.connect(user).addERC721TokenByOwner(schainName, erc721.address);
            await depositBoxERC721.connect(user).addERC721TokenByOwner(schainName, erc721.address).should.be.eventually.rejectedWith("ERC721 Token was already added");
            expect(await depositBoxERC721.getSchainToERC721(schainName, erc721.address)).to.be.equal(true);
            expect((await depositBoxERC721.getSchainToAllERC721(schainName, 0, 1))[0]).to.be.equal(erc721.address);
            expect((await depositBoxERC721.getSchainToAllERC721(schainName, 0, 1)).length).to.be.equal(1);
            expect((await depositBoxERC721.getSchainToAllERC721Length(schainName)).toString()).to.be.equal("1");
            await depositBoxERC721.getSchainToAllERC721(schainName, 1, 0).should.be.eventually.rejectedWith("Range is incorrect");
            await depositBoxERC721.getSchainToAllERC721(schainName, 0, 11).should.be.eventually.rejectedWith("Range is incorrect");
        });
    });

    describe("tests for `postMessage` function", async () => {
        let erc721: ERC721OnChain;
        let erc721OnChain: ERC721OnChain;
        let messages: MessagesTester;
        let weiAmount: string;
        let sign: {
            blsSignature: [BigNumber, BigNumber],
            counter: number,
            hashA: string,
            hashB: string,
        };

        beforeEach(async () => {
            weiAmount = 1e18.toString();
            erc721 = await deployERC721OnChain("ERC721", "ERC721");
            erc721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721OnChain");
            messages = await deployMessages();

            sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            await setCommonPublicKey(contractManager, schainName);
            await depositBoxERC721.connect(user).disableWhitelist(schainName);

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
            const to = user.address;
            const to0 = "0x0000000000000000000000000000000000000000";
            const senderFromSchain = deployer.address;



            const message = {
                data: await messages.encodeTransferErc721Message(erc721.address, to, tokenId),
                destinationContract: depositBoxERC721.address,
                sender: senderFromSchain
            };

            await erc721.connect(deployer).mint(deployer.address, tokenId);
            await erc721.connect(deployer).transferFrom(deployer.address, depositBoxERC721.address, tokenId);

            const balanceBefore = await getBalance(deployer.address);
            await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign);
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);

            (await erc721.ownerOf(tokenId)).should.be.equal(user.address);
        });

        it("should revert `Given address is not a contract`", async () => {
            //  preparation
            const tokenId = 10;
            const to = user.address;
            const senderFromSchain = deployer.address;

            const messageWithWrongTokenAddress = {
                data: await messages.encodeTransferErc721Message(user2.address, to, tokenId),
                destinationContract: depositBoxERC721.address,
                sender: senderFromSchain
            };

            await erc721.connect(deployer).mint(deployer.address, tokenId);
            await erc721.connect(deployer).transferFrom(deployer.address, depositBoxERC721.address, tokenId);

            const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [messageWithWrongTokenAddress], sign)).wait();
            if (res.events) {
                assert.equal(res.events[0].event, "PostMessageError");
                assert.equal(stringFromHex(res.events[0].args?.message), "Given address is not a contract");
            } else {
                assert(false, "No events were emitted");
            }
        });

        it("should revert `Incorrect tokenId`", async () => {
            const tokenId = 10;
            const to = user.address;
            const senderFromSchain = deployer.address;

            const messageWithWrongTokenAddress = {
                data: await messages.encodeTransferErc721Message(erc721.address, to, tokenId),
                destinationContract: depositBoxERC721.address,
                sender: senderFromSchain
            };

            await erc721.connect(deployer).mint(deployer.address, tokenId);

            const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [messageWithWrongTokenAddress], sign)).wait();
            if (res.events) {
                assert.equal(res.events[0].event, "PostMessageError");
                assert.equal(stringFromHex(res.events[0].args?.message), "Incorrect tokenId");
            } else {
                assert(false, "No events were emitted");
            }
        });

        it("should transfer ERC721 token", async () => {
            //  preparation
            const tokenId = 10;
            const to = user.address;
            const schainHash = stringValue(web3.utils.soliditySha3(schainName));
            const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
            const senderFromSchain = deployer.address;

            const message = {
                data: await messages.encodeTransferErc721Message(erc721.address, to, tokenId),
                destinationContract: depositBoxERC721.address,
                sender: senderFromSchain
            };

            await erc721.mint(deployer.address, tokenId);
            await erc721.approve(depositBoxERC721.address, tokenId);

            await depositBoxERC721
                .depositERC721(schainName, erc721.address, tokenId);

            const balanceBefore = await getBalance(deployer.address);
            await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [message], sign);
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);
            expect(await depositBoxERC721.transferredAmount(erc721.address, tokenId)).to.be.equal(zeroHash);

            (await erc721.ownerOf(tokenId)).should.be.equal(user.address);
        });

    });
});