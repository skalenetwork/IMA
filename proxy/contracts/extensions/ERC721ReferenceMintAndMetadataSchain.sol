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

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721MetadataUpgradeable.sol";
import "../interfaces/IMessageReceiver.sol";


/**
 * @title Token Manager
 * @dev Runs on SKALE Chains, accepts messages from mainnet, and instructs
 * TokenFactory to create clones. TokenManager mints tokens via
 * LockAndDataForSchain*. When a user exits a SKALE chain, TokenFactory
 * burns tokens.
 */
contract ERC721ReferenceMintAndMetadataSchain is IMessageReceiver {

    address public erc721Contract;
    address public receiverContractOnMainnet;

    function sendTokenToMainnet(address receiver, uint256 tokenId) external {
        require(
            IERC721MetadataUpgradeable(erc721Contract).getApproved(tokenId) == address(this),
            "Not allowed ERC721 Token"
        );
        IERC721MetadataUpgradeable(erc721Contract).transferFrom(msg.sender, address(this), tokenId);
        IERC721MetadataUpgradeable(erc721Contract).burn(tokenId);
        bytes memory data = _encodeData(receiver, tokenId);    
        messageProxy.postOutgoingMessage("Mainnet", receiverContractOnMainnet, data);
    }

    function _encodeData(address receiver, uint256 tokenId) private returns (bytes memory data) {
        data = abi.encode(receiver, tokenId, IERC721MetadataUpgradeable(erc721Contract).tokenURI(tokenId));
    }

    function postMessage(
        bytes32,
        address,
        bytes calldata
    )
        external
        override
        returns (address)
    {
        return address(0);
    }
}
