// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   DepositBoxERC1155.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/IERC1155MetadataURIUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/utils/ERC1155ReceiverUpgradeable.sol";
import "../DepositBox.sol";
import "../../Messages.sol";


/**
 * @title DepositBoxERC1155
 * @dev Runs on mainnet,
 * accepts messages from schain,
 * stores deposits of ERC1155.
 */
contract DepositBoxERC1155 is DepositBox, ERC1155ReceiverUpgradeable {

    using AddressUpgradeable for address;


    // schainHash => address of ERC on Mainnet
    mapping(bytes32 => mapping(address => bool)) public schainToERC1155;
    mapping(bytes32 => mapping(address => mapping(uint256 => uint256))) public transferredAmount;

    /**
     * @dev Emitted when token is mapped in DepositBoxERC20.
     */
    event ERC1155TokenAdded(string schainName, address indexed contractOnMainnet);

    /**
     * @dev Emitted when token is received by DepositBox and is ready to be cloned
     * or transferred on SKALE chain.
     */
    event ERC1155TokenReady(address indexed contractOnMainnet, uint256[] ids, uint256[] amounts);

    function onERC1155Received(
        address operator,
        address,
        uint256,
        uint256,
        bytes calldata
    )
        external
        view
        override
        returns(bytes4)
    {
        require(operator == address(this), "Revert ERC1155 transfer");
        return bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
    }

    function onERC1155BatchReceived(
        address operator,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    )
        external
        view
        override
        returns(bytes4)
    {
        require(operator == address(this), "Revert ERC1155 batch transfer");
        return bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"));
    }

    /**
     * @dev Allows `msg.sender` to send ERC1155 token from mainnet to schain.
     * 
     * Requirements:
     * 
     * - Receiver contract should be defined.
     * - `msg.sender` should approve their tokens for DepositBoxERC1155 address.
     */
    function depositERC1155(
        string calldata schainName,
        address erc1155OnMainnet,
        uint256 id,
        uint256 amount
    )
        external
        rightTransaction(schainName, msg.sender)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        address contractReceiver = schainLinks[schainHash];
        require(contractReceiver != address(0), "Unconnected chain");
        require(
            IERC1155Upgradeable(erc1155OnMainnet).isApprovedForAll(msg.sender, address(this)),
            "DepositBox was not approved for ERC1155 token"
        );
        bytes memory data = _receiveERC1155(
            schainName,
            erc1155OnMainnet,
            msg.sender,
            id,
            amount
        );
        if (!linker.interchainConnections(schainHash))
            _saveTransferredAmount(schainHash, erc1155OnMainnet, _asSingletonArray(id), _asSingletonArray(amount));
        IERC1155Upgradeable(erc1155OnMainnet).safeTransferFrom(msg.sender, address(this), id, amount, "");
        messageProxy.postOutgoingMessage(
            schainHash,
            contractReceiver,
            data
        );
    }

    /**
     * @dev Allows `msg.sender` to send batch of ERC1155 tokens from mainnet to schain.
     * 
     * Requirements:
     * 
     * - Receiver contract should be defined.
     * - `msg.sender` should approve their tokens for DepositBoxERC1155 address.
     */
    function depositERC1155Batch(
        string calldata schainName,
        address erc1155OnMainnet,
        uint256[] calldata ids,
        uint256[] calldata amounts
    )
        external
        rightTransaction(schainName, msg.sender)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        address contractReceiver = schainLinks[schainHash];
        require(contractReceiver != address(0), "Unconnected chain");
        require(
            IERC1155Upgradeable(erc1155OnMainnet).isApprovedForAll(msg.sender, address(this)),
            "DepositBox was not approved for ERC1155 token Batch"
        );
        bytes memory data = _receiveERC1155Batch(
            schainName,
            erc1155OnMainnet,
            msg.sender,
            ids,
            amounts
        );
        if (!linker.interchainConnections(schainHash))
            _saveTransferredAmount(schainHash, erc1155OnMainnet, ids, amounts);
        IERC1155Upgradeable(erc1155OnMainnet).safeBatchTransferFrom(msg.sender, address(this), ids, amounts, "");
        messageProxy.postOutgoingMessage(
            schainHash,
            contractReceiver,
            data
        );
    }

    /**
     * @dev Allows MessageProxyForMainnet contract to execute transferring ERC1155 token from schain to mainnet.
     * 
     * Requirements:
     * 
     * - Schain from which the tokens came should not be killed.
     * - Sender contract should be added to DepositBoxERC1155 and schain name cannot be `Mainnet`.
     * - Amount of tokens on DepositBoxERC1155 should be equal or more than transferred amount.
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
        returns (address receiver)
    {
        Messages.MessageType operation = Messages.getMessageType(data);
        if (operation == Messages.MessageType.TRANSFER_ERC1155) {
            Messages.TransferErc1155Message memory message = Messages.decodeTransferErc1155Message(data);
            require(message.token.isContract(), "Given address is not a contract");
            if (!linker.interchainConnections(schainHash))
                _removeTransferredAmount(
                    schainHash,
                    message.token,
                    _asSingletonArray(message.id),
                    _asSingletonArray(message.amount)
                );
            IERC1155Upgradeable(message.token).safeTransferFrom(
                address(this),
                message.receiver,
                message.id,
                message.amount,
                ""
            );
            receiver = message.receiver;
        } else if (operation == Messages.MessageType.TRANSFER_ERC1155_BATCH) {
            Messages.TransferErc1155BatchMessage memory message = Messages.decodeTransferErc1155BatchMessage(data);
            require(message.token.isContract(), "Given address is not a contract");
            if (!linker.interchainConnections(schainHash))
                _removeTransferredAmount(schainHash, message.token, message.ids, message.amounts);
            IERC1155Upgradeable(message.token).safeBatchTransferFrom(
                address(this),
                message.receiver,
                message.ids,
                message.amounts,
                ""
            );
            receiver = message.receiver;
        }
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
        Messages.MessageType operation = Messages.getMessageType(data);
        if (operation == Messages.MessageType.TRANSFER_ERC1155) {
            Messages.TransferErc1155Message memory message = Messages.decodeTransferErc1155Message(data);
            return message.receiver;
        } else if (operation == Messages.MessageType.TRANSFER_ERC1155_BATCH) {
            Messages.TransferErc1155BatchMessage memory message = Messages.decodeTransferErc1155BatchMessage(data);
            return message.receiver;
        }
        return address(0);
    }

    /**
     * @dev Allows Schain owner to add an ERC1155 token to DepositBoxERC1155.
     * 
     * Emits an {ERC1155TokenAdded} event.
     * 
     * Requirements:
     * 
     * - Schain should not be killed.
     * - Only owner of the schain able to run function.
     */
    function addERC1155TokenByOwner(
        string calldata schainName,
        address erc1155OnMainnet
    )
        external
        onlySchainOwner(schainName)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        _addERC1155ForSchain(schainName, erc1155OnMainnet);
    }

    /**
     * @dev Allows Schain owner to return each user their tokens.
     * The Schain owner decides which tokens to send to which address, 
     * since the contract on mainnet does not store information about which tokens belong to whom.
     *
     * Requirements:
     * 
     * - Amount of tokens on schain should be equal or more than transferred amount.
     */
    function getFunds(
        string calldata schainName,
        address erc1155OnMainnet,
        address receiver,
        uint256[] memory ids,
        uint256[] memory amounts
    )
        external
        onlySchainOwner(schainName)
        whenKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(ids.length == amounts.length, "Incorrect length of arrays");
        for (uint256 i = 0; i < ids.length; i++) {
            require(transferredAmount[schainHash][erc1155OnMainnet][ids[i]] >= amounts[i], "Incorrect amount");
        }
        _removeTransferredAmount(schainHash, erc1155OnMainnet, ids, amounts);
        IERC1155Upgradeable(erc1155OnMainnet).safeBatchTransferFrom(
            address(this),
            receiver,
            ids,
            amounts,
            ""
        );
    }

    /**
     * @dev Should return true if token was added by Schain owner or 
     * added automatically after sending to schain if whitelist was turned off.
     */
    function getSchainToERC1155(string calldata schainName, address erc1155OnMainnet) external view returns (bool) {
        return schainToERC1155[keccak256(abi.encodePacked(schainName))][erc1155OnMainnet];
    }

    /**
     * @dev Creates a new DepositBoxERC1155 contract.
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
        __ERC1155Receiver_init();
    }

    /**
     * @dev Checks whether contract supports such interface (first 4 bytes of method name and its params).
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControlEnumerableUpgradeable, ERC1155ReceiverUpgradeable)
        returns (bool)
    {
        return interfaceId == type(Twin).interfaceId
            || super.supportsInterface(interfaceId);
    }

    /**
     * @dev Saves amount of tokens that was transferred to schain.
     */
    function _saveTransferredAmount(
        bytes32 schainHash,
        address erc1155Token,
        uint256[] memory ids,
        uint256[] memory amounts
    ) private {
        require(ids.length == amounts.length, "Incorrect length of arrays");
        for (uint256 i = 0; i < ids.length; i++)
            transferredAmount[schainHash][erc1155Token][ids[i]] =
                transferredAmount[schainHash][erc1155Token][ids[i]] + amounts[i];
    }

    /**
     * @dev Removes amount of tokens that was transferred from schain.
     */
    function _removeTransferredAmount(
        bytes32 schainHash,
        address erc1155Token,
        uint256[] memory ids,
        uint256[] memory amounts
    ) private {
        require(ids.length == amounts.length, "Incorrect length of arrays");
        for (uint256 i = 0; i < ids.length; i++)
            transferredAmount[schainHash][erc1155Token][ids[i]] =
                transferredAmount[schainHash][erc1155Token][ids[i]] - amounts[i];
    }

    /**
     * @dev Allows DepositBoxERC1155 to receive ERC1155 tokens.
     * 
     * Emits an {ERC1155TokenReady} event.
     * 
     * Requirements:
     * 
     * - Whitelist should be turned off for auto adding tokens to DepositBoxERC1155.
     */
    function _receiveERC1155(
        string calldata schainName,
        address erc1155OnMainnet,
        address to,
        uint256 id,
        uint256 amount
    )
        private
        returns (bytes memory data)
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        bool isERC1155AddedToSchain = schainToERC1155[schainHash][erc1155OnMainnet];
        if (!isERC1155AddedToSchain) {
            require(!isWhitelisted(schainName), "Whitelist is enabled");
            _addERC1155ForSchain(schainName, erc1155OnMainnet);
            data = Messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnMainnet,
                to,
                id,
                amount,
                _getTokenInfo(IERC1155MetadataURIUpgradeable(erc1155OnMainnet))
            );
        } else {
            data = Messages.encodeTransferErc1155Message(erc1155OnMainnet, to, id, amount);
        }
        
        emit ERC1155TokenReady(erc1155OnMainnet, _asSingletonArray(id), _asSingletonArray(amount));
    }

    /**
     * @dev Allows DepositBoxERC1155 to receive ERC1155 tokens.
     * 
     * Emits an {ERC1155TokenReady} event.
     * 
     * Requirements:
     * 
     * - Whitelist should be turned off for auto adding tokens to DepositBoxERC1155.
     */
    function _receiveERC1155Batch(
        string calldata schainName,
        address erc1155OnMainnet,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    )
        private
        returns (bytes memory data)
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        bool isERC1155AddedToSchain = schainToERC1155[schainHash][erc1155OnMainnet];
        if (!isERC1155AddedToSchain) {
            require(!isWhitelisted(schainName), "Whitelist is enabled");
            _addERC1155ForSchain(schainName, erc1155OnMainnet);
            data = Messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnMainnet,
                to,
                ids,
                amounts,
                _getTokenInfo(IERC1155MetadataURIUpgradeable(erc1155OnMainnet))
            );
        } else {
            data = Messages.encodeTransferErc1155BatchMessage(erc1155OnMainnet, to, ids, amounts);
        }
        emit ERC1155TokenReady(erc1155OnMainnet, ids, amounts);
    }

    /**
     * @dev Adds an ERC1155 token to DepositBoxERC1155.
     * 
     * Emits an {ERC1155TokenAdded} event.
     * 
     * Requirements:
     * 
     * - Given address should be contract.
     */
    function _addERC1155ForSchain(string calldata schainName, address erc1155OnMainnet) private {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(erc1155OnMainnet.isContract(), "Given address is not a contract");
        schainToERC1155[schainHash][erc1155OnMainnet] = true;
        emit ERC1155TokenAdded(schainName, erc1155OnMainnet);
    }

    /**
     * @dev Returns info about ERC1155 token.
     */
    function _getTokenInfo(
        IERC1155MetadataURIUpgradeable erc1155
    )
        private
        view
        returns (Messages.Erc1155TokenInfo memory)
    {
        return Messages.Erc1155TokenInfo({uri: erc1155.uri(0)});
    }

    /**
     * @dev Returns array with single element that passed as argument.
     */
    function _asSingletonArray(uint256 element) private pure returns (uint256[] memory array) {
        array = new uint256[](1);
        array[0] = element;
    }
}
