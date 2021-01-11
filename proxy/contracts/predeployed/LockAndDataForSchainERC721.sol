// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   LockAndDataForSchainERC721.sol - SKALE Interchain Messaging Agent
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

import "./PermissionsForSchain.sol";

interface ERC721MintAndBurn {
    function mint(address to, uint256 tokenId) external returns (bool);
    function burn(uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title Lock and Data For SKALE chain ERC721
 * @dev Runs on SKALE chains, holds deposited ERC721s, and contains mappings and
 * balances of ERC721s tokens received through DepositBox.
 */

contract LockAndDataForSchainERC721 is PermissionsForSchain {

    // mapping(uint256 => address) public erc721Tokens;
    // mapping(address => uint256) public erc721Mapper;

    mapping(bytes32 => mapping(address => address)) public schainToERC721OnSchain;
    mapping(bytes32 => bool) public automaticDeploy;

    /**
     * @dev Emitted when token is mapped in LockAndDataForMainnetERC721.
     */
    event ERC721TokenAdded(string schainID, address indexed erc721OnMainnet, address erc721OnSchain);

    /**
     * @dev Emitted upon minting ERC721 on the SKALE chain.
     */
    event SentERC721(bool result);
    
    /**
     * @dev Emitted upon ERC721 receipt in LockAndDataForSchainERC721.
     */
    event ReceivedERC721(bool result);

    constructor(address _lockAndDataAddress) public PermissionsForSchain(_lockAndDataAddress) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Allows ERC721Module to send (mint) an ERC721 token from LockAndDataForSchainERC721.
     * 
     * Emits a {SentERC721} event.
     *
     * Requirements:
     * 
     * - ERC721 must be mintable.
     */
    function sendERC721(address contractOnSchain, address to, uint256 tokenId)
        external
        allow("ERC721Module")
        returns (bool)
    {
        require(ERC721MintAndBurn(contractOnSchain).mint(to, tokenId), "Could not mint ERC721 Token");
        emit SentERC721(true);
        return true;
    }

    /**
     * @dev Allows ERC721Module to receive an ERC721 token to LockAndDataForSchainERC721.
     * 
     * Emits a {ReceivedERC721} event.
     *
     * Requirements:
     * 
     * - LockAndDataForSchainERC721 must be the onwer of ERC721 token.
     */
    function receiveERC721(address contractOnSchain, uint256 tokenId) external allow("ERC721Module") returns (bool) {
        require(ERC721MintAndBurn(contractOnSchain).ownerOf(tokenId) == address(this), "Token not transfered");
        ERC721MintAndBurn(contractOnSchain).burn(tokenId);
        emit ReceivedERC721(true);
        return true;
    }

    /**
     * @dev Allows ERC721Module to add an ERC721 token to LockAndDataForSchainERC721.
     */
    function addERC721ForSchain(
        string calldata schainName,
        address erc721OnMainnet,
        address erc721OnSchain
    )
        external
        allow("ERC721Module")
    {
        require(erc721OnMainnet.isContract(), "Given address is not a contract");
        require(automaticDeploy[keccak256(abi.encodePacked(schainName))], "Custom deploy is disabled");
        schainToERC721OnSchain[keccak256(abi.encodePacked(schainName))][erc721OnMainnet] = erc721OnSchain;
        emit ERC721TokenAdded(schainName, erc721OnMainnet, erc721OnSchain);
    }

    function addERC721TokenByOwner(
        string calldata schainName,
        address erc721OnMainnet,
        address erc721OnSchain
    )
        external
    {
        require(isSchainOwner(msg.sender), "Sender is not a Schain owner");
        require(erc721OnSchain.isContract(), "Given address is not a contract");
        // require(!automaticDeploy[keccak256(abi.encodePacked(schainName))], "Custom deploy is enabled");
        schainToERC721OnSchain[keccak256(abi.encodePacked(schainName))][erc721OnMainnet] = erc721OnSchain;
        emit ERC721TokenAdded(schainName, erc721OnMainnet, erc721OnSchain);
    }

    function enableWhitelist(bytes32 schainId) external {
        require(isSchainOwner(msg.sender), "Sender is not a Schain owner");
        automaticDeploy[schainId] = false;
    }

    function disableWhitelist(bytes32 schainId) external {
        require(isSchainOwner(msg.sender), "Sender is not a Schain owner");
        automaticDeploy[schainId] = true;
    }

    function getERC721OnSchain(string calldata schainName, address contractOnMainnet) external view returns (address) {
        return schainToERC721OnSchain[keccak256(abi.encodePacked(schainName))][contractOnMainnet];
    }

}
