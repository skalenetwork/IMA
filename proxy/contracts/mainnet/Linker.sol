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

import "../interfaces/IDepositBox.sol";

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

    EnumerableSetUpgradeable.AddressSet private _depositBoxes;
    MessageProxyForMainnet public messageProxy;

    modifier onlyLinker() {
        require(hasRole(LINKER_ROLE, msg.sender), "Linker role is required");
        _;
    }

    function registerDepositBox(address newDepositBoxAddress) external onlyLinker {
        _depositBoxes.add(newDepositBoxAddress);
    }

    function removeDepositBox(address depositBoxAddress) external onlyLinker {
        _depositBoxes.remove(depositBoxAddress);
    }

    function connectSchain(string calldata schainName, address[] calldata tokenManagerAddresses) external onlyLinker {
        require(tokenManagerAddresses.length == _depositBoxes.length(), "Incorrect number of addresses");
        for (uint i = 0; i < tokenManagerAddresses.length; i++) {
            IDepositBox(_depositBoxes.at(i)).addTokenManager(schainName, tokenManagerAddresses[i]);
        }
        messageProxy.addConnectedChain(schainName);
    }

    function unconnectSchain(string calldata schainName) external onlyLinker {
        uint length = _depositBoxes.length();
        for (uint i = 0; i < length; i++) {
            IDepositBox(_depositBoxes.at(i)).removeTokenManager(schainName);
        }
        messageProxy.removeConnectedChain(schainName);
    }

    function hasDepositBox(address depositBoxAddress) external view returns (bool) {
        return _depositBoxes.contains(depositBoxAddress);
    }

    function hasSchain(string calldata schainName) external view returns (bool connected) {
        uint length = _depositBoxes.length();
        connected = true;
        for (uint i = 0; connected && i < length; i++) {
            connected = connected && IDepositBox(_depositBoxes.at(i)).hasTokenManager(schainName);
        }
        connected = connected && messageProxy.isConnectedChain(schainName);
    }

    function initialize(address messageProxyAddress) public initializer {
        AccessControlUpgradeable.__AccessControl_init();
        _setupRole(LINKER_ROLE, msg.sender);
        messageProxy = MessageProxyForMainnet(messageProxyAddress);
    }
}
