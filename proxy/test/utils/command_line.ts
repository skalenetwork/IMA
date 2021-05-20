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
 * @file command_line.ts
 * @copyright SKALE Labs 2019-Present
 */

import minimist = require("minimist");

const gasMultiplierParameter = "gas_multiplier";

export const argv = minimist(process.argv.slice(2), {string: [gasMultiplierParameter]});

export const gasMultiplier: number =
    argv[gasMultiplierParameter] === undefined ? 1 : Number(argv[gasMultiplierParameter]);
