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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@nomiclabs/buidler/console.sol";

import "./bls/SkaleVerifier.sol";
import "./SkaleFeatures.sol";


interface ContractReceiverForSchain {
    function postMessage(
        string calldata schainID,
        address sender,
        address to,
        uint256 amount,
        bytes calldata data
    )
        external
        returns (bool);
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
        uint256 msgCounter;
        address srcContract;
        address dstContract;
        address to;
        uint256 amount;
        bytes data;
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
    address skaleFeaturesAddress;

    mapping(bytes32 => ConnectedChainInfo) public connectedChains;
    mapping(address => bool) private _authorizedCaller;
    //      chainID  =>      message_id  => MessageData
    mapping( bytes32 => mapping( uint256 => bytes32 )) private _outgoingMessageDataHash;
    //      chainID  => head of unprocessed messages
    mapping( bytes32 => uint ) private _idxHead;
    //      chainID  => tail of unprocessed messages
    mapping( bytes32 => uint ) private _idxTail;

    event OutgoingMessage(
        bytes32 indexed dstChainHash,
        uint256 indexed msgCounter,
        address indexed srcContract,
        address dstContract,
        address to,
        uint256 amount,
        bytes data
    );

    event PostMessageError(
        uint256 indexed msgCounter,
        bytes message
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
                connectedChains[dstChainHash].outgoingMessageCounter - 1,
                msg.sender,
                dstContract,
                to,
                amount,
                data
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
        Signature calldata signature,
        uint256 idxLastToPopNotIncluding
    )
        external
        connectMainnet
    {
        bytes32 srcChainHash = keccak256(abi.encodePacked(srcChainID));
        require(_verifyMessages(messages, signature), "Signature is not valid");
        require(connectedChains[srcChainHash].inited, "Chain is not initialized");
        require(
            startingCounter == connectedChains[srcChainHash].incomingMessageCounter,
            "Starting counter is not qual to incoming message counter");
        for (uint256 i = 0; i < messages.length; i++) {
            _callReceiverContract(srcChainID, messages[i], startingCounter + 1);
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

    function setSkaleFeaturesAddress(address newSkaleFeaturesAddress) external onlyOwner {
        skaleFeaturesAddress = newSkaleFeaturesAddress;
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
        OutgoingMessageData memory message
    )
        public
        view
        returns (bool isValidMessage)
    {
        bytes32 chainId = keccak256(abi.encodePacked(message.dstChain));
        bytes32 messageDataHash = _outgoingMessageDataHash[chainId][message.msgCounter];
        if (messageDataHash == _hashOfMessage(message))
            isValidMessage = true;
    }

    function getSkaleFeaturesAddress() public view returns (address) {
        if (skaleFeaturesAddress != address(0)) {
            return skaleFeaturesAddress;
        } else {
            return 0xC033b369416c9Ecd8e4A07AaFA8b06b4107419E2;
        }
    }

    function _callReceiverContract(
        string memory srcChainID,
        Message calldata message,
        uint counter
    )
        private
        returns (bool)
    {
        try ContractReceiverForSchain(message.destinationContract).postMessage(
            srcChainID,
            message.sender,
            message.to,
            message.amount,
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
            bytes32(bytes20(message.to)),
            message.amount,
            message.data
        );
        return keccak256(data);
    }

    function _pushOutgoingMessageData( OutgoingMessageData memory d ) private {
        bytes32 dstChainHash = keccak256(abi.encodePacked(d.dstChain));
        emit OutgoingMessage(
            dstChainHash,
            d.msgCounter,
            d.srcContract,
            d.dstContract,
            d.to,
            d.amount,
            d.data
        );
        _outgoingMessageDataHash[dstChainHash][_idxTail[dstChainHash]] = _hashOfMessage(d);
        _idxTail[dstChainHash] = _idxTail[dstChainHash].add(1);
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
            delete _outgoingMessageDataHash[chainId][i];
            ++ cntDeleted;
        }
        if (cntDeleted > 0)
            _idxHead[chainId] = _idxHead[chainId].add(cntDeleted);
    }

    /**
     * @dev Converts calldata structure to memory structure and checks
     * whether message BLS signature is valid.
     * Returns true if signature is valid
     */
    function _verifyMessages(
        Message[] calldata messages,
        Signature calldata signature
    )
        private
        view
        returns (bool)
    {
        return SkaleVerifier.verify(
            Fp2Operations.Fp2Point({
                a: signature.blsSignature[0],
                b: signature.blsSignature[1]
            }),
            _hashedArray(messages),
            signature.counter,
            signature.hashA,
            signature.hashB,
            _getBlsCommonPublicKey()
        );
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
                bytes32(bytes20(messages[i].to)),
                messages[i].amount,
                messages[i].data
            );
        }
        return keccak256(data);
    }

    function _getBlsCommonPublicKey() private view returns (G2Operations.G2Point memory) {
        SkaleFeatures skaleFeature = SkaleFeatures(getSkaleFeaturesAddress());
        return G2Operations.G2Point(
            {
                x: Fp2Operations.Fp2Point(
                    {
                        a: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey0"),
                        b: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey1")
                    }
                ),
                y: Fp2Operations.Fp2Point(
                    {
                        a: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey2"),
                        b: skaleFeature.getConfigVariableUint256("skaleConfig.nodeInfo.wallets.ima.commonBLSPublicKey3")
                    }
                )
            }
        );
    }
}
