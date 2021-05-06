// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   IMALinkerSchain.sol - SKALE Interchain Messaging Agent
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

import "../interfaces/ITokenManager.sol";
import "../interfaces/IMessageProxy.sol";

import "./connectors/ProxyConnectorSchain.sol";


/**
 * @title IMALinkerSchain For Schain
 * @dev Runs on Schain
 */
contract IMALinkerSchain is ProxyConnectorSchain {

    address[] private _tokenManagers;

    constructor(
        string memory chainID,
        address newMessageProxyAddress
    )
        public
        ProxyConnectorSchain(chainID, newMessageProxyAddress)
    {
        
    }

    function registerTokenManager(address newTokenManagerAddress) external onlyOwner {
        _tokenManagers.push(newTokenManagerAddress);
    }

    function removeTokenManager(address tokenManagerAddress) external onlyOwner {
        uint index;
        uint length = _tokenManagers.length;
        for (index = 0; index < length; index++) {
            if (_tokenManagers[index] == tokenManagerAddress) {
                break;
            }
        }
        if (index < length) {
            if (index < length.sub(1)) {
                _tokenManagers[index] = _tokenManagers[length.sub(1)];
            }
            _tokenManagers.pop();
        }
    }

    // function connectSchain(string calldata schainName, address[] calldata tokenManagerAddresses) external onlyOwner {
    //     require(tokenManagerAddresses.length == _tokenManagers.length, "Incorrect number of addresses");
    //     for (uint i = 0; i < tokenManagerAddresses.length; i++) {
    //         ITokenManager(_tokenManagers[i]).addTokenManager(schainName, tokenManagerAddresses[i]);
    //     }
    //     IMessageProxy(getProxyForSchainAddress()).addConnectedChain(schainName);
    // }

    // function connectMainnet(address[] calldata depositBoxAddresses) external onlyOwner {
    //     require(depositBoxAddresses.length == _tokenManagers.length, "Incorrect number of addresses");
    //     for (uint i = 0; i < depositBoxAddresses.length; i++) {
    //         ITokenManager(_tokenManagers[i]).addDepositBox(depositBoxAddresses[i]);
    //     }
    //     IMessageProxy(getProxyForSchainAddress()).addConnectedChain("Mainnet");
    // }

    function unconnectSchain(string calldata schainName) external onlyOwner {
        uint length = _tokenManagers.length;
        for (uint i = 0; i < length; i++) {
            ITokenManager(_tokenManagers[i]).removeTokenManager(schainName);
        }
        IMessageProxy(getProxyForSchainAddress()).removeConnectedChain(schainName);
    }

    function unconnectMainnet() external onlyOwner {
        uint length = _tokenManagers.length;
        for (uint i = 0; i < length; i++) {
            ITokenManager(_tokenManagers[i]).removeDepositBox();
        }
    }

    // function rechargeSchainWallet(bytes32 schainId, uint256 amount) external {
    //     require(address(this).balance >= amount, "Not enough ETH to rechargeSchainWallet");
    //     address walletsAddress = IContractManager(contractManagerOfSkaleManager).getContract("Wallets");
    //     IWallets(payable(walletsAddress)).rechargeSchainWallet{value: amount}(schainId);
    // }

    function hasTokenManager(address tokenManagerAddress) external view returns (bool) {
        uint index;
        uint length = _tokenManagers.length;
        for (index = 0; index < length; index++) {
            if (_tokenManagers[index] == tokenManagerAddress) {
                return true;
            }
        }
        return false;
    }

    function hasSchain(string calldata schainName) external view returns (bool connected) {
        uint length = _tokenManagers.length;
        connected = true;
        for (uint i = 0; i < length; i++) {
            connected = connected && ITokenManager(_tokenManagers[i]).hasTokenManager(schainName);
        }
        connected = connected && IMessageProxy(getProxyForSchainAddress()).isConnectedChain(schainName);
    }

    function hasMainnet() external view returns (bool connected) {
        uint length = _tokenManagers.length;
        connected = true;
        for (uint i = 0; i < length; i++) {
            connected = connected && ITokenManager(_tokenManagers[i]).hasDepositBox();
        }
        connected = connected && IMessageProxy(getProxyForSchainAddress()).isConnectedChain("Mainnet");
    }
}
