import { LockAndDataForMainnetERC721Contract } from "../../../types/truffle-contracts";
import { LockAndDataForMainnetInstance } from "../../../types/truffle-contracts";

const LockAndDataForMainnetERC721: LockAndDataForMainnetERC721Contract = artifacts.require("./LockAndDataForMainnetERC721");
const name = "LockAndDataERC721";

export async function deployLockAndDataForMainnetERC721(lockAndDataForMainnet: LockAndDataForMainnetInstance) {
    if (await lockAndDataForMainnet.getContract(name) !== "0x0000000000000000000000000000000000000000") {
        return LockAndDataForMainnetERC721.at(await lockAndDataForMainnet.getContract(name));
    } else {
        const instance = await LockAndDataForMainnetERC721.new();
        await instance.initialize(lockAndDataForMainnet.address);
        await lockAndDataForMainnet.setContract(name, instance.address);
        return instance;
    }
}
