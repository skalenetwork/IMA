import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");

import { ERC20ModuleForSchainContract,
    ERC20ModuleForSchainInstance,
    ERC20OnChainContract,
    ERC20OnChainInstance,
    ERC721ModuleForMainnetContract,
    ERC721ModuleForMainnetInstance,
    ERC721ModuleForSchainInstance,
    ERC721OnChainContract,
    ERC721OnChainInstance,
    EthERC20Contract,
    EthERC20Instance,
    LockAndDataForMainnetContract,
    LockAndDataForMainnetERC721Contract,
    LockAndDataForMainnetERC721Instance,
    LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC20Contract,
    LockAndDataForSchainERC20Instance,
    LockAndDataForSchainERC721Contract,
    LockAndDataForSchainERC721Instance,
    LockAndDataForSchainInstance,
    MessageProxyContract,
    MessageProxyInstance,
    TokenManagerContract,
    TokenManagerInstance} from "../types/truffle-contracts";
import { gasMultiplier } from "./utils/command_line";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

const TokenManager: TokenManagerContract = artifacts.require("./TokenManager");
const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");
const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnet");
const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const LockAndDataForSchainERC20: LockAndDataForSchainERC20Contract = artifacts.require("./LockAndDataForSchainERC20");
const ERC20ModuleForSchain: ERC20ModuleForSchainContract = artifacts.require("./ERC20ModuleForSchain");
const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");
// const ERC721ModuleForMainnet: ERC721ModuleForMainnetContract = artifacts.require("./ERC721ModuleForMainnet");
// const LockAndDataForMainnetERC721: LockAndDataForMainnetERC721Contract = artifacts
//     .require("./LockAndDataForMainnetERC721");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");
const ERC721ModuleForSchain: ERC721ModuleForMainnetContract = artifacts.require("./ERC721ModuleForMainnet");
const LockAndDataForSchainERC721: LockAndDataForSchainERC721Contract = artifacts
    .require("./LockAndDataForSchainERC721");

contract("TokenManager", ([user, deployer, client]) => {
    let tokenManager: TokenManagerInstance;
    let messageProxy: MessageProxyInstance;
    let lockAndDataForMainnet: LockAndDataForMainnetInstance;
    let ethERC20: EthERC20Instance;
    let lockAndDataForSchain: LockAndDataForSchainInstance;
    let lockAndDataForSchainERC20: LockAndDataForSchainERC20Instance;
    let eRC20ModuleForSchain: ERC20ModuleForSchainInstance;
    let eRC20OnChain: ERC20OnChainInstance;
    // let eRC721ModuleForMainnet: ERC721ModuleForMainnetInstance;
    // let lockAndDataForMainnetERC721: LockAndDataForMainnetERC721Instance;
    let eRC721OnChain: ERC721OnChainInstance;
    let eRC721: ERC721OnChainInstance;
    let eRC721ModuleForSchain: ERC721ModuleForSchainInstance;
    let lockAndDataForSchainERC721: LockAndDataForSchainERC721Instance;

    const publicKeyArray = [
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
        "1122334455667788990011223344556677889900112233445566778899001122",
    ];

    const chainID = randomString(10);

    beforeEach(async () => {
        // const chainID = "MyNet";
        messageProxy = await MessageProxy.new(chainID, {from: deployer, gas: 8000000 * gasMultiplier});
        lockAndDataForMainnet = await LockAndDataForMainnet.new({from: deployer, gas: 8000000 * gasMultiplier});
        lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
        tokenManager = await TokenManager.new(chainID, messageProxy.address,
            lockAndDataForSchain.address, {from: deployer, gas: 8000000 * gasMultiplier});
        ethERC20 = await EthERC20.new({from: deployer, gas: 8000000 * gasMultiplier});
        lockAndDataForSchainERC20 = await LockAndDataForSchainERC20
            .new(lockAndDataForSchain.address, {from: deployer, gas: 8000000 * gasMultiplier});
        eRC20ModuleForSchain = await ERC20ModuleForSchain
            .new(lockAndDataForSchain.address, {from: deployer, gas: 8000000 * gasMultiplier});
        eRC20OnChain = await ERC20OnChain.new("ERC721OnChain", "ERC721", 18,
            ((1000000000).toString()), deployer, {from: deployer});
        // eRC721ModuleForMainnet = await ERC721ModuleForMainnet.new(lockAndDataForMainnet.address,
        //     {from: deployer, gas: 8000000 * gasMultiplier});
        // lockAndDataForMainnetERC721 = await LockAndDataForMainnetERC721.new(lockAndDataForMainnet.address,
        //     {from: deployer, gas: 8000000 * gasMultiplier});
        eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721");
        eRC721 = await ERC721OnChain.new("eRC721", "ERR");
        // eRC721 = await eRC721OnChain.new("ERC721OnChain", "ERC721");
        eRC721ModuleForSchain = await ERC721ModuleForSchain.new(lockAndDataForSchain.address,
            {from: deployer, gas: 8000000 * gasMultiplier});
        lockAndDataForSchainERC721 = await LockAndDataForSchainERC721.new(lockAndDataForSchain.address,
            {from: deployer, gas: 8000000 * gasMultiplier});
    });

    it("should send Eth to somebody on Mainnet, closed to Mainnet, called by schain", async () => {
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        const amountAfter = new BigNumber(180);

        // set EthERC20 address:
        await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: deployer});

        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});

        // send Eth:
        await lockAndDataForSchain.sendEth(user, amount, {from: deployer});

        // send Eth to a client on Mainnet:
        await tokenManager.exitToMainTS(client, amountTo, {from: user});
        const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
        balanceAfter.should.be.deep.equal(amountAfter);
    });

    it("should send Eth and some data to somebody on Mainnet, closed to Mainnet, called by schain", async () => {
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        const amountAfter = new BigNumber(180);
        const bytesData = "0x0";

        // set EthERC20 address:
        await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: deployer});

        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});

        // send Eth:
        await lockAndDataForSchain.sendEth(user, amount, {from: deployer});

        // send Eth and data to a client on Mainnet:
        await tokenManager.exitToMain(client, amountTo, bytesData, {from: user});

        const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
        balanceAfter.should.be.deep.equal(amountAfter);
    });

    it("should transfer to somebody on schain Eth and some data", async () => {
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        const amountAfter = new BigNumber(180);
        const bytesData = "0x0";

        // set EthERC20 address:
        await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: deployer});

        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // add connected chain:
        await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});

        // send Eth:
        await lockAndDataForSchain.sendEth(user, amount, {from: deployer});

        // add schain:
        await lockAndDataForSchain.addSchain(chainID, user, {from: deployer});

        // send Eth and data to a client on schain:
        await tokenManager.transferToSchain(chainID, client, amountTo, bytesData, {from: user});

        const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
        balanceAfter.should.be.deep.equal(amountAfter);
    });

    it("should transfer to somebody on shain Eth", async () => {
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        const amountAfter = new BigNumber(180);

        // set EthERC20 address:
        await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: deployer});

        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // add connected chain:
        await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});

        // send Eth:
        await lockAndDataForSchain.sendEth(user, amount, {from: deployer});

        // add schain:
        await lockAndDataForSchain.addSchain(chainID, user, {from: deployer});

        // send Eth to a client on schain:
        await tokenManager.transferToSchainTS(chainID, client, amountTo, {from: user});

        const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
        balanceAfter.should.be.deep.equal(amountAfter);
    });

    it("should add Eth cost", async () => {
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        const amountAfter = new BigNumber(180);

        // set EthERC20 address:
        await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: deployer});

        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // add connected chain:
        await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});

        // send Eth:
        await lockAndDataForSchain.sendEth(user, amount, {from: deployer});

        // // add schain:
        await lockAndDataForSchain.addSchain(chainID, user, {from: deployer});

        // add Eth cost:
        await tokenManager.addEthCost(amountTo, {from: user});

        const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
        balanceAfter.should.be.deep.equal(amountAfter);

        const ethCosts = new BigNumber(await lockAndDataForSchain.ethCosts(user));
        ethCosts.should.be.deep.equal(amountTo);

        // const lockAndDataBalance = await web3.eth.getBalance(lockAndDataForSchain.address);
        // console.log(lockAndDataBalance);

        // const lockAndDataBalance2 = await web3.eth.getBalance(lockAndDataForMainnet.address);
        // console.log(lockAndDataBalance2);

        // const tokenManagerBalance = await web3.eth.getBalance(tokenManager.address);
        // console.log(tokenManagerBalance);
    });

    it("should rejected with `Not allowed ERC20 Token` when invoke `exitToMainERC20`", async () => {
        const error = "Not allowed ERC20 Token";
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        //
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption
        await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address, {from: deployer});
        //
        await lockAndDataForSchainERC20
            .sendERC20(eRC20OnChain.address, user, amount, {from: deployer});
        //
        await eRC20OnChain.approve(tokenManager.address, amountTo, {from: user});
        // execution/expectation
        await tokenManager.exitToMainERC20(eRC20OnChain.address, client, amountTo, {from: deployer})
            .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with `Not enough gas sent` when invoke `exitToMainERC20`", async () => {
        const error = "Not enough gas sent";
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption
        await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address, {from: deployer});
        await eRC20OnChain.mint(deployer, amount, {from: deployer});
        await eRC20OnChain.approve(tokenManager.address, amountTo, {from: deployer});
        await tokenManager.exitToMainERC20(eRC20OnChain.address, client, amountTo, {from: deployer})
            .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `exitToMainERC20` without mistakes", async () => {
        const amount = "20000000000000000";
        const amountMint =    "10000000000000000";
        const amountToCost = "9000000000000000";
        const amountReduceCoast = "8000000000000000";

        // set EthERC20 address:
        // await lockAndDataForSchain.setEthERC20Address(eRC20OnChain.address, {from: deployer});

        // set contract TokenManager to avoid `Not allowed` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // set contract ERC20ModuleForSchain to avoid `revert` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});

        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});

        // set contract MessageProxy to avoid `Not allowed` exeption on `exitToMainERC20` function:
        // await lockAndDataForSchain.setContract("MessageProxy", messageProxy.address, {from: deployer});

        // add connected chain:
        await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption:
        // await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address, {from: deployer});

        // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exeption:
        await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});

        // invoke `mint` to avoid `SafeMath: subtraction overflow` exeption on `exitToMainERC20` function:
        await eRC20OnChain.mint(deployer, amountMint, {from: deployer});

        // invoke `addGasCosts` to avoid `Not enough gas sent` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.addGasCosts(deployer, amountToCost, {from: deployer});

        // invoke `addERC20Token` to avoid `Not existing ERC-20 contract` exeption on `exitToMainERC20` function:
        await lockAndDataForSchainERC20.addERC20Token(eRC20OnChain.address, 1, {from: deployer});

        // invoke `approve` to avoid `Not allowed ERC20 Token` exeption on `exitToMainERC20` function:
        await eRC20OnChain.approve(tokenManager.address, amountMint, {from: deployer});

        // add schain:
        // await lockAndDataForSchain.addSchain(chainID, tokenManager.address, {from: deployer});

        // execution:
        const res = await tokenManager
            .exitToMainERC20(eRC20OnChain.address, client, amountReduceCoast, {from: deployer});
        // console.log("vasya", res);

        // expectation:
        const outgoingMessagesCounterMainnet = new BigNumber(await messageProxy.getOutgoingMessagesCounter("Mainnet"));
        outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
    });

    it("should rejected with `Not allowed ERC20 Token` when invoke `rawExitToMainERC20`", async () => {
        const error = "Not allowed ERC20 Token";
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        //
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption
        await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address, {from: deployer});
        //
        await lockAndDataForSchainERC20
            .sendERC20(eRC20OnChain.address, user, amount, {from: deployer});
        //
        await eRC20OnChain.approve(tokenManager.address, amountTo, {from: user});
        // execution/expectation
        await tokenManager.rawExitToMainERC20(eRC20OnChain.address, client, deployer, amountTo, {from: deployer})
            .should.be.eventually.rejectedWith(error);
    });

    it("should rejected with `Not enough gas sent` when invoke `rawExitToMainERC20`", async () => {
        const error = "Not enough gas sent";
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});
        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption
        await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address, {from: deployer});
        await eRC20OnChain.mint(deployer, amount, {from: deployer});
        await eRC20OnChain.approve(tokenManager.address, amountTo, {from: deployer});
        await tokenManager.rawExitToMainERC20(eRC20OnChain.address, client, deployer, amountTo, {from: deployer})
            .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `rawExitToMainERC20` without mistakes", async () => {
        const amount = "20000000000000000";
        const amountMint =    "10000000000000000";
        const amountToCost = "9000000000000000";
        const amountReduceCoast = "8000000000000000";

        // set EthERC20 address:
        // await lockAndDataForSchain.setEthERC20Address(eRC20OnChain.address, {from: deployer});

        // set contract TokenManager to avoid `Not allowed` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // set contract ERC20ModuleForSchain to avoid `revert` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});

        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});

        // set contract MessageProxy to avoid `Not allowed` exeption on `exitToMainERC20` function:
        // await lockAndDataForSchain.setContract("MessageProxy", messageProxy.address, {from: deployer});

        // add connected chain:
        await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption:
        // await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address, {from: deployer});

        // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exeption:
        await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});

        // invoke `mint` to avoid `SafeMath: subtraction overflow` exeption on `exitToMainERC20` function:
        await eRC20OnChain.mint(deployer, amountMint, {from: deployer});

        // invoke `addGasCosts` to avoid `Not enough gas sent` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.addGasCosts(deployer, amountToCost, {from: deployer});

        // invoke `addERC20Token` to avoid `Not existing ERC-20 contract` exeption on `exitToMainERC20` function:
        await lockAndDataForSchainERC20.addERC20Token(eRC20OnChain.address, 1, {from: deployer});

        // invoke `approve` to avoid `Not allowed ERC20 Token` exeption on `exitToMainERC20` function:
        await eRC20OnChain.approve(tokenManager.address, amountMint, {from: deployer});

        // add schain:
        // await lockAndDataForSchain.addSchain(chainID, tokenManager.address, {from: deployer});

        // execution:
        await tokenManager
            .rawExitToMainERC20(eRC20OnChain.address, client, deployer, amountReduceCoast, {from: deployer});

        // expectation:
        const outgoingMessagesCounterMainnet = new BigNumber(await messageProxy.getOutgoingMessagesCounter("Mainnet"));
        outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
    });

    it("should rejected with `Not allowed ERC20 Token` when invoke `transferToSchainERC20`", async () => {
        const error = "Not allowed ERC20 Token";
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);

        // set contracts:
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});

        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption:
        await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address, {from: deployer});

        //
        await lockAndDataForSchainERC20
            .sendERC20(eRC20OnChain.address, user, amount, {from: deployer});
        //
        await eRC20OnChain.approve(tokenManager.address, amountTo, {from: user});
        // execution/expectation
        await tokenManager.exitToMainERC20(eRC20OnChain.address, client, amountTo, {from: deployer})
            .should.be.eventually.rejectedWith(error);
    });

    it("should invoke `transferToSchainERC20` without mistakes", async () => {
        const amount =            "20000000000000000";
        const amountMint =        "10000000000000000";
        const amountToCost =      "9000000000000000";
        const amountReduceCoast = "8000000000000000";

        // set EthERC20 address:
        // await lockAndDataForSchain.setEthERC20Address(eRC20OnChain.address, {from: deployer});

        // set contract TokenManager to avoid `Not allowed` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // set contract ERC20ModuleForSchain to avoid `revert` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC20Module", eRC20ModuleForSchain.address, {from: deployer});

        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC20", lockAndDataForSchainERC20.address, {from: deployer});

        // set contract MessageProxy to avoid `Not allowed` exeption on `exitToMainERC20` function:
        // await lockAndDataForSchain.setContract("MessageProxy", messageProxy.address, {from: deployer});

        // add connected chain:
        await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption:
        // await eRC20OnChain.addMinter(lockAndDataForSchainERC20.address, {from: deployer});

        // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exeption:
        await eRC20OnChain.setTotalSupplyOnMainnet(amount, {from: deployer});

        // invoke `mint` to avoid `SafeMath: subtraction overflow` exeption on `exitToMainERC20` function:
        await eRC20OnChain.mint(deployer, amountMint, {from: deployer});

        // invoke `addGasCosts` to avoid `Not enough gas sent` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.addGasCosts(deployer, amountToCost, {from: deployer});

        // invoke `addERC20Token` to avoid `Not existing ERC-20 contract` exeption on `exitToMainERC20` function:
        await lockAndDataForSchainERC20.addERC20Token(eRC20OnChain.address, 1, {from: deployer});

        // invoke `approve` to avoid `Not allowed ERC20 Token` exeption on `exitToMainERC20` function:
        await eRC20OnChain.approve(tokenManager.address, amountMint, {from: deployer});

        // add schain:
        // await lockAndDataForSchain.addSchain(chainID, tokenManager.address, {from: deployer});

        // execution:
        await tokenManager
            .transferToSchainERC20(chainID, eRC20OnChain.address, client, amountReduceCoast, {from: deployer});

        // expectation:
        const outgoingMessagesCounterMainnet = new BigNumber(await messageProxy.getOutgoingMessagesCounter(chainID));
        outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));
    });

    it("should rejected with `Not allowed ERC721 Token` when invoke `exitToMainERC721`", async () => {
        const error = "Not allowed ERC721 Token";
        const amountMint =    "10000000000000000";
        const amountToCost = "9000000000000000";
        const amountReduceCoast = "8000000000000000";
        const tokenId = 10;

        // set EthERC20 address:
        // await lockAndDataForSchain.setEthERC20Address(eRC20OnChain.address, {from: deployer});

        // set contract TokenManager to avoid `Not allowed` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // set contract ERC20ModuleForSchain to avoid `revert` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});

        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});

        
        // set contract MessageProxy to avoid `Not allowed` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("MessageProxy", messageProxy.address, {from: deployer});

        // add connected chain:
        await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        await lockAndDataForSchainERC721
            .addERC721Token(eRC20OnChain.address, 1, {from: deployer});

        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption:
        await eRC721OnChain.addMinter(lockAndDataForSchainERC721.address);

        await eRC721OnChain.addMinter(deployer);

        // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exeption:
        // await eRC721OnChain.


        // invoke `mint` to avoid `SafeMath: subtraction overflow` exeption on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});

        // invoke `addGasCosts` to avoid `Not enough gas sent` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.addGasCosts(deployer, amountToCost, {from: deployer});

        // invoke `addERC20Token` to avoid `Not existing ERC-20 contract` exeption on `exitToMainERC20` function:
        await lockAndDataForSchainERC721.addERC721Token(eRC721OnChain.address, 1, {from: deployer});

        // invoke `approve` to avoid `Not allowed ERC20 Token` exeption on `exitToMainERC20` function:
        await eRC721OnChain.approve(tokenManager.address, tokenId, {from: deployer});

        // add schain:
        // await lockAndDataForSchain.addSchain(chainID, tokenManager.address, {from: deployer});


        // execution:
        await tokenManager
            .exitToMainERC721(eRC721OnChain.address, client, tokenId, {from: deployer})
            .should.be.eventually.rejectedWith(error);

    });

    it("should rejected with `Not enough gas sent` when invoke `exitToMainERC721`", async () => {
        const error = "Not enough gas sent";
        const tokenId = 10;

        // set EthERC20 address:
        // await lockAndDataForSchain.setEthERC20Address(eRC20OnChain.address, {from: deployer});

        // set contract TokenManager to avoid `Not allowed` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // set contract ERC20ModuleForSchain to avoid `revert` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});

        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});

        
        // set contract MessageProxy to avoid `Not allowed` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("MessageProxy", messageProxy.address, {from: deployer});

        // add connected chain:
        await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        await lockAndDataForSchainERC721
            .addERC721Token(eRC20OnChain.address, 1, {from: deployer});

        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption:
        await eRC721OnChain.addMinter(lockAndDataForSchainERC721.address);

        await eRC721OnChain.addMinter(deployer);

        // invoke `setTotalSupplyOnMainnet` before `mint` to avoid `SafeMath: subtraction overflow` exeption:
        // await eRC721OnChain.


        // invoke `mint` to avoid `SafeMath: subtraction overflow` exeption on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});

        // invoke `addGasCosts` to avoid `Not enough gas sent` exeption on `exitToMainERC20` function:
        // await lockAndDataForSchain.addGasCosts(deployer, amountToCost, {from: deployer});

        // invoke `addERC20Token` to avoid `Not existing ERC-20 contract` exeption on `exitToMainERC20` function:
        await lockAndDataForSchainERC721.addERC721Token(eRC721OnChain.address, 1, {from: deployer});


        // add schain:
        // await lockAndDataForSchain.addSchain(chainID, tokenManager.address, {from: deployer});

        await eRC721OnChain.transferFrom(deployer, tokenManager.address, tokenId, {from: deployer});

        // execution:
        const res = await tokenManager
            .exitToMainERC721(eRC721OnChain.address, client, tokenId, {from: deployer})
            .should.be.eventually.rejectedWith(error);

    });

    it("should invoke `exitToMainERC721` without mistakes", async () => {
        const amount = "20000000000000000";
        const amountMint =    "10000000000000000";
        const amountToCost = "9000000000000000";
        const amountReduceCoast = "8000000000000000";
        const tokenId = 10;
        const contractPosition = 1;
        const contractHere = eRC721OnChain.address;
        const to = user;
        // set EthERC20 address:
        // await lockAndDataForSchain.setEthERC20Address(eRC20OnChain.address, {from: deployer});

        // set contract TokenManager to avoid `Not allowed` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // // set contract ERC20ModuleForSchain to avoid `revert` exeption on `exitToMainERC20` function:
        // await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});

        // to avoid "Message sender is invalid" error
        await lockAndDataForSchain
            .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});

        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});

        
        // set contract MessageProxy to avoid `Not allowed` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("MessageProxy", messageProxy.address, {from: deployer});

        // add connected chain:
        await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        await lockAndDataForSchainERC721
            .addERC721Token(contractHere, contractPosition, {from: deployer});

        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption:
        await eRC721OnChain.addMinter(deployer);
        // to avoid "Message sender is invalid" error
        await eRC721OnChain.addMinter(lockAndDataForSchainERC721.address);

        // invoke `mint` to avoid `SafeMath: subtraction overflow` exeption on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});

        // invoke `addGasCosts` to avoid `Not enough gas sent` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.addGasCosts(deployer, amountToCost, {from: deployer});
        // await lockAndDataForSchain.addGasCosts(tokenManager.address, amountReduceCoast, {from: deployer});

        // invoke `approve` to avoid `Not allowed ERC20 Token` exeption on `exitToMainERC20` function:
        // await eRC721OnChain.approve(tokenManager.address, tokenId, {from: deployer});

        console.log(1);
        // add schain:
        // await lockAndDataForSchain.addSchain(chainID, tokenManager.address, {from: deployer});

        await eRC721OnChain.transferFrom(deployer, tokenManager.address, tokenId, {from: deployer});
        console.log(2);
        // execution:
        const res = await tokenManager
            .exitToMainERC721(contractHere, to, tokenId, {from: deployer});
        console.log("vasya", res);


        // expectation:
        // const outgoingMessagesCounterMainnet = new BigNumber(await messageProxy.getOutgoingMessagesCounter("Mainnet"));
        // outgoingMessagesCounterMainnet.should.be.deep.equal(new BigNumber(1));

        // const balanceDeployer = new BigNumber(await eRC20OnChain.balanceOf(deployer));
        // console.log("balanceDeployer = ", balanceDeployer);
        // const balanceClient = new BigNumber(await eRC20OnChain.balanceOf(client));
        // console.log("balanceClient = ", balanceClient);
        // const ethCostsDep = new BigNumber(await lockAndDataForSchain.ethCosts(deployer));
        // console.log("ethCostsDep = ", ethCostsDep);
        // const ethCostsCl = new BigNumber(await lockAndDataForSchain.ethCosts(client));
        // console.log("ethCostsCl = ", ethCostsCl);
        // const eRC20OnChainBalance = await web3.eth.getBalance(eRC20OnChain.address);
        // console.log("eRC20OnChainBalance = ", eRC20OnChainBalance);
        // const tokenManagerBalance = await web3.eth.getBalance(tokenManager.address);
        // console.log("tokenManagerBalance = ", tokenManagerBalance);
        // const lockAndDataForSchainBalance = await web3.eth.getBalance(lockAndDataForSchain.address);
        // console.log("lockAndDataForSchainBalance = ", lockAndDataForSchainBalance);
        // const lockAndDataForMainnetBalance = await web3.eth.getBalance(lockAndDataForMainnet.address);
        // console.log("lockAndDataForMainnetBalance = ", lockAndDataForMainnetBalance);
        // const eRC20ModuleForSchainBalance = await web3.eth.getBalance(eRC20ModuleForSchain.address);
        // console.log("eRC20ModuleForSchainBalance = ", eRC20ModuleForSchainBalance);
        // const outgoingMessagesCounter = new BigNumber(await messageProxy.getOutgoingMessagesCounter(chainID));
        // console.log("outgoingMessagesCounter = ", outgoingMessagesCounter);
        // const outgoingMessagesCounterMainnet = new BigNumber(await messageProxy.getOutgoingMessagesCounter("Mainnet"));
        // console.log("outgoingMessagesCounterMainnet = ", outgoingMessagesCounterMainnet);

    });
    it("should invoke `rawExitToMainERC721` without mistakes", async () => {
        const amount = "20000000000000000";
        const amountMint =    "10000000000000000";
        const amountToCost = "9000000000000000";
        const amountReduceCoast = "8000000000000000";
        const tokenId = 10;
        const contractPosition = 1;
        const contractHere = eRC721OnChain.address;
        const contractThere = eRC721.address;
        const to = user;
        // set EthERC20 address:
        // await lockAndDataForSchain.setEthERC20Address(eRC20OnChain.address, {from: deployer});

        // set contract TokenManager to avoid `Not allowed` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        // // set contract ERC20ModuleForSchain to avoid `revert` exeption on `exitToMainERC20` function:
        // await lockAndDataForSchain.setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});

        // to avoid "Message sender is invalid" error
        await lockAndDataForSchain
            .setContract("ERC721Module", eRC721ModuleForSchain.address, {from: deployer});

        // set contract lockAndDataForSchainERC20 to avoid
        // `ERC20: transfer to the zero address` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain
            .setContract("LockAndDataERC721", lockAndDataForSchainERC721.address, {from: deployer});

        
        // set contract MessageProxy to avoid `Not allowed` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.setContract("MessageProxy", messageProxy.address, {from: deployer});

        // add connected chain:
        await messageProxy.addConnectedChain(chainID, publicKeyArray, {from: deployer});

        await lockAndDataForSchainERC721
            .addERC721Token(contractHere, contractPosition, {from: deployer});

        // invoke `addMinter` before `sendERC20` to avoid `MinterRole: caller does not have the Minter role` exeption:
        await eRC721OnChain.addMinter(deployer);
        // to avoid "Message sender is invalid" error
        await eRC721OnChain.addMinter(lockAndDataForSchainERC721.address);

        // invoke `mint` to avoid `SafeMath: subtraction overflow` exeption on `exitToMainERC20` function:
        await eRC721OnChain.mint(deployer, tokenId, {from: deployer});

        // invoke `addGasCosts` to avoid `Not enough gas sent` exeption on `exitToMainERC20` function:
        await lockAndDataForSchain.addGasCosts(deployer, amountToCost, {from: deployer});
        // await lockAndDataForSchain.addGasCosts(tokenManager.address, amountReduceCoast, {from: deployer});

        // invoke `approve` to avoid `Not allowed ERC20 Token` exeption on `exitToMainERC20` function:
        // await eRC721OnChain.approve(tokenManager.address, tokenId, {from: deployer});

        console.log(1);
        // add schain:
        // await lockAndDataForSchain.addSchain(chainID, tokenManager.address, {from: deployer});

        await eRC721OnChain.transferFrom(deployer, tokenManager.address, tokenId, {from: deployer});
        console.log(2);
        // execution:
        const res = await tokenManager
            .rawExitToMainERC721(contractHere, contractThere, to, tokenId, {from: deployer});
        console.log("vasya", res);

    });

//     it("should send ERC20 token to somebody on Mainnet, closed to Mainnet, called by schain", async () => {
//         const amount = new BigNumber(200);
//         const amountTo = new BigNumber(20);
//         const amountAfter = new BigNumber(180);

//         // set EthERC20 address:
//         await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: deployer});

//         // set contract TokenManager:
//         await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

//         await lockAndDataForSchain.setContract("ERC20ModuleForSchain", eRC20ModuleForSchain.address, {from: deployer});
//         await lockAndDataForSchain
//         .setContract("LockAndDataForSchainERC20", lockAndDataForSchainERC20.address, {from: deployer});

//         // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
//         await ethERC20.transferOwnership(lockAndDataForSchainERC20.address, {from: deployer});

//         // send ERC20:
//         await lockAndDataForSchainERC20.sendERC20(ethERC20.address, user, amount, {from: deployer});

//         // await ethERC20.mint(client, amountTo, {from: user});
//         await ethERC20.approve(tokenManager.address, amountTo, {from: user});         // "Not allowed ERC20 Token"

// //        await tokenManager.rawExitToMainERC20(contractHere.address, contractThere.addrress, client, amountTo, {from: user});

//         // const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
//         // balanceAfter.should.be.deep.equal(amountAfter);
//     });
});
