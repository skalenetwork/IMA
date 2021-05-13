// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenManagerERC721Mock.sol - Mock for TokenManagerERC721
 *   Copyright (C) 2019-Present SKALE Labs
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

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../schain/TokenManagers/TokenManagerERC721.sol";
import "../schain/TokenFactory.sol";
import "../Messages.sol";
import "@nomiclabs/buidler/console.sol";

contract TokenManagerERC721Mock is TokenManagerERC721 {
    TokenFactoryERC721 private _tokenFactory;

    event ERC721TokenCreated(string chainID, address indexed erc721OnMainnet, address indexed erc721OnSchain);

    constructor(
        string memory newChainID,
        MessageProxyForSchain newMessageProxyAddress,
        TokenManagerLinker newIMALinker,
        address newDepositBox
    )
        public
        TokenManagerERC721(newChainID, newMessageProxyAddress, newIMALinker, newDepositBox)
        // solhint-disable-next-line no-empty-blocks
    { }

   /**
     * @dev Allows TokenManager to receive ERC721 tokens.
     * 
     * Requirements:
     * 
     * - ERC721 token contract must exist in LockAndDataForSchainERC721.
     * - ERC721 token must be received by LockAndDataForSchainERC721.
     */
    function receiveERC721(
        string memory schainID,
        address contractOnMainnet,
        address receiver,
        uint256 tokenId
    ) 
        external
        returns (bytes memory data)
    {
        ERC721Burnable contractOnSchain = 
            schainToERC721OnSchain[keccak256(abi.encodePacked(schainID))][contractOnMainnet];
        require(address(contractOnSchain) != address(0), "ERC721 contract does not exist on SKALE chain");
        require(contractOnSchain.ownerOf(tokenId) == address(this), "Token not transferred");
        contractOnSchain.burn(tokenId);
        data = Messages.encodeTransferErc721Message(contractOnMainnet, receiver, tokenId);
    }

    /**
     * @dev Allows TokenManager to send ERC721 tokens.
     *  
     * Emits a {ERC721TokenCreated} event if to address = 0.
     */
    function sendERC721(string calldata schainID, bytes calldata data) external returns (bool) {
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
            ERC721OnChain contractOnSchainTmp = schainToERC721OnSchain[keccak256(abi.encodePacked(schainID))][token];
            if (address(contractOnSchainTmp) == address(0)) {
                contractOnSchainTmp = getTokenFactoryERC721()
                    .createERC721(message.tokenInfo.name, message.tokenInfo.symbol);
                require(address(contractOnSchainTmp).isContract(), "Given address is not a contract");
                require(automaticDeploy, "Automatic deploy is disabled");
                schainToERC721OnSchain[keccak256(abi.encodePacked(schainID))][token] = contractOnSchainTmp;
                emit ERC721TokenCreated(schainID, token, address(contractOnSchainTmp));
            }
        }
        ERC721OnChain contractOnSchain = schainToERC721OnSchain[keccak256(abi.encodePacked(schainID))][token];
        require(contractOnSchain.mint(receiver, tokenId), "Could not mint ERC721 Token");
        return true;
    }
}