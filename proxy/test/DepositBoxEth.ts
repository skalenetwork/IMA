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
    Linker,
    MessageProxyForMainnet,
    MessagesTester,
    ERC20OnChain,
    CommunityPool
} from "../typechain";
import { stringKeccak256, getBalance, getPublicKey } from "./utils/helper";

import chai = require("chai");
import chaiAlmost = require("chai-almost");

chai.should();
chai.use((chaiAsPromised as any));
chai.use(chaiAlmost(0.002));

import { deployDepositBoxEth } from "./utils/deploy/mainnet/depositBoxEth";
import { deployLinker } from "./utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { initializeSchain, addNodesToSchain } from "./utils/skale-manager-utils/schainsInternal";
import { rechargeSchainWallet } from "./utils/skale-manager-utils/wallets";
import { setCommonPublicKey } from "./utils/skale-manager-utils/keyStorage";
import { deployMessages } from "./utils/deploy/messages";
import { deployERC20OnChain } from "./utils/deploy/erc20OnChain";
import { deployCommunityPool } from "./utils/deploy/mainnet/communityPool";
import { deployFallbackEthTester } from "./utils/deploy/test/fallbackEthTester";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, ContractTransaction, Wallet } from "ethers";

import { assert, expect } from "chai";
import { createNode } from "./utils/skale-manager-utils/nodes";

const BlsSignature: [BigNumber, BigNumber] = [
    BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
    BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781")
];
const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
const Counter = 0;

const weiTolerance = ethers.utils.parseEther("0.002").toNumber();

async function reimbursed(transaction: ContractTransaction, operation?: string) {
    const receipt = await transaction.wait();
    const sender = transaction.from;
    const balanceBefore = await ethers.provider.getBalance(sender, receipt.blockNumber - 1);
    const balanceAfter = await ethers.provider.getBalance(sender, receipt.blockNumber);
    if (balanceAfter.lt(balanceBefore)) {
        const shortageEth = balanceBefore.sub(balanceAfter);
        const shortageGas = shortageEth.div(receipt.effectiveGasPrice);

        console.log("Reimbursement failed.")
        console.log(`${shortageGas.toString()} gas units was not reimbursed`);
        if (operation !== undefined) {
            console.log(`During ${operation}`);
        }

    }
    balanceAfter.should.be.least(balanceBefore);
    balanceAfter.should.be.closeTo(balanceBefore, weiTolerance);
}

describe("DepositBoxEth", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let user2: SignerWithAddress;
    let richGuy: SignerWithAddress;
    let nodeAddress: Wallet;

    let depositBoxEth: DepositBoxEth;
    let contractManager: ContractManager;
    let messageProxy: MessageProxyForMainnet;
    let linker: Linker;
    let communityPool: CommunityPool;
    let messages: MessagesTester;
    const contractManagerAddress = "0x0000000000000000000000000000000000000000";
    const schainName = "Schain";
    const schainHash = stringKeccak256(schainName);

    before(async () => {
        [deployer, user, user2, richGuy] = await ethers.getSigners();
        nodeAddress = Wallet.createRandom().connect(ethers.provider);
        const balanceRichGuy = await richGuy.getBalance();
        await richGuy.sendTransaction({to: nodeAddress.address, value: balanceRichGuy.sub(ethers.utils.parseEther("1"))});
    });

    after(async () => {
        const balanceNode = await nodeAddress.getBalance();
        await nodeAddress.sendTransaction({to: richGuy.address, value: balanceNode.sub(ethers.utils.parseEther("1"))});
    });

    beforeEach(async () => {
        contractManager = await deployContractManager(contractManagerAddress);
        messageProxy = await deployMessageProxyForMainnet(contractManager);
        linker = await deployLinker(contractManager, messageProxy);
        depositBoxEth = await deployDepositBoxEth(contractManager, linker, messageProxy);
        communityPool = await deployCommunityPool(contractManager, linker, messageProxy);
        messages = await deployMessages();
        await messageProxy.grantRole(await messageProxy.CHAIN_CONNECTOR_ROLE(), linker.address);
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
        await messageProxy.registerExtraContractForAll(depositBoxEth.address);
        await messageProxy.registerExtraContract(schainName, communityPool.address);
        await messageProxy.registerExtraContract(schainName, linker.address);
    });

    describe("tests for `deposit` function", async () => {

        it("should rejected with `Unconnected chain` when invoke `deposit`", async () => {
            // preparation
            const error = "Unconnected chain";
            // execution/expectation
            await depositBoxEth
                .connect(deployer)
                .deposit(schainName)
                .should.be.eventually.rejectedWith(error);
        });

        it("should rejected with `SKALE chain name cannot be Mainnet` when invoke `deposit`", async () => {
            // preparation
            const error = "SKALE chain name cannot be Mainnet";
            const newSchainName = "Mainnet";
            // execution/expectation
            await depositBoxEth
                .connect(deployer)
                .deposit(newSchainName)
                .should.be.eventually.rejectedWith(error);
        });

        it("should invoke `deposit` without mistakes", async () => {
            // preparation
            // the wei should be MORE than (55000 * 1000000000)
            // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
            // to avoid the `Not enough money` error
            const wei = "20000000000000000";
            // add schain to avoid the `Unconnected chain` error
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
            // execution
            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, { value: wei });

            const lockAndDataBalance = await ethers.provider.getBalance(depositBoxEth.address);
            // expectation
            expect(lockAndDataBalance).to.equal(wei);
        });

        it("should invoke `depositDirect` without mistakes", async () => {
            // preparation
            // the wei should be MORE than (55000 * 1000000000)
            // GAS_AMOUNT_POST_MESSAGE * AVERAGE_TX_PRICE constants in DepositBox.sol
            // to avoid the `Not enough money` error
            const wei = "20000000000000000";
            // add schain to avoid the `Unconnected chain` error
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);

            const data = await messages.encodeTransferEthMessage(user.address, wei);
            // execution
            await depositBoxEth
                .connect(deployer)
                .depositDirect(schainName, user.address, { value: wei })
                .should.emit(messageProxy, "OutgoingMessage")
                .withArgs(schainHash, 0, depositBoxEth.address, deployer.address, data);

            const lockAndDataBalance = await ethers.provider.getBalance(depositBoxEth.address);
            // expectation
            expect(lockAndDataBalance).to.equal(wei);
        });

        it("should revert `Not allowed. in DepositBox`", async () => {
            // preparation
            const error = "Use deposit function";
            // execution/expectation
            await deployer.connect(ethers.provider).sendTransaction({to: depositBoxEth.address, value: "1000000000000000000" })
                .should.be.eventually.rejectedWith(error);
        });

        it("should get funds after kill", async () => {
            const wei = "20000000000000000";
            const wei2 = "40000000000000000";
            await initializeSchain(contractManager, schainName, user2.address, 1, 1);
            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, { value: wei });
            await depositBoxEth.connect(user2).getFunds(schainName, user.address, wei).should.be.eventually.rejectedWith("Schain is not killed");
            await linker.connect(deployer).kill(schainName);
            await linker.connect(user2).kill(schainName);
            await depositBoxEth.connect(user2).getFunds(schainName, user.address, wei2).should.be.eventually.rejectedWith("Incorrect amount");
            await depositBoxEth.connect(user).getFunds(schainName, user.address, wei).should.be.eventually.rejectedWith("Sender is not an Schain owner");
            const userBalanceBefore = await ethers.provider.getBalance(user.address);
            await depositBoxEth.connect(user2).getFunds(schainName, user.address, wei);
            expect(BigNumber.from(await ethers.provider.getBalance(user.address)).toString()).to.equal(BigNumber.from(userBalanceBefore).add(BigNumber.from(wei)).toString());
        });
    });

    describe("tests for `postMessage` function", async () => {
        let erc20: ERC20OnChain;
        let erc20Clone: ERC20OnChain;

        beforeEach(async () => {
            erc20 = await deployERC20OnChain("D2-token", "D2",);
            erc20Clone = await deployERC20OnChain("Token", "T",);
        });

        it("should rejected with `Sender is not a MessageProxy`", async () => {
            //  preparation
            const error = "Sender is not a MessageProxy";
            const amount = "10";
            const bytesData = await messages.encodeTransferEthMessage(user.address, amount);
            const sender = deployer.address;
            // execution/expectation
            await depositBoxEth
                .connect(user)
                .postMessage(stringKeccak256(schainName), sender, bytesData)
                .should.be.eventually.rejectedWith(error);
        });

        it("should rejected with message `Receiver chain is incorrect` when schain is not registered in DepositBox", async () => {
            //  preparation
            const error = "Receiver chain is incorrect";
            // for `Receiver chain is incorrect` message schainName should be `Mainnet`
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
            await messageProxy.addConnectedChain(schainName);
            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            await communityPool.addSchainContract(schainName, deployer.address);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, user.address, { value: wei });
            // execution

            const res = await (await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [message], sign)).wait();
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
            + "`sender != DepositBoxEth.tokenManagerAddresses(schainHash)`", async () => {
                //  preparation
                const error = "Not enough money to finish this transaction";
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
                    .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
                await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
                await setCommonPublicKey(contractManager, schainName);
                await communityPool
                    .connect(user)
                    .rechargeUserWallet(schainName, user.address, { value: wei });
                // execution
                const res = await (await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [message], sign)).wait();

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
            const amountEth = "10";
            const wei = 1e18.toString();
            const bytesData = await messages.encodeTransferEthMessage(user.address, amountEth);
            const senderFromSchain = deployer.address;

            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            const chain = await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, user.address, { value: wei });

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
            const res = await (await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [message], sign)).wait();

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
            const amountEth = "10";
            // for `Invalid data` message bytesData should be `0x`
            const bytesData = "0x";
            const senderFromSchain = deployer.address;
            const wei = 1e18.toString();

            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);
            await setCommonPublicKey(contractManager, schainName);
            const chain = await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);
            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, user.address, { value: wei });

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
                .deposit(schainName, { value: wei });
            // execution
            const res = await (await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [message], sign)).wait();

            if (res.events) {
                assert.equal(res.events[0].event, "PostMessageError");
                assert.equal(res.events[0].args?.msgCounter.toString(), "0");
                assert.equal(res.events[0].args?.message, "0x");
            } else {
                assert(false, "No events were emitted");
            }
        });

        it("should transfer eth", async () => {

            const senderFromSchain = deployer.address;
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

            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);

            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);


            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, user.address, { value: wei });

            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, { value: wei });

            expect(BigNumber.from(await depositBoxEth.transferredAmount(schainHash)).toString()).to.be.equal(BigNumber.from(wei).toString());

            const balanceBefore = await getBalance(deployer.address);
            await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [message], sign);
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);

            await depositBoxEth.connect(user2).getMyEth()
                .should.be.eventually.rejectedWith("User has insufficient ETH");
            await depositBoxEth.connect(user).getMyEth();
        });

        it("should transfer eth actively", async () => {

            const senderFromSchain = deployer.address;
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

            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);

            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);

            await communityPool
                .connect(user)
                .rechargeUserWallet(schainName, user.address, { value: wei });

            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, { value: wei });

            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, { value: wei });

            expect(BigNumber.from(await depositBoxEth.transferredAmount(schainHash)).toString()).to.be.equal(BigNumber.from(wei).mul(2).toString());

            const balanceBefore = await getBalance(deployer.address);
            await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [message], sign);
            const balance = await getBalance(deployer.address);
            balance.should.not.be.lessThan(balanceBefore);
            balance.should.be.almost(balanceBefore);

            expect(BigNumber.from(await depositBoxEth.approveTransfers(user.address)).toString()).to.equal(BigNumber.from(wei).toString());

            await depositBoxEth.connect(user2).getMyEth()
                .should.be.eventually.rejectedWith("User has insufficient ETH");

            expect(BigNumber.from(await depositBoxEth.approveTransfers(user.address)).toString()).to.equal(BigNumber.from(wei).toString());

            expect(await depositBoxEth.activeEthTransfers(schainHash)).to.be.equal(false);
            await depositBoxEth.connect(user2).enableActiveEthTransfers(schainName).should.be.rejectedWith("Sender is not an Schain owner");
            await depositBoxEth.connect(user2).disableActiveEthTransfers(schainName).should.be.rejectedWith("Sender is not an Schain owner");
            await depositBoxEth.connect(deployer).disableActiveEthTransfers(schainName).should.be.eventually.rejectedWith("Active eth transfers disabled");
            await depositBoxEth.connect(deployer).enableActiveEthTransfers(schainName);
            await depositBoxEth.connect(deployer).enableActiveEthTransfers(schainName).should.be.eventually.rejectedWith("Active eth transfers enabled");
            expect(await depositBoxEth.activeEthTransfers(schainHash)).to.be.equal(true);

            const userBalanceBefore = await ethers.provider.getBalance(user.address);

            await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 1, [message], sign);
            expect(BigNumber.from(await ethers.provider.getBalance(user.address)).toString()).to.equal(BigNumber.from(userBalanceBefore).add(BigNumber.from(wei)).toString());

            expect(BigNumber.from(await depositBoxEth.approveTransfers(user.address)).toString()).to.equal(BigNumber.from(wei).toString());
            await depositBoxEth.connect(user).getMyEth();
            expect(BigNumber.from(await depositBoxEth.approveTransfers(user.address)).toString()).to.equal(BigNumber.from(0).toString());
            await depositBoxEth.connect(user).getMyEth()
                .should.be.eventually.rejectedWith("User has insufficient ETH");
        });

        it("should transfer eth fallback attack", async () => {

            const senderFromSchain = deployer.address;
            const wei = "30000000000000000";

            const fallbackEthTester = await deployFallbackEthTester(depositBoxEth, communityPool, schainName);
            const bytesData = await messages.encodeTransferEthMessage(fallbackEthTester.address, wei);

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

            await initializeSchain(contractManager, schainName, deployer.address, 1, 1);

            await linker
                .connect(deployer)
                .connectSchain(schainName, [deployer.address, deployer.address, deployer.address]);

            await fallbackEthTester
                .connect(user)
                .rechargeUserWallet({ value: wei });

            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, { value: wei });

            await depositBoxEth
                .connect(deployer)
                .deposit(schainName, { value: wei });

            expect(BigNumber.from(await depositBoxEth.transferredAmount(schainHash)).toString()).to.be.equal(BigNumber.from(wei).mul(2).toString());

            await reimbursed(await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 0, [message], sign));

            expect(BigNumber.from(await depositBoxEth.approveTransfers(fallbackEthTester.address)).toString()).to.equal(BigNumber.from(wei).toString());

            await depositBoxEth.connect(user2).getMyEth()
                .should.be.eventually.rejectedWith("User has insufficient ETH");

            expect(BigNumber.from(await depositBoxEth.approveTransfers(fallbackEthTester.address)).toString()).to.equal(BigNumber.from(wei).toString());

            expect(await depositBoxEth.activeEthTransfers(schainHash)).to.be.equal(false);
            await depositBoxEth.connect(user2).enableActiveEthTransfers(schainName).should.be.rejectedWith("Sender is not an Schain owner");
            await depositBoxEth.connect(user2).disableActiveEthTransfers(schainName).should.be.rejectedWith("Sender is not an Schain owner");
            await depositBoxEth.connect(deployer).disableActiveEthTransfers(schainName).should.be.eventually.rejectedWith("Active eth transfers disabled");
            await depositBoxEth.connect(deployer).enableActiveEthTransfers(schainName);
            await depositBoxEth.connect(deployer).enableActiveEthTransfers(schainName).should.be.eventually.rejectedWith("Active eth transfers enabled");
            expect(await depositBoxEth.activeEthTransfers(schainHash)).to.be.equal(true);

            const userBalanceBefore = await ethers.provider.getBalance(fallbackEthTester.address);

            const res = await (await messageProxy.connect(nodeAddress).postIncomingMessages(schainName, 1, [message], sign)).wait();

            if (res.events) {
                assert.equal(res.events[0].event, "PostMessageError");
                assert.equal(res.events[0].args?.msgCounter.toString(), "1");
                const messageError = res.events[0].args?.message.toString();
                const error = "Address: unable to send value, recipient may have reverted";
                assert.equal(Buffer.from(messageError.slice(2), 'hex').toString(), error);
            } else {
                assert(false, "No events were emitted");
            }

            expect(BigNumber.from(await depositBoxEth.approveTransfers(fallbackEthTester.address)).toString()).to.equal(BigNumber.from(wei).toString());
            await fallbackEthTester.connect(user).getMyEth();
            expect(BigNumber.from(await depositBoxEth.approveTransfers(fallbackEthTester.address)).toString()).to.equal(BigNumber.from(0).toString());
            await fallbackEthTester.connect(user).getMyEth()
                .should.be.eventually.rejectedWith("User has insufficient ETH");
        });
    });
});
