// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract ERC721Example is AccessControlEnumerable, ERC721URIStorage {

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
}
