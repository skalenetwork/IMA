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
 * @file index.mjs
 * @copyright SKALE Labs 2019-Present
 */

// init very basics
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as childProcessModule from "child_process";

import { UniversalDispatcherEvent, EventDispatcher }
    from "../skale-cool-socket/eventDispatcher.mjs";

import Redis from "ioredis";
import * as ethereumJsUtilModule from "ethereumjs-util";

import * as log from "../skale-log/log.mjs";
import * as cc from "../skale-cc/cc.mjs";

import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as loop from "../../agent/loop.mjs";
import * as pwa from "../../agent/pwa.mjs";
import * as rpcCall from "../../agent/rpcCall.mjs";
import * as state from "../../agent/state.mjs";
import * as imaUtils from "../../agent/utils.mjs";
import * as imaOracle from "../../agent/oracle.mjs";

const __dirname = path.dirname( url.fileURLToPath( import.meta.url ) );

let redis = null;
cc.enable( false );
log.addStdout();

export const longSeparator =
    "============================================================" +
    "===========================================================";

const perMessageGasForTransfer = 1000000;
const additionalS2MTransferOverhead = 200000;

const gMillisecondsSleepBeforeFetchOutgoingMessageEvent = 5000;
let gMillisecondsSleepBetweenTransactionsOnSChain = 0; // example - 5000
let gFlagWaitForNextBlockOnSChain = false;

export function getSleepBetweenTransactionsOnSChainMilliseconds() {
    return gMillisecondsSleepBetweenTransactionsOnSChain;
}
export function setSleepBetweenTransactionsOnSChainMilliseconds( val ) {
    gMillisecondsSleepBetweenTransactionsOnSChain = val ? val : 0;
}

export function getWaitForNextBlockOnSChain() {
    return gFlagWaitForNextBlockOnSChain ? true : false;
}
export function setWaitForNextBlockOnSChain( val ) {
    gFlagWaitForNextBlockOnSChain = val ? true : false;
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
    details.write(
        cc.debug( "Waiting for next block to appear..." ) + "\n" );
    details.write(
        cc.debug( "    ...have block " ) + cc.info( nBlockNumber.toHexString() ) + "\n" );
    for( ; true; ) {
        await sleep( 1000 );
        const nBlockNumber2 =
            owaspUtils.toBN( await safeGetBlockNumber( details, 10, ethersProvider ) );
        details.write(
            cc.debug( "    ...have block " ) + cc.info( nBlockNumber2.toHexString() ) + "\n" );
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
    cntAttempts =
        owaspUtils.parseIntOrHex( cntAttempts ) < 1
            ? 1 : owaspUtils.parseIntOrHex( cntAttempts );
    if( retValOnFail == null || retValOnFail == undefined )
        retValOnFail = "";
    let idxAttempt = 1;
    let ret = retValOnFail;
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
    while( ret === "" && idxAttempt <= cntAttempts ) {
        const isOnLine = rpcCall.checkUrl( u, nWaitStepMilliseconds );
        if( ! isOnLine ) {
            ret = retValOnFail;
            if( ! throwIfServerOffline )
                return ret;
            details.write(
                cc.error( "Cannot call " ) + cc.note( strFnName + "()" ) +
                cc.error( " via " ) + cc.u( u ) +
                cc.warning( " because server is off-line" ) + "\n" );
            throw new Error( "Cannot " + strFnName + "() via " + u.toString() +
            " because server is off-line" );
        }
        details.write(
            cc.warning( "Repeat call to " ) + cc.note( strFnName + "()" ) +
            cc.error( " via " ) + cc.u( u ) +
            cc.warning( ", attempt " ) + cc.info( idxAttempt ) +
            "\n" );
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
    if( ( idxAttempt + 1 ) > cntAttempts && ret === "" ) {
        details.write( cc.fatal( "ERROR:" ) +
            cc.error( " Failed call to " ) + cc.note( strFnName + "()" ) +
            + cc.error( " via " ) + cc.u( u ) + cc.error( " after " ) +
            cc.info( cntAttempts ) + cc.error( " attempts " ) +
            "\n" );
        throw new Error( "Failed call to " + strFnName + "() via " +
        u.toString() + " after " + cntAttempts + " attempts" );
    }
    return ret;
}

export async function safeGetTransactionCount(
    details, cntAttempts, ethersProvider, address, param, retValOnFail, throwIfServerOffline
) {
    const strFnName = "getTransactionCount";
    const u = owaspUtils.ethersProviderToUrl( ethersProvider );
    const nWaitStepMilliseconds = 10 * 1000;
    if( throwIfServerOffline == null || throwIfServerOffline == undefined )
        throwIfServerOffline = true;
    cntAttempts =
        owaspUtils.parseIntOrHex( cntAttempts ) < 1
            ? 1
            : owaspUtils.parseIntOrHex( cntAttempts );
    if( retValOnFail == null || retValOnFail == undefined )
        retValOnFail = "";
    let ret = retValOnFail;
    let idxAttempt = 1;
    try {
        ret = await ethersProvider[strFnName]( address, param );
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
    while( ret === "" && idxAttempt <= cntAttempts ) {
        const isOnLine = rpcCall.checkUrl( u, nWaitStepMilliseconds );
        if( ! isOnLine ) {
            ret = retValOnFail;
            if( ! throwIfServerOffline )
                return ret;
            details.write(
                cc.error( "Cannot call " ) + cc.note( strFnName + "()" ) +
                cc.error( " via " ) + cc.u( u ) +
                cc.warning( " because server is off-line" ) + "\n" );
            throw new Error(
                "Cannot " + strFnName + "() via " + u.toString() +
                " because server is off-line" );
        }
        details.write(
            cc.warning( "Repeat call to " ) + cc.note( strFnName + "()" ) +
            cc.error( " via " ) + cc.u( u ) +
            cc.warning( ", attempt " ) + cc.info( idxAttempt ) +
            "\n" );
        try {
            ret = await ethersProvider[strFnName]( address, param );
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
    if( ( idxAttempt + 1 ) > cntAttempts && ret === "" ) {
        details.write( cc.fatal( "ERROR:" ) +
            cc.error( " Failed call to " ) + cc.note( strFnName + "()" ) +
            + cc.error( " via " ) + cc.u( u ) + cc.error( " after " ) +
            cc.info( cntAttempts ) + cc.error( " attempts " ) +
            "\n" );
        throw new Error(
            "Failed call to " + strFnName + "() via " + u.toString() +
            " after " + cntAttempts + " attempts" );
    }
    return ret;
}

export async function safeGetTransactionReceipt(
    details, cntAttempts, ethersProvider, txHash, retValOnFail, throwIfServerOffline
) {
    const strFnName = "getTransactionReceipt";
    const u = owaspUtils.ethersProviderToUrl( ethersProvider );
    const nWaitStepMilliseconds = 10 * 1000;
    if( throwIfServerOffline == null || throwIfServerOffline == undefined )
        throwIfServerOffline = true;
    cntAttempts =
        owaspUtils.parseIntOrHex( cntAttempts ) < 1
            ? 1
            : owaspUtils.parseIntOrHex( cntAttempts );
    if( retValOnFail == null || retValOnFail == undefined )
        retValOnFail = "";
    let ret = retValOnFail;
    let idxAttempt = 1;
    try {
        ret = await ethersProvider[strFnName]( txHash );
        return ret;
    } catch ( err ) {
        ret = retValOnFail;
        if( log.verboseGet() >= log.verboseReversed().error ) {
            details.write(
                cc.error( "Failed call attempt " ) + cc.info( idxAttempt ) +
                cc.error( " to " ) + cc.note( strFnName + "()" ) + cc.error( " via " ) + cc.u( u ) +
                cc.error( ", error is: " ) + cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
    }
    ++ idxAttempt;
    while( txReceipt === "" && idxAttempt <= cntAttempts ) {
        const isOnLine = rpcCall.checkUrl( u, nWaitStepMilliseconds );
        if( ! isOnLine ) {
            ret = retValOnFail;
            if( ! throwIfServerOffline )
                return ret;
            details.write(
                cc.error( "Cannot call " ) + cc.note( strFnName + "()" ) +
                cc.error( " via " ) + cc.u( u ) +
                cc.warning( " because server is off-line" ) + "\n" );
            throw new Error(
                "Cannot " + strFnName + "() via " + u.toString() +
                " because server is off-line" );
        }
        details.write(
            cc.warning( "Repeat call to " ) + cc.note( strFnName + "()" ) +
            cc.error( " via " ) + cc.u( u ) +
            cc.warning( ", attempt " ) + cc.info( idxAttempt ) +
            "\n" );
        try {
            ret = await ethersProvider[strFnName]( txHash );
            return ret;
        } catch ( err ) {
            ret = retValOnFail;
            if( log.verboseGet() >= log.verboseReversed().error ) {
                details.write(
                    cc.error( "Failed call attempt " ) + cc.info( idxAttempt ) +
                    cc.error( " to " ) + cc.note( strFnName + "()" ) + cc.error( " via " ) +
                    cc.u( u ) + cc.error( ", error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
        }
        ++ idxAttempt;
    }
    if( ( idxAttempt + 1 ) > cntAttempts && ( txReceipt === "" || txReceipt === undefined ) ) {
        details.write( cc.fatal( "ERROR:" ) +
            cc.error( " Failed call to " ) + cc.note( strFnName + "()" ) +
            + cc.error( " via " ) + cc.u( u ) + cc.error( " after " ) +
            cc.info( cntAttempts ) + cc.error( " attempts " ) +
            "\n" );
        throw new Error(
            "Failed call to " + strFnName + "() via " + u.toString() +
            " after " + cntAttempts + " attempts" );
    }
    return ret;
}

export async function safeGetPastEvents(
    details, strLogPrefix,
    ethersProvider, cntAttempts, joContract, strEventName,
    nBlockFrom, nBlockTo, joFilter, retValOnFail, throwIfServerOffline
) {
    const u = owaspUtils.ethersProviderToUrl( ethersProvider );
    const nWaitStepMilliseconds = 10 * 1000;
    if( throwIfServerOffline == null || throwIfServerOffline == undefined )
        throwIfServerOffline = true;
    cntAttempts =
        owaspUtils.parseIntOrHex( cntAttempts ) < 1
            ? 1
            : owaspUtils.parseIntOrHex( cntAttempts );
    if( retValOnFail == null || retValOnFail == undefined )
        retValOnFail = "";
    let ret = retValOnFail;
    let idxAttempt = 1;
    const strErrorTextAboutNotExistingEvent =
        "Event \"" + strEventName + "\" doesn't exist in this contract";
    if( nBlockTo == "latest" ) {
        const nLatestBlockNumber =
            owaspUtils.toBN( await safeGetBlockNumber( details, 10, ethersProvider ) );
        nBlockTo = nLatestBlockNumber;
    } else
        nBlockTo = owaspUtils.toBN( nBlockTo );
    nBlockFrom = owaspUtils.toBN( nBlockFrom );
    try {
        details.write( strLogPrefix +
            cc.debug( "First time, will query filter " ) + cc.j( joFilter ) +
            cc.debug( " on contract " ) + cc.info( joContract.address ) +
            cc.debug( " from block " ) + cc.info( nBlockFrom.toHexString() ) +
            cc.debug( " to block " ) + cc.info( nBlockTo.toHexString() ) +
            "\n" );
        ret =
            await joContract.queryFilter(
                joFilter,
                nBlockFrom.toHexString(),
                nBlockTo.toHexString()
            );
        return ret;
    } catch ( err ) {
        ret = retValOnFail;
        if( log.verboseGet() >= log.verboseReversed().error ) {
            details.write( strLogPrefix +
                cc.error( "Failed filtering attempt " ) + cc.info( idxAttempt ) +
                cc.error( " for event " ) + cc.note( strEventName ) + cc.error( " via " ) +
                cc.u( u ) + cc.error( ", from block " ) + cc.warning( nBlockFrom.toHexString() ) +
                cc.error( ", to block " ) + cc.warning( nBlockTo.toHexString() ) +
                cc.error( ", error is: " ) + cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
        if( owaspUtils.extractErrorMessage( err )
            .indexOf( strErrorTextAboutNotExistingEvent ) >= 0
        ) {
            details.write( strLogPrefix +
                cc.error( "Did stopped filtering of " ) + cc.note( strEventName ) +
                cc.error( " event because no such event exist in smart contract " ) +
                "\n" );
            return ret;
        }
    }
    ++ idxAttempt;
    while( ret === "" && idxAttempt <= cntAttempts ) {
        const isOnLine = rpcCall.checkUrl( u, nWaitStepMilliseconds );
        if( ! isOnLine ) {
            ret = retValOnFail;
            if( ! throwIfServerOffline )
                return ret;
            details.write( strLogPrefix +
                cc.error( "Cannot do " ) + cc.note( strEventName ) +
                cc.error( " event filtering via " ) + cc.u( u ) +
                cc.warning( " because server is off-line" ) + "\n" );
            throw new Error(
                "Cannot do " + strEventName + " event filtering, from block " +
                nBlockFrom.toHexString() + ", to block " + nBlockTo.toHexString() +
                " via " + u.toString() + " because server is off-line"
            );
        }
        details.write( strLogPrefix +
            cc.warning( "Repeat " ) + cc.note( strEventName ) +
            cc.error( " event filtering via " ) + cc.u( u ) +
            cc.warning( ", attempt " ) + cc.info( idxAttempt ) +
            "\n" );
        try {
            details.write( strLogPrefix +
                cc.debug( "Attempt " ) + cc.info( idxAttempt ) +
                cc.debug( ", will query filter " ) + cc.j( joFilter ) +
                cc.debug( " on contract " ) + cc.info( joContract.address ) +
                cc.debug( " from block " ) + cc.info( nBlockFrom.toHexString() ) +
                cc.debug( " to block " ) + cc.info( nBlockTo.toHexString() ) +
                "\n" );
            ret =
                await joContract.queryFilter(
                    joFilter,
                    nBlockFrom.toHexString(),
                    nBlockTo.toHexString()
                );
            return ret;

        } catch ( err ) {
            ret = retValOnFail;
            if( log.verboseGet() >= log.verboseReversed().error ) {
                details.write( strLogPrefix +
                    cc.error( "Failed filtering attempt " ) + cc.info( idxAttempt ) +
                    cc.error( " for event " ) + cc.note( strEventName ) + cc.error( " via " ) +
                    cc.u( u ) + cc.error( ", from block " ) + cc.info( nBlockFrom.toHexString() ) +
                    cc.error( ", to block " ) + cc.info( nBlockTo.toHexString() ) +
                    cc.error( ", error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
            if( owaspUtils.extractErrorMessage( err )
                .indexOf( strErrorTextAboutNotExistingEvent ) >= 0
            ) {
                details.write( strLogPrefix +
                    cc.error( "Did stopped " ) + cc.note( strEventName ) +
                    cc.error( " event filtering because no such event exist in smart contract " ) +
                    "\n" );
                return ret;
            }
        }
        ++ idxAttempt;
    }
    if( ( idxAttempt + 1 ) === cntAttempts && ret === "" ) {
        details.write( strLogPrefix + cc.fatal( "ERROR:" ) +
            cc.error( " Failed filtering attempt for " ) + cc.note( strEventName ) +
            + cc.error( " event via " ) + cc.u( u ) +
            cc.error( ", from block " ) + cc.info( nBlockFrom.toHexString() ) +
            cc.error( ", to block " ) + cc.info( nBlockTo.toHexString() ) +
            cc.error( " after " ) + cc.info( cntAttempts ) + cc.error( " attempts " ) +
            "\n" );
        throw new Error(
            "Failed filtering attempt for " + strEventName + " event, from block " +
            nBlockFrom.toHexString() + ", to block " + nBlockTo.toHexString() +
            " via " + u.toString() + " after " + cntAttempts + " attempts"
        );
    }
    return ret;
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

export async function safeGetPastEventsIterative(
    details, strLogPrefix,
    ethersProvider, attempts, joContract, strEventName,
    nBlockFrom, nBlockTo, joFilter
) {
    if( gCountOfBlocksInIterativeStep <= 0 || gMaxBlockScanIterationsInAllRange <= 0 ) {
        details.write( strLogPrefix +
            cc.fatal( "IMPORTANT NOTICE:" ) + " " +
            cc.warning( "Will skip " ) + cc.attention( "iterative" ) +
            cc.warning( " events scan in block range from " ) +
            cc.j( nBlockFrom ) + cc.warning( " to " ) + cc.j( nBlockTo ) +
            cc.warning( " because it's " ) + cc.error( "DISABLED" ) + "\n" );
        return await safeGetPastEvents(
            details, strLogPrefix,
            ethersProvider, attempts, joContract,
            strEventName, nBlockFrom, nBlockTo, joFilter
        );
    }
    const nLatestBlockNumber =
        owaspUtils.toBN( await safeGetBlockNumber( details, 10, ethersProvider ) );
    let isLastLatest = false;
    if( nBlockTo == "latest" ) {
        isLastLatest = true;
        nBlockTo = nLatestBlockNumber;
        details.write( strLogPrefix +
            cc.debug( "Iterative scan up to latest block " ) +
            cc.info( "#" ) + cc.info( nBlockTo.toHexString() ) +
            cc.debug( " assumed instead of " ) + cc.attention( "latest" ) + "\n" );
    } else {
        nBlockTo = owaspUtils.toBN( nBlockTo );
        if( nBlockTo.eq( nLatestBlockNumber ) )
            isLastLatest = true;
    }
    nBlockFrom = owaspUtils.toBN( nBlockFrom );
    const nBlockZero = owaspUtils.toBN( 0 );
    const isFirstZero = ( nBlockFrom.eq( nBlockZero ) ) ? true : false;
    if( isFirstZero && isLastLatest ) {
        if( nLatestBlockNumber.div(
            owaspUtils.toBN( gCountOfBlocksInIterativeStep )
        ).gt( owaspUtils.toBN( gMaxBlockScanIterationsInAllRange ) )
        ) {
            details.write( strLogPrefix +
                cc.fatal( "IMPORTANT NOTICE:" ) + " " +
                cc.warning( "Will skip " ) + cc.attention( "iterative" ) +
                cc.warning( " scan and use scan in block range from " ) +
                cc.info( nBlockFrom.toHexString() ) + cc.warning( " to " ) +
                cc.info( nBlockTo.toHexString() ) + "\n" );
            return await safeGetPastEvents(
                details, strLogPrefix,
                ethersProvider, attempts, joContract, strEventName,
                nBlockFrom, nBlockTo, joFilter
            );
        }
    }
    details.write( strLogPrefix +
        cc.debug( "Iterative scan in " ) +
        cc.info( nBlockFrom.toHexString() ) + cc.debug( "/" ) + cc.info( nBlockTo.toHexString() ) +
        cc.debug( " block range..." ) + "\n" );
    let idxBlockSubRangeFrom = nBlockFrom;
    for( ; true; ) {
        let idxBlockSubRangeTo =
            idxBlockSubRangeFrom.add( owaspUtils.toBN( gCountOfBlocksInIterativeStep ) );
        if( idxBlockSubRangeTo.gt( nBlockTo ) )
            idxBlockSubRangeTo = nBlockTo;
        try {
            details.write( strLogPrefix +
                cc.debug( "Iterative scan of " ) +
                cc.info( idxBlockSubRangeFrom.toHexString() ) + cc.debug( "/" ) +
                cc.info( idxBlockSubRangeTo.toHexString() ) +
                cc.debug( " block sub-range in " ) +
                cc.info( nBlockFrom.toHexString() ) + cc.debug( "/" ) +
                cc.info( nBlockTo.toHexString() ) +
                cc.debug( " block range..." ) + "\n" );
            const joAllEventsInBlock = await safeGetPastEvents(
                details, strLogPrefix,
                ethersProvider, attempts, joContract, strEventName,
                idxBlockSubRangeFrom, idxBlockSubRangeTo, joFilter
            );
            if( joAllEventsInBlock && joAllEventsInBlock != "" && joAllEventsInBlock.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Result of " ) + cc.attention( "iterative" ) +
                    cc.success( " scan in " ) +
                    cc.info( nBlockFrom.toHexString() ) + cc.success( "/" ) +
                    cc.info( nBlockTo.toHexString() ) +
                    cc.success( " block range is " ) + cc.j( joAllEventsInBlock ) + "\n" );
                return joAllEventsInBlock;
            }
        } catch ( err ) {
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                details.write( strLogPrefix +
                    cc.error( "Got scan error during interactive scan of " ) +
                    cc.info( idxBlockSubRangeFrom.toHexString() ) + cc.error( "/" ) +
                    cc.info( idxBlockSubRangeTo.toHexString() ) +
                    cc.error( " block sub-range in " ) + cc.info( nBlockFrom.toHexString() ) +
                    cc.error( "/" ) + cc.info( nBlockTo.toHexString() ) +
                    cc.error( " block range, error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
        }
        idxBlockSubRangeFrom = idxBlockSubRangeTo;
        if( idxBlockSubRangeFrom.eq( nBlockTo ) )
            break;
    }
    details.write( strLogPrefix +
        cc.debug( "Result of " ) + cc.attention( "iterative" ) + cc.debug( " scan in " ) +
        cc.info( nBlockFrom.toHexString() ) + cc.debug( "/" ) + cc.info( nBlockTo.toHexString() ) +
        cc.debug( " block range is " ) + cc.warning( "empty" ) + "\n" );
    return "";
}

export function verifyTransferErrorCategoryName( strCategory ) {
    return "" + ( strCategory ? strCategory : "default" );
}

const gMaxLastTransferErrors = 20;
const gArrLastTransferErrors = [];
let gMapTransferErrorCategories = { };

export const saveTransferEvents = new EventDispatcher();

export function saveTransferError( strCategory, textLog, ts ) {
    ts = ts || Math.round( ( new Date() ).getTime() / 1000 );
    const c = verifyTransferErrorCategoryName( strCategory );
    const joTransferEventError = {
        "ts": ts,
        "category": "" + c,
        "textLog": "" + textLog.toString()
    };
    gArrLastTransferErrors.push( joTransferEventError );
    while( gArrLastTransferErrors.length > gMaxLastTransferErrors )
        gArrLastTransferErrors.shift();
    gMapTransferErrorCategories["" + c] = true;
    saveTransferEvents.dispatchEvent(
        new UniversalDispatcherEvent(
            "error",
            { "detail": joTransferEventError } ) );
}

export function saveTransferSuccess( strCategory ) {
    const c = verifyTransferErrorCategoryName( strCategory );
    try { delete gMapTransferErrorCategories["" + c]; } catch ( err ) { }
    saveTransferEvents.dispatchEvent(
        new UniversalDispatcherEvent(
            "success",
            { "detail": { "category": strCategory } } ) );
}

export function saveTransferSuccessAll() {
    // clear all transfer error categories, out of time frame
    gMapTransferErrorCategories = { };
}

export function getLastTransferErrors( isIncludeTextLog ) {
    if( typeof isIncludeTextLog == "undefined" )
        isIncludeTextLog = true;
    const jarr = JSON.parse( JSON.stringify( gArrLastTransferErrors ) );
    if( ! isIncludeTextLog ) {
        for( let i = 0; i < jarr.length; ++ i ) {
            const jo = jarr[i];
            if( "textLog" in jo )
                delete jo.textLog;
        }
    }
    return jarr;
}

export function getLastErrorCategories() {
    return Object.keys( gMapTransferErrorCategories );
}

let gFlagIsEnabledProgressiveEventsScan = true;

export function getEnabledProgressiveEventsScan() {
    return gFlagIsEnabledProgressiveEventsScan ? true : false;
}
export function setEnabledProgressiveEventsScan( isEnabled ) {
    gFlagIsEnabledProgressiveEventsScan = isEnabled ? true : false;
}

let gFlagIsEnabledOracle = false;

export function getEnabledOracle( isEnabled ) {
    return gFlagIsEnabledOracle ? true : false;
}

export function setEnabledOracle( isEnabled ) {
    gFlagIsEnabledOracle = isEnabled ? true : false;
}

async function prepareOracleGasPriceSetup( optsGasPriseSetup ) {
    optsGasPriseSetup.strActionName =
        "prepareOracleGasPriceSetup.optsGasPriseSetup.latestBlockNumber()";
    optsGasPriseSetup.latestBlockNumber =
        await optsGasPriseSetup.ethersProviderMainNet.getBlockNumber();
    optsGasPriseSetup.details.write(
        cc.debug( "Latest block on Main Net is " ) +
            cc.info( optsGasPriseSetup.latestBlockNumber ) + "\n" );
    optsGasPriseSetup.strActionName =
        "prepareOracleGasPriceSetup.optsGasPriseSetup.bnTimestampOfBlock()";
    optsGasPriseSetup.latestBlock =
        await optsGasPriseSetup.ethersProviderMainNet
            .getBlock( optsGasPriseSetup.latestBlockNumber );
    optsGasPriseSetup.bnTimestampOfBlock =
        owaspUtils.toBN( optsGasPriseSetup.latestBlock.timestamp );
    optsGasPriseSetup.details.write( cc.debug( "Local timestamp on Main Net is " ) +
        cc.info( optsGasPriseSetup.bnTimestampOfBlock.toString() ) + cc.debug( "=" ) +
        cc.info( owaspUtils.ensureStartsWith0x(
            optsGasPriseSetup.bnTimestampOfBlock.toHexString() ) ) +
        cc.debug( " (original)" ) + "\n" );
    optsGasPriseSetup.bnTimeZoneOffset = owaspUtils.toBN( parseInt( new Date( parseInt(
        optsGasPriseSetup.bnTimestampOfBlock.toString(), 10 ) ).getTimezoneOffset(), 10 ) );
    optsGasPriseSetup.details.write( cc.debug( "Local time zone offset is " ) +
        cc.info( optsGasPriseSetup.bnTimeZoneOffset.toString() ) + cc.debug( "=" ) +
        cc.info( owaspUtils.ensureStartsWith0x(
            optsGasPriseSetup.bnTimeZoneOffset.toHexString() ) ) +
        cc.debug( " (original)" ) + "\n" );
    optsGasPriseSetup.bnTimestampOfBlock =
        optsGasPriseSetup.bnTimestampOfBlock.add( optsGasPriseSetup.bnTimeZoneOffset );
    optsGasPriseSetup.details.write( cc.debug( "UTC timestamp on Main Net is " ) +
        cc.info( optsGasPriseSetup.bnTimestampOfBlock.toString() ) + cc.debug( "=" ) +
        cc.info( owaspUtils.ensureStartsWith0x(
            optsGasPriseSetup.bnTimestampOfBlock.toHexString() ) ) +
        cc.debug( " (original)" ) + "\n" );
    const bnValueToSubtractFromTimestamp = owaspUtils.toBN( 60 );
    optsGasPriseSetup.details.write( cc.debug( "Value to subtract from timestamp is " ) +
        cc.info( bnValueToSubtractFromTimestamp ) + cc.debug( "=" ) +
        cc.info( owaspUtils.ensureStartsWith0x(
            bnValueToSubtractFromTimestamp.toHexString() ) ) +
        cc.debug( " (to adjust it to past a bit)" ) + "\n" );
    optsGasPriseSetup.bnTimestampOfBlock =
        optsGasPriseSetup.bnTimestampOfBlock.sub( bnValueToSubtractFromTimestamp );
    optsGasPriseSetup.details.write( cc.debug( "Timestamp on Main Net is " ) +
        cc.info( optsGasPriseSetup.bnTimestampOfBlock.toHexString() ) + cc.debug( "=" ) +
        cc.info( owaspUtils.ensureStartsWith0x(
            optsGasPriseSetup.bnTimestampOfBlock.toHexString() ) ) +
        cc.debug( " (adjusted to past a bit)" ) + "\n" );
    optsGasPriseSetup.strActionName = "prepareOracleGasPriceSetup.getGasPrice()";
    optsGasPriseSetup.gasPriceOnMainNet = null;
    if( IMA.getEnabledOracle() ) {
        const oracleOpts = {
            url: owaspUtils.ethersProviderToUrl( optsGasPriseSetup.ethersProviderSChain ),
            callOpts: { },
            nMillisecondsSleepBefore: 1000,
            nMillisecondsSleepPeriod: 3000,
            cntAttempts: 40,
            isVerbose: ( log.verboseGet() >= log.verboseReversed().information ) ? true : false,
            isVerboseTraceDetails:
                ( log.verboseGet() >= log.verboseReversed().debug ) ? true : false
        };
        optsGasPriseSetup.details.write( cc.debug( "Will fetch " ) +
            cc.info( "Main Net gas price" ) + cc.debug( " via call to " ) +
            cc.info( "Oracle" ) + cc.debug( " with options " ) +
            cc.j( oracleOpts ) + cc.debug( "..." ) + "\n" );
        try {
            optsGasPriseSetup.gasPriceOnMainNet = owaspUtils.ensureStartsWith0x(
                ( await imaOracle.oracleGetGasPrice(
                    oracleOpts, optsGasPriseSetup.details ) ).toString( 16 ) );
        } catch ( err ) {
            optsGasPriseSetup.gasPriceOnMainNet = null;
            if( log.verboseGet() >= log.verboseReversed().error ) {
                optsGasPriseSetup.details.write( cc.error( "Failed to fetch " ) +
                    cc.info( "Main Net gas price" ) + cc.error( " via call to " ) +
                    cc.info( "Oracle" ) + cc.error( ", error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
        }
    }
    if( optsGasPriseSetup.gasPriceOnMainNet === null ) {
        optsGasPriseSetup.details.write( cc.debug( "Will fetch " ) +
            cc.info( "Main Net gas price" ) + cc.debug( " directly..." ) + "\n" );
        optsGasPriseSetup.gasPriceOnMainNet = owaspUtils.ensureStartsWith0x(
            owaspUtils.toBN(
                await optsGasPriseSetup.ethersProviderMainNet.getGasPrice() ).toHexString() );
    }
    optsGasPriseSetup.details.write( cc.success( "Done, " ) + cc.info( "Oracle" ) +
        cc.success( " did computed new " ) + cc.info( "Main Net gas price" ) +
        cc.success( "=" ) +
        cc.bright( owaspUtils.toBN( optsGasPriseSetup.gasPriceOnMainNet ).toString() ) +
        cc.success( "=" ) + cc.bright( optsGasPriseSetup.gasPriceOnMainNet ) + "\n" );
    const joGasPriceOnMainNetOld =
        await optsGasPriseSetup.joCommunityLocker.callStatic.mainnetGasPrice(
            { from: optsGasPriseSetup.joAccountSC.address() } );
    const bnGasPriceOnMainNetOld = owaspUtils.toBN( joGasPriceOnMainNetOld );
    optsGasPriseSetup.details.write( cc.debug( "Previous " ) + cc.info( "Main Net gas price" ) +
        cc.debug( " saved and kept in " ) + cc.info( "CommunityLocker" ) + cc.debug( "=" ) +
        cc.bright( bnGasPriceOnMainNetOld.toString() ) + cc.debug( "=" ) +
        cc.bright( bnGasPriceOnMainNetOld.toHexString() ) + "\n" );
    if( bnGasPriceOnMainNetOld.eq( owaspUtils.toBN( optsGasPriseSetup.gasPriceOnMainNet ) ) ) {
        optsGasPriseSetup.details.write( cc.debug( "Previous " ) +
            cc.info( "Main Net gas price" ) +
            cc.debug( " is equal to new one, will skip setting it in " ) +
            cc.info( "CommunityLocker" ) + "\n" );
        if( log.exposeDetailsGet() )
            optsGasPriseSetup.details.exposeDetailsTo( log, "doOracleGasPriceSetup", true );
        optsGasPriseSetup.details.close();
        return;
    }
}

export async function doOracleGasPriceSetup(
    ethersProviderMainNet,
    ethersProviderSChain,
    transactionCustomizerSChain,
    joCommunityLocker,
    joAccountSC,
    chainIdMainNet,
    chainIdSChain,
    fnSignMsgOracle
) {
    if( ! getEnabledOracle() )
        return;
    const optsGasPriseSetup = {
        ethersProviderMainNet: ethersProviderMainNet,
        ethersProviderSChain: ethersProviderSChain,
        transactionCustomizerSChain: transactionCustomizerSChain,
        joCommunityLocker: joCommunityLocker,
        joAccountSC: joAccountSC,
        chainIdMainNet: chainIdMainNet,
        chainIdSChain: chainIdSChain,
        fnSignMsgOracle: fnSignMsgOracle,
        details: log.createMemoryStream(),
        jarrReceipts: [],
        strLogPrefix: cc.info( "Oracle gas price setup:" ) + " ",
        strActionName: "",
        latestBlockNumber: null,
        latestBlock: null,
        bnTimestampOfBlock: null,
        bnTimeZoneOffset: null,
        gasPriceOnMainNet: null
    };

    if( optsGasPriseSetup.fnSignMsgOracle == null ||
        optsGasPriseSetup.fnSignMsgOracle == undefined ) {
        optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
            cc.debug( "Using internal u256 signing stub function" ) + "\n" );
        optsGasPriseSetup.fnSignMsgOracle = async function( u256, details, fnAfter ) {
            details.write( optsGasPriseSetup.strLogPrefix +
                cc.debug( "u256 signing callback was " ) + cc.error( "not provided" ) + "\n" );
            await fnAfter( null, u256, null ); // null - no error, null - no signatures
        };
    } else {
        optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
            cc.debug( "Using externally provided u256 signing function" ) + "\n" );
    }
    try {
        await prepareOracleGasPriceSetup( optsGasPriseSetup );
        optsGasPriseSetup.strActionName =
            "doOracleGasPriceSetup.optsGasPriseSetup.fnSignMsgOracle()";
        await optsGasPriseSetup.fnSignMsgOracle(
            optsGasPriseSetup.gasPriceOnMainNet, optsGasPriseSetup.details,
            async function( strError, u256, joGlueResult ) {
                if( strError ) {
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        if( log.id != optsGasPriseSetup.details.id ) {
                            log.write( optsGasPriseSetup.strLogPrefix +
                                cc.fatal( "CRITICAL ERROR:" ) +
                                cc.error( " Error in doOracleGasPriceSetup() during " +
                                optsGasPriseSetup.strActionName + ": " ) +
                                cc.error( strError ) + "\n" );
                        }
                    }
                    optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                        cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " Error in doOracleGasPriceSetup() during " +
                        optsGasPriseSetup.strActionName + ": " ) + cc.error( strError ) + "\n" );
                    optsGasPriseSetup.details.exposeDetailsTo(
                        log, "doOracleGasPriceSetup", false );
                    saveTransferError( "oracle", optsGasPriseSetup.details.toString() );
                    optsGasPriseSetup.details.close();
                    return;
                }
                optsGasPriseSetup.strActionName = "doOracleGasPriceSetup.formatSignature";
                let signature = joGlueResult ? joGlueResult.signature : null;
                if( ! signature )
                    signature = { X: "0", Y: "0" };
                let hashPoint = joGlueResult ? joGlueResult.hashPoint : null;
                if( ! hashPoint )
                    hashPoint = { X: "0", Y: "0" };
                let hint = joGlueResult ? joGlueResult.hint : null;
                if( ! hint )
                    hint = "0";
                const sign = {
                    blsSignature: [ signature.X, signature.Y ], // BLS glue of signatures
                    hashA: hashPoint.X, // G1.X from joGlueResult.hashSrc
                    hashB: hashPoint.Y, // G1.Y from joGlueResult.hashSrc
                    counter: hint
                };
                optsGasPriseSetup.strActionName =
                    "Oracle gas price setup via CommunityLocker.setGasPrice()";
                const arrArgumentsSetGasPrice = [
                    u256,
                    owaspUtils.ensureStartsWith0x(
                        optsGasPriseSetup.bnTimestampOfBlock.toHexString() ),
                    sign // bls signature components
                ];
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    const joDebugArgs = [
                        [ signature.X, signature.Y ], // BLS glue of signatures
                        hashPoint.X, // G1.X from joGlueResult.hashSrc
                        hashPoint.Y, // G1.Y from joGlueResult.hashSrc
                        hint
                    ];
                    optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                        cc.debug( "....debug args for " ) + cc.debug( ": " ) +
                        cc.j( joDebugArgs ) + "\n" );
                }
                const weiHowMuch = undefined;
                const gasPrice =
                    await optsGasPriseSetup.transactionCustomizerSChain.computeGasPrice(
                        optsGasPriseSetup.ethersProviderSChain, 200000000000 );
                optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                    cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) +
                    cc.j( gasPrice ) + "\n" );
                const estimatedGasSetGasPrice =
                    await optsGasPriseSetup.transactionCustomizerSChain.computeGas(
                        optsGasPriseSetup.details, optsGasPriseSetup.ethersProviderSChain,
                        "CommunityLocker", optsGasPriseSetup.joCommunityLocker,
                        "setGasPrice", arrArgumentsSetGasPrice, optsGasPriseSetup.joAccountSC,
                        optsGasPriseSetup.strActionName, gasPrice, 10000000, weiHowMuch, null );
                optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                    cc.debug( "Using estimated " ) + cc.info( "gas" ) +
                    cc.debug( "=" ) + cc.notice( estimatedGasSetGasPrice ) + "\n" );
                const isIgnoreSetGasPrice = false;
                const strErrorOfDryRun = await dryRunCall( optsGasPriseSetup.details,
                    optsGasPriseSetup.ethersProviderSChain,
                    "CommunityLocker", optsGasPriseSetup.joCommunityLocker,
                    "setGasPrice", arrArgumentsSetGasPrice,
                    optsGasPriseSetup.joAccountSC, optsGasPriseSetup.strActionName,
                    isIgnoreSetGasPrice, gasPrice,
                    estimatedGasSetGasPrice, weiHowMuch, null );
                if( strErrorOfDryRun )
                    throw new Error( strErrorOfDryRun );
                const opts = {
                    isCheckTransactionToSchain:
                        ( optsGasPriseSetup.chainIdSChain !== "Mainnet" ) ? true : false
                };
                const joReceipt = await payedCall( optsGasPriseSetup.details,
                    optsGasPriseSetup.ethersProviderSChain,
                    "CommunityLocker", optsGasPriseSetup.joCommunityLocker,
                    "setGasPrice", arrArgumentsSetGasPrice,
                    optsGasPriseSetup.joAccountSC, optsGasPriseSetup.strActionName,
                    gasPrice, estimatedGasSetGasPrice, weiHowMuch,
                    opts );
                if( joReceipt && typeof joReceipt == "object" ) {
                    optsGasPriseSetup.jarrReceipts.push( {
                        "description": "doOracleGasPriceSetup/setGasPrice",
                        "receipt": joReceipt
                    } );
                    printGasUsageReportFromArray( "(intermediate result) ORACLE GAS PRICE SETUP ",
                        optsGasPriseSetup.jarrReceipts, optsGasPriseSetup.details );
                }
                saveTransferSuccess( "oracle" );
            } );
    } catch ( err ) {
        const strError = owaspUtils.extractErrorMessage( err );
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            if( log.id != optsGasPriseSetup.details.id ) {
                log.write( optsGasPriseSetup.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in doOracleGasPriceSetup() during " +
                    optsGasPriseSetup.strActionName + ": " ) + cc.error( strError ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
            optsGasPriseSetup.details.write( optsGasPriseSetup.strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in doOracleGasPriceSetup() during " +
                optsGasPriseSetup.strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
        optsGasPriseSetup.details.exposeDetailsTo( log, "doOracleGasPriceSetup", false );
        saveTransferError( "oracle", optsGasPriseSetup.details.toString() );
        optsGasPriseSetup.details.close();
        return false;
    }
    printGasUsageReportFromArray( "ORACLE GAS PRICE SETUP ",
        optsGasPriseSetup.jarrReceipts, optsGasPriseSetup.details );
    if( log.exposeDetailsGet() )
        optsGasPriseSetup.details.exposeDetailsTo( log, "doOracleGasPriceSetup", true );
    optsGasPriseSetup.details.close();
    return true;
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
    return gFlagIsForwardS2S ? true : false;
}

export function isReverseS2S() {
    return gFlagIsForwardS2S ? false : true;
}

export function setForwardS2S( b ) {
    if( b == null || b == undefined )
        b = true;
    gFlagIsForwardS2S = b ? true : false;
}

export function setReverseS2S( b ) {
    if( b == null || b == undefined )
        b = true;
    gFlagIsForwardS2S = b ? false : true;
}

export function createProgressiveEventsScanPlan( details, nLatestBlockNumber ) {
    // assume Main Net mines 6 blocks per minute
    const blocksInOneMinute = 6;
    const blocksInOneHour = blocksInOneMinute * 60;
    const blocksInOneDay = blocksInOneHour * 24;
    const blocksInOneWeek = blocksInOneDay * 7;
    const blocksInOneMonth = blocksInOneDay * 31;
    const blocksInOneYear = blocksInOneDay * 366;
    const blocksInThreeYears = blocksInOneYear * 3;
    const arrProgressiveEventsScanPlanA = [
        {
            "nBlockFrom":
            nLatestBlockNumber - blocksInOneDay,
            "nBlockTo": "latest",
            "type": "1 day"
        },
        {
            "nBlockFrom":
            nLatestBlockNumber - blocksInOneWeek,
            "nBlockTo": "latest",
            "type": "1 week"
        },
        {
            "nBlockFrom":
            nLatestBlockNumber - blocksInOneMonth,
            "nBlockTo": "latest",
            "type": "1 month"
        },
        {
            "nBlockFrom":
            nLatestBlockNumber - blocksInOneYear,
            "nBlockTo": "latest",
            "type": "1 year"
        },
        {
            "nBlockFrom":
            nLatestBlockNumber - blocksInThreeYears,
            "nBlockTo": "latest",
            "type": "3 years"
        }
    ];
    const arrProgressiveEventsScanPlan = [];
    for( let idxPlan = 0; idxPlan < arrProgressiveEventsScanPlanA.length; ++idxPlan ) {
        const joPlan = arrProgressiveEventsScanPlanA[idxPlan];
        if( joPlan.nBlockFrom >= 0 )
            arrProgressiveEventsScanPlan.push( joPlan );
    }
    if( arrProgressiveEventsScanPlan.length > 0 ) {
        const joLastPlan =
        arrProgressiveEventsScanPlan[arrProgressiveEventsScanPlan.length - 1];
        if( ! ( joLastPlan.nBlockFrom == 0 && joLastPlan.nBlockTo == "latest" ) ) {
            arrProgressiveEventsScanPlan.push(
                { "nBlockFrom": 0, "nBlockTo": "latest", "type": "entire block range" } );
        }
    } else {
        arrProgressiveEventsScanPlan.push(
            { "nBlockFrom": 0, "nBlockTo": "latest", "type": "entire block range" } );
    }
    return arrProgressiveEventsScanPlan;
}

export async function safeGetPastEventsProgressive(
    details, strLogPrefix,
    ethersProvider, attempts, joContract, strEventName,
    nBlockFrom, nBlockTo, joFilter
) {
    if( ! gFlagIsEnabledProgressiveEventsScan ) {
        details.write( strLogPrefix +
            cc.fatal( "IMPORTANT NOTICE:" ) + " " +
            cc.warning( "Will skip " ) + cc.attention( "progressive" ) +
            cc.warning( " events scan in block range from " ) +
            cc.j( nBlockFrom ) + cc.warning( " to " ) + cc.j( nBlockTo ) +
            cc.warning( " because it's " ) + cc.error( "DISABLED" ) + "\n" );
        return await safeGetPastEvents(
            details, strLogPrefix,
            ethersProvider, attempts, joContract, strEventName,
            nBlockFrom, nBlockTo, joFilter
        );
    }
    const nLatestBlockNumber =
        owaspUtils.toBN( await safeGetBlockNumber( details, 10, ethersProvider ) );
    let isLastLatest = false;
    if( nBlockTo == "latest" ) {
        isLastLatest = true;
        nBlockTo = nLatestBlockNumber;
        details.write( strLogPrefix +
            cc.debug( "Iterative scan up to latest block " ) +
            cc.attention( "#" ) + cc.info( nBlockTo.toHexString() ) +
            cc.debug( " assumed instead of " ) + cc.attention( "latest" ) + "\n" );
    } else {
        nBlockTo = owaspUtils.toBN( nBlockTo );
        if( nBlockTo.eq( nLatestBlockNumber ) )
            isLastLatest = true;
    }
    nBlockFrom = owaspUtils.toBN( nBlockFrom );
    const nBlockZero = owaspUtils.toBN( 0 );
    const isFirstZero = ( nBlockFrom.eq( nBlockZero ) ) ? true : false;
    if( ! ( isFirstZero && isLastLatest ) ) {
        details.write( strLogPrefix +
            cc.debug( "Will skip " ) + cc.attention( "progressive" ) +
            cc.debug( " scan and use scan in block range from " ) +
            cc.info( nBlockFrom.toHexString() ) + cc.debug( " to " ) +
            cc.info( nBlockTo.toHexString() ) + "\n" );
        return await safeGetPastEvents(
            details, strLogPrefix,
            ethersProvider, attempts, joContract, strEventName,
            nBlockFrom, nBlockTo, joFilter
        );
    }
    details.write( strLogPrefix +
        cc.debug( "Will run " ) +
        cc.attention( "progressive" ) + cc.debug( " scan..." ) +
        "\n" );
    details.write( strLogPrefix +
        cc.debug( "Current latest block number is " ) +
        cc.info( nLatestBlockNumber.toHexString() ) +
        "\n" );
    const arrProgressiveEventsScanPlan =
    createProgressiveEventsScanPlan( details, nLatestBlockNumber );
    details.write(
        cc.debug( "Composed " ) + cc.attention( "progressive" ) +
        cc.debug( " scan plan is: " ) + cc.j( arrProgressiveEventsScanPlan ) +
        "\n" );
    let joLastPlan = { "nBlockFrom": 0, "nBlockTo": "latest", "type": "entire block range" };
    for( let idxPlan = 0; idxPlan < arrProgressiveEventsScanPlan.length; ++idxPlan ) {
        const joPlan = arrProgressiveEventsScanPlan[idxPlan];
        if( joPlan.nBlockFrom < 0 )
            continue;
        joLastPlan = joPlan;
        details.write( strLogPrefix +
            cc.debug( "Progressive scan of " ) + cc.attention( "getPastEvents" ) +
            cc.debug( "/" ) + cc.info( strEventName ) +
            cc.debug( ", from block " ) + cc.info( joPlan.nBlockFrom ) +
            cc.debug( ", to block " ) + cc.info( joPlan.nBlockTo ) +
            cc.debug( ", block range is " ) + cc.info( joPlan.type ) +
            cc.debug( "..." ) + "\n" );
        try {
            const joAllEventsInBlock =
                await safeGetPastEventsIterative(
                    details, strLogPrefix,
                    ethersProvider, attempts, joContract, strEventName,
                    joPlan.nBlockFrom, joPlan.nBlockTo, joFilter
                );
            if( joAllEventsInBlock && joAllEventsInBlock.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Progressive scan of " ) + cc.attention( "getPastEvents" ) +
                    cc.debug( "/" ) + cc.info( strEventName ) +
                    cc.success( ", from block " ) + cc.info( joPlan.nBlockFrom ) +
                    cc.success( ", to block " ) + cc.info( joPlan.nBlockTo ) +
                    cc.success( ", block range is " ) + cc.info( joPlan.type ) +
                    cc.success( ", found " ) + cc.info( joAllEventsInBlock.length ) +
                    cc.success( " event(s)" ) + "\n" );
                return joAllEventsInBlock;
            }
        } catch ( err ) {}
    }
    details.write( strLogPrefix +
        cc.error( "Could not not get Event \"" ) + cc.info( strEventName ) +
        cc.error( "\", from block " ) + cc.info( joLastPlan.nBlockFrom ) +
        cc.error( ", to block " ) + cc.info( joLastPlan.nBlockTo ) +
        cc.debug( ", block range is " ) + cc.info( joLastPlan.type ) +
        cc.error( ", using " ) + cc.attention( "progressive" ) + cc.error( " event scan" ) +
        "\n" );
    return [];
}

export async function getContractCallEvents(
    details, strLogPrefix,
    ethersProvider, joContract, strEventName,
    nBlockNumber, strTxHash, joFilter
) {
    joFilter = joFilter || {};
    nBlockNumber = owaspUtils.toBN( nBlockNumber );
    const n10 = owaspUtils.toBN( 10 );
    let nBlockFrom = nBlockNumber.sub( n10 ), nBlockTo = nBlockNumber.add( n10 );
    const nBlockZero = owaspUtils.toBN( 0 );
    const nLatestBlockNumber =
        owaspUtils.toBN( await safeGetBlockNumber( details, 10, ethersProvider ) );
    if( nBlockFrom.lt( nBlockZero ) )
        nBlockFrom = nBlockZero;
    if( nBlockTo.gt( nLatestBlockNumber ) )
        nBlockTo = nLatestBlockNumber;
    const joAllEventsInBlock =
        await safeGetPastEventsIterative(
            details, strLogPrefix,
            ethersProvider, 10, joContract, strEventName,
            nBlockFrom, nBlockTo, joFilter
        );
    const joAllTransactionEvents = []; let i;
    for( i = 0; i < joAllEventsInBlock.length; ++i ) {
        const joEvent = joAllEventsInBlock[i];
        if( "transactionHash" in joEvent && joEvent.transactionHash == strTxHash )
            joAllTransactionEvents.push( joEvent );
    }
    return joAllTransactionEvents;
}

let gFlagDryRunIsEnabled = true;

export function dryRunIsEnabled() {
    return gFlagDryRunIsEnabled ? true : false;
}

export function dryRunEnable( isEnable ) {
    gFlagDryRunIsEnabled = ( isEnable != null && isEnable != undefined )
        ? ( isEnable ? true : false ) : true;
    return gFlagDryRunIsEnabled ? true : false;
}

let gFlagDryRunIsIgnored = true;

export function dryRunIsIgnored() {
    return gFlagDryRunIsIgnored ? true : false;
}

export function dryRunIgnore( isIgnored ) {
    gFlagDryRunIsIgnored = ( isIgnored != null && isIgnored != undefined )
        ? ( isIgnored ? true : false ) : true;
    return gFlagDryRunIsIgnored ? true : false;
}

export async function dryRunCall(
    details,
    ethersProvider,
    strContractName, joContract, strMethodName, arrArguments,
    joAccount, strActionName, isDryRunResultIgnore,
    gasPrice, gasValue, weiHowMuch,
    opts
) {
    if( ! dryRunIsEnabled() )
        return null; // success
    isDryRunResultIgnore = ( isDryRunResultIgnore != null && isDryRunResultIgnore != undefined )
        ? ( isDryRunResultIgnore ? true : false ) : false;
    const strContractMethodDescription =
        cc.notice( strContractName ) + cc.debug( "(" ) + cc.info( joContract.address ) +
        cc.debug( ")." ) + cc.notice( strMethodName );
    let strArgumentsDescription = "";
    if( arrArguments.length > 0 ) {
        strArgumentsDescription += cc.debug( "( " );
        for( let i = 0; i < arrArguments.length; ++ i ) {
            if( i > 0 )
                strArgumentsDescription += cc.debug( ", " );
            strArgumentsDescription += cc.j( arrArguments[i] );
        }
        strArgumentsDescription += cc.debug( " )" );
    } else
        strArgumentsDescription += cc.debug( "()" );
    const strContractCallDescription = strContractMethodDescription + strArgumentsDescription;
    const strLogPrefix = strContractMethodDescription + " ";
    try {
        details.write(
            cc.debug( "Dry-run of action " ) + cc.info( strActionName ) + cc.debug( "..." ) +
            "\n" );
        details.write(
            cc.debug( "Will dry-run " ) + strContractCallDescription + cc.debug( "..." ) +
            "\n" );
        const strAccountWalletAddress = joAccount.address();
        const callOpts = {
            from: strAccountWalletAddress
        };
        if( gasPrice )
            callOpts.gasPrice = owaspUtils.toBN( gasPrice ).toHexString();
        if( gasValue )
            callOpts.gasLimit = owaspUtils.toBN( gasValue ).toHexString();
        if( weiHowMuch )
            callOpts.value = owaspUtils.toBN( weiHowMuch ).toHexString();
        const joDryRunResult =
            await joContract.callStatic[strMethodName]( ...arrArguments, callOpts );
        details.write( strLogPrefix +
            cc.success( "dry-run success: " ) + cc.j( joDryRunResult ) +
            "\n" );
        return null; // success
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            const strError = owaspUtils.extractErrorMessage( err );
            details.write( strLogPrefix +
                cc.error( "dry-run error: " ) + cc.warning( strError ) + "\n" );
        }
        if( dryRunIsIgnored() )
            return null;
        return strError;
    }
}

async function payedCallPrepare( optsPayedCall ) {
    optsPayedCall.joACI = getAccountConnectivityInfo( optsPayedCall.joAccount );
    if( optsPayedCall.gasPrice ) {
        optsPayedCall.callOpts.gasPrice =
            owaspUtils.toBN( optsPayedCall.gasPrice ).toHexString();
    }
    if( optsPayedCall.estimatedGas ) {
        optsPayedCall.callOpts.gasLimit =
            owaspUtils.toBN( optsPayedCall.estimatedGas ).toHexString();
    }
    if( optsPayedCall.weiHowMuch ) {
        optsPayedCall.callOpts.value =
        owaspUtils.toBN( optsPayedCall.weiHowMuch ).toHexString();
    }
    optsPayedCall.details.write( optsPayedCall.strLogPrefix +
        cc.debug( "Payed-call of action " ) + cc.info( optsPayedCall.strActionName ) +
        cc.debug( " will do payed-call " ) + optsPayedCall.strContractCallDescription +
        cc.debug( " with call options " ) + cc.j( optsPayedCall.callOpts ) +
        cc.debug( " via " ) + cc.attention( optsPayedCall.joACI.strType ) +
        cc.debug( "-sign-and-send..." ) + "\n" );
    optsPayedCall.unsignedTx =
        await optsPayedCall.joContract.populateTransaction[optsPayedCall.strMethodName](
            ...optsPayedCall.arrArguments, optsPayedCall.callOpts );
    optsPayedCall.details.write( optsPayedCall.strLogPrefix +
        cc.debug( "populated transaction: " ) + cc.j( optsPayedCall.unsignedTx ) +
        "\n" );
    optsPayedCall.unsignedTx.nonce =
        await optsPayedCall.ethersProvider.getTransactionCount( optsPayedCall.joAccount.address() );
    if( optsPayedCall.opts && optsPayedCall.opts.isCheckTransactionToSchain ) {
        optsPayedCall.unsignedTx = await checkTransactionToSchain(
            optsPayedCall.unsignedTx, optsPayedCall.details,
            optsPayedCall.ethersProvider, optsPayedCall.joAccount );
    }
    optsPayedCall.rawTx =
        owaspUtils.ethersMod.ethers.utils.serializeTransaction( optsPayedCall.unsignedTx );
    optsPayedCall.details.write( optsPayedCall.strLogPrefix +
        cc.debug( "Raw transaction: " ) + cc.j( optsPayedCall.rawTx ) + "\n" );
    optsPayedCall.txHash = owaspUtils.ethersMod.ethers.utils.keccak256( optsPayedCall.rawTx );
    optsPayedCall.details.write( optsPayedCall.strLogPrefix +
        cc.debug( "Transaction hash: " ) + cc.j( optsPayedCall.txHash ) + "\n" );
}

async function payedCallTM( optsPayedCall ) {
    const promiseComplete = new Promise( function( resolve, reject ) {
        const doTM = async function() {
            const txAdjusted =
                optsPayedCall.unsignedTx; // JSON.parse( JSON.stringify( optsPayedCall.rawTx ) );
            const arrNamesConvertToHex = [ "gas", "gasLimit", "optsPayedCall.gasPrice", "value" ];
            for( let idxName = 0; idxName < arrNamesConvertToHex.length; ++ idxName ) {
                const strName = arrNamesConvertToHex[idxName];
                if( strName in txAdjusted &&
                    typeof txAdjusted[strName] == "object" &&
                    typeof txAdjusted[strName].toHexString == "function"
                )
                    txAdjusted[strName] = txAdjusted[strName].toHexString();
            }
            if( "gasLimit" in txAdjusted )
                delete txAdjusted.gasLimit;
            if( "chainId" in txAdjusted )
                delete txAdjusted.chainId;
            const { chainId } = await optsPayedCall.ethersProvider.getNetwork();
            txAdjusted.chainId = chainId;
            optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                cc.debug( "Adjusted transaction: " ) + cc.j( txAdjusted ) +
                "\n" );
            if( redis == null )
                redis = new Redis( optsPayedCall.joAccount.strTransactionManagerURL );
            const priority = optsPayedCall.joAccount.nTmPriority || 5;
            optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                cc.debug( "TM priority: " ) + cc.j( priority ) + "\n" );
            try {
                const [ idTransaction, joReceiptFromTM ] =
                    await tmEnsureTransaction(
                        optsPayedCall.details, optsPayedCall.ethersProvider, priority, txAdjusted );
                optsPayedCall.joReceipt = joReceiptFromTM;
                optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                    cc.debug( "ID of TM-transaction : " ) + cc.j( idTransaction ) +
                    "\n" );
                const txHashSent = "" + optsPayedCall.joReceipt.transactionHash;
                optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                    cc.debug( "Hash of sent TM-transaction: " ) + cc.j( txHashSent ) +
                    "\n" );
                resolve( optsPayedCall.joReceipt );
            } catch ( err ) {
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strError =
                        cc.fatal( "BAD ERROR:" ) + " " +
                        cc.error( "TM-transaction was not sent, underlying error is: " ) +
                        cc.warning( err.toString() );
                    optsPayedCall.details.write( optsPayedCall.strLogPrefix + strError + "\n" );
                    if( log.id != optsPayedCall.details.id )
                        log.write( optsPayedCall.strLogPrefix + strError + "\n" );
                }
                reject( err );
            }
        };
        doTM();
    } );
    await Promise.all( [ promiseComplete ] );
}

async function payedCallSGX( optsPayedCall ) {
    let rpcCallOpts = null;
    if( "strPathSslKey" in optsPayedCall.joAccount &&
    typeof optsPayedCall.joAccount.strPathSslKey == "string" &&
    optsPayedCall.joAccount.strPathSslKey.length > 0 &&
    "strPathSslCert" in optsPayedCall.joAccount &&
    typeof optsPayedCall.joAccount.strPathSslCert == "string" &&
    optsPayedCall.joAccount.strPathSslCert.length > 0
    ) {
        rpcCallOpts = {
            "cert": fs.readFileSync( optsPayedCall.joAccount.strPathSslCert, "utf8" ),
            "key": fs.readFileSync( optsPayedCall.joAccount.strPathSslKey, "utf8" )
        };
    }
    const promiseComplete = new Promise( function( resolve, reject ) {
        rpcCall.create( optsPayedCall.joAccount.strSgxURL, rpcCallOpts,
            async function( joCall, err ) {
                if( err ) {
                    const strError =
                    cc.fatal( "CRITICAL TRANSACTION SIGNING ERROR:" ) +
                    cc.error(
                        " JSON RPC call creation to SGX wallet failed with error " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                    "\n";
                    if( log.verboseGet() >= log.verboseReversed.error ) {
                        if( log.id != optsPayedCall.details.id )
                            log.write( optsPayedCall.strLogPrefix + strError );
                    }
                    optsPayedCall.details.write( optsPayedCall.strLogPrefix + strError );
                    reject(
                        new Error(
                            "CRITICAL TRANSACTION SIGNING ERROR: " +
                        owaspUtils.extractErrorMessage( err ) ) );
                }
                const joIn = {
                    "method": "ecdsaSignMessageHash",
                    "params": {
                        "keyName": "" + optsPayedCall.joAccount.strSgxKeyName,
                        "messageHash": owaspUtils.ensureStartsWith0x( optsPayedCall.txHash ),
                        "base": 16
                    }
                };
                optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                cc.debug( "Calling SGX to sign using ECDSA key with " ) +
                cc.info( joIn.method ) + cc.debug( "..." ) +
                "\n" );
                joCall.call( joIn, async function( joIn, joOut, err ) {
                    if( err ) {
                        const strError =
                        cc.fatal( "CRITICAL TRANSACTION SIGNING ERROR:" ) +
                        cc.error(
                            " JSON RPC call sending to SGX wallet failed with error " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                        "\n";
                        if( log.verboseGet() >= log.verboseReversed.error ) {
                            if( log.id != optsPayedCall.details.id )
                                log.write( optsPayedCall.strLogPrefix + strError );
                        }
                        optsPayedCall.details.write( optsPayedCall.strLogPrefix + strError );
                        reject(
                            new Error(
                                "CRITICAL TRANSACTION SIGNING ERROR: " +
                            owaspUtils.extractErrorMessage( err ) ) );
                    }
                    try {
                        optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                        cc.debug( "SGX wallet ECDSA sign result is: " ) + cc.j( joOut ) +
                        "\n" );
                        const v =
                        owaspUtils.parseIntOrHex(
                            owaspUtils.toBN( joOut.result.signature_v ).toString() );
                        const joExpanded = {
                            "v": v,
                            "r": joOut.result.signature_r,
                            "s": joOut.result.signature_s
                        };
                        optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                        cc.debug( "Preliminary expanded signature: " ) +
                        cc.j( joExpanded ) +
                        "\n" );

                        let { chainId } = await optsPayedCall.ethersProvider.getNetwork();
                        if( chainId == "string" )
                            chainId = owaspUtils.parseIntOrHex( chainId );
                        optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                        cc.debug( "Chain ID is: " ) + cc.info( chainId ) +
                        "\n" );
                        joExpanded.v += chainId * 2 + 8 + 27;

                        optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                        cc.debug( "Final expanded signature: " ) + cc.j( joExpanded ) +
                        "\n" );
                        const joSignature =
                        owaspUtils.ethersMod.ethers.utils.joinSignature( joExpanded );
                        optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                        cc.debug( "Final signature: " ) + cc.j( joSignature ) +
                        "\n" );
                        optsPayedCall.rawTx =
                        owaspUtils.ethersMod.ethers.utils.serializeTransaction(
                            optsPayedCall.unsignedTx, joSignature );
                        optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                        cc.debug( "Raw transaction with signature: " ) +
                        cc.j( optsPayedCall.rawTx ) + "\n" );

                        const { hash } = await optsPayedCall.ethersProvider.sendTransaction(
                            owaspUtils.ensureStartsWith0x( optsPayedCall.rawTx )
                        );
                        optsPayedCall.details.write( optsPayedCall.strLogPrefix +
                        cc.debug( "Raw-sent transaction hash: " ) + cc.j( hash ) +
                        "\n" );
                        optsPayedCall.joReceipt =
                        await optsPayedCall.ethersProvider.waitForTransaction( hash );
                        resolve( optsPayedCall.joReceipt );
                    } catch ( err ) {
                        const strErrorPrefix =
                            "CRITICAL TRANSACTION SIGN AND SEND ERROR(PROCESSING SGX RESULT):";
                        if( log.verboseGet() >= log.verboseReversed().critical ) {
                            const s =
                                optsPayedCall.strLogPrefix + cc.error( strErrorPrefix ) + " " +
                                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                                "\n";
                            optsPayedCall.details.write( s );
                            if( log.id != optsPayedCall.details.id )
                                log.write( s );
                        }
                        reject( new Error( strErrorPrefix +
                            " Invoking the " + optsPayedCall.strContractCallDescription +
                            ", error is: " + owaspUtils.extractErrorMessage( err ) ) );
                    }
                } );
            } );
    } );
    await Promise.all( [ promiseComplete ] );
}

async function payedCallDirect( optsPayedCall ) {
    const ethersWallet =
        new owaspUtils.ethersMod.ethers.Wallet(
            owaspUtils.ensureStartsWith0x(
                optsPayedCall.joAccount.privateKey ),
            optsPayedCall.ethersProvider );
    const joSent = await ethersWallet.sendTransaction( optsPayedCall.unsignedTx );
    optsPayedCall.details.write( optsPayedCall.strLogPrefix +
        cc.debug( "Sent transaction: " ) + cc.j( joSent ) +
        "\n" );
    optsPayedCall.joReceipt = await joSent.wait();
    optsPayedCall.details.write( optsPayedCall.strLogPrefix +
        cc.debug( "Transaction receipt:" ) + cc.j( optsPayedCall.joReceipt ) +
        "\n" );
}

export async function payedCall(
    details,
    ethersProvider,
    strContractName, joContract, strMethodName, arrArguments,
    joAccount, strActionName,
    gasPrice, estimatedGas, weiHowMuch,
    opts
) {
    const optsPayedCall = {
        details: details,
        ethersProvider: ethersProvider,
        strContractName: strContractName,
        joContract: joContract,
        strMethodName: strMethodName,
        arrArguments: arrArguments,
        joAccount: joAccount,
        strActionName: strActionName,
        gasPrice: gasPrice,
        estimatedGas: estimatedGas,
        weiHowMuch: weiHowMuch,
        opts: opts,
        strContractCallDescription: "",
        strLogPrefix: "",
        joACI: null,
        unsignedTx: null,
        rawTx: null,
        txHash: null,
        joReceipt: null,
        callOpts: { }
    };
    const strContractMethodDescription = cc.notice( optsPayedCall.strContractName ) +
        cc.debug( "(" ) + cc.info( optsPayedCall.joContract.address ) +
        cc.debug( ")." ) + cc.info( optsPayedCall.strMethodName );
    let strArgumentsDescription = "";
    if( optsPayedCall.arrArguments.length > 0 ) {
        strArgumentsDescription += cc.debug( "( " );
        for( let i = 0; i < optsPayedCall.arrArguments.length; ++ i ) {
            if( i > 0 )
                strArgumentsDescription += cc.debug( ", " );
            strArgumentsDescription += cc.j( optsPayedCall.arrArguments[i] );
        }
        strArgumentsDescription += cc.debug( " )" );
    } else
        strArgumentsDescription += cc.debug( "()" );
    optsPayedCall.strContractCallDescription =
        strContractMethodDescription + strArgumentsDescription;
    optsPayedCall.strLogPrefix = strContractMethodDescription + " ";
    try {
        await payedCallPrepare( optsPayedCall );
        switch ( optsPayedCall.joACI.strType ) {
        case "tm":
            await payedCallTM( optsPayedCall );
            break;
        case "sgx":
            await payedCallSGX( optsPayedCall );
            break;
        case "direct":
            await payedCallDirect( optsPayedCall );
            break;
        default: {
            const strErrorPrefix = "CRITICAL TRANSACTION SIGN AND SEND ERROR(INNER FLOW):";
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                const s = cc.fatal( strErrorPrefix ) + " " +
                    cc.error( "bad credentials information specified, " +
                        "no explicit SGX and no explicit private key found" ) + "\n";
                optsPayedCall.details.write( s );
                if( log.id != optsPayedCall.details.id )
                    log.write( s );
            }
            throw new Error( strErrorPrefix + " bad credentials information specified, " +
                "no explicit SGX and no explicit private key found" );
        } // NOTICE: "break;" is not needed here because of "throw" above
        } // switch( optsPayedCall.joACI.strType )
    } catch ( err ) {
        const strErrorPrefix = "CRITICAL TRANSACTION SIGN AND SEND ERROR(OUTER FLOW):";
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const s =
                optsPayedCall.strLogPrefix + cc.error( strErrorPrefix ) + " " +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n";
            optsPayedCall.details.write( s );
            if( log.id != optsPayedCall.details.id )
                log.write( s );
        }
        throw new Error( strErrorPrefix +
            " invoking the " + optsPayedCall.strContractCallDescription +
            ", error is: " + owaspUtils.extractErrorMessage( err ) );
    }
    optsPayedCall.details.write( optsPayedCall.strLogPrefix + cc.success( "Done, TX was " ) +
        cc.attention( optsPayedCall.joACI ? optsPayedCall.joACI.strType : "N/A" ) +
        cc.success( "-signed-and-sent, receipt is " ) + cc.j( optsPayedCall.joReceipt ) + "\n" );
    try {
        const bnGasSpent = owaspUtils.toBN( optsPayedCall.joReceipt.cumulativeGasUsed );
        const gasSpent = bnGasSpent.toString();
        const ethSpent =
            owaspUtils.ethersMod.ethers.utils.formatEther(
                optsPayedCall.joReceipt.cumulativeGasUsed.mul(
                    optsPayedCall.unsignedTx.gasPrice ) );
        optsPayedCall.joReceipt.summary = {
            bnGasSpent: bnGasSpent,
            gasSpent: gasSpent,
            ethSpent: ethSpent
        };
        optsPayedCall.details.write( optsPayedCall.strLogPrefix +
            cc.debug( "gas spent: " ) + cc.info( gasSpent ) + "\n" );
        optsPayedCall.details.write( optsPayedCall.strLogPrefix +
            cc.debug( "ETH spent: " ) + cc.info( ethSpent ) + "\n" );
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            optsPayedCall.details.write(
                optsPayedCall.strLogPrefix + cc.warning( "WARNING: " ) + " " +
                cc.warning( "TX stats computation error " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.warning( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
    }
    return optsPayedCall.joReceipt;
}

export async function checkTransactionToSchain(
    unsignedTx,
    details,
    ethersProvider,
    joAccount
) {
    const strLogPrefix = cc.attention( "PoW-mining:" ) + " ";
    try {
        const strFromAddress = joAccount.address(); // unsignedTx.from;
        const requiredBalance = unsignedTx.gasPrice.mul( unsignedTx.gasLimit );
        const balance = owaspUtils.toBN( await ethersProvider.getBalance( strFromAddress ) );
        details.write(
            strLogPrefix +
            cc.debug( "Will check whether PoW-mining is needed for sender " ) +
            cc.notice( strFromAddress ) +
            cc.debug( " with balance " ) + cc.info( balance.toHexString() ) +
            cc.debug( " using required balance " ) + cc.info( requiredBalance.toHexString() ) +
            cc.debug( ", gas limit is " ) + cc.info( unsignedTx.gasLimit.toHexString() ) +
            cc.debug( " gas, checked unsigned transaction is " ) + cc.j( unsignedTx ) +
            "\n" );
        if( balance.lt( requiredBalance ) ) {
            details.write(
                strLogPrefix +
                cc.warning( "Insufficient funds for " ) + cc.notice( strFromAddress ) +
                cc.warning( ", will run PoW-mining to get " ) +
                cc.info( unsignedTx.gasLimit.toHexString() ) + cc.warning( " of gas" ) +
                "\n" );
            let powNumber =
                await calculatePowNumber(
                    strFromAddress,
                    owaspUtils.toBN( unsignedTx.nonce ).toHexString(),
                    unsignedTx.gasLimit.toHexString(),
                    details,
                    strLogPrefix
                );
            details.write( strLogPrefix +
                cc.debug( "Returned PoW-mining number " ) + cc.sunny( powNumber ) +
                "\n" );
            powNumber = powNumber.toString().trim();
            powNumber = imaUtils.replaceAll( powNumber, "\r", "" );
            powNumber = imaUtils.replaceAll( powNumber, "\n", "" );
            powNumber = imaUtils.replaceAll( powNumber, "\t", "" );
            powNumber = powNumber.trim();
            details.write( strLogPrefix +
                cc.debug( "Trimmed PoW-mining number is " ) + cc.sunny( powNumber ) +
                "\n" );
            if( ! powNumber ) {
                throw new Error(
                    "Failed to compute gas price with PoW-mining (1), got empty text" );
            }
            powNumber = owaspUtils.toBN( owaspUtils.ensureStartsWith0x( powNumber ) );
            details.write( strLogPrefix +
                cc.debug( "BN PoW-mining number is " ) + cc.j( powNumber ) +
                "\n" );
            if( powNumber.eq( owaspUtils.toBN( "0" ) ) ) {
                throw new Error(
                    "Failed to compute gas price with PoW-mining (2), got zero value" );
            }
            unsignedTx.gasPrice = powNumber;
            details.write( strLogPrefix +
                cc.success(
                    "Success, finally (after PoW-mining) modified unsigned transaction is " ) +
                cc.j( unsignedTx ) +
                "\n" );
        } else {
            details.write(
                strLogPrefix +
                cc.success( "Have sufficient funds for " ) + cc.notice( strFromAddress ) +
                cc.success( ", PoW-mining is not needed and will be skipped" ) +
                "\n" );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            details.write( strLogPrefix +
                cc.fatal( "CRITICAL PoW-mining ERROR(checkTransactionToSchain):" ) + " " +
                cc.error( "exception occur before PoW-mining, error is:" ) + " " +
                cc.error( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
    }
    return unsignedTx;
}

export async function calculatePowNumber( address, nonce, gas, details, strLogPrefix ) {
    try {
        let _address = owaspUtils.ensureStartsWith0x( address );
        _address = ethereumJsUtilModule.toChecksumAddress( _address );
        _address = owaspUtils.removeStarting0x( _address );
        const _nonce = owaspUtils.parseIntOrHex( nonce );
        const _gas = owaspUtils.parseIntOrHex( gas );
        const powScriptPath = path.join( __dirname, "pow" );
        const cmd = `${powScriptPath} ${_address} ${_nonce} ${_gas}`;
        details.write( strLogPrefix +
            cc.debug( "Will run PoW-mining command: " ) + cc.notice( cmd ) +
            "\n" );
        const res = childProcessModule.execSync( cmd );
        details.write( strLogPrefix +
            cc.debug( "Got PoW-mining execution result: " ) + cc.notice( res ) + "\n" );
        return res;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            details.write( strLogPrefix +
                cc.fatal( "CRITICAL PoW-mining ERROR(calculatePowNumber):" ) + " " +
                cc.error( "exception occur during PoW-mining, error is:" ) + " " +
                cc.error( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n" );
        }
        throw err;
    }
}

export function getAccountConnectivityInfo( joAccount ) {
    const joACI = {
        "isBad": true,
        "strType": "bad",
        "isAutoSend": false
    };
    if( "strTransactionManagerURL" in joAccount &&
        typeof joAccount.strTransactionManagerURL == "string" &&
        joAccount.strTransactionManagerURL.length > 0
    ) {
        joACI.isBad = false;
        joACI.strType = "tm";
        joACI.isAutoSend = true;
    } else if( "strSgxURL" in joAccount &&
        typeof joAccount.strSgxURL == "string" &&
        joAccount.strSgxURL.length > 0 &&
        "strSgxKeyName" in joAccount &&
        typeof joAccount.strSgxKeyName == "string" &&
        joAccount.strSgxKeyName.length > 0
    ) {
        joACI.isBad = false;
        joACI.strType = "sgx";
    } else if( "privateKey" in joAccount &&
        typeof joAccount.privateKey == "string" &&
        joAccount.privateKey.length > 0
    ) {
        joACI.isBad = false;
        joACI.strType = "direct";
    } else {
        // bad by default
    }
    return joACI;
}

const gTransactionManagerPool = "transactions";

const tmGenerateRandomHex =
    size => [ ...Array( size ) ]
        .map( () => Math.floor( Math.random() * 16 ).toString( 16 ) ).join( "" );

function tmMakeId( details ) {
    const prefix = "tx-";
    const unique = tmGenerateRandomHex( 16 );
    const id = prefix + unique + "js";
    details.write( cc.debug( "TM - Generated id: " ) + cc.debug( id ) + "\n" );
    return id;
}

function tmMakeRecord( tx = {}, score ) {
    const status = "PROPOSED";
    return JSON.stringify( {
        "score": score,
        "status": status,
        ...tx
    } );
}

function tmMakeScore( priority ) {
    const ts = currentTimestamp();
    return priority * Math.pow( 10, ts.toString().length ) + ts;
}

async function tmSend( details, tx, priority = 5 ) {
    details.write( cc.debug( "TM - sending tx " ) + cc.j( tx ) +
        cc.debug( " ts: " ) + cc.info( currentTimestamp() ) + "\n" );
    const id = tmMakeId( details );
    const score = tmMakeScore( priority );
    const record = tmMakeRecord( tx, score );
    details.write(
        cc.debug( "TM - Sending score: " ) + cc.info( score ) +
        cc.debug( ", record: " ) + cc.info( record ) +
        "\n" );
    const expiration = 24 * 60 * 60; // 1 day;
    await redis.multi()
        .set( id, record, "EX", expiration )
        .zadd( gTransactionManagerPool, score, id )
        .exec();
    return id;
}

function tmIsFinished( record ) {
    if( record == null )
        return null;
    return [ "SUCCESS", "FAILED", "DROPPED" ].includes( record.status );
}

async function tmGetRecord( txId ) {
    const r = await redis.get( txId );
    if( r != null )
        return JSON.parse( r );
    return null;
}

async function tmWait( details, txId, ethersProvider, nWaitSeconds = 36000 ) {
    const strPrefixDetails = cc.debug( "(gathered details)" ) + " ";
    const strPrefixLog = cc.debug( "(immediate log)" ) + " ";
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        const strMsg =
            cc.debug( "TM - will wait TX " ) + cc.info( txId ) +
            cc.debug( " to complete for " ) + cc.info( nWaitSeconds ) +
            cc.debug( " second(s) maximum" );
        details.write( strPrefixDetails + strMsg + "\n" );
        if( log.id != details.id )
            log.write( strPrefixLog + strMsg + "\n" );
    }
    const startTs = currentTimestamp();
    while( ! tmIsFinished( await tmGetRecord( txId ) ) &&
                ( currentTimestamp() - startTs ) < nWaitSeconds )
        await sleep( 500 );
    const r = await tmGetRecord( txId );
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        strMsg = cc.debug( "TM - TX " ) + cc.info( txId ) + cc.debug( " record is " ) +
            cc.info( JSON.stringify( r ) );
        details.write( strPrefixDetails + strMsg + "\n" );
        if( log.id != details.id )
            log.write( strPrefixLog + strMsg + "\n" );
    }
    if( ( !r ) ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            strMsg = cc.error( "TM - TX " ) + cc.info( txId ) + cc.error( " status is " ) +
                cc.warning( "NULL RECORD" );
            details.write( strPrefixDetails + strMsg + "\n" );
            if( log.id != details.id )
                log.write( strPrefixLog + strMsg + "\n" );
        }
    } else if( r.status == "SUCCESS" ) {
        if( log.verboseGet() >= log.verboseReversed().information ) {
            strMsg = cc.success( "TM - TX " ) + cc.info( txId ) + cc.success( " success" );
            details.write( strPrefixDetails + strMsg + "\n" );
            if( log.id != details.id )
                log.write( strPrefixLog + strMsg + "\n" );
        }
    } else {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            strMsg = cc.error( "TM - TX " ) + cc.info( txId ) + cc.error( " status is " ) +
                cc.warning( r.status );
            details.write( strPrefixDetails + strMsg + "\n" );
            if( log.id != details.id )
                log.write( strPrefixLog + strMsg + "\n" );
        }
    }
    if( ( !tmIsFinished( r ) ) || r.status == "DROPPED" ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            const s = cc.error( "TM - TX " ) + cc.info( txId ) +
                cc.error( " was unsuccessful, wait failed" ) + "\n";
            details.write( s );
            if( log.id != details.id )
                log.write( s );
        }
        return null;
    }
    const joReceipt = await safeGetTransactionReceipt( details, 10, ethersProvider, r.tx_hash );
    if( !joReceipt ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            strMsg = cc.error( "TM - TX " ) + cc.info( txId ) +
                cc.error( " was unsuccessful, failed to fetch transaction receipt" );
            details.write( strPrefixDetails + strMsg + "\n" );
            if( log.id != details.id )
                log.write( strPrefixLog + strMsg + "\n" );
        }
        return null;
    }
    return joReceipt;
}

async function tmEnsureTransaction(
    details, ethersProvider, priority, txAdjusted, cntAttempts, sleepMilliseconds
) {
    cntAttempts = cntAttempts || 1;
    sleepMilliseconds = sleepMilliseconds || ( 30 * 1000 );
    let txId = "";
    let joReceipt = null;
    let idxAttempt = 0;
    const strPrefixDetails = cc.debug( "(gathered details)" ) + " ";
    const strPrefixLog = cc.debug( "(immediate log)" ) + " ";
    let strMsg;
    for( ; idxAttempt < cntAttempts; ++idxAttempt ) {
        txId = await tmSend( details, txAdjusted, priority );
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            strMsg = cc.debug( "TM - next TX " ) + cc.info( txId );
            details.write( strPrefixDetails + strMsg + "\n" );
            if( log.id != details.id )
                log.write( strPrefixLog + strMsg + "\n" );
        }
        joReceipt = await tmWait( details, txId, ethersProvider );
        if( joReceipt )
            break;
        if( log.verboseGet() >= log.verboseReversed().error ) {
            strMsg =
                cc.warning( "TM - unsuccessful TX " ) + cc.info( txId ) +
                cc.warning( " sending attempt " ) + cc.info( idxAttempt ) +
                cc.warning( " of " ) + cc.info( cntAttempts ) +
                cc.debug( " receipt: " ) + cc.info( joReceipt );
            details.write( strPrefixDetails + strMsg + "\n" );
            if( log.id != details.id )
                log.write( strPrefixLog + strMsg + "\n" );
        }
        await sleep( sleepMilliseconds );
    }
    if( !joReceipt ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            strMsg =
                cc.fatal( "BAD ERROR:" ) + " " + cc.error( "TM TX " ) + cc.info( txId ) +
                cc.error( " transaction has been dropped" );
            details.write( strPrefixDetails + strMsg + "\n" );
            if( log.id != details.id )
                log.write( strPrefixLog + strMsg + "\n" );
        }
        throw new Error( "TM unsuccessful transaction " + txId );
    }
    if( log.verboseGet() >= log.verboseReversed().information ) {
        strMsg =
            cc.success( "TM - successful TX " ) + cc.info( txId ) +
            cc.success( ", sending attempt " ) + cc.info( idxAttempt ) +
            cc.success( " of " ) + cc.info( cntAttempts );
        details.write( strPrefixDetails + strMsg + "\n" );
        if( log.id != details.id )
            log.write( strPrefixLog + strMsg + "\n" );
    }
    return [ txId, joReceipt ];
}

//
// register direction for money transfer
// main-net.DepositBox call: function addSchain(string schainName, address tokenManagerAddress)
//
export async function checkIsRegisteredSChainInDepositBoxes( // step 1
    ethersProviderMainNet,
    joLinker,
    joAccountMN,
    chainIdSChain
) {
    const details = log.createMemoryStream();
    details.write(
        cc.info( "Main-net " ) + cc.sunny( "Linker" ) +
        cc.info( "  address is....." ) + cc.bright( joLinker.address ) +
        "\n" );
    details.write(
        cc.info( "S-Chain  " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) +
        cc.bright( chainIdSChain ) +
        "\n" );
    const strLogPrefix = cc.note( "RegChk S in depositBox:" ) + " ";
    details.write( strLogPrefix + cc.debug( longSeparator ) + "\n" );
    details.write( strLogPrefix +
        cc.bright( "checkIsRegisteredSChainInDepositBoxes(reg-step1)" ) + "\n" );
    details.write( strLogPrefix + cc.debug( longSeparator ) + "\n" );
    let strActionName = "";
    try {
        strActionName = "checkIsRegisteredSChainInDepositBoxes(reg-step1)";
        const addressFrom = joAccountMN.address();
        const bIsRegistered =
            await joLinker.callStatic.hasSchain( chainIdSChain, { from: addressFrom } );
        details.write( strLogPrefix +
            cc.success( "checkIsRegisteredSChainInDepositBoxes(reg-step1) status is: " ) +
            cc.attention( bIsRegistered ) +
            "\n" );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "checkIsRegisteredSChainInDepositBoxes", true );
        details.close();
        return bIsRegistered;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error(
                    " Error in checkIsRegisteredSChainInDepositBoxes(reg-step1)() during " +
                strActionName + ": " ) + cc.error( strError ) + cc.error( ", stack is: " ) +
                "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "checkIsRegisteredSChainInDepositBoxes", false );
        details.close();
    }
    return false;
}

export async function invokeHasChain(
    details,
    ethersProvider, // Main-Net or S-Chin
    joLinker, // Main-Net or S-Chin
    joAccount, // Main-Net or S-Chin
    chainIdSChain
) {
    const strLogPrefix = cc.sunny( "Wait for added chain status:" ) + " ";
    const strActionName = "invokeHasChain(hasSchain): joLinker.hasSchain";
    try {
        details.write( strLogPrefix +
            cc.debug( "Will call " ) + cc.notice( strActionName ) + cc.debug( "..." ) + "\n" );
        const addressFrom = joAccount.address();
        const bHasSchain =
            await joLinker.callStatic.hasSchain( chainIdSChain, { from: addressFrom } );
        details.write( strLogPrefix +
            cc.success( "Got joLinker.hasSchain() status is: " ) + cc.attention( bHasSchain ) +
            "\n" );
        return bHasSchain;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( "Error in invokeHasChain() during " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
    }
    return false;
}

export async function waitForHasChain(
    details,
    ethersProvider, // Main-Net or S-Chin
    joLinker, // Main-Net or S-Chin
    joAccount, // Main-Net or S-Chin
    chainIdSChain,
    cntWaitAttempts,
    nSleepMilliseconds
) {
    if( cntWaitAttempts == null || cntWaitAttempts == undefined )
        cntWaitAttempts = 100;
    if( nSleepMilliseconds == null || nSleepMilliseconds == undefined )
        nSleepMilliseconds = 5;
    for( let idxWaitAttempts = 0; idxWaitAttempts < cntWaitAttempts; ++ idxWaitAttempts ) {
        if( await invokeHasChain(
            details, ethersProvider, joLinker, joAccount, chainIdSChain
        ) )
            return true;
        details.write(
            cc.normal( "Sleeping " ) + cc.info( nSleepMilliseconds ) +
            cc.normal( " milliseconds..." ) +
            "\n" );
        await sleep( nSleepMilliseconds );
    }
    return false;
}

export async function registerSChainInDepositBoxes( // step 1
    ethersProviderMainNet,
    joLinker,
    joAccountMN,
    joTokenManagerETH, // only s-chain
    joTokenManagerERC20, // only s-chain
    joTokenManagerERC721, // only s-chain
    joTokenManagerERC1155, // only s-chain
    joTokenManagerERC721WithMetadata, // only s-chain
    joCommunityLocker, // only s-chain
    joTokenManagerLinker,
    chainNameSChain,
    chainNameMainNet,
    transactionCustomizerMainNet,
    cntWaitAttempts,
    nSleepMilliseconds
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // registerSChainInDepositBoxes
    details.write(
        cc.info( "Main-net " ) + cc.sunny( "Linker" ) + cc.info( "  address is......." ) +
        cc.bright( joLinker.address ) +
        "\n" );
    details.write(
        cc.info( "S-Chain  " ) + cc.sunny( "ID" ) + cc.info( " is......................." ) +
        cc.bright( chainNameSChain ) +
        "\n" );
    const strLogPrefix = cc.sunny( "Reg S in depositBoxes:" ) + " ";
    details.write( strLogPrefix + cc.debug( longSeparator ) + "\n" );
    details.write( strLogPrefix +
        cc.bright( "reg-step1:registerSChainInDepositBoxes" ) + "\n" );
    details.write( strLogPrefix + cc.debug( longSeparator ) + "\n" );
    let strActionName = "";
    try {
        strActionName = "Register S-chain in deposit boxes, step 1, connectSchain";
        details.write( strLogPrefix +
            cc.debug( "Will register S-Chain in lock_and_data on Main-net" ) + "\n" );
        const arrArguments = [
            chainNameSChain,
            [
                joTokenManagerLinker.address, // call params
                joCommunityLocker.address, // call params
                joTokenManagerETH.address, // call params
                joTokenManagerERC20.address, // call params
                joTokenManagerERC721.address, // call params
                joTokenManagerERC1155.address, // call params
                joTokenManagerERC721WithMetadata.address // call params
            ]
        ];
        const weiHowMuch = undefined;
        const gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGas =
            await transactionCustomizerMainNet.computeGas(
                details,
                ethersProviderMainNet,
                "Linker", joLinker, "connectSchain", arrArguments,
                joAccountMN, strActionName,
                gasPrice, 3000000, weiHowMuch,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGas ) +
            "\n" );
        const isIgnore = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProviderMainNet,
                "Linker", joLinker, "connectSchain", arrArguments,
                joAccountMN, strActionName, isIgnore,
                gasPrice, estimatedGas, weiHowMuch,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const joReceipt =
            await payedCall(
                details,
                ethersProviderMainNet,
                "Linker", joLinker, "connectSchain", arrArguments,
                joAccountMN, strActionName,
                gasPrice, estimatedGas, weiHowMuch,
                null
            );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "registerSChainInDepositBoxes",
                "receipt": joReceipt
            } );
        }

        const isSChainStatusOKay = await waitForHasChain(
            details,
            ethersProviderMainNet,
            joLinker,
            joAccountMN,
            chainNameSChain,
            cntWaitAttempts,
            nSleepMilliseconds
        );
        if( ! isSChainStatusOKay )
            throw new Error( "S-Chain ownership status check timeout" );
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in registerSChainInDepositBoxes() during " +
                strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) +
                "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "registerSChainInDepositBoxes", false );
        details.close();
        return null;
    }
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "registerSChainInDepositBoxes", true );
    details.close();
    return jarrReceipts;
}

export async function reimbursementShowBalance(
    ethersProviderMainNet,
    joCommunityPool,
    joReceiverMainNet,
    strChainNameMainNet,
    chainIdMainNet,
    transactionCustomizerMainNet,
    strReimbursementChain,
    isForcePrintOut
) {
    const details = log.createMemoryStream();
    let s = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Show Balance" ) + " ";
    try {
        const addressFrom = joReceiverMainNet;
        details.write( strLogPrefix +
            cc.debug( "Querying wallet " ) + cc.notice( strReimbursementChain ) +
            cc.debug( "/" ) + cc.info( addressFrom ) +
            cc.debug( " balance..." ) + "\n" );
        const xWei =
            await joCommunityPool.callStatic.getBalance(
                addressFrom, strReimbursementChain, { from: addressFrom } );

        s = strLogPrefix + cc.success( "Balance(wei): " ) + cc.attention( xWei ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );
        const xEth = owaspUtils.ethersMod.ethers.utils.formatEther( owaspUtils.toBN( xWei ) );
        s = strLogPrefix + cc.success( "Balance(eth): " ) + cc.attention( xEth ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "reimbursementShowBalance", true );
        details.close();
        return xWei;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in reimbursementShowBalance(): " ) +
                cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "reimbursementShowBalance", false );
        details.close();
        return 0;
    }
}

export async function reimbursementEstimateAmount(
    ethersProviderMainNet,
    joCommunityPool,
    joReceiverMainNet,
    strChainNameMainNet,
    chainIdMainNet,
    transactionCustomizerMainNet,
    strReimbursementChain,
    isForcePrintOut
) {
    const details = log.createMemoryStream();
    let s = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Estimate Amount To Recharge" ) + " ";
    try {
        details.write( strLogPrefix +
            cc.debug( "Querying wallet " ) + cc.notice( strReimbursementChain ) +
            cc.debug( " balance..." ) +
            "\n" );
        const addressReceiver = joReceiverMainNet;
        const xWei =
        await joCommunityPool.callStatic.getBalance(
            addressReceiver, strReimbursementChain, { from: addressReceiver } );

        s = strLogPrefix + cc.success( "Balance(wei): " ) + cc.attention( xWei ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );
        const xEth = owaspUtils.ethersMod.ethers.utils.formatEther( owaspUtils.toBN( xWei ) );
        s = strLogPrefix + cc.success( "Balance(eth): " ) + cc.attention( xEth ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        const minTransactionGas =
            owaspUtils.parseIntOrHex(
                await joCommunityPool.callStatic.minTransactionGas(
                    { from: addressReceiver } ) );
        s = strLogPrefix + cc.success( "MinTransactionGas: " ) +
            cc.attention( minTransactionGas ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        const gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        s = strLogPrefix + cc.success( "Multiplied Gas Price: " ) + cc.attention( gasPrice ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        const minAmount = minTransactionGas * gasPrice;
        s = strLogPrefix + cc.success( "Minimum recharge balance: " ) +
            cc.attention( minAmount ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        let amountToRecharge = 0;
        if( xWei >= minAmount )
            amountToRecharge = 1;
        else
            amountToRecharge = minAmount - xWei;

        s = strLogPrefix + cc.success( "Estimated amount to recharge(wei): " ) +
            cc.attention( amountToRecharge ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        const amountToRechargeEth =
            owaspUtils.ethersMod.ethers.utils.formatEther(
                owaspUtils.toBN( amountToRecharge.toString() ) );
        s = strLogPrefix + cc.success( "Estimated amount to recharge(eth): " ) +
            cc.attention( amountToRechargeEth ) + "\n";
        if( isForcePrintOut || log.verboseGet() >= log.verboseReversed().information )
            log.write( s );
        details.write( s );

        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "reimbursementEstimateAmount", true );
        details.close();
        return amountToRecharge;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in reimbursementEstimateAmount(): " ) +
                cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "reimbursementEstimateAmount", false );
        details.close();
        return 0;
    }
}

export async function reimbursementWalletRecharge(
    ethersProviderMainNet,
    joCommunityPool,
    joAccountMN,
    strChainNameMainNet,
    chainIdMainNet,
    transactionCustomizerMainNet,
    strReimbursementChain,
    nReimbursementRecharge
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // reimbursementWalletRecharge
    let strActionName = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Wallet Recharge" ) + " ";
    try {
        details.write( strLogPrefix +
            cc.debug( "Recharging wallet " ) +
            cc.notice( strReimbursementChain ) + cc.debug( "..." ) +
            "\n" );
        strActionName = "Recharge reimbursement wallet on Main Net";
        const addressReceiver = joAccountMN.address();
        const arrArguments = [
            strReimbursementChain,
            addressReceiver
        ];
        const gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGas =
            await transactionCustomizerMainNet.computeGas(
                details,
                ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "rechargeUserWallet", arrArguments,
                joAccountMN, strActionName,
                gasPrice, 3000000, nReimbursementRecharge,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGas ) +
            "\n" );
        const isIgnore = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "rechargeUserWallet", arrArguments,
                joAccountMN, strActionName, isIgnore,
                gasPrice, estimatedGas, nReimbursementRecharge,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const joReceipt =
            await payedCall(
                details,
                ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "rechargeUserWallet", arrArguments,
                joAccountMN, strActionName,
                gasPrice, estimatedGas, nReimbursementRecharge,
                null
            );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "reimbursementWalletRecharge",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " +
                strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "reimbursementWalletRecharge", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "REIMBURSEMENT_WALLET_RECHARGE", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "reimbursementWalletRecharge", true );
    details.close();
    return true;
}

export async function reimbursementWalletWithdraw(
    ethersProviderMainNet,
    joCommunityPool,
    joAccountMN,
    strChainNameMainNet,
    chainIdMainNet,
    transactionCustomizerMainNet,
    strReimbursementChain,
    nReimbursementWithdraw
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // reimbursementWalletWithdraw
    let strActionName = "";
    const strLogPrefix = cc.info( "Gas Reimbursement - Wallet Withdraw" ) + " ";
    try {
        details.write( strLogPrefix +
            cc.debug( "Withdrawing wallet " ) +
            cc.notice( strReimbursementChain ) + cc.debug( "..." ) +
            "\n" );
        strActionName = "Withdraw reimbursement wallet";
        const arrArguments = [
            strReimbursementChain,
            owaspUtils.ensureStartsWith0x(
                owaspUtils.toBN( nReimbursementWithdraw ).toHexString() )
        ];
        const weiHowMuch = undefined;
        const gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGas =
            await transactionCustomizerMainNet.computeGas(
                details,
                ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "withdrawFunds", arrArguments,
                joAccountMN, strActionName,
                gasPrice, 3000000, weiHowMuch,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGas ) +
            "\n" );
        const isIgnore = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "withdrawFunds", arrArguments,
                joAccountMN, strActionName, isIgnore,
                gasPrice, estimatedGas, weiHowMuch,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const joReceipt =
            await payedCall(
                details,
                ethersProviderMainNet,
                "CommunityPool", joCommunityPool, "withdrawFunds", arrArguments,
                joAccountMN, strActionName,
                gasPrice, estimatedGas, weiHowMuch,
                null
            );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "reimbursementWalletWithdraw",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " +
                strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "reimbursementWalletWithdraw", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "REIMBURSEMENT_WALLET_WITHDRAW", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "reimbursementWalletWithdraw", true );
    details.close();
    return true;
}

export async function reimbursementSetRange(
    ethersProviderSChain,
    joCommunityLocker,
    joAccountSC,
    strChainNameSChain,
    chainIdSChain,
    transactionCustomizerSChain,
    strChainNameOriginChain,
    nReimbursementRange
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // reimbursementSetRange
    let strActionName = "";
    const strLogPrefix =
        cc.info( "Gas Reimbursement - Set Minimal time interval from S2M transfers" ) + " ";
    try {
        details.write( strLogPrefix +
            cc.debug( "Setting minimal S2M interval to " ) +
            cc.notice( nReimbursementRange ) + cc.debug( "..." ) +
            "\n" );
        strActionName = "Set reimbursement range";
        const arrArguments = [
            strChainNameOriginChain,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nReimbursementRange ).toHexString() )
        ];
        const weiHowMuch = undefined;
        const gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGas =
            await transactionCustomizerSChain.computeGas(
                details,
                ethersProviderSChain,
                "CommunityLocker", joCommunityLocker,
                "setTimeLimitPerMessage", arrArguments,
                joAccountSC, strActionName,
                gasPrice, 3000000, weiHowMuch,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGas ) +
            "\n" );
        const isIgnore = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProviderSChain,
                "CommunityLocker", joCommunityLocker,
                "setTimeLimitPerMessage", arrArguments,
                joAccountSC, strActionName, isIgnore,
                gasPrice, estimatedGas, weiHowMuch,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: true
        };
        const joReceipt =
            await payedCall(
                details,
                ethersProviderSChain,
                "CommunityLocker", joCommunityLocker,
                "setTimeLimitPerMessage", arrArguments,
                joAccountSC, strActionName,
                gasPrice, estimatedGas, weiHowMuch,
                opts
            );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "reimbursementSetRange",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "reimbursementSetRange", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "REIMBURSEMENT_SET_RANGE", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "reimbursementSetRange", true );
    details.close();
    return true;
}

// transfer money from main-net to S-chain
// main-net.DepositBox call: function deposit(string schainName, address to) public payable
// Where:
//   schainName...obvious
//   to.........address in S-chain
// Notice:
//   this function is available for everyone in main-net
//   money is sent from caller
//   "value" JSON arg is used to specify amount of money to sent
export async function doEthPaymentFromMainNet(
    ethersProviderMainNet,
    chainIdMainNet,
    joAccountSrc,
    joAccountDst,
    joDepositBox,
    joMessageProxyMainNet, // for checking logs
    chainIdSChain,
    weiHowMuch, // how much WEI money to send
    transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ETH Payment:" ) + " ";
    try {
        details.write( strLogPrefix +
            cc.debug( "Doing payment from mainnet with " ) + cc.notice( "chainIdSChain" ) +
            cc.debug( "=" ) + cc.notice( chainIdSChain ) + cc.debug( "..." ) +
            "\n" );
        strActionName = "ETH payment from Main Net, deposit";
        const arrArguments = [
            chainIdSChain
        ];
        const gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGas =
            await transactionCustomizerMainNet.computeGas(
                details,
                ethersProviderMainNet,
                "DepositBox", joDepositBox, "deposit", arrArguments,
                joAccountSrc, strActionName,
                gasPrice, 3000000, weiHowMuch,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGas ) +
            "\n" );
        const isIgnore = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProviderMainNet,
                "DepositBox", joDepositBox, "deposit", arrArguments,
                joAccountSrc, strActionName, isIgnore,
                gasPrice, estimatedGas, weiHowMuch,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const joReceipt =
            await payedCall(
                details,
                ethersProviderMainNet,
                "DepositBox", joDepositBox, "deposit", arrArguments,
                joAccountSrc, strActionName,
                gasPrice, estimatedGas, weiHowMuch,
                null
            );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "doEthPaymentFromMainNet",
                "receipt": joReceipt
            } );
        }

        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxyMainNet ) {
            details.write( strLogPrefix +
                cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxyMainNet.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await sleep( gMillisecondsSleepBeforeFetchOutgoingMessageEvent );
            const joEvents =
                await getContractCallEvents(
                    details, strLogPrefix,
                    ethersProviderMainNet, joMessageProxyMainNet, strEventName,
                    joReceipt.blockNumber, joReceipt.transactionHash,
                    joMessageProxyMainNet.filters[strEventName]()
                );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                    cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.success( "/" ) + cc.notice( joMessageProxyMainNet.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) +
                    "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" " +
                        "event of the \"MessageProxy\"/" +
                    joMessageProxyMainNet.address + " contract, no events found" );
            }
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "doEthPaymentFromMainNet", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ETH PAYMENT FROM MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doEthPaymentFromMainNet", true );
    details.close();
    return true;
}

// transfer money from S-chain to main-net
// S-chain.TokenManager call: function exitToMain(address to) public payable
// Where:
//   to.........address in main-net
// Notice:
//   this function is available for everyone in S-chain
//   money is sent from caller
//   "value" JSON arg is used to specify amount of money to sent
export async function doEthPaymentFromSChain(
    ethersProviderSChain,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joTokenManagerETH,
    joMessageProxySChain, // for checking logs
    weiHowMuch, // how much WEI money to send
    transactionCustomizerSChain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "S2M ETH Payment:" ) + " ";
    try {
        strActionName = "ETH payment from S-Chain, exitToMain";
        const arrArguments = [
            owaspUtils.toBN( weiHowMuch )
        ];
        const gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGas =
            await transactionCustomizerSChain.computeGas(
                details,
                ethersProviderSChain,
                "TokenManagerETH", joTokenManagerETH, "exitToMain", arrArguments,
                joAccountSrc, strActionName,
                gasPrice, 6000000, 0, // weiHowMuch
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGas ) +
            "\n" );
        const isIgnore = true;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProviderSChain,
                "TokenManagerETH", joTokenManagerETH, "exitToMain", arrArguments,
                joAccountSrc, strActionName, isIgnore,
                gasPrice, estimatedGas, 0, // weiHowMuch
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: true
        };
        const joReceipt =
            await payedCall(
                details,
                ethersProviderSChain,
                "TokenManagerETH", joTokenManagerETH, "exitToMain", arrArguments,
                joAccountSrc, strActionName,
                gasPrice, estimatedGas, 0, // weiHowMuch
                opts
            );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "doEthPaymentFromSChain",
                "receipt": joReceipt
            } );
        }

        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxySChain ) {
            details.write( strLogPrefix +
                cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxySChain.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await sleep( gMillisecondsSleepBeforeFetchOutgoingMessageEvent );
            const joEvents =
                await getContractCallEvents(
                    details, strLogPrefix,
                    ethersProviderSChain, joMessageProxySChain, strEventName,
                    joReceipt.blockNumber, joReceipt.transactionHash,
                    joMessageProxySChain.filters[strEventName]()
                );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                    cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.success( "/" ) + cc.notice( joMessageProxySChain.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) +
                    "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" " +
                        "event of the \"MessageProxy\"/" +
                    joMessageProxySChain.address + " contract, no events found" );
            }
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " +
                strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "doEthPaymentFromSChain", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ETH PAYMENT FROM S-CHAIN", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doEthPaymentFromSChain", true );
    details.close();
    return true;
}

export async function receiveEthPaymentFromSchainOnMainNet(
    ethersProviderMainNet,
    chainIdMainNet,
    joAccountMN,
    joDepositBoxETH,
    transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = []; // receiveEthPaymentFromSchainOnMainNet
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ETH Receive:" ) + " ";
    try {
        strActionName = "Receive ETH payment from S-Chain on Main Met, getMyEth";
        const arrArguments = [];
        const weiHowMuch = undefined;
        const gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGas =
            await transactionCustomizerMainNet.computeGas(
                details,
                ethersProviderMainNet,
                "DepositBoxETH", joDepositBoxETH, "getMyEth", arrArguments,
                joAccountMN, strActionName,
                gasPrice, 3000000, weiHowMuch,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGas ) +
            "\n" );
        const isIgnore = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProviderMainNet,
                "DepositBoxETH", joDepositBoxETH,
                "getMyEth", arrArguments,
                joAccountMN, strActionName, isIgnore,
                gasPrice, estimatedGas, weiHowMuch,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const joReceipt =
            await payedCall(
                details,
                ethersProviderMainNet,
                "DepositBoxETH", joDepositBoxETH,
                "getMyEth", arrArguments,
                joAccountMN, strActionName,
                gasPrice, estimatedGas, weiHowMuch,
                null
            );
        if( joReceipt && typeof joReceipt == "object" ) {
            jarrReceipts.push( {
                "description": "receiveEthPaymentFromSchainOnMainNet",
                "receipt": joReceipt
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Receive payment error in " + strActionName + ": " ) +
                cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "receiveEthPaymentFromSchainOnMainNet", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "RECEIVE ETH ON MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "receiveEthPaymentFromSchainOnMainNet", true );
    details.close();
    return true;
}

export async function viewEthPaymentFromSchainOnMainNet(
    ethersProviderMainNet,
    joAccountMN,
    joDepositBoxETH
) {
    const details = log.createMemoryStream();
    const strActionName = "";
    const strLogPrefix = cc.info( "S ETH View:" ) + " ";
    try {
        if( ! ( ethersProviderMainNet && joAccountMN && joDepositBoxETH ) )
            return null;
        const addressFrom = joAccountMN.address();
        const xWei =
            await joDepositBoxETH.callStatic.approveTransfers(
                addressFrom,
                { from: addressFrom } );
        details.write( strLogPrefix +
            cc.success( "You can receive(wei): " ) + cc.attention( xWei ) + "\n" );
        const xEth = owaspUtils.ethersMod.ethers.utils.formatEther( owaspUtils.toBN( xWei ) );
        const s = strLogPrefix +
            cc.success( "You can receive(eth): " ) + cc.attention( xEth ) + "\n";
        if( log.id != details.id )
            log.write( s );
        details.write( s );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "viewEthPaymentFromSchainOnMainNet", true );
        details.close();
        return xWei;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " View payment error in " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "viewEthPaymentFromSchainOnMainNet", false );
        details.close();
        return null;
    }
}

export async function doErc721PaymentFromMainNet(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joDepositBoxERC721,
    joMessageProxyMainNet, // for checking logs
    chainNameSChain,
    tokenId, // which ERC721 token id to send
    weiHowMuch, // how much ETH
    joTokenManagerERC721, // only s-chain
    strCoinNameErc721MainNet,
    erc721PrivateTestnetJsonMainNet,
    strCoinNameErc721SChain,
    erc721PrivateTestnetJsonSChain,
    transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ERC721 Payment:" ) + " ";
    try {
        strActionName = "ERC721 payment from Main Net, approve";
        const erc721ABI = erc721PrivateTestnetJsonMainNet[strCoinNameErc721MainNet + "_abi"];
        const erc721AddressMainNet =
            erc721PrivateTestnetJsonMainNet[strCoinNameErc721MainNet + "_address"];
        const contractERC721 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc721AddressMainNet,
                erc721ABI,
                ethersProviderMainNet
            );
        const depositBoxAddress = joDepositBoxERC721.address;
        const arrArgumentsApprove = [
            depositBoxAddress,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const arrArgumentsDepositERC721 = [
            chainNameSChain,
            erc721AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGasApprove =
            await transactionCustomizerMainNet.computeGas(
                details,
                ethersProviderMainNet,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchApprove,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated(approve) " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasApprove ) +
            "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details,
                ethersProviderMainNet,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove,
                null
            );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );

        const joReceiptApprove =
            await payedCall(
                details,
                ethersProviderMainNet,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove,
                null
            );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc721PaymentFromMainNet/approve",
                "receipt": joReceiptApprove
            } );
        }

        strActionName = "ERC721 payment from Main Net, depositERC721";
        const weiHowMuchDepositERC721 = undefined;
        gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGasDeposit =
            await transactionCustomizerMainNet.computeGas(
                details,
                ethersProviderMainNet,
                "DepositBoxERC721", joDepositBoxERC721,
                "depositERC721", arrArgumentsDepositERC721,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchDepositERC721,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated(deposit) " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasDeposit ) +
            "\n" );
        const isIgnoreDepositERC721 = true;
        const strErrorOfDryRunDepositERC721 =
            await dryRunCall(
                details,
                ethersProviderMainNet,
                "DepositBoxERC721", joDepositBoxERC721,
                "depositERC721", arrArgumentsDepositERC721,
                joAccountSrc, strActionName, isIgnoreDepositERC721,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC721,
                null
            );
        if( strErrorOfDryRunDepositERC721 )
            throw new Error( strErrorOfDryRunDepositERC721 );

        const joReceiptDeposit =
            await payedCall(
                details,
                ethersProviderMainNet,
                "DepositBoxERC721", joDepositBoxERC721,
                "depositERC721", arrArgumentsDepositERC721,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC721,
                null
            );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" ) {
            jarrReceipts.push( {
                "description": "doErc721PaymentFromMainNet/deposit",
                "receipt": joReceiptDeposit
            } );
        }

        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxyMainNet ) {
            details.write( strLogPrefix +
                cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxyMainNet.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await sleep( gMillisecondsSleepBeforeFetchOutgoingMessageEvent );
            const joEvents =
                await getContractCallEvents(
                    details, strLogPrefix,
                    ethersProviderMainNet, joMessageProxyMainNet, strEventName,
                    joReceiptDeposit.blockNumber, joReceiptDeposit.transactionHash,
                    joMessageProxyMainNet.filters[strEventName]()
                );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                    cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.success( "/" ) + cc.notice( joMessageProxyMainNet.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) +
                    "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" " +
                        "event of the \"MessageProxy\"/" +
                    joMessageProxyMainNet.address + " contract, no events found"
                );
            }
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " +
                strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "doErc721PaymentFromMainNet", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-721 PAYMENT FROM MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc721PaymentFromMainNet", true );
    details.close();
    return true;
}

export async function doErc20PaymentFromMainNet(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joDepositBoxERC20,
    joMessageProxyMainNet, // for checking logs
    chainNameSChain,
    tokenAmount, // how much ERC20 tokens to send
    weiHowMuch, // how much ETH
    joTokenManagerERC20, // only s-chain
    strCoinNameErc20MainNet,
    erc20MainNet,
    strCoinNameErc20SChain,
    erc20SChain,
    transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ERC20 Payment:" ) + " ";
    try {
        strActionName = "ERC20 payment from Main Net, approve";
        const erc20ABI = erc20MainNet[strCoinNameErc20MainNet + "_abi"];
        const erc20AddressMainNet =
            erc20MainNet[strCoinNameErc20MainNet + "_address"];
        const contractERC20 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc20AddressMainNet,
                erc20ABI,
                ethersProviderMainNet
            );
        const depositBoxAddress = joDepositBoxERC20.address;
        const arrArgumentsApprove = [
            depositBoxAddress,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() )
        ];
        const arrArgumentsDepositERC20 = [
            chainNameSChain,
            erc20AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGasApprove =
            await transactionCustomizerMainNet.computeGas(
                details,
                ethersProviderMainNet,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchApprove,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated(approve) " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasApprove ) +
            "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details,
                ethersProviderMainNet,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove,
                null
            );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );

        const joReceiptApprove =
            await payedCall(
                details,
                ethersProviderMainNet,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove,
                null
            );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc20PaymentFromMainNet/approve",
                "receipt": joReceiptApprove
            } );
        }

        strActionName = "ERC20 payment from Main Net, depositERC20";
        const weiHowMuchDepositERC20 = undefined;
        gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGasDeposit =
            await transactionCustomizerMainNet.computeGas(
                details,
                ethersProviderMainNet,
                "DepositBoxERC20", joDepositBoxERC20,
                "depositERC20", arrArgumentsDepositERC20,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchDepositERC20,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated(deposit) " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasDeposit ) +
            "\n" );
        const isIgnoreDepositERC20 = true;
        const strErrorOfDryRunDepositERC20 =
            await dryRunCall(
                details,
                ethersProviderMainNet,
                "DepositBoxERC20", joDepositBoxERC20,
                "depositERC20", arrArgumentsDepositERC20,
                joAccountSrc, strActionName, isIgnoreDepositERC20,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC20,
                null
            );
        if( strErrorOfDryRunDepositERC20 )
            throw new Error( strErrorOfDryRunDepositERC20 );

        const joReceiptDeposit =
            await payedCall(
                details,
                ethersProviderMainNet,
                "DepositBoxERC20", joDepositBoxERC20,
                "depositERC20", arrArgumentsDepositERC20,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC20,
                null
            );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" ) {
            jarrReceipts.push( {
                "description": "doErc20PaymentFromMainNet/deposit",
                "receipt": joReceiptDeposit
            } );
        }

        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxyMainNet ) {
            details.write( strLogPrefix +
                cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxyMainNet.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await sleep( gMillisecondsSleepBeforeFetchOutgoingMessageEvent );
            const joEvents =
                await getContractCallEvents(
                    details, strLogPrefix,
                    ethersProviderMainNet, joMessageProxyMainNet, strEventName,
                    joReceiptDeposit.blockNumber, joReceiptDeposit.transactionHash,
                    joMessageProxyMainNet.filters[strEventName]()
                );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                    cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.success( "/" ) + cc.notice( joMessageProxyMainNet.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) +
                    "\n" );
            } else {
                throw new Error(
                    "Verification failed for th\"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
                    joMessageProxyMainNet.address + " contract, no events found" );
            }
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "doErc20PaymentFromMainNet", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-20 PAYMENT FROM MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc20PaymentFromMainNet", true );
    details.close();
    return true;
}

export async function doErc1155PaymentFromMainNet(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joDepositBoxERC1155,
    joMessageProxyMainNet, // for checking logs
    chainNameSChain,
    tokenId, // which ERC1155 token id to send
    tokenAmount, // which ERC1155 token id to send
    weiHowMuch, // how much ETH
    joTokenManagerERC1155, // only s-chain
    strCoinNameErc1155SMainNet,
    erc1155PrivateTestnetJsonMainNet,
    strCoinNameErc1155SChain,
    erc1155PrivateTestnetJsonSChain,
    transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ERC1155 Payment:" ) + " ";
    try {
        strActionName = "ERC1155 payment from Main Net, approve";
        const erc1155ABI =
            erc1155PrivateTestnetJsonMainNet[strCoinNameErc1155SMainNet + "_abi"];
        const erc1155AddressMainNet =
            erc1155PrivateTestnetJsonMainNet[strCoinNameErc1155SMainNet + "_address"];
        const contractERC1155 = new owaspUtils.ethersMod.ethers.Contract(
            erc1155AddressMainNet, erc1155ABI, ethersProviderMainNet );
        const depositBoxAddress = joDepositBoxERC1155.address;
        const arrArgumentsApprove = [
            depositBoxAddress,
            true
        ];
        const arrArgumentsDepositERC1155 = [
            chainNameSChain,
            erc1155AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() ),
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGasApprove =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details, ethersProviderMainNet,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await payedCall(
                details, ethersProviderMainNet,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, estimatedGasApprove, weiHowMuchApprove,
                null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentFromMainNet/approve",
                "receipt": joReceiptApprove
            } );
        }
        strActionName = "ERC1155 payment from Main Net, depositERC1155";
        const weiHowMuchDepositERC1155 = undefined;
        gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGasDeposit =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155", arrArgumentsDepositERC1155,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchDepositERC1155, null );
        details.write( strLogPrefix +
            cc.debug( "Using estimated(deposit) " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasDeposit ) +
            "\n" );
        const isIgnoreDepositERC1155 = true;
        const strErrorOfDryRunDepositERC1155 =
            await dryRunCall(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155", arrArgumentsDepositERC1155,
                joAccountSrc, strActionName, isIgnoreDepositERC1155,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC1155, null );
        if( strErrorOfDryRunDepositERC1155 )
            throw new Error( strErrorOfDryRunDepositERC1155 );
        const joReceiptDeposit =
            await payedCall(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155", arrArgumentsDepositERC1155,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC1155, null );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentFromMainNet/deposit",
                "receipt": joReceiptDeposit
            } );
        }
        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxyMainNet ) {
            details.write( strLogPrefix +
                cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxyMainNet.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await sleep( gMillisecondsSleepBeforeFetchOutgoingMessageEvent );
            const joEvents =
                await getContractCallEvents(
                    details, strLogPrefix,
                    ethersProviderMainNet, joMessageProxyMainNet, strEventName,
                    joReceiptDeposit.blockNumber, joReceiptDeposit.transactionHash,
                    joMessageProxyMainNet.filters[strEventName]()
                );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                    cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.success( "/" ) + cc.notice( joMessageProxyMainNet.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) +
                    "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
                    joMessageProxyMainNet.address + " contract, no events found" );
            }
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "doErc1155PaymentFromMainNet", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-1155 PAYMENT FROM MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc1155PaymentFromMainNet", true );
    details.close();
    return true;
}

export async function doErc1155BatchPaymentFromMainNet(
    ethersProviderMainNet, ethersProviderSChain,
    chainIdMainNet, chainIdSChain,
    joAccountSrc, joAccountDst,
    joDepositBoxERC1155,
    joMessageProxyMainNet, // for checking logs
    chainNameSChain,
    arrTokenIds, // which ERC1155 token id to send
    arrTokenAmounts, // which ERC1155 token id to send
    weiHowMuch, // how much ETH
    joTokenManagerERC1155, // only s-chain
    strCoinNameErc1155SMainNet,
    erc1155PrivateTestnetJsonMainNet, strCoinNameErc1155SChain,
    erc1155PrivateTestnetJsonSChain, transactionCustomizerMainNet
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "M2S ERC1155 Batch Payment:" ) + " ";
    try {
        strActionName = "ERC1155 batch-payment from Main Net, approve";
        const erc1155ABI =
            erc1155PrivateTestnetJsonMainNet[strCoinNameErc1155SMainNet + "_abi"];
        const erc1155AddressMainNet =
            erc1155PrivateTestnetJsonMainNet[strCoinNameErc1155SMainNet + "_address"];
        const contractERC1155 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc1155AddressMainNet,
                erc1155ABI,
                ethersProviderMainNet
            );
        const depositBoxAddress = joDepositBoxERC1155.address;
        const arrArgumentsApprove = [
            // joAccountSrc.address(),
            depositBoxAddress,
            true
        ];
        const arrArgumentsDepositERC1155Batch = [
            chainNameSChain, erc1155AddressMainNet, arrTokenIds, arrTokenAmounts ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasApprove =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details, ethersProviderMainNet, "ERC1155", contractERC1155,
                "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await payedCall(
                details, ethersProviderMainNet,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155BatchPaymentFromMainNet/approve",
                "receipt": joReceiptApprove
            } );
        }
        strActionName = "ERC1155 batch-payment from Main Net, depositERC1155Batch";
        const weiHowMuchDepositERC1155Batch = undefined;
        gasPrice = await transactionCustomizerMainNet.computeGasPrice(
            ethersProviderMainNet, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGasDeposit =
            await transactionCustomizerMainNet.computeGas(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155Batch", arrArgumentsDepositERC1155Batch,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchDepositERC1155Batch, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(deposit) " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasDeposit ) + "\n" );
        const isIgnoreDepositERC1155Batch = true;
        const strErrorOfDryRunDepositERC1155Batch =
            await dryRunCall(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155Batch", arrArgumentsDepositERC1155Batch,
                joAccountSrc, strActionName, isIgnoreDepositERC1155Batch,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC1155Batch, null );
        if( strErrorOfDryRunDepositERC1155Batch )
            throw new Error( strErrorOfDryRunDepositERC1155Batch );
        const joReceiptDeposit =
            await payedCall(
                details, ethersProviderMainNet,
                "DepositBoxERC1155", joDepositBoxERC1155,
                "depositERC1155Batch", arrArgumentsDepositERC1155Batch,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasDeposit, weiHowMuchDepositERC1155Batch, null );
        if( joReceiptDeposit && typeof joReceiptDeposit == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155BatchPaymentFromMainNet/deposit",
                "receipt": joReceiptDeposit
            } );
        }
        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxyMainNet ) {
            details.write( strLogPrefix +
                cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxyMainNet.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await sleep( gMillisecondsSleepBeforeFetchOutgoingMessageEvent );
            const joEvents =
                await getContractCallEvents(
                    details, strLogPrefix,
                    ethersProviderMainNet, joMessageProxyMainNet, strEventName,
                    joReceiptDeposit.blockNumber, joReceiptDeposit.transactionHash,
                    joMessageProxyMainNet.filters[strEventName]()
                );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix +
                    cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                    cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.success( "/" ) + cc.notice( joMessageProxyMainNet.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) +
                    "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
                    joMessageProxyMainNet.address + " contract, no events found" );
            }
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "doErc1155BatchPaymentFromMainNet", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-1155 PAYMENT FROM MAIN NET", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc1155BatchPaymentFromMainNet", true );
    details.close();
    return true;
}

export async function doErc20PaymentFromSChain(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joTokenManagerERC20, // only s-chain
    joMessageProxySChain, // for checking logs
    joDepositBox, // only main net
    tokenAmount, // how much ERC20 tokens to send
    weiHowMuch, // how much ETH
    strCoinNameErc20MainNet,
    joErc20MainNet,
    strCoinNameErc20SChain,
    joErc20SChain,
    transactionCustomizerSChain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "S2M ERC20 Payment:" ) + " ";
    try {
        strActionName = "ERC20 payment from S-Chain, approve";
        const erc20ABI = joErc20SChain[strCoinNameErc20SChain + "_abi"];
        const erc20AddressSChain = joErc20SChain[strCoinNameErc20SChain + "_address"];
        const tokenManagerAddress = joTokenManagerERC20.address;
        const contractERC20 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc20AddressSChain, erc20ABI, ethersProviderSChain );
        const arrArgumentsApprove = [
            tokenManagerAddress,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() ) ];
        const erc20AddressMainNet = joErc20MainNet[strCoinNameErc20MainNet + "_address"];
        const arrArgumentsExitToMainERC20 = [
            erc20AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() )
            // owaspUtils.ensureStartsWith0x( owaspUtils.toBN( weiHowMuch ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasApprove =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchApprove, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details, ethersProviderSChain,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const opts = { isCheckTransactionToSchain: true };
        const joReceiptApprove =
            await payedCall(
                details, ethersProviderSChain,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, opts );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc20PaymentFromSChain/approve",
                "receipt": joReceiptApprove
            } );
        }
        if( gMillisecondsSleepBetweenTransactionsOnSChain ) {
            details.write( cc.normal( "Sleeping " ) +
                cc.info( gMillisecondsSleepBetweenTransactionsOnSChain ) +
                cc.normal( " milliseconds between transactions..." ) + "\n" );
            await sleep( gMillisecondsSleepBetweenTransactionsOnSChain );
        }
        if( gFlagWaitForNextBlockOnSChain )
            await safeWaitForNextBlockToAppear( details, ethersProviderSChain );
        strActionName = "ERC20 payment from S-Chain, exitToMainERC20";
        const weiHowMuchExitToMainERC20 = undefined;
        const estimatedGasExitToMainERC20 =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "TokenManagerERC20", joTokenManagerERC20,
                "exitToMainERC20", arrArgumentsExitToMainERC20,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchExitToMainERC20, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasExitToMainERC20 ) + "\n" );
        gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const isIgnoreExitToMainERC20 = true;
        const strErrorOfDryRunExitToMainERC20 =
            await dryRunCall(
                details, ethersProviderSChain,
                "TokenManagerERC20", joTokenManagerERC20,
                "exitToMainERC20", arrArgumentsExitToMainERC20,
                joAccountSrc, strActionName, isIgnoreExitToMainERC20,
                gasPrice, estimatedGasExitToMainERC20, weiHowMuchExitToMainERC20, null );
        if( strErrorOfDryRunExitToMainERC20 )
            throw new Error( strErrorOfDryRunExitToMainERC20 );
        opts.isCheckTransactionToSchain = true;
        const joReceiptExitToMainERC20 =
            await payedCall(
                details, ethersProviderSChain,
                "TokenManagerERC20", joTokenManagerERC20,
                "exitToMainERC20", arrArgumentsExitToMainERC20,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasExitToMainERC20, weiHowMuchExitToMainERC20, opts );
        if( joReceiptExitToMainERC20 && typeof joReceiptExitToMainERC20 == "object" ) {
            jarrReceipts.push( {
                "description": "doErc20PaymentFromSChain/exit-to-main",
                "receipt": joReceiptExitToMainERC20
            } );
        }
        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxySChain ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxySChain.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await sleep( gMillisecondsSleepBeforeFetchOutgoingMessageEvent );
            const joEvents =
                await getContractCallEvents(
                    details, strLogPrefix,
                    ethersProviderSChain, joMessageProxySChain, strEventName,
                    joReceiptExitToMainERC20.blockNumber, joReceiptExitToMainERC20.transactionHash,
                    joMessageProxySChain.filters[strEventName]() );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix + cc.success( "Success, verified the " ) +
                    cc.info( strEventName ) + cc.success( " event of the " ) +
                    cc.info( "MessageProxy" ) + cc.success( "/" ) +
                    cc.notice( joMessageProxySChain.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
                    joMessageProxySChain.address + " contract, no events found" );
            }
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "doErc20PaymentFromSChain", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-20 PAYMENT FROM S-CHAIN", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc20PaymentFromSChain", true );
    details.close();
    return true;
}

export async function doErc721PaymentFromSChain(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joTokenManagerERC721, // only s-chain
    joMessageProxySChain, // for checking logs
    joDepositBox, // only main net
    tokenId, // which ERC721 token id to send
    weiHowMuch, // how much ETH
    strCoinNameErc721MainNet,
    joErc721MainNet,
    strCoinNameErc721SChain,
    joErc721SChain,
    transactionCustomizerSChain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "S2M ERC721 Payment:" ) + " ";
    try {
        strActionName = "ERC721 payment from S-Chain, approve";
        const erc721ABI = joErc721SChain[strCoinNameErc721SChain + "_abi"];
        const erc721AddressSChain = joErc721SChain[strCoinNameErc721SChain + "_address"];
        const tokenManagerAddress = joTokenManagerERC721.address;
        const contractERC721 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc721AddressSChain, erc721ABI, ethersProviderSChain );
        const arrArgumentsApprove = [
            tokenManagerAddress,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const erc721AddressMainNet =
            joErc721MainNet[strCoinNameErc721MainNet + "_address"];
        const arrArgumentsExitToMainERC721 = [
            erc721AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasApprove =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchApprove, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(transfer from) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details, ethersProviderSChain,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const opts = { isCheckTransactionToSchain: true };
        const joReceiptApprove =
            await payedCall(
                details, ethersProviderSChain,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasApprove, weiHowMuchApprove, opts );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc721PaymentFromSChain/transfer-from",
                "receipt": joReceiptApprove
            } );
        }
        if( gMillisecondsSleepBetweenTransactionsOnSChain ) {
            details.write( cc.normal( "Sleeping " ) +
                cc.info( gMillisecondsSleepBetweenTransactionsOnSChain ) +
                cc.normal( " milliseconds between transactions..." ) + "\n" );
            await sleep( gMillisecondsSleepBetweenTransactionsOnSChain );
        }
        if( gFlagWaitForNextBlockOnSChain )
            await safeWaitForNextBlockToAppear( details, ethersProviderSChain );
        strActionName = "ERC721 payment from S-Chain, exitToMainERC721";
        const weiHowMuchExitToMainERC721 = undefined;
        gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasExitToMainERC721 =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "TokenManagerERC721", joTokenManagerERC721,
                "exitToMainERC721", arrArgumentsExitToMainERC721,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchExitToMainERC721, null );
        details.write( strLogPrefix +
            cc.debug( "Using estimated(exit to main) " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasExitToMainERC721 ) +
            "\n" );
        const isIgnoreExitToMainERC721 = true;
        const strErrorOfDryRunExitToMainERC721 =
            await dryRunCall(
                details, ethersProviderSChain,
                "TokenManagerERC721", joTokenManagerERC721,
                "exitToMainERC721", arrArgumentsExitToMainERC721,
                joAccountSrc, strActionName, isIgnoreExitToMainERC721, gasPrice,
                estimatedGasExitToMainERC721, weiHowMuchExitToMainERC721, null );
        if( strErrorOfDryRunExitToMainERC721 )
            throw new Error( strErrorOfDryRunExitToMainERC721 );
        opts.isCheckTransactionToSchain = true;
        const joReceiptExitToMainERC721 =
            await payedCall(
                details, ethersProviderSChain,
                "TokenManagerERC721", joTokenManagerERC721,
                "exitToMainERC721", arrArgumentsExitToMainERC721,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasExitToMainERC721, weiHowMuchExitToMainERC721, opts );
        if( joReceiptExitToMainERC721 && typeof joReceiptExitToMainERC721 == "object" ) {
            jarrReceipts.push( {
                "description": "doErc721PaymentFromSChain/exit-to-main",
                "receipt": joReceiptExitToMainERC721
            } );
        }
        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxySChain ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) +
                cc.info( strEventName ) + cc.debug( " event of the " ) + cc.info( "MessageProxy" ) +
                cc.debug( "/" ) + cc.notice( joMessageProxySChain.address ) +
                cc.debug( " contract ..." ) + "\n" );
            await sleep( gMillisecondsSleepBeforeFetchOutgoingMessageEvent );
            const joEvents =
                await getContractCallEvents(
                    details, strLogPrefix,
                    ethersProviderSChain, joMessageProxySChain, strEventName,
                    joReceiptExitToMainERC721.blockNumber,
                    joReceiptExitToMainERC721.transactionHash,
                    joMessageProxySChain.filters[strEventName]() );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix + cc.success( "Success, verified the " ) +
                    cc.info( strEventName ) + cc.success( " event of the " ) +
                    cc.info( "MessageProxy" ) + cc.success( "/" ) +
                    cc.notice( joMessageProxySChain.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
                    joMessageProxySChain.address + " contract, no events found" );
            }
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "doErc721PaymentFromSChain", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-721 PAYMENT FROM S-CHAIN", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc721PaymentFromSChain", true );
    details.close();
    return true;
}

export async function doErc1155PaymentFromSChain(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joTokenManagerERC1155, // only s-chain
    joMessageProxySChain, // for checking logs
    joDepositBox, // only main net
    tokenId, // which ERC1155 token id to send
    tokenAmount, // which ERC1155 token id to send
    weiHowMuch, // how much ETH
    strCoinNameErc1155SMainNet,
    joErc1155MainNet,
    strCoinNameErc1155SChain,
    joErc1155Chain,
    transactionCustomizerSChain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "S2M ERC1155 Payment:" ) + " ";
    try {
        strActionName = "ERC1155 payment from S-Chain, approve";
        const erc1155ABI = joErc1155Chain[strCoinNameErc1155SChain + "_abi"];
        const erc1155AddressSChain = joErc1155Chain[strCoinNameErc1155SChain + "_address"];
        const tokenManagerAddress = joTokenManagerERC1155.address;
        const contractERC1155 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc1155AddressSChain, erc1155ABI, ethersProviderSChain );
        const arrArgumentsApprove = [
            tokenManagerAddress,
            true
        ];
        const erc1155AddressMainNet =
            joErc1155MainNet[strCoinNameErc1155SMainNet + "_address"];
        const arrArgumentsExitToMainERC1155 = [
            erc1155AddressMainNet,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() ),
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenAmount ).toHexString() )
            // owaspUtils.ensureStartsWith0x( owaspUtils.toBN( weiHowMuch ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasApprove =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(transfer from) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const opts = { isCheckTransactionToSchain: true };
        const joReceiptApprove =
            await payedCall(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, estimatedGasApprove, weiHowMuchApprove,
                opts );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentFromSChain/transfer-from",
                "receipt": joReceiptApprove
            } );
        }
        if( gMillisecondsSleepBetweenTransactionsOnSChain ) {
            details.write( cc.normal( "Sleeping " ) +
                cc.info( gMillisecondsSleepBetweenTransactionsOnSChain ) +
                cc.normal( " milliseconds between transactions..." ) + "\n" );
            await sleep( gMillisecondsSleepBetweenTransactionsOnSChain );
        }
        if( gFlagWaitForNextBlockOnSChain )
            await safeWaitForNextBlockToAppear( details, ethersProviderSChain );
        strActionName = "ERC1155 payment from S-Chain, exitToMainERC1155";
        const weiHowMuchExitToMainERC1155 = undefined;
        gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasExitToMainERC1155 =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155", arrArgumentsExitToMainERC1155,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchExitToMainERC1155,
                null );
        details.write( strLogPrefix + cc.debug( "Using estimated(exit to main) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasExitToMainERC1155 ) +
            "\n" );
        const isIgnoreExitToMainERC1155 = true;
        const strErrorOfDryRunExitToMainERC1155 =
            await dryRunCall(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155", arrArgumentsExitToMainERC1155,
                joAccountSrc, strActionName, isIgnoreExitToMainERC1155,
                gasPrice, estimatedGasExitToMainERC1155, weiHowMuchExitToMainERC1155,
                null );
        if( strErrorOfDryRunExitToMainERC1155 )
            throw new Error( strErrorOfDryRunExitToMainERC1155 );
        opts.isCheckTransactionToSchain = true;
        const joReceiptExitToMainERC1155 =
            await payedCall(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155", arrArgumentsExitToMainERC1155,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasExitToMainERC1155, weiHowMuchExitToMainERC1155, opts );
        if( joReceiptExitToMainERC1155 && typeof joReceiptExitToMainERC1155 == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentFromSChain/exit-to-main",
                "receipt": joReceiptExitToMainERC1155
            } );
        }
        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxySChain ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxySChain.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await sleep( gMillisecondsSleepBeforeFetchOutgoingMessageEvent );
            const joEvents =
                await getContractCallEvents(
                    details, strLogPrefix,
                    ethersProviderSChain, joMessageProxySChain, strEventName,
                    joReceiptExitToMainERC1155.blockNumber,
                    joReceiptExitToMainERC1155.transactionHash,
                    joMessageProxySChain.filters[strEventName]() );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix + cc.success( "Success, verified the " ) +
                    cc.info( strEventName ) + cc.success( " event of the " ) +
                    cc.info( "MessageProxy" ) + cc.success( "/" ) +
                    cc.notice( joMessageProxySChain.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
                    joMessageProxySChain.address + " contract, no events found" );
            }
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "doErc1155PaymentFromSChain", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-1155 PAYMENT FROM S-CHAIN", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc1155PaymentFromSChain", true );
    details.close();
    return true;
}

export async function doErc1155BatchPaymentFromSChain(
    ethersProviderMainNet,
    ethersProviderSChain,
    chainIdMainNet,
    chainIdSChain,
    joAccountSrc,
    joAccountDst,
    joTokenManagerERC1155, // only s-chain
    joMessageProxySChain, // for checking logs
    joDepositBox, // only main net
    arrTokenIds, // which ERC1155 token ids to send
    arrTokenAmounts, // which ERC1155 token amounts to send
    weiHowMuch, // how much ETH
    strCoinNameErc1155SMainNet,
    joErc1155MainNet,
    strCoinNameErc1155SChain,
    joErc1155Chain,
    transactionCustomizerSChain
) {
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix = cc.info( "S2M ERC1155 Batch Payment:" ) + " ";
    try {
        strActionName = "ERC1155 payment from S-Chain, approve";
        const erc1155ABI = joErc1155Chain[strCoinNameErc1155SChain + "_abi"];
        const erc1155AddressSChain = joErc1155Chain[strCoinNameErc1155SChain + "_address"];
        const tokenManagerAddress = joTokenManagerERC1155.address;
        const contractERC1155 =
            new owaspUtils.ethersMod.ethers.Contract(
                erc1155AddressSChain, erc1155ABI, ethersProviderSChain );
        const arrArgumentsApprove = [
            tokenManagerAddress,
            true
        ];
        const erc1155AddressMainNet =
            joErc1155MainNet[strCoinNameErc1155SMainNet + "_address"];
        const arrArgumentsExitToMainERC1155Batch = [
            erc1155AddressMainNet,
            arrTokenIds,
            arrTokenAmounts
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasApprove =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(transfer from) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const opts = { isCheckTransactionToSchain: true };
        const joReceiptApprove =
            await payedCall(
                details, ethersProviderSChain,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, estimatedGasApprove, weiHowMuchApprove,
                opts );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description":
                    "doErc1155BatchPaymentFromSChain/transfer-from",
                "receipt": joReceiptApprove
            } );
        }
        if( gMillisecondsSleepBetweenTransactionsOnSChain ) {
            details.write( cc.normal( "Sleeping " ) +
                cc.info( gMillisecondsSleepBetweenTransactionsOnSChain ) +
                cc.normal( " milliseconds between transactions..." ) + "\n" );
            await sleep( gMillisecondsSleepBetweenTransactionsOnSChain );
        }
        if( gFlagWaitForNextBlockOnSChain )
            await safeWaitForNextBlockToAppear( details, ethersProviderSChain );
        strActionName = "ERC1155 batch-payment from S-Chain, exitToMainERC1155Batch";
        const weiHowMuchExitToMainERC1155Batch = undefined;
        gasPrice = await transactionCustomizerSChain.computeGasPrice(
            ethersProviderSChain, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasExitToMainERC1155Batch =
            await transactionCustomizerSChain.computeGas(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155Batch", arrArgumentsExitToMainERC1155Batch,
                joAccountSrc, strActionName, gasPrice, 8000000,
                weiHowMuchExitToMainERC1155Batch, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(exit to main) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasExitToMainERC1155Batch ) +
            "\n" );
        const isIgnoreExitToMainERC1155Batch = true;
        const strErrorOfDryRunExitToMainERC1155Batch =
            await dryRunCall(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155Batch", arrArgumentsExitToMainERC1155Batch,
                joAccountSrc, strActionName, isIgnoreExitToMainERC1155Batch, gasPrice,
                estimatedGasExitToMainERC1155Batch, weiHowMuchExitToMainERC1155Batch, null );
        if( strErrorOfDryRunExitToMainERC1155Batch )
            throw new Error( strErrorOfDryRunExitToMainERC1155Batch );
        opts.isCheckTransactionToSchain = true;
        const joReceiptExitToMainERC1155Batch =
            await payedCall(
                details, ethersProviderSChain,
                "TokenManagerERC1155", joTokenManagerERC1155,
                "exitToMainERC1155Batch", arrArgumentsExitToMainERC1155Batch,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasExitToMainERC1155Batch, weiHowMuchExitToMainERC1155Batch, opts );
        if( joReceiptExitToMainERC1155Batch &&
            typeof joReceiptExitToMainERC1155Batch == "object"
        ) {
            jarrReceipts.push( {
                "description": "doErc1155BatchPaymentFromSChain/exit-to-main",
                "receipt": joReceiptExitToMainERC1155Batch
            } );
        }
        // Must-have event(s) analysis as indicator(s) of success
        const strEventName = "OutgoingMessage";
        if( joMessageProxySChain ) {
            details.write( strLogPrefix + cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                cc.debug( " event of the " ) + cc.info( "MessageProxy" ) + cc.debug( "/" ) +
                cc.notice( joMessageProxySChain.address ) + cc.debug( " contract ..." ) +
                "\n" );
            await sleep( gMillisecondsSleepBeforeFetchOutgoingMessageEvent );
            const joEvents =
                await getContractCallEvents(
                    details, strLogPrefix,
                    ethersProviderSChain, joMessageProxySChain, strEventName,
                    joReceiptExitToMainERC1155Batch.blockNumber,
                    joReceiptExitToMainERC1155Batch.transactionHash,
                    joMessageProxySChain.filters[strEventName]() );
            if( joEvents.length > 0 ) {
                details.write( strLogPrefix + cc.success( "Success, verified the " ) +
                    cc.info( strEventName ) + cc.success( " event of the " ) +
                    cc.info( "MessageProxy" ) + cc.success( "/" ) +
                    cc.notice( joMessageProxySChain.address ) +
                    cc.success( " contract, found event(s): " ) + cc.j( joEvents ) + "\n" );
            } else {
                throw new Error(
                    "Verification failed for the \"OutgoingMessage\" event " +
                        "of the \"MessageProxy\"/" +
                    joMessageProxySChain.address + " contract, no events found" );
            }
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo( log, "doErc1155BatchPaymentFromSChain", false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-1155 PAYMENT FROM S-CHAIN", jarrReceipts, details );
    if( log.exposeDetailsGet() )
        details.exposeDetailsTo( log, "doErc1155BatchPaymentFromSChain", true );
    details.close();
    return true;
}

export async function doErc20PaymentS2S(
    isForward,
    ethersProviderSrc,
    chainIdSrc,
    strChainNameDst,
    joAccountSrc,
    joTokenManagerERC20Src,
    nAmountOfToken, // how much ERC20 tokens to send
    nAmountOfWei, // how much to send
    strCoinNameErc20Src,
    joSrcErc20,
    ercDstAddress20, // only reverse payment needs it
    tc
) {
    const isReverse = isForward ? false : true;
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix =
        cc.info( "S2S ERC20 Payment(" + ( isForward ? "forward" : "reverse" ) + "):" ) + " ";
    try {
        strActionName =
            "validateArgs/doErc20PaymentS2S/" + ( isForward ? "forward" : "reverse" );
        if( ! ethersProviderSrc )
            throw new Error( "No ethers provider specified for source of transfer" );
        if( ! strChainNameDst )
            throw new Error( "No destination chain name provided" );
        if( ! joAccountSrc )
            throw new Error( "No account or sign TX way provided" );
        if( ! strCoinNameErc20Src )
            throw new Error( "Need full source ERC20 information, like ABI" );
        if( ! joSrcErc20 )
            throw new Error( "No source ERC20 ABI provided" );
        if( isReverse ) {
            if( ! ercDstAddress20 )
                throw new Error( "No destination ERC20 address provided" );
        }
        if( ! tc )
            throw new Error( "No transaction customizer provided" );
        const ercSrcAbi20 = joSrcErc20[strCoinNameErc20Src + "_abi"];
        const ercSrcAddress20 = joSrcErc20[strCoinNameErc20Src + "_address"];
        details.write( strLogPrefix + cc.attention( "Token Manager ERC20" ) +
            cc.debug( " address on source chain...." ) +
            cc.note( joTokenManagerERC20Src.address ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC20" ) +
            cc.debug( " coin name........................." ) +
            cc.note( strCoinNameErc20Src ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC20" ) +
            cc.debug( " token address....................." ) +
            cc.note( ercSrcAddress20 ) + "\n" );
        if( isReverse || ercDstAddress20 ) {
            details.write( strLogPrefix + cc.attention( "Destination ERC20" ) +
                cc.debug( " token address................" ) +
                cc.note( ercDstAddress20 ) + "\n" );
        }
        details.write( strLogPrefix + cc.attention( "Destination chain name" ) +
            cc.debug( "........................." ) +
            cc.note( strChainNameDst ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Amount of tokens" ) +
            cc.debug( " to transfer..................." ) +
            cc.note( nAmountOfToken ) + "\n" );
        strActionName = "ERC20 payment S2S, approve, " + ( isForward ? "forward" : "reverse" );
        const contractERC20 =
            new owaspUtils.ethersMod.ethers.Contract(
                ercSrcAddress20, ercSrcAbi20, ethersProviderSrc );
        const arrArgumentsApprove = [
            joTokenManagerERC20Src.address,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmountOfToken ).toHexString() )
        ];
        const arrArgumentsTransfer = [
            strChainNameDst,
            isReverse ? ercDstAddress20 : ercSrcAddress20,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmountOfToken ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasApprove =
            await tc.computeGas(
                details, ethersProviderSrc,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details, ethersProviderSrc,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await payedCall(
                details, ethersProviderSrc,
                "ERC20", contractERC20, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description":
                    "doErc20PaymentS2S/approve/" + ( isForward ? "forward" : "reverse" ),
                "receipt": joReceiptApprove
            } );
        }
        strActionName =
            "ERC20 payment S2S, transferERC20 " + ( isForward ? "forward" : "reverse" );
        const weiHowMuchTransferERC20 = undefined;
        gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasTransfer =
            await tc.computeGas(
                details, ethersProviderSrc,
                "TokenManagerERC20", joTokenManagerERC20Src,
                "transferToSchainERC20", arrArgumentsTransfer,
                joAccountSrc, strActionName, gasPrice,
                8000000, weiHowMuchTransferERC20, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(transfer) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasTransfer ) + "\n" );
        const isIgnoreTransferERC20 = true;
        const strErrorOfDryRunTransferERC20 =
            await dryRunCall(
                details, ethersProviderSrc,
                "TokenManagerERC20", joTokenManagerERC20Src,
                "transferToSchainERC20", arrArgumentsTransfer,
                joAccountSrc, strActionName, isIgnoreTransferERC20,
                gasPrice, estimatedGasTransfer, weiHowMuchTransferERC20, null );
        if( strErrorOfDryRunTransferERC20 )
            throw new Error( strErrorOfDryRunTransferERC20 );
        const joReceiptTransfer =
            await payedCall(
                details, ethersProviderSrc,
                "TokenManagerERC20", joTokenManagerERC20Src,
                "transferToSchainERC20", arrArgumentsTransfer,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasTransfer, weiHowMuchTransferERC20, null );
        if( joReceiptTransfer && typeof joReceiptTransfer == "object" ) {
            jarrReceipts.push( {
                "description": "doErc20PaymentS2S/transfer",
                "receipt": joReceiptTransfer
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo(
            log, "doErc20PaymentS2S/" + ( isForward ? "forward" : "reverse" ), false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-20 PAYMENT FROM S2S/" +
        ( isForward ? "forward" : "reverse" ), jarrReceipts, details );
    if( log.exposeDetailsGet() ) {
        details.exposeDetailsTo(
            log, "doErc20PaymentS2S/" + ( isForward ? "forward" : "reverse" ), true );
    }
    details.close();
    return true;
}

export async function doErc721PaymentS2S(
    isForward,
    ethersProviderSrc,
    chainIdSrc,
    strChainNameDst,
    joAccountSrc,
    joTokenManagerERC721Src,
    tokenId, // which ERC721 token id to send
    nAmountOfWei, // how much to send
    strCoinNameErc721Src,
    joSrcErc721,
    ercDstAddress721, // only reverse payment needs it
    tc
) {
    const isReverse = isForward ? false : true;
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix =
        cc.info( "S2S ERC721 Payment(" + ( isForward ? "forward" : "reverse" ) + "):" ) + " ";
    try {
        strActionName =
            "validateArgs/doErc721PaymentS2S/" + ( isForward ? "forward" : "reverse" );
        if( ! ethersProviderSrc )
            throw new Error( "No provider for source of transfer" );
        if( ! strChainNameDst )
            throw new Error( "No destination chain name provided" );
        if( ! joAccountSrc )
            throw new Error( "No account or sign TX way provided" );
        if( ! strCoinNameErc721Src )
            throw new Error( "Need full source ERC721 information, like ABI" );
        if( ! joSrcErc721 )
            throw new Error( "No source ERC721 ABI provided" );
        if( isReverse ) {
            if( ! ercDstAddress721 )
                throw new Error( "No destination ERC721 address provided" );
        }
        if( ! tc )
            throw new Error( "No transaction customizer provided" );
        const ercSrcAbi721 = joSrcErc721[strCoinNameErc721Src + "_abi"];
        const ercSrcAddress721 = joSrcErc721[strCoinNameErc721Src + "_address"];
        details.write( strLogPrefix + cc.attention( "Token Manager ERC721" ) +
            cc.debug( " address on source chain...." ) +
            cc.note( joTokenManagerERC721Src.address ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC721" ) +
            cc.debug( " coin name........................." ) +
            cc.note( strCoinNameErc721Src ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC721" ) +
            cc.debug( " token address....................." ) +
            cc.note( ercSrcAddress721 ) + "\n" );
        if( isReverse || ercDstAddress721 ) {
            details.write( strLogPrefix + cc.attention( "Destination ERC721" ) +
                cc.debug( " token address................" ) +
                cc.note( ercDstAddress721 ) + "\n" );
        }
        details.write( strLogPrefix + cc.attention( "Destination chain name" ) +
            cc.debug( "........................." ) + cc.note( strChainNameDst ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Token ID" ) +
            cc.debug( " to transfer..........................." ) + cc.note( tokenId ) + "\n" );
        strActionName = "ERC721 payment S2S, approve, " + ( isForward ? "forward" : "reverse" );
        const contractERC721 =
            new owaspUtils.ethersMod.ethers.Contract(
                ercSrcAddress721, ercSrcAbi721, ethersProviderSrc );
        const arrArgumentsApprove = [
            joTokenManagerERC721Src.address,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const arrArgumentsTransfer = [
            strChainNameDst,
            isReverse ? ercDstAddress721 : ercSrcAddress721,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasApprove =
            await tc.computeGas(
                details, ethersProviderSrc,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details, ethersProviderSrc,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await payedCall(
                details, ethersProviderSrc,
                "ERC721", contractERC721, "approve", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description":
                    "doErc721PaymentS2S/approve/" + ( isForward ? "forward" : "reverse" ),
                "receipt": joReceiptApprove
            } );
        }
        const isIgnoreTransferERC721 = true;
        strActionName =
            "ERC721 payment S2S, transferERC721 " + ( isForward ? "forward" : "reverse" );
        const weiHowMuchTransferERC721 = undefined;
        gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasTransfer =
            await tc.computeGas(
                details, ethersProviderSrc,
                "TokenManagerERC721", joTokenManagerERC721Src,
                "transferToSchainERC721", arrArgumentsTransfer,
                joAccountSrc, strActionName, isIgnoreTransferERC721,
                gasPrice, 8000000, weiHowMuchTransferERC721, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(transfer) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasTransfer ) + "\n" );
        const strErrorOfDryRunTransferERC721 =
            await dryRunCall(
                details, ethersProviderSrc,
                "TokenManagerERC721", joTokenManagerERC721Src,
                "transferToSchainERC721", arrArgumentsTransfer,
                joAccountSrc, strActionName, isIgnoreTransferERC721,
                gasPrice, estimatedGasTransfer, weiHowMuchTransferERC721, null );
        if( strErrorOfDryRunTransferERC721 )
            throw new Error( strErrorOfDryRunTransferERC721 );
        const joReceiptTransfer =
            await payedCall(
                details, ethersProviderSrc,
                "TokenManagerERC721", joTokenManagerERC721Src,
                "transferToSchainERC721", arrArgumentsTransfer,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasTransfer, weiHowMuchTransferERC721, null );
        if( joReceiptTransfer && typeof joReceiptTransfer == "object" ) {
            jarrReceipts.push( {
                "description": "doErc721PaymentS2S/transfer",
                "receipt": joReceiptTransfer
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo(
            log,
            "doErc721PaymentS2S/" + ( isForward ? "forward" : "reverse" ), false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-721 PAYMENT FROM S2S/" +
        ( isForward ? "forward" : "reverse" ), jarrReceipts, details
    );
    if( log.exposeDetailsGet() ) {
        details.exposeDetailsTo(
            log,
            "doErc721PaymentS2S/" + ( isForward ? "forward" : "reverse" ),
            true );
    }
    details.close();
    return true;
}

export async function doErc1155PaymentS2S(
    isForward,
    ethersProviderSrc,
    chainIdSrc,
    strChainNameDst,
    joAccountSrc,
    joTokenManagerERC1155Src,
    tokenId, // which ERC721 token id to send
    nAmountOfToken, // how much ERC1155 tokens to send
    nAmountOfWei, // how much to send
    strCoinNameErc1155Src,
    joSrcErc1155,
    ercDstAddress1155, // only reverse payment needs it
    tc
) {
    const isReverse = isForward ? false : true;
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix =
        cc.info( "S2S ERC1155 Payment(" + ( isForward ? "forward" : "reverse" ) + "):" ) + " ";
    try {
        strActionName =
            "validateArgs/doErc1155PaymentS2S/" + ( isForward ? "forward" : "reverse" );
        if( ! ethersProviderSrc )
            throw new Error( "No provider for source of transfer" );
        if( ! strChainNameDst )
            throw new Error( "No destination chain name provided" );
        if( ! joAccountSrc )
            throw new Error( "No account or sign TX way provided" );
        if( ! strCoinNameErc1155Src )
            throw new Error( "Need full source ERC1155 information, like ABI" );
        if( ! joSrcErc1155 )
            throw new Error( "No source ERC1155 ABI provided" );
        if( isReverse ) {
            if( ! ercDstAddress1155 )
                throw new Error( "No destination ERC1155 address provided" );
        }
        if( ! tc )
            throw new Error( "No transaction customizer provided" );
        const ercSrcAbi1155 = joSrcErc1155[strCoinNameErc1155Src + "_abi"];
        const ercSrcAddress1155 = joSrcErc1155[strCoinNameErc1155Src + "_address"];
        details.write( strLogPrefix + cc.attention( "Token Manager ERC1155" ) +
            cc.debug( " address on source chain...." ) +
            cc.note( joTokenManagerERC1155Src.address ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC1155" ) +
            cc.debug( " coin name........................." ) +
            cc.note( strCoinNameErc1155Src ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC1155" ) +
            cc.debug( " token address....................." ) +
            cc.note( ercSrcAddress1155 ) + "\n" );
        if( isReverse || ercDstAddress1155 ) {
            details.write( strLogPrefix + cc.attention( "Destination ERC1155" ) +
                cc.debug( " token address................" ) +
                cc.note( ercDstAddress1155 ) + "\n" );
        }
        details.write( strLogPrefix + cc.attention( "Destination chain name" ) +
            cc.debug( "........................." ) + cc.note( strChainNameDst ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Token ID" ) +
            cc.debug( " to transfer..........................." ) + cc.note( tokenId ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Amount of tokens" ) +
            cc.debug( " to transfer..................." ) + cc.note( nAmountOfToken ) + "\n" );
        strActionName = "ERC1155 payment S2S, approve, " + ( isForward ? "forward" : "reverse" );
        const contractERC1155 =
            new owaspUtils.ethersMod.ethers.Contract(
                ercSrcAddress1155, ercSrcAbi1155, ethersProviderSrc );
        const arrArgumentsApprove = [
            joTokenManagerERC1155Src.address,
            true
        ];
        const arrArgumentsTransfer = [
            strChainNameDst,
            isReverse ? ercDstAddress1155 : ercSrcAddress1155,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( tokenId ).toHexString() ),
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmountOfToken ).toHexString() )
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasApprove =
            await tc.computeGas(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await payedCall(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice,
                estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description":
                    "doErc1155PaymentS2S/approve/" + ( isForward ? "forward" : "reverse" ),
                "receipt": joReceiptApprove
            } );
        }
        strActionName =
            "ERC1155 payment S2S, transferERC1155 " + ( isForward ? "forward" : "reverse" );
        const weiHowMuchTransferERC1155 = undefined;
        gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasTransfer =
            await tc.computeGas(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155", arrArgumentsTransfer,
                joAccountSrc, strActionName, gasPrice,
                8000000, weiHowMuchTransferERC1155, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(transfer) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasTransfer ) + "\n" );
        const isIgnoreTransferERC1155 = true;
        const strErrorOfDryRunTransferERC1155 =
            await dryRunCall(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155", arrArgumentsTransfer,
                joAccountSrc, strActionName, isIgnoreTransferERC1155, gasPrice,
                estimatedGasTransfer, weiHowMuchTransferERC1155, null );
        if( strErrorOfDryRunTransferERC1155 )
            throw new Error( strErrorOfDryRunTransferERC1155 );
        const joReceiptTransfer =
            await payedCall(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155", arrArgumentsTransfer,
                joAccountSrc, strActionName, gasPrice, estimatedGasTransfer,
                weiHowMuchTransferERC1155, null );
        if( joReceiptTransfer && typeof joReceiptTransfer == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentS2S/transfer",
                "receipt": joReceiptTransfer
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Payment error in " +
                strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo(
            log, "doErc1155PaymentS2S/" + ( isForward ? "forward" : "reverse" ), false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-1155 PAYMENT FROM S2S/" +
        ( isForward ? "forward" : "reverse" ), jarrReceipts, details );
    if( log.exposeDetailsGet() ) {
        details.exposeDetailsTo(
            log, "doErc1155PaymentS2S/" + ( isForward ? "forward" : "reverse" ), true );
    }
    details.close();
    return true;
}

export async function doErc1155BatchPaymentS2S(
    isForward,
    ethersProviderSrc,
    chainIdSrc,
    strChainNameDst,
    joAccountSrc,
    joTokenManagerERC1155Src,
    arrTokenIds, // which ERC1155 token id to send
    arrTokenAmounts, // which ERC1155 token id to send
    nAmountOfWei, // how much to send
    strCoinNameErc1155Src,
    joSrcErc1155,
    ercDstAddress1155, // only reverse payment needs it
    tc
) {
    const isReverse = isForward ? false : true;
    const details = log.createMemoryStream();
    const jarrReceipts = [];
    let strActionName = "";
    const strLogPrefix =
        cc.info( "S2S Batch ERC1155 Payment(" +
            ( isForward ? "forward" : "reverse" ) + "):" ) + " ";
    try {
        strActionName =
            "validateArgs/doErc1155BatchPaymentS2S/" +
                ( isForward ? "forward" : "reverse" );
        if( ! ethersProviderSrc )
            throw new Error( "No provider for source of transfer" );
        if( ! strChainNameDst )
            throw new Error( "No destination chain name provided" );
        if( ! joAccountSrc )
            throw new Error( "No account or sign TX way provided" );
        if( ! strCoinNameErc1155Src )
            throw new Error( "Need full source ERC1155 information, like ABI" );
        if( ! joSrcErc1155 )
            throw new Error( "No source ERC1155 ABI provided" );
        if( isReverse ) {
            if( ! ercDstAddress1155 )
                throw new Error( "No destination ERC1155 address provided" );
        }
        if( ! tc )
            throw new Error( "No transaction customizer provided" );
        const ercSrcAbi1155 = joSrcErc1155[strCoinNameErc1155Src + "_abi"];
        const ercSrcAddress1155 = joSrcErc1155[strCoinNameErc1155Src + "_address"];
        details.write( strLogPrefix + cc.attention( "Token Manager ERC1155" ) +
            cc.debug( " address on source chain...." ) +
            cc.note( joTokenManagerERC1155Src.address ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC1155" ) +
            cc.debug( " coin name........................." ) +
            cc.note( strCoinNameErc1155Src ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Source ERC1155" ) +
            cc.debug( " token address....................." ) +
            cc.note( ercSrcAddress1155 ) + "\n" );
        if( isReverse || ercDstAddress1155 ) {
            details.write( strLogPrefix + cc.attention( "Destination ERC1155" ) +
                cc.debug( " token address................" ) +
                cc.note( ercDstAddress1155 ) + "\n" );
        }
        details.write( strLogPrefix + cc.attention( "Destination chain name" ) +
            cc.debug( "........................." ) + cc.note( strChainNameDst ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Token IDs" ) +
            cc.debug( " to transfer.........................." ) + cc.j( arrTokenIds ) + "\n" );
        details.write( strLogPrefix + cc.attention( "Amounts of tokens" ) +
            cc.debug( " to transfer.................." ) + cc.j( arrTokenAmounts ) + "\n" );
        strActionName =
            "ERC1155 batch-payment S2S, approve, " + ( isForward ? "forward" : "reverse" );
        const contractERC1155 =
            new owaspUtils.ethersMod.ethers.Contract(
                ercSrcAddress1155, ercSrcAbi1155, ethersProviderSrc );
        const arrArgumentsApprove = [
            joTokenManagerERC1155Src.address,
            true
        ];
        const arrArgumentsTransfer = [
            strChainNameDst,
            isReverse ? ercDstAddress1155 : ercSrcAddress1155,
            arrTokenIds,
            arrTokenAmounts
        ];
        const weiHowMuchApprove = undefined;
        let gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasApprove =
            await tc.computeGas(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, gasPrice, 8000000, weiHowMuchApprove, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(approve) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasApprove ) + "\n" );
        const isIgnoreApprove = false;
        const strErrorOfDryRunApprove =
            await dryRunCall(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName, isIgnoreApprove,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( strErrorOfDryRunApprove )
            throw new Error( strErrorOfDryRunApprove );
        const joReceiptApprove =
            await payedCall(
                details, ethersProviderSrc,
                "ERC1155", contractERC1155, "setApprovalForAll", arrArgumentsApprove,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasApprove, weiHowMuchApprove, null );
        if( joReceiptApprove && typeof joReceiptApprove == "object" ) {
            jarrReceipts.push( {
                "description":
                    "doErc1155BatchPaymentS2S/approve/" +
                        ( isForward ? "forward" : "reverse" ),
                "receipt": joReceiptApprove
            } );
        }
        strActionName =
            "ERC1155 batch-payment S2S, transferERC1155 " + ( isForward ? "forward" : "reverse" );
        const weiHowMuchTransferERC1155 = undefined;
        gasPrice = await tc.computeGasPrice( ethersProviderSrc, 200000000000 );
        details.write( strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasTransfer =
            await tc.computeGas(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155Batch", arrArgumentsTransfer,
                joAccountSrc, strActionName,
                gasPrice, 8000000, weiHowMuchTransferERC1155, null );
        details.write( strLogPrefix + cc.debug( "Using estimated(transfer) " ) +
            cc.info( "gas" ) + cc.debug( "=" ) + cc.notice( estimatedGasTransfer ) + "\n" );
        const isIgnoreTransferERC1155 = true;
        const strErrorOfDryRunTransferERC1155 =
            await dryRunCall(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155Batch", arrArgumentsTransfer,
                joAccountSrc, strActionName, isIgnoreTransferERC1155,
                gasPrice, estimatedGasTransfer, weiHowMuchTransferERC1155, null );
        if( strErrorOfDryRunTransferERC1155 )
            throw new Error( strErrorOfDryRunTransferERC1155 );
        const joReceiptTransfer =
            await payedCall(
                details, ethersProviderSrc,
                "TokenManagerERC1155", joTokenManagerERC1155Src,
                "transferToSchainERC1155Batch", arrArgumentsTransfer,
                joAccountSrc, strActionName,
                gasPrice, estimatedGasTransfer, weiHowMuchTransferERC1155, null );
        if( joReceiptTransfer && typeof joReceiptTransfer == "object" ) {
            jarrReceipts.push( {
                "description": "doErc1155PaymentS2S/transfer",
                "receipt": joReceiptTransfer
            } );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            const s = strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Payment error in " + strActionName + ": " ) + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
            if( log.id != details.id )
                log.write( s );
            details.write( s );
        }
        details.exposeDetailsTo(
            log, "doErc1155BatchPaymentS2S/" + ( isForward ? "forward" : "reverse" ), false );
        details.close();
        return false;
    }
    printGasUsageReportFromArray( "ERC-1155-batch PAYMENT FROM S2S/" +
        ( isForward ? "forward" : "reverse" ), jarrReceipts, details );
    if( log.exposeDetailsGet() ) {
        details.exposeDetailsTo(
            log, "doErc1155BatchPaymentS2S/" + ( isForward ? "forward" : "reverse" ), true );
    }
    details.close();
    return true;
}

async function findOutReferenceLogRecord(
    details, strLogPrefix,
    ethersProvider, joMessageProxy,
    bnBlockId, nMessageNumberToFind, isVerbose
) {
    const bnMessageNumberToFind = owaspUtils.toBN( nMessageNumberToFind.toString() );
    const strEventName = "PreviousMessageReference";
    const arrLogRecords =
        await safeGetPastEventsProgressive(
            details, strLogPrefix,
            ethersProvider, 10, joMessageProxy, strEventName,
            bnBlockId, bnBlockId, joMessageProxy.filters[strEventName]()
        );
    const cntLogRecord = arrLogRecords.length;
    if( isVerbose ) {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( strLogPrefix + cc.debug( "Got " ) + cc.info( cntLogRecord ) +
                cc.debug( " log record(s) (" ) + cc.info( strEventName ) +
                cc.debug( ") with data: " ) + cc.j( arrLogRecords ) + "\n" );
        }
    }
    for( let idxLogRecord = 0; idxLogRecord < cntLogRecord; ++ idxLogRecord ) {
        const joEvent = arrLogRecords[idxLogRecord];
        const eventValuesByName = {
            "currentMessage": joEvent.args[0],
            "previousOutgoingMessageBlockId": joEvent.args[1]
        };
        const joReferenceLogRecord = {
            "currentMessage": eventValuesByName.currentMessage,
            "previousOutgoingMessageBlockId":
                eventValuesByName.previousOutgoingMessageBlockId,
            "currentBlockId": bnBlockId
        };
        const bnCurrentMessage =
            owaspUtils.toBN( joReferenceLogRecord.currentMessage.toString() );
        if( bnCurrentMessage.eq( bnMessageNumberToFind ) ) {
            if( isVerbose ) {
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    details.write( strLogPrefix + cc.success( "Found " ) + cc.info( strEventName ) +
                        cc.success( " log record " ) + cc.j( joReferenceLogRecord ) +
                        cc.success( " for message " ) + cc.info( nMessageNumberToFind ) + "\n" );
                }
            }
            return joReferenceLogRecord;
        }
    }
    if( isVerbose ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            details.write( strLogPrefix + cc.error( "Failed to find " ) + cc.info( strEventName ) +
                cc.error( " log record for message " ) + cc.info( nMessageNumberToFind ) + "\n" );
        }
    }
    return null;
}

async function findOutAllReferenceLogRecords(
    details, strLogPrefix,
    ethersProvider, joMessageProxy,
    bnBlockId, nIncMsgCnt, nOutMsgCnt, isVerbose
) {
    if( isVerbose ) {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            details.write( strLogPrefix +
                cc.debug( "Optimized IMA message search algorithm will start at block " ) +
                cc.info( bnBlockId.toString() ) +
                cc.debug( ", will search for outgoing message counter " ) +
                cc.info( nOutMsgCnt.toString() ) +
                cc.debug( " and approach down to incoming message counter " ) +
                cc.info( nIncMsgCnt.toString() ) + "\n" );
        }
    }
    const arrLogRecordReferences = [];
    const cntExpected = nOutMsgCnt - nIncMsgCnt;
    if( cntExpected <= 0 ) {
        if( isVerbose ) {
            if( log.verboseGet() >= log.verboseReversed().information ) {
                details.write( strLogPrefix +
                    cc.success( "Optimized IMA message search algorithm success, " +
                        "nothing to search, result is empty" ) + "\n" );
            }
        }
        return arrLogRecordReferences; // nothing to search
    }
    let nWalkMsgNumber = nOutMsgCnt - 1;
    let nWalkBlockId = bnBlockId;
    for( ; nWalkMsgNumber >= nIncMsgCnt; -- nWalkMsgNumber ) {
        const joReferenceLogRecord =
            await findOutReferenceLogRecord(
                details, strLogPrefix,
                ethersProvider, joMessageProxy,
                nWalkBlockId, nWalkMsgNumber, isVerbose
            );
        if( joReferenceLogRecord == null )
            break;
        nWalkBlockId = owaspUtils.toBN( joReferenceLogRecord.previousOutgoingMessageBlockId );
        arrLogRecordReferences.unshift( joReferenceLogRecord );
    }
    const cntFound = arrLogRecordReferences.length;
    if( cntFound != cntExpected ) {
        if( isVerbose ) {
            if( log.verboseGet() >= log.verboseReversed().error ) {
                details.write( strLogPrefix +
                    cc.error( "Optimized IMA message search algorithm fail, found " ) +
                    cc.info( cntFound ) +
                    cc.error( " log record(s), expected " ) + cc.info( cntExpected ) +
                    cc.error( " log record(s), found records are: " ) +
                    cc.j( arrLogRecordReferences ) + "\n" );
            }
        }
    } else {
        if( isVerbose ) {
            if( log.verboseGet() >= log.verboseReversed().debug ) {
                details.write( strLogPrefix +
                    cc.success( "Optimized IMA message search algorithm success, found all " ) +
                    cc.info( cntFound ) + cc.success( " log record(s): " ) +
                    cc.j( arrLogRecordReferences ) + "\n" );
            }
        }
    }
    return arrLogRecordReferences;
}

let gTransferLoopCounter = 0;

// Do real money movement from main-net to S-chain by sniffing events
// 1) main-net.MessageProxyForMainnet.getOutgoingMessagesCounter -> save to nOutMsgCnt
// 2) S-chain.MessageProxySchain.getIncomingMessagesCounter -> save to nIncMsgCnt
// 3) Will transfer all in range from [ nIncMsgCnt ... (nOutMsgCnt-1) ] ...
//    assume current counter index is nIdxCurrentMsg
//
// One transaction transfer is:
// 1) Find events main-net.MessageProxyForMainnet.OutgoingMessage
//    where msgCounter member is in range
// 2) Publish it to S-chain.MessageProxySchain.postIncomingMessages(
//            main-net chain id   // uint64 srcChainID
//            nIdxCurrentMsg // uint64 startingCounter
//            [srcContract]  // address[] memory senders
//            [dstContract]  // address[] memory dstContracts
//            [to]           // address[] memory to
//            [amount]       // uint256[] memory amount / *uint256[2] memory blsSignature* /
//            )
async function doQueryOutgoingMessageCounter( optsTransfer ) {
    let nPossibleIntegerValue = 0;
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsTransfer.details.write( optsTransfer.strLogPrefixShort +
            cc.info( "SRC " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) +
            cc.bright( optsTransfer.joMessageProxySrc.address ) +
            "\n" );
        optsTransfer.details.write( optsTransfer.strLogPrefixShort +
            cc.info( "DST " ) + cc.sunny( "MessageProxy" ) + cc.info( " address is....." ) +
            cc.bright( optsTransfer.joMessageProxyDst.address ) +
            "\n" );
    }
    optsTransfer.strActionName = "src-chain.MessageProxy.getOutgoingMessagesCounter()";
    try {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.debug( "Will call " ) + cc.notice( optsTransfer.strActionName ) +
                cc.debug( "..." ) +
                "\n" );
        }
        nPossibleIntegerValue =
            await optsTransfer.joMessageProxySrc.callStatic.getOutgoingMessagesCounter(
                optsTransfer.chainNameDst,
                { from: optsTransfer.joAccountSrc.address() } );
        if( !owaspUtils.validateInteger( nPossibleIntegerValue ) ) {
            throw new Error(
                "DST chain " + optsTransfer.chainNameDst +
                " returned outgoing message counter " +
                nPossibleIntegerValue + " which is not a valid integer"
            );
        }
        optsTransfer.nOutMsgCnt = owaspUtils.toInteger( nPossibleIntegerValue );
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.debug( "Result of " ) + cc.notice( optsTransfer.strActionName ) +
                cc.debug( " call: " ) + cc.info( optsTransfer.nOutMsgCnt ) +
                "\n" );
        }
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = cc.fatal( "IMMEDIATE ERROR LOG:" ) +
                cc.error( " error caught during " ) + cc.attention( optsTransfer.strActionName ) +
                cc.error( ", error optsTransfer.details: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n";
            optsTransfer.details.write( strError );
            if( log.id != optsTransfer.details.id )
                log.write( strError );
        }
    }

    optsTransfer.strActionName = "dst-chain.MessageProxy.getIncomingMessagesCounter()";
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsTransfer.details.write( optsTransfer.strLogPrefix +
            cc.debug( "Will call " ) + cc.notice( optsTransfer.strActionName ) +
            cc.debug( "..." ) + "\n" );
    }
    nPossibleIntegerValue =
        await optsTransfer.joMessageProxyDst.callStatic.getIncomingMessagesCounter(
            optsTransfer.chainNameSrc,
            { from: optsTransfer.joAccountDst.address() } );
    if( !owaspUtils.validateInteger( nPossibleIntegerValue ) ) {
        throw new Error(
            "SRC chain " + optsTransfer.chainNameSrc + " returned incoming message counter " +
            nPossibleIntegerValue + " which is not a valid integer" );
    }
    optsTransfer.nIncMsgCnt = owaspUtils.toInteger( nPossibleIntegerValue );
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsTransfer.details.write( optsTransfer.strLogPrefix +
            cc.debug( "Result of " ) + cc.notice( optsTransfer.strActionName ) +
            cc.debug( " call: " ) + cc.info( optsTransfer.nIncMsgCnt ) + "\n" );
    }

    optsTransfer.strActionName = "src-chain.MessageProxy.getIncomingMessagesCounter()";
    nPossibleIntegerValue =
        await optsTransfer.joMessageProxySrc.callStatic.getIncomingMessagesCounter(
            optsTransfer.chainNameDst,
            { from: optsTransfer.joAccountSrc.address() } );
    if( !owaspUtils.validateInteger( nPossibleIntegerValue ) ) {
        throw new Error(
            "DST chain " + optsTransfer.chainNameDst + " returned incoming message counter " +
            nPossibleIntegerValue + " which is not a valid integer" );
    }
    const idxLastToPopNotIncluding = owaspUtils.toInteger( nPossibleIntegerValue );
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsTransfer.details.write( optsTransfer.strLogPrefix +
            cc.debug( "Result of " ) + cc.notice( optsTransfer.strActionName ) +
            cc.debug( " call: " ) + cc.info( idxLastToPopNotIncluding ) + "\n" );
    }

    // optimized scanner
    const bnBlockId =
        owaspUtils.toBN(
            await optsTransfer.joMessageProxySrc.callStatic.getLastOutgoingMessageBlockId(
                optsTransfer.chainNameDst,
                { from: optsTransfer.joAccountSrc.address() } ) );
    optsTransfer.arrLogRecordReferences = [];
    try {
        optsTransfer.arrLogRecordReferences =
            await findOutAllReferenceLogRecords(
                optsTransfer.details, optsTransfer.strLogPrefixShort,
                optsTransfer.ethersProviderSrc, optsTransfer.joMessageProxySrc,
                bnBlockId, optsTransfer.nIncMsgCnt, optsTransfer.nOutMsgCnt, true
            );
    } catch ( err ) {
        optsTransfer.arrLogRecordReferences = [];
        if( log.verboseGet() >= log.verboseReversed().error ) {
            optsTransfer.details.write(
                optsTransfer.strLogPrefix + cc.warning( "Optimized log search is " ) +
                cc.error( "off" ) + cc.warning( ". Running old IMA smart contracts?" ) +
                cc.success( " Please upgrade, if possible." ) +
                cc.warning( " This message is based on error: " ) +
                cc.success( " Please upgrade, if possible." ) +
                cc.warning( " Error is: " ) +
                cc.error( owaspUtils.extractErrorMessage( err ) ) +
                cc.warning( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
    }
    return true;
}

async function analyzeGatheredRecords( optsTransfer, r ) {
    let joValues = "";
    const strChainHashWeAreLookingFor =
        owaspUtils.ethersMod.ethers.utils.id( optsTransfer.chainNameDst );
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsTransfer.details.write( optsTransfer.strLogPrefix + cc.debug( "Will review " ) +
            cc.info( r.length ) +
            cc.debug( " found event records(in reverse order, newest to oldest)" ) +
            cc.debug( " while looking for hash " ) + cc.info( strChainHashWeAreLookingFor ) +
            cc.debug( " of destination chain " ) + cc.info( optsTransfer.chainNameDst ) + "\n" );
    }
    for( let i = r.length - 1; i >= 0; i-- ) {
        const joEvent = r[i];
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.debug( "Will review found event record " ) + cc.info( i ) +
                cc.debug( " with data " ) + cc.j( joEvent ) + "\n" );
        }
        const eventValuesByName = {
            "dstChainHash": joEvent.args[0],
            "msgCounter": joEvent.args[1],
            "srcContract": joEvent.args[2],
            "dstContract": joEvent.args[3],
            "data": joEvent.args[4]
        };
        if( eventValuesByName.dstChainHash == strChainHashWeAreLookingFor ) {
            joValues = eventValuesByName;
            joValues.savedBlockNumberForOptimizations = r[i].blockNumber;
            if( log.verboseGet() >= log.verboseReversed().debug ) {
                optsTransfer.details.write( optsTransfer.strLogPrefix +
                    cc.debug( "Found event record " ) + cc.info( i ) +
                    cc.debug( " reviewed and " ) +
                    cc.success( "accepted for processing, found event values are " ) +
                    cc.j( joValues ) + cc.success( ", found block number is " ) +
                    cc.info( joValues.savedBlockNumberForOptimizations ) + "\n" );
            }
            break;
        } else {
            if( log.verboseGet() >= log.verboseReversed().debug ) {
                optsTransfer.details.write( optsTransfer.strLogPrefix +
                    cc.debug( "Found event record " ) + cc.info( i ) +
                    cc.debug( " reviewed and " ) + cc.warning( "skipped" ) + "\n" );
            }
        }
    }
    if( joValues == "" ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = optsTransfer.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) + " " +
                cc.error( "Can't get events from MessageProxy" ) + "\n";
            optsTransfer.details.write( strError );
            if( log.id != optsTransfer.details.id )
                log.write( strError );
        }
        optsTransfer.details.exposeDetailsTo(
            log, optsTransfer.strGatheredDetailsName, false );
        saveTransferError(
            optsTransfer.strTransferErrorCategoryName, optsTransfer.details.toString() );
        optsTransfer.details.close();
        return null; // caller will return false if we return null here
    }
    return joValues;
}

async function gatherMessages( optsTransfer ) {
    optsTransfer.arrMessageCounters = [];
    optsTransfer.jarrMessages = [];
    optsTransfer.nIdxCurrentMsgBlockStart = 0 + optsTransfer.nIdxCurrentMsg;
    let r;
    optsTransfer.cntAccumulatedForBlock = 0;
    for( let idxInBlock = 0; // inner loop wil create block of transactions
        optsTransfer.nIdxCurrentMsg < optsTransfer.nOutMsgCnt &&
            idxInBlock < optsTransfer.nTransactionsCountInBlock;
        ++optsTransfer.nIdxCurrentMsg, ++idxInBlock, ++optsTransfer.cntAccumulatedForBlock
    ) {
        const idxProcessing = optsTransfer.cntProcessed + idxInBlock;
        if( idxProcessing > optsTransfer.nMaxTransactionsCount )
            break;
        let nBlockFrom = 0, nBlockTo = "latest";
        if( optsTransfer.arrLogRecordReferences.length > 0 ) {
            const joReferenceLogRecord = optsTransfer.arrLogRecordReferences.shift();
            nBlockFrom = joReferenceLogRecord.currentBlockId;
            nBlockTo = joReferenceLogRecord.currentBlockId;
        }
        optsTransfer.strActionName = "src-chain->MessageProxy->scan-past-events()";
        const strEventName = "OutgoingMessage";
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsTransfer.details.write( optsTransfer.strLogPrefix + cc.debug( "Will call " ) +
                cc.notice( optsTransfer.strActionName ) + cc.debug( " for " ) +
                cc.info( strEventName ) + cc.debug( " event..." ) + "\n" );
        }
        r = await safeGetPastEventsProgressive(
            optsTransfer.details, optsTransfer.strLogPrefixShort, optsTransfer.ethersProviderSrc,
            10, optsTransfer.joMessageProxySrc, strEventName, nBlockFrom, nBlockTo,
            optsTransfer.joMessageProxySrc.filters[strEventName](
                owaspUtils.ethersMod.ethers.utils.id( optsTransfer.chainNameDst ), // dstChainHash
                optsTransfer.nIdxCurrentMsg // msgCounter
            ) );
        const joValues = await analyzeGatheredRecords( optsTransfer, r );
        if( joValues == null )
            return false;
        if( optsTransfer.nBlockAwaitDepth > 0 ) {
            let bSecurityCheckPassed = true;
            const strActionNameOld = "" + optsTransfer.strActionName;
            optsTransfer.strActionName = "security check: evaluate block depth";
            try {
                const transactionHash = r[0].transactionHash;
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.debug( "Event transactionHash is " ) + cc.info( transactionHash ) +
                        "\n" );
                }
                const blockNumber = r[0].blockNumber;
                optsTransfer.details.write( optsTransfer.strLogPrefix +
                    cc.debug( "Event blockNumber is " ) + cc.info( blockNumber ) + "\n" );
                const nLatestBlockNumber = await safeGetBlockNumber(
                    optsTransfer.details, 10, optsTransfer.ethersProviderSrc );
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.debug( "Latest blockNumber is " ) + cc.info( nLatestBlockNumber ) +
                        "\n" );
                }
                const nDist = nLatestBlockNumber - blockNumber;
                if( nDist < optsTransfer.nBlockAwaitDepth )
                    bSecurityCheckPassed = false;
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.debug( "Distance by blockNumber is " ) + cc.info( nDist ) +
                        cc.debug( ", await check is " ) + ( bSecurityCheckPassed
                        ? cc.success( "PASSED" ) : cc.error( "FAILED" ) ) + "\n" );
                }
            } catch ( err ) {
                bSecurityCheckPassed = false;
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    const s = optsTransfer.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " Exception(evaluate block depth) while " +
                            "getting transaction hash and block number during " +
                        optsTransfer.strActionName + ": " ) + cc.error( strError ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
                    optsTransfer.details.write( s );
                    if( log.id != optsTransfer.details.id )
                        log.write( s );
                }
                optsTransfer.details.exposeDetailsTo(
                    log, optsTransfer.strGatheredDetailsName, false );
                saveTransferError(
                    optsTransfer.strTransferErrorCategoryName, optsTransfer.details.toString() );
                optsTransfer.details.close();
                return false;
            }
            optsTransfer.strActionName = "" + strActionNameOld;
            if( !bSecurityCheckPassed ) {
                if( log.verboseGet() >= log.verboseReversed().warning ) {
                    const s = optsTransfer.strLogPrefix + cc.warning( "Block depth check was " +
                        "not passed, canceling search for transfer events" ) + "\n";
                    optsTransfer.details.write( s );
                    if( log.id != optsTransfer.details.id )
                        log.write( s );
                }
                break;
            }
        }
        if( optsTransfer.nBlockAge > 0 ) {
            let bSecurityCheckPassed = true;
            const strActionNameOld = "" + optsTransfer.strActionName;
            optsTransfer.strActionName = "security check: evaluate block age";
            try {
                const transactionHash = r[0].transactionHash;
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.debug( "Event transactionHash is " ) + cc.info( transactionHash ) +
                        "\n" );
                }
                const blockNumber = r[0].blockNumber;
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.debug( "Event blockNumber is " ) + cc.info( blockNumber ) + "\n" );
                }
                const joBlock = await optsTransfer.ethersProviderSrc.getBlock( blockNumber );
                if( !owaspUtils.validateInteger( joBlock.timestamp ) ) {
                    throw new Error( "Block \"timestamp\" is not a valid integer value: " +
                        joBlock.timestamp );
                }
                const timestampBlock = owaspUtils.toInteger( joBlock.timestamp );
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.debug( "Block   TS is " ) + cc.info( timestampBlock ) + "\n" );
                }
                const timestampCurrent = currentTimestamp();
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.debug( "Current TS is " ) + cc.info( timestampCurrent ) + "\n" );
                }
                const tsDiff = timestampCurrent - timestampBlock;
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.debug( "Diff    TS is " ) + cc.info( tsDiff ) + "\n" );
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.debug( "Expected diff " ) + cc.info( optsTransfer.nBlockAge ) + "\n" );
                }
                if( tsDiff < optsTransfer.nBlockAge )
                    bSecurityCheckPassed = false;
                optsTransfer.details.write( optsTransfer.strLogPrefix +
                    cc.debug( "Block age check is " ) + ( bSecurityCheckPassed
                    ? cc.success( "PASSED" ) : cc.error( "FAILED" ) ) + "\n" );
            } catch ( err ) {
                bSecurityCheckPassed = false;
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    const s = optsTransfer.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " Exception(evaluate block age) while " +
                            "getting block number and timestamp during " +
                        optsTransfer.strActionName + ": " ) + cc.error( strError ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
                    optsTransfer.details.write( s );
                    if( log.id != optsTransfer.details.id )
                        log.write( s );
                }
                optsTransfer.details.exposeDetailsTo(
                    log, optsTransfer.strGatheredDetailsName, false );
                saveTransferError(
                    optsTransfer.strTransferErrorCategoryName, optsTransfer.details.toString() );
                optsTransfer.details.close();
                return false;
            }
            optsTransfer.strActionName = "" + strActionNameOld;
            if( !bSecurityCheckPassed ) {
                if( log.verboseGet() >= log.verboseReversed().warning ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.warning( "Block age check was not passed, " +
                            "canceling search for transfer events" ) + "\n" );
                }
                break;
            }
        }
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.success( "Got event optsTransfer.details from " ) +
                cc.notice( "getPastEvents()" ) + cc.success( " event invoked with " ) +
                cc.notice( "msgCounter" ) + cc.success( " set to " ) +
                cc.info( optsTransfer.nIdxCurrentMsg ) + cc.success( " and " ) +
                cc.notice( "dstChain" ) + cc.success( " set to " ) +
                cc.info( optsTransfer.chainNameDst ) + cc.success( ", event description: " ) +
                cc.j( joValues ) +
                // + cc.j(evs) +
                "\n" );
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.debug( "Will process message counter value " ) +
                cc.info( optsTransfer.nIdxCurrentMsg ) + "\n" );
        }
        optsTransfer.arrMessageCounters.push( optsTransfer.nIdxCurrentMsg );
        const joMessage = {
            "sender": joValues.srcContract,
            "destinationContract": joValues.dstContract,
            "to": joValues.to,
            "amount": joValues.amount,
            "data": joValues.data,
            "savedBlockNumberForOptimizations":
                joValues.savedBlockNumberForOptimizations
        };
        optsTransfer.jarrMessages.push( joMessage );
    }
}

async function preCheckAllMessagesSign( optsTransfer, err, jarrMessages, joGlueResult ) {
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        const strDidInvokedSigningCallbackMessage =
            optsTransfer.strLogPrefix +
            cc.debug( "Did invoked message signing callback, " +
                "first real message index is: " ) +
            cc.info( optsTransfer.nIdxCurrentMsgBlockStart ) +
            cc.info( optsTransfer.jarrMessages.length ) +
            cc.debug( " message(s) to process: " ) + cc.j( optsTransfer.jarrMessages ) + "\n";
        optsTransfer.details.write( strDidInvokedSigningCallbackMessage );
        if( log.id != optsTransfer.details.id )
            log.write( strDidInvokedSigningCallbackMessage );
    }
    if( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            optsTransfer.bErrorInSigningMessages = true;
            const strError = owaspUtils.extractErrorMessage( err );
            const s = optsTransfer.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error signing messages: " ) + cc.error( strError ) + "\n";
            optsTransfer.details.write( s );
            if( log.id != optsTransfer.details.id )
                log.write( s );
        }
        saveTransferError(
            optsTransfer.strTransferErrorCategoryName, optsTransfer.details.toString() );
        return false;
    }
    if( ! loop.checkTimeFraming(
        null, optsTransfer.strDirection, optsTransfer.joRuntimeOpts )
    ) {
        if( log.verboseGet() >= log.verboseReversed().warning ) {
            const strWarning = optsTransfer.strLogPrefix + cc.warning( "WARNING:" ) + " " +
                cc.warning( "Time framing overflow (after signing messages)" ) + "\n";
            optsTransfer.details.write( strWarning );
            if( log.id != optsTransfer.details.id )
                log.write( strWarning );
        }
        saveTransferSuccessAll();
        return false;
    }
    return true;
}

async function callbackAllMessagesSign( optsTransfer, err, jarrMessages, joGlueResult ) {
    if( ! await preCheckAllMessagesSign( optsTransfer, err, jarrMessages, joGlueResult ) )
        return;
    const nBlockSize = optsTransfer.arrMessageCounters.length;
    optsTransfer.strActionName = "dst-chain.MessageProxy.postIncomingMessages()";
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        const strWillCallPostIncomingMessagesAction = optsTransfer.strLogPrefix +
            cc.debug( "Will call " ) + cc.notice( optsTransfer.strActionName ) +
            cc.debug( " for " ) + cc.notice( "block size" ) + cc.debug( " set to " ) +
            cc.info( nBlockSize ) + cc.debug( ", " ) + cc.notice( "message counters =" ) +
            cc.debug( " are " ) + cc.info( JSON.stringify( optsTransfer.arrMessageCounters ) ) +
            cc.debug( "..." ) + "\n";
        optsTransfer.details.write( strWillCallPostIncomingMessagesAction );
        if( log.id != optsTransfer.details.id )
            log.write( strWillCallPostIncomingMessagesAction );
    }
    let signature = joGlueResult ? joGlueResult.signature : null;
    if( !signature )
        signature = { X: "0", Y: "0" };
    let hashPoint = joGlueResult ? joGlueResult.hashPoint : null;
    if( !hashPoint )
        hashPoint = { X: "0", Y: "0" };
    let hint = joGlueResult ? joGlueResult.hint : null;
    if( !hint )
        hint = "0";
    const sign = {
        blsSignature: [ signature.X, signature.Y ], // BLS glue of signatures
        hashA: hashPoint.X, // G1.X from joGlueResult.hashSrc
        hashB: hashPoint.Y, // G1.Y from joGlueResult.hashSrc
        counter: hint
    };
    const arrArgumentsPostIncomingMessages = [
        optsTransfer.chainNameSrc,
        optsTransfer.nIdxCurrentMsgBlockStart,
        optsTransfer.jarrMessages,
        sign //, // bls signature components
        // idxLastToPopNotIncluding
    ];
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        const joDebugArgs = [
            optsTransfer.chainNameSrc,
            optsTransfer.chainNameDst,
            optsTransfer.nIdxCurrentMsgBlockStart,
            optsTransfer.jarrMessages,
            [ signature.X, signature.Y ], // BLS glue of signatures
            hashPoint.X, // G1.X from joGlueResult.hashSrc
            hashPoint.Y, // G1.Y from joGlueResult.hashSrc
            hint
        ];
        optsTransfer.details.write( optsTransfer.strLogPrefix +
            cc.debug( "....debug args for " ) +
            cc.notice( "msgCounter" ) + cc.debug( " set to " ) +
            cc.info( optsTransfer.nIdxCurrentMsgBlockStart ) + cc.debug( ": " ) +
            cc.j( joDebugArgs ) + "\n" );
    }
    optsTransfer.strActionName =
        optsTransfer.strDirection + " - Post incoming messages";
    const weiHowMuchPostIncomingMessages = undefined;
    const gasPrice =
        await optsTransfer.transactionCustomizerDst.computeGasPrice(
            optsTransfer.ethersProviderDst, 200000000000 );
    optsTransfer.details.write( optsTransfer.strLogPrefix + cc.debug( "Using computed " ) +
        cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
    let estimatedGasPostIncomingMessages =
        await optsTransfer.transactionCustomizerDst.computeGas(
            optsTransfer.details,
            optsTransfer.ethersProviderDst,
            "MessageProxy", optsTransfer.joMessageProxyDst,
            "postIncomingMessages", arrArgumentsPostIncomingMessages,
            optsTransfer.joAccountDst, optsTransfer.strActionName,
            gasPrice, 10000000, weiHowMuchPostIncomingMessages,
            null
        );
    optsTransfer.details.write( optsTransfer.strLogPrefix +
        cc.debug( "Using estimated " ) + cc.info( "gas" ) + cc.debug( "=" ) +
        cc.notice( estimatedGasPostIncomingMessages ) + "\n" );
    if( optsTransfer.strDirection == "S2M" ) {
        const expectedGasLimit =
            perMessageGasForTransfer * optsTransfer.jarrMessages.length +
                additionalS2MTransferOverhead;
        estimatedGasPostIncomingMessages =
            Math.max( estimatedGasPostIncomingMessages, expectedGasLimit );
    }
    const isIgnorePostIncomingMessages = false;
    const strErrorOfDryRun =
        await dryRunCall(
            optsTransfer.details,
            optsTransfer.ethersProviderDst,
            "MessageProxy", optsTransfer.joMessageProxyDst,
            "postIncomingMessages", arrArgumentsPostIncomingMessages,
            optsTransfer.joAccountDst, optsTransfer.strActionName,
            isIgnorePostIncomingMessages,
            gasPrice, estimatedGasPostIncomingMessages,
            weiHowMuchPostIncomingMessages,
            null
        );
    if( strErrorOfDryRun )
        throw new Error( strErrorOfDryRun );
    const opts = {
        isCheckTransactionToSchain:
            ( optsTransfer.chainNameDst !== "Mainnet" ) ? true : false
    };
    const joReceipt =
        await payedCall(
            optsTransfer.details, optsTransfer.ethersProviderDst,
            "MessageProxy", optsTransfer.joMessageProxyDst,
            "postIncomingMessages", arrArgumentsPostIncomingMessages,
            optsTransfer.joAccountDst, optsTransfer.strActionName,
            gasPrice, estimatedGasPostIncomingMessages,
            weiHowMuchPostIncomingMessages, opts );
    if( joReceipt && typeof joReceipt == "object" ) {
        optsTransfer.jarrReceipts.push( {
            "description": "doTransfer/postIncomingMessages()",
            "optsTransfer.detailsString":
                "" + optsTransfer.strGatheredDetailsName,
            "receipt": joReceipt
        } );
        printGasUsageReportFromArray( "(intermediate result) TRANSFER " +
                optsTransfer.chainNameSrc + " -> " + optsTransfer.chainNameDst,
        optsTransfer.jarrReceipts, optsTransfer.details );
    }
    optsTransfer.cntProcessed += optsTransfer.cntAccumulatedForBlock;
    optsTransfer.details.write( optsTransfer.strLogPrefix +
        cc.debug( "Validating transfer from " ) +
        cc.info( optsTransfer.chainNameSrc ) + cc.debug( " to " ) +
        cc.info( optsTransfer.chainNameDst ) + cc.debug( "..." ) + "\n" );
    // check DepositBox -> Error on Mainnet only
    if( optsTransfer.chainNameDst == "Mainnet" ) {
        optsTransfer.details.write( optsTransfer.strLogPrefix +
            cc.debug( "Validating transfer to Main Net via MessageProxy " +
                "error absence on Main Net..." ) + "\n" );
        if( optsTransfer.joDepositBoxMainNet ) {
            if( joReceipt && "blockNumber" in joReceipt &&
                "transactionHash" in joReceipt ) {
                const strEventName = "PostMessageError";
                optsTransfer.details.write( optsTransfer.strLogPrefix +
                    cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                    cc.debug( " event of the " ) + cc.info( "MessageProxy" ) +
                    cc.debug( "/" ) +
                    cc.notice( optsTransfer.joMessageProxyDst.address ) +
                    cc.debug( " contract..." ) + "\n" );
                const joEvents =
                    await getContractCallEvents(
                        optsTransfer.details, optsTransfer.strLogPrefixShort,
                        optsTransfer.ethersProviderDst,
                        optsTransfer.joMessageProxyDst, strEventName,
                        joReceipt.blockNumber,
                        joReceipt.transactionHash,
                        optsTransfer.joMessageProxyDst.filters[strEventName]() );
                if( joEvents.length == 0 ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                        cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                        cc.success( "/" ) +
                        cc.notice( optsTransfer.joMessageProxyDst.address ) +
                        cc.success( " contract, no events found" ) + "\n" );
                } else {
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        const strError = optsTransfer.strLogPrefix +
                            cc.fatal( "CRITICAL ERROR:" ) + cc.warning( " Failed" ) +
                            cc.error( " verification of the " ) +
                            cc.warning( "PostMessageError" ) + cc.error( " event of the " ) +
                            cc.warning( "MessageProxy" ) + cc.error( "/" ) +
                            cc.notice( optsTransfer.joMessageProxyDst.address ) +
                            cc.error( " contract, found event(s): " ) + cc.j( joEvents ) + "\n";
                        optsTransfer.details.write( strError );
                        if( log.id != optsTransfer.details.id )
                            log.write( strError );
                    }
                    saveTransferError(
                        optsTransfer.strTransferErrorCategoryName,
                        optsTransfer.details.toString() );
                    throw new Error(
                        "Verification failed for the \"PostMessageError\" " +
                            "event of the \"MessageProxy\"/" +
                        optsTransfer.joMessageProxyDst.address +
                            " contract, error events found" );
                }
                optsTransfer.details.write( optsTransfer.strLogPrefix +
                    cc.success( "Done, validated transfer to Main Net " +
                        "via MessageProxy error absence on Main Net" ) + "\n" );
            } else {
                optsTransfer.details.write( optsTransfer.strLogPrefix +
                    cc.warning( "WARNING:" ) + " " +
                    cc.warn( "Cannot validate transfer to Main Net via " +
                        "MessageProxy error absence on Main Net, " +
                        "no valid transaction receipt provided" ) + "\n" );
            }
        } else {
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.warning( "WARNING:" ) + " " +
                cc.warn( "Cannot validate transfer to Main Net " +
                    "via MessageProxy error absence on Main Net, " +
                    "no MessageProxy provided" ) + "\n" );
        }
    }
}

async function handleAllMessagesSigning( optsTransfer ) {
    await optsTransfer.fnSignMessages(
        optsTransfer.nTransferLoopCounter,
        optsTransfer.jarrMessages, optsTransfer.nIdxCurrentMsgBlockStart,
        optsTransfer.chainNameSrc,
        optsTransfer.joExtraSignOpts,
        async function( err, jarrMessages, joGlueResult ) {
            await callbackAllMessagesSign( optsTransfer, err, jarrMessages, joGlueResult );
        } ).catch( ( err ) => {
        // callback fn as argument of optsTransfer.fnSignMessages
        optsTransfer.bErrorInSigningMessages = true;
        if( log.verboseGet() >= log.verboseReversed().error ) {
            if( log.verboseGet() >= log.verboseReversed().error ) {
                const strError = owaspUtils.extractErrorMessage( err );
                const strErrorMessage = optsTransfer.strLogPrefix +
                    cc.error( "Problem in transfer handler: " ) +
                    cc.warning( strError );
                optsTransfer.details.write( strErrorMessage + "\n" );
                if( log.id != optsTransfer.details.id )
                    log.write( strErrorMessage + "\n" );
            }
            saveTransferError(
                optsTransfer.strTransferErrorCategoryName,
                optsTransfer.details.toString() );
        }
    } );
    return true;
}

async function checkOutgoingMessageEvent( optsTransfer, joSChain ) {
    const cntNodes = joSChain.data.computed.nodes.length;
    const cntMessages = optsTransfer.jarrMessages.length;
    for( let idxMessage = 0; idxMessage < cntMessages; ++ idxMessage ) {
        const idxImaMessage = optsTransfer.arrMessageCounters[idxMessage];
        const joMessage = optsTransfer.jarrMessages[idxMessage];
        optsTransfer.details.write( optsTransfer.strLogPrefix +
            cc.sunny( optsTransfer.strDirection ) + cc.debug( " message analysis for message " ) +
            cc.info( idxMessage + 1 ) + cc.debug( " of " ) + cc.info( cntMessages ) +
            cc.debug( " with IMA message index " ) + cc.j( idxImaMessage ) +
            cc.debug( " and message envelope data:" ) + cc.j( joMessage ) + "\n" );
        let cntPassedNodes = 0, cntFailedNodes = 0, joNode = null;
        try {
            for( let idxNode = 0; idxNode < cntNodes; ++ idxNode ) {
                joNode = joSChain.data.computed.nodes[idxNode];
                optsTransfer.details.write( optsTransfer.strLogPrefix + cc.debug( "Validating " ) +
                    cc.sunny( optsTransfer.strDirection ) + cc.debug( " message " ) +
                    cc.info( idxMessage + 1 ) + cc.debug( " on node " ) + cc.info( joNode.name ) +
                    cc.debug( " using URL " ) + cc.info( joNode.http_endpoint_ip ) +
                    cc.debug( "..." ) + "\n" );
                let bEventIsFound = false;
                try {
                    const ethersProviderNode =
                        owaspUtils.getEthersProviderFromURL( joNode.http_endpoint_ip );
                    const joMessageProxyNode =
                        new owaspUtils.ethersMod.ethers.Contract(
                            optsTransfer.imaState.chainProperties.sc
                                .joAbiIMA.message_proxy_chain_address,
                            optsTransfer.imaState.chainProperties.sc
                                .joAbiIMA.message_proxy_chain_abi,
                            ethersProviderNode
                        );
                    const strEventName = "OutgoingMessage";
                    const node_r = await safeGetPastEventsProgressive(
                        optsTransfer.details, optsTransfer.strLogPrefixShort,
                        ethersProviderNode, 10, joMessageProxyNode, strEventName,
                        joMessage.savedBlockNumberForOptimizations,
                        joMessage.savedBlockNumberForOptimizations,
                        joMessageProxyNode.filters[strEventName](
                            owaspUtils.ethersMod.ethers.utils.id( optsTransfer.chainNameDst ),
                            idxImaMessage // msgCounter
                        )
                    );
                    const cntEvents = node_r.length;
                    optsTransfer.details.write( optsTransfer.strLogPrefix + cc.debug( "Got " ) +
                        cc.info( cntEvents ) + cc.debug( " event(s) (" ) + cc.info( strEventName ) +
                        cc.debug( ") on node " ) + cc.info( joNode.name ) +
                        cc.debug( " with data: " ) + cc.j( node_r ) + "\n" );
                    for( let idxEvent = 0; idxEvent < cntEvents; ++ idxEvent ) {
                        const joEvent = node_r[idxEvent];
                        const eventValuesByName = {
                            "dstChainHash": joEvent.args[0],
                            "msgCounter": joEvent.args[1],
                            "srcContract": joEvent.args[2],
                            "dstContract": joEvent.args[3],
                            "data": joEvent.args[4]
                        };
                        if( owaspUtils.ensureStartsWith0x(
                            joMessage.sender ).toLowerCase() ==
                            owaspUtils.ensureStartsWith0x(
                                eventValuesByName.srcContract ).toLowerCase() &&
                            owaspUtils.ensureStartsWith0x(
                                joMessage.destinationContract ).toLowerCase() ==
                            owaspUtils.ensureStartsWith0x(
                                eventValuesByName.dstContract ).toLowerCase()
                        ) {
                            bEventIsFound = true;
                            break;
                        }
                    }
                } catch ( err ) {
                    ++ cntFailedNodes;
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        const strError = optsTransfer.strLogPrefix +
                            cc.fatal( optsTransfer.strDirection +
                            " message analysis error:" ) + " " +
                            cc.error( "Failed to scan events on node " ) + cc.info( joNode.name ) +
                            cc.error( ", error is: " ) +
                            cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                            cc.error( ", detailed node description is: " ) + cc.j( joNode ) +
                            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n";
                        optsTransfer.details.write( strError );
                        if( log.id != optsTransfer.details.id )
                            log.write( strError );
                    }
                    continue;
                }
                if( bEventIsFound ) {
                    ++ cntPassedNodes;
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.sunny( optsTransfer.strDirection ) + cc.success( " message " ) +
                        cc.info( idxMessage + 1 ) + cc.success( " validation on node " ) +
                        cc.info( joNode.name ) + cc.success( " using URL " ) +
                        cc.info( joNode.http_endpoint_ip ) + cc.success( " is passed" ) + "\n" );
                } else {
                    ++ cntFailedNodes;
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        const strError = optsTransfer.strLogPrefix +
                            cc.sunny( optsTransfer.strDirection ) + cc.error( " message " ) +
                            cc.info( idxMessage + 1 ) + cc.error( " validation on node " ) +
                            cc.info( joNode.name ) + cc.success( " using URL " ) +
                            cc.info( joNode.http_endpoint_ip ) + cc.error( " is failed" ) + "\n";
                        optsTransfer.details.write( strError );
                        if( log.id != optsTransfer.details.id )
                            log.write( strError );
                    }
                }
                if( cntFailedNodes > optsTransfer.cntNodesMayFail )
                    break;
                if( cntPassedNodes >= optsTransfer.cntNodesShouldPass ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.sunny( optsTransfer.strDirection ) + cc.success( " message " ) +
                        cc.info( idxMessage + 1 ) + cc.success( " validation on node " ) +
                        cc.info( joNode.name ) + cc.success( " using URL " ) +
                        cc.info( joNode.http_endpoint_ip ) + cc.success( " is passed" ) + "\n" );
                    break;
                }
            }
        } catch ( err ) {
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                const strError = optsTransfer.strLogPrefix +
                    cc.fatal( optsTransfer.strDirection + " message analysis error:" ) +
                    " " + cc.error( "Failed to process events for " ) +
                    cc.sunny( optsTransfer.strDirection ) + cc.error( " message " ) +
                    cc.info( idxMessage + 1 ) + cc.error( " on node " ) +
                    ( joNode
                        ? cc.info( joNode.name )
                        : cc.error( "<<unknown node name>>" ) ) +
                    cc.error( " using URL " ) +
                    ( joNode
                        ? cc.info( joNode.http_endpoint_ip )
                        : cc.error( "<<unknown node endpoint>>" ) ) +
                    cc.error( ", error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                    "\n";
                optsTransfer.details.write( strError );
                if( log.id != optsTransfer.details.id )
                    log.write( strError );
            }
        }
        if( cntFailedNodes > optsTransfer.cntNodesMayFail ) {
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                const s = optsTransfer.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error validating " ) + cc.sunny( optsTransfer.strDirection ) +
                    cc.error( " messages, failed node count " ) + cc.info( cntFailedNodes ) +
                    cc.error( " is greater then allowed to fail " ) +
                    cc.info( optsTransfer.cntNodesMayFail ) + "\n";
                optsTransfer.details.write( s );
                if( log.id != optsTransfer.details.id )
                    log.write( s );
            }
            optsTransfer.details.exposeDetailsTo(
                log, optsTransfer.strGatheredDetailsName, false );
            saveTransferError(
                optsTransfer.strTransferErrorCategoryName,
                optsTransfer.details.toString() );
            optsTransfer.details.close();
            return false;
        }
        if( ! ( cntPassedNodes >= optsTransfer.cntNodesShouldPass ) ) {
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                const s = optsTransfer.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error validating " ) + cc.sunny( optsTransfer.strDirection ) +
                    cc.error( " messages, passed node count " ) + cc.info( cntFailedNodes ) +
                    cc.error( " is less then needed count " ) +
                    cc.info( optsTransfer.cntNodesShouldPass ) + "\n";
                optsTransfer.details.write( s );
                if( log.id != optsTransfer.details.id )
                    log.write( s );
            }
            optsTransfer.details.exposeDetailsTo(
                log, optsTransfer.strGatheredDetailsName, false );
            saveTransferError(
                optsTransfer.strTransferErrorCategoryName, optsTransfer.details.toString() );
            optsTransfer.details.close();
            return false;
        }
    }
    return true;
}

async function doMainTransferLoopActions( optsTransfer ) {
    // classic scanner with optional usage of optimized IMA messages search algorithm
    // outer loop is block former/creator, then transfer
    optsTransfer.nIdxCurrentMsg = optsTransfer.nIncMsgCnt;
    while( optsTransfer.nIdxCurrentMsg < optsTransfer.nOutMsgCnt ) {
        if( optsTransfer.nStepsDone > optsTransfer.nTransferSteps ) {
            if( log.verboseGet() >= log.verboseReversed().warning ) {
                const strWarning = optsTransfer.strLogPrefix + cc.warning( "WARNING:" ) + " " +
                    cc.warning( "Transfer step count overflow" ) + "\n";
                optsTransfer.details.write( strWarning );
                if( log.id != optsTransfer.details.id )
                    log.write( strWarning );
            }
            optsTransfer.details.close();
            saveTransferSuccessAll();
            return false;
        }
        optsTransfer.details.write(
            optsTransfer.strLogPrefix + cc.debug( "Entering block former iteration with " ) +
            cc.notice( "message counter" ) +
            cc.debug( " set to " ) + cc.info( optsTransfer.nIdxCurrentMsg ) +
            cc.debug( ", transfer step number is " ) + cc.info( optsTransfer.nStepsDone ) +
            cc.debug( ", can transfer up to " ) + cc.info( optsTransfer.nMaxTransactionsCount ) +
            cc.debug( " message(s) per step" ) +
            cc.debug( ", can perform up to " ) + cc.info( optsTransfer.nTransferSteps ) +
            cc.debug( " transfer step(s)" ) +
            "\n" );
        if( ! loop.checkTimeFraming(
            null, optsTransfer.strDirection, optsTransfer.joRuntimeOpts ) ) {
            if( log.verboseGet() >= log.verboseReversed().warning ) {
                const strWarning = optsTransfer.strLogPrefix + cc.warning( "WARNING:" ) + " " +
                    cc.warning( "Time framing overflow " +
                        "(after entering block former iteration loop)" ) + "\n";
                optsTransfer.details.write( strWarning );
                if( log.id != optsTransfer.details.id )
                    log.write( strWarning );
            }
            optsTransfer.details.close();
            saveTransferSuccessAll();
            return false;
        }
        await gatherMessages( optsTransfer );
        if( optsTransfer.cntAccumulatedForBlock == 0 )
            break;
        if( ! loop.checkTimeFraming(
            null, optsTransfer.strDirection, optsTransfer.joRuntimeOpts )
        ) {
            if( log.verboseGet() >= log.verboseReversed().warning ) {
                const strWarning = optsTransfer.strLogPrefix + cc.warning( "WARNING:" ) + " " +
                    cc.warning( "Time framing overflow (after forming block of messages)" ) + "\n";
                optsTransfer.details.write( strWarning );
                if( log.id != optsTransfer.details.id )
                    log.write( strWarning );
            }
            optsTransfer.details.close();
            saveTransferSuccessAll();
            return false;
        }

        if( optsTransfer.strDirection == "S2S" ) {
            optsTransfer.strActionName = "S2S message analysis";
            if( ! optsTransfer.joExtraSignOpts ) {
                throw new Error(
                    "Could not validate S2S messages, " +
                        "no extra options provided to transfer algorithm" );
            }
            if( ! optsTransfer.joExtraSignOpts.skaleObserver ) {
                throw new Error(
                    "Could not validate S2S messages, " +
                        "no SKALE NETWORK observer provided to transfer algorithm" );
            }
            const arrSChainsCached =
                optsTransfer.joExtraSignOpts.skaleObserver.getLastCachedSChains();
            if( ( !arrSChainsCached ) || arrSChainsCached.length == 0 ) {
                throw new Error(
                    "Could not validate S2S messages, " +
                        "no S-Chains in SKALE NETWORK observer cached yet, try again later" );
            }
            const idxSChain =
                optsTransfer.joExtraSignOpts.skaleObserver.findSChainIndexInArrayByName(
                    arrSChainsCached, optsTransfer.chainNameSrc );
            if( idxSChain < 0 ) {
                throw new Error(
                    "Could not validate S2S messages, source S-Chain \"" +
                    optsTransfer.chainNameSrc +
                    "\" is not in SKALE NETWORK observer " +
                    "cache yet or it's not connected to this \"" + optsTransfer.chainNameDst +
                    "\" S-Chain yet, try again later" );
            }
            const cntMessages = optsTransfer.jarrMessages.length;
            const joSChain = arrSChainsCached[idxSChain];
            const cntNodes = joSChain.data.computed.nodes.length;
            optsTransfer.cntNodesShouldPass =
                ( cntNodes == 16 )
                    ? 11
                    : (
                        ( cntNodes == 4 )
                            ? 3
                            : (
                                ( cntNodes == 2 || cntNodes == 1 )
                                    ? ( 0 + cntNodes )
                                    : parseInt( ( cntNodes * 2 ) / 3 )
                            )
                    );
            optsTransfer.cntNodesMayFail = cntNodes - optsTransfer.cntNodesShouldPass;
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.sunny( optsTransfer.strDirection ) +
                cc.debug( " message analysis will be performed o S-Chain " ) +
                cc.info( optsTransfer.chainNameSrc ) + cc.debug( " with " ) +
                cc.info( cntNodes ) + cc.debug( " node(s), " ) +
                cc.info( optsTransfer.cntNodesShouldPass ) +
                cc.debug( " node(s) should have same message(s), " ) +
                cc.info( optsTransfer.cntNodesMayFail ) +
                cc.debug( " node(s) allowed to fail message(s) comparison, " ) +
                cc.info( cntMessages ) + cc.debug( " message(s) to check..." ) +
                "\n" );
            if( ! ( await checkOutgoingMessageEvent( optsTransfer, joSChain ) ) )
                return false;
        }

        optsTransfer.strActionName = "sign messages";
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            const strWillInvokeSigningCallbackMessage =
                optsTransfer.strLogPrefix +
                cc.debug( "Will invoke message signing callback, " +
                    "first real message index is: " ) +
                cc.info( optsTransfer.nIdxCurrentMsgBlockStart ) +
                cc.info( optsTransfer.jarrMessages.length ) +
                cc.debug( " message(s) to process: " ) + cc.j( optsTransfer.jarrMessages ) +
                "\n";
            optsTransfer.details.write( strWillInvokeSigningCallbackMessage );
            if( log.id != optsTransfer.details.id )
                log.write( strWillInvokeSigningCallbackMessage );
        }
        // will re-open optsTransfer.details B log here for next step,
        // it can be delayed so we will flush accumulated optsTransfer.details A now
        if( log.exposeDetailsGet() && optsTransfer.details.exposeDetailsTo ) {
            optsTransfer.details.exposeDetailsTo(
                log, optsTransfer.strGatheredDetailsName, true );
        }
        optsTransfer.details.close();
        optsTransfer.details = optsTransfer.imaState.isDynamicLogInDoTransfer
            ? log : log.createMemoryStream( true );
        optsTransfer.strGatheredDetailsName =
            optsTransfer.strDirection + "/#" + optsTransfer.nTransferLoopCounter + "-" +
            "doTransfer-B-" + optsTransfer.chainNameSrc + "-->" + optsTransfer.chainNameDst;
        optsTransfer.strGatheredDetailsName_colored =
            cc.bright( optsTransfer.strDirection ) + cc.debug( "/" ) + cc.attention( "#" ) +
            cc.sunny( optsTransfer.nTransferLoopCounter ) + cc.debug( "-" ) +
            cc.info( "doTransfer-B-" ) + cc.notice( optsTransfer.chainNameSrc ) +
            cc.debug( "-->" ) + cc.notice( optsTransfer.chainNameDst );

        try {
            if( ! ( await handleAllMessagesSigning( optsTransfer ) ) )
                return false;
        } catch ( err ) {
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                const strError =
                    optsTransfer.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Exception from signing messages function: " ) +
                    cc.error( owaspUtils.extractErrorMessage( err ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                    "\n" );
                optsTransfer.details.write( strError );
                if( log.id != optsTransfer.details.id )
                    log.write( strError );
            }
        }
        if( optsTransfer.bErrorInSigningMessages )
            break;
        ++ optsTransfer.nStepsDone;
    }
    return true;
}

export async function doTransfer(
    strDirection,
    joRuntimeOpts,
    ethersProviderSrc,
    joMessageProxySrc,
    joAccountSrc,
    ethersProviderDst,
    joMessageProxyDst,
    joAccountDst,
    chainNameSrc,
    chainNameDst,
    chainIdSrc,
    chainIdDst,
    joDepositBoxMainNet, // for logs validation on mainnet
    joTokenManagerSChain, // for logs validation on s-chain
    nTransactionsCountInBlock,
    nTransferSteps,
    nMaxTransactionsCount,
    nBlockAwaitDepth,
    nBlockAge,
    fnSignMessages,
    joExtraSignOpts,
    transactionCustomizerDst
) {
    const optsTransfer = {
        strDirection: strDirection,
        joRuntimeOpts: joRuntimeOpts,
        ethersProviderSrc: ethersProviderSrc,
        joMessageProxySrc: joMessageProxySrc,
        joAccountSrc: joAccountSrc,
        ethersProviderDst: ethersProviderDst,
        joMessageProxyDst: joMessageProxyDst,
        joAccountDst: joAccountDst,
        chainNameSrc: chainNameSrc,
        chainNameDst: chainNameDst,
        chainIdSrc: chainIdSrc,
        chainIdDst: chainIdDst,
        joDepositBoxMainNet: joDepositBoxMainNet, // for logs validation on mainnet
        joTokenManagerSChain: joTokenManagerSChain, // for logs validation on s-chain
        nTransactionsCountInBlock: nTransactionsCountInBlock,
        nTransferSteps: nTransferSteps,
        nMaxTransactionsCount: nMaxTransactionsCount,
        nBlockAwaitDepth: nBlockAwaitDepth,
        nBlockAge: nBlockAge,
        fnSignMessages: fnSignMessages,
        joExtraSignOpts: joExtraSignOpts,
        transactionCustomizerDst: transactionCustomizerDst,
        imaState: state.get(),
        nTransferLoopCounter: 0 + gTransferLoopCounter,
        strTransferErrorCategoryName: "loop-" + strDirection,
        strGatheredDetailsName: "",
        strGatheredDetailsName_colored: "",
        details: null,
        jarrReceipts: [],
        bErrorInSigningMessages: false,
        strLogPrefixShort: "",
        strLogPrefix: "",
        nStepsDone: 0,
        strActionName: "",
        nIdxCurrentMsg: 0,
        nOutMsgCnt: 0,
        nIncMsgCnt: 0,
        cntProcessed: 0,
        arrMessageCounters: [],
        jarrMessages: [],
        nIdxCurrentMsgBlockStart: 0,
        cntAccumulatedForBlock: 0,
        arrLogRecordReferences: []
    };
    ++ gTransferLoopCounter;
    optsTransfer.strGatheredDetailsName =
        optsTransfer.strDirection + "/#" + optsTransfer.nTransferLoopCounter +
        "-" + "doTransfer-A" + "-" +
        optsTransfer.chainNameSrc + "-->" + optsTransfer.chainNameDst;
    optsTransfer.strGatheredDetailsName_colored =
        cc.bright( optsTransfer.strDirection ) + cc.debug( "/" ) + cc.attention( "#" ) +
        cc.sunny( optsTransfer.nTransferLoopCounter ) + cc.debug( "-" ) +
        cc.info( "doTransfer-A-" ) + cc.debug( "-" ) + cc.notice( optsTransfer.chainNameSrc ) +
        cc.debug( "-->" ) + cc.notice( optsTransfer.chainNameDst );
    optsTransfer.details = optsTransfer.imaState.isDynamicLogInDoTransfer
        ? log : log.createMemoryStream( true );
    optsTransfer.strLogPrefixShort = cc.bright( optsTransfer.strDirection ) + cc.debug( "/" ) +
        cc.attention( "#" ) + cc.sunny( optsTransfer.nTransferLoopCounter ) + " ";
    optsTransfer.strLogPrefix = optsTransfer.strLogPrefixShort + cc.info( "transfer loop from " ) +
        cc.notice( optsTransfer.chainNameSrc ) + cc.info( " to " ) +
        cc.notice( optsTransfer.chainNameDst ) + cc.info( ":" ) + " ";
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsTransfer.details.write( optsTransfer.strLogPrefix + cc.debug( "Message signing is " ) +
            cc.onOff( optsTransfer.imaState.bSignMessages ) + "\n" );
    }
    if( optsTransfer.fnSignMessages == null ||
        optsTransfer.fnSignMessages == undefined ||
        ( ! optsTransfer.imaState.bSignMessages )
    ) {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.debug( "Using internal signing stub function" ) + "\n" );
        }
        optsTransfer.fnSignMessages = async function(
            nTransferLoopCounter, jarrMessages, nIdxCurrentMsgBlockStart, strFromChainName,
            joExtraSignOpts, fnAfter
        ) {
            if( log.verboseGet() >= log.verboseReversed().debug ) {
                optsTransfer.details.write( optsTransfer.strLogPrefix +
                    cc.debug( "Message signing callback was " ) + cc.error( "not provided" ) +
                    cc.debug( " to IMA, first real message index is:" ) +
                    cc.info( nIdxCurrentMsgBlockStart ) + cc.debug( ", have " ) +
                    cc.info( optsTransfer.jarrMessages.length ) +
                    cc.debug( " message(s) to process:" ) + cc.j( optsTransfer.jarrMessages ) +
                    "\n" );
            }
            await fnAfter( null, jarrMessages, null ); // null - no error, null - no signatures
        };
    } else {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.debug( "Using externally provided signing function" ) + "\n" );
        }
    }
    optsTransfer.nTransactionsCountInBlock = optsTransfer.nTransactionsCountInBlock || 5;
    optsTransfer.nTransferSteps = optsTransfer.nTransferSteps || Number.MAX_SAFE_INTEGER;
    optsTransfer.nMaxTransactionsCount =
        optsTransfer.nMaxTransactionsCount || Number.MAX_SAFE_INTEGER;
    if( optsTransfer.nTransactionsCountInBlock < 1 )
        optsTransfer.nTransactionsCountInBlock = 1;
    if( optsTransfer.nBlockAwaitDepth < 0 )
        optsTransfer.nBlockAwaitDepth = 0;
    if( optsTransfer.nBlockAge < 0 )
        optsTransfer.nBlockAge = 0;
    try {
        if( ! ( await doQueryOutgoingMessageCounter( optsTransfer ) ) )
            return false;
        if( ! ( await doMainTransferLoopActions( optsTransfer ) ) )
            return false;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = optsTransfer.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in " ) + optsTransfer.strGatheredDetailsName_colored +
                cc.error( " during " + optsTransfer.strActionName + ": " ) +
                cc.error( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n";
            optsTransfer.details.write( strError );
            if( log.id != optsTransfer.details.id )
                log.write( strError );
        }
        optsTransfer.details.exposeDetailsTo( log, optsTransfer.strGatheredDetailsName, false );
        saveTransferError(
            optsTransfer.strTransferErrorCategoryName, optsTransfer.details.toString() );
        optsTransfer.details.close();
        return false;
    }
    printGasUsageReportFromArray( "TRANSFER " + optsTransfer.chainNameSrc + " -> " +
        optsTransfer.chainNameDst, optsTransfer.jarrReceipts, optsTransfer.details );
    if( optsTransfer.details ) {
        if( log.exposeDetailsGet() && optsTransfer.details.exposeDetailsTo ) {
            optsTransfer.details.exposeDetailsTo(
                log, optsTransfer.strGatheredDetailsName, true );
        }
        optsTransfer.details.close();
    }
    if( ! optsTransfer.bErrorInSigningMessages )
        saveTransferSuccess( optsTransfer.strTransferErrorCategoryName );
    return true;
}

export async function doAllS2S( // s-chain --> s-chain
    joRuntimeOpts,
    imaState,
    skaleObserver,
    ethersProviderDst,
    joMessageProxyDst,
    joAccountDst,
    chainNameDst,
    chainIdDst,
    joTokenManagerSChain, // for logs validation on s-chain
    nTransactionsCountInBlock,
    nTransferSteps,
    nMaxTransactionsCount,
    nBlockAwaitDepth,
    nBlockAge,
    fnSignMessages,
    transactionCustomizerDst
) {
    let cntOK = 0, cntFail = 0, nIndexS2S = 0;
    const strDirection = "S2S";
    const arrSChainsCached = skaleObserver.getLastCachedSChains();
    const cntSChains = arrSChainsCached.length;
    if( log.verboseGet() >= log.verboseReversed().information ) {
        log.write( cc.debug( "Have " ) + cc.info( cntSChains ) +
            cc.debug( " S-Chain(s) connected to this S-Chain for performing S2S transfers." ) +
            "\n" );
    }
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        const joSChain = arrSChainsCached[idxSChain];
        const urlSrc = skaleObserver.pickRandomSChainUrl( joSChain );
        const ethersProviderSrc = owaspUtils.getEthersProviderFromURL( urlSrc );
        const joAccountSrc = joAccountDst; // ???
        const chainNameSrc = "" + joSChain.data.name;
        const chainIdSrc = "" + joSChain.data.computed.chainId;
        if( log.verboseGet() >= log.verboseReversed().information ) {
            log.write( cc.debug( "S2S transfer walk trough " ) + cc.info( chainNameSrc ) +
                cc.debug( "/" ) + cc.info( chainIdSrc ) + cc.debug( " S-Chain..." ) + "\n" );
        }
        let bOK = false;
        try {
            nIndexS2S = idxSChain;
            if( ! await pwa.checkOnLoopStart( imaState, "s2s", nIndexS2S ) ) {
                imaState.loopState.s2s.wasInProgress = false;
                if( log.verboseGet() >= log.verboseReversed().warning ) {
                    log.write( cc.warning( "Skipped(s2s) due to cancel mode reported from PWA" ) +
                        "\n" );
                }
            } else {
                if( loop.checkTimeFraming( null, "s2s", joRuntimeOpts ) ) {
                    // ??? assuming all S-Chains have same ABIs here
                    const joMessageProxySrc =
                        new owaspUtils.ethersMod.ethers.Contract(
                            imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_address,
                            imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_abi,
                            ethersProviderSrc
                        );
                    const joDepositBoxSrc =
                        new owaspUtils.ethersMod.ethers.Contract(
                            imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_address,
                            imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_abi,
                            ethersProviderSrc
                        );
                    const joExtraSignOpts = {
                        skaleObserver: skaleObserver,
                        chainNameSrc: chainNameSrc,
                        chainIdSrc: chainIdSrc,
                        chainNameDst: chainNameDst,
                        chainIdDst: chainIdDst,
                        joAccountSrc: joAccountSrc,
                        joAccountDst: joAccountDst,
                        ethersProviderSrc: ethersProviderSrc,
                        ethersProviderDst: ethersProviderDst
                    };
                    joRuntimeOpts.idxChainKnownForS2S = idxSChain;
                    joRuntimeOpts.cntChainsKnownForS2S = cntSChains;
                    joRuntimeOpts.joExtraSignOpts = joExtraSignOpts;

                    imaState.loopState.s2s.isInProgress = true;
                    await pwa.notifyOnLoopStart( imaState, "s2s", nIndexS2S );

                    bOK =
                    await doTransfer(
                        strDirection,
                        joRuntimeOpts,
                        ethersProviderSrc,
                        joMessageProxySrc,
                        joAccountSrc,
                        ethersProviderDst,
                        joMessageProxyDst,
                        joAccountDst,
                        chainNameSrc,
                        chainNameDst,
                        chainIdSrc,
                        chainIdDst,
                        joDepositBoxSrc, // for logs validation on mainnet or source S-Chain
                        joTokenManagerSChain, // for logs validation on s-chain
                        nTransactionsCountInBlock,
                        nTransferSteps,
                        nMaxTransactionsCount,
                        nBlockAwaitDepth,
                        nBlockAge,
                        fnSignMessages,
                        joExtraSignOpts,
                        transactionCustomizerDst
                    );
                    imaState.loopState.s2s.isInProgress = false;
                    await pwa.notifyOnLoopEnd( imaState, "s2s", nIndexS2S );
                } else {
                    bOK = true;
                    if( log.verboseGet() >= log.verboseReversed().debug ) {
                        const strLogPrefix = cc.attention( "S2S Loop:" ) + " ";
                        log.write( strLogPrefix +
                            cc.warning( "Skipped(s2s) due to time framing check" ) + "\n" );
                    }
                }
            }
        } catch ( err ) {
            bOK = false;
            if( log.verboseGet() >= log.verboseReversed().error ) {
                const strError = owaspUtils.extractErrorMessage( err );
                log.write( cc.fatal( "S2S STEP ERROR:" ) + cc.error( " From S-Chain " ) +
                    cc.info( chainNameSrc ) + cc.error( ", error is: " ) + cc.warning( strError ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
            imaState.loopState.s2s.isInProgress = false;
            await pwa.notifyOnLoopEnd( imaState, "s2s", nIndexS2S );
        }
        if( bOK )
            ++ cntOK;
        else
            ++ cntFail;
    }
    joRuntimeOpts.idxChainKnownForS2S = 0; // reset/clear
    joRuntimeOpts.cntChainsKnownForS2S = 0; // reset/clear
    if( "joExtraSignOpts" in joRuntimeOpts )
        delete joRuntimeOpts.joExtraSignOpts; // reset/clear
    if( log.verboseGet() >= log.verboseReversed().debug && ( cntOK > 0 || cntFail > 0 ) ) {
        let s = cc.debug( "Stats for S2S steps:" );
        if( cntOK > 0 ) {
            s += " " + cc.info( cntOK ) +
                cc.success( " S-Chain(s) processed OKay" ) + cc.debug( ", " );
        }
        if( cntFail > 0 ) {
            s += " " + cc.info( cntFail ) +
                cc.error( " S-Chain(s) failed" );
        }
        log.write( s + "\n" );
    }
    return ( cntFail == 0 ) ? true : false;
}

export function composeGasUsageReportFromArray( strName, jarrReceipts ) {
    if( ! ( strName && typeof strName == "string" && jarrReceipts ) )
        return "";
    let i, sumGasUsed = owaspUtils.toBN( "0" ),
        s = "\n" + cc.info( "Gas usage report for " ) + cc.attention( strName ) + "\n";
    for( i = 0; i < jarrReceipts.length; ++ i ) {
        try {
            sumGasUsed = sumGasUsed.add( owaspUtils.toBN( jarrReceipts[i].receipt.gasUsed ) );
            s += "    " + cc.notice( jarrReceipts[i].description ) + cc.debug( "....." ) +
                cc.info( jarrReceipts[i].receipt.gasUsed.toString() ) + "\n";
        } catch ( err ) { }
    }
    s += "    " + cc.attention( "SUM" ) + cc.debug( "....." ) +
        cc.info( sumGasUsed.toString() ) + "\n";
    return { "sumGasUsed": sumGasUsed, "strReport": s };
}

export function printGasUsageReportFromArray( strName, jarrReceipts, details ) {
    if( log.verboseGet() >= log.verboseReversed().information ) {
        details = details || log;
        const jo = composeGasUsageReportFromArray( strName, jarrReceipts );
        if( jo.strReport &&
            typeof jo.strReport == "string" &&
            jo.strReport.length > 0 &&
            jo.sumGasUsed &&
            jo.sumGasUsed.gt( owaspUtils.toBN( "0" ) )
        )
            log.write( jo.strReport );
    }
}

// init helpers

export function noop() {
    return null;
}

export class TransactionCustomizer {
    constructor( gasPriceMultiplier, gasMultiplier ) {
        this.gasPriceMultiplier = gasPriceMultiplier
            ? ( 0.0 + gasPriceMultiplier )
            : null; // null means use current gasPrice or recommendedGasPrice
        this.gasMultiplier = gasMultiplier ? ( 0.0 + gasMultiplier ) : 1.25;
    }
    async computeGasPrice( ethersProvider, maxGasPrice ) {
        const gasPrice =
            owaspUtils.parseIntOrHex(
                owaspUtils.toBN(
                    await ethersProvider.getGasPrice() ).toHexString() );
        if( gasPrice == 0 ||
            gasPrice == null ||
            gasPrice == undefined ||
            gasPrice <= 1000000000
        )
            return owaspUtils.toBN( "1000000000" ).toHexString();
        else if(
            this.gasPriceMultiplier != null &&
            this.gasPriceMultiplier != undefined &&
            this.gasPriceMultiplier >= 0 &&
            maxGasPrice != null &&
            maxGasPrice != undefined
        ) {
            let gasPriceMultiplied = gasPrice * this.gasPriceMultiplier;
            if( gasPriceMultiplied > maxGasPrice )
                gasPriceMultiplied = maxGasPrice;
            return owaspUtils.toBN( maxGasPrice );
        } else
            return gasPrice;
    }
    async computeGas(
        details,
        ethersProvider,
        strContractName, joContract, strMethodName, arrArguments,
        joAccount, strActionName,
        gasPrice, gasValueRecommended, weiHowMuch,
        opts
    ) {
        let estimatedGas = 0;
        const strContractMethodDescription =
            cc.notice( strContractName ) + cc.debug( "(" ) + cc.info( joContract.address ) +
            cc.debug( ")." ) + cc.notice( strMethodName );
        let strArgumentsDescription = "";
        if( arrArguments.length > 0 ) {
            strArgumentsDescription += cc.debug( "( " );
            for( let i = 0; i < arrArguments.length; ++ i ) {
                if( i > 0 )
                    strArgumentsDescription += cc.debug( ", " );
                strArgumentsDescription += cc.j( arrArguments[i] );
            }
            strArgumentsDescription += cc.debug( " )" );
        } else
            strArgumentsDescription += cc.debug( "()" );
        const strContractCallDescription =
            strContractMethodDescription + strArgumentsDescription;
        const strLogPrefix = strContractMethodDescription + " ";
        try {
            const promiseComplete = new Promise( function( resolve, reject ) {
                const doEstimation = async function() {
                    try {
                        details.write(
                            cc.debug( "Estimate-gas of action " ) + cc.info( strActionName ) +
                            cc.debug( "..." ) + "\n" );
                        details.write(
                            cc.debug( "Will estimate-gas " ) + strContractCallDescription +
                            cc.debug( "..." ) + "\n" );
                        const strAccountWalletAddress = joAccount.address();
                        const callOpts = {
                            from: strAccountWalletAddress
                        };
                        if( gasPrice ) {
                            callOpts.gasPrice =
                                owaspUtils.toBN( gasPrice ).toHexString();
                        }
                        if( gasValueRecommended ) {
                            callOpts.gasLimit =
                                owaspUtils.toBN( gasValueRecommended ).toHexString();
                        }
                        if( weiHowMuch )
                            callOpts.value = owaspUtils.toBN( weiHowMuch ).toHexString();
                        details.write(
                            cc.debug( "Call options for estimate-gas " ) + cc.j( callOpts ) +
                            "\n" );
                        estimatedGas =
                            await joContract.estimateGas[strMethodName](
                                ...arrArguments, callOpts );
                        details.write( strLogPrefix +
                            cc.success( "estimate-gas success: " ) + cc.j( estimatedGas ) +
                            "\n" );
                        resolve( estimatedGas );
                    } catch ( err ) {
                        reject( err );
                    }
                };
                doEstimation();
            } );
            await Promise.all( [ promiseComplete ] );
        } catch ( err ) {
            if( log.verboseGet() >= log.verboseReversed().error ) {
                const strError = owaspUtils.extractErrorMessage( err );
                details.write( strLogPrefix + cc.error( "Estimate-gas error: " ) +
                    cc.warning( strError ) +
                    cc.error( ", default recommended gas value " +
                        "will be used instead of estimated" ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
        }
        estimatedGas = owaspUtils.parseIntOrHex( owaspUtils.toBN( estimatedGas ).toString() );
        if( estimatedGas == 0 ) {
            estimatedGas = gasValueRecommended;
            details.write( strLogPrefix +
                cc.warning( "Will use recommended gas " ) + cc.j( estimatedGas ) +
                cc.warning( " instead of estimated" ) +
                "\n" );
        }
        if( this.gasMultiplier > 0.0 ) {
            estimatedGas =
                owaspUtils.parseIntOrHex( ( estimatedGas * this.gasMultiplier ).toString() );
        }

        details.write( strLogPrefix +
            cc.debug( "Final amount of gas is " ) + cc.j( estimatedGas ) +
            "\n" );
        return estimatedGas;
    }
};

let gTransactionCustomizerMainNet = null;
let gTransactionCustomizerSChain = null;
let gTransactionCustomizerSChainTarget = null;

export function getTransactionCustomizerForMainNet() {
    if( gTransactionCustomizerMainNet )
        return gTransactionCustomizerMainNet;
    gTransactionCustomizerMainNet = new TransactionCustomizer( 1.25, 1.25 );
    return gTransactionCustomizerMainNet;
}

export function getTransactionCustomizerForSChain() {
    if( gTransactionCustomizerSChain )
        return gTransactionCustomizerSChain;
    gTransactionCustomizerSChain = new TransactionCustomizer( null, 1.25 );
    return gTransactionCustomizerSChain;
}

export function getTransactionCustomizerForSChainTarget() {
    if( gTransactionCustomizerSChainTarget )
        return gTransactionCustomizerSChainTarget;
    gTransactionCustomizerSChainTarget = new TransactionCustomizer( null, 1.25 );
    return gTransactionCustomizerSChainTarget;
}

export async function getBalanceEth(
    isMainNet,
    ethersProvider,
    chainId,
    joAccount,
    contractERC20
) {
    const strLogPrefix = cc.info( "getBalanceEth() call" ) + " ";
    try {
        if( ! ( ethersProvider && joAccount ) )
            return "<no-data>";
        const strAddress = joAccount.address();
        if( ( !isMainNet ) && contractERC20 ) {
            const balance =
                await contractERC20.callStatic.balanceOf( strAddress, { from: strAddress } );
            return balance;
        }
        const balance = await ethersProvider.getBalance( strAddress );
        return balance;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            const strError = owaspUtils.extractErrorMessage( err );
            log.write( strLogPrefix + cc.fatal( "ERROR:" ) + " " +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n" );
        }
    }
    return "<no-data-or-error>";
}

export async function getBalanceErc20(
    isMainNet,
    ethersProvider,
    chainId,
    joAccount,
    strCoinName,
    joABI
) {
    const strLogPrefix = cc.info( "getBalanceErc20() call" ) + " ";
    try {
        if( ! ( ethersProvider && joAccount && strCoinName && joABI && ( strCoinName + "_abi" ) in
                joABI &&
            ( strCoinName + "_address" ) in joABI )
        )
            return "<no-data>";
        const strAddress = joAccount.address();
        const contractERC20 = new owaspUtils.ethersMod.ethers.Contract(
            joABI[strCoinName + "_address"],
            joABI[strCoinName + "_abi"],
            ethersProvider
        );
        const balance =
            await contractERC20.callStatic.balanceOf( strAddress, { from: strAddress } );
        return balance;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            const strError = owaspUtils.extractErrorMessage( err );
            log.write( strLogPrefix + cc.fatal( "ERROR:" ) + " " +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n" );
        }
    }
    return "<no-data-or-error>";
}

export async function getOwnerOfErc721(
    isMainNet,
    ethersProvider,
    chainId,
    joAccount,
    strCoinName,
    joABI,
    idToken
) {
    const strLogPrefix = cc.info( "getOwnerOfErc721() call" ) + " ";
    try {
        if( ! ( ethersProvider && joAccount && strCoinName && joABI && ( strCoinName + "_abi" ) in
                joABI &&
            ( strCoinName + "_address" ) in joABI )
        )
            return "<no-data>";
        const strAddress = joAccount.address();
        const contractERC721 = owaspUtils.ethersMod.ethers.Contract(
            joABI[strCoinName + "_address"],
            joABI[strCoinName + "_abi"],
            ethersProvider
        );
        const owner =
            await contractERC721.callStatic.ownerOf( idToken, { from: strAddress } );
        return owner;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            const strError = owaspUtils.extractErrorMessage( err );
            log.write( strLogPrefix + cc.fatal( "ERROR:" ) + " " + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
    }
    return "<no-data-or-error>";
}

export async function getBalanceErc1155(
    isMainNet,
    ethersProvider,
    chainId,
    joAccount,
    strCoinName,
    joABI,
    idToken
) {
    const strLogPrefix = cc.info( "getBalanceErc1155() call" ) + " ";
    try {
        if( ! ( ethersProvider && joAccount && strCoinName && joABI && ( strCoinName + "_abi" ) in
                joABI &&
            ( strCoinName + "_address" ) in joABI )
        )
            return "<no-data>";
        const strAddress = joAccount.address();
        const contractERC1155 = new owaspUtils.ethersMod.ethers.Contract(
            joABI[strCoinName + "_address"],
            joABI[strCoinName + "_abi"],
            ethersProvider
        );
        const balance =
            await contractERC1155.callStatic.balanceOf(
                strAddress, idToken, { from: strAddress } );
        return balance;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            const strError = owaspUtils.extractErrorMessage( err );
            log.write( strLogPrefix + cc.fatal( "ERROR:" ) + " " + cc.error( strError ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
    }
    return "<no-data-or-error>";
}

export async function mintErc20(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    strAddressMintTo,
    nAmount,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "mintErc20() init";
    const strLogPrefix = cc.info( "mintErc20() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix +
            cc.debug( "Mint " ) + cc.info( "ERC20" ) + cc.debug( " token amount " ) +
            cc.notice( nAmount ) + "\n" );
        if( ! ( ethersProvider && joAccount && strAddressMintTo &&
            typeof strAddressMintTo == "string" && strAddressMintTo.length > 0 &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "mintErc20() instantiate token contract";
        const contract = new owaspUtils.ethersMod.ethers.Contract(
            strTokenContractAddress,
            joTokenContractABI,
            ethersProvider
        );
        const arrArgumentsMint = [
            strAddressMintTo,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmount ).toHexString() )
        ];
        const weiHowMuchMint = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) + cc.debug( "=" ) +
            cc.j( gasPrice ) + "\n" );
        const estimatedGasMint =
            await tc.computeGas(
                details,
                ethersProvider,
                "ERC20", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchMint,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasMint ) + "\n" );
        strActionName = "Mint ERC20";
        const isIgnoreMint = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProvider,
                "ERC20", contract, "mint", arrArgumentsMint,
                joAccount, strActionName, isIgnoreMint,
                gasPrice, estimatedGasMint, weiHowMuchMint,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await payedCall(
                details,
                ethersProvider,
                "ERC20", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, estimatedGasMint, weiHowMuchMint,
                opts
            );
        printGasUsageReportFromArray( "MINT ERC20 ", [ {
            "description": "mintErc20()/mint",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "mintErc20", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in mintErc20() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in mintErc20() during " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "mintErc20()", false );
        details.close();
        return false;
    }
}

export async function mintErc721(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    strAddressMintTo,
    idToken,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "mintErc721() init";
    const strLogPrefix = cc.info( "mintErc721() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix +
            cc.debug( "Mint " ) + cc.info( "ERC721" ) + cc.debug( " token ID " ) +
            cc.notice( idToken ) + "\n" );
        if( ! ( ethersProvider && joAccount && strAddressMintTo &&
            typeof strAddressMintTo == "string" && strAddressMintTo.length > 0 &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "mintErc721() instantiate token contract";
        const contract =
            new owaspUtils.ethersMod.ethers.Contract(
                strTokenContractAddress,
                joTokenContractABI,
                ethersProvider
            );
        const arrArgumentsMint = [
            strAddressMintTo,
            owaspUtils.ensureStartsWith0x(
                owaspUtils.toBN( idToken ).toHexString() )
        ];
        const weiHowMuchMint = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGasMint =
            await tc.computeGas(
                details,
                ethersProvider,
                "ERC721", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchMint,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasMint ) +
            "\n" );
        strActionName = "Mint ERC721";
        const isIgnoreMint = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProvider,
                "ERC721", contract, "mint", arrArgumentsMint,
                joAccount, strActionName, isIgnoreMint,
                gasPrice, estimatedGasMint, weiHowMuchMint,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await payedCall(
                details,
                ethersProvider,
                "ERC721", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, estimatedGasMint, weiHowMuchMint,
                opts
            );
        printGasUsageReportFromArray( "MINT ERC721 ", [ {
            "description": "mintErc721()/mint",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "mintErc721", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in mintErc721() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in mintErc721() during " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "mintErc721()", false );
        details.close();
        return false;
    }
}

export async function mintErc1155(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    strAddressMintTo,
    idToken,
    nAmount,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "mintErc1155() init";
    const strLogPrefix = cc.info( "mintErc1155() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix +
            cc.debug( "Mint " ) + cc.info( "ERC1155" ) + cc.debug( " token ID " ) +
            cc.notice( idToken ) + cc.debug( " token amount " ) + cc.notice( nAmount ) +
            "\n" );
        if( ! ( ethersProvider && joAccount && strAddressMintTo &&
            typeof strAddressMintTo == "string" && strAddressMintTo.length > 0 &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "mintErc1155() instantiate token contract";
        const contract =
            new owaspUtils.ethersMod.ethers.Contract(
                strTokenContractAddress,
                joTokenContractABI,
                ethersProvider
            );
        const arrArgumentsMint = [
            strAddressMintTo,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( idToken ).toHexString() ),
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmount ).toHexString() ),
            [] // data
        ];
        const weiHowMuchMint = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasMint =
            await tc.computeGas(
                details,
                ethersProvider,
                "ERC1155", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchMint,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasMint ) + "\n" );
        strActionName = "Mint ERC1155";
        const isIgnoreMint = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProvider,
                "ERC1155", contract, "mint", arrArgumentsMint,
                joAccount, strActionName, isIgnoreMint,
                gasPrice, estimatedGasMint, weiHowMuchMint,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await payedCall(
                details,
                ethersProvider,
                "ERC1155", contract, "mint", arrArgumentsMint,
                joAccount, strActionName,
                gasPrice, estimatedGasMint, weiHowMuchMint,
                opts
            );
        printGasUsageReportFromArray( "MINT ERC1155 ", [ {
            "description": "mintErc1155()/mint",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "mintErc1155", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in mintErc1155() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in mintErc1155() during " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "mintErc1155()", false );
        details.close();
        return false;
    }
}

export async function burnErc20(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    strAddressBurnFrom,
    nAmount,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "burnErc20() init";
    const strLogPrefix = cc.info( "burnErc20() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix +
            cc.debug( "Burn " ) + cc.info( "ERC20" ) +
            cc.debug( " token amount " ) + cc.notice( nAmount ) +
            "\n" );
        if( ! ( ethersProvider && joAccount && strAddressBurnFrom &&
            typeof strAddressBurnFrom == "string" && strAddressBurnFrom.length > 0 &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "burnErc20() instantiate token contract";
        const contract =
            new owaspUtils.ethersMod.ethers.Contract(
                strTokenContractAddress,
                joTokenContractABI,
                ethersProvider
            );
        const arrArgumentsBurn = [
            strAddressBurnFrom,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmount ).toHexString() )
        ];
        const weiHowMuchBurn = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasBurn =
            await tc.computeGas(
                details,
                ethersProvider,
                "ERC20", contract, "burnFrom", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchBurn,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasBurn ) + "\n" );
        strActionName = "Burn ERC20";
        const isIgnoreBurn = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProvider,
                "ERC20", contract, "burnFrom", arrArgumentsBurn,
                joAccount, strActionName, isIgnoreBurn,
                gasPrice, estimatedGasBurn, weiHowMuchBurn,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await payedCall(
                details,
                ethersProvider,
                "ERC20", contract, "burnFrom", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, estimatedGasBurn, weiHowMuchBurn,
                opts
            );
        printGasUsageReportFromArray( "BURN ERC20 ", [ {
            "description": "burnErc20()/burn",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "burnErc20", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in burnErc20() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in burnErc20() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "burnErc20()", false );
        details.close();
        return false;
    }
}

export async function burnErc721(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    idToken,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "burnErc721() init";
    const strLogPrefix = cc.info( "burnErc721() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix +
            cc.debug( "Burn " ) + cc.info( "ERC721" ) +
            cc.debug( " token ID " ) + cc.notice( idToken ) + "\n" );
        if( ! ( ethersProvider && joAccount &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "burnErc721() instantiate token contract";
        const contract =
            new owaspUtils.ethersMod.ethers.Contract(
                strTokenContractAddress,
                joTokenContractABI,
                ethersProvider
            );
        const arrArgumentsBurn = [
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( idToken ).toHexString() )
        ];
        const weiHowMuchBurn = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
        const estimatedGasBurn =
            await tc.computeGas(
                details,
                ethersProvider,
                "ERC721", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchBurn,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasBurn ) + "\n" );
        strActionName = "Burn ERC721";
        const isIgnoreBurn = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProvider,
                "ERC721", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName, isIgnoreBurn,
                gasPrice, estimatedGasBurn, weiHowMuchBurn,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {
            isCheckTransactionToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await payedCall(
                details,
                ethersProvider,
                "ERC721", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, estimatedGasBurn, weiHowMuchBurn,
                opts
            );
        printGasUsageReportFromArray( "BURN ERC721 ", [ {
            "description": "burnErc721()/burn",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "burnErc721", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in burnErc721() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) +
                    "\n" + cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix +
                cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Error in burnErc721() during " +
                strActionName + ": " ) + cc.error( strError ) + cc.error( ", stack is: " ) +
                "\n" + cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "burnErc721()", false );
        details.close();
        return false;
    }
}

export async function burnErc1155(
    ethersProvider,
    chainId,
    chainName,
    joAccount,
    strAddressBurnFrom,
    idToken,
    nAmount,
    strTokenContractAddress,
    joTokenContractABI,
    tc
) {
    let strActionName = "burnErc1155() init";
    const strLogPrefix = cc.info( "burnErc1155() call" ) + " ";
    const details = log.createMemoryStream();
    try {
        details.write( strLogPrefix +
            cc.debug( "Burn " ) + cc.info( "ERC1155" ) + cc.debug( " token ID " ) +
            cc.notice( idToken ) + cc.debug( " token amount " ) + cc.notice( nAmount ) +
            "\n" );
        if( ! ( ethersProvider && joAccount && strAddressBurnFrom &&
            typeof strAddressBurnFrom == "string" && strAddressBurnFrom.length > 0 &&
            strTokenContractAddress && typeof strTokenContractAddress == "string" &&
            strTokenContractAddress.length > 0 && joTokenContractABI
        ) )
            throw new Error( "Missing valid arguments" );
        strActionName = "burnErc1155() instantiate token contract";
        const contract =
            new owaspUtils.ethersMod.ethers.Contract(
                strTokenContractAddress,
                joTokenContractABI,
                ethersProvider
            );
        const arrArgumentsBurn = [
            strAddressBurnFrom,
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( idToken ).toHexString() ),
            owaspUtils.ensureStartsWith0x( owaspUtils.toBN( nAmount ).toHexString() )
        ];
        const weiHowMuchBurn = undefined;
        const gasPrice = await tc.computeGasPrice( ethersProvider, 200000000000 );
        details.write( strLogPrefix +
            cc.debug( "Using computed " ) + cc.info( "gasPrice" ) +
            cc.debug( "=" ) + cc.j( gasPrice ) +
            "\n" );
        const estimatedGasBurn =
            await tc.computeGas(
                details,
                ethersProvider,
                "ERC1155", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, 10000000, weiHowMuchBurn,
                null
            );
        details.write( strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) +
            cc.debug( "=" ) + cc.notice( estimatedGasBurn ) +
            "\n" );
        strActionName = "Burn ERC1155";
        const isIgnoreBurn = false;
        const strErrorOfDryRun =
            await dryRunCall(
                details,
                ethersProvider,
                "ERC1155", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName, isIgnoreBurn,
                gasPrice, estimatedGasBurn, weiHowMuchBurn,
                null
            );
        if( strErrorOfDryRun )
            throw new Error( strErrorOfDryRun );

        const opts = {

            ToSchain: ( chainNameDst !== "Mainnet" ) ? true : false
        };
        const joReceipt =
            await payedCall(
                details,
                ethersProvider,
                "ERC1155", contract, "burn", arrArgumentsBurn,
                joAccount, strActionName,
                gasPrice, estimatedGasBurn, weiHowMuchBurn,
                opts
            );
        printGasUsageReportFromArray( "BURN ERC1155 ", [ {
            "description": "burnErc1155()/burn",
            "receipt": joReceipt
        } ], details );
        if( log.exposeDetailsGet() )
            details.exposeDetailsTo( log, "burnErc1155", true );
        details.close();
        return joReceipt; // can be used as "true" boolean value
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            const strError = owaspUtils.extractErrorMessage( err );
            if( log.id != details.id ) {
                log.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " Error in burnErc1155() during " + strActionName + ": " ) +
                    cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
            details.write( strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                cc.error( " Error in burnErc1155() during " + strActionName + ": " ) +
                cc.error( strError ) + cc.error( ", stack is: " ) + "\n" +
                cc.stack( err.stack ) + "\n" );
        }
        details.exposeDetailsTo( log, "burnErc1155()", false );
        details.close();
        return false;
    }
}
