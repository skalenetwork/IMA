import { DepositBoxERC20Contract } from "../../../types/truffle-contracts";
import { LockAndDataForMainnetInstance } from "../../../types/truffle-contracts";

// import { deployDepositBoxERC20 } from "./DepositBoxERC20";

const DepositBoxERC20: DepositBoxERC20Contract = artifacts.require("./DepositBoxERC20");
const name = "DepositBoxERC20";

async function deploy(
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    // await deployDependencies(lockAndDataForMainnet);
    const instance = await DepositBoxERC20.new();
    await instance.initialize(lockAndDataForMainnet.address);
    await lockAndDataForMainnet.setContract(name, instance.address);
    return instance;
}

// async function deployDependencies(lockAndDataForMainnet: LockAndDataForMainnetInstance) {
//     await deployDepositBoxERC20(lockAndDataForMainnet);
// }

export async function deployDepositBoxERC20(
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    if (await lockAndDataForMainnet.getContract(name) !== "0x0000000000000000000000000000000000000000") {
        return DepositBoxERC20.at(await lockAndDataForMainnet.getContract(name));
    } else {
        return await deploy(lockAndDataForMainnet);
    }
}