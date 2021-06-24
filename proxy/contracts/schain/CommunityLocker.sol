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

import "../Messages.sol";
import "../mainnet/CommunityPool.sol";
import "./MessageProxyForSchain.sol";
import "./TokenManagerLinker.sol";


/**
 * @title CommunityLocker
 * @dev Contract contains logic to perform automatic self-recharging ether for nodes
 */
contract CommunityLocker is IMessageReceiver, AccessControlEnumerableUpgradeable {

    string constant public MAINNET_NAME = "Mainnet";
    bytes32 constant public MAINNET_HASH = keccak256(abi.encodePacked(MAINNET_NAME));
    bytes32 public constant CONSTANT_SETTER_ROLE = keccak256("CONSTANT_SETTER_ROLE");

    MessageProxyForSchain public messageProxy;
    TokenManagerLinker public tokenManagerLinker;
    address public communityPool;

    bytes32 public schainHash;
    uint public timeLimitPerMessage;

    mapping(address => bool) public activeUsers;
    mapping(address => uint) private _lastMessageTimeStamp;

    event ActivateUser(
        bytes32 schainHash,
        address user
    );

    event LockUser(
        bytes32 schainHash,
        address user
    ); 

    event TimeLimitPerMessageWasChanged(
        uint256 oldValue,
        uint256 newValue
    );

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

    function checkAllowedToSendMessage(address receiver) external {
        require(
            tokenManagerLinker.hasTokenManager(TokenManager(msg.sender)),
            "Sender is not registered token manager"
        );
        require(activeUsers[receiver], "Recipient must be active");
        require(
            _lastMessageTimeStamp[receiver] + timeLimitPerMessage < block.timestamp,
            "Trying to send messages too often"
        );
        _lastMessageTimeStamp[receiver] = block.timestamp;
    }

    function setTimeLimitPerMessage(uint newTimeLimitPerMessage) external {
        require(hasRole(CONSTANT_SETTER_ROLE, msg.sender), "Not enough permissions to set constant");
        emit TimeLimitPerMessageWasChanged(timeLimitPerMessage, newTimeLimitPerMessage);
        timeLimitPerMessage = newTimeLimitPerMessage;
    }

    function initialize(
        string memory newSchainName,
        MessageProxyForSchain newMessageProxy,
        TokenManagerLinker newTokenManagerLinker,
        address newCommunityPool
    )
        public
        virtual
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
