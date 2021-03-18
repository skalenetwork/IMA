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


pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../Messages.sol";


contract MessagesTester {
    function encodeTransferErc20Message(
        address token,
        address receiver,
        uint256 amount
    ) external pure returns (bytes memory) {
        return Messages.encodeTransferErc20Message(token, receiver, amount);
    }

    function encodeTransferErc20AndTokenInfoMessage(
        address token,
        address receiver,
        uint256 amount,
        Messages.Erc20TokenInfo memory tokenInfo
    ) external pure returns (bytes memory) {
        return Messages.encodeTransferErc20AndTokenInfoMessage(token, receiver, amount, tokenInfo);
    }

    function encodeTransferErc721Message(
        address token,
        address receiver,
        uint256 tokenId
    ) external pure returns (bytes memory) {
        return Messages.encodeTransferErc721Message(token, receiver, tokenId);
    }
}