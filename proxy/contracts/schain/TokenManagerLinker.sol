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
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../Messages.sol";
import "../interfaces/IMessageProxy.sol";
import "./SkaleFeaturesClient.sol";
import "./TokenManager.sol";


/**
 * @title TokenManagerLinker
 * @dev Runs on Schain
 */
contract TokenManagerLinker is SkaleFeaturesClient {

    using SafeMath for uint;

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    IMessageProxy public messageProxy;
    TokenManager[] private _tokenManagers;

    bool public interchainConnections;

    address public linkerAddress;
    string constant public MAINNET_NAME = "Mainnet";
    bytes32 constant public MAINNET_HASH = keccak256(abi.encodePacked(MAINNET_NAME));

    event InterchainConnectionAllowed(bool isAllowed);

    constructor(
        address newMessageProxyAddress,
        address newLinkerAddress
    )
        public
    {
        messageProxy = IMessageProxy(newMessageProxyAddress);
        linkerAddress = newLinkerAddress;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(REGISTRAR_ROLE, msg.sender);
    }

    modifier onlyRegistrar() {
        require(hasRole(REGISTRAR_ROLE, msg.sender), "REGISTRAR_ROLE is required");
        _;
    }

    function registerTokenManager(TokenManager newTokenManager) external onlyRegistrar {
        _tokenManagers.push(newTokenManager);
    }

    function removeTokenManager(TokenManager tokenManagerAddress) external onlyRegistrar {
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

    function connectSchain(
        string calldata schainName,
        address[] calldata tokenManagerAddresses
    )
        external
        onlyRegistrar
    {
        require(tokenManagerAddresses.length == _tokenManagers.length, "Incorrect number of addresses");
        for (uint i = 0; i < tokenManagerAddresses.length; i++) {
            _tokenManagers[i].addTokenManager(schainName, tokenManagerAddresses[i]);
        }
        getMessageProxy().addConnectedChain(schainName);
    }

    function postMessage(
        bytes32 fromChainHash,
        address sender,
        bytes calldata data
    )
        external
        returns (bool)
    {
        require(msg.sender == address(getMessageProxy()), "Sender is not a message proxy");
        require(sender == getLinkerAddress(), "Sender from Mainnet is incorrect");
        require(fromChainHash == MAINNET_HASH, "Source chain name should be Mainnet");
        Messages.MessageType operation = Messages.getMessageType(data);
        require(
            operation == Messages.MessageType.INTERCHAIN_CONNECTION,
            "The message should contain a interchain connection state"
        );
        Messages.InterchainConnectionMessage memory message = Messages.decodeInterchainConnectionMessage(data);
        require(interchainConnections != message.isAllowed, "Interchain connection state should be different");
        interchainConnections = message.isAllowed;
        emit InterchainConnectionAllowed(message.isAllowed);
        return true;
    }

    function disconnectSchain(string calldata schainName) external onlyRegistrar {
        uint length = _tokenManagers.length;
        for (uint i = 0; i < length; i++) {
            _tokenManagers[i].removeTokenManager(schainName);
        }
        getMessageProxy().removeConnectedChain(schainName);
    }

    function hasTokenManager(TokenManager tokenManager) external view returns (bool) {
        uint index;
        uint length = _tokenManagers.length;
        for (index = 0; index < length; index++) {
            if (_tokenManagers[index] == tokenManager) {
                return true;
            }
        }
        return false;
    }

    function hasSchain(string calldata schainName) external view returns (bool connected) {
        uint length = _tokenManagers.length;
        connected = true;
        for (uint i = 0; i < length; i++) {
            connected = connected && _tokenManagers[i].hasTokenManager(schainName);
        }
        connected = connected && getMessageProxy().isConnectedChain(schainName);
    }

    function getMessageProxy() public view returns (IMessageProxy) {
        if (address(messageProxy) == address(0)) {
            return IMessageProxy(
                getSkaleFeatures().getConfigVariableAddress(
                    "skaleConfig.contractSettings.IMA.MessageProxy"
                )
            );
        }
        return messageProxy;
    }

    function getLinkerAddress() public view returns (address) {
        if (linkerAddress == address(0)) {
            return getSkaleFeatures().getConfigVariableAddress(
                "skaleConfig.contractSettings.IMA.Linker"
            );
        }
        return linkerAddress;
    }
}
