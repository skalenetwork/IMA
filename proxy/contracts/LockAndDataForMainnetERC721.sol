// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   LockAndDataForMainnetERC721.sol - SKALE Interchain Messaging Agent
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

pragma solidity ^0.5.3;

import "./PermissionsForMainnet.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721Full.sol";


contract LockAndDataForMainnetERC721 is PermissionsForMainnet {

    mapping(uint256 => address) public erc721Tokens;
    mapping(address => uint256) public erc721Mapper;
    // mapping(uint256 => uint256) public mintToken;
    uint256 newIndexERC721 = 1;

    constructor(address _lockAndDataAddress) PermissionsForMainnet(_lockAndDataAddress) public {
        // solium-disable-previous-line no-empty-blocks
    }

    function sendERC721(address contractHere, address to, uint256 tokenId) external allow("ERC721Module") returns (bool) {
        if (IERC721Full(contractHere).ownerOf(tokenId) == address(this)) {
            IERC721Full(contractHere).transferFrom(address(this), to, tokenId);
            require(IERC721Full(contractHere).ownerOf(tokenId) == to, "Did not transfer");
        } // else {
        //     //mint!!!
        // }
        return true;
    }

    function addERC721Token(address addressERC721) external allow("ERC721Module") returns (uint256) {
        uint256 index = newIndexERC721;
        erc721Tokens[index] = addressERC721;
        erc721Mapper[addressERC721] = index;
        newIndexERC721++;
        return index;
    }
}