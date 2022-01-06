
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

const owaspUtils = require( "../skale-owasp/owasp-util.js" );
const cc = owaspUtils.cc;

const PORTS_PER_SCHAIN = 64;

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
    INFO_HTTP_JSON: 9
};

function calc_ports( jo_schain, schain_base_port ) {
    jo_schain.data.computed.ports = {
        httpRpcPort: schain_base_port + SkaledPorts.HTTP_JSON,
        httpsRpcPort: schain_base_port + SkaledPorts.HTTPS_JSON,
        wsRpcPort: schain_base_port + SkaledPorts.WS_JSON,
        wssRpcPort: schain_base_port + SkaledPorts.WSS_JSON,
        infoHttpRpcPort: schain_base_port + SkaledPorts.INFO_HTTP_JSON
    };
}

// see https://github.com/skalenetwork/skale-proxy/blob/develop/endpoints.py
async function load_schain_parts( w3, jo_schain, addressFrom, opts ) {
    const jo_schains_internal = opts ? opts.jo_schains_internal : null;
    if( ! jo_schains_internal )
        throw new Error( "Cannot load S-Chain parts in observer, no SChainsInternal contract is provided" );
    const jo_nodes = opts ? opts.jo_nodes : null;
    if( ! jo_nodes )
        throw new Error( "Cannot load S-Chain parts in observer, no Nodes contract is provided" );
    jo_schain.data.computed = {};
    const schain_id = w3.utils.soliditySha3( jo_schain.data.name );
    const node_ids = await jo_schains_internal.methods.getNodesInGroup( schain_id ).call( { from: addressFrom } );
    const nodes = [];
    for( const node_id of node_ids ) {
        if( opts && opts.bStopNeeded )
            return;
        const node = await jo_nodes.methods.nodes( node_id ).call( { from: addressFrom } );
        const node_dict = {
            id: node_id,
            name: node[0],
            ip: owaspUtils.ip_from_hex( node[1] ),
            base_port: node[3],
            domain: await jo_nodes.methods.getNodeDomainName( node_id ).call( { from: addressFrom } ),
            isMaintenance: await jo_nodes.methods.isNodeInMaintenance( node_id ).call( { from: addressFrom } )
        };
        if( opts && opts.bStopNeeded )
            return;
        const schain_ids = await jo_schains_internal.methods.getSchainIdsForNode( node_id ).call( { from: addressFrom } );
        node_dict.schain_base_port = get_schain_base_port_on_node( schain_id, schain_ids, node_dict.base_port );
        calc_ports( jo_schain, node_dict.schain_base_port );
        compose_endpoints( jo_schain, node_dict, "ip" );
        compose_endpoints( jo_schain, node_dict, "domain" );
        nodes.push( node_dict );
        if( opts && opts.bStopNeeded )
            return;
    }
    // const schain = await jo_schains_internal.methods.schains( schain_id ).call( { from: addressFrom } );
    // jo_schain.data.computed.schain = schain;
    jo_schain.data.computed.schain_id = schain_id;
    jo_schain.data.computed.nodes = nodes;
}

async function get_schains_count( w3, addressFrom, opts ) {
    const jo_schains_internal = opts ? opts.jo_schains_internal : null;
    if( ! jo_schains_internal )
        throw new Error( "Cannot get S-Chains count in observer, no SChainsInternal contract is provided" );
    const cntSChains = await jo_schains_internal.methods.numberOfSchains().call( { from: addressFrom } );
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

async function load_schain( w3, addressFrom, idxSChain, cntSChains, opts ) {
    const jo_schains_internal = opts ? opts.jo_schains_internal : null;
    if( ! jo_schains_internal )
        throw new Error( "Cannot load S-Chain description in observer, no SChainsInternal contract is provided" );
    if( opts && opts.details )
        opts.details.write( cc.debug( "Loading S-Chain " ) + cc.notice( "#" ) + cc.info( idxSChain + 1 ) + cc.debug( " of " ) + cc.info( cntSChains ) + cc.debug( "..." ) + "\n" );
    const hash = await jo_schains_internal.methods.schainsAtSystem( idxSChain ).call( { from: addressFrom } );
    if( opts && opts.details )
        opts.details.write( cc.debug( "    Hash " ) + cc.attention( hash ) + "\n" );
    if( opts && opts.bStopNeeded )
        return null;
    let jo_data = await jo_schains_internal.methods.schains( hash ).call( { from: addressFrom } );
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
    return jo_schain;
}

async function load_schains( w3, addressFrom, opts ) {
    const jo_schains_internal = opts ? opts.jo_schains_internal : null;
    if( ! jo_schains_internal )
        throw new Error( "Cannot load S-Chains in observer, no SChainsInternal contract is provided" );
    const cntSChains = await get_schains_count( w3, addressFrom, opts );
    if( opts && opts.details )
        opts.details.write( cc.debug( "Have " ) + cc.info( cntSChains ) + cc.debug( " S-Chain(s) to load..." ) + "\n" );
    const arr_schains = [];
    for( let idxSChain = 0; idxSChain < cntSChains; ++ idxSChain ) {
        if( opts && opts.bStopNeeded )
            break;
        const jo_schain = await load_schain( w3, addressFrom, idxSChain, cntSChains, opts );
        if( ! jo_schain )
            break;
        arr_schains.push( jo_schain );
    }
    if( opts && opts.details ) {
        // opts.details.write( cc.debug( "Got S-Chain descriptions ") + cc.j( cc.j( arr_schains ) ) + "\n" );
        opts.details.write( cc.success( "All " ) + cc.info( cntSChains ) + cc.debug( " S-Chain(s) loaded" ) + "\n" );
    }
    return arr_schains;
}

function find_schain_index_in_array_by_name( arr_schains, strSChainName ) {
    for( let i = 0; i < arr_schains.length; ++ i ) {
        const jo_schain = arr_schains[i];
        if( jo_schain.data.name.toString() == strSChainName.toString() )
            return i;
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

module.exports.owaspUtils = owaspUtils;
module.exports.cc = cc;
module.exports.get_schains_count = get_schains_count;
module.exports.load_schain = load_schain;
module.exports.load_schains = load_schains;
module.exports.find_schain_index_in_array_by_name = find_schain_index_in_array_by_name;
module.exports.merge_schains_array_from_to = merge_schains_array_from_to;
