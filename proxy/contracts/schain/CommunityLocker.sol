// SPDX-License-Identifier: AGPL-3.0-only

/*
    CommunityLocker.sol - SKALE Manager
    Copyright (C) 2021-Present SKALE Labs
    @author Dmytro Stebaiev
    @author Artem Payvin
    @author Vadim Yavorsky

    SKALE Manager is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    SKALE Manager is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with SKALE Manager.  If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@skalenetwork/ima-interfaces/schain/ICommunityLocker.sol";

import "../Messages.sol";


/**
 * @title CommunityLocker
 * @dev Contract contains logic to perform automatic reimbursement
 * of gas fees for sent messages
 */
contract CommunityLocker is ICommunityLocker, AccessControlEnumerableUpgradeable {

    /**
     * @dev Mainnet identifier.
     */
    string constant public MAINNET_NAME = "Mainnet";

    /**
     * @dev Keccak256 hash of mainnet name.
     */
    bytes32 constant public MAINNET_HASH = keccak256(abi.encodePacked(MAINNET_NAME));

    /**
     * @dev id of a role that allows changing of the contract parameters.
     */
    bytes32 public constant CONSTANT_SETTER_ROLE = keccak256("CONSTANT_SETTER_ROLE");

    /**
     * @dev Address of MessageProxyForSchain.
     */
    IMessageProxyForSchain public messageProxy;

    /**
     * @dev Address of TokenManagerLinker.
     */
    ITokenManagerLinker public tokenManagerLinker;

    /**
     * @dev Address of CommunityPool on mainnet.
     */
    address public communityPool;

    /**
     * @dev Keccak256 hash of schain name.
     */
    bytes32 public schainHash;

    /**
     * @dev Amount of seconds after message sending
     * when next message cannot be sent.
     */
    uint public timeLimitPerMessage;

    /**
     * @dev Mapping of users who are allowed to send a message.
     */
    // user address => allowed to send message
    mapping(address => bool) public activeUsers;

    /**
     * @dev Timestamp of previous sent message by user.
     */
    // user address => timestamp of last message
    mapping(address => uint) public lastMessageTimeStamp;

    uint256 public mainnetGasPrice;

    uint256 public gasPriceTimestamp;

    /**
     * @dev Emitted when a user becomes active.
     */
    event ActivateUser(
        bytes32 schainHash,
        address user
    );

    /**
     * @dev Emitted when a user stops being active.
     */
    event LockUser(
        bytes32 schainHash,
        address user
    ); 

    /**
     * @dev Emitted when constants updated.
     */
    event ConstantUpdated(
        bytes32 indexed constantHash,
        uint previousValue,
        uint newValue
    );

    /**
     * @dev Allows MessageProxy to post operational message from mainnet
     * or SKALE chains.
     *
     * Requirements:
     * 
     * - MessageProxy must be the caller of the function.
     * - CommunityPool must be an origin of the message on mainnet.
     * - The message must come from the mainnet.
     * - The message must contains status of a user.
     * - Status of a user in the message must be different from the current status.
     */
    function postMessage(
        bytes32 fromChainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        returns (address)
    {
        require(msg.sender == address(messageProxy), "Sender is not a message proxy");
        require(sender == communityPool, "Sender must be CommunityPool");
        require(fromChainHash == MAINNET_HASH, "Source chain name must be Mainnet");
        Messages.MessageType operation = Messages.getMessageType(data);
        require(operation == Messages.MessageType.USER_STATUS, "The message should contain a status of user");
        Messages.UserStatusMessage memory message = Messages.decodeUserStatusMessage(data);
        require(activeUsers[message.receiver] != message.isActive, "Active user statuses must be different");
        activeUsers[message.receiver] = message.isActive;
        if (message.isActive) {
            emit ActivateUser(schainHash, message.receiver);
        } else {
            emit LockUser(schainHash, message.receiver);
        }
        return message.receiver;
    }

    /**
     * @dev Reverts if {receiver} is not allowed to send a message.
     *
     * Requirements:
     * 
     * - Function caller has to be registered in TokenManagerLinker as a TokenManager.
     * - {receiver} must be an active user.
     * - Previous message sent by {receiver} must be sent earlier then {timeLimitPerMessage} seconds before current time
     * or there are no messages sent by {receiver}.
     */
    function checkAllowedToSendMessage(address receiver) external override {
        require(
            tokenManagerLinker.hasTokenManager(ITokenManager(msg.sender)),
            "Sender is not registered token manager"
        );
        require(activeUsers[receiver], "Recipient must be active");
        require(
            lastMessageTimeStamp[receiver] + timeLimitPerMessage < block.timestamp,
            "Trying to send messages too often"
        );
        lastMessageTimeStamp[receiver] = block.timestamp;
    }

    /**
     * @dev Set value of {timeLimitPerMessage}.
     *
     * Requirements:
     * 
     * - Function caller has to be granted with {CONSTANT_SETTER_ROLE}.
     * 
     * Emits a {ConstantUpdated} event.
     */
    function setTimeLimitPerMessage(uint newTimeLimitPerMessage) external override {
        require(hasRole(CONSTANT_SETTER_ROLE, msg.sender), "Not enough permissions to set constant");
        emit ConstantUpdated(
            keccak256(abi.encodePacked("TimeLimitPerMessage")),
            timeLimitPerMessage,
            newTimeLimitPerMessage
        );
        timeLimitPerMessage = newTimeLimitPerMessage;
    }

    /**
     * @dev Set value of {mainnetGasPrice}.
     *
     * Requirements:
     * 
     * - Signature should be verified.
     * 
     * Emits a {ConstantUpdated} event.
     */
    function setGasPrice(
        uint gasPrice,
        uint timestamp,
        IMessageProxyForSchain.Signature memory
    )
        external
        override
    {
        require(timestamp > gasPriceTimestamp, "Gas price timestamp already updated");
        require(timestamp <= block.timestamp, "Timestamp should not be in the future");
        // TODO: uncomment when oracle finished
        // require(
        //     messageProxy.verifySignature(keccak256(abi.encodePacked(gasPrice, timestamp)), signature),
        //     "Signature is not verified"
        // );
        emit ConstantUpdated(
            keccak256(abi.encodePacked("MainnetGasPrice")),
            mainnetGasPrice,
            gasPrice
        );
        mainnetGasPrice = gasPrice;
        gasPriceTimestamp = timestamp;
    }

    /**
     * @dev Is called once during contract deployment.
     */
    function initialize(
        string memory newSchainName,
        IMessageProxyForSchain newMessageProxy,
        ITokenManagerLinker newTokenManagerLinker,
        address newCommunityPool
    )
        external
        override
        initializer
    {
        require(newCommunityPool != address(0), "Node address has to be set");
        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        messageProxy = newMessageProxy;
        tokenManagerLinker = newTokenManagerLinker;
        schainHash = keccak256(abi.encodePacked(newSchainName));
        timeLimitPerMessage = 5 minutes;
        communityPool = newCommunityPool;
    }
}
