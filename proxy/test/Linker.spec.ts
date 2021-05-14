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

import * as chaiAsPromised from "chai-as-promised";
import {
  ContractManagerInstance,
  DepositBoxEthInstance,
  DepositBoxERC20Instance,
  DepositBoxERC721Instance,
  LinkerInstance,
  MessageProxyForMainnetInstance,
  } from "../types/truffle-contracts";
import { randomString } from "./utils/helper";

import chai = require("chai");

chai.should();
chai.use((chaiAsPromised as any));

import { deployDepositBoxEth } from "./utils/deploy/depositBoxEth";
import { deployDepositBoxERC20 } from "./utils/deploy/depositBoxERC20";
import { deployDepositBoxERC721 } from "./utils/deploy/depositBoxERC721";
import { deployLinker } from "./utils/deploy/linker";
import { deployMessageProxyForMainnet } from "./utils/deploy/messageProxyForMainnet";
import { deployContractManager } from "./utils/deploy/contractManager";

contract("Linker", ([deployer, user, user2]) => {
  let depositBoxEth: DepositBoxEthInstance;
  let depositBoxERC20: DepositBoxERC20Instance;
  let depositBoxERC721: DepositBoxERC721Instance;
  let contractManager: ContractManagerInstance;
  let messageProxy: MessageProxyForMainnetInstance;
  let linker: LinkerInstance;
  let contractManagerAddress = "0x0000000000000000000000000000000000000000";

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
    await linker.connectSchain(schainID, [], {from: user}).should.be.rejected;

    // Token Manager address shouldn't be equal zero:
    await linker.connectSchain(schainID, [nullAddress], {from: deployer})
        .should.be.eventually.rejectedWith("Incorrect number of addresses");

    await linker.connectSchain(schainID, [], {from: deployer});
  });

  it("should connect schain with 1 tokenManager", async() => {
    const schainID = randomString(10);
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const tokenManagerAddress = user;

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(false);

    await linker.registerDepositBox(depositBoxEth.address, {from: deployer});

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(true);

    await linker.connectSchain(schainID, [], {from: deployer})
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

    await linker.connectSchain(schainID, [tokenManagerAddress, nullAddress], {from: deployer})
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

    expect(await linker.hasSchain(schainID)).to.equal(false);

    await linker.connectSchain(schainID, [nullAddress], {from: deployer})
      .should.be.eventually.rejectedWith("Incorrect Token Manager address");

    await linker.connectSchain(schainID, [tokenManagerAddress], {from: deployer})

    expect(await linker.hasSchain(schainID)).to.equal(true);

  });

  it("should connect schain with 3 tokenManager", async() => {
    const schainID = randomString(10);
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const tokenManagerAddress = user;

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC20.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC721.address)).to.equal(false);

    await linker.registerDepositBox(depositBoxEth.address, {from: deployer});
    await linker.registerDepositBox(depositBoxERC20.address, {from: deployer});
    await linker.registerDepositBox(depositBoxERC721.address, {from: deployer});

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(true);
    expect(await linker.hasDepositBox(depositBoxERC20.address)).to.equal(true);
    expect(await linker.hasDepositBox(depositBoxERC721.address)).to.equal(true);

    await linker.connectSchain(schainID, [], {from: deployer})
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

    await linker.connectSchain(schainID, [tokenManagerAddress], {from: deployer})
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

    await linker.connectSchain(schainID, [tokenManagerAddress, nullAddress], {from: deployer})
      .should.be.eventually.rejectedWith("Incorrect number of addresses");

    expect(await linker.hasSchain(schainID)).to.equal(false);

    await linker.connectSchain(schainID, [nullAddress, tokenManagerAddress, nullAddress], {from: deployer})
      .should.be.eventually.rejectedWith("Incorrect Token Manager address");

    await linker.connectSchain(schainID, [tokenManagerAddress, tokenManagerAddress, tokenManagerAddress], {from: deployer})

    expect(await linker.hasSchain(schainID)).to.equal(true);
  });

  it("should invoke `unconnectSchain` without mistakes", async () => {
    const schainID = randomString(10);
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const tokenManagerAddress = user;

    await linker.registerDepositBox(depositBoxEth.address, {from: deployer});
    await linker.registerDepositBox(depositBoxERC20.address, {from: deployer});
    await linker.registerDepositBox(depositBoxERC721.address, {from: deployer});

    await linker.connectSchain(schainID, [tokenManagerAddress, tokenManagerAddress, tokenManagerAddress], {from: deployer});

    expect(await linker.hasSchain(schainID)).to.equal(true);

    await linker.unconnectSchain(schainID, {from: user}).should.be.rejected;
    await linker.unconnectSchain(schainID, {from: deployer});

    expect(await linker.hasSchain(schainID)).to.equal(false);
  });

  it("should register and remove depositBoxes", async () => {
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const tokenManagerAddress = user;

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC20.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC721.address)).to.equal(false);

    await linker.registerDepositBox(depositBoxEth.address, {from: deployer});
    await linker.registerDepositBox(depositBoxERC20.address, {from: deployer});
    await linker.registerDepositBox(depositBoxERC721.address, {from: deployer});

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(true);
    expect(await linker.hasDepositBox(depositBoxERC20.address)).to.equal(true);
    expect(await linker.hasDepositBox(depositBoxERC721.address)).to.equal(true);

    expect(await linker.hasDepositBox(nullAddress)).to.equal(false);
    expect(await linker.hasDepositBox(tokenManagerAddress)).to.equal(false);

    await linker.registerDepositBox(nullAddress, {from: user}).should.be.rejected;
    await linker.registerDepositBox(nullAddress, {from: deployer});

    expect(await linker.hasDepositBox(nullAddress)).to.equal(true);
    expect(await linker.hasDepositBox(tokenManagerAddress)).to.equal(false);

    await linker.registerDepositBox(tokenManagerAddress, {from: deployer});

    expect(await linker.hasDepositBox(tokenManagerAddress)).to.equal(true);

    await linker.removeDepositBox(tokenManagerAddress, {from: user}).should.be.rejected;
    await linker.removeDepositBox(tokenManagerAddress, {from: deployer});

    expect(await linker.hasDepositBox(tokenManagerAddress)).to.equal(false);

    await linker.removeDepositBox(nullAddress, {from: deployer});

    expect(await linker.hasDepositBox(nullAddress)).to.equal(false);

    await linker.removeDepositBox(depositBoxEth.address, {from: deployer});
    await linker.removeDepositBox(depositBoxERC20.address, {from: deployer});
    await linker.removeDepositBox(depositBoxERC721.address, {from: deployer});

    expect(await linker.hasDepositBox(depositBoxEth.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC20.address)).to.equal(false);
    expect(await linker.hasDepositBox(depositBoxERC721.address)).to.equal(false);
  });

});
