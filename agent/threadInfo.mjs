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
import * as log from "../npms/skale-log/log.mjs";

const Worker = worker_threads.Worker;
export { Worker };

export const sleep = ( milliseconds ) => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
};

export function getCurrentThreadID() {
    return worker_threads.threadId;
}

export function isMainThread() {
    return ( !!( worker_threads.isMainThread ) );
}

export function threadDescription( isColorized ) {
    if( typeof isColorized == "undefined" )
        isColorized = true;
    const tid = getCurrentThreadID();
    const st = isMainThread() ? "main" : "worker";
    return isColorized
        ? ( cc.sunny( st ) + cc.bright( " thread " ) + cc.info( tid ) )
        : ( st + " thread " + tid );
}

export async function waitForClientOfWorkerThreadLogicalInitComplete(
    strName, aClient, details, maxSteps, sleepStepMilliseconds
) {
    details = details || log;
    sleepStepMilliseconds = sleepStepMilliseconds ? parseInt( sleepStepMilliseconds ) : 0;
    if( sleepStepMilliseconds <= 0 )
        sleepStepMilliseconds = 1000;
    maxSteps = maxSteps ? parseInt( maxSteps ) : 0;
    if( maxSteps <= 0 )
        maxSteps = 120;
    for( let idxStep = 0; idxStep < maxSteps; ++ idxStep ) {
        if( aClient.logicalInitComplete ) {
            if( log.verboseGet() >= log.verboseReversed().info ) {
                details.write(
                    cc.success( "Done, " ) + cc.sunny( strName ) +
                    cc.success( " init complete, this thread is " ) +
                    threadDescription() + "\n" );
            }
            return true;
        }
        if( aClient.errorLogicalInit ) {
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                details.write( cc.fatal( "CRITICAL ERROR:" ) + " " +
                    cc.error( "Wait error for " ) + cc.sunny( strName ) +
                    cc.error( " init complete, this thread is " ) +
                    threadDescription() + "\n" );
            }
            return false;
        }
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write(
                cc.debug( "Waiting step " ) + cc.info( idxStep + 1 ) + cc.debug( " of " ) +
                cc.info( maxSteps ) + cc.debug( " for " ) + cc.sunny( strName ) +
                cc.debug( " init complete, this thread is " ) +
                threadDescription() + "\n" );
        }
        await sleep( sleepStepMilliseconds );
    }
    if( log.verboseGet() >= log.verboseReversed().critical ) {
        details.write( cc.fatal( "CRITICAL ERROR:" ) + " " +
            cc.error( "Wait timeout for " ) + cc.sunny( strName ) +
            cc.error( " init complete, this thread is " ) +
            threadDescription() + "\n" );
    }
    return false;
}
