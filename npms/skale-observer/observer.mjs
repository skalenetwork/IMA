
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

import { UniversalDispatcherEvent, EventDispatcher } from "../skale-cool-socket/event_dispatcher.mjs";

const __dirname = path.dirname( url.fileURLToPath( import.meta.url ) );

const PORTS_PER_SCHAIN = 64;

export const events = new EventDispatcher();

export function get_schain_index_in_node( schain_id, schains_ids_on_node ) {
    let i = 0;
    for( const schain_id_on_node of schains_ids_on_node ) {
        if( schain_id == schain_id_on_node )
            return i;
        ++ i;
    }
    throw new Error( "S-Chain " + schain_id + " is not found in the list: " + JSON.stringify( schains_ids_on_node ) );
}

export function get_schain_base_port_on_node( schain_id, schains_ids_on_node, node_base_port ) {
    const schain_index = get_schain_index_in_node( schain_id, schains_ids_on_node );
    return calc_schain_base_port( node_base_port, schain_index );
}

export function calc_schain_base_port( node_base_port, schain_index ) {
    return parseInt( node_base_port ) + parseInt( schain_index ) * PORTS_PER_SCHAIN;
}

export function compose_endpoints( jo_schain, node_dict, endpoint_type ) {
    node_dict["http_endpoint_" + endpoint_type] = "http://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.httpRpcPort;
    node_dict["https_endpoint_" + endpoint_type] = "https://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.httpsRpcPort;
    node_dict["ws_endpoint_" + endpoint_type] = "ws://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.wsRpcPort;
    node_dict["wss_endpoint_" + endpoint_type] = "wss://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.wssRpcPort;
    node_dict["info_http_endpoint_" + endpoint_type] = "http://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.infoHttpRpcPort;
    node_dict["ima_agent_endpoint_" + endpoint_type] = "http://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.imaAgentRpcPort;
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

// see https://github.com/skalenetwork/skale-proxy/blob/develop/endpoints.py
export async function load_schain_parts( jo_schain, addressFrom, opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chain parts in observer, no imaState is provided" );
    jo_schain.data.computed = {};
    const schain_id = owaspUtils.ethersMod.ethers.utils.id( jo_schain.data.name );
    const chainId = owaspUtils.compute_chain_id_from_schain_name( jo_schain.data.name );
    const node_ids = await opts.imaState.jo_schains_internal.callStatic.getNodesInGroup( schain_id, { from: addressFrom } );
    const nodes = [];
    for( const node_id of node_ids ) {
        if( opts && opts.bStopNeeded )
            return;
        const node = await opts.imaState.jo_nodes.callStatic.nodes( node_id, { from: addressFrom } );
        const node_dict = {
            "id": node_id,
            "name": node[0],
            "ip": owaspUtils.ip_from_hex( node[1] ),
            "base_port": node[3],
            "domain": await opts.imaState.jo_nodes.callStatic.getNodeDomainName( node_id, { from: addressFrom } ),
            "isMaintenance": await opts.imaState.jo_nodes.callStatic.isNodeInMaintenance( node_id, { from: addressFrom } )
        };
        if( opts && opts.bStopNeeded )
            return;
        // const schain_ids = await opts.imaState.jo_schains_internal.callStatic.getSchainIdsForNode( node_id, { from: addressFrom } );
        const schain_ids = await opts.imaState.jo_schains_internal.callStatic.getSchainHashesForNode( node_id, { from: addressFrom } );
        node_dict.schain_base_port = get_schain_base_port_on_node( schain_id, schain_ids, node_dict.base_port );
        calc_ports( jo_schain, node_dict.schain_base_port );
        compose_endpoints( jo_schain, node_dict, "ip" );
        compose_endpoints( jo_schain, node_dict, "domain" );
        nodes.push( node_dict );
        if( opts && opts.bStopNeeded )
            return;
    }
    // const schain = await opts.imaState.jo_schains_internal.callStatic.schains( schain_id, { from: addressFrom } );
    // jo_schain.data.computed.schain = schain;
    jo_schain.data.computed.schain_id = schain_id;
    jo_schain.data.computed.chainId = chainId;
    jo_schain.data.computed.nodes = nodes;
}

export async function get_schains_count( addressFrom, opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    if( ! opts.imaState )
        throw new Error( "Cannot get S-Chains count, no imaState is provided" );
    const cntSChains = await opts.imaState.jo_schains_internal.callStatic.numberOfSchains( { from: addressFrom } );
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
    if( opts && opts.details )
        opts.details.write( cc.debug( "Loading S-Chain " ) + cc.notice( "#" ) + cc.info( idxSChain + 1 ) + cc.debug( " of " ) + cc.info( cntSChains ) + cc.debug( "..." ) + "\n" );
    hash = hash || await opts.imaState.jo_schains_internal.callStatic.schainsAtSystem( idxSChain, { from: addressFrom } );
    if( opts && opts.details )
        opts.details.write( cc.debug( "    Hash " ) + cc.attention( hash ) + "\n" );
    if( opts && opts.bStopNeeded )
        return null;
    let jo_data = await opts.imaState.jo_schains_internal.callStatic.schains( hash, { from: addressFrom } );
    jo_data = owaspUtils.clone_object_by_root_keys( jo_data ); // jo_data = JSON.parse( JSON.stringify( jo_data ) );
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
    if( opts && opts.details )
        opts.details.write( cc.debug( "Have " ) + cc.info( cntSChains ) + cc.debug( " S-Chain(s) to load..." ) + "\n" );
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
    const arrSChainHashes = await opts.imaState.jo_schains_internal.callStatic.getSchains( { from: addressFrom } );
    const cntSChains = arrSChainHashes.length;
    if( opts && opts.details )
        opts.details.write( cc.debug( "Have all " ) + cc.info( cntSChains ) + cc.debug( " S-Chain(s) hashes: " ) + cc.j( arrSChainHashes ) + "\n" );
    const arr_schains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const strSChainHash = arrSChainHashes[idxSChain];
        const strSChainName = await opts.imaState.jo_schains_internal.callStatic.getSchainName( strSChainHash, { from: addressFrom } );
        if( opts && opts.details )
            opts.details.write( cc.debug( "S-Chain " ) + cc.notice( idxSChain ) + cc.debug( " hash " ) + cc.notice( strSChainHash ) + cc.debug( " corresponds to S-Chain name " ) + cc.notice( strSChainName ) + "\n" );
        if( opts && opts.bStopNeeded )
            break;
        const jo_schain = await load_schain( addressFrom, idxSChain, strSChainHash, cntSChains, opts );
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
    const arrSChainHashes = await opts.imaState.jo_schains_internal.callStatic.getSchains( { from: addressFrom } );
    const cntSChains = arrSChainHashes.length;
    if( opts && opts.details )
        opts.details.write( cc.debug( "Have all " ) + cc.info( cntSChains ) + cc.debug( " S-Chain(s) hashes: " ) + cc.j( arrSChainHashes ) + "\n" );
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
            const strSChainName = await opts.imaState.jo_schains_internal.callStatic.getSchainName( strSChainHash, { from: addressFrom } );
            if( opts && opts.details )
                opts.details.write( cc.debug( "S-Chain " ) + cc.notice( idxSChain ) + cc.debug( " hash " ) + cc.notice( strSChainHash ) + cc.debug( " corresponds to S-Chain name " ) + cc.notice( strSChainName ) + "\n" );
            if( opts && opts.bStopNeeded )
                break;
            //
            if( strChainNameConnectedTo == strSChainName ) {
                if( opts && opts.details )
                    opts.details.write( cc.debug( "Skip this S-Chain " ) + cc.info( strSChainName ) + cc.debug( " connected status check" ) + "\n" );
                continue;
            }
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "Querying connected status between S-Chain " ) + cc.info( strSChainName ) + cc.debug( " and S-Chain " ) +
                    cc.info( strChainNameConnectedTo ) + cc.debug( "..." ) + "\n" );
            }
            const isConnected = await jo_message_proxy_s_chain.callStatic.isConnectedChain( strSChainName, { from: addressFrom } );
            if( opts && opts.details )
                opts.details.write( cc.debug( "Got S-Chain " ) + cc.info( strSChainName ) + cc.debug( " connected status: " ) + cc.yn( isConnected ) + "\n" );
            if( ! isConnected )
                continue;
            const jo_schain = await load_schain( addressFrom, idxSChain, strSChainHash, cntSChains, opts );
            if( ! jo_schain )
                break;
            jo_schain.isConnected = true;
            arr_schains.push( jo_schain );
        } catch ( err ) {
            if( opts && opts.details )
                opts.details.write( cc.error( "Got error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
        }
    }
    return arr_schains;
}

export async function check_connected_schains( strChainNameConnectedTo, arr_schains, addressFrom, opts ) {
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
                    cc.debug( "Querying via URL " ) + cc.u( url ) + cc.debug( " to S-Chain " ) +
                    cc.info( jo_schain.data.name ) + cc.debug( " whether it's connected to S-Chain " ) +
                    cc.info( strChainNameConnectedTo ) + cc.debug( "..." ) + "\n" );
            }
            const ethersProvider = owaspUtils.getEthersProviderFromURL( url );
            const jo_message_proxy_s_chain =
                new owaspUtils.ethersMod.ethers.Contract(
                    opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_address,
                    opts.imaState.chainProperties.sc.joAbiIMA.message_proxy_chain_abi,
                    ethersProvider
                );
            jo_schain.isConnected = await jo_message_proxy_s_chain.callStatic.isConnectedChain( strChainNameConnectedTo, { from: addressFrom } );
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "Got " ) + cc.yn( jo_schain.isConnected ) + "\n" );
            }
        } catch ( err ) {
            if( opts && opts.details )
                opts.details.write( cc.error( "Got error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + cc.error( ", stack is: " ) + "\n" + cc.stack( err.stack ) + "\n" );
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
    if( opts && opts.details )
        opts.details.write( cc.debug( "Before merging, have " ) + cc.info( cnt ) + cc.debug( " S-Chain(s) to review" ) + "\n" );
    for( i = 0; i < cnt; ++ i ) {
        const jo_schain = arrSrc[i];
        j = find_schain_index_in_array_by_name( arrDst, jo_schain.data.name );
        if( j < 0 ) {
            if( opts && opts.details )
                opts.details.write( cc.debug( "Found new " ) + cc.notice( "#" ) + cc.info( i + 1 ) + cc.debug( " S-Chain " ) + cc.j( jo_schain ) + "\n" );
            arrNew.push( jo_schain );
        }
    }
    if( opts && opts.details )
        opts.details.write( cc.debug( "Summary, found new " ) + cc.info( arrNew.length ) + cc.debug( " S-Chain(s)" ) + "\n" );
    cnt = arrDst.length;
    for( i = 0; i < cnt; ++ i ) {
        const jo_schain = arrDst[i];
        j = find_schain_index_in_array_by_name( arrSrc, jo_schain.data.name );
        if( j < 0 ) {
            if( opts && opts.details )
                opts.details.write( cc.debug( "Found old S-Chain " ) + cc.notice( "#" ) + cc.info( i + 1 ) + cc.debug( " " ) + cc.j( jo_schain ) + "\n" );
            arrOld.push( jo_schain );
        }
    }
    if( opts && opts.details )
        opts.details.write( cc.debug( "Summary, found old " ) + cc.info( arrOld.length ) + cc.debug( " S-Chain(s)" ) + "\n" );
    if( arrNew.length > 0 ) {
        if( opts && opts.details )
            opts.details.write( cc.debug( "Merging new " ) + cc.info( arrNew.length ) + cc.debug( " S-Chain(s)" ) + "\n" );
        for( i = 0; i < arrNew.length; ++ i ) {
            const jo_schain = arrNew[i];
            arrDst.push( jo_schain );
        }
        if( opts && opts.details )
            opts.details.write( cc.success( "Done" ) + "\n" );
    }
    if( arrOld.length > 0 ) {
        if( opts && opts.details )
            opts.details.write( cc.debug( "Removing old " ) + cc.info( arrOld.length ) + cc.debug( " S-Chain(s)" ) + "\n" );
        for( i = 0; i < arrOld.length; ++ i ) {
            const jo_schain = arrOld[i];
            j = find_schain_index_in_array_by_name( arrDst, jo_schain.data.name );
            arrDst.splice( j, 1 );
        }
        if( opts && opts.details )
            opts.details.write( cc.success( "Done" ) + "\n" );
    }
    if( opts && opts.details )
        opts.details.write( cc.success( "Finally, have " ) + cc.info( arrDst.length ) + cc.success( " S-Chain(s)" ) + "\n" );
}

let g_arr_schains_cached = [];

export async function cache_schains( strChainNameConnectedTo, addressFrom, opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    let strError = null;
    try {
        const arr_schains = await load_schains( addressFrom, opts );
        if( strChainNameConnectedTo && ( typeof strChainNameConnectedTo == "string" ) && strChainNameConnectedTo.length > 0 ) {
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
                cc.debug( "Connected " ) + cc.attention( "S-Chains" ) + cc.debug( " cache was updated in this thread: " ) +
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
            opts.details.write( cc.fatal( "ERROR:" ) + cc.error( " Failed to cache: " ) + cc.error( err ) );
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
        events.dispatchEvent( new UniversalDispatcherEvent( "chainsCacheChanged", { detail: { arr_schains_cached: get_last_cached_schains() } } ) );
    }
}

const impl_sleep = ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

let g_worker = null;
let g_client = null;

export async function ensure_have_worker( opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    if( g_worker )
        return g_worker;
    const url = "skale_observer_worker_server";
    g_worker = new Worker( path.join( __dirname, "observer_worker.mjs" ), { "type": "module" } );
    // if( opts && opts.details )
    //     opts.details.write( cc.debug( "Will connect to " ) + cc.info( url ) + "/n" );
    g_worker.on( "message", jo => {
        if( network_layer.out_of_worker_apis.on_message( g_worker, jo ) )
            return;
    } );
    g_client = new network_layer.OutOfWorkerSocketClientPipe( url, g_worker );
    g_client.on( "message", function( eventData ) {
        const joMessage = eventData.message;
        // console.log( "CLIENT <<<", JSON.stringify( joMessage ) );
        switch ( joMessage.method ) {
        case "periodic_caching_do_now":
            set_last_cached_schains( joMessage.message );
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
                    "nNodeNumber": opts.imaState.nNodeNumber, // S-Chain node number(zero based)
                    "nNodesCount": opts.imaState.nNodesCount,
                    "nTimeFrameSeconds": opts.imaState.nTimeFrameSeconds, // 0-disable, 60-recommended
                    "nNextFrameGap": opts.imaState.nNextFrameGap,
                    "chainProperties": {
                        "mn": {
                            "joAccount": {
                                "privateKey": opts.imaState.chainProperties.mn.joAccount.privateKey,
                                // "address": owaspUtils.fn_address_impl_,
                                "strTransactionManagerURL": opts.imaState.chainProperties.mn.joAccount.strTransactionManagerURL,
                                "tm_priority": opts.imaState.chainProperties.mn.joAccount.tm_priority,
                                "strSgxURL": opts.imaState.chainProperties.mn.joAccount.strSgxURL,
                                "strSgxKeyName": opts.imaState.chainProperties.mn.joAccount.strSgxKeyName,
                                "strPathSslKey": opts.imaState.chainProperties.mn.joAccount.strPathSslKey,
                                "strPathSslCert": opts.imaState.chainProperties.mn.joAccount.strPathSslCert,
                                "strBlsKeyName": opts.imaState.chainProperties.mn.joAccount.strBlsKeyName
                            },
                            "strURL": opts.imaState.chainProperties.mn.strURL,
                            "strChainName": opts.imaState.chainProperties.mn.strChainName,
                            "cid": opts.imaState.chainProperties.mn.cid,
                            "joAbiIMA": opts.imaState.chainProperties.mn.joAbiIMA,
                            "bHaveAbiIMA": opts.imaState.chainProperties.mn.bHaveAbiIMA
                        },
                        "sc": {
                            "joAccount": {
                                "privateKey": opts.imaState.chainProperties.sc.joAccount.privateKey,
                                // "address": owaspUtils.fn_address_impl_,
                                "strTransactionManagerURL": opts.imaState.chainProperties.sc.joAccount.strTransactionManagerURL,
                                "tm_priority": opts.imaState.chainProperties.sc.joAccount.tm_priority,
                                "strSgxURL": opts.imaState.chainProperties.sc.joAccount.strSgxURL,
                                "strSgxKeyName": opts.imaState.chainProperties.sc.joAccount.strSgxKeyName,
                                "strPathSslKey": opts.imaState.chainProperties.sc.joAccount.strPathSslKey,
                                "strPathSslCert": opts.imaState.chainProperties.sc.joAccount.strPathSslCert,
                                "strBlsKeyName": opts.imaState.chainProperties.sc.joAccount.strBlsKeyName
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
                        "isSilentReDiscovery": opts.imaState.joSChainDiscovery.isSilentReDiscovery,
                        "repeatIntervalMilliseconds": opts.imaState.joSChainDiscovery.repeatIntervalMilliseconds // zero to disable (for debugging only)
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

export async function periodic_caching_start( strChainNameConnectedTo, addressFrom, opts ) {
    owaspUtils.ensure_observer_opts_initialized( opts );
    await ensure_have_worker( opts );
    const jo = {
        "method": "periodic_caching_start",
        "message": {
            "secondsToReDiscoverSkaleNetwork": parseInt( opts.secondsToReDiscoverSkaleNetwork ),
            "strChainNameConnectedTo": strChainNameConnectedTo,
            "addressFrom": addressFrom
        }
    };
    g_client.send( jo );
}
export async function periodic_caching_stop() {
    await ensure_have_worker( opts );
    const jo = {
        "method": "periodic_caching_stop",
        "message": {
        }
    };
    g_client.send( jo );
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
            //ret = "Failed to create RPC (" + strURL + ") call: " + owaspUtils.extract_error_message( err );
            if( joCall )
                await joCall.disconnect();
            return;
        }
        await joCall.call( {
            "method": "eth_chainId",
            "params": []
        }, async function( joIn, joOut, err ) {
            if( err ) {
                //ret = "Failed to query RPC (" + strURL + ") for chain ID: " + owaspUtils.extract_error_message( err );
                await joCall.disconnect();
                return;
            }
            if( ! ( "result" in joOut && joOut.result ) ) {
                //ret = "Failed to query RPC (" + strURL + ") for chain ID, got bad result: " + JSON.stringify( joOut );
                await joCall.disconnect();
                return;
            }
            ret = joOut.result;
            await joCall.disconnect();
        } ); // joCall.call ...
    } ); // rpcCall.create ...
    return ret;
}
