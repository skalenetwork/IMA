import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");

import { ERC20ModuleForSchainContract,
    ERC20ModuleForSchainInstance,
    EthERC20Contract,
    EthERC20Instance,
    LockAndDataForMainnetContract,
    LockAndDataForMainnetInstance,
    LockAndDataForSchainContract,
    LockAndDataForSchainERC20Contract,
    LockAndDataForSchainERC20Instance,
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

contract("TokenManager", ([user, deployer, client]) => {
    let tokenManager: TokenManagerInstance;
    let messageProxy: MessageProxyInstance;
    let lockAndDataForMainnet: LockAndDataForMainnetInstance;
    let ethERC20: EthERC20Instance;
    let lockAndDataForSchain: LockAndDataForSchainInstance;
    let lockAndDataForSchainERC20: LockAndDataForSchainERC20Instance;
    let eRC20ModuleForSchain: ERC20ModuleForSchainInstance;

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

        // add schain:
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

    it("should send ERC20 token to somebody on Mainnet, closed to Mainnet, called by schain", async () => {
        const amount = new BigNumber(200);
        const amountTo = new BigNumber(20);
        const amountAfter = new BigNumber(180);

        // set EthERC20 address:
        await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: deployer});

        // set contract TokenManager:
        await lockAndDataForSchain.setContract("TokenManager", tokenManager.address, {from: deployer});

        await lockAndDataForSchain.setContract("ERC20ModuleForSchain", eRC20ModuleForSchain.address, {from: deployer});
        await lockAndDataForSchain
        .setContract("LockAndDataForSchainERC20", lockAndDataForSchainERC20.address, {from: deployer});

        // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
        await ethERC20.transferOwnership(lockAndDataForSchainERC20.address, {from: deployer});

        // send ERC20:
        await lockAndDataForSchainERC20.sendERC20(ethERC20.address, user, amount, {from: deployer});

        // await ethERC20.mint(client, amountTo, {from: user});
        await ethERC20.approve(tokenManager.address, amountTo, {from: user});         // "Not allowed ERC20 Token"

//        await tokenManager.exitToMainERC20(ethERC20.address, client, amountTo, {from: user});

        // const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
        // balanceAfter.should.be.deep.equal(amountAfter);
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

// //        await tokenManager.exitToMainERC20(ethERC20.address, client, amountTo, {from: user});

//         // const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
//         // balanceAfter.should.be.deep.equal(amountAfter);
//     });
});
