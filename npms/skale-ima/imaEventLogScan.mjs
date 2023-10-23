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
 * @file imaEventLogScan.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as log from "../skale-log/log.mjs";
import * as cc from "../skale-cc/cc.mjs";

import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as rpcCall from "../../agent/rpcCall.mjs";
import * as imaHelperAPIs from "./imaHelperAPIs.mjs";
import * as imaTransferErrorHandling from "./imaTransferErrorHandling.mjs";

export function createProgressiveEventsScanPlan( details, nLatestBlockNumber ) {
    // assume Main Net mines 6 blocks per minute
    const blocksInOneMinute = 6;
    const blocksInOneHour = blocksInOneMinute * 60;
    const blocksInOneDay = blocksInOneHour * 24;
    const blocksInOneWeek = blocksInOneDay * 7;
    const blocksInOneMonth = blocksInOneDay * 31;
    const blocksInOneYear = blocksInOneDay * 366;
    const blocksInThreeYears = blocksInOneYear * 3;
    const arrProgressiveEventsScanPlanA = [ {
        "nBlockFrom":
            nLatestBlockNumber - blocksInOneDay,
        "nBlockTo": "latest",
        "type": "1 day"
    }, {
        "nBlockFrom":
            nLatestBlockNumber - blocksInOneWeek,
        "nBlockTo": "latest",
        "type": "1 week"
    }, {
        "nBlockFrom":
            nLatestBlockNumber - blocksInOneMonth,
        "nBlockTo": "latest",
        "type": "1 month"
    }, {
        "nBlockFrom":
            nLatestBlockNumber - blocksInOneYear,
        "nBlockTo": "latest",
        "type": "1 year"
    }, {
        "nBlockFrom":
            nLatestBlockNumber - blocksInThreeYears,
        "nBlockTo": "latest",
        "type": "3 years"
    } ];
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
    ethersProvider, attempts, joContract, joABI, strEventName,
    nBlockFrom, nBlockTo, joFilter
) {
    if( ! imaTransferErrorHandling.getEnabledProgressiveEventsScan() ) {
        details.write( strLogPrefix +
            cc.fatal( "IMPORTANT NOTICE:" ) + " " +
            cc.warning( "Will skip " ) + cc.attention( "progressive" ) +
            cc.warning( " events scan in block range from " ) +
            cc.j( nBlockFrom ) + cc.warning( " to " ) + cc.j( nBlockTo ) +
            cc.warning( " because it's " ) + cc.error( "DISABLED" ) + "\n" );
        return await safeGetPastEvents(
            details, strLogPrefix,
            ethersProvider, attempts, joContract, joABI, strEventName,
            nBlockFrom, nBlockTo, joFilter
        );
    }
    const nLatestBlockNumber = owaspUtils.toBN(
        await imaHelperAPIs.safeGetBlockNumber( details, 10, ethersProvider ) );
    const nLatestBlockNumberPlus1 = nLatestBlockNumber.add( owaspUtils.toBN( 1 ) );
    let isLastLatest = false;
    if( nBlockTo == "latest" ) {
        isLastLatest = true;
        nBlockTo = nLatestBlockNumberPlus1;
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Iterative scan up to latest block " ) +
                cc.attention( "#" ) + cc.info( nBlockTo.toHexString() ) +
                cc.debug( " assumed instead of " ) + cc.attention( "latest" ) + "\n" );
        }
    } else {
        nBlockTo = owaspUtils.toBN( nBlockTo );
        if( nBlockTo.gte( nLatestBlockNumber ) )
            isLastLatest = true;
    }
    nBlockFrom = owaspUtils.toBN( nBlockFrom );
    const nBlockZero = owaspUtils.toBN( 0 );
    const isFirstZero = ( nBlockFrom.eq( nBlockZero ) ) ? true : false;
    if( ! ( isFirstZero && isLastLatest ) ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Will skip " ) + cc.attention( "progressive" ) +
                cc.debug( " scan and use scan in block range from " ) +
                cc.info( nBlockFrom.toHexString() ) + cc.debug( " to " ) +
                cc.info( nBlockTo.toHexString() ) + "\n" );
        }
        return await safeGetPastEvents(
            details, strLogPrefix,
            ethersProvider, attempts, joContract, joABI, strEventName,
            nBlockFrom, nBlockTo, joFilter
        );
    }
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        details.write( strLogPrefix + cc.debug( "Will run " ) +
            cc.attention( "progressive" ) + cc.debug( " scan..." ) + "\n" );
        details.write( strLogPrefix + cc.debug( "Current latest block number is " ) +
            cc.info( nLatestBlockNumber.toHexString() ) + "\n" );
    }
    const arrProgressiveEventsScanPlan =
        createProgressiveEventsScanPlan( details, nLatestBlockNumberPlus1 );
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        details.write( cc.debug( "Composed " ) + cc.attention( "progressive" ) +
            cc.debug( " scan plan is: " ) + cc.j( arrProgressiveEventsScanPlan ) + "\n" );
    }
    let joLastPlan = { "nBlockFrom": 0, "nBlockTo": "latest", "type": "entire block range" };
    for( let idxPlan = 0; idxPlan < arrProgressiveEventsScanPlan.length; ++idxPlan ) {
        const joPlan = arrProgressiveEventsScanPlan[idxPlan];
        if( joPlan.nBlockFrom < 0 )
            continue;
        joLastPlan = joPlan;
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Progressive scan of " ) +
                cc.attention( "getPastEvents" ) + cc.debug( "/" ) + cc.info( strEventName ) +
                cc.debug( ", from block " ) + cc.info( joPlan.nBlockFrom ) +
                cc.debug( ", to block " ) + cc.info( joPlan.nBlockTo ) +
                cc.debug( ", block range is " ) + cc.info( joPlan.type ) +
                cc.debug( "..." ) + "\n" );
        }
        try {
            const joAllEventsInBlock =
                await safeGetPastEventsIterative(
                    details, strLogPrefix,
                    ethersProvider, attempts, joContract, joABI, strEventName,
                    joPlan.nBlockFrom, joPlan.nBlockTo, joFilter
                );
            if( joAllEventsInBlock && joAllEventsInBlock.length > 0 ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    details.write( strLogPrefix + cc.success( "Progressive scan of " ) +
                        cc.attention( "getPastEvents" ) + cc.debug( "/" ) +
                        cc.info( strEventName ) + cc.success( ", from block " ) +
                        cc.info( joPlan.nBlockFrom ) + cc.success( ", to block " ) +
                        cc.info( joPlan.nBlockTo ) + cc.success( ", block range is " ) +
                        cc.info( joPlan.type ) + cc.success( ", found " ) +
                        cc.info( joAllEventsInBlock.length ) + cc.success( " event(s)" ) + "\n" );
                }
                return joAllEventsInBlock;
            }
        } catch ( err ) {}
    }
    if( log.verboseGet() >= log.verboseReversed().error ) {
        details.write( strLogPrefix + cc.error( "Could not get Event \"" ) +
            cc.info( strEventName ) + cc.error( "\", from block " ) +
            cc.info( joLastPlan.nBlockFrom ) + cc.error( ", to block " ) +
            cc.info( joLastPlan.nBlockTo ) + cc.debug( ", block range is " ) +
            cc.info( joLastPlan.type ) + cc.error( ", using " ) + cc.attention( "progressive" ) +
            cc.error( " event scan" ) + "\n" );
    }
    return [];
}

export async function getContractCallEvents(
    details, strLogPrefix, ethersProvider,
    joContract, joABI, strEventName,
    nBlockNumber, strTxHash, joFilter
) {
    joFilter = joFilter || {};
    nBlockNumber = owaspUtils.toBN( nBlockNumber );
    const n10 = owaspUtils.toBN( 10 );
    let nBlockFrom = nBlockNumber.sub( n10 ), nBlockTo = nBlockNumber.add( n10 );
    const nBlockZero = owaspUtils.toBN( 0 );
    const nLatestBlockNumber = owaspUtils.toBN(
        await imaHelperAPIs.safeGetBlockNumber( details, 10, ethersProvider ) );
    const nLatestBlockNumberPlus1 = nLatestBlockNumber.add( owaspUtils.toBN( 1 ) );
    if( nBlockFrom.lt( nBlockZero ) )
        nBlockFrom = nBlockZero;
    if( nBlockTo.gte( nLatestBlockNumber ) )
        nBlockTo = nLatestBlockNumberPlus1;
    const joAllEventsInBlock =
        await safeGetPastEventsIterative(
            details, strLogPrefix, ethersProvider, 10, joContract, joABI, strEventName,
            nBlockFrom, nBlockTo, joFilter );
    const joAllTransactionEvents = []; let i;
    for( i = 0; i < joAllEventsInBlock.length; ++i ) {
        const joEvent = joAllEventsInBlock[i];
        if( "transactionHash" in joEvent && joEvent.transactionHash == strTxHash )
            joAllTransactionEvents.push( joEvent );
    }
    return joAllTransactionEvents;
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
            if( log.verboseGet() >= log.verboseReversed().error ) {
                details.write( cc.error( "Cannot call " ) + cc.note( strFnName + "()" ) +
                    cc.error( " via " ) + cc.u( u ) +
                    cc.warning( " because server is off-line" ) + "\n" );
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
        if( log.verboseGet() >= log.verboseReversed().error ) {
            details.write( cc.fatal( "ERROR:" ) + cc.error( " Failed call to " ) +
                cc.note( strFnName + "()" ) + cc.error( " via " ) + cc.u( u ) +
                cc.error( " after " ) + cc.info( cntAttempts ) + cc.error( " attempts " ) + "\n" );
        }
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
            details.write( cc.error( "Failed call attempt " ) + cc.info( idxAttempt ) +
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
            ret = await ethersProvider[strFnName]( txHash );
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
    if( ( idxAttempt + 1 ) > cntAttempts && ( txReceipt === "" || txReceipt === undefined ) ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            details.write( cc.fatal( "ERROR:" ) + cc.error( " Failed call to " ) +
                cc.note( strFnName + "()" ) + cc.error( " via " ) + cc.u( u ) +
                cc.error( " after " ) + cc.info( cntAttempts ) + cc.error( " attempts " ) + "\n" );
        }
        throw new Error(
            "Failed call to " + strFnName + "() via " + u.toString() +
            " after " + cntAttempts + " attempts" );
    }
    return ret;
}

export function safeGetUseWen3ForPastEvents() {
    return true;
}

export async function safeGetPastEvents(
    details, strLogPrefix,
    ethersProvider, cntAttempts, joContract, joABI, strEventName,
    nBlockFrom, nBlockTo, joFilter, retValOnFail, throwIfServerOffline
) {
    if( safeGetUseWen3ForPastEvents() && joABI ) {
        return await safeGetPastEventsViaWeb3Bootstrap(
            details, strLogPrefix,
            ethersProvider, cntAttempts, joContract, joABI, strEventName,
            nBlockFrom, nBlockTo, joFilter, retValOnFail, throwIfServerOffline
        );
    }
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
    const nLatestBlockNumber = owaspUtils.toBN(
        await imaHelperAPIs.safeGetBlockNumber( details, 10, ethersProvider ) );
    let idxAttempt = 1;
    const strErrorTextAboutNotExistingEvent =
        "Event \"" + strEventName + "\" doesn't exist in this contract";
    if( nBlockTo == "latest" ) {
        const nLatestBlockNumberPlus1 = nLatestBlockNumber.add( owaspUtils.toBN( 1 ) );
        nBlockTo = nLatestBlockNumberPlus1;
    } else
        nBlockTo = owaspUtils.toBN( nBlockTo );
    nBlockFrom = owaspUtils.toBN( nBlockFrom );
    try {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "First time, will query filter " ) +
                cc.j( joFilter ) + cc.debug( " on contract " ) + cc.info( joContract.address ) +
                cc.debug( " from block " ) + cc.info( nBlockFrom.toHexString() ) +
                cc.debug( " to block " ) + cc.info( nBlockTo.toHexString() ) +
                cc.debug( " while current latest block number on chain is " ) +
                cc.info( nLatestBlockNumber.toHexString() ) + "\n" );
        }
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
            details.write( strLogPrefix + cc.error( "Failed filtering attempt " ) +
                cc.info( idxAttempt ) + cc.error( " for event " ) + cc.note( strEventName ) +
                cc.error( " via " ) + cc.u( u ) + cc.error( ", from block " ) +
                cc.warning( nBlockFrom.toHexString() ) +
                cc.error( ", to block " ) + cc.warning( nBlockTo.toHexString() ) +
                cc.error( ", error is: " ) + cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
        if( owaspUtils.extractErrorMessage( err )
            .indexOf( strErrorTextAboutNotExistingEvent ) >= 0
        ) {
            if( log.verboseGet() >= log.verboseReversed().error ) {
                details.write( strLogPrefix + cc.error( "Did stopped filtering of " ) +
                    cc.note( strEventName ) + cc.error( " event because no such event " +
                    "exist in smart contract " ) + "\n" );
            }
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
            if( log.verboseGet() >= log.verboseReversed().error ) {
                details.write( strLogPrefix + cc.error( "Cannot do " ) + cc.note( strEventName ) +
                    cc.error( " event filtering via " ) + cc.u( u ) +
                    cc.warning( " because server is off-line" ) + "\n" );
            }
            throw new Error(
                "Cannot do " + strEventName + " event filtering, from block " +
                nBlockFrom.toHexString() + ", to block " + nBlockTo.toHexString() +
                " via " + u.toString() + " because server is off-line"
            );
        }
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.warning( "Repeat " ) + cc.note( strEventName ) +
                cc.error( " event filtering via " ) + cc.u( u ) +
                cc.warning( ", attempt " ) + cc.info( idxAttempt ) + "\n" );
        }
        try {
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "Attempt " ) + cc.info( idxAttempt ) +
                    cc.debug( ", will query filter " ) + cc.j( joFilter ) +
                    cc.debug( " on contract " ) + cc.info( joContract.address ) +
                    cc.debug( " from block " ) + cc.info( nBlockFrom.toHexString() ) +
                    cc.debug( " to block " ) + cc.info( nBlockTo.toHexString() ) + "\n" );
            }
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
                details.write( strLogPrefix + cc.error( "Failed filtering attempt " ) +
                    cc.info( idxAttempt ) + cc.error( " for event " ) + cc.note( strEventName ) +
                    cc.error( " via " ) + cc.u( u ) + cc.error( ", from block " ) +
                    cc.info( nBlockFrom.toHexString() ) + cc.error( ", to block " ) +
                    cc.info( nBlockTo.toHexString() ) + cc.error( ", error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
            if( owaspUtils.extractErrorMessage( err )
                .indexOf( strErrorTextAboutNotExistingEvent ) >= 0
            ) {
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    details.write( strLogPrefix + cc.error( "Did stopped " ) +
                        cc.note( strEventName ) + cc.error( " event filtering because " +
                        "no such event exist in smart contract " ) + "\n" );
                }
                return ret;
            }
        }
        ++ idxAttempt;
    }
    if( ( idxAttempt + 1 ) === cntAttempts && ret === "" ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            details.write( strLogPrefix + cc.fatal( "ERROR:" ) +
                cc.error( " Failed filtering attempt for " ) + cc.note( strEventName ) +
                + cc.error( " event via " ) + cc.u( u ) + cc.error( ", from block " ) +
                cc.info( nBlockFrom.toHexString() ) + cc.error( ", to block " ) +
                cc.info( nBlockTo.toHexString() ) + cc.error( " after " ) + cc.info( cntAttempts ) +
                cc.error( " attempts " ) + "\n" );
        }
        throw new Error(
            "Failed filtering attempt for " + strEventName + " event, from block " +
            nBlockFrom.toHexString() + ", to block " + nBlockTo.toHexString() +
            " via " + u.toString() + " after " + cntAttempts + " attempts"
        );
    }
    return ret;
}

function transformBlockNumberToW3( n ) {
    if( n == "latest" || typeof n == "number" )
        return n;
    if( typeof n == "object" && "toHexString" in n )
        return n.toHexString();
    return n;
}

function transformEthersProviderToW3( ethersProvider ) {
    const strURL = owaspUtils.ethersProviderToUrl( ethersProvider );
    return owaspUtils.getWeb3FromURL( strURL, log );
}

function transformEtherContractToW3( joContract, joABI, w3provider ) {
    // console.log( "w3provider is", Object.keys( w3provider ) );
    // console.log( Object.keys( owaspUtils.w3mod ) );
    // console.log( Object.keys( owaspUtils.modules ) );
    // console.log( Object.keys( owaspUtils.w3mod.Eth ) );
    // console.log( Object.keys( owaspUtils.w3mod.Eth.providers ) );
    // process.exit( 0 );
    // return new owaspUtils.w3mod.eth.Contract( joABI, joContract.address );
    return new w3provider.eth.Contract( joABI.abi, joContract.address );
}

export async function safeGetPastEventsViaWeb3Bootstrap(
    details, strLogPrefix, ethersProvider, cntAttempts,
    joContract, joABI, strEventName,
    nBlockFrom, nBlockTo, joFilter,
    retValOnFail, throwIfServerOffline
) {
    const w3provider = transformEthersProviderToW3( ethersProvider );
    return await safeGetPastEventsViaWeb3(
        details, strLogPrefix, w3provider, cntAttempts,
        transformEtherContractToW3( joContract, joABI, w3provider ), joABI, strEventName,
        transformBlockNumberToW3( nBlockFrom ), transformBlockNumberToW3( nBlockTo ),
        joFilter, retValOnFail, throwIfServerOffline
    );
}

export async function safeGetPastEventsViaWeb3(
    details, strLogPrefix, w3, cntAttempts,
    joContract, joABI, strEventName,
    nBlockFrom, nBlockTo, joFilter,
    retValOnFail, throwIfServerOffline
) {
    // console.log( "--- joABI ---", joABI ? Object.keys( joABI ) : "<<<NULL ABI>>>" );
    // console.log( "--- strEventName ---", strEventName );
    const strFnName = "getPastEvents";
    const u = owaspUtils.getUrlFromW3( w3 );
    const nWaitStepMilliseconds = 10 * 1000;
    if( throwIfServerOffline == null || throwIfServerOffline == undefined )
        throwIfServerOffline = true;
    cntAttempts = owaspUtils.parseIntOrHex( cntAttempts ) < 1 ? 1 : owaspUtils.parseIntOrHex( cntAttempts );
    if( retValOnFail == null || retValOnFail == undefined )
        retValOnFail = "";
    let ret = retValOnFail;
    let idxAttempt = 1;
    const strErrorTextAboutNotExistingEvent = "Event \"" + strEventName +
        "\" doesn't exist in this contract";
    try {
        ret = await joContract[strFnName]( "" + strEventName, {
            filter: joFilter,
            fromBlock: owaspUtils.toBN( nBlockFrom ),
            toBlock: ( nBlockTo == "latest" ) ? nBlockTo : owaspUtils.toBN( nBlockTo )
        } );
        return ret;
    } catch ( err ) {
        ret = retValOnFail;
        details.write( cc.error( "Failed call attempt " ) + cc.info( idxAttempt ) +
            cc.error( " to " ) + cc.note( strFnName + "()" ) + cc.error( " via " ) + cc.u( u ) +
            cc.error( ", from block " ) + cc.warning( nBlockFrom ) + cc.error( ", to block " ) +
            cc.warning( nBlockTo ) + cc.error( ", error is: " ) +
            cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n" );
        if( owaspUtils.extractErrorMessage( err ).indexOf( strErrorTextAboutNotExistingEvent ) >=
            0 ) {
            details.write( cc.error( "Did stopped calls to " ) + cc.note( strFnName + "()" ) +
                cc.error( " because event " ) + cc.notice( strEventName ) +
                cc.error( " does not exist in smart contract " ) + "\n" );
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
            details.write( cc.error( "Cannot call " ) + cc.note( strFnName + "()" ) +
                cc.error( " via " ) + cc.u( u ) +
                cc.warning( " because server is off-line" ) + "\n" );
            throw new Error( "Cannot " + strFnName + "(), from block " + nBlockFrom +
                ", to block " + nBlockTo + " via " + u.toString() + " because server is off-line"
            );
        } details.write( cc.warning( "Repeat call to " ) + cc.note( strFnName + "()" ) +
            cc.error( " via " ) + cc.u( u ) + cc.warning( ", attempt " ) + cc.info( idxAttempt ) +
            "\n" );
        // await sleep( nWaitStepMilliseconds );
        try {
            ret = await joContract[strFnName]( "" + strEventName, {
                filter: joFilter,
                fromBlock: nBlockFrom,
                toBlock: nBlockTo
            } );
            return ret;
        } catch ( err ) {
            ret = retValOnFail;
            details.write( cc.error( "Failed call attempt " ) + cc.info( idxAttempt ) +
                cc.error( " to " ) + cc.note( strFnName + "()" ) + cc.error( " via " ) + cc.u( u ) +
                cc.error( ", from block " ) + cc.warning( nBlockFrom ) + cc.error( ", to block " ) +
                cc.warning( nBlockTo ) + cc.error( ", error is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) + "\n" );
            if( owaspUtils.extractErrorMessage( err )
                .indexOf( strErrorTextAboutNotExistingEvent ) >= 0 ) {
                details.write( cc.error( "Did stopped calls to " ) + cc.note( strFnName + "()" ) +
                    cc.error( " because event " ) + cc.notice( strEventName ) +
                    cc.error( " does not exist in smart contract " ) + "\n" );
                return ret;
            }
        }
        ++ idxAttempt;
    }
    if( ( idxAttempt + 1 ) === cntAttempts && ret === "" ) {
        details.write( cc.fatal( "ERROR:" ) + cc.error( " Failed call to " ) +
            cc.note( strFnName + "()" ) + + cc.error( " via " ) + cc.u( u ) +
            cc.error( ", from block " ) + cc.warning( nBlockFrom ) + cc.error( ", to block " ) +
            cc.warning( nBlockTo ) + cc.error( " after " ) + cc.info( cntAttempts ) +
            cc.error( " attempts " ) + "\n" );
        throw new Error( "Failed call to " + strFnName + "(), from block " + nBlockFrom +
            ", to block " + nBlockTo + " via " + u.toString() + " after " + cntAttempts +
            " attempts" );
    }
    return ret;
}

export async function safeGetPastEventsIterative(
    details, strLogPrefix,
    ethersProvider, attempts, joContract, joABI, strEventName,
    nBlockFrom, nBlockTo, joFilter
) {
    if( imaHelperAPIs.getBlocksCountInInIterativeStepOfEventsScan() <= 0 ||
        imaHelperAPIs.getMaxIterationsInAllRangeEventsScan() <= 0 ) {
        if( log.verboseGet() >= log.verboseReversed().warning ) {
            details.write( strLogPrefix + cc.fatal( "IMPORTANT NOTICE:" ) + " " +
                cc.warning( "Will skip " ) + cc.attention( "iterative" ) +
                cc.warning( " events scan in block range from " ) +
                cc.j( nBlockFrom ) + cc.warning( " to " ) + cc.j( nBlockTo ) +
                cc.warning( " because it's " ) + cc.error( "DISABLED" ) + "\n" );
        }
        return await safeGetPastEvents(
            details, strLogPrefix,
            ethersProvider, attempts, joContract, joABI,
            strEventName, nBlockFrom, nBlockTo, joFilter
        );
    }
    const nLatestBlockNumber = owaspUtils.toBN(
        await imaHelperAPIs.safeGetBlockNumber( details, 10, ethersProvider ) );
    const nLatestBlockNumberPlus1 = nLatestBlockNumber.add( owaspUtils.toBN( 1 ) );
    let isLastLatest = false;
    if( nBlockTo == "latest" ) {
        isLastLatest = true;
        nBlockTo = nLatestBlockNumberPlus1;
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            details.write( strLogPrefix + cc.debug( "Iterative scan up to latest block " ) +
                cc.info( "#" ) + cc.info( nBlockTo.toHexString() ) +
                cc.debug( " assumed instead of " ) + cc.attention( "latest" ) + "\n" );
        }
    } else {
        nBlockTo = owaspUtils.toBN( nBlockTo );
        if( nBlockTo.gte( nLatestBlockNumber ) )
            isLastLatest = true;
    }
    nBlockFrom = owaspUtils.toBN( nBlockFrom );
    const nBlockZero = owaspUtils.toBN( 0 );
    const isFirstZero = ( nBlockFrom.eq( nBlockZero ) ) ? true : false;
    if( isFirstZero && isLastLatest ) {
        if( nLatestBlockNumber.div(
            owaspUtils.toBN( imaHelperAPIs.getBlocksCountInInIterativeStepOfEventsScan() )
        ).gt( owaspUtils.toBN( imaHelperAPIs.getMaxIterationsInAllRangeEventsScan() ) )
        ) {
            if( log.verboseGet() >= log.verboseReversed().warning ) {
                details.write( strLogPrefix + cc.fatal( "IMPORTANT NOTICE:" ) + " " +
                    cc.warning( "Will skip " ) + cc.attention( "iterative" ) +
                    cc.warning( " scan and use scan in block range from " ) +
                    cc.info( nBlockFrom.toHexString() ) + cc.warning( " to " ) +
                    cc.info( nBlockTo.toHexString() ) + "\n" );
            }
            return await safeGetPastEvents(
                details, strLogPrefix,
                ethersProvider, attempts, joContract, joABI, strEventName,
                nBlockFrom, nBlockTo, joFilter
            );
        }
    }
    if( log.verboseGet() >= log.verboseReversed().trace ) {
        details.write( strLogPrefix + cc.debug( "Iterative scan in " ) +
            cc.info( nBlockFrom.toHexString() ) + cc.debug( "/" ) +
            cc.info( nBlockTo.toHexString() ) + cc.debug( " block range..." ) + "\n" );
    }
    let idxBlockSubRangeTo = nBlockTo;
    for( ; true; ) {
        let idxBlockSubRangeFrom = idxBlockSubRangeTo.sub(
            owaspUtils.toBN( imaHelperAPIs.getBlocksCountInInIterativeStepOfEventsScan() ) );
        if( idxBlockSubRangeFrom.lt( nBlockFrom ) )
            idxBlockSubRangeFrom = nBlockFrom;
        try {
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                details.write( strLogPrefix + cc.debug( "Iterative scan of " ) +
                    cc.info( idxBlockSubRangeFrom.toHexString() ) + cc.debug( "/" ) +
                    cc.info( idxBlockSubRangeTo.toHexString() ) +
                    cc.debug( " block sub-range in " ) +
                    cc.info( nBlockFrom.toHexString() ) + cc.debug( "/" ) +
                    cc.info( nBlockTo.toHexString() ) + cc.debug( " block range..." ) + "\n" );
            }
            const joAllEventsInBlock = await safeGetPastEvents(
                details, strLogPrefix,
                ethersProvider, attempts, joContract, joABI, strEventName,
                idxBlockSubRangeFrom, idxBlockSubRangeTo, joFilter
            );
            if( joAllEventsInBlock && joAllEventsInBlock != "" && joAllEventsInBlock.length > 0 ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    details.write( strLogPrefix + cc.success( "Result of " ) +
                        cc.attention( "iterative" ) + cc.success( " scan in " ) +
                        cc.info( nBlockFrom.toHexString() ) + cc.success( "/" ) +
                        cc.info( nBlockTo.toHexString() ) + cc.success( " block range is " ) +
                        cc.j( joAllEventsInBlock ) + "\n" );
                }
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
        idxBlockSubRangeTo = idxBlockSubRangeFrom;
        if( idxBlockSubRangeTo.lte( nBlockFrom ) )
            break;
    }
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        details.write( strLogPrefix + cc.debug( "Result of " ) + cc.attention( "iterative" ) +
            cc.debug( " scan in " ) + cc.info( nBlockFrom.toHexString() ) + cc.debug( "/" ) +
            cc.info( nBlockTo.toHexString() ) + cc.debug( " block range is " ) +
            cc.warning( "empty" ) + "\n" );
    }
    return "";
}
