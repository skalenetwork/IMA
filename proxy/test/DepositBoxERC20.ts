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
    DepositBoxERC20,
    ERC721OnChain,
    ERC1155OnChain,
    Linker,
    MessageProxyForMainnet,
    MessagesTester,
    ERC20OnChain,
    CommunityPool
} from "../typechain";
import { randomString, stringFromHex, stringValue } from "./utils/helper";

import chai = require("chai");
import chaiAlmost = require("chai-almost");

chai.should();
chai.use((chaiAsPromised as any));
chai.use(chaiAlmost(0.002));

import { deployDepositBoxERC20 } from "./utils/deploy/mainnet/depositBoxERC20";
import { deployLinker } from "./utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { initializeSchain } from "./utils/skale-manager-utils/schainsInternal";
import { rechargeSchainWallet } from "./utils/skale-manager-utils/wallets";
import { setCommonPublicKey } from "./utils/skale-manager-utils/keyStorage";
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
describe("DepositBoxERC20", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let user2: SignerWithAddress;

    let depositBoxERC20: DepositBoxERC20;
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
        depositBoxERC20 = await deployDepositBoxERC20(contractManager, linker, messageProxy);
        communityPool = await deployCommunityPool(contractManager, linker, messageProxy);
        await messageProxy.grantRole(await messageProxy.CHAIN_CONNECTOR_ROLE(), linker.address);
        await messageProxy.grantRole(await messageProxy.EXTRA_CONTRACT_REGISTRAR_ROLE(), deployer.address);
        await initializeSchain(contractManager, schainName, user.address, 1, 1);
        await rechargeSchainWallet(contractManager, schainName, user2.address, "1000000000000000000");
        await messageProxy.registerExtraContractForAll(depositBoxERC20.address);
        await messageProxy.registerExtraContract(schainName, communityPool.address);
        await messageProxy.registerExtraContract(schainName, linker.address);
    });

    describe("tests with `ERC20`", async () => {
        let erc20: ERC20OnChain;

        beforeEach(async () => {
            erc20 = await deployERC20OnChain("D2-token", "D2");
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
        });

        describe("tests for `depositERC20` function", async () => {

            it("should rejected with `Whitelist is enabled`", async () => {
                // preparation
                const error = "Whitelist is enabled";
                await depositBoxERC20.connect(user).enableWhitelist(schainName);
                await erc20.connect(deployer).mint(user.address, "1000000000");
                await erc20.connect(deployer).approve(depositBoxERC20.address, "1000000");
                // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
                // execution/expectation
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20.address, 100)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should rejected with `DepositBox was not approved for ERC20 token`", async () => {
                // preparation
                const error = "DepositBox was not approved for ERC20 token";
                // await erc20.connect(deployer).mint(user.address, "1000000000");
                await depositBoxERC20.connect(user).disableWhitelist(schainName);
                // set `DepositBox` contract to avoid the `Not allowed` error in LockAndDataForMainnet.sol
                // execution/expectation
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20.address, 100)
                    .should.be.eventually.rejectedWith(error);
            });

            it("should invoke `depositERC20` without mistakes", async () => {
                // preparation
                // mint some quantity of ERC20 tokens for `deployer` address
                const amount = 10;
                await erc20.connect(deployer).mint(deployer.address, amount);
                await erc20.connect(deployer).approve(depositBoxERC20.address, amount);
                // execution
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20.address, 1).should.be.eventually.rejectedWith("Whitelist is enabled");
                await depositBoxERC20.connect(user).disableWhitelist(schainName);
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20.address, 1);
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20.address, 1);
                // console.log("Gas for depositERC20:", res.receipt.gasUsed);
            });

            it("should rejected with `Amount is incorrect`", async () => {
                // preparation
                // mint some quantity of ERC20 tokens for `deployer` address
                const amount = 10;
                await erc20.connect(deployer).mint(deployer.address, amount);
                await erc20.connect(deployer).approve(depositBoxERC20.address, amount + 1);

                await depositBoxERC20.connect(user).disableWhitelist(schainName);
                await depositBoxERC20
                    .connect(deployer)
                    .depositERC20(schainName, erc20.address, amount + 1)
                    .should.be.eventually.rejectedWith("Amount is incorrect");
            });
        });

        it("should get funds after kill", async () => {
            await erc20.connect(deployer).mint(deployer.address, "1000000000");
            await erc20.connect(deployer).approve(depositBoxERC20.address, "1000000");
            await depositBoxERC20.connect(user).disableWhitelist(schainName);
            await depositBoxERC20
                .connect(deployer)
                .depositERC20(schainName, erc20.address, 1);
            await depositBoxERC20.connect(user).getFunds(schainName, erc20.address, user.address, 1).should.be.eventually.rejectedWith("Schain is not killed");
            await linker.connect(deployer).kill(schainName);
            await linker.connect(user).kill(schainName);
            await depositBoxERC20.connect(user).getFunds(schainName, erc20.address, user.address, 2).should.be.eventually.rejectedWith("Incorrect amount");
            await depositBoxERC20.connect(user).getFunds(schainName, erc20.address, user.address, 1);
            expect(BigNumber.from(await erc20.balanceOf(user.address)).toString()).to.equal("1");
        });

        it("should add erc token by schain owner", async () => {
            const fakeERC20Contract = deployer.address;
            await depositBoxERC20.connect(user).addERC20TokenByOwner(schainName, fakeERC20Contract)
                .should.be.eventually.rejectedWith("Given address is not a contract");
            await depositBoxERC20.connect(user).addERC20TokenByOwner(schainName, erc20.address);
            await depositBoxERC20.connect(user).addERC20TokenByOwner(schainName, erc20.address).should.be.eventually.rejectedWith("ERC20 Token was already added");
            expect(await depositBoxERC20.getSchainToERC20(schainName, erc20.address)).to.be.equal(true);
            expect((await depositBoxERC20.getSchainToAllERC20(schainName, 0, 1))[0]).to.be.equal(erc20.address);
            expect((await depositBoxERC20.getSchainToAllERC20(schainName, 0, 1)).length).to.be.equal(1);
            expect((await depositBoxERC20.getSchainToAllERC20Length(schainName)).toString()).to.be.equal("1");
            await depositBoxERC20.getSchainToAllERC20(schainName, 1, 0).should.be.eventually.rejectedWith("Range is incorrect");
            await depositBoxERC20.getSchainToAllERC20(schainName, 0, 11).should.be.eventually.rejectedWith("Range is incorrect");
        });

        it("should not allow to add token by schain owner if schain killed", async () => {
            await linker.connect(deployer).kill(schainName);
            await linker.connect(user).kill(schainName);
            await depositBoxERC20.connect(user).addERC20TokenByOwner(schainName, erc20.address)
                .should.be.eventually.rejectedWith("Schain is killed");
        });
    });

    describe("tests for `postMessage` function", async () => {
        // let eRC20ModuleForMainnet: ERC20ModuleForMainnetInstance;
        // let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
        let erc20: ERC20OnChain;
        let erc20Clone: ERC20OnChain;
        // let eRC721ModuleForMainnet: ERC721ModuleForMainnet;
        // let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721;
        let eRC721OnChain: ERC721OnChain;
        let eRC1155OnChain: ERC1155OnChain;
        let messages: MessagesTester;

        beforeEach(async () => {
            // eRC20ModuleForMainnet = await deployERC20ModuleForMainnet(lockAndDataForMainnet);
            // lockAndDataForMainnetERC20 = await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
            erc20 = await deployERC20OnChain("D2-token", "D2",);
            erc20Clone = await deployERC20OnChain("Token", "T",);
            // eRC721ModuleForMainnet = await deployERC721ModuleForMainnet(lockAndDataForMainnet);
            // lockAndDataForMainnetERC721 = await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
            eRC721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721");
            eRC1155OnChain = await deployERC1155OnChain("New ERC1155 Token");
            messages = await deployMessages();
        });

        it("should transfer ERC20 token", async () => {
            //  preparation
            const ercOnSchain = erc20.address;
            const fakeErc20OnSchain = erc20Clone.address;
            const schainHash = stringValue(web3.utils.soliditySha3(schainName));
            const amount = 10;
            const to = user.address;
            const senderFromSchain = deployer.address;
            const wei = 1e18.toString();

            const sign = {
                blsSignature: BlsSignature,
                counter: Counter,
                hashA: HashA,
                hashB: HashB,
            };

            const message = {
                data: await messages.encodeTransferErc20Message(ercOnSchain, to, amount),
                destinationContract: depositBoxERC20.address,
                sender: senderFromSchain
            };
            const messageWithWrongTokenAddress = {
                data: await messages.encodeTransferErc20Message(user2.address, to, amount),
                destinationContract: depositBoxERC20.address,
                sender: senderFromSchain
            };

            const messageWithNotMintedToken = {
                data: await messages.encodeTransferErc20Message(fakeErc20OnSchain, to, amount),
                destinationContract: depositBoxERC20.address,
                sender: senderFromSchain
            };

            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20.address, amount)
                .should.be.eventually.rejectedWith("Unconnected chain");

            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);

            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, user.address, { value: wei });

            await depositBoxERC20.disableWhitelist(schainName);
            await erc20.connect(deployer).mint(user.address, amount * 2);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20.address, amount)
                .should.be.eventually.rejectedWith("DepositBox was not approved for ERC20 token");
            await erc20.connect(user).approve(depositBoxERC20.address, amount * 2);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20.address, amount);

            const res = await (await messageProxy.connect(deployer).postIncomingMessages(schainName, 0, [messageWithWrongTokenAddress, messageWithNotMintedToken], sign)).wait();
            if (res.events) {
                assert.equal(res.events[0].event, "PostMessageError");
                assert.equal(stringFromHex(res.events[0].args?.message), "Given address is not a contract");
                assert.equal(res.events[1].event, "PostMessageError");
                assert.equal(stringFromHex(res.events[1].args?.message), "Not enough money");
            } else {
                assert(false, "No events were emitted");
            }

            const balanceBefore = await getBalance(deployer.address);
            await messageProxy.connect(deployer).postIncomingMessages(schainName, 2, [message], sign);
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);

            await depositBoxERC20.connect(user).depositERC20(schainName, erc20.address, amount);
            await messageProxy.connect(deployer).postIncomingMessages(schainName, 3, [message], sign);
            expect(BigNumber.from(await depositBoxERC20.transferredAmount(schainHash, erc20.address)).toString()).to.be.equal(BigNumber.from(0).toString());

            (await erc20.balanceOf(user.address)).toString().should.be.equal((amount * 2).toString());

        });
    });
});