import { DepositBoxERC721Contract } from "../../../types/truffle-contracts";
import { LockAndDataForMainnetInstance } from "../../../types/truffle-contracts";

import { deployDepositBoxERC721 } from "./DepositBoxERC721";

const DepositBoxERC721: DepositBoxERC721Contract = artifacts.require("./DepositBoxERC721");
const name = "ERC721Module";

async function deploy(
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    // await deployDependencies(lockAndDataForMainnet);
    const instance = await DepositBoxERC721.new();
    await instance.initialize(lockAndDataForMainnet.address);
    await lockAndDataForMainnet.setContract(name, instance.address);
    return instance;
}

// async function deployDependencies(lockAndDataForMainnet: LockAndDataForMainnetInstance) {
//     await deployDepositBoxERC721(lockAndDataForMainnet);
// }

export async function deployDepositBoxERC721(
    lockAndDataForMainnet: LockAndDataForMainnetInstance
) {
    if (await lockAndDataForMainnet.getContract(name) !== "0x0000000000000000000000000000000000000000") {
        return DepositBoxERC721.at(await lockAndDataForMainnet.getContract(name));
    } else {
        return await deploy(lockAndDataForMainnet);
    }
}