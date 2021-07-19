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

export function randomString(length: number) {
    const random13chars = () => {
        return Math.random().toString(16).substring(2, 15);
    };
    const loops = Math.ceil(length / 13);
    return new Array(loops).fill(random13chars).reduce((stringg, func) => {
        return stringg + func();
    }, "").substring(0, length);
}

export function createBytes32(str: string) {
    const numberOfSymbolsInBytes32: number = 64;
    const length: number = str.length;
    const multiple: number = numberOfSymbolsInBytes32 - length;
    return "0".repeat(multiple) + str;
}

export function stringToHex(str: string, hex: any) {
    try {
        hex = unescape(encodeURIComponent(str))
            .split("").map((v) => {
                return v.charCodeAt(0).toString(16);
            }).join("");
    } catch (e) {
        hex = str;
        console.log("invalid text input: " + str);
    }
    return hex;
}

export function stringFromHex(value: string) {
    const hex = value.toString().slice(2);
    let str = '';
    for (let n = 0; n < hex.length; n += 2) {
        str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
    }
    return str;
}

export function stringValue(value: string | null | undefined) {
    if (value) {
        return value;
    } else {
        return "";
    }
}
