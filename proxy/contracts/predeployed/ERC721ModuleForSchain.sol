// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC721ModuleForSchain.sol - SKALE Interchain Messaging Agent
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
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721Metadata.sol";

interface ITokenFactoryForERC721 {
    function createERC721(string memory name, string memory symbol)
        external
        returns (address payable);
}

interface ILockAndDataERC721S {
    function addERC721ForSchain(string calldata schainID, address erc721OnMainnet, address erc721OnSchain) external;
    function sendERC721(address contractOnSchain, address to, uint256 tokenId) external returns (bool);
    function receiveERC721(address contractOnSchain, uint256 tokenId) external returns (bool);
    function getERC721OnSchain(string calldata schainID, address contractOnMainnet) external view returns (address);
}


contract ERC721ModuleForSchain is PermissionsForSchain {

    event ERC721TokenCreated(string schainID, address indexed contractOnMainnet, address contractOnSchain);

    constructor(address newLockAndDataAddress) public PermissionsForSchain(newLockAndDataAddress) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Allows TokenManager to receive ERC721 tokens.
     * 
     * Requirements:
     * 
     * - ERC721 token contract must exist in LockAndDataForSchainERC721.
     * - ERC721 token must be received by LockAndDataForSchainERC721.
     */
    function receiveERC721(
        string calldata schainID,
        address contractOnMainnet,
        address receiver,
        uint256 tokenId
    ) 
        external
        allow("TokenManager")
        returns (bytes memory data)
    {
        address lockAndDataERC721 = LockAndDataForSchain(getLockAndDataAddress()).getLockAndDataErc721();
        address contractOnSchain = ILockAndDataERC721S(lockAndDataERC721)
            .getERC721OnSchain(schainID, contractOnMainnet);
        require(contractOnSchain != address(0), "ERC721 contract does not exist on SKALE chain");
        require(
            ILockAndDataERC721S(lockAndDataERC721).receiveERC721(contractOnSchain, tokenId),
            "Could not receive ERC721 Token"
        );
        data = _encodeData(contractOnMainnet, contractOnSchain, receiver, tokenId);
    }

    /**
     * @dev Allows TokenManager to send ERC721 tokens.
     *  
     * Emits a {ERC721TokenCreated} event if to address = 0.
     */
    function sendERC721(string calldata schainID, bytes calldata data) external allow("TokenManager") returns (bool) {
        address lockAndDataERC721 = LockAndDataForSchain(getLockAndDataAddress()).getLockAndDataErc721();
        address contractOnMainnet;
        address receiver;
        uint256 tokenId;
        (contractOnMainnet, receiver, tokenId) = _fallbackDataParser(data);
        address contractOnSchain = ILockAndDataERC721S(lockAndDataERC721)
            .getERC721OnSchain(schainID, contractOnMainnet);
        if (contractOnSchain == address(0)) {
            contractOnSchain = _sendCreateERC721Request(data);
            ILockAndDataERC721S(lockAndDataERC721).addERC721ForSchain(schainID, contractOnMainnet, contractOnSchain);
            emit ERC721TokenCreated(schainID, contractOnMainnet, contractOnSchain);
        }
        return ILockAndDataERC721S(lockAndDataERC721).sendERC721(contractOnSchain, receiver, tokenId);
    }

    /**
     * @dev Returns the receiver address.
     */
    function getReceiver(bytes calldata data) external pure returns (address receiver) {
        (, receiver, ) = _fallbackDataParser(data);
    }

    function _sendCreateERC721Request(bytes calldata data) internal returns (address) {
        string memory name;
        string memory symbol;
        (name, symbol) = _fallbackDataCreateERC721Parser(data);
        address tokenFactoryAddress = LockAndDataForSchain(
            getLockAndDataAddress()
        ).getTokenFactory();
        return ITokenFactoryForERC721(tokenFactoryAddress).createERC721(name, symbol);
    }

    /**
     * @dev Returns encoded creation data.
     */
    function _encodeData(
        address contractOnMainnet,
        address contractOnSchain,
        address to,
        uint256 tokenId
    )
        private
        view
        returns (bytes memory data)
    {
        string memory name = IERC721Metadata(contractOnSchain).name();
        string memory symbol = IERC721Metadata(contractOnSchain).symbol();
        data = abi.encodePacked(
            bytes1(uint8(5)),
            bytes32(bytes20(contractOnMainnet)),
            bytes32(bytes20(to)),
            bytes32(tokenId),
            bytes(name).length,
            name,
            bytes(symbol).length,
            symbol
        );
    }

    /**
     * @dev Returns fallback data.
     */
    function _fallbackDataParser(bytes memory data)
        private
        pure
        returns (address, address payable, uint256)
    {
        bytes32 contractOnMainnet;
        bytes32 to;
        bytes32 token;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            contractOnMainnet := mload(add(data, 33))
            to := mload(add(data, 65))
            token := mload(add(data, 97))
        }
        return (
            address(bytes20(contractOnMainnet)), address(bytes20(to)), uint256(token)
        );
    }

    function _fallbackDataCreateERC721Parser(bytes memory data)
        private
        pure
        returns (
            string memory name,
            string memory symbol
        )
    {
        bytes32 nameLength;
        bytes32 symbolLength;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            nameLength := mload(add(data, 129))
        }
        name = new string(uint256(nameLength));
        for (uint256 i = 0; i < uint256(nameLength); i++) {
            bytes(name)[i] = data[129 + i];
        }
        uint256 lengthOfName = uint256(nameLength);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            symbolLength := mload(add(data, add(161, lengthOfName)))
        }
        symbol = new string(uint256(symbolLength));
        for (uint256 i = 0; i < uint256(symbolLength); i++) {
            bytes(symbol)[i] = data[161 + lengthOfName + i];
        }
    }
}


