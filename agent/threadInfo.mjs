
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE IMA
 *
 * SKALE IMA is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * SKALE IMA is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file loop.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as worker_threads from "worker_threads";
import * as cc from "../npms/skale-cc/cc.mjs";

const Worker = worker_threads.Worker;
export { Worker };

export const sleep = ( milliseconds ) => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
};

export function threadDescription( isColorized ) {
    if( typeof isColorized == "undefined" )
        isColorized = true;
    const tid = worker_threads.threadId;
    const st = worker_threads.isMainThread ? "main" : "worker";
    return isColorized
        ? ( cc.sunny( st ) + cc.bright( " thread " ) + cc.info( tid ) )
        : ( st + " thread " + tid );
}
