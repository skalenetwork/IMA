// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC1155Example.sol - SKALE Interchain Messaging Agent Test tokens
 *   Copyright (C) 2021-Present SKALE Labs
 *   @author Christine Perry
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

import "@openzeppelin/contracts/token/ERC721/presets/ERC721PresetMinterPauserAutoId.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract MemoryToken is ERC721PresetMinterPauserAutoId, ERC721URIStorage {

    using SafeMath for uint;

    event TokenMinted(address from, string tokenURI);

    uint256 public globalLimit;

    mapping (address => mapping (bytes32 => bool)) private _addressToTokenURI;
    mapping (bytes32 => uint256) private _limitOfTokenURIs;
    mapping (bytes32 => uint256) private _countersOfTokenURIs;

    constructor(string memory tokenName, string memory tokenSymbol)
        // default tokenName = "SKALE Match", tokenSymbol = "SKALE_MATCH"
        ERC721PresetMinterPauserAutoId(tokenName, tokenSymbol, "https://demo.skalelabs.com/")
    {
        grantRole(MINTER_ROLE, msg.sender);
        globalLimit = 500;
    }

    modifier onlyMinter() {
        require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
        _;
    }

    /**
     * @dev allow minter set a global limit of tokens
     */
    function setGlobalLimit(uint256 _newLimit) public onlyMinter {
        globalLimit = _newLimit;
    }

    /**
     * @dev allow minter set an individual limit for tokenURI
     */
    function setLimitOfTokenURI(string memory _tokenURI, uint256 _newLimit) public onlyMinter {
        _limitOfTokenURIs[keccak256(abi.encodePacked(_tokenURI))] = _newLimit;
    }

    /**
     * @dev allow minter mint token with {_tokenURI}
     */
    function mint(address _to, string memory _tokenURI) public onlyMinter returns(bool) {
        bytes32 tokenURIHash = keccak256(abi.encodePacked(_tokenURI));

        // check is a receiver has token of the tokenURI
        // if receiver has - would raise an error 
        // "Receiver already has this token"
        require(!_addressToTokenURI[_to][tokenURIHash], "Receiver already has this token");

        // check is amount of minted token of this tokenURI
        // less than global limit or individual limit
        // if individual limit exists
        require(
            _limitOfTokenURIs[tokenURIHash] == 0 ?
            _countersOfTokenURIs[tokenURIHash] < globalLimit :
            _countersOfTokenURIs[tokenURIHash] < _limitOfTokenURIs[tokenURIHash],
            "All tokens minted"
        );

        uint _tokenId = totalSupply().add(1);
        _mint(_to, _tokenId);
        _setTokenURI(_tokenId, _tokenURI);
        emit TokenMinted(_to, _tokenURI);

        // set that a receiver has token of the tokenURI
        _addressToTokenURI[_to][tokenURIHash] = true;

        // increase counter of minted tokens of this tokenURI
        _countersOfTokenURIs[tokenURIHash] = _countersOfTokenURIs[tokenURIHash].add(1);
        return true;
    }

    /**
     * @dev Return true if {_sender} has token of {_tokenURI}, false - otherwise
     */
    function hasAddressTokenURI(address _sender, string memory _tokenURI) public view returns (bool) {
        return _addressToTokenURI[_sender][keccak256(abi.encodePacked(_tokenURI))];
    }

    /**
     * @dev Return amount of tokens remaining to mint of this {_tokenURI}
     */
    function tokensRemaining(string memory _tokenURI) public view returns (uint256) {
        bytes32 tokenURIHash = keccak256(abi.encodePacked(_tokenURI));
        return _limitOfTokenURIs[tokenURIHash] == 0 ?
            globalLimit - _countersOfTokenURIs[tokenURIHash] :
            _limitOfTokenURIs[tokenURIHash] - _countersOfTokenURIs[tokenURIHash];
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return ERC721URIStorage.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721PresetMinterPauserAutoId) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override(ERC721, ERC721PresetMinterPauserAutoId) returns (string memory) {
        return ERC721PresetMinterPauserAutoId._baseURI();
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal override(ERC721, ERC721PresetMinterPauserAutoId) {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        ERC721URIStorage._burn(tokenId);
    }
}