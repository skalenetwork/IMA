/**
 *   MessageProxy.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2019-Present SKALE Labs
 *   @author Artem Payvin
 *
 *   SKALE-IMA is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU Affero General Public License as published
 *   by the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *
 *   SKALE-IMA is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU Affero General Public License for more details.
 *
 *   You should have received a copy of the GNU Affero General Public License
 *   along with SKALE-IMA.  If not, see <https://www.gnu.org/licenses/>.
 */

pragma solidity ^0.5.3;
pragma experimental ABIEncoderV2;

interface ContractReceiver {
    function postMessage(
        address sender,
        string calldata schainID,
        address to,
        uint amount,
        bytes calldata data
    )
        external;
}


contract MessageProxy {

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

    mapping(address => bool) public authorizedCaller;

    event OutgoingMessage(
        string dstChain,
        bytes32 indexed dstChainHash,
        uint indexed msgCounter,
        address indexed srcContract,
        address dstContract,
        //bytes4 functionSignature,
        //uint  maxGas,
        //bytes32[] concatenatedParameters
        address to,
        uint amount,
        bytes data,
        uint length
    );

    struct ConnectedChainInfo {
        // BLS key is null for main chain, and not null for schains
        uint[4] publicKey;
        // message counters start with 0
        uint incomingMessageCounter;
        uint outgoingMessageCounter;
        bool inited;
    }

    struct Message {
        address sender;
        address destinationContract;
        address to;
        uint amount;
        bytes data;
        // uint[2] blsSignature
    }

    mapping(bytes32 => ConnectedChainInfo) public connectedChains;

    /// Create a new message proxy

    constructor(string memory newChainID) public {
        owner = msg.sender;
        authorizedCaller[msg.sender] = true;
        chainID = newChainID;
        if (keccak256(abi.encodePacked(newChainID)) !=
            keccak256(abi.encodePacked("Mainnet"))
        ) {
            // connect to mainnet by default
            // Mainnet does not have a public key
            uint[4] memory empty = [
                uint(0),
                0,
                0,
                0];
            connectedChains[
                keccak256(abi.encodePacked("Mainnet"))
            ] = ConnectedChainInfo(
                empty,
                0,
                0,
                true);
        }
    }

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
        uint[4] calldata newPublicKey
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
            "Chain is aready connected"
        );
        connectedChains[
            keccak256(abi.encodePacked(newChainID))
        ] = ConnectedChainInfo({
            publicKey: newPublicKey,
            incomingMessageCounter: 0,
            outgoingMessageCounter: 0,
            inited: true
        });
    }

    function removeConnectedChain(string calldata newChainID) external {
        require(msg.sender == owner, "Sender is not an owner");
        require(
            keccak256(abi.encodePacked(newChainID)) !=
            keccak256(abi.encodePacked("Mainnet")),
            "New chain id can not be equal Mainnet"
        ); // you cannot remove a connection to main net
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
        uint amount,
        address to,
        bytes calldata data
    )
        external
    {
        bytes32 dstChainHash = keccak256(abi.encodePacked(dstChainID));
        require(connectedChains[dstChainHash].inited, "Destination chain is not initialized");
        connectedChains[dstChainHash].outgoingMessageCounter++;
        emit OutgoingMessage(
            dstChainID,
            dstChainHash,
            connectedChains[dstChainHash].outgoingMessageCounter - 1,
            msg.sender,
            dstContract,
            to,
            amount,
            data,
            data.length
        );
    }

    function postIncomingMessages(
        string calldata srcChainID,
        uint startingCounter,
        Message[] calldata messages
    )
        external
    {
        require(authorizedCaller[msg.sender], "Not authorized caller");
        bytes32 srcChainHash = keccak256(abi.encodePacked(srcChainID));
        require(connectedChains[srcChainHash].inited, "Chain is not initialized");
        require(
            startingCounter == connectedChains[srcChainHash].incomingMessageCounter,
            "Starning counter is not qual to incomin message counter");

        // TODO: Calculate hash and verify BLS signature on hash

        for (uint i = 0; i < messages.length; i++) {
            ContractReceiver(messages[i].destinationContract).postMessage(
                messages[i].sender,
                srcChainID,
                messages[i].to,
                messages[i].amount,
                messages[i].data
            );
        }
        connectedChains[srcChainHash].incomingMessageCounter += uint(messages.length);
    }

    function getOutgoingMessagesCounter(string calldata dstChainID)
        external
        view
        returns (uint)
    {
        bytes32 dstChainHash = keccak256(abi.encodePacked(dstChainID));
        require(connectedChains[dstChainHash].inited, "Destination chain is not initialized");
        return connectedChains[dstChainHash].outgoingMessageCounter;
    }

    function getIncomingMessagesCounter(string calldata srcChainID)
        external
        view
        returns (uint)
    {
        bytes32 srcChainHash = keccak256(abi.encodePacked(srcChainID));
        require(connectedChains[srcChainHash].inited, "Source chain is not initialized");
        return connectedChains[srcChainHash].incomingMessageCounter;
    }
}
