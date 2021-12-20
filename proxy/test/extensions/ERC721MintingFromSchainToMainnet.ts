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

import { solidity } from "ethereum-waffle";
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
    ERC721ReferenceMintAndMetadataMainnet,
    ERC721ReferenceMintAndMetadataSchain,
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
} from "../../typechain";

chai.should();
chai.use((chaiAsPromised as any));
chai.use(solidity);

import { deployLinker } from "../utils/deploy/mainnet/linker";
import { deployDepositBoxEth } from "../utils/deploy/mainnet/depositBoxEth";
import { deployDepositBoxERC20 } from "../utils/deploy/mainnet/depositBoxERC20";
import { deployDepositBoxERC721 } from "../utils/deploy/mainnet/depositBoxERC721";
import { deployMessageProxyForMainnet } from "../utils/deploy/mainnet/messageProxyForMainnet";

import { deployEthErc20 } from "../utils/deploy/schain/ethErc20";
import { deployERC20OnChain } from "../utils/deploy/erc20OnChain";
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
import { deployTokenManagerEth } from "../utils/deploy/schain/tokenManagerEth";
import { deployTokenManagerERC20 } from "../utils/deploy/schain/tokenManagerERC20";
import { deployTokenManagerERC721 } from "../utils/deploy/schain/tokenManagerERC721";
import { deployMessageProxyForSchain } from "../utils/deploy/schain/messageProxyForSchain";
import { deployMessages } from "../utils/deploy/messages";

import { randomString, stringValue } from "../utils/helper";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber, BytesLike } from "ethers";

import { assert, expect } from "chai";
import { deployCommunityLocker } from "../utils/deploy/schain/communityLocker";
import { deployCommunityPool } from "../utils/deploy/mainnet/communityPool";
// import { LockAndDataForSchain } from "../typechain/LockAndDataForSchain";

describe("ERC721MintingFromSchainToMainnet", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;
    let schainOwner: SignerWithAddress;

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
    const schainNameHash = web3.utils.soliditySha3("ExtensionChain");
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
        // depositBoxEth = await deployDepositBoxEth(contractManager, imaLinker, messageProxyForMainnet);
        // depositBoxERC20 = await deployDepositBoxERC20(contractManager, imaLinker, messageProxyForMainnet);
        // depositBoxERC721 = await deployDepositBoxERC721(contractManager, imaLinker, messageProxyForMainnet);
        const extraContractRegistrarRole = await messageProxyForMainnet.EXTRA_CONTRACT_REGISTRAR_ROLE();
        const chainConnectorRole2 = await messageProxyForMainnet.CHAIN_CONNECTOR_ROLE();
        await messageProxyForMainnet.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
        await messageProxyForMainnet.connect(deployer).grantRole(chainConnectorRole2, imaLinker.address);
        // await messageProxyForMainnet.registerExtraContractForAll(depositBoxEth.address)
        // await messageProxyForMainnet.registerExtraContractForAll(depositBoxERC20.address)
        // await messageProxyForMainnet.registerExtraContractForAll(depositBoxERC721.address)
        // await messageProxyForMainnet.registerExtraContractForAll(communityPool.address)

        // IMA schain part deployment
        messageProxyForSchain = await deployMessageProxyForSchain(keyStorage.address, schainName);
        await keyStorage.connect(deployer).setBlsCommonPublicKey(BLSPublicKey);
        tokenManagerLinker = await deployTokenManagerLinker(messageProxyForSchain, imaLinker.address);
        communityLocker = await deployCommunityLocker(schainName, messageProxyForSchain.address, tokenManagerLinker, communityPool.address);
        // tokenManagerEth = await deployTokenManagerEth(
        //     schainName,
        //     messageProxyForSchain.address,
        //     tokenManagerLinker,
        //     communityLocker,
        //     depositBoxEth.address,
        //     "0x0000000000000000000000000000000000000000");
        // tokenManagerERC20 = await deployTokenManagerERC20(schainName, messageProxyForSchain.address, tokenManagerLinker, communityLocker, depositBoxERC20.address);
        // tokenManagerERC721 = await deployTokenManagerERC721(schainName, messageProxyForSchain.address, tokenManagerLinker, communityLocker, depositBoxERC721.address);
        await messageProxyForSchain.connect(deployer).grantRole(extraContractRegistrarRole, deployer.address);
        // await messageProxyForSchain.registerExtraContractForAll(tokenManagerEth.address)
        // await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC20.address)
        // await messageProxyForSchain.registerExtraContractForAll(tokenManagerERC721.address)
        // await messageProxyForSchain.registerExtraContractForAll(communityLocker.address)

        // ethERC20 = await deployEthErc20(tokenManagerEth);
        // await tokenManagerEth.connect(deployer).setEthErc20Address(ethERC20.address);
        const chainConnectorRole = await messageProxyForSchain.CHAIN_CONNECTOR_ROLE();
        await messageProxyForSchain.connect(deployer).grantRole(chainConnectorRole, tokenManagerLinker.address);
        // await tokenManagerERC20.connect(deployer).grantRole(await tokenManagerERC20.TOKEN_REGISTRAR_ROLE(), schainOwner.address);
        // await tokenManagerERC721.connect(deployer).grantRole(await tokenManagerERC721.TOKEN_REGISTRAR_ROLE(), schainOwner.address);

        // IMA schain part registration
        // await lockAndDataForSchain.setContract("LockAndDataERC20", lockAndDataForSchainERC20.address);
        // await lockAndDataForSchain.setContract("LockAndDataERC721", lockAndDataForSchainERC721.address);
        // await lockAndDataForSchain.setContract("ERC20Module", erc20ModuleForSchain.address);
        // await lockAndDataForSchain.setContract("ERC721Module", erc721ModuleForSchain.address);
        // await lockAndDataForSchain.setContract("TokenManager", tokenManager.address);
        // await lockAndDataForSchain.setContract("MessageProxy", messageProxyForSchain.address);
        // await lockAndDataForSchain.setContract("TokenFactory", tokenFactory.address);

        // IMA registration
        await imaLinker.connectSchain(schainName, [communityLocker.address, tokenManagerLinker.address]);
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
            messageProxyForMainnet.address,
            ERC721TokenOnMainnet.address,
            schainName
        ) as ERC721ReferenceMintAndMetadataMainnet;

        extensionSchain = await extensionSchainFactory.deploy(
            messageProxyForSchain.address,
            ERC721TokenOnSchain.address,
            extensionMainnet.address
        ) as ERC721ReferenceMintAndMetadataSchain;

        await extensionMainnet.connect(deployer).setSenderContractOnSchain(extensionSchain.address);

        // add minter role
        const minterRoleERC721 = await ERC721TokenOnMainnet.MINTER_ROLE();
        await ERC721TokenOnMainnet.grantRole(minterRoleERC721, extensionMainnet.address);
    });

    it("should not send message if not registered", async () => {
        await ERC721TokenOnSchain.connect(user).setTokenURI(1, "MyToken1");
        await ERC721TokenOnSchain.connect(user).approve(extensionSchain.address, 1);
        await extensionSchain.connect(user).sendTokenToMainnet(user.address, 1).should.be.eventually.rejectedWith("Sender contract is not registered");
    });

    it("should send message", async () => {
        await ERC721TokenOnSchain.connect(user).setTokenURI(1, "MyToken1");
        await ERC721TokenOnSchain.connect(user).approve(extensionSchain.address, 1);
        await messageProxyForSchain.connect(deployer).registerExtraContract("Mainnet", extensionSchain.address);
        const res = await (await extensionSchain.connect(user).sendTokenToMainnet(user.address, 1)).wait();
        if (!res.events) {
            assert("No events were emitted");
        } else {
            const last = res.events.length - 1;
            expect(res.events[last]?.topics[0]).to.equal(stringValue(web3.utils.soliditySha3("OutgoingMessage(bytes32,uint256,address,address,bytes)")));
            expect(res.events[last]?.topics[1]).to.equal(stringValue(web3.utils.soliditySha3("Mainnet")));
            expect(BigNumber.from(res.events[last]?.topics[2]).toString()).to.equal("0");
            expect(stringValue(web3.utils.toChecksumAddress("0x" + res.events[last]?.topics[3].slice(-40)))).to.equal(extensionSchain.address);
        }
    });

    it("should POST message for token 1", async () => {
        const dataToPost = await extensionSchain.connect(user).encodeParams(user.address, 1, "MyToken1");
        const message = {
            data: dataToPost,
            destinationContract: extensionMainnet.address,
            sender: extensionSchain.address,
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

        await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        ).should.be.rejectedWith("Schain wallet has not enough funds");

        await wallets.connect(deployer).rechargeSchainWallet(stringValue(schainNameHash), {value: "1000000000000000000"});

        const resPost = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
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
            sender: extensionSchain.address,
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

        await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        ).should.be.rejectedWith("Schain wallet has not enough funds");

        await wallets.connect(deployer).rechargeSchainWallet(stringValue(schainNameHash), {value: "1000000000000000000"});

        await expect(messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        )).to.emit(messageProxyForMainnet, "PostMessageError").withArgs(0, ethers.utils.hexlify(ethers.utils.toUtf8Bytes("Destination contract is not a contract")));
    });

    it("should POST message for token 5", async () => {
        const dataToPost = await extensionSchain.connect(user).encodeParams(user.address, 5, "MyToken5Unique");
        const message = {
            data: dataToPost,
            destinationContract: extensionMainnet.address,
            sender: extensionSchain.address,
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

        await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        ).should.be.rejectedWith("Schain wallet has not enough funds");

        await wallets.connect(deployer).rechargeSchainWallet(stringValue(schainNameHash), {value: "1000000000000000000"});

        const resPost = await (await messageProxyForMainnet.connect(deployer).postIncomingMessages(
            schainName,
            0,
            [message],
            sign
        )).wait();
        expect(await ERC721TokenOnMainnet.ownerOf(5)).to.equal(user.address);
        expect(await ERC721TokenOnMainnet.tokenURI(5)).to.equal("MyToken5Unique");
    });
});