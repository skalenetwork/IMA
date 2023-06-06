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
 * @file discoveryTools.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as owaspUtils from "../npms/skale-owasp/owaspUtils.mjs";
import * as log from "../npms/skale-log/log.mjs";
import * as cc from "../npms/skale-cc/cc.mjs";
import * as rpcCall from "./rpcCall.mjs";
import * as imaHelperAPIs from "../npms/skale-ima/imaHelperAPIs.mjs";
import * as skaleObserver from "../npms/skale-observer/observer.mjs";
import * as state from "./state.mjs";
import * as imaUtils from "./utils.mjs";

export function initialSkaleNetworkScanForS2S() {
    const imaState = state.get();
    if( ! imaState.optsS2S.isEnabled )
        return;
    imaState.arrActions.push( {
        "name": "SKALE network scan for S2S",
        "fn": async function() {
            const strLogPrefix = cc.info( "SKALE network scan for S2S:" ) + " ";
            if( imaState.strPathAbiJsonSkaleManager.length === 0 ) {
                if( log.verboseGet() >= log.verboseReversed().fatal ) {
                    log.write( cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " missing Skale Manager ABI, please specify " ) +
                        cc.info( "abi-skale-manager" ) + "\n" );
                }
                process.exit( 153 );
            }
            if( log.verboseGet() >= log.verboseReversed().information ) {
                log.write( strLogPrefix +
                    cc.debug( "Downloading SKALE network information..." ) + "\n" );
            }
            const opts = {
                imaState: imaState,
                "details": log,
                "bStopNeeded": false,
                "secondsToReDiscoverSkaleNetwork":
                    imaState.optsS2S.secondsToReDiscoverSkaleNetwork,
                "chain": imaState.chainProperties.sc,
                "bParallelMode": true
            };
            const addressFrom = imaState.chainProperties.mn.joAccount.address();
            if( log.verboseGet() >= log.verboseReversed().information ) {
                log.write( strLogPrefix +
                    cc.debug( "Will start periodic S-Chains caching..." ) + "\n" );
            }
            await skaleObserver.periodicCachingStart(
                imaState.chainProperties.sc.strChainName,
                addressFrom,
                opts
            );
            if( log.verboseGet() >= log.verboseReversed().information ) {
                log.write( strLogPrefix +
                    cc.success( "Done, did started periodic S-Chains caching." ) + "\n" );
            }
            return true;
        }
    } );
};

export function formatBalanceInfo( bi, strAddress ) {
    let s = "";
    s += cc.attention( bi.assetName );
    if( "assetAddress" in bi &&
        typeof bi.assetAddress == "string" && bi.assetAddress.length > 0 )
        s += cc.normal( "/" ) + cc.notice( bi.assetAddress );
    if( "idToken" in bi )
        s += cc.normal( " token ID " ) + cc.notice( bi.idToken );
    s += cc.normal( ( bi.assetName == "ERC721" )
        ? " owner is " : " balance is " );
    s += ( bi.assetName == "ERC721" )
        ? cc.bright( bi.owner ) : cc.sunny( bi.balance );
    if( bi.assetName == "ERC721" ) {
        const isSame =
            ( bi.owner.trim().toLowerCase() == strAddress.trim().toLowerCase() );
        s += " " + ( isSame
            ? cc.success( "same (as account " ) + cc.attention( strAddress ) +
                cc.success( " specified in the command line arguments)" )
            : cc.error( "different (than account " ) + cc.attention( strAddress ) +
                cc.error( " specified in the command line arguments)" ) );
    }
    return s;
}

function getSChainNodesCount( joSChainNetworkInfo ) {
    try {
        if( ! joSChainNetworkInfo )
            return 0;
        const jarrNodes = joSChainNetworkInfo.network;
        const cntNodes = jarrNodes.length;
        return cntNodes;
    } catch ( err ) {
        return 0;
    }
}

function getSChainDiscoveredNodesCount( joSChainNetworkInfo ) {
    try {
        if( ! joSChainNetworkInfo )
            return 0;
        if( ! ( "network" in joSChainNetworkInfo && joSChainNetworkInfo.network ) )
            return 0;
        const jarrNodes = joSChainNetworkInfo.network;
        const cntNodes = jarrNodes.length;
        if( cntNodes <= 0 )
            return 0;
        let cntDiscovered = 0;
        for( let i = 0; i < cntNodes; ++ i ) {
            try {
                const joNode = joSChainNetworkInfo.network[i];
                if( joNode && "imaInfo" in joNode && typeof joNode.imaInfo === "object" &&
                    "t" in joNode.imaInfo && typeof joNode.imaInfo.t === "number"
                )
                    ++ cntDiscovered;
            } catch ( err ) {
                return 0;
            }
        }
        return cntDiscovered;
    } catch ( err ) {
        return 0;
    }
}

export async function waitUntilSChainStarted() {
    const imaState = state.get();
    if( log.verboseGet() >= log.verboseReversed().debug ) {
        log.write( cc.debug( "Checking " ) + cc.info( "S-Chain" ) +
            cc.debug( " is accessible and sane..." ) + "\n" );
    }
    if( ( !imaState.chainProperties.sc.strURL ) ||
        imaState.chainProperties.sc.strURL.length === 0
    ) {
        if( log.verboseGet() >= log.verboseReversed().warning ) {
            log.write( cc.warning( "Skipped, " ) + cc.info( "S-Chain" ) +
                cc.warning( " URL was not provided." ) + "\n" );
        }
        return;
    }
    let bSuccess = false;
    let idxWaitAttempt = 0;
    for( ; !bSuccess; ) {
        try {
            const joSChainNetworkInfo = await discoverSChainNetwork(
                function( err, joSChainNetworkInfo ) {
                    if( ! err )
                        bSuccess = true;
                }, true, null, -1 ).catch( ( err ) => {
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    log.write( cc.fatal( "CRITICAL ERROR:" ) +
                            cc.error( " S-Chain network discovery failed: " ) +
                            cc.warning( strError ) + "\n" );
                }
            } );
            if( ! joSChainNetworkInfo )
                bSuccess = false;
        } catch ( err ) {
            bSuccess = false;
        }
        if( !bSuccess )
            ++ idxWaitAttempt;
        if( idxWaitAttempt >= imaState.nMaxWaitSChainAttempts ) {
            if( log.verboseGet() >= log.verboseReversed().warning ) {
                log.write( cc.warning( "Incomplete, " ) + cc.info( "S-Chain" ) +
                    cc.warning( " sanity check failed after " ) + cc.info( idxWaitAttempt ) +
                    cc.warning( " attempts." ) + "\n" );
            }
            return;
        }
        await imaHelperAPIs.sleep( 1000 );
    }
    if( log.verboseGet() >= log.verboseReversed().information ) {
        log.write( cc.success( "Done, " ) + cc.info( "S-Chain" ) +
            cc.success( " is accessible and sane." ) + "\n" );
    }
}

export function isSendImaAgentIndex() {
    return true;
}

let gTimerSChainDiscovery = null;
let gFlagIsInSChainDiscovery = false;

export async function continueSChainDiscoveryInBackgroundIfNeeded( isSilent ) {
    const imaState = state.get();
    const cntNodes = getSChainNodesCount( imaState.joSChainNetworkInfo );
    const cntDiscovered = getSChainDiscoveredNodesCount( imaState.joSChainNetworkInfo );
    if( cntDiscovered >= cntNodes ) {
        if( gTimerSChainDiscovery != null ) {
            clearInterval( gTimerSChainDiscovery );
            gTimerSChainDiscovery = null;
        }
        return;
    }
    if( gTimerSChainDiscovery != null )
        return;
    if( imaState.joSChainDiscovery.repeatIntervalMilliseconds <= 0 )
        return; // no S-Chain re-discovery (for debugging only)
    const fnAsyncHandler = async function() {
        if( gFlagIsInSChainDiscovery )
            return;
        if( gFlagIsInSChainDiscovery ) {
            isInsideAsyncHandler = false;
            if( log.verboseGet() >= log.verboseReversed().information )
                log.write( cc.warning( "Notice: long S-Chain discovery is in progress" ) + "\n" );
            return;
        }
        gFlagIsInSChainDiscovery = true;
        try {
            if( log.verboseGet() >= log.verboseReversed().information ) {
                log.write( cc.info( "Will re-discover " ) + cc.notice( cntNodes ) +
                    cc.info( "-node S-Chain network, " ) + cc.notice( cntDiscovered ) +
                    cc.info( " node(s) already discovered..." ) + "\n" );
            }
            await discoverSChainNetwork( function( err, joSChainNetworkInfo ) {
                if( ! err ) {
                    const cntDiscoveredNew =
                        getSChainDiscoveredNodesCount( joSChainNetworkInfo );
                    if( log.verboseGet() >= log.verboseReversed().information ) {
                        const strDiscoveryStatus =
                            cc.info( cntDiscoveredNew ) + cc.success( " nodes known" );
                        let strMessage =
                            cc.success( "S-Chain network was re-discovered, " ) +
                            cc.info( cntDiscoveredNew ) +
                            cc.success( " of " ) + cc.info( cntNodes ) +
                            cc.success( " node(s) (" ) + strDiscoveryStatus + cc.success( ")" );
                        const cntStillUnknown = cntNodes - cntDiscoveredNew;
                        if( cntStillUnknown > 0 ) {
                            strMessage += cc.success( ", " ) +
                                cc.info( cntStillUnknown ) +
                                cc.success( " of " ) + cc.info( cntNodes ) +
                                cc.success( " still unknown (" );
                            try {
                                const jarrNodes = joSChainNetworkInfo.network;
                                let cntBad = 0;
                                for( let i = 0; i < jarrNodes.length; ++i ) {
                                    const joNode = jarrNodes[i];
                                    try {
                                        if( ! ( joNode && "imaInfo" in joNode &&
                                            typeof joNode.imaInfo === "object" &&
                                            "t" in joNode.imaInfo &&
                                            typeof joNode.imaInfo.t === "number" )
                                        ) {
                                            if( cntBad > 0 )
                                                strMessage += cc.success( ", " );
                                            const strNodeURL =
                                                imaUtils.composeSChainNodeUrl( joNode );
                                            const strNodeDescColorized =
                                                cc.notice( "#" ) + cc.info( i ) +
                                                cc.attention( "(" ) + cc.u( strNodeURL ) +
                                                cc.attention( ")" );
                                            strMessage += strNodeDescColorized;
                                            ++ cntBad;
                                        }
                                    } catch ( err ) { }
                                }
                            } catch ( err ) { }
                            strMessage += cc.success( ")" );
                        }
                        if( ! isSilent ) {
                            strMessage +=
                                cc.success( ", complete re-discovered S-Chain network info: " ) +
                                cc.j( joSChainNetworkInfo );
                        }
                        if( log.verboseGet() >= log.verboseReversed().information )
                            log.write( strMessage + "\n" );
                    }
                    imaState.joSChainNetworkInfo = joSChainNetworkInfo;
                }
                continueSChainDiscoveryInBackgroundIfNeeded( isSilent );
            }, isSilent, imaState.joSChainNetworkInfo, cntNodes ).catch( ( err ) => {
                if( log.verboseGet() >= log.verboseReversed().critical ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    log.write( cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " S-Chain network re-discovery failed: " ) +
                        cc.warning( strError ) + "\n" );
                }
            } );
        } catch ( err ) { }
        gFlagIsInSChainDiscovery = false;
    };
    gTimerSChainDiscovery = setInterval( function() {
        if( gFlagIsInSChainDiscovery )
            return;
        fnAsyncHandler();
    }, imaState.joSChainDiscovery.repeatIntervalMilliseconds );
}

async function discoverSChainWalkNodes( optsDiscover ) {
    optsDiscover.cntFailed = 0;
    for( let i = 0; i < optsDiscover.cntNodes; ++ i ) {
        const nCurrentNodeIdx = 0 + i;
        const joNode = optsDiscover.jarrNodes[nCurrentNodeIdx];
        const strNodeURL = imaUtils.composeSChainNodeUrl( joNode );
        const strNodeDescColorized =
            cc.notice( "#" ) + cc.info( nCurrentNodeIdx ) +
            cc.attention( "(" ) + cc.u( strNodeURL ) + cc.attention( ")" );
        try {
            if( optsDiscover.joPrevSChainNetworkInfo &&
                "network" in optsDiscover.joPrevSChainNetworkInfo &&
                optsDiscover.joPrevSChainNetworkInfo.network ) {
                const joPrevNode =
                    optsDiscover.joPrevSChainNetworkInfo.network[nCurrentNodeIdx];
                if( joPrevNode && "imaInfo" in joPrevNode &&
                    typeof joPrevNode.imaInfo === "object" &&
                    "t" in joPrevNode.imaInfo &&
                    typeof joPrevNode.imaInfo.t === "number"
                ) {
                    joNode.imaInfo = JSON.parse( JSON.stringify( joPrevNode.imaInfo ) );
                    if( log.verboseGet() >= log.verboseReversed().information ) {
                        if( ( !optsDiscover.isSilent ) ) {
                            log.write( optsDiscover.strLogPrefix +
                                cc.info( "OK, in case of " ) + strNodeDescColorized +
                                cc.info( " node " ) + cc.info( joNode.nodeID ) +
                                cc.info( " will use previous discovery result." ) + "\n" );
                        }
                    }
                    continue; // skip this node discovery, enrich rest of nodes
                }
            }
        } catch ( err ) { }
        const rpcCallOpts = null;
        try {
            await rpcCall.create( strNodeURL, rpcCallOpts,
                async function( joCall, err ) {
                    if( err ) {
                        if( log.verboseGet() >= log.verboseReversed().critical ) {
                            if( ! optsDiscover.isSilent ) {
                                log.write( optsDiscover.strLogPrefix +
                                    cc.fatal( "CRITICAL ERROR:" ) +
                                    cc.error( " JSON RPC call to S-Chain node " ) +
                                    strNodeDescColorized + cc.error( " failed" ) + "\n" );
                            }
                        }
                        ++ optsDiscover.cntFailed;
                        if( joCall )
                            await joCall.disconnect();
                        return;
                    }
                    const joDataIn = {
                        "method": "skale_imaInfo",
                        "params": { }
                    };
                    if( isSendImaAgentIndex() )
                        joDataIn.params.fromImaAgentIndex = optsDiscover.imaState.nNodeNumber;
                    joCall.call( joDataIn, function( joIn, joOut, err ) {
                        ++ optsDiscover.nCountReceivedImaDescriptions;
                        if( err ) {
                            const strError = owaspUtils.extractErrorMessage( err );
                            if( log.verboseGet() >= log.verboseReversed().critical ) {
                                if( ! optsDiscover.isSilent ) {
                                    log.write( optsDiscover.strLogPrefix +
                                        cc.fatal( "CRITICAL ERROR:" ) +
                                        cc.error( " JSON RPC call to S-Chain node " ) +
                                        strNodeDescColorized + cc.error( " failed, error: " ) +
                                        cc.warning( strError ) + "\n" );
                                }
                            }
                            ++ optsDiscover.cntFailed;
                            return;
                        }
                        joNode.imaInfo = joOut.result;
                        if( log.verboseGet() >= log.verboseReversed().information ) {
                            if( !optsDiscover.isSilent ) {
                                log.write( optsDiscover.strLogPrefix + cc.success( "OK, got " ) +
                                    strNodeDescColorized + cc.success( " node " ) +
                                    cc.info( joNode.nodeID ) + cc.success( " IMA information(" ) +
                                    cc.info( optsDiscover.nCountReceivedImaDescriptions ) +
                                    cc.success( " of " ) +
                                    cc.info( optsDiscover.cntNodes ) + cc.success( ")." ) + "\n" );
                            }
                        }
                    } );
                } );
        } catch ( err ) {
            if( log.verboseGet() >= log.verboseReversed().critical ) {
                if( ! optsDiscover.isSilent ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    log.write( optsDiscover.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                        cc.error( " JSON RPC call to S-Chain node " ) + strNodeDescColorized +
                        cc.error( " was not created: " ) + cc.warning( strError ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
                }
            }
            ++ optsDiscover.cntFailed;
        }
    }
}

async function discoverSChainWait( optsDiscover ) {
    if( log.verboseGet() >= log.verboseReversed().information ) {
        if( !optsDiscover.isSilent ) {
            log.write( optsDiscover.strLogPrefix +
                cc.debug( "Waiting for response from at least " ) +
                cc.info( optsDiscover.nCountToWait ) +
                cc.debug( " node(s)..." ) + "\n" );
        }
    }
    let nWaitAttempt = 0;
    const nWaitStepMilliseconds = 1000;
    let cntWaitAttempts = Math.floor(
        optsDiscover.imaState.joSChainDiscovery.repeatIntervalMilliseconds /
        nWaitStepMilliseconds ) - 3;
    if( cntWaitAttempts < 1 )
        cntWaitAttempts = 1;
    const iv = setInterval( function() {
        optsDiscover.nCountAvailable =
        optsDiscover.cntNodes - optsDiscover.cntFailed;
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            if( ! optsDiscover.isSilent ) {
                log.write( cc.debug( "Waiting attempt " ) + cc.info( nWaitAttempt ) +
                    cc.debug( " of " ) + cc.info( cntWaitAttempts ) +
                    cc.debug( " for S-Chain nodes, total " ) +
                    cc.info( optsDiscover.cntNodes ) + cc.debug( ", available " ) +
                    cc.info( optsDiscover.nCountAvailable ) + cc.debug( ", expected at least " ) +
                    cc.info( optsDiscover.nCountToWait ) + "\n" );
            }
        }
        if( log.verboseGet() >= log.verboseReversed().information ) {
            if( !optsDiscover.isSilent ) {
                log.write( optsDiscover.strLogPrefix +
                    cc.debug( "Have S-Chain description response about " ) +
                    cc.info( optsDiscover.nCountReceivedImaDescriptions ) +
                    cc.debug( " node(s)." ) + "\n" );
            }
        }
        if( optsDiscover.nCountReceivedImaDescriptions >=
            optsDiscover.nCountToWait ) {
            clearInterval( iv );
            optsDiscover.fnAfter( null, optsDiscover.joSChainNetworkInfo );
            return;
        }
        ++ nWaitAttempt;
        if( nWaitAttempt >= cntWaitAttempts ) {
            clearInterval( iv );
            const strErrorDescription =
                "S-Chain network discovery wait timeout, " +
                "network will be re-discovered";
            if( log.verboseGet() >= log.verboseReversed().warning ) {
                if( ! optsDiscover.isSilent ) {
                    log.write( optsDiscover.strLogPrefix + cc.warning( "WARNING:" ) + " " +
                        cc.warning( strErrorDescription ) + "\n" );
                }
            }
            if( getSChainDiscoveredNodesCount(
                optsDiscover.joSChainNetworkInfo ) > 0 )
                optsDiscover.fnAfter( null, optsDiscover.joSChainNetworkInfo );
            else
                optsDiscover.fnAfter( new Error( strErrorDescription ), null );
            return;
        }
        if( log.verboseGet() >= log.verboseReversed().debug ) {
            if( ! optsDiscover.isSilent ) {
                log.write( optsDiscover.strLogPrefix + cc.debug( " Waiting attempt " ) +
                    cc.info( nWaitAttempt ) + cc.debug( " of " ) + cc.info( cntWaitAttempts ) +
                    cc.debug( " for " ) + cc.notice( optsDiscover.nCountToWait -
                        optsDiscover.nCountReceivedImaDescriptions ) +
                    cc.debug( " node answer(s)" ) + "\n" );
            }
        }
    }, nWaitStepMilliseconds );
    await joCall.disconnect();
}

export async function discoverSChainNetwork(
    fnAfter, isSilent, joPrevSChainNetworkInfo, nCountToWait
) {
    const optsDiscover = {
        fnAfter: fnAfter,
        isSilent: isSilent || false,
        joPrevSChainNetworkInfo: joPrevSChainNetworkInfo || null,
        nCountToWait: nCountToWait,
        imaState: state.get(),
        strLogPrefix: cc.info( "S-Chain network discovery:" ) + " ",
        joSChainNetworkInfo: null,
        jarrNodes: [],
        cntNodes: 0,
        cntFailed: 0,
        nCountReceivedImaDescriptions: 0,
        nCountAvailable: 0
    };
    if( optsDiscover.nCountToWait == null ||
        optsDiscover.nCountToWait == undefined ||
        optsDiscover.nCountToWait < 0 )
        optsDiscover.nCountToWait = 0;
    optsDiscover.fnAfter = optsDiscover.fnAfter || function() {};
    const rpcCallOpts = null;
    try {
        await rpcCall.create( optsDiscover.imaState.chainProperties.sc.strURL, rpcCallOpts,
            async function( joCall, err ) {
                if( err ) {
                    const strError = owaspUtils.extractErrorMessage( err );
                    if( log.verboseGet() >= log.verboseReversed().critical ) {
                        if( ! optsDiscover.isSilent ) {
                            log.write( optsDiscover.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                                cc.error( " JSON RPC call to (own) S-Chain " ) +
                                cc.u( optsDiscover.imaState.chainProperties.sc.strURL ) +
                                cc.error( " failed: " ) + cc.warning( strError ) + "\n" );
                        }
                    }
                    optsDiscover.fnAfter( err, null );
                    if( joCall )
                        await joCall.disconnect();
                    return;
                }
                const joDataIn = {
                    "method": "skale_nodesRpcInfo",
                    "params": { }
                };
                if( isSendImaAgentIndex() )
                    joDataIn.params.fromImaAgentIndex = optsDiscover.imaState.nNodeNumber;
                await joCall.call( joDataIn, async function( joIn, joOut, err ) {
                    if( err ) {
                        if( log.verboseGet() >= log.verboseReversed().critical ) {
                            if( ! optsDiscover.isSilent ) {
                                const strError = owaspUtils.extractErrorMessage( err );
                                log.write( optsDiscover.strLogPrefix +
                                    cc.fatal( "CRITICAL ERROR:" ) +
                                    cc.error( " JSON RPC call to (own) S-Chain " ) +
                                    cc.u( optsDiscover.imaState.chainProperties.sc.strURL ) +
                                    cc.error( " failed, error: " ) + cc.warning( strError ) +
                                    "\n" );
                            }
                        }
                        optsDiscover.fnAfter( err, null );
                        await joCall.disconnect();
                        return;
                    }
                    if( ( !optsDiscover.isSilent ) &&
                        log.verboseGet() >= log.verboseReversed().trace ) {
                        log.write( optsDiscover.strLogPrefix +
                                cc.debug( "OK, got (own) S-Chain network information: " ) +
                                cc.j( joOut.result ) + "\n" );
                    } else if(
                        ( !optsDiscover.isSilent ) &&
                        log.verboseGet() >= log.verboseReversed().information ) {
                        log.write( optsDiscover.strLogPrefix + cc.success( "OK, got S-Chain " ) +
                            cc.u( optsDiscover.imaState.chainProperties.sc.strURL ) +
                            cc.success( " network information." ) + "\n" );
                    }
                    optsDiscover.nCountReceivedImaDescriptions = 0;
                    optsDiscover.joSChainNetworkInfo = joOut.result;
                    if( ! optsDiscover.joSChainNetworkInfo ) {
                        if( log.verboseGet() >= log.verboseReversed().critical ) {
                            if( ! optsDiscover.isSilent ) {
                                const err2 = new Error( "Got wrong response, " +
                                    "network information description was not detected" );
                                log.write( optsDiscover.strLogPrefix +
                                    cc.fatal( "CRITICAL ERROR:" ) +
                                    cc.error( " Network was not detected via call to " ) +
                                    cc.u( optsDiscover.imaState.chainProperties.sc.strURL ) +
                                    cc.error( ": " ) + cc.warning( err2 ) + "\n" );
                            }
                        }
                        optsDiscover.fnAfter( err2, null );
                        await joCall.disconnect();
                        return;
                    }
                    optsDiscover.jarrNodes = optsDiscover.joSChainNetworkInfo.network;
                    optsDiscover.cntNodes = optsDiscover.jarrNodes.length;
                    if( optsDiscover.nCountToWait <= 0 ) {
                        optsDiscover.nCountToWait = 0 + optsDiscover.cntNodes;
                        if( optsDiscover.nCountToWait > 2 ) {
                            optsDiscover.nCountToWait =
                                Math.ceil( optsDiscover.nCountToWait * 2 / 3 );
                        }
                    } else if( optsDiscover.nCountToWait > optsDiscover.cntNodes )
                        optsDiscover.nCountToWait = optsDiscover.cntNodes;
                    if( log.verboseGet() >= log.verboseReversed().information ) {
                        if( ! optsDiscover.isSilent ) {
                            log.write( optsDiscover.strLogPrefix +
                                cc.debug( "Will gather details of " ) +
                                cc.info( optsDiscover.nCountToWait ) + cc.debug( " of " ) +
                                cc.info( optsDiscover.cntNodes ) + cc.debug( " node(s)..." ) +
                                "\n" );
                        }
                    }
                    await discoverSChainWalkNodes( optsDiscover );
                    optsDiscover.nCountAvailable = optsDiscover.cntNodes - optsDiscover.cntFailed;
                    if( log.verboseGet() >= log.verboseReversed().information ) {
                        if( ! optsDiscover.isSilent ) {
                            log.write( cc.debug( "Waiting for S-Chain nodes, total " ) +
                                cc.warning( optsDiscover.cntNodes ) + cc.debug( ", available " ) +
                                cc.warning( optsDiscover.nCountAvailable ) +
                                cc.debug( ", expected at least " ) +
                                cc.warning( optsDiscover.nCountToWait ) + "\n" );
                        }
                    }
                    if( optsDiscover.nCountAvailable < optsDiscover.nCountToWait ) {
                        if( log.verboseGet() >= log.verboseReversed().critical ) {
                            if( ! optsDiscover.isSilent ) {
                                log.write( optsDiscover.strLogPrefix +
                                    cc.fatal( "CRITICAL ERROR:" ) +
                                    cc.error( " Not enough nodes available on S-Chain, total " ) +
                                    cc.warning( optsDiscover.cntNodes ) +
                                    cc.error( ", available " ) +
                                    cc.warning( optsDiscover.nCountAvailable ) +
                                    cc.error( ", expected at least " ) +
                                    cc.warning( optsDiscover.nCountToWait ) + "\n" );
                            }
                        }
                        const err = new Error(
                            "Not enough nodes available on S-Chain, total " +
                            optsDiscover.cntNodes + ", available " + optsDiscover.nCountAvailable +
                            ", expected at least " + optsDiscover.nCountToWait );
                        optsDiscover.fnAfter( err, null );
                        return;
                    }
                    await discoverSChainWait( optsDiscover );
                } );
            } );
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().critical ) {
            if( ! optsDiscover.isSilent ) {
                const strError = owaspUtils.extractErrorMessage( err );
                log.write( optsDiscover.strLogPrefix + cc.fatal( "CRITICAL ERROR:" ) +
                    cc.error( " JSON RPC call to S-Chain was not created: " ) +
                    cc.warning( strError ) + cc.error( ", stack is: " ) + "\n" +
                    cc.stack( err.stack ) + "\n" );
            }
        }
        optsDiscover.joSChainNetworkInfo = null;
        optsDiscover.fnAfter( err, null );
    }
    return optsDiscover.joSChainNetworkInfo;
}
