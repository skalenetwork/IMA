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

pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@skalenetwork/ima-interfaces/schain/ITokenManagerLinker.sol";

import "../Messages.sol";
import "../MessageProxy.sol";
import "./TokenManager.sol";


interface ITokenManagerLinkerInitializable is ITokenManagerLinker {
    function initialize(MessageProxy newMessageProxyAddress, address linker) external;
}


/**
 * @title TokenManagerLinker
 * @dev Runs on Schain
 */
contract TokenManagerLinker is AccessControlEnumerableUpgradeable, ITokenManagerLinkerInitializable {

    string constant public MAINNET_NAME = "Mainnet";
    bytes32 constant public MAINNET_HASH = keccak256(abi.encodePacked(MAINNET_NAME));
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    MessageProxy public messageProxy;
    address public linkerAddress;
    ITokenManager[] public tokenManagers;
    bool public interchainConnections;    

    event InterchainConnectionAllowed(bool isAllowed);

    modifier onlyRegistrar() {
        require(hasRole(REGISTRAR_ROLE, msg.sender), "REGISTRAR_ROLE is required");
        _;
    }

    function initialize(MessageProxy newMessageProxyAddress, address linker)
        external
        override
        initializer
    {
        require(linker != address(0), "Linker address has to be set");

        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(REGISTRAR_ROLE, msg.sender);
        messageProxy = newMessageProxyAddress;    
	    linkerAddress = linker;
    }  

    function registerTokenManager(ITokenManager newTokenManager) external override onlyRegistrar {
        tokenManagers.push(newTokenManager);
    }

    function removeTokenManager(ITokenManager tokenManagerAddress) external override onlyRegistrar {
        uint index;
        uint length = tokenManagers.length;
        for (index = 0; index < length; index++) {
            if (tokenManagers[index] == tokenManagerAddress) {
                break;
            }
        }
        if (index < length) {
            if (index < length - 1) {
                tokenManagers[index] = tokenManagers[length - 1];
            }
            tokenManagers.pop();
        }
    }

    function connectSchain(
        string calldata schainName,
        address[] calldata tokenManagerAddresses
    )
        external
        override
        onlyRegistrar
    {
        require(interchainConnections, "Interchain connection not allowed");
        require(tokenManagerAddresses.length == tokenManagers.length, "Incorrect number of addresses");
        for (uint i = 0; i < tokenManagerAddresses.length; i++) {
            tokenManagers[i].addTokenManager(schainName, tokenManagerAddresses[i]);
        }
        messageProxy.addConnectedChain(schainName);
    }

    function postMessage(
        bytes32 fromChainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        returns (address)
    {
        require(msg.sender == address(messageProxy), "Sender is not a message proxy");
        require(sender == linkerAddress, "Sender from Mainnet is incorrect");
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
        return address(0);
    }

    function disconnectSchain(string calldata schainName) external override onlyRegistrar {
        uint length = tokenManagers.length;
        for (uint i = 0; i < length; i++) {
            tokenManagers[i].removeTokenManager(schainName);
        }
        messageProxy.removeConnectedChain(schainName);
    }

    function hasTokenManager(ITokenManager tokenManager) external view override returns (bool) {
        uint index;
        uint length = tokenManagers.length;
        for (index = 0; index < length; index++) {
            if (tokenManagers[index] == tokenManager) {
                return true;
            }
        }
        return false;
    }

    function hasSchain(string calldata schainName) external view override returns (bool connected) {
        uint length = tokenManagers.length;
        connected = true;
        for (uint i = 0; i < length; i++) {
            connected = connected && tokenManagers[i].hasTokenManager(schainName);
        }
        connected = connected && messageProxy.isConnectedChain(schainName);
    } 
}
