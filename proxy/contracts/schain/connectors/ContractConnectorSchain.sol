// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ContractConnectorSchain.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
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

import "./AuthorizedConnectorSchain.sol";


/**
 * @title ContractConnectorSchain - connected module for Upgradeable approach, knows ContractManager
 * @author Artem Payvin
 */
contract ContractConnectorSchain is AuthorizedConnectorSchain {

    mapping (bytes32 => address) private _contractAddresses;

    modifier authorizedOrOwner() {
        require(isAuthorizedCaller(bytes32(0), msg.sender) || _isOwner(), "Not authorized sender");
        _;
    }

    modifier allow(string memory contractName) {
        require(getContract(contractName) == msg.sender || _isOwner(), "Not allowed");
        _;
    }

    /**
     * @dev constructor - sets chainID
     */
    constructor(string memory chainID) public AuthorizedConnectorSchain(chainID)
    {
        
    }

    function setContract(string memory contractName, address contractAddress) external authorizedOrOwner {
        _contractAddresses[keccak256(abi.encodePacked(contractName))] = contractAddress;
    }

    /**
     * @dev Returns owner address.
     */
    function getContract(string memory contractName) public view returns (address) {
        // if (_contractAddresses[keccak256(abi.encodePacked(contractName))] == (address(0)) )
        //     return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
        //         string(abi.encodePacked("skaleConfig.contractSettings.IMA.", contractName))
        //     );
        return _contractAddresses[keccak256(abi.encodePacked(contractName))];
    }
}
