// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TestSchainsInternal.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2019-Present SKALE Labs
 *   @author Artem Payvin
 *
 *   SKALE IMA is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Affero General Public License as published
 *   by the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   SKALE IMA is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with SKALE IMA.  If not, see <https://www.gnu.org/licenses/>.
 */


pragma solidity 0.8.16;

import "./TestContractManager.sol";
import "./TestNodes.sol";


interface ISchainsInternalTester {
    function addContractManager(address newContractManager) external;
    function initializeSchain(
        string calldata name,
        address from,
        uint lifetime,
        uint deposit) external;
    function addNodesToSchainsGroups(bytes32 schainHash, uint[] memory nodes) external;
    function isNodeAddressesInGroup(bytes32 schainHash, address sender) external view returns (bool);
    function isOwnerAddress(address from, bytes32 schainHash) external view returns (bool);
    function isSchainExist(bytes32 schainHash) external view returns (bool);
    function getSchains() external view returns (bytes32[] memory);
    function getSchainName(bytes32 schainHash) external view returns (string memory);
    function getNodesInGroup(bytes32 schainHash) external view returns (uint[] memory);
}


contract SchainsInternal is ISchainsInternalTester {

    struct Schain {
        string name;
        address owner;
        uint indexInOwnerList;
        uint8 partOfNode;
        uint lifetime;
        uint startDate;
        uint startBlock;
        uint deposit;
        uint64 index;
    }

    ContractManager public contractManager;

    mapping (bytes32 => Schain) public schains;

    mapping (bytes32 => bool) public isSchainActive;

    mapping (bytes32 => uint[]) public schainsGroups;

    bytes32[] public schainsAtSystem;

    mapping (bytes32 => mapping (address => bool)) private _nodeAddressInSchain;

    function addContractManager(address newContractManager) external override {
        contractManager = ContractManager(newContractManager);
    }

    function initializeSchain(
        string calldata name,
        address from,
        uint lifetime,
        uint deposit) external override
    {
        bytes32 schainHash = keccak256(abi.encodePacked(name));
        schains[schainHash].name = name;
        schains[schainHash].owner = from;
        schains[schainHash].startDate = block.timestamp;
        schains[schainHash].startBlock = block.number;
        schains[schainHash].lifetime = lifetime;
        schains[schainHash].deposit = deposit;
        schains[schainHash].index = 1337;
        isSchainActive[schainHash] = true;
        schainsAtSystem.push(schainHash);
    }

    function addNodesToSchainsGroups(bytes32 schainHash, uint[] memory nodes) external override {
        Nodes nodesContract = Nodes(contractManager.getContract("Nodes"));
        schainsGroups[schainHash] = nodes;
        for (uint i = 0; i < nodes.length; i++) {
            address nodeAddress = nodesContract.getNodeAddress(nodes[i]);
            _nodeAddressInSchain[schainHash][nodeAddress] = true;
        }
    }

    function isNodeAddressesInGroup(bytes32 schainHash, address sender) external view override returns (bool) {
        return  _nodeAddressInSchain[schainHash][sender];
    }

    function isOwnerAddress(address from, bytes32 schainHash) external view override returns (bool) {
        return schains[schainHash].owner == from;
    }

    function getSchains() external view override returns (bytes32[] memory) {
        return schainsAtSystem;
    }

    function getSchainName(bytes32 schainHash)
        external
        view
        override
        returns (string memory)
    {
        return schains[schainHash].name;
    }

    function getNodesInGroup(bytes32 schainHash)
        external
        view
        override
        returns (uint[] memory)
    {
        return schainsGroups[schainHash];
    }

    function isSchainExist(bytes32) external pure override returns (bool) {
        return true;
    }
}
