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

import * as log from "../skale-log/log.mjs";
import * as cc from "../skale-cc/cc.mjs";

import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as loop from "../../agent/loop.mjs";
import * as pwa from "../../agent/pwa.mjs";
import * as state from "../../agent/state.mjs";
import * as imaHelperAPIs from "./imaHelperAPIs.mjs";
import * as imaTx from "./imaTx.mjs";
import * as imaGasUsage from "./imaGasUsageOperations.mjs";
import * as imaEventLogScan from "./imaEventLogScan.mjs";
import * as imaTransferErrorHandling from "./imaTransferErrorHandling.mjs";

cc.enable( false );
log.addStdout();

const perMessageGasForTransfer = 1000000;
const additionalS2MTransferOverhead = 200000;

async function findOutReferenceLogRecord(
    details, strLogPrefix,
    ethersProvider, joMessageProxy,
    bnBlockId, nMessageNumberToFind, isVerbose
) {
    const bnMessageNumberToFind = owaspUtils.toBN( nMessageNumberToFind.toString() );
    const strEventName = "PreviousMessageReference";
    const arrLogRecords = await imaEventLogScan.safeGetPastEventsProgressive(
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
            if( log.verboseGet() >= log.verboseReversed().notice ) {
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
        if( log.verboseGet() >= log.verboseReversed().information ) {
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
    // first, try optimized scanner
    optsTransfer.arrLogRecordReferences = [];
    try {
        optsTransfer.strActionName =
            "in-getOutgoingMessagesCounter()--joMessageProxySrc.getLastOutgoingMessageBlockId()";
        const bnBlockId =
            owaspUtils.toBN(
                await optsTransfer.joMessageProxySrc.callStatic.getLastOutgoingMessageBlockId(
                    optsTransfer.chainNameDst,
                    { from: optsTransfer.joAccountSrc.address() } ) );
        try {
            optsTransfer.strActionName =
                "in-getOutgoingMessagesCounter()--findOutAllReferenceLogRecords()";
            optsTransfer.arrLogRecordReferences =
                await findOutAllReferenceLogRecords(
                    optsTransfer.details, optsTransfer.strLogPrefixShort,
                    optsTransfer.ethersProviderSrc, optsTransfer.joMessageProxySrc,
                    bnBlockId, optsTransfer.nIncMsgCnt, optsTransfer.nOutMsgCnt, true
                );
            return true; // success, finish at this point
        } catch ( err ) {
            optsTransfer.arrLogRecordReferences = [];
            if( log.verboseGet() >= log.verboseReversed().error ) {
                optsTransfer.details.write(
                    optsTransfer.strLogPrefix + cc.warning( "Optimized log search is " ) +
                    cc.error( "off" ) + cc.warning( " Running old IMA smart contracts?" ) +
                    cc.success( " Please upgrade, if possible." ) +
                    cc.warning( " This message is based on error: " ) +
                    cc.success( " Please upgrade, if possible." ) +
                    cc.warning( " Error is: " ) +
                    cc.error( owaspUtils.extractErrorMessage( err ) ) +
                    cc.warning( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
        }
    } catch ( err ) {
        optsTransfer.arrLogRecordReferences = [];
        if( log.verboseGet() >= log.verboseReversed().error ) {
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.warning( "Optimized log search is un-available." ) + "\n" );
        }
    }
    // second, use classic raw events search
    optsTransfer.strActionName =
        "in-getOutgoingMessagesCounter()--classic-records-scanner";
    const attempts = 10;
    const strEventName = "OutgoingMessage";
    const nBlockFrom = 0;
    const nBlockTo = "latest";
    for( let nWalkMsgNumber = optsTransfer.nIncMsgCnt;
        nWalkMsgNumber < optsTransfer.nOutMsgCnt;
        ++ nWalkMsgNumber
    ) {
        const joFilter = optsTransfer.joMessageProxySrc.filters[strEventName](
            owaspUtils.ethersMod.ethers.utils.id( optsTransfer.chainIdDst ), // dstChainHash
            nWalkMsgNumber
        );
        const arrLogRecordReferencesWalk = await imaEventLogScan.safeGetPastEventsProgressive(
            optsTransfer.details, optsTransfer.strLogPrefixShort,
            optsTransfer.ethersProviderSrc, attempts, optsTransfer.joMessageProxySrc,
            strEventName,
            nBlockFrom, nBlockTo, joFilter
        );
        optsTransfer.arrLogRecordReferences =
            optsTransfer.arrLogRecordReferences.concat( arrLogRecordReferencesWalk );
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
        imaTransferErrorHandling.saveTransferError(
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
        r = await imaEventLogScan.safeGetPastEventsProgressive(
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
                const nLatestBlockNumber = await imaHelperAPIs.safeGetBlockNumber(
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
                imaTransferErrorHandling.saveTransferError(
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
                const timestampCurrent = imaHelperAPIs.currentTimestamp();
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
                imaTransferErrorHandling.saveTransferError(
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
            cc.debug( ", have " ) + cc.info( optsTransfer.jarrMessages.length ) +
            cc.debug( " message(s) to process " ) + cc.j( optsTransfer.jarrMessages ) + "\n";
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
        imaTransferErrorHandling.saveTransferError(
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
        imaTransferErrorHandling.saveTransferSuccessAll();
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
        optsTransfer.chainNameSrc, optsTransfer.nIdxCurrentMsgBlockStart,
        optsTransfer.jarrMessages, sign ];
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        const joDebugArgs = [
            optsTransfer.chainNameSrc, optsTransfer.chainNameDst,
            optsTransfer.nIdxCurrentMsgBlockStart,
            optsTransfer.jarrMessages, [ signature.X, signature.Y ], // BLS glue of signatures
            hashPoint.X, // G1.X from joGlueResult.hashSrc
            hashPoint.Y, // G1.Y from joGlueResult.hashSrc
            hint ];
        optsTransfer.details.write( optsTransfer.strLogPrefix + cc.debug( "....debug args for " ) +
            cc.notice( "msgCounter" ) + cc.debug( " set to " ) +
            cc.info( optsTransfer.nIdxCurrentMsgBlockStart ) + cc.debug( ": " ) +
            cc.j( joDebugArgs ) + "\n" );
    }
    optsTransfer.strActionName = optsTransfer.strDirection + " - Post incoming messages";
    const weiHowMuchPostIncomingMessages = undefined;
    const gasPrice =
        await optsTransfer.transactionCustomizerDst.computeGasPrice(
            optsTransfer.ethersProviderDst, 200000000000 );
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsTransfer.details.write( optsTransfer.strLogPrefix + cc.debug( "Using computed " ) +
            cc.info( "gasPrice" ) + cc.debug( "=" ) + cc.j( gasPrice ) + "\n" );
    }
    let estimatedGasPostIncomingMessages =
        await optsTransfer.transactionCustomizerDst.computeGas(
            optsTransfer.details, optsTransfer.ethersProviderDst,
            "MessageProxy", optsTransfer.joMessageProxyDst,
            "postIncomingMessages", arrArgumentsPostIncomingMessages,
            optsTransfer.joAccountDst, optsTransfer.strActionName,
            gasPrice, 10000000, weiHowMuchPostIncomingMessages, null );
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        optsTransfer.details.write( optsTransfer.strLogPrefix +
            cc.debug( "Using estimated " ) + cc.info( "gas" ) + cc.debug( "=" ) +
            cc.notice( estimatedGasPostIncomingMessages ) + "\n" );
    }
    if( optsTransfer.strDirection == "S2M" ) {
        const expectedGasLimit = perMessageGasForTransfer * optsTransfer.jarrMessages.length +
            additionalS2MTransferOverhead;
        estimatedGasPostIncomingMessages =
            Math.max( estimatedGasPostIncomingMessages, expectedGasLimit );
    }
    const isIgnorePostIncomingMessages = false;
    const strErrorOfDryRun =
        await imaTx.dryRunCall(
            optsTransfer.details, optsTransfer.ethersProviderDst,
            "MessageProxy", optsTransfer.joMessageProxyDst,
            "postIncomingMessages", arrArgumentsPostIncomingMessages,
            optsTransfer.joAccountDst, optsTransfer.strActionName,
            isIgnorePostIncomingMessages,
            gasPrice, estimatedGasPostIncomingMessages,
            weiHowMuchPostIncomingMessages, null );
    if( strErrorOfDryRun )
        throw new Error( strErrorOfDryRun );
    const opts = {
        isCheckTransactionToSchain:
            ( optsTransfer.chainNameDst !== "Mainnet" ) ? true : false
    };
    const joReceipt =
        await imaTx.payedCall(
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
        imaGasUsage.printGasUsageReportFromArray( "(intermediate result) TRANSFER " +
            optsTransfer.chainNameSrc + " -> " + optsTransfer.chainNameDst,
        optsTransfer.jarrReceipts, optsTransfer.details );
    }
    optsTransfer.cntProcessed += optsTransfer.cntAccumulatedForBlock;
    if( log.verboseGet() >= log.verboseReversed().information ) {
        optsTransfer.details.write( optsTransfer.strLogPrefix +
            cc.debug( "Validating transfer from " ) +
            cc.info( optsTransfer.chainNameSrc ) + cc.debug( " to " ) +
            cc.info( optsTransfer.chainNameDst ) + cc.debug( "..." ) + "\n" );
    }
    // check DepositBox -> Error on Mainnet only
    if( optsTransfer.chainNameDst == "Mainnet" ) {
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.debug( "Validating transfer to Main Net via MessageProxy " +
                    "error absence on Main Net..." ) + "\n" );
        }
        if( optsTransfer.joDepositBoxMainNet ) {
            if( joReceipt && "blockNumber" in joReceipt &&
                "transactionHash" in joReceipt ) {
                const strEventName = "PostMessageError";
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.debug( "Verifying the " ) + cc.info( strEventName ) +
                        cc.debug( " event of the " ) + cc.info( "MessageProxy" ) +
                        cc.debug( "/" ) +
                        cc.notice( optsTransfer.joMessageProxyDst.address ) +
                        cc.debug( " contract..." ) + "\n" );
                }
                const joEvents = await imaEventLogScan.getContractCallEvents(
                    optsTransfer.details, optsTransfer.strLogPrefixShort,
                    optsTransfer.ethersProviderDst,
                    optsTransfer.joMessageProxyDst, strEventName,
                    joReceipt.blockNumber, joReceipt.transactionHash,
                    optsTransfer.joMessageProxyDst.filters[strEventName]() );
                if( joEvents.length == 0 ) {
                    if( log.verboseGet() >= log.verboseReversed().debug ) {
                        optsTransfer.details.write( optsTransfer.strLogPrefix +
                            cc.success( "Success, verified the " ) + cc.info( strEventName ) +
                            cc.success( " event of the " ) + cc.info( "MessageProxy" ) +
                            cc.success( "/" ) +
                            cc.notice( optsTransfer.joMessageProxyDst.address ) +
                            cc.success( " contract, no events found" ) + "\n" );
                    }
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
                    imaTransferErrorHandling.saveTransferError(
                        optsTransfer.strTransferErrorCategoryName,
                        optsTransfer.details.toString() );
                    throw new Error( "Verification failed for the \"PostMessageError\" " +
                        "event of the \"MessageProxy\"/" + optsTransfer.joMessageProxyDst.address +
                        " contract, error events found" );
                }
                if( log.verboseGet() >= log.verboseReversed().debug ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.success( "Done, validated transfer to Main Net " +
                            "via MessageProxy error absence on Main Net" ) + "\n" );
                }
            } else {
                if( log.verboseGet() >= log.verboseReversed().warning ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.warning( "WARNING:" ) + " " +
                        cc.warn( "Cannot validate transfer to Main Net via " +
                            "MessageProxy error absence on Main Net, " +
                            "no valid transaction receipt provided" ) + "\n" );
                }
            }
        } else {
            if( log.verboseGet() >= log.verboseReversed().warning ) {
                optsTransfer.details.write( optsTransfer.strLogPrefix +
                    cc.warning( "WARNING:" ) + " " +
                    cc.warn( "Cannot validate transfer to Main Net " +
                        "via MessageProxy error absence on Main Net, " +
                        "no MessageProxy provided" ) + "\n" );
            }
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
            imaTransferErrorHandling.saveTransferError(
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
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            optsTransfer.details.write( optsTransfer.strLogPrefix +
                cc.sunny( optsTransfer.strDirection ) +
                cc.debug( " message analysis for message " ) + cc.info( idxMessage + 1 ) +
                cc.debug( " of " ) + cc.info( cntMessages ) +
                cc.debug( " with IMA message index " ) + cc.j( idxImaMessage ) +
                cc.debug( " and message envelope data:" ) + cc.j( joMessage ) + "\n" );
        }
        let cntPassedNodes = 0, cntFailedNodes = 0, joNode = null;
        try {
            for( let idxNode = 0; idxNode < cntNodes; ++ idxNode ) {
                joNode = joSChain.data.computed.nodes[idxNode];
                // eslint-disable-next-line dot-notation
                const strUrlHttp = joNode["http_endpoint_ip"];
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    optsTransfer.details.write( optsTransfer.strLogPrefix +
                        cc.debug( "Validating " ) + cc.sunny( optsTransfer.strDirection ) +
                        cc.debug( " message " ) + cc.info( idxMessage + 1 ) +
                        cc.debug( " on node " ) + cc.info( joNode.name ) +
                        cc.debug( " using URL " ) + cc.info( strUrlHttp ) + cc.debug( "..." ) +
                        "\n" );
                }
                let bEventIsFound = false;
                try {
                    // eslint-disable-next-line dot-notation
                    const ethersProviderNode =
                        owaspUtils.getEthersProviderFromURL( strUrlHttp );
                    const joMessageProxyNode =
                        new owaspUtils.ethersMod.ethers.Contract(
                            optsTransfer.imaState.chainProperties.sc
                                .joAbiIMA.message_proxy_chain_address,
                            optsTransfer.imaState.chainProperties.sc
                                .joAbiIMA.message_proxy_chain_abi,
                            ethersProviderNode
                        );
                    const strEventName = "OutgoingMessage";
                    const node_r = await imaEventLogScan.safeGetPastEventsProgressive(
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
                    if( log.verboseGet() >= log.verboseReversed().trace ) {
                        optsTransfer.details.write( optsTransfer.strLogPrefix + cc.debug( "Got " ) +
                            cc.info( cntEvents ) + cc.debug( " event(s) (" ) +
                            cc.info( strEventName ) + cc.debug( ") on node " ) +
                            cc.info( joNode.name ) + cc.debug( " with data: " ) +
                            cc.j( node_r ) + "\n" );
                    }
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
                    if( log.verboseGet() >= log.verboseReversed().information ) {
                        optsTransfer.details.write( optsTransfer.strLogPrefix +
                            cc.sunny( optsTransfer.strDirection ) + cc.success( " message " ) +
                            cc.info( idxMessage + 1 ) + cc.success( " validation on node " ) +
                            cc.info( joNode.name ) + cc.success( " using URL " ) +
                            cc.info( strUrlHttp ) + cc.success( " is passed" ) + "\n" );
                    }
                } else {
                    ++ cntFailedNodes;
                    if( log.verboseGet() >= log.verboseReversed().error ) {
                        // eslint-disable-next-line dot-notation
                        const strError = optsTransfer.strLogPrefix +
                            cc.sunny( optsTransfer.strDirection ) + cc.error( " message " ) +
                            cc.info( idxMessage + 1 ) + cc.error( " validation on node " ) +
                            cc.info( joNode.name ) + cc.success( " using URL " ) +
                            cc.info( strUrlHttp ) + cc.error( " is failed" ) + "\n";
                        optsTransfer.details.write( strError );
                        if( log.id != optsTransfer.details.id )
                            log.write( strError );
                    }
                }
                if( cntFailedNodes > optsTransfer.cntNodesMayFail )
                    break;
                if( cntPassedNodes >= optsTransfer.cntNodesShouldPass ) {
                    if( log.verboseGet() >= log.verboseReversed().information ) {
                        // eslint-disable-next-line dot-notation
                        optsTransfer.details.write( optsTransfer.strLogPrefix +
                            cc.sunny( optsTransfer.strDirection ) + cc.success( " message " ) +
                            cc.info( idxMessage + 1 ) + cc.success( " validation on node " ) +
                            cc.info( joNode.name ) + cc.success( " using URL " ) +
                            cc.info( strUrlHttp ) + cc.success( " is passed" ) + "\n" );
                    }
                    break;
                }
            }
        } catch ( err ) {
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                // eslint-disable-next-line dot-notation
                const strUrlHttp = joNode ? joNode["http_endpoint_ip"] : "";
                const strError = optsTransfer.strLogPrefix +
                    cc.fatal( optsTransfer.strDirection + " message analysis error:" ) +
                    " " + cc.error( "Failed to process events for " ) +
                    cc.sunny( optsTransfer.strDirection ) + cc.error( " message " ) +
                    cc.info( idxMessage + 1 ) + cc.error( " on node " ) +
                    ( joNode
                        ? cc.info( joNode.name )
                        : cc.error( "<<unknown node name>>" ) ) +
                    cc.error( " using URL " ) +
                    ( joNode ? cc.info( strUrlHttp ) : cc.error( "<<unknown node endpoint>>" ) ) +
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
            imaTransferErrorHandling.saveTransferError(
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
            imaTransferErrorHandling.saveTransferError(
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
            imaTransferErrorHandling.saveTransferSuccessAll();
            return false;
        }
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            optsTransfer.details.write(
                optsTransfer.strLogPrefix + cc.debug( "Entering block former iteration with " ) +
                cc.notice( "message counter" ) + cc.debug( " set to " ) +
                cc.info( optsTransfer.nIdxCurrentMsg ) + cc.debug( ", transfer step number is " ) +
                cc.info( optsTransfer.nStepsDone ) + cc.debug( ", can transfer up to " ) +
                cc.info( optsTransfer.nMaxTransactionsCount ) + cc.debug( " message(s) per step" ) +
                cc.debug( ", can perform up to " ) + cc.info( optsTransfer.nTransferSteps ) +
                cc.debug( " transfer step(s)" ) + "\n" );
        }
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
            imaTransferErrorHandling.saveTransferSuccessAll();
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
            imaTransferErrorHandling.saveTransferSuccessAll();
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
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                optsTransfer.details.write( optsTransfer.strLogPrefix +
                    cc.sunny( optsTransfer.strDirection ) +
                    cc.debug( " message analysis will be performed o S-Chain " ) +
                    cc.info( optsTransfer.chainNameSrc ) + cc.debug( " with " ) +
                    cc.info( cntNodes ) + cc.debug( " node(s), " ) +
                    cc.info( optsTransfer.cntNodesShouldPass ) +
                    cc.debug( " node(s) should have same message(s), " ) +
                    cc.info( optsTransfer.cntNodesMayFail ) +
                    cc.debug( " node(s) allowed to fail message(s) comparison, " ) +
                    cc.info( cntMessages ) + cc.debug( " message(s) to check..." ) + "\n" );
            }
            if( ! ( await checkOutgoingMessageEvent( optsTransfer, joSChain ) ) )
                return false;
        }

        optsTransfer.strActionName = "sign messages";
        if( log.verboseGet() >= log.verboseReversed().information ) {
            const strWillInvokeSigningCallbackMessage =
                optsTransfer.strLogPrefix +
                cc.debug( "Will invoke message signing callback, " +
                    "first real message index is: " ) +
                cc.info( optsTransfer.nIdxCurrentMsgBlockStart ) +
                cc.debug( ", have " ) + cc.info( optsTransfer.jarrMessages.length ) +
                cc.debug( " message(s) to process " ) + cc.j( optsTransfer.jarrMessages ) +
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
                    cc.warning( owaspUtils.extractErrorMessage( err ) +
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
                    cc.debug( " message(s) to process " ) +
                    cc.j( optsTransfer.jarrMessages ) + "\n" );
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
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n";
            optsTransfer.details.write( strError );
            if( log.id != optsTransfer.details.id )
                log.write( strError );
        }
        optsTransfer.details.exposeDetailsTo( log, optsTransfer.strGatheredDetailsName, false );
        imaTransferErrorHandling.saveTransferError(
            optsTransfer.strTransferErrorCategoryName, optsTransfer.details.toString() );
        optsTransfer.details.close();
        return false;
    }
    imaGasUsage.printGasUsageReportFromArray(
        "TRANSFER " + optsTransfer.chainNameSrc + " -> " +
            optsTransfer.chainNameDst, optsTransfer.jarrReceipts, optsTransfer.details );
    if( optsTransfer.details ) {
        if( log.exposeDetailsGet() && optsTransfer.details.exposeDetailsTo ) {
            optsTransfer.details.exposeDetailsTo(
                log, optsTransfer.strGatheredDetailsName, true );
        }
        optsTransfer.details.close();
    }
    if( ! optsTransfer.bErrorInSigningMessages )
        imaTransferErrorHandling.saveTransferSuccess( optsTransfer.strTransferErrorCategoryName );
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
            cc.debug( " S-Chain(s) connected to this S-Chain for performing S2S transfers in " ) +
            threadInfo.threadDescription() + cc.debug( "." ) +
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
                cc.debug( "/" ) + cc.info( chainIdSrc ) + cc.debug( " S-Chain in " ) +
                threadInfo.threadDescription() + cc.debug( "..." ) + "\n" );
        }
        let bOK = false;
        try {
            nIndexS2S = idxSChain;
            if( ! await pwa.checkOnLoopStart( imaState, "s2s", nIndexS2S ) ) {
                imaState.loopState.s2s.wasInProgress = false;
                if( log.verboseGet() >= log.verboseReversed().notice ) {
                    log.write(
                        cc.warning( "Skipped(s2s) due to cancel mode reported from PWA in " ) +
                        threadInfo.threadDescription() + cc.debug( "" ) + "\n" );
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
                    if( log.verboseGet() >= log.verboseReversed().notice ) {
                        const strLogPrefix = cc.attention( "S2S Loop:" ) + " ";
                        log.write( strLogPrefix + cc.warning( "Skipped(s2s) in " ) +
                            threadInfo.threadDescription() +
                            cc.debug( " due to time framing check" ) + "\n" );
                    }
                }
            }
        } catch ( err ) {
            bOK = false;
            if( log.verboseGet() >= log.verboseReversed().error ) {
                const strError = owaspUtils.extractErrorMessage( err );
                log.write( cc.fatal( "S2S STEP ERROR:" ) + cc.error( " From S-Chain " ) +
                    cc.info( chainNameSrc ) + cc.error( ", error is: " ) + cc.warning( strError ) +
                    cc.error( " in " ) + threadInfo.threadDescription() +
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
        let s = cc.debug( "Stats for S2S steps in " ) +
            threadInfo.threadDescription() + cc.debug( ": " );
        if( cntOK > 0 ) {
            s += " " + cc.info( cntOK ) +
                cc.success( "S-Chain(s) processed OKay" ) + cc.debug( ", " );
        }
        if( cntFail > 0 ) {
            s += " " + cc.info( cntFail ) +
                cc.error( "S-Chain(s) failed" );
        }
        log.write( s + "\n" );
    }
    return ( cntFail == 0 ) ? true : false;
}
