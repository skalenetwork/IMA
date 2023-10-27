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
 * @file imaExternalLogScan.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as cc from "../skale-cc/cc.mjs";
import * as log from "../skale-log/log.mjs";
import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as imaEventLogScan from "./imaEventLogScan.mjs";

const gIsDebugLogging = false; // development option only, must be always false
cc.enable( false );
log.addStdout();

// allow self-signed wss and https
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

function finalizeOutput( jo ) {
    if( ! jo )
        return;
    cc.enable( false );
    process.stdout.write( cc.j( jo ) );
}

async function run() {
    const details = log.createMemoryStream();
    try {
        if( gIsDebugLogging ) {
            log.write( cc.debug( "Process startup arguments array is " ) +
                cc.j( process.argv ) + "\n" );
        }
        if( process.argv.length != 3 )
            throw new Error( "Wrong number of command line arguments" );

        if( gIsDebugLogging ) {
            log.write( cc.debug( "Main argument text is " ) +
                cc.j( process.argv[2] ) + "\n" );
        }
        const joArg = JSON.parse( process.argv[2] );
        if( gIsDebugLogging ) {
            log.write( cc.debug( "Main argument JSON is " ) +
                cc.j( joArg ) + "\n" );
        }

        const ethersProvider = owaspUtils.getEthersProviderFromURL( joArg.url );
        const joContract = new owaspUtils.ethersMod.ethers.Contract(
            joArg.address, joArg.abi, ethersProvider );

        const arrLogRecordReferencesWalk = await imaEventLogScan.safeGetPastEventsProgressive(
            details, "", ethersProvider, joArg.attempts,
            joContract, joArg.strEventName,
            joArg.nBlockFrom, joArg.nBlockTo, joArg.joFilter );

        finalizeOutput( { "result": arrLogRecordReferencesWalk, "error": null } );
        process.exit( 0 );
    } catch ( err ) {
        if( gIsDebugLogging ) {
            log.write( cc.error( "Failed to create RPC call: " ) +
        cc.j( err ) + "\n" );
        }
        finalizeOutput( {
            "error": owaspUtils.extractErrorMessage( err ),
            "output": details.toString()
        } );
        process.exit( 1 );
    }
}
run();
