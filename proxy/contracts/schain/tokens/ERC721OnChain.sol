// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC721OnChain.sol - SKALE Interchain Messaging Agent
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Artem Payvin
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

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@skalenetwork/ima-interfaces/schain/tokens/IERC721OnChain.sol";


/**
 * @title ERC721OnChain
 * @dev ERC721 token that is used as an automatically deployed clone of ERC721 on mainnet.
 */
contract ERC721OnChain is
    AccessControlEnumerableUpgradeable,
    ERC721BurnableUpgradeable,
    ERC721URIStorageUpgradeable,
    IERC721OnChain
{

    /**
     * @dev id of a role that allows token minting.
     */
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        string memory contractName,
        string memory contractSymbol
    ) initializer
    {
        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        ERC721Upgradeable.__ERC721_init(contractName, contractSymbol);
        ERC721BurnableUpgradeable.__ERC721Burnable_init();
        _setRoleAdmin(MINTER_ROLE, MINTER_ROLE);
        _setupRole(MINTER_ROLE, _msgSender());
    }

    /**
     * @dev Set URI of ERC721 token.
     * 
     * Requirements:
     * 
     * - token with {tokenId} must exist.
     * - sender must be the token owner or approved for the token.
     */
    function setTokenURI(uint256 tokenId, string calldata tokenUri)
        external
        override
        returns (bool)
    {
        require(_exists(tokenId), "Token does not exists");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Sender can not set token URI");
        _setTokenURI(tokenId, tokenUri);
        return true;
    }

    /**
     * @dev Mint token.
     * 
     * Requirements:
     * 
     * - sender must be granted with {MINTER_ROLE}.
     */
    function mint(address account, uint256 tokenId)
        external
        override
    {
        require(hasRole(MINTER_ROLE, _msgSender()), "Sender is not a Minter");
        _mint(account, tokenId);
    }

    /**
     * @dev Check if contract support {interfaceId} interface.
     * 
     * See https://eips.ethereum.org/EIPS/eip-165 for more details.
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControlEnumerableUpgradeable, ERC721Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Get token URI.
     */
    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override (ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory) 
    {
        return ERC721URIStorageUpgradeable.tokenURI(tokenId);
    }

    // private

    /**
     * @dev Burn {tokenId}.
     */
    function _burn(uint256 tokenId) internal override (ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        ERC721URIStorageUpgradeable._burn(tokenId);
    }
}
