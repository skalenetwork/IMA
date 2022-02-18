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

pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../interfaces/IMessageReceiver.sol";
import "../MessageProxy.sol";
import "./bls/SkaleVerifier.sol";
import "./KeyStorage.sol";


contract MessageProxyForSchain is MessageProxy {
    using AddressUpgradeable for address;

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
        bytes32 dstChain;
        uint256 msgCounter;
        address srcContract;
        address dstContract;
        bytes data;
    }

    KeyStorage public keyStorage;
    bytes32 public schainHash;

    //      schainHash  =>      message_id  => MessageData
    mapping(bytes32 => mapping(uint256 => bytes32)) private _outgoingMessageDataHash;
    //      schainHash  => head of unprocessed messages
    mapping(bytes32 => uint) private _idxHead;
    //      schainHash  => tail of unprocessed messages
    mapping(bytes32 => uint) private _idxTail;

    function registerExtraContract(
        string memory chainName,
        address extraContract
    )
        external
        onlyExtraContractRegistrar
    {
        bytes32 chainHash = keccak256(abi.encodePacked(chainName));
        require(chainHash != schainHash, "Schain hash can not be equal Mainnet");
        _registerExtraContract(chainHash, extraContract);
    }

    function removeExtraContract(string memory chainName, address extraContract) external onlyExtraContractRegistrar {
        bytes32 chainHash = keccak256(abi.encodePacked(chainName));
        require(chainHash != schainHash, "Schain hash can not be equal Mainnet");
        _removeExtraContract(chainHash, extraContract);
    }

    function initialize(KeyStorage blsKeyStorage, string memory schainName)
        public
        virtual
        initializer
    {
        MessageProxy.initializeMessageProxy(3e6);
        keyStorage = blsKeyStorage;
        connectedChains[
            MAINNET_HASH
        ] = ConnectedChainInfo(
            0,
            0,
            true
        );
	    schainHash = keccak256(abi.encodePacked(schainName));

        // In predeployed mode all token managers and community locker
        // will be added to registryContracts
    }

    /**
     * This is called by  schain owner.
     * On mainnet, SkaleManager will call it every time a SKALE chain is
     * created. Therefore, any SKALE chain is always connected to the main chain.
     * To connect to other chains, the owner needs to explicitly call this function
     */
    function addConnectedChain(string calldata chainName) external override {
        bytes32 chainHash = keccak256(abi.encodePacked(chainName));
        require(chainHash != schainHash, "Schain cannot connect itself");
        _addConnectedChain(chainHash);
    }

    function removeConnectedChain(string memory chainName) public override onlyChainConnector {
        bytes32 chainHash = keccak256(abi.encodePacked(chainName));
        require(chainHash != MAINNET_HASH, "Mainnet cannot be removed");
        super.removeConnectedChain(chainName);
    }

    // This is called by a smart contract that wants to make a cross-chain call
    function postOutgoingMessage(
        bytes32 targetChainHash,
        address targetContract,
        bytes memory data
    )
        public
        override
    {
        super.postOutgoingMessage(targetChainHash, targetContract, data);

        OutgoingMessageData memory outgoingMessageData = OutgoingMessageData(
            targetChainHash,
            connectedChains[targetChainHash].outgoingMessageCounter - 1,
            msg.sender,
            targetContract,
            data
        );

        bytes32 dstChainHash = outgoingMessageData.dstChain;
        _outgoingMessageDataHash[dstChainHash][_idxTail[dstChainHash]] = _hashOfMessage(outgoingMessageData);
        _idxTail[dstChainHash] += 1;
    }

    function postIncomingMessages(
        string calldata fromChainName,
        uint256 startingCounter,
        Message[] calldata messages,
        Signature calldata signature 
    )
        external
        override
    {
        bytes32 fromChainHash = keccak256(abi.encodePacked(fromChainName));
        require(connectedChains[fromChainHash].inited, "Chain is not initialized");
        require(messages.length <= MESSAGES_LENGTH, "Too many messages");
        require(
            _verifyMessages(_hashedArray(messages, startingCounter, fromChainName), signature),
            "Signature is not verified"
        );
        require(
            startingCounter == connectedChains[fromChainHash].incomingMessageCounter,
            "Starting counter is not qual to incoming message counter");
        for (uint256 i = 0; i < messages.length; i++) {
            _callReceiverContract(fromChainHash, messages[i], startingCounter + 1);
        }
        connectedChains[fromChainHash].incomingMessageCounter += messages.length;
    }

    function verifyOutgoingMessageData(
        OutgoingMessageData memory message
    )
        external
        view
        returns (bool isValidMessage)
    {
        bytes32 messageDataHash = _outgoingMessageDataHash[message.dstChain][message.msgCounter];
        if (messageDataHash == _hashOfMessage(message))
            isValidMessage = true;
    }

    function _hashOfMessage(OutgoingMessageData memory message) private pure returns (bytes32) {
        bytes memory data = abi.encodePacked(
            message.dstChain,
            bytes32(message.msgCounter),
            bytes32(bytes20(message.srcContract)),
            bytes32(bytes20(message.dstContract)),
            message.data
        );
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
            keyStorage.getBlsCommonPublicKey()
        );
    }
}
