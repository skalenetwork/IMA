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
 * @file calculateGas.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";
import {
    ContractManagerContract,
    ContractManagerInstance,
    DepositBoxEthInstance,
    // ERC20ModuleForMainnetInstance,
    ERC20ModuleForSchainContract,
    ERC20ModuleForSchainInstance,
    // ERC721ModuleForMainnetInstance,
    ERC721ModuleForSchainContract,
    ERC721ModuleForSchainInstance,
    ERC20OnChainContract,
    ERC20OnChainInstance,
    ERC721OnChainContract,
    ERC721OnChainInstance,
    EthERC20Contract,
    EthERC20Instance,
    KeyStorageContract,
    KeyStorageInstance,
    // LockAndDataForMainnetERC20Instance,
    // LockAndDataForMainnetERC721Instance,
    // LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC20Contract,
    LockAndDataForSchainERC20Instance,
    LockAndDataForSchainERC721Contract,
    LockAndDataForSchainERC721Instance,
    LockAndDataForSchainInstance,
    MessageProxyForMainnetInstance,
    MessageProxyForSchainContract,
    MessageProxyForSchainInstance,
    MessagesTesterContract,
    MessagesTesterInstance,
    NodesContract,
    NodesInstance,
    SchainsContract,
    SchainsInstance,
    SchainsInternalContract,
    SchainsInternalInstance,
    SkaleVerifierContract,
    SkaleVerifierInstance,
    TokenFactoryContract,
    TokenFactoryInstance,
    TokenManagerContract,
    TokenManagerInstance,
    WalletsContract,
    WalletsInstance,
} from "../types/truffle-contracts";
import { randomString } from "../test/utils/helper";

import chai = require("chai");

chai.should();
chai.use((chaiAsPromised as any));

// import { deployLockAndDataForMainnet } from "../test/utils/deploy/imaLinker";
// import { deployLockAndDataForMainnetERC20 } from "../test/utils/deploy/lockAndDataForMainnetERC20";
// import { deployLockAndDataForMainnetERC721 } from "../test/utils/deploy/contractManager";
// import { deployDepositBox } from "../test/utils/deploy/depositBoxEth";
// import { deployERC20ModuleForMainnet } from "../test/utils/deploy/depositBoxERC20";
// import { deployERC721ModuleForMainnet } from "../test/utils/deploy/depositBoxERC721";
import { deployMessageProxyForMainnet } from "../test/utils/deploy/messageProxyForMainnet";

const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");
const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");

const ContractManager: ContractManagerContract = artifacts.require("./ContractManager");
const KeyStorage: KeyStorageContract = artifacts.require("./KeyStorage");
const Nodes: NodesContract = artifacts.require("./Nodes");
const Schains: SchainsContract = artifacts.require("./Schains");
const SchainsInternal: SchainsInternalContract = artifacts.require("./SchainsInternal");
const SkaleVerifier: SkaleVerifierContract = artifacts.require("./SkaleVerifier");
const Wallets: WalletsContract = artifacts.require("./Wallets");

const TokenManager: TokenManagerContract = artifacts.require("./TokenManager");
const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForSchainERC20: LockAndDataForSchainERC20Contract = artifacts.require("./LockAndDataForSchainERC20");
const ERC20ModuleForSchain: ERC20ModuleForSchainContract = artifacts.require("./ERC20ModuleForSchain");
const ERC721ModuleForSchain: ERC721ModuleForSchainContract = artifacts.require("./ERC721ModuleForSchain");
const LockAndDataForSchainERC721: LockAndDataForSchainERC721Contract = artifacts.require("./LockAndDataForSchainERC721");
const TokenFactory: TokenFactoryContract = artifacts.require("./TokenFactory");
const MessagesTester: MessagesTesterContract = artifacts.require("./MessagesTester");

// contract("Gas calculation", ([deployer, schainOwner, user]) => {
//     let lockAndDataForMainnet: LockAndDataForMainnetInstance;
//     let lockAndDataForMainnetERC20: LockAndDataForMainnetERC20Instance;
//     let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721Instance;
//     let erc20ModuleForMainnet: ERC20ModuleForMainnetInstance;
//     let erc721ModuleForMainnet: ERC721ModuleForMainnetInstance;
//     let depositBox: DepositBoxInstance;
//     let messageProxyForMainnet: MessageProxyForMainnetInstance;

//     let contractManager: ContractManagerInstance;
//     let keyStorage: KeyStorageInstance;
//     let nodes: NodesInstance;
//     let schains: SchainsInstance;
//     let schainsInternal: SchainsInternalInstance;
//     let skaleVerifier: SkaleVerifierInstance;
//     let wallets: WalletsInstance;

//     let lockAndDataForSchain: LockAndDataForSchainInstance;
//     let lockAndDataForSchainERC20: LockAndDataForSchainERC20Instance;
//     let lockAndDataForSchainERC721: LockAndDataForSchainERC721Instance;
//     let erc20ModuleForSchain: ERC20ModuleForSchainInstance;
//     let erc721ModuleForSchain: ERC721ModuleForSchainInstance;
//     let tokenManager: TokenManagerInstance;
//     let tokenFactory: TokenFactoryInstance;
//     let ethERC20: EthERC20Instance;
//     let messageProxyForSchain: MessageProxyForSchainInstance;
//     let messages: MessagesTesterInstance;

//     let ERC20TokenOnMainnet: ERC20OnChainInstance;
//     let ERC20TokenOnSchain: ERC20OnChainInstance;
//     let ERC721TokenOnMainnet: ERC721OnChainInstance;
//     let ERC721TokenOnSchain: ERC721OnChainInstance;

//     const schainName = "GasCalculation";
//     const schainNameHash = web3.utils.soliditySha3("GasCalculation");

//     beforeEach(async () => {
//         // skale-manager mock preparation
//         contractManager = await ContractManager.new({from: deployer});
//         keyStorage = await KeyStorage.new({from: deployer});
//         nodes = await Nodes.new({from: deployer});
//         schains = await Schains.new({from: deployer});
//         schainsInternal = await SchainsInternal.new({from: deployer});
//         skaleVerifier = await SkaleVerifier.new({from: deployer});
//         wallets = await Wallets.new({from: deployer});
//         await contractManager.setContractsAddress("KeyStorage", keyStorage.address, {from: deployer});
//         await contractManager.setContractsAddress("Nodes", nodes.address, {from: deployer});
//         await contractManager.setContractsAddress("Schains", schains.address, {from: deployer});
//         await contractManager.setContractsAddress("SchainsInternal", schainsInternal.address, {from: deployer});
//         await contractManager.setContractsAddress("SkaleVerifier", skaleVerifier.address, {from: deployer});
//         await contractManager.setContractsAddress("Wallets", wallets.address, {from: deployer});

//         // add ContractManager to contracts
//         await schains.addContractManager(contractManager.address, {from: deployer});
//         await schainsInternal.addContractManager(contractManager.address, {from: deployer});
//         await wallets.addContractManager(contractManager.address, {from: deployer});

//         // setup 16 nodes
//         const nodeCreationParams = {
//             name: "GasCalculationNode",
//             ip: "0x12345678",
//             publicIp: "0x12345678",
//             port: 1337,
//             publicKey:
//             [
//                 "0x1234567890123456789012345678901234567890123456789012345678901234",
//                 "0x1234567890123456789012345678901234567890123456789012345678901234"
//             ],
//             nonce: 1337,
//             domainName: "gascalculationnode.com"
//         };
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});
//         await nodes.createNode(deployer, nodeCreationParams, {from: deployer});

//         // initialize schain and data
//         await schainsInternal.initializeSchain(schainName, deployer, 12345678, 12345678, {from: deployer});
//         await schainsInternal.addNodesToSchainsGroups(schainNameHash, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], {from: deployer});

//         // set BLS Public Key to schain
//         // P.s. this is test public key from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BLSPublicKey = {
//             x: {
//                 a: "8276253263131369565695687329790911140957927205765534740198480597854608202714",
//                 b: "12500085126843048684532885473768850586094133366876833840698567603558300429943",
//             },
//             y: {
//                 a: "7025653765868604607777943964159633546920168690664518432704587317074821855333",
//                 b: "14411459380456065006136894392078433460802915485975038137226267466736619639091",
//             }
//         }
//         await keyStorage.setCommonPublicKey(schainNameHash, BLSPublicKey, {from: deployer});

//         // IMA mainnet part deployment
//         lockAndDataForMainnet = await deployLockAndDataForMainnet();
//         lockAndDataForMainnetERC20 = await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
//         lockAndDataForMainnetERC721 = await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
//         erc20ModuleForMainnet = await deployERC20ModuleForMainnet(lockAndDataForMainnet);
//         erc721ModuleForMainnet = await deployERC721ModuleForMainnet(lockAndDataForMainnet);
//         depositBox = await deployDepositBox(lockAndDataForMainnet);
//         messageProxyForMainnet = await deployMessageProxyForMainnet(lockAndDataForMainnet);
//         messages = await MessagesTester.new();

//         // register contract manager for skale manager in lock and data
//         await lockAndDataForMainnet.setContract("ContractManagerForSkaleManager", contractManager.address, {from: deployer});

//         // IMA schain part deployment
//         lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer});
//         lockAndDataForSchainERC20 = await LockAndDataForSchainERC20.new(lockAndDataForSchain.address, {from: deployer});
//         lockAndDataForSchainERC721 = await LockAndDataForSchainERC721.new(lockAndDataForSchain.address, {from: deployer});
//         erc20ModuleForSchain = await ERC20ModuleForSchain.new(lockAndDataForSchain.address, {from: deployer});
//         erc721ModuleForSchain = await ERC721ModuleForSchain.new(lockAndDataForSchain.address, {from: deployer});
//         tokenManager = await TokenManager.new(schainName, lockAndDataForSchain.address, {from: deployer});
//         messageProxyForSchain = await MessageProxyForSchain.new(schainName, {from: deployer});
//         tokenFactory = await TokenFactory.new(lockAndDataForSchain.address, {from: deployer});
//         ethERC20 = await EthERC20.new({from: deployer});

//         // IMA schain part registration
//         await lockAndDataForSchain.setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
//         await lockAndDataForSchain.setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
//         await lockAndDataForSchain.setContract("ERC20Module", erc20ModuleForSchain.address, {from: deployer});
//         await lockAndDataForSchain.setContract("ERC721Module", erc721ModuleForSchain.address, {from: deployer});
//         await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
//         await lockAndDataForSchain.setContract("MessageProxy", messageProxyForSchain.address, {from: deployer});
//         await lockAndDataForSchain.setContract("TokenFactory", tokenFactory.address, {from: deployer});

//         // Register and transfer ownership of EthERC20
//         await lockAndDataForSchain.setEthErc20Address(ethERC20.address, {from: deployer});
//         await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});

//         // Register MessageProxy on mainnet in ContractManager of SkaleManager
//         await contractManager.setContractsAddress("MessageProxyForMainnet", messageProxyForMainnet.address, {from: deployer});

//         // IMA registration
//         await lockAndDataForMainnet.addSchain(schainName, tokenManager.address, {from: deployer});
//         await lockAndDataForSchain.addDepositBox(depositBox.address, {from: deployer});

//         // Deploy test tokens
//         ERC20TokenOnMainnet = await ERC20OnChain.new("GCERC20", "GCE", {from: deployer});
//         ERC20TokenOnSchain = await ERC20OnChain.new("GCERC20Clone", "GCEC", {from: deployer});
//         ERC721TokenOnMainnet = await ERC721OnChain.new("GCERC721", "GCE", {from: deployer});
//         ERC721TokenOnSchain = await ERC721OnChain.new("GCERC721Clone", "GCEC", {from: deployer});

//         // Mint tokens and grant minter role
//         await ERC20TokenOnMainnet.mint(user, 100000, {from: deployer});
//         const minterRoleERC20 = await ERC20TokenOnSchain.MINTER_ROLE();
//         await ERC20TokenOnSchain.grantRole(minterRoleERC20, lockAndDataForSchainERC20.address, {from: deployer});
//         await ERC721TokenOnMainnet.mint(user, 1, {from: deployer});
//         await ERC721TokenOnMainnet.mint(user, 2, {from: deployer});
//         await ERC721TokenOnMainnet.mint(user, 3, {from: deployer});
//         await ERC721TokenOnMainnet.mint(user, 4, {from: deployer});
//         await ERC721TokenOnMainnet.mint(user, 5, {from: deployer});
//         await ERC721TokenOnMainnet.mint(user, 6, {from: deployer});
//         await ERC721TokenOnMainnet.mint(user, 7, {from: deployer});
//         await ERC721TokenOnMainnet.mint(user, 8, {from: deployer});
//         await ERC721TokenOnMainnet.mint(user, 9, {from: deployer});
//         await ERC721TokenOnMainnet.mint(user, 10, {from: deployer});
//         const minterRoleERC721 = await ERC721TokenOnSchain.MINTER_ROLE();
//         await ERC721TokenOnSchain.grantRole(minterRoleERC721, lockAndDataForSchainERC721.address, {from: deployer});
//     });

//     it("calculate eth deposits", async () => {
//         let res = await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         console.log("First deposit eth cost:", res.receipt.gasUsed);
//         res = await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         console.log("Second deposit eth cost:", res.receipt.gasUsed);
//         res = await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         console.log("Third deposit eth cost:", res.receipt.gasUsed);
//         res = await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         console.log("Forth deposit eth cost:", res.receipt.gasUsed);
//         res = await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         console.log("Fifth deposit eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate registration and approve ERC20", async () => {
//         // register tokens
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         let res = await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         console.log("Registration of ERC20 token cost:", res.receipt.gasUsed);
//         res = await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});
//         console.log("First approve of ERC20 token cost:", res.receipt.gasUsed);
//         res = await ERC20TokenOnMainnet.approve(depositBox.address, 10, {from: user});
//         console.log("Second approve of ERC20 token cost:", res.receipt.gasUsed);
//     });

//     it("calculate erc20 deposits without eth without automatic deploy", async () => {
//         // register tokens
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 6, {from: user});

//         let res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {from: user});
//         console.log("First deposit erc20 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {from: user});
//         console.log("Second deposit erc20 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {from: user});
//         console.log("Third deposit erc20 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {from: user});
//         console.log("Forth deposit erc20 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {from: user});
//         console.log("Fifth deposit erc20 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {from: user});
//         console.log("Deposit all remaining approved erc20 tokens cost:", res.receipt.gasUsed);
//     });

//     it("calculate erc20 deposits with eth without automatic deploy", async () => {
//         // register tokens
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 6, {from: user});

//         let res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         console.log("First deposit erc20 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         console.log("Second deposit erc20 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         console.log("Third deposit erc20 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         console.log("Forth deposit erc20 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         console.log("Fifth deposit erc20 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         console.log("Deposit all remaining approved erc20 tokens with eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate erc20 deposits of all approved tokens without eth without automatic deploy", async () => {
//         // register tokens
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});

//         const res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 5, {from: user});
//         console.log("Deposit all approved erc20 tokens at once cost:", res.receipt.gasUsed);
//     });

//     it("calculate erc20 deposits of all approved tokens with eth without automatic deploy", async () => {
//         // register tokens
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});

//         const res = await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});
//         console.log("Deposit all approved erc20 tokens at once with eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate registration and approve ERC721", async () => {
//         // register tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         let res = await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         console.log("Registration of ERC721 token cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         console.log("First transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         console.log("Second transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         console.log("Third transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         console.log("Forth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});
//         console.log("Fifth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 6, {from: user});
//         console.log("Sixth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 7, {from: user});
//         console.log("Seventh transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 8, {from: user});
//         console.log("Eighth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 9, {from: user});
//         console.log("Ninth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 10, {from: user});
//         console.log("Tenth transfer of ERC721 token cost:", res.receipt.gasUsed);
//     });

//     it("calculate erc721 deposits without eth without automatic deploy", async () => {
//         // register tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 6, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 7, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 8, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 9, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 10, {from: user});

//         let res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {from: user});
//         console.log("First deposit erc721 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {from: user});
//         console.log("Second deposit erc721 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {from: user});
//         console.log("Third deposit erc721 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {from: user});
//         console.log("Forth deposit erc721 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {from: user});
//         console.log("Fifth deposit erc721 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 6, {from: user});
//         console.log("Sixth deposit erc721 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 7, {from: user});
//         console.log("Seventh deposit erc721 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 8, {from: user});
//         console.log("Eighth deposit erc721 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 9, {from: user});
//         console.log("Ninth deposit erc721 cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 10, {from: user});
//         console.log("Tenth deposit erc721 cost:", res.receipt.gasUsed);
//     });

//     it("calculate erc721 deposits with eth without automatic deploy", async () => {
//         // register tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 6, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 7, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 8, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 9, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 10, {from: user});

//         let res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         console.log("First deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {value: "1000000000000000000", from: user});
//         console.log("Second deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {value: "1000000000000000000", from: user});
//         console.log("Third deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {value: "1000000000000000000", from: user});
//         console.log("Forth deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});
//         console.log("Fifth deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 6, {value: "1000000000000000000", from: user});
//         console.log("Sixth deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 7, {value: "1000000000000000000", from: user});
//         console.log("Seventh deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 8, {value: "1000000000000000000", from: user});
//         console.log("Eighth deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 9, {value: "1000000000000000000", from: user});
//         console.log("Ninth deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 10, {value: "1000000000000000000", from: user});
//         console.log("Tenth deposit erc721 with eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate erc721 deposits without eth without automatic deploy and transfer each time", async () => {
//         // register tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});

//         let res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         console.log("First transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {from: user});
//         console.log("First deposit erc721 cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         console.log("Second transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {from: user});
//         console.log("Second deposit erc721 cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         console.log("Third transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {from: user});
//         console.log("Third deposit erc721 cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         console.log("Forth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {from: user});
//         console.log("Forth deposit erc721 cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});
//         console.log("Fifth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {from: user});
//         console.log("Fifth deposit erc721 cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 6, {from: user});
//         console.log("Sixth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 6, {from: user});
//         console.log("Sixth deposit erc721 cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 7, {from: user});
//         console.log("Seventh transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 7, {from: user});
//         console.log("Seventh deposit erc721 cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 8, {from: user});
//         console.log("Eighth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 8, {from: user});
//         console.log("Eighth deposit erc721 cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 9, {from: user});
//         console.log("Ninth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 9, {from: user});
//         console.log("Ninth deposit erc721 cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 10, {from: user});
//         console.log("Tenth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 10, {from: user});
//         console.log("Tenth deposit erc721 cost:", res.receipt.gasUsed);
//     });

//     it("calculate erc721 deposits with eth without automatic deploy and transfer each time", async () => {
//         // register tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});

//         let res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         console.log("First transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         console.log("First deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         console.log("Second transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {value: "1000000000000000000", from: user});
//         console.log("Second deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         console.log("Third transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {value: "1000000000000000000", from: user});
//         console.log("Third deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         console.log("Forth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {value: "1000000000000000000", from: user});
//         console.log("Forth deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});
//         console.log("Fifth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});
//         console.log("Fifth deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 6, {from: user});
//         console.log("Sixth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 6, {value: "1000000000000000000", from: user});
//         console.log("Sixth deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 7, {from: user});
//         console.log("Seventh transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 7, {value: "1000000000000000000", from: user});
//         console.log("Seventh deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 8, {from: user});
//         console.log("Eighth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 8, {value: "1000000000000000000", from: user});
//         console.log("Eighth deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 9, {from: user});
//         console.log("Ninth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 9, {value: "1000000000000000000", from: user});
//         console.log("Ninth deposit erc721 with eth cost:", res.receipt.gasUsed);
//         res = await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 10, {from: user});
//         console.log("Tenth transfer of ERC721 token cost:", res.receipt.gasUsed);
//         res = await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 10, {value: "1000000000000000000", from: user});
//         console.log("Tenth deposit erc721 with eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 1 exit eth cost per one message", async () => {
//         // make several deposits
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("First getMyEth eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             1,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Second getMyEth eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Third getMyEth eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Forth exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Forth getMyEth eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Fifth exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Fifth getMyEth eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 1 exit eth cost per one message deposit each time", async () => {
//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("First getMyEth eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             1,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Second getMyEth eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Third getMyEth eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Forth exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Forth getMyEth eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Fifth exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Fifth getMyEth eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 1 exit eth cost per one message getMyEth by the end", async () => {
//         // make several deposits
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First exit eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             1,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Forth exit eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Fifth exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("getMyEth all eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 1 exit eth cost per one message deposit each time getMyEth by the end", async () => {
//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First exit eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             1,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Forth exit eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Fifth exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("getMyEth all eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 2 exit eth cost per one message", async () => {
//         // make several deposits
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 2 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("First getMyEth eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Second getMyEth eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third  exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Third getMyEth eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 2 exit eth cost per one message deposit each time", async () => {
//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 2 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("First getMyEth eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Second getMyEth eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Third getMyEth eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 2 exit eth cost per one message getMyEth by the end", async () => {
//         // make several deposits
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 2 exit eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("getMyEth all eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 2 exit eth cost per one message deposit each time getMyEth by the end", async () => {
//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 2 exit eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("getMyEth all eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 3 exit eth cost per one message", async () => {
//         // make several deposits
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 3 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("First getMyEth eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Second getMyEth eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 3 exit eth cost per one message deposit each time", async () => {
//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 3 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("First getMyEth eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Second getMyEth eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 3 exit eth cost per one message getMyEth by the end", async () => {
//         // make several deposits
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 3 exit eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("getMyEth all eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 3 exit eth cost per one message deposit each time getMyEth by the end", async () => {
//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 3 exit eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("getMyEth all eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 4 exit eth cost per one message", async () => {
//         // make several deposits
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 4 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("First getMyEth eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Second getMyEth eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 4 exit eth cost per one message deposit each time", async () => {
//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 4 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("First getMyEth eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("Second getMyEth eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 4 exit eth cost per one message getMyEth by the end", async () => {
//         // make several deposits
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 4 exit eth cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("getMyEth all eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 4 exit eth cost per one message deposit each time getMyEth by the end", async () => {
//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 4 exit eth cost:", res.receipt.gasUsed);
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("getMyEth all eth cost:", res.receipt.gasUsed);
//     });

//     it("calculate 5 exit eth cost per one message", async () => {
//         // make several deposits
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});
//         await depositBox.deposit(schainName, user, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 eth - await TokenManager.exitToMain(user, {value: "1000000000000000000", from: user});
//         const message = {
//             amount: "1000000000000000000",
//             data: await messages.encodeTransferEthMessage(),
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: user
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 5 exit eth cost:", res.receipt.gasUsed);
//         res = await lockAndDataForMainnet.getMyEth({from: user});
//         console.log("getMyEth all eth cost:", res.receipt.gasUsed);
//     });

//     // ERC20:

//     function zeroAfterAddress(address: string) {
//         const len = address.length;
//         if (len === 40) {
//             return address + "000000000000000000000000";
//         } else if (len === 42 && address.slice(0, 2) === "0x") {
//             return  address.slice(2) + "000000000000000000000000";
//         } else {
//             return "0000000000000000000000000000000000000000000000000000000000000000";
//         }
//     }

//     it("calculate 1 exit erc20 cost per one message", async () => {
//         // make erc20 deposits
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});

//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 5, {value: "5000000000000000000", from: user});

//         // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user, 1);
//         const message = {
//             amount: "1000000000000000000",
//             data: dataOfERC20,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First exit erc20 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             1,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit erc20 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit erc20 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Forth exit erc20 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Fifth exit erc20 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 1 exit erc20 cost per one message deposit each time", async () => {
//         // register erc20
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});

//         // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user, 1);
//         const message = {
//             amount: "1000000000000000000",
//             data: dataOfERC20,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First exit erc20 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             1,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit erc20 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit erc20 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Forth exit erc20 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Fifth exit erc20 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 2 exit erc20 cost per one message", async () => {
//         // make erc20 deposits
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});

//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 5, {value: "5000000000000000000", from: user});

//         // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user, 1);
//         const message = {
//             amount: "1000000000000000000",
//             data: dataOfERC20,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 2 exit erc20 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit erc20 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit erc20 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 2 exit erc20 cost per one message deposit each time", async () => {
//         // register erc20
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});

//         // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user, 1);
//         const message = {
//             amount: "1000000000000000000",
//             data: dataOfERC20,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 2 exit erc20 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit erc20 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit erc20 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 3 exit erc20 cost per one message", async () => {
//         // make erc20 deposits
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});

//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 5, {value: "5000000000000000000", from: user});

//         // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user, 1);
//         const message = {
//             amount: "1000000000000000000",
//             data: dataOfERC20,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 3 exit erc20 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit erc20 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 3 exit erc20 cost per one message deposit each time", async () => {
//         // register erc20
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});

//         // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user, 1);
//         const message = {
//             amount: "1000000000000000000",
//             data: dataOfERC20,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 3 exit erc20 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit erc20 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 4 exit erc20 cost per one message", async () => {
//         // make erc20 deposits
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});

//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 5, {value: "5000000000000000000", from: user});

//         // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user, 1);
//         const message = {
//             amount: "1000000000000000000",
//             data: dataOfERC20,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 4 exit erc20 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit erc20 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 4 exit erc20 cost per one message deposit each time", async () => {
//         // register erc20
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});

//         // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user, 1);
//         const message = {
//             amount: "1000000000000000000",
//             data: dataOfERC20,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 4 exit erc20 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit erc20 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 5 exit erc20 cost per one message", async () => {
//         // make erc20 deposits
//         await lockAndDataForSchainERC20.addERC20TokenByOwner("Mainnet", ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC20.addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address, {from: deployer});
//         await ERC20TokenOnMainnet.approve(depositBox.address, 5, {from: user});

//         await depositBox.depositERC20(schainName, ERC20TokenOnMainnet.address, user, 5, {value: "5000000000000000000", from: user});

//         // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user, 1);
//         const message = {
//             amount: "1000000000000000000",
//             data: dataOfERC20,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         const res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message, message, message, message, message],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 5 exit erc20 cost:", res.receipt.gasUsed);
//     });

//     // ERC721

//     it("calculate 1 exit erc721 cost per one message", async () => {
//         // register ERC721 tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});

//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 1);
//         const message1 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken1,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 2, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 2);
//         const message2 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken2,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 3, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 3);
//         const message3 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken3,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 4, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 4);
//         const message4 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken4,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 5, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 5);
//         const message5 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken5,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message1],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First exit erc721 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             1,
//             [message2],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit erc721 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message3],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit erc721 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message4],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Forth exit erc721 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message5],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Fifth exit erc721 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 1 exit erc721 cost per one message deposit each time", async () => {
//         // register ERC721 tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});

//         // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 1);
//         const message1 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken1,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 2, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 2);
//         const message2 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken2,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 3, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 3);
//         const message3 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken3,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 4, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 4);
//         const message4 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken4,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 5, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 5);
//         const message5 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken5,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message1],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First exit erc721 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             1,
//             [message2],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit erc721 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message3],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit erc721 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message4],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Forth exit erc721 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message5],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Fifth exit erc721 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 2 exit erc721 cost per one message", async () => {
//         // register ERC721 tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});

//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 1);
//         const message1 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken1,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 2, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 2);
//         const message2 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken2,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 3, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 3);
//         const message3 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken3,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 4, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 4);
//         const message4 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken4,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 5, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 5);
//         const message5 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken5,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message1, message2],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 2 exit erc721 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message3, message4],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit erc721 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message5],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit erc721 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 2 exit erc721 cost per one message deposit each time", async () => {
//         // register ERC721 tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});

//         // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 1);
//         const message1 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken1,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 2, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 2);
//         const message2 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken2,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 3, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 3);
//         const message3 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken3,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 4, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 4);
//         const message4 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken4,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 5, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 5);
//         const message5 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken5,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message1, message2],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 2 exit erc721 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             2,
//             [message3, message4],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit erc721 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message5],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Third exit erc721 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 3 exit erc721 cost per one message", async () => {
//         // register ERC721 tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});

//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 1);
//         const message1 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken1,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 2, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 2);
//         const message2 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken2,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 3, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 3);
//         const message3 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken3,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 4, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 4);
//         const message4 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken4,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 5, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 5);
//         const message5 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken5,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message1, message2, message3],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 3 exit erc721 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message4, message5],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit erc721 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 3 exit erc721 cost per one message deposit each time", async () => {
//         // register ERC721 tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});

//         // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 1);
//         const message1 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken1,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 2, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 2);
//         const message2 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken2,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 3, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 3);
//         const message3 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken3,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 4, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 4);
//         const message4 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken4,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 5, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 5);
//         const message5 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken5,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message1, message2, message3],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 3 exit erc721 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             3,
//             [message4, message5],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second 2 exit erc721 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 4 exit erc721 cost per one message", async () => {
//         // register ERC721 tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});

//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 1);
//         const message1 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken1,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 2, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 2);
//         const message2 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken2,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 3, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 3);
//         const message3 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken3,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 4, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 4);
//         const message4 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken4,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 5, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 5);
//         const message5 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken5,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message1, message2, message3, message4],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 4 exit erc721 cost:", res.receipt.gasUsed);
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message5],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit erc721 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 4 exit erc721 cost per one message deposit each time", async () => {
//         // register ERC721 tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});

//         // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 1);
//         const message1 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken1,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 2, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 2);
//         const message2 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken2,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 3, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 3);
//         const message3 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken3,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 4, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 4);
//         const message4 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken4,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 5, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 5);
//         const message5 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken5,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {value: "1000000000000000000", from: user});
//         let res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message1, message2, message3, message4],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 4 exit erc721 cost:", res.receipt.gasUsed);
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});
//         res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             4,
//             [message5],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("Second exit erc721 cost:", res.receipt.gasUsed);
//     });

//     it("calculate 5 exit erc721 cost per one message", async () => {
//         // register ERC721 tokens
//         await lockAndDataForSchainERC721.addERC721TokenByOwner("Mainnet", ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address, {from: deployer});
//         await lockAndDataForMainnetERC721.addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address, {from: deployer});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 1, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 2, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 3, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 4, {from: user});
//         await ERC721TokenOnMainnet.transferFrom(user, depositBox.address, 5, {from: user});

//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 1, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 2, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 3, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 4, {value: "1000000000000000000", from: user});
//         await depositBox.depositERC721(schainName, ERC721TokenOnMainnet.address, user, 5, {value: "1000000000000000000", from: user});

//         // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 1, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 1);
//         const message1 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken1,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 2, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 2);
//         const message2 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken2,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 3, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 3);
//         const message3 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken3,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 4, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 4);
//         const message4 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken4,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };
//         // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user, 5, "1000000000000000000", {from: user});
//         const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user, 5);
//         const message5 = {
//             amount: "1000000000000000000",
//             data: dataOfERC721OfToken5,
//             destinationContract: depositBox.address,
//             sender: tokenManager.address,
//             to: "0x0000000000000000000000000000000000000000"
//         };

//         // prepare BLS signature
//         // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
//         const BlsSignature = [
//             "178325537405109593276798394634841698946852714038246117383766698579865918287",
//             "493565443574555904019191451171395204672818649274520396086461475162723833781",
//         ];
//         const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
//         const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
//         const Counter = 0;
//         const sign = {
//             blsSignature: BlsSignature,
//             counter: Counter,
//             hashA: HashA,
//             hashB: HashB,
//         };

//         // send exit message to mainnet
//         const res = await messageProxyForMainnet.postIncomingMessages(
//             schainName,
//             0,
//             [message1, message2, message3, message4, message5],
//             sign,
//             5,
//             {from: deployer},
//         );
//         console.log("First 5 exit erc721 cost:", res.receipt.gasUsed);
//     });
// });
