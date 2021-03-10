// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   Messages.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Dmytro Stebaeiv
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


library Messages {
    enum MessageType {
        TRANSFER_ETH,
        TRANSFER_ERC20,
        TRANSFER_ERC20_AND_TOKEN_INFO,
        TRANSFER_ERC721,
        TRANSFER_ERC721_AND_TOKEN_INFO
    }

    struct BaseMessage {
        MessageType messageType;
    }

    struct TransferEthMessage {
        BaseMessage message;
    }

    struct TransferErc20Message {
        BaseMessage message;
        address token;
        address receiver;
        uint256 amount;
    }

    struct Erc20TokenInfo {
        string name;
        uint8 decimals;
        string symbol;
        uint256 totalSupply;
    }

    struct TransferErc20AndTokenInfoMessage {
        TransferErc20Message baseErc20transfer;
        Erc20TokenInfo tokenInfo;
    }

    struct TransferErc721Message {
        BaseMessage message;
        address token;
        address receiver;
        uint256 tokenId;
    }

    struct Erc721TokenInfo {
        string name;
        string symbol;
    }

    struct TransferErc721AndTokenInfoMessage {
        TransferErc721Message baseErc721transfer;
        Erc721TokenInfo tokenInfo;
    }

    function getMessageType(bytes memory data) internal pure returns (MessageType) {
        return abi.decode(data, (Messages.MessageType));
    }

    function encodeTransferErc20Message(
        address token,
        address receiver,
        uint256 amount
    ) internal pure returns (bytes memory) {
        TransferErc20Message memory message = TransferErc20Message(
            BaseMessage(MessageType.TRANSFER_ERC20),
            token,
            receiver,
            amount
        );
        return abi.encode(message);
    }

    function decodeTransferErc20Message(
        bytes memory data
    ) internal pure returns (TransferErc20Message memory) {
        TransferErc20Message memory message = abi.decode(data, (TransferErc20Message));
        require(message.message.messageType == MessageType.TRANSFER_ERC20, "Message type is not ERC20 transfer");
        return message;
    }

    function encodeTransferErc20AndTokenInfoMessage(
        address token,
        address receiver,
        uint256 amount,
        Erc20TokenInfo memory tokenInfo
    ) internal pure returns (bytes memory) {
        TransferErc20AndTokenInfoMessage memory message = TransferErc20AndTokenInfoMessage(
            TransferErc20Message(
                BaseMessage(MessageType.TRANSFER_ERC20_AND_TOKEN_INFO),
                token,
                receiver,
                amount
            ),
            tokenInfo
        );
        return abi.encode(message);
    }

    function decodeTransferErc20AndTokenInfoMessage(
        bytes memory data
    ) internal pure returns (TransferErc20AndTokenInfoMessage memory) {
        TransferErc20AndTokenInfoMessage memory message = abi.decode(data, (TransferErc20AndTokenInfoMessage));
        require(message.baseErc20transfer.message.messageType == MessageType.TRANSFER_ERC20_AND_TOKEN_INFO, "Message type is not ERC20 transfer with token info");
        return message;
    }

    function encodeTransferErc721Message(
        address token,
        address receiver,
        uint256 amount
    ) internal pure returns (bytes memory) {
        TransferErc721Message memory message = TransferErc721Message(
            BaseMessage(MessageType.TRANSFER_ERC721),
            token,
            receiver,
            amount
        );
        return abi.encode(message);
    }

    function decodeTransferErc721Message(
        bytes memory data
    ) internal pure returns (TransferErc721Message memory) {
        TransferErc721Message memory message = abi.decode(data, (TransferErc721Message));
        require(message.message.messageType == MessageType.TRANSFER_ERC721, "Message type is not ERC721 transfer");
        return message;
    }

    function encodeTransferErc721AndTokenInfoMessage(
        address token,
        address receiver,
        uint256 amount,
        Erc721TokenInfo memory tokenInfo
    ) internal pure returns (bytes memory) {
        TransferErc721AndTokenInfoMessage memory message = TransferErc721AndTokenInfoMessage(
            TransferErc721Message(
                BaseMessage(MessageType.TRANSFER_ERC721_AND_TOKEN_INFO),
                token,
                receiver,
                amount
            ),
            tokenInfo
        );
        return abi.encode(message);
    }

    function decodeTransferErc721AndTokenInfoMessage(
        bytes memory data
    ) internal pure returns (TransferErc721AndTokenInfoMessage memory) {
        TransferErc721AndTokenInfoMessage memory message = abi.decode(data, (TransferErc721AndTokenInfoMessage));
        require(
            message.baseErc721transfer.message.messageType == MessageType.TRANSFER_ERC721_AND_TOKEN_INFO,
            "Message type is not ERC721 transfer with token info"
        );
        return message;
    }
}