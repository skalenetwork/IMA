// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessageProxyForSchain.sol - SKALE Interchain Messaging Agent
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

import "./bls/FieldOperations.sol";
import "./bls/SkaleVerifier.sol";
import "./SkaleFeaturesClient.sol";
import "hardhat/console.sol";

interface IContractReceiverForSchain {
    function postMessage(
        bytes32 fromChainHash,
        address sender,
        bytes calldata data
    )
        external
        returns (bool);
}


contract MessageProxyForSchain is SkaleFeaturesClient {

    using SafeMath for uint;

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

    struct OutgoingMessageData {
        string dstChain;
        uint256 msgCounter;
        address srcContract;
        address dstContract;
        bytes data;
    }

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

    bytes32 public constant DEBUGGER_ROLE = keccak256("DEBUGGER_ROLE");
    bytes32 public constant CHAIN_CONNECTOR_ROLE = keccak256("CHAIN_CONNECTOR_ROLE");
    bytes32 public constant EXTRA_CONTRACT_REGISTRAR_ROLE = keccak256("EXTRA_CONTRACT_REGISTRAR_ROLE");

    bool public mainnetConnected;
    bytes32 public schainHash;

    mapping(bytes32 => ConnectedChainInfo) public connectedChains;
    //      schainHash  =>      message_id  => MessageData
    mapping(bytes32 => mapping(uint256 => bytes32)) private _outgoingMessageDataHash;
    //      schainHash  => head of unprocessed messages
    mapping(bytes32 => uint) private _idxHead;
    //      schainHash  => tail of unprocessed messages
    mapping(bytes32 => uint) private _idxTail;

    mapping( bytes32 => mapping( address => bool) ) public registryContracts;

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

    modifier onlyDebugger() {
        require(hasRole(DEBUGGER_ROLE, msg.sender), "DEBUGGER_ROLE is required");
        _;
    }

    modifier onlyChainConnector() {
        require(hasRole(CHAIN_CONNECTOR_ROLE, msg.sender), "CHAIN_CONNECTOR_ROLE is required");
        _;
    }

    modifier onlyExtraContractRegistrar() {
        require(hasRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender), "EXTRA_CONTRACT_REGISTRAR_ROLE is required");
        _;
    }

    /// Create a new message proxy

    constructor(string memory schainName) public {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        connectedChains[
            keccak256(abi.encodePacked("Mainnet"))
        ] = ConnectedChainInfo(
            0,
            0,
            true
        );
        mainnetConnected = true;
        schainHash = keccak256(abi.encodePacked(schainName));
    }

    // Registration state detection
    function isConnectedChain(
        string calldata schainName
    )
        external
        view
        returns (bool)
    {
        return connectedChains[keccak256(abi.encodePacked(schainName))].inited;
    }

    /**
     * This is called by  schain owner.
     * On mainnet, SkaleManager will call it every time a SKALE chain is
     * created. Therefore, any SKALE chain is always connected to the main chain.
     * To connect to other chains, the owner needs to explicitly call this function
     */
    function addConnectedChain(
        string calldata newSchainName
    )
        external
        onlyChainConnector
    {
        bytes32 newSchainHash = keccak256(abi.encodePacked(newSchainName));
        require(newSchainHash != schainHash, "Schain cannot connect itself");
        require(
            !connectedChains[newSchainHash].inited,
            "Chain is already connected"
        );
        connectedChains[newSchainHash] = ConnectedChainInfo({
            incomingMessageCounter: 0,
            outgoingMessageCounter: 0,
            inited: true
        });
    }

    function removeConnectedChain(string calldata schainName) external onlyChainConnector {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")),
            "New chain hash cannot be equal to Mainnet"
        );
        require(
            connectedChains[schainHash].inited,
            "Chain is not initialized"
        );
        delete connectedChains[schainHash];
    }

    // This is called by a smart contract that wants to make a cross-chain call
    function postOutgoingMessage(
        string calldata targetChainName,
        address dstContract,
        bytes calldata data
    )
        external
    {
        bytes32 targetChainHash = keccak256(abi.encodePacked(targetChainName));
        require(connectedChains[targetChainHash].inited, "Destination chain is not initialized");
        require(registryContracts[targetChainHash][msg.sender], "Sender contract is not registered");
        connectedChains[targetChainHash].outgoingMessageCounter
            = connectedChains[targetChainHash].outgoingMessageCounter.add(1);
        _pushOutgoingMessageData(
            OutgoingMessageData(
                targetChainName,
                connectedChains[targetChainHash].outgoingMessageCounter - 1,
                msg.sender,
                dstContract,
                data
            )
        );
    }

    function postIncomingMessages(
        string calldata fromChainName,
        uint256 startingCounter,
        Message[] calldata messages,
        Signature calldata signature,
        uint256 idxLastToPopNotIncluding
    )
        external
    {
        bytes32 fromChainHash = keccak256(abi.encodePacked(fromChainName));
        require(_verifyMessages(_hashedArray(messages), signature), "Signature is not verified");
        require(connectedChains[fromChainHash].inited, "Chain is not initialized");
        require(
            startingCounter == connectedChains[fromChainHash].incomingMessageCounter,
            "Starting counter is not qual to incoming message counter");
        for (uint256 i = 0; i < messages.length; i++) {
            if (!registryContracts[fromChainHash][messages[i].destinationContract]) {
                emit PostMessageError(
                    startingCounter + i,
                    bytes("Destination contract is not registered")
                );
                continue;
            } else {
                _callReceiverContract(fromChainHash, messages[i], startingCounter + 1);
            }
        }
        connectedChains[fromChainHash].incomingMessageCounter 
            = connectedChains[fromChainHash].incomingMessageCounter.add(uint256(messages.length));
        _popOutgoingMessageData(fromChainHash, idxLastToPopNotIncluding);
    }

    function moveIncomingCounter(string calldata schainName) external onlyDebugger {
        connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter =
            connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter.add(1);
    }

    function setCountersToZero(string calldata schainName) external onlyDebugger {
        connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter = 0;
        connectedChains[keccak256(abi.encodePacked(schainName))].outgoingMessageCounter = 0;
    }

    function registerExtraContract(string calldata schainName, address contractOnSchain)
        external
        virtual
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            hasRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender) ||
            _isSchainOwner(msg.sender),
            "Not enough permissions to register extra contract"
        );
        require(contractOnSchain.isContract(), "Given address is not a contract");
        require(!registryContracts[schainHash][contractOnSchain], "Extra contract is already registered");
        registryContracts[schainHash][contractOnSchain] = true;
    }

    function removeExtraContract(
        string calldata schainName,
        address contractOnSchain
    ) 
        external
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            hasRole(EXTRA_CONTRACT_REGISTRAR_ROLE, msg.sender) ||
            _isSchainOwner(msg.sender),
            "Not enough permissions to remove extra contract"
        );
        require(contractOnSchain.isContract(),"Given address is not a contract");
        require(registryContracts[schainHash][contractOnSchain], "Extra contract is already removed");
        delete registryContracts[keccak256(abi.encodePacked(schainName))][contractOnSchain];
    }

    function getOutgoingMessagesCounter(string calldata targetSchainName)
        external
        view
        returns (uint256)
    {
        bytes32 dstChainHash = keccak256(abi.encodePacked(targetSchainName));

        if (!connectedChains[dstChainHash].inited)
            return 0;

        return connectedChains[dstChainHash].outgoingMessageCounter;
    }

    function getIncomingMessagesCounter(string calldata fromSchainName)
        external
        view
        returns (uint256)
    {
        bytes32 srcChainHash = keccak256(abi.encodePacked(fromSchainName));

        if (!connectedChains[srcChainHash].inited)
            return 0;

        return connectedChains[srcChainHash].incomingMessageCounter;
    }

    function verifyOutgoingMessageData(
        OutgoingMessageData memory message
    )
        public
        view
        returns (bool isValidMessage)
    {
        bytes32 schainHash = keccak256(abi.encodePacked(message.dstChain));
        bytes32 messageDataHash = _outgoingMessageDataHash[schainHash][message.msgCounter];
        if (messageDataHash == _hashOfMessage(message))
            isValidMessage = true;
    }

    function _callReceiverContract(
        bytes32 fromChainHash,
        Message calldata message,
        uint counter
    )
        private
        returns (bool)
    {
        try IContractReceiverForSchain(message.destinationContract).postMessage(
            fromChainHash,
            message.sender,
            message.data
        ) returns (bool success) {
            return success;
        } catch Error(string memory reason) {
            emit PostMessageError(
                counter,
                bytes(reason)
            );
            return false;
        } catch (bytes memory revertData) {
            emit PostMessageError(
                counter,
                revertData
            );
            return false;
        }
    }

    function _hashOfMessage(OutgoingMessageData memory message) private pure returns (bytes32) {
        bytes memory data = abi.encodePacked(
            bytes32(keccak256(abi.encodePacked(message.dstChain))),
            bytes32(message.msgCounter),
            bytes32(bytes20(message.srcContract)),
            bytes32(bytes20(message.dstContract)),
            message.data
        );
        return keccak256(data);
    }

    function _pushOutgoingMessageData(OutgoingMessageData memory d) private {
        bytes32 dstChainHash = keccak256(abi.encodePacked(d.dstChain));
        emit OutgoingMessage(
            dstChainHash,
            d.msgCounter,
            d.srcContract,
            d.dstContract,
            d.data
        );
        _outgoingMessageDataHash[dstChainHash][_idxTail[dstChainHash]] = _hashOfMessage(d);
        _idxTail[dstChainHash] = _idxTail[dstChainHash].add(1);
    }

    /**
     * @dev Pop outgoing message from outgoingMessageData array.
     */
    function _popOutgoingMessageData(
        bytes32 schainHash,
        uint256 idxLastToPopNotIncluding
    )
        private
        returns (uint256 cntDeleted)
    {
        cntDeleted = 0;
        uint idxTail = _idxTail[schainHash];
        for (uint256 i = _idxHead[schainHash]; i < idxLastToPopNotIncluding; ++ i ) {
            if (i >= idxTail)
                break;
            delete _outgoingMessageDataHash[schainHash][i];
            ++ cntDeleted;
        }
        if (cntDeleted > 0)
            _idxHead[schainHash] = _idxHead[schainHash].add(cntDeleted);
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

    /**
     * @dev Converts calldata structure to memory structure and checks
     * whether message BLS signature is valid.
     * Returns true if signature is valid
     */
    function _verifyMessages(
        bytes32 hashedMessages,
        MessageProxyForSchain.Signature calldata signature
    )
        internal
        view
        virtual
        returns (bool)
    {
        return SkaleVerifier.verify(
            Fp2Operations.Fp2Point({
                a: signature.blsSignature[0],
                b: signature.blsSignature[1]
            }),
            hashedMessages,
            signature.counter,
            signature.hashA,
            signature.hashB,
            _getBlsCommonPublicKey()
        );
    }

    /**
     * @dev Checks whether sender is owner of SKALE chain
     */
    function _isSchainOwner(address sender) internal view returns (bool) {
        return sender == getSkaleFeatures().getConfigVariableAddress(
            "skaleConfig.contractSettings.IMA.ownerAddress"
        );
    }

    function _getBlsCommonPublicKey() private view returns (G2Operations.G2Point memory) {
        SkaleFeatures skaleFeature = getSkaleFeatures();
        return G2Operations.G2Point({
            x: Fp2Operations.Fp2Point({
                a: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey0"),
                b: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey1")
            }),
            y: Fp2Operations.Fp2Point({
                a: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey2"),
                b: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey3")
            })
        });
    }
}
