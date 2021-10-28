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


interface ITokenManagerERC20Initializable is ITokenManagerERC20 {
    function initialize(
        string memory newChainName,
        MessageProxyForSchain newMessageProxy,
        TokenManagerLinker newIMALinker,
        CommunityLocker newCommunityLocker,
        address newDepositBox
    ) external;
}


/**
 * @title TokenManagerERC20
 * @dev Runs on SKALE Chains,
 * accepts messages from mainnet,
 * and creates ERC20 clones.
 * TokenManagerERC20 mints tokens. When a user exits a SKALE chain, it burns them.
 */
contract TokenManagerERC20 is TokenManager, ITokenManagerERC20Initializable {
    using AddressUpgradeable for address;

    // address of ERC20 on Mainnet => ERC20 on Schain
    mapping(address => ERC20OnChain) public clonesErc20;
    
    // address of clone on schain => totalSupplyOnMainnet
    mapping(IERC20Upgradeable => uint) public totalSupplyOnMainnet;

    // address clone on schain => added or not
    mapping(ERC20OnChain => bool) public addedClones;

    /**
     * @dev Emitted when schain owner register new ERC20 clone.
     */
    event ERC20TokenAdded(address indexed erc20OnMainnet, address indexed erc20OnSchain);

    /**
     * @dev Emitted when TokenManagerERC20 automatically deploys new ERC20 clone.
     */
    event ERC20TokenCreated(address indexed erc20OnMainnet, address indexed erc20OnSchain);

    /**
     * @dev Emitted when someone sends tokens from mainnet to schain.
     */
    event ERC20TokenReceived(address indexed erc20OnMainnet, address indexed erc20OnSchain, uint256 amount);

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
            operation == Messages.MessageType.TRANSFER_ERC20_AND_TOKEN_INFO ||
            operation == Messages.MessageType.TRANSFER_ERC20_AND_TOTAL_SUPPLY
        ) {
            receiver = _sendERC20(data);
        } else {
            revert("MessageType is unknown");
        }
        return receiver;
    }

    /**
     * @dev Allows Schain owner to register an ERC20 token clone in the token manager.
     */
    function addERC20TokenByOwner(
        address erc20OnMainnet,
        address erc20OnSchain
     )
        external
        override
        onlyTokenRegistrar
    {
        require(erc20OnSchain.isContract(), "Given address is not a contract");
        require(ERC20OnChain(erc20OnSchain).totalSupply() == 0, "TotalSupply is not zero");
        require(address(clonesErc20[erc20OnMainnet]) == address(0), "Could not relink clone");
        require(!addedClones[ERC20OnChain(erc20OnSchain)], "Clone was already added");
        clonesErc20[erc20OnMainnet] = ERC20OnChain(erc20OnSchain);
        addedClones[ERC20OnChain(erc20OnSchain)] = true;
        emit ERC20TokenAdded(erc20OnMainnet, erc20OnSchain);
    }

    /**
     * @dev Is called once during contract deployment.
     */
    function initialize(
        string memory newChainName,
        MessageProxyForSchain newMessageProxy,
        TokenManagerLinker newIMALinker,
        CommunityLocker newCommunityLocker,
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
    function _sendERC20(bytes calldata data) private returns (address) {        
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256 amount;
        uint256 totalSupply;                
        ERC20OnChain contractOnSchain;
        if (messageType == Messages.MessageType.TRANSFER_ERC20_AND_TOTAL_SUPPLY) {
            Messages.TransferErc20AndTotalSupplyMessage memory message =
                Messages.decodeTransferErc20AndTotalSupplyMessage(data);
            receiver = message.baseErc20transfer.receiver;
            token = message.baseErc20transfer.token;
            amount = message.baseErc20transfer.amount;
            totalSupply = message.totalSupply;
            contractOnSchain = clonesErc20[token];
        } else {
            Messages.TransferErc20AndTokenInfoMessage memory message =
                Messages.decodeTransferErc20AndTokenInfoMessage(data);
            receiver = message.baseErc20transfer.receiver;
            token = message.baseErc20transfer.token;
            amount = message.baseErc20transfer.amount;
            totalSupply = message.totalSupply;
            contractOnSchain = clonesErc20[token];
            if (address(contractOnSchain) == address(0)) {
                require(automaticDeploy, "Automatic deploy is disabled");
                contractOnSchain = new ERC20OnChain(message.tokenInfo.name, message.tokenInfo.symbol);
                clonesErc20[token] = contractOnSchain;
                addedClones[contractOnSchain] = true;
                emit ERC20TokenCreated(token, address(contractOnSchain));
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
        emit ERC20TokenReceived(token, address(contractOnSchain), amount);
        return receiver;
    }

    /**
     * @dev Burn tokens on schain and send message to unlock them on target chain.
     */
    function _exit(
        bytes32 chainHash,
        address messageReceiver,
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        private
    {
        ERC20BurnableUpgradeable contractOnSchain = clonesErc20[contractOnMainnet];
        require(address(contractOnSchain).isContract(), "No token clone on schain");
        require(contractOnSchain.balanceOf(msg.sender) >= amount, "Insufficient funds");
        require(
            contractOnSchain.allowance(
                msg.sender,
                address(this)
            ) >= amount,
            "Transfer is not approved by token holder"
        );
        require(
            contractOnSchain.transferFrom(msg.sender, address(this), amount),
            "Transfer was failed"
        );
        contractOnSchain.burn(amount);
        messageProxy.postOutgoingMessage(
            chainHash,
            messageReceiver,
            Messages.encodeTransferErc20Message(contractOnMainnet, to, amount)
        );
    }
}
