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
import "../DepositBox.sol";
import "../../Messages.sol";


// This contract runs on the main net and accepts deposits
contract DepositBoxERC721 is DepositBox {

    // uint256 public gasConsumption;

    mapping(bytes32 => address) public tokenManagerERC721Addresses;

    mapping(bytes32 => mapping(address => bool)) public schainToERC721;
    mapping(bytes32 => bool) public withoutWhitelist;

    mapping(address => mapping(uint256 => bytes32)) public transferredAmount;

    /**
     * @dev Emitted when token is mapped in LockAndDataForMainnetERC721.
     */
    event ERC721TokenAdded(string schainName, address indexed contractOnMainnet);
    event ERC721TokenReady(address indexed contractOnMainnet, uint256 tokenId);

    modifier rightTransaction(string memory schainName) {
        require(
            keccak256(abi.encodePacked(schainName)) != keccak256(abi.encodePacked("Mainnet")),
            "SKALE chain name is incorrect"
        );
        _;
    }

    function depositERC721(
        string calldata schainName,
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        external
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        address tokenManagerAddress = tokenManagerERC721Addresses[schainHash];
        require(to != address(0), "Receiver address cannot be null");
        require(tokenManagerAddress != address(0), "Unconnected chain");
        require(
            IERC721Upgradeable(contractOnMainnet).getApproved(tokenId) == address(this),
            "DepositBox was not approved for ERC721 token"
        );
        bytes memory data = _receiveERC721(
            schainName,
            contractOnMainnet,
            to,
            tokenId
        );
        if (!linker.interchainConnections(schainHash))
            _saveTransferredAmount(schainHash, contractOnMainnet, tokenId);
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
    function addSchainContract(string calldata schainName, address newTokenManagerERC721Address) external override {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            hasRole(DEPOSIT_BOX_MANAGER_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainHash) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );
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
    function removeSchainContract(string calldata schainName) external override {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(
            hasRole(DEPOSIT_BOX_MANAGER_ROLE, msg.sender) ||
            isSchainOwner(msg.sender, schainHash) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized caller"
        );        
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
        whenNotKilled(schainHash)
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
        if (!linker.interchainConnections(schainHash))
            _removeTransferredAmount(message.token, message.tokenId);
        IERC721Upgradeable(message.token).transferFrom(address(this), message.receiver, message.tokenId);
        return message.receiver;
    }

    /**
     * @dev Allows Schain owner to add an ERC721 token to LockAndDataForMainnetERC20.
     */
    function addERC721TokenByOwner(string calldata schainName, address erc721OnMainnet)
        external
        onlySchainOwner(schainName)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(erc721OnMainnet.isContract(), "Given address is not a contract");
        // require(!withoutWhitelist[schainHash], "Whitelist is enabled");
        schainToERC721[schainHash][erc721OnMainnet] = true;
        emit ERC721TokenAdded(schainName, erc721OnMainnet);
    }

    /**
     * @dev Allows Schain owner turn on whitelist of tokens.
     */
    function enableWhitelist(string memory schainName) external onlySchainOwner(schainName) {
        withoutWhitelist[keccak256(abi.encodePacked(schainName))] = false;
    }

    /**
     * @dev Allows Schain owner turn off whitelist of tokens.
     */
    function disableWhitelist(string memory schainName) external onlySchainOwner(schainName) {
        withoutWhitelist[keccak256(abi.encodePacked(schainName))] = true;
    }

    function getFunds(string calldata schainName, address erc721OnMainnet, address receiver, uint tokenId)
        external
        onlySchainOwner(schainName)
        whenKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(transferredAmount[erc721OnMainnet][tokenId] == schainHash, "Incorrect tokenId");
        _removeTransferredAmount(erc721OnMainnet, tokenId);
        IERC721Upgradeable(erc721OnMainnet).transferFrom(address(this), receiver, tokenId);
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
    function hasSchainContract(string calldata schainName) external view override returns (bool) {
        return tokenManagerERC721Addresses[keccak256(abi.encodePacked(schainName))] != address(0);
    }

    /// Create a new deposit box
    function initialize(
        IContractManager contractManagerOfSkaleManager,        
        Linker linker,
        MessageProxyForMainnet messageProxy
    )
        public
        override
        initializer
    {
        DepositBox.initialize(contractManagerOfSkaleManager, linker, messageProxy);
    }

    function _saveTransferredAmount(bytes32 schainHash, address erc721Token, uint256 tokenId) private {
        transferredAmount[erc721Token][tokenId] = schainHash;
    }

    function _removeTransferredAmount(address erc721Token, uint256 tokenId) private {
        transferredAmount[erc721Token][tokenId] = bytes32(0);
    }

    /**
     * @dev Allows DepositBox to receive ERC721 tokens.
     * 
     * Emits an {ERC721TokenAdded} event.  
     */
    function _receiveERC721(
        string calldata schainName,
        address contractOnMainnet,
        address to,
        uint256 tokenId
    )
        private
        returns (bytes memory data)
    {
        bool isERC721AddedToSchain = schainToERC721[keccak256(abi.encodePacked(schainName))][contractOnMainnet];
        if (!isERC721AddedToSchain) {
            _addERC721ForSchain(schainName, contractOnMainnet);
            emit ERC721TokenAdded(schainName, contractOnMainnet);
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
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(erc721OnMainnet.isContract(), "Given address is not a contract");
        require(withoutWhitelist[schainHash], "Whitelist is enabled");
        schainToERC721[schainHash][erc721OnMainnet] = true;
        emit ERC721TokenAdded(schainName, erc721OnMainnet);
    }

    function _getTokenInfo(IERC721MetadataUpgradeable erc721) private view returns (Messages.Erc721TokenInfo memory) {
        return Messages.Erc721TokenInfo({
            name: erc721.name(),
            symbol: erc721.symbol()
        });
    }
}
