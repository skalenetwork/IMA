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

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../Messages.sol";
import "./SkaleFeaturesClient.sol";
import "./MessageProxyForSchain.sol";
import "./TokenManagerLinker.sol";

/**
 * @title CommunityLocker
 * @dev Contract contains logic to perform automatic self-recharging ether for nodes
 */
contract CommunityLocker is SkaleFeaturesClient {

    MessageProxyForSchain public messageProxy;
    TokenManagerLinker public tokenManagerLinker;

    bytes32 public schainHash;
    uint public timeLimitPerMessage;
    string constant public MAINNET_NAME = "Mainnet";
    bytes32 constant public MAINNET_HASH = keccak256(abi.encodePacked(MAINNET_NAME));

    mapping(address => bool) private _unfrozenUsers;
    mapping(address => uint) private _lastMessageTimeStamp;

    event UserUnfrozed(
        bytes32 schainHash,
        address user
    );

    constructor(
        string memory newSchainName,
        MessageProxyForSchain newMessageProxy,
        TokenManagerLinker newIMALinker
    )
        public
    {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        schainHash = keccak256(abi.encodePacked(newSchainName));
        messageProxy = newMessageProxy;
        tokenManagerLinker = newIMALinker;
        timeLimitPerMessage = 5 minutes;
    }

    function postMessage(
        bytes32 fromChainHash,
        address,
        bytes calldata data
    )
        external
        returns (bool)
    {
        require(msg.sender == address(messageProxy), "Sender is not a message proxy");
        require(fromChainHash == MAINNET_HASH, "Source chain name should be Mainnet");
        Messages.MessageType operation = Messages.getMessageType(data);
        require(operation == Messages.MessageType.FREEZE_STATE, "The message should contain a frozen state");
        Messages.FreezeStateMessage memory message =  Messages.decodeFreezeStateMessage(data);
        require(_unfrozenUsers[message.receiver] != message.isUnfrozen, "Freezing states must be different");
        _unfrozenUsers[message.receiver] = message.isUnfrozen;
        emit UserUnfrozed(schainHash, message.receiver);
        return true;
    }

    function checkAllowedToSendMessage(address receiver) external {
        getTokenManagerLinker().hasTokenManager(TokenManager(msg.sender));
        require(_unfrozenUsers[receiver], "Recipient must be unfrozen");
        require(
            _lastMessageTimeStamp[receiver] + timeLimitPerMessage < block.timestamp,
            "Trying to send messages too often"
        );
        _lastMessageTimeStamp[receiver] = block.timestamp;
    }

    function setTimeLimitPerMessage(uint newTimeLimitPerMessage) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller");
        timeLimitPerMessage = newTimeLimitPerMessage;
    }

    function getTokenManagerLinker() public view returns (TokenManagerLinker) {
        if (address(tokenManagerLinker) == address(0)) {
            return TokenManagerLinker(
                getSkaleFeatures().getConfigVariableAddress(
                    "skaleConfig.contractSettings.IMA.TokenManagerLinker"
                )
            );
        }
        return tokenManagerLinker;
    }

}
