import { ERC721ModuleForMainnetContract } from "../../../types/truffle-contracts";
import { LockAndDataForMainnetInstance } from "../../../types/truffle-contracts";

import { deployLockAndDataForMainnetERC721 } from "./lockAndDataForMainnetERC721";

const ERC721ModuleForMainnet: ERC721ModuleForMainnetContract = artifacts.require("./ERC721ModuleForMainnet");
const name = "ERC721Module";

async function deploy(
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    await deployDependencies(lockAndDataForMainnet);
    const instance = await ERC721ModuleForMainnet.new();
    await instance.initialize(lockAndDataForMainnet.address);
    await lockAndDataForMainnet.setContract(name, instance.address);
    return instance;
}

async function deployDependencies(lockAndDataForMainnet: LockAndDataForMainnetInstance) {
    await deployLockAndDataForMainnetERC721(lockAndDataForMainnet);
}

export async function deployERC721ModuleForMainnet(
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    if (await lockAndDataForMainnet.getContract(name) !== "0x0000000000000000000000000000000000000000") {
        return ERC721ModuleForMainnet.at(await lockAndDataForMainnet.getContract(name));
    } else {
        return await deploy(lockAndDataForMainnet);
    }
}