// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC1155OnChain.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlEnumerableUpgradeable.sol";
import "@skalenetwork/ima-interfaces/schain/tokens/IERC1155OnChain.sol";


/**
 * @title ERC1155OnChain
 * @dev ERC1155 token that is used as an automatically deployed clone of ERC1155 on mainnet.
 */
contract ERC1155OnChain is AccessControlEnumerableUpgradeable, ERC1155BurnableUpgradeable, IERC1155OnChain {

    /**
     * @dev id of a role that allows token minting.
     */
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        string memory uri
    ) initializer
    {
        AccessControlEnumerableUpgradeable.__AccessControlEnumerable_init();
        ERC1155Upgradeable.__ERC1155_init(uri);
        ERC1155BurnableUpgradeable.__ERC1155Burnable_init();

        _setRoleAdmin(MINTER_ROLE, MINTER_ROLE);
        _setupRole(MINTER_ROLE, _msgSender());
    }

    /**
     * @dev Mint tokens.
     * 
     * Requirements:
     * 
     * - sender must be granted with {MINTER_ROLE}.
     */
    function mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    )
        external
        override
    {
        require(hasRole(MINTER_ROLE, _msgSender()), "Sender is not a Minter");
        _mint(account, id, amount, data);
    }

    /**
     * @dev Mint batch of tokens.
     * 
     * Requirements:
     * 
     * - sender must be granted with {MINTER_ROLE}.
     */
    function mintBatch(
        address account,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    )
        external
        override
    {
        require(hasRole(MINTER_ROLE, _msgSender()), "Sender is not a Minter");
        _mintBatch(account, ids, amounts, data);
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
        override(AccessControlEnumerableUpgradeable, ERC1155Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
