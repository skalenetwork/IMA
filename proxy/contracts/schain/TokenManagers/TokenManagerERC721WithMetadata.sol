// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenManagerERC721WithMetadata.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
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

pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "./TokenManagerERC721.sol";
import "../../Messages.sol";


/**
 * @title TokenManagerERC721WithMetadata
 * @dev Runs on SKALE Chains,
 * accepts messages from mainnet,
 * and creates ERC721 clones.
 * TokenManagerERC721 mints tokens. When a user exits a SKALE chain, it burns them.
 */
contract TokenManagerERC721WithMetadata is TokenManagerERC721 {
    using AddressUpgradeable for address;

    /**
     * @dev Allows MessageProxy to post operational message from mainnet
     * or SKALE chains.
     *
     * Requirements:
     * 
     * - MessageProxy must be the sender.
     * - `fromChainHash` must exist in TokenManager addresses.
     */
    function postMessage(
        bytes32 fromChainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        checkReceiverChain(fromChainHash, sender)
    {
        Messages.MessageType operation = Messages.getMessageType(data);
        address receiver = address(0);
        if (
            operation == Messages.MessageType.TRANSFER_ERC721_WITH_METADATA_AND_TOKEN_INFO ||
            operation == Messages.MessageType.TRANSFER_ERC721_WITH_METADATA
        ) {
            receiver = _sendERC721(fromChainHash, data);
        } else {
            revert("MessageType is unknown");
        }
    }

    /**
     * @dev Allows TokenManager to send ERC721 tokens.
     *  
     * Emits a {ERC20TokenCreated} event if token did not exist and was automatically deployed.
     * Emits a {ERC20TokenReceived} event on success.
     */
    function _sendERC721(bytes32 fromChainHash, bytes calldata data) internal override returns (address) {
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256 tokenId;
        string memory tokenURI;
        ERC721OnChain contractOnSchain;
        if (messageType == Messages.MessageType.TRANSFER_ERC721_WITH_METADATA) {
            Messages.TransferErc721MessageWithMetadata memory message =
                Messages.decodeTransferErc721MessageWithMetadata(data);
            receiver = message.erc721message.receiver;
            token = message.erc721message.token;
            tokenId = message.erc721message.tokenId;
            tokenURI = message.tokenURI;
            contractOnSchain = clonesErc721[fromChainHash][token];
        } else {
            Messages.TransferErc721WithMetadataAndTokenInfoMessage memory message =
                Messages.decodeTransferErc721WithMetadataAndTokenInfoMessage(data);
            receiver = message.baseErc721transferWithMetadata.erc721message.receiver;
            token = message.baseErc721transferWithMetadata.erc721message.token;
            tokenId = message.baseErc721transferWithMetadata.erc721message.tokenId;
            tokenURI = message.baseErc721transferWithMetadata.tokenURI;
            contractOnSchain = clonesErc721[fromChainHash][token];
            if (address(contractOnSchain) == address(0)) {
                require(automaticDeploy, "Automatic deploy is disabled");
                contractOnSchain = new ERC721OnChain(message.tokenInfo.name, message.tokenInfo.symbol);           
                clonesErc721[fromChainHash][token] = contractOnSchain;
                addedClones[contractOnSchain] = true;
                emit ERC721TokenCreated(fromChainHash, token, address(contractOnSchain));
            }
        }
        if (
            messageType == Messages.MessageType.TRANSFER_ERC721_WITH_METADATA &&
            fromChainHash != MAINNET_HASH &&
            _isERC721AddedToSchain(fromChainHash, token)
        ) {
            require(token.isContract(), "Incorrect main chain token");
            require(IERC721Upgradeable(token).ownerOf(tokenId) == address(this), "Incorrect tokenId");
            _removeTransferredAmount(fromChainHash, token, tokenId);
            IERC721Upgradeable(token).transferFrom(address(this), receiver, tokenId);
        } else {
            contractOnSchain.mint(receiver, tokenId);
            contractOnSchain.setTokenURI(tokenId, tokenURI);
        }
        emit ERC721TokenReceived(fromChainHash, token, address(contractOnSchain), tokenId);
        messageProxy.topUpReceiverBalance(payable(receiver));
        return receiver;
    }

    /**
     * @dev Burn tokens on schain and send message to unlock them on target chain.
     */
    function _exit(
        bytes32 chainHash,
        address messageReceiver,
        address contractOnMainChain,
        address to,
        uint256 tokenId
    )
        internal
        override
    {
        bool isMainChainToken;
        ERC721OnChain contractOnSchain = clonesErc721[chainHash][contractOnMainChain];
        if (address(contractOnSchain) == address(0)) {
            contractOnSchain = ERC721OnChain(contractOnMainChain);
            require(!addedClones[contractOnSchain], "Incorrect main chain token");
            isMainChainToken = true;
        }
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.getApproved(tokenId) == address(this), "Not allowed ERC721 Token");
        bytes memory data = Messages.encodeTransferErc721MessageWithMetadata(
            contractOnMainChain,
            to,
            tokenId,
            _getTokenURI(IERC721MetadataUpgradeable(contractOnSchain), tokenId)
        );
        if (isMainChainToken) {
            require(chainHash != MAINNET_HASH, "Main chain token could not be transfered to Mainnet");
            data = _receiveERC721(
                chainHash,
                address(contractOnSchain),
                msg.sender,
                tokenId
            );
            _saveTransferredAmount(chainHash, address(contractOnSchain), tokenId);
            contractOnSchain.transferFrom(msg.sender, address(this), tokenId);
        } else {
            contractOnSchain.transferFrom(msg.sender, address(this), tokenId);
            contractOnSchain.burn(tokenId);
        }
        messageProxy.postOutgoingMessage(chainHash, messageReceiver, data);
    }

    /**
     * @dev Allows DepositBoxERC721 to receive ERC721 tokens.
     * 
     * Emits an {ERC721TokenReady} event.
     * 
     * Requirements:
     * 
     * - Whitelist should be turned off for auto adding tokens to DepositBoxERC721.
     */
    function _receiveERC721(
        bytes32 chainHash,
        address erc721OnMainChain,
        address to,
        uint256 tokenId
    )
        internal
        override
        returns (bytes memory data)
    {
        bool isERC721AddedToSchain = _isERC721AddedToSchain(chainHash, erc721OnMainChain);
        if (!isERC721AddedToSchain) {
            _addERC721ForSchain(chainHash, erc721OnMainChain);
            data = Messages.encodeTransferErc721WithMetadataAndTokenInfoMessage(
                erc721OnMainChain,
                to,
                tokenId,
                _getTokenURI(IERC721MetadataUpgradeable(erc721OnMainChain), tokenId),
                _getTokenInfo(IERC721MetadataUpgradeable(erc721OnMainChain))
            );
        } else {
            data = Messages.encodeTransferErc721MessageWithMetadata(
                erc721OnMainChain,
                to,
                tokenId,
                _getTokenURI(IERC721MetadataUpgradeable(erc721OnMainChain), tokenId)
            );
        }
        emit ERC721TokenReady(chainHash, erc721OnMainChain, tokenId);
    }

    /**
     * @dev Returns tokenURI of ERC721 token.
     */
    function _getTokenURI(IERC721MetadataUpgradeable erc721, uint256 tokenId) private view returns (string memory) {
        return erc721.tokenURI(tokenId);
    }

}