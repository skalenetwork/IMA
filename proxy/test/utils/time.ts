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
 * @file time.ts
 * @copyright SKALE Labs 2019-Present
 */

import Web3 = require("web3");

let requistId = 0xd2;

function responseCallback(error: Error | null, val?: any) {
    if (error !== null) {
        console.log(error, val);
    }
}

export function skipTime(web3: Web3, seconds: number) {
    web3.currentProvider.send(
        {
            id: requistId++,
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [seconds],
        },
        responseCallback);

    web3.currentProvider.send(
        {
            id: requistId++,
            jsonrpc: "2.0",
            method: "evm_mine",
            params: [],
        },
        responseCallback);
}

export async function currentTime(web3: Web3) {
    return (await web3.eth.getBlock("latest")).timestamp;
}
