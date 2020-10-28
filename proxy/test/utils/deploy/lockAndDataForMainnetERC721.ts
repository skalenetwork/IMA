import { LockAndDataForMainnetERC721Contract } from "../../../types/truffle-contracts";
import { LockAndDataForMainnetInstance } from "../../../types/truffle-contracts";

const LockAndDataForMainnetERC721: LockAndDataForMainnetERC721Contract = artifacts.require("./LockAndDataForMainnetERC721");
const name = "LockAndDataForMainnetERC721";

export async function deployLockAndDataForMainnetERC721(lockAndDataForMainnet: LockAndDataForMainnetInstance) {
    try {
        return LockAndDataForMainnetERC721.at(await lockAndDataForMainnet.contract(name));
    } catch (e) {
        const instance = await LockAndDataForMainnetERC721.new();
        await instance.initialize(lockAndDataForMainnet.address);
        await lockAndDataForMainnet.setContract(name, instance.address);
        return instance;
    }
}
