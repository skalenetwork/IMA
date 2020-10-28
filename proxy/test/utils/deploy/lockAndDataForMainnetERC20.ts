import { LockAndDataForMainnetERC20Contract } from "../../../types/truffle-contracts";
import { LockAndDataForMainnetInstance } from "../../../types/truffle-contracts";

const LockAndDataForMainnetERC20: LockAndDataForMainnetERC20Contract = artifacts.require("./LockAndDataForMainnetERC20");
const name = "LockAndDataForMainnetERC20";

export async function deployLockAndDataForMainnetERC20(lockAndDataForMainnet: LockAndDataForMainnetInstance) {
    try {
        return LockAndDataForMainnetERC20.at(await lockAndDataForMainnet.contract(name));
    } catch (e) {
        const instance = await LockAndDataForMainnetERC20.new();
        await instance.initialize(lockAndDataForMainnet.address);
        await lockAndDataForMainnet.setContract(name, instance.address);
        return instance;
    }
}
