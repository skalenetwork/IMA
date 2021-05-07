import { LinkerContract } from "../../../types/truffle-contracts";
import { MessageProxyForMainnetInstance } from "../../../types/truffle-contracts";

const linker: LinkerContract = artifacts.require("./Linker");

export async function deployLinker(
    messageProxy: MessageProxyForMainnetInstance
) {
    const instance = await linker.new();
    await instance.initialize(messageProxy.address);
    return instance;
}
