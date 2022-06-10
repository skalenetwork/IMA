import { ethers } from "hardhat";
import { ContractManager, Nodes } from "../../../typechain";
import { BytesLike } from "ethers";

const nameNodes = "Nodes";

// const nodeCreationParams = {
//     port: 1337,
//     nonce: 1337,
//     ip: "0x12345678",
//     publicIp: "0x12345678",
//     publicKey: getPublicKey(nodeAddress),
//     name: "GasCalculationNode",
//     domainName: "gascalculationnode.com"
// };

type NodeCreationParams = {
    port: number;
    nonce: number;
    ip: string;
    publicIp: string;
    publicKey: [BytesLike, BytesLike];
    name: string;
    domainName: string;
}

export async function createNode(
    contractManager: ContractManager,
    from: string,
    nodeCreationParams: NodeCreationParams
) {
    const nodesFactory = await ethers.getContractFactory("Nodes");
    const nodesAddres = await contractManager.getContract("Nodes");
    const nodes = nodesFactory.attach(nodesAddres) as Nodes;
    await nodes.createNode(from, nodeCreationParams);
}
