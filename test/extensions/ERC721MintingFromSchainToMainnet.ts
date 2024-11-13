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

// import { solidity } from "ethereum-waffle";
import chaiAsPromised from "chai-as-promised";
import chai from "chai";
import {
    CommunityLocker,
    CommunityPool,
    ContractManager,
    ERC721OnChain,
    ERC721ReferenceMintAndMetadataMainnet,
    ERC721ReferenceMintAndMetadataSchain,
    KeyStorageMock,
    MessageProxyForMainnet,
    MessageProxyForSchain,
    Nodes,
    Schains,
    SchainsInternal,
    SkaleVerifierMock,
    TokenManagerLinker,
    Wallets,
    Linker,
} from "../../typechain";

chai.should();
chai.use(chaiAsPromised);
// chai.use(solidity);

import { deployLinker } from "../utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "../utils/deploy/mainnet/messageProxyForMainnet";

import { deployERC721OnChain } from "../utils/deploy/erc721OnChain";

import { deployContractManager } from "../utils/skale-manager-utils/contractManager";
// import { deployContractManager } from "../utils/skale-manager-utils/keyStorage";
// const KeyStorage: KeyStorageContract = artifacts.require("./KeyStorage");
// const Nodes: NodesContract = artifacts.require("./Nodes");
// const Schains: SchainsContract = artifacts.require("./Schains");
// const SchainsInternal: SchainsInternalContract = artifacts.require("./SchainsInternal");
// const SkaleVerifierMock: SkaleVerifierMockContract = artifacts.require("./SkaleVerifierMock");
// const Wallets: WalletsContract = artifacts.require("./Wallets");

import { deployTokenManagerLinker } from "../utils/deploy/schain/tokenManagerLinker";
import { deployMessageProxyForSchain } from "../utils/deploy/schain/messageProxyForSchain";

import { getPublicKey } from "../utils/helper";

import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { BigNumberish, HDNodeWallet, Wallet } from "ethers";

import { expect } from "chai";
import { deployCommunityLocker } from "../utils/deploy/schain/communityLocker";
import { deployCommunityPool } from "../utils/deploy/mainnet/communityPool";
// import { LockAndDataForSchain } from "../typechain/LockAndDataForSchain";

describe("ERC721MintingFromSchainToMainnet", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let richGuy: SignerWithAddress;
    let nodeAddress: HDNodeWallet;

    let imaLinker: Linker;
    let communityPool: CommunityPool;
    let messageProxyForMainnet: MessageProxyForMainnet;

    let contractManager: ContractManager;
    let keyStorage: KeyStorageMock;
    let nodes: Nodes;
    let schains: Schains;
    let schainsInternal: SchainsInternal;
    let skaleVerifier: SkaleVerifierMock;
    let wallets: Wallets;
    let tokenManagerLinker: TokenManagerLinker;
    let communityLocker: CommunityLocker;
    let messageProxyForSchain: MessageProxyForSchain;
    let ERC721TokenOnMainnet: ERC721OnChain;
    let ERC721TokenOnSchain: ERC721OnChain;

    let extensionMainnet: ERC721ReferenceMintAndMetadataMainnet;
    let extensionSchain: ERC721ReferenceMintAndMetadataSchain;

    const schainName = "ExtensionChain";
    const schainNameHash = ethers.id("ExtensionChain");
    const contractManagerAddress = "0x0000000000000000000000000000000000000000";

    before(async () => {
        [deployer, user, richGuy] = await ethers.getSigners();
        nodeAddress = Wallet.createRandom().connect(ethers.provider);
        const balanceRichGuy = await ethers.provider.getBalance(richGuy.address);
        await richGuy.sendTransaction({to: nodeAddress.address, value: balanceRichGuy - BigInt(ethers.parseEther("1"))});
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
        await contractManager.connect(deployer).setContractsAddress("KeyStorage", keyStorage);
        await contractManager.connect(deployer).setContractsAddress("Nodes", nodes);
        await contractManager.connect(deployer).setContractsAddress("Schains", schains);
        await contractManager.connect(deployer).setContractsAddress("SchainsInternal", schainsInternal);
        await contractManager.connect(deployer).setContractsAddress("SkaleVerifier", skaleVerifier);
        await contractManager.connect(deployer).setContractsAddress("Wallets", wallets);

        // add ContractManager to contracts
        await schains.connect(deployer).addContractManager(contractManager);
        await schainsInternal.connect(deployer).addContractManager(contractManager);
        await wallets.connect(deployer).addContractManager(contractManager);

        // setup 16 nodes
        const nodeCreationParams = {
            port: 1337,
            nonce: 1337,
            ip: "0x12345678",
            publicIp: "0x12345678",
            publicKey: getPublicKey(nodeAddress),
            name: "ExtensionChainNode",
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
        await schainsInternal.connect(deployer).initializeSchain(schainName, deployer.address, 12345678, 12345678);
        await schainsInternal.connect(deployer).addNodesToSchainsGroups(schainNameHash, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

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
        // depositBoxEth = await deployDepositBoxEth(contractManager, imaLinker, messageProxyForMainnet);
        // depositBoxERC20 = await deployDepositBoxERC20(contractManager, imaLinker, messageProxyForMainnet);
        // depositBoxERC721 = await deployDepositBoxERC721(contractManager, imaLinker, messageProxyForMainnet);
        const extraContractRegistrarRole = await messageProxyForMainnet.EXTRA_CONTRACT_REGISTRAR_ROLE();
        const chainConnectorRole2 = await messageProxyForMainnet.CHAIN_CONNECTOR_ROLE();
        await messageProxyForMainnet.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
        await messageProxyForMainnet.connect(deployer).grantRole(chainConnectorRole2, imaLinker);
        // await messageProxyForMainnet.registerExtraContractForAll(depositBoxEth.address)
        // await messageProxyForMainnet.registerExtraContractForAll(depositBoxERC20.address)
        // await messageProxyForMainnet.registerExtraContractForAll(depositBoxERC721.address)
        // await messageProxyForMainnet.registerExtraContractForAll(communityPool)

        // IMA schain part deployment
        messageProxyForSchain = await deployMessageProxyForSchain(keyStorage, schainName);
        await keyStorage.connect(deployer).setBlsCommonPublicKey(BLSPublicKey);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, await imaLinker.getAddress());
        communityLocker = await deployCommunityLocker(schainName, messageProxyForSchain, tokenManagerLinker, await communityPool.getAddress());
        // tokenManagerEth = await deployTokenManagerEth(
        //     schainName,
        //     messageProxyForSchain,
        //     tokenManagerLinker,
        //     communityLocker,
        //     depositBoxEth.address,
        //     "0x0000000000000000000000000000000000000000");
        // tokenManagerERC20 = await deployTokenManagerERC20(schainName, messageProxyForSchain, tokenManagerLinker, communityLocker, depositBoxERC20.address);
        // tokenManagerERC721 = await deployTokenManagerERC721(schainName, messageProxyForSchain, tokenManagerLinker, communityLocker, depositBoxERC721.address);
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
        // await messageProxyForSchain.registerExtraContractForAll(tokenManagerEth.address)
        // await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC20.address)
        // await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721.address)
        // await messageProxyForSchain.registerExtraContractForAll(communityLocker)

        // ethERC20 = await deployEthErc20(tokenManagerEth);
        // await tokenManagerEth.connect(deployer).setEthErc20Address(ethERC20.address);
        const chainConnectorRole = await messageProxyForSchain.CHAIN_CONNECTOR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(chainConnectorRole, tokenManagerLinker);
        // await tokenManagerERC20.connect(deployer).grantRole(await tokenManagerERC20.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        // await tokenManagerERC721.connect(deployer).grantRole(await tokenManagerERC721.TOKEN_REGISTRAR_ROLE(), schainOwner.address);

        // IMA schain part registration
        // await lockAndDataForSchain.setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
        // await lockAndDataForSchain.setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
        // await lockAndDataForSchain.setContract("ERC20Module", erc20ModuleForSchain.address);
        // await lockAndDataForSchain.setContract("ERC721Module", erc721ModuleForSchain.address);
        // await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);
        // await lockAndDataForSchain.setContract("MessageProxy", messageProxyForSchain);
        // await lockAndDataForSchain.setContract("TokenFactory", tokenFactory.address);

        // IMA registration
        await imaLinker.connectSchain(schainName, [communityLocker, tokenManagerLinker]);
        // await communityPool.connect(user).rechargeUserWallet(schainName, { value: 1e18.toString() });
        // await lockAndDataForSchain.addDepositBox(depositBoxEth.address);
        // await lockAndDataForSchain.addDepositBox(depositBoxERC20.address);
        // await lockAndDataForSchain.addDepositBox(depositBoxERC721.address);

        // Deploy test tokens
        // ERC20TokenOnMainnet = await deployERC20OnChain("GCERC20", "GCE");
        // ERC20TokenOnSchain = await deployERC20OnChain("GCERC20Clone", "GCEC");
        ERC721TokenOnMainnet = await deployERC721OnChain("GCERC721", "GCE");
        ERC721TokenOnSchain = await deployERC721OnChain("GCERC721Clone", "GCEC");

        // Mint tokens and grant minter role
        // await ERC20TokenOnMainnet.mint(user.address, 100000);
        // const minterRoleERC20 = await ERC20TokenOnSchain.MINTER_ROLE();
        // await ERC20TokenOnSchain.grantRole(minterRoleERC20, tokenManagerERC20.address);
        await ERC721TokenOnSchain.mint(user.address, 1);
        await ERC721TokenOnSchain.mint(user.address, 2);
        await ERC721TokenOnSchain.mint(user.address, 3);
        await ERC721TokenOnSchain.mint(user.address, 4);
        await ERC721TokenOnSchain.mint(user.address, 5);
        await ERC721TokenOnSchain.mint(user.address, 6);
        await ERC721TokenOnSchain.mint(user.address, 7);
        await ERC721TokenOnSchain.mint(user.address, 8);
        await ERC721TokenOnSchain.mint(user.address, 9);
        await ERC721TokenOnSchain.mint(user.address, 10);

        // register user
        // await communityPool.connect(user).rechargeUserWallet(schainName, {value: "1000000000000000000"});

        // deploy extensions
        const extensionSchainFactory = await ethers.getContractFactory("ERC721ReferenceMintAndMetadataSchain");
        const extensionMainnetFactory = await ethers.getContractFactory("ERC721ReferenceMintAndMetadataMainnet");

        extensionMainnet = await extensionMainnetFactory.deploy(
            messageProxyForMainnet,
            ERC721TokenOnMainnet,
            schainName
        ) as ERC721ReferenceMintAndMetadataMainnet;

        extensionSchain = await extensionSchainFactory.deploy(
            messageProxyForSchain,
            ERC721TokenOnSchain,
            extensionMainnet
        ) as ERC721ReferenceMintAndMetadataSchain;

        await extensionMainnet.connect(deployer).setSenderContractOnSchain(extensionSchain);

        // add minter role
        const minterRoleERC721 = await ERC721TokenOnMainnet.MINTER_ROLE();
        await ERC721TokenOnMainnet.grantRole(minterRoleERC721, extensionMainnet);
    });

    it("should not send message if not registered", async () => {
        await ERC721TokenOnSchain.connect(user).setTokenURI(1, "MyToken1");
        await ERC721TokenOnSchain.connect(user).approve(extensionSchain, 1);
        await extensionSchain.connect(user).sendTokenToMainnet(user.address, 1).should.be.eventually.rejectedWith("Sender contract is not registered");
    });

    it("should send message", async () => {
        const tokenURI = "MyToken1";
        const mainnetHash = ethers.id("Mainnet");
        await ERC721TokenOnSchain.connect(user).setTokenURI(1, tokenURI);
        await ERC721TokenOnSchain.connect(user).approve(extensionSchain, 1);
        await messageProxyForSchain.connect(deployer).registerExtraContract("Mainnet", extensionSchain);
        const res = await extensionSchain.connect(user).sendTokenToMainnet(user.address, 1);

        const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint", "string"], [user.address, 1, tokenURI]);
        await expect(res)
            .to.emit(messageProxyForSchain, "OutgoingMessage")
            .withArgs(mainnetHash, 0, extensionSchain, extensionMainnet, encodedData);
    });

    it("should POST message for token 1", async () => {
        const dataToPost = await extensionSchain.connect(user).encodeParams(user.address, 1, "MyToken1");
        const message = {
            data: dataToPost,
            destinationContract: extensionMainnet,
            sender: extensionSchain,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumberish, BigNumberish] = [
            "178325537405109593276798394634841698946852714038246117383766698579865918287",
            "493565443574555904019191451171395204672818649274520396086461475162723833781",
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

        await messageProxyForMainnet.connect(nodeAddress).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        ).should.be.rejectedWith("Schain wallet has not enough funds");

        await wallets.connect(deployer).rechargeSchainWallet(schainNameHash, {value: "1000000000000000000"});

        await (await messageProxyForMainnet.connect(nodeAddress).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        )).wait();
        expect(await ERC721TokenOnMainnet.ownerOf(1)).to.equal(user.address);
        expect(await ERC721TokenOnMainnet.tokenURI(1)).to.equal("MyToken1");
    });

    it("should not revert POST message for token 1 with incorrect destination contract", async () => {
        const dataToPost = await extensionSchain.connect(user).encodeParams(user.address, 1, "MyToken1");
        const message = {
            data: dataToPost,
            destinationContract: user.address,
            sender: extensionSchain,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumberish, BigNumberish] = [
            "178325537405109593276798394634841698946852714038246117383766698579865918287",
            "493565443574555904019191451171395204672818649274520396086461475162723833781",
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

        await messageProxyForMainnet.connect(nodeAddress).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        ).should.be.rejectedWith("Schain wallet has not enough funds");

        await wallets.connect(deployer).rechargeSchainWallet(schainNameHash, {value: "1000000000000000000"});

        await expect(messageProxyForMainnet.connect(nodeAddress).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        )).to.emit(messageProxyForMainnet, "PostMessageError").withArgs(0, ethers.hexlify(ethers.toUtf8Bytes("Destination contract is not a contract")));
    });

    it("should POST message for token 5", async () => {
        const dataToPost = await extensionSchain.connect(user).encodeParams(user.address, 5, "MyToken5Unique");
        const message = {
            data: dataToPost,
            destinationContract: extensionMainnet,
            sender: extensionSchain,
        };

        // prepare BLS signature
        // P.s. this is test signature from test of SkaleManager.SkaleVerifier - please do not use it!!!
        const BlsSignature: [BigNumberish, BigNumberish] = [
            "178325537405109593276798394634841698946852714038246117383766698579865918287",
            "493565443574555904019191451171395204672818649274520396086461475162723833781"
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

        await messageProxyForMainnet.connect(nodeAddress).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        ).should.be.rejectedWith("Schain wallet has not enough funds");

        await wallets.connect(deployer).rechargeSchainWallet(schainNameHash, {value: "1000000000000000000"});

        await (await messageProxyForMainnet.connect(nodeAddress).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        )).wait();
        expect(await ERC721TokenOnMainnet.ownerOf(5)).to.equal(user.address);
        expect(await ERC721TokenOnMainnet.tokenURI(5)).to.equal("MyToken5Unique");
    });
});
