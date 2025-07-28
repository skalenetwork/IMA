import { JsonRpcProvider, keccak256, toUtf8Bytes, Wallet } from "ethers";
import { ethers } from "hardhat";
import { Instance, skaleContracts } from "@skalenetwork/skale-contracts-ethers-v6";
import { MessageProxyForMainnet } from "../typechain";
import { msigTestnetEndpoints } from "./migrateMainnet";
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
        const schainInfo = await proxyForSchain.connectedChains("0x8d646f556e5d9d6f1edcf7a39b77f5ac253776eb34efcfd688aacbee518efc26"); // MAINNET
        const mainnetInfo = await proxy.connectedChains(hash);
        console.log(`---->> ${schain.name} <<----`);
        console.log("Schain:", schainInfo);
        console.log("Mainnet:", mainnetInfo);
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
        console.log("GOOD!");
        console.log();
    }
    return true;
}

async function main (){
    const provider = new JsonRpcProvider(process.env.ARCHIVE_NODE_ENDPOINT);
    const network = await skaleContracts.getNetworkByProvider(provider);
    const project = network.getProject("mainnet-ima");
    // Set address of the MessageProxyForMainnet contract
    const instance = await project.getInstance("0x682ef859e1cE314ceD13A6FA32cE77AaeCE98e28");
    await checkCounters(instance, msigTestnetEndpoints);
    const block = await provider.getBlock("latest")
    console.log("BLOCK HASH:", block?.hash);
    console.log("Number:", block?.number);
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
