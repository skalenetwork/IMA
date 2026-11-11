// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file changeOwnershipMainnet.ts
 * @copyright SKALE Labs 2019-Present
 *
 * Moves ownership of the IMA mainnet contracts from an old owner (EOA or Safe)
 * to a new owner:
 * - ownership of every ProxyAdmin (one per proxy or shared)
 * - DEFAULT_ADMIN_ROLE and every role listed in `rolesToCheck`
 * The old owner's roles are renounced afterwards (unless REVOKE_ROLES=false).
 *
 * Environment variables:
 * - TARGET          (required) mainnet-ima instance alias or MessageProxyForMainnet address
 * - NEW_OWNER       (required) address that receives ownership
 * - MULTISIG_OWNER  (optional) Safe address of the old owner. Transactions are proposed to the Safe.
 *                   If not set, the old owner is the first hardhat signer and transactions are sent directly.
 * - READONLY        (optional) "true" only prints the current state
 * - REVOKE_ROLES    (optional) "false" keeps the old owner's roles after granting them to the new owner
 * - TEST_MODE       (optional) "true" skips interactive confirmations (local testing only)
 */

import { ethers } from "hardhat";
import { skaleContracts } from "@skalenetwork/skale-contracts-ethers-v6";
import { EoaSubmitter, InstanceAdmin, InstanceAdminOptions, SafeSubmitter } from "@skalenetwork/upgrade-tools";
import { contracts } from "./deployMainnet";

// DEFAULT_ADMIN_ROLE is not listed: InstanceAdmin always handles it
export const rolesToCheck = [
    // MessageProxy
    "CHAIN_CONNECTOR_ROLE",
    "EXTRA_CONTRACT_REGISTRAR_ROLE",
    "CONSTANT_SETTER_ROLE",
    // MessageProxyForMainnet
    "PAUSABLE_ROLE",
    // Twin (Linker, CommunityPool, deposit boxes); CommunityPool also uses CONSTANT_SETTER_ROLE
    "LINKER_ROLE",
    // DepositBox
    "DEPOSIT_BOX_MANAGER_ROLE",
    // DepositBoxERC20
    "ARBITER_ROLE"
];

export async function getImaMainnetInstance(target: string) {
    const network = await skaleContracts.getNetworkByProvider(ethers.provider);
    const project = network.getProject("mainnet-ima");
    const instance = await project.getInstance(target);
    try {
        // Loads the ABI of the deployed version. It is needed to resolve the addresses of the contracts.
        await instance.getContract("MessageProxyForMainnet");
    } catch (error) {
        throw new Error(
            `Can't load mainnet-ima instance ${target}. ` +
            "The ABI of the deployed version must be published " +
            "(GitHub release or the abi branch of the IMA repository).\n" +
            `Cause: ${error instanceof Error ? error.message : String(error)}`
        );
    }
    return instance;
}

async function main() {
    let readonly = false;
    let renounceRoles = true;
    let testMode = false;
    let oldOwner: string;
    let submitter: EoaSubmitter | SafeSubmitter;

    if (!process.env.NEW_OWNER) {
        throw new Error("Please set NEW_OWNER env variable");
    }

    if (!process.env.TARGET) {
        throw new Error("Please set TARGET env variable (instance alias or MessageProxyForMainnet address)");
    }

    if (process.env.READONLY) {
        readonly = process.env.READONLY === "true";
    }

    if (process.env.TEST_MODE === "true") {
        readonly = false;
        renounceRoles = true;
        testMode = true;
    }

    if (process.env.REVOKE_ROLES) {
        renounceRoles = process.env.REVOKE_ROLES === "true";
    }

    // InstanceAdmin compares addresses as strings, so they must be checksummed
    if (process.env.MULTISIG_OWNER) {
        oldOwner = ethers.getAddress(process.env.MULTISIG_OWNER);
        submitter = new SafeSubmitter(oldOwner);
    } else {
        oldOwner = (await ethers.getSigners())[0].address;
        submitter = new EoaSubmitter();
    }
    const newOwner = ethers.getAddress(process.env.NEW_OWNER);

    console.log(`Old owner: ${oldOwner}`);
    console.log(`New owner: ${newOwner}`);

    const instance = await getImaMainnetInstance(process.env.TARGET);
    const options: InstanceAdminOptions = {
        newOwner,
        oldOwner,
        readonly,
        renounceRoles,
        rolesToCheck,
        submitter,
        testMode
    };
    const admin = new InstanceAdmin(
        contracts.map(name => ({ name })),
        options,
        instance
    );
    await admin.executeOwnershipTransfer();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
