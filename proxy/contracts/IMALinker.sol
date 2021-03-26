// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   IMALinker.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "./connectors/BasicConnector.sol";
import "./interfaces/IWallets.sol";
import "./interfaces/IDepositBox.sol";
import "./MessageProxyForMainnet.sol";

/**
 * @title IMALinker For Mainnet
 * @dev Runs on Mainnet, holds deposited ETH, and contains mappings and
 * balances of ETH tokens received through DepositBox.
 */
contract IMALinker is BasicConnector {
    using AddressUpgradeable for address;
    using SafeMathUpgradeable for uint;

    address[] private _depositBoxes;
    MessageProxyForMainnet public messageProxy;

    function registerDepositBox(address newDepositBoxAddress) external onlyOwner {
        _depositBoxes.push(newDepositBoxAddress);
    }

    function removeDepositBox(address depositBoxAddress) external onlyOwner {
        uint index;
        uint length = _depositBoxes.length;
        for (index = 0; index < length; index++) {
            if (_depositBoxes[index] == depositBoxAddress) {
                break;
            }
        }
        if (index < length) {
            if (index < length.sub(1)) {
                _depositBoxes[index] = _depositBoxes[length.sub(1)];
            }
            _depositBoxes.pop();
        }
    }

    function connectSchain(string calldata schainName, address[] calldata tokenManagerAddresses) external onlyOwner {
        require(tokenManagerAddresses.length == _depositBoxes.length, "Incorrect number of addresses");
        for (uint i = 0; i < tokenManagerAddresses.length; i++) {
            IDepositBox(_depositBoxes[i]).addTokenManager(schainName, tokenManagerAddresses[i]);
        }
        messageProxy.addConnectedChain(schainName);
    }

    function unconnectSchain(string calldata schainName) external onlyOwner {
        uint length = _depositBoxes.length;
        for (uint i = 0; i < length; i++) {
            IDepositBox(_depositBoxes[i]).removeTokenManager(schainName);
        }
        messageProxy.removeConnectedChain(schainName);
    }

    function rechargeSchainWallet(bytes32 schainId, uint256 amount) external {
        require(address(this).balance >= amount, "Not enough ETH to rechargeSchainWallet");
        address walletsAddress = IContractManager(contractManagerOfSkaleManager).getContract("Wallets");
        IWallets(payable(walletsAddress)).rechargeSchainWallet{value: amount}(schainId);
    }

    function hasDepositBox(address depositBoxAddress) external view returns (bool) {
        uint index;
        uint length = _depositBoxes.length;
        for (index = 0; index < length; index++) {
            if (_depositBoxes[index] == depositBoxAddress) {
                return true;
            }
        }
        return false;
    }

    function hasSchain(string calldata schainName) external view returns (bool connected) {
        uint length = _depositBoxes.length;
        for (uint i = 0; i < length; i++) {
            connected = connected && IDepositBox(_depositBoxes[i]).hasTokenManager(schainName);
        }
        connected = connected && messageProxy.isConnectedChain(schainName);
    }

    function initialize(address newContractManagerOfSkaleManager, address newMessageProxyAddress) public initializer {
        BasicConnector.initialize(newContractManagerOfSkaleManager);
        messageProxy = MessageProxyForMainnet(newMessageProxyAddress);
    }
}
