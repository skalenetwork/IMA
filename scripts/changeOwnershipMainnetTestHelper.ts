// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @file changeOwnershipMainnetTestHelper.ts
 * @copyright SKALE Labs 2019-Present
 *
 * Helper for scripts/test_change_ownership_mainnet.sh. Not for production use.
 *
 * ACTION=prepare
 *   Gives the deployer every role from `rolesToCheck` that each IMA mainnet contract declares
 *   (simulates extra roles held by the deployer) and writes the expected state to STATE_FILE.
 *   NEW_OWNER_TYPE=eoa|safe        the new owner is a random EOA or a freshly deployed SafeMock
 *   PROXY_ADMIN=per-proxy|shared   per-proxy keeps the ProxyAdmin each proxy got at deployment;
 *                                  shared redeploys every proxy behind one shared ProxyAdmin
 *                                  (layout of older deployments) and updates the ABI file
 *   PROXY_ADMIN_OWNER=old|new      new moves the ProxyAdmins to the new owner before the
 *                                  ownership change (ProxyAdmins already owned by a Safe)
 * ACTION=verify
 *   Checks that the new owner owns every ProxyAdmin and holds every role the old owner had,
 *   and that the old owner holds none of the checked roles.
 */

import { promises as fs } from "fs";
import { ethers } from "hardhat";
import { getAdminAddress, getImplementationAddress } from "@openzeppelin/upgrades-core";
import ProxyAdminArtifact from "@openzeppelin/upgrades-core/artifacts/ProxyAdmin.json";
import TransparentProxyArtifact from "@openzeppelin/upgrades-core/artifacts/AdminUpgradeabilityProxy.json";
import { contracts, depositBoxes, getContractKeyInAbiFile } from "../migrations/deployMainnet";
import { rolesToCheck } from "../migrations/changeOwnershipMainnet";

const ACCESS_CONTROL_ABI = [
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function grantRole(bytes32 role, address account)"
];
const OWNABLE_ABI = [
    "function owner() view returns (address)",
    "function transferOwnership(address newOwner)"
];

const allRoles = ["DEFAULT_ADMIN_ROLE", ...rolesToCheck];

function roleId(role: string) {
    return role === "DEFAULT_ADMIN_ROLE" ? ethers.ZeroHash : ethers.id(role);
}

interface State {
    oldOwner: string;
    newOwner: string;
    // contract name => roles held by the old owner before the ownership change
    oldOwnerRoles: { [contract: string]: string[] };
}

function getEnv(name: string) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Set ${name} env variable`);
    }
    return value;
}

async function getAddresses() {
    const abi = JSON.parse(await fs.readFile(getEnv("ABI"), "utf-8"));
    return contracts.map(name => ({
        address: abi[`${getContractKeyInAbiFile(name)}_address`] as string,
        name
    }));
}

// Redeploys every proxy with the same implementation behind one shared ProxyAdmin.
// hardhat-upgrades creates one ProxyAdmin per proxy, and that admin can't be changed afterwards.
async function redeployBehindSharedProxyAdmin() {
    const [deployer] = await ethers.getSigners();
    const abiFilename = getEnv("ABI");
    const abi = JSON.parse(await fs.readFile(abiFilename, "utf-8"));
    const oldAddress = (name: string) => abi[`${getContractKeyInAbiFile(name)}_address`] as string;

    const oldMessageProxy = await ethers.getContractAt("MessageProxyForMainnet", oldAddress("MessageProxyForMainnet"));
    const contractManagerAddress = await oldMessageProxy.contractManagerOfSkaleManager();
    const version = await oldMessageProxy.version();
    const contractManager = await ethers.getContractAt("ContractManager", contractManagerAddress);

    const proxyAdmin = await new ethers.ContractFactory(
        ProxyAdminArtifact.abi, ProxyAdminArtifact.bytecode, deployer
    ).deploy();
    await proxyAdmin.waitForDeployment();
    const proxyAdminAddress = await proxyAdmin.getAddress();
    console.log(`Shared ProxyAdmin deployed to ${proxyAdminAddress}`);

    const newAddresses = new Map<string, string>();
    const deployProxy = async (name: string, args: string[]) => {
        const implementation = await getImplementationAddress(ethers.provider, oldAddress(name));
        // initialize is overloaded, so use the full signature (all arguments are addresses)
        const initializer = (await ethers.getContractFactory(name)).interface.encodeFunctionData(
            `initialize(${args.map(() => "address").join(",")})`,
            args
        );
        const proxy = await new ethers.ContractFactory(
            TransparentProxyArtifact.abi, TransparentProxyArtifact.bytecode, deployer
        ).deploy(implementation, proxyAdminAddress, initializer);
        await proxy.waitForDeployment();
        const address = await proxy.getAddress();
        await (await contractManager.setContractsAddress(name, address)).wait();
        newAddresses.set(name, address);
        return address;
    };

    const messageProxy = await deployProxy("MessageProxyForMainnet", [contractManagerAddress]);
    const linker = await deployProxy("Linker", [contractManagerAddress, messageProxy]);
    const communityPool = await deployProxy("CommunityPool", [contractManagerAddress, linker, messageProxy]);
    for (const depositBox of depositBoxes) {
        await deployProxy(depositBox, [contractManagerAddress, linker, messageProxy]);
    }
    const newMessageProxy = await ethers.getContractAt("MessageProxyForMainnet", messageProxy);
    await (await newMessageProxy.setCommunityPool(communityPool)).wait();
    await (await newMessageProxy.setVersion(version)).wait();

    for (const [name, address] of newAddresses) {
        abi[`${getContractKeyInAbiFile(name)}_address`] = address;
    }
    await fs.writeFile(abiFilename, JSON.stringify(abi, null, 4));
}

async function prepare() {
    const [deployer] = await ethers.getSigners();
    const proxyAdminLayout = getEnv("PROXY_ADMIN");
    if (proxyAdminLayout === "shared") {
        await redeployBehindSharedProxyAdmin();
    } else if (proxyAdminLayout !== "per-proxy") {
        throw new Error(`Unknown PROXY_ADMIN ${proxyAdminLayout}`);
    }
    const addresses = await getAddresses();

    let newOwner: string;
    if (process.env.NEW_OWNER_TYPE === "safe") {
        const safeMock = await (await ethers.getContractFactory("SafeMock")).deploy();
        await safeMock.waitForDeployment();
        newOwner = await safeMock.getAddress();
        console.log(`SafeMock deployed to ${newOwner}`);
    } else {
        newOwner = ethers.Wallet.createRandom().address;
    }

    const proxyAdmins = new Set<string>();
    const oldOwnerRoles: State["oldOwnerRoles"] = {};
    for (const { name, address } of addresses) {
        const contract = new ethers.Contract(address, ACCESS_CONTROL_ABI, deployer);
        const contractInterface = (await ethers.getContractFactory(name)).interface;
        // Only roles the contract declares (it has a public getter for them)
        const declaredRoles = rolesToCheck.filter(role => contractInterface.getFunction(role) !== null);
        // Fails when a contract gets a new role that the ownership change script does not handle
        contractInterface.forEachFunction(fragment => {
            if (fragment.name.endsWith("_ROLE") && !allRoles.includes(fragment.name)) {
                throw new Error(`${name} declares ${fragment.name}, which is missing in rolesToCheck`);
            }
        });
        for (const role of declaredRoles) {
            if (!await contract.hasRole(roleId(role), deployer.address)) {
                await (await contract.grantRole(roleId(role), deployer.address)).wait();
            }
        }
        oldOwnerRoles[name] = [];
        for (const role of allRoles) {
            if (await contract.hasRole(roleId(role), deployer.address)) {
                oldOwnerRoles[name].push(role);
            }
        }
        if (!oldOwnerRoles[name].includes("DEFAULT_ADMIN_ROLE")) {
            throw new Error(`Deployer is not an admin of ${name}`);
        }

        proxyAdmins.add(await getAdminAddress(ethers.provider, address));
    }

    const expectedProxyAdmins = proxyAdminLayout === "shared" ? 1 : addresses.length;
    if (proxyAdmins.size !== expectedProxyAdmins) {
        throw new Error(`Expected ${expectedProxyAdmins} ProxyAdmin(s), found ${proxyAdmins.size}`);
    }
    console.log(`${addresses.length} proxies use ${proxyAdmins.size} ProxyAdmin(s)`);

    for (const proxyAdminAddress of proxyAdmins) {
        const proxyAdmin = new ethers.Contract(proxyAdminAddress, OWNABLE_ABI, deployer);
        if (await proxyAdmin.owner() !== deployer.address) {
            throw new Error(`ProxyAdmin ${proxyAdminAddress} is not owned by the deployer`);
        }
        if (getEnv("PROXY_ADMIN_OWNER") === "new") {
            await (await proxyAdmin.transferOwnership(newOwner)).wait();
            console.log(`ProxyAdmin ${proxyAdminAddress} moved to the new owner before the ownership change`);
        }
    }

    const state: State = { newOwner, oldOwner: deployer.address, oldOwnerRoles };
    await fs.writeFile(getEnv("STATE_FILE"), JSON.stringify(state, null, 4));
    console.log(`New owner: ${newOwner}`);
}

async function verify() {
    const state = JSON.parse(await fs.readFile(getEnv("STATE_FILE"), "utf-8")) as State;
    const addresses = await getAddresses();
    const errors: string[] = [];

    for (const { name, address } of addresses) {
        const proxyAdminAddress = await getAdminAddress(ethers.provider, address);
        const proxyAdmin = new ethers.Contract(proxyAdminAddress, OWNABLE_ABI, ethers.provider);
        const proxyAdminOwner = await proxyAdmin.owner();
        if (proxyAdminOwner !== state.newOwner) {
            errors.push(`${name}: ProxyAdmin ${proxyAdminAddress} is owned by ${proxyAdminOwner}`);
        }

        const contract = new ethers.Contract(address, ACCESS_CONTROL_ABI, ethers.provider);
        const expectedRoles = state.oldOwnerRoles[name];
        if (!expectedRoles.includes("DEFAULT_ADMIN_ROLE")) {
            errors.push(`${name}: DEFAULT_ADMIN_ROLE is missing in the snapshot`);
        }
        for (const role of allRoles) {
            if (await contract.hasRole(roleId(role), state.oldOwner)) {
                errors.push(`${name}: old owner still has ${role}`);
            }
            if (expectedRoles.includes(role) && !await contract.hasRole(roleId(role), state.newOwner)) {
                errors.push(`${name}: new owner does not have ${role}`);
            }
        }
        console.log(`${name}: ProxyAdmin owner ${proxyAdminOwner}, roles moved: ${expectedRoles.join(", ")}`);
    }

    if (errors.length) {
        throw new Error(`Ownership change verification failed:\n${errors.join("\n")}`);
    }
    console.log("Ownership change verified");
}

async function main() {
    const action = getEnv("ACTION");
    if (action === "prepare") {
        await prepare();
    } else if (action === "verify") {
        await verify();
    } else {
        throw new Error(`Unknown ACTION ${action}`);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
