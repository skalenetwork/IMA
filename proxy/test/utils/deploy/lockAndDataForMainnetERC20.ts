import { LockAndDataForMainnetERC20Contract } from "../../../types/truffle-contracts";
import { LockAndDataForMainnetInstance } from "../../../types/truffle-contracts";

const LockAndDataForMainnetERC20: LockAndDataForMainnetERC20Contract = artifacts.require("./LockAndDataForMainnetERC20");
const name = "LockAndDataERC20";

export async function deployLockAndDataForMainnetERC20(lockAndDataForMainnet: LockAndDataForMainnetInstance) {
    if (await lockAndDataForMainnet.getContract(name) !== "0x0000000000000000000000000000000000000000") {
        return LockAndDataForMainnetERC20.at(await lockAndDataForMainnet.getContract(name));
    } else {
        const instance = await LockAndDataForMainnetERC20.new();
        await instance.initialize(lockAndDataForMainnet.address);
        await lockAndDataForMainnet.setContract(name, instance.address);
        return instance;
    }
}
