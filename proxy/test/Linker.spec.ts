// // SPDX-License-Identifier: AGPL-3.0-only

// /**
//  * @license
//  * SKALE IMA
//  *
//  * This program is free software: you can redistribute it and/or modify
//  * it under the terms of the GNU Affero General Public License as published by
//  * the Free Software Foundation, either version 3 of the License, or
//  * (at your option) any later version.
//  *
//  * This program is distributed in the hope that it will be useful,
//  * but WITHOUT ANY WARRANTY; without even the implied warranty of
//  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  * GNU Affero General Public License for more details.
//  *
//  * You should have received a copy of the GNU Affero General Public License
//  * along with this program.  If not, see <https://www.gnu.org/licenses/>.
//  */

// /**
//  * @file Linker.spec.ts
//  * @copyright SKALE Labs 2019-Present
//  */

import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
  ContractManager,
  DepositBoxEth,
  DepositBoxERC20,
  DepositBoxERC721,
  Linker,
  MessageProxyForMainnet,
  } from "../typechain";
import { randomString, stringValue } from "./utils/helper";


chai.should();
chai.use((chaiAsPromised as any));

import { deployDepositBoxEth } from "./utils/deploy/mainnet/depositBoxEth";
import { deployDepositBoxERC20 } from "./utils/deploy/mainnet/depositBoxERC20";
import { deployDepositBoxERC721 } from "./utils/deploy/mainnet/depositBoxERC721";
import { deployLinker } from "./utils/deploy/mainnet/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("Linker", () => {
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;

  let depositBoxEth: DepositBoxEth;
  let depositBoxERC20: DepositBoxERC20;
  let depositBoxERC721: DepositBoxERC721;
  let contractManager: ContractManager;
  let messageProxy: MessageProxyForMainnet;
  let linker: Linker;
  let contractManagerAddress = "0x0000000000000000000000000000000000000000";

  before(async () => {
    [deployer, user, user2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    contractManager = await deployContractManager(contractManagerAddress);
    contractManagerAddress = contractManager.address;
    messageProxy = await deployMessageProxyForMainnet(contractManager);
    linker = await deployLinker(messageProxy);
    depositBoxEth = await deployDepositBoxEth(contractManager, messageProxy, linker);
    depositBoxERC20 = await deployDepositBoxERC20(contractManager, messageProxy, linker);
    depositBoxERC721 = await deployDepositBoxERC721(contractManager, messageProxy, linker);
    await linker.removeDepositBox(depositBoxEth.address);
    await linker.removeDepositBox(depositBoxERC20.address);
    await linker.removeDepositBox(depositBoxERC721.address);
  });

  it("should connect schain", async () => {
    const schainID = randomString(10);
    const nullAddress = "0x0000000000000000000000000000000000000000";

    // only owner can add schain:
    await linker.connect(user).connectSchain(schainID, []).should.be.rejected;

    // Token Manager address shouldn't be equal zero:
    await linker.connect(deployer).connectSchain(schainID, [nullAddress])
        .should.be.eventually.rejectedWith("Incorrect number of addresses");

    await linker.connect(deployer).connectSchain(schainID, []);
  });

  it("should connect schain with 1 tokenManager", async() => {
    const schainID = randomString(10);
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const tokenManagerAddress = user.address;

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(false);

    await linker.connect(deployer).registerDepositBox(depositBoxEth.address);

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(true);

    await linker.connect(deployer).connectSchain(schainID, [])
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

    await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress, nullAddress])
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

    expect(await linker.hasSchain(schainID)).to.equal(false);

    await linker.connect(deployer).connectSchain(schainID, [nullAddress])
      .should.be.eventually.rejectedWith("Incorrect Token Manager address");

    await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress])

    expect(await linker.hasSchain(schainID)).to.equal(true);

  });

  it("should connect schain with 3 tokenManager", async() => {
    const schainID = randomString(10);
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const tokenManagerAddress = user.address;

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC20.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC721.address)).to.equal(false);

    await linker.connect(deployer).registerDepositBox(depositBoxEth.address);
    await linker.connect(deployer).registerDepositBox(depositBoxERC20.address);
    await linker.connect(deployer).registerDepositBox(depositBoxERC721.address);

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(true);
    expect(await linker.hasDepositBox(depositBoxERC20.address)).to.equal(true);
    expect(await linker.hasDepositBox(depositBoxERC721.address)).to.equal(true);

    await linker.connect(deployer).connectSchain(schainID, [])
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

    await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress])
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

    await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress, nullAddress])
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

    expect(await linker.hasSchain(schainID)).to.equal(false);

    await linker.connect(deployer).connectSchain(schainID, [nullAddress, tokenManagerAddress, nullAddress])
      .should.be.eventually.rejectedWith("Incorrect Token Manager address");

    await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress, tokenManagerAddress, tokenManagerAddress])

    expect(await linker.hasSchain(schainID)).to.equal(true);
  });

  it("should invoke `unconnectSchain` without mistakes", async () => {
    const schainID = randomString(10);
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const tokenManagerAddress = user.address;

    await linker.connect(deployer).registerDepositBox(depositBoxEth.address);
    await linker.connect(deployer).registerDepositBox(depositBoxERC20.address);
    await linker.connect(deployer).registerDepositBox(depositBoxERC721.address);

    await linker.connect(deployer).connectSchain(schainID, [tokenManagerAddress, tokenManagerAddress, tokenManagerAddress]);

    expect(await linker.hasSchain(schainID)).to.equal(true);

    await linker.connect(user).unconnectSchain(schainID).should.be.rejected;
    await linker.connect(deployer).unconnectSchain(schainID);

    expect(await linker.hasSchain(schainID)).to.equal(false);
  });

  it("should register and remove depositBoxes", async () => {
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const tokenManagerAddress = user.address;

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC20.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC721.address)).to.equal(false);

    await linker.connect(deployer).registerDepositBox(depositBoxEth.address);
    await linker.connect(deployer).registerDepositBox(depositBoxERC20.address);
    await linker.connect(deployer).registerDepositBox(depositBoxERC721.address);

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(true);
    expect(await linker.hasDepositBox(depositBoxERC20.address)).to.equal(true);
    expect(await linker.hasDepositBox(depositBoxERC721.address)).to.equal(true);

    expect(await linker.hasDepositBox(nullAddress)).to.equal(false);
    expect(await linker.hasDepositBox(tokenManagerAddress)).to.equal(false);

    await linker.connect(user).registerDepositBox(nullAddress).should.be.rejected;
    await linker.connect(deployer).registerDepositBox(nullAddress);

    expect(await linker.hasDepositBox(nullAddress)).to.equal(true);
    expect(await linker.hasDepositBox(tokenManagerAddress)).to.equal(false);

    await linker.connect(deployer).registerDepositBox(tokenManagerAddress);

    expect(await linker.hasDepositBox(tokenManagerAddress)).to.equal(true);

    await linker.connect(user).removeDepositBox(tokenManagerAddress).should.be.rejected;
    await linker.connect(deployer).removeDepositBox(tokenManagerAddress);

    expect(await linker.hasDepositBox(tokenManagerAddress)).to.equal(false);

    await linker.connect(deployer).removeDepositBox(nullAddress);

    expect(await linker.hasDepositBox(nullAddress)).to.equal(false);

    await linker.connect(deployer).removeDepositBox(depositBoxEth.address);
    await linker.connect(deployer).removeDepositBox(depositBoxERC20.address);
    await linker.connect(deployer).removeDepositBox(depositBoxERC721.address);

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC20.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC721.address)).to.equal(false);
  });

});
