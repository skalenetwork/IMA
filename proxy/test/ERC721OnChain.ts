import * as chaiAsPromised from "chai-as-promised";
import chai = require("chai");
import {
    MessageProxyForSchainContract,
    ERC20OnChainContract,
    ERC721OnChainContract,
    MessageProxyForSchainInstance,
    ERC721OnChainInstance
} from "../types/truffle-contracts";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxyForSchain: MessageProxyForSchainContract = artifacts.require("./MessageProxyForSchain");
const ERC20OnChain: ERC20OnChainContract = artifacts.require("./ERC20OnChain");
const ERC721OnChain: ERC721OnChainContract = artifacts.require("./ERC721OnChain");

contract("ERC721OnChain", ([user, deployer]) => {
    let messageProxy: MessageProxyForSchainInstance;
    let eRC721OnChain: ERC721OnChainInstance;

    beforeEach(async () => {
      messageProxy = await MessageProxyForSchain.new();
      eRC721OnChain = await ERC721OnChain.new("ERC721OnChain", "ERC721", {from: deployer});
    });

    it("should invoke `mint`", async () => {
      // preparation
      const account = user;
      const tokenId = 500;
      // execution
      await eRC721OnChain.mint(account, tokenId, {from: deployer});
      // expectation
      expect(await eRC721OnChain.ownerOf(tokenId)).to.be.equal(account);
    });

    it("should invoke `burn`", async () => {
      // preparation
      const error = "ERC721: owner query for nonexistent token";
      const tokenId = 55;
      // mint to avoid `owner query for nonexistent token` error
      await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
      // execution
      await eRC721OnChain.burn(tokenId, {from: deployer});
      // expectation
      await eRC721OnChain.ownerOf(tokenId).should.be.eventually.rejectedWith(error);
    });

    it("should reject with `ERC721Burnable: caller is not owner nor approved` when invoke `burn`", async () => {
      // preparation
      const error = "ERC721Burnable: caller is not owner nor approved";
      const tokenId = 55;
      const account = user;
      // mint to avoid `owner query for nonexistent token` error
      await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
      // execution/expectation
      await eRC721OnChain.burn(tokenId, {from: account}).should.be.eventually.rejectedWith(error);
    });

    it("should invoke `setTokenURI`", async () => {
      // preparation
      const tokenURI = "Some string with describe token";
      const tokenId = 55;
      // mint to avoid `owner query for nonexistent token` error
      await eRC721OnChain.mint(deployer, tokenId, {from: deployer});
      // execution
      const res = await eRC721OnChain.setTokenURI(tokenId, tokenURI, {from: deployer});
      // expectation
      expect(res.receipt.status).to.be.true;
    });

});