// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessageProxyForSchain.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Address.sol";


contract ContractsRegistry is AccessControl {

    using Address for address;

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    mapping (bytes32 => address) private _contractAddresses;

    modifier onlyRegistrar() {
        require(hasRole(REGISTRAR_ROLE, msg.sender), "REGISTRAR_ROLE is required");
        _;
    }

    modifier allow(string memory contractName) {
        require(getContract(contractName) == msg.sender, "Not allowed");
        _;
    }

    function setContract(string memory contractName, address contractAddress) external onlyRegistrar {
        require(contractAddress.isContract(), "Is not contract");
        _contractAddresses[keccak256(abi.encodePacked(contractName))] = contractAddress;
    }

    /**
     * @dev Returns owner address.
     */
    function getContract(string memory contractName) public view returns (address) {
        return _contractAddresses[keccak256(abi.encodePacked(contractName))];
    }

}