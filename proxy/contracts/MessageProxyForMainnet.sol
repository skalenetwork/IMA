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

import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";

interface ContractReceiverForMainnet {
    function postMessage(
        address sender,
        string calldata schainID,
        address to,
        uint256 amount,
        bytes calldata data
    )
        external;
}

interface IContractManagerSkaleManager {
    function contracts(bytes32 contractID) external view returns(address);
}

interface ISchains {
    function verifySchainSignature(
        uint256 signA,
        uint256 signB,
        bytes32 hash,
        uint256 counter,
        uint256 hashA,
        uint256 hashB,
        string calldata schainName
    )
        external
        view
        returns (bool);
}


contract MessageProxyForMainnet is Initializable {

    // 16 Agents
    // Synchronize time with time.nist.gov
    // Every agent checks if it is his time slot
    // Time slots are in increments of 10 seconds
    // At the start of his slot each agent:
    // For each connected schain:
    // Read incoming counter on the dst chain
    // Read outgoing counter on the src chain
    // Calculate the difference outgoing - incoming
    // Call postIncomingMessages function passing (un)signed message array

    // ID of this schain, Chain 0 represents ETH mainnet,

    struct OutgoingMessageData {
        string dstChain;
        bytes32 dstChainHash;
        uint256 msgCounter;
        address srcContract;
        address dstContract;
        address to;
        uint256 amount;
        bytes data;
        uint256 length;
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
        address to;
        uint256 amount;
        bytes data;
    }

    struct Signature {
        uint256[2] blsSignature;
        uint256 hashA;
        uint256 hashB;
        uint256 counter;
    }

    string public chainID;
    // Owner of this chain. For mainnet, the owner is SkaleManager
    address public owner;
    address public contractManagerSkaleManager;
    uint256 private _idxHead;
    uint256 private _idxTail;

    mapping(address => bool) public authorizedCaller;
    mapping(bytes32 => ConnectedChainInfo) public connectedChains;
    mapping ( uint256 => OutgoingMessageData ) private _outgoingMessageData;

    event OutgoingMessage(
        string dstChain,
        bytes32 indexed dstChainHash,
        uint256 indexed msgCounter,
        address indexed srcContract,
        address dstContract,
        address to,
        uint256 amount,
        bytes data,
        uint256 length
    );

    event PostMessageError(
        uint256 indexed msgCounter,
        bytes32 indexed srcChainHash,
        address sender,
        string fromSchainID,
        address to,
        uint256 amount,
        bytes data,
        string message
    );

    function addAuthorizedCaller(address caller) external {
        require(msg.sender == owner, "Sender is not an owner");
        authorizedCaller[caller] = true;
    }

    function removeAuthorizedCaller(address caller) external {
        require(msg.sender == owner, "Sender is not an owner");
        authorizedCaller[caller] = false;
    }

    // This is called by  schain owner.
    // On mainnet, SkaleManager will call it every time a SKALE chain is
    // created. Therefore, any SKALE chain is always connected to the main chain.
    // To connect to other chains, the owner needs to explicitly call this function
    function addConnectedChain(
        string calldata newChainID
    )
        external
    {
        require(authorizedCaller[msg.sender], "Not authorized caller");

        require(
            keccak256(abi.encodePacked(newChainID)) !=
            keccak256(abi.encodePacked("Mainnet")), "SKALE chain name is incorrect. Inside in MessageProxy");

        require(
            !connectedChains[keccak256(abi.encodePacked(newChainID))].inited,
            "Chain is already connected"
        );
        connectedChains[
            keccak256(abi.encodePacked(newChainID))
        ] = ConnectedChainInfo({
            incomingMessageCounter: 0,
            outgoingMessageCounter: 0,
            inited: true
        });
    }

    function removeConnectedChain(string calldata newChainID) external {
        require(authorizedCaller[msg.sender], "Not authorized caller");

        require(
            connectedChains[keccak256(abi.encodePacked(newChainID))].inited,
            "Chain is not initialized"
        );
        delete connectedChains[keccak256(abi.encodePacked(newChainID))];
    }

    // This is called by a smart contract that wants to make a cross-chain call
    function postOutgoingMessage(
        string calldata dstChainID,
        address dstContract,
        uint256 amount,
        address to,
        bytes calldata data
    )
        external
    {
        bytes32 dstChainHash = keccak256(abi.encodePacked(dstChainID));
        require(connectedChains[dstChainHash].inited, "Destination chain is not initialized");
        connectedChains[dstChainHash].outgoingMessageCounter++;
        _pushOutgoingMessageData(
            OutgoingMessageData(
                dstChainID,
                dstChainHash,
                connectedChains[dstChainHash].outgoingMessageCounter - 1,
                msg.sender,
                dstContract,
                to,
                amount,
                data,
                data.length
            )
        );
    }

    function postIncomingMessages(
        string calldata srcChainID,
        uint256 startingCounter,
        Message[] calldata messages,
        Signature calldata sign,
        uint256 idxLastToPopNotIncluding
    )
        external
    {
        bytes32 srcChainHash = keccak256(abi.encodePacked(srcChainID));
        require(authorizedCaller[msg.sender], "Not authorized caller");
        require(connectedChains[srcChainHash].inited, "Chain is not initialized");
        require(
            startingCounter == connectedChains[srcChainHash].incomingMessageCounter,
            "Starning counter is not qual to incomin message counter");

        if (keccak256(abi.encodePacked(chainID)) == keccak256(abi.encodePacked("Mainnet"))) {
            _convertAndVerifyMessages(srcChainID, messages, sign);
        }

        for (uint256 i = 0; i < messages.length; i++) {
            try ContractReceiverForMainnet(messages[i].destinationContract).postMessage(
                messages[i].sender,
                srcChainID,
                messages[i].to,
                messages[i].amount,
                messages[i].data
            ) {
                ++startingCounter;
            } catch Error(string memory reason) {
                emit PostMessageError(
                    ++startingCounter,
                    srcChainHash,
                    messages[i].sender,
                    srcChainID,
                    messages[i].to,
                    messages[i].amount,
                    messages[i].data,
                    reason
                );
            }
        }
        connectedChains[keccak256(abi.encodePacked(srcChainID))].incomingMessageCounter += uint256(messages.length);
        _popOutgoingMessageData(idxLastToPopNotIncluding);
    }

    // Test function - will remove in production
    function moveIncomingCounter(string calldata schainName) external {
        require(msg.sender == owner, "Sender is not an owner");
        connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter++;
    }

    // Test function - will remove in production
    function setCountersToZero(string calldata schainName) external {
        require(msg.sender == owner, "Sender is not an owner");
        connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter = 0;
        connectedChains[keccak256(abi.encodePacked(schainName))].outgoingMessageCounter = 0;
    }

    // Registration state detection
    function isConnectedChain(
        string calldata someChainID
    )
        external
        view
        returns (bool)
    {
        //require(msg.sender == owner); // todo: tmp!!!!!
        require(
            keccak256(abi.encodePacked(someChainID)) !=
            keccak256(abi.encodePacked("Mainnet")),
            "Schain id can not be equal Mainnet"); // main net does not have a public key and is implicitly connected
        if ( ! connectedChains[keccak256(abi.encodePacked(someChainID))].inited ) {
            return false;
        }
        return true;
    }

    function getOutgoingMessagesCounter(string calldata dstChainID)
        external
        view
        returns (uint256)
    {
        bytes32 dstChainHash = keccak256(abi.encodePacked(dstChainID));
        require(connectedChains[dstChainHash].inited, "Destination chain is not initialized");
        return connectedChains[dstChainHash].outgoingMessageCounter;
    }

    function getIncomingMessagesCounter(string calldata srcChainID)
        external
        view
        returns (uint256)
    {
        bytes32 srcChainHash = keccak256(abi.encodePacked(srcChainID));
        require(connectedChains[srcChainHash].inited, "Source chain is not initialized");
        return connectedChains[srcChainHash].incomingMessageCounter;
    }

    /// Create a new message proxy

    function initialize(string memory newChainID, address newContractManager) public initializer {
        owner = msg.sender;
        authorizedCaller[msg.sender] = true;
        chainID = newChainID;
        contractManagerSkaleManager = newContractManager;
    }

    function verifyOutgoingMessageData(
        uint256 idxMessage,
        address sender,
        address destinationContract,
        address to,
        uint256 amount
    )
        public
        view
        returns (bool isValidMessage)
    {
        isValidMessage = false;
        OutgoingMessageData memory d = _outgoingMessageData[idxMessage];
        if ( d.dstContract == destinationContract && d.srcContract == sender && d.to == to && d.amount == amount )
            isValidMessage = true;
    }

    function _convertAndVerifyMessages(
        string calldata srcChainID,
        Message[] calldata messages,
        Signature calldata sign
    )
        internal
    {
        Message[] memory input = new Message[](messages.length);
        for (uint256 i = 0; i < messages.length; i++) {
            input[i].sender = messages[i].sender;
            input[i].destinationContract = messages[i].destinationContract;
            input[i].to = messages[i].to;
            input[i].amount = messages[i].amount;
            input[i].data = messages[i].data;
        }
        require(
            _verifyMessageSignature(
                sign.blsSignature,
                _hashedArray(input),
                sign.counter,
                sign.hashA,
                sign.hashB,
                srcChainID
            ), "Signature is not verified"
        );
    }

    function _verifyMessageSignature(
        uint256[2] memory blsSignature,
        bytes32 hash,
        uint256 counter,
        uint256 hashA,
        uint256 hashB,
        string memory srcChainID
    )
        private
        view
        returns (bool)
    {
        address skaleSchains = IContractManagerSkaleManager(contractManagerSkaleManager).contracts(
            keccak256(abi.encodePacked("Schains"))
        );
        return ISchains(skaleSchains).verifySchainSignature(
            blsSignature[0],
            blsSignature[1],
            hash,
            counter,
            hashA,
            hashB,
            srcChainID
        );
    }

    function _hashedArray(Message[] memory messages) private pure returns (bytes32) {
        bytes memory data;
        for (uint256 i = 0; i < messages.length; i++) {
            data = abi.encodePacked(
                data,
                bytes32(bytes20(messages[i].sender)),
                bytes32(bytes20(messages[i].destinationContract)),
                bytes32(bytes20(messages[i].to)),
                messages[i].amount,
                messages[i].data
            );
        }
        return keccak256(data);
    }

    function _pushOutgoingMessageData( OutgoingMessageData memory d ) private {
        emit OutgoingMessage(
            d.dstChain,
            d.dstChainHash,
            d.msgCounter,
            d.srcContract,
            d.dstContract,
            d.to,
            d.amount,
            d.data,
            d.length
        );
        _outgoingMessageData[_idxTail] = d;
        ++_idxTail;
    }

    function _popOutgoingMessageData( uint256 idxLastToPopNotIncluding ) private returns ( uint256 cntDeleted ) {
        cntDeleted = 0;
        for ( uint256 i = _idxHead; i < idxLastToPopNotIncluding; ++ i ) {
            if ( i >= _idxTail )
                break;
            delete _outgoingMessageData[i];
            ++ cntDeleted;
        }
        if (cntDeleted > 0)
            _idxHead += cntDeleted;
    }
}
