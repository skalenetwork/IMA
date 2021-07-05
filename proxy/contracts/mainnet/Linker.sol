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

pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../Messages.sol";
import "./Twin.sol";

import "./MessageProxyForMainnet.sol";


/**
 * @title Linker For Mainnet
 * @dev Runs on Mainnet, holds deposited ETH, and contains mappings and
 * balances of ETH tokens received through DepositBox.
 */
contract Linker is Twin {
    using AddressUpgradeable for address;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    enum KillProcess {NotKilled, PartiallyKilledBySchainOwner, PartiallyKilledByContractOwner, Killed}
    EnumerableSetUpgradeable.AddressSet private _mainnetContracts;

    mapping(bytes32 => bool) public interchainConnections;
    mapping(bytes32 => KillProcess) public statuses;

    modifier onlyLinker() {
        require(hasRole(LINKER_ROLE, msg.sender), "Linker role is required");
        _;
    }

    function registerMainnetContract(address newMainnetContract) external onlyLinker {
        require(_mainnetContracts.add(newMainnetContract), "The contracts was not registered");
    }

    function removeMainnetContract(address mainnetContract) external onlyLinker {
        require(_mainnetContracts.remove(mainnetContract), "The contract was not removed");
    }

    function connectSchain(string calldata schainName, address[] calldata schainContracts) external onlyLinker {
        require(schainContracts.length == _mainnetContracts.length(), "Incorrect number of addresses");
        for (uint i = 0; i < schainContracts.length; i++) {
            Twin(_mainnetContracts.at(i)).addSchainContract(schainName, schainContracts[i]);
        }
        messageProxy.addConnectedChain(schainName);
    }

    function allowInterchainConnections(string calldata schainName) external onlySchainOwner(schainName) {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(statuses[schainHash] == KillProcess.NotKilled, "Schain is in kill process");
        interchainConnections[schainHash] = true;
        messageProxy.postOutgoingMessage(
            schainHash,
            schainLinks[schainHash],
            Messages.encodeInterchainConnectionMessage(true)
        );
    }

    function kill(string calldata schainName) external {
        require(!interchainConnections[keccak256(abi.encodePacked(schainName))], "Interchain connections turned on");
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        if (statuses[schainHash] == KillProcess.NotKilled) {
            if (hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
                statuses[schainHash] = KillProcess.PartiallyKilledByContractOwner;
            } else if (isSchainOwner(msg.sender, schainHash)) {
                statuses[schainHash] = KillProcess.PartiallyKilledBySchainOwner;
            } else {
                revert("Not allowed");
            }
        } else if (
            (
                statuses[schainHash] == KillProcess.PartiallyKilledBySchainOwner &&
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender)
            ) || (
                statuses[schainHash] == KillProcess.PartiallyKilledByContractOwner &&
                isSchainOwner(msg.sender, schainHash)
            )
        ) {
            statuses[schainHash] = KillProcess.Killed;
        } else {
            revert("Already killed or incorrect sender");
        }
    }

    function disconnectSchain(string calldata schainName) external onlyLinker {
        uint length = _mainnetContracts.length();
        for (uint i = 0; i < length; i++) {
            Twin(_mainnetContracts.at(i)).removeSchainContract(schainName);
        }
        messageProxy.removeConnectedChain(schainName);
    }

    function isNotKilled(bytes32 schainHash) external view returns (bool) {
        return statuses[schainHash] != KillProcess.Killed;
    }

    function hasMainnetContract(address mainnetContract) external view returns (bool) {
        return _mainnetContracts.contains(mainnetContract);
    }

    function hasSchain(string calldata schainName) external view returns (bool connected) {
        uint length = _mainnetContracts.length();
        connected = messageProxy.isConnectedChain(schainName);
        for (uint i = 0; connected && i < length; i++) {
            connected = connected && Twin(_mainnetContracts.at(i)).hasSchainContract(schainName);
        }
    }

    function initialize(
        IContractManager contractManagerOfSkaleManagerValue,
        MessageProxyForMainnet messageProxyValue
    )
        public
        override
        initializer
    {
        Twin.initialize(contractManagerOfSkaleManagerValue, messageProxyValue);
        _setupRole(LINKER_ROLE, msg.sender);
        _setupRole(LINKER_ROLE, address(this));
    }
}
