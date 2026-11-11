// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @file changeOwnershipMainnetTestHelper.ts
 * @copyright SKALE Labs 2019-Present
 *
 * Helper for scripts/test_change_ownership_mainnet.sh. Not for production use.
 *
 * ACTION=prepare
 *   Gives the deployer every role from `rolesToCheck` that each IMA mainnet contract declares
 *   (simulates extra roles held by the deployer). With NEW_OWNER_TYPE=safe it deploys
 *   a SafeMock and moves every ProxyAdmin to it before the ownership change
 *   (simulates ProxyAdmins already owned by a Safe). Writes the expected state to STATE_FILE.
 * ACTION=verify
 *   Checks that the new owner owns every ProxyAdmin and holds every role the old owner had,
 *   and that the old owner holds none of the checked roles.
 */

import { promises as fs } from "fs";
import { ethers } from "hardhat";
import { getAdminAddress } from "@openzeppelin/upgrades-core";
import { contracts, getContractKeyInAbiFile } from "../migrations/deployMainnet";
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

async function prepare() {
    const [deployer] = await ethers.getSigners();
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

        const proxyAdminAddress = await getAdminAddress(ethers.provider, address);
        proxyAdmins.add(proxyAdminAddress);
        if (process.env.NEW_OWNER_TYPE === "safe") {
            const proxyAdmin = new ethers.Contract(proxyAdminAddress, OWNABLE_ABI, deployer);
            await (await proxyAdmin.transferOwnership(newOwner)).wait();
            console.log(`ProxyAdmin of ${name} moved to the Safe before the ownership change`);
        }
    }
    console.log(`${addresses.length} proxies use ${proxyAdmins.size} ProxyAdmin(s)`);

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
