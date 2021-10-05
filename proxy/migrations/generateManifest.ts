import { ethers, network, upgrades, artifacts } from "hardhat";
// import hre from "hardhat";
// import { promises as fs } from "fs";
import { getImplementationAddress, hashBytecode, getVersion } from "@openzeppelin/upgrades-core";
// import { getManifestAdmin } from "@openzeppelin/hardhat-upgrades/dist/admin";
// import chalk from "chalk";

export async function getImplKey(contractName: string) {
    return getVersion((await ethers.getContractFactory(contractName)).bytecode).withoutMetadata;
}