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

pragma solidity 0.8.27;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@skalenetwork/ima-interfaces/schain/TokenManagers/ITokenManagerERC721.sol";

import "../../Messages.sol";
import "../tokens/ERC721OnChain.sol";
import "../TokenManager.sol";


/**
 * @title TokenManagerERC721
 * @dev Runs on SKALE Chains,
 * accepts messages from mainnet,
 * and creates ERC721 clones.
 * TokenManagerERC721 mints tokens. When a user exits a SKALE chain, it burns them.
 */
contract TokenManagerERC721 is TokenManager, ITokenManagerERC721 {
    using AddressUpgradeable for address;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    // address of ERC721 on Mainnet => ERC721 on Schain
    mapping(address => ERC721OnChain) public deprecatedClonesErc721;

    // address clone on schain => added or not
    mapping(ERC721OnChain => bool) public addedClones;

    mapping(SchainHash => mapping(address => ERC721OnChain)) public clonesErc721;

    mapping(address => mapping(uint256 => SchainHash)) public transferredAmount;

    mapping(SchainHash => EnumerableSetUpgradeable.AddressSet) private _schainToERC721;

    /**
     * @dev Emitted when schain owner register new ERC721 clone.
     */
    event ERC721TokenAdded(
        SchainHash indexed chainHash,
        address indexed erc721OnMainChain,
        address indexed erc721OnSchain
    );

    /**
     * @dev Emitted when TokenManagerERC721 automatically deploys new ERC721 clone.
     */
    event ERC721TokenCreated(
        SchainHash indexed chainHash,
        address indexed erc721OnMainChain,
        address indexed erc721OnSchain
    );

    /**
     * @dev Emitted when someone sends tokens from mainnet to schain.
     */
    event ERC721TokenReceived(
        SchainHash indexed chainHash,
        address indexed erc721OnMainChain,
        address indexed erc721OnSchain,
        uint256 tokenId
    );

    /**
     * @dev Emitted when token is received by TokenManager and is ready to be cloned
     * or transferred on SKALE chain.
     */
    event ERC721TokenReady(SchainHash indexed chainHash, address indexed contractOnMainnet, uint256 tokenId);

    /**
     * @dev Move tokens from schain to mainnet.
     *
     * {contractOnMainnet} tokens are burned on schain and unlocked on mainnet for {msg.sender} address.
     */
    function exitToMainERC721(
        address contractOnMainnet,
        uint256 tokenId
    )
        external
        override
    {
        communityLocker.checkAllowedToSendMessage(MAINNET_HASH, msg.sender);
        _exit(MAINNET_HASH, depositBox, contractOnMainnet, msg.sender, tokenId);
    }

    /**
     * @dev Move tokens from schain to schain.
     *
     * {contractOnMainnet} tokens are burned on origin schain
     * and are minted on {targetSchainName} schain for {msg.sender} address.
     */
    function transferToSchainERC721(
        string calldata targetSchainName,
        address contractOnMainnet,
        uint256 tokenId
    )
        external
        override
        rightTransaction(targetSchainName, msg.sender)
    {
        SchainHash targetSchainHash = SchainHash.wrap(keccak256(abi.encodePacked(targetSchainName)));
        communityLocker.checkAllowedToSendMessage(targetSchainHash, msg.sender);
        _exit(targetSchainHash, tokenManagers[targetSchainHash], contractOnMainnet, msg.sender, tokenId);
    }

    /**
     * @dev Allows MessageProxy to post operational message from mainnet
     * or SKALE chains.
     *
     * Requirements:
     *
     * - MessageProxy must be the sender.
     * - `fromChainHash` must exist in TokenManager addresses.
     */
    function postMessage(
        SchainHash fromChainHash,
        address sender,
        bytes calldata data
    )
        external
        virtual
        override
        onlyMessageProxy
        checkReceiverChain(fromChainHash, sender)
    {
        Messages.MessageType operation = Messages.getMessageType(data);
        address receiver = address(0);
        if (
            operation == Messages.MessageType.TRANSFER_ERC721_AND_TOKEN_INFO ||
            operation == Messages.MessageType.TRANSFER_ERC721
        ) {
            receiver = _sendERC721(fromChainHash, data);
        } else {
            revert("MessageType is unknown");
        }
    }

    /**
     * @dev Allows Schain owner to register an ERC721 token clone in the token manager.
     */
    function addERC721TokenByOwner(
        string calldata originChainName,
        address erc721OnOriginChain,
        address newErc721OnSchain
    )
        external
        override
        onlyTokenRegistrar
    {
        SchainHash originChainHash = SchainHash.wrap(keccak256(abi.encodePacked(originChainName)));
        require(messageProxy.isConnectedChain(originChainName), "Chain is not connected");
        require(newErc721OnSchain.isContract(), "Given address is not a contract");
        require(address(clonesErc721[originChainHash][erc721OnOriginChain]) == address(0), "Could not relink clone");
        require(!addedClones[ERC721OnChain(newErc721OnSchain)], "Clone was already added");
        clonesErc721[originChainHash][erc721OnOriginChain] = ERC721OnChain(newErc721OnSchain);
        addedClones[ERC721OnChain(newErc721OnSchain)] = true;
        emit ERC721TokenAdded(originChainHash, erc721OnOriginChain, newErc721OnSchain);
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
    {
        TokenManager.initializeTokenManager(
            newChainName,
            newMessageProxy,
            newIMALinker,
            newCommunityLocker,
            newDepositBox
        );
    }

    // private

    /**
     * @dev Allows TokenManager to send ERC721 tokens.
     *
     * Emits a {ERC20TokenCreated} event if token did not exist and was automatically deployed.
     * Emits a {ERC20TokenReceived} event on success.
     */
    function _sendERC721(SchainHash fromChainHash, bytes calldata data) internal virtual returns (address) {
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256 tokenId;
        ERC721OnChain contractOnSchain;
        if (messageType == Messages.MessageType.TRANSFER_ERC721) {
            Messages.TransferErc721Message memory message = Messages.decodeTransferErc721Message(data);
            receiver = message.receiver;
            token = message.token;
            tokenId = message.tokenId;
            contractOnSchain = clonesErc721[fromChainHash][token];
        } else {
            Messages.TransferErc721AndTokenInfoMessage memory message =
                Messages.decodeTransferErc721AndTokenInfoMessage(data);
            receiver = message.baseErc721transfer.receiver;
            token = message.baseErc721transfer.token;
            tokenId = message.baseErc721transfer.tokenId;
            contractOnSchain = clonesErc721[fromChainHash][token];
            if (address(contractOnSchain) == address(0)) {
                require(automaticDeploy, "Automatic deploy is disabled");
                contractOnSchain = new ERC721OnChain(message.tokenInfo.name, message.tokenInfo.symbol);
                clonesErc721[fromChainHash][token] = contractOnSchain;
                addedClones[contractOnSchain] = true;
                emit ERC721TokenCreated(fromChainHash, token, address(contractOnSchain));
            }
        }
        if (
            messageType == Messages.MessageType.TRANSFER_ERC721 &&
            fromChainHash != MAINNET_HASH &&
            _schainToERC721[fromChainHash].contains(token)
        ) {
            require(token.isContract(), "Incorrect main chain token");
            require(IERC721Upgradeable(token).ownerOf(tokenId) == address(this), "Incorrect tokenId");
            _removeTransferredAmount(fromChainHash, token, tokenId);
            IERC721Upgradeable(token).transferFrom(address(this), receiver, tokenId);
        } else {
            contractOnSchain.mint(receiver, tokenId);
        }
        emit ERC721TokenReceived(fromChainHash, token, address(contractOnSchain), tokenId);
        messageProxy.topUpReceiverBalance(payable(receiver));
        return receiver;
    }

    /**
     * @dev Removes the ids of tokens that was transferred from schain.
     */
    function _removeTransferredAmount(SchainHash chainHash, address erc721Token, uint256 tokenId) internal {
        require(transferredAmount[erc721Token][tokenId] == chainHash, "Token was already transferred from chain");
        transferredAmount[erc721Token][tokenId] = SchainHash.wrap(bytes32(0));
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
        SchainHash chainHash,
        address erc721OnMainChain,
        address to,
        uint256 tokenId
    )
        internal
        virtual
        returns (bytes memory data)
    {
        bool isERC721AddedToSchain = _schainToERC721[chainHash].contains(erc721OnMainChain);
        if (!isERC721AddedToSchain) {
            _addERC721ForSchain(chainHash, erc721OnMainChain);
            data = Messages.encodeTransferErc721AndTokenInfoMessage(
                erc721OnMainChain,
                to,
                tokenId,
                _getTokenInfo(IERC721MetadataUpgradeable(erc721OnMainChain))
            );
        } else {
            data = Messages.encodeTransferErc721Message(erc721OnMainChain, to, tokenId);
        }
        emit ERC721TokenReady(chainHash, erc721OnMainChain, tokenId);
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
    function _addERC721ForSchain(SchainHash chainHash, address erc721OnMainChain) internal {
        require(erc721OnMainChain.isContract(), "Given address is not a contract");
        require(!_schainToERC721[chainHash].contains(erc721OnMainChain), "ERC721 Token was already added");
        _schainToERC721[chainHash].add(erc721OnMainChain);
        emit ERC721TokenAdded(chainHash, erc721OnMainChain, address(0));
    }

    /**
     * @dev Burn tokens on schain and send message to unlock them on target chain.
     */
    function _exit(
        SchainHash chainHash,
        address messageReceiver,
        address contractOnMainChain,
        address to,
        uint256 tokenId
    )
        internal
        virtual
    {
        bool isMainChainToken;
        ERC721OnChain contractOnSchain = clonesErc721[chainHash][contractOnMainChain];
        if (address(contractOnSchain) == address(0)) {
            contractOnSchain = ERC721OnChain(contractOnMainChain);
            require(!addedClones[contractOnSchain], "Incorrect main chain token");
            isMainChainToken = true;
        }
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.getApproved(tokenId) == address(this), "Not allowed ERC721 Token");
        bytes memory data = Messages.encodeTransferErc721Message(contractOnMainChain, to, tokenId);
        if (isMainChainToken) {
            require(chainHash != MAINNET_HASH, "Main chain token could not be transfered to Mainnet");
            data = _receiveERC721(
                chainHash,
                address(contractOnSchain),
                msg.sender,
                tokenId
            );
            _saveTransferredAmount(chainHash, address(contractOnSchain), tokenId);
            contractOnSchain.transferFrom(msg.sender, address(this), tokenId);
        } else {
            contractOnSchain.transferFrom(msg.sender, address(this), tokenId);
            contractOnSchain.burn(tokenId);
        }
        messageProxy.postOutgoingMessage(chainHash, messageReceiver, data);
    }

    /**
     * @dev Saves the ids of tokens that was transferred to schain.
     */
    function _saveTransferredAmount(SchainHash chainHash, address erc721Token, uint256 tokenId) internal {
        require(transferredAmount[erc721Token][tokenId] == SchainHash.wrap(bytes32(0)), "Token was already transferred to chain");
        transferredAmount[erc721Token][tokenId] = chainHash;
    }

    /**
     * @dev Returns info about ERC721 token such as token name, symbol.
     */
    function _getTokenInfo(IERC721MetadataUpgradeable erc721) internal view returns (Messages.Erc721TokenInfo memory) {
        return Messages.Erc721TokenInfo({
            name: erc721.name(),
            symbol: erc721.symbol()
        });
    }

    function _isERC721AddedToSchain(SchainHash chainHash, address erc721OnMainChain) internal view returns (bool) {
        return _schainToERC721[chainHash].contains(erc721OnMainChain);
    }
}
