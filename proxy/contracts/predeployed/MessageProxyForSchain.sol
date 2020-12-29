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

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "./SkaleFeatures.sol";

interface ContractReceiverForSchain {
    function postMessage(
        address sender,
        string calldata schainID,
        address to,
        uint256 amount,
        bytes calldata data
    )
        external;
}


contract MessageProxyForSchain {
    using SafeMath for uint256;


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
        // BLS key is null for main chain, and not null for schains
        uint256[4] publicKey;
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

    bool public mainnetConnected;
    // Owner of this chain. For mainnet, the owner is SkaleManager
    address public ownerAddress;
    string private _chainID;
    bool private _isCustomDeploymentMode;

    mapping(bytes32 => ConnectedChainInfo) public connectedChains;
    mapping(address => bool) private _authorizedCaller;
    //      chainID  =>      message_id  => MessageData
    mapping( bytes32 => mapping( uint256 => OutgoingMessageData )) private _outgoingMessageData;
    //      chainID  => head of unprocessed messages
    mapping( bytes32 => uint ) private _idxHead;
    //      chainID  => tail of unprocessed messages
    mapping( bytes32 => uint ) private _idxTail;

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

    modifier connectMainnet() {
        if (!mainnetConnected) {
            connectedChains[
                keccak256(abi.encodePacked("Mainnet"))
            ] = ConnectedChainInfo(
                [
                    uint256(0),
                    uint256(0),
                    uint256(0),
                    uint256(0)
                ],
                0,
                0,
                true
            );
            mainnetConnected = true;
        }
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == getOwner(), "Sender is not an owner");
        _;
    }

    /// Create a new message proxy

    constructor(string memory newChainID) public {
        _isCustomDeploymentMode = true;
        ownerAddress = msg.sender;
        _authorizedCaller[msg.sender] = true;
        _chainID = newChainID;
        if (keccak256(abi.encodePacked(newChainID)) !=
            keccak256(abi.encodePacked("Mainnet"))
        ) {
            connectedChains[
                keccak256(abi.encodePacked("Mainnet"))
            ] = ConnectedChainInfo(
                [
                    uint256(0),
                    uint256(0),
                    uint256(0),
                    uint256(0)
                ],
                0,
                0,
                true
            );
            mainnetConnected = true;
        }
    }

    function addAuthorizedCaller(address caller) external onlyOwner {
        _authorizedCaller[caller] = true;
    }

    function removeAuthorizedCaller(address caller) external onlyOwner {
        _authorizedCaller[caller] = false;
    }

    // Registration state detection
    function isConnectedChain(
        string calldata someChainID
    )
        external
        view
        returns (bool)
    {
        if ( ! connectedChains[keccak256(abi.encodePacked(someChainID))].inited ) {
            return false;
        }
        return true;
    }

    /**
     * This is called by  schain owner.
     * On mainnet, SkaleManager will call it every time a SKALE chain is
     * created. Therefore, any SKALE chain is always connected to the main chain.
     * To connect to other chains, the owner needs to explicitly call this function
     */
    function addConnectedChain(
        string calldata newChainID,
        uint256[4] calldata newPublicKey
    )
        external
        connectMainnet
    {
        if ( keccak256(abi.encodePacked(newChainID)) ==
            keccak256(abi.encodePacked("Mainnet")) )
            return;
        require(isAuthorizedCaller(keccak256(abi.encodePacked(newChainID)), msg.sender), "Not authorized caller");

        require(
            !connectedChains[keccak256(abi.encodePacked(newChainID))].inited,
            "Chain is already connected"
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

    function removeConnectedChain(string calldata newChainID) external onlyOwner {
        require(
            keccak256(abi.encodePacked(newChainID)) !=
            keccak256(abi.encodePacked("Mainnet")),
            "New chain id can not be equal Mainnet"
        );
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
        connectedChains[dstChainHash].outgoingMessageCounter
            = connectedChains[dstChainHash].outgoingMessageCounter.add(1);
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

    function getOutgoingMessagesCounter(string calldata dstChainID)
        external
        view
        returns (uint256)
    {
        bytes32 dstChainHash = keccak256(abi.encodePacked(dstChainID));

        if ( !connectedChains[dstChainHash].inited )
            return 0;

        return connectedChains[dstChainHash].outgoingMessageCounter;
    }

    function getIncomingMessagesCounter(string calldata srcChainID)
        external
        view
        returns (uint256)
    {
        bytes32 srcChainHash = keccak256(abi.encodePacked(srcChainID));

        if ( !connectedChains[srcChainHash].inited )
            return 0;

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
        connectMainnet
    {
        bytes32 srcChainHash = keccak256(abi.encodePacked(srcChainID));
        require(isAuthorizedCaller(srcChainHash, msg.sender), "Not authorized caller");
        require(connectedChains[srcChainHash].inited, "Chain is not initialized");
        require(
            startingCounter == connectedChains[srcChainHash].incomingMessageCounter,
            "Starting counter is not qual to incoming message counter");
        for (uint256 i = 0; i < messages.length; i++) {
            try ContractReceiverForSchain(messages[i].destinationContract).postMessage(
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
        connectedChains[srcChainHash].incomingMessageCounter 
            = connectedChains[srcChainHash].incomingMessageCounter.add(uint256(messages.length));
        _popOutgoingMessageData(srcChainHash, idxLastToPopNotIncluding);
    }

    function moveIncomingCounter(string calldata schainName) external onlyOwner {
        connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter =
            connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter.add(1);
    }

    function setCountersToZero(string calldata schainName) external onlyOwner {
        connectedChains[keccak256(abi.encodePacked(schainName))].incomingMessageCounter = 0;
        connectedChains[keccak256(abi.encodePacked(schainName))].outgoingMessageCounter = 0;
    }

    function getChainID() public view returns (string memory) {
        if (!_isCustomDeploymentMode) {
            if ((keccak256(abi.encodePacked(_chainID))) == (keccak256(abi.encodePacked(""))) )
                return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableString(
                    "skaleConfig.sChain.schainName"
                );
        }
        return _chainID;
    }

    function getOwner() public view returns (address) {
        if (!_isCustomDeploymentMode) {
            if ((ownerAddress) == (address(0)) )
                return SkaleFeatures(getSkaleFeaturesAddress()).getConfigVariableAddress(
                    "skaleConfig.contractSettings.IMA.ownerAddress"
                );
        }
        return ownerAddress;
    }

    function setOwner(address newAddressOwner) public onlyOwner {
        ownerAddress = newAddressOwner;
    }

    function isAuthorizedCaller(bytes32 , address a) public view returns (bool) {
        if (_authorizedCaller[a] )
            return true;
        if (_isCustomDeploymentMode)
            return false;
        uint256 u = SkaleFeatures(getSkaleFeaturesAddress()).getConfigPermissionFlag(
            a, "skaleConfig.contractSettings.IMA.variables.MessageProxy.mapAuthorizedCallers"
        );
        if ( u != 0 )
            return true;
        return false;
    }

    function verifyOutgoingMessageData(
        string memory chainName,
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
        bytes32 chainId = keccak256(abi.encodePacked(chainName));
        isValidMessage = false;
        OutgoingMessageData memory d = _outgoingMessageData[chainId][idxMessage];
        if ( d.dstContract == destinationContract &&
             d.srcContract == sender &&
             d.to == to && 
             d.amount == amount &&
             keccak256(abi.encodePacked(d.dstChain)) == chainId &&
             d.dstChainHash == chainId
        )
            isValidMessage = true;
    }

    function getSkaleFeaturesAddress() public view returns (address) {
        return 0xC033b369416c9Ecd8e4A07AaFA8b06b4107419E2;
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
        _outgoingMessageData[d.dstChainHash][_idxTail[d.dstChainHash]] = d;
        _idxTail[d.dstChainHash] = _idxTail[d.dstChainHash].add(1);
    }

    /**
     * @dev Pop outgoing message from outgoingMessageData array.
     */
    function _popOutgoingMessageData(
        bytes32 chainId,
        uint256 idxLastToPopNotIncluding
    )
        private
        returns ( uint256 cntDeleted )
    {
        cntDeleted = 0;
        uint idxTail = _idxTail[chainId];
        for ( uint256 i = _idxHead[chainId]; i < idxLastToPopNotIncluding; ++ i ) {
            if ( i >= idxTail )
                break;
            delete _outgoingMessageData[chainId][i];
            ++ cntDeleted;
        }
        if (cntDeleted > 0)
            _idxHead[chainId] = _idxHead[chainId].add(cntDeleted);
    }
}
