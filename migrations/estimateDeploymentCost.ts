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
 * @file estimateDeploymentCost.ts
 * @copyright SKALE Labs 2024-Present
 */

import { ethers } from "hardhat";
import { contracts } from "./deployMainnet";

async function main() {
    console.log("Estimating deployment cost for implementation contracts");
    console.log("=========================================================\n");

    const feeData = await ethers.provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? 0n;

    console.log("Current gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei\n");

    let totalGas = 0n;
    const estimates: { contract: string; gas: bigint; cost: string }[] = [];

    for (const contractName of contracts) {
        try {
            const factory = await ethers.getContractFactory(contractName);
            const deployTransaction = await factory.getDeployTransaction();
            const estimatedGas = await ethers.provider.estimateGas(deployTransaction);

            const cost = estimatedGas * gasPrice;
            totalGas += estimatedGas;

            estimates.push({
                contract: contractName,
                gas: estimatedGas,
                cost: ethers.formatEther(cost)
            });

            console.log(`${contractName}:`);
            console.log(`  Gas: ${estimatedGas.toLocaleString()}`);
            console.log(`  Cost: ${ethers.formatEther(cost)} ETH\n`);
        } catch (error) {
            console.log(`${contractName}: Failed to estimate - ${error}`);
        }
    }

    const totalCost = totalGas * gasPrice;

    console.log("=========================================================");
    console.log("SUMMARY");
    console.log("=========================================================");
    console.log(`Total contracts: ${contracts.length}`);
    console.log(`Total gas: ${totalGas.toLocaleString()}`);
    console.log(`Total cost: ${ethers.formatEther(totalCost)} ETH`);

    // Add 20% buffer for safety
    const withBuffer = totalCost + (totalCost * 20n / 100n);
    console.log(`With 20% buffer: ${ethers.formatEther(withBuffer)} ETH`);
    console.log("=========================================================");
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
