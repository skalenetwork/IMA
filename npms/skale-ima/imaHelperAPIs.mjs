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
 * @file imaHelperAPIs.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as log from "../skale-log/log.mjs";
import * as cc from "../skale-cc/cc.mjs";

import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as rpcCall from "../../agent/rpcCall.mjs";

export const longSeparator =
    "============================================================" +
    "===========================================================";

let gMillisecondsSleepBeforeFetchOutgoingMessageEvent = 5000;
let gMillisecondsSleepBetweenTransactionsOnSChain = 0; // example - 5000
let gFlagWaitForNextBlockOnSChain = false;

export function getMillisecondsSleepBeforeFetchOutgoingMessageEvent() {
    return gMillisecondsSleepBeforeFetchOutgoingMessageEvent;
}
export function setMillisecondsSleepBeforeFetchOutgoingMessageEvent( val ) {
    gMillisecondsSleepBeforeFetchOutgoingMessageEvent = val ? val : 0;
}

export function getSleepBetweenTransactionsOnSChainMilliseconds() {
    return gMillisecondsSleepBetweenTransactionsOnSChain;
}
export function setSleepBetweenTransactionsOnSChainMilliseconds( val ) {
    gMillisecondsSleepBetweenTransactionsOnSChain = val ? val : 0;
}

export function getWaitForNextBlockOnSChain() {
    return ( !!gFlagWaitForNextBlockOnSChain );
}
export function setWaitForNextBlockOnSChain( val ) {
    gFlagWaitForNextBlockOnSChain = ( !!val );
}

export const sleep = ( milliseconds ) => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
};
export const currentTimestamp = () => {
    return parseInt( parseInt( Date.now().valueOf() ) / 1000 );
};

export async function safeWaitForNextBlockToAppear( details, ethersProvider ) {
    const nBlockNumber =
        owaspUtils.toBN( await safeGetBlockNumber( details, 10, ethersProvider ) );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        details.write( cc.debug( "Waiting for next block to appear..." ) + "\n" );
        details.write( cc.debug( "    ...have block " ) +
            cc.info( nBlockNumber.toHexString() ) + "\n" );
    }
    for( ; true; ) {
        await sleep( 1000 );
        const nBlockNumber2 =
            owaspUtils.toBN( await safeGetBlockNumber( details, 10, ethersProvider ) );
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( cc.debug( "    ...have block " ) +
                cc.info( nBlockNumber2.toHexString() ) + "\n" );
        }
        if( nBlockNumber2.gt( nBlockNumber ) )
            break;
    }
}

export async function safeGetBlockNumber(
    details, cntAttempts, ethersProvider, retValOnFail, throwIfServerOffline
) {
    const strFnName = "getBlockNumber";
    const u = owaspUtils.ethersProviderToUrl( ethersProvider );
    const nWaitStepMilliseconds = 10 * 1000;
    if( throwIfServerOffline == null || throwIfServerOffline == undefined )
        throwIfServerOffline = true;
    cntAttempts = owaspUtils.parseIntOrHex( cntAttempts ) < 1
        ? 1 : owaspUtils.parseIntOrHex( cntAttempts );
    if( retValOnFail == null || retValOnFail == undefined )
        retValOnFail = "";
    let idxAttempt = 1;
    let ret = retValOnFail;
    while( ( idxAttempt == 1 || ret === "" ) && idxAttempt <= cntAttempts ) {
        const isOnLine = await rpcCall.checkUrl( u, nWaitStepMilliseconds );
        if( ! isOnLine ) {
            ret = retValOnFail;
            if( ! throwIfServerOffline )
                return ret;
            if( log.verboseGet() >= log.verboseReversed().error ) {
                details.write( cc.error( "Cannot call " ) + cc.note( strFnName + "()" ) +
                    cc.error( " via " ) + cc.u( u ) + cc.warning( " because server is off-line" ) +
                    "\n" );
            }
            throw new Error(
                "Cannot " + strFnName + "() via " + u.toString() +
                " because server is off-line" );
        }
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( cc.warning( "Repeat call to " ) + cc.note( strFnName + "()" ) +
                cc.error( " via " ) + cc.u( u ) + cc.warning( ", attempt " ) +
                cc.info( idxAttempt ) + "\n" );
        }
        try {
            ret = await ethersProvider[strFnName]();
            return ret;
        } catch ( err ) {
            ret = retValOnFail;
            if( log.verboseGet() >= log.verboseReversed().error ) {
                details.write( cc.error( "Failed call attempt " ) + cc.info( idxAttempt ) +
                    cc.error( " to " ) + cc.note( strFnName + "()" ) + cc.error( " via " ) +
                    cc.u( u ) + cc.error( ", error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
        }
        ++ idxAttempt;
    }
    details.write( cc.fatal( "ERROR:" ) +
        cc.error( " Failed call to " ) + cc.note( strFnName + "()" ) +
        + cc.error( " via " ) + cc.u( u ) + cc.error( " after " ) +
        cc.info( cntAttempts ) + cc.error( " attempts " ) +
        "\n" );
    throw new Error( "Failed call to " + strFnName + "() via " +
    u.toString() + " after " + cntAttempts + " attempts" );
}

let gCountOfBlocksInIterativeStep = 1000;
let gMaxBlockScanIterationsInAllRange = 5000;

export function getBlocksCountInInIterativeStepOfEventsScan() {
    return gCountOfBlocksInIterativeStep;
}
export function setBlocksCountInInIterativeStepOfEventsScan( n ) {
    if( ! n )
        gCountOfBlocksInIterativeStep = 0;
    else {
        gCountOfBlocksInIterativeStep = owaspUtils.parseIntOrHex( n );
        if( gCountOfBlocksInIterativeStep < 0 )
            gCountOfBlocksInIterativeStep = 0;
    }
}

export function getMaxIterationsInAllRangeEventsScan() {
    return gCountOfBlocksInIterativeStep;
}
export function setMaxIterationsInAllRangeEventsScan( n ) {
    if( ! n )
        gMaxBlockScanIterationsInAllRange = 0;
    else {
        gMaxBlockScanIterationsInAllRange = owaspUtils.parseIntOrHex( n );
        if( gMaxBlockScanIterationsInAllRange < 0 )
            gMaxBlockScanIterationsInAllRange = 0;
    }
}

// default S<->S transfer mode for "--s2s-transfer" is "forward"
let gFlagIsForwardS2S = true;

export function getS2STransferModeDescription() {
    return gFlagIsForwardS2S ? "forward" : "reverse";
}

export function getS2STransferModeDescriptionColorized() {
    return gFlagIsForwardS2S ? cc.success( "forward" ) : cc.error( "reverse" );
}

export function isForwardS2S() {
    return ( !!gFlagIsForwardS2S );
}

export function isReverseS2S() {
    return ( !!gFlagIsForwardS2S );
}

export function setForwardS2S( b ) {
    if( b == null || b == undefined )
        b = true;
    gFlagIsForwardS2S = ( !!b );
}

export function setReverseS2S( b ) {
    if( b == null || b == undefined )
        b = true;
    gFlagIsForwardS2S = b ? false : true;
}
