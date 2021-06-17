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

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../../Messages.sol";
import "../tokens/ERC20OnChain.sol";
import "../TokenManager.sol";


/**
 * This contract runs on schains and accepts messages from main net creates ETH clones.
 * When the user exits, it burns them
 */

/**
 * @title Token Manager
 * @dev Runs on SKALE Chains, accepts messages from mainnet, and instructs
 * TokenFactory to create clones. TokenManager mints tokens via
 * LockAndDataForSchain*. When a user exits a SKALE chain, TokenFactory
 * burns tokens.
 */
contract TokenManagerERC20 is TokenManager {

    // address of ERC20 on Mainnet => ERC20 on Schain
    mapping(address => ERC20OnChain) public clonesErc20;
    
    // address of clone on schain => totalSupplyOnMainnet
    mapping(IERC20Upgradeable => uint) public totalSupplyOnMainnet;

    event ERC20TokenAdded(address indexed erc20OnMainnet, address indexed erc20OnSchain);

    event ERC20TokenCreated(address indexed erc20OnMainnet, address indexed erc20OnSchain);

    event ERC20TokenReceived(address indexed erc20OnMainnet, address indexed erc20OnSchain, uint256 amount);

    function exitToMainERC20(
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        external
    {
        communityLocker.checkAllowedToSendMessage(to);
        _exit(MAINNET_HASH, depositBox, contractOnMainnet, to, amount);
    }

    function transferToSchainERC20(
        string calldata targetSchainName,
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        external
        rightTransaction(targetSchainName, to)
    {
        bytes32 targetSchainHash = keccak256(abi.encodePacked(targetSchainName));
        _exit(targetSchainHash, tokenManagers[targetSchainHash], contractOnMainnet, to, amount);
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
     * @dev Allows Schain owner to add an ERC20 token to LockAndDataForSchainERC20.
     */
    function addERC20TokenByOwner(
        address erc20OnMainnet,
        ERC20OnChain erc20OnSchain
     )
        external
        onlyTokenRegistrar
    {
        require(address(erc20OnSchain).isContract(), "Given address is not a contract");
        require(erc20OnSchain.totalSupply() == 0, "TotalSupply is not zero");
        clonesErc20[erc20OnMainnet] = erc20OnSchain;
        emit ERC20TokenAdded(erc20OnMainnet, address(erc20OnSchain));
    }

    function initialize(
        string memory newChainName,
        MessageProxyForSchain newMessageProxy,
        TokenManagerLinker newIMALinker,
        CommunityLocker newCommunityLocker,
        address newDepositBox
    )
        public        
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
     * Emits a {ERC20TokenCreated} event if token does not exist.
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
                emit ERC20TokenCreated(token, address(contractOnSchain));
            }
        }
        if (totalSupply != totalSupplyOnMainnet[contractOnSchain]) {
            totalSupplyOnMainnet[contractOnSchain] = totalSupply;
        }
        require(
            contractOnSchain.totalSupply() + amount <= totalSupplyOnMainnet[contractOnSchain],
            "Total supply exceeded"
        );
        contractOnSchain.mint(receiver, amount);
        emit ERC20TokenReceived(token, address(contractOnSchain), amount);
        return receiver;
    }

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
        contractOnSchain.transferFrom(msg.sender, address(this), amount);
        contractOnSchain.burn(amount);
        messageProxy.postOutgoingMessage(
            chainHash,
            messageReceiver,
            Messages.encodeTransferErc20Message(contractOnMainnet, to, amount)
        );
    }
}
