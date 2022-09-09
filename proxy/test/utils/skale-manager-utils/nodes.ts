import { ethers } from "hardhat";
import { ContractManager, Nodes } from "../../../typechain";
import { BytesLike } from "ethers";

const nameNodes = "Nodes";

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
    const nodesFactory = await ethers.getContractFactory(nameNodes);
    const nodesAddres = await contractManager.getContract(nameNodes);
    const nodes = nodesFactory.attach(nodesAddres) as Nodes;
    await nodes.createNode(from, nodeCreationParams);
}
