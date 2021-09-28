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

pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../DepositBox.sol";
import "../../Messages.sol";


/**
 * @title DepositBoxERC721
 * @dev Runs on mainnet,
 * accepts messages from schain,
 * stores deposits of ERC721.
 */
contract DepositBoxERC721 is DepositBox {
    using AddressUpgradeable for address;

    // schainHash => address of ERC on Mainnet
    mapping(bytes32 => mapping(address => bool)) public schainToERC721;
    mapping(address => mapping(uint256 => bytes32)) public transferredAmount;

    /**
     * @dev Emitted when token is mapped in DepositBoxERC721.
     */
    event ERC721TokenAdded(string schainName, address indexed contractOnMainnet);

    /**
     * @dev Emitted when token is received by DepositBox and is ready to be cloned
     * or transferred on SKALE chain.
     */
    event ERC721TokenReady(address indexed contractOnMainnet, uint256 tokenId);

    /**
     * @dev Allows `msg.sender` to send ERC721 token from mainnet to schain.
     * 
     * Requirements:
     * 
     * - Receiver contract should be defined.
     * - `msg.sender` should approve their token for DepositBoxERC721 address.
     */
    function depositERC721(
        string calldata schainName,
        address erc721OnMainnet,
        uint256 tokenId
    )
        external
        rightTransaction(schainName, msg.sender)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        address contractReceiver = schainLinks[schainHash];
        require(contractReceiver != address(0), "Unconnected chain");
        require(
            IERC721Upgradeable(erc721OnMainnet).getApproved(tokenId) == address(this),
            "DepositBox was not approved for ERC721 token"
        );
        bytes memory data = _receiveERC721(
            schainName,
            erc721OnMainnet,
            msg.sender,
            tokenId
        );
        if (!linker.interchainConnections(schainHash))
            _saveTransferredAmount(schainHash, erc721OnMainnet, tokenId);
        IERC721Upgradeable(erc721OnMainnet).transferFrom(msg.sender, address(this), tokenId);
        messageProxy.postOutgoingMessage(
            schainHash,
            contractReceiver,
            data
        );
    }

    /**
     * @dev Allows MessageProxyForMainnet contract to execute transferring ERC721 token from schain to mainnet.
     * 
     * Requirements:
     * 
     * - Schain from which the tokens came should not be killed.
     * - Sender contract should be defined and schain name cannot be `Mainnet`.
     * - DepositBoxERC721 contract should own token.
     */
    function postMessage(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        whenNotKilled(schainHash)
        checkReceiverChain(schainHash, sender)
        returns (address)
    {
        Messages.TransferErc721Message memory message = Messages.decodeTransferErc721Message(data);
        require(message.token.isContract(), "Given address is not a contract");
        require(IERC721Upgradeable(message.token).ownerOf(message.tokenId) == address(this), "Incorrect tokenId");
        if (!linker.interchainConnections(schainHash))
            _removeTransferredAmount(message.token, message.tokenId);
        IERC721Upgradeable(message.token).transferFrom(address(this), message.receiver, message.tokenId);
        return message.receiver;
    }

    function gasPayer(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        view
        override
        checkReceiverChain(schainHash, sender)
        returns (address)
    {
        Messages.TransferErc721Message memory message = Messages.decodeTransferErc721Message(data);
        return message.receiver;
    }

    /**
     * @dev Allows Schain owner to add an ERC721 token to DepositBoxERC721.
     * 
     * Emits an {ERC721TokenAdded} event.
     * 
     * Requirements:
     * 
     * - Schain should not be killed.
     * - Only owner of the schain able to run function.
     */
    function addERC721TokenByOwner(string calldata schainName, address erc721OnMainnet)
        external
        onlySchainOwner(schainName)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        _addERC721ForSchain(schainName, erc721OnMainnet);
    }

    /**
     * @dev Allows Schain owner to return each user their tokens.
     * The Schain owner decides which tokens to send to which address, 
     * since the contract on mainnet does not store information about which tokens belong to whom.
     *
     * Requirements:
     * 
     * - DepositBoxERC721 contract should own such token.
     */
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
     * @dev Should return true if token was added by Schain owner or 
     * automatically added after sending to schain if whitelist was turned off.
     */
    function getSchainToERC721(string calldata schainName, address erc721OnMainnet) external view returns (bool) {
        return schainToERC721[keccak256(abi.encodePacked(schainName))][erc721OnMainnet];
    }

    /**
     * @dev Creates a new DepositBoxERC721 contract.
     */
    function initialize(
        IContractManager contractManagerOfSkaleManagerValue,        
        Linker linkerValue,
        MessageProxyForMainnet messageProxyValue
    )
        public
        override
        initializer
    {
        DepositBox.initialize(contractManagerOfSkaleManagerValue, linkerValue, messageProxyValue);
    }

    /**
     * @dev Saves the ids of tokens that was transferred to schain.
     */
    function _saveTransferredAmount(bytes32 schainHash, address erc721Token, uint256 tokenId) private {
        transferredAmount[erc721Token][tokenId] = schainHash;
    }

    /**
     * @dev Removes the ids of tokens that was transferred from schain.
     */
    function _removeTransferredAmount(address erc721Token, uint256 tokenId) private {
        transferredAmount[erc721Token][tokenId] = bytes32(0);
    }

    /**
     * @dev Allows DepositBoxERC721 to receive ERC721 tokens.
     * 
     * Emits an {ERC721TokenReady} event.
     * 
     * Requirements:
     * 
     * - Whitelist should be turned off for auto adding tokens to DepositBoxERC721.
     */
    function _receiveERC721(
        string calldata schainName,
        address erc721OnMainnet,
        address to,
        uint256 tokenId
    )
        private
        returns (bytes memory data)
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        bool isERC721AddedToSchain = schainToERC721[schainHash][erc721OnMainnet];
        if (!isERC721AddedToSchain) {
            require(!isWhitelisted(schainName), "Whitelist is enabled");
            _addERC721ForSchain(schainName, erc721OnMainnet);
            data = Messages.encodeTransferErc721AndTokenInfoMessage(
                erc721OnMainnet,
                to,
                tokenId,
                _getTokenInfo(IERC721MetadataUpgradeable(erc721OnMainnet))
            );
        } else {
            data = Messages.encodeTransferErc721Message(erc721OnMainnet, to, tokenId);
        }
        emit ERC721TokenReady(erc721OnMainnet, tokenId);
    }

    /**
     * @dev Adds an ERC721 token to DepositBoxERC721.
     * 
     * Emits an {ERC721TokenAdded} event.
     * 
     * Requirements:
     * 
     * - Given address should be contract.
     */
    function _addERC721ForSchain(string calldata schainName, address erc721OnMainnet) private {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(erc721OnMainnet.isContract(), "Given address is not a contract");
        schainToERC721[schainHash][erc721OnMainnet] = true;
        emit ERC721TokenAdded(schainName, erc721OnMainnet);
    }

    /**
     * @dev Returns info about ERC721 token such as token name, symbol.
     */
    function _getTokenInfo(IERC721MetadataUpgradeable erc721) private view returns (Messages.Erc721TokenInfo memory) {
        return Messages.Erc721TokenInfo({
            name: erc721.name(),
            symbol: erc721.symbol()
        });
    }
}
