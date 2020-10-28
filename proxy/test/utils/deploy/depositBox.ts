import { DepositBoxContract } from "../../../types/truffle-contracts";
import { MessageProxyForMainnetInstance } from "../../../types/truffle-contracts";
import { LockAndDataForMainnetInstance } from "../../../types/truffle-contracts";

import { deployERC20ModuleForMainnet } from "./erc20ModuleForMainnet";
import { deployERC721ModuleForMainnet } from "./erc721ModuleForMainnet";

const DepositBox: DepositBoxContract = artifacts.require("./DepositBox");
const name = "DepositBox";

async function deploy(
    messageProxy: MessageProxyForMainnetInstance,
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    await deployDependencies(lockAndDataForMainnet);
    const instance = await DepositBox.new();
    await instance.initialize(messageProxy.address, lockAndDataForMainnet.address);
    await lockAndDataForMainnet.setContract(name, instance.address);
    return instance;
}

async function deployDependencies(lockAndDataForMainnet: LockAndDataForMainnetInstance) {
    await deployERC20ModuleForMainnet(lockAndDataForMainnet);
    await deployERC721ModuleForMainnet(lockAndDataForMainnet);
}

export async function deployDepositBox(
    messageProxy: MessageProxyForMainnetInstance,
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    try {
        return DepositBox.at(await lockAndDataForMainnet.contract(name));
    } catch (e) {
        return await deploy(messageProxy, lockAndDataForMainnet);
    }
}