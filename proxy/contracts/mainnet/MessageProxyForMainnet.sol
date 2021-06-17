// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessageProxyForMainnet.sol - SKALE Interchain Messaging Agent
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
pragma experimental ABIEncoderV2;

import "@skalenetwork/skale-manager-interfaces/IWallets.sol";
import "@skalenetwork/skale-manager-interfaces/ISchains.sol";

import "../interfaces/IMessageReceiver.sol";
import "./SkaleManagerClient.sol";


interface ICommunityPool {
    function refundGasByUser(
        bytes32 schainHash,
        address node,
        address user,
        uint256 gas
    ) external;
    function getBalance() external view returns (uint);
}

/**
 * @title Message Proxy for Mainnet
 * @dev Runs on Mainnet, contains functions to manage the incoming messages from
 * `targetSchainName` and outgoing messages to `fromSchainName`. Every SKALE chain with 
 * IMA is therefore connected to MessageProxyForMainnet.
 *
 * Messages from SKALE chains are signed using BLS threshold signatures from the
 * nodes in the chain. Since Ethereum Mainnet has no BLS public key, mainnet
 * messages do not need to be signed.
 */
contract MessageProxyForMainnet is SkaleManagerClient {

    /**
     * 16 Agents
     * Synchronize time with time.nist.gov
     * Every agent checks if it is his time slot
     * Time slots are in increments of 10 seconds
     * At the start of his slot each agent:
     * For each connected schain:
     * Read incoming counter on the dst chain
     * Read outgoing counter on the src chain
     * Calculate the difference outgoing - incoming
     * Call postIncomingMessages function passing (un)signed message array
     * ID of this schain, Chain 0 represents ETH mainnet,
    */

    struct ConnectedChainInfo {
        // message counters start with 0
        uint256 incomingMessageCounter;
        uint256 outgoingMessageCounter;
        bool inited;
    }

    struct Message {
        address sender;
        address destinationContract;
        bytes data;
    }

    struct Signature {
        uint256[2] blsSignature;
        uint256 hashA;
        uint256 hashB;
        uint256 counter;
    }

    bytes32 public constant MAINNET_HASH = keccak256(abi.encodePacked("Mainnet"));
    bytes32 public constant CHAIN_CONNECTOR_ROLE = keccak256("CHAIN_CONNECTOR_ROLE");
    bytes32 public constant EXTRA_CONTRACT_REGISTRAR_ROLE = keccak256("EXTRA_CONTRACT_REGISTRAR_ROLE");
    bytes32 public constant CONSTANT_SETTER_ROLE = keccak256("CONSTANT_SETTER_ROLE");

    address public communityPoolAddress;

    mapping(bytes32 => ConnectedChainInfo) public connectedChains;
    mapping(bytes32 => mapping(address => bool)) public registryContracts;

    uint256 public headerMessageGasCost;
    uint256 public messageGasCost;
    uint256 public gasLimit;

    modifier onlyConstantSetter() {
        require(hasRole(CONSTANT_SETTER_ROLE, msg.sender), "Not enough permissions to set constant");
        _;
    }

    /**
     * @dev Emitted for every outgoing message to `dstChain`.
     */
    event OutgoingMessage(
        bytes32 indexed dstChainHash,
        uint256 indexed msgCounter,
        address indexed srcContract,
        address dstContract,
        bytes data
    );

    event PostMessageError(
        uint256 indexed msgCounter,
        bytes message
    );

    /**
     * @dev Allows LockAndData to add a `schainName`.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be SKALE Node address.
     * - `schainName` must not be "Mainnet".
     * - `schainName` must not already be added.
     */
    function addConnectedChain(string calldata schainName) external {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            schainHash != MAINNET_HASH,
            "SKALE chain name is incorrect. Inside in MessageProxy"
        );
        require(
            hasRole(CHAIN_CONNECTOR_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainHash),
            "Not enough permissions to add connected chain"
        );
        require(!connectedChains[schainHash].inited,"Chain is already connected");
        connectedChains[schainHash] = ConnectedChainInfo({
            incomingMessageCounter: 0,
            outgoingMessageCounter: 0,
            inited: true
        });
    }

    /**
     * @dev Allows LockAndData to remove connected chain from this contract.
     * 
     * Requirements:
     * 
     * - `msg.sender` must be LockAndData contract.
     * - `schainName` must be initialized.
     */
    function removeConnectedChain(string calldata schainName) external {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            connectedChains[schainHash].inited,
            "Chain is not initialized"
        );
        require(
            hasRole(CHAIN_CONNECTOR_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainHash),
            "Not enough permissions to remove connected chain"
        );
        delete connectedChains[schainHash];
    }

    function setCommunityPool(address newCommunityPoolAddress) external {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );  
        communityPoolAddress = newCommunityPoolAddress;
    }

    /**
     * @dev Posts message from this contract to `targetSchainName` MessageProxy contract.
     * This is called by a smart contract to make a cross-chain call.
     * 
     * Requirements:
     * 
     * - `targetSchainName` must be initialized.
     */
    function postOutgoingMessage(
        bytes32 targetChainHash,
        address targetContract,
        bytes calldata data
    )
        external
    {
        require(connectedChains[targetChainHash].inited, "Destination chain is not initialized");
        require(
            registryContracts[bytes32(0)][msg.sender] || 
            registryContracts[targetChainHash][msg.sender],
            "Sender contract is not registered"
        );
        uint msgCounter = connectedChains[targetChainHash].outgoingMessageCounter;
        emit OutgoingMessage(
            targetChainHash,
            msgCounter,
            msg.sender,
            targetContract,
            data
        );
        connectedChains[targetChainHash].outgoingMessageCounter = msgCounter.add(1);
    }

    function registerExtraContract(string calldata schainName, address contractOnMainnet) external {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(schainHash != MAINNET_HASH, "Schain hash can not be equal Mainnet");
        require(
            hasRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainHash),
            "Not enough permissions to register extra contract"
        );
        require(contractOnMainnet.isContract(), "Given address is not a contract");
        require(!registryContracts[schainHash][contractOnMainnet], "Extra contract is already registered");
        require(
            !registryContracts[bytes32(0)][contractOnMainnet],
            "Extra contract is already registered for all chains"
        );
        registryContracts[schainHash][contractOnMainnet] = true;
    }

    function registerExtraContractForAll(address contractOnMainnet) external {
        require(
            hasRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender),
            "Not enough permissions to register extra contract for all chains"
        );
        require(contractOnMainnet.isContract(), "Given address is not a contract");
        require(!registryContracts[bytes32(0)][contractOnMainnet], "Extra contract is already registered");
        registryContracts[bytes32(0)][contractOnMainnet] = true;
    }

    function removeExtraContract(string calldata schainName, address contractOnMainnet) external {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(schainHash != MAINNET_HASH, "Schain hash can not be equal Mainnet");
        require(
            hasRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainHash),
            "Not enough permissions to remove extra contract"
        );
        require(contractOnMainnet.isContract(), "Given address is not a contract");
        require(registryContracts[schainHash][contractOnMainnet], "Extra contract does not exist");
        delete registryContracts[schainHash][contractOnMainnet];
    }

    function removeExtraContractForAll(address contractOnMainnet) external {
        require(
            hasRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender),
            "Not enough permissions to remove extra contract for all chains"
        );
        require(contractOnMainnet.isContract(), "Given address is not a contract");
        require(registryContracts[bytes32(0)][contractOnMainnet], "Extra contract does not exist");
        delete registryContracts[bytes32(0)][contractOnMainnet];
    }

    /**
     * @dev Posts incoming message from `fromSchainName`. 
     * 
     * Requirements:
     * 
     * - `msg.sender` must be authorized caller.
     * - `fromSchainName` must be initialized.
     * - `startingCounter` must be equal to the chain's incoming message counter.
     * - If destination chain is Mainnet, message signature must be valid.
     */
    function postIncomingMessages(
        string calldata fromSchainName,
        uint256 startingCounter,
        Message[] calldata messages,
        Signature calldata sign,
        uint256
    )
        external
    {
        uint256 gasTotal = gasleft();
        bytes32 fromSchainHash = keccak256(abi.encodePacked(fromSchainName));
        require(connectedChains[fromSchainHash].inited, "Chain is not initialized");
        require(
            startingCounter == connectedChains[fromSchainHash].incomingMessageCounter,
            "Starting counter is not equal to incoming message counter");

        require(_verifyMessages(fromSchainName, _hashedArray(messages), sign), "Signature is not verified");
        uint additionalGasPerMessage = 
            (gasTotal.sub(gasleft())
            .add(headerMessageGasCost)
            .add(messages.length * messageGasCost))
            .div(messages.length);
        for (uint256 i = 0; i < messages.length; i++) {
            gasTotal = gasleft();
            address receiver = _callReceiverContract(fromSchainHash, messages[i], startingCounter + i);
            if (receiver == address(0)) 
                continue;
            ICommunityPool(communityPoolAddress).refundGasByUser(
                fromSchainHash,
                msg.sender,
                receiver,
                gasTotal.sub(gasleft()).add(additionalGasPerMessage)
            );
        }
        connectedChains[fromSchainHash].incomingMessageCounter = 
            connectedChains[fromSchainHash].incomingMessageCounter.add(uint256(messages.length));
    }

    /**
     * @dev Sets headerMessageGasCost to a new value
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted as CONSTANT_SETTER_ROLE.
     */
    function setNewHeaderMessageGasCost(uint256 newHeaderMessageGasCost) external onlyConstantSetter {
        headerMessageGasCost = newHeaderMessageGasCost;
    }

    /**
     * @dev Sets messageGasCost to a new value
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted as CONSTANT_SETTER_ROLE.
     */
    function setNewMessageGasCost(uint256 newMessageGasCost) external onlyConstantSetter {
        messageGasCost = newMessageGasCost;
    }

    /**
     * @dev Sets gasLimit to a new value
     * 
     * Requirements:
     * 
     * - `msg.sender` must be granted CONSTANT_SETTER_ROLE.
     */
    function setNewGasLimit(uint256 newGasLimit) external onlyConstantSetter {
        gasLimit = newGasLimit;
    }

    /**
     * @dev Checks whether chain is currently connected.
     * 
     * Note: Mainnet chain does not have a public key, and is implicitly 
     * connected to MessageProxy.
     * 
     * Requirements:
     * 
     * - `schainName` must not be Mainnet.
     */
    function isConnectedChain(
        string calldata schainName
    )
        external
        view
        returns (bool)
    {
        require(keccak256(abi.encodePacked(schainName)) != MAINNET_HASH, "Schain id can not be equal Mainnet");
        return connectedChains[keccak256(abi.encodePacked(schainName))].inited;
    }

    /**
     * @dev Checks whether contract is currently connected to
     * send messages to chain or receive messages from chain.
     */
    function isContractRegistered(
        string calldata schainName,
        address contractAddress
    )
        external
        view
        returns (bool)
    {
        return registryContracts[keccak256(abi.encodePacked(schainName))][contractAddress];
    }

    /**
     * @dev Returns number of outgoing messages to some schain
     * 
     * Requirements:
     * 
     * - `targetSchainName` must be initialized.
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
     * @dev Returns number of incoming messages from some schain
     * 
     * Requirements:
     * 
     * - `fromSchainName` must be initialized.
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

    // Create a new message proxy

    function initialize(IContractManager contractManagerOfSkaleManager) public virtual override initializer {
        SkaleManagerClient.initialize(contractManagerOfSkaleManager);
        headerMessageGasCost = 70000;
        messageGasCost = 8790;
        gasLimit = 1000000;
    }

    /**
     * @dev Returns hash of message array.
     */
    function _hashedArray(Message[] calldata messages) private pure returns (bytes32) {
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

    function _callReceiverContract(
        bytes32 schainHash,
        Message calldata message,
        uint counter
    )
        private
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

    /**
     * @dev Converts calldata structure to memory structure and checks
     * whether message BLS signature is valid.
     */
    function _verifyMessages(
        string calldata fromSchainName,
        bytes32 hashedMessages,
        MessageProxyForMainnet.Signature calldata sign
    )
        internal
        view
        returns (bool)
    {
        return ISchains(
            contractManagerOfSkaleManager.getContract("Schains")
        ).verifySchainSignature(
            sign.blsSignature[0],
            sign.blsSignature[1],
            hashedMessages,
            sign.counter,
            sign.hashA,
            sign.hashB,
            fromSchainName
        );
    }
}