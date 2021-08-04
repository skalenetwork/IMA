// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC721Example.sol - SKALE Interchain Messaging Agent Test tokens
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

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract ERC721Example is AccessControlEnumerable, ERC721Burnable {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        string memory contractName,
        string memory contractSymbol
    )
        ERC721(contractName, contractSymbol)
    {
        _setRoleAdmin(MINTER_ROLE, MINTER_ROLE);
        _setupRole(MINTER_ROLE, _msgSender());
    }

    function mint(address to, uint256 tokenId)
        external
        returns (bool)
    {
        require(hasRole(MINTER_ROLE, _msgSender()), "Sender is not a Minter");
        _mint(to, tokenId);
        return true;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlEnumerable, ERC721)
        returns (bool)
    {
        return interfaceId == type(IAccessControlEnumerable).interfaceId
            || interfaceId == type(IERC721).interfaceId
            || interfaceId == type(IERC721Metadata).interfaceId
            || interfaceId == bytes4(keccak256(abi.encodePacked("mint(address,uint256)")))
            || interfaceId == bytes4(keccak256(abi.encodePacked("burn(uint256)")))
            || super.supportsInterface(interfaceId);
    }
}