import { Wallet, BytesLike } from "ethers";
import { ethers } from "hardhat";

import { ec } from "elliptic";

const secp256k1EC = new ec("secp256k1");

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
 * @file helper.ts
 * @copyright SKALE Labs 2019-Present
 */

export function createBytes32(str: string) {
    const numberOfSymbolsInBytes32: number = 64;
    const length: number = str.length;
    const multiple: number = numberOfSymbolsInBytes32 - length;
    return "0".repeat(multiple) + str;
}

export function stringFromHex(value: string) {
    const hex = value.toString().slice(2);
    let str = '';
    for (let n = 0; n < hex.length; n += 2) {
        str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
    }
    return str;
}

export function stringKeccak256(value: string) {
    return ethers.utils.solidityKeccak256(["string"], [value]);
}

export function getPublicKey(wallet: Wallet): [BytesLike, BytesLike] {
    const publicKey = secp256k1EC.keyFromPrivate(wallet.privateKey.slice(2)).getPublic();
    return [ethers.utils.hexlify(publicKey.getX().toBuffer()), ethers.utils.hexlify(publicKey.getY().toBuffer())]
}

export async function getBalance(address: string) {
    return parseFloat(ethers.utils.formatEther(await ethers.provider.getBalance(address)));
}
