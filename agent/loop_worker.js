
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
 * @file loop_worker.js
 * @copyright SKALE Labs 2019-Present
 */

const {
    parentPort
    //, workerData
} = require( "worker_threads" );
const network_layer = require( "../npms/skale-cool-socket/socket.js" );
const { Server } = require( "../npms/skale-cool-socket/server.js" );
const owaspUtils = require( "../npms/skale-owasp/owasp-util.js" );

const loop = require( "./loop.js" );

const g_url = "ima_loop_server";
