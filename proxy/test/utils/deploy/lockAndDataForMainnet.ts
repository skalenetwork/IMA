import { LockAndDataForMainnetContract } from "../../../types/truffle-contracts";

const LockAndDataForMainnet: LockAndDataForMainnetContract = artifacts.require("./LockAndDataForMainnetWorkaround");
const name = "LockAndData";

export async function deployLockAndDataForMainnet() {
    const instance = await LockAndDataForMainnet.new();
    await instance.initialize();
    await instance.setContract(name, instance.address);
    return instance;
}
