// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenManagerSFuelHub.sol - SKALE Interchain Messaging Agent
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

import "@skalenetwork/ima-interfaces/schain/TokenManagers/ITokenManagerSFuelHub.sol";
import {SchainHash} from "@skalenetwork/ima-interfaces/DomainTypes.sol";
import "../../Messages.sol";
import "../TokenManager.sol";
import "../tokens/EthErc20.sol";


/**
 * @title TokenManagerSFuelHub
 * @dev Runs on the central hub chain for sFuel trading.
 * Receives sFuel from multiple source chains and creates different ERC20 tokens for each.
 */
contract TokenManagerSFuelHub is TokenManager, ITokenManagerSFuelHub {

    // Mapping: sourceChainHash => sFuelERC20 token address
    mapping(SchainHash => IEthErc20) public chainHashToSFuelToken;

    // Mapping: sFuelERC20 token address => sourceChainHash
    mapping(IEthErc20 => SchainHash) public sFuelTokenToChainHash;

    /**
     * @dev Register a new sFuel ERC20 token for a source chain.
     */
    function registerSFuelToken(
        string memory sourceChainName,
        IEthErc20 sFuelTokenAddress
    ) external override {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller");
        SchainHash sourceChainHash = SchainHash.wrap(keccak256(abi.encodePacked(sourceChainName)));
        require(address(chainHashToSFuelToken[sourceChainHash]) == address(0), "Token already registered");

        chainHashToSFuelToken[sourceChainHash] = sFuelTokenAddress;
        sFuelTokenToChainHash[sFuelTokenAddress] = sourceChainHash;

        emit SFuelTokenRegistered(sourceChainHash, address(sFuelTokenAddress));
    }

    /**
     * @dev Send sFuel ERC20 tokens back to their source chain as native sFuel.
     * Anyone can call this function, not just the original sender.
     */
    function sendSFuelBackToSource(
        IEthErc20 sFuelTokenAddress,
        address to,
        uint256 amount
    ) external override {
        require(to != address(0), "Invalid receiver address");
        require(amount > 0, "Amount must be greater than 0");

        SchainHash sourceChainHash = sFuelTokenToChainHash[sFuelTokenAddress];
        require(sourceChainHash != SchainHash.wrap(bytes32(0)), "Unknown sFuel token");
        require(tokenManagers[sourceChainHash] != address(0), "Source chain not connected");

        EthErc20 sFuelToken = EthErc20(address(sFuelTokenAddress));
        require(sFuelToken.balanceOf(msg.sender) >= amount, "Insufficient balance");

        sFuelTokenAddress.forceBurn(msg.sender, amount);

        bytes memory data = Messages.encodeTransferSFuelBackMessage(to, amount);
        messageProxy.postOutgoingMessage(
            sourceChainHash,
            tokenManagers[sourceChainHash],
            data
        );

        emit SFuelSentBack(sourceChainHash, msg.sender, amount);
    }

    /**
     * @dev Receive messages from source chains with sFuel transfers.
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
        Messages.TransferSFuelToHubMessage memory decodedMessage =
            Messages.decodeTransferSFuelToHubMessage(data);

        address receiver = decodedMessage.receiver;
        require(receiver != address(0), "Incorrect receiver");

        IEthErc20 sFuelToken = chainHashToSFuelToken[fromChainHash];
        require(address(sFuelToken) != address(0), "sFuel token not registered for source chain");

        sFuelToken.mint(receiver, decodedMessage.amount);

        emit SFuelReceived(fromChainHash, receiver, decodedMessage.amount);
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


    /**
     * @dev Get sFuel token address for a source chain.
     */
    function getSFuelToken(string memory sourceChainName) external override view returns (address) {
        SchainHash sourceChainHash = SchainHash.wrap(keccak256(abi.encodePacked(sourceChainName)));
        return address(chainHashToSFuelToken[sourceChainHash]);
    }

}
