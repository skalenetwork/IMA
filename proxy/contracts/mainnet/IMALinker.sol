// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   IMALinker.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../interfaces/IMainnetContract.sol";

import "./connectors/BasicConnector.sol";
import "./MessageProxyForMainnet.sol";


/**
 * @title IMALinker For Mainnet
 * @dev Runs on Mainnet, holds deposited ETH, and contains mappings and
 * balances of ETH tokens received through DepositBox.
 */
contract IMALinker is BasicConnector {
    using AddressUpgradeable for address;
    using SafeMathUpgradeable for uint;

    address[] private _mainnetContracts;
    MessageProxyForMainnet public messageProxy;

    function registerMainnetContract(address newMainnetContract) external onlyOwner {
        _mainnetContracts.push(newMainnetContract);
    }

    function removeMainnetContract(address mainnetContract) external onlyOwner {
        uint index;
        uint length = _mainnetContracts.length;
        for (index = 0; index < length; index++) {
            if (_mainnetContracts[index] == mainnetContract) {
                break;
            }
        }
        if (index < length) {
            if (index < length.sub(1)) {
                _mainnetContracts[index] = _mainnetContracts[length.sub(1)];
            }
            _mainnetContracts.pop();
        }
    }

    function connectSchain(string calldata schainName, address[] calldata schainContracts) external onlyOwner {
        require(schainContracts.length == _mainnetContracts.length, "Incorrect number of addresses");
        for (uint i = 0; i < schainContracts.length; i++) {
            IMainnetContract(_mainnetContracts[i]).addSchainContract(schainName, schainContracts[i]);
        }
        messageProxy.addConnectedChain(schainName);
    }

    function unconnectSchain(string calldata schainName) external onlyOwner {
        uint length = _mainnetContracts.length;
        for (uint i = 0; i < length; i++) {
            IMainnetContract(_mainnetContracts[i]).removeSchainContract(schainName);
        }
        messageProxy.removeConnectedChain(schainName);
    }

    function hasMainnetContract(address mainnetContract) external view returns (bool) {
        uint index;
        uint length = _mainnetContracts.length;
        for (index = 0; index < length; index++) {
            if (_mainnetContracts[index] == mainnetContract) {
                return true;
            }
        }
        return false;
    }

    function hasSchain(string calldata schainName) external view returns (bool connected) {
        uint length = _mainnetContracts.length;
        connected = true;
        for (uint i = 0; i < length; i++) {
            connected = connected && IMainnetContract(_mainnetContracts[i]).hasSchainContract(schainName);
        }
        connected = connected && messageProxy.isConnectedChain(schainName);
    }

    function initialize(address newContractManagerOfSkaleManager, address newMessageProxyAddress) public initializer {
        BasicConnector.initialize(newContractManagerOfSkaleManager);
        messageProxy = MessageProxyForMainnet(newMessageProxyAddress);
    }
}
