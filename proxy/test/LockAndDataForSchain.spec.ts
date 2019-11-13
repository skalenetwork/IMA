import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");
import { EthERC20Contract,
  EthERC20Instance,
  LockAndDataForSchainContract,
  LockAndDataForSchainInstance,
  MessageProxyContract,
  MessageProxyInstance} from "../types/truffle-contracts";
import { gasMultiplier } from "./utils/command_line";
import { randomString } from "./utils/helper";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");
const LockAndDataForSchain: LockAndDataForSchainContract = artifacts.require("./LockAndDataForSchain");
const EthERC20: EthERC20Contract = artifacts.require("./EthERC20");

const contractManager = "0x0000000000000000000000000000000000000000";

contract("LockAndDataForSchain", ([user, deployer]) => {
  let messageProxy: MessageProxyInstance;
  let lockAndDataForSchain: LockAndDataForSchainInstance;
  let ethERC20: EthERC20Instance;

  beforeEach(async () => {
    messageProxy = await MessageProxy.new("Mainnet", contractManager, {from: deployer, gas: 8000000 * gasMultiplier});
    lockAndDataForSchain = await LockAndDataForSchain.new({from: deployer, gas: 8000000 * gasMultiplier});
    ethERC20 = await EthERC20.new({from: deployer, gas: 8000000 * gasMultiplier});
  });

  it("should set EthERC20 address", async () => {

    // only owner can set EthERC20 address:
    await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: user}).should.be.rejected;
    await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: deployer});

    // address which has been set should be equal to deployed contract address;
    const address = await lockAndDataForSchain.ethERC20Address();
    expect(address).to.equal(ethERC20.address);
  });

  it("should set contract", async () => {
    const nullAddress = await lockAndDataForSchain.ethERC20Address();
    await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: deployer});
    const address = await lockAndDataForSchain.ethERC20Address();

    // only owner can set contract:
    await lockAndDataForSchain.setContract("EthERC20", address, {from: user})
    .should.be.rejected;

    // contract address shouldn't be equal zero:
    await lockAndDataForSchain.setContract("EthERC20", nullAddress, {from: deployer})
    .should.be.rejectedWith("New address is equal zero");

    // set contract:
    await lockAndDataForSchain.setContract("EthERC20", address, {from: deployer});

    // the same contract can't be set twice:
    await lockAndDataForSchain.setContract("EthERC20", address, {from: deployer}).
    should.be.rejectedWith("Contract is already added");

    // contract address should contain code:
    await lockAndDataForSchain.setContract("EthERC20", deployer, {from: deployer}).
    should.be.rejectedWith("Given contract address does not contain code");

    const getMapping = await lockAndDataForSchain.permitted(web3.utils.soliditySha3("EthERC20"));
    expect(getMapping).to.equal(ethERC20.address);
  });

  it("should add schain", async () => {
    const schainID = randomString(10);
    const tokenManagerAddress = user;
    const nullAddress = "0x0000000000000000000000000000000000000000";

    // only owner can add schain:
    await lockAndDataForSchain.addSchain(schainID, tokenManagerAddress, {from: user}).should.be.rejected;

    // Token Manager address shouldn't be equal zero:
    await lockAndDataForSchain.addSchain(schainID, nullAddress, {from: deployer}).
    should.be.rejectedWith("Incorrect Token Manager address");

    // add schain:
    await lockAndDataForSchain.addSchain(schainID, tokenManagerAddress, {from: deployer});

    // schain can't be added twice:
    await lockAndDataForSchain.addSchain(schainID, tokenManagerAddress, {from: deployer}).
    should.be.rejectedWith("SKALE chain is already set");

    const getMapping = await lockAndDataForSchain.tokenManagerAddresses(web3.utils.soliditySha3(schainID));
    expect(getMapping).to.equal(tokenManagerAddress);
  });

  it("should add deposit box", async () => {
    const depositBoxAddress = user;
    const nullAddress = "0x0000000000000000000000000000000000000000";

    // only owner can add deposit box:
    await lockAndDataForSchain.addDepositBox(depositBoxAddress, {from: user}).should.be.rejected;

    // deposit box address shouldn't be equal zero:
    await lockAndDataForSchain.addDepositBox(nullAddress, {from: deployer})
      .should.be.rejectedWith("Incorrect Deposit Box address");

    // add deposit box:
    await lockAndDataForSchain.addDepositBox(depositBoxAddress, {from: deployer});

    // deposit box can't be added twice:
    await lockAndDataForSchain.addDepositBox(depositBoxAddress, {from: deployer}).
    should.be.rejectedWith("Deposit Box is already set");

    const getMapping = await lockAndDataForSchain.tokenManagerAddresses(web3.utils.soliditySha3("Mainnet"));
    expect(getMapping).to.equal(depositBoxAddress);
  });

  it("should add gas costs", async () => {
    const address = user;
    const amount = new BigNumber(500);

    // only owner can add gas costs:
    await lockAndDataForSchain.addGasCosts(address, amount, {from: user}).should.be.rejected;
    await lockAndDataForSchain.addGasCosts(address, amount, {from: deployer});

    const ethCosts = new BigNumber(await lockAndDataForSchain.ethCosts(user));
    ethCosts.should.be.deep.equal(amount);
  });

  it("should remove gas costs", async () => {
    const address = user;
    const amount = new BigNumber(500);

    // only owner can add gas costs:
    await lockAndDataForSchain.addGasCosts(address, amount, {from: user}).should.be.rejected;
    await lockAndDataForSchain.addGasCosts(address, amount, {from: deployer});

    const ethCosts = new BigNumber(await lockAndDataForSchain.ethCosts(user));

    await lockAndDataForSchain.removeGasCosts(address, {from: user}).should.be.rejected;
    const gasCost = new BigNumber(await lockAndDataForSchain.removeGasCosts.call(address, {from: deployer}));

    ethCosts.should.be.deep.equal(gasCost);
  });

  it("should reduce gas costs", async () => {
    const address = user;
    const amount = new BigNumber(500);
    const amountReduce = new BigNumber(20);
    const amountFinal = new BigNumber(480);
    const amountZero = new BigNumber(0);
    const nullAddress = "0x0000000000000000000000000000000000000000";

    // only owner can add gas costs:
    await lockAndDataForSchain.addGasCosts(address, amount, {from: user}).should.be.rejected;

    // if address don't have gas costs reduceGasCosts function don't change situation any way:
    const ethCostsBefore = new BigNumber(await lockAndDataForSchain.ethCosts(user));
    ethCostsBefore.should.be.deep.equal(amountZero);
    await lockAndDataForSchain.reduceGasCosts(address, amountReduce, {from: deployer});
    const ethCostsAfter = new BigNumber(await lockAndDataForSchain.ethCosts(user));
    ethCostsAfter.should.be.deep.equal(amountZero);

    // we can add gas costs to null address and it uses when on address no gas costs:
    await lockAndDataForSchain.addGasCosts(nullAddress, amount, {from: deployer});
    await lockAndDataForSchain.reduceGasCosts(address, amountReduce, {from: deployer});
    const ethCostsNullAddress = new BigNumber(await lockAndDataForSchain.ethCosts(nullAddress));
    ethCostsNullAddress.should.be.deep.equal(amountFinal);
    const ethCostsAddress = new BigNumber(await lockAndDataForSchain.ethCosts(address));
    ethCostsAddress.should.be.deep.equal(amountZero);

    // reduce gas cost after adding it:
    await lockAndDataForSchain.addGasCosts(address, amount, {from: deployer});
    await lockAndDataForSchain.reduceGasCosts(address, amountReduce, {from: deployer});
    const ethCosts = new BigNumber(await lockAndDataForSchain.ethCosts(nullAddress));
    ethCosts.should.be.deep.equal(amountFinal);
  });

  it("should send Eth", async () => {
    const address = user;
    const amount = 200;
    const amountZero = 0;
    const amountMoreThenCap = 1210000000000000000;

    // set EthERC20 address:
    await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: deployer});

    // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
    await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});

    // only owner can send Eth:
    await lockAndDataForSchain.sendEth(address, amount, {from: user}).should.be.rejected;

    // amoult more zen cap = 120 * (10 ** 6) * (10 ** 18) can't be sent:
    await lockAndDataForSchain.sendEth(address, amountMoreThenCap, {from: deployer}).should.be.rejected;

    // balace of account  equal to zero:
    const balanceBefore = parseInt(new BigNumber(await ethERC20.balanceOf(user)).toString(), 10);
    balanceBefore.should.be.deep.equal(amountZero);

    // send Eth:
    await lockAndDataForSchain.sendEth(address, amount, {from: deployer});

    // balace of account equal to amount which has been sent:
    const balanceAfter = parseInt(new BigNumber(await ethERC20.balanceOf(user)).toString(), 10);
    balanceAfter.should.be.deep.equal(amount);
  });

  it("should receive Eth", async () => {
    const address = user;
    const amount = new BigNumber(200);
    const amountZero = new BigNumber(0);

    // set EthERC20 address:
    await lockAndDataForSchain.setEthERC20Address(ethERC20.address, {from: deployer});

    // transfer ownership of using ethERC20 contract method to lockAndDataForSchain contract address:
    await ethERC20.transferOwnership(lockAndDataForSchain.address, {from: deployer});

    //  send Eth to account:
    await lockAndDataForSchain.sendEth(address, amount, {from: deployer});

    // balace of account equal to amount which has been sent:
    const balance = new BigNumber(await ethERC20.balanceOf(address));
    balance.should.be.deep.equal(amount);

    // burn Eth throught `receiveEth` function:
    await lockAndDataForSchain.receiveEth(address, amount, {from: deployer});

    // balance after "receiving" equal to zero:
    const balanceAfter = new BigNumber(await ethERC20.balanceOf(address));
    balanceAfter.should.be.deep.equal(amountZero);
  });

  it("should return true when invoke `hasSchain`", async () => {
    // preparation
    const schainID = randomString(10);
    // add schain for return `true` after `hasSchain` invoke
    await lockAndDataForSchain
      .addSchain(schainID, deployer, {from: deployer});
    // execution
    const res = await lockAndDataForSchain
      .hasSchain(schainID, {from: deployer});
    // expectation
    expect(res).to.be.true;
  });

  it("should return false when invoke `hasSchain`", async () => {
    // preparation
    const schainID = randomString(10);
    // execution
    const res = await lockAndDataForSchain
      .hasSchain(schainID, {from: deployer});
    // expectation
    expect(res).to.be.false;
  });

  it("should return true when invoke `hasDepositBox`", async () => {
    // preparation
    const depositBoxAddress = user;
    // add schain for return `true` after `hasDepositBox` invoke
    await lockAndDataForSchain.addDepositBox(depositBoxAddress, {from: deployer});
    // execution
    const res = await lockAndDataForSchain
      .hasDepositBox({from: deployer});
    // expectation
    expect(res).to.be.true;
  });

  it("should return false when invoke `hasDepositBox`", async () => {
    // preparation
    const depositBoxAddress = user;
    // execution
    const res = await lockAndDataForSchain
      .hasDepositBox({from: deployer});
    // expectation
    expect(res).to.be.false;
  });

  it("should invoke `removeSchain` without mistakes", async () => {
    const schainID = randomString(10);
    await lockAndDataForSchain
      .addSchain(schainID, deployer, {from: deployer});
    // execution
    await lockAndDataForSchain
      .removeSchain(schainID, {from: deployer});
    // expectation
    const getMapping = await lockAndDataForSchain.tokenManagerAddresses(web3.utils.soliditySha3(schainID));
    expect(getMapping).to.equal("0x0000000000000000000000000000000000000000");
  });

  it("should rejected with `SKALE chain is not set` when invoke `removeSchain`", async () => {
    const error = "SKALE chain is not set";
    const schainID = randomString(10);
    const anotherSchainID = randomString(10);
    await lockAndDataForSchain
      .addSchain(schainID, deployer, {from: deployer});
    // execution/expectation
    await lockAndDataForSchain
      .removeSchain(anotherSchainID, {from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

  it("should work `addAuthorizedCaller`", async () => {
    // preparation
    const caller = user;
    // execution
    await lockAndDataForSchain
      .addAuthorizedCaller(caller, {from: deployer});
    // expectation
    const res = await lockAndDataForSchain.authorizedCaller(caller, {from: deployer});
    // console.log("res", res);
    expect(res).to.be.true;
  });

  it("should work `removeAuthorizedCaller`", async () => {
    // preparation
    const caller = user;
    // execution
    await lockAndDataForSchain
      .removeAuthorizedCaller(caller, {from: deployer});
    // expectation
    const res = await lockAndDataForSchain.authorizedCaller(caller, {from: deployer});
    // console.log("res", res);
    expect(res).to.be.false;
  });

  it("should invoke `removeDepositBox` without mistakes", async () => {
    // preparation
    const depositBoxAddress = user;
    const nullAddress = "0x0000000000000000000000000000000000000000";
    // add deposit box:
    await lockAndDataForSchain.addDepositBox(depositBoxAddress, {from: deployer});
    // execution
    await lockAndDataForSchain.removeDepositBox({from: deployer});
    // expectation
    const getMapping = await lockAndDataForSchain.tokenManagerAddresses(web3.utils.soliditySha3("Mainnet"));
    expect(getMapping).to.equal(nullAddress);
  });

  it("should rejected with `Deposit Box is not set` when invoke `removeDepositBox`", async () => {
    // preparation
    const error = "Deposit Box is not set";
    // execution/expectation
    await lockAndDataForSchain.removeDepositBox({from: deployer})
      .should.be.eventually.rejectedWith(error);
  });

});
