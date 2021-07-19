import chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    ERC721OnChain
} from "../typechain";

chai.should();
chai.use((chaiAsPromised as any));

import { deployERC721OnChain } from "./utils/deploy/erc721OnChain";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { BigNumber } from "ethers";

import { assert, expect } from "chai";

describe("ERC721OnChain", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;

    let eRC721OnChain: ERC721OnChain;

    before(async () => {
        [deployer, user] = await ethers.getSigners();
    });

    beforeEach(async () => {
        eRC721OnChain = await deployERC721OnChain("ERC721OnChain", "ERC721");
    });

    it("should invoke `mint`", async () => {
        // preparation
        const account = user.address;
        const tokenId = 500;
        // execution
        await eRC721OnChain.connect(deployer).mint(account, tokenId);
        // expectation
        expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(account);
    });

    it("should invoke `burn`", async () => {
        // preparation
        const error = "ERC721: owner query for nonexistent token";
        const tokenId = 55;
        // mint to avoid `owner query for nonexistent token` error
        await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
        // execution
        await eRC721OnChain.connect(deployer).burn(tokenId);
        // expectation
        await eRC721OnChain.ownerOf(tokenId).should.be.eventually.rejectedWith(error);
    });

    it("should reject with `ERC721Burnable: caller is not owner nor approved` when invoke `burn`", async () => {
        // preparation
        const error = "ERC721Burnable: caller is not owner nor approved";
        const tokenId = 55;
        const account = user;
        // mint to avoid `owner query for nonexistent token` error
        await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
        // execution/expectation
        await eRC721OnChain.connect(account).burn(tokenId).should.be.eventually.rejectedWith(error);
    });

    it("should invoke `setTokenURI`", async () => {
        // preparation
        const tokenURI = "Some string with describe token";
        const tokenId = 55;
        // mint to avoid `owner query for nonexistent token` error
        await eRC721OnChain.connect(deployer).mint(deployer.address, tokenId);
        // execution
        const res = await (await eRC721OnChain.connect(deployer).setTokenURI(tokenId, tokenURI)).wait();
        // expectation
        expect(res.status).to.be.equal(1);
    });

});
