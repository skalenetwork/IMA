// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   DepositBoxERC721.sol - SKALE Interchain Messaging Agent
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

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721MetadataUpgradeable.sol";

import "../interfaces/IMainnetContract.sol";
import "../Messages.sol";

import "./IMAConnected.sol";


// This contract runs on the main net and accepts deposits
contract DepositBoxERC721 is IMAConnected, IMainnetContract {

    // uint256 public gasConsumption;

    mapping(bytes32 => address) public tokenManagerERC721Addresses;

    mapping(bytes32 => mapping(address => bool)) public schainToERC721;
    mapping(bytes32 => bool) public withoutWhitelist;

    /**
     * @dev Emitted when token is mapped in LockAndDataForMainnetERC721.
     */
    event ERC721TokenAdded(string schainID, address indexed contractOnMainnet);
    event ERC721TokenReady(address indexed contractOnMainnet, uint256 tokenId);

    modifier rightTransaction(string memory schainID) {
        require(
            keccak256(abi.encodePacked(schainID)) != keccak256(abi.encodePacked("Mainnet")),
            "SKALE chain name is incorrect"
        );
        _;
    }

    function depositERC721(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        external
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        address tokenManagerAddress = tokenManagerERC721Addresses[schainHash];
        require(tokenManagerAddress != address(0), "Unconnected chain");
        require(
            IERC721Upgradeable(contractOnMainnet).getApproved(tokenId) == address(this),
            "DepositBox was not approved for ERC721 token"
        );
        bytes memory data = _receiveERC721(
            schainID,
            contractOnMainnet,
            to,
            tokenId
        );
        IERC721Upgradeable(contractOnMainnet).transferFrom(msg.sender, address(this), tokenId);
        messageProxy.postOutgoingMessage(
            schainHash,
            tokenManagerAddress,
            data
        );
    }

    /**
     * @dev Adds a TokenManagerERC20 address to
     * DepositBoxERC20.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner.
     * - SKALE chain must not already be added.
     * - TokenManager address must be non-zero.
     */
    function addSchainContract(string calldata schainID, address newTokenManagerERC721Address) external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainID))) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerERC721Addresses[schainHash] == address(0), "SKALE chain is already set");
        require(newTokenManagerERC721Address != address(0), "Incorrect Token Manager address");
        tokenManagerERC721Addresses[schainHash] = newTokenManagerERC721Address;
    }

    /**
     * @dev Allows Owner to remove a TokenManagerERC20 on SKALE chain
     * from DepositBoxERC20.
     *
     * Requirements:
     *
     * - `msg.sender` must be schain owner or contract owner
     * - SKALE chain must already be set.
     */
    function removeSchainContract(string calldata schainID) external override {
        require(
            msg.sender == imaLinker ||
            isSchainOwner(msg.sender, keccak256(abi.encodePacked(schainID))) ||
            _isOwner(), "Not authorized caller"
        );
        bytes32 schainHash = keccak256(abi.encodePacked(schainID));
        require(tokenManagerERC721Addresses[schainHash] != address(0), "SKALE chain is not set");
        delete tokenManagerERC721Addresses[schainHash];
    }

    function postMessage(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        returns (address)
    {
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")) &&
            sender == tokenManagerERC721Addresses[schainHash],
            "Receiver chain is incorrect"
        );
        Messages.TransferErc721Message memory message = Messages.decodeTransferErc721Message(data);
        require(message.token.isContract(), "Given address is not a contract");
        require(IERC721Upgradeable(message.token).ownerOf(message.tokenId) == address(this), "Incorrect tokenId");
        IERC721Upgradeable(message.token).transferFrom(address(this), message.receiver, message.tokenId);
        return message.receiver;
    }

    /**
     * @dev Allows Schain owner to add an ERC721 token to LockAndDataForMainnetERC20.
     */
    function addERC721TokenByOwner(string calldata schainName, address erc721OnMainnet) external {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(isSchainOwner(msg.sender, schainId) || msg.sender == getOwner(), "Sender is not a Schain owner");
        require(erc721OnMainnet.isContract(), "Given address is not a contract");
        // require(!withoutWhitelist[schainId], "Whitelist is enabled");
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
     * @dev Checks whether depositBoxERC721 is connected to a SKALE chain TokenManagerERC721.
     */
    function hasSchainContract(string calldata schainID) external view override returns (bool) {
        return tokenManagerERC721Addresses[keccak256(abi.encodePacked(schainID))] != address(0);
    }

    /// Create a new deposit box
    function initialize(
        address newContractManagerOfSkaleManager,
        address newMessageProxyAddress,
        address newIMALinkerAddress
    )
        public
        override
        initializer
    {
        IMAConnected.initialize(newIMALinkerAddress, newContractManagerOfSkaleManager, newMessageProxyAddress);
        // gasConsumption = 500000;
    }

    /**
     * @dev Allows DepositBox to receive ERC721 tokens.
     * 
     * Emits an {ERC721TokenAdded} event.  
     */
    function _receiveERC721(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        private
        returns (bytes memory data)
    {
        bool isERC721AddedToSchain = schainToERC721[keccak256(abi.encodePacked(schainID))][contractOnMainnet];
        if (!isERC721AddedToSchain) {
            _addERC721ForSchain(schainID, contractOnMainnet);
            emit ERC721TokenAdded(schainID, contractOnMainnet);
            data = Messages.encodeTransferErc721AndTokenInfoMessage(
                contractOnMainnet,
                to,
                tokenId,
                _getTokenInfo(IERC721MetadataUpgradeable(contractOnMainnet))
            );
        } else {
            data = Messages.encodeTransferErc721Message(contractOnMainnet, to, tokenId);
        }
        emit ERC721TokenReady(contractOnMainnet, tokenId);
    }

    /**
     * @dev Allows DepositBox to send ERC721 tokens.
     */
    function _sendERC721(bytes calldata data) private returns (bool) {
        Messages.TransferErc721Message memory message = Messages.decodeTransferErc721Message(data);
        require(message.token.isContract(), "Given address is not a contract");
        require(IERC721Upgradeable(message.token).ownerOf(message.tokenId) == address(this), "Incorrect tokenId");
        IERC721Upgradeable(message.token).transferFrom(address(this), message.receiver, message.tokenId);
        return true;
    }

    /**
     * @dev Allows ERC721ModuleForMainnet to add an ERC721 token to
     * LockAndDataForMainnetERC721.
     */
    function _addERC721ForSchain(string calldata schainName, address erc721OnMainnet) private {
        bytes32 schainId = keccak256(abi.encodePacked(schainName));
        require(erc721OnMainnet.isContract(), "Given address is not a contract");
        require(withoutWhitelist[schainId], "Whitelist is enabled");
        schainToERC721[schainId][erc721OnMainnet] = true;
        emit ERC721TokenAdded(schainName, erc721OnMainnet);
    }

    function _getTokenInfo(IERC721MetadataUpgradeable erc721) private view returns (Messages.Erc721TokenInfo memory) {
        return Messages.Erc721TokenInfo({
            name: erc721.name(),
            symbol: erc721.symbol()
        });
    }
}
