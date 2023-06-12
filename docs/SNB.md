<!-- SPDX-License-Identifier: (AGPL-3.0-only OR CC-BY-4.0) -->

# SNB Implementation

## At a Glance

**SNB** stands for **SKALE Network Browser**. **SNB** is build-in part of **IMA** responsible for downloading entire or partial descriptions of _S-Chains_ and nodes from **SKALE Manager** on **Main Net**. **SNB** is needed to inform **IMA** about various node parameters for futher communication with nodes. _S-Chain to S-Chain_ transfers are possible because **SNB** provides network access information about nodes and detect set of _S-Chains_ connected with each particular _S-Chain_.

**SNB** runs as background worker thread in **IMA**. It preforms periodic downloads of **SKALE network** node descriptions. Once per hour by default.

## Algorithm description

**SNB** calls only `SChainsInternal` and `Nodes` smart contracts of **SKALE Manager**.

First we need to query **SKALE Manager** for _count of S-Chains_ currently created inside **SKALE network**.

```javascript
let count schains_internal.numberOfSchains()
```

Then we walk through _all S-Chains_ in range `0...(count-1)` and download each _S-Chain_ description by its _number_.

_S-Chain_ loading starts with getting _S-Chain's hash_ by its _number_.

```javascript
let hash = await schains_internal.schainsAtSystem( idxSChain );
```
Hash be used to download _S-Chain_ parameters as single _S-Chain description object_.

```javascript
let objectSChainData = await schains_internal.schains( hash );
```

Single _S-Chain description object_ contains only basic fields without node URLs. **IMA** needs ready to use node URLs to access them. So, node URLs require additional calls to **SKALE Manager**. First, we prepare group of computed properties.

```javascript
objectSChainData.computed = {};
```
Second, we get _node IDs_ for _S-Chain_.

```javascript
let schain_id = Keccak245( objectSChainData.name );
const node_ids = await schains_internal.getNodesInGroup( schain_id );
```
Thrid step is the most important. We walk through nodes and perform URL computations for each one.

```javascript
const nodes = [];
for( const node_id of node_ids ) {
    const node = await nodes.nodes( node_id );
    const node_dict = {
        id: node_id,
        name: node[0],
        ip: ip_from_hex( node[1] ),
        base_port: node[3],
        domain: await nodes.getNodeDomainName( node_id ),
        isMaintenance: await nodes.isNodeInMaintenance( node_id )
    };
    const schain_ids = await schains_internal.getSchainIdsForNode( node_id );
    node_dict.schain_base_port = get_schain_base_port_on_node( schain_id, schain_ids, node_dict.base_port );
    calc_ports( objectSChainData, node_dict.schain_base_port );
    compose_endpoints( objectSChainData, node_dict, "ip" );
    compose_endpoints( objectSChainData, node_dict, "domain" );
    nodes.push( node_dict );
}
```

Above we also check whether node is kept in maintenance, compute node domain port, compute ports for various protoculs from base port.

Finally, we save computed data.

```javascript
objectSChainData.computed.schain_id = schain_id;
objectSChainData.computed.nodes = nodes;
```

Algorithm above uses small set of utility operations. The main part is `get_schain_base_port_on_node` which computes _base port_ of _S-Chain_ node.

```javascript
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
```

_Base port_ of _S-Chain_ node is used to compute per-protocol ports available on same node.

```javascript
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

function calc_ports( objectSChainData, schain_base_port ) {
    objectSChainData.computed.ports = {
        httpRpcPort: schain_base_port + SkaledPorts.HTTP_JSON,
        httpsRpcPort: schain_base_port + SkaledPorts.HTTPS_JSON,
        wsRpcPort: schain_base_port + SkaledPorts.WS_JSON,
        wssRpcPort: schain_base_port + SkaledPorts.WSS_JSON,
        infoHttpRpcPort: schain_base_port + SkaledPorts.INFO_HTTP_JSON,
        imaAgentRpcPort: schain_base_port + SkaledPorts.IMA_AGENT_JSON
    };
}
```

Finally, we have all ports and domain names and IP addeses to compute ready to use per-protocol URLs.

```javascript
function compose_endpoints( objectSChainData, node_dict, endpoint_type ) {
    node_dict["http_endpoint_" + endpoint_type] = "http://" + node_dict[endpoint_type] + ":" + objectSChainData.computed.ports.httpRpcPort;
    node_dict["https_endpoint_" + endpoint_type] = "https://" + node_dict[endpoint_type] + ":" + objectSChainData.computed.ports.httpsRpcPort;
    node_dict["ws_endpoint_" + endpoint_type] = "ws://" + node_dict[endpoint_type] + ":" + objectSChainData.computed.ports.wsRpcPort;
    node_dict["wss_endpoint_" + endpoint_type] = "wss://" + node_dict[endpoint_type] + ":" + objectSChainData.computed.ports.wssRpcPort;
    node_dict["info_http_endpoint_" + endpoint_type] = "http://" + node_dict[endpoint_type] + ":" + objectSChainData.computed.ports.infoHttpRpcPort;
    node_dict["ima_agent_endpoint_" + endpoint_type] = "http://" + node_dict[endpoint_type] + ":" + objectSChainData.computed.ports.imaAgentRpcPort;
}
```

## Connected S-Chains

Loading _S-Chain_ descriptions for all _S-Chains_ connected to one particular _S-Chain_ is same as loading all _S-Chains_ of entire **SKALE network**. But each _S-Chain_ should be checked for connected status with other particular _S-Chain_. This is performed via `MessageProxy` contract call on _S-Chain_.

```javascript
const isConnected = await message_proxy_s_chain.isConnectedChain( strSChainName )
```

The connected status check above is performed before loading detailed _S-Chain_ data and compute its URLs. This optimizes un-needed calls to **SKALE Manager** on **Main Net**.


