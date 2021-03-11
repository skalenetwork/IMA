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

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

import "../Messages.sol";
import "./PermissionsForSchain.sol";


interface ITokenFactoryForERC20 {
    function createERC20(string memory name, string memory symbol, uint256 totalSupply)
        external
        returns (address payable);
}

interface ILockAndDataERC20S {
    function addERC20ForSchain(string calldata schainID, address erc20OnMainnet, address erc20OnSchain) external;
    function sendERC20(address contractOnSchain, address to, uint256 amount) external returns (bool);
    function receiveERC20(address contractOnSchain, uint256 amount) external returns (bool);
    function setTotalSupplyOnMainnet(address contractOnSchain, uint256 newTotalSupplyOnMainnet) external;
    function getERC20OnSchain(string calldata schainID, address contractOnMainnet) external view returns (address);
    function totalSupplyOnMainnet(address contractOnSchain) external view returns (uint256);
}

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
        address contractOnSchain = ILockAndDataERC20S(lockAndDataERC20).getERC20OnSchain(schainID, contractOnMainnet);
        require(contractOnSchain != address(0), "ERC20 contract does not exist on SKALE chain.");
        require(
            ILockAndDataERC20S(lockAndDataERC20).receiveERC20(contractOnSchain, amount),
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
        address contractOnSchain = ILockAndDataERC20S(lockAndDataERC20)
            .getERC20OnSchain(schainID, message.baseErc20transfer.token);
        if (contractOnSchain == address(0)) {
            contractOnSchain = _sendCreateERC20Request(message.tokenInfo);
            ILockAndDataERC20S(lockAndDataERC20)
                .addERC20ForSchain(schainID, message.baseErc20transfer.token, contractOnSchain);
            emit ERC20TokenCreated(schainID, message.baseErc20transfer.token, contractOnSchain);
        }
        if (message.tokenInfo.totalSupply != ILockAndDataERC20S(lockAndDataERC20)
            .totalSupplyOnMainnet(contractOnSchain))
        {
            ILockAndDataERC20S(lockAndDataERC20).setTotalSupplyOnMainnet(
                contractOnSchain,
                message.tokenInfo.totalSupply
            );
        }
        emit ERC20TokenReceived(message.baseErc20transfer.token, contractOnSchain, message.baseErc20transfer.amount);
        return ILockAndDataERC20S(lockAndDataERC20).sendERC20(
            message.baseErc20transfer.token,
            message.baseErc20transfer.receiver,
            message.baseErc20transfer.amount
        );
    }

    /**
     * @dev Returns the receiver address.
     */
    function getReceiver(bytes calldata data) external view returns (address receiver) {
        return Messages.decodeTransferErc20AndTokenInfoMessage(data).baseErc20transfer.receiver;
    }

    function _sendCreateERC20Request(
        Messages.Erc20TokenInfo memory Erc20TokenInfo
    )
        internal
        returns (address newToken)
    {
        address tokenFactoryAddress = LockAndDataForSchain(getLockAndDataAddress()).getTokenFactory();
        newToken = ITokenFactoryForERC20(tokenFactoryAddress).createERC20(
            Erc20TokenInfo.name,
            Erc20TokenInfo.symbol,
            Erc20TokenInfo.totalSupply
        );
    }
}
