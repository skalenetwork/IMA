// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessageProxy.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Dmytro Stebaiev
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
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "./interfaces/IMessageReceiver.sol";
import "./interfaces/IGasReimbursable.sol";

/**
 * @title MessageProxy
 * @dev Abstract contract for MessageProxyForMainnet and MessageProxyForSchain.
 */
abstract contract MessageProxy is AccessControlEnumerableUpgradeable {
    using AddressUpgradeable for address;

    bytes32 public constant MAINNET_HASH = keccak256(abi.encodePacked("Mainnet"));
    bytes32 public constant CHAIN_CONNECTOR_ROLE = keccak256("CHAIN_CONNECTOR_ROLE");
    bytes32 public constant EXTRA_CONTRACT_REGISTRAR_ROLE = keccak256("EXTRA_CONTRACT_REGISTRAR_ROLE");
    bytes32 public constant CONSTANT_SETTER_ROLE = keccak256("CONSTANT_SETTER_ROLE");
    uint256 public constant MESSAGES_LENGTH = 10;

    /**
     * @dev Structure that stores counters for outgoing and incoming messages.
     */
    struct ConnectedChainInfo {
        // message counters start with 0
        uint256 incomingMessageCounter;
        uint256 outgoingMessageCounter;
        bool inited;
    }

    /**
     * @dev Structure that describes message. Should contain sender of message,
     * destination contract on schain that will receiver message,
     * data that contains all needed info about token or ETH.
     */
    struct Message {
        address sender;
        address destinationContract;
        bytes data;
    }

    /**
     * @dev Structure that contains fields for bls signature.
     */
    struct Signature {
        uint256[2] blsSignature;
        uint256 hashA;
        uint256 hashB;
        uint256 counter;
    }

    //   schainHash => ConnectedChainInfo
    mapping(bytes32 => ConnectedChainInfo) public connectedChains;
    //   schainHash => contract address => allowed
    mapping(bytes32 => mapping(address => bool)) public registryContracts;

    uint256 public gasLimit;

    /**
     * @dev Emitted for every outgoing message to schain.
     */
    event OutgoingMessage(
        bytes32 indexed dstChainHash,
        uint256 indexed msgCounter,
        address indexed srcContract,
        address dstContract,
        bytes data
    );

    /**
     * @dev Emitted when function `postMessage` returns revert.
     *  Used to prevent stuck loop inside function `postIncomingMessages`.
     */
    event PostMessageError(
        uint256 indexed msgCounter,
        bytes message
    );

    /**
     * @dev Emitted when gas limit per one call of `postMessage` was changed.
     */
    event GasLimitWasChanged(
        uint256 oldValue,
        uint256 newValue
    );

    /**
     * @dev Modifier to make a function callable only if caller is granted with {CHAIN_CONNECTOR_ROLE}.
     */
    modifier onlyChainConnector() {
        require(hasRole(CHAIN_CONNECTOR_ROLE, msg.sender), "CHAIN_CONNECTOR_ROLE is required");
        _;
    }

    /**
     * @dev Modifier to make a function callable only if caller is granted with {EXTRA_CONTRACT_REGISTRAR_ROLE}.
     */
    modifier onlyExtraContractRegistrar() {
        require(hasRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender), "EXTRA_CONTRACT_REGISTRAR_ROLE is required");
        _;
    }

    /**
     * @dev Modifier to make a function callable only if caller is granted with {CONSTANT_SETTER_ROLE}.
     */
    modifier onlyConstantSetter() {
        require(hasRole(CONSTANT_SETTER_ROLE, msg.sender), "Not enough permissions to set constant");
        _;
    }

    function initializeMessageProxy(uint newGasLimit) public initializer {
        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(CHAIN_CONNECTOR_ROLE, msg.sender);
        _setupRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender);
        _setupRole(CONSTANT_SETTER_ROLE, msg.sender);
        emit GasLimitWasChanged(gasLimit, newGasLimit);
        gasLimit = newGasLimit;
    }

    /**
     * @dev Checks whether schain was connected to MessageProxy.
     */
    function isConnectedChain(
        string memory schainName
    )
        public
        view
        virtual
        returns (bool)
    {
        return connectedChains[keccak256(abi.encodePacked(schainName))].inited;
    }

    /**
     * @dev Allows `msg.sender` to connect schain with MessageProxy for transferring messages.
     */
    function addConnectedChain(string calldata schainName) external virtual;

    /**
     * @dev Allows `msg.sender` to disconnect schain with MessageProxy for transferring messages.
     *
     * Requirements:
     *  
     * - `msg.sender` must be granted CHAIN_CONNECTOR_ROLE.
     * - Chain must be initialized.
     */
    function removeConnectedChain(string memory schainName) public virtual onlyChainConnector {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(connectedChains[schainHash].inited, "Chain is not initialized");
        delete connectedChains[schainHash];
    }

    /**
     * @dev Sets gasLimit to a new value.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted CONSTANT_SETTER_ROLE.
     */
    function setNewGasLimit(uint256 newGasLimit) external onlyConstantSetter {
        emit GasLimitWasChanged(gasLimit, newGasLimit);
        gasLimit = newGasLimit;
    }

    /**
     * @dev Posts message from this contract to `targetChainHash` MessageProxy contract.
     * This is called by a smart contract to make a cross-chain call.
     * 
     * Emits an {OutgoingMessage} event.
     *
     * Requirements:
     * 
     * - Target chain must be initialized.
     * - Target chain must be registered as external contract.
     */
    function postOutgoingMessage(
        bytes32 targetChainHash,
        address targetContract,
        bytes memory data
    )
        public
        virtual
    {
        require(connectedChains[targetChainHash].inited, "Destination chain is not initialized");
        require(
            registryContracts[bytes32(0)][msg.sender] || 
            registryContracts[targetChainHash][msg.sender],
            "Sender contract is not registered"
        );        
        
        emit OutgoingMessage(
            targetChainHash,
            connectedChains[targetChainHash].outgoingMessageCounter,
            msg.sender,
            targetContract,
            data
        );

        connectedChains[targetChainHash].outgoingMessageCounter += 1;
    }

    /**
     * @dev Virtual function for `postIncomingMessages`.
     */
    function postIncomingMessages(
        string calldata fromSchainName,
        uint256 startingCounter,
        Message[] calldata messages,
        Signature calldata sign
    )
        external
        virtual;

    /**
     * @dev Allows `msg.sender` to register extra contract for all schains
     * for being able to transfer messages from custom contracts.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted as EXTRA_CONTRACT_REGISTRAR_ROLE.
     * - Passed address should be contract.
     * - Extra contract must not be registered.
     */
    function registerExtraContractForAll(address extraContract) external onlyExtraContractRegistrar {
        require(extraContract.isContract(), "Given address is not a contract");
        require(!registryContracts[bytes32(0)][extraContract], "Extra contract is already registered");
        registryContracts[bytes32(0)][extraContract] = true;
    }

    /**
     * @dev Allows `msg.sender` to remove extra contract for all schains.
     * Extra contract will no longer be able to send messages through MessageProxy.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted as EXTRA_CONTRACT_REGISTRAR_ROLE.
     */
    function removeExtraContractForAll(address extraContract) external onlyExtraContractRegistrar {
        require(registryContracts[bytes32(0)][extraContract], "Extra contract is not registered");
        delete registryContracts[bytes32(0)][extraContract];
    }

    /**
     * @dev Checks whether contract is currently registered as extra contract.
     */
    function isContractRegistered(
        string calldata schainName,
        address contractAddress
    )
        external
        view
        returns (bool)
    {
        return registryContracts[keccak256(abi.encodePacked(schainName))][contractAddress] ||
               registryContracts[bytes32(0)][contractAddress];
    }

    /**
     * @dev Returns number of outgoing messages.
     * 
     * Requirements:
     * 
     * - Target schain  must be initialized.
     */
    function getOutgoingMessagesCounter(string calldata targetSchainName)
        external
        view
        returns (uint256)
    {
        bytes32 dstChainHash = keccak256(abi.encodePacked(targetSchainName));
        require(connectedChains[dstChainHash].inited, "Destination chain is not initialized");
        return connectedChains[dstChainHash].outgoingMessageCounter;
    }

    /**
     * @dev Returns number of incoming messages.
     * 
     * Requirements:
     * 
     * - Source schain must be initialized.
     */
    function getIncomingMessagesCounter(string calldata fromSchainName)
        external
        view
        returns (uint256)
    {
        bytes32 srcChainHash = keccak256(abi.encodePacked(fromSchainName));
        require(connectedChains[srcChainHash].inited, "Source chain is not initialized");
        return connectedChains[srcChainHash].incomingMessageCounter;
    }

    /**
     * @dev Allows MessageProxy to connect schain with MessageProxyOnMainnet for transferring messages.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted CHAIN_CONNECTOR_ROLE.
     * - SKALE chain must not be connected.
     */
    function _addConnectedChain(bytes32 schainHash) internal onlyChainConnector {
        require(!connectedChains[schainHash].inited,"Chain is already connected");
        connectedChains[schainHash] = ConnectedChainInfo({
            incomingMessageCounter: 0,
            outgoingMessageCounter: 0,
            inited: true
        });
    }

    /**
     * @dev Allows MessageProxy to send messages from schain to mainnet.
     * Destination contract must implement `postMessage` method.
     */
    function _callReceiverContract(
        bytes32 schainHash,
        Message calldata message,
        uint counter
    )
        internal
        returns (address)
    {
        try IMessageReceiver(message.destinationContract).postMessage{gas: gasLimit}(
            schainHash,
            message.sender,
            message.data
        ) returns (address receiver) {
            return receiver;
        } catch Error(string memory reason) {
            emit PostMessageError(
                counter,
                bytes(reason)
            );
            return address(0);
        } catch (bytes memory revertData) {
            emit PostMessageError(
                counter,
                revertData
            );
            return address(0);
        }
    }

    function _getGasPayer(
        bytes32 schainHash,
        Message calldata message,
        uint counter
    )
        internal
        returns (address)
    {
        try IGasReimbursable(message.destinationContract).gasPayer{gas: gasLimit}(
            schainHash,
            message.sender,
            message.data
        ) returns (address receiver) {
            return receiver;
        } catch Error(string memory reason) {
            emit PostMessageError(
                counter,
                bytes(reason)
            );
            return address(0);
        } catch (bytes memory revertData) {
            emit PostMessageError(
                counter,
                revertData
            );
            return address(0);
        }
    }
    
    /**
     * @dev Allows MessageProxy to register extra contract for being able to transfer messages from custom contracts.
     * 
     * Requirements:
     * 
     * - Extra contract address must be contract.
     * - Extra contract must not be registered.
     * - Extra contract must not be registered for all chains.
     */
    function _registerExtraContract(
        bytes32 chainHash,
        address extraContract
    )
        internal
    {      
        require(extraContract.isContract(), "Given address is not a contract");
        require(!registryContracts[chainHash][extraContract], "Extra contract is already registered");
        require(!registryContracts[bytes32(0)][extraContract], "Extra contract is already registered for all chains");
        
        registryContracts[chainHash][extraContract] = true;
    }

    /**
     * @dev Allows MessageProxy to remove extra contract,
     * thus `extraContract` will no longer be available to transfer messages from mainnet to schain.
     * 
     * Requirements:
     * 
     * - Extra contract must be registered.
     */
    function _removeExtraContract(
        bytes32 chainHash,
        address extraContract
    )
        internal
    {
        require(registryContracts[chainHash][extraContract], "Extra contract is not registered");
        delete registryContracts[chainHash][extraContract];
    }

    /**
     * @dev Returns hash of message array.
     */
    function _hashedArray(Message[] calldata messages) internal pure returns (bytes32) {
        bytes memory data;
        for (uint256 i = 0; i < messages.length; i++) {
            data = abi.encodePacked(
                data,
                bytes32(bytes20(messages[i].sender)),
                bytes32(bytes20(messages[i].destinationContract)),
                messages[i].data
            );
        }
        return keccak256(data);
    }
}
