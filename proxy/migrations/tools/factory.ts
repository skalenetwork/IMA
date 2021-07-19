import { ethers, upgrades } from "hardhat";
import hre from "hardhat";
import { Artifact } from "hardhat/types";

async function getLinkedContractFactory(contractName: string, libraries: any) {
    const cArtifact = await hre.artifacts.readArtifact(contractName);
    const linkedBytecode = _linkBytecode(cArtifact, libraries);
    const ContractFactory = await ethers.getContractFactory(cArtifact.abi, linkedBytecode);
    return ContractFactory;
}

async function deployLibraries(libraryNames: string[]) {
    const libraries: any = {};
    for (const libraryName of libraryNames) {
        libraries[libraryName] = await _deployLibrary(libraryName);
    }
    return libraries;
}

async function _deployLibrary(libraryName: string) {
    const Library = await ethers.getContractFactory(libraryName);
    const library = await Library.deploy();
    await library.deployed();
    return library.address;
}

function _linkBytecode(artifact: Artifact, libraries: { [x: string]: any }) {
    let bytecode = artifact.bytecode;
    for (const [, fileReferences] of Object.entries(artifact.linkReferences)) {
        for (const [libName, fixups] of Object.entries(fileReferences)) {
            const addr = libraries[libName];
            if (addr === undefined) {
                continue;
            }
            for (const fixup of fixups) {
                bytecode =
                bytecode.substr(0, 2 + fixup.start * 2) +
                addr.substr(2) +
                bytecode.substr(2 + (fixup.start + fixup.length) * 2);
            }
        }
    }
    return bytecode;
}

export {
    deployLibraries,
    getLinkedContractFactory
};
