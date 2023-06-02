
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
 * @file observer.mjs
 * @copyright SKALE Labs 2019-Present
 */

import * as path from "path";
import * as url from "url";
import * as networkLayer from "../skale-cool-socket/socket.mjs";
import { Worker } from "worker_threads";
import * as owaspUtils from "../skale-owasp/owaspUtils.mjs";
import * as cc from "../skale-cc/cc.mjs";
import * as log from "../skale-log/log.mjs";
import * as rpcCall from "../../agent/rpcCall.mjs";

import { UniversalDispatcherEvent, EventDispatcher }
    from "../skale-cool-socket/eventDispatcher.mjs";

import * as EMC from "ethereum-multicall";

const __dirname = path.dirname( url.fileURLToPath( import.meta.url ) );

let gIntervalPeriodicCaching = null;
let gFlagHaveParallelResult = false;

const PORTS_PER_SCHAIN = 64;

export const events = new EventDispatcher();

export function getSChainIndexInNode( computedSChainId, arrChainIdsOnNode ) {
    let i = 0;
    for( const chainIdOnNode of arrChainIdsOnNode ) {
        if( computedSChainId == chainIdOnNode )
            return i;
        ++ i;
    }
    throw new Error(
        "S-Chain " + computedSChainId + " is not found in the list: " +
        JSON.stringify( arrChainIdsOnNode ) );
}

export function getSChainBasePortOnNode( computedSChainId, arrChainIdsOnNode, basePortOfNode ) {
    const indexOfSChain = getSChainIndexInNode( computedSChainId, arrChainIdsOnNode );
    return calcSChainBasePort( basePortOfNode, indexOfSChain );
}

export function calcSChainBasePort( basePortOfNode, indexOfSChain ) {
    return parseInt( basePortOfNode ) + parseInt( indexOfSChain ) * PORTS_PER_SCHAIN;
}

export function composeEndPoints( joSChain, nodeDict, strEndPointType ) {
    nodeDict["http_endpoint_" + strEndPointType] =
        "http://" + nodeDict[strEndPointType] + ":" + joSChain.data.computed.ports.httpRpcPort;
    nodeDict["https_endpoint_" + strEndPointType] =
        "https://" + nodeDict[strEndPointType] + ":" + joSChain.data.computed.ports.httpsRpcPort;
    nodeDict["ws_endpoint_" + strEndPointType] =
        "ws://" + nodeDict[strEndPointType] + ":" + joSChain.data.computed.ports.wsRpcPort;
    nodeDict["wss_endpoint_" + strEndPointType] =
        "wss://" + nodeDict[strEndPointType] + ":" + joSChain.data.computed.ports.wssRpcPort;
    nodeDict["info_http_endpoint_" + strEndPointType] =
        "http://" + nodeDict[strEndPointType] + ":" + joSChain.data.computed.ports.infoHttpRpcPort;
    nodeDict["ima_agent_endpoint_" + strEndPointType] =
        "http://" + nodeDict[strEndPointType] + ":" + joSChain.data.computed.ports.imaAgentRpcPort;
}

export const SkaledPorts = {
    PROPOSAL: 0,
    CATCHUP: 1,
    WS_JSON: 2,
    HTTP_JSON: 3,
    BINARY_CONSENSUS: 4,
    ZMQ_BROADCAST: 5,
    IMA_MONITORING: 6,
    WSS_JSON: 7,
    HTTPS_JSON: 8,
    INFO_HTTP_JSON: 9,
    IMA_AGENT_JSON: 10
};

export function calcPorts( joSChain, basePortOfSChain ) {
    // TO-DO: these temporary port values should be in "node", not in "schain"
    joSChain.data.computed.ports = {
        httpRpcPort: basePortOfSChain + SkaledPorts.HTTP_JSON,
        httpsRpcPort: basePortOfSChain + SkaledPorts.HTTPS_JSON,
        wsRpcPort: basePortOfSChain + SkaledPorts.WS_JSON,
        wssRpcPort: basePortOfSChain + SkaledPorts.WSS_JSON,
        infoHttpRpcPort: basePortOfSChain + SkaledPorts.INFO_HTTP_JSON,
        imaAgentRpcPort: basePortOfSChain + SkaledPorts.IMA_AGENT_JSON
    };
}

const gArrChainIdsSupportedByMulticall = [
    1, // Mainnet
    3, // Kovan
    4, // Rinkeby
    5, // Görli
    10, // Ropsten
    42, // Sepolia
    137, // Optimism
    69, // Optimism Kovan
    100, // Optimism Görli
    420, // Arbitrum
    42161, // Arbitrum Görli
    421611, // Arbitrum Rinkeby
    421613, // Polygon
    80001, // Mumbai
    11155111, // Gnosis Chain (xDai)
    43114, // Avalanche
    43113, // Avalanche Fuji
    4002, // Fantom Testnet
    250, // Fantom Opera
    56, // BNB Smart Chain
    97, // BNB Smart Chain Testnet
    1284, // Moonbeam
    1285, // Moonriver
    1287, // Moonbase Alpha Testnet
    1666600000, // Harmony
    25, // Cronos
    122, // Fuse
    19, // Songbird Canary Network
    16, // Coston Testnet
    288, // Boba
    1313161554, // Aurora
    592, // Astar
    66, // OKC
    128, // Heco Chain
    1088, // Metis
    30, // RSK
    31, // RSK Testnet
    9001, // Evmos
    9000, // Evmos Testnet
    108, // Thundercore
    18, // Thundercore Testnet
    26863, // Oasis
    42220, // Celo
    71402, // Godwoken
    71401, // Godwoken Testnet
    8217, // Klatyn
    2001, // Milkomeda
    321, // KCC
    111 // Etherlite
];

async function isMulticallAvailable( mn ) {
    if( mn && mn.ethersProvider ) {
        const { chainId } = await mn.ethersProvider.getNetwork();
        const bnChainId = owaspUtils.toBN( chainId );
        for( let i = 0; i < gArrChainIdsSupportedByMulticall.length; ++ i ) {
            const walkChainId = gArrChainIdsSupportedByMulticall[i];
            const bnWalkChainId = owaspUtils.toBN( walkChainId );
            if( bnWalkChainId.eq( bnChainId ) )
                return true;
        }
    }
    return false;
}

// see https://github.com/skalenetwork/skale-proxy/blob/develop/endpoints.py
export async function loadSChainParts( joSChain, addressFrom, opts ) {
    owaspUtils.ensureObserverOptionsInitialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chain parts in observer, no imaState is provided" );
    let isEMC = false;
    if( opts.imaState.isEnabledMultiCall )
        isEMC = await isMulticallAvailable( opts.imaState.chainProperties.mn );
    joSChain.data.computed = {};
    const computedSChainId = owaspUtils.ethersMod.ethers.utils.id( joSChain.data.name );
    const chainId = owaspUtils.computeChainIdFromSChainName( joSChain.data.name );
    const arrNodeIds =
        await opts.imaState.joSChainsInternal.callStatic.getNodesInGroup(
            computedSChainId,
            { from: addressFrom } );
    const nodes = [];
    if( isEMC ) {
        const multicall = new EMC.Multicall( {
            ethersProvider: opts.imaState.chainProperties.mn.ethersProvider,
            tryAggregate: true
        } );
        const strRef0 = "Nodes-nodes";
        const strRef1 = "Nodes-getNodeDomainName";
        const strRef2 = "Nodes-isNodeInMaintenance";
        const strRef3 = "SchainsInternal-getSchainHashesForNode";
        const contractCallContext = [ {
            reference: strRef0,
            contractAddress: opts.imaState.joNodes.address,
            abi: opts.imaState.joAbiSkaleManager.nodes_abi,
            calls: [ ]
        }, {
            reference: strRef1,
            contractAddress: opts.imaState.joNodes.address,
            abi: opts.imaState.joAbiSkaleManager.nodes_abi,
            calls: [ ]
        }, {
            reference: strRef2,
            contractAddress: opts.imaState.joNodes.address,
            abi: opts.imaState.joAbiSkaleManager.nodes_abi,
            calls: [ ]
        }, {
            reference: strRef3,
            contractAddress: opts.imaState.joSChainsInternal.address,
            abi: opts.imaState.joAbiSkaleManager.schains_internal_abi,
            calls: [ ]
        } ];
        for( const nodeId of arrNodeIds ) {
            if( opts && opts.bStopNeeded )
                return;
            contractCallContext[0].calls.push(
                {
                    reference: strRef0,
                    methodName: "nodes",
                    methodParameters: [ nodeId ]
                } );
            contractCallContext[1].calls.push(
                {
                    reference: strRef1,
                    methodName: "getNodeDomainName",
                    methodParameters: [ nodeId ]
                } );
            contractCallContext[2].calls.push(
                {
                    reference: strRef2,
                    methodName: "isNodeInMaintenance",
                    methodParameters: [ nodeId ]
                } );
            contractCallContext[3].calls.push(
                {
                    reference: strRef3,
                    methodName: "getSchainHashesForNode",
                    methodParameters: [ nodeId ]
                } );
        }
        const rawResults = await multicall.call( contractCallContext );
        let idxResult = 0;
        for( const nodeId of arrNodeIds ) {
            const values0 =
                rawResults.results[strRef0].callsReturnContext[idxResult].returnValues;
            const values1 =
                rawResults.results[strRef1].callsReturnContext[idxResult].returnValues;
            const values2 =
                rawResults.results[strRef2].callsReturnContext[idxResult].returnValues;
            const values3 =
                rawResults.results[strRef3].callsReturnContext[idxResult].returnValues;
            const nodeDict = {
                "id": nodeId,
                "name": values0[0],
                "ip": owaspUtils.ipFromHex( values0[1] ),
                "basePort": values0[3],
                "domain": values1[0],
                "isMaintenance": values2[0]
            };
            if( opts && opts.bStopNeeded )
                return;
            const arrFetchedSChainIds = values3;
            nodeDict.basePortOfSChain = getSChainBasePortOnNode(
                computedSChainId, arrFetchedSChainIds, nodeDict.basePort );
            calcPorts( joSChain, nodeDict.basePortOfSChain );
            composeEndPoints( joSChain, nodeDict, "ip" );
            composeEndPoints( joSChain, nodeDict, "domain" );
            nodes.push( nodeDict );
            if( opts && opts.bStopNeeded )
                return;
            ++ idxResult;
        }
    } else {
        for( const nodeId of arrNodeIds ) {
            if( opts && opts.bStopNeeded )
                return;
            const node =
                await opts.imaState.joNodes.callStatic.nodes( nodeId, { from: addressFrom } );
            const nodeDict = {
                "id": nodeId,
                "name": node[0],
                "ip": owaspUtils.ipFromHex( node[1] ),
                "basePort": node[3],
                "domain":
                    await opts.imaState.joNodes.callStatic.getNodeDomainName(
                        nodeId, { from: addressFrom } ),
                "isMaintenance":
                    await opts.imaState.joNodes.callStatic.isNodeInMaintenance(
                        nodeId, { from: addressFrom } )
            };
            if( opts && opts.bStopNeeded )
                return;
            const arrFetchedSChainIds =
                await opts.imaState.joSChainsInternal.callStatic.getSchainHashesForNode(
                    nodeId, { from: addressFrom } );
            nodeDict.basePortOfSChain =
                getSChainBasePortOnNode(
                    computedSChainId, arrFetchedSChainIds, nodeDict.basePort );
            calcPorts( joSChain, nodeDict.basePortOfSChain );
            composeEndPoints( joSChain, nodeDict, "ip" );
            composeEndPoints( joSChain, nodeDict, "domain" );
            nodes.push( nodeDict );
            if( opts && opts.bStopNeeded )
                return;
        }
    }
    joSChain.data.computed.computedSChainId = computedSChainId;
    joSChain.data.computed.chainId = chainId;
    joSChain.data.computed.nodes = nodes;
}

export async function getSChainsCount( addressFrom, opts ) {
    owaspUtils.ensureObserverOptionsInitialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot get S-Chains count, no imaState is provided" );
    const cntSChains =
        await opts.imaState.joSChainsInternal.callStatic.numberOfSchains(
            { from: addressFrom } );
    return cntSChains;
}

export function removeSChainDescDataNumKeys( joSChain ) {
    const cnt = Object.keys( joSChain ).length;
    for( let i = 0; i < cnt; ++ i ) {
        try {
            delete joSChain[i];
        } catch ( err ) {
        }
    }
}

function process_sc_data( rawData ) {
    // convert needed fields of struct ISchainsInternal.Schain
    const joData = {
        // for debugging we can use here: "rawData": rawData,
        "name": rawData[0],
        "owner": rawData[1]
    };
    // for debugging we can use here: joData = owaspUtils.cloneObjectByRootKeys( joData );
    return joData;
}

export async function loadSChain( addressFrom, idxSChain, hash, joData, cntSChains, opts ) {
    owaspUtils.ensureObserverOptionsInitialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chain description in observer, no imaState is provided" );
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.debug( "Loading S-Chain " ) + cc.notice( "#" ) +
                cc.info( idxSChain + 1 ) + cc.debug( " of " ) + cc.info( cntSChains ) +
                cc.debug( "..." ) + "\n" );
        }
    }
    hash = hash ||
        await opts.imaState.joSChainsInternal.callStatic.schainsAtSystem(
            idxSChain, { from: addressFrom } );
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace )
            opts.details.write( cc.debug( "    Hash " ) + cc.attention( hash ) + "\n" );
    }
    if( opts && opts.bStopNeeded )
        return null;
    joData = joData ||
        process_sc_data( await opts.imaState.joSChainsInternal.callStatic.schains(
            hash, { from: addressFrom } ) );
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace )
            opts.details.write( cc.debug( "    Data of chain is " ) + cc.j( joData ) + "\n" );
    }
    const joSChain = { "data": joData };
    removeSChainDescDataNumKeys( joSChain.data, addressFrom );
    if( opts && opts.bStopNeeded )
        return null;
    await loadSChainParts( joSChain, addressFrom, opts );
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.debug( "    Desc " ) + cc.j( joSChain.data ) + "\n" );
            opts.details.write( cc.success( "Done" ) + "\n" );
        }
    }
    joSChain.isConnected = false;
    return joSChain;
}

export async function loadSChains( addressFrom, opts ) {
    owaspUtils.ensureObserverOptionsInitialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains parts in observer, no imaState is provided" );
    let isEMC = false;
    if( opts.imaState.isEnabledMultiCall )
        isEMC = await isMulticallAvailable( opts.imaState.chainProperties.mn );
    if( isEMC )
        return await loadSChainsWithEMC( addressFrom, opts );
    return await loadSChainsOptimal( addressFrom, opts );
}

export async function loadSChainsWithEMC( addressFrom, opts ) {
    const cntSChains = await getSChainsCount( addressFrom, opts );
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.debug( "Have " ) + cc.info( cntSChains ) +
                cc.debug( " S-Chain(s) to load..." ) + "\n" );
        }
    }
    const multicall = new EMC.Multicall( {
        ethersProvider: opts.imaState.chainProperties.mn.ethersProvider,
        tryAggregate: true
    } );
    const cntGroupMax = 30, cntLastExtraGroup = cntSChains % cntGroupMax;
    const bHaveExtraGroup = ( cntLastExtraGroup > 0 ) ? true : false;
    const cntGroups = Math.floor( cntSChains / cntGroupMax ) + ( bHaveExtraGroup ? 1 : 0 );
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write(
                cc.debug( "    Have " ) + cc.info( cntGroups ) +
                cc.debug( " multicall group(s), max possible " ) + cc.attention( cntGroupMax ) +
                cc.debug( " call(s) in each" ) + "\n" );
            if( bHaveExtraGroup ) {
                opts.details.write(
                    cc.debug( "    Have last extra multicall group with " ) +
                    cc.attention( cntLastExtraGroup ) + cc.debug( " call(s) in it" ) + "\n" );
            }
        }
    }
    const arrSChainHashes = [];
    for( let idxGroup = 0; idxGroup < cntGroups; ++ idxGroup ) {
        if( opts && opts.bStopNeeded )
            return null;
        const idxFirstChainInGroup = idxGroup * cntGroupMax;
        const cntInThisGroup = ( idxGroup == ( cntGroups - 1 ) && bHaveExtraGroup )
            ? cntLastExtraGroup : cntGroupMax;
        if( opts && opts.details ) {
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                opts.details.write(
                    cc.debug( "    Processing chain hashes in multicall group #" ) +
                    cc.info( idxGroup ) + cc.debug( " with " ) + cc.attention( cntInThisGroup ) +
                    cc.debug( " call(s) in it..." ) + "\n" );
            }
        }
        const strRef3 = "SchainsInternal-schainsAtSystem";
        const contractCallContext = [ {
            reference: strRef3,
            contractAddress: opts.imaState.joSChainsInternal.address,
            abi: opts.imaState.joAbiSkaleManager.schains_internal_abi,
            calls: [ ]
        } ];
        for( let idxSChain = 0; idxSChain < cntInThisGroup; ++ idxSChain ) {
            if( opts && opts.bStopNeeded )
                return null;
            contractCallContext[0].calls.push(
                {
                    reference: strRef3,
                    methodName: "schainsAtSystem",
                    methodParameters: [ idxFirstChainInGroup + idxSChain ]
                } );
        }
        const rawResults = await multicall.call( contractCallContext );
        if( opts && opts.bStopNeeded )
            return null;
        for( let idxSChain = 0; idxSChain < cntInThisGroup; ++ idxSChain ) {
            if( opts && opts.bStopNeeded )
                return null;
            const idxResult = 0 + idxSChain;
            const values3 =
                rawResults.results[strRef3].callsReturnContext[idxResult].returnValues;
            const hash = values3[0];
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    opts.details.write(
                        cc.debug( "    Hash of chain #" ) +
                        cc.info( idxFirstChainInGroup + idxSChain ) +
                        cc.debug( " is " ) + cc.attention( hash ) + "\n" );
                }
            }
            arrSChainHashes.push( hash );
        }
        if( opts && opts.bStopNeeded )
            return null;
    }
    if( opts && opts.bStopNeeded )
        return null;
    const arrSChainDataRecords = [];
    for( let idxGroup = 0; idxGroup < cntGroups; ++ idxGroup ) {
        if( opts && opts.bStopNeeded )
            return null;
        const idxFirstChainInGroup = idxGroup * cntGroupMax;
        const cntInThisGroup = ( idxGroup == ( cntGroups - 1 ) && bHaveExtraGroup )
            ? cntLastExtraGroup : cntGroupMax;
        if( opts && opts.details ) {
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                opts.details.write(
                    cc.debug( "    Processing chain data in multicall group #" ) +
                    cc.info( idxGroup ) + cc.debug( " with " ) + cc.attention( cntInThisGroup ) +
                    cc.debug( " call(s) in it..." ) + "\n" );
            }
        }
        const strRef3 = "SchainsInternal-schains";
        const contractCallContext = [ {
            reference: strRef3,
            contractAddress: opts.imaState.joSChainsInternal.address,
            abi: opts.imaState.joAbiSkaleManager.schains_internal_abi,
            calls: [ ]
        } ];
        for( let idxSChain = 0; idxSChain < cntInThisGroup; ++ idxSChain ) {
            if( opts && opts.bStopNeeded )
                return null;
            const hash = arrSChainHashes[idxFirstChainInGroup + idxSChain];
            contractCallContext[0].calls.push(
                {
                    reference: strRef3,
                    methodName: "schains",
                    methodParameters: [ hash ]
                } );
        }
        const rawResults = await multicall.call( contractCallContext );
        if( opts && opts.bStopNeeded )
            return null;
        for( let idxSChain = 0; idxSChain < cntInThisGroup; ++ idxSChain ) {
            if( opts && opts.bStopNeeded )
                return null;
            const idxResult = 0 + idxSChain;
            const values3 =
                rawResults.results[strRef3].callsReturnContext[idxResult].returnValues;
            const joData = process_sc_data( values3 );
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    opts.details.write(
                        cc.debug( "    Data of chain #" ) +
                        cc.info( idxFirstChainInGroup + idxSChain ) +
                        cc.debug( " is " ) + cc.j( joData ) + "\n" );
                }
            }
            arrSChainDataRecords.push( joData );
        }
        if( opts && opts.bStopNeeded )
            return null;
    }
    const arrSChains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const hash = arrSChainHashes[idxSChain];
        const joData = arrSChainDataRecords[idxSChain];
        const joSChain = await loadSChain( // with hash + joData
            addressFrom, idxSChain, hash, joData, cntSChains, opts );
        if( ! joSChain )
            break;
        arrSChains.push( joSChain );
    }
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.success( "All " ) + cc.info( cntSChains ) +
                cc.debug( " S-Chain(s) loaded:" ) + cc.j( arrSChains ) + "\n" );
        }
    }
    return arrSChains;
}

export async function loadSChainsOptimal( addressFrom, opts ) {
    owaspUtils.ensureObserverOptionsInitialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains in observer, no imaState is provided" );
    const cntSChains = await getSChainsCount( addressFrom, opts );
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.debug( "Have " ) + cc.info( cntSChains ) +
                cc.debug( " S-Chain(s) to load..." ) + "\n" );
        }
    }
    const arrSChains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const joSChain = await loadSChain(
            addressFrom, idxSChain, null, null, cntSChains, opts );
        if( ! joSChain )
            break;
        arrSChains.push( joSChain );
    }
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.success( "All " ) + cc.info( cntSChains ) +
                cc.debug( " S-Chain(s) loaded:" ) + cc.j( arrSChains ) + "\n" );
        }
    }
    return arrSChains;
}

export async function loadCachedSChainsSimplified( addressFrom, opts ) {
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains in observer, no imaState is provided" );
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace )
            opts.details.write( cc.debug( "Will request all S-Chain(s) hashes..." ) + "\n" );
    }
    const arrSChainHashes =
        await opts.imaState.joSChainsInternal.callStatic.getSchains(
            { from: addressFrom } );
    const cntSChains = arrSChainHashes.length;
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.debug( "Have all " ) + cc.info( cntSChains ) +
                cc.debug( " S-Chain(s) hashes: " ) + cc.j( arrSChainHashes ) + "\n" );
        }
    }
    const arrSChains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const strSChainHash = arrSChainHashes[idxSChain];
        const strSChainName =
            await opts.imaState.joSChainsInternal.callStatic.getSchainName(
                strSChainHash, { from: addressFrom } );
        if( opts && opts.details ) {
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                opts.details.write( cc.debug( "S-Chain " ) + cc.notice( idxSChain ) +
                    cc.debug( " hash " ) + cc.notice( strSChainHash ) +
                    cc.debug( " corresponds to S-Chain name " ) + cc.notice( strSChainName ) +
                    "\n" );
            }
        }
        if( opts && opts.bStopNeeded )
            break;
        const joSChain = await loadSChain(
            addressFrom, idxSChain, strSChainHash, null, cntSChains, opts );
        if( ! joSChain )
            break;
        arrSChains.push( joSChain );
    }
    return arrSChains;
}

export async function loadSChainsConnectedOnly(
    strChainNameConnectedTo,
    addressFrom,
    opts
) {
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains in observer, no imaState is provided" );
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace )
            opts.details.write( cc.debug( "Will request all S-Chain(s) hashes..." ) + "\n" );
    }
    const arrSChainHashes =
        await opts.imaState.joSChainsInternal.callStatic.getSchains(
            { from: addressFrom } );
    const cntSChains = arrSChainHashes.length;
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.debug( "Have all " ) + cc.info( cntSChains ) +
                cc.debug( " S-Chain(s) hashes: " ) + cc.j( arrSChainHashes ) + "\n" );
        }
    }
    const joMessageProxySChain =
        new owaspUtils.ethersMod.ethers.Contract(
            opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_address,
            opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_abi,
            opts.imaState.chainProperties.sc.ethersProvider
        );
    const arrSChains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        try {
            if( opts && opts.bStopNeeded )
                break;
            const strSChainHash = arrSChainHashes[idxSChain];
            const strSChainName =
                await opts.imaState.joSChainsInternal.callStatic.getSchainName(
                    strSChainHash, { from: addressFrom } );
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    opts.details.write( cc.debug( "S-Chain " ) + cc.notice( idxSChain ) +
                        cc.debug( " hash " ) + cc.notice( strSChainHash ) +
                        cc.debug( " corresponds to S-Chain name " ) + cc.notice( strSChainName ) +
                        "\n" );
                }
            }
            if( opts && opts.bStopNeeded )
                break;

            if( strChainNameConnectedTo == strSChainName ) {
                if( opts && opts.details ) {
                    if( log.verboseGet() >= log.verboseReversed().trace ) {
                        opts.details.write( cc.debug( "Skip this S-Chain " ) +
                            cc.info( strSChainName ) + cc.debug( " connected status check" ) +
                            "\n" );
                    }
                }
                continue;
            }
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    opts.details.write( cc.debug( "Querying connected status between S-Chain " ) +
                        cc.info( strSChainName ) + cc.debug( " and S-Chain " ) +
                        cc.info( strChainNameConnectedTo ) + cc.debug( "..." ) + "\n" );
                }
            }
            const isConnected =
                await joMessageProxySChain.callStatic.isConnectedChain(
                    strSChainName, { from: addressFrom } );
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    opts.details.write( cc.debug( "Got S-Chain " ) + cc.info( strSChainName ) +
                        cc.debug( " connected status: " ) + cc.yn( isConnected ) + "\n" );
                }
            }
            if( ! isConnected )
                continue;
            const joSChain = await loadSChain(
                addressFrom, idxSChain, strSChainHash, null, cntSChains, opts );
            if( ! joSChain )
                break;
            joSChain.isConnected = true;
            arrSChains.push( joSChain );
        } catch ( err ) {
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    opts.details.write( cc.error( "Got error: " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
                }
            }
        }
    }
    return arrSChains;
}

export async function checkConnectedSChains(
    strChainNameConnectedTo, arrSChains, addressFrom, opts
) {
    owaspUtils.ensureObserverOptionsInitialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains in observer, no imaState is provided" );
    const cntSChains = arrSChains.length;
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const joSChain = arrSChains[idxSChain];
        joSChain.isConnected = false;
        if( joSChain.data.name == strChainNameConnectedTo )
            continue;
        try {
            const url = pickRandomSChainUrl( joSChain );
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    opts.details.write( cc.debug( "Querying via URL " ) + cc.u( url ) +
                        cc.debug( " to S-Chain " ) + cc.info( joSChain.data.name ) +
                        cc.debug( " whether it's connected to S-Chain " ) +
                        cc.info( strChainNameConnectedTo ) + cc.debug( "..." ) + "\n" );
                }
            }
            const ethersProvider = owaspUtils.getEthersProviderFromURL( url );
            const joMessageProxySChain =
                new owaspUtils.ethersMod.ethers.Contract(
                    opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_address,
                    opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_abi,
                    ethersProvider
                );
            joSChain.isConnected =
                await joMessageProxySChain.callStatic.isConnectedChain(
                    strChainNameConnectedTo, { from: addressFrom } );
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().trace )
                    opts.details.write( cc.debug( "Got " ) + cc.yn( joSChain.isConnected ) + "\n" );
            }
        } catch ( err ) {
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().error ) {
                    opts.details.write( cc.error( "Got error: " ) +
                        cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                        cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
                }
            }
        }
    }
    return arrSChains;
}

export async function filterSChainsMarkedAsConnected( arrSChains, opts ) {
    owaspUtils.ensureObserverOptionsInitialized( opts );
    const arrConnectedSChains = [];
    const cntSChains = arrSChains.length;
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const joSChain = arrSChains[idxSChain];
        if( joSChain.isConnected )
            arrConnectedSChains.push( joSChain );
    }
    return arrConnectedSChains;
}

export function findSChainIndexInArrayByName( arrSChains, strSChainName ) {
    for( let idxSChain = 0; idxSChain < arrSChains.length; ++ idxSChain ) {
        const joSChain = arrSChains[idxSChain];
        if( joSChain.data.name.toString() == strSChainName.toString() )
            return idxSChain;
    }
    return -1;
}

export function mergeSChainsArrayFromTo( arrSrc, arrDst, arrNew, arrOld, opts ) {
    owaspUtils.ensureObserverOptionsInitialized( opts );
    arrNew.splice( 0, arrNew.length );
    arrOld.splice( 0, arrOld.length );
    let i, j, cnt;
    cnt = arrSrc.length;
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.debug( "Before merging, have " ) + cc.info( cnt ) +
                cc.debug( " S-Chain(s) to review" ) + "\n" );
        }
    }
    for( i = 0; i < cnt; ++ i ) {
        const joSChain = arrSrc[i];
        j = findSChainIndexInArrayByName( arrDst, joSChain.data.name );
        if( j < 0 ) {
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    opts.details.write( cc.debug( "Found new " ) + cc.notice( "#" ) +
                        cc.info( i + 1 ) + cc.debug( " S-Chain " ) + cc.j( joSChain ) + "\n" );
                }
            }
            arrNew.push( joSChain );
        }
    }
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.debug( "Summary, found new " ) + cc.info( arrNew.length ) +
                cc.debug( " S-Chain(s)" ) + "\n" );
        }
    }
    cnt = arrDst.length;
    for( i = 0; i < cnt; ++ i ) {
        const joSChain = arrDst[i];
        j = findSChainIndexInArrayByName( arrSrc, joSChain.data.name );
        if( j < 0 ) {
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    opts.details.write( cc.debug( "Found old S-Chain " ) + cc.notice( "#" ) +
                        cc.info( i + 1 ) + cc.debug( " " ) + cc.j( joSChain ) + "\n" );
                }
            }
            arrOld.push( joSChain );
        }
    }
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.debug( "Summary, found old " ) + cc.info( arrOld.length ) +
                cc.debug( " S-Chain(s)" ) + "\n" );
        }
    }
    if( arrNew.length > 0 ) {
        if( opts && opts.details ) {
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                opts.details.write( cc.debug( "Merging new " ) + cc.info( arrNew.length ) +
                    cc.debug( " S-Chain(s)" ) + "\n" );
            }
        }
        for( i = 0; i < arrNew.length; ++ i ) {
            const joSChain = arrNew[i];
            arrDst.push( joSChain );
        }
        if( opts && opts.details ) {
            if( log.verboseGet() >= log.verboseReversed().trace )
                opts.details.write( cc.success( "Done" ) + "\n" );
        }
    }
    if( arrOld.length > 0 ) {
        if( opts && opts.details ) {
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                opts.details.write( cc.debug( "Removing old " ) + cc.info( arrOld.length ) +
                    cc.debug( " S-Chain(s)" ) + "\n" );
            }
        }
        for( i = 0; i < arrOld.length; ++ i ) {
            const joSChain = arrOld[i];
            j = findSChainIndexInArrayByName( arrDst, joSChain.data.name );
            arrDst.splice( j, 1 );
        }
        if( opts && opts.details ) {
            if( log.verboseGet() >= log.verboseReversed().trace )
                opts.details.write( cc.success( "Done" ) + "\n" );
        }
    }
    if( opts && opts.details ) {
        if( log.verboseGet() >= log.verboseReversed().trace ) {
            opts.details.write( cc.success( "Finally, have " ) + cc.info( arrDst.length ) +
                cc.success( " S-Chain(s)" ) + "\n" );
        }
    }
}

let gArrSChainsCached = [];

export async function cacheSChains( strChainNameConnectedTo, addressFrom, opts ) {
    owaspUtils.ensureObserverOptionsInitialized( opts );
    let strError = null;
    try {
        const arrSChains = await loadSChains( addressFrom, opts );
        if( strChainNameConnectedTo &&
            ( typeof strChainNameConnectedTo == "string" ) &&
            strChainNameConnectedTo.length > 0
        ) {
            await checkConnectedSChains(
                strChainNameConnectedTo,
                arrSChains,
                addressFrom,
                opts
            );
            gArrSChainsCached = await filterSChainsMarkedAsConnected(
                arrSChains,
                opts
            );
        } else
            gArrSChainsCached = arrSChains;
        if( opts && opts.details ) {
            if( log.verboseGet() >= log.verboseReversed().trace ) {
                opts.details.write( cc.debug( "Connected " ) + cc.attention( "S-Chains" ) +
                    cc.debug( " cache was updated in this thread: " ) +
                    cc.j( gArrSChainsCached ) + "\n" );
            }
        }
        if( opts.fnCacheChanged )
            opts.fnCacheChanged( gArrSChainsCached, null ); // null - no error
    } catch ( err ) {
        strError = owaspUtils.extractErrorMessage( err );
        if( ! strError )
            strError = "unknown exception during S-Chains download";
        if( opts.fnCacheChanged )
            opts.fnCacheChanged( gArrSChainsCached, strError );
        if( opts && opts.details ) {
            if( log.verboseGet() >= log.verboseReversed().error ) {
                opts.details.write( cc.fatal( "ERROR:" ) +
                    cc.error( " Failed to cache: " ) + cc.error( err ) );
                opts.details.write( cc.stack( err.stack ) );
            }
        }
    }
    return strError; // null on success
}

export function getLastCachedSChains() {
    return JSON.parse( JSON.stringify( gArrSChainsCached ) );
}

export function setLastCachedSChains( arrSChainsCached ) {
    if( arrSChainsCached && typeof arrSChainsCached == "object" ) {
        gArrSChainsCached = JSON.parse( JSON.stringify( arrSChainsCached ) );
        events.dispatchEvent(
            new UniversalDispatcherEvent(
                "chainsCacheChanged",
                { "detail": { "arrSChainsCached": getLastCachedSChains() } } ) );
    }
}

const sleepImpl = ( milliseconds ) => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
};

let gWorker = null;
let gClient = null;

export async function ensureHaveWorker( opts ) {
    owaspUtils.ensureObserverOptionsInitialized( opts );
    if( gWorker )
        return gWorker;
    const url = "skale_observer_worker_server";
    gWorker =
        new Worker(
            path.join( __dirname, "observerWorker.mjs" ),
            { "type": "module" }
        );
    gWorker.on( "message", jo => {
        if( networkLayer.outOfWorkerAPIs.onMessage( gWorker, jo ) )
            return;
    } );
    gClient = new networkLayer.OutOfWorkerSocketClientPipe( url, gWorker );
    gClient.on( "message", function( eventData ) {
        const joMessage = eventData.message;
        switch ( joMessage.method ) {
        case "periodicCachingDoNow":
            setLastCachedSChains( joMessage.message );
            gFlagHaveParallelResult = true;
            if( opts && opts.details ) {
                if( log.verboseGet() >= log.verboseReversed().trace ) {
                    opts.details.write( cc.debug( "Connected " ) + cc.attention( "S-Chains" ) +
                        cc.debug( " cache was updated using data arrived from SNB worker: " ) +
                        cc.j( gArrSChainsCached ) + "\n" );
                }
            }
            break;
        case "log":
            log.write( cc.attention( "SNB WORKER" ) + " " + joMessage.message );
            break;
        } // switch ( joMessage.method )
    } );
    await sleepImpl( 1000 );
    const jo = {
        "method": "init",
        "message": {
            "opts": {
                "imaState": {
                    "verbose_": log.verboseGet(),
                    "expose_details_": log.exposeDetailsGet(),
                    "bNoWaitSChainStarted": opts.imaState.bNoWaitSChainStarted,
                    "nMaxWaitSChainAttempts": opts.imaState.nMaxWaitSChainAttempts,
                    "nNodeNumber": opts.imaState.nNodeNumber,
                    "nNodesCount": opts.imaState.nNodesCount,
                    "nTimeFrameSeconds": opts.imaState.nTimeFrameSeconds,
                    "nNextFrameGap": opts.imaState.nNextFrameGap,
                    "chainProperties": {
                        "mn": {
                            "joAccount": {
                                "privateKey": opts.imaState.chainProperties.mn.joAccount.privateKey,
                                "strTransactionManagerURL":
                                    opts.imaState.chainProperties.mn
                                        .joAccount.strTransactionManagerURL,
                                "nTmPriority":
                                    opts.imaState.chainProperties.mn
                                        .joAccount.nTmPriority,
                                "strSgxURL":
                                    opts.imaState.chainProperties.mn
                                        .joAccount.strSgxURL,
                                "strSgxKeyName":
                                    opts.imaState.chainProperties.mn
                                        .joAccount.strSgxKeyName,
                                "strPathSslKey":
                                    opts.imaState.chainProperties.mn
                                        .joAccount.strPathSslKey,
                                "strPathSslCert":
                                    opts.imaState.chainProperties.mn
                                        .joAccount.strPathSslCert,
                                "strBlsKeyName":
                                    opts.imaState.chainProperties.mn
                                        .joAccount.strBlsKeyName
                            },
                            "strURL": opts.imaState.chainProperties.mn.strURL,
                            "strChainName": opts.imaState.chainProperties.mn.strChainName,
                            "chainId": opts.imaState.chainProperties.mn.chainId,
                            "joAbiIMA": opts.imaState.chainProperties.mn.joAbiIMA,
                            "bHaveAbiIMA": opts.imaState.chainProperties.mn.bHaveAbiIMA
                        },
                        "sc": {
                            "joAccount": {
                                "privateKey":
                                    opts.imaState.chainProperties.sc.joAccount.privateKey,
                                "strTransactionManagerURL":
                                    opts.imaState.chainProperties.sc
                                        .joAccount.strTransactionManagerURL,
                                "nTmPriority":
                                    opts.imaState.chainProperties.sc
                                        .joAccount.nTmPriority,
                                "strSgxURL":
                                    opts.imaState.chainProperties.sc
                                        .joAccount.strSgxURL,
                                "strSgxKeyName":
                                    opts.imaState.chainProperties.sc
                                        .joAccount.strSgxKeyName,
                                "strPathSslKey":
                                    opts.imaState.chainProperties.sc
                                        .joAccount.strPathSslKey,
                                "strPathSslCert":
                                    opts.imaState.chainProperties.sc
                                        .joAccount.strPathSslCert,
                                "strBlsKeyName":
                                    opts.imaState.chainProperties.sc
                                        .joAccount.strBlsKeyName
                            },
                            "strURL": opts.imaState.chainProperties.sc.strURL,
                            "strChainName": opts.imaState.chainProperties.sc.strChainName,
                            "chainId": opts.imaState.chainProperties.sc.chainId,
                            "joAbiIMA": opts.imaState.chainProperties.sc.joAbiIMA,
                            "bHaveAbiIMA": opts.imaState.chainProperties.sc.bHaveAbiIMA
                        }
                    },
                    "joAbiSkaleManager": opts.imaState.joAbiSkaleManager,
                    "bHaveSkaleManagerABI": opts.imaState.bHaveSkaleManagerABI,
                    "joSChainDiscovery": {
                        "isSilentReDiscovery":
                            opts.imaState.joSChainDiscovery.isSilentReDiscovery,
                        "repeatIntervalMilliseconds":
                            opts.imaState.joSChainDiscovery.repeatIntervalMilliseconds
                    }
                }
            },
            "cc": {
                "isEnabled": cc.isEnabled()
            }
        }
    };
    gClient.send( jo );
}

async function inThreadPeriodicCachingStart( strChainNameConnectedTo, addressFrom, opts ) {
    if( gIntervalPeriodicCaching != null )
        return;
    try {
        const fnDoCachingNow = async function() {
            await cacheSChains( strChainNameConnectedTo, addressFrom, opts );
        };
        gIntervalPeriodicCaching =
            setInterval(
                fnDoCachingNow,
                parseInt( opts.secondsToReDiscoverSkaleNetwork ) * 1000 );
        await fnDoCachingNow();
        return true;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            log.write( cc.error( "Failed to start in-thread periodic SNB refresh, error is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
    }
    return false;
}

async function parallelPeriodicCachingStart( strChainNameConnectedTo, addressFrom, opts ) {
    gFlagHaveParallelResult = false;
    try {
        const nSecondsToWaitParallel = 60;
        setTimeout( function() {
            if( gFlagHaveParallelResult )
                return;
            if( log.verboseGet() >= log.verboseReversed().error ) {
                log.write( cc.error( "Failed to start parallel periodic SNB refresh, error is: " ) +
                    cc.warning( "timeout of " ) + cc.info( nSecondsToWaitParallel ) +
                    cc.warning( " reached, will restart periodic SNB refresh " +
                        "in non-parallel mode" ) + "\n" );
            }
            periodicCachingStop();
            inThreadPeriodicCachingStart( strChainNameConnectedTo, addressFrom, opts );
        }, nSecondsToWaitParallel * 1000 );
        owaspUtils.ensureObserverOptionsInitialized( opts );
        await ensureHaveWorker( opts );
        const jo = {
            "method": "periodicCachingStart",
            "message": {
                "secondsToReDiscoverSkaleNetwork":
                    parseInt( opts.secondsToReDiscoverSkaleNetwork ),
                "strChainNameConnectedTo": strChainNameConnectedTo,
                "addressFrom": addressFrom
            }
        };
        gClient.send( jo );
        return true;
    } catch ( err ) {
        if( log.verboseGet() >= log.verboseReversed().error ) {
            log.write( cc.error( "Failed to start parallel periodic SNB refresh, error is: " ) +
                cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
    }
    return false;
}

export async function periodicCachingStart( strChainNameConnectedTo, addressFrom, opts ) {
    gFlagHaveParallelResult = false;
    const bParallelMode =
        ( opts && "bParallelMode" in opts &&
        typeof opts.bParallelMode != "undefined" &&
        opts.bParallelMode )
            ? true : false;
    let wasStarted = false;
    if( bParallelMode ) {
        wasStarted =
            parallelPeriodicCachingStart( strChainNameConnectedTo, addressFrom, opts );
    }
    if( wasStarted )
        return;
    inThreadPeriodicCachingStart( strChainNameConnectedTo, addressFrom, opts );
}

export async function periodicCachingStop() {
    if( gWorker && gClient ) {
        try {
            const jo = {
                "method": "periodicCachingStop",
                "message": { }
            };
            gClient.send( jo );
        } catch ( err ) {
            if( log.verboseGet() >= log.verboseReversed().error ) {
                log.write( cc.error( "Failed to stop parallel periodic SNB refresh, error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
        }
    }
    if( gIntervalPeriodicCaching ) {
        try {
            clearInterval( gIntervalPeriodicCaching );
            gIntervalPeriodicCaching = null;
        } catch ( err ) {
            if( log.verboseGet() >= log.verboseReversed().error ) {
                log.write( cc.error( "Failed to stop in-thread periodic SNB refresh, error is: " ) +
                    cc.warning( owaspUtils.extractErrorMessage( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
            }
            gIntervalPeriodicCaching = null; // clear it anyway
        }
    }
    gFlagHaveParallelResult = false;
}

export function pickRandomSChainNodeIndex( joSChain ) {
    let min = 0, max = joSChain.data.computed.nodes.length - 1;
    min = Math.ceil( min );
    max = Math.floor( max );
    const idxNode = Math.floor( Math.random() * ( max - min + 1 ) ) + min;
    return idxNode;
}
export function pickRandomSChainNode( joSChain ) {
    const idxNode = pickRandomSChainNodeIndex( joSChain );
    return joSChain.data.computed.nodes[idxNode];
}

export function pickRandomSChainUrl( joSChain ) {
    const joNode = pickRandomSChainNode( joSChain );
    // eslint-disable-next-line dot-notation
    return "" + joNode["http_endpoint_ip"];
}

export async function discoverChainId( strURL ) {
    let ret = null;
    const rpcCallOpts = null;
    await rpcCall.create( strURL, rpcCallOpts, async function( joCall, err ) {
        if( err ) {
            if( joCall )
                await joCall.disconnect();
            return;
        }
        await joCall.call( {
            "method": "eth_chainId",
            "params": []
        }, async function( joIn, joOut, err ) {
            if( err ) {
                await joCall.disconnect();
                return;
            }
            if( ! ( "result" in joOut && joOut.result ) ) {
                await joCall.disconnect();
                return;
            }
            ret = joOut.result;
            await joCall.disconnect();
        } ); // joCall.call ...
    } ); // rpcCall.create ...
    return ret;
}
