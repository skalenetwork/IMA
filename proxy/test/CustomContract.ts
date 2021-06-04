import chaiAsPromised from "chai-as-promised";
import {
    ContractManager,
    MessageProxyForMainnet,
    MainnetExample,
    MessageProxyForSchain,
    SchainExample
} from "../typechain";

import chai = require("chai");
import chaiAlmost = require("chai-almost");

chai.should();
chai.use((chaiAsPromised as any));

import { deployMessageProxyForMainnet } from "./utils/deploy/mainnet/messageProxyForMainnet";
import { deployContractManager } from "./utils/skale-manager-utils/contractManager";
import { deployMainnetExample } from "./utils/deploy/example/mainnetExample";
import { deploySchainExample } from "./utils/deploy/example/schainExample";

import { ethers, web3 } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { deployMessageProxyForSchain } from "./utils/deploy/schain/messageProxyForSchain";
import { deployKeyStorageMock } from "./utils/deploy/test/keyStorageMock";

describe("CustomContract", () => {
    let deployer: SignerWithAddress;
    let user: SignerWithAddress;

    let contractManager: ContractManager;
    let messageProxyForMainnet: MessageProxyForMainnet;
    let messageProxyForSchain: MessageProxyForSchain;
    let mainnetExample: MainnetExample;
    let schainExample: SchainExample;

    const schainName = "Schain";
    const schainHash = web3.utils.soliditySha3(schainName);
    const contractManagerAddress = "0x0000000000000000000000000000000000000000";

    before(async () => {
        [deployer, user] = await ethers.getSigners();
    });

    beforeEach(async () => {
        const keyStorage = await deployKeyStorageMock();
        contractManager = await deployContractManager(contractManagerAddress);
        messageProxyForMainnet = await deployMessageProxyForMainnet(contractManager);
        messageProxyForSchain = await deployMessageProxyForSchain(keyStorage.address, schainName);
        mainnetExample = await deployMainnetExample(messageProxyForMainnet);
        schainExample = await deploySchainExample(schainName, messageProxyForSchain, mainnetExample)
    });

    it("should send message from mainnet to schain", async () => {
        await messageProxyForMainnet.addConnectedChain(schainName);
        await messageProxyForMainnet.registerExtraContract(schainName, mainnetExample.address);
        await mainnetExample.sendToSchain(schainName, schainExample.address);
    });

});
