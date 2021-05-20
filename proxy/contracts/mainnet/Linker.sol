// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   Linker.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../interfaces/IMainnetContract.sol";

import "./MessageProxyForMainnet.sol";


/**
 * @title Linker For Mainnet
 * @dev Runs on Mainnet, holds deposited ETH, and contains mappings and
 * balances of ETH tokens received through DepositBox.
 */
contract Linker is AccessControlUpgradeable {
    using AddressUpgradeable for address;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using SafeMathUpgradeable for uint;

    bytes32 public constant LINKER_ROLE = keccak256("LINKER_ROLE");

    EnumerableSetUpgradeable.AddressSet private _mainnetContracts;
    MessageProxyForMainnet public messageProxy;

    modifier onlyLinker() {
        require(hasRole(LINKER_ROLE, msg.sender), "Linker role is required");
        _;
    }

    function registerMainnetContract(address newMainnetContract) external onlyLinker {
        _mainnetContracts.add(newMainnetContract);
    }

    function removeMainnetContract(address mainnetContract) external onlyLinker {
        _mainnetContracts.remove(mainnetContract);
    }

    function connectSchain(string calldata schainName, address[] calldata schainContracts) external onlyLinker {
        require(schainContracts.length == _mainnetContracts.length(), "Incorrect number of addresses");
        for (uint i = 0; i < schainContracts.length; i++) {
            IMainnetContract(_mainnetContracts.at(i)).addSchainContract(schainName, schainContracts[i]);
        }
        messageProxy.addConnectedChain(schainName);
    }

    function unconnectSchain(string calldata schainName) external onlyLinker {
        uint length = _mainnetContracts.length();
        for (uint i = 0; i < length; i++) {
            IMainnetContract(_mainnetContracts.at(i)).removeSchainContract(schainName);
        }
        messageProxy.removeConnectedChain(schainName);
    }

    function hasMainnetContract(address mainnetContract) external view returns (bool) {
        return _mainnetContracts.contains(mainnetContract);
    }

    function hasSchain(string calldata schainName) external view returns (bool connected) {
        uint length = _mainnetContracts.length();
        connected = messageProxy.isConnectedChain(schainName);
        for (uint i = 0; connected && i < length; i++) {
            connected = connected && IMainnetContract(_mainnetContracts.at(i)).hasSchainContract(schainName);
        }
    }

    function initialize(address messageProxyAddress) public initializer {
        AccessControlUpgradeable.__AccessControl_init();
        _setupRole(LINKER_ROLE, msg.sender);
        messageProxy = MessageProxyForMainnet(messageProxyAddress);
    }
}
