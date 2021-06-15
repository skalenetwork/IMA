// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   TokenManager.sol - SKALE Interchain Messaging Agent
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
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";

import "../../Messages.sol";
import "../tokens/ERC1155OnChain.sol";
import "../TokenManager.sol";


/**
 * @title Token Manager
 * @dev Runs on SKALE Chains, accepts messages from mainnet, and instructs
 * TokenFactory to create clones. TokenManager mints tokens via
 * LockAndDataForSchain*. When a user exits a SKALE chain, TokenFactory
 * burns tokens.
 */
contract TokenManagerERC1155 is TokenManager {

    // address of ERC1155 on Mainnet => ERC1155 on Schain
    mapping(address => ERC1155OnChain) public clonesErc1155;

    event ERC1155TokenAdded(address indexed erc1155OnMainnet, address indexed erc1155OnSchain);

    event ERC1155TokenCreated(address indexed erc1155OnMainnet, address indexed erc1155OnSchain);

    event ERC1155TokenReceived(
        address indexed erc1155OnMainnet,
        address indexed erc1155OnSchain,
        uint256[] ids,
        uint256[] amounts
    );  

    function exitToMainERC1155(
        address contractOnMainnet,
        address to,
        uint256 id,
        uint256 amount
    )
        external
    {
         communityLocker.checkAllowedToSendMessage(to);
        _exit(MAINNET_HASH, depositBox, contractOnMainnet, to, id, amount);
        // require(address(contractOnSchain).isContract(), "No token clone on schain");
        // require(contractOnSchain.isApprovedForAll(msg.sender, address(this)), "Not allowed ERC1155 Token");
        // contractOnSchain.burn(msg.sender, id, amount);
        // bytes memory data = Messages.encodeTransferErc1155Message(contractOnMainnet, to, id, amount);
        // messageProxy.postOutgoingMessage(MAINNET_NAME, depositBox, data);
    }

    function exitToMainERC1155Batch(
        address contractOnMainnet,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    )
        external
    {
        // require(to != address(0), "Incorrect receiver address");
        // ERC1155BurnableUpgradeable contractOnSchain = clonesErc1155[contractOnMainnet];
        communityLocker.checkAllowedToSendMessage(to);
        _exitBatch(MAINNET_HASH, depositBox, contractOnMainnet, to, ids, amounts);
        // require(address(contractOnSchain).isContract(), "No token clone on schain");
        // require(contractOnSchain.isApprovedForAll(msg.sender, address(this)), "Not allowed ERC1155 Token");
        // contractOnSchain.burnBatch(msg.sender, ids, amounts);
        // bytes memory data = Messages.encodeTransferErc1155BatchMessage(contractOnMainnet, to, ids, amounts);
        // messageProxy.postOutgoingMessage(MAINNET_NAME, depositBox, data);
    }

    function transferToSchainERC1155(
        string calldata targetSchainName,
        address contractOnMainnet,
        address to,
        uint256 id,
        uint256 amount
    ) 
        external
    {
        bytes32 targetSchainHash = keccak256(abi.encodePacked(targetSchainName));
        require(
            targetSchainHash != MAINNET_HASH,
            "This function is not for transferring to Mainnet"
        );
        require(tokenManagers[targetSchainHash] != address(0), "Incorrect Token Manager address");
        _exit(targetSchainHash, tokenManagers[targetSchainHash], contractOnMainnet, to, id, amount);
        // require(tokenManagers[targetSchainHash] != address(0), "Incorrect Token Manager address");
        // ERC1155BurnableUpgradeable contractOnSchain = clonesErc1155[contractOnMainnet];
        // require(address(contractOnSchain).isContract(), "No token clone on schain");
        // require(contractOnSchain.isApprovedForAll(msg.sender, address(this)), "Not allowed ERC1155 Token");
        // contractOnSchain.burn(msg.sender, id, amount);
        // bytes memory data = Messages.encodeTransferErc1155Message(contractOnMainnet, to, id, amount);    
        // messageProxy.postOutgoingMessage(targetSchainName, tokenManagers[targetSchainHash], data);
    }

    function transferToSchainERC1155Batch(
        string calldata targetSchainName,
        address contractOnMainnet,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) 
        external
    {
        bytes32 targetSchainHash = keccak256(abi.encodePacked(targetSchainName));
        require(
            targetSchainHash != MAINNET_HASH,
            "This function is not for transferring to Mainnet"
        );
        require(tokenManagers[targetSchainHash] != address(0), "Incorrect Token Manager address");
        _exitBatch(targetSchainHash, tokenManagers[targetSchainHash], contractOnMainnet, to, ids, amounts);
        // require(tokenManagers[targetSchainHash] != address(0), "Incorrect Token Manager address");
        // ERC1155BurnableUpgradeable contractOnSchain = clonesErc1155[contractOnMainnet];
        // require(address(contractOnSchain).isContract(), "No token clone on schain");
        // require(contractOnSchain.isApprovedForAll(msg.sender, address(this)), "Not allowed ERC1155 Token");
        // contractOnSchain.burnBatch(msg.sender, ids, amounts);
        // bytes memory data = Messages.encodeTransferErc1155BatchMessage(contractOnMainnet, to, ids, amounts);
        // messageProxy.postOutgoingMessage(targetSchainName, tokenManagers[targetSchainHash], data);
    }

    /**
     * @dev Allows MessageProxy to post operational message from mainnet
     * or SKALE chains.
     * 
     * Emits an {Error} event upon failure.
     *
     * Requirements:
     * 
     * - MessageProxy must be the sender.
     * - `fromSchainName` must exist in TokenManager addresses.
     */
    function postMessage(
        bytes32 fromChainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        returns (address)
    {
        require(
            fromChainHash != schainHash && 
            (
                fromChainHash == MAINNET_HASH ?
                sender == depositBox :
                sender == tokenManagers[fromChainHash]
            ),
            "Receiver chain is incorrect"
        );
        Messages.MessageType operation = Messages.getMessageType(data);
        address receiver = address(0);
        if (
            operation == Messages.MessageType.TRANSFER_ERC1155 ||
            operation == Messages.MessageType.TRANSFER_ERC1155_AND_TOKEN_INFO
        ) {
            receiver = _sendERC1155(data);
        } else if (
            operation == Messages.MessageType.TRANSFER_ERC1155_BATCH ||
            operation == Messages.MessageType.TRANSFER_ERC1155_BATCH_AND_TOKEN_INFO
        ) {
            receiver = _sendERC1155Batch(data);
        } else {
            revert("MessageType is unknown");
        }
        return receiver;
    }

    /**
     * @dev Allows Schain owner to add an ERC1155 token to LockAndDataForSchainERC1155.
     */
    function addERC1155TokenByOwner(
        address erc1155OnMainnet,
        ERC1155OnChain erc1155OnSchain
    )
        external
        onlyTokenRegistrar
    {
        require(address(erc1155OnSchain).isContract(), "Given address is not a contract");
        clonesErc1155[erc1155OnMainnet] = erc1155OnSchain;
        emit ERC1155TokenAdded(erc1155OnMainnet, address(erc1155OnSchain));
    }

    function initialize(
        string memory newChainName,
        MessageProxyForSchain newMessageProxy,
        TokenManagerLinker newIMALinker,
        CommunityLocker newCommunityLocker,
        address newDepositBox
    )
        public
        initializer
    {
        TokenManager.initializeTokenManager(
            newChainName,
            newMessageProxy,
            newIMALinker,
            newCommunityLocker,
            newDepositBox
        );
    }


    /**
     * @dev Allows TokenManager to send ERC1155 tokens.
     *  
     * Emits a {ERC1155TokenCreated} event if to address = 0.
     */
    function _sendERC1155(bytes calldata data) private returns (address) {
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256 id;
        uint256 amount;
        if (messageType == Messages.MessageType.TRANSFER_ERC1155){
            Messages.TransferErc1155Message memory message = Messages.decodeTransferErc1155Message(data);
            receiver = message.receiver;
            token = message.token;
            id = message.id;
            amount = message.amount;
        } else {
            Messages.TransferErc1155AndTokenInfoMessage memory message =
                Messages.decodeTransferErc1155AndTokenInfoMessage(data);
            receiver = message.baseErc1155transfer.receiver;
            token = message.baseErc1155transfer.token;
            id = message.baseErc1155transfer.id;
            amount = message.baseErc1155transfer.amount;
            ERC1155OnChain contractOnSchainTmp = clonesErc1155[token];
            if (address(contractOnSchainTmp) == address(0)) {
                require(automaticDeploy, "Automatic deploy is disabled");
                contractOnSchainTmp = new ERC1155OnChain(message.tokenInfo.uri);
                clonesErc1155[token] = contractOnSchainTmp;
                emit ERC1155TokenCreated(token, address(contractOnSchainTmp));
            }
        }
        ERC1155OnChain contractOnSchain = clonesErc1155[token];
        require(address(contractOnSchain).isContract(), "Given address is not a contract");
        contractOnSchain.mint(receiver, id, amount, "");
        emit ERC1155TokenReceived(token, address(contractOnSchain), _asSingletonArray(id), _asSingletonArray(amount));
        return receiver;
    }

    /**
     * @dev Allows TokenManager to send ERC1155 tokens.
     *  
     * Emits a {ERC1155TokenCreated} event if to address = 0.
     */
    function _sendERC1155Batch(bytes calldata data) private returns (address) {
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256[] memory ids;
        uint256[] memory amounts;
        if (messageType == Messages.MessageType.TRANSFER_ERC1155_BATCH){
            Messages.TransferErc1155BatchMessage memory message = Messages.decodeTransferErc1155BatchMessage(data);
            receiver = message.receiver;
            token = message.token;
            ids = message.ids;
            amounts = message.amounts;
        } else {
            Messages.TransferErc1155BatchAndTokenInfoMessage memory message =
                Messages.decodeTransferErc1155BatchAndTokenInfoMessage(data);
            receiver = message.baseErc1155Batchtransfer.receiver;
            token = message.baseErc1155Batchtransfer.token;
            ids = message.baseErc1155Batchtransfer.ids;
            amounts = message.baseErc1155Batchtransfer.amounts;
            ERC1155OnChain contractOnSchainTmp = clonesErc1155[token];
            if (address(contractOnSchainTmp) == address(0)) {
                require(automaticDeploy, "Automatic deploy is disabled");
                contractOnSchainTmp = new ERC1155OnChain(message.tokenInfo.uri);
                clonesErc1155[token] = contractOnSchainTmp;
                emit ERC1155TokenCreated(token, address(contractOnSchainTmp));
            }
        }
        ERC1155OnChain contractOnSchain = clonesErc1155[token];
        require(address(contractOnSchain).isContract(), "Given address is not a contract");
        contractOnSchain.mintBatch(receiver, ids, amounts, "");
        emit ERC1155TokenReceived(token, address(contractOnSchain), ids, amounts);
        return receiver;
    }

    function _exit(
        bytes32 chainHash,
        address messageReceiver,
        address contractOnMainnet,
        address to,
        uint256 id,
        uint256 amount
    )
        private
    {
        require(to != address(0), "Incorrect receiver address");
        ERC1155BurnableUpgradeable contractOnSchain = clonesErc1155[contractOnMainnet];
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.isApprovedForAll(msg.sender, address(this)), "Not allowed ERC1155 Token");
        contractOnSchain.burn(msg.sender, id, amount);
        bytes memory data = Messages.encodeTransferErc1155Message(contractOnMainnet, to, id, amount);        
        messageProxy.postOutgoingMessage(chainHash, messageReceiver, data);
    }

    function _exitBatch(
        bytes32 chainHash,
        address messageReceiver,
        address contractOnMainnet,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    )
        private
    {
        require(to != address(0), "Incorrect receiver address");
        ERC1155BurnableUpgradeable contractOnSchain = clonesErc1155[contractOnMainnet];
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.isApprovedForAll(msg.sender, address(this)), "Not allowed ERC1155 Token");
        contractOnSchain.burnBatch(msg.sender, ids, amounts);
        bytes memory data = Messages.encodeTransferErc1155BatchMessage(contractOnMainnet, to, ids, amounts);
        messageProxy.postOutgoingMessage(chainHash, messageReceiver, data);
    }

    function _asSingletonArray(uint256 element) private pure returns (uint256[] memory array) {
        array = new uint256[](1);
        array[0] = element;
    }

}
