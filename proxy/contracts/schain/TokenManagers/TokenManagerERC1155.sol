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

pragma solidity 0.8.6;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/IERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@skalenetwork/ima-interfaces/schain/TokenManagers/ITokenManagerERC1155.sol";

import "../../Messages.sol";
import "../tokens/ERC1155OnChain.sol";
import "../TokenManager.sol";
import "../../thirdparty/ERC1155ReceiverUpgradeableWithoutGap.sol";


/**
 * @title TokenManagerERC1155
 * @dev Runs on SKALE Chains,
 * accepts messages from mainnet,
 * and creates ERC1155 clones.
 * TokenManagerERC1155 mints tokens. When a user exits a SKALE chain, it burns them.
 */
contract TokenManagerERC1155 is TokenManager, ERC1155ReceiverUpgradeableWithoutGap, ITokenManagerERC1155 {
    using AddressUpgradeable for address;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    // address of ERC1155 on Mainnet => ERC1155 on Schain
    mapping(address => ERC1155OnChain) public deprecatedClonesErc1155;

    // address clone on schain => added or not
    mapping(ERC1155OnChain => bool) public addedClones;

    mapping(bytes32 => mapping(address => ERC1155OnChain)) public clonesErc1155;

    mapping(bytes32 => mapping(address => mapping(uint256 => uint256))) public transferredAmount;

    mapping(bytes32 => EnumerableSetUpgradeable.AddressSet) private _schainToERC1155;

    /**
     * @dev Emitted when schain owner register new ERC1155 clone.
     */
    event ERC1155TokenAdded(
        bytes32 indexed chainHash,
        address indexed erc1155OnMainnet,
        address indexed erc1155OnSchain
    );

    /**
     * @dev Emitted when TokenManagerERC1155 automatically deploys new ERC1155 clone.
     */
    event ERC1155TokenCreated(
        bytes32 indexed chainHash,
        address indexed erc1155OnMainnet,
        address indexed erc1155OnSchain
    );

    /**
     * @dev Emitted when someone sends tokens from mainnet to schain.
     */
    event ERC1155TokenReceived(
        bytes32 indexed chainHash,
        address indexed erc1155OnMainnet,
        address indexed erc1155OnSchain,
        uint256[] ids,
        uint256[] amounts
    );

    /**
     * @dev Emitted when token is received by TokenManager and is ready to be cloned
     * or transferred on SKALE chain.
     */
    event ERC1155TokenReady(
        bytes32 indexed chainHash,
        address indexed contractOnMainnet,
        uint256[] ids,
        uint256[] amounts
    );

    /**
     * @dev Move tokens from schain to mainnet.
     * 
     * {contractOnMainnet} tokens are burned on schain and unlocked on mainnet for {to} address.
     */
    function exitToMainERC1155(
        address contractOnMainnet,
        uint256 id,
        uint256 amount
    )
        external
        override
    {
        communityLocker.checkAllowedToSendMessage(msg.sender);
        _exit(MAINNET_HASH, depositBox, contractOnMainnet, msg.sender, id, amount);
    }

    /**
     * @dev Move batch of tokens from schain to mainnet.
     * 
     * {contractOnMainnet} tokens are burned on schain and unlocked on mainnet for {to} address.
     */
    function exitToMainERC1155Batch(
        address contractOnMainnet,
        uint256[] calldata ids,
        uint256[] calldata amounts
    )
        external
        override
    {
        communityLocker.checkAllowedToSendMessage(msg.sender);
        _exitBatch(MAINNET_HASH, depositBox, contractOnMainnet, msg.sender, ids, amounts);
    }

    /**
     * @dev Move tokens from schain to schain.
     * 
     * {contractOnMainnet} tokens are burned on origin schain
     * and are minted on {targetSchainName} schain for {to} address.
     */
    function transferToSchainERC1155(
        string calldata targetSchainName,
        address contractOnMainnet,
        uint256 id,
        uint256 amount
    ) 
        external
        override
        rightTransaction(targetSchainName, msg.sender)
    {
        bytes32 targetSchainHash = keccak256(abi.encodePacked(targetSchainName));
        _exit(targetSchainHash, tokenManagers[targetSchainHash], contractOnMainnet, msg.sender, id, amount);
    }

    /**
     * @dev Move batch of tokens from schain to schain.
     * 
     * {contractOnMainnet} tokens are burned on origin schain
     * and are minted on {targetSchainName} schain for {to} address.
     */
    function transferToSchainERC1155Batch(
        string calldata targetSchainName,
        address contractOnMainnet,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) 
        external
        override
        rightTransaction(targetSchainName, msg.sender)
    {
        bytes32 targetSchainHash = keccak256(abi.encodePacked(targetSchainName));
        _exitBatch(targetSchainHash, tokenManagers[targetSchainHash], contractOnMainnet, msg.sender, ids, amounts);
    }

    /**
     * @dev Allows MessageProxy to post operational message from mainnet
     * or SKALE chains.
     *
     * Requirements:
     * 
     * - MessageProxy must be the sender.
     * - `fromChainHash` must exist in TokenManagerERC1155 addresses.
     */
    function postMessage(
        bytes32 fromChainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        checkReceiverChain(fromChainHash, sender)
        returns (address)
    {
        Messages.MessageType operation = Messages.getMessageType(data);
        address receiver = address(0);
        if (
            operation == Messages.MessageType.TRANSFER_ERC1155 ||
            operation == Messages.MessageType.TRANSFER_ERC1155_AND_TOKEN_INFO
        ) {
            receiver = _sendERC1155(fromChainHash, data);
        } else if (
            operation == Messages.MessageType.TRANSFER_ERC1155_BATCH ||
            operation == Messages.MessageType.TRANSFER_ERC1155_BATCH_AND_TOKEN_INFO
        ) {
            receiver = _sendERC1155Batch(fromChainHash, data);
        } else {
            revert("MessageType is unknown");
        }
        return receiver;
    }

    /**
     * @dev Allows Schain owner to register an ERC1155 token clone in the token manager.
     */
    function addERC1155TokenByOwner(
        string calldata targetChainName,
        address erc1155OnMainnet,
        address erc1155OnSchain
    )
        external
        override
        onlyTokenRegistrar
    {
        require(messageProxy.isConnectedChain(targetChainName), "Chain is not connected");
        require(erc1155OnSchain.isContract(), "Given address is not a contract");
        bytes32 targetChainHash = keccak256(abi.encodePacked(targetChainName));
        require(address(clonesErc1155[targetChainHash][erc1155OnMainnet]) == address(0), "Could not relink clone");
        require(!addedClones[ERC1155OnChain(erc1155OnSchain)], "Clone was already added");
        clonesErc1155[targetChainHash][erc1155OnMainnet] = ERC1155OnChain(erc1155OnSchain);
        addedClones[ERC1155OnChain(erc1155OnSchain)] = true;
        emit ERC1155TokenAdded(targetChainHash, erc1155OnMainnet, erc1155OnSchain);
    }

    /**
     * @dev Is called once during contract deployment.
     */
    function initialize(
        string memory newChainName,
        IMessageProxyForSchain newMessageProxy,
        ITokenManagerLinker newIMALinker,
        ICommunityLocker newCommunityLocker,
        address newDepositBox
    )
        external
        override
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
     * @dev Checks whether contract supports such interface (first 4 bytes of method name and its params).
     */
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControlEnumerableUpgradeable, ERC1155ReceiverUpgradeableWithoutGap)
        returns (bool)
    {
        return interfaceId == type(TokenManager).interfaceId
            || super.supportsInterface(interfaceId);
    }


    /**
     * @dev Allows TokenManager to send ERC1155 tokens.
     *  
     * Emits a {ERC20TokenCreated} event if token did not exist and was automatically deployed.
     * Emits a {ERC20TokenReceived} event on success.
     */
    function _sendERC1155(bytes32 fromChainHash, bytes calldata data) private returns (address) {
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256 id;
        uint256 amount;
        ERC1155OnChain contractOnSchain;
        if (messageType == Messages.MessageType.TRANSFER_ERC1155){
            Messages.TransferErc1155Message memory message = Messages.decodeTransferErc1155Message(data);
            receiver = message.receiver;
            token = message.token;
            id = message.id;
            amount = message.amount;
            contractOnSchain = clonesErc1155[fromChainHash][token];
        } else {
            Messages.TransferErc1155AndTokenInfoMessage memory message =
                Messages.decodeTransferErc1155AndTokenInfoMessage(data);
            receiver = message.baseErc1155transfer.receiver;
            token = message.baseErc1155transfer.token;
            id = message.baseErc1155transfer.id;
            amount = message.baseErc1155transfer.amount;
            contractOnSchain = clonesErc1155[fromChainHash][token];
            if (address(contractOnSchain) == address(0)) {
                require(automaticDeploy, "Automatic deploy is disabled");
                contractOnSchain = new ERC1155OnChain(message.tokenInfo.uri);
                clonesErc1155[fromChainHash][token] = contractOnSchain;
                addedClones[contractOnSchain] = true;
                emit ERC1155TokenCreated(fromChainHash, token, address(contractOnSchain));
            }
        }
        if (
            messageType == Messages.MessageType.TRANSFER_ERC1155 &&
            fromChainHash != MAINNET_HASH &&
            _schainToERC1155[fromChainHash].contains(token)
        ) {
            require(token.isContract(), "Incorrect main chain token");
            _removeTransferredAmount(fromChainHash, token, _asSingletonArray(id), _asSingletonArray(amount));
            IERC1155Upgradeable(token).safeTransferFrom(address(this), receiver, id, amount, "");
        } else {
            contractOnSchain.mint(receiver, id, amount, "");
        }
        emit ERC1155TokenReceived(
            fromChainHash,
            token,
            address(contractOnSchain),
            _asSingletonArray(id),
            _asSingletonArray(amount)
        );
        return receiver;
    }

    /**
     * @dev Allows TokenManager to send a batch of ERC1155 tokens.
     *  
     * Emits a {ERC20TokenCreated} event if token did not exist and was automatically deployed.
     * Emits a {ERC20TokenReceived} event on success.
     */
    function _sendERC1155Batch(bytes32 fromChainHash, bytes calldata data) private returns (address) {
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256[] memory ids;
        uint256[] memory amounts;
        ERC1155OnChain contractOnSchain;
        if (messageType == Messages.MessageType.TRANSFER_ERC1155_BATCH){
            Messages.TransferErc1155BatchMessage memory message = Messages.decodeTransferErc1155BatchMessage(data);
            receiver = message.receiver;
            token = message.token;
            ids = message.ids;
            amounts = message.amounts;
            contractOnSchain = clonesErc1155[fromChainHash][token];
        } else {
            Messages.TransferErc1155BatchAndTokenInfoMessage memory message =
                Messages.decodeTransferErc1155BatchAndTokenInfoMessage(data);
            receiver = message.baseErc1155Batchtransfer.receiver;
            token = message.baseErc1155Batchtransfer.token;
            ids = message.baseErc1155Batchtransfer.ids;
            amounts = message.baseErc1155Batchtransfer.amounts;
            contractOnSchain = clonesErc1155[fromChainHash][token];
            if (address(contractOnSchain) == address(0)) {
                require(automaticDeploy, "Automatic deploy is disabled");
                contractOnSchain = new ERC1155OnChain(message.tokenInfo.uri);
                clonesErc1155[fromChainHash][token] = contractOnSchain;
                emit ERC1155TokenCreated(fromChainHash, token, address(contractOnSchain));
            }
        }
        if (
            messageType == Messages.MessageType.TRANSFER_ERC1155_BATCH &&
            fromChainHash != MAINNET_HASH &&
            _schainToERC1155[fromChainHash].contains(token)
        ) {
            require(token.isContract(), "Incorrect main chain token");
            _removeTransferredAmount(fromChainHash, token, ids, amounts);
            IERC1155Upgradeable(token).safeBatchTransferFrom(address(this), receiver, ids, amounts, "");
        } else {
            contractOnSchain.mintBatch(receiver, ids, amounts, "");
        }
        emit ERC1155TokenReceived(fromChainHash, token, address(contractOnSchain), ids, amounts);
        return receiver;
    }

    /**
     * @dev Burn tokens on schain and send message to unlock them on target chain.
     */
    function _exit(
        bytes32 chainHash,
        address messageReceiver,
        address contractOnMainChain,
        address to,
        uint256 id,
        uint256 amount
    )
        private
    {
        bool isMainChainToken;
        ERC1155BurnableUpgradeable contractOnSchain = clonesErc1155[chainHash][contractOnMainChain];
        if (address(contractOnSchain) == address(0)) {
            contractOnSchain = ERC1155BurnableUpgradeable(contractOnMainChain);
            isMainChainToken = true;
        }
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.isApprovedForAll(msg.sender, address(this)), "Not allowed ERC1155 Token");
        bytes memory data = Messages.encodeTransferErc1155Message(contractOnMainChain, to, id, amount);
        if (isMainChainToken) {
            data = _receiveERC1155(
                chainHash,
                address(contractOnSchain),
                msg.sender,
                id,
                amount
            );
            _saveTransferredAmount(
                chainHash,
                address(contractOnSchain),
                _asSingletonArray(id),
                _asSingletonArray(amount)
            );
            contractOnSchain.safeTransferFrom(msg.sender, address(this), id, amount, "");
        } else {
            contractOnSchain.burn(msg.sender, id, amount);
        }
        messageProxy.postOutgoingMessage(chainHash, messageReceiver, data);
    }

    /**
     * @dev Burn batch of tokens on schain and send message to unlock them on target chain.
     */
    function _exitBatch(
        bytes32 chainHash,
        address messageReceiver,
        address contractOnMainChain,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    )
        private
    {
        bool isMainChainToken;
        ERC1155BurnableUpgradeable contractOnSchain = clonesErc1155[chainHash][contractOnMainChain];
        if (address(contractOnSchain) == address(0)) {
            contractOnSchain = ERC1155BurnableUpgradeable(contractOnMainChain);
            isMainChainToken = true;
        }
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.isApprovedForAll(msg.sender, address(this)), "Not allowed ERC1155 Token");
        bytes memory data = Messages.encodeTransferErc1155BatchMessage(contractOnMainChain, to, ids, amounts);
        if (isMainChainToken) {
            data = _receiveERC1155Batch(
                chainHash,
                address(contractOnSchain),
                msg.sender,
                ids,
                amounts
            );
            _saveTransferredAmount(chainHash, address(contractOnSchain), ids, amounts);
            contractOnSchain.safeBatchTransferFrom(msg.sender, address(this), ids, amounts, "");
        } else {
            contractOnSchain.burnBatch(msg.sender, ids, amounts);
        }
        messageProxy.postOutgoingMessage(chainHash, messageReceiver, data);
    }

    /**
     * @dev Saves amount of tokens that was transferred to schain.
     */
    function _saveTransferredAmount(
        bytes32 chainHash,
        address erc1155Token,
        uint256[] memory ids,
        uint256[] memory amounts
    ) private {
        require(ids.length == amounts.length, "Incorrect length of arrays");
        for (uint256 i = 0; i < ids.length; i++)
            transferredAmount[chainHash][erc1155Token][ids[i]] += amounts[i];
    }

    /**
     * @dev Removes amount of tokens that was transferred from schain.
     */
    function _removeTransferredAmount(
        bytes32 chainHash,
        address erc1155Token,
        uint256[] memory ids,
        uint256[] memory amounts
    ) private {
        require(ids.length == amounts.length, "Incorrect length of arrays");
        for (uint256 i = 0; i < ids.length; i++)
            transferredAmount[chainHash][erc1155Token][ids[i]] -= amounts[i];
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
        bytes32 chainHash,
        address erc1155OnMainChain,
        address to,
        uint256 id,
        uint256 amount
    )
        private
        returns (bytes memory data)
    {
        bool isERC1155AddedToSchain = _schainToERC1155[chainHash].contains(erc1155OnMainChain);
        if (!isERC1155AddedToSchain) {
            _addERC1155ForSchain(chainHash, erc1155OnMainChain);
            data = Messages.encodeTransferErc1155AndTokenInfoMessage(
                erc1155OnMainChain,
                to,
                id,
                amount,
                _getTokenInfo(IERC1155MetadataURIUpgradeable(erc1155OnMainChain))
            );
        } else {
            data = Messages.encodeTransferErc1155Message(erc1155OnMainChain, to, id, amount);
        }
        
        emit ERC1155TokenReady(chainHash, erc1155OnMainChain, _asSingletonArray(id), _asSingletonArray(amount));
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
        bytes32 chainHash,
        address erc1155OnMainChain,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts
    )
        private
        returns (bytes memory data)
    {
        bool isERC1155AddedToSchain = _schainToERC1155[chainHash].contains(erc1155OnMainChain);
        if (!isERC1155AddedToSchain) {
            _addERC1155ForSchain(chainHash, erc1155OnMainChain);
            data = Messages.encodeTransferErc1155BatchAndTokenInfoMessage(
                erc1155OnMainChain,
                to,
                ids,
                amounts,
                _getTokenInfo(IERC1155MetadataURIUpgradeable(erc1155OnMainChain))
            );
        } else {
            data = Messages.encodeTransferErc1155BatchMessage(erc1155OnMainChain, to, ids, amounts);
        }
        emit ERC1155TokenReady(chainHash, erc1155OnMainChain, ids, amounts);
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
    function _addERC1155ForSchain(bytes32 chainHash, address erc1155OnMainChain) private {
        require(erc1155OnMainChain.isContract(), "Given address is not a contract");
        require(!_schainToERC1155[chainHash].contains(erc1155OnMainChain), "ERC1155 Token was already added");
        _schainToERC1155[chainHash].add(erc1155OnMainChain);
        emit ERC1155TokenAdded(chainHash, erc1155OnMainChain, address(0));
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
     * @dev Create array with single element in it.
     */
    function _asSingletonArray(uint256 element) private pure returns (uint256[] memory array) {
        array = new uint256[](1);
        array[0] = element;
    }

}
