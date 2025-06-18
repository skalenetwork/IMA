// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenManagerSFuelSource.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2025-Present SKALE Labs
 *   @author Vadim Yavorsky
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

pragma solidity 0.8.27;

import "@skalenetwork/ima-interfaces/schain/TokenManagers/ITokenManagerSFuelSource.sol";
import "../../Messages.sol";
import "../TokenManager.sol";

/**
 * @title TokenManagerSFuelSource
 * @dev Runs on source chains that can send sFuel to the central hub.
 */
contract TokenManagerSFuelSource is TokenManager, ITokenManagerSFuelSource {

    SchainHash public hubChainHash;

    receive() external override payable {
        revert("Use sendSFuelToHub() function instead of direct transfer");
    }

    /**
     * @dev Set hub chain hash for routing.
     */
    function setHubChainName(string memory hubChainName) external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller");
        hubChainHash = SchainHash.wrap(keccak256(abi.encodePacked(hubChainName)));
    }

    /**
     * @dev Send native sFuel to hub.
     */
    function sendSFuelToHub(address to) external override payable {
        require(msg.value > 0, "Amount must be greater than 0");
        require(to != address(0), "Invalid receiver address");
        require(hubChainHash != SchainHash.wrap(bytes32(0)), "Hub chain not set");
        require(tokenManagers[hubChainHash] != address(0), "Hub TokenManager not set");

        communityLocker.checkAllowedToSendMessage(hubChainHash, msg.sender);

        bytes memory data = Messages.encodeTransferSFuelToHubMessage(to, msg.value);
        messageProxy.postOutgoingMessage(
            hubChainHash,
            tokenManagers[hubChainHash],
            data
        );

        emit SFuelSentToHub(msg.sender, msg.value);
    }

    /**
     * @dev Receive messages from hub to unlock native sFuel.
     */
    function postMessage(
        SchainHash fromChainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        checkReceiverChain(fromChainHash, sender)
    {
        Messages.TransferSFuelBackMessage memory decodedMessage =
            Messages.decodeTransferSFuelBackMessage(data);

        address receiver = decodedMessage.receiver;
        require(receiver != address(0), "Incorrect receiver");
        require(address(this).balance >= decodedMessage.amount, "Insufficient locked sFuel");

        payable(receiver).transfer(decodedMessage.amount);

        emit SFuelReceivedFromHub(receiver, decodedMessage.amount);
    }

    function initialize(
        string memory newChainName,
        IMessageProxyForSchain newMessageProxy,
        ITokenManagerLinker newIMALinker,
        ICommunityLocker newCommunityLocker
    )
        external
        override
        initializer
    {
        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(AUTOMATIC_DEPLOY_ROLE, msg.sender);
        _setupRole(TOKEN_REGISTRAR_ROLE, msg.sender);

        schainHash = SchainHash.wrap(keccak256(abi.encodePacked(newChainName)));
        messageProxy = newMessageProxy;
        tokenManagerLinker = newIMALinker;
        communityLocker = newCommunityLocker;
    }


    function _checkSender(SchainHash fromChainHash, address sender) internal view override returns (bool) {
        return fromChainHash == hubChainHash && sender == tokenManagers[hubChainHash];
    }

}
