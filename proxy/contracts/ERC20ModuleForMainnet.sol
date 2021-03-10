// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   ERC20ModuleForMainnet.sol - SKALE Interchain Messaging Agent
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

import "./thirdparty/openzeppelin/IERC20Metadata.sol";

import "./Messages.sol";
import "./PermissionsForMainnet.sol";


interface ILockAndDataERC20M {
    function sendERC20(address contractOnMainnet, address to, uint256 amount) external returns (bool);
    function addERC20ForSchain(string calldata schainID, address erc20OnMainnet) external;
    function getSchainToERC20(string calldata schainID, address erc20OnMainnet) external view returns (bool);
}

/**
 * @title ERC20 Module For Mainnet
 * @dev Runs on Mainnet, and manages receiving and sending of ERC20 token contracts
 * and encoding contractPosition in LockAndDataForMainnetERC20.
 */
contract ERC20ModuleForMainnet is PermissionsForMainnet {

    /**
     * @dev Emitted when token is mapped in LockAndDataForMainnetERC20.
     */
    event ERC20TokenAdded(string schainID, address indexed contractOnMainnet);
    
    /**
     * @dev Emitted when token is received by DepositBox and is ready to be cloned
     * or transferred on SKALE chain.
     */
    event ERC20TokenReady(address indexed contractOnMainnet, uint256 amount);

    /**
     * @dev Allows DepositBox to receive ERC20 tokens.
     * 
     * Emits an {ERC20TokenAdded} event on token mapping in LockAndDataForMainnetERC20.
     * Emits an {ERC20TokenReady} event.
     * 
     * Requirements:
     * 
     * - Amount must be less than or equal to the total supply of the ERC20 contract.
     */
    function receiveERC20(
        string calldata schainID,
        address contractOnMainnet,
        address to,
        uint256 amount
    )
        external
        allow("DepositBox")
        returns (bytes memory data)
    {
        address lockAndDataERC20 = IContractManager(lockAndDataAddress_).getContract(
            "LockAndDataERC20"
        );
        uint256 totalSupply = IERC20(contractOnMainnet).totalSupply();
        require(amount <= totalSupply, "Amount is incorrect");
        bool isERC20AddedToSchain = ILockAndDataERC20M(lockAndDataERC20).getSchainToERC20(schainID, contractOnMainnet);
        if (!isERC20AddedToSchain) {
            ILockAndDataERC20M(lockAndDataERC20).addERC20ForSchain(schainID, contractOnMainnet);
            emit ERC20TokenAdded(schainID, contractOnMainnet);
        } 
        data = Messages.encodeTransferErc20AndTokenInfoMessage(contractOnMainnet, to, amount, _getErc20TokenInfo(IERC20Metadata(contractOnMainnet)));
        emit ERC20TokenReady(contractOnMainnet, amount);
    }

    /**
     * @dev Allows DepositBox to send ERC20 tokens.
     */
    function sendERC20(bytes calldata data) external allow("DepositBox") returns (bool) {
        address lockAndDataERC20 = IContractManager(lockAndDataAddress_).getContract(
            "LockAndDataERC20"
        );
        Messages.TransferErc20Message memory message = Messages.decodeTransferErc20Message(data);
        return ILockAndDataERC20M(lockAndDataERC20).sendERC20(message.token, message.receiver, message.amount);
    }

    /**
     * @dev Returns the receiver address of the ERC20 token.
     */
    function getReceiver(bytes calldata data) external view returns (address receiver) {
        return Messages.decodeTransferErc20Message(data).receiver;
    }

    function initialize(address newLockAndDataAddress) public override initializer {
        PermissionsForMainnet.initialize(newLockAndDataAddress);
    }

    function _getErc20TokenInfo(IERC20Metadata erc20Token) private view returns (Messages.Erc20TokenInfo memory) {
        return Messages.Erc20TokenInfo({
            name: erc20Token.name(),
            decimals: erc20Token.decimals(),
            symbol: erc20Token.symbol(),
            totalSupply: erc20Token.totalSupply()
        });
    }
}
