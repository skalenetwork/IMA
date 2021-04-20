// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC721ModuleForSchain.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts/token/ERC721/IERC721Metadata.sol";

import "../Messages.sol";
import "./PermissionsForSchain.sol";
import "./LockAndDataForSchainERC721.sol";
import "./TokenFactory.sol";

contract ERC721ModuleForSchain is PermissionsForSchain {

    event ERC721TokenCreated(string schainID, address indexed contractOnMainnet, address contractOnSchain);

    constructor(address newLockAndDataAddress) public PermissionsForSchain(newLockAndDataAddress) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Allows TokenManager to receive ERC721 tokens.
     * 
     * Requirements:
     * 
     * - ERC721 token contract must exist in LockAndDataForSchainERC721.
     * - ERC721 token must be received by LockAndDataForSchainERC721.
     */
    function receiveERC721(
        string calldata schainID,
        address contractOnMainnet,
        address receiver,
        uint256 tokenId
    ) 
        external
        allow("TokenManager")
        returns (bytes memory data)
    {
        address lockAndDataERC721 = LockAndDataForSchain(getLockAndDataAddress()).getLockAndDataErc721();
        address contractOnSchain = LockAndDataForSchainERC721(lockAndDataERC721)
            .getERC721OnSchain(schainID, contractOnMainnet);
        require(contractOnSchain != address(0), "ERC721 contract does not exist on SKALE chain");
        require(
            LockAndDataForSchainERC721(lockAndDataERC721).receiveERC721(contractOnSchain, tokenId),
            "Could not receive ERC721 Token"
        );
        data = Messages.encodeTransferErc721Message(contractOnMainnet, receiver, tokenId);
    }

    /**
     * @dev Allows TokenManager to send ERC721 tokens.
     *  
     * Emits a {ERC721TokenCreated} event if to address = 0.
     */
    function sendERC721(string calldata schainID, bytes calldata data) external allow("TokenManager") returns (bool) {
        address lockAndDataERC721 = LockAndDataForSchain(getLockAndDataAddress()).getLockAndDataErc721();
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256 tokenId;
        if (messageType == Messages.MessageType.TRANSFER_ERC721){
            Messages.TransferErc721Message memory message = Messages.decodeTransferErc721Message(data);
            receiver = message.receiver;
            token = message.token;
            tokenId = message.tokenId;
        } else {
            Messages.TransferErc721AndTokenInfoMessage memory message =
                Messages.decodeTransferErc721AndTokenInfoMessage(data);
            receiver = message.baseErc721transfer.receiver;
            token = message.baseErc721transfer.token;
            tokenId = message.baseErc721transfer.tokenId;
            address contractOnSchainTmp = LockAndDataForSchainERC721(lockAndDataERC721)
                .getERC721OnSchain(schainID, token);
            if (contractOnSchainTmp == address(0)) {
                contractOnSchainTmp = _sendCreateERC721Request(message.tokenInfo);
                LockAndDataForSchainERC721(lockAndDataERC721).addERC721ForSchain(
                    schainID,
                    token,
                    contractOnSchainTmp
                );
                emit ERC721TokenCreated(schainID, token, contractOnSchainTmp);
            }
        }
        address contractOnSchain = LockAndDataForSchainERC721(lockAndDataERC721)
            .getERC721OnSchain(schainID, token);
        return LockAndDataForSchainERC721(lockAndDataERC721).sendERC721(
            contractOnSchain,
            receiver,
            tokenId
        );
    }

    /**
     * @dev Returns the receiver address.
     */
    function getReceiver(bytes calldata data) external pure returns (address receiver) {
        Messages.MessageType messageType = Messages.getMessageType(data);
        if (messageType == Messages.MessageType.TRANSFER_ERC721)
            return Messages.decodeTransferErc721Message(data).receiver;
        else
            return Messages.decodeTransferErc721AndTokenInfoMessage(data).baseErc721transfer.receiver;
    }

    function _sendCreateERC721Request(Messages.Erc721TokenInfo memory tokenInfo) internal returns (address) {
        address tokenFactoryAddress = LockAndDataForSchain(getLockAndDataAddress()).getTokenFactory();
        return TokenFactory(tokenFactoryAddress).createERC721(tokenInfo.name, tokenInfo.symbol);
    }
}


