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

pragma solidity ^0.6.10;
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

    // Note: this uses assembly example from

    // https://ethereum.stackexchange.com/questions/6354/how-do-i-construct-a-call-to-another-contract-using-inline-assembly

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
    string public chainID;
    // Owner of this chain. For mainnet, the owner is SkaleManager
    address public owner;

    address public contractManagerSkaleManager;

    mapping(address => bool) public authorizedCaller;

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

    mapping(bytes32 => ConnectedChainInfo) public connectedChains;

    mapping ( uint256 => OutgoingMessageData ) private outgoingMessageData;
    uint256 private idxHead;
    uint256 private idxTail;

    function addAuthorizedCaller(address caller) external {
        require(msg.sender == owner, "Sender is not an owner");
        authorizedCaller[caller] = true;
    }

    function removeAuthorizedCaller(address caller) external {
        require(msg.sender == owner, "Sender is not an owner");
        authorizedCaller[caller] = false;
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

    // This is called by  schain owner.
    // On mainnet, SkaleManager will call it every time a SKALE chain is
    // created. Therefore, any SKALE chain is always connected to the main chain.
    // To connect to other chains, the owner needs to explicitly call this function
    function addConnectedChain(
        string calldata newChainID,
        uint256[4] calldata newPublicKey
    )
        external
    {
        require(authorizedCaller[msg.sender], "Not authorized caller");

        require(
            keccak256(abi.encodePacked(newChainID)) !=
            keccak256(abi.encodePacked("Mainnet")), "SKALE chain name is incorrect. Inside in MessageProxy");

        // main net does not have a public key and is implicitly connected
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
        require(msg.sender == owner, "Sender is not an owner");

        // require(
        //     keccak256(abi.encodePacked(newChainID)) !=
        //     keccak256(abi.encodePacked("Mainnet")),
        //     "New chain id can not be equal Mainnet"
        //     ); // you cannot remove a connection to main net

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
        pushOutgoingMessageData(
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

    function postIncomingMessages(
        string calldata srcChainID,
        uint256 startingCounter,
        Message[] calldata messages,
        Signature calldata sign,
        uint256 idxLastToPopNotIncluding
    )
        external
    {
        require(authorizedCaller[msg.sender], "Not authorized caller");
        require(connectedChains[keccak256(abi.encodePacked(srcChainID))].inited, "Chain is not initialized");
        require(
            startingCounter == connectedChains[keccak256(abi.encodePacked(srcChainID))].incomingMessageCounter,
            "Starning counter is not qual to incomin message counter");

        if (keccak256(abi.encodePacked(chainID)) == keccak256(abi.encodePacked("Mainnet"))) {
            Message[] memory input = new Message[](messages.length);
            for (uint256 i = 0; i < messages.length; i++) {
                input[i].sender = messages[i].sender;
                input[i].destinationContract = messages[i].destinationContract;
                input[i].to = messages[i].to;
                input[i].amount = messages[i].amount;
                input[i].data = messages[i].data;
            }

            require(
                verifyMessageSignature(
                    sign.blsSignature,
                    hashedArray(input),
                    sign.counter,
                    sign.hashA,
                    sign.hashB,
                    srcChainID
                ), "Signature is not verified"
            );
        }

        for (uint256 i = 0; i < messages.length; i++) {
            ContractReceiverForMainnet(messages[i].destinationContract).postMessage(
                messages[i].sender,
                srcChainID,
                messages[i].to,
                messages[i].amount,
                messages[i].data
            );
        }
        connectedChains[keccak256(abi.encodePacked(srcChainID))].incomingMessageCounter += uint256(messages.length);

        popOutgoingMessageData(idxLastToPopNotIncluding);
    }

    function moveIncomingCounter(string calldata schainName) external {
        require(msg.sender == owner, "Sender is not an owner");
        connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter++;
    }

    function setCountersToZero(string calldata schainName) external {
        require(msg.sender == owner, "Sender is not an owner");
        connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter = 0;
        connectedChains[keccak256(abi.encodePacked(schainName))].outgoingMessageCounter = 0;
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
        OutgoingMessageData memory d = outgoingMessageData[idxMessage];
        if ( d.dstContract == destinationContract && d.srcContract == sender && d.to == to && d.amount == amount )
            isValidMessage = true;
    }

    function verifyMessageSignature(
        uint256[2] memory blsSignature,
        bytes32 hash,
        uint256 counter,
        uint256 hashA,
        uint256 hashB,
        string memory srcChainID
    )
        internal
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

    function hashedArray(Message[] memory messages) internal pure returns (bytes32) {
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

    function pushOutgoingMessageData( OutgoingMessageData memory d ) internal {
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
        outgoingMessageData[idxTail] = d;
        ++ idxTail;
    }

    function popOutgoingMessageData( uint256 idxLastToPopNotIncluding ) internal returns ( uint256 cntDeleted ) {
        cntDeleted = 0;
        for ( uint256 i = idxHead; i < idxLastToPopNotIncluding; ++ i ) {
            if ( i >= idxTail )
                break;
            delete outgoingMessageData[i];
            ++ cntDeleted;
        }
        if (cntDeleted > 0)
            idxHead += cntDeleted;
    }
}
