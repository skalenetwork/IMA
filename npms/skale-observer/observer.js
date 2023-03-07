
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
 * @file observer.js
 * @copyright SKALE Labs 2019-Present
 */

const network_layer = require( "../skale-cool-socket/socket.js" );
const { Worker } = require( "worker_threads" );
const path = require( "path" );

const owaspUtils = require( "../skale-owasp/owasp-util.js" );
const cc = owaspUtils.cc;

const w3mod = require( "web3" );
// const ethereumjs_tx = require( "ethereumjs-tx" );
// const ethereumjs_wallet = require( "ethereumjs-wallet" );
// const ethereumjs_util = require( "ethereumjs-util" );

let g_interval_periodic_caching = null;
let g_bHaveParallelResult = false;

const PORTS_PER_SCHAIN = 64;

function getWeb3FromURL( strURL, log ) {
    let w3 = null;
    log = log || { write: console.log };
    try {
        const u = cc.safeURL( strURL );
        const strProtocol = u.protocol.trim().toLowerCase().replace( ":", "" ).replace( "/", "" );
        if( strProtocol == "ws" || strProtocol == "wss" ) {
            const w3ws = new w3mod.providers.WebsocketProvider( strURL, {
                // see: https://github.com/ChainSafe/web3.js/tree/1.x/packages/web3-providers-ws#usage
                clientConfig: {
                    // // if requests are large:
                    // maxReceivedFrameSize: 100000000,   // bytes - default: 1MiB
                    // maxReceivedMessageSize: 100000000, // bytes - default: 8MiB
                    // keep a connection alive
                    keepalive: true,
                    keepaliveInterval: 200000 // ms
                },
                reconnect: { // enable auto reconnection
                    auto: true,
                    delay: 5000, // ms
                    maxAttempts: 10000000, // 10 million times
                    onTimeout: false
                }
            } );
            w3 = new w3mod( w3ws );
        } else {
            const w3http = new w3mod.providers.HttpProvider( strURL );
            w3 = new w3mod( w3http );
        }
    } catch ( err ) {
        log.write( cc.fatal( "CRITICAL ERROR:" ) + cc.error( " Failed to create " ) +
            cc.attention( "Web3" ) + cc.error( " connection to " ) + cc.info( strURL ) +
            cc.error( ": " ) + cc.warning( owaspUtils.extract_error_message( err ) ) );
        w3 = null;
    }
    return w3;
}

function get_schain_index_in_node( schain_id, schains_ids_on_node ) {
    let i = 0;
    for( const schain_id_on_node of schains_ids_on_node ) {
        if( schain_id == schain_id_on_node )
            return i;
        ++ i;
    }
    throw new Error( "S-Chain " + schain_id + " is not found in the list: " + JSON.stringify( schains_ids_on_node ) );
}

function get_schain_base_port_on_node( schain_id, schains_ids_on_node, node_base_port ) {
    const schain_index = get_schain_index_in_node( schain_id, schains_ids_on_node );
    return calc_schain_base_port( node_base_port, schain_index );
}

function calc_schain_base_port( node_base_port, schain_index ) {
    return parseInt( node_base_port ) + parseInt( schain_index ) * PORTS_PER_SCHAIN;
}

function compose_endpoints( jo_schain, node_dict, endpoint_type ) {
    node_dict["http_endpoint_" + endpoint_type] = "http://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.httpRpcPort;
    node_dict["https_endpoint_" + endpoint_type] = "https://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.httpsRpcPort;
    node_dict["ws_endpoint_" + endpoint_type] = "ws://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.wsRpcPort;
    node_dict["wss_endpoint_" + endpoint_type] = "wss://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.wssRpcPort;
    node_dict["info_http_endpoint_" + endpoint_type] = "http://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.infoHttpRpcPort;
    node_dict["ima_agent_endpoint_" + endpoint_type] = "http://" + node_dict[endpoint_type] + ":" + jo_schain.data.computed.ports.imaAgentRpcPort;
}

const SkaledPorts = {
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

function calc_ports( jo_schain, schain_base_port ) {
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
async function load_schain_parts( w3, jo_schain, addressFrom, opts ) {
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chain parts in observer, no imaState is provided" );
    jo_schain.data.computed = {};
    const schain_id = w3.utils.soliditySha3( jo_schain.data.name );
    const chainId = owaspUtils.compute_chain_id_from_schain_name( w3, jo_schain.data.name );
    const node_ids = await opts.imaState.jo_schains_internal.methods.getNodesInGroup( schain_id ).call( { from: addressFrom } );
    const nodes = [];
    for( const node_id of node_ids ) {
        if( opts && opts.bStopNeeded )
            return;
        const node = await opts.imaState.jo_nodes.methods.nodes( node_id ).call( { from: addressFrom } );
        const node_dict = {
            id: node_id,
            name: node[0],
            ip: owaspUtils.ip_from_hex( node[1] ),
            base_port: node[3],
            domain: await opts.imaState.jo_nodes.methods.getNodeDomainName( node_id ).call( { from: addressFrom } ),
            isMaintenance: await opts.imaState.jo_nodes.methods.isNodeInMaintenance( node_id ).call( { from: addressFrom } )
        };
        if( opts && opts.bStopNeeded )
            return;
        const schain_ids = await opts.imaState.jo_schains_internal.methods.getSchainHashesForNode( node_id ).call( { from: addressFrom } );
        node_dict.schain_base_port = get_schain_base_port_on_node( schain_id, schain_ids, node_dict.base_port );
        calc_ports( jo_schain, node_dict.schain_base_port );
        compose_endpoints( jo_schain, node_dict, "ip" );
        compose_endpoints( jo_schain, node_dict, "domain" );
        nodes.push( node_dict );
        if( opts && opts.bStopNeeded )
            return;
    }
    // const schain = await opts.imaState.jo_schains_internal.methods.schains( schain_id ).call( { from: addressFrom } );
    // jo_schain.data.computed.schain = schain;
    jo_schain.data.computed.schain_id = schain_id;
    jo_schain.data.computed.chainId = chainId;
    jo_schain.data.computed.nodes = nodes;
}

async function get_schains_count( w3, addressFrom, opts ) {
    if( ! opts.imaState )
        throw new Error( "Cannot get S-Chains count, no imaState is provided" );
    const cntSChains = await opts.imaState.jo_schains_internal.methods.numberOfSchains().call( { from: addressFrom } );
    return cntSChains;
}

function remove_schain_desc_data_num_keys( jo_schain ) {
    const cnt = Object.keys( jo_schain ).length;
    for( let i = 0; i < cnt; ++ i ) {
        try {
            delete jo_schain[i];
        } catch ( err ) {
        }
    }
}

async function load_schain( w3, addressFrom, idxSChain, hash, cntSChains, opts ) {
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chain description in observer, no imaState is provided" );
    if( opts && opts.details )
        opts.details.write( cc.debug( "Loading S-Chain " ) + cc.notice( "#" ) + cc.info( idxSChain + 1 ) + cc.debug( " of " ) + cc.info( cntSChains ) + cc.debug( "..." ) + "\n" );
    hash = hash || await opts.imaState.jo_schains_internal.methods.schainsAtSystem( idxSChain ).call( { from: addressFrom } );
    if( opts && opts.details )
        opts.details.write( cc.debug( "    Hash " ) + cc.attention( hash ) + "\n" );
    if( opts && opts.bStopNeeded )
        return null;
    let jo_data = await opts.imaState.jo_schains_internal.methods.schains( hash ).call( { from: addressFrom } );
    jo_data = JSON.parse( JSON.stringify( jo_data ) );
    const jo_schain = { data: jo_data };
    remove_schain_desc_data_num_keys( jo_schain.data, addressFrom );
    if( opts && opts.bStopNeeded )
        return null;
    await load_schain_parts( w3, jo_schain, addressFrom, opts );
    if( opts && opts.details ) {
        opts.details.write( cc.debug( "    Desc " ) + cc.j( jo_schain.data ) + "\n" );
        opts.details.write( cc.success( "Done" ) + "\n" );
    }
    jo_schain.isConnected = false;
    return jo_schain;
}

async function load_schains( w3, addressFrom, opts ) {
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains in observer, no imaState is provided" );
    const cntSChains = await get_schains_count( w3, addressFrom, opts );
    if( opts && opts.details )
        opts.details.write( cc.debug( "Have " ) + cc.info( cntSChains ) + cc.debug( " S-Chain(s) to load..." ) + "\n" );
    const arr_schains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const jo_schain = await load_schain( w3, addressFrom, idxSChain, null, cntSChains, opts );
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

async function load_cached_schains_simplified( w3, addressFrom, opts ) {
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains in observer, no imaState is provided" );
    if( opts && opts.details )
        opts.details.write( cc.debug( "Will request all S-Chain(s) hashes..." ) + "\n" );
    const arrSChainHashes = await opts.imaState.jo_schains_internal.methods.getSchains().call( { from: addressFrom } );
    const cntSChains = arrSChainHashes.length;
    if( opts && opts.details )
        opts.details.write( cc.debug( "Have all " ) + cc.info( cntSChains ) + cc.debug( " S-Chain(s) hashes: " ) + cc.j( arrSChainHashes ) + "\n" );
    const arr_schains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const strSChainHash = arrSChainHashes[idxSChain];
        const strSChainName = await opts.imaState.jo_schains_internal.methods.getSchainName( strSChainHash ).call( { from: addressFrom } );
        if( opts && opts.details )
            opts.details.write( cc.debug( "S-Chain " ) + cc.notice( idxSChain ) + cc.debug( " hash " ) + cc.notice( strSChainHash ) + cc.debug( " corresponds to S-Chain name " ) + cc.notice( strSChainName ) + "\n" );
        if( opts && opts.bStopNeeded )
            break;
        const jo_schain = await load_schain( w3, addressFrom, idxSChain, strSChainHash, cntSChains, opts );
        if( ! jo_schain )
            break;
        arr_schains.push( jo_schain );
    }
    return arr_schains;
}

async function load_schains_connected_only( w3_main_net, w3_s_chain, strChainNameConnectedTo, addressFrom, opts ) {
    if( ! opts.imaState )
        throw new Error( "Cannot load S-Chains in observer, no imaState is provided" );
    if( opts && opts.details )
        opts.details.write( cc.debug( "Will request all S-Chain(s) hashes..." ) + "\n" );
    const arrSChainHashes = await opts.imaState.jo_schains_internal.methods.getSchains().call( { from: addressFrom } );
    const cntSChains = arrSChainHashes.length;
    if( opts && opts.details )
        opts.details.write( cc.debug( "Have all " ) + cc.info( cntSChains ) + cc.debug( " S-Chain(s) hashes: " ) + cc.j( arrSChainHashes ) + "\n" );
    const jo_message_proxy_s_chain =
        new w3_s_chain.eth.Contract(
            opts.imaState.joAbiPublishResult_s_chain.message_proxy_chain_abi,
            opts.imaState.joAbiPublishResult_s_chain.message_proxy_chain_address
        );
    const arr_schains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        try {
            if( opts && opts.bStopNeeded )
                break;
            const strSChainHash = arrSChainHashes[idxSChain];
            const strSChainName = await opts.imaState.jo_schains_internal.methods.getSchainName( strSChainHash ).call( { from: addressFrom } );
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
            const isConnected = await jo_message_proxy_s_chain.methods.isConnectedChain( strSChainName ).call( { from: addressFrom } );
            if( opts && opts.details )
                opts.details.write( cc.debug( "Got S-Chain " ) + cc.info( strSChainName ) + cc.debug( " connected status: " ) + cc.yn( isConnected ) + "\n" );
            if( ! isConnected )
                continue;
            const jo_schain = await load_schain( w3_main_net, addressFrom, idxSChain, strSChainHash, cntSChains, opts );
            if( ! jo_schain )
                break;
            jo_schain.isConnected = true;
            arr_schains.push( jo_schain );
        } catch ( err ) {
            if( opts && opts.details )
                opts.details.write( cc.error( "Got error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n" );
        }
    }
    return arr_schains;
}

async function check_connected_schains( strChainNameConnectedTo, arr_schains, addressFrom, opts ) {
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
            const url = pick_random_schain_w3_url( jo_schain );
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "Querying via URL " ) + cc.u( url ) + cc.debug( " to S-Chain " ) +
                    cc.info( jo_schain.data.name ) + cc.debug( " whether it's connected to S-Chain " ) +
                    cc.info( strChainNameConnectedTo ) + cc.debug( "..." ) + "\n" );
            }
            const w3 = getWeb3FromURL( url, opts.details );
            const jo_message_proxy_s_chain = new w3.eth.Contract( opts.imaState.joAbiPublishResult_s_chain.message_proxy_chain_abi, opts.imaState.joAbiPublishResult_s_chain.message_proxy_chain_address );
            jo_schain.isConnected = await jo_message_proxy_s_chain.methods.isConnectedChain( strChainNameConnectedTo ).call( { from: addressFrom } );
            if( opts && opts.details ) {
                opts.details.write(
                    cc.debug( "Got " ) + cc.yn( jo_schain.isConnected ) + "\n" );
            }
        } catch ( err ) {
            if( opts && opts.details )
                opts.details.write( cc.error( "Got error: " ) + cc.warning( owaspUtils.extract_error_message( err ) ) + "\n" );
        }
    }
    return arr_schains;
}

async function filter_schains_marked_as_connected( arr_schains, opts ) {
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

function find_schain_index_in_array_by_name( arr_schains, strSChainName ) {
    for( let idxSChain = 0; idxSChain < arr_schains.length; ++ idxSChain ) {
        const jo_schain = arr_schains[idxSChain];
        if( jo_schain.data.name.toString() == strSChainName.toString() )
            return idxSChain;
    }
    return -1;
}

function merge_schains_array_from_to( arrSrc, arrDst, arrNew, arrOld, opts ) {
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

async function cache_schains( strChainNameConnectedTo, w3_main_net, w3_s_chain, addressFrom, opts ) {
    let strError = null;
    try {
        let arr_schains = [];
        if( strChainNameConnectedTo && ( typeof strChainNameConnectedTo == "string" ) && strChainNameConnectedTo.length > 0 ) {
            arr_schains = await load_schains_connected_only(
                w3_main_net,
                w3_s_chain,
                strChainNameConnectedTo,
                addressFrom,
                opts
            );
        } else
            arr_schains = await load_schains( w3_main_net, addressFrom, opts );

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
        if( opts && opts.details )
            opts.details.write( cc.fatal( "ERROR:" ) + cc.error( " Failed to cache: " ) + cc.error( err ) + "\n" );

    }
    return strError; // null on success
}

function get_last_cached_schains() {
    return JSON.parse( JSON.stringify( g_arr_schains_cached ) );
}

const impl_sleep = ( milliseconds ) => { return new Promise( resolve => setTimeout( resolve, milliseconds ) ); };

let g_worker = null;
let g_client = null;

async function ensure_have_worker( opts ) {
    if( g_worker )
        return g_worker;
    const url = "skale_observer_worker_server";
    g_worker = new Worker( path.join( __dirname, "observer_worker.js" ) );
    // console.log( "Will connect to " + url );
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
            g_arr_schains_cached = joMessage.message;
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
        method: "init",
        message: {
            opts: {
                imaState: {
                    "joAbiPublishResult_skale_manager": opts.imaState.joAbiPublishResult_skale_manager,
                    "joAbiPublishResult_main_net": opts.imaState.joAbiPublishResult_main_net,
                    "joAbiPublishResult_s_chain": opts.imaState.joAbiPublishResult_s_chain,
                    "bHaveSkaleManagerABI": opts.imaState.bHaveSkaleManagerABI,
                    "bHaveImaAbiMainNet": opts.imaState.bHaveImaAbiMainNet,
                    "bNoWaitSChainStarted": opts.imaState.bNoWaitSChainStarted,
                    "nMaxWaitSChainAttempts": opts.imaState.nMaxWaitSChainAttempts,
                    "strURL_main_net": opts.imaState.strURL_main_net,
                    "strChainName_main_net": opts.imaState.strChainName_main_net,
                    "cid_main_net": opts.imaState.cid_main_net,
                    "strURL_s_chain": opts.imaState.strURL_s_chain,
                    "strChainName_s_chain": opts.imaState.strChainName_s_chain,
                    "cid_s_chain": opts.imaState.cid_s_chain,
                    "nNodeNumber": opts.imaState.nNodeNumber, // S-Chain node number(zero based)
                    "nNodesCount": opts.imaState.nNodesCount,
                    "nTimeFrameSeconds": opts.imaState.nTimeFrameSeconds, // 0-disable, 60-recommended
                    "nNextFrameGap": opts.imaState.nNextFrameGap,
                    "joAccount_main_net": {
                        "privateKey": opts.imaState.joAccount_main_net.privateKey,
                        // "address": IMA.owaspUtils.fn_address_impl_,
                        "strTransactionManagerURL": opts.imaState.joAccount_main_net.strTransactionManagerURL,
                        "tm_priority": opts.imaState.joAccount_main_net.tm_priority,
                        "strSgxURL": opts.imaState.joAccount_main_net.strSgxURL,
                        "strSgxKeyName": opts.imaState.joAccount_main_net.strSgxKeyName,
                        "strPathSslKey": opts.imaState.joAccount_main_net.strPathSslKey,
                        "strPathSslCert": opts.imaState.joAccount_main_net.strPathSslCert,
                        "strBlsKeyName": opts.imaState.joAccount_main_net.strBlsKeyName
                    },
                    "joAccount_s_chain": {
                        "privateKey": opts.imaState.joAccount_s_chain.privateKey,
                        // "address": IMA.owaspUtils.fn_address_impl_,
                        "strTransactionManagerURL": opts.imaState.joAccount_s_chain.strTransactionManagerURL,
                        "tm_priority": opts.imaState.joAccount_s_chain.tm_priority,
                        "strSgxURL": opts.imaState.joAccount_s_chain.strSgxURL,
                        "strSgxKeyName": opts.imaState.joAccount_s_chain.strSgxKeyName,
                        "strPathSslKey": opts.imaState.joAccount_s_chain.strPathSslKey,
                        "strPathSslCert": opts.imaState.joAccount_s_chain.strPathSslCert,
                        "strBlsKeyName": opts.imaState.joAccount_s_chain.strBlsKeyName
                    },
                    // "tc_main_net": IMA.tc_main_net,
                    // "tc_s_chain": IMA.tc_s_chain,
                    // "doEnableDryRun": function( isEnable ) { return IMA.dry_run_enable( isEnable ); },
                    // "doIgnoreDryRun": function( isIgnore ) { return IMA.dry_run_ignore( isIgnore ); },
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

async function in_thread_periodic_caching_start( strChainNameConnectedTo, w3_main_net, w3_s_chain, addressFrom, opts ) {
    if( g_interval_periodic_caching != null )
        return;
    try {
        const fn_do_caching_now = async function() {
            await cache_schains( strChainNameConnectedTo, w3_main_net, w3_s_chain, addressFrom, opts );
        };
        g_interval_periodic_caching = setInterval( fn_do_caching_now, parseInt( opts.secondsToReDiscoverSkaleNetwork ) * 1000 );
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

async function parallel_periodic_caching_start( strChainNameConnectedTo, w3_main_net, w3_s_chain, addressFrom, opts ) {
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
            in_thread_periodic_caching_start( strChainNameConnectedTo, w3_main_net, w3_s_chain, addressFrom, opts );
        }, nSecondsToWaitParallel * 1000 );
        await ensure_have_worker( opts );
        const jo = {
            method: "periodic_caching_start",
            message: {
                secondsToReDiscoverSkaleNetwork: parseInt( opts.secondsToReDiscoverSkaleNetwork ),
                strChainNameConnectedTo: strChainNameConnectedTo,
                addressFrom: addressFrom
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

async function periodic_caching_start( strChainNameConnectedTo, w3_main_net, w3_s_chain, addressFrom, opts ) {
    g_bHaveParallelResult = false;
    const bParallelMode = ( opts && "bParallelMode" in opts && typeof opts.bParallelMode != "undefined" && opts.bParallelMode ) ? true : false;
    let wasStarted = false;
    if( bParallelMode )
        wasStarted = parallel_periodic_caching_start( strChainNameConnectedTo, w3_main_net, w3_s_chain, addressFrom, opts );
    if( wasStarted )
        return;
    in_thread_periodic_caching_start( strChainNameConnectedTo, w3_main_net, w3_s_chain, addressFrom, opts );
}

async function periodic_caching_stop() {
    if( g_worker && g_client ) {
        const jo = {
            method: "periodic_caching_stop",
            message: { }
        };
        g_client.send( jo );
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

function pick_random_schain_node_index( jo_schain ) {
    let min = 0, max = jo_schain.data.computed.nodes.length - 1;
    min = Math.ceil( min );
    max = Math.floor( max );
    const idxNode = Math.floor( Math.random() * ( max - min + 1 ) ) + min;
    return idxNode;
}
function pick_random_schain_node( jo_schain ) {
    const idxNode = pick_random_schain_node_index( jo_schain );
    return jo_schain.data.computed.nodes[idxNode];
}

function pick_random_schain_w3_url( jo_schain ) {
    const jo_node = pick_random_schain_node( jo_schain );
    return "" + jo_node.http_endpoint_ip;
}

async function discover_chain_id( strURL ) {
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

module.exports.w3mod = w3mod;
module.exports.getWeb3FromURL = getWeb3FromURL;
module.exports.owaspUtils = owaspUtils;
module.exports.cc = cc;
module.exports.get_schains_count = get_schains_count;
module.exports.load_schain = load_schain;
module.exports.load_schains = load_schains;
module.exports.load_cached_schains_simplified = load_cached_schains_simplified;
module.exports.load_schains_connected_only = load_schains_connected_only;
module.exports.check_connected_schains = check_connected_schains;
module.exports.filter_schains_marked_as_connected = filter_schains_marked_as_connected;
module.exports.find_schain_index_in_array_by_name = find_schain_index_in_array_by_name;
module.exports.merge_schains_array_from_to = merge_schains_array_from_to;
module.exports.cache_schains = cache_schains;
module.exports.get_last_cached_schains = get_last_cached_schains;
module.exports.periodic_caching_start = periodic_caching_start;
module.exports.periodic_caching_stop = periodic_caching_stop;
module.exports.pick_random_schain_node_index = pick_random_schain_node_index;
module.exports.pick_random_schain_node = pick_random_schain_node;
module.exports.pick_random_schain_w3_url = pick_random_schain_w3_url;
module.exports.discover_chain_id = discover_chain_id;
