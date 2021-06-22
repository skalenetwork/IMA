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
    ERC20OnChain,
    ERC721OnChain,
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
    TokenManagerLinker,
    Wallets,
    Linker,
} from "../typechain";

chai.should();
chai.use((chaiAsPromised as any));

import { deployLinker } from "../test/utils/deploy/mainnet/linker";
import { deployDepositBoxEth } from "../test/utils/deploy/mainnet/depositBoxEth";
import { deployDepositBoxERC20 } from "../test/utils/deploy/mainnet/depositBoxERC20";
import { deployDepositBoxERC721 } from "../test/utils/deploy/mainnet/depositBoxERC721";
import { deployMessageProxyForMainnet } from "../test/utils/deploy/mainnet/messageProxyForMainnet";

import { deployEthErc20 } from "../test/utils/deploy/schain/ethErc20";
import { deployERC20OnChain } from "../test/utils/deploy/erc20OnChain";
import { deployERC721OnChain } from "../test/utils/deploy/erc721OnChain";

import { deployContractManager } from "../test/utils/skale-manager-utils/contractManager";
// import { deployContractManager } from "../test/utils/skale-manager-utils/keyStorage";
// const KeyStorage: KeyStorageContract = artifacts.require("./KeyStorage");
// const Nodes: NodesContract = artifacts.require("./Nodes");
// const Schains: SchainsContract = artifacts.require("./Schains");
// const SchainsInternal: SchainsInternalContract = artifacts.require("./SchainsInternal");
// const SkaleVerifierMock: SkaleVerifierMockContract = artifacts.require("./SkaleVerifierMock");
// const Wallets: WalletsContract = artifacts.require("./Wallets");

import { deployTokenManagerLinker } from "../test/utils/deploy/schain/tokenManagerLinker";
import { deployTokenManagerEth } from "../test/utils/deploy/schain/tokenManagerEth";
import { deployTokenManagerERC20 } from "../test/utils/deploy/schain/tokenManagerERC20";
import { deployTokenManagerERC721 } from "../test/utils/deploy/schain/tokenManagerERC721";
import { deployMessageProxyForSchain } from "../test/utils/deploy/schain/messageProxyForSchain";
import { deployMessages } from "../test/utils/deploy/messages";

import { randomString, stringValue } from "../test/utils/helper";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, BytesLike } from "ethers";

import { assert, expect } from "chai";
import { deployCommunityLocker } from "../test/utils/deploy/schain/communityLocker";
import { deployCommunityPool } from "../test/utils/deploy/mainnet/communityPool";
// import { LockAndDataForSchain } from "../typechain/LockAndDataForSchain";

describe("Gas calculation", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

    let imaLinker: Linker;
    let depositBoxEth: DepositBoxEth;
    let depositBoxERC20: DepositBoxERC20;
    let depositBoxERC721: DepositBoxERC721;
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
    let tokenManagerLinker: TokenManagerLinker;
    let communityLocker: CommunityLocker;
    let ethERC20: EthErc20;
    let messageProxyForSchain: MessageProxyForSchain;
    let messages: MessagesTester;

    let ERC20TokenOnMainnet: ERC20OnChain;
    let ERC20TokenOnSchain: ERC20OnChain;
    let ERC721TokenOnMainnet: ERC721OnChain;
    let ERC721TokenOnSchain: ERC721OnChain;

    const schainName = "GasCalculation";
    const schainNameHash = web3.utils.soliditySha3("GasCalculation");
    const contractManagerAddress = "0x0000000000000000000000000000000000000000";

    before(async () => {
        [deployer, schainOwner, user] = await ethers.getSigners();
    })

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

        const nodePublicKey: [BytesLike, BytesLike] = [
            "0x1122334455667788990011223344556677889900112233445566778899001122",
            "0x1122334455667788990011223344556677889900112233445566778899001122"
        ];

        // setup 16 nodes
        const nodeCreationParams = {
            port: 1337,
            nonce: 1337,
            ip: "0x12345678",
            publicIp: "0x12345678",
            publicKey: nodePublicKey,
            name: "GasCalculationNode",
            domainName: "gascalculationnode.com"
        };
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);
        await nodes.connect(deployer).createNode(deployer.address, nodeCreationParams);

        // initialize schain and data
        await schainsInternal.connect(deployer).initializeSchain(schainName, schainOwner.address, 12345678, 12345678);
        await schainsInternal.connect(deployer).addNodesToSchainsGroups(stringValue(schainNameHash), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

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
        await keyStorage.connect(deployer).setBlsCommonPublicKeyForSchain(stringValue(schainNameHash), BLSPublicKey);
        // await wallets.rechargeSchainWallet(stringValue(schainNameHash), {value: "1000000000000000000"});

        // IMA mainnet part deployment
        messageProxyForMainnet = await deployMessageProxyForMainnet(contractManager);
        imaLinker = await deployLinker(contractManager, messageProxyForMainnet);
        communityPool = await deployCommunityPool(contractManager, imaLinker, messageProxyForMainnet);
        depositBoxEth = await deployDepositBoxEth(contractManager, imaLinker, messageProxyForMainnet);
        depositBoxERC20 = await deployDepositBoxERC20(contractManager, imaLinker, messageProxyForMainnet);
        depositBoxERC721 = await deployDepositBoxERC721(contractManager, imaLinker, messageProxyForMainnet);
        const extraContractRegistrarRole = await messageProxyForMainnet.EXTRA_CONTRACT_REGISTRAR_ROLE();
        await messageProxyForMainnet.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
        await messageProxyForMainnet.registerExtraContractForAll(depositBoxEth.address)
        await messageProxyForMainnet.registerExtraContractForAll(depositBoxERC20.address)
        await messageProxyForMainnet.registerExtraContractForAll(depositBoxERC721.address)
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
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerEth.address)
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC20.address)
        await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721.address)
        await messageProxyForSchain.registerExtraContractForAll(communityLocker.address)

        ethERC20 = await deployEthErc20(tokenManagerEth);
        await tokenManagerEth.connect(deployer).setEthErc20Address(ethERC20.address);
        const chainConnectorRole = await messageProxyForSchain.CHAIN_CONNECTOR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(chainConnectorRole, tokenManagerLinker.address);
        await tokenManagerERC20.connect(deployer).grantRole(await tokenManagerERC20.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        await tokenManagerERC721.connect(deployer).grantRole(await tokenManagerERC721.TOKEN_REGISTRAR_ROLE(), schainOwner.address);

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
        await imaLinker.connectSchain(schainName, [tokenManagerLinker.address, communityLocker.address, tokenManagerEth.address, tokenManagerERC20.address, tokenManagerERC721.address]);
        await communityPool.connect(user).rechargeUserWallet(schainName, { value: 1e18.toString() });
        // await lockAndDataForSchain.addDepositBox(depositBoxEth.address);
        // await lockAndDataForSchain.addDepositBox(depositBoxERC20.address);
        // await lockAndDataForSchain.addDepositBox(depositBoxERC721.address);

        // Deploy test tokens
        ERC20TokenOnMainnet = await deployERC20OnChain("GCERC20", "GCE");
        ERC20TokenOnSchain = await deployERC20OnChain("GCERC20Clone", "GCEC");
        ERC721TokenOnMainnet = await deployERC721OnChain("GCERC721", "GCE");
        ERC721TokenOnSchain = await deployERC721OnChain("GCERC721Clone", "GCEC");

        // Mint tokens and grant minter role
        await ERC20TokenOnMainnet.mint(user.address, 100000);
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

        // register user
        await communityPool.connect(user).rechargeUserWallet(schainName, {value: "1000000000000000000"});
    });

    it("calculate eth deposits", async () => {
        let res = await (await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"})).wait();
        console.log("First deposit eth cost:", res.gasUsed.toNumber());
        res = await (await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"})).wait();
        console.log("Second deposit eth cost:", res.gasUsed.toNumber());
        res = await (await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"})).wait();
        console.log("Third deposit eth cost:", res.gasUsed.toNumber());
        res = await (await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"})).wait();
        console.log("Forth deposit eth cost:", res.gasUsed.toNumber());
        res = await (await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"})).wait();
        console.log("Fifth deposit eth cost:", res.gasUsed.toNumber());
    });

    it("calculate registration and approve ERC20", async () => {
        // register tokens
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        let res = await (await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address)).wait();
        console.log("Registration of ERC20 token cost:", res.gasUsed.toNumber());
        res = await (await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5)).wait();
        console.log("First approve of ERC20 token cost:", res.gasUsed.toNumber());
        res = await (await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 10)).wait();
        console.log("Second approve of ERC20 token cost:", res.gasUsed.toNumber());
    });

    it("calculate erc20 deposits without eth without automatic deploy", async () => {
        // register tokens
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
        await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 6);

        let res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1)).wait();
        console.log("First deposit erc20 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1)).wait();
        console.log("Second deposit erc20 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1)).wait();
        console.log("Third deposit erc20 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1)).wait();
        console.log("Forth deposit erc20 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1)).wait();
        console.log("Fifth deposit erc20 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1)).wait();
        console.log("Deposit all remaining approved erc20 tokens cost:", res.gasUsed.toNumber());
    });

    it("calculate erc20 deposits of all approved tokens without eth without automatic deploy", async () => {
        // register tokens
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
        await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

        const res = await (await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 5)).wait();
        console.log("Deposit all approved erc20 tokens at once cost:", res.gasUsed.toNumber());
    });

    it("calculate registration and approve ERC721", async () => {
        // register tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        let res = await (await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address)).wait();
        console.log("Registration of ERC721 token cost:", res.gasUsed.toNumber());
        res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1)).wait();
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
        // register tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);
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

        let res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 1)).wait();
        console.log("First deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 2)).wait();
        console.log("Second deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 3)).wait();
        console.log("Third deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 4)).wait();
        console.log("Forth deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 5)).wait();
        console.log("Fifth deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 6)).wait();
        console.log("Sixth deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 7)).wait();
        console.log("Seventh deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 8)).wait();
        console.log("Eighth deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 9)).wait();
        console.log("Ninth deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 10)).wait();
        console.log("Tenth deposit erc721 cost:", res.gasUsed.toNumber());
    });

    it("calculate erc721 deposits without eth without automatic deploy and transfer each time", async () => {
        // register tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);

        let res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1)).wait();
        console.log("First transfer of ERC721 token cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 1)).wait();
        console.log("First deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2)).wait();
        console.log("Second transfer of ERC721 token cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 2)).wait();
        console.log("Second deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3)).wait();
        console.log("Third transfer of ERC721 token cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 3)).wait();
        console.log("Third deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4)).wait();
        console.log("Forth transfer of ERC721 token cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 4)).wait();
        console.log("Forth deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5)).wait();
        console.log("Fifth transfer of ERC721 token cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 5)).wait();
        console.log("Fifth deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 6)).wait();
        console.log("Sixth transfer of ERC721 token cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 6)).wait();
        console.log("Sixth deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 7)).wait();
        console.log("Seventh transfer of ERC721 token cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 7)).wait();
        console.log("Seventh deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 8)).wait();
        console.log("Eighth transfer of ERC721 token cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 8)).wait();
        console.log("Eighth deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 9)).wait();
        console.log("Ninth transfer of ERC721 token cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 9)).wait();
        console.log("Ninth deposit erc721 cost:", res.gasUsed.toNumber());
        res = await (await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 10)).wait();
        console.log("Tenth transfer of ERC721 token cost:", res.gasUsed.toNumber());
        res = await (await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 10)).wait();
        console.log("Tenth deposit erc721 cost:", res.gasUsed.toNumber());
    });

    it("calculate 1 exit eth cost per one message", async () => {
        // make several deposits
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});

        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        )).wait();
        // console.log("First exit eth cost:", res.gasUsed.toNumber());
        // // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("First getMyEth eth cost:", res.gasUsed.toNumber());
        // res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
        //     schainName,
        //     1,
        //     [message],
        //     sign,
        //     5
        // )).wait();
        // console.log("Second exit eth cost:", res.gasUsed.toNumber());
        // // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Second getMyEth eth cost:", res.gasUsed.toNumber());
        // res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
        //     schainName,
        //     2,
        //     [message],
        //     sign,
        //     5
        // )).wait();
        // console.log("Third exit eth cost:", res.gasUsed.toNumber());
        // // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Third getMyEth eth cost:", res.gasUsed.toNumber());
        // res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
        //     schainName,
        //     3,
        //     [message],
        //     sign,
        //     5
        // )).wait();
        // console.log("Forth exit eth cost:", res.gasUsed.toNumber());
        // // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Forth getMyEth eth cost:", res.gasUsed.toNumber());
        // res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
        //     schainName,
        //     4,
        //     [message],
        //     sign,
        //     5
        // )).wait();
        // console.log("Fifth exit eth cost:", res.gasUsed.toNumber());
        // // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Fifth getMyEth eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 1 exit eth cost per one message deposit each time", async () => {
        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        )).wait();
        console.log("First exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("First getMyEth eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            1,
            [message],
            sign
        )).wait();
        console.log("Second exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Second getMyEth eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message],
            sign
        )).wait();
        console.log("Third exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Third getMyEth eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message],
            sign
        )).wait();
        console.log("Forth exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Forth getMyEth eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Fifth exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Fifth getMyEth eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 1 exit eth cost per one message getMyEth by the end", async () => {
        // make several deposits
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});

        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        )).wait();
        console.log("First exit eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            1,
            [message],
            sign
        )).wait();
        console.log("Second exit eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message],
            sign
        )).wait();
        console.log("Third exit eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message],
            sign
        )).wait();
        console.log("Forth exit eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Fifth exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("getMyEth all eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 1 exit eth cost per one message deposit each time getMyEth by the end", async () => {
        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        )).wait();
        console.log("First exit eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            1,
            [message],
            sign
        )).wait();
        console.log("Second exit eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message],
            sign
        )).wait();
        console.log("Third exit eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message],
            sign
        )).wait();
        console.log("Forth exit eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Fifth exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("getMyEth all eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 2 exit eth cost per one message", async () => {
        // make several deposits
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});

        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message],
            sign
        )).wait();
        console.log("First 2 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("First getMyEth eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Second getMyEth eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Third  exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Third getMyEth eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 2 exit eth cost per one message deposit each time", async () => {
        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message],
            sign
        )).wait();
        console.log("First 2 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("First getMyEth eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Second getMyEth eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Third exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Third getMyEth eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 2 exit eth cost per one message getMyEth by the end", async () => {
        // make several deposits
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});

        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message],
            sign
        )).wait();
        console.log("First 2 exit eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Third exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("getMyEth all eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 2 exit eth cost per one message deposit each time getMyEth by the end", async () => {
        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message],
            sign
        )).wait();
        console.log("First 2 exit eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Third exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("getMyEth all eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 3 exit eth cost per one message", async () => {
        // make several deposits
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});

        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message],
            sign
        )).wait();
        console.log("First 3 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("First getMyEth eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Second getMyEth eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 3 exit eth cost per one message deposit each time", async () => {
        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message],
            sign
        )).wait();
        console.log("First 3 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("First getMyEth eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Second getMyEth eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 3 exit eth cost per one message getMyEth by the end", async () => {
        // make several deposits
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});

        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message],
            sign
        )).wait();
        console.log("First 3 exit eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("getMyEth all eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 3 exit eth cost per one message deposit each time getMyEth by the end", async () => {
        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message],
            sign
        )).wait();
        console.log("First 3 exit eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("getMyEth all eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 4 exit eth cost per one message", async () => {
        // make several deposits
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});

        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message, message],
            sign
        )).wait();
        console.log("First 4 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("First getMyEth eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Second exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Second getMyEth eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 4 exit eth cost per one message deposit each time", async () => {
        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };;

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message, message],
            sign
        )).wait();
        console.log("First 4 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("First getMyEth eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Second exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("Second getMyEth eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 4 exit eth cost per one message getMyEth by the end", async () => {
        // make several deposits
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});

        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message, message],
            sign
        )).wait();
        console.log("First 4 exit eth cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Second exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // console.log("getMyEth all eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 4 exit eth cost per one message deposit each time getMyEth by the end", async () => {
        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message, message],
            sign
        )).wait();
        console.log("First 4 exit eth cost:", res.gasUsed.toNumber());
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Second exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // // console.log("getMyEth all eth cost:", res.gasUsed.toNumber());
    });

    it("calculate 5 exit eth cost per one message", async () => {
        // make several deposits
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});
        await depositBoxEth.connect(user).deposit(schainName, user.address, {value: "1000000000000000000"});

        // prepare exit message of 1 eth - await tokenManager.exitToMainEth(user.address, {value: "1000000000000000000", from: user});
        const message = {
            data: await messages.encodeTransferEthMessage(user.address, "1000000000000000000"),
            destinationContract: depositBoxEth.address,
            sender: tokenManagerEth.address,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message, message, message],
            sign
        )).wait();
        console.log("First 5 exit eth cost:", res.gasUsed.toNumber());
        // res = await (await depositBoxEth.connect(user).getMyEth()).wait();
        // // console.log("getMyEth all eth cost:", res.gasUsed.toNumber());
    });

    // ERC20:

    function zeroAfterAddress(address: string) {
        const len = address.length;
        if (len === 40) {
            return address + "000000000000000000000000";
        } else if (len === 42 && address.slice(0, 2) === "0x") {
            return  address.slice(2) + "000000000000000000000000";
        } else {
            return "0000000000000000000000000000000000000000000000000000000000000000";
        }
    }

    it("calculate 1 exit erc20 cost per one message", async () => {
        // make erc20 deposits
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
        await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 5);

        // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user.address, 1);
        const message = {
            amount: "1000000000000000000",
            data: dataOfERC20,
            destinationContract: depositBoxERC20.address,
            sender: tokenManagerERC20.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        )).wait();
        console.log("First exit erc20 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            1,
            [message],
            sign
        )).wait();
        console.log("Second exit erc20 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message],
            sign
        )).wait();
        console.log("Third exit erc20 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message],
            sign
        )).wait();
        console.log("Forth exit erc20 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Fifth exit erc20 cost:", res.gasUsed.toNumber());
    });

    it("calculate 1 exit erc20 cost per one message deposit each time", async () => {
        // register erc20
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
        await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

        // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user.address, 1);
        const message = {
            amount: "1000000000000000000",
            data: dataOfERC20,
            destinationContract: depositBoxERC20.address,
            sender: tokenManagerERC20.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        )).wait();
        console.log("First exit erc20 cost:", res.gasUsed.toNumber());
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            1,
            [message],
            sign
        )).wait();
        console.log("Second exit erc20 cost:", res.gasUsed.toNumber());
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message],
            sign
        )).wait();
        console.log("Third exit erc20 cost:", res.gasUsed.toNumber());
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message],
            sign
        )).wait();
        console.log("Forth exit erc20 cost:", res.gasUsed.toNumber());
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Fifth exit erc20 cost:", res.gasUsed.toNumber());
    });

    it("calculate 2 exit erc20 cost per one message", async () => {
        // make erc20 deposits
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
        await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 5);

        // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user.address, 1);
        const message = {
            amount: "1000000000000000000",
            data: dataOfERC20,
            destinationContract: depositBoxERC20.address,
            sender: tokenManagerERC20.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message],
            sign
        )).wait();
        console.log("First 2 exit erc20 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit erc20 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Third exit erc20 cost:", res.gasUsed.toNumber());
    });

    it("calculate 2 exit erc20 cost per one message deposit each time", async () => {
        // register erc20
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
        await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

        // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user.address, 1);
        const message = {
            amount: "1000000000000000000",
            data: dataOfERC20,
            destinationContract: depositBoxERC20.address,
            sender: tokenManagerERC20.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message],
            sign
        )).wait();
        console.log("First 2 exit erc20 cost:", res.gasUsed.toNumber());
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit erc20 cost:", res.gasUsed.toNumber());
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Third exit erc20 cost:", res.gasUsed.toNumber());
    });

    it("calculate 3 exit erc20 cost per one message", async () => {
        // make erc20 deposits
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
        await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 5);

        // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user.address, 1);
        const message = {
            amount: "1000000000000000000",
            data: dataOfERC20,
            destinationContract: depositBoxERC20.address,
            sender: tokenManagerERC20.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message],
            sign
        )).wait();
        console.log("First 3 exit erc20 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit erc20 cost:", res.gasUsed.toNumber());
    });

    it("calculate 3 exit erc20 cost per one message deposit each time", async () => {
        // register erc20
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
        await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

        // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user.address, 1);
        const message = {
            amount: "1000000000000000000",
            data: dataOfERC20,
            destinationContract: depositBoxERC20.address,
            sender: tokenManagerERC20.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message],
            sign
        )).wait();
        console.log("First 3 exit erc20 cost:", res.gasUsed.toNumber());
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message, message],
            sign
        )).wait();
        console.log("Second 2 exit erc20 cost:", res.gasUsed.toNumber());
    });

    it("calculate 4 exit erc20 cost per one message", async () => {
        // make erc20 deposits
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
        await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 5);

        // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user.address, 1);
        const message = {
            amount: "1000000000000000000",
            data: dataOfERC20,
            destinationContract: depositBoxERC20.address,
            sender: tokenManagerERC20.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message, message],
            sign
        )).wait();
        console.log("First 4 exit erc20 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Second exit erc20 cost:", res.gasUsed.toNumber());
    });

    it("calculate 4 exit erc20 cost per one message deposit each time", async () => {
        // register erc20
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
        await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

        // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user.address, 1);
        const message = {
            amount: "1000000000000000000",
            data: dataOfERC20,
            destinationContract: depositBoxERC20.address,
            sender: tokenManagerERC20.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message, message],
            sign
        )).wait();
        console.log("First 4 exit erc20 cost:", res.gasUsed.toNumber());
        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 1);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message],
            sign
        )).wait();
        console.log("Second exit erc20 cost:", res.gasUsed.toNumber());
    });

    it("calculate 5 exit erc20 cost per one message", async () => {
        // make erc20 deposits
        await tokenManagerERC20.connect(schainOwner).addERC20TokenByOwner(ERC20TokenOnMainnet.address, ERC20TokenOnSchain.address);
        await depositBoxERC20.connect(schainOwner).addERC20TokenByOwner(schainName, ERC20TokenOnMainnet.address);
        await ERC20TokenOnMainnet.connect(user).approve(depositBoxERC20.address, 5);

        await depositBoxERC20.connect(user).depositERC20(schainName, ERC20TokenOnMainnet.address, user.address, 5);

        // prepare exit message of 1 erc20 - await TokenManager.exitToMainERC20(ERC20TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC20 = await messages.encodeTransferErc20Message(ERC20TokenOnMainnet.address, user.address, 1);
        const message = {
            amount: "1000000000000000000",
            data: dataOfERC20,
            destinationContract: depositBoxERC20.address,
            sender: tokenManagerERC20.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        const res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message, message, message, message, message],
            sign
        )).wait();
        console.log("First 5 exit erc20 cost:", res.gasUsed.toNumber());
    });

    // // ERC721

    it("calculate 1 exit erc721 cost per one message", async () => {
        // register ERC721 tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5);

        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 1);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 2);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 3);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 4);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 5);

        // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 1);
        const message1 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken1,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 2, "1000000000000000000", {from: user});
        const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 2);
        const message2 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken2,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 3, "1000000000000000000", {from: user});
        const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 3);
        const message3 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken3,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 4, "1000000000000000000", {from: user});
        const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 4);
        const message4 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken4,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 5, "1000000000000000000", {from: user});
        const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 5);
        const message5 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken5,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message1],
            sign
        )).wait();
        console.log("First exit erc721 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            1,
            [message2],
            sign
        )).wait();
        console.log("Second exit erc721 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message3],
            sign
        )).wait();
        console.log("Third exit erc721 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message4],
            sign
        )).wait();
        console.log("Forth exit erc721 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message5],
            sign
        )).wait();
        console.log("Fifth exit erc721 cost:", res.gasUsed.toNumber());
    });

    it("calculate 1 exit erc721 cost per one message deposit each time", async () => {
        // register ERC721 tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5);

        // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 1);
        const message1 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken1,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 2, "1000000000000000000", {from: user});
        const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 2);
        const message2 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken2,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 3, "1000000000000000000", {from: user});
        const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 3);
        const message3 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken3,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 4, "1000000000000000000", {from: user});
        const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 4);
        const message4 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken4,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 5, "1000000000000000000", {from: user});
        const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 5);
        const message5 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken5,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 1);
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message1],
            sign
        )).wait();
        console.log("First exit erc721 cost:", res.gasUsed.toNumber());
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 2);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            1,
            [message2],
            sign
        )).wait();
        console.log("Second exit erc721 cost:", res.gasUsed.toNumber());
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 3);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message3],
            sign
        )).wait();
        console.log("Third exit erc721 cost:", res.gasUsed.toNumber());
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 4);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message4],
            sign
        )).wait();
        console.log("Forth exit erc721 cost:", res.gasUsed.toNumber());
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 5);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message5],
            sign
        )).wait();
        console.log("Fifth exit erc721 cost:", res.gasUsed.toNumber());
    });

    it("calculate 2 exit erc721 cost per one message", async () => {
        // register ERC721 tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5);

        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 1);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 2);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 3);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 4);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 5);

        // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 1);
        const message1 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken1,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 2, "1000000000000000000", {from: user});
        const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 2);
        const message2 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken2,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 3, "1000000000000000000", {from: user});
        const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 3);
        const message3 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken3,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 4, "1000000000000000000", {from: user});
        const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 4);
        const message4 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken4,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 5, "1000000000000000000", {from: user});
        const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 5);
        const message5 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken5,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message1, message2],
            sign
        )).wait();
        console.log("First 2 exit erc721 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message3, message4],
            sign
        )).wait();
        console.log("Second 2 exit erc721 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message5],
            sign
        )).wait();
        console.log("Third exit erc721 cost:", res.gasUsed.toNumber());
    });

    it("calculate 2 exit erc721 cost per one message deposit each time", async () => {
        // register ERC721 tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5);

        // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 1);
        const message1 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken1,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 2, "1000000000000000000", {from: user});
        const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 2);
        const message2 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken2,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 3, "1000000000000000000", {from: user});
        const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 3);
        const message3 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken3,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 4, "1000000000000000000", {from: user});
        const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 4);
        const message4 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken4,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 5, "1000000000000000000", {from: user});
        const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 5);
        const message5 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken5,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 1);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 2);
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message1, message2],
            sign
        )).wait();
        console.log("First 2 exit erc721 cost:", res.gasUsed.toNumber());
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 3);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 4);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            2,
            [message3, message4],
            sign
        )).wait();
        console.log("Second 2 exit erc721 cost:", res.gasUsed.toNumber());
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 5);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message5],
            sign
        )).wait();
        console.log("Third exit erc721 cost:", res.gasUsed.toNumber());
    });

    it("calculate 3 exit erc721 cost per one message", async () => {
        // register ERC721 tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5);

        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 1);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 2);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 3);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 4);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 5);

        // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 1);
        const message1 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken1,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 2, "1000000000000000000", {from: user});
        const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 2);
        const message2 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken2,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 3, "1000000000000000000", {from: user});
        const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 3);
        const message3 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken3,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 4, "1000000000000000000", {from: user});
        const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 4);
        const message4 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken4,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 5, "1000000000000000000", {from: user});
        const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 5);
        const message5 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken5,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message1, message2, message3],
            sign
        )).wait();
        console.log("First 3 exit erc721 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message4, message5],
            sign
        )).wait();
        console.log("Second 2 exit erc721 cost:", res.gasUsed.toNumber());
    });

    it("calculate 3 exit erc721 cost per one message deposit each time", async () => {
        // register ERC721 tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5);

        // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 1);
        const message1 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken1,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 2, "1000000000000000000", {from: user});
        const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 2);
        const message2 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken2,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 3, "1000000000000000000", {from: user});
        const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 3);
        const message3 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken3,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 4, "1000000000000000000", {from: user});
        const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 4);
        const message4 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken4,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 5, "1000000000000000000", {from: user});
        const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 5);
        const message5 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken5,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 1);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 2);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 3);
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message1, message2, message3],
            sign
        )).wait();
        console.log("First 3 exit erc721 cost:", res.gasUsed.toNumber());
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 4);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 5);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            3,
            [message4, message5],
            sign
        )).wait();
        console.log("Second 2 exit erc721 cost:", res.gasUsed.toNumber());
    });

    it("calculate 4 exit erc721 cost per one message", async () => {
        // register ERC721 tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5);

        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 1);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 2);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 3);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 4);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 5);

        // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 1);
        const message1 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken1,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 2, "1000000000000000000", {from: user});
        const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 2);
        const message2 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken2,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 3, "1000000000000000000", {from: user});
        const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 3);
        const message3 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken3,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 4, "1000000000000000000", {from: user});
        const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 4);
        const message4 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken4,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 5, "1000000000000000000", {from: user});
        const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 5);
        const message5 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken5,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message1, message2, message3, message4],
            sign
        )).wait();
        console.log("First 4 exit erc721 cost:", res.gasUsed.toNumber());
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message5],
            sign
        )).wait();
        console.log("Second exit erc721 cost:", res.gasUsed.toNumber());
    });

    it("calculate 4 exit erc721 cost per one message deposit each time", async () => {
        // register ERC721 tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5);

        // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 1);
        const message1 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken1,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 2, "1000000000000000000", {from: user});
        const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 2);
        const message2 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken2,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 3, "1000000000000000000", {from: user});
        const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 3);
        const message3 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken3,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 4, "1000000000000000000", {from: user});
        const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 4);
        const message4 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken4,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 5, "1000000000000000000", {from: user});
        const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 5);
        const message5 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken5,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 1);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 2);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 3);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 4);
        let res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message1, message2, message3, message4],
            sign
        )).wait();
        console.log("First 4 exit erc721 cost:", res.gasUsed.toNumber());
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 5);
        res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            4,
            [message5],
            sign
        )).wait();
        console.log("Second exit erc721 cost:", res.gasUsed.toNumber());
    });

    it("calculate 5 exit erc721 cost per one message", async () => {
        // register ERC721 tokens
        await tokenManagerERC721.connect(schainOwner).addERC721TokenByOwner(ERC721TokenOnMainnet.address, ERC721TokenOnSchain.address);
        await depositBoxERC721.connect(schainOwner).addERC721TokenByOwner(schainName, ERC721TokenOnMainnet.address);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 1);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 2);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 3);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 4);
        await ERC721TokenOnMainnet.connect(user).approve(depositBoxERC721.address, 5);

        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 1);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 2);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 3);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 4);
        await depositBoxERC721.connect(user).depositERC721(schainName, ERC721TokenOnMainnet.address, user.address, 5);

        // prepare exit message of 1 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 1, "1000000000000000000", {from: user});
        const dataOfERC721OfToken1 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 1);
        const message1 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken1,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 2 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 2, "1000000000000000000", {from: user});
        const dataOfERC721OfToken2 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 2);
        const message2 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken2,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 3 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 3, "1000000000000000000", {from: user});
        const dataOfERC721OfToken3 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 3);
        const message3 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken3,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 4 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 4, "1000000000000000000", {from: user});
        const dataOfERC721OfToken4 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 4);
        const message4 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken4,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };
        // prepare exit message of 5 erc721 token - await TokenManager.exitToMainERC721(ERC721TokenOnMainnet.address, user.address, 5, "1000000000000000000", {from: user});
        const dataOfERC721OfToken5 = await messages.encodeTransferErc721Message(ERC721TokenOnMainnet.address, user.address, 5);
        const message5 = {
            amount: "1000000000000000000",
            data: dataOfERC721OfToken5,
            destinationContract: depositBoxERC721.address,
            sender: tokenManagerERC721.address,
            to: "0x0000000000000000000000000000000000000000"
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumber, BigNumber] = [
            BigNumber.from("178325537405109593276798394634841698946852714038246117383766698579865918287"),
            BigNumber.from("493565443574555904019191451171395204672818649274520396086461475162723833781"),
        ];
        const HashA = "3080491942974172654518861600747466851589809241462384879086673256057179400078";
        const HashB = "15163860114293529009901628456926790077787470245128337652112878212941459329347";
        const Counter = 0;
        const sign = {
            blsSignature: BlsSignature,
            counter: Counter,
            hashA: HashA,
            hashB: HashB,
        };

        // send exit message to mainnet
        const res = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message1, message2, message3, message4, message5],
            sign
        )).wait();
        console.log("First 5 exit erc721 cost:", res.gasUsed.toNumber());
    });
});
