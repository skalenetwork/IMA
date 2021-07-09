// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC1155Example.sol - SKALE Interchain Messaging Agent Test tokens
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

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract ERC1155Example is AccessControlEnumerable, ERC1155Burnable {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        string memory uri
    )
        ERC1155(uri)
    {
        _setRoleAdmin(MINTER_ROLE, MINTER_ROLE);
        _setupRole(MINTER_ROLE, _msgSender());
    }

    function mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    )
        external
    {
        require(hasRole(MINTER_ROLE, _msgSender()), "Sender is not a Minter");
        _mint(account, id, amount, data);
    }

    function mintBatch(
        address account,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    )
        external
    {
        require(hasRole(MINTER_ROLE, _msgSender()), "Sender is not a Minter");
        _mintBatch(account, ids, amounts, data);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlEnumerable, ERC1155)
        returns (bool)
    {
        return interfaceId == bytes4(keccak256(abi.encodePacked("mint(address,uint256,uint256,bytes)")))
            || interfaceId == bytes4(keccak256(abi.encodePacked("mintBatch(address,uint256[],uint256[],bytes)")))
            || super.supportsInterface(interfaceId);
    }
}