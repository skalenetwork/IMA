// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC20ModuleForSchain.sol - SKALE Interchain Messaging Agent
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

import "../Messages.sol";
import "./PermissionsForSchain.sol";
import "./TokenFactory.sol";
import "./LockAndDataForSchainERC20.sol";

/**
 * @title ERC20 Module For SKALE Chain
 * @dev Runs on SKALE Chains and manages ERC20 token contracts for TokenManager.
 */
contract ERC20ModuleForSchain is PermissionsForSchain {

    event ERC20TokenCreated(string schainID, address indexed contractOnMainnet, address contractOnSchain);
    event ERC20TokenReceived(address indexed contractOnMainnet, address contractOnSchain, uint256 amount);


    constructor(address newLockAndDataAddress) public PermissionsForSchain(newLockAndDataAddress) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /**
     * @dev Allows TokenManager to receive ERC20 tokens.
     * 
     * Requirements:
     * 
     * - ERC20 token contract must exist in LockAndDataForSchainERC20.
     * - ERC20 token must be received by LockAndDataForSchainERC20.
     */
    function receiveERC20(
        string calldata schainID,
        address contractOnMainnet,
        address receiver,
        uint256 amount
    ) 
        external
        allow("TokenManager")
        returns (bytes memory data)
    {
        address lockAndDataERC20 = LockAndDataForSchain(getLockAndDataAddress()).getLockAndDataErc20();
        address contractOnSchain = LockAndDataForSchainERC20(lockAndDataERC20)
            .getERC20OnSchain(schainID, contractOnMainnet);
        require(contractOnSchain != address(0), "ERC20 contract does not exist on SKALE chain.");
        require(
            LockAndDataForSchainERC20(lockAndDataERC20).receiveERC20(contractOnSchain, amount),
            "Could not receive ERC20 Token"
        );
        data = Messages.encodeTransferErc20Message(contractOnMainnet, receiver, amount);
    }

    /**
     * @dev Allows TokenManager to send ERC20 tokens.
     *  
     * Emits a {ERC20TokenCreated} event if token does not exist.
     * Emits a {ERC20TokenReceived} event on success.
     */
    function sendERC20(string calldata schainID, bytes calldata data) external allow("TokenManager") returns (bool) {
        address lockAndDataERC20 = LockAndDataForSchain(getLockAndDataAddress()).getLockAndDataErc20();
        Messages.MessageType messageType = Messages.getMessageType(data);
        address receiver;
        address token;
        uint256 amount;
        uint256 totalSupply;
        if (messageType == Messages.MessageType.TRANSFER_ERC20_AND_TOTAL_SUPPLY) {
            Messages.TransferErc20AndTotalSupplyMessage memory message =
                Messages.decodeTransferErc20AndTotalSupplyMessage(data);
            receiver = message.baseErc20transfer.receiver;
            token = message.baseErc20transfer.token;
            amount = message.baseErc20transfer.amount;
            totalSupply = message.totalSupply;
        } else {
            Messages.TransferErc20AndTokenInfoMessage memory message =
                Messages.decodeTransferErc20AndTokenInfoMessage(data);
            receiver = message.baseErc20transfer.receiver;
            token = message.baseErc20transfer.token;
            amount = message.baseErc20transfer.amount;
            totalSupply = message.totalSupply;
            address contractOnSchainTmp = LockAndDataForSchainERC20(lockAndDataERC20)
                .getERC20OnSchain(schainID, token);
            if (contractOnSchainTmp == address(0)) {
                contractOnSchainTmp = _sendCreateERC20Request(
                    Messages.decodeTransferErc20AndTokenInfoMessage(data).tokenInfo
                );
                LockAndDataForSchainERC20(lockAndDataERC20)
                    .addERC20ForSchain(schainID, token, contractOnSchainTmp);
                emit ERC20TokenCreated(schainID, token, contractOnSchainTmp);
            }
        }
        address contractOnSchain = LockAndDataForSchainERC20(lockAndDataERC20)
            .getERC20OnSchain(schainID, token);
        if (totalSupply != LockAndDataForSchainERC20(lockAndDataERC20)
            .totalSupplyOnMainnet(contractOnSchain))
        {
            LockAndDataForSchainERC20(lockAndDataERC20).setTotalSupplyOnMainnet(
                contractOnSchain,
                totalSupply
            );
        }
        emit ERC20TokenReceived(token, contractOnSchain, amount);
        return LockAndDataForSchainERC20(lockAndDataERC20).sendERC20(
            contractOnSchain,
            receiver,
            amount
        );
    }

    /**
     * @dev Returns the receiver address.
     */
    function getReceiver(bytes calldata data) external pure returns (address receiver) {
        Messages.MessageType messageType = Messages.getMessageType(data);
        if (messageType == Messages.MessageType.TRANSFER_ERC20_AND_TOTAL_SUPPLY)
            return Messages.decodeTransferErc20AndTotalSupplyMessage(data).baseErc20transfer.receiver;
        else
            return Messages.decodeTransferErc20AndTokenInfoMessage(data).baseErc20transfer.receiver;
    }

    function _sendCreateERC20Request(
        Messages.Erc20TokenInfo memory erc20TokenInfo
    )
        internal
        returns (address newToken)
    {
        address tokenFactoryAddress = LockAndDataForSchain(getLockAndDataAddress()).getTokenFactory();
        newToken = TokenFactory(tokenFactoryAddress).createERC20(
            erc20TokenInfo.name,
            erc20TokenInfo.symbol
        );
    }
}
