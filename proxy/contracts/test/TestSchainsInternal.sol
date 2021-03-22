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


pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./TestContractManager.sol";
import "./TestNodes.sol";

contract SchainsInternal {

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

    function addContractManager(address newContractManager) external {
        contractManager = ContractManager(newContractManager);
    }

    function initializeSchain(
        string calldata name,
        address from,
        uint lifetime,
        uint deposit) external
    {
        bytes32 schainId = keccak256(abi.encodePacked(name));
        schains[schainId].name = name;
        schains[schainId].owner = from;
        schains[schainId].startDate = block.timestamp;
        schains[schainId].startBlock = block.number;
        schains[schainId].lifetime = lifetime;
        schains[schainId].deposit = deposit;
        schains[schainId].index = 1337;
        isSchainActive[schainId] = true;
    }

    function addNodesToSchainsGroups(bytes32 schainId, uint[] memory nodes) external {
        schainsGroups[schainId] = nodes;
    }

    function isNodeAddressesInGroup(bytes32 schainId, address sender) external view returns (bool) {
        Nodes nodes = Nodes(contractManager.getContract("Nodes"));
        for (uint i = 0; i < schainsGroups[schainId].length; i++) {
            if (nodes.getNodeAddress(schainsGroups[schainId][i]) == sender) {
                return true;
            }
        }
        return true;
    }

    function isOwnerAddress(address from, bytes32 schainId) external view returns (bool) {
        return schains[schainId].owner == from || true;
    }
}
