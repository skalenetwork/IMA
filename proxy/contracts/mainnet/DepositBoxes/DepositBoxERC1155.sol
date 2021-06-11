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

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155MetadataURIUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155ReceiverUpgradeable.sol";
import "../DepositBox.sol";
import "../../Messages.sol";


// This contract runs on the main net and accepts deposits
contract DepositBoxERC1155 is DepositBox, ERC1155ReceiverUpgradeable {

    /**
     * @dev Emitted when token is mapped.
     */
    event ERC1155TokenAdded(string schainName, address indexed contractOnMainnet);
    event ERC1155TokenReady(address indexed contractOnMainnet, uint256[] ids, uint256[] amounts);

    function onERC1155Received(
        address operator,
        address,
        uint256,
        uint256,
        bytes calldata
    )
        external
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
        override
        returns(bytes4)
    {
        require(operator == address(this), "Revert ERC1155 batch transfer");
        return bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"));
    }

    function depositERC1155(
        string calldata schainName,
        address contractOnMainnet,
        address to,
        uint256 id,
        uint256 amount
    )
        external
        rightTransaction(schainName, to)
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        address contractReceiver = schainLinks[schainHash];
        require(contractReceiver != address(0), "Unconnected chain");
        require(
            IERC1155Upgradeable(contractOnMainnet).isApprovedForAll(msg.sender, address(this)),
            "DepositBox was not approved for ERC1155 token"
        );
        bytes memory data = _receiveERC1155(
            schainName,
            contractOnMainnet,
            to,
            id,
            amount
        );
        IERC1155Upgradeable(contractOnMainnet).safeTransferFrom(msg.sender, address(this), id, amount, "");
        messageProxy.postOutgoingMessage(
            schainHash,
            contractReceiver,
            data
        );
    }

    function depositERC1155Batch(
        string calldata schainName,
        address contractOnMainnet,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    )
        external
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        address contractReceiver = schainLinks[schainHash];
        require(to != address(0), "Receiver address cannot be null");
        require(contractReceiver != address(0), "Unconnected chain");
        require(
            IERC1155Upgradeable(contractOnMainnet).isApprovedForAll(msg.sender, address(this)),
            "DepositBox was not approved for ERC1155 token Batch"
        );
        bytes memory data = _receiveERC1155Batch(
            schainName,
            contractOnMainnet,
            to,
            ids,
            amounts
        );
        IERC1155Upgradeable(contractOnMainnet).safeBatchTransferFrom(msg.sender, address(this), ids, amounts, "");
        messageProxy.postOutgoingMessage(
            schainHash,
            contractReceiver,
            data
        );
    }

    function postMessage(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        onlyMessageProxy
        returns (address receiver)
    {
        require(
            schainHash != keccak256(abi.encodePacked("Mainnet")) &&
            sender == schainLinks[schainHash],
            "Receiver chain is incorrect"
        );
        Messages.MessageType operation = Messages.getMessageType(data);
        if (operation == Messages.MessageType.TRANSFER_ERC1155) {
            Messages.TransferErc1155Message memory message = Messages.decodeTransferErc1155Message(data);
            require(message.token.isContract(), "Given address is not a contract");
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

    /**
     * @dev Allows Schain owner to add an ERC1155 token to LockAndDataForMainnetERC20.
     */
    function addERC1155TokenByOwner(
        string calldata schainName,
        address erc1155OnMainnet
    )
        external
        onlySchainOwner(schainName)
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(erc1155OnMainnet.isContract(), "Given address is not a contract");
        // require(!withoutWhitelist[schainHash], "Whitelist is enabled");
        schainToERC[schainHash][erc1155OnMainnet] = true;
        emit ERC1155TokenAdded(schainName, erc1155OnMainnet);
    }



    /**
     * @dev Should return true if token in whitelist.
     */
    function getSchainToERC(string calldata schainName, address erc1155OnMainnet) external view returns (bool) {
        return schainToERC[keccak256(abi.encodePacked(schainName))][erc1155OnMainnet];
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
        __ERC1155Receiver_init();
    }

    /**
     * @dev Allows DepositBox to receive ERC1155 tokens.
     * 
     * Emits an {ERC1155TokenAdded} event.  
     */
    function _receiveERC1155(
        string calldata schainName,
        address contractOnMainnet,
        address to,
        uint256 id,
        uint256 amount
    )
        private
        returns (bytes memory data)
    {
        bool isERC1155AddedToSchain = schainToERC[keccak256(abi.encodePacked(schainName))][contractOnMainnet];
        if (!isERC1155AddedToSchain) {
            _addERC1155ForSchain(schainName, contractOnMainnet);
            data = Messages.encodeTransferErc1155AndTokenInfoMessage(
                contractOnMainnet,
                to,
                id,
                amount,
                _getTokenInfo(IERC1155MetadataURIUpgradeable(contractOnMainnet))
            );
            emit ERC1155TokenAdded(schainName, contractOnMainnet);
        } else {
            data = Messages.encodeTransferErc1155Message(contractOnMainnet, to, id, amount);
        }
        
        emit ERC1155TokenReady(contractOnMainnet, _asSingletonArray(id), _asSingletonArray(amount));
    }

    /**
     * @dev Allows DepositBox to receive ERC1155 tokens.
     * 
     * Emits an {ERC1155TokenAdded} event.  
     */
    function _receiveERC1155Batch(
        string calldata schainName,
        address contractOnMainnet,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    )
        private
        returns (bytes memory data)
    {
        bool isERC1155AddedToSchain = schainToERC[keccak256(abi.encodePacked(schainName))][contractOnMainnet];
        if (!isERC1155AddedToSchain) {
            _addERC1155ForSchain(schainName, contractOnMainnet);
            data = Messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                contractOnMainnet,
                to,
                ids,
                amounts,
                _getTokenInfo(IERC1155MetadataURIUpgradeable(contractOnMainnet))
            );
            emit ERC1155TokenAdded(schainName, contractOnMainnet);
        } else {
            data = Messages.encodeTransferErc1155BatchMessage(contractOnMainnet, to, ids, amounts);
        }
        emit ERC1155TokenReady(contractOnMainnet, ids, amounts);
    }

    /**
     * @dev Add an ERC1155 token to mapping.
     */
    function _addERC1155ForSchain(string calldata schainName, address erc1155OnMainnet) private {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(erc1155OnMainnet.isContract(), "Given address is not a contract");
        require(withoutWhitelist[schainHash], "Whitelist is enabled");
        schainToERC[schainHash][erc1155OnMainnet] = true;
        emit ERC1155TokenAdded(schainName, erc1155OnMainnet);
    }

    function _getTokenInfo(
        IERC1155MetadataURIUpgradeable erc1155
    )
        private
        view
        returns (Messages.Erc1155TokenInfo memory)
    {
        return Messages.Erc1155TokenInfo({uri: erc1155.uri(0)});
    }

    function _asSingletonArray(uint256 element) private pure returns (uint256[] memory array) {
        array = new uint256[](1);
        array[0] = element;
    }
}
