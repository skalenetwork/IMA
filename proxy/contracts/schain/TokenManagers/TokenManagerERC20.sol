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

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@skalenetwork/ima-interfaces/schain/TokenManagers/ITokenManagerERC20.sol";

import "../../Messages.sol";
import "../tokens/ERC20OnChain.sol";
import "../TokenManager.sol";


/**
 * @title TokenManagerERC20
 * @dev Runs on SKALE Chains,
 * accepts messages from mainnet,
 * and creates ERC20 clones.
 * TokenManagerERC20 mints tokens. When a user exits a SKALE chain, it burns them.
 */
contract TokenManagerERC20 is TokenManager, ITokenManagerERC20 {
    using AddressUpgradeable for address;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    // address of ERC20 on Mainnet => ERC20 on Schain
    mapping(address => ERC20OnChain) public deprecatedClonesErc20;
    
    // address of clone on schain => totalSupplyOnMainnet
    mapping(IERC20Upgradeable => uint) public totalSupplyOnMainnet;

    // address clone on schain => added or not
    mapping(ERC20OnChain => bool) public addedClones;

    mapping(bytes32 => mapping(address => ERC20OnChain)) public clonesErc20;

    mapping(bytes32 => mapping(address => uint256)) public transferredAmount;

    mapping(bytes32 => EnumerableSetUpgradeable.AddressSet) private _schainToERC20;

    /**
     * @dev Emitted when schain owner register new ERC20 clone.
     */
    event ERC20TokenAdded(bytes32 indexed chainHash, address indexed erc20OnMainChain, address indexed erc20OnSchain);

    /**
     * @dev Emitted when TokenManagerERC20 automatically deploys new ERC20 clone.
     */
    event ERC20TokenCreated(
        bytes32 indexed chainHash,
        address indexed erc20OnMainChain,
        address indexed erc20OnSchain
    );

    /**
     * @dev Emitted when someone sends tokens from mainnet to schain.
     */
    event ERC20TokenReceived(
        bytes32 indexed chainHash,
        address indexed erc20OnMainChain,
        address indexed erc20OnSchain,
        uint256 amount
    );

    /**
     * @dev Emitted when token is received by TokenManager and is ready to be cloned
     * or transferred on SKALE chain.
     */
    event ERC20TokenReady(bytes32 indexed chainHash, address indexed contractOnMainnet, uint256 amount);

    /**
     * @dev Move tokens from schain to mainnet.
     * 
     * {contractOnMainnet} tokens are burned on schain and unlocked on mainnet for {to} address.
     */
    function exitToMainERC20(
        address contractOnMainnet,
        uint256 amount
    )
        external
        override
    {
        communityLocker.checkAllowedToSendMessage(msg.sender);
        _exit(MAINNET_HASH, depositBox, contractOnMainnet, msg.sender, amount);
    }

    /**
     * @dev Move tokens from schain to schain.
     * 
     * {contractOnMainnet} tokens are burned on origin schain
     * and are minted on {targetSchainName} schain for {to} address.
     */
    function transferToSchainERC20(
        string calldata targetSchainName,
        address contractOnMainnet,
        uint256 amount
    )
        external
        override
        rightTransaction(targetSchainName, msg.sender)
    {
        bytes32 targetSchainHash = keccak256(abi.encodePacked(targetSchainName));
        _exit(targetSchainHash, tokenManagers[targetSchainHash], contractOnMainnet, msg.sender, amount);
    }

    /**
     * @dev Allows MessageProxy to post operational message from mainnet
     * or SKALE chains.
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
        checkReceiverChain(fromChainHash, sender)
        returns (address)
    {
        Messages.MessageType operation = Messages.getMessageType(data);
        address receiver = address(0);
        if (
            operation == Messages.MessageType.TRANSFER_ERC20 ||
            operation == Messages.MessageType.TRANSFER_ERC20_AND_TOKEN_INFO ||
            operation == Messages.MessageType.TRANSFER_ERC20_AND_TOTAL_SUPPLY
        ) {
            receiver = _sendERC20(fromChainHash, data);
        } else {
            revert("MessageType is unknown");
        }
        return receiver;
    }

    /**
     * @dev Allows Schain owner to register an ERC20 token clone in the token manager.
     */
    function addERC20TokenByOwner(
        string calldata targetChainName,
        address erc20OnMainChain,
        address erc20OnSchain
     )
        external
        override
        onlyTokenRegistrar
    {
        require(messageProxy.isConnectedChain(targetChainName), "Chain is not connected");
        require(erc20OnSchain.isContract(), "Given address is not a contract");
        require(ERC20OnChain(erc20OnSchain).totalSupply() == 0, "TotalSupply is not zero");
        bytes32 targetChainHash = keccak256(abi.encodePacked(targetChainName));
        require(address(clonesErc20[targetChainHash][erc20OnMainChain]) == address(0), "Could not relink clone");
        require(!addedClones[ERC20OnChain(erc20OnSchain)], "Clone was already added");
        clonesErc20[targetChainHash][erc20OnMainChain] = ERC20OnChain(erc20OnSchain);
        addedClones[ERC20OnChain(erc20OnSchain)] = true;
        emit ERC20TokenAdded(targetChainHash, erc20OnMainChain, erc20OnSchain);
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
     * @dev Allows TokenManager to send ERC20 tokens.
     *  
     * Emits a {ERC20TokenCreated} event if token did not exist and was automatically deployed.
     * Emits a {ERC20TokenReceived} event on success.
     */
    function _sendERC20(bytes32 fromChainHash, bytes calldata data) private returns (address) {        
        Messages.MessageType messageType = Messages.getMessageType(data);
        (address receiver, address token, uint256 amount) = _decodeErc20Message(data);
        ERC20OnChain contractOnSchain;
        if (messageType != Messages.MessageType.TRANSFER_ERC20) {
            uint256 totalSupply;
            if (messageType == Messages.MessageType.TRANSFER_ERC20_AND_TOTAL_SUPPLY) {
                Messages.TransferErc20AndTotalSupplyMessage memory message =
                    Messages.decodeTransferErc20AndTotalSupplyMessage(data);
                totalSupply = message.totalSupply;
                contractOnSchain = clonesErc20[fromChainHash][token];
            } else {
                Messages.TransferErc20AndTokenInfoMessage memory message =
                    Messages.decodeTransferErc20AndTokenInfoMessage(data);
                totalSupply = message.totalSupply;
                contractOnSchain = clonesErc20[fromChainHash][token];

                if (address(contractOnSchain) == address(0)) {
                    require(automaticDeploy, "Automatic deploy is disabled");
                    contractOnSchain = new ERC20OnChain(message.tokenInfo.name, message.tokenInfo.symbol);
                    clonesErc20[fromChainHash][token] = contractOnSchain;
                    addedClones[contractOnSchain] = true;
                    emit ERC20TokenCreated(fromChainHash, token, address(contractOnSchain));
                }
            }
            if (totalSupply != totalSupplyOnMainnet[contractOnSchain]) {
                totalSupplyOnMainnet[contractOnSchain] = totalSupply;
            }
            bool noOverflow;
            uint updatedTotalSupply;
            (noOverflow, updatedTotalSupply) = SafeMathUpgradeable.tryAdd(contractOnSchain.totalSupply(), amount);
            require(
                noOverflow && updatedTotalSupply <= totalSupplyOnMainnet[contractOnSchain],
                "Total supply exceeded"
            );
            contractOnSchain.mint(receiver, amount);
        } else {
            require(token.isContract() && _schainToERC20[fromChainHash].contains(token), "Incorrect main chain token");
            require(ERC20Upgradeable(token).balanceOf(address(this)) >= amount, "Not enough money");
            _removeTransferredAmount(fromChainHash, token, amount);
            require(
                ERC20Upgradeable(token).transfer(receiver, amount),
                "Transfer was failed"
            );
        }
        emit ERC20TokenReceived(fromChainHash, token, address(contractOnSchain), amount);
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
        uint256 amount
    )
        private
    {
        bool isMainChainToken;
        ERC20BurnableUpgradeable contractOnSchain = clonesErc20[chainHash][contractOnMainChain];
        if (address(contractOnSchain) == address(0)) {
            contractOnSchain = ERC20BurnableUpgradeable(contractOnMainChain);
            isMainChainToken = true;
        }
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.balanceOf(msg.sender) >= amount, "Insufficient funds");
        require(
            contractOnSchain.allowance(
                msg.sender,
                address(this)
            ) >= amount,
            "Transfer is not approved by token holder"
        );
        bytes memory data = Messages.encodeTransferErc20Message(address(contractOnMainChain), to, amount);
        if (isMainChainToken) {
            data = _receiveERC20(
                chainHash,
                address(contractOnSchain),
                msg.sender,
                amount
            );
            _saveTransferredAmount(chainHash, address(contractOnSchain), amount);
            require(
                contractOnSchain.transferFrom(msg.sender, address(this), amount),
                "Transfer was failed"
            );
        } else {
            require(
                contractOnSchain.transferFrom(msg.sender, address(this), amount),
                "Transfer was failed"
            );
            contractOnSchain.burn(amount);
        }
        messageProxy.postOutgoingMessage(
            chainHash,
            messageReceiver,
            data
        );
    }

    /**
     * @dev Saves amount of tokens that was transferred to schain.
     */
    function _saveTransferredAmount(bytes32 chainHash, address erc20Token, uint256 amount) private {
        transferredAmount[chainHash][erc20Token] += amount;
    }

    /**
     * @dev Removes amount of tokens that was transferred from schain.
     */
    function _removeTransferredAmount(bytes32 chainHash, address erc20Token, uint256 amount) private {
        transferredAmount[chainHash][erc20Token] -= amount;
    }

    /**
     * @dev Allows DepositBoxERC20 to receive ERC20 tokens.
     * 
     * Emits an {ERC20TokenReady} event.
     * 
     * Requirements:
     * 
     * - Amount must be less than or equal to the total supply of the ERC20 contract.
     * - Whitelist should be turned off for auto adding tokens to DepositBoxERC20.
     */
    function _receiveERC20(
        bytes32 chainHash,
        address erc20OnMainChain,
        address to,
        uint256 amount
    )
        private
        returns (bytes memory data)
    {
        ERC20BurnableUpgradeable erc20 = ERC20BurnableUpgradeable(erc20OnMainChain);
        uint256 totalSupply = erc20.totalSupply();
        require(amount <= totalSupply, "Amount is incorrect");
        bool isERC20AddedToSchain = _schainToERC20[chainHash].contains(erc20OnMainChain);
        if (!isERC20AddedToSchain) {
            _addERC20ForSchain(chainHash, erc20OnMainChain);
            data = Messages.encodeTransferErc20AndTokenInfoMessage(
                erc20OnMainChain,
                to,
                amount,
                _getErc20TotalSupply(erc20),
                _getErc20TokenInfo(erc20)
            );
        } else {
            data = Messages.encodeTransferErc20AndTotalSupplyMessage(
                erc20OnMainChain,
                to,
                amount,
                _getErc20TotalSupply(erc20)
            );
        }
        emit ERC20TokenReady(chainHash, erc20OnMainChain, amount);
    }

    /**
     * @dev Adds an ERC20 token to DepositBoxERC20.
     * 
     * Emits an {ERC20TokenAdded} event.
     * 
     * Requirements:
     * 
     * - Given address should be contract.
     */
    function _addERC20ForSchain(bytes32 chainHash, address erc20OnMainChain) private {
        require(erc20OnMainChain.isContract(), "Given address is not a contract");
        require(!_schainToERC20[chainHash].contains(erc20OnMainChain), "ERC20 Token was already added");
        _schainToERC20[chainHash].add(erc20OnMainChain);
        emit ERC20TokenAdded(chainHash, erc20OnMainChain, address(0));
    }

    /**
     * @dev Returns total supply of ERC20 token.
     */
    function _getErc20TotalSupply(ERC20Upgradeable erc20Token) private view returns (uint256) {
        return erc20Token.totalSupply();
    }

    /**
     * @dev Returns info about ERC20 token such as token name, decimals, symbol.
     */
    function _getErc20TokenInfo(ERC20Upgradeable erc20Token) private view returns (Messages.Erc20TokenInfo memory) {
        return Messages.Erc20TokenInfo({
            name: erc20Token.name(),
            decimals: erc20Token.decimals(),
            symbol: erc20Token.symbol()
        });
    }

    function _decodeErc20Message(bytes calldata data)
        private
        pure
        returns (address, address, uint256)
    {
        Messages.MessageType messageType = Messages.getMessageType(data);
        if (messageType == Messages.MessageType.TRANSFER_ERC20) {
            Messages.TransferErc20Message memory message =
                Messages.decodeTransferErc20Message(data);
            return (
                message.receiver,
                message.token,
                message.amount
            );
        } else if (messageType == Messages.MessageType.TRANSFER_ERC20_AND_TOTAL_SUPPLY) {
            Messages.TransferErc20AndTotalSupplyMessage memory messageTotalSupply =
                Messages.decodeTransferErc20AndTotalSupplyMessage(data);
            return (
                messageTotalSupply.baseErc20transfer.receiver,
                messageTotalSupply.baseErc20transfer.token,
                messageTotalSupply.baseErc20transfer.amount
            );
        } else {
            Messages.TransferErc20AndTokenInfoMessage memory messageTokenInfo =
                Messages.decodeTransferErc20AndTokenInfoMessage(data);
            return (
                messageTokenInfo.baseErc20transfer.receiver,
                messageTokenInfo.baseErc20transfer.token,
                messageTokenInfo.baseErc20transfer.amount
            );
        }
    }
}
