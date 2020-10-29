import { LockAndDataForMainnetContract } from "../../../types/truffle-contracts";

const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnetWorkaround");

export async function deployLockAndDataForMainnet() {
    const instance = await LockAndDataForMainnet.new();
    await instance.initialize();
    return instance;
}
