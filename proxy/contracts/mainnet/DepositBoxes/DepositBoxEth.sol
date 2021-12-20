// SPDX-License-Identifier: AGPL-3.0-only

/**
 *   DepositBoxEth.sol - SKALE Interchain Messaging Agent
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

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../DepositBox.sol";
import "../../Messages.sol";



// This contract runs on the main net and accepts deposits
contract DepositBoxEth is DepositBox {
    using AddressUpgradeable for address payable;

    mapping(address => uint256) public approveTransfers;

    mapping(bytes32 => uint256) public transferredAmount;

    receive() external payable {
        revert("Use deposit function");
    }

    function deposit(string memory schainName)
        external
        payable
        rightTransaction(schainName, msg.sender)
        whenNotKilled(keccak256(abi.encodePacked(schainName)))
    {
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        address contractReceiver = schainLinks[schainHash];
        require(contractReceiver != address(0), "Unconnected chain");
        if (!linker.interchainConnections(schainHash))
            _saveTransferredAmount(schainHash, msg.value);
        messageProxy.postOutgoingMessage(
            schainHash,
            contractReceiver,
            Messages.encodeTransferEthMessage(msg.sender, msg.value)
        );
    }

    function postMessage(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        override
        onlyMessageProxy
        whenNotKilled(schainHash)
        checkReceiverChain(schainHash, sender)
        returns (address)
    {
        Messages.TransferEthMessage memory message = Messages.decodeTransferEthMessage(data);
        require(
            message.amount <= address(this).balance,
            "Not enough money to finish this transaction"
        );
        approveTransfers[message.receiver] += message.amount;
        if (!linker.interchainConnections(schainHash))
            _removeTransferredAmount(schainHash, message.amount);
        return message.receiver;
    }

    function gasPayer(
        bytes32 schainHash,
        address sender,
        bytes calldata data
    )
        external
        view
        override
        checkReceiverChain(schainHash, sender)
        returns (address)
    {
        Messages.TransferEthMessage memory message = Messages.decodeTransferEthMessage(data);
        return message.receiver;
    }

    /**
     * @dev Transfers a user's ETH.
     *
     * Requirements:
     *
     * - LockAndDataForMainnet must have sufficient ETH.
     * - User must be approved for ETH transfer.
     */
    function getMyEth() external {
        require(
            address(this).balance >= approveTransfers[msg.sender],
            "Not enough ETH in DepositBox"
        );
        require(approveTransfers[msg.sender] > 0, "User has insufficient ETH");
        uint256 amount = approveTransfers[msg.sender];
        approveTransfers[msg.sender] = 0;
        payable(msg.sender).sendValue(amount);
    }

    function getFunds(string calldata schainName, address payable receiver, uint amount)
        external
        onlySchainOwner(schainName)
        whenKilled(keccak256(abi.encodePacked(schainName)))
    {
        require(receiver != address(0), "Receiver address has to be set");
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(transferredAmount[schainHash] >= amount, "Incorrect amount");
        _removeTransferredAmount(schainHash, amount);
        receiver.sendValue(amount);
    }

    /// Create a new deposit box
    function initialize(
        IContractManager contractManagerOfSkaleManagerValue,        
        Linker linkerValue,
        MessageProxyForMainnet messageProxyValue
    )
        public
        override
        initializer
    {
        DepositBox.initialize(contractManagerOfSkaleManagerValue, linkerValue, messageProxyValue);
    }

    function _saveTransferredAmount(bytes32 schainHash, uint256 amount) private {
        transferredAmount[schainHash] += amount;
    }

    function _removeTransferredAmount(bytes32 schainHash, uint256 amount) private {
        transferredAmount[schainHash] -= amount;
    }
}
