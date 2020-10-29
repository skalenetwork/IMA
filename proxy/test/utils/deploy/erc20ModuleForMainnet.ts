import { ERC20ModuleForMainnetContract } from "../../../types/truffle-contracts";
import { LockAndDataForMainnetInstance } from "../../../types/truffle-contracts";

import { deployLockAndDataForMainnetERC20 } from "./lockAndDataForMainnetERC20";

const ERC20ModuleForMainnet: ERC20ModuleForMainnetContract = artifacts.require("./ERC20ModuleForMainnet");
const name = "ERC20Module";

async function deploy(
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    await deployDependencies(lockAndDataForMainnet);
    const instance = await ERC20ModuleForMainnet.new();
    await instance.initialize(lockAndDataForMainnet.address);
    await lockAndDataForMainnet.setContract(name, instance.address);
    return instance;
}

async function deployDependencies(lockAndDataForMainnet: LockAndDataForMainnetInstance) {
    await deployLockAndDataForMainnetERC20(lockAndDataForMainnet);
}

export async function deployERC20ModuleForMainnet(
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    try {
        return ERC20ModuleForMainnet.at(await lockAndDataForMainnet.contract(name));
    } catch (e) {
        return await deploy(lockAndDataForMainnet);
    }
}