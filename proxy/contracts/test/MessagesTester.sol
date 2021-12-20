// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   MessagesTester.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Dmytro Stebaiev
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


pragma solidity 0.8.6;

import "../Messages.sol";


interface IMessagesTester {
    function encodeTransferEthMessage(address receiver, uint256 amount) external pure returns (bytes memory);
    function encodeTransferErc20Message(
        address token,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory);
    function encodeTransferErc20AndTotalSupplyMessage(
        address token,
        address receiver,
        uint256 amount,
        uint256 totalSupply
    ) external pure returns (bytes memory);
    function encodeTransferErc20AndTokenInfoMessage(
        address token,
        address receiver,
        uint256 amount,
        uint256 totalSupply,
        Messages.Erc20TokenInfo memory tokenInfo
    ) external pure returns (bytes memory);
    function encodeTransferErc721Message(
        address token,
        address receiver,
        uint256 tokenId
    ) external pure returns (bytes memory);
    function encodeTransferErc721AndTokenInfoMessage(
        address token,
        address receiver,
        uint256 tokenId,
        Messages.Erc721TokenInfo memory tokenInfo
    ) external pure returns (bytes memory);
    function encodeActivateUserMessage(address receiver) external pure returns (bytes memory);
    function encodeLockUserMessage(address receiver) external pure returns (bytes memory);
    function encodeInterchainConnectionMessage(bool isAllowed) external pure returns (bytes memory);
    function encodeTransferErc1155Message(
        address token,
        address receiver,
        uint256 id,
        uint256 amount
    ) external pure returns (bytes memory);
    function encodeTransferErc1155AndTokenInfoMessage(
        address token,
        address receiver,
        uint256 id,
        uint256 amount,
        Messages.Erc1155TokenInfo memory tokenInfo
    ) external pure returns (bytes memory);
    function encodeTransferErc1155BatchMessage(
        address token,
        address receiver,
        uint256[] memory ids,
        uint256[] memory amounts
    ) external pure returns (bytes memory);
    function encodeTransferErc1155BatchAndTokenInfoMessage(
        address token,
        address receiver,
        uint256[] memory ids,
        uint256[] memory amounts,
        Messages.Erc1155TokenInfo memory tokenInfo
    ) external pure returns (bytes memory);
}


contract MessagesTester is IMessagesTester {

    function encodeTransferEthMessage(address receiver, uint256 amount) external pure override returns (bytes memory) {
        return Messages.encodeTransferEthMessage(receiver, amount);
    }

    function encodeTransferErc20Message(
        address token,
        address receiver,
        uint256 amount
    ) external pure override returns (bytes memory) {
        return Messages.encodeTransferErc20Message(token, receiver, amount);
    }

    function encodeTransferErc20AndTotalSupplyMessage(
        address token,
        address receiver,
        uint256 amount,
        uint256 totalSupply
    ) external pure override returns (bytes memory) {
        return Messages.encodeTransferErc20AndTotalSupplyMessage(token, receiver, amount, totalSupply);
    }

    function encodeTransferErc20AndTokenInfoMessage(
        address token,
        address receiver,
        uint256 amount,
        uint256 totalSupply,
        Messages.Erc20TokenInfo memory tokenInfo
    ) external pure override returns (bytes memory) {
        return Messages.encodeTransferErc20AndTokenInfoMessage(token, receiver, amount, totalSupply, tokenInfo);
    }

    function encodeTransferErc721Message(
        address token,
        address receiver,
        uint256 tokenId
    ) external pure override returns (bytes memory) {
        return Messages.encodeTransferErc721Message(token, receiver, tokenId);
    }

    function encodeTransferErc721AndTokenInfoMessage(
        address token,
        address receiver,
        uint256 tokenId,
        Messages.Erc721TokenInfo memory tokenInfo
    ) external pure override returns (bytes memory) {
        return Messages.encodeTransferErc721AndTokenInfoMessage(token, receiver, tokenId, tokenInfo);
    }

    function encodeActivateUserMessage(address receiver) external pure override returns (bytes memory) {
        return Messages.encodeActivateUserMessage(receiver);
    }

    function encodeLockUserMessage(address receiver) external pure override returns (bytes memory) {
        return Messages.encodeLockUserMessage(receiver);
    }

    function encodeInterchainConnectionMessage(bool isAllowed) external pure override returns (bytes memory) {
        return Messages.encodeInterchainConnectionMessage(isAllowed);
    }

    function encodeTransferErc1155Message(
        address token,
        address receiver,
        uint256 id,
        uint256 amount
    ) external pure override returns (bytes memory) {
        return Messages.encodeTransferErc1155Message(token, receiver, id, amount);
    }

    function encodeTransferErc1155AndTokenInfoMessage(
        address token,
        address receiver,
        uint256 id,
        uint256 amount,
        Messages.Erc1155TokenInfo memory tokenInfo
    ) external pure override returns (bytes memory) {
        return Messages.encodeTransferErc1155AndTokenInfoMessage(token, receiver, id, amount, tokenInfo);
    }

    function encodeTransferErc1155BatchMessage(
        address token,
        address receiver,
        uint256[] memory ids,
        uint256[] memory amounts
    ) external pure override returns (bytes memory) {
        return Messages.encodeTransferErc1155BatchMessage(token, receiver, ids, amounts);
    }

    function encodeTransferErc1155BatchAndTokenInfoMessage(
        address token,
        address receiver,
        uint256[] memory ids,
        uint256[] memory amounts,
        Messages.Erc1155TokenInfo memory tokenInfo
    ) external pure override returns (bytes memory) {
        return Messages.encodeTransferErc1155BatchAndTokenInfoMessage(token, receiver, ids, amounts, tokenInfo);
    }
}