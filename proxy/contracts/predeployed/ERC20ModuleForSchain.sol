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
        address lockAndDataERC20 = LockAndDataForSchain(
            getLockAndDataAddress()
        ).getLockAndDataErc20();
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
        Messages.TransferErc20AndTokenInfoMessage memory message =
            Messages.decodeTransferErc20AndTokenInfoMessage(data);
        address contractOnSchain = LockAndDataForSchainERC20(lockAndDataERC20)
            .getERC20OnSchain(schainID, message.baseErc20transfer.token);
        if (contractOnSchain == address(0)) {
            contractOnSchain = _sendCreateERC20Request(message.tokenInfo);
            LockAndDataForSchainERC20(lockAndDataERC20)
                .addERC20ForSchain(schainID, message.baseErc20transfer.token, contractOnSchain);
            emit ERC20TokenCreated(schainID, message.baseErc20transfer.token, contractOnSchain);
        }
        if (message.supply.totalSupply != LockAndDataForSchainERC20(lockAndDataERC20)
            .totalSupplyOnMainnet(contractOnSchain))
        {
            LockAndDataForSchainERC20(lockAndDataERC20).setTotalSupplyOnMainnet(
                contractOnSchain,
                message.supply.totalSupply
            );
        }
        emit ERC20TokenReceived(message.baseErc20transfer.token, contractOnSchain, message.baseErc20transfer.amount);
        return LockAndDataForSchainERC20(lockAndDataERC20).sendERC20(
            contractOnSchain,
            message.baseErc20transfer.receiver,
            message.baseErc20transfer.amount
        );
    }

    /**
     * @dev Returns the receiver address.
     */
    function getReceiver(bytes calldata data) external pure returns (address receiver) {
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
