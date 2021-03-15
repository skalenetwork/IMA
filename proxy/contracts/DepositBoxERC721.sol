// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   DepositBoxERC721.sol - SKALE Interchain Messaging Agent
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
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721Metadata.sol";

interface ILockAndDataERC721M {
    function sendERC721(address contractOnMainnet, address to, uint256 token) external returns (bool);
    function addERC721ForSchain(string calldata schainID, address erc721OnMainnet) external;
    function getSchainToERC721(string calldata schainID, address erc721OnMainnet) external view returns (bool);
}

/**
 * @title ERC721 Module For Mainnet
 * @dev Runs on Mainnet, and manages receiving and sending of ERC721 token contracts
 * and encoding contractPosition in DepositBoxERC721.
 */
contract DepositBoxERC721 is PermissionsForMainnet {

    mapping(bytes32 => mapping(address => bool)) public schainToERC721;
    mapping(bytes32 => bool) public withoutWhitelist;

    /**
     * @dev Emitted when token is mapped in DepositBoxERC721.
     */
    event ERC721TokenAdded(string schainID, address indexed contractOnMainnet);
    event ERC721TokenReady(address indexed contractOnMainnet, uint256 tokenId);

    /**
     * @dev Allows DepositBox to receive ERC721 tokens.
     * 
     * Emits an {ERC721TokenAdded} event.  
     */
    function receiveERC721(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        external
        allow("DepositBox")
        returns (bytes memory data)
    {
        bool isERC721AddedToSchain = schainToERC721[keccak256(abi.encodePacked(schainID))][contractOnMainnet];
        if (!isERC721AddedToSchain) {
            _addERC721ForSchain(schainID, contractOnMainnet);
            data = _encodeCreateData(contractOnMainnet, to, tokenId);
        } else {
            data = _encodeRegularData(contractOnMainnet, to, tokenId);
        }
        emit ERC721TokenReady(contractOnMainnet, tokenId);
    }

    /**
     * @dev Allows DepositBox to send ERC721 tokens.
     */
    function sendERC721(bytes calldata data) external allow("DepositBox") returns (bool) {
        address contractOnMainnet;
        address receiver;
        uint256 tokenId;
        (contractOnMainnet, receiver, tokenId) = _fallbackDataParser(data);
        return _sendERC721(contractOnMainnet, receiver, tokenId);
    }

    /**
     * @dev Allows Schain owner to add an ERC721 token to DepositBoxERC721.
     */
    function addERC721TokenByOwner(string calldata schainName, address erc721OnMainnet) external {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(isSchainOwner(msg.sender, schainId) || msg.sender == getOwner(), "Sender is not a Schain owner");
        require(erc721OnMainnet.isContract(), "Given address is not a contract");
        // require(withoutWhitelist[schainId], "Whitelist is disabled");
        schainToERC721[schainId][erc721OnMainnet] = true;
        emit ERC721TokenAdded(schainName, erc721OnMainnet);
    }

    /**
     * @dev Allows Schain owner turn on whitelist of tokens.
     */
    function enableWhitelist(string memory schainName) external {
        require(isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainName))), "Sender is not a Schain owner");
        withoutWhitelist[keccak256(abi.encodePacked(schainName))] = false;
    }

    /**
     * @dev Allows Schain owner turn off whitelist of tokens.
     */
    function disableWhitelist(string memory schainName) external {
        require(isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainName))), "Sender is not a Schain owner");
        withoutWhitelist[keccak256(abi.encodePacked(schainName))] = true;
    }

    /**
     * @dev Should return true if token in whitelist.
     */
    function getSchainToERC721(string calldata schainName, address erc721OnMainnet) external view returns (bool) {
        return schainToERC721[keccak256(abi.encodePacked(schainName))][erc721OnMainnet];
    }

    /**
     * @dev Returns the receiver address of the ERC721 token.
     */
    function getReceiver(bytes calldata data) external pure returns (address receiver) {
        (, receiver, ) = _fallbackDataParser(data);
    }

    function initialize(address newLockAndDataAddress) public override initializer {
        PermissionsForMainnet.initialize(newLockAndDataAddress);
    }

    /**
     * @dev Allows DepositBoxERC721 to add an ERC721 token to
     * DepositBoxERC721.
     */
    function _addERC721ForSchain(string calldata schainName, address erc721OnMainnet) private {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(erc721OnMainnet.isContract(), "Given address is not a contract");
        require(withoutWhitelist[schainId], "Whitelist is enabled");
        schainToERC721[schainId][erc721OnMainnet] = true;
        emit ERC721TokenAdded(schainName, erc721OnMainnet);
    }

    /**
     * @dev Allows DepositBoxERC721 to send an ERC721 token.
     * 
     * Requirements:
     * 
     * - If ERC721 is held by DepositBoxERC721, token must 
     * transferrable from the contract to the recipient address.
     */
    function _sendERC721(address contractOnMainnet, address to, uint256 tokenId)
        private
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
     * @dev Returns encoded creation data for ERC721 token.
     */
    function _encodeCreateData(
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        private
        view
        returns (bytes memory data)
    {
        string memory name = IERC721Metadata(contractOnMainnet).name();
        string memory symbol = IERC721Metadata(contractOnMainnet).symbol();
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
     * @dev Returns encoded regular data for ERC721 token.
     */
    function _encodeRegularData(
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        private
        pure
        returns (bytes memory data)
    {
        data = abi.encodePacked(
            bytes1(uint8(5)),
            bytes32(bytes20(contractOnMainnet)),
            bytes32(bytes20(to)),
            bytes32(tokenId)
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

}
