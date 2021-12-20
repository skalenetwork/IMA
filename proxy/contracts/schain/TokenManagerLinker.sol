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


/**
 * @title TokenManagerLinker
 * @dev Links custom TokenManagers to MessageProxy.
 */
contract TokenManagerLinker is ITokenManagerLinker, AccessControlEnumerableUpgradeable {

    /**
     * @dev Mainnet identifier.
     */
    string constant public MAINNET_NAME = "Mainnet";

     /**
     * @dev Keccak256 hash of mainnet name.
     */
    bytes32 constant public MAINNET_HASH = keccak256(abi.encodePacked(MAINNET_NAME));

    /**
     * @dev id of a role that allows to register new token manager.
     */
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    /**
     * @dev Address of MessageProxyForSchain.
     */
    IMessageProxyForSchain public messageProxy;

    /**
     * @dev Address of {Linker} on mainnet.
     */
    address public linkerAddress;

    /**
     * @dev List of address of registered token managers.
     */
    ITokenManager[] public tokenManagers;

    /**
     * @dev Flag that allows direct messaging between SKALE chains.
     */	
    bool public interchainConnections;    

    /**
     * @dev Emitted when {interchainConnections} was changed.
     */
    event InterchainConnectionAllowed(bool isAllowed);

    /**
     * @dev Modifier to make a function callable only if caller is granted with {REGISTRAR_ROLE}.
     */
    modifier onlyRegistrar() {
        require(hasRole(REGISTRAR_ROLE, msg.sender), "REGISTRAR_ROLE is required");
        _;
    }

    /**
     * @dev Register new token manager.
     * 
     * Requirements:
     * 
     * - Function caller has to be granted with {REGISTRAR_ROLE}.
     */
    function initialize(IMessageProxyForSchain newMessageProxyAddress, address linker)
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

    /**
     * @dev Cancel registration of token manager.
     * 
     * Requirements:
     * 
     * - Function caller has to be granted with {REGISTRAR_ROLE}.
     */
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

    /**
     * @dev Register new SKALE chain.
     * 
     * Requirements:
     * 
     * - Function caller has to be granted with {REGISTRAR_ROLE}.
     * - Direct messaging between SKALE chains must be allowed.
     * - Amount of token managers on target SKALE chain must be equal to the amount on current one.
     */
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

    /**
     * @dev Allows MessageProxy to post operational message from mainnet
     * or SKALE chains.
     *
     * Requirements:
     * 
     * - MessageProxy must be the caller of the function.
     * - {Linker} must be an origin of the message on mainnet.
     * - The message must come from the mainnet.
     * - The message must contains information about interchain connection allowance.
     * - Interchain connection allowance in the message must be different from the current one.
     */
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

    /**
     * @dev Cancel registration of linked SKALE chain.
     * 
     * Requirements:
     * 
     * - Function caller has to be granted with {REGISTRAR_ROLE}.
     */
    function disconnectSchain(string calldata schainName) external override onlyRegistrar {
        uint length = tokenManagers.length;
        for (uint i = 0; i < length; i++) {
            tokenManagers[i].removeTokenManager(schainName);
        }
        messageProxy.removeConnectedChain(schainName);
    }

    /**
     * @dev Check if {tokenManager} is registered in IMA.
     */
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

    /**
     * @dev Check if SKALE chain with name {schainName} is registered in IMA.
     */
    function hasSchain(string calldata schainName) external view override returns (bool connected) {
        uint length = tokenManagers.length;
        connected = true;
        for (uint i = 0; i < length; i++) {
            connected = connected && tokenManagers[i].hasTokenManager(schainName);
        }
        connected = connected && messageProxy.isConnectedChain(schainName);
    }
}
