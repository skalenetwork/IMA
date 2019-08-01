import { BigNumber } from "bignumber.js";
import * as chaiAsPromised from "chai-as-promised";

import chai = require("chai");
import { MessageProxyContract,
    MessageProxyInstance } from "../types/truffle-contracts";
import { gasMultiplier } from "./utils/command_line";

chai.should();
chai.use((chaiAsPromised as any));

const MessageProxy: MessageProxyContract = artifacts.require("./MessageProxy");

contract("MessageProxy", ([user, deployer]) => {
    let messageProxy: MessageProxyInstance;

    describe("MessageProxy for mainnet", async () => {
        beforeEach(async () => {
            messageProxy = await MessageProxy.new("Mainnet", {from: deployer, gas: 8000000 * gasMultiplier});
        });

        it("");
    });
});
