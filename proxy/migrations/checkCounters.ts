import { JsonRpcProvider, keccak256, toUtf8Bytes, Wallet } from "ethers";
import { ethers } from "hardhat";
import { Instance, skaleContracts } from "@skalenetwork/skale-contracts-ethers-v6";
import { MessageProxyForMainnet } from "../typechain";
function hashName(name: string): string {
  return keccak256(toUtf8Bytes(name));
}
async function checkCounters(
    imaInstance: Instance,
    endpoints: {name: string, endpoint: string}[],
){
    const proxy = await imaInstance.getContract("MessageProxyForMainnet") as unknown as MessageProxyForMainnet;

    for (const schain of endpoints) {
        const url = schain.endpoint;
        const provider = new JsonRpcProvider(url);
        const signer = Wallet.createRandom(provider);
        const hash = hashName(schain.name);
        const proxyForSchain = await ethers.getContractAt("MessageProxyForSchain","0xd2AAa00100000000000000000000000000000000", signer);
        const schainInfo = await proxyForSchain.connectedChains("0x8d646f556e5d9d6f1edcf7a39b77f5ac253776eb34efcfd688aacbee518efc26");
        const mainnetInfo = await proxy.connectedChains(hash);
        console.log(schainInfo);
        console.log(mainnetInfo);
        if (schainInfo.outgoingMessageCounter > mainnetInfo.incomingMessageCounter) {
            console.log("Schain",schain.name,"has outgoing message not received by Mainnet");
            console.log("ABORT");
            return false;
        }
        else if (schainInfo.incomingMessageCounter < mainnetInfo.outgoingMessageCounter) {
            console.log("Mainnet has pending messages to:", schain.name);
            console.log("ABORT");
            return false;
        }
    }
    return true;
}

async function main (){
    const msigTestnetEndpoints: {name: string, endpoint: string}[] = [
        {name: "livid-innocent-altair", endpoint: "http://10.3.155.171:10003/"},
        {name: "unconscious-subdued-alshain", endpoint: "http://10.3.155.171:10067/"}
    ];
    const provider = new JsonRpcProvider("http://3.22.122.202:8545"); // ENDPOINT for HOODI
    const network = await skaleContracts.getNetworkByProvider(provider);
    const project = network.getProject("mainnet-ima");
    const instance = await project.getInstance("0x230c43A9163a4340A1dAe595C76839d162Ef81C0");
    await checkCounters(instance, msigTestnetEndpoints);

}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
