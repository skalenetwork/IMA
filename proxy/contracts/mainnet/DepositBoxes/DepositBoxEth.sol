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
import "@skalenetwork/ima-interfaces/mainnet/DepositBoxes/IDepositBoxEth.sol";

import "../DepositBox.sol";
import "../../Messages.sol";

/**
 * @title DepositBoxEth
 * @dev Runs on mainnet,
 * accepts messages from schain,
 * stores deposits of ETH.
 */
contract DepositBoxEth is DepositBox, IDepositBoxEth {
    using AddressUpgradeable for address payable;

    mapping(address => uint256) public approveTransfers;

    mapping(bytes32 => uint256) public transferredAmount;

    receive() external payable override {
        revert("Use deposit function");
    }

    /**
     * @dev Allows `msg.sender` to send ETH from mainnet to schain.
     * 
     * Requirements:
     * 
     * - Schain name must not be `Mainnet`.
     * - Receiver contract should be added as twin contract on schain.
     * - Schain that receives tokens should not be killed.
     */
    function deposit(string memory schainName)
        external
        payable
        override
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

    /**
     * @dev Allows MessageProxyForMainnet contract to execute transferring ERC20 token from schain to mainnet.
     * 
     * Requirements:
     * 
     * - Schain from which the tokens came should not be killed.
     * - Sender contract should be defined and schain name cannot be `Mainnet`.
     * - Amount of tokens on DepositBoxERC20 should be equal or more than transferred amount.
     */
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
     * - DepositBoxETh must have sufficient ETH.
     * - User must be approved for ETH transfer.
     */
    function getMyEth() external override {
        require(
            address(this).balance >= approveTransfers[msg.sender],
            "Not enough ETH in DepositBox"
        );
        require(approveTransfers[msg.sender] > 0, "User has insufficient ETH");
        uint256 amount = approveTransfers[msg.sender];
        approveTransfers[msg.sender] = 0;
        payable(msg.sender).sendValue(amount);
    }

    /**
     * @dev Allows Schain owner to return each user their ETH.
     *
     * Requirements:
     * 
     * - Amount of ETH on schain should be equal or more than transferred amount.
     * - Receiver address must not be null.
     * - msg.sender should be an owner of schain
     * - IMA transfers Mainnet <-> schain should be killed
     */
    function getFunds(string calldata schainName, address payable receiver, uint amount)
        external
        override
        onlySchainOwner(schainName)
        whenKilled(keccak256(abi.encodePacked(schainName)))
    {
        require(receiver != address(0), "Receiver address has to be set");
        bytes32 schainHash = keccak256(abi.encodePacked(schainName));
        require(transferredAmount[schainHash] >= amount, "Incorrect amount");
        _removeTransferredAmount(schainHash, amount);
        receiver.sendValue(amount);
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
     * @dev Creates a new DepositBoxEth contract.
     */
    function initialize(
        IContractManager contractManagerOfSkaleManagerValue,        
        ILinker linkerValue,
        IMessageProxyForMainnet messageProxyValue
    )
        public
        override(DepositBox, IDepositBox)
        initializer
    {
        DepositBox.initialize(contractManagerOfSkaleManagerValue, linkerValue, messageProxyValue);
    }

    /**
     * @dev Saves amount of ETH that was transferred to schain.
     */
    function _saveTransferredAmount(bytes32 schainHash, uint256 amount) private {
        transferredAmount[schainHash] += amount;
    }

    /**
     * @dev Removes amount of ETH that was transferred from schain.
     */
    function _removeTransferredAmount(bytes32 schainHash, uint256 amount) private {
        transferredAmount[schainHash] -= amount;
    }
}
