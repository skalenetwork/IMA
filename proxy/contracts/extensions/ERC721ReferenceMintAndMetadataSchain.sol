// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC721ReferenceMintAndMetadataSchain.sol - SKALE Interchain Messaging Agent
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

import "../schain/tokens/ERC721OnChain.sol";
import "./interfaces/MessageSender.sol";


/**
 * @title Token Manager
 * @dev Runs on SKALE Chains, accepts messages from mainnet, and instructs
 * TokenFactory to create clones. TokenManager mints tokens via
 * LockAndDataForSchain*. When a user exits a SKALE chain, TokenFactory
 * burns tokens.
 */
contract ERC721ReferenceMintAndMetadataSchain is MessageSender {

    address public erc721ContractOnSchain;
    address public receiverContractOnMainnet;

    constructor(
        address newMessageProxyAddress,
        address newErc721ContractOnSchain,
        address newReceiverContractOnMainnet
    )
        public
        MessageProxyClient(newMessageProxyAddress)
    {
        erc721ContractOnSchain = newErc721ContractOnSchain;
        receiverContractOnMainnet = newReceiverContractOnMainnet;
    }

    function sendTokenToMainnet(address receiver, uint256 tokenId) external {
        require(
            ERC721OnChain(erc721ContractOnSchain).getApproved(tokenId) == address(this),
            "Not allowed ERC721 Token"
        );
        ERC721OnChain(erc721ContractOnSchain).transferFrom(msg.sender, address(this), tokenId);
        string memory tokenURI = ERC721OnChain(erc721ContractOnSchain).tokenURI(tokenId);
        ERC721OnChain(erc721ContractOnSchain).burn(tokenId);
        bytes memory data = encodeParams(receiver, tokenId, tokenURI);
        _sendMessage("Mainnet", receiverContractOnMainnet, data);
    }

    function encodeParams(
        address receiver,
        uint256 tokenId,
        string memory tokenURI
    )
        public
        pure
        returns (bytes memory data)
    {
        data = abi.encode(receiver, tokenId, tokenURI);
    }
}
