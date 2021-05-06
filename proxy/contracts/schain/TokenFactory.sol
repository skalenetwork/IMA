// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenFactory.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./connectors/ContractConnectorSchain.sol";


contract ERC20OnChain is AccessControlUpgradeable, ERC20BurnableUpgradeable {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        string memory contractName,
        string memory contractSymbol
    )
        public
    {
        __ERC20_init(contractName, contractSymbol);
        _setRoleAdmin(MINTER_ROLE, MINTER_ROLE);
        _setupRole(MINTER_ROLE, _msgSender());
    }

    function mint(address account, uint256 value) public {
        require(hasRole(MINTER_ROLE, _msgSender()), "Sender is not a Minter");
        _mint(account, value);
    }
}


contract ERC721OnChain is AccessControlUpgradeable, ERC721BurnableUpgradeable {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        string memory contractName,
        string memory contractSymbol
    )
        public
    {
        __ERC721_init(contractName, contractSymbol);
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

    function setTokenURI(uint256 tokenId, string calldata tokenUri)
        external
        returns (bool)
    {
        require(_exists(tokenId), "Token does not exists");
        require(_isApprovedOrOwner(msg.sender, tokenId), "Sender can not set token URI");
        _setTokenURI(tokenId, tokenUri);
        return true;
    }
}


contract TokenFactory is ContractConnectorSchain {

    constructor(string memory chainID) public ContractConnectorSchain(chainID) {
        // solhint-disable-previous-line no-empty-blocks
    }

    function createERC20(string memory name, string memory symbol)
        external
        allow("TokenManagerERC20")
        returns (address)
    {
        ERC20OnChain newERC20 = new ERC20OnChain(
            name,
            symbol
        );
        newERC20.grantRole(newERC20.MINTER_ROLE(), getContract("TokenManagerERC20"));
        newERC20.revokeRole(newERC20.MINTER_ROLE(), address(this));
        return address(newERC20);
    }

    function createERC721(string memory name, string memory symbol)
        external
        allow("TokenManagerERC721")
        returns (address)
    {
        ERC721OnChain newERC721 = new ERC721OnChain(name, symbol);
        newERC721.grantRole(newERC721.MINTER_ROLE(), getContract("TokenManagerERC721"));
        newERC721.revokeRole(newERC721.MINTER_ROLE(), address(this));
        return address(newERC721);
    }
}