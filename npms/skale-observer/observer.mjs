
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
import * as network_layer from "../skale-cool-socket/socket.mjs";
import { Worker } from "worker_threads";
import * as owaspUtils from "../skale-owasp/owasp-utils.mjs";
import * as cc from "../skale-cc/cc.mjs";
import * as log from "../skale-log/log.mjs";
import * as rpcCall from "../../agent/rpc-call.mjs";

import { UniversalDispatcherEvent, EventDispatcher }
    from "../skale-cool-socket/event_dispatcher.mjs";

//import { Multicall, ContractCallResults, ContractCallContext } from "ethereum-multicall";
import * as EMC from "ethereum-multicall";
// EMC.Multicall

const __dirname = path.dirname( url.fileURLToPath( import.meta.url ) );

let g_interval_periodic_caching = null;
let g_bHaveParallelResult = false;

const PORTS_PER_SCHAIN = 64;

export const events = new EventDispatcher();

export function get_schain_index_in_node( schain_id, schains_ids_on_node ) {
    let i = 0;
    for( const schain_id_on_node of schains_ids_on_node ) {
        if( schain_id == schain_id_on_node )
            return i;
        ++ i;
    }
    throw new Error(
        "S-Chain " + schain_id + " is not found in the list: " +
        JSON.stringify( schains_ids_on_node ) );
}

export function get_schain_base_port_on_node( schain_id, schains_ids_on_node, node_base_port ) {
    const schain_index = get_schain_index_in_node( schain_id, schains_ids_on_node );
    return calc_schain_base_port( node_base_port, schain_index );
}

export function calc_schain_base_port( node_base_port, schain_index ) {
    return parseInt( node_base_port ) + parseInt( schain_index ) * PORTS_PER_SCHAIN;
}

export function compose_endpoints( jo_schain, node_dict, endpoint_type ) {
    node_dict["http_endpoint_" + endpoint_type] =
        "http://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.httpRpcPort;
    node_dict["https_endpoint_" + endpoint_type] =
        "https://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.httpsRpcPort;
    node_dict["ws_endpoint_" + endpoint_type] =
        "ws://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.wsRpcPort;
    node_dict["wss_endpoint_" + endpoint_type] =
        "wss://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.wssRpcPort;
    node_dict["info_http_endpoint_" + endpoint_type] =
        "http://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.infoHttpRpcPort;
    node_dict["ima_agent_endpoint_" + endpoint_type] =
        "http://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.imaAgentRpcPort;
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

export function calc_ports( jo_schain, schain_base_port ) {
    // TO-DO: these temporary port values should be in "node", not in "schain"
    jo_schain.data.computed.ports = {
        httpRpcPort: schain_base_port + SkaledPorts.HTTP_JSON,
        httpsRpcPort: schain_base_port + SkaledPorts.HTTPS_JSON,
        wsRpcPort: schain_base_port + SkaledPorts.WS_JSON,
        wssRpcPort: schain_base_port + SkaledPorts.WSS_JSON,
        infoHttpRpcPort: schain_base_port + SkaledPorts.INFO_HTTP_JSON,
        imaAgentRpcPort: schain_base_port + SkaledPorts.IMA_AGENT_JSON
    };
}

const g_arr_chain_ids_support_multicall = [
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

async function is_multicall_available( mn ) {
    if( mn && mn.ethersProvider ) {
        const { chainId } = await mn.ethersProvider.getNetwork();
        const bnChainId = owaspUtils.toBN( chainId );
        for( let i = 0; i < g_arr_chain_ids_support_multicall.length; ++ i ) {
            const walkChainId = g_arr_chain_ids_support_multicall[i];
            const bnWalkChainId = owaspUtils.toBN( walkChainId );
            if( bnWalkChainId.eq( bnChainId ) )
                return true;
        }
    }
    return false;
}

// see https://github.com/skalenetwork/skale-proxy/blob/develop/endpoints.py
export async function load_schain_parts( jo_schain, addressFrom, opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chain parts in observer, no imaState is provided" );
    let isEMC = false;
    if( opts.imaState.isEnabledMultiCall )
        isEMC = is_multicall_available( opts.imaState.chainProperties.mn );
    jo_schain.data.computed = {};
    const schain_id = owaspUtils.ethersMod.ethers.utils.id( jo_schain.data.name );
    const chainId = owaspUtils.compute_chain_id_from_schain_name( jo_schain.data.name );
    const node_ids =
        await opts.imaState.jo_schains_internal.callStatic.getNodesInGroup(
            schain_id,
            { from: addressFrom } );
    const nodes = [];
    if( isEMC ) {
        const multicall = new EMC.Multicall(
            {
                ethersProvider: opts.imaState.chainProperties.mn.ethersProvider,
                tryAggregate: true
            }
        );
        const strRef0 = "Nodes-nodes";
        const strRef1 = "Nodes-getNodeDomainName";
        const strRef2 = "Nodes-isNodeInMaintenance";
        const strRef3 = "SchainsInternal-getSchainHashesForNode";
        const contractCallContext = [
            {
                reference: strRef0,
                contractAddress: opts.imaState.jo_nodes.address,
                // abi:find_one_function_abi( opts.imaState.joAbiSkaleManager.nodes_abi, "nodes" ),
                abi: opts.imaState.joAbiSkaleManager.nodes_abi,
                calls: [ ]
            }, {
                reference: strRef1,
                contractAddress: opts.imaState.jo_nodes.address,
                abi: opts.imaState.joAbiSkaleManager.nodes_abi,
                calls: [ ]
            }, {
                reference: strRef2,
                contractAddress: opts.imaState.jo_nodes.address,
                abi: opts.imaState.joAbiSkaleManager.nodes_abi,
                calls: [ ]
            }, {
                reference: strRef3,
                contractAddress: opts.imaState.jo_schains_internal.address,
                abi: opts.imaState.joAbiSkaleManager.schains_internal_abi,
                calls: [ ]
            }
        ];
        for( const node_id of node_ids ) {
            if( opts && opts.bStopNeeded )
                return;
            contractCallContext[0].calls.push(
                {
                    reference: strRef0,
                    methodName: "nodes",
                    methodParameters: [ node_id ]
                } );
            contractCallContext[1].calls.push(
                {
                    reference: strRef1,
                    methodName: "getNodeDomainName",
                    methodParameters: [ node_id ]
                } );
            contractCallContext[2].calls.push(
                {
                    reference: strRef2,
                    methodName: "isNodeInMaintenance",
                    methodParameters: [ node_id ]
                } );
            contractCallContext[3].calls.push(
                {
                    reference: strRef3,
                    methodName: "getSchainHashesForNode",
                    methodParameters: [ node_id ]
                } );
        }
        const rawResults = await multicall.call( contractCallContext );
        let idxResult = 0;
        for( const node_id of node_ids ) {
            const values0 =
                rawResults.results[strRef0].callsReturnContext[idxResult].returnValues;
            const values1 =
                rawResults.results[strRef1].callsReturnContext[idxResult].returnValues;
            const values2 =
                rawResults.results[strRef2].callsReturnContext[idxResult].returnValues;
            const values3 =
                rawResults.results[strRef3].callsReturnContext[idxResult].returnValues;
            const node_dict = {
                "id": node_id,
                "name": values0[0],
                "ip": owaspUtils.ip_from_hex( values0[1] ),
                "base_port": values0[3],
                "domain": values1[0],
                "isMaintenance": values2[0]
            };
            if( opts && opts.bStopNeeded )
                return;
            const schain_ids = values3;
            node_dict.schain_base_port =
                get_schain_base_port_on_node( schain_id, schain_ids, node_dict.base_port );
            calc_ports( jo_schain, node_dict.schain_base_port );
            compose_endpoints( jo_schain, node_dict, "ip" );
            compose_endpoints( jo_schain, node_dict, "domain" );
            nodes.push( node_dict );
            if( opts && opts.bStopNeeded )
                return;
            ++ idxResult;
        }
    } else { // if( isEMC )
        for( const node_id of node_ids ) {
            if( opts && opts.bStopNeeded )
                return;
            const node =
                await opts.imaState.jo_nodes.callStatic.nodes( node_id, { from: addressFrom } );
            const node_dict = {
                "id": node_id,
                "name": node[0],
                "ip": owaspUtils.ip_from_hex( node[1] ),
                "base_port": node[3],
                "domain":
                    await opts.imaState.jo_nodes.callStatic.getNodeDomainName(
                        node_id, { from: addressFrom } ),
                "isMaintenance":
                    await opts.imaState.jo_nodes.callStatic.isNodeInMaintenance(
                        node_id, { from: addressFrom } )
            };
            if( opts && opts.bStopNeeded )
                return;
            const schain_ids =
                await opts.imaState.jo_schains_internal.callStatic.getSchainHashesForNode(
                    node_id, { from: addressFrom } );
            node_dict.schain_base_port =
                get_schain_base_port_on_node(
                    schain_id, schain_ids, node_dict.base_port );
            calc_ports( jo_schain, node_dict.schain_base_port );
            compose_endpoints( jo_schain, node_dict, "ip" );
            compose_endpoints( jo_schain, node_dict, "domain" );
            nodes.push( node_dict );
            if( opts && opts.bStopNeeded )
                return;
        }
    } // else from if( isEMC )
    jo_schain.data.computed.schain_id = schain_id;
    jo_schain.data.computed.chainId = chainId;
    jo_schain.data.computed.nodes = nodes;
}

export async function get_schains_count( addressFrom, opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot get S-Chains count, no imaState is provided" );
    const cntSChains =
        await opts.imaState.jo_schains_internal.callStatic.numberOfSchains(
            { from: addressFrom } );
    return cntSChains;
}

export function remove_schain_desc_data_num_keys( jo_schain ) {
    const cnt = Object.keys( jo_schain ).length;
    for( let i = 0; i < cnt; ++ i ) {
        try {
            delete jo_schain[i];
        } catch ( err ) {
        }
    }
}

export async function load_schain( addressFrom, idxSChain, hash, cntSChains, opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chain description in observer, no imaState is provided" );
    if( opts && opts.details ) {
        opts.details.write(
            cc.debug( "Loading S-Chain " ) + cc.notice( "#" ) + cc.info( idxSChain + 1 ) +
            cc.debug( " of " ) + cc.info( cntSChains ) + cc.debug( "..." ) +
            "\n" );
    }
    hash = hash ||
        await opts.imaState.jo_schains_internal.callStatic.schainsAtSystem(
            idxSChain, { from: addressFrom } );
    if( opts && opts.details )
        opts.details.write( cc.debug( "    Hash " ) + cc.attention( hash ) + "\n" );
    if( opts && opts.bStopNeeded )
        return null;
    let jo_data =
        await opts.imaState.jo_schains_internal.callStatic.schains(
            hash, { from: addressFrom } );
    // jo_data = JSON.parse( JSON.stringify( jo_data ) );
    jo_data = owaspUtils.clone_object_by_root_keys( jo_data );
    const jo_schain = { "data": jo_data };
    remove_schain_desc_data_num_keys( jo_schain.data, addressFrom );
    if( opts && opts.bStopNeeded )
        return null;
    await load_schain_parts( jo_schain, addressFrom, opts );
    if( opts && opts.details ) {
        opts.details.write( cc.debug( "    Desc " ) + cc.j( jo_schain.data ) + "\n" );
        opts.details.write( cc.success( "Done" ) + "\n" );
    }
    jo_schain.isConnected = false;
    return jo_schain;
}

export async function load_schains( addressFrom, opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains in observer, no imaState is provided" );
    const cntSChains = await get_schains_count( addressFrom, opts );
    if( opts && opts.details ) {
        opts.details.write(
            cc.debug( "Have " ) + cc.info( cntSChains ) + cc.debug( " S-Chain(s) to load..." ) +
            "\n" );
    }
    const arr_schains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const jo_schain = await load_schain( addressFrom, idxSChain, null, cntSChains, opts );
        if( ! jo_schain )
            break;
        arr_schains.push( jo_schain );
    }
    if( opts && opts.details ) {
        opts.details.write(
            cc.success( "All " ) + cc.info( cntSChains ) +
            cc.debug( " S-Chain(s) loaded:" ) + cc.j( arr_schains ) +
            "\n" );
    }
    return arr_schains;
}

export async function load_cached_schains_simplified( addressFrom, opts ) {
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains in observer, no imaState is provided" );
    if( opts && opts.details )
        opts.details.write( cc.debug( "Will request all S-Chain(s) hashes..." ) + "\n" );
    const arrSChainHashes =
        await opts.imaState.jo_schains_internal.callStatic.getSchains(
            { from: addressFrom } );
    const cntSChains = arrSChainHashes.length;
    if( opts && opts.details ) {
        opts.details.write(
            cc.debug( "Have all " ) + cc.info( cntSChains ) + cc.debug( " S-Chain(s) hashes: " ) +
            cc.j( arrSChainHashes ) +
            "\n" );
    }
    const arr_schains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const strSChainHash = arrSChainHashes[idxSChain];
        const strSChainName =
            await opts.imaState.jo_schains_internal.callStatic.getSchainName(
                strSChainHash, { from: addressFrom } );
        if( opts && opts.details ) {
            opts.details.write(
                cc.debug( "S-Chain " ) + cc.notice( idxSChain ) + cc.debug( " hash " ) +
                cc.notice( strSChainHash ) + cc.debug( " corresponds to S-Chain name " ) +
                cc.notice( strSChainName ) +
                "\n" );
        }
        if( opts && opts.bStopNeeded )
            break;
        const jo_schain =
            await load_schain(
                addressFrom, idxSChain, strSChainHash, cntSChains, opts
            );
        if( ! jo_schain )
            break;
        arr_schains.push( jo_schain );
    }
    return arr_schains;
}

export async function load_schains_connected_only(
    strChainNameConnectedTo,
    addressFrom,
    opts
) {
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains in observer, no imaState is provided" );
    if( opts && opts.details )
        opts.details.write( cc.debug( "Will request all S-Chain(s) hashes..." ) + "\n" );
    const arrSChainHashes =
        await opts.imaState.jo_schains_internal.callStatic.getSchains(
            { from: addressFrom } );
    const cntSChains = arrSChainHashes.length;
    if( opts && opts.details ) {
        opts.details.write(
            cc.debug( "Have all " ) + cc.info( cntSChains ) + cc.debug( " S-Chain(s) hashes: " ) +
            cc.j( arrSChainHashes ) +
            "\n" );
    }
    const jo_message_proxy_s_chain =
        new owaspUtils.ethersMod.ethers.Contract(
            opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_address,
            opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_abi,
            opts.imaState.chainProperties.sc.ethersProvider
        );
    const arr_schains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        try {
            if( opts && opts.bStopNeeded )
                break;
            const strSChainHash = arrSChainHashes[idxSChain];
            const strSChainName =
                await opts.imaState.jo_schains_internal.callStatic.getSchainName(
                    strSChainHash, { from: addressFrom } );
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "S-Chain " ) + cc.notice( idxSChain ) + cc.debug( " hash " ) +
                    cc.notice( strSChainHash ) + cc.debug( " corresponds to S-Chain name " ) +
                    cc.notice( strSChainName ) +
                    "\n" );
            }
            if( opts && opts.bStopNeeded )
                break;

            if( strChainNameConnectedTo == strSChainName ) {
                if( opts && opts.details ) {
                    opts.details.write(
                        cc.debug( "Skip this S-Chain " ) + cc.info( strSChainName ) +
                        cc.debug( " connected status check" ) +
                        "\n" );
                }
                continue;
            }
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "Querying connected status between S-Chain " ) +
                    cc.info( strSChainName ) + cc.debug( " and S-Chain " ) +
                    cc.info( strChainNameConnectedTo ) + cc.debug( "..." ) + "\n" );
            }
            const isConnected =
                await jo_message_proxy_s_chain.callStatic.isConnectedChain(
                    strSChainName, { from: addressFrom } );
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "Got S-Chain " ) + cc.info( strSChainName ) +
                    cc.debug( " connected status: " ) + cc.yn( isConnected ) +
                    "\n" );
            }
            if( ! isConnected )
                continue;
            const jo_schain =
                await load_schain(
                    addressFrom, idxSChain, strSChainHash, cntSChains, opts );
            if( ! jo_schain )
                break;
            jo_schain.isConnected = true;
            arr_schains.push( jo_schain );
        } catch ( err ) {
            if( opts && opts.details ) {
                opts.details.write(
                    cc.error( "Got error: " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                    "\n" );
            }
        }
    }
    return arr_schains;
}

export async function check_connected_schains(
    strChainNameConnectedTo, arr_schains, addressFrom, opts
) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains in observer, no imaState is provided" );
    const cntSChains = arr_schains.length;
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const jo_schain = arr_schains[idxSChain];
        jo_schain.isConnected = false;
        if( jo_schain.data.name == strChainNameConnectedTo )
            continue;
        try {
            const url = pick_random_schain_url( jo_schain );
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "Querying via URL " ) + cc.u( url ) +
                    cc.debug( " to S-Chain " ) +
                    cc.info( jo_schain.data.name ) +
                    cc.debug( " whether it's connected to S-Chain " ) +
                    cc.info( strChainNameConnectedTo ) + cc.debug( "..." ) + "\n" );
            }
            const ethersProvider = owaspUtils.getEthersProviderFromURL( url );
            const jo_message_proxy_s_chain =
                new owaspUtils.ethersMod.ethers.Contract(
                    opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_address,
                    opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_abi,
                    ethersProvider
                );
            jo_schain.isConnected =
                await jo_message_proxy_s_chain.callStatic.isConnectedChain(
                    strChainNameConnectedTo, { from: addressFrom } );
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "Got " ) + cc.yn( jo_schain.isConnected ) + "\n" );
            }
        } catch ( err ) {
            if( opts && opts.details ) {
                opts.details.write(
                    cc.error( "Got error: " ) +
                    cc.warning( owaspUtils.extract_error_message( err ) ) +
                    cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                    "\n" );
            }
        }
    }
    return arr_schains;
}

export async function filter_schains_marked_as_connected( arr_schains, opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    const arr_connected_schains = [];
    const cntSChains = arr_schains.length;
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const jo_schain = arr_schains[idxSChain];
        if( jo_schain.isConnected )
            arr_connected_schains.push( jo_schain );
    }
    return arr_connected_schains;
}

export function find_schain_index_in_array_by_name( arr_schains, strSChainName ) {
    for( let idxSChain = 0; idxSChain < arr_schains.length; ++ idxSChain ) {
        const jo_schain = arr_schains[idxSChain];
        if( jo_schain.data.name.toString() == strSChainName.toString() )
            return idxSChain;
    }
    return -1;
}

export function merge_schains_array_from_to( arrSrc, arrDst, arrNew, arrOld, opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    arrNew.splice( 0, arrNew.length );
    arrOld.splice( 0, arrOld.length );
    let i, j, cnt;
    cnt = arrSrc.length;
    if( opts && opts.details ) {
        opts.details.write(
            cc.debug( "Before merging, have " ) + cc.info( cnt ) +
            cc.debug( " S-Chain(s) to review" ) +
            "\n" );
    }
    for( i = 0; i < cnt; ++ i ) {
        const jo_schain = arrSrc[i];
        j = find_schain_index_in_array_by_name( arrDst, jo_schain.data.name );
        if( j < 0 ) {
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "Found new " ) + cc.notice( "#" ) + cc.info( i + 1 ) +
                    cc.debug( " S-Chain " ) + cc.j( jo_schain ) +
                    "\n" );
            }
            arrNew.push( jo_schain );
        }
    }
    if( opts && opts.details ) {
        opts.details.write(
            cc.debug( "Summary, found new " ) + cc.info( arrNew.length ) +
            cc.debug( " S-Chain(s)" ) +
            "\n" );
    }
    cnt = arrDst.length;
    for( i = 0; i < cnt; ++ i ) {
        const jo_schain = arrDst[i];
        j = find_schain_index_in_array_by_name( arrSrc, jo_schain.data.name );
        if( j < 0 ) {
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "Found old S-Chain " ) + cc.notice( "#" ) +
                    cc.info( i + 1 ) + cc.debug( " " ) + cc.j( jo_schain ) +
                    "\n" );
            }
            arrOld.push( jo_schain );
        }
    }
    if( opts && opts.details ) {
        opts.details.write(
            cc.debug( "Summary, found old " ) + cc.info( arrOld.length ) +
            cc.debug( " S-Chain(s)" ) +
            "\n" );
    }
    if( arrNew.length > 0 ) {
        if( opts && opts.details ) {
            opts.details.write(
                cc.debug( "Merging new " ) + cc.info( arrNew.length ) +
                cc.debug( " S-Chain(s)" ) +
                "\n" );
        }
        for( i = 0; i < arrNew.length; ++ i ) {
            const jo_schain = arrNew[i];
            arrDst.push( jo_schain );
        }
        if( opts && opts.details )
            opts.details.write( cc.success( "Done" ) + "\n" );
    }
    if( arrOld.length > 0 ) {
        if( opts && opts.details ) {
            opts.details.write(
                cc.debug( "Removing old " ) + cc.info( arrOld.length ) +
                cc.debug( " S-Chain(s)" ) +
                "\n" );
        }
        for( i = 0; i < arrOld.length; ++ i ) {
            const jo_schain = arrOld[i];
            j = find_schain_index_in_array_by_name( arrDst, jo_schain.data.name );
            arrDst.splice( j, 1 );
        }
        if( opts && opts.details )
            opts.details.write( cc.success( "Done" ) + "\n" );
    }
    if( opts && opts.details ) {
        opts.details.write(
            cc.success( "Finally, have " ) + cc.info( arrDst.length ) +
            cc.success( " S-Chain(s)" ) +
            "\n" );
    }
}

let g_arr_schains_cached = [];

export async function cache_schains( strChainNameConnectedTo, addressFrom, opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    let strError = null;
    try {
        const arr_schains = await load_schains( addressFrom, opts );
        if( strChainNameConnectedTo &&
            ( typeof strChainNameConnectedTo == "string" ) &&
            strChainNameConnectedTo.length > 0
        ) {
            await check_connected_schains(
                strChainNameConnectedTo,
                arr_schains,
                addressFrom,
                opts
            );
            g_arr_schains_cached = await filter_schains_marked_as_connected(
                arr_schains,
                opts
            );
        } else
            g_arr_schains_cached = arr_schains;
        if( opts && opts.details ) {
            opts.details.write(
                cc.debug( "Connected " ) + cc.attention( "S-Chains" ) +
                cc.debug( " cache was updated in this thread: " ) +
                cc.j( g_arr_schains_cached ) + "\n" );
        }
        if( opts.fn_cache_changed )
            opts.fn_cache_changed( g_arr_schains_cached, null ); // null - no error
    } catch ( err ) {
        strError = owaspUtils.extract_error_message( err );
        if( ! strError )
            strError = "unknown exception during S-Chains download";
        if( opts.fn_cache_changed )
            opts.fn_cache_changed( g_arr_schains_cached, strError );
        if( opts && opts.details ) {
            opts.details.write(
                cc.fatal( "ERROR:" ) + cc.error( " Failed to cache: " ) + cc.error( err ) );
            opts.details.write( cc.stack( err.stack ) );
        }
    }
    return strError; // null on success
}

export function get_last_cached_schains() {
    return JSON.parse( JSON.stringify( g_arr_schains_cached ) );
}

export function set_last_cached_schains( arr_schains_cached ) {
    if( arr_schains_cached && typeof arr_schains_cached == "object" ) {
        g_arr_schains_cached = JSON.parse( JSON.stringify( arr_schains_cached ) );
        events.dispatchEvent(
            new UniversalDispatcherEvent(
                "chainsCacheChanged",
                { "detail": { "arr_schains_cached": get_last_cached_schains() } } ) );
    }
}

const impl_sleep = ( milliseconds ) => {
    return new Promise( resolve => setTimeout( resolve, milliseconds ) );
};

let g_worker = null;
let g_client = null;

export async function ensure_have_worker( opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    if( g_worker )
        return g_worker;
    const url = "skale_observer_worker_server";
    g_worker =
        new Worker(
            path.join( __dirname, "observer_worker.mjs" ),
            { "type": "module" }
        );
    g_worker.on( "message", jo => {
        if( network_layer.out_of_worker_apis.on_message( g_worker, jo ) )
            return;
    } );
    g_client = new network_layer.OutOfWorkerSocketClientPipe( url, g_worker );
    g_client.on( "message", function( eventData ) {
        const joMessage = eventData.message;
        switch ( joMessage.method ) {
        case "periodic_caching_do_now":
            set_last_cached_schains( joMessage.message );
            g_bHaveParallelResult = true;
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "Connected " ) + cc.attention( "S-Chains" ) +
                    cc.debug( " cache was updated using data arrived from SNB worker: " ) +
                    cc.j( g_arr_schains_cached ) + "\n" );
            }
            break;
        case "log":
            log.write( cc.attention( "SNB WORKER" ) + " " + joMessage.message );
            break;
        } // switch ( joMessage.method )
    } );
    await impl_sleep( 1000 );
    const jo = {
        "method": "init",
        "message": {
            "opts": {
                "imaState": {
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
                                // "address": owaspUtils.fn_address_impl_,
                                "strTransactionManagerURL":
                                    opts.imaState.chainProperties.mn
                                        .joAccount.strTransactionManagerURL,
                                "tm_priority":
                                    opts.imaState.chainProperties.mn
                                        .joAccount.tm_priority,
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
                            "cid": opts.imaState.chainProperties.mn.cid,
                            "joAbiIMA": opts.imaState.chainProperties.mn.joAbiIMA,
                            "bHaveAbiIMA": opts.imaState.chainProperties.mn.bHaveAbiIMA
                        },
                        "sc": {
                            "joAccount": {
                                "privateKey":
                                    opts.imaState.chainProperties.sc.joAccount.privateKey,
                                // "address": owaspUtils.fn_address_impl_,
                                "strTransactionManagerURL":
                                    opts.imaState.chainProperties.sc
                                        .joAccount.strTransactionManagerURL,
                                "tm_priority":
                                    opts.imaState.chainProperties.sc
                                        .joAccount.tm_priority,
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
                            "cid": opts.imaState.chainProperties.sc.cid,
                            "joAbiIMA": opts.imaState.chainProperties.sc.joAbiIMA,
                            "bHaveAbiIMA": opts.imaState.chainProperties.sc.bHaveAbiIMA
                        }
                        // "tc": {
                        //     "joAccount": {
                        //     }
                        // },
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
    g_client.send( jo );
}

async function in_thread_periodic_caching_start( strChainNameConnectedTo, addressFrom, opts ) {
    if( g_interval_periodic_caching != null )
        return;
    try {
        const fn_do_caching_now = async function() {
            await cache_schains( strChainNameConnectedTo, addressFrom, opts );
        };
        g_interval_periodic_caching =
            setInterval(
                fn_do_caching_now,
                parseInt( opts.secondsToReDiscoverSkaleNetwork ) * 1000 );
        await fn_do_caching_now();
        return true;
    } catch ( err ) {
        log.write(
            cc.error( "Failed to start in-thread periodic SNB refresh, error is: " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n" );
    }
    return false;
}

async function parallel_periodic_caching_start( strChainNameConnectedTo, addressFrom, opts ) {
    g_bHaveParallelResult = false;
    try {
        const nSecondsToWaitParallel = 60;
        setTimeout( function() {
            if( g_bHaveParallelResult )
                return;
            log.write(
                cc.error( "Failed to start parallel periodic SNB refresh, error is: " ) +
                cc.warning( "timeout of " ) + cc.info( nSecondsToWaitParallel ) +
                cc.warning( " reached, will restart periodic SNB refresh in non-parallel mode" ) +
                "\n" );
            periodic_caching_stop();
            in_thread_periodic_caching_start( strChainNameConnectedTo, addressFrom, opts );
        }, nSecondsToWaitParallel * 1000 );
        owaspUtils.ensure_observer_opts_initialized( opts );
        await ensure_have_worker( opts );
        const jo = {
            "method": "periodic_caching_start",
            "message": {
                "secondsToReDiscoverSkaleNetwork":
                    parseInt( opts.secondsToReDiscoverSkaleNetwork ),
                "strChainNameConnectedTo": strChainNameConnectedTo,
                "addressFrom": addressFrom
            }
        };
        g_client.send( jo );
        return true;
    } catch ( err ) {
        log.write(
            cc.error( "Failed to start parallel periodic SNB refresh, error is: " ) +
            cc.warning( owaspUtils.extract_error_message( err ) ) +
            cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
            "\n" );
    }
    return false;
}

export async function periodic_caching_start( strChainNameConnectedTo, addressFrom, opts ) {
    g_bHaveParallelResult = false;
    const bParallelMode =
        ( opts && "bParallelMode" in opts &&
        typeof opts.bParallelMode != "undefined" &&
        opts.bParallelMode )
            ? true : false;
    let wasStarted = false;
    if( bParallelMode ) {
        wasStarted =
            parallel_periodic_caching_start( strChainNameConnectedTo, addressFrom, opts );
    }
    if( wasStarted )
        return;
    in_thread_periodic_caching_start( strChainNameConnectedTo, addressFrom, opts );
}

export async function periodic_caching_stop() {
    if( g_worker && g_client ) {
        try {
            const jo = {
                "method": "periodic_caching_stop",
                "message": { }
            };
            g_client.send( jo );
        } catch ( err ) {
            log.write(
                cc.error( "Failed to stop parallel periodic SNB refresh, error is: " ) +
                cc.warning( owaspUtils.extract_error_message( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n" );
        }
    }
    if( g_interval_periodic_caching ) {
        try {
            clearInterval( g_interval_periodic_caching );
            g_interval_periodic_caching = null;
        } catch ( err ) {
            log.write(
                cc.error( "Failed to stop in-thread periodic SNB refresh, error is: " ) +
                cc.warning( owaspUtils.extract_error_message( err ) ) +
                cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) +
                "\n" );
            g_interval_periodic_caching = null; // clear it anyway
        }
    }
    g_bHaveParallelResult = false;
}

export function pick_random_schain_node_index( jo_schain ) {
    let min = 0, max = jo_schain.data.computed.nodes.length - 1;
    min = Math.ceil( min );
    max = Math.floor( max );
    const idxNode = Math.floor( Math.random() * ( max - min + 1 ) ) + min;
    return idxNode;
}
export function pick_random_schain_node( jo_schain ) {
    const idxNode = pick_random_schain_node_index( jo_schain );
    return jo_schain.data.computed.nodes[idxNode];
}

export function pick_random_schain_url( jo_schain ) {
    const jo_node = pick_random_schain_node( jo_schain );
    return "" + jo_node.http_endpoint_ip;
}

export async function discover_chain_id( strURL ) {
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
