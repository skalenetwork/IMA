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

pragma solidity 0.6.12;

import "./PermissionsForMainnet.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721.sol";

/**
 * @title Lock And Data For Mainnet ERC721
 * @dev Runs on Mainnet, holds deposited ERC721s, and contains mappings and 
 * balances of ERC721 tokens received through DepositBox.
 */
contract LockAndDataForMainnetERC721 is PermissionsForMainnet {

    mapping(bytes32 => mapping(address => bool)) public schainToERC721;

    event ERC721TokenAdded(address indexed tokenHere, string schainID);

    /**
     * @dev Allows ERC721ModuleForMainnet to send an ERC721 token.
     * 
     * Requirements:
     * 
     * - If ERC721 is held by LockAndDataForMainnetERC721, token must 
     * transferrable from the contract to the recipient address.
     */
    function sendERC721(address contractOnMainnet, address to, uint256 tokenId)
        external
        allow("ERC721Module")
        returns (bool)
    {
        require(contractOnMainnet.isContract(), "Given address is not a contract");
        if (IERC721(contractOnMainnet).ownerOf(tokenId) == address(this)) {
            IERC721(contractOnMainnet).transferFrom(address(this), to, tokenId);
            require(IERC721(contractOnMainnet).ownerOf(tokenId) == to, "Did not transfer");
        }
        return true;
    }

    /**
     * @dev Allows ERC721ModuleForMainnet to add an ERC721 token to
     * LockAndDataForMainnetERC721.
     */
    function addERC721ForSchain(string calldata schainID, address erc721OnMainnet) external allow("ERC721Module") {
        require(erc721OnMainnet.isContract(), "Given address is not a contract");
        schainToERC721[keccak256(abi.encodePacked(schainID))][erc721OnMainnet] = true;
        emit ERC721TokenAdded(erc721OnMainnet, schainID);
    }

    function getSchainToERC721(string calldata schainID, address erc721OnMainnet) external view returns (bool) {
        return schainToERC721[keccak256(abi.encodePacked(schainID))][erc721OnMainnet];
    }

    function initialize(address newLockAndDataAddress) public override initializer {
        PermissionsForMainnet.initialize(newLockAndDataAddress);
    }
}
