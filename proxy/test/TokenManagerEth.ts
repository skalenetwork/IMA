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
 * @file TokenManagerEth.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");
import { EthERC20TesterContract,
  EthERC20TesterInstance,
  MessageProxyForSchainContract,
  MessageProxyForSchainInstance,
  MessagesTesterContract,
  MessagesTesterInstance,
  SkaleFeaturesMockContract,
  SkaleFeaturesMockInstance,
  TokenManagerEthContract,
  TokenManagerEthInstance,
  TokenManagerLinkerContract,
  TokenManagerLinkerInstance,
  } from "../types/truffle-contracts";
import { gasMultiplier } from "./utils/command_line";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

const TokenManagerEth: TokenManagerEthContract = artifacts.require("./TokenManagerEth");
const TokenManagerLinker: TokenManagerLinkerContract = artifacts.require("./TokenManagerLinker");
const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const MessagesTester: MessagesTesterContract = artifacts.require("./MessagesTester");
const EthERC20Tester: EthERC20TesterContract = artifacts.require("./EthERC20Tester");
const SkaleFeaturesMock: SkaleFeaturesMockContract = artifacts.require("./SkaleFeaturesMock");

const schainName = "TestSchain";

contract("TokenManagerEth", ([user, deployer]) => {
  let tokenManagerEth: TokenManagerEthInstance;
  let tokenManagerLinker: TokenManagerLinkerInstance;
  let messageProxyForSchain: MessageProxyForSchainInstance;
  let messages: MessagesTesterInstance;
  let ethERC20: EthERC20TesterInstance;
  let skaleFeatures: SkaleFeaturesMockInstance;

  beforeEach(async () => {
    messageProxyForSchain = await MessageProxyForSchain.new(
      schainName,
      {
        from: deployer,
        gas: 8000000 * gasMultiplier
      }
    );
    tokenManagerLinker = await TokenManagerLinker.new(
      messageProxyForSchain.address,
      {
        from: deployer,
        gas: 8000000 * gasMultiplier
      }
    );
    tokenManagerEth = await TokenManagerEth.new(
      schainName,
      messageProxyForSchain.address,
      tokenManagerLinker.address,
      deployer,
      {
        from: deployer,
        gas: 8000000 * gasMultiplier
      }
    );
    ethERC20 = await EthERC20Tester.new(
      tokenManagerEth.address,
      {
        from: deployer,
        gas: 8000000 * gasMultiplier
      }
    );
    messages = await MessagesTester.new(
      {
        from: deployer,
        gas: 8000000 * gasMultiplier
      }
    );
    skaleFeatures = await SkaleFeaturesMock.new(
      {
        from: deployer,
        gas: 8000000 * gasMultiplier
      }
    );
    await skaleFeatures.setSchainOwner(deployer);
    const skaleFeaturesSetterRole = await tokenManagerEth.SKALE_FEATURES_SETTER_ROLE();
    await tokenManagerEth.grantRole(skaleFeaturesSetterRole, deployer, {from: deployer});
    await tokenManagerEth.setSkaleFeaturesAddress(skaleFeatures.address, {from: deployer});
  });

  it("should set EthERC20 address", async () => {
    // only owner can set EthERC20 address:
    await tokenManagerEth.setEthErc20Address(ethERC20.address, {from: user}).should.be.rejected;
    await tokenManagerEth.setEthErc20Address(ethERC20.address, {from: deployer});

    // address which has been set should be equal to deployed contract address;
    const address = await tokenManagerEth.getEthErc20Address();
    expect(address).to.equal(ethERC20.address);
  });

  // it("should add deposit box", async () => {
  //   const depositBoxAddress = user;
  //   const nullAddress = "0x0000000000000000000000000000000000000000";

  //   // only owner can add deposit box:
  //   await tokenManagerEth.addDepositBox(depositBoxAddress, {from: user}).should.be.rejected;

  //   // deposit box address shouldn't be equal zero:
  //   await tokenManagerEth.addDepositBox(nullAddress, {from: deployer})
  //     .should.be.rejectedWith("Incorrect DepositBoxEth address");

  //   // add deposit box:
  //   await tokenManagerEth.addDepositBox(depositBoxAddress, {from: deployer});

  //   // deposit box can't be added twice:
  //   await tokenManagerEth.addDepositBox(depositBoxAddress, {from: deployer}).
  //   should.be.rejectedWith("DepositBox is already set");

  //   const storedDepositBox = await tokenManagerEth.depositBox();
  //   expect(storedDepositBox).to.equal(depositBoxAddress);
  // });

  // it("should return true when invoke `hasDepositBox`", async () => {
  //   // preparation
  //   const depositBoxAddress = user;
  //   // add schain for return `true` after `hasDepositBox` invoke
  //   await tokenManagerEth.addDepositBox(depositBoxAddress, {from: deployer});
  //   // execution
  //   const res = await tokenManagerEth
  //     .hasDepositBox({from: deployer});
  //   // expectation
  //   expect(res).to.be.true;
  // });

  // it("should return false when invoke `hasDepositBox`", async () => {
  //   // preparation
  //   const depositBoxAddress = user;
  //   // execution
  //   const res = await tokenManagerEth
  //     .hasDepositBox({from: deployer});
  //   // expectation
  //   expect(res).to.be.false;
  // });

  // it("should invoke `removeDepositBox` without mistakes", async () => {
  //   // preparation
  //   const depositBoxAddress = user;
  //   const nullAddress = "0x0000000000000000000000000000000000000000";
  //   // add deposit box:
  //   await tokenManagerEth.addDepositBox(depositBoxAddress, {from: deployer});
  //   // execution
  //   await tokenManagerEth.removeDepositBox({from: deployer});
  //   // expectation
  //   const getMapping = await tokenManagerEth.depositBox();
  //   expect(getMapping).to.equal(nullAddress);
  // });

  // it("should invoke `removeDepositBox` with 0 depositBoxes", async () => {
  //   // preparation
  //   const error = "Deposit Box is not set";
  //   // execution/expectation
  //   await tokenManagerEth.removeDepositBox({from: deployer}).should.be.rejectedWith("DepositBox is not set");
  // });

  it("should add tokenManager", async () => {
    const tokenManagerAddress = user;
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const schainName2 = "TestSchain2";

    // only owner can add deposit box:
    await tokenManagerEth.addTokenManager(schainName2, tokenManagerAddress, {from: user}).should.be.rejected;

    // deposit box address shouldn't be equal zero:
    await tokenManagerEth.addTokenManager(schainName2, nullAddress, {from: deployer})
      .should.be.rejectedWith("Incorrect Token Manager address");

    // add deposit box:
    await tokenManagerEth.addTokenManager(schainName2, tokenManagerAddress, {from: deployer});

    // deposit box can't be added twice:
    await tokenManagerEth.addTokenManager(schainName2, tokenManagerAddress, {from: deployer}).
    should.be.rejectedWith("Token Manager is already set");

    const storedDepositBox = await tokenManagerEth.tokenManagers(web3.utils.soliditySha3(schainName2));
    expect(storedDepositBox).to.equal(tokenManagerAddress);
  });

  it("should return true when invoke `hasTokenManager`", async () => {
    // preparation
    const tokenManagerAddress = user;
    const schainName2 = "TestSchain2";
    // add schain for return `true` after `hasTokenManager` invoke
    await tokenManagerEth.addTokenManager(schainName2, tokenManagerAddress, {from: deployer});
    // execution
    const res = await tokenManagerEth
      .hasTokenManager(schainName2, {from: deployer});
    // expectation
    expect(res).to.be.true;
  });

  it("should return false when invoke `hasTokenManager`", async () => {
    // preparation
    const schainName2 = "TestSchain2";
    // execution
    const res = await tokenManagerEth
      .hasTokenManager(schainName2, {from: deployer});
    // expectation
    expect(res).to.be.false;
  });

  it("should invoke `removeTokenManager` without mistakes", async () => {
    // preparation
    const tokenManagerAddress = user;
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const schainName2 = "TestSchain2";
    // add deposit box:
    await tokenManagerEth.addTokenManager(schainName2, tokenManagerAddress, {from: deployer});
    // execution
    await tokenManagerEth.removeTokenManager(schainName2, {from: deployer});
    // expectation
    const getMapping = await tokenManagerEth.tokenManagers(web3.utils.soliditySha3(schainName2));
    expect(getMapping).to.equal(nullAddress);
  });

  it("should invoke `removeTokenManager` with 0 depositBoxes", async () => {
    // preparation
    const error = "Token Manager is not set";
    const schainName2 = "TestSchain2";
    // execution/expectation
    await tokenManagerEth.removeTokenManager(schainName2, {from: deployer}).should.be.rejectedWith(error);
  });

  it("should send Eth to somebody on Mainnet, closed to Mainnet, called by schain", async () => {
    const amount = new BigNumber("600000000000000000");
    const amountTo = new BigNumber("20000000000000000");
    const amountTo2 = new BigNumber("60000000000000000");
    const amountAfter = new BigNumber("540000000000000000");
    const to = deployer;

    // set EthERC20 address:
    await tokenManagerEth.setEthErc20Address(ethERC20.address, {from: deployer});

    // set contract TokenManagerEth:
    await ethERC20.setTokenManagerEthAddress(deployer, {from: deployer});

    await ethERC20.mint(user, amount, {from: deployer});

    await ethERC20.setTokenManagerEthAddress(tokenManagerEth.address, {from: deployer});

    // transfer ownership of using ethERC20 contract method to tokenManagerEth contract address:
    // await ethERC20.transferOwnership(tokenManagerEth.address, {from: deployer});

    // send Eth:
    // await tokenManagerEth.sendEth(user, amount, {from: deployer});

    // send Eth to a client on Mainnet:
    await tokenManagerEth.exitToMain(to, amountTo, {from: user}).should.be.eventually.rejectedWith("Not enough funds to exit");
    await tokenManagerEth.exitToMain(to, amountTo2, {from: user});
    const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
    balanceAfter.should.be.deep.equal(amountAfter);
});

  it("should transfer to somebody on schain Eth and some data", async () => {
      const amount = new BigNumber("20000000000000000");
      const amountTo = new BigNumber("2000000000000000");
      const amountAfter = new BigNumber("18000000000000000");
      const bytesData = "0x0";
      const to = deployer;

      // set EthERC20 address:
      await tokenManagerEth.setEthErc20Address(ethERC20.address, {from: deployer});

      // set contract TokenManagerEth:
      // await tokenManagerEth.setContract("TokenManagerEth", tokenManagerEth.address, {from: deployer});

      const chainConnectorRole = await messageProxyForSchain.CHAIN_CONNECTOR_ROLE();
      await messageProxyForSchain.grantRole(chainConnectorRole, deployer, {from: deployer});

      // add connected chain:
      await messageProxyForSchain.addConnectedChain(schainName, {from: deployer});

      // transfer ownership of using ethERC20 contract method to tokenManagerEth contract address:
      await ethERC20.setTokenManagerEthAddress(deployer, {from: deployer});

      await ethERC20.mint(user, amount, {from: deployer});

      await ethERC20.setTokenManagerEthAddress(tokenManagerEth.address, {from: deployer});

      // add schain:
      await tokenManagerEth.addTokenManager(schainName, user, {from: deployer});

      // send Eth and data to a client on schain:
      await tokenManagerEth.transferToSchain(schainName, to, amountTo, {from: user});

      const balanceAfter = new BigNumber(await ethERC20.balanceOf(user));
      balanceAfter.should.be.deep.equal(amountAfter);
  });

  describe("tests for `postMessage` function", async () => {
    it("should rejected with `Not a sender`", async () => {
      //  preparation
      const error = "Not a sender";
      const schainID = randomString(10);
      const amount = 10;
      const bytesData = await messages.encodeTransferEthMessage(user, amount);

      const sender = deployer;
      // execution/expectation
      await tokenManagerEth
        .postMessage(schainName, sender, bytesData, {from: deployer})
        .should.be.eventually.rejectedWith(error);
    });

    it("should be Error event with message `Receiver chain is incorrect` when schainID=`mainnet`", async () => {
      //  preparation
      const error = "Receiver chain is incorrect";
      // for `Receiver chain is incorrect` message schainID should be `Mainnet`
      const schainID = randomString(10);
      const amount = 10;
      const bytesData = await messages.encodeTransferEthMessage(user, amount);
      const sender = deployer;
      // redeploy tokenManagerEth with `developer` address instead `messageProxyForSchain.address`
      // to avoid `Not a sender` error
      tokenManagerEth = await TokenManagerEth.new(schainID, deployer, tokenManagerLinker.address, deployer, {from: deployer});
      // await tokenManagerEth.setContract("MessageProxy", deployer, {from: deployer});
      // execution
      await tokenManagerEth
          .postMessage(schainName, sender, bytesData, {from: deployer})
          .should.be.eventually.rejectedWith(error);
    });

    it("should be Error event with message `null`", async () => {
        //  preparation
        const error = "Invalid data";
        const schainID = randomString(10);
        const amount = 10;
        // for `Invalid data` message bytesData should be `0x`
        const bytesData = "0x";
        const sender = deployer;
        // redeploy tokenManagerEth with `developer` address instead `messageProxyForSchain.address`
        // to avoid `Not a sender` error
        tokenManagerEth = await TokenManagerEth.new(schainName, deployer, tokenManagerLinker.address, deployer, {from: deployer});
        // set `tokenManagerEth` contract to avoid the `Not allowed` error in tokenManagerEth.sol
        const skaleFeaturesSetterRole = await tokenManagerEth.SKALE_FEATURES_SETTER_ROLE();
        await tokenManagerEth.grantRole(skaleFeaturesSetterRole, deployer, {from: deployer});
        await tokenManagerEth.setSkaleFeaturesAddress(skaleFeatures.address, {from: deployer});
        // add schain to avoid the `Receiver chain is incorrect` error
        await tokenManagerEth
            .addTokenManager(schainID, deployer, {from: deployer});
        // execution
        await tokenManagerEth
            .postMessage(schainID, sender, bytesData, {from: deployer})
            .should.be.rejected;
    });

    it("should transfer eth", async () => {
        //  preparation
        const schainID = randomString(10);
        const amount = "10";
        const sender = deployer;
        const to = user;
        // for transfer eth bytesData should be equal `0x01`. See the `.fallbackOperationTypeConvert` function
        const bytesData = await messages.encodeTransferEthMessage(to, amount);
        // redeploy tokenManagerEth with `developer` address instead `messageProxyForSchain.address`
        // to avoid `Not a sender` error
        tokenManagerEth = await TokenManagerEth.new(schainName, deployer, tokenManagerLinker.address, deployer, {from: deployer});
        // set `tokenManagerEth` contract to avoid the `Not allowed` error in tokenManagerEth.sol
        const skaleFeaturesSetterRole = await tokenManagerEth.SKALE_FEATURES_SETTER_ROLE();
        await tokenManagerEth.grantRole(skaleFeaturesSetterRole, deployer, {from: deployer});
        await tokenManagerEth.setSkaleFeaturesAddress(skaleFeatures.address, {from: deployer});
        // add schain to avoid the `Receiver chain is incorrect` error
        await tokenManagerEth
            .addTokenManager(schainID, deployer, {from: deployer});
        // set EthERC20 address:
        await tokenManagerEth.setEthErc20Address(ethERC20.address, {from: deployer});
        await ethERC20.setTokenManagerEthAddress(tokenManagerEth.address, {from: deployer});
        // execution
        await tokenManagerEth
            .postMessage(schainID, sender, bytesData, {from: deployer});
        // expectation
        expect(parseInt((new BigNumber(await ethERC20.balanceOf(to))).toString(), 10))
            .to.be.equal(parseInt(amount, 10));
    });
  });

});
