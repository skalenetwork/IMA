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
 * @file TokenFactory.spec.ts
 * @copyright SKALE Labs 2019-Present
 */

import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");
import {
    TokenFactoryERC20Contract,
    TokenFactoryERC20Instance,
    TokenFactoryERC721Contract,
    TokenFactoryERC721Instance,
  } from "../types/truffle-contracts";

chai.should();
chai.use((chaiAsPromised as any));

const TokenFactoryERC20: TokenFactoryERC20Contract = artifacts.require("./TokenFactoryERC20");
const TokenFactoryERC721: TokenFactoryERC721Contract = artifacts.require("./TokenFactoryERC721");

contract("TokenFactory", ([deployer, user]) => {
  let tokenFactoryERC20: TokenFactoryERC20Instance;
  let tokenFactoryERC721: TokenFactoryERC721Instance;

  beforeEach(async () => {
    tokenFactoryERC20 = await TokenFactoryERC20.new("TokenManagerERC20", deployer);
    tokenFactoryERC721 = await TokenFactoryERC721.new("TokenManagerERC721", deployer);
  });

  it("should createERC20", async () => {
    // preparation
    const to = user;
    const data = "0x03" +
    "000000000000000000000000000000000000000000000000000000000000000a" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "000000000000000000000000000000000000000000000000000000000000000a" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000c" + // token name
    "45524332304f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000005" + // token symbol
    "455243323012" + // token symbol
    "000000000000000000000000000000000000000000000000000000003b9ac9f6"; // total supply
    // execution
    const res = await tokenFactoryERC20.createERC20.call("elvis", "ELV", {from: deployer});
    // expectation
    expect(res).to.include("0x");
  });

  it("should createERC721", async () => {
    // preparation
    const to = user;
    const data = "0x05" +
    "0000000000000000000000000000000000000000000000000000000000000001" + // contractPosition
    to.substr(2) + "000000000000000000000000" + // receiver
    "0000000000000000000000000000000000000000000000000000000000000002" + // tokenId
    "000000000000000000000000000000000000000000000000000000000000000d" + // token name
    "4552433732314f6e436861696e" + // token name
    "0000000000000000000000000000000000000000000000000000000000000006" + // token symbol
    "455243373231"; // token symbol
    // execution
    const res = await tokenFactoryERC721.createERC721.call("elvis", "ELV", {from: deployer});
    // expectation
    expect(res).to.include("0x");
  });

});
