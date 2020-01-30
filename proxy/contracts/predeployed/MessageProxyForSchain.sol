/**
 *   MessageProxyForSchain.sol - SKALE Interchain Messaging Agent
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

import "./SkaleFeatures.sol";

interface ContractReceiverForSchain {
    function postMessage(
        address sender,
        string calldata schainID,
        address to,
        uint amount,
        bytes calldata data
    )
        external;
}


contract MessageProxyForSchain {

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
    string private chainID_; // l_sergiy: changed name _ and made private

    // Owner of this chain. For mainnet, the owner is SkaleManager
    address public ownerAddress; // l_sergiy: changed name to ownerAddress

    bool mainnetConnected = false;

    mapping(address => bool) private authorizedCaller_; // l_sergiy: changed name _ and made private

    event OutgoingMessage(
        string dstChain,
        bytes32 indexed dstChainHash,
        uint indexed msgCounter,
        address indexed srcContract,
        address dstContract,
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
    }

    mapping(bytes32 => ConnectedChainInfo) public connectedChains;

    modifier connectMainnet() {
        if (!mainnetConnected) {
            connectedChains[
                keccak256(abi.encodePacked("Mainnet"))
            ] = ConnectedChainInfo(
                [
                    uint(0),
                    uint(0),
                    uint(0),
                    uint(0)
                ],
                0,
                0,
                true);
            mainnetConnected = true;
            // string memory newChainID;
            // address newOwner;
            // uint length;
            // assembly {
            //     newChainID := sload(0x00)
            //     newOwner := sload(0x01)
            //     length := sload(0x02)
            // }
            // chainID_ = newChainID;

            // // l_sergiy: owner can be changed only via contract OwnableForSchain -> transferOwnership()
            // setOwner(newOwner);

            // address callerAddr;
            // bytes1 index = 0x03;
            // for (uint i = 0; i < length; i++) {
            //     assembly {
            //         callerAddr := sload(add(index, i))
            //     }
            //     authorizedCaller_[callerAddr] = true;
            // }
        }
        _;
    }

    /// Create a new message proxy

    function addAuthorizedCaller(address caller) external {
        require(msg.sender == getOwner(), "Sender is not an owner");
        authorizedCaller_[caller] = true;
    }

    function removeAuthorizedCaller(address caller) external {
        require(msg.sender == getOwner(), "Sender is not an owner");
        authorizedCaller_[caller] = false;
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
        //require(authorizedCaller[msg.sender], "Not authorized caller");
        require(checkIsAuthorizedCaller(msg.sender), "Not authorized caller"); // l_sergiy: replacement

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
        require(msg.sender == getOwner(), "Sender is not an owner");
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

    function getOutgoingMessagesCounter(string calldata dstChainID)
        external
        view
        returns (uint)
    {
        bytes32 dstChainHash = keccak256(abi.encodePacked(dstChainID));

        //require(connectedChains[dstChainHash].inited, "Destination chain is not initialized");
        if( !connectedChains[dstChainHash].inited )
            return 0;

        return connectedChains[dstChainHash].outgoingMessageCounter;
    }

    function getIncomingMessagesCounter(string calldata srcChainID)
        external
        view
        returns (uint)
    {
        SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).logTrace( "--- MessageProxyForSchain --- getIncomingMessagesCounter --- 1" );

        bytes32 srcChainHash = keccak256(abi.encodePacked(srcChainID));

        //require(connectedChains[srcChainHash].inited, "Source chain is not initialized");
        if( !connectedChains[srcChainHash].inited )
            return 0;

        SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).logTrace( "--- MessageProxyForSchain --- getIncomingMessagesCounter --- 2" );

        return connectedChains[srcChainHash].incomingMessageCounter;
    }

    function postIncomingMessages(
        string calldata srcChainID,
        uint startingCounter,
        Message[] calldata messages,
        uint[2] calldata blsSignature,
        uint hashA,
        uint hashB,
        uint counter
    )
        external
        connectMainnet
    {
        SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).logTrace( "--- MessageProxyForSchain --- postIncomingMessages --- begin" );

        //require(authorizedCaller[msg.sender], "Not authorized caller");
        require(checkIsAuthorizedCaller(msg.sender), "Not authorized caller"); // l_sergiy: replacement

        SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).logTrace( "--- MessageProxyForSchain --- postIncomingMessages --- 2" );

        require(connectedChains[keccak256(abi.encodePacked(srcChainID))].inited, "Chain is not initialized");

        SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).logTrace( "--- MessageProxyForSchain --- postIncomingMessages --- 3" );

        require(
            startingCounter == connectedChains[keccak256(abi.encodePacked(srcChainID))].incomingMessageCounter,
            "Starting counter is not qual to incoming message counter");

        SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).logTrace( "--- MessageProxyForSchain --- postIncomingMessages --- 4" );

        // if (keccak256(abi.encodePacked(chainID)) == keccak256(abi.encodePacked("Mainnet"))) {
        //     Message[] memory input = new Message[](messages.length);
        //     for (uint i = 0; i < messages.length; i++) {
        //         input[i].sender = messages[i].sender;
        //         input[i].destinationContract = messages[i].destinationContract;
        //         input[i].to = messages[i].to;
        //         input[i].amount = messages[i].amount;
        //         input[i].data = messages[i].data;
        //     }
        //     require(
        //         verifyMessageSignature(
        //             blsSignature,
        //             hashedArray(input),
        //             counter,
        //             hashA,
        //             hashB,
        //             srcChainID
        //         ), "Signature is not verified"
        //     );
        // }

        for (uint i = 0; i < messages.length; i++) {
            ContractReceiverForSchain(messages[i].destinationContract).postMessage(
                messages[i].sender,
                srcChainID,
                messages[i].to,
                messages[i].amount,
                messages[i].data
            );
        }
        connectedChains[keccak256(abi.encodePacked(srcChainID))].incomingMessageCounter += uint(messages.length);
    }

    function moveIncomingCounter(string calldata schainName) external {
        require(msg.sender == getOwner(), "Sender is not an owner");
        connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter++;
    }

    function setCountersToZero(string calldata schainName) external {
        require(msg.sender == getOwner(), "Sender is not an owner");
        connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter = 0;
        connectedChains[keccak256(abi.encodePacked(schainName))].outgoingMessageCounter = 0;
    }

    // function verifyMessageSignature(
    //     uint[2] memory blsSignature,
    //     bytes32 hash,
    //     uint counter,
    //     uint hashA,
    //     uint hashB,
    //     string memory srcChainID
    // )
    //     internal
    //     view
    //     returns (bool)
    // {
    //     address skaleVerifierAddress = IContractManagerSkaleManager(contractManagerSkaleManager).contracts(
    //         keccak256(abi.encodePacked("SkaleVerifier"))
    //     );
    //     return ISkaleVerifier(skaleVerifierAddress).verifySchainSignature(
    //         blsSignature[0],
    //         blsSignature[1],
    //         hash,
    //         counter,
    //         hashA,
    //         hashB,
    //         srcChainID
    //     );
    // }

    function getChainID() public view returns ( string memory cID ) { // l_sergiy: added
        if ((keccak256(abi.encodePacked(chainID_))) == (keccak256(abi.encodePacked(""))) )
            return SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).getConfigVariableString("skaleConfig.sChain.schainID");
        return chainID_;
    }

    function getOwner() public view returns ( address ow ) { // l_sergiy: added
        if ((ownerAddress) == (address(0)) )
            return SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).getConfigVariableAddress("skaleConfig.contractSettings.IMA.ownerAddress");
        return ownerAddress;
    }

    function setOwner( address newAddressOwner ) public {
        ownerAddress = newAddressOwner;
    }

    function hashedArray(Message[] memory messages) internal pure returns (bytes32) {
        bytes memory data;
        for (uint i = 0; i < messages.length; i++) {
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

    function addr2str( address a ) private pure returns ( string memory ) { // l_sergiy: added
        bytes memory b = new bytes(20);
        for (uint i = 0; i < 20; i++) {
            b[i] = byte(uint8(uint(a) / (2**(8*(19 - i)))));
        }
        return string(b);
    }

    function checkIsAuthorizedCaller( address a ) private view returns ( bool rv ) { // l_sergiy: added
        if (authorizedCaller_[msg.sender] )
            return true;
        string memory strVarName = SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).
            concatenateStrings("skaleConfig.contractSettings.IMA.variables.MessageProxyForSchain.mapAuthorizedCallers.0x", addr2str(a));
        uint256 u = SkaleFeatures(0x00c033b369416c9ecd8e4a07aafa8b06b4107419e2).getConfigVariableUint256(strVarName);
        if (u != 0 )
            return true;
        return false;
    }

}
