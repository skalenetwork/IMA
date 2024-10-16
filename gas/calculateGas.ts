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

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    CommunityLocker,
    CommunityPool,
    ContractManager,
    DepositBoxEth,
    DepositBoxERC20,
    DepositBoxERC721,
    DepositBoxERC1155,
    ERC20OnChain,
    ERC721OnChain,
    ERC1155OnChain,
    EthErc20,
    KeyStorageMock,
    MessageProxyForMainnet,
    MessageProxyForSchain,
    MessagesTester,
    Nodes,
    Schains,
    SchainsInternal,
    SkaleVerifierMock,
    TokenManagerEth,
    TokenManagerERC20,
    TokenManagerERC721,
    TokenManagerERC1155,
    TokenManagerLinker,
    Wallets,
    Linker,
    IMessageListener,
} from "../typechain";

chai.should();
chai.use(chaiAsPromised);

import { deployLinker } from "../test/utils/deploy/mainnet/linker";
import { deployDepositBoxEth } from "../test/utils/deploy/mainnet/depositBoxEth";
import { deployDepositBoxERC20 } from "../test/utils/deploy/mainnet/depositBoxERC20";
import { deployDepositBoxERC721 } from "../test/utils/deploy/mainnet/depositBoxERC721";
import { deployDepositBoxERC1155 } from "../test/utils/deploy/mainnet/depositBoxERC1155";
import { deployMessageProxyForMainnet } from "../test/utils/deploy/mainnet/messageProxyForMainnet";

import { deployEthErc20 } from "../test/utils/deploy/schain/ethErc20";
import { deployERC20OnChain } from "../test/utils/deploy/erc20OnChain";
import { deployERC721OnChain } from "../test/utils/deploy/erc721OnChain";
import { deployERC1155OnChain } from "../test/utils/deploy/erc1155OnChain";

import { deployContractManager } from "../test/utils/skale-manager-utils/contractManager";
import { deployTokenManagerLinker } from "../test/utils/deploy/schain/tokenManagerLinker";
import { deployTokenManagerEth } from "../test/utils/deploy/schain/tokenManagerEth";
import { deployTokenManagerERC20 } from "../test/utils/deploy/schain/tokenManagerERC20";
import { deployTokenManagerERC721 } from "../test/utils/deploy/schain/tokenManagerERC721";
import { deployTokenManagerERC1155 } from "../test/utils/deploy/schain/tokenManagerERC1155";
import { deployMessageProxyForSchain } from "../test/utils/deploy/schain/messageProxyForSchain";
import { deployMessages } from "../test/utils/deploy/messages";

import { stringKeccak256, getPublicKey } from "../test/utils/helper";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, Wallet } from "ethers";

import { expect } from "chai";
import { deployCommunityLocker } from "../test/utils/deploy/schain/communityLocker";
import { deployCommunityPool } from "../test/utils/deploy/mainnet/communityPool";

describe("Gas calculation", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;
    let richGuy: SignerWithAddress;
    let nodeAddress: Wallet;

    let imaLinker: Linker;
    let depositBoxEth: DepositBoxEth;
    let depositBoxERC20: DepositBoxERC20;
    let depositBoxERC721: DepositBoxERC721;
    let depositBoxERC1155: DepositBoxERC1155;
    let communityPool: CommunityPool;
    let messageProxyForMainnet: MessageProxyForMainnet;

    let contractManager: ContractManager;
    let keyStorage: KeyStorageMock;
    let nodes: Nodes;
    let schains: Schains;
    let schainsInternal: SchainsInternal;
    let skaleVerifier: SkaleVerifierMock;
    let wallets: Wallets;

    let tokenManagerEth: TokenManagerEth;
    let tokenManagerERC20: TokenManagerERC20;
    let tokenManagerERC721: TokenManagerERC721;
    let tokenManagerERC1155: TokenManagerERC1155;
    let tokenManagerLinker: TokenManagerLinker;
    let communityLocker: CommunityLocker;
    let ethERC20: EthErc20;
    let messageProxyForSchain: MessageProxyForSchain;
    let messages: MessagesTester;

    let ERC20TokenOnMainnet: ERC20OnChain;
    let ERC20TokenOnSchain: ERC20OnChain;
    let ERC721TokenOnMainnet: ERC721OnChain;
    let ERC721TokenOnSchain: ERC721OnChain;
    let ERC1155TokenOnMainnet: ERC1155OnChain;
    let ERC1155TokenOnSchain: ERC1155OnChain;

    const schainName = "GasCalculation";
    const schainNameHash = stringKeccak256("GasCalculation");
    const contractManagerAddress = "0x0000000000000000000000000000000000000000";
    const mainnetName = "Mainnet";

    before(async () => {
        [deployer, schainOwner, user, richGuy] = await ethers.getSigners();
        nodeAddress = Wallet.createRandom().connect(ethers.provider);
        const balanceRichGuy = await richGuy.getBalance();
        await richGuy.sendTransaction({to: nodeAddress.address, value: balanceRichGuy.sub(ethers.utils.parseEther("1"))});
    })

    after(async () => {
        const balanceNode = await nodeAddress.getBalance();
        await nodeAddress.sendTransaction({to: richGuy.address, value: balanceNode.sub(ethers.utils.parseEther("1"))});
    });

    beforeEach(async () => {
        // skale-manager mock preparation
        contractManager = await deployContractManager(contractManagerAddress);
        keyStorage = await (await ethers.getContractFactory("KeyStorageMock")).deploy() as KeyStorageMock;
        nodes = await (await ethers.getContractFactory("Nodes")).deploy() as Nodes;
        schains = await (await ethers.getContractFactory("Schains")).deploy() as Schains;
        schainsInternal = await (await ethers.getContractFactory("SchainsInternal")).deploy() as SchainsInternal;
        skaleVerifier = await (await ethers.getContractFactory("SkaleVerifierMock")).deploy() as SkaleVerifierMock;
        wallets = await (await ethers.getContractFactory("Wallets")).deploy() as Wallets;
        await contractManager.connect(deployer).setContractsAddress("KeyStorage", keyStorage.address);
        await contractManager.connect(deployer).setContractsAddress("Nodes", nodes.address);
        await contractManager.connect(deployer).setContractsAddress("Schains", schains.address);
        await contractManager.connect(deployer).setContractsAddress("SchainsInternal", schainsInternal.address);
        await contractManager.connect(deployer).setContractsAddress("SkaleVerifier", skaleVerifier.address);
        await contractManager.connect(deployer).setContractsAddress("Wallets", wallets.address);

        // add ContractManager to contracts
        await schains.connect(deployer).addContractManager(contractManager.address);
        await schainsInternal.connect(deployer).addContractManager(contractManager.address);
        await wallets.connect(deployer).addContractManager(contractManager.address);

        // setup 16 nodes
        const nodeCreationParams = {
            port: 1337,
            nonce: 1337,
            ip: "0x12345678",
            publicIp: "0x12345678",
            publicKey: getPublicKey(nodeAddress),
            name: "GasCalculationNode",
            domainName: "gascalculationnode.com"
        };
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(nodeAddress.address, nodeCreationParams);

        // initialize schain and data
        await schainsInternal.connect(deployer).initializeSchain(schainName, schainOwner.address, 12345678, 12345678);
        await schainsInternal.connect(deployer).addNodesToSchainsGroups(schainNameHash, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        await wallets.connect(deployer).rechargeSchainWallet(schainNameHash, {value: "1000000000000000000"});

        // set BLS Public Key to schain
        // P.s. this is test public key from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BLSPublicKey = {
            x: {
                a: "8276253263131369565695687329790911140957927205765534740198480597854608202714",
                b: "12500085126843048684532885473768850586094133366876833840698567603558300429943",
            },
            y: {
                a: "7025653765868604607777943964159633546920168690664518432704587317074821855333",
                b: "14411459380456065006136894392078433460802915485975038137226267466736619639091",
            }
        }
        await keyStorage.connect(deployer).setBlsCommonPublicKeyForSchain(schainNameHash, BLSPublicKey);
        // await wallets.rechargeSchainWallet(stringValue(schainNameHash), {value: "1000000000000000000"});

        // IMA mainnet part deployment
        messageProxyForMainnet = await deployMessageProxyForMainnet(contractManager);
        imaLinker = await deployLinker(contractManager, messageProxyForMainnet);
        communityPool = await deployCommunityPool(contractManager, imaLinker, messageProxyForMainnet);
        depositBoxEth = await deployDepositBoxEth(contractManager, imaLinker, messageProxyForMainnet);
        depositBoxERC20 = await deployDepositBoxERC20(contractManager, imaLinker, messageProxyForMainnet);
        depositBoxERC721 = await deployDepositBoxERC721(contractManager, imaLinker, messageProxyForMainnet);
        depositBoxERC1155 = await deployDepositBoxERC1155(contractManager, imaLinker, messageProxyForMainnet);
        const extraContractRegistrarRole = await messageProxyForMainnet.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxyForMainnet.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
        await messageProxyForMainnet.registerExtraContractForAll(depositBoxEth.address)
        await messageProxyForMainnet.registerExtraContractForAll(depositBoxERC20.address)
        await messageProxyForMainnet.registerExtraContractForAll(depositBoxERC721.address)
        await messageProxyForMainnet.registerExtraContractForAll(depositBoxERC1155.address)
        await messageProxyForMainnet.registerExtraContractForAll(communityPool.address)
        await messageProxyForMainnet.registerExtraContractForAll(imaLinker.address)

        messages = await deployMessages();

        // IMA schain part deployment
        messageProxyForSchain = await deployMessageProxyForSchain(keyStorage.address, schainName);
        await keyStorage.connect(deployer).setBlsCommonPublicKey(BLSPublicKey);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, imaLinker.address);
        communityLocker = await deployCommunityLocker(schainName, messageProxyForSchain.address, tokenManagerLinker, communityPool.address);
        tokenManagerEth = await deployTokenManagerEth(
            schainName,
            messageProxyForSchain.address,
            tokenManagerLinker,
            communityLocker,
            depositBoxEth.address,
            "0x0000000000000000000000000000000000000000");
        tokenManagerERC20 = await deployTokenManagerERC20(schainName, messageProxyForSchain.address, tokenManagerLinker, communityLocker, depositBoxERC20.address);
        tokenManagerERC721 = await deployTokenManagerERC721(schainName, messageProxyForSchain.address, tokenManagerLinker, communityLocker, depositBoxERC721.address);
        tokenManagerERC1155 = await deployTokenManagerERC1155(schainName, messageProxyForSchain.address, tokenManagerLinker, communityLocker, depositBoxERC1155.address);
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerEth.address)
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC20.address)
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721.address)
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC1155.address)
        await messageProxyForSchain.registerExtraContractForAll(communityLocker.address)

        ethERC20 = await deployEthErc20(tokenManagerEth);
        await tokenManagerEth.connect(deployer).setEthErc20Address(ethERC20.address);
        const chainConnectorRole = await messageProxyForSchain.CHAIN_CONNECTOR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(chainConnectorRole, tokenManagerLinker.address);
        await tokenManagerERC20.connect(deployer).grantRole(await tokenManagerERC20.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        await tokenManagerERC721.connect(deployer).grantRole(await tokenManagerERC721.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        await tokenManagerERC1155.connect(deployer).grantRole(await tokenManagerERC1155.TOKEN_REGISTRAR_ROLE(), schainOwner.address);

        // IMA schain part registration
        // await lockAndDataForSchain.setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
        // await lockAndDataForSchain.setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
        // await lockAndDataForSchain.setContract("ERC20Module", erc20ModuleForSchain.address);
        // await lockAndDataForSchain.setContract("ERC721Module", erc721ModuleForSchain.address);
        // await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);
        // await lockAndDataForSchain.setContract("MessageProxy", messageProxyForSchain.address);
        // await lockAndDataForSchain.setContract("TokenFactory", tokenFactory.address);

        // IMA registration
        await messageProxyForMainnet.grantRole(await messageProxyForMainnet.CHAIN_CONNECTOR_ROLE(), imaLinker.address);
        await imaLinker.connectSchain(schainName, [tokenManagerLinker.address, communityLocker.address, tokenManagerEth.address, tokenManagerERC20.address, tokenManagerERC721.address, tokenManagerERC1155.address]);
        await communityPool.connect(user).rechargeUserWallet(schainName, user.address, { value: 1e18.toString() });
        // await lockAndDataForSchain.addDepositBox(depositBoxEth.address);
        // await lockAndDataForSchain.addDepositBox(depositBoxERC20.address);
        // await lockAndDataForSchain.addDepositBox(depositBoxERC721.address);

        // Deploy test tokens
        ERC20TokenOnMainnet = await deployERC20OnChain("GCERC20", "GCE");
        ERC20TokenOnSchain = await deployERC20OnChain("GCERC20Clone", "GCEC");
        ERC721TokenOnMainnet = await deployERC721OnChain("GCERC721", "GCE");
        ERC721TokenOnSchain = await deployERC721OnChain("GCERC721Clone", "GCEC");
        ERC1155TokenOnMainnet = await deployERC1155OnChain("GCERC1155");
        ERC1155TokenOnSchain = await deployERC1155OnChain("GCERC1155Clone");

        // Mint tokens and grant minter role
        await ERC20TokenOnMainnet.mint(user.address, 5);
        const minterRoleERC20 = await ERC20TokenOnSchain.MINTER_ROLE();
        await ERC20TokenOnSchain.grantRole(minterRoleERC20, tokenManagerERC20.address);

        await ERC721TokenOnMainnet.mint(user.address, 1);
        await ERC721TokenOnMainnet.mint(user.address, 2);
        await ERC721TokenOnMainnet.mint(user.address, 3);
        await ERC721TokenOnMainnet.mint(user.address, 4);
        await ERC721TokenOnMainnet.mint(user.address, 5);
        await ERC721TokenOnMainnet.mint(user.address, 6);
        await ERC721TokenOnMainnet.mint(user.address, 7);
        await ERC721TokenOnMainnet.mint(user.address, 8);
        await ERC721TokenOnMainnet.mint(user.address, 9);
        await ERC721TokenOnMainnet.mint(user.address, 10);
        const minterRoleERC721 = await ERC721TokenOnSchain.MINTER_ROLE();
        await ERC721TokenOnSchain.grantRole(minterRoleERC721, tokenManagerERC721.address);

        await ERC1155TokenOnMainnet.mint(user.address, 1, 1, "0x");
        await ERC1155TokenOnMainnet.mint(user.address, 2, 2, "0x");
        await ERC1155TokenOnMainnet.mint(user.address, 3, 3, "0x");
        await ERC1155TokenOnMainnet.mint(user.address, 4, 4, "0x");
        await ERC1155TokenOnMainnet.mint(user.address, 5, 5, "0x");
        await ERC1155TokenOnMainnet.mint(user.address, 6, 6, "0x");
        await ERC1155TokenOnMainnet.mint(user.address, 7, 7, "0x");
        await ERC1155TokenOnMainnet.mint(user.address, 8, 8, "0x");
        await ERC1155TokenOnMainnet.mint(user.address, 9, 9, "0x");
        await ERC1155TokenOnMainnet.mint(user.address, 10, 10, "0x");
        const minterRoleERC1155 = await ERC1155TokenOnSchain.MINTER_ROLE();
        await ERC1155TokenOnSchain.grantRole(minterRoleERC1155, tokenManagerERC1155.address);

        // register user
        await communityPool.connect(user).rechargeUserWallet(schainName, user.address, {value: "1000000000000000000"});
    });

    it("calculate eth deposits", async () => {
        let res = await (await depositBoxEth.connect(user).deposit(schainName, {value: "1000000000000000000"})).wait();
        console.log("First deposit eth cost:", res.gasUsed.toNumber());
        res = await (await depositBoxEth.connect(user).deposit(schainName, {value: "1000000000000000000"})).wait();
        console.log("Second deposit eth cost:", res.gasUsed.toNumber());
        res = await (await depositBoxEth.connect(user).deposit(schainName, {value: "1000000000000000000"})).wait();
        console.log("Third deposit eth cost:", res.gasUsed.toNumber());
        res = await (await depositBoxEth.connect(user).deposit(schainName, {value: "1000000000000000000"})).wait();
        console.log("Forth deposit eth cost:", res.gasUsed.toNumber());
        res = await (await depositBoxEth.connect(user).deposit(schainName, {value: "1000000000000000000"})).wait();
        console.log("Fifth deposit eth cost:", res.gasUsed.toNumber());
    });

    describe("ERC20 init", async () => {
        beforeEach(async () => {
            let res = await (await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address)).wait();
            console.log("Registration of ERC20 token in TokenManager cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address)).wait();
            console.log("Registration of ERC20 token in DepositBox cost:", res.gasUsed.toNumber());
        });

        it("calculate registration and approve ERC20", async () => {
            let res = await (await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 2)).wait();
            console.log("First approve of ERC20 token cost:", res.gasUsed.toNumber());
            res = await (await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 2)).wait();
            console.log("Second approve of ERC20 token cost:", res.gasUsed.toNumber());
        });

        it("calculate erc20 deposits without eth without automatic deploy", async () => {
            await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

            let res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, 1)).wait();
            console.log("First deposit erc20 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, 1)).wait();
            console.log("Second deposit erc20 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, 1)).wait();
            console.log("Third deposit erc20 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, 1)).wait();
            console.log("Forth deposit erc20 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, 1)).wait();
            console.log("Deposit all remaining approved erc20 tokens cost:", res.gasUsed.toNumber());
        });

        it("calculate erc20 deposits of all approved tokens without eth without automatic deploy", async () => {
            await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

            const res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, 5)).wait();
            console.log("Deposit all approved erc20 tokens at once cost:", res.gasUsed.toNumber());
        });
    });

    describe("ERC721 init", async () => {
        beforeEach(async () => {
            let res = await (await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(mainnetName,  ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address)).wait();
            console.log("Registration of ERC721 token in TokenManager cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address)).wait();
            console.log("Registration of ERC721 token in DepositBox cost:", res.gasUsed.toNumber());
        });

        it("calculate registration and approve ERC721", async () => {
            let res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1)).wait();
            console.log("First transfer of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2)).wait();
            console.log("Second transfer of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3)).wait();
            console.log("Third transfer of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4)).wait();
            console.log("Forth transfer of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5)).wait();
            console.log("Fifth transfer of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 6)).wait();
            console.log("Sixth transfer of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 7)).wait();
            console.log("Seventh transfer of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 8)).wait();
            console.log("Eighth transfer of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 9)).wait();
            console.log("Ninth transfer of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 10)).wait();
            console.log("Tenth transfer of ERC721 token cost:", res.gasUsed.toNumber());
        });

        it("calculate erc721 deposits without eth without automatic deploy", async () => {
            await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1);
            await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2);
            await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3);
            await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4);
            await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5);
            await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 6);
            await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 7);
            await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 8);
            await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 9);
            await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 10);

            let res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 1)).wait();
            console.log("First deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 2)).wait();
            console.log("Second deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 3)).wait();
            console.log("Third deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 4)).wait();
            console.log("Forth deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 5)).wait();
            console.log("Fifth deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 6)).wait();
            console.log("Sixth deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 7)).wait();
            console.log("Seventh deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 8)).wait();
            console.log("Eighth deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 9)).wait();
            console.log("Ninth deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 10)).wait();
            console.log("Tenth deposit erc721 cost:", res.gasUsed.toNumber());
        });

        it("calculate erc721 deposits without eth without automatic deploy and approve each time", async () => {
            let res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1)).wait();
            console.log("First approve of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 1)).wait();
            console.log("First deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2)).wait();
            console.log("Second approve of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 2)).wait();
            console.log("Second deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3)).wait();
            console.log("Third approve of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 3)).wait();
            console.log("Third deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4)).wait();
            console.log("Forth approve of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 4)).wait();
            console.log("Forth deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5)).wait();
            console.log("Fifth approve of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 5)).wait();
            console.log("Fifth deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 6)).wait();
            console.log("Sixth approve of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 6)).wait();
            console.log("Sixth deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 7)).wait();
            console.log("Seventh approve of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 7)).wait();
            console.log("Seventh deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 8)).wait();
            console.log("Eighth approve of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 8)).wait();
            console.log("Eighth deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 9)).wait();
            console.log("Ninth approve of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 9)).wait();
            console.log("Ninth deposit erc721 cost:", res.gasUsed.toNumber());
            res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 10)).wait();
            console.log("Tenth approve of ERC721 token cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, 10)).wait();
            console.log("Tenth deposit erc721 cost:", res.gasUsed.toNumber());
        });
    });

    describe("ERC1155 init", async () => {
        beforeEach(async () => {
            let res = await (await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  ERC1155TokenOnMainnet.address, ERC1155TokenOnSchain.address)).wait();
            console.log("Registration of ERC1155 token in TokenManager cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(schainOwner).addERC1155TokenByOwner(schainName, ERC1155TokenOnMainnet.address)).wait();
            console.log("Registration of ERC1155 token in DepositBox cost:", res.gasUsed.toNumber());
        });

        it("calculate registration and approve ERC1155", async () => {
            const res = await (await ERC1155TokenOnMainnet.connect(user).setApprovalForAll(depositBoxERC1155.address, true)).wait();
            console.log("Approve ERC1155 token cost:", res.gasUsed.toNumber());
        });

        it("calculate erc1155 deposits without eth without automatic deploy", async () => {
            await ERC1155TokenOnMainnet.connect(user).setApprovalForAll(depositBoxERC1155.address, true);

            let res = await (await depositBoxERC1155.connect(user).depositERC1155(schainName, ERC1155TokenOnMainnet.address, 1, 1)).wait();
            console.log("First deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155(schainName, ERC1155TokenOnMainnet.address, 2, 2)).wait();
            console.log("Second deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155(schainName, ERC1155TokenOnMainnet.address, 3, 3)).wait();
            console.log("Third deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155(schainName, ERC1155TokenOnMainnet.address, 4, 4)).wait();
            console.log("Forth deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155(schainName, ERC1155TokenOnMainnet.address, 5, 5)).wait();
            console.log("Fifth deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155(schainName, ERC1155TokenOnMainnet.address, 6, 6)).wait();
            console.log("Sixth deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155(schainName, ERC1155TokenOnMainnet.address, 7, 7)).wait();
            console.log("Seventh deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155(schainName, ERC1155TokenOnMainnet.address, 8, 8)).wait();
            console.log("Eighth deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155(schainName, ERC1155TokenOnMainnet.address, 9, 9)).wait();
            console.log("Ninth deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155(schainName, ERC1155TokenOnMainnet.address, 10, 10)).wait();
            console.log("Tenth deposit erc1155 cost:", res.gasUsed.toNumber());
        });

        it("calculate erc1155 deposits batches without eth without automatic deploy", async () => {
            await ERC1155TokenOnMainnet.connect(user).setApprovalForAll(depositBoxERC1155.address, true);

            let res = await (await depositBoxERC1155.connect(user).depositERC1155Batch(schainName, ERC1155TokenOnMainnet.address, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1])).wait();
            console.log("First deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155Batch(schainName, ERC1155TokenOnMainnet.address, [2, 3, 4, 5, 6, 7, 8, 9, 10], [1, 1, 1, 1, 1, 1, 1, 1, 1])).wait();
            console.log("Second deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155Batch(schainName, ERC1155TokenOnMainnet.address, [3, 4, 5, 6, 7, 8, 9, 10], [1, 1, 1, 1, 1, 1, 1, 1])).wait();
            console.log("Third deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155Batch(schainName, ERC1155TokenOnMainnet.address, [4, 5, 6, 7, 8, 9, 10], [1, 1, 1, 1, 1, 1, 1])).wait();
            console.log("Forth deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155Batch(schainName, ERC1155TokenOnMainnet.address, [5, 6, 7, 8, 9, 10], [1, 1, 1, 1, 1, 1])).wait();
            console.log("Fifth deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155Batch(schainName, ERC1155TokenOnMainnet.address, [6, 7, 8, 9, 10], [1, 1, 1, 1, 1])).wait();
            console.log("Sixth deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155Batch(schainName, ERC1155TokenOnMainnet.address, [7, 8, 9, 10], [1, 1, 1, 1])).wait();
            console.log("Seventh deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155Batch(schainName, ERC1155TokenOnMainnet.address, [8, 9, 10], [1, 1, 1])).wait();
            console.log("Eighth deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155Batch(schainName, ERC1155TokenOnMainnet.address, [9, 10], [1, 1])).wait();
            console.log("Ninth deposit erc1155 cost:", res.gasUsed.toNumber());
            res = await (await depositBoxERC1155.connect(user).depositERC1155Batch(schainName, ERC1155TokenOnMainnet.address, [10], [1])).wait();
            console.log("Tenth deposit erc1155 cost:", res.gasUsed.toNumber());
        });
    });

    describe("Exits", async()  => {
        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const sign = {
            blsSignature: BlsSignature,
            counter: 0,
            hashA: "3080491942974172654518861600747466851589809241462384879086673256057179400078",
            hashB: "15163860114293529009901628456926790077787470245128337652112878212941459329347",
        };

        async function postIncomingMessages(startingCounter: number, arrayOfMessages: IMessageListener.MessageStruct[], action: string) {
            const res = await (await messageProxyForMainnet.connect(nodeAddress).postIncomingMessages(
                schainName,
                startingCounter,
                arrayOfMessages,
                sign
            )).wait();
            console.log(action, "cost:", res.gasUsed.toNumber());
        }

        describe("Eth transfers ready", async () => {

            // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
            async function getEthMessage() {
                return {
                    data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
                    destinationContract: depositBoxEth.address,
                    sender: tokenManagerEth.address,
                };
            }

            async function sendEth() {
                await depositBoxEth.connect(user).deposit(schainName, {value: "1000000000000000000"});
            }

            async function getMyEth(action: string) {
                const res = await (await depositBoxEth.connect(user).getMyEth()).wait();
                console.log(action, "getMyEth eth cost:", res.gasUsed.toNumber());
            }

            it("calculate 1 exit eth cost per one message", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage()], "First exit eth");
                await getMyEth("First");
                await postIncomingMessages(1, [await getEthMessage()], "Second exit eth");
                await getMyEth("Second");
                await postIncomingMessages(2, [await getEthMessage()], "Third exit eth");
                await getMyEth("Third");
                await postIncomingMessages(3, [await getEthMessage()], "Forth exit eth");
                await getMyEth("Forth");
                await postIncomingMessages(4, [await getEthMessage()], "Fifth exit eth");
                await getMyEth("Fifth");
            });

            it("calculate 1 exit eth cost per one message deposit each time", async () => {
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage()], "First exit eth");
                await getMyEth("First");
                await sendEth();
                await postIncomingMessages(1, [await getEthMessage()], "Second exit eth");
                await getMyEth("Second");
                await sendEth();
                await postIncomingMessages(2, [await getEthMessage()], "Third exit eth");
                await getMyEth("Third");
                await sendEth();
                await postIncomingMessages(3, [await getEthMessage()], "Forth exit eth");
                await getMyEth("Forth");
                await sendEth();
                await postIncomingMessages(4, [await getEthMessage()], "Fifth exit eth");
                await getMyEth("Fifth");
            });

            it("calculate 1 exit eth cost per one message getMyEth by the end", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage()], "First exit eth");
                await postIncomingMessages(1, [await getEthMessage()], "Second exit eth");
                await postIncomingMessages(2, [await getEthMessage()], "Third exit eth");
                await postIncomingMessages(3, [await getEthMessage()], "Forth exit eth");
                await postIncomingMessages(4, [await getEthMessage()], "Fifth exit eth");
                await getMyEth("All");
            });

            it("calculate 1 exit eth cost per one message deposit each time getMyEth by the end", async () => {
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage()], "First exit eth");
                await sendEth();
                await postIncomingMessages(1, [await getEthMessage()], "Second exit eth");
                await sendEth();
                await postIncomingMessages(2, [await getEthMessage()], "Third exit eth");
                await sendEth();
                await postIncomingMessages(3, [await getEthMessage()], "Forth exit eth");
                await sendEth();
                await postIncomingMessages(4, [await getEthMessage()], "Fifth exit eth");
                await getMyEth("All");
            });

            it("calculate 2 exit eth cost per one message", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage()], "First 2 exit eth");
                await getMyEth("First");
                await postIncomingMessages(2, [await getEthMessage(), await getEthMessage()], "Second 2 exit eth");
                await getMyEth("Second");
                await postIncomingMessages(4, [await getEthMessage()], "Third exit eth");
                await getMyEth("Third");
            });

            it("calculate 2 exit eth cost per one message deposit each time", async () => {
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage()], "First 2 exit eth");
                await getMyEth("First");
                await sendEth();
                await sendEth();
                await postIncomingMessages(2, [await getEthMessage(), await getEthMessage()], "Second 2 exit eth");
                await getMyEth("Second");
                await sendEth();
                await postIncomingMessages(4, [await getEthMessage()], "Third exit eth");
                await getMyEth("Third");
            });

            it("calculate 2 exit eth cost per one message getMyEth by the end", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage()], "First 2 exit eth");
                await postIncomingMessages(2, [await getEthMessage(), await getEthMessage()], "Second 2 exit eth");
                await postIncomingMessages(4, [await getEthMessage()], "Third exit eth");
                await getMyEth("All");
            });

            it("calculate 2 exit eth cost per one message deposit each time getMyEth by the end", async () => {
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage()], "First 2 exit eth");
                await sendEth();
                await sendEth();
                await postIncomingMessages(2, [await getEthMessage(), await getEthMessage()], "Second 2 exit eth");
                await sendEth();
                await postIncomingMessages(4, [await getEthMessage()], "Third exit eth");
                await getMyEth("All");
            });

            it("calculate 3 exit eth cost per one message", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage(), await getEthMessage()], "First 3 exit eth");
                await getMyEth("First");
                await postIncomingMessages(3, [await getEthMessage(), await getEthMessage()], "Second 2 exit eth");
                await getMyEth("Second");
            });

            it("calculate 3 exit eth cost per one message deposit each time", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage(), await getEthMessage()], "First 3 exit eth");
                await getMyEth("First");
                await sendEth();
                await sendEth();
                await postIncomingMessages(3, [await getEthMessage(), await getEthMessage()], "Second 2 exit eth");
                await getMyEth("Second");
            });

            it("calculate 3 exit eth cost per one message getMyEth by the end", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage(), await getEthMessage()], "First 3 exit eth");
                await postIncomingMessages(3, [await getEthMessage(), await getEthMessage()], "Second 2 exit eth");
                await getMyEth("All");
            });

            it("calculate 3 exit eth cost per one message deposit each time getMyEth by the end", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage(), await getEthMessage()], "First 3 exit eth");
                await sendEth();
                await sendEth();
                await postIncomingMessages(3, [await getEthMessage(), await getEthMessage()], "Second 2 exit eth");
                await getMyEth("All");
            });

            it("calculate 4 exit eth cost per one message", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage(), await getEthMessage(), await getEthMessage()], "First 4 exit eth");
                await getMyEth("First");
                await postIncomingMessages(4, [await getEthMessage()], "Second exit eth");
                await getMyEth("Second");
            });

            it("calculate 4 exit eth cost per one message deposit each time", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage(), await getEthMessage(), await getEthMessage()], "First 4 exit eth");
                await getMyEth("First");
                await sendEth();
                await postIncomingMessages(4, [await getEthMessage()], "Second exit eth");
                await getMyEth("Second");
            });

            it("calculate 4 exit eth cost per one message getMyEth by the end", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage(), await getEthMessage(), await getEthMessage()], "First 4 exit eth");
                await postIncomingMessages(4, [await getEthMessage()], "Second exit eth");
                await getMyEth("All");
            });

            it("calculate 4 exit eth cost per one message deposit each time getMyEth by the end", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage(), await getEthMessage(), await getEthMessage()], "First 4 exit eth");
                await sendEth();
                await postIncomingMessages(4, [await getEthMessage()], "Second exit eth");
                await getMyEth("All");
            });

            it("calculate 5 exit eth cost per one message", async () => {
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await sendEth();
                await postIncomingMessages(0, [await getEthMessage(), await getEthMessage(), await getEthMessage(), await getEthMessage(), await getEthMessage()], "First 5 exit eth");
                await getMyEth("All");
            });
        });

        describe("ERC20 Token registered and approved", async () => {

            // prepare exit message of erc20 token - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, amount, {from: user});
            async function getERC20Message(amount: number) {
                return {
                    data: await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user.address, amount),
                    destinationContract: depositBoxERC20.address,
                    sender: tokenManagerERC20.address
                };
            }

            async function sendERC20(amount: number) {
                await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, amount);
            }

            async function checkBalance() {
                ((await ERC20TokenOnMainnet.balanceOf(user.address)).toString()).should.be.equal(BigNumber.from(5).toString());
            }

            beforeEach(async () => {
                await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(mainnetName,  ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
                await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
                await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);
            });

            afterEach(async() => {
                await checkBalance();
            });

            it("calculate 1 exit erc20 cost per one message", async () => {
                await sendERC20(5);
                await postIncomingMessages(0, [await getERC20Message(1)], "First exit erc20");
                await postIncomingMessages(1, [await getERC20Message(1)], "Second exit erc20");
                await postIncomingMessages(2, [await getERC20Message(1)], "Third exit erc20");
                await postIncomingMessages(3, [await getERC20Message(1)], "Forth exit erc20");
                await postIncomingMessages(4, [await getERC20Message(1)], "Fifth exit erc20");
            });

            it("calculate 1 exit erc20 cost per one message deposit each time", async () => {
                await sendERC20(1);
                await postIncomingMessages(0, [await getERC20Message(1)], "First exit erc20");
                await sendERC20(1);
                await postIncomingMessages(1, [await getERC20Message(1)], "Second exit erc20");
                await sendERC20(1);
                await postIncomingMessages(2, [await getERC20Message(1)], "Third exit erc20");
                await sendERC20(1);
                await postIncomingMessages(3, [await getERC20Message(1)], "Forth exit erc20");
                await sendERC20(1);
                await postIncomingMessages(4, [await getERC20Message(1)], "Fifth exit erc20");
            });

            it("calculate 2 exit erc20 cost per one message", async () => {
                await sendERC20(5);
                await postIncomingMessages(0, [await getERC20Message(1), await getERC20Message(1)], "First 2 exit erc20");
                await postIncomingMessages(2, [await getERC20Message(1), await getERC20Message(1)], "Second 2 exit erc20");
                await postIncomingMessages(4, [await getERC20Message(1)], "Third exit erc20");
            });

            it("calculate 2 exit erc20 cost per one message deposit each time", async () => {
                await sendERC20(1);
                await sendERC20(1);
                await postIncomingMessages(0, [await getERC20Message(1), await getERC20Message(1)], "First 2 exit erc20");
                await sendERC20(1);
                await sendERC20(1);
                await postIncomingMessages(2, [await getERC20Message(1), await getERC20Message(1)], "Second 2 exit erc20");
                await sendERC20(1);
                await postIncomingMessages(4, [await getERC20Message(1)], "Third exit erc20");
            });

            it("calculate 3 exit erc20 cost per one message", async () => {
                await sendERC20(5);
                await postIncomingMessages(0, [await getERC20Message(1), await getERC20Message(1), await getERC20Message(1)], "First 3 exit erc20");
                await postIncomingMessages(3, [await getERC20Message(1), await getERC20Message(1)], "Second 2 exit erc20");
            });

            it("calculate 3 exit erc20 cost per one message deposit each time", async () => {
                await sendERC20(1);
                await sendERC20(1);
                await sendERC20(1);
                await postIncomingMessages(0, [await getERC20Message(1), await getERC20Message(1), await getERC20Message(1)], "First 3 exit erc20");
                await sendERC20(1);
                await sendERC20(1);
                await postIncomingMessages(3, [await getERC20Message(1), await getERC20Message(1)], "Second 2 exit erc20");
            });

            it("calculate 4 exit erc20 cost per one message", async () => {
                await sendERC20(5);
                await postIncomingMessages(0, [await getERC20Message(1), await getERC20Message(1), await getERC20Message(1), await getERC20Message(1)], "First 4 exit erc20");
                await postIncomingMessages(4, [await getERC20Message(1)], "Second exit erc20");
            });

            it("calculate 4 exit erc20 cost per one message deposit each time", async () => {
                await sendERC20(1);
                await sendERC20(1);
                await sendERC20(1);
                await sendERC20(1);
                await postIncomingMessages(0, [await getERC20Message(1), await getERC20Message(1), await getERC20Message(1), await getERC20Message(1)], "First 4 exit erc20");
                await sendERC20(1);
                await postIncomingMessages(4, [await getERC20Message(1)], "Second exit erc20");
            });

            it("calculate 5 exit erc20 cost per one message", async () => {
                await sendERC20(5);
                await postIncomingMessages(0, [await getERC20Message(1), await getERC20Message(1), await getERC20Message(1), await getERC20Message(1), await getERC20Message(1)], "First 5 exit erc20");
            });
        });

        describe("ERC721 Token registered and approved", async() => {

            // prepare exit message of erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, tokenId, {from: user});
            async function getERC721Message(tokenId: number) {
                return {
                    data: await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, tokenId),
                    destinationContract: depositBoxERC721.address,
                    sender: tokenManagerERC721.address
                };
            }

            async function sendERC721(tokenId: number) {
                await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, tokenId);
            }

            async function checkBalance() {
                (await ERC721TokenOnMainnet.ownerOf(1)).should.be.equal(user.address);
                (await ERC721TokenOnMainnet.ownerOf(2)).should.be.equal(user.address);
                (await ERC721TokenOnMainnet.ownerOf(3)).should.be.equal(user.address);
                (await ERC721TokenOnMainnet.ownerOf(4)).should.be.equal(user.address);
                (await ERC721TokenOnMainnet.ownerOf(5)).should.be.equal(user.address);
            }

            beforeEach(async() => {
                await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(mainnetName,  ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
                await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);
                await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1);
                await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2);
                await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3);
                await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4);
                await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5);
            });

            afterEach(async() => {
                await checkBalance();
            });

            it("calculate 1 exit erc721 cost per one message", async () => {
                await sendERC721(1);
                await sendERC721(2);
                await sendERC721(3);
                await sendERC721(4);
                await sendERC721(5);
                await postIncomingMessages(0, [await getERC721Message(1)], "First exit erc721");
                await postIncomingMessages(1, [await getERC721Message(2)], "Second exit erc721");
                await postIncomingMessages(2, [await getERC721Message(3)], "Third exit erc721");
                await postIncomingMessages(3, [await getERC721Message(4)], "Forth exit erc721");
                await postIncomingMessages(4, [await getERC721Message(5)], "Fifth exit erc721");
            });

            it("calculate 1 exit erc721 cost per one message deposit each time", async () => {
                await sendERC721(1);
                await postIncomingMessages(0, [await getERC721Message(1)], "First exit erc721");
                await sendERC721(2);
                await postIncomingMessages(1, [await getERC721Message(2)], "Second exit erc721");
                await sendERC721(3);
                await postIncomingMessages(2, [await getERC721Message(3)], "Third exit erc721");
                await sendERC721(4);
                await postIncomingMessages(3, [await getERC721Message(4)], "Forth exit erc721");
                await sendERC721(5);
                await postIncomingMessages(4, [await getERC721Message(5)], "Fifth exit erc721");
            });

            it("calculate 2 exit erc721 cost per one message", async () => {
                await sendERC721(1);
                await sendERC721(2);
                await sendERC721(3);
                await sendERC721(4);
                await sendERC721(5);
                await postIncomingMessages(0, [await getERC721Message(1), await getERC721Message(2)], "First 2 exit erc721");
                await postIncomingMessages(2, [await getERC721Message(3), await getERC721Message(4)], "Second 2 exit erc721");
                await postIncomingMessages(4, [await getERC721Message(5)], "Third exit erc721");
            });

            it("calculate 2 exit erc721 cost per one message deposit each time", async () => {
                await sendERC721(1);
                await sendERC721(2);
                await postIncomingMessages(0, [await getERC721Message(1), await getERC721Message(2)], "First 2 exit erc721");
                await sendERC721(3);
                await sendERC721(4);
                await postIncomingMessages(2, [await getERC721Message(3), await getERC721Message(4)], "Second 2 exit erc721");
                await sendERC721(5);
                await postIncomingMessages(4, [await getERC721Message(5)], "Third exit erc721");
            });

            it("calculate 3 exit erc721 cost per one message", async () => {
                await sendERC721(1);
                await sendERC721(2);
                await sendERC721(3);
                await sendERC721(4);
                await sendERC721(5);
                await postIncomingMessages(0, [await getERC721Message(1), await getERC721Message(2), await getERC721Message(3)], "First 3 exit erc721");
                await postIncomingMessages(3, [await getERC721Message(4), await getERC721Message(5)], "Second 2 exit erc721");
            });

            it("calculate 3 exit erc721 cost per one message deposit each time", async () => {
                await sendERC721(1);
                await sendERC721(2);
                await sendERC721(3);
                await postIncomingMessages(0, [await getERC721Message(1), await getERC721Message(2), await getERC721Message(3)], "First 3 exit erc721");
                await sendERC721(4);
                await sendERC721(5);
                await postIncomingMessages(3, [await getERC721Message(4), await getERC721Message(5)], "Second 2 exit erc721");
            });

            it("calculate 4 exit erc721 cost per one message", async () => {
                await sendERC721(1);
                await sendERC721(2);
                await sendERC721(3);
                await sendERC721(4);
                await sendERC721(5);
                await postIncomingMessages(0, [await getERC721Message(1), await getERC721Message(2), await getERC721Message(3), await getERC721Message(4)], "First 4 exit erc721");
                await postIncomingMessages(4, [await getERC721Message(5)], "Second exit erc721");
            });

            it("calculate 4 exit erc721 cost per one message deposit each time", async () => {
                await sendERC721(1);
                await sendERC721(2);
                await sendERC721(3);
                await sendERC721(4);
                await postIncomingMessages(0, [await getERC721Message(1), await getERC721Message(2), await getERC721Message(3), await getERC721Message(4)], "First 4 exit erc721");
                await sendERC721(5);
                await postIncomingMessages(4, [await getERC721Message(5)], "Second exit erc721");
            });

            it("calculate 5 exit erc721 cost per one message", async () => {
                await sendERC721(1);
                await sendERC721(2);
                await sendERC721(3);
                await sendERC721(4);
                await sendERC721(5);
                await postIncomingMessages(0, [await getERC721Message(1), await getERC721Message(2), await getERC721Message(3), await getERC721Message(4), await getERC721Message(5)], "First 5 exit erc721");
            });
        });

        describe("ERC1155 Token registered and approved", async() => {

            // prepare exit message of erc1155 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, tokenId, amount, {from: user});
            async function getERC1155Message(tokenId: number, amount: number) {
                return {
                    data: await messages.encodeTransferErc1155Message(ERC1155TokenOnMainnet.address, user.address, tokenId, amount),
                    destinationContract: depositBoxERC1155.address,
                    sender: tokenManagerERC1155.address
                };
            }

            // prepare exit batch message of erc1155 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, tokenId, amounts, {from: user});
            async function getERC1155BatchMessage(tokenIds: number[], amounts: number[]) {
                return {
                    data: await messages.encodeTransferErc1155BatchMessage(ERC1155TokenOnMainnet.address, user.address, tokenIds, amounts),
                    destinationContract: depositBoxERC1155.address,
                    sender: tokenManagerERC1155.address
                };
            }

            async function sendERC1155(tokenId: number, amount: number) {
                await depositBoxERC1155.connect(user).depositERC1155(schainName, ERC1155TokenOnMainnet.address, tokenId, amount);
            }

            async function sendERC1155Batch(tokenIds: number[], amounts: number[]) {
                await depositBoxERC1155.connect(user).depositERC1155Batch(schainName, ERC1155TokenOnMainnet.address, tokenIds, amounts);
            }

            async function checkBalance() {
                const balanceIds = await ERC1155TokenOnMainnet.balanceOfBatch([user.address, user.address, user.address, user.address, user.address], [1, 2, 3, 4, 5]);
                const balanceIdsNumber: number[] = [];
                balanceIds.forEach((element) => {
                    balanceIdsNumber.push(BigNumber.from(element).toNumber())
                });
                expect(balanceIdsNumber).to.deep.equal([1, 2, 3, 4, 5]);
            }

            beforeEach(async() => {
                await tokenManagerERC1155.connect(schainOwner).addERC1155TokenByOwner(mainnetName,  ERC1155TokenOnMainnet.address, ERC1155TokenOnSchain.address);
                await depositBoxERC1155.connect(schainOwner).addERC1155TokenByOwner(schainName, ERC1155TokenOnMainnet.address);
                await ERC1155TokenOnMainnet.connect(user).setApprovalForAll(depositBoxERC1155.address, true);
            });

            afterEach(async() => {
                await checkBalance();
            });

            it("calculate 1 exit erc1155 cost per one message", async () => {
                await sendERC1155(1, 1);
                await sendERC1155(2, 2);
                await sendERC1155(3, 3);
                await sendERC1155(4, 4);
                await sendERC1155(5, 5);
                await postIncomingMessages(0, [await getERC1155Message(1, 1)], "First exit erc1155");
                await postIncomingMessages(1, [await getERC1155Message(2, 2)], "Second exit erc1155");
                await postIncomingMessages(2, [await getERC1155Message(3, 3)], "Third exit erc1155");
                await postIncomingMessages(3, [await getERC1155Message(4, 4)], "Forth exit erc1155");
                await postIncomingMessages(4, [await getERC1155Message(5, 5)], "Fifth exit erc1155");
            });

            it("calculate 1 exit erc1155 cost per one message deposit each time", async () => {
                await sendERC1155(1, 1);
                await postIncomingMessages(0, [await getERC1155Message(1, 1)], "First exit erc1155");
                await sendERC1155(2, 2);
                await postIncomingMessages(1, [await getERC1155Message(2, 2)], "Second exit erc1155");
                await sendERC1155(3, 3);
                await postIncomingMessages(2, [await getERC1155Message(3, 3)], "Third exit erc1155");
                await sendERC1155(4, 4);
                await postIncomingMessages(3, [await getERC1155Message(4, 4)], "Forth exit erc1155");
                await sendERC1155(5, 5);
                await postIncomingMessages(4, [await getERC1155Message(5, 5)], "Fifth exit erc1155");
            });

            it("calculate 2 exit erc1155 cost per one message", async () => {
                await sendERC1155(1, 1);
                await sendERC1155(2, 2);
                await sendERC1155(3, 3);
                await sendERC1155(4, 4);
                await sendERC1155(5, 5);
                await postIncomingMessages(0, [await getERC1155Message(1, 1), await getERC1155Message(2, 2)], "First 2 exit erc1155");
                await postIncomingMessages(2, [await getERC1155Message(3, 3), await getERC1155Message(4, 4)], "Second 2 exit erc1155");
                await postIncomingMessages(4, [await getERC1155Message(5, 5)], "Third exit erc1155");
            });

            it("calculate 2 exit erc1155 cost per one message deposit each time", async () => {
                await sendERC1155(1, 1);
                await sendERC1155(2, 2);
                await postIncomingMessages(0, [await getERC1155Message(1, 1), await getERC1155Message(2, 2)], "First 2 exit erc1155");
                await sendERC1155(3, 3);
                await sendERC1155(4, 4);
                await postIncomingMessages(2, [await getERC1155Message(3, 3), await getERC1155Message(4, 4)], "Second 2 exit erc1155");
                await sendERC1155(5, 5);
                await postIncomingMessages(4, [await getERC1155Message(5, 5)], "Third exit erc1155");
            });

            it("calculate 3 exit erc1155 cost per one message", async () => {
                await sendERC1155(1, 1);
                await sendERC1155(2, 2);
                await sendERC1155(3, 3);
                await sendERC1155(4, 4);
                await sendERC1155(5, 5);
                await postIncomingMessages(0, [await getERC1155Message(1, 1), await getERC1155Message(2, 2), await getERC1155Message(3, 3)], "First 3 exit erc1155");
                await postIncomingMessages(3, [await getERC1155Message(4, 4), await getERC1155Message(5, 5)], "Second 2 exit erc1155");
            });

            it("calculate 3 exit erc1155 cost per one message deposit each time", async () => {
                await sendERC1155(1, 1);
                await sendERC1155(2, 2);
                await sendERC1155(3, 3);
                await postIncomingMessages(0, [await getERC1155Message(1, 1), await getERC1155Message(2, 2), await getERC1155Message(3, 3)], "First 3 exit erc1155");
                await sendERC1155(4, 4);
                await sendERC1155(5, 5);
                await postIncomingMessages(3, [await getERC1155Message(4, 4), await getERC1155Message(5, 5)], "Second 2 exit erc1155");
            });

            it("calculate 4 exit erc1155 cost per one message", async () => {
                await sendERC1155(1, 1);
                await sendERC1155(2, 2);
                await sendERC1155(3, 3);
                await sendERC1155(4, 4);
                await sendERC1155(5, 5);
                await postIncomingMessages(0, [await getERC1155Message(1, 1), await getERC1155Message(2, 2), await getERC1155Message(3, 3), await getERC1155Message(4, 4)], "First 4 exit erc1155");
                await postIncomingMessages(4, [await getERC1155Message(5, 5)], "Second exit erc1155");
            });

            it("calculate 4 exit erc1155 cost per one message deposit each time", async () => {
                await sendERC1155(1, 1);
                await sendERC1155(2, 2);
                await sendERC1155(3, 3);
                await sendERC1155(4, 4);
                await postIncomingMessages(0, [await getERC1155Message(1, 1), await getERC1155Message(2, 2), await getERC1155Message(3, 3), await getERC1155Message(4, 4)], "First 4 exit erc1155");
                await sendERC1155(5, 5);
                await postIncomingMessages(4, [await getERC1155Message(5, 5)], "Second exit erc1155");
            });

            it("calculate 5 exit erc1155 cost per one message", async () => {
                await sendERC1155(1, 1);
                await sendERC1155(2, 2);
                await sendERC1155(3, 3);
                await sendERC1155(4, 4);
                await sendERC1155(5, 5);
                await postIncomingMessages(0, [await getERC1155Message(1, 1), await getERC1155Message(2, 2), await getERC1155Message(3, 3), await getERC1155Message(4, 4), await getERC1155Message(5, 5)], "First 5 exit erc1155");
            });

            it("calculate exit erc1155 batch 2 cost per one message", async () => {
                await sendERC1155Batch([1, 2], [1, 2]);
                await postIncomingMessages(0, [await getERC1155BatchMessage([1, 2], [1, 2])], "First exit erc1155 batch");
            });

            it("calculate exit erc1155 batch 3 cost per one message", async () => {
                await sendERC1155Batch([1, 2, 3], [1, 2, 3]);
                await postIncomingMessages(0, [await getERC1155BatchMessage([1, 2, 3], [1, 2, 3])], "First exit erc1155 batch");
            });

            it("calculate exit erc1155 batch 4 cost per one message", async () => {
                await sendERC1155Batch([1, 2, 3, 4], [1, 2, 3, 4]);
                await postIncomingMessages(0, [await getERC1155BatchMessage([1, 2, 3, 4], [1, 2, 3, 4])], "First exit erc1155 batch");
            });

            it("calculate exit erc1155 batch 5 cost per one message", async () => {
                await sendERC1155Batch([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
                await postIncomingMessages(0, [await getERC1155BatchMessage([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])], "First exit erc1155 batch");
            });
        });
    });
});
